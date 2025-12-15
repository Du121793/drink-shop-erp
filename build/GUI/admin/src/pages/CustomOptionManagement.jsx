import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Box,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { 
  getAllCustomOptions, 
  createCustomOption, 
  updateCustomOption, 
  deleteCustomOption,
} from '../api/menu';
import OptionEditDialog from '../components/OptionEditDialog';

function CustomOptionManagement() {
  const [customOptions, setCustomOptions] = useState([]);
  
  const [isOptionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const optionsRes = await getAllCustomOptions();
      const formattedOptions = optionsRes.data.options.map(opt => ({
        ...opt,
        details: opt.details.map(d => ({
          ...d,
          option_detail_name: d.optionDetailName,
          material_qty: d.materialQty,
          bom_id: d.bomId,
          extra_price: d.extraPrice
        }))
      }));
      setCustomOptions(formattedOptions);
    } catch (error) {
      console.error('Failed to fetch custom options:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOptionDialogClickOpen = (option = null) => {
    setEditingOption(option);
    setOptionDialogOpen(true);
  };
  const handleOptionDialogClose = () => {
    setEditingOption(null);
    setOptionDialogOpen(false);
  };

  const handleSaveOption = async (payload) => {
    try {
      if (editingOption) {
        await updateCustomOption(editingOption.optionId, payload);
      } else {
        await createCustomOption(payload);
      }
      fetchData();
    } catch (error) {
      console.error('Failed to save option:', error);
    } finally {
      handleOptionDialogClose();
    }
  };
  
  const handleDeleteOption = async (optionId) => {
    if (window.confirm('確定要刪除這個選項嗎？此操作將永久刪除，無法復原。')) {
        try {
            await deleteCustomOption(optionId);
            fetchData();
        } catch (error) {
            console.error('Failed to delete option:', error);
        }
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>客製化選項管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOptionDialogClickOpen()}>新增選項</Button>
      </Box>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>選項名稱</TableCell>
              <TableCell>內容</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customOptions.map((option) => (
              <TableRow key={option.optionId} hover>
                <TableCell>{option.optionName}</TableCell>
                <TableCell>{option.details.map(d => `[${d.option_detail_name}]`).join(', ')}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOptionDialogClickOpen(option)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDeleteOption(option.optionId)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {isOptionDialogOpen && (
        <OptionEditDialog
            open={isOptionDialogOpen}
            onClose={handleOptionDialogClose}
            onSave={handleSaveOption}
            option={editingOption}
        />
      )}
    </>
  );
}

export default CustomOptionManagement;