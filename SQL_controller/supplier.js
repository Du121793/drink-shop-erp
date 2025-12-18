import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";

// 取得廠商清單
async function getSuppliers() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT supplier_id, supplier_name, email, phone
       FROM supplier
       ORDER BY supplier_id`
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得廠商列表失敗";
    logger.error(error, null, "getSuppliers");
    throw error;
  } finally {
    client.release();
  }
}

// 新增廠商
async function createSupplier({ supplier_name, email, phone }) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO supplier (supplier_name, email, phone)
       VALUES ($1, $2, $3)
       RETURNING supplier_id`,
      [supplier_name, email || null, phone || null]
    );
    return result.rows[0].supplier_id;
  } catch (error) {
    error.msg = "新增廠商失敗";
    logger.error(error, null, "createSupplier");
    throw error;
  } finally {
    client.release();
  }
}

// 更新廠商
async function updateSupplier(id, { supplier_name, email, phone }) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE supplier
       SET supplier_name = COALESCE($2, supplier_name),
           email = $3,
           phone = $4
       WHERE supplier_id = $1`,
      [id, supplier_name || null, email || null, phone || null]
    );
  } catch (error) {
    error.msg = `更新廠商 #${id} 失敗`;
    logger.error(error, null, "updateSupplier");
    throw error;
  } finally {
    client.release();
  }
}

// 刪除廠商
async function deleteSupplier(id) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM supplier WHERE supplier_id = $1", [id]);
  } catch (error) {
    error.msg = `刪除廠商 #${id} 失敗`;
    logger.error(error, null, "deleteSupplier");
    throw error;
  } finally {
    client.release();
  }
}

// 取得原料-廠商對應
async function getMaterialSuppliers(bomId = null) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const params = [];
    let condition = "";
    if (bomId) {
      condition = "WHERE ms.bom_id = $1";
      params.push(bomId);
    }
    const result = await client.query(
      `
      SELECT
        ms.bom_id,
        ms.supplier_id,
        ms.is_default,
        s.supplier_name,
        s.email,
        s.phone
      FROM material_supplier ms
      JOIN supplier s ON s.supplier_id = ms.supplier_id
      ${condition}
      ORDER BY ms.bom_id, ms.is_default DESC, ms.supplier_id;
      `,
      params
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得原料-廠商關聯失敗";
    logger.error(error, null, "getMaterialSuppliers");
    throw error;
  } finally {
    client.release();
  }
}

// 設定預設廠商（同一原料僅一個 is_default）
async function setDefaultMaterialSupplier(bomId, supplierId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE material_supplier SET is_default = FALSE WHERE bom_id = $1",
      [bomId]
    );
    await client.query(
      `
      INSERT INTO material_supplier (supplier_id, bom_id, is_default)
      VALUES ($1, $2, TRUE)
      ON CONFLICT (supplier_id, bom_id)
      DO UPDATE SET is_default = TRUE
      `,
      [supplierId, bomId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = `設定原料 #${bomId} 的預設廠商失敗`;
    logger.error(error, null, "setDefaultMaterialSupplier");
    throw error;
  } finally {
    client.release();
  }
}

// 新增/更新原料-廠商對應
async function upsertMaterialSupplier({ supplier_id, bom_id, is_default = false }) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (is_default) {
      await client.query(
        "UPDATE material_supplier SET is_default = FALSE WHERE bom_id = $1",
        [bom_id]
      );
    }
    await client.query(
      `
      INSERT INTO material_supplier (supplier_id, bom_id, is_default)
      VALUES ($1, $2, $3)
      ON CONFLICT (supplier_id, bom_id)
      DO UPDATE SET is_default = EXCLUDED.is_default
      `,
      [supplier_id, bom_id, is_default]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = "更新原料-廠商關聯失敗";
    logger.error(error, null, "upsertMaterialSupplier");
    throw error;
  } finally {
    client.release();
  }
}

// 移除原料-廠商對應
async function deleteMaterialSupplier(supplierId, bomId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query(
      "DELETE FROM material_supplier WHERE supplier_id = $1 AND bom_id = $2",
      [supplierId, bomId]
    );
  } catch (error) {
    error.msg = "刪除原料-廠商關聯失敗";
    logger.error(error, null, "deleteMaterialSupplier");
    throw error;
  } finally {
    client.release();
  }
}

