import express from 'express';
import { getMobileOtpLogs, getEmailOtpLogs, getAuditLogs } from '../controllers/logsController.js';
import { checkAuthUser, requireRole } from '../middlewares/auth-middleware.js';

const router = express.Router();

// Admin-only routes for OTP logs
router.get('/audit-logs', checkAuthUser, requireRole(['Admin']), getAuditLogs);
router.get('/mobile-otp-logs/:mobileNumber', checkAuthUser, requireRole(['Admin']), getMobileOtpLogs);
router.get('/email-otp-logs/:email', checkAuthUser, requireRole(['Admin']), getEmailOtpLogs);

export default router;