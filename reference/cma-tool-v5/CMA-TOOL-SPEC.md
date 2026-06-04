# CMA Pricing Intelligence Tool — Specification Document

**Version:** 5.x (latest stable)
**Built for:** The Liz Team Realty (Limarys Hernandez, licensed realtor)
**Purpose:** Generate defensible, agent-friendly CMA pricing analyses that blend MLS comp data with experienced agent judgment.
**Reference file:** `index.html` (single-file React app)

---

## CORE PHILOSOPHY

This tool is designed around four hard-won principles that should NEVER be compromised in future development:

### 1. The agent's judgment is the senior authority, not the math
The tool structures data and shows what the math suggests, but the final number is set by the listing agent's in-person walkthrough judgment. The Manual Price Override field exists specifically to honor this. Liz has information the data cannot capture (smell, layout flow, neighborhood vibe, marketing potential), and the tool must respect that.

### 2. Real-world market behavior beats computed comp medians
When a home is already on the market and stale, the tool MUST listen to what the market has already said. A home that has failed at $615K for 56 days cannot be recommended at $659K just because comp math suggests it. The Current Listing Override exists for this reason.

### 3. Directional discipline on adjustments
Features have known real-world directions that override what small-sample comp data might suggest:
- Pools ADD value (private), are neutral (community), or have no effect (none)
- No pool is NEVER a positive adjustment
- Water views ADD value (3-5%)
- Bad condition SUBTRACTS value
- The tool must enforce these directions even when comp data is noisy

### 4. Realistic recommendations sellers will actually accept
A reduction recommendation must be something a seller might realistically do. Telling someone to drop 14% in one move is functionally telling them to fire you. The tool caps reductions at 8% off current price as an absolute ceiling.

---

## ARCHITECTURE OVERVIEW

Single-file React application:
- React 18 via CDN (`unpkg.com/react@18`)
- Babel standalone for in-browser JSX transformation
- PapaParse for CSV parsing
- No build step, no npm dependencies
- Single `index.html` file that runs in any modern browser

State management: useState + useMemo hooks. No Redux, no Context. All state lives in the App component.

Two views, toggled by `mode` state:
- **Agent View** (default): full data entry, analysis, override controls
- **Seller Report**: print-optimized presentation for delivering to sellers

Wrapped in a custom ErrorBoundary class component to prevent blank-page crashes when any render error occurs.

---

## DATA INPUT FLOW

### 1. CSV Upload
Tool accepts MLS export CSV (typically Stellar MLS in this region). Required columns include:
- Address, City, Zip, Legal Subdivision Name
- Heated Area (sqft), Beds, Year Built
- Pool, View, Water View, Lot Size Acres, Stories/Levels, Garage Spaces
- Current Price, LP/SqFt, SP/SqFt
- Close Date, On Market Date, CDOM, ADOM
- Status (SLD, PND, ACT, EXP)
- Sold Terms, List Agent, Selling Agent

The MLS Search Setup guide (collapsible section at top of tool) explains exact MLS parameters to set for pulling comps:
- Status: All four (Sold + Pending + Active + Expired)
- Sqft: subject ±15-20%
- Beds: subject ±1
- Year built: subject ±10 years
- Close date: last 6 months primary, expand to 9-12 if needed
- No filter on pool or lot size (tool handles adjustments)

### 2. Subject Property Entry
Required: Heated Sqft
Recommended: Address, Beds, Year Built, Lot Size

### 3. Condition Tier (CRITICAL — from in-person walkthrough)
5 tiers with associated multipliers:
- **Premium / Recently Renovated**: +7%
- **Move-In Ready**: baseline (0%)
- **Original but Maintained**: −4%
- **Original + Needs Work**: −10%
- **Major Updates Needed**: −17%

This is the single most impactful adjustment in the tool. It cannot be derived from MLS data — it requires Liz's walkthrough judgment. Photos can be uploaded to a chat with Claude for a second-opinion condition tier assessment.

### 4. Lot Quality
5 tiers:
- **Premium Lot**: +5%
- **Above-Average Lot**: +2%
- **Standard Lot**: baseline
- **Below-Average Lot**: −3%
- **Problem Lot**: −7%

### 5. Features
- Pool: Private / Community Only / None
- Stories: 1 or 2
- Garage Spaces: 1-4
- Water View (checkbox)
- Golf View (checkbox)

### 6. Currently Listed Panel (optional, but critical when applicable)
- Current List Price
- Days on Market
- Total $ Reduced from original list price (e.g., listed at $659K → now $614,999 = enter 44000)
- Showing Activity: High / Moderate / Low / None
- Offers Received: None / Lowball only / Reasonable but rejected / Multiple

