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
const RestockDialog = ({ open, onClose, bomId, bomName, onRestockSuccess, defaultQuantity }) => {
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (defaultQuantity !== undefined && defaultQuantity !== null) {
        setQuantity(String(defaultQuantity));
      } else {
        setQuantity('');
      }
      setError('');
    }
  }, [open, defaultQuantity]);

  const handleQuantityChange = (e) => {
    setQuantity(e.target.value);
    if (error) setError('');
  };

  const handleRestock = async () => {
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
      setError('請輸入有效的補貨數量');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const qtyNumber = Number(quantity);
      await addStock({ bom_id: bomId, quantity: qtyNumber });
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
          helperText={error}
          disabled={loading}
        />
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
