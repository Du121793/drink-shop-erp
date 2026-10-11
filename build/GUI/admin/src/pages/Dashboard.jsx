import React from "react";
import { Typography, Box, Paper } from "@mui/material";

function Dashboard() {
  const grafanaIframeSrc = import.meta.env.VITE_GRAFANA_IFRAME_SRC || "";
  return (
    <Paper
      sx={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        height: "100%",
      }}
    >
      {!grafanaIframeSrc ? (
        <Box
          sx={{
            flexGrow: 1,
            border: "1px dashed grey",
            m: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <Typography variant="body1" color="text.secondary">
            請在專案的 `.env` 檔案中設定 `VITE_GRAFANA_IFRAME_SRC`，填入 Grafana 儀表板 URL。
          </Typography>
          <Typography variant="body2" color="text.secondary">
            例如：
            `VITE_GRAFANA_IFRAME_SRC="https://your-grafana-instance/d/your-dashboard-uid/your-dashboard-name?orgId=1&kiosk"`
          </Typography>
          <Typography variant="body2" color="text.secondary">
            確保 URL 可嵌入，通常會加上 `&kiosk` 參數以隱藏側邊欄。
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <iframe
            src={grafanaIframeSrc}
            width="100%"
            height="100%"
            frameBorder="0"
            title="Grafana Dashboard"
            style={{ border: 0, display: "block" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          ></iframe>
        </Box>
      )}
    </Paper>
  );
}

export default Dashboard;
