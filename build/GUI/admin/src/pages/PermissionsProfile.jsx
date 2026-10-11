import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Stack,
  Chip,
  Divider,
} from "@mui/material";
import { getMe, updateMe, getPermissions } from "../api/permissions";

function PermissionsProfile() {
  const [me, setMe] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [permissionMap, setPermissionMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const sortedPermissions = React.useMemo(
    () => [...permissions].sort(),
    [permissions]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, permRes] = await Promise.all([getMe(), getPermissions()]);
        setMe(meRes.data?.employee || null);
        setPermissions(meRes.data?.permissions || []);
        const map = {};
        (permRes.data?.permissions || []).forEach((p) => {
          map[p.code] = p.name;
        });
        setPermissionMap(map);
      } catch {
        setError("載入個人資訊失敗，請稍後再試。");
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
      setMessage("已更新個人資訊");
    } catch {
      setError("更新個人資訊失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const renderRoles = (roleList = []) => (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {roleList.map((role) => (
        <Chip
          key={role.role_id}
          label={role.role_name}
          size="small"
          color={role.is_assignable ? "primary" : "default"}
          variant={role.is_assignable ? "filled" : "outlined"}
        />
      ))}
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h4">個人資訊</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {message && <Typography color="success.main">{message}</Typography>}

      <Paper sx={{ p: 2, maxWidth: 640 }}>
        {!me ? (
          <Typography>載入中...</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Line ID"
              value={me.line_id}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="姓名"
              value={me.employee_name || ""}
              onChange={(e) =>
                setMe((prev) => ({ ...prev, employee_name: e.target.value }))
              }
            />
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                身分角色
              </Typography>
              {renderRoles(me.roles || [])}
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                可用權限
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {sortedPermissions.map((code) => (
                  <Chip
                    key={code}
                    label={permissionMap[code] ? `${permissionMap[code]} (${code})` : code}
                    size="small"
                  />
                ))}
              </Box>
            </Box>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              更新個人資訊
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default PermissionsProfile;
