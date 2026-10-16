import archiver from "archiver";
import { Buffer } from "buffer";
import moment from "moment-timezone";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";

// Helper to format date as YYYY-MM-DD (ISO 8601 standard for UDiFF)
export const formatIsoDate = (date) => {
  if (!date) return "";
  const m = moment(date);
  return m.isValid() ? m.tz("Asia/Kolkata").format("YYYY-MM-DD") : "";
};

// Helper to format date as DDMMYYYY (CDAS legacy format)
export const formatDateDDMMYYYY = (date) => {
  if (!date) return "";
  const m = moment(date);
  return m.isValid() ? m.tz("Asia/Kolkata").format("DDMMYYYY") : "";
};

// CSV cell escaper according to CDSL UDiFF specifications (strips commas and newlines inside cell values)
export const escapeCsvCell = (val) => {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (/^\s+$/.test(str)) {
    return str;
  }
  return str.trim().replace(/[\r\n]+/g, " ").replace(/,/g, " ");
};

// ============================================
// UDiFF 184-Column CSV Specification Header (Matches Working Production Sample)
// ============================================
export const UDIFF_BO_UPLOAD_HEADERS = [
  "CntrlSctiesDpstryPtcpt", "BrnchId", "BtchId", "SndrId", "CntrlSctiesDpstryPtcptRole",
  "SndrDt", "RcvDt", "RcrdNb", "RcdSRNumber", "BOTxnTyp",
  "ClntId", "PrdNb", "BnfcrySubTp", "Purpse", "Titl",
  "FrstNm", "MddlNm", "LastNm", "FSfx", "BnfcryShrtNm",
  "ScndHldrNmOfFthr", "BirthDt", "Gndr", "PAN", "PANVrfyFlg",
  "PANXmptnCd", "UID", "AdhrAuthntcnWthUID", "RsnForNonUpdtdAdhr", "VID",
  "SMSFclty", "PrmryISDCd", "MobNb", "FmlyFlgForMobNbOf", "ScndryISDCd",
  "PhneNb", "EmailAdr", "FmlyFlgForEmailAdr", "AltrnEmailAdr", "NoNmntnFlg",
  "MdOfOpr", "ClrMmbId", "StgInstr", "GrssAnlIncmRg", "NetWrth",
  "NetWrthAsOnDt", "LEI", "LEIExp", "OneTmDclrtnFlgForGSECIDT", "INIFSC",
  "MICRCd", "DvddCcy", "DvddBkCcy", "RBIApprvdDt", "RBIRefNb",
  "Mndt", "SEBIRegNb", "EdctnLvl", "AnlRptFlg", "BnfclOwnrSttlmCyclCd",
  "ElctrncConf", "EmailRTADwnldFlg", "GeoCd", "Xchg", "MntlDsblty",
  "Ntlty", "CASMd", "AncstrlFlg", "PldgStgInstrFlg", "BkAcctTp",
  "BnfcryAcctCtgy", "BnfcryBkAcctNb", "BnfcryBkNm", "BnfcryTaxDdctnSts", "ClrSysId",
  "BSDAFlg", "Ocptn", "PMSClntAcctFlg", "PMSSEBIRegnNb", "PostvConf",
  "FrstClntOptnToRcvElctrncStmtFlg", "ComToBeSentTo", "DelFlg", "RsnCdDeltn", "DtOfDeath",
  "AccntOpSrc", "CustdPmsEmailId", "POAOrDDPITp", "TradgId", "SndrRefNb1",
  "SndrRefNb2", "CtdnFlg", "DmtrlstnGtwy", "NmneeMnrInd", "SrlNbr",
  "NmneePctgOfShr", "FlgForShrPctgEqlty", "RsdlSecFlg", "RltshWthBnfclOwnr", "NbOfPOAMppng",
  "POAId", "POAToOprtAcct", "POAOrDDPIId", "SetUpDt", "FrDt",
  "ToDt", "GPABPAFlg", "POAMstrID", "PoaLnkPurpCd", "Rmk",
  "BOUCCLkFlg", "CnsntInd", "UnqClntId", "Brkr", "Sgmt",
  "MapUMapFlg", "CmAcctToMap", "PurpCd", "AdrPrefFlg", "Adr1",
  "Adr2", "Adr3", "Adr4", "Ctry", "PstCd",
  "CtrySubDvsnCd", "CitySeqNb", "FaxNb", "ITCrcl", "ProofOfRes",
  "NbOfCoprcnrs", "SgntryId", "SgntrSz", "BnfclOwnrAcctOfPMSFlg", "CrspdngBPId",
  "ClngMbrPAN", "LclAddPrsnt", "BnkAddPrsnt", "NmnorGrdnAddPrsnt", "MnrNmnGrdnAddPrsnt",
  "FrgnOrCorrAddPrsnt", "NbOfAuthSgnt", "AuthFlg", "CoprcnrOrMmbr", "TypMod",
  "SubTypMod", "StsChgRsnOrClsrRsnCd", "NmChgRsnCd", "ExecDt", "AddModDelInd",
  "AppKrta", "ChgKrtaRsn", "DtIntmnBO", "PrfDpstryFldFrCAS", "CoprcnrsId",
  "ClsrInitBy", "RmngBal", "CANm", "CertNbr", "CertXpryDt",
  "NbrPOASgntryReqSign", "DpstryInd", "AcctTyp", "SrcCMBPID", "TrgtDPID",
  "TrgtClntID", "SrlFlg", "UPIId", "SignTyp", "NBOID",
  "ClntBsdaOptOutDt", "CtrySubDvsnNm", "RsnBSDAMod", "DtIntmnDms", "Drl",
  "Psprt", "NmStmtFlg", "RsnDlayClsReq", "SpPurpFlg", "CnsntMode",
  "DrpanId", "Rsvd1", "Rsvd2", "Rsvd3", "Rsvd4"
];

