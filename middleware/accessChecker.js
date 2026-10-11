import { requireAuth } from "../config/passport.js";

/**
 * 權限檢查：
 * - 非 production 直接放行
 * - production 必須登入且命中任一權限代碼
 */
export const requirePermissions = (...codes) => {
  const bypass = (process.env.NODE_ENV || "").toLowerCase() !== "production";
  if (bypass) {
    return (req, res, next) => next();
  }

  const required = Array.isArray(codes[0]) ? codes[0] : codes;

  return [
    requireAuth,
    (req, res, next) => {
      const list = Array.isArray(req?.user?.permissions)
        ? req.user.permissions
        : [];
      const set = new Set(list);
      if (set.has("system:admin")) return next();
      if (required.length === 0) return next();
      const allowed = required.some((code) => set.has(code));
      if (allowed) return next();
      return res.status(401).json({ error: "權限不足" });
    },
  ];
};

// 相容舊名稱
export const accessChecker = requirePermissions;
