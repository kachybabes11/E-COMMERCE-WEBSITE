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

import db from "./config/db.js"
import productCatalog from "./config/products.js"
import { ensureDatabase } from "./config/dbSetup.js"
import {
  findProduct,
  findColorVariant,
  getVariantStock,
  reduceVariantStock,
  formatCurrency,
} from "./services/productService.js"
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

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const saltRounds = 10
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
const dbEnabled = Boolean(process.env.DATABASE_URL || (process.env.PG_USER && process.env.PG_HOST && process.env.PG_DATABASE && process.env.PG_PASSWORD))

app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))
app.use(express.static(path.join(__dirname, "public")))
app.disable("x-powered-by")
app.use(cookieParser(process.env.COOKIE_SECRET || "bagcartelsecret"))
app.use(bodyParser.urlencoded({ extended: true }))
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
app.use(csurf({ cookie: true }))

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

app.use(async (req, res, next) => {
  try {
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
  const featured = productCatalog.slice(0, 4)
  res.render("home", { featured })
})

app.get("/products", (req, res) => {
  const selectedCategory = req.query.category
  const categories = [...new Set(productCatalog.map((product) => product.category))]
  const products = selectedCategory
    ? productCatalog.filter((product) => product.category === selectedCategory)
    : productCatalog
  res.render("products", { products, categories, selectedCategory })
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
    res.render("product", { product: displayProduct, wishlisted })
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
      const errors = validationResult(req)
      const productId = Number(req.body.productId)
      const color = req.body.color
      const quantity = Number(req.body.quantity)
      const product = findProduct(productId)
      if (!product || !errors.isEmpty()) {
        req.session.messages = [{ type: "error", text: "Unable to add this product to your cart." }]
        return res.redirect(`/product/${productId}`)
      }
      const variant = findColorVariant(product, color)
      if (!variant) {
        req.session.messages = [{ type: "error", text: "Please choose a valid color variant." }]
        return res.redirect(`/product/${productId}`)
      }
      const stock = await getVariantStock(db, productId, color)
      if (quantity > stock) {
        req.session.messages = [{ type: "error", text: `Only ${stock} item(s) available for ${color}.` }]
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
          existing.quantity += quantity
        } else {
          req.session.cart.push({ product, color, quantity })
        }
      }
      req.session.messages = [{ type: "success", text: "Product added to cart." }]
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
    try {
      const cart = await getCurrentCartItems(req)
      const errors = validationResult(req)
      const formData = req.body
      const shippingFees = { ikeja: 3000, lekki: 5000, yaba: 2500, ajah: 6000 }
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
      for (const item of cart) {
        const stock = await getVariantStock(db, item.product_id, item.color)
        if (item.quantity > stock) {
          req.session.messages = [{ type: "error", text: `The ${item.color} variant of ${item.product_name} only has ${stock} item(s) left.` }]
          return res.redirect("/cart")
        }
      }
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
      next(error)
    }
  }
)

app.get("/paystack/callback", ensureAuthenticated, async (req, res, next) => {
  try {
    const reference = req.query.reference
    const checkout = req.session.checkout
    if (!reference || !checkout) {
      req.session.messages = [{ type: "error", text: "Unable to complete payment. Please try again." }]
      return res.redirect("/checkout")
    }
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const data = response.data.data
    if (data.status !== "success") {
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
      req.session.messages = [{ type: "error", text: "Payment amount does not match order total." }]
      return res.redirect("/checkout")
    }
    for (const item of cart) {
      const stock = await getVariantStock(db, item.product_id, item.color)
      if (item.quantity > stock) {
        req.session.messages = [{ type: "error", text: `Sorry, ${item.product_name} (${item.color}) is no longer available in the requested quantity.` }]
        return res.redirect("/cart")
      }
    }
    const orderItems = cart.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      color: item.color,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
    }))
    const order = await createOrder(db, {
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
      items: orderItems,
      paymentStatus: "Paid",
      orderStatus: "Processing",
      totalAmount,
      paystackReference: data.reference,
    })
    for (const item of cart) {
      await reduceVariantStock(db, item.product_id, item.color, item.quantity)
    }
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

app.get("/wishlist", ensureAuthenticated, async (req, res, next) => {
  try {
    const saved = await getWishlist(db, req.user.id)
    const wishlist = saved.map((item) => {
      const product = findProduct(item.product_id)
      return {
        product_id: item.product_id,
        product_name: product?.name || "Unknown product",
        color: item.color,
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
      await addWishlistItem(db, req.user.id, Number(req.body.productId), req.body.color)
      req.session.messages = [{ type: "success", text: "Added to wishlist." }]
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
      await removeWishlistItem(db, req.user.id, Number(req.body.productId), req.body.color)
      req.session.messages = [{ type: "success", text: "Removed from wishlist." }]
      res.redirect("/wishlist")
    } catch (error) {
      next(error)
    }
  }
)

app.get("/login", (req, res) => {
  res.render("login")
})

app.post("/login", (req, res, next) => {
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

app.use((req, res) => {
  res.status(404).render("404")
})

app.use((err, req, res, next) => {
  console.error(err)
  if (err.code === "EBADCSRFTOKEN") {
    res.status(403).send("Session expired or form tampered with.")
  } else {
    res.status(500).send("Something went wrong.")
  }
})

export default app
