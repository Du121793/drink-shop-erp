DROP TABLE IF EXISTS
  custom_sales_detail,
  sales_detail,
  product_option,
  option_detail,
  material_product,
  inventory_consumption_log,
  inventory,
  custom_option,
  product,
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

  CONSTRAINT fk_inventory_bom
    FOREIGN KEY (bom_id)
    REFERENCES bom (bom_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT chk_inventory_remaining_valid
    CHECK (remaining_qty >= 0 AND remaining_qty <= stock_in_qty)
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

-- Step 4: Add initial inventory for all materials
-- (補上 bom_id=12 粉紅珍珠，避免圖表/扣料缺資料)
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty) VALUES
(1, NOW(), 500, 500),  -- 泰式紅茶葉
(2, NOW(), 500, 500),  -- 煉乳
(3, NOW(), 500, 500),  -- 牛奶
(4, NOW(), 500, 500),  -- 草莓
(5, NOW(), 500, 500),  -- 優格
(6, NOW(), 500, 500),  -- 冰塊
(7, NOW(), 500, 500),  -- 烏龍茶
(8, NOW(), 500, 500),  -- 開心果
(9, NOW(), 500, 500),  -- 奶蓋粉
(10, NOW(), 500, 500), -- 冬瓜茶磚
(11, NOW(), 500, 500), -- 檸檬
(12, NOW(), 500, 500), -- 粉紅珍珠
(13, NOW(), 500, 500), -- 黑糖
(14, NOW(), 500, 500), -- 芋頭
(15, NOW(), 500, 500), -- 綠茶
(16, NOW(), 500, 500), -- 方糖
(17, NOW(), 500, 500); -- 芋圓

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
