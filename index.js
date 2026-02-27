import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { startupCheck } from "./SQL_controller/index.js";
import * as logger from "./methods/logger.js";
import lineRouter from "./routes/line/index.js";
import liffRouter from "./routes/line/liff.js";
import menu from "./routes/menu.js";
import inventory from "./routes/inventory.js";
import order from "./routes/order.js";
import autoRestock from "./routes/autoRestock.js";
import supplierReputation from "./routes/supplierReputation.js";
import supplier from "./routes/supplier.js";
import permissions from "./routes/permissions.js";
import grafanaRouter from "./routes/grafana/index.js";
import { passport as accessPassport } from "./config/passport.js";
import { start as startCornJob } from "./corn/cleanup.js";

const app = express();
dotenv.config();

app.use(cors());
app.use(accessPassport.initialize());

// Line 路由集中管理（webhook 使用 raw，需放在 body parser 之前）
app.use("/line", lineRouter);
// LIFF 交換端點（提供 /liff，與 /line/liff 併存）
app.use("/liff", liffRouter);

app.use(express.static("public"));

app.use(express.json());
app.use(express.urlencoded());

app.use("/grafana", grafanaRouter);
app.use("/menu", menu);
app.use("/inventory", inventory);
app.use("/order", order);
app.use("/autoRestock", autoRestock);
app.use("/", supplierReputation);
app.use("/", supplier);
app.use("/", permissions);

// 健康檢查端點
app.get("/", (req, res) => {
  res.send("伺服器運行中");
});

const SERVER_PORT = process.env.SERVER_PORT || 3000;

// 啟動伺服器並初始化資源
app.listen(SERVER_PORT, () => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const cacheDir = path.join(__dirname, "cache");

    logger.info("正在清除伺服器快取...", "Server");
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      logger.info("快取目錄已刪除", "Server");
    }
    fs.mkdirSync(cacheDir, { recursive: true });
    logger.info("已建立新的快取目錄", "Server");

    logger.info("伺服器監聽成功，正在監聽 " + SERVER_PORT + " 端口", "Server");
    logger.info("開始初始化工作", "Server");
    // 初始化資料庫
    startupCheck();
    // 啟動排程
    startCornJob();
  } catch (e) {
    console.log("伺服器初始化失敗");
    logger.error(e, null, "Server");
  }
});

