import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  Button,
  Stack,
  Chip,
  Typography,
} from "@mui/material";
import { TEXT, SCOPE_LABELS } from "./schema";

function RuleList({ rules, onEdit, onDelete }) {
  if (!rules.length) {
    return <Typography color="text.secondary">{TEXT.noRules}</Typography>;
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{TEXT.ruleName}</TableCell>
            <TableCell>{TEXT.tags}</TableCell>
            <TableCell>{TEXT.priority}</TableCell>
            <TableCell>{TEXT.scope}</TableCell>
            <TableCell>{TEXT.enabled}</TableCell>
            <TableCell align="right">{TEXT.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.rule_id} hover>
              <TableCell>{rule.rule_name}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {(rule.tags || []).map((tag, idx) => (
                    <Chip key={`${tag}-${idx}`} label={tag} size="small" />
                  ))}
                </Stack>
              </TableCell>
              <TableCell>{rule.priority}</TableCell>
              <TableCell>{SCOPE_LABELS[rule.scope] || rule.scope}</TableCell>
              <TableCell>{rule.enabled ? "是" : "否"}</TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button size="small" onClick={() => onEdit(rule)}>
                    {TEXT.editRule}
                  </Button>
                  <Button size="small" color="error" onClick={() => onDelete(rule)}>
                    {TEXT.delete}
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default RuleList;
