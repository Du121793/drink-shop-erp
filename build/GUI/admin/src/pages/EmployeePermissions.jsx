import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
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
} from '@mui/material';
import { getRoles, getEmployees, updateEmployee } from '../api/permissions';

function EmployeePermissions() {
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setError('');
    try {
      const [rRes, eRes] = await Promise.all([getRoles(), getEmployees()]);
      setRoles(rRes.data?.roles || []);
      setEmployees(eRes.data?.employees || []);
    } catch (err) {
      console.error('載入角色/員工失敗', err);
      setError('載入角色或員工資料失敗，請稍後再試。');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleUpdateEmployee = async (emp) => {
    setMessage('');
    setError('');
    setSaving(true);
    try {
      await updateEmployee(emp.line_id, {
        employee_name: emp.employee_name,
        role_ids: emp.roles,
      });
      setMessage(`已更新 ${emp.line_id}`);
      loadAll();
    } catch (err) {
      console.error('更新員工失敗', err);
      setError('更新員工失敗，請稍後再試。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4">員工權限管理</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {message && <Typography color="success.main">{message}</Typography>}

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>現有身分組</Typography>
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

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>員工與身分組</Typography>
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
                    <TableCell sx={{ wordBreak: 'break-all' }}>{emp.line_id}</TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        value={emp.employee_name || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEmployees((prev) => prev.map((item, i) => i === idx ? { ...item, employee_name: val } : item));
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
                          const nextRoles = typeof val === 'string' ? val.split(',').map(Number) : val;
                          setEmployees((prev) => prev.map((item, i) => i === idx ? { ...item, roles: nextRoles } : item));
                        }}
                        SelectProps={{
                          multiple: true,
                          renderValue: (selected) => (
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {selected.map((id) => {
                                const r = roles.find((x) => x.role_id === id);
                                return <Chip key={id} label={r ? r.role_name : id} size="small" />;
                              })}
                            </Stack>
                          ),
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

export default EmployeePermissions;
