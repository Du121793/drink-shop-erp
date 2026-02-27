import React from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Link as RouterLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CssBaseline,
  createTheme,
  ThemeProvider,
  Collapse,
  Button,
  Paper,
  IconButton,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import liff from "@line/liff";
import DashboardIcon from "@mui/icons-material/Dashboard";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import PeopleIcon from "@mui/icons-material/People";
import InventoryIcon from "@mui/icons-material/Inventory";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import FastfoodIcon from "@mui/icons-material/Fastfood";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import CategoryIcon from "@mui/icons-material/Category";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu";
import BusinessIcon from "@mui/icons-material/Business";
import ShieldIcon from "@mui/icons-material/Shield";
import MenuIcon from "@mui/icons-material/Menu";
import { useLiffInit } from "./hooks/useLiff";
import api, { isTokenExpired } from "./api/axios";

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

const drawerWidth = 240;

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

const menuItems = [
  {
    key: "dashboard",
    text: "儀表板",
    path: "/",
    icon: <DashboardIcon />,
    minLevel: 2,
  },
  {
    key: "menu",
    text: "菜單管理",
    icon: <RestaurantMenuIcon />,
    minLevel: 3,
    children: [
      {
        text: "品項管理",
        path: "/menu/items",
        icon: <FastfoodIcon />,
        minLevel: 3,
      },
      {
        text: "客製化選項管理",
        path: "/menu/options",
        icon: <SettingsSuggestIcon />,
        minLevel: 3,
      },
      {
        text: "配方管理 (BOM)",
        path: "/menu/boms",
        icon: <CategoryIcon />,
        minLevel: 3,
      },
    ],
  },
  {
    key: "inventory",
    text: "庫存管理",
    icon: <InventoryIcon />,
    minLevel: 1,
    children: [
      {
        text: "補貨",
        path: "/inventory/restock",
        icon: <LocalShippingIcon />,
        minLevel: 1,
      },
      {
        text: "補貨建議清單",
        path: "/inventory/suggestions",
        icon: <LightbulbIcon />,
        minLevel: 1,
      },
      {
        text: "庫存規則",
        path: "/inventory/restock-rules",
        icon: <SettingsSuggestIcon />,
        minLevel: 5,
      },
      {
        text: "採購紀錄",
        path: "/inventory/orders",
        icon: <HistoryEduIcon />,
        minLevel: 1,
      },
      {
        text: "供應商管理",
        path: "/inventory/suppliers",
        icon: <BusinessIcon />,
        minLevel: 3,
      },
      {
        text: "供應商信譽設定",
        path: "/inventory/supplier-reputation",
        icon: <ShieldIcon />,
        minLevel: 3,
      },
    ],
  },
  {
    key: "permissions",
    text: "員工權限",
    icon: <PeopleIcon />,
    minLevel: 1,
    children: [
      {
        text: "個人資料",
        path: "/permissions/profile",
        icon: <PeopleIcon />,
        minLevel: 1,
      },
      {
        text: "管理員工",
        path: "/permissions/manage",
        icon: <PeopleIcon />,
        minLevel: 5,
      },
    ],
  },
];

// 權限保護：未達門檻導向無權限頁
function ProtectedRoute({
  minLevel = 0,
  permissionLevel,
  permissionLoading,
  children,
}) {
  if (permissionLoading) {
    return (
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
            請稍候，我們正在驗證您的使用權限
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (!permissionLoading && permissionLevel < minLevel) {
    return <Navigate to="/no-permission" replace />;
  }

  return children;
}

// 無權限頁重新導向（依權限回到可見頁）
function PermissionRedirector({ permissionLevel, permissionLoading }) {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (permissionLoading) return;
    if (location.pathname !== "/no-permission") return;

    if (permissionLevel >= 2) {
      navigate("/", { replace: true });
    } else if (permissionLevel >= 1) {
      navigate("/inventory/suggestions", { replace: true });
    }
  }, [permissionLevel, permissionLoading, location.pathname, navigate]);

  return null;
}

