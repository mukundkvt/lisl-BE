import axios from "axios";
import User from "../models/User.js";
import { encryptPayload, decryptPayload } from "../utils/camsEncryption.js";
import { fileToBase64 } from "../utils/fileToBase64.js";
import CamsConfig from "../models/CamsConfig.js";
import { getKraStateCode, getKraCountryCode } from "../utils/kraMapping.js";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";
import { createPoaPdfA4 } from "./pushCKYC.js";
import { getFileBufferFromMinio } from "../utils/minioClient.js";
// Get CAMS Token using Basic Auth
const getCamsToken = async () => {
  const camsCred = await CamsConfig.findOne().sort({ updatedAt: -1 });

  if (!camsCred) {
    throw new Error("CAMS credentials not found in DB");
  }

  const { username, password } = camsCred;

  const response = await axios.post(
    `${process.env.CAMS_KRA_API}/restAuth/api/v1/getToken`,
    {
      clientCode: process.env.CAMS_KRA_API_CLIENT_CODE,
      grantType: "client_credentials",
      scope: "KYC",
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
      },
    },
  );

  if (response.data?.returnCode !== "0") {
    throw new Error("Failed to generate CAMS token");
  }

  return response.data.accessToken;
};

// CAMS date formatter (DD-MMM-YYYY)
const formatDateToDDMMMYYYY = (isoDate) => {
  if (!isoDate) return "";

  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

// CAMS KRA Occupation Code mapping from Master_data_eipvapi.xls
const getKraOccupationCode = (occ) => {
  if (!occ) return "99";
  const o = String(occ).trim().toLowerCase();
  const mapping = {
    privatesector: "01",
    "private sector": "01",
    publicsector: "02",
    "public sector": "02",
    business: "03",
    professional: "04",
    agriculturist: "05",
    retired: "06",
    housewife: "07",
    house_wife: "07",
    student: "08",
    forexdealer: "09",
    "forex dealer": "09",
    governmentservice: "10",
    "government service": "10",
    selfemployed: "11",
    "self employed": "11",
    others: "99",
  };
  return mapping[o] || (/^\d{2}$/.test(occ) ? String(occ) : "99");
};

// CAMS KRA Income Slab mapping from Master_data_eipvapi.xls
const getKraIncomeCode = (income) => {
  if (!income) return "";
  const inc = String(income).trim().toLowerCase();
  if (inc.includes("below") || inc.includes("belowone") || inc.includes("below1")) return "01";
  if (inc.includes("onetofive") || inc.includes("1to5") || inc.includes("1-5")) return "02";
  if (inc.includes("fivetoten") || inc.includes("5to10") || inc.includes("5-10")) return "03";
  if (inc.includes("tentotwentyfive") || inc.includes("10to25") || inc.includes("10-25")) return "04";
  if (inc.includes("twentyfivetoonelakh") || inc.includes("above25") || inc.includes("morethan25") || inc.includes("25lakh")) return "05";
  return "";
};

export const pushKRA = async (req, res) => {
  let user = null;
  let payload = null;
  let encryptedPayload = null;
  try {
    const userId = req.params?.userId;
    user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // check all approvals
    // const allApproved = Object.values(user.approvals).every(
    //   (approval) => approval.status === "approved"
    // );

    // if (!allApproved || !user.digitalSignatureContract?.signedByClient) {
    //   return res.status(400).json({
    //     success: false,
    //     message:
    //       "Cannot push data to KRA. Approvals or Digital Signature missing.",
    //   });
    // }

    //GET CAMS TOKEN
    const camsToken = await getCamsToken();

    // Check all address proof possibilities: mergedPdf, aadhaar_file, frontImage, or backImage
    const hasAddressProof = Boolean(
      user.addressProof?.mergedPdf ||
      user.aadhaar_file ||
      user.addressProof?.frontImage ||
      user.addressProof?.backImage
    );

    const hasDocuments = Boolean(
      user.PAN_file &&
      hasAddressProof &&
      user.ipv_details?.capturedImage &&
      user.signature?.signature_image
    );

    const uploadType = hasDocuments ? "03" : "01";

    // Resolve docAddressProof base64 when uploadType is "03"
    let docAddressProofBase64 = "";
    if (uploadType === "03") {
      // 1. If mergedPdf is present
      if (user.addressProof?.mergedPdf) {
        docAddressProofBase64 = await fileToBase64(user.addressProof.mergedPdf);
      }
      // 2. If aadhaar_file is present (DigiLocker / eKYC)
      if (!docAddressProofBase64 && user.aadhaar_file) {
        docAddressProofBase64 = await fileToBase64(user.aadhaar_file);
      }
      // 3. If frontImage and/or backImage exist
      if (!docAddressProofBase64 && (user.addressProof?.frontImage || user.addressProof?.backImage)) {
        const frontBuf = user.addressProof?.frontImage
          ? await getFileBufferFromMinio(user.addressProof.frontImage)
          : null;
        const backBuf = user.addressProof?.backImage
          ? await getFileBufferFromMinio(user.addressProof.backImage)
          : null;

        if (frontBuf && backBuf) {
          try {
            const mergedPdfBuf = await createPoaPdfA4({ frontBuffer: frontBuf, backBuffer: backBuf });
            if (mergedPdfBuf && mergedPdfBuf.length > 0) {
              docAddressProofBase64 = mergedPdfBuf.toString("base64");
            }
          } catch (mergeErr) {
            console.warn("[pushKRA] Failed to merge front & back address proof into PDF:", mergeErr.message);
          }
        }

        // Fallback to single image if merge failed or only one image exists
        if (!docAddressProofBase64 && frontBuf) {
          docAddressProofBase64 = frontBuf.toString("base64");
        } else if (!docAddressProofBase64 && backBuf) {
          docAddressProofBase64 = backBuf.toString("base64");
        }
      }
    }

    // Resolve docEsignForm base64 when uploadType is "03"
    // Priority:
    // 1. Annexure J e-signed PDF (user.annexureJContract?.signedPdf)
    // 2. Fallback to digitalSignatureContract signed PDF (user.digitalSignatureContract?.signedPdf)
    // Constraint: If signed PDF > 5MB, do not pass it.
    const MAX_DOC_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit
    let docEsignFormBase64 = "";

    if (uploadType === "03") {
      // Priority 1: Annexure J e-signed PDF
      if (user.annexureJContract?.signedPdf) {
        try {
          const annexureJBuf = await getFileBufferFromMinio(user.annexureJContract.signedPdf);
          if (annexureJBuf && annexureJBuf.length > 0) {
            if (annexureJBuf.length <= MAX_DOC_SIZE_BYTES) {
              docEsignFormBase64 = annexureJBuf.toString("base64");
            } else {
              console.warn(
                `[pushKRA] Annexure J signedPdf exceeds 5MB (${(annexureJBuf.length / (1024 * 1024)).toFixed(2)}MB). Skipping.`
              );
            }
          }
        } catch (err) {
          console.warn("[pushKRA] Error loading Annexure J signedPdf:", err.message);
        }
      }

      // Priority 2: digitalSignatureContract.signedPdf (if Annexure J is not present, and size <= 5MB)
      if (!docEsignFormBase64 && user.digitalSignatureContract?.signedPdf) {
        try {
          const signBuf = await getFileBufferFromMinio(user.digitalSignatureContract.signedPdf);
          if (signBuf && signBuf.length > 0) {
            if (signBuf.length <= MAX_DOC_SIZE_BYTES) {
              docEsignFormBase64 = signBuf.toString("base64");
            } else {
              console.warn(
                `[pushKRA] digitalSignatureContract.signedPdf exceeds 5MB (${(signBuf.length / (1024 * 1024)).toFixed(2)}MB). Omitting docEsignForm.`
              );
            }
          }
        } catch (err) {
          console.warn("[pushKRA] Error loading digitalSignatureContract signedPdf:", err.message);
        }
      }
    }

    // Resolve aadhaarXml base64 if present
    let aadharXmlBase64 = "";
    if (user.aadhaar_xml) {
      try {
        aadharXmlBase64 = (await fileToBase64(user.aadhaar_xml)) || "";
      } catch (err) {
        console.warn("[pushKRA] Error loading aadhaar_xml:", err.message);
      }
    }

    // Determine kycType and kycMode according to CAMS specification
    // For eKYC-OTP = 1, eKYC-BIO = 2, eKYC-IRIS = 2, eKYC-OVD = 3, eKYC-Aadhaar_XML = 4, DIGILOCKER = 5
    // Note 6: If addressProof is 31 (Aadhaar), kycType CANNOT be 3 (must be 1, 2, 4, 5).
    let kycType = "3";
    let kycMode = "";
    const isDigilocker = String(user.kycType || "").toLowerCase().includes("digi");
    const isAadhaarProof =
      user.addressProof?.type === "aadhaar" ||
      Boolean(user.aadhaar_file) ||
      Boolean(user.aadhaar_number);

    if (isDigilocker || (isAadhaarProof && !user.aadhaar_xml)) {
      kycType = "5";
      kycMode = "DIGILOCKER";
    } else if (user.aadhaar_xml) {
      kycType = "4";
      kycMode = "eKYCAadhaar_XML";
    } else {
      kycType = "3";
      kycMode = "";
    }

    payload = {
      uploadType: uploadType,
      pan: user.PAN,
      dob: formatDateToDDMMMYYYY(user.dateOfBirth),
      amc: process.env.WEB_SERVICE_AMC_CODE,
      ipvDate: formatDateToDDMMMYYYY(user.ipv_details?.verifiedAt),
      uidNo: user.aadhaar_number
        ? String(user.aadhaar_number).slice(-4)
        : user.addressProof?.number
          ? String(user.addressProof.number).slice(-4)
          : "",
      applicantTile: user.prefix || "Mr",
      applicantFirstName: user.name?.firstName || "",
      applicantMiddleName: user.name?.middleName || "",
      applicantLastName: user.name?.lastName || "",
      relationship: "F",
      fatherTitle: "Mr",
      fatherFirstName: user.fatherName?.firstName || "",
      fatherMiddleName: user.fatherName?.middleName || "",
      fatherLastName: user.fatherName?.lastName || "",

      // Mother details (optional)
      motherTitle: user.motherName?.firstName ? "Mrs" : "",
      motherFirstName: user.motherName?.firstName || "",
      motherMiddleName: user.motherName?.middleName || "",
      motherLastName: user.motherName?.lastName || "",
      maidenTitle: user.gender === "female" ? "Miss" : "",
      maidenFirstName:
        user.gender === "female" ? user.name?.firstName || "" : "",
      maidenMiddleName:
        user.gender === "female" ? user.name?.middleName || "" : "",
      maidenLastName: user.gender === "female" ? user.name?.lastName || "" : "",

      gender: user.gender === "female" ? "F" : "M",
      maritalStatus: user.maritalStatus === "married" ? "01" : "02",
      occupation: getKraOccupationCode(user.occupation),
      applicantCitizenship: "01",
      applicantOtherCitizen: "",
      applicantStatus: "R",
      idProof:
        user.addressProof?.type === "aadhaar" || user.aadhaar_file || user.aadhaar_number
          ? "02"
          : user.addressProof?.type === "passport"
            ? "03"
            : user.addressProof?.type === "driving_license"
              ? "04"
              : user.addressProof?.type === "voter_id"
                ? "05"
                : user.addressProof?.type === "nrega"
                  ? "14"
                  : "15", // Others

      idProofIdentityNo: user.addressProof?.number || user.aadhaar_number || "",
      applicantKycNo: "",
      aaplicantKycAccType: "01",
      commAddress1: (user.address?.addressLine1 || "").substring(0, 55),
      commAddress2: (user.address?.addressLine2 || "").substring(0, 55),
      commAddress3: (user.address?.addressLine3 || "").substring(0, 55),
      commpincode: user.address?.pincode || "",
      commCity: (user.address?.city || "").substring(0, 40),
      commDistrict: (user.address?.city || "").substring(0, 100),
      commState: getKraStateCode(user.address?.stateCode || user.address?.state),
      commCountry: getKraCountryCode(user.address?.countryCode || user.address?.country),
      commTellNoOffCode: "",
      commTellNoOff: "",
      commTellNoRescode: "",
      commTellNoRes: "",
      commMobileNoCode: "91",
      commMobileNo: String(user.mobileNumber || "").replace(/\D/g, "").slice(-10),
      commFaxCode: "",
      commFax: "",
      commEmailId: user.email || "",
      comAddresstype: "02",
      commAddressProof:
        user.addressProof?.type === "aadhaar" || user.aadhaar_file || user.aadhaar_number
          ? "31"
          : user.addressProof?.type === "passport"
            ? "01"
            : user.addressProof?.type === "driving_license"
              ? "02"
              : user.addressProof?.type === "voter_id"
                ? "06"
                : user.addressProof?.type === "nrega"
                  ? "32"
                  : "33",
      commIdentityNo: user.addressProof?.number || user.aadhaar_number || "",
      commAddressProofExpirydate: "",
      perAddress1: (user.address?.addressLine1 || "").substring(0, 55),
      perAddress2: (user.address?.addressLine2 || "").substring(0, 55),
      perAddress3: (user.address?.addressLine3 || "").substring(0, 55),
      perPincode: user.address?.pincode || "",
      perCity: (user.address?.city || "").substring(0, 40),
      perDistrict: (user.address?.city || "").substring(0, 100),
      perState: getKraStateCode(user.address?.stateCode || user.address?.state),
      perCountry: getKraCountryCode(user.address?.countryCode || user.address?.country),
      perAddressProof:
        user.addressProof?.type === "aadhaar" || user.aadhaar_file || user.aadhaar_number
          ? "31"
          : user.addressProof?.type === "passport"
            ? "01"
            : user.addressProof?.type === "driving_license"
              ? "02"
              : user.addressProof?.type === "voter_id"
                ? "06"
                : user.addressProof?.type === "nrega"
                  ? "32"
                  : "33",
      peridentityNo: user.addressProof?.number || user.aadhaar_number || "",
      perAddressproofExpiryDate: "",
      fatcataxJurisdiction: "N",
      fatcacountryofJurisdiction: "",
      fatcaPlaceBirth: "",
      fatcaCountryBirth: "",
      fatcaTin: "",
      fatcaAddress1: "",
      fatcaAddress2: "",
      fatcaAddress3: "",
      fatcaPincode: "",
      fatcaCity: "",
      fatcaDistrict: "",
      fatcaState: "",
      fatcacountry: "",
      fatcaRelPerson: "N",
      relPerKycNo: "",
      relPerTitle: "",
      relFirstName: "",
      relMiddleName: "",
      relLastName: "",
      relPerType: "",
      relPerAddressType: "",
      relPerAddressTypeExpiryDate: "",
      relPerIdentityNo: "",
      dobDeclaration: formatDateToDDMMMYYYY(new Date()),
      placeDeclaration: user.address?.city || "INDIA",
      ekycType: "I",
      docPan: uploadType === "03" ? (await fileToBase64(user.PAN_file)) || "" : "",
      docAddressProof: docAddressProofBase64,
      docPhoto:
        uploadType === "03"
          ? (await fileToBase64(user.ipv_details?.capturedImage)) || ""
          : "",
      docCancelledCheque: "",
      docSign:
        uploadType === "03"
          ? (await fileToBase64(user.signature?.signature_image)) || ""
          : "",
      docPerVerVideo: "",
      ipvEmployeeName: "Diwaker Kumar",
      ipvEmployeeCode: "1013",
      ipvEmployeeDesignation: "DP Manager",
      ipvEmployeeBranch: "Varanasi",
      ipvInstitutionCode: "IN0571",
      ipvInstitutionName: "Lakshmishree Investment Security Limited",
      ipvDoneBy: "DISTRIBUTOR",
      kycDate: formatDateToDDMMMYYYY(new Date()),
      kycEmployeeName: "Diwaker Kumar",
      kycEmployeeCode: "1013",
      kycEmployeeBranch: "Varanasi",
      kycEmployeeDesignation: "DP Manager",
      kycInstitutionCode: "IN0571",
      kycInstitutionName: "Lakshmishree Investment Security Limited",
      kraInfo: "eKYC-eIPV",
      panCopy: "Y",
      exmtCat: "N",
      docEsignForm: docEsignFormBase64,
      kycMode: kycMode,
      kycType: kycType,
      aadharXml: aadharXmlBase64,
      aadharPasscode: "",
      aadharDigit: user.aadhaar_number ? String(user.aadhaar_number).slice(-1) : "",
      appDocAddrProofCorrespondence: "",
      appFatcaCountryResidency1: "",
      appFatcaTaxIdentificationNo1: "",
      appFatcaTaxExemptFlag1: "",
      appFatcaTaxExemptReason1: "",
      appFatcaCountryResidency2: "",
      appFatcaTaxIdentificationNo2: "",
      appFatcaTaxExemptFlag2: "",
      appFatcaTaxExemptReason2: "",
      appFatcaCountryResidency3: "",
      appFatcaTaxIdentificationNo3: "",
      appFatcaTaxExemptFlag3: "",
      appFatcaTaxExemptReason3: "",
      appFatcaCountryResidency4: "",
      appFatcaTaxIdentificationNo4: "",
      appFatcaTaxExemptFlag4: "",
      appFatcaTaxExemptReason4: "",
      appFatcaDateDeclaration: formatDateToDDMMMYYYY(new Date()),
      appIncome: getKraIncomeCode(user.annualIncome),
      appPolConn: "NA",
      appNetWrth: "",
      appNetWorthDt: "",
    };

    encryptedPayload = encryptPayload(payload);
    console.log("=== CAMS KRA ORIGINAL PAYLOAD ===");
    console.log(JSON.stringify(payload, null, 2));
    console.log("=== CAMS KRA ENCRYPTED PAYLOAD ===");
    console.log(encryptedPayload);
    try {
      const decryptedPayload = decryptPayload(encryptedPayload);
      console.log("=== CAMS KRA DECRYPTED PAYLOAD ===");
      console.log(JSON.stringify(decryptedPayload, null, 2));
    } catch (e) {
      console.error("Failed to decrypt payload locally", e);
    }
    console.log("=== CAMS KRA UPLOAD REQUEST SENT ===");
    const response = await axios.post(
      `${process.env.CAMS_KRA_API}/CAMSWS_KRA/KRA_API/uploadPAN`,
      {
        data: encryptedPayload,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${camsToken}`,
          clientId: process.env.CAMS_KRA_API_USERNAME,
        },
      },
    );

        // Try to decrypt response if encrypted
    let decryptedData;
    if (response.data && response.data.data) {
      try {
        decryptedData = decryptPayload(response.data.data);
        console.log("=== CAMS KRA DECRYPTED RESPONSE ===");
        console.log(JSON.stringify(decryptedData, null, 2));
      } catch (e) {
        console.error("Failed to decrypt response", e);
        decryptedData = response.data;
      }
    } else {
      decryptedData = response.data;
    }

    const status = decryptedData?.returnCode === "0" ? "success" : "failed";

    const logEntry = {
      timestamp: getISTDate(new Date()),
      action: "cams_kra_push",
      payload: payload,
      response: decryptedData,
    };

    if (!user.pushTo) user.pushTo = {};
    if (!user.pushTo.camsKraUpload) {
      user.pushTo.camsKraUpload = { logs: [], status: "pending" };
    }

    user.pushTo.camsKraUpload.status = status;
    user.pushTo.camsKraUpload.message = decryptedData?.returnMessage || (status === "success" ? "Inserted successfully" : "CAMS API rejected request");
    user.pushTo.camsKraUpload.logs.push(logEntry);

    await user.save();

        return res.status(status === "success" ? 200 : 400).json({
      success: status === "success",
      message:
        status === "success"
          ? "Data pushed successfully to SharePro/CAMS"
          : "CAMS API rejected request",
      data: decryptedData,
    });
  } catch (error) {
    console.error("pushKRA error:", error.message);

    let decryptedErrorData = null;
    if (error.response?.data?.data) {
      try {
        decryptedErrorData = decryptPayload(error.response.data.data);
        console.log("=== CAMS KRA DECRYPTED ERROR RESPONSE ===");
        console.log(JSON.stringify(decryptedErrorData, null, 2));
      } catch (decErr) {
        console.warn("Failed to decrypt error response:", decErr.message);
        decryptedErrorData = error.response.data;
      }
    } else if (error.response?.data) {
      decryptedErrorData = error.response.data;
    }

    const errorMessage =
      decryptedErrorData?.returnMessage ||
      decryptedErrorData?.message ||
      error.message ||
      "Something went wrong";

    let userForLog = user;
    if (!userForLog && req.params?.userId) {
      userForLog = await User.findById(req.params.userId);
    }
    if (userForLog) {
      const errorLog = {
        timestamp: getISTDate(new Date()),
        action: "cams_kra_push_error",
        payload: payload || {
          message: "Payload not generated",
        },
        response: decryptedErrorData || {
          success: false,
          message: error.message,
          stack: error.stack,
        },
      };

      if (!userForLog.pushTo) userForLog.pushTo = {};
      if (!userForLog.pushTo.camsKraUpload) {
        userForLog.pushTo.camsKraUpload = { logs: [], status: "pending" };
      }

      userForLog.pushTo.camsKraUpload.status = "failed";
      userForLog.pushTo.camsKraUpload.message = errorMessage;
      userForLog.pushTo.camsKraUpload.logs.push(errorLog);

      await userForLog.save();
    }
    return res.status(error.response?.status || 500).json({
      success: false,
      message: errorMessage,
      data: decryptedErrorData || null,
    });
  }
};
