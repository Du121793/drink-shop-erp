import React from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
} from "@mui/material";

import PermissionMatrix from "../components/permissions/PermissionMatrix";

import usePermissionsManage from "./permissionsManage/usePermissionsManage";

function PermissionsManage() {
  const { roles, permissions, employees, setEmployees, selectedRoleId, setSelectedRoleId, roleDetail, roleForm, setRoleForm, roleInheritIds, setRoleInheritIds, rolePermissionMap, setRolePermissionMap, message, error, saving, registerToken, setRegisterToken, registerName, setRegisterName, registerRoles, setRegisterRoles, overrideDialogOpen, overrideEmployee, setOverrideEmployee, createDialogOpen, setCreateDialogOpen, createForm, setCreateForm, assignableRoles, handleRoleSave, handleRoleDelete, handleCreateRole, handleUpdateEmployee, handleRegisterEmployee, roleMap, openOverrideDialog, closeOverrideDialog, handleOverrideSave, overrideMap, isSystemRole } = usePermissionsManage();
const renderRoleChips = (roleIds = []) => {
    if (!roleIds.length) {
      return <Chip label="未指派" size="small" />;
    }
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {roleIds.map((id) => {
          const role = roleMap.get(String(id));
          return <Chip key={id} label={role ? role.role_name : id} size="small" />;
        })}
      </Stack>
    );
  };

const renderInheritChips = (roleIds = []) => {
    if (!roleIds.length) {
      return <Chip label="本身" size="small" />;
    }
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {roleIds.map((id) => {
          const role = roleMap.get(String(id));
          return <Chip key={id} label={role ? role.role_name : id} size="small" />;
        })}
      </Stack>
    );
  };
return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h4">權限管理</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {message && <Typography color="success.main">{message}</Typography>}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Paper sx={{ p: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">角色設定</Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setCreateDialogOpen(true)}
            >
              新增角色
            </Button>
          </Stack>

          <TextField
            select
            fullWidth
            label="選擇角色"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(String(e.target.value))}
            sx={{ mb: 2 }}
          >
            {roles.map((role) => (
              <MenuItem key={role.role_id} value={role.role_id}>
                {role.role_name}
                {role.is_assignable ? "" : "（模板）"}
              </MenuItem>
            ))}
          </TextField>

          {roleDetail?.role ? (
            <Stack spacing={2}>
              <TextField
                label="角色名稱"
                value={roleForm.role_name}
                onChange={(e) =>
                  setRoleForm((prev) => ({
                    ...prev,
                    role_name: e.target.value,
                  }))
                }
                disabled={isSystemRole}
              />
              <TextField
                label="說明"
                value={roleForm.description}
                onChange={(e) =>
                  setRoleForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                disabled={isSystemRole}
              />
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={roleForm.is_assignable}
                      onChange={(e) =>
                        setRoleForm((prev) => ({
                          ...prev,
                          is_assignable: e.target.checked,
                        }))
                      }
                      disabled={isSystemRole}
                    />
                  }
                  label="可指派"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={roleForm.is_active}
                      onChange={(e) =>
                        setRoleForm((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                  }
                  label="啟用"
                />
              </Stack>
              <TextField
                select
                fullWidth
                label="繼承角色（模板/其他角色）"
                value={roleInheritIds}
                onChange={(e) => {
                  const val = e.target.value;
                  const next = typeof val === "string" ? val.split(",") : val;
                  setRoleInheritIds(next.map((v) => String(v)));
                }}
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => renderInheritChips(selected),
                }}
              >
                {roles
                  .filter((r) => r.role_id !== roleDetail.role.role_id)
                  .map((r) => (
                    <MenuItem key={r.role_id} value={r.role_id}>
                      {r.role_name}
                      {r.is_assignable ? "" : "（模板）"}
                    </MenuItem>
                  ))}
              </TextField>

              <PermissionMatrix
                permissions={permissions}
                value={rolePermissionMap}
                onChange={setRolePermissionMap}
              />

              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={handleRoleSave} disabled={saving}>
                  儲存角色
                </Button>
                {!isSystemRole && (
                  <Button
                    color="error"
                    variant="outlined"
                    onClick={handleRoleDelete}
                    disabled={saving}
                  >
                    刪除角色
                  </Button>
                )}
              </Stack>
            </Stack>
          ) : (
            <Typography>請先選擇角色。</Typography>
          )}
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            註冊新員工
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="註冊 token"
              value={registerToken}
              onChange={(e) => setRegisterToken(e.target.value)}
            />
            <TextField
              label="員工姓名（選填）"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
            />
            <TextField
              select
              label="指派角色"
              value={registerRoles}
              onChange={(e) => {
                const val = e.target.value;
                const next =
                  typeof val === "string" ? val.split(",") : val;
                setRegisterRoles(next.map((v) => String(v)));
              }}
              SelectProps={{
                multiple: true,
                renderValue: (selected) => renderRoleChips(selected),
              }}
            >
              {assignableRoles.map((r) => (
                <MenuItem key={r.role_id} value={r.role_id}>
                  {r.role_name}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={handleRegisterEmployee} disabled={saving}>
              完成註冊
            </Button>
          </Stack>
        </Paper>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          員工權限設定
        </Typography>
        {employees.length === 0 ? (
          <Typography>尚無員工資料</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Line ID</TableCell>
                  <TableCell>員工姓名</TableCell>
                  <TableCell>角色</TableCell>
                  <TableCell align="center">覆寫</TableCell>
                  <TableCell align="center">更新</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((emp, idx) => (
                  <TableRow key={emp.line_id}>
                    <TableCell sx={{ wordBreak: "break-all" }}>
                      {emp.line_id}
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        value={emp.employee_name || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEmployees((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, employee_name: val }
                                : item
                            )
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
                          const nextRoles =
                            typeof val === "string"
                              ? val.split(",")
                              : val;
                          setEmployees((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, roles: nextRoles } : item
                            )
                          );
                        }}
                        SelectProps={{
                          multiple: true,
                          renderValue: (selected) => renderRoleChips(selected),
                        }}
                      >
                        {assignableRoles.map((r) => (
                          <MenuItem key={r.role_id} value={r.role_id}>
                            {r.role_name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openOverrideDialog(emp)}
                      >
                        覆寫權限
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleUpdateEmployee(emp)}
                        disabled={saving}
                      >
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

      <Dialog
        open={overrideDialogOpen}
        onClose={closeOverrideDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>員工權限覆寫</DialogTitle>
        <DialogContent>
          {overrideEmployee ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="subtitle2">
                {overrideEmployee.employee_name || overrideEmployee.line_id}
              </Typography>
              <PermissionMatrix
                permissions={permissions}
                value={overrideMap}
                onChange={(next) => {
                  const overrides = Object.entries(next)
                    .filter(([, effect]) => effect === 1 || effect === -1)
                    .map(([permission_id, effect]) => ({
                      permission_id,
                      effect,
                    }));
                  setOverrideEmployee((prev) => ({ ...prev, overrides }));
                }}
              />
            </Stack>
          ) : (
            <Typography>尚未選擇員工</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeOverrideDialog}>取消</Button>
          <Button variant="contained" onClick={handleOverrideSave} disabled={saving}>
            儲存覆寫
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>新增角色</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="角色名稱"
              value={createForm.role_name}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  role_name: e.target.value,
                }))
              }
            />
            <TextField
              label="說明"
              value={createForm.description}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={createForm.is_assignable}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      is_assignable: e.target.checked,
                    }))
                  }
                />
              }
              label="可指派"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreateRole} disabled={saving}>
            建立角色
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


export default PermissionsManage;
