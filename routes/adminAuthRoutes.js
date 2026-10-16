import express from 'express';
import { adminRegister, userLogin, checkAuthStatus, changePassword, changePasswordByAdmin } from '../controllers/authController.js';
import { checkAuthUser } from '../middlewares/auth-middleware.js';

const router = express.Router();

// Login endpoint
router.post('/login', userLogin);

// Register endpoint
router.post('/register', adminRegister);

// Check authentication status endpoint
router.get('/check_auth_status', checkAuthStatus);

// POST: Change password for the logged-in user
router.post('/change-password', checkAuthUser, changePassword);

// POST: Change password for any user (Admin only)
router.post('/change-password-by-admin', checkAuthUser, changePasswordByAdmin);




export default router;
