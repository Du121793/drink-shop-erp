drop table if exists custom_sales_detail , sales_detail ,product_option ,option_detail ,material_product ,inventory ,custom_option ,product ,bom;

-- 02bom.sql
CREATE TABLE IF NOT EXISTS bom (
bom_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
material_name VARCHAR(100) NOT NULL,
shelf_life_days INTEGER, -- 保存時間(天)
max_stock_qty NUMERIC(10,2), -- 庫存最大值
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
-- 依圖：bom 1 -> M material_product，product 1 -> M material_product
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

CREATE INDEX IF NOT EXISTS idx_option_detail_option_id
ON option_detail (option_id);

CREATE INDEX IF NOT EXISTS idx_option_detail_bom_id
ON option_detail (bom_id);

-- 08product_option.sql (產品-選項表)
-- 依圖：custom_option 1 -> M product_option，product 1 -> M product_option
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
option_detail_id INTEGER NOT NULL, -- 選項細項\_id
detail_id INTEGER NOT NULL, -- 明細\_id
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

-- Example product inserts based on https://www.happy-168.com/formula.php

INSERT INTO product (product_name, price, is_active) VALUES
('泰式熱情泰國奶茶', 65, TRUE),
('草莓優格冰沙', 75, TRUE),
('開心果烏龍奶蓋飲', 80, TRUE),
('冬瓜檸檬加粉紅珍珠', 55, TRUE),
('黑糖粉紅珍珠厚奶', 70, TRUE),
('芋頭綠奶茶', 60, TRUE);

-- Example material, inventory, and recipe inserts.
-- NOTE: The product_id and bom_id values are assumed based on the insertion order
-- in 'example_products.sql' and this file. In a real application, you would
-- fetch the actual IDs after insertion.

-- Step 1: Insert raw materials into the Bill of Materials (bom) table.
-- Assuming bom_id starts from 1.
INSERT INTO bom (material_name, shelf_life_days) VALUES
('泰式紅茶葉', 180),
('煉乳', 90),
('牛奶', 15),
('草莓', 7),
('優格', 20),
('冰塊', 365),
('烏龍茶', 180),
('開心果', 120),
('奶蓋粉', 90),
('冬瓜茶磚', 200),
('檸檬', 10),
('粉紅珍珠', 1),
('黑糖', 365),
('芋頭', 5),
('綠茶', 180);

INSERT INTO bom (material_name, shelf_life_days) VALUES
('方糖', 365),
('芋圓', 30);
-- Step 3: Link products to their materials to create a recipe (material_product).
-- We assume product_id's are 1-6 from 'example_products.sql' and bom_id's are 1-15 from above.

-- Product 1: 泰式熱情泰國奶茶 (Thai Passion Thai Milk Tea)
-- Requires: 泰式紅茶葉 (bom_id=1), 煉乳 (bom_id=2)
INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(1, 1, 10),
(1, 2, 5);

-- Product 2: 草莓優格冰沙 (Strawberry Yogurt Smoothie)
-- Requires: 草莓 (bom_id=4), 優格 (bom_id=5), 冰塊 (bom_id=6)
INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(2, 4, 50),
(2, 5, 20),
(2, 6, 30);

-- Product 3: 開心果烏龍奶蓋飲 (Pistachio Oolong Milk Cap Drink)
-- Requires: 烏龍茶 (bom_id=7), 開心果 (bom_id=8), 奶蓋粉 (bom_id=9), 牛奶 (bom_id=3)
INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(3, 7, 10),
(3, 8, 5),
(3, 9, 15),
(3, 3, 20);

-- Product 4: 冬瓜檸檬加粉紅珍珠 (Winter Melon Lemon with Pink Pearls)
-- Requires: 冬瓜茶磚 (bom_id=10), 檸檬 (bom_id=11), 粉紅珍珠 (bom_id=12)
INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(4, 10, 20),
(4, 11, 5),
(4, 12, 15);

-- Product 5: 黑糖粉紅珍珠厚奶 (Brown Sugar Pink Pearl Thick Milk)
-- Requires: 黑糖 (bom_id=13), 粉紅珍珠 (bom_id=12), 牛奶 (bom_id=3)
INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(5, 13, 10),
(5, 12, 15),
(5, 3, 50);

-- Product 6: 芋頭綠奶茶 (Taro Green Milk Tea)
-- Requires: 芋頭 (bom_id=14), 綠茶 (bom_id=15), 牛奶 (bom_id=3)
INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES
(6, 14, 25),
(6, 15, 10),
(6, 3, 40);

-- Step 4: Add initial inventory for all materials
-- Give a large stock to ensure items are available.
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty) VALUES
(1, NOW(), 500, 500), -- 泰式紅茶葉
(2, NOW(), 500, 500), -- 煉乳
(3, NOW(), 500, 500), -- 牛奶
(4, NOW(), 500, 500), -- 草莓
(5, NOW(), 500, 500), -- 優格
(6, NOW(), 500, 500), -- 冰塊
(7, NOW(), 500, 500), -- 烏龍茶
(8, NOW(), 500, 500), -- 開心果
(9, NOW(), 500, 500), -- 奶蓋粉
(10, NOW(), 500, 500), -- 冬瓜茶磚
(11, NOW(), 500, 500), -- 檸檬
(13, NOW(), 500, 500), -- 黑糖
(14, NOW(), 500, 500), -- 芋頭
(15, NOW(), 500, 500), -- 綠茶
(16, NOW(), 500, 500), -- 方糖
(17, NOW(), 500, 500); -- 芋圓

