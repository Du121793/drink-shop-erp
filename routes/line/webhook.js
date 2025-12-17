import express from "express";
import crypto from "crypto";
import * as line from "@line/bot-sdk";
import * as logger from "../../methods/logger.js";
import * as permissionController from "../../SQL_controller/permission.js";
import {
  handleCommandList,
  handleMenu,
  handleInventoryReport,
  handleRestockList,
  handleRestock,
  handleRegister,
} from "./handlers.js";

const router = express.Router();

const channelSecret = process.env.LINE_CHANNEL_SECRET || "";
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// 使用 raw body 驗簽，避免被其他 parser 影響
router.post("/", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const signature = req.headers["x-line-signature"];
    const body = req.body; // 可能是 Buffer / string / object
    if (!signature || body == null) return res.status(400).end();

    let bodyBuffer;
    if (Buffer.isBuffer(body)) {
      bodyBuffer = body;
    } else if (typeof body === "string") {
      bodyBuffer = Buffer.from(body);
    } else if (typeof body === "object") {
      bodyBuffer = Buffer.from(JSON.stringify(body));
    } else {
      return res.status(400).end();
    }

    const hash = crypto
      .createHmac("SHA256", channelSecret)
      .update(bodyBuffer)
      .digest("base64");
    if (hash !== signature) {
      return res.status(401).end();
    }

    const json = JSON.parse(bodyBuffer.toString("utf-8"));
    const events = json.events ?? [];
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    err.msg = "Line 嘗試進行webhook失敗";
    logger.error(err, req, "LINE");
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const lineUserId = event?.source?.userId;
  const text = event.message.text;
  let message;

  try {
    const isRegister = text === "權限註冊";
    let permissionLevel = 0;
    if (lineUserId) {
      try {
        permissionLevel = await permissionController.getPermissionLevelByLineId(lineUserId);
      } catch {}
    }
    const hasPermission = permissionLevel >= 1;

    const noPermissionMessage = {
      type: "flex",
      altText: "無使用權限",
      contents: {
        type: "bubble",
        size: "mega",
        styles: {
          header: { backgroundColor: "#f7f3ed" },
          body: { backgroundColor: "#f7f3ed" },
          footer: { backgroundColor: "#f7f3ed" },
        },
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "無權限", weight: "bold", size: "xl", color: "#1b1b1b" },
            { type: "text", text: "請先完成權限註冊", size: "sm", color: "#4a4a4a" },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: "目前帳號尚未開通使用權限。", color: "#1b1b1b", wrap: true },
            { type: "text", text: "請點擊下方按鈕進行註冊。", color: "#4a4a4a", wrap: true },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              height: "sm",
              color: "#905c44",
              action: { type: "message", label: "權限註冊", text: "權限註冊" },
            },
          ],
        },
      },
    };

    if (!isRegister && !hasPermission) {
      message = noPermissionMessage;
    } else {
      switch (text) {
        case "指令":
          message = await handleCommandList();
          break;
        case "菜單":
          message = await handleMenu();
          break;
        case "確認庫存":
          message = await handleInventoryReport();
          break;
        case "自動進貨":
        case "自動補貨":
        case "補貨建議":
          message = await handleRestockList();
          break;
        case "補貨":
          message = await handleRestock();
          break;
        case "權限註冊":
          message = await handleRegister(lineUserId);
          break;
        default:
          message = await handleCommandList();
      }
    }
  } catch (err) {
    err.msg = "Line webhook 指令處理失敗";
    logger.error(err, null, "LINE_HANDLE");
    message = { type: "text", text: "系統忙碌，請稍後再試。" };
  }

  if (typeof message === "string") {
    message = { type: "text", text: message };
  }

  if (!message) {
    message = { type: "text", text: "系統忙碌，請稍後再試。" };
  }

  try {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [message],
    });
  } catch (e) {
    e.msg = "Line 回覆訊息失敗";
    logger.error(e, null, "LINE_REPLY");
  }
}

export default router;
