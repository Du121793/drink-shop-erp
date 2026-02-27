import * as restockRuleController from "../../SQL_controller/restockRule.js";
import { normalizeParams, ensureArray } from "./utils.js";
import { isTargetMatched } from "./targets.js";
import { applyTriggerList } from "./actions.js";

function buildAssignmentMap(assignments) {
  const map = new Map();
  (assignments || []).forEach((assignment) => {
    if (!map.has(assignment.bom_id)) {
      map.set(assignment.bom_id, new Map());
    }
    map.get(assignment.bom_id).set(assignment.rule_id, assignment);
  });
  return map;
}

function groupRulesByPriority(rules) {
  const groups = new Map();
  (rules || []).forEach((rule) => {
    const key = Number(rule.priority) || 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  });
  return Array.from(groups.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([priority, groupRules]) => ({
      priority,
      rules: groupRules.sort((a, b) => Number(a.rule_id) - Number(b.rule_id)),
    }));
}

function isRuleEnabled(rule, assignment) {
  if (!rule || rule.enabled === false) return false;
  if (rule.scope === "material") {
    return !!assignment && assignment.enabled !== false;
  }
  if (assignment && assignment.enabled === false) return false;
  return true;
}

function getRuleSteps(ruleParams, overrideParams) {
  const baseParams = normalizeParams(ruleParams);
  const override = normalizeParams(overrideParams);
  if (Array.isArray(override.steps)) return override.steps;
  if (Array.isArray(baseParams.steps)) return baseParams.steps;
  return [];
}

// 計算單一規則的補貨建議（依步驟由上到下）
async function calculateRuleResult(context, rule, assignment) {
  const steps = getRuleSteps(rule.params, assignment?.override_params);
  let currentValue = 0;
  let matched = false;
  const reasons = [];

  for (const step of ensureArray(steps)) {
    if (!step) continue;
    const targets = ensureArray(step.targets);
    const triggers = ensureArray(step.triggers);
    const hit = await isTargetMatched(targets, context);
    if (!hit) continue;
    matched = true;
    currentValue = await applyTriggerList(currentValue, triggers, context, reasons);
  }

  return { matched, value: currentValue, reasons };
}

// 主流程：依規則優先序計算補貨建議
async function calculateRestockSuggestionsByRules(materialStats = []) {
  const bomIds = materialStats.map((item) => item.bom_id);
  const { rules, assignments } =
    await restockRuleController.getRestockRulesWithAssignments(bomIds);
  const assignmentMap = buildAssignmentMap(assignments);
  const groupedRules = groupRulesByPriority(rules);
  const totalItems = materialStats.length;

  const caches = {
    consumptionCache: new Map(),
    expiringCache: new Map(),
    rankCache: new Map(),
    seasonAutoCache: new Map(),
  };

  const suggestions = [];
  for (const [index, item] of materialStats.entries()) {
    const context = {
      item,
      index,
      totalItems,
      materialStats,
      bomIds,
      caches,
    };

    let picked = null;
    for (const group of groupedRules) {
      let best = null;
      for (const rule of group.rules) {
        const assignment = (assignmentMap.get(item.bom_id) || new Map()).get(
          rule.rule_id
        );
        if (!isRuleEnabled(rule, assignment)) continue;
        const result = await calculateRuleResult(context, rule, assignment);
        if (!result.matched) continue;
        const value = Number.isFinite(result.value) ? result.value : 0;
        if (!best || value > best.value) {
          best = { ...result, value };
        }
      }
      if (best) {
        picked = best;
        break;
      }
    }

    const finalValue = picked ? Math.max(0, picked.value) : 0;
    suggestions.push({
      ...item,
      suggestion: finalValue,
      reasons: picked ? picked.reasons : [],
    });
  }

  return suggestions;
}

export { calculateRestockSuggestionsByRules };
