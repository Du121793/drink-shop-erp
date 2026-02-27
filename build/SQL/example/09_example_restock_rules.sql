-- 範例：庫存規則與季節性資料
BEGIN;
SET TIME ZONE 'Asia/Taipei';

-- 清除舊的資料
DELETE FROM restock_rule_assignment;
DELETE FROM restock_rule;

-- 建立規則（新規則引擎：目標選取 + 門檻觸發）
INSERT INTO restock_rule (rule_name, rule_type, priority, enabled, scope, tags, params) VALUES
(
  '預設補貨規則',
  'default',
  100,
  TRUE,
  'global',
  '["預設","全域"]'::jsonb,
  $$
  {
    "steps": [
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "set",
            "base": "add",
            "target_type": "source",
            "target_source": "consumption_qty",
            "target_params": { "window_days": 7 },
            "text": "近7日消耗量"
          }
        ]
      },
      {
        "targets": [
          {
            "type": "consumption_ratio",
            "params": { "window_days": 7, "compare": "<", "threshold_percent": 0.15 }
          }
        ],
        "triggers": [
          {
            "action": "set",
            "base": "add",
            "target_type": "number",
            "target_value": 0,
            "text": "未達消耗門檻，暫不補貨"
          }
        ]
      },
      {
        "targets": [
          {
            "type": "stock_percent",
            "params": { "compare": "<", "percent": 0.10 }
          }
        ],
        "triggers": [
          {
            "action": "limit",
            "direction": "lower",
            "limit_type": "source",
            "limit_source": "safety_gap",
            "limit_params": { "safety_percent": 0.25 },
            "text": "低於安全庫存水位"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "source",
            "value_source": "rank_factor",
            "value_params": {
              "window_days": 7,
              "top_percent": 0.25,
              "mid_percent": 0.75,
              "top_factor": 1.5,
              "mid_factor": 1.2,
              "low_factor": 1
            },
            "text": "消耗排名倍率"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "source",
            "value_source": "shelf_life_factor",
            "value_params": {
              "short_days": 14,
              "mid_days": 90,
              "short_factor": 0.8,
              "mid_factor": 1,
              "long_factor": 1.2
            },
            "text": "保鮮期倍率"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "source",
            "value_source": "stock_level_factor",
            "value_params": { "min_factor": 0.5, "max_factor": 2 },
            "text": "庫存水位倍率"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "source",
            "value_source": "season_fixed_factor",
            "value_params": {
              "default_add": 0,
              "month_adds": { "6": 0.2, "7": 0.2, "8": 0.2, "12": 0.15 }
            },
            "text": "季節倍率(固定)"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "source",
            "value_source": "season_auto_factor",
            "value_params": {
              "lookback_months": 12,
              "min_add": -0.2,
              "max_add": 0.2,
              "smoothing": 0.3,
              "fallback_add": 0
            },
            "text": "季節倍率(自動)"
          }
        ]
      },
      {
        "targets": [
          {
            "type": "expiring_qty",
            "params": { "window_days": 7, "compare": ">", "value": 0 }
          }
        ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "+",
            "value_type": "source",
            "value_source": "expiring_qty",
            "value_params": { "window_days": 7 },
            "text": "即將到期補回"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "limit",
            "direction": "upper",
            "limit_type": "source",
            "limit_source": "space",
            "limit_params": {},
            "text": "容量上限"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "limit",
            "direction": "lower",
            "limit_type": "number",
            "limit_value": 0,
            "text": "不得為負"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "set",
            "base": "add",
            "target_type": "source",
            "target_source": "rounding",
            "target_params": {},
            "text": "四捨五入"
          }
        ]
      }
    ]
  }
  $$::jsonb
),
(
  '快速補貨規則',
  'boost',
  100,
  TRUE,
  'global',
  '["同優先序示範","快速補貨"]'::jsonb,
  $$
  {
    "steps": [
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "set",
            "base": "add",
            "target_type": "source",
            "target_source": "consumption_qty",
            "target_params": { "window_days": 7 },
            "text": "近7日消耗量"
          }
        ]
      },
      {
        "targets": [
          {
            "type": "consumption_ratio",
            "params": { "window_days": 7, "compare": "<", "threshold_percent": 0.1 }
          }
        ],
        "triggers": [
          {
            "action": "set",
            "base": "add",
            "target_type": "number",
            "target_value": 0,
            "text": "未達消耗門檻，暫不補貨"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "number",
            "value": 1.1,
            "text": "快速補貨倍率"
          }
        ]
      },
      {
        "targets": [
          {
            "type": "stock_percent",
            "params": { "compare": "<", "percent": 0.05 }
          }
        ],
        "triggers": [
          {
            "action": "set",
            "base": "add",
            "target_type": "source",
            "target_source": "safety_gap",
            "target_params": { "safety_percent": 0.25 },
            "text": "低庫存改用安全缺口"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "limit",
            "direction": "upper",
            "limit_type": "source",
            "limit_source": "space",
            "limit_params": {},
            "text": "容量上限"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "limit",
            "direction": "lower",
            "limit_type": "number",
            "limit_value": 0,
            "text": "不得為負"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "set",
            "base": "add",
            "target_type": "source",
            "target_source": "rounding",
            "target_params": {},
            "text": "四捨五入"
          }
        ]
      }
    ]
  }
  $$::jsonb
),
(
  '指定原料補貨規則',
  'material',
  110,
  TRUE,
  'material',
  '["指定原料","季節加成"]'::jsonb,
  $$
  {
    "steps": [
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "set",
            "base": "add",
            "target_type": "source",
            "target_source": "consumption_qty",
            "target_params": { "window_days": 7 },
            "text": "近7日消耗量"
          }
        ]
      },
      {
        "targets": [
          {
            "type": "consumption_ratio",
            "params": { "window_days": 7, "compare": "<", "threshold_percent": 0.15 }
          }
        ],
        "triggers": [
          {
            "action": "set",
            "base": "add",
            "target_type": "number",
            "target_value": 0,
            "text": "未達消耗門檻，暫不補貨"
          }
        ]
      },
      {
        "targets": [
          {
            "type": "stock_percent",
            "params": { "compare": "<", "percent": 0.10 }
          }
        ],
        "triggers": [
          {
            "action": "limit",
            "direction": "lower",
            "limit_type": "source",
            "limit_source": "safety_gap",
            "limit_params": { "safety_percent": 0.25 },
            "text": "低於安全庫存水位"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "source",
            "value_source": "rank_factor",
            "value_params": {
              "window_days": 7,
              "top_percent": 0.25,
              "mid_percent": 0.75,
              "top_factor": 1.5,
              "mid_factor": 1.2,
              "low_factor": 1
            },
            "text": "消耗排名倍率"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "source",
            "value_source": "shelf_life_factor",
            "value_params": {
              "short_days": 14,
              "mid_days": 90,
              "short_factor": 0.8,
              "mid_factor": 1,
              "long_factor": 1.2
            },
            "text": "保鮮期倍率"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "source",
            "value_source": "stock_level_factor",
            "value_params": { "min_factor": 0.5, "max_factor": 2 },
            "text": "庫存水位倍率"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "source",
            "value_source": "season_fixed_factor",
            "value_params": {
              "default_add": 0.1,
              "month_adds": { "6": 0.3, "7": 0.3, "8": 0.3 }
            },
            "text": "季節倍率(固定)"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "*",
            "value_type": "source",
            "value_source": "season_auto_factor",
            "value_params": {
              "lookback_months": 12,
              "min_add": -0.2,
              "max_add": 0.2,
              "smoothing": 0.3,
              "fallback_add": 0
            },
            "text": "季節倍率(自動)"
          }
        ]
      },
      {
        "targets": [
          {
            "type": "expiring_qty",
            "params": { "window_days": 7, "compare": ">", "value": 0 }
          }
        ],
        "triggers": [
          {
            "action": "operate",
            "base": "add",
            "op": "+",
            "value_type": "source",
            "value_source": "expiring_qty",
            "value_params": { "window_days": 7 },
            "text": "即將到期補回"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "limit",
            "direction": "upper",
            "limit_type": "source",
            "limit_source": "space",
            "limit_params": {},
            "text": "容量上限"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "limit",
            "direction": "lower",
            "limit_type": "number",
            "limit_value": 0,
            "text": "不得為負"
          }
        ]
      },
      {
        "targets": [ { "type": "always", "params": {} } ],
        "triggers": [
          {
            "action": "set",
            "base": "add",
            "target_type": "source",
            "target_source": "rounding",
            "target_params": {},
            "text": "四捨五入"
          }
        ]
      }
    ]
  }
  $$::jsonb
);

