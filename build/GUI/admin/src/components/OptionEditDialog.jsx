import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { getBoms } from '../api/inventory';

const OptionEditDialog = ({ open, onClose, onSave, option }) => {
  const [name, setName] = useState('');
  const [details, setDetails] = useState([]);
  const [boms, setBoms] = useState([]);

  useEffect(() => {
    const fetchBoms = async () => {
      try {
        const response = await getBoms();
        setBoms(response.data.boms);
      } catch (error) {
        console.error('Failed to fetch BOMs:', error);
      }
    };
    fetchBoms();
  }, []);

  useEffect(() => {
    if (option) {
      setName(option.optionName || '');
      setDetails(option.details || []);
    } else {
      // Reset for new option
      setName('');
      setDetails([{ option_detail_name: '', bom_id: '', material_qty: '', extra_price: '' }]);
    }
  }, [option, open]);

  const handleDetailChange = (index, field, value) => {
    const newDetails = [...details];
    newDetails[index][field] = value;
    setDetails(newDetails);
  };

  const addDetail = () => {
    setDetails([...details, { option_detail_name: '', bom_id: '', material_qty: '', extra_price: '' }]);
  };

  const removeDetail = (index) => {
    const newDetails = details.filter((_, i) => i !== index);
    setDetails(newDetails);
  };

  const handleSave = () => {
    const payload = {
      name,
      // API expects name, quantity, bom_id, extra_price
      details: details.map(d => ({
        name: d.option_detail_name,
        quantity: Number(d.material_qty),
        bom_id: d.bom_id,
        extra_price: Number(d.extra_price)
      })),
    };
    onSave(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{option ? '編輯客製化選項' : '新增客製化選項'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="選項名稱 (例如: 甜度)"
          type="text"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 3, mt: 1 }}
        />
        
        <Typography variant="h6" gutterBottom>選項內容</Typography>

        {details.map((detail, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, p: 1, border: '1px solid grey', borderRadius: '4px' }}>
            <TextField
              label="內容名稱 (例如: 全糖)"
              value={detail.option_detail_name}
              onChange={(e) => handleDetailChange(index, 'option_detail_name', e.target.value)}
              variant="outlined"
              size="small"
              sx={{ flex: 2 }}
            />
            <FormControl sx={{ flex: 2 }} size="small">
              <InputLabel>使用原料 (BOM)</InputLabel>
              <Select
                value={detail.bom_id}
                label="使用原料 (BOM)"
                onChange={(e) => handleDetailChange(index, 'bom_id', e.target.value)}
              >
                {boms.map((bom) => (
                  <MenuItem key={bom.bom_id} value={bom.bom_id}>
                    {bom.material_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="原料量"
              type="number"
              value={detail.material_qty}
              onChange={(e) => handleDetailChange(index, 'material_qty', e.target.value)}
              variant="outlined"
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label="加價"
              type="number"
              value={detail.extra_price}
              onChange={(e) => handleDetailChange(index, 'extra_price', e.target.value)}
              variant="outlined"
              size="small"
              sx={{ flex: 1 }}
            />
            <IconButton onClick={() => removeDetail(index)} color="error">
              <DeleteIcon />
            </IconButton>
          </Box>
        ))}

        <Button startIcon={<AddIcon />} onClick={addDetail}>
          增加內容
        </Button>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained">儲存</Button>
      </DialogActions>
    </Dialog>
  );
};

export default OptionEditDialog;
