import express from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import * as logger from "../methods/logger.js";
import * as orderController from "../SQL_controller/order.js";
import { generateQRCode } from "../methods/QR_code_generate.js";

const router = express.Router();
const cacheDir = path.resolve(process.cwd(), "cache");
const cacheFile = path.join(cacheDir, "order.json");

router.post("/", async (req, res) => {
  const requestUUID = crypto.randomUUID();
  const orderItems = req.body;

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return res.status(400).json({ msg: "訂單格式錯誤，請提供品項陣列" });
  }

  try {
    const processedItems = await orderController.createOrder(orderItems);

    const qrcodes = [];
    for (const item of processedItems) {
      const payload = {
        productId: item.productId,
        detailId: item.detailId,
        requestUUID: requestUUID,
        materials: item.materialRequirements,
      };
      const qrCodeBase64 = await generateQRCode(payload);
      qrcodes.push({
        detailId: item.detailId,
        qrcode: qrCodeBase64,
      });
    }

    // 緩存處理
    let cacheData = [];
    try {
      const fileContent = await fs.readFile(cacheFile, "utf-8");
      cacheData = JSON.parse(fileContent);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error; // re-throw if it's not a "file not found" error
      }
      // 如果文件不存在，cacheData 保持為空陣列
    }

    cacheData.push({
      requestUUID,
      createdAt: new Date().toISOString(),
      qrcodes,
    });

    await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));

    res.status(201).json({ requestUUID, qrcodes });
  } catch (error) {
    if (error.isStockError) {
      logger.warn(`庫存不足: ${error.message}`, "OrderAPI", req.ip);
      return res
        .status(400)
        .json({ msg: error.message, productId: error.productId });
    }
    logger.error(error, req, "OrderAPI");
    res.status(500).json({ msg: "創建訂單時發生內部錯誤" });
  }
});

router.patch("/:detailId", async (req, res) => {
    const { detailId } = req.params;
    const { status, requestUUID } = req.body;

    if (typeof status !== 'boolean' || !requestUUID) {
        return res.status(400).json({ msg: "請求格式錯誤，需要布林值的 status 和 requestUUID" });
    }

    try {
        await orderController.updateOrderStatus(parseInt(detailId, 10), status);

        // 更新緩存
        try {
            const fileContent = await fs.readFile(cacheFile, "utf-8");
            let cacheData = JSON.parse(fileContent);

            const requestIndex = cacheData.findIndex(req => req.requestUUID === requestUUID);
            
            if (requestIndex > -1) {
                // 過濾掉已處理的 detailId
                cacheData[requestIndex].qrcodes = cacheData[requestIndex].qrcodes.filter(
                    qr => qr.detailId !== parseInt(detailId, 10)
                );

                // 如果 qrcodes 陣列為空，則移除整個 request 物件
                if (cacheData[requestIndex].qrcodes.length === 0) {
                    cacheData.splice(requestIndex, 1);
                }
            }
            
            await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));

        } catch (cacheError) {
            // 如果緩存操作失敗，只記錄錯誤，不影響主流程
            logger.error(cacheError, req, "OrderCacheUpdate");
        }

        res.status(200).json({ msg: `訂單 #${detailId} 狀態已更新`});

    } catch (error) {
        logger.error(error, req, "OrderAPI");
        res.status(500).json({ msg: "更新訂單時發生內部錯誤" });
    }
});

router.get("/cache", async (req, res) => {
    try {
        const fileContent = await fs.readFile(cacheFile, "utf-8");
        const cacheData = JSON.parse(fileContent);
        res.status(200).json(cacheData);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // 如果檔案不存在，回傳空陣列
            return res.status(200).json([]);
        }
        logger.error(error, req, "OrderCacheRead");
        res.status(500).json({ msg: "讀取緩存時發生錯誤" });
    }
});

export default router;
