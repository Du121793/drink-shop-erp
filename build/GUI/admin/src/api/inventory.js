import api from './axios';

// BOM Management
export const getBoms = () => api.get('/inventory/boms');
export const createBom = (data) => api.post('/inventory/boms', data);
export const updateBoms = (data) => api.patch('/inventory/boms', data);
export const updateBom = (id, data) => api.patch(`/inventory/boms/${id}`, data);

// Inventory Stock
export const getAllStock = () => api.get('/inventory/');
export const addStock = (data) => api.post('/inventory/', data);
export const updateStock = (bomId, data) => api.patch(`/inventory/${bomId}`, data);
export const getStockHistory = (bomId) => api.get(`/inventory/${bomId}`);

// Inventory Detail
export const updateInventoryDetail = (inventoryId, data) => api.patch(`/inventory/detail/${inventoryId}`, data);
export const deleteInventoryDetail = (inventoryId) => api.delete(`/inventory/detail/${inventoryId}`);
