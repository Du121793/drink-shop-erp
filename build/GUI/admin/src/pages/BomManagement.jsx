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
import DeleteIcon from '@mui/icons-material/Delete'; // 刪除 BOM 可能需要
import AddIcon from '@mui/icons-material/Add';
import { getBoms, createBom, updateBom } from '../api/inventory'; // 導入 BOM 相關 API
import BomEditDialog from '../components/BomEditDialog'; // 導入 BomEditDialog

function BomManagement() {
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isBomEditOpen, setBomEditOpen] = useState(false);
  const [editingBom, setEditingBom] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const bomsRes = await getBoms();
      setBoms(bomsRes.data.boms);
    } catch (error) {
      console.error('Failed to fetch BOMs:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBomEditClick = (bom = null) => {
    setEditingBom(bom);
    setBomEditOpen(true);
  };

  const handleBomEditClose = () => {
    setEditingBom(null);
    setBomEditOpen(false);
  };

  const handleSaveBom = async (payload) => {
    try {
      if (editingBom) {
        await updateBom(editingBom.bom_id, payload);
      } else {
        await createBom(payload);
      }
      fetchData(); // 刷新列表
    } catch (error) {
      console.error('儲存 BOM 失敗:', error);
    } finally {
      handleBomEditClose();
    }
  };

  // 暫時不提供刪除 BOM 的功能，因為可能有關聯
  // const handleDeleteBom = async (bomId) => {
  //   if (window.confirm('確定要刪除這個 BOM 嗎？此操作將永久刪除，無法復原。')) {
  //       try {
  //           await deleteBom(bomId); // 需要實現 deleteBom API
  //           fetchData();
  //       } catch (error) {
  //           console.error('Failed to delete BOM:', error);
  //       }
  //   }
  // };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>原料管理 (BOM)</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleBomEditClick()}>新增原料</Button>
      </Box>
      {loading ? <p>讀取中...</p> : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>原料名稱</TableCell>
                <TableCell align="right">保存時間 (天)</TableCell>
                <TableCell align="right">最大庫存量</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {boms.map((bom) => (
                <TableRow key={bom.bom_id} hover>
                  <TableCell>{bom.material_name}</TableCell>
                  <TableCell align="right">{bom.shelf_life_days || '無'}</TableCell>
                  <TableCell align="right">{bom.max_stock_qty || '無限制'}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleBomEditClick(bom)}><EditIcon /></IconButton>
                    {/* 暫時不提供刪除 BOM 的功能，因為可能有關聯 */}
                    {/* <IconButton onClick={() => handleDeleteBom(bom.bom_id)}><DeleteIcon /></IconButton> */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {isBomEditOpen && (
        <BomEditDialog
          open={isBomEditOpen}
          onClose={handleBomEditClose}
          onSave={handleSaveBom}
          bom={editingBom}
        />
      )}
    </>
  );
}

export default BomManagement;