import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { hasAnyPermission } from "../utils/permission";

function PermissionRedirector({ permissions = [], loading }) {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (loading) return;
    if (location.pathname !== "/no-permission") return;

    if (hasAnyPermission(permissions, ["dashboard:view"])) {
      navigate("/", { replace: true });
    } else if (hasAnyPermission(permissions, ["restock:view"])) {
      navigate("/inventory/suggestions", { replace: true });
    } else if (hasAnyPermission(permissions, ["permissions:profile"])) {
      navigate("/permissions/profile", { replace: true });
    }
  }, [permissions, loading, location.pathname, navigate]);

  return null;
}

export default PermissionRedirector;
