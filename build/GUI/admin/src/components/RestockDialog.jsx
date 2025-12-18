import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from '@mui/material';
import { addStock } from '../api/inventory';

// 補貨彈窗：可帶入預設數量，成功後透過回呼讓父層接續流程
const RestockDialog = ({
  open,
  onClose,
  bomId,
  bomName,
  onRestockSuccess,
  defaultQuantity,
  shelfLifeDays,
}) => {
  const [quantity, setQuantity] = useState('');
  const [expiry, setExpiry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatDateTimeLocal = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
        setQuantity('');
      }
      setError('');
      setExpiry(formatDateTimeLocal(calcDefaultExpiry()));
    }
  }, [open, defaultQuantity, shelfLifeDays]);

  const handleQuantityChange = (e) => {
    setQuantity(e.target.value);
    if (error) setError('');
  };

  const handleExpiryChange = (e) => {
    setExpiry(e.target.value);
    if (error) setError('');
  };

  const handleRestock = async () => {
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
      setError('請輸入有效的補貨數量');
      return;
    }
    if (!expiry) {
      setError('請輸入有效的過期時間');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const qtyNumber = Number(quantity);
      await addStock({
        bom_id: bomId,
        quantity: qtyNumber,
        stock_in_time: new Date().toISOString(),
        expiry_time: new Date(expiry).toISOString(),
      });
      if (typeof onRestockSuccess === 'function') {
        await onRestockSuccess(qtyNumber);
      }
    } catch (err) {
      console.error('補貨失敗:', err);
      setError('補貨失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity('');
    setError('');
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>補貨: <Typography component="span" variant="h6" color="primary">{bomName}</Typography></DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          請輸入要補貨的數量
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label="補貨數量"
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
          label="過期時間"
          type="datetime-local"
          fullWidth
          variant="outlined"
          value={expiry}
          onChange={handleExpiryChange}
          InputLabelProps={{ shrink: true }}
          disabled={loading}
          sx={{ mt: 2 }}
        />
        {error && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>取消</Button>
        <Button onClick={handleRestock} variant="contained" disabled={loading}>
          {loading ? '補貨中...' : '確認補貨'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RestockDialog;
