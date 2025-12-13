-- 09sales_detail.sql (銷量明細表)
CREATE TABLE IF NOT EXISTS sales_detail (
detail_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
product_id INTEGER NOT NULL,
sale_time TIMESTAMP NOT NULL, -- 銷售時間
status BOOLEAN NOT NULL DEFAULT FALSE,
CONSTRAINT fk_sales_detail_product
FOREIGN KEY (product_id)
REFERENCES product (product_id)
ON UPDATE CASCADE
ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_detail_product_id
ON sales_detail (product_id);