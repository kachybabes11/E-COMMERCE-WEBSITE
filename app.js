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
import { createHmac, randomUUID, timingSafeEqual } from "crypto"
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
  findLatestPendingReservationCodeByUser,
  getReservationByCode,
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
  getOrderByPaystackReference,
  getOrderByReservationCode,
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
const birthdayRecipientEmail = "imaginationstyle77@gmail.com"
const birthdayMessageStartAtMs = new Date("2026-06-29T00:00:00+01:00").getTime()
const birthdayMessageDurationMs = 72 * 60 * 60 * 1000
const birthdayMessageText = `Happy Birthday, Mommy. ❤️


I just want to remind you not only today but forever how incredible you are. You have spent so much of your life pouring into everyone around you that I hope, just for today, you remember to pour into yourself just as much. You are kind, strong, selfless, intelligent, beautiful, resilient, and full of so much love. You make sacrifices without asking for recognition, you carry burdens without complaining, and you love with a heart so pure that it's impossible to measure.

Thank you for being the safe place I could always run to, the voice that encouraged me when I doubted myself, and the woman who taught me what unconditional love truly looks like. So much of who I am today is because of you. Your strength has carried this family through moments no one else even saw, and your love has shaped our lives in ways words could never fully capture.

Life hasn't been remotely easy. You've faced storms that would have broken so many people, yet somehow you always found the strength to stand back up. Time after time, you rebuilt your life from scratch, carrying burdens no one should have to carry, and still kept moving forward. Every hardship, every disappointment, every sacrifice has shaped you into the extraordinary woman you are today.

One thing that has always amazed me is the way you love. Even after everything life has thrown at you, your heart has never hardened. You love your children with a depth that reminds me of how Christ loves the church. Sometimes I genuinely wonder how someone who has been through so much can still have so much love to give. I pray that the beautiful heart of yours never changes, because it is one of the purest hearts I have ever known.

You are my greatest inspiration. I don't say it often enough, but every single day I wake up with one goal in mind; to make you proud. Watching you fight through life's challenges with dignity, wisdom, and unwavering determination has taught me more than words ever could. You never stopped learning, never stopped growing, and never stopped giving everything you had to ensure your children would have a better life. Everything I hope to become is, in one way or another, inspired by you.

Watching you return to buying and selling after all these years has reminded me that life has a funny way of bringing us back to where we are meant to be. Some people may see it as going back to the beginning, but I see it differently. I believe every year in between was preparing you for this moment. Every lesson, every setback, every victory, every disappointment, every closed door, and every new beginning was God shaping your character, sharpening your wisdom, and equipping you with the experience you now carry. You are not starting over, you are starting again with everything life has taught you.

I truly believe your greatest achievements are still ahead of you. This business is not just another venture; I believe it is the beginning of a season where all your years of hard work, patience, and perseverance begin to speak for you. I pray that God blesses the work of your hands beyond your imagination. May every investment multiply, every good opportunity locate you, every customer become a blessing, and every door that has remained shut be opened by His favor. May He surround you with the right people, protect you from every form of loss, and crown your efforts with uncommon success.

I pray that this season is different from every other one before it. May you no longer labor without seeing the rewards. May you never again know seasons where your hard work goes unnoticed or unrewarded. Instead, may you experience overflow, ease, and divine acceleration. May your name be associated with excellence, and may your business become a source of blessing not only to our family but to everyone connected to you.

I hope that one day we'll sit together and laugh about these humble beginnings because they became the foundation of something far greater than we could have imagined. I pray that God exceeds every expectation you've secretly carried in your heart. May He surprise you with miracles you didn't even know to ask for, restore everything life has taken from you, and reward your faithfulness with a harvest so abundant that you'll have no choice but to say, "Only God could have done this."

Mummy, your story is far from over. This is not the chapter where you struggle forever, this is the chapter where everything begins to change. I believe with all my heart that heaven is writing a beautiful ending to every difficult page you've lived through. Your latter days will truly be greater than your former days, and the tears you've cried in private will be replaced with testimonies you'll share with joy. This new beginning will not end in disappointment. It will end in fulfillment, abundance, peace, and a life that reflects the goodness and faithfulness of God. The best is not behind you, it is still on its way, and I cannot wait to watch you walk into everything God has prepared for you. ❤️

As you turn 50, I see it as the beginning of the most beautiful chapter yet. Fifty is not an ending; it is a new dawn. You finally experience the peace, comfort, and happiness you've spent so many years helping others find.You deserve every beautiful thing this world has to offer. You deserve to rest without worry, to smile without pretending, and to enjoy the fruits of everything you've worked so hard for. More than anything, I pray that this next chapter is filled with answered prayers, fulfilled dreams, divine favor, and a joy so overwhelming that it makes every painful chapter worth surviving. If anyone deserves a beautiful life, it's you.

I love you more than words will ever be able to express. Thank you for being my mother, my biggest blessing, and one of the greatest gifts God has ever given me. I pray you are my mother in every lifetime. Happy Birthday once again. Never forget who you are and the best is yet to come. ❤️`

