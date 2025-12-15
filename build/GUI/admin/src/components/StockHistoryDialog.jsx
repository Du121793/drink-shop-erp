import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { getStockHistory, updateInventoryDetail } from '../api/inventory';

const StockHistoryDialog = ({ open, onClose, bomId, bomName, shelfLifeDays, onRecordUpdated }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [earliestExpiryDays, setEarliestExpiryDays] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editedRemainingQty, setEditedRemainingQty] = useState('');
  const [editError, setEditError] = useState('');

  const getStatus = (stockInTime, shelfLifeDays) => {
    if (!shelfLifeDays) return { text: '無保存期限', color: 'text.secondary', daysLeft: null, statusType: 'no-expiry' };

    const stockDate = new Date(stockInTime);
    const expireDate = new Date(stockDate);
    expireDate.setDate(stockDate.getDate() + shelfLifeDays);
    const now = new Date();

    const diffTime = expireDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (expireDate < now) {
      return { text: '已過期', color: 'error', daysLeft: diffDays, statusType: 'expired' };
    }

    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);

    if (expireDate < sevenDaysFromNow) {
      return { text: '將過期', color: 'warning', daysLeft: diffDays, statusType: 'soon-expired' };
    }

    return { text: '正常', color: 'success', daysLeft: diffDays, statusType: 'normal' };
  };

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getStockHistory(bomId);
      const currentHistory = response.data.history;
      setHistory(currentHistory);

      let minDaysLeft = null;
      currentHistory.forEach(record => {
        const status = getStatus(record.stock_in_time, shelfLifeDays);
        if (status.statusType === 'normal' || status.statusType === 'soon-expired') {
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
  }, [bomId, shelfLifeDays]);

  useEffect(() => {
    if (open && bomId) {
      fetchHistory();
    }
  }, [open, bomId, fetchHistory]);

  const handleEditClick = (record) => {
    setEditingId(record.inventory_id);
    setEditedRemainingQty(record.remaining_qty.toString());
    setEditError('');
  };

  const handleSaveClick = async (recordId, stockInQty) => {
    const newQty = Number(editedRemainingQty);
    if (isNaN(newQty) || newQty < 0) {
      setEditError('請輸入有效的數字');
      return;
    }
    if (newQty > stockInQty) {
      setEditError(`剩餘數量不能大於入庫數量 (${stockInQty})`);
      return;
    }

    try {
      await updateInventoryDetail(recordId, { remaining_qty: newQty });
      setEditingId(null);
      setEditedRemainingQty('');
      setEditError('');
      fetchHistory();
      if (onRecordUpdated) onRecordUpdated();
    } catch (error) {
      console.error('更新剩餘數量失敗:', error);
      setEditError('更新失敗，請重試。');
    }
  };

  const handleCancelClick = () => {
    setEditingId(null);
    setEditedRemainingQty('');
    setEditError('');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">入庫紀錄: <Typography component="span" variant="h6" color="primary">{bomName}</Typography></Typography>
          {shelfLifeDays ? (
            <Typography variant="body1" color="text.secondary">
              {earliestExpiryDays !== null && earliestExpiryDays >= 0
                ? `最早剩餘 ${earliestExpiryDays} 天過期`
                : '所有批次已過期或無效'}
            </Typography>
          ) : (
            <Typography variant="body1" color="text.secondary">無保存期限</Typography>
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <p>讀取中...</p>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>入庫時間</TableCell>
                  <TableCell align="right">入庫數量</TableCell>
                  <TableCell align="right">剩餘數量</TableCell>
                  <TableCell align="center">狀態</TableCell>
                  <TableCell align="right">剩餘天數</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.length > 0 ? (
                  history.map((record) => {
                    const status = getStatus(record.stock_in_time, shelfLifeDays);
                    const isEditing = editingId === record.inventory_id;
                    return (
                      <TableRow 
                        key={record.inventory_id} 
                        sx={{ backgroundColor: status.statusType === 'expired' ? 'rgba(255, 0, 0, 0.1)' : (status.statusType === 'soon-expired' ? 'rgba(255, 165, 0, 0.1)' : 'inherit') }}
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
                              helperText={editError}
                            />
                          ) : (
                            record.remaining_qty
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Typography color={status.color} variant="body2">{status.text}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          {status.daysLeft !== null ? `${Math.max(0, status.daysLeft)} 天` : 'N/A'}
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
                    <TableCell colSpan={6} align="center">
                      沒有找到任何入庫紀錄
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>關閉</Button>
      </DialogActions>
    </Dialog>
  );
};

export default StockHistoryDialog;