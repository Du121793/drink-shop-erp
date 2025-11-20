-- 03product.sql  （產品）
CREATE TABLE IF NOT EXISTS product (
    product_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE  -- 是否上架
);
