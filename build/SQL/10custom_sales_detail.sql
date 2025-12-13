-- 10custom_sales_detail.sql (客製化銷售明細)
CREATE TABLE IF NOT EXISTS custom_sales_detail (
custom_sales_detail_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
option_detail_id INTEGER NOT NULL, -- 選項細項\_id
detail_id INTEGER NOT NULL, -- 明細\_id
CONSTRAINT fk_csd_option_detail
FOREIGN KEY (option_detail_id)
REFERENCES option_detail (option_detail_id)
ON UPDATE CASCADE
ON DELETE RESTRICT,
CONSTRAINT fk_csd_sales_detail
FOREIGN KEY (detail_id)
REFERENCES sales_detail (detail_id)
ON UPDATE CASCADE
ON DELETE CASCADE,
CONSTRAINT uq_csd_detail_option_detail UNIQUE (detail_id, option_detail_id)
);

CREATE INDEX IF NOT EXISTS idx_csd_detail_id
ON custom_sales_detail (detail_id);

CREATE INDEX IF NOT EXISTS idx_csd_option_detail_id
ON custom_sales_detail (option_detail_id);