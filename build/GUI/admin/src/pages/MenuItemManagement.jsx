import React, { useState, useEffect, useCallback } from "react";
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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import {
  getMenus,
  createMenu,
  updateMenu,
  deleteMenu,
  getMenuOptions,
  getMenuMaterials,
  getAllCustomOptions,
} from "../api/menu";
import MenuEditDialog from "../components/MenuEditDialog";

// 品項管理（桌機表格、手機可橫向捲動）
function MenuItemManagement() {
  const [menus, setMenus] = useState([]);
  const [customOptions, setCustomOptions] = useState([]);
  const [isMenuEditDialogOpen, setMenuEditDialogOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [menusRes, optionsRes] = await Promise.all([getMenus(true), getAllCustomOptions()]);
      setMenus(menusRes.data.menus);
      setCustomOptions(optionsRes.data.options || []);
    } catch (error) {
      console.error("Failed to fetch menus:", error);
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
          getMenuMaterials(item.id),
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
      console.error("Failed to save menu item:", error);
    } finally {
      handleMenuDialogClose();
    }
  };

  const handleDeleteMenu = async (itemId) => {
    if (window.confirm("確認要永久刪除這個品項？此動作無法復原。")) {
      try {
        await deleteMenu(itemId);
        fetchData();
      } catch (error) {
        console.error("Failed to delete menu item:", error);
      }
    }
  };

  const handleToggleActive = async (id, newIsActive) => {
    try {
      await updateMenu(id, { is_active: newIsActive });
      fetchData();
    } catch (error) {
      console.error("Failed to toggle active state:", error);
    }
  };

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          品項管理
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleMenuDialogClickOpen()}>
          新增品項
        </Button>
      </Box>
      <TableContainer component={Paper} sx={{ mb: 4, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>品項名稱</TableCell>
              <TableCell align="center">上架狀態</TableCell>
              <TableCell align="center">庫存充足</TableCell>
              <TableCell align="right">價格</TableCell>
              <TableCell align="right">動作</TableCell>
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
                    label={menu.isAvailable ? "充足" : "不足"}
                    color={menu.isAvailable ? "success" : "error"}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">{menu.price}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleMenuDialogClickOpen(menu)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteMenu(menu.id)}>
                    <DeleteIcon />
                  </IconButton>
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
          customOptions={customOptions}
        />
      )}
    </>
  );
}

export default MenuItemManagement;
