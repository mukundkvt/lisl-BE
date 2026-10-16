//For User

import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { PDFDocument } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";
import { uploadToMinio, getFileBufferFromMinio, deleteFromMinio } from "../utils/minioClient.js";
import { getAnnexureJEnabledValue } from "../controllers/settingController.js";

async function getExistingSignedInfo(user, contractId) {
  const normalize = (p) => (p ? p.toString().replace(/^[\/\\]+/, "") : null);
  const exists = async (p) => {
    if (!p) return false;
    const normalized = normalize(p);
    const absolutePath = path.isAbsolute(normalized)
      ? normalized
      : path.join(process.cwd(), normalized);
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  };

  if (
    user?.contract?.contractId === contractId &&
    user?.digitalSignatureContract?.signedByClient &&
    (await exists(user.digitalSignatureContract.signedPdf))
  ) {
    return {
      type: "contract",
      signedPdfPath: normalize(user.digitalSignatureContract.signedPdf),
      contractName: user.digitalSignatureContract.contractName || "Demat Account Opening Form",
    };
  }

  if (
    user?.annexureJContract?.contractId === contractId &&
    user?.annexureJContract?.signedByClient &&
    (await exists(user.annexureJContract.signedPdf))
  ) {
    return {
      type: "annexureJ",
      signedPdfPath: normalize(user.annexureJContract.signedPdf),
      contractName: user.annexureJContract.contractName || "Annexure J",
    };
  }

  return null;
}

