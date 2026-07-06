-- ============================================================================
-- Multi-Vendor E-Commerce Platform — MySQL 8.x DDL
-- Engine: InnoDB (transactions + row-level locking + FK enforcement)
-- Charset: utf8mb4 (full Unicode incl. emoji), collation utf8mb4_0900_ai_ci
-- Normal form: 3NF throughout; one justified denormalization (order_items.price_at_purchase)
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)    NOT NULL,
  email         VARCHAR(255)    NOT NULL,
  password_hash CHAR(60)        NOT NULL,             -- bcrypt output is fixed 60 chars
  role          ENUM('customer','vendor','admin') NOT NULL DEFAULT 'customer',
  phone         VARCHAR(20)     NULL,
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 2. vendors  (1:1 extension of a user with role='vendor')
-- ----------------------------------------------------------------------------
CREATE TABLE vendors (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id             BIGINT UNSIGNED NOT NULL,
  store_name          VARCHAR(160)    NOT NULL,
  gstin               VARCHAR(15)     NULL,
  verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  commission_rate     DECIMAL(5,4)    NOT NULL DEFAULT 0.1000  -- 0.1000 = 10%
                        CHECK (commission_rate >= 0 AND commission_rate < 1),
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vendors_user (user_id),
  UNIQUE KEY uq_vendors_gstin (gstin),
  KEY idx_vendors_status (verification_status),
  CONSTRAINT fk_vendors_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE      -- delete the vendor profile if the account is deleted
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 3. categories  (self-referencing tree)
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name               VARCHAR(120)    NOT NULL,
  parent_category_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name_parent (name, parent_category_id),
  KEY idx_categories_parent (parent_category_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_category_id) REFERENCES categories(id)
    ON DELETE SET NULL ON UPDATE CASCADE     -- deleting a parent promotes children to top level, no data loss
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 4. products
-- ----------------------------------------------------------------------------
CREATE TABLE products (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_id      BIGINT UNSIGNED NOT NULL,
  category_id    BIGINT UNSIGNED NULL,
  name           VARCHAR(200)    NOT NULL,
  description    TEXT            NULL,
  price          DECIMAL(10,2)   NOT NULL CHECK (price >= 0),
  discount_price DECIMAL(10,2)   NULL     CHECK (discount_price >= 0),
  sku            VARCHAR(64)     NOT NULL,
  is_active      BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_vendor (vendor_id),
  -- composite index for filtered browsing "category page sorted by price"
  KEY idx_products_category_price (category_id, price),
  CONSTRAINT fk_products_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    ON DELETE CASCADE ON UPDATE CASCADE,     -- a vendor leaving takes their catalog with them
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE SET NULL ON UPDATE CASCADE,    -- product survives a deleted category (becomes uncategorized)
  CONSTRAINT chk_discount_lt_price CHECK (discount_price IS NULL OR discount_price <= price),
  FULLTEXT KEY ft_products_search (name, description)   -- MySQL InnoDB full-text search
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 5. product_images
-- ----------------------------------------------------------------------------
CREATE TABLE product_images (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  image_url  VARCHAR(500)    NOT NULL,
  is_primary BOOLEAN         NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  KEY idx_images_product (product_id),
  CONSTRAINT fk_images_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- NOTE: "exactly one primary image per product" is enforced in the service layer,
-- since MySQL cannot express a partial unique index (unlike Postgres).

-- ----------------------------------------------------------------------------
-- 6. inventory  (1:1 with product; separated so hot stock rows are small & lock-friendly)
-- ----------------------------------------------------------------------------
CREATE TABLE inventory (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id          BIGINT UNSIGNED NOT NULL,
  quantity            INT             NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity   INT             NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  low_stock_threshold INT             NOT NULL DEFAULT 10,
  warehouse_location  VARCHAR(120)    NULL,
  updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_product (product_id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_reserved_le_qty CHECK (reserved_quantity <= quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 7. addresses  (declared before orders because orders FKs to it)
-- ----------------------------------------------------------------------------
CREATE TABLE addresses (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  address_line VARCHAR(255)    NOT NULL,
  city         VARCHAR(100)    NOT NULL,
  state        VARCHAR(100)    NOT NULL,
  pincode      VARCHAR(12)     NOT NULL,
  is_default   BOOLEAN         NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  KEY idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 8. carts + 9. cart_items
-- ----------------------------------------------------------------------------
CREATE TABLE carts (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_carts_user (user_id),          -- one active cart per user
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cart_items (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_id    BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity   INT             NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_product (cart_id, product_id),   -- same product = update qty, not a 2nd row
  KEY idx_cart_items_product (product_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 10. orders + 11. order_items
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id             BIGINT UNSIGNED NOT NULL,
  status              ENUM('pending','confirmed','shipped','delivered','cancelled','refunded')
                        NOT NULL DEFAULT 'pending',
  total_amount        DECIMAL(12,2)   NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  shipping_address_id BIGINT UNSIGNED NULL,
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_user_created (user_id, created_at),   -- "my orders, newest first"
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,   -- never lose financial history by deleting a user
  CONSTRAINT fk_orders_address FOREIGN KEY (shipping_address_id) REFERENCES addresses(id)
    ON DELETE SET NULL ON UPDATE CASCADE    -- keep the order if the address book entry is removed
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- order_items: the vendor-split sub-order line. Each row belongs to exactly one vendor,
-- so a multi-vendor order is just its set of order_items grouped by vendor_id.
CREATE TABLE order_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id          BIGINT UNSIGNED NOT NULL,
  product_id        BIGINT UNSIGNED NOT NULL,
  vendor_id         BIGINT UNSIGNED NOT NULL,   -- denormalized from product for vendor-scoped queries & payout
  quantity          INT             NOT NULL CHECK (quantity > 0),
  price_at_purchase DECIMAL(10,2)   NOT NULL,   -- JUSTIFIED DENORMALIZATION: freeze price at checkout time
  item_status       ENUM('pending','confirmed','shipped','delivered','cancelled','refunded')
                        NOT NULL DEFAULT 'pending',
  PRIMARY KEY (id),
  KEY idx_oi_order (order_id),
  KEY idx_oi_vendor_status (vendor_id, item_status),  -- vendor dashboard: "my unshipped items"
  KEY idx_oi_product (product_id),
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,   -- a sold product cannot be hard-deleted; deactivate instead
  CONSTRAINT fk_oi_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 12. payments  (1:1 with order in this design; extendable to N for split/retry)
-- ----------------------------------------------------------------------------
CREATE TABLE payments (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id       BIGINT UNSIGNED NOT NULL,
  amount         DECIMAL(12,2)   NOT NULL CHECK (amount >= 0),
  payment_method VARCHAR(40)     NOT NULL,
  payment_status ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  transaction_ref VARCHAR(120)   NULL,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_order (order_id),
  UNIQUE KEY uq_payments_txnref (transaction_ref),  -- idempotency: gateway ref is unique => no double-capture
  KEY idx_payments_status (payment_status),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 13. reviews  (only one review per user per product)
-- ----------------------------------------------------------------------------
CREATE TABLE reviews (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  rating     TINYINT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT            NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_user_product (product_id, user_id),
  KEY idx_reviews_product (product_id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 14. coupons
-- ----------------------------------------------------------------------------
CREATE TABLE coupons (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code            VARCHAR(40)     NOT NULL,
  discount_type   ENUM('percent','flat') NOT NULL,
  discount_value  DECIMAL(10,2)   NOT NULL CHECK (discount_value >= 0),
  min_order_value DECIMAL(10,2)   NOT NULL DEFAULT 0,
  valid_from      DATETIME        NOT NULL,
  valid_until     DATETIME        NOT NULL,
  usage_limit     INT             NULL,             -- NULL = unlimited
  times_used      INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coupons_code (code),
  CONSTRAINT chk_coupon_window CHECK (valid_until > valid_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 15. wishlist
-- ----------------------------------------------------------------------------
CREATE TABLE wishlist (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wishlist_user_product (user_id, product_id),
  KEY idx_wishlist_product (product_id),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 16. vendor_payouts  (commission settlement per sold line item)
-- ----------------------------------------------------------------------------
CREATE TABLE vendor_payouts (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_id     BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  amount        DECIMAL(12,2)   NOT NULL CHECK (amount >= 0),
  payout_status ENUM('pending','processing','paid','failed') NOT NULL DEFAULT 'pending',
  payout_date   DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payout_order_item (order_item_id),   -- one payout row per sold line (no double payout)
  KEY idx_payouts_vendor_status (vendor_id, payout_status),
  CONSTRAINT fk_payouts_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payouts_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- refresh_tokens  (hashed, revocable — supports the JWT refresh pattern)
-- ----------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64)        NOT NULL,     -- SHA-256 hex of the refresh token; never store raw
  expires_at DATETIME        NOT NULL,
  revoked_at DATETIME        NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_hash (token_hash),
  KEY idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
