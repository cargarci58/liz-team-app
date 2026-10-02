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
        { id: "buyer_spouse_name", label: "Spouse's full name — ONLY if not already a buyer above", type: "text", required: false,
          showIf: { buyer_marital_status: ["Married"] },
          hint: "If both spouses are already listed in Buyer name(s), leave this blank — they're signing as buyers. Fill this only when the spouse is NOT a buyer (FL homestead may still require their signature).",
          why: "Without a non-buyer spouse's signature on a marital homestead contract, the conveyance can be challenged later." },
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
          why: "If money is misdirected, recovery is messy. Be specific: name and license/EIN." },
        { id: "purchase_other_desc", label: "Other funds toward purchase — description (optional)", type: "text", required: false,
          hint: "Line 40(d) on the contract. e.g. 'Assumed mortgage balance', 'Seller financing'. Leave blank if none.",
          why: "Rarely used. Only for funds applied to the price that aren't deposit or new financing." },
        { id: "purchase_other_amount", label: "Other funds toward purchase — amount ($)", type: "currency", required: false,
          hint: "Dollar amount for the 'Other' line above." }
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
        { id: "special_financing_method", label: "Special financing structure?", type: "select", required: false, default: "None",
          options: ["None", "Assumption of existing mortgage (Rider D)", "Purchase money note & mortgage to Seller (Rider C)"],
          hint: "Only if the buyer is assuming the seller's loan or the seller is financing the purchase. Checks a box + attaches the rider on the contract.",
          why: "Assumption = buyer takes over the seller's existing mortgage (Rider D). Purchase money mortgage = seller acts as the lender (Rider C). Both need their rider attached." },
        { id: "loan_rate_type", label: "Loan rate type", type: "select", required: false, default: "Fixed",
          options: ["Fixed", "Adjustable"],
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] },
          why: "Fixed = rate locked for the life of the loan. Adjustable (ARM) = lower initial rate but can rise later. Drives a checkbox on the contract." },
        { id: "loan_term_years", label: "Loan term (years)", type: "number", required: false, default: 30,
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] },
          hint: "Typically 30 or 15.",
          why: "The amortization period. Goes on the financing paragraph of the contract." },
        { id: "down_payment_pct", label: "Down payment (%)", type: "number", required: false,
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] },
          hint: "FHA min 3.5%, VA/USDA 0%, Conventional 3-20%+. The down payment $ and loan amount calculate automatically from this and the purchase price.",
          why: "Reads from the pre-approval letter (e.g. FHA 3.5%) and drives the down payment and loan amount off the offer price — no manual math." },
        { id: "down_payment", label: "Down payment ($)", type: "currency", required: false,
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] },
          hint: "Auto-calculates from the down payment % and price. Type a number to override.",
          why: "Lenders verify this. Disclosed in the contract to confirm buyer has cash to close." },
        { id: "loan_amount", label: "Loan amount ($)", type: "currency", required: false,
          hint: "Auto-calculates as price minus down payment. Type a number to override. Leave blank if cash.",
          showIf: { financing_type: ["Conventional", "FHA", "VA", "USDA", "Physician's Loan", "Bridge Loan", "Hard Money", "Seller Financing", "Other"] } },
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
          why: "This is the buyer's ONLY broad right to cancel. Too short = buyer can't get inspectors scheduled. Too long = seller's house is off market." }
        // Note: AS-IS acknowledgment + buyer right of access are inherent terms of the
        // FAR/BAR AS-IS contract — not negotiable checkboxes — so they aren't asked here.
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
          why: "Reduces buyer's cash to close. Common ask in slower markets." },
        { id: "title_evidence_days", label: "Title evidence delivered at least (days before closing)", type: "number", required: false,
          hint: "Leave blank to use the contract default (15 days, or 5 if cash). Paragraph 9(c).",
          why: "Deadline for the seller/closing agent to deliver the title commitment before closing." },
        { id: "flood_terminate_days", label: "Flood-zone termination notice within (days after effective date)", type: "number", required: false,
          hint: "Leave blank to use the contract default of 20 days. Paragraph 10(d) flood zone.",
          why: "If the property's flood-zone/elevation makes it ineligible or below minimum, the buyer can terminate within this window." },
        { id: "seller_other_costs", label: "Other costs paid by SELLER (optional)", type: "text", required: false,
          hint: "Free text for the 'Other:' line under Costs Paid by Seller (Paragraph 9a).",
          why: "Any seller-paid cost not already itemized on the form." },
        { id: "buyer_other_costs", label: "Other costs paid by BUYER (optional)", type: "text", required: false,
          hint: "Free text for the 'Other:' line under Costs Paid by Buyer (Paragraph 9b).",
          why: "Any buyer-paid cost not already itemized on the form." },
        { id: "home_warranty_paid_by", label: "Home warranty — who pays? (Paragraph 9e)", type: "select", required: false, default: "N/A",
          options: ["N/A", "Buyer", "Seller"],
          why: "A home warranty covers repair/replacement of major systems for the first year. Buyer or seller can pay, or N/A if none." },
        { id: "home_warranty_provider", label: "Home warranty provider", type: "text", required: false,
          showIf: { home_warranty_paid_by: ["Buyer", "Seller"] },
          hint: "e.g. American Home Shield, First American." },
        { id: "home_warranty_cost", label: "Home warranty cost not to exceed ($)", type: "currency", required: false,
          showIf: { home_warranty_paid_by: ["Buyer", "Seller"] },
          hint: "Typical cap $400-$700." },
        { id: "special_assessments", label: "Special assessments (Paragraph 9f — CHECK ONE)", type: "select", required: false,
          default: "(a) Seller pays installments due before closing; Buyer pays after",
          options: [
            "(a) Seller pays installments due before closing; Buyer pays after",
            "(b) Seller pays in full before/at closing"
          ],
          hint: "Default is (a). If neither is selected the contract deems (a).",
          why: "Governs who pays public-body special assessments (e.g., paving, sewer). (a) splits by installment; (b) seller pays the whole thing up front." }
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
          why: "Each FL transaction has standard addenda. HOA → HOA Addendum. Condo → Condo Rider. FHA → FHA financing addendum + appraisal floor language. Missing the right one = unenforceable terms." },
        // ── Rider-specific blanks (shown only when that rider is selected) ──
        // These feed the auto-filled rider forms so the packet comes out
        // signature-ready — no handwriting on the riders.
        { id: "e_repair_cap", label: "Rider E — Seller's cap on lender-required repairs ($)", type: "currency", required: false, showIfAddendum: "E",
          hint: "Paragraph 2 of the FHA/VA rider. Common: $500–$5,000. Leave blank to leave the blank open for negotiation.",
          why: "FHA/VA appraisers can require repairs before the loan closes. This caps what the seller must spend on them." },
        { id: "e_fha_appraised_value", label: "Rider E — FHA appraised value floor ($)", type: "currency", required: false, showIfAddendum: "E",
          showIf: { financing_type: ["FHA"] },
          hint: "Leave blank to use the purchase price (standard).",
          why: "The FHA amendatory clause: buyer can walk with the deposit if the appraisal comes in under this number." },
        { id: "e_fha_taxfee_cap", label: "Rider E — Seller-paid tax service fee cap ($)", type: "currency", required: false, showIfAddendum: "E",
          showIf: { financing_type: ["FHA"] },
          hint: "Leave blank to use the form's built-in $100 default." },
        { id: "e_va_fees_cap", label: "Rider E — Seller-paid VA fees cap ($)", type: "currency", required: false, showIfAddendum: "E",
          showIf: { financing_type: ["VA"] },
          hint: "Leave blank to use the form's built-in $250 default.",
          why: "VA rules bar the veteran buyer from paying certain fees — the seller covers them up to this cap." },
        { id: "gg_agreement_parties", label: "Rider GG — Who signs the compensation agreement? (CHECK ONE on the rider)", type: "select", required: true, showIfAddendum: "GG",
          options: ["Seller's Broker and Buyer's Broker", "Seller and Buyer's Broker"],
          hint: "Most common: Seller's Broker and Buyer's Broker (the two brokerages agree). Pick 'Seller and Buyer's Broker' when the seller personally (e.g. For Sale By Owner or no co-op offered) agrees to pay your compensation.",
          why: "This is a required CHECK ONE box on the rider — the wizard won't guess it for you." },
        { id: "gg_days", label: "Rider GG — Compensation agreement due within (days)", type: "number", required: false, default: 3, showIfAddendum: "GG",
          hint: "Days after the Effective Date. The form's default is 3 if left blank." },
        { id: "p_lbp_ten_day", label: "Lead-Based Paint (pre-1978) — 10-day lead inspection right (CHECK ONE on the disclosure)", type: "select", required: true, showIfAddendum: "P",
          options: ["Waive the 10-day lead inspection (most common)", "Keep the 10-day right to a lead risk assessment/inspection"],
          hint: "Federal law gives the buyer the OPTION of a 10-day lead paint risk assessment before being bound. Most buyers waive it because the regular inspection period covers it — keeping it can weaken the offer.",
          why: "Required federal disclosure for homes built before 1978. The app generates the EPA lead-based paint disclosure with this choice checked; the buyer initials and signs it with the rest of the package." },
        // ── Rider A (Condominium) ──
        { id: "a_assn_name", label: "Rider A — Condominium association name", type: "text", required: false, showIfAddendum: "A",
          hint: "From the MLS sheet or the listing agent. The HOA/manager name read from the MLS is a good starting point.",
          why: "Identifies the association whose approval, fees, and documents govern the purchase." },
        { id: "a_fee_amount", label: "Rider A — Association assessment ($)", type: "currency", required: false, showIfAddendum: "A",
          hint: "The regular condo assessment amount." },
        { id: "a_fee_frequency", label: "Rider A — Assessment frequency", type: "select", required: false, showIfAddendum: "A",
          options: ["Monthly", "Quarterly", "Semi-annually", "Annually"], default: "Monthly" },
        { id: "a_approval_desc", label: "Rider A — Association approval of buyer?", type: "select", required: false, showIfAddendum: "A", default: "Yes — association must approve the buyer",
          options: ["Yes — association must approve the buyer", "No approval required"],
          why: "Most FL condos require the association to approve the buyer — the rider discloses it and sets the timeline." },
        { id: "a_special_assessment_text", label: "Rider A — Pending/levied special assessment (if any)", type: "text", required: false, showIfAddendum: "A",
          hint: "e.g. '$3,200 roof special assessment, paid by Seller at closing'. Leave blank if none known." },
        // ── Rider B (Homeowners' Assn. / Community Disclosure) ──
        { id: "b_assn_names", label: "Rider B — HOA / community association name(s)", type: "text", required: false, showIfAddendum: "B",
          hint: "The association manager name read from the MLS sheet is a good starting point.",
          why: "FL law requires disclosing the community association and its charges before contract." },
        { id: "b_fee_amount", label: "Rider B — HOA assessment ($)", type: "currency", required: false, showIfAddendum: "B",
          hint: "Auto-suggest: the monthly HOA fee read from the MLS sheet." },
        { id: "b_fee_frequency", label: "Rider B — Assessment frequency", type: "select", required: false, showIfAddendum: "B",
          options: ["Monthly", "Quarterly", "Semi-annually", "Annually"], default: "Monthly" },
        { id: "b_membership_mandatory", label: "Rider B — Is membership mandatory?", type: "select", required: false, showIfAddendum: "B", default: "Yes",
          options: ["Yes", "No"],
          why: "The disclosure states whether the buyer is obligated to join and pay the association." },
        { id: "b_special_assessment_text", label: "Rider B — Pending/levied special assessment (if any)", type: "text", required: false, showIfAddendum: "B",
          hint: "Leave blank if none known." },
        // ── Rider F (Appraisal Contingency) ──
        { id: "f_appraisal_min", label: "Rider F — Appraisal must come in at no less than ($)", type: "currency", required: false, showIfAddendum: "F",
          hint: "Leave blank to use the purchase price (standard).",
          why: "If the appraisal comes in under this number, the buyer can cancel and keep the deposit." },
        { id: "f_appraisal_days", label: "Rider F — Appraisal delivered within (days after effective date)", type: "number", required: false, showIfAddendum: "F",
          hint: "Give the lender time — commonly 20-30 days. Leave blank to use the form's default." },
        // ── Rider H (Homeowners'/Flood Insurance) ──
        { id: "h_premium_cap", label: "Rider H — Buyer can cancel if annual insurance premium exceeds ($)", type: "currency", required: false, showIfAddendum: "H",
          hint: "Get a quote range from an insurance agent first — in flood zones this protects the buyer from an unaffordable premium.",
          why: "The rider lets the buyer terminate if property/flood insurance costs more than this cap." },
        // ── Rider V (Sale of Buyer's Property) ──
        { id: "v_property_address", label: "Rider V — Address of the buyer's property that must sell", type: "text", required: false, showIfAddendum: "V",
          why: "The contingency is tied to this specific property closing." },
        { id: "v_sale_deadline", label: "Rider V — Buyer's property must close by", type: "date", required: false, showIfAddendum: "V",
          why: "If the buyer's sale hasn't closed by this date, either side can act under the rider's terms." },
        { id: "u_expense", label: "Rider U — Who pays for preparing the post-closing agreement? (CHECK ONE)", type: "select", required: false, showIfAddendum: "U",
          default: "Split equally (default)",
          options: ["Split equally (default)", "Seller's expense", "Buyer's expense"],
          why: "The rider's CHECK ONE box — who pays the attorney/preparation cost of the lease/occupancy agreement." },
        { id: "u_monthly_rent", label: "Rider U — Monthly rent the seller pays to stay ($)", type: "currency", required: false, showIfAddendum: "U",
          hint: "Leave blank to use your per-diem × 30 from the Occupancy step. Typically about the buyer's monthly payment (PITI).",
          why: "Goes on the rider's monthly-rent blank; the detailed terms land in the post-closing agreement itself." },
        { id: "u_days_prior", label: "Rider U — Agreement must be delivered within (days before closing)", type: "number", required: false, showIfAddendum: "U",
          hint: "Leave blank to use the form's built-in default of 10 days." },
                { id: "aa_licensee_name", label: "Rider AA — Licensee's name", type: "text", required: false, showIfAddendum: "AA",
          hint: "The licensed agent with a personal interest, e.g. 'Jane Smith (Lic. SL1234567)'.",
          why: "FL law requires disclosing when a licensee has a personal stake in the deal." },
        { id: "aa_interest_desc", label: "Rider AA — Describe the personal interest", type: "textarea", required: false, showIfAddendum: "AA",
          hint: "e.g. 'Licensee is the daughter of the Seller' or 'Licensee is the Buyer'. One or two short sentences.",
          why: "The rider requires spelling out the relationship (related to a party, acting as buyer/seller, etc.)." },
        { id: "addenda_other_text", label: "Other addendum (specify)", type: "text", required: false,
          hint: "Any addendum/rider not in the list above. Checks the 'Other' box on the contract and writes this text.",
          why: "Captures non-standard riders so they're disclosed as part of the contract." }
      ]
    },
    {
      id: 9,
      title: "Additional Terms",
      subtitle: "Anything else the seller needs to agree to (Paragraph 20 of the contract)",
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

// ============================================================
// VACANT LAND CONTRACT — Florida Realtors VAC-15 (Rev 1/26)
// Asks for EVERY blank and CHECK-ONE on the 8-page form a buyer's agent fills.
// Field ids match buildVacantLandFill() in server.js (it turns these answers
// into the form's boxes). Seller-only parts (counter/rejection, seller's notice
// address) are left for the listing side.
// ============================================================
const LOAN = ["New loan"];
export const VACANT_LAND_WIZARD = {
  contractType: "vacant_land",
  contractName: "Vacant Land Contract (VAC-15)",
  steps: [
    {
      id: 0,
      title: "Proof of Funds / Pre-Approval",
      subtitle: "Land is often bought with cash — attach the buyer's proof of funds or lender letter",
      why: "Listing agents won't present a land offer without proof the buyer can close. It's attached to the end of the offer package.",
      fields: [
        { id: "preapproval_doc_id", label: "Proof of funds or pre-approval letter", type: "preapproval_picker", required: true,
          hint: "Pick any file already on this deal (bank statement, lender letter, photo) or upload a new one.",
          why: "Sellers of land compare offers on certainty of closing — proof of funds is the first thing they look for." }
      ]
    },
    {
      id: 1,
      title: "Parties & Property (Paragraphs 1 & 3)",
      subtitle: "Who is buying, who is selling, and exactly which land",
      why: "Vacant land is identified by its legal description and parcel ID far more than by an address — many lots have no street number yet.",
      fields: [
        { id: "offer_effective_date", label: "Seller must accept by (Paragraph 3)", type: "date", required: true,
          hint: "Usually 1–3 days from today.",
          why: "If the seller hasn't signed and delivered by this date, the offer is withdrawn and the deposit returned." },
        { id: "buyer_names", label: "Buyer name(s)", type: "text", required: true,
          hint: "Exact legal names (or the company name if buying in an LLC). Separate two buyers with 'and'.",
          why: "Must match ID / entity documents at closing." },
        { id: "seller_names", label: "Seller name(s)", type: "text", required: false,
          hint: "From the county property appraiser or the listing. Leave blank if unknown.",
          why: "Identifies the owner. The listing agent can complete it." },
        { id: "property_address", label: "Address (or 'Vacant lot — no address')", type: "text", required: true, prefillFrom: "transaction.property_address" },
        { id: "property_legal_description", label: "Legal description", type: "textarea", required: true,
          hint: "Copy it from the county property appraiser or the deed. Up to 5 lines on the form.",
          why: "The legal description — not the address — is what conveys land." },
        { id: "vl_section", label: "Section (SEC)", type: "text", required: false, hint: "From the property appraiser record, e.g. 12." },
        { id: "vl_township", label: "Township (TWP)", type: "text", required: false, hint: "e.g. 24S." },
        { id: "vl_range", label: "Range (RNG)", type: "text", required: false, hint: "e.g. 29E." },
        { id: "property_county", label: "County", type: "text", required: true, prefillFrom: "transaction.property_county" },
        { id: "property_parcel_id", label: "Real Property ID No. (parcel ID)", type: "text", required: true,
          why: "The parcel ID pins down the exact land even when the address is vague." },
        { id: "vl_additional_property", label: "Additional property included (optional)", type: "text", required: false,
          hint: "e.g. 'existing well and fencing', 'mobile home VIN …'. Leave blank if none." }
      ]
    },
    {
      id: 2,
      title: "Price & Deposits (Paragraph 2)",
      subtitle: "What the buyer pays, and how the deposit is handled",
      why: "Land sellers weigh deposit size and timing heavily — a deposit that goes hard after due diligence is a strong signal.",
      fields: [
        { id: "vl_price_basis", label: "How is the price set?", type: "select", required: true, default: "Fixed price",
          options: ["Fixed price", "Per unit (lot / acre / square foot)"],
          why: "Paragraph 2(f): acreage deals are often priced per acre, with the final price set by the survey." },
        { id: "vl_unit", label: "Price per…", type: "select", required: false, options: ["Lot", "Acre", "Square foot", "Other"],
          showIf: { vl_price_basis: ["Per unit (lot / acre / square foot)"] } },
        { id: "vl_unit_other", label: "Other unit (specify)", type: "text", required: false, showIf: { vl_unit: ["Other"] } },
        { id: "vl_price_per_unit", label: "Price per unit ($)", type: "currency", required: false, showIf: { vl_price_basis: ["Per unit (lot / acre / square foot)"] } },
        { id: "vl_unit_exclusions", label: "Rights-of-way / areas excluded from the calculation", type: "text", required: false,
          showIf: { vl_price_basis: ["Per unit (lot / acre / square foot)"] }, hint: "e.g. 'road right-of-way and retention pond'. Leave blank if none." },
        { id: "purchase_price", label: "Purchase price ($)", type: "currency", required: true,
          hint: "If priced per unit, enter the estimated total — the survey sets the final number." },
        { id: "initial_emd", label: "Initial deposit ($)", type: "currency", required: true },
        { id: "vl_deposit_timing", label: "Initial deposit is…", type: "select", required: true, default: "Delivered within X days after Effective Date",
          options: ["Accompanies the offer", "Delivered within X days after Effective Date"] },
        { id: "initial_emd_deadline_days", label: "Initial deposit due within (days)", type: "number", required: false, default: 3,
          showIf: { vl_deposit_timing: ["Delivered within X days after Effective Date"] }, hint: "Form default is 3 days if left blank." },
        { id: "additional_emd", label: "Additional deposit ($) — optional", type: "currency", required: false },
        { id: "vl_additional_timing", label: "Additional deposit is due…", type: "select", required: false, default: "Within X days after Due Diligence ends",
          options: ["Within X days after Effective Date", "Within X days after Due Diligence ends"],
          hint: "Most land deals tie it to the end of due diligence (form default 3 days)." },
        { id: "additional_emd_deadline_days", label: "Additional deposit due within (days)", type: "number", required: false },
        // Same ids the MLS / broker-synopsis reader fills (closing_agent_*), so the
        // escrow office's contact, address, phone and email come straight in.
        { id: "escrow_agent", label: "Escrow agent's name (who holds the deposit)", type: "text", required: true,
          hint: "Filled from the broker synopsis or the deal's Title Company — check it." },
        { id: "closing_agent_name", label: "Escrow agent's contact person", type: "text", required: false },
        { id: "closing_agent_address", label: "Escrow agent's address", type: "text", required: false },
        { id: "closing_agent_phone", label: "Escrow agent's phone", type: "text", required: false },
        { id: "closing_agent_email", label: "Escrow agent's email", type: "text", required: false },
        { id: "purchase_other_desc", label: "Other amount toward the price — description (optional)", type: "text", required: false, hint: "Paragraph 2(d). Rarely used." },
        { id: "purchase_other_amount", label: "Other amount ($)", type: "currency", required: false }
      ]
    },
    {
      id: 3,
      title: "Financing (Paragraph 6)",
      subtitle: "How the buyer is paying for the land",
      why: "Land loans are harder to get than home loans — a financing contingency protects the buyer's deposit if the loan falls through.",
      fields: [
        { id: "financing_type", label: "Financing", type: "select", required: true, default: "Cash",
          options: ["Cash", "New loan", "Seller financing", "Assume existing mortgage"],
          why: "Cash = no financing contingency (6a). New loan = contract is contingent on the buyer's loan (6b-1). Seller financing (6b-2) and assumption (6b-3) have their own terms below." },
        { id: "loan_amount", label: "Loan amount ($)", type: "currency", required: false, showIf: { financing_type: LOAN },
          hint: "Or leave blank and enter a percentage below." },
        { id: "vl_loan_pct", label: "…or loan as % of price", type: "number", required: false, showIf: { financing_type: LOAN } },
        { id: "loan_rate_type", label: "Interest rate", type: "select", required: false, default: "Prevailing rate (leave blank)",
          options: ["Prevailing rate (leave blank)", "Fixed", "Adjustable"], showIf: { financing_type: LOAN },
          hint: "If neither is chosen, the form uses a fixed rate at the prevailing rate for the buyer's credit." },
        { id: "vl_fixed_rate_max", label: "Fixed rate not to exceed (%)", type: "number", required: false, showIf: { loan_rate_type: ["Fixed"] } },
        { id: "vl_adj_rate_max", label: "Adjustable rate at origination not to exceed (%)", type: "number", required: false, showIf: { loan_rate_type: ["Adjustable"] } },
        { id: "vl_financing_period_days", label: "Loan commitment within (days after Effective Date)", type: "number", required: false, showIf: { financing_type: LOAN },
          hint: "Blank = Closing Date or 30 days, whichever is first." },
        { id: "loan_application_deadline_days", label: "Buyer applies for the loan within (days)", type: "number", required: false, default: 5, showIf: { financing_type: LOAN } },
        { id: "vl_sf_position", label: "Seller financing — mortgage position", type: "select", required: false, default: "First mortgage",
          options: ["First mortgage", "Second mortgage"], showIf: { financing_type: ["Seller financing"] } },
        { id: "vl_sf_amount", label: "Seller financing — note amount ($)", type: "currency", required: false, showIf: { financing_type: ["Seller financing"] } },
        { id: "vl_sf_rate", label: "Seller financing — annual interest (%)", type: "number", required: false, showIf: { financing_type: ["Seller financing"] } },
        { id: "vl_sf_terms", label: "Seller financing — payable as follows", type: "text", required: false, showIf: { financing_type: ["Seller financing"] },
          hint: "e.g. 'monthly payments of principal and interest amortized over 10 years, balloon at 5 years'." },
        { id: "vl_as_mortgagee", label: "Assumption — existing mortgage held by", type: "text", required: false, showIf: { financing_type: ["Assume existing mortgage"] } },
        { id: "vl_as_loan_no", label: "Assumption — loan number (LN#)", type: "text", required: false, showIf: { financing_type: ["Assume existing mortgage"] } },
        { id: "vl_as_amount", label: "Assumption — approximate balance ($)", type: "currency", required: false, showIf: { financing_type: ["Assume existing mortgage"] } },
        { id: "vl_as_payment", label: "Assumption — monthly payment ($)", type: "currency", required: false, showIf: { financing_type: ["Assume existing mortgage"] } },
        { id: "vl_as_includes_ti", label: "Payment includes taxes and insurance?", type: "select", required: false, options: ["Yes", "No"], showIf: { financing_type: ["Assume existing mortgage"] } },
        { id: "vl_as_rate_type", label: "Assumption — rate type", type: "select", required: false, default: "Fixed", options: ["Fixed", "Other"], showIf: { financing_type: ["Assume existing mortgage"] } },
        { id: "vl_as_rate_other", label: "Describe the rate", type: "text", required: false, showIf: { vl_as_rate_type: ["Other"] } },
        { id: "vl_as_rate", label: "Assumption — interest rate (%)", type: "number", required: false, showIf: { financing_type: ["Assume existing mortgage"] } },
        { id: "vl_as_escalate", label: "Rate on assumption", type: "select", required: false, options: ["Will escalate", "Will not escalate"], showIf: { financing_type: ["Assume existing mortgage"] } },
        { id: "vl_as_max_rate", label: "Either party may pay the excess if the rate exceeds (%)", type: "number", required: false, showIf: { financing_type: ["Assume existing mortgage"] } },
        { id: "vl_as_max_fee", label: "…or the assumption/transfer fee exceeds ($)", type: "currency", required: false, showIf: { financing_type: ["Assume existing mortgage"] } }
      ]
    },
    {
      id: 4,
      title: "Due Diligence (Paragraph 9)",
      subtitle: "The buyer's window to check zoning, soil, access, utilities and permits",
      why: "This is the buyer's main escape hatch on land: during the Due Diligence Period they can walk away for any reason and get the deposit back.",
      fields: [
        { id: "vl_due_diligence", label: "Due Diligence Period?", type: "select", required: true, default: "Yes — buyer gets a Due Diligence Period",
          options: ["Yes — buyer gets a Due Diligence Period", "No — buyer is already satisfied (no due diligence)"],
          why: "Choosing 'No' (9a-2) means the buyer accepts zoning, utilities/septic, environmental conditions as-is — use only when the buyer has already checked." },
        { id: "vl_dd_days", label: "Due Diligence Period (days after Effective Date)", type: "number", required: false, default: 30,
          showIf: { vl_due_diligence: ["Yes — buyer gets a Due Diligence Period"] },
          hint: "Form default is 30 if left blank. Rezoning or permitting may need 60–90+.",
          why: "Long enough for survey, soil/perc test, environmental Phase 1 and a zoning check." },
        { id: "vl_cccl_waive", label: "Coastal Construction Control Line (9d)", type: "select", required: false, default: "No — keep the right to a CCCL affidavit/survey",
          options: ["No — keep the right to a CCCL affidavit/survey", "Yes — buyer waives the CCCL affidavit/survey"],
          hint: "Only matters if any part of the land is seaward of the CCCL." }
      ]
    },
    {
      id: 5,
      title: "Title & Survey (Paragraph 8)",
      subtitle: "Deed type, title evidence, and time to fix title problems",
      why: "Title problems (liens, access, easements) are common on land. These answers decide who pays for title work and how long the seller has to cure defects.",
      fields: [
        { id: "vl_deed_type", label: "Seller conveys title by", type: "select", required: true, default: "Statutory warranty deed",
          options: ["Statutory warranty deed", "Special warranty deed", "Other"] },
        { id: "vl_deed_other", label: "Other deed (specify)", type: "text", required: false, showIf: { vl_deed_type: ["Other"] } },
        { id: "vl_title_subject_to", label: "Other matters title will be subject to (optional)", type: "text", required: false,
          hint: "e.g. 'existing ingress/egress easement recorded in OR Book …'. Leave blank if none." },
        { id: "vl_title_ev_paid_by", label: "Title evidence at whose expense?", type: "select", required: true, default: "Seller's expense",
          options: ["Seller's expense", "Buyer's expense"],
          why: "The party who pays for the owner's title policy also picks the closing agent (8a)." },
        { id: "vl_title_ev_type", label: "Title evidence", type: "select", required: true, default: "Title insurance commitment",
          options: ["Title insurance commitment", "Abstract of title"] },
        { id: "vl_title_ev_timing", label: "Title evidence delivered…", type: "select", required: true, default: "At least X days before Closing Date",
          options: ["Within X days after Effective Date", "At least X days before Closing Date"] },
        { id: "vl_title_ev_days", label: "Days (for the timing above)", type: "number", required: true, default: 15 },
        { id: "vl_title_exam_days", label: "Buyer's title examination (days after receiving title evidence)", type: "number", required: false,
          hint: "Form default is 10 if left blank." },
        { id: "vl_cure_days", label: "Seller's cure period for title defects (days)", type: "number", required: false,
          hint: "Form default is 30 if left blank." }
      ]
    },
    {
      id: 6,
      title: "Closing, Costs & Assignment (Paragraphs 4, 7, 10)",
      subtitle: "When it closes and the cost items you can negotiate",
      why: "The Closing Date controls every other deadline in the contract, including due diligence and financing.",
      fields: [
        { id: "closing_date", label: "Closing date (Paragraph 4)", type: "date", required: true,
          hint: "Allow time for the Due Diligence Period plus title work — often 45–60 days for land." },
        { id: "seller_other_costs", label: "Other costs paid by SELLER (optional)", type: "text", required: false, hint: "Paragraph 10(a) 'Other' line." },
        { id: "buyer_other_costs", label: "Other costs paid by BUYER (optional)", type: "text", required: false, hint: "Paragraph 10(b) 'Other' line." },
        { id: "vl_assessment_installments", label: "Special-assessment installments due after closing paid by (10d)", type: "select", required: false, default: "Buyer (form default)",
          options: ["Buyer (form default)", "Seller — paid in full at closing"] },
        { id: "assignability", label: "Assignability (Paragraph 7 — CHECK ONE)", type: "select", required: true, default: "May NOT assign this contract",
          options: ["May NOT assign this contract", "May assign and be released from liability", "May assign but NOT be released from liability"],
          why: "Land investors and builders often need to assign to an LLC — pick 'may assign' if so." }
      ]
    },
    {
      id: 7,
      title: "Addenda & Additional Terms (Paragraphs 22 & 23)",
      subtitle: "Attach addenda and add any land-specific terms",
      why: "Common land terms — perc test, rezoning, survey acreage, access — are written here so they're part of the contract.",
      fields: [
        { id: "vl_addenda", label: "Addenda (Paragraph 22)", type: "clause_picker", required: false,
          options: ["A. Back-up Contract", "B. Kick Out Clause", "C. HOA Addendum"],
          hint: "Attach the addendum form itself to the package if you use one." },
        { id: "addenda_other_text", label: "D. Other addendum (specify)", type: "text", required: false },
        { id: "common_clauses", label: "Common land clauses (select any)", type: "clause_picker", required: false,
          options: [
            "Buyer's obligation is contingent on a satisfactory soil/percolation test for a septic system during the Due Diligence Period.",
            "Buyer's obligation is contingent on confirming the Property's zoning permits Buyer's intended use during the Due Diligence Period.",
            "Seller to provide a current boundary survey at Seller's expense at least 10 days before Closing Date.",
            "Seller to remove all debris, junk vehicles, and personal property from the Property before closing.",
            "Seller to provide any existing surveys, environmental reports, soil tests, and permits in Seller's possession within 5 days after Effective Date.",
            "Buyer's obligation is contingent on confirming legal access to a public road during the Due Diligence Period.",
            "Buyer's obligation is contingent on confirming availability of electric service to the Property during the Due Diligence Period."
          ] },
        { id: "special_clauses", label: "Additional terms (free text)", type: "textarea", required: false,
          hint: "One term per line. Up to about 16 lines fit on the form." }
      ]
    },
    {
      id: 8,
      title: "Listing Agent & Buyer Contact (Paragraph 21 & signature page)",
      subtitle: "Who receives the offer, and the buyer's notice address",
      why: "Paragraph 21 names both agents. Your own name, license, and brokerage fill in automatically from your profile and company settings.",
      fields: [
        { id: "listing_agent_name", label: "Listing agent name", type: "text", required: true },
        { id: "vl_listing_license", label: "Listing agent license no.", type: "text", required: false },
        { id: "listing_agent_email", label: "Listing agent email", type: "text", required: true, hint: "The offer package is emailed here." },
        { id: "listing_agent_phone", label: "Listing agent phone", type: "text", required: false },
        { id: "listing_brokerage", label: "Listing brokerage", type: "text", required: false },
        { id: "vl_listing_brokerage_address", label: "Listing brokerage address", type: "text", required: false },
        { id: "vl_buyer_address", label: "Buyer's address for notices", type: "text", required: false },
        { id: "vl_buyer_phone", label: "Buyer's phone", type: "text", required: false },
        { id: "vl_buyer_email", label: "Buyer's email", type: "text", required: false },
        { id: "seller_paid_commission_pct", label: "Commission % the seller/listing side pays your brokerage", type: "number", required: false,
          hint: "Not on the contract — updates this deal's commission record." }
      ]
    },
    {
      id: 9,
      title: "Review & Generate Bundle",
      subtitle: "Confirm everything, then build the offer package",
      why: "The package contains the filled Vacant Land Contract, any broker forms, and the proof of funds — ready to sign and send.",
      fields: []
    }
  ]
};

// Export by contract type so future contracts (commercial) plug in here
export const WIZARDS = {
  as_is: AS_IS_WIZARD,
  vacant_land: VACANT_LAND_WIZARD,
  // commercial: COMM_WIZARD,    // future
};

export function getWizard(contractType = "as_is") {
  return WIZARDS[contractType] || AS_IS_WIZARD;
}
