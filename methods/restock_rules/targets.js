import {
  toNumber,
  compareValue,
  getSeason,
  isWithinDateRange,
} from "./utils.js";
import { getConsumptionQty, getExpiringQty, buildRankMap } from "./data.js";

async function isConsumptionRatioHit(target, context) {
  const params = target.params || {};
  const windowDays = toNumber(params.window_days, 7);
  const threshold = toNumber(params.threshold_percent, 0);
  const consumption = await getConsumptionQty(
    context.item,
    windowDays,
    context.bomIds,
    context.caches.consumptionCache
  );
  const maxStock = toNumber(context.item.max_stock_qty, 0);
  const ratio = maxStock > 0 ? consumption / maxStock : 0;
  return compareValue(params.compare || ">=", ratio, threshold);
}

async function isConsumptionQtyHit(target, context) {
  const params = target.params || {};
  const windowDays = toNumber(params.window_days, 7);
  const consumption = await getConsumptionQty(
    context.item,
    windowDays,
    context.bomIds,
    context.caches.consumptionCache
  );
  const maxStock = toNumber(context.item.max_stock_qty, 0);
  let targetValue = toNumber(params.value, 0);
  if (params.value_type === "percent_max") {
    targetValue = maxStock * targetValue;
  }
  return compareValue(params.compare || ">=", consumption, targetValue);
}

async function isExpiringQtyHit(target, context) {
  const params = target.params || {};
  const windowDays = toNumber(params.window_days, 7);
  const expiring = await getExpiringQty(
    context.item,
    windowDays,
    context.bomIds,
    context.caches.expiringCache
  );
  const targetValue = toNumber(params.value, 0);
  return compareValue(params.compare || ">=", expiring, targetValue);
}

function isStockQtyHit(target, context) {
  const params = target.params || {};
  const currentStock = toNumber(context.item.total_stock, 0);
  const maxStock = toNumber(context.item.max_stock_qty, 0);
  let targetValue = toNumber(params.value, 0);
  if (params.value_type === "percent_max") {
    targetValue = maxStock * targetValue;
  }
  return compareValue(params.compare || ">=", currentStock, targetValue);
}

function isStockPercentHit(target, context) {
  const params = target.params || {};
  const maxStock = toNumber(context.item.max_stock_qty, 0);
  const currentStock = toNumber(context.item.total_stock, 0);
  const percent = maxStock > 0 ? currentStock / maxStock : 0;
  return compareValue(params.compare || ">=", percent, toNumber(params.percent, 0));
}

async function isRankPercentileHit(target, context) {
  const params = target.params || {};
  const windowDays = toNumber(params.window_days, 7);
  const rankMap = await buildRankMap(
    context.materialStats,
    context.bomIds,
    windowDays,
    context.caches.rankCache,
    context.caches.consumptionCache
  );
  const rankIndex = toNumber(rankMap.get(context.item.bom_id), context.index);
  const percentile = context.totalItems
    ? (rankIndex + 1) / context.totalItems
    : 1;
  return compareValue(params.compare || "<=", percentile, toNumber(params.percent, 1));
}

function isShelfLifeHit(target, context) {
  const params = target.params || {};
  const shelfLife = context.item.shelf_life_days;
  if (shelfLife === null || shelfLife === undefined) return false;
  return compareValue(params.compare || "<=", shelfLife, toNumber(params.days, 0));
}

function isSeasonHit(target) {
  const params = target.params || {};
  const seasons = Array.isArray(params.seasons) ? params.seasons : [];
  if (!seasons.length) return false;
  const season = getSeason();
  return seasons.includes(season);
}

function isDateRangeHit(target) {
  const params = target.params || {};
  return isWithinDateRange(new Date(), params.start, params.end);
}

const TARGET_HANDLERS = {
  always: async () => true,
  stock_qty: isStockQtyHit,
  stock_percent: isStockPercentHit,
  consumption_qty: isConsumptionQtyHit,
  consumption_ratio: isConsumptionRatioHit,
  expiring_qty: isExpiringQtyHit,
  rank_percentile: isRankPercentileHit,
  shelf_life_days: isShelfLifeHit,
  season: isSeasonHit,
  date_range: isDateRangeHit,
};

// 判斷此步驟的目標條件是否全部命中
async function isTargetMatched(targets, context) {
  const list = Array.isArray(targets) ? targets : [];
  if (!list.length) return true;
  for (const target of list) {
    if (!target || !target.type) return false;
    const handler = TARGET_HANDLERS[target.type];
    if (!handler) return false;
    const hit = await handler(target, context);
    if (!hit) return false;
  }
  return true;
}

export { isTargetMatched };
