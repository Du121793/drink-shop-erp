import express from "express";
import * as logger from "../methods/logger.js";
import {
  getReputationRule,
  updateReputationRule,
  getEventTypes,
  createEventType,
  updateEventType,
  createSupplierEvent,
  recalculateSupplierScore,
  getSupplierReputationSummaries,
  getSupplierReputationDetail,
  getBlockedSuppliers,
  unblockSupplierBlock,
} from "../SQL_controller/supplierReputation.js";
import { requirePermissions } from "../middleware/accessChecker.js";

const router = express.Router();

// 取得信譽摘要
router.get(
  "/suppliers/reputation",
  requirePermissions("supplier:reputation"),
  async (req, res) => {
  try {
    const idsRaw = req.query?.supplier_ids;
    let ids = [];
    if (Array.isArray(idsRaw)) {
      ids = idsRaw.flatMap((v) => String(v).split(","));
    } else if (idsRaw) {
      ids = String(idsRaw).split(",");
    }
    const parsed = ids.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    const data = await getSupplierReputationSummaries(parsed);
    res.status(200).json(data);
  } catch (error) {
    logger.error(error, req, "getSupplierReputationSummaries");
    res
      .status(500)
      .json({ error: "取得信譽摘要失敗" });
  }
});

router.get(
  "/suppliers/:id/reputation",
  requirePermissions("supplier:reputation"),
  async (req, res) => {
    // 取得單一供應商信譽明細
    try {
      const { id } = req.params;
      const limit = req.query?.limit ? Number(req.query.limit) : 50;
      const detail = await getSupplierReputationDetail(id, limit);
      res.status(200).json({ detail });
    } catch (error) {
      logger.error(error, req, "getSupplierReputationDetail");
      res
        .status(500)
        .json({ error: "取得信譽明細失敗" });
    }
  }
);

// 取得信譽規則
router.get(
  "/suppliers/reputation-rule",
  requirePermissions("supplier:reputation"),
  async (req, res) => {
  try {
    const rule = await getReputationRule();
    res.status(200).json({ rule });
  } catch (error) {
    logger.error(error, req, "getReputationRule");
    res
      .status(500)
      .json({ error: "取得信譽規則失敗" });
  }
});

router.patch(
  "/suppliers/reputation-rule",
  requirePermissions("supplier:reputation"),
  async (req, res) => {
    // 更新信譽規則
    try {
      const rule = await updateReputationRule(req.body || {});
      res.status(200).json({ rule });
    } catch (error) {
      logger.error(error, req, "updateReputationRule");
      res
        .status(500)
        .json({ error: "更新信譽規則失敗" });
    }
  }
);

// 取得封鎖名單
router.get(
  "/suppliers/blocks",
  requirePermissions("supplier:reputation"),
  async (req, res) => {
  try {
    const blocks = await getBlockedSuppliers();
    res.status(200).json({ blocks });
  } catch (error) {
    logger.error(error, req, "getBlockedSuppliers");
    res.status(500).json({ error: "取得封鎖名單失敗" });
  }
});

router.patch(
  "/suppliers/blocks/:id/unblock",
  requirePermissions("supplier:reputation"),
  async (req, res) => {
    // 解除封鎖
    try {
      const { id } = req.params;
      const block = await unblockSupplierBlock(id);
      res.status(200).json({ block });
    } catch (error) {
      if (error.isNotFound) {
        return res.status(404).json({ error: error.message });
      }
      logger.error(error, req, "unblockSupplierBlock");
      res.status(500).json({ error: "解除封鎖失敗" });
    }
  }
);

// 取得事件類型
router.get(
  "/suppliers/event-types",
  requirePermissions("supplier:reputation"),
  async (req, res) => {
  try {
    const includeInactive =
      String(req.query?.include_inactive || "").toLowerCase() === "true";
    const types = await getEventTypes(includeInactive);
    res.status(200).json({ types });
  } catch (error) {
    logger.error(error, req, "getEventTypes");
    res
      .status(500)
      .json({ error: "取得事件類型失敗" });
  }
});

// 新增事件類型
router.post(
  "/suppliers/event-types",
  requirePermissions("supplier:reputation"),
  async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.event_code || !payload.event_name) {
      return res
        .status(400)
        .json({ error: "請提供事件代碼與名稱" });
    }
    const created = await createEventType(payload);
    res.status(201).json({ event_type: created });
  } catch (error) {
    logger.error(error, req, "createEventType");
    res
      .status(500)
      .json({ error: "建立事件類型失敗" });
  }
});

router.patch(
  "/suppliers/event-types/:id",
  requirePermissions("supplier:reputation"),
  async (req, res) => {
    // 更新事件類型
    try {
      const { id } = req.params;
      const updated = await updateEventType(id, req.body || {});
      res.status(200).json({ event_type: updated });
    } catch (error) {
      logger.error(error, req, "updateEventType");
      res
        .status(500)
        .json({ error: "更新事件類型失敗" });
    }
  }
);

// 建立供應商事件
router.post(
  "/suppliers/:id/events",
  requirePermissions("supplier:reputation"),
  async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    if (!payload.event_type_id && !payload.event_code) {
      return res
        .status(400)
        .json({ error: "請選擇事件類型" });
    }
    const created = await createSupplierEvent({
      supplier_id: Number(id),
      event_type_id: payload.event_type_id,
      event_code: payload.event_code,
      order_id: payload.order_id,
      note: payload.note,
      occurred_at: payload.occurred_at,
      created_by: payload.created_by,
    });
    await recalculateSupplierScore(Number(id));
    res.status(201).json({ event: created });
  } catch (error) {
    logger.error(error, req, "createSupplierEvent");
    if (error.isBadRequest) {
      return res.status(400).json({ error: error.message });
    }
    res
      .status(500)
      .json({ error: "建立事件失敗" });
  }
});

export default router;
