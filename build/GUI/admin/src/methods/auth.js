// Mock user permissions
const userPermissions = {
  canViewDashboard: true,
  canManagePermissions: true,
  canManageMenu: true,
  canManageInventory: true,
};

export const hasPermission = (permission) => {
  return userPermissions[permission] || false;
};

export const getPermissions = () => {
    return userPermissions;
}
