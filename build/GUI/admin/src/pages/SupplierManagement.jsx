import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  Stack,
  Autocomplete,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
} from "@mui/material";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getMaterialSuppliers,
  setDefaultMaterialSupplier,
  upsertMaterialSupplier,
  deleteMaterialSupplier,
} from "../api/suppliers";
import { getBoms } from "../api/inventory";
import {
  getSupplierReputation,
  getSupplierReputationDetail,
  getSupplierEventTypes,
  createSupplierEvent,
  getSupplierBlocks,
  unblockSupplierBlock,
} from "../api/supplierReputation";

// 供應商管理（手機友善：表格包 TableContainer，欄位短標題）
function SupplierManagement() {
  const [suppliers, setSuppliers] = useState([]);
  const [boms, setBoms] = useState([]);
  const [materialSuppliers, setMaterialSuppliers] = useState([]);
  const [form, setForm] = useState({
    supplier_name: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [supplierMaterials, setSupplierMaterials] = useState({});
  const [reputationMap, setReputationMap] = useState({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailSupplier, setDetailSupplier] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [eventForm, setEventForm] = useState({ event_type_id: "", note: "" });
  const [eventSaving, setEventSaving] = useState(false);
  const [blockedSuppliers, setBlockedSuppliers] = useState([]);
  const [blockLoading, setBlockLoading] = useState(false);

  const defaultMap = useMemo(() => {
    const map = {};
    materialSuppliers.forEach((ms) => {
      if (ms.is_default) map[ms.bom_id] = ms.supplier_id;
    });
    return map;
  }, [materialSuppliers]);

  // 載入供應商、原料與信譽相關資料
  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [supRes, bomRes, msRes, blockRes] = await Promise.all([
        getSuppliers(),
        getBoms(),
        getMaterialSuppliers(),
        getSupplierBlocks(),
      ]);
      const nextSuppliers = supRes.data?.suppliers || [];
      const nextBoms = bomRes.data?.boms || [];
      const nextMaterialSuppliers = msRes.data?.materialSuppliers || [];
      setSuppliers(nextSuppliers);
      setBoms(nextBoms);
      setMaterialSuppliers(nextMaterialSuppliers);
      setBlockedSuppliers(blockRes.data?.blocks || []);

      const map = {};
      nextMaterialSuppliers.forEach((ms) => {
        if (!map[ms.supplier_id]) map[ms.supplier_id] = new Set();
        map[ms.supplier_id].add(ms.bom_id);
      });
      setSupplierMaterials(
        Object.fromEntries(
          Object.entries(map).map(([k, v]) => [k, Array.from(v)])
        )
      );

      if (nextSuppliers.length) {
        const repRes = await getSupplierReputation(
          nextSuppliers.map((s) => s.supplier_id)
        );
        const repMap = {};
        (repRes.data?.summaries || []).forEach((item) => {
          repMap[item.supplier_id] = item;
        });
        setReputationMap(repMap);
      } else {
        setReputationMap({});
      }
    } catch (err) {
      setError("取得供應商資料失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // 新增供應商
  const handleCreateSupplier = async () => {
    if (!form.supplier_name) {
      setError("請填寫廠商名稱");
      return;
    }
    try {
      await createSupplier(form);
      setForm({ supplier_name: "", email: "", phone: "" });
      fetchAll();
    } catch (err) {
      setError("新增供應商失敗");
    }
  };

  // 同步供應商可供應的原料清單
  const syncSupplierMaterials = async (supplierId) => {
    const current = supplierMaterials[supplierId] || [];
    const existing = materialSuppliers
      .filter((ms) => ms.supplier_id === supplierId)
      .map((ms) => ms.bom_id);
    const toAdd = current.filter((id) => !existing.includes(id));
    const toRemove = existing.filter((id) => !current.includes(id));

    for (const bomId of toAdd) {
      await upsertMaterialSupplier({
        supplier_id: supplierId,
        bom_id: bomId,
        is_default: false,
      });
    }
    for (const bomId of toRemove) {
      await deleteMaterialSupplier({ supplier_id: supplierId, bom_id: bomId });
    }
  };

  // 更新供應商資料並同步原料關聯
  const handleUpdateSupplier = async (supplier) => {
    try {
      await updateSupplier(supplier.supplier_id, {
        supplier_name: supplier.supplier_name,
        email: supplier.email,
        phone: supplier.phone,
      });
      await syncSupplierMaterials(supplier.supplier_id);
      fetchAll();
    } catch (err) {
      setError("更新供應商失敗");
    }
  };

  // 刪除供應商與其原料關聯
  const handleDeleteSupplier = async (supplier) => {
    try {
      const existing = materialSuppliers.filter(
        (ms) => ms.supplier_id === supplier.supplier_id
      );
      for (const ms of existing) {
        await deleteMaterialSupplier({
          supplier_id: ms.supplier_id,
          bom_id: ms.bom_id,
        });
      }
      await deleteSupplier(supplier.supplier_id);
      fetchAll();
    } catch (err) {
      setError("刪除供應商失敗");
    }
  };

  // 設定原料預設供應商
  const handleDefaultChange = async (bomId, supplierId) => {
    if (!supplierId) {
      setError("請選擇預設供應商");
      return;
    }
    try {
      await setDefaultMaterialSupplier({
        bom_id: bomId,
        supplier_id: supplierId,
      });
      fetchAll();
    } catch (err) {
      setError("設定預設供應商失敗");
    }
  };

  // 開啟信譽明細視窗並載入事件
  const openDetail = async (supplier) => {
    setDetailOpen(true);
    setDetailSupplier(supplier);
    setDetailLoading(true);
    setDetail(null);
    setEventForm({ event_type_id: "", note: "" });
    try {
      const [detailRes, typeRes] = await Promise.all([
        getSupplierReputationDetail(supplier.supplier_id, 50),
        getSupplierEventTypes(false),
      ]);
      setDetail(detailRes.data?.detail || null);
      setEventTypes(typeRes.data?.types || []);
    } catch (err) {
      setError("取得信譽明細失敗");
    } finally {
      setDetailLoading(false);
    }
  };

  // 建立信譽事件並更新分數
  const handleCreateEvent = async () => {
    if (!detailSupplier) return;
    if (!eventForm.event_type_id) {
      setError("請選擇事件類型");
      return;
    }
    setEventSaving(true);
    setError("");
    try {
      await createSupplierEvent(detailSupplier.supplier_id, {
        event_type_id: Number(eventForm.event_type_id),
        note: eventForm.note,
      });
      const detailRes = await getSupplierReputationDetail(
        detailSupplier.supplier_id,
        50
      );
      setDetail(detailRes.data?.detail || null);
      const repRes = await getSupplierReputation([
        detailSupplier.supplier_id,
      ]);
      const repMap = {};
      (repRes.data?.summaries || []).forEach((item) => {
        repMap[item.supplier_id] = item;
      });
      setReputationMap((prev) => ({ ...prev, ...repMap }));
      setEventForm({ event_type_id: "", note: "" });
    } catch (err) {
      setError("建立事件失敗");
    } finally {
      setEventSaving(false);
    }
  };

  // 解除封鎖
  const handleUnblock = async (blockId) => {
    setBlockLoading(true);
    setError("");
    try {
      await unblockSupplierBlock(blockId);
      fetchAll();
    } catch (err) {
      setError("解除封鎖失敗");
    } finally {
      setBlockLoading(false);
    }
  };

  // 關閉明細視窗並清空表單
  const closeDetail = () => {
    setDetailOpen(false);
    setDetailSupplier(null);
    setDetail(null);
    setEventForm({ event_type_id: "", note: "" });
  };

  // 格式化時間顯示
  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  // 依信譽分數與狀態渲染標籤
  const renderScoreChip = (supplierId) => {
    const rep = reputationMap[supplierId];
    if (!rep) return <Chip size="small" label="-" />;
    if (rep.is_blocked) {
      return (
        <Chip
          size="small"
          color="error"
          label="封鎖中"
        />
      );
    }
    const score = Number(rep.score);
    const label = Number.isFinite(score) ? score.toFixed(1) : "-";
    const color =
      score >= 80 ? "success" : score >= 60 ? "warning" : "error";
    return <Chip size="small" color={color} label={label} />;
  };

  // 顯示近期事件摘要
  const renderRecentEvents = (supplierId) => {
    const rep = reputationMap[supplierId];
    if (!rep?.recent_events?.length) {
      return (
        <Typography variant="body2" color="text.secondary">
          無近期事件
        </Typography>
      );
    }
    return (
      <Stack spacing={0.5}>
        {rep.recent_events.map((ev) => (
          <Typography key={ev.event_id} variant="body2">
            {ev.event_name} · {formatDateTime(ev.occurred_at)}
          </Typography>
        ))}
      </Stack>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography variant="h4">
        供應商管理
      </Typography>
      {error && <Typography color="error">{error}</Typography>}

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          新增供應商
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              fullWidth
              label="廠商名稱"
              value={form.supplier_name}
              onChange={(e) =>
                setForm({ ...form, supplier_name: e.target.value })
              }
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              fullWidth
              label="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              fullWidth
              label="電話"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              onClick={handleCreateSupplier}
              disabled={loading}
            >
              新增供應商
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          供應商清單
        </Typography>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>名稱</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>電話</TableCell>
                <TableCell>信譽分數</TableCell>
                <TableCell>近期事件</TableCell>
                <TableCell>供應原料</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.supplier_id} hover>
                  <TableCell>
                    <TextField
                      size="small"
                      value={s.supplier_name}
                      onChange={(e) =>
                        setSuppliers((prev) =>
                          prev.map((p) =>
                            p.supplier_id === s.supplier_id
                              ? { ...p, supplier_name: e.target.value }
                              : p
                          )
                        )
                      }
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={s.email || ""}
                      onChange={(e) =>
                        setSuppliers((prev) =>
                          prev.map((p) =>
                            p.supplier_id === s.supplier_id
                              ? { ...p, email: e.target.value }
                              : p
                          )
                        )
                      }
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={s.phone || ""}
                      onChange={(e) =>
                        setSuppliers((prev) =>
                          prev.map((p) =>
                            p.supplier_id === s.supplier_id
                              ? { ...p, phone: e.target.value }
                              : p
                          )
                        )
                      }
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>{renderScoreChip(s.supplier_id)}</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>
                    {renderRecentEvents(s.supplier_id)}
                    <Button
                      size="small"
                      sx={{ mt: 1 }}
                      onClick={() => openDetail(s)}
                    >
                      查看明細
                    </Button>
                  </TableCell>
                  <TableCell sx={{ minWidth: 240 }}>
                    <Autocomplete
                      multiple
                      size="small"
                      options={boms}
                      getOptionLabel={(opt) => opt.material_name || ""}
                      value={boms.filter((b) =>
                        supplierMaterials[s.supplier_id]?.includes(b.bom_id)
                      )}
                      onChange={(_, newVal) =>
                        setSupplierMaterials((prev) => ({
                          ...prev,
                          [s.supplier_id]: newVal.map((v) => v.bom_id),
                        }))
                      }
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            label={option.material_name}
                            size="small"
                            {...getTagProps({ index })}
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="供應原料"
                          placeholder={
                            params.inputProps?.value ? "" : "選擇原料"
                          }
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleUpdateSupplier(s)}
                        disabled={loading}
                      >
                        保存
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => handleDeleteSupplier(s)}
                        disabled={loading}
                      >
                        刪除
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!suppliers.length && (
                <TableRow>
                  <TableCell colSpan={7}>
                    尚無供應商資料
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          封鎖中供應商
        </Typography>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>供應商</TableCell>
                <TableCell>封鎖到期</TableCell>
                <TableCell>原因</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {blockedSuppliers.map((block) => (
                <TableRow key={block.block_id} hover>
                  <TableCell>
                    {block.supplier_name || `#${block.supplier_id}`}
                  </TableCell>
                  <TableCell>{formatDateTime(block.block_until)}</TableCell>
                  <TableCell>{block.reason || "-"}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleUnblock(block.block_id)}
                      disabled={blockLoading || loading}
                    >
                      解除封鎖
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!blockedSuppliers.length && (
                <TableRow>
                  <TableCell colSpan={4}>
                    目前沒有封鎖中的供應商
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          原料預設供應商
        </Typography>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>原料</TableCell>
                <TableCell>預設供應商</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {boms.map((bom) => (
                <TableRow key={bom.bom_id}>
                  <TableCell>{bom.material_name}</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      fullWidth
                      value={defaultMap[bom.bom_id] || ""}
                      onChange={(e) =>
                        handleDefaultChange(bom.bom_id, e.target.value)
                      }
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>未設定</em>
                      </MenuItem>
                      {suppliers
                        .filter((s) =>
                          (supplierMaterials[s.supplier_id] || []).includes(
                            bom.bom_id
                          )
                        )
                        .map((s) => (
                          <MenuItem key={s.supplier_id} value={s.supplier_id}>
                            {s.supplier_name}
                          </MenuItem>
                        ))}
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {!boms.length && (
                <TableRow>
                  <TableCell colSpan={2}>
                    尚無原料資料
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={detailOpen} onClose={closeDetail} fullWidth maxWidth="md">
        <DialogTitle>
          {detailSupplier?.supplier_name || "-"} · 信譽明細
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={20} />
              <Typography>
                載入中...
              </Typography>
            </Stack>
          ) : (
            <>
              <Stack spacing={1} sx={{ mb: 2 }}>
                <Typography>
                  分數：{" "}
                  {detail?.score != null ? Number(detail.score).toFixed(1) : "-"}
                </Typography>
                <Typography>
                  封鎖狀態：{" "}
                  {detail?.is_blocked
                    ? `封鎖中 (到期 ${formatDateTime(
                        detail.block_until
                      )})`
                    : "未封鎖"}
                </Typography>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                新增事件
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={5}>
                  <TextField
                    select
                    size="small"
                    label="事件類型"
                    fullWidth
                    value={eventForm.event_type_id}
                    sx={{ minWidth: 220 }}
                    onChange={(e) =>
                      setEventForm((prev) => ({
                        ...prev,
                        event_type_id: e.target.value,
                      }))
                    }
                  >
                    <MenuItem value="">
                      <em>請選擇</em>
                    </MenuItem>
                    {eventTypes.map((t) => (
                      <MenuItem key={t.event_type_id} value={t.event_type_id}>
                        {t.event_name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={7}>
                  <TextField
                    size="small"
                    label="備註"
                    fullWidth
                    value={eventForm.note}
                    onChange={(e) =>
                      setEventForm((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    onClick={handleCreateEvent}
                    disabled={eventSaving}
                  >
                    {eventSaving
                      ? "新增中..."
                      : "新增事件"}
                  </Button>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 2 }} />

              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                事件紀錄
              </Typography>
              {!detail?.events?.length ? (
                <Typography color="text.secondary">
                  目前無事件
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {detail.events.map((ev) => (
                    <Paper
                      key={ev.event_id}
                      variant="outlined"
                      sx={{ p: 1.5 }}
                    >
                      <Typography variant="subtitle2">
                        {ev.event_name} · {formatDateTime(ev.occurred_at)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        扣分：{" "}
                        {Number(ev.penalty || 0).toFixed(2)}
                      </Typography>
                      {ev.note && (
                        <Typography variant="body2">{ev.note}</Typography>
                      )}
                    </Paper>
                  ))}
                </Stack>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetail}>
            關閉
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SupplierManagement;
