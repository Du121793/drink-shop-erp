import { useEffect, useState } from "react";
import liff from "@line/liff";

const LIFF_TOKEN_KEY = "liff_id_token";

/**
 * LIFF 初始化與登入流程（僅處理前端登入與取得 Line ID Token）
 * - 讀取環境變數 VITE_LIFF_ID
 * - 未登入時自動觸發 liff.login 並返回目前頁面
 * - 已登入則取回使用者 profile 與 ID Token
 */
export function useLiffInit() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    profile: null,
    idToken: null,
  });

  useEffect(() => {
    let isUnmounted = false;
    const liffId = import.meta.env.VITE_LIFF_ID;
    const devMode = (import.meta.env.VITE_LIFF_DEV_MODE || "").toString() === "true";
    const devToken = import.meta.env.VITE_LIFF_DEV_TOKEN || "DEV_FAKE_TOKEN";

    // 開發模式：跳過 LIFF，直接回傳假資料方便本地測試
    if (devMode) {
      localStorage.setItem(LIFF_TOKEN_KEY, devToken);
      setState({
        loading: false,
        error: null,
        profile: { displayName: "Dev User (Mock)", userId: "U_DEV_MOCK" },
        idToken: devToken,
      });
      return () => {
        isUnmounted = true;
      };
    }

    if (!liffId) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "缺少 VITE_LIFF_ID，請確認環境變數設定。",
      }));
      return () => {
        isUnmounted = true;
      };
    }

    const initLiff = async () => {
      try {
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const [profile, idToken] = await Promise.all([
          liff.getProfile(),
          liff.getIDToken(),
        ]);

        if (isUnmounted) return;

        if (idToken) {
          localStorage.setItem(LIFF_TOKEN_KEY, idToken);
        }

        setState({
          loading: false,
          error: null,
          profile,
          idToken: idToken || null,
        });
      } catch (err) {
        if (isUnmounted) return;
        setState({
          loading: false,
          error: err?.message || "LIFF 初始化失敗，請稍後再試。",
          profile: null,
          idToken: null,
        });
      }
    };

    initLiff();

    return () => {
      isUnmounted = true;
    };
  }, []);

  return state;
}

export { LIFF_TOKEN_KEY };
