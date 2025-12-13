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