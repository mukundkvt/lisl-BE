//For User
import express from 'express';
import { getStates, getDistricts } from '../controllers/locationController.js';

const router = express.Router();

// Route to get all states with search functionality
router.get('/states', getStates);

// Route to get districts for a specific state with search functionality
router.get('/get_districts/:state', getDistricts);

export default router;