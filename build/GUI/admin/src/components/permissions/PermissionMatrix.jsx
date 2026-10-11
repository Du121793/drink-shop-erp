import React from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from "@mui/material";

const EFFECT_OPTIONS = [
  { value: 0, label: "不設定" },
  { value: 1, label: "允許" },
  { value: -1, label: "拒絕" },
];

function groupByCategory(permissions = []) {
  const map = new Map();
  permissions.forEach((p) => {
    const key = p.category || "其他";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });
  return Array.from(map.entries()).map(([category, items]) => ({
    category,
    items: items.sort((a, b) => String(a.code).localeCompare(String(b.code))),
  }));
}

function PermissionMatrix({ permissions = [], value = {}, onChange }) {
  const grouped = React.useMemo(() => groupByCategory(permissions), [permissions]);

  const handleCategoryToggle = (items, checked) => {
    const next = { ...value };
    items.forEach((item) => {
      const key = String(item.permission_id);
      next[key] = checked ? 1 : 0;
    });
    onChange(next);
  };

  const handleEffectChange = (permissionKey, effect) => {
    const next = { ...value, [permissionKey]: effect };
    if (effect === 0) {
      delete next[permissionKey];
    }
    onChange(next);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {grouped.map((group) => {
        const allGranted =
          group.items.length > 0 &&
          group.items.every((item) => value[String(item.permission_id)] === 1);

        return (
          <Paper key={group.category} variant="outlined" sx={{ p: 2 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
              }}
            >
              <Typography variant="subtitle1">{group.category}</Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={allGranted}
                    onChange={(e) =>
                      handleCategoryToggle(group.items, e.target.checked)
                    }
                  />
                }
                label="全選"
              />
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {group.items.map((item) => {
                const key = String(item.permission_id);
                const effect = value[key] ?? 0;
                const selectId = `permission-effect-${key}`;
                const labelId = `permission-effect-label-${key}`;
                return (
                  <Grid item xs={12} md={6} key={item.permission_id}>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.name}
                      </Typography>
                      {item.description && (
                        <Typography variant="caption" color="text.secondary">
                          {item.description}
                        </Typography>
                      )}
                      <FormControl size="small">
                        <InputLabel id={labelId}>設定</InputLabel>
                        <Select
                          id={selectId}
                          labelId={labelId}
                          value={effect}
                          label="設定"
                          onChange={(e) =>
                            handleEffectChange(key, Number(e.target.value))
                          }
                        >
                          {EFFECT_OPTIONS.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        );
      })}
    </Box>
  );
}

export default PermissionMatrix;
