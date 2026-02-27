-- 供應商信譽測試資料

-- 設定信譽規則
INSERT INTO supplier_reputation_rule
  (rule_id, score_max, score_min, block_threshold, block_days, auto_block_enabled, default_lead_time_days)
VALUES
  (1, 100, 0, 70, 14, TRUE, 3)
ON CONFLICT (rule_id) DO UPDATE
SET score_max = EXCLUDED.score_max,
    score_min = EXCLUDED.score_min,
    block_threshold = EXCLUDED.block_threshold,
    block_days = EXCLUDED.block_days,
    auto_block_enabled = EXCLUDED.auto_block_enabled,
    default_lead_time_days = EXCLUDED.default_lead_time_days;

-- 設定事件類型
INSERT INTO supplier_event_type
  (event_code, event_name, base_penalty, half_life_days, repeat_window_days, repeat_growth, is_active)
VALUES
  ('late_delivery', '遲交', 8, 30, 30, 1, TRUE),
  ('wrong_items', '貨物不對', 15, 60, 30, 1, TRUE),
  ('quality_issue', '品質問題', 20, 90, 30, 1, TRUE),
  ('order_failed', '失敗', 12, 45, 30, 1, TRUE),
  ('damaged_packaging', '包裝損毀', 10, 45, 30, 1, TRUE)
ON CONFLICT (event_code) DO UPDATE
SET event_name = EXCLUDED.event_name,
    base_penalty = EXCLUDED.base_penalty,
    half_life_days = EXCLUDED.half_life_days,
    repeat_window_days = EXCLUDED.repeat_window_days,
    repeat_growth = EXCLUDED.repeat_growth,
    is_active = EXCLUDED.is_active;

-- 建立事件記錄
WITH payload AS (
  SELECT * FROM (VALUES
    (1, 'late_delivery', '遲交 2 天', NOW() - INTERVAL '3 days'),
    (1, 'late_delivery', '再次遲交', NOW() - INTERVAL '7 days'),
    (2, 'wrong_items', '數量短缺', NOW() - INTERVAL '5 days'),
    (2, 'damaged_packaging', '包裝破損', NOW() - INTERVAL '9 days'),
    (3, 'quality_issue', '品質不穩定', NOW() - INTERVAL '2 days'),
    (3, 'order_failed', '供貨失敗', NOW() - INTERVAL '1 days'),
    (4, 'late_delivery', '曾發生遲交', NOW() - INTERVAL '12 days')
  ) AS v(supplier_id, event_code, note, occurred_at)
)
INSERT INTO supplier_event
  (supplier_id, event_type_id, note, occurred_at, created_by)
SELECT
  p.supplier_id,
  t.event_type_id,
  p.note,
  p.occurred_at,
  'example'
FROM payload p
JOIN supplier_event_type t ON t.event_code = p.event_code;

-- 建立封鎖記錄
INSERT INTO supplier_block
  (supplier_id, blocked_at, block_until, reason, created_by)
VALUES
  (3, NOW() - INTERVAL '1 days', NOW() + INTERVAL '6 days', '測試封鎖', 'example');

-- 建立分數快照
INSERT INTO supplier_score_snapshot (supplier_id, score, calculated_at) VALUES
  (1, 88, NOW() - INTERVAL '1 days'),
  (2, 72, NOW() - INTERVAL '2 days'),
  (3, 55, NOW() - INTERVAL '3 days'),
  (4, 95, NOW() - INTERVAL '1 days');
