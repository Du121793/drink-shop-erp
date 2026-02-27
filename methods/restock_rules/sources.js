import { toNumber, clamp } from "./utils.js";
import {
  getConsumptionQty,
  getExpiringQty,
  buildRankMap,
  buildSeasonAutoStatsMap,
} from "./data.js";

// 依來源型別取得數值（可作為計算基準或運算值）
async function getSourceValue(source, params, context) {
  const safeParams = params && typeof params === "object" ? params : {};
  const {
    item,
    materialStats,
    bomIds,
    caches,
    index,
    totalItems,
    currentValue,
  } = context;

  if (source === "current_stock") {
    return toNumber(item.total_stock, 0);
  }
  if (source === "max_stock") {
    return toNumber(item.max_stock_qty, 0);
  }
  if (source === "consumption_qty") {
    const windowDays = toNumber(safeParams.window_days, 7);
    return getConsumptionQty(item, windowDays, bomIds, caches.consumptionCache);
  }
  if (source === "expiring_qty") {
    const windowDays = toNumber(safeParams.window_days, 7);
    return getExpiringQty(item, windowDays, bomIds, caches.expiringCache);
  }
  if (source === "space") {
    const maxStock = toNumber(item.max_stock_qty, 0);
    const currentStock = toNumber(item.total_stock, 0);
    return Math.max(0, maxStock - currentStock);
  }
  if (source === "safety_gap") {
    const maxStock = toNumber(item.max_stock_qty, 0);
    const currentStock = toNumber(item.total_stock, 0);
    const safetyPercent = toNumber(safeParams.safety_percent, 0);
    return Math.max(0, maxStock * safetyPercent - currentStock);
  }
  if (source === "rank_factor") {
    const windowDays = toNumber(safeParams.window_days, 7);
    const rankMap = await buildRankMap(
      materialStats,
      bomIds,
      windowDays,
      caches.rankCache,
      caches.consumptionCache
    );
    const rankIndex = toNumber(rankMap.get(item.bom_id), index);
    const percentile = totalItems ? (rankIndex + 1) / totalItems : 1;
    const topPercent = toNumber(safeParams.top_percent, 0.25);
    const midPercent = toNumber(safeParams.mid_percent, 0.75);
    const topFactor = toNumber(safeParams.top_factor, 1.5);
    const midFactor = toNumber(safeParams.mid_factor, 1.2);
    const lowFactor = toNumber(safeParams.low_factor, 1);
    if (percentile <= topPercent) return topFactor;
    if (percentile <= midPercent) return midFactor;
    return lowFactor;
  }
  if (source === "shelf_life_factor") {
    const shelfLife = item.shelf_life_days;
    const shortDays = toNumber(safeParams.short_days, 14);
    const midDays = toNumber(safeParams.mid_days, 90);
    const shortFactor = toNumber(safeParams.short_factor, 0.8);
    const midFactor = toNumber(safeParams.mid_factor, 1);
    const longFactor = toNumber(safeParams.long_factor, 1.2);
    if (shelfLife === null || shelfLife === undefined) return midFactor;
    if (shelfLife <= shortDays) return shortFactor;
    if (shelfLife <= midDays) return midFactor;
    return longFactor;
  }
  if (source === "stock_level_factor") {
    const maxFactor = toNumber(safeParams.max_factor, 2);
    const minFactor = toNumber(safeParams.min_factor, 0.5);
    const maxStock = toNumber(item.max_stock_qty, 0);
    const currentStock = toNumber(item.total_stock, 0);
    if (maxStock <= 0) return 1;
    const stockPercent = currentStock / maxStock;
    const factor = maxFactor - stockPercent * (maxFactor - minFactor);
    return clamp(factor, minFactor, maxFactor);
  }
  if (source === "season_fixed_factor") {
    const monthAdds = safeParams.month_adds || {};
    const defaultAdd = toNumber(safeParams.default_add, 0);
    const month = new Date().getMonth() + 1;
    const add = toNumber(monthAdds[month], defaultAdd);
    return 1 + add;
  }
  if (source === "season_auto_factor") {
    const lookbackMonths = toNumber(safeParams.lookback_months, 12);
    const fallbackAdd = toNumber(safeParams.fallback_add, 0);
    const minAdd = toNumber(safeParams.min_add, -1);
    const maxAdd = toNumber(safeParams.max_add, 1);
    const smoothing = clamp(toNumber(safeParams.smoothing, 1), 0, 1);
    const statsMap = await buildSeasonAutoStatsMap(
      bomIds,
      lookbackMonths,
      caches.seasonAutoCache
    );
    const stats = statsMap.get(item.bom_id) || { avg: 0, current: 0 };
    let add = fallbackAdd;
    if (stats.avg > 0) {
      add = stats.current / stats.avg - 1;
    }
    add = add * smoothing + fallbackAdd * (1 - smoothing);
    add = clamp(add, minAdd, maxAdd);
    return 1 + add;
  }
  if (source === "rounding") {
    return Math.round(toNumber(currentValue, 0));
  }

  return null;
}

export { getSourceValue };
