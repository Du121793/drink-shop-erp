import axios from "axios";
import { LIFF_TOKEN_KEY } from "../hooks/useLiff";

function decodeJwt(token) {
  const [, payload = ""] = token.split(".");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(normalized));
}

export function isTokenExpired(token) {
  try {
    const payload = decodeJwt(token);
    if (!payload?.exp) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec;
  } catch {
    return true;
  }
}

function pickValidToken() {
  const apiToken = localStorage.getItem("api_token");
  if (apiToken) {
    if (isTokenExpired(apiToken)) {
      localStorage.removeItem("api_token");
    } else {
      return apiToken;
    }
  }

  const liffToken = localStorage.getItem(LIFF_TOKEN_KEY);
  if (liffToken) {
    if (isTokenExpired(liffToken)) {
      localStorage.removeItem(LIFF_TOKEN_KEY);
    } else {
      return liffToken;
    }
  }

  return null;
}

// 以環境變數為主，預設仍使用本機連線
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000",
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Expires: "0",
  },
});

// 自動附加 Bearer Token（優先使用後端簽發的 api_token，其次 LIFF ID Token）
instance.interceptors.request.use((config) => {
  const token = pickValidToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

export default instance;
