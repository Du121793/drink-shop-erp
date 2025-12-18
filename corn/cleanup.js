import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as logger from "../methods/logger.js";
import { updateOrderStatus } from "../SQL_controller/order.js";
import { QR_CODE_TTL_MS } from "../config/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cacheDir = path.join(__dirname, "../cache");
const cacheFile = path.join(cacheDir, "order.json");

/**
 * 回收超時未處理的訂單 QR：退回庫存並從快取移除
 */
async function cleanupExpiredOrders() {
  try {
    const raw = await fsPromises.readFile(cacheFile, "utf-8");
    const cacheData = JSON.parse(raw);
    if (!Array.isArray(cacheData) || cacheData.length === 0) return;

    const now = Date.now();
    const remaining = [];

    for (const request of cacheData) {
      const createdAtMs = Date.parse(request.createdAt || request.created_at);
      const expiresAtMs = request.expiresAt
        ? Date.parse(request.expiresAt)
        : Number.isFinite(createdAtMs)
        ? createdAtMs + QR_CODE_TTL_MS
        : NaN;
      const isExpired = Number.isFinite(expiresAtMs) ? now >= expiresAtMs : false;

      if (!isExpired) {
        remaining.push(request);
        continue;
      }

      let failed = false;
      const qrcodes = Array.isArray(request.qrcodes) ? request.qrcodes : [];

      for (const qr of qrcodes) {
        const detailId = qr?.detailId ?? qr?.detail_id;
        if (!detailId) continue;
        try {
          await updateOrderStatus(Number(detailId), false, true);
          logger.info(
            `Expired QR detail #${detailId} rolled back (UUID ${request.requestUUID || "unknown"})`,
            "Corn"
          );
        } catch (err) {
          failed = true;
          err.msg = `超時 QR detail #${detailId} 回收庫存失敗`;
          logger.error(err, null, "Corn");
        }
      }

      if (failed) {
        // 保留資料，下一輪再嘗試，避免遺漏
        remaining.push(request);
      } else {
        logger.info(
          `Expired request ${request.requestUUID || "unknown"} cleaned and stock returned`,
          "Corn"
        );
      }
    }

    await fsPromises.writeFile(cacheFile, JSON.stringify(remaining, null, 2));
  } catch (err) {
    if (err.code === "ENOENT") return; // 尚未有快取檔
    err.msg = "清理過期 QR cache 時發生錯誤";
    logger.error(err, null, "Corn");
  }
}

/**
 * 清除其他超過 TTL 的快取檔案
 */
async function cleanupStaleFiles() {
  try {
    const files = await fsPromises.readdir(cacheDir);
    const now = Date.now();
    for (const file of files) {
      if (file === "order.json") continue;
      const filePath = path.join(cacheDir, file);
      const stats = await fsPromises.stat(filePath);
      if (!stats.isFile()) continue;
      const age = now - stats.mtime.getTime();
      if (age > QR_CODE_TTL_MS) {
        await fsPromises.unlink(filePath);
        logger.info(`已刪除過期快取檔案: ${file}`, "Corn");
      }
    }
  } catch (err) {
    if (err.code === "ENOENT") return;
    err.msg = "清理快取檔案時發生錯誤";
    logger.error(err, null, "Corn");
  }
}

async function cleanupCache() {
  await fsPromises.mkdir(cacheDir, { recursive: true });
  await Promise.allSettled([cleanupExpiredOrders(), cleanupStaleFiles()]);
}

/**
 * 啟動快取清理排程
 */
function start() {
  const run = () =>
    cleanupCache().catch((err) => {
      err.msg = "快取清理排程執行失敗";
      logger.error(err, null, "Corn");
    });

  run();
  setInterval(run, 30 * 1000);
  logger.info("快取清理排程已啟動，每30秒執行一次。", "Corn");
}

export { start };
