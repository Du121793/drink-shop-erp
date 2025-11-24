-- 08product_option.sql  (產品-選項表)
-- 依圖：custom_option 1 -> M product_option，product 1 -> M product_option
CREATE TABLE IF NOT EXISTS product_option (
    product_id  INTEGER NOT NULL,
    option_id   INTEGER NOT NULL,
    PRIMARY KEY (product_id, option_id),
    CONSTRAINT fk_product_option_product
        FOREIGN KEY (product_id)
        REFERENCES product (product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_product_option_option
        FOREIGN KEY (option_id)
        REFERENCES custom_option (option_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_product_option_option_id
    ON product_option (option_id);
