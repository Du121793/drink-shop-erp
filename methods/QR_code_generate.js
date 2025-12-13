import QRCode from "qrcode";
import * as logger from "./logger.js";

/**
 * 將傳入的JSON物件轉換為QR Code的Base64編碼
 * @param {object} data - 要編碼為QR Code的JSON物件
 * @returns {Promise<string>} QR Code的Base64數據URL
 */
async function generateQRCode(data) {
  try {
    const jsonString = JSON.stringify(data);
    const qrCodeBase64 = await QRCode.toDataURL(jsonString);
    return qrCodeBase64;
  } catch (error) {
    error.msg = "生成QR Code時發生錯誤";
    logger.error(error, null, "generateQRCode");
    throw error;
  }
}

export { generateQRCode };