// Helper to format ISO 8601 date with T separator (YYYY-MM-DDTHH:mm:ss) per UDiFF Principle #8
const formatIsoDateTimeT = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`;
};

// Map occupation to standard character codes from UDiFF Standard Value List
export const mapOccupationToUDiFF = (occ) => {
  if (!occ) return "PRS";
  const o = String(occ).toLowerCase().trim();
  if (o.includes("private")) return "PRS";
  if (o.includes("public")) return "PUS";
  if (o.includes("business")) return "BUS";
  if (o.includes("professional")) return "PRO";
  if (o.includes("farmer") || o.includes("agri")) return "FAR";
  if (o.includes("government") || o.includes("govt")) return "GOV";
  if (o.includes("retired")) return "RET";
  if (o.includes("housewife") || o.includes("homemaker")) return "HOU";
  if (o.includes("student")) return "STU";
  if (o.includes("service")) return "SER";
  return "PRS";
};

// Map annual income to standard range codes from UDiFF Standard Value List
export const mapAnnualIncomeToUDiFF = (income) => {
  const inc = String(income || "").toLowerCase().trim();
  if (inc.includes("below") || inc.includes("upto") || inc.includes("1lakh") || inc === "01") return "UPT1L";
  if (inc.includes("1to5") || inc.includes("onetofivelakhs") || inc === "02") return "1LT5L";
  if (inc.includes("5to10") || inc.includes("fivetotenlakhs") || inc === "03") return "5LTXL";
  if (inc.includes("10to25") || inc.includes("tentotwentyfivelakhs") || inc === "04") return "XLTXXV";
  if (inc.includes("above") || inc.includes("gt24") || inc === "05") return "GT24L";
  return "1LT5L";
};

// Map human-readable relationship string to CDSL UDiFF Relationship Codes
export const mapRelationToCdsl = (relation) => {
  if (!relation) return "OTH";
  const r = String(relation).toUpperCase().trim();
  if (r === "SELF") return "SELF";
  if (r.includes("SON") || r === "S") return "SON";
  if (r.includes("DAUGHTER") || r === "D") return "DAU";
  if (r.includes("WIFE") || r.includes("SPOUSE") && !r.includes("HUSBAND")) return "SPS";
  if (r.includes("HUSBAND")) return "SPS";
  if (r.includes("FATHER") || r === "F") return "FAT";
  if (r.includes("MOTHER") || r === "M") return "MOT";
  if (r.includes("BROTHER")) return "BRO";
  if (r.includes("SISTER")) return "SIS";
  if (r.includes("GRAND") && r.includes("FATHER")) return "GRF";
  if (r.includes("GRAND") && r.includes("MOTHER")) return "GRM";
  if (r.includes("GRAND") && r.includes("SON")) return "GRS";
  if (r.includes("GRAND") && r.includes("DAUGHTER")) return "GRD";
  if (r.includes("NEPHEW")) return "NEP";
  if (r.includes("NIECE")) return "NIE";
  if (r.includes("UNCLE")) return "UNC";
  if (r.includes("AUNT")) return "AUN";
  if (r.includes("FRIEND")) return "FRD";
  return "OTH";
};

/**
 * Generate standard UDiFF CSV Format (182 columns as per Catalogue V2.0.0.2)
 * Principle #2 & #3: All files MUST have ISO headers in the first row.
 */
export const generateUDiFFCSV = (userData, config, options = {}) => {
  const { formatType = "udiff_comma", includeHeader = true, colsCount = 185 } = options;
  if (formatType === "cdas_legacy_pipe") {
    return generateBOSetupFile(userData, config);
  }

  const { dpId, batchNumber, uploadDate = new Date(), uploadId = "08", userId } = config;
  const cleanDpId = String(dpId || "59100").trim().padStart(5, "0").slice(-5);
  const sndrId = String(userId || "EKYC").trim().slice(0, 4) || "EKYC";
  const batchStr = String(batchNumber || "1").padStart(5, "0").slice(-5);
  
  const formatDateTimeStr = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    const dt = d ? new Date(d) : new Date();
    return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}${pad(dt.getHours())}${pad(dt.getMinutes())}`;
  };
  const timeStr = formatDateTimeStr(uploadDate);

  // CDSL BO Upload File Naming Convention (Format Master #12):
  const fileName = `BO_UPLD_${cleanDpId}_${timeStr}_${batchStr}`;
  const headers = colsCount === 178 ? UDIFF_BO_UPLOAD_HEADERS.slice(0, 178) : UDIFF_BO_UPLOAD_HEADERS;
  const rows = [];

  // Add ISO header row if includeHeader is true
  if (includeHeader) {
    rows.push(headers.join(","));
  }

  const sndrDt = uploadDate.toISOString().split("T")[0]; // YYYY-MM-DD
  const pad2 = (n) => String(n).padStart(2, "0");
  const rcvDt = `${sndrDt}T${pad2(uploadDate.getHours())}:${pad2(uploadDate.getMinutes())}:${pad2(uploadDate.getSeconds())}`;

  function createEmptyRow() {
    return new Array(headers.length).fill("");
  }

  function setCol(row, colName, value) {
    const idx = headers.indexOf(colName);
    if (idx !== -1) {
      row[idx] = value != null ? String(value) : "";
    }
  }

  const cleanAddrLine = (s) => String(s || "")
    .replace(/^(S\/O|D\/O|W\/O|C\/O|H\/O|son of|daughter of|wife of)[:\s]+/gi, "")
    .replace(/,/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();

  let globalSrNo = 1;

  userData.forEach((user, index) => {
    const recordNum = index + 1;
    const isSetup = !user.modificationType;
    const nominees = user.nominees || [];
    const hasNominee = nominees.length > 0 && !!nominees[0]?.name;
    const bnfcrySubTp = hasNominee ? "INRES" : "IRNNO";
    const noNmntnFlg = hasNominee ? "NO" : "";
    const nmStmtFlg = hasNominee ? "NM" : "";

    const boId = user.boId || user.dpId || user.dp_id || "";
    const pan = (user.pan || user.PAN || "").toUpperCase().trim();
    const gender = (user.gender === "Female" || user.gender === "female" || user.gender === "F") ? "FMALE" : "MALE";
    const title = gender === "FMALE" ? (user.maritalStatus === "02" ? "MISS" : "MRS") : "MR";

    const userStrName = typeof user.name === "string" ? user.name : (user.name?.fullName || user.fullName || `${user.name?.firstName || ""} ${user.name?.lastName || ""}`.trim());
    let firstName = "", middleName = "", lastName = "";
    const nameParts = userStrName.trim().split(/\s+/);
    if (nameParts.length >= 4) {
      firstName = userStrName.trim();
      middleName = "";
      lastName = ".";
    } else if (nameParts.length === 3) {
      firstName = nameParts[0];
      middleName = nameParts[1];
      lastName = nameParts[2];
    } else if (nameParts.length === 2) {
      firstName = nameParts[0];
      middleName = "";
      lastName = nameParts[1];
    } else if (nameParts.length === 1) {
      firstName = nameParts[0];
      middleName = "";
      lastName = ".";
    }

    const fatherStrName = typeof user.fatherName === "string" ? user.fatherName : (user.fatherName?.fullName || `${user.fatherName?.firstName || ""} ${user.fatherName?.lastName || ""}`.trim());
    const dob = user.dob || user.dateOfBirth ? new Date(user.dob || user.dateOfBirth).toISOString().split("T")[0] : "";
    const mobile = user.mobile || user.mobileNumber || user.mobile_number || "";
    const email = user.email || "";

    let maskedAadhaar = "";
    let rawAadhaar = "";
    if (user.aadhaar_number && String(user.aadhaar_number).trim()) {
      rawAadhaar = String(user.aadhaar_number).trim();
    } else if (
      user.addressProof?.type === "aadhaar" &&
      user.addressProof?.number &&
      String(user.addressProof.number).trim()
    ) {
      rawAadhaar = String(user.addressProof.number).trim();
    }

    if (rawAadhaar) {
      if (/[xX*]/.test(rawAadhaar)) {
        maskedAadhaar = "XXXXXXXX" + rawAadhaar.replace(/[^0-9]/g, "").slice(-4);
      } else if (rawAadhaar.length >= 4) {
        maskedAadhaar = "XXXXXXXX" + rawAadhaar.slice(-4);
      } else {
        maskedAadhaar = rawAadhaar;
      }
    }

    const corrAddr = user.corrAddress || user.address || {};
    const permAddr = user.permAddress || user.permanentAddress || user.address || {};

    const corrStateCode = mapStateToCdsl(corrAddr.state, corrAddr.stateCode);
    const permStateCode = mapStateToCdsl(permAddr.state, permAddr.stateCode) || corrStateCode;

    const bank = user.bankDetails || {};
    const ifsc = bank.ifscCode || "";
    const micr = bank.micrCode || "";
    const bankAccNo = bank.accountNumber || "";
    const bankName = (bank.bankName || "").toUpperCase();
    const bkAcctTp = bank.accountType === "current" ? "CUR" : "SVG";

    const occupationCode = mapOccupationToUDiFF(user.occupationType || user.occupation);
    const incomeCode = mapAnnualIncomeToUDiFF(user.annualIncome || user.annual_income);

    function populateBaseClient(row, rcdSrNumber) {
      setCol(row, "CntrlSctiesDpstryPtcpt", cleanDpId);
      setCol(row, "BrnchId", "");
      setCol(row, "BtchId", "");
      setCol(row, "SndrId", sndrId);
      setCol(row, "CntrlSctiesDpstryPtcptRole", "");
      setCol(row, "SndrDt", sndrDt);
      setCol(row, "RcvDt", rcvDt);
      setCol(row, "RcrdNb", String(recordNum));
      setCol(row, "RcdSRNumber", String(rcdSrNumber));
      setCol(row, "BOTxnTyp", isSetup ? "BOSET" : "MDFY");
      setCol(row, "ClntId", boId);
      setCol(row, "PrdNb", "IND");
      setCol(row, "BnfcrySubTp", bnfcrySubTp);
      setCol(row, "Purpse", "FH");
      setCol(row, "Titl", title);
      setCol(row, "FrstNm", firstName);
      setCol(row, "MddlNm", middleName);
      setCol(row, "LastNm", lastName);
      setCol(row, "FSfx", "");
      setCol(row, "BnfcryShrtNm", "");
      setCol(row, "ScndHldrNmOfFthr", fatherStrName);
      setCol(row, "BirthDt", dob);
      setCol(row, "Gndr", gender);
      setCol(row, "PAN", pan);
      setCol(row, "PANVrfyFlg", "PANVLD");
      if (maskedAadhaar) {
        setCol(row, "UID", maskedAadhaar);
        setCol(row, "AdhrAuthntcnWthUID", "ADRV");
      }
      setCol(row, "SMSFclty", "YES");
      setCol(row, "PrmryISDCd", "91");
      setCol(row, "MobNb", mobile);
      setCol(row, "EmailAdr", email);
      setCol(row, "NoNmntnFlg", noNmntnFlg);
      setCol(row, "MdOfOpr", "SLHLD");
      setCol(row, "StgInstr", "YES");
      setCol(row, "GrssAnlIncmRg", incomeCode);
      setCol(row, "INIFSC", ifsc);
      setCol(row, "MICRCd", micr);
      setCol(row, "DvddCcy", "999001");
      setCol(row, "DvddBkCcy", "999001");
      setCol(row, "Mndt", "YES");
      setCol(row, "BnfclOwnrSttlmCyclCd", "EM");
      setCol(row, "ElctrncConf", "");
      setCol(row, "EmailRTADwnldFlg", "YES");
      setCol(row, "Ntlty", "IN");
      setCol(row, "PldgStgInstrFlg", "YES");
      setCol(row, "BkAcctTp", bkAcctTp);
      setCol(row, "BnfcryAcctCtgy", "NHB");
      setCol(row, "BnfcryBkAcctNb", bankAccNo);
      setCol(row, "BnfcryBkNm", bankName);
      setCol(row, "BnfcryTaxDdctnSts", "RI");
      setCol(row, "BSDAFlg", "BSDA");
      setCol(row, "Ocptn", occupationCode);
      setCol(row, "FrstClntOptnToRcvElctrncStmtFlg", "ELE");
      setCol(row, "ComToBeSentTo", "FIH");
      setCol(row, "AccntOpSrc", "OLAO");
      setCol(row, "SndrRefNb1", user.lsid || "");
      setCol(row, "Ctry", "IN");
      setCol(row, "CitySeqNb", "1");
      setCol(row, "NmStmtFlg", nmStmtFlg);
      // Net Worth
      if (user.netWorth) {
        setCol(row, "NetWrth", String(user.netWorth));
      }
      if (user.netWorthDate) {
        const nwDate = new Date(user.netWorthDate);
        if (!isNaN(nwDate.getTime())) {
          setCol(row, "NetWrthAsOnDt", nwDate.toISOString().split("T")[0]);
        }
      }
    }

    // Row 1: CORAD (Correspondence Address)
    const rowCorad = createEmptyRow();
    populateBaseClient(rowCorad, globalSrNo++);
    setCol(rowCorad, "PurpCd", "CORAD");
    setCol(rowCorad, "Adr1", cleanAddrLine(corrAddr.address1 || corrAddr.addressLine1 || corrAddr.line1 || ""));
    setCol(rowCorad, "Adr2", cleanAddrLine(corrAddr.address2 || corrAddr.addressLine2 || corrAddr.line2 || ""));
    setCol(rowCorad, "Adr3", cleanAddrLine(corrAddr.address3 || corrAddr.addressLine3 || corrAddr.line3 || ""));
    setCol(rowCorad, "Adr4", cleanAddrLine(corrAddr.city || ""));
    setCol(rowCorad, "PstCd", cleanAddrLine(corrAddr.pincode || corrAddr.zipCode || ""));
    setCol(rowCorad, "CtrySubDvsnCd", corrStateCode);
    rows.push(rowCorad.map(escapeCsvCell).join(","));

    // Row 2: PERAD (Permanent Address)
    const rowPerad = createEmptyRow();
    populateBaseClient(rowPerad, globalSrNo++);
    setCol(rowPerad, "PurpCd", "PERAD");
    setCol(rowPerad, "Adr1", cleanAddrLine(permAddr.address1 || permAddr.addressLine1 || permAddr.line1 || ""));
    setCol(rowPerad, "Adr2", cleanAddrLine(permAddr.address2 || permAddr.addressLine2 || permAddr.line2 || ""));
    setCol(rowPerad, "Adr3", cleanAddrLine(permAddr.address3 || permAddr.addressLine3 || permAddr.line3 || ""));
    setCol(rowPerad, "Adr4", cleanAddrLine(permAddr.city || ""));
    setCol(rowPerad, "PstCd", cleanAddrLine(permAddr.pincode || permAddr.zipCode || ""));
    setCol(rowPerad, "CtrySubDvsnCd", permStateCode);
    rows.push(rowPerad.map(escapeCsvCell).join(","));

    // Row 3+: Nominees (if any)
    if (hasNominee) {
      nominees.forEach((nom, nIdx) => {
        const nomRow = createEmptyRow();
        const nomPurpCd = nIdx === 0 ? "NOMAD" : (nIdx === 1 ? "SENAD" : "THNAD");
        const nomShare = nom.sharePercentage ? String(nom.sharePercentage) : (nominees.length === 1 ? "100" : "");
        const nomStateCode = mapStateToCdsl(nom.address?.state, nom.address?.stateCode);

        let nomFirst = "", nomMid = "", nomLast = "";
        const nomParts = (nom.name || "").trim().split(/\s+/);
        if (nomParts.length >= 4) {
          nomFirst = nom.name.trim();
          nomLast = ".";
        } else if (nomParts.length === 3) {
          nomFirst = nomParts[0];
          nomMid = nomParts[1];
          nomLast = nomParts[2];
        } else if (nomParts.length === 2) {
          nomFirst = nomParts[0];
          nomLast = nomParts[1];
        } else if (nomParts.length === 1) {
          nomFirst = nomParts[0];
          nomLast = ".";
        }

        setCol(nomRow, "CntrlSctiesDpstryPtcpt", cleanDpId);
        setCol(nomRow, "BtchId", "");
        setCol(nomRow, "BrnchId", "");
        setCol(nomRow, "SndrId", sndrId);
        setCol(nomRow, "SndrDt", sndrDt);
        setCol(nomRow, "RcvDt", rcvDt);
        setCol(nomRow, "RcrdNb", String(recordNum));
        setCol(nomRow, "RcdSRNumber", String(globalSrNo++));
        setCol(nomRow, "Purpse", "NM");
        setCol(nomRow, "SrlNbr", String(nIdx + 1));
        setCol(nomRow, "NmneePctgOfShr", nomShare);
        setCol(nomRow, "RsdlSecFlg", nIdx === 0 ? "YES" : "NO");
        setCol(nomRow, "PurpCd", nomPurpCd);
        setCol(nomRow, "ClntId", boId);
        setCol(nomRow, "BOTxnTyp", "BOSET");
        setCol(nomRow, "FrstNm", nomFirst);
        setCol(nomRow, "MddlNm", nomMid);
        setCol(nomRow, "LastNm", nomLast);
        setCol(nomRow, "BirthDt", nom.dob || "");
        setCol(nomRow, "Adr1", cleanAddrLine(nom.address?.line1 || nom.address?.address1 || ""));
        setCol(nomRow, "Adr2", cleanAddrLine(nom.address?.line2 || nom.address?.address2 || ""));
        setCol(nomRow, "Adr3", cleanAddrLine(nom.address?.line3 || nom.address?.address3 || ""));
        setCol(nomRow, "Adr4", cleanAddrLine(nom.address?.city || ""));
        setCol(nomRow, "Ctry", "IN");
        setCol(nomRow, "PstCd", cleanAddrLine(nom.address?.pincode || ""));
        setCol(nomRow, "CtrySubDvsnCd", nomStateCode);
        setCol(nomRow, "CitySeqNb", "1");
        setCol(nomRow, "RltshWthBnfclOwnr", mapRelationToCdsl(nom.relationshipCode || nom.relation));
        setCol(nomRow, "PrmryISDCd", nom.mobile ? "91" : "");
        setCol(nomRow, "MobNb", nom.mobile || "");
        setCol(nomRow, "EmailAdr", nom.email || "");
        setCol(nomRow, "NmneeMnrInd", nom.isMinor === "Y" || nom.guardian ? "YES" : "");
        if (nom.pan) setCol(nomRow, "PAN", nom.pan);

        rows.push(nomRow.map(escapeCsvCell).join(","));
      });
    }

    // Row: DDPI Rows (if ddpiConcent signed)
    const ddpi = user.ddpiConcent || {};
    const ddpiPurposes = [];
    if (ddpi.transfer_of_security) ddpiPurposes.push("SET");
    if (ddpi.pledging) ddpiPurposes.push("MRP");
    if (ddpi.mutual_fund_transaction) ddpiPurposes.push("MUF");
    if (ddpi.tendering_shares) ddpiPurposes.push("TEO");

    for (const gpFlg of ddpiPurposes) {
      const ddpiRow = createEmptyRow();
      setCol(ddpiRow, "CntrlSctiesDpstryPtcpt", cleanDpId);
      setCol(ddpiRow, "SndrDt", sndrDt);
      setCol(ddpiRow, "RcvDt", rcvDt);
      setCol(ddpiRow, "RcrdNb", String(recordNum));
      setCol(ddpiRow, "RcdSRNumber", String(globalSrNo++));
      setCol(ddpiRow, "BOTxnTyp", "BOSET");
      setCol(ddpiRow, "PrdNb", "IND");
      setCol(ddpiRow, "BnfcrySubTp", "IND");
      setCol(ddpiRow, "Purpse", "POALB");
      setCol(ddpiRow, "SrlNbr", "1");
      setCol(ddpiRow, "NbOfPOAMppng", "1");
      setCol(ddpiRow, "POAId", boId);
      setCol(ddpiRow, "POAToOprtAcct", "YES");
      setCol(ddpiRow, "SetUpDt", sndrDt);
      setCol(ddpiRow, "FrDt", sndrDt);
      setCol(ddpiRow, "GPABPAFlg", gpFlg);
      setCol(ddpiRow, "POAMstrID", "2205910000000040");
      setCol(ddpiRow, "PoaLnkPurpCd", "FRH");
      setCol(ddpiRow, "ClntId", boId);
      setCol(ddpiRow, "POAOrDDPITp", "DDPI");
      rows.push(ddpiRow.map(escapeCsvCell).join(","));
    }
  });

  return { fileName, content: rows.join("\r\n") + "\r\n" };
};

