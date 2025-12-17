import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import * as logger from "../methods/logger.js";
import * as permissionController from "../SQL_controller/permission.js";
import { accessChecker } from "../middleware/accessChecker.js";

dotenv.config();
const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || "fallback-secret";
const issueSecret = process.env.LINE_ISSUE_JWT_TOKEN_SECRET || jwtSecret;
const INIT_MODE = (process.env.INIT || "false").toLowerCase() === "true";

// 取得角色清單
router.get("/permissions/roles", accessChecker(1), async (req, res) => {
  try {
    const roles = await permissionController.getRoles();
    res.status(200).json({ roles });
  } catch (error) {
    logger.error(error, req, "getRoles");
    res.status(500).json({ error: "取得角色清單失敗" });
  }
});

// 簽發註冊 token（需要 line_id）
router.post("/permissions/issue", accessChecker(1), (req, res) => {
  const { line_id } = req.body;
  if (!line_id) {
    return res.status(400).json({ error: "line_id 必填" });
  }
  const token = jwt.sign({ line_id }, issueSecret, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
  res.status(201).json({ token });
});

// 使用註冊 token 完成註冊，INIT=true 時強制給予管理員角色
router.post("/permissions/register", accessChecker(5), async (req, res) => {
  try {
    const { token, role_ids = [], employee_name } = req.body;
    if (!token) return res.status(400).json({ error: "token 必填" });

    const payload = jwt.verify(String(token).trim(), issueSecret, {
      algorithms: ["HS256"],
    });
    const lineId = payload?.line_id || payload?.lineId || payload?.sub;
    if (!lineId) return res.status(400).json({ error: "token 缺少 line_id" });

    await permissionController.ensureEmployee(lineId, employee_name);

    let finalRoleIds = role_ids;
    if (INIT_MODE) {
      const roles = await permissionController.getRoles();
      const adminRole = roles.find((r) => r.permission_level === 5);
      if (!adminRole)
        return res.status(500).json({ error: "找不到管理員角色" });
      finalRoleIds = [adminRole.role_id];
    }

    await permissionController.setEmployeeRoles(lineId, finalRoleIds);
    res
      .status(200)
      .json({ line_id: lineId, role_ids: finalRoleIds, init_mode: INIT_MODE });
  } catch (error) {
    logger.error(error, req, "permissionRegister");
    res.status(500).json({ error: "註冊失敗" });
  }
});

// 取得個人資料
router.get("/permissions/me", accessChecker(1), async (req, res) => {
  try {
    const lineId = req.user?.line_id;
    if (!lineId) return res.status(401).json({ error: "缺少 line_id" });

    await permissionController.ensureEmployee(lineId, null);
    const employees = await permissionController.getEmployeesWithRoles();
    const me = employees.find((e) => e.line_id === lineId);
    if (!me) return res.status(404).json({ error: "找不到使用者" });
    const permissionLevel =
      req.user?.permission_level ??
      (lineId
        ? await permissionController.getPermissionLevelByLineId(lineId)
        : 0);
    res.status(200).json({ employee: me, permission_level: permissionLevel });
  } catch (error) {
    logger.error(error, req, "getMe");
    res.status(500).json({ error: "取得個人資料失敗" });
  }
});

// 更新個人資料
router.patch("/permissions/me", accessChecker(1), async (req, res) => {
  try {
    const lineId = req.user?.line_id;
    const { employee_name } = req.body;
    if (!lineId) return res.status(401).json({ error: "缺少 line_id" });
    await permissionController.ensureEmployee(lineId, employee_name);
    if (employee_name !== undefined) {
      await permissionController.updateEmployeeName(lineId, employee_name);
    }
    res.status(200).json({ message: "已更新個人資料" });
  } catch (error) {
    logger.error(error, req, "updateMe");
    res.status(500).json({ error: "更新個人資料失敗" });
  }
});

// 取得員工清單
router.get("/permissions/employees", accessChecker(1), async (req, res) => {
  try {
    const employees = await permissionController.getEmployeesWithRoles();
    res.status(200).json({ employees });
  } catch (error) {
    logger.error(error, req, "getEmployees");
    res.status(500).json({ error: "取得員工列表失敗" });
  }
});

// 更新員工資料 / 角色
router.patch(
  "/permissions/employees/:lineId",
  accessChecker(5),
  async (req, res) => {
    try {
      const { lineId } = req.params;
      const { employee_name, role_ids = [] } = req.body;
      await permissionController.ensureEmployee(lineId, employee_name);
      await permissionController.setEmployeeRoles(lineId, role_ids);
      if (employee_name !== undefined) {
        await permissionController.updateEmployeeName(lineId, employee_name);
      }
      res.status(200).json({ message: "已更新員工資料" });
    } catch (error) {
      logger.error(error, req, "updateEmployee");
      res.status(500).json({ error: "更新員工失敗" });
    }
  }
);

export default router;
