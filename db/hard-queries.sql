-- ============================================================================
-- THE 5 HARDEST QUERIES  — raw SQL, heavily commented for viva defense
-- ============================================================================


-- ############################################################################
-- (1) ATOMIC CHECKOUT TRANSACTION  — concurrency-safe stock decrement
-- ############################################################################
-- Goal: convert a cart into an order without overselling, even under concurrent
-- checkouts of the last unit. Uses pessimistic row locks (SELECT ... FOR UPDATE).
--
-- Isolation: run at REPEATABLE READ (InnoDB default). It is sufficient here
-- because FOR UPDATE takes exclusive next-key locks on the inventory rows we
-- touch, serializing the read-modify-write on exactly those rows. We do NOT
-- need SERIALIZABLE (which would lock read-only rows too and kill throughput);
-- the explicit FOR UPDATE gives us the serialization we need where we need it.
--
-- This is pseudocode-in-SQL; the service layer loops the cart items in app code
-- inside the same DB transaction/connection.

START TRANSACTION;

-- Step A: lock every inventory row this cart touches, in a deterministic order
--         (ORDER BY product_id) to avoid deadlocks between concurrent carts.
SELECT i.product_id, i.quantity, i.reserved_quantity, p.price, p.discount_price, p.vendor_id
FROM   inventory i
JOIN   products  p ON p.id = i.product_id
JOIN   cart_items ci ON ci.product_id = i.product_id
WHERE  ci.cart_id = :cart_id
ORDER  BY i.product_id
FOR UPDATE;                       -- <-- exclusive lock held until COMMIT/ROLLBACK

-- Step B (app-side guard): for each row, assert (quantity - reserved_quantity) >= requested.
--         If any item fails, ROLLBACK and return 409 Conflict. No partial order is ever visible.

-- Step C: create the order shell.
INSERT INTO orders (user_id, status, total_amount, shipping_address_id)
VALUES (:user_id, 'pending', 0, :address_id);
SET @order_id = LAST_INSERT_ID();

-- Step D: fan out cart -> order_items, freezing the effective price at purchase time.
INSERT INTO order_items (order_id, product_id, vendor_id, quantity, price_at_purchase, item_status)
SELECT @order_id, ci.product_id, p.vendor_id, ci.quantity,
       COALESCE(p.discount_price, p.price),        -- price freeze (denormalization rationale)
       'pending'
FROM   cart_items ci
JOIN   products p ON p.id = ci.product_id
WHERE  ci.cart_id = :cart_id;

-- Step E: move stock from available -> reserved (safe: rows are locked from Step A).
UPDATE inventory i
JOIN   cart_items ci ON ci.product_id = i.product_id
SET    i.reserved_quantity = i.reserved_quantity + ci.quantity
WHERE  ci.cart_id = :cart_id;

-- Step F: compute and persist the authoritative total from the just-inserted lines.
UPDATE orders o
SET    o.total_amount = (
         SELECT SUM(oi.price_at_purchase * oi.quantity)
         FROM   order_items oi WHERE oi.order_id = @order_id)
WHERE  o.id = @order_id;

-- Step G: create the pending payment row (idempotency enforced by uq_payments_txnref later).
INSERT INTO payments (order_id, amount, payment_method, payment_status)
SELECT @order_id, o.total_amount, :method, 'pending'
FROM   orders o WHERE o.id = @order_id;

-- Step H: clear the cart.
DELETE FROM cart_items WHERE cart_id = :cart_id;

COMMIT;
-- On payment webhook 'success': UPDATE inventory SET quantity = quantity - reserved delta,
-- reserved_quantity = reserved_quantity - delta; flip order/payment status. On 'failed' or
-- timeout: release the reservation (reserved_quantity -= delta) and cancel the order.


-- ############################################################################
-- (2) CONCURRENCY-SAFE SINGLE-ITEM STOCK DECREMENT  (optimistic alternative)
-- ############################################################################
-- Shows the OPTIMISTIC counterpart to the pessimistic lock above. No FOR UPDATE;
-- instead the WHERE clause guarantees we only decrement if stock is still there.
-- Success is detected by ROW_COUNT() = 1. Cheaper under low contention.
UPDATE inventory
SET    reserved_quantity = reserved_quantity + :qty
WHERE  product_id = :product_id
  AND  quantity - reserved_quantity >= :qty;    -- atomic check-and-set; 0 rows => out of stock
