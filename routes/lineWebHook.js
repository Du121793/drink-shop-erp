import express, { Route } from "express";
import * as line from "@line/bot-sdk";
import * as logger from "../methods/logger.js";

const router = express.Router();

// 給 middleware 用的設定
const middlewareConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// 創建Line回傳客戶端
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// Line建立WebHook 這一步是為了讓Line可以確認本服務存在並連線
router.post("/webhook", line.middleware(middlewareConfig), async (req, res) => {
  try {
    const events = req.body.events ?? [];
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    err.msg = "Line 嘗試進行webhook失敗";
    logger.error(err, req, "LINE");
    res.status(500).end();
  }
});

// 事件捕獲器，用於確認用戶發出的事件類型並回傳
// 這裡只有對訊息有反應
// 後期處理只需要在line點選圖卡並發出訊息即可處理webhook
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const text = event.message.text;

  let replyText;
  if (text === "確認庫存") replyText = handleInventory();
  else if (text === "指令")
    replyText = "可用指令：確認庫存 / 自動進貨 / 補貨 / 指令";
  else if (text === "自動進貨") replyText = handleRestockList();
  else if (text === "補貨") replyText = handleRestock();
  else replyText = "輸入「指令」以確認可用命令";

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: replyText,
      },
    ],
  });
}

// 以下全部都是針對於每個事件做出的反應

async function handleInventory() {
  return "歡迎來到庫存選項";
}

async function handleRestockList() {
  return `歡迎來到自動進貨選項，以下為推薦的補貨清單
  
  請點擊連結已做修改`;
}

async function handleRestock() {
  return `歡迎來到補貨功能，請點擊連結並依序輸入如何補貨`;
}

export default router;
