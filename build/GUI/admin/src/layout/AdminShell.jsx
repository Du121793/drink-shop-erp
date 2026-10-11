import React from "react";
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
  Collapse,
  IconButton,
  CssBaseline,
  Paper,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import MenuIcon from "@mui/icons-material/Menu";

const drawerWidth = 240;

function AdminShell({ menuItems = [], userName, children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [openMenu, setOpenMenu] = React.useState(true);
  const [openInventoryMenu, setOpenInventoryMenu] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleToggle = (key) => {
    if (key === "menu") {
      setOpenMenu((prev) => !prev);
    } else if (key === "inventory") {
      setOpenInventoryMenu((prev) => !prev);
    }
  };

  const handleNavClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const renderCollapse = (item) => {
    const isMenuSection = item.key === "menu";
    const open = isMenuSection ? openMenu : openInventoryMenu;

    return (
      <React.Fragment key={item.key}>
        <ListItemButton onClick={() => handleToggle(item.key)}>
          <ListItemIcon>
            {item.icon ? React.createElement(item.icon) : null}
          </ListItemIcon>
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
                  <ListItemIcon>
                    {child.icon ? React.createElement(child.icon) : null}
                  </ListItemIcon>
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
            管控後台
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
              {menuItems.map((item) =>
                item.children ? (
                  renderCollapse(item)
                ) : (
                  <ListItem key={item.key} disablePadding>
                    <ListItemButton
                      component={RouterLink}
                      to={item.path}
                      onClick={handleNavClick}
                    >
                      <ListItemIcon>
                        {item.icon ? React.createElement(item.icon) : null}
                      </ListItemIcon>
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
        <Paper
          sx={{
            flexGrow: 1,
            borderRadius: 0,
            boxShadow: "none",
            bgcolor: "background.default",
          }}
        >
          {children}
        </Paper>
      </Box>
    </Box>
  );
}

export default AdminShell;
