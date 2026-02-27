import * as menuController from "../../SQL_controller/menu.js";
import * as inventoryController from "../../SQL_controller/inventory.js";
import * as suggestionController from "../../SQL_controller/suggestion.js";
import { calculateRestockSuggestionsByRules } from "../../methods/restock_rules/engine.js";
import * as JWTIssue from "../../methods/JWT_issue.js";
import * as permissionController from "../../SQL_controller/permission.js";

const LIFF_ADMIN_URL = process.env.LINE_LIFF_URL || "";
const PRIMARY_COLOR = "#905c44"; // 參考 a.txt 的深棕色
const ACCENT_COLOR = "#73432f"; // 深色點綴
const SECONDARY_COLOR = "#f2f2f2"; // 灰底，搭配深色文字
const TEXT_COLOR = "#1b1b1b";
const SUBTEXT_COLOR = "#4a4a4a";
const MUTED_TEXT_COLOR = "#6e6e6e";
const PROGRESS_BG_COLOR = "#efe7dd";
const BUBBLE_BG_COLOR = "#f7f3ed";
const INIT_MODE = (process.env.INIT || "false").toLowerCase() === "true";

export async function handleCommandList() {
  const buttons = [
    { label: "菜單", text: "菜單" },
    { label: "確認庫存", text: "確認庫存" },
    { label: "補貨建議", text: "補貨建議" },
    { label: "補貨", text: "補貨" },
    { label: "權限註冊", text: "權限註冊" },
  ].map((b) => ({
    type: "button",
    style: "primary",
    height: "sm",
    action: { type: "message", label: b.label, text: b.text },
    color: PRIMARY_COLOR,
  }));

  if (LIFF_ADMIN_URL) {
    buttons.push({
      type: "button",
      style: "primary",
      height: "sm",
      action: { type: "uri", label: "管控後台", uri: LIFF_ADMIN_URL },
      color: ACCENT_COLOR,
    });
  }

  return {
    type: "flex",
    altText: "常用指令",
    contents: {
      type: "bubble",
      size: "mega",
      styles: {
        header: { backgroundColor: BUBBLE_BG_COLOR },
        body: { backgroundColor: BUBBLE_BG_COLOR },
        footer: { backgroundColor: BUBBLE_BG_COLOR },
      },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "常用指令",
            weight: "bold",
            size: "xl",
            color: TEXT_COLOR,
          },
        ],
        paddingBottom: "md",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "· 查看菜單 / 價格",
            wrap: true,
            color: TEXT_COLOR,
          },
          {
            type: "text",
            text: "· 確認庫存：拉出即時庫存條",
            wrap: true,
            color: TEXT_COLOR,
          },
          {
            type: "text",
            text: "· 補貨建議：自動計算需要補貨的項目",
            wrap: true,
            color: TEXT_COLOR,
          },
          {
            type: "text",
            text: "· 補貨：開啟後台補貨流程",
            wrap: true,
            color: TEXT_COLOR,
          },
          {
            type: "text",
            text: "· 權限註冊：取得註冊連結",
            wrap: true,
            color: TEXT_COLOR,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          ...buttons,
          {
            type: "button",
            style: "secondary",
            height: "sm",
            color: SECONDARY_COLOR,
            action: { type: "message", label: "回到指令選單", text: "指令" },
          },
        ],
      },
    },
  };
}

export async function handleMenu() {
  const menuItems = await menuController.getMenus();

  if (menuItems.length === 0) {
    return { type: "text", text: "很抱歉，目前沒有可顯示的菜單項目。" };
  }

  const bubbles = menuItems.slice(0, 12).map((item) => {
    const bubble = {
      type: "bubble",
      size: "micro",
      styles: {
        header: { backgroundColor: BUBBLE_BG_COLOR },
        body: { backgroundColor: "#ffffff" },
        footer: { backgroundColor: BUBBLE_BG_COLOR },
      },
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
            color: TEXT_COLOR,
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
                text: "售價",
                color: SUBTEXT_COLOR,
                size: "sm",
                flex: 2,
              },
              {
                type: "text",
                text: `$${item.price}`,
                color: TEXT_COLOR,
                size: "sm",
                flex: 5,
                wrap: true,
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
                color: SUBTEXT_COLOR,
                size: "sm",
                flex: 2,
              },
              {
                type: "text",
                text: item.isAvailable ? "可販售" : "已售罄",
                color: item.isAvailable ? "#1DB446" : "#FF6B6E",
                size: "sm",
                flex: 5,
                wrap: true,
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          ...(LIFF_ADMIN_URL
            ? [
                {
                  type: "button",
                  style: "primary",
                  height: "sm",
                  action: {
                    type: "uri",
                    label: "管理菜單",
                    uri: `${LIFF_ADMIN_URL}#/menu/items`,
                  },
                  color: ACCENT_COLOR,
                },
              ]
            : []),
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "message", label: "回到指令選單", text: "指令" },
            color: SECONDARY_COLOR,
            margin: "sm",
          },
        ],
        flex: 0,
      },
    };

    return bubble;
  });

  return {
    type: "flex",
    altText: "這是我們的菜單",
    contents: { type: "carousel", contents: bubbles },
  };
}

