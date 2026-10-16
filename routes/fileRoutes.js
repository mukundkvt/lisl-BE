//For User
import express from 'express';
import { uploadFile, getRecentUploads, searchFilesByName, deleteFile, updateAltText } from '../controllers/fileController.js';

const router = express.Router();

router.post('/upload', uploadFile);
router.get('/get_recent_file/:page', getRecentUploads);
router.get('/search_file', searchFilesByName);
router.delete('/delete/:filename', deleteFile); 
router.put('/update_alt/:id', updateAltText);

export default router;
