import { getPoolRO } from "./db_connect.js";
import * as logger from "../methods/logger.js";

/**
 * 獲取所有原料的統計數據，用於補貨建議計算。
 * 數據包括：7天內的消耗量、目前庫存、最大庫存、保存期限、以及未來7天即將過期量。
 * @param {number} days - 要回溯計算消耗量的天數，預設為 7 天。
 * @returns {Promise<Array<object>>} 一個包含每個物料詳細統計數據的物件陣列。
 */
async function getMaterialStats(days = 7) {
  const pool = getPoolRO();
  const client = await pool.connect();
  try {
    const query = `
        WITH RecentConsumption AS (
            -- 步驟一：計算近期各原料的總消耗量 (僅計算正消耗)
            SELECT
                bom_id,
                SUM(quantity_consumed) AS consumed_qty
            FROM inventory_consumption_log
            WHERE consumption_time >= NOW() - INTERVAL '${days} days' AND quantity_consumed > 0
            GROUP BY bom_id
        ),
        CurrentStock AS (
            -- 步驟二：計算各原料目前的有效庫存
            SELECT
                b.bom_id,
                b.material_name,
                b.shelf_life_days,
                b.max_stock_qty,
                COALESCE(SUM(i.remaining_qty), 0) AS total_stock
            FROM bom b
            LEFT JOIN inventory i ON b.bom_id = i.bom_id
            AND (b.shelf_life_days IS NULL OR (i.stock_in_time + (b.shelf_life_days * INTERVAL '1 day')) >= NOW())
            GROUP BY b.bom_id, b.material_name, b.shelf_life_days, b.max_stock_qty
        ),
        UpcomingExpiries AS (
            -- 步驟三：計算未來7天內即將過期的庫存量
            SELECT
                i.bom_id,
                SUM(i.remaining_qty) as expiring_qty
            FROM inventory i
            JOIN bom b ON i.bom_id = b.bom_id
            WHERE b.shelf_life_days IS NOT NULL
              AND (i.stock_in_time + (b.shelf_life_days * INTERVAL '1 day')) BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            GROUP BY i.bom_id
        )
        -- 步驟四：組合所有數據並排序
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
        WHERE cs.max_stock_qty IS NOT NULL AND cs.max_stock_qty > 0 -- 只選擇有設定最大庫存的品項
        ORDER BY seven_day_consumption DESC, cs.bom_id ASC; -- 主要按消耗量排序，次要按ID排序以確保順序穩定
    `;
    const result = await client.query(query);
    return result.rows.map(row => ({
        ...row,
        expiring_soon_qty: parseFloat(row.expiring_soon_qty)
    }));
  } catch (error) {
    error.msg = `獲取物料統計數據時發生錯誤`;
    logger.error(error, null, "getMaterialStats");
    throw error;
  } finally {
    client.release();
  }
}

export { getMaterialStats };
