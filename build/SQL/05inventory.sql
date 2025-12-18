-- 05inventory.sql  (進貨庫存表 / 原料庫存表)
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bom_id         INTEGER NOT NULL,
    stock_in_time  TIMESTAMP NOT NULL,          -- 入庫時間
    stock_in_qty   NUMERIC(10,2) NOT NULL,      -- 入庫量
    remaining_qty  NUMERIC(10,2) NOT NULL,      -- 剩餘量
    expiry_time    TIMESTAMP NOT NULL,          -- 過期時間（不可為空）

    CONSTRAINT fk_inventory_bom
        FOREIGN KEY (bom_id)
        REFERENCES bom (bom_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_remaining_valid
        CHECK (remaining_qty >= 0 AND remaining_qty <= stock_in_qty),

    CONSTRAINT chk_inventory_expiry_after_in
        CHECK (expiry_time >= stock_in_time)
);

CREATE INDEX IF NOT EXISTS idx_inventory_bom_id
    ON inventory (bom_id);
