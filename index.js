import express from "express";
import dotenv from "dotenv";
import { startupCheck } from "./SQL_controller/index.js";
import * as logger from "./methods/logger.js";
import lineWebHook from "./routes/lineWebHook.js";
import menu from "./routes/menu.js";
import inventory from "./routes/inventory.js";
import order from "./routes/order.js";

const app = express();
dotenv.config();

app.use("/line", lineWebHook);

app.use(express.static('public'));

app.use(express.json());
app.use(express.urlencoded());

app.use("/menu", menu);
app.use("/inventory", inventory);
app.use("/order", order);

app.get("/", (req, res) => {
  res.send("伺服器運行中");
});

const SERVER_PORT = process.env.SERVER_PORT || 3000;

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
