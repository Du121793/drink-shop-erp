import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";
import { getStockByBomId, deductStock, returnStock } from "./inventory.js";

async function ensureProductsActive(client, productIds = []) {
  const statusMap = new Map();
  if (!productIds.length) return statusMap;

  const res = await client.query(
    "SELECT product_id, is_active, product_name FROM product WHERE product_id = ANY($1::int[])",
    [productIds]
  );

  for (const row of res.rows) {
    statusMap.set(row.product_id, {
      isActive: row.is_active === true,
      productName: row.product_name,
    });
  }

  for (const pid of productIds) {
    const info = statusMap.get(pid);
    if (!info?.isActive) {
      const err = new Error(`商品 ${pid} 無法販售，請確認是否已上架或可販售。`);
      err.isActiveError = true;
      err.productId = pid;
      throw err;
    }
  }

  return statusMap;
}


/**
 * 查詢產品及其選項總需求量
 */
async function getMaterialRequirements(client, productId, selectedOptionIds) {
  const requirements = new Map();

  const baseRes = await client.query(
    "SELECT bom_id, material_used_qty FROM material_product WHERE product_id = $1",
    [productId]
  );
  for (const row of baseRes.rows) {
    const qty = parseFloat(row.material_used_qty);
    requirements.set(row.bom_id, (requirements.get(row.bom_id) || 0) + qty);
  }

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
 * 建立訂單：先檢查上架狀態，再檢查庫存，再扣庫存建檔
 */
async function createOrder(orderItems) {
  const pool = getPoolRW();
  const client = await pool.connect();

  try {
    const productIds = [...new Set(orderItems.map((o) => o.menuId))];
    const productInfoMap = await ensureProductsActive(client, productIds);

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

    for (const [bomId, requiredQty] of totalRequirements.entries()) {
      const availableStock = await getStockByBomId(bomId);
      if (availableStock < requiredQty) {
        const err = new Error(`庫存不足: 材料ID ${bomId}`);
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

    const processedItems = [];
    await client.query("BEGIN");

    for (const item of flattenedItems) {
      for (const [bomId, qty] of item.requirements.entries()) {
        await deductStock(client, bomId, qty);
      }

      const saleRes = await client.query(
        "INSERT INTO sales_detail (product_id, sale_time, status) VALUES ($1, NOW(), FALSE) RETURNING detail_id",
        [item.productId]
      );
      const detailId = saleRes.rows[0].detail_id;

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
        productName: productInfoMap.get(item.productId)?.productName || "",
        materialRequirements: Object.fromEntries(item.requirements),
      });
    }

    await client.query("COMMIT");
    return processedItems;
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = error.msg || "建立訂單失敗";
    if (error.isActiveError) {
      error.isActiveError = true;
    }
    logger.error(error, null, "createOrder");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 更新訂單狀態；status=false 時僅刪除，不回補庫存
 */
async function updateOrderStatus(detailId, status, refund = false) {
  const pool = getPoolRW();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    if (status === true) {
      await client.query(
        "UPDATE sales_detail SET status = TRUE WHERE detail_id = $1",
        [detailId]
      );
    } else {
      const orderRes = await client.query(
        "SELECT product_id FROM sales_detail WHERE detail_id = $1",
        [detailId]
      );
      if (orderRes.rows.length === 0) {
        logger.warn(
          `嘗試取消不存在或已被刪除的訂單，detailId: ${detailId}`,
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
      const requirements = await getMaterialRequirements(
        client,
        product_id,
        selectedOptionIds
      );

      if (refund) {
        for (const [bomId, qty] of requirements.entries()) {
          await returnStock(client, bomId, qty);
        }
      }

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

async function reorderSingle(detailId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderRes = await client.query(
      "SELECT product_id FROM sales_detail WHERE detail_id = $1",
      [detailId]
    );
    if (orderRes.rows.length === 0) {
      const err = new Error(`找不到訂單 detailId=${detailId}`);
      err.isStockError = true;
      throw err;
    }
    const productId = orderRes.rows[0].product_id;
    const optionsRes = await client.query(
      "SELECT option_detail_id FROM custom_sales_detail WHERE detail_id = $1",
      [detailId]
    );
    const optionIds = optionsRes.rows.map((r) => r.option_detail_id);

    const productInfoMap = await ensureProductsActive(client, [productId]);
    const productInfo = productInfoMap.get(productId);
    const productName = productInfo?.productName || "";
    const requirements = await getMaterialRequirements(client, productId, optionIds);
    for (const [bomId, qty] of requirements.entries()) {
      const available = await getStockByBomId(bomId);
      if (available < qty) {
        const err = new Error(`庫存不足: 材料ID ${bomId}`);
        err.productId = productId;
        err.isStockError = true;
        throw err;
      }
    }

    for (const [bomId, qty] of requirements.entries()) {
      await deductStock(client, bomId, qty);
    }

    const saleRes = await client.query(
      "INSERT INTO sales_detail (product_id, sale_time, status) VALUES ($1, NOW(), FALSE) RETURNING detail_id",
      [productId]
    );
    const newDetailId = saleRes.rows[0].detail_id;

    if (optionIds.length > 0) {
      for (const optionDetailId of optionIds) {
        await client.query(
          "INSERT INTO custom_sales_detail (detail_id, option_detail_id) VALUES ($1, $2)",
          [newDetailId, optionDetailId]
        );
      }
    }

    await client.query("COMMIT");
    return {
      detailId: newDetailId,
      productId,
      productName,
      materialRequirements: Object.fromEntries(requirements),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.isActiveError) error.isActiveError = true;
    if (error.isStockError) error.isStockError = true;
    logger.error(error, null, "reorderSingle");
    throw error;
  } finally {
    client.release();
  }
}

export { createOrder, updateOrderStatus, reorderSingle };
