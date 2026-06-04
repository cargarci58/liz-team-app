# Budworth Circle CMA — Regression Test Reference

This file captures the expected outputs of the CMA tool for the Budworth Circle test case as of v5.x.
Use this to verify that math has not regressed during migrations or refactors.

---

## Test Case Inputs

**Subject Property:**
- Address: 14030 BUDWORTH CIR, ORLANDO, FL 32832
- Heated Sqft: 2,541
- Beds: 4
- Year Built: 2005
- Lot Size: 0.12 acres
- Pool: No pool at all
- Stories: 2 Story
- Garage: 2-car
- Water view (pond/lake): YES
- Golf view: No

**Liz's Walkthrough Judgment:**
- Condition Tier: Original + Needs Work (−10%)
- Lot Quality: Standard Lot (baseline)

**Currently Listed:**
- Current List Price: $615,000
- Days on Market: 56
- Total $ Reduced So Far: $44,000
- Showing Activity: Low (1/week or less)
- Offers Received: None
- (Original list price reconstructs to $659,000)

**Manual Override:** None set (for baseline test)

**Carrying Cost:**
- Monthly HOA: $205
- Annual Property Tax: $12,000
- Annual Insurance: $3,500
- Mortgage P&I: $6,500

**Comp Set (10 selected from Lake Nona area inventory):**
- 10459 Stapeley Dr — SLD, 2,910 sqft, 2013, Private pool, $700,000, $241/sqft
- 12827 Oulton Cir — ACT, 2,885 sqft, 2005, Private pool, $678,000, $235/sqft
- 10825 Tilston Pt — SLD, 2,896 sqft, 2005, Community, $640,000, $221/sqft
- 9920 Chorlton Cir — PND, 2,195 sqft, 2005, Community, $599,000, $273/sqft
- 10736 Mere Pkwy — ACT, 2,180 sqft, 2005, Community, $565,000, $259/sqft
- 13066 Hatherton Cir — SLD, 2,956 sqft, 2006, Community, $580,000, $196/sqft
- 10429 Stapeley Dr — ACT, 2,193 sqft, 2013, None, $650,000, $296/sqft
- 13060 Hatherton Cir — ACT, 2,560 sqft, 2007, None, $699,500, $273/sqft
- 8419 Prestbury Dr — SLD, 2,177 sqft, 2010, Private, $650,000, $299/sqft
- 8162 Prestbury Dr — EXP, 2,552 sqft, 2012, Community, $795,000, $312/sqft

**Market Direction:** Softening (manual override) — auto-detect should report "Insufficient data" with only 4 sold comps

**Upgrades:** None checked (clean test)

---

## Expected Outputs

### Comp Set Analysis
- Total comps: 10
- Sold: 4, Pending: 1, Active: 4, Expired: 1
- Outliers auto-detected and excluded: 0-1 (Hatherton at $196/sqft may flag as low outlier; tool decision)
- Median $/sqft (clean): ~$266
- Median list-to-sale ratio: ~95.4%
- Median ADOM (sold comps): ~15 days

### Adjustments Build-Up
- Base value: $266 × 2,541 = **$675,982**
- Water view (FL rule of thumb): **+$18,000** (capped at 5% of base or $30K)
- Condition (−10%): **−$67,598**
- Lot quality (baseline): **$0**
- Pool: **$0** (no-pool subject, no negative adjustment unless private-pool-heavy comp set)
- Upgrades: **$0** (none checked)
- Market direction (Softening, ~15 days forward): **~−$1,000** (very small)
- **Comp-supported sale price: ~$625,000-$635,000**

### Override Mode Detection
- DOM staleness: 56 / max(15, 30) = 56/30 = **1.87** (above 1.5 threshold)
- Offer status: None
- Showing activity: Low
- → **Listing failed: TRUE**
- → **Override mode activates**
- → currentIsBelowComps: $615,000 < ~$665K comp-supported list → **TRUE**

### Staleness Depth
- Reduction signal: $44K / $659K = 6.7% reduction → 2 points
- DOM signal: staleness 1.87 (above 1.5, below 2.0) → 1 point
- Total: 3 points → **DEEPLY stale**

### Override Tiers (DEEPLY stale, applied to currently below comps)
- Light Reset: $615,000 × 0.97 = **~$596,000** (3% off)
- Moderate Reset: $615,000 × 0.95 = **~$584,000** (5% off)
- Aggressive: $615,000 × 0.92 = **~$566,000** (8% off — hard ceiling)

### DOM Estimates (After Reduction)
- Light Reset: ~30 days after reduction
- Moderate Reset: ~18 days after reduction
- Aggressive: ~10 days after reduction

### Cost of Waiting Calculation
Monthly carry: $205 + $12,000/12 + $3,500/12 + $6,500 = **~$7,996/month**
- 90 days: ~$23,988
- 180 days: ~$47,976

### Verdict Warning Box Should Display
"⚠ Current listing override active. This home has been listed at $615,000 for 56 days. Listed 56 days (1.9x normal DOM) with no offers received. Already cut $44,000 from original list price of $659,000 — that's a 6.7% reduction already absorbed by the market with no offers.

Staleness depth: DEEPLY stale. The home has been deeply rejected by the market — gentle reductions have already been tried and failed. The next cut needs to be aggressive (5%+) to find a new buyer pool.

The comp math says this home should sell around ~$625K-635K, but the home has been listed below that and still hasn't sold. That's a strong signal the comp math is overestimating..."

### Manual Override Test
If `manualPriceOverride = 599000`:
- Verdict should show "Liz's recommended price: $599,000"
- Three tiers become: Aggressive $623K, Recommended $599K, Quick Sale $581K
- Green confirmation banner with optional note
- Override mode warning is hidden when manual override is active

---

## Regression Thresholds

If any of these numbers differ by more than **1.5%** from migration, investigate:

| Metric | Expected | Tolerance |
|---|---|---|
| Base value | $675,982 | ±$5,000 |
| Water view adj | $18,000 | ±$500 |
| Condition adj | −$67,598 | ±$500 |
| Comp-supported sale | $625K-$635K | ±$5,000 |
| Light Reset tier | $596,000 | ±$3,000 |
| Moderate Reset tier | $584,000 | ±$3,000 |
| Aggressive tier | $566,000 | ±$3,000 |

If anything moves more than that, check:
1. Did pool logic change direction?
2. Did override cuts change percentages?
3. Did staleness depth classification logic change?
4. Did the water view cap change?

---

## Quick Sanity Tests

Before declaring a migration successful, run these spot-checks:

1. ✅ Enter the inputs above
2. ✅ Verify override warning appears with DEEPLY stale classification
3. ✅ Verify Light Reset is ~$596K (within tolerance)
4. ✅ Verify Aggressive does NOT exceed 8% off current ($566K is the floor)
5. ✅ Toggle Manual Override to $599,000 — verify it overrides everything
6. ✅ Clear Manual Override — verify tiers return
7. ✅ Toggle off Currently Listed — verify normal (non-override) tier mode resumes
8. ✅ Toggle Seller Report — verify it renders without crashing
9. ✅ Click Select All Visible — verify no blank page
10. ✅ Click + New CMA — verify state clears cleanly
