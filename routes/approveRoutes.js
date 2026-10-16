import express from "express";
import { updateApprovalStatus, getUserApprovalStatus } from "../controllers/approveController.js";
import { checkAuthUser, requireRole } from '../middlewares/auth-middleware.js';
// Only Scrutiny Officer and Supervisor can manage schemes
const adminAndSupervisor = requireRole(["Scrutiny Officer", "Supervisor"]);

const router = express.Router();
// PUT /api/approvals/:userId
router.put("/user-approval/:userId",checkAuthUser, adminAndSupervisor, updateApprovalStatus);

// GET /api/approvals/user-approval-status/:userId
router.get("/user-approval-status/:userId", checkAuthUser, getUserApprovalStatus);

export default router;
