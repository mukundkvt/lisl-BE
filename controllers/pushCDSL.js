import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import User from "../models/User.js";
import CdslConfig from "../models/CdslConfig.js";
import crypto from "crypto";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";
import { getFileBufferFromMinio } from "../utils/minioClient.js";
import sharp from "sharp";
import { 
  generateBOSetupFile,
  generateUDiFFCSV,
  generateBOModifyFile,
  createBOSetupZip,
  parseCDSLResponseFile,
  encryptCdslBuffer,
  sendCdslRequest,
} from "../utils/cdslUDiFFGenerator.js";

// ============================================
// Dynamic CDSL Configuration Helper (Strictly Database)
// ============================================
export const getActiveCdslConfig = async () => {
  try {
    const config = await CdslConfig.findOne().sort({ createdAt: -1 });
    if (config) {
      return {
        dpId: config.dpId,
        userId: config.userId,
        password: config.password,
        aesKey: config.aesKey,
        referer: config.referer,
        authUrl: config.authUrl,
        uploadUrl: config.uploadUrl,
        statusUrl: config.statusUrl,
        downloadUrl: config.downloadUrl,
        modifyUrl: config.modifyUrl,
        lastBatchNumber: config.lastBatchNumber,
      };
    }
  } catch (err) {
    console.error("💥 Error reading CdslConfig from DB:", err.message);
  }

  return null;
};

/**
 * Sequential CDSL Batch Number Generator starting from 32000
 */
export const getNextCdslBatchNumber = async () => {
  try {
    let config = await CdslConfig.findOne().sort({ createdAt: -1 });
    if (!config) {
      config = await CdslConfig.create({ lastBatchNumber: 32000 });
    }
    let nextBatch = (config.lastBatchNumber || 32000) + 1;
    if (nextBatch < 32000) nextBatch = 32001;
    
    config.lastBatchNumber = nextBatch;
    await config.save();
    
    const batchStr = String(nextBatch).padStart(5, "0");
    console.log(`🔢 [CDSL] Generated Sequential Batch Number: ${batchStr} (starting from 32000)`);
    return batchStr;
  } catch (err) {
    console.error("💥 Error generating sequential batch number:", err.message);
    return "32001";
  }
};

// ============================================
// Utility Functions
// ============================================

/**
 * SHA256 Hash - Returns uppercase hex string
 */
const sha256HexUpper = (data) => {
  const input = typeof data === "string" ? data : JSON.stringify(data);
  return crypto.createHash("sha256").update(input, "utf8").digest("hex").toUpperCase();
};

/**
 * SHA256 Hash for File Buffer
 */
const sha256File = (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
};

/**
 * Derives encryption key from AES Key string (32 bytes UTF-8 or Hex)
 */
const getEncryptionKey = (key) => {
  if (!key || typeof key !== "string") {
    throw new Error("AES Key is missing or invalid");
  }

  // If 64 hex characters (32 bytes), parse as hex
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, "hex");
  }

  // Otherwise, use raw UTF-8 bytes of the key string (as per CDSL C# reference code)
  // Pad to 32 bytes if shorter, trim if longer
  let keyBuffer = Buffer.from(key, "utf8");
  if (keyBuffer.length < 32) {
    const paddedKey = Buffer.alloc(32);
    keyBuffer.copy(paddedKey);
    return paddedKey;
  }
  return keyBuffer.slice(0, 32);
};

/**
 * AES Encryption using RijndaelManaged equivalent (AES-256-CBC)
 */
const encryptAES = (data, key) => {
  const input = typeof data === "string" ? data : JSON.stringify(data);
  
  const keyBuffer = getEncryptionKey(key);
  
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuffer, iv);
  cipher.setAutoPadding(true);
  
  const encrypted = Buffer.concat([
    cipher.update(input, "utf8"),
    cipher.final()
  ]);
  
  return encrypted.toString("base64");
};

/**
 * Helper to fetch image buffer from MinIO, URL, backend base URL, base64 data URI, or filesystem
 */
const getImageBuffer = async (source) => {
  if (!source) return null;
  try {
    // 1. If already a Buffer
    if (Buffer.isBuffer(source)) return source;

    if (typeof source === "string") {
      const cleanSource = source.trim();

      // 2. Data URL (Base64)
      if (cleanSource.startsWith("data:")) {
        const base64Data = cleanSource.split(",")[1] || cleanSource;
        return Buffer.from(base64Data, "base64");
      }

      // 3. Pure Base64 string
      if (
        !cleanSource.startsWith("http://") &&
        !cleanSource.startsWith("https://") &&
        !cleanSource.startsWith("/") &&
        !cleanSource.startsWith("uploads/") &&
        cleanSource.length > 200
      ) {
        return Buffer.from(cleanSource, "base64");
      }

      // 4. Try MinIO first (for 'uploads/filename.ext', '/uploads/...', or raw object key)
      if (!cleanSource.startsWith("http://") && !cleanSource.startsWith("https://")) {
        const minioBuffer = await getFileBufferFromMinio(cleanSource);
        if (minioBuffer && minioBuffer.length > 0) {
          return minioBuffer;
        }
      }

      // 5. Local file path check
      if (fs.existsSync(cleanSource)) {
        return fs.readFileSync(cleanSource);
      }

      // 6. Remote HTTP / HTTPS URL
      if (cleanSource.startsWith("http://") || cleanSource.startsWith("https://")) {
        const response = await axios.get(cleanSource, {
          responseType: "arraybuffer",
          timeout: 15000,
        });
        return Buffer.from(response.data);
      }

      // 7. Relative path with Backend Base URL fallback
      const backendUrl =
        process.env.BACKEND_URL ||
        process.env.BASE_URL ||
        `http://localhost:${process.env.PORT || 9005}`;
      const fullUrl = `${backendUrl.replace(/\/+$/, "")}/${cleanSource.replace(/^\/+/, "")}`;

      console.log(`🌐 [CDSL] Fetching image via backend URL: ${fullUrl}`);
      const fallbackResponse = await axios.get(fullUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
      });
      return Buffer.from(fallbackResponse.data);
    }
  } catch (err) {
    console.error("⚠️ Failed to load image buffer for source:", source, "-", err.message);
  }
  return null;
};

/**
 * Compresses image buffer to meet CDSL file size limits (max 15KB for signature)
 * If image is <= 15KB, NO compression is performed.
 * If image is > 15KB, it compresses it down between 10KB-15KB (max 15KB).
 */
