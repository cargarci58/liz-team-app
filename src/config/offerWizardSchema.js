// ============================================================
// OFFER WIZARD SCHEMA — Florida AS-IS Residential Contract
// Every field includes "teach" copy: what/why/consequence
// ============================================================
//
// Schema shape:
// {
//   contractType: "as_is",
//   steps: [
//     { id, title, subtitle, why, fields: [
//        { id, label, type, required, default, options?, hint, why, validate? }
//     ] }
//   ]
// }

export const AS_IS_WIZARD = {
  contractType: "as_is",
  contractName: "FAR/BAR AS-IS Residential Contract",
  steps: [
    {
      id: 0,
      title: "Pre-Approval & Buying Power",
      subtitle: "Start with the buyer's pre-approval — it sets financing type, rate, term, and the max loan we'll check the price against",
      why: "No pre-approval = offer dismissed. Uploading it first lets the system pre-fill the financing terms and warn you immediately if the price exceeds what the buyer is approved for.",
      fields: [
        { id: "preapproval_doc_id", label: "Pre-approval letter (or proof of funds for cash)", type: "preapproval_picker", required: true,
          hint: "Pick an existing pre-approval from this buyer's file, or upload a new one. The system reads the financing type, rate, term, and max loan amount from it.",
          why: "Without this, the offer is unsubmittable. Listing agents will not present it to their seller. Uploading it first drives the affordability warning on the price step." }
      ]
    },
    {
      id: 1,
      title: "Parties & Property",
      subtitle: "Confirm who is buying and what they are buying",
      why: "Every contract must clearly identify the buyer(s), seller(s), and the property. Errors here can void the contract or delay closing.",
      fields: [
        { id: "offer_effective_date", label: "Offer expires on (seller must accept by)", type: "date", required: true,
          hint: "Typically 1-2 business days from today. Your call as the agent.",
          why: "Sets the deadline for the seller's response. If the seller hasn't accepted by this date, the offer is void and your buyer can move on. Too short and the seller dismisses; too long and your buyer is stuck waiting." },
        { id: "buyer_names", label: "Buyer name(s)", type: "text", required: true,
          hint: "Exact legal name(s) as they will appear on the deed.",
          why: "Title companies match this to ID at closing. Misspellings = closing delay." },
        { id: "seller_names", label: "Seller name(s)", type: "text", required: false,
          hint: "From the listing or county property records. Not on the MLS sheet for most listings.",
          why: "Identifies who's selling. Leave blank if you don't know — listing agent will fill on receipt." },
        { id: "buyer_marital_status", label: "Buyer marital status", type: "select", required: true,
          options: ["Single", "Married", "Married (signing alone)", "Divorced", "Widowed"],
          why: "In FL, a married buyer's spouse may need to sign even if not on title (homestead rights)." },
        { id: "buyer_spouse_name", label: "Spouse's full name", type: "text", required: true,
          showIf: { buyer_marital_status: ["Married"] },
          hint: "Exact legal name as on ID. Required because FL homestead law often makes the spouse a necessary signer.",
          why: "Without the spouse's signature on a marital homestead contract, the conveyance can be challenged later." },
        { id: "property_address", label: "Property address", type: "text", required: true, prefillFrom: "transaction.property_address",
          why: "Wrong address = wrong contract. Cross-check the MLS listing." },
        { id: "property_county", label: "County", type: "text", required: true, prefillFrom: "transaction.property_county",
          why: "County determines doc stamps, recording fees, and which courthouse handles disputes." },
        { id: "property_parcel_id", label: "Parcel ID / Folio", type: "text", required: false,
          hint: "Optional but recommended. Find on county property appraiser site.",
          why: "Definitively identifies the parcel even if the street address is ambiguous." },
        { id: "property_legal_description", label: "Legal description", type: "textarea", required: false,
          hint: "Copy from MLS or county records. Will be inserted into the contract verbatim.",
          why: "The legal description (not the street address) is what conveys title." }
      ]
    },
    {
      id: 2,
      title: "Price & Earnest Money",
      subtitle: "What you are offering and how serious the offer is",
      why: "Price is the headline. EMD (earnest money deposit) signals commitment — too low and the seller dismisses the offer; too high and your buyer is at risk if they back out.",
      fields: [
        { id: "purchase_price", label: "Purchase price ($)", type: "currency", required: true,
          why: "The total your buyer agrees to pay. Doc stamps on the deed are calculated from this." },
        { id: "initial_emd", label: "Initial earnest money deposit ($)", type: "currency", required: true,
          hint: "Typically 1-3% of price. Held in escrow by the listing brokerage or title company.",
          why: "If buyer breaches, this is the seller's remedy. If seller breaches, it's returned." },
        { id: "initial_emd_deadline_days", label: "EMD due within (business days of effective date)", type: "number", required: true, default: 3,
          hint: "Standard is 3 business days. Sellers in hot markets may demand 1 day.",
          why: "Missing this deadline = buyer in default = contract can be terminated by seller." },
        { id: "additional_emd", label: "Additional EMD ($) — optional", type: "currency", required: false,
          hint: "Paid AFTER inspection period ends to show continued commitment. Often equals the initial.",
          why: "Increases seller confidence after the buyer commits past inspection. Stronger offer." },
        { id: "additional_emd_deadline_days", label: "Additional EMD due within (days after effective date)", type: "number", required: false,
          hint: "Only required if Additional EMD is set above." },
        { id: "escrow_agent", label: "Escrow agent (who holds the EMD)", type: "text", required: true,
          hint: "Usually the listing brokerage or the title/closing company.",
          why: "If money is misdirected, recovery is messy. Be specific: name and license/EIN." }
      ]
    },
    {
      id: 3,
      title: "Financing",
      subtitle: "How the buyer is paying",
      why: "Financing terms tell the seller how confident they can be that the deal will close. Cash > Conventional > FHA/VA on certainty (not on dollar amount).",
      fields: [
        { id: "financing_type", label: "Financing type", type: "select", required: true,
          options: ["Cash", "Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"],
          why: "Each type triggers different contract paragraphs and addenda. Cash skips appraisal/loan contingency; FHA/VA add appraisal floor protections." },
        { id: "loan_rate_type", label: "Loan rate type", type: "select", required: false, default: "Fixed",
          options: ["Fixed", "Adjustable"],
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] },
          why: "Fixed = rate locked for the life of the loan. Adjustable (ARM) = lower initial rate but can rise later. Drives a checkbox on the contract." },
        { id: "loan_term_years", label: "Loan term (years)", type: "number", required: false, default: 30,
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] },
          hint: "Typically 30 or 15.",
          why: "The amortization period. Goes on the financing paragraph of the contract." },
        { id: "loan_amount", label: "Loan amount ($)", type: "currency", required: false,
          hint: "Leave blank if cash. Auto-fills from price minus down payment if both provided.",
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] } },
        { id: "down_payment", label: "Down payment ($)", type: "currency", required: false,
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] },
          why: "Lenders verify this. Disclosed in the contract to confirm buyer has cash to close." },
        { id: "loan_application_deadline_days", label: "Loan application within (days)", type: "number", required: false, default: 5,
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] },
          hint: "Days after the Effective Date for the buyer to apply. Standard is 5.",
          why: "Standard FAR/BAR is 5 days after Effective Date. Missing this = buyer in default of the financing paragraph." },
        { id: "loan_approval_deadline_days", label: "Loan approval / commitment within (days)", type: "number", required: false, default: 30,
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] },
          why: "Last day buyer can cancel for financing reasons and recover EMD. Match to lender's timeline." },
        { id: "appraisal_contingency", label: "Appraisal contingency?", type: "select", required: false,
          options: ["Yes — buyer can cancel if appraisal is low", "No — buyer waives (stronger offer)"],
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] },
          why: "Waiving = stronger offer but buyer risks bringing extra cash if appraisal is below price." }
      ]
    },
    {
      id: 4,
      title: "Inspection & Due Diligence",
      subtitle: "Buyer's window to investigate the property",
      why: "AS-IS means the buyer accepts the property in its current condition — BUT the inspection period is the buyer's escape hatch. During this window they can cancel for ANY reason and get the EMD back. After it expires, they're locked in.",
      fields: [
        { id: "inspection_period_days", label: "Inspection period (calendar days from effective date)", type: "number", required: true, default: 15,
          hint: "Standard 15 days. Hot markets often see 7-10. Complex properties may need 20+.",
          why: "This is the buyer's ONLY broad right to cancel. Too short = buyer can't get inspectors scheduled. Too long = seller's house is off market." },
        { id: "as_is_acknowledged", label: "Buyer acknowledges AS-IS sale", type: "checkbox", required: true, default: true,
          hint: "Required for AS-IS contract. Seller is not obligated to make repairs.",
          why: "Without this acknowledgment, buyer may later claim they expected repairs. Document the AS-IS understanding." },
        { id: "right_of_access", label: "Buyer right of access for inspections", type: "checkbox", required: true, default: true,
          why: "Confirms buyer (and their inspectors) can enter the property with reasonable notice." }
      ]
    },
    {
      id: 5,
      title: "Title & Survey",
      subtitle: "Who pays for the title work and whether a survey is required",
      why: "Title insurance protects the buyer (and lender) from unknown ownership claims. Survey reveals encroachments. Who pays varies by FL county — getting this wrong creates last-minute closing fights.",
      fields: [
        { id: "title_company", label: "Title / closing company", type: "text", required: false,
          hint: "Buyer's choice in FL unless otherwise negotiated. Leave blank to fill in later.",
          why: "The closing agent prepares the deed, handles escrow, and records documents. Buyer typically picks." },
        { id: "title_closing_responsibility", label: "Title & closing agent (Paragraph 9 — CHECK ONE)", type: "select", required: true,
          default: "Seller designates & pays owner's policy",
          options: [
            "Seller designates & pays owner's policy",
            "Buyer designates & pays owner's policy",
            "Miami-Dade/Broward regional provision"
          ],
          hint: "Standard in most FL counties: Seller designates the closing agent and pays for the owner's title policy; buyer pays for the lender's policy + endorsements. In Miami-Dade/Broward use the regional provision (option iii).",
          why: "This is the actual CHECK ONE box on the contract. 'Seller designates' = seller picks closing agent + pays owner's policy, buyer pays lender's policy. 'Buyer designates' = buyer picks + pays everything. 'Miami-Dade/Broward' = the regional provision where buyer designates and pays premiums, seller pays for the title search up to a cap." },
        { id: "title_search_max_cost", label: "Title search cost cap ($) — Miami-Dade/Broward only", type: "currency", required: false,
          showIf: { title_closing_responsibility: ["Miami-Dade/Broward regional provision"] },
          hint: "Leave blank to use the contract's built-in default of $200.",
          why: "Under the regional provision, the seller pays actual title-search costs up to this cap. Blank = form's $200 default." },
        { id: "survey_required", label: "Survey?", type: "select", required: false, default: "Yes — seller pays",
          options: ["Yes — seller pays", "No survey"],
          hint: "Default is Yes (seller pays). Lenders often require one.",
          why: "Reveals boundary issues, encroachments, easements. ~$400-700 in FL — seller's expense under the FAR/BAR form." },
        { id: "closing_costs_paid_by", label: "Seller contribution to buyer's closing costs ($)", type: "currency", required: false, default: 0,
          hint: "Cap is usually 3-6% of price depending on loan type (FHA = 6%, Conv = 3%).",
          why: "Reduces buyer's cash to close. Common ask in slower markets." }
      ]
    },
    {
      id: 6,
      title: "Closing",
      subtitle: "When and where the sale finalizes",
      why: "The closing date is when ownership transfers, keys hand over, and money moves. Pick a date that's realistic for the buyer's lender and the seller's move-out plan.",
      fields: [
        { id: "closing_date", label: "Closing date", type: "date", required: true,
          hint: "Cash: 14-21 days. Conventional: 30-45 days. FHA/VA: 45-60 days.",
          why: "If the date isn't realistic for the loan type, the closing slips and both sides may default." },
        { id: "closing_location", label: "Closing location", type: "select", required: false, default: "Title company's office",
          options: ["Title company's office", "Mail-away (remote signing)", "Other (specify in clauses)"],
          why: "Mail-away closings are common for out-of-state buyers but require coordination with title 7+ days ahead." },
        { id: "doc_stamps_paid_by", label: "Doc stamps on deed paid by", type: "select", required: true, default: "Seller",
          options: ["Seller", "Buyer", "Split"],
          why: "FL custom: seller pays deed doc stamps ($0.70 per $100 of price). Buyer pays note doc stamps if financed." }
      ]
    },
    {
      id: 7,
      title: "Occupancy & Possession",
      subtitle: "When the buyer gets the keys",
      why: "Standard is possession at closing. Anything else (seller stays after closing, buyer moves in before) creates legal and insurance complications that need explicit terms.",
      fields: [
        { id: "occupancy_type", label: "Possession", type: "select", required: true, default: "At closing",
          options: ["At closing", "Post-closing occupancy (seller stays)", "Pre-closing access (buyer moves in early)"],
          why: "Post-closing occupancy = seller is now a tenant; needs separate lease/use agreement. Pre-closing access = buyer risks improving a property they don't own yet." },
        { id: "property_subject_to_lease", label: "Is the property subject to a lease or occupancy agreement after closing?", type: "select", required: false, default: "No",
          options: ["No", "Yes — tenant/lease stays after closing"],
          hint: "Includes existing tenants, seasonal/short-term vacation rentals that continue past closing.",
          why: "Paragraph 6(b): if a tenant or lease survives closing, the buyer takes the property occupied. Seller must deliver the lease(s) within 5 days and buyer can cancel if unacceptable. Checks a box on the contract." },
        { id: "occupancy_days_after_closing", label: "Days seller may stay after closing", type: "number", required: false,
          showIf: { occupancy_type: ["Post-closing occupancy (seller stays)"] },
          why: "Max recommended is 60 days; longer triggers FL residential landlord-tenant law." },
        { id: "occupancy_per_diem", label: "Per-diem rent seller pays buyer ($/day)", type: "currency", required: false,
          showIf: { occupancy_type: ["Post-closing occupancy (seller stays)"] },
          why: "Compensates buyer for delayed possession + mortgage payment. Typical: PITI/30." },
        { id: "assignability", label: "Assignability (Paragraph 7 — CHECK ONE)", type: "select", required: true,
          default: "May NOT assign this contract",
          options: [
            "May NOT assign this contract",
            "May assign and be released from liability",
            "May assign but NOT be released from liability"
          ],
          hint: "Default (and most common) is 'may not assign.' If no box is checked the contract defaults to may-not-assign.",
          why: "Controls whether the buyer can hand the contract to someone else before closing. Investors often want assignability; sellers usually prefer the buyer can't swap themselves out." }
      ]
    },
    {
      id: 8,
      title: "Addenda",
      subtitle: "Required and recommended addenda for this offer",
      why: "Addenda are pre-approved riders that handle specific situations (HOA, condo, FHA, lead paint, etc.). The right ones protect your buyer; missing ones expose them to risk.",
      fields: [
        { id: "selected_addenda", label: "Addenda to include", type: "addenda_picker", required: false,
          hint: "AI-suggested based on your answers. Toggle any on/off and add custom forms from your library.",
          why: "Each FL transaction has standard addenda. HOA → HOA Addendum. Condo → Condo Rider. FHA → FHA financing addendum + appraisal floor language. Missing the right one = unenforceable terms." }
      ]
    },
    {
      id: 9,
      title: "Special Clauses & Additional Terms",
      subtitle: "Anything else the seller needs to agree to",
      why: "Free-text clauses cover one-off items: 'Refrigerator conveys', 'Seller to repair roof leak before closing', 'Sale contingent on buyer's home selling'. Be specific — vague clauses get litigated.",
      fields: [
        { id: "common_clauses", label: "Common clauses (select all that apply)", type: "clause_picker", required: false,
          hint: "Pick any standard clauses to add. They'll be combined with your free-text clauses below into the contract's Additional Terms.",
          why: "Saves typing the clauses agents use on most deals. You can still add custom wording below.",
          options: [
            "All appliances, including refrigerator, washer, and dryer, convey with the property.",
            "Seller to provide a home warranty not to exceed $600 at closing.",
            "This Contract is contingent upon the sale and closing of Buyer's current residence.",
            "Seller to professionally clean the property prior to Buyer's final walkthrough.",
            "Seller to remove all personal property and debris prior to closing.",
            "All window treatments, blinds, and curtain rods convey with the property.",
            "Ceiling fans and light fixtures convey with the property.",
            "Seller to repair all items noted in the inspection report prior to closing.",
            "Seller to deliver the property with all utilities on for inspections and final walkthrough.",
            "Buyer's obligation is contingent on a satisfactory final walkthrough within 48 hours of closing.",
            "Mounted televisions and their wall brackets convey with the property.",
            "Pool, spa, and related equipment convey in working condition.",
            "Seller to transfer any transferable warranties (roof, HVAC, termite bond) to Buyer at closing."
          ] },
        { id: "special_clauses", label: "Additional custom clauses (free text)", type: "textarea", required: false,
          hint: "One clause per line. Write in plain English; the contract will incorporate verbatim.",
          why: "Vague clauses ('seller to clean up yard') are unenforceable. Specific ones ('seller to remove all debris from rear yard prior to closing') are." },
        { id: "items_included", label: "Items included with sale (besides what's listed in MLS)", type: "textarea", required: false,
          hint: "e.g. Refrigerator, washer/dryer, mounted TVs, pool equipment.",
          why: "FL contract conveys built-in items by default; portable items only if listed. List them all to avoid post-closing disputes." },
        { id: "items_excluded", label: "Items excluded (seller is taking)", type: "textarea", required: false,
          hint: "e.g. Dining room chandelier, garage shelving.",
          why: "Avoids the classic post-closing fight: 'they took the chandelier.'" }
      ]
    },
    {
      id: 11,
      title: "Listing-Side Contact",
      subtitle: "Who to send this offer to",
      why: "These contacts are used to email the offer packet directly to the listing side. Pulled from the MLS sheet — confirm and edit if needed.",
      fields: [
        { id: "listing_agent_name", label: "Listing agent name", type: "text", required: true,
          why: "Goes on the offer cover sheet and the transmittal email." },
        { id: "listing_agent_email", label: "Listing agent email", type: "text", required: true,
          hint: "The offer packet email is sent here.",
          why: "Wrong email = your offer is never delivered. Verify against the MLS sheet." },
        { id: "listing_agent_phone", label: "Listing agent phone", type: "text", required: false,
          why: "Used for follow-up if no email response within 24-48h." },
        { id: "listing_brokerage", label: "Listing brokerage", type: "text", required: false,
          why: "Shown on the cover sheet to identify the listing side." },
        { id: "seller_paid_commission_pct", label: "Commission % the seller/listing side pays your brokerage", type: "number", required: false,
          hint: "Enter a percentage, e.g. 2.5 for 2.5%. Converted to a dollar amount using the purchase price. This does NOT go on the offer; it updates this transaction's commission record.",
          why: "Tracks the co-op commission offered to the buyer's side so your brokerage's books reflect it. Not part of the contract sent to the seller." }
      ]
    },
    {
      id: 12,
      title: "Review & Generate Bundle",
      subtitle: "Confirm everything, then build the offer package",
      why: "Once generated, the bundle PDF contains the contract + all selected addenda + pre-approval, ready for the agent to download, sign externally, and re-upload.",
      fields: []
    }
  ]
};

// Export by contract type so future contracts (vacant land, commercial) plug in here
export const WIZARDS = {
  as_is: AS_IS_WIZARD,
  // far_bar: FAR_BAR_WIZARD,    // future
  // vacant_land: VL_WIZARD,     // future
  // commercial: COMM_WIZARD,    // future
};

export function getWizard(contractType = "as_is") {
  return WIZARDS[contractType] || AS_IS_WIZARD;
}
