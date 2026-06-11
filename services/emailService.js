import nodemailer from "nodemailer"

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null

function formatMoney(value) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildOrderHtml(order, items) {
  return `
    <div style="font-family: Arial, sans-serif; color: #222;">
      <h1>Thank you for your order!</h1>
      <p>Hi ${order.customer_name},</p>
      <p>Your order <strong>${order.order_number}</strong> has been received.</p>
      <h2>Order Summary</h2>
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 1rem;">
        <thead>
          <tr>
            <th align="left">Product</th>
            <th align="center">Color</th>
            <th align="center">Qty</th>
            <th align="right">Price</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${item.product_name}</td>
                <td style="padding: 8px 0; text-align: center;">${item.color}</td>
                <td style="padding: 8px 0; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px 0; text-align: right;">₦${formatMoney(item.total_price)}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <p><strong>Total Amount:</strong> ₦${formatMoney(order.total_amount)}</p>
      <h3>Shipping Address</h3>
      <p>${order.shipping_address.street}, ${order.shipping_address.city}, ${order.shipping_address.state}, ${order.shipping_address.postalCode}</p>
      <p>${order.shipping_address.country}</p>
      <p>If you have any questions, reply to this email or contact our support team.</p>
      <p>Thank you for shopping with BagCartel.</p>
    </div>
  `
}

export async function sendOrderConfirmationEmail(order, items) {
  if (!transporter || !process.env.FROM_EMAIL) {
    console.warn("Email transport is not configured. Skipping order confirmation email.")
    return
  }

  const html = buildOrderHtml(order, items)
  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: order.email,
      subject: `Order confirmation - ${order.order_number}`,
      html,
    })
  } catch (error) {
    console.error("Failed to send order confirmation email:", error.message)
  }
}

export async function sendNewOrderNotificationEmail(order, items) {
  if (!transporter || !process.env.STORE_EMAIL) {
    console.warn("Email transport is not configured. Skipping store notification email.")
    return
  }

  const html = buildOrderHtml(order, items) + `<p><strong>Customer:</strong> ${order.customer_name} (${order.email})</p>`
  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: process.env.STORE_EMAIL,
      subject: `New order received - ${order.order_number}`,
      html,
    })
  } catch (error) {
    console.error("Failed to send store notification email:", error.message)
  }
}
