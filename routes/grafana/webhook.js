import express from "express";
import dotenv from "dotenv";
import * as line from "@line/bot-sdk";
import * as logger from "../../methods/logger.js";
import * as permissionController from "../../SQL_controller/permission.js";

dotenv.config();

const router = express.Router();

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const ADMIN_PERMISSION_LEVEL = 5;
const PRIMARY_COLOR = "#905c44";
const ACCENT_COLOR = "#73432f";
const BUBBLE_BG_COLOR = "#f7f3ed";
const TEXT_COLOR = "#1b1b1b";
const SUBTEXT_COLOR = "#4a4a4a";
const WARN_COLOR = "#d97706";
const DANGER_COLOR = "#c81e1e";

router.post("/", async (req, res) => {
  try {
    const payload = req.body || {};
    const status = String(
      payload?.status || payload?.state || ""
    ).toLowerCase();

    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      logger.error(
        new Error("缺少 LINE Channel Access Token"),
        req,
        "GrafanaWebhook"
      );
      return res
        .status(500)
        .json({ error: "伺服器未設定 LINE Channel Access Token" });
    }

    // 僅處理 firing 告警，避免已恢復狀態重複推播
    if (status && status !== "firing") {
      logger.info(`Grafana webhook 已忽略，status=${status}`, "GrafanaWebhook");
      return res.status(200).json({ message: "已忽略（非 firing 狀態）" });
    }

    const alertType = payload?.commonLabels?.alert_type;
    if (alertType !== "stock_pct" && alertType !== "stock_exp") {
      logger.warn(
        `不支援的 grafana alert_type=${alertType || "unknown"}`,
        "GrafanaWebhook"
      );
      return res.status(200).json({ message: "已忽略（不支援的 alert_type）" });
    }

    const alertInfos = parseStockAlertPayload(payload);
    if (!alertInfos || alertInfos.length === 0) {
      return res.status(400).json({ error: "告警內容無效" });
    }

    const admins = await permissionController.getEmployeesByPermissionLevel(
      ADMIN_PERMISSION_LEVEL
    );
    const adminLineIds = admins.map((a) => a.line_id).filter(Boolean);

    if (adminLineIds.length === 0) {
      logger.warn("找不到可推播的管理員帳號", "GrafanaWebhook");
      return res.status(200).json({ message: "目前沒有管理員訂閱者" });
    }

    let delivered = 0;
    for (const alertInfo of alertInfos) {
      const flexMessage = buildStockAlertFlex(alertInfo);
      const results = await Promise.all(
        adminLineIds.map(async (lineId) => {
          try {
            await lineClient.pushMessage({
              to: lineId,
              messages: [flexMessage],
            });
            return { lineId, ok: true };
          } catch (error) {
            error.msg = `推播至管理員 ${lineId} 失敗`;
            logger.error(error, null, "GrafanaWebhook");
            return { lineId, ok: false };
          }
        })
      );
      delivered += results.filter((r) => r.ok).length;
    }

    logger.info(
      `Grafana 告警已推播 ${delivered}/${
        adminLineIds.length * alertInfos.length
      } 則`,
      "GrafanaWebhook"
    );
    res
      .status(200)
      .json({
        delivered,
        admins: adminLineIds.length,
        alerts: alertInfos.length,
      });
  } catch (err) {
    err.msg = "Grafana webhook 處理失敗";
    logger.error(err, req, "GrafanaWebhook");
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

// 未匹配的子路由
router.use((req, res) => {
  res.status(404).json({ error: "未知的 Grafana webhook 路徑" });
});

function parseStockAlertPayload(payload) {
  try {
    const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
    const firingAlerts = alerts.filter(
      (a) => String(a?.status || "").toLowerCase() === "firing"
    );
    if (firingAlerts.length === 0) return [];

    return firingAlerts.map((alert) => {
      const labels = alert.labels || {};
      const annotations = alert.annotations || {};
      const alertType =
        labels.alert_type || payload?.commonLabels?.alert_type || "";
      const level = String(labels.level || payload?.commonLabels?.level || "")
        .trim()
        .toUpperCase();
      const labelName =
        labels.label ||
        payload?.commonLabels?.label ||
        labels.alertname ||
        "未知原料";
      const summary =
        annotations.summary ||
        payload?.commonAnnotations?.summary ||
        labels.alertname ||
        payload?.title ||
        "庫存警告";

      const generatorURL = alert.generatorURL || alert.generatorUrl;
      const dashboardURL =
        alert.dashboardURL ||
        alert.dashboardUrl ||
        payload?.externalURL ||
        payload?.externalUrl;
      const panelURL = alert.panelURL || alert.panelUrl;
      const silenceURL = alert.silenceURL || alert.silenceUrl;
      const startsAt = alert.startsAt || alert.starts_at;
      const valueString =
        alert.valueString ||
        payload?.message ||
        (alert.values ? JSON.stringify(alert.values) : undefined);

      return {
        level,
        alertType,
        labelName,
        summary,
        startsAt,
        generatorURL,
        dashboardURL,
        panelURL,
        silenceURL,
        valueString,
      };
    });
  } catch (error) {
    logger.error(error, null, "GrafanaParse");
    return [];
  }
}

function getStockLevelMeta(alertType, level) {
  const upper = String(level || "").toUpperCase();

  const pctMap = {
    A: {
      title: "A 級 - 低於 20%",
      description: "庫存低於 20%，請安排補貨。",
      color: WARN_COLOR,
      typeLabel: "庫存警告",
    },
    B: {
      title: "B 級 - 低於 10%",
      description: "庫存低於 10%，請盡快補貨。",
      color: WARN_COLOR,
      typeLabel: "庫存警告",
    },
    C: {
      title: "C 級 - 庫存耗盡",
      description: "庫存為 0，請立即補貨或暫停販售。",
      color: DANGER_COLOR,
      typeLabel: "庫存警告",
    },
  };

  const expMap = {
    A: {
      title: "A 級 - 三天內到期",
      description: "效期三天內，請優先使用或處理。",
      color: WARN_COLOR,
      typeLabel: "效期警告",
    },
    B: {
      title: "B 級 - 一天內到期",
      description: "效期一天內，請立即處理或下架。",
      color: DANGER_COLOR,
      typeLabel: "效期警告",
    },
  };

  const map = alertType === "stock_exp" ? expMap : pctMap;
  const fallbackLabel = alertType === "stock_exp" ? "效期警告" : "庫存警告";

  return (
    map[upper] || {
      title: `${upper || "未知"} 級`,
      description: "未定義的告警等級，請檢查 Grafana 設定。",
      color: ACCENT_COLOR,
      typeLabel: fallbackLabel,
    }
  );
}

function formatTimestamp(ts) {
  if (!ts) return "未知時間";
  const date = new Date(ts);
  if (isNaN(date.getTime())) return "未知時間";
  return date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

function buildStockAlertFlex(info) {
  const levelMeta = getStockLevelMeta(info.alertType, info.level);
  const altText = `${levelMeta.typeLabel} - ${info.labelName} (${levelMeta.title})`;

  const footerButtons = [];
  if (info.panelURL) {
    footerButtons.push({
      type: "button",
      style: "primary",
      height: "sm",
      color: PRIMARY_COLOR,
      action: { type: "uri", label: "查看面板", uri: info.panelURL },
    });
  } else if (info.dashboardURL) {
    footerButtons.push({
      type: "button",
      style: "primary",
      height: "sm",
      color: PRIMARY_COLOR,
      action: { type: "uri", label: "查看儀表板", uri: info.dashboardURL },
    });
  }
  if (info.silenceURL) {
    footerButtons.push({
      type: "button",
      style: "secondary",
      height: "sm",
      color: "#ffffff",
      action: { type: "uri", label: "暫停此告警", uri: info.silenceURL },
    });
  }

  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "mega",
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
            text: levelMeta.typeLabel,
            weight: "bold",
            size: "lg",
            color: TEXT_COLOR,
          },
          {
            type: "text",
            text: levelMeta.title,
            size: "sm",
            color: levelMeta.color,
            weight: "bold",
            margin: "sm",
          },
          {
            type: "text",
            text: info.summary,
            size: "sm",
            color: SUBTEXT_COLOR,
            wrap: true,
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
                text: "原料",
                color: SUBTEXT_COLOR,
                flex: 2,
                size: "sm",
              },
              {
                type: "text",
                text: info.labelName,
                color: TEXT_COLOR,
                flex: 5,
                weight: "bold",
                size: "md",
                wrap: true,
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "等級",
                color: SUBTEXT_COLOR,
                flex: 2,
                size: "sm",
              },
              {
                type: "text",
                text: levelMeta.description,
                color: levelMeta.color,
                flex: 5,
                size: "sm",
                wrap: true,
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "觸發時間",
                color: SUBTEXT_COLOR,
                flex: 2,
                size: "sm",
              },
              {
                type: "text",
                text: formatTimestamp(info.startsAt),
                color: TEXT_COLOR,
                flex: 5,
                size: "sm",
                wrap: true,
              },
            ],
          },
          info.generatorURL
            ? {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "來源",
                    color: SUBTEXT_COLOR,
                    flex: 2,
                    size: "sm",
                  },
                  {
                    type: "text",
                    text: info.generatorURL,
                    color: PRIMARY_COLOR,
                    flex: 5,
                    size: "sm",
                    wrap: true,
                  },
                ],
              }
            : null,
        ].filter(Boolean),
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents:
          footerButtons.length > 0
            ? footerButtons
            : [
                {
                  type: "text",
                  text: "未提供 Grafana 連結",
                  color: SUBTEXT_COLOR,
                  size: "xs",
                  align: "center",
                },
              ],
      },
    },
  };
}

export default router;
