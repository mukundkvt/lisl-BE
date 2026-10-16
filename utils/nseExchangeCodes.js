import fs from "fs";
import { statesWithDistricts } from "./State_districts.js";

const nseCountryMap = JSON.parse(
  fs.readFileSync(new URL("./nse_country_map.json", import.meta.url), "utf-8")
);

/**
 * NSE Exchange UCI State Mappings as per Annexure 2
 * Document: TDD-UCI External interface.docx (Ver. 1.9)
 * States: Codes 1 - 35, 37 (Telangana), 38 (Ladakh), 98 (APO), 99 (Others)
 */
export const NSE_STATE_CODES = {
  // Direct numeric codes
  "1": "1", "01": "1",
  "2": "2", "02": "2",
  "3": "3", "03": "3",
  "4": "4", "04": "4",
  "5": "5", "05": "5",
  "6": "6", "06": "6",
  "7": "7", "07": "7",
  "8": "8", "08": "8",
  "9": "9", "09": "9",
  "10": "10",
  "11": "11",
  "12": "12",
  "13": "13",
  "14": "14",
  "15": "15",
  "16": "16",
  "17": "17",
  "18": "18",
  "19": "19",
  "20": "20",
  "21": "21",
  "22": "22",
  "23": "23",
  "24": "24",
  "25": "25",
  "26": "26",
  "27": "27",
  "28": "28",
  "29": "29",
  "30": "30",
  "31": "31",
  "32": "32",
  "33": "33",
  "34": "34",
  "35": "35",
  "37": "37",
  "38": "38",
  "98": "98",
  "99": "99",

  // State Names & Abbreviations (Annexure 2)
  "ANDAMAN & NICOBAR ISLANDS": "1",
  "ANDAMAN AND NICOBAR ISLANDS": "1",
  "ANDAMAN & NICOBAR": "1",
  "AN": "1",

  "ANDHRA PRADESH": "2",
  "AP": "2",

  "ARUNACHAL PRADESH": "3",
  "AR": "3",

  "ASSAM": "4",
  "AS": "4",

  "BIHAR": "5",
  "BR": "5",

  "CHANDIGARH": "6",
  "CH": "6",

  "DADRA & NAGAR HAVELI": "7",
  "DADRA AND NAGAR HAVELI": "7",
  "DN": "7",

  "DAMAN & DIU": "8",
  "DAMAN AND DIU": "8",
  "DD": "8",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "7",

  "DELHI": "9",
  "NEW DELHI": "9",
  "NCT OF DELHI": "9",
  "DL": "9",

  "GOA": "10",
  "GA": "10",

  "GUJARAT": "11",
  "GJ": "11",

  "HARYANA": "12",
  "HR": "12",

  "HIMACHAL PRADESH": "13",
  "HP": "13",

  "JAMMU & KASHMIR": "14",
  "JAMMU AND KASHMIR": "14",
  "JK": "14",

  "KARNATAKA": "15",
  "KA": "15",

  "KERALA": "16",
  "KL": "16",

  "LAKHSWADEEP": "17",
  "LAKSHADWEEP": "17",
  "LD": "17",

  "MADHYA PRADESH": "18",
  "MP": "18",

  "MAHARASHTRA": "19",
  "MH": "19",

  "MANIPUR": "20",
  "MN": "20",

  "MEGHALAYA": "21",
  "ML": "21",

  "MIZORAM": "22",
  "MZ": "22",

  "NAGALAND": "23",
  "NL": "23",

  "ORISSA": "24",
  "ODISHA": "24",
  "OR": "24",
  "OD": "24",

  "PONDICHERRY": "25",
  "PUDUCHERRY": "25",
  "PY": "25",

  "PUNJAB": "26",
  "PB": "26",

  "RAJASTHAN": "27",
  "RJ": "27",

  "SIKKIM": "28",
  "SK": "28",

  "TAMIL NADU": "29",
  "TN": "29",

  "TRIPURA": "30",
  "TR": "30",

  "UTTAR PRADESH": "31",
  "UP": "31",

  "WEST BENGAL": "32",
  "WB": "32",

  "CHHATTISGARH": "33",
  "CG": "33",
  "CT": "33",

  "UTTARANCHAL": "34",
  "UTTARAKHAND": "34",
  "UK": "34",
  "UA": "34",

  "JHARKHAND": "35",
  "JH": "35",

  "TELANGANA": "37",
  "TS": "37",
  "TG": "37",

  "LADAKH": "38",
  "LA": "38",

  "APO": "98",
  "OTHERS": "99",
};

