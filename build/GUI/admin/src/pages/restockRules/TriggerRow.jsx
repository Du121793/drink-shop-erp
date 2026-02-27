import React from "react";
import {
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Typography,
} from "@mui/material";
import {
  ACTION_OPTIONS,
  BASE_OPTIONS,
  OPERATOR_OPTIONS,
  VALUE_TYPE_OPTIONS,
  TARGET_VALUE_TYPE_OPTIONS,
  LIMIT_DIRECTION_OPTIONS,
  SOURCE_OPTIONS,
  SOURCE_PARAM_FIELDS,
  TEXT,
} from "./schema";
import { parseInputValue, getDefaultSource, buildSourceParams } from "./utils";

function TriggerRow({ trigger, onChange, onRemove, disabled }) {
  const action = trigger?.action || "operate";

  const updateTrigger = (patch) => {
    onChange({ ...trigger, ...patch });
  };

  const ensureSourceConfig = (field, sourceField, paramsField, sourceValue) => {
    updateTrigger({
      [field]: "source",
      [sourceField]: sourceValue,
      [paramsField]: buildSourceParams(sourceValue),
    });
  };

  const renderSourceParams = (source, params, onParamsChange) => {
    const fields = SOURCE_PARAM_FIELDS[source] || [];
    if (!fields.length) return null;
    return (
      <Stack spacing={1} sx={{ width: "100%" }}>
        {fields.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            size="small"
            value={
              params?.[field.key] === undefined
                ? ""
                : typeof params[field.key] === "object"
                  ? JSON.stringify(params[field.key])
                  : String(params[field.key])
            }
            onChange={(e) =>
              onParamsChange({
                ...params,
                [field.key]: parseInputValue(e.target.value),
              })
            }
            fullWidth
            disabled={disabled}
          />
        ))}
      </Stack>
    );
  };

  const baseWarning =
    (action === "operate" || action === "set") &&
    trigger?.base &&
    trigger.base !== "add";

  return (
    <Stack spacing={1} direction="column">
      <Stack spacing={1} direction={{ xs: "column", md: "row" }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>動作</InputLabel>
          <Select
            label="動作"
            value={action}
            onChange={(e) => {
              const nextAction = e.target.value;
              onChange({
                action: nextAction,
                ...(nextAction === "operate"
                  ? {
                      base: "add",
                      op: "+",
                      value_type: "number",
                      value: 0,
                      text: trigger.text || "",
                    }
                  : nextAction === "set"
                    ? {
                        base: "add",
                        target_type: "number",
                        target_value: 0,
                        text: trigger.text || "",
                      }
                    : {
                        direction: "upper",
                        limit_type: "number",
                        limit_value: 0,
                        text: trigger.text || "",
                      }),
              });
            }}
            disabled={disabled}
          >
            {ACTION_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {(action === "operate" || action === "set") && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>計算基準</InputLabel>
            <Select
              label="計算基準"
              value={trigger.base || "add"}
              onChange={(e) => updateTrigger({ base: e.target.value })}
              disabled={disabled}
            >
              {BASE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {action === "operate" && (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>運算</InputLabel>
            <Select
              label="運算"
              value={trigger.op || "+"}
              onChange={(e) => updateTrigger({ op: e.target.value })}
              disabled={disabled}
            >
              {OPERATOR_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {action === "operate" && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>數值類型</InputLabel>
            <Select
              label="數值類型"
              value={trigger.value_type || "number"}
              onChange={(e) => {
                const type = e.target.value;
                if (type === "source") {
                  const nextSource = trigger.value_source || getDefaultSource();
                  ensureSourceConfig(
                    "value_type",
                    "value_source",
                    "value_params",
                    nextSource
                  );
                } else {
                  updateTrigger({ value_type: type });
                }
              }}
              disabled={disabled}
            >
              {VALUE_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {action === "operate" && trigger.value_type !== "source" && (
          <TextField
            label="數值"
            size="small"
            value={
              trigger.value === undefined
                ? ""
                : typeof trigger.value === "object"
                  ? JSON.stringify(trigger.value)
                  : String(trigger.value)
            }
            onChange={(e) => updateTrigger({ value: parseInputValue(e.target.value) })}
            fullWidth
            disabled={disabled}
          />
        )}
        {action === "operate" && trigger.value_type === "source" && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>來源</InputLabel>
            <Select
              label="來源"
              value={trigger.value_source || ""}
              onChange={(e) => {
                const nextSource = e.target.value;
                updateTrigger({
                  value_source: nextSource,
                  value_params: buildSourceParams(nextSource),
                });
              }}
              disabled={disabled}
            >
              {SOURCE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {action === "set" && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>調整方式</InputLabel>
            <Select
              label="調整方式"
              value={trigger.target_type || "number"}
              onChange={(e) => {
                const type = e.target.value;
                if (type === "source") {
                  const nextSource = trigger.target_source || getDefaultSource();
                  updateTrigger({
                    target_type: "source",
                    target_source: nextSource,
                    target_params: buildSourceParams(nextSource),
                  });
                } else {
                  updateTrigger({ target_type: type });
                }
              }}
              disabled={disabled}
            >
              {TARGET_VALUE_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {action === "set" && trigger.target_type !== "source" && (
          <TextField
            label="調整值"
            size="small"
            value={
              trigger.target_value === undefined
                ? ""
                : typeof trigger.target_value === "object"
                  ? JSON.stringify(trigger.target_value)
                  : String(trigger.target_value)
            }
            onChange={(e) =>
              updateTrigger({ target_value: parseInputValue(e.target.value) })
            }
            fullWidth
            disabled={disabled}
          />
        )}
        {action === "set" && trigger.target_type === "source" && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>來源</InputLabel>
            <Select
              label="來源"
              value={trigger.target_source || ""}
              onChange={(e) => {
                const nextSource = e.target.value;
                updateTrigger({
                  target_source: nextSource,
                  target_params: buildSourceParams(nextSource),
                });
              }}
              disabled={disabled}
            >
              {SOURCE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {action === "limit" && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>限制方向</InputLabel>
            <Select
              label="限制方向"
              value={trigger.direction || "upper"}
              onChange={(e) => updateTrigger({ direction: e.target.value })}
              disabled={disabled}
            >
              {LIMIT_DIRECTION_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {action === "limit" && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>限制方式</InputLabel>
            <Select
              label="限制方式"
              value={trigger.limit_type || "number"}
              onChange={(e) => {
                const type = e.target.value;
                if (type === "source") {
                  const nextSource = trigger.limit_source || getDefaultSource();
                  updateTrigger({
                    limit_type: "source",
                    limit_source: nextSource,
                    limit_params: buildSourceParams(nextSource),
                  });
                } else {
                  updateTrigger({ limit_type: type });
                }
              }}
              disabled={disabled}
            >
              {VALUE_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {action === "limit" && trigger.limit_type !== "source" && (
          <TextField
            label="限制值"
            size="small"
            value={
              trigger.limit_value === undefined
                ? ""
                : typeof trigger.limit_value === "object"
                  ? JSON.stringify(trigger.limit_value)
                  : String(trigger.limit_value)
            }
            onChange={(e) =>
              updateTrigger({ limit_value: parseInputValue(e.target.value) })
            }
            fullWidth
            disabled={disabled}
          />
        )}
        {action === "limit" && trigger.limit_type === "source" && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>來源</InputLabel>
            <Select
              label="來源"
              value={trigger.limit_source || ""}
              onChange={(e) => {
                const nextSource = e.target.value;
                updateTrigger({
                  limit_source: nextSource,
                  limit_params: buildSourceParams(nextSource),
                });
              }}
              disabled={disabled}
            >
              {SOURCE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Button
          color="error"
          onClick={onRemove}
          disabled={disabled}
          sx={{ alignSelf: "center" }}
        >
          刪除
        </Button>
      </Stack>

      {action === "operate" && trigger.value_type === "source" && (
        <Stack spacing={1}>
          {renderSourceParams(
            trigger.value_source,
            trigger.value_params,
            (next) => updateTrigger({ value_params: next })
          )}
        </Stack>
      )}
      {action === "set" && trigger.target_type === "source" && (
        <Stack spacing={1}>
          {renderSourceParams(
            trigger.target_source,
            trigger.target_params,
            (next) => updateTrigger({ target_params: next })
          )}
        </Stack>
      )}
      {action === "limit" && trigger.limit_type === "source" && (
        <Stack spacing={1}>
          {renderSourceParams(
            trigger.limit_source,
            trigger.limit_params,
            (next) => updateTrigger({ limit_params: next })
          )}
        </Stack>
      )}

      <TextField
        label={TEXT.triggerText}
        size="small"
        value={trigger.text || ""}
        onChange={(e) => updateTrigger({ text: e.target.value })}
        fullWidth
        disabled={disabled}
      />

      {baseWarning && (
        <Typography variant="caption" color="warning.main">
          {TEXT.warningOverride}
        </Typography>
      )}
    </Stack>
  );
}

export default TriggerRow;
