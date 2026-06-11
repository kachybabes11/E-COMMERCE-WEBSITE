import productCatalog from "../config/products.js"

export function findProduct(productId) {
  return productCatalog.find((product) => Number(product.id) === Number(productId))
}

export function findColorVariant(product, color) {
  return product?.colors?.find((variant) => variant.name === color)
}

export async function getVariantStock(db, productId, color) {
  if (db) {
    const result = await db.query(
      `SELECT stock FROM product_stocks WHERE product_id = $1 AND color = $2`,
      [productId, color]
    )
    if (result.rowCount) {
      return Number(result.rows[0].stock)
    }
  }
  const product = findProduct(productId)
  const variant = findColorVariant(product, color)
  if (!variant) return 0
  return Number(variant.stock ?? product.stock ?? 0)
}

export async function reduceVariantStock(db, productId, color, quantity) {
  const currentStock = await getVariantStock(db, productId, color)
  const updatedStock = Math.max(0, currentStock - quantity)
  if (db) {
    await db.query(
      `UPDATE product_stocks SET stock = $1 WHERE product_id = $2 AND color = $3`,
      [updatedStock, productId, color]
    )
  }
  return updatedStock
}

export function getProductDisplayStock(product, color, variantStock) {
  const stock = typeof variantStock === "number" ? variantStock : variantStock ?? 0
  return stock
}

export function formatCurrency(value) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
