// ============================================================
// Florida property-tax (millage) rate table — shared by the
// Buyer's and Seller's Net Sheets.
//
// Rates are TOTAL millage as a % of value (county + school + city +
// special districts). This is the basis title companies use: at a sale the
// assessed value resets to ~purchase price with no homestead cap in year one,
// so the first-year tax ≈ price × this rate.
//
// • FL_CITY_TAX_RATES — exact rates by county→city. Orange County values are
//   from The Liz Team's title company schedule (authoritative). Add more
//   counties/cities here as the full statewide schedule is loaded.
// • FL_COUNTY_TAX_RATES — county-level fallback (unincorporated / city not
//   listed). Verified where noted; others are ESTIMATES — adjust per property.
// ============================================================

export const FL_DEFAULT_TAX_RATE = 1.85; // FL typical total millage when nothing matches

// Exact city rates, nested by normalized county → normalized city.
export const FL_CITY_TAX_RATES = {
  orange: {
    orlando: 2.125,
    apopka: 1.707,
    "bay lake": 2.732,
    "belle isle": 1.807,
    "lake buena vista": 1.714,
    ocoee: 2.017,
    "winter garden": 1.785,
    "winter park": 1.762,
  },
};

// County-level fallback (total millage %, unincorporated / typical).
// Orange (1.859) is the title company's "Mainland" figure. Others are estimates.
export const FL_COUNTY_TAX_RATES = {
  alachua: 2.00, baker: 1.80, bay: 1.40, bradford: 1.90, brevard: 1.55,
  broward: 1.95, calhoun: 1.70, charlotte: 1.50, citrus: 1.30, clay: 1.70,
  collier: 1.05, columbia: 1.70, desoto: 1.90, dixie: 1.60, duval: 1.85,
  escambia: 1.70, flagler: 1.60, franklin: 1.20, gadsden: 2.00, gilchrist: 1.60,
  glades: 1.70, gulf: 1.30, hamilton: 1.80, hardee: 1.70, hendry: 2.00,
  hernando: 1.70, highlands: 1.60, hillsborough: 1.95, holmes: 1.50,
  "indian river": 1.40, jackson: 1.60, jefferson: 1.90, lafayette: 1.50,
  lake: 1.80, lee: 1.55, leon: 2.00, levy: 1.60, liberty: 1.70, madison: 1.90,
  manatee: 1.50, marion: 1.60, martin: 1.30, "miami-dade": 1.95, "miami dade": 1.95,
  monroe: 1.00, nassau: 1.60, okaloosa: 1.30, okeechobee: 1.90, orange: 1.859,
  osceola: 1.95, "palm beach": 1.90, pasco: 1.95, pinellas: 1.70, polk: 1.80,
  putnam: 1.80, "santa rosa": 1.40, sarasota: 1.30, seminole: 1.85,
  "st. johns": 1.40, "st johns": 1.40, "st. lucie": 2.10, "st lucie": 2.10,
  sumter: 1.40, suwannee: 1.70, taylor: 1.70, union: 1.90, volusia: 1.85,
  wakulla: 1.70, walton: 1.00, washington: 1.60,
};

export function normalizeName(s) {
  return String(s || "").replace(/county/i, "").trim().toLowerCase();
}

// Best available total-millage rate (% of value) for a city/county.
// City match (exact) → county fallback → statewide default.
export function flTaxRate(city, county) {
  const co = normalizeName(county);
  const ci = normalizeName(city);
  if (co && FL_CITY_TAX_RATES[co] && FL_CITY_TAX_RATES[co][ci] != null) {
    return { rate: FL_CITY_TAX_RATES[co][ci], source: "city" };
  }
  if (co && FL_COUNTY_TAX_RATES[co] != null) {
    return { rate: FL_COUNTY_TAX_RATES[co], source: "county" };
  }
  return { rate: FL_DEFAULT_TAX_RATE, source: "default" };
}

// FL counties where the BUYER customarily pays for the owner's title policy.
// Everywhere else the seller customarily pays. (Mixed/either in a few counties;
// these are the well-established buyer-pays counties.)
export const BUYER_PAYS_OWNER_TITLE_COUNTIES = new Set([
  "miami-dade", "miami dade", "broward", "sarasota", "collier",
]);
export function buyerPaysOwnerTitleDefault(county) {
  return BUYER_PAYS_OWNER_TITLE_COUNTIES.has(normalizeName(county));
}

// FL deed documentary-stamp rate per $100 of price. Miami-Dade is $0.60 on a
// single-family residence; the rest of FL is $0.70.
export function deedDocStampPer100(county) {
  return normalizeName(county) === "miami-dade" || normalizeName(county) === "miami dade" ? 0.60 : 0.70;
}
