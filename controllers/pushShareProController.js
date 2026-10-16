import axios from "axios";
import User from "../models/User.js";
import Scheme from "../models/Scheme.js";

const ANNUAL_INCOME_MAP = {
  below1L: "Below Rs. 100000",
  oneToFiveLakhs: "Rs. 100000 - 500000",
  fiveToTenLakhs: "Rs. 500000 - 1000000",
  tenToTwentyFiveLakhs: "Rs. 1000000 - 2500000",
  above25Lakhs: "Above Rs. 2500000",
};

const OCCUPATION_MAP = {
  salaried: "Employed",
  business: "Business",
  professional: "Professional",
  student: "Student",
  housewife: "House Wife",
};

let payload;

const pushClientMasterLog = async ({ userId, status, payload, response }) => {
  const updateData = {
    $set: {
      "pushTo.pushToClientMaster.status": status,
    },
    $push: {
      "pushTo.pushToClientMaster.logs": {
        timestamp: new Date(),
        payload,
        response,
      },
    },
  };

  if (status === "success") {
    updateData.$set["pushTo.ekycToCkyc.status"] = "success";
    updateData.$set["pushTo.photoUploadForCkyc.status"] = "success";
    updateData.$set["pushTo.poaUploadForCkyc.status"] = "success";
    updateData.$set["pushTo.signatureUploadForCkyc.status"] = "success";
    updateData.$set["pushTo.updateCkycStatus.status"] = "success";
  }

  await User.findByIdAndUpdate(userId, updateData, { new: true });
};