### 7. Manual Price Override (optional)
- Your List Price (overrides all calculated tier prices)
- Why this number? (optional note shown in final report)

### 8. Carrying Cost (optional, for Cost of Waiting calc)
- Monthly HOA, Annual Property Tax, Annual Insurance, Mortgage P&I

---

## CORE MATH (must be preserved exactly in any port)

### Outlier Detection (MAD-based)
Comps with effective $/sqft more than 2.5× median absolute deviation from the median are flagged as outliers and **auto-excluded from tier calculations** even if the agent selects them. Threshold uses `max(mad * 2.5, median * 0.40)` to handle low-variance comp sets.

### Base Value
```
baseValue = median($/sqft across non-outlier selected comps) × subject sqft
```

### Adjustments (applied in order, all on top of baseValue)

**Pool adjustment:**
- Subject has PRIVATE pool: + premium (data-driven if available, capped at 1.5× FL rule of thumb; falls back to FL rule of thumb if comp data inconclusive)
- Subject has COMMUNITY pool: 0 (neutral)
- Subject has NO pool: 0 OR small negative IF comp set is ≥40% private-pool homes
- FL rule of thumb pool premiums by price band:
  - Under $500K: $15K
  - $500K-$700K: $22K
  - $700K-$1M: $30K
  - $1M-$1.5M: $40K
  - $1.5M+: $50K
- NEVER positive for no-pool homes

**Story adjustment:** Requires 3+ comps in each bucket. Capped at ±5% of base value.

**Garage adjustment:** Per-space differential scales with price band ($12K under $600K, $18K $600K-$1M, $25K over $1M).

**Water view:** Capped at 5% of base OR $30K, whichever is lower. Falls back to FL rule of thumb when comp data insufficient.

**Golf view:** Capped at 6% of base OR $40K, applied at 75% of cap as moderate baseline.

**Bed count:** 3% per bedroom difference from comp median, capped at ±$25K per bedroom diff.

**Sqft mismatch:** Only fires if >15% difference from comp avg. Uses 0.2 multiplier, capped at ±5%.

**Condition tier:** baseValue × tier % (see tier table above).

**Lot quality:** baseValue × tier % (see tier table above).

**Upgrades:** Sum of (cost × recovery rate) for checked items from upgrade library.

**Market direction:** Forward adjustment based on annualized trend × (medianAdom / 365).

### Market Direction Auto-Detect
- Requires minimum **6 sold comps** with close dates for auto-detection (was 4, raised to prevent noise)
- Hard cap at ±15% annualized to prevent sample-size artifacts
- Compares first half vs second half mean $/sqft, divided by years between midpoints

### Tier Calculation (Standard, non-override)
All three tiers anchor to the SAME calculated expected sale price — they represent STRATEGY differences, not different valuations of the home.

- Market tier (anchor): Expected sale ÷ list-to-sale ratio
- Aggressive: Market × 1.06 (6% higher list — test the top)
- Quick Sale: Market × 0.96 (4% lower list — generate multiple offers)

Typical realistic spread: $60-80K total between Aggressive and Quick Sale, NOT $200K+.

### Tier Calculation (Override Mode)
Fires when `isCurrentlyListed` AND listing has failed (combination of DOM staleness + offer status):
- `staleness = DOM / max(medianAdom, 30)`
- `listingFailed = true` if:
  - staleness ≥ 2.0 AND (showings === 'low' || 'none')
  - OR staleness ≥ 1.5 AND offers === 'none' AND showings !== 'high'
  - OR staleness ≥ 2.5 regardless of other factors

**Staleness Depth Classification** (combines DOM + prior reductions):
- Reduction signal: ≥5% prior cuts = 2 pts, ≥2% = 1 pt, else 0
- DOM signal: staleness ≥2.0 = 2 pts, ≥1.5 = 1 pt, else 0
- Total ≥3 → **Deeply stale**
- Total ≥2 → **Moderately stale**
- Else → **Barely stale**

**Override Tier Cuts** (% off current price, hard 8% ceiling):
| Tier | Barely | Moderate | Deeply |
|---|---|---|---|
| Light Reset | 2.0% | 2.5% | 3.0% |
| Moderate Reset | 4.0% | 4.5% | 5.0% |
| Aggressive | 6.0% | 7.0% | **8.0% (ceiling)** |

When `currentIsBelowComps`: all tiers use straight percentage cuts.
When current ≥ comp-supported: moderate tier can anchor to compSupportedList if it falls within the realistic moderate range (94-97% of current).

**Post-Reduction DOM estimates:**
- Light Reset: 25-30 days (modest activity bump)
- Moderate Reset: 14-18 days (real activity surge)
- Aggressive: 7-10 days (multiple offers, fast clear)