-- Recommendation: use PESSIMISTIC (query 1) for multi-item checkout to avoid
-- retry storms; use this OPTIMISTIC form for hot single-SKU flash-sale drops.


-- ############################################################################
-- (3) REVENUE BY CATEGORY WITH MONTH-OVER-MONTH GROWTH %  (LAG window function)
-- ############################################################################
WITH monthly AS (
  SELECT
    c.id                                         AS category_id,
    c.name                                       AS category_name,
    DATE_FORMAT(o.created_at, '%Y-%m-01')        AS month,
    SUM(oi.price_at_purchase * oi.quantity)      AS revenue
  FROM order_items oi
  JOIN orders   o ON o.id = oi.order_id
                 AND o.status IN ('delivered','shipped','confirmed')  -- realized revenue only
  JOIN products p ON p.id = oi.product_id
  JOIN categories c ON c.id = p.category_id
  GROUP BY c.id, c.name, DATE_FORMAT(o.created_at, '%Y-%m-01')
)
SELECT
  category_name,
  month,
  revenue,
  LAG(revenue) OVER (PARTITION BY category_id ORDER BY month) AS prev_month_revenue,
  ROUND(
    (revenue - LAG(revenue) OVER (PARTITION BY category_id ORDER BY month))
    / NULLIF(LAG(revenue) OVER (PARTITION BY category_id ORDER BY month), 0) * 100,
  2) AS mom_growth_pct                            -- NULLIF guards divide-by-zero for first month
FROM monthly
ORDER BY category_name, month;


-- ############################################################################
-- (4) RECOMMENDATION — "customers who bought X also bought Y" (co-occurrence)
-- ############################################################################
-- Item-based collaborative filtering via a self-join on order_items, counting
-- how often product :seed and every other product appear in the SAME order.
SELECT
  b.product_id                          AS recommended_product_id,
  p.name                                AS recommended_name,
  COUNT(DISTINCT a.order_id)            AS co_purchase_count
FROM order_items a
JOIN order_items b
  ON a.order_id = b.order_id            -- same basket
 AND b.product_id <> a.product_id       -- a different product
JOIN products p ON p.id = b.product_id
WHERE a.product_id = :seed_product_id
  AND p.is_active = TRUE
GROUP BY b.product_id, p.name
ORDER BY co_purchase_count DESC, b.product_id
LIMIT 10;
-- Scaling note: this is O(orders_containing_seed). At scale, precompute the full
-- item-item co-occurrence matrix nightly into a `product_affinity(a_id,b_id,score)`
-- table and serve reads from it. The Python/`surprise` variant swaps raw counts
-- for cosine-similarity / ALS latent factors on the same order-history matrix.


-- ############################################################################
-- (5) VENDOR PERFORMANCE LEADERBOARD  (multi-aggregate join + fulfillment time)
-- ############################################################################
SELECT
  v.id                                              AS vendor_id,
  v.store_name,
  COALESCE(sales.total_revenue, 0)                  AS total_revenue,
  COALESCE(sales.items_sold, 0)                     AS items_sold,
  ROUND(rev.avg_rating, 2)                          AS avg_rating,
  sales.avg_fulfillment_hours,
  RANK() OVER (ORDER BY COALESCE(sales.total_revenue,0) DESC) AS revenue_rank
FROM vendors v
LEFT JOIN (
  -- realized sales + how long, on average, from order placed to item delivered
  SELECT
    oi.vendor_id,
    SUM(oi.price_at_purchase * oi.quantity)                       AS total_revenue,
    SUM(oi.quantity)                                             AS items_sold,
    AVG(TIMESTAMPDIFF(HOUR, o.created_at, o.updated_at))          AS avg_fulfillment_hours
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.item_status = 'delivered'
  GROUP BY oi.vendor_id
) sales ON sales.vendor_id = v.id
LEFT JOIN (
  -- average rating across all of a vendor's products
  SELECT p.vendor_id, AVG(r.rating) AS avg_rating
  FROM reviews r
  JOIN products p ON p.id = r.product_id
  GROUP BY p.vendor_id
) rev ON rev.vendor_id = v.id
WHERE v.verification_status = 'verified'
ORDER BY revenue_rank;
