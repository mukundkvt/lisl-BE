import express from "express";
import {
  getAllPushStatus,
  getPushLogsBySection,
  pushAll,
} from "../controllers/pushManageController.js";
import { checkAuthUser } from "../middlewares/auth-middleware.js";

const router = express.Router();

// Route to get summary status of all push sections for a user
router.get("/status/:userId", checkAuthUser, getAllPushStatus);

// Route to get detailed logs for a specific section
router.get("/logs/:userId/:section", checkAuthUser, getPushLogsBySection);

// Route to trigger push to all downstream backoffice services
router.post("/push_all/:userId", checkAuthUser, pushAll);

export default router;
