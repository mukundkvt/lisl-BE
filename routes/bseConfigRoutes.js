import express from "express";
import { getBseConfig, updateBseConfig } from "../controllers/bseConfigController.js";
import { checkAuthUser, requireRole } from "../middlewares/auth-middleware.js";

const router = express.Router();

// Only Super Admin or Supervisor should manage this configuration
const adminAccess = requireRole(["Supervisor", "Admin"]); // Adjust roles as per your system

router.get("/bse-config", checkAuthUser, adminAccess, getBseConfig);
router.post("/bse-config", checkAuthUser, adminAccess, updateBseConfig);

export default router;