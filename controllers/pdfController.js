//For User

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import jwt from "jsonwebtoken";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pdfFieldsConfig, annexureJFieldsConfig } from "../config/pdfConfig.js";
import User from "../models/User.js";
import AdminUser from "../models/AdminUser.js";
import formatDateToDDMMYYY from "../utils/formatDate.js";
import convertToIndianTimeDate from "../utils/convertToIndianTimeDate.js";
import {
  uploadToMinio,
  getFileBufferFromMinio,
  deleteFromMinio,
} from "../utils/minioClient.js";
import { assignDpId, assignClientCode } from "./kycController.js";
import { flattenPdfDocument } from "../utils/flattenPdf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to robustly resolve file paths
const resolveFilePath = (filePath) => {
  if (!filePath) return null;

  const normalizedPath = path.normalize(filePath);

  // If the path already starts with the CWD, it is absolute and correct.
  if (normalizedPath.startsWith(process.cwd())) {
    return normalizedPath;
  }

  // If on Windows and path starts with a drive letter, assume it's absolute
  if (process.platform === "win32" && /^[a-zA-Z]:/.test(normalizedPath)) {
    return normalizedPath;
  }

  // For all other cases (including /uploads on Linux or \uploads on Windows without drive letter),
  // we strip leading separators to ensure it's treated as relative to CWD.
  const relativePath = normalizedPath.replace(/^[\/\\]+/, "");

  return path.join(process.cwd(), relativePath);
};

const createA4PdfFromImage = async (imagePath, headerText) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);
  const headerSize = 24;
  const headerWidth = font.widthOfTextAtSize(headerText, headerSize);
  page.drawText(headerText, {
    x: (width - headerWidth) / 2,
    y: height - 60,
    size: headerSize,
    font,
    color: rgb(0, 0, 0),
  });

  const imageBytes = await getFileBufferFromMinio(imagePath);
  const ext = (path.extname(imagePath) || "").toLowerCase();
  const embeddedImage =
    ext === ".png"
      ? await pdfDoc.embedPng(imageBytes)
      : await pdfDoc.embedJpg(imageBytes);

  const imgDims = embeddedImage.scale(1);
  const maxWidth = width - 80;
  const maxHeight = height - 160;
  const scale = Math.min(
    1,
    maxWidth / imgDims.width,
    maxHeight / imgDims.height,
  );

  const scaledWidth = imgDims.width * scale;
  const scaledHeight = imgDims.height * scale;

  page.drawImage(embeddedImage, {
    x: (width - scaledWidth) / 2,
    y: height - 100 - scaledHeight,
    width: scaledWidth,
    height: scaledHeight,
  });

  return await pdfDoc.save();
};

const createA4PdfFromImages = async (imagePaths, headerText) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);

  for (const imagePath of imagePaths.filter(Boolean)) {
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();

    const headerSize = 24;
    const headerWidth = font.widthOfTextAtSize(headerText, headerSize);
    page.drawText(headerText, {
      x: (width - headerWidth) / 2,
      y: height - 60,
      size: headerSize,
      font,
      color: rgb(0, 0, 0),
    });

    const imageBytes = await getFileBufferFromMinio(imagePath);
    const ext = (path.extname(imagePath) || "").toLowerCase();
    const embeddedImage =
      ext === ".png"
        ? await pdfDoc.embedPng(imageBytes)
        : await pdfDoc.embedJpg(imageBytes);

    const imgDims = embeddedImage.scale(1);
    const maxWidth = width - 80;
    const maxHeight = height - 160;
    const scale = Math.min(
      1,
      maxWidth / imgDims.width,
      maxHeight / imgDims.height,
    );

    const scaledWidth = imgDims.width * scale;
    const scaledHeight = imgDims.height * scale;

    page.drawImage(embeddedImage, {
      x: (width - scaledWidth) / 2,
      y: height - 100 - scaledHeight,
      width: scaledWidth,
      height: scaledHeight,
    });
  }

  return await pdfDoc.save();
};

const createA4PdfSideBySideImages = async ({
  leftImagePath,
  rightImagePath,
  headerText,
}) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);
  const headerSize = 24;
  const headerWidth = font.widthOfTextAtSize(headerText, headerSize);
  page.drawText(headerText, {
    x: (width - headerWidth) / 2,
    y: height - 60,
    size: headerSize,
    font,
    color: rgb(0, 0, 0),
  });

  const cardWidth = 243;
  const cardHeight = 153;
  const y = 520;
  const margin = 40;

  const embedImage = async (imagePath) => {
    const imageBytes = await getFileBufferFromMinio(imagePath);
    const ext = (path.extname(imagePath) || "").toLowerCase();
    return ext === ".png"
      ? await pdfDoc.embedPng(imageBytes)
      : await pdfDoc.embedJpg(imageBytes);
  };

  const drawFitted = (embeddedImage, box) => {
    const imgDims = embeddedImage.scale(1);
    const scale = Math.min(
      1,
      box.width / imgDims.width,
      box.height / imgDims.height,
    );
    const scaledWidth = imgDims.width * scale;
    const scaledHeight = imgDims.height * scale;
    const x = box.x + (box.width - scaledWidth) / 2;
    const y = box.y + (box.height - scaledHeight) / 2;
    page.drawImage(embeddedImage, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });
  };

  const leftBox = { x: margin, y, width: cardWidth, height: cardHeight };
  const rightBox = {
    x: width - margin - cardWidth,
    y,
    width: cardWidth,
    height: cardHeight,
  };
  const centerBox = {
    x: (width - cardWidth) / 2,
    y,
    width: cardWidth,
    height: cardHeight,
  };

  if (leftImagePath && rightImagePath) {
    const leftImg = await embedImage(leftImagePath);
    const rightImg = await embedImage(rightImagePath);
    drawFitted(leftImg, leftBox);
    drawFitted(rightImg, rightBox);
  } else {
    const onlyPath = leftImagePath || rightImagePath;
    if (!onlyPath) return await pdfDoc.save();
    const img = await embedImage(onlyPath);
    drawFitted(img, centerBox);
  }

  return await pdfDoc.save();
};

// Static folder for KYC images
const UPLOADS_FOLDER = "./uploads";

function getTradingExperienceYears(tradingExperience) {
  if (tradingExperience === "1-5-years") {
    return "1 - 5 years";
  } else if (tradingExperience === "greater-than-5-years") {
    return "more than 5 years";
  } else {
    return "0";
  }
}

function getNomineeAddressWithoutPincode(nominee) {
  if (!nominee?.address) return "";
  const parts = [
    nominee.address.addressLine1,
    nominee.address.addressLine2,
    nominee.address.addressLine3,
    nominee.address.city,
    nominee.address.state,
    nominee.address.country,
  ].filter((p) => p && typeof p === "string" && p.trim() !== "");
  return parts.join(", ");
}

