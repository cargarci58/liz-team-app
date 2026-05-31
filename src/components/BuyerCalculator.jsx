import React, { useState, useMemo, useEffect } from "react";
import { flTaxRate, buyerPaysOwnerTitleDefault } from "../lib/flTaxRates";

// ============================================================
// Smart Buyer Calculator — Florida-specific
// Tabs: Affordability | Monthly Payment | Cash-to-Close
// All math runs in-browser. No backend calls.
// ============================================================

const FL_DOC_STAMPS_DEED_PER_100 = 0.70;        // $0.70 per $100 of sale price (most FL counties)
const FL_DOC_STAMPS_NOTE_PER_100 = 0.35;        // $0.35 per $100 of loan amount
const FL_INTANGIBLE_TAX_RATE = 0.002;           // 0.2% of loan amount
const FL_TITLE_INS_TIER1_RATE = 0.00575;        // $5.75 per $1,000 up to $100k
const FL_TITLE_INS_TIER2_RATE = 0.00500;        // $5.00 per $1,000 from $100k to $1M

// Default down-payment % by loan type. Cash = 100% (no loan).
const DOWN_DEFAULTS = { Conventional: 5, FHA: 3.5, VA: 0, Cash: 100 };

function money(n) {
  if (!isFinite(n)) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function pct(n) {
  return (n * 100).toFixed(2) + "%";
}

// Standard amortization: monthly P&I
function monthlyPI(loanAmount, annualRatePct, years) {
  const r = (annualRatePct / 100) / 12;
  const n = years * 12;
  if (r === 0) return loanAmount / n;
  return loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// FL Owner's Title Insurance (promulgated rate)
function flTitleInsurance(price) {
  if (price <= 0) return 0;
  if (price <= 100000) return price * FL_TITLE_INS_TIER1_RATE;
  return 100000 * FL_TITLE_INS_TIER1_RATE + (price - 100000) * FL_TITLE_INS_TIER2_RATE;
}

// FL Doc stamps on deed (seller usually pays, but shown for transparency)
function flDocStampsDeed(price) {
  return Math.ceil(price / 100) * FL_DOC_STAMPS_DEED_PER_100;
}

// FL Doc stamps on note (buyer pays)
function flDocStampsNote(loan) {
  return Math.ceil(loan / 100) * FL_DOC_STAMPS_NOTE_PER_100;
}

// FL Intangible tax on mortgage (buyer pays)
function flIntangibleTax(loan) {
  return loan * FL_INTANGIBLE_TAX_RATE;
}

// ============================================================
// Teaching tooltip
// ============================================================
function Info({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: "#e0e7ff",
          color: "#3730a3",
          border: "none",
          borderRadius: "50%",
          width: 18,
          height: 18,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          lineHeight: "18px",
          padding: 0,
        }}
        aria-label="What is this?"
      >
        ?
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "absolute",
            top: 22,
            left: 0,
            zIndex: 50,
            background: "#1f2937",
            color: "white",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.4,
            width: 260,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            cursor: "pointer",
          }}
        >
          {children}
        </div>
      )}
    </span>
  );
}

