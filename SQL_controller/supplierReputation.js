import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";

const DEFAULT_RULE = {
  score_max: 100,
  score_min: 0,
  block_threshold: 60,
  block_days: 30,
  auto_block_enabled: true,
  default_lead_time_days: 0,
};

const DEFAULT_EVENT_TYPES = [
  {
    event_code: "late_delivery",
    event_name: "遲交",
    base_penalty: 8,
    half_life_days: 30,
    repeat_window_days: 30,
    repeat_growth: 1,
  },
  {
    event_code: "wrong_items",
    event_name: "貨物不對",
    base_penalty: 15,
    half_life_days: 60,
    repeat_window_days: 30,
    repeat_growth: 1,
  },
  {
    event_code: "quality_issue",
    event_name: "品質問題",
    base_penalty: 20,
    half_life_days: 90,
    repeat_window_days: 30,
    repeat_growth: 1,
  },
  {
    event_code: "order_failed",
    event_name: "失敗",
    base_penalty: 12,
    half_life_days: 45,
    repeat_window_days: 30,
    repeat_growth: 1,
  },
];

// 安全數字轉換
const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

// 限制數值範圍
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// 確保預設規則存在
async function ensureDefaultRule(client) {
  const res = await client.query(
    "SELECT rule_id, score_max, score_min, block_threshold, block_days, auto_block_enabled, default_lead_time_days FROM supplier_reputation_rule WHERE rule_id = 1"
  );
  if (res.rowCount > 0) return res.rows[0];
  const inserted = await client.query(
    `INSERT INTO supplier_reputation_rule
      (rule_id, score_max, score_min, block_threshold, block_days, auto_block_enabled, default_lead_time_days)
     VALUES (1, $1, $2, $3, $4, $5, $6)
     RETURNING rule_id, score_max, score_min, block_threshold, block_days, auto_block_enabled, default_lead_time_days`,
    [
      DEFAULT_RULE.score_max,
      DEFAULT_RULE.score_min,
      DEFAULT_RULE.block_threshold,
      DEFAULT_RULE.block_days,
      DEFAULT_RULE.auto_block_enabled,
      DEFAULT_RULE.default_lead_time_days,
    ]
  );
  return inserted.rows[0];
}

