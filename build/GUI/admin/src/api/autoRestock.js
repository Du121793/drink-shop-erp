import api from './axios';

// 取得自動補貨建議清單
export const getAutoRestockList = () => api.get('/autoRestock');

// 套用前端手動調整後的補貨建議（僅回傳合併結果）
export const applyAutoRestockOverrides = (overrides = []) => api.patch('/autoRestock', { overrides });

export const getRestockRules = () => api.get('/autoRestock/rules');
export const createRestockRule = (payload) => api.post('/autoRestock/rules', payload);
export const updateRestockRule = (ruleId, payload) =>
  api.patch(`/autoRestock/rules/${ruleId}`, payload);
export const deleteRestockRule = (ruleId, force = false) =>
  api.delete(`/autoRestock/rules/${ruleId}${force ? '?force=true' : ''}`);
export const getRestockRuleUsage = (ruleId) =>
  api.get(`/autoRestock/rules/${ruleId}/usage`);

export const getMaterialRestockRules = (bomId) =>
  api.get(`/autoRestock/materials/${bomId}/rules`);
export const upsertMaterialRestockRule = (bomId, ruleId, payload) =>
  api.put(`/autoRestock/materials/${bomId}/rules/${ruleId}`, payload);
export const deleteMaterialRestockRule = (bomId, ruleId) =>
  api.delete(`/autoRestock/materials/${bomId}/rules/${ruleId}`);
