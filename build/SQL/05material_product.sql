-- 05material_product.sql  （原料-產品表）
CREATE TABLE IF NOT EXISTS material_product (
    ratio_id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bom_id                  INTEGER       NOT NULL,
    product_id              INTEGER       NOT NULL,
    material_used_quantity  NUMERIC(10,2) NOT NULL,  -- 原料使用量
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

CREATE INDEX idx_mp_bom_id      ON material_product (bom_id);
CREATE INDEX idx_mp_product_id  ON material_product (product_id);