// 確保預設事件類型存在
async function ensureDefaultEventTypes(client) {
  const existing = await client.query(
    "SELECT event_code FROM supplier_event_type"
  );
  if (existing.rowCount > 0) return;

  for (const item of DEFAULT_EVENT_TYPES) {
    await client.query(
      `INSERT INTO supplier_event_type
        (event_code, event_name, base_penalty, half_life_days, repeat_window_days, repeat_growth, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [
        item.event_code,
        item.event_name,
        item.base_penalty,
        item.half_life_days,
        item.repeat_window_days,
        item.repeat_growth,
      ]
    );
  }
}

// 取得信譽規則（若缺少則建立）
async function getReputationRule() {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    return await ensureDefaultRule(client);
  } catch (error) {
    error.msg = "取得信譽規則失敗";
    logger.error(error, null, "getReputationRule");
    throw error;
  } finally {
    client.release();
  }
}

// 更新信譽規則
async function updateReputationRule(data = {}) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const rule = await ensureDefaultRule(client);
    const payload = {
      score_max: data.score_max ?? rule.score_max,
      score_min: data.score_min ?? rule.score_min,
      block_threshold: data.block_threshold ?? rule.block_threshold,
      block_days: data.block_days ?? rule.block_days,
      auto_block_enabled:
        data.auto_block_enabled ?? rule.auto_block_enabled,
      default_lead_time_days:
        data.default_lead_time_days ?? rule.default_lead_time_days,
    };
    const res = await client.query(
      `UPDATE supplier_reputation_rule
       SET score_max = $2,
           score_min = $3,
           block_threshold = $4,
           block_days = $5,
           auto_block_enabled = $6,
           default_lead_time_days = $7
       WHERE rule_id = $1
       RETURNING rule_id, score_max, score_min, block_threshold, block_days, auto_block_enabled, default_lead_time_days`,
      [
        1,
        payload.score_max,
        payload.score_min,
        payload.block_threshold,
        payload.block_days,
        payload.auto_block_enabled,
        payload.default_lead_time_days,
      ]
    );
    return res.rows[0];
  } catch (error) {
    error.msg = "更新信譽規則失敗";
    logger.error(error, null, "updateReputationRule");
    throw error;
  } finally {
    client.release();
  }
}

// 取得事件類型清單
async function getEventTypes(includeInactive = false) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await ensureDefaultEventTypes(client);
    const condition = includeInactive ? "" : "WHERE is_active = TRUE";
    const res = await client.query(
      `SELECT event_type_id, event_code, event_name, base_penalty, half_life_days, repeat_window_days, repeat_growth, is_active
       FROM supplier_event_type
       ${condition}
       ORDER BY event_type_id`
    );
    return res.rows;
  } catch (error) {
    error.msg = "取得事件類型失敗";
    logger.error(error, null, "getEventTypes");
    throw error;
  } finally {
    client.release();
  }
}

// 建立事件類型
async function createEventType(data = {}) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO supplier_event_type
        (event_code, event_name, base_penalty, half_life_days, repeat_window_days, repeat_growth, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING event_type_id, event_code, event_name, base_penalty, half_life_days, repeat_window_days, repeat_growth, is_active`,
      [
        data.event_code,
        data.event_name,
        data.base_penalty ?? 0,
        data.half_life_days ?? null,
        data.repeat_window_days ?? 30,
        data.repeat_growth ?? 1,
        data.is_active ?? true,
      ]
    );
    return res.rows[0];
  } catch (error) {
    error.msg = "建立事件類型失敗";
    logger.error(error, null, "createEventType");
    throw error;
  } finally {
    client.release();
  }
}

