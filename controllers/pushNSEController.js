import axios from "axios";
import User from "../models/User.js";
import NseConfig from "../models/NseConfig.js";
import { mapStateToNSE, mapCountryToNSE } from "../utils/nseExchangeCodes.js";

export const pushToNSE = async (req, res) => {
  let user = null;
  let payload = null;
  let nseConfig = null;
  try {
    const userId = req.params?.userId;
    user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const allApproved = Object.values(user.approvals).every(
      (approval) => approval.status === "approved",
    );

    if (!allApproved || !user.digitalSignatureContract?.signedByClient) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot push data to NSE. Approvals or Digital Signature missing.",
      });
    }

    nseConfig = await NseConfig.findOne().select("+password");

    if (
      !nseConfig ||
      !nseConfig.authUrl ||
      !nseConfig.clientUploadUrl ||
      !nseConfig.username ||
      !nseConfig.password
    ) {
      const errorLog = {
        timestamp: new Date(),
        action: "nse_client_upload_config_error",
        payload: {},
        response: {
          success: false,
          message:
            "NSE API Configuration missing (Auth URL, Client Upload URL, Username, or Password not set in DB)",
        },
      };

      if (!user.pushTo) user.pushTo = {};
      if (!user.pushTo.uploadToNSE) {
        user.pushTo.uploadToNSE = { logs: [], status: "pending", message: "" };
      }
      user.pushTo.uploadToNSE.status = "failed";
      user.pushTo.uploadToNSE.message = "NSE API Configuration missing";
      user.pushTo.uploadToNSE.logs.push(errorLog);
      await user.save();

      return res.status(400).json({
        success: false,
        message:
          "NSE API credentials missing in database configuration",
      });
    }

    //AUTHENTICATION (JWT TOKEN GENERATION)
    console.log("[NSE] Attempting auth at:", nseConfig.authUrl);
    const authResponse = await axios.post(
      `${nseConfig.authUrl}`,
      {
        username: nseConfig.username,
        password: nseConfig.password,
        apiName: nseConfig.apiName || "uci_clientupload",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "*/*",
        },
        timeout: 30000,
      },
    );
    console.log("[NSE] Auth response:", authResponse.data);

    const token = authResponse?.data?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Failed to generate NSE auth token",
        error: authResponse.data,
      });
    }

    const formatDate = (date) => {
      if (!date) return "";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const currentDate = formatDate(new Date());

    // Helper to map occupation to NSE code (1-9 or 99 with mandatory details)
    const mapOccupationToNSE = (occ) => {
      if (!occ) return { code: "2", dtls: "" }; // default private sector
      const o = String(occ).toLowerCase().replace(/[\s_-]/g, "");
      
      if (o.includes("public")) return { code: "1", dtls: "" };
      if (o.includes("private") || o === "prs") return { code: "2", dtls: "" };
      if (o.includes("gov")) return { code: "3", dtls: "" };
      if (o.includes("business") || o === "bus") return { code: "4", dtls: "" };
      if (o.includes("prof") || o === "prf" || o === "pro") return { code: "5", dtls: "" };
      if (o.includes("agri") || o === "agr") return { code: "6", dtls: "" };
      if (o.includes("retir") || o === "ret") return { code: "7", dtls: "" };
      if (o.includes("house") || o.includes("home") || o === "hsw") return { code: "8", dtls: "" };
      if (o.includes("stud") || o === "stu") return { code: "9", dtls: "" };
      return { code: "99", dtls: String(occ).substring(0, 50) || "OTHER" };
    };

    const mapAnnualIncomeToNSE = (inc) => {
      if (!inc) return "2";
      const i = String(inc).toLowerCase().replace(/[\s_-]/g, "");
      if (i.includes("below1") || i.includes("below1lakh") || i === "below1l") return "1";
      if (i.includes("1to5") || i.includes("onetofive") || i.includes("1lt5l") || i.includes("1-5")) return "2";
      if (i.includes("5to10") || i.includes("fivetoten") || i.includes("5lt10l") || i.includes("5-10")) return "3";
      if (i.includes("10to25") || i.includes("tentotwentyfive") || i.includes("10lt25l") || i.includes("10-25")) return "4";
      if (i.includes("above25") || i.includes("abovetwentyfive") || i.includes("above25l") || i.includes(">25")) return "5";
      return "2";
    };

    const { code: nseOccupation, dtls: nseOccupationDtls } = mapOccupationToNSE(user.occupation || user.occupation_type);
    const nseAnnualIncome = mapAnnualIncomeToNSE(user.annualIncome || user.income_range);

    // Map net worth and net worth date directly from user.networth schema
    // NSE field 115: ccdNetWorth must be Decimal(15,3) e.g. "10000000.000"
    let nseNetWorth = "";
    let nseNetWorthAsdate = "";

    if (user?.networth?.amount) {
      const amount = parseFloat(user.networth.amount);
      if (!isNaN(amount) && amount > 0) {
        nseNetWorth = amount.toFixed(3); // e.g. "10000000.000"
        const day   = String(user.networth.date?.day   || "31").padStart(2, "0");
        const month = String(user.networth.date?.month || "03").padStart(2, "0");
        const year  = String(user.networth.date?.year  || new Date().getFullYear());
        nseNetWorthAsdate = `${day}-${month}-${year}`;
      }
    }

    // Helper to get masked Aadhaar number for ccdUid
    const getMaskedAadhaar = (u) => {
      let raw = "";
      if (u?.aadhaar_number && u.aadhaar_number.trim()) {
        raw = u.aadhaar_number.trim();
      } else if (
        u?.addressProof?.type &&
        u.addressProof.type.toLowerCase() === "aadhaar" &&
        u?.addressProof?.number &&
        u.addressProof.number.trim()
      ) {
        raw = u.addressProof.number.trim();
      } else if (
        u?.identityType &&
        u.identityType.toLowerCase() === "aadhaar" &&
        u?.identityNumber &&
        u.identityNumber.trim()
      ) {
        raw = u.identityNumber.trim();
      }

      if (!raw) return "";
      if (/[xX*]/.test(raw)) return raw;
      if (raw.length >= 4) return "XXXXXXXX" + raw.slice(-4);
      return raw;
    };

    const maskedAadhaar = getMaskedAadhaar(user);

    // Build one request entry per selected segment (as per NSE API spec)
    const segments = user.exchange?.segments || {};
    const segmentMap = [
      { key: "Cash",        code: "C" },
      { key: "FO",          code: "F" },
      { key: "Commodities", code: "O" },
    ];
    const activeSegments = segmentMap.filter((s) => segments[s.key]);
    // Always include at least Cash if nothing is selected
    if (activeSegments.length === 0) activeSegments.push({ key: "Cash", code: "C" });

    const nseState = mapStateToNSE(user.address?.state, user.address?.stateCode);
    const nseCountry = mapCountryToNSE(user.address?.country, user.address?.countryCode);

    const buildRequestEntry = (segCode) => ({
      ccdMemCd: "12817",
      ccdAcctType: "CLIENT",
      ccdOptForUpi: segCode === "C" ? "N" : "NA",
      ccdCd: user.clientCode || "",
      ccdName: user.name?.fullName || "",
      ccdCategory: "1",
      ccdTelNo: "",
      ccdAgrDt: currentDate,
      ccdPanNo: user.PAN || "",
      ccdBankName: user.bank_account_details?.bank_name || "",
      ccdBankIfsc: user.bank_account_details?.ifsc_code || "",
      ccdBankAcctNo: user.bank_account_details?.account_number || "",
      ccdPriSecBnk: "P",
      ccdDeposName: "CDSL",
      ccdBenAcctNo: user.dpId || "",
      ccdDeposId: "",
      ccdPriSecDp: "P",
      ccdRegNo: "",
      ccdRegAuth: "",
      ccdPlcReg: "",
      ccdDtReg: "",
      ccdSegInd: segCode,
      ccdDob: formatDate(user.dateOfBirth),
      ccdAddLine1: user.address?.addressLine1 || "",
      ccdAddLine2: user.address?.addressLine2 || "",
      ccdAddLine3: user.address?.addressLine3 || "",
      ccdAddCity: user.address?.city || "",
      ccdAddState: nseState.stateCode,
      ccdAddCountry: nseCountry,
      ccdPinCode: user.address?.pincode || "",
      ccdTelIsd: "",
      ccdTelStd: "",
      ccdMobile: user.mobileNumber || "",
      ccdEmail: user.email || "",
      ccdProofType: "",
      ccdProofNo: "",
      ccdIssPlcProof: "",
      ccdIssDtProof: "",
      ccdDir1Name: "",
      ccdDir2Name: "",
      ccdDir3Name: "",
      ccdDir1Desig: "",
      ccdDir2Desig: "",
      ccdDir3Desig: "",
      ccdDir1Pan: "",
      ccdDir2Pan: "",
      ccdDir3Pan: "",
      ccdDir1Add: "",
      ccdDir2Add: "",
      ccdDir3Add: "",
      ccdDir1TelNo: "",
      ccdDir2TelNo: "",
      ccdDir3TelNo: "",
      ccdDir1Email: "",
      ccdDir2Email: "",
      ccdDir3Email: "",
      ccdIpv: "Y",
      ccdUccCd: "",
      ccdRelationship: "",
      ccdTvFlag: "",
      ccdFacilityType: "",
      ccdCin: "",
      ccdCltStatus: "A",
      ccdCltStatusReason: "",
      ccdGender: user.gender === "male" ? "M" : "F",
      ccdGuardianName: user.fatherName?.fullName || "",
      ccdMaritlStatus: (() => {
        switch (user.maritalStatus) {
          case "married": return "M";
          case "unmarried": return "S";
          default: return "S";
        }
      })(),
      ccdNationality: "1",
      ccdPermantAddFlg: "Y",
      ccdPermAddLine1: user.address?.addressLine1 || "",
      ccdPermAddLine2: user.address?.addressLine2 || "",
      ccdPermAddLine3: user.address?.addressLine3 || "",
      ccdPermAddCity: user.address?.city || "",
      ccdPermAddState: nseState.stateCode,
      ccdPermAddCountry: nseCountry,
      ccdPermPin: user.address?.pincode || "",
      ccdOffcIsd: "",
      ccdOffcStd: "",
      ccdTelOffice: "",
      ccdUid: "",
      ccdGrosAnnlRnge: nseAnnualIncome,
      ccdGrosAnnlAsdate: currentDate,
      ccdNetWorth: nseNetWorth,
      ccdNetWorthAsdate: nseNetWorthAsdate,
      ccdPep: "0",
      ccdPoi: "",
      ccdOccupation: nseOccupation,
      ccdOccupationDtls: nseOccupationDtls,
      ccdBusComDt: "",
      ccdCpCd: "",
      ccdClntTyp: "N",
      ccdDinCntrctPerson1: "",
      ccdUidCntrctPerson1: "",
      ccdDinCntrctPerson2: "",
      ccdUidCntrctPerson2: "",
      ccdDinCntrctPerson3: "",
      ccdUidCntrctPerson3: "",
      ccdDir4Name: "",
      ccdDir4Desig: "",
      ccdDir4Pan: "",
      ccdDir4Add: "",
      ccdDir4TelNo: "",
      ccdDinCntrctPerson4: "",
      ccdUidCntrctPerson4: "",
      ccdDir4Email: "",
      ccdDir5Name: "",
      ccdDir5Desig: "",
      ccdDir5Pan: "",
      ccdDir5Add: "",
      ccdDir5TelNo: "",
      ccdDinCntrctPerson5: "",
      ccdUidCntrctPerson5: "",
      ccdDir5Email: "",
      ccdNationalityOth: "",
      ccdPermAddStateOth: "",
      ccdAddStateOth: "",
      ccdPoaFunds:"N",
      ccdPoaSecurities: user?.ddpiConcent?.transfer_of_security ? "Y" : "N",
      ccdCpName: "",
      ccdCpPan: "",
      ccdCpEmail: "",
      ccdCpStd: "",
      ccdCpIsd: "",
      ccdCpTel: "",
      ccdCpMob: "",
      ccdCpAdd: "",
      ccdCpAddCity: "",
      ccdCpAddState: "",
      ccdCpAddStateOth: "",
      ccdCpAddCountry: "",
      ccdCpAddPin: "",
      ccdNomFlag: Array.isArray(user.nominees) && user.nominees.length > 0 && user.nominees.some((n) => n?.name?.trim()) ? "1" : "2",
      ccdNameDesc: ""
    });

    const payload = {
      request: activeSegments.map((seg) => buildRequestEntry(seg.code)),
    };

    const response = await axios.post(
      `${nseConfig.clientUploadUrl}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "*/*",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const isSuccess = Array.isArray(response.data?.response)
      ? response.data.response.every((r) => r.status === "SUCCESS")
      : Boolean(response.data?.success || response.data?.status === "SUCCESS");

    const status = isSuccess ? "success" : "failed";

    const logEntry = {
      timestamp: new Date(),
      action: "nse_client_upload",
      payload,
      response: response.data,
    };

    if (!user.pushTo) user.pushTo = {};
    if (!user.pushTo.uploadToNSE) {
      user.pushTo.uploadToNSE = { logs: [], status: "pending" };
    }

    user.pushTo.uploadToNSE.status = status;
    user.pushTo.uploadToNSE.logs.push(logEntry);

    await user.save();

    return res.status(status === "success" ? 200 : 400).json({
      success: status === "success",
      message:
        status === "success"
          ? "Data successfully pushed to NSE"
          : "NSE API rejected request",
      data: response.data,
    });
  } catch (error) {
    const isTimeout = error.code === "ETIMEDOUT" || error.code === "ECONNABORTED";
    const errorDetail = {
      code: error.code,
      message: error.message,
      authUrl: nseConfig?.authUrl || "N/A",
      clientUploadUrl: nseConfig?.clientUploadUrl || "N/A",
    };
    console.error("[NSE] Error while pushing to NSE:", errorDetail);

    let userForLog = user;
    if (!userForLog && req.params?.userId) {
      userForLog = await User.findById(req.params.userId);
    }

    if (userForLog) {
      const errorLog = {
        timestamp: new Date(),
        action: "nse_client_upload_error",
        payload: payload || { message: "Payload not generated" },
        response: {
          success: false,
          message: error.message,
          code: error.code,
          authUrl: nseConfig?.authUrl || "N/A",
          clientUploadUrl: nseConfig?.clientUploadUrl || "N/A",
        },
      };

      if (!userForLog.pushTo) userForLog.pushTo = {};
      if (!userForLog.pushTo.uploadToNSE) {
        userForLog.pushTo.uploadToNSE = { logs: [], status: "pending", message: "" };
      }

      userForLog.pushTo.uploadToNSE.status = "failed";
      userForLog.pushTo.uploadToNSE.message = isTimeout
        ? `Connection timed out to ${nseConfig?.authUrl || "NSE Auth URL"}`
        : error.message;
      userForLog.pushTo.uploadToNSE.logs.push(errorLog);

      await userForLog.save();
    }

    return res.status(500).json({
      success: false,
      message: isTimeout
        ? `Connection timed out — check if the Auth URL is correct: ${nseConfig?.authUrl || "N/A"}`
        : "Internal server error while pushing to NSE",
      error: error.message,
      code: error.code,
      authUrl: nseConfig?.authUrl || "N/A",
    });
  }
};
