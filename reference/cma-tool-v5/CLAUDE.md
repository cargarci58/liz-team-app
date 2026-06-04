# CLAUDE.md — Operating Instructions for the CMA Pricing Tool

This file is automatically read by Claude Code at the start of every session. It contains the operating principles, constraints, and reference points for working on the CMA Pricing Intelligence tool inside TransactPro.

**If you are Claude Code and you are reading this:** stop and absorb this file completely before writing any code. The instructions here have direct authority over your default behavior.

---

## WHO THIS TOOL IS FOR

The CMA Pricing Intelligence tool serves Limarys Hernandez ("Liz"), a licensed Realtor at The Liz Team Realty (Central Florida — Orange, Osceola, Seminole, Polk counties). It is operated and owned by Carlos Hernandez. The tool generates Comparative Market Analysis pricing recommendations from MLS comp data plus the agent's in-person walkthrough judgment.

This is a real tool used in real listing appointments with real sellers. Math errors cost the brokerage money. Confusing UI loses listings. Over-aggressive pricing alienates sellers. Under-aggressive pricing leaves money on the table. **Every decision in this code was made deliberately based on real-world feedback from real CMAs.**

---

## THE PRIME DIRECTIVE

**This tool is a PORT, not a REWRITE.**

The reference implementation at `reference/cma-tool-v5/index.html` went through 5+ versions of iteration across many sessions to land on the current math and design. The current behavior is correct. Your job is to preserve that behavior while improving the code's organization, type safety, testability, and integration with TransactPro infrastructure.

**Refactor structure freely. Never change behavior without explicit approval from Carlos.**

When you see something that looks suboptimal, your default assumption must be: *"there's a reason this is this way."* Not: *"I should improve it."*

Ask before changing anything algorithmic. Always.

---

## THE FOUR CORE PHILOSOPHY PRINCIPLES

These are non-negotiable. Any change that violates these is a regression, regardless of how clean the code looks.

### 1. The agent's judgment is the senior authority, not the math
The Manual Price Override field MUST always take priority over all calculated values. If Liz enters $599,000, the recommended price is $599,000. Period. The comp math is advisory; the agent's walkthrough judgment is final.

### 2. Real-world market behavior beats computed comp medians
When a home is already on the market and stale, the tool MUST listen to what the market has already said. A home that has failed at $615K for 56 days cannot be recommended at $659K just because comp math suggests it. The Current Listing Override exists for this reason.

### 3. Directional discipline on adjustments
Features have known real-world directions:
- Private pools ADD value
- Community pools are neutral
- No pool is NEVER a positive adjustment
- Water views ADD value
- Bad condition SUBTRACTS value
- Good condition ADDS value

If a small comp set produces data that contradicts these directions (e.g., no-pool homes selling higher than pool homes in your specific 8-comp set), **trust the direction, not the noisy data.** Fall back to Florida rules of thumb.

### 4. Realistic recommendations sellers will actually accept
A reduction recommendation must be something a seller might realistically agree to. The 8% reduction ceiling exists because telling a seller to drop 14% in one move is functionally telling them to fire you. If the math wants a bigger cut, the conversation isn't "cut more" — it's "delist and revisit in 3-6 months."

---

## HARD RULES (NEVER VIOLATE)

These rules have been tested against real CMAs and corrected when broken. Each one represents a class of bug that has happened before.

### Rule 1: 8% reduction ceiling
No reduction tier may EVER recommend more than 8% off current price as a default. The ceiling applies regardless of staleness depth. If the math suggests >8%, cap at 8%.

### Rule 2: Pool directional discipline
No-pool subjects can never receive a positive pool adjustment. Period. If the math says they should, the math is wrong (small-sample noise). Apply zero or fall back to FL rule of thumb negative.

### Rule 3: Manual Override takes absolute priority
When `manualPriceOverride` is set to any value > 0, ALL three tier prices recalculate around that value. The comp math, the current listing override, the staleness depth, the market direction — none of them override the manual price. Liz's judgment wins.

### Rule 4: Outliers are auto-excluded from tier math
Comps flagged as outliers (MAD-based detection) must be excluded from all tier calculations even if the agent has selected them. They can appear in the comp table for context, but they cannot influence the recommended price.

