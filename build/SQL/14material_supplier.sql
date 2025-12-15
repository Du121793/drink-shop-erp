CREATE TABLE IF NOT EXISTS material_supplier (
  supplier_id INTEGER NOT NULL,
  bom_id      INTEGER NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE, -- 預設廠商？

  PRIMARY KEY (supplier_id, bom_id),

  CONSTRAINT fk_material_supplier_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES supplier (supplier_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_material_supplier_bom
    FOREIGN KEY (bom_id)
    REFERENCES bom (bom_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

-- 每個原料最多 1 個預設廠商（允許沒有預設）
CREATE UNIQUE INDEX IF NOT EXISTS uq_material_supplier_default_per_bom
ON material_supplier (bom_id)
WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_material_supplier_bom_id
ON material_supplier (bom_id);

CREATE INDEX IF NOT EXISTS idx_material_supplier_supplier_id
ON material_supplier (supplier_id);
