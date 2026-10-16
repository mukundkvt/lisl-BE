import express from "express";
import { getUserAddressById, getUserBankDetailsById, getUserDigitalSignatureById, getUserExchangeById, getUserInPersonVerificationById, getUserPDFGenerationDetailsById, getUserProfileById, getUsersByRole, searchUsers, getUserStatusCounts, getRejectedUsersById, getUserDashboardSummary, getUserListByDashboardStage, getOnboardingGraph, getRoleDashboardSummary, getRoleOnboardingTrend } from "../controllers/dashboardController.js";
import { checkAuthUser, requireRole } from "../middlewares/auth-middleware.js";

const router = express.Router();

// Get users based on admin user role
router.get("/dashboard/users", checkAuthUser, getUsersByRole);
router.get("/dashboard/users/details/address/:userId", checkAuthUser, getUserAddressById);
router.get("/dashboard/users/details/profile/:userId", checkAuthUser, getUserProfileById);
router.get("/dashboard/users/details/bank/:userId", checkAuthUser, getUserBankDetailsById);
router.get("/dashboard/users/details/exchange/:userId", checkAuthUser, getUserExchangeById);
router.get("/dashboard/users/details/ipv/:userId", checkAuthUser, getUserInPersonVerificationById);
router.get("/dashboard/users/details/digital-signature/:userId", checkAuthUser, getUserDigitalSignatureById);
router.get("/dashboard/users/details/pdf-generation/:userId", checkAuthUser, getUserPDFGenerationDetailsById);
router.get("/dashboard/users/search", checkAuthUser, searchUsers);
// Get user status counts
router.get("/dashboard/users/status-counts", checkAuthUser, getUserStatusCounts);

// New Dashboard APIs
router.get("/dashboard/users/summary-matrix", checkAuthUser, getUserDashboardSummary);
router.get("/dashboard/users/stage-list", checkAuthUser, getUserListByDashboardStage);
router.get("/dashboard/users/onboarding-graph", checkAuthUser, getOnboardingGraph);

// Role-Based Comprehensive Dashboard APIs
router.get("/dashboard/role-summary", checkAuthUser, getRoleDashboardSummary);
router.get("/dashboard/onboarding-trend", checkAuthUser, getRoleOnboardingTrend);

router.get("/dashboard/users/rejected-user/:userId", checkAuthUser, getRejectedUsersById);
export default router;
