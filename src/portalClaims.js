// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-PORTAL CLAIMS — liability-critical, pure (no React), unit-tested.
//
// Everything a SELLER/BUYER sees in their portal that asserts a FACT about their
// deal ("your home went live on the market", "you're under contract", the stage
// badge) is computed here. A wrong claim tells a client something untrue — that
// is a legal/liability problem, not a cosmetic one. So this logic lives in one
// small, isolated, React-free module that portalClaims.test.js locks down, and
// that test gates the production build (see package.json "build").
//
// Two rules enforced here:
//   1. A "strong claim" (on the market / under contract / sold) may fire ONLY
//      from the exact milestone that proves it — never a loose name match.
//   2. The displayed STAGE can never claim more than the real, agent-set
//      transaction status across the contract line: a still-"Active" listing
//      (on the market, not under contract) can NEVER be shown as Under Contract
//      or beyond, no matter what milestones happen to be checked off.
// ─────────────────────────────────────────────────────────────────────────────

export const STAGE_ORDER = ["Active", "Under Contract", "Inspection", "Appraisal", "Clear to Close", "Closed"];

// Warm, past-tense phrasing for completed milestones (the "wins" recap).
// ORDER MATTERS — first matching entry wins.
export const WIN_COPY = [
  // "Went live on the market" means the home is actually IN the MLS — NOT just
  // that the listing agreement was signed. Keep "listing agreement" OUT of this
  // pattern (it has its own win below); otherwise a seller whose paperwork is
  // signed but whose home isn't listed yet sees a false "your home is on the
  // market" — which is exactly what happened and triggered a seller complaint.
  { re: /listed in mls|property listed|active on (the )?market|go(ing)? live/i, text: "Your home went live on the market" },
  { re: /listing agreement|exclusive right/i, text: "Listing agreement signed" },
  { re: /executed|under contract|offer accepted|fully executed/i, text: "Went under contract" },
  { re: /emd|earnest/i, text: "Earnest money received" },
  { re: /inspection period|inspection (complete|done)|repair/i, text: "Inspection wrapped up" },
  { re: /appraisal received|appraisal report/i, text: "Appraisal came back" },
  { re: /appraisal ordered/i, text: "Appraisal ordered" },
  { re: /appraisal gap/i, text: "Appraised value confirmed" },
  { re: /title commitment|title search/i, text: "Title work received" },
  { re: /hoa|estoppel/i, text: "HOA documents collected" },
  { re: /property disclosure|spd|disclosure/i, text: "Disclosures completed" },
  { re: /photos|photography/i, text: "Professional photos done" },
  { re: /survey/i, text: "Survey completed" },
];

// The WIN_COPY labels that make a legally-meaningful, factual claim about where
// the deal stands. These must ONLY ever come from their exact milestone — the
// test asserts that and fails the build if a pattern ever broadens to catch the
// wrong one. (The milestone names allowed to produce each live in the test.)
export const STRONG_CLAIM_LABELS = new Set([
  "Your home went live on the market",
  "Went under contract",
]);

// The strong/canned claim for a completed milestone, or null if none applies.
// (The portal falls back to a neutral, always-true humanized label when null —
// so an unrecognized milestone can never invent a false claim.)
export function strongClaimFor(name) {
  const hit = WIN_COPY.find(e => e.re.test(name || ""));
  return hit ? hit.text : null;
}

// Derive the stage to SHOW the client. The agent-set transaction status is the
// source of truth for the contract line; completed milestones may only REFINE
// the stage forward once the deal is genuinely under contract — never push a
// still-Active listing across the contract line. See rule #2 above.
export function deriveStage(timeline, tx) {
  const ms = (timeline && Array.isArray(timeline.milestones)) ? timeline.milestones : [];
  const done = ms.filter(m => m.status === "Completed" || m.status === "Waived");
  const open = ms.filter(m => m.status !== "Completed" && m.status !== "Waived" && m.is_na !== true);
  // STAGE derivation counts only steps that actually HAPPENED. Waived / N/A
  // means "doesn't apply" — a cash deal's waived 'Clear to Close' lit the
  // portal's Clear-to-Close stage green while the deal was mid-inspection.
  const achieved = ms.filter(m => m.status === "Completed" && m.is_na !== true);
  const doneHas = (re) => achieved.some(m => re.test(m.name || ""));
  let derived = "Active";
  // "Clear to Close" is a LENDER event — the loan is fully approved with all
  // conditions cleared. It may derive ONLY from that exact milestone (or explicit
  // loan-cleared phrasing). It must NOT fire from closing-phase paperwork that
  // happens before the all-clear — CD / Settlement Statement Review, "CD Review",
  // Closing Disclosure, or the Final Walk-Through — or the portal tells a seller
  // "you're clear to close!" while the lender's all-clear is still pending (which
  // is exactly what happened on a live deal whose CD review was done first).
  if (doneHas(/clear to close|cleared to close|clear-to-close|loan (cleared|fully approved)/i)) derived = "Clear to Close";
  else if (doneHas(/appraisal received|appraisal report|financing (approved|commitment|secured)|loan (approved|commitment|cleared)/i)) derived = "Appraisal";
  else if (doneHas(/inspection period|inspection (complete|done|cleared)|repair (request|negotiation)|wdo|termite/i)) derived = "Inspection";
  else if (doneHas(/executed|under contract|emd|earnest|fully executed/i)) derived = "Under Contract";
  if ((tx.status || "") === "Closed") return { effectiveStatus: "Closed", lastDone: null, upcoming: [] };
  const dbIdx = Math.max(0, STAGE_ORDER.indexOf(tx.status));
  // LIABILITY GUARD: crossing the contract line ("Active" → "Under Contract") is
  // a legal claim and must come ONLY from the real, agent-set status — never
  // from fuzzy milestone-name matching. If the deal is still Active, ignore any
  // milestone-derived advancement so the portal can't tell a client they're
  // under contract / sold when they aren't. Once genuinely under contract,
  // milestones may refine the stage forward (Inspection → Appraisal → …).
  const derivedIdx = dbIdx >= 1 ? STAGE_ORDER.indexOf(derived) : 0;
  const effectiveStatus = STAGE_ORDER[Math.max(dbIdx, derivedIdx)];
  const meaningful = (m) => !/communication|weekly|thank|review request|compliance|reminder|set up|generate/i.test(m.name || "");
  // PHASE GATE: "What's coming up" must reflect the deal's REAL phase. A listing
  // that isn't under contract yet (still reviewing offers) is in the LISTING
  // phase — its contract/closing milestones (inspection, appraisal, walk-through)
  // are NOT what's happening next and must not be shown as upcoming. Only once the
  // deal is genuinely under contract do those phases unlock. Mirrors the backend's
  // unlockedPhasesForStatus so the portal, briefing, and Deal Doctor agree.
  const allowedPhases = STAGE_ORDER.indexOf(effectiveStatus) >= 1
    ? ["active", "contract", "closing"]
    : ["active"];
  const inPhase = (m) => { const p = (m.phase || "").toLowerCase(); return !p || allowedPhases.includes(p); };
  const lastDone = [...done].filter(meaningful).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(-1)[0] || null;
  const upcoming = [...open].filter(m => meaningful(m) && inPhase(m)).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(0, 4);
  return { effectiveStatus, lastDone, upcoming };
}
