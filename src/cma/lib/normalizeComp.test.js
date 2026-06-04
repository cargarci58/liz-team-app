// Locks the real-world MLS-export tolerance of normalizeCompRow: computed $/sqft
// when per-sqft columns are missing, status-word normalization, and header aliases.
import { describe, it, expect } from 'vitest';
import { normalizeCompRow } from './cmaAnalysis.js';

describe('normalizeCompRow — real-world MLS exports', () => {
  it('computes $/sqft from price ÷ sqft when LP/SP per-sqft columns are absent', () => {
    const c = normalizeCompRow({ Address: '1 A St', 'Living Area': '2500', 'List Price': '600000', Status: 'Active' }, 0);
    expect(c.sqft).toBe(2500);
    expect(c.currentPrice).toBe(600000);
    expect(c.effectivePsf).toBeCloseTo(240, 5); // 600000 / 2500
  });

  it('prefers the explicit per-sqft column when present', () => {
    const c = normalizeCompRow({ Address: '2 B St', 'Heated Area': '2000', 'Close Price': '500000', 'SP / SqFt': '255', Status: 'Closed' }, 1);
    expect(c.effectivePsf).toBe(255); // not 250 from price/sqft
    expect(c.status).toBe('SLD');
  });

  it('normalizes status words to canonical codes', () => {
    const st = (s) => normalizeCompRow({ Address: 'x', 'Living Area': '2000', Price: '400000', Status: s }, 0).status;
    expect(st('Sold')).toBe('SLD');
    expect(st('Closed')).toBe('SLD');
    expect(st('Active')).toBe('ACT');
    expect(st('Pending')).toBe('PND');
    expect(st('Active Under Contract')).toBe('PND');
    expect(st('Expired')).toBe('EXP');
    expect(st('Canceled')).toBe('EXP');
    expect(st('SLD')).toBe('SLD'); // already-canonical Stellar codes still work
    expect(st('ACT')).toBe('ACT');
  });

  it('matches headers case/spacing/punctuation-insensitively', () => {
    const c = normalizeCompRow({ ADDRESS: '3 C St', 'heated_area': '2200', 'current price': '550000', 'st': 'sld' }, 2);
    expect(c.address).toBe('3 C St');
    expect(c.sqft).toBe(2200);
    expect(c.currentPrice).toBe(550000);
    expect(c.status).toBe('SLD');
    expect(c.effectivePsf).toBeCloseTo(250, 5);
  });
});
