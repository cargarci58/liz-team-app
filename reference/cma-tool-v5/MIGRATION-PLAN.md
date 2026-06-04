# CMA Tool → TransactPro Migration Plan

## Goal
Port the standalone CMA HTML tool into TransactPro as a first-class feature, accessible from the agent dashboard with full database persistence, multi-agent support, and MLS API integration.

---

## STEP 1: Reference Files (Save These First)

Before starting any migration work, save these files to your TransactPro repo under a dedicated directory:

```
~/Downloads/LizTeamCode/
└── transactpro/
    └── reference/
        └── cma-tool-v5/
            ├── index.html                    ← the working standalone tool
            ├── CMA-TOOL-SPEC.md              ← design spec (what + why)
            ├── MIGRATION-PLAN.md             ← this file
            └── reference-cma-output.txt      ← Budworth CMA output for regression testing
```

The `index.html` is your source of truth. Every algorithmic decision, every adjustment formula, every override condition is in there. When in doubt, check the file.

---

## STEP 2: Starting a New Claude Session for TransactPro Work

When you're ready to start building this into TransactPro, open a new Claude Code session (or new chat) and use this prompt template:

```
I'm porting a standalone CMA pricing tool into my TransactPro SaaS app. The tool 
is a single-file React HTML app that uses MLS CSV exports to generate CMA pricing 
analyses for The Liz Team Realty.

Reference materials are in: ~/Downloads/LizTeamCode/transactpro/reference/cma-tool-v5/

Please start by reading these three files in order:
1. CMA-TOOL-SPEC.md (the design specification and philosophy)
2. MIGRATION-PLAN.md (this migration plan)
3. index.html (the working code — this is the source of truth for any algorithm 
   questions)

After reading, summarize back to me what the tool does and what the key design 
constraints are, so I know you have the context loaded.
```

This makes the next Claude session start from a position of full knowledge rather than rebuilding context from scratch.

---

## STEP 3: TransactPro Architecture Mapping

### Database schema additions

```sql
CREATE TABLE cmas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) NOT NULL,
  brokerage_id UUID REFERENCES brokerages(id) NOT NULL,
  
  -- Subject property
  subject_address TEXT,
  subject_sqft INTEGER NOT NULL,
  subject_beds INTEGER,
  subject_year_built INTEGER,
  subject_lot_acres NUMERIC(5,2),
  subject_pool_type TEXT CHECK (subject_pool_type IN ('private','community','none')),
  subject_stories INTEGER,
  subject_garage_spaces INTEGER,
  subject_has_water_view BOOLEAN DEFAULT FALSE,
  subject_has_golf_view BOOLEAN DEFAULT FALSE,
  
  -- Liz's walkthrough judgment
  condition_tier TEXT CHECK (condition_tier IN ('premium','move_in','original_maintained','needs_work','major_updates')),
  lot_quality TEXT CHECK (lot_quality IN ('premium','above_avg','standard','below_avg','problem')),
  
  -- Currently listed status
  is_currently_listed BOOLEAN DEFAULT FALSE,
  current_list_price NUMERIC(12,2),
  current_dom INTEGER,
  total_dollars_reduced NUMERIC(12,2),
  showing_activity TEXT CHECK (showing_activity IN ('high','moderate','low','none')),
  offers_received TEXT CHECK (offers_received IN ('none','lowball','reasonable','multiple')),
  
  -- Manual override
  manual_price_override NUMERIC(12,2),
  manual_price_note TEXT,
  
  -- Carrying costs
  monthly_hoa NUMERIC(10,2),
  annual_tax NUMERIC(10,2),
  annual_insurance NUMERIC(10,2),
  monthly_mortgage NUMERIC(10,2),
  
  -- Calculated outputs (snapshotted for historical record)
  recommended_list_price NUMERIC(12,2),
  expected_sale_price NUMERIC(12,2),
  tier_prices JSONB,  -- {aggressive: 699000, market: 659000, quick: 634000}
  comp_supported_value NUMERIC(12,2),
  was_overridden BOOLEAN DEFAULT FALSE,  -- did override mode fire?
  staleness_depth TEXT,
  market_direction JSONB,
  adjustments JSONB,  -- full breakdown of every adjustment applied
  
  -- Selected comps
  comps_data JSONB,  -- snapshot of comp data used (so historical CMAs remain accurate)
  
  -- Upgrades
  upgrades JSONB,
  
  -- Metadata
  market_override TEXT DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  shared_with_seller_at TIMESTAMPTZ,
  seller_report_pdf_url TEXT
);

CREATE INDEX idx_cmas_agent ON cmas(agent_id);
CREATE INDEX idx_cmas_brokerage ON cmas(brokerage_id);
CREATE INDEX idx_cmas_created ON cmas(created_at DESC);
```

### API endpoints

```
POST   /api/cmas                   Create new CMA
GET    /api/cmas/:id               Fetch a saved CMA
PUT    /api/cmas/:id               Update CMA (during editing)
DELETE /api/cmas/:id               Delete CMA
GET    /api/cmas                   List agent's CMAs (paginated)

POST   /api/cmas/:id/recalculate   Re-run analysis with updated inputs
POST   /api/cmas/:id/generate-pdf  Generate seller report PDF (server-side rendering)
POST   /api/cmas/:id/share         Email seller report to a specific email address

POST   /api/mls/search             Pull comps from MLS API by criteria
                                   (replaces CSV upload for production use)
```

