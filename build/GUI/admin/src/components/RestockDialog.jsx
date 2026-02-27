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

// 補貨彈窗：可帶入預設數量，成功後透過回呼讓父層接續流程
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

  // 轉成 datetime-local 需要的格式
  const formatDateTimeLocal = (date) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // 依保存天數推算預設到期時間
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

  // 補貨量變更
  const handleQuantityChange = (e) => {
    setQuantity(e.target.value);
    if (error) setError("");
  };

  // 到期時間變更
  const handleExpiryChange = (e) => {
    setExpiry(e.target.value);
    if (error) setError("");
  };

  // 送出補貨並可選擇建立信譽事件
  const handleRestock = async () => {
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
      setError("請輸入有效補貨量");
      return;
    }
    if (!expiry) {
      setError("請輸入有效到期時間");
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

  // 關閉彈窗並重置狀態
  const handleClose = () => {
    setQuantity("");
    setError("");
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>
        補貨:{" "}
        <Typography component="span" variant="h6" color="primary">
          {bomName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          請確認補貨資訊
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
          label="此批原料過期日期"
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>若有發生廠商信譽事件，請選擇以下事件（可多選）</Typography>
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel id="restock-event-types-label">信譽事件</InputLabel>
            <Select
              labelId="restock-event-types-label"
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
                <MenuItem disabled value="">無可選事件</MenuItem>
              )}
              {eventTypes.map((t) => (
                <MenuItem key={t.event_type_id} value={t.event_type_id}>
                  <Checkbox checked={eventTypeIds.indexOf(t.event_type_id) > -1} />
                  <ListItemText primary={t.event_name} />
                </MenuItem>
              ))}
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
