import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import session from "express-session"
import passport from "passport"
import { Strategy as LocalStrategy } from "passport-local"
import GoogleStrategy from "passport-google-oauth2"
import bcrypt from "bcrypt"
import axios from "axios"
import csurf from "csurf"
import { body, validationResult } from "express-validator"
import { randomUUID } from "crypto"
import multer from "multer"

import db from "./config/db.js"
import {
  getCatalog,
  refreshCatalog,
  getCategoriesFromCatalog,
  findProduct,
  findColorVariant,
  getVariantStock,
  formatCurrency,
} from "./services/productService.js"
import {
  releaseExpiredReservations,
  reserveInventoryForCheckout,
  releaseReservationByCode,
  commitReservation,
} from "./services/inventoryService.js"
import {
  getCartItems,
  upsertCartItem,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  migrateGuestCartToUser,
} from "./services/cartService.js"
import {
  createOrder,
  getUserOrders,
  getOrderDetails,
  getAllOrders,
  updateOrderStatus,
} from "./services/orderService.js"
import {
  sendOrderConfirmationEmail,
  sendNewOrderNotificationEmail,
} from "./services/emailService.js"
import {
  getUserByEmail,
  getUserById,
  createUser,
  findOrCreateGoogleUser,
} from "./services/userService.js"
import {
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  isWishlisted,
} from "./services/wishlistService.js"
import { ensureAuthenticated, ensureAdmin } from "./middleware/auth.js"
import { globalLimiter, authLimiter, adminWriteLimiter } from "./middleware/rateLimiting.js"
import { notFoundHandler, appErrorHandler } from "./middleware/errorHandling.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const saltRounds = 10
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
const dbEnabled = Boolean(process.env.DATABASE_URL || (process.env.PG_USER && process.env.PG_HOST && process.env.PG_DATABASE && process.env.PG_PASSWORD))
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "public", "uploads"),
    filename: (req, file, cb) => {
      const safeName = file.originalname.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-")
      cb(null, `${Date.now()}-${safeName}`)
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"]
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Only JPG, PNG, WEBP, and AVIF uploads are allowed."))
      return
    }
    cb(null, true)
  },
  limits: {
    fileSize: 6 * 1024 * 1024,
    files: 10,
  },
})

app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))
app.use(express.static(path.join(__dirname, "public")))
app.disable("x-powered-by")
app.use(globalLimiter)
app.use(cookieParser(process.env.COOKIE_SECRET || "bagcartelsecret"))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.json())
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1)
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "bagcartelsecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  })
)
app.use(passport.initialize())
app.use(passport.session())
const csrfProtection = csurf({ cookie: true })

app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/admin/products" && req.is("multipart/form-data")) {
    return next()
  }
  return csrfProtection(req, res, next)
})

async function recoverSessionCart(req) {
  if (!dbEnabled) return
  if (!req.session.cart?.length) return
  const guestToken = req.session.guestToken || req.cookies.guestToken
  if (!guestToken) return

  for (const item of req.session.cart) {
    await upsertCartItem(db, {
      guestToken,
      productId: item.product.id,
      productName: item.product.name,
      color: item.color,
      unitPrice: item.product.price,
      quantity: item.quantity,
    })
  }
  req.session.cart = []
}

function makeOwnerClause(req) {
  return {
    userId: req.user?.id,
    guestToken: req.session.guestToken || req.cookies.guestToken,
  }
}

async function getCurrentCartItems(req) {
  if (dbEnabled) {
    return await getCartItems(db, makeOwnerClause(req))
  }
  return req.session.cart || []
}

async function getCartItemCount(req) {
  const cart = await getCurrentCartItems(req)
  return cart.reduce((total, item) => total + (item.quantity || 0), 0)
}

function getProductCategories(product) {
  if (Array.isArray(product?.category)) return product.category
  if (typeof product?.category === "string" && product.category.trim()) return [product.category]
  return []
}

function hasCategory(product, category) {
  return getProductCategories(product).includes(category)
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

async function getDashboardAnalytics() {
  const [salesRow, ordersRow, bestSellers, lowStock, monthlySales] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_sales, COALESCE(SUM(total_amount), 0) AS revenue
       FROM orders
       WHERE payment_status = 'Paid'`
    ),
    db.query(`SELECT COUNT(*)::int AS total_orders FROM orders`),
    db.query(
      `SELECT oi.product_name, SUM(oi.quantity)::int AS sold
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.payment_status = 'Paid'
       GROUP BY oi.product_name
       ORDER BY sold DESC
       LIMIT 5`
    ),
    db.query(
      `SELECT p.id, p.name, pv.color, i.quantity, i.low_stock_threshold, i.status
       FROM inventories i
       JOIN product_variants pv ON pv.id = i.variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE i.quantity <= i.low_stock_threshold
       ORDER BY i.quantity ASC
       LIMIT 20`
    ),
    db.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COALESCE(SUM(total_amount), 0) AS amount
       FROM orders
       WHERE payment_status = 'Paid'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY DATE_TRUNC('month', created_at) ASC`
    ),
  ])

  return {
    totalSales: Number(salesRow.rows[0].total_sales || 0),
    totalOrders: Number(ordersRow.rows[0].total_orders || 0),
    revenue: Number(salesRow.rows[0].revenue || 0),
    bestSellers: bestSellers.rows,
    lowStock: lowStock.rows,
    monthlySales: monthlySales.rows.map((row) => ({ month: row.month, amount: Number(row.amount) })),
  }
}