### React component split

The current monolithic App component should be broken into:

```
src/cma/
├── pages/
│   ├── NewCMAPage.tsx              Entry point for creating a CMA
│   ├── CMAEditorPage.tsx           Full editor view
│   └── CMAListPage.tsx             Agent's CMA history
├── components/
│   ├── MLSGuide.tsx
│   ├── CompTable.tsx
│   ├── SubjectPropertyForm.tsx
│   ├── ConditionLotPanel.tsx
│   ├── FeaturesPanel.tsx
│   ├── CurrentListingPanel.tsx
│   ├── ManualOverrideCard.tsx
│   ├── CarryingCostPanel.tsx
│   ├── UpgradesPanel.tsx
│   ├── MarketDirectionCard.tsx
│   ├── InventoryCard.tsx
│   ├── AdjustmentsBreakdown.tsx
│   ├── Verdict.tsx
│   ├── TierStrategy.tsx
│   ├── CostOfWaiting.tsx
│   ├── BuyerAgentOutreach.tsx
│   ├── TrendChart.tsx
│   └── SellerReportView.tsx
├── hooks/
│   ├── useCMAAnalysis.ts           THE CORE — wraps the analysis useMemo
│   ├── useOutlierDetection.ts
│   └── useMarketDirection.ts
├── lib/
│   ├── calculations.ts             All math functions (median, percentile, etc.)
│   ├── pool-adjustment.ts          Pool tier logic
│   ├── condition-tier.ts           Condition multipliers
│   ├── lot-quality.ts              Lot multipliers
│   ├── override-tiers.ts           Override mode tier calculations
│   ├── format.ts                   fmtMoney, fmtPsf, etc.
│   └── upgrade-library.ts          The 18 FL-tuned upgrade items
├── types/
│   └── cma.ts                      TypeScript types
└── README.md
```

### Library constants to extract

These should become editable database records, not hardcoded:

1. **Florida pool premium by price band** — brokerage admin should be able to tune
2. **Condition tier percentages** — could vary by market
3. **Lot quality percentages** — could vary by market
4. **Upgrade library** — costs and recovery rates vary by region
5. **Reduction tier multipliers** — could be customized per brokerage

Move these from constants to a `brokerage_settings` table:

```sql
CREATE TABLE brokerage_settings (
  brokerage_id UUID PRIMARY KEY REFERENCES brokerages(id),
  pool_premiums JSONB,  -- {under500k: 15000, ...}
  condition_tier_pcts JSONB,  -- {premium: 0.07, ...}
  lot_quality_pcts JSONB,
  upgrade_library JSONB,  -- array of upgrade items
  override_cut_ranges JSONB,  -- {barely: {...}, moderate: {...}, deeply: {...}}
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## STEP 4: Phased Migration Approach (Recommended)

Don't try to port everything at once. Do it in phases:

### Phase 1: Lift-and-shift as a TransactPro page (2-3 days)
- Wrap the existing HTML tool in a TransactPro authenticated page
- Add a basic "Save CMA" button that POSTs to a CMA endpoint
- Add a "My CMAs" list page
- Keep the CSV upload workflow

### Phase 2: Component split (3-5 days)
- Break the monolith into the components listed above
- Extract calculations.ts and pool-adjustment.ts, etc.
- Add TypeScript types
- Add unit tests for the core math (using Budworth reference outputs)

### Phase 3: MLS API integration (1-2 weeks)
- Replace CSV upload with direct MLS pull
- Auto-populate subject property from MLS lookup by address
- Auto-detect outliers and pre-select reasonable comp set

### Phase 4: Polish (ongoing)
- Server-side PDF generation
- Email-to-seller workflow with open tracking
- Brokerage admin panel for tuning adjustments
- Multi-agent comparison views

---

## STEP 5: Regression Testing

The Budworth CMA is your reference case. After each migration phase, verify:

**Input:**
- Address: 14030 Budworth Cir
- Sqft: 2541, Beds: 4, Year: 2005
- Pool: None, Stories: 2, Garage: 2-car
- Water view: yes, Golf view: no
- Condition: Original + Needs Work
- Lot: Standard
- Currently Listed: $614,999, 56 DOM, $44K reduced, Low showings, No offers
- 10 selected comps from Lake Nona area
- Market: Softening (manual)

**Expected Output:**
- Override mode fires (warning visible)
- Staleness depth: DEEPLY stale
- Light Reset: ~$596,000
- Moderate Reset: ~$584,000
- Aggressive: ~$566,000
- Manual override at $599K (if set) produces $599K recommendation

If any of these numbers drift more than 1-2% during migration, something has regressed and needs investigation.

---

## STEP 6: What NOT to Change in the Migration

These are settled decisions that should be preserved exactly:

1. **Hard 8% reduction ceiling** — even deeply stale listings
2. **Pool directional discipline** — no pool never gets a positive adjustment
3. **Manual override takes absolute priority** — over all comp math
4. **The "minus $1000" rounding** — $599,000 not $600,000
5. **Outlier exclusion** — auto-excluded from tier math even if selected
6. **6-comp minimum for auto market direction** — otherwise force manual
7. **The two-mode view** — Agent vs Seller Report

If any of these change in TransactPro, it's a deliberate product decision, not a migration shortcut.
