/**
 * Reference data for the seed (§14–15 of the build brief).
 * Airport figures are compiled from public AIP/aeronautical sources and are
 * REFERENCE VALUES — the UI labels them "confirm against CAAB AIP".
 * Thresholds are computed from the reference point ± length/2 along the
 * runway true bearing and stored with approximate = true.
 */

export interface SeedAirport {
  icao: string;
  iata: string;
  name: string;
  nameBn: string;
  city: string;
  elevationM: number;
  referenceLat: number;
  referenceLon: number;
  runway: {
    designator: string; // lower designator first, e.g. "14/32"
    code: number;
    approachType:
      | "NON_INSTRUMENT"
      | "NON_PRECISION"
      | "PRECISION_I"
      | "PRECISION_II"
      | "PRECISION_III";
    lengthM: number;
    trueBearingDeg: number; // bearing of the lower designator × 10
  };
  navaids: Array<{
    type: "VOR" | "DME" | "ILS_GP" | "ILS_LOC" | "NDB";
    name: string;
    // offset from the reference point: bearing (deg true) and distance (m)
    bearingDeg: number;
    distanceM: number;
    protectionRadiusM: number;
    note: string;
  }>;
}

export const SEED_AIRPORTS: SeedAirport[] = [
  {
    icao: "VGHS",
    iata: "DAC",
    name: "Hazrat Shahjalal International Airport",
    nameBn: "হযরত শাহজালাল আন্তর্জাতিক বিমানবন্দর",
    city: "Dhaka",
    elevationM: 8,
    referenceLat: 23.8433,
    referenceLon: 90.3978,
    runway: {
      designator: "14/32",
      code: 4,
      approachType: "PRECISION_I",
      lengthM: 3200,
      trueBearingDeg: 140,
    },
    navaids: [
      { type: "VOR", name: "DAC VOR/DME", bearingDeg: 200, distanceM: 1400, protectionRadiusM: 600, note: "Representative safeguarding radius — confirm against CAAB AIP" },
      { type: "ILS_GP", name: "ILS GP RWY 14", bearingDeg: 320, distanceM: 1250, protectionRadiusM: 300, note: "Glide path antenna, RWY 14 side" },
      { type: "ILS_LOC", name: "ILS LOC RWY 14", bearingDeg: 140, distanceM: 1900, protectionRadiusM: 450, note: "Localizer beyond RWY 32 end" },
      { type: "NDB", name: "HS NDB", bearingDeg: 20, distanceM: 2600, protectionRadiusM: 300, note: "Locator" },
    ],
  },
  {
    icao: "VGTJ",
    iata: "",
    name: "Tejgaon Airport",
    nameBn: "তেজগাঁও বিমানবন্দর",
    city: "Dhaka",
    elevationM: 7,
    referenceLat: 23.7783,
    referenceLon: 90.3828,
    runway: {
      designator: "18/36",
      code: 4,
      approachType: "NON_INSTRUMENT",
      lengthM: 2400,
      trueBearingDeg: 180,
    },
    navaids: [
      { type: "NDB", name: "TJ NDB", bearingDeg: 90, distanceM: 900, protectionRadiusM: 300, note: "Representative — military aerodrome" },
    ],
  },
  {
    icao: "VGEG",
    iata: "CGP",
    name: "Shah Amanat International Airport",
    nameBn: "শাহ আমানত আন্তর্জাতিক বিমানবন্দর",
    city: "Chattogram",
    elevationM: 4,
    referenceLat: 22.2496,
    referenceLon: 91.8133,
    runway: {
      designator: "05/23",
      code: 4,
      approachType: "PRECISION_I",
      lengthM: 2940,
      trueBearingDeg: 50,
    },
    navaids: [
      { type: "VOR", name: "CTG VOR/DME", bearingDeg: 120, distanceM: 1100, protectionRadiusM: 600, note: "Representative safeguarding radius — confirm against CAAB AIP" },
      { type: "ILS_GP", name: "ILS GP RWY 05", bearingDeg: 230, distanceM: 1200, protectionRadiusM: 300, note: "Glide path antenna, RWY 05 side" },
      { type: "ILS_LOC", name: "ILS LOC RWY 05", bearingDeg: 50, distanceM: 1750, protectionRadiusM: 450, note: "Localizer beyond RWY 23 end" },
    ],
  },
  {
    icao: "VGSY",
    iata: "ZYL",
    name: "Osmani International Airport",
    nameBn: "ওসমানী আন্তর্জাতিক বিমানবন্দর",
    city: "Sylhet",
    elevationM: 15,
    referenceLat: 24.9633,
    referenceLon: 91.8667,
    runway: {
      designator: "11/29",
      code: 4,
      approachType: "PRECISION_I",
      lengthM: 3125,
      trueBearingDeg: 110,
    },
    navaids: [
      { type: "VOR", name: "SYL VOR/DME", bearingDeg: 250, distanceM: 1300, protectionRadiusM: 600, note: "Representative safeguarding radius — confirm against CAAB AIP" },
      { type: "ILS_GP", name: "ILS GP RWY 11", bearingDeg: 290, distanceM: 1250, protectionRadiusM: 300, note: "Glide path antenna, RWY 11 side" },
      { type: "NDB", name: "SY NDB", bearingDeg: 60, distanceM: 2100, protectionRadiusM: 300, note: "Locator" },
    ],
  },
  {
    icao: "VGCB",
    iata: "CXB",
    name: "Cox's Bazar Airport",
    nameBn: "কক্সবাজার বিমানবন্দর",
    city: "Cox's Bazar",
    elevationM: 4,
    referenceLat: 21.4522,
    referenceLon: 91.9639,
    runway: {
      designator: "17/35",
      code: 4,
      approachType: "NON_PRECISION",
      lengthM: 3300,
      trueBearingDeg: 170,
    },
    navaids: [
      { type: "NDB", name: "CB NDB", bearingDeg: 350, distanceM: 1500, protectionRadiusM: 300, note: "NDB approach — representative radius" },
      { type: "DME", name: "CXB DME", bearingDeg: 80, distanceM: 800, protectionRadiusM: 300, note: "Representative" },
    ],
  },
  {
    icao: "VGJR",
    iata: "JSR",
    name: "Jashore Airport",
    nameBn: "যশোর বিমানবন্দর",
    city: "Jashore",
    elevationM: 6,
    referenceLat: 23.1838,
    referenceLon: 89.1608,
    runway: {
      designator: "16/34",
      code: 4,
      approachType: "NON_PRECISION",
      lengthM: 2400,
      trueBearingDeg: 160,
    },
    navaids: [
      { type: "VOR", name: "JSR VOR/DME", bearingDeg: 100, distanceM: 950, protectionRadiusM: 600, note: "VOR approach — representative radius" },
      { type: "NDB", name: "JR NDB", bearingDeg: 340, distanceM: 1800, protectionRadiusM: 300, note: "Locator" },
    ],
  },
  {
    icao: "VGRJ",
    iata: "RJH",
    name: "Shah Makhdum Airport",
    nameBn: "শাহ মখদুম বিমানবন্দর",
    city: "Rajshahi",
    elevationM: 20,
    referenceLat: 24.4372,
    referenceLon: 88.6165,
    runway: {
      designator: "17/35",
      code: 3,
      approachType: "NON_PRECISION",
      lengthM: 1830,
      trueBearingDeg: 170,
    },
    navaids: [
      { type: "VOR", name: "RAJ VOR", bearingDeg: 70, distanceM: 850, protectionRadiusM: 600, note: "VOR/NDB approach — representative radius" },
      { type: "NDB", name: "RJ NDB", bearingDeg: 200, distanceM: 1200, protectionRadiusM: 300, note: "Locator" },
    ],
  },
];

