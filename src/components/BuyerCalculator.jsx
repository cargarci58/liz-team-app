import React, { useState, useMemo } from "react";

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
    const downPayment = price * (downPct / 100);
    const loan = price - downPayment;
    const pi = monthlyPI(loan, rate, term);
    const tax = price * (taxRate / 100) / 12;
    const ins = price * (insRate / 100) / 12;
    const pmi = downPct < 20 ? (loan * (pmiRate / 100)) / 12 : 0;
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
function CashToCloseTab() {
  const [price, setPrice] = useState(450000);
  const [downPct, setDownPct] = useState(20);
  const [emdPct, setEmdPct] = useState(1);
  const [inspectionFee, setInspectionFee] = useState(500);
  const [appraisalFee, setAppraisalFee] = useState(600);
  const [lenderFees, setLenderFees] = useState(2000);
  const [surveyFee, setSurveyFee] = useState(450);
  const [prepaids, setPrepaids] = useState(3500);

  const result = useMemo(() => {
    const downPayment = price * (downPct / 100);
    const loan = price - downPayment;
    const emd = price * (emdPct / 100);
    const titleIns = flTitleInsurance(price);
    const docStampsNote = flDocStampsNote(loan);
    const intangibleTax = flIntangibleTax(loan);
    const titleSearch = 200;
    const recording = 150;
    const settlementFee = 500;

    const closingCosts =
      titleIns +
      docStampsNote +
      intangibleTax +
      titleSearch +
      recording +
      settlementFee +
      inspectionFee +
      appraisalFee +
      lenderFees +
      surveyFee +
      prepaids;

    const totalCash = downPayment + closingCosts;
    const cashAtClosing = totalCash - emd; // EMD already paid earlier

    return {
      downPayment, loan, emd, titleIns, docStampsNote, intangibleTax,
      titleSearch, recording, settlementFee, inspectionFee, appraisalFee,
      lenderFees, surveyFee, prepaids, closingCosts, totalCash, cashAtClosing
    };
  }, [price, downPct, emdPct, inspectionFee, appraisalFee, lenderFees, surveyFee, prepaids]);

  return (
    <div>
      <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#14532d" }}>
        <strong>💡 What this tells you:</strong> The total cash you need to bring to closing — down payment PLUS closing costs. Florida has specific taxes (doc stamps, intangible tax) most buyers don't know about.
      </div>

      <SliderRow
        label="Home Price"
        value={price}
        onChange={setPrice}
        min={100000} max={2000000} step={5000}
        prefix="$"
      />
      <SliderRow
        label="Down Payment %"
        value={downPct}
        onChange={setDownPct}
        min={3} max={50} step={1}
        suffix="%"
      />
      <SliderRow
        label="Earnest Money Deposit %"
        value={emdPct}
        onChange={setEmdPct}
        min={1} max={10} step={0.5}
        suffix="%"
        info="Good-faith deposit due within 3 days of contract. Held in escrow, applied to closing costs. Typically 1–3% in FL."
      />
      <SliderRow
        label="Home Inspection"
        value={inspectionFee}
        onChange={setInspectionFee}
        min={300} max={1500} step={50}
        prefix="$"
        info="Paid during inspection period. WDO (termite) inspection adds ~$100. 4-point may be required by insurer."
      />
      <SliderRow
        label="Appraisal Fee"
        value={appraisalFee}
        onChange={setAppraisalFee}
        min={400} max={1500} step={50}
        prefix="$"
        info="Lender-ordered. Required to confirm the home is worth the loan amount."
      />
      <SliderRow
        label="Lender Fees (origination, underwriting)"
        value={lenderFees}
        onChange={setLenderFees}
        min={0} max={8000} step={100}
        prefix="$"
        info="Origination, underwriting, processing, credit report. Shop multiple lenders — these vary widely."
      />
      <SliderRow
        label="Survey"
        value={surveyFee}
        onChange={setSurveyFee}
        min={0} max={1000} step={50}
        prefix="$"
        info="Optional but recommended. Shows property lines, encroachments, easements."
      />
      <SliderRow
        label="Prepaids (escrow setup)"
        value={prepaids}
        onChange={setPrepaids}
        min={0} max={15000} step={250}
        prefix="$"
        info="Lender collects ~2 months tax + ~14 months insurance up front to fund escrow account."
      />

      <div style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white", padding: 20, borderRadius: 12, marginTop: 20 }}>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>Total Cash Needed</div>
        <div style={{ fontSize: 36, fontWeight: 800 }}>{money(result.totalCash)}</div>
        <div style={{ fontSize: 13, opacity: 0.95, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.3)", paddingTop: 12, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Down Payment: {money(result.downPayment)}</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Closing Costs: {money(result.closingCosts)}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 8 }}>
            EMD already paid: {money(result.emd)}<br/>
            Cash at closing table: <strong>{money(result.cashAtClosing)}</strong>
          </div>
        </div>
      </div>

      <details style={{ marginTop: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, color: "#374151" }}>
          📋 Closing Costs Breakdown (FL-specific)
        </summary>
        <table style={{ width: "100%", marginTop: 12, fontSize: 13 }}>
          <tbody>
            <tr><td style={{ padding: "4px 0" }}>Owner's Title Insurance <Info>FL promulgated rate: $5.75/$1k up to $100k, then $5.00/$1k. Protects your ownership.</Info></td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.titleIns)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Doc Stamps on Note <Info>FL tax: $0.35 per $100 of loan amount. Buyer pays.</Info></td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.docStampsNote)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Intangible Tax <Info>FL tax: 0.2% (2 mills) of loan amount. Buyer pays.</Info></td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.intangibleTax)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Title Search</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.titleSearch)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Recording Fees</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.recording)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Settlement / Closing Fee</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.settlementFee)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Home Inspection</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.inspectionFee)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Appraisal</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.appraisalFee)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Lender Fees</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.lenderFees)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Survey</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.surveyFee)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Prepaids (escrow)</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.prepaids)}</td></tr>
          </tbody>
        </table>
      </details>

      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 12, fontStyle: "italic" }}>
        ⚠️ Estimate only. Your lender's Loan Estimate (LE) within 3 business days of application is the official figure. Seller concessions can reduce buyer's closing costs.
      </div>
    </div>
  );
}

// ============================================================
// Main component with tab navigation
// ============================================================
export default function BuyerCalculator() {
  const [tab, setTab] = useState("affordability");

  const tabs = [
    { id: "affordability", label: "🏡 Affordability", desc: "How much home can I afford?" },
    { id: "payment", label: "💵 Monthly Payment", desc: "What will my payment be?" },
    { id: "cash", label: "💰 Cash to Close", desc: "What do I need upfront?" },
  ];

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
      {tab === "cash" && <CashToCloseTab />}
    </div>
  );
}
