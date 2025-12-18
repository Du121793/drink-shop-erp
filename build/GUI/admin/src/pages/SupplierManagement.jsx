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

// 供應商管理（手機友善：表格包 TableContainer，欄位短標題）
function SupplierManagement() {
  const [suppliers, setSuppliers] = useState([]);
  const [boms, setBoms] = useState([]);
  const [materialSuppliers, setMaterialSuppliers] = useState([]);
  const [form, setForm] = useState({ supplier_name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [supplierMaterials, setSupplierMaterials] = useState({});

  const defaultMap = useMemo(() => {
    const map = {};
    materialSuppliers.forEach((ms) => {
      if (ms.is_default) map[ms.bom_id] = ms.supplier_id;
    });
    return map;
  }, [materialSuppliers]);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [supRes, bomRes, msRes] = await Promise.all([
        getSuppliers(),
        getBoms(),
        getMaterialSuppliers(),
      ]);
      setSuppliers(supRes.data?.suppliers || []);
      setBoms(bomRes.data?.boms || []);
      setMaterialSuppliers(msRes.data?.materialSuppliers || []);
      const map = {};
      (msRes.data?.materialSuppliers || []).forEach((ms) => {
        if (!map[ms.supplier_id]) map[ms.supplier_id] = new Set();
        map[ms.supplier_id].add(ms.bom_id);
      });
      setSupplierMaterials(
        Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Array.from(v)]))
      );
    } catch (err) {
      setError("取得供應商/原料資料失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

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
      setError("新增供應商失敗，請稍後再試。");
    }
  };

  const syncSupplierMaterials = async (supplierId) => {
    const current = supplierMaterials[supplierId] || [];
    const existing = materialSuppliers
      .filter((ms) => ms.supplier_id === supplierId)
      .map((ms) => ms.bom_id);
    const toAdd = current.filter((id) => !existing.includes(id));
    const toRemove = existing.filter((id) => !current.includes(id));

    for (const bomId of toAdd) {
      await upsertMaterialSupplier({ supplier_id: supplierId, bom_id: bomId, is_default: false });
    }
    for (const bomId of toRemove) {
      await deleteMaterialSupplier({ supplier_id: supplierId, bom_id: bomId });
    }
  };

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
      setError("更新供應商失敗，請稍後再試。");
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    try {
      const existing = materialSuppliers.filter((ms) => ms.supplier_id === supplier.supplier_id);
      for (const ms of existing) {
        await deleteMaterialSupplier({ supplier_id: ms.supplier_id, bom_id: ms.bom_id });
      }
      await deleteSupplier(supplier.supplier_id);
      fetchAll();
    } catch (err) {
      setError("刪除供應商失敗，請確認是否仍被設定為預設供應商。");
    }
  };

  const handleDefaultChange = async (bomId, supplierId) => {
    if (!supplierId) {
      setError("請選擇要設為預設的供應商");
      return;
    }
    try {
      await setDefaultMaterialSupplier({ bom_id: bomId, supplier_id: supplierId });
      fetchAll();
    } catch (err) {
      setError("設定預設供應商失敗，請稍後再試。");
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography variant="h4">供應商管理</Typography>
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
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
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
            <Button variant="contained" onClick={handleCreateSupplier} disabled={loading}>
              新增供應商
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          廠商列表與提供原料
        </Typography>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>名稱</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>電話</TableCell>
                <TableCell>提供原料</TableCell>
                <TableCell align="right">動作</TableCell>
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
                            p.supplier_id === s.supplier_id ? { ...p, supplier_name: e.target.value } : p
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
                            p.supplier_id === s.supplier_id ? { ...p, email: e.target.value } : p
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
                            p.supplier_id === s.supplier_id ? { ...p, phone: e.target.value } : p
                          )
                        )
                      }
                      fullWidth
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 240 }}>
                    <Autocomplete
                      multiple
                      size="small"
                      options={boms}
                      getOptionLabel={(opt) => opt.material_name || ""}
                      value={boms.filter((b) => supplierMaterials[s.supplier_id]?.includes(b.bom_id))}
                      onChange={(_, newVal) =>
                        setSupplierMaterials((prev) => ({
                          ...prev,
                          [s.supplier_id]: newVal.map((v) => v.bom_id),
                        }))
                      }
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip label={option.material_name} size="small" {...getTagProps({ index })} />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="提供原料"
                          placeholder={params.inputProps?.value ? "" : "選擇原料"}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleUpdateSupplier(s)}
                        disabled={loading}
                      >
                        儲存
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
                  <TableCell colSpan={5}>尚無廠商資料</TableCell>
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
                      onChange={(e) => handleDefaultChange(bom.bom_id, e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>未設定</em>
                      </MenuItem>
                      {suppliers
                        .filter((s) => (supplierMaterials[s.supplier_id] || []).includes(bom.bom_id))
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
                  <TableCell colSpan={2}>尚無原料資料</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default SupplierManagement;
