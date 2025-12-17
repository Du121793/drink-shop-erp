import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  MenuItem,
  Stack,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
} from "@mui/material";
import { getRoles, getEmployees, updateEmployee, registerEmployee } from "../api/permissions";

function PermissionsManage() {
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [registerToken, setRegisterToken] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerRoles, setRegisterRoles] = useState([]);

  const loadAll = async () => {
    setError("");
    try {
      const [rRes, eRes] = await Promise.all([getRoles(), getEmployees()]);
      setRoles(rRes.data?.roles || []);
      setEmployees(eRes.data?.employees || []);
    } catch (err) {
      console.error("載入角色/員工失敗", err);
      setError("載入角色或員工資料失敗，請稍後再試。");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleUpdateEmployee = async (emp) => {
    setMessage("");
    setError("");
    setSaving(true);
    try {
      await updateEmployee(emp.line_id, {
        employee_name: emp.employee_name,
        role_ids: emp.roles,
      });
      setMessage(`已更新 ${emp.line_id}`);
      loadAll();
    } catch (err) {
      console.error("更新員工失敗", err);
      setError("更新員工失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterEmployee = async () => {
    if (!registerToken) {
      setError("請輸入註冊代碼");
      return;
    }
    setMessage("");
    setError("");
    setSaving(true);
    try {
      await registerEmployee({
        token: registerToken,
        role_ids: registerRoles,
        employee_name: registerName || undefined,
      });
      setMessage("已註冊並設定身分組");
      setRegisterToken("");
      setRegisterName("");
      setRegisterRoles([]);
      loadAll();
    } catch (err) {
      console.error("註冊員工失敗", err);
      setError("註冊員工失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const renderRoles = (roleIds = []) => (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {roleIds.map((id) => {
        const r = roles.find((x) => x.role_id === id);
        return <Chip key={id} label={r ? r.role_name : id} size="small" />;
      })}
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h4">管理員工</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {message && <Typography color="success.main">{message}</Typography>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            註冊新員工（使用註冊代碼）
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField label="註冊代碼" value={registerToken} onChange={(e) => setRegisterToken(e.target.value)} />
            <TextField label="員工姓名（可選）" value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
            <TextField
              select
              label="指定身分組"
              value={registerRoles}
              onChange={(e) => {
                const val = e.target.value;
                const next = typeof val === "string" ? val.split(",").map(Number) : val;
                setRegisterRoles(next);
              }}
              SelectProps={{
                multiple: true,
                renderValue: (selected) => renderRoles(selected),
              }}
            >
              {roles.map((r) => (
                <MenuItem key={r.role_id} value={r.role_id}>
                  {r.role_name}（等級 {r.permission_level}）
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={handleRegisterEmployee} disabled={saving}>
              註冊並設定身分組
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            現有身分組
          </Typography>
          {roles.length === 0 ? (
            <Typography>尚無資料</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>角色名稱</TableCell>
                    <TableCell>權限等級</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.role_id}>
                      <TableCell>{r.role_name}</TableCell>
                      <TableCell>{r.permission_level}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          員工與身分組
        </Typography>
        {employees.length === 0 ? (
          <Typography>尚無員工</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>line_id</TableCell>
                  <TableCell>員工名稱</TableCell>
                  <TableCell>身分組</TableCell>
                  <TableCell align="center">動作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((emp, idx) => (
                  <TableRow key={emp.line_id}>
                    <TableCell sx={{ wordBreak: "break-all" }}>{emp.line_id}</TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        value={emp.employee_name || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEmployees((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, employee_name: val } : item))
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={emp.roles || []}
                        onChange={(e) => {
                          const val = e.target.value;
                          const nextRoles = typeof val === "string" ? val.split(",").map(Number) : val;
                          setEmployees((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, roles: nextRoles } : item))
                          );
                        }}
                        SelectProps={{
                          multiple: true,
                          renderValue: (selected) => renderRoles(selected),
                        }}
                      >
                        {roles.map((r) => (
                          <MenuItem key={r.role_id} value={r.role_id}>
                            {r.role_name}（等級 {r.permission_level}）
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell align="center">
                      <Button variant="contained" size="small" onClick={() => handleUpdateEmployee(emp)} disabled={saving}>
                        儲存
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

export default PermissionsManage;
