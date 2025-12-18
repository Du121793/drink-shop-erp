import { getPoolRO, getPoolRW } from "./db_connect.js";
import * as logger from "../methods/logger.js";
import { getStockByBomId } from "./inventory.js";

/**
 * 取得菜單列表，並檢查是否有足夠庫存（依 expiry_time 判斷未過期）。
 */
async function getMenus(includeInactive = false) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const activeFilter = includeInactive ? "" : "WHERE p.is_active = TRUE";
    const query = `
      WITH StockAvailability AS (
        SELECT
          i.bom_id,
          COALESCE(SUM(i.remaining_qty), 0) AS available_stock
        FROM inventory i
        WHERE i.expiry_time >= NOW()
        GROUP BY i.bom_id
      ),
      ProductMaterialCheck AS (
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
        SELECT
          pmc.product_id,
          BOOL_AND(pmc.is_sufficient) AS is_available
        FROM ProductMaterialCheck pmc
        GROUP BY pmc.product_id
      )
      SELECT
        p.product_id,
        p.product_name,
        p.price,
        p.is_active,
        COALESCE(poa.is_available, TRUE) AS "isAvailable"
      FROM product p
      LEFT JOIN ProductOverallAvailability poa ON p.product_id = poa.product_id
      ${activeFilter}
      ORDER BY p.product_id;
    `;

    const result = await client.query(query);
    return result.rows.map((row) => ({
      id: row.product_id,
      name: row.product_name,
      price: row.price,
      isAvailable: row.isAvailable,
      is_active: row.is_active,
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
 * 取得產品的客製選項，並檢查每個選項組合的庫存是否足夠（依 expiry_time）。
 */
async function getOptionsByProductId(productId) {
  if (!productId) {
    throw new Error("productId is required");
  }

  const pool = getPoolRO();
  const client = await pool.connect();

  try {
    const baseRequirementsResult = await client.query(
      "SELECT bom_id, material_used_qty FROM material_product WHERE product_id = $1",
      [productId]
    );
    const baseRequirements = baseRequirementsResult.rows.map((r) => ({
      bom_id: r.bom_id,
      quantity: parseFloat(r.material_used_qty),
    }));

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

    const groupedOptions = {};

    for (const row of optionsResult.rows) {
      if (!groupedOptions[row.option_id]) {
        groupedOptions[row.option_id] = {
          optionId: row.option_id,
          optionName: row.option_name,
          details: [],
        };
      }

      // 計算此選項明細加上基礎材料的總需求
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

      // 檢查所有需求對應的庫存是否足夠
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
    error.msg = `取得產品 ID: ${productId} 的客製選項失敗`;
    logger.error(error, null, "getOptionsByProductId");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 建立菜單
 */
async function createMenu(productName, price, customOptionIds, baseMaterials) {
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
    error.msg = "新增菜單失敗";
    logger.error(error, null, "createMenu");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 建立客製選項
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
    error.msg = "新增客製選項失敗";
    logger.error(error, null, "createCustomOption");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 更新菜單
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
      const updateProductQuery = `UPDATE product SET ${productFields.join(
        ", "
      )} WHERE product_id = $${fieldIndex}`;
      await client.query(updateProductQuery, productValues);
    }

    if (optionIds !== undefined) {
      await client.query("DELETE FROM product_option WHERE product_id = $1", [
        productId,
      ]);
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
      await client.query("DELETE FROM material_product WHERE product_id = $1", [
        productId,
      ]);
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
    error.msg = `更新菜單 #${productId} 失敗`;
    logger.error(error, null, "updateMenu");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 硬刪菜單
 */
async function deleteMenu(productId) {
  const pool = getPoolRW();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM product_option WHERE product_id = $1", [
      productId,
    ]);
    await client.query("DELETE FROM material_product WHERE product_id = $1", [
      productId,
    ]);
    await client.query("DELETE FROM product WHERE product_id = $1", [
      productId,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    error.msg = `刪除菜單 #${productId} 失敗`;
    logger.error(error, null, "deleteMenu");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 更新客製選項
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
    error.msg = `更新客製選項 #${optionId} 失敗`;
    logger.error(error, null, "updateCustomOption");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 刪除客製選項
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
    error.msg = `刪除客製選項 #${optionId} 失敗`;
    logger.error(error, null, "deleteCustomOption");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 取得所有客製選項
 */
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
    error.msg = "取得自定義選項失敗";
    logger.error(error, null, "getAllCustomOptions");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 取得產品的基礎原料
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