export async function handleInventoryReport() {
  const stockData = await inventoryController.getAllStock();
  const reportItems = stockData.filter((item) => item.max_stock_qty > 0);

  if (reportItems.length === 0) {
    return { type: "text", text: "尚未設定最大庫存，無法提供庫存報表。" };
  }

  const bubbles = reportItems.slice(0, 12).map((item) => {
    const total_stock = item.total_stock;
    const max_stock_qty = parseFloat(item.max_stock_qty);
    const percentage =
      max_stock_qty > 0 ? Math.round((total_stock / max_stock_qty) * 100) : 0;
    let barColor = PRIMARY_COLOR;
    if (percentage < 20) barColor = "#FF6B6E";
    else if (percentage < 50) barColor = "#FFD166";
    const barWidth = Math.min(Math.max(percentage, 0), 100);

    return {
      type: "bubble",
      size: "kilo",
      styles: {
        header: { backgroundColor: BUBBLE_BG_COLOR },
        body: { backgroundColor: "#ffffff" },
        footer: { backgroundColor: BUBBLE_BG_COLOR },
      },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: item.material_name,
            weight: "bold",
            size: "lg",
            color: TEXT_COLOR,
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
                text: "庫存",
                weight: "bold",
                color: TEXT_COLOR,
                flex: 2,
              },
              {
                type: "text",
                text: `${total_stock}`,
                weight: "bold",
                color: TEXT_COLOR,
                flex: 1,
                align: "end",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: `庫存比例 ${percentage}%`,
                color: SUBTEXT_COLOR,
                size: "sm",
              },
              {
                type: "box",
                layout: "vertical",
                height: "12px",
                backgroundColor: PROGRESS_BG_COLOR,
                cornerRadius: "xl",
                contents: [
                  {
                    type: "box",
                    layout: "vertical",
                    height: "12px",
                    width: `${barWidth}%`,
                    backgroundColor: barColor,
                    cornerRadius: "xl",
                    contents: [],
                  },
                ],
              },
              {
                type: "text",
                text: `最大庫存 ${max_stock_qty}`,
                color: MUTED_TEXT_COLOR,
                size: "sm",
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          ...(LIFF_ADMIN_URL
            ? [
                {
                  type: "button",
                  style: "primary",
                  height: "sm",
                  action: {
                    type: "uri",
                    label: "打開庫存管理",
                    uri: `${LIFF_ADMIN_URL}#/inventory/restock`,
                  },
                  color: ACCENT_COLOR,
                },
              ]
            : []),
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "message", label: "回到指令選單", text: "指令" },
            color: SECONDARY_COLOR,
            margin: "sm",
          },
        ],
      },
    };
  });

  return {
    type: "flex",
    altText: "庫存報表",
    contents: { type: "carousel", contents: bubbles },
  };
}

