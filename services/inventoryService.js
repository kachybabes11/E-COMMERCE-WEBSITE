import { randomUUID } from "crypto"

const RESERVATION_TTL_MINUTES = Number(process.env.INVENTORY_RESERVATION_TTL_MINUTES || 15)

function stockStatus(quantity, threshold) {
  if (quantity <= 0) return "Out of Stock"
  if (quantity <= threshold) return "Low Stock"
  return "In Stock"
}

async function releaseReservationById(client, reservationId, { note = "Reservation released" } = {}) {
  const reservationItems = await client.query(
    `SELECT id, variant_id, quantity FROM inventory_reservation_items WHERE reservation_id = $1`,
    [reservationId]
  )

  for (const item of reservationItems.rows) {
    const inventoryRow = await client.query(
      `SELECT quantity, reserved_quantity, low_stock_threshold
       FROM inventories
       WHERE variant_id = $1
       FOR UPDATE`,
      [item.variant_id]
    )

    if (!inventoryRow.rowCount) continue

    const current = inventoryRow.rows[0]
    const nextQuantity = Number(current.quantity) + Number(item.quantity)
    const nextReserved = Math.max(0, Number(current.reserved_quantity) - Number(item.quantity))

    await client.query(
      `UPDATE inventories
       SET quantity = $1,
           reserved_quantity = $2,
           status = $3,
           updated_at = now()
       WHERE variant_id = $4`,
      [nextQuantity, nextReserved, stockStatus(nextQuantity, Number(current.low_stock_threshold)), item.variant_id]
    )

    await client.query(
      `INSERT INTO inventory_transactions (
        variant_id,
        change_type,
        delta_quantity,
        balance_after,
        reference_type,
        reference_id,
        note
      ) VALUES ($1, 'release', $2, $3, 'reservation', $4, $5)`,
      [item.variant_id, Number(item.quantity), nextQuantity, String(reservationId), note]
    )
  }
}

