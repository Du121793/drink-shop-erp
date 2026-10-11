import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";

const ROLE_COLUMNS =
  "role_id, role_name, description, is_system, is_assignable, is_active";

// 權限計算：先依角色與繼承收集 GRANT/DENY，再用使用者覆寫覆蓋結果
function buildEffectivePermissionCodes(roleRows, overrideRows) {
  const state = new Map();

  for (const row of roleRows) {
    const code = row.code;
    const effect = Number(row.effect);
    const existing = state.get(code);
    if (existing === -1) continue;
    if (effect === -1) {
      state.set(code, -1);
    } else if (effect === 1) {
      state.set(code, 1);
    }
  }

  for (const row of overrideRows) {
    const code = row.code;
    const effect = Number(row.effect);
    state.set(code, effect);
  }

  return Array.from(state.entries())
    .filter(([, effect]) => effect === 1)
    .map(([code]) => code);
}

async function getPermissions() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT permission_id, code, name, category, description, is_active
       FROM permission
       ORDER BY category, code`
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得權限清單失敗";
    logger.error(error, null, "getPermissions");
    throw error;
  } finally {
    client.release();
  }
}

async function getRoles() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT ${ROLE_COLUMNS}
       FROM role
       ORDER BY role_id`
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得角色清單失敗";
    logger.error(error, null, "getRoles");
    throw error;
  } finally {
    client.release();
  }
}

async function getRoleDetail(roleId) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const roleRes = await client.query(
      `SELECT ${ROLE_COLUMNS}
       FROM role
       WHERE role_id = $1`,
      [roleId]
    );
    if (roleRes.rowCount === 0) {
      const err = new Error("找不到角色");
      err.isNotFound = true;
      throw err;
    }

    const inheritRes = await client.query(
      `SELECT parent_role_id
       FROM role_inherit
       WHERE role_id = $1`,
      [roleId]
    );

    const permRes = await client.query(
      `SELECT rp.permission_id, rp.effect, p.code, p.name, p.category, p.description
       FROM role_permission rp
       JOIN permission p ON p.permission_id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.category, p.code`,
      [roleId]
    );

    return {
      role: roleRes.rows[0],
      inherit_role_ids: inheritRes.rows.map((row) => row.parent_role_id),
      permissions: permRes.rows,
    };
  } catch (error) {
    if (!error.msg) {
      error.msg = "取得角色詳情失敗";
    }
    logger.error(error, null, "getRoleDetail");
    throw error;
  } finally {
    client.release();
  }
}

async function createRole(payload) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO role (role_name, description, is_system, is_assignable, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING role_id`,
      [
        payload.role_name,
        payload.description || null,
        payload.is_system === true,
        payload.is_assignable !== false,
        payload.is_active !== false,
      ]
    );
    return result.rows[0].role_id;
  } catch (error) {
    error.msg = "新增角色失敗";
    logger.error(error, null, "createRole");
    throw error;
  } finally {
    client.release();
  }
}

async function updateRole(roleId, payload) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE role
       SET role_name = COALESCE($2, role_name),
           description = COALESCE($3, description),
           is_assignable = COALESCE($4, is_assignable),
           is_active = COALESCE($5, is_active)
       WHERE role_id = $1`,
      [
        roleId,
        payload.role_name || null,
        payload.description || null,
        payload.is_assignable,
        payload.is_active,
      ]
    );
  } catch (error) {
    error.msg = "更新角色失敗";
    logger.error(error, null, "updateRole");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteRole(roleId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const check = await client.query(
      "SELECT is_system FROM role WHERE role_id = $1",
      [roleId]
    );
    if (check.rowCount === 0) {
      const err = new Error("找不到角色");
      err.isNotFound = true;
      throw err;
    }
    if (check.rows[0].is_system) {
      const err = new Error("系統角色不可刪除");
      err.isBadRequest = true;
      throw err;
    }
    await client.query("DELETE FROM role WHERE role_id = $1", [roleId]);
  } catch (error) {
    if (!error.msg) {
      error.msg = "刪除角色失敗";
    }
    logger.error(error, null, "deleteRole");
    throw error;
  } finally {
    client.release();
  }
}

