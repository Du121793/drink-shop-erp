import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";

// 取得角色列表
async function getRoles() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT role_id, role_name, permission_level
       FROM role
       ORDER BY permission_level DESC, role_id`
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得角色列表失敗";
    logger.error(error, null, "getRoles");
    throw error;
  } finally {
    client.release();
  }
}

// 新增角色
async function createRole({ role_name, permission_level }) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO role (role_name, permission_level)
       VALUES ($1, $2)
       ON CONFLICT (role_name) DO UPDATE SET permission_level = EXCLUDED.permission_level
       RETURNING role_id`,
      [role_name, permission_level]
    );
    return result.rows[0].role_id;
  } catch (error) {
    error.msg = "建立角色失敗";
    logger.error(error, null, "createRole");
    throw error;
  } finally {
    client.release();
  }
}

// 確保員工存在
async function ensureEmployee(lineId, employeeName = null) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO employee (line_id, employee_name)
       VALUES ($1, $2)
       ON CONFLICT (line_id) DO UPDATE SET employee_name = COALESCE($2, employee.employee_name), updated_at = NOW()`,
      [lineId, employeeName]
    );
  } catch (error) {
    error.msg = `建立/更新員工 ${lineId} 失敗`;
    logger.error(error, null, "ensureEmployee");
    throw error;
  } finally {
    client.release();
  }
}

// 設定員工角色（先清除再寫入）
async function setEmployeeRoles(lineId, roleIds = []) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM employee_role WHERE line_id = $1", [lineId]);
    for (const roleId of roleIds) {
      await client.query(
        "INSERT INTO employee_role (line_id, role_id) VALUES ($1, $2)",
        [lineId, roleId]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = `設定員工 ${lineId} 的角色失敗`;
    logger.error(error, null, "setEmployeeRoles");
    throw error;
  } finally {
    client.release();
  }
}

// 取得員工最高權限等級
async function getPermissionLevelByLineId(lineId) {
  if (!lineId) return 0;
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT COALESCE(MAX(r.permission_level), 0) AS level
      FROM employee_role er
      JOIN role r ON r.role_id = er.role_id
      WHERE er.line_id = $1
      `,
      [lineId]
    );
    return parseInt(result.rows[0]?.level ?? 0, 10);
  } catch (error) {
    error.msg = `查詢員工 ${lineId} 權限等級失敗`;
    logger.error(error, null, "getPermissionLevelByLineId");
    return 0;
  } finally {
    client.release();
  }
}

// 取得員工列表與角色
async function getEmployeesWithRoles() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT e.line_id, e.employee_name, COALESCE(array_agg(er.role_id) FILTER (WHERE er.role_id IS NOT NULL), '{}') AS roles
      FROM employee e
      LEFT JOIN employee_role er ON er.line_id = e.line_id
      GROUP BY e.line_id, e.employee_name
      ORDER BY e.line_id;
      `
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得員工資料失敗";
    logger.error(error, null, "getEmployeesWithRoles");
    throw error;
  } finally {
    client.release();
  }
}

// 更新員工名稱
async function updateEmployeeName(lineId, employeeName) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE employee SET employee_name = $2, updated_at = NOW() WHERE line_id = $1`,
      [lineId, employeeName]
    );
  } catch (error) {
    error.msg = `更新員工名稱失敗 ${lineId}`;
    logger.error(error, null, "updateEmployeeName");
    throw error;
  } finally {
    client.release();
  }
}

async function getEmployeesByPermissionLevel(minLevel = 0) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT er.line_id, MAX(r.permission_level) AS permission_level
      FROM employee_role er
      JOIN role r ON r.role_id = er.role_id
      GROUP BY er.line_id
      HAVING MAX(r.permission_level) >= $1
      ORDER BY MAX(r.permission_level) DESC, er.line_id;
      `,
      [minLevel]
    );
    return result.rows.map((row) => ({
      line_id: row.line_id,
      permission_level: parseInt(row.permission_level ?? 0, 10),
    }));
  } catch (error) {
    error.msg = `查詢權限等級 >= ${minLevel} 的員工失敗`;
    logger.error(error, null, "getEmployeesByPermissionLevel");
    throw error;
  } finally {
    client.release();
  }
}

export {
  getRoles,
  createRole,
  ensureEmployee,
  setEmployeeRoles,
  getEmployeesWithRoles,
  updateEmployeeName,
  getPermissionLevelByLineId,
  getEmployeesByPermissionLevel,
};
