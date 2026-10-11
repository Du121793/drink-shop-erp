import React from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import {
  Box,
  CssBaseline,
  createTheme,
  ThemeProvider,
  Typography,
  Paper,
  Button,
} from "@mui/material";
import liff from "@line/liff";
import { useLiffInit } from "./hooks/useLiff";
import api, { isTokenExpired } from "./api/axios";
import { menuItems } from "./config/menuItems";
import { hasAnyPermission } from "./utils/permission";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionRedirector from "./components/PermissionRedirector";
import AdminShell from "./layout/AdminShell";

import Dashboard from "./pages/Dashboard";
import PermissionsLayout from "./pages/PermissionsLayout";
import PermissionsProfile from "./pages/PermissionsProfile";
import PermissionsManage from "./pages/PermissionsManage";
import MenuManagement from "./pages/MenuManagement";
import Restock from "./pages/Restock";
import RestockSuggestions from "./pages/RestockSuggestions";
import RestockRules from "./pages/RestockRules";
import RestockRuleGuide from "./pages/RestockRuleGuide";
import PurchaseOrderLog from "./pages/PurchaseOrderLog";
import SupplierManagement from "./pages/SupplierManagement";
import SupplierReputationSettings from "./pages/SupplierReputationSettings";
import MenuItemManagement from "./pages/MenuItemManagement";
import CustomOptionManagement from "./pages/CustomOptionManagement";
import BomManagement from "./pages/BomManagement";
import NoPermission from "./pages/NoPermission";

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#d35400" },
    background: { default: "#f5f5f5", paper: "#ffffff" },
    text: { primary: "#333", secondary: "#555" },
  },
  components: {
    MuiAppBar: {
      styleOverrides: { root: { backgroundColor: "#ffffff", color: "#333" } },
    },
    MuiDrawer: { styleOverrides: { paper: { backgroundColor: "#ffffff" } } },
  },
});

