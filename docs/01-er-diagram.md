# ER Diagram (Mermaid)

Paste into any Mermaid renderer (GitHub, mermaid.live) to render. Cardinalities and
key relationships are annotated. `||` = exactly one, `o{` = zero-or-many, `|{` = one-or-many.

```mermaid
erDiagram
    users ||--o| vendors : "has profile (if role=vendor)"
    users ||--o{ addresses : owns
    users ||--o| carts : has
    users ||--o{ orders : places
    users ||--o{ reviews : writes
    users ||--o{ wishlist : saves
    users ||--o{ refresh_tokens : holds

    vendors ||--o{ products : sells
    vendors ||--o{ order_items : fulfills
    vendors ||--o{ vendor_payouts : "settled to"

    categories ||--o{ categories : "parent of (subcategory)"
    categories ||--o{ products : classifies

    products ||--o{ product_images : has
    products ||--o| inventory : "stock tracked by"
    products ||--o{ cart_items : "added as"
    products ||--o{ order_items : "sold as"
    products ||--o{ reviews : receives
    products ||--o{ wishlist : "wished for"

    carts ||--o{ cart_items : contains

    orders ||--|{ order_items : "split into (per vendor)"
    orders ||--o| payments : "paid by"
    addresses ||--o{ orders : "ships to"

    order_items ||--o| vendor_payouts : "generates"

    users {
      bigint id PK
      varchar email UK
      char password_hash
      enum role
      bool is_active
    }
    vendors {
      bigint id PK
      bigint user_id FK,UK
      varchar store_name
      decimal commission_rate
      enum verification_status
    }
    products {
      bigint id PK
      bigint vendor_id FK
      bigint category_id FK
      varchar sku UK
      decimal price
      decimal discount_price
    }
    inventory {
      bigint id PK
      bigint product_id FK,UK
      int quantity
      int reserved_quantity
    }
    orders {
      bigint id PK
      bigint user_id FK
      enum status
      decimal total_amount
    }
    order_items {
      bigint id PK
      bigint order_id FK
      bigint product_id FK
      bigint vendor_id FK
      int quantity
      decimal price_at_purchase
      enum item_status
    }
    payments {
      bigint id PK
      bigint order_id FK,UK
      decimal amount
      enum payment_status
      varchar transaction_ref UK
    }
    vendor_payouts {
      bigint id PK
      bigint vendor_id FK
      bigint order_item_id FK,UK
      decimal amount
      enum payout_status
    }
```

## Key modeling decisions
- **`vendors` is a 1:1 extension of `users`** (not a subtype table dump) — role lives on `users`,
  vendor-only attributes live on `vendors`. Enforced by `uq_vendors_user`.
- **`order_items.vendor_id` is denormalized** from `products.vendor_id` so a vendor's sub-order is a
  cheap indexed lookup (`idx_oi_vendor_status`) and payouts survive later product re-assignment.
- **`inventory` split from `products`** keeps the hot, frequently-locked stock row narrow, reducing
  lock contention and buffer-pool churn during checkout.
- **`order_items.price_at_purchase`** freezes price — the only intentional denormalization, because an
  order is a legal record that must not change when the catalog price later changes.
