# REST API Route List (`/api/v1`)

Auth column: 🔓 public · 🔑 any authenticated · 🛒 customer · 🏪 vendor · 👑 admin.
All list endpoints are **cursor-paginated** (`?limit=&cursor=`), not offset — stable under inserts and
O(1) at any depth (offset degrades as `OFFSET` grows).

## Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | 🔓 | Create account (customer or vendor); bcrypt cost 12. |
| POST | `/auth/login` | 🔓 | Returns access (15m) + sets refresh (7d, httpOnly cookie). Rate-limited. |
| POST | `/auth/refresh` | 🔓* | Rotate: validate hashed refresh token, revoke old, issue new pair. |
| POST | `/auth/logout` | 🔑 | Revoke the presented refresh token. |

## Products
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products` | 🔓 | Search/filter/sort + cursor pagination. `?q=&category=&minPrice=&maxPrice=&sort=`. |
| GET | `/products/:id` | 🔓 | Product detail incl. images, inventory status, rating summary. |
| POST | `/products` | 🏪 | Create (vendor-scoped; vendor_id from token). |
| PATCH | `/products/:id` | 🏪 | Update own product only (ownership check). |
| DELETE | `/products/:id` | 🏪 | Soft-delete (`is_active=false`); hard delete blocked if ever ordered. |
| POST | `/products/:id/images` | 🏪 | Multer upload; one primary enforced in service. |

## Cart
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/cart` | 🛒 | Current user's cart with live prices + stock flags. |
| POST | `/cart/items` | 🛒 | Add/increment (upsert on `(cart_id, product_id)`). |
| PATCH | `/cart/items/:productId` | 🛒 | Set quantity. |
| DELETE | `/cart/items/:productId` | 🛒 | Remove line. |

## Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/orders/checkout` | 🛒 | **Atomic transaction**: stock check → reserve → split by vendor → payment intent. |
| GET | `/orders` | 🛒 | Order history (cursor). |
| GET | `/orders/:id` | 🛒 | Full order view reconstructed across vendors. |
| POST | `/orders/:id/cancel` | 🛒 | Cancel if not yet shipped; releases reservation, triggers refund. |

## Vendor dashboard
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vendor/orders` | 🏪 | Only this vendor's `order_items` (their sub-orders). |
| PATCH | `/vendor/orders/:itemId/status` | 🏪 | Independent fulfillment status update per line. |
| GET | `/vendor/payouts` | 🏪 | Commission settlement history. |

## Admin
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/users` | 👑 | User management (activate/deactivate). |
| PATCH | `/admin/vendors/:id/verify` | 👑 | Approve/reject vendor. |
| GET | `/admin/analytics/top-products` | 👑 | Top 10 selling this month. |
| GET | `/admin/analytics/revenue-by-category` | 👑 | Revenue + MoM growth % (LAG). |
| GET | `/admin/analytics/vendor-leaderboard` | 👑 | Vendor performance ranking. |
| GET | `/admin/analytics/clv` | 👑 | Customer lifetime value segmentation. |

## Reviews & Recommendations
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/products/:id/reviews` | 🛒 | Create — **only if a delivered order_item exists** (verified purchase). |
| PATCH | `/reviews/:id` | 🛒 | Edit own review. |
| DELETE | `/reviews/:id` | 🛒/👑 | Delete own (or admin moderation). |
| GET | `/products/:id/recommendations` | 🔓 | "Bought together" co-occurrence list. |

## Payments (gateway callbacks)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payments/webhook` | 🔓† | Gateway callback. Verify signature; idempotent on `transaction_ref`. |

\* `/auth/refresh` is public but requires a valid refresh cookie.
† `/payments/webhook` is unauthenticated by user JWT but **must** verify the gateway HMAC signature.