const paystackSupportedChannels = ["card", "bank", "ussd", "bank_transfer", "qr", "mobile_money", "eft"]
const paystackDefaultChannels = [...paystackSupportedChannels]
const paystackPendingStatuses = new Set(["pending", "ongoing", "queued", "processing"])
const paystackFailureStatuses = new Set(["failed", "abandoned", "reversed", "cancelled"])
const lagosDeliveryAreas = [
  { value: "ogudu", label: "Ogudu | Ojota", fee: 1500 },
  { value: "alapere", label: "Alapere | Ketu | Kosofe", fee: 2500 },
  { value: "ikeja", label: "Ikeja | Alausa", fee: 4000 },
  { value: "gbagada", label: "Gbagada", fee: 4000 },
  { value: "magodophasetwo", label: "Magodo Phase 2", fee: 4000 },
  { value: "anthony", label: "Anthony | Town Planning | Maryland", fee: 4000 },
  { value: "obanikoro", label: "Obanikoro | Palmgroove | Onipanu | Pedro | Shomolu", fee: 4500 },
  { value: "omole", label: "Omole | Magodo Phase 1 ", fee: 4500 },
  { value: "ikorodu", label: "Mile 12 | Ikorodu", fee: 4500 },
  { value: "yaba", label: "Yaba | Surulere | Ojuelegba ", fee: 5000 },
  { value: "oshodi", label: "Oshodi | Ajao Estate | Airport Road | Mafoluku ", fee: 5000 },
  { value: "fagba", label: "Ifako-Ijaiye | Abule-Egba | Iyana-Ipaja | Fagba | Iju-Ishaga", fee: 5000 },
  { value: "egbeda", label: "Egbeda | Ikotun | Idimu", fee: 6000 },
  { value: "berger", label: "Berger | Tollgate ", fee: 6000 },
  { value: "lekki", label: "Marina | V.I | Lekki", fee: 7500 },
  { value: "ajah", label: "Ajah", fee: 8500 },
]
const lagosShippingFees = Object.fromEntries(lagosDeliveryAreas.map((area) => [area.value, area.fee]))

