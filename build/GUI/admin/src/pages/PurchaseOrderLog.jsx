import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Divider,
  Button,
} from "@mui/material";
import {
  getPurchaseOrderGroups,
  updatePurchaseOrderStatus,
} from "../api/purchaseOrders";
import { getSuppliers } from "../api/suppliers";
import { getBoms } from "../api/inventory";
import { getSupplierEventTypes } from "../api/supplierReputation";
import RestockDialog from "../components/RestockDialog";
import PurchaseOrderFailureDialog from "../components/PurchaseOrderFailureDialog";

const statusLabel = {
  0: "已聯絡",
  1: "已抵達",
  3: "失敗",
};

const statusColor = {
  0: "info",
  1: "success",
  3: "error",
};

// 叫貨紀錄頁面：顯示批次並更新狀態
function PurchaseOrderLog() {
  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [boms, setBoms] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [restockTarget, setRestockTarget] = useState({
    open: false,
    orderId: null,
    bomId: null,
    bomName: "",
    defaultQty: "",
    shelfLifeDays: null,
  });
  const [failureTarget, setFailureTarget] = useState({
    open: false,
    orderId: null,
    bomName: "",
    supplierName: "",
    quantity: "",
  });

  const supplierMap = useMemo(
    () => new Map(suppliers.map((s) => [s.supplier_id, s])),
    [suppliers]
  );
  const bomMap = useMemo(
    () => new Map(boms.map((b) => [b.bom_id, b])),
    [boms]
  );

  // 載入叫貨批次、供應商、原料與信譽事件類型
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [gRes, sRes, bRes, tRes] = await Promise.all([
        getPurchaseOrderGroups(),
        getSuppliers(),
        getBoms(),
        getSupplierEventTypes(false),
      ]);
      setGroups(gRes.data?.groups || []);
      setSuppliers(sRes.data?.suppliers || []);
      setBoms(bRes.data?.boms || []);
      setEventTypes(tRes.data?.types || []);
    } catch (err) {
      setError("取得叫貨紀錄失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 開啟補貨彈窗
  const openRestockDialog = (item, bomName, shelfLifeDays) => {
    setRestockTarget({
      open: true,
      orderId: item.order_id,
      bomId: item.bom_id,
      bomName: bomName || `BOM #${item.bom_id}`,
      defaultQty: item.order_qty,
      shelfLifeDays: shelfLifeDays ?? null,
    });
  };

  // 關閉補貨彈窗
  const closeRestockDialog = () => {
    setRestockTarget({
      open: false,
      orderId: null,
      bomId: null,
      bomName: "",
      defaultQty: "",
      shelfLifeDays: null,
    });
  };

  // 補貨成功後更新叫貨狀態
  const handleRestockSuccess = async (payload = {}) => {
    if (!restockTarget.orderId) {
      closeRestockDialog();
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      await updatePurchaseOrderStatus(restockTarget.orderId, 1, payload);
      await fetchData();
      closeRestockDialog();
    } catch (err) {
      setError("補貨後更新狀態失敗");
    } finally {
      setActionLoading(false);
    }
  };
  // 開啟標記失敗彈窗
  const openFailureDialog = (item, bomName, supplierName) => {
    setFailureTarget({
      open: true,
      orderId: item.order_id,
      bomName: bomName || `BOM #${item.bom_id}`,
      supplierName: supplierName || `#${item.supplier_id}`,
      quantity: item.order_qty,
    });
  };

  // 關閉標記失敗彈窗
  const closeFailureDialog = () => {
    setFailureTarget({
      open: false,
      orderId: null,
      bomName: "",
      supplierName: "",
      quantity: "",
    });
  };

  // 確認失敗後更新叫貨狀態
  const handleFailureConfirm = async (payload = {}) => {
    if (!failureTarget.orderId) {
      closeFailureDialog();
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      await updatePurchaseOrderStatus(failureTarget.orderId, 3, payload);
      await fetchData();
      closeFailureDialog();
    } catch (err) {
      setError("更新失敗狀態失敗");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h4">叫貨紀錄</Typography>
        <Stack direction="row" spacing={1}>
          <Chip
            label={loading ? "載入中" : "已暫停"}
            color={loading ? "default" : "success"}
          />
        </Stack>
      </Box>
      {error && <Typography color="error">{error}</Typography>}
      {!groups.length && !loading && (
        <Typography>目前無紀錄</Typography>
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
              const label = statusLabel[item.order_status] || "未知狀態";
              const color = statusColor[item.order_status] || "default";
              return (
                <Box
                  key={item.order_id}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    p: 1,
                    borderRadius: 1,
                    backgroundColor: "rgba(0,0,0,0.02)",
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1">
                      {bom?.material_name || `BOM #${item.bom_id}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      供應商：
                      {supplier?.supplier_name || `#${item.supplier_id}`} / 數量：
                      {item.order_qty}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={label} size="small" color={color} />
                    {isPending && (
                      <>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() =>
                            openRestockDialog(
                              item,
                              bom?.material_name,
                              bom?.shelf_life_days
                            )
                          }
                          disabled={actionLoading || loading}
                        >
                          補貨
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => openFailureDialog(item, bom?.material_name, supplier?.supplier_name)}
                          disabled={actionLoading || loading}
                        >
                          設為失敗
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
        shelfLifeDays={restockTarget.shelfLifeDays}
        eventTypes={eventTypes}
        onRestockSuccess={handleRestockSuccess}
      />

      <PurchaseOrderFailureDialog
        open={failureTarget.open}
        onClose={closeFailureDialog}
        orderInfo={{
          bomName: failureTarget.bomName,
          supplierName: failureTarget.supplierName,
          quantity: failureTarget.quantity,
        }}
        eventTypes={eventTypes}
        onConfirm={handleFailureConfirm}
        loading={actionLoading}
      />
    </Box>
  );
}

export default PurchaseOrderLog;
