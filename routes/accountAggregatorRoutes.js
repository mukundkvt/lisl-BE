import express from "express";
import { initiateAARedirect, aaDataRetrievalWebhook } from "../controllers/accountAggregatorController.js";
import { checkAuthUser } from "../middlewares/auth-middleware.js";

const router = express.Router();

// Route to initiate AA Process (Auth + Redirect)
router.post("/aa/redirect", checkAuthUser, initiateAARedirect);

// Unified AA Webhook (No Auth Middleware as it's a callback)
router.post("/aa/webhook", aaDataRetrievalWebhook);

export default router;
