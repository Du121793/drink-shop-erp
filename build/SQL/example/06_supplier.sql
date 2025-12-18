-- sample suppliers n=10
INSERT INTO supplier (supplier_name, email, phone)
SELECT
  'supplier' || gs,
  CASE
    WHEN gs % 5 = 0 THEN NULL                  -- some suppliers without email
    WHEN gs % 3 = 0 THEN NULL                  -- some suppliers without phone
    ELSE 'vendor' || gs || '@example.com'
  END AS email,
  CASE
    WHEN gs % 5 = 0 THEN NULL                  -- align with missing email for variety
    WHEN gs % 4 = 0 THEN NULL                  -- some suppliers without email
    ELSE '09' || lpad((gs * 1234567 % 100000000)::text, 8, '0')
  END AS phone
FROM generate_series(1, 10) AS gs
ON CONFLICT (supplier_name) DO UPDATE
SET email = EXCLUDED.email,
    phone = EXCLUDED.phone;

-- n=10 suppliers mapped to first 10 bom rows (looped assignment)
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
  -- default supplier
  SELECT
    b.bom_id,
    s1.supplier_id,
    TRUE AS is_default
  FROM b
  JOIN s AS s1
    ON s1.rn = ((b.rn - 1) % s1.cnt) + 1

  UNION ALL

  -- second supplier (non-default)
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
