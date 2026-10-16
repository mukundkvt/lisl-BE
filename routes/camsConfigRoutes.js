import express from "express";
import { checkAuthUser, requireRole } from "../middlewares/auth-middleware.js";
import { addCamsConfig, getCamsConfig, updateCamsConfig } from "../controllers/camsConfigController.js";
const router = express.Router();

const adminAndSupervisor = requireRole([
  "Scrutiny Officer",
  "Supervisor",
  "Admin",
]);

router.post("/cams", addCamsConfig);
router.put("/cams", checkAuthUser, adminAndSupervisor, updateCamsConfig);
router.get("/cams", checkAuthUser, adminAndSupervisor, getCamsConfig);

export default router;
