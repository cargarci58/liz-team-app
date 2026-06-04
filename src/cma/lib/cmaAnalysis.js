// ============================================================================
// CMA ANALYSIS ENGINE — verbatim port of reference/cma-tool-v5/index.html
// ----------------------------------------------------------------------------
// THIS IS A PORT, NOT A REWRITE. Every constant, threshold, branch, and cap in
// this file was calibrated across 5+ versions against real CMAs. Do NOT
// "simplify", "unify", or "clean up" the math. Refactor structure freely;
// never change the numbers without Carlos's approval and a green Budworth test.
//
// See reference/cma-tool-v5/CLAUDE.md for the ten hard rules and the four core
// philosophy principles. See BUDWORTH-REGRESSION-TEST.md for the canonical case.
// ============================================================================

// ===== FORMAT HELPERS =====
export const fmtMoney = (n) => (n == null || isNaN(n) ? '—' : '$' + Math.round(n).toLocaleString());
export const fmtMoneySigned = (n) => {
  if (n == null || isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '−';
  return sign + '$' + Math.abs(Math.round(n)).toLocaleString();
};
export const fmtPct = (n, d = 1) => (n == null || isNaN(n) ? '—' : (n * 100).toFixed(d) + '%');
export const fmtPsf = (n) => (n == null || isNaN(n) ? '—' : '$' + n.toFixed(0) + '/sqft');

export const cleanMoney = (s) => {
  if (s == null || s === '') return null;
  const v = parseFloat(String(s).replace(/[$,]/g, ''));
  return isNaN(v) ? null : v;
};
export const cleanNum = (s) => {
  if (s == null || s === '') return null;
  const v = parseFloat(String(s).replace(/,/g, ''));
  return isNaN(v) ? null : v;
};

// ===== STATS HELPERS =====
export const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
export const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(Math.floor(s.length * p), s.length - 1);
  return s[idx];
};

// Round to defensible psychological breakpoints.
// The "minus $1000" pattern ($599,000 not $600,000) is deliberate — do NOT
// change it to round numbers.
export const roundPrice = (n) => {
  if (n == null || isNaN(n)) return n;
  if (n >= 1000000) {
    // Round to nearest $25K for $1M+
    return Math.round(n / 25000) * 25000 - 1000;
  } else if (n >= 500000) {
    // Round to nearest $5K for $500K-$1M, subtract 1
    return Math.round(n / 5000) * 5000 - 1000;
  } else {
    // Round to nearest $5K for under $500K
    return Math.round(n / 5000) * 5000 - 1000;
  }
};

// Pool classification: 'private', 'community', 'none'
export const classifyPool = (poolStr) => {
  if (!poolStr) return 'none';
  const s = poolStr.toLowerCase();
  if (s.includes('private')) return 'private';
  if (s.includes('community')) return 'community';
  if (s.includes('none') || s.trim() === '') return 'none';
  return 'none';
};

// Stories classification: 1 or 2
export const classifyStories = (str) => {
  if (!str) return null;
  const s = String(str).toLowerCase();
  if (s.includes('2') || s.includes('two')) return 2;
  if (s.includes('1') || s.includes('one')) return 1;
  return null;
};

// ===== UPGRADE LIBRARY =====
export const UPGRADE_LIBRARY = [
  { id: 'kitchen_full', name: 'Full Kitchen Renovation (last 3 yrs)', costFL: 75000, recovery: 0.65 },
  { id: 'kitchen_minor', name: 'Minor Kitchen Refresh (paint cab, new counters)', costFL: 18000, recovery: 0.70 },
  { id: 'primary_bath', name: 'Primary Bathroom Renovation', costFL: 35000, recovery: 0.55 },
  { id: 'secondary_bath', name: 'Secondary Bathroom Renovation', costFL: 15000, recovery: 0.50 },
  { id: 'roof', name: 'New Roof (last 3 yrs)', costFL: 22000, recovery: 0.75 },
  { id: 'hvac', name: 'New HVAC System (last 3 yrs)', costFL: 9000, recovery: 0.65 },
  { id: 'impact_windows', name: 'Hurricane Impact Windows', costFL: 35000, recovery: 0.70 },
  { id: 'solar_owned', name: 'Solar Panels (owned, not leased)', costFL: 32000, recovery: 0.50 },
  { id: 'generator', name: 'Whole-Home Generator', costFL: 12000, recovery: 0.65 },
  { id: 'outdoor_kitchen', name: 'Outdoor Kitchen', costFL: 22000, recovery: 0.60 },
  { id: 'pool_resurface', name: 'Pool Resurface / Upgrade (last 2 yrs)', costFL: 14000, recovery: 0.55 },
  { id: 'screened_lanai', name: 'Screened Lanai / Pool Cage', costFL: 16000, recovery: 0.55 },
  { id: 'ev_charger', name: 'EV / Tesla Wall Charger', costFL: 2000, recovery: 0.80 },
  { id: 'flooring', name: 'New Flooring Throughout', costFL: 18000, recovery: 0.60 },
  { id: 'water_heater', name: 'Tankless Water Heater (last 3 yrs)', costFL: 4500, recovery: 0.55 },
  { id: 'paint_interior', name: 'Fresh Interior Paint Throughout', costFL: 5500, recovery: 0.85 },
  { id: 'landscaping', name: 'Major Landscaping / Hardscape', costFL: 12000, recovery: 0.45 },
  { id: 'smart_home', name: 'Smart Home System (Lutron, Control4, etc.)', costFL: 8000, recovery: 0.40 },
];

