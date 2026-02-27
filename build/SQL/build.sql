DROP TABLE IF EXISTS
  restock_rule_assignment,
  restock_rule,
  supplier_event_type,
  supplier_event,
  supplier_reputation_rule,
  supplier_block,
  supplier_score_snapshot,
  purchase_order_log,
  material_supplier,
  supplier,
  custom_sales_detail,
  sales_detail,
  product_option,
  option_detail,
  material_product,
  inventory_consumption_log,
  inventory,
  custom_option,
  product,
  employee_role,
  role,
  employee,
  bom
CASCADE;

-- 02bom.sql
CREATE TABLE IF NOT EXISTS bom (
  bom_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  material_name VARCHAR(100) NOT NULL,
  shelf_life_days INTEGER,          -- 保存時間(天)
  max_stock_qty NUMERIC(10,2),      -- 庫存最大值
  CONSTRAINT chk_bom_max_stock_nonneg
    CHECK (max_stock_qty IS NULL OR max_stock_qty >= 0)
);

-- 03product.sql
CREATE TABLE IF NOT EXISTS product (
  product_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_name VARCHAR(100) NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0, -- 價格
  is_active BOOLEAN NOT NULL DEFAULT TRUE, -- 是否上架
  CONSTRAINT chk_product_price_nonneg
    CHECK (price >= 0)
);

-- 04custom_option.sql (客製化選項)
CREATE TABLE IF NOT EXISTS custom_option (
  option_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  option_name VARCHAR(100) NOT NULL -- 選項名稱
);

