-- 07option_detail.sql  (選項細項)
CREATE TABLE IF NOT EXISTS option_detail (
    option_detail_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    option_id           INTEGER NOT NULL,          -- 選項_id
    bom_id              INTEGER NOT NULL,          -- bom_id
    option_detail_name  VARCHAR(100) NOT NULL,     -- 選項細項名稱
    material_qty        NUMERIC(10,2) NOT NULL,    -- 原料量
    CONSTRAINT fk_option_detail_option
        FOREIGN KEY (option_id)
        REFERENCES custom_option (option_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_option_detail_bom
        FOREIGN KEY (bom_id)
        REFERENCES bom (bom_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_option_detail_option_id
    ON option_detail (option_id);

CREATE INDEX IF NOT EXISTS idx_option_detail_bom_id
    ON option_detail (bom_id);
