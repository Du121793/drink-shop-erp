import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";

// 庫存規則資料存取
async function getRestockRules() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT * FROM restock_rule ORDER BY priority DESC, rule_id ASC"
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得庫存規則失敗";
    logger.error(error, null, "getRestockRules");
    throw error;
  } finally {
    client.release();
  }
}

async function getRestockRulesWithAssignments(bomIds) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const ruleResult = await client.query(
      "SELECT * FROM restock_rule ORDER BY priority DESC, rule_id ASC"
    );
    let assignmentResult = { rows: [] };
    if (Array.isArray(bomIds) && bomIds.length) {
      assignmentResult = await client.query(
        "SELECT * FROM restock_rule_assignment WHERE bom_id = ANY($1)",
        [bomIds]
      );
    }
    return { rules: ruleResult.rows, assignments: assignmentResult.rows };
  } catch (error) {
    error.msg = "取得規則與指派資料失敗";
    logger.error(error, null, "getRestockRulesWithAssignments");
    throw error;
  } finally {
    client.release();
  }
}

async function getRestockRule(ruleId) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT * FROM restock_rule WHERE rule_id = $1",
      [ruleId]
    );
    return result.rows[0] || null;
  } catch (error) {
    error.msg = `取得規則 #${ruleId} 失敗`;
    logger.error(error, null, "getRestockRule");
    throw error;
  } finally {
    client.release();
  }
}

async function createRestockRule(data) {
  const pool = getPoolRW();
  const client = await pool.connect();
  const {
    rule_name,
    rule_type = "custom",
    priority = 100,
    enabled = true,
    scope = "global",
    tags = [],
    params = {},
  } = data || {};

  try {
    const result = await client.query(
      `
      INSERT INTO restock_rule
        (rule_name, rule_type, priority, enabled, scope, tags, params)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
      RETURNING rule_id
      `,
      [
        rule_name,
        rule_type,
        priority,
        enabled,
        scope,
        JSON.stringify(tags),
        JSON.stringify(params),
      ]
    );
    return result.rows[0]?.rule_id;
  } catch (error) {
    error.msg = "新增庫存規則失敗";
    logger.error(error, null, "createRestockRule");
    throw error;
  } finally {
    client.release();
  }
}

async function updateRestockRule(ruleId, data) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const updates = [];
    const values = [];
    let idx = 1;

    // 動態組出更新欄位
    const fields = [
      "rule_name",
      "rule_type",
      "priority",
      "enabled",
      "scope",
    ];

    for (const field of fields) {
      if (data && data[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(data[field]);
      }
    }

    if (data && data.tags !== undefined) {
      updates.push(`tags = $${idx++}::jsonb`);
      values.push(JSON.stringify(data.tags));
    }

    if (data && data.params !== undefined) {
      updates.push(`params = $${idx++}::jsonb`);
      values.push(JSON.stringify(data.params));
    }

    if (!updates.length) {
      throw new Error("No fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(ruleId);

    const sql = `UPDATE restock_rule SET ${updates.join(", ")} WHERE rule_id = $${idx}`;
    await client.query(sql, values);
  } catch (error) {
    error.msg = `更新規則 #${ruleId} 失敗`;
    logger.error(error, null, "updateRestockRule");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteRestockRule(ruleId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM restock_rule WHERE rule_id = $1", [ruleId]);
  } catch (error) {
    error.msg = `刪除規則 #${ruleId} 失敗`;
    logger.error(error, null, "deleteRestockRule");
    throw error;
  } finally {
    client.release();
  }
}

async function getRestockRuleUsage(ruleId) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT a.bom_id, b.material_name, a.enabled, a.override_params
      FROM restock_rule_assignment a
      JOIN bom b ON a.bom_id = b.bom_id
      WHERE a.rule_id = $1
      ORDER BY a.bom_id ASC
      `,
      [ruleId]
    );
    return result.rows;
  } catch (error) {
    error.msg = `取得規則使用情況 #${ruleId} 失敗`;
    logger.error(error, null, "getRestockRuleUsage");
    throw error;
  } finally {
    client.release();
  }
}

async function getRestockRuleAssignmentsByBom(bomId) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT
        a.rule_id,
        a.bom_id,
        a.enabled,
        a.override_params,
        r.rule_name,
        r.rule_type,
        r.priority,
        r.scope
      FROM restock_rule_assignment a
      JOIN restock_rule r ON a.rule_id = r.rule_id
      WHERE a.bom_id = $1
      ORDER BY r.priority DESC, r.rule_id ASC
      `,
      [bomId]
    );
    return result.rows;
  } catch (error) {
    error.msg = `取得原料規則指派 #${bomId} 失敗`;
    logger.error(error, null, "getRestockRuleAssignmentsByBom");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertRestockRuleAssignment(ruleId, bomId, data) {
  const pool = getPoolRW();
  const client = await pool.connect();
  const { enabled = true, override_params = {} } = data || {};
  try {
    await client.query(
      `
      INSERT INTO restock_rule_assignment (rule_id, bom_id, enabled, override_params)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (rule_id, bom_id)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        override_params = EXCLUDED.override_params,
        updated_at = NOW()
      `,
      [ruleId, bomId, enabled, JSON.stringify(override_params)]
    );
  } catch (error) {
    error.msg = `更新規則指派失敗 (rule #${ruleId}, bom #${bomId})`;
    logger.error(error, null, "upsertRestockRuleAssignment");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteRestockRuleAssignment(ruleId, bomId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query(
      "DELETE FROM restock_rule_assignment WHERE rule_id = $1 AND bom_id = $2",
      [ruleId, bomId]
    );
  } catch (error) {
    error.msg = `刪除規則指派失敗 (rule #${ruleId}, bom #${bomId})`;
    logger.error(error, null, "deleteRestockRuleAssignment");
    throw error;
  } finally {
    client.release();
  }
}

export {
  getRestockRules,
  getRestockRulesWithAssignments,
  getRestockRule,
  createRestockRule,
  updateRestockRule,
  deleteRestockRule,
  getRestockRuleUsage,
  getRestockRuleAssignmentsByBom,
  upsertRestockRuleAssignment,
  deleteRestockRuleAssignment,
};

