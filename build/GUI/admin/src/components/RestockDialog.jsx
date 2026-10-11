import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Checkbox,
  ListItemText,
  OutlinedInput,
} from "@mui/material";
import { addStock } from "../api/inventory";

// 補貨彈窗：可帶入預設欄位，並可選擇信譽事件
const RestockDialog = ({
  open,
  onClose,
  bomId,
  bomName,
  onRestockSuccess,
  defaultQuantity,
  shelfLifeDays,
  eventTypes = [],
}) => {
  const [quantity, setQuantity] = useState("");
  const [expiry, setExpiry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [eventTypeIds, setEventTypeIds] = useState([]);
  const [eventNote, setEventNote] = useState("");

  const formatDateTimeLocal = (date) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const calcDefaultExpiry = () => {
    const now = new Date();
    if (shelfLifeDays && !Number.isNaN(Number(shelfLifeDays))) {
      const d = new Date(now);
      d.setDate(d.getDate() + Number(shelfLifeDays));
      return d;
    }
    return now;
  };

  useEffect(() => {
    if (open) {
      if (defaultQuantity !== undefined && defaultQuantity !== null) {
        setQuantity(String(defaultQuantity));
      } else {
        setQuantity("");
      }
      setError("");
      setExpiry(formatDateTimeLocal(calcDefaultExpiry()));
      setEventTypeIds([]);
      setEventNote("");
    }
  }, [open, defaultQuantity, shelfLifeDays]);

  const handleQuantityChange = (e) => {
    setQuantity(e.target.value);
    if (error) setError("");
  };

  const handleExpiryChange = (e) => {
    setExpiry(e.target.value);
    if (error) setError("");
  };

  const handleRestock = async () => {
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
      setError("請輸入有效補貨量");
      return;
    }
    if (!expiry) {
      setError("請輸入有效到期日");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const qtyNumber = Number(quantity);
      await addStock({
        bom_id: bomId,
        quantity: qtyNumber,
        stock_in_time: new Date().toISOString(),
        expiry_time: new Date(expiry).toISOString(),
      });
      if (typeof onRestockSuccess === "function") {
        const cleanEventTypeIds = eventTypeIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id));
        await onRestockSuccess({
          event_type_ids: cleanEventTypeIds,
          event_note: eventNote,
        });
      }
    } catch (err) {
      setError("補貨失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity("");
    setError("");
    setLoading(false);
    onClose();
  };

  const selectLabelId = "restock-event-types-label";
  const selectId = "restock-event-types";

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>
        補貨：{" "}
        <Typography component="span" variant="h6" color="primary">
          {bomName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          請確認補貨數量
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label="補貨量"
          type="number"
          fullWidth
          variant="outlined"
          value={quantity}
          onChange={handleQuantityChange}
          error={!!error}
          disabled={loading}
        />
        <TextField
          margin="dense"
          label="此批原料到期日"
          type="datetime-local"
          fullWidth
          variant="outlined"
          value={expiry}
          onChange={handleExpiryChange}
          InputLabelProps={{ shrink: true }}
          disabled={loading}
          sx={{ mt: 2 }}
        />
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          若有發生廠商信譽事件，請選擇以下事件（可多選）
        </Typography>
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel id={selectLabelId}>信譽事件</InputLabel>
            <Select
              id={selectId}
              labelId={selectLabelId}
              multiple
              value={eventTypeIds}
              onChange={(e) => {
                const value = e.target.value;
                const next = (typeof value === "string" ? value.split(",") : value)
                  .map((id) => String(id))
                  .filter((id) => id);
                setEventTypeIds(next);
              }}
              input={<OutlinedInput label="信譽事件" />}
              renderValue={(selected) => {
                const labels = selected
                  .map((id) => {
                    const match = eventTypes.find(
                      (t) => String(t.event_type_id) === String(id)
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
                  尚無可用事件
                </MenuItem>
              )}
              {eventTypes.map((t) => {
                const id = String(t.event_type_id);
                return (
                  <MenuItem key={id} value={id}>
                    <Checkbox checked={eventTypeIds.includes(id)} />
                    <ListItemText primary={t.event_name} />
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <TextField
            label="補充說明"
            size="small"
            value={eventNote}
            onChange={(e) => setEventNote(e.target.value)}
            disabled={loading}
          />
        </Stack>
        {error && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          取消
        </Button>
        <Button onClick={handleRestock} variant="contained" disabled={loading}>
          {loading ? "補貨中..." : "確認補貨"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RestockDialog;