// Helper to map State name or code to 2-digit CDSL state code
export const mapStateToCdsl = (state, stateCode) => {
  if (stateCode && /^\d{2}$/.test(String(stateCode).trim())) return String(stateCode).trim();
  const s = String(state || "").toUpperCase().trim();
  const stateMap = {
    "ANDAMAN AND NICOBAR ISLANDS": "35",
    "ANDHRA PRADESH": "28",
    "ARUNACHAL PRADESH": "12",
    "ASSAM": "18",
    "BIHAR": "10",
    "CHANDIGARH": "04",
    "CHHATTISGARH": "22",
    "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "26",
    "DAMAN AND DIU": "25",
    "DELHI": "07",
    "GOA": "30",
    "GUJARAT": "24",
    "HARYANA": "06",
    "HIMACHAL PRADESH": "02",
    "JAMMU AND KASHMIR": "01",
    "JHARKHAND": "20",
    "KARNATAKA": "29",
    "KERALA": "32",
    "LADAKH": "37",
    "LAKSHADWEEP": "31",
    "MADHYA PRADESH": "23",
    "MAHARASHTRA": "27",
    "MANIPUR": "14",
    "MEGHALAYA": "17",
    "MIZORAM": "15",
    "NAGALAND": "13",
    "ODISHA": "21",
    "PUDUCHERRY": "34",
    "PUNJAB": "03",
    "RAJASTHAN": "08",
    "SIKKIM": "11",
    "TAMIL NADU": "33",
    "TELANGANA": "36",
    "TRIPURA": "16",
    "UTTAR PRADESH": "09",
    "UTTARAKHAND": "05",
    "WEST BENGAL": "19",
    "UP": "09",
    "MP": "23",
    "AP": "28",
    "MH": "27",
    "DL": "07",
    "UK": "05",
    "WB": "19"
  };
  return stateMap[s] || "09";
};