export async function handleRestockList() {
  const materialStats = await suggestionController.getMaterialStats();
  const allSuggestions = await calculateRestockSuggestionsByRules(materialStats);

  const toRestock = allSuggestions.filter((s) => s.suggestion > 0);

  if (toRestock.length === 0) {
    return {
      type: "flex",
      altText: "目前庫存充足",
      contents: {
        type: "bubble",
        styles: {
          body: { backgroundColor: BUBBLE_BG_COLOR },
          footer: { backgroundColor: BUBBLE_BG_COLOR },
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "目前庫存充足",
              weight: "bold",
              size: "xl",
              margin: "md",
              align: "center",
              color: TEXT_COLOR,
            },
            {
              type: "text",
              text: "所有品項水位正常，暫時不需要補貨。",
              align: "center",
              wrap: true,
              margin: "md",
              color: SUBTEXT_COLOR,
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            ...(LIFF_ADMIN_URL
              ? [
                  {
                    type: "button",
                    style: "primary",
                    action: {
                      type: "uri",
                      label: "打開補貨建議清單",
                      uri: `${LIFF_ADMIN_URL}#/inventory/suggestions`,
                    },
                    color: ACCENT_COLOR,
                  },
                ]
              : []),
            {
              type: "button",
              style: "secondary",
              height: "sm",
              color: SECONDARY_COLOR,
              action: { type: "message", label: "回到指令選單", text: "指令" },
            },
          ],
        },
      },
    };
  }

  const bubbles = toRestock.slice(0, 12).map((item) => {
    const reasonComponents = item.reasons.map((reason) => ({
      type: "box",
      layout: "baseline",
      spacing: "sm",
      contents: [
        {
          type: "icon",
          url: reason.effect.includes("+")
            ? "https://i.imgur.com/7Q4B3zV.png"
            : "https://i.imgur.com/b2a4mS4.png",
          size: "sm",
        },
        {
          type: "text",
          text: reason.text,
          color: SUBTEXT_COLOR,
          size: "sm",
          flex: 4,
          wrap: true,
        },
        {
          type: "text",
          text: reason.effect,
          size: "sm",
          color: reason.effect.includes("+") ? "#1DB446" : "#d9534f",
          align: "end",
        },
      ],
    }));

    return {
      type: "bubble",
      size: "kilo",
      styles: {
        header: { backgroundColor: BUBBLE_BG_COLOR },
        hero: { backgroundColor: BUBBLE_BG_COLOR },
        footer: { backgroundColor: BUBBLE_BG_COLOR },
      },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: item.material_name,
            weight: "bold",
            size: "lg",
            color: TEXT_COLOR,
          },
          {
            type: "text",
            text: "自動補貨建議",
            size: "sm",
            color: SUBTEXT_COLOR,
          },
        ],
      },
      hero: {
        type: "box",
        layout: "vertical",
        paddingAll: "lg",
        contents: [
          {
            type: "text",
            text: "建議補貨",
            align: "center",
            size: "md",
            color: SUBTEXT_COLOR,
          },
          {
            type: "text",
            text: `${item.suggestion}`,
            align: "center",
            size: "4xl",
            weight: "bold",
            color: PRIMARY_COLOR,
          },
          {
            type: "text",
            text: "單位",
            align: "center",
            size: "xs",
            color: MUTED_TEXT_COLOR,
          },
        ],
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
            size: "sm",
            color: SUBTEXT_COLOR,
          },
          { type: "separator", margin: "xs" },
          ...reasonComponents,
        ],
      },
      footer: {
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
                text: "目前庫存",
                color: TEXT_COLOR,
                size: "sm",
                flex: 3,
              },
              {
                type: "text",
                text: `${item.total_stock} / ${item.max_stock_qty}`,
                color: TEXT_COLOR,
                size: "sm",
                align: "end",
                flex: 4,
              },
            ],
          },
          ...(LIFF_ADMIN_URL
            ? [
                {
                  type: "button",
                  style: "primary",
                  height: "sm",
                  action: {
                    type: "uri",
                    label: "打開補貨建議清單",
                    uri: `${LIFF_ADMIN_URL}#/inventory/suggestions`,
                  },
                  color: ACCENT_COLOR,
                },
              ]
            : []),
          {
            type: "button",
            style: "secondary",
            height: "sm",
            color: SECONDARY_COLOR,
            action: { type: "message", label: "回到指令選單", text: "指令" },
          },
        ],
      },
    };
  });

  return {
    type: "flex",
    altText: "自動補貨建議",
    contents: { type: "carousel", contents: bubbles },
  };
}

export async function handleRestock() {
  if (!LIFF_ADMIN_URL) {
    return "歡迎來到補貨功能，請輸入指令或用指令選單開啟 LIFF 後台頁面。";
  }
  return {
    type: "template",
    altText: "補貨",
    template: {
      type: "buttons",
      title: "補貨",
      text: "前往後台補貨頁面",
      actions: [
        {
          type: "uri",
          label: "打開補貨",
          uri: `${LIFF_ADMIN_URL}#/inventory/restock`,
        },
        { type: "message", label: "回到指令選單", text: "指令" },
      ],
    },
  };
}

export async function handleRegister(lineUserId) {
  if (INIT_MODE) {
    try {
      const roles = await permissionController.getRoles();
      const adminRole = roles.find((r) => r.permission_level === 5);
      if (!adminRole) {
        return {
          type: "text",
          text: "初始化模式找不到管理員角色，請稍後再試。",
        };
      }
      await permissionController.ensureEmployee(lineUserId, null);
      await permissionController.setEmployeeRoles(lineUserId, [
        adminRole.role_id,
      ]);
      return {
        type: "text",
        text: "初始化模式：已設定為管理員，請重新刷新進入後台頁面。",
      };
    } catch (e) {
      return { type: "text", text: "初始化註冊失敗，請稍後再試。" };
    }
  }

  const token = (await JWTIssue.issueRegToken(lineUserId)).toString();
  return { type: "text", text: `註冊連結：${token}` };
}
