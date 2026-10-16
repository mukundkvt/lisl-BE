//For Admin
import express from 'express';
import { addBranch, editBranch, getBranches } from '../controllers/branchController.js';
import { checkAuthUser } from '../middlewares/auth-middleware.js';

const router = express.Router();

router.post('/branches', checkAuthUser, addBranch);
router.put('/branches/:id', checkAuthUser, editBranch);
router.get('/branches', checkAuthUser, getBranches);

export default router;