// Helper to map occupation string to 2-digit CDSL occupation code
export const mapOccupationToCdsl = (occ) => {
  if (!occ) return "01";
  const o = String(occ).toLowerCase().trim();
  if (o.includes("privatesector") || o.includes("private")) return "08";
  if (o.includes("publicsector") || o.includes("public")) return "07";
  if (o.includes("government") || o.includes("govt")) return "09";
  if (o.includes("business")) return "01";
  if (o.includes("professional")) return "02";
  if (o.includes("agriculturist") || o.includes("agriculture")) return "03";
  if (o.includes("retired")) return "04";
  if (o.includes("housewife") || o.includes("homemaker")) return "05";
  if (o.includes("student")) return "06";
  if (o.includes("service")) return "08";
  if (/^\d{2}$/.test(o)) return o;
  return "01";
};

// Helper to safely extract string from text or object
export const safeString = (val) => {
  if (val === undefined || val === null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    if (val.fullName) return String(val.fullName).trim();
    const parts = [val.firstName, val.middleName, val.lastName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ").trim();
    if (val.address1 || val.addressLine1 || val.line1) {
      return [val.address1 || val.addressLine1 || val.line1, val.address2 || val.addressLine2 || val.line2, val.address3 || val.addressLine3 || val.line3].filter(Boolean).join(", ").trim();
    }
    return "";
  }
  return String(val).trim();
};

/**
 * Generate CDAS Pipe-delimited Format as defined in CR1892
 */
export const generateBOSetupFile = (userData, config) => {
  const { dpId, batchNumber, uploadDate = new Date(), uploadId = "08" } = config;
  const cleanDpId = String(dpId || "59100").trim().padStart(6, "0").slice(-6);
  const batchStr = String(batchNumber || "1").padStart(5, "0").slice(-5);
  const dateStr = formatDateDDMMYYYY(uploadDate);
  
  // CDSL naming: <UploadID (2)><DPID (6)>.<BatchNo (5)> e.g. 08059100.00001
  const fileName = `${uploadId}${cleanDpId}.${batchStr}`;
  
  let content = "";
  // Header Record (01) - Standard CDAS DDMMYYYY date format
  content += `01|${cleanDpId}|${batchStr}|${dateStr}|${String(userData.length).padStart(6, "0")}\r\n`;
  
  // Detail Records (02)
  userData.forEach((user) => {
    const nom1 = user.nominees?.[0] || {};
    const guard1 = nom1.guardian || {};
    const nom2 = user.nominees?.[1] || {};
    const guard2 = nom2.guardian || {};
    const nom3 = user.nominees?.[2] || {};
    const guard3 = nom3.guardian || {};

    const firstName = safeString(user.name?.firstName) || safeString(user.first_name) || safeString(user.name).split(" ")[0] || "";
    const middleName = safeString(user.name?.middleName) || safeString(user.middle_name) || "";
    const lastName = safeString(user.name?.lastName) || safeString(user.last_name) || safeString(user.name).split(" ").slice(1).join(" ") || "";
    const fatherName = safeString(user.fatherName) || safeString(user.father_first_name) || safeString(user.father_name) || "";

    const occupationCode = mapOccupationToCdsl(user.occupationType || user.occupation);
    const stateCode = mapStateToCdsl(user.permAddress?.state || user.address?.state, user.permAddress?.stateCode || user.address?.stateCode);

    // Strip Aadhaar-style relationship prefixes (S/O:, D/O:, W/O:, C/O:, H/O:) from address lines
    const cleanAddr = (addr) => {
      if (!addr) return "";
      return String(addr).replace(/^(S\/O|D\/O|W\/O|C\/O|H\/O|son of|daughter of|wife of)[:\s]+/gi, "").trim();
    };
    // Truncate to CDSL field length limits
    const trunc = (s, len) => String(s || "").substring(0, len).trim();

    const addr1Raw = safeString(user.permAddress?.address1 || user.address?.addressLine1 || user.address?.line1);
    const addr2Raw = safeString(user.permAddress?.address2 || user.address?.addressLine2 || user.address?.line2);
    const addr3Raw = safeString(user.permAddress?.address3 || user.address?.addressLine3 || user.address?.line3);

    const record = [
      "02",
      cleanDpId,                                          // DPID (6)
      user.accountType || "01",                           // Account Type (2)
      user.categoryType || "01",                          // Category Type (2)
      occupationCode,                                     // Occupation (2)
      trunc(safeString(user.pan), 10).toUpperCase(),      // PAN (10)
      trunc(firstName, 40).toUpperCase(),                  // First Name (40)
      trunc(middleName, 40).toUpperCase(),                 // Middle Name (40)
      trunc(lastName, 40).toUpperCase(),                   // Last Name (40)
      formatDateDDMMYYYY(user.dob || user.dateOfBirth),  // DOB (8) DDMMYYYY
      user.gender === "Female" || user.gender === "F" ? "F" : "M",  // Gender (1)
      trunc(fatherName, 40).toUpperCase(),                 // Father Name (40)
      trunc(safeString(user.email), 50).toLowerCase(),     // Email (50)
      trunc(safeString(user.mobile || user.mobile_number || user.mobileNumber), 10),  // Mobile (10)
      trunc(cleanAddr(addr1Raw), 40).toUpperCase(),        // Address 1 (40) - strip S/O: prefix
      trunc(addr2Raw, 40).toUpperCase(),                   // Address 2 (40)
      trunc(addr3Raw, 40).toUpperCase(),                   // Address 3 (40)
      trunc(safeString(user.permAddress?.city || user.address?.city), 30).toUpperCase(),  // City (30)
      stateCode,                                          // State Code (2)
      trunc(safeString(user.permAddress?.pincode || user.address?.pincode), 6),  // Pincode (6)
      "IN",                                               // Country Code (2)
      trunc(safeString(user.bankDetails?.accountNumber), 20),   // Bank Account Number (20)
      trunc(safeString(user.bankDetails?.ifscCode).toUpperCase(), 11),   // IFSC (11)
      trunc(safeString(user.bankDetails?.micrCode), 9),   // MICR (9)
      trunc(safeString(user.bankDetails?.bankName), 40).toUpperCase(),  // Bank Name (40)
      (user.bankDetails?.accountType || "SB").toUpperCase(), // Bank Account Type (2)
      trunc(safeString(user.bankDetails?.branchName), 40).toUpperCase(),  // Branch Name (40)
      user.noNominationFlag || (user.nominees?.length ? "N" : "Y"),  // No Nomination Flag (1)
      // Nominee 1 (all 8 fields blank when no nominee)
      nom1.name ? trunc(safeString(nom1.name), 40).toUpperCase() : "",
      nom1.name ? safeString(nom1.relation).toUpperCase() : "",
      nom1.name ? safeString(nom1.sharePercentage) : "",
      nom1.name ? safeString(nom1.dob) : "",
      nom1.name ? (nom1.isMinor || "N") : "",
      nom1.name ? trunc(safeString(nom1.pan), 10).toUpperCase() : "",
      nom1.name ? trunc(safeString(guard1.name), 40).toUpperCase() : "",
      nom1.name ? safeString(guard1.relation).toUpperCase() : "",
      // Nominee 2
      nom2.name ? trunc(safeString(nom2.name), 40).toUpperCase() : "",
      nom2.name ? safeString(nom2.relation).toUpperCase() : "",
      nom2.name ? safeString(nom2.sharePercentage) : "",
      nom2.name ? safeString(nom2.dob) : "",
      nom2.name ? (nom2.isMinor || "N") : "",
      nom2.name ? trunc(safeString(nom2.pan), 10).toUpperCase() : "",
      nom2.name ? trunc(safeString(guard2.name), 40).toUpperCase() : "",
      nom2.name ? safeString(guard2.relation).toUpperCase() : "",
      // Nominee 3
      nom3.name ? trunc(safeString(nom3.name), 40).toUpperCase() : "",
      nom3.name ? safeString(nom3.relation).toUpperCase() : "",
      nom3.name ? safeString(nom3.sharePercentage) : "",
      nom3.name ? safeString(nom3.dob) : "",
      nom3.name ? (nom3.isMinor || "N") : "",
      nom3.name ? trunc(safeString(nom3.pan), 10).toUpperCase() : "",
      nom3.name ? trunc(safeString(guard3.name), 40).toUpperCase() : "",
      nom3.name ? safeString(guard3.relation).toUpperCase() : "",
      user.signatureFile || "",
      user.photoFile || ""
    ].map(f => String(f || "").trim()).join("|");
    
    content += record + "\r\n";
  });
  
  // Trailer Record (03)
  content += `03|${cleanDpId}|${batchStr}|${String(userData.length).padStart(6, "0")}\r\n`;
  
  return { fileName, content };
};

/**
 * Generate BO Modify Upload File (11010900.00760)
 */
export const generateBOModifyFile = (userData, config) => {
  const { dpId, batchNumber, uploadDate = new Date(), uploadId = "11" } = config;
  const cleanDpId = String(dpId || "59100").trim().padStart(6, "0").slice(-6);
  const batchStr = String(batchNumber || "1").padStart(5, "0").slice(-5);
  const dateStr = formatDateDDMMYYYY(uploadDate);
  const fileName = `${uploadId}${cleanDpId}.${batchStr}`;
  
  let content = "";
  content += `01|${cleanDpId}|${batchStr}|${dateStr}|${String(userData.length).padStart(6, "0")}\r\n`;
  
  userData.forEach(user => {
    const record = [
      "02",
      cleanDpId,
      user.boId,
      user.modificationType || "01",
      user.email || "",
      user.mobile || user.mobile_number || ""
    ].map(f => String(f || "").trim()).join("|");
    content += record + "\r\n";
  });
  
  content += `03|${cleanDpId}|${batchStr}|${String(userData.length).padStart(6, "0")}\r\n`;
  
  return { fileName, content };
};

/**
 * Encrypt CDSL File Buffer using the remote Windows CDSL Encrypt Service.
 * The Node.js DES cipher does NOT produce correct output matching Encrypt.exe.
 * Encryption MUST be done via the native Windows Encrypt.exe binary.
 *
 * @param {Buffer} buffer - Raw CSV content as Buffer
 * @param {string} aesKey - Unused (kept for API compatibility)
 * @param {Object} options - { encryptServiceUrl, encryptServiceApiKey, fileName }
 * @returns {Promise<Buffer>} Encrypted buffer from Encrypt.exe
 */
export const encryptCdslBuffer = async (buffer, aesKey = "", options = {}) => {
  const encryptServiceUrl = options.encryptServiceUrl || process.env.CDSL_ENCRYPT_SERVICE_URL;
  const apiKey = options.encryptServiceApiKey || process.env.CDSL_ENCRYPT_SERVICE_API_KEY || "";
  const fileName = options.fileName || `temp_${Date.now()}`;

  if (!encryptServiceUrl) {
    throw new Error(
      "CDSL_ENCRYPT_SERVICE_URL is not configured. " +
      "CDSL encryption requires the native Windows Encrypt.exe binary. " +
      "Deploy the CDSL-ENCRYPT-SERVICE on a Windows machine and set the CDSL_ENCRYPT_SERVICE_URL environment variable."
    );
  }

  try {
    const { default: axios } = await import("axios");

    console.log(`🔒 [CDSL] Sending CSV to Windows Encrypt Service: ${encryptServiceUrl}/encrypt (${buffer.length} bytes)`);

    const headers = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const response = await axios.post(
      `${encryptServiceUrl.replace(/\/+$/, "")}/encrypt`,
      {
        csv: buffer.toString("utf8"),
        fileName: fileName,
      },
      {
        headers,
        responseType: "arraybuffer",
        timeout: 60000,
        maxContentLength: 100 * 1024 * 1024,
      }
    );

    const encryptedBuffer = Buffer.from(response.data);
    console.log(`🔒 [CDSL] ✅ Encrypted via Windows Encrypt Service (${buffer.length} -> ${encryptedBuffer.length} bytes)`);
    return encryptedBuffer;
  } catch (err) {
    const errMsg = err.response
      ? `Windows Encrypt Service returned ${err.response.status}: ${Buffer.isBuffer(err.response.data) ? err.response.data.toString("utf8").substring(0, 200) : JSON.stringify(err.response.data)}`
      : `Failed to connect to Windows Encrypt Service at ${encryptServiceUrl}: ${err.message}`;

    console.error("💥 [CDSL] Remote Encryption Error:", errMsg);
    throw new Error(`CDSL Remote Encryption Error: ${errMsg}`);
  }
};

/**
 * Create CDSL ZIP Archive from pre-generated UDiFF content + image attachments.
 * Per CDSL API Spec (CR1892 Page 5):
 * If DP is NOT opted for encryption:
 *   Main Upload File: 08010900.00760
 *   Upload ZIP File:  08010900.00760.zip
 * If DP is opted for encryption:
 *   Main Upload File: 08010900.00760.enc.34
 *   Upload ZIP File:  08010900.00760.enc.34.zip
 *
 * @param {string} content - The generated UDiFF content string
 * @param {string} fileName - The main file name (e.g. 08059100.76438)
 * @param {Array}  signatureFiles - Array of { name, buffer } image objects
 * @param {Object} options - { isEncrypted, encryptExtension, aesKey, encryptServiceUrl, encryptServiceApiKey }
 */
export const createBOSetupZip = async (content, fileName, signatureFiles, options = {}) => {
  const { isEncrypted = true, encryptExtension = ".CSV.ENC.00", aesKey = "" } = options;
  
  const mainFileNameInZip = isEncrypted ? `${fileName}${encryptExtension}` : fileName;
  const zipFileName = isEncrypted ? `${fileName}.csv.enc.00.zip` : `${fileName}.zip`;
  
  let mainFileBuf = Buffer.from(content, "utf8");
  if (isEncrypted) {
    mainFileBuf = await encryptCdslBuffer(mainFileBuf, aesKey, {
      encryptServiceUrl: options.encryptServiceUrl,
      encryptServiceApiKey: options.encryptServiceApiKey,
      fileName: fileName,
    });
  }
  
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const buffers = [];
    
    archive.on("data", data => buffers.push(data));
    archive.on("error", err => reject(err));
    archive.on("end", () => {
      const zipBuffer = Buffer.concat(buffers);
      resolve({ zipBuffer, fileName: zipFileName, mainFileName: mainFileNameInZip, content });
    });
    
    // Append main file at root of zip
    archive.append(mainFileBuf, { name: mainFileNameInZip });
    
    // Image files
    if (Array.isArray(signatureFiles)) {
      signatureFiles.forEach(file => {
        if (file && file.buffer) {
          archive.append(file.buffer, { name: file.name });
        }
      });
    }
    
    archive.finalize();
  });
};

