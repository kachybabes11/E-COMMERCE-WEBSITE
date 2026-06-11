export async function getCartItems(db, { userId, guestToken }) {
  if (!userId && !guestToken) return []

  if (db) {
    const params = [userId || guestToken]
    const ownerColumn = userId ? "user_id" : "guest_token"
    const result = await db.query(
      `SELECT * FROM carts WHERE ${ownerColumn} = $1 ORDER BY updated_at DESC`,
      params
    )
    return result.rows.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    }))
  }

  return []
}

function makeOwnerClause(userId, guestToken) {
  if (userId) return { clause: "user_id = $1", value: userId }
  if (guestToken) return { clause: "guest_token = $1", value: guestToken }
  return null
}

export async function upsertCartItem(db, { userId, guestToken, productId, productName, color, unitPrice, quantity }) {
  const owner = makeOwnerClause(userId, guestToken)
  if (!owner) return

  if (db) {
    const existing = await db.query(
      `SELECT id, quantity FROM carts WHERE ${owner.clause} AND product_id = $2 AND color = $3`,
      [owner.value, productId, color]
    )
    if (existing.rowCount) {
      await db.query(
        `UPDATE carts SET quantity = $1, unit_price = $2, updated_at = now() WHERE id = $3`,
        [existing.rows[0].quantity + quantity, unitPrice, existing.rows[0].id]
      )
    } else {
      await db.query(
        `INSERT INTO carts (${userId ? "user_id" : "guest_token"}, product_id, product_name, color, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [owner.value, productId, productName, color, unitPrice, quantity]
      )
    }
  }
}

export async function updateCartItemQuantity(db, { userId, guestToken, productId, color, quantity }) {
  const owner = makeOwnerClause(userId, guestToken)
  if (!owner) return
  if (db) {
    if (quantity < 1) {
      await removeCartItem(db, { userId, guestToken, productId, color })
      return
    }
    await db.query(
      `UPDATE carts SET quantity = $1, updated_at = now() WHERE ${owner.clause} AND product_id = $2 AND color = $3`,
      [quantity, owner.value, productId, color]
    )
  }
}

export async function removeCartItem(db, { userId, guestToken, productId, color }) {
  const owner = makeOwnerClause(userId, guestToken)
  if (!owner) return
  if (db) {
    await db.query(
      `DELETE FROM carts WHERE ${owner.clause} AND product_id = $2 AND color = $3`,
      [owner.value, productId, color]
    )
  }
}

export async function clearCart(db, { userId, guestToken }) {
  const owner = makeOwnerClause(userId, guestToken)
  if (!owner) return
  if (db) {
    await db.query(`DELETE FROM carts WHERE ${owner.clause}`, [owner.value])
  }
}

export async function migrateGuestCartToUser(db, guestToken, userId) {
  if (!db || !guestToken || !userId) return

  const guestItems = await getCartItems(db, { guestToken })
  for (const item of guestItems) {
    await upsertCartItem(db, {
      userId,
      guestToken: null,
      productId: item.product_id,
      productName: item.product_name,
      color: item.color,
      unitPrice: item.unit_price,
      quantity: item.quantity,
    })
  }
  await db.query(`DELETE FROM carts WHERE guest_token = $1`, [guestToken])
}
