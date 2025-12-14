BEGIN;
SET TIME ZONE 'Asia/Taipei';

-- (0) 補上 inventory 可能漏掉的 bom_id=12（粉紅珍珠）
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty)
SELECT 12, NOW(), 500, 500
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE bom_id = 12);

-- (1) 把你原本 seed 的「NOW() 入庫」那批當作 45 天前的初始庫存（方便畫出歷史）
UPDATE inventory
SET stock_in_time = (NOW() - INTERVAL '45 days')::timestamp
WHERE stock_in_time > (NOW() - INTERVAL '10 minutes');

-- (2) 初始庫存調整到合理量級（約 1000~1200）
UPDATE inventory i
SET stock_in_qty = CASE
    WHEN i.bom_id IN (3,4,11,12,14) THEN 1200  -- 牛奶/草莓/檸檬/粉紅珍珠/芋頭：稍高
    ELSE 1000
  END,
  remaining_qty = CASE
    WHEN i.bom_id IN (3,4,11,12,14) THEN 1200
    ELSE 1000
  END
WHERE i.stock_in_qty = 500;

-- (3) 每週補貨：4 週（28/21/14/7 天前）
--     讓大多數原料總入庫 ~2000：
--       - 1200 + 4*200 = 2000
--       - 1000 + 4*250 = 2000
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty)
SELECT
  b.bom_id,
  (NOW() - (w.wk * 7 || ' days')::interval)::timestamp AS stock_in_time,
  CASE
    WHEN b.bom_id IN (3,4,11,12,14) THEN 200
    ELSE 250
  END::numeric,
  CASE
    WHEN b.bom_id IN (3,4,11,12,14) THEN 200
    ELSE 250
  END::numeric
FROM bom b
CROSS JOIN (SELECT generate_series(1,4) AS wk) w;

-- (3.2) ★ 避免「開心果烏龍奶蓋飲」缺貨：額外補牛奶 & 奶蓋粉（小幅）
-- 牛奶 bom_id=3：總入庫從 ~2000 提到 ~3000（避免被 5/6 也吃掉）
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty)
VALUES
(3, (NOW() - INTERVAL '20 days')::timestamp, 1000, 1000);

-- 奶蓋粉 bom_id=9：多補 500（避免奶蓋相關扣料偏多時歸零）
INSERT INTO inventory (bom_id, stock_in_time, stock_in_qty, remaining_qty)
VALUES
(9, (NOW() - INTERVAL '13 days')::timestamp, 500, 500);

-- (3.5) 同步更新 BOM max_stock_qty = 目前總入庫量（避免庫存%爆表）
UPDATE bom b
SET max_stock_qty = s.total_stock
FROM (
  SELECT bom_id, SUM(stock_in_qty)::numeric(10,2) AS total_stock
  FROM inventory
  GROUP BY bom_id
) s
WHERE b.bom_id = s.bom_id;

-- (4) 產生近 30 天銷售資料（降頻：每 6 小時一次；營業時間 10~20；每次 2 筆）
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

-- (5) 每筆成功銷售都加「糖度」（4 種糖度循環）
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

-- (6) 成功銷售且產品有「冰量」選項才加冰量（3 種循環）
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

-- (7) 成功銷售且產品有「加料」選項：每 6 筆加一次（2 種循環）
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

-- (8) 依「配方」寫入扣料 log
INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, consumption_time, reason)
SELECT
  mp.bom_id,
  mp.material_used_qty,
  (sd.sale_time AT TIME ZONE 'Asia/Taipei') AS consumption_time,
  ('SALE_BASE detail_id=' || sd.detail_id || ' product_id=' || sd.product_id)::text
FROM sales_detail sd
JOIN material_product mp ON mp.product_id = sd.product_id
WHERE sd.status = TRUE;

-- (9) 依「客製化選項」寫入扣料 log（只扣 material_qty > 0）
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

-- (10) 小量非銷售扣料
INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, consumption_time, reason) VALUES
(3,   25, NOW() - INTERVAL '6 days',  'SPOILAGE: milk expired'),
(4,   30, NOW() - INTERVAL '3 days',  'SPOILAGE: strawberries damaged'),
(6,   80, NOW() - INTERVAL '1 days',  'STAFF_DRINKS: ice usage'),
(12,  40, NOW() - INTERVAL '2 days',  'SPOILAGE: pearls expired'),
(16,  50, NOW() - INTERVAL '10 days', 'ADJUSTMENT: sugar calibration');

-- (11) 用（總入庫 - 總扣料）回算 remaining_qty，並把剩餘量分配到較新的批次優先
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

COMMIT;
