import api from './axios';

export const getRoles = () => api.get('/permissions/roles');
export const getEmployees = () => api.get('/permissions/employees');
export const updateEmployee = (lineId, data) => api.patch(`/permissions/employees/${lineId}`, data);
