CREATE TABLE IF NOT EXISTS purchase_order_log (
  order_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id  INTEGER NOT NULL,                   -- 叫貨紀錄對應的供應商
  bom_id       INTEGER NOT NULL,                   -- 叫貨的原料 (BOM)
  order_qty    NUMERIC(10,2) NOT NULL,             -- 叫貨量
  order_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 叫貨時間

  order_status SMALLINT NOT NULL DEFAULT 0,        -- 0=已聯絡 1=已抵達 3=失敗

  CONSTRAINT chk_purchase_order_qty_pos
    CHECK (order_qty > 0),

  CONSTRAINT chk_purchase_order_status
    CHECK (order_status IN (0,1,3)),

  -- 確保供應商與原料關聯存在
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
