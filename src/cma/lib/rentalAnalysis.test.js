import { describe, it, expect } from 'vitest';
import { normalizeRentalRow, computeRentalAnalysis } from './rentalAnalysis.js';

describe('rental analysis', () => {
  const comps = [
    { id: 0, sqft: 2000, rent: 3000, rentPsf: 1.5 },
    { id: 1, sqft: 2000, rent: 3200, rentPsf: 1.6 },
    { id: 2, sqft: 2000, rent: 3400, rentPsf: 1.7 },
    { id: 3, sqft: 2000, rent: 3600, rentPsf: 1.8 },
  ];

  it('estimates monthly rent from median rent/sqft × subject sqft', () => {
    const a = computeRentalAnalysis({ rentalComps: comps, subjectSqft: '2541', saleValue: 584000, monthlyCarry: 7996 });
    expect(a).toBeTruthy();
    expect(a.medianRentPsf).toBeCloseTo(1.65, 2); // median of 1.5,1.6,1.7,1.8
    expect(a.estMonthlyRent).toBe(4200); // round25(1.65*2541=4192) = 4200
    expect(a.annualRent).toBe(50400);
  });

  it('computes gross yield, GRM, and the 1% rule against the sale value', () => {
    const a = computeRentalAnalysis({ rentalComps: comps, subjectSqft: '2541', saleValue: 584000 });
    expect(a.grossYield).toBeCloseTo(50400 / 584000, 4);
    expect(a.grm).toBeCloseTo(584000 / 50400, 2);
    expect(a.onePercentRuleMet).toBe(false); // 4200/584000 = 0.72% < 1%
  });

  it('flags the 1% rule met when rent is high relative to price', () => {
    const a = computeRentalAnalysis({ rentalComps: comps, subjectSqft: '2541', saleValue: 380000 });
    expect(a.onePercentRuleMet).toBe(true); // 4200/380000 = 1.1%
  });

  it('rent-vs-own compares estimated rent to carrying cost', () => {
    const a = computeRentalAnalysis({ rentalComps: comps, subjectSqft: '2541', saleValue: 584000, monthlyCarry: 7996 });
    expect(a.rentVsOwn).toEqual({ monthlyCarry: 7996, estMonthlyRent: 4200, diff: 4200 - 7996 });
  });

  it('returns null without enough rental comps', () => {
    expect(computeRentalAnalysis({ rentalComps: [comps[0]], subjectSqft: '2541' })).toBeNull();
    expect(computeRentalAnalysis({ rentalComps: comps, subjectSqft: '' })).toBeNull();
  });

  it('normalizeRentalRow reads rent from Current Price on a lease export', () => {
    const c = normalizeRentalRow({ Address: '1 A St', 'Heated Area': '2000', 'Current Price': '3,000', Beds: '3', Status: 'LSD' }, 0);
    expect(c.rent).toBe(3000);
    expect(c.rentPsf).toBeCloseTo(1.5, 3);
    expect(c.address).toBe('1 A St');
  });
});
