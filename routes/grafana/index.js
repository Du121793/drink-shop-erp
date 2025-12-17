import express from "express";
import webhookRouter from "./webhook.js";

const router = express.Router();

// /line/webhook -> webhookRouter (raw body 驗簽)
router.use("/webhook", webhookRouter);

export default router;
