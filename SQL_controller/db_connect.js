import pg from "pg";
import dotenv from "dotenv";
import * as logger from "../methods/logger.js";

dotenv.config();

// 數據庫配置
const DB_CONFIG = {
  host: process.env.DATABASE_URL || "127.0.0.1",
  port: process.env.DATABASE_PORT_RW || 5432,
  database: process.env.DATABASE_NAME || "",
  user: process.env.DATABASE_USER || "",
  password: process.env.DATABASE_PASSWORD || "",
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false, // 允許自簽名證書
          require: true, // 強制要求 SSL 連接
        }
      : false,
};

// 連接池實例
let poolRW = null;
let poolRO = null;

// 重連配置
const RECONNECT_INTERVAL = 5000;

// 創建連接池
function createPool(config, isReadOnly = false) {
  const poolConfig = {
    ...config,
    application_name: isReadOnly ? "drink_ro" : "drink_rw",
  };

  const pool = new pg.Pool(poolConfig);

  // 錯誤處理和重連機制
  pool.on("error", (err) => {
    err.msg = `資料庫 ${isReadOnly ? "RO" : "RW"} 發生錯誤`;
    logger.error(err, null, "資料庫");

    // 如果是連線終止錯誤，嘗試重新初始化
    if (
      err.message.includes("Connection terminated unexpectedly") ||
      err.message.includes("Connection ended unexpectedly")
    ) {
      logger.warn(`資料庫 ${isReadOnly ? "RO" : "RW"} 正在嘗試重連`, "資料庫");

      setTimeout(() => {
        if (isReadOnly) {
          poolRO = createPool(config, true);
        } else {
          poolRW = createPool(config, false);
        }
      }, 5000);
    }
  });

  // 監聽連線事件
  pool.on("connect", (client) => {
    logger.info(`資料庫 ${isReadOnly ? "RO" : "RW"} 新的客戶端連接`, "資料庫");
  });

  pool.on("remove", (client) => {
    logger.info(
      `資料庫 ${isReadOnly ? "RO" : "RW"} 將客戶端移出連接池`,
      "資料庫"
    );
  });

  return pool;
}

// 初始化連接池
async function initializePools() {
  try {
    logger.info(`資料庫正在嘗試初始化連接池...`, "資料庫");

    poolRW = createPool(DB_CONFIG, false);
    poolRO = createPool(DB_CONFIG, true);

    // 測試連接
    await testConnection(poolRW, "RW");
    await testConnection(poolRO, "RO");

    logger.info(`資料庫連線成功`, "資料庫");
    return true;
  } catch (error) {
    error.msg = "資料庫初始化連接池失敗";
    logger.error(error, null, "資料庫");
    return false;
  }
}

// 測試連接
async function testConnection(pool, type) {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT version()");
    logger.info(
      `資料庫 ${type} 測試連線成功 ${result.rows[0].version}: `,
      "資料庫"
    );
  } finally {
    client.release();
  }
}

// 啟動檢查 - 無限重連
async function startupCheck() {
  let attempts = 0;

  while (true) {
    attempts++;
    logger.warn(`第 ${attempts} 次嘗試重新連接資料庫`, "資料庫");

    if (await initializePools()) {
      return true;
    }

    logger.warn(
      `資料庫連線失敗，將在 ${RECONNECT_INTERVAL / 1000} 秒後重試...`,
      "資料庫"
    );
    await new Promise((resolve) => setTimeout(resolve, RECONNECT_INTERVAL));
  }
}

// 獲取讀寫連接池
function getPoolRW() {
  if (!poolRW) {
    logger.warn("取得連線池 RW 失敗，將進行重新初始化嘗試");
    // 嘗試重新初始化
    initializePools().catch((err) => {
      err.msg = "連線池 RW 初始化嘗試失敗";
      logger.error(err, null, "資料庫");
    });
    throw new Error("Database connection pool not initialized");
  }
  return poolRW;
}

// 獲取只讀連接池
function getPoolRO() {
  if (!poolRO) {
    logger.warn("取得連線池 RO 失敗，將進行重新初始化嘗試");
    // 嘗試重新初始化
    initializePools().catch((err) => {
      err.msg = "連線池 RO 初始化嘗試失敗";
      logger.error(err, null, "資料庫");
    });
    throw new Error("Database connection pool not initialized");
  }
  return poolRO;
}

export { startupCheck, getPoolRW, getPoolRO };
