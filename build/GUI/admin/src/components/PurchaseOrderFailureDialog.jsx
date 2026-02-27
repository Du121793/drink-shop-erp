import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  TextField,
} from "@mui/material";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";

// 叫貨失敗標記彈窗：可選擇信譽事件
const PurchaseOrderFailureDialog = ({
  open,
  onClose,
  orderInfo,
  eventTypes = [],
  onConfirm,
  loading = false,
}) => {
  const [eventTypeIds, setEventTypeIds] = useState([]);
  const [note, setNote] = useState("");

  // 預設選取「叫貨失敗」事件
  const defaultFailureId = useMemo(
    () =>
      eventTypes.find((t) => t.event_code === "order_failed")?.event_type_id ??
      null,
    [eventTypes]
  );

  useEffect(() => {
    if (open) {
      setNote("");
      setEventTypeIds(defaultFailureId ? [defaultFailureId] : []);
    }
  }, [open, defaultFailureId]);

  // 確認送出事件
  const handleConfirm = () => {
    if (typeof onConfirm !== "function") return;
    const cleanIds = eventTypeIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    onConfirm({ event_type_ids: cleanIds, event_note: note });
  };

  const supplierLabel = orderInfo?.supplierName || "-";
  const bomLabel = orderInfo?.bomName || "-";
  const qtyLabel = orderInfo?.quantity ?? "-";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>標記叫貨失敗</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <ReportProblemOutlinedIcon color="error" />
          <Typography variant="body2" color="text.secondary">
            請確認此筆叫貨未成功到貨，可選擇是否新增信譽事件。
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {bomLabel} · {supplierLabel} · 數量：{qtyLabel}
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          若有發生廠商信譽事件，請選擇以下事件（可多選）
        </Typography>
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel id="failure-event-types-label">信譽事件</InputLabel>
            <Select
              labelId="failure-event-types-label"
              multiple
              value={eventTypeIds}
              onChange={(e) => {
                const value = e.target.value;
                const next = (typeof value === "string" ? value.split(",") : value)
                  .map((id) => Number(id))
                  .filter((id) => Number.isFinite(id));
                setEventTypeIds(next);
              }}
              input={<OutlinedInput label="信譽事件" />}
              renderValue={(selected) => {
                const labels = selected
                  .map((id) => {
                    const match = eventTypes.find(
                      (t) => t.event_type_id === id
                    );
                    return match?.event_name || `#${id}`;
                  })
                  .filter(Boolean);
                return labels.length ? labels.join("、") : "未選擇";
              }}
              disabled={loading}
            >
              {!eventTypes.length && (
                <MenuItem disabled value="">
                  無可選事件
                </MenuItem>
              )}
              {eventTypes.map((t) => (
                <MenuItem key={t.event_type_id} value={t.event_type_id}>
                  <Checkbox
                    checked={eventTypeIds.indexOf(t.event_type_id) > -1}
                  />
                  <ListItemText primary={t.event_name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="補充說明"
            size="small"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={loading}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={loading}
        >
          {loading ? "處理中..." : "確認標記失敗"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PurchaseOrderFailureDialog;
