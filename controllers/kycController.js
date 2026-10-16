// For User
import axios from "axios";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import DpId from "../models/DpId.js";
import Branch from "../models/Branch.js";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import { PDFDocument, rgb } from "pdf-lib";
import sharp from "sharp";
import nodemailer from "nodemailer";
import { statesWithDistricts } from "../utils/State_districts.js";
import extractAddress from "../utils/extractAddress.js";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";
import extractNameParts from "../utils/extractNameParts.js";
import {
  uploadToMinio,
  getFileBufferFromMinio,
  deleteFromMinio,
} from "../utils/minioClient.js";
import { encryptPayload, decryptPayload } from "../utils/camsEncryption.js";
import { sendEmailWithFallback } from "../utils/mailHelper.js";

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function removeNamePrefix(name) {
  if (!name) return "";
  let cleaned = String(name).trim();
  const prefixRegex =
    /^(?:mr|mrs|ms|miss|mx|dr|prof|shri|sri|shree|smt|kumari|km|master|m\/s)(?:\.|\b)\s*/i;
  while (prefixRegex.test(cleaned)) {
    const prev = cleaned;
    cleaned = cleaned.replace(prefixRegex, "").trim();
    if (cleaned === prev) break;
  }
  return cleaned;
}

function checkNameMatch(name1, name2) {
  if (!name1 || !name2) return false;
  const clean1 = removeNamePrefix(name1);
  const clean2 = removeNamePrefix(name2);
  const n1 = clean1.trim().toLowerCase().replace(/\s+/g, " ");
  const n2 = clean2.trim().toLowerCase().replace(/\s+/g, " ");
  if (n1 === n2) return true;

  const norm1 = n1
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const norm2 = n2
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (norm1 === norm2) return true;

  const tokens1 = norm1.split(" ").filter(Boolean).sort();
  const tokens2 = norm2.split(" ").filter(Boolean).sort();
  if (tokens1.length > 0 && tokens1.join(" ") === tokens2.join(" ")) return true;

  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "bankProof") {
      if (
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png" ||
        file.mimetype === "application/pdf"
      ) {
        cb(null, true);
      } else {
        cb(new Error("Only JPEG, PNG and PDF allowed for bank proof"), false);
      }
    } else if (file.fieldname === "panProof") {
      if (
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png" ||
        file.mimetype === "application/pdf"
      ) {
        cb(null, true);
      } else {
        cb(new Error("Only JPEG, PNG and PDF allowed for PAN proof"), false);
      }
    } else {
      cb(
        file.mimetype === "image/jpeg" ||
          file.mimetype === "image/png" ||
          file.mimetype === "application/pdf"
          ? null
          : new Error("Only JPEG, PNG and PDF allowed"),
        file.mimetype === "image/jpeg" ||
          file.mimetype === "image/png" ||
          file.mimetype === "application/pdf",
      );
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: "addressProofFront", maxCount: 1 },
  { name: "addressProofBack", maxCount: 1 },
  { name: "bankProof", maxCount: 1 },
  { name: "panProof", maxCount: 1 },
]);

const uploadBankProof = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });

      try {
        if (!req.files?.bankProof || !req.files.bankProof[0]) {
          return res.status(400).json({ message: "Bank proof file missing" });
        }

        // Handle req.user being an object or a primitive
        const mobileNumber =
          typeof req.user === "object" && req.user.mobileNumber
            ? req.user.mobileNumber
            : req.user;
        const user = await User.findOne({ mobileNumber });
        if (!user) return res.status(404).json({ message: "User not found" });

        const file = req.files.bankProof[0];
        const pan = user.PAN || "unknown";
        const timestamp = Date.now();
        let fileBuffer = file.buffer;
        let contentType = file.mimetype || "application/pdf";
        let fileName = `${pan}_bankProof_${timestamp}.pdf`;

        // Handle PDF or Image conversion/header addition
        try {
          if (file.mimetype.startsWith("image/")) {
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([595, 842]);
            const { width, height } = page.getSize();

            page.drawText("Bank Proof", {
              x: 50,
              y: height - 50,
              size: 24,
              color: rgb(0, 0, 0),
            });

            let embeddedImage;
            if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
              embeddedImage = await pdfDoc.embedJpg(file.buffer);
            } else if (file.mimetype === "image/png") {
              embeddedImage = await pdfDoc.embedPng(file.buffer);
            }

            if (embeddedImage) {
              const imgDims = embeddedImage.scaleToFit(
                width - 100,
                height - 120,
              );
              page.drawImage(embeddedImage, {
                x: 50,
                y: height - 70 - imgDims.height,
                width: imgDims.width,
                height: imgDims.height,
              });
            }

            const pdfBytes = await pdfDoc.save();
            fileBuffer = Buffer.from(pdfBytes);
            contentType = "application/pdf";
          } else if (file.mimetype === "application/pdf") {
            try {
              const existingPdfDoc = await PDFDocument.load(file.buffer);
              const pages = existingPdfDoc.getPages();
              if (pages.length > 0) {
                const firstPage = pages[0];
                const { height } = firstPage.getSize();
                firstPage.drawText("Bank Proof", {
                  x: 50,
                  y: height - 30,
                  size: 18,
                  color: rgb(0, 0, 0),
                });
              }
              const pdfBytes = await existingPdfDoc.save();
              fileBuffer = Buffer.from(pdfBytes);
              contentType = "application/pdf";
            } catch (err) {
              console.warn(
                "Could not modify existing bank proof PDF, uploading original:",
                err.message,
              );
            }
          }
        } catch (procErr) {
          console.error("Error processing bank proof file:", procErr);
        }

        // Delete old bank proof from MinIO if exists
        if (user.bank_account_details?.bank_proof_file) {
          try {
            await deleteFromMinio(user.bank_account_details.bank_proof_file);
          } catch {}
        }

        // Upload directly to MinIO
        const relativePath = `uploads/${fileName}`;
        await uploadToMinio(relativePath, fileBuffer, contentType);

        if (!user.bank_account_details) {
          user.bank_account_details = {};
        }
        user.bank_account_details.bank_proof_file = relativePath;
        user.bank_account_details.bank_proof_date = new Date(); // Store current timestamp

        // Update status to pending so admin can review
        user.bank_account_details.confirm_status = "pending";

        // Move to next step (Profile/Personal Details) - step 4
        if (!user.max_step_completed || user.max_step_completed < 4) {
          user.max_step_completed = 4;
        }

        // Call IFSC code API to fetch and prefill bank details for not name matched case
        if (user.bank_account_details?.ifsc_code && !user.bank_account_details.bank_name) {
          try {
            const ifscApiUrl = process.env.API_LINK + "/api/v3/bank/searchByIfscCode";
            const ifscResponse = await fetch(ifscApiUrl, {
              method: "POST",
              headers: {
                Authorization: process.env.ACCESS_TOKEN_SECRET,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ifscCode: user.bank_account_details.ifsc_code?.toUpperCase(),
              }),
            });
            if (ifscResponse.ok) {
              const ifscData = await ifscResponse.json();
              if (ifscData?.result) {
                user.bank_account_details.bank_name = ifscData.result.bankName || "";
                user.bank_account_details.branch = ifscData.result.branch || "";
                user.bank_account_details.address = ifscData.result.address || "";
                user.bank_account_details.micr_code = ifscData.result.micrCode || "";
              }
            }
          } catch (ifscErr) {
            console.error("Error fetching IFSC details in uploadBankProof:", ifscErr);
          }
        }

        if (!user.rejectedStepsDone) user.rejectedStepsDone = [];
        if (user.rejectedSteps?.includes(3) && !user.rejectedStepsDone.includes(3)) {
          user.rejectedStepsDone.push(3);
        }
        if (user.approvals?.bank) {
          user.approvals.bank.status = "pending";
        }

        await user.save();

        return res.status(200).json({
          message: "Bank proof uploaded successfully",
          data: {
            filePath: relativePath,
            max_step_completed: user.max_step_completed,
          },
        });
      } catch (innerErr) {
        console.error("uploadBankProof inner error:", innerErr);
        return res
          .status(500)
          .json({ message: "Failed to upload bank proof", error: innerErr.message });
      }
    });
  } catch (error) {
    console.error("Bank Proof Upload Error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const submitManualKyc = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });

      try {
        const {
          prefix,
          gender,
          line1,
          line2,
          line3,
          city,
          state,
          pincode,
          addressProofType,
          addressProofNumber,
        } = req.body;
        if (
          !prefix ||
          !gender ||
          !line1 ||
          !city ||
          !state ||
          !pincode ||
          !addressProofType ||
          !addressProofNumber
        ) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        // Handle req.user being an object or a primitive
        const mobileNumber =
          typeof req.user === "object" && req.user.mobileNumber
            ? req.user.mobileNumber
            : req.user;
        const user = await User.findOne({ mobileNumber });
        if (!user) return res.status(404).json({ message: "User not found" });

        const hasNewAddressFront = !!req.files?.addressProofFront?.[0];
        const hasNewAddressBack = !!req.files?.addressProofBack?.[0];
        const hasNewPan = !!req.files?.panProof?.[0];

        if (hasNewAddressBack && !hasNewAddressFront) {
          return res
            .status(400)
            .json({ message: "Address proof front image missing" });
        }

        if (
          hasNewAddressFront &&
          addressProofType !== "driving_license" &&
          !hasNewAddressBack
        ) {
          return res
            .status(400)
            .json({ message: "Address proof back image missing" });
        }

        if (!hasNewAddressFront) {
          if (!user.addressProof?.frontImage) {
            return res
              .status(400)
              .json({ message: "Address proof file missing" });
          }
          if (
            addressProofType !== "driving_license" &&
            !user.addressProof?.backImage
          ) {
            return res
              .status(400)
              .json({ message: "Address proof back image missing" });
          }
        }

        if (!hasNewPan && !user.PAN_file) {
          return res.status(400).json({ message: "PAN file missing" });
        }

        const stateDetails = statesWithDistricts.find((s) => s.state === state);
        if (!stateDetails)
          return res.status(400).json({ message: "Invalid state" });

        const pan = user.PAN || "unknown";
        const timestamp = Date.now();

        if (hasNewAddressFront) {
          // Delete old address proofs from MinIO
          for (const oldKey of [
            user.addressProof?.frontImage,
            user.addressProof?.backImage,
            user.addressProof?.mergedPdf,
          ]) {
            if (oldKey) {
              try {
                await deleteFromMinio(oldKey);
              } catch {}
            }
          }

          const frontFile = req.files.addressProofFront[0];
          const frontExt =
            path.extname(frontFile.originalname) ||
            (frontFile.mimetype === "application/pdf" ? ".pdf" : ".jpg");
          const frontFileName = `${pan}_address_front_${timestamp}${frontExt}`;
          const frontKey = `uploads/${frontFileName}`;
          await uploadToMinio(
            frontKey,
            frontFile.buffer,
            frontFile.mimetype || "application/octet-stream",
          );

          let backKey = null;
          if (hasNewAddressBack) {
            const backFile = req.files.addressProofBack[0];
            const backExt =
              path.extname(backFile.originalname) ||
              (backFile.mimetype === "application/pdf" ? ".pdf" : ".jpg");
            const backFileName = `${pan}_address_back_${timestamp}${backExt}`;
            backKey = `uploads/${backFileName}`;
            await uploadToMinio(
              backKey,
              backFile.buffer,
              backFile.mimetype || "application/octet-stream",
            );
          }

          const nextAddressProof = user.addressProof || {};
          nextAddressProof.type = addressProofType;
          nextAddressProof.number =
            addressProofType === "aadhaar" && addressProofNumber.length === 12
              ? "XXXXXXXX" + addressProofNumber.slice(-4)
              : addressProofNumber;
          nextAddressProof.frontImage = frontKey;
          nextAddressProof.backImage = backKey;
          nextAddressProof.mergedPdf = null;
          nextAddressProof.verificationStatus = "pending";
          nextAddressProof.uploadedAt = getISTDate(new Date());
          user.addressProof = nextAddressProof;
        }

        if (hasNewPan) {
          const panFile = req.files.panProof[0];
          if (user.PAN_file) {
            try {
              await deleteFromMinio(user.PAN_file);
            } catch {}
          }

          const panExt =
            path.extname(panFile.originalname) ||
            (panFile.mimetype === "application/pdf" ? ".pdf" : ".jpg");
          const panFileName = `${pan}_pan_${timestamp}${panExt}`;
          const panKey = `uploads/${panFileName}`;
          await uploadToMinio(
            panKey,
            panFile.buffer,
            panFile.mimetype || "application/octet-stream",
          );
          user.PAN_file = panKey;
        }

        user.aadhaar_number =
          addressProofType === "aadhaar" && addressProofNumber.length === 12
            ? "XXXXXXXX" + addressProofNumber.slice(-4)
            : " ";
        user.address = {
          addressLine1: line1,
          addressLine2: line2 || "",
          addressLine3: line3 || "",
          city,
          state,
          stateCode: stateDetails.state_short,
          pincode,
          country: "India",
          countryCode: "IN",
        };
        const cleanPrefix = prefix ? prefix.replace(/\./g, "").trim().toUpperCase() : "";
        user.prefix = ["MR", "MS", "MRS"].includes(cleanPrefix) ? cleanPrefix : (cleanPrefix || "MR");
        user.gender = gender ? gender.trim().toLowerCase() : (user.gender || "male");
        user.max_step_completed = 3;
        user.kycType = "Manual";
        const { fullName, firstName, middleName, lastName } = extractNameParts(
          user.name?.fullName,
        );

        user.nameAsPerAddressProof.fullName = fullName;
        user.nameAsPerAddressProof.firstName = firstName;
        user.nameAsPerAddressProof.middleName = middleName;
        user.nameAsPerAddressProof.lastName = lastName;

        if (
          (user.nameAsPerAddressProof?.fullName || "").toLowerCase() ===
          (user.name.fullName || "").toLowerCase()
        ) {
          user.isNameMatchPAN = true;
        }

        if (!user.rejectedStepsDone) user.rejectedStepsDone = [];
        if (user.rejectedSteps?.includes(2) && !user.rejectedStepsDone.includes(2)) {
          user.rejectedStepsDone.push(2);
        }
        if (user.approvals?.address) {
          user.approvals.address.status = "pending";
        }

        await user.save();

        res.json({
          message: "KYC uploaded",
          data: { addressProof: user.addressProof, address: user.address },
        });
      } catch (innerErr) {
        console.error("submitManualKyc error:", innerErr);
        return res.status(400).json({
          message: innerErr.message || "Failed to submit manual KYC",
          error: innerErr.message,
        });
      }
    });
  } catch (error) {
    console.error("submitManualKyc outer error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const cleanupOldKycImages = async () => {
  const dir = "./kyc_process_files";
  try {
    await fs.access(dir);
    const files = await fs.readdir(dir);
    const now = Date.now();
    await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(dir, file);
        if (
          now - (await fs.stat(filePath)).mtime.getTime() >
          24 * 60 * 60 * 1000
        ) {
          await fs.unlink(filePath).catch(() => {});
        }
      }),
    );
  } catch {}
};