function getNomineeIdentification(nominee) {
  if (!nominee) return " ";
  const type = nominee.identityType ? String(nominee.identityType).trim() : "";
  const number = nominee.identityNumber
    ? String(nominee.identityNumber).trim()
    : "";
  if (type && number) {
    return `${type} - ${number}`;
  }
  return type || number || " ";
}

/**
 * Load and cache a font file for the current request
 */
const loadFont = async (pdfDoc, weight) => {
  try {
    const fontPath = path.join(
      __dirname,
      "../assets/fonts",
      `Inter-${weight}.ttf`,
    );
    const fontBytes = await fs.readFile(fontPath);
    return await pdfDoc.embedFont(fontBytes);
  } catch (error) {
    console.error(`Error loading custom font, using Helvetica:`, error);
    return await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
  }
};

/**
 * Draw text on the PDF page
 */
const drawTextOnPage = async (page, text, config, pdfDoc, fonts) => {
  try {
    const {
      x = 50,
      y = 750,
      size = 12,
      letterSpacing = 0,
      lineHeight = 1.2,
      centerWithinWidth = null,
      widthForLineBreak = null,
      isCheckbox = false,
      font: { family = "Inter", weight = 400, style = "normal" } = {},
      color = [0, 0, 0],
    } = config;

    const { height } = page.getSize();
    const pdfY = height - y;

    let font = fonts.get(weight) || (await loadFont(pdfDoc, weight));
    fonts.set(weight, font);

    if (!font) throw new Error("Failed to load font");

    const [r, g, b] = color.map((c) => Math.max(0, Math.min(1, c)));

    if (isCheckbox || config.isCross) {
      if (
        text &&
        (text === true ||
          text === 1 ||
          text === "yes" ||
          text === "true" ||
          text === "cross" ||
          text === "✓" ||
          text === "✕" ||
          text === "X")
      ) {
        const mark = config.isCross ? "X" : "✓";
        const textWidth = font.widthOfTextAtSize(mark, size);
        let adjustedX = x;
        if (centerWithinWidth && centerWithinWidth > textWidth) {
          adjustedX = x + (centerWithinWidth - textWidth) / 2;
        }
        page.drawText(mark, {
          x: adjustedX,
          y: pdfY,
          size,
          font,
          color: rgb(r, g, b),
        });
      }
    } else {
      const textWidth = font.widthOfTextAtSize(text.toString(), size);
      let adjustedX = x;
      if (centerWithinWidth && centerWithinWidth > textWidth) {
        adjustedX = x + (centerWithinWidth - textWidth) / 2;
      }

      if (letterSpacing > 0) {
        const chars = text.toString().split("");
        let currentX = adjustedX;
        for (const char of chars) {
          page.drawText(char, {
            x: currentX,
            y: pdfY,
            size,
            font,
            color: rgb(r, g, b),
          });
          const charWidth = font.widthOfTextAtSize(char, size);
          currentX += charWidth + letterSpacing;
        }
      } else if (widthForLineBreak) {
        const words = text.toString().split(" ");
        let currentLine = "";
        let currentY = pdfY;

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine = currentLine === "" ? word : `${currentLine} ${word}`;
          const testWidth = font.widthOfTextAtSize(testLine, size);

          if (testWidth > widthForLineBreak && currentLine !== "") {
            page.drawText(currentLine, {
              x: adjustedX,
              y: currentY,
              size,
              font,
              color: rgb(r, g, b),
            });
            currentLine = word;
            currentY -= size * lineHeight;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine !== "") {
          page.drawText(currentLine, {
            x: adjustedX,
            y: currentY,
            size,
            font,
            color: rgb(r, g, b),
          });
        }
      } else {
        page.drawText(text.toString(), {
          x: adjustedX,
          y: pdfY,
          size,
          font,
          color: rgb(r, g, b),
        });
      }
    }
  } catch (error) {
    console.error("Error drawing text:", error);
  }
};

/**
 * Embed an image on the PDF page with custom position and page
 */
const drawImageOnPage = async (page, imagePath, pdfDoc, config = {}) => {
  try {
    const { x = 50, y = 50, scale = 0.5 } = config;

    const imageBytes = await getFileBufferFromMinio(imagePath);
    if (!imageBytes) {
      console.error("Could not get image bytes for:", imagePath);
      return;
    }

    const ext = (path.extname(imagePath) || "").toLowerCase();
    const image =
      ext === ".jpg" || ext === ".jpeg"
        ? await pdfDoc.embedJpg(imageBytes)
        : await pdfDoc.embedPng(imageBytes);

    const { width, height } = image.scale(scale);

    page.drawImage(image, {
      x,
      y,
      width,
      height,
    });
  } catch (error) {
    console.error("Error embedding image:", error);
  }
};

