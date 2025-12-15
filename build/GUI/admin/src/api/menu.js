import api from './axios';

export const getMenus = () => api.get('/menu');
export const getMenuOptions = (id) => api.get(`/menu/${id}`);
export const getMenuMaterials = (id) => api.get(`/menu/${id}/materials`);
export const getAllCustomOptions = () => api.get('/menu/option');
export const createMenu = (data) => api.post('/menu', data);
export const updateMenu = (id, data) => api.put(`/menu/${id}`, data);
export const deleteMenu = (id) => api.delete(`/menu/${id}`);
export const createCustomOption = (data) => api.post('/menu/option', data);
export const updateCustomOption = (id, data) => api.put(`/menu/option/${id}`, data);
export const deleteCustomOption = (id) => api.delete(`/menu/option/${id}`);