// ───────────────────────── Approving authorities (§14, real) ─────────────────────────

export interface SeedAuthority {
  name: string;
  nameBn: string;
  code: string;
  city: string; // maps to airport cities; "National" covers all
}

export const SEED_AUTHORITIES: SeedAuthority[] = [
  { name: "Rajdhani Unnayan Kartripakkha (RAJUK)", nameBn: "রাজধানী উন্নয়ন কর্তৃপক্ষ (রাজউক)", code: "RAJUK", city: "Dhaka" },
  { name: "Dhaka North City Corporation", nameBn: "ঢাকা উত্তর সিটি কর্পোরেশন", code: "DNCC", city: "Dhaka" },
  { name: "Dhaka South City Corporation", nameBn: "ঢাকা দক্ষিণ সিটি কর্পোরেশন", code: "DSCC", city: "Dhaka" },
  { name: "Chattogram Development Authority (CDA)", nameBn: "চট্টগ্রাম উন্নয়ন কর্তৃপক্ষ (সিডিএ)", code: "CDA", city: "Chattogram" },
  { name: "Chattogram City Corporation", nameBn: "চট্টগ্রাম সিটি কর্পোরেশন", code: "CCC", city: "Chattogram" },
  { name: "Sylhet Development Authority", nameBn: "সিলেট উন্নয়ন কর্তৃপক্ষ", code: "SDA", city: "Sylhet" },
  { name: "Sylhet City Corporation", nameBn: "সিলেট সিটি কর্পোরেশন", code: "SCC", city: "Sylhet" },
  { name: "Cox's Bazar Development Authority", nameBn: "কক্সবাজার উন্নয়ন কর্তৃপক্ষ", code: "CXDA", city: "Cox's Bazar" },
  { name: "Cox's Bazar Municipality", nameBn: "কক্সবাজার পৌরসভা", code: "CXM", city: "Cox's Bazar" },
  { name: "Jashore Municipality (Pourashava)", nameBn: "যশোর পৌরসভা", code: "JSM", city: "Jashore" },
  { name: "Rajshahi Development Authority (RDA)", nameBn: "রাজশাহী উন্নয়ন কর্তৃপক্ষ (আরডিএ)", code: "RDA", city: "Rajshahi" },
  { name: "Rajshahi City Corporation", nameBn: "রাজশাহী সিটি কর্পোরেশন", code: "RCC", city: "Rajshahi" },
  { name: "Public Works Department (PWD)", nameBn: "গণপূর্ত অধিদপ্তর", code: "PWD", city: "National" },
  { name: "Bangladesh Hi-Tech Park Authority", nameBn: "বাংলাদেশ হাই-টেক পার্ক কর্তৃপক্ষ", code: "BHTPA", city: "National" },
];

