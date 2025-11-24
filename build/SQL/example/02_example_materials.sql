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
