/**
 * 根據物料的消耗量排名，計算其基礎的補貨係數。
 * 消耗量越大的品項，我們會認為它越重要，基礎係數會越高，以進行更積極的補貨。
 * @param {number} rank - 物料的消耗量排名 (從 0 開始)。
 * @param {number} totalItems - 參與排名的總物料數量。
 * @returns {number} - 基礎消耗係數。
 */
function calculateConsumptionFactor(rank, totalItems) {
  const percentile = (rank + 1) / totalItems;

  // 消耗量排名前 25% 的，係數最高 (1.5)
  if (percentile <= 0.25) {
    return 1.5;
  }
  // 消耗量排名在 25% 到 75% 之間的，係數中等 (1.2)
  if (percentile <= 0.75) {
    return 1.2;
  }
  // 消耗量排名在後 25% 的，係數最低 (1.0，即不額外加成)
  return 1.0;
}

/**
 * 根據物料的保存期限，計算其保存係數。
 * 這個係數的目的是為了平衡庫存風險：保存期限越短的物料，我們傾向於少量多次補貨，因此係數較低；
 * 保存期限長的，可以一次多補一些，係數較高。
 * @param {number | null} shelf_life_days - 物料的保存天數。如果為 null，視為長效期。
 * @returns {number} - 保存期限係數。
 */
function calculateShelfLifeFactor(shelf_life_days) {
  // 若無設定保存期限，視為不易損壞，給予一個標準係數
  if (shelf_life_days === null || shelf_life_days === undefined) {
    return 1.0;
  }
  // 保存期限在14天內的，屬於易腐壞品，係數最低，補貨策略最保守
  if (shelf_life_days <= 14) {
    return 0.8;
  }
  // 保存期限在14天到90天之間，係數中等
  if (shelf_life_days <= 90) {
    return 1.0;
  }
  // 保存期限大於90天，非常耐放，係數最高，可以進行更積極的補貨
  return 1.2;
}

/**
 * 根據物料的目前庫存水位，計算其庫存壓力係數。
 * 庫存水位越低，代表補貨的需求越緊急、壓力越大，因此係數會越高，以增加建議的補貨量。
 * @param {number} current_stock - 目前的庫存量。
 * @param {number} max_stock - 最大庫存上限。
 * @returns {number} - 庫存壓力係數。
 */
function calculateStockLevelFactor(current_stock, max_stock) {
  if (max_stock <= 0) return 1.0; // 避免除以零

  const stock_percentage = current_stock / max_stock;

  // 這是一個反向的線性關係，並設定了係數的上下限
  // 當庫存為 0% 時，係數為 2.0
  // 當庫存為 100% 時，係數為 0.5
  const maxFactor = 2.0;
  const minFactor = 0.5;

  const factor = maxFactor - stock_percentage * (maxFactor - minFactor);

  // 確保係數不會超出範圍
  return Math.max(minFactor, factor);
}

/**
 * 主要的建議補貨量計算函式。
 * 它會綜合所有數據和係數，為每個物料計算出最終的建議補貨量。
 * 新增了「危險庫存」和「即將過期」的優先規則。
 * @param {Array<object>} materialStats - 從 getMaterialStats() 得到的物料統計數據陣列，需包含 expiring_soon_qty。
 * @param {object} options - 選項物件。
 * @param {number} options.consumptionThresholdPercent - 【一般情況】消耗量百分比門檻。
 * @param {number} options.criticalStockPercent - 【優先規則】危險庫存百分比水位。
 * @param {number} options.safetyStockPercent - 【優先規則】安全庫存百分比水位。
 * @returns {Array<object>} - 一個包含每個物料的詳細計算過程、原因陣列與最終建議補貨量的陣列。
 */
function calculateRestockSuggestions(materialStats, options = {}) {
  const { 
    consumptionThresholdPercent = 0.15, 
    criticalStockPercent = 0.10,
    safetyStockPercent = 0.25
  } = options;
  const totalItems = materialStats.length;

  const suggestions = materialStats.map((item, index) => {
    const stockPercentage = item.max_stock_qty > 0 ? item.total_stock / item.max_stock_qty : 0;
    const reasons = [];
    let rawSuggestion = 0;
    let consumptionBasedSuggestion = 0;
    let safetyStockSuggestion = 0;
    
    // --- 步驟一：計算基於消耗量的建議 ---
    const consumptionThreshold = item.max_stock_qty * consumptionThresholdPercent;
    if (item.seven_day_consumption >= consumptionThreshold) {
        const consumptionFactor = calculateConsumptionFactor(index, totalItems);
        const shelfLifeFactor = calculateShelfLifeFactor(item.shelf_life_days);
        const stockLevelFactor = calculateStockLevelFactor(item.total_stock, item.max_stock_qty);
        const demandMultiplier = consumptionFactor * shelfLifeFactor * stockLevelFactor;
        
        reasons.push({ text: `消耗量排名 #${index + 1}`, effect: `x${consumptionFactor.toFixed(2)}` });
        if(shelfLifeFactor !== 1.0) reasons.push({ text: `保存期限(${item.shelf_life_days || '長'}天)`, effect: `x${shelfLifeFactor.toFixed(2)}` });
        reasons.push({ text: `目前庫存水位(${Math.round(stockPercentage*100)}%)`, effect: `x${stockLevelFactor.toFixed(2)}` });

        consumptionBasedSuggestion = item.seven_day_consumption * demandMultiplier;
    } else {
        reasons.push({ text: '近期消耗量未達門檻', effect: '-' });
    }

    // --- 步驟二：計算基於危險庫存的建議 ---
    if (stockPercentage < criticalStockPercent) {
        reasons.push({ text: `庫存低於危險水位(${criticalStockPercent * 100}%)`, effect: '++' });
        const safetyStockTarget = item.max_stock_qty * safetyStockPercent;
        safetyStockSuggestion = safetyStockTarget - item.total_stock;
    }

    // --- 步驟三：計算即將過期的耗損 ---
    let expiryReplenishment = 0;
    if (item.expiring_soon_qty > 0) {
        reasons.push({ text: `近7天即將過期`, effect: `+${Math.round(item.expiring_soon_qty)}` });
        expiryReplenishment = item.expiring_soon_qty;
    }

    // --- 步驟四：組合所有計算結果 ---
    // 初步建議量 = (消耗量建議 和 安全庫存建議 中較大者) + 過期耗損
    rawSuggestion = Math.max(consumptionBasedSuggestion, safetyStockSuggestion) + expiryReplenishment;

    // --- 步驟五：最終調整 ---
    const spaceAvailable = item.max_stock_qty - item.total_stock;
    let finalSuggestion = Math.min(rawSuggestion, spaceAvailable);
    finalSuggestion = Math.max(0, finalSuggestion);
    finalSuggestion = Math.round(finalSuggestion);

    return { ...item, suggestion: finalSuggestion, reasons };
  });

  return suggestions;
}

export {
  calculateConsumptionFactor,
  calculateShelfLifeFactor,
  calculateStockLevelFactor,
  calculateRestockSuggestions,
};