/**
 * Validate UDiFF File
 */
export const validateUDiFFFile = (content) => {
  if (!content || typeof content !== "string") {
    return { isValid: false, errors: ["Empty content"] };
  }
  
  const lines = content.trim().split("\n");
  if (lines.length < 3) {
    return { isValid: false, errors: ["Insufficient records (Header/Trailer missing)"] };
  }
  
  if (!lines[0].startsWith("01")) {
    return { isValid: false, errors: ["Missing Header Record (01)"] };
  }
  
  if (!lines[lines.length - 1].startsWith("03")) {
    return { isValid: false, errors: ["Missing Trailer Record (03)"] };
  }
  
  return { isValid: true, errors: [] };
};

/**
 * Parse CDSL Response File
 */
export const parseCDSLResponseFile = (buffer) => {
  const content = buffer.toString("utf8");
  const lines = content.trim().split("\n");
  const records = [];
  
  lines.forEach(line => {
    const parts = line.split("|");
    if (parts[0] === "02") {
      const isSuccess = parts[parts.length - 1] === "00" || parts[parts.length - 1] === "A";
      records.push({
        status: isSuccess ? "SUCCESS" : "FAILED",
        boId: parts[2] || parts[6] || null,
        errorCode: !isSuccess ? parts[parts.length - 1] : null,
        raw: line
      });
    }
  });
  
  return {
    success: records.some(r => r.status === "SUCCESS"),
    records
  };
};

