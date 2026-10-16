/**
 * Mapping utilities for CAMS KRA payload.
 * ALL codes sourced DIRECTLY from Master_data_eipvapi.xls:
 *  - Sheet "State Master"   → STATE_CODE / STATE_NAME
 *  - Sheet "Country Master" → Code / Description
 *
 * State codes are 3-digit zero-padded strings (e.g. "009" for Uttar Pradesh).
 * Country code for India = "101".
 */

// ─── State Code Map ───────────────────────────────────────────────────────────
// Exact values from "State Master" sheet.
// Keys: full name (lower case), ISO 2-letter abbreviation (upper case),
//       3-digit string (pass-through), 1 or 2-digit string (auto-padded)
const STATE_MAP = {
  // From Excel State Master (STATE_CODE : STATE_NAME)
  "jammu and kashmir":           "001",
  "himachal pradesh":            "002",
  "punjab":                      "003",
  "chandigarh":                  "004",
  "uttarakhand":                 "005",
  "uttaranchal":                 "005",
  "haryana":                     "006",
  "delhi":                       "007",
  "new delhi":                   "007",
  "rajasthan":                   "008",
  "uttar pradesh":               "009",
  "bihar":                       "010",
  "sikkim":                      "011",
  "arunachal pradesh":           "012",
  "assam":                       "013",
  "manipur":                     "014",
  "mizoram":                     "015",
  "tripura":                     "016",
  "meghalaya":                   "017",
  "nagaland":                    "018",
  "west bengal":                 "019",
  "jharkhand":                   "020",
  "odisha":                      "021",
  "orissa":                      "021",
  "chhattisgarh":                "022",
  "madhya pradesh":              "023",
  "gujarat":                     "024",
  "daman and diu":               "025",
  "daman & diu":                 "025",
  "dadra and nagar haveli":      "026",
  "dadra & nagar haveli":        "026",
  "maharashtra":                 "027",
  "andhra pradesh":              "028",
  "karnataka":                   "029",
  "goa":                         "030",
  "lakshadweep":                 "031",
  "kerala":                      "032",
  "tamil nadu":                  "033",
  "puducherry":                  "034",
  "pondicherry":                 "034",
  "andaman and nicobar islands": "035",
  "andaman & nicobar":           "035",
  "andaman and nicobar":         "035",
  "telangana":                   "037",
  "others":                      "099",

  // ── ISO 2-letter abbreviations ────────────────────────────────────────────
  "JK": "001",
  "HP": "002",
  "PB": "003",
  "CH": "004",
  "UK": "005",
  "UT": "005",
  "UA": "005",
  "HR": "006",
  "DL": "007",
  "RJ": "008",
  "UP": "009",
  "BR": "010",
  "SK": "011",
  "AR": "012",
  "AS": "013",
  "MN": "014",
  "MZ": "015",
  "TR": "016",
  "ML": "017",
  "NL": "018",
  "WB": "019",
  "JH": "020",
  "OD": "021",
  "OR": "021",
  "CG": "022",
  "CT": "022",
  "MP": "023",
  "GJ": "024",
  "DD": "025",
  "DN": "026",
  "MH": "027",
  "AP": "028",
  "KA": "029",
  "GA": "030",
  "LD": "031",
  "KL": "032",
  "TN": "033",
  "PY": "034",
  "AN": "035",
  "TG": "037",
  "TS": "037",

  // ── Numeric code pass-throughs (2-digit DB value → 3-digit) ──────────────
  "1":  "001", "01": "001", "001": "001",
  "2":  "002", "02": "002", "002": "002",
  "3":  "003", "03": "003", "003": "003",
  "4":  "004", "04": "004", "004": "004",
  "5":  "005", "05": "005", "005": "005",
  "6":  "006", "06": "006", "006": "006",
  "7":  "007", "07": "007", "007": "007",
  "8":  "008", "08": "008", "008": "008",
  "9":  "009", "09": "009", "009": "009",
  "10": "010", "010": "010",
  "11": "011", "011": "011",
  "12": "012", "012": "012",
  "13": "013", "013": "013",
  "14": "014", "014": "014",
  "15": "015", "015": "015",
  "16": "016", "016": "016",
  "17": "017", "017": "017",
  "18": "018", "018": "018",
  "19": "019", "019": "019",
  "20": "020", "020": "020",
  "21": "021", "021": "021",
  "22": "022", "022": "022",
  "23": "023", "023": "023",
  "24": "024", "024": "024",
  "25": "025", "025": "025",
  "26": "026", "026": "026",
  "27": "027", "027": "027",
  "28": "028", "028": "028",
  "29": "029", "029": "029",
  "30": "030", "030": "030",
  "31": "031", "031": "031",
  "32": "032", "032": "032",
  "33": "033", "033": "033",
  "34": "034", "034": "034",
  "35": "035", "035": "035",
  "37": "037", "037": "037",
  "99": "099", "099": "099",
};

