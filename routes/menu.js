import express from "express";
import * as logger from "../methods/logger.js";
import * as menuController from "../SQL_controller/menu.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const menus = await menuController.getMenus();
    res.status(200).json({ menus });
  } catch (error) {
    error.msg = "取得菜單失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "取得菜單失敗" });
  }
});

router.get("/option", async (req, res) => {
  try {
    const options = await menuController.getAllCustomOptions();
    res.status(200).json({ options });
  } catch (error) {
    error.msg = "取得所有自定義選項失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "取得所有自定義選項失敗" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const menuId = req.params.id;
    const options = await menuController.getOptionsByProductId(menuId);
    res.status(200).json({ options });
  } catch (error) {
    error.msg = "取得菜單選項失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "取得菜單選項失敗" });
  }
});

router.get("/:id/materials", async (req, res) => {
  try {
    const menuId = req.params.id;
    const materials = await menuController.getBaseMaterialsByProductId(menuId);
    res.status(200).json({ materials });
  } catch (error) {
    error.msg = "取得基礎原料失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "取得基礎原料失敗" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, price, optionIds, baseMaterials } = req.body;
    if (!name || !price) {
      return res.status(400).json({ error: "菜品名稱和價格為必填項" });
    }
    const newMenuId = await menuController.createMenu(
      name,
      price,
      optionIds,
      baseMaterials
    );
    res.status(201).json({ message: "新增菜品成功", menuId: newMenuId });
  } catch (error) {
    error.msg = "新增菜品失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "新增菜品失敗" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const menuId = req.params.id;
    await menuController.updateMenu(menuId, req.body);
    res.status(200).json({ message: "更新菜品成功" });
  } catch (error) {
    error.msg = "更新菜品失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "更新菜品失敗" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const menuId = req.params.id;
    await menuController.deleteMenu(menuId);
    res.status(200).json({ message: "刪除菜品成功" });
  } catch (error) {
    error.msg = "刪除菜品失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "刪除菜品失敗" });
  }
});

router.post("/option", async (req, res) => {
  try {
    const { name, details } = req.body;
    if (!name || !details || !Array.isArray(details) || details.length === 0) {
      return res.status(400).json({ error: "選項名稱和詳細內容為必填項" });
    }
    const newOptionId = await menuController.createCustomOption(name, details);
    res.status(201).json({ message: "新增選項成功", optionId: newOptionId });
  } catch (error) {
    error.msg = "新增選項失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "新增選項失敗" });
  }
});

router.put("/option/:id", async (req, res) => {
  try {
    const optionId = req.params.id;
    const { name, details } = req.body;
    if (!name || !details || !Array.isArray(details)) {
      return res.status(400).json({ error: "選項名稱和詳細內容為必填項" });
    }
    await menuController.updateCustomOption(optionId, { name, details });
    res.status(200).json({ message: "更新選項成功" });
  } catch (error) {
    error.msg = "更新選項失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "更新選項失敗" });
  }
});

router.delete("/option/:id", async (req, res) => {
  try {
    const optionId = req.params.id;
    await menuController.deleteCustomOption(optionId);
    res.status(200).json({ message: "刪除選項成功" });
  } catch (error) {
    error.msg = "刪除選項失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "刪除選項失敗" });
  }
});

export default router;