export const fillPDFForm = async (req, res) => {
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
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if already signed (skip if user is in rejection mode needing re-signing)
    const isRejectedMode =
      user.userStatus === "rejected" ||
      (Array.isArray(user.rejectedSteps) && user.rejectedSteps.includes(8));

    if (user.digitalSignatureContract?.signedByClient && !isRejectedMode) {
      return res.status(200).json({
        success: true,
        message: "Contract already signed",
        filePath: user.digitalSignatureContract.signedPdf,
        isSigned: true,
      });
    }

    // Check and assign DP ID and Client Code if missing
    if (!user.dpId) {
      await assignDpId(user);
    }
    if (!user.clientCode) {
      await assignClientCode(user);
    }

    // Save user if dpId, clientCode, or approvals were updated
    if (
      user.isModified("dpId") ||
      user.isModified("clientCode") ||
      user.isModified("approvals")
    ) {
      await user.save();
    }

    // Verify assignment status before generating PDF
    if (!user.dpId) {
      return res.status(400).json({
        success: false,
        message: "Not able to assign DP ID, Please contact Admin",
      });
    }
    if (!user.clientCode) {
      return res.status(400).json({
        success: false,
        message: "Not able to assign Client Code, Please contact Admin",
      });
    }

    // Check if already generated (skip if in rejection mode so updated data gets rendered)
    if (
      !isRejectedMode &&
      user.digitalSignatureContract?.generatedPdf &&
      user.digitalSignatureContract?.unSignedPdf
    ) {
      const existingPdfPath = resolveFilePath(
        user.digitalSignatureContract.unSignedPdf,
      );
      try {
        await fs.access(existingPdfPath);
        return res.status(200).json({
          success: true,
          message: "PDF already generated",
          filePath: user.digitalSignatureContract.unSignedPdf,
          contractStatus: user.contract?.contractStatus,
        });
      } catch (e) {
        // File doesn't exist, proceed to regenerate
      }
    }

    const options = {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    };

    const indiaDate = new Intl.DateTimeFormat("en-GB", options).format(
      new Date(),
    );

    const addressProofType = (user.addressProof?.type || "").toLowerCase();
    const addressProofNumber = user.addressProof?.number || "";
    const aadhaarNum =
      user.aadhaar_number ||
      (addressProofType === "aadhaar" ? addressProofNumber : "");

    const isAadhaar = Boolean(aadhaarNum || addressProofType === "aadhaar");
    const isPassport =
      addressProofType === "passport" || addressProofType.includes("passport");
    const isVoter =
      addressProofType === "voter_id" ||
      addressProofType === "voter" ||
      addressProofType.includes("voter");
    const isDriving =
      addressProofType === "driving_license" ||
      addressProofType === "driving" ||
      addressProofType.includes("driving");
    const isNarega =
      addressProofType === "nrega" ||
      addressProofType.includes("nrega") ||
      addressProofType.includes("narega");
    const isOther = Boolean(
      addressProofType &&
      !isAadhaar &&
      !isPassport &&
      !isVoter &&
      !isDriving &&
      !isNarega,
    );

    const isPanPresent = Boolean(user.PAN);
    const passportExpiry = isPassport
      ? user.addressProof?.expiryDate || user.addressProof?.expiry_date || " "
      : " ";
    const drivingExpiry = isDriving
      ? user.addressProof?.expiryDate || user.addressProof?.expiry_date || " "
      : " ";

    // Map user data to form fields (adjust based on your User schema)
    const formData = {
      currentDate: indiaDate,
      boId: user.dpId,
      clientCode: user.clientCode || " ",
      lsid: user.lsid || " ",
      place: user.address.city || " ",
      PAN: user.PAN || " ",
      prefix: user.prefix || " ",
      firstName: user.name.firstName || " ",
      middleName: user.name.middleName || " ",
      lastName: user.name.lastName || " ",
      fullName: user.name.fullName || " ",
      email: user.email || " ",
      DOB: formatDateToDDMMYYY(user.dateOfBirth) || " ",
      mobileNumber: user.mobileNumber || " ",
      isApplicationTypeNew: true,
      isApplicationTypeUpdate: false,
      isAccountTypeNormal: true,
      fatherPrefix: "MR",
      fatherFirstName: user.fatherName.firstName.toUpperCase() || " ",
      fatherMiddleName: user.fatherName.middleName.toUpperCase() || " ",
      fatherLastName: user.fatherName.lastName.toUpperCase() || " ",
      motherPrefix: "MRS",
      motherFirstName: user.motherName.firstName.toUpperCase() || " ",
      motherMiddleName: user.motherName.middleName.toUpperCase() || " ",
      motherLastName: user.motherName.lastName.toUpperCase() || " ",
      maskedAadhaarNumber: user.aadhaar_number || " ",

      // Proof of Identity (Page 6)
      isPassportTick: isPassport,
      passportNumber: isPassport ? addressProofNumber : " ",
      passportExpiry: passportExpiry,

      isVoterIdTick: isVoter,
      voterIdNumber: isVoter ? addressProofNumber : " ",

      isPanCardTick: isPanPresent,

      isDrivingLicenceTick: isDriving,
      drivingLicenceNumber: isDriving ? addressProofNumber : " ",
      drivingLicenceExpiry: drivingExpiry,

      isAadhaarTick: isAadhaar,

      isNregaTick: isNarega,
      nregaNumber: isNarega ? addressProofNumber : " ",

      isOtherProofTick: isOther,
      otherDocumentName: isOther
        ? user.addressProof?.name || user.addressProof?.type || " "
        : " ",
      otherDocumentNumber: isOther ? addressProofNumber : " ",

      genderMale: user.gender === "male" ? true : false,
      genderFemale: user.gender === "female" ? true : false,
      isMarried: user.maritalStatus === "married" ? true : false,
      isUnmarried: user.maritalStatus === "unmarried" ? true : false,
      isIndian: true,
      isResidentIndividual: true,
      isOccupation_privateSector:
        user.occupation === "privateSector" ? true : false,
      isOccupation_publicSector:
        user.occupation === "publicSector" ? true : false,
      isOccupation_business: user.occupation === "business" ? true : false,
      isOccupation_professional:
        user.occupation === "professional" ? true : false,
      // isOccupation_agriculturist:user.occupation ==='agriculturist'? true : false,
      isOccupation_retired: user.occupation === "retired" ? true : false,
      isOccupation_houseWife: user.occupation === "houseWife" ? true : false,
      isOccupation_student: user.occupation === "student" ? true : false,
      isOccupation_governmentService:
        user.occupation === "governmentService" ? true : false,
      isOccupation_others: user.occupation === "others" ? true : false,
      currentAddressTicked: true,
      permanentAddressTick: true,
      isAddressTypeResidential: true,
      isAddressProofTypeAadhaar: true,
      currentAddressLine1: user.address.addressLine1 || " ",
      currentAddressLine2: user.address.addressLine2 || " ",
      currentAddressLine3: user.address.addressLine3 || " ",
      currentAddressCity: user.address.city || " ",
      // currentAddressState: user.address.state || ' ',
      currentAddressStateCode: user.address.stateCode || " ",
      currentAddressCountryCode: user.address.countryCode || " ",
      currentAddressPincode: user.address.pincode || " ",
      permanentAddressLine1: user.address.addressLine1 || " ",
      permanentAddressLine2: user.address.addressLine2 || " ",
      permanentAddressLine3: user.address.addressLine3 || " ",
      permanentAddressCity: user.address.city || " ",
      // permanentAddressState: user.address.state || ' ',
      permanentAddressStateCode: user.address.stateCode || " ",
      permanentAddressCountryCode: user.address.countryCode || " ",
      permanentAddressPincode: user.address.pincode || " ",
      mobileNumberPrefix: "91",
      mobileNumber: user.mobileNumber || "",
      email: user.email || "",
      institutionName: "LAKSHMISHREE INVESTMENT AND SECURITIES LTD",
      institutionCode: "IN0571",
      IPVLatitude: `Longitude : ${user.geolocation.coordinates.latitude}`,
      IPVLongitude: `Longitude : ${user.geolocation.coordinates.longitude}`,
      IPVCapturedTime: convertToIndianTimeDate(user.geolocation.capturedAt),
      isIncomeBelow1Lakh: user.annualIncome === "below1Lakh" ? true : false,
      isIncome1to5Lakh: user.annualIncome === "oneToFiveLakhs" ? true : false,
      isIncome5to10Lakh: user.annualIncome === "fiveToTenLakhs" ? true : false,
      isIncome10to25Lakh:
        user.annualIncome === "tenToTwentyFiveLakhs" ? true : false,
      isIncomeAbove25Lakh:
        user.annualIncome === "aboveTwentyFiveLakhs" ? true : false,
      netWorthValue: user.networth.amount || " ",
      netWorthAsOnDate:
        `${user.networth.date.day}/${user.networth.date.month}/${user.networth.date.year}` ||
        " ",
      iscCustomerClassificationOther:
        user.exchange.customerClassification === "Others" ? true : false,
      isCustomerClassificationFarmer:
        user.exchange.customerClassification === "Farmer" ? true : false,
      politicalExposedPersonCross: true,
      relatedPoliticalPersonCross: true,
      isBankAccountSaving:
        !user.bank_account_details?.account_type ||
        user.bank_account_details?.account_type === "" ||
        user.bank_account_details?.account_type?.toUpperCase() === "SAVINGS",
      bankAccountNumber: user.bank_account_details.account_number || " ",
      bankAccountIFSCCode: user.bank_account_details.ifsc_code || " ",
      bankAccountBankName: user.bank_account_details.bank_name || " ",
      bankAccountBankAddress: user.bank_account_details.address || " ",
      bankAccountBankMICRCode: user.bank_account_details.micr_code || " ",
      DP_CDSL_TICK: true,
      DPName: "Lakshmishree Investment & Securities Limited",
      DPid: user.dpId || " ",
      DPidfirsteight: user.dpId ? user.dpId.toString().slice(0, 8) : " ",
      DPidlasteight: user.dpId ? user.dpId.toString().slice(-8) : " ",
      isElectronicContractNote: true,
      isInternetTrading: true,
      isNonPastAction: true,
      tradingExperienceYears:
        getTradingExperienceYears(user.tradingExperience) || " ",
      isInvestementForTrading: true,
      notSelectedSegment: (() => {
        const segments = user.exchange?.segments || {};
        const notSelected = [];
        // Cash → NSECASH + BSECASH (NSE ✅ WHITE, BSE ✅ WHITE, MCX ❌ GREY)
        if (!segments.Cash) {
          notSelected.push("NSECASH", "BSECASH");
        }
        // FO → NSEFANDO + BSEFANDO (NSE ✅ WHITE, BSE ✅ WHITE, MCX ❌ GREY)
        if (!segments.FO) {
          notSelected.push("NSEFANDO", "BSEFANDO");
        }
        // Commodities → NSECOMMODITY + MCXMCOMMODITY (NSE ✅ WHITE, BSE ❌ GREY, MCX ✅ WHITE)
        if (!segments.Commodities) {
          notSelected.push("NSECOMMODITY", "MCXMCOMMODITY");
        }
        // MF → NSESLB + BSESTARMF (NSE SLBM ✅ WHITE, BSE Star MF ✅ WHITE, MCX ❌ GREY)
        if (!segments.MF) {
          notSelected.push("NSESLB", "BSESTARMF");
        }
        // CURRENCY (NSECURRENCY) → NSE ✅ WHITE only, but no schema field to track → skip
        return notSelected.length > 0 ? notSelected.join(",") : " ";
      })(),
      isAutomaticCredit: true,
      isAccountStatementAsPerSebi: true,
      isAgreeToShareEmailToRTA: true,
      isHoldingStatementOnEmail: true,
      isAnnualStatementOnEmail: true,
      isDpAcceptedAllPledges: true,
      isNonAccountOpeningPowerOfAttorney: false,
      isAccountOpeningPowerOfAttorney: true,
      isWishToRecieveDivident: true,
      isSMSonSelf: true,
      isDDPIGrantedMobile: true,
      isHighValueTransactionTrading: true,
      isNonUSAPerson: true,
      isIndianTaxResident: true,
      isIndiaCitizen: true,
      isDISSlipBookRequied: user.disSlipBookRequired,
      isDISSlipBookNotRequied: !user.disSlipBookRequired,
      isKYCDocumentOnEmail: true,

      firstNomineeName: user?.nominees?.[0]?.name || " ",
      firstNomineeShare: user?.nominees?.[0]?.sharePercentage || " ",
      firstNomineeRelation: user?.nominees?.[0]?.relation || " ",
      firstNomineeDateOfBirth: user?.nominees?.[0]?.guardian?.name
        ? `${user?.nominees?.[0]?.dob?.day}/${user?.nominees?.[0]?.dob?.month}/${user?.nominees?.[0]?.dob?.year}`
        : " ",
      firstNomineeGuadianName: user?.nominees?.[0]?.guardian?.name || " ",
      firstNomineeMobile: user?.nominees?.[0]?.mobile || " ",
      firstNomineeEmail: user?.nominees?.[0]?.email || " ",
      firstNomineeAddress:
        getNomineeAddressWithoutPincode(user?.nominees?.[0]) || " ",
      firstNomineePINCode: user?.nominees?.[0]?.address?.pincode || " ",
      firstNomineeIdentification: getNomineeIdentification(user?.nominees?.[0]),
      firstNomineeIdentificationType: user?.nominees?.[0]?.identityType || " ",
      firstNomineeIdentificationNumber:
        user?.nominees?.[0]?.identityNumber || " ",

      secondNomineeName: user?.nominees?.[1]?.name || " ",
      secondNomineeShare: user?.nominees?.[1]?.sharePercentage || " ",
      secondNomineeRelation: user?.nominees?.[1]?.relation || " ",
      secondNomineeDateOfBirth: user?.nominees?.[1]?.guardian?.name
        ? `${user?.nominees?.[1]?.dob?.day}/${user?.nominees?.[1]?.dob?.month}/${user?.nominees?.[1]?.dob?.year}`
        : " ",
      secondNomineeGuadianName: user?.nominees?.[1]?.guardian?.name || " ",
      secondNomineeMobile: user?.nominees?.[1]?.mobile || " ",
      secoundNomineeMobile: user?.nominees?.[1]?.mobile || " ",
      secondNomineeEmail: user?.nominees?.[1]?.email || " ",
      secondNomineeAddress:
        getNomineeAddressWithoutPincode(user?.nominees?.[1]) || " ",
      secondNomineePINCode: user?.nominees?.[1]?.address?.pincode || " ",
      secondNomineeIdentification: getNomineeIdentification(
        user?.nominees?.[1],
      ),
      secondNomineeIdentificationType: user?.nominees?.[1]?.identityType || " ",
      secondNomineeIdentificationNumber:
        user?.nominees?.[1]?.identityNumber || " ",

      thirdNomineeName: user?.nominees?.[2]?.name || " ",
      thirdNomineeShare: user?.nominees?.[2]?.sharePercentage || " ",
      thirdNomineeRelation: user?.nominees?.[2]?.relation || " ",
      thirdNomineeDateOfBirth: user?.nominees?.[2]?.guardian?.name
        ? `${user?.nominees?.[2]?.dob?.day}/${user?.nominees?.[2]?.dob?.month}/${user?.nominees?.[2]?.dob?.year}`
        : " ",
      thirdNomineeGuadianName: user?.nominees?.[2]?.guardian?.name || " ",
      thirdNomineeMobile: user?.nominees?.[2]?.mobile || " ",
      thirdNomineeEmail: user?.nominees?.[2]?.email || " ",
      thirdNomineeAddress:
        getNomineeAddressWithoutPincode(user?.nominees?.[2]) || " ",
      thirdNomineePINCode: user?.nominees?.[2]?.address?.pincode || " ",
      thirdNomineeIdentification: getNomineeIdentification(user?.nominees?.[2]),
      thirdNomineeIdentificationType: user?.nominees?.[2]?.identityType || " ",
      thirdNomineeIdentificationNumber:
        user?.nominees?.[2]?.identityNumber || " ",

      nominee1ClientFullName: user?.nominees?.[0]?.name
        ? user?.name?.fullName || " "
        : " ",
      nominee2ClientFullName: user?.nominees?.[1]?.name
        ? user?.name?.fullName || " "
        : " ",
      nominee3ClientFullName: user?.nominees?.[2]?.name
        ? user?.name?.fullName || " "
        : " ",

      isNomineePresent:
        user?.nominees &&
        user.nominees.length > 0 &&
        user.nominees.some(
          (n) =>
            (n?.name && n.name.trim() !== "") ||
            (n?.relation && n.relation.trim() !== ""),
        )
          ? "Yes"
          : " ",

      isPeriodicStatementMonthly:
        user.runningAccountStatement.frequency === "monthly" ? true : false,
      isPeriodicStatementQuaterly:
        user.runningAccountStatement.frequency === "quarterly" ? true : false,
      isENCEmailComunication: true,
      isAuthorizedToDebitDepositoryCharges: true,
      isRequestCommodityForward: true,
      isAcceptedSecuritiesAsColleteralForALLSegments: true,
    };

    // Validate form data
    if (!formData.PAN) {
      return res.status(400).json({
        success: false,
        message: "Required field PAN is missing",
      });
    }

    const templatePath = path.join(__dirname, "../assets/template.pdf");

    // Load PDF and register fontkit
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    const pages = pdfDoc.getPages();
    const fonts = new Map();

    // Process each field from formData
    for (const [fieldName, value] of Object.entries(formData)) {
      const fieldConfigs = pdfFieldsConfig[fieldName];

      if (!fieldConfigs) {
        console.log(`No configuration found for field: ${fieldName}`);
        continue;
      }

      if (!value) {
        // console.log(`No value provided for field: ${fieldName}`);
        continue;
      }

      if (Array.isArray(fieldConfigs)) {
        for (const config of fieldConfigs) {
          const pageIndex = config.page - 1;
          if (pageIndex < pages.length) {
            await drawTextOnPage(
              pages[pageIndex],
              value,
              config,
              pdfDoc,
              fonts,
            );
          } else {
            console.log(
              `Page ${config.page} not found for field: ${fieldName}`,
            );
          }
        }
      }
    }

    // Embed the photo with custom placement
    const pan = formData.PAN;
    if (!user.ipv_details || !user.ipv_details.capturedImage) {
      return res
        .status(400)
        .json({ message: "User photo path not found in database" });
    }

    const photoPath = user.ipv_details.capturedImage;
    const photoBuffer = await getFileBufferFromMinio(photoPath);
    if (!photoBuffer) {
      console.error("Image file not found:", photoPath);
      return res
        .status(400)
        .json({ message: "Image file not found on server" });
    }

    // Custom image configuration
    const imageConfig = {
      page: 5,
      x: 483,
      y: 302,
      scale: 0.25,
    };

    const pageIndex = imageConfig.page - 1;
    if (pageIndex < pages.length) {
      await drawImageOnPage(pages[pageIndex], photoPath, pdfDoc, {
        x: imageConfig.x,
        y: imageConfig.y,
        scale: imageConfig.scale,
      });
    } else {
      console.log(`Page ${imageConfig.page} not found for image placement`);
    }

    const additionalPDFs = [];

    if (user.PAN_file) {
      const panBuffer = await getFileBufferFromMinio(user.PAN_file);
      if (panBuffer) {
        const ext = (path.extname(user.PAN_file) || "").toLowerCase();
        if (ext === ".pdf") {
          additionalPDFs.push({ type: "bytes", bytes: panBuffer });
        } else {
          const panPdfBytes = await createA4PdfFromImage(
            user.PAN_file,
            "PAN Proof",
          );
          additionalPDFs.push({ type: "bytes", bytes: panPdfBytes });
        }
      } else {
        console.log("PAN file not found:", user.PAN_file);
      }
    }

    if (user.aadhaar_file) {
      const aadhaarBuffer = await getFileBufferFromMinio(user.aadhaar_file);
      if (aadhaarBuffer) {
        additionalPDFs.push({ type: "bytes", bytes: aadhaarBuffer });
      } else {
        console.log("Aadhaar file not found:", user.aadhaar_file);
      }
    } else if (user.addressProof?.mergedPdf) {
      const addressProofBuffer = await getFileBufferFromMinio(
        user.addressProof.mergedPdf,
      );
      if (addressProofBuffer) {
        additionalPDFs.push({ type: "bytes", bytes: addressProofBuffer });
      } else {
        console.log(
          "Address proof file not found:",
          user.addressProof.mergedPdf,
        );
      }
    } else if (user.addressProof?.frontImage) {
      const frontBuffer = await getFileBufferFromMinio(
        user.addressProof.frontImage,
      );
      if (frontBuffer) {
        const addressPdfBytes = await createA4PdfSideBySideImages({
          leftImagePath: user.addressProof.frontImage,
          rightImagePath: user.addressProof?.backImage || null,
          headerText: "Address Proof",
        });
        additionalPDFs.push({ type: "bytes", bytes: addressPdfBytes });
      } else {
        console.log(
          "Address proof file not found:",
          user.addressProof.frontImage,
        );
      }
    }

    if (user.signature?.signature_pdf) {
      const signatureBuffer = await getFileBufferFromMinio(
        user.signature.signature_pdf,
      );
      if (signatureBuffer) {
        additionalPDFs.push({ type: "bytes", bytes: signatureBuffer });
      } else {
        console.log("Signature file not found:", user.signature.signature_pdf);
      }
    }

    if (user.bank_account_details?.bank_proof_file) {
      const bankProofBuffer = await getFileBufferFromMinio(
        user.bank_account_details.bank_proof_file,
      );
      if (bankProofBuffer) {
        const ext = (
          path.extname(user.bank_account_details.bank_proof_file) || ""
        ).toLowerCase();
        if (ext === ".pdf") {
          additionalPDFs.push({ type: "bytes", bytes: bankProofBuffer });
        } else {
          const bankPdfBytes = await createA4PdfFromImage(
            user.bank_account_details.bank_proof_file,
            "Bank Proof",
          );
          additionalPDFs.push({ type: "bytes", bytes: bankPdfBytes });
        }
      } else {
        console.log(
          "Bank proof file not found:",
          user.bank_account_details.bank_proof_file,
        );
      }
    }

    if (user.exchange?.financialProofs) {
      for (const proof of user.exchange.financialProofs) {
        if (proof.filePath) {
          const proofBuffer = await getFileBufferFromMinio(proof.filePath);
          if (proofBuffer) {
            additionalPDFs.push({ type: "bytes", bytes: proofBuffer });
          } else {
            console.log("Financial proof file not found:", proof.filePath);
          }
        }
      }
    }

    // Check for existing unsigned PDF and delete it from MinIO and local disk if exists
    if (user.digitalSignatureContract?.unSignedPdf) {
      const oldPdfPath = user.digitalSignatureContract.unSignedPdf;
      try {
        await deleteFromMinio(oldPdfPath);
        console.log("Deleted existing unsigned PDF from MinIO:", oldPdfPath);
      } catch (error) {
        console.log(
          "Error deleting existing unsigned PDF from MinIO:",
          error.message,
        );
      }
      try {
        const existingPdfPath = resolveFilePath(oldPdfPath);
        await fs.access(existingPdfPath);
        await fs.unlink(existingPdfPath);
        console.log("Deleted existing unsigned PDF locally:", existingPdfPath);
      } catch (error) {}
    }

    // Generate timestamp and create filename
    const timestamp = Date.now();
    const fileName = `${pan}_${timestamp}.pdf`;
    const relativePath = `/uploads/${fileName}`;

    let finalPageCount = pdfDoc.getPageCount();

    // Save the main form PDF first
    const mainPdfBytes = await pdfDoc.save();
    await uploadToMinio(
      relativePath,
      Buffer.from(mainPdfBytes),
      "application/pdf",
    );

    // If there are additional PDFs to merge
    if (additionalPDFs.length > 0) {
      const mergedPdf = await PDFDocument.create();

      // Add pages from main PDF
      const mainPdfDoc = await PDFDocument.load(mainPdfBytes);
      const mainPages = await mergedPdf.copyPages(
        mainPdfDoc,
        mainPdfDoc.getPageIndices(),
      );
      mainPages.forEach((page) => mergedPdf.addPage(page));

      for (const item of additionalPDFs) {
        try {
          const pdfBytes =
            item.type === "bytes"
              ? item.bytes
              : await getFileBufferFromMinio(item.path);
          const pdf = await PDFDocument.load(pdfBytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach((page) => mergedPdf.addPage(page));
        } catch (error) {
          console.error("Error merging PDF:", item.path || "in-memory", error);
        }
      }

      // Save the merged PDF to MinIO
      const mergedPdfBytes = await mergedPdf.save();
      finalPageCount = mergedPdf.getPageCount();
      await uploadToMinio(
        relativePath,
        Buffer.from(mergedPdfBytes),
        "application/pdf",
      );
    }

    // Update user document in database
    await User.findOneAndUpdate(
      { mobileNumber: decoded.mobileNumber },
      {
        $set: {
          "digitalSignatureContract.generatedPdf": true,
          "digitalSignatureContract.unSignedPdf": relativePath,
          "digitalSignatureContract.pdfPageCount": finalPageCount,
        },
      },
    );

    res.json({
      success: true,
      message: "PDF created successfully and database updated",
      filePath: relativePath,
    });
  } catch (error) {
    console.error("Error creating PDF:", error);
    res.status(500).json({
      success: false,
      message: "Error creating PDF",
      error: error.message,
    });
  }
};