// ─── Country Code Map ─────────────────────────────────────────────────────────
// Exact values from "Country Master" sheet. India = "101".
// Keys: country name (lower case), ISO 2-letter code (upper case), numeric string
const COUNTRY_MAP = {
  "india":        "101",
  "IN":           "101",
  "IND":          "101",
  "101":          "101",
  "100":          "101", // some DBs store 100 for India
  // Common ones for NRI
  "united states":          "232",
  "usa":                    "232",
  "US":                     "232",
  "united kingdom":         "233",
  "UK":                     "233",
  "GB":                     "233",
  "canada":                 "039",
  "CA":                     "039",
  "australia":              "014",
  "AU":                     "014",
  "singapore":              "196",
  "SG":                     "196",
  "uae":                    "230",
  "united arab emirates":   "230",
  "AE":                     "230",
  "germany":                "079",
  "DE":                     "079",
};

/**
 * Convert a DB state code to the KRA 3-digit state code.
 * Source: "State Master" sheet of Master_data_eipvapi.xls
 *
 * @param {string|number} dbCode - Code stored in your DB (name, ISO 2-letter, or numeric)
 * @param {string} [fallback="099"] - Fallback when not found ("099" = Others)
 * @returns {string} 3-digit KRA state code
 */
export function getKraStateCode(dbCode, fallback = "099") {
  if (!dbCode) return fallback;
  const raw = String(dbCode).trim();
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();

  // Already 3-digit numeric → return directly
  if (/^\d{3}$/.test(raw)) return STATE_MAP[raw] || raw;

  // ISO abbreviation lookup
  if (STATE_MAP[upper] !== undefined) return STATE_MAP[upper];

  // Full name lookup (case-insensitive)
  if (STATE_MAP[lower] !== undefined) return STATE_MAP[lower];

  // 1 or 2-digit numeric
  if (/^\d{1,2}$/.test(raw)) {
    const key = raw.padStart(1, "");
    if (STATE_MAP[key] !== undefined) return STATE_MAP[key];
  }

  console.warn(`[KRA Mapping] Unknown state code: "${dbCode}", using fallback "${fallback}"`);
  return fallback;
}

/**
 * Convert a DB country code to the KRA 3-digit country code.
 * Source: "Country Master" sheet of Master_data_eipvapi.xls
 * India = "101"
 *
 * @param {string|number} dbCode - Country code/name stored in DB
 * @param {string} [fallback="101"] - Default = India
 * @returns {string} 3-digit KRA country code
 */
export function getKraCountryCode(dbCode, fallback = "101") {
  if (!dbCode) return fallback;
  const raw = String(dbCode).trim();
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();

  // Already 3-digit numeric → return directly
  if (/^\d{3}$/.test(raw)) return COUNTRY_MAP[raw] || raw;

  // ISO 2-letter or numeric key
  if (COUNTRY_MAP[upper] !== undefined) return COUNTRY_MAP[upper];

  // Full name
  if (COUNTRY_MAP[lower] !== undefined) return COUNTRY_MAP[lower];

  console.warn(`[KRA Mapping] Unknown country code: "${dbCode}", using fallback "${fallback}"`);
  return fallback;
}
