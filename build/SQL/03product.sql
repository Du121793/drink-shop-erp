-- 03product.sql
CREATE TABLE IF NOT EXISTS product (
product_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
product_name VARCHAR(100) NOT NULL,
price NUMERIC(10,2) NOT NULL DEFAULT 0, -- 價格
is_active BOOLEAN NOT NULL DEFAULT TRUE, -- 是否上架
CONSTRAINT chk_product_price_nonneg
CHECK (price >= 0)
);