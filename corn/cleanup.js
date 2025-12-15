import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as logger from "../methods/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 快取目錄的路徑
const cacheDir = path.join(__dirname, "../cache");
// 檔案最大存留時間 (45 分鐘)
const MAX_AGE = 45 * 60 * 1000; // 45 分鐘的毫秒數

/**
 * 清理過期的快取檔案
 */
function cleanupCache() {
  // logger.info('開始執行快取清理...', 'Corn');
  fs.readdir(cacheDir, (err, files) => {
    if (err) {
      logger.error({ msg: "讀取快取目錄時發生錯誤", err }, null, "Corn");
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(cacheDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          logger.error(
            { msg: `無法取得檔案 ${file} 的資訊`, err },
            null,
            "Corn"
          );
          return;
        }

        const now = new Date().getTime();
        const fileAge = now - stats.mtime.getTime();

        if (fileAge > MAX_AGE) {
          fs.unlink(filePath, (err) => {
            if (err) {
              logger.error(
                { msg: `刪除檔案 ${file} 時發生錯誤`, err },
                null,
                "Corn"
              );
            } else {
              logger.info(`已刪除過期的快取檔案: ${file}`, "Corn");
            }
          });
        }
      });
    });
  });
}

/**
 * 啟動快取清理排程
 */
function start() {
  // 每 30 秒執行一次清理函式
  setInterval(cleanupCache, 30 * 1000);
  logger.info("快取清理服務已啟動，每 30 秒執行一次。", "Corn");
}

export { start };
