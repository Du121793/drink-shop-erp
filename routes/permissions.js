import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import * as logger from "../methods/logger.js";
import * as permissionController from "../SQL_controller/permission.js";

dotenv.config();
const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || "fallback-secret";
const INIT_MODE = (process.env.INIT || "false").toLowerCase() === "true";

// 取得角色列表
router.get("/permissions/roles", async (req, res) => {
  try {
    const roles = await permissionController.getRoles();
    res.status(200).json({ roles });
  } catch (error) {
    logger.error(error, req, "getRoles");
    res.status(500).json({ error: "取得角色列表失敗" });
  }
});

// 簡易發放註冊 token（僅包 line_id）
router.post("/permissions/issue", (req, res) => {
  const { line_id } = req.body;
  if (!line_id) {
    return res.status(400).json({ error: "line_id 為必填" });
  }
  const token = jwt.sign({ line_id }, jwtSecret, { algorithm: "HS256", expiresIn: "1h" });
  res.status(201).json({ token });
});

// 使用註冊 token 註冊並設定角色；INIT=true 時強制為管理員
router.post("/permissions/register", async (req, res) => {
  try {
    const { token, role_ids = [], employee_name } = req.body;
    if (!token) return res.status(400).json({ error: "token 為必填" });

    const payload = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
    const lineId = payload?.line_id;
    if (!lineId) return res.status(400).json({ error: "token 缺少 line_id" });

    await permissionController.ensureEmployee(lineId, employee_name);

    let finalRoleIds = role_ids;
    if (INIT_MODE) {
      const roles = await permissionController.getRoles();
      const adminRole = roles.find((r) => r.permission_level === 5);
      if (!adminRole) return res.status(500).json({ error: "找不到管理員角色" });
      finalRoleIds = [adminRole.role_id];
    }

    await permissionController.setEmployeeRoles(lineId, finalRoleIds);
    res.status(200).json({ line_id: lineId, role_ids: finalRoleIds, init_mode: INIT_MODE });
  } catch (error) {
    logger.error(error, req, "permissionRegister");
    res.status(500).json({ error: "權限註冊失敗" });
  }
});

// 取得員工列表（包含角色）
router.get("/permissions/employees", async (req, res) => {
  try {
    const employees = await permissionController.getEmployeesWithRoles();
    res.status(200).json({ employees });
  } catch (error) {
    logger.error(error, req, "getEmployees");
    res.status(500).json({ error: "取得員工資料失敗" });
  }
});

// 更新員工名稱與角色
router.patch("/permissions/employees/:lineId", async (req, res) => {
  try {
    const { lineId } = req.params;
    const { employee_name, role_ids = [] } = req.body;
    await permissionController.ensureEmployee(lineId, employee_name);
    await permissionController.setEmployeeRoles(lineId, role_ids);
    if (employee_name !== undefined) {
      await permissionController.updateEmployeeName(lineId, employee_name);
    }
    res.status(200).json({ message: "更新員工資料成功" });
  } catch (error) {
    logger.error(error, req, "updateEmployee");
    res.status(500).json({ error: "更新員工資料失敗" });
  }
});

export default router;