// Slider + editable number input. Tap the value badge to type any amount (can exceed slider range).
function SliderRow({ label, value, onChange, min, max, step, prefix, suffix, info }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commitEdit = () => {
    const cleaned = draft.replace(/[^0-9.\-]/g, "");
    const n = parseFloat(cleaned);
    if (!isNaN(n) && n >= 0) {
      onChange(n);
    }
    setEditing(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") { setEditing(false); }
  };

  const sliderValue = Math.min(Math.max(value, min), max);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: "#374151", flex: 1 }}>
          {label}
          {info && <Info>{info}</Info>}
        </label>
        {editing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {prefix && <span style={{ fontSize: 14, fontWeight: 700, color: "#1f2937" }}>{prefix}</span>}
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKey}
              style={{
                width: 120,
                padding: "4px 8px",
                fontSize: 14,
                fontWeight: 700,
                color: "#1f2937",
                border: "2px solid #dc2626",
                borderRadius: 4,
                textAlign: "right",
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            {suffix && <span style={{ fontSize: 14, fontWeight: 700, color: "#1f2937" }}>{suffix}</span>}
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Tap to type a value"
            style={{
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 14,
              fontWeight: 700,
              color: "#1f2937",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {prefix}{Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}{suffix}
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#dc2626" }}
      />
      {value > max && (
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, fontStyle: "italic" }}>
          Typed value exceeds slider range — slider shows max. Tap value to edit.
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 1 — Affordability (income → max price)
// ============================================================
function AffordabilityTab() {
  const [grossIncome, setGrossIncome] = useState(90000);
  const [monthlyDebts, setMonthlyDebts] = useState(500);
  const [downPayment, setDownPayment] = useState(40000);
  const [rate, setRate] = useState(7.0);
  const [term, setTerm] = useState(30);
  const [dti, setDti] = useState(43);
  const [taxRate, setTaxRate] = useState(1.1);
  const [insRate, setInsRate] = useState(0.6);
  const [hoaMonthly, setHoaMonthly] = useState(0);

  const result = useMemo(() => {
    const monthlyIncome = grossIncome / 12;
    const maxTotalDebt = monthlyIncome * (dti / 100);
    const maxPITI = maxTotalDebt - monthlyDebts - hoaMonthly;
    if (maxPITI <= 0) {
      return { maxPrice: 0, maxPITI: 0, monthlyIncome, taxIns: 0, pi: 0 };
    }

    // Iteratively solve: PITI = P&I + (price * (tax+ins)/12)
    // P&I uses loan = price - down
    let lo = 0, hi = 5000000;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const loan = Math.max(0, mid - downPayment);
      const pi = monthlyPI(loan, rate, term);
      const taxIns = mid * ((taxRate + insRate) / 100) / 12;
      const piti = pi + taxIns;
      if (piti > maxPITI) hi = mid; else lo = mid;
    }
    const maxPrice = lo;
    const loan = Math.max(0, maxPrice - downPayment);
    const pi = monthlyPI(loan, rate, term);
    const taxIns = maxPrice * ((taxRate + insRate) / 100) / 12;

    return { maxPrice, maxPITI, monthlyIncome, taxIns, pi };
  }, [grossIncome, monthlyDebts, downPayment, rate, term, dti, taxRate, insRate, hoaMonthly]);

  return (
    <div>
      <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#78350f" }}>
        <strong>💡 What this tells you:</strong> The maximum home price you can likely qualify for based on your income, debts, and down payment. Lenders use a Debt-to-Income (DTI) ratio to decide.
      </div>

      <SliderRow
        label="Gross Annual Income"
        value={grossIncome}
        onChange={setGrossIncome}
        min={30000} max={500000} step={1000}
        prefix="$"
        info="Your total household income before taxes. Include both spouses if applying jointly."
      />
      <SliderRow
        label="Monthly Debt Payments"
        value={monthlyDebts}
        onChange={setMonthlyDebts}
        min={0} max={5000} step={50}
        prefix="$"
        info="Car loans, student loans, credit card minimums, child support. NOT rent or utilities."
      />
      <SliderRow
        label="Down Payment"
        value={downPayment}
        onChange={setDownPayment}
        min={0} max={300000} step={1000}
        prefix="$"
        info="Cash you'll put down. 20% avoids PMI. FHA loans allow as low as 3.5%."
      />
      <SliderRow
        label="Interest Rate"
        value={rate}
        onChange={setRate}
        min={3} max={10} step={0.125}
        suffix="%"
        info="Current mortgage rate. Get a real quote from a lender — rates change daily."
      />
      <SliderRow
        label="Loan Term (years)"
        value={term}
        onChange={setTerm}
        min={10} max={30} step={5}
        suffix=" yrs"
        info="30-year is most common (lower payment). 15-year saves big on interest but doubles the monthly."
      />
      <SliderRow
        label="Max DTI Ratio"
        value={dti}
        onChange={setDti}
        min={28} max={50} step={1}
        suffix="%"
        info="Debt-to-Income ratio cap. Conventional: ~43%. FHA: up to 50%. Lower = more comfortable payments."
      />
      <SliderRow
        label="Property Tax Rate"
        value={taxRate}
        onChange={setTaxRate}
        min={0.5} max={2.5} step={0.05}
        suffix="%"
        info="FL average is ~1.1% of home value annually. Varies by county. Miami-Dade ~1.0%, Broward ~1.2%."
      />
      <SliderRow
        label="Homeowners Insurance Rate"
        value={insRate}
        onChange={setInsRate}
        min={0.3} max={2.0} step={0.05}
        suffix="%"
        info="FL is expensive due to hurricanes — typically 0.5–1.0% of home value. Coastal areas higher."
      />
      <SliderRow
        label="HOA / Condo Fees (monthly)"
        value={hoaMonthly}
        onChange={setHoaMonthly}
        min={0} max={2000} step={25}
        prefix="$"
        info="Many FL condos and gated communities have HOA fees. Lenders count this against your DTI."
      />

      <div style={{ background: "linear-gradient(135deg, #dc2626, #991b1b)", color: "white", padding: 20, borderRadius: 12, marginTop: 20 }}>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>You can likely afford a home up to</div>
        <div style={{ fontSize: 36, fontWeight: 800 }}>{money(result.maxPrice)}</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.3)", paddingTop: 12 }}>
          Max monthly payment (PITI): <strong>{money(result.maxPITI)}</strong><br/>
          → Principal & Interest: {money(result.pi)}<br/>
          → Taxes & Insurance: {money(result.taxIns)}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 12, fontStyle: "italic" }}>
        ⚠️ This is an estimate. Final approval depends on credit score, employment history, and lender underwriting. Always get pre-approved before shopping.
      </div>
    </div>
  );
}

