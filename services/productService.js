import fallbackCatalog from "../config/products.js"

let catalogCache = []
let cacheLoadedAt = 0
const CACHE_TTL_MS = 5000

function normalizeCategory(rows) {
  return [...new Set(rows.map((row) => row.category_name).filter(Boolean))]
}

function buildCatalog(rows) {
  const products = new Map()

  for (const row of rows) {
    if (!products.has(row.product_id)) {
      products.set(row.product_id, {
        id: Number(row.product_id),
        name: row.product_name,
        description: row.description,
        price: Number(row.price),
        category: [],
        sizes: [],
        colors: [],
      })
    }

    const product = products.get(row.product_id)
    const categories = normalizeCategory(rows.filter((item) => item.product_id === row.product_id))
    product.category = categories.length === 1 ? categories[0] : categories

    if (row.size_id && !product.sizes.some((size) => size.id === row.size_id)) {
      product.sizes.push({
        id: Number(row.size_id),
        size: row.size_label,
        dimensions: row.size_dimensions || "",
      })
    }

    if (row.variant_id) {
      let colorVariant = product.colors.find((item) => item.id === row.variant_id)
      if (!colorVariant) {
        colorVariant = {
          id: Number(row.variant_id),
          name: row.color,
          stock: Number(row.stock_quantity || 0),
          reserved: Number(row.reserved_quantity || 0),
          lowStockThreshold: Number(row.low_stock_threshold || 3),
          availability: row.stock_status || "In Stock",
          images: [],
        }
        product.colors.push(colorVariant)
      }

      if (row.image_url && !colorVariant.images.includes(row.image_url)) {
        colorVariant.images.push(row.image_url)
      }
    }
  }

  return [...products.values()].sort((a, b) => a.id - b.id)
}

export async function refreshCatalog(db, { force = false } = {}) {
  const now = Date.now()
  if (!force && now - cacheLoadedAt < CACHE_TTL_MS && catalogCache.length) {
    return catalogCache
  }

  if (!db) {
    catalogCache = fallbackCatalog
    cacheLoadedAt = now
    return catalogCache
  }

  const result = await db.query(
    `SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.description,
      p.price,
      c.name AS category_name,
      ps.id AS size_id,
      ps.size_label,
      ps.dimensions AS size_dimensions,
      pv.id AS variant_id,
      pv.color,
      i.quantity AS stock_quantity,
      i.reserved_quantity,
      i.low_stock_threshold,
      i.status AS stock_status,
      pvi.image_url,
      pvi.sort_order
    FROM products p
    LEFT JOIN product_categories pc ON pc.product_id = p.id
    LEFT JOIN categories c ON c.id = pc.category_id
    LEFT JOIN product_sizes ps ON ps.product_id = p.id
    LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = true
    LEFT JOIN inventories i ON i.variant_id = pv.id
    LEFT JOIN product_variant_images pvi ON pvi.variant_id = pv.id
    WHERE p.is_active = true
    ORDER BY p.id, pv.id, pvi.sort_order ASC, pvi.id ASC`
  )

  catalogCache = buildCatalog(result.rows)
  cacheLoadedAt = now
  return catalogCache
}

export function getCatalog() {
  return catalogCache.length ? catalogCache : fallbackCatalog
}

export function getCategoriesFromCatalog() {
  const categories = new Set()
  for (const product of getCatalog()) {
    const list = Array.isArray(product.category) ? product.category : [product.category]
    for (const category of list) {
      if (category) categories.add(category)
    }
  }
  return [...categories]
}

export function findProduct(productId) {
  return getCatalog().find((product) => Number(product.id) === Number(productId))
}

export function findColorVariant(product, color) {
  return product?.colors?.find((variant) => variant.name === color)
}

export async function getVariantStock(db, productId, color) {
  if (db) {
    const result = await db.query(
      `SELECT i.quantity
       FROM inventories i
       JOIN product_variants pv ON pv.id = i.variant_id
       WHERE pv.product_id = $1 AND pv.color = $2 AND pv.is_active = true`,
      [productId, color]
    )
    if (result.rowCount) {
      return Number(result.rows[0].quantity)
    }
  }

  const product = findProduct(productId)
  const variant = findColorVariant(product, color)
  if (!variant) return 0
  return Number(variant.stock ?? product.stock ?? 0)
}

export async function reduceVariantStock(db, productId, color, quantity) {
  if (db) {
    const result = await db.query(
      `UPDATE inventories i
       SET quantity = GREATEST(0, i.quantity - $3),
           status = CASE
             WHEN GREATEST(0, i.quantity - $3) <= 0 THEN 'Out of Stock'
             WHEN GREATEST(0, i.quantity - $3) <= i.low_stock_threshold THEN 'Low Stock'
             ELSE 'In Stock'
           END,
           updated_at = now()
       FROM product_variants pv
       WHERE i.variant_id = pv.id AND pv.product_id = $1 AND pv.color = $2
       RETURNING i.quantity`,
      [productId, color, quantity]
    )
    if (result.rowCount) {
      return Number(result.rows[0].quantity)
    }
  }

  const currentStock = await getVariantStock(db, productId, color)
  return Math.max(0, currentStock - quantity)
}

export function getProductDisplayStock(product, color, variantStock) {
  const stock = typeof variantStock === "number" ? variantStock : variantStock ?? 0
  return stock
}

export function formatCurrency(value) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
