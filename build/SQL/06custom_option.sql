-- 06custom_option.sql  （客製化選項）
CREATE TABLE IF NOT EXISTS custom_option (
    option_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id        INTEGER       NOT NULL,
    bom_id            INTEGER       NOT NULL,
    option_name       VARCHAR(100)  NOT NULL,
    material_quantity NUMERIC(10,2) NOT NULL,  -- 原料量
    CONSTRAINT fk_custom_option_product
        FOREIGN KEY (product_id)
        REFERENCES product (product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_custom_option_bom
        FOREIGN KEY (bom_id)
        REFERENCES bom (bom_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_custom_option_product_id ON custom_option (product_id);
CREATE INDEX idx_custom_option_bom_id     ON custom_option (bom_id);
