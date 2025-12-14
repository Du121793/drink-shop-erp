import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";
import { getStockByBomId, deductStock, returnStock } from "./inventory.js";

/**
 * 獲取產品及其選項所需的總物料
 * @param {object} client - pg client
 * @param {number} productId - 產品ID
 * @param {Array<number>} selectedOptionIds - 選擇的選項細節ID
 * @returns {Promise<Map<number, number>>} - Map of bom_id to quantity
 */
async function getMaterialRequirements(client, productId, selectedOptionIds) {
  const requirements = new Map();

  // 獲取基礎物料
  const baseRes = await client.query(
    "SELECT bom_id, material_used_qty FROM material_product WHERE product_id = $1",
    [productId]
  );
  for (const row of baseRes.rows) {
    const qty = parseFloat(row.material_used_qty);
    requirements.set(row.bom_id, (requirements.get(row.bom_id) || 0) + qty);
  }

  // 獲取選項物料
  if (selectedOptionIds && selectedOptionIds.length > 0) {
    const optionsRes = await client.query(
      "SELECT bom_id, material_qty FROM option_detail WHERE option_detail_id = ANY($1::int[])",
      [selectedOptionIds]
    );
    for (const row of optionsRes.rows) {
      const qty = parseFloat(row.material_qty);
      requirements.set(row.bom_id, (requirements.get(row.bom_id) || 0) + qty);
    }
  }

  return requirements;
}

/**
 * 創建訂單
 * @param {Array<object>} orderItems - 訂單項目陣列
 * @returns {Promise<Array<object>>} - 包含 detail_id, productId, 和 materialRequirements 的已處理項目陣列
 */
async function createOrder(orderItems) {
  const pool = getPoolRW();
  const client = await pool.connect();

  try {
    // 1. 扁平化訂單並計算總需求
    const flattenedItems = [];
    const totalRequirements = new Map();

    for (const item of orderItems) {
      const itemRequirements = await getMaterialRequirements(
        client,
        item.menuId,
        item.selectedOptions
      );

      for (let i = 0; i < item.quantity; i++) {
        flattenedItems.push({
          productId: item.menuId,
          selectedOptions: item.selectedOptions,
          requirements: itemRequirements,
        });
      }

      for (const [bomId, qty] of itemRequirements.entries()) {
        totalRequirements.set(
          bomId,
          (totalRequirements.get(bomId) || 0) + qty * item.quantity
        );
      }
    }

    // 2. 預先檢查庫存
    for (const [bomId, requiredQty] of totalRequirements.entries()) {
      const availableStock = await getStockByBomId(bomId);
      if (availableStock < requiredQty) {
        const err = new Error(`庫存不足: 原料ID ${bomId}`);
        // 找到是哪個產品導致的錯誤
        const problemItem = orderItems.find((item) => {
          const reqs = flattenedItems.find(
            (f) => f.productId === item.menuId
          ).requirements;
          return reqs.has(bomId);
        });
        err.productId = problemItem ? problemItem.menuId : null;
        err.isStockError = true;
        throw err;
      }
    }

    // 3. 處理每個獨立訂單
    const processedItems = [];
    await client.query("BEGIN");

    for (const item of flattenedItems) {
      // 扣除庫存
      for (const [bomId, qty] of item.requirements.entries()) {
        await deductStock(client, bomId, qty);
      }

      // 創建 sales_detail 記錄
      const saleRes = await client.query(
        "INSERT INTO sales_detail (product_id, sale_time, status) VALUES ($1, NOW(), FALSE) RETURNING detail_id",
        [item.productId]
      );
      const detailId = saleRes.rows[0].detail_id;

      // 創建 custom_sales_detail 記錄
      if (item.selectedOptions && item.selectedOptions.length > 0) {
        for (const optionDetailId of item.selectedOptions) {
          await client.query(
            "INSERT INTO custom_sales_detail (detail_id, option_detail_id) VALUES ($1, $2)",
            [detailId, optionDetailId]
          );
        }
      }

      processedItems.push({
        detailId: detailId,
        productId: item.productId,
        materialRequirements: Object.fromEntries(item.requirements),
      });
    }

    await client.query("COMMIT");
    return processedItems;
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = error.msg || "創建訂單失敗";
    logger.error(error, null, "createOrder");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 更新訂單狀態
 * @param {number} detailId - 銷售明細ID
 * @param {boolean} status - true 代表完成, false 代表取消
 */
async function updateOrderStatus(detailId, status) {
  const pool = getPoolRW();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    if (status === true) {
      // 完成訂單
      await client.query(
        "UPDATE sales_detail SET status = TRUE WHERE detail_id = $1",
        [detailId]
      );
    } else {
      // 取消訂單
      // 1. 獲取訂單詳情
      const orderRes = await client.query(
        "SELECT product_id FROM sales_detail WHERE detail_id = $1",
        [detailId]
      );
      if (orderRes.rows.length === 0) {
        logger.warn(
          `嘗試取消一個不存在或已被取消的訂單，detailId: ${detailId}`,
          "updateOrderStatus"
        );
        return;
      }
      const { product_id } = orderRes.rows[0];

      const optionsRes = await client.query(
        "SELECT option_detail_id FROM custom_sales_detail WHERE detail_id = $1",
        [detailId]
      );
      const selectedOptionIds = optionsRes.rows.map((r) => r.option_detail_id);

      // 2. 計算物料需求
      const requirements = await getMaterialRequirements(
        client,
        product_id,
        selectedOptionIds
      );

      // 3. 歸還庫存、此部分不實做 目前的邏輯為取消都是由於庫存錯誤
      // for (const [bomId, qty] of requirements.entries()) {
      //     await returnStock(client, bomId, qty);
      // }

      // 4. 刪除訂單 (ON DELETE CASCADE 會自動刪除 custom_sales_detail)
      await client.query("DELETE FROM sales_detail WHERE detail_id = $1", [
        detailId,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = error.msg || `更新訂單 #${detailId} 狀態失敗`;
    logger.error(error, null, "updateOrderStatus");
    throw error;
  } finally {
    client.release();
  }
}

export { createOrder, updateOrderStatus };
