// 權限判斷：命中 system:admin 或任一指定權限即視為通過
export const hasAnyPermission = (userPermissions = [], required = []) => {
  const list = Array.isArray(userPermissions) ? userPermissions : [];
  if (list.includes("system:admin")) return true;

  const requiredList = Array.isArray(required) ? required : [required];
  if (requiredList.length === 0) return true;

  return requiredList.some((code) => list.includes(code));
};
