import express from "express";
import webhookRouter from "./webhook.js";
import liffRouter from "./liff.js";

const router = express.Router();

// /line/webhook -> webhookRouter (raw body 驗簽)
router.use("/webhook", webhookRouter);

// /line/liff -> liffRouter (JSON parser)
router.use("/liff", liffRouter);

export default router;
