import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";
import { getStockByBomId } from "./inventory.js";

/**
 * 僅取得所有菜單的基礎資訊，並檢查預設原料庫存是否充足
 * @returns {Promise<Array<Object>>} 簡化後的菜單資訊陣列
 */
async function getMenus() {
  const pool = getPoolRO();
  const client = await pool.connect();

  try {
    const productsResult = await client.query(
      "SELECT product_id, product_name, price FROM product WHERE is_active = TRUE ORDER BY product_id"
    );
    const products = productsResult.rows;

    if (products.length === 0) {
      return [];
    }

    const materialRequirementsResult = await client.query(
      "SELECT product_id, bom_id, material_used_qty FROM material_product"
    );

    const requirementsByProduct = materialRequirementsResult.rows.reduce(
      (acc, req) => {
        if (!acc[req.product_id]) {
          acc[req.product_id] = [];
        }
        acc[req.product_id].push({
          bom_id: req.bom_id,
          quantity: parseFloat(req.material_used_qty),
        });
        return acc;
      },
      {}
    );

    const menu = await Promise.all(
      products.map(async (product) => {
        const requirements = requirementsByProduct[product.product_id] || [];
        let isAvailable = true;

        for (const req of requirements) {
          const stock = await getStockByBomId(req.bom_id);
          if (stock < req.quantity) {
            isAvailable = false;
            break;
          }
        }

        return {
          id: product.product_id,
          name: product.product_name,
          price: product.price,
          isAvailable: isAvailable,
        };
      })
    );

    return menu;
  } catch (error) {
    error.msg = "取得菜單列表時發生錯誤";
    logger.error(error, null, "getMenus");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 根據產品 ID 取得其所有客製化選項，並為每個選項細項檢查庫存充足性
 * @param {number} productId - 要查詢的產品 ID
 * @returns {Promise<Array<Object>>} 該產品的客製化選項及可用狀態
 */
async function getOptionsByProductId(productId) {
  if (!productId) {
    throw new Error("productId is required");
  }

  const pool = getPoolRO();
  const client = await pool.connect();

  try {
    // 取得產品的基礎原料需求
    const baseRequirementsResult = await client.query(
      "SELECT bom_id, material_used_qty FROM material_product WHERE product_id = $1",
      [productId]
    );
    const baseRequirements = baseRequirementsResult.rows.map((r) => ({
      bom_id: r.bom_id,
      quantity: parseFloat(r.material_used_qty),
    }));

    // 取得該產品的所有客製化選項
    const optionsResult = await client.query(
      `
        SELECT co.option_id, co.option_name, od.option_detail_id, od.option_detail_name, od.material_qty, od.bom_id as option_bom_id, od.extra_price
        FROM product_option po
        JOIN custom_option co ON po.option_id = co.option_id
        JOIN option_detail od ON co.option_id = od.option_id
        WHERE po.product_id = $1
        ORDER BY co.option_id, od.option_detail_id;
    `,
      [productId]
    );

    if (optionsResult.rows.length === 0) {
      return [];
    }

    // 處理與組合選項資料，並非同步檢查每個細項的可用性
    const groupedOptions = {};

    for (const row of optionsResult.rows) {
      if (!groupedOptions[row.option_id]) {
        groupedOptions[row.option_id] = {
          optionId: row.option_id,
          optionName: row.option_name,
          details: [],
        };
      }

      // 計算總需求量 (基礎 + 選項)
      const totalRequirements = [...baseRequirements];
      const optionRequirement = {
        bom_id: row.option_bom_id,
        quantity: parseFloat(row.material_qty),
      };

      const existingReq = totalRequirements.find(
        (r) => r.bom_id === optionRequirement.bom_id
      );
      if (existingReq) {
        existingReq.quantity += optionRequirement.quantity;
      } else {
        totalRequirements.push(optionRequirement);
      }

      // 檢查總需求量的庫存
      let isDetailAvailable = true;
      for (const req of totalRequirements) {
        const stock = await getStockByBomId(req.bom_id);
        if (stock < req.quantity) {
          isDetailAvailable = false;
          break;
        }
      }

      groupedOptions[row.option_id].details.push({
        optionDetailId: row.option_detail_id,
        optionDetailName: row.option_detail_name,
        extraPrice: row.extra_price,
        isAvailable: isDetailAvailable,
      });
    }

    return Object.values(groupedOptions);
  } catch (error) {
    error.msg = `獲取產品 ID: ${productId} 的選項時發生錯誤`;
    logger.error(error, null, "getOptionsByProductId");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 新增菜品
 * @param {string} productName - 菜品名稱
 * @param {number} price - 菜品價格
 * @param {Array<number>} customOptionIds - 自定義選項ID陣列
 * @returns {Promise<number>} - 新增菜品的ID
 */
async function createMenu(productName, price, customOptionIds) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const productResult = await client.query(
      "INSERT INTO product (product_name, price) VALUES ($1, $2) RETURNING product_id",
      [productName, price]
    );
    const productId = productResult.rows[0].product_id;

    if (customOptionIds && customOptionIds.length > 0) {
      for (const optionId of customOptionIds) {
        await client.query(
          "INSERT INTO product_option (product_id, option_id) VALUES ($1, $2)",
          [productId, optionId]
        );
      }
    }

    await client.query("COMMIT");
    return productId;
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = "新增菜品失敗";
    logger.error(error, null, "createMenu");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 新增自定義選項
 * @param {string} optionName - 選項名稱
 * @param {Array<Object>} details - 選項詳細內容
 * @returns {Promise<number>} - 新增選項的ID
 */
async function createCustomOption(optionName, details) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const optionResult = await client.query(
      "INSERT INTO custom_option (option_name) VALUES ($1) RETURNING option_id",
      [optionName]
    );
    const optionId = optionResult.rows[0].option_id;

    if (details && details.length > 0) {
      for (const detail of details) {
        await client.query(
          "INSERT INTO option_detail (option_id, option_detail_name, material_qty, bom_id, extra_price) VALUES ($1, $2, $3, $4, $5)",
          [
            optionId,
            detail.name,
            detail.quantity,
            detail.bom_id,
            detail.extra_price,
          ]
        );
      }
    }

    await client.query("COMMIT");
    return optionId;
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = "新增自定義選項失敗";
    logger.error(error, null, "createCustomOption");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 更新菜品
 * @param {number} productId - 要更新的菜品ID
 * @param {object} productData - 菜品資料
 * @param {string} productData.name - 菜品名稱
 * @param {number} productData.price - 菜品價格
 * @returns {Promise<void>}
 */
async function updateMenu(productId, { name, price }) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query(
      "UPDATE product SET product_name = $1, price = $2 WHERE product_id = $3",
      [name, price, productId]
    );
  } catch (error) {
    error.msg = `更新菜品 #${productId} 失敗`;
    logger.error(error, null, "updateMenu");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 刪除菜品 (軟刪除)
 * @param {number} productId - 要刪除的菜品ID
 * @returns {Promise<void>}
 */
async function deleteMenu(productId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query(
      "UPDATE product SET is_active = FALSE WHERE product_id = $1",
      [productId]
    );
  } catch (error) {
    error.msg = `刪除菜品 #${productId} 失敗`;
    logger.error(error, null, "deleteMenu");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 更新自定義選項
 * @param {number} optionId - 要更新的選項ID
 * @param {object} optionData - 選項資料
 * @param {string} optionData.name - 選項名稱
 * @param {Array<Object>} optionData.details - 選項詳細內容
 * @param {string} optionData.details[].name - 選項詳細名稱
 * @param {number} optionData.details[].quantity - 選項所需物料數量
 * @param {number} optionData.details[].bom_id - 選項所需物料BOM ID
 * @param {number} optionData.details[].extra_price - 選項額外價格
 * @returns {Promise<void>}
 */
async function updateCustomOption(optionId, { name, details }) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE custom_option SET option_name = $1 WHERE option_id = $2",
      [name, optionId]
    );

    await client.query("DELETE FROM option_detail WHERE option_id = $1", [
      optionId,
    ]);

    for (const detail of details) {
      await client.query(
        "INSERT INTO option_detail (option_id, option_detail_name, material_qty, bom_id, extra_price) VALUES ($1, $2, $3, $4, $5)",
        [
          optionId,
          detail.name,
          detail.quantity,
          detail.bom_id,
          detail.extra_price,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = `更新選項 #${optionId} 失敗`;
    logger.error(error, null, "updateCustomOption");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 刪除自定義選項
 * @param {number} optionId - 要刪除的選項ID
 * @returns {Promise<void>}
 */
async function deleteCustomOption(optionId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM product_option WHERE option_id = $1", [
      optionId,
    ]);
    await client.query("DELETE FROM option_detail WHERE option_id = $1", [
      optionId,
    ]);
    await client.query("DELETE FROM custom_option WHERE option_id = $1", [
      optionId,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = `刪除選項 #${optionId} 失敗`;
    logger.error(error, null, "deleteCustomOption");
    throw error;
  } finally {
    client.release();
  }
}

async function getAllCustomOptions() {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const optionsResult = await client.query(`
        SELECT co.option_id, co.option_name, od.option_detail_id, od.option_detail_name, od.material_qty, od.bom_id, od.extra_price
        FROM custom_option co
        LEFT JOIN option_detail od ON co.option_id = od.option_id
        ORDER BY co.option_id, od.option_detail_id;
    `);

    const groupedOptions = {};
    for (const row of optionsResult.rows) {
      if (!groupedOptions[row.option_id]) {
        groupedOptions[row.option_id] = {
          optionId: row.option_id,
          optionName: row.option_name,
          details: [],
        };
      }
      // Only add details if they exist (left join might return nulls for option_detail columns)
      if (row.option_detail_id) {
        groupedOptions[row.option_id].details.push({
          optionDetailId: row.option_detail_id,
          optionDetailName: row.option_detail_name,
          materialQty: row.material_qty,
          bomId: row.bom_id,
          extraPrice: row.extra_price,
        });
      }
    }
    return Object.values(groupedOptions);
  } catch (error) {
    error.msg = "獲取所有自定義選項失敗";
    logger.error(error, null, "getAllCustomOptions");
    throw error;
  } finally {
    client.release();
  }
}

export {
  getMenus,
  getOptionsByProductId,
  createMenu,
  createCustomOption,
  updateMenu,
  deleteMenu,
  updateCustomOption,
  deleteCustomOption,
  getAllCustomOptions,
};
