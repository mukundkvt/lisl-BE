//For User
import express from 'express';
import { fillPDFForm, fillAnnexureJ } from '../controllers/pdfController.js';
import { checkAuthUser } from '../middlewares/userAuth-middleware.js';


const router = express.Router();

router.post('/fill_form', checkAuthUser, fillPDFForm);
router.post('/fill_annexure_j', checkAuthUser, fillAnnexureJ);

export default router;
