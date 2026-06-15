import { describe, it, expect } from "vitest";
import { deriveStage, strongClaimFor, STRONG_CLAIM_LABELS } from "./portalClaims";

// The real milestone names the backend seeds (server.js SEED). If the backend
// adds/renames milestones, mirror them here — the tests below then prove no new
// name can produce a false client-facing claim. Source: Listing (Seller) +
// Buyer Representation templates, all phases.
const ALL_MILESTONE_NAMES = [
  // Seller — active
  "Verify Seller ID & Clear to List", "Listing Agreement Signed", "Agency Disclosure Signed",
  "Seller's Property Disclosure Completed", "Order HOA/Condo Estoppel (Early)", "Professional Photos Ordered",
  "Property Listed in MLS", "Install Lockbox & Sign", "Showing Instructions Set", "Weekly Seller Update",
  "Price-Reduction Check-In (if no offers)", "Listing Expiration Reminder",
  // Seller — under contract
  "Change MLS Status to Under Contract", "Confirm Effective Date", "Send Fully Executed Contract",
  "Confirm Co-Broke Commission", "Open Escrow / Deliver Contract to Title", "EMD Received & Receipt Delivered",
  "Deliver Seller Disclosures (SPD/HOA)", "Lead-Based Paint Disclosure Delivered", "Inspection Scheduled",
  "Inspection Period Ends", "Repair Negotiation / Response", "WDO / Termite Inspection",
  "Title Commitment Received", "Seller Payoff(s) Ordered", "Municipal Lien / Estoppel Search",
  "HOA Estoppel Received", "HOA Approval", "Appraisal Ordered", "Appraisal Received",
  "Appraisal Gap Resolution (if low)", "Financing Deadline", "Clear to Close",
  // Seller — closing
  "CD / Settlement Statement Review", "Verify Wire Instructions (Fraud Check)", "Seller Utilities / Move-Out",
  "Final Walk-Through", "Closing / Funding / Recording", "Commission Disbursement",
  "Keys / Remotes / Garage Openers", "Change MLS Status to Closed", "Compliance Audit (File Complete)",
  "Send the Seller a Thank-You Note & Ask for a Review",
  // Buyer — active
  "Buyer Consultation Completed", "Buyer Representation Agreement Signed", "Upload Buyer ID / Compliance",
  "Pre-Approval Letter Received", "Proof of Funds (Cash)", "Showings / Property Tours", "Weekly Buyer Update",
  "Buyer-Rep Expiration Reminder", '"Still Searching?" Check-In (if no offer)',
  // Buyer — under contract
  "Submit Earnest Money Deposit", "EMD Received & Receipt", "Open Escrow", "Schedule Inspection",
  "Complete Inspection", "Inspection Period Ends / BINSR Response", "Repair Requests Submitted",
  "Survey Ordered", "Open Permit Search", "Loan Application Submitted", "Rate Lock (optional)",
  "HOA Docs Received & Condo 3-Day Review", "HOA Application & Approval", "Homeowner's Insurance Bound",
  "Flood Insurance Bound", "Wind Mitigation / 4-Point Inspection",
  "Title Commitment Reviewed / Objection Deadline",
  // Buyer — closing
  "CD Review", "Cash to Close Confirmed", "Utilities Transfer", "Keys / Possession",
];

// The ONLY milestones allowed to produce each strong (legally-meaningful) claim.
const APPROVED_FOR_CLAIM = {
  "Your home went live on the market": ["Property Listed in MLS"],
  "Went under contract": ["Send Fully Executed Contract", "Change MLS Status to Under Contract"],
};

const completedAll = (names) => ({
  milestones: names.map((name, i) => ({ name, status: "Completed", sort_order: i })),
});

describe("portal strong claims fire only from their exact milestone", () => {
  it("no milestone produces a strong claim unless it is on that claim's allowlist", () => {
    for (const name of ALL_MILESTONE_NAMES) {
      const claim = strongClaimFor(name);
      if (claim && STRONG_CLAIM_LABELS.has(claim)) {
        const approved = APPROVED_FOR_CLAIM[claim] || [];
        expect(approved, `"${name}" wrongly produces the strong claim "${claim}"`).toContain(name);
      }
    }
  });

  it("a signed listing agreement is NOT shown as the home being on the market", () => {
    expect(strongClaimFor("Listing Agreement Signed")).not.toBe("Your home went live on the market");
  });

  it("the market claim still fires for an actual MLS listing", () => {
    expect(strongClaimFor("Property Listed in MLS")).toBe("Your home went live on the market");
  });
});

describe("portal stage never overclaims past the real transaction status", () => {
  it("an Active listing stays Active even with EVERY milestone completed", () => {
    const tx = { status: "Active", transactionType: "Listing (Seller)" };
    const stage = deriveStage(completedAll(ALL_MILESTONE_NAMES), tx);
    expect(stage.effectiveStatus).toBe("Active");
  });

  it("an Active buyer deal stays Active even with EVERY milestone completed", () => {
    const tx = { status: "Active", transactionType: "Buyer Representation" };
    const stage = deriveStage(completedAll(ALL_MILESTONE_NAMES), tx);
    expect(stage.effectiveStatus).toBe("Active");
  });

  it("once genuinely Under Contract, milestones may refine the stage forward", () => {
    const tx = { status: "Under Contract", transactionType: "Listing (Seller)" };
    const stage = deriveStage(completedAll(["Send Fully Executed Contract", "Appraisal Received"]), tx);
    expect(["Appraisal", "Clear to Close"]).toContain(stage.effectiveStatus);
  });

  it("a Closed deal reads Closed", () => {
    const tx = { status: "Closed", transactionType: "Listing (Seller)" };
    expect(deriveStage({ milestones: [] }, tx).effectiveStatus).toBe("Closed");
  });
});
