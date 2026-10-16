//For User

import express from 'express';
import { sendMobileOTP, resendMobileOTP, verifyMobileOTP, sendEmailOTP, resendEmailOTP, verifyEmailOTP, loginUser, isLoggedIn} from '../controllers/userAuthController.js';
import { checkAuthUser } from '../middlewares/userAuth-middleware.js';

const router = express.Router();

router.post('/send_mobile_otp', sendMobileOTP);
router.post('/resend_mobile_otp', checkAuthUser, resendMobileOTP);
router.post('/verify_mobile_otp', checkAuthUser, verifyMobileOTP);
router.post('/send_email_otp', checkAuthUser,  sendEmailOTP);
router.post('/resend_email_otp', checkAuthUser, resendEmailOTP);
router.post('/verify_email_otp', checkAuthUser, verifyEmailOTP);
router.post('/login_user', loginUser);
router.get('/is_logged_in', isLoggedIn);


 
export default router;