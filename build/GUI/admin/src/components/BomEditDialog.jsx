import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from '@mui/material';

const BomEditDialog = ({ open, onClose, onSave, bom }) => {
  const [materialName, setMaterialName] = useState('');
  const [shelfLifeDays, setShelfLifeDays] = useState('');
  const [maxStockQty, setMaxStockQty] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (bom) {
      setMaterialName(bom.material_name || '');
      setShelfLifeDays(bom.shelf_life_days || '');
      setMaxStockQty(bom.max_stock_qty || '');
    } else {
      setMaterialName('');
      setShelfLifeDays('');
      setMaxStockQty('');
    }
    setError(''); // 每次打開或切換 bom 時都清除錯誤
  }, [bom, open]);

  const handleSave = () => {
    if (!materialName.trim()) {
      setError('原料名稱為必填項');
      return;
    }
    if (shelfLifeDays !== '' && (isNaN(shelfLifeDays) || Number(shelfLifeDays) < 0)) {
        setError('保存時間必須是有效的非負數字');
        return;
    }
    if (maxStockQty !== '' && (isNaN(maxStockQty) || Number(maxStockQty) < 0)) {
        setError('最大庫存量必須是有效的非負數字');
        return;
    }

    const payload = {
      material_name: materialName,
      shelf_life_days: shelfLifeDays === '' ? null : Number(shelfLifeDays),
      max_stock_qty: maxStockQty === '' ? null : Number(maxStockQty),
    };
    onSave(payload);
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>{bom ? '編輯原料' : '新增原料'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="原料名稱"
          type="text"
          fullWidth
          variant="outlined"
          value={materialName}
          onChange={(e) => { setMaterialName(e.target.value); setError(''); }}
          error={!!error}
          helperText={error}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="dense"
          label="保存時間 (天)"
          type="number"
          fullWidth
          variant="outlined"
          value={shelfLifeDays}
          onChange={(e) => { setShelfLifeDays(e.target.value); setError(''); }}
          inputProps={{ min: 0 }}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="dense"
          label="最大庫存量"
          type="number"
          fullWidth
          variant="outlined"
          value={maxStockQty}
          onChange={(e) => { setMaxStockQty(e.target.value); setError(''); }}
          inputProps={{ min: 0 }}
          sx={{ mb: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button onClick={handleSave} variant="contained">儲存</Button>
      </DialogActions>
    </Dialog>
  );
};

export default BomEditDialog;
