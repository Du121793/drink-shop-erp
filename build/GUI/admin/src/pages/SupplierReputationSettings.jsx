import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Stack,
  Checkbox,
  Tooltip,
  IconButton,
  FormControlLabel,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
  ClickAwayListener,
} from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import {
  getReputationRule,
  updateReputationRule,
  getSupplierEventTypes,
  createSupplierEventType,
  updateSupplierEventType,
} from "../api/supplierReputation";

// 表單數值轉型（空值保留為 null）
const toNumberOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

// 供應商信譽設定頁面
function SupplierReputationSettings() {
  const [rule, setRule] = useState(null);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [error, setError] = useState("");
  const [newType, setNewType] = useState({
    event_code: "",
    event_name: "",
    base_penalty: "",
    half_life_days: "",
    repeat_window_days: "",
    repeat_growth: "",
    is_active: true,
  });

  const [infoOpen, setInfoOpen] = useState({});

  // 控制說明提示顯示
  const setInfoVisible = (key, visible) => {
    setInfoOpen((prev) => ({ ...prev, [key]: visible }));
  };

  // 產生欄位標題 + 說明提示
  const renderInfoHeader = (label, key, description) => (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <span>{label}</span>
      <ClickAwayListener onClickAway={() => setInfoVisible(key, false)}>
        <Box component="span">
          <Tooltip
            title={description}
            open={Boolean(infoOpen[key])}
            disableFocusListener
            disableHoverListener
            disableTouchListener
            placement="top"
          >
            <IconButton
              size="small"
              onMouseEnter={() => setInfoVisible(key, true)}
              onMouseLeave={() => setInfoVisible(key, false)}
              onClick={(e) => {
                e.stopPropagation();
                setInfoVisible(key, !infoOpen[key]);
              }}
              aria-label={`${label}說明`}
            >
              <InfoOutlined fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Box>
      </ClickAwayListener>
    </Stack>
  );

  // 載入規則與事件類型
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [ruleRes, typeRes] = await Promise.all([
        getReputationRule(),
        getSupplierEventTypes(true),
      ]);
      setRule(ruleRes.data?.rule || null);
      setTypes(typeRes.data?.types || []);
    } catch (err) {
      setError("取得信譽設定失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 更新規則表單狀態
  const handleRuleChange = (key, value) => {
    setRule((prev) => ({ ...prev, [key]: value }));
  };

  // 儲存規則設定
  const handleSaveRule = async () => {
    if (!rule) return;
    setSavingRule(true);
    setError("");
    try {
      const payload = {
        score_max: toNumberOrNull(rule.score_max),
        score_min: toNumberOrNull(rule.score_min),
        block_threshold: toNumberOrNull(rule.block_threshold),
        block_days: toNumberOrNull(rule.block_days),
        auto_block_enabled: Boolean(rule.auto_block_enabled),
        default_lead_time_days: toNumberOrNull(rule.default_lead_time_days),
      };
      const res = await updateReputationRule(payload);
      setRule(res.data?.rule || rule);
    } catch (err) {
      setError("儲存信譽規則失敗");
    } finally {
      setSavingRule(false);
    }
  };

  // 更新事件類型表單狀態
  const handleTypeChange = (id, key, value) => {
    setTypes((prev) =>
      prev.map((t) =>
        t.event_type_id === id ? { ...t, [key]: value } : t
      )
    );
  };

  // 儲存事件類型設定
  const handleSaveType = async (type) => {
    setSavingType(true);
    setError("");
    try {
      await updateSupplierEventType(type.event_type_id, {
        event_code: type.event_code,
        event_name: type.event_name,
        base_penalty: toNumberOrNull(type.base_penalty),
        half_life_days: toNumberOrNull(type.half_life_days),
        repeat_window_days: toNumberOrNull(type.repeat_window_days),
        repeat_growth: toNumberOrNull(type.repeat_growth),
        is_active: Boolean(type.is_active),
      });
      await fetchData();
    } catch (err) {
      setError("更新事件類型失敗");
    } finally {
      setSavingType(false);
    }
  };

  // 新增事件類型
  const handleCreateType = async () => {
    if (!newType.event_code || !newType.event_name) {
      setError("請輸入事件代碼與名稱");
      return;
    }
    setSavingType(true);
    setError("");
    try {
      await createSupplierEventType({
        event_code: newType.event_code,
        event_name: newType.event_name,
        base_penalty: toNumberOrNull(newType.base_penalty) ?? 0,
        half_life_days: toNumberOrNull(newType.half_life_days),
        repeat_window_days: toNumberOrNull(newType.repeat_window_days) ?? 30,
        repeat_growth: toNumberOrNull(newType.repeat_growth) ?? 1,
        is_active: Boolean(newType.is_active),
      });
      setNewType({
        event_code: "",
        event_name: "",
        base_penalty: "",
        half_life_days: "",
        repeat_window_days: "",
        repeat_growth: "",
        is_active: true,
      });
      await fetchData();
    } catch (err) {
      setError("新增事件類型失敗");
    } finally {
      setSavingType(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography variant="h4">
        供應商信譽設定
      </Typography>
      {error && <Typography color="error">{error}</Typography>}

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          信譽規則
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              label="分數上限"
              fullWidth
              value={rule?.score_max ?? ""}
              onChange={(e) => handleRuleChange("score_max", e.target.value)}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              label="分數下限"
              fullWidth
              value={rule?.score_min ?? ""}
              onChange={(e) => handleRuleChange("score_min", e.target.value)}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              label="自動封鎖門檻"
              fullWidth
              value={rule?.block_threshold ?? ""}
              onChange={(e) =>
                handleRuleChange("block_threshold", e.target.value)
              }
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              label="封鎖天數"
              fullWidth
              value={rule?.block_days ?? ""}
              onChange={(e) => handleRuleChange("block_days", e.target.value)}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              label="預設交貨天數"
              fullWidth
              value={rule?.default_lead_time_days ?? ""}
              onChange={(e) =>
                handleRuleChange("default_lead_time_days", e.target.value)
              }
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={4} sx={{ display: "flex", alignItems: "center" }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(rule?.auto_block_enabled)}
                  onChange={(e) =>
                    handleRuleChange("auto_block_enabled", e.target.checked)
                  }
                  disabled={loading}
                />
              }
              label="自動封鎖"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              onClick={handleSaveRule}
              disabled={loading || savingRule}
            >
              {savingRule ? "儲存中..." : "儲存規則"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          事件類型
        </Typography>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
            <TableRow>
              <TableCell>代碼</TableCell>
              <TableCell>名稱</TableCell>
              <TableCell>
                {renderInfoHeader(
                  "扣分基數",
                  "basePenalty",
                  "事件一次扣分的基準值"
                )}
              </TableCell>
              <TableCell>
                {renderInfoHeader(
                  "半衰期 (天)",
                  "halfLifeDays",
                  "時間越久扣分影響越小"
                )}
              </TableCell>
              <TableCell>
                {renderInfoHeader(
                  "重複視窗 (天)",
                  "repeatWindowDays",
                  "在此天數內的重複事件會加權"
                )}
              </TableCell>
              <TableCell>
                {renderInfoHeader(
                  "重複成長",
                  "repeatGrowth",
                  "重複事件的成長係數，數值越大加權越高"
                )}
              </TableCell>
              <TableCell>啟用</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.event_type_id}>
                  <TableCell>
                    <TextField
                      size="small"
                      value={type.event_code}
                      onChange={(e) =>
                        handleTypeChange(
                          type.event_type_id,
                          "event_code",
                          e.target.value
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={type.event_name}
                      onChange={(e) =>
                        handleTypeChange(
                          type.event_type_id,
                          "event_name",
                          e.target.value
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={type.base_penalty ?? ""}
                      onChange={(e) =>
                        handleTypeChange(
                          type.event_type_id,
                          "base_penalty",
                          e.target.value
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={type.half_life_days ?? ""}
                      onChange={(e) =>
                        handleTypeChange(
                          type.event_type_id,
                          "half_life_days",
                          e.target.value
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={type.repeat_window_days ?? ""}
                      onChange={(e) =>
                        handleTypeChange(
                          type.event_type_id,
                          "repeat_window_days",
                          e.target.value
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={type.repeat_growth ?? ""}
                      onChange={(e) =>
                        handleTypeChange(
                          type.event_type_id,
                          "repeat_growth",
                          e.target.value
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={Boolean(type.is_active)}
                      onChange={(e) =>
                        handleTypeChange(
                          type.event_type_id,
                          "is_active",
                          e.target.checked
                        )
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleSaveType(type)}
                      disabled={savingType}
                    >
                      儲存
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!types.length && (
                <TableRow>
                  <TableCell colSpan={8}>
                    目前無事件類型
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>
          新增事件類型
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <TextField
              size="small"
              fullWidth
              label="代碼"
              value={newType.event_code}
              onChange={(e) =>
                setNewType((prev) => ({
                  ...prev,
                  event_code: e.target.value,
                }))
              }
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              size="small"
              fullWidth
              label="名稱"
              value={newType.event_name}
              onChange={(e) =>
                setNewType((prev) => ({
                  ...prev,
                  event_name: e.target.value,
                }))
              }
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              size="small"
              fullWidth
              label="扣分"
              type="number"
              value={newType.base_penalty}
              onChange={(e) =>
                setNewType((prev) => ({
                  ...prev,
                  base_penalty: e.target.value,
                }))
              }
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              size="small"
              fullWidth
              label="半衰期"
              type="number"
              value={newType.half_life_days}
              onChange={(e) =>
                setNewType((prev) => ({
                  ...prev,
                  half_life_days: e.target.value,
                }))
              }
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              size="small"
              fullWidth
              label="重複視窗"
              type="number"
              value={newType.repeat_window_days}
              onChange={(e) =>
                setNewType((prev) => ({
                  ...prev,
                  repeat_window_days: e.target.value,
                }))
              }
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              size="small"
              fullWidth
              label="重複成長"
              type="number"
              value={newType.repeat_growth}
              onChange={(e) =>
                setNewType((prev) => ({
                  ...prev,
                  repeat_growth: e.target.value,
                }))
              }
            />
          </Grid>
          <Grid item xs={12} sm={2} sx={{ display: "flex", alignItems: "center" }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(newType.is_active)}
                  onChange={(e) =>
                    setNewType((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
              }
              label="啟用"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              onClick={handleCreateType}
              disabled={savingType}
            >
              {savingType ? "新增中..." : "新增事件"}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

export default SupplierReputationSettings;
