import React from "react";
import {
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
} from "@mui/material";
import {
  TARGET_TYPE_OPTIONS,
  TARGET_PARAM_FIELDS,
  COMPARE_OPTIONS,
  VALUE_TYPE_OPTIONS,
  SEASON_OPTIONS,
} from "./schema";
import { createTarget, parseInputValue } from "./utils";

function TargetRow({ target, onChange, onRemove, disabled }) {
  const type = target?.type || TARGET_TYPE_OPTIONS[0]?.value || "always";
  const params = target?.params || {};
  const fields = TARGET_PARAM_FIELDS[type] || [];

  const updateParams = (key, value) => {
    onChange({
      ...target,
      type,
      params: { ...params, [key]: value },
    });
  };

  const renderField = (field) => {
    if (field.key === "compare") {
      return (
        <FormControl size="small" sx={{ minWidth: 120 }} key={field.key}>
          <InputLabel>{field.label}</InputLabel>
          <Select
            label={field.label}
            value={params.compare || ">="}
            onChange={(e) => updateParams("compare", e.target.value)}
            disabled={disabled}
          >
            {COMPARE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    if (field.key === "value_type") {
      return (
        <FormControl size="small" sx={{ minWidth: 160 }} key={field.key}>
          <InputLabel>{field.label}</InputLabel>
          <Select
            label={field.label}
            value={params.value_type || "number"}
            onChange={(e) => updateParams("value_type", e.target.value)}
            disabled={disabled}
          >
            {VALUE_TYPE_OPTIONS.filter((opt) => opt.value !== "source").map(
              (opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              )
            )}
          </Select>
        </FormControl>
      );
    }

    if (field.key === "seasons") {
      return (
        <FormControl size="small" sx={{ minWidth: 220 }} key={field.key}>
          <InputLabel>{field.label}</InputLabel>
          <Select
            label={field.label}
            multiple
            value={params.seasons || []}
            onChange={(e) => updateParams("seasons", e.target.value)}
            disabled={disabled}
          >
            {SEASON_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    return (
      <TextField
        key={field.key}
        label={field.label}
        size="small"
        value={
          params[field.key] === undefined
            ? ""
            : typeof params[field.key] === "object"
              ? JSON.stringify(params[field.key])
              : String(params[field.key])
        }
        onChange={(e) => updateParams(field.key, parseInputValue(e.target.value))}
        fullWidth
        disabled={disabled}
      />
    );
  };

  return (
    <Stack spacing={1} direction={{ xs: "column", md: "row" }}>
      <FormControl size="small" sx={{ minWidth: 220 }}>
        <InputLabel>條件類型</InputLabel>
        <Select
          label="條件類型"
          value={type}
          onChange={(e) => onChange(createTarget(e.target.value))}
          disabled={disabled}
        >
          {TARGET_TYPE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {fields.map((field) => renderField(field))}
      <Button
        color="error"
        onClick={onRemove}
        disabled={disabled}
        sx={{ alignSelf: "center" }}
      >
        刪除
      </Button>
    </Stack>
  );
}

export default TargetRow;