### Rule 5: Auto market direction requires 6+ sold comps
Below 6, the tool reports "Insufficient data" and asks the agent to use Manual Override. This prevents wild trends from small samples (e.g., the +26% bug we fixed where 4 comps with one outlier produced a nonsensical trend).

### Rule 6: Annualized market direction caps at ±15%
Any trend stronger than that is almost certainly a sample-size artifact, not real market behavior. Hard cap.

### Rule 7: Three tiers anchor to the same expected sale (standard mode)
Aggressive = Market × 1.06. Quick Sale = Market × 0.96. They represent STRATEGY differences on the same home, not different valuations. Total spread should be ~$60-80K on a $650K home, not $200K+.

### Rule 8: Override mode uses current price as anchor, not comp math
When override fires, tier prices are calculated as percentages off the current failed list price (using the staleness-depth cut table), NOT as percentages off comp-supported value. The market has already told us what the comp math is missing.

### Rule 9: DOM in override mode = "after reduction," not total
UI labels must say "Sells in (after reduction) ~14 days" not just "Expected DOM ~14 days." The seller has been waiting 56 days already; the new clock starts after the price cut.

### Rule 10: Price rounding uses the minus-$1000 pattern
$599,000 not $600,000. $1,249,000 not $1,250,000. The psychological breakpoint matters. Never round to even numbers.

---

## THE BUDWORTH REGRESSION TEST

The Budworth Circle CMA is the canonical test case. The full inputs and expected outputs are in `BUDWORTH-REGRESSION-TEST.md`. Run this test after any change to the calculation logic.

**Key expected values:**
- Base value: ~$675,982 (median $266/sqft × 2,541 sqft)
- Water view adjustment: +$18,000 (capped)
- Condition (−10%): −$67,598
- Override mode fires: YES
- Staleness depth: DEEPLY stale
- Light Reset: ~$596,000 (3% off $615K current)
- Moderate Reset: ~$584,000 (5% off)
- Aggressive: ~$566,000 (8% off — hard ceiling)
- Manual Override at $599,000 produces $599,000 recommendation

**If any of these values drift by more than ~1.5%, something has regressed.** Stop and investigate before continuing.

---

## REFACTORING DISCIPLINE

When asked to refactor or reorganize code:

### DO
- Split the monolithic App component into the structure outlined in `MIGRATION-PLAN.md`
- Extract math helpers to `src/cma/lib/` files with proper TypeScript types
- Add comprehensive Jest unit tests using the Budworth case as the baseline
- Move hardcoded brokerage constants to database-backed config (pool premiums, condition tier %, upgrade library, etc.)
- Replace browser print with server-side PDF generation
- Replace CSV upload with MLS API integration (Phase 3 only — keep CSV working in earlier phases)
- Add TypeScript types for all data shapes
- Add proper persistence (database, REST endpoints) per the schema in `MIGRATION-PLAN.md`

### DON'T
- "Simplify" the override mode logic by removing staleness depth classification
- Replace the discrete tier cut lookup table with a "cleaner" formula
- Unify the standard tier path and override tier path — they are intentionally separate
- Change pool/condition/lot tier percentages without explicit approval
- Remove the Manual Override field, or bury it in a settings menu
- Change the price rounding pattern to round numbers
- "Polish" the Seller Report with gradients, color blocks, or any visuals beyond the current ink-friendly palette (white + black + grays + minimal red accent)
- Modify the FL rule-of-thumb fallback values for pool premiums, view premiums, etc.
- Remove the outlier exclusion logic
- Remove the ErrorBoundary wrapper around App
- Touch the math without running the Budworth regression test first

---

## WRITE TESTS BEFORE REFACTORING

Before touching any calculation logic during a refactor, write Jest tests that lock in the current behavior. At minimum, the test suite must cover:

1. Budworth inputs produce Budworth outputs (within tolerance from regression doc)
2. Manual Override at any value produces that exact value as the recommended tier (rounded)
3. A no-pool subject never receives a positive pool adjustment, no matter what the comp set looks like
4. Reduction tiers never exceed 8% off current price
5. Auto market direction with 5 or fewer sold comps returns "Insufficient data"
6. Outlier comps in the input set don't affect the median $/sqft used in base value
7. Override mode fires when DOM ≥ 1.5x normal AND offers = 'none' AND showings != 'high'
8. Override mode fires when listing is below comp-supported value AND has failed (not just above)

Only after these tests pass against the ported code may you begin restructuring the implementation.

---

## SESSION AMNESIA WARNING

You (Claude Code) have no memory of the conversations that built this tool. You did not live through:

- The version where tier spreads were $200K wide because we used P90/P10 percentiles
- The version where no-pool homes got positive pool adjustments because comp data noise pointed that direction
- The version that recommended 14% cuts to "deeply stale" listings
- The auto market direction reading +26% from 4 comps with one outlier
- The blank-page crashes from unguarded `analysis.marketDirection` access
- The duplicate `preAdjustedValue` declaration that broke everything
- The 6-page seller report problem from oversized print typography
- The condition tier oversight that recommended $759K for a home that wasn't selling at $615K

Each of these was a real bug that was found and fixed. The current implementation is the result of finding and fixing every one of them. When you see something that looks "unnecessarily complex," your assumption should be that there's history behind it.

---

## INTERACTION PATTERN WITH CARLOS

Carlos is not a programmer. He's a former IT CTO who manages this project but does not personally write the code. When you communicate with him:

- Don't explain code line by line — he doesn't need that
- Don't ask him to debug — he can't
- Don't suggest browser console commands — give Terminal commands or SQL only when needed
- Don't ask "should we save this for later?" — keep moving unless there's a genuine architectural decision
- When something is genuinely uncertain or has tradeoffs, present the options clearly and let him decide
- He values directness, follow-through, and not having to babysit the work
- He values honesty about what didn't work or what you're uncertain about

When you complete work, give him a brief summary of what changed, why it changed, and what to test. Keep it short and substantive.

---

## SANITY CHECK QUESTIONS

Before doing any algorithmic work, Carlos may quiz you on these. If you can't answer them correctly, re-read the spec files.

1. **What should you do if you see a no-pool subject getting a positive pool adjustment in the code?**
   → That's a regression. Directional discipline says no-pool can never be positive. Fix the bug.

2. **If the math says recommend a 12% cut for a stale listing, what do you do?**
   → Cap at 8%. The ceiling is non-negotiable. If math wants 12%, the conversation is "delist and revisit," not "cut more."

3. **The agent sets Manual Override to $599,000 but the comp math says $635,000. What price do we show the seller?**
   → $599,000. Agent judgment is final. Manual Override takes priority over all comp math.

4. **You're refactoring the override logic and notice it could be simplified by removing the staleness depth tiers. What do you do?**
   → Stop. Don't change algorithmic behavior. The staleness depth classification is intentional. Refactor structure, not behavior.

5. **A new feature request would require recommending cuts up to 12%. What do you do?**
   → Bring it to Carlos. The 8% ceiling is a product decision, not a math limit. Don't unilaterally raise it.

---

## REFERENCE FILES IN THIS DIRECTORY

- `CMA-TOOL-SPEC.md` — Full design specification (math, philosophy, UI principles)
- `MIGRATION-PLAN.md` — Step-by-step migration from HTML to TransactPro
- `BUDWORTH-REGRESSION-TEST.md` — Canonical test case with expected outputs
- `cma-tool-v5/index.html` — The working reference implementation (source of truth)

Read these in the order listed above before starting any work on the CMA tool.

---

## COMMITMENT

By reading this file, you commit to:

1. Reading the three other reference files before writing any code
2. Treating the existing implementation as correct unless explicitly told otherwise
3. Writing tests that lock in current behavior before refactoring
4. Asking Carlos before changing any algorithmic behavior
5. Running the Budworth regression test after any math-touching change
6. Not introducing "improvements" that violate the four core philosophy principles or the ten hard rules

If you understand and accept these constraints, summarize them back to Carlos in 4-6 sentences before doing any work, so he knows you have the context loaded.
