import express from "express";
import * as logger from "../methods/logger.js";
import * as menuController from "../SQL_controller/menu.js";
import { accessChecker } from "../middleware/accessChecker.js";

const router = express.Router();

// 取得菜單：?all=true 可包含未上架（後台用），預設僅上架
router.get("/", async (req, res) => {
  try {
    const includeInactive =
      String(req.query.all || "")
        .trim()
        .toLowerCase() === "true";
    const menus = await menuController.getMenus(includeInactive);
    res.status(200).json({ menus });
  } catch (error) {
    error.msg = "無法取得菜單";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "無法取得菜單" });
  }
});

router.get("/option", async (req, res) => {
  try {
    const options = await menuController.getAllCustomOptions();
    res.status(200).json({ options });
  } catch (error) {
    error.msg = "無法取得自訂義選項";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "無法取得自訂義選項" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const menuId = req.params.id;
    const options = await menuController.getOptionsByProductId(menuId);
    res.status(200).json({ options });
  } catch (error) {
    error.msg = "無法取得菜單選項";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "無法取得菜單選項" });
  }
});

router.get("/:id/materials", accessChecker(3), async (req, res) => {
  try {
    const menuId = req.params.id;
    const materials = await menuController.getBaseMaterialsByProductId(menuId);
    res.status(200).json({ materials });
  } catch (error) {
    error.msg = "無法取得材料資訊";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "無法取得材料資訊" });
  }
});

// 建立/修改/刪除菜單，需要權限 3
router.post("/", accessChecker(3), async (req, res) => {
  try {
    const { name, price, optionIds, baseMaterials } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: "菜品名稱與價格為必填" });
    }
    const newMenuId = await menuController.createMenu(
      name,
      price,
      optionIds,
      baseMaterials
    );
    res.status(201).json({ message: "成功新增菜單", menuId: newMenuId });
  } catch (error) {
    error.msg = "新增菜單失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "新增菜單失敗" });
  }
});

router.put("/:id", accessChecker(3), async (req, res) => {
  try {
    const menuId = req.params.id;
    await menuController.updateMenu(menuId, req.body);
    res.status(200).json({ message: "更新菜單成功" });
  } catch (error) {
    error.msg = "更新菜單失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "更新菜單失敗" });
  }
});

router.delete("/:id", accessChecker(3), async (req, res) => {
  try {
    const menuId = req.params.id;
    await menuController.deleteMenu(menuId);
    res.status(200).json({ message: "刪除菜單成功" });
  } catch (error) {
    error.msg = "刪除菜單失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "刪除菜單失敗" });
  }
});

// 自訂義選項 CRUD
router.post("/option", accessChecker(3), async (req, res) => {
  try {
    const { name, details } = req.body;
    if (!name || !details || !Array.isArray(details) || details.length === 0) {
      return res.status(400).json({ error: "選項名稱與細項為必填" });
    }
    const newOptionId = await menuController.createCustomOption(name, details);
    res.status(201).json({ message: "成功新增選項", optionId: newOptionId });
  } catch (error) {
    error.msg = "新增選項失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "新增選項失敗" });
  }
});

router.put("/option/:id", accessChecker(3), async (req, res) => {
  try {
    const optionId = req.params.id;
    const { name, details } = req.body;
    if (!name || !details || !Array.isArray(details)) {
      return res.status(400).json({ error: "選項名稱與細項為必填" });
    }
    await menuController.updateCustomOption(optionId, { name, details });
    res.status(200).json({ message: "更新選項成功" });
  } catch (error) {
    error.msg = "更新選項失敗";
    logger.error(error, req, "菜單API");
    res.status(500).json({ error: "更新選項失敗" });
  }
});

router.delete("/option/:id", accessChecker(3), async (req, res) => {
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
