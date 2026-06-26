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
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price NUMERIC(12,2) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS product_categories (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE (product_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS product_sizes (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size_label TEXT NOT NULL,
      dimensions TEXT,
      UNIQUE (product_id, size_label)
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      color TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (product_id, color)
    );

    CREATE TABLE IF NOT EXISTS product_variant_images (
      id SERIAL PRIMARY KEY,
      variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventories (
      id SERIAL PRIMARY KEY,
      variant_id INTEGER NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
      low_stock_threshold INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'In Stock',
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id SERIAL PRIMARY KEY,
      variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      change_type TEXT NOT NULL,
      delta_quantity INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      note TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS inventory_tx_variant_created ON inventory_transactions (variant_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS inventory_reservations (
      id SERIAL PRIMARY KEY,
      reservation_code TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      committed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS inventory_reservation_items (
      id SERIAL PRIMARY KEY,
      reservation_id INTEGER NOT NULL REFERENCES inventory_reservations(id) ON DELETE CASCADE,
      variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity > 0)
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
      reservation_code TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER,
      variant_id INTEGER,
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

    CREATE TABLE IF NOT EXISTS customer_reviews (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      reviewer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      review_text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS products_active_idx ON products (is_active);
    CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
    CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (order_status, payment_status);
  `)

  await db.query(`
    UPDATE users
    SET role = CASE WHEN is_admin THEN 'admin' ELSE 'customer' END
    WHERE role IS NULL OR role NOT IN ('admin', 'customer');
  `)

  const existingProducts = await db.query(`SELECT COUNT(*)::int AS count FROM products`)
  if (existingProducts.rows[0].count > 0) {
    return
  }

  for (const product of productCatalog) {
    await db.query(
      `INSERT INTO products (id, name, description, price)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           updated_at = now()`,
      [product.id, product.name, product.description, Number(product.price)]
    )

    const categories = Array.isArray(product.category) ? product.category : [product.category]
    for (const categoryNameRaw of categories) {
      const categoryName = String(categoryNameRaw || "").trim()
      if (!categoryName) continue
      const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const categoryInsert = await db.query(
        `INSERT INTO categories (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug
         RETURNING id`,
        [categoryName, slug || `category-${Date.now()}`]
      )
      await db.query(
        `INSERT INTO product_categories (product_id, category_id)
         VALUES ($1, $2)
         ON CONFLICT (product_id, category_id) DO NOTHING`,
        [product.id, categoryInsert.rows[0].id]
      )
    }

    for (const size of product.sizes || []) {
      await db.query(
        `INSERT INTO product_sizes (product_id, size_label, dimensions)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, size_label) DO UPDATE SET dimensions = EXCLUDED.dimensions`,
        [product.id, size.size, size.dimensions || null]
      )
    }

    for (const variant of product.colors) {
      const stockValue = typeof variant.stock === "number" ? variant.stock : product.stock || 0

      const variantInsert = await db.query(
        `INSERT INTO product_variants (product_id, color)
         VALUES ($1, $2)
         ON CONFLICT (product_id, color) DO UPDATE SET is_active = true
         RETURNING id`,
        [product.id, variant.name]
      )
      const variantId = variantInsert.rows[0].id

      for (let index = 0; index < (variant.images || []).length; index += 1) {
        await db.query(
          `INSERT INTO product_variant_images (variant_id, image_url, sort_order)
           VALUES ($1, $2, $3)`,
          [variantId, variant.images[index], index]
        )
      }

      const status = stockValue <= 0 ? "Out of Stock" : stockValue <= 3 ? "Low Stock" : "In Stock"
      await db.query(
        `INSERT INTO inventories (variant_id, quantity, reserved_quantity, low_stock_threshold, status)
         VALUES ($1, $2, 0, 3, $3)
         ON CONFLICT (variant_id) DO UPDATE
         SET quantity = EXCLUDED.quantity,
             status = EXCLUDED.status,
             updated_at = now()`,
        [variantId, stockValue, status]
      )

      await db.query(
        `INSERT INTO inventory_transactions (
          variant_id, change_type, delta_quantity, balance_after, reference_type, note
        ) VALUES ($1, 'seed', $2, $3, 'system', 'Initial catalog import')`,
        [variantId, stockValue, stockValue]
      )

      await db.query(
        `INSERT INTO product_stocks (product_id, color, stock)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, color) DO UPDATE SET stock = EXCLUDED.stock`,
        [product.id, variant.name, stockValue]
      )
    }
  }
}
