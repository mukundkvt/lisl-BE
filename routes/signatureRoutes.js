//For User
import express from 'express';
import { uploadSignature } from '../controllers/signatureController.js';
import { checkAuthUser } from '../middlewares/userAuth-middleware.js';


const router = express.Router();

// Route to handle signature upload
router.post('/signature/upload', checkAuthUser, uploadSignature);

export default router;