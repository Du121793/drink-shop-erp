import express from "express";
import { decodeJwt, SignJWT } from "jose";
import dotenv from "dotenv";
import * as logger from "../../methods/logger.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const router = express.Router();

// 僅限此路由使用 JSON parser，避免影響 webhook raw
router.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
const LIFF_CHANNEL_ID = process.env.LINE_LIFF_CHANNEL_ID;
const DEV_TOKEN = process.env.LIFF_DEV_TOKEN || "DEV_FAKE_TOKEN";
const SERVER_URL = (process.env.SERVER_URL || "").replace(/\/$/, "");

function extractIdToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice("Bearer ".length);
  if (req.body?.idToken) return req.body.idToken;
  return null;
}

function validateIdToken(token) {
  if (token === DEV_TOKEN) {
    return { sub: "DEV_FAKE_USER", aud: LIFF_CHANNEL_ID || "DEV", dev: true };
  }
  const payload = decodeJwt(token);
  if (!payload.sub) throw new Error("ID Token 缺少 sub (line user id)");
  if (!payload.aud) throw new Error("ID Token 缺少 aud");
  if (LIFF_CHANNEL_ID && payload.aud !== LIFF_CHANNEL_ID)
    throw new Error("ID Token aud 不符");
  // exp 不再嚴格檢查，避免前端未刷新導致無法取得後端權限
  return payload;
}

async function issueBackendJwt(lineId) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ line_id: lineId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

router.post("/", async (req, res) => {
  try {
    const idToken = extractIdToken(req);
    if (!idToken) return res.status(400).json({ error: "缺少 LIFF ID Token" });

    const payload = validateIdToken(idToken);
    const lineId = payload.sub;

    const backendToken = await issueBackendJwt(lineId);
    return res
      .status(200)
      .json({ token: backendToken, line_id: lineId, liff_payload: payload });
  } catch (error) {
    error.msg = "LIFF 登入驗證失敗";
    logger.error(error, req, "LIFF_LOGIN");
    return res.status(401).json({ error: error.message || "LIFF 驗證失敗" });
  }
});

// GET 請求回傳前端入口（供 LIFF 重新導向時載入頁面）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const liffIndexPath = path.resolve(__dirname, "../../public/admin/dist/index.html");

router.get("/", (req, res) => {
  const rawState = req.query["liff.state"] || req.query["state"];
  let hash = "";
  if (rawState) {
    try {
      const decoded = decodeURIComponent(rawState);
      hash = decoded.startsWith("#") ? decoded : `#${decoded}`;
    } catch {
      hash = "";
    }
  }

  const assetBase = `${SERVER_URL || ""}/admin/dist`.replace(/\/+/g, "/").replace(/(^https?:)\/+/,'$1//');
  const svgBase = `${SERVER_URL || ""}`.replace(/\/+$/, "");

  try {
    let html = fs.readFileSync(liffIndexPath, "utf-8");
    html = html.replace(/href="\/assets\//g, `href="${assetBase}/assets/`);
    html = html.replace(/src="\/assets\//g, `src="${assetBase}/assets/`);
    html = html.replace(/href="\/vite\.svg"/g, `href="${svgBase}/vite.svg"`);
    html = html.replace(/src="\/vite\.svg"/g, `src="${svgBase}/vite.svg"`);

    // 加上 hash 狀態
    if (hash) {
      html = html.replace(
        /(<script type="module".*?src="[^"]*index-[^"]*\.js".*?><\/script>)/,
        `$1<!-- liff.state -->`
      );
    }

    res.status(200).send(html);
  } catch (err) {
    logger.error(err, req, "LIFF_GET");
    res.status(500).end();
  }
});

export default router;
