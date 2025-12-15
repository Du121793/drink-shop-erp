import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import { getPurchaseOrderGroups } from '../api/purchaseOrders';
import { getSuppliers } from '../api/suppliers';
import { getBoms } from '../api/inventory';

function PurchaseOrderLog() {
  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [boms, setBoms] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      console.error('取得叫貨紀錄失敗:', err);
      setError('取得叫貨紀錄失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">叫貨紀錄</Typography>
        <Stack direction="row" spacing={1}>
          <Chip label={loading ? '載入中' : '已同步'} color={loading ? 'default' : 'success'} />
        </Stack>
      </Box>
      {error && <Typography color="error">{error}</Typography>}
      {!groups.length && !loading && (
        <Typography>尚無紀錄。</Typography>
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
              return (
                <Box key={item.order_id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.02)' }}>
                  <Box>
                    <Typography variant="subtitle1">{bom?.material_name || `BOM #${item.bom_id}`}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      廠商：{supplier?.supplier_name || `#${item.supplier_id}`} / 數量：{item.order_qty}
                    </Typography>
                  </Box>
                  <Chip label={`狀態 ${item.order_status}`} size="small" />
                </Box>
              );
            })}
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}

export default PurchaseOrderLog;
