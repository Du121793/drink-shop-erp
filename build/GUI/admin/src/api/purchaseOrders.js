import api from './axios';

export const createPurchaseOrders = (orders) => api.post('/purchase-orders', { orders });
export const getPurchaseOrderGroups = () => api.get('/purchase-orders');
export const updatePurchaseOrderStatus = (orderId, status) => api.patch(`/purchase-orders/${orderId}/status`, { status });