// 更新事件類型
async function updateEventType(eventTypeId, data = {}) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE supplier_event_type
       SET event_code = COALESCE($2, event_code),
           event_name = COALESCE($3, event_name),
           base_penalty = COALESCE($4, base_penalty),
           half_life_days = $5,
           repeat_window_days = COALESCE($6, repeat_window_days),
           repeat_growth = COALESCE($7, repeat_growth),
           is_active = COALESCE($8, is_active)
       WHERE event_type_id = $1
       RETURNING event_type_id, event_code, event_name, base_penalty, half_life_days, repeat_window_days, repeat_growth, is_active`,
      [
        eventTypeId,
        data.event_code ?? null,
        data.event_name ?? null,
        data.base_penalty ?? null,
        data.half_life_days ?? null,
        data.repeat_window_days ?? null,
        data.repeat_growth ?? null,
        data.is_active ?? null,
      ]
    );
    return res.rows[0];
  } catch (error) {
    error.msg = "更新事件類型失敗";
    logger.error(error, null, "updateEventType");
    throw error;
  } finally {
    client.release();
  }
}

// 建立供應商事件（可由 event_code 反查類型）
async function createSupplierEvent(
  {
    supplier_id,
    event_type_id,
    event_code,
    order_id = null,
    note = null,
    occurred_at = null,
    created_by = null,
  },
  dbClient = null
) {
  const pool = getPoolRW();
  const client = dbClient || (await pool.connect());
  const shouldRelease = !dbClient;
  try {
    await ensureDefaultEventTypes(client);
    let resolvedEventTypeId = event_type_id;
    if (!resolvedEventTypeId && event_code) {
      const typeRes = await client.query(
        "SELECT event_type_id FROM supplier_event_type WHERE event_code = $1",
        [event_code]
      );
      if (typeRes.rowCount > 0) {
        resolvedEventTypeId = typeRes.rows[0].event_type_id;
      }
    }
    if (!resolvedEventTypeId) {
      const err = new Error("事件類型不存在");
      err.isBadRequest = true;
      throw err;
    }
    const res = await client.query(
      `INSERT INTO supplier_event
        (supplier_id, event_type_id, order_id, note, occurred_at, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5, NOW()), $6)
       RETURNING event_id, supplier_id, event_type_id, order_id, note, occurred_at, created_by`,
      [
        supplier_id,
        resolvedEventTypeId,
        order_id,
        note,
        occurred_at ? new Date(occurred_at) : null,
        created_by,
      ]
    );
    return res.rows[0];
  } catch (error) {
    if (!error.msg) {
      error.msg = "建立事件失敗";
    }
    logger.error(error, null, "createSupplierEvent");
    throw error;
  } finally {
    if (shouldRelease) client.release();
  }
}

// 取得供應商事件列表
async function getSupplierEvents(supplierId, limit = null) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const params = [supplierId];
    let limitSql = "";
    if (limit) {
      params.push(limit);
      limitSql = "LIMIT $2";
    }
    const res = await client.query(
      `SELECT
        e.event_id,
        e.supplier_id,
        e.order_id,
        e.note,
        e.occurred_at,
        e.created_by,
        t.event_type_id,
        t.event_code,
        t.event_name,
        t.base_penalty,
        t.half_life_days,
        t.repeat_window_days,
        t.repeat_growth
       FROM supplier_event e
       JOIN supplier_event_type t ON t.event_type_id = e.event_type_id
       WHERE e.supplier_id = $1
       ORDER BY e.occurred_at DESC
       ${limitSql}`,
      params
    );
    return res.rows;
  } catch (error) {
    error.msg = "取得事件失敗";
    logger.error(error, null, "getSupplierEvents");
    throw error;
  } finally {
    client.release();
  }
}

// 計算扣分：時間衰減 + 重複加權
function calculatePenalty(events, rule) {
  if (!events.length) {
    return { score: toNumber(rule.score_max, 100), totalPenalty: 0, items: [] };
  }
  const now = new Date();
  const scoreMax = toNumber(rule.score_max, 100);
  const scoreMin = toNumber(rule.score_min, 0);
  const grouped = new Map();
  events.forEach((event) => {
    const typeId = event.event_type_id;
    if (!grouped.has(typeId)) grouped.set(typeId, []);
    grouped.get(typeId).push(event);
  });

  const eventPenalties = [];
  let totalPenalty = 0;

  grouped.forEach((list) => {
    const sorted = [...list].sort(
      (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
    );
    let windowStart = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      const current = sorted[i];
      const windowDays = toNumber(current.repeat_window_days, 30);
      while (
        windowStart < i &&
        (new Date(current.occurred_at) - new Date(sorted[windowStart].occurred_at)) /
          (1000 * 60 * 60 * 24) >
          windowDays
      ) {
        windowStart += 1;
      }
      const countInWindow = i - windowStart + 1;
      const repeatGrowth = toNumber(current.repeat_growth, 1);
      const repeatFactor = 1 + repeatGrowth * Math.log(1 + countInWindow);
      const halfLife = toNumber(current.half_life_days, 0);
      const daysSince =
        (now - new Date(current.occurred_at)) / (1000 * 60 * 60 * 24);
      const decayFactor =
        halfLife > 0 ? Math.pow(0.5, daysSince / halfLife) : 1;
      const basePenalty = toNumber(current.base_penalty, 0);
      const penalty = basePenalty * decayFactor * repeatFactor;
      totalPenalty += penalty;
      eventPenalties.push({
        ...current,
        penalty,
        decay_factor: decayFactor,
        repeat_factor: repeatFactor,
      });
    }
  });

  const score = clamp(scoreMax - totalPenalty, scoreMin, scoreMax);
  return { score, totalPenalty, items: eventPenalties };
}

// 取得仍在封鎖中的名單
async function getActiveBlocks(supplierIds = []) {
  if (!supplierIds.length) return new Map();
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT supplier_id, MAX(block_until) AS block_until
       FROM supplier_block
       WHERE supplier_id = ANY($1::int[])
         AND block_until > NOW()
       GROUP BY supplier_id`,
      [supplierIds]
    );
    return new Map(res.rows.map((row) => [row.supplier_id, row.block_until]));
  } catch (error) {
    error.msg = "取得封鎖狀態失敗";
    logger.error(error, null, "getActiveBlocks");
    throw error;
  } finally {
    client.release();
  }
}

