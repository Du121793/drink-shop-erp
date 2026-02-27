import { getPoolRO } from "./db_connect.js";
import * as logger from "../methods/logger.js";

/**
 * 取得原料統計資料，用於補貨建議計算。
 * 包含：近七日消耗、目前庫存（依 expiry_time）、即將過期庫存。
 * @param {number} days - 計算過去消耗的天數，預設 7 天。
 * @returns {Promise<Array<object>>}
 */
async function getMaterialStats(days = 7) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const query = `
        WITH RecentConsumption AS (
            -- 步驟一：計算近七日總消耗量（只計正消耗）
            SELECT
                bom_id,
                SUM(quantity_consumed) AS consumed_qty
            FROM inventory_consumption_log
            WHERE consumption_time >= NOW() - INTERVAL '${days} days' AND quantity_consumed > 0
            GROUP BY bom_id
        ),
        CurrentStock AS (
            -- 步驟二：計算每個原料目前的總庫存（依 expiry_time）
            SELECT
                b.bom_id,
                b.material_name,
                b.shelf_life_days,
                b.max_stock_qty,
                COALESCE(SUM(i.remaining_qty), 0) AS total_stock
            FROM bom b
            LEFT JOIN inventory i ON b.bom_id = i.bom_id
            AND i.expiry_time >= NOW()
            GROUP BY b.bom_id, b.material_name, b.shelf_life_days, b.max_stock_qty
        ),
        UpcomingExpiries AS (
            -- 步驟三：計算未來 7 天內即將過期的庫存量（依 expiry_time）
            SELECT
                i.bom_id,
                SUM(i.remaining_qty) as expiring_qty
            FROM inventory i
            WHERE i.expiry_time BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            GROUP BY i.bom_id
        )
        -- 步驟四：彙總各項指標並排序
        SELECT
            cs.bom_id,
            cs.material_name,
            cs.shelf_life_days,
            cs.max_stock_qty,
            cs.total_stock,
            COALESCE(rc.consumed_qty, 0) AS seven_day_consumption,
            COALESCE(ue.expiring_qty, 0) AS expiring_soon_qty
        FROM CurrentStock cs
        LEFT JOIN RecentConsumption rc ON cs.bom_id = rc.bom_id
        LEFT JOIN UpcomingExpiries ue ON cs.bom_id = ue.bom_id
        WHERE cs.max_stock_qty IS NOT NULL AND cs.max_stock_qty > 0
        ORDER BY seven_day_consumption DESC, cs.bom_id ASC;
    `;
    const result = await client.query(query);
    return result.rows.map(row => ({
        ...row,
        expiring_soon_qty: parseFloat(row.expiring_soon_qty)
    }));
  } catch (error) {
    error.msg = `取得原料統計資料時發生錯誤`;
    logger.error(error, null, "getMaterialStats");
    throw error;
  } finally {
    client.release();
  }
}

async function getConsumptionByBoms(bomIds = [], days = 7) {
  if (!Array.isArray(bomIds) || bomIds.length === 0) return [];
  const pool = getPoolRO();
  const client = await pool.connect();
  const safeDays = Number.isFinite(Number(days)) ? Number(days) : 7;
  try {
    const result = await client.query(
      `
      SELECT bom_id, SUM(quantity_consumed) AS consumed_qty
      FROM inventory_consumption_log
      WHERE bom_id = ANY($1)
        AND quantity_consumed > 0
        AND consumption_time >= NOW() - ($2 || ' days')::interval
      GROUP BY bom_id
      `,
      [bomIds, safeDays]
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得原料消耗量失敗";
    logger.error(error, null, "getConsumptionByBoms");
    throw error;
  } finally {
    client.release();
  }
}

async function getExpiringSoonByBoms(bomIds = [], days = 7) {
  if (!Array.isArray(bomIds) || bomIds.length === 0) return [];
  const pool = getPoolRO();
  const client = await pool.connect();
  const safeDays = Number.isFinite(Number(days)) ? Number(days) : 7;
  try {
    const result = await client.query(
      `
      SELECT bom_id, SUM(remaining_qty) AS expiring_qty
      FROM inventory
      WHERE bom_id = ANY($1)
        AND expiry_time BETWEEN NOW() AND NOW() + ($2 || ' days')::interval
      GROUP BY bom_id
      `,
      [bomIds, safeDays]
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得即將過期量失敗";
    logger.error(error, null, "getExpiringSoonByBoms");
    throw error;
  } finally {
    client.release();
  }
}

async function getMonthlyConsumptionByBoms(bomIds = [], months = 12) {
  if (!Array.isArray(bomIds) || bomIds.length === 0) return [];
  const pool = getPoolRO();
  const client = await pool.connect();
  const safeMonths = Number.isFinite(Number(months)) ? Number(months) : 12;
  try {
    const result = await client.query(
      `
      SELECT
        bom_id,
        EXTRACT(MONTH FROM consumption_time)::int AS month,
        SUM(quantity_consumed) AS consumed_qty
      FROM inventory_consumption_log
      WHERE bom_id = ANY($1)
        AND quantity_consumed > 0
        AND consumption_time >= NOW() - ($2 || ' months')::interval
      GROUP BY bom_id, EXTRACT(MONTH FROM consumption_time)
      `,
      [bomIds, safeMonths]
    );
    return result.rows;
  } catch (error) {
    error.msg = "取得月份消耗量失敗";
    logger.error(error, null, "getMonthlyConsumptionByBoms");
    throw error;
  } finally {
    client.release();
  }
}

export {
  getMaterialStats,
  getConsumptionByBoms,
  getExpiringSoonByBoms,
  getMonthlyConsumptionByBoms,
};
