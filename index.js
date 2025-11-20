import express from "express";
import dotenv from "dotenv";
import { startupCheck } from "./SQL_controller/index.js";
import * as logger from "./methods/logger.js";
import lineWebHook from "./routes/lineWebHook.js";

const app = express();
dotenv.config();

app.use(express.json());
app.use(express.urlencoded());

const SERVER_PORT = process.env.SERVER_PORT || 3000;

app.use("/line", lineWebHook);

app.listen(SERVER_PORT, () => {
  try {
    logger.info("伺服器監聽成功，正在監聽 " + SERVER_PORT + " 端口");
    logger.info("開始初始化工作");
    // 初始化資料庫
    startupCheck();
  } catch (e) {
    console.log("伺服器初始化失敗");
  }
});
