-- 06material_product.sql  (原料-產品表)
-- 依圖：bom 1 -> M material_product，product 1 -> M material_product
CREATE TABLE IF NOT EXISTS material_product (
    bom_id              INTEGER NOT NULL,
    product_id          INTEGER NOT NULL,
    material_used_qty   NUMERIC(10,2) NOT NULL,   -- 原料使用量
    PRIMARY KEY (bom_id, product_id),
    CONSTRAINT fk_mp_bom
        FOREIGN KEY (bom_id)
        REFERENCES bom (bom_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_mp_product
        FOREIGN KEY (product_id)
        REFERENCES product (product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_mp_product_id
    ON material_product (product_id);
