import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, TextField, Button, Stack, Chip } from "@mui/material";
import { getMe, updateMe, getRoles } from "../api/permissions";

function PermissionsProfile() {
  const [me, setMe] = useState(null);
  const [rolesMap, setRolesMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, rolesRes] = await Promise.all([getMe(), getRoles()]);
        setMe(meRes.data?.employee || null);
        const map = {};
        (rolesRes.data?.roles || []).forEach((r) => {
          map[r.role_id] = r.role_name;
        });
        setRolesMap(map);
      } catch (err) {
        setError("載入個人資料失敗，請稍後再試");
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!me) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await updateMe({ employee_name: me.employee_name });
      setMessage("已更新個人資料");
    } catch (err) {
      setError("更新個人資料失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  const renderRoles = (roleIds = []) => (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {roleIds.map((id) => (
        <Chip key={id} label={rolesMap[id] || `角色 ${id}`} size="small" />
      ))}
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h4">個人資料</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {message && <Typography color="success.main">{message}</Typography>}

      <Paper sx={{ p: 2, maxWidth: 520 }}>
        {!me ? (
          <Typography>載入中...</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField label="Line ID" value={me.line_id} InputProps={{ readOnly: true }} />
            <TextField
              label="姓名"
              value={me.employee_name || ""}
              onChange={(e) => setMe((prev) => ({ ...prev, employee_name: e.target.value }))}
            />
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                身分組
              </Typography>
              {renderRoles(me.roles || [])}
            </Box>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              儲存個人資料
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default PermissionsProfile;
