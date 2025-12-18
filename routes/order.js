import express from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import * as logger from "../methods/logger.js";
import * as orderController from "../SQL_controller/order.js";
import { generateQRCode } from "../methods/QR_code_generate.js";
import { QR_CODE_TTL_MS } from "../config/constants.js";

const router = express.Router();
const cacheDir = path.resolve(process.cwd(), "cache");
const cacheFile = path.join(cacheDir, "order.json");

// 建立訂單：檢查上架與庫存，產生 QR 並寫入緩存
router.post("/", async (req, res) => {
  const requestUUID = crypto.randomUUID();
  const orderItems = req.body;

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return res.status(400).json({ msg: "訂單內容格式錯誤，請提供品項" });
  }

  try {
    const processedItems = await orderController.createOrder(orderItems);
    const expiresAt = new Date(Date.now() + QR_CODE_TTL_MS).toISOString();

    const qrcodes = [];
    for (const item of processedItems) {
      const payload = {
        productId: item.productId,
        detailId: item.detailId,
        productName: item.productName,
        requestUUID,
        materials: item.materialRequirements,
      };
      const qrCodeBase64 = await generateQRCode(payload);
      qrcodes.push({
        detailId: item.detailId,
        productId: item.productId,
        productName: item.productName,
        expiresAt,
        qrcode: qrCodeBase64,
      });
    }

    let cacheData = [];
    try {
      const fileContent = await fs.readFile(cacheFile, "utf-8");
      cacheData = JSON.parse(fileContent);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    cacheData.push({
      requestUUID,
      createdAt: new Date().toISOString(),
      expiresAt,
      qrcodes,
    });

    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));

    res.status(201).json({ requestUUID, qrcodes });
  } catch (error) {
    if (error.isStockError) {
      logger.warn(`庫存不足: ${error.message}`, "OrderAPI", req.ip);
      return res
        .status(400)
        .json({ msg: error.message, productId: error.productId });
    }
    if (error.isActiveError) {
      logger.warn(error.message, "OrderAPI", req.ip);
      return res
        .status(400)
        .json({ msg: error.message, productId: error.productId });
    }
    logger.error(error, req, "OrderAPI");
    res.status(500).json({ msg: "建立訂單時發生內部錯誤" });
  }
});

// 更新訂單狀態：status=true 完成；status=false 取消；refund=true 取消並退還庫存
router.patch("/:detailId", async (req, res) => {
  const { detailId } = req.params;
  const { status, requestUUID, refund } = req.body;

  if (typeof status !== "boolean" || !requestUUID) {
    return res
      .status(400)
      .json({ msg: "請確認數據格式，缺少 status 或 requestUUID" });
  }

  try {
    await orderController.updateOrderStatus(
      parseInt(detailId, 10),
      status,
      refund === true
    );

    try {
      const fileContent = await fs.readFile(cacheFile, "utf-8");
      let cacheData = JSON.parse(fileContent);

      const requestIndex = cacheData.findIndex(
        (req) => req.requestUUID === requestUUID
      );

      if (requestIndex > -1) {
        cacheData[requestIndex].qrcodes = cacheData[requestIndex].qrcodes.filter(
          (qr) => qr.detailId !== parseInt(detailId, 10)
        );

        if (cacheData[requestIndex].qrcodes.length === 0) {
          cacheData.splice(requestIndex, 1);
        }
      }

      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (cacheError) {
      logger.error(cacheError, req, "OrderCacheUpdate");
    }

    res.status(200).json({ msg: `訂單 #${detailId} 狀態已更新` });
  } catch (error) {
    logger.error(error, req, "OrderAPI");
    res.status(500).json({ msg: "更新訂單狀態發生內部錯誤" });
  }
});

// 重新下單（針對單一 detail，重檢庫存並生成新 QR）
router.post("/reorder", async (req, res) => {
  try {
    const { detailId, requestUUID } = req.body;
    if (!detailId || !requestUUID) {
      return res.status(400).json({ msg: "缺少 detailId 或 requestUUID" });
    }

    const result = await orderController.reorderSingle(detailId);
    const expiresAt = new Date(Date.now() + QR_CODE_TTL_MS).toISOString();
    const payload = {
      productId: result.productId,
      detailId: result.detailId,
      productName: result.productName,
      requestUUID,
      materials: result.materialRequirements,
    };
    const qrCodeBase64 = await generateQRCode(payload);

    try {
      const fileContent = await fs.readFile(cacheFile, "utf-8");
      let cacheData = JSON.parse(fileContent);

      const requestIndex = cacheData.findIndex(
        (req) => req.requestUUID === requestUUID
      );

      if (requestIndex > -1) {
        if (!cacheData[requestIndex].expiresAt) {
          cacheData[requestIndex].expiresAt =
            cacheData[requestIndex].createdAt || expiresAt;
        }
        cacheData[requestIndex].qrcodes = cacheData[requestIndex].qrcodes.filter(
          (qr) => qr.detailId !== Number(detailId)
        );

        cacheData[requestIndex].qrcodes.push({
          detailId: result.detailId,
          productId: result.productId,
          productName: result.productName,
          expiresAt:
            cacheData[requestIndex].expiresAt ||
            cacheData[requestIndex].createdAt ||
            expiresAt,
          qrcode: qrCodeBase64,
        });
      }

      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (cacheError) {
      logger.error(cacheError, req, "OrderReorderCache");
    }

    res.status(201).json({
      detailId: result.detailId,
      qrcode: qrCodeBase64,
      message: "重新下單完成",
    });
  } catch (error) {
    if (error.isStockError || error.isActiveError) {
      return res
        .status(400)
        .json({ msg: error.message, productId: error.productId });
    }
    logger.error(error, req, "OrderReorder");
    res.status(500).json({ msg: "重新下單失敗" });
  }
});

// 讀取緩存
router.get("/cache", async (req, res) => {
  try {
    const fileContent = await fs.readFile(cacheFile, "utf-8");
    const cacheData = JSON.parse(fileContent);
    res.status(200).json(cacheData);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(200).json([]);
    }
    logger.error(error, req, "OrderCacheRead");
    res.status(500).json({ msg: "讀取緩存發生錯誤" });
  }
});

export default router;
