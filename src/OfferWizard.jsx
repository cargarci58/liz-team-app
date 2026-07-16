import { useState, useEffect, useRef } from "react";
import { getWizard } from "./config/offerWizardSchema";

const API = "https://liz-team-server-api-production.up.railway.app";

// Florida addenda + required statutory disclosures. The "FL required" flag
// drives the addenda_picker default-selection on offer creation.
// FAR/BAR AS-IS (ASIS-7) addenda list exactly as printed on contract page 11.
// Keys are the contract letters so the checklist, the page-11 checkboxes, and
// the summary all match. (I, K, L are RESERVED on the form — omitted.)
const STANDARD_ADDENDA = [
  { id: "A",  label: "A. Condominium Rider" },
  { id: "B",  label: "B. Homeowners' Assn." },
  { id: "C",  label: "C. Seller Financing" },
  { id: "D",  label: "D. Mortgage Assumption" },
  { id: "E",  label: "E. FHA/VA Financing" },
  { id: "F",  label: "F. Appraisal Contingency" },
  { id: "G",  label: "G. Short Sale" },
  { id: "H",  label: "H. Homeowners'/Flood Insurance" },
  { id: "J",  label: "J. Interest-Bearing Account" },
  { id: "M",  label: "M. Defective Drywall" },
  { id: "N",  label: "N. Coastal Construction Control Line" },
  { id: "O",  label: "O. Insulation Disclosure" },
  { id: "P",  label: "P. Lead-Based Paint Disclosure (pre-1978)" },
  { id: "Q",  label: "Q. Housing for Older Persons" },
  { id: "R",  label: "R. Rezoning" },
  { id: "S",  label: "S. Lease Purchase / Lease Option" },
  { id: "T",  label: "T. Pre-Closing Occupancy" },
  { id: "U",  label: "U. Post-Closing Occupancy" },
  { id: "V",  label: "V. Sale of Buyer's Property" },
  { id: "W",  label: "W. Back-up Contract" },
  { id: "X",  label: "X. Kick-out Clause" },
  { id: "Y",  label: "Y. Seller's Attorney Approval" },
  { id: "Z",  label: "Z. Buyer's Attorney Approval" },
  { id: "AA", label: "AA. Licensee Property Interest" },
  { id: "BB", label: "BB. Binding Arbitration" },
  { id: "CC", label: "CC. Miami-Dade County Special Taxing District Disclosure" },
  { id: "DD", label: "DD. Seasonal/Vacation Rentals" },
  { id: "EE", label: "EE. Qualifying Improvements Disclosure" },
  { id: "FF", label: "FF. Credit Related to Buyer's Broker Compensation" },
  { id: "GG", label: "GG. Seller's Agreement with Respect to Buyer's Broker Compensation" },
];

