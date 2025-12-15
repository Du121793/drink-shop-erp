import React from 'react';
import { Typography, Box, Paper } from '@mui/material';

function Dashboard() {
  const grafanaIframeSrc = import.meta.env.VITE_GRAFANA_IFRAME_SRC || ""; // 從環境變數讀取

  return (
    <Paper sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}> {/* 確保 flexGrow: 1 */}
      <Typography variant="h6" gutterBottom sx={{ pl: 2, pt: 2 }}>銷量與庫存儀表板</Typography>
      {!grafanaIframeSrc ? ( // 判斷 grafanaIframeSrc 是否為空字串
        <Box sx={{ flexGrow: 1, border: '1px dashed grey', m: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Typography variant="body1" color="text.secondary">請在專案根目錄的 `.env` 文件中設定 `VITE_GRAFANA_IFRAME_SRC` 變數，填寫您的 Grafana 儀表板 URL。</Typography>
          <Typography variant="body2" color="text.secondary">例如: `VITE_GRAFANA_IFRAME_SRC="https://your-grafana-instance/d/your-dashboard-uid/your-dashboard-name?orgId=1&kiosk"`</Typography>
          <Typography variant="body2" color="text.secondary">確保 URL 包含 `embed` 路徑且適用於嵌入，通常會包含 `&kiosk` 參數以隱藏導航。</Typography>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, mt: 1 }}>
          <iframe
            src={grafanaIframeSrc}
            width="100%"
            height="100%"
            frameBorder="0"
            title="Grafana Dashboard"
            style={{ border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          ></iframe>
        </Box>
      )}
    </Paper>
  );
}

export default Dashboard;