// ───────────────────────── Applicant organizations (realistic) ─────────────────────────

export interface SeedApplicant {
  name: string;
  kind: "developer" | "telecom" | "industrial" | "utility" | "government";
  city: string;
  tradeLicense: string;
}

export const SEED_APPLICANTS: SeedApplicant[] = [
  { name: "bti (Building Technology & Ideas Ltd.)", kind: "developer", city: "Dhaka", tradeLicense: "TRAD/DHK/013845" },
  { name: "Sheltech (Pvt.) Ltd.", kind: "developer", city: "Dhaka", tradeLicense: "TRAD/DHK/009214" },
  { name: "Navana Real Estate Ltd.", kind: "developer", city: "Dhaka", tradeLicense: "TRAD/DHK/011672" },
  { name: "Concord Real Estate & Development Ltd.", kind: "developer", city: "Dhaka", tradeLicense: "TRAD/DHK/007558" },
  { name: "Rangs Properties Ltd.", kind: "developer", city: "Dhaka", tradeLicense: "TRAD/DHK/012390" },
  { name: "Shanta Holdings Ltd.", kind: "developer", city: "Dhaka", tradeLicense: "TRAD/DHK/015127" },
  { name: "Assurance Developments Ltd.", kind: "developer", city: "Dhaka", tradeLicense: "TRAD/DHK/014006" },
  { name: "Building For Future Ltd.", kind: "developer", city: "Chattogram", tradeLicense: "TRAD/CTG/004481" },
  { name: "Edison Real Estate Ltd.", kind: "developer", city: "Dhaka", tradeLicense: "TRAD/DHK/016233" },
  { name: "Equity Property Management Ltd.", kind: "developer", city: "Chattogram", tradeLicense: "TRAD/CTG/005190" },
  { name: "Grameenphone Ltd.", kind: "telecom", city: "Dhaka", tradeLicense: "BIN-000512473-0201" },
  { name: "Robi Axiata Ltd.", kind: "telecom", city: "Dhaka", tradeLicense: "BIN-000318826-0402" },
  { name: "Banglalink Digital Communications Ltd.", kind: "telecom", city: "Dhaka", tradeLicense: "BIN-000242551-0703" },
  { name: "edotco Bangladesh Co. Ltd.", kind: "telecom", city: "Dhaka", tradeLicense: "BIN-000629914-0504" },
  { name: "Summit Communications Ltd.", kind: "telecom", city: "Dhaka", tradeLicense: "BIN-000455317-0605" },
  { name: "Sinha Textile Mills Ltd.", kind: "industrial", city: "Dhaka", tradeLicense: "TRAD/NAR/002319" },
  { name: "Power Grid Company of Bangladesh (PGCB)", kind: "utility", city: "Dhaka", tradeLicense: "GOV-PGCB-1996" },
  { name: "Dhaka WASA", kind: "utility", city: "Dhaka", tradeLicense: "GOV-DWASA-1963" },
  { name: "Youngone Corporation (KEPZ)", kind: "industrial", city: "Chattogram", tradeLicense: "TRAD/CTG/003887" },
  { name: "Pran-RFL Group", kind: "industrial", city: "Rajshahi", tradeLicense: "TRAD/RAJ/001204" },
];