// Helper to process signed contract and update user
async function processSignedContract(user, type, data) {
    try {
        if (!data.finalSignedContract) return { success: false, message: "No signed contract url" };

        const contractName = data.contractName ? data.contractName.toString() : "";
        let effectiveType = type;
        if (contractName && contractName.toLowerCase().includes("annexure")) {
            effectiveType = "annexureJ";
        }

        user.digitalSignatureContract = user.digitalSignatureContract || {};
        user.annexureJContract = user.annexureJContract || {};
        user.rejectedSteps = user.rejectedSteps || [];

        const timestamp = Date.now();
        let signedPdfPath;
        
        if (effectiveType === 'contract') {
             signedPdfPath = `uploads/${user.PAN}_${timestamp}.pdf`;
        } else {
             signedPdfPath = `uploads/AnnexureJ_Signed_${user.PAN}_${timestamp}.pdf`;
        }

        const previousSignedPdf =
          effectiveType === "contract"
            ? user.digitalSignatureContract.signedPdf
            : user.annexureJContract.signedPdf;

        if (previousSignedPdf) {
          try {
            await deleteFromMinio(previousSignedPdf);
          } catch {}
        }

        // Fetch and upload PDF to MinIO
        const pdfResponse = await fetch(data.finalSignedContract);
        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        const pdfBuffer = Buffer.from(pdfArrayBuffer);
        await uploadToMinio(signedPdfPath, pdfBuffer, "application/pdf");
        
        const istTime = getISTDate(new Date());

        const signerList =
            data.signer_details ||
            data.signerdetail ||
            data.signerDetail ||
            data.signerDetails ||
            [];
        const firstSigner = Array.isArray(signerList) ? signerList[0] : null;

        if (effectiveType === 'contract') {
            // Delete unsigned PDF from MinIO
             if (user.digitalSignatureContract?.unSignedPdf) {
                try {
                    await deleteFromMinio(user.digitalSignatureContract.unSignedPdf);
                    console.log("[MinIO] Deleted unsigned PDF:", user.digitalSignatureContract.unSignedPdf);
                } catch (error) {
                    console.log("[MinIO] Error deleting unsigned PDF:", error.message);
                }
            }
            
            user.digitalSignatureContract.contractName = contractName || user.digitalSignatureContract.contractName || null;
            user.digitalSignatureContract.signedByClient = true;
            user.digitalSignatureContract.mailSent = true;
            user.digitalSignatureContract.signedPdf = signedPdfPath;
            user.digitalSignatureContract.unSignedPdf = null;
            user.digitalSignatureContract.signedTime = istTime;
            user.userStatus = "esigned";

            if (firstSigner) {
                user.digitalSignatureContract.signer_name =
                    firstSigner.signerName || firstSigner.signer_name || user.digitalSignatureContract.signer_name || null;
                user.digitalSignatureContract.signerGender =
                    firstSigner.signerGender || firstSigner.gender || user.digitalSignatureContract.signerGender || null;
                user.digitalSignatureContract.signerYearOfBirth =
                    firstSigner.signerYearOfBirth ||
                    firstSigner.yearOfBirth ||
                    user.digitalSignatureContract.signerYearOfBirth ||
                    null;
            }
            
            // Remove rejected step
            const digitalSign_rejected_value = 8;
            const index = user.rejectedSteps.findIndex(num => num === digitalSign_rejected_value);
            if (index !== -1) user.rejectedSteps.splice(index, 1);
            
            // Update max_step_completed for step 8 (Esign Part 1)
            user.max_step_completed = Math.max(user.max_step_completed || 0, 8);

            // If Annexure J is disabled, Part 1 completion = fully done
            const annexureJEnabled = await getAnnexureJEnabledValue();
            if (!annexureJEnabled) {
                user.max_step_completed = Math.max(user.max_step_completed || 0, 9);
            }
            
        } else {
             // Annexure J
             user.annexureJContract.contractId =
                 user.annexureJContract.contractId || data.contractId || null;
             user.annexureJContract.contractName = contractName || user.annexureJContract.contractName || null;
             user.annexureJContract.signedByClient = true;
             user.annexureJContract.signedPdf = signedPdfPath;
             user.annexureJContract.signedTime = istTime;
             
             // Update max_step_completed for step 9 (Esign Part 2 / Thank You)
             user.max_step_completed = Math.max(user.max_step_completed || 0, 9);
        }

        const annexureJEnabledVal = await getAnnexureJEnabledValue();
        const isFullyCompleted = !annexureJEnabledVal || effectiveType === "annexureJ";
        if (isFullyCompleted) {
            user.userStatus = "esigned";
            user.rejectedSteps = [];
            user.rejectedStepsDone = [];
            if (user.approvals?.digitalSign) {
                user.approvals.digitalSign.status = "pending";
                user.approvals.digitalSign.rejectionReason = undefined;
            }
        }
        
        await user.save();
        return { success: true, signedPdfPath, type: effectiveType };
    } catch (error) {
        console.error("Error in processSignedContract:", error);
        return { success: false, error: error.message };
    }
}

function getYearFromDate(dateString) {
  const date = new Date(dateString);
  return date.getUTCFullYear().toString();
}

// Function to get total pages in PDF
async function getPDFPageCount(pdfPath) {
  try {
    const pdfBytes = await getFileBufferFromMinio(pdfPath);
    if (!pdfBytes) return null;
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error("Error getting PDF page count:", error);
    return null;
  }
}

// Function to generate coordinates for additional pages
function generateAdditionalCoordinates(startPage, endPage) {
  const coords = [];
  for (let i = startPage; i <= endPage; i++) {
    coords.push({
      pageNo: [i],
      signaturePosition: ["customize"],
      xCoordinate: [420],
      yCoordinate: [11],
    });
  }
  return coords;
}

