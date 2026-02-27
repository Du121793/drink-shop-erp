import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Stack,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  getRestockRules,
  createRestockRule,
  updateRestockRule,
  deleteRestockRule,
  getRestockRuleUsage,
} from "../../api/autoRestock";
import RuleEditorDialog from "./RuleEditorDialog";
import RuleList from "./RuleList";
import DeleteDialog from "./DeleteDialog";
import AssignmentsPanel from "./AssignmentsPanel";
import { TEXT } from "./schema";
import { normalizeTags, normalizeRuleParams } from "./utils";

function RestockRulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUsage, setDeleteUsage] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const tagOptions = useMemo(() => {
    const tags = new Set();
    rules.forEach((rule) => {
      normalizeTags(rule.tags).forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  }, [rules]);

  const loadRules = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getRestockRules();
      const list = (res.data?.rules || []).map((rule) => ({
        ...rule,
        tags: normalizeTags(rule.tags),
        params: normalizeRuleParams(rule.params),
      }));
      setRules(list);
    } catch (err) {
      setError(TEXT.errLoadRules || "讀取規則失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleSaveRule = async (payload) => {
    setError("");
    try {
      if (editingRule) {
        await updateRestockRule(editingRule.rule_id, payload);
      } else {
        await createRestockRule(payload);
      }
      setEditOpen(false);
      setEditingRule(null);
      await loadRules();
    } catch (err) {
      setError(TEXT.errSaveRule || "儲存規則失敗");
    }
  };

  const handleDeleteClick = async (rule) => {
    setDeleteTarget(rule);
    setDeleteOpen(true);
    setDeleteUsage([]);
    try {
      const res = await getRestockRuleUsage(rule.rule_id);
      setDeleteUsage(res.data?.usage || []);
    } catch (err) {
      setDeleteUsage([]);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteRestockRule(deleteTarget.rule_id, true);
      setDeleteOpen(false);
      setDeleteTarget(null);
      await loadRules();
    } catch (err) {
      setError(TEXT.errDeleteRule || "刪除規則失敗");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">{TEXT.title}</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            component={RouterLink}
            to="/inventory/restock-rules-guide"
          >
            {TEXT.guide}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setEditingRule(null);
              setEditOpen(true);
            }}
          >
            {TEXT.addRule}
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <CircularProgress />
      ) : (
        <RuleList
          rules={rules}
          onEdit={(rule) => {
            setEditingRule(rule);
            setEditOpen(true);
          }}
          onDelete={handleDeleteClick}
        />
      )}

      <Box sx={{ mt: 4 }}>
        <AssignmentsPanel rules={rules} />
      </Box>

      <RuleEditorDialog
        open={editOpen}
        rule={editingRule}
        tagOptions={tagOptions}
        onClose={() => {
          setEditOpen(false);
          setEditingRule(null);
        }}
        onSave={handleSaveRule}
      />

      <DeleteDialog
        open={deleteOpen}
        usage={deleteUsage}
        loading={deleteLoading}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
}

export default RestockRulesPage;