// Add this function to your existing pdfController.js
export const previewPDFWithField = async (req, res) => {
  try {
    const { fieldName, x, y, page, text, size = 12 } = req.body;

    if (!fieldName || !x || !y || !page || !text) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: fieldName, x, y, page, text",
      });
    }

    const templatePath = path.join(__dirname, "../assets/template.pdf");
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    const pages = pdfDoc.getPages();
    const pageIndex = page - 1;

    if (pageIndex >= pages.length) {
      return res.status(400).json({
        success: false,
        message: `Page ${page} not found in template`,
      });
    }

    const fonts = new Map();

    // Draw the text at the specified coordinates
    await drawTextOnPage(
      pages[pageIndex],
      text,
      {
        x: parseInt(x),
        y: parseInt(y),
        size: parseInt(size),
      },
      pdfDoc,
      fonts,
    );

    // Save the preview PDF
    const previewPdfBytes = await pdfDoc.save();
    const previewPath = path.join(
      __dirname,
      `../temp/preview_${fieldName}_${Date.now()}.pdf`,
    );

    // Ensure the directory exists
    const dir = path.dirname(previewPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(previewPath, previewPdfBytes);

    res.json({
      success: true,
      message: "Preview PDF created",
      filePath: previewPath,
      config: {
        fieldName,
        page,
        x,
        y,
        size,
      },
    });
  } catch (error) {
    console.error("Error creating preview PDF:", error);
    res.status(500).json({
      success: false,
      message: "Error creating preview PDF",
      error: error.message,
    });
  }
};