async function setRolePermissions(roleId, permissions = []) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM role_permission WHERE role_id = $1", [
      roleId,
    ]);

    const validItems = permissions
      .map((p) => ({
        permission_id: Number(p.permission_id),
        effect: Number(p.effect),
      }))
      .filter(
        (p) =>
          Number.isFinite(p.permission_id) && (p.effect === 1 || p.effect === -1)
      );

    for (const item of validItems) {
      await client.query(
        `INSERT INTO role_permission (role_id, permission_id, effect)
         VALUES ($1, $2, $3)`,
        [roleId, item.permission_id, item.effect]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = "更新角色權限失敗";
    logger.error(error, null, "setRolePermissions");
    throw error;
  } finally {
    client.release();
  }
}

async function setRoleInherit(roleId, parentRoleIds = []) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM role_inherit WHERE role_id = $1", [roleId]);

    const ids = parentRoleIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id !== roleId);

    for (const parentRoleId of ids) {
      await client.query(
        `INSERT INTO role_inherit (role_id, parent_role_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [roleId, parentRoleId]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = "更新角色繼承失敗";
    logger.error(error, null, "setRoleInherit");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureEmployee(lineId, employeeName) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO employee (line_id, employee_name)
       VALUES ($1, $2)
       ON CONFLICT (line_id)
       DO UPDATE SET employee_name = COALESCE(EXCLUDED.employee_name, employee.employee_name),
                     updated_at = NOW()`,
      [lineId, employeeName || null]
    );
  } catch (error) {
    error.msg = "建立員工資料失敗";
    logger.error(error, null, "ensureEmployee");
    throw error;
  } finally {
    client.release();
  }
}

async function updateEmployeeName(lineId, employeeName) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE employee
       SET employee_name = $2,
           updated_at = NOW()
       WHERE line_id = $1`,
      [lineId, employeeName]
    );
  } catch (error) {
    error.msg = "更新員工名稱失敗";
    logger.error(error, null, "updateEmployeeName");
    throw error;
  } finally {
    client.release();
  }
}

async function setEmployeeRoles(lineId, roleIds = []) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM employee_role WHERE line_id = $1", [lineId]);

    const ids = roleIds.map((id) => Number(id)).filter(Number.isFinite);
    if (ids.length) {
      const allowed = await client.query(
        `SELECT role_id
         FROM role
         WHERE role_id = ANY($1::bigint[])
           AND is_assignable = TRUE
           AND is_active = TRUE`,
        [ids]
      );
      for (const row of allowed.rows) {
        await client.query(
          `INSERT INTO employee_role (line_id, role_id)
           VALUES ($1, $2)`,
          [lineId, row.role_id]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = "更新員工角色失敗";
    logger.error(error, null, "setEmployeeRoles");
    throw error;
  } finally {
    client.release();
  }
}

async function setEmployeeOverrides(lineId, overrides = []) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM employee_permission_override WHERE line_id = $1",
      [lineId]
    );

    const valid = overrides
      .map((o) => ({
        permission_id: Number(o.permission_id),
        effect: Number(o.effect),
        expires_at: o.expires_at ? new Date(o.expires_at) : null,
        note: o.note || null,
      }))
      .filter(
        (o) =>
          Number.isFinite(o.permission_id) && (o.effect === 1 || o.effect === -1)
      );

    for (const item of valid) {
      await client.query(
        `INSERT INTO employee_permission_override
         (line_id, permission_id, effect, expires_at, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [lineId, item.permission_id, item.effect, item.expires_at, item.note]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = "更新員工覆寫權限失敗";
    logger.error(error, null, "setEmployeeOverrides");
    throw error;
  } finally {
    client.release();
  }
}

