import React from "react";
import { Navigate } from "react-router-dom";
import { Box, Paper, Typography } from "@mui/material";
import { hasAnyPermission } from "../utils/permission";

function ProtectedRoute({ required = [], permissions = [], loading, children }) {
  if (loading) {
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
            請稍候，我們正在驗證您的使用權限。
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (!hasAnyPermission(permissions, required)) {
    return <Navigate to="/no-permission" replace />;
  }

  return children;
}

export default ProtectedRoute;
