BEGIN;
SET TIME ZONE 'Asia/Taipei';

-- (0) 確保 inventory 有 bom_id=12（粉紅珍珠），補一筆 7 天內到期的存貨
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty, expiry_time)
SELECT 12, NOW(), 500, 500, NOW() + INTERVAL '7 days'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE bom_id = 12);

-- (1) 調整 seed 資料：將近期入庫的時間往前推 45 天，讓歷史更長
UPDATE inventory
SET stock_in_time = (NOW() - INTERVAL '45 days')::timestamp
WHERE stock_in_time > (NOW() - INTERVAL '10 minutes');

-- (2) 調整庫存量：部分原料提高至 1200，其餘 1000
UPDATE inventory i
SET stock_in_qty = CASE
    WHEN i.bom_id IN (3,4,11,12,14) THEN 1200
    ELSE 1000
  END,
  remaining_qty = CASE
    WHEN i.bom_id IN (3,4,11,12,14) THEN 1200
    ELSE 1000
  END
WHERE i.stock_in_qty = 500;

-- (3) 每週補貨 4 次，分別為 28/21/14/7 天前，並設定到期時間
--     部分原料使用近效期（3 或 7 天內到期），其餘為 30 天以上
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty, expiry_time)
SELECT
  b.bom_id,
  (NOW() - (w.wk * 7 || ' days')::interval)::timestamp AS stock_in_time,
  CASE WHEN b.bom_id IN (3,4,11,12,14) THEN 200 ELSE 250 END::numeric AS stock_in_qty,
  CASE WHEN b.bom_id IN (3,4,11,12,14) THEN 200 ELSE 250 END::numeric AS remaining_qty,
  CASE
    WHEN b.bom_id IN (4,8,12) THEN NOW() + INTERVAL '3 days'  -- 3 天內到期
    WHEN b.bom_id IN (3,11) THEN NOW() + INTERVAL '7 days'    -- 7 天內到期
    ELSE (NOW() + INTERVAL '30 days')
  END AS expiry_time
FROM bom b
CROSS JOIN (SELECT generate_series(1,4) AS wk) w;

-- (3.2) 額外補貨：牛奶（bom_id=3，常用）補大批，設 5 天內到期
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty, expiry_time)
VALUES
(3, (NOW() - INTERVAL '20 days')::timestamp, 1000, 1000, NOW() + INTERVAL '5 days');

-- (3.3) 奶蓋粉（bom_id=9）補貨，設 15 天內到期
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty, expiry_time)
VALUES
(9, (NOW() - INTERVAL '13 days')::timestamp, 500, 500, NOW() + INTERVAL '15 days');

-- (3.5) 同步 BOM 最大庫存為當前總入庫量，避免顯示超出上限
UPDATE bom b
SET max_stock_qty = s.total_stock
FROM (
  SELECT bom_id, SUM(stock_in_qty)::numeric(10,2) AS total_stock
  FROM inventory
  GROUP BY bom_id
) s
WHERE b.bom_id = s.bom_id;

-- (4) 最近 30 天每 6 小時一筆銷售，營業時間 10~20 點；部分訂單標記失敗
WITH ts AS (
  SELECT generate_series(
    date_trunc('hour', NOW() - INTERVAL '30 days'),
    date_trunc('hour', NOW()),
    INTERVAL '6 hours'
  ) AS sale_time
),
k AS (
  SELECT 1 AS k UNION ALL SELECT 2
)
INSERT INTO sales_detail (product_id, sale_time, status)
SELECT
  ((EXTRACT(doy FROM ts.sale_time)::int + EXTRACT(hour FROM ts.sale_time)::int + k.k) % 6) + 1 AS product_id,
  (ts.sale_time + (k.k - 1) * INTERVAL '7 minutes')::timestamp AS sale_time,
  CASE
    WHEN ((EXTRACT(epoch FROM ts.sale_time)::bigint / 21600 + k.k) % 17) = 0 THEN FALSE
    ELSE TRUE
  END AS status
FROM ts
CROSS JOIN k
WHERE EXTRACT(hour FROM ts.sale_time) BETWEEN 10 AND 20;

-- (5) 客製糖度：4 種糖度輪替
INSERT INTO custom_sales_detail (option_detail_id, detail_id)
SELECT
  (
    SELECT od.option_detail_id
    FROM option_detail od
    WHERE od.option_id = 1
    ORDER BY od.option_detail_id
    OFFSET ((sd.detail_id - 1) % 4)
    LIMIT 1
  ),
  sd.detail_id
FROM sales_detail sd
WHERE sd.status = TRUE
ON CONFLICT DO NOTHING;