-- 05inventory.sql (進貨庫存表 / 原料庫存表)
CREATE TABLE IF NOT EXISTS inventory (
  inventory_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bom_id INTEGER NOT NULL,
  stock_in_time TIMESTAMP NOT NULL, -- 入庫時間
  stock_in_qty NUMERIC(10,2) NOT NULL, -- 入庫量
  remaining_qty NUMERIC(10,2) NOT NULL, -- 剩餘量
  expiry_time TIMESTAMP NOT NULL, -- 過期時間（不可為空）

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

-- 06material_product.sql (原料-產品表)
CREATE TABLE IF NOT EXISTS material_product (
  bom_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  material_used_qty NUMERIC(10,2) NOT NULL, -- 原料使用量
  PRIMARY KEY (bom_id, product_id),
  CONSTRAINT fk_mp_bom
    FOREIGN KEY (bom_id)
    REFERENCES bom (bom_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_mp_product
    FOREIGN KEY (product_id)
    REFERENCES product (product_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_mp_product_id
ON material_product (product_id);

-- 07option_detail.sql
CREATE TABLE IF NOT EXISTS option_detail (
  option_detail_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  option_id INTEGER NOT NULL, -- option_id
  bom_id INTEGER NOT NULL, -- bom_id
  option_detail_name VARCHAR(100) NOT NULL, -- 選項細項名稱
  material_qty NUMERIC(10,2) NOT NULL, -- 原料量
  extra_price NUMERIC(10,2) NOT NULL DEFAULT 0, -- 加價
  CONSTRAINT fk_option_detail_option
    FOREIGN KEY (option_id)
    REFERENCES custom_option (option_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_option_detail_bom
    FOREIGN KEY (bom_id)
    REFERENCES bom (bom_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT chk_option_detail_extra_price_nonneg
    CHECK (extra_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_option_detail_option_id
ON option_detail (option_id);

CREATE INDEX IF NOT EXISTS idx_option_detail_bom_id
ON option_detail (bom_id);

-- 08product_option.sql (產品-選項表)
CREATE TABLE IF NOT EXISTS product_option (
  product_id INTEGER NOT NULL,
  option_id INTEGER NOT NULL,
  PRIMARY KEY (product_id, option_id),
  CONSTRAINT fk_product_option_product
    FOREIGN KEY (product_id)
    REFERENCES product (product_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_product_option_option
    FOREIGN KEY (option_id)
    REFERENCES custom_option (option_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_product_option_option_id
ON product_option (option_id);

-- 09sales_detail.sql (銷量明細表)
CREATE TABLE IF NOT EXISTS sales_detail (
  detail_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id INTEGER NOT NULL,
  sale_time TIMESTAMP NOT NULL, -- 銷售時間
  status BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_sales_detail_product
    FOREIGN KEY (product_id)
    REFERENCES product (product_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_detail_product_id
ON sales_detail (product_id);

-- 10custom_sales_detail.sql (客製化銷售明細)
CREATE TABLE IF NOT EXISTS custom_sales_detail (
  custom_sales_detail_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  option_detail_id INTEGER NOT NULL, -- 選項細項_id
  detail_id INTEGER NOT NULL, -- 明細_id
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

-- 11_inventory_consumption_log.sql
CREATE TABLE inventory_consumption_log (
  log_id SERIAL PRIMARY KEY,
  bom_id INT NOT NULL REFERENCES bom(bom_id),
  quantity_consumed DECIMAL(10, 2) NOT NULL,
  consumption_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reason VARCHAR(255) NOT NULL
);


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
-- 01_employee.sql
CREATE TABLE IF NOT EXISTS employee (
  line_id        VARCHAR(64) PRIMARY KEY,
  employee_name  VARCHAR(100),                        -- 員工名稱（預設 line 名稱，可修改）
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 加入時間
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- 修改時間
);

-- 02_role.sql  (身分表)
CREATE TABLE IF NOT EXISTS role (
  role_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- 身分_id
  role_name        VARCHAR(100) NOT NULL,                           -- 職位名稱
  permission_level SMALLINT NOT NULL DEFAULT 0,                     -- 權限等級
  CONSTRAINT uq_role_name UNIQUE (role_name),
  CONSTRAINT chk_permission_level_nonneg CHECK (permission_level >= 0)
);

-- 03_employee_role.sql  (員工-身分表)
CREATE TABLE IF NOT EXISTS employee_role (
  line_id   VARCHAR(64) NOT NULL,
  role_id   BIGINT NOT NULL,
  PRIMARY KEY (line_id, role_id),
  CONSTRAINT fk_employee_role_employee
    FOREIGN KEY (line_id) REFERENCES employee(line_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_employee_role_role
    FOREIGN KEY (role_id) REFERENCES role(role_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_employee_role_line_id ON employee_role(line_id);
CREATE INDEX IF NOT EXISTS idx_employee_role_role_id ON employee_role(role_id);

-- 13_supplier.sql（原料廠商聯絡表）
CREATE TABLE IF NOT EXISTS supplier (
  supplier_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_name VARCHAR(100) NOT NULL,
  email         VARCHAR(254),  -- 可為 NULL（也可以和 phone 都為空）
  phone         VARCHAR(30),   -- 可為 NULL（也可以和 email 都為空）
  CONSTRAINT uq_supplier_name UNIQUE (supplier_name)
);


-- 14_material_supplier.sql（原料-廠商表）
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

CREATE TABLE IF NOT EXISTS purchase_order_log (
  order_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id  INTEGER NOT NULL,                   -- 1 筆叫貨紀錄對 1 個廠商
  bom_id       INTEGER NOT NULL,                   -- 叫哪個原料
  order_qty    NUMERIC(10,2) NOT NULL,             -- 叫貨量
  order_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 叫貨時間

    order_status SMALLINT NOT NULL DEFAULT 0,        -- 0=已聯絡 1=已抵達 3=失敗

  CONSTRAINT chk_purchase_order_qty_pos
    CHECK (order_qty > 0),

    CONSTRAINT chk_purchase_order_status
      CHECK (order_status IN (0,1,3)),

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

-- Example product inserts
INSERT INTO product (product_name, price, is_active) VALUES
('泰式熱情泰國奶茶', 65, TRUE),
('草莓優格冰沙', 75, TRUE),
('開心果烏龍奶蓋飲', 80, TRUE),
('冬瓜檸檬加粉紅珍珠', 55, TRUE),
('黑糖粉紅珍珠厚奶', 70, TRUE),
('芋頭綠奶茶', 60, TRUE);

-- Step 1: Insert raw materials into bom
-- 這裡把 max_stock_qty 設為「不超過範例庫存最大值(500)」：全部=500
INSERT INTO bom (material_name, shelf_life_days, max_stock_qty) VALUES
('泰式紅茶葉', 180, 500),
('煉乳', 90, 500),
('牛奶', 15, 500),
('草莓', 7, 500),
('優格', 20, 500),
('冰塊', 365, 500),
('烏龍茶', 180, 500),
('開心果', 120, 500),
('奶蓋粉', 90, 500),
('冬瓜茶磚', 200, 500),
('檸檬', 10, 500),
('粉紅珍珠', 1, 500),
('黑糖', 365, 500),
('芋頭', 5, 500),
('綠茶', 180, 500);

INSERT INTO bom (material_name, shelf_life_days, max_stock_qty) VALUES
('方糖', 365, 500),
('芋圓', 30, 500);

-- Step 3: Link products to their materials (material_product)
INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(1, 1, 10),
(1, 2, 5);

INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(2, 4, 50),
(2, 5, 20),
(2, 6, 30);

INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(3, 7, 10),
(3, 8, 5),
(3, 9, 15),
(3, 3, 20);

INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(4, 10, 20),
(4, 11, 5),
(4, 12, 15);

INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(5, 13, 10),
(5, 12, 15),
(5, 3, 50);

INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(6, 14, 25),
(6, 15, 10),
(6, 3, 40);

-- Step 4: Add initial inventory for all materials（含過期時間）
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty, expiry_time) VALUES
(1, NOW(), 500, 500, NOW() + INTERVAL '180 days'),  -- 泰式紅茶葉
(2, NOW(), 500, 500, NOW() + INTERVAL '180 days'),  -- 煉乳
(3, NOW(), 500, 500, NOW() + INTERVAL '90 days'),   -- 牛奶
(4, NOW(), 500, 500, NOW() + INTERVAL '5 days'),    -- 草莓（近效期）
(5, NOW(), 500, 500, NOW() + INTERVAL '20 days'),   -- 優格
(6, NOW(), 500, 500, NOW() + INTERVAL '365 days'),  -- 冰塊
(7, NOW(), 500, 500, NOW() + INTERVAL '120 days'),  -- 烏龍茶
(8, NOW(), 500, 500, NOW() + INTERVAL '3 days'),    -- 開心果（近效期）
(9, NOW(), 500, 500, NOW() + INTERVAL '90 days'),   -- 奶蓋粉
(10, NOW(), 500, 500, NOW() + INTERVAL '60 days'),  -- 冬瓜茶磚
(11, NOW(), 500, 500, NOW() + INTERVAL '30 days'),  -- 檸檬
(12, NOW(), 500, 500, NOW() + INTERVAL '7 days'),   -- 粉紅珍珠（近效期）
(13, NOW(), 500, 500, NOW() + INTERVAL '200 days'), -- 黑糖
(14, NOW(), 500, 500, NOW() + INTERVAL '45 days'),  -- 芋頭
(15, NOW(), 500, 500, NOW() + INTERVAL '150 days'), -- 綠茶
(16, NOW(), 500, 500, NOW() + INTERVAL '365 days'), -- 方糖
(17, NOW(), 500, 500, NOW() + INTERVAL '25 days');  -- 芋圓

-- Step 1: Define the generic custom options
INSERT INTO custom_option (option_name) VALUES
('糖度'), -- option_id = 1
('冰量'), -- option_id = 2
('加料'); -- option_id = 3

-- Step 2: Define the details for each option
INSERT INTO option_detail (option_id, bom_id, option_detail_name, material_qty, extra_price) VALUES
(1, 16, '無糖', 0, 0),
(1, 16, '微糖', 5, 0),
(1, 16, '正常甜', 10, 0),
(1, 16, '多糖', 15, 0);

INSERT INTO option_detail (option_id, bom_id, option_detail_name, material_qty, extra_price) VALUES
(2, 6, '去冰', 0, 0),
(2, 6, '微冰', 10, 0),
(2, 6, '正常冰', 20, 0);

INSERT INTO option_detail (option_id, bom_id, option_detail_name, material_qty, extra_price) VALUES
(3, 9, '加奶蓋', 15, 15),
(3, 17, '加芋圓', 20, 10);

-- Step 3: Map the options to the relevant products
INSERT INTO product_option (product_id, option_id) VALUES
(1, 1),
(2, 1),
(3, 1),
(4, 1),
(5, 1),
(6, 1);

INSERT INTO product_option (product_id, option_id) VALUES
(1, 2),
(3, 2),
(4, 2),
(5, 2),
(6, 2);

INSERT INTO product_option (product_id, option_id) VALUES
(1, 3),
(2, 3),
(3, 3),
(4, 3);

-- n 筆廠商（supplier）
INSERT INTO supplier (supplier_name, email, phone)
SELECT
  '廠商' || gs,
  'vendor' || gs || '@example.com',
  '09' || lpad((gs * 1234567 % 100000000)::text, 8, '0')
FROM generate_series(1, 10) AS gs;


-- n 筆「原料-廠商」關聯（material_supplier）
-- 會從現有 bom 取前 n 筆來配對廠商（若 bom 不足 n 筆，則以 bom 實際筆數為準）
WITH
s AS (
  SELECT supplier_id, row_number() OVER (ORDER BY supplier_id) AS rn, count(*) OVER () AS cnt
  FROM supplier
),
b AS (
  SELECT bom_id, row_number() OVER (ORDER BY bom_id) AS rn
  FROM bom
  ORDER BY bom_id
  LIMIT 10
)
INSERT INTO material_supplier (supplier_id, bom_id)
SELECT
  s.supplier_id,
  b.bom_id
FROM b
JOIN s
  ON s.rn = ((b.rn - 1) % s.cnt) + 1
ON CONFLICT (supplier_id, bom_id) DO NOTHING;


ALTER TABLE purchase_order_log
ADD COLUMN IF NOT EXISTS expected_delivery_at TIMESTAMPTZ;

ALTER TABLE purchase_order_log
ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;



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


