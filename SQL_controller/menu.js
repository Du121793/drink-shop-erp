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
    const query = `
      WITH StockAvailability AS (
        -- Step 1: Calculate available stock for each BOM item, considering shelf life
        SELECT
          i.bom_id,
          COALESCE(SUM(i.remaining_qty), 0) AS available_stock
        FROM inventory i
        JOIN bom b ON i.bom_id = b.bom_id
        WHERE (b.shelf_life_days IS NULL OR (i.stock_in_time + (b.shelf_life_days * INTERVAL '1 day')) >= NOW())
        GROUP BY i.bom_id
      ),
      ProductMaterialCheck AS (
        -- Step 2: For each product's base material, check if stock is sufficient
        SELECT
          mp.product_id,
          mp.bom_id,
          mp.material_used_qty,
          COALESCE(sa.available_stock, 0) AS available_stock,
          (COALESCE(sa.available_stock, 0) >= mp.material_used_qty) AS is_sufficient
        FROM material_product mp
        LEFT JOIN StockAvailability sa ON mp.bom_id = sa.bom_id
      ),
      ProductOverallAvailability AS (
        -- Step 3: Determine overall availability for each product based on all its base materials
        SELECT
          pmc.product_id,
          BOOL_AND(pmc.is_sufficient) AS is_available
        FROM ProductMaterialCheck pmc
        GROUP BY pmc.product_id
      )
      -- Step 4: Final selection, joining products with their availability status
      SELECT
        p.product_id,
        p.product_name,
        p.price,
        p.is_active,
        COALESCE(poa.is_available, TRUE) AS "isAvailable" -- Products with no base materials are considered available
      FROM product p
      LEFT JOIN ProductOverallAvailability poa ON p.product_id = poa.product_id
      ORDER BY p.product_id;
    `;

    const result = await client.query(query);
    return result.rows.map(row => ({
      id: row.product_id,
      name: row.product_name,
      price: row.price,
      isAvailable: row.isAvailable,
      is_active: row.is_active, // Use the correct field name from the query
    }));

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
 * @param {Array<Object>} baseMaterials - 基礎原料
 * @returns {Promise<number>} - 新增菜品的ID
 */
async function createMenu(
  productName,
  price,
  customOptionIds,
  baseMaterials
) {
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

    if (baseMaterials && baseMaterials.length > 0) {
      for (const material of baseMaterials) {
        await client.query(
          "INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES ($1, $2, $3)",
          [productId, material.bom_id, material.quantity]
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
 * @param {object} data - 菜品資料
 * @returns {Promise<void>}
 */
async function updateMenu(productId, data) {
    const pool = getPoolRW();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const { name, price, is_active, optionIds, baseMaterials } = data;

        const productFields = [];
        const productValues = [];
        let fieldIndex = 1;

        if (name !== undefined) {
            productFields.push(`product_name = $${fieldIndex++}`);
            productValues.push(name);
        }
        if (price !== undefined) {
            productFields.push(`price = $${fieldIndex++}`);
            productValues.push(price);
        }
        if (is_active !== undefined) {
            productFields.push(`is_active = $${fieldIndex++}`);
            productValues.push(is_active);
        }
        
        if (productFields.length > 0) {
            productValues.push(productId);
            const updateProductQuery = `UPDATE product SET ${productFields.join(", ")} WHERE product_id = $${fieldIndex}`;
            await client.query(updateProductQuery, productValues);
        }

        if (optionIds !== undefined) {
            await client.query("DELETE FROM product_option WHERE product_id = $1", [productId]);
            if (optionIds.length > 0) {
                for (const optionId of optionIds) {
                    await client.query(
                        "INSERT INTO product_option (product_id, option_id) VALUES ($1, $2)",
                        [productId, optionId]
                    );
                }
            }
        }

        if (baseMaterials !== undefined) {
            await client.query("DELETE FROM material_product WHERE product_id = $1", [productId]);
            if (baseMaterials.length > 0) {
                for (const material of baseMaterials) {
                    await client.query(
                        "INSERT INTO material_product (product_id, bom_id, material_used_qty) VALUES ($1, $2, $3)",
                        [productId, material.bom_id, material.quantity]
                    );
                }
            }
        }

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        error.msg = `更新菜品 #${productId} 失敗`;
        logger.error(error, null, "updateMenu");
        throw error;
    } finally {
        client.release();
    }
}


/**
 * 刪除菜品 (硬刪除)
 * @param {number} productId - 要刪除的菜品ID
 * @returns {Promise<void>}
 */
async function deleteMenu(productId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 1. 刪除產品與客製化選項的關聯
    await client.query("DELETE FROM product_option WHERE product_id = $1", [productId]);
    // 2. 刪除產品使用的基礎原料
    await client.query("DELETE FROM material_product WHERE product_id = $1", [productId]);
    // 3. 刪除產品本身
    await client.query("DELETE FROM product WHERE product_id = $1", [productId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
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

/**
 * 根據產品 ID 取得其基礎原料
 * @param {number} productId - 產品 ID
 * @returns {Promise<Array<Object>>}
 */
async function getBaseMaterialsByProductId(productId) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT bom_id, material_used_qty as quantity 
       FROM material_product 
       WHERE product_id = $1`,
      [productId]
    );
    return result.rows;
  } catch (error) {
    error.msg = `取得產品 #${productId} 的基礎原料失敗`;
    logger.error(error, null, "getBaseMaterialsByProductId");
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
  getBaseMaterialsByProductId,
};