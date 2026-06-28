// ---------------------------------------------------------------------------
// GSTIN validation — format check + state-code lookup.
// The full checksum is complex; format + state-code is sufficient for UX.
// Real authoritative validation goes via /api/gst/lookup (Appyflow / gst.gov.in).
// ---------------------------------------------------------------------------

export interface GstinResult {
  valid: boolean;
  gstin?: string;       // normalised uppercase
  stateCode?: string;
  stateName?: string;
  pan?: string;
  entityChar?: string;  // P=individual, C=company, F=firm, etc.
  error?: string;
}

// GST-registered states / UTs (Jan 2024)
export const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

const ENTITY_TYPES: Record<string, string> = {
  P: "Individual / Proprietor",
  C: "Company",
  F: "Firm / Partnership",
  A: "Association of Persons",
  T: "Trust / AOP-BOI",
  B: "Body of Individuals",
  L: "LLP",
  J: "Artificial Juridical Person",
  G: "Government",
  H: "HUF",
};

// GSTIN format: SS PPPPP NNNN C E Z D
// SS = 2-digit state code
// PPPPP = 5-letter PAN prefix (first 5 of PAN)
// NNNN = 4-digit PAN numeric
// C = PAN check char (entity type)
// E = entity count in state (1-9 or A-Z)
// Z = always Z
// D = checksum (0-9 or A-Z)
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function validateGstinFormat(raw: string): GstinResult {
  if (!raw || !raw.trim()) {
    return { valid: false, error: "GSTIN is required." };
  }
  const gstin = raw.trim().toUpperCase().replace(/\s/g, "");
  if (gstin.length !== 15) {
    return { valid: false, error: `GSTIN must be 15 characters (got ${gstin.length}).` };
  }
  if (!GSTIN_REGEX.test(gstin)) {
    return { valid: false, error: "GSTIN format is invalid. Expected: 29AACN1001P1ZA (2-digit state + 10-char PAN + 1+1+Z+1)." };
  }
  const stateCode = gstin.slice(0, 2);
  const stateName = GST_STATES[stateCode];
  if (!stateName) {
    return { valid: false, error: `Unknown state code "${stateCode}".` };
  }
  const pan = gstin.slice(2, 12);
  const entityChar = gstin[12];  // position 12 = entity type
  return {
    valid: true,
    gstin,
    stateCode,
    stateName,
    pan,
    entityChar,
  };
}

export function entityTypeName(char: string): string {
  return ENTITY_TYPES[char] ?? "Unknown";
}
