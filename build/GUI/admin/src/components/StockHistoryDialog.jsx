import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  TextField,
  IconButton,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import { getStockHistory, updateInventoryDetail } from "../api/inventory";

const StockHistoryDialog = ({ open, onClose, bomId, bomName, onRecordUpdated }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [earliestExpiryDays, setEarliestExpiryDays] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editedRemainingQty, setEditedRemainingQty] = useState("");
  const [editedExpiry, setEditedExpiry] = useState("");
  const [editError, setEditError] = useState("");
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const formatDateTimeLocal = (date) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const getStatus = (expiryTime) => {
    if (!expiryTime) return { text: "未設定", color: "text.secondary", daysLeft: null, statusType: "no-expiry" };
    const expireDate = new Date(expiryTime);
    const now = new Date();
    const diffTime = expireDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (expireDate < now) return { text: "已過期", color: "error", daysLeft: diffDays, statusType: "expired" };
    const soon = new Date(now);
    soon.setDate(now.getDate() + 7);
    if (expireDate < soon) return { text: "即將到期", color: "warning", daysLeft: diffDays, statusType: "soon-expired" };
    return { text: "正常", color: "success", daysLeft: diffDays, statusType: "normal" };
  };

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getStockHistory(bomId);
      const currentHistory = response.data.history;
      setHistory(currentHistory);

      let minDaysLeft = null;
      currentHistory.forEach((record) => {
        const status = getStatus(record.expiry_time);
        if (status.statusType === "normal" || status.statusType === "soon-expired") {
          if (minDaysLeft === null || status.daysLeft < minDaysLeft) {
            minDaysLeft = status.daysLeft;
          }
        }
      });
      setEarliestExpiryDays(minDaysLeft);
    } catch (error) {
      console.error(`Failed to fetch stock history for BOM ID ${bomId}:`, error);
      setHistory([]);
    }
    setLoading(false);
  }, [bomId]);

  useEffect(() => {
    if (open && bomId) {
      fetchHistory();
    }
  }, [open, bomId, fetchHistory]);

  const handleEditClick = (record) => {
    setEditingId(record.inventory_id);
    setEditedRemainingQty(record.remaining_qty.toString());
    setEditedExpiry(record.expiry_time ? formatDateTimeLocal(new Date(record.expiry_time)) : "");
    setEditError("");
  };

  const handleSaveClick = async (recordId, stockInQty) => {
    const newQty = Number(editedRemainingQty);
    if (isNaN(newQty) || newQty < 0) {
      setEditError("請輸入正確的數值");
      return;
    }
    if (newQty > stockInQty) {
      setEditError(`剩餘量不可大於入庫量 (${stockInQty})`);
      return;
    }
    if (!editedExpiry) {
      setEditError("請輸入到期時間");
      return;
    }

    try {
      await updateInventoryDetail(recordId, {
        remaining_qty: newQty,
        expiry_time: new Date(editedExpiry).toISOString(),
      });
      setEditingId(null);
      setEditedRemainingQty("");
      setEditedExpiry("");
      setEditError("");
      fetchHistory();
      if (onRecordUpdated) onRecordUpdated();
    } catch (error) {
      console.error("更新剩餘量失敗", error);
      setEditError("更新失敗，請稍後再試");
    }
  };

  const handleCancelClick = () => {
    setEditingId(null);
    setEditedRemainingQty("");
    setEditedExpiry("");
    setEditError("");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">
            庫存紀錄：<Typography component="span" variant="h6" color="primary">{bomName}</Typography>
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {earliestExpiryDays !== null && earliestExpiryDays >= 0
              ? `最近到期：${earliestExpiryDays} 天`
              : "目前沒有未過期庫存"}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <p>載入中...</p>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>入庫時間</TableCell>
                  <TableCell align="right">入庫量</TableCell>
                  <TableCell align="right">剩餘量</TableCell>
                  <TableCell align="center">到期時間</TableCell>
                  <TableCell align="center">狀態</TableCell>
                  <TableCell align="right">剩餘天數</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.length > 0 ? (
                  history.map((record) => {
                    const status = getStatus(record.expiry_time);
                    const isEditing = editingId === record.inventory_id;
                    return (
                      <TableRow
                        key={record.inventory_id}
                        sx={{
                          backgroundColor:
                            status.statusType === "expired"
                              ? "rgba(255, 0, 0, 0.1)"
                              : status.statusType === "soon-expired"
                              ? "rgba(255, 165, 0, 0.1)"
                              : "inherit",
                        }}
                      >
                        <TableCell>{new Date(record.stock_in_time).toLocaleString()}</TableCell>
                        <TableCell align="right">{record.stock_in_qty}</TableCell>
                        <TableCell align="right">
                          {isEditing ? (
                            <TextField
                              value={editedRemainingQty}
                              onChange={(e) => setEditedRemainingQty(e.target.value)}
                              type="number"
                              size="small"
                              variant="outlined"
                              sx={{ width: 80 }}
                              error={!!editError}
                            />
                          ) : (
                            record.remaining_qty
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {isEditing ? (
                            <TextField
                              value={editedExpiry}
                              onChange={(e) => setEditedExpiry(e.target.value)}
                              type="datetime-local"
                              size="small"
                              variant="outlined"
                              sx={{ width: 200 }}
                              InputLabelProps={{ shrink: true }}
                            />
                          ) : (
                            record.expiry_time ? new Date(record.expiry_time).toLocaleString() : "N/A"
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Typography color={status.color} variant="body2">{status.text}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          {status.daysLeft !== null ? `${Math.max(0, status.daysLeft)} 天` : "N/A"}
                        </TableCell>
                        <TableCell align="center">
                          {isEditing ? (
                            <>
                              <IconButton onClick={() => handleSaveClick(record.inventory_id, record.stock_in_qty)} size="small" color="primary"><SaveIcon /></IconButton>
                              <IconButton onClick={handleCancelClick} size="small" color="error"><CancelIcon /></IconButton>
                            </>
                          ) : (
                            <IconButton onClick={() => handleEditClick(record)} size="small"><EditIcon /></IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      尚無入庫紀錄
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {editError && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {editError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>關閉</Button>
      </DialogActions>
    </Dialog>
  );
};

export default StockHistoryDialog;
