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
  Switch,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { 
  getMenus, 
  createMenu, 
  updateMenu,
  deleteMenu,
  getMenuOptions,
  getMenuMaterials,
} from '../api/menu';
import MenuEditDialog from '../components/MenuEditDialog';

function MenuItemManagement() {
  const [menus, setMenus] = useState([]);
  
  const [isMenuEditDialogOpen, setMenuEditDialogOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const menusRes = await getMenus();
      setMenus(menusRes.data.menus);
    } catch (error) {
      console.error('Failed to fetch menus:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMenuDialogClickOpen = async (item = null) => {
    if (item) {
      try {
        const [optionsRes, materialsRes] = await Promise.all([
          getMenuOptions(item.id),
          getMenuMaterials(item.id)
        ]);
        setEditingMenuItem({ 
          ...item, 
          options: optionsRes.data.options,
          baseMaterials: materialsRes.data.materials,
        });
      } catch (error) {
        console.error("Failed to fetch menu details", error);
        setEditingMenuItem(item);
      }
    } else {
      setEditingMenuItem(null);
    }
    setMenuEditDialogOpen(true);
  };

  const handleMenuDialogClose = () => {
    setEditingMenuItem(null);
    setMenuEditDialogOpen(false);
  };

  const handleSaveMenu = async (payload) => {
    try {
      if (editingMenuItem) {
        await updateMenu(editingMenuItem.id, payload);
      } else {
        await createMenu(payload);
      }
      fetchData();
    } catch (error) {
      console.error('Failed to save menu item:', error);
    } finally {
      handleMenuDialogClose();
    }
  };

  const handleDeleteMenu = async (itemId) => {
    if (window.confirm('確定要永久刪除這個品項嗎？此操作無法復原。')) {
        try {
            await deleteMenu(itemId);
            fetchData();
        } catch (error) {
            console.error('Failed to delete menu item:', error);
        }
    }
  };

  const handleToggleActive = async (id, newIsActive) => {
    try {
      await updateMenu(id, { is_active: newIsActive });
      fetchData();
    } catch (error) {
      console.error('Failed to toggle active state:', error);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>品項管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleMenuDialogClickOpen()}>新增品項</Button>
      </Box>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>品項名稱</TableCell>
              <TableCell align="center">上架狀態</TableCell>
              <TableCell align="center">庫存狀態</TableCell>
              <TableCell align="right">價格</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {menus.map((menu) => (
              <TableRow key={menu.id} hover>
                <TableCell>{menu.name}</TableCell>
                <TableCell align="center">
                  <Switch
                    checked={menu.is_active}
                    onChange={(e) => handleToggleActive(menu.id, e.target.checked)}
                    color="primary"
                  />
                </TableCell>
                <TableCell align="center">
                  <Chip 
                    label={menu.isAvailable ? '充足' : '不足'} 
                    color={menu.isAvailable ? 'success' : 'error'} 
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">{menu.price}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleMenuDialogClickOpen(menu)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDeleteMenu(menu.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {isMenuEditDialogOpen && (
        <MenuEditDialog
          open={isMenuEditDialogOpen}
          onClose={handleMenuDialogClose}
          onSave={handleSaveMenu}
          item={editingMenuItem}
          // customOptions 將從外部獲取並傳入，因為 MenuItemManagement 不直接管理 customOptions
          // 這意味著這個組件需要一個 prop 來接收 customOptions
          customOptions={[]} // 暫時給空陣列，待父組件傳入
        />
      )}
    </>
  );
}

export default MenuItemManagement;