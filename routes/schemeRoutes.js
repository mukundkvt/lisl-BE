//For Admmin
import express from 'express';
import { createScheme, getAllSchemes, getSchemeById, updateScheme, deleteScheme, setDefaultScheme, getAccessibleSchemes, getSchemesWithAssignmentStatus, updateSchemeAssignmentStatus } from '../controllers/schemeController.js';
import { checkAuthUser, requireRole } from '../middlewares/auth-middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(checkAuthUser);

// Only Admin and Supervisor can manage schemes
const adminAndSupervisor = requireRole(['Admin', 'Supervisor']);

// Create a new scheme
router.post('/schemes', adminAndSupervisor, createScheme);

// Get all schemes (with optional isActive filter)
// Example: GET /api/schemes?isActive=true
router.get('/schemes', getAllSchemes);

// Get schemes accessible to current user (AP/RM only)
router.get('/schemes/accessible', requireRole(['Authorised Person', 'Relationship Manager']), getAccessibleSchemes);

// Get single scheme by ID
router.get('/schemes/:id', getSchemeById);

// Update scheme
router.put('/schemes/:id', adminAndSupervisor, updateScheme);

// Delete scheme
router.delete('/schemes/:id', adminAndSupervisor, deleteScheme);

// Set default scheme
router.post('/schemes/:id/set-default', adminAndSupervisor, setDefaultScheme);



// Get all schemes with assignment status for a specific AdminUser
router.get('/schemes/assignment-status/:adminUserId', adminAndSupervisor, getSchemesWithAssignmentStatus);

// Update scheme assignment status for a specific AdminUser
router.put('/schemes/assignment-status/:adminUserId', adminAndSupervisor, updateSchemeAssignmentStatus);


export default router;