-- 指派規則到原料（示範指定原料規則）
INSERT INTO restock_rule_assignment (rule_id, bom_id, enabled, override_params)
SELECT r.rule_id, b.bom_id, TRUE, '{}'::jsonb
FROM restock_rule r
JOIN bom b ON b.material_name = '草莓'
WHERE r.rule_name = '指定原料補貨規則';

INSERT INTO restock_rule_assignment (rule_id, bom_id, enabled, override_params)
SELECT r.rule_id, b.bom_id, TRUE, '{}'::jsonb
FROM restock_rule r
JOIN bom b ON b.material_name = '檸檬'
WHERE r.rule_name = '指定原料補貨規則';

-- 示範：關閉某原料的全域規則
INSERT INTO restock_rule_assignment (rule_id, bom_id, enabled, override_params)
SELECT r.rule_id, b.bom_id, FALSE, '{}'::jsonb
FROM restock_rule r
JOIN bom b ON b.material_name = '冰塊'
WHERE r.rule_name = '預設補貨規則';

-- 清除既有季節消耗紀錄
DELETE FROM inventory_consumption_log WHERE reason = '季節';

-- 建立 12 個月消耗紀錄，用於自動季節倍率
WITH months AS (
  SELECT generate_series(0, 11) AS m
),
Dates AS (
  SELECT (date_trunc('month', NOW()) - (m || ' months')::interval) AS month_start
  FROM months
)
INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, consumption_time, reason)
SELECT b.bom_id,
  CASE
    WHEN EXTRACT(MONTH FROM d.month_start) IN (12, 1, 2) THEN 500
    ELSE 250
  END AS quantity_consumed,
  (d.month_start + INTERVAL '10 days')::timestamptz AS consumption_time,
  '季節'
