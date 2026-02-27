import {
  ACTION_DEFAULTS,
  TARGET_DEFAULTS,
  SOURCE_DEFAULTS,
  SOURCE_OPTIONS,
} from "./schema";

function parseJsonSafe(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function parseInputValue(input) {
  const raw = String(input ?? "");
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^-?$/.test(trimmed) || /^-?\.$/.test(trimmed) || /^-?\d+\.$/.test(trimmed)) {
    return raw;
  }
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const num = Number(trimmed);
    if (Number.isFinite(num)) return num;
    return raw;
  }
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value;
  const parsed = parseJsonSafe(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function uniqueTags(tags = []) {
  const cleaned = tags
    .map((tag) => String(tag ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

function normalizeRuleParams(value) {
  const params = parseJsonSafe(value, {});
  const steps = Array.isArray(params.steps) ? params.steps : [];
  return { ...params, steps: steps.map(normalizeStep) };
}

function normalizeStep(step) {
  return {
    ...step,
    targets: Array.isArray(step?.targets) ? step.targets : [],
    triggers: Array.isArray(step?.triggers) ? step.triggers : [],
  };
}

function createStep() {
  return { targets: [], triggers: [] };
}

function createTarget(type) {
  return {
    type,
    params: cloneDeep(TARGET_DEFAULTS[type] || {}),
  };
}

function getDefaultSource() {
  return SOURCE_OPTIONS[0]?.value || "";
}

function buildSourceParams(source) {
  return cloneDeep(SOURCE_DEFAULTS[source] || {});
}

function createTrigger(action) {
  const base = cloneDeep(ACTION_DEFAULTS[action] || ACTION_DEFAULTS.operate);
  if (base.value_type === "source") {
    base.value_source = getDefaultSource();
    base.value_params = buildSourceParams(base.value_source);
  }
  if (base.target_type === "source") {
    base.target_source = getDefaultSource();
    base.target_params = buildSourceParams(base.target_source);
  }
  if (base.limit_type === "source") {
    base.limit_source = getDefaultSource();
    base.limit_params = buildSourceParams(base.limit_source);
  }
  return base;
}

export {
  parseJsonSafe,
  parseInputValue,
  normalizeTags,
  uniqueTags,
  normalizeRuleParams,
  normalizeStep,
  createStep,
  createTarget,
  createTrigger,
  getDefaultSource,
  buildSourceParams,
};
