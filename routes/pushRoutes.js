import express from "express";
import { checkAuthUser, requireRole } from "../middlewares/auth-middleware.js";
import { pushToSharePro } from "../controllers/pushShareProController.js";
import { pushToNSE } from "../controllers/pushNSEController.js";
import { pushToBSE_MFI } from "../controllers/pushBseMfiController.js";
import { pushKRA } from "../controllers/pushKRAController.js";
import { uploadBse } from "../controllers/uploadBseController.js";
import { generateCkycBulkZip } from "../controllers/pushCKYC.js";
import { 
  cdslAuthenticate, 
  pushToCDSL, 
  modifyBOAccount, 
  checkUploadStatus, 
  downloadResponseFile,
  testCdslAuth,
  getPublicCDSLStatusByMobile,
  markDPPendingByMobile
} from "../controllers/pushCDSL.js";

// Only Scrutiny Officer, Supervisor and Admin can manage push operations
const adminAndSupervisor = requireRole([ "Scrutiny Officer", "Supervisor", "Admin" ]);

const router = express.Router();

// Direct Test Routes for Authentication (No userId required, supports GET and POST)
router.all("/push_to_cdsl/test_auth", testCdslAuth);

// Public Status Route by Mobile (No auth required, accepts ?mobile=9026199181 in query params)
router.get("/push_to_cdsl/public_status", getPublicCDSLStatusByMobile);
router.get("/push_to_cdsl/status_by_mobile", getPublicCDSLStatusByMobile);

// Public Mark Pending Route by Mobile (No auth required, supports GET & POST)
// Usage: GET /api/admin/push_to_cdsl/mark_pending?mobile=9026199181
//        GET /api/admin/push_to_cdsl/mark_pending/9026199181
router.get("/push_to_cdsl/mark_pending", markDPPendingByMobile);
router.get("/push_to_cdsl/mark_pending/:mobile", markDPPendingByMobile);
router.post("/push_to_cdsl/mark_pending", markDPPendingByMobile);

router.post("/push_to_sharepro/:userId", checkAuthUser, adminAndSupervisor, pushToSharePro);


router.post("/push_to_nse/:userId", checkAuthUser, adminAndSupervisor, pushToNSE);
router.post("/upload_bse/:userId", checkAuthUser, adminAndSupervisor, uploadBse);

//Mutual fund
router.post("/push_to_bse_mfi/:userId", checkAuthUser, adminAndSupervisor, pushToBSE_MFI);


router.post("/push_to_kra/:userId", checkAuthUser, adminAndSupervisor, pushKRA);

// CDSL Routes (DP)
router.post("/push_to_cdsl/auth/:userId", checkAuthUser, adminAndSupervisor, cdslAuthenticate);
router.post("/push_to_cdsl/setup/:userId", checkAuthUser, adminAndSupervisor, pushToCDSL);
router.post("/push_to_cdsl/modify/:userId", checkAuthUser, adminAndSupervisor, modifyBOAccount);
router.post("/push_to_cdsl/status/:userId", checkAuthUser, adminAndSupervisor, checkUploadStatus);
router.get("/push_to_cdsl/status/:userId", checkAuthUser, adminAndSupervisor, checkUploadStatus);
router.all("/push_to_cdsl/check_status/:userId", checkAuthUser, adminAndSupervisor, checkUploadStatus);
router.post("/push_to_cdsl/download/:userId", checkAuthUser, adminAndSupervisor, downloadResponseFile);


//CKYC 
router.post("/generate_ckyc_bulk", checkAuthUser, adminAndSupervisor, generateCkycBulkZip);

export default router;
