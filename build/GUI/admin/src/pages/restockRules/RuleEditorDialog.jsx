import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Typography,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import StepEditor from "./StepEditor";
import { TEXT, SCOPE_OPTIONS } from "./schema";
import {
  normalizeRuleParams,
  normalizeTags,
  uniqueTags,
  createStep,
  parseJsonSafe,
} from "./utils";

const DEFAULT_FORM = {
  rule_name: "",
  rule_type: "custom",
  priority: 100,
  enabled: true,
  scope: "global",
  tags: [],
  params: { steps: [] },
};

function RuleEditorDialog({ open, rule, tagOptions, onClose, onSave }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [manualJson, setManualJson] = useState(false);
  const [manualText, setManualText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const params = normalizeRuleParams(rule?.params || { steps: [] });
    setForm({
      ...DEFAULT_FORM,
      ...rule,
      rule_type: rule?.rule_type || "custom",
      tags: normalizeTags(rule?.tags || []),
      params,
    });
    setManualJson(false);
    setManualText(JSON.stringify(params, null, 2));
    setError("");
  }, [open, rule]);

  const steps = useMemo(
    () => (Array.isArray(form.params?.steps) ? form.params.steps : []),
    [form.params]
  );

  const updateSteps = (nextSteps) => {
    setForm((prev) => ({
      ...prev,
      params: { ...(prev.params || {}), steps: nextSteps },
    }));
  };

  const handleSave = () => {
    let nextParams = form.params;
    if (manualJson) {
      const parsed = parseJsonSafe(manualText, null);
      if (!parsed) {
        setError(TEXT.jsonInvalid);
        return;
      }
      nextParams = parsed;
    }
    onSave({ ...form, params: nextParams, tags: uniqueTags(form.tags) });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{rule ? TEXT.editRule : TEXT.createRule}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label={TEXT.ruleName}
            value={form.rule_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, rule_name: e.target.value }))
            }
            fullWidth
          />
          <Autocomplete
            multiple
            freeSolo
            options={tagOptions}
            value={form.tags}
            onChange={(event, value) => {
              setForm((prev) => ({ ...prev, tags: uniqueTags(value) }));
            }}
            renderInput={(params) => (
              <TextField {...params} label={TEXT.tags} />
            )}
          />
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label={TEXT.priority}
              value={form.priority}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  priority: Number(e.target.value) || 0,
                }))
              }
              sx={{ minWidth: 180 }}
            />
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>{TEXT.scope}</InputLabel>
              <Select
                label={TEXT.scope}
                value={form.scope}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, scope: e.target.value }))
                }
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                />
              }
              label={TEXT.enabled}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle1">{TEXT.stepsTitle}</Typography>
            {steps.length === 0 && (
              <Typography color="text.secondary">{TEXT.stepEmpty}</Typography>
            )}
            {steps.map((step, index) => (
              <StepEditor
                key={`step-${index}`}
                step={step}
                index={index}
                onChange={(next) => {
                  const nextSteps = [...steps];
                  nextSteps[index] = next;
                  updateSteps(nextSteps);
                }}
                onRemove={() => {
                  updateSteps(steps.filter((_, i) => i !== index));
                }}
                disabled={manualJson}
              />
            ))}
            <Button
              variant="outlined"
              onClick={() => updateSteps([...steps, createStep()])}
              disabled={manualJson}
            >
              {TEXT.addStep}
            </Button>
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={manualJson}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (!checked) {
                    const parsed = parseJsonSafe(manualText, null);
                    if (!parsed) {
                      setError(TEXT.jsonInvalid);
                      return;
                    }
                    setForm((prev) => ({
                      ...prev,
                      params: normalizeRuleParams(parsed),
                    }));
                  } else {
                    setManualText(JSON.stringify(form.params, null, 2));
                  }
                  setManualJson(checked);
                  setError("");
                }}
              />
            }
            label={TEXT.manualRuleJson}
          />
          <TextField
            label="JSON"
            multiline
            minRows={4}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            InputProps={{ readOnly: !manualJson }}
          />
          {error && <Typography color="error">{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{TEXT.cancel}</Button>
        <Button variant="contained" onClick={handleSave}>
          {TEXT.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RuleEditorDialog;
