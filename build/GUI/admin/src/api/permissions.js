import api from './axios';

export const getRoles = () => api.get('/permissions/roles');
export const getEmployees = () => api.get('/permissions/employees');
export const updateEmployee = (lineId, data) => api.patch(`/permissions/employees/${lineId}`, data);
export const getMe = () => api.get('/permissions/me');
export const updateMe = (data) => api.patch('/permissions/me', data);
export const registerEmployee = (payload) => api.post('/permissions/register', payload);