async function getEmployeesWithRoles() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         e.line_id,
         e.employee_name,
         e.joined_at,
         e.updated_at,
         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'role_id', r.role_id,
                 'role_name', r.role_name,
                 'is_assignable', r.is_assignable,
                 'is_active', r.is_active
               )
             )
             FROM employee_role er
             JOIN role r ON r.role_id = er.role_id
             WHERE er.line_id = e.line_id
           ),
           '[]'
         ) AS roles,
         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'permission_id', p.permission_id,
                 'code', p.code,
                 'effect', epo.effect,
                 'expires_at', epo.expires_at,
                 'note', epo.note
               )
             )
             FROM employee_permission_override epo
             JOIN permission p ON p.permission_id = epo.permission_id
             WHERE epo.line_id = e.line_id
           ),
           '[]'
         ) AS overrides
       FROM employee e
       ORDER BY e.joined_at ASC`
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得員工清單失敗";
    logger.error(error, null, "getEmployeesWithRoles");
    throw error;
  } finally {
    client.release();
  }
}

// 權限計算：包含角色繼承與使用者覆寫，輸出最終可用權限清單
async function getPermissionCodesByLineId(lineId) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const rolePermRes = await client.query(
      `WITH RECURSIVE role_tree AS (
         SELECT r.role_id
         FROM employee_role er
         JOIN role r ON r.role_id = er.role_id
         WHERE er.line_id = $1 AND r.is_active = TRUE
         UNION
         SELECT r2.role_id
         FROM role_inherit ri
         JOIN role_tree rt ON rt.role_id = ri.role_id
         JOIN role r2 ON r2.role_id = ri.parent_role_id
         WHERE r2.is_active = TRUE
       )
       SELECT rp.permission_id, rp.effect, p.code
       FROM role_permission rp
       JOIN role_tree rt ON rt.role_id = rp.role_id
       JOIN permission p ON p.permission_id = rp.permission_id
       WHERE p.is_active = TRUE`,
      [lineId]
    );

    const overrideRes = await client.query(
      `SELECT epo.permission_id, epo.effect, p.code
       FROM employee_permission_override epo
       JOIN permission p ON p.permission_id = epo.permission_id
       WHERE epo.line_id = $1
         AND p.is_active = TRUE
         AND (epo.expires_at IS NULL OR epo.expires_at > NOW())`,
      [lineId]
    );

    return buildEffectivePermissionCodes(
      rolePermRes.rows,
      overrideRes.rows
    );
  } catch (error) {
    error.msg = "取得權限清單失敗";
    logger.error(error, null, "getPermissionCodesByLineId");
    throw error;
  } finally {
    client.release();
  }
}

// 相容舊權限等級：以權限碼推估數值 (5=管理員, 3=管理, 1=一般)
async function getPermissionLevelByLineId(lineId) {
  const codes = await getPermissionCodesByLineId(lineId);
  if (codes.includes("system:admin")) return 5;
  if (
    codes.some((code) =>
      [
        "permissions:manage",
        "restock:rules",
        "menu:manage",
        "inventory:write",
        "supplier:manage",
        "supplier:reputation",
        "purchase:write",
      ].includes(code)
    )
  ) {
    return 3;
  }
  return codes.length > 0 ? 1 : 0;
}

async function getEmployeesByPermissionCode(permissionCode) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT line_id, employee_name
       FROM employee
       ORDER BY joined_at ASC`
    );

    const matched = [];
    for (const row of result.rows) {
      const codes = await getPermissionCodesByLineId(row.line_id);
      if (codes.includes("system:admin") || codes.includes(permissionCode)) {
        matched.push(row);
      }
    }

    return matched;
  } catch (error) {
    error.msg = "取得具備權限的員工失敗";
    logger.error(error, null, "getEmployeesByPermissionCode");
    throw error;
  } finally {
    client.release();
  }
}

export {
  getPermissions,
  getRoles,
  getRoleDetail,
  createRole,
  updateRole,
  deleteRole,
  setRolePermissions,
  setRoleInherit,
  ensureEmployee,
  updateEmployeeName,
  setEmployeeRoles,
  setEmployeeOverrides,
  getEmployeesWithRoles,
  getPermissionCodesByLineId,
  getPermissionLevelByLineId,
  getEmployeesByPermissionCode,
};
