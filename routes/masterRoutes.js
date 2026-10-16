import express from "express";
import { deleteUserData, searchUserDataByQuery } from "../controllers/masterController.js";
import { checkAuthUser, requireRole } from "../middlewares/auth-middleware.js";
const router = express.Router()
router.get('/user/master-search', checkAuthUser,requireRole(["Supervisor"]),searchUserDataByQuery);
router.delete('/user/master-delete/:userId', checkAuthUser,requireRole(["Supervisor"]),deleteUserData);
export default router