function getPaystackChannels() {
  const configured = String(process.env.PAYSTACK_CHANNELS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  if (configured.includes("all")) {
    return paystackSupportedChannels
  }

  const selected = (configured.length ? configured : paystackDefaultChannels).filter((channel) =>
    paystackSupportedChannels.includes(channel)
  )

  return selected.length ? [...new Set(selected)] : paystackDefaultChannels
}

function isValidPaystackSignature(req) {
  const signatureHeader = req.headers["x-paystack-signature"]
  if (!signatureHeader || !process.env.PAYSTACK_SECRET_KEY || !req.rawBody) {
    return false
  }

  const expectedSignature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(req.rawBody)
    .digest("hex")

  const incoming = Buffer.from(String(signatureHeader), "hex")
  const expected = Buffer.from(expectedSignature, "hex")

  if (incoming.length !== expected.length) {
    return false
  }

  return timingSafeEqual(incoming, expected)
}

function normalizePaystackStatus(status) {
  return String(status || "").trim().toLowerCase()
}

function logPaystackFlow(stage, details = {}) {
  console.log(
    "[paystack-flow]",
    JSON.stringify({
      stage,
      at: new Date().toISOString(),
      ...details,
    })
  )
}

async function finalizeSuccessfulPaystackPayment({
  reference,
  reservationCode,
  ownerUser,
  context,
}) {
  let order

  try {
    logPaystackFlow("finalize.commit_attempt", {
      reference,
      reservationCode,
      ownerUserId: ownerUser.id,
      totalAmount: context.totalAmount,
    })

    order = await commitReservation(db, {
      reservationCode,
      paystackReference: reference,
      createOrderFn: async (client, payload) =>
        createOrder(client, {
          userId: ownerUser.id,
          customerName: context.customerName,
          email: context.email,
          phone: context.phone,
          shippingAddress: {
            street: context.street,
            city: context.city,
            state: context.state,
            postalCode: context.postalCode,
            country: context.country,
          },
          shippingMethod: context.shippingMethod,
          shippingFee: context.shippingFee,
          items: payload.orderItems,
          paymentStatus: "Paid",
          orderStatus: "Processing",
          totalAmount: context.totalAmount,
          paystackReference: reference,
          reservationCode: payload.reservationCode,
        }),
    })

    logPaystackFlow("finalize.commit_success", {
      reference,
      reservationCode,
      orderId: order.id,
      ownerUserId: ownerUser.id,
    })
  } catch (commitError) {
    logPaystackFlow("finalize.commit_error", {
      reference,
      reservationCode,
      ownerUserId: ownerUser?.id || null,
      message: commitError?.message,
    })

    const existingAfterCommit =
      (await getOrderByPaystackReference(db, reference)) ||
      (await getOrderByReservationCode(db, reservationCode))

    if (existingAfterCommit) {
      logPaystackFlow("finalize.commit_error.recovered_existing", {
        reference,
        reservationCode,
        orderId: existingAfterCommit.id,
      })
      return existingAfterCommit
    }

    throw commitError
  }

  if (dbEnabled) {
    await clearCart(db, { userId: ownerUser.id })
  }

  const orderDetail = await getOrderDetails(db, order.id)
  await sendOrderConfirmationEmail(order, orderDetail.items)
  await sendNewOrderNotificationEmail(order, orderDetail.items)

  logPaystackFlow("finalize.notifications_sent", {
    reference,
    reservationCode,
    orderId: order.id,
    ownerUserId: ownerUser.id,
  })

  return order
}

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
app.use(
  express.json({
    verify: (req, res, buffer) => {
      if (buffer?.length) {
        req.rawBody = buffer.toString("utf8")
      }
    },
  })
)
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
  if (req.method === "POST" && req.path === "/paystack/webhook") {
    return next()
  }
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

function getCartSubtotal(cart) {
  return cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
}

function renderCheckoutPage(res, { cart, formData = {}, errors = [] }) {
  return res.render("checkout", {
    cart,
    subtotal: getCartSubtotal(cart),
    errors,
    formData,
    lagosDeliveryAreas,
  })
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
      `SELECT
        COALESCE((
          SELECT SUM(oi.total_price)
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.payment_status = 'Paid'
        ), 0) AS total_sales,
        COALESCE((
          SELECT SUM(total_amount)
          FROM orders
          WHERE payment_status = 'Paid'
        ), 0) AS revenue`
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
      `SELECT TO_CHAR(DATE_TRUNC('month', o.created_at), 'YYYY-MM') AS month, COALESCE(SUM(oi.total_price), 0) AS amount
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.payment_status = 'Paid'
       GROUP BY DATE_TRUNC('month', o.created_at)
       ORDER BY DATE_TRUNC('month', o.created_at) ASC`
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

function appendBirthdayMessageForUser(req, user) {
  const email = String(user?.email || "").trim().toLowerCase()
  if (email !== birthdayRecipientEmail) {
    return
  }
  const nowMs = Date.now()
  if (nowMs < birthdayMessageStartAtMs || nowMs >= birthdayMessageStartAtMs + birthdayMessageDurationMs) {
    return
  }

  const existingMessages = Array.isArray(req.session.messages) ? req.session.messages : []
  existingMessages.push({
    type: "birthday",
    title: "Happy Birthday, Mommy. ❤️",
    text: birthdayMessageText,
  })
  req.session.messages = existingMessages
}

app.get("/", async (req, res, next) => {
  try {
    const featured = getCatalog().slice(0, 4)
    let testimonial = null

    if (dbEnabled) {
      try {
        const result = await db.query(
          `SELECT reviewer_name, rating, review_text
           FROM customer_reviews
           WHERE review_text IS NOT NULL AND TRIM(review_text) <> ''
           ORDER BY created_at DESC, id DESC
           LIMIT 1`
        )

        const review = result.rows[0]
        if (review) {
          testimonial = {
            name: review.reviewer_name || "Verified Customer",
            rating: Number(review.rating) || 5,
            quote: review.review_text,
            role: "Verified Customer",
          }
        }
      } catch (error) {
        console.warn("Failed to load homepage customer reviews:", error.message)
      }
    }

    if (!testimonial) {
      testimonial = {
        name: "Chicnstraps Customer",
        rating: 5,
        quote: "Be the first to share your experience with us.",
        role: "Verified Customer",
      }
    }

    res.render("home", { featured, testimonial })
  } catch (error) {
    next(error)
  }
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
    return renderCheckoutPage(res, { cart })
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
  body("shippingMethod").trim().isIn(["pickup", "lagos", "outside"]).withMessage("Select a shipping option."),
  async (req, res, next) => {
    let reservationCodeToRelease = null
    try {
      const cart = await getCurrentCartItems(req)
      const errors = validationResult(req)
      const shippingMethod = String(req.body.shippingMethod || "").trim().toLowerCase()
      const lagosArea = String(req.body.lagosArea || "").trim().toLowerCase()
      const formData = {
        ...req.body,
        shippingMethod,
        lagosArea,
      }
      if (!cart.length) {
        req.session.messages = [{ type: "error", text: "Your cart is empty." }]
        return res.redirect("/cart")
      }
      if (!errors.isEmpty()) {
        return renderCheckoutPage(res, { cart, errors: errors.array(), formData })
      }
      let shippingFee = 0
      let checkoutLagosArea = ""

      if (shippingMethod === "lagos") {
        const isKnownLagosArea = Object.hasOwn(lagosShippingFees, lagosArea)
        const isNotListedOption = lagosArea === "not_listed"

        if (lagosArea && !isKnownLagosArea && !isNotListedOption) {
          return renderCheckoutPage(res, {
            cart,
            errors: [{ msg: "Please select a valid Lagos delivery area." }],
            formData,
          })
        }

        if (isKnownLagosArea) {
          shippingFee = lagosShippingFees[lagosArea]
          checkoutLagosArea = lagosArea
        } else if (isNotListedOption) {
          shippingFee = 0
          checkoutLagosArea = "not_listed"
        }
      }

      const subtotal = getCartSubtotal(cart)
      const totalAmount = subtotal + shippingFee
      const checkoutContext = {
        customerName: req.body.customerName,
        email: req.user.email,
        phone: req.body.phone,
        street: req.body.street,
        city: "",
        state: "",
        postalCode: "",
        country: "",
        shippingMethod,
        lagosArea: checkoutLagosArea,
        shippingFee,
        totalAmount,
      }

      const reservation = await reserveInventoryForCheckout(db, {
        userId: req.user.id,
        cartItems: cart,
        checkoutContext,
      })
      reservationCodeToRelease = reservation.reservation_code

      req.session.checkout = {
        userId: req.user.id,
        email: req.user.email,
        ...checkoutContext,
        reservationCode: reservation.reservation_code,
        reservationExpiresAt: reservation.expires_at,
      }
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: req.user.email,
          amount: Math.round(totalAmount * 100),
          callback_url: `${process.env.BASE_URL || "http://localhost:3000"}/paystack/callback`,
          channels: getPaystackChannels(),
          metadata: {
            reservation_code: reservation.reservation_code,
            user_id: req.user.id,
            total_amount_kobo: Math.round(totalAmount * 100),
            shipping_method: shippingMethod,
            shipping_fee: shippingFee,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      )
      logPaystackFlow("checkout.initialize.success", {
        userId: req.user.id,
        email: req.user.email,
        reservationCode: reservation.reservation_code,
        shippingMethod,
        shippingFee,
        totalAmount,
        paystackChannels: getPaystackChannels(),
        authorizationUrlPresent: Boolean(response?.data?.data?.authorization_url),
      })
      res.redirect(response.data.data.authorization_url)
    } catch (error) {
      logPaystackFlow("checkout.initialize.error", {
        userId: req.user?.id || null,
        reservationCode: reservationCodeToRelease,
        message: error?.message,
        responseStatus: error?.response?.status || null,
        responseBody: error?.response?.data || null,
      })
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

app.get("/paystack/callback", async (req, res, next) => {
  let reservationCodeForRecovery = null
  try {
    const reference = String(req.query.reference || "").trim()
    logPaystackFlow("callback.enter", {
      reference,
      sessionCheckoutPresent: Boolean(req.session.checkout),
      sessionUserId: req.user?.id || null,
    })
    if (!reference) {
      logPaystackFlow("callback.missing_reference", {
        sessionUserId: req.user?.id || null,
      })
      req.session.messages = [{ type: "error", text: "Unable to complete payment. Missing payment reference." }]
      return res.redirect("/checkout")
    }

    const existingOrder = await getOrderByPaystackReference(db, reference)
    if (existingOrder && req.user && (existingOrder.user_id === req.user.id || req.user.is_admin)) {
      logPaystackFlow("callback.existing_order.authenticated", {
        reference,
        orderId: existingOrder.id,
        sessionUserId: req.user.id,
      })
      req.session.checkout = null
      req.session.messages = [{ type: "success", text: "Payment already confirmed for this order." }]
      return res.redirect(`/orders/${existingOrder.id}`)
    }
    if (existingOrder && !req.user) {
      logPaystackFlow("callback.existing_order.unauthenticated", {
        reference,
        orderId: existingOrder.id,
      })
      req.session.messages = [{ type: "success", text: "Payment confirmed. Please sign in to view your order." }]
      return res.redirect("/login")
    }

    const checkout = req.session.checkout
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const data = response.data.data
    const paymentStatus = normalizePaystackStatus(data.status)
    const metadata = data?.metadata || {}
    logPaystackFlow("callback.verify_response", {
      reference,
      paystackStatus: paymentStatus,
      amountKobo: Number(data.amount || 0),
      metadataReservationCode: metadata?.reservation_code || null,
      metadataUserId: metadata?.user_id || null,
      metadataShippingMethod: metadata?.shipping_method || null,
      metadataShippingFee: metadata?.shipping_fee ?? null,
      gatewayResponse: data?.gateway_response || null,
      paidAt: data?.paid_at || null,
      channel: data?.channel || null,
    })

    const ownerUserId = Number(
      checkout?.userId || metadata?.user_id || req.user?.id || 0
    )
    const ownerUser = req.user || (ownerUserId ? await getUserById(ownerUserId) : null)

    let reservationCode =
      String(checkout?.reservationCode || metadata?.reservation_code || "").trim() || null

    if (!reservationCode && ownerUser?.id) {
      reservationCode = await findLatestPendingReservationCodeByUser(db, ownerUser.id)
    }

    reservationCodeForRecovery = reservationCode
    const reservationRecord = reservationCode ? await getReservationByCode(db, reservationCode) : null
    const reservationCheckoutContext = reservationRecord?.checkout_context || null

    const context = {
      customerName: checkout?.customerName || reservationCheckoutContext?.customerName || ownerUser?.email || "Customer",
      email: checkout?.email || reservationCheckoutContext?.email || ownerUser?.email || "",
      phone: checkout?.phone || reservationCheckoutContext?.phone || "",
      street: checkout?.street || reservationCheckoutContext?.street || "Address pending confirmation",
      city: checkout?.city || reservationCheckoutContext?.city || "",
      state: checkout?.state || reservationCheckoutContext?.state || "",
      postalCode: checkout?.postalCode || reservationCheckoutContext?.postalCode || "",
      country: checkout?.country || reservationCheckoutContext?.country || "Nigeria",
      shippingMethod: checkout?.shippingMethod || reservationCheckoutContext?.shippingMethod || String(metadata?.shipping_method || "pickup"),
      shippingFee: Number(checkout?.shippingFee ?? reservationCheckoutContext?.shippingFee ?? metadata?.shipping_fee ?? 0),
      totalAmount: Number(checkout?.totalAmount ?? reservationCheckoutContext?.totalAmount ?? Number(data.amount || 0) / 100),
    }

    logPaystackFlow("callback.context_resolved", {
      reference,
      reservationCode,
      ownerUserId: ownerUser?.id || null,
      sessionCheckoutPresent: Boolean(checkout),
      contextShippingMethod: context.shippingMethod,
      contextShippingFee: context.shippingFee,
      contextTotalAmount: context.totalAmount,
    })

    const expectedAmountKobo = Number(metadata?.total_amount_kobo || Math.round(context.totalAmount * 100))
    const actualAmountKobo = Number(data.amount || 0)

    if (paystackPendingStatuses.has(paymentStatus)) {
      logPaystackFlow("callback.pending_status", {
        reference,
        reservationCode,
        paystackStatus: paymentStatus,
      })
      return res.redirect(`/paystack/pending?reference=${encodeURIComponent(reference)}`)
    }

    if (paymentStatus !== "success") {
      if (paystackFailureStatuses.has(paymentStatus)) {
        logPaystackFlow("callback.failure_status", {
          reference,
          reservationCode,
          paystackStatus: paymentStatus,
        })
        if (reservationCode) {
          await releaseReservationByCode(db, reservationCode, { note: `Payment verification failed (${paymentStatus})` })
        }
        req.session.messages = [{ type: "error", text: "Payment was not successful." }]
        return res.redirect("/checkout")
      }

      logPaystackFlow("callback.unknown_non_success_status", {
        reference,
        reservationCode,
        paystackStatus: paymentStatus,
      })
      return res.redirect(`/paystack/pending?reference=${encodeURIComponent(reference)}`)
    }

    if (!reservationCode) {
      logPaystackFlow("callback.missing_reservation", {
        reference,
        ownerUserId: ownerUser?.id || null,
      })
      req.session.messages = [{ type: "error", text: "Payment was received, but order confirmation is delayed. Please check your orders shortly." }]
      return res.redirect(req.user ? "/orders" : "/login")
    }

    if (expectedAmountKobo && actualAmountKobo < expectedAmountKobo) {
      logPaystackFlow("callback.amount_mismatch", {
        reference,
        reservationCode,
        expectedAmountKobo,
        actualAmountKobo,
        checkType: "underpayment",
      })
      req.session.messages = [{ type: "error", text: "Payment was received but amount verification is pending. Please contact support with your payment reference." }]
      return res.redirect(req.user ? "/orders" : "/login")
    }

    if (expectedAmountKobo && actualAmountKobo > expectedAmountKobo) {
      logPaystackFlow("callback.amount_overage_accepted", {
        reference,
        reservationCode,
        expectedAmountKobo,
        actualAmountKobo,
      })
    }

    if (!ownerUser?.id) {
      logPaystackFlow("callback.missing_owner", {
        reference,
        reservationCode,
        metadataUserId: metadata?.user_id || null,
      })
      req.session.messages = [{ type: "error", text: "Payment confirmed, but account could not be resolved. Contact support." }]
      return res.redirect("/login")
    }

    const order = await finalizeSuccessfulPaystackPayment({
      reference: data.reference,
      reservationCode,
      ownerUser,
      context,
    })

    req.session.checkout = null
    req.session.messages = [{ type: "success", text: "Order completed successfully." }]
    if (!req.user) {
      logPaystackFlow("callback.redirect_login_after_success", {
        reference,
        reservationCode,
        orderId: order.id,
      })
      req.session.messages = [{ type: "success", text: "Payment confirmed. Please sign in to view your order." }]
      return res.redirect("/login")
    }
    logPaystackFlow("callback.redirect_order_success", {
      reference,
      reservationCode,
      orderId: order.id,
      ownerUserId: ownerUser.id,
    })
    res.redirect(`/thank-you/${order.id}`)
  } catch (error) {
    logPaystackFlow("callback.unhandled_error", {
      message: error?.message,
      reservationCode: reservationCodeForRecovery,
      stack: error?.stack || null,
    })
    next(error)
  }
})

app.get("/paystack/pending", async (req, res, next) => {
  try {
    const reference = String(req.query.reference || "").trim()
    logPaystackFlow("pending.enter", {
      reference,
      sessionUserId: req.user?.id || null,
    })
    if (!reference) {
      logPaystackFlow("pending.missing_reference", {
        sessionUserId: req.user?.id || null,
      })
      req.session.messages = [{ type: "error", text: "Missing payment reference." }]
      return res.redirect("/checkout")
    }

    const existingOrder = await getOrderByPaystackReference(db, reference)
    if (existingOrder && req.user && (existingOrder.user_id === req.user.id || req.user.is_admin)) {
      logPaystackFlow("pending.existing_order.authenticated", {
        reference,
        orderId: existingOrder.id,
        sessionUserId: req.user.id,
      })
      req.session.checkout = null
      req.session.messages = [{ type: "success", text: "Payment confirmed for your order." }]
      return res.redirect(`/thank-you/${existingOrder.id}`)
    }
    if (existingOrder && !req.user) {
      logPaystackFlow("pending.existing_order.unauthenticated", {
        reference,
        orderId: existingOrder.id,
      })
      req.session.messages = [{ type: "success", text: "Payment confirmed. Please sign in to view your order." }]
      return res.redirect("/login")
    }

    logPaystackFlow("pending.render", {
      reference,
      sessionUserId: req.user?.id || null,
    })
    return res.render("paystack-pending", { reference })
  } catch (error) {
    logPaystackFlow("pending.error", {
      message: error?.message,
      stack: error?.stack || null,
    })
    next(error)
  }
})

app.get("/paystack/payment-status", async (req, res) => {
  try {
    const reference = String(req.query.reference || "").trim()
    logPaystackFlow("status.enter", {
      reference,
      sessionUserId: req.user?.id || null,
    })
    if (!reference) {
      logPaystackFlow("status.missing_reference", {
        sessionUserId: req.user?.id || null,
      })
      return res.status(400).json({ ok: false, message: "Missing payment reference." })
    }

    const existingOrder = await getOrderByPaystackReference(db, reference)
    if (existingOrder) {
      logPaystackFlow("status.existing_order", {
        reference,
        orderId: existingOrder.id,
        sessionUserId: req.user?.id || null,
      })
      return res.json({
        ok: true,
        status: "success",
        redirectTo: req.user ? `/orders/${existingOrder.id}` : "/login",
      })
    }

    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const paymentStatus = normalizePaystackStatus(response.data?.data?.status)
    logPaystackFlow("status.verify_response", {
      reference,
      paystackStatus: paymentStatus,
      amountKobo: Number(response.data?.data?.amount || 0),
      channel: response.data?.data?.channel || null,
      gatewayResponse: response.data?.data?.gateway_response || null,
    })

    if (paymentStatus === "success") {
      logPaystackFlow("status.redirect_callback_success", {
        reference,
      })
      return res.json({
        ok: true,
        status: paymentStatus,
        redirectTo: `/paystack/callback?reference=${encodeURIComponent(reference)}`,
      })
    }

    if (paystackFailureStatuses.has(paymentStatus)) {
      logPaystackFlow("status.redirect_callback_failure", {
        reference,
        paystackStatus: paymentStatus,
      })
      return res.json({
        ok: true,
        status: paymentStatus,
        redirectTo: `/paystack/callback?reference=${encodeURIComponent(reference)}`,
      })
    }

    logPaystackFlow("status.pending_response", {
      reference,
      paystackStatus: paystackPendingStatuses.has(paymentStatus) ? paymentStatus : "pending",
    })
    return res.json({
      ok: true,
      status: paystackPendingStatuses.has(paymentStatus) ? paymentStatus : "pending",
      redirectTo: null,
    })
  } catch (error) {
    logPaystackFlow("status.error", {
      message: error?.message,
      stack: error?.stack || null,
    })
    return res.status(500).json({ ok: false, message: "Unable to check payment status right now." })
  }
})

app.post("/paystack/webhook", async (req, res) => {
  try {
    if (!isValidPaystackSignature(req)) {
      return res.status(401).json({ status: false, message: "Invalid signature" })
    }

    const event = req.body?.event
    const payload = req.body?.data || {}
    const reference = payload?.reference
    logPaystackFlow("webhook.enter", {
      event,
      reference,
      status: payload?.status || null,
      channel: payload?.channel || null,
    })

    if (event === "charge.success" && reference) {
      const existingOrder = await getOrderByPaystackReference(db, reference)
      if (!existingOrder) {
        const reservationCode = String(payload?.metadata?.reservation_code || "").trim() || null
        const reservationRecord = reservationCode ? await getReservationByCode(db, reservationCode) : null
        const reservationCheckoutContext = reservationRecord?.checkout_context || null
        const ownerUserId = Number(payload?.metadata?.user_id || reservationRecord?.user_id || 0)
        const ownerUser = ownerUserId ? await getUserById(ownerUserId) : null

        if (reservationCode && ownerUser && reservationCheckoutContext) {
          await finalizeSuccessfulPaystackPayment({
            reference,
            reservationCode,
            ownerUser,
            context: {
              customerName: reservationCheckoutContext.customerName,
              email: reservationCheckoutContext.email || ownerUser.email,
              phone: reservationCheckoutContext.phone,
              street: reservationCheckoutContext.street,
              city: reservationCheckoutContext.city,
              state: reservationCheckoutContext.state,
              postalCode: reservationCheckoutContext.postalCode,
              country: reservationCheckoutContext.country,
              shippingMethod: reservationCheckoutContext.shippingMethod,
              shippingFee: Number(reservationCheckoutContext.shippingFee || 0),
              totalAmount: Number(reservationCheckoutContext.totalAmount || Number(payload?.amount || 0) / 100),
            },
          })
          logPaystackFlow("webhook.charge_success.finalized", {
            reference,
            reservationCode,
            ownerUserId,
          })
        } else {
          logPaystackFlow("webhook.charge_success.missing_finalization_context", {
            reference,
            reservationCode,
            ownerUserId,
            hasCheckoutContext: Boolean(reservationCheckoutContext),
          })
        }
      } else {
        await db.query(
          `UPDATE orders
           SET payment_status = 'Paid', updated_at = now()
           WHERE paystack_reference = $1`,
          [reference]
        )
        logPaystackFlow("webhook.charge_success.updated", {
          reference,
          orderId: existingOrder.id,
        })
      }
    }

    if ((event === "charge.failed" || event === "bank.transfer.rejected") && reference) {
      await db.query(
        `UPDATE orders
         SET payment_status = 'Failed', updated_at = now()
         WHERE paystack_reference = $1 AND payment_status <> 'Paid'`,
        [reference]
      )
      logPaystackFlow("webhook.charge_failed.updated", {
        reference,
        event,
      })
    }

    return res.status(200).json({ status: true })
  } catch (error) {
    logPaystackFlow("webhook.error", {
      message: error?.message,
      stack: error?.stack || null,
    })
    return res.status(200).json({ status: true })
  }
})

app.get("/thank-you/:id", ensureAuthenticated, async (req, res, next) => {
  try {
    const detail = await getOrderDetails(db, Number(req.params.id))
    if (!detail || (detail.order.user_id !== req.user.id && !req.user.is_admin)) {
      return res.status(404).render("404")
    }
    res.render("thank-you", { order: detail.order, items: detail.items, csrfToken: req.csrfToken() })
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
      appendBirthdayMessageForUser(req, user)
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

app.post("/reviews", ensureAuthenticated, async (req, res, next) => {
  try {
    const reviewerName = String(req.body.reviewer_name || "").trim()
    const rating = Number(req.body.rating)
    const reviewText = String(req.body.review_text || "").trim()
    const orderId = req.body.order_id ? Number(req.body.order_id) : null

    if (!reviewerName || !Number.isInteger(rating) || rating < 1 || rating > 5 || !reviewText) {
      req.session.messages = [{ type: "error", text: "Please fill in all fields correctly." }]
      return res.redirect("back")
    }

    await db.query(
      `INSERT INTO customer_reviews (user_id, order_id, reviewer_name, rating, review_text)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, orderId, reviewerName, rating, reviewText]
    )

    req.session.messages = [{ type: "success", text: "Thank you for your review!" }]
    const redirectTo = orderId ? `/thank-you/${orderId}` : "/"
    return res.redirect(redirectTo)
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
          appendBirthdayMessageForUser(req, user)
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
