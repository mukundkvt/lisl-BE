//For User
import express from "express";
import {
  checkPAN,
  confirmPAN,
  createDigilockerUrl,
  digilockerWebhook,
  getDigilockerDetails,
  getUserDetails,
  hybridBankAccountVerification,
  reversePennyDropCreateLink,
  verifyReversePennyDrop,
  confirmBankDetails,
  checkIfscDetails,
  createIPVUrl,
  getIPVDetails,
  sendIPVEmail,
  checkIPVStatus,
  saveGeoLocation,
  processCamsKra,
  verifyPAN,
  submitManualKyc,
  submitProfile,
  getProfileData,
  extractionPAN,
  confirmPanExtraction,
  getAddressData,
  uploadBankProof,
  saveDDPIConsent,
  uploadPanProof,
  deletePanProof,
} from "../controllers/kycController.js";
import {
  getExchangeData,
  submitExchange,
} from "../controllers/exchangeController.js";
import { checkAuthUser } from "../middlewares/userAuth-middleware.js";
import { upload } from "../utils/fileUpload.js";

const router = express.Router();

router.post("/check_pan", checkAuthUser, checkPAN);
router.post("/confirm_pan", checkAuthUser, confirmPAN);
router.post(
  "/upload_pan_proof",
  checkAuthUser,
  upload.single("pan_file"),
  uploadPanProof
);
router.post("/delete_pan_proof", checkAuthUser, deletePanProof);
router.post(
  "/extract_pan",
  checkAuthUser,
  upload.single("pan_file"),
  extractionPAN
);
router.post("/confirm_extract_pan", checkAuthUser, confirmPanExtraction);
router.get("/process_cams_kra", processCamsKra);
router.get("/verify_cams_kra", verifyPAN);
router.get("/get_user_details", checkAuthUser, getUserDetails);
router.post("/create_digilocker_url", checkAuthUser, createDigilockerUrl);
router.post("/digilocker/webhook", digilockerWebhook);
router.post("/get_digilocker_details", checkAuthUser, getDigilockerDetails);
router.post(
  "/hybrid_bank_account_verification",
  checkAuthUser,
  hybridBankAccountVerification
);
router.post(
  "/reverse_penny_drop_create_link",
  checkAuthUser,
  reversePennyDropCreateLink
);
router.post(
  "/verify_reverse_penny_drop",
  checkAuthUser,
  verifyReversePennyDrop
);
router.post("/confirm_bank", checkAuthUser, confirmBankDetails);
router.post("/check_ifsc", checkAuthUser, checkIfscDetails);
router.post("/upload_bank_proof", checkAuthUser, uploadBankProof);
router.post("/create_ipv_url", checkAuthUser, createIPVUrl);
router.post("/get_ipv_details", checkAuthUser, getIPVDetails);
router.post("/send_ipv_email", checkAuthUser, sendIPVEmail);
router.get("/check_ipv_status", checkAuthUser, checkIPVStatus);
router.post("/save_geo_location", checkAuthUser, saveGeoLocation);
router.post("/submit_manual_kyc", checkAuthUser, submitManualKyc);
router.post("/submit_profile", checkAuthUser, submitProfile);
router.get("/get_profile", checkAuthUser, getProfileData);
router.get("/get_address", checkAuthUser, getAddressData);
router.post("/submit_exchange", checkAuthUser, submitExchange);
router.get("/get_exchange", checkAuthUser, getExchangeData);
router.post("/save_ddpi_consent", checkAuthUser, saveDDPIConsent);

export default router;
