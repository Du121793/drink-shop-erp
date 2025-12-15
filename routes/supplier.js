import express from "express";
import * as logger from "../methods/logger.js";
import * as supplierController from "../SQL_controller/supplier.js";

const router = express.Router();

// 廠商 CRUD
router.get("/suppliers", async (req, res) => {
  try {
    const suppliers = await supplierController.getSuppliers();
    res.status(200).json({ suppliers });
  } catch (error) {
    logger.error(error, req, "getSuppliers");
    res.status(500).json({ error: "取得廠商列表失敗" });
  }
});

router.post("/suppliers", async (req, res) => {
  try {
    const { supplier_name, email, phone } = req.body;
    if (!supplier_name) {
      return res.status(400).json({ error: "supplier_name 為必填" });
    }
    const id = await supplierController.createSupplier({ supplier_name, email, phone });
    res.status(201).json({ supplier_id: id });
  } catch (error) {
    logger.error(error, req, "createSupplier");
    res.status(500).json({ error: "新增廠商失敗" });
  }
});

router.patch("/suppliers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { supplier_name, email, phone } = req.body;
    await supplierController.updateSupplier(id, { supplier_name, email, phone });
    res.status(200).json({ message: "更新廠商成功" });
  } catch (error) {
    logger.error(error, req, "updateSupplier");
    res.status(500).json({ error: "更新廠商失敗" });
  }
});

router.delete("/suppliers/:id", async (req, res) => {
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
router.get("/suppliers/materials", async (req, res) => {
  try {
    const { bom_id } = req.query;
    const list = await supplierController.getMaterialSuppliers(bom_id);
    res.status(200).json({ materialSuppliers: list });
  } catch (error) {
    logger.error(error, req, "getMaterialSuppliers");
    res.status(500).json({ error: "取得原料廠商關聯失敗" });
  }
});

router.post("/suppliers/materials", async (req, res) => {
  try {
    const { supplier_id, bom_id, is_default = false } = req.body;
    if (!supplier_id || !bom_id) {
      return res.status(400).json({ error: "supplier_id 與 bom_id 為必填" });
    }
    await supplierController.upsertMaterialSupplier({ supplier_id, bom_id, is_default });
    res.status(200).json({ message: "更新原料廠商成功" });
  } catch (error) {
    logger.error(error, req, "upsertMaterialSupplier");
    res.status(500).json({ error: "更新原料廠商失敗" });
  }
});

router.patch("/suppliers/materials/default", async (req, res) => {
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
});

router.delete("/suppliers/materials", async (req, res) => {
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
router.get("/purchase-orders", async (req, res) => {
  try {
    const groups = await supplierController.getPurchaseOrderGroups();
    res.status(200).json({ groups });
  } catch (error) {
    logger.error(error, req, "getPurchaseOrders");
    res.status(500).json({ error: "取得叫貨紀錄失敗" });
  }
});

router.post("/purchase-orders", async (req, res) => {
  try {
    const orders = Array.isArray(req.body?.orders) ? req.body.orders : [];
    if (!orders.length) {
      return res.status(400).json({ error: "orders 陣列為必填" });
    }
    const inserted = await supplierController.createPurchaseOrderLogs(orders);
    res.status(201).json({ inserted });
  } catch (error) {
    logger.error(error, req, "createPurchaseOrders");
    res.status(500).json({ error: "新增叫貨紀錄失敗" });
  }
});

export default router;