cleanupOldKycImages();
setInterval(cleanupOldKycImages, 24 * 60 * 60 * 1000);

const checkShareProPan = async (pan) => {
  if (!pan) return false;
  try {
    const formattedPan = String(pan).trim().toUpperCase();
    const shareproUrl = `${process.env.SHARE_PRO_API}/ClientPANCheck`;
    const response = await axios.post(
      shareproUrl,
      {
        key: process.env.SHARE_PRO_API_KEY,
        pan: formattedPan,
      },
      { timeout: 7000 }
    );
    if (
      response.data &&
      (response.data.success === 1 ||
        response.data.success === "1" ||
        response.data.message === "PAN exists")
    ) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error checking SharePro PAN:", error.message || error);
    return false;
  }
};

const checkPAN = async (req, res) => {
  try {
    // Extract PAN number from request body
    const { panNumber } = req.body;

    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if PAN is already confirmed
    if (user.panConfirmed) {
      return res.status(400).json({ message: "PAN already verified" });
    }

    // Validate PAN number format (basic regex check)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(panNumber)) {
      return res.status(400).json({ message: "Invalid PAN number format" });
    }

    // Check if PAN exists in SharePro backoffice
    const panExistsInSharePro = await checkShareProPan(panNumber);
    if (panExistsInSharePro) {
      return res.status(400).json({
        success: false,
        message:
          "An account already exists with this PAN number. Please use another PAN number.",
      });
    }

    // Check PAN verification attempts and cooldown logic
    const currentTime = getISTDate(new Date());
    const cooldownPeriod = 30 * 60 * 1000; // 30 minutes in milliseconds
    const fiveMinutePeriod = 5 * 60 * 1000; // 5 minutes in milliseconds
    const nineAttemptsLimit = 9;

    if (user.lastPanApiCallTime && process.env.NODE_ENV === "production") {
      const timeSinceLastCall = currentTime - new Date(user.lastPanApiCallTime);
      if (
        timeSinceLastCall < cooldownPeriod &&
        user.panApiCallCount == nineAttemptsLimit
      ) {
        const remainingTime = Math.ceil(
          (cooldownPeriod - timeSinceLastCall) / 1000 / 60,
        );
        return res.status(429).json({
          message: `You have exceeded the maximum attempts allowed within 30 minutes. Please try again in ${remainingTime} minute${
            remainingTime > 1 ? "s" : ""
          }.`,
        });
      }
      if (timeSinceLastCall < fiveMinutePeriod) {
        if (user.panApiCallCount == 3) {
          const remainingTime = Math.ceil(
            (fiveMinutePeriod - timeSinceLastCall) / 1000 / 60,
          );
          return res.status(429).json({
            message: `You have exceeded the maximum attempts allowed within 5 minutes. Please try again in ${remainingTime} minute${
              remainingTime > 1 ? "s" : ""
            }.`,
          });
        }
      }
      // Check for spam protection limit
      if (user.panApiCallCount >= nineAttemptsLimit) {
        return res
          .status(429)
          .json({ message: `You have exceeded the maximum attempts allowed.` });
      }
      // Increment the count if within limits
      user.panApiCallCount += 1;
      user.lastPanApiCallTime = currentTime;
      await user.save();
    } else {
      user.panApiCallCount = 1;
      user.lastPanApiCallTime = currentTime;
      await user.save();
    }

    // Proceed with the PAN verification API call
    // Prepare API request
    const apiUrl = process.env.API_LINK + "/api/v3/pan-extensive/premium";
    const requestData = {
      panNumber: panNumber,
      getStatusInfo: true,
    };

    // Make API request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: process.env.ACCESS_TOKEN_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    // Check API response
    if (response.ok) {
      // Parse API response
      const panVerificationData = await response.json();

      // Update user with PAN details
      user.panDetails = panVerificationData.result;
      await user.save();

      // Return successful response
      res.status(200).json({
        message: "PAN verified successfully",
        panDetails: panVerificationData,
      });
    } else {
      const errorData = await response.json();
      switch (response.status) {
        case 200:
          return res.status(200).json({
            message: "PAN verification successful",
            panDetails: errorData,
          });
        case 400:
          user.panApiCallCount += 1;
          user.lastPanApiCallTime = currentTime;
          await user.save();
          return res
            .status(400)
            .json({ message: errorData.message || "Invalid PAN number" });
        case 401:
          return res.status(401).json({
            message:
              errorData.message || "Unauthorized: Invalid token or API key",
          });
        case 404:
          user.panApiCallCount += 1;
          user.lastPanApiCallTime = currentTime;
          await user.save();
          return res
            .status(404)
            .json({ message: errorData.message || "PAN Number not found" });
        case 409:
          return res.status(409).json({
            message:
              "Upstream error: " + (errorData.message || "Error from upstream"),
          });
        default:
          return res
            .status(response.status)
            .json({ message: "PAN verification failed", error: errorData });
      }
    }
  } catch (error) {
    console.error("PAN Verification Error:", error);
    res.status(500).json({
      message: "Internal server error during PAN verification",
      error: error.message,
    });
  }
};