// ============================================================================
// CSV ROW → COMP normalization (ported from handleFile in index.html).
// Kept separate so CSV parsing (PapaParse) can stay in the component layer.
// ============================================================================
export const normalizeCompRow = (row, idx) => {
  const c = {
    id: idx,
    address: row['Address'] || '',
    city: row['City'] || '',
    zip: row['Zip'] || '',
    subdivision: row['Legal Subdivision Name'] || '',
    sqft: cleanNum(row['Heated Area']),
    beds: cleanNum(row['Beds']),
    fullBaths: cleanNum(row['Full Baths']),
    halfBaths: cleanNum(row['Half Baths']),
    yearBuilt: cleanNum(row['Year Built']),
    pool: row['Pool'] || '',
    view: row['View'] || '',
    waterView: row['Water View'] || '',
    lotSize: cleanNum(row['Lot Size Acres']),
    stories: classifyStories(row['Stories'] || row['Levels'] || row['Building Stories Total']),
    garageSpaces: cleanNum(row['Garage Spaces']),
    currentPrice: cleanMoney(row['Current Price']),
    lpSqft: cleanMoney(row['LP / SqFt']),
    spSqft: cleanMoney(row['SP / SqFt']),
    cdom: cleanNum(row['CDOM']),
    adom: cleanNum(row['ADOM']),
    soldTerms: row['Sold Terms'] || '',
    listAgent: row['List Agent'] || '',
    sellingAgent: row['Selling Agent'] || '',
    closeDate: row['Close Date'] || '',
    onMarketDate: row['On Market Date'] || '',
    status: (row['Status'] || '').toUpperCase().trim(),
  };
  c.poolType = classifyPool(c.pool);
  c.hasPool = c.poolType === 'private';
  c.hasWaterView = !!(c.waterView && c.waterView.trim() && !c.waterView.toLowerCase().includes('none'));
  c.hasGolfView = !!(c.view && c.view.toLowerCase().includes('golf'));
  c.impliedListPrice = c.lpSqft && c.sqft ? c.lpSqft * c.sqft : null;
  c.spLpRatio = c.impliedListPrice && c.currentPrice && c.status === 'SLD' ? c.currentPrice / c.impliedListPrice : null;
  c.effectivePsf = c.spSqft || c.lpSqft;
  return c;
};

// ============================================================================
// OUTLIER DETECTION (MAD) — ported from outlierInfo useMemo.
// Outliers are auto-excluded from tier math even if the agent selected them.
// `selected` is the array of selected comp objects.
// ============================================================================
export const computeOutlierInfo = (selected) => {
  const psfValues = selected.map((c) => c.effectivePsf).filter((v) => v != null);
  if (psfValues.length < 3) return { outlierIds: new Set(), details: [] };
  const med = median(psfValues);
  const deviations = psfValues.map((v) => Math.abs(v - med));
  const mad = median(deviations);
  const threshold = mad > med * 0.05 ? mad * 2.5 : med * 0.4;
  const outlierIds = new Set();
  const details = [];
  selected.forEach((c) => {
    if (c.effectivePsf == null) return;
    const dev = Math.abs(c.effectivePsf - med);
    if (dev > threshold) {
      outlierIds.add(c.id);
      details.push({
        id: c.id,
        address: c.address,
        psf: c.effectivePsf,
        devPct: ((c.effectivePsf - med) / med) * 100,
        direction: c.effectivePsf > med ? 'high' : 'low',
      });
    }
  });
  return { outlierIds, details, medianPsf: med };
};