const optimizeImageForCdsl = async (buffer, type = "signature") => {
  if (!buffer || !Buffer.isBuffer(buffer)) return buffer;
  const maxAllowedBytes = 15 * 1024; // 15 KB

  // If already <= 15KB, do not compress!
  if (buffer.length <= maxAllowedBytes) {
    console.log(`🖼️ [CDSL] ${type} is already ${buffer.length} bytes (${(buffer.length / 1024).toFixed(2)} KB <= 15 KB). No compression needed.`);
    return buffer;
  }

  // Only compress if higher than 15 KB
  try {
    const isPhoto = type === "photo";
    const maxWidth = isPhoto ? 300 : 400;
    const maxHeight = isPhoto ? 400 : 200;

    let quality = 85;
    let compressed = await sharp(buffer)
      .resize({ width: maxWidth, height: maxHeight, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();

    while (compressed.length > maxAllowedBytes && quality > 20) {
      quality -= 5;
      compressed = await sharp(buffer)
        .resize({ width: maxWidth, height: maxHeight, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer();
    }

    console.log(`🖼️ [CDSL] Compressed ${type} image (>15KB): ${buffer.length} bytes -> ${compressed.length} bytes (${(compressed.length / 1024).toFixed(2)} KB)`);
    return compressed;
  } catch (err) {
    console.warn(`⚠️ [CDSL] Could not compress ${type} image with sharp:`, err.message);
    return buffer;
  }
};

/**
 * Internal Authentication Helper
 * Used by other functions when token is missing or expired
 */
export const authenticateInternal = async (overrideConfig = null) => {
  try {
    const baseConfig = await getActiveCdslConfig();
    const config = overrideConfig ? { ...baseConfig, ...overrideConfig } : baseConfig;
    console.log("============================================");
    console.log(`🔐 [CDSL] [Step: Auth] Internal Authentication Triggered (${config.authUrl})`);
    console.log("============================================");
    
    if (!config || !config.authUrl || !config.dpId || !config.userId || !config.password || !config.aesKey) {
      console.error("❌ [CDSL] [Step: Auth] Configuration missing in database!");
      return { success: false, error: "CDSL DP configuration missing in database. Please configure it in the Admin Panel." };
    }

    console.log("📌 [CDSL] Config check:", {
      authUrl: config.authUrl ? `✓ (${config.authUrl})` : "✗ MISSING",
      dpId: config.dpId ? `✓ (${config.dpId})` : "✗ MISSING",
      user: config.userId ? `✓ (${config.userId})` : "✗ MISSING",
      password: config.password ? "✓ (Set)" : "✗ MISSING",
      aesKey: config.aesKey ? "✓ (Set, 32 bytes)" : "✗ MISSING",
      referer: config.referer ? `✓ (${config.referer})` : "✗ MISSING",
    });

    console.log("🔒 [CDSL] [Step: Auth] Encrypting credentials...");
    const encryptedPassword = encryptAES(config.password, config.aesKey);
    
    const body = {
      DPID: String(config.dpId),
      UserID: String(config.userId),
      Password: encryptedPassword,
    };
    
    const bodyHash = sha256HexUpper(JSON.stringify(body));
    const authSign = encryptAES(bodyHash, config.aesKey);
    
    console.log("📦 [CDSL] [Step: Auth] Request Headers & Body:", {
      AuthSign: authSign ? `${authSign.substring(0, 20)}...` : "NONE",
      Referer: config.referer,
      Body: { DPID: body.DPID, UserID: body.UserID, Password: body.Password }
    });

    console.log(`📡 [CDSL] [Step: Auth] Calling POST ${config.authUrl} ...`);
    const response = await sendCdslRequest(config, {
      url: config.authUrl,
      method: "POST",
      jsonBody: body,
      headers: {
        "Referer": config.referer,
        "AuthSign": authSign,
      }
    });

    console.log(`📥 [CDSL] [Step: Auth] Response Status: ${response.status}`);
    console.log("📥 [CDSL] [Step: Auth] Response Body:", JSON.stringify(response.data, null, 2));

    const success = response?.data?.success || response?.data?.Body?.success || false;
    const authToken = response?.data?.AuthToken || response?.data?.Body?.AuthToken || "";
    
    if (success && authToken) {
      console.log(`✅ [CDSL] [Step: Auth] Token Generated: ${authToken}`);
      return { success: true, authToken };
    } else {
      console.error("❌ [CDSL] [Step: Auth] Auth failed response:", response.data);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.error("💥 [CDSL] [Step: Auth] Internal Auth Error:", error.message);
    if (error.code) console.error("💥 [CDSL] Error Code:", error.code);
    if (error.response) {
      console.error("💥 [CDSL] Error Response Status:", error.response.status);
      console.error("💥 [CDSL] Error Response Data:", JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
};

export const authenticateCDSL = authenticateInternal;

// ============================================
// API Functions
// ============================================

/**
 * CDSL Authentication API
 */
export const cdslAuthenticate = async (req, res) => {
  try {
    const userId = req.params?.userId;
    const user = userId ? await User.findById(userId) : null;
    const config = await getActiveCdslConfig();
    
    console.log("============================================");
    console.log("🔐 [CDSL] [API: cdslAuthenticate] Request Received");
    console.log(`User ID: ${userId || "N/A"}`);
    console.log("============================================");

    if (!config || !config.authUrl || !config.dpId || !config.userId || !config.password || !config.aesKey) {
      console.error("❌ [CDSL] Config validation failed!");
      return res.status(400).json({
        success: false,
        message: "CDSL DP configuration missing in database. Please configure it in the Admin Panel.",
        config: config
          ? {
              authUrl: config.authUrl ? "✓" : "✗",
              dpId: config.dpId ? "✓" : "✗",
              userId: config.userId ? "✓" : "✗",
              password: config.password ? "✓" : "✗",
              aesKey: config.aesKey ? "✓" : "✗",
              referer: config.referer ? "✓" : "✗",
            }
          : "No CDSL configuration record found in database",
      });
    }

    const encryptedPassword = encryptAES(config.password, config.aesKey);
    
    const body = {
      DPID: String(config.dpId),
      UserID: String(config.userId),
      Password: encryptedPassword,
    };
    
    const bodyHash = sha256HexUpper(JSON.stringify(body));
    const authSign = encryptAES(bodyHash, config.aesKey);
    
    console.log(`📡 [CDSL] Sending auth request to: ${config.authUrl} ...`);
    const response = await axios.post(config.authUrl, body, {
      headers: { 
        "Content-Type": "application/json",
        "Referer": config.referer,
        "AuthSign": authSign,
      },
      timeout: 30000
    });

    console.log(`📥 [CDSL] Response Status: ${response.status}`);
    console.log("📥 [CDSL] Response Data:", JSON.stringify(response.data, null, 2));

    const success = response?.data?.success || response?.data?.Body?.success || false;
    const authToken = response?.data?.AuthToken || response?.data?.Body?.AuthToken || "";
    
    if (success && authToken) {
      console.log("✅ [CDSL] Authentication Successful!");
      console.log(`AuthToken: ${authToken}`);
      console.log("============================================");
      
      if (user) {
        if (!user.pushTo) user.pushTo = {};
        if (!user.pushTo.uploadToDP) user.pushTo.uploadToDP = { logs: [], status: "pending" };
        user.pushTo.uploadToDP.authToken = authToken;
        user.pushTo.uploadToDP.logs.push({
          timestamp: getISTDate(new Date()),
          action: "cdsl_authenticate",
          payload: { DPID: config.dpId, UserID: config.userId },
          response: response.data,
        });
        await user.save();
      }
      
      return res.status(200).json({
        success: true,
        message: "CDSL Authentication successful",
        authToken: authToken,
        data: response.data,
      });
    } else {
      console.error("❌ [CDSL] Authentication Failed!");
      console.error("Response:", JSON.stringify(response.data, null, 2));
      console.log("============================================");
      
      if (user) {
        if (!user.pushTo) user.pushTo = {};
        if (!user.pushTo.uploadToDP) user.pushTo.uploadToDP = { logs: [], status: "pending" };
        user.pushTo.uploadToDP.logs.push({
          timestamp: getISTDate(new Date()),
          action: "cdsl_authenticate",
          payload: { DPID: config.dpId, UserID: config.userId },
          response: response.data,
        });
        await user.save();
      }

      return res.status(400).json({
        success: false,
        message: "CDSL Authentication failed",
        error: response.data?.AuthResponse || response.data?.Body?.AuthResponse || response.data,
      });
    }
  } catch (error) {
    console.error("============================================");
    console.error("💥 [CDSL] Authentication Error:", error.message);
    if (error.code) console.error("💥 [CDSL] Error Code:", error.code);
    if (error.response) {
      console.error("💥 [CDSL] Response Status:", error.response.status);
      console.error("💥 [CDSL] Response Data:", JSON.stringify(error.response.data, null, 2));
    }
    console.error("============================================");
    
    const userId = req.params?.userId;
    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user) {
          user.pushTo.uploadToDP.status = "failed";
          user.pushTo.uploadToDP.logs.push({
            timestamp: getISTDate(new Date()),
            action: "authentication",
            payload: {},
            response: { 
              error: error.message, 
              responseData: error.response?.data,
              stack: error.stack 
            },
          });
          await user.save();
        }
      } catch {}
    }
    
    return res.status(500).json({
      success: false,
      message: "Internal server error during CDSL authentication",
      error: error.message,
      details: error.response?.data || null
    });
  }
};

/**
 * BO Setup Upload API (HrmSetUpload)
 */
export const pushToCDSL = async (req, res) => {
  try {
    const userId = req.params?.userId;
    const config = await getActiveCdslConfig();

    if (!config || !config.uploadUrl || !config.dpId || !config.aesKey) {
      return res.status(400).json({
        success: false,
        message: "CDSL DP configuration missing in database. Please configure it in the Admin Panel.",
      });
    }

    console.log("============================================");
    console.log("📤 [CDSL] [Step 1/12] BO Setup Upload Initiated");
    console.log(`User ID: ${userId || "N/A"}`);
    console.log(`Endpoint URL: ${config.uploadUrl}`);
    console.log(`Referer: ${config.referer}`);
    console.log("============================================");

    const user = await User.findById(userId);

    if (!user) {
      console.error("❌ [CDSL] [Step 1/12] User not found with ID:", userId);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`👤 [CDSL] [Step 1/12] User Loaded: ${user.name?.fullName || user.PAN || user._id}`);
    console.log(`📋 [CDSL] [Step 1/12] User DP ID: ${user.dpId || "NOT ASSIGNED (Fallback: " + config.dpId + ")"}`);

    const allApproved = Object.values(user.approvals || {}).every(
      (approval) => approval.status === "approved"
    );

    console.log("🔍 [CDSL] [Step 1/12] Approvals Status:", {
      allApproved,
      signedByClient: !!user.digitalSignatureContract?.signedByClient,
    });

    if (!allApproved || !user.digitalSignatureContract?.signedByClient) {
      console.error("❌ [CDSL] [Step 1/12] Approvals or Digital Signature missing!");
      return res.status(400).json({
        success: false,
        message: "Cannot push data to CDSL. Approvals or Digital Signature missing.",
      });
    }

    // Step 2: Fresh Auth Token Acquisition
    console.log("🔐 [CDSL] [Step 2/12] Authenticating to acquire a fresh session token...");
    const authResult = await authenticateInternal();
    if (!authResult.success) {
      console.error("❌ [CDSL] [Step 2/12] Authentication failed:", authResult.error);
      return res.status(401).json({
        success: false,
        message: "Failed to authenticate with CDSL",
        error: authResult.error,
      });
    }
    const authToken = authResult.authToken;
    if (!user.pushTo) user.pushTo = {};
    if (!user.pushTo.uploadToDP) user.pushTo.uploadToDP = { logs: [], status: "pending" };
    user.pushTo.uploadToDP.authToken = authToken;
    console.log(`✅ [CDSL] [Step 2/12] Fresh token acquired: ${authToken.substring(0, 25)}...`);

    // Step 3: Extract and structure Nominees
    console.log("👥 [CDSL] [Step 3/12] Processing Nominees (up to 3)...");
    const formattedNominees = (user.nominees || []).slice(0, 3).map((nom, index) => {
      let isMinor = "N";
      let dobIso = "";
      if (nom?.dob?.year && nom?.dob?.month && nom?.dob?.day) {
        const y = parseInt(nom.dob.year);
        const m = parseInt(nom.dob.month) - 1;
        const d = parseInt(nom.dob.day);
        const bDate = new Date(y, m, d);
        if (!isNaN(bDate.getTime())) {
          // Store as YYYY-MM-DD so the generator can use it directly
          dobIso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const age = Math.floor((Date.now() - bDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          isMinor = age < 18 ? "Y" : "N";
        }
      }
      return {
        serialNumber: index + 1,
        name: nom.name || "",
        relation: nom.relation || "",
        sharePercentage: nom.sharePercentage || (user.nominees.length === 1 ? "100" : ""),
        dob: dobIso,
        isMinor: isMinor,
        pan: nom.identityType === "PAN" ? (nom.identityNumber || "") : "",
        mobile: nom.mobile || "",
        email: nom.email || "",
        address: {
          line1: nom.address?.addressLine1 || "",
          line2: nom.address?.addressLine2 || "",
          line3: nom.address?.addressLine3 || "",
          city: nom.address?.city || "",
          state: nom.address?.state || "",
          pincode: nom.address?.pincode || "",
          country: nom.address?.country || "INDIA",
        },
        guardian: isMinor === "Y" && nom.guardian ? {
          name: nom.guardian.name || "",
          relation: nom.guardian.relation || "",
          pan: nom.guardian.identityType === "PAN" ? (nom.guardian.identityNumber || "") : "",
          mobile: nom.guardian.mobile || "",
          email: nom.guardian.email || "",
        } : null,
      };
    });

    const hasNominee = formattedNominees.length > 0 && !!formattedNominees[0].name;
    console.log(`👥 [CDSL] [Step 3/12] Nominees found: ${formattedNominees.length}, hasNominee: ${hasNominee}`);
    if (hasNominee) {
      formattedNominees.forEach((n, idx) => {
        console.log(`   Nominee #${idx + 1}: ${n.name} (${n.relation}, Share: ${n.sharePercentage}%, Minor: ${n.isMinor})`);
      });
    }

    // Step 4: Build User Data Object
    console.log("📝 [CDSL] [Step 4/12] Preparing User Data payload...");
    const uploadId = "08";
    const panClean = (user.pan_card?.pan_number || user.PAN || "").toUpperCase().trim();
    const batchNumber = await getNextCdslBatchNumber();
    const batchPadded  = String(batchNumber).padStart(5, "0");  // e.g. 00731
    const recordNum = String(1).padStart(4, "0");
    const sigFileName = `B${batchPadded}${recordNum}SIGN.TIFF`;  // e.g. B007310001SIGN.TIFF
    const photoFileName = `B${batchPadded}${recordNum}PHOTO.JPG`;

    const userStrName = typeof user.name === "string" ? user.name : (user.name?.full_name || user.name?.fullName || "");
    const fatherStrName = typeof user.fatherName === "string" ? user.fatherName : (user.father_name || user.fatherName?.fullName || "");
    const motherStrName = typeof user.motherName === "string" ? user.motherName : (user.mother_name || user.motherName?.fullName || "");

    const userData = [{
      boId: user.boId || user.dpId || user.dp_id || "",
      accountType: user.accountType || "01",
      categoryType: user.categoryType || "0101",
      pan: panClean,
      panVerified: "Y",
      name: {
        title: user.gender === "Female" || user.gender === "female" ? "MS" : "MR",
        firstName: user.first_name || user.name?.firstName || (userStrName ? userStrName.split(" ")[0] : "") || "",
        middleName: user.middle_name || user.name?.middleName || "",
        lastName: user.last_name || user.name?.lastName || (userStrName ? userStrName.split(" ").slice(1).join(" ") : "") || "",
      },
      fatherName: {
        title: "MR",
        firstName: user.father_first_name || user.fatherName?.firstName || (fatherStrName ? fatherStrName.split(" ")[0] : "") || "",
        middleName: user.father_middle_name || user.fatherName?.middleName || "",
        lastName: user.father_last_name || user.fatherName?.lastName || (fatherStrName ? fatherStrName.split(" ").slice(1).join(" ") : "") || "",
      },
      motherName: {
        title: "MS",
        firstName: user.mother_first_name || user.motherName?.firstName || (motherStrName ? motherStrName.split(" ")[0] : "") || "",
        middleName: user.mother_middle_name || user.motherName?.middleName || "",
        lastName: user.mother_last_name || user.motherName?.lastName || (motherStrName ? motherStrName.split(" ").slice(1).join(" ") : "") || "",
      },
      gender: user.gender === "Female" || user.gender === "female" ? "F" : "M",
      maritalStatus: user.maritalStatus === "married" || user.marital_status === "Married" ? "02" : "01",
      nationality: "IN",
      occupation: user.occupation || "01",
      dob: user.dob || user.dateOfBirth || "",
      email: user.email || "",
      mobile: user.mobileNumber || user.mobile_number || user.mobile || "",
      aadhaar_number: user.aadhaar_number || "",
      addressProof: user.addressProof || null,
      
      permAddress: {
        address1: user.address?.addressLine1 || user.address?.address_line1 || user.address?.full_address || "",
        address2: user.address?.addressLine2 || user.address?.address_line2 || "",
        address3: user.address?.addressLine3 || user.address?.address_line3 || "",
        city: user.address?.city || "",
        state: user.address?.state || "",
        stateCode: user.address?.stateCode || "",
        pincode: user.address?.pincode || "",
        country: user.address?.country || "IN",
      },
      
      corrAddress: user.correspondence_address || user.address,
      
      bankDetails: {
        accountNumber: user.bank_account_details?.account_number || user.bank_details?.account_number || "",
        accountType: user.bank_account_details?.account_type === "current" ? "CA" : "SB",
        ifscCode: (user.bank_account_details?.ifsc_code || user.bank_details?.ifsc_code || "").toUpperCase().trim(),
        micrCode: user.bank_account_details?.micr_code || user.bank_details?.micr_code || "",
        bankName: user.bank_account_details?.bank_name || user.bank_details?.bank_name || "",
        branchName: user.bank_account_details?.branch || user.bank_details?.branch_name || "",
      },
      
      noNominationFlag: hasNominee ? "N" : "Y",
      nominees: formattedNominees,
      
      taxStatus: user.tax_status || "01",
      annualIncome: user.annualIncome || user.annual_income || "",
      netWorth: user.networth?.amount || user.net_worth || "",
      netWorthDate: user.networth?.date || "",
      tradingExperience: user.trading_experience ? "Y" : "N",
      eCorrespondence: "Y",

      ddpiConcent: user.ddpiConcent || {},
      clientCode: user.clientCode || user.client_code || "",
      lsid: user.lsid || "",

      signatureFile: sigFileName,
      photoFile: photoFileName,
    }];

    // Step 5: Generate UDiFF file (CR1892 pipe-delimited format)
    console.log("📝 [CDSL] [Step 5/12] Generating UDiFF file...");
    const { fileName, content } = generateUDiFFCSV(userData, {
      dpId: config.dpId,
      batchNumber,
      uploadDate: new Date(),
      uploadId,
      userId: config.userId,
    });
    console.log(`📄 [CDSL] [Step 5/12] UDiFF File Name: ${fileName}`);
    console.log("📄 [CDSL] [Step 5/12] File Content:\n" + content);
    // Save for response logging
    const _generatedCsvContent = content;
    const _generatedCsvFileName = fileName;

    console.log("✅ [CDSL] [Step 6/12] UDiFF file generated successfully");

    // For UDiFF HrmSetUpload: include signature file only (no photo).
    // Signature file name: B<batch>0001SIGN.TIFF  (target size 10-15 KB in ZIP)
    const photoFiles = [];
    const sigSource =
      user.signature?.signature_image ||
      user.signature_image ||
      (typeof user.signature === "string" ? user.signature : null);

    if (sigSource) {
      let sigBuffer = await getImageBuffer(sigSource);
      if (sigBuffer) {
        sigBuffer = await optimizeImageForCdsl(sigBuffer, "signature");
        photoFiles.push({ name: sigFileName, buffer: sigBuffer });
        console.log(`   ✓ Signature attachment resolved: ${sigFileName} (${sigBuffer.length} bytes)`);
      }
    } else {
      console.log(`   ⚠️ No signature found for user — ZIP will contain CSV only`);
    }


    // =========================================================================
    // STEP 8-12: CDSL BO SETUP UPLOAD
    // GROUND TRUTH from pushdock/cdsl/BO_UPLD_059100_202608201620_00731.csv.enc.00.zip:
    //   ZIP name:    BO_UPLD_<DPID>_<yyyyMMddHHmm>_<batch>.csv.enc.00.zip
    //   Inside ZIP:  BO_UPLD_<DPID>_<yyyyMMddHHmm>_<batch>.CSV.ENC.00   ← AES encrypted CSV
    //   Inside ZIP:  B<batch>0001SIGN.TIFF                               ← signature image
    //   Endpoint:    https://apigt.cdsl.co.in/Commonweb/api/BOAPI/HrmSetUpload
    // =========================================================================
    console.log("🚀 [CDSL] [Step 8/12] Generating UDiFF Payload & Archive...");

    // Determine upload mode: 'udiff' (Harmonisation via HrmSetUpload) vs 'standard' (CDAS BO Setup via SetupUpload)
    const mode = (req.query?.mode || req.body?.mode || "udiff").toLowerCase();
    const isStandardMode = mode === "standard" || mode === "cdas" || mode === "legacy";

    const cleanDpId = String(config.dpId || "59100").trim().padStart(5, "0").slice(-5);
    const padDateTime = (d) => {
      const p = (n) => String(n).padStart(2, "0");
      const dt = new Date(d);
      return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}${p(dt.getHours())}${p(dt.getMinutes())}`;
    };
    const timeStr = padDateTime(new Date());

    let mainFileName = "";
    let zipFileName = "";
    let fileBufferToZip = null;
    let uploadEndpoint = "";

    if (isStandardMode) {
      // Standard CDAS BO Setup Mode (matches ekyc-admin-new GenarateAndUploadCDSLFileForApi)
      // File Name: 08059100.<batch>
      // ZIP Name:  08059100.<batch>.zip
      // Endpoint:  https://apigt.cdsl.co.in/Commonweb/api/BOAPI/SetupUpload
      const cleanDpId6 = String(config.dpId || "59100").trim().padStart(6, "0").slice(-6);
      mainFileName   = `${uploadId}${cleanDpId6}.${batchPadded}`;
      zipFileName    = `${uploadId}${cleanDpId6}.${batchPadded}.zip`;
      uploadEndpoint = (config.uploadUrl && config.uploadUrl.includes("HrmSetUpload"))
        ? config.uploadUrl.replace("HrmSetUpload", "SetupUpload")
        : (config.uploadUrl || "https://apigt.cdsl.co.in/Commonweb/api/BOAPI/SetupUpload");

      const cdasResult = generateBOSetupFile(userData, {
        dpId: config.dpId,
        batchNumber,
        uploadDate: new Date(),
        uploadId,
      });

      console.log(`📄 [CDSL] [Standard CDAS] Generated: ${cdasResult.fileName}`);
      console.log("📄 [CDSL] Content:\n" + cdasResult.content);
      fileBufferToZip = Buffer.from(cdasResult.content, "utf8");
    } else {
      // Harmonisation UDiFF Mode (matches CDSL Specification V1.4 & UDiFF Catalogue V2.0.0.2)
      // File Name: BO_UPLD_<DPID>_<YYYYMMDDHHMM>_<batch>.CSV.ENC.00
      // ZIP Name:  BO_UPLD_<DPID>_<YYYYMMDDHHMM>_<batch>.csv.enc.00.zip
      // Endpoint:  https://apigt.cdsl.co.in/Commonweb/api/BOAPI/HrmSetUpload
      const baseName = `BO_UPLD_${cleanDpId}_${timeStr}_${batchPadded}`;
      mainFileName   = `${baseName}.CSV.ENC.00`;
      zipFileName    = `${baseName}.csv.enc.00.zip`;
      uploadEndpoint = config.uploadUrl || "https://apigt.cdsl.co.in/Commonweb/api/BOAPI/HrmSetUpload";

      const includeHeader = req.query?.no_header === "true" || req.body?.no_header === true ? false : true;
      const colsCount = req.query?.cols === "178" || req.body?.cols === 178 ? 178 : (req.query?.cols === "182" || req.body?.cols === 182 ? 182 : 184);
      const formatType = req.query?.format || req.body?.format || "udiff_comma";

      const { content: udiffCsvContent } = generateUDiFFCSV(userData, {
        dpId: config.dpId,
        batchNumber,
        uploadDate: new Date(),
        uploadId,
        userId: config.userId,
      }, {
        includeHeader,
        colsCount,
        formatType,
      });

      const rawCsvBuf = Buffer.from(udiffCsvContent, "utf8");
      fileBufferToZip = await encryptCdslBuffer(rawCsvBuf, config.aesKey, { fileName: `${baseName}.csv` });
      console.log(`📄 [CDSL] [UDiFF Harmonisation] Encrypted CSV: ${fileBufferToZip.length} bytes`);
    }

    console.log(`   Mode:         ${isStandardMode ? "Standard CDAS (SetupUpload)" : "UDiFF Harmonisation (HrmSetUpload)"}`);
    console.log(`   Batch:        ${batchNumber}  (padded: ${batchPadded})`);
    console.log(`   File Inside:  ${mainFileName}`);
    console.log(`   ZIP Name:     ${zipFileName}`);
    console.log(`   Signature:    ${sigFileName}`);
    console.log(`   Endpoint:     ${uploadEndpoint}`);

    const archiver = (await import("archiver")).default;

    // Auth sign: SHA256 of body JSON → AES encrypt
    const body = { UploadId: uploadId, Signature: "" };
    const bodyHash = sha256HexUpper(JSON.stringify(body));
    const authSign = encryptAES(bodyHash, config.aesKey);

    // Build ZIP: encrypted CSV + face photo (no signature)
    const zipBuffer = await new Promise((resolveZip, rejectZip) => {
      const archive = archiver("zip", { zlib: { level: 9 } });
      const buffers = [];
      archive.on("data", d => buffers.push(d));
      archive.on("error", err => rejectZip(err));
      archive.on("end", () => resolveZip(Buffer.concat(buffers)));

      // 1. Main encrypted CSV file
      archive.append(fileBufferToZip, { name: mainFileName });

      // 2. Signature (B<batch>0001SIGN.TIFF) — targets 10-15 KB ZIP total
      photoFiles.forEach(f => {
        if (f && f.buffer) archive.append(f.buffer, { name: f.name });
      });

      archive.finalize();
    });


    const fileHash = sha256File(zipBuffer);
    console.log(`   ZIP Buffer Size: ${zipBuffer.length} bytes`);
    console.log(`   FileComputeHash: ${fileHash.substring(0, 20)}...`);

    console.log(`📡 [CDSL] Calling POST ${uploadEndpoint} ...`);
    const response = await sendCdslRequest(config, {
      url: uploadEndpoint,
      method: "POST",
      zipFile: {
        buffer: zipBuffer,
        filename: zipFileName,
      },
      fields: {
        UploadId: uploadId,
        Signature: "",
      },
      headers: {
        "AuthToken": authToken,
        "AuthSign": authSign,
        "FileComputeHash": fileHash,
        "Referer": config.referer,
      }
    });

    console.log(`📥 [CDSL] Response Status: ${response.status}`);
    console.log(`📥 [CDSL] Response Body:   ${JSON.stringify(response.data)}`);

    const isSuccess = response?.data?.success || response?.data?.Body?.success || false;
    const ackID = response?.data?.AcknowledgmentID || response?.data?.Body?.AcknowledgmentID || "";

    if (isSuccess || ackID) {
      console.log(`============================================`);
      console.log(`🎉 [CDSL] BO Setup Accepted — Acknowledgment ID: ${ackID}`);
      console.log(`============================================`);

      if (!user.pushTo) user.pushTo = {};
      if (!user.pushTo.uploadToDP) user.pushTo.uploadToDP = { logs: [], status: "pending" };

      // Receipt of ackID only means CDSL accepted the file — not that processing is done.
      // Status starts as "pending" and is updated after live status check.
      user.pushTo.uploadToDP.status = "pending";
      user.pushTo.uploadToDP.acknowledgmentID = ackID;
      user.pushTo.uploadToDP.fileName = zipFileName;
      user.pushTo.uploadToDP.logs.push({
        timestamp: getISTDate(new Date()),
        action: "bo_setup_upload",
        payload: { uploadId, mainFileName, zipFileName, batchNumber, mode },
        response: response.data,
      });

      // =========================================================================
      // STEP 10/12: Immediate Live Status Check
      // Maps CDSL status string → DB status:
      //   "Closed"                   → "success"
      //   "Initiated For processing" → "pending"  (check again later via daily cron)
      //   "Failed" / "Rejected"      → "failed"
      // =========================================================================
      let liveStatus = "";
      let statusResponseData = null;
      if (ackID && config.statusUrl) {
        console.log(`============================================`);
        console.log(`🔍 [CDSL] [Step 10/12] Checking Live Processing Status for: ${ackID} (Max 3 attempts, 3s interval)`);
        console.log(`   Endpoint: ${config.statusUrl}`);
        console.log(`============================================`);

        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            console.log(`⏳ [CDSL] [Step 10/12] Waiting 3 seconds before attempt ${attempt}/${maxAttempts}...`);
            await new Promise(r => setTimeout(r, 3000));

            const statusBody = { AcknowledgmentID: ackID, Signature: "" };
            const statusBodyHash = sha256HexUpper(JSON.stringify(statusBody));
            const statusAuthSign = encryptAES(statusBodyHash, config.aesKey);

            const statusRes = await sendCdslRequest(config, {
              url: config.statusUrl,
              method: "POST",
              jsonBody: statusBody,
              headers: {
                "Referer": config.referer,
                "AuthToken": authToken,
                "AuthSign": statusAuthSign,
              }
            });

            statusResponseData = statusRes.data;
            liveStatus = statusRes.data?.Status || statusRes.data?.Body?.Status || "";
            console.log(`📊 [CDSL] [Step 10/12] Attempt ${attempt}/${maxAttempts} - Live Status: "${liveStatus}"`);
            console.log(`📊 [CDSL] [Step 10/12] Status Response:`, JSON.stringify(statusRes.data));

            // ── Map CDSL status string to DB status ──────────────────────────────
            const cdslStatusLower = liveStatus.toLowerCase().trim();
            let isFinal = false;

            if (cdslStatusLower === "closed") {
              user.pushTo.uploadToDP.status = "success";
              console.log(`✅ [CDSL] Status "Closed" → DB status set to "success"`);
              isFinal = true;
            } else if (
              cdslStatusLower.includes("fail") ||
              cdslStatusLower.includes("reject") ||
              cdslStatusLower.includes("error")
            ) {
              user.pushTo.uploadToDP.status = "failed";
              console.log(`❌ [CDSL] Status "${liveStatus}" → DB status set to "failed"`);
              isFinal = true;
            } else {
              // "Initiated For processing", "Processing", "" or anything else → pending
              user.pushTo.uploadToDP.status = "pending";
              console.log(`⏳ [CDSL] Status "${liveStatus}" → DB status stays "pending"`);
            }

            user.pushTo.uploadToDP.liveStatus = liveStatus;
            user.pushTo.uploadToDP.logs.push({
              timestamp: getISTDate(new Date()),
              action: "status_check",
              payload: { acknowledgmentID: ackID, attempt },
              response: statusRes.data,
            });

            // If we got success or failed, stop immediately
            if (isFinal) {
              console.log(`🏁 [CDSL] [Step 10/12] Final status reached ("${liveStatus}"). Stopping retries.`);
              break;
            } else if (attempt < maxAttempts) {
              console.log(`🔄 [CDSL] [Step 10/12] Status still pending. Retrying in 3 seconds...`);
            }
          } catch (statusErr) {
            console.warn(`⚠️ [CDSL] [Step 10/12] Status check attempt ${attempt} error:`, statusErr.message);
          }
        }
      }

      await user.save();

      const dbStatus = user.pushTo.uploadToDP.status;
      return res.status(200).json({
        success: true,
        message: dbStatus === "success"
          ? "CDSL BO Setup processed successfully"
          : dbStatus === "failed"
            ? "CDSL BO Setup upload failed — check liveStatus for details"
            : "CDSL BO Setup submitted — processing initiated, will be verified by daily job",
        dbStatus,
        acknowledgmentID: ackID,
        liveStatus,
        mainFileName,
        zipFileName,
        batchNumber,
        mode,
        uploadResponse: response.data,
        statusResponse: statusResponseData,
        csvContent: _generatedCsvContent,
        csvFileName: _generatedCsvFileName,
      });
    } else {
      console.error(`❌ [CDSL] BO Setup rejected:`, response.data);

      if (!user.pushTo) user.pushTo = {};
      if (!user.pushTo.uploadToDP) user.pushTo.uploadToDP = { logs: [], status: "pending" };
      user.pushTo.uploadToDP.status = "failed";
      user.pushTo.uploadToDP.logs.push({
        timestamp: getISTDate(new Date()),
        action: "bo_setup_upload",
        payload: { uploadId, mainFileName, zipFileName, batchNumber, mode },
        response: response.data,
      });
      await user.save();

      return res.status(400).json({
        success: false,
        message: "CDSL API rejected upload request",
        error: response.data?.UploadResponse || response.data?.Body?.UploadResponse || response.data,
      });
    }

  } catch (error) {
    console.error("============================================");
    console.error("💥 [CDSL] BO Setup Exception:", error.message);
    if (error.response) {
      console.error("💥 [CDSL] Response Data:", JSON.stringify(error.response.data, null, 2));
    }
    console.error("============================================");

    const userId = req.params?.userId;
    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user) {
          if (!user.pushTo) user.pushTo = {};
          if (!user.pushTo.uploadToDP) user.pushTo.uploadToDP = { logs: [], status: "pending" };
          user.pushTo.uploadToDP.status = "failed";
          user.pushTo.uploadToDP.logs.push({
            timestamp: getISTDate(new Date()),
            action: "bo_setup_upload",
            payload: {},
            response: { 
              error: error.message,
              responseData: error.response?.data,
              stack: error.stack 
            },
          });
          await user.save();
        }
      } catch {}
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error during CDSL push",
      error: error.message,
      details: error.response?.data || null
    });
  }
};

/**
 * BO Modify Upload API (HrmModUpload)
 */
export const modifyBOAccount = async (req, res) => {
  try {
    const userId = req.params?.userId;
    const user = await User.findById(userId);
    const config = await getActiveCdslConfig();
    
    if (!config || !config.uploadUrl || !config.dpId || !config.aesKey) {
      return res.status(400).json({
        success: false,
        message: "CDSL DP configuration missing in database. Please configure it in the Admin Panel.",
      });
    }

    const modifyData = req.body?.modifications || {};
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log("============================================");
    console.log("🔄 [CDSL] BO Account Modification Triggered");
    console.log(`User ID: ${user._id}`);
    console.log(`BO ID: ${user.dpId || "N/A"}`);
    console.log("============================================");

    console.log("🔐 [CDSL] Authenticating for modification to acquire a fresh token...");
    const authResult = await authenticateInternal();
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        error: authResult.error,
      });
    }
    const authToken = authResult.authToken;

    const uploadId = `MOD${Date.now()}`;
    const batchNumber = String(Date.now()).slice(-5);
    
    const records = [{
      boId: user.dpId || config.dpId,
      firstHolderName: `${user.first_name} ${user.last_name}`.trim(),
      pan: user.pan_card?.pan_number || "",
      ...modifyData,
    }];

    const { fileName, content } = generateBOModifyFile(records, {
      dpId: user.dpId || config.dpId,
      batchNumber,
      uploadDate: new Date(),
      uploadId,
    });

    const signatureFiles = [];
    if (modifyData.signatureUrl) {
      signatureFiles.push({
        name: `${user.pan_card?.pan_number}_MOD_SIG.jpg`,
        url: modifyData.signatureUrl,
      });
    }

    const { zipBuffer, fileName: zipFileName } = await createBOSetupZip(
      records,
      signatureFiles,
      {
        dpId: user.dpId || config.dpId,
        batchNumber,
        uploadDate: new Date(),
        uploadId,
      }
    );

    const body = {
      DPID: String(config.dpId),
      UploadId: uploadId,
      Signature: ""
    };
    
    const bodyHash = sha256HexUpper(JSON.stringify(body));
    const authSign = encryptAES(bodyHash, config.aesKey);
    const fileHash = sha256File(zipBuffer);

    console.log(`📡 [CDSL] Sending Modify Upload to: ${config.modifyUrl} ...`);
    const response = await sendCdslRequest(config, {
      url: config.modifyUrl,
      method: "POST",
      zipFile: {
        buffer: zipBuffer,
        filename: zipFileName,
      },
      fields: {
        Body: JSON.stringify(body),
      },
      headers: {
        "AuthToken": authToken,
        "AuthSign": authSign,
        "FileComputeHash": fileHash,
        "Referer": config.referer,
      }
    });

    console.log(`📥 [CDSL] Modify Response Status: ${response.status}`);
    console.log("📥 [CDSL] Modify Response Body:", JSON.stringify(response.data, null, 2));

    const success = response?.data?.success || response?.data?.Body?.success || false;
    const acknowledgmentID = response?.data?.AcknowledgmentID || response?.data?.Body?.AcknowledgmentID || "";

    if (success) {
      console.log("✅ [CDSL] Modification Successful! Acknowledgment ID: " + acknowledgmentID);
      
      user.pushTo.uploadToDP.logs.push({
        timestamp: getISTDate(new Date()),
        action: "bo_modify_upload",
        payload: { uploadId, fileName: zipFileName, modifications: modifyData },
        response: response.data,
      });
      await user.save();
      
      return res.status(200).json({
        success: true,
        message: "Modification request submitted to CDSL",
        acknowledgmentID,
        data: response.data,
      });
    } else {
      console.error("❌ [CDSL] Modification Failed!");
      
      user.pushTo.uploadToDP.logs.push({
        timestamp: getISTDate(new Date()),
        action: "bo_modify_upload",
        payload: { uploadId, fileName: zipFileName },
        response: response.data,
      });
      await user.save();
      
      return res.status(400).json({
        success: false,
        message: "CDSL API rejected modification request",
        error: response.data?.UploadResponse || response.data?.Body?.UploadResponse || response.data,
      });
    }

  } catch (error) {
    console.error("💥 [CDSL] Modification Error:", error.message);
    if (error.response) {
      console.error("💥 [CDSL] Response Data:", JSON.stringify(error.response.data, null, 2));
    }
    
    return res.status(500).json({
      success: false,
      message: "Internal server error during BO modification",
      error: error.message,
      details: error.response?.data || null
    });
  }
};

/**
 * Check Upload Status (Manual / On-demand status check)
 * Usage: POST /api/admin/push_to_cdsl/status/:userId
 * Also handles req.body.acknowledgmentID if passed, or auto-retrieves it from user's record.
 */
export const checkUploadStatus = async (req, res) => {
  try {
    const userId = req.params?.userId;
    let acknowledgmentID = req.body?.acknowledgmentID || req.query?.acknowledgmentID;

    const user = userId ? await User.findById(userId) : null;
    if (userId && !user) {
      return res.status(404).json({
        success: false,
        message: "User not found with provided ID",
      });
    }

    if (!acknowledgmentID && user) {
      acknowledgmentID = user.pushTo?.uploadToDP?.acknowledgmentID || "";
    }

    if (!acknowledgmentID) {
      console.error("❌ [CDSL] Acknowledgment ID missing for status check");
      return res.status(400).json({
        success: false,
        message: "No CDSL Acknowledgment ID found for this user. Please push to CDSL first.",
      });
    }

    const config = await getActiveCdslConfig();
    if (!config || !config.statusUrl || !config.aesKey) {
      console.error("❌ [CDSL] CDSL configuration missing for status check");
      return res.status(500).json({
        success: false,
        message: "CDSL configuration is missing or incomplete.",
      });
    }

    console.log("============================================");
    console.log("🔍 [CDSL] Checking Live Upload Status");
    console.log(`User ID: ${userId || "N/A"}`);
    console.log(`Acknowledgment ID: ${acknowledgmentID}`);
    console.log(`URL: ${config.statusUrl}`);
    console.log("============================================");

    // Obtain fresh authentication token
    const authResult = await authenticateInternal();
    if (!authResult.success) {
      return res.status(500).json({
        success: false,
        message: "CDSL authentication failed: " + (authResult.error || "Unknown authentication error"),
      });
    }
    const authToken = authResult.authToken;

    const body = {
      AcknowledgmentID: acknowledgmentID,
      Signature: ""
    };

    const bodyHash = sha256HexUpper(JSON.stringify(body));
    const authSign = encryptAES(bodyHash, config.aesKey);

    console.log(`📡 [CDSL] Sending Status Check to: ${config.statusUrl} ...`);
    const response = await sendCdslRequest(config, {
      url: config.statusUrl,
      method: "POST",
      jsonBody: body,
      headers: {
        "Referer": config.referer,
        "AuthToken": authToken,
        "AuthSign": authSign,
      }
    });

    console.log(`📥 [CDSL] Status Response:`, JSON.stringify(response.data, null, 2));

    const liveStatus = response?.data?.Status || response?.data?.Body?.Status || "";
    const cdslStatusLower = liveStatus.toLowerCase().trim();

    let newDbStatus = "pending";
    let statusMessage = "";

    if (cdslStatusLower === "closed") {
      newDbStatus = "success";
      statusMessage = "CDSL BO Setup processed successfully (Closed)";
      console.log(`✅ [CDSL] Status "Closed" → DB status set to "success"`);
    } else if (
      cdslStatusLower.includes("fail") ||
      cdslStatusLower.includes("reject") ||
      cdslStatusLower.includes("error")
    ) {
      newDbStatus = "failed";
      const cdslErr = response?.data?.ErrorMessage || response?.data?.Body?.ErrorMessage || response?.data?.Reason || response?.data?.Body?.Reason || "";
      statusMessage = cdslErr ? `CDSL BO Setup failed: ${cdslErr}` : `CDSL BO Setup failed (Status: ${liveStatus})`;
      console.log(`❌ [CDSL] Status "${liveStatus}" → DB status set to "failed"`);
    } else {
      newDbStatus = "pending";
      statusMessage = `CDSL BO Setup is still pending (Status: ${liveStatus || "Initiated For processing"})`;
      console.log(`⏳ [CDSL] Status "${liveStatus}" → DB status stays "pending"`);
    }

    if (user) {
      if (!user.pushTo) user.pushTo = {};
      if (!user.pushTo.uploadToDP) user.pushTo.uploadToDP = { logs: [], status: "pending" };

      user.pushTo.uploadToDP.status = newDbStatus;
      user.pushTo.uploadToDP.liveStatus = liveStatus;
      if (statusMessage) {
        user.pushTo.uploadToDP.message = statusMessage;
      }
      user.pushTo.uploadToDP.logs.push({
        timestamp: getISTDate(new Date()),
        action: "manual_status_check",
        payload: { acknowledgmentID },
        response: response.data,
      });

      await user.save();
    }

    return res.status(200).json({
      success: true,
      status: newDbStatus,
      liveStatus: liveStatus,
      message: statusMessage,
      acknowledgmentID,
      data: response.data,
    });

  } catch (error) {
    console.error("💥 [CDSL] Status Check Error:", error.message);
    if (error.response) {
      console.error("💥 [CDSL] Response:", JSON.stringify(error.response.data, null, 2));
    }

    return res.status(500).json({
      success: false,
      message: "Error checking CDSL upload status",
      error: error.message,
      details: error.response?.data || null
    });
  }
};

/**
 * Public API: Check CDSL Status by Mobile Number
 * Usage: GET/POST /api/push_to_cdsl/public_status?mobile=9026199181
 */
export const getPublicCDSLStatusByMobile = async (req, res) => {
  try {
    const mobile = req.query?.mobile || req.query?.mobileNumber || req.query?.mobile_number || req.body?.mobile || req.body?.mobileNumber;
    
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required in query params (?mobile=9026199181)",
      });
    }

    const cleanMobile = String(mobile).replace(/\D/g, "").slice(-10);
    const user = await User.findOne({
      $or: [
        { mobile_number: cleanMobile },
        { mobileNumber: cleanMobile },
        { mobile: cleanMobile },
        { mobile_number: Number(cleanMobile) },
        { mobileNumber: Number(cleanMobile) },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No user found for mobile number: ${cleanMobile}`,
      });
    }

    const acknowledgmentID = user.pushTo?.uploadToDP?.acknowledgmentID || "";
    const dpPushStatus = user.pushTo?.uploadToDP?.status || "pending";
    const fileName = user.pushTo?.uploadToDP?.fileName || "";

    if (!acknowledgmentID) {
      return res.status(200).json({
        success: true,
        user: {
          id: user._id,
          name: typeof user.name === "string" ? user.name : user.name?.fullName || "",
          mobile: cleanMobile,
          pan: user.PAN || user.pan_card?.pan_number || "",
        },
        cdsl: {
          pushStatus: dpPushStatus,
          acknowledgmentID: null,
          message: "No CDSL upload has been initiated for this user yet.",
        },
      });
    }

    // Query live CDSL Status API
    const config = await getActiveCdslConfig();
    let liveStatusResponse = null;

    if (config && config.statusUrl) {
      try {
        const authResult = await authenticateInternal();
        if (authResult.success && authResult.authToken) {
          const body = {
            AcknowledgmentID: acknowledgmentID,
            Signature: "",
          };
          const bodyHash = sha256HexUpper(JSON.stringify(body));
          const authSign = encryptAES(bodyHash, config.aesKey);

          const statusRes = await sendCdslRequest(config, {
            url: config.statusUrl,
            method: "POST",
            jsonBody: body,
            headers: {
              "Referer": config.referer,
              "AuthToken": authResult.authToken,
              "AuthSign": authSign,
            }
          });
          liveStatusResponse = statusRes.data;

          // Log and save the live status response to user document
          if (!user.pushTo) user.pushTo = {};
          if (!user.pushTo.uploadToDP) user.pushTo.uploadToDP = { logs: [], status: "pending" };
          user.pushTo.uploadToDP.logs.push({
            timestamp: getISTDate(new Date()),
            action: "public_status_check_by_mobile",
            payload: { mobile: cleanMobile, acknowledgmentID },
            response: liveStatusResponse,
          });
          await user.save();
        }
      } catch (statusErr) {
        console.warn("⚠️ [CDSL] Error fetching live status from gateway:", statusErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: typeof user.name === "string" ? user.name : user.name?.fullName || "",
        mobile: cleanMobile,
        pan: user.PAN || user.pan_card?.pan_number || "",
        boId: user.boId || user.dp_id || "",
      },
      cdsl: {
        pushStatus: dpPushStatus,
        acknowledgmentID,
        fileName,
        liveStatus: liveStatusResponse?.Status || liveStatusResponse?.Body?.Status || "Submitted / Pending Verification",
        rawResponse: liveStatusResponse,
      },
    });

  } catch (error) {
    console.error("💥 [CDSL] Public Status By Mobile Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching CDSL status",
      error: error.message,
    });
  }
};

/**
 * Public API to mark DP Status as "pending" for a user by mobile number.
 * Can be called via GET or POST:
 * GET /api/admin/push_to_cdsl/mark_pending?mobile=9026199181
 * GET /api/admin/push_to_cdsl/mark_pending/9026199181
 * POST /api/admin/push_to_cdsl/mark_pending { "mobile": "9026199181" }
 */
export const markDPPendingByMobile = async (req, res) => {
  try {
    const rawMobile = req.query?.mobile || req.query?.mobileNumber || req.query?.mobile_number || req.params?.mobile || req.body?.mobile || req.body?.mobileNumber;
    
    if (!rawMobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required (e.g. ?mobile=9026199181)",
      });
    }

    const cleanMobile = String(rawMobile).replace(/\D/g, "").slice(-10);
    const user = await User.findOne({
      $or: [
        { mobile_number: cleanMobile },
        { mobileNumber: cleanMobile },
        { mobile: cleanMobile },
        { mobile_number: Number(cleanMobile) },
        { mobileNumber: Number(cleanMobile) },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No user found for mobile number: ${cleanMobile}`,
      });
    }

    if (!user.pushTo) user.pushTo = {};
    if (!user.pushTo.uploadToDP) user.pushTo.uploadToDP = { logs: [] };
    
    user.pushTo.uploadToDP.status = "pending";
    user.pushTo.uploadToDP.acknowledgmentID = "";
    user.pushTo.uploadToDP.liveStatus = "Pending";
    if (!Array.isArray(user.pushTo.uploadToDP.logs)) {
      user.pushTo.uploadToDP.logs = [];
    }
    user.pushTo.uploadToDP.logs.push({
      timestamp: getISTDate(new Date()),
      action: "mark_pending_by_mobile",
      message: "DP status reset to pending via public API",
    });

    await user.save();

    console.log(`✅ [CDSL] DP Status for user ${user._id} (${cleanMobile}) marked as pending.`);

    return res.status(200).json({
      success: true,
      message: "DP status marked as pending successfully",
      user: {
        id: user._id,
        name: typeof user.name === "string" ? user.name : user.name?.fullName || "",
        mobile: cleanMobile,
        pan: user.PAN || user.pan_card?.pan_number || "",
        dpStatus: "pending",
      },
    });

  } catch (error) {
    console.error("💥 [CDSL] Error marking DP pending by mobile:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error marking DP pending",
      error: error.message,
    });
  }
};

/**
 * Download Response File
 */
export const downloadResponseFile = async (req, res) => {
  try {
    const userId = req.params?.userId;
    const uploadId = req.body?.uploadId || req.query?.uploadId;
    const uploadFileName = req.body?.uploadFileName || req.query?.uploadFileName;
    const config = await getActiveCdslConfig();
    
    if (!uploadId || !uploadFileName) {
      console.error("❌ [CDSL] Upload ID or File Name missing for download");
      return res.status(400).json({
        success: false,
        message: "Upload ID and File Name are required",
      });
    }

    console.log("============================================");
    console.log("📥 [CDSL] Downloading Response File");
    console.log(`Upload ID: ${uploadId}`);
    console.log(`File Name: ${uploadFileName}`);
    console.log(`URL: ${config.downloadUrl}`);
    console.log("============================================");
    
    const user = userId ? await User.findById(userId) : null;
    let authToken = user?.pushTo?.uploadToDP?.authToken || "";
    
    if (!authToken) {
      console.log("🔐 [CDSL] No token found for download, authenticating...");
      const authResult = await authenticateInternal();
      if (!authResult.success) {
        return res.status(401).json({
          success: false,
          message: "No authentication token found. Please authenticate first.",
        });
      }
      authToken = authResult.authToken;
    }
    
    const body = {
      UploadID: uploadId,
      UploadFileName: uploadFileName,
      Signature: ""
    };
    
    const bodyHash = sha256HexUpper(JSON.stringify(body));
    const authSign = encryptAES(bodyHash, config.aesKey);
    
    console.log(`📡 [CDSL] Requesting file download from: ${config.downloadUrl} ...`);
    const response = await sendCdslRequest(config, {
      url: config.downloadUrl,
      method: "POST",
      jsonBody: body,
      headers: {
        "Referer": config.referer,
        "AuthToken": authToken,
        "AuthSign": authSign,
      }
    });
    
    const success = response?.data?.success || response?.data?.Body?.success || false;
    
    if (success) {
      const responseFileName = response.data.ResponseFileName || response.data?.Body?.ResponseFileName;
      const fileBufferB64 = response.data.ResponseFilebuffer || response.data?.Body?.ResponseFilebuffer;
      const responseFileBuffer = Buffer.from(fileBufferB64, "base64");
      
      console.log(`✅ [CDSL] Downloaded File: ${responseFileName}`);
      
      const parsedResponse = parseCDSLResponseFile(responseFileBuffer);
      console.log(`📊 [CDSL] Parsed Records:`, JSON.stringify(parsedResponse, null, 2));

      if (user) {
        if (!user.pushTo) user.pushTo = {};
        if (!user.pushTo.uploadToDP) user.pushTo.uploadToDP = { logs: [], status: "pending" };
        
        const boRecord = parsedResponse.find((r) => r.recordType === "02" && r.boId);
        if (boRecord && boRecord.boId) {
          user.dpId = boRecord.boId;
          console.log(`✅ [CDSL] Stored BO ID ${boRecord.boId} directly to user.dpId`);
        }
        
        user.pushTo.uploadToDP.logs.push({
          timestamp: getISTDate(new Date()),
          action: "download_response",
          payload: { uploadId, uploadFileName },
          response: parsedResponse,
        });
        await user.save();
      }
      
      console.log("============================================");
      
      return res.status(200).json({
        success: true,
        fileName: responseFileName,
        parsedData: parsedResponse,
        rawData: response.data,
      });
    } else {
      console.error("❌ [CDSL] Download Failed!");
      console.error("Response:", JSON.stringify(response.data, null, 2));
      console.log("============================================");
      
      return res.status(400).json({
        success: false,
        message: "Failed to download response file",
        error: response.data?.Body?.DownloadResponseFile || response.data,
      });
    }
    
  } catch (error) {
    console.error("💥 [CDSL] Download Error:", error.message);
    if (error.response) {
      console.error("💥 [CDSL] Response Data:", JSON.stringify(error.response.data, null, 2));
    }
    
    return res.status(500).json({
      success: false,
      message: "Internal server error during response download",
      error: error.message,
      details: error.response?.data || null
    });
  }
};

/**
 * Direct Test Endpoint for CDSL Authentication
 * Can be called via GET or POST to test IP Whitelisting and Credentials directly.
 */
export const testCdslAuth = async (req, res) => {
  try {
    console.log("============================================");
    console.log("🧪 [CDSL] [TEST AUTH CALL]");
    console.log("============================================");

    const config = await getActiveCdslConfig();
    const authUrl = req.body?.authUrl || req.body?.baseUrl || config.authUrl;
    const referer = req.body?.referer || config.referer;
    const dpid = req.body?.dpId || config.dpId;
    const user = req.body?.user || req.body?.userId || config.userId;
    const pass = req.body?.password || config.password;
    const key = req.body?.aesKey || config.aesKey;

    const encPass = encryptAES(pass, key);

    const body = {
      DPID: String(dpid),
      UserID: String(user),
      Password: encPass,
    };

    const bodyHash = sha256HexUpper(JSON.stringify(body));
    const authSign = encryptAES(bodyHash, key);

    const headers = {
      "Content-Type": "application/json",
      "Referer": referer,
      "AuthSign": authSign,
    };

    console.log("📡 Request Config:", {
      authUrl,
      headers: { ...headers, AuthSign: `${authSign.substring(0, 20)}...` },
      body,
    });

    const startTime = Date.now();
    const response = await sendCdslRequest(config, {
      url: authUrl,
      method: "POST",
      jsonBody: body,
      headers: {
        "Referer": referer,
        "AuthSign": authSign,
      }
    });
    const durationMs = Date.now() - startTime;

    console.log(`📥 Response Status: ${response.status} (${durationMs}ms)`);
    console.log("📥 Response Data:", JSON.stringify(response.data, null, 2));

    const success = response.data?.success || response.data?.Body?.success || false;
    const authToken = response.data?.AuthToken || response.data?.Body?.AuthToken || "";

    if (success && authToken) {
      console.log("============================================");
      console.log("🎉 [CDSL] AUTHENTICATION 100% SUCCESSFUL!");
      console.log(`AuthToken: ${authToken}`);
      console.log("============================================");

      return res.status(200).json({
        success: true,
        message: "CDSL Authentication successful!",
        authToken,
        durationMs,
        response: response.data,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "CDSL Authentication failed",
        response: response.data,
      });
    }

  } catch (err) {
    console.error("💥 General Error in testCdslAuth:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
      details: err.response?.data || null,
    });
  }
};

// ============================================
// Daily Pending Status Reconciliation Job
// Called by node-cron every day at 8:00 PM IST
// Checks all users where uploadToDP.status = "pending" and ackID exists,
// calls CDSL status API, and updates DB status to success / failed / pending.
// ============================================
export const checkPendingCDSLUploads = async () => {
  console.log("============================================");
  console.log("⏰ [CDSL CRON] Daily Pending Upload Status Check — Started");
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log("============================================");

  try {
    const config = await getActiveCdslConfig();
    if (!config || !config.statusUrl || !config.aesKey) {
      console.error("❌ [CDSL CRON] CDSL config missing — aborting cron job.");
      return;
    }

    // Find all users with a pending CDSL upload that has an acknowledgmentID
    const pendingUsers = await User.find({
      "pushTo.uploadToDP.status": "pending",
      "pushTo.uploadToDP.acknowledgmentID": { $exists: true, $ne: "" },
    }).select("_id name PAN pan_card pushTo");

    if (!pendingUsers.length) {
      console.log("✅ [CDSL CRON] No pending users found. Nothing to do.");
      return;
    }

    console.log(`📋 [CDSL CRON] Found ${pendingUsers.length} pending user(s). Authenticating...`);

    // Authenticate once for the whole batch
    const authResult = await authenticateInternal();
    if (!authResult.success) {
      console.error("❌ [CDSL CRON] Authentication failed — aborting cron job:", authResult.error);
      return;
    }
    const authToken = authResult.authToken;
    console.log(`✅ [CDSL CRON] Auth token acquired. Processing ${pendingUsers.length} user(s)...`);

    let successCount = 0;
    let failedCount  = 0;
    let stillPending = 0;

    for (const user of pendingUsers) {
      const ackID     = user.pushTo?.uploadToDP?.acknowledgmentID;
      const userName  = typeof user.name === "string" ? user.name : (user.name?.fullName || "");
      const pan       = user.PAN || user.pan_card?.pan_number || "";

      try {
        const statusBody     = { AcknowledgmentID: ackID, Signature: "" };
        const statusBodyHash = sha256HexUpper(JSON.stringify(statusBody));
        const statusAuthSign = encryptAES(statusBodyHash, config.aesKey);

        const statusRes = await sendCdslRequest(config, {
          url: config.statusUrl,
          method: "POST",
          jsonBody: statusBody,
          headers: {
            "Referer":   config.referer,
            "AuthToken": authToken,
            "AuthSign":  statusAuthSign,
          },
        });

        const liveStatus      = statusRes.data?.Status || statusRes.data?.Body?.Status || "";
        const cdslStatusLower = liveStatus.toLowerCase().trim();

        let newDbStatus;
        if (cdslStatusLower === "closed") {
          newDbStatus = "success";
          successCount++;
          console.log(`   ✅ [${pan}] "${liveStatus}" → success`);
        } else if (
          cdslStatusLower.includes("fail")   ||
          cdslStatusLower.includes("reject") ||
          cdslStatusLower.includes("error")
        ) {
          newDbStatus = "failed";
          failedCount++;
          console.log(`   ❌ [${pan}] "${liveStatus}" → failed`);
        } else {
          newDbStatus = "pending";
          stillPending++;
          console.log(`   ⏳ [${pan}] "${liveStatus}" → still pending`);
        }

        user.pushTo.uploadToDP.status     = newDbStatus;
        user.pushTo.uploadToDP.liveStatus = liveStatus;
        user.pushTo.uploadToDP.logs.push({
          timestamp: getISTDate(new Date()),
          action:    "cron_status_check",
          payload:   { acknowledgmentID: ackID },
          response:  statusRes.data,
        });

        await user.save();
      } catch (userErr) {
        stillPending++;
        console.warn(`   ⚠️ [${pan}] Status check error: ${userErr.message} — keeping as pending`);
      }

      // Small delay between calls to avoid rate-limiting
      await new Promise(r => setTimeout(r, 500));
    }

    console.log("============================================");
    console.log(`⏰ [CDSL CRON] Daily Job Complete`);
    console.log(`   ✅ Success:      ${successCount}`);
    console.log(`   ❌ Failed:       ${failedCount}`);
    console.log(`   ⏳ Still Pending: ${stillPending}`);
    console.log("============================================");
  } catch (err) {
    console.error("💥 [CDSL CRON] Unexpected error in checkPendingCDSLUploads:", err.message);
  }
};