const confirmPAN = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const panToVerify = user.panDetails?.number || user.PAN;
    if (panToVerify) {
      const panExistsInSharePro = await checkShareProPan(panToVerify);
      if (panExistsInSharePro) {
        return res.status(400).json({
          success: false,
          message:
            "An account already exists with this PAN number. Please use another PAN number.",
        });
      }
    }

    //Update step
    user.max_step_completed = 2;

    // Update user details
    user.panConfirmed = true;
    user.PAN = user.panDetails.number;
    user.name.fullName = user.panDetails.name;
    user.name.firstName = user.panDetails.firstName;
    user.name.middleName = user.panDetails.middleName;
    user.name.lastName = user.panDetails.lastName;

    // Extract and save father's name
    const {
      fullName: fatherFullName,
      firstName: fatherFirstName,
      middleName: fatherMiddleName,
      lastName: fatherLastName,
    } = extractNameParts(user.panDetails.fatherName);

    user.fatherName = {
      fullName: fatherFullName,
      firstName: fatherFirstName,
      middleName: fatherMiddleName,
      lastName: fatherLastName,
    };

    user.gender = user.panDetails.gender.toLowerCase();
    if (!user.prefix) {
      if (user.gender === "male") user.prefix = "MR";
      else if (user.gender === "female") user.prefix = "MRS";
    }
    // Convert date string from DD-MM-YYYY to YYYY-MM-DD format
    const [day, month, year] = user.panDetails.dateOfBirth.split("-");
    user.dateOfBirth = new Date(`${year}-${month}-${day}`);
    user.panVerificationDetails = {
      verifiedAt: getISTDate(new Date()),
      status: "Success",
      details: null,
    };
    user.userStatus = "pending";
    await user.save();

    // Return successful response
    res
      .status(200)
      .json({ success: true, message: "PAN confirmed successfully" });
  } catch (error) {
    console.error("PAN Confirmation Error:", error);
    res.status(500).json({
      message: "Internal server error during PAN confirmation",
      error: error.message,
    });
  }
};

