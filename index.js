import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import connectDB from "./config/connectDB.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { swaggerOptions } from "./swagger/swaggerOptions.js";
import branchRoutes from "./routes/branchRoutes.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import authRoutes from "./routes/adminAuthRoutes.js";
import referralRoutes from "./routes/referralRoutes.js";
import schemeRoutes from "./routes/schemeRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import logsRoutes from "./routes/logsRoutes.js";

import userAuthRoutes from "./routes/userAuthRoutes.js";
import kycRoutes from "./routes/kycRoutes.js";
import pdfRoutes from "./routes/pdfRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import aaRoutes from "./routes/accountAggregatorRoutes.js";
import signatureRoutes from "./routes/signatureRoutes.js";
import approvalRoutes from "./routes/approveRoutes.js";
import manageUserDetailsRoutes from "./routes/manageUserDetailsRoutes.js";
import masterRoutes from "./routes/masterRoutes.js";
import bseConfigRoutes from "./routes/bseConfigRoutes.js";
import bseExchangeConfigRoutes from "./routes/bseExchangeConfigRoutes.js";
import pushRoutes from "./routes/pushRoutes.js";
import nseConfigRoutes from "./routes/nseConfigRoutes.js";
import camsConfigRoutes from "./routes/camsConfigRoutes.js";
import cdslConfigRoutes from "./routes/cdslConfigRoutes.js";
import pushManageRoutes from "./routes/pushManageRoute.js";
import dpIdRoutes from "./routes/dpIdRoutes.js";
import uploadsProxyRouter from "./routes/uploadsProxy.js";
import settingRoutes, { adminSettingRouter } from "./routes/settingRoutes.js";
import { ensureBucket } from "./utils/minioClient.js";
import { generateDemoPdf } from "./utils/generateDevPdf.js";
import cron from "node-cron";
import { checkPendingCDSLUploads } from "./controllers/pushCDSL.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
dotenv.config();

//Cors policy
app.use(cors());

// Request logger middleware
app.use(requestLogger);

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      docExpansion: "none", // collapse all endpoints initially
      filter: true, // add a search box
      displayRequestDuration: true, // show request duration
      deepLinking: true, // enable deep linking
      defaultModelsExpandDepth: 1, // collapse
    },
  })
);

// Serve static files from the 'models' directory
app.use("/models", express.static(path.join(__dirname, "models")));

// MinIO File Proxy for /uploads
app.use("/uploads", uploadsProxyRouter);

// Serve static files from the assets directory
app.use("/assets", express.static(path.join(__dirname, "assets")));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

//JSON with increased payload limit
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Admin routes
app.use("/admin", branchRoutes);
app.use("/admin", authRoutes);
app.use("/admin", adminUserRoutes);
app.use("/admin", referralRoutes);
app.use("/admin", schemeRoutes);
app.use("/admin", logsRoutes);

app.use("/api/admin", dashboardRoutes);
app.use("/api/admin", approvalRoutes);
app.use("/api/admin", manageUserDetailsRoutes);
app.use("/api/admin", masterRoutes);
app.use("/api/admin", bseConfigRoutes);
app.use("/api/admin", bseExchangeConfigRoutes);
app.use("/api/admin", nseConfigRoutes);
app.use("/api/admin", cdslConfigRoutes);
app.use("/api/admin", camsConfigRoutes);
app.use("/api/admin", pushRoutes);
app.use("/api/admin/push-manage", pushManageRoutes);
app.use("/api/admin", dpIdRoutes);

//User Routes
app.use("/api", userAuthRoutes);
app.use("/api", kycRoutes);
app.use("/api", pdfRoutes);
app.use("/api", contractRoutes);
app.use("/api", locationRoutes);
app.use("/api", aaRoutes);
app.use("/api", uploadRoutes);
app.use("/api", signatureRoutes);
app.use("/api/setting", settingRoutes);
app.use("/api/admin/setting", adminSettingRouter);

const PORT = process.env.PORT || 9005;

//Connect Database & MinIO
connectDB();
ensureBucket();

// ── Daily CDSL Pending Status Reconciliation ─────────────────────────────────
// Runs every day at 8:00 PM IST (= 14:30 UTC)
// Checks all users with pending CDSL uploads and updates their status
cron.schedule("30 14 * * *", async () => {
  console.log("⏰ [CRON] CDSL Daily Status Check triggered at", new Date().toISOString());
  try {
    await checkPendingCDSLUploads();
  } catch (err) {
    console.error("💥 [CRON] CDSL daily job error:", err.message);
  }
}, {
  timezone: "UTC",  // 14:30 UTC = 20:00 IST
});
console.log("📅 [CRON] CDSL daily status check scheduled at 8:00 PM IST (14:30 UTC)");
// ─────────────────────────────────────────────────────────────────────────────

// Home route
app.get("/", (req, res) => {
  res.send("✅ Admin Server is up and running.");
});

// Demo KYC PDF direct routes
app.get(["/demokyc", "/demokyc.pdf", "/demo_kyc", "/demo_kyc.pdf"], (req, res) => {
  const pdfPath = path.join(__dirname, "public/demo_kyc.pdf");
  res.setHeader("Content-Type", "application/pdf");
  res.sendFile(pdfPath);
});

//Load Routes

app.use("/api", uploadRoutes);

// Global error handler
// app.use((err, req, res, next) => {
//   console.error("❌ Unhandled error:", err.message);
//   res.status(500).json({
//     success: false,
//     message: "Internal server error"
//   });
// });

app.listen(PORT, () => {
  console.log(`🚀 Server started successfully on port ${PORT}`);

  if (
    process.env.NODE_ENV === "development" &&
    (process.env.MAKE_DEV_PDF === "true" || process.env.MAKE_DEV_PDF === "ture")
  ) {
    generateDemoPdf().catch((err) =>
      console.error("❌ Error generating demo PDF on startup:", err)
    );
  }
});