// ============================================================================
// MARKET DIRECTION — ported from marketDirection useMemo.
// Requires 6+ sold comps for auto-detect; caps at ±15% annualized.
// `nowMs` is injectable for deterministic tests; production passes Date.now().
// (Auto-detect does not actually use nowMs — it compares comp midpoints — but
//  it is threaded through for parity with the source and future use.)
// ============================================================================
export const computeMarketDirection = (selected, marketOverride, outlierInfo) => {
  if (marketOverride !== 'auto') {
    const overrides = {
      rising: { annualPct: 0.08, label: 'Rising', desc: 'Manually set: market is appreciating', confidence: 'manual', dataPoints: 0 },
      flat: { annualPct: 0, label: 'Flat', desc: 'Manually set: market is stable', confidence: 'manual', dataPoints: 0 },
      softening_mild: { annualPct: -0.04, label: 'Softening', desc: 'Manually set: market is softening', confidence: 'manual', dataPoints: 0 },
      softening_strong: { annualPct: -0.1, label: 'Falling', desc: 'Manually set: market is falling', confidence: 'manual', dataPoints: 0 },
    };
    return overrides[marketOverride];
  }
  const dated = selected
    .filter((c) => c.status === 'SLD' && c.spSqft && c.closeDate && !outlierInfo.outlierIds.has(c.id))
    .map((c) => {
      const parts = c.closeDate.split('/');
      if (parts.length !== 3) return null;
      return { date: new Date(parts[2], parts[0] - 1, parts[1]), psf: c.spSqft };
    })
    .filter((x) => x && !isNaN(x.date.getTime()));
  if (dated.length < 6) {
    return {
      annualPct: 0,
      label: 'Insufficient data',
      desc: `Need at least 6 sold comps with close dates for reliable trend detection (you have ${dated.length}). Use Manual Override below to set direction.`,
      confidence: 'none',
      dataPoints: dated.length,
    };
  }
  dated.sort((a, b) => a.date - b.date);
  const oldestDate = dated[0].date;
  const newestDate = dated[dated.length - 1].date;
  const spanDays = (newestDate - oldestDate) / (1000 * 60 * 60 * 24);
  if (spanDays < 60) return { annualPct: 0, label: 'Period too short', desc: 'Comps span less than 60 days.', confidence: 'none', dataPoints: dated.length };
  const mid = Math.floor(dated.length / 2);
  const firstHalf = dated.slice(0, mid);
  const secondHalf = dated.slice(mid);
  const meanPsf = (arr) => arr.reduce((s, v) => s + v.psf, 0) / arr.length;
  const firstMean = meanPsf(firstHalf);
  const secondMean = meanPsf(secondHalf);
  const totalChange = (secondMean - firstMean) / firstMean;
  const midFirst = firstHalf[Math.floor(firstHalf.length / 2)].date;
  const midSecond = secondHalf[Math.floor(secondHalf.length / 2)].date;
  const yearsBetween = (midSecond - midFirst) / (1000 * 60 * 60 * 24 * 365);
  let annualPct = yearsBetween > 0 ? totalChange / yearsBetween : 0;
  // CAP extreme values — annualized rates beyond ±15% are almost always sample-size artifacts
  // (e.g., 4 comps with one outlier creating a wildly steep trend line)
  annualPct = Math.max(-0.15, Math.min(0.15, annualPct));
  let label, desc;
  if (annualPct > 0.05) {
    label = 'Rising';
    desc = 'Sold prices are appreciating.';
  } else if (annualPct > 0.02) {
    label = 'Slightly Rising';
    desc = 'Modest appreciation in recent sales.';
  } else if (annualPct > -0.02) {
    label = 'Flat';
    desc = 'Market is stable.';
  } else if (annualPct > -0.05) {
    label = 'Slightly Softening';
    desc = 'Modest decline in recent sales.';
  } else if (annualPct > -0.1) {
    label = 'Softening';
    desc = 'Sold prices are declining noticeably.';
  } else {
    label = 'Falling';
    desc = 'Significant price decline detected.';
  }
  const confidence = dated.length >= 8 ? 'strong' : 'moderate';
  return { annualPct, label, desc, confidence, dataPoints: dated.length, dated };
};

// ============================================================================
// UPGRADE ADJUSTMENT — ported from upgradeAdjustment useMemo.
// `upgrades` is a map: { [id]: { checked: bool, customValue?: string } }
// ============================================================================
export const computeUpgradeAdjustment = (upgrades) => {
  let total = 0;
  let breakdown = [];
  Object.entries(upgrades || {}).forEach(([id, data]) => {
    if (!data?.checked) return;
    const item = UPGRADE_LIBRARY.find((u) => u.id === id);
    if (!item) return;
    const cost = data.customValue != null && data.customValue !== '' ? parseFloat(data.customValue) : item.costFL;
    const value = cost * item.recovery;
    total += value;
    breakdown.push({ name: item.name, cost, recovery: item.recovery, value });
  });
  return { total, breakdown };
};

