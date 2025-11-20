-- 08custom_sales_detail.sql  （客製化銷售明細）
CREATE TABLE IF NOT EXISTS custom_sales_detail (
    custom_sales_detail_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    option_id              INTEGER NOT NULL,
    detail_id              INTEGER NOT NULL,
    CONSTRAINT fk_csd_option
        FOREIGN KEY (option_id)
        REFERENCES custom_option (option_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_csd_detail
        FOREIGN KEY (detail_id)
        REFERENCES sales_detail (detail_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT uq_csd_detail_option UNIQUE (detail_id, option_id)
);

CREATE INDEX idx_csd_option_id ON custom_sales_detail (option_id);
CREATE INDEX idx_csd_detail_id ON custom_sales_detail (detail_id);