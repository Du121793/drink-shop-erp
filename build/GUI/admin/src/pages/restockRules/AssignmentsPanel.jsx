import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Autocomplete,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  Paper,
} from "@mui/material";
import StepEditor from "./StepEditor";
import {
  getMaterialRestockRules,
  upsertMaterialRestockRule,
  deleteMaterialRestockRule,
} from "../../api/autoRestock";
import { getBoms } from "../../api/inventory";
import { TEXT } from "./schema";
import { parseJsonSafe, normalizeRuleParams, createStep } from "./utils";

const DEFAULT_ASSIGN = {
  rule_id: "",
  enabled: true,
};

const DEFAULT_PARAMS = { steps: [] };

function AssignmentsPanel({ rules }) {
  const [boms, setBoms] = useState([]);
  const [selectedBomId, setSelectedBomId] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [assignForm, setAssignForm] = useState(DEFAULT_ASSIGN);
  const [overrideParams, setOverrideParams] = useState(DEFAULT_PARAMS);
  const [manualJson, setManualJson] = useState(false);
  const [manualText, setManualText] = useState(JSON.stringify(DEFAULT_PARAMS, null, 2));
  const [useBaseRule, setUseBaseRule] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ruleOptions = useMemo(
    () =>
      (rules || []).map((rule) => ({
        id: rule.rule_id,
        label: rule.rule_name,
      })),
    [rules]
  );

  const steps = useMemo(
    () => (Array.isArray(overrideParams.steps) ? overrideParams.steps : []),
    [overrideParams]
  );

  const assignmentMap = useMemo(() => {
    const map = new Map();
    (assignments || []).forEach((item) => {
      map.set(String(item.rule_id), item);
    });
    return map;
  }, [assignments]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getBoms();
        if (!active) return;
        setBoms(res.data?.boms || []);
      } catch (err) {
        if (!active) return;
        setBoms([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedBomId) {
      setAssignments([]);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await getMaterialRestockRules(Number(selectedBomId));
        if (!active) return;
        setAssignments(res.data?.assignments || []);
      } catch (err) {
        if (!active) return;
        setAssignments([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedBomId]);

  useEffect(() => {
    if (!assignForm.rule_id) return;
    if (useBaseRule) return;
    const assignment = assignmentMap.get(String(assignForm.rule_id));
    if (!assignment) return;
    const rule = (rules || []).find(
      (item) => String(item.rule_id) === String(assignForm.rule_id)
    );
    setAssignForm((prev) => ({
      ...prev,
      enabled: assignment.enabled !== false,
    }));
    applyRuleParams(rule, assignment);
  }, [assignmentMap, assignForm.rule_id, rules, useBaseRule]);

  const updateOverrideParams = (params, markDirty = false) => {
    setOverrideParams(params);
    setManualText(JSON.stringify(params, null, 2));
    if (markDirty) {
      setUseBaseRule(false);
    }
  };

  const applyRuleParams = (rule, assignment) => {
    const rawParams = assignment?.override_params ?? rule?.params ?? DEFAULT_PARAMS;
    const params = normalizeRuleParams(rawParams);
    setManualJson(false);
    updateOverrideParams(params);
    setUseBaseRule(!assignment);
  };

  const handleApply = async () => {
    setError("");
    const parsed = manualJson
      ? parseJsonSafe(manualText, null)
      : overrideParams;
    if (!parsed) {
      setError(TEXT.jsonInvalid);
      return;
    }
    if (!selectedBomId || !assignForm.rule_id) return;
    setLoading(true);
    try {
      const existing = assignmentMap.get(String(assignForm.rule_id));
      if (useBaseRule && assignForm.enabled) {
        if (existing) {
          await deleteMaterialRestockRule(
            Number(selectedBomId),
            Number(assignForm.rule_id)
          );
        }
      } else {
        await upsertMaterialRestockRule(
          Number(selectedBomId),
          Number(assignForm.rule_id),
          { enabled: assignForm.enabled, override_params: parsed }
        );
      }
      const res = await getMaterialRestockRules(Number(selectedBomId));
      setAssignments(res.data?.assignments || []);
      setAssignForm(DEFAULT_ASSIGN);
      setManualJson(false);
      setOverrideParams(DEFAULT_PARAMS);
      setManualText(JSON.stringify(DEFAULT_PARAMS, null, 2));
      setUseBaseRule(false);
    } catch (err) {
      setError(TEXT.errSaveAssign || "儲存原料規則失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ruleId) => {
    if (!selectedBomId) return;
    setLoading(true);
    try {
      await deleteMaterialRestockRule(Number(selectedBomId), Number(ruleId));
      const res = await getMaterialRestockRules(Number(selectedBomId));
      setAssignments(res.data?.assignments || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {TEXT.assignTitle}
      </Typography>
      <Stack spacing={2}>
        <Autocomplete
          options={boms}
          getOptionLabel={(opt) => opt.material_name || ""}
          value={
            boms.find((bom) => String(bom.bom_id) === String(selectedBomId)) ||
            null
          }
          onChange={(event, value) => {
            setSelectedBomId(value?.bom_id ? String(value.bom_id) : "");
          }}
          renderInput={(params) => (
            <TextField {...params} label={TEXT.selectMaterial} />
          )}
        />

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Autocomplete
              options={ruleOptions}
              value={
                ruleOptions.find(
                  (opt) => String(opt.id) === String(assignForm.rule_id)
                ) || null
              }
              onChange={(event, value) => {
                const ruleId = value?.id ? String(value.id) : "";
                const rule = (rules || []).find(
                  (item) => String(item.rule_id) === String(ruleId)
                );
                const assignment = assignmentMap.get(ruleId);
                setAssignForm((prev) => ({
                  ...prev,
                  rule_id: ruleId,
                  enabled: assignment ? assignment.enabled !== false : true,
                }));
                applyRuleParams(rule, assignment);
              }}
              renderInput={(params) => (
                <TextField {...params} label={TEXT.selectRule} />
              )}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={assignForm.enabled}
                  onChange={(e) =>
                    setAssignForm((prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                  disabled={useBaseRule}
                />
              }
              label={TEXT.enabled}
            />
            <Typography variant="body2" color="text.secondary">
              {TEXT.overrideHint}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={() => {
                  const rule = (rules || []).find(
                    (item) =>
                      String(item.rule_id) === String(assignForm.rule_id)
                  );
                  applyRuleParams(rule, null);
                  setAssignForm((prev) => ({ ...prev, enabled: true }));
                }}
                disabled={!assignForm.rule_id}
              >
                {TEXT.fillFromRule}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setManualJson(false);
                  updateOverrideParams(DEFAULT_PARAMS);
                  setUseBaseRule(false);
                }}
                disabled={!assignForm.rule_id}
              >
                {TEXT.clearOverride}
              </Button>
            </Stack>

            <Typography variant="subtitle1">{TEXT.assignOverrideTitle}</Typography>
            {steps.length === 0 && (
              <Typography color="text.secondary">{TEXT.stepEmpty}</Typography>
            )}
            {steps.map((step, index) => (
              <StepEditor
                key={`assign-step-${index}`}
                step={step}
                index={index}
                onChange={(next) => {
                  const nextSteps = [...steps];
                  nextSteps[index] = next;
                  updateOverrideParams(
                    { ...overrideParams, steps: nextSteps },
                    true
                  );
                }}
                onRemove={() => {
                  updateOverrideParams({
                    ...overrideParams,
                    steps: steps.filter((_, i) => i !== index),
                  }, true);
                }}
                disabled={manualJson}
              />
            ))}
            <Button
              variant="outlined"
              onClick={() =>
                updateOverrideParams(
                  {
                    ...overrideParams,
                    steps: [...steps, createStep()],
                  },
                  true
                )
              }
              disabled={manualJson}
            >
              {TEXT.addStep}
            </Button>

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
                      updateOverrideParams(normalizeRuleParams(parsed), true);
                    } else {
                      setManualText(JSON.stringify(overrideParams, null, 2));
                      setUseBaseRule(false);
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
              onChange={(e) => {
                setManualText(e.target.value);
                if (manualJson) setUseBaseRule(false);
              }}
              InputProps={{ readOnly: !manualJson }}
              fullWidth
            />
            {error && <Typography color="error">{error}</Typography>}
            <Button
              variant="contained"
              onClick={handleApply}
              disabled={loading || !selectedBomId || !assignForm.rule_id}
            >
              {TEXT.applyMaterial}
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {TEXT.assignments}
          </Typography>
          {loading ? (
            <Typography color="text.secondary">{TEXT.loading}</Typography>
          ) : assignments.length === 0 ? (
            <Typography color="text.secondary">{TEXT.assignmentsEmpty}</Typography>
          ) : (
            <Stack spacing={1}>
              {assignments.map((item) => (
                <Stack
                  key={`${item.rule_id}-${item.bom_id}`}
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="body2">
                      {item.rule_name} ({item.enabled ? "啟用" : "停用"})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {typeof item.override_params === "string"
                        ? item.override_params
                        : JSON.stringify(item.override_params)}
                    </Typography>
                  </Box>
                  <Button
                    color="error"
                    size="small"
                    onClick={() => handleDelete(item.rule_id)}
                    disabled={loading}
                  >
                    {TEXT.delete}
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}

export default AssignmentsPanel;