// 管理後台入口
function App() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const {
    loading: liffLoading,
    error: liffError,
    profile,
    idToken,
  } = useLiffInit();
  const [openMenu, setOpenMenu] = React.useState(true);
  const [openInventoryMenu, setOpenInventoryMenu] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [userName, setUserName] = React.useState("");
  const [backendToken, setBackendToken] = React.useState(null);
  const [permissionLevel, setPermissionLevel] = React.useState(0);
  const [permissionLoading, setPermissionLoading] = React.useState(true);
  const [tokenAttempted, setTokenAttempted] = React.useState(false);

  // 交換 LIFF ID Token -> 後端 JWT，並統一設置到 axios header
  React.useEffect(() => {
    // 交換 LIFF Token 並設定 API 夾帶
    const exchangeToken = async () => {
      if (!idToken || isTokenExpired(idToken)) {
        setBackendToken(null);
        setTokenAttempted(true);
        localStorage.removeItem("api_token");
        delete api.defaults.headers.common.Authorization;
        if (idToken) {
          try {
            liff?.logout?.();
          } catch {}
          try {
            liff?.login?.({ redirectUri: window.location.href });
            return;
          } catch {}
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
          } catch {}
          try {
            liff?.login?.({ redirectUri: window.location.href });
            return;
          } catch {}
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

  // 讀取個人資料與權限
  React.useEffect(() => {
    // 取得使用者權限與姓名
    const fetchMe = async () => {
      if (!idToken) {
        setPermissionLevel(0);
        setPermissionLoading(false);
        return;
      }

      if (!tokenAttempted) {
        setPermissionLoading(true);
        return;
      }

      if (!backendToken) {
        setPermissionLevel(0);
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
            // 忽略名稱同步失敗
          }
        }
        const rolesFromProfile = Array.isArray(res.data?.employee?.roles)
          ? res.data.employee.roles
          : [];

        let level = Number(
          res.data?.permission_level ??
            res.data?.employee?.permission_level ??
            0
        );
        // 若後端未回傳 permission_level 但已有角色，嘗試以角色最高權限回填
        if (level === 0 && rolesFromProfile.length > 0) {
          try {
            const rolesRes = await api.get("/permissions/roles");
            const roleMap = rolesRes.data?.roles || [];
            const matched = roleMap.filter((r) =>
              rolesFromProfile.includes(r.role_id)
            );
            if (matched.length > 0) {
              level = Math.max(
                ...matched.map((r) => Number(r.permission_level || 0))
              );
            }
          } catch {
            // 忽略錯誤，回退為 0
          }
        }
        setPermissionLevel(level);
      } catch (e) {
        if (profile?.displayName) setUserName(profile.displayName);
        setPermissionLevel(0);
      } finally {
        setPermissionLoading(false);
      }
    };
    fetchMe();
  }, [profile, backendToken, idToken, tokenAttempted]);

  // 切換側邊選單展開狀態
  const handleToggle = (key) => {
    if (key === "menu") {
      setOpenMenu((prev) => !prev);
    } else if (key === "inventory") {
      setOpenInventoryMenu((prev) => !prev);
    }
  };

  // 行動版點選後收起側邊選單
  const handleNavClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // 子選單展開渲染
  const renderCollapse = (item) => {
    const isMenuSection = item.key === "menu";
    const open = isMenuSection ? openMenu : openInventoryMenu;

    return (
      <React.Fragment key={item.key}>
        <ListItemButton onClick={() => handleToggle(item.key)}>
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.text} />
          {open ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {item.children.map((child) => (
              <ListItem key={child.text} disablePadding sx={{ pl: 4 }}>
                <ListItemButton
                  component={RouterLink}
                  to={child.path}
                  onClick={handleNavClick}
                >
                  <ListItemIcon>{child.icon}</ListItemIcon>
                  <ListItemText primary={child.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
      </React.Fragment>
    );
  };

  // 依權限過濾可見的選單項目
  const visibleMenuItems = React.useMemo(() => {
    return menuItems
      .map((item) => {
        const minLevel = item.minLevel ?? 0;
        if (item.children) {
          const allowedChildren = item.children.filter(
            (child) => permissionLevel >= (child.minLevel ?? minLevel)
          );
          if (permissionLevel < minLevel || allowedChildren.length === 0)
            return null;
          return { ...item, children: allowedChildren };
        }
        if (permissionLevel < minLevel) return null;
        return item;
      })
      .filter(Boolean);
  }, [permissionLevel]);

  // 權限守門：包一層保護元件
  const guard = (element, minLevel = 0) => (
    <ProtectedRoute
      minLevel={minLevel}
      permissionLevel={permissionLevel}
      permissionLoading={permissionLoading}
    >
      {element}
    </ProtectedRoute>
  );

  if (liffLoading) {
    return (
      <ThemeProvider theme={lightTheme}>
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
              LIFF 啟動中...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              請稍候，請嘗試登入 LINE
            </Typography>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  if (liffError) {
    return (
      <ThemeProvider theme={lightTheme}>
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
              LIFF 啟動失敗
            </Typography>
            <Typography variant="body2" color="error.main" sx={{ mb: 2 }}>
              {liffError}
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.location.reload()}
            >
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
              請稍候，我們正在驗證您的使用權限
            </Typography>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={lightTheme}>
      <Router>
        <PermissionRedirector
          permissionLevel={permissionLevel}
          permissionLoading={permissionLoading}
        />
        <Box sx={{ display: "flex", height: "100vh" }}>
          <CssBaseline />
          <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
            <Toolbar>
              {isMobile && (
                <IconButton
                  color="inherit"
                  edge="start"
                  onClick={() => setMobileOpen((prev) => !prev)}
                  sx={{ mr: 2 }}
                >
                  <MenuIcon />
                </IconButton>
              )}
              <Typography variant="h6" noWrap component="div">
                管理後台
              </Typography>
              {userName && (
                <Typography
                  variant="body1"
                  sx={{ ml: 2, color: "text.secondary" }}
                >
                  {userName}
                </Typography>
              )}
            </Toolbar>
          </AppBar>
          <Box
            component="nav"
            sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
            aria-label="sidebar navigation"
          >
            <Drawer
              variant={isMobile ? "temporary" : "permanent"}
              open={isMobile ? mobileOpen : true}
              onClose={() => setMobileOpen(false)}
              ModalProps={{ keepMounted: true }}
              sx={{
                "& .MuiDrawer-paper": {
                  width: drawerWidth,
                  boxSizing: "border-box",
                },
              }}
            >
              <Toolbar />
              <Box sx={{ overflow: "auto" }}>
                <List>
                  {visibleMenuItems.map((item) =>
                    item.children ? (
                      renderCollapse(item)
                    ) : (
                      <ListItem key={item.key} disablePadding>
                        <ListItemButton
                          component={RouterLink}
                          to={item.path}
                          onClick={handleNavClick}
                        >
                          <ListItemIcon>{item.icon}</ListItemIcon>
                          <ListItemText primary={item.text} />
                        </ListItemButton>
                      </ListItem>
                    )
                  )}
                </List>
              </Box>
            </Drawer>
          </Box>
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
              width: "100%",
              px: 0,
              pb: 0,
            }}
          >
            <Toolbar />
            <Routes>
              <Route
                path="/"
                element={
                  permissionLevel >= 2 ? (
                    guard(<Dashboard />, 2)
                  ) : permissionLevel >= 1 ? (
                    <Navigate to="/inventory/suggestions" replace />
                  ) : (
                    <Navigate to="/no-permission" replace />
                  )
                }
              />
              <Route path="/no-permission" element={<NoPermission />} />
              <Route
                path="/menu"
                element={guard(
                  <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                    <MenuManagement />
                  </Box>,
                  3
                )}
              >
                <Route path="items" element={<MenuItemManagement />} />
                <Route path="options" element={<CustomOptionManagement />} />
                <Route path="boms" element={<BomManagement />} />
              </Route>
              <Route
                path="/inventory"
                element={<Navigate to="/inventory/restock" replace />}
              />
              <Route
                path="/inventory/restock"
                element={guard(
                  <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                    <Restock />
                  </Box>,
                  1
                )}
              />
              <Route
                path="/inventory/suggestions"
                element={guard(
                  <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                    <RestockSuggestions />
                  </Box>,
                  1
                )}
              />
              <Route
                path="/inventory/restock-rules"
                element={guard(
                  <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                    <RestockRules />
                  </Box>,
                  5
                )}
              />
              <Route
                path="/inventory/restock-rules-guide"
                element={guard(
                  <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                    <RestockRuleGuide />
                  </Box>,
                  5
                )}
              />
              <Route
                path="/inventory/orders"
                element={guard(
                  <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                    <PurchaseOrderLog />
                  </Box>,
                  1
                )}
              />
              <Route
                path="/inventory/suppliers"
                element={guard(
                  <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                    <SupplierManagement />
                  </Box>,
                  3
                )}
              />
              <Route
                path="/inventory/supplier-reputation"
                element={guard(
                  <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                    <SupplierReputationSettings />
                  </Box>,
                  3
                )}
              />
              <Route
                path="/permissions"
                element={guard(
                  <Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}>
                    <PermissionsLayout />
                  </Box>,
                  1
                )}
              >
                <Route
                  index
                  element={<Navigate to="/permissions/profile" replace />}
                />
                <Route
                  path="profile"
                  element={guard(<PermissionsProfile />, 1)}
                />
                <Route
                  path="manage"
                  element={guard(<PermissionsManage />, 5)}
                />
              </Route>
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;

