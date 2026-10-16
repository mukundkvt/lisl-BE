import express from "express";
import {
  getCdslConfig,
  updateCdslConfig,
} from "../controllers/cdslConfigController.js";
import { checkAuthUser, requireRole } from "../middlewares/auth-middleware.js";

const adminAndSupervisor = requireRole(["Scrutiny Officer", "Supervisor", "Admin"]);
const router = express.Router();

router.get("/cdsl", checkAuthUser, adminAndSupervisor, getCdslConfig);
router.post("/cdsl", checkAuthUser, adminAndSupervisor, updateCdslConfig);
router.put("/cdsl", checkAuthUser, adminAndSupervisor, updateCdslConfig);

export default router;
