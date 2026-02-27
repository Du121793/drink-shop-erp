import api from "./axios";

// 建立叫貨紀錄
export const createPurchaseOrders = (orders) =>
  api.post("/purchase-orders", { orders });

// 取得叫貨紀錄批次
export const getPurchaseOrderGroups = () => api.get("/purchase-orders");

// 更新叫貨狀態並附加事件資訊
export const updatePurchaseOrderStatus = (orderId, status, payload = {}) =>
  api.patch(`/purchase-orders/${orderId}/status`, { status, ...payload });
