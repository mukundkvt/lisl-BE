import express from 'express';
import {addUser, getUsers, updateUser, getRelationshipManagers, getRelationshipManagersAndAuthorizedPersons, checkLoginName, checkEmployeeId, updateUserStatus, getUserCountsByRole, registerWithReferral, validateReferralCode, getUserReferralInfo, getRmByBranchId} from '../controllers/adminUserController.js';
import { checkAuthUser } from '../middlewares/auth-middleware.js';

const router = express.Router();

// POST: Create new user
router.post('/users', checkAuthUser, addUser);

// GET: Fetch all users
router.get('/users', checkAuthUser, getUsers);

// PUT: Update user by ID
router.put('/users/:id', checkAuthUser, updateUser);

// GET: Get all authorized persons
router.get('/users/relationship-managers', checkAuthUser, getRelationshipManagers);

// GET: Get all relationship managers and authorized persons
router.get('/users/rm-and-ap', checkAuthUser, getRelationshipManagersAndAuthorizedPersons);

    // GET: Check if a login name is available
router.get('/users/check-login-name/:loginName', checkAuthUser,checkLoginName);

// GET: Check if an employee ID is available
router.get('/users/check-employee-id/:employeeId', checkAuthUser,checkEmployeeId);

// PATCH: Update user status (Admin only)
router.patch('/users/status', checkAuthUser, updateUserStatus);

// GET: Get user counts by role
router.get('/users/counts-by-role', checkAuthUser, getUserCountsByRole);

// POST: Register user with referral code (public endpoint)
router.post('/register-with-referral', registerWithReferral);

// GET: Validate referral code (public endpoint)
router.get('/validate-referral/:referralCode', validateReferralCode);

// GET: Get user's referral information
router.get('/users/:userId/referral-info', checkAuthUser, getUserReferralInfo);
router.get('/users/get_rm_by_branchid/:branchId', checkAuthUser, getRmByBranchId);

export default router;