FROM Dates d
JOIN bom b ON b.material_name = '牛奶';

WITH months AS (
  SELECT generate_series(0, 11) AS m
),
Dates AS (
  SELECT (date_trunc('month', NOW()) - (m || ' months')::interval) AS month_start
  FROM months
)
INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, consumption_time, reason)
SELECT b.bom_id,
  CASE
    WHEN EXTRACT(MONTH FROM d.month_start) IN (6, 7, 8) THEN 520
    ELSE 180
  END AS quantity_consumed,
  (d.month_start + INTERVAL '12 days')::timestamptz AS consumption_time,
  '季節'
FROM Dates d
JOIN bom b ON b.material_name = '草莓';

WITH months AS (
  SELECT generate_series(0, 11) AS m
),
Dates AS (
  SELECT (date_trunc('month', NOW()) - (m || ' months')::interval) AS month_start
  FROM months
)
INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, consumption_time, reason)
SELECT b.bom_id,
  CASE
    WHEN EXTRACT(MONTH FROM d.month_start) IN (5, 6, 7, 8) THEN 420
    ELSE 160
  END AS quantity_consumed,
  (d.month_start + INTERVAL '8 days')::timestamptz AS consumption_time,
  '季節'
FROM Dates d
JOIN bom b ON b.material_name = '檸檬';

COMMIT;