//  PAN extraction API
const extractionPAN = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.panConfirmed) {
      return res.status(400).json({ message: "PAN already verified" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "PAN file required" });
    }

    // Upload PAN to MinIO from memory buffer
    const ext =
      path.extname(req.file.originalname) ||
      (req.file.mimetype === "application/pdf" ? ".pdf" : ".jpg");
    const safePanName = `${user.PAN || decoded.mobileNumber}_pan_extraction_${Date.now()}${ext}`;
    const objectName = `uploads/${safePanName}`;
    await uploadToMinio(
      objectName,
      req.file.buffer,
      req.file.mimetype || "image/jpeg",
    );

    // Prepare API request
    const apiUrl = process.env.API_LINK + "/api/v3/pan/extractions";
    const fileName = `${process.env.BACKEND_SERVER}/${objectName}`;

    const requestData = {
      files: [fileName],
      getRelativeData: true,
      type: "individualPan",
    };

    // Make API request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: process.env.ACCESS_TOKEN_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    const panVerificationData = await response.json();
    const pan_result = panVerificationData.result;

    console.log("pan_result", pan_result);

    if (pan_result?.number) {
      const panExistsInSharePro = await checkShareProPan(pan_result.number);
      if (panExistsInSharePro) {
        return res.status(400).json({
          success: false,
          message:
            "An account already exists with this PAN number. Please use another PAN number.",
        });
      }
    }
    //  extract applicant name
    const {
      fullName: applicantFullName,
      firstName: applicantFirstName,
      middleName: applicantMiddleName,
      lastName: applicantLastName,
    } = extractNameParts(pan_result?.name);

    //  extract father name
    const {
      fullName: fatherFullName,
      firstName: fatherFirstName,
      middleName: fatherMiddleName,
      lastName: fatherLastName,
    } = extractNameParts(pan_result?.fatherName);

    // modify date
    const [day, month, year] = pan_result?.dob?.split("/");
    const dob = new Date(`${year}-${month}-${day}`);

    //  save applicant name in db
    user.name.fullName = applicantFullName;
    user.name.firstName = applicantFirstName;
    user.name.middleName = applicantMiddleName;
    user.name.lastName = applicantLastName;

    //  save father name in db
    user.fatherName.fullName = fatherFullName;
    user.fatherName.firstName = fatherFirstName;
    user.fatherName.middleName = fatherMiddleName;
    user.fatherName.lastName = fatherLastName;

    user.PAN = pan_result.number;
    user.dateOfBirth = dob;
    if (user.PAN_file) {
      try {
        await deleteFromMinio(user.PAN_file);
      } catch (err) {
        console.error("Error deleting old PAN from MinIO:", err.message);
      }
    }

    user.PAN_file = objectName;
    user.panDetails = pan_result;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "",
      data: {
        number: pan_result.number,
        name: pan_result.name,
        dateOfBirth: pan_result.dob,
        fatherName: pan_result.fatherName,
      },
    });
  } catch (error) {
    console.error("Error extractionPAN :", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

//  confirmPanExtraction API
const confirmPanExtraction = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const panToVerify = user.PAN || user.panDetails?.number;
    if (panToVerify) {
      const panExistsInSharePro = await checkShareProPan(panToVerify);
      if (panExistsInSharePro) {
        return res.status(400).json({
          success: false,
          message:
            "An account already exists with this PAN number. Please use another PAN number.",
        });
      }
    }
    //Update step
    user.max_step_completed = 2;

    user.panVerificationDetails = {
      verifiedAt: getISTDate(new Date()),
      status: "Success",
      details: null,
    };
    user.panConfirmed = true;
    user.userStatus = "pending";
    await user.save();

    res.status(200).json({
      success: true,
      message: "PAN confirm successfully.",
    });
  } catch (error) {
    console.error("Error confirmPanExtraction :", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const createDigilockerUrl = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Increment digilocker API call count
    user.digilocker_api_call_count = (user.digilocker_api_call_count || 0) + 1;
    await user.save();

    // Prepare API request
    const apiUrl = `${process.env.API_LINK}/api/v3/digilocker/createUrl`;
    const date = getISTDate(new Date());
    date.setMonth(date.getMonth() + 1);
    const consentValidTill = Math.floor(date.getTime() / 1000);
    const requestData = {
      signup: true,
      redirectUrl: "https://www.lakshmishree.com/",
      redirectTime: "1",
      callbackUrl: "https://signtest123.requestcatcher.com/",
      successRedirectUrl: `${process.env.FRONTEND_DEPLOY_URL}/digilocker-success`,
      successRedirectTime: "3",
      failureRedirectUrl: `${process.env.FRONTEND_DEPLOY_URL}/digilocker-failed`,
      failureRedirectTime: "3",
      logoVisible: "true",
      logo: `${process.env.BACKEND_SERVER}/assets/icons/fullLogo.png`,
      supportEmailVisible: "true",
      supportEmail: "support@lakshmishree.com",
      docType: ["PANCR", "ADHAR"],
      purpose: "kyc",
      getScope: true,
      pinlessAuthentication:true,
      consentValidTill: consentValidTill,
      showLoaderState: true,
      internalId: "<Internal ID>",
      companyName: "Lakshmishree Investment & Securities Limited",
      favIcon: `${process.env.BACKEND_SERVER}/assets/icons/fullLogo.png`,
    };

    // Make API request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: process.env.ACCESS_TOKEN_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    // Check API response
    if (response.ok) {
      const data = await response.json();
      user.digilocker_request_id = data.result.requestId;
      await user.save();
      return res.status(200).json({
        message: "Digilocker URL created successfully",
        url: data.result.url,
      });
    } else {
      const errorData = await response.json();
      return res
        .status(response.status)
        .json({ message: "Failed to create Digilocker URL", error: errorData });
    }
  } catch (error) {
    console.error("Error creating Digilocker URL:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const digilockerWebhook = async (req, res) => {
  try {
    const contentType = req.headers["content-type"];
    const safeHeaders = {
      "content-type": contentType,
      "user-agent": req.headers["user-agent"],
    };
    console.log("DIGILOCKER_WEBHOOK_RECEIVED", {
      at: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      headers: safeHeaders,
      query: req.query,
      body: req.body,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.log("DIGILOCKER_WEBHOOK_ERROR", {
      at: new Date().toISOString(),
      error: error?.message || String(error),
    });
    return res.status(200).json({ success: true });
  }
};

const getDigilockerDetails = async (req, res) => {
  // Extract JWT token from Authorization header
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (tokenError) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  const { digilocker_request_id } = user;
  if (!digilocker_request_id) {
    return res.status(404).json({ message: "Digilocker request ID not found" });
  }

  try {
    // First API call to getDetails
    const detailsUrl = `${process.env.API_LINK}/api/v3/digilocker/getDetails`;
    const detailsResponse = await fetch(detailsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.ACCESS_TOKEN_SECRET,
      },
      body: JSON.stringify({ requestId: digilocker_request_id }),
    });

    if (!detailsResponse.ok) {
      const errorData = await detailsResponse.json();
      return res.status(detailsResponse.status).json({
        message: "Failed to retrieve Digilocker details",
        error: errorData,
      });
    }

    const detailsData = await detailsResponse.json();
    const files = detailsData.result?.files || [];

    const hasAadhaar = files.some((file) => file.doctype === "ADHAR");

    if (!hasAadhaar) {
      return res.status(400).json({
        success: false,
        status: "failed",
        message:
          "Please tick Aadhaar and PAN on DIgilocker page to procceed via digilocker..",
      });
    }

    // Extract Aadhaar file ID
    const aadhaarFileEntry = files.find((file) => file.doctype === "ADHAR");
    if (!aadhaarFileEntry?.id) {
      return res.status(400).json({
        success: false,
        status: "failed",
        message:
          "Please tick Aadhaar and PAN on DIgilocker page to procceed via digilocker..",
      });
    }
    const aadhaarFileId = aadhaarFileEntry.id;
    const panFile = files.find((file) => file.doctype === "PANCR");
    const panFileId = panFile?.id;

    // Second API call to getFiles with available file IDs
    const fileIds = [aadhaarFileId];
    if (panFileId) fileIds.push(panFileId);

    const filesUrl = `${process.env.API_LINK}/api/v3/digilocker/getFiles`;
    const filesResponse = await fetch(filesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.ACCESS_TOKEN_SECRET,
      },
      body: JSON.stringify({
        requestId: digilocker_request_id,
        fileIds,
      }),
    });

    if (!filesResponse.ok) {
      const errorData = await filesResponse.json();
      return res.status(filesResponse.status).json({
        success: false,
        status: "failed",
        message:
          "Please tick Aadhaar and PAN on Digilocker page to procceed via digilocker..",
        error: errorData,
      });
    }

    const filesData = await filesResponse.json();
    const retrievedFiles = filesData.result?.files || [];

    // Process Aadhaar file
    const aadhaarFile = retrievedFiles.find((f) => f.doctype === "ADHAR");
    if (!aadhaarFile || !aadhaarFile.file || !aadhaarFile.file.pdf) {
      return res.status(400).json({
        success: false,
        status: "failed",
        message:
          "Please tick Aadhaar and PAN on DIgilocker page to procceed via digilocker..",
      });
    }

    const aadhaarFileName = `${user.PAN}_aadhaar_${Date.now()}.pdf`;

    // Download Aadhaar PDF
    let aadhaarFileResponse;
    try {
      aadhaarFileResponse = await fetch(aadhaarFile.file.pdf);
    } catch (fetchErr) {
      aadhaarFileResponse = null;
    }

    if (!aadhaarFileResponse || !aadhaarFileResponse.ok) {
      return res.status(400).json({
        success: false,
        status: "failed",
        message:
          "Please tick Aadhaar and PAN on DIgilocker page to procceed via digilocker..",
      });
    }
    const aadhaarArrayBuffer = await aadhaarFileResponse.arrayBuffer();
    const aadhaarBuffer = Buffer.from(aadhaarArrayBuffer);

    // Delete existing Aadhaar file from MinIO if present
    if (user.aadhaar_file) {
      try {
        await deleteFromMinio(user.aadhaar_file);
        console.log(
          "[MinIO] Deleted previous Aadhaar file:",
          user.aadhaar_file,
        );
      } catch (delErr) {
        console.error(
          "Error deleting old Aadhaar file from MinIO:",
          delErr.message,
        );
      }
    }

    await uploadToMinio(
      `uploads/${aadhaarFileName}`,
      aadhaarBuffer,
      "application/pdf",
    );

    // Update user document with Aadhaar file path
    user.aadhaar_file = `uploads/${aadhaarFileName}`;

    // Process PAN file if available
    let panFilePath = null;
    if (panFile) {
      const panFileData = retrievedFiles.find((f) => f.doctype === "PANCR");
      if (panFileData) {
        const panFileName = `${user.PAN}_pan_${Date.now()}.pdf`;

        const panFileResponse = await fetch(panFileData.file.pdf);
        if (panFileResponse.ok) {
          const panArrayBuffer = await panFileResponse.arrayBuffer();
          const panBuffer = Buffer.from(panArrayBuffer);

          // Delete existing PAN file from MinIO if present
          if (user.PAN_file) {
            try {
              await deleteFromMinio(user.PAN_file);
              console.log("[MinIO] Deleted previous PAN file:", user.PAN_file);
            } catch (delErr) {
              console.error(
                "Error deleting old PAN file from MinIO:",
                delErr.message,
              );
            }
          }

          await uploadToMinio(
            `uploads/${panFileName}`,
            panBuffer,
            "application/pdf",
          );
          user.PAN_file = `uploads/${panFileName}`;
          user.pan_source = "digilocker";
          panFilePath = `uploads/${panFileName}`;
        }
      }
    }

    // Third API call to geteaadhaar
    const apiUrl = `${process.env.API_LINK}/api/v3/digilocker/geteaadhaarwithxml`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.ACCESS_TOKEN_SECRET,
      },
      body: JSON.stringify({
        requestId: digilocker_request_id,
        extraDigitalCertificateParams: true,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      user.digilocker_details = data.result;
      const { fullName, firstName, middleName, lastName } = extractNameParts(
        data.result?.name,
      );

      user.nameAsPerAddressProof.fullName = fullName;
      user.nameAsPerAddressProof.firstName = firstName;
      user.nameAsPerAddressProof.middleName = middleName;
      user.nameAsPerAddressProof.lastName = lastName;

      if (
        (user.nameAsPerAddressProof?.fullName || "").toLowerCase() ===
        (user.name.fullName || "").toLowerCase()
      ) {
        user.isNameMatchPAN = true;
      }

      //  Extract User Pan ID
      const pan = user.PAN || "unknown";

      // 1. Photo save to MinIO
      const photoFileName = `${pan}_aadharphoto_${Date.now()}.jpeg`;
      const photoUrl = data.result.photo;
      if (!photoUrl) {
        throw new Error("Photo URL missing in API response.");
      }

      try {
        const imgResponse = await axios.get(photoUrl, {
          responseType: "arraybuffer",
        });

        // Delete existing Aadhaar photo from MinIO if present
        if (user.aadhaar_photo) {
          try {
            await deleteFromMinio(user.aadhaar_photo);
            console.log(
              "[MinIO] Deleted previous Aadhaar photo:",
              user.aadhaar_photo,
            );
          } catch (delErr) {
            console.error(
              "Error deleting old Aadhaar photo from MinIO:",
              delErr.message,
            );
          }
        }

        await uploadToMinio(
          `uploads/${photoFileName}`,
          Buffer.from(imgResponse.data),
          "image/jpeg",
        );
        user.aadhaar_photo = `uploads/${photoFileName}`;
        console.log("Photo uploaded to MinIO:", photoFileName);
      } catch (err) {
        console.error("Error in saving photo:", err.message);
        throw err;
      }
      // 2. XML save to MinIO
      const xmlFileName = `${pan}_aadharxml_${Date.now()}.xml`;
      const xmlUrl = data.result.xmlFileLink;
      if (!xmlUrl) {
        throw new Error("XML URL missing in API response.");
      }

      try {
        const xmlResponse = await axios.get(xmlUrl, {
          responseType: "arraybuffer",
        });

        // Delete existing Aadhaar XML from MinIO if present
        if (user.aadhaar_xml) {
          try {
            await deleteFromMinio(user.aadhaar_xml);
            console.log(
              "[MinIO] Deleted previous Aadhaar XML:",
              user.aadhaar_xml,
            );
          } catch (delErr) {
            console.error(
              "Error deleting old Aadhaar XML from MinIO:",
              delErr.message,
            );
          }
        }

        await uploadToMinio(
          `uploads/${xmlFileName}`,
          Buffer.from(xmlResponse.data),
          "application/xml",
        );
        user.aadhaar_xml = `uploads/${xmlFileName}`;
        console.log("XML uploaded to MinIO:", xmlFileName);
      } catch (err) {
        console.error("Error in saving XML:", err.message);
        throw err;
      }

      // Extract and store address using the provided function
      const extractedAddress = extractAddress({
        result: {
          address: data.result.address,
          splitAddress: data.result.splitAddress,
        },
      });

      // Format UID to uppercase (e.g., XXXXXXXX2054)
      const formattedUid = data.result.uid
        ? String(data.result.uid).toUpperCase()
        : "";

      // Update user's address and address proof
      user.address = extractedAddress;
      user.aadhaar_number = formattedUid;
      user.addressProof = {
        type: "aadhaar",
        number: formattedUid,
        verificationStatus: "pending",
        uploadedAt: getISTDate(new Date()),
        verifiedAt: getISTDate(new Date()),
      };
      user.kycType = "Digilocker";
      user.max_step_completed = 3;

      if (!user.rejectedStepsDone) user.rejectedStepsDone = [];
      if (user.rejectedSteps?.includes(2) && !user.rejectedStepsDone.includes(2)) {
        user.rejectedStepsDone.push(2);
      }
      if (user.approvals?.address) {
        user.approvals.address.status = "pending";
      }
      await user.save();
      const responseData = {
        message: "Digilocker details and files retrieved successfully",
        data: {
          digilocker_details: data.result,
          aadhaar_file: user.aadhaar_file,
        },
      };

      if (panFilePath) {
        responseData.data.pan_file = panFilePath;
      }

      return res.status(200).json(responseData);
    } else {
      const errorData = await response.json();
      return res.status(response.status).json({
        success: false,
        status: "failed",
        message:
          "Please tick Aadhaar and PAN on DIgilocker page to procceed via digilocker..",
        error: errorData,
      });
    }
  } catch (error) {
    console.error("Error retrieving Digilocker details:", error);
    return res.status(500).json({
      success: false,
      status: "failed",
      message:
        "Please tick Aadhaar and PAN on DIgilocker page to procceed via digilocker..",
      error: error.message,
    });
  }
};

const getUserDetails = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        name: user.name,
        prefix:
          user.prefix ||
          (user.gender === "male"
            ? "MR"
            : user.gender === "female"
              ? "MRS"
              : ""),
        gender: user.gender || "",
        address: user.address || null,
        addressProof: user.addressProof || null,
        PAN: user.PAN || "",
        PAN_file: user.PAN_file || "",
        kycType: user.kycType || null,
        pan_source:
          user.pan_source ||
          (user.kycType === "Digilocker" && user.PAN_file
            ? "digilocker"
            : user.PAN_file
              ? "manual"
              : null),
        digilocker_api_call_count: user.digilocker_api_call_count,
        camskra_available: user.camskra_available,
        ddpiConcent: user.ddpiConcent,
        bank_account_details: user.bank_account_details || null,
        userStatus: user.userStatus || "pending",
        rejectedSteps: user.rejectedSteps || [],
        rejectedStepsDone: user.rejectedStepsDone || [],
        approvals: user.approvals || {},
        max_step_completed: user.max_step_completed || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const hybridBankAccountVerification = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Extract account number and IFSC code from request body
    const { beneficiaryAccount, beneficiaryIFSC } = req.body;

    // Prepare API request
    const apiUrl = `${process.env.API_LINK}/api/v3/bankaccountverification/bankaccountverifications`;
    const requestData = { beneficiaryAccount, beneficiaryIFSC };

    // Make API request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.ACCESS_TOKEN_SECRET,
      },
      body: JSON.stringify(requestData),
    });

    // Check API response
    if (response.ok) {
      const data = await response.json();

      const rawBankName = data.result?.bankTransfer?.beneName || "";
      const bankName = removeNamePrefix(rawBankName);
      const userFullName = user.panDetails?.name || user.name?.fullName || "";

      const isMatch = checkNameMatch(userFullName, bankName);

      // Update user's bank details
      const existingBankDetails = user.bank_account_details?.toObject
        ? user.bank_account_details.toObject()
        : user.bank_account_details || {};

      // If name matched, delete previous bank proof file from MinIO and clear it
      if (isMatch && existingBankDetails.bank_proof_file) {
        try {
          await deleteFromMinio(existingBankDetails.bank_proof_file);
        } catch (delErr) {
          console.error("Error deleting bank proof file on name match:", delErr);
        }
        existingBankDetails.bank_proof_file = null;
        existingBankDetails.bank_proof_date = null;
      }

      user.bank_account_details = {
        ...existingBankDetails,
        account_number: beneficiaryAccount,
        ifsc_code: beneficiaryIFSC,
        account_holder_name: bankName,
        upi_handle: "",
        account_type: "SAVINGS",
        verification_request_id: data.result.signzyReferenceId,
        confirm_status: "pending",
      };

      await user.save();

      return res.status(200).json({
        message: "Bank account verified successfully",
        data: {
          account_number: beneficiaryAccount,
          ifsc_code: beneficiaryIFSC,
          account_holder_name: bankName,
          isNameMatch: isMatch,
          panName: userFullName,
          bankName: bankName,
        },
      });
    } else {
      const errorData = await response.json();
      return res
        .status(response.status)
        .json({ message: "Failed to verify bank account", error: errorData });
    }
  } catch (error) {
    console.error("Bank Verification Error:", error);
    res.status(500).json({
      message: "Internal server error during bank verification",
      error: error.message,
    });
  }
};

