function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeParams(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }
  return value;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  let next = value;
  if (Number.isFinite(min)) next = Math.max(min, next);
  if (Number.isFinite(max)) next = Math.min(max, next);
  return next;
}

function formatText(template, data = {}) {
  return Object.entries(data).reduce((text, [key, val]) => {
    return text.replace(`{${key}}`, val);
  }, template);
}

function compareValue(compare, left, right) {
  switch (compare) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "=":
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      return left >= right;
  }
}

function getSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "autumn";
}

function parseMonthDay(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { month, day };
}

function isWithinDateRange(now, startText, endText) {
  const start = parseMonthDay(startText);
  const end = parseMonthDay(endText);
  if (!start || !end) return false;
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const nowValue = month * 100 + day;
  const startValue = start.month * 100 + start.day;
  const endValue = end.month * 100 + end.day;
  if (startValue <= endValue) {
    return nowValue >= startValue && nowValue <= endValue;
  }
  return nowValue >= startValue || nowValue <= endValue;
}

export {
  toNumber,
  normalizeParams,
  ensureArray,
  clamp,
  formatText,
  compareValue,
  getSeason,
  isWithinDateRange,
};
