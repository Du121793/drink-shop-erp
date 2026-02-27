import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Chip,
  Stack,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  MenuItem,
} from "@mui/material";
import {
  getAutoRestockList,
  applyAutoRestockOverrides,
} from "../api/autoRestock";
import { createPurchaseOrders } from "../api/purchaseOrders";
import { getMaterialSuppliers } from "../api/suppliers";
import { getSupplierReputation } from "../api/supplierReputation";

// 右側加成標籤顏色規則
const reasonColor = (reason) => {
  const effect = reason?.effect || "";
  if (effect.includes("++") || effect.includes("+")) return "success";
  if (effect.includes("x")) return "primary";
  if (effect.includes("-")) return "warning";
  return "default";
};

// 補貨建議清單頁面：含供應商與信譽提醒
function RestockSuggestions() {
  const [items, setItems] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checkedMap, setCheckedMap] = useState({});
  const [templates, setTemplates] = useState([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [materialSuppliers, setMaterialSuppliers] = useState([]);
  const [selectedSupplierMap, setSelectedSupplierMap] = useState({});
  const [contactMode, setContactMode] = useState({});
  const [info, setInfo] = useState("");
  const [reputationMap, setReputationMap] = useState({});

  // 排序建議：先比建議量，再比保存天數
  const sortSuggestions = (list = []) => {
    const copy = [...list];
    copy.sort((a, b) => {
      const sa = Number(a.suggestion) || 0;
      const sb = Number(b.suggestion) || 0;
      // 建議量高者在前
      if (sb !== sa) return sb - sa;
      const la = a.shelf_life_days;
      const lb = b.shelf_life_days;
      if (la == null && lb == null) return 0;
      // 無保存期限排後
      if (la == null) return 1;
      if (lb == null) return -1;
      // 保存天數越短越前
      return la - lb;
    });
    return copy;
  };

  const maxSuggestion = useMemo(() => {
    if (!items.length) return 0;
    return Math.max(...items.map((i) => Number(i.suggestion) || 0));
  }, [items]);

  // 依建議量調整行高
  const rowHeight = (suggestion) => {
    const base = 72;
    if (!maxSuggestion) return base;
    const ratio = Math.min((Number(suggestion) || 0) / maxSuggestion, 1);
    // 建議量越高，行高越高
    return base + ratio * 80;
  };

  // 格式化時間顯示
  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  // 載入補貨建議與供應商資訊
  const fetchData = async () => {
    setLoading(true);
    setError("");
    setTemplateError("");
    setInfo("");
    try {
      const [restockRes, msRes] = await Promise.all([
        getAutoRestockList(),
        getMaterialSuppliers(),
      ]);
      const sorted = sortSuggestions(restockRes.data?.suggestions || []);
      const nextMaterialSuppliers = msRes.data?.materialSuppliers || [];
      setItems(sorted);
      setOverrides({});
      setCheckedMap({});
      setMaterialSuppliers(nextMaterialSuppliers);

      const supplierIds = Array.from(
        new Set(nextMaterialSuppliers.map((ms) => ms.supplier_id))
      );
      let repMap = {};
      if (supplierIds.length) {
        const repRes = await getSupplierReputation(supplierIds);
        (repRes.data?.summaries || []).forEach((item) => {
          repMap[item.supplier_id] = item;
        });
      }
      setReputationMap(repMap);

      const blockedSet = new Set(
        Object.values(repMap)
          .filter((item) => item.is_blocked)
          .map((item) => item.supplier_id)
      );

      // 預設選擇：僅在有預設供應商且補貨量 > 0 時帶入，否則為空
      const defaultSelected = {};
      const defaultContact = {};
      sorted.forEach((item) => {
        if ((Number(item.suggestion) || 0) <= 0) return;
        const candidates = nextMaterialSuppliers.filter(
          (ms) => ms.bom_id === item.bom_id
        );
        const preferred = candidates.find((c) => c.is_default);
        if (preferred && !blockedSet.has(preferred.supplier_id)) {
          defaultSelected[item.bom_id] = preferred.supplier_id;
          defaultContact[item.bom_id] = preferred.email ? "email" : "phone";
        }
      });
      setSelectedSupplierMap(defaultSelected);
      setContactMode(defaultContact);
    } catch (err) {
      setError(
        "取得補貨建議清單失敗"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 調整補貨建議量
  const handleOverrideChange = (bomId, value) => {
    setOverrides((prev) => ({ ...prev, [bomId]: value }));
    setItems((prev) =>
      prev.map((item) =>
        item.bom_id === bomId
          ? { ...item, suggestion: value === "" ? "" : Number(value) }
          : item
      )
    );
  };

  // 套用手動調整
  const handleApply = async () => {
    const payload = Object.entries(overrides)
      .filter(([_, v]) => v !== "" && !Number.isNaN(Number(v)))
      .map(([bom_id, suggestion]) => ({
        bom_id: Number(bom_id),
        suggestion: Number(suggestion),
      }));

    setSaving(true);
    setError("");
    setTemplateError("");
    try {
      const res = await applyAutoRestockOverrides(payload);
      setItems(sortSuggestions(res.data?.suggestions || []));
      setOverrides({});
    } catch (err) {
      setError("套用手動調整失敗");
    } finally {
      setSaving(false);
    }
  };

  // 解析原料對應供應商
  const resolveSupplier = (bomId, fallback) => {
    const selectedId = selectedSupplierMap[bomId];
    if (selectedId) return selectedId;
    return fallback?.supplier?.supplier_id || null;
  };

  // 取得已選供應商的聯絡資訊
  const resolveSupplierInfo = (bomId) => {
    const sid = selectedSupplierMap[bomId];
    if (!sid) return null;
    const candidate = materialSuppliers.find(
      (ms) => ms.bom_id === bomId && ms.supplier_id === sid
    );
    return candidate || null;
  };

  // 取得供應商信譽摘要
  const resolveSupplierReputation = (supplierId) => {
    if (!supplierId) return null;
    return reputationMap[supplierId] || null;
  };

  // 勾選叫貨確認
  const handleCheckChange = (item, checked) => {
    setCheckedMap((prev) => ({ ...prev, [item.bom_id]: checked }));
  };

  // 送出勾選的叫貨紀錄
  const submitCheckedOrders = async () => {
    const target = items.filter(
      (i) => checkedMap[i.bom_id] && (Number(i.suggestion) || 0) > 0
    );
    if (!target.length) {
      setError(
        "請勾選需要送出的項目，且補貨量大於 0"
      );
      return;
    }
    const batchTime = new Date().toISOString();
    const orders = [];
    for (const item of target) {
      const supplierId = resolveSupplier(item.bom_id, item);
      if (!supplierId) {
        setError(
          `缺少 ${item.material_name} 供應商，無法建立叫貨紀錄`
        );
        return;
      }
      const rep = resolveSupplierReputation(supplierId);
      if (rep?.is_blocked) {
        const supplierName =
          materialSuppliers.find((ms) => ms.supplier_id === supplierId)
            ?.supplier_name || `#${supplierId}`;
        setError(
          `供應商 ${supplierName} 已封鎖，請更換廠商`
        );
        return;
      }
      orders.push({
        supplier_id: supplierId,
        bom_id: item.bom_id,
        order_qty: Number(item.suggestion) || 0,
        order_time: batchTime,
      });
    }
    try {
      await createPurchaseOrders(orders);
      setCheckedMap({});
      setInfo("叫貨紀錄已送出");
    } catch (err) {
      setError("建立叫貨紀錄失敗");
    }
  };

  // 產生 Email 模板並標記已勾選
  const handleSendEmails = async () => {
    setTemplateError("");
    setInfo("");
    // 只處理尚未勾選、聯絡方式為 Email、且補貨量 > 0 的項目
    const targetItems = items.filter((i) => {
      const info = resolveSupplierInfo(i.bom_id);
      return (
        !checkedMap[i.bom_id] &&
        info?.email &&
        (contactMode[i.bom_id] || "email") === "email" &&
        (Number(i.suggestion) || 0) > 0
      );
    });
    if (!targetItems.length) {
      setTemplateError(
        "請至少選擇一筆有 Email 的項目"
      );
      return;
    }

    // 同供應商合併一封郵件
    const grouped = new Map();
    targetItems.forEach((item) => {
      const info = resolveSupplierInfo(item.bom_id);
      if (!info) return;
      const key = info.supplier_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          email: info.email,
          supplier_name: info.supplier_name,
          lines: [],
        });
      }
      grouped.get(key).lines.push(
        `- ${item.material_name}：${Number(item.suggestion) || 0}`
      );
    });
    setTemplates(
      Array.from(grouped.values()).map((g) => ({
        email: g.email,
        subject: `補貨請求 - ${g.supplier_name || "供應商"}`,
        body: `廠商：${g.supplier_name}\n需求原料：\n${g.lines.join(
          "\n"
        )}\n請確認到貨，謝謝`,
      }))
    );
    // 標記為已勾選，但不寫入叫貨紀錄
    setCheckedMap((prev) => ({
      ...prev,
      ...Object.fromEntries(targetItems.map((i) => [i.bom_id, true])),
    }));
    setTemplateOpen(true);
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography variant="h4" gutterBottom>
          補貨建議清單
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleSendEmails}
            disabled={loading || saving}
          >
            快速郵件 (Email)
          </Button>
          <Button
            variant="outlined"
            onClick={submitCheckedOrders}
            disabled={loading || saving}
          >
            送出叫貨紀錄
          </Button>
          <Button
            variant="outlined"
            onClick={fetchData}
            disabled={loading || saving}
          >
            重新整理
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={saving || loading}
          >
            {saving ? "套用中..." : "套用手動調整"}
          </Button>
        </Box>
      </Box>
      {(error || templateError) && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error || templateError}
        </Typography>
      )}
      {info && (
        <Typography color="success.main" sx={{ mb: 2 }}>
          {info}
        </Typography>
      )}
      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={24} />
          <Typography>載入中...</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>原料名稱</TableCell>
                <TableCell>供應商 / 聯絡方式</TableCell>
                <TableCell>聯絡資訊</TableCell>
                <TableCell align="center">
                  建議補貨量
                </TableCell>
                <TableCell align="center">
                  現有庫存 / 最大庫存
                </TableCell>
                <TableCell align="center">原因計算</TableCell>
                <TableCell align="center">補貨確認</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const hasSupplier =
                  selectedSupplierMap[item.bom_id] ||
                  item.supplier?.supplier_id;
                const selectedSupplierId = selectedSupplierMap[item.bom_id];
                const selectedRep = resolveSupplierReputation(
                  selectedSupplierId
                );
                return (
                  <TableRow
                    key={item.bom_id}
                    sx={{ height: rowHeight(item.suggestion) }}
                  >
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ fontWeight: 600 }}
                    >
                      {item.material_name}
                    </TableCell>
                    <TableCell>
                      <Stack
                        spacing={1}
                        alignItems="flex-start"
                        sx={{ pr: 2 }}
                      >
                        <TextField
                          select
                          label="選擇供應商"
                          size="small"
                          value={selectedSupplierMap[item.bom_id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const sid = val === "" ? "" : Number(val);
                            if (reputationMap[sid]?.is_blocked) {
                              setError(
                                "該供應商已封鎖"
                              );
                              return;
                            }
                            setSelectedSupplierMap((prev) => ({
                              ...prev,
                              [item.bom_id]: sid,
                            }));
                            const info = materialSuppliers.find(
                              (ms) =>
                                ms.bom_id === item.bom_id &&
                                ms.supplier_id === sid
                            );
                            setContactMode((prev) => ({
                              ...prev,
                              [item.bom_id]: info?.email ? "email" : "phone",
                            }));
                          }}
                          SelectProps={{ native: false }}
                          sx={{ minWidth: 220 }}
                        >
                          <MenuItem value="">
                            <em>未選擇</em>
                          </MenuItem>
                          {materialSuppliers
                            .filter((ms) => ms.bom_id === item.bom_id)
                            .map((ms) => {
                              const rep = reputationMap[ms.supplier_id];
                              const blocked = rep?.is_blocked;
                              const label = blocked
                                ? `${ms.supplier_name} (封鎖中)`
                                : ms.supplier_name;
                              return (
                                <MenuItem
                                  key={`${item.bom_id}-${ms.supplier_id}`}
                                  value={ms.supplier_id}
                                  disabled={blocked}
                                >
                                  {label}
                                </MenuItem>
                              );
                            })}
                        </TextField>
                        <TextField
                          select
                          label="聯絡方式"
                          size="small"
                          value={
                            selectedSupplierMap[item.bom_id]
                              ? contactMode[item.bom_id] ||
                                (materialSuppliers.find(
                                  (ms) =>
                                    ms.bom_id === item.bom_id &&
                                    ms.supplier_id ===
                                      selectedSupplierMap[item.bom_id]
                                )?.email
                                  ? "email"
                                  : "phone")
                              : ""
                          }
                          onChange={(e) =>
                            setContactMode((prev) => ({
                              ...prev,
                              [item.bom_id]: e.target.value,
                            }))
                          }
                          disabled={
                            !selectedSupplierMap[item.bom_id] ||
                            (Number(item.suggestion) || 0) <= 0
                          }
                          sx={{ minWidth: 180 }}
                        >
                          <MenuItem value="email">Email</MenuItem>
                          <MenuItem value="phone">電話</MenuItem>
                          <MenuItem value="" disabled>
                            未選擇
                          </MenuItem>
                        </TextField>
                        {selectedRep?.recent_events?.length ? (
                          <Stack spacing={0.25}>
                            <Typography variant="caption">
                              近期事件：
                            </Typography>
                            {selectedRep.recent_events.map((ev) => (
                              <Typography
                                key={ev.event_id}
                                variant="caption"
                                color="text.secondary"
                              >
                                {ev.event_name} ·{" "}
                                {formatDateTime(ev.occurred_at)}
                              </Typography>
                            ))}
                          </Stack>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const info = materialSuppliers.find(
                          (ms) =>
                            ms.bom_id === item.bom_id &&
                            ms.supplier_id === selectedSupplierMap[item.bom_id]
                        );
                        if (!info) {
                          return (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              未選擇
                            </Typography>
                          );
                        }
                        return (
                          <Stack spacing={0.75} alignItems="flex-start">
                            {info.email && (
                              <Typography variant="body2">
                                Email: {info.email}
                              </Typography>
                            )}
                            {info.phone && (
                              <Typography variant="body2">
                                電話: {info.phone}
                              </Typography>
                            )}
                            {!info.email && !info.phone && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                未設定聯絡資訊
                              </Typography>
                            )}
                          </Stack>
                        );
                      })()}
                    </TableCell>
                    <TableCell align="center" sx={{ maxWidth: 140 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={item.suggestion}
                        onChange={(e) =>
                          handleOverrideChange(item.bom_id, e.target.value)
                        }
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {`${item.total_stock} / ${item.max_stock_qty}`}
                    </TableCell>
                    <TableCell align="left" sx={{ minWidth: 260 }}>
                      <Stack
                        direction="column"
                        spacing={0.75}
                        sx={{
                          alignItems: "center",
                          backgroundColor: "rgba(211, 84, 0, 0.06)",
                          borderRadius: 2,
                          p: 1,
                          width: "100%",
                        }}
                      >
                        {item.reasons && item.reasons.length > 0 ? (
                          item.reasons.map((reason, idx) => (
                            <Chip
                              key={`${item.bom_id}-reason-${idx}`}
                              label={`${reason.text}${
                                reason.effect ? ` (${reason.effect})` : ""
                              }`}
                              size="small"
                              color={reasonColor(reason)}
                              variant="filled"
                            />
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            無計算原因
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={!!checkedMap[item.bom_id]}
                            onChange={(e) =>
                              handleCheckChange(item, e.target.checked)
                            }
                            disabled={
                              !hasSupplier ||
                              (Number(item.suggestion) || 0) <= 0
                            }
                          />
                        }
                        label="已聯絡叫貨"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          郵件模板 (未實際發送)
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {templates.map((t, idx) => (
              <Paper
                key={idx}
                variant="outlined"
                sx={{ p: 1.5, backgroundColor: "rgba(0,0,0,0.02)" }}
              >
                <Typography variant="subtitle2">
                  收件人：{t.email}
                </Typography>
                <Typography variant="subtitle1" sx={{ mt: 0.5 }}>
                  主旨：{t.subject}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "pre-line" }}
                >
                  {t.body}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateOpen(false)}>
            關閉
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RestockSuggestions;
