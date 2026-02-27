import * as suggestionController from "../../SQL_controller/suggestion.js";
import { toNumber } from "./utils.js";

// 建立消耗量對照表（快取用）
async function buildConsumptionMap(bomIds, days, cache) {
  const key = Number(days) || 7;
  if (cache.has(key)) return cache.get(key);
  const rows = await suggestionController.getConsumptionByBoms(bomIds, key);
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.bom_id, toNumber(row.consumed_qty, 0));
  });
  cache.set(key, map);
  return map;
}

// 建立即將到期對照表（快取用）
async function buildExpiringMap(bomIds, days, cache) {
  const key = Number(days) || 7;
  if (cache.has(key)) return cache.get(key);
  const rows = await suggestionController.getExpiringSoonByBoms(bomIds, key);
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.bom_id, toNumber(row.expiring_qty, 0));
  });
  cache.set(key, map);
  return map;
}

// 取得指定原料在某段天數內的消耗量
async function getConsumptionQty(item, windowDays, bomIds, consumptionCache) {
  const days = Number(windowDays) || 7;
  if (days === 7) {
    return toNumber(item.seven_day_consumption, 0);
  }
  const map = await buildConsumptionMap(bomIds, days, consumptionCache);
  return toNumber(map.get(item.bom_id), 0);
}

// 取得指定原料在某段天數內的即將到期量
async function getExpiringQty(item, windowDays, bomIds, expiringCache) {
  const days = Number(windowDays) || 7;
  if (days === 7) {
    return toNumber(item.expiring_soon_qty, 0);
  }
  const map = await buildExpiringMap(bomIds, days, expiringCache);
  return toNumber(map.get(item.bom_id), 0);
}

// 建立消耗排名對照表（快取用）
async function buildRankMap(materialStats, bomIds, days, cache, consumptionCache) {
  const key = Number(days) || 7;
  if (cache.has(key)) return cache.get(key);
  const consumptionMap = await buildConsumptionMap(bomIds, key, consumptionCache);
  const list = materialStats.map((item) => ({
    bom_id: item.bom_id,
    consumed: consumptionMap.get(item.bom_id) || 0,
  }));
  list.sort((a, b) => {
    if (b.consumed !== a.consumed) return b.consumed - a.consumed;
    return a.bom_id - b.bom_id;
  });
  const rankMap = new Map();
  list.forEach((entry, index) => {
    rankMap.set(entry.bom_id, index);
  });
  cache.set(key, rankMap);
  return rankMap;
}

// 建立自動季節統計對照表（快取用）
async function buildSeasonAutoStatsMap(bomIds, months, cache) {
  const key = Number(months) || 12;
  if (cache.has(key)) return cache.get(key);
  const rows = await suggestionController.getMonthlyConsumptionByBoms(bomIds, key);
  const nowMonth = new Date().getMonth() + 1;
  const summaryMap = new Map();
  rows.forEach((row) => {
    const entry = summaryMap.get(row.bom_id) || { total: 0, months: {} };
    entry.total += toNumber(row.consumed_qty, 0);
    entry.months[row.month] = toNumber(row.consumed_qty, 0);
    summaryMap.set(row.bom_id, entry);
  });
  const statsMap = new Map();
  bomIds.forEach((bomId) => {
    const entry = summaryMap.get(bomId) || { total: 0, months: {} };
    const avg = key > 0 ? entry.total / key : 0;
    const current = entry.months[nowMonth] || 0;
    statsMap.set(bomId, { avg, current });
  });
  cache.set(key, statsMap);
  return statsMap;
}

export {
  buildConsumptionMap,
  buildExpiringMap,
  getConsumptionQty,
  getExpiringQty,
  buildRankMap,
  buildSeasonAutoStatsMap,
};
