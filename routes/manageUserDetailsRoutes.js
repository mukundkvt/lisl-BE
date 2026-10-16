import express from "express";
import {
  assignClientCodeManually,
  updateAddress,
  updateAddressProofNumber,
  updateBankDetails
} from "../controllers/manageUserDetailsController.js";
import { checkAuthUser, requireRole } from "../middlewares/auth-middleware.js";
const router = express.Router();
const adminAndSupervisor = requireRole(["Scrutiny Officer", "Supervisor", "Admin"]);
const clientCodeRoles = requireRole([
  "Relationship Manager",
  "Authorised Person",
  "Supervisor",
  "Admin"
]);

// Assign client code manually
router.post(
  "/manageuser/:userId/assign-client-code",
  checkAuthUser,
  clientCodeRoles,
  assignClientCodeManually
);

// Update user address
router.put(
  "/manageuser/:userId/address",
  checkAuthUser,
  adminAndSupervisor,
  updateAddress
);
// Update user addressProof Number
router.put(
  "/manageuser/:userId/address-proof-number",
  checkAuthUser,
  adminAndSupervisor,
  updateAddressProofNumber
);

// Update user bank details (Bank Name, MICR, Address)
router.put(
  "/manageuser/:userId/bank-details",
  checkAuthUser,
  adminAndSupervisor,
  updateBankDetails
);

export default router;