const reversePennyDropCreateLink = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prepare API request
    const apiUrl = `${process.env.API_LINK}/api/v3/bankaccountverification/reversepennydrop/createlink`;

    // Prepare the body with only the callbackUrl
    const requestBody = {
      callbackUrl: "https://callback_url.com",
    };

    // Make API request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.ACCESS_TOKEN_SECRET,
      },
      body: JSON.stringify(requestBody),
    });

    // Check API response
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({
        message: "Reverse penny drop details retrieved successfully",
        data,
      });
    } else {
      const errorData = await response.json();
      return res.status(response.status).json({
        message: "Failed to retrieve reverse penny drop details",
        error: errorData,
      });
    }
  } catch (error) {
    console.error("Reverse Penny Drop Verification Error:", error);
    res.status(500).json({
      message: "Internal server error during reverse penny drop verification",
      error: error.message,
    });
  }
};

const verifyReversePennyDrop = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Extract verificationId from request body
    const { verificationId } = req.body;

    // Prepare API request
    const apiUrl = `${process.env.API_LINK}/api/v3/bankaccountverification/reversepennydrop/get-details`;
    const requestData = {
      verificationId: verificationId,
    };

    // Make API request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.ACCESS_TOKEN_SECRET,
      },
      body: JSON.stringify(requestData),
    });

    // Check API response
    if (response.ok) {
      const data = await response.json();

      const rawBankName = data.result?.nameAtBank || "";
      const bankName = removeNamePrefix(rawBankName);
      const userFullName = user.panDetails?.name || user.name?.fullName || "";

      const isMatch = checkNameMatch(userFullName, bankName);

      // Store bank account details in user document
      const existingBankDetails = user.bank_account_details?.toObject
        ? user.bank_account_details.toObject()
        : user.bank_account_details || {};

      // If name matched, delete previous bank proof file from MinIO and clear it
      if (isMatch && existingBankDetails.bank_proof_file) {
        try {
          await deleteFromMinio(existingBankDetails.bank_proof_file);
        } catch (delErr) {
          console.error("Error deleting bank proof file on name match:", delErr);
        }
        existingBankDetails.bank_proof_file = null;
        existingBankDetails.bank_proof_date = null;
      }

      user.bank_account_details = {
        ...existingBankDetails,
        account_number: data.result.bankAccountNumber,
        bank_name: data.result.bankName || "",
        ifsc_code: data.result.ifsc,
        upi_handle: data.result.upiHandle,
        account_holder_name: bankName,
        account_type: "SAVINGS",
        verification_request_id: verificationId,
        confirm_status: "pending",
        verifiedAt: null,
      };
      await user.save();

      return res.status(200).json({
        message: "Bank account details stored successfully",
        data: {
          account_number: data.result.bankAccountNumber,
          ifsc_code: data.result.ifsc,
          account_holder_name: bankName,
          status: data.result.status,
          isNameMatch: isMatch,
          panName: userFullName,
          bankName: bankName,
        },
      });
    } else {
      const errorData = await response.json();
      return res.status(response.status).json({
        message: "Failed to retrieve reverse penny drop details",
        error: errorData,
      });
    }
  } catch (error) {
    console.error("Reverse Penny Drop Verification Error:", error);
    res.status(500).json({
      message: "Internal server error during reverse penny drop verification",
      error: error.message,
    });
  }
};

const confirmBankDetails = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if bank details exist
    if (!user.bank_account_details) {
      return res
        .status(400)
        .json({ message: "No bank details found to confirm" });
    }

    // ✅ Prepare API request
    const apiUrl = process.env.API_LINK + "/api/v3/bank/searchByIfscCode";
    let data;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: process.env.ACCESS_TOKEN_SECRET,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ifscCode: user.bank_account_details.ifsc_code?.toUpperCase(),
        }),
      });

      // Check for failed API request
      if (!response.ok) {
        return res.status(502).json({
          message: "Failed to fetch IFSC details from external API",
          status: response.status,
        });
      }

      data = await response.json();

      if (!data?.result) {
        return res
          .status(400)
          .json({ message: "Invalid IFSC response, no result found" });
      }
    } catch (apiError) {
      console.error("IFSC API Error:", apiError);
      return res.status(502).json({
        message: "Error while calling IFSC API",
        error: apiError.message,
      });
    }

    // ✅ Update user bank details
    user.bank_account_details.bank_name = data.result.bankName || "";
    user.bank_account_details.branch = data.result.branch || "";
    user.bank_account_details.address = data.result.address || "";
    user.bank_account_details.micr_code = data.result.micrCode || "";

    // Update bank details confirmation status
    user.bank_account_details.confirm_status = "verified";
    user.bank_account_details.account_type = "SAVINGS";
    user.bank_account_details.verifiedAt = getISTDate(new Date());
    user.max_step_completed = 4;

    // Auto approval if account holder name matches full name
    const isHolderNameMatch = checkNameMatch(
      user.name?.fullName || user.panDetails?.name || "",
      user.bank_account_details.account_holder_name
    );
    if (isHolderNameMatch) {
      if (user.bank_account_details.bank_proof_file) {
        try {
          await deleteFromMinio(user.bank_account_details.bank_proof_file);
        } catch (delErr) {
          console.error("Error deleting bank proof file in confirmBankDetails:", delErr);
        }
        user.bank_account_details.bank_proof_file = null;
        user.bank_account_details.bank_proof_date = null;
      }
      user.approvals.bank.status = "approved";
      user.approvals.bank.autoApproved = true;
      user.approvals.bank.approveAt = getISTDate(new Date());
    }
    if (!user.rejectedStepsDone) user.rejectedStepsDone = [];
    if (user.rejectedSteps?.includes(3) && !user.rejectedStepsDone.includes(3)) {
      user.rejectedStepsDone.push(3);
    }
    if (user.approvals?.bank && user.approvals.bank.status === "rejected") {
      user.approvals.bank.status = "pending";
    }

    await user.save();

    return res.status(200).json({
      message: "Bank details confirmed successfully",
      data: user.bank_account_details,
    });
  } catch (error) {
    console.error("Bank Details Confirmation Error:", error);
    return res.status(500).json({
      message: "Internal server error during bank details confirmation",
      error: error.message,
    });
  }
};