// ============================================================
// TAB 2 — Monthly Payment (price → payment)
// ============================================================
function PaymentTab() {
  const [price, setPrice] = useState(450000);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(7.0);
  const [term, setTerm] = useState(30);
  const [taxRate, setTaxRate] = useState(1.1);
  const [insRate, setInsRate] = useState(0.6);
  const [hoaMonthly, setHoaMonthly] = useState(0);
  const [pmiRate, setPmiRate] = useState(0.5);

  const result = useMemo(() => {
    // Clamp percent inputs so typing a dollar amount into a % field doesn't
    // produce nonsense (e.g. "90000" in "Down Payment %" would imply 900x
    // the price). The SliderRow lets users type values past the slider max.
    const safeDownPct = Math.max(0, Math.min(100, Number(downPct) || 0));
    const safeTaxRate = Math.max(0, Math.min(20, Number(taxRate) || 0));
    const safeInsRate = Math.max(0, Math.min(20, Number(insRate) || 0));
    const safePmiRate = Math.max(0, Math.min(10, Number(pmiRate) || 0));
    const downPayment = price * (safeDownPct / 100);
    const loan = price - downPayment;
    const pi = monthlyPI(loan, rate, term);
    const tax = price * (safeTaxRate / 100) / 12;
    const ins = price * (safeInsRate / 100) / 12;
    const pmi = safeDownPct < 20 ? (loan * (safePmiRate / 100)) / 12 : 0;
    const total = pi + tax + ins + hoaMonthly + pmi;
    return { downPayment, loan, pi, tax, ins, pmi, total };
  }, [price, downPct, rate, term, taxRate, insRate, hoaMonthly, pmiRate]);

  return (
    <div>
      <div style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#1e3a8a" }}>
        <strong>💡 What this tells you:</strong> Your full monthly housing cost (PITI + HOA + PMI) for a specific home price. This is what you'll actually write a check for each month.
      </div>

      <SliderRow
        label="Home Price"
        value={price}
        onChange={setPrice}
        min={100000} max={2000000} step={5000}
        prefix="$"
        info="The purchase price of the home."
      />
      <SliderRow
        label="Down Payment %"
        value={downPct}
        onChange={setDownPct}
        min={3} max={50} step={1}
        suffix="%"
        info="20% avoids PMI. 3% conventional / 3.5% FHA are minimums for most buyers."
      />
      <SliderRow
        label="Interest Rate"
        value={rate}
        onChange={setRate}
        min={3} max={10} step={0.125}
        suffix="%"
        info="Get a real rate quote from a lender. Lock it once you're under contract."
      />
      <SliderRow
        label="Loan Term"
        value={term}
        onChange={setTerm}
        min={10} max={30} step={5}
        suffix=" yrs"
        info="30-year keeps payment low. 15-year saves $100k+ in interest but ~50% higher payment."
      />
      <SliderRow
        label="Property Tax Rate"
        value={taxRate}
        onChange={setTaxRate}
        min={0.5} max={2.5} step={0.05}
        suffix="%"
        info="FL average ~1.1% annually. Homestead exemption (primary residence) saves $25k–$50k off assessed value."
      />
      <SliderRow
        label="Insurance Rate"
        value={insRate}
        onChange={setInsRate}
        min={0.3} max={2.0} step={0.05}
        suffix="%"
        info="FL homeowners insurance is among the highest in the US due to hurricane risk."
      />
      <SliderRow
        label="HOA (monthly)"
        value={hoaMonthly}
        onChange={setHoaMonthly}
        min={0} max={2000} step={25}
        prefix="$"
        info="Required for most condos and gated communities. Covers shared maintenance."
      />
      {downPct < 20 && (
        <SliderRow
          label="PMI Rate (annual)"
          value={pmiRate}
          onChange={setPmiRate}
          min={0.2} max={1.5} step={0.05}
          suffix="%"
          info="Private Mortgage Insurance — required when down payment is under 20%. Drops off automatically at 78% LTV."
        />
      )}

      <div style={{ background: "linear-gradient(135deg, #2563eb, #1e40af)", color: "white", padding: 20, borderRadius: 12, marginTop: 20 }}>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>Total Monthly Payment</div>
        <div style={{ fontSize: 36, fontWeight: 800 }}>{money(result.total)}</div>
        <div style={{ fontSize: 13, opacity: 0.95, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.3)", paddingTop: 12, lineHeight: 1.8 }}>
          <div>Principal & Interest: <strong>{money(result.pi)}</strong></div>
          <div>Property Tax: <strong>{money(result.tax)}</strong></div>
          <div>Insurance: <strong>{money(result.ins)}</strong></div>
          {result.pmi > 0 && <div>PMI: <strong>{money(result.pmi)}</strong></div>}
          {hoaMonthly > 0 && <div>HOA: <strong>{money(hoaMonthly)}</strong></div>}
          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12 }}>
            Loan amount: {money(result.loan)} · Down: {money(result.downPayment)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB 3 — Cash to Close (all-in upfront)
// ============================================================
function CashToCloseTab({ transactionId, token, showGenerate, county } = {}) {
  const [price, setPrice] = useState(450000);
  const [loanType, setLoanType] = useState("Conventional");
  const [downPct, setDownPct] = useState(5);
  const [rate, setRate] = useState(7.0);
  const [term, setTerm] = useState(30);
  const [emd, setEmd] = useState(5000);
  const [buyerPaysOwnerTitle, setBuyerPaysOwnerTitle] = useState(() => buyerPaysOwnerTitleDefault(county));
  const [buyerAgentPct, setBuyerAgentPct] = useState(2.5);
  const [buyerPaysAgent, setBuyerPaysAgent] = useState(false);
  const [originationPct, setOriginationPct] = useState(1.0);
  const [lenderTitleFees, setLenderTitleFees] = useState(900);
  const [inspectionFee, setInspectionFee] = useState(500);
  const [appraisalFee, setAppraisalFee] = useState(600);
  const [lenderFees, setLenderFees] = useState(1000);
  const [surveyFee, setSurveyFee] = useState(450);
  const [prepaids, setPrepaids] = useState(3500);
  const [sellerConcessions, setSellerConcessions] = useState(0);
  const [insRate, setInsRate] = useState(1.0);   // homeowners insurance, % of price / yr (FL avg ~1%)
  const [hoaMonthly, setHoaMonthly] = useState(0);
  const [pmiRate, setPmiRate] = useState(0.5);    // annual PMI, % of loan (when down < 20%)
  const [taxRate, setTaxRate] = useState(() => flTaxRate(undefined, county).rate);
  const [taxLoc, setTaxLoc] = useState(() => ({ label: county ? `${county} County` : "FL default", source: county ? "county" : "default" }));
  const [closingDate, setClosingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState(null);

  const isCash = loanType === "Cash";
  const selectLoanType = (t) => { setLoanType(t); setDownPct(DOWN_DEFAULTS[t]); };
  const userTouchedRate = React.useRef(false);
  const onTaxRateChange = (v) => { userTouchedRate.current = true; setTaxRate(v); };

  // Default the tax rate to the agent's profile city/county (where most of their
  // deals are). Falls back to the transaction's county, then the FL default.
  useEffect(() => {
    if (!token) return;
    const API = import.meta.env.VITE_API_URL || "https://liz-team-server-api-production.up.railway.app";
    fetch(API + "/profile", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json())
      .then(d => {
        const p = d && d.profile;
        if (!p || userTouchedRate.current) return;
        const cityToUse = p.city || "";
        const countyToUse = p.county || county || "";
        if (!cityToUse && !countyToUse) return;
        const r = flTaxRate(cityToUse, countyToUse);
        setTaxRate(r.rate);
        setTaxLoc({
          label: r.source === "city" ? `${cityToUse} (your profile)` : (countyToUse ? `${countyToUse} County` : "FL default"),
          source: r.source,
        });
      })
      .catch(() => {});
  }, [token, county]);

  // Escrow reserves / prepaids scale with taxes + insurance (a flat default badly
  // understates high-value homes). Estimate = 1 yr prepaid insurance + 2 mo
  // insurance cushion + 3 mo tax reserve. Auto-updates until the agent edits it.
  const userTouchedEscrow = React.useRef(false);
  const onPrepaidsChange = (v) => { userTouchedEscrow.current = true; setPrepaids(v); };
  useEffect(() => {
    if (userTouchedEscrow.current) return;
    const annualIns = price * (Math.max(0, Number(insRate) || 0) / 100);
    const annualTax = price * (Math.max(0, Number(taxRate) || 0) / 100);
    // Tax escrow: FL property taxes are billed ~November. The lender funds the
    // account so the Nov bill is covered with a 2-month cushion. The fewer monthly
    // payments before Nov, the more is collected up front.
    const cd = new Date(closingDate + "T00:00:00");
    const cm = isNaN(cd) ? 6 : cd.getMonth() + 1;          // 1-12
    const monthsUntilNov = (11 - cm + 12) % 12;
    const paymentsBeforeNov = Math.max(0, monthsUntilNov - 1);
    const taxEscrowMonths = Math.min(13, Math.max(2, 12 - paymentsBeforeNov + 2));
    // Prepaid insurance = 1 yr at closing + 2-month escrow cushion.
    const est = annualIns * (14 / 12) + annualTax * (taxEscrowMonths / 12);
    setPrepaids(Math.round(est));
  }, [price, insRate, taxRate, closingDate]);

  const result = useMemo(() => {
    const cash = loanType === "Cash";
    const safeDownPct = cash ? 100 : Math.max(0, Math.min(100, Number(downPct) || 0));
    const downPayment = price * (safeDownPct / 100);
    const loan = Math.max(0, price - downPayment); // 0 for cash
    const hasLoan = loan > 0;

    // Title insurance: in most FL counties (incl. Orange/Orlando) the SELLER pays
    // for the owner's policy and picks the closing agent — the buyer only pays the
    // lender's policy (simultaneous-issue, ~$25 promulgated). In Miami-Dade/Broward
    // the buyer customarily pays the owner's policy. Toggle handles both.
    const ownerPremium = flTitleInsurance(price);
    // Lender's title policy + endorsements (Form 9, 9.2, 8.1, 5.1, simultaneous
    // loan policy, etc.) — the buyer's loan pays these even when the seller pays
    // the owner's policy. Editable; title company schedule firms up the exact amount.
    const lenderTitle = hasLoan ? (Number(lenderTitleFees) || 0) : 0;
    const titleIns = (buyerPaysOwnerTitle ? ownerPremium : 0) + lenderTitle;
    const docStampsNote = hasLoan ? flDocStampsNote(loan) : 0;       // tax on the NOTE — loan only
    const intangibleTax = hasLoan ? flIntangibleTax(loan) : 0;       // tax on the MORTGAGE — loan only
    const titleSearch = buyerPaysOwnerTitle ? 200 : 0;
    const recording = 270; // deed (~$20) + mortgage (~$250)
    const settlementFee = 575;

    // Loan origination fee — a % of the loan amount (scales with loan size).
    const origination = hasLoan ? loan * (Math.max(0, Math.min(5, Number(originationPct) || 0)) / 100) : 0;

    // Loan-only fees (zeroed for cash purchases)
    const effAppraisal = hasLoan ? appraisalFee : 0;
    const effLenderFees = hasLoan ? lenderFees : 0;
    const effPrepaids = hasLoan ? prepaids : 0; // escrow reserves require a lender

    // Prepaid (per-diem) interest collected at closing: from the closing date
    // through the end of that month. interest = loan × (rate/365) × days.
    const interestRate = Math.max(0, Math.min(20, Number(rate) || 0));
    let interestDays = 0;
    const cdInt = new Date(closingDate + "T00:00:00");
    if (!isNaN(cdInt)) {
      const monthEnd = new Date(cdInt.getFullYear(), cdInt.getMonth() + 1, 0);
      interestDays = Math.max(0, Math.round((monthEnd - cdInt) / 86400000) + 1);
    }
    const prepaidInterest = hasLoan ? loan * ((interestRate / 100) / 365) * interestDays : 0;

    // Buyer's agent commission — under the 2024 NAR rules the buyer may owe their
    // agent directly if the seller's offered compensation doesn't cover it.
    const safeBuyerAgentPct = Math.max(0, Math.min(10, Number(buyerAgentPct) || 0));
    const buyerAgentFee = buyerPaysAgent ? price * (safeBuyerAgentPct / 100) : 0;

    const closingCosts =
      titleIns + docStampsNote + intangibleTax + titleSearch + recording +
      settlementFee + origination + inspectionFee + effAppraisal + effLenderFees + surveyFee +
      prepaidInterest + effPrepaids + buyerAgentFee;

    // FL taxes are paid in arrears — at closing the seller CREDITS the buyer for
    // the days the seller owned the home this year (Jan 1 → closing). This reduces
    // the buyer's cash to close. Same method the title company uses.
    const safeTaxRate = Math.max(0, Math.min(5, Number(taxRate) || 0));
    const annualPropertyTax = price * (safeTaxRate / 100);
    let daysOwned = 0;
    const cd = new Date(closingDate + "T00:00:00");
    if (!isNaN(cd)) {
      const jan1 = new Date(cd.getFullYear(), 0, 1);
      daysOwned = Math.max(0, Math.round((cd - jan1) / 86400000));
    }
    const taxProrationCredit = annualPropertyTax * (daysOwned / 365);

    const totalCash = downPayment + closingCosts - taxProrationCredit - sellerConcessions;
    const cashAtClosing = totalCash - emd; // EMD already paid earlier
    // Comparable to a title company's "Total Fixed Costs": closing costs only,
    // after credits, EXCLUDING down payment, escrow reserves & prepaid interest.
    const fixedCosts = closingCosts - effPrepaids - prepaidInterest - taxProrationCredit - sellerConcessions;

    // ── Estimated monthly payment (PITI + PMI + HOA) ──
    const annualInsurance = price * (Math.max(0, Number(insRate) || 0) / 100);
    const piMonthly = hasLoan ? monthlyPI(loan, interestRate, term) : 0;
    const taxMonthly = annualPropertyTax / 12;
    const insMonthly = annualInsurance / 12;
    const pmiApplies = hasLoan && loanType !== "VA" && safeDownPct < 20;
    const pmiMonthly = pmiApplies ? loan * (Math.max(0, Number(pmiRate) || 0) / 100) / 12 : 0;
    const hoaMo = Math.max(0, Number(hoaMonthly) || 0);
    const monthlyTotal = piMonthly + taxMonthly + insMonthly + pmiMonthly + hoaMo;

    return {
      cash, downPayment, loan, emd, titleIns, ownerPremium, lenderTitle, origination, docStampsNote, intangibleTax,
      titleSearch, recording, settlementFee, inspectionFee, effAppraisal, effLenderFees,
      surveyFee, prepaidInterest, interestDays, effPrepaids, buyerAgentFee, sellerConcessions,
      annualPropertyTax, taxProrationCredit, daysOwned, closingCosts, fixedCosts, totalCash, cashAtClosing,
      piMonthly, taxMonthly, insMonthly, pmiMonthly, hoaMo, monthlyTotal, pmiApplies
    };
  }, [price, loanType, downPct, emd, rate, term, buyerPaysOwnerTitle, buyerAgentPct, buyerPaysAgent, originationPct, lenderTitleFees, inspectionFee, appraisalFee, lenderFees, surveyFee, prepaids, sellerConcessions, taxRate, insRate, hoaMonthly, pmiRate, closingDate]);

  const generatePdf = async (lang = "en") => {
    if (!transactionId || !token) {
      setGenMsg({ type: "error", text: "Open this calculator from inside a transaction to generate a PDF." });
      return;
    }
    setGenerating(true);
    setGenMsg(null);
    try {
      const API = import.meta.env.VITE_API_URL || "https://liz-team-server-api-production.up.railway.app";
      const res = await fetch(API + "/transactions/" + transactionId + "/buyer-net-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          lang,
          price, downPct, loanType, term, rate, buyerPaysOwnerTitle,
          downPayment: result.downPayment, loan: result.loan, emd: result.emd,
          ownerTitleAmt: buyerPaysOwnerTitle ? result.ownerPremium : 0,
          lenderTitle: result.lenderTitle,
          origination: result.origination, originationPct,
          docStampsNote: result.docStampsNote,
          intangibleTax: result.intangibleTax, titleSearch: result.titleSearch,
          recording: result.recording, settlementFee: result.settlementFee,
          inspectionFee, appraisalFee: result.effAppraisal, lenderFees: result.effLenderFees,
          surveyFee, prepaids: result.effPrepaids,
          prepaidInterest: result.prepaidInterest,
          buyerAgentFee: result.buyerAgentFee,
          sellerConcessions, taxRate, annualPropertyTax: result.annualPropertyTax,
          taxProrationCredit: result.taxProrationCredit,
          closingCosts: result.closingCosts, fixedCosts: result.fixedCosts,
          totalCash: result.totalCash, cashAtClosing: result.cashAtClosing,
          piMonthly: result.piMonthly, taxMonthly: result.taxMonthly,
          insMonthly: result.insMonthly, pmiMonthly: result.pmiMonthly,
          hoaMonthly: result.hoaMo, monthlyTotal: result.monthlyTotal,
          estimatedClosingDate: closingDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setGenMsg({ type: "success", text: (lang === "es" ? "Hoja neta del comprador guardada como " : "Buyer Net Sheet saved as ") + "\"" + data.filename + "\". Download or print it from the Documents tab." });
    } catch (err) {
      setGenMsg({ type: "error", text: err.message || "Generation failed" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#14532d" }}>
        <strong>💡 What this tells you:</strong> The total cash the buyer needs at closing — down payment PLUS closing costs, minus the property-tax credit from the seller. Florida has specific taxes (doc stamps, intangible tax) most buyers don't know about.
      </div>

      <SliderRow label="Home Price" value={price} onChange={setPrice}
        min={100000} max={2000000} step={5000} prefix="$" />

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
          Loan Type
          <Info>Sets the typical minimum down payment: Conventional 5%, FHA 3.5%, VA 0%. Cash = no loan (skips loan taxes, lender fees, escrow reserves &amp; prepaid interest). FHA/VA upfront fees are normally financed into the loan, not paid in cash.</Info>
        </label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Conventional", "FHA", "VA", "Cash"].map((t) => (
            <button key={t} type="button" onClick={() => selectLoanType(t)}
              style={{ flex: "1 1 70px", padding: "8px", borderRadius: 6, border: "1px solid " + (loanType === t ? "#16a34a" : "#d1d5db"), background: loanType === t ? "#dcfce7" : "#fff", fontWeight: 700, fontSize: 12, color: loanType === t ? "#14532d" : "#6b7280", cursor: "pointer" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {isCash ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px", marginBottom: 16, fontSize: 13, color: "#14532d" }}>
          💵 Cash purchase — full price due at closing. No loan taxes, lender fees, escrow reserves, or prepaid interest.
        </div>
      ) : (
        <>
          <SliderRow label="Down Payment %" value={downPct} onChange={setDownPct}
            min={0} max={50} step={0.5} suffix="%"
            info="Auto-set by loan type (Conventional 5%, FHA 3.5%, VA 0%). Override as needed." />
          <SliderRow label="Loan Interest Rate %" value={rate} onChange={setRate}
            min={3} max={12} step={0.125} suffix="%"
            info="Buyer's mortgage rate. Used to estimate prepaid (per-diem) interest collected at closing — from the closing date through the end of that month." />
          <SliderRow label="Loan Term (years)" value={term} onChange={setTerm}
            min={10} max={30} step={5} suffix=" yrs"
            info="Loan length (most are 30 yr). Shown on the net sheet for reference; cash to close is the same regardless of term." />
        </>
      )}

      <SliderRow label="Earnest Money Deposit" value={emd} onChange={setEmd}
        min={0} max={100000} step={500} prefix="$"
        info="Good-faith deposit due within 3 days of contract. Held in escrow, applied to closing costs. Enter the dollar amount from the contract (often 1–3% of price)." />

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
          Who pays the Owner's Title Policy?
          <Info>FL custom is by county. Orange/Orlando &amp; most of FL: SELLER pays the owner's policy and picks the title company — the buyer pays only the lender's policy (~$25). Miami-Dade, Broward, Sarasota, Collier: BUYER pays.</Info>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setBuyerPaysOwnerTitle(false)}
            style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1px solid " + (!buyerPaysOwnerTitle ? "#16a34a" : "#d1d5db"), background: !buyerPaysOwnerTitle ? "#dcfce7" : "#fff", fontWeight: 700, fontSize: 12, color: !buyerPaysOwnerTitle ? "#14532d" : "#6b7280", cursor: "pointer" }}>
            Seller pays (most of FL)
          </button>
          <button type="button" onClick={() => setBuyerPaysOwnerTitle(true)}
            style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1px solid " + (buyerPaysOwnerTitle ? "#16a34a" : "#d1d5db"), background: buyerPaysOwnerTitle ? "#dcfce7" : "#fff", fontWeight: 700, fontSize: 12, color: buyerPaysOwnerTitle ? "#14532d" : "#6b7280", cursor: "pointer" }}>
            Buyer pays (Miami-Dade, etc.)
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
          Buyer's Agent Commission
          <Info>Under the 2024 NAR rules the buyer may pay their agent directly if the seller's offered compensation doesn't cover it. If the seller covers it, choose "Seller pays" — it won't count toward the buyer's cash.</Info>
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: buyerPaysAgent ? 8 : 0 }}>
          <button type="button" onClick={() => setBuyerPaysAgent(false)}
            style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1px solid " + (!buyerPaysAgent ? "#16a34a" : "#d1d5db"), background: !buyerPaysAgent ? "#dcfce7" : "#fff", fontWeight: 700, fontSize: 12, color: !buyerPaysAgent ? "#14532d" : "#6b7280", cursor: "pointer" }}>
            Seller pays it
          </button>
          <button type="button" onClick={() => setBuyerPaysAgent(true)}
            style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1px solid " + (buyerPaysAgent ? "#16a34a" : "#d1d5db"), background: buyerPaysAgent ? "#dcfce7" : "#fff", fontWeight: 700, fontSize: 12, color: buyerPaysAgent ? "#14532d" : "#6b7280", cursor: "pointer" }}>
            Buyer pays it
          </button>
        </div>
        {buyerPaysAgent && (
          <SliderRow label="Buyer's Agent Commission %" value={buyerAgentPct} onChange={setBuyerAgentPct}
            min={0} max={5} step={0.25} suffix="%"
            info="Percent of purchase price paid to the buyer's brokerage. Typically 2.5–3%." />
        )}
      </div>

      <SliderRow label="Home Inspection" value={inspectionFee} onChange={setInspectionFee}
        min={300} max={1500} step={50} prefix="$"
        info="Paid during inspection period. WDO (termite) inspection adds ~$100. 4-point may be required by insurer." />
      {!isCash && (
        <SliderRow label="Appraisal Fee" value={appraisalFee} onChange={setAppraisalFee}
          min={400} max={1500} step={50} prefix="$"
          info="Lender-ordered. Required to confirm the home is worth the loan amount." />
      )}
      {!isCash && (
        <SliderRow label="Loan Origination Fee %" value={originationPct} onChange={setOriginationPct}
          min={0} max={3} step={0.125} suffix="%"
          info="Lender's origination charge as a % of the LOAN amount (often ~1%). This scales with loan size — the single biggest line on large loans. Set to 0 for a no-origination / lender-credit loan." />
      )}
      {!isCash && (
        <SliderRow label="Other Lender Fees (underwriting, credit, etc.)" value={lenderFees} onChange={setLenderFees}
          min={0} max={8000} step={50} prefix="$"
          info="Underwriting, processing, credit report, tax service, flood cert — separate from origination % above." />
      )}
      {!isCash && (
        <SliderRow label="Lender's Title Policy & Endorsements" value={lenderTitleFees} onChange={setLenderTitleFees}
          min={0} max={5000} step={25} prefix="$"
          info="The buyer's loan pays for the lender's title policy + required endorsements (Form 9, 9.2, 8.1, 5.1, simultaneous loan policy) even when the seller pays the owner's policy. Typically $600–$3,000; confirm on the title company's schedule." />
      )}
      <SliderRow label="Survey" value={surveyFee} onChange={setSurveyFee}
        min={0} max={1000} step={50} prefix="$"
        info="Optional but recommended. Shows property lines, encroachments, easements." />
      <SliderRow label="Homeowners Insurance Rate %/yr" value={insRate} onChange={setInsRate}
        min={0.3} max={3.0} step={0.05} suffix="%"
        info="Annual homeowners insurance as a % of price. FL averages ~1% (highest in the US — hurricane risk); coastal/high-value homes run 1.5%+. Drives both the monthly payment and the escrow reserves — set the real quote if you have it." />
      <SliderRow label="HOA / Condo Fees (monthly)" value={hoaMonthly} onChange={setHoaMonthly}
        min={0} max={2000} step={25} prefix="$"
        info="Monthly HOA/condo dues, if any. Included in the monthly payment estimate." />
      {!isCash && result.pmiApplies && (
        <SliderRow label="PMI Rate %/yr" value={pmiRate} onChange={setPmiRate}
          min={0.2} max={1.5} step={0.05} suffix="%"
          info="Private Mortgage Insurance — required when down payment is under 20%. Annual % of the loan; drops off at 78% LTV." />
      )}
      {!isCash && (
        <SliderRow label="Escrow Reserves + Prepaids (taxes + insurance)" value={prepaids} onChange={onPrepaidsChange}
          min={0} max={60000} step={250} prefix="$"
          info="Auto-estimated as ~1 yr prepaid insurance + a few months of tax & insurance reserves — it SCALES with the home's taxes & insurance. On high-value homes this is large. Exact amount is on the lender's Loan Estimate; edit to override." />
      )}
      <SliderRow label="Seller Concessions (credit to buyer)" value={sellerConcessions} onChange={setSellerConcessions}
        min={0} max={50000} step={500} prefix="$"
        info="Closing-cost help the seller agreed to in the contract. Reduces the buyer's cash to close." />

      <SliderRow label="Property Tax Rate %" value={taxRate} onChange={onTaxRateChange}
        min={0.3} max={3.0} step={0.005} suffix="%"
        info="Total millage (% of value). Defaulted from your profile city; adjust for the specific property's city/county. Annual tax = price × rate." />
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "#6b7280" }}>
        Rate from <strong style={{ color: "#374151" }}>{taxLoc.label}</strong>{taxLoc.source === "default" ? " (no city/county on file — adjust above)" : ""}. Est. annual tax: <strong style={{ color: "#374151" }}>{money(result.annualPropertyTax)}</strong>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
          Estimated Closing Date
          <Info>FL taxes are paid in arrears. The seller credits the buyer for the days the seller owned the home this year (Jan 1 → closing), reducing the buyer's cash to close.</Info>
        </label>
        <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)}
          style={{ padding: "6px 10px", fontSize: 14, fontWeight: 600, color: "#1f2937", border: "1px solid #d1d5db", borderRadius: 4, fontFamily: "inherit" }} />
      </div>

      <div style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white", padding: 20, borderRadius: 12, marginTop: 20 }}>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>Total Cash Needed</div>
        <div style={{ fontSize: 36, fontWeight: 800 }}>{money(result.totalCash)}</div>
        <div style={{ fontSize: 13, opacity: 0.95, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.3)", paddingTop: 12, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700 }}>Down Payment: {money(result.downPayment)}</div>
          <div style={{ fontWeight: 700 }}>Closing Costs: {money(result.closingCosts)}</div>
          {result.taxProrationCredit > 0 && <div>− Property Tax Credit: {money(result.taxProrationCredit)}</div>}
          {result.sellerConcessions > 0 && <div>− Seller Concessions: {money(result.sellerConcessions)}</div>}
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 8 }}>
            EMD already paid: {money(result.emd)}<br/>
            Cash at closing table: <strong>{money(result.cashAtClosing)}</strong>
          </div>
        </div>
      </div>

      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginTop: 12, fontSize: 12, color: "#1e3a8a" }}>
        <strong>Closing costs only: {money(result.fixedCosts)}</strong> — excludes the down payment, escrow reserves &amp; prepaid interest. This is the apples-to-apples number to compare against a title company's "Total Fixed Costs."
      </div>

      <div style={{ background: "linear-gradient(135deg, #1e3a8a, #1e40af)", color: "white", padding: 20, borderRadius: 12, marginTop: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>Estimated Monthly Payment</div>
        <div style={{ fontSize: 32, fontWeight: 800 }}>{money(result.monthlyTotal)}/mo</div>
        <div style={{ fontSize: 13, opacity: 0.95, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.3)", paddingTop: 12, lineHeight: 1.8 }}>
          {result.piMonthly > 0 && <div>Principal &amp; Interest: <strong>{money(result.piMonthly)}</strong></div>}
          <div>Property Taxes: <strong>{money(result.taxMonthly)}</strong></div>
          <div>Homeowners Insurance: <strong>{money(result.insMonthly)}</strong></div>
          {result.pmiMonthly > 0 && <div>PMI: <strong>{money(result.pmiMonthly)}</strong></div>}
          {result.hoaMo > 0 && <div>HOA: <strong>{money(result.hoaMo)}</strong></div>}
        </div>
      </div>

      <details style={{ marginTop: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, color: "#374151" }}>
          📋 Closing Costs Breakdown (FL-specific)
        </summary>
        <table style={{ width: "100%", marginTop: 12, fontSize: 13 }}>
          <tbody>
            {buyerPaysOwnerTitle && <tr><td style={{ padding: "4px 0" }}>Owner's Title Insurance <Info>FL promulgated rate: $5.75/$1k up to $100k, then $5.00/$1k.</Info></td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.ownerPremium)}</td></tr>}
            {!result.cash && <tr><td style={{ padding: "4px 0" }}>Lender's Title Policy & Endorsements <Info>Loan title policy + endorsements (Form 9/9.2/8.1/5.1, simultaneous issue) the buyer's loan pays even when the seller covers the owner's policy.</Info></td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.lenderTitle)}</td></tr>}
            {!result.cash && <tr><td style={{ padding: "4px 0" }}>Doc Stamps on Note <Info>FL tax: $0.35 per $100 of loan amount. Buyer pays.</Info></td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.docStampsNote)}</td></tr>}
            {!result.cash && <tr><td style={{ padding: "4px 0" }}>Intangible Tax <Info>FL tax: 0.2% (2 mills) of loan amount. Buyer pays.</Info></td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.intangibleTax)}</td></tr>}
            {result.titleSearch > 0 && <tr><td style={{ padding: "4px 0" }}>Title Search</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.titleSearch)}</td></tr>}
            <tr><td style={{ padding: "4px 0" }}>Recording Fees</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.recording)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Settlement / Closing Fee</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.settlementFee)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Home Inspection</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.inspectionFee)}</td></tr>
            {!result.cash && <tr><td style={{ padding: "4px 0" }}>Appraisal</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.effAppraisal)}</td></tr>}
            {result.origination > 0 && <tr><td style={{ padding: "4px 0" }}>Loan Origination Fee</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.origination)}</td></tr>}
            {!result.cash && <tr><td style={{ padding: "4px 0" }}>Other Lender Fees</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.effLenderFees)}</td></tr>}
            <tr><td style={{ padding: "4px 0" }}>Survey</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.surveyFee)}</td></tr>
            {!result.cash && <tr><td style={{ padding: "4px 0" }}>Prepaid Interest ({result.interestDays} days)</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.prepaidInterest)}</td></tr>}
            {!result.cash && <tr><td style={{ padding: "4px 0" }}>Escrow Reserves (taxes + insurance)</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.effPrepaids)}</td></tr>}
            {result.buyerAgentFee > 0 && <tr><td style={{ padding: "4px 0" }}>Buyer's Agent Commission</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.buyerAgentFee)}</td></tr>}
            <tr style={{ borderTop: "1px solid #d1d5db" }}><td style={{ padding: "6px 0", fontWeight: 700 }}>Total Closing Costs</td><td style={{ textAlign: "right", fontWeight: 700 }}>{money(result.closingCosts)}</td></tr>
            {result.taxProrationCredit > 0 && <tr><td style={{ padding: "4px 0", color: "#15803d" }}>Property Tax Proration Credit ({result.daysOwned} days)</td><td style={{ textAlign: "right", fontWeight: 600, color: "#15803d" }}>−{money(result.taxProrationCredit)}</td></tr>}
            {result.sellerConcessions > 0 && <tr><td style={{ padding: "4px 0", color: "#15803d" }}>Seller Concessions</td><td style={{ textAlign: "right", fontWeight: 600, color: "#15803d" }}>−{money(result.sellerConcessions)}</td></tr>}
          </tbody>
        </table>
      </details>

      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 12, fontStyle: "italic" }}>
        ⚠️ Estimate only. Your lender's Loan Estimate (LE) within 3 business days of application is the official figure.
      </div>

      {showGenerate && transactionId && (
        <div style={{ marginTop: 20, padding: 16, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#14532d", marginBottom: 6 }}>📄 Generate Buyer's Net Sheet</div>
          <div style={{ fontSize: 12, color: "#14532d", marginBottom: 10, lineHeight: 1.5 }}>
            Generate a branded estimated buyer's net sheet (cash to close) and save it to this transaction's Documents.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => generatePdf("en")} disabled={generating}
              style={{ background: generating ? "#9ca3af" : "#15803d", color: "white", border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: generating ? "wait" : "pointer", fontFamily: "inherit" }}>
              {generating ? "Generating PDF..." : "📄 Generate Net Sheet (English)"}
            </button>
            <button type="button" onClick={() => generatePdf("es")} disabled={generating}
              style={{ background: generating ? "#9ca3af" : "#15803d", color: "white", border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: generating ? "wait" : "pointer", fontFamily: "inherit" }}>
              {generating ? "Generando PDF..." : "📄 Generar Hoja Neta (Español)"}
            </button>
          </div>
          {genMsg && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 6, fontSize: 12,
              background: genMsg.type === "success" ? "#dcfce7" : "#fee2e2",
              border: "1px solid " + (genMsg.type === "success" ? "#86efac" : "#fca5a5"),
              color: genMsg.type === "success" ? "#14532d" : "#7f1d1d" }}>
              {genMsg.type === "success" ? "✅ " : "⚠️ "}{genMsg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main component with tab navigation
// ============================================================
export default function BuyerCalculator({ transactionId, token, mode, county } = {}) {
  const [tab, setTab] = useState("affordability");

  const tabs = [
    { id: "affordability", label: "🏡 Affordability", desc: "How much home can I afford?" },
    { id: "payment", label: "💵 Monthly Payment", desc: "What will my payment be?" },
    { id: "cash", label: "💰 Cash to Close", desc: "What do I need upfront?" },
  ];

  // Dedicated net-sheet view (its own transaction tab): render only the net sheet
  // with the Generate PDF buttons, no calculator sub-tabs.
  if (mode === "net") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1f2937" }}>Buyer's Net Sheet</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
            Florida-specific estimated cash to close. Generate a branded English or Spanish PDF below.
          </p>
        </div>
        <CashToCloseTab transactionId={transactionId} token={token} county={county} showGenerate={true} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1f2937" }}>Smart Buyer Calculator</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
          Florida-specific. Tap the ❓ icons to learn what each number means.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "2px solid #e5e7eb" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "10px 8px",
              background: "transparent",
              border: "none",
              borderBottom: tab === t.id ? "3px solid #dc2626" : "3px solid transparent",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? "#dc2626" : "#6b7280",
              marginBottom: -2,
            }}
          >
            <div>{t.label}</div>
            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {tab === "affordability" && <AffordabilityTab />}
      {tab === "payment" && <PaymentTab />}
      {tab === "cash" && <CashToCloseTab transactionId={transactionId} token={token} county={county} showGenerate={false} />}
    </div>
  );
}
