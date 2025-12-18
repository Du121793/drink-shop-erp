import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";

// 取得單一原料有效庫存（依 expiry_time 過濾）
async function getStockByBomId(bomId) {
  if (!bomId) throw new Error("bomId is required");

  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT SUM(remaining_qty) AS total_stock
      FROM inventory
      WHERE bom_id = $1
        AND expiry_time >= NOW()
      `,
      [bomId]
    );
    const total = result.rows[0]?.total_stock;
    return total === null ? 0 : parseFloat(total) || 0;
  } catch (error) {
    error.msg = `查詢 bom_id: ${bomId} 的庫存時發生錯誤`;
    logger.error(error, null, "getStockByBomId");
    throw error;
  } finally {
    client.release();
  }
}

// 取得所有原料庫存（有效期內）
async function getAllStock() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT b.bom_id, b.material_name, b.max_stock_qty, SUM(i.remaining_qty) AS total_stock
      FROM bom b
      LEFT JOIN inventory i ON b.bom_id = i.bom_id AND i.expiry_time >= NOW()
      GROUP BY b.bom_id, b.material_name, b.max_stock_qty
      ORDER BY b.bom_id;
    `);
    return result.rows.map((row) => ({
      ...row,
      total_stock: parseFloat(row.total_stock) || 0,
    }));
  } catch (error) {
    error.msg = "查詢庫存列表失敗";
    logger.error(error, null, "getAllStock");
    throw error;
  } finally {
    client.release();
  }
}

// 庫存歷史
async function getStockHistory(bomId) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT inventory_id, stock_in_time, stock_in_qty, remaining_qty, expiry_time FROM inventory WHERE bom_id = $1 ORDER BY stock_in_time DESC",
      [bomId]
    );
    return result.rows;
  } catch (error) {
    error.msg = `查詢 bom_id: ${bomId} 的入庫歷史失敗`;
    logger.error(error, null, "getStockHistory");
    throw error;
  } finally {
    client.release();
  }
}

// 新增庫存
async function addStock(bomId, quantity, stockInTime, expiryTime) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const stockTime = stockInTime ? new Date(stockInTime) : new Date();
    const expTime = expiryTime ? new Date(expiryTime) : stockTime;
    const result = await client.query(
      "INSERT INTO inventory (bom_id, stock_in_qty, remaining_qty, stock_in_time, expiry_time) VALUES ($1, $2, $2, $3, $4) RETURNING inventory_id",
      [bomId, quantity, stockTime, expTime]
    );
    return result.rows[0].inventory_id;
  } catch (error) {
    error.msg = "新增庫存失敗";
    logger.error(error, null, "addStock");
    throw error;
  } finally {
    client.release();
  }
}

// 直接設定總庫存（多退少補），補貨時可帶入 expiryTime
async function updateStock(bomId, newQuantity, expiryTime) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentStock = await getStockByBomId(bomId);
    const diff = newQuantity - currentStock;

    if (diff > 0) {
      const expTime = expiryTime ? new Date(expiryTime) : new Date();
      await client.query(
        "INSERT INTO inventory (bom_id, stock_in_qty, remaining_qty, stock_in_time, expiry_time) VALUES ($1, $2, $2, NOW(), $3)",
        [bomId, diff, expTime]
      );
    } else if (diff < 0) {
      let amountToReduce = Math.abs(diff);
      const validStocks = await client.query(
        `SELECT i.inventory_id, i.remaining_qty
         FROM inventory i
         WHERE i.bom_id = $1 AND i.remaining_qty > 0
           AND i.expiry_time >= NOW()
         ORDER BY i.stock_in_time ASC`,
        [bomId]
      );

      for (const stock of validStocks.rows) {
        if (amountToReduce <= 0) break;
        const reduction = Math.min(amountToReduce, stock.remaining_qty);
        await client.query(
          "UPDATE inventory SET remaining_qty = remaining_qty - $1 WHERE inventory_id = $2",
          [reduction, stock.inventory_id]
        );
        amountToReduce -= reduction;
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = `更新 bom_id: ${bomId} 庫存失敗`;
    logger.error(error, null, "updateStock");
    throw error;
  } finally {
    client.release();
  }
}

// 更新單筆庫存紀錄
async function updateInventoryDetail(
  inventoryId,
  { stock_in_qty, remaining_qty, expiry_time }
) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (remaining_qty !== undefined) {
      const inQtyResult = await client.query(
        "SELECT stock_in_qty FROM inventory WHERE inventory_id = $1",
        [inventoryId]
      );
      if (remaining_qty > inQtyResult.rows[0].stock_in_qty) {
        throw new Error("剩餘量不可大於入庫量");
      }
      updates.push(`remaining_qty = $${idx++}`);
      values.push(remaining_qty);
    }
    if (stock_in_qty !== undefined) {
      updates.push(`stock_in_qty = $${idx++}`);
      values.push(stock_in_qty);
    }
    if (expiry_time !== undefined) {
      updates.push(`expiry_time = $${idx++}`);
      values.push(new Date(expiry_time));
    }
    if (!updates.length) {
      throw new Error("請提供更新欄位");
    }
    values.push(inventoryId);
    const sql = `UPDATE inventory SET ${updates.join(", ")} WHERE inventory_id = $${idx}`;
    await client.query(sql, values);
  } catch (error) {
    error.msg = `更新庫存紀錄 #${inventoryId} 失敗`;
    logger.error(error, null, "updateInventoryDetail");
    throw error;
  } finally {
    client.release();
  }
}

