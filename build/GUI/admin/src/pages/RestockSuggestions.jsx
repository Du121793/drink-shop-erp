import React, { useEffect, useMemo, useState } from 'react';
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
} from '@mui/material';
import { getAutoRestockList, applyAutoRestockOverrides } from '../api/autoRestock';
import { createPurchaseOrders } from '../api/purchaseOrders';
import { getMaterialSuppliers } from '../api/suppliers';

// 右側加成標籤顏色規則
const reasonColor = (reason) => {
  const effect = reason?.effect || '';
  if (effect.includes('++') || effect.includes('+')) return 'success';
  if (effect.includes('x')) return 'primary';
  if (effect.includes('-')) return 'warning';
  return 'default';
};

function RestockSuggestions() {
  const [items, setItems] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checkedMap, setCheckedMap] = useState({});
  const [templates, setTemplates] = useState([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [materialSuppliers, setMaterialSuppliers] = useState([]);
  const [selectedSupplierMap, setSelectedSupplierMap] = useState({});
  const [contactMode, setContactMode] = useState({});
  const [info, setInfo] = useState('');

  const sortSuggestions = (list = []) => {
    const copy = [...list];
    copy.sort((a, b) => {
      const sa = Number(a.suggestion) || 0;
      const sb = Number(b.suggestion) || 0;
      if (sb !== sa) return sb - sa; // 建議量高者在前
      const la = a.shelf_life_days;
      const lb = b.shelf_life_days;
      if (la == null && lb == null) return 0;
      if (la == null) return 1; // 無保存期限排後
      if (lb == null) return -1;
      return la - lb; // 保存天數越短越前
    });
    return copy;
  };

  const maxSuggestion = useMemo(() => {
    if (!items.length) return 0;
    return Math.max(...items.map((i) => Number(i.suggestion) || 0));
  }, [items]);

  const rowHeight = (suggestion) => {
    const base = 72;
    if (!maxSuggestion) return base;
    const ratio = Math.min((Number(suggestion) || 0) / maxSuggestion, 1);
    return base + ratio * 80; // 建議量越高，行高越高
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setTemplateError('');
    setInfo('');
    try {
      const [restockRes, msRes] = await Promise.all([
        getAutoRestockList(),
        getMaterialSuppliers(),
      ]);
      const sorted = sortSuggestions(restockRes.data?.suggestions || []);
      setItems(sorted);
      setOverrides({});
      setCheckedMap({});
      setMaterialSuppliers(msRes.data?.materialSuppliers || []);

      // 預設選擇：僅在有預設廠商且補貨量 > 0 時帶入，否則為空
      const defaultSelected = {};
      const defaultContact = {};
      sorted.forEach((item) => {
        if ((Number(item.suggestion) || 0) <= 0) return;
        const candidates = (msRes.data?.materialSuppliers || []).filter((ms) => ms.bom_id === item.bom_id);
        const preferred = candidates.find((c) => c.is_default);
        if (preferred) {
          defaultSelected[item.bom_id] = preferred.supplier_id;
          defaultContact[item.bom_id] = preferred.email ? 'email' : 'phone';
        }
      });
      setSelectedSupplierMap(defaultSelected);
      setContactMode(defaultContact);
    } catch (err) {
      console.error('取得補貨建議清單失敗:', err);
      setError('取得補貨建議清單失敗，請稍後再試。可能是資料庫尚未匯入 example/06_supplier.sql。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOverrideChange = (bomId, value) => {
    setOverrides((prev) => ({ ...prev, [bomId]: value }));
    setItems((prev) =>
      prev.map((item) =>
        item.bom_id === bomId
          ? { ...item, suggestion: value === '' ? '' : Number(value) }
          : item
      )
    );
  };

  const handleApply = async () => {
    const payload = Object.entries(overrides)
      .filter(([_, v]) => v !== '' && !Number.isNaN(Number(v)))
      .map(([bom_id, suggestion]) => ({ bom_id: Number(bom_id), suggestion: Number(suggestion) }));

    setSaving(true);
    setError('');
    setTemplateError('');
    try {
      const res = await applyAutoRestockOverrides(payload);
      setItems(sortSuggestions(res.data?.suggestions || []));
      setOverrides({});
    } catch (err) {
      console.error('套用手動調整失敗:', err);
      setError('套用手動調整失敗，請稍後再試。');
    } finally {
      setSaving(false);
    }
  };

  const resolveSupplier = (bomId, fallback) => {
    const selectedId = selectedSupplierMap[bomId];
    if (selectedId) return selectedId;
    return fallback?.supplier?.supplier_id || null;
  };

  const resolveSupplierInfo = (bomId) => {
    const sid = selectedSupplierMap[bomId];
    if (!sid) return null;
    const candidate = materialSuppliers.find((ms) => ms.bom_id === bomId && ms.supplier_id === sid);
    return candidate || null;
  };

  const handleCheckChange = (item, checked) => {
    setCheckedMap((prev) => ({ ...prev, [item.bom_id]: checked }));
  };

  const submitCheckedOrders = async () => {
    const target = items.filter((i) => checkedMap[i.bom_id] && (Number(i.suggestion) || 0) > 0);
    if (!target.length) {
      setError('請先勾選需要提交的項目，且補貨量需大於 0。');
      return;
    }
    const batchTime = new Date().toISOString();
    const orders = [];
    for (const item of target) {
      const supplierId = resolveSupplier(item.bom_id, item);
      if (!supplierId) {
        setError(`缺少 ${item.material_name} 的廠商，無法建立叫貨紀錄。`);
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
      setInfo('叫貨紀錄已提交。');
    } catch (err) {
      console.error('建立叫貨紀錄失敗:', err);
      setError('建立叫貨紀錄失敗，請稍後再試。');
    }
  };

  const buildTemplate = (item) => {
    const supplier = item.supplier || {};
    const qty = Number(item.suggestion) || 0;
    return {
      bom_id: item.bom_id,
      supplier_id: supplier.supplier_id,
      email: supplier.email,
      subject: `補貨請求 - ${item.material_name}`,
      body: `廠商：${supplier.supplier_name || '（未設定）'}\n原料：${item.material_name}\n建議補貨量：${qty}\n請協助安排供貨，謝謝。`,
    };
  };

  const handleSendEmails = async () => {
    setTemplateError('');
    setInfo('');
    // 只處理「尚未勾選」的項目，且需有 email、聯繫方式為 email、補貨量 > 0
    const targetItems = items.filter((i) => {
      const info = resolveSupplierInfo(i.bom_id);
      return !checkedMap[i.bom_id] && info?.email && (contactMode[i.bom_id] || 'email') === 'email' && (Number(i.suggestion) || 0) > 0;
    });
    if (!targetItems.length) {
      setTemplateError('請至少選擇一個未勾選、補貨量大於 0 且有 email 的項目。');
      return;
    }

    // 同廠商合併一封郵件
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
      grouped.get(key).lines.push(`- ${item.material_name}：${Number(item.suggestion) || 0}`);
    });
    setTemplates(
      Array.from(grouped.values()).map((g) => ({
        email: g.email,
        subject: `補貨請求 - ${g.supplier_name || '供應商'}`,
        body: `廠商：${g.supplier_name}\n需求清單：\n${g.lines.join('\n')}\n請協助安排供貨，謝謝。`,
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>補貨建議清單</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" color="secondary" onClick={handleSendEmails} disabled={loading || saving}>
            快速郵件 (有 email)
          </Button>
          <Button variant="outlined" onClick={submitCheckedOrders} disabled={loading || saving}>
            提交叫貨紀錄
          </Button>
          <Button variant="outlined" onClick={fetchData} disabled={loading || saving}>
            重新整理
          </Button>
          <Button variant="contained" onClick={handleApply} disabled={saving || loading}>
            {saving ? '套用中...' : '套用手動調整'}
          </Button>
        </Box>
      </Box>
      {(error || templateError) && (
        <Typography color="error" sx={{ mb: 2 }}>{error || templateError}</Typography>
      )}
      {info && (
        <Typography color="success.main" sx={{ mb: 2 }}>{info}</Typography>
      )}
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={24} />
          <Typography>載入中...</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>原料名稱</TableCell>
                <TableCell>廠商 / 聯絡方式</TableCell>
                <TableCell>聯絡資訊</TableCell>
                <TableCell align="center">建議補貨量</TableCell>
                <TableCell align="center">當前庫存 / 最大庫存</TableCell>
                <TableCell align="center">加成計算</TableCell>
                <TableCell align="center">補貨確認</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const hasSupplier = selectedSupplierMap[item.bom_id] || item.supplier?.supplier_id;
                return (
                <TableRow key={item.bom_id} sx={{ height: rowHeight(item.suggestion) }}>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                    {item.material_name}
                  </TableCell>
                  <TableCell>
                    <Stack spacing={1} alignItems="flex-start" sx={{ pr: 2 }}>
                      <TextField
                        select
                        label="選擇廠商"
                        size="small"
                        value={selectedSupplierMap[item.bom_id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const sid = val === '' ? '' : Number(val);
                          setSelectedSupplierMap((prev) => ({ ...prev, [item.bom_id]: sid }));
                          const info = materialSuppliers.find((ms) => ms.bom_id === item.bom_id && ms.supplier_id === sid);
                          setContactMode((prev) => ({ ...prev, [item.bom_id]: info?.email ? 'email' : 'phone' }));
                        }}
                        SelectProps={{ native: false }}
                        sx={{ minWidth: 220 }}
                      >
                        <MenuItem value=""><em>未選擇</em></MenuItem>
                        {materialSuppliers
                          .filter((ms) => ms.bom_id === item.bom_id)
                          .map((ms) => (
                            <MenuItem key={`${item.bom_id}-${ms.supplier_id}`} value={ms.supplier_id}>
                              {ms.supplier_name}
                            </MenuItem>
                          ))}
                      </TextField>
                      <TextField
                        select
                        label="聯繫方式"
                        size="small"
                        value={
                          selectedSupplierMap[item.bom_id]
                            ? (contactMode[item.bom_id] || (materialSuppliers.find((ms) => ms.bom_id === item.bom_id && ms.supplier_id === selectedSupplierMap[item.bom_id])?.email ? 'email' : 'phone'))
                            : ''
                        }
                        onChange={(e) => setContactMode((prev) => ({ ...prev, [item.bom_id]: e.target.value }))}
                        disabled={!selectedSupplierMap[item.bom_id] || (Number(item.suggestion) || 0) <= 0}
                        sx={{ minWidth: 180 }}
                      >
                        <MenuItem value="email">Email</MenuItem>
                        <MenuItem value="phone">電話/其他</MenuItem>
                        <MenuItem value="" disabled>未選擇</MenuItem>
                      </TextField>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const info = materialSuppliers.find((ms) => ms.bom_id === item.bom_id && ms.supplier_id === selectedSupplierMap[item.bom_id]);
                      if (!info) return <Typography variant="body2" color="text.secondary">未選擇</Typography>;
                      return (
                        <Stack spacing={0.75} alignItems="flex-start">
                          {info.email && <Typography variant="body2">Email: {info.email}</Typography>}
                          {info.phone && <Typography variant="body2">電話: {info.phone}</Typography>}
                          {!(info.email || info.phone) && <Typography variant="body2" color="text.secondary">無聯絡資訊</Typography>}
                        </Stack>
                      );
                    })()}
                  </TableCell>
                  <TableCell align="center" sx={{ maxWidth: 140 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={item.suggestion}
                      onChange={(e) => handleOverrideChange(item.bom_id, e.target.value)}
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
                        alignItems: 'center',
                        backgroundColor: 'rgba(211, 84, 0, 0.06)',
                        borderRadius: 2,
                        p: 1,
                        width: '100%',
                      }}
                    >
                      {item.reasons && item.reasons.length > 0 ? item.reasons.map((reason, idx) => (
                        <Chip
                          key={`${item.bom_id}-reason-${idx}`}
                          label={`${reason.text}${reason.effect ? ` (${reason.effect})` : ''}`}
                          size="small"
                          color={reasonColor(reason)}
                          variant="filled"
                        />
                      )) : <Typography variant="body2" color="text.secondary">無原因資料</Typography>}
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!!checkedMap[item.bom_id]}
                          onChange={(e) => handleCheckChange(item, e.target.checked)}
                          disabled={!hasSupplier || (Number(item.suggestion) || 0) <= 0}
                        />
                      }
                      label="已聯繫/叫貨"
                    />
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={templateOpen} onClose={() => setTemplateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>郵件模板（未實際發送）</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {templates.map((t, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 1.5, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <Typography variant="subtitle2">收件人：{t.email}</Typography>
                <Typography variant="subtitle1" sx={{ mt: 0.5 }}>主旨：{t.subject}</Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{t.body}</Typography>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateOpen(false)}>關閉</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RestockSuggestions;
