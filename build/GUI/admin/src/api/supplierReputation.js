import api from "./axios";

// 取得供應商信譽摘要
export const getSupplierReputation = (supplierIds = []) => {
  const params = {};
  if (supplierIds.length) {
    params.supplier_ids = supplierIds.join(",");
  }
  return api.get("/suppliers/reputation", { params });
};

// 取得供應商信譽明細
export const getSupplierReputationDetail = (supplierId, limit = 50) =>
  api.get(`/suppliers/${supplierId}/reputation`, { params: { limit } });

// 取得事件類型清單
export const getSupplierEventTypes = (includeInactive = false) =>
  api.get("/suppliers/event-types", {
    params: { include_inactive: includeInactive },
  });

// 新增事件類型
export const createSupplierEventType = (data) =>
  api.post("/suppliers/event-types", data);

// 更新事件類型
export const updateSupplierEventType = (id, data) =>
  api.patch(`/suppliers/event-types/${id}`, data);

// 建立供應商事件
export const createSupplierEvent = (supplierId, data) =>
  api.post(`/suppliers/${supplierId}/events`, data);

// 取得信譽規則
export const getReputationRule = () => api.get("/suppliers/reputation-rule");

// 更新信譽規則
export const updateReputationRule = (data) =>
  api.patch("/suppliers/reputation-rule", data);

// 取得封鎖名單
export const getSupplierBlocks = () => api.get("/suppliers/blocks");

// 解除封鎖
export const unblockSupplierBlock = (blockId) =>
  api.patch(`/suppliers/blocks/${blockId}/unblock`);
