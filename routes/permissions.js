import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import * as logger from "../methods/logger.js";
import * as permissionController from "../SQL_controller/permission.js";
import { requirePermissions } from "../middleware/accessChecker.js";

dotenv.config();
const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || "fallback-secret";
const issueSecret = process.env.LINE_ISSUE_JWT_TOKEN_SECRET || jwtSecret;
const INIT_MODE = (process.env.INIT || "false").toLowerCase() === "true";

const SYSTEM_ADMIN_ROLE_NAME = "系統管理員";

router.get("/permissions/roles", requirePermissions("permissions:manage"), async (req, res) => {
  try {
    const roles = await permissionController.getRoles();
    res.status(200).json({ roles });
  } catch (error) {
    logger.error(error, req, "getRoles");
    res.status(500).json({ error: "取得角色清單失敗" });
  }
});

router.get(
  "/permissions/roles/:id",
  requirePermissions("permissions:manage"),
  async (req, res) => {
    try {
      const roleId = Number(req.params.id);
      const detail = await permissionController.getRoleDetail(roleId);
      res.status(200).json(detail);
    } catch (error) {
      if (error.isNotFound) {
        return res.status(404).json({ error: error.message });
      }
      logger.error(error, req, "getRoleDetail");
      res.status(500).json({ error: "取得角色詳情失敗" });
    }
  }
);

router.get(
  "/permissions/permissions",
  requirePermissions(["permissions:manage", "permissions:profile"]),
  async (req, res) => {
    try {
      const permissions = await permissionController.getPermissions();
      res.status(200).json({ permissions });
    } catch (error) {
      logger.error(error, req, "getPermissions");
      res.status(500).json({ error: "取得權限清單失敗" });
    }
  }
);

router.post(
  "/permissions/roles",
  requirePermissions("permissions:manage"),
  async (req, res) => {
    try {
      const roleId = await permissionController.createRole(req.body || {});
      res.status(201).json({ role_id: roleId });
    } catch (error) {
      logger.error(error, req, "createRole");
      res.status(500).json({ error: "新增角色失敗" });
    }
  }
);

router.patch(
  "/permissions/roles/:id",
  requirePermissions("permissions:manage"),
  async (req, res) => {
    try {
      const roleId = Number(req.params.id);
      await permissionController.updateRole(roleId, req.body || {});
      res.status(200).json({ message: "OK" });
    } catch (error) {
      logger.error(error, req, "updateRole");
      res.status(500).json({ error: "更新角色失敗" });
    }
  }
);

router.delete(
  "/permissions/roles/:id",
  requirePermissions("permissions:manage"),
  async (req, res) => {
    try {
      const roleId = Number(req.params.id);
      await permissionController.deleteRole(roleId);
      res.status(200).json({ message: "OK" });
    } catch (error) {
      if (error.isNotFound) {
        return res.status(404).json({ error: error.message });
      }
      if (error.isBadRequest) {
        return res.status(400).json({ error: error.message });
      }
      logger.error(error, req, "deleteRole");
      res.status(500).json({ error: "刪除角色失敗" });
    }
  }
);

router.put(
  "/permissions/roles/:id/permissions",
  requirePermissions("permissions:manage"),
  async (req, res) => {
    try {
      const roleId = Number(req.params.id);
      const permissions = Array.isArray(req.body?.permissions)
        ? req.body.permissions
        : [];
      await permissionController.setRolePermissions(roleId, permissions);
      res.status(200).json({ message: "OK" });
    } catch (error) {
      logger.error(error, req, "setRolePermissions");
      res.status(500).json({ error: "更新角色權限失敗" });
    }
  }
);

router.put(
  "/permissions/roles/:id/inherit",
  requirePermissions("permissions:manage"),
  async (req, res) => {
    try {
      const roleId = Number(req.params.id);
      const parentRoleIds = Array.isArray(req.body?.parent_role_ids)
        ? req.body.parent_role_ids
        : [];
      await permissionController.setRoleInherit(roleId, parentRoleIds);
      res.status(200).json({ message: "OK" });
    } catch (error) {
      logger.error(error, req, "setRoleInherit");
      res.status(500).json({ error: "更新角色繼承失敗" });
    }
  }
);

router.post("/permissions/issue", requirePermissions("permissions:issue"), (req, res) => {
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

router.post(
  "/permissions/register",
  requirePermissions("permissions:manage"),
  async (req, res) => {
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
        const adminRole = roles.find((r) => r.role_name === SYSTEM_ADMIN_ROLE_NAME);
        if (!adminRole) {
          return res.status(500).json({ error: "找不到系統管理員角色" });
        }
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
  }
);

router.get("/permissions/me", requirePermissions("permissions:profile"), async (req, res) => {
  try {
    const lineId = req.user?.line_id;
    if (!lineId) return res.status(401).json({ error: "缺少 line_id" });

    await permissionController.ensureEmployee(lineId, null);
    const employees = await permissionController.getEmployeesWithRoles();
    const me = employees.find((e) => e.line_id === lineId);
    if (!me) return res.status(404).json({ error: "找不到使用者" });

    const permissions = Array.isArray(req.user?.permissions)
      ? req.user.permissions
      : await permissionController.getPermissionCodesByLineId(lineId);

    res.status(200).json({ employee: me, permissions });
  } catch (error) {
    logger.error(error, req, "getMe");
    res.status(500).json({ error: "取得個人資訊失敗" });
  }
});

router.patch("/permissions/me", requirePermissions("permissions:profile"), async (req, res) => {
  try {
    const lineId = req.user?.line_id;
    const { employee_name } = req.body;
    if (!lineId) return res.status(401).json({ error: "缺少 line_id" });
    await permissionController.ensureEmployee(lineId, employee_name);
    if (employee_name !== undefined) {
      await permissionController.updateEmployeeName(lineId, employee_name);
    }
    res.status(200).json({ message: "已更新個人資訊" });
  } catch (error) {
    logger.error(error, req, "updateMe");
    res.status(500).json({ error: "更新個人資訊失敗" });
  }
});

router.get(
  "/permissions/employees",
  requirePermissions("permissions:manage"),
  async (req, res) => {
    try {
      const employees = await permissionController.getEmployeesWithRoles();
      res.status(200).json({ employees });
    } catch (error) {
      logger.error(error, req, "getEmployees");
      res.status(500).json({ error: "取得員工清單失敗" });
    }
  }
);

router.patch(
  "/permissions/employees/:lineId",
  requirePermissions("permissions:manage"),
  async (req, res) => {
    try {
      const { lineId } = req.params;
      const { employee_name, role_ids = [], overrides = [] } = req.body;
      await permissionController.ensureEmployee(lineId, employee_name);
      await permissionController.setEmployeeRoles(lineId, role_ids);
      if (Array.isArray(overrides)) {
        await permissionController.setEmployeeOverrides(lineId, overrides);
      }
      if (employee_name !== undefined) {
        await permissionController.updateEmployeeName(lineId, employee_name);
      }
      res.status(200).json({ message: "已更新員工資料" });
    } catch (error) {
      logger.error(error, req, "updateEmployee");
      res.status(500).json({ error: "更新員工資料失敗" });
    }
  }
);

export default router;
