import api from './axios';

// 取得自動補貨建議清單
export const getAutoRestockList = () => api.get('/autoRestock');

// 套用前端手動調整後的補貨建議（僅回傳合併結果）
export const applyAutoRestockOverrides = (overrides = []) => api.patch('/autoRestock', { overrides });