-- (6) 客製冰量：3 種輪替
INSERT INTO custom_sales_detail (option_detail_id, detail_id)
SELECT
  (
    SELECT od.option_detail_id
    FROM option_detail od
    WHERE od.option_id = 2
    ORDER BY od.option_detail_id
    OFFSET ((sd.detail_id - 1) % 3)
    LIMIT 1
  ),
  sd.detail_id
FROM sales_detail sd
JOIN product_option po
  ON po.product_id = sd.product_id AND po.option_id = 2
WHERE sd.status = TRUE
ON CONFLICT DO NOTHING;

-- (7) 客製加料：每 6 筆一次，兩種輪替
INSERT INTO custom_sales_detail (option_detail_id, detail_id)
SELECT
  (
    SELECT od.option_detail_id
    FROM option_detail od
    WHERE od.option_id = 3
    ORDER BY od.option_detail_id
    OFFSET ((sd.detail_id - 1) % 2)
    LIMIT 1
  ),
  sd.detail_id
FROM sales_detail sd
JOIN product_option po
  ON po.product_id = sd.product_id AND po.option_id = 3
WHERE sd.status = TRUE
  AND (sd.detail_id % 6) = 0
ON CONFLICT DO NOTHING;

-- (8) 依銷售紀錄寫入扣料 log（基礎配方）
INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, consumption_time, reason)
SELECT
  mp.bom_id,
  mp.material_used_qty,
  (sd.sale_time AT TIME ZONE 'Asia/Taipei') AS consumption_time,
  ('SALE_BASE detail_id=' || sd.detail_id || ' product_id=' || sd.product_id)::text
FROM sales_detail sd
JOIN material_product mp ON mp.product_id = sd.product_id
WHERE sd.status = TRUE;

-- (9) 依客製選項寫入扣料 log（僅 material_qty > 0）
INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, consumption_time, reason)
SELECT
  od.bom_id,
  od.material_qty,
  (sd.sale_time AT TIME ZONE 'Asia/Taipei') AS consumption_time,
  ('SALE_OPT detail_id=' || sd.detail_id || ' option_detail_id=' || od.option_detail_id)::text
FROM sales_detail sd
JOIN custom_sales_detail csd ON csd.detail_id = sd.detail_id
JOIN option_detail od ON od.option_detail_id = csd.option_detail_id
WHERE sd.status = TRUE
  AND od.material_qty > 0;

-- (10) 零星扣料/報廢
INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, consumption_time, reason) VALUES
(3,   25, NOW() - INTERVAL '6 days',  'SPOILAGE: milk expired'),
(4,   30, NOW() - INTERVAL '3 days',  'SPOILAGE: strawberries damaged'),
(6,   80, NOW() - INTERVAL '1 days',  'STAFF_DRINKS: ice usage'),
(12,  40, NOW() - INTERVAL '2 days',  'SPOILAGE: pearls expired'),
(16,  50, NOW() - INTERVAL '10 days', 'ADJUSTMENT: sugar calibration');

-- (11) 重新計算 remaining_qty 並回填
WITH inv AS (
  SELECT
    inventory_id,
    bom_id,
    stock_in_qty,
    stock_in_time,
    SUM(stock_in_qty) OVER (PARTITION BY bom_id) AS total_stock,
    SUM(stock_in_qty) OVER (PARTITION BY bom_id ORDER BY stock_in_time DESC, inventory_id DESC) AS cum_stock_desc
  FROM inventory
),
cons AS (
  SELECT bom_id, COALESCE(SUM(quantity_consumed), 0)::numeric AS total_consumed
  FROM inventory_consumption_log
  GROUP BY bom_id
),
calc AS (
  SELECT
    inv.inventory_id,
    GREATEST(
      0::numeric,
      LEAST(
        inv.stock_in_qty,
        (inv.total_stock - COALESCE(cons.total_consumed, 0))
        - (inv.cum_stock_desc - inv.stock_in_qty)
      )
    ) AS new_remaining
  FROM inv
  LEFT JOIN cons ON cons.bom_id = inv.bom_id
)
UPDATE inventory i
SET remaining_qty = c.new_remaining
FROM calc c
WHERE i.inventory_id = c.inventory_id;

-- 供應商信譽測試用叫貨紀錄
INSERT INTO purchase_order_log
  (supplier_id, bom_id, order_qty, order_time, expected_delivery_at, arrived_at, order_status)
VALUES
  (1, 1, 120, NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', 1),
  (2, 2, 80, NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 1),
  (3, 3, 150, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 days', NULL, 0),
  (4, 4, 90, NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days', NULL, 3);

COMMIT;