-- Rewritten example custom options based on the new schema.
-- NOTE: IDs are assumed based on previous script execution order.

-- Step 1: Define the generic custom options.
-- Assuming custom_option ids start from 1.
INSERT INTO custom_option (option_name) VALUES
('糖度'), -- Sugar Level, option_id = 1
('冰量'), -- Ice Level, option_id = 2
('加料'); -- Add-ons, option_id = 3

-- Step 2: Define the details for each option.
-- Assumed bom_ids: 冰塊=6, 奶蓋粉=9, 粉紅珍珠=12, 方糖=16, 芋圓=17.

-- Details for '糖度' (option_id = 1)
INSERT INTO option_detail (option_id, bom_id, option_detail_name, material_qty, extra_price) VALUES
(1, 16, '無糖', 0, 0),
(1, 16, '微糖', 5, 0),
(1, 16, '正常甜', 10, 0),
(1, 16, '多糖', 15, 0);

-- Details for '冰量' (option_id = 2)
INSERT INTO option_detail (option_id, bom_id, option_detail_name, material_qty, extra_price) VALUES
(2, 6, '去冰', 0, 0),
(2, 6, '微冰', 10, 0),
(2, 6, '正常冰', 20, 0);

-- Details for '加料' (option_id = 3)
INSERT INTO option_detail (option_id, bom_id, option_detail_name, material_qty, extra_price) VALUES
(3, 9, '加奶蓋', 15, 15),
(3, 17, '加芋圓', 20, 10),

-- Step 3: Map the options to the relevant products.
-- Assumed product_ids are 1 through 6.

-- All products get 'Sugar Level' option (option_id = 1)
INSERT INTO product_option (product_id, option_id) VALUES
(1, 1),
(2, 1),
(3, 1),
(4, 1),
(5, 1),
(6, 1);

-- All non-smoothie products get 'Ice Level' option (option_id = 2)
INSERT INTO product_option (product_id, option_id) VALUES
(1, 2),
(3, 2),
(4, 2),
(5, 2),
(6, 2);

-- All products get 'Add-ons' option for maximum flexibility (option_id = 3)
INSERT INTO product_option (product_id, option_id) VALUES
(1, 3),
(2, 3),
(3, 3),
(4, 3)
