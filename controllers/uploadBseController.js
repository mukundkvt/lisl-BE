import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import crypto from "crypto";
import axios from "axios";
import User from "../models/User.js";
import BseExchangeConfig from "../models/BseExchangeConfig.js";
import { generateMD5 } from "../utils/md5Hash.js";
import { generateChecksumRSA } from "../utils/rsaCheckSum.js";
import { generateSHA256 } from "../utils/sha256.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadBse = async (req, res) => {
  let user = null;
  let requestPayload = null;
  try {
    const userId = req.params?.userId;
    user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch BSE Exchange Config from Database
    const bseExchangeConfig = await BseExchangeConfig.findOne().sort({ createdAt: -1 });

    if (
      !bseExchangeConfig ||
      !bseExchangeConfig.memberId ||
      !bseExchangeConfig.userId ||
      !bseExchangeConfig.password ||
      !bseExchangeConfig.uploadApiUrl
    ) {
      const errorLog = {
        timestamp: new Date(),
        action: "bse_ucc_upload_config_error",
        payload: {},
        response: {
          success: false,
          message: "BSE Exchange Configuration missing (Member ID, User ID, Password, or Upload URL not configured)",
        },
      };

      if (!user.pushTo) user.pushTo = {};
      if (!user.pushTo.uploadToBSE) {
        user.pushTo.uploadToBSE = { logs: [], status: "pending", message: "" };
      }
      user.pushTo.uploadToBSE.status = "failed";
      user.pushTo.uploadToBSE.message = "BSE Exchange Configuration missing";
      user.pushTo.uploadToBSE.logs.push(errorLog);
      await user.save();

      return res.status(400).json({
        success: false,
        message: "BSE Exchange configuration missing in database",
      });
    }

    // Resolve RSA Public Key from Database or fallback to default .pem file
    let publicKey = bseExchangeConfig.publicKey?.trim();
    if (!publicKey) {
      const defaultPemPath = path.join(__dirname, "../assets/resources/BSEUCC-PUBLIC.pem");
      if (fs.existsSync(defaultPemPath)) {
        publicKey = fs.readFileSync(defaultPemPath, "utf8");
      }
    }

    if (!publicKey) {
      return res.status(400).json({
        success: false,
        message: "BSE RSA Public Key (.pem) not found",
      });
    }

    // Format date to DD/MM/YYYY
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Map annualIncome to BSE codes
    // 1 = Below Rs 1 Lac, 2 = 1-5 Lac, 3 = 5-10 Lac, 4 = 10-25 Lac, 5 = > 25 Lacs
    const incomeMapping = {
      below1lakh: "1",
      oneToFiveLakhs: "2",
      fiveToTenLakhs: "3",
      tenToTwentyFiveLakhs: "4",
      aboveTwentyFiveLakhs: "5",
    };
    const bseIncomeCode = incomeMapping[user?.annualIncome] || "2";

    // Calculate INCOMEDATE based on current date
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed: 0=Jan, 11=Dec
    const currentYear = now.getFullYear();
    let calculatedIncomeDate = "";

    if (currentMonth >= 9 || currentMonth <= 2) {
      // Oct (9) to Mar (2)
      const year = currentMonth >= 9 ? currentYear : currentYear - 1;
      calculatedIncomeDate = `30/09/${year}`;
    } else {
      // Apr (3) to Sep (8)
      calculatedIncomeDate = `31/03/${currentYear}`;
    }

    const currentDate = formatDate(now);

    // Map net worth and net worth date directly from user.networth schema
    let bseNetWorth = null;
    let bseNetWorthDate = null;
    let provideDetails = "1";

    if (user?.networth?.amount) {
      provideDetails = "3"; // 3 = BOTH INCOME & NETWORTH
      bseNetWorth = String(user.networth.amount);
      const day = String(user.networth.date?.day || "31").padStart(2, "0");
      const month = String(user.networth.date?.month || "03").padStart(2, "0");
      const year = String(user.networth.date?.year || currentYear);
      bseNetWorthDate = `${day}/${month}/${year}`;
    }

    // Build payload according to official BSE UCC REST API V5 specification
    requestPayload = {
      CLIENTDETAILS_V5: [
        {
          TRANSACTIONCODE: "N", // N = NEW, M = MODIFY
          CLIENTTYPE: "I", // I / NI / INS
          STATUS: "CL", // CL = Client
          CATEGORY: "I",
          CLIENTCODE: user?.clientCode || "",
          PANNO: user?.PAN || "",
          POLITICALEXPERSON: "N", // Exact field name from BSE Doc

          ADDRESS1: (user?.address?.addressLine1 || "").substring(0, 150),
          PERMNEQUALCORP: "Y",
          ADDRESS2: (user?.address?.addressLine2 || "").substring(0, 150),
          COUNTRY: user?.address?.country,
          STATE: user?.address?.state,
          CITY: user?.address?.city,
          PINCODE: user?.address?.pincode || "",
          // Type of Service (1=SMS,2=Email,3=Both,4=None)
          TYPEOFSERVICE: "3",
          CONTACTDETAILS: "2",
          EMAIL: user?.email || "",
          MOBILENUMBER: user?.mobileNumber ? String(user.mobileNumber) : "",
          STDCODE: null,
          PHONENO: null,
          EQ_CPCODE: null,
          EQCMID: null,
          FNOCPCODE: null,
          FNOCMID: null,

          DEPOSITORYNAME1: "CDSL", // CDSL / NSDL
          DEMANTID1: null,
          DEPOSITORYPARTICIPANT1: "LAKSHMISHREE INVESTMENT & SECURITIES PVT LTD",
          DEPOSITORYNAME2: null,
          DEMANTID2: null,
          DEPOSITORYPARTICIPANT2: null,
          DEPOSITORYNAME3: null,
          DEMANTID3: null,
          DEPOSITORYPARTICIPANT3: null,
          BANKNAME1: (user?.bank_account_details?.bank_name || "").replace(/,/g, ""),
          ACCOUNTNO1: user?.bank_account_details?.account_number || "",
          BANKNAME2: null,
          ACCOUNTNO2: null,
          BANKNAME3: null,
          ACCOUNTNO3: null,
          CLIENTAGGREMENTDATE: currentDate,
          PROVIDEDETAILS: provideDetails,
          INCOME: bseIncomeCode,
          INCOMEDATE: calculatedIncomeDate,
          NETWORTH: bseNetWorth,
          NETWORTHDATE: bseNetWorthDate,
          ISACTIVE: "Y",
          UPDATEREASON: null,
          FIRSTNAME: user?.name?.firstName || "",
          MIDDLENAME: user?.name?.middleName || "",
          LASTNAME: user?.name?.lastName || "",
          AADHARCARDNO: null,
          DATEOFBIRTH: formatDate(user?.dateOfBirth),
          CLIENTNAME: user?.name?.fullName || "",
          REGISTRATIONNO: null,
          REGISTERINGAUTHORITY: null,
          DATEOFREGISTRATION: null,
          PLACEOFREGISTRATION: null,
          WHETHERCORPORATE: "N",
          CINNO: null,
          NUMBEROFDIRECTORS: "0",
          PARTNERS_KARTAUID: null,
          PARTNERS_COPARCENERUID: null,
          CONTACTPERSONNAME1: null,
          CONTACTPERSONDESIGNATION1: null,
          CONTACTPERSONADDRESS1: null,
          CONTACTPERSONEMAIL1: null,
          CONTACTPERSONPAN1: null,
          CONTACTPERSONMOBILE1: null,
          CONTACTPERSONNAME2: null,
          CONTACTPERSONDESIGNATION2: null,
          CONTACTPERSONADDRESS2: null,
          CONTACTPERSONEMAIL2: null,
          CONTACTPERSONPAN2: null,
          CONTACTPERSONMOBILE2: null,
          SERVERIP: null,
          BATUSER: null,
          CASH: user?.exchange?.segments?.Cash ? "Y" : "N",
          EQUITY_DERIVATIVE: user?.exchange?.segments?.FO ? "Y" : "N",
          SLB: "N",
          CURRENCY: "N",
          DEBT: "N",         // BSE Debt/Bond segment — separate from MF; not offered
          // ── DDPI / PoA mapping ─────────────────────────────────────────────
          // BSE treats DDPI as PoA for securities. If client consented to
          // transfer_of_security in their DDPI, ISPOA = Y and PoA date is required.
          ISPOA:              user?.ddpiConcent?.transfer_of_security ? "Y" : "N",
          POAFORFUND:         "N",
          POAFORSECURITY:     user?.ddpiConcent?.transfer_of_security ? "Y" : "N",
          DATEOFPOAFORFUND:   null,
          DATEOFPOAFORSECURITY: user?.ddpiConcent?.transfer_of_security
                                ? formatDate(user?.digitalSignatureContract?.signedTime)
                                : null,
          PERCOUNTRY: user?.address?.country,
          PERSTATE: user?.address?.state,
          PERCITY: user?.address?.city,
          PERPINCODE: user?.address?.pincode,
          CURRENCYCPCODE: null,
          CURRENCYCMID: null,
          ENROLLMENTNUMBER: null,
          COMMDERIVATIVES: "N",
          OPTEDFORNOMINATION: Array.isArray(user?.nominees) && user.nominees.length > 0 && user.nominees.some((n) => n?.name?.trim()) ? "Y" : "N",
          CUSTPANNO: null,
          CUSTNAME: null,
          CUSTADDRESS: null,
          CUSTCOUNTRY: null,
          CUSTSTATE: null,
          CUSTCITY: null,
          CUSTPINCODE: null,
          CUSTMOBILENUMBER: null,
          CUSTSTDCODE: null,
          CUSTPHONENO: null,
          CUSTEMAIL: null,
          EGR: "N",
          BENEFICIALOWNACNTNO1: user?.dpId || user?.demat?.boid || null,
          BENEFICIALOWNACNTNO2: null,
          BENEFICIALOWNACNTNO3: null,
          OPTED_FOR_UPI: "N",
          BANKBRANCHIFSCCODE1: user?.bank_account_details?.ifsc_code || "",
          PRIMARYORSECONDARYBANK1: "P",
          BANKBRANCHIFSCCODE2: null,
          PRIMARYORSECONDARYBANK2: null,
          BANKBRANCHIFSCCODE3: null,
          PRIMARYORSECONDARYBANK3: null,
          BANKBRANCHIFSCCODE4: null,
          BANKNAME4: null,
          ACCOUNTNO4: null,
          PRIMARYORSECONDARYBANK4: null,
          BANKBRANCHIFSCCODE5: null,
          BANKNAME5: null,
          ACCOUNTNO5: null,
          PRIMARYORSECONDARYBANK5: null,
          PRIMARYORSECONDARYDP1: "P",
          PRIMARYORSECONDARYDP2: null,
          PRIMARYORSECONDARYDP3: null,
          DEPOSITORYNAME4: null,
          DEMANTID4: null,
          BENEFICIALOWNACNTNO4: null,
          PRIMARYORSECONDARYDP4: null,
          DEPOSITORYNAME5: null,
          DEMANTID5: null,
          BENEFICIALOWNACNTNO5: null,
          PRIMARYORSECONDARYDP5: null,
          CLIENTNAMEDESCRIPTION: "",
          DIRECTORDETAILS: null,
        },
      ],
    };

    // JSON must be strict single line without newlines or tabs
    const payloadString = JSON.stringify(requestPayload);

    // SHA256 Lowercase Hex String as per specification
    const sha256Hex = crypto.createHash("sha256").update(payloadString, "utf8").digest("hex");

    // md5 Password
    const md5Password = crypto.createHash("md5").update(bseExchangeConfig.password).digest("hex");

    // RSA PKCS1 + Base64
    const encryptedBuffer = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(sha256Hex, "utf8")
    );
    const checksum = encryptedBuffer.toString("base64").replace(/[\r\n]/g, "").trim();

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
      insecureHTTPParser: true,
    });

    // BSE API details
    const bseResponse = await axios.post(
      bseExchangeConfig.uploadApiUrl,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
          MemberCode: String(bseExchangeConfig.memberId).trim(),
          UserID: String(bseExchangeConfig.userId).trim(),
          Password: String(md5Password).trim(),
          Checksum: String(checksum).trim(),
        },
        httpsAgent,
        insecureHTTPParser: true,
        timeout: 30000,
      },
    );

    const isSuccess =
      bseResponse.data?.Status === "0" ||
      bseResponse.data?.Status === "1" ||
      (Array.isArray(bseResponse.data?.ResponceList) &&
        bseResponse.data.ResponceList.every((r) => r.STATUS === "S" || r.STATUS === "SUCCESS"));

    const status = isSuccess ? "success" : "failed";

    const logEntry = {
      timestamp: new Date(),
      action: "bse_ucc_upload",
      payload: requestPayload,
      response: bseResponse.data,
    };

    if (!user.pushTo) user.pushTo = {};
    if (!user.pushTo.uploadToBSE) {
      user.pushTo.uploadToBSE = { logs: [], status: "pending" };
    }

    user.pushTo.uploadToBSE.status = status;
    user.pushTo.uploadToBSE.logs.push(logEntry);

    await user.save();

    return res.status(status === "success" ? 200 : 400).json({
      success: status === "success",
      message:
        status === "success"
          ? "BSE API called successfully"
          : "BSE API rejected request",
      data: bseResponse.data,
    });
  } catch (error) {
    let userForLog = user;
    if (!userForLog && req.params?.userId) {
      userForLog = await User.findById(req.params.userId);
    }

    if (userForLog) {
      const errorLog = {
        timestamp: new Date(),
        action: "bse_ucc_upload_error",
        payload: requestPayload || {
          message: "Payload not generated",
        },
        response: {
          success: false,
          message: error.message,
          stack: error.stack,
        },
      };

      if (!userForLog.pushTo) userForLog.pushTo = {};
      if (!userForLog.pushTo.uploadToBSE) {
        userForLog.pushTo.uploadToBSE = {
          logs: [],
          status: "pending",
        };
      }

      userForLog.pushTo.uploadToBSE.status = "failed";
      userForLog.pushTo.uploadToBSE.logs.push(errorLog);

      await userForLog.save();
    }
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
