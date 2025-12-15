CREATE TABLE IF NOT EXISTS purchase_order_log (
  order_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id  INTEGER NOT NULL,                   -- 1 筆叫貨紀錄對 1 個廠商
  bom_id       INTEGER NOT NULL,                   -- 叫哪個原料
  order_qty    NUMERIC(10,2) NOT NULL,             -- 叫貨量
  order_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 叫貨時間

  order_status SMALLINT NOT NULL DEFAULT 0,        -- 左側新增欄位：0=已下單, 1=已到貨, 2=取消

  CONSTRAINT chk_purchase_order_qty_pos
    CHECK (order_qty > 0),

  CONSTRAINT chk_purchase_order_status
    CHECK (order_status IN (0,1,2)),

  -- 確保這個廠商「真的有供應」這個原料
  CONSTRAINT fk_purchase_order_material_supplier
    FOREIGN KEY (supplier_id, bom_id)
    REFERENCES material_supplier (supplier_id, bom_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_log_supplier_id
ON purchase_order_log (supplier_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_log_bom_id
ON purchase_order_log (bom_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_log_order_time
ON purchase_order_log (order_time);