async function getAdminProducts() {
  const result = await db.query(
    `SELECT
      p.id,
      p.name,
      p.price,
      p.description,
      p.is_active,
      COALESCE(string_agg(DISTINCT c.name, ', '), '') AS categories,
      COALESCE(SUM(i.quantity), 0)::int AS total_stock,
      MIN(i.status) AS stock_status
     FROM products p
     LEFT JOIN product_categories pc ON pc.product_id = p.id
     LEFT JOIN categories c ON c.id = pc.category_id
     LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = true
     LEFT JOIN inventories i ON i.variant_id = pv.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  )
  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    price: Number(row.price),
    total_stock: Number(row.total_stock),
  }))
}

async function getProductForAdminEdit(productId) {
  const productResult = await db.query(`SELECT id, name, description, price, is_active FROM products WHERE id = $1`, [productId])
  if (!productResult.rowCount) return null

  const product = productResult.rows[0]
  const categories = await db.query(
    `SELECT c.name
     FROM product_categories pc
     JOIN categories c ON c.id = pc.category_id
     WHERE pc.product_id = $1`,
    [productId]
  )
  const sizes = await db.query(`SELECT size_label, dimensions FROM product_sizes WHERE product_id = $1 ORDER BY id`, [productId])
  const variants = await db.query(
    `SELECT pv.id, pv.color, i.quantity, i.low_stock_threshold, i.status
     FROM product_variants pv
     LEFT JOIN inventories i ON i.variant_id = pv.id
     WHERE pv.product_id = $1 AND pv.is_active = true
     ORDER BY pv.id`,
    [productId]
  )

  const variantIds = variants.rows.map((row) => row.id)
  let imagesByVariant = {}
  if (variantIds.length) {
    const imageResult = await db.query(
      `SELECT variant_id, image_url, id
       FROM product_variant_images
       WHERE variant_id = ANY($1::int[])
       ORDER BY sort_order, id`,
      [variantIds]
    )
    imagesByVariant = imageResult.rows.reduce((acc, row) => {
      acc[row.variant_id] = acc[row.variant_id] || []
      acc[row.variant_id].push({ id: Number(row.id), url: row.image_url })
      return acc
    }, {})
  }

  return {
    ...product,
    id: Number(product.id),
    price: Number(product.price),
    categories: categories.rows.map((row) => row.name),
    sizes: sizes.rows,
    variants: variants.rows.map((row) => ({
      id: Number(row.id),
      color: row.color,
      quantity: Number(row.quantity || 0),
      lowStockThreshold: Number(row.low_stock_threshold || 3),
      status: row.status || "In Stock",
      images: imagesByVariant[row.id] || [],
    })),
  }
}

async function upsertProductFromPayload({
  productId,
  name,
  description,
  price,
  categoryNames,
  sizes,
  variants,
  uploadedImageUrls,
  adminUserId,
}) {
  const client = await db.connect()
  try {
    await client.query("BEGIN")

    let resolvedProductId = productId
    if (!resolvedProductId) {
      const created = await client.query(
        `INSERT INTO products (id, name, description, price, is_active)
         VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM products), $1, $2, $3, true)
         RETURNING id`,
        [name, description, price]
      )
      resolvedProductId = Number(created.rows[0].id)
    } else {
      await client.query(
        `UPDATE products
         SET name = $1,
             description = $2,
             price = $3,
             updated_at = now()
         WHERE id = $4`,
        [name, description, price, resolvedProductId]
      )
      await client.query(`DELETE FROM product_categories WHERE product_id = $1`, [resolvedProductId])
      await client.query(`DELETE FROM product_sizes WHERE product_id = $1`, [resolvedProductId])
      await client.query(
        `UPDATE product_variants
         SET is_active = false
         WHERE product_id = $1`,
        [resolvedProductId]
      )
    }

    for (const categoryName of categoryNames) {
      if (!categoryName) continue
      const categoryResult = await client.query(
        `INSERT INTO categories (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (name)
         DO UPDATE SET slug = EXCLUDED.slug
         RETURNING id`,
        [categoryName, slugify(categoryName)]
      )
      await client.query(
        `INSERT INTO product_categories (product_id, category_id)
         VALUES ($1, $2)
         ON CONFLICT (product_id, category_id) DO NOTHING`,
        [resolvedProductId, categoryResult.rows[0].id]
      )
    }

    for (const size of sizes) {
      if (!size.size) continue
      await client.query(
        `INSERT INTO product_sizes (product_id, size_label, dimensions)
         VALUES ($1, $2, $3)`,
        [resolvedProductId, size.size, size.dimensions || null]
      )
    }

    for (const variant of variants) {
      if (!variant.color) continue

      const variantResult = await client.query(
        `INSERT INTO product_variants (product_id, color, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (product_id, color)
         DO UPDATE SET is_active = true
         RETURNING id`,
        [resolvedProductId, variant.color]
      )
      const variantId = Number(variantResult.rows[0].id)
      const quantity = Math.max(0, Number(variant.quantity || 0))
      const threshold = Math.max(1, Number(variant.lowStockThreshold || 3))
      const status = quantity <= 0 ? "Out of Stock" : quantity <= threshold ? "Low Stock" : "In Stock"

      await client.query(
        `INSERT INTO inventories (variant_id, quantity, reserved_quantity, low_stock_threshold, status)
         VALUES ($1, $2, 0, $3, $4)
         ON CONFLICT (variant_id)
         DO UPDATE SET
           quantity = EXCLUDED.quantity,
           low_stock_threshold = EXCLUDED.low_stock_threshold,
           status = EXCLUDED.status,
           updated_at = now()`,
        [variantId, quantity, threshold, status]
      )

      await client.query(
        `INSERT INTO product_stocks (product_id, color, stock)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, color) DO UPDATE SET stock = EXCLUDED.stock`,
        [resolvedProductId, variant.color, quantity]
      )

      await client.query(
        `INSERT INTO inventory_transactions (
          variant_id,
          change_type,
          delta_quantity,
          balance_after,
          reference_type,
          reference_id,
          note,
          created_by
        ) VALUES ($1, 'set', $2, $3, 'admin', $4, 'Admin stock set', $5)`,
        [variantId, quantity, quantity, String(resolvedProductId), adminUserId || null]
      )

      if (Array.isArray(variant.existingImagesToKeep)) {
        await client.query(
          `DELETE FROM product_variant_images
           WHERE variant_id = $1
             AND id <> ALL($2::int[])`,
          [variantId, variant.existingImagesToKeep.length ? variant.existingImagesToKeep : [0]]
        )
      }

      const imageUrls = [
        ...(variant.imageUrls || []),
        ...((uploadedImageUrls[variant.color] || []).filter(Boolean)),
      ]

      for (let index = 0; index < imageUrls.length; index += 1) {
        const image = imageUrls[index]
        await client.query(
          `INSERT INTO product_variant_images (variant_id, image_url, sort_order)
           VALUES ($1, $2, $3)`,
          [variantId, image, index]
        )
      }
    }

    await client.query("COMMIT")
    await refreshCatalog(db, { force: true })
    return resolvedProductId
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

app.use(async (req, res, next) => {
  try {
    if (dbEnabled) {
      await releaseExpiredReservations(db)
      await refreshCatalog(db)
    }

    if (!req.session.guestToken) {
      const token = req.cookies.guestToken || randomUUID()
      req.session.guestToken = token
      res.cookie("guestToken", token, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
      })
    }
    await recoverSessionCart(req)
    res.locals.user = req.user
    res.locals.cartCount = await getCartItemCount(req)
    res.locals.googleEnabled = googleEnabled
    res.locals.csrfToken = typeof req.csrfToken === "function" ? req.csrfToken() : ""
    res.locals.formData = req.session.formData || {}
    req.session.formData = {}
    res.locals.flashMessages = req.session.messages || []
    res.locals.formatCurrency = formatCurrency
    res.locals.currentPath = req.path
    const catalog = getCatalog()
    res.locals.productSearchData = catalog.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.colors?.[0]?.images?.[0] || "",
      category: getProductCategories(product).join(" "),
    }))
    req.session.messages = []
    next()
  } catch (error) {
    next(error)
  }
})

passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const user = await getUserByEmail(email)
      if (!user || !user.password) {
        return done(null, false)
      }
      const valid = await bcrypt.compare(password, user.password)
      return done(null, valid ? user : false)
    } catch (error) {
      return done(error)
    }
  })
)

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.email || profile.emails?.[0]?.value
          if (!email) {
            return done(new Error("Google account did not return an email."))
          }
          const user = await findOrCreateGoogleUser(email, profile.id)
          return done(null, user)
        } catch (error) {
          return done(error)
        }
      }
    )
  )
}

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await getUserById(id)
    done(null, user || false)
  } catch (error) {
    done(error)
  }
})

async function mergeGuestCart(req) {
  if (req.user?.id && req.session.guestToken) {
    await migrateGuestCartToUser(db, req.session.guestToken, req.user.id)
  }
}

app.get("/", (req, res) => {
  const featured = getCatalog().slice(0, 4)
  const testimonials = [
    {
      name: "Aisha Bello",
      role: "Lagos",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
      rating: 5,
      quote: "My Chicnstraps bag arrived and the finish is unreal. It instantly elevated my wardrobe.",
    },
    {
      name: "Tomi Adebayo",
      role: "Abuja",
      avatar: "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=200&q=80",
      rating: 5,
      quote: "The packaging felt like unboxing luxury. I got compliments the first day I wore it.",
    },
    {
      name: "Zainab Musa",
      role: "Port Harcourt",
      avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=80",
      rating: 4,
      quote: "High quality, rich texture, and the color looked exactly like the photos.",
    },
  ]
  const testimonial = testimonials[Math.floor(Math.random() * testimonials.length)]
  res.render("home", { featured, testimonial })
})

app.get("/products", async (req, res, next) => {
  try {
    const selectedCategory = req.query.category
    const catalog = getCatalog()
    const categories = getCategoriesFromCatalog()
    const products = selectedCategory
      ? catalog.filter((product) => hasCategory(product, selectedCategory))
      : catalog
    let wishlistKeys = []
    if (req.user) {
      const saved = await getWishlist(db, req.user.id)
      wishlistKeys = saved.map((item) => `${item.product_id}::${item.color}`)
    }
    res.render("products", { products, categories, selectedCategory, wishlistKeys })
  } catch (error) {
    next(error)
  }
})

app.get("/product/:id", async (req, res, next) => {
  try {
    const product = findProduct(req.params.id)
    if (!product) {
      return res.status(404).render("404")
    }
    const displayProduct = JSON.parse(JSON.stringify(product))
    for (const color of displayProduct.colors) {
      color.stock = await getVariantStock(db, displayProduct.id, color.name)
    }
    const wishlisted = req.user ? await isWishlisted(db, req.user.id, displayProduct.id, displayProduct.colors[0].name) : false
    const currentCategories = getProductCategories(displayProduct)
    const recommendations = getCatalog()
      .filter(
        (item) =>
          item.id !== displayProduct.id &&
          getProductCategories(item).some((category) => currentCategories.includes(category))
      )
      .slice(0, 4)
    res.render("product", { product: displayProduct, wishlisted, recommendations })
  } catch (error) {
    next(error)
  }
})

app.post(
  "/cart/add",
  body("productId").isInt({ min: 1 }),
  body("quantity").isInt({ min: 1 }),
  body("color").trim().notEmpty(),
  async (req, res, next) => {
    try {
      const wantsJson = req.xhr || req.get("x-requested-with") === "XMLHttpRequest" || req.accepts(["json", "html"]) === "json"
      const errors = validationResult(req)
      const productId = Number(req.body.productId)
      const color = req.body.color
      const quantity = Number(req.body.quantity)
      const product = findProduct(productId)
      if (!product || !errors.isEmpty()) {
        req.session.messages = [{ type: "error", text: "Unable to add this product to your cart." }]
        if (wantsJson) {
          return res.status(400).json({ ok: false, message: "Unable to add this product to your cart." })
        }
        return res.redirect(`/product/${productId}`)
      }
      const variant = findColorVariant(product, color)
      if (!variant) {
        req.session.messages = [{ type: "error", text: "Please choose a valid color variant." }]
        if (wantsJson) {
          return res.status(400).json({ ok: false, message: "Please choose a valid color variant." })
        }
        return res.redirect(`/product/${productId}`)
      }
      const stock = await getVariantStock(db, productId, color)
      const existingCartItems = await getCurrentCartItems(req)
      const existingLine = existingCartItems.find((item) => Number(item.product_id || item.product?.id) === productId && item.color === color)
      const existingQuantity = Number(existingLine?.quantity || 0)
      const requestedTotal = existingQuantity + quantity
      if (requestedTotal > stock) {
        req.session.messages = [{ type: "error", text: `Only ${stock} item(s) available for ${color}.` }]
        if (wantsJson) {
          return res.status(400).json({ ok: false, message: `Only ${stock} item(s) available for ${color}.` })
        }
        return res.redirect(`/product/${productId}`)
      }
      const owner = makeOwnerClause(req)
      if (dbEnabled) {
        await upsertCartItem(db, {
          ...owner,
          productId,
          productName: product.name,
          color,
          unitPrice: product.price,
          quantity,
        })
      } else {
        req.session.cart = req.session.cart || []
        const existing = req.session.cart.find((item) => item.product.id === productId && item.color === color)
        if (existing) {
          existing.quantity = requestedTotal
        } else {
          req.session.cart.push({ product, color, quantity })
        }
      }
      req.session.messages = [{ type: "success", text: "Product added to cart." }]
      if (wantsJson) {
        const cartCount = await getCartItemCount(req)
        return res.json({
          ok: true,
          message: "Added to cart.",
          cartCount,
          product: {
            id: product.id,
            name: product.name,
            color,
            image: variant.images?.[0] || product.colors?.[0]?.images?.[0] || "",
            price: product.price,
            quantity,
          },
        })
      }
      res.redirect("/cart")
    } catch (error) {
      next(error)
    }
  }
)

app.get("/cart", async (req, res, next) => {
  try {
    const cart = await getCurrentCartItems(req)
      .then((items) =>
        items.map((item) => ({
          ...item,
          product: item.product || findProduct(item.product_id),
        }))
      )
    const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
    res.render("cart", { cart, total })
  } catch (error) {
    next(error)
  }
})

app.post(
  "/cart/update",
  body("productId").isInt({ min: 1 }),
  body("quantity").isInt({ min: 1 }),
  body("color").trim().notEmpty(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      const productId = Number(req.body.productId)
      const quantity = Number(req.body.quantity)
      const color = req.body.color
      if (!errors.isEmpty()) {
        req.session.messages = [{ type: "error", text: "Unable to update quantity." }]
        return res.redirect("/cart")
      }
      const product = findProduct(productId)
      if (!product) {
        req.session.messages = [{ type: "error", text: "Product not found." }]
        return res.redirect("/cart")
      }
      const stock = await getVariantStock(db, productId, color)
      if (quantity > stock) {
        req.session.messages = [{ type: "error", text: `Only ${stock} item(s) available for ${color}.` }]
        return res.redirect("/cart")
      }
      const owner = makeOwnerClause(req)
      if (dbEnabled) {
        await updateCartItemQuantity(db, { ...owner, productId, color, quantity })
      } else {
        const item = (req.session.cart || []).find((line) => line.product.id === productId && line.color === color)
        if (item) item.quantity = quantity
      }
      req.session.messages = [{ type: "success", text: "Cart updated." }]
      res.redirect("/cart")
    } catch (error) {
      next(error)
    }
  }
)

app.post(
  "/cart/remove",
  body("productId").isInt({ min: 1 }),
  body("color").trim().notEmpty(),
  async (req, res, next) => {
    try {
      const productId = Number(req.body.productId)
      const color = req.body.color
      const owner = makeOwnerClause(req)
      if (dbEnabled) {
        await removeCartItem(db, { ...owner, productId, color })
      } else {
        req.session.cart = (req.session.cart || []).filter((item) => !(item.product.id === productId && item.color === color))
      }
      req.session.messages = [{ type: "success", text: "Item removed from cart." }]
      res.redirect("/cart")
    } catch (error) {
      next(error)
    }
  }
)

app.get("/checkout", ensureAuthenticated, async (req, res, next) => {
  try {
    const cart = await getCurrentCartItems(req)
    if (!cart.length) {
      req.session.messages = [{ type: "error", text: "Your cart is empty." }]
      return res.redirect("/cart")
    }
    const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
    res.render("checkout", { cart, subtotal, errors: [], formData: {} })
  } catch (error) {
    next(error)
  }
})

app.post(
  "/checkout",
  ensureAuthenticated,
  body("customerName").trim().notEmpty().withMessage("Name is required."),
  body("phone").trim().notEmpty().withMessage("Phone is required."),
  body("street").trim().notEmpty().withMessage("Street address is required."),
  body("city").trim().notEmpty().withMessage("City is required."),
  body("state").trim().notEmpty().withMessage("State is required."),
  body("postalCode").trim().notEmpty().withMessage("Postal code is required."),
  body("shippingMethod").isIn(["pickup", "lagos", "outside"]).withMessage("Select a shipping option."),
  async (req, res, next) => {
    let reservationCodeToRelease = null
    try {
      const cart = await getCurrentCartItems(req)
      const errors = validationResult(req)
      const formData = req.body
      const shippingFees = { ogudu: 1000, alapere: 1500, ikeja: 3000, anthony: 3500, yaba: 3500, lekki: 5000, ajah: 6000 }
      if (!cart.length) {
        req.session.messages = [{ type: "error", text: "Your cart is empty." }]
        return res.redirect("/cart")
      }
      if (!errors.isEmpty()) {
        const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
        return res.render("checkout", { cart, subtotal, errors: errors.array(), formData })
      }
      const shippingMethod = req.body.shippingMethod
      const lagosArea = req.body.lagosArea || ""
      let shippingFee = 0

      if (shippingMethod === "lagos") {
        if (!shippingFees[lagosArea]) {
          const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
          return res.render("checkout", {
            cart,
            subtotal,
            errors: [{ msg: "Please select a valid Lagos delivery area." }],
            formData,
          })
        }
        shippingFee = shippingFees[lagosArea]
      }

      const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
      const totalAmount = subtotal + shippingFee

      const reservation = await reserveInventoryForCheckout(db, {
        userId: req.user.id,
        cartItems: cart,
      })
      reservationCodeToRelease = reservation.reservation_code

      req.session.checkout = {
        customerName: req.body.customerName,
        phone: req.body.phone,
        street: req.body.street,
        city: req.body.city,
        state: req.body.state,
        postalCode: req.body.postalCode,
        country: req.body.country || "Nigeria",
        shippingMethod,
        lagosArea,
        shippingFee,
        totalAmount,
        reservationCode: reservation.reservation_code,
        reservationExpiresAt: reservation.expires_at,
      }
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: req.user.email,
          amount: Math.round(totalAmount * 100),
          callback_url: `${process.env.BASE_URL || "http://localhost:3000"}/paystack/callback`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      )
      res.redirect(response.data.data.authorization_url)
    } catch (error) {
      if (reservationCodeToRelease) {
        try {
          await releaseReservationByCode(db, reservationCodeToRelease, { note: "Checkout initialization failed" })
        } catch (releaseError) {
          console.error("Failed to release reservation after checkout error:", releaseError)
        }
      }
      if (error?.message === "This item is no longer available.") {
        req.session.messages = [{ type: "error", text: "This item is no longer available." }]
        return res.redirect("/cart")
      }
      next(error)
    }
  }
)

app.get("/paystack/callback", ensureAuthenticated, async (req, res, next) => {
  let reservationCodeForRecovery = null
  try {
    const reference = req.query.reference
    const checkout = req.session.checkout
    if (!reference || !checkout) {
      req.session.messages = [{ type: "error", text: "Unable to complete payment. Please try again." }]
      return res.redirect("/checkout")
    }
    reservationCodeForRecovery = checkout.reservationCode || null
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const data = response.data.data
    if (data.status !== "success") {
      await releaseReservationByCode(db, checkout.reservationCode, { note: "Payment verification failed" })
      req.session.messages = [{ type: "error", text: "Payment was not successful." }]
      return res.redirect("/checkout")
    }
    const cart = await getCurrentCartItems(req)
    if (!cart.length) {
      req.session.messages = [{ type: "error", text: "Your cart is empty." }]
      return res.redirect("/cart")
    }
    const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
    const totalAmount = subtotal + checkout.shippingFee
    if (Math.round(totalAmount * 100) !== Number(data.amount)) {
      await releaseReservationByCode(db, checkout.reservationCode, { note: "Payment amount mismatch" })
      req.session.messages = [{ type: "error", text: "Payment amount does not match order total." }]
      return res.redirect("/checkout")
    }

    const order = await commitReservation(db, {
      reservationCode: checkout.reservationCode,
      paystackReference: data.reference,
      createOrderFn: async (client, payload) =>
        createOrder(client, {
          userId: req.user.id,
          customerName: checkout.customerName,
          email: req.user.email,
          phone: checkout.phone,
          shippingAddress: {
            street: checkout.street,
            city: checkout.city,
            state: checkout.state,
            postalCode: checkout.postalCode,
            country: checkout.country,
          },
          shippingMethod: checkout.shippingMethod,
          shippingFee: checkout.shippingFee,
          items: payload.orderItems,
          paymentStatus: "Paid",
          orderStatus: "Processing",
          totalAmount,
          paystackReference: data.reference,
          reservationCode: payload.reservationCode,
        }),
    })

    if (dbEnabled) {
      await clearCart(db, { userId: req.user.id })
    } else {
      req.session.cart = []
    }
    req.session.checkout = null
    req.session.messages = [{ type: "success", text: "Order completed successfully." }]
    const orderDetail = await getOrderDetails(db, order.id)
    await sendOrderConfirmationEmail(order, orderDetail.items)
    await sendNewOrderNotificationEmail(order, orderDetail.items)
    res.redirect(`/thank-you/${order.id}`)
  } catch (error) {
    if (reservationCodeForRecovery) {
      try {
        await releaseReservationByCode(db, reservationCodeForRecovery, { note: "Payment callback error recovery" })
      } catch (releaseError) {
        console.error("Failed to release reservation during callback recovery:", releaseError)
      }
    }
    next(error)
  }
})

app.get("/thank-you/:id", ensureAuthenticated, async (req, res, next) => {
  try {
    const detail = await getOrderDetails(db, Number(req.params.id))
    if (!detail || (detail.order.user_id !== req.user.id && !req.user.is_admin)) {
      return res.status(404).render("404")
    }
    res.render("thank-you", { order: detail.order, items: detail.items })
  } catch (error) {
    next(error)
  }
})

app.get("/orders", ensureAuthenticated, async (req, res, next) => {
  try {
    const orders = await getUserOrders(db, req.user.id)
    res.render("orders", { orders })
  } catch (error) {
    next(error)
  }
})

app.get("/orders/:id", ensureAuthenticated, async (req, res, next) => {
  try {
    const detail = await getOrderDetails(db, Number(req.params.id))
    if (!detail || detail.order.user_id !== req.user.id) {
      return res.status(404).render("404")
    }
    res.render("order-details", { order: detail.order, items: detail.items })
  } catch (error) {
    next(error)
  }
})

app.get("/admin/orders", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const search = req.query.search || ""
    const status = req.query.status || ""
    const orders = await getAllOrders(db, { search, status })
    res.render("admin-orders", { orders, search, status })
  } catch (error) {
    next(error)
  }
})

app.get("/admin/orders/:id", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const detail = await getOrderDetails(db, Number(req.params.id))
    if (!detail) {
      return res.status(404).render("404")
    }
    res.render("admin-order-details", { order: detail.order, items: detail.items, csrfToken: req.csrfToken() })
  } catch (error) {
    next(error)
  }
})

app.post(
  "/admin/orders/:id/status",
  ensureAuthenticated,
  ensureAdmin,
  body("status").isIn(["Pending", "Processing", "Shipped", "Delivered", "Cancelled"]),
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        req.session.messages = [{ type: "error", text: "Invalid order status." }]
        return res.redirect(`/admin/orders/${req.params.id}`)
      }
      await updateOrderStatus(db, Number(req.params.id), req.body.status)
      req.session.messages = [{ type: "success", text: "Order status updated." }]
      res.redirect(`/admin/orders/${req.params.id}`)
    } catch (error) {
      next(error)
    }
  }
)

app.get("/admin", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const analytics = await getDashboardAnalytics()
    res.render("admin-dashboard", { analytics })
  } catch (error) {
    next(error)
  }
})

app.get("/admin/products", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const products = await getAdminProducts()
    res.render("admin-products", { products })
  } catch (error) {
    next(error)
  }
})

app.get("/admin/products/new", ensureAuthenticated, ensureAdmin, async (req, res) => {
  res.render("admin-product-form", {
    mode: "create",
    product: null,
  })
})

app.get("/admin/products/:id/edit", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const product = await getProductForAdminEdit(Number(req.params.id))
    if (!product) {
      return res.status(404).render("404")
    }
    res.render("admin-product-form", {
      mode: "edit",
      product,
    })
  } catch (error) {
    next(error)
  }
})

app.post(
  "/admin/products",
  ensureAuthenticated,
  ensureAdmin,
  adminWriteLimiter,
  upload.array("images", 10),
  csrfProtection,
  body("name").trim().notEmpty().withMessage("Product name is required."),
  body("price").isFloat({ min: 0 }).withMessage("Price must be a valid non-negative number."),
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        req.session.messages = [{ type: "error", text: errors.array()[0].msg }]
        return res.redirect(req.get("Referrer") || "/admin/products")
      }

      const asArray = (value) => {
        if (Array.isArray(value)) return value
        if (value === undefined || value === null || value === "") return []
        return [value]
      }

      const categoryNames = asArray(req.body.categories)
        .flatMap((entry) => String(entry).split(","))
        .map((entry) => entry.trim())
        .filter(Boolean)

      const sizeLabels = asArray(req.body.sizeLabels)
      const sizeDimensions = asArray(req.body.sizeDimensions)
      const sizes = sizeLabels.map((label, idx) => ({
        size: String(label || "").trim(),
        dimensions: String(sizeDimensions[idx] || "").trim(),
      }))

      const variantColors = asArray(req.body.variantColors)
      const variantQuantities = asArray(req.body.variantQuantities)
      const variantThresholds = asArray(req.body.variantThresholds)
      const variantImageUrls = asArray(req.body.variantImageUrls)

      const uploadedImageUrls = {}
      for (const file of req.files || []) {
        const colorFromField = String(file.fieldname || "").split("__")[1]
        const colorKey = colorFromField || variantColors[0] || "default"
        uploadedImageUrls[colorKey] = uploadedImageUrls[colorKey] || []
        uploadedImageUrls[colorKey].push(`/uploads/${file.filename}`)
      }

      const variants = variantColors.map((color, idx) => ({
        color: String(color || "").trim(),
        quantity: Number(variantQuantities[idx] || 0),
        lowStockThreshold: Number(variantThresholds[idx] || 3),
        imageUrls: String(variantImageUrls[idx] || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        existingImagesToKeep: [],
      }))

      const productId = req.body.productId ? Number(req.body.productId) : null
      const resolvedProductId = await upsertProductFromPayload({
        productId,
        name: req.body.name,
        description: req.body.description || "",
        price: Number(req.body.price),
        categoryNames,
        sizes,
        variants,
        uploadedImageUrls,
        adminUserId: req.user.id,
      })

      req.session.messages = [{ type: "success", text: "Product saved successfully." }]
      res.redirect(`/admin/products/${resolvedProductId}/edit`)
    } catch (error) {
      next(error)
    }
  }
)

app.post(
  "/admin/products/:id/delete",
  ensureAuthenticated,
  ensureAdmin,
  adminWriteLimiter,
  async (req, res, next) => {
    try {
      const productId = Number(req.params.id)
      await db.query(
        `UPDATE products
         SET is_active = false,
             updated_at = now()
         WHERE id = $1`,
        [productId]
      )
      await refreshCatalog(db, { force: true })
      req.session.messages = [{ type: "success", text: "Product archived." }]
      res.redirect("/admin/products")
    } catch (error) {
      next(error)
    }
  }
)

app.post(
  "/admin/inventory/:variantId/adjust",
  ensureAuthenticated,
  ensureAdmin,
  adminWriteLimiter,
  body("delta").isInt(),
  body("reason").trim().notEmpty(),
  async (req, res, next) => {
    const client = await db.connect()
    try {
      const variantId = Number(req.params.variantId)
      const delta = Number(req.body.delta)
      const reason = req.body.reason

      await client.query("BEGIN")
      const inventoryResult = await client.query(
        `SELECT quantity, reserved_quantity, low_stock_threshold
         FROM inventories
         WHERE variant_id = $1
         FOR UPDATE`,
        [variantId]
      )
      if (!inventoryResult.rowCount) {
        throw new Error("Inventory record not found.")
      }

      const row = inventoryResult.rows[0]
      const nextQuantity = Math.max(0, Number(row.quantity) + delta)
      const threshold = Number(row.low_stock_threshold)
      const status = nextQuantity <= 0 ? "Out of Stock" : nextQuantity <= threshold ? "Low Stock" : "In Stock"

      await client.query(
        `UPDATE inventories
         SET quantity = $1,
             status = $2,
             updated_at = now()
         WHERE variant_id = $3`,
        [nextQuantity, status, variantId]
      )

      await client.query(
        `INSERT INTO inventory_transactions (
          variant_id,
          change_type,
          delta_quantity,
          balance_after,
          reference_type,
          reference_id,
          note,
          created_by
        ) VALUES ($1, 'adjustment', $2, $3, 'admin', $4, $5, $6)`,
        [variantId, delta, nextQuantity, String(req.user.id), reason, req.user.id]
      )

      await client.query("COMMIT")
      await refreshCatalog(db, { force: true })
      req.session.messages = [{ type: "success", text: "Inventory adjusted." }]
      res.redirect(req.get("Referrer") || "/admin/products")
    } catch (error) {
      await client.query("ROLLBACK")
      next(error)
    } finally {
      client.release()
    }
  }
)

app.get("/admin/customers", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim().toLowerCase()
    const customers = await db.query(
      `SELECT u.id, u.email, u.created_at, COUNT(o.id)::int AS total_orders, COALESCE(SUM(o.total_amount), 0) AS total_spent
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       WHERE ($1 = '' OR LOWER(u.email) LIKE ('%' || $1 || '%'))
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT 300`,
      [search]
    )

    res.render("admin-customers", { customers: customers.rows, search })
  } catch (error) {
    next(error)
  }
})

app.get("/admin/customers/:id", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const customerId = Number(req.params.id)
    const customerResult = await db.query(`SELECT id, email, created_at FROM users WHERE id = $1`, [customerId])
    if (!customerResult.rowCount) {
      return res.status(404).render("404")
    }
    const orders = await db.query(
      `SELECT id, order_number, order_status, payment_status, total_amount, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    )
    res.render("admin-customer-details", { customer: customerResult.rows[0], orders: orders.rows })
  } catch (error) {
    next(error)
  }
})

