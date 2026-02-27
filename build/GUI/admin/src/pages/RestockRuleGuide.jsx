import React from "react";
import {
  Box,
  Stack,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";

const TARGET_TYPES = [
  {
    name: "目前庫存量",
    desc: "比較目前庫存量與指定數值，可選固定數值或最大庫存百分比。",
    example: "目前庫存量 <= 最大庫存 30%",
  },
  {
    name: "庫存比例",
    desc: "比較目前庫存/最大庫存的比例。",
    example: "庫存比例 < 0.1",
  },
  {
    name: "近N日消耗量",
    desc: "比較近N日消耗量與門檻，可選固定數值或最大庫存百分比。",
    example: "近7日消耗量 >= 最大庫存 15%",
  },
  {
    name: "消耗比例(近N日/最大庫存)",
    desc: "比較近N日消耗量除以最大庫存的比例。",
    example: "消耗比例 >= 0.15",
  },
  {
    name: "即將到期量",
    desc: "比較即將到期量是否達到門檻。",
    example: "即將到期量 > 0",
  },
  {
    name: "消耗排名比例",
    desc: "依近N日消耗排序後的名次比例。",
    example: "排名比例 <= 25%",
  },
  {
    name: "保鮮期天數",
    desc: "比較原料保鮮期天數。",
    example: "保鮮期天數 <= 14",
  },
  {
    name: "季節",
    desc: "指定冬/春/夏/秋時命中。",
    example: "季節為冬或夏",
  },
  {
    name: "日期區間",
    desc: "指定日期區間（MM-DD ~ MM-DD）時命中。",
    example: "12-01 ~ 02-28",
  },
];

const TRIGGER_ACTIONS = [
  {
    name: "運算",
    desc:
      "使用 + / - / * / / 對基準值運算。基準可選目前新增數值(預設)、目前庫存值、庫存最大值。",
  },
  {
    name: "調整",
    desc:
      "直接把目前新增數值改為固定數值、百分比或系統來源。若選系統來源（如近N日消耗量、即將到期量、安全缺口、四捨五入），會先計算來源值後覆蓋目前新增數值，再往下繼續計算。",
  },
  {
    name: "限制",
    desc:
      "設定上限或下限，超過門檻時調整為指定數值或最大庫存百分比。",
  },
];

function RestockRuleGuide() {
  return (
    <Box>
      <Stack spacing={3}>
        <Typography variant="h4">補貨規則設定手冊</Typography>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h6">優先序與採用規則</Typography>
            <Typography>
              優先序只在多條規則同時命中時才有意義。數字越大越先被採用，
              系統會先找最高優先序的所有規則，若其中有多條命中，就取補貨量最大的那一條。
              若最高優先序沒有任何命中，才會往下一個優先序繼續判斷。
            </Typography>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h6">計算流程</Typography>
            <Typography>
              每條規則都會獨立計算。規則內的步驟由上到下依序執行，
              目標選取只負責判斷是否命中，不做任何 +-*/ 運算。
              一旦命中，該步驟的門檻觸發動作就會依畫面順序逐一套用，
              得到的新增數值會帶到下一步繼續計算。
            </Typography>
            <Typography>
              例：步驟一命中後先 +100，步驟二再 *1.2，最終為 100 * 1.2 = 120。
            </Typography>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h6">目標選取類型</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>類型</TableCell>
                  <TableCell>說明</TableCell>
                  <TableCell>示例</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {TARGET_TYPES.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.desc}</TableCell>
                    <TableCell>{item.example}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h6">門檻觸發動作</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>動作</TableCell>
                  <TableCell>說明</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {TRIGGER_ACTIONS.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h6">優先序示範</Typography>
            <Typography>
              規則 A 與規則 B 同為優先序 100，若同時命中且結果分別為 80 與 120，系統會採用 120。
            </Typography>
            <Typography>
              規則 C 的優先序為 110，若命中即使結果是 90，也會直接採用規則 C，
              並忽略優先序 100 的其他規則。
            </Typography>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h6">標籤用途</Typography>
            <Typography>
              標籤只用於分類與篩選，不影響補貨計算。
              你可以自行新增、修改、刪除標籤，方便管理規則。
            </Typography>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

export default RestockRuleGuide;
