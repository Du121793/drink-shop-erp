import express from "express";
import * as logger from "../methods/logger.js";
import * as inventoryController from "../SQL_controller/inventory.js";
import { accessChecker } from "../middleware/accessChecker.js";

const router = express.Router();

/**
 * @route GET /inventory/boms
 * @description 取得所有BOM(Bill of Materials)
 * @returns {object} 200 - { boms: [{ bom_id, bom_name, ... }] }
 * @returns {object} 500 - { error: "取得BOM失敗" }
 */
router.get("/boms", accessChecker(1), async (req, res) => {
  try {
    const boms = await inventoryController.getBoms();
    res.status(200).json({ boms });
  } catch (error) {
    logger.error(error, req, "getBoms");
    res.status(500).json({ error: "取得BOM失敗" });
  }
});

/**
 * @route POST /inventory/boms
 * @description 新增BOM
 * @param {object} req.body - { material_name: string, shelf_life_days?: number, max_stock_qty?: number }
 * @returns {object} 201 - { message: "新增BOM成功", bomId: number }
 * @returns {object} 500 - { error: "新增BOM失敗" }
 */
router.post("/boms", accessChecker(5), async (req, res) => {
  try {
    const newBomId = await inventoryController.createBom(req.body);
    res.status(201).json({ message: "新增BOM成功", bomId: newBomId });
  } catch (error) {
    logger.error(error, req, "createBom");
    res.status(500).json({ error: "新增BOM失敗" });
  }
});

/**
 * @route PATCH /inventory/boms
 * @description 批次修改BOM
 * @param {Array<object>} req.body - [{ bom_id: number, material_name: string, shelf_life_days?: number, max_stock_qty?: number }]
 * @returns {object} 200 - { message: "批次更新BOM成功" }
 * @returns {object} 500 - { error: "批次更新BOM失敗" }
 */
router.patch("/boms", accessChecker(5), async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "請提供BOM陣列" });
    }
    await inventoryController.updateBoms(req.body);
    res.status(200).json({ message: "批次更新BOM成功" });
  } catch (error) {
    logger.error(error, req, "updateBoms");
    res.status(500).json({ error: "批次更新BOM失敗" });
  }
});

/**
 * @route PATCH /inventory/boms/:id
 * @description 修改BOM
 * @param {number} req.params.id - BOM ID
 * @param {object} req.body - { material_name: string, shelf_life_days?: number, max_stock_qty?: number }
 * @returns {object} 200 - { message: "更新BOM成功" }
 * @returns {object} 500 - { error: "更新BOM失敗" }
 */
router.patch("/boms/:id", accessChecker(5), async (req, res) => {
  try {
    const { id } = req.params;
    await inventoryController.updateBom(id, req.body);
    res.status(200).json({ message: "更新BOM成功" });
  } catch (error) {
    logger.error(error, req, "updateBom");
    res.status(500).json({ error: "更新BOM失敗" });
  }
});

/**
 * @route GET /inventory/
 * @description 取得目前所有bom_id的總庫存量
 * @returns {object} 200 - { stock: [{ bom_id, bom_name, total_stock }] }
 * @returns {object} 500 - { error: "取得庫存失敗" }
 */
router.get("/", accessChecker(1), async (req, res) => {
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
 * @description 取得特定bom_id的入庫歷史
 * @param {number} req.params.bom_id - BOM ID
 * @returns {object} 200 - { history: [{ inventory_id, stock_in_time, stock_in_qty, stock_remain_qty }] }
 * @returns {object} 500 - { error: "取得庫存歷史失敗" }
 */
router.get("/:bom_id", accessChecker(1), async (req, res) => {
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
 * @param {object} req.body - { bom_id: number, quantity: number, stock_in_time?: string }
 * @returns {object} 201 - { message: "新增庫存成功", inventoryId: number }
 * @returns {object} 400 - { error: "bom_id 和 quantity 為必填項" }
 * @returns {object} 500 - { error: "新增庫存失敗" }
 */
router.post("/", accessChecker(1), async (req, res) => {
  try {
    const { bom_id, quantity, stock_in_time } = req.body;
    if (!bom_id || quantity === undefined) {
      return res.status(400).json({ error: "bom_id 和 quantity 為必填項" });
    }
    const newInventoryId = await inventoryController.addStock(
      bom_id,
      quantity,
      stock_in_time || new Date()
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
 * @description 修改特定bom_id的總庫存量
 * @param {number} req.params.bom_id - BOM ID
 * @param {object} req.body - { quantity: number }
 * @returns {object} 200 - { message: "更新庫存成功" }
 * @returns {object} 400 - { error: "quantity 為必填項" }
 * @returns {object} 500 - { error: "更新庫存失敗" }
 */
router.patch("/:bom_id", accessChecker(5), async (req, res) => {
  try {
    const { bom_id } = req.params;
    const { quantity } = req.body;
    if (quantity === undefined) {
      return res.status(400).json({ error: "quantity 為必填項" });
    }
    await inventoryController.updateStock(bom_id, quantity);
    res.status(200).json({ message: "更新庫存成功" });
  } catch (error) {
    logger.error(error, req, "updateStock");
    res.status(500).json({ error: "更新庫存失敗" });
  }
});

/**
 * @route PATCH /inventory/detail/:inventory_id
 * @description 修改入庫紀錄
 * @param {number} req.params.inventory_id - 庫存紀錄ID
 * @param {object} req.body - { stock_in_qty?: number, stock_remain_qty?: number }
 * @returns {object} 200 - { message: "更新庫存明細成功" }
 * @returns {object} 400 - { error: "請提供要更新的欄位" }
 * @returns {object} 500 - { error: "更新庫存明細失敗" }
 */
router.patch("/detail/:inventory_id", accessChecker(1), async (req, res) => {
  try {
    const { inventory_id } = req.params;
    const { stock_in_qty, remaining_qty } = req.body;

    if (stock_in_qty === undefined && remaining_qty === undefined) {
      return res.status(400).json({ error: "請提供要更新的欄位" });
    }

    await inventoryController.updateInventoryDetail(inventory_id, {
      stock_in_qty,
      remaining_qty,
    });
    res.status(200).json({ message: "更新庫存明細成功" });
  } catch (error) {
    logger.error(error, req, "updateInventoryDetail");
    res.status(500).json({ error: error.message || "更新庫存明細失敗" });
  }
});

/**
 * @route DELETE /inventory/detail/:inventory_id
 * @description 刪除入庫紀錄
 * @param {number} req.params.inventory_id - 庫存紀錄ID
 * @returns {object} 200 - { message: "刪除庫存明細成功" }
 * @returns {object} 500 - { error: "刪除庫存明細失敗" }
 */
router.delete("/detail/:inventory_id", accessChecker(1), async (req, res) => {
  try {
    const { inventory_id } = req.params;
    await inventoryController.deleteInventoryDetail(inventory_id);
    res.status(200).json({ message: "刪除庫存明細成功" });
  } catch (error) {
    logger.error(error, req, "deleteInventoryDetail");
    res.status(500).json({ error: "刪除庫存明細失敗" });
  }
});

export default router;
