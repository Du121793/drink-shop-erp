import express from "express";
import * as suggestionController from "../SQL_controller/suggestion.js";
import { calculateRestockSuggestionsByRules } from "../methods/restock_rules/engine.js";
import * as supplierController from "../SQL_controller/supplier.js";
import * as restockRuleController from "../SQL_controller/restockRule.js";
import * as logger from "../methods/logger.js";
import { requirePermissions } from "../middleware/accessChecker.js";

const router = express.Router();

// 建立補貨建議（同 line webhook 邏輯）
async function buildSuggestions() {
  const materialStats = await suggestionController.getMaterialStats();
  return calculateRestockSuggestionsByRules(materialStats);
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
router.get("/", requirePermissions("restock:view"), async (req, res) => {
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
router.patch("/", requirePermissions("restock:apply"), async (req, res) => {
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

// 規則管理
router.get("/rules", requirePermissions("restock:rules"), async (req, res) => {
  try {
    const rules = await restockRuleController.getRestockRules();
    res.status(200).json({ rules });
  } catch (error) {
    logger.error(error, req, "autoRestock:rules:get");
    res.status(500).json({ error: "取得規則清單失敗" });
  }
});

router.post("/rules", requirePermissions("restock:rules"), async (req, res) => {
  try {
    const { rule_name, rule_type } = req.body || {};
    if (!rule_name || !rule_type) {
      return res.status(400).json({ error: "請提供規則名稱與類型" });
    }
    const ruleId = await restockRuleController.createRestockRule(req.body);
    res.status(201).json({ message: "OK", rule_id: ruleId });
  } catch (error) {
    logger.error(error, req, "autoRestock:rules:post");
    res.status(500).json({ error: "新增規則失敗" });
  }
});

router.patch("/rules/:id", requirePermissions("restock:rules"), async (req, res) => {
  try {
    const { id } = req.params;
    await restockRuleController.updateRestockRule(Number(id), req.body || {});
    res.status(200).json({ message: "OK" });
  } catch (error) {
    logger.error(error, req, "autoRestock:rules:patch");
    res.status(500).json({ error: "更新規則失敗" });
  }
});

router.get("/rules/:id/usage", requirePermissions("restock:rules"), async (req, res) => {
  try {
    const { id } = req.params;
    const usage = await restockRuleController.getRestockRuleUsage(Number(id));
    res.status(200).json({ usage });
  } catch (error) {
    logger.error(error, req, "autoRestock:rules:usage");
    res.status(500).json({ error: "取得規則使用情況失敗" });
  }
});

router.delete("/rules/:id", requirePermissions("restock:rules"), async (req, res) => {
  try {
    const { id } = req.params;
    const ruleId = Number(id);
    const force = req.query.force === "true" || req.body?.force === true;
    const usage = await restockRuleController.getRestockRuleUsage(ruleId);
    if (usage.length && !force) {
      return res.status(409).json({ error: "規則仍被使用，請先確認", usage });
    }
    if (usage.length && force) {
      for (const item of usage) {
        await restockRuleController.deleteRestockRuleAssignment(ruleId, item.bom_id);
      }
    }
    await restockRuleController.deleteRestockRule(ruleId);
    res.status(200).json({ message: "OK" });
  } catch (error) {
    logger.error(error, req, "autoRestock:rules:delete");
    res.status(500).json({ error: "刪除規則失敗" });
  }
});

router.get(
  "/materials/:bom_id/rules",
  requirePermissions("restock:rules"),
  async (req, res) => {
  try {
    const { bom_id } = req.params;
    const assignments = await restockRuleController.getRestockRuleAssignmentsByBom(
      Number(bom_id)
    );
    res.status(200).json({ assignments });
  } catch (error) {
    logger.error(error, req, "autoRestock:rules:assignments:get");
    res.status(500).json({ error: "取得原料規則設定失敗" });
  }
});

router.put(
  "/materials/:bom_id/rules/:rule_id",
  requirePermissions("restock:rules"),
  async (req, res) => {
  try {
    const { bom_id, rule_id } = req.params;
    await restockRuleController.upsertRestockRuleAssignment(
      Number(rule_id),
      Number(bom_id),
      req.body || {}
    );
    res.status(200).json({ message: "OK" });
  } catch (error) {
    logger.error(error, req, "autoRestock:rules:assignments:put");
    res.status(500).json({ error: "更新原料規則設定失敗" });
  }
});

router.delete(
  "/materials/:bom_id/rules/:rule_id",
  requirePermissions("restock:rules"),
  async (req, res) => {
  try {
    const { bom_id, rule_id } = req.params;
    await restockRuleController.deleteRestockRuleAssignment(
      Number(rule_id),
      Number(bom_id)
    );
    res.status(200).json({ message: "OK" });
  } catch (error) {
    logger.error(error, req, "autoRestock:rules:assignments:delete");
    res.status(500).json({ error: "刪除原料規則設定失敗" });
  }
});

export default router;








