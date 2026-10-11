import express from "express";
import * as logger from "../methods/logger.js";
import * as inventoryController from "../SQL_controller/inventory.js";
import { requirePermissions } from "../middleware/accessChecker.js";

const router = express.Router();

/**
 * @route GET /inventory/boms
 * @description 取得所有 BOM (Bill of Materials)
 * @returns {object} 200 - { boms: [{ bom_id, material_name, ... }] }
 * @returns {object} 500 - { error: "取得 BOM 失敗" }
 */
router.get("/boms", requirePermissions("inventory:view"), async (req, res) => {
  try {
    const boms = await inventoryController.getBoms();
    res.status(200).json({ boms });
  } catch (error) {
    logger.error(error, req, "getBoms");
    res.status(500).json({ error: "取得 BOM 失敗" });
  }
});

/**
 * @route POST /inventory/boms
 * @description 新增 BOM
 * @param {object} req.body - { material_name: string, shelf_life_days?: number, max_stock_qty?: number }
 * @returns {object} 201 - { message: "新增 BOM 成功", bomId: number }
 * @returns {object} 500 - { error: "新增 BOM 失敗" }
 */
router.post("/boms", requirePermissions("inventory:write"), async (req, res) => {
  try {
    const newBomId = await inventoryController.createBom(req.body);
    res.status(201).json({ message: "新增 BOM 成功", bomId: newBomId });
  } catch (error) {
    logger.error(error, req, "createBom");
    res.status(500).json({ error: "新增 BOM 失敗" });
  }
});

/**
 * @route PATCH /inventory/boms
 * @description 批次更新 BOM
 * @param {Array<object>} req.body - [{ bom_id: number, material_name: string, shelf_life_days?: number, max_stock_qty?: number }]
 * @returns {object} 200 - { message: "批次更新 BOM 成功" }
 * @returns {object} 400 - { error: "請提供 BOM 更新資料" }
 * @returns {object} 500 - { error: "批次更新 BOM 失敗" }
 */
router.patch("/boms", requirePermissions("inventory:write"), async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "請提供 BOM 更新資料" });
    }
    await inventoryController.updateBoms(req.body);
    res.status(200).json({ message: "批次更新 BOM 成功" });
  } catch (error) {
    logger.error(error, req, "updateBoms");
    res.status(500).json({ error: "批次更新 BOM 失敗" });
  }
});

/**
 * @route PATCH /inventory/boms/:id
 * @description 更新 BOM
 * @param {number} req.params.id - BOM ID
 * @param {object} req.body - { material_name?: string, shelf_life_days?: number, max_stock_qty?: number }
 * @returns {object} 200 - { message: "更新 BOM 成功" }
 * @returns {object} 500 - { error: "更新 BOM 失敗" }
 */
router.patch(
  "/boms/:id",
  requirePermissions("inventory:write"),
  async (req, res) => {
  try {
    const { id } = req.params;
    await inventoryController.updateBom(id, req.body);
    res.status(200).json({ message: "更新 BOM 成功" });
  } catch (error) {
    logger.error(error, req, "updateBom");
    res.status(500).json({ error: "更新 BOM 失敗" });
  }
});

/**
 * @route GET /inventory/
 * @description 取得所有原料的總庫存（依 bom_id 彙總）
 * @returns {object} 200 - { stock: [{ bom_id, bom_name, total_stock }] }
 * @returns {object} 500 - { error: "取得庫存失敗" }
 */
router.get("/", requirePermissions("inventory:view"), async (req, res) => {
  try {
    const stock = await inventoryController.getAllStock();
    res.status(200).json({ stock });
  } catch (error) {
    logger.error(error, req, "getAllStock");
    res.status(500).json({ error: "取得庫存失敗" });
  }
});

/**
 * @route GET /inventory/:bom_id
 * @description 取得指定 bom_id 的庫存歷史
 * @param {number} req.params.bom_id - BOM ID
 * @returns {object} 200 - { history: [{ inventory_id, stock_in_time, stock_in_qty, remaining_qty, expiry_time }] }
 * @returns {object} 500 - { error: "取得庫存歷史失敗" }
 */
router.get("/:bom_id", requirePermissions("inventory:view"), async (req, res) => {
  try {
    const { bom_id } = req.params;
    const history = await inventoryController.getStockHistory(bom_id);
    res.status(200).json({ history });
  } catch (error) {
    logger.error(error, req, "getStockHistory");
    res.status(500).json({ error: "取得庫存歷史失敗" });
  }
});

