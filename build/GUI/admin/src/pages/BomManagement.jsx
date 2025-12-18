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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { getBoms, createBom, updateBom } from "../api/inventory";
import BomEditDialog from "../components/BomEditDialog";

// BOM 管理
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
      console.error("Failed to fetch BOMs:", error);
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
      fetchData();
    } catch (error) {
      console.error("Failed to save BOM:", error);
    } finally {
      handleBomEditClose();
    }
  };

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          配方管理 (BOM)
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleBomEditClick()}>
          新增 BOM
        </Button>
      </Box>
      {loading ? (
        <p>讀取中...</p>
      ) : (
        <TableContainer component={Paper} sx={{ mb: 4, overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>原料名稱</TableCell>
                <TableCell align="center">保存天數</TableCell>
                <TableCell align="center">最大庫存</TableCell>
                <TableCell align="right">動作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {boms.map((bom) => (
                <TableRow key={bom.bom_id} hover>
                  <TableCell>{bom.material_name}</TableCell>
                  <TableCell align="center">{bom.shelf_life_days ?? "-"}</TableCell>
                  <TableCell align="center">{bom.max_stock_qty ?? "-"}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleBomEditClick(bom)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton disabled>
                      <DeleteIcon />
                    </IconButton>
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
