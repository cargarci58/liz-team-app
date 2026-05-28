import { useState, useEffect } from "react";
import { getWizard } from "./config/offerWizardSchema";

const API = "https://liz-team-server-api-production.up.railway.app";

// Florida addenda + required statutory disclosures. The "FL required" flag
// drives the addenda_picker default-selection on offer creation.
const STANDARD_ADDENDA = [
  // Always required by Florida statute on residential sales
  { id: "radon_disclosure",    label: "Radon Gas Disclosure (FL §404.056 — required)", flRequired: true },
  { id: "property_tax_disc",   label: "Property Tax Disclosure Summary (FL §689.261 — required)", flRequired: true },
  { id: "energy_efficiency",   label: "Florida Building Energy-Efficiency Disclosure (required)", flRequired: true },
  { id: "flood_disclosure",    label: "Flood Disclosure (FL residential — required since Oct 2024)", flRequired: true },
  { id: "seller_disclosure",   label: "Seller's Property Disclosure (Johnson v. Davis — required)", flRequired: true },
  // AS-IS rider — always included on an AS-IS contract
  { id: "as_is_rider",         label: "AS-IS Rider (Comprehensive)" },
  // Conditional — auto-suggested based on MLS data
  { id: "lead_paint",          label: "Lead-Based Paint Disclosure (homes built pre-1978)" },
  { id: "hoa_addendum",        label: "HOA Addendum / Disclosure (FL §720)" },
  { id: "condo_rider",         label: "Condominium Rider (FL §718)" },
  { id: "homestead",           label: "Homestead / Spousal Acknowledgment" },
  { id: "coastal_construction", label: "Coastal Construction Control Line Disclosure" },
  // Financing-type specific
  { id: "fha_addendum",        label: "FHA Financing Addendum" },
  { id: "va_addendum",         label: "VA Financing Addendum" },
  { id: "cash_addendum",       label: "Cash Sale Addendum" },
  // Property condition
  { id: "sinkhole_disclosure", label: "Sinkhole Disclosure (if known activity)" },
  { id: "mold_disclosure",     label: "Mold Disclosure" },
  { id: "insurance_disclosure", label: "Homeowners' Insurance Disclosure" },
  { id: "square_footage",      label: "Square Footage Disclosure" },
  // Misc
  { id: "comp_rider",          label: "Comprehensive Rider" },
];

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function FieldRenderer({ field, value, onChange, documents }) {
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
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {STANDARD_ADDENDA.map(a => (
          <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#374151", cursor: "pointer" }}>
            <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
            {a.label}
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

  const wizard = getWizard(offer?.base_contract_type || "as_is");
  const steps = wizard.steps;
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
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [offerId, token]);

  const setField = (id, val) => setData(d => ({ ...d, [id]: val }));

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

          {/* Pre-approval upload — only on Step 10 (the preapproval step) */}
          {step.fields && step.fields.some(f => f.type === "preapproval_picker") && (
            <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "#1e3a8a", marginBottom: 6, fontSize: 14 }}>
                📎 Upload the pre-approval letter (or proof of funds)
              </div>
              <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 12 }}>
                Upload a PDF or photo of the buyer's lender pre-approval. It will be saved to this transaction's documents and linked to this offer.
              </div>
              <label style={{ display: "inline-block" }}>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
                  disabled={preapUploading}
                  onChange={e => onPreapUpload(e.target.files && e.target.files[0])}
                  style={{ display: "none" }} />
                <span style={{ display: "inline-block", background: preapUploading ? "#9ca3af" : "#1e40af", color: "white", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: preapUploading ? "wait" : "pointer" }}>
                  {preapUploading ? "Uploading…" : "📎 Choose File"}
                </span>
              </label>
              {preapMsg && (
                <div style={{ marginTop: 12, background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 6, padding: 10, fontSize: 12, color: "#065f46" }}>
                  {preapMsg}
                </div>
              )}
            </div>
          )}

          {/* MLS upload + AI extraction — only on Step 1 */}
          {stepIdx === 0 && (
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

          <div style={{ display: "grid", gap: 18 }}>
            {visibleFields.map(f => (
              <div key={f.id}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  {f.label} {f.required && <span style={{ color: "#dc2626" }}>*</span>}
                </label>
                <FieldRenderer field={f} value={data[f.id]} onChange={(val) => setField(f.id, val)} documents={documents} />
                {f.hint && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{f.hint}</div>}
                {f.why && <div style={{ fontSize: 11, color: "#92400e", marginTop: 2, fontStyle: "italic" }}>{f.why}</div>}
              </div>
            ))}
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
