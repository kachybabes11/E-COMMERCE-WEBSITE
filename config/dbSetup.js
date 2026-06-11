import db from "./db.js"
import productCatalog from "./products.js"

export async function ensureDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      google_id TEXT,
      is_admin BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS product_stocks (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      color TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      UNIQUE (product_id, color)
    );

    CREATE TABLE IF NOT EXISTS carts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      guest_token TEXT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      color TEXT NOT NULL,
      unit_price NUMERIC(12,2) NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS carts_user_product_color ON carts (user_id, product_id, color);
    CREATE INDEX IF NOT EXISTS carts_guest_product_color ON carts (guest_token, product_id, color);

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_uuid TEXT UNIQUE NOT NULL,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      shipping_address JSONB NOT NULL,
      shipping_method TEXT NOT NULL,
      shipping_fee NUMERIC(12,2) NOT NULL,
      payment_status TEXT NOT NULL,
      order_status TEXT NOT NULL,
      total_amount NUMERIC(12,2) NOT NULL,
      paystack_reference TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      color TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(12,2) NOT NULL,
      total_price NUMERIC(12,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wishlists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      color TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS wishlists_user_product_color ON wishlists (user_id, product_id, color);
  `)

  for (const product of productCatalog) {
    for (const variant of product.colors) {
      const stockValue = typeof variant.stock === "number" ? variant.stock : product.stock || 0
      await db.query(
        `INSERT INTO product_stocks (product_id, color, stock)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, color) DO UPDATE SET stock = EXCLUDED.stock`,
        [product.id, variant.name, stockValue]
      )
    }
  }
}
