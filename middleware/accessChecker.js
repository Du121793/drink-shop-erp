// 簡易權限檢查：requireAuth 之後使用，確認 req.user.permission_level 是否達門檻
export const accessChecker = (minLevel = 0) => {
  return (req, res, next) => {
    const level = req?.user?.permission_level ?? 0;
    if (level >= minLevel) return next();
    return res.status(401).json({ error: "權限不足" });
  };
};
