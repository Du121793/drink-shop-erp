-- Step 4: Add initial inventory for all materials
-- Include expiry_time (NOT NULL). Sample uses stock_in_time + 180 days.
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty, expiry_time) VALUES
(1, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(2, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(3, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(4, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(5, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(6, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(7, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(8, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(9, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(10, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(11, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(12, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(13, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(14, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(15, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(16, NOW(), 500, 500, NOW() + INTERVAL '180 days'),
(17, NOW(), 500, 500, NOW() + INTERVAL '180 days');

-- 供應商信譽測試用
-- 製造低庫存與近效期，便於看出補貨建議
UPDATE inventory
SET remaining_qty = CASE WHEN bom_id IN (1, 2) THEN 20 ELSE remaining_qty END,
    expiry_time = CASE WHEN bom_id IN (1, 2) THEN NOW() + INTERVAL '3 days' ELSE expiry_time END
WHERE bom_id IN (1, 2);