export async function releaseExpiredReservations(db) {
  const client = await db.connect()
  try {
    await client.query("BEGIN")
    const expired = await client.query(
      `SELECT id
       FROM inventory_reservations
       WHERE status = 'pending' AND expires_at <= now()
       FOR UPDATE`
    )

    for (const row of expired.rows) {
      await releaseReservationById(client, row.id, { note: "Reservation expired" })
      await client.query(
        `UPDATE inventory_reservations
         SET status = 'expired'
         WHERE id = $1`,
        [row.id]
      )
    }

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function reserveInventoryForCheckout(db, { userId, cartItems, checkoutContext = null }) {
  const client = await db.connect()
  const reservationCode = randomUUID()

  try {
    await client.query("BEGIN")

    const reservationInsert = await client.query(
      `INSERT INTO inventory_reservations (reservation_code, user_id, status, expires_at, checkout_context)
       VALUES ($1, $2, 'pending', now() + ($3::text || ' minutes')::interval, $4::jsonb)
       RETURNING id, reservation_code, expires_at`,
      [reservationCode, userId || null, String(RESERVATION_TTL_MINUTES), checkoutContext ? JSON.stringify(checkoutContext) : null]
    )
    const reservation = reservationInsert.rows[0]

    for (const item of cartItems) {
      const variantResult = await client.query(
        `SELECT pv.id AS variant_id, i.quantity, i.reserved_quantity, i.low_stock_threshold
         FROM product_variants pv
         JOIN inventories i ON i.variant_id = pv.id
         WHERE pv.product_id = $1 AND pv.color = $2 AND pv.is_active = true
         FOR UPDATE`,
        [item.product_id, item.color]
      )

      if (!variantResult.rowCount) {
        throw new Error("This item is no longer available.")
      }

      const variant = variantResult.rows[0]
      const available = Number(variant.quantity)
      const requested = Number(item.quantity)

      if (requested > available) {
        throw new Error("This item is no longer available.")
      }

      const nextQty = available - requested
      const nextReserved = Number(variant.reserved_quantity) + requested

      await client.query(
        `UPDATE inventories
         SET quantity = $1,
             reserved_quantity = $2,
             status = $3,
             updated_at = now()
         WHERE variant_id = $4`,
        [nextQty, nextReserved, stockStatus(nextQty, Number(variant.low_stock_threshold)), variant.variant_id]
      )

      await client.query(
        `INSERT INTO inventory_reservation_items (reservation_id, variant_id, quantity)
         VALUES ($1, $2, $3)`,
        [reservation.id, variant.variant_id, requested]
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
        ) VALUES ($1, 'reserve', $2, $3, 'reservation', $4, 'Checkout reservation created', $5)`,
        [variant.variant_id, -requested, nextQty, reservation.reservation_code, userId || null]
      )
    }

    await client.query("COMMIT")
    return reservation
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function releaseReservationByCode(db, reservationCode, { note = "Reservation released" } = {}) {
  if (!reservationCode) return false

  const client = await db.connect()
  try {
    await client.query("BEGIN")
    const reservationResult = await client.query(
      `SELECT id, status
       FROM inventory_reservations
       WHERE reservation_code = $1
       FOR UPDATE`,
      [reservationCode]
    )

    if (!reservationResult.rowCount) {
      await client.query("COMMIT")
      return false
    }

    const reservation = reservationResult.rows[0]
    if (reservation.status !== "pending") {
      await client.query("COMMIT")
      return false
    }

    await releaseReservationById(client, reservation.id, { note })
    await client.query(
      `UPDATE inventory_reservations
       SET status = 'released'
       WHERE id = $1`,
      [reservation.id]
    )

    await client.query("COMMIT")
    return true
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function findLatestPendingReservationCodeByUser(db, userId) {
  if (!userId) return null

  const result = await db.query(
    `SELECT reservation_code
     FROM inventory_reservations
     WHERE user_id = $1
       AND status = 'pending'
       AND expires_at > now()
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  )

  return result.rows[0]?.reservation_code || null
}

export async function getReservationByCode(db, reservationCode) {
  if (!reservationCode) return null

  const result = await db.query(
    `SELECT id, reservation_code, user_id, status, expires_at, checkout_context, committed_at, created_at
     FROM inventory_reservations
     WHERE reservation_code = $1
     LIMIT 1`,
    [reservationCode]
  )

  return result.rows[0] || null
}

export async function commitReservation(db, { reservationCode, paystackReference, createOrderFn }) {
  const client = await db.connect()
  try {
    await client.query("BEGIN")

    const reservationResult = await client.query(
      `SELECT id, reservation_code, status
       FROM inventory_reservations
       WHERE reservation_code = $1
       FOR UPDATE`,
      [reservationCode]
    )

    if (!reservationResult.rowCount) {
      throw new Error("Reservation not found.")
    }

    const reservation = reservationResult.rows[0]
    if (reservation.status !== "pending") {
      throw new Error("Reservation is no longer valid.")
    }

    const itemsResult = await client.query(
      `SELECT
         ri.variant_id,
         ri.quantity,
         pv.product_id,
         pv.color,
         p.name AS product_name,
         p.price
       FROM inventory_reservation_items ri
       JOIN product_variants pv ON pv.id = ri.variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE ri.reservation_id = $1`,
      [reservation.id]
    )

    for (const row of itemsResult.rows) {
      const inventoryResult = await client.query(
        `SELECT quantity, reserved_quantity, low_stock_threshold
         FROM inventories
         WHERE variant_id = $1
         FOR UPDATE`,
        [row.variant_id]
      )
      if (!inventoryResult.rowCount) {
        throw new Error("Inventory record missing.")
      }

      const inventory = inventoryResult.rows[0]
      const nextReserved = Math.max(0, Number(inventory.reserved_quantity) - Number(row.quantity))
      const remainingQty = Number(inventory.quantity)

      await client.query(
        `UPDATE inventories
         SET reserved_quantity = $1,
             status = $2,
             updated_at = now()
         WHERE variant_id = $3`,
        [nextReserved, stockStatus(remainingQty, Number(inventory.low_stock_threshold)), row.variant_id]
      )

      await client.query(
        `INSERT INTO inventory_transactions (
          variant_id,
          change_type,
          delta_quantity,
          balance_after,
          reference_type,
          reference_id,
          note
        ) VALUES ($1, 'deduct', 0, $2, 'payment', $3, 'Reservation committed after successful payment')`,
        [row.variant_id, remainingQty, paystackReference || reservationCode]
      )
    }

    const orderPayload = {
      reservationCode,
      orderItems: itemsResult.rows.map((row) => ({
        product_id: Number(row.product_id),
        variant_id: Number(row.variant_id),
        product_name: row.product_name,
        color: row.color,
        quantity: Number(row.quantity),
        unit_price: Number(row.price),
        total_price: Number(row.price) * Number(row.quantity),
      })),
    }

    const order = await createOrderFn(client, orderPayload)

    await client.query(
      `UPDATE inventory_reservations
       SET status = 'committed', committed_at = now()
       WHERE id = $1`,
      [reservation.id]
    )

    await client.query("COMMIT")
    return order
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