export const fillAnnexureJ = async (req, res) => {
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
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Check if Part 1 is signed
    if (!user.digitalSignatureContract?.signedByClient) {
      return res.status(400).json({
        success: false,
        message: "Please complete eSign Part 1 first.",
      });
    }

    // Check if Annexure J is already signed
    if (user.annexureJContract?.signedByClient) {
      return res.status(200).json({
        success: true,
        message: "Annexure J already signed",
        filePath: user.annexureJContract.signedPdf,
        isSigned: true,
      });
    }

    // Check if Annexure J is already generated
    if (
      user.annexureJContract?.generatedPdf &&
      user.annexureJContract?.unSignedPdf
    ) {
      const existingPdfPath = resolveFilePath(
        user.annexureJContract.unSignedPdf,
      );
      try {
        await fs.access(existingPdfPath);
        return res.status(200).json({
          success: true,
          message: "Annexure J PDF already generated",
          filePath: user.annexureJContract.unSignedPdf,
        });
      } catch (e) {
        // File doesn't exist, proceed to regenerate
      }
    }

    const indiaDate = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());

    const templatePath = path.join(__dirname, "../assets/Annexure J.pdf");
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // Prepare values with logic
    let namePrefix = user.prefix || "";
    if (!namePrefix) {
      if (user.gender === "male") namePrefix = "MR";
      else if (user.maritalStatus === "married") namePrefix = "MRS";
      else namePrefix = "MS";
    }

    // Referral or Supervisor Details for Official Use
    let empName = "DIWAKAR KUMAR";
    let empCode = "1013";
    let empDesignation = "DP KYC HEAD";

    // if (user.referredBy && user.referredBy.name) {
    //     empName = user.referredBy.name.toUpperCase();
    //     empCode = user.referredBy.employeeId || "";
    //     empDesignation = user.referredBy.role || "REFERRAL";
    // } else {
    //     // Fallback: Find any Supervisor, preferably from the same branch
    //     let supervisorQuery = { role: 'Supervisor', status: 'Active' };
    //     if (user.branch?._id) {
    //         supervisorQuery.branch = user.branch._id;
    //     }

    //     let supervisor = await AdminUser.findOne(supervisorQuery);
    //     if (!supervisor && user.branch?._id) {
    //         // If no supervisor in branch, find any active supervisor
    //         supervisor = await AdminUser.findOne({ role: 'Supervisor', status: 'Active' });
    //     }

    //     if (supervisor) {
    //         empName = supervisor.name.toUpperCase();
    //         empCode = supervisor.employeeId || "";
    //         empDesignation = "SUPERVISOR";
    //     } else if (user.relationshipManager && user.relationshipManager.name) {
    //         empName = user.relationshipManager.name.toUpperCase();
    //         empCode = user.relationshipManager.employeeId || "";
    //         empDesignation = "RELATIONSHIP MANAGER";
    //     } else if (user.authorisedPerson && user.authorisedPerson.name) {
    //         empName = user.authorisedPerson.name.toUpperCase();
    //         empCode = user.authorisedPerson.employeeId || "";
    //         empDesignation = "AUTHORISED PERSON";
    //     }
    // }

    // Fill form fields based on annexureJFieldsConfig
    const fieldMappings = {
      // Identity Details
      applicationNo: "", // Blank as per requirement
      applicationTypeNew: true, // Assuming New
      applicationTypeUpdate: false,
      kycModeDigilocker: true,

      // PAN
      PAN: user.PAN || "",

      // Name
      prefix: namePrefix,
      firstName: user.name.firstName || "",
      middleName: user.name.middleName || "",
      lastName: user.name.lastName || "",

      // Maiden Name (Optional - keep blank)
      maidenPrefix: "",
      maidenFirstName: "",
      maidenMiddleName: "",
      maidenLastName: "",

      // Father Name
      fatherPrefix: "MR",
      fatherFirstName: user.fatherName.firstName || "",
      fatherMiddleName: user.fatherName.middleName || "",
      fatherLastName: user.fatherName.lastName || "",

      // Demographics
      genderMale: user.gender === "male",
      genderFemale: user.gender === "female",
      genderTransgender: user.gender === "transgender",

      maritalMarried: user.maritalStatus === "married",
      maritalSingle:
        user.maritalStatus === "single" || user.maritalStatus === "unmarried",

      nationalityIndian: true,
      nationalityOther: false,

      statusResident: true,
      statusNonResident: false,
      statusForeignNational: false,
      statusPIO: false,

      // Proof of Identity (Aadhaar as primary)
      // poiAadhaarTick: !!user.aadhaar_number,
      // poiAadhaarLast4: user.aadhaar_number ? user.aadhaar_number.slice(-4) : '',
      // Other POI fields explicitly blank
      poiAadhaarTick: "",
      poiPassportNo: "",
      poiVoterTick: false,
      poiVoterNo: "",
      poiDrivingTick: false,
      poiDrivingNo: "",
      poiNaregaTick: false,
      poiNaregaNo: "",
      poiNprTick: false,
      poiNprNo: "",
      poiOtherTick: false,
      poiOtherName: "",
      poiOtherNo: "",
      poiPassportExpiry: "",
      poiDrivingExpiry: "",

      // Address Block 1 (Skipped as per requirement when PAN is present)
      addr1Line1: user.address.addressLine1 || "",
      addr1Line2: user.address.addressLine2 || "",
      addr1Line3: user.address.addressLine3 || "",
      addr1District: user.address.city || "",
      addr1District2: user.address.city || "",
      addr1Pin: user.address.pincode || "",
      addr1State: user.address.state || "",
      addr1Country: "India",

      addr1TypeResidential: false,
      addr1TypeBusiness: false,
      addr1TypeRegisteredOffice: false,
      addr1TypeUnspecified: false,
      addr1TypeOther: false,

      // Address Block 2 (The one to fill)
      addressLine1: user.address.addressLine1 || "",
      addressLine2: user.address.addressLine2 || "",
      addressLine3: user.address.addressLine3 || "",
      district: user.address.city || "",
      district2: user.address.city || "",
      pincode: user.address.pincode || "",
      state: user.address.state || "",
      country: "India",

      // Address Type for Block 2
      addrTypeResidential: true,
      addrTypeBusiness: false,
      addrTypeRegisteredOffice: false,
      addrTypeUnspecified: false,
      addrTypeOther: false,

      // Proof of Address
      poaAadhaarTick: !!user.aadhaar_number,
      poaAadhaarLast4: user.aadhaar_number ? user.aadhaar_number.slice(-4) : "",
      // Other POA fields explicitly blank
      poaPassportTick: false,
      poaPassportNo: "",
      poaVoterTick: false,
      poaVoterNo: "",
      poaDrivingTick: false,
      poaDrivingNo: "",
      poaNaregaTick: false,
      poaNaregaNo: "",
      poaNprTick: false,
      poaNprNo: "",
      poaOtherTick: false,
      poaOtherName: "",
      poaOtherNo: "",
      poaPassportExpiry: "",
      poaDrivingExpiry: "",

      // Contact
      email: user.email ? user.email.toUpperCase() : "",
      mobileCode: "+91",
      mobileNumber: user.mobileNumber || "",

      // Unmapped Contact/Office fields (Not available)
      contactTelOff: "",
      contactTelRes: "",
      contactFax: "",
      officeUse1: "",

      // Official Use
      date: indiaDate,
      place: user.address.city || "",
      ipvDate: indiaDate,
      empName: empName,
      empCode: empCode,
      empDesignation: empDesignation,
      amcName: "LAKSHMISHREE INVESTMENT AND SECURITIES LTD",

      ovdTick: true,
      ovdTick2: false,
    };

    for (const [key, value] of Object.entries(fieldMappings)) {
      const fieldName = annexureJFieldsConfig[key];
      if (!fieldName) continue;

      try {
        // Handle complex objects (like photo/signature config) which are not field names
        if (typeof fieldName === "object") continue;

        const field = form.getField(fieldName);
        if (field.constructor.name === "PDFTextField") {
          field.setText(value?.toString() || "");
        } else if (field.constructor.name === "PDFCheckBox") {
          if (value) field.check();
          else field.uncheck();
        }
      } catch (err) {
        // console.log(`Field ${fieldName} not found in PDF`);
      }
    }

    // Draw photo and signature
    const pages = pdfDoc.getPages();

    // Add Photo
    if (user.ipv_details?.capturedImage) {
      const photoPath = user.ipv_details.capturedImage;
      try {
        const photoBytes = await getFileBufferFromMinio(photoPath);
        if (!photoBytes) throw new Error("Photo not found");
        const photoImg = await pdfDoc
          .embedJpg(photoBytes)
          .catch(() => pdfDoc.embedPng(photoBytes));
        const { page: pNum, x, y, width, height } = annexureJFieldsConfig.photo;
        pages[pNum - 1].drawImage(photoImg, { x, y, width, height });
      } catch (err) {
        console.error("Error drawing photo:", err);
      }
    }

    // Add Signature below photo
    if (user.signature?.signature_image) {
      const sigPath = user.signature.signature_image;
      try {
        const sigBytes = await getFileBufferFromMinio(sigPath);
        if (!sigBytes) throw new Error("Signature not found");
        const sigImg = await pdfDoc
          .embedPng(sigBytes)
          .catch(() => pdfDoc.embedJpg(sigBytes));
        const {
          page: pNum,
          x,
          y,
          width,
          height,
        } = annexureJFieldsConfig.photoSignature;
        pages[pNum - 1].drawImage(sigImg, { x, y, width, height });

        // Add Signature on Second Page (if configured)
        if (annexureJFieldsConfig.secondPageSignature) {
          const {
            page: p2Num,
            x: p2x,
            y: p2y,
            width: p2w,
            height: p2h,
          } = annexureJFieldsConfig.secondPageSignature;
          if (pages[p2Num - 1]) {
            pages[p2Num - 1].drawImage(sigImg, {
              x: p2x,
              y: p2y,
              width: p2w,
              height: p2h,
            });
          }
        }
      } catch (err) {
        console.error("Error drawing signature:", err);
      }
    }

    const additionalPDFs = [];

    if (user.PAN_file) {
      const panFilePath = user.PAN_file;
      try {
        const ext = (path.extname(panFilePath) || "").toLowerCase();
        if (ext === ".pdf") {
          additionalPDFs.push({ type: "path", path: panFilePath });
        } else {
          const panPdfBytes = await createA4PdfFromImage(
            panFilePath,
            "PAN Proof",
          );
          additionalPDFs.push({ type: "bytes", bytes: panPdfBytes });
        }
      } catch (error) {
        console.log("PAN file not found:", error);
      }
    }

    if (user.aadhaar_file) {
      const aadhaarPath = user.aadhaar_file;
      try {
        additionalPDFs.push({ type: "path", path: aadhaarPath });
      } catch (error) {
        console.log("Aadhaar file not found:", error);
      }
    } else if (user.addressProof?.mergedPdf) {
      const addressProofPath = user.addressProof.mergedPdf;
      try {
        additionalPDFs.push({ type: "path", path: addressProofPath });
      } catch (error) {
        console.log("Address proof file not found:", error);
      }
    } else if (user.addressProof?.frontImage) {
      const addressFrontPath = user.addressProof.frontImage;
      let addressBackPath = user.addressProof?.backImage
        ? user.addressProof.backImage
        : null;
      try {
        const addressPdfBytes = await createA4PdfSideBySideImages({
          leftImagePath: addressFrontPath,
          rightImagePath: addressBackPath,
          headerText: "Address Proof",
        });
        additionalPDFs.push({ type: "bytes", bytes: addressPdfBytes });
      } catch (error) {
        console.log("Address proof file not found:", error);
      }
    }

    if (user.signature?.signature_pdf) {
      const signaturePath = user.signature.signature_pdf;
      try {
        additionalPDFs.push({ type: "path", path: signaturePath });
      } catch (error) {
        console.log("Signature file not found:", error);
      }
    }

    if (user.exchange?.financialProofs) {
      for (const proof of user.exchange.financialProofs) {
        if (proof.filePath) {
          const proofPath = proof.filePath;
          try {
            additionalPDFs.push({ type: "path", path: proofPath });
          } catch (error) {
            console.log("Financial proof file not found:", error);
          }
        }
      }
    }

    // Flatten form fields so the resulting PDF is non-editable while preserving selectable text, layout, and images
    await flattenPdfDocument(pdfDoc);

    // Save filled and flattened PDF
    const filledPdfBytes = await pdfDoc.save();
    let finalPageCount = pdfDoc.getPageCount();

    // Merge if additional PDFs exist
    let finalPdfBytes = filledPdfBytes;
    if (additionalPDFs.length > 0) {
      const mergedDoc = await PDFDocument.create();
      const mainDoc = await PDFDocument.load(filledPdfBytes);
      const mainPages = await mergedDoc.copyPages(
        mainDoc,
        mainDoc.getPageIndices(),
      );
      mainPages.forEach((p) => mergedDoc.addPage(p));

      for (const item of additionalPDFs) {
        try {
          const pBytes =
            item.type === "bytes"
              ? item.bytes
              : await getFileBufferFromMinio(item.path);
          const pDoc = await PDFDocument.load(pBytes);
          const pPages = await mergedDoc.copyPages(pDoc, pDoc.getPageIndices());
          pPages.forEach((p) => mergedDoc.addPage(p));
        } catch (e) {
          console.error("Error merging:", item.path || "in-memory", e);
        }
      }
      finalPdfBytes = await mergedDoc.save();
      finalPageCount = mergedDoc.getPageCount();
    }

    // Check for existing unsigned Annexure J PDF and delete it from MinIO and local disk
    if (user.annexureJContract?.unSignedPdf) {
      const oldAnnexurePdf = user.annexureJContract.unSignedPdf;
      try {
        await deleteFromMinio(oldAnnexurePdf);
        console.log(
          "Deleted existing Annexure J unsigned PDF from MinIO:",
          oldAnnexurePdf,
        );
      } catch (error) {
        console.log(
          "Error deleting Annexure J unsigned PDF from MinIO:",
          error.message,
        );
      }
      try {
        const existingPdfPath = resolveFilePath(oldAnnexurePdf);
        await fs.access(existingPdfPath);
        await fs.unlink(existingPdfPath);
      } catch (error) {}
    }

    // Save output file to MinIO
    const timestamp = Date.now();
    const fileName = `AnnexureJ_${user.PAN}_${timestamp}.pdf`;
    const relativePath = `/uploads/${fileName}`;

    await uploadToMinio(
      relativePath,
      Buffer.from(finalPdfBytes),
      "application/pdf",
    );

    // Update user
    await User.findOneAndUpdate(
      { mobileNumber: decoded.mobileNumber },
      {
        $set: {
          "annexureJContract.generatedPdf": true,
          "annexureJContract.unSignedPdf": relativePath,
          "annexureJContract.pdfPageCount": finalPageCount,
        },
      },
    );

    res.json({
      success: true,
      message: "Annexure J PDF created successfully",
      filePath: relativePath,
    });
  } catch (error) {
    console.error("Error creating Annexure J:", error);
    res.status(500).json({
      success: false,
      message: "Error creating Annexure J",
      error: error.message,
    });
  }
};