// ============================================================================
// MAIN ANALYSIS — ported verbatim from the `analysis` useMemo in index.html.
// Returns null when there is not enough data (matching the source guard).
//
// args:
//   selected            - array of selected comp objects
//   subject             - subject property inputs (string-or-number fields ok)
//   upgradeAdjustment   - result of computeUpgradeAdjustment(upgrades)
//   marketDirection     - result of computeMarketDirection(...)
//   outlierInfo         - result of computeOutlierInfo(selected)
//   comps               - the full comp list (for inventory + buyer-agent stats)
// ============================================================================
export const runAnalysis = ({ selected, subject, upgradeAdjustment, marketDirection, outlierInfo, comps }) => {
  if (selected.length < 2 || !subject.sqft) return null;
  const targetSqft = parseFloat(subject.sqft);

  // Use cleaned comps (no outliers) for all calcs
  const cleanComps = selected.filter((c) => !outlierInfo.outlierIds.has(c.id) && c.effectivePsf != null);
  if (cleanComps.length < 2) return null;

  const psfClean = cleanComps.map((c) => c.effectivePsf);
  const medianPsf = median(psfClean);
  const p90Psf = percentile(psfClean, 0.9);
  const p10Psf = percentile(psfClean, 0.1);

  // List-to-sale ratio
  const soldRatios = cleanComps.filter((c) => c.status === 'SLD').map((c) => c.spLpRatio).filter((v) => v != null);
  const medianRatio = soldRatios.length ? median(soldRatios) : 0.965;

  // DOM
  const soldAdoms = cleanComps.filter((c) => c.status === 'SLD').map((c) => c.adom).filter((v) => v != null);
  const medianAdom = soldAdoms.length ? median(soldAdoms) : 45;

  // ===== ADJUSTMENT CALCULATIONS =====
  // Base: median $/sqft × subject sqft
  const baseValue = medianPsf * targetSqft;
  const adjustments = [];

  // POOL — directional logic with Florida rules of thumb as fallback
  // Real-world rule: private pools ADD value, community pools are roughly neutral,
  // no pool means $0 adjustment (or possibly small negative vs private-heavy comp sets).
  // If small-sample comp data shows the opposite of reality, ignore the noisy signal.
  const subjectPoolType = subject.poolType || 'none';
  const privatePoolPsf = cleanComps.filter((c) => c.poolType === 'private').map((c) => c.effectivePsf);
  const communityPoolPsf = cleanComps.filter((c) => c.poolType === 'community').map((c) => c.effectivePsf);
  const noPoolPsf = cleanComps.filter((c) => c.poolType === 'none').map((c) => c.effectivePsf);

  const privateMedian = privatePoolPsf.length >= 2 ? median(privatePoolPsf) : null;
  const communityMedian = communityPoolPsf.length >= 2 ? median(communityPoolPsf) : null;
  const noPoolMedian = noPoolPsf.length >= 2 ? median(noPoolPsf) : null;

  // Florida rule-of-thumb pool premium scaled to price band
  let flPoolPremium;
  if (baseValue >= 1500000) flPoolPremium = 50000;
  else if (baseValue >= 1000000) flPoolPremium = 40000;
  else if (baseValue >= 700000) flPoolPremium = 30000;
  else if (baseValue >= 500000) flPoolPremium = 22000;
  else flPoolPremium = 15000;

  // Cap data-driven pool adjustments to ±1.5× the rule-of-thumb
  // (prevents small-sample weirdness from generating unrealistic premiums)
  const poolCap = flPoolPremium * 1.5;

  let poolAdj = 0;
  let poolSource = '';

  if (subjectPoolType === 'private') {
    // Subject HAS a private pool - apply a premium
    if (privateMedian && (noPoolMedian || communityMedian)) {
      const otherMedian = noPoolMedian || communityMedian;
      const dataDrivenPsf = privateMedian - otherMedian;
      // Only use data signal if it's positive (the right direction)
      if (dataDrivenPsf > 0) {
        poolAdj = Math.min(dataDrivenPsf * targetSqft, poolCap);
        poolSource = `private pool premium from ${privatePoolPsf.length} pool comps vs ${noPoolPsf.length + communityPoolPsf.length} non-pool comps`;
      } else {
        // Data is noisy or backwards - use FL rule of thumb
        poolAdj = flPoolPremium;
        poolSource = `FL rule of thumb (comp data inconclusive)`;
      }
    } else {
      poolAdj = flPoolPremium;
      poolSource = `FL rule of thumb (insufficient pool/no-pool comps)`;
    }
  } else if (subjectPoolType === 'community') {
    // Community pool only - roughly neutral, very small adjustment at most
    // Don't apply a credit just because data shows it - community pool is amenity-tier, not value-tier
    poolAdj = 0;
    poolSource = '';
  } else if (subjectPoolType === 'none') {
    // Subject has NO pool - small negative adjustment IF comp set is heavy with private pools
    // Critically: never positive. No pool is never a premium feature.
    const privateCompShare = privatePoolPsf.length / Math.max(cleanComps.length, 1);
    if (privateCompShare >= 0.4 && privateMedian && noPoolMedian) {
      // Significant share of comps have private pools - subject loses some relative value
      const dataDrivenPsf = noPoolMedian - privateMedian;
      // Only use if data shows the EXPECTED direction (no-pool less than private)
      if (dataDrivenPsf < 0) {
        poolAdj = Math.max(dataDrivenPsf * targetSqft, -poolCap);
        poolSource = `no-pool discount vs private-pool-heavy comp set`;
      } else {
        // Data backwards - use small FL rule of thumb
        poolAdj = -flPoolPremium * 0.5;
        poolSource = `FL rule of thumb (comp data inconclusive)`;
      }
    }
    // If comp set is mostly no-pool/community, no adjustment needed - subject is normal for market
  }
  if (Math.abs(poolAdj) > 500) {
    adjustments.push({ name: 'Pool', value: poolAdj, source: poolSource });
  }

  // STORIES — capped so small-sample weirdness can't produce massive adjustments
  const subjStories = parseInt(subject.stories) || 1;
  const oneStoryComps = cleanComps.filter((c) => c.stories === 1).map((c) => c.effectivePsf);
  const twoStoryComps = cleanComps.filter((c) => c.stories === 2).map((c) => c.effectivePsf);
  let storyAdj = 0;
  let storySource = '';
  // Need at least 3 in each bucket for a reliable signal
  if (oneStoryComps.length >= 3 && twoStoryComps.length >= 3) {
    const oneStoryMedian = median(oneStoryComps);
    const twoStoryMedian = median(twoStoryComps);
    const subjStoryMedian = subjStories === 1 ? oneStoryMedian : twoStoryMedian;
    const rawAdj = (subjStoryMedian - medianPsf) * targetSqft;
    // Cap at ±5% of base value to prevent unrealistic adjustments
    const cap = baseValue * 0.05;
    storyAdj = Math.max(-cap, Math.min(cap, rawAdj));
    if (Math.abs(storyAdj) > 500) {
      storySource = `${subjStories}-story vs mixed comp set (${oneStoryComps.length} one-story, ${twoStoryComps.length} two-story)`;
      adjustments.push({ name: `${subjStories}-Story Adjustment`, value: storyAdj, source: storySource });
    }
  }

  // GARAGE — fixed per-space value
  const subjGarage = parseInt(subject.garageSpaces) || 2;
  const garageComps = cleanComps.filter((c) => c.garageSpaces != null && c.garageSpaces > 0);
  let garageAdj = 0;
  if (garageComps.length >= 3) {
    const medianGarage = median(garageComps.map((c) => c.garageSpaces));
    const garageDiff = subjGarage - medianGarage;
    const perSpaceValue = baseValue >= 1000000 ? 25000 : baseValue >= 600000 ? 18000 : 12000;
    garageAdj = garageDiff * perSpaceValue;
    if (Math.abs(garageAdj) > 500) {
      adjustments.push({ name: `Garage (${subjGarage} vs ${medianGarage} median)`, value: garageAdj, source: `${fmtMoney(perSpaceValue)}/space differential` });
    }
  }

  // LOT VIEW — capped and properly bounded
  // Florida pond/water view typically adds 3-5%, golf view 4-6%
  // Cap at modest dollar amounts that match real market behavior
  const waterViewComps = cleanComps.filter((c) => c.hasWaterView).map((c) => c.effectivePsf);
  const noViewComps = cleanComps.filter((c) => !c.hasWaterView && !c.hasGolfView).map((c) => c.effectivePsf);
  let viewAdj = 0;

  // Pond/water view premium - capped at 5% of base or $30K, whichever is lower
  if (subject.hasWaterView) {
    const waterViewCap = Math.min(baseValue * 0.05, 30000);
    if (waterViewComps.length >= 3 && noViewComps.length >= 3) {
      // Use data-driven adjustment but cap it
      const wvMed = median(waterViewComps);
      const nvMed = median(noViewComps);
      const dataAdj = (wvMed - nvMed) * targetSqft;
      // Only apply if positive (view should be a premium, not a discount)
      if (dataAdj > 0) {
        const cappedAdj = Math.min(dataAdj, waterViewCap);
        viewAdj += cappedAdj;
        adjustments.push({ name: 'Water View', value: cappedAdj, source: `from ${waterViewComps.length} water-view comps, capped at FL norms` });
      } else {
        // Data backward - use modest FL rule of thumb
        viewAdj += waterViewCap * 0.6;
        adjustments.push({ name: 'Water View', value: waterViewCap * 0.6, source: 'FL rule of thumb (3-5% pond/lake view premium)' });
      }
    } else {
      // Insufficient comp data - use FL rule of thumb
      viewAdj += waterViewCap * 0.6;
      adjustments.push({ name: 'Water View', value: waterViewCap * 0.6, source: 'FL rule of thumb (3-5% pond/lake view premium)' });
    }
  }

  // Golf view premium - capped at 6% of base or $40K
  if (subject.hasGolfView) {
    const golfViewCap = Math.min(baseValue * 0.06, 40000);
    const golfAdj = golfViewCap * 0.75; // moderate within the range
    viewAdj += golfAdj;
    adjustments.push({ name: 'Golf View', value: golfAdj, source: 'FL rule of thumb (4-6% golf view premium)' });
  }

  // BED/BATH MISMATCH — 3% per bedroom, capped
  const subjBeds = parseInt(subject.beds);
  const compBedsList = cleanComps.map((c) => c.beds).filter((v) => v != null);
  if (subjBeds && compBedsList.length >= 3) {
    const medianBeds = median(compBedsList);
    const bedDiff = subjBeds - medianBeds;
    if (Math.abs(bedDiff) >= 1) {
      const rawBedAdj = bedDiff * baseValue * 0.03; // 3% per bedroom
      // Cap at ±$25K per bedroom difference
      const cap = Math.abs(bedDiff) * 25000;
      const bedAdj = Math.max(-cap, Math.min(cap, rawBedAdj));
      adjustments.push({ name: `Bed Count (${subjBeds} vs ${medianBeds} median)`, value: bedAdj, source: '~3% per bedroom, capped' });
    }
  }

  // SQFT MISMATCH — smaller homes always have higher $/sqft
  // Only adjust if there's a meaningful mismatch (>15% different from comp avg)
  const meanCompSqft = mean(cleanComps.map((c) => c.sqft).filter((v) => v != null));
  const sqftDiffPct = (targetSqft - meanCompSqft) / meanCompSqft;
  if (Math.abs(sqftDiffPct) > 0.15) {
    // Modest correction - 0.2 multiplier instead of 0.3, capped at ±5% of base
    const rawSqftAdj = baseValue * (-sqftDiffPct * 0.2);
    const cap = baseValue * 0.05;
    const sqftAdj = Math.max(-cap, Math.min(cap, rawSqftAdj));
    if (Math.abs(sqftAdj) > 500) {
      adjustments.push({ name: `Sqft Size Adjustment`, value: sqftAdj, source: `subject ${sqftDiffPct > 0 ? 'larger' : 'smaller'} than comp avg, capped at 5%` });
    }
  }

  // CONDITION TIER — the biggest single adjustment, comes from the in-person walkthrough
  // The comp set's median assumes "move-in ready" - everything else adjusts from there
  const conditionAdjustments = {
    premium: { pct: 0.07, label: 'Premium / Recently Renovated' },
    move_in: { pct: 0.0, label: 'Move-In Ready' },
    original_maintained: { pct: -0.04, label: 'Original but Maintained' },
    needs_work: { pct: -0.1, label: 'Original + Needs Work' },
    major_updates: { pct: -0.17, label: 'Major Updates Needed' },
  };
  const conditionTier = subject.conditionTier || 'move_in';
  const conditionInfo = conditionAdjustments[conditionTier];
  if (conditionInfo && Math.abs(conditionInfo.pct) > 0.001) {
    const conditionAdj = baseValue * conditionInfo.pct;
    adjustments.push({
      name: `Condition: ${conditionInfo.label}`,
      value: conditionAdj,
      source: `${conditionInfo.pct >= 0 ? '+' : ''}${(conditionInfo.pct * 100).toFixed(0)}% vs move-in-ready baseline`,
    });
  }

  // LOT QUALITY — lot situation can swing 5-10% in either direction
  const lotAdjustments = {
    premium: { pct: 0.05, label: 'Premium Lot' },
    above_avg: { pct: 0.02, label: 'Above-Average Lot' },
    standard: { pct: 0.0, label: 'Standard Lot' },
    below_avg: { pct: -0.03, label: 'Below-Average Lot' },
    problem: { pct: -0.07, label: 'Problem Lot' },
  };
  const lotTier = subject.lotQuality || 'standard';
  const lotInfo = lotAdjustments[lotTier];
  if (lotInfo && Math.abs(lotInfo.pct) > 0.001) {
    const lotAdj = baseValue * lotInfo.pct;
    adjustments.push({
      name: `Lot: ${lotInfo.label}`,
      value: lotAdj,
      source: `${lotInfo.pct >= 0 ? '+' : ''}${(lotInfo.pct * 100).toFixed(0)}% vs standard lot`,
    });
  }

  // Sum all adjustments
  const totalAdjustments = adjustments.reduce((s, a) => s + a.value, 0);
  const upgradeBoost = upgradeAdjustment.total;

  // Pre-market-direction expected sale price
  const preAdjustedValue = baseValue + totalAdjustments + upgradeBoost;

  // Market direction forward adjustment
  const marketAdjFactor = (dom) => 1 + marketDirection.annualPct * (dom / 365);
  const expectedMarketRaw = preAdjustedValue;
  const expectedMarket = expectedMarketRaw * marketAdjFactor(medianAdom);

  // ===== TIER CALCULATION =====
  // CRITICAL: All three tiers should anchor to the SAME calculated expected sale price.
  // The tiers represent STRATEGY differences on the same home, not "what if this were a different house."
  // - Market: list at the price that nets the expected sale at normal velocity
  // - Aggressive: list 5-7% above market, hoping the strongest buyer pays the premium (slower DOM, higher risk)
  // - Quick Sale: list 3-5% below market, generating multiple offers fast (faster DOM, lower risk)

  // Market tier — the anchor
  const listMarketRaw = expectedMarket / medianRatio;
  const listMarket = roundPrice(listMarketRaw);

  // Aggressive: 6% above market list price. Expected sale stays near market expected sale
  // (because pricing high doesn't actually make buyers pay more — they negotiate down)
  // but with longer DOM and lower probability of clearing
  const listAggressive = roundPrice(listMarket * 1.06);
  // Aggressive expected sale: most of these will reduce, ending up ~2% above market sale
  const expectedAggressive = expectedMarket * 1.02;

  // Quick Sale: 4% below market list price. Expected sale ends up close to or slightly above
  // list because multiple-offer dynamics push it up
  const listQuick = roundPrice(listMarket * 0.96);
  // Quick sale expected sale: with multiple-offer pressure, often clears at list or 1-2% above
  const expectedQuick = listQuick * 1.01;

  const cappedAggressive = listAggressive; // No longer needs capping since spread is built-in
  const aggressiveWasCapped = false;

  let tiers = [
    { name: 'Aggressive', listPrice: listAggressive, psf: listAggressive / targetSqft, expectedSale: expectedAggressive, expectedDom: Math.round(medianAdom * 2.2), prob60: 0.25, riskOfReduction: 0.7 },
    { name: 'Market', listPrice: listMarket, psf: listMarket / targetSqft, expectedSale: expectedMarket, expectedDom: Math.round(medianAdom), prob60: 0.65, riskOfReduction: 0.25 },
    { name: 'Quick Sale', listPrice: listQuick, psf: listQuick / targetSqft, expectedSale: expectedQuick, expectedDom: Math.round(medianAdom * 0.5), prob60: 0.9, riskOfReduction: 0.05 },
  ];

  // ===== CURRENT LISTING OVERRIDE =====
  // If subject is already on the market AND has failed at current price, override the tiers.
  // The market's actual behavior on the actual home beats any computed comp price.
  //
  // CRITICAL: Reductions are anchored to BOTH the failed list price AND the comp-supported
  // expected sale. We pick a reduction that respects both signals.
  let currentListingOverride = null;
  if (subject.isCurrentlyListed && subject.currentListPrice) {
    const currentPrice = parseFloat(subject.currentListPrice);
    const dom = parseInt(subject.currentDOM) || 0;
    const reductions = parseInt(subject.priceReductions) || 0;
    const showings = subject.showingActivity || 'moderate';
    const offers = subject.offersReceived || 'none';

    const referenceDom = Math.max(medianAdom, 30);
    const staleness = dom / referenceDom;

    let listingFailed = false;
    let failureReason = '';
    if (staleness >= 2.0 && (showings === 'low' || showings === 'none')) {
      listingFailed = true;
      failureReason = `Listed ${dom} days (${staleness.toFixed(1)}x normal DOM) with low showing activity`;
    } else if (staleness >= 1.5 && offers === 'none' && showings !== 'high') {
      listingFailed = true;
      failureReason = `Listed ${dom} days (${staleness.toFixed(1)}x normal DOM) with no offers received`;
    } else if (staleness >= 2.5) {
      listingFailed = true;
      failureReason = `Listed ${dom} days — significantly above normal DOM`;
    }

    // ===== STALENESS DEPTH =====
    // How DEEPLY stale is this listing? A home that's already had $44K in failed
    // reductions is in much worse shape than one with no prior reductions.
    // The deeper the staleness, the more aggressive the next reduction must be —
    // because gentle reductions have already been tried and rejected.
    const reductionAmount = reductions;
    const originalListPrice = currentPrice + reductionAmount;
    const reductionPctSoFar = reductionAmount > 0 ? reductionAmount / originalListPrice : 0;

    // Staleness depth: 'barely', 'moderate', or 'deeply'
    let stalenessDepth = 'barely';
    if (listingFailed) {
      // Combine DOM signal + prior reduction signal
      const domSignal = staleness >= 2.0 ? 2 : staleness >= 1.5 ? 1 : 0;
      const reductionSignal = reductionPctSoFar >= 0.05 ? 2 : reductionPctSoFar >= 0.02 ? 1 : 0;
      const totalSignal = domSignal + reductionSignal;
      if (totalSignal >= 3) stalenessDepth = 'deeply';
      else if (totalSignal >= 2) stalenessDepth = 'moderate';
      else stalenessDepth = 'barely';
    }

    let overrideTiers = null;
    if (listingFailed) {
      const compSupportedList = expectedMarket / medianRatio;
      const currentIsBelowComps = currentPrice < compSupportedList * 0.98;

      // REALISTIC reduction ranges (calibrated to actual agent practice):
      // - Light reset: 2-3% off current — tests the next price point, often crosses psychological barrier
      // - Moderate reset: 4-5% off current — meaningful signal to the market, attracts new buyer pool
      // - Aggressive: 6-8% off current — clear "we want to sell" move, generates fast activity
      //
      // HARD CEILING: never recommend more than 8% off current as a default cut.
      // If a home truly needs a >8% cut, the conversation is "delist and revisit" not "cut more."
      //
      // Staleness intelligence retained: position within each range based on how stale the listing is.
      // - Barely stale → bottom of each range (gentler cuts work)
      // - Moderately stale → middle of each range
      // - Deeply stale → top of each range (but never exceeding ceilings)
      let cuts;
      if (stalenessDepth === 'deeply') {
        cuts = { light: 0.97, moderate: 0.95, aggressive: 0.92 }; // 3% / 5% / 8% off current
      } else if (stalenessDepth === 'moderate') {
        cuts = { light: 0.975, moderate: 0.955, aggressive: 0.93 }; // 2.5% / 4.5% / 7% off current
      } else {
        cuts = { light: 0.98, moderate: 0.96, aggressive: 0.94 }; // 2% / 4% / 6% off current
      }

      let lightReset, moderateReset, aggressiveReset;

      if (currentIsBelowComps) {
        // All tiers below current — straight percentage cuts
        lightReset = roundPrice(currentPrice * cuts.light);
        moderateReset = roundPrice(currentPrice * cuts.moderate);
        aggressiveReset = roundPrice(currentPrice * cuts.aggressive);
      } else {
        // Failed at or above comp value — moderate tier can anchor to comp-supported if it falls
        // within the realistic range; otherwise use the percentage cut.
        lightReset = roundPrice(currentPrice * cuts.light);
        const compTargetMid = compSupportedList;
        const moderateCutPrice = currentPrice * cuts.moderate;
        // Use comp-supported price only if it's within realistic moderate-reset range (4-5% cut)
        moderateReset =
          compTargetMid >= currentPrice * 0.94 && compTargetMid <= currentPrice * 0.97 ? roundPrice(compTargetMid) : roundPrice(moderateCutPrice);
        aggressiveReset = roundPrice(currentPrice * cuts.aggressive);
      }

      // POST-REDUCTION DOM ESTIMATES:
      // When a stale listing gets a real price cut, the listing gets fresh visibility
      // (portals flag "price reduced", showings restart). DOM after reduction is typically:
      // - Light reset (2-3%): 25-35 days (modest activity bump, may need follow-up cut)
      // - Moderate reset (4-5%): 14-21 days (real activity surge, often sells without further cuts)
      // - Aggressive (6-8%): 7-14 days (multiple offers, clears fast)
      // These DOM estimates are AFTER the price reduction takes effect, not total since original listing.
      const lightDom = stalenessDepth === 'deeply' ? 30 : stalenessDepth === 'moderate' ? 28 : 25;
      const moderateDom = stalenessDepth === 'deeply' ? 18 : 16;
      const aggressiveDom = 10;

      overrideTiers = [
        { name: 'Light Reset', listPrice: lightReset, psf: lightReset / targetSqft, expectedSale: lightReset * medianRatio, expectedDom: lightDom, prob60: 0.45, riskOfReduction: 0.45, override: true, isPostReduction: true, cutPct: 1 - cuts.light },
        { name: 'Moderate Reset', listPrice: moderateReset, psf: moderateReset / targetSqft, expectedSale: moderateReset * medianRatio, expectedDom: moderateDom, prob60: 0.72, riskOfReduction: 0.2, override: true, isPostReduction: true, cutPct: 1 - cuts.moderate },
        { name: 'Aggressive', listPrice: aggressiveReset, psf: aggressiveReset / targetSqft, expectedSale: aggressiveReset * medianRatio, expectedDom: aggressiveDom, prob60: 0.9, riskOfReduction: 0.05, override: true, isPostReduction: true, cutPct: 1 - cuts.aggressive },
      ];

      tiers = overrideTiers;
    }

    currentListingOverride = {
      currentPrice,
      dom,
      reductions,
      showings,
      offers,
      staleness,
      listingFailed,
      failureReason,
      stalenessDepth,
      reductionAmount,
      originalListPrice,
      reductionPctSoFar,
      compRecommended: listMarket,
      compSupportedSale: expectedMarket,
      currentIsBelowComps: currentPrice < (expectedMarket * 0.98) / medianRatio,
      wasOverridden: !!overrideTiers,
    };
  }

  // ===== MANUAL PRICE OVERRIDE =====
  // Agent can override the recommended (middle) tier price at any time.
  // This respects Liz's judgment — she has information the data can't capture.
  let manualOverrideApplied = false;
  if (subject.manualPriceOverride && parseFloat(subject.manualPriceOverride) > 0) {
    const manualPrice = parseFloat(subject.manualPriceOverride);
    // Replace the Market/Reset tier with the manual price
    // Aggressive becomes manual × 1.04, Quick becomes manual × 0.97
    // (Smaller spread because manual override implies high confidence)
    const manualAggressive = roundPrice(manualPrice * 1.04);
    const manualQuick = roundPrice(manualPrice * 0.97);
    tiers = [
      { name: 'Aggressive', listPrice: manualAggressive, psf: manualAggressive / targetSqft, expectedSale: manualAggressive * medianRatio, expectedDom: Math.round(medianAdom * 1.8), prob60: 0.3, riskOfReduction: 0.6, manual: true },
      { name: 'Recommended', listPrice: roundPrice(manualPrice), psf: manualPrice / targetSqft, expectedSale: manualPrice * medianRatio, expectedDom: Math.round(medianAdom), prob60: 0.7, riskOfReduction: 0.2, manual: true },
      { name: 'Quick Sale', listPrice: manualQuick, psf: manualQuick / targetSqft, expectedSale: manualQuick * medianRatio, expectedDom: Math.round(medianAdom * 0.5), prob60: 0.9, riskOfReduction: 0.05, manual: true },
    ];
    manualOverrideApplied = true;
  }

  const monthlyCarry =
    (parseFloat(subject.monthlyHOA) || 0) +
    (parseFloat(subject.propertyTaxAnnual) || 0) / 12 +
    (parseFloat(subject.insuranceAnnual) || 0) / 12 +
    (parseFloat(subject.estMortgagePayment) || 0);

  // Inventory health
  const allSold = comps.filter((c) => c.status === 'SLD');
  const allActive = comps.filter((c) => c.status === 'ACT');
  const monthlySoldRate = allSold.length / 9; // assume 9 month window
  const monthsSupply = monthlySoldRate > 0 ? allActive.length / monthlySoldRate : 0;
  let invVerdict;
  if (monthsSupply < 3) invVerdict = { label: "Seller's Market", desc: 'Strong demand, low inventory. Pricing can be aggressive.', color: 'var(--green)' };
  else if (monthsSupply < 6) invVerdict = { label: 'Balanced Market', desc: 'Steady demand. Price right and homes will move.', color: 'var(--gold)' };
  else invVerdict = { label: "Buyer's Market", desc: 'High inventory relative to demand. Conservative pricing recommended.', color: 'var(--red)' };

  // Buyer agent outreach — agents with 2+ sold deals in dataset
  const agentDeals = {};
  comps
    .filter((c) => c.status === 'SLD' && c.sellingAgent)
    .forEach((c) => {
      if (!agentDeals[c.sellingAgent]) agentDeals[c.sellingAgent] = { count: 0, latest: null };
      agentDeals[c.sellingAgent].count++;
      if (!agentDeals[c.sellingAgent].latest || c.closeDate > agentDeals[c.sellingAgent].latest) {
        agentDeals[c.sellingAgent].latest = c.closeDate;
      }
    });
  const buyerAgents = Object.entries(agentDeals)
    .filter(([name, d]) => d.count >= 2 && !name.toLowerCase().includes('non-member'))
    .map(([name, d]) => ({ name, count: d.count, latest: d.latest }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    medianPsf,
    p90Psf,
    p10Psf,
    medianRatio,
    medianAdom,
    baseValue,
    adjustments,
    totalAdjustments,
    upgradeBoost,
    tiers,
    monthlyCarry,
    compCount: selected.length,
    cleanCompCount: cleanComps.length,
    soldCount: cleanComps.filter((c) => c.status === 'SLD').length,
    pendingCount: cleanComps.filter((c) => c.status === 'PND').length,
    activeCount: cleanComps.filter((c) => c.status === 'ACT').length,
    expiredCount: cleanComps.filter((c) => c.status === 'EXP').length,
    marketDirection,
    marketAdjPct: marketDirection.annualPct * (medianAdom / 365),
    monthsSupply,
    invVerdict,
    buyerAgents,
    aggressiveWasCapped,
    manualOverrideApplied,
    manualPriceNote: subject.manualPriceNote || '',
    currentListingOverride,
  };
};

// ============================================================================
// CONVENIENCE WRAPPER — wires the pieces together the way the component does.
// Mirrors: outlierInfo → marketDirection → upgradeAdjustment → analysis.
// ============================================================================
export const analyzeCMA = ({ comps, selectedIds, subject, upgrades = {}, marketOverride = 'auto' }) => {
  const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const selected = comps.filter((c) => idSet.has(c.id));
  const outlierInfo = computeOutlierInfo(selected);
  const marketDirection = computeMarketDirection(selected, marketOverride, outlierInfo);
  const upgradeAdjustment = computeUpgradeAdjustment(upgrades);
  return {
    analysis: runAnalysis({ selected, subject, upgradeAdjustment, marketDirection, outlierInfo, comps }),
    selected,
    outlierInfo,
    marketDirection,
    upgradeAdjustment,
  };
};
