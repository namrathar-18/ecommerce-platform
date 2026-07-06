# Viva / Evaluation Prep — Questions & Defensible Answers

The questions faculty ask for a DB-heavy multi-vendor project, with the answer this design supports.

### 1. "Why REPEATABLE READ and not SERIALIZABLE for checkout?"
InnoDB's default is REPEATABLE READ. For checkout I don't rely on the isolation level alone — I take
explicit exclusive locks with `SELECT … FOR UPDATE` on exactly the `inventory` rows I mutate. That
serializes the read-modify-write on those rows where it matters. SERIALIZABLE would add range/gap
locks on read-only rows too, tanking concurrency for no correctness gain here. So: RR + targeted
`FOR UPDATE` = correctness where needed, throughput everywhere else.

### 2. "How do you prevent overselling the last unit under concurrency?"
Pessimistic: `SELECT … FOR UPDATE` locks the inventory row; the second transaction blocks until the
first commits, then re-reads the now-decremented value and fails the availability check → rollback.
Optimistic alternative: `UPDATE … WHERE quantity - reserved_quantity >= :qty` and check `ROW_COUNT()=1`.
I use pessimistic for multi-item carts (avoids retry storms) and mention optimistic for hot single-SKU
flash sales. I lock rows in a deterministic order (`ORDER BY product_id`) to prevent deadlocks.

### 3. "How do you avoid double payment / double order on a refresh or retried webhook?"
Two idempotency layers: (a) `payments.transaction_ref` is UNIQUE, so a replayed gateway webhook with
the same ref cannot insert/capture twice. (b) The checkout writes a single pending payment per order
(`uq_payments_order`). Client retries hit the same order in `pending`, not a new one. Webhook handler
verifies the gateway HMAC signature before acting.

### 4. "Why is `price_at_purchase` stored on order_items — isn't that denormalization?"
Yes, deliberately. An order is a financial/legal record. If I joined to `products.price` at read time,
a later price change would silently rewrite past order totals. Freezing the price at checkout is the
one justified denormalization; everything else is 3NF.

### 5. "How does one order span multiple vendors, and how does each vendor see only theirs?"
An order is one `orders` row plus N `order_items`, each carrying `vendor_id`. A vendor's sub-order is
simply `WHERE vendor_id = :me`, served by `idx_oi_vendor_status`. Each line has its own `item_status`,
so vendor A can ship while vendor B hasn't. The customer's unified view re-joins all items by `order_id`.

### 6. "Justify your ON DELETE behaviors."
- CASCADE where the child is meaningless without the parent (cart_items↔cart, images↔product, vendor↔user).
- RESTRICT on financial history (orders.user_id, order_items.product_id, payouts) — never destroy records.
- SET NULL where the child survives (products.category_id, orders.shipping_address_id) — no data loss,
  no orphan FK.

### 7. "Which indexes did you add and why?"
`(category_id, price)` composite for filtered category browsing sorted by price; `(vendor_id, item_status)`
for the vendor dashboard; `(user_id, created_at)` for "my orders newest first"; UNIQUE on email, sku,
transaction_ref, (product_id,user_id) for reviews; FULLTEXT on products(name,description) for search.
I can show `EXPLAIN` proving the composite index is used and avoids a filesort.

### 8. "How would this scale to 1M products / high traffic?"
- Reads: Redis cache for product detail + cart; read replicas for analytics; the co-occurrence matrix is
  precomputed nightly into `product_affinity` instead of a live self-join.
- Writes: inventory row is narrow and separately locked to minimize contention; consider per-SKU
  sharding or a reservation queue for flash sales.
- Pagination is cursor-based (keyset), so page 10000 costs the same as page 1.
- Search: MySQL FULLTEXT is fine to ~low millions; beyond that move to Elasticsearch (my stretch goal).

### 9. "Cursor vs offset pagination — why?"
`OFFSET n` scans and discards n rows — cost grows with depth and results shift when rows are inserted.
Keyset (`WHERE id < :cursor ORDER BY id DESC LIMIT k`) uses the index directly: O(k) regardless of depth,
stable under concurrent inserts.

### 10. "How are passwords and tokens secured?"
Passwords: bcrypt cost 12 (adaptive, salted). Access JWT: 15-min lifetime, signed. Refresh token: 7-day,
stored only as a SHA-256 hash (`refresh_tokens.token_hash`), revocable, rotated on every use (steal-detection).
All queries parameterized (no string concat) → no SQL injection. Helmet + CORS + rate limiting on auth.

### 11. "Where could a race condition still bite you, and how do you test it?"
Between reserving stock at checkout and confirming payment — if payment never completes, reservation must
be released (timeout job) or stock leaks. I test with a concurrency harness firing N simultaneous
checkouts of a 1-unit SKU and assert exactly one succeeds and `quantity` never goes negative (the CHECK
constraint is the last line of defense).

### 12. "Optimistic vs pessimistic locking — when each?"
Pessimistic (`FOR UPDATE`): high contention, multi-row atomic updates (checkout). Costs blocking.
Optimistic (version/conditional update + retry): low contention, short transactions (single-SKU update).
Costs retries under contention. I chose pessimistic for the core checkout and note the tradeoff.
