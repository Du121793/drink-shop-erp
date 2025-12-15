import api from './axios';

export const getSuppliers = () => api.get('/suppliers');
export const createSupplier = (data) => api.post('/suppliers', data);
export const updateSupplier = (id, data) => api.patch(`/suppliers/${id}`, data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`);

export const getMaterialSuppliers = (bomId) => api.get('/suppliers/materials', { params: { bom_id: bomId } });
export const upsertMaterialSupplier = (data) => api.post('/suppliers/materials', data);
export const setDefaultMaterialSupplier = (data) => api.patch('/suppliers/materials/default', data);
export const deleteMaterialSupplier = (data) => api.delete('/suppliers/materials', { data });
