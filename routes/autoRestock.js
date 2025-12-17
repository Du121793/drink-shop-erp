import express from "express";
import * as suggestionController from "../SQL_controller/suggestion.js";
import { calculateRestockSuggestions } from "../methods/suggestion_calculator.js";
import * as supplierController from "../SQL_controller/supplier.js";
import * as logger from "../methods/logger.js";
import { accessChecker } from "../middleware/accessChecker.js";

const router = express.Router();

// 建立補貨建議（同 line webhook 邏輯）
async function buildSuggestions() {
  const materialStats = await suggestionController.getMaterialStats();
  return calculateRestockSuggestions(materialStats, {
    consumptionThresholdPercent: 0.15,
    criticalStockPercent: 0.10,
    safetyStockPercent: 0.25,
  });
}

// 附帶預設廠商資訊
async function attachSuppliers(suggestions) {
  const bomIds = suggestions.map((s) => s.bom_id);
  const defaultSuppliers = await supplierController.getDefaultSuppliersForBoms(bomIds);
  const supplierMap = new Map(defaultSuppliers.map((s) => [s.bom_id, s]));

  return suggestions.map((item) => ({
    ...item,
    supplier: supplierMap.get(item.bom_id) || null,
  }));
}

// 取得自動補貨建議清單
router.get("/", accessChecker(1), async (req, res) => {
  try {
    const suggestions = await buildSuggestions();
    const withSuppliers = await attachSuppliers(suggestions);
    res.status(200).json({ suggestions: withSuppliers });
  } catch (error) {
    logger.error(error, req, "autoRestock:get");
    res.status(500).json({ error: "取得補貨建議清單失敗" });
  }
});

// 套用手動調整的建議量，並附帶預設廠商
router.patch("/", accessChecker(1), async (req, res) => {
  try {
    const overrides = Array.isArray(req.body?.overrides) ? req.body.overrides : [];
    const suggestions = await buildSuggestions();
    const overrideMap = new Map(
      overrides
        .filter((o) => o && o.bom_id !== undefined && o.suggestion !== undefined)
        .map((o) => [Number(o.bom_id), Number(o.suggestion)])
    );

    const merged = suggestions.map((item) => {
      if (!overrideMap.has(item.bom_id)) return item;
      const manualValue = overrideMap.get(item.bom_id);
      return {
        ...item,
        suggestion: manualValue,
        reasons: [
          { text: "手動調整", effect: `${manualValue}` },
          ...(item.reasons || []),
        ],
      };
    });

    const withSuppliers = await attachSuppliers(merged);
    res.status(200).json({ suggestions: withSuppliers });
  } catch (error) {
    logger.error(error, req, "autoRestock:patch");
    res.status(500).json({ error: "套用手動調整失敗" });
  }
});

export default router;