const checkIfscDetails = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) return res.status(404).json({ message: "User not found" });

    const ifscCode = (req.body.ifscCode || user.bank_account_details?.ifsc_code || "").toUpperCase().trim();
    if (!ifscCode) return res.status(400).json({ message: "IFSC code is required" });

    const apiUrl = process.env.API_LINK + "/api/v3/bank/searchByIfscCode";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: process.env.ACCESS_TOKEN_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ifscCode }),
    });

    if (!response.ok) {
      return res.status(502).json({ message: "Failed to fetch IFSC details" });
    }

    const data = await response.json();
    if (!data?.result) {
      return res.status(400).json({ message: "Invalid IFSC response, no result found" });
    }

    if (!user.bank_account_details) user.bank_account_details = {};
    user.bank_account_details.ifsc_code = ifscCode;
    user.bank_account_details.bank_name = data.result.bankName || "";
    user.bank_account_details.branch = data.result.branch || "";
    user.bank_account_details.address = data.result.address || "";
    user.bank_account_details.micr_code = data.result.micrCode || "";
    await user.save();

    return res.status(200).json({
      success: true,
      data: {
        bankName: data.result.bankName || "",
        branch: data.result.branch || "",
        address: data.result.address || "",
        micrCode: data.result.micrCode || "",
      },
    });
  } catch (err) {
    console.error("checkIfscDetails error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

const createIPVUrl = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate if user has aadhaar photo
    const aadhaarImage = user.digilocker_details?.photo;

    // if (!aadhaarImage) {
    //     return res.status(400).json({ message: "Aadhaar photo not found in user details" });
    // }

    // Prepare API request for liveness check
    const apiUrl = `${process.env.API_LINK}/api/v3/liveness-secure/createUrl`;

    // Configure liveness check parameters
    const requestData = {
      languageCode: "en",
      hideBottomLogo: "true",
      callbackUrl: "https://webhook_URL.com",
      redirectUrl: `${process.env.FRONTEND_DEPLOY_URL}/ipv-verify`,
      accentColor: "#f86a6e",
      reviewImage: "true",
    };

    // Add matchImage conditionally if aadhaarImage is available
    if (aadhaarImage) {
      requestData.matchImage = [aadhaarImage];
      requestData.faceMatchThreshold = 0.05;
    }

    // Make API request with proper error handling
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: process.env.ACCESS_TOKEN_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Liveness API Error:", data);
      return res.status(response.status).json({
        message: "Failed to create liveness verification URL",
        error: data,
        errorCode: response.status,
      });
    }

    // Update user with liveness request ID
    if (data.token) {
      user.ipv_request_id = data.token;
      await user.save();
    }

    // Check if we have videoUrl in the response
    if (!data.videoUrl) {
      return res.status(500).json({
        message: "Invalid response from liveness API",
        error: "Missing videoUrl in API response",
        apiResponse: data,
      });
    }

    return res.status(200).json({
      message: "Liveness verification URL created successfully",
      url: data.videoUrl,
    });
  } catch (error) {
    console.error("Error in liveness verification process:", error);
    res.status(500).json({
      message: "Internal server error during liveness verification",
      error: error.message,
    });
  }
};

export const assignDpId = async (user) => {
  try {
    if (user.dpId) return;

    // Find and assign a free DP ID atomically (Oldest first)
    const freeDpId = await DpId.findOneAndUpdate(
      { is_used: false },
      {
        is_used: true,
        assignedTo: user._id,
        assignedAt: getISTDate(new Date()),
      },
      { new: true, sort: { createdAt: 1 } },
    );

    if (freeDpId) {
      user.dpId = freeDpId.dpId;

      // Auto-approve demat if DP ID is assigned
      if (!user.approvals) user.approvals = {};
      if (!user.approvals.demat) user.approvals.demat = {};

      user.approvals.demat.status = "approved";
      user.approvals.demat.approveAt = getISTDate(new Date());
      user.approvals.demat.autoApproved = true;
      user.approvals.demat.rejectionReason = undefined;
      user.approvals.demat.rejectedBy = undefined;
      user.approvals.demat.rejectedAt = undefined;
    }
  } catch (error) {
    console.error("Error in assignDpId:", error);
  }
};

export const assignClientCode = async (user) => {
  try {
    if (user.clientCode) return;

    if (!user.branch || !user.branch._id) {
      console.error(
        `[assignClientCode] user.branch is missing for userId: ${user._id}`,
      );
      return;
    }

    const branch = await Branch.findById(user.branch._id);
    if (!branch) {
      console.error(
        `[assignClientCode] branch not found in DB for branchId: ${user.branch._id}`,
      );
      return;
    }

    const { prefix, series } = branch;
    let startNum = parseInt(series);
    if (isNaN(startNum)) startNum = 1;

    const lastUser = await User.aggregate([
      {
        $match: {
          clientCode: { $regex: `^${prefix}\\d+$` },
        },
      },
      {
        $project: {
          num: {
            $toInt: {
              $substr: ["$clientCode", prefix.length, -1],
            },
          },
        },
      },
      { $sort: { num: -1 } },
      { $limit: 1 },
    ]);

    if (lastUser.length > 0) {
      startNum = lastUser[0].num + 1;
    }

    let found = false;
    let attempt = 0;
    const batchSize = 50;
    const maxAttempts = 20;

    while (!found && attempt < maxAttempts) {
      const uccList = [];
      for (let i = 0; i < batchSize; i++) {
        const num = startNum + attempt * batchSize + i;
        const padding = Math.max(series.length, 3);
        const numStr = num.toString().padStart(padding, "0");
        uccList.push(`${prefix}${numStr}`);
      }

      try {
        const response = await fetch(
          `${process.env.SHARE_PRO_API}/ClientUCCCheckList`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              key: process.env.SHARE_PRO_API_KEY,
              UCCList: uccList,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          console.log(
            `[assignClientCode] SharePro API response data length: ${data.length}`,
          );

          for (const item of data) {
            if (item.success === 0 || item.message === "UCC does not exist") {
              // Check if this UCC is already assigned to another user in DB
              const existingUser = await User.findOne({ clientCode: item.UCC });
              if (!existingUser) {
                user.clientCode = item.UCC;
                found = true;
                break;
              }
            }
          }
          if (!found) {
            console.log(
              `[assignClientCode] Could not find any valid unassigned UCC in batch.`,
            );
          }
        } else {
          console.error(
            `[assignClientCode] SharePro API non-OK response: ${response.status} ${response.statusText}`,
          );
        }
      } catch (apiError) {
        console.error(
          "[assignClientCode] Error calling SharePro API:",
          apiError,
        );
      }

      if (!found) {
        attempt++;
      }
    }
  } catch (error) {
    console.error("Error in assignClientCode:", error);
  }
};

const getIPVDetails = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { ipv_request_id, PAN } = user;
    if (!ipv_request_id) {
      return res.status(404).json({ message: "IPV request ID not found" });
    }
    if (!PAN) {
      return res.status(400).json({ message: "PAN is missing" });
    }

    const apiUrl = `${process.env.API_LINK}/api/v3/liveness-secure/getData`;
    const requestData = { token: ipv_request_id };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.ACCESS_TOKEN_SECRET,
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        message: "Failed to retrieve IPV details",
        error: errorData,
      });
    }

    const data = await response.json();

    if (!data.result?.status) {
      user.liveness_status = "failed";
      await user.save();
      return res.status(400).json({
        message: "Face verification failed",
        error: "Face match verification was unsuccessful",
      });
    }

    const imageUrl = data.result.capturedImage;
    let imagePath = null;
    if (imageUrl && typeof imageUrl === "string") {
      try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(
            `Failed to download image: ${imageResponse.statusText}`,
          );
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const sharpImage = sharp(Buffer.from(imageBuffer));
        const metadata = await sharpImage.metadata();

        // Calculate center crop for 3.5:4.5 ratio
        const targetRatio = 3.5 / 4.5;
        let cropWidth = metadata.width;
        let cropHeight = metadata.height;
        if (metadata.width / metadata.height > targetRatio) {
          cropWidth = Math.round(metadata.height * targetRatio);
        } else {
          cropHeight = Math.round(metadata.width / targetRatio);
        }
        const cropX = Math.round((metadata.width - cropWidth) / 2);
        const cropY = Math.round((metadata.height - cropHeight) / 2);

        // Crop and resize to 350x450
        const processedBuffer = await sharpImage
          .extract({
            left: cropX,
            top: cropY,
            width: cropWidth,
            height: cropHeight,
          })
          .resize({ width: 350, height: 450, fit: "fill" })
          .png()
          .toBuffer();

        const photoFileName = `${PAN}_photo_${Date.now()}.png`;
        await uploadToMinio(
          `uploads/${photoFileName}`,
          processedBuffer,
          "image/png",
        );
        imagePath = `uploads/${photoFileName}`;
      } catch (imageError) {
        return res.status(500).json({
          message: "Failed to process and save image",
          error: imageError.message,
        });
      }
    } else {
      return res.status(400).json({ message: "Invalid or missing image URL" });
    }

    const matchPercentage = data.result.faceMatch?.matchPercentage;

    // Check if user already has a captured image and delete it
    if (user.ipv_details?.capturedImage) {
      try {
        const oldImageName = path.basename(user.ipv_details.capturedImage);
        deleteFromMinio(`uploads/${oldImageName}`);
      } catch (error) {
        console.error("Error deleting old captured image from MinIO:", error);
      }
    }

    user.ipv_details = {
      capturedImage: imagePath ? imagePath : data.result.capturedImage,
      matchPercentage: matchPercentage || "N/A",
      verificationStatus: true,
      verifiedAt: getISTDate(new Date()),
    };

    let matchValue = 0;
    if (matchPercentage) {
      matchValue = parseFloat(matchPercentage.replace("%", ""));
    }

    user.liveness_status = "verified";
    user.last_liveness_check = getISTDate(new Date());
    user.ipv_details.captured_at = getISTDate(new Date());

    // Ensure approvals.ipv object exists
    if (!user.approvals) user.approvals = {};
    if (!user.approvals.ipv) user.approvals.ipv = {};

    // if percentage greater than or equal to 80 then it will auto approval
    if (matchValue >= 80) {
      user.approvals.ipv.status = "approved";
      user.approvals.ipv.autoApproved = true;
      user.approvals.ipv.approveAt = getISTDate(new Date());
    } else {
      user.approvals.ipv.status = "pending";
      user.approvals.ipv.autoApproved = false;
    }

    // Assign DP ID once IPV is verified (idempotent if already set)
    await assignDpId(user);
    if (!user.rejectedStepsDone) user.rejectedStepsDone = [];
    if (user.rejectedSteps?.includes(6) && !user.rejectedStepsDone.includes(6)) {
      user.rejectedStepsDone.push(6);
    }
    if (user.approvals?.ipv && user.approvals.ipv.status === "rejected") {
      user.approvals.ipv.status = "pending";
    }

    user.max_step_completed = Math.max(user.max_step_completed || 0, 7);
    // Assign Client Code if not present (idempotent inside function)
    await assignClientCode(user);
    await user.save();

    return res.status(200).json({
      message: "IPV verification completed successfully",
      data: {
        capturedImage: user.ipv_details.capturedImage,
        matchPercentage: matchPercentage || "N/A",
        verificationStatus: true,
      },
    });
  } catch (error) {
    console.error("Error retrieving IPV details:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ─── Send IPV completion email to user's registered email ───────────────────
const sendIPVEmail = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) return res.status(404).json({ message: "User not found" });

    const userEmail = user.email;
    if (!userEmail) {
      return res
        .status(400)
        .json({ message: "No email address found for this user" });
    }

    // Build the mobile IPV link — embeds the JWT so the mobile browser is authenticated
    const ipvLink = `${process.env.FRONTEND_DEPLOY_URL}/ipv-mobile?token=${token}`;
    const userName = user.name?.fullName || user.name?.firstName || "User";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #f86a6e; margin: 0;">Lakshmishree Investment & Securities Limited</h2>
          <p style="color: #666; margin: 4px 0 0;">In-Person Verification (IPV)</p>
        </div>
        <div style="background: white; border-radius: 10px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <p style="color: #333; font-size: 16px;">Dear <strong>${userName}</strong>,</p>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            To complete your KYC verification, you need to take a quick selfie for In-Person Verification (IPV).
            Please open the link below on your <strong>mobile device</strong> and follow the instructions.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${ipvLink}" style="background: #f86a6e; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">
              Complete IPV on Mobile
            </a>
          </div>
          <p style="color: #888; font-size: 13px; text-align: center;">This link is unique to your account and expires in 24 hours. Do not share it with anyone.</p>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">Lakshmishree Investment & Securities Limited | This is an automated email. Please do not reply.</p>
      </div>
    `;

    await sendEmailWithFallback({
      from: `"Lakshmishree Investment & Securities Limited" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: "Complete Your IPV (In-Person Verification) - Action Required",
      html: htmlContent,
    });

    return res.status(200).json({
      success: true,
      message: `IPV link sent to ${userEmail}`,
    });
  } catch (error) {
    console.error("Error sending IPV email:", error);
    return res.status(500).json({
      message: "Failed to send IPV email",
      error: error.message,
    });
  }
};

