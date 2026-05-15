import { useState, useMemo } from "react";

function money(n) {
  if (!isFinite(n)) return "$0";
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? "-$" : "$") + abs.toLocaleString("en-US");
}

function flDocStampsDeed(price) {
  return Math.ceil(price / 100) * 0.70;
}

function flTitleInsurance(price) {
  if (price <= 0) return 0;
  if (price <= 100000) return price * 0.00575;
  return 100000 * 0.00575 + (price - 100000) * 0.00500;
}

function Info({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 6 }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{ background: "#e0f2fe", color: "#0c4a6e", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 11, fontWeight: 700, cursor: "pointer", lineHeight: "18px", padding: 0 }}>?</button>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "absolute", top: 22, left: 0, zIndex: 50, background: "#1f2937", color: "white", padding: "8px 12px", borderRadius: 6, fontSize: 12, lineHeight: 1.4, width: 260, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", cursor: "pointer" }}>
          {children}
        </div>
      )}
    </span>
  );
}

function SliderRow({ label, value, onChange, min, max, step, prefix, suffix, info }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const startEdit = () => { setDraft(String(value)); setEditing(true); };
  const commitEdit = () => {
    const cleaned = draft.replace(/[^0-9.\-]/g, "");
    const n = parseFloat(cleaned);
    if (!isNaN(n) && n >= 0) onChange(n);
    setEditing(false);
  };
  const handleKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") setEditing(false);
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
            <input type="text" inputMode="decimal" autoFocus value={draft}
              onChange={(e) => setDraft(e.target.value)} onBlur={commitEdit} onKeyDown={handleKey}
              style={{ width: 120, padding: "4px 8px", fontSize: 14, fontWeight: 700, color: "#1f2937", border: "2px solid #0c4a6e", borderRadius: 4, textAlign: "right", fontFamily: "inherit", outline: "none" }} />
            {suffix && <span style={{ fontSize: 14, fontWeight: 700, color: "#1f2937" }}>{suffix}</span>}
          </div>
        ) : (
          <button type="button" onClick={startEdit} title="Tap to type a value"
            style={{ background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 4, padding: "4px 10px", fontSize: 14, fontWeight: 700, color: "#1f2937", cursor: "pointer", fontFamily: "inherit" }}>
            {prefix}{Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}{suffix}
          </button>
        )}
      </div>
      <input type="range" min={min} max={max} step={step} value={sliderValue}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#0c4a6e" }} />
      {value > max && (
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, fontStyle: "italic" }}>
          Typed value exceeds slider range. Tap value to edit.
        </div>
      )}
    </div>
  );
}

