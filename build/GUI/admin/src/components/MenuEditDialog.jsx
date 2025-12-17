import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Box,
  Chip,
  Typography,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { getBoms } from '../api/inventory';


const MenuEditDialog = ({ open, onClose, onSave, item, customOptions }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [selectedOptionIds, setSelectedOptionIds] = useState([]);
  const [baseMaterials, setBaseMaterials] = useState([]);
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
    if (item) {
      setName(item.name || '');
      setPrice(item.price || '');
      setSelectedOptionIds(item.options ? item.options.map(opt => Number(opt.optionId)) : []);
      setBaseMaterials(item.baseMaterials || []);
    } else {
      setName('');
      setPrice('');
      setSelectedOptionIds([]);
      setBaseMaterials([{ bom_id: '', quantity: '' }]);
    }
  }, [item, open]);

  const handleSave = () => {
    const payload = {
      name,
      price: Number(price),
      optionIds: selectedOptionIds,
      baseMaterials: baseMaterials.map(m => ({ bom_id: m.bom_id, quantity: Number(m.quantity) })),
    };
    onSave(payload);
  };
  
  const handleOptionChange = (event) => {
    const { target: { value } } = event;
    const selectedValues = typeof value === 'string' ? value.split(',') : value;
    setSelectedOptionIds(selectedValues.map(v => Number(v)));
  };

  const handleMaterialChange = (index, field, value) => {
    const newMaterials = [...baseMaterials];
    newMaterials[index][field] = value;
    setBaseMaterials(newMaterials);
  };

  const addMaterial = () => {
    setBaseMaterials([...baseMaterials, { bom_id: '', quantity: '' }]);
  };

  const removeMaterial = (index) => {
    const newMaterials = baseMaterials.filter((_, i) => i !== index);
    setBaseMaterials(newMaterials);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{item ? '編輯菜單品項' : '新增菜單品項'}</DialogTitle>
      <DialogContent>
        {/* Basic Info */}
        <TextField autoFocus margin="dense" label="品項名稱" type="text" fullWidth variant="outlined" value={name} onChange={(e) => setName(e.target.value)} sx={{ mt: 1 }}/>
        <TextField margin="dense" label="價格" type="number" fullWidth variant="outlined" value={price} onChange={(e) => setPrice(e.target.value)} />
        
        {/* Base Materials */}
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>基礎原料</Typography>
        {baseMaterials.map((material, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <FormControl sx={{ flex: 3 }} size="small">
              <InputLabel>原料</InputLabel>
              <Select
                value={material.bom_id}
                label="原料"
                onChange={(e) => handleMaterialChange(index, 'bom_id', e.target.value)}
              >
                {boms.map((bom) => (
                  <MenuItem key={bom.bom_id} value={bom.bom_id}>{bom.material_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="使用量"
              type="number"
              value={material.quantity}
              onChange={(e) => handleMaterialChange(index, 'quantity', e.target.value)}
              variant="outlined"
              size="small"
              sx={{ flex: 1 }}
            />
            <IconButton onClick={() => removeMaterial(index)} color="error"><DeleteIcon /></IconButton>
          </Box>
        ))}
        <Button startIcon={<AddIcon />} onClick={addMaterial} size="small">增加基礎原料</Button>

        {/* Custom Options */}
        <FormControl fullWidth margin="dense" sx={{ mt: 3 }}>
          <InputLabel>客製化選項</InputLabel>
          <Select
            multiple
            value={selectedOptionIds}
            onChange={handleOptionChange}
            input={<OutlinedInput label="客製化選項" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => {
                  const optionName = customOptions.find(opt => opt.optionId === value)?.optionName || '';
                  return <Chip key={value} label={optionName} />;
                })}
              </Box>
            )}
          >
            {customOptions.map((option) => (
              <MenuItem key={option.optionId} value={option.optionId}>{option.optionName}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained">儲存</Button>
      </DialogActions>
    </Dialog>
  );
};

export default MenuEditDialog;
