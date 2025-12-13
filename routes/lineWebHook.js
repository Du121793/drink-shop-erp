import express, { Route } from "express";
import * as line from "@line/bot-sdk";
import * as logger from "../methods/logger.js";
import * as menuController from "../SQL_controller/menu.js";
import * as JWTIssue from "../methods/JWT_issue.js";
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

  const lineUserId = event?.source?.userId;
  const text = event.message.text;

  let message;

  if (text === "指令") {
    message = await handleCommandList();
  } else if (text === "菜單") {
    message = await handleMenu();
  } else {
    let replyText;
    if (text === "確認庫存") replyText = await handleInventory();
    else if (text === "自動進貨") replyText = await handleRestockList();
    else if (text === "補貨") replyText = await handleRestock();
    else if (text === "權限註冊") replyText = await handleRegister(lineUserId);
    else replyText = "輸入「指令」以確認可用命令";
    message = {
      type: "text",
      text: replyText,
    };
  }

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [message],
  });
}

// 以下全部都是針對於每個事件做出的反應

async function handleCommandList() {
  return {
    type: "flex",
    altText: "指令選單",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "指令選單",
            weight: "bold",
            size: "xl",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "請選擇您需要的服務：",
            wrap: true,
          },
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
            color: "#905c44",
            action: {
              type: "message",
              label: "確認庫存",
              text: "確認庫存",
            },
          },
          {
            type: "button",
            style: "primary",
            color: "#905c44",
            action: {
              type: "message",
              label: "自動進貨",
              text: "自動進貨",
            },
          },
          {
            type: "button",
            style: "primary",
            color: "#905c44",
            action: {
              type: "message",
              label: "補貨",
              text: "補貨",
            },
          },
          {
            type: "button",
            style: "primary",
            color: "#905c44",
            action: {
              type: "message",
              label: "菜單",
              text: "菜單",
            },
          },
          {
            type: "button",
            style: "secondary",
            action: {
              type: "message",
              label: "權限註冊",
              text: "權限註冊",
            },
          },
        ],
        flex: 0,
      },
    },
  };
}

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

async function handleMenu() {
  const menuItems = await menuController.getMenus();

  if (menuItems.length === 0) {
    return {
      type: "text",
      text: "目前沒有可顯示的菜單項目。",
    };
  }

  const bubbles = menuItems.map((item) => {
    const bubble = {
      type: "bubble",
      size: "micro",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: item.name,
            weight: "bold",
            size: "md",
            wrap: true,
          },
        ],
        paddingBottom: "none",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "價格",
                color: "#aaaaaa",
                size: "sm",
                flex: 2,
              },
              {
                type: "text",
                text: `$${item.price}`,
                wrap: true,
                color: "#666666",
                size: "sm",
                flex: 5,
              },
            ],
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: "狀態",
                color: "#aaaaaa",
                size: "sm",
                flex: 2,
              },
              {
                type: "text",
                text: item.isAvailable ? "可供應" : "已售完",
                wrap: true,
                color: item.isAvailable ? "#1DB446" : "#FF6B6E",
                size: "sm",
                flex: 5,
              },
            ],
          },
        ],
      },
    };

    if (item.isAvailable) {
      bubble.footer = {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "message",
              label: "查看選項",
              text: `查看選項 ${item.id}`,
            },
            color: "#905c44",
          },
        ],
        flex: 0,
      };
    }

    return bubble;
  });

  return {
    type: "flex",
    altText: "這是我們的菜單",
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
}

async function handleRegister(lineUserId) {
  return (await JWTIssue.issueRegToken(lineUserId)).toString();
}
export default router;
