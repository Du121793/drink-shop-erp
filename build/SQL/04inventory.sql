-- 04inventory.sql  （進貨庫存表 / 原料庫存表）
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bom_id         INTEGER      NOT NULL,
    stock_in_time  TIMESTAMP    NOT NULL,          -- 入庫時間
    stock_quantity NUMERIC(10,2) NOT NULL,         -- 庫存量
    CONSTRAINT fk_inventory_bom
        FOREIGN KEY (bom_id)
        REFERENCES bom (bom_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_inventory_bom_id ON inventory (bom_id);
