import { toNumber } from "./utils.js";
import { getSourceValue } from "./sources.js";

const DEFAULT_TEXT = "門檻觸發調整";

function formatNumber(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function pushReason(reasons, text, effect) {
  const safeText = String(text || "").trim() || DEFAULT_TEXT;
  reasons.push({ text: safeText, effect });
}

function getBaseValue(base, currentValue, item) {
  if (base === "current_stock") {
    return toNumber(item.total_stock, 0);
  }
  if (base === "max_stock") {
    return toNumber(item.max_stock_qty, 0);
  }
  return toNumber(currentValue, 0);
}

async function getOperandValue(trigger, context, currentValue) {
  const type = trigger.value_type || "number";
  if (type === "number") {
    const value = toNumber(trigger.value, NaN);
    return Number.isFinite(value) ? value : null;
  }
  if (type === "percent_max") {
    const maxStock = toNumber(context.item.max_stock_qty, 0);
    const percent = toNumber(trigger.value, NaN);
    if (!Number.isFinite(percent)) return null;
    return maxStock * percent;
  }
  if (type === "source") {
    return getSourceValue(trigger.value_source, trigger.value_params, {
      ...context,
      currentValue,
    });
  }
  return null;
}

async function getSetValue(trigger, context, baseValue, currentValue) {
  const type = trigger.target_type || "number";
  if (type === "number") {
    const value = toNumber(trigger.target_value, NaN);
    return Number.isFinite(value) ? value : null;
  }
  if (type === "percent_base") {
    const percent = toNumber(trigger.target_value, NaN);
    if (!Number.isFinite(percent)) return null;
    return baseValue * percent;
  }
  if (type === "percent_max") {
    const maxStock = toNumber(context.item.max_stock_qty, 0);
    const percent = toNumber(trigger.target_value, NaN);
    if (!Number.isFinite(percent)) return null;
    return maxStock * percent;
  }
  if (type === "source") {
    return getSourceValue(trigger.target_source, trigger.target_params, {
      ...context,
      currentValue,
    });
  }
  return null;
}

async function getLimitValue(trigger, context, currentValue) {
  const type = trigger.limit_type || "number";
  if (type === "number") {
    const value = toNumber(trigger.limit_value, NaN);
    return Number.isFinite(value) ? value : null;
  }
  if (type === "percent_max") {
    const maxStock = toNumber(context.item.max_stock_qty, 0);
    const percent = toNumber(trigger.limit_value, NaN);
    if (!Number.isFinite(percent)) return null;
    return maxStock * percent;
  }
  if (type === "source") {
    return getSourceValue(trigger.limit_source, trigger.limit_params, {
      ...context,
      currentValue,
    });
  }
  return null;
}

async function applyOperateTrigger(currentValue, trigger, context, reasons) {
  const op = String(trigger.op || "").trim();
  if (!["+", "-", "*", "/"].includes(op)) return currentValue;
  const baseValue = getBaseValue(trigger.base, currentValue, context.item);
  const operand = await getOperandValue(trigger, context, currentValue);
  if (!Number.isFinite(operand)) return currentValue;

  let next = baseValue;
  if (op === "+") next = baseValue + operand;
  if (op === "-") next = baseValue - operand;
  if (op === "*") next = baseValue * operand;
  if (op === "/") {
    if (operand === 0) return currentValue;
    next = baseValue / operand;
  }
  // 即使結果未變，也要留下理由，避免補貨建議出現無計算原因
  if (!Number.isFinite(next)) return currentValue;

  const label = formatNumber(operand);
  const effect =
    op === "*" ? `x${label}` : op === "/" ? `/${label}` : `${op}${label}`;
  pushReason(reasons, trigger.text, effect);
  return next;
}

async function applySetTrigger(currentValue, trigger, context, reasons) {
  const baseValue = getBaseValue(trigger.base, currentValue, context.item);
  const next = await getSetValue(trigger, context, baseValue, currentValue);
  // 即使結果未變，也要留下理由，避免補貨建議出現無計算原因
  if (!Number.isFinite(next)) return currentValue;
  const label = formatNumber(next);
  pushReason(reasons, trigger.text, `=${label}`);
  return next;
}

async function applyLimitTrigger(currentValue, trigger, context, reasons) {
  const direction = trigger.direction || "upper";
  const limit = await getLimitValue(trigger, context, currentValue);
  if (!Number.isFinite(limit)) return currentValue;

  if (direction === "lower") {
    if (currentValue < limit) {
      pushReason(reasons, trigger.text, `>=${formatNumber(limit)}`);
      return limit;
    }
    return currentValue;
  }

  if (currentValue > limit) {
    pushReason(reasons, trigger.text, `<=${formatNumber(limit)}`);
    return limit;
  }
  return currentValue;
}

// 依序套用觸發調整
async function applyTriggerList(currentValue, triggers, context, reasons) {
  let next = currentValue;
  const list = Array.isArray(triggers) ? triggers : [];
  for (const trigger of list) {
    if (!trigger || !trigger.action) continue;
    if (trigger.action === "operate") {
      next = await applyOperateTrigger(next, trigger, context, reasons);
    } else if (trigger.action === "set") {
      next = await applySetTrigger(next, trigger, context, reasons);
    } else if (trigger.action === "limit") {
      next = await applyLimitTrigger(next, trigger, context, reasons);
    }
  }
  return next;
}

export { applyTriggerList };
