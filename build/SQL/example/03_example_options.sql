-- Rewritten example custom options based on the new schema.
-- NOTE: IDs are assumed based on previous script execution order.

-- Step 1: Define the generic custom options.
-- Assuming custom_option ids start from 1.
INSERT INTO custom_option (option_name) VALUES
('糖度'), -- Sugar Level, option_id = 1
('冰量'), -- Ice Level, option_id = 2
('加料');

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
(3, 17, '加芋圓', 20, 10);

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
(4, 3);