/**
 * @route POST /inventory/
 * @description 新增庫存
 * @param {object} req.body - { bom_id: number, quantity: number, stock_in_time?: string|Date, expiry_time?: string|Date }
 * @returns {object} 201 - { message: "新增庫存成功", inventoryId: number }
 * @returns {object} 400 - { error: "bom_id 或 quantity 必填" }
 * @returns {object} 500 - { error: "新增庫存失敗" }
 */
router.post("/", requirePermissions("inventory:write"), async (req, res) => {
  try {
    const { bom_id, quantity, stock_in_time, expiry_time } = req.body;

    if (!bom_id || quantity === undefined) {
      return res.status(400).json({ error: "bom_id 或 quantity 必填" });
    }

    const stockTime = stock_in_time || new Date();
    const expiryTime = expiry_time || stockTime;

    const newInventoryId = await inventoryController.addStock(
      bom_id,
      quantity,
      stockTime,
      expiryTime
    );

    res
      .status(201)
      .json({ message: "新增庫存成功", inventoryId: newInventoryId });
  } catch (error) {
    logger.error(error, req, "addStock");
    res.status(500).json({ error: "新增庫存失敗" });
  }
});

/**
 * @route PATCH /inventory/:bom_id
 * @description 更新指定 bom_id 的庫存總量
 * @param {number} req.params.bom_id - BOM ID
 * @param {object} req.body - { quantity: number, expiry_time?: string|Date }
 * @returns {object} 200 - { message: "更新庫存成功" }
 * @returns {object} 400 - { error: "quantity 必填" }
 * @returns {object} 500 - { error: "更新庫存失敗" }
 */
router.patch(
  "/:bom_id",
  requirePermissions("inventory:write"),
  async (req, res) => {
  try {
    const { bom_id } = req.params;
    const { quantity, expiry_time } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({ error: "quantity 必填" });
    }

    await inventoryController.updateStock(bom_id, quantity, expiry_time);
    res.status(200).json({ message: "更新庫存成功" });
  } catch (error) {
    logger.error(error, req, "updateStock");
    res.status(500).json({ error: "更新庫存失敗" });
  }
});

/**
 * @route PATCH /inventory/detail/:inventory_id
 * @description 更新單筆庫存紀錄
 * @param {number} req.params.inventory_id - 庫存紀錄 ID
 * @param {object} req.body - { stock_in_qty?: number, remaining_qty?: number, expiry_time?: string|Date }
 * @returns {object} 200 - { message: "更新庫存紀錄成功" }
 * @returns {object} 400 - { error: "請提供更新欄位" }
 * @returns {object} 500 - { error: "更新庫存紀錄失敗" }
 */
router.patch(
  "/detail/:inventory_id",
  requirePermissions("inventory:write"),
  async (req, res) => {
  try {
    const { inventory_id } = req.params;
    const { stock_in_qty, remaining_qty, expiry_time } = req.body;

    if (
      stock_in_qty === undefined &&
      remaining_qty === undefined &&
      expiry_time === undefined
    ) {
      return res.status(400).json({ error: "請提供更新欄位" });
    }

    await inventoryController.updateInventoryDetail(inventory_id, {
      stock_in_qty,
      remaining_qty,
      expiry_time,
    });

    res.status(200).json({ message: "更新庫存紀錄成功" });
  } catch (error) {
    logger.error(error, req, "updateInventoryDetail");
    res.status(500).json({ error: error.message || "更新庫存紀錄失敗" });
  }
});

/**
 * @route DELETE /inventory/detail/:inventory_id
 * @description 刪除單筆庫存紀錄
 * @param {number} req.params.inventory_id - 庫存紀錄 ID
 * @returns {object} 200 - { message: "刪除庫存紀錄成功" }
 * @returns {object} 500 - { error: "刪除庫存紀錄失敗" }
 */
router.delete(
  "/detail/:inventory_id",
  requirePermissions("inventory:write"),
  async (req, res) => {
  try {
    const { inventory_id } = req.params;
    await inventoryController.deleteInventoryDetail(inventory_id);
    res.status(200).json({ message: "刪除庫存紀錄成功" });
  } catch (error) {
    logger.error(error, req, "deleteInventoryDetail");
    res.status(500).json({ error: "刪除庫存紀錄失敗" });
  }
});

export default router;
