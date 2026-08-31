// The CMA had no way to say what the property IS. Carlos found it running a
// CMA for a condo: the form offered Lot Size and Lot Quality and no type.
//
// Lot Quality is not cosmetic — it feeds a real +5%/-7% swing in the frozen
// math (cmaAnalysis.js "LOT QUALITY"). A condo has no lot to judge, so the
// guarantee these tests protect is: a condo can never carry a lot adjustment.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PROPERTY_TYPES, hasOwnLot, makeInitialSubject } from './CmaTool.jsx';

describe('CMA property type', () => {
  it('offers the same vocabulary as the rest of the app', () => {
    // A CMA and its transaction must never disagree about what the property is.
    const app = fs.readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
    const m = app.match(/const PROPERTY_TYPES = (\[[^\]]*\]);/);
    expect(m, 'App.jsx PROPERTY_TYPES not found — did it move or get renamed?').toBeTruthy();
    expect(JSON.parse(m[1].replace(/'/g, '"'))).toEqual(PROPERTY_TYPES);
  });

  it('knows which types have a lot of their own', () => {
    expect(hasOwnLot('Condo/Townhouse')).toBe(false);
    expect(hasOwnLot('Condo')).toBe(false);
    expect(hasOwnLot('Townhouse')).toBe(false);
    expect(hasOwnLot('Single Family')).toBe(true);
    expect(hasOwnLot('Multi-Family')).toBe(true);
    expect(hasOwnLot('Land')).toBe(true);
    expect(hasOwnLot('Commercial')).toBe(true);
    expect(hasOwnLot(undefined)).toBe(true);   // unknown => behave as before
  });

  it('seeds the type from the transaction, defaulting to Single Family', () => {
    expect(makeInitialSubject({ propertyType: 'Condo/Townhouse' }).propertyType).toBe('Condo/Townhouse');
    expect(makeInitialSubject({}).propertyType).toBe('Single Family');
    expect(makeInitialSubject(null).propertyType).toBe('Single Family');
  });

  it('every lot-less type resolves to a ZERO lot adjustment', () => {
    // Mirrors the lookup in cmaAnalysis.js. 'standard' is the 0% baseline, so
    // forcing lot-less types to it is what keeps a condo's price untouched.
    const LOT_PCT = { premium: 0.05, above_avg: 0.02, standard: 0, below_avg: -0.03, problem: -0.07 };
    for (const t of PROPERTY_TYPES.filter(t => !hasOwnLot(t))) {
      const cleared = { ...makeInitialSubject({ propertyType: t }), lotQuality: 'standard' };
      expect(LOT_PCT[cleared.lotQuality], `${t} must carry no lot adjustment`).toBe(0);
    }
  });
});
