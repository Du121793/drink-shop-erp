CREATE TABLE IF NOT EXISTS supplier_event_type (
  event_type_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_code           VARCHAR(50) NOT NULL,
  event_name           VARCHAR(100) NOT NULL,
  base_penalty         NUMERIC(10,2) NOT NULL DEFAULT 0,
  half_life_days       NUMERIC(10,2),
  repeat_window_days   INTEGER NOT NULL DEFAULT 30,
  repeat_growth        NUMERIC(10,4) NOT NULL DEFAULT 1,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_supplier_event_type_code UNIQUE (event_code)
);

CREATE TABLE IF NOT EXISTS supplier_event (
  event_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id     INTEGER NOT NULL,
  event_type_id   BIGINT NOT NULL,
  order_id        BIGINT,
  note            TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      VARCHAR(64),

  CONSTRAINT fk_supplier_event_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES supplier (supplier_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_supplier_event_type
    FOREIGN KEY (event_type_id)
    REFERENCES supplier_event_type (event_type_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_supplier_event_supplier_id
ON supplier_event (supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_event_event_type_id
ON supplier_event (event_type_id);

CREATE INDEX IF NOT EXISTS idx_supplier_event_occurred_at
ON supplier_event (occurred_at);

CREATE TABLE IF NOT EXISTS supplier_reputation_rule (
  rule_id                SMALLINT PRIMARY KEY DEFAULT 1,
  score_max              NUMERIC(10,2) NOT NULL DEFAULT 100,
  score_min              NUMERIC(10,2) NOT NULL DEFAULT 0,
  block_threshold        NUMERIC(10,2) NOT NULL DEFAULT 60,
  block_days             INTEGER NOT NULL DEFAULT 30,
  auto_block_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  default_lead_time_days INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS supplier_block (
  block_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id  INTEGER NOT NULL,
  blocked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  block_until  TIMESTAMPTZ NOT NULL,
  reason       TEXT,
  created_by   VARCHAR(64),

  CONSTRAINT fk_supplier_block_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES supplier (supplier_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_supplier_block_supplier_id
ON supplier_block (supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_block_block_until
ON supplier_block (block_until);

CREATE TABLE IF NOT EXISTS supplier_score_snapshot (
  snapshot_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id    INTEGER NOT NULL,
  score          NUMERIC(10,2) NOT NULL,
  calculated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_supplier_score_snapshot_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES supplier (supplier_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_supplier_score_snapshot_supplier_id
ON supplier_score_snapshot (supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_score_snapshot_calculated_at
ON supplier_score_snapshot (calculated_at);
