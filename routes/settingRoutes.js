import express from 'express';
import { checkAuthUser, requireRole } from '../middlewares/auth-middleware.js';
import {
  getAnnexureJSetting,
  setAnnexureJSetting,
  getPublicAnnexureJStatus,
} from '../controllers/settingController.js';

const router = express.Router();

// Public — no auth needed (for client app)
router.get('/annexure-j-status', getPublicAnnexureJStatus);

export const adminSettingRouter = express.Router();

// Admin — Supervisor only
adminSettingRouter.get('/annexure-j', checkAuthUser, requireRole(['Supervisor']), getAnnexureJSetting);
adminSettingRouter.post('/annexure-j', checkAuthUser, requireRole(['Supervisor']), setAnnexureJSetting);

export default router;