// Base coordinates for known pages
const defaultCoordinates = [
  {
    pageNo: [5],
    signaturePosition: ["customize"],
    xCoordinate: [445],
    yCoordinate: [272],
  },
  {
    pageNo: [7],
    signaturePosition: ["customize"],
    xCoordinate: [445],
    yCoordinate: [469],
  },

  {
    pageNo: [10],
    signaturePosition: ["customize"],
    xCoordinate: [445],
    yCoordinate: [102],
  },
  {
    pageNo: [11],
    signaturePosition: ["customize"],
    xCoordinate: [136, 135],
    yCoordinate: [440, 132],
  },
  {
    pageNo: [13],
    signaturePosition: ["customize"],
    xCoordinate: [82],
    yCoordinate: [116],
  },
  {
    pageNo: [14],
    signaturePosition: ["customize"],
    xCoordinate: [142, 147],
    yCoordinate: [490, 121],
  },
  {
    pageNo: [15],
    signaturePosition: ["customize"],
    xCoordinate: [445],
    yCoordinate: [48],
  },

  {
    pageNo: [20],
    signaturePosition: ["customize"],
    xCoordinate: [445],
    yCoordinate: [183],
  },

  {
    pageNo: [21],
    signaturePosition: ["customize"],
    xCoordinate: [134],
    yCoordinate: [613],
  },
  {
    pageNo: [23],
    signaturePosition: ["customize"],
    xCoordinate: [133, 136],
    yCoordinate: [572, 111],
  },
  {
    pageNo: [24],
    signaturePosition: ["customize"],
    xCoordinate: [145, 139],
    yCoordinate: [393, 113],
  },
  {
    pageNo: [26],
    signaturePosition: ["customize"],
    xCoordinate: [417],
    yCoordinate: [99],
  },
];

