// ============================================================================
// RENTAL ANALYSIS — the "rent vs. sell / rent vs. buy" companion to the CMA.
// Same disciplined approach as the sale engine: a separate MLS export of
// recently LEASED comps drives a median rent-per-sqft, applied to the subject.
// Reuses helpers from cmaAnalysis.js so there is one source of truth.
// ============================================================================
import { median, cleanMoney, cleanNum } from './cmaAnalysis.js';

// Normalize one row of a rental/lease MLS CSV export. Rent is read from the
// common rental column names; falls back to Current Price (which holds the
// monthly rent on a lease export).
export const normalizeRentalRow = (row, idx) => {
  const sqft = cleanNum(row['Heated Area']);
  const rent = cleanMoney(row['Lease Price'] || row['Rent'] || row['Monthly Rent'] || row['Current Price']);
  return {
    id: idx,
    address: row['Address'] || '',
    sqft,
    beds: cleanNum(row['Beds']),
    yearBuilt: cleanNum(row['Year Built']),
    status: (row['Status'] || '').toUpperCase().trim(),
    closeDate: row['Close Date'] || '',
    adom: cleanNum(row['ADOM']),
    rent,
    rentPsf: rent && sqft ? rent / sqft : null,
  };
};

// Round a monthly rent to a clean $25 step (rentals are quoted in round steps,
// not the minus-$1000 sale pattern).
const roundRent = (n) => (n == null || isNaN(n) ? n : Math.round(n / 25) * 25);

// computeRentalAnalysis
//   rentalComps  - array of normalizeRentalRow objects
//   subjectSqft  - subject heated sqft (string or number)
//   saleValue    - the CMA recommended list price (for yield / GRM / 1% rule)
//   monthlyCarry - subject monthly carrying cost (for rent-vs-own)
// Returns null when there isn't enough rental data (mirrors the sale engine).
export const computeRentalAnalysis = ({ rentalComps = [], subjectSqft, saleValue = null, monthlyCarry = 0 }) => {
  const valid = rentalComps.filter((c) => c.rentPsf != null && c.rentPsf > 0);
  const sqft = parseFloat(subjectSqft);
  if (valid.length < 2 || !sqft) return null;

  const medianRentPsf = median(valid.map((c) => c.rentPsf));
  const medianMonthlyRent = median(valid.map((c) => c.rent).filter((v) => v != null));
  const estMonthlyRent = roundRent(medianRentPsf * sqft);
  const annualRent = estMonthlyRent * 12;

  const sv = saleValue ? parseFloat(saleValue) : null;
  const grossYield = sv ? annualRent / sv : null;
  const grm = sv && annualRent ? sv / annualRent : null;
  const onePercentRuleMet = sv ? estMonthlyRent / sv >= 0.01 : null;

  const carry = parseFloat(monthlyCarry) || 0;
  const rentVsOwn = carry > 0 ? { monthlyCarry: carry, estMonthlyRent, diff: estMonthlyRent - carry } : null;

  return {
    count: valid.length,
    medianRentPsf,
    medianMonthlyRent,
    estMonthlyRent,
    annualRent,
    grossYield,
    grm,
    onePercentRuleMet,
    rentVsOwn,
  };
};
