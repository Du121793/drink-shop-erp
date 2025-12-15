-- n=10
INSERT INTO supplier (supplier_name, email, phone)
SELECT
  '廠商' || gs,
  CASE
    WHEN gs % 5 = 0 THEN NULL                  -- 兩個都空：這裡先把 email 設 NULL
    WHEN gs % 3 = 0 THEN NULL                  -- 只留 phone
    ELSE 'vendor' || gs || '@example.com'      -- 留 email
  END AS email,
  CASE
    WHEN gs % 5 = 0 THEN NULL                  -- 兩個都空：phone 也 NULL
    WHEN gs % 4 = 0 THEN NULL                  -- 只留 email
    ELSE '09' || lpad((gs * 1234567 % 100000000)::text, 8, '0')
  END AS phone
FROM generate_series(1, 10) AS gs
ON CONFLICT (supplier_name) DO UPDATE
SET email = EXCLUDED.email,
    phone = EXCLUDED.phone;

-- n=10（取前 n 個 bom 來做示範）
WITH
s AS (
  SELECT supplier_id,
         row_number() OVER (ORDER BY supplier_id) AS rn,
         count(*) OVER () AS cnt
  FROM supplier
),
b AS (
  SELECT bom_id,
         row_number() OVER (ORDER BY bom_id) AS rn
  FROM bom
  ORDER BY bom_id
  LIMIT 10
),
pairs AS (
  -- 預設廠商
  SELECT
    b.bom_id,
    s1.supplier_id,
    TRUE AS is_default
  FROM b
  JOIN s AS s1
    ON s1.rn = ((b.rn - 1) % s1.cnt) + 1

  UNION ALL

  -- 第二供應商（非預設）
  SELECT
    b.bom_id,
    s2.supplier_id,
    FALSE AS is_default
  FROM b
  JOIN s AS s2
    ON s2.rn = ((b.rn + 2 - 1) % s2.cnt) + 1
)
INSERT INTO material_supplier (supplier_id, bom_id, is_default)
SELECT supplier_id, bom_id, is_default
FROM pairs
ON CONFLICT (supplier_id, bom_id) DO NOTHING;
