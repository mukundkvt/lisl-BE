//For Admin

import express from 'express';
import { createReferral, getUserReferrals, getAllReferrals, trackReferralClick, getReferralInfo, updateReferral, deleteReferral, getReferralStats } from '../controllers/referralController.js';
import { checkAuthUser, requireRole } from '../middlewares/auth-middleware.js';

const router = express.Router();

// Public routes (no authentication required)
// Track referral click
router.get('/referral/track/:code', trackReferralClick);

// Get referral information for display
router.get('/referral/info/:code', getReferralInfo);

// Apply authentication middleware to protected routes
router.use(checkAuthUser);

// Role-based middleware
const apAndRm = requireRole(['Authorised Person', 'Relationship Manager']);
const adminAndSupervisor = requireRole(['Admin', 'Supervisor']);
const allRoles = requireRole(['Admin', 'Supervisor', 'Authorised Person', 'Relationship Manager']);

// Create a new referral campaign (AP and RM only)
router.post('/referral', apAndRm, createReferral);

// Get current user's referrals
router.get('/referral/my', allRoles, getUserReferrals);

// Get all referrals (Admin and Supervisor only)
router.get('/referral', adminAndSupervisor, getAllReferrals);

// Get referral statistics
router.get('/referral/:id/stats', allRoles, getReferralStats);

// Update referral (owner or admin/supervisor)
router.put('/referral/:id', allRoles, updateReferral);

// Delete referral (owner or admin/supervisor)
router.delete('/referral/:id', allRoles, deleteReferral);

export default router;