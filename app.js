import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import bodyParser from "body-parser"
import session from "express-session"
import passport from "passport"
import { Strategy as LocalStrategy } from "passport-local"
import GoogleStrategy from "passport-google-oauth2"
import bcrypt from "bcrypt"
import db from "./config/db.js"
import productCatalog from "./config/products.js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const saltRounds = 10
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
const dbEnabled = Boolean(process.env.PG_USER && process.env.PG_HOST && process.env.PG_DATABASE && process.env.PG_PASSWORD)


const users = []

async function getUserByEmail(email) {
  if (dbEnabled) {
    const result = await db.query("SELECT id, email, password FROM users WHERE email = $1", [email])
    return result.rows[0]
  }
  return users.find((user) => user.email === email)
}

async function getUserById(id) {
  if (dbEnabled) {
    const result = await db.query("SELECT id, email, password FROM users WHERE id = $1", [id])
    return result.rows[0]
  }
  return users.find((user) => Number(user.id) === Number(id))
}

async function createUser(email, hashedPassword) {
  if (dbEnabled) {
    const result = await db.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email, hashedPassword]
    )
    return result.rows[0]
  }
  const user = {
    id: users.length + 1,
    email,
    password: hashedPassword,
  }
  users.push(user)
  return user
}

app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))
app.use(express.static(path.join(__dirname, "public")))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(
  session({
    secret: process.env.SESSION_SECRET || "bagcartelsecret",
    resave: false,
    saveUninitialized: true,
  })
)
app.use(passport.initialize())
app.use(passport.session())

app.use((req, res, next) => {
  res.locals.user = req.user
  res.locals.cartCount = req.session.cart ? req.session.cart.reduce((total, item) => total + item.quantity, 0) : 0
  res.locals.googleEnabled = googleEnabled
  next()
})

passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const user = await getUserByEmail(email)
      if (!user) {
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
          let user = await getUserByEmail(email)
          if (!user) {
            user = await createUser(email, "google-auth")
          }
          return done(null, user)
        } catch (error) {
          return done(error)
        }
      }
    )
  )
}

passport.serializeUser((user, done) => {
  done(null, user.id || user.email)
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await getUserById(id)
    done(null, user || false)
  } catch (error) {
    done(error)
  }
})

function findProduct(id) {
  return productCatalog.find((product) => product.id === Number(id))
}

function getCart(req) {
  req.session.cart = req.session.cart || []
  return req.session.cart
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

app.get("/product/:id", (req, res) => {
  const product = findProduct(req.params.id)
  if (!product) {
    return res.status(404).render("404")
  }
  res.render("product", { product })
})

  app.post("/cart/add", (req, res) => {
  const product = findProduct(req.body.productId);
  if (!product) return res.redirect("/products");

  const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const color = req.body.color;

  const cart = getCart(req);

  // 🔥 UNIQUE KEY = product + color
  const existing = cart.find(
    item => item.product.id === product.id && item.color === color
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      product,
      color,
      quantity
    });
  }

  res.redirect("/products");
});


app.get("/cart", (req, res) => {
  const cart = getCart(req)
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  res.render("cart", { cart, total })
})


  app.post("/cart/remove", (req, res) => {
  const { productId, color } = req.body
  const cart = getCart(req)

  req.session.cart = cart.filter(
    (item) =>
      !(item.product.id === Number(productId) && item.color === color)
  )

  res.redirect("/cart")
});

app.post("/checkout", (req, res) => {
  const { shipping, lagosArea } = req.body

  const lagosPrices = {
    ikeja: 3000,
    lekki: 5000,
    yaba: 2500,
    ajah: 6000
  }

  const cart = getCart(req)

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )

  let shippingCost = 0

  if (shipping === "lagos") {
    shippingCost = lagosPrices[lagosArea] || 0
  }

  if (shipping === "outside") {
    shippingCost = 0 // negotiated
  }

  const total = subtotal + shippingCost

  req.session.cart = []

  res.render("checkout", {
    subtotal,
    shipping,
    lagosArea,
    shippingCost,
    total
  })
})


app.get("/login", (req, res) => {
  res.render("login")
})

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
)

app.get("/register", (req, res) => {
  res.redirect("/login")
})

app.post("/register", async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.redirect("/register")
  }

  try {
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return res.redirect("/login")
    }
    const hashedPassword = await bcrypt.hash(password, saltRounds)
    const newUser = await createUser(email, hashedPassword)
    req.login(newUser, (error) => {
      if (error) {
        return res.redirect("/login")
      }
      res.redirect("/")
    })
  } catch (error) {
    console.error(error)
    res.redirect("/register")
  }
})

app.get("/logout", (req, res, next) => {
  req.logout((error) => {
    if (error) {
      return next(error)
    }
    res.redirect("/")
  })
})

if (googleEnabled) {
  app.get("/auth/google", (req, res, next) => {
    if (req.query.code) {
      // This is Google's callback with authorization code
      passport.authenticate("google", {
        successRedirect: "/",
        failureRedirect: "/login",
      })(req, res, next)
    } else {
      // This is the initial login request
      passport.authenticate("google", {
        scope: ["profile", "email"],
      })(req, res, next)
    }
  })
}

app.use((req, res) => {
  res.status(404).render("404")
})

export default app