DOM estimates are AFTER the reduction takes effect, not total days since original listing. Labels in UI explicitly say "Sells in (after reduction)".

### Manual Override
When `manualPriceOverride` is set, replaces all tiers with:
- Aggressive: manual × 1.04
- Recommended: manual (rounded)
- Quick Sale: manual × 0.97

Verdict shows "Liz's recommended price" with green confirmation banner and reasoning note.

### Price Rounding
- $1M+: round to $25K, subtract $1K (e.g., $1,249,000)
- $500K-$1M: round to $5K, subtract $1K (e.g., $649,000)
- Under $500K: round to $5K, subtract $1K

The "minus $1K" pattern (e.g., $599,000 vs $600,000) is psychologically important and built in.

---

## UI DESIGN PRINCIPLES

### Color Palette (Seller Report)
Strict ink-friendly palette:
- White backgrounds throughout (no dark gradients — those waste printer ink)
- Black for headings and bold elements
- Three shades of gray (#666, #888, #ddd) for hierarchy
- Red accent (#c8102e) used only for eyebrow labels, key insights, and recommended/danger indicators (~5% of total ink)

### Print Optimization
- Designed to fit 3 pages letter size with default 0.35in margins
- Smaller display sizes in `@media print` (96px hero → 56px, 64px title → 36px)
- Section padding reduced from 48px to 18px in print
- All backgrounds force white in print
- Page breaks avoid at section level but not aggressive (let content flow naturally)

### Agent View Layout
Numbered sections (01-11):
1. DATA — CSV upload
2. SUBJECT — property details, condition, lot, features, currently-listed panel, manual override, carrying costs
3. COMPS — filterable table with status pills, outlier flags
4. UPGRADES — checkbox grid with recovery rates
5. MARKET DIRECTION — auto-detect or manual override
6. INVENTORY — months supply, market type
7. ADJUSTMENTS — full pricing build-up table (the "why is your number that?" answer)
8. VERDICT — the headline price with override warnings
9. STRATEGY — three tier cards
10. COST OF WAITING — carrying cost math (only if entered)
11. BUYER AGENT OUTREACH — selling agents with 2+ deals in dataset

### Critical UI Patterns
- Outlier comps shown with red "OUTLIER" badge in comp table
- Override mode shows prominent warning box explaining staleness depth and reasoning
- Manual override mode shows green confirmation banner with Liz's reasoning note
- DOM labels say "Sells in (after reduction)" when override mode active
- Total $ Reduced field has helper note explaining what to enter

---

## KNOWN ISSUES / FUTURE WORK

### Caught and fixed during development
- Duplicate `preAdjustedValue` declaration caused blank page (parse error)
- `naturalSpread` reference after tier rewrite caused runtime crash (caught by error boundary)
- Pool adjustment was directionally wrong (giving credit for "no pool")
- Tier spread was $200K (too wide) — fixed by anchoring tiers to single expected sale
- Override mode applied mechanical % cuts instead of using comp anchors
- Market direction auto-detect produced +26% wild trends from 4 comps with one outlier

### Open ideas for future versions
- Photo upload directly in tool (currently photos go to a separate Claude chat — workflow guide below)
- Pre-listing walkthrough checklist (8 questions: roof age, HVAC age, kitchen condition, etc.)
- Confidence indicator on final price
- Net sheet integration (cost of waiting × probability of various outcomes)
- Mobile-responsive overhaul (currently works on mobile but cramped)
- Save/load CMA sessions (currently no persistence)

---

## WORKFLOW INTEGRATION WITH AI VISION

The tool deliberately does NOT include photo upload for condition assessment. The recommended workflow is:

1. Liz walks through the home, takes 8-10 photos (kitchen, baths, flooring, living room, primary bedroom, exterior)
2. Liz opens a chat with Claude (claude.ai), drops in the photos
3. Asks: "What condition tier would you put this home in for pricing purposes?"
4. Claude returns a tier recommendation with specific evidence
5. Liz enters that tier into the CMA tool

This separation gives the best of both worlds: richer AI analysis (with follow-up questions possible) for condition, and structured math for everything else.

A future TransactPro integration COULD add direct photo upload with API integration, but the chat-based workflow is recommended unless there's strong demand otherwise.

---

## CRITICAL DEVELOPMENT WORKFLOW

When making changes to this tool:

1. **Always parse-check before deploying.** A blank page from a JavaScript syntax error has cost real time in this project. Use:
   ```
   node /tmp/parse-test.js  (or equivalent babel.transform check)
   ```

2. **The error boundary catches runtime crashes** but does not prevent them. After significant changes, manually test the critical paths:
   - Load CSV → select comps → enter sqft (analysis fires)
   - Toggle currently listed on/off
   - Toggle Seller Report ↔ Agent View
   - Click Select All / Clear
   - Set manual override

3. **Never break the Manual Override path.** If a user enters a manual price, that price MUST appear in the verdict. This is non-negotiable.

4. **Math changes need re-validation against the Budworth Circle reference case:**
   - Subject: 14030 Budworth Cir, 2541 sqft, 4BR, 2005, 2-story, 2-car, no pool, water view
   - Condition: Original + Needs Work
   - Currently listed: $614,999, 56 DOM, $44K reduced, Low showings, No offers
   - Expected output: Light Reset around $596K, Moderate around $584K, Aggressive around $566K
   - If output differs significantly, something has regressed.

---

## TRANSACTPRO INTEGRATION NOTES

When porting to TransactPro:

### Data Model Changes
- Currently all state lives in component state (lost on page refresh)
- TransactPro should persist CMAs to the database with:
  - `cma_id` (UUID)
  - `subject_property_id` (FK to listings or properties table)
  - `comps_used` (JSON array of MLS IDs)
  - `condition_tier`, `lot_quality`, `manual_override`, etc.
  - `recommended_price`, `tier_prices` (JSON)
  - `created_by_agent_id`, `created_at`, `updated_at`
  - `seller_report_pdf_url` (if generated)

### MLS Integration
- Currently requires manual CSV export from MLS
- TransactPro should integrate with Stellar MLS API (or Trestle/MLS Grid) to pull comps directly by subdivision + criteria
- The MLS Search Setup guide content can become a help tooltip rather than a section

### Multi-Agent Use
- Currently designed for single-user (Liz)
- TransactPro will have multiple agents — CMAs should be visible to agent + team admin
- Brokerage-level adjustment overrides could be added (e.g., a brokerage sets the FL pool premium values)

### Print/PDF Generation
- Currently uses browser print
- TransactPro should generate PDFs server-side (or use a service like Puppeteer) for consistent output
- Email-to-seller functionality with tracked open rates

### Suggested Component Split (when moving from single file)
- `CMAAnalysisProvider` — context for the calculated analysis
- `MLSGuide` — collapsible reference (already a standalone component)
- `CompTable` — filterable comp selection
- `SubjectForm` — property + condition + lot inputs
- `CurrentListingPanel` — DOM/reductions/showings inputs
- `ManualOverrideCard` — manual price override
- `AdjustmentsBreakdown` — the pricing build-up table
- `Verdict` — headline price + warnings
- `TierStrategy` — three tier cards
- `CostOfWaiting` — carrying cost math
- `BuyerAgentOutreach` — selling agents list
- `SellerReportView` — the entire print-optimized seller view
- `TrendChart` — already a standalone component
- `useAnalysis(selected, subject, upgrades, marketOverride, outlierInfo)` — custom hook wrapping the giant useMemo

### Reference Files to Carry Forward
1. `index.html` — current working tool (source of truth)
2. `CMA-TOOL-SPEC.md` — this document
3. Sample MLS CSV (for testing) — Lake Nona area inventory weekly.csv
4. Budworth Circle reference outputs (for regression testing)

---

## SESSION HISTORY SUMMARY

This tool was built across an extended conversation between Carlos Hernandez (operating partner at The Liz Team Realty) and Claude. Key milestones:

- **v1-v3**: Initial build with basic median-based pricing, upgrade library, three-tier strategy
- **v4**: Added MLS Search Setup guide, outlier detection, three-tier pool classification, story/garage/lot adjustments, buyer agent outreach
- **v4.x**: Multiple rounds of math fixes for pool directional logic, tier spread, view adjustments
- **v5.0**: Major release adding Condition Tier, Lot Quality, Currently Listed Panel, Manual Override, Current Listing Override mode
- **v5.x**: Multiple fixes for: tier spread (anchoring to single expected sale), override math (sold-comp anchors instead of % cuts), staleness depth classification, realistic reduction ranges (capped at 8%), market direction auto-detect (6 comp minimum, ±15% annualized cap), DOM labeling clarity (post-reduction vs total)

The conversation also introduced workflow innovations:
- Photo-based condition assessment via separate Claude chat (deliberately not built into tool)
- Manual override as the ultimate agent-judgment lever
- Override mode for listings that have already failed at their current price

---

## CONTACT / OWNERSHIP

- **Tool owner**: Carlos Hernandez (operating partner)
- **Primary user**: Limarys Hernandez ("Liz"), licensed realtor
- **Markets served**: Orange, Osceola, Seminole, Polk counties (Central Florida)
- **Brokerage**: The Liz Team Realty
- **Future home**: TransactPro SaaS platform (under development)