// ─── Poll IPV completion status ───────────────────────────────────────────────
const checkIPVStatus = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isComplete = user.ipv_details?.verificationStatus === true;

    return res.status(200).json({
      success: true,
      isComplete,
      liveness_status: user.liveness_status,
      capturedImage: isComplete ? user.ipv_details.capturedImage : null,
      matchPercentage: isComplete ? user.ipv_details.matchPercentage : null,
    });
  } catch (error) {
    console.error("Error checking IPV status:", error);
    return res.status(500).json({
      message: "Internal server error checking IPV status",
      error: error.message,
    });
  }
};

const saveGeoLocation = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { latitude, longitude } = req.body;

    // Validate coordinates
    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude are required" });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ message: "Invalid latitude value" });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: "Invalid longitude value" });
    }

    // Get client IP address
    const ipAddress =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Update user's geolocation
    user.geolocation = {
      coordinates: {
        latitude,
        longitude,
      },
      capturedAt: getISTDate(new Date()),
      ipAddress,
    };

    await user.save();

    return res.status(200).json({
      message: "Geolocation saved successfully",
      data: {
        latitude,
        longitude,
        capturedAt: user.geolocation.capturedAt,
      },
    });
  } catch (error) {
    console.error("Error saving geolocation:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const processCamsKra = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Format date of birth
    const dob = new Date(user.dateOfBirth);
    const formattedDob = dob
      .toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");

    // Get KRA token
    const tokenResponse = await fetch(
      `${process.env.CAMS_KRA_API}/restAuth/api/v1/getToken`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.CAMS_KRA_API_USERNAME}:${process.env.CAMS_KRA_API_PASSWORD}`,
            ).toString("base64"),
        },
        body: JSON.stringify({
          clientCode: process.env.CAMS_KRA_API_CLIENT_CODE,
          grantType: "client_credentials",
          scope: "KYC",
        }),
      },
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.accessToken) {
      return res.status(401).json({
        success: false,
        message: "Failed to obtain KRA token",
        error: tokenData,
      });
    }

    // Prepare the payload correctly as per CAMS KRA documentation
    const rawPayload = {
      PAN: [
        {
          pan: user.PAN,
          dob: formattedDob,
        },
      ],
      sign_required: "Y",
    };

    // Encrypt the payload using camsEncryption.js
    const encryptedDataString = encryptPayload(rawPayload);

    // Download PAN using the obtained token
    const panResponse = await fetch(
      `${process.env.CAMS_KRA_API}/CAMSWS_KRA/KRA_API/PANdownload`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          clientId: process.env.CAMS_KRA_API_USERNAME,
          Authorization: `Bearer ${tokenData.accessToken}`,
        },
        body: JSON.stringify({
          data: encryptedDataString,
        }),
      },
    );

    const encryptedResponse = await panResponse.json();

    console.log("=== CAMS KRA RAW ENCRYPTED RESPONSE ===");
    console.log(JSON.stringify(encryptedResponse, null, 2));
    console.log("=======================================");

    let panData = {};
    if (encryptedResponse.data) {
      try {
        panData = decryptPayload(encryptedResponse.data);
        console.log("=== CAMS KRA DECRYPTED RESPONSE ===");
        console.log(JSON.stringify(panData, null, 2));
        console.log("===================================");
      } catch (err) {
        console.error("Failed to decrypt CAMS KRA response", err);
      }
    } else {
      // In case of error (e.g. 400), it might return plain text error
      panData = encryptedResponse;
    }

    // Check if camskra is '02' and update user accordingly
    if (user.camskra_available) {
      // Process and store address from KRA response
      const kycData = panData.kycData?.[0]; // It's an array

      if (kycData) {
        // Update user's address details
        user.address = {
          addressLine1: kycData.perAddress1 || "",
          addressLine2: kycData.perAddress2 || "",
          addressLine3: kycData.perAddress3 || "",
          city: kycData.perCity || "",
          state:
            statesWithDistricts.find((s) => s.state_code === kycData.perState)
              ?.state || "",
          stateCode:
            statesWithDistricts.find((s) => s.state_code === kycData.perState)
              ?.state_short || "",
          country: kycData.perCountry === "101" ? "India" : "",
          countryCode: kycData.perCountry === "101" ? "IN" : "",
          pincode: kycData.perPincode || "",
        };
        user.kycType = "KRA";
        user.max_step_completed = 3;
        await user.save();
      }
    }

    return res.status(200).json({
      success: true,
      data: user.address,
    });
  } catch (error) {
    console.error("Error in KRA process:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process KRA request",
      error: error.message,
    });
  }
};

const verifyPAN = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if KRA is already verified
    if (user.camskra_available) {
      return res.status(200).json({
        success: true,
        message: "KRA already verified",
      });
    }

    // Get KRA token
    const tokenResponse = await fetch(
      `${process.env.CAMS_KRA_API}/restAuth/api/v1/getToken`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.CAMS_KRA_API_USERNAME}:${process.env.CAMS_KRA_API_PASSWORD}`,
            ).toString("base64"),
        },
        body: JSON.stringify({
          clientCode: process.env.CAMS_KRA_API_CLIENT_CODE,
          grantType: "client_credentials",
          scope: "KYC",
        }),
      },
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.accessToken) {
      return res.status(401).json({
        success: false,
        message: "Failed to obtain KRA token",
        error: tokenData,
      });
    }

    // Verify PAN using the obtained token
    const panResponse = await fetch(
      `${process.env.CAMS_KRA_API}/CAMSWS_KRA/KRA_API/verifyPAN`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          clientId: process.env.CAMS_KRA_API_USERNAME,
          Authorization: `Bearer ${tokenData.accessToken}`,
        },
        body: JSON.stringify({
          pan: user.PAN,
        }),
      },
    );

    const panData = await panResponse.json();
    // console.log(panData.VerifyPanResponse?.camskra);

    // Check if camskra is '02' and update user accordingly
    if (
      panData.verifyPanResponse?.camskra === "07" ||
      panData.VerifyPanResponse?.camskra === "07"
    ) {
      user.camskra_available = true;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        panVerification: panData,
      },
    });
  } catch (error) {
    console.error("Error in PAN verification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify PAN",
      error: error.message,
    });
  }
};

