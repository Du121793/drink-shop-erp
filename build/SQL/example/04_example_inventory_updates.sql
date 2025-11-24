-- Example inventory updates with varied stock quantities.
-- These are additional inventory records, showing new stock arrivals.

-- bom_id = 1 (泰式紅茶葉)
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty) VALUES
(1, NOW() - INTERVAL '5 days', 500.00, 500.00), -- 5 days ago, 500 units
(1, NOW(), 200.00, 200.00);                    -- Today, 200 units

-- bom_id = 3 (牛奶)
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty) VALUES
(3, NOW() - INTERVAL '2 days', 300.00, 300.00), -- 2 days ago, 300 units
(3, NOW(), 150.00, 150.00);                    -- Today, 150 units

-- bom_id = 12 (粉紅珍珠) - short shelf life, more frequent but smaller deliveries
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty) VALUES
(12, NOW(), 100.00, 100.00);                   -- Today, 100 units

-- bom_id = 16 (方糖)
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty) VALUES
(16, NOW() - INTERVAL '10 days', 400.00, 400.00); -- 10 days ago, 400 units
