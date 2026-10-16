import express from "express";
import multer from "multer";
import {
  uploadDpIds,
  getFreeDpIdCount,
} from "../controllers/dpIdController.js";
import { checkAuthUser, requireRole } from "../middlewares/auth-middleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Route to upload DP IDs (Admin/Supervisor only)
router.post(
  "/upload-dp-ids",
  checkAuthUser,
  requireRole(["Admin", "Supervisor"]),
  upload.single("file"),
  uploadDpIds
);

// Route to get free DP ID count (Admin/Supervisor only)
router.get(
  "/free-dp-id-count",
  checkAuthUser,
  requireRole(["Admin", "Supervisor"]),
  getFreeDpIdCount
);

export default router;