export default function SellerCalculator() {
  const [salePrice, setSalePrice] = useState(450000);
  const [mortgagePayoff, setMortgagePayoff] = useState(180000);
  const [commissionPct, setCommissionPct] = useState(6);
  const [titleSettlement, setTitleSettlement] = useState(500);
  const [hoaTransferFee, setHoaTransferFee] = useState(0);
  const [sellerConcessions, setSellerConcessions] = useState(0);
  const [repairs, setRepairs] = useState(0);
  const [proratedTaxes, setProratedTaxes] = useState(1500);
  const [otherCosts, setOtherCosts] = useState(500);
  const [originalPurchasePrice, setOriginalPurchasePrice] = useState(300000);

  const result = useMemo(() => {
    const commission = salePrice * (commissionPct / 100);
    const docStamps = flDocStampsDeed(salePrice);
    const titleIns = flTitleInsurance(salePrice);
    const recording = 50;
    const totalCosts = commission + docStamps + titleIns + titleSettlement + hoaTransferFee + sellerConcessions + repairs + proratedTaxes + otherCosts + recording;
    const netProceeds = salePrice - mortgagePayoff - totalCosts;
    const equity = salePrice - originalPurchasePrice;
    const equityPct = originalPurchasePrice > 0 ? (equity / originalPurchasePrice) * 100 : 0;
    return { commission, docStamps, titleIns, recording, totalCosts, netProceeds, equity, equityPct };
  }, [salePrice, mortgagePayoff, commissionPct, titleSettlement, hoaTransferFee, sellerConcessions, repairs, proratedTaxes, otherCosts, originalPurchasePrice]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1f2937" }}>Seller Net Proceeds Calculator</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
          Florida-specific. Estimates the cash you walk away with after selling.
        </p>
      </div>

      <div style={{ background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#0c4a6e" }}>
        <strong>💡 What this tells you:</strong> Your sale price minus mortgage payoff, agent commission, FL doc stamps (~0.7%), title fees, and other closing costs. This is the check you'll receive at closing.
      </div>

      <SliderRow label="Sale Price" value={salePrice} onChange={setSalePrice}
        min={100000} max={2000000} step={5000} prefix="$"
        info="The price you sell for. Final amount on the closing statement." />

      <SliderRow label="Mortgage Payoff" value={mortgagePayoff} onChange={setMortgagePayoff}
        min={0} max={1500000} step={1000} prefix="$"
        info="Remaining balance on your loan. Includes per-diem interest through closing day. Get exact figure from your lender (payoff statement)." />

      <SliderRow label="Agent Commission %" value={commissionPct} onChange={setCommissionPct}
        min={1} max={10} step={0.25} suffix="%"
        info="Total commission paid by seller (typically split between listing and buyer agent). FL average 5-6%. Negotiable. NEW NAR rules: buyer agent commission may now be negotiated separately." />

      <SliderRow label="Title & Settlement Fees" value={titleSettlement} onChange={setTitleSettlement}
        min={0} max={3000} step={50} prefix="$"
        info="Settlement/closing fee charged by title company. Typically $300-$800 in FL." />

      <SliderRow label="HOA Transfer/Estoppel Fee" value={hoaTransferFee} onChange={setHoaTransferFee}
        min={0} max={1500} step={25} prefix="$"
        info="HOA estoppel letter + transfer fees. Florida statute caps estoppel at $299 ($499 if expedited). Only applies if HOA/condo." />

      <SliderRow label="Seller Concessions to Buyer" value={sellerConcessions} onChange={setSellerConcessions}
        min={0} max={50000} step={500} prefix="$"
        info="Money you agree to credit buyer at closing (closing cost help, repairs, etc.). Negotiated in contract." />

      <SliderRow label="Negotiated Repairs" value={repairs} onChange={setRepairs}
        min={0} max={30000} step={250} prefix="$"
        info="Repairs you agreed to pay for after inspection. Either you fix them or credit buyer the amount." />

      <SliderRow label="Prorated Property Taxes" value={proratedTaxes} onChange={setProratedTaxes}
        min={0} max={15000} step={100} prefix="$"
        info="FL property taxes are paid in arrears (Nov for prior year). Seller credits buyer for days owned in current year. Estimate ~1.1% of sale price ÷ 365 × days from Jan 1 to closing." />

      <SliderRow label="Other Costs (HOA dues, util reads, etc.)" value={otherCosts} onChange={setOtherCosts}
        min={0} max={5000} step={50} prefix="$"
        info="Outstanding HOA dues, final water/sewer reads, attorney fees if used, courier fees, wire fees, home warranty if offered." />

      <details style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 20 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, color: "#374151" }}>
          📈 Optional: Track equity gain (vs original purchase)
        </summary>
        <div style={{ marginTop: 12 }}>
          <SliderRow label="Original Purchase Price" value={originalPurchasePrice} onChange={setOriginalPurchasePrice}
            min={50000} max={2000000} step={5000} prefix="$"
            info="What you paid when you bought the home. Used to calculate equity gain." />
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: 10, fontSize: 13, color: "#14532d" }}>
            <strong>Appreciation:</strong> {money(result.equity)} ({result.equityPct.toFixed(1)}%)
          </div>
        </div>
      </details>

      <div style={{ background: "linear-gradient(135deg, #0c4a6e, #075985)", color: "white", padding: 20, borderRadius: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>Estimated Net Proceeds</div>
        <div style={{ fontSize: 36, fontWeight: 800 }}>{money(result.netProceeds)}</div>
        <div style={{ fontSize: 13, opacity: 0.95, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.3)", paddingTop: 12, lineHeight: 1.8 }}>
          <div>Sale Price: <strong>{money(salePrice)}</strong></div>
          <div>− Mortgage Payoff: <strong>{money(mortgagePayoff)}</strong></div>
          <div>− Total Closing Costs: <strong>{money(result.totalCosts)}</strong></div>
        </div>
      </div>

      <details style={{ marginTop: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, color: "#374151" }}>
          📋 Closing Costs Breakdown (FL-specific)
        </summary>
        <table style={{ width: "100%", marginTop: 12, fontSize: 13 }}>
          <tbody>
            <tr><td style={{ padding: "4px 0" }}>Agent Commission ({commissionPct}%) <Info>Paid out of seller proceeds at closing. Split between listing and buyer agent per the contract.</Info></td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.commission)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>FL Doc Stamps on Deed <Info>FL state tax: $0.70 per $100 of sale price. Seller pays in most FL counties (Miami-Dade splits with buyer).</Info></td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.docStamps)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Owner's Title Insurance <Info>FL custom: seller usually provides. Promulgated rate $5.75/$1k up to $100k, then $5.00/$1k.</Info></td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.titleIns)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Settlement / Closing Fee</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(titleSettlement)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>HOA Estoppel/Transfer</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(hoaTransferFee)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Seller Concessions</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(sellerConcessions)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Negotiated Repairs</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(repairs)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Prorated Taxes</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(proratedTaxes)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Recording Fees</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(result.recording)}</td></tr>
            <tr><td style={{ padding: "4px 0" }}>Other</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(otherCosts)}</td></tr>
            <tr style={{ borderTop: "2px solid #d1d5db" }}><td style={{ padding: "8px 0", fontWeight: 700 }}>Total Closing Costs</td><td style={{ textAlign: "right", fontWeight: 700 }}>{money(result.totalCosts)}</td></tr>
          </tbody>
        </table>
      </details>

      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 12, fontStyle: "italic" }}>
        ⚠️ Estimate only. Your title company's Seller's Net Sheet (issued before closing) is the official figure. Capital gains tax may apply on profit above $250k (single) / $500k (married) primary residence exclusion.
      </div>
    </div>
  );
}
