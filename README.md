# BAGCARTEL Production Commerce Platform

This project now includes a production-grade backend architecture with:

- Database-backed catalog (no hardcoded frontend catalog dependency for runtime)
- Secure admin dashboard (products, inventory, customers, orders, analytics)
- Atomic inventory reservation/commit flow to prevent overselling
- Inventory history and low-stock visibility
- Protected admin APIs and role-aware auth checks

## Stack

- Node.js + Express + EJS
- PostgreSQL
- Passport auth (local + Google)
- CSRF protection, session auth, rate limiting
- Multer for secure image uploads

## Data Model

Core tables created in `config/dbSetup.js`:

- `users` (with `role` + `is_admin`)
- `categories`
- `products`
- `product_categories`
- `product_sizes`
- `product_variants`
- `product_variant_images`
- `inventories`
- `inventory_transactions`
- `inventory_reservations`
- `inventory_reservation_items`
- `carts`
- `orders`
- `order_items`
- `wishlists`

### Inventory semantics

- `inventories.quantity`: sellable stock remaining
- `inventories.reserved_quantity`: currently held in checkout reservations
- `inventories.status`: `In Stock`, `Low Stock`, `Out of Stock`

## Architecture

### Request Layer

- `app.js` route handlers for storefront, checkout, admin, and APIs
- Middleware: auth, rate limiting, CSRF, centralized error handling

### Service Layer

- `services/productService.js`: DB-backed catalog hydration and read model
- `services/inventoryService.js`: reservation lifecycle + atomic stock protection
- `services/orderService.js`: order persistence (transaction-compatible)
- Existing services for users/carts/wishlist/email remain integrated

### Data Layer

- PostgreSQL via `config/db.js`
- Schema bootstrap + initial seed from legacy catalog in `config/dbSetup.js`

## Real-Time Stock Protection (Critical)

Oversell prevention is now enforced server-side using row-level locking and transactions:

1. At checkout initialization:
- Lock each variant row with `FOR UPDATE`
- Verify stock from DB
- Deduct `inventories.quantity` immediately
- Increase `reserved_quantity`
- Record `reserve` transactions

2. At payment callback success:
- Commit reservation in one transaction
- Create order + order items
- Decrease `reserved_quantity`
- Record inventory history

3. At payment failure/error/expiry:
- Release reservation
- Return stock to `inventories.quantity`
- Decrease `reserved_quantity`
- Record `release` transaction

If another buyer attempts to reserve the last unit concurrently, only one reservation succeeds. The other receives:

- `This item is no longer available.`

## Checkout Validation

Before redirecting to payment:

- Cart is validated
- Shipping values are validated
- Inventory is reserved atomically

After payment verification:

- Total amount is revalidated
- Reservation is committed atomically
- Order records are created
- Cart is cleared
- Notifications are sent

## Paystack Channel Configuration

Checkout now sends an explicit Paystack `channels` list during transaction initialization.

Set `PAYSTACK_CHANNELS` in your `.env` as a comma-separated list:

- `card`
- `bank`
- `ussd`
- `bank_transfer`
- `qr`
- `mobile_money`
- `eft`

Example:
```
PAYSTACK_CHANNELS=card,bank,ussd,bank_transfer,qr,mobile_money,eft
```

You can also use:
```
PAYSTACK_CHANNELS=all
```

### Webhook

Set your Paystack webhook URL to:

```
POST /paystack/webhook
```

The endpoint validates `x-paystack-signature` and processes `charge.success`, `charge.failed`, and `bank.transfer.rejected` events.

## Admin Dashboard Features

### Product Management

- Create/edit/archive products
- Assign categories
- Set sizes and dimensions
- Configure color variants
- Set stock and low-stock threshold
- Upload multiple images (securely)

### Inventory Management

- Current stock visibility
- Manual adjustments (+/-)
- Automatic status updates (`In Stock`, `Low Stock`, `Out of Stock`)
- Full inventory transaction history in database

### Order Management

- View all orders
- Filter/search orders
- Update order status (`Pending`, `Processing`, `Shipped`, `Delivered`, `Cancelled`)

### Customer Management

- Search customers
- View customer order history and spend

### Analytics

- Total sales
- Total orders
- Revenue
- Best-selling products
- Low stock list
- Monthly sales chart

## API Surface

Public APIs:

- `GET /api/products`
- `GET /api/categories`

Admin-protected APIs:

- `GET /api/inventory`
- `GET /api/orders`
- `GET /api/users`
- `GET /api/dashboard/analytics`

## Security Controls

- Role-based route protection (`ensureAdmin`)
- CSRF protection
- Global and endpoint-specific rate limiting
- Secure upload filtering (mime type + size limits)
- Backend-only stock updates
- Centralized error handling for web and API responses

## Scalability Guidelines

For high-volume production:

1. Move session storage to Redis.
2. Add a background job to clean expired reservations on schedule.
3. Add indexes for high-traffic filters (inventory, order status, created_at).
4. Introduce API versioning (`/api/v1/...`).
5. Use object storage (S3/Cloudinary) for images and store URLs in DB.
6. Use read replicas for analytics workloads.
7. Add queue-based email/order event processing.

## Production Deployment Best Practices

1. Environment hardening
- Set strong `SESSION_SECRET`, `COOKIE_SECRET`
- Enforce HTTPS behind reverse proxy
- Use managed Postgres with automated backups

2. App hardening
- Run with `NODE_ENV=production`
- Enable process manager (PM2/systemd/container orchestration)
- Add health check endpoint and uptime monitoring

3. Observability
- Structured request/error logs
- Track reservation failures and payment callback anomalies
- Alert on low-stock and payment verification failures

4. CI/CD
- Run lint/tests/migrations before deploy
- Blue/green or rolling deployments
- Automated rollback strategy

## Quick Start

1. Install dependencies
```
npm install
```

2. Configure environment variables in `.env`.

3. Start server
```
npm start
```

On first boot, schema is created and legacy catalog is seeded into normalized tables.
