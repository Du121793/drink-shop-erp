import React from 'react';
import { HashRouter as Router, Routes, Route, Link as RouterLink } from 'react-router-dom';
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

import Dashboard from './pages/Dashboard';
import EmployeePermissions from './pages/EmployeePermissions';
import MenuManagement from './pages/MenuManagement'; // 父路由容器
import Inventory from './pages/Inventory';

// 新的子頁面組件
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
  { text: '儀表板', path: '/', icon: <DashboardIcon /> },
  { 
    text: '菜單管理', 
    icon: <RestaurantMenuIcon />, 
    children: [
      { text: '品項管理', path: '/menu/items', icon: <FastfoodIcon /> },
      { text: '客製化選項管理', path: '/menu/options', icon: <SettingsSuggestIcon /> },
      { text: '原料管理 (BOM)', path: '/menu/boms', icon: <CategoryIcon /> },
    ]
  },
  { text: '員工權限', path: '/permissions', icon: <PeopleIcon /> },
  { text: '庫存管理', path: '/inventory', icon: <InventoryIcon /> },
];

function App() {
  const [openMenu, setOpenMenu] = React.useState(true); // 控制菜單管理的子選單展開/收合

  const handleClickMenu = () => {
    setOpenMenu(!openMenu);
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
                {menuItems.map((item, index) => (
                  item.children ? ( // 如果有子選單
                    <React.Fragment key={item.text}>
                      <ListItemButton onClick={handleClickMenu}>
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.text} />
                        {openMenu ? <ExpandLess /> : <ExpandMore />}
                      </ListItemButton>
                      <Collapse in={openMenu} timeout="auto" unmountOnExit>
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
                  ) : ( // 沒有子選單的普通項目
                    <ListItem key={item.text} disablePadding>
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
              <Route path="/menu" element={<Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}><MenuManagement /></Box>}> {/* 新增 pt:2 */}
                <Route path="items" element={<MenuItemManagement />} />
                <Route path="options" element={<CustomOptionManagement />} />
                <Route path="boms" element={<BomManagement />} />
              </Route>
              <Route path="/permissions" element={<Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}><EmployeePermissions /></Box>} /> {/* 新增 pt:2 */}
              <Route path="/inventory" element={<Box sx={{ flexGrow: 1, px: 3, pb: 3, pt: 2 }}><Inventory /></Box>} /> {/* 新增 pt:2 */}
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;