app.get("/api/products", async (req, res, next) => {
  try {
    const category = req.query.category
    const catalog = getCatalog()
    const products = category ? catalog.filter((product) => hasCategory(product, category)) : catalog
    res.json({ ok: true, data: products })
  } catch (error) {
    next(error)
  }
})

app.get("/api/categories", async (req, res, next) => {
  try {
    res.json({ ok: true, data: getCategoriesFromCatalog() })
  } catch (error) {
    next(error)
  }
})

app.get("/api/inventory", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT p.id AS product_id, p.name, pv.id AS variant_id, pv.color, i.quantity, i.reserved_quantity, i.low_stock_threshold, i.status
       FROM inventories i
       JOIN product_variants pv ON pv.id = i.variant_id
       JOIN products p ON p.id = pv.product_id
       ORDER BY p.id, pv.id`
    )
    res.json({ ok: true, data: result.rows })
  } catch (error) {
    next(error)
  }
})

app.get("/api/inventory/history", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)))
    const result = await db.query(
      `SELECT
         it.id,
         it.change_type,
         it.delta_quantity,
         it.balance_after,
         it.reference_type,
         it.reference_id,
         it.note,
         it.created_at,
         p.id AS product_id,
         p.name AS product_name,
         pv.color
       FROM inventory_transactions it
       JOIN product_variants pv ON pv.id = it.variant_id
       JOIN products p ON p.id = pv.product_id
       ORDER BY it.created_at DESC
       LIMIT $1`,
      [limit]
    )
    res.json({ ok: true, data: result.rows })
  } catch (error) {
    next(error)
  }
})

app.get("/api/orders", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const orders = await getAllOrders(db, {
      search: req.query.search || "",
      status: req.query.status || "",
    })
    res.json({ ok: true, data: orders })
  } catch (error) {
    next(error)
  }
})

app.get("/api/users", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const users = await db.query(
      `SELECT id, email, is_admin, role, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 500`
    )
    res.json({ ok: true, data: users.rows })
  } catch (error) {
    next(error)
  }
})

app.get("/api/dashboard/analytics", ensureAuthenticated, ensureAdmin, async (req, res, next) => {
  try {
    const analytics = await getDashboardAnalytics()
    res.json({ ok: true, data: analytics })
  } catch (error) {
    next(error)
  }
})

app.get("/wishlist", ensureAuthenticated, async (req, res, next) => {
  try {
    const saved = await getWishlist(db, req.user.id)
    const wishlist = saved.map((item) => {
      const product = findProduct(item.product_id)
      return {
        product_id: item.product_id,
        product_name: product?.name || "Unknown product",
        color: item.color,
        colors: product?.colors?.map((variant) => variant.name) || [],
        price: product?.price || 0,
        image: product?.colors?.find((variant) => variant.name === item.color)?.images?.[0] || product?.colors?.[0]?.images?.[0] || "",
      }
    })
    res.render("wishlist", { wishlist })
  } catch (error) {
    next(error)
  }
})

app.post(
  "/wishlist/add",
  ensureAuthenticated,
  body("productId").isInt({ min: 1 }),
  body("color").trim().notEmpty(),
  async (req, res, next) => {
    try {
      const wantsJson = req.xhr || req.get("x-requested-with") === "XMLHttpRequest" || req.accepts(["json", "html"]) === "json"
      await addWishlistItem(db, req.user.id, Number(req.body.productId), req.body.color)
      req.session.messages = [{ type: "success", text: "Added to wishlist." }]
      if (wantsJson) {
        return res.json({ ok: true, message: "Added to wishlist." })
      }
      res.redirect(`/product/${req.body.productId}`)
    } catch (error) {
      next(error)
    }
  }
)

app.post(
  "/wishlist/remove",
  ensureAuthenticated,
  body("productId").isInt({ min: 1 }),
  body("color").trim().notEmpty(),
  async (req, res, next) => {
    try {
      const wantsJson = req.xhr || req.get("x-requested-with") === "XMLHttpRequest" || req.accepts(["json", "html"]) === "json"
      await removeWishlistItem(db, req.user.id, Number(req.body.productId), req.body.color)
      req.session.messages = [{ type: "success", text: "Removed from wishlist." }]
      if (wantsJson) {
        return res.json({ ok: true, message: "Removed from wishlist." })
      }
      res.redirect("/wishlist")
    } catch (error) {
      next(error)
    }
  }
)

app.post(
  "/wishlist/toggle",
  ensureAuthenticated,
  body("productId").isInt({ min: 1 }),
  body("color").trim().notEmpty(),
  async (req, res, next) => {
    try {
      const productId = Number(req.body.productId)
      const color = req.body.color
      const alreadyWishlisted = await isWishlisted(db, req.user.id, productId, color)

      if (alreadyWishlisted) {
        await removeWishlistItem(db, req.user.id, productId, color)
      } else {
        await addWishlistItem(db, req.user.id, productId, color)
      }

      const message = alreadyWishlisted ? "Removed from wishlist." : "Added to wishlist."
      req.session.messages = [{ type: "success", text: message }]

      if (req.xhr || req.get("x-requested-with") === "XMLHttpRequest" || req.accepts(["json", "html"]) === "json") {
        return res.json({ ok: true, wishlisted: !alreadyWishlisted, message })
      }

      res.redirect(req.get("Referrer") || "/products")
    } catch (error) {
      next(error)
    }
  }
)

app.post(
  "/wishlist/move-to-cart",
  ensureAuthenticated,
  body("productId").isInt({ min: 1 }),
  body("color").trim().notEmpty(),
  async (req, res, next) => {
    try {
      const productId = Number(req.body.productId)
      const color = req.body.color
      const product = findProduct(productId)
      if (!product) {
        req.session.messages = [{ type: "error", text: "Product not found." }]
        return res.redirect("/wishlist")
      }
      const variant = findColorVariant(product, color)
      if (!variant) {
        req.session.messages = [{ type: "error", text: "Selected color is unavailable." }]
        return res.redirect("/wishlist")
      }

      await upsertCartItem(db, {
        userId: req.user.id,
        guestToken: null,
        productId,
        productName: product.name,
        color,
        unitPrice: product.price,
        quantity: 1,
      })
      await removeWishlistItem(db, req.user.id, productId, color)

      req.session.messages = [{ type: "success", text: "Moved item to cart." }]
      res.redirect("/wishlist")
    } catch (error) {
      next(error)
    }
  }
)

app.get("/login", (req, res) => {
  res.render("login")
})

app.post("/login", authLimiter, (req, res, next) => {
  passport.authenticate("local", async (err, user) => {
    if (err) return next(err)
    if (!user) {
      req.session.messages = [{ type: "error", text: "Invalid email or password." }]
      return res.redirect("/login")
    }
    req.login(user, async (error) => {
      if (error) return next(error)
      await mergeGuestCart(req)
      req.session.messages = [{ type: "success", text: "Logged in successfully." }]
      return res.redirect("/")
    })
  })(req, res, next)
})

app.get("/register", (req, res) => {
  res.render("register")
})

// Debug endpoint to inspect parsed POST body
// debug endpoint removed

app.post(
  "/register",
  authLimiter,
  body("email").isEmail().withMessage("A valid email is required."),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      const formData = { email: req.body.email }
      if (!errors.isEmpty()) {
        const messages = errors.array().map((error) => ({ type: "error", text: error.msg }))
        res.locals.flashMessages = messages
        return res.status(400).render("register", { formData, flashMessages: messages })
      }
      const confirmPassword = req.body['confirm-password'] || req.body.confirmPassword || req.body['confirmPassword']
      if (confirmPassword && confirmPassword !== req.body.password) {
        const messages = [{ type: "error", text: "Passwords do not match." }]
        res.locals.flashMessages = messages
        return res.status(400).render("register", { formData, flashMessages: messages })
      }
      const { email, password } = req.body
      const existingUser = await getUserByEmail(email)
      if (existingUser) {
        const messages = [{ type: "error", text: "Email already registered." }]
        res.locals.flashMessages = messages
        return res.status(409).render("register", { formData, flashMessages: messages })
      }
      const hashedPassword = await bcrypt.hash(password, saltRounds)
      const newUser = await createUser(email, hashedPassword)
      req.login(newUser, async (error) => {
        if (error) return next(error)
        await mergeGuestCart(req)
        req.session.messages = [{ type: "success", text: "Account created successfully." }]
        res.redirect("/")
      })
    } catch (error) {
      next(error)
    }
  }
)

app.post(
  "/subscribe",
  body("email").isEmail().withMessage("Please enter a valid email address."),
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        req.session.messages = errors.array().map((error) => ({ type: "error", text: error.msg }))
        return res.redirect(req.get("Referrer") || "/")
      }
      req.session.messages = [{ type: "success", text: "Thanks for subscribing!" }]
      res.redirect(req.get("Referrer") || "/")
    } catch (error) {
      next(error)
    }
  }
)

app.get("/about", (req, res) => {
  res.render("about")
})

app.get("/quality", (req, res) => {
  res.render("quality")
})

app.get("/reviews", (req, res) => {
  res.render("reviews")
})

app.post("/reviews", ensureAuthenticated, body("reviewer_name").trim().notEmpty().escape(), body("rating").isInt({ min: 1, max: 5 }), body("review_text").trim().notEmpty().isLength({ max: 1000 }).escape(), async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      req.flash("error", "Please fill in all fields correctly.")
      return res.redirect("back")
    }
    const { reviewer_name, rating, review_text, order_id } = req.body
    await db.query(
      `INSERT INTO customer_reviews (user_id, order_id, reviewer_name, rating, review_text)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, order_id ? Number(order_id) : null, reviewer_name, Number(rating), review_text]
    )
    req.flash("success", "Thank you for your review!")
    const redirectTo = order_id ? `/thank-you/${order_id}` : "/"
    res.redirect(redirectTo)
  } catch (error) {
    next(error)
  }
})

app.get("/help", (req, res) => {
  res.render("help")
})

app.get("/logout", (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error)
    res.redirect("/")
  })
})

if (googleEnabled) {
  app.get("/auth/google", (req, res, next) => {
    if (req.query.code) {
      passport.authenticate("google", async (err, user) => {
        if (err) return next(err)
        if (!user) return res.redirect("/login")
        req.login(user, async (error) => {
          if (error) return next(error)
          await mergeGuestCart(req)
          req.session.messages = [{ type: "success", text: "Logged in with Google." }]
          res.redirect("/")
        })
      })(req, res, next)
    } else {
      passport.authenticate("google", {
        scope: ["profile", "email"],
      })(req, res, next)
    }
  })
}

app.use(notFoundHandler)
app.use(appErrorHandler)

export default app
