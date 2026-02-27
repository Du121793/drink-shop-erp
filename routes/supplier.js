import express from "express";
import * as logger from "../methods/logger.js";
import * as supplierController from "../SQL_controller/supplier.js";
import { accessChecker } from "../middleware/accessChecker.js";

const router = express.Router();

// 廠商 CRUD
// 取得廠商清單
router.get("/suppliers", accessChecker(1), async (req, res) => {
  try {
    const suppliers = await supplierController.getSuppliers();
    res.status(200).json({ suppliers });
  } catch (error) {
    logger.error(error, req, "getSuppliers");
    res.status(500).json({ error: "取得廠商列表失敗" });
  }
});

// 新增廠商
router.post("/suppliers", accessChecker(3), async (req, res) => {
  try {
    const { supplier_name, email, phone } = req.body;
    if (!supplier_name) {
      return res.status(400).json({ error: "supplier_name 為必填" });
    }
    const id = await supplierController.createSupplier({
      supplier_name,
      email,
      phone,
    });
    res.status(201).json({ supplier_id: id });
  } catch (error) {
    logger.error(error, req, "createSupplier");
    res.status(500).json({ error: "新增廠商失敗" });
  }
});

// 更新廠商
router.patch("/suppliers/:id", accessChecker(3), async (req, res) => {
  try {
    const { id } = req.params;
    const { supplier_name, email, phone } = req.body;
    await supplierController.updateSupplier(id, {
      supplier_name,
      email,
      phone,
    });
    res.status(200).json({ message: "更新廠商成功" });
  } catch (error) {
    logger.error(error, req, "updateSupplier");
    res.status(500).json({ error: "更新廠商失敗" });
  }
});

// 刪除廠商
router.delete("/suppliers/:id", accessChecker(3), async (req, res) => {
  try {
    const { id } = req.params;
    await supplierController.deleteSupplier(id);
    res.status(200).json({ message: "刪除廠商成功" });
  } catch (error) {
    logger.error(error, req, "deleteSupplier");
    res.status(500).json({ error: "刪除廠商失敗" });
  }
});

// 原料-廠商關聯
// 查詢原料-廠商關聯
router.get("/suppliers/materials", accessChecker(1), async (req, res) => {
  try {
    const { bom_id } = req.query;
    const list = await supplierController.getMaterialSuppliers(bom_id);
    res.status(200).json({ materialSuppliers: list });
  } catch (error) {
    logger.error(error, req, "getMaterialSuppliers");
    res.status(500).json({ error: "取得原料廠商關聯失敗" });
  }
});

// 新增或更新原料-廠商關聯
router.post("/suppliers/materials", accessChecker(3), async (req, res) => {
  try {
    const { supplier_id, bom_id, is_default = false } = req.body;
    if (!supplier_id || !bom_id) {
      return res.status(400).json({ error: "supplier_id 與 bom_id 為必填" });
    }
    await supplierController.upsertMaterialSupplier({
      supplier_id,
      bom_id,
      is_default,
    });
    res.status(200).json({ message: "更新原料廠商成功" });
  } catch (error) {
    logger.error(error, req, "upsertMaterialSupplier");
    res.status(500).json({ error: "更新原料廠商失敗" });
  }
});

// 設定原料預設廠商
router.patch(
  "/suppliers/materials/default",
  accessChecker(3),
  async (req, res) => {
    try {
      const { supplier_id, bom_id } = req.body;
      if (!supplier_id || !bom_id) {
        return res.status(400).json({ error: "supplier_id 與 bom_id 為必填" });
      }
      await supplierController.setDefaultMaterialSupplier(bom_id, supplier_id);
      res.status(200).json({ message: "設定預設廠商成功" });
    } catch (error) {
      logger.error(error, req, "setDefaultMaterialSupplier");
      res.status(500).json({ error: "設定預設廠商失敗" });
    }
  }
);

// 刪除原料-廠商關聯
router.delete("/suppliers/materials", accessChecker(3), async (req, res) => {
  try {
    const { supplier_id, bom_id } = req.body;
    if (!supplier_id || !bom_id) {
      return res.status(400).json({ error: "supplier_id 與 bom_id 為必填" });
    }
    await supplierController.deleteMaterialSupplier(supplier_id, bom_id);
    res.status(200).json({ message: "刪除原料廠商關聯成功" });
  } catch (error) {
    logger.error(error, req, "deleteMaterialSupplier");
    res.status(500).json({ error: "刪除原料廠商關聯失敗" });
  }
});

// 叫貨紀錄
// 取得叫貨紀錄批次
router.get("/purchase-orders", accessChecker(1), async (req, res) => {
  try {
    const groups = await supplierController.getPurchaseOrderGroups();
    res.status(200).json({ groups });
  } catch (error) {
    logger.error(error, req, "getPurchaseOrders");
    res.status(500).json({ error: "取得叫貨紀錄失敗" });
  }
});

// 建立叫貨紀錄
router.post("/purchase-orders", accessChecker(1), async (req, res) => {
  try {
    const orders = Array.isArray(req.body?.orders) ? req.body.orders : [];
    if (!orders.length) {
      return res.status(400).json({ error: "orders 陣列為必填" });
    }
    const inserted = await supplierController.createPurchaseOrderLogs(orders);
    res.status(201).json({ inserted });
  } catch (error) {
    if (error.isBlocked) {
      return res.status(403).json({ error: error.message, block_until: error.blockUntil });
    }
    logger.error(error, req, "createPurchaseOrders");
    res.status(500).json({ error: "新增叫貨紀錄失敗" });
  }
});

// 更新叫貨狀態並寫入事件
router.patch("/purchase-orders/:id/status", accessChecker(1), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      event_type_id,
      event_type_ids,
      event_code,
      event_codes,
      event_note,
    } = req.body;
    const parsedStatus = Number(status);
    if (![1, 3].includes(parsedStatus)) {
      return res.status(400).json({ error: "狀態僅能更新為 1 或 3" });
    }
    await supplierController.updatePurchaseOrderStatus(id, parsedStatus, {
      event_type_id,
      event_type_ids,
      event_code,
      event_codes,
      event_note,
    });
    res.status(200).json({ message: "狀態已更新" });
  } catch (error) {
    if (error.isBadRequest) {
      return res.status(400).json({ error: error.message });
    }
    if (error.isNotFound) {
      return res.status(404).json({ error: error.message });
    }
    logger.error(error, req, "updatePurchaseOrderStatus");
    res.status(500).json({ error: "更新叫貨紀錄狀態失敗" });
  }
});

export default router;