export const pushToSharePro = async (req, res) => {
  let payload = null;
  try {
    const userId = req.params?.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Resolve user's applied scheme for SharePro brokerage details
    let scheme = null;
    if (user.appliedScheme?._id) {
      await user.populate("appliedScheme._id");
      if (user.appliedScheme?._id && typeof user.appliedScheme._id === "object") {
        scheme = user.appliedScheme._id;
      }
    }
    if (!scheme) {
      scheme =
        (await Scheme.findOne({ isDefault: true })) ||
        (await Scheme.findOne({ isActive: true }));
    }

    if (user.pushTo?.pushToClientMaster?.status === "success") {
      return res.status(400).json({
        success: false,
        message: "Client data has already been successfully pushed to SharePro",
      });
    }

    // const allApproved = Object.values(user.approvals).every(
    //   (approval) => approval.status === "approved"
    // );

    // if (!allApproved || !user.digitalSignatureContract?.signedByClient) {
    //   return res.status(400).json({
    //     success: false,
    //     message:
    //       "Cannot push data to SharePro. Approvals or Digital Signature missing.",
    //   });
    // }

    let proofType = "PAN Card";

    if (user.addressProof?.type === "aadhaar") {
      proofType = "ADHAAR";
    } else if (user.addressProof?.type === "passport") {
      proofType = "Passport";
    } else if (user.addressProof?.type === "driving_license") {
      proofType = "Driving License";
    } else if (user.addressProof?.type === "voter_id") {
      proofType = "Voter ID";
    }

    // Nominee1
    const nominee1 = user?.nominees?.[0] || null;
    const hasNominee1 = !!nominee1;

    const nominee1IsMinor = hasNominee1 && !!nominee1?.guardian?.name;

    // Nominee2
    const nominee2 = user?.nominees?.[1] || null;
    const hasNominee2 = !!nominee2;

    const nominee2IsMinor = hasNominee2 && !!nominee2?.guardian?.name;

    // Nominee3
    const nominee3 = user?.nominees?.[2] || null;
    const hasNominee3 = !!nominee3;

    const nominee3IsMinor = hasNominee3 && !!nominee3?.guardian?.name;

    payload = {
      key: process.env.SHARE_PRO_API_KEY,
      cUcc: user.clientCode || "",
      cClientName: user.name?.fullName,
      dBirth_Date: user.dateOfBirth.toISOString().split("T")[0],
      cGender: user.gender?.slice(0, 1).toUpperCase(),
      cMaritalStatus: user.maritalStatus === "married" ? "01" : "02",
      cFatherNm: user.fatherName?.fullName || "",
      cMotherNm: user.motherName?.fullName || "",
      cPan_No: user.PAN || "",
      cAadhaar: user.aadhaar_number || "",
      cNationality: "01", // Indian
      cResIndStatus: "R", // Resident Individual
      cOccupation: OCCUPATION_MAP[user.occupation] || "Others",
      cAnnualIncome: ANNUAL_INCOME_MAP[user.annualIncome] || "Below Rs. 100000",
      ClRiskProfile: "Low Risk",
      cBranchID: "HO",
      // cIfsc: user.bank_account_details.ifsc_code,
      cPassport: "",
      dPPDate: "",
      dPPExpDate: "",
      cVoterId: "",
      cRationId: "",
      cDriveLicense: "",
      dDLDate: "",
      dDLExpDate: "",
      cPhotoIdPrf: proofType,
      cAddPrf: proofType,
      cAdd1: user.address?.addressLine1 || "",
      cAdd2: user.address?.addressLine2 || "",
      cAdd3: user.address?.addressLine3 || "",
      cCity: user.address?.city || "",
      cPin: user.address?.pincode || "",
      cStateCd: user.address?.stateCode || "",
      cCountry: "India",
      cPhone: "",
      cFax: "",
      cResAdd1: user.address?.addressLine1 || "",
      cResAdd2: user.address?.addressLine2 || "",
      cResAdd3: user.address?.addressLine3 || "",
      cResCity: user.address?.city || "",
      cResPin: user.address?.pincode || "",
      cResStateCd: user.address?.stateCode || "",
      cResCountry: "India",
      cResPhone: "",
      cResFax: "",
      cEmail: user.email || "",
      cMobile: String(user.mobileNumber),
      FmlyEmailFlag: "0",
      EmailStat: "Self",
      FmlyMobileFlag: "0",
      MobileStat: "Self",

      // KRA DETAILS
      cKraApplDt: "",
      cKraOccupation: "99", // Others
      cKraOccupationDtlOth: user.occupation || "Others",
      cKraAnnualInc: "01",
      cKraAnnualIncDt: "",
      cKraPEP: "NA",
      cKraCorrAddPrf: "01",
      cKraCorrAddPrfId: "",
      cKraCorrAddPrfDt: "",
      cKraPermAddPrf: "01",
      cKraPermAddPrfId: "",
      cKraPermAddPrfDt: "",
      cKraPermCorrSame: "Y",
      cKraCorrAddState: "01",
      cKraPermAddState: "01",
      cKraCorrAddCntry: "01",
      cKraPermAddCntry: "01",
      // cKraIdProof: user.PAN ? "C" : "E", // C=PAN, E=Aadhaar
      cKraIdProof: "01",
      cKraStateCity: "17102",
      cKraIpvDt: "",
      cKraIpvDesig: "",
      cKraIpvName: "",
      cKraIpvOrg: "",
      cKraIdProofOth: "",
      KRACompStatus: "",

      // INTRODUCER DETAILS
      cIntroClId: user.referredBy?.employeeId || "",
      cIntroName: user.referredBy?.name || "",
      cIntroCtgry: user.referredBy ? "01" : "",
      cIntroCatDscr: "",
      cIntroAdd1: "",
      cIntroAdd2: "",
      cIntroAdd3: "",
      cIntroCity: "",
      cIntroPin: "",
      cIntroCntry: "India",
      cIntroPhone: user.referredBy?.mobile || "",
      cIntroFather: "",
      cIntroRel: "",
      // ID proof optional → avoid wrong data
      cIntroIdPrf: "",
      cIntroId: "",
      cIntroIdExp: "",

      // CONTACT PERSON
      // cContactPerson: user.name?.fullName || "SELF",
      // cCpDesignation: "Client",
      // cCpAddress:
      //   [
      //     user.address?.addressLine1,
      //     user.address?.addressLine2,
      //     user.address?.addressLine3,
      //   ]
      //     .filter(Boolean)
      //     .join(", ") || "",

      // cCpPhone: String(user.mobileNumber),
      // cCpCity: user.address?.city || "",
      // cCpPin: user.address?.pincode || "",
      // cCpState: "01",
      // cCpCountry: "01",

      // PRIMARY BANK DETAILS
      cIfsc: user.bank_account_details?.ifsc_code || "",
      cMicr: user.bank_account_details?.micr_code || "",
      cAcType: "Savings",
      cAcNo: user.bank_account_details?.account_number || "",
      cBankClientName:
        user.bank_account_details?.account_holder_name ||
        user.name?.fullName ||
        "",

      // SECONDARY BANK DETAILS
      cSecIfsc: "",
      cSecMicr: "",
      cSecAcType: "",
      cSecAcNo: "",
      cSecBankClientName: "",

      // PAYMENT PREFERENCE
      // 1 : Any, 2 : RTGS, 3 : NEFT, 4 : Cheque
      PayMode: "1",

      // AUTO FUND PAY-IN
      // 0 : No, 1 : Yes
      cAutoFundPo: "1",

      // CLIENT & TRADING CONFIG
      cClientType: "01",
      cDealMod: "T",
      cRegFrmRecvd: "1",
      cIpvFlag: user.digitalSignatureContract?.signedByClient ? "1" : "0",

      // SEGMENTS TO REGISTER IN
      cREG_NSE: user.exchange?.segments?.Cash ? "1" : "0",
      cREG_NFO: user.exchange?.segments?.FO ? "1" : "0",
      cREG_BSE: user.exchange?.segments?.Cash ? "1" : "0",
      cREG_BFO: "0",
      cREG_CSE: "0",
      cREG_DSE: "0",
      cREG_NCDEX: "0",
      cREG_MCX: user.exchange?.segments?.Commodities ? "1" : "0",
      cREG_MF: "0",
      cREG_NBFC: "0",
      cREG_DGCX: "0",
      cREG_NMCEIL: "0",
      cREG_CNFO: "0",
      cREG_CMFO: "0",
      cREG_CBFO: "0",
      cREG_PMS: "0",
      cREG_ICFO: "0",
      cREG_NMFS: "0",
      cREG_NSFO: "0",
      cREG_KCFO: "0",
      cREG_USFO: "0",
      cREG_CSENSE: "0",
      cREG_CSENFO: "0",
      cREG_MXEQ: "0",
      cREG_MXFO: "0",
      cREG_UCX: "0",
      cREG_NSEDS: "0",
      cREG_BMFS: user.exchange?.segments?.MF ? "1" : "0",
      cREG_NSLB: "0",
      cREG_NSPT: "0",
      IBTActive: "",
      FATCAReceivedDate: "",
      cHoldDlvry: "1",
      cDpId: user.dpId ? user.dpId.substring(0, 8) : "",
      cBenAcNum: user.dpId && user.dpId.length >= 16 ? user.dpId.substring(8, 16) : "",

      NomOptOutDt: "",
      // NOMINEE 1
      Nominee1_EffectDate: hasNominee1
        ? new Date().toISOString().split("T")[0]
        : "",
      Nominee1_Prefix: "",
      Nominee1_Descr: hasNominee1 ? nominee1.name || "" : "",
      Nominee1_Percent: hasNominee1 ? nominee1.sharePercentage || "100.00" : "",
      Nominee1_Relation: hasNominee1 ? nominee1.relation || "" : "",
      Nominee1_Add1: hasNominee1 ? user.address?.addressLine1 || "" : "",
      Nominee1_Add2: hasNominee1 ? user.address?.addressLine2 || "" : "",
      Nominee1_Add3: hasNominee1 ? user.address?.addressLine3 || "" : "",
      Nominee1_City: hasNominee1 ? user.address?.city || "" : "",
      Nominee1_Pincode: hasNominee1 ? user.address?.pincode || "" : "",
      Nominee1_State: hasNominee1 ? user.address?.stateCode || "" : "",
      Nominee1_Country: hasNominee1 ? "IN" : "",
      Nominee1_Mobile: hasNominee1 ? user.mobileNumber?.toString() || "" : "",
      Nominee1_Phone: "",
      Nominee1_Email: hasNominee1 ? user.email || "" : "",
      Nominee1_IdType: hasNominee1 ? (user.PAN ? "C" : "E") : "",
      Nominee1_IdNumber: hasNominee1
        ? user.PAN || user.aadhaar_number || ""
        : "",
      Nominee1_IsMinor: nominee1IsMinor ? "1" : "0",
      Nominee1_MinorDOB: nominee1IsMinor
        ? `${nominee1.dob.year}-${nominee1.dob.month}-${nominee1.dob.day}`
        : "",
      Nominee1_GdDescr: nominee1?.guardian?.name || "",
      Nominee1_GdRelation: nominee1?.guardian?.relation || "",
      Nominee1_GdAdd1: "",
      Nominee1_GdAdd2: "",
      Nominee1_GdAdd3: "",
      Nominee1_GdCity: "",
      Nominee1_GdPincode: "",
      Nominee1_GdState: "",
      Nominee1_GdCountry: "",
      Nominee1_GdMobile: "",
      Nominee1_GdPhone: "",
      Nominee1_GdEmail: "",
      Nominee1_GdIdType: "",
      Nominee1_GdIdNumber: "",

      // NOMINEE 2
      Nominee2_EffectDate: hasNominee2
        ? new Date().toISOString().split("T")[0]
        : "",
      Nominee2_Prefix: "",
      Nominee2_Descr: hasNominee2 ? nominee2.name || "" : "",
      Nominee2_Percent: hasNominee2 ? nominee2.sharePercentage || "" : "",
      Nominee2_Relation: hasNominee2 ? nominee2.relation || "" : "",
      Nominee2_Add1: hasNominee2 ? user.address?.addressLine1 || "" : "",
      Nominee2_Add2: hasNominee2 ? user.address?.addressLine2 || "" : "",
      Nominee2_Add3: hasNominee2 ? user.address?.addressLine3 || "" : "",
      Nominee2_City: hasNominee2 ? user.address?.city || "" : "",
      Nominee2_Pincode: hasNominee2 ? user.address?.pincode || "" : "",
      Nominee2_State: hasNominee2 ? user.address?.stateCode || "" : "",
      Nominee2_Country: hasNominee2 ? "IN" : "",
      Nominee2_Mobile: hasNominee2 ? user.mobileNumber?.toString() || "" : "",
      Nominee2_Phone: "",
      Nominee2_Email: hasNominee2 ? user.email || "" : "",
      Nominee2_IdType: hasNominee2 ? (user.PAN ? "C" : "E") : "",
      Nominee2_IdNumber: hasNominee2
        ? user.PAN || user.aadhaar_number || ""
        : "",
      Nominee2_IsMinor: nominee2IsMinor ? "1" : "0",
      Nominee2_MinorDOB: nominee2IsMinor
        ? `${nominee2.dob.year}-${nominee2.dob.month}-${nominee2.dob.day}`
        : "",
      Nominee2_GdPrefix: "",
      Nominee2_GdDescr: nominee2?.guardian?.name || "",
      Nominee2_GdRelation: nominee2?.guardian?.relation || "",
      Nominee2_GdAdd1: "",
      Nominee2_GdAdd2: "",
      Nominee2_GdAdd3: "",
      Nominee2_GdCity: "",
      Nominee2_GdPincode: "",
      Nominee2_GdState: "",
      Nominee2_GdCountry: "",
      Nominee2_GdMobile: "",
      Nominee2_GdPhone: "",
      Nominee2_GdEmail: "",
      Nominee2_GdIdType: "",
      Nominee2_GdIdNumber: "",

      // NOMINEE 3
      Nominee3_EffectDate: hasNominee3
        ? new Date().toISOString().split("T")[0]
        : "",
      Nominee3_Prefix: "",
      Nominee3_Descr: hasNominee3 ? nominee3?.name || "" : "",
      Nominee3_Percent: hasNominee3 ? nominee3?.sharePercentage || "" : "",
      Nominee3_Relation: hasNominee3 ? nominee3?.relation || "" : "",
      Nominee3_Add1: hasNominee3 ? user.address?.addressLine1 || "" : "",
      Nominee3_Add2: hasNominee3 ? user.address?.addressLine2 || "" : "",
      Nominee3_Add3: hasNominee3 ? user.address?.addressLine3 || "" : "",
      Nominee3_City: hasNominee3 ? user.address?.city || "" : "",
      Nominee3_Pincode: hasNominee3 ? user.address?.pincode || "" : "",
      Nominee3_State: hasNominee3 ? user.address?.stateCode || "" : "",
      Nominee3_Country: hasNominee3 ? "IN" : "",
      Nominee3_Mobile: hasNominee3 ? user.mobileNumber?.toString() || "" : "",
      Nominee3_Phone: "",
      Nominee3_Email: hasNominee3 ? user.email || "" : "",
      Nominee3_IdType: hasNominee3 ? (user.PAN ? "C" : "E") : "",
      Nominee3_IdNumber: hasNominee3
        ? user.PAN || user.aadhaar_number || ""
        : "",
      Nominee3_IsMinor: nominee3IsMinor ? "1" : "0",
      Nominee3_MinorDOB: nominee3IsMinor
        ? `${nominee3?.dob.year}-${nominee3?.dob.month}-${nominee3?.dob.day}`
        : "",
      Nominee3_GdPrefix: "",
      Nominee3_GdDescr: nominee3?.guardian?.name || "",
      Nominee3_GdRelation: nominee3?.guardian?.relation || "",
      Nominee3_GdAdd1: "",
      Nominee3_GdAdd2: "",
      Nominee3_GdAdd3: "",
      Nominee3_GdCity: "",
      Nominee3_GdPincode: "",
      Nominee3_GdState: "",
      Nominee3_GdCountry: "",
      Nominee3_GdMobile: "",
      Nominee3_GdPhone: "",
      Nominee3_GdEmail: "",
      Nominee3_GdIdType: "",
      Nominee3_GdIdNumber: "",
      // GUARDIAN
      cGuardianNm: "",
      cGuardianPan: "",

      // BROKERAGE
      cBrkgBasketNSE: scheme?.cBrkgBasketNSE || "",
      cBrkgBasketBSE: scheme?.cBrkgBasketBSE || "",
      cBrkgBasketFO: scheme?.cBrkgBasketFO || "",
      cBrkgBasketCDS: scheme?.cBrkgBasketCDS || "",
      cBrkgBasketCOMM: scheme?.cBrkgBasketCOMM || "",
      cBrkgBasketBSEFO: scheme?.cBrkgBasketBSEFO || "",
      cBrkgBasketBSECDS: scheme?.cBrkgBasketBSECDS || "",

      dBrkgEffectDate: scheme ? new Date().toISOString().split("T")[0] : "",
      nDelCMBrkg:
        scheme?.nDelCMBrkg !== undefined && scheme?.nDelCMBrkg !== null
          ? String(scheme.nDelCMBrkg)
          : "",
      nDelCMBrkgMin:
        scheme?.nDelCMBrkgMin !== undefined && scheme?.nDelCMBrkgMin !== null
          ? String(scheme.nDelCMBrkgMin)
          : "",
      nSqCMBrkg:
        scheme?.nSqCMBrkg !== undefined && scheme?.nSqCMBrkg !== null
          ? String(scheme.nSqCMBrkg)
          : "",
      nSqCMBrkgMin:
        scheme?.nSqCMBrkgMin !== undefined && scheme?.nSqCMBrkgMin !== null
          ? String(scheme.nSqCMBrkgMin)
          : "",
      nFutBrkg:
        scheme?.nFutBrkg !== undefined && scheme?.nFutBrkg !== null
          ? String(scheme.nFutBrkg)
          : "",
      nFutBrkgMin:
        scheme?.nFutBrkgMin !== undefined && scheme?.nFutBrkgMin !== null
          ? String(scheme.nFutBrkgMin)
          : "",
      nOptBrkg:
        scheme?.fOSegmentOptionBrokerageInRs !== undefined &&
        scheme?.fOSegmentOptionBrokerageInRs !== null
          ? String(scheme.fOSegmentOptionBrokerageInRs)
          : "",

      // RUNNING ACCOUNT
      cRunAcSegment: "Securities",

      // Securities
      dRunAcRcvdDt: "",
      dRunAcRvkdDt: "",
      nSettleType: "",
      Retainable: "",

      // Commodity
      dRunAcRcvdDtCom: "",
      dRunAcRvkdDtCom: "",
      nSettleTypeCom: "",
      RetainableCom: "",

      // OPERATIONS
      cGroupCd: "",
      dAPEffectDate: "",
      cAPCd: "",
      dRMEffectDate: "",
      cRMCd: "",
      dDealerEffectDate: "",
      cDealerCd: "",
      dSREffectDate: "",
      cSRCd: "",
      eContract: "1",

      // NETWORTH / PMLA
      cACC_DateDESCR: "",
      nGROSSINCOME: user.networth?.amount || 0,
      nNETWORTH: user.networth?.amount || 0,
      dtNETWORTHDT: "",
      BusiCommenceDt: "",
      cClientWithOthTM: "N",
      NMFS_occupation: "",
      NMFS_state: "",

      // NORMAL INTEREST
      InterestEffectDate: "",
      FlatInterest: "",
      InterestSlabCd: "",
      DntCalcInterest: "0",
      InterestRegPending: "0",
      InterestRoundOff: "",
      InterestGracePeriod: "",
      InterestSpecShareCr: "0",
      InterestShareCrPer: "",
      InterestExclSpanMarkup: "0",
      InterestExclM2MValue: "0",

      // MTF INTEREST
      MTFInterestEffectDate: "",
      MTFFlatInterest: "",
      MTFInterestSlabCd: "",
      MTFDntCalcInterest: "0",
      MTFInterestRegPending: "0",
      MTFInterestRoundOff: "",
      MTFInterestGracePeriod: "",
      MTFInterestSpecShareCr: "0",
      MTFInterestShareCrPer: "",
      MTFInterestExclSpanMarkup: "0",
      MTFInterestExclM2MValue: "0",

      // NBFC INTEREST
      NBFCInterestEffectDate: "",
      NBFCFlatInterest: "",
      NBFCInterestSlabCd: "",
      NBFCDntCalcInterest: "0",
      NBFCInterestRegPending: "0",
      NBFCInterestRoundOff: "",
      NBFCInterestGracePeriod: "",
      NBFCInterestSpecShareCr: "0",
      NBFCInterestShareCrPer: "",
      NBFCInterestExclSpanMarkup: "0",
      NBFCInterestExclM2MValue: "0",

      // ADD USER
      AddUser: "KYCDone",
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === "") {
        delete payload[key];
      }
    });

    const response = await axios.post(
      `${process.env.SHARE_PRO_API}/NewClientRegistration`,
      payload,
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    const isSuccess = response.data?.success === 1 || response.data?.success === "1";

    if (isSuccess) {
      await pushClientMasterLog({
        userId,
        status: "success",
        payload,
        response: response.data,
      });

      return res.status(200).json({
        success: true,
        message: "Data successfully pushed to SharePro",
        data: response.data,
      });
    } else {
      await pushClientMasterLog({
        userId,
        status: "failed",
        payload,
        response: response.data,
      });

      return res.status(400).json({
        success: false,
        message: "SharePro API rejected request",
        error: response.data,
      });
    }
  } catch (error) {
    console.error("Error while pushing to SharePro:", error);

    await pushClientMasterLog({
      userId: req.params?.userId,
      status: "failed",
      payload: payload || {},
      response: {
        message: error.message,
        stack: error.stack,
      },
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error while pushing to SharePro",
      error: error.message,
    });
  }
};
