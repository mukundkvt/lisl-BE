import User from "../models/User.js";
import BseConfig from "../models/BseConfig.js";
import axios from "axios";
import formatDateToDDMMYYYY from "../utils/formatDate.js";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";

export const pushToBSE_MFI = async (req, res) => {
  let user = null;
  let payload = null;
  try {
    const userId = req.params?.userId;
    user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Fetch BSE Config from Database
    const bseConfig = await BseConfig.findOne().sort({ createdAt: -1 });

    if (!bseConfig) {
      const logEntry = {
        timestamp: getISTDate(new Date()),
        action: "bse_mfi_push_config_missing",
        payload: {},
        response: { success: false, message: "BSE Configuration not found" },
      };

      if (!user.pushTo) user.pushTo = {};
      if (!user.pushTo.bseStar) user.pushTo.bseStar = { logs: [], status: "pending" };
      if (!user.pushTo.bseMfStar) user.pushTo.bseMfStar = { logs: [], status: "pending" };

      user.pushTo.bseStar.status = "failed";
      user.pushTo.bseStar.logs.push(logEntry);
      user.pushTo.bseMfStar.status = "failed";
      user.pushTo.bseMfStar.logs.push(logEntry);
      await user.save();

      return res.status(500).json({
        success: false,
        message: "BSE Configuration not found. Please contact admin to set credentials.",
      });
    }

    // ✅ Check all approvals
    const allApproved = Object.values(user.approvals).every(
      (approval) => approval.status === "approved"
    );

    // if (!allApproved || !user.digitalSignatureContract?.signedByClient) {
    //   return res.status(400).json({
    //     success: false,
    //     message:
    //       "Cannot push data to bseMfi. Approvals or Digital Signature missing.",
    //   });
    // }

    //!  Populate payload with User data
    const nominee1 = user.nominees?.[0] || {};
    const nominee2 = user.nominees?.[1] || {};
    const nominee3 = user.nominees?.[2] || {};

    const formatNomineeDOB = (dob) => {
      if (!dob || !dob.day || !dob.month || !dob.year) return "";
      return `${dob.day.padStart(2, "0")}/${dob.month.padStart(2, "0")}/${dob.year}`;
    };

    const getOccupationCode = (id) => {
      const mapping = {
        business: "01",
        privateSector: "02",
        publicSector: "02",
        governmentService: "02",
        professional: "03",
        agriculturist: "04",
        retired: "05",
        houseWife: "06",
        student: "07",
        others: "08",
      };
      return mapping[id] || "08";
    };

    const getNomineeIdentityCode = (type) => {
      if (!type) return "";
      const t = String(type).trim().toUpperCase();
      if (t === "1" || t === "01" || t.includes("PAN")) return "1";
      if (t === "2" || t === "02" || t.includes("AADHAAR") || t.includes("ADHAAR") || t.includes("UID")) return "2";
      if (t === "3" || t === "03" || t.includes("DRIVING") || t.includes("LICENSE") || t.includes("LICENCE") || t.includes("DL")) return "3";
      if (t === "4" || t === "04" || t.includes("PASSPORT")) return "4";
      return "";
    };

    const cleanNomineeIdNumber = (type, idNo) => {
      if (!idNo) return "";
      const idType = getNomineeIdentityCode(type);
      const val = String(idNo).trim();
      if (idType === "2") {
        // Aadhaar: last 4 digits only (Length 4 digit per BSE spec)
        const digitsOnly = val.replace(/\D/g, "");
        return digitsOnly.length >= 4 ? digitsOnly.slice(-4) : digitsOnly;
      }
      if (idType === "1") return val.substring(0, 10).toUpperCase();
      if (idType === "3") return val.substring(0, 20);
      if (idType === "4") return val.substring(0, 9);
      return val;
    };

    const getBseRelationshipCode = (relation) => {
      if (!relation) return "";
      const r = String(relation).trim().toUpperCase();

      // If already a 2-digit code
      if (/^(0[1-9]|1[0-9]|2[0-3])$/.test(r)) return r;
      if (/^[1-9]$/.test(r)) return `0${r}`;

      const mapping = {
        "AUNT": "01",
        "BROTHER-IN-LAW": "02",
        "BROTHER IN LAW": "02",
        "BROTHERINLAW": "02",
        "BROTHER": "03",
        "DAUGHTER": "04",
        "DAUGHTER-IN-LAW": "05",
        "DAUGHTER IN LAW": "05",
        "DAUGHTERINLAW": "05",
        "FATHER": "06",
        "FATHER-IN-LAW": "07",
        "FATHER IN LAW": "07",
        "FATHERINLAW": "07",
        "GRAND DAUGHTER": "08",
        "GRANDDAUGHTER": "08",
        "GRAND FATHER": "09",
        "GRANDFATHER": "09",
        "GRAND MOTHER": "10",
        "GRANDMOTHER": "10",
        "GRAND SON": "11",
        "GRANDSON": "11",
        "MOTHER-IN-LAW": "12",
        "MOTHER IN LAW": "12",
        "MOTHERINLAW": "12",
        "MOTHER": "13",
        "NEPHEW": "14",
        "NIECE": "15",
        "SISTER": "16",
        "SISTER-IN-LAW": "17",
        "SISTER IN LAW": "17",
        "SISTERINLAW": "17",
        "SON": "18",
        "SON-IN-LAW": "19",
        "SON IN LAW": "19",
        "SONINLAW": "19",
        "SPOUSE": "20",
        "HUSBAND": "20",
        "WIFE": "20",
        "UNCLE": "21",
        "OTHERS": "22",
        "OTHER": "22",
        "COURT APPOINTED LEGAL GUARDIAN": "23",
        "LEGAL GUARDIAN": "23",
        "GUARDIAN": "23",
      };
      return mapping[r] || "22";
    };

    const isNomineeMinor = (nom) => {
      if (!nom || !nom.name) return false;
      if (nom.guardian && nom.guardian.name && nom.guardian.name.trim() !== "") return true;
      if (nom.dob && nom.dob.year) {
        const y = parseInt(nom.dob.year, 10);
        const m = parseInt(nom.dob.month, 10) - 1;
        const d = parseInt(nom.dob.day, 10);
        const birthDate = new Date(y, m, d);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const mDiff = today.getMonth() - birthDate.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (!isNaN(age) && age < 18) return true;
      }
      return false;
    };

    const nom1IsMinor = isNomineeMinor(nominee1);
    const nom2IsMinor = isNomineeMinor(nominee2);
    const nom3IsMinor = isNomineeMinor(nominee3);

    // Helper to clean and sanitize input
    const clean = (val, maxLength = 0) => {
      if (!val && val !== 0) return "";
      let str = String(val).trim().replace(/\|/g, " "); // Remove pipes
      if (maxLength > 0 && str.length > maxLength) {
        str = str.substring(0, maxLength);
      }
      return str;
    };

    // Construct pipe-separated values in exact order
    const paramList = [
      clean(user.clientCode, 10), // ClientCode 1
      clean(user.name.firstName, 100), // PrimaryHolderFirstName 2
      clean(user.name.middleName, 100), // PrimaryHolderMiddleName 3
      clean(user.name.lastName, 100), // PrimaryHolderLastName 4
      "01", // TaxStatus (Individual) 5
      user.gender === "male" ? "M" : "F", // Gender 6
      clean((user.dateOfBirth || user.dob) ? formatDateToDDMMYYYY(user.dateOfBirth || user.dob) : ""), // DOB 7
      clean(getOccupationCode(user.occupation), 2), // OccupationCode 8
      "SI", // HoldingNature (Single) 9
      "", // SecondHolderFirstName 10
      "", // SecondHolderMiddleName 11
      "", // SecondHolderLastName 12
      "", // ThirdHolderFirstName 13
      "", // ThirdHolderMiddleName 14
      "", // ThirdHolderLastName 15
      "", // SecondHolderDOB 16
      "", // ThirdHolderDOB 17
      "", // GuardianFirstName 18
      "", // GuardianMiddleName 19
      "", // GuardianLastName 20
      "", // GuardianDOB 21
      "N", // PrimaryHolderPANExempt 22
      "", // SecondHolderPANExempt 23
      "", // ThirdHolderPANExempt 24
      "", // GuardianPANExempt 25
      clean(user.PAN, 10), // PrimaryHolderPAN 26
      "", // SecondHolderPAN 27
      "", // ThirdHolderPAN 28
      "", // GuardianPAN 29
      "", // PrimaryHolderExemptCategory 30
      "", // SecondHolderExemptCategory 31
      "", // ThirdHolderExemptCategory 32
      "", // GuardianExemptCategory 33
      "P", // ClientType (Physical) 34
      "", // PMS 35
      "", // DefaultDP 36
      "", // CDSLDPID 37
      "", // CDSLCLTID 38
      "", // CMBPID 39
      "", // NSDLDPID 40
      "", // NSDLCLTID 41
      "SB",  // AccountType1 42 
      clean(user.bank_account_details?.account_number, 20), // AccountNo1 43
      clean(user.bank_account_details?.micr_code, 9), // MICRNo1 44
      clean(user.bank_account_details?.ifsc_code, 11), // IFSCCode1 45
      "Y", // DefaultBankFlag1 46
      "", // AccountType2 47
      "", // AccountNo2 48
      "", // MICRNo2 49
      "", // IFSCCode2 50
      "", // DefaultBankFlag2 51
      "", // AccountType3 52
      "", // AccountNo3 53
      "", // MICRNo3 54
      "", // IFSCCode3 55
      "", // DefaultBankFlag3 56
      "", // AccountType4 57
      "", // AccountNo4 58
      "", // MICRNo4 59
      "", // IFSCCode4 60
      "", // DefaultBankFlag4 61
      "", // AccountType5 62
      "", // AccountNo5 63
      "", // MICRNo5 64
      "", // IFSCCode5 65
      "", // DefaultBankFlag5 66
      "", // ChequeName 67
      "01", // DivPayMode (Electronic) 68
      clean(user.address?.addressLine1, 40), // Address1 69
      clean(user.address?.addressLine2, 40), // Address2 70
      clean(user.address?.addressLine3, 40), // Address3 71
      clean(user.address?.city, 30), // City 72
      clean(user.address?.stateCode || user.address?.state, 30), // State 73
      clean(user.address?.pincode, 6), // Pincode 74
      "INDIA", // Country 75   
      "", // ResiPhone 76
      "", // ResiFax 77
      "", // OfficePhone 78
      "", // OfficeFax 79
      clean(user.email, 100), // Email 80
      "E", // CommMode (Electronic) 81
      "", // ForeignAddress1 82
      "", // ForeignAddress2 83
      "", // ForeignAddress3 84
      "", // ForeignCity 85
      "", // ForeignPincode 86
      "", // ForeignState 87
      "", // ForeignCountry 88
      "", // ForeignResiPhone 89
      "", // ForeignResiFax 90
      "", // ForeignOfficePhone 91
      "", // ForeignOfficeFax 92
      clean(user.mobileNumber, 10), // IndianMobileNo 93
      "K", // PrimaryHolderKYCType 94
      "", // PrimaryHolderCKYCNumber 95
      "", // SecondHolderKYCType 96
      "", // SecondHolderCKYCNumber 97
      "", // ThirdHolderKYCType 98
      "", // ThirdHolderCKYCNumber 99
      "", // GuardianKYCType 100
      "", // GuardianCKYCNumber 101
      "", // PrimaryHolderKRAExemptRefNo 102
      "", // SecondHolderKRAExemptRefNo 103
      "", // ThirdHolderKRAExemptRefNo 104
      "", // GuardianKRAExemptRefNo 105
      "", // AadhaarUpdated 106
      "", // MapInId 107
      "Z", // PaperlessFlag 108
      "", // LEINo 109
      "", // LEIValidityDate 110
      "SE", // MobileDeclarationFlag 111
      "SE", // EmailDeclarationFlag 112
      "", // SecondHolderEmail 113
      "", // SecondHolderEmailDeclaration 114
      "", // SecondHolderMobile 115
      "", // SecondHolderMobileDeclaration 116
      "", // ThirdHolderEmail 117
      "", // ThirdHolderEmailDeclaration 118
      "", // ThirdHolderMobile 119
      "", // ThirdHolderMobileDeclaration 120
      clean(nom1IsMinor && nominee1.guardian?.relation ? getBseRelationshipCode(nominee1.guardian.relation) : "", 2), // GuardianRelationship 121
      user.nominees?.length > 0 ? "Y" : "N", // NominationOpt 122
      "O", // NominationAuthMode 123 (Mandatory "O" [OTP] for both opt-in and opt-out in BSE StAR MF)
      clean(nominee1.name, 40), // Nominee1Name 124
      clean(nominee1.name ? getBseRelationshipCode(nominee1.relation) : "", 2), // Nominee1Relationship 125
      clean(nominee1.sharePercentage, 5), // Nominee1ApplicablePercent 126
      nominee1.name ? (nom1IsMinor ? "Y" : "N") : "", // Nominee1MinorFlag 127
      nom1IsMinor ? clean(formatNomineeDOB(nominee1.dob), 10) : "", // Nominee1DOB 128 (Must be blank if not minor per BSE validation)
      nom1IsMinor ? clean(nominee1.guardian?.name, 35) : "", // Nominee1Guardian 129
      nom1IsMinor ? clean(nominee1.guardian?.pan, 10) : "", // Nominee1GuardianPAN 130
      clean(nominee1.name ? getNomineeIdentityCode(nominee1.identityType) : "", 1), // Nominee1IdentityType 131
      clean(nominee1.name ? cleanNomineeIdNumber(nominee1.identityType, nominee1.identityNumber) : "", 20), // Nominee1IDNumber 132
      clean(nominee1.email, 120), // Nominee1Email 133
      clean(nominee1.mobile, 15), // Nominee1Mobile 134
      clean(nominee1.name ? (nominee1.address?.addressLine1 || "Same address of First Holder") : "", 40), // Nominee1Address1 135
      clean(nominee1.address?.addressLine2, 40), // Nominee1Address2 136
      clean(nominee1.address?.addressLine3, 40), // Nominee1Address3 137
      clean(nominee1.name ? (nominee1.address?.city || user.address?.city) : "", 35), // Nominee1City 138
      clean(nominee1.name ? (nominee1.address?.pincode || user.address?.pincode) : "", 15), // Nominee1Pin 139
      nominee1.name ? "INDIA" : "", // Nominee1Country 140

      clean(nominee2.name, 40), // Nominee2Name 141
      clean(nominee2.name ? getBseRelationshipCode(nominee2.relation) : "", 2), // Nominee2Relationship 142
      clean(nominee2.sharePercentage, 5), // Nominee2ApplicablePercent 143
      nominee2.name ? (nom2IsMinor ? "Y" : "N") : "", // Nominee2MinorFlag 144
      nom2IsMinor ? clean(formatNomineeDOB(nominee2.dob), 10) : "", // Nominee2DOB 145 (Must be blank if not minor per BSE validation)
      nom2IsMinor ? clean(nominee2.guardian?.name, 35) : "", // Nominee2Guardian 146
      nom2IsMinor ? clean(nominee2.guardian?.pan, 10) : "", // Nominee2GuardianPAN 147
      clean(nominee2.name ? getNomineeIdentityCode(nominee2.identityType) : "", 1), // Nominee2IdentityType 148
      clean(nominee2.name ? cleanNomineeIdNumber(nominee2.identityType, nominee2.identityNumber) : "", 20), // Nominee2IDNumber 149
      clean(nominee2.email, 120), // Nominee2Email 150
      clean(nominee2.mobile, 15), // Nominee2Mobile 151
      clean(nominee2.address?.addressLine1, 40), // Nominee2Address1 152
      clean(nominee2.address?.addressLine2, 40), // Nominee2Address2 153
      clean(nominee2.address?.addressLine3, 40), // Nominee2Address3 154
      clean(nominee2.address?.city, 35), // Nominee2City 155
      clean(nominee2.address?.pincode, 15), // Nominee2Pin 156
      nominee2.name ? "INDIA" : "", // Nominee2Country 157
      
      clean(nominee3.name, 40), // Nominee3Name 158
      clean(nominee3.name ? getBseRelationshipCode(nominee3.relation) : "", 2), // Nominee3Relationship 159
      clean(nominee3.sharePercentage, 5), // Nominee3ApplicablePercent 160
      nominee3.name ? (nom3IsMinor ? "Y" : "N") : "", // Nominee3MinorFlag 161
      nom3IsMinor ? clean(formatNomineeDOB(nominee3.dob), 10) : "", // Nominee3DOB 162 (Must be blank if not minor per BSE validation)
      nom3IsMinor ? clean(nominee3.guardian?.name, 35) : "", // Nominee3Guardian 163
      nom3IsMinor ? clean(nominee3.guardian?.pan, 10) : "", // Nominee3GuardianPAN 164
      clean(nominee3.name ? getNomineeIdentityCode(nominee3.identityType) : "", 1), // Nominee3IdentityType 165
      clean(nominee3.name ? cleanNomineeIdNumber(nominee3.identityType, nominee3.identityNumber) : "", 20), // Nominee3IDNumber 166
      clean(nominee3.email, 120), // Nominee3Email 167
      clean(nominee3.mobile, 15), // Nominee3Mobile 168
      clean(nominee3.address?.addressLine1, 40), // Nominee3Address1 169
      clean(nominee3.address?.addressLine2, 40), // Nominee3Address2 170
      clean(nominee3.address?.addressLine3, 40), // Nominee3Address3 171
      clean(nominee3.address?.city, 35), // Nominee3City 172
      clean(nominee3.address?.pincode, 15), // Nominee3Pin 173
      nominee3.name ? "INDIA" : "", // Nominee3Country 174

      user.nominees?.length > 0 ? "Y" : "N", // NOM_SOA 175
       
       // Filler fields for V183 compliance (8 fields: 176-183)
       "", "", "", "", "", "", "", ""
     ];

    const param = paramList.join("|");

    console.log("!!! PARAM LIST DEBUG !!!");
    paramList.forEach((val, i) => console.log(`${i+1}: ${val}`));
    console.log(param);
    

    payload = {
      UserId: bseConfig.userId, // Dynamic from DB
      MemberCode: bseConfig.memberCode, // Dynamic from DB
      Password: bseConfig.password, // Dynamic from DB
      RegnType: "NEW",
      Param: param,
      Filler1: "",
      Filler2: "",
    };

    // ✅ Send POST request to BSE MFI
    const response = await axios.post(
      `${bseConfig.apiUrl}`,
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    // ✅ Log to Database
    let isSuccess = false;
    if (response.data) {
      if (response.data.Status === "0") {
        isSuccess = true;
      }
      
      if (typeof response.data.Remarks === "string") {
        const remarksUpper = response.data.Remarks.toUpperCase();
        if (
          remarksUpper.includes("CLIENT MODIFICATION NOT ALLOWED IF REGN TYPE IS NEW") ||
          remarksUpper.includes("ALREADY REGISTERED") ||
          remarksUpper.includes("ALREADY EXIST")
        ) {
          isSuccess = true;
        } else if (remarksUpper.includes("FAILED")) {
          isSuccess = false;
        }
      }
    }
    
    const status = isSuccess ? "success" : "failed"; 
    const statusMessage = isSuccess 
      ? (response.data?.Remarks?.toUpperCase().includes("CLIENT MODIFICATION NOT ALLOWED") 
          ? "Client is already successfully registered with BSE StAR MF" 
          : (response.data?.Remarks || "Data successfully registered with BSE StAR MF"))
      : (response.data?.Remarks || "Push failed without remarks");
    
    const logEntry = {
      timestamp: getISTDate(new Date()),
      action: "bse_mfi_push",
      payload: payload,
      response: response.data,
    };

    if (!user.pushTo) user.pushTo = {};
    if (!user.pushTo.bseStar) user.pushTo.bseStar = { logs: [], status: "pending", message: "" };
    if (!user.pushTo.bseMfStar) user.pushTo.bseMfStar = { logs: [], status: "pending", message: "" };

    user.pushTo.bseStar.status = status;
    user.pushTo.bseStar.message = statusMessage;
    user.pushTo.bseStar.logs.push(logEntry);

    user.pushTo.bseMfStar.status = status;
    user.pushTo.bseMfStar.message = statusMessage;
    user.pushTo.bseMfStar.logs.push(logEntry);

    await user.save();

    if (isSuccess) {
      return res.status(200).json({
        success: true,
        message: statusMessage,
        data: response.data,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data?.Remarks || "Failed to push data to Bse_Mfi",
        data: response.data,
      });
    }
  } catch (error) {
    console.error("Error while pushing to Bse_Mfi:", error.message);

    try {
        // Try to use the user variable from the outer scope first, otherwise fetch it
        let userForLog = user;
        if (!userForLog && req.params?.userId) {
            userForLog = await User.findById(req.params.userId);
        }

        if (userForLog) {
            const errorLog = {
                timestamp: getISTDate(new Date()),
                action: "bse_mfi_push_error",
                payload: payload || { message: "Payload not generated yet", error: error.message }, // Store real payload if available
                response: { 
                    success: false, 
                    message: "Internal Server Error", 
                    error: error.message, 
                    stack: error.stack 
                }
            };

            if (!userForLog.pushTo) userForLog.pushTo = {};
            if (!userForLog.pushTo.bseStar) userForLog.pushTo.bseStar = { logs: [], status: "pending" };
            if (!userForLog.pushTo.bseMfStar) userForLog.pushTo.bseMfStar = { logs: [], status: "pending" };

            userForLog.pushTo.bseStar.status = "failed";
            userForLog.pushTo.bseStar.logs.push(errorLog);
            userForLog.pushTo.bseMfStar.status = "failed";
            userForLog.pushTo.bseMfStar.logs.push(errorLog);
            await userForLog.save();
        }
    } catch (logError) {
        console.error("Error logging failure to user:", logError);
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error while pushing to Bse_Mfi",
      error: error.message,
    });
  }
};