// ───────────────────────── Structure types ─────────────────────────

export const SEED_STRUCTURE_TYPES: Array<{ name: string; nameBn: string }> = [
  { name: "Residential Building", nameBn: "আবাসিক ভবন" },
  { name: "Commercial Building", nameBn: "বাণিজ্যিক ভবন" },
  { name: "Mixed-use Building", nameBn: "মিশ্র ব্যবহার ভবন" },
  { name: "Telecom Tower (Greenfield)", nameBn: "টেলিকম টাওয়ার (গ্রিনফিল্ড)" },
  { name: "Telecom Tower (Rooftop)", nameBn: "টেলিকম টাওয়ার (রুফটপ)" },
  { name: "Industrial Chimney", nameBn: "শিল্প চিমনি" },
  { name: "Water Tank (Overhead)", nameBn: "উচ্চ জলাধার" },
  { name: "Transmission Line Tower", nameBn: "সঞ্চালন লাইন টাওয়ার" },
  { name: "Communication Mast", nameBn: "যোগাযোগ মাস্তুল" },
  { name: "Construction Crane (Temporary)", nameBn: "নির্মাণ ক্রেন (অস্থায়ী)" },
  { name: "Silo / Storage Structure", nameBn: "সাইলো / সংরক্ষণ স্থাপনা" },
];

// ───────────────────────── Localities near each airport (real) ─────────────────────────

export const LOCALITIES: Record<string, string[]> = {
  VGHS: [
    "Uttara Sector 1, Dhaka",
    "Uttara Sector 4, Dhaka",
    "Uttara Sector 7, Dhaka",
    "Uttara Sector 11, Dhaka",
    "Dakshinkhan, Dhaka",
    "Ashkona, Dakshinkhan, Dhaka",
    "Nikunja 2, Khilkhet, Dhaka",
    "Khilkhet, Dhaka",
    "Joar Sahara, Vatara, Dhaka",
    "Baridhara DOHS, Dhaka",
    "Kawla, Airport Road, Dhaka",
    "Uttarkhan, Dhaka",
  ],
  VGTJ: [
    "Tejgaon Industrial Area, Dhaka",
    "Farmgate, Tejgaon, Dhaka",
    "Mohakhali, Dhaka",
    "Niketan, Gulshan, Dhaka",
    "Nakhalpara, Tejgaon, Dhaka",
    "Karwan Bazar, Dhaka",
  ],
  VGEG: [
    "Patenga, Chattogram",
    "North Patenga, Chattogram",
    "Chattogram EPZ, Chattogram",
    "South Halishahar, Chattogram",
    "Katgor, Patenga, Chattogram",
    "Steel Mill Bazar, Chattogram",
    "Airport Road, Patenga, Chattogram",
  ],
  VGSY: [
    "Airport Road, Sylhet",
    "Chowkidekhi, Sylhet",
    "Ambarkhana, Sylhet",
    "Khadimnagar, Sylhet",
    "Lakkatura, Sylhet",
    "Baluchar, Sylhet",
  ],
  VGCB: [
    "Kolatoli, Cox's Bazar",
    "Jhilwanja, Cox's Bazar",
    "Khurushkul, Cox's Bazar",
    "Baharchhara, Cox's Bazar",
    "Samiti Para, Cox's Bazar",
    "Nuniachhara, Cox's Bazar",
  ],
  VGJR: [
    "Arabpur, Jashore",
    "Chanchra, Jashore",
    "Upashahar, Jashore",
    "Jhumjhumpur, Jashore",
    "Shankarpur, Jashore",
  ],
  VGRJ: [
    "Nowhata, Rajshahi",
    "Shalbagan, Rajshahi",
    "Uposhohor, Rajshahi",
    "Pabna Road, Rajshahi",
    "Katakhali, Rajshahi",
  ],
};

// Ground elevation bands per airport city (m AMSL, realistic ranges)
export const GROUND_ELEV: Record<string, [number, number]> = {
  VGHS: [5, 9],
  VGTJ: [5, 8],
  VGEG: [2, 8],
  VGSY: [10, 20],
  VGCB: [2, 6],
  VGJR: [5, 8],
  VGRJ: [18, 24],
};
