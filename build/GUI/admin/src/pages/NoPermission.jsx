import React from "react";
import { Box, Paper, Typography, Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

function NoPermission() {
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
      <Paper sx={{ p: 4, maxWidth: 420, textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          無權限
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          您目前尚未被指派任何權限，請向管理員申請或稍後再試。
        </Typography>
        <Button
          variant="contained"
          fullWidth
          sx={{ mb: 1 }}
          onClick={() => window.location.reload()}
        >
          重新載入
        </Button>
        <Button
          variant="outlined"
          fullWidth
          component={RouterLink}
          to="/"
          sx={{ mt: 1 }}
        >
          返回首頁
        </Button>
      </Paper>
    </Box>
  );
}

export default NoPermission;
