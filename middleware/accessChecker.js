import { requireAuth } from "../config/passport.js";

/**
 * 權限檢查中間件
 * - 若未設定 NODE_ENV=production，直接放行（開發模式）
 * - 已登入（passport jwt）且 permission_level >= minLevel 才放行
 * - 其他情況回傳 401
 */
export const accessChecker = (minLevel = 0) => {
  // 開發模式全部放行
  const bypass = (process.env.NODE_ENV || "").toLowerCase() !== "production";
  if (bypass) {
    return (req, res, next) => next();
  }

  // 生產模式：需先通過 JWT 驗證，再檢查權限等級
  return [
    requireAuth,
    (req, res, next) => {
      const level = req?.user?.permission_level ?? 0;
      if (level >= minLevel) return next();
      return res.status(401).json({ error: "權限不足" });
    },
  ];
};
