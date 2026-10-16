//For User
import express from 'express';
import { createContractUrl, pullContract, createAnnexureJUrl, pullAnnexureJ, handleContractWebhook } from '../controllers/contractController.js';
import { checkAuthUser } from '../middlewares/auth-middleware.js';

const router = express.Router();

router.post('/create_contract_url', checkAuthUser, createContractUrl);
router.post('/pull_contract', checkAuthUser, pullContract);
router.post('/create_annexure_j_url', checkAuthUser, createAnnexureJUrl);
router.post('/pull_annexure_j', checkAuthUser, pullAnnexureJ);
router.post('/contract/webhook', handleContractWebhook);

export default router;