// Fields agents fill on nearly every offer — highlighted green so the
// must-fill items stand out from the optional/conditional ones.
const COMMON_FIELDS = new Set([
  "preapproval_doc_id", "offer_effective_date", "buyer_names", "seller_names",
  "buyer_marital_status", "property_address", "property_county",
  "property_parcel_id", "property_legal_description",
  "purchase_price", "initial_emd", "initial_emd_deadline_days", "escrow_agent",
  "financing_type", "loan_rate_type", "loan_term_years", "loan_amount", "down_payment",
  "loan_application_deadline_days", "loan_approval_deadline_days", "appraisal_contingency",
  "inspection_period_days",
  "title_company", "title_closing_responsibility", "title_evidence_days", "survey_required",
  "home_warranty_paid_by", "special_assessments",
  "closing_date", "occupancy_type", "assignability", "selected_addenda",
  "common_clauses", "special_clauses", "items_included", "items_excluded",
  "listing_agent_name", "listing_agent_email", "listing_agent_phone", "listing_brokerage",
  "seller_paid_commission_pct",
]);

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function FieldRenderer({ field, value, onChange, documents, formLibrary, onUploadRiderForm, riderUploadBusy }) {
  // Hidden file input for uploading an official rider form straight from the
  // addenda picker (hooks stay at the top — FieldRenderer branches below).
  const riderFileRef = useRef(null);
  const [pendingRider, setPendingRider] = useState(null);
  const v = value != null ? value : (field.default != null ? field.default : "");

  if (field.type === "textarea") {
    return <textarea value={v} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />;
  }
  if (field.type === "select") {
    return (
      <select value={v} onChange={e => onChange(e.target.value)} style={inputStyle}>
        <option value="">— select —</option>
        {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "checkbox") {
    // Yes/No buttons — clearer than a tiny checkbox and the click target is bigger.
    const yes = v === true;
    const no = v === false;
    const ynBase = { padding: "8px 18px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "1px solid #d1d5db" };
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => onChange(true)}
          style={{ ...ynBase, background: yes ? "#0c4a6e" : "white", color: yes ? "white" : "#374151", borderColor: yes ? "#0c4a6e" : "#d1d5db" }}>
          ✓ Yes
        </button>
        <button type="button" onClick={() => onChange(false)}
          style={{ ...ynBase, background: no ? "#7f1d1d" : "white", color: no ? "white" : "#374151", borderColor: no ? "#7f1d1d" : "#d1d5db" }}>
          ✗ No
        </button>
      </div>
    );
  }
  if (field.type === "currency") {
    return (
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontSize: 14 }}>$</span>
        <input type="number" step="0.01" value={v} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, paddingLeft: 26 }} />
      </div>
    );
  }
  if (field.type === "number") {
    return <input type="number" value={v} onChange={e => onChange(e.target.value)} style={inputStyle} />;
  }
  if (field.type === "date") {
    return <input type="date" value={v} onChange={e => onChange(e.target.value)} style={inputStyle} />;
  }
  if (field.type === "addenda_picker") {
    const selected = Array.isArray(v) ? v : [];
    const toggle = (id) => {
      const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
      onChange(next);
    };
    // Per-rider form availability from the Form Library: fills automatically,
    // official form attaches, or missing (upload it once, right here).
    const lib = (formLibrary && formLibrary.byLetter) || {};
    const specials = (formLibrary && formLibrary.specials) || [];
    const badgeBase = { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, marginLeft: 6, whiteSpace: "nowrap" };
    const badge = (a) => {
      const info = lib[a.id];
      if (!info) return null;
      if (info.source === "fillable") return <span style={{ ...badgeBase, background: "#dcfce7", color: "#15803d" }}>✍️ fills automatically</span>;
      if (info.source === "uploaded") return <span style={{ ...badgeBase, background: "#e0f2fe", color: "#075985" }}>📎 your form attaches</span>;
      if (info.source === "static") return <span style={{ ...badgeBase, background: "#e0f2fe", color: "#075985" }}>📎 official form attaches</span>;
      return (
        <span style={{ whiteSpace: "nowrap" }}>
          <span style={{ ...badgeBase, background: "#fef3c7", color: "#92400e" }}>⚠️ form not installed</span>
          {onUploadRiderForm && (
            <button type="button"
              onClick={(e) => { e.preventDefault(); setPendingRider(a.id); riderFileRef.current && riderFileRef.current.click(); }}
              style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#075985", background: "none", border: "1px solid #7dd3fc", borderRadius: 10, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit" }}>
              {riderUploadBusy === a.id ? "Uploading…" : "⬆ Upload official form"}
            </button>
          )}
        </span>
      );
    };
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <input ref={riderFileRef} type="file" accept=".pdf" style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            e.target.value = "";
            if (f && pendingRider && onUploadRiderForm) onUploadRiderForm(pendingRider, f);
            setPendingRider(null);
          }} />
        {STANDARD_ADDENDA.map(a => (
          <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151", cursor: "pointer", flexWrap: "wrap" }}>
            <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
            <span>{a.label}{badge(a)}</span>
          </label>
        ))}
        {specials.length > 0 && (
          <div style={{ marginTop: 10, borderTop: "1px dashed #d1d5db", paddingTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              📌 Included with every offer
            </div>
            {specials.map(s => (
              <div key={s.letter} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151", flexWrap: "wrap", marginBottom: 4 }}>
                <span>✔️</span>
                <span>{s.label.replace(/ \(included with every offer\)/i, "")}
                  {s.source === "uploaded"
                    ? <span style={{ ...badgeBase, background: "#dcfce7", color: "#15803d" }}>✅ on file — attaches to every packet</span>
                    : <span style={{ ...badgeBase, background: "#fef3c7", color: "#92400e" }}>⚠️ not uploaded yet</span>}
                  {onUploadRiderForm && (
                    <button type="button"
                      onClick={(e) => { e.preventDefault(); setPendingRider(s.letter); riderFileRef.current && riderFileRef.current.click(); }}
                      style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#075985", background: "none", border: "1px solid #7dd3fc", borderRadius: 10, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit" }}>
                      {riderUploadBusy === s.letter ? "Uploading…" : (s.source === "uploaded" ? "Replace" : "⬆ Upload your broker's form")}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (field.type === "clause_picker") {
    const selected = Array.isArray(v) ? v : [];
    const toggle = (clause) => {
      const next = selected.includes(clause) ? selected.filter(x => x !== clause) : [...selected, clause];
      onChange(next);
    };
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {(field.options || []).map((clause, i) => (
          <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#374151", cursor: "pointer", lineHeight: 1.4 }}>
            <input type="checkbox" checked={selected.includes(clause)} onChange={() => toggle(clause)} style={{ marginTop: 3 }} />
            <span>{clause}</span>
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "preapproval_picker") {
    // Filter to docs that look like a pre-approval. Picker rendered alongside an upload button below.
    const candidates = (documents || []).filter(d => /pre.?approval|proof.*funds|pof/i.test((d.category || "") + " " + (d.name || "") + " " + (d.document_type || "")));
    return (
      <div>
        <select value={v} onChange={e => onChange(e.target.value)} style={inputStyle}>
          <option value="">— select an existing pre-approval / proof of funds —</option>
          {candidates.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
          {candidates.length === 0 && <option value="" disabled>None on file yet — upload one below</option>}
        </select>
      </div>
    );
  }
  // default: text
  return <input type="text" value={v} onChange={e => onChange(e.target.value)} style={inputStyle} />;
}

// Walk every step in the wizard and fold each field's schema-level default
// into the data object whenever data[id] is undefined. Must be applied any
// time we replace `data` wholesale (initial load, MLS extraction reload, etc.)
// — otherwise required fields render their default value visually but the
// validation sees undefined and complains.
function applyWizardDefaults(wizard, data) {
  const out = { ...(data || {}) };
  for (const s of (wizard?.steps || [])) {
    for (const f of (s.fields || [])) {
      if (f.default !== undefined && out[f.id] === undefined) {
        out[f.id] = f.default;
      }
    }
  }
  return out;
}

// The offers table stores selected_addenda in its own column (not in offer_data
// JSONB), but the wizard's addenda_picker reads from data.selected_addenda.
// Fold it in whenever we load/reload the offer.
function buildWizardData(offer) {
  const base = { ...(offer.offer_data || {}) };
  if (Array.isArray(offer.selected_addenda)) base.selected_addenda = offer.selected_addenda;
  return applyWizardDefaults(getWizard(offer.base_contract_type || "as_is"), base);
}

function fieldVisible(field, data) {
  // Rider-specific blanks only appear when that rider is checked in the picker.
  if (field.showIfAddendum) {
    const sel = Array.isArray(data.selected_addenda) ? data.selected_addenda : [];
    if (!sel.includes(field.showIfAddendum)) return false;
  }
  if (!field.showIf) return true;
  for (const [key, allowed] of Object.entries(field.showIf)) {
    const val = data[key];
    if (Array.isArray(allowed)) { if (!allowed.includes(val)) return false; }
    else if (val !== allowed) return false;
  }
  return true;
}

export default function OfferWizard({ offerId, token, onClose, onSaved }) {
  const [offer, setOffer] = useState(null);
  const [data, setData] = useState({});
  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  // MLS extraction state (visible on Step 1)
  const [mlsUploading, setMlsUploading] = useState(false);
  const [mlsExtracting, setMlsExtracting] = useState(false);
  const [mlsResultMsg, setMlsResultMsg] = useState(null);
  // Pre-approval upload state (visible on Step 10)
  const [preapUploading, setPreapUploading] = useState(false);
  const [preapMsg, setPreapMsg] = useState(null);
  // Packet generation state (visible on the Review step)
  const [generating, setGenerating] = useState(false);
  const [packetReady, setPacketReady] = useState(false);
  // Weekend closing-date override
  const [closingDateAck, setClosingDateAck] = useState(false);
  // Form Library: per-rider form availability (letter → {source, file_name, …})
  // drives the badges on the addenda picker + the upload-official-form button.
  const [formLibrary, setFormLibrary] = useState(null);
  const [riderUploadBusy, setRiderUploadBusy] = useState(null);

  const loadFormLibrary = async () => {
    try {
      const r = await fetch(API + "/form-library/riders", { headers: { Authorization: "Bearer " + token } });
      if (!r.ok) return;
      const b = await r.json();
      const map = {};
      for (const row of (b.riders || [])) map[row.letter] = row;
      setFormLibrary({ byLetter: map, specials: b.specials || [] });
    } catch { /* badges are progressive enhancement — picker works without them */ }
  };
  useEffect(() => { loadFormLibrary(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadRiderForm = async (letter, file) => {
    if (file.size > 15 * 1024 * 1024) { alert("⚠️ That PDF is over 15 MB — export a smaller copy and try again."); return; }
    setRiderUploadBusy(letter);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(",")[1]);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const r = await fetch(API + "/form-library/riders/" + letter, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ fileName: file.name, base64 }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Upload failed");
      await loadFormLibrary();
      alert(letter.length > 2
        ? "✅ Saved. This form now goes out with EVERY offer packet, with the buyer's name filled in automatically."
        : "✅ " + letter + " rider saved. It will be attached to this and every future offer packet, with the buyer/seller/property stamped on automatically.");
    } catch (e) {
      alert("⚠️ " + (e.message || "Upload failed"));
    } finally {
      setRiderUploadBusy(null);
    }
  };

  const wizard = getWizard(offer?.base_contract_type || "as_is");
  const steps = wizard.steps;
  // ⚡ EXPRESS MODE — 4 answers + standard Florida terms, then jump straight
  // to Review. Every value it sets is visible/EDITABLE on the review screen
  // and in the full wizard; nothing is hidden.
  const [express, setExpress] = useState(false);
  const [xp, setXp] = useState({ price: "", emd: "", closing: "", financing: "" });
  const applyExpress = () => {
    if (!xp.price || !xp.closing || !xp.financing) { alert("Answer the price, closing date, and how they're paying."); return; }
    const todayEt = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }) + "T00:00:00");
    const exp = new Date(todayEt); exp.setDate(exp.getDate() + 2);
    const expStr = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, "0")}-${String(exp.getDate()).padStart(2, "0")}`;
    setData(d => applyWizardDefaults(wizard, {
      ...d,
      purchase_price: xp.price,
      initial_emd: xp.emd || String(Math.max(1000, Math.round(Number(xp.price) * 0.01 / 500) * 500)),
      closing_date: xp.closing,
      financing_type: xp.financing,
      offer_effective_date: d.offer_effective_date || expStr,
    }));
    setExpress(false);
    setStepIdx(steps.length - 1); // straight to Review
  };
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(API + "/offers/" + offerId, { headers: { Authorization: "Bearer " + token } });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Failed to load offer");
        if (cancelled) return;
        setOffer(body.offer);
        // Fold schema defaults + offer.selected_addenda into data state.
        setData(buildWizardData(body.offer));
        setStepIdx(Math.max(0, (body.offer.current_step || 1) - 1));
        // Best-effort fetch the transaction's documents (for the preapproval picker).
        try {
          const dr = await fetch(API + "/documents/" + body.offer.transaction_id, { headers: { Authorization: "Bearer " + token } });
          if (dr.ok) {
            const dd = await dr.json();
            if (!cancelled) setDocuments(dd.documents || dd || []);
          }
        } catch {/* docs are optional for the wizard */}
        // Pull the transaction's pre-approval for the affordability warning + to
        // auto-fill financing type, in case it was uploaded via the transaction
        // overview (not the wizard).
        try {
          const pr = await fetch(API + "/transactions/" + body.offer.transaction_id + "/preapproval", { headers: { Authorization: "Bearer " + token } });
          if (pr.ok) {
            const pd = await pr.json();
            const pa = pd && pd.preapproval;
            if (pa && !cancelled) {
              setData(prev => {
                const next = { ...prev };
                if (pa.loan_amount && !next.preapproval_max_loan) next.preapproval_max_loan = pa.loan_amount;
                // loan_type on the pre-approval → financing_type (gap-fill)
                if (pa.loan_type && (next.financing_type == null || next.financing_type === "")) {
                  const lt = String(pa.loan_type);
                  const known = ["Conventional","FHA","VA","USDA","Cash"].find(k => lt.toLowerCase().includes(k.toLowerCase()));
                  next.financing_type = known || lt;
                }
                return next;
              });
            }
          }
        } catch {/* preapproval optional */}
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [offerId, token]);

  const setField = (id, val) => {
    if (id === "closing_date") setClosingDateAck(false); // re-warn if the date changes
    setData(d => ({ ...d, [id]: val }));
  };

  // Auto-calculate down payment ($) and loan amount from the offer PRICE and the
  // down-payment % (read from the pre-approval — e.g. FHA 3.5% — or inferred from
  // the program). The agent can still type a custom down payment or loan amount;
  // once they do, we stop overwriting it (we only auto-fill values we computed).
  const financeAutoRef = useRef({ dp: null, loan: null });
  // "$405,000" / "405,000" → 405000 (extraction + old drafts store formatted strings)
  const moneyNum = (x) => { const n = Number(String(x ?? "").replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; };
  const financeCalc = () => {
    const price = moneyNum(data.purchase_price);
    const ft = String(data.financing_type || "");
    if (ft === "Cash" || !price) return null;
    let pct = (data.down_payment_pct === "" || data.down_payment_pct == null) ? null : Number(data.down_payment_pct);
    if (pct == null || isNaN(pct)) {
      if (ft === "FHA") pct = 3.5;
      else if (ft === "VA" || ft === "USDA") pct = 0;
    }
    if (pct == null || isNaN(pct)) return null;
    return { price, pct, dp: Math.round(price * pct / 100), loan: Math.max(0, price - Math.round(price * pct / 100)) };
  };
  useEffect(() => {
    const calc = financeCalc();
    if (!calc) return;
    const { pct, dp, loan } = calc;
    setData(d => {
      const prev = financeAutoRef.current;
      // A value counts as MANUAL only if it's a real nonzero number that isn't
      // the current computed value and isn't what we auto-filled last time.
      // Blank, 0, and stale auto-fills all get recalculated — a draft carrying
      // a junk "0" down payment used to lock the calculator out entirely.
      const isManual = (val, computed, prevAuto) => {
        const n = moneyNum(val);
        return val !== "" && val != null && n !== 0 && n !== computed && (prevAuto == null || n !== prevAuto);
      };
      const next = { ...d };
      if ((d.down_payment_pct === "" || d.down_payment_pct == null) && pct != null) next.down_payment_pct = pct;
      if (!isManual(d.down_payment, dp, prev.dp)) next.down_payment = dp;
      if (!isManual(d.loan_amount, loan, prev.loan)) next.loan_amount = loan;
      return next;
    });
    financeAutoRef.current = { dp, loan };
    // eslint-disable-next-line
  }, [data.purchase_price, data.down_payment_pct, data.financing_type]);
  // One-tap override: force down payment + loan from price × program %, no
  // matter what's in the boxes (the escape hatch when a draft has junk values).
  const applyFinanceCalc = () => {
    const calc = financeCalc();
    if (!calc) return;
    setData(d => ({ ...d, down_payment_pct: calc.pct, down_payment: calc.dp, loan_amount: calc.loan }));
    financeAutoRef.current = { dp: calc.dp, loan: calc.loan };
  };

  // Auto-include condition-driven addenda when the agent reaches the addenda step,
  // so required riders (FHA/VA→E, appraisal→F, condo→A, HOA→B, pre-1978→P, etc.)
  // are pre-checked. The agent changes the underlying answer to remove them.
  const onAddendaStep = Array.isArray(step?.fields) && step.fields.some(f => f.id === "selected_addenda");
  useEffect(() => {
    if (!onAddendaStep) return;
    const ftL = String(data.financing_type || "");
    const req = [];
    if (ftL === "FHA" || ftL === "VA") req.push("E");
    if (String(data.appraisal_contingency || "").startsWith("Yes")) req.push("F");
    if (data.is_condo) req.push("A");
    if (data.has_hoa) req.push("B");
    if (data.year_built && Number(data.year_built) < 1978) req.push("P");
    if (ftL === "Seller Financing") req.push("C");
    if (String(data.special_financing_method || "").startsWith("Assumption")) req.push("D");
    const fz = String(data.flood_zone || "").toUpperCase();
    if (fz && fz !== "X" && fz !== "X500") req.push("H");
    const cur = Array.isArray(data.selected_addenda) ? data.selected_addenda : [];
    const missing = req.filter(l => !cur.includes(l));
    if (missing.length) setData(d => ({ ...d, selected_addenda: [...(d.selected_addenda || []), ...missing] }));
    // eslint-disable-next-line
  }, [onAddendaStep]);

  const save = async ({ nextStepIdx, status }) => {
    setSaving(true);
    setError(null);
    try {
      const body = { offerData: data };
      if (nextStepIdx != null) body.currentStep = nextStepIdx + 1;
      if (Array.isArray(data.selected_addenda)) body.selectedAddenda = data.selected_addenda;
      if (status) body.status = status;
      if (data.preapproval_doc_id) body.preapprovalDocId = data.preapproval_doc_id;
      const r = await fetch(API + "/offers/" + offerId, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || "Save failed");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onNext = async () => {
    // Validate required fields on this step
    const missing = (step.fields || []).filter(f => f.required && fieldVisible(f, data)).filter(f => {
      const v = data[f.id];
      // Required checkboxes (legal acknowledgments) must be specifically TRUE.
      if (f.type === "checkbox") return v !== true;
      return v == null || v === "" || (Array.isArray(v) && v.length === 0);
    });
    if (missing.length > 0) {
      setError("Please fill in: " + missing.map(f => f.label).join(", "));
      return;
    }
    const ok = await save({ nextStepIdx: stepIdx + 1 });
    if (ok) { setStepIdx(stepIdx + 1); setError(null); }
  };

  const onBack = async () => {
    await save({ nextStepIdx: stepIdx - 1 });
    setStepIdx(Math.max(0, stepIdx - 1));
    setError(null);
  };

  const onSaveDraft = async () => {
    const ok = await save({ nextStepIdx: stepIdx });
    if (ok && onSaved) onSaved();
  };

  // Upload MLS sheet and run AI extraction. The file goes through our server
  // (not directly to R2) because Cloudflare R2 has CORS preflight quirks with
  // AWS SDK v3 signed URLs. Merged data lands on the offer server-side.
  const onMlsUpload = async (file) => {
    if (!file) return;
    setError(null);
    setMlsResultMsg(null);
    setMlsUploading(true);
    try {
      if (file.size > 9 * 1024 * 1024) throw new Error("File too large (max 9 MB). Print the MLS sheet to a smaller PDF.");

      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          // Strip the 'data:<mime>;base64,' prefix
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      setMlsUploading(false);
      setMlsExtracting(true);

      // Server-proxied upload + extraction in one call
      const r = await fetch(API + "/offers/" + offerId + "/mls-upload-extract", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type || "application/pdf", base64 }),
      });
      const e = await r.json();
      if (!r.ok) throw new Error(e.error || "Upload/extract failed");

      // Poll the AI job
      const jobId = e.jobId;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        const pr = await fetch(API + "/ai-jobs/" + jobId, { headers: { Authorization: "Bearer " + token } });
        const pd = await pr.json();
        if (!pr.ok) throw new Error(pd.error || "Job poll failed");
        if (pd.job.status === "completed") {
          // Reload the offer so offer_data has the merged fields
          const or = await fetch(API + "/offers/" + offerId, { headers: { Authorization: "Bearer " + token } });
          const ob = await or.json();
          if (or.ok) {
            setOffer(ob.offer);
            // Re-apply defaults + fold in the auto-suggested addenda after MLS reload.
            setData(buildWizardData(ob.offer));
          }
          const extractedObj = (pd.job.result && pd.job.result.extracted) || {};
          const extractedKeys = Object.keys(extractedObj);
          setMlsResultMsg(
            "✅ Read " + extractedKeys.length + " field" + (extractedKeys.length === 1 ? "" : "s") + " from the MLS sheet: " +
            extractedKeys.join(", ") + ". Review below and edit anything that's off."
          );
          setMlsExtracting(false);
          return;
        }
        if (pd.job.status === "failed") {
          throw new Error(pd.job.error || "AI extraction failed");
        }
      }
      throw new Error("Extraction timed out after 90 seconds");
    } catch (err) {
      setError(err.message);
      setMlsUploading(false);
      setMlsExtracting(false);
    }
  };

  // Upload a pre-approval letter from within the wizard (server-proxied — no R2 CORS).
  const onPreapUpload = async (file) => {
    if (!file) return;
    setError(null);
    setPreapMsg(null);
    setPreapUploading(true);
    try {
      if (file.size > 9 * 1024 * 1024) throw new Error("File too large (max 9 MB)");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const r = await fetch(API + "/offers/" + offerId + "/preapproval-upload", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type || "application/pdf", base64 }),
      });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || "Upload failed");

      // Reload docs list + the offer so the new doc shows in the picker AND is selected
      try {
        const dr = await fetch(API + "/documents/" + offer.transaction_id, { headers: { Authorization: "Bearer " + token } });
        if (dr.ok) {
          const dd = await dr.json();
          setDocuments(dd.documents || dd || []);
        }
      } catch {}
      // Reload the offer so any financing details extracted from the letter
      // (financing_type, loan_rate_type, loan_term_years, loan_amount) appear.
      try {
        const or = await fetch(API + "/offers/" + offerId, { headers: { Authorization: "Bearer " + token } });
        const ob = await or.json();
        if (or.ok) { setOffer(ob.offer); setData(buildWizardData(ob.offer)); }
      } catch {}
      setField("preapproval_doc_id", out.documentId);
      const got = out.extracted ? Object.keys(out.extracted).filter(k => out.extracted[k] != null && out.extracted[k] !== "") : [];
      setPreapMsg("✅ Uploaded \"" + out.name + "\"." + (got.length ? " Read from letter: " + got.join(", ") + "." : ""));
    } catch (e) {
      setError(e.message);
    } finally {
      setPreapUploading(false);
    }
  };

  // Generate the offer packet PDF + download it.
  const onGeneratePacket = async () => {
    setError(null);
    setGenerating(true);
    try {
      // Persist current data first
      await save({ nextStepIdx: stepIdx });
      // Generate
      const r = await fetch(API + "/offers/" + offerId + "/generate-packet", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Packet generation failed");
      setPacketReady(true);
      // Every packet must carry the pre-approval + the broker's always-attach
      // forms — call out loudly when one didn't make it in.
      const warns = [];
      if (body.preapprovalAttached === false) warns.push("• The PRE-APPROVAL LETTER could not be attached. Check Step 1 — it must be a PDF or photo (JPG/PNG).");
      if (body.brokerFormsAttached === 0) warns.push("• Your BROKER'S BUYER DISCLOSURE isn't on file yet. Upload it once on the Addenda step under '📌 Included with every offer'.");
      if (warns.length) alert("⚠️ Packet generated, but it's missing:\n\n" + warns.join("\n\n") + "\n\nFix and click Generate again before sending.");
      // Trigger download immediately
      const u = await fetch(API + "/offers/" + offerId + "/packet-url", { headers: { Authorization: "Bearer " + token } });
      const ub = await u.json();
      if (u.ok && ub.url) window.open(ub.url, "_blank");
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const onDownloadPacket = async () => {
    try {
      const u = await fetch(API + "/offers/" + offerId + "/packet-url", { headers: { Authorization: "Bearer " + token } });
      const ub = await u.json();
      if (!u.ok) throw new Error(ub.error || "Download failed");
      window.open(ub.url, "_blank");
    } catch (e) { setError(e.message); }
  };

  const onSubmit = async () => {
    setSubmitting(true);
    const ok = await save({ nextStepIdx: stepIdx, status: "ready" });
    setSubmitting(false);
    if (ok) {
      alert("Offer marked Ready. PDF packet assembly is coming in the next update — for now you can manually download from Documents.");
      if (onSaved) onSaved();
      onClose();
    }
  };

  if (loading) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={{ ...modalStyle, padding: 40, textAlign: "center" }} onClick={e => e.stopPropagation()}>Loading…</div>
      </div>
    );
  }
  if (!offer) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={{ ...modalStyle, padding: 40 }} onClick={e => e.stopPropagation()}>
          <div style={{ color: "#7f1d1d" }}>⚠️ {error || "Failed to load offer"}</div>
          <button onClick={onClose} style={btnSecondary}>Close</button>
        </div>
      </div>
    );
  }

  const visibleFields = (step.fields || []).filter(f => fieldVisible(f, data));

  // Affordability warning: if the financing needed (price − down payment) exceeds
  // the pre-approval's max loan amount, flag it. Agent can still proceed.
  const _num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const maxLoan = _num(data.preapproval_max_loan);
  // The offer PRICE can exceed the pre-approval (buyer covers the gap with cash/down
  // payment). Only warn when the LOAN AMOUNT itself exceeds the pre-approved max.
  const loanAmt = _num(data.loan_amount);
  const overPreapproval = maxLoan > 0 && loanAmt > 0
    && String(data.financing_type || "") !== "Cash"
    && loanAmt > maxLoan;

  // Date helpers — parse yyyy-mm-dd as local midnight; compare to today.
  const parseLocal = (s) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [yy, mm, dd] = s.split("-").map(Number);
    return new Date(yy, mm - 1, dd);
  };
  const todayMidnight = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();

  // Weekend closing-date warning: title/closing companies are closed Sat/Sun.
  let closingIsWeekend = false, closingDayName = "", closingInPast = false;
  const closingDt = parseLocal(data.closing_date);
  if (closingDt) {
    const dow = closingDt.getDay();
    closingIsWeekend = dow === 0 || dow === 6;
    closingDayName = dow === 0 ? "Sunday" : "Saturday";
    closingInPast = closingDt < todayMidnight;
  }

  // Offer-expiration date must be in the future (not today or past).
  const offerExpDt = parseLocal(data.offer_effective_date);
  const offerExpNotFuture = offerExpDt ? offerExpDt <= todayMidnight : false;

  // Seller closing-cost contribution over 6% of price.
  const sellerCredit = _num(data.closing_costs_paid_by);
  const price = _num(data.purchase_price);
  const sellerCreditOver6 = price > 0 && sellerCredit > 0 && (sellerCredit / price) > 0.06;

  // Flood zone other than X → likely requires flood insurance.
  const floodZone = String(data.flood_zone || "").trim().toUpperCase();
  const floodRisk = floodZone && floodZone !== "X" && floodZone !== "X500";

  // Addenda compliance. Condition → required addendum letter. We AUTO-INCLUDE these
  // (see effect below) so they're pre-checked. We also flag addenda that are selected
  // but contradict the answers (e.g. FHA/VA addendum on a Conventional loan).
  const sel = Array.isArray(data.selected_addenda) ? data.selected_addenda : [];
  const ft = String(data.financing_type || "");
  const requiredLetters = [];
  if (ft === "FHA" || ft === "VA") requiredLetters.push("E");
  if (String(data.appraisal_contingency || "").startsWith("Yes")) requiredLetters.push("F");
  if (data.is_condo) requiredLetters.push("A");
  if (data.has_hoa && !data.is_condo) requiredLetters.push("B"); // condo assn is NOT an HOA — Rider A covers condos
  if (data.year_built && Number(data.year_built) < 1978) requiredLetters.push("P");
  if (ft === "Seller Financing") requiredLetters.push("C");
  if (String(data.special_financing_method || "").startsWith("Assumption")) requiredLetters.push("D");
  if (floodRisk) requiredLetters.push("H");
  const complianceMisses = requiredLetters.filter(l => !sel.includes(l));
  // Wrongly-selected: addendum picked that conflicts with the chosen financing.
  const complianceConflicts = [];
  if (sel.includes("E") && ft && ft !== "FHA" && ft !== "VA") complianceConflicts.push("E. FHA/VA Financing is selected, but this is a " + ft + " loan — uncheck it unless the loan is FHA or VA.");
  if (sel.includes("C") && ft !== "Seller Financing") complianceConflicts.push("C. Seller Financing is selected, but the financing type isn't Seller Financing.");
  if (sel.includes("B") && data.is_condo && !data.has_hoa) complianceConflicts.push("B. Homeowners' Assn. is checked, but this is a CONDO — the condo association is covered by Rider A, not B. Uncheck B unless there is a separate HOA too.");

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid #e5e7eb", background: "#0c4a6e", color: "white", borderRadius: "12px 12px 0 0" }}>
          <div style={{ fontSize: 12, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            {wizard.contractName} · Step {stepIdx + 1} of {steps.length}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{step.title}</div>
          {step.subtitle && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{step.subtitle}</div>}
        </div>

        {/* Step progress dots */}
        <div style={{ padding: "12px 28px", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 4, flexWrap: "wrap" }}>
          {steps.map((s, i) => (
            <div key={s.id} title={s.title}
              style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stepIdx ? "#0c4a6e" : "#e5e7eb", minWidth: 12 }} />
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 28, overflowY: "auto", flex: 1 }}>
          {step.why && (
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 6, padding: 12, fontSize: 13, color: "#78350f", marginBottom: 20 }}>
              💡 <strong>Why this matters:</strong> {step.why}
            </div>
          )}

          {/* ⚡ EXPRESS — 4 answers + standard Florida terms, review at the end. */}
          {stepIdx === 0 && (
            <div style={{ border: "2px solid #F1C40F", background: "#FFFBEB", borderRadius: 12, padding: 14, marginBottom: 20 }}>
              {!express ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 22 }}>⚡</span>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 800, color: "#7A5C00", fontSize: 14 }}>In a hurry? Express offer</div>
                    <div style={{ fontSize: 12.5, color: "#7A5C00", lineHeight: 1.5 }}>Answer 4 questions — the app fills everything else with standard Florida terms (15-day inspection, deposit due in 3 days, seller pays deed stamps, possession at closing…). You review it all before anything is sent.</div>
                  </div>
                  <button type="button" onClick={() => setExpress(true)}
                    style={{ background: "#B7791F", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                    ⚡ Use Express
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 800, color: "#7A5C00", fontSize: 14, marginBottom: 10 }}>⚡ Express offer — 4 quick answers</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }} data-keep-grid="">
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7A5C00", marginBottom: 4 }}>1 · Offer price ($)</div>
                      <input type="number" value={xp.price} onChange={e => setXp(x => ({ ...x, price: e.target.value }))} placeholder="e.g. 450000" style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7A5C00", marginBottom: 4 }}>2 · Deposit ($) <span style={{ fontWeight: 400 }}>(blank = ~1%)</span></div>
                      <input type="number" value={xp.emd} onChange={e => setXp(x => ({ ...x, emd: e.target.value }))} placeholder="auto" style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7A5C00", marginBottom: 4 }}>3 · Closing date</div>
                      <input type="date" value={xp.closing} onChange={e => setXp(x => ({ ...x, closing: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7A5C00", marginBottom: 4 }}>4 · How are they paying?</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {["Cash", "Conventional", "FHA", "VA"].map(ft => (
                          <button key={ft} type="button" onClick={() => setXp(x => ({ ...x, financing: ft }))}
                            style={{ padding: "8px 12px", borderRadius: 16, border: xp.financing === ft ? "2px solid #7A5C00" : "1px solid #d1d5db", background: xp.financing === ft ? "#7A5C00" : "#fff", color: xp.financing === ft ? "#fff" : "#374151", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            {ft}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#7A5C00", marginBottom: 10 }}>Tip: upload the MLS sheet on the next screen (or before sending) so the property, seller, and listing agent fill in automatically.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => setExpress(false)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Never mind</button>
                    <button type="button" onClick={applyExpress} style={{ flex: 1, padding: "9px 16px", borderRadius: 8, border: "none", background: "#1E8449", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Apply & jump to Review →</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pre-approval: upload a new letter OR pick one already on file —
              ONE box, two clearly-labeled ways (the split layout confused
              users: "Choose File" above, an unexplained dropdown below). */}
          {step.fields && step.fields.some(f => f.type === "preapproval_picker") && (() => {
            const pickerField = step.fields.find(f => f.type === "preapproval_picker");
            return (
            <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "#1e3a8a", marginBottom: 6, fontSize: 14 }}>
                📎 Pre-approval letter (or proof of funds)
              </div>
              <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 12 }}>
                Two ways — upload the buyer's lender letter now, <strong>or</strong> pick one that's already in this deal's Documents. Either way it gets linked to this offer.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "inline-block" }}>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
                    disabled={preapUploading}
                    onChange={e => onPreapUpload(e.target.files && e.target.files[0])}
                    style={{ display: "none" }} />
                  <span style={{ display: "inline-block", background: preapUploading ? "#9ca3af" : "#1e40af", color: "white", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: preapUploading ? "wait" : "pointer" }}>
                    {preapUploading ? "Uploading…" : "📎 Upload New File"}
                  </span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>— or —</span>
                {pickerField && (
                  <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                    <FieldRenderer field={pickerField} value={data[pickerField.id]} onChange={(val) => setField(pickerField.id, val)} documents={documents} />
                  </div>
                )}
              </div>
              {preapMsg && (
                <div style={{ marginTop: 12, background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 6, padding: 10, fontSize: 12, color: "#065f46" }}>
                  {preapMsg}
                </div>
              )}
            </div>
            );
          })()}

          {/* Financing math strip — shows the program's down/loan split computed
              from the offer price and applies it in one tap. */}
          {visibleFields.some(f => f.id === "loan_amount") && String(data.financing_type || "") !== "Cash" && (() => {
            const calc = financeCalc();
            if (!calc) return null;
            const inSync = moneyNum(data.down_payment) === calc.dp && moneyNum(data.loan_amount) === calc.loan;
            return (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: "#166534", flex: "1 1 300px" }}>
                  🧮 <strong>{data.financing_type}</strong> with <strong>{calc.pct}%</strong> down on ${calc.price.toLocaleString()} = <strong>${calc.dp.toLocaleString()} down</strong> / <strong>${calc.loan.toLocaleString()} loan</strong>
                </div>
                {inSync
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>✓ applied below</span>
                  : <button onClick={applyFinanceCalc} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Use these numbers
                    </button>}
              </div>
            );
          })()}

          {/* MLS upload + AI extraction — on the property step */}
          {visibleFields.some(f => f.id === "property_address") && (
            <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "#1e3a8a", marginBottom: 6, fontSize: 14 }}>
                📎 Upload the MLS broker synopsis
              </div>
              <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 12 }}>
                Print the listing detail sheet from your MLS as a PDF and upload it here. AI reads property address, list price, year built, HOA, listing agent contact, and more — so you don't have to type it.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "inline-block" }}>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
                    disabled={mlsUploading || mlsExtracting}
                    onChange={e => onMlsUpload(e.target.files && e.target.files[0])}
                    style={{ display: "none" }} />
                  <span style={{ display: "inline-block", background: mlsUploading || mlsExtracting ? "#9ca3af" : "#1e40af", color: "white", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: mlsUploading || mlsExtracting ? "wait" : "pointer" }}>
                    {mlsUploading ? "Uploading…" : mlsExtracting ? "Reading MLS sheet…" : "📎 Choose MLS PDF"}
                  </span>
                </label>
                <span style={{ fontSize: 12, color: "#1e40af" }}>
                  …or fill in the fields manually below.
                </span>
              </div>
              {mlsResultMsg && (
                <div style={{ marginTop: 12, background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 6, padding: 10, fontSize: 12, color: "#065f46" }}>
                  {mlsResultMsg}
                </div>
              )}
            </div>
          )}

          {visibleFields.length === 0 && isLast && (
            <div style={{ padding: 20 }}>
              {/* Quick summary card */}
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 20, fontSize: 13, color: "#374151" }}>
                <div style={{ fontWeight: 700, color: "#111", marginBottom: 8 }}>📋 Offer summary</div>
                <div><strong>Property:</strong> {data.property_address || "—"}</div>
                <div><strong>Buyer:</strong> {data.buyer_names || "—"}</div>
                <div><strong>Seller (owner):</strong> {data.seller_names || "—"}</div>
                <div><strong>Price:</strong> {data.purchase_price ? "$" + Number(data.purchase_price).toLocaleString() : "—"}</div>
                <div><strong>EMD:</strong> {data.initial_emd ? "$" + Number(data.initial_emd).toLocaleString() : "—"}</div>
                <div><strong>Closing date:</strong> {data.closing_date || "—"}</div>
                <div><strong>Listing agent:</strong> {data.listing_agent_name || "—"} {data.listing_agent_email ? "(" + data.listing_agent_email + ")" : ""}</div>
                <div><strong>Addenda:</strong> {(Array.isArray(data.selected_addenda) && data.selected_addenda.length) || 0} selected</div>
              </div>

              {/* Generate / Download */}
              <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
                <div style={{ fontWeight: 700, color: "#1e3a8a", marginBottom: 6 }}>Generate the offer packet</div>
                <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 16 }}>
                  Builds a PDF with the offer summary + addenda checklist + the buyer's pre-approval letter, all in one file. Download and review before marking the offer Ready.
                </div>
                <button onClick={onGeneratePacket} disabled={generating}
                  style={{ background: generating ? "#9ca3af" : "#1e40af", color: "white", border: "none", padding: "12px 24px", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: generating ? "wait" : "pointer", fontFamily: "inherit", marginRight: 8 }}>
                  {generating ? "Generating…" : "📦 Generate Packet"}
                </button>
                {(packetReady || (offer && offer.packet_pdf_key)) && (
                  <button onClick={onDownloadPacket}
                    style={{ background: "#065f46", color: "white", border: "none", padding: "12px 24px", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    ⬇️ Download Again
                  </button>
                )}
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 16, fontStyle: "italic" }}>
                  V1: summary PDF. V2 will replace with the actual FAR/BAR AS-IS form once we have field-mapped templates.
                </div>
              </div>
            </div>
          )}

          {/* Addenda compliance — show on the addenda step */}
          {complianceMisses.length > 0 && visibleFields.some(f => f.id === "selected_addenda") && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#7f1d1d" }}>
              ⚠️ <strong>Possibly-required addenda not selected.</strong> Based on your answers, these should likely be attached:
              <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
                {complianceMisses.map((m, i) => <li key={i} style={{ marginBottom: 2 }}>{m}</li>)}
              </ul>
              <div style={{ marginTop: 6, fontSize: 12 }}>In Florida, a checked addendum becomes part of the contract — select them above (or proceed if intentionally omitted).</div>
            </div>
          )}

          {/* Addenda conflict — selected addendum contradicts the answers */}
          {complianceConflicts.length > 0 && visibleFields.some(f => f.id === "selected_addenda") && (
            <div style={{ background: "#fef9c3", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#78350f" }}>
              ⚠️ <strong>Check these selections:</strong>
              <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
                {complianceConflicts.map((m, i) => <li key={i} style={{ marginBottom: 2 }}>{m}</li>)}
              </ul>
            </div>
          )}

          {/* Flood zone warning — show on the property step */}
          {floodRisk && visibleFields.some(f => f.id === "property_address") && (
            <div style={{ background: "#fef9c3", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#78350f" }}>
              🌊 <strong>Flood zone {floodZone}.</strong> This property is in a Special Flood Hazard Area — a lender will require flood insurance, and it can be costly. Warn the buyer and factor it into their budget.
            </div>
          )}

          {/* Affordability warning on the price step or the financing step */}
          {overPreapproval && visibleFields.some(f => f.id === "purchase_price" || f.id === "loan_amount") && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#7f1d1d" }}>
              ⚠️ <strong>Loan exceeds pre-approval.</strong> The loan amount (${loanAmt.toLocaleString()}) is above the buyer's pre-approved max loan of ${maxLoan.toLocaleString()}. Lower the loan amount, increase the down payment, or get an updated pre-approval. You can still proceed.
            </div>
          )}

          {/* Offer-expiration date must be in the future */}
          {offerExpNotFuture && visibleFields.some(f => f.id === "offer_effective_date") && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#7f1d1d" }}>
              ⚠️ <strong>Offer expiration is today or in the past.</strong> Pick a future date (typically 1-2 business days out) so the seller has time to respond.
            </div>
          )}

          {/* Seller contribution over 6% of price */}
          {sellerCreditOver6 && visibleFields.some(f => f.id === "closing_costs_paid_by") && (
            <div style={{ background: "#fef9c3", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#78350f" }}>
              ⚠️ <strong>Seller contribution is over 6% of price.</strong> Most loan programs cap seller-paid closing costs (FHA 6%, Conventional 3-9% by down payment, VA limited). ${sellerCredit.toLocaleString()} is {((sellerCredit / price) * 100).toFixed(1)}% — the lender may not allow it. You can still proceed.
            </div>
          )}

          {/* Closing date in the past */}
          {closingInPast && visibleFields.some(f => f.id === "closing_date") && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#7f1d1d" }}>
              ⚠️ <strong>Closing date is in the past.</strong> Pick a future date that's realistic for the loan type.
            </div>
          )}

          {/* Weekend closing-date warning when this step shows the closing date */}
          {closingIsWeekend && !closingInPast && !closingDateAck && visibleFields.some(f => f.id === "closing_date") && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#7f1d1d" }}>
              ⚠️ <strong>Closing falls on a {closingDayName}.</strong> Title and closing companies are closed on weekends — this date likely won't work. Pick a weekday, or override to keep it.
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={() => setClosingDateAck(true)}
                  style={{ background: "#7f1d1d", color: "white", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Override — keep this date
                </button>
              </div>
            </div>
          )}

          {visibleFields.length > 0 && (
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, background: "#16a34a", borderRadius: 2 }} />
              Green = commonly filled on most offers · plain = optional / only when it applies
            </div>
          )}
          <div style={{ display: "grid", gap: 18 }}>
            {visibleFields.filter(f => f.type !== "preapproval_picker").map(f => {
              const common = COMMON_FIELDS.has(f.id);
              return (
              <div key={f.id} style={common ? { borderLeft: "3px solid #16a34a", paddingLeft: 12, background: "#f0fdf4", borderRadius: 6, padding: "10px 12px" } : {}}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: common ? "#15803d" : "#374151", marginBottom: 6 }}>
                  {f.label} {f.required && <span style={{ color: "#dc2626" }}>*</span>}
                  {common && <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", marginLeft: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>• commonly filled</span>}
                </label>
                <FieldRenderer field={f} value={data[f.id]} onChange={(val) => setField(f.id, val)} documents={documents}
                  formLibrary={formLibrary} onUploadRiderForm={uploadRiderForm} riderUploadBusy={riderUploadBusy} />
                {f.hint && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{f.hint}</div>}
                {f.why && <div style={{ fontSize: 11, color: "#92400e", marginTop: 2, fontStyle: "italic" }}>{f.why}</div>}
              </div>
            );})}
          </div>

          {error && (
            <div style={{ marginTop: 16, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: 12, fontSize: 13, color: "#7f1d1d" }}>⚠️ {error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 28px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "#f9fafb", borderRadius: "0 0 12px 12px" }}>
          <button onClick={onClose} style={btnSecondary}>Close</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onSaveDraft} disabled={saving} style={btnGhost}>{saving ? "Saving…" : "Save Draft"}</button>
            {stepIdx > 0 && <button onClick={onBack} disabled={saving} style={btnSecondary}>← Back</button>}
            {!isLast && <button onClick={onNext} disabled={saving} style={btnPrimary}>{saving ? "Saving…" : "Next →"}</button>}
            {isLast && <button onClick={onSubmit} disabled={submitting} style={btnPrimary}>{submitting ? "Submitting…" : "Mark Ready ✓"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const modalStyle = { background: "white", borderRadius: 12, maxWidth: 720, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" };
const btnPrimary = { background: "#0c4a6e", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const btnSecondary = { background: "#e5e7eb", color: "#374151", border: "none", padding: "10px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const btnGhost = { background: "transparent", color: "#374151", border: "1px solid #d1d5db", padding: "10px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
