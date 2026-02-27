import React from "react";
import { Stack, Paper, Typography, Button, Divider } from "@mui/material";
import TargetRow from "./TargetRow";
import TriggerRow from "./TriggerRow";
import { TEXT } from "./schema";
import { createTarget, createTrigger } from "./utils";

function StepEditor({ step, index, onChange, onRemove, disabled }) {
  const targets = Array.isArray(step.targets) ? step.targets : [];
  const triggers = Array.isArray(step.triggers) ? step.triggers : [];

  const updateTargets = (nextTargets) => {
    onChange({ ...step, targets: nextTargets });
  };

  const updateTriggers = (nextTriggers) => {
    onChange({ ...step, triggers: nextTriggers });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
        >
          <Typography variant="subtitle1">步驟 {index + 1}</Typography>
          <Button color="error" onClick={onRemove} disabled={disabled}>
            {TEXT.removeStep}
          </Button>
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">{TEXT.targetsTitle}</Typography>
          {targets.length === 0 && (
            <Typography color="text.secondary">{TEXT.targetEmpty}</Typography>
          )}
          {targets.map((target, targetIndex) => (
            <TargetRow
              key={`target-${targetIndex}`}
              target={target}
              onChange={(next) => {
                const nextTargets = [...targets];
                nextTargets[targetIndex] = next;
                updateTargets(nextTargets);
              }}
              onRemove={() => {
                updateTargets(targets.filter((_, i) => i !== targetIndex));
              }}
              disabled={disabled}
            />
          ))}
          <Button
            variant="outlined"
            onClick={() => updateTargets([...targets, createTarget("always")])}
            disabled={disabled}
          >
            {TEXT.addTarget}
          </Button>
        </Stack>

        <Divider />

        <Stack spacing={1}>
          <Typography variant="subtitle2">{TEXT.triggersTitle}</Typography>
          {triggers.length === 0 && (
            <Typography color="text.secondary">{TEXT.triggerEmpty}</Typography>
          )}
          {triggers.map((trigger, triggerIndex) => (
            <TriggerRow
              key={`trigger-${triggerIndex}`}
              trigger={trigger}
              onChange={(next) => {
                const nextTriggers = [...triggers];
                nextTriggers[triggerIndex] = next;
                updateTriggers(nextTriggers);
              }}
              onRemove={() => {
                updateTriggers(triggers.filter((_, i) => i !== triggerIndex));
              }}
              disabled={disabled}
            />
          ))}
          <Button
            variant="outlined"
            onClick={() => updateTriggers([...triggers, createTrigger("operate")])}
            disabled={disabled}
          >
            {TEXT.addTrigger}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default StepEditor;