const submitProfile = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      fatherName,
      motherName,
      networth,
      selectedQualification,
      selectedMaritalStatus,
      selectedNominee,
      numberOfNominees,
      nomineeDetails,
      selectedIncome,
      occupation,
      selectedTradingExperience,
      selectedDisSlipBook,
      investmentSource,
      runningAccountStatement,
    } = req.body;

    // Validate required fields
    if (
      !fatherName ||
      !motherName ||
      !networth ||
      !networth.amount ||
      !selectedQualification ||
      !selectedMaritalStatus ||
      !selectedNominee ||
      !selectedIncome ||
      !occupation ||
      !selectedTradingExperience ||
      !investmentSource ||
      !runningAccountStatement
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate investmentSource
    if (investmentSource !== "own-funds") {
      return res.status(400).json({ message: "Invalid investment source" });
    }

    // Validate runningAccountStatement frequency
    if (!["monthly", "quarterly"].includes(runningAccountStatement)) {
      return res
        .status(400)
        .json({ message: "Invalid running account statement frequency" });
    }

    // Update user profile with proper fullName concatenation
    // Handle father's name
    const {
      fullName: fatherFullName,
      firstName: fatherFirstName,
      middleName: fatherMiddleName,
      lastName: fatherLastName,
    } = extractNameParts(fatherName);

    user.fatherName = {
      fullName: fatherFullName,
      firstName: fatherFirstName,
      middleName: fatherMiddleName,
      lastName: fatherLastName,
    };

    // Handle mother's name
    const {
      fullName: motherFullName,
      firstName: motherFirstName,
      middleName: motherMiddleName,
      lastName: motherLastName,
    } = extractNameParts(motherName);

    user.motherName = {
      fullName: motherFullName,
      firstName: motherFirstName,
      middleName: motherMiddleName,
      lastName: motherLastName,
    };

    // Update other profile fields
    user.networth = networth;
    user.qualification = selectedQualification;
    user.maritalStatus = selectedMaritalStatus;
    user.annualIncome = selectedIncome;

    // Determine prefix based on gender and maritalStatus
    const genderLower = (user.gender || "").toLowerCase();
    const maritalLower = (selectedMaritalStatus || "").toLowerCase();

    if (genderLower === "male" || genderLower === "m") {
      user.prefix = "MR";
    } else if (genderLower === "female" || genderLower === "f") {
      if (maritalLower === "married") {
        user.prefix = "MRS";
      } else {
        user.prefix = "MS";
      }
    }

    // Handle nominees using the correct schema field
    if (
      selectedNominee === "yes" &&
      nomineeDetails &&
      nomineeDetails.length > 0
    ) {
      user.nominees = nomineeDetails.map((nominee) => {
        // Enhance nominee address with stateCode and countryCode
        let enhancedNomineeAddress = nominee.address;
        if (enhancedNomineeAddress && enhancedNomineeAddress.state) {
          const stateDetails = statesWithDistricts.find(
            (s) => s.state === enhancedNomineeAddress.state,
          );
          enhancedNomineeAddress = {
            ...enhancedNomineeAddress,
            stateCode: stateDetails ? stateDetails.state_short : "",
            countryCode: "IN",
          };
        }

        // Enhance guardian address with stateCode and countryCode
        let enhancedGuardianAddress = nominee.guardian?.address;
        if (enhancedGuardianAddress && enhancedGuardianAddress.state) {
          const stateDetails = statesWithDistricts.find(
            (s) => s.state === enhancedGuardianAddress.state,
          );
          enhancedGuardianAddress = {
            ...enhancedGuardianAddress,
            stateCode: stateDetails ? stateDetails.state_short : "",
            countryCode: "IN",
          };
        }

        return {
          name: nominee.name,
          gender: nominee.gender,
          relation: nominee.relation,
          dob: nominee.dob,
          sharePercentage: nominee.sharePercentage,
          guardian: nominee.guardian
            ? {
                name: nominee.guardian.name,
                relation: nominee.guardian.relation,
                identityType: nominee.guardian.identityType,
                identityNumber: nominee.guardian.identityNumber,
                mobile: nominee.guardian.mobile,
                email: nominee.guardian.email,
                address: enhancedGuardianAddress || nominee.guardian.address,
              }
            : { name: "", relation: "" },
          identityType: nominee.identityType,
          identityNumber: nominee.identityNumber,
          mobile: nominee.mobile,
          email: nominee.email,
          address: enhancedNomineeAddress || nominee.address,
        };
      });
    } else {
      user.nominees = [];
    }

    user.occupation = occupation;
    user.tradingExperience = selectedTradingExperience;
    user.disSlipBookRequired = selectedDisSlipBook === "true";
    user.investmentSource = investmentSource;
    user.runningAccountStatement = {
      frequency: runningAccountStatement,
    };
    user.max_step_completed = Math.max(user.max_step_completed || 0, 5);

    if (!user.rejectedStepsDone) user.rejectedStepsDone = [];
    if (user.rejectedSteps?.includes(4) && !user.rejectedStepsDone.includes(4)) {
      user.rejectedStepsDone.push(4);
    }
    if (user.approvals?.profile) {
      user.approvals.profile.status = "pending";
    }

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      data: {
        fatherName: user.fatherName,
        motherName: user.motherName,
        networth: user.networth,
        qualification: user.qualification,
        maritalStatus: user.maritalStatus,
        nominee: user.nominees,
        income: user.income,
        occupation: user.occupation,
        tradingExperience: user.tradingExperience,
        disSlipBookRequired: user.disSlipBookRequired,
        investmentSource: user.investmentSource,
        runningAccountStatement: user.runningAccountStatement,
      },
    });
  } catch (error) {
    console.error("Profile Update Error:", error);
    res.status(500).json({
      message: "Internal server error during profile update",
      error: error.message,
    });
  }
};

const getProfileData = async (req, res) => {
  try {
    // Extract JWT token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    // Find user by mobile number from decoded token
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prepare profile data object with only fields that match submitProfile API
    const profileData = {
      fatherName: {
        firstName: user.fatherName?.firstName || "",
        middleName: user.fatherName?.middleName || "",
        lastName: user.fatherName?.lastName || "",
        fullName: user.fatherName?.fullName || "",
      },
      motherName: {
        firstName: user.motherName?.firstName || "",
        middleName: user.motherName?.middleName || "",
        lastName: user.motherName?.lastName || "",
        fullName: user.motherName?.fullName || "",
      },
      networth: user.networth || "",
      qualification: user.qualification || "",
      maritalStatus: user.maritalStatus || "",
      nominees: user.nominees || [],
      occupation: user.occupation || "",
      tradingExperience: user.tradingExperience || "",
      disSlipBookRequired: user.disSlipBookRequired || false,
      investmentSource: user.investmentSource || "",
      annualIncome: user.annualIncome || "",
      runningAccountStatement: user.runningAccountStatement || {},
    };

    res.status(200).json({
      success: true,
      message: "Profile data retrieved successfully",
      data: profileData,
    });
  } catch (error) {
    console.error("Error retrieving profile data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving profile data",
      error: error.message,
    });
  }
};

const getAddressData = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      success: true,
      message: "Address data retrieved successfully",
      data: {
        address: user.address,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving address data",
      error: error.message,
    });
  }
};

const saveDDPIConsent = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const mobileNumber = decoded.mobileNumber;
    const {
      transfer_of_security,
      pledging,
      mutual_fund_transaction,
      tendering_shares,
    } = req.body;

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.ddpiConcent = {
      transfer_of_security: transfer_of_security || false,
      pledging: pledging || false,
      mutual_fund_transaction: mutual_fund_transaction || false,
      tendering_shares: tendering_shares || false,
    };

    await user.save();
    res
      .status(200)
      .json({
        success: true,
        message: "DDPI consent saved successfully",
        ddpiConcent: user.ddpiConcent,
      });
  } catch (error) {
    console.error("Error saving DDPI consent:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const uploadPanProof = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No PAN file uploaded" });
    }

    const file = req.file;
    const allowedMimes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedMimes.includes(file.mimetype.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only PDF and Images (JPG, JPEG, PNG, WEBP) are supported.",
      });
    }

    // Delete old PAN file from MinIO if exists
    if (user.PAN_file) {
      try {
        await deleteFromMinio(user.PAN_file);
      } catch (err) {
        console.error("Error deleting existing PAN file from MinIO:", err.message);
      }
    }

    const timestamp = Date.now();
    const panIdentifier = user.PAN || user.mobileNumber || "PAN";
    let finalBuffer;
    let finalMime = "application/pdf";
    let panKey;

    if (file.mimetype.toLowerCase() === "application/pdf") {
      // Direct PDF upload without modification
      finalBuffer = file.buffer;
      panKey = `uploads/${panIdentifier}_pan_${timestamp}.pdf`;
    } else {
      // Image upload: Convert to A4 PDF with heading "PAN"
      const pngBuffer = await sharp(file.buffer).rotate().png().toBuffer();

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 size: 595 x 842 pt
      const { width, height } = page.getSize();

      const helveticaBold = await pdfDoc.embedFont("Helvetica-Bold");
      const headingY = height - 60;

      // Draw Heading "PAN"
      page.drawText("PAN", {
        x: 50,
        y: headingY,
        size: 24,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      // Embed image
      const embeddedImg = await pdfDoc.embedPng(pngBuffer);

      // Scale to fit nicely on A4 page (margins: 50 left/right, top below heading, bottom 50)
      const maxWidth = width - 100; // 495
      const maxHeight = headingY - 80; // 702
      const imgWidth = embeddedImg.width;
      const imgHeight = embeddedImg.height;

      const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);
      const renderWidth = imgWidth * scale;
      const renderHeight = imgHeight * scale;

      const renderX = (width - renderWidth) / 2;
      const renderY = headingY - 30 - renderHeight;

      page.drawImage(embeddedImg, {
        x: renderX,
        y: renderY,
        width: renderWidth,
        height: renderHeight,
      });

      const pdfBytes = await pdfDoc.save();
      finalBuffer = Buffer.from(pdfBytes);
      panKey = `uploads/${panIdentifier}_pan_${timestamp}.pdf`;
    }

    // Upload to MinIO
    await uploadToMinio(panKey, finalBuffer, finalMime);

    user.PAN_file = panKey;
    user.pan_source = "manual";
    await user.save();

    return res.status(200).json({
      success: true,
      message: "PAN document uploaded successfully",
      data: {
        PAN_file: user.PAN_file,
        pan_source: user.pan_source,
      },
    });
  } catch (error) {
    console.error("Error uploading PAN proof:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload PAN document",
      error: error.message,
    });
  }
};



const deletePanProof = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.PAN_file) {
      try {
        await deleteFromMinio(user.PAN_file);
      } catch (err) {
        console.error("Error deleting PAN from MinIO:", err.message);
      }
      user.PAN_file = null;
      user.pan_source = null;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "PAN document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting PAN proof:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete PAN document",
      error: error.message,
    });
  }
};

export {
  checkPAN,
  confirmPAN,
  extractionPAN,
  confirmPanExtraction,
  createDigilockerUrl,
  digilockerWebhook,
  getDigilockerDetails,
  getUserDetails,
  hybridBankAccountVerification,
  reversePennyDropCreateLink,
  verifyReversePennyDrop,
  uploadBankProof,
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
  getAddressData,
  getProfileData,
  saveDDPIConsent,
  uploadPanProof,
  deletePanProof,
};
