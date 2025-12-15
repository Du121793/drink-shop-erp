import React from 'react';
import { HashRouter as Router, Routes, Route, Link as RouterLink, Navigate } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText, CssBaseline, createTheme, ThemeProvider, Collapse } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import FastfoodIcon from '@mui/icons-material/Fastfood';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import CategoryIcon from '@mui/icons-material/Category';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import BusinessIcon from '@mui/icons-material/Business';

import Dashboard from './pages/Dashboard';
import EmployeePermissions from './pages/EmployeePermissions';
import MenuManagement from './pages/MenuManagement'; // 父路由容器
import Restock from './pages/Restock';
import RestockSuggestions from './pages/RestockSuggestions';
import PurchaseOrderLog from './pages/PurchaseOrderLog';
import SupplierManagement from './pages/SupplierManagement';

// 菜單管理子頁面
import MenuItemManagement from './pages/MenuItemManagement';
import CustomOptionManagement from './pages/CustomOptionManagement';
import BomManagement from './pages/BomManagement';

const drawerWidth = 240;

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#d35400',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#333',
      secondary: '#555',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#333',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
        },
      },
    },
  },
});

const menuItems = [
  { key: 'dashboard', text: '儀表板', path: '/', icon: <DashboardIcon /> },
  { 
    key: 'menu',
    text: '菜單管理', 
    icon: <RestaurantMenuIcon />, 
    children: [
      { text: '品項管理', path: '/menu/items', icon: <FastfoodIcon /> },
      { text: '客製化選項管理', path: '/menu/options', icon: <SettingsSuggestIcon /> },
      { text: '原料管理 (BOM)', path: '/menu/boms', icon: <CategoryIcon /> },
    ]
  },
  { 
    key: 'inventory',
    text: '庫存管理', 
    icon: <InventoryIcon />, 
    children: [
      { text: '補貨', path: '/inventory/restock', icon: <LocalShippingIcon /> },
      { text: '補貨建議清單', path: '/inventory/suggestions', icon: <LightbulbIcon /> },
      { text: '叫貨紀錄', path: '/inventory/orders', icon: <HistoryEduIcon /> },
      { text: '原料廠商管理', path: '/inventory/suppliers', icon: <BusinessIcon /> },
    ]
  },
  { key: 'permissions', text: '員工權限', path: '/permissions', icon: <PeopleIcon /> },
];

function App() {
  const [openMenu, setOpenMenu] = React.useState(true); // 控制菜單管理子選單
  const [openInventoryMenu, setOpenInventoryMenu] = React.useState(true); // 控制庫存管理子選單

  const handleToggle = (key) => {
    if (key === 'menu') {
      setOpenMenu((prev) => !prev);
    } else if (key === 'inventory') {
      setOpenInventoryMenu((prev) => !prev);
    }
  };

  const renderCollapse = (item) => {
    const isMenuSection = item.key === 'menu';
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
                <ListItemButton component={RouterLink} to={child.path}>
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

  return (
    <ThemeProvider theme={lightTheme}>
      <Router>
        <Box sx={{ display: 'flex', height: '100vh' }}>
          <CssBaseline />
          <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <Toolbar>
              <Typography variant="h6" noWrap component="div">
                管理後台
              </Typography>
            </Toolbar>
          </AppBar>
          <Drawer
            variant="permanent"
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
            }}
          >
            <Toolbar />
            <Box sx={{ overflow: 'auto' }}>
              <List>
                {menuItems.map((item) => (
                  item.children
                    ? renderCollapse(item)
                    : (
                      <ListItem key={item.key} disablePadding>
                        <ListItemButton component={RouterLink} to={item.path}>
                          <ListItemIcon>
                            {item.icon}
                          </ListItemIcon>
                          <ListItemText primary={item.text} />
                        </ListItemButton>
                      </ListItem>
                    )
                ))}
              </List>
            </Box>
          </Drawer>
          <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Toolbar /> {/* Toolbar 統一放在 main 內容區頂部 */}
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/menu" element={<Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}><MenuManagement /></Box>}>
                <Route path="items" element={<MenuItemManagement />} />
                <Route path="options" element={<CustomOptionManagement />} />
                <Route path="boms" element={<BomManagement />} />
              </Route>
              <Route path="/inventory" element={<Navigate to="/inventory/restock" replace />} />
              <Route path="/inventory/restock" element={<Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}><Restock /></Box>} />
              <Route path="/inventory/suggestions" element={<Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}><RestockSuggestions /></Box>} />
              <Route path="/inventory/orders" element={<Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}><PurchaseOrderLog /></Box>} />
              <Route path="/inventory/suppliers" element={<Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}><SupplierManagement /></Box>} />
              <Route path="/permissions" element={<Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}><EmployeePermissions /></Box>} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