// 刪除單筆庫存紀錄
async function deleteInventoryDetail(inventoryId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM inventory WHERE inventory_id = $1", [
      inventoryId,
    ]);
  } catch (error) {
    error.msg = `刪除庫存紀錄 #${inventoryId} 失敗`;
    logger.error(error, null, "deleteInventoryDetail");
    throw error;
  } finally {
    client.release();
  }
}

// 取得所有 BOM
async function getBoms() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM bom");
    return result.rows;
  } catch (error) {
    error.msg = "查詢 BOM 列表失敗";
    logger.error(error, null, "getBoms");
    throw error;
  } finally {
    client.release();
  }
}

async function createBom(materialData) {
  const pool = getPoolRW();
  const client = await pool.connect();
  const { material_name, shelf_life_days, max_stock_qty } = materialData;
  try {
    const result = await client.query(
      "INSERT INTO bom (material_name, shelf_life_days, max_stock_qty) VALUES ($1, $2, $3) RETURNING bom_id",
      [material_name, shelf_life_days, max_stock_qty]
    );
    return result.rows[0].bom_id;
  } catch (error) {
    error.msg = "新增 BOM 失敗";
    logger.error(error, null, "createBom");
    throw error;
  } finally {
    client.release();
  }
}

async function updateBom(bomId, materialData) {
  const pool = getPoolRW();
  const client = await pool.connect();
  const { material_name, shelf_life_days, max_stock_qty } = materialData;
  try {
    await client.query(
      "UPDATE bom SET material_name = $1, shelf_life_days = $2, max_stock_qty = $3 WHERE bom_id = $4",
      [material_name, shelf_life_days, max_stock_qty, bomId]
    );
  } catch (error) {
    error.msg = `更新 BOM #${bomId} 失敗`;
    logger.error(error, null, "updateBom");
    throw error;
  } finally {
    client.release();
  }
}

async function updateBoms(bomsData) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const bom of bomsData) {
      const { bom_id, material_name, shelf_life_days, max_stock_qty } = bom;
      await client.query(
        "UPDATE bom SET material_name = $1, shelf_life_days = $2, max_stock_qty = $3 WHERE bom_id = $4",
        [material_name, shelf_life_days, max_stock_qty, bom_id]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = "批次更新 BOM 失敗";
    logger.error(error, null, "updateBoms");
    throw error;
  } finally {
    client.release();
  }
}

// 扣庫存 (FIFO，僅使用未過期庫存)
async function deductStock(client, bomId, amountToReduce) {
  if (amountToReduce <= 0) return;

  const validStocks = await client.query(
    `SELECT i.inventory_id, i.remaining_qty
     FROM inventory i
     WHERE i.bom_id = $1 AND i.remaining_qty > 0
       AND i.expiry_time >= NOW()
     ORDER BY i.stock_in_time ASC`,
    [bomId]
  );

  let remainingToReduce = amountToReduce;
  for (const stock of validStocks.rows) {
    if (remainingToReduce <= 0) break;
    const reduction = Math.min(remainingToReduce, stock.remaining_qty);
    await client.query(
      "UPDATE inventory SET remaining_qty = remaining_qty - $1 WHERE inventory_id = $2",
      [reduction, stock.inventory_id]
    );
    await client.query(
      "INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, reason) VALUES ($1, $2, 'Sale')",
      [bomId, reduction]
    );
    remainingToReduce -= reduction;
  }

  if (remainingToReduce > 0) {
    throw new Error(`庫存扣除失敗，物料 ${bomId} 仍缺少 ${remainingToReduce}`);
  }
}

// 退回庫存（新增入庫記錄）
async function returnStock(client, bomId, quantity, expiryTime) {
  if (quantity <= 0) return;

  await client.query(
    "INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, reason) VALUES ($1, $2, 'Order Cancellation')",
    [bomId, -quantity]
  );

  const expTime = expiryTime ? new Date(expiryTime) : new Date();
  await client.query(
    "INSERT INTO inventory (bom_id, stock_in_qty, remaining_qty, stock_in_time, expiry_time) VALUES ($1, $2, $2, NOW(), $3)",
    [bomId, quantity, expTime]
  );
}

export {
  getStockByBomId,
  getBoms,
  getAllStock,
  getStockHistory,
  addStock,
  updateStock,
  updateInventoryDetail,
  deleteInventoryDetail,
  createBom,
  updateBom,
  updateBoms,
  deductStock,
  returnStock,
};
