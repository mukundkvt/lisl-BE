//For User
import express from 'express';
import { contactUsEmail } from '../controllers/mailController.js';
const router = express.Router();





router.post('/contact_us_email', contactUsEmail);

export default router;
