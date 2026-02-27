const TEXT = {
  title: "庫存規則管理",
  addRule: "新增規則",
  guide: "規則設定手冊",
  ruleName: "規則名稱",
  tags: "標籤",
  priority: "優先序",
  enabled: "啟用",
  scope: "範圍",
  actions: "操作",
  editRule: "編輯規則",
  createRule: "新增規則",
  save: "儲存",
  cancel: "取消",
  delete: "刪除",
  deleteRule: "刪除規則",
  deleteConfirm: "以下原料使用此規則，是否刪除？",
  confirmDelete: "確認刪除",
  assignments: "原料規則清單",
  assignTitle: "原料規則設定",
  selectMaterial: "選擇原料",
  selectRule: "選擇規則",
  assignOverrideTitle: "原料規則覆寫",
  overrideParams: "覆寫參數(JSON)",
  fillFromRule: "帶入原本規則",
  clearOverride: "清空為空白",
  overrideHint: "預設會帶入所選規則，可視需求改成空白再重新設定",
  applyMaterial: "套用到原料",
  loading: "載入中...",
  noRules: "沒有規則資料",
  noUsage: "此規則尚未被使用",
  assignmentsEmpty: "此原料尚未設定規則",
  manualRuleJson: "手動編輯 JSON",
  jsonInvalid: "JSON 格式錯誤",
  stepsTitle: "規則步驟",
  addStep: "新增步驟",
  removeStep: "移除步驟",
  targetsTitle: "目標選取",
  addTarget: "新增條件",
  triggersTitle: "門檻觸發動作",
  addTrigger: "新增動作",
  triggerText: "顯示文字",
  stepEmpty: "尚未設定任何步驟",
  targetEmpty: "尚未設定條件",
  triggerEmpty: "尚未設定觸發動作",
  warningOverride:
    "此選項會導致上述規則算出的目前新增數值被覆蓋並以此數值繼續往下計算",
};

const SCOPE_OPTIONS = [
  { value: "global", label: "全域" },
  { value: "material", label: "指定原料" },
];

const SCOPE_LABELS = SCOPE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const COMPARE_OPTIONS = [
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: "=", label: "=" },
  { value: "!=", label: "!=" },
];

const VALUE_TYPE_OPTIONS = [
  { value: "number", label: "固定數值" },
  { value: "percent_max", label: "最大庫存%" },
  { value: "source", label: "系統來源" },
];

const TARGET_VALUE_TYPE_OPTIONS = [
  { value: "number", label: "固定數值" },
  { value: "percent_base", label: "基準百分比" },
  { value: "percent_max", label: "最大庫存%" },
  { value: "source", label: "系統來源" },
];

const TARGET_TYPE_OPTIONS = [
  { value: "always", label: "全部命中(不設條件)" },
  { value: "stock_qty", label: "目前庫存量" },
  { value: "stock_percent", label: "庫存比例" },
  { value: "consumption_qty", label: "近N日消耗量" },
  { value: "consumption_ratio", label: "消耗比例(近N日/最大庫存)" },
  { value: "expiring_qty", label: "即將到期量" },
  { value: "rank_percentile", label: "消耗排名比例" },
  { value: "shelf_life_days", label: "保鮮期天數" },
  { value: "season", label: "季節" },
  { value: "date_range", label: "日期區間" },
];

const SEASON_OPTIONS = [
  { value: "winter", label: "冬" },
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
];

const TARGET_DEFAULTS = {
  always: {},
  stock_qty: { compare: ">=", value: 0, value_type: "number" },
  stock_percent: { compare: "<=", percent: 0.1 },
  consumption_qty: {
    window_days: 7,
    compare: ">=",
    value: 0,
    value_type: "number",
  },
  consumption_ratio: {
    window_days: 7,
    compare: ">=",
    threshold_percent: 0.15,
  },
  expiring_qty: { window_days: 7, compare: ">", value: 0 },
  rank_percentile: { window_days: 7, compare: "<=", percent: 0.25 },
  shelf_life_days: { compare: "<=", days: 14 },
  season: { seasons: ["summer"] },
  date_range: { start: "01-01", end: "12-31" },
};

const TARGET_PARAM_FIELDS = {
  stock_qty: [
    { key: "compare", label: "比較" },
    { key: "value_type", label: "數值類型" },
    { key: "value", label: "數值" },
  ],
  stock_percent: [
    { key: "compare", label: "比較" },
    { key: "percent", label: "比例" },
  ],
  consumption_qty: [
    { key: "window_days", label: "統計天數" },
    { key: "compare", label: "比較" },
    { key: "value_type", label: "數值類型" },
    { key: "value", label: "數值" },
  ],
  consumption_ratio: [
    { key: "window_days", label: "統計天數" },
    { key: "compare", label: "比較" },
    { key: "threshold_percent", label: "門檻比例" },
  ],
  expiring_qty: [
    { key: "window_days", label: "即將到期天數" },
    { key: "compare", label: "比較" },
    { key: "value", label: "數值" },
  ],
  rank_percentile: [
    { key: "window_days", label: "排名統計天數" },
    { key: "compare", label: "比較" },
    { key: "percent", label: "比例" },
  ],
  shelf_life_days: [
    { key: "compare", label: "比較" },
    { key: "days", label: "天數" },
  ],
  season: [{ key: "seasons", label: "季節" }],
  date_range: [
    { key: "start", label: "開始日期" },
    { key: "end", label: "結束日期" },
  ],
};

