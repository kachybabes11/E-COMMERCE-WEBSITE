export async function getWishlist(db, userId) {
  if (!db || !userId) return []
  const result = await db.query(
    `SELECT product_id, color FROM wishlists WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  )
  return result.rows
}

export async function addWishlistItem(db, userId, productId, color) {
  if (!db || !userId) return
  await db.query(
    `INSERT INTO wishlists (user_id, product_id, color) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id, color) DO NOTHING`,
    [userId, productId, color]
  )
}

export async function removeWishlistItem(db, userId, productId, color) {
  if (!db || !userId) return
  await db.query(
    `DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2 AND color = $3`,
    [userId, productId, color]
  )
}

export async function isWishlisted(db, userId, productId, color) {
  if (!db || !userId) return false
  const result = await db.query(
    `SELECT 1 FROM wishlists WHERE user_id = $1 AND product_id = $2 AND color = $3`,
    [userId, productId, color]
  )
  return result.rowCount > 0
}
