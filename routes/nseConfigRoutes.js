import express from "express";
import { getNseConfig, updateNseConfig } from "../controllers/nseConfigController.js";
import { checkAuthUser,requireRole } from '../middlewares/auth-middleware.js';
const router = express.Router();


const adminAndSupervisor = requireRole(["Scrutiny Officer", "Supervisor", "Admin"]);

router.put("/nse", checkAuthUser, adminAndSupervisor, updateNseConfig);
router.get("/nse", checkAuthUser, adminAndSupervisor, getNseConfig);

export default router;