/**
 * Tunnel/proxy CDSL requests through the Windows VPS microservice when CDSL_PROXY_URL is set.
 * Enables full local development and testing of CDSL endpoints without whitelisting local IPs.
 */
export const sendCdslRequest = async (config, { url, method = "POST", jsonBody = null, zipFile = null, fields = null, headers: customHeaders = {} }) => {
  const proxyUrl = process.env.CDSL_PROXY_URL;
  const apiKey = process.env.CDSL_ENCRYPT_SERVICE_API_KEY || "abcde";
  const axios = (await import("axios")).default;

  const headers = {
    "x-api-key": apiKey
  };

  if (proxyUrl) {
    console.log(`[CDSL-PROXY] Forwarding CDSL Request through Windows Proxy to: ${url}`);
    const proxyPayload = {
      url,
      method,
      headers: {
        "Content-Type": zipFile ? "multipart/form-data" : "application/json",
        ...customHeaders
      }
    };

    if (zipFile) {
      proxyPayload.multipart = {
        fields,
        file: {
          fieldName: "file",
          filename: zipFile.filename,
          contentType: "application/zip",
          base64: zipFile.buffer.toString("base64"),
        }
      };
    } else {
      proxyPayload.jsonBody = jsonBody;
    }

    const response = await axios.post(proxyUrl, proxyPayload, { headers });
    return response;
  } else {
    console.log(`[CDSL-DIRECT] Calling CDSL directly: ${url}`);
    if (zipFile) {
      const FormData = (await import("form-data")).default;
      const formData = new FormData();
      formData.append("file", zipFile.buffer, {
        filename: zipFile.filename,
        contentType: "application/zip",
      });
      if (fields) {
        Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
      }

      return axios.post(url, formData, {
        headers: {
          ...formData.getHeaders(),
          ...customHeaders,
        },
      });
    } else {
      return axios.post(url, jsonBody, {
        headers: {
          "Content-Type": "application/json",
          ...customHeaders,
        },
      });
    }
  }
};