function App() {
  const { loading: liffLoading, error: liffError, profile, idToken } =
    useLiffInit();
  const [userName, setUserName] = React.useState("");
  const [backendToken, setBackendToken] = React.useState(null);
  const [permissions, setPermissions] = React.useState([]);
  const [permissionLoading, setPermissionLoading] = React.useState(true);
  const [tokenAttempted, setTokenAttempted] = React.useState(false);

  React.useEffect(() => {
    const exchangeToken = async () => {
      if (!idToken || isTokenExpired(idToken)) {
        setBackendToken(null);
        setTokenAttempted(true);
        localStorage.removeItem("api_token");
        delete api.defaults.headers.common.Authorization;
        if (idToken) {
          try {
            liff?.logout?.();
          } catch { /* LIFF 操作失敗時沿用目前的登入流程。 */ }
          try {
            liff?.login?.({ redirectUri: window.location.href });
            return;
          } catch { /* LIFF 操作失敗時沿用目前的登入流程。 */ }
        }
        return;
      }
      setTokenAttempted(false);
      try {
        const res = await api.post(
          "/liff",
          {},
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        const token = res.data?.token;
        if (token && !isTokenExpired(token)) {
          api.defaults.headers.common.Authorization = `Bearer ${token}`;
          setBackendToken(token);
          localStorage.setItem("api_token", token);
        } else {
          setBackendToken(null);
          localStorage.removeItem("api_token");
          delete api.defaults.headers.common.Authorization;
        }
      } catch (err) {
        if (
          err?.response?.status === 401 ||
          `${err?.response?.data?.error || ""}`
            .toLowerCase()
            .includes("expired")
        ) {
          try {
            liff?.logout?.();
          } catch { /* LIFF 操作失敗時沿用目前的登入流程。 */ }
          try {
            liff?.login?.({ redirectUri: window.location.href });
            return;
          } catch { /* LIFF 操作失敗時沿用目前的登入流程。 */ }
        }
        setBackendToken(null);
        localStorage.removeItem("api_token");
        delete api.defaults.headers.common.Authorization;
      } finally {
        setTokenAttempted(true);
      }
    };
    exchangeToken();
  }, [idToken]);

  React.useEffect(() => {
    const fetchMe = async () => {
      if (!idToken || !tokenAttempted || !backendToken) {
        setPermissions([]);
        setPermissionLoading(false);
        return;
      }

      setPermissionLoading(true);
      try {
        const res = await api.get("/permissions/me");
        const name = res.data?.employee?.employee_name;
        if (name) {
          setUserName(name);
        } else if (profile?.displayName) {
          setUserName(profile.displayName);
          try {
            await api.patch("/permissions/me", {
              employee_name: profile.displayName,
            });
          } catch {
            // ignore
          }
        }
        setPermissions(res.data?.permissions || []);
      } catch {
        if (profile?.displayName) setUserName(profile.displayName);
        setPermissions([]);
      } finally {
        setPermissionLoading(false);
      }
    };
    fetchMe();
  }, [profile, backendToken, idToken, tokenAttempted]);

  const visibleMenuItems = React.useMemo(() => {
    return menuItems
      .map((item) => {
        if (item.children) {
          const allowedChildren = item.children.filter((child) =>
            hasAnyPermission(permissions, child.permissions)
          );
          if (
            !hasAnyPermission(permissions, item.permissions) ||
            allowedChildren.length === 0
          ) {
            return null;
          }
          return { ...item, children: allowedChildren };
        }
        if (!hasAnyPermission(permissions, item.permissions)) return null;
        return item;
      })
      .filter(Boolean);
  }, [permissions]);

  const guard = (element, required = []) => (
    <ProtectedRoute
      required={required}
      permissions={permissions}
      loading={permissionLoading}
    >
      {element}
    </ProtectedRoute>
  );

  if (liffLoading) {
    return (
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            height: "100vh",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.default",
            p: 2,
          }}
        >
          <Paper sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="h6" gutterBottom>
              LIFF 載入中...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              請稍候，正在連線到 LINE。
            </Typography>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  if (liffError) {
    return (
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            height: "100vh",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.default",
            p: 2,
          }}
        >
          <Paper sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="h6" gutterBottom>
              LIFF 載入失敗
            </Typography>
            <Typography variant="body2" color="error.main" sx={{ mb: 2 }}>
              {liffError}
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
              重新整理
            </Button>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  if (permissionLoading) {
    return (
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            height: "100vh",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.default",
            p: 2,
          }}
        >
          <Paper sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="h6" gutterBottom>
              權限檢查中...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              請稍候，我們正在驗證您的使用權限。
            </Typography>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  const hasDashboard = hasAnyPermission(permissions, ["dashboard:view"]);
  const hasRestockView = hasAnyPermission(permissions, ["restock:view"]);
  const hasProfile = hasAnyPermission(permissions, ["permissions:profile"]);

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Router>
        <PermissionRedirector permissions={permissions} loading={permissionLoading} />
        <AdminShell menuItems={visibleMenuItems} userName={userName}>
          <Routes>
            <Route
              path="/"
              element={
                hasDashboard
                  ? guard(<Dashboard />, ["dashboard:view"])
                  : hasRestockView
                  ? <Navigate to="/inventory/suggestions" replace />
                  : hasProfile
                  ? <Navigate to="/permissions/profile" replace />
                  : <Navigate to="/no-permission" replace />
              }
            />
            <Route path="/no-permission" element={<NoPermission />} />
            <Route
              path="/menu"
              element={guard(
                <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                  <MenuManagement />
                </Box>,
                ["menu:manage"]
              )}
            >
              <Route path="items" element={<MenuItemManagement />} />
              <Route path="options" element={<CustomOptionManagement />} />
              <Route path="boms" element={<BomManagement />} />
            </Route>
            <Route path="/inventory" element={<Navigate to="/inventory/restock" replace />} />
            <Route
              path="/inventory/restock"
              element={guard(
                <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                  <Restock />
                </Box>,
                ["restock:apply"]
              )}
            />
            <Route
              path="/inventory/suggestions"
              element={guard(
                <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                  <RestockSuggestions />
                </Box>,
                ["restock:view"]
              )}
            />
            <Route
              path="/inventory/restock-rules"
              element={guard(
                <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                  <RestockRules />
                </Box>,
                ["restock:rules"]
              )}
            />
            <Route
              path="/inventory/restock-rules-guide"
              element={guard(
                <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                  <RestockRuleGuide />
                </Box>,
                ["restock:rules"]
              )}
            />
            <Route
              path="/inventory/orders"
              element={guard(
                <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                  <PurchaseOrderLog />
                </Box>,
                ["purchase:view"]
              )}
            />
            <Route
              path="/inventory/suppliers"
              element={guard(
                <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                  <SupplierManagement />
                </Box>,
                ["supplier:view"]
              )}
            />
            <Route
              path="/inventory/supplier-reputation"
              element={guard(
                <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                  <SupplierReputationSettings />
                </Box>,
                ["supplier:reputation"]
              )}
            />
            <Route
              path="/permissions"
              element={guard(
                <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                  <PermissionsLayout />
                </Box>,
                ["permissions:profile"]
              )}
            >
              <Route index element={<Navigate to="/permissions/profile" replace />} />
              <Route
                path="profile"
                element={guard(<PermissionsProfile />, ["permissions:profile"])}
              />
              <Route
                path="manage"
                element={guard(<PermissionsManage />, ["permissions:manage"])}
              />
            </Route>
          </Routes>
        </AdminShell>
      </Router>
    </ThemeProvider>
  );
}

export default App;