// Controller function to create contract URL
const createContractUrl = async (req, res) => {
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

    // Assume user's PAN is stored in the User model (adjust field name as needed)
    const pan = user.PAN; // Replace 'PAN' with the actual field name in your User schema
    if (!pan) {
      return res.status(400).json({ message: "User PAN not found" });
    }

    // Get the unsigned PDF path from digitalSignatureContract
    if (!user.digitalSignatureContract?.unSignedPdf) {
      return res.status(400).json({ message: "Unsigned PDF not found" });
    }
    // Construct file URL based on user's PAN
    const localPdfPath = user.digitalSignatureContract.unSignedPdf;
    const fileUrl = `${process.env.BACKEND_SERVER}${localPdfPath}`;
    console.log(localPdfPath)

    // Get PDF page count and generate additional coordinates if needed
    let pageCount = user.digitalSignatureContract?.pdfPageCount;
    if (!pageCount || pageCount === 0) {
      const absolutePdfPath = path.join(process.cwd(), localPdfPath);
      pageCount = await getPDFPageCount(absolutePdfPath);
    }
    let coordinates = [...defaultCoordinates];

    // Add segment-specific signature coordinates based on user's exchange segments
    if (user.exchange?.segments?.Cash) {
      coordinates.push({
        pageNo: [9],
        signaturePosition: ["customize"],
        xCoordinate: [179, 299],
        yCoordinate: [480, 480],
      });
    }

    if (user.exchange?.segments?.FO) {
      coordinates.push({
        pageNo: [9],
        signaturePosition: ["customize"],
        xCoordinate: [179, 299],
        yCoordinate: [453, 453],
      });
    }

    if (user.exchange?.segments?.Commodities) {
      coordinates.push({
        pageNo: [9],
        signaturePosition: ["customize"],
        xCoordinate: [443],
        yCoordinate: [404],
      });
    }

    if (user.exchange?.segments?.MF) {
      coordinates.push({
        pageNo: [9],
        signaturePosition: ["customize"],
        xCoordinate: [312],
        yCoordinate: [349],
      });
    }

    // Add page 16 coordinates conditionally based on ddpiConcent
    const ddpiX = [];
    const ddpiY = [];

    if (user.ddpiConcent?.transfer_of_security) {
      ddpiX.push(397);
      ddpiY.push(99);
    }
    if (user.ddpiConcent?.pledging) {
      ddpiX.push(396);
      ddpiY.push(176);
    }
    if (user.ddpiConcent?.mutual_fund_transaction) {
      ddpiX.push(396);
      ddpiY.push(259);
    }
    if (user.ddpiConcent?.tendering_shares) {
      ddpiX.push(397);
      ddpiY.push(357);
    }

    if (ddpiX.length > 0) {
      coordinates.push({
        pageNo: [16],
        signaturePosition: ["customize"],
        xCoordinate: ddpiX,
        yCoordinate: ddpiY,
      });
    }

    // Add page 13 coordinates conditionally based on nominees present
    const nomineeSignX = [];
    const nomineeSignY = [];

    if (user.nominees?.[0]?.name && user.nominees[0].name.trim() !== "") {
      nomineeSignX.push(462);
      nomineeSignY.push(576);
    }
    if (user.nominees?.[1]?.name && user.nominees[1].name.trim() !== "") {
      nomineeSignX.push(462);
      nomineeSignY.push(559);
    }
    if (user.nominees?.[2]?.name && user.nominees[2].name.trim() !== "") {
      nomineeSignX.push(462);
      nomineeSignY.push(538);
    }

    if (nomineeSignX.length > 0) {
      coordinates.push({
        pageNo: [13],
        signaturePosition: ["customize"],
        xCoordinate: nomineeSignX,
        yCoordinate: nomineeSignY,
      });
    }

    if (pageCount && pageCount > 27) {
      coordinates.push(...generateAdditionalCoordinates(28, pageCount));
    }

    // Prepare API request
    const apiUrl = `${process.env.API_LINK}/api/v3/contract/initiate`;
    const requestData = {
      pdf: fileUrl,
      contractName: "Demat Account Opening Form",
      contractExecuterName: "Lakshmishree Investment & Securities Limited",
      

      signerdetail: [
        {
          signerName: user.name.fullName,
          signerEmail: user.email,
          signerMobile: user.mobileNumber.toString(),
          signerGender: user.gender,
          signerYearOfBirth: getYearFromDate(user.dateOfBirth),
          signerUniqueId: user.lsid,
          signatureType: "AADHAARESIGN-OTP",
          cancelBySigner: false,
          signatures: coordinates,
        },
      ],
      estamp: {
        type: "ESTAMP",
        firstPartyName: "LAKSHMISHREE INVESTMENTS AND SECURITIES LTD",
        secondPartyName: user.name.fullName,
        stampDutyPaidBy: "LAKSHMISHREE INVESTMENTS AND SECURITIES LTD",
        stampDetails: [
          process.env.NODE_ENV === "production"
            ? {
                stateCode: "UP",
                articleCode: "UP10005",
                stampDutyValue: "100",
                purposeOfStampDuty: "Demat Account Opening Form",
                count: 1,
              }
            : {
                stateCode: "UP",
                articleCode: "UP10005",
                stampDutyValue: "100",
                purposeOfStampDuty: "Demat Account Opening Form",
                count: 1,
              },
        ],
      },
      callbackUrl: `${process.env.BACKEND_SERVER}/api/contract/webhook`,
      successRedirectUrl: `${process.env.FRONTEND_DEPLOY_URL}/esign?part=1&status=success`,
      redirectTime: 5,
      failureRedirectUrl: `${process.env.FRONTEND_DEPLOY_URL}/esign?part=1&status=failed`,
      contractTtl: "86400", // 24 hours in seconds
    };

    // Log payload for debugging
    console.log("==========================================");
    console.log("CREATE_CONTRACT_URL PAYLOAD:", JSON.stringify(requestData, null, 2));
    console.log("==========================================");

    // Make API request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: process.env.CONTRACT_ACCESS_TOKEN_SECRET,
        "Content-Type": "application/json",
      },

      body: JSON.stringify(requestData),
    });

    // Check API response
    if (response.ok) {
      const data = await response.json();

      // Update user's contract information directly
      user.contract = {
        contractId: data.contractId,
        contractStatus: "pending",
      };
      await user.save();

      return res.status(200).json({
        message: "Contract URL created successfully",
        contractId: data.contractId,
        signingUrl: data.signerdetail[0]?.workflowUrl, // Return the signing URL for the first signer
      });
    } else {
      const errorData = await response.json();
      console.error("API Error Response:", errorData); // Console log the error
      return res.status(response.status).json({
        message: "Failed to create contract URL",
        error: errorData,
        coordinates
      });
    }
  } catch (error) {
    console.error("Error creating contract URL:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Controller function to pull contract data
const pullContract = async (req, res) => {
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

    // Get contractId from user's database record
    if (!user.contract?.contractId) {
      return res
        .status(400)
        .json({ message: "No contract found for this user" });
    }
    const contractId = user.contract.contractId;

    const existing = await getExistingSignedInfo(user, contractId);
    if (existing) {
      return res.status(200).json({
        success: true,
        message:
          existing.type === "annexureJ"
            ? "Annexure J already signed"
            : "Contract already signed",
        data: {
          contractName: existing.contractName,
          signedPdfPath: existing.signedPdfPath,
        },
      });
    }

    // Prepare API request
    const apiUrl = `${process.env.API_LINK}/api/v3/contract/pullData`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: process.env.CONTRACT_ACCESS_TOKEN_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contractId }),
    });

    // Check API response
    if (response.ok) {
      const data = await response.json();
      console.log("API Response:", data); // Log the API response

      // Check if finalSignedContract exists in response
      if (data.finalSignedContract) {
        const inferredType =
          (data.contractName || "").toString().toLowerCase().includes("annexure")
            ? "annexureJ"
            : "contract";
        if (inferredType === "annexureJ") {
          user.annexureJContract = user.annexureJContract || {};
          user.annexureJContract.contractId =
            user.annexureJContract.contractId || contractId;
        }

        const result = await processSignedContract(user, inferredType, data);
        if (!result.success) {
          return res.status(500).json({
            success: false,
            message: "Failed to save signed contract",
            error: result.error || result.message,
          });
        }

        return res.status(200).json({
          success: true,
          message:
            inferredType === "annexureJ"
              ? "Annexure J signed and saved successfully"
              : "Contract signed and saved successfully",
          data: {
            ...data,
            signedPdfPath: result.signedPdfPath,
          },
        });
      }

      return res.status(200).json({
        success: false,
        message: "Contract not yet signed",
        data: data,
      });
    } else {
      const errorData = await response.json();
      console.error("API Error Response:", errorData);
      return res.status(response.status).json({
        message: "Failed to pull contract data",
        error: errorData,
      });
    }
  } catch (error) {
    console.error("Error pulling contract data:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const createAnnexureJUrl = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) return res.status(404).json({ message: "User not found" });

    const pan = user.PAN;
    if (!pan) return res.status(400).json({ message: "User PAN not found" });

    if (!user.annexureJContract?.unSignedPdf) {
      return res.status(400).json({ message: "Unsigned Annexure J PDF not found" });
    }

    const localPdfPath = user.annexureJContract.unSignedPdf;
    const fileUrl = `${process.env.BACKEND_SERVER}${localPdfPath}`;

    let pageCount = user.annexureJContract?.pdfPageCount;
    if (!pageCount || pageCount === 0) {
      const absolutePdfPath = path.join(process.cwd(), localPdfPath);
      pageCount = await getPDFPageCount(absolutePdfPath);
    }

    // Sign on all pages after 2nd page
    const startPage = 3;
    const endPage = pageCount;
    
    let coordinates = [
      {
        pageNo: [1],
        signaturePosition: ["customize"],
        xCoordinate: [391],
        yCoordinate: [55],
      },
      {
        pageNo: [2],
        signaturePosition: ["customize"],
        xCoordinate: [284],
        yCoordinate: [325],
      },
    ];
    if (Number.isInteger(endPage) && endPage >= startPage) {
        coordinates.push(...generateAdditionalCoordinates(startPage, endPage));
    }

    const apiUrl = `${process.env.API_LINK}/api/v3/contract/initiate`;
    const requestData = {
      pdf: fileUrl,
      contractName: "Annexure J",
      contractExecuterName: "Lakshmishree Investment & Securities Limited",
      signerdetail: [
        {
          signerName: user.name.fullName,
          signerEmail: user.email,
          signerMobile: user.mobileNumber.toString(),
          signerGender: user.gender,
          signerYearOfBirth: getYearFromDate(user.dateOfBirth),
          signerUniqueId: user.lsid,
          signatureType: "AADHAARESIGN-OTP",
          cancelBySigner: false,
          signatures: coordinates,
        },
      ],
      // No estamp for Annexure J
      callbackUrl: `${process.env.BACKEND_SERVER}/api/contract/webhook`,
      successRedirectUrl: `${process.env.FRONTEND_DEPLOY_URL}/esign?part=2&status=success`,
      failureRedirectUrl: `${process.env.FRONTEND_DEPLOY_URL}/esign?part=2&status=failed`,
      contractTtl: "86400",
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: process.env.CONTRACT_ACCESS_TOKEN_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (response.ok) {
      const data = await response.json();
      user.annexureJContract.contractId = data.contractId;
      await user.save();
      res.json({ success: true, signingUrl: data.signerdetail[0]?.workflowUrl, contractId: data.contractId });
    } else {
      const errorData = await response.json();
      res.status(response.status).json({ success: false, message: "Failed to initiate e-sign", error: errorData });
    }
  } catch (error) {
    console.error("Error creating Annexure J URL:", error);
    res.status(500).json({ success: false, message: "Error creating Annexure J URL", error: error.message });
  }
};

const pullAnnexureJ = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (tokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user || !user.annexureJContract?.contractId) {
      return res.status(404).json({ message: "Contract not found" });
    }

    const contractId = user.annexureJContract.contractId;

    const existing = await getExistingSignedInfo(user, contractId);
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Annexure J already signed",
        data: {
          contractName: existing.contractName,
          signedPdfPath: existing.signedPdfPath,
        },
      });
    }

    const apiUrl = `${process.env.API_LINK}/api/v3/contract/pullData`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: process.env.CONTRACT_ACCESS_TOKEN_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contractId }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.finalSignedContract) {
        const result = await processSignedContract(user, "annexureJ", data);
        if (!result.success) {
          return res.status(500).json({
            success: false,
            message: "Failed to save signed contract",
            error: result.error || result.message,
          });
        }

        return res.status(200).json({
          success: true,
          message: "Annexure J signed successfully",
          data: { ...data, signedPdfPath: result.signedPdfPath },
        });
      }
      return res.status(200).json({ success: false, message: "Annexure J not yet signed", data });
    } else {
      const errorData = await response.json();
      res.status(response.status).json({ success: false, message: "Failed to pull contract data", error: errorData });
    }
  } catch (error) {
    console.error("Error pulling Annexure J:", error);
    res.status(500).json({ success: false, message: "Error pulling Annexure J", error: error.message });
  }
};

