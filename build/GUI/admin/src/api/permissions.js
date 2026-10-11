import api from './axios';

export const getRoles = () => api.get('/permissions/roles');
export const getRoleDetail = (roleId) => api.get(`/permissions/roles/${roleId}`);
export const createRole = (payload) => api.post('/permissions/roles', payload);
export const updateRole = (roleId, payload) => api.patch(`/permissions/roles/${roleId}`, payload);
export const deleteRole = (roleId) => api.delete(`/permissions/roles/${roleId}`);
export const updateRolePermissions = (roleId, permissions) =>
  api.put(`/permissions/roles/${roleId}/permissions`, { permissions });
export const updateRoleInherit = (roleId, parent_role_ids) =>
  api.put(`/permissions/roles/${roleId}/inherit`, { parent_role_ids });
export const getPermissions = () => api.get('/permissions/permissions');
export const getEmployees = () => api.get('/permissions/employees');
export const updateEmployee = (lineId, data) => api.patch(`/permissions/employees/${lineId}`, data);
export const getMe = () => api.get('/permissions/me');
export const updateMe = (data) => api.patch('/permissions/me', data);
export const registerEmployee = (payload) => api.post('/permissions/register', payload);
