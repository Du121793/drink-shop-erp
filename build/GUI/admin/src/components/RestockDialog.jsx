import React, { useState } from 'react';
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

const RestockDialog = ({ open, onClose, bomId, bomName, onRestockSuccess }) => {
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      await addStock({ bom_id: bomId, quantity: Number(quantity) });
      onRestockSuccess(); // 通知父元件刷新列表並關閉對話框
    } catch (err) {
      console.error('補貨失敗:', err);
      setError('補貨失敗，請重試。');
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
          請輸入要補貨的數量。
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
