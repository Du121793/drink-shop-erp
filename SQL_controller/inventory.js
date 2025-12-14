import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";

/**
 * 根據 bom_id 獲取有效庫存總量
 * @param {number} bomId - 要查詢的原料 ID (bom_id)
 * @returns {Promise<number>} 該原料的有效庫存總量，如果找不到則返回 0
 */
async function getStockByBomId(bomId) {
  if (!bomId) {
    throw new Error("bomId is required");
  }

  const pool = getPoolRO();
  const client = await pool.connect();
  const query = `
    SELECT SUM(i.remaining_qty) as total_stock
    FROM inventory i
    JOIN bom b ON i.bom_id = b.bom_id
    WHERE i.bom_id = $1
      AND (b.shelf_life_days IS NULL OR (i.stock_in_time + (b.shelf_life_days * INTERVAL '1 day')) >= NOW());
  `;

  try {
    const result = await client.query(query, [bomId]);
    if (result.rows.length === 0 || result.rows[0].total_stock === null) {
      return 0;
    }
    return parseFloat(result.rows[0].total_stock);
  } catch (error) {
    error.msg = `獲取 bom_id: ${bomId} 的庫存時發生錯誤`;
    logger.error(error, null, "getStockByBomId");
    throw error;
  } finally {
    client.release();
  }
}

async function getAllStock() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const query = `
      SELECT b.bom_id, b.material_name, b.max_stock_qty, SUM(i.remaining_qty) as total_stock
      FROM bom b
      LEFT JOIN inventory i ON b.bom_id = i.bom_id
      AND (b.shelf_life_days IS NULL OR (i.stock_in_time + (b.shelf_life_days * INTERVAL '1 day')) >= NOW())
      GROUP BY b.bom_id, b.material_name, b.max_stock_qty
      ORDER BY b.bom_id;
    `;
    const result = await client.query(query);
    return result.rows.map((row) => ({
      ...row,
      total_stock: parseFloat(row.total_stock) || 0,
    }));
  } catch (error) {
    error.msg = "獲取所有庫存失敗";
    logger.error(error, null, "getAllStock");
    throw error;
  } finally {
    client.release();
  }
}

async function getStockHistory(bomId) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT inventory_id, stock_in_time, stock_in_qty, remaining_qty FROM inventory WHERE bom_id = $1 ORDER BY stock_in_time DESC",
      [bomId]
    );
    return result.rows;
  } catch (error) {
    error.msg = `獲取 bom_id: ${bomId} 的庫存歷史失敗`;
    logger.error(error, null, "getStockHistory");
    throw error;
  } finally {
    client.release();
  }
}

async function addStock(bomId, quantity, stockInTime) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    const result = await client.query(
      "INSERT INTO inventory (bom_id, stock_in_qty, remaining_qty, stock_in_time) VALUES ($1, $2, $2, $3) RETURNING inventory_id",
      [bomId, quantity, stockInTime]
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

async function updateStock(bomId, newQuantity) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentStock = await getStockByBomId(bomId);
    const diff = newQuantity - currentStock;

    if (diff > 0) {
      await client.query(
        "INSERT INTO inventory (bom_id, stock_in_qty, remaining_qty, stock_in_time) VALUES ($1, $2, $2, NOW())",
        [bomId, diff]
      );
    } else if (diff < 0) {
      let amountToReduce = Math.abs(diff);
      const validStocks = await client.query(
        `SELECT i.inventory_id, i.remaining_qty
         FROM inventory i
         JOIN bom b ON i.bom_id = b.bom_id
         WHERE i.bom_id = $1 AND i.remaining_qty > 0
           AND (b.shelf_life_days IS NULL OR (i.stock_in_time + (b.shelf_life_days * INTERVAL '1 day')) >= NOW())
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
    error.msg = `更新 bom_id: ${bomId} 的庫存失敗`;
    logger.error(error, null, "updateStock");
    throw error;
  } finally {
    client.release();
  }
}

async function updateInventoryDetail(
  inventoryId,
  { stock_in_qty, remaining_qty }
) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    if (remaining_qty !== undefined) {
      const inQtyResult = await client.query(
        "SELECT stock_in_qty FROM inventory WHERE inventory_id = $1",
        [inventoryId]
      );
      if (remaining_qty > inQtyResult.rows[0].stock_in_qty) {
        throw new Error("剩餘量不能大於入庫量");
      }
      await client.query(
        "UPDATE inventory SET remaining_qty = $1 WHERE inventory_id = $2",
        [remaining_qty, inventoryId]
      );
    }
    if (stock_in_qty !== undefined) {
      await client.query(
        "UPDATE inventory SET stock_in_qty = $1 WHERE inventory_id = $2",
        [stock_in_qty, inventoryId]
      );
    }
  } catch (error) {
    error.msg = `更新庫存明細 #${inventoryId} 失敗`;
    logger.error(error, null, "updateInventoryDetail");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteInventoryDetail(inventoryId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM inventory WHERE inventory_id = $1", [
      inventoryId,
    ]);
  } catch (error) {
    error.msg = `刪除庫存明細 #${inventoryId} 失敗`;
    logger.error(error, null, "deleteInventoryDetail");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 獲取所有BOM
 * @returns {Promise<Array<Object>>}
 */
async function getBoms() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM bom");
    return result.rows;
  } catch (error) {
    error.msg = "獲取BOM列表失敗";
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
        error.msg = "新增BOM失敗";
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
        error.msg = `更新BOM #${bomId} 失敗`;
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
        error.msg = "批次更新BOM失敗";
        logger.error(error, null, "updateBoms");
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 扣除庫存 (FIFO)
 * @param {object} client - pg client
 * @param {number} bomId - bom_id
 * @param {number} amountToReduce - 要扣除的數量
 */
async function deductStock(client, bomId, amountToReduce) {
    if (amountToReduce <= 0) return;

    const validStocks = await client.query(
      `SELECT i.inventory_id, i.remaining_qty
       FROM inventory i
       JOIN bom b ON i.bom_id = b.bom_id
       WHERE i.bom_id = $1 AND i.remaining_qty > 0
         AND (b.shelf_life_days IS NULL OR (i.stock_in_time + (b.shelf_life_days * INTERVAL '1 day')) >= NOW())
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
      // 新增消耗紀錄
      await client.query(
        "INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, reason) VALUES ($1, $2, 'Sale')",
        [bomId, reduction]
      );
      remainingToReduce -= reduction;
    }

    if (remainingToReduce > 0) {
        // This case should be prevented by the pre-check, but as a safeguard:
        throw new Error(`庫存扣除失敗，原料ID ${bomId} 最終仍有 ${remainingToReduce} 數量不足`);
    }
}

/**
 * 歸還庫存
 * @param {object} client - pg client
 * @param {number} bomId - bom_id
 * @param {number} quantity - 要歸還的數量
 */
async function returnStock(client, bomId, quantity) {
    if (quantity <= 0) return;
    
    // 記錄一筆負消耗，代表歸還
    await client.query(
        "INSERT INTO inventory_consumption_log (bom_id, quantity_consumed, reason) VALUES ($1, $2, 'Order Cancellation')",
        [bomId, -quantity]
    );

    // 簡單地將歸還的庫存作為一筆新的入庫紀錄
    await client.query(
        "INSERT INTO inventory (bom_id, stock_in_qty, remaining_qty, stock_in_time) VALUES ($1, $2, $2, NOW())",
        [bomId, quantity]
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
