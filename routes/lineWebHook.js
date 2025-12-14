import express, { Route } from "express";
import * as line from "@line/bot-sdk";
import * as logger from "../methods/logger.js";
import * as menuController from "../SQL_controller/menu.js";
import * as inventoryController from "../SQL_controller/inventory.js";
import * as suggestionController from "../SQL_controller/suggestion.js";
import { calculateRestockSuggestions } from "../methods/suggestion_calculator.js";
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
  } else if (text === "確認庫存") {
    message = await handleInventoryReport();
  } else if (text === "自動進貨") {
    message = await handleRestockList();
  } else {
    let replyText;
    if (text === "補貨") replyText = await handleRestock();
    else if (text === "權限註冊") replyText = await handleRegister(lineUserId);
    else {
      message = await handleCommandList();
    }

    if (replyText) {
      message = {
        type: "text",
        text: replyText,
      };
    }
  }

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [message],
  });
}

async function handleInventoryReport() {
  const stockData = await inventoryController.getAllStock();
  const reportItems = stockData.filter((item) => item.max_stock_qty > 0);

  if (reportItems.length === 0) {
    return {
      type: "text",
      text: "目前沒有設定最大庫存量的品項可供報告。",
    };
  }

  // LINE carousel has a limit of 12 bubbles.
  const bubbles = reportItems.slice(0, 12).map((item) => {
    const total_stock = item.total_stock;
    const max_stock_qty = parseFloat(item.max_stock_qty);
    const percentage =
      max_stock_qty > 0 ? Math.round((total_stock / max_stock_qty) * 100) : 0;

    let barColor = "#905c44"; // Default color
    if (percentage < 20) {
      barColor = "#FF6B6E"; // Red
    } else if (percentage < 50) {
      barColor = "#FFD166"; // Yellow
    }

    // Ensure percentage for width is between 0 and 100
    const barWidth = Math.min(Math.max(percentage, 0), 100);

    return {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: item.material_name,
            weight: "bold",
            size: "lg",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "庫存量",
                flex: 3,
                size: "sm",
                color: "#555555",
              },
              {
                type: "text",
                text: `${total_stock} / ${max_stock_qty}`,
                flex: 7,
                size: "sm",
                align: "end",
                color: "#111111",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            height: "20px",
            backgroundColor: "#E0E0E0",
            cornerRadius: "10px",
            contents: [
              {
                type: "box",
                layout: "vertical",
                height: "100%",
                width: `${barWidth}%`,
                backgroundColor: barColor,
                cornerRadius: "10px",
                contents: [{ type: "filler" }],
              },
            ],
          },
          {
            type: "text",
            text: `${percentage}%`,
            size: "md",
            weight: "bold",
            align: "center",
            color: barColor,
          },
        ],
      },
    };
  });

  return {
    type: "flex",
    altText: "這是一份庫存報告",
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
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

async function handleRestockList() {
  const materialStats = await suggestionController.getMaterialStats();
  const allSuggestions = calculateRestockSuggestions(materialStats, {
    consumptionThresholdPercent: 0.15,
    criticalStockPercent: 0.10,
    safetyStockPercent: 0.25,
  });

  const toRestock = allSuggestions.filter(s => s.suggestion > 0);

  if (toRestock.length === 0) {
    return {
      type: "flex",
      altText: "無需補貨",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "✅ 庫存充足",
              weight: "bold",
              size: "xl",
              margin: "md",
              align: "center",
            },
            {
              type: "text",
              text: "所有品項庫存水位良好，或近期消耗量低，無需補充。",
              align: "center",
              wrap: true,
              margin: "md",
              color: "#666666"
            }
          ]
        }
      }
    };
  }

  const bubbles = toRestock.slice(0, 12).map(item => {
    const reasonComponents = item.reasons.map(reason => ({
      type: "box",
      layout: "baseline",
      spacing: "sm",
      contents: [
        {
          type: "icon",
          url: reason.effect.includes('+') ? "https://i.imgur.com/7Q4B3zV.png" : "https://i.imgur.com/b2a4mS4.png", // Green up, Red down
          size: "sm"
        },
        {
          type: "text",
          text: reason.text,
          color: "#888888",
          size: "sm",
          flex: 4
        },
        {
          type: "text",
          text: reason.effect,
          color: "#888888",
          size: "sm",
          align: "end",
          flex: 2
        }
      ]
    }));

    return {
      type: "bubble",
      size: "giga",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: item.material_name,
            weight: "bold",
            size: "xl",
          }
        ]
      },
      hero: {
        type: "box",
        layout: "vertical",
        paddingAll: "lg",
        contents: [
          {
            type: "text",
            text: "建議補充",
            align: "center",
            size: "lg",
            color: "#555555"
          },
          {
            type: "box",
            layout: "baseline",
            alignItems: "center",
            justifyContent: "center",
            contents: [
              {
                type: "text",
                text: `${item.suggestion}`,
                weight: "bold",
                size: "4xl",
                color: "#905c44"
              },
              {
                type: "text",
                text: "單位",
                margin: "md",
                size: "lg",
                color: "#AAAAAA"
              }
            ]
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "計算依據",
            weight: "bold",
            color: "#AAAAAA",
            size: "sm"
          },
          {
            type: "separator"
          },
          ...reasonComponents
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "text",
            text: `目前庫存: ${item.total_stock} / ${item.max_stock_qty}`,
            align: "center",
            margin: "md",
            color: "#888888",
            size: "sm"
          }
        ]
      }
    };
  });

  return {
    type: "flex",
    altText: "智能補貨建議清單",
    contents: {
      type: "carousel",
      contents: bubbles
    }
  };
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