// 取得指定原料的預設廠商
async function getDefaultSuppliersForBoms(bomIds = []) {
  if (!bomIds.length) return [];
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT
        ms.bom_id,
        s.supplier_id,
        s.supplier_name,
        s.email,
        s.phone
      FROM material_supplier ms
      JOIN supplier s ON s.supplier_id = ms.supplier_id
      WHERE ms.is_default = TRUE AND ms.bom_id = ANY($1::int[])
      `,
      [bomIds]
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得預設廠商失敗";
    logger.error(error, null, "getDefaultSuppliersForBoms");
    throw error;
  } finally {
    client.release();
  }
}

// 寫入叫貨紀錄
async function createPurchaseOrderLogs(records = []) {
  if (!records.length) {
    throw new Error("orders array is required");
  }
  const pool = getPoolRW();
  const client = await pool.connect();
  const inserted = [];
  try {
    await client.query("BEGIN");
    for (const rec of records) {
      const { supplier_id, bom_id, order_qty, order_time } = rec;
      const result = await client.query(
        `
        INSERT INTO purchase_order_log (supplier_id, bom_id, order_qty, order_time)
        VALUES ($1, $2, $3, COALESCE($4, NOW()))
        RETURNING order_id, order_time
        `,
        [supplier_id, bom_id, order_qty, order_time ? new Date(order_time) : null]
      );
      inserted.push(result.rows[0]);
    }
    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = "新增叫貨紀錄失敗";
    logger.error(error, null, "createPurchaseOrderLogs");
    throw error;
  } finally {
    client.release();
  }
}

// 取得叫貨紀錄分批列表（同分鐘視為同一批次）
async function getPurchaseOrderGroups() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      WITH grouped AS (
        SELECT
          date_trunc('minute', order_time) AS batch_time,
          order_id,
          supplier_id,
          bom_id,
          order_qty,
          order_time,
          order_status
        FROM purchase_order_log
      )
      SELECT
        batch_time,
        json_agg(
          json_build_object(
            'order_id', order_id,
            'supplier_id', supplier_id,
            'bom_id', bom_id,
            'order_qty', order_qty,
            'order_time', order_time,
            'order_status', order_status
          ) ORDER BY order_id
        ) AS items
      FROM grouped
      GROUP BY batch_time
      ORDER BY batch_time DESC;
      `
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得叫貨紀錄失敗";
    logger.error(error, null, "getPurchaseOrderGroups");
    throw error;
  } finally {
    client.release();
  }
}

// 更新採購紀錄狀態（僅允許從狀態 0 更新為 1 或 3）
async function updatePurchaseOrderStatus(orderId, status) {
  if (!orderId) {
    const err = new Error("order_id is required");
    err.isBadRequest = true;
    throw err;
  }
  if (![1, 3].includes(Number(status))) {
    const err = new Error("狀態僅能更新為 1 或 3");
    err.isBadRequest = true;
    throw err;
  }

  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      UPDATE purchase_order_log
      SET order_status = $1
      WHERE order_id = $2 AND order_status = 0
      RETURNING order_id
      `,
      [status, orderId]
    );

    if (result.rowCount === 0) {
      const check = await client.query(
        "SELECT order_status FROM purchase_order_log WHERE order_id = $1",
        [orderId]
      );
      if (check.rowCount === 0) {
        const err = new Error("叫貨紀錄不存在");
        err.isNotFound = true;
        throw err;
      }
      const err = new Error("僅狀態 0 可更新狀態");
      err.isBadRequest = true;
      throw err;
    }
  } catch (error) {
    if (!error.msg) error.msg = `更新叫貨紀錄狀態失敗 (order_id: ${orderId})`;
    logger.error(error, null, "updatePurchaseOrderStatus");
    throw error;
  } finally {
    client.release();
  }
}

export {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getMaterialSuppliers,
  setDefaultMaterialSupplier,
  upsertMaterialSupplier,
  deleteMaterialSupplier,
  getDefaultSuppliersForBoms,
  createPurchaseOrderLogs,
  getPurchaseOrderGroups,
  updatePurchaseOrderStatus,
};
