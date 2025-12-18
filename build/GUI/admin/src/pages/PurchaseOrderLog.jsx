import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Divider,
  Button,
} from '@mui/material';
import { getPurchaseOrderGroups, updatePurchaseOrderStatus } from '../api/purchaseOrders';
import { getSuppliers } from '../api/suppliers';
import { getBoms } from '../api/inventory';
import RestockDialog from '../components/RestockDialog';

const statusLabel = {
  0: '已聯絡',
  1: '已抵達',
  3: '失敗',
};

const statusColor = {
  0: 'info',
  1: 'success',
  3: 'error',
};

function PurchaseOrderLog() {
  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [boms, setBoms] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [restockTarget, setRestockTarget] = useState({
    open: false,
    orderId: null,
    bomId: null,
    bomName: '',
    defaultQty: '',
  });

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.supplier_id, s])),
    [suppliers]
  );
  const bomMap = useMemo(
    () => new Map(boms.map((b) => [b.bom_id, b])),
    [boms]
  );

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [gRes, sRes, bRes] = await Promise.all([
        getPurchaseOrderGroups(),
        getSuppliers(),
        getBoms(),
      ]);
      setGroups(gRes.data?.groups || []);
      setSuppliers(sRes.data?.suppliers || []);
      setBoms(bRes.data?.boms || []);
    } catch (err) {
      console.error('載入採購紀錄失敗:', err);
      setError('載入採購紀錄失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openRestockDialog = (item, bomName) => {
    setRestockTarget({
      open: true,
      orderId: item.order_id,
      bomId: item.bom_id,
      bomName: bomName || `BOM #${item.bom_id}`,
      defaultQty: item.order_qty,
    });
  };

  const closeRestockDialog = () => {
    setRestockTarget({
      open: false,
      orderId: null,
      bomId: null,
      bomName: '',
      defaultQty: '',
    });
  };

  const handleRestockSuccess = async () => {
    if (!restockTarget.orderId) {
      closeRestockDialog();
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await updatePurchaseOrderStatus(restockTarget.orderId, 1);
      await fetchData();
      closeRestockDialog();
    } catch (err) {
      console.error('補貨後更新狀態失敗:', err);
      setError('補貨已完成但更新狀態失敗，請稍後再試或手動重試');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    const confirmCancel = window.confirm('確認將此案件標記為失敗嗎？');
    if (!confirmCancel) return;

    setActionLoading(true);
    setError('');
    try {
      await updatePurchaseOrderStatus(orderId, 3);
      await fetchData();
    } catch (err) {
      console.error('取消案件失敗:', err);
      setError('取消案件失敗，請稍後再試');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">採購紀錄</Typography>
        <Stack direction="row" spacing={1}>
          <Chip label={loading ? '載入中' : '已同步'} color={loading ? 'default' : 'success'} />
        </Stack>
      </Box>
      {error && <Typography color="error">{error}</Typography>}
      {!groups.length && !loading && (
        <Typography>尚無紀錄</Typography>
      )}
      {groups.map((g) => (
        <Paper key={g.batch_time} sx={{ p: 2, mb: 1 }}>
          <Typography variant="h6">
            批次時間：{new Date(g.batch_time).toLocaleString()}
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={1.5}>
            {g.items.map((item) => {
              const supplier = supplierMap.get(item.supplier_id);
              const bom = bomMap.get(item.bom_id);
              const isPending = Number(item.order_status) === 0;
              const label = statusLabel[item.order_status] || '未知狀態';
              const color = statusColor[item.order_status] || 'default';
              return (
                <Box key={item.order_id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                  <Box>
                    <Typography variant="subtitle1">{bom?.material_name || `BOM #${item.bom_id}`}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      供應商：{supplier?.supplier_name || `#${item.supplier_id}`} / 數量：{item.order_qty}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={label} size="small" color={color} />
                    {isPending && (
                      <>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => openRestockDialog(item, bom?.material_name)}
                          disabled={actionLoading || loading}
                        >
                          補貨
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleCancelOrder(item.order_id)}
                          disabled={actionLoading || loading}
                        >
                          取消案件
                        </Button>
                      </>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Paper>
      ))}

      <RestockDialog
        open={restockTarget.open}
        onClose={closeRestockDialog}
        bomId={restockTarget.bomId}
        bomName={restockTarget.bomName}
        defaultQuantity={restockTarget.defaultQty}
        onRestockSuccess={handleRestockSuccess}
      />
    </Box>
  );
}

export default PurchaseOrderLog;