// 寫入分數快照
async function recordScoreSnapshot(client, supplierId, score) {
  await client.query(
    `INSERT INTO supplier_score_snapshot (supplier_id, score)
     VALUES ($1, $2)`,
    [supplierId, score]
  );
}

// 依規則觸發自動封鎖
async function autoBlockIfNeeded(client, supplierId, score, rule) {
  if (!rule.auto_block_enabled) return null;
  const threshold = toNumber(rule.block_threshold, 60);
  if (score >= threshold) return null;

  const check = await client.query(
    `SELECT block_id, block_until
     FROM supplier_block
     WHERE supplier_id = $1 AND block_until > NOW()
     ORDER BY block_until DESC
     LIMIT 1`,
    [supplierId]
  );
  if (check.rowCount > 0) return check.rows[0];

  const days = toNumber(rule.block_days, 30);
  const res = await client.query(
    `INSERT INTO supplier_block (supplier_id, block_until, reason)
     VALUES ($1, NOW() + ($2 || ' days')::interval, $3)
     RETURNING block_id, block_until`,
    [supplierId, days, "自動封鎖"]
  );
  return res.rows[0];
}

// 重新計算供應商信譽分數
async function recalculateSupplierScore(supplierId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const rule = await ensureDefaultRule(client);
    const events = await client.query(
      `SELECT
        e.event_id,
        e.supplier_id,
        e.order_id,
        e.note,
        e.occurred_at,
        e.created_by,
        t.event_type_id,
        t.event_code,
        t.event_name,
        t.base_penalty,
        t.half_life_days,
        t.repeat_window_days,
        t.repeat_growth
       FROM supplier_event e
       JOIN supplier_event_type t ON t.event_type_id = e.event_type_id
       WHERE e.supplier_id = $1`,
      [supplierId]
    );
    const calculation = calculatePenalty(events.rows, rule);
    await recordScoreSnapshot(client, supplierId, calculation.score);
    const block = await autoBlockIfNeeded(
      client,
      supplierId,
      calculation.score,
      rule
    );
    return {
      score: calculation.score,
      totalPenalty: calculation.totalPenalty,
      block,
    };
  } catch (error) {
    error.msg = "重新計算信譽分數失敗";
    logger.error(error, null, "recalculateSupplierScore");
    throw error;
  } finally {
    client.release();
  }
}

// 取得供應商信譽摘要（含近期事件）
async function getSupplierReputationSummaries(supplierIds = []) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const rule = await ensureDefaultRule(client);
    await ensureDefaultEventTypes(client);

    const ids = supplierIds.length
      ? supplierIds.map((id) => Number(id)).filter(Boolean)
      : [];
    const params = [];
    let condition = "";
    if (ids.length) {
      params.push(ids);
      condition = "WHERE e.supplier_id = ANY($1::int[])";
    }

    const eventsRes = await client.query(
      `SELECT
        e.event_id,
        e.supplier_id,
        e.order_id,
        e.note,
        e.occurred_at,
        e.created_by,
        t.event_type_id,
        t.event_code,
        t.event_name,
        t.base_penalty,
        t.half_life_days,
        t.repeat_window_days,
        t.repeat_growth
       FROM supplier_event e
       JOIN supplier_event_type t ON t.event_type_id = e.event_type_id
       ${condition}`,
      params
    );

    const eventsBySupplier = new Map();
    eventsRes.rows.forEach((row) => {
      if (!eventsBySupplier.has(row.supplier_id)) {
        eventsBySupplier.set(row.supplier_id, []);
      }
      eventsBySupplier.get(row.supplier_id).push(row);
    });

    const activeBlocks = ids.length
      ? await getActiveBlocks(ids)
      : new Map();

    const summaries = [];
    const targetIds = ids.length
      ? ids
      : Array.from(new Set(eventsRes.rows.map((r) => r.supplier_id)));

    for (const supplierId of targetIds) {
      const list = eventsBySupplier.get(supplierId) || [];
      const calculation = calculatePenalty(list, rule);
      const sortedRecent = [...list]
        .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
        .slice(0, 3)
        .map((item) => ({
          event_id: item.event_id,
          event_code: item.event_code,
          event_name: item.event_name,
          occurred_at: item.occurred_at,
          note: item.note,
        }));
      const blockUntil = activeBlocks.get(supplierId) || null;
      summaries.push({
        supplier_id: supplierId,
        score: calculation.score,
        total_penalty: calculation.totalPenalty,
        is_blocked: Boolean(blockUntil),
        block_until: blockUntil,
        recent_events: sortedRecent,
      });
    }
    return { rule, summaries };
  } catch (error) {
    error.msg = "取得信譽摘要失敗";
    logger.error(error, null, "getSupplierReputationSummaries");
    throw error;
  } finally {
    client.release();
  }
}