const handleContractWebhook = async (req, res) => {
    try {
        console.log("Webhook received:", req.body);
        const { contractId } = req.body; 

        if (!contractId) {
             return res.status(200).json({ message: "No contractId in payload" });
        }

        let user = await User.findOne({ "contract.contractId": contractId });
        let type = 'contract';
        
        if (!user) {
            user = await User.findOne({ "annexureJContract.contractId": contractId });
            type = 'annexureJ';
        }
        
        if (!user) {
            console.error("User not found for contractId:", contractId);
            return res.status(200).json({ message: "User not found" });
        }

        const existing = await getExistingSignedInfo(user, contractId);
        if (existing) {
          return res.status(200).json({ success: true });
        }
        
        const apiUrl = `${process.env.API_LINK}/api/v3/contract/pullData`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                Authorization: process.env.CONTRACT_ACCESS_TOKEN_SECRET,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ contractId }),
        });
        
        if (response.ok) {
            const data = await response.json();
             if (data.finalSignedContract) {
                 const result = await processSignedContract(user, type, data);
                 return res.status(200).json({ success: !!result.success });
             }
        }
        
        return res.status(200).json({ success: false, message: "Could not retrieve signed contract" });

    } catch (error) {
        console.error("Webhook error:", error);
        return res.status(500).json({ error: error.message });
    }
};

// Export the controllers
export { createContractUrl, pullContract, createAnnexureJUrl, pullAnnexureJ, handleContractWebhook };
