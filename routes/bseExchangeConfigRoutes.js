import express from "express";
import {
  getBseExchangeConfig,
  updateBseExchangeConfig,
} from "../controllers/bseExchangeConfigController.js";
import { checkAuthUser, requireRole } from "../middlewares/auth-middleware.js";

const router = express.Router();

const adminAndSupervisor = requireRole(["Scrutiny Officer", "Supervisor", "Admin"]);

router.get("/bse-exchange-config", checkAuthUser, adminAndSupervisor, getBseExchangeConfig);
router.post("/bse-exchange-config", checkAuthUser, adminAndSupervisor, updateBseExchangeConfig);
router.put("/bse-exchange-config", checkAuthUser, adminAndSupervisor, updateBseExchangeConfig);

export default router;
