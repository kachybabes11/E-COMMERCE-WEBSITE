import { v4 as uuidv4 } from "uuid"

export async function createOrder(db, {
  userId,
  customerName,
  email,
  phone,
  shippingAddress,
  shippingMethod,
  shippingFee,
  items,
  paymentStatus,
  orderStatus,
  totalAmount,
  paystackReference,
}) {
  const orderNumber = `BC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`
  const orderUuid = uuidv4()

  const result = await db.query(
    `INSERT INTO orders (
      order_uuid,
      order_number,
      user_id,
      customer_name,
      email,
      phone,
      shipping_address,
      shipping_method,
      shipping_fee,
      payment_status,
      order_status,
      total_amount,
      paystack_reference
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      orderUuid,
      orderNumber,
      userId,
      customerName,
      email,
      phone,
      shippingAddress,
      shippingMethod,
      shippingFee,
      paymentStatus,
      orderStatus,
      totalAmount,
      paystackReference,
    ]
  )

  const order = result.rows[0]

  const insertItems = items.map((item) => [
    order.id,
    item.product_id,
    item.product_name,
    item.color,
    item.quantity,
    item.unit_price,
    item.total_price,
  ])

  if (insertItems.length) {
    const values = insertItems
      .map(
        (_, index) => `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`
      )
      .join(",")

    const flatParams = insertItems.flat()
    await db.query(
      `INSERT INTO order_items (order_id, product_id, product_name, color, quantity, unit_price, total_price) VALUES ${values}`,
      flatParams
    )
  }

  return order
}

export async function getUserOrders(db, userId) {
  const result = await db.query(
    `SELECT id, order_number, payment_status, order_status, total_amount, created_at
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  )
  return result.rows
}

export async function getOrderById(db, orderId) {
  const result = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId])
  return result.rows[0]
}

export async function getOrderDetails(db, orderId) {
  const order = await getOrderById(db, orderId)
  if (!order) return null
  const items = await db.query(
    `SELECT product_id, product_name, color, quantity, unit_price, total_price FROM order_items WHERE order_id = $1 ORDER BY id`,
    [orderId]
  )
  return { order, items: items.rows }
}

export async function getAllOrders(db, { search, status }) {
  const conditions = []
  const params = []
  if (status) {
    params.push(status)
    conditions.push(`order_status = $${params.length}`)
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`)
    conditions.push(`(LOWER(order_number) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR LOWER(customer_name) LIKE $${params.length})`)
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  const result = await db.query(
    `SELECT id, order_number, customer_name, email, payment_status, order_status, total_amount, created_at
     FROM orders
     ${whereClause}
     ORDER BY created_at DESC`,
    params
  )
  return result.rows
}

export async function updateOrderStatus(db, orderId, status) {
  const result = await db.query(
    `UPDATE orders SET order_status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, orderId]
  )
  return result.rows[0]
}