const ACTION_OPTIONS = [
  { value: "operate", label: "運算" },
  { value: "set", label: "調整" },
  { value: "limit", label: "限制" },
];

const BASE_OPTIONS = [
  { value: "add", label: "目前新增數值(預設)" },
  { value: "current_stock", label: "目前庫存值" },
  { value: "max_stock", label: "庫存最大值" },
];

const OPERATOR_OPTIONS = [
  { value: "+", label: "+" },
  { value: "-", label: "-" },
  { value: "*", label: "*" },
  { value: "/", label: "/" },
];

const LIMIT_DIRECTION_OPTIONS = [
  { value: "upper", label: "上限" },
  { value: "lower", label: "下限" },
];

const SOURCE_OPTIONS = [
  { value: "consumption_qty", label: "近N日消耗量" },
  { value: "expiring_qty", label: "即將到期量" },
  { value: "safety_gap", label: "安全庫存缺口" },
  { value: "space", label: "可用容量(最大-目前)" },
  { value: "current_stock", label: "目前庫存值" },
  { value: "max_stock", label: "庫存最大值" },
  { value: "rank_factor", label: "消耗排名倍率" },
  { value: "shelf_life_factor", label: "保鮮期倍率" },
  { value: "stock_level_factor", label: "庫存水位倍率" },
  { value: "season_fixed_factor", label: "季節倍率(固定)" },
  { value: "season_auto_factor", label: "季節倍率(自動)" },
  { value: "rounding", label: "四捨五入" },
];

const SOURCE_DEFAULTS = {
  consumption_qty: { window_days: 7 },
  expiring_qty: { window_days: 7 },
  safety_gap: { safety_percent: 0.25 },
  space: {},
  current_stock: {},
  max_stock: {},
  rank_factor: {
    window_days: 7,
    top_percent: 0.25,
    mid_percent: 0.75,
    top_factor: 1.5,
    mid_factor: 1.2,
    low_factor: 1,
  },
  shelf_life_factor: {
    short_days: 14,
    mid_days: 90,
    short_factor: 0.8,
    mid_factor: 1,
    long_factor: 1.2,
  },
  stock_level_factor: { min_factor: 0.5, max_factor: 2 },
  season_fixed_factor: {
    default_add: 0,
    month_adds: { 6: 0.2, 7: 0.2, 8: 0.2, 12: 0.15 },
  },
  season_auto_factor: {
    lookback_months: 12,
    min_add: -0.2,
    max_add: 0.2,
    smoothing: 0.3,
    fallback_add: 0,
  },
  rounding: {},
};

const SOURCE_PARAM_FIELDS = {
  consumption_qty: [{ key: "window_days", label: "統計天數" }],
  expiring_qty: [{ key: "window_days", label: "即將到期天數" }],
  safety_gap: [{ key: "safety_percent", label: "安全庫存比例" }],
  rank_factor: [
    { key: "window_days", label: "排名統計天數" },
    { key: "top_percent", label: "高排名比例" },
    { key: "mid_percent", label: "中排名比例" },
    { key: "top_factor", label: "高排名倍率" },
    { key: "mid_factor", label: "中排名倍率" },
    { key: "low_factor", label: "低排名倍率" },
  ],
  shelf_life_factor: [
    { key: "short_days", label: "短保鮮期天數" },
    { key: "mid_days", label: "中保鮮期天數" },
    { key: "short_factor", label: "短保鮮期倍率" },
    { key: "mid_factor", label: "中保鮮期倍率" },
    { key: "long_factor", label: "長保鮮期倍率" },
  ],
  stock_level_factor: [
    { key: "min_factor", label: "最低倍率" },
    { key: "max_factor", label: "最高倍率" },
  ],
  season_fixed_factor: [
    { key: "default_add", label: "預設倍率加成" },
    { key: "month_adds", label: "月份倍率加成(JSON)" },
  ],
  season_auto_factor: [
    { key: "lookback_months", label: "回溯月份數" },
    { key: "min_add", label: "最低倍率加成" },
    { key: "max_add", label: "最高倍率加成" },
    { key: "smoothing", label: "平滑係數" },
    { key: "fallback_add", label: "預設倍率加成" },
  ],
};

const ACTION_DEFAULTS = {
  operate: {
    action: "operate",
    base: "add",
    op: "+",
    value_type: "number",
    value: 0,
    text: "",
  },
  set: {
    action: "set",
    base: "add",
    target_type: "number",
    target_value: 0,
    text: "",
  },
  limit: {
    action: "limit",
    direction: "upper",
    limit_type: "number",
    limit_value: 0,
    text: "",
  },
};

export {
  TEXT,
  SCOPE_OPTIONS,
  SCOPE_LABELS,
  COMPARE_OPTIONS,
  VALUE_TYPE_OPTIONS,
  TARGET_VALUE_TYPE_OPTIONS,
  TARGET_TYPE_OPTIONS,
  TARGET_DEFAULTS,
  TARGET_PARAM_FIELDS,
  SEASON_OPTIONS,
  ACTION_OPTIONS,
  BASE_OPTIONS,
  OPERATOR_OPTIONS,
  LIMIT_DIRECTION_OPTIONS,
  SOURCE_OPTIONS,
  SOURCE_DEFAULTS,
  SOURCE_PARAM_FIELDS,
  ACTION_DEFAULTS,
};