// 取得供應商信譽明細
async function getSupplierReputationDetail(supplierId, limit = 50) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const rule = await ensureDefaultRule(client);
    await ensureDefaultEventTypes(client);
    const events = await getSupplierEvents(supplierId, limit);
    const calculation = calculatePenalty(events, rule);
    const activeBlocks = await getActiveBlocks([supplierId]);
    const blockUntil = activeBlocks.get(Number(supplierId)) || null;
    return {
      score: calculation.score,
      total_penalty: calculation.totalPenalty,
      is_blocked: Boolean(blockUntil),
      block_until: blockUntil,
      rule,
      events: calculation.items.sort(
        (a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)
      ),
    };
  } catch (error) {
    error.msg = "取得信譽明細失敗";
    logger.error(error, null, "getSupplierReputationDetail");
    throw error;
  } finally {
    client.release();
  }
}

// 檢查供應商是否被封鎖
async function assertSupplierNotBlocked(supplierId) {
  const blocks = await getActiveBlocks([supplierId]);
  const blockUntil = blocks.get(Number(supplierId));
  if (blockUntil) {
    const err = new Error("供應商目前已被封鎖");
    err.isBlocked = true;
    err.blockUntil = blockUntil;
    throw err;
  }
}

// 取得封鎖中供應商清單
async function getBlockedSuppliers() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT
        b.block_id,
        b.supplier_id,
        s.supplier_name,
        b.block_until,
        b.reason
       FROM supplier_block b
       JOIN supplier s ON s.supplier_id = b.supplier_id
       WHERE b.block_until > NOW()
       ORDER BY b.block_until DESC`
    );
    return res.rows;
  } catch (error) {
    error.msg = "取得封鎖名單失敗";
    logger.error(error, null, "getBlockedSuppliers");
    throw error;
  } finally {
    client.release();
  }
}

// 手動解除封鎖
async function unblockSupplierBlock(blockId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE supplier_block
       SET block_until = NOW()
       WHERE block_id = $1
       RETURNING block_id, supplier_id, block_until`,
      [blockId]
    );
    if (res.rowCount === 0) {
      const err = new Error("找不到封鎖紀錄");
      err.isNotFound = true;
      throw err;
    }
    return res.rows[0];
  } catch (error) {
    if (!error.msg) {
      error.msg = "解除封鎖失敗";
    }
    logger.error(error, null, "unblockSupplierBlock");
    throw error;
  } finally {
    client.release();
  }
}

export {
  getReputationRule,
  updateReputationRule,
  getEventTypes,
  createEventType,
  updateEventType,
  createSupplierEvent,
  getSupplierEvents,
  recalculateSupplierScore,
  getSupplierReputationSummaries,
  getSupplierReputationDetail,
  assertSupplierNotBlocked,
  getBlockedSuppliers,
  unblockSupplierBlock,
};