export const NSE_COUNTRY_CODES = nseCountryMap;

/**
 * Maps a state name or code to the official NSE Annexure 2 state code.
 * If not recognized or if '99', returns stateCode '99' and stateOth with state name.
 *
 * @param {string} stateName - e.g. "UTTAR PRADESH", "Maharashtra", "UP"
 * @param {string} stateCode - e.g. "UP", "MH", "31"
 * @returns {{ stateCode: string, stateOth: string }}
 */
export const mapStateToNSE = (stateName, stateCode) => {
  const codeRaw = String(stateCode || "").trim().toUpperCase();
  const nameRaw = String(stateName || "").trim().toUpperCase();

  // 1. Direct match on state code if in NSE_STATE_CODES
  if (codeRaw && NSE_STATE_CODES[codeRaw]) {
    const matched = NSE_STATE_CODES[codeRaw];
    return {
      stateCode: matched,
      stateOth: matched === "99" ? (nameRaw || codeRaw || "NOT APPLICABLE").substring(0, 75) : "",
    };
  }

  // 2. Direct match on state name
  if (nameRaw && NSE_STATE_CODES[nameRaw]) {
    const matched = NSE_STATE_CODES[nameRaw];
    return {
      stateCode: matched,
      stateOth: matched === "99" ? nameRaw.substring(0, 75) : "",
    };
  }

  // 3. Match via statesWithDistricts helper
  const found = statesWithDistricts.find(
    (s) =>
      s.state.toUpperCase() === nameRaw ||
      s.state_short.toUpperCase() === codeRaw ||
      s.state_short.toUpperCase() === nameRaw,
  );
  if (found) {
    const mapped = NSE_STATE_CODES[found.state.toUpperCase()] || NSE_STATE_CODES[found.state_short.toUpperCase()];
    if (mapped) {
      return {
        stateCode: mapped,
        stateOth: mapped === "99" ? nameRaw.substring(0, 75) : "",
      };
    }
  }

  // 4. Default if empty: default to UP ("31") for domestic users
  if (!nameRaw && !codeRaw) {
    return { stateCode: "31", stateOth: "" };
  }

  // 5. If specified but unmapped, map to "99" (Others) as per Annexure 2
  const otherVal = (nameRaw || codeRaw || "NOT APPLICABLE").substring(0, 75);
  return {
    stateCode: "99",
    stateOth: otherVal.length < 3 ? (otherVal + "   ").substring(0, 3) : otherVal,
  };
};

/**
 * Maps a country name or code to the official NSE Annexure 3 country code.
 * Defaults to "85" (India).
 *
 * @param {string} countryName - e.g. "INDIA", "India"
 * @param {string} countryCode - e.g. "IN", "IND", "85"
 * @returns {string} Country code numeric string (min 1, max 3 chars)
 */
export const mapCountryToNSE = (countryName, countryCode) => {
  const codeRaw = String(countryCode || "").trim().toUpperCase();
  const nameRaw = String(countryName || "").trim().toUpperCase();

  // If already a numeric code between 1 and 258
  if (/^\d{1,3}$/.test(codeRaw)) {
    const n = parseInt(codeRaw, 10);
    if (n >= 1 && n <= 258) return String(n);
  }

  if (codeRaw && NSE_COUNTRY_CODES[codeRaw]) {
    return NSE_COUNTRY_CODES[codeRaw];
  }

  if (nameRaw && NSE_COUNTRY_CODES[nameRaw]) {
    return NSE_COUNTRY_CODES[nameRaw];
  }

  // Default to India ("85")
  return "85";
};
