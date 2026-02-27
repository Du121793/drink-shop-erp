-- 18_restock_rule.sql
-- 庫存動態計算規則與原料關聯
CREATE TABLE IF NOT EXISTS restock_rule (
  rule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  scope VARCHAR(20) NOT NULL DEFAULT 'global', -- global / material
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_restock_rule_scope
    CHECK (scope IN ('global', 'material'))
);

CREATE INDEX IF NOT EXISTS idx_restock_rule_priority
ON restock_rule (priority);

CREATE TABLE IF NOT EXISTS restock_rule_assignment (
  rule_id BIGINT NOT NULL,
  bom_id INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  override_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rule_id, bom_id),
  CONSTRAINT fk_restock_rule_assignment_rule
    FOREIGN KEY (rule_id)
    REFERENCES restock_rule (rule_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_restock_rule_assignment_bom
    FOREIGN KEY (bom_id)
    REFERENCES bom (bom_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_restock_rule_assignment_bom_id
ON restock_rule_assignment (bom_id);
