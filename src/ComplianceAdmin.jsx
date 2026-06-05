import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  white: "#fff", black: "#111", gray: "#555", border: "#DDD",
  red: "#C0392B", lightRed: "#FADBD8", warning: "#B7770D",
  warningBg: "#FFFBEB", warningBorder: "#FCD34D",
  success: "#1E8449", successBg: "#D1FAE5",
  danger: "#991B1B", dangerBg: "#FEE2E2", dangerBorder: "#FCA5A5",
};

const EMPTY = {
  state: "FL",
  transaction_type: "",
  milestone_name_pattern: "",
  document_type: "",
  description: "",
  legal_consequence: "",
  statute_reference: "",
  is_required: true,
  is_conditional: false,
  conditional_logic: "",
  priority: 100,
  active: true,
  notes: ""
};

const COND_OPTIONS = [
  ["", "Always required"],
  ["pre1978", "Only if built before 1978"],
  ["hoa", "Only if HOA property"],
  ["condo", "Only if condominium"],
  ["coastal", "Only if coastal"],
  ["foreign_seller", "Only if foreign seller"],
  ["fha_va", "Only if FHA/VA loan"],
  ["seller_pays_buyer_broker", "Only if seller pays buyer broker"],
  ["tenant_occupied", "Only if tenant-occupied"],
  ["drywall_2001_2009", "Only if built 2001–2009"],
  ["short_sale", "Only if short sale"],
  ["seller_financing", "Only if seller financing"],
  ["post_closing_occupancy", "Only if seller stays after closing"],
  ["financed", "Only if financed"],
  ["cash", "Only if cash"],
  ["resale", "Only if resale"],
];
const condLabel = (f) => (COND_OPTIONS.find(c => c[0] === (f || ""))?.[1]) || f;

// Module-level so it doesn't remount on every keystroke (that dropped input focus).
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, marginBottom: 4, letterSpacing: 0.5 }}>{label}</div>
      {children}
    </div>
  );
}

function EditorForm({ form, setForm, onSave, onCancel, isNew }) {
  const input = (key, placeholder) => (
    <input type="text" value={form[key] ?? ""} placeholder={placeholder}
      onChange={e => setForm({ ...form, [key]: e.target.value })}
      style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid " + COLORS.border, fontSize: 13, boxSizing: "border-box" }} />
  );
  const textarea = (key, placeholder) => (
    <textarea value={form[key] ?? ""} placeholder={placeholder}
      onChange={e => setForm({ ...form, [key]: e.target.value })}
      style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid " + COLORS.border, fontSize: 13, minHeight: 60, boxSizing: "border-box", fontFamily: "inherit" }} />
  );
  return (
    <div style={{ background: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, border: "2px solid " + COLORS.red }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>
        {isNew ? "➕ New Document Requirement" : "✏️ Edit Requirement"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="STATE (blank = all states)">{input("state", "FL")}</Field>
        <Field label="TRANSACTION TYPE (blank = all)">{input("transaction_type", "Listing (Seller) or blank")}</Field>
      </div>
      <Field label="MILESTONE NAME PATTERN (keywords to match, lowercase)">
        {input("milestone_name_pattern", "e.g. earnest money, inspection period")}
      </Field>
      <Field label="DOCUMENT TYPE (name shown to agent)">
        {input("document_type", "e.g. EMD Receipt")}
      </Field>
      <Field label="DESCRIPTION (what the document is)">
        {textarea("description", "Receipt from escrow confirming EMD was deposited...")}
      </Field>
      <Field label="LEGAL CONSEQUENCE (why it matters)">
        {textarea("legal_consequence", "What happens if this is missed?")}
      </Field>
      <Field label="STATUTE REFERENCE">
        {input("statute_reference", "e.g. FS 689.302 or FAR/BAR Section 2")}
      </Field>
      <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={form.is_required}
            onChange={e => setForm({ ...form, is_required: e.target.checked })} /> Required
        </label>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={form.is_conditional}
            onChange={e => setForm({ ...form, is_conditional: e.target.checked })} /> Conditional
        </label>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={form.active}
            onChange={e => setForm({ ...form, active: e.target.checked })} /> Active
        </label>
      </div>
      {form.is_conditional && (
        <Field label="WHEN DOES THIS APPLY?">
          {input("conditional_logic", "e.g. Homes built before 1978")}
        </Field>
      )}
      <Field label="PRIORITY (lower number = checked first)">
        <input type="number" value={form.priority}
          onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 100 })}
          style={{ width: 100, padding: 8, borderRadius: 6, border: "1px solid " + COLORS.border, fontSize: 13 }} />
      </Field>
      <Field label="INTERNAL NOTES">{input("notes", "Notes for admins only")}</Field>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: 11, borderRadius: 8, border: "1.5px solid " + COLORS.border,
            background: COLORS.white, color: COLORS.gray, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={onSave}
          style={{ flex: 2, padding: 11, borderRadius: 8, border: "none",
            background: COLORS.red, color: COLORS.white, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {isNew ? "Create" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// Brokerage Required-Documents checklist manager (deal-level). System items are
// law (read-only); brokerage-added items can be added/removed and flow to every
// transaction of the chosen side automatically.
function RequiredDocsManager({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [side, setSide] = useState("Listing (Seller)");
  const [cond, setCond] = useState("");
  const [busy, setBusy] = useState(false);
  const h = { "Content-Type": "application/json", Authorization: "Bearer " + token };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + "/document-requirements/checklist-config", { headers: h });
      const d = await r.json();
      if (d.success) setItems(d.items || []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!label.trim()) { alert("Enter the document name."); return; }
    setBusy(true);
    try {
      const r = await fetch(API + "/document-requirements/custom", {
        method: "POST", headers: h,
        body: JSON.stringify({ label: label.trim(), side, conditionFlag: cond || null }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Add failed");
      setLabel(""); setCond(""); setShowAdd(false); await load();
    } catch (e) { alert("Add failed: " + e.message); }
    setBusy(false);
  };

  const remove = async (it) => {
    if (!confirm(`Remove "${it.doc_label}" as a brokerage requirement? It will stop appearing on that side's deals.`)) return;
    try {
      await fetch(API + "/admin/document-requirements/" + it.id, { method: "DELETE", headers: h });
      await load();
    } catch (e) { alert("Remove failed"); }
  };

  const SIDES = [["Listing (Seller)", "🏡 Seller-side deals"], ["Buyer Representation", "🔑 Buyer-side deals"]];

  const Row = (it) => (
    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
      background: COLORS.white, border: "1px solid " + COLORS.border, borderRadius: 8, marginBottom: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          {it.doc_label || it.document_type}
          {it.is_system_default
            ? <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#374151", background: "#E5E7EB", padding: "1px 6px", borderRadius: 10 }}>STATE / LAW</span>
            : <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#1A5276", background: "#D6EAF8", padding: "1px 6px", borderRadius: 10 }}>BROKER</span>}
        </div>
        <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 1 }}>{condLabel(it.condition_flag)}</div>
      </div>
      {it.is_system_default ? (
        <span style={{ fontSize: 11, color: COLORS.gray, fontStyle: "italic", flexShrink: 0 }}>required by law</span>
      ) : (
        <button onClick={() => remove(it)}
          style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 6, border: "1px solid " + COLORS.dangerBorder, background: COLORS.white, color: COLORS.danger, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          ✕ Remove
        </button>
      )}
    </div>
  );

  return (
    <div style={{ background: "#F8FAFC", border: "1px solid " + COLORS.border, borderRadius: 14, padding: 18, marginBottom: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.black, marginBottom: 4 }}>📋 Required Documents Checklist (per deal)</div>
      <div style={{ fontSize: 13, color: COLORS.gray, marginBottom: 14, lineHeight: 1.5 }}>
        What every transaction must have to be compliant. <b>STATE / LAW</b> items are fixed. Add your brokerage's own
        required documents below — they apply to <b>every deal</b> of that side automatically, and agents upload or waive them per deal.
      </div>
      {loading ? <div style={{ color: COLORS.gray, padding: 12 }}>Loading…</div> : SIDES.map(([sv, slabel]) => {
        const group = items.filter(i => i.transaction_type === sv);
        return (
          <div key={sv} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: COLORS.black, margin: "4px 0 8px" }}>{slabel}</div>
            {group.length === 0 ? <div style={{ fontSize: 12, color: COLORS.gray }}>None.</div> : group.map(Row)}
          </div>
        );
      })}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)}
          style={{ background: COLORS.success, border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
          ➕ Add a brokerage-required document
        </button>
      ) : (
        <div style={{ background: COLORS.white, border: "1px solid " + COLORS.border, borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add a document your brokerage requires</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Name (e.g. Buyer's Broker's Disclosure)"
              style={{ flex: "2 1 240px", padding: "9px 10px", borderRadius: 7, border: "1px solid " + COLORS.border, fontSize: 13 }} />
            <select value={side} onChange={e => setSide(e.target.value)}
              style={{ padding: "9px 10px", borderRadius: 7, border: "1px solid " + COLORS.border, fontSize: 13 }}>
              <option value="Listing (Seller)">Seller-side deals</option>
              <option value="Buyer Representation">Buyer-side deals</option>
              <option value="both">All deals (both sides)</option>
            </select>
            <select value={cond} onChange={e => setCond(e.target.value)}
              style={{ padding: "9px 10px", borderRadius: 7, border: "1px solid " + COLORS.border, fontSize: 13 }}>
              {COND_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={add} disabled={busy}
              style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: COLORS.success, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {busy ? "Adding…" : "Add"}
            </button>
            <button onClick={() => { setShowAdd(false); setLabel(""); setCond(""); }}
              style={{ padding: "9px 12px", borderRadius: 7, border: "1px solid " + COLORS.border, background: COLORS.white, color: COLORS.gray, fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComplianceAdmin({ token, user }) {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => { fetchRequirements(); }, []);

  const fetchRequirements = async () => {
    setLoading(true);
    try {
      const res = await fetch(API + "/admin/document-requirements", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.success) setRequirements(data.requirements);
    } catch (e) { alert("Failed to load requirements"); }
    setLoading(false);
  };

  const startEdit = (req) => {
    setEditingId(req.id);
    setForm({
      state: req.state || "",
      transaction_type: req.transaction_type || "",
      milestone_name_pattern: req.milestone_name_pattern,
      document_type: req.document_type,
      description: req.description || "",
      legal_consequence: req.legal_consequence || "",
      statute_reference: req.statute_reference || "",
      is_required: req.is_required,
      is_conditional: req.is_conditional,
      conditional_logic: req.conditional_logic || "",
      priority: req.priority,
      active: req.active,
      notes: req.notes || ""
    });
  };

  const cancelEdit = () => { setEditingId(null); setForm(EMPTY); };
  const startCreate = () => { setShowCreate(true); setForm(EMPTY); };
  const cancelCreate = () => { setShowCreate(false); setForm(EMPTY); };

  const saveEdit = async () => {
    try {
      const body = { ...form, state: form.state || null, transaction_type: form.transaction_type || null };
      const res = await fetch(API + "/admin/document-requirements/" + editingId, {
        method: "PUT",
        headers: { "Content-Type":"application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) { setEditingId(null); fetchRequirements(); }
      else alert("Save failed: " + (data.error || "?"));
    } catch (e) { alert("Network error"); }
  };

  const saveCreate = async () => {
    try {
      const body = { ...form, state: form.state || null, transaction_type: form.transaction_type || null };
      const res = await fetch(API + "/admin/document-requirements", {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) { setShowCreate(false); fetchRequirements(); }
      else alert("Create failed: " + (data.error || "?"));
    } catch (e) { alert("Network error"); }
  };

  const approve = async (id) => {
    if (!confirm("Mark as attorney-reviewed? This removes the pending-review flag.")) return;
    try {
      await fetch(API + "/admin/document-requirements/" + id + "/approve", {
        method: "POST", headers: { Authorization: "Bearer " + token }
      });
      fetchRequirements();
    } catch (e) {}
  };

  const removeReq = async (id) => {
    if (!confirm("Deactivate this requirement? It will stop applying to new transactions.")) return;
    try {
      await fetch(API + "/admin/document-requirements/" + id, {
        method: "DELETE", headers: { Authorization: "Bearer " + token }
      });
      fetchRequirements();
    } catch (e) {}
  };

  const filtered = requirements.filter(r => {
    if (filter === "all") return true;
    if (filter === "needs_review") return r.needs_attorney_review && r.active;
    if (filter === "fl") return r.state === "FL" && r.active;
    if (filter === "national") return r.state === null && r.active;
    if (filter === "inactive") return !r.active;
    return true;
  });

  const needsReviewCount = requirements.filter(r => r.needs_attorney_review && r.active).length;

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: COLORS.gray }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 80px" }}>
      {/* Brokerage Required-Documents checklist manager (the per-deal list) */}
      <RequiredDocsManager token={token} />

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.black, marginBottom: 4 }}>
          ⚙️ Advanced: milestone-linked document rules
        </div>
        <div style={{ fontSize: 13, color: COLORS.gray, lineHeight: 1.5 }}>
          These tie a required document to a specific milestone step (e.g. "EMD Receipt" on the earnest-money milestone).
          Most brokerages won't need to touch this — the per-deal checklist above is the main control.
        </div>
      </div>

      {needsReviewCount > 0 && (
        <div style={{ background: COLORS.warningBg, border: "1px solid " + COLORS.warningBorder, borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
            ⚠️ {needsReviewCount} requirement{needsReviewCount !== 1 ? "s" : ""} pending attorney review
          </div>
          <div style={{ fontSize: 12, color: "#78350F" }}>
            These were auto-seeded as a starting point. A Florida-licensed real estate attorney should verify each before this app is used in production transactions.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          ["all", "All " + requirements.length],
          ["needs_review", "Needs Review " + needsReviewCount],
          ["fl", "Florida"],
          ["national", "National/Federal"],
          ["inactive", "Inactive"]
        ].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ padding: "8px 14px", borderRadius: 20, border: "1.5px solid " + COLORS.border,
              background: filter === key ? COLORS.red : COLORS.white,
              color: filter === key ? COLORS.white : COLORS.gray,
              fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {label}
          </button>
        ))}
        <button onClick={startCreate}
          style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 20, border: "none",
            background: COLORS.success, color: COLORS.white, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          ➕ Add Requirement
        </button>
      </div>

      {showCreate && <EditorForm form={form} setForm={setForm} onSave={saveCreate} onCancel={cancelCreate} isNew />}

      {filtered.map(req => (
        <div key={req.id}>
          {editingId === req.id ? (
            <EditorForm form={form} setForm={setForm} onSave={saveEdit} onCancel={cancelEdit} />
          ) : (
            <div style={{ background: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              borderLeft: "4px solid " + (req.needs_attorney_review ? COLORS.warning : (req.active ? COLORS.success : COLORS.border)),
              opacity: req.active ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{req.document_type}</div>
                    {req.state && <span style={{ background: "#DBEAFE", color: "#1E40AF", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{req.state}</span>}
                    {!req.state && <span style={{ background: "#E5E7EB", color: "#374151", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>NATIONAL</span>}
                    {req.transaction_type && <span style={{ background: "#F3E8FF", color: "#6B21A8", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{req.transaction_type}</span>}
                    {req.is_conditional && <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>CONDITIONAL</span>}
                    {req.needs_attorney_review && <span style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>NEEDS REVIEW</span>}
                    {!req.active && <span style={{ background: "#E5E7EB", color: "#374151", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>INACTIVE</span>}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 4 }}>
                    Matches milestones containing: <code style={{ background: "#F3F4F6", padding: "1px 6px", borderRadius: 4 }}>{req.milestone_name_pattern}</code>
                  </div>
                  {req.description && <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>{req.description}</div>}
                  {req.legal_consequence && (
                    <div style={{ fontSize: 11, color: "#78350F", marginTop: 4, lineHeight: 1.4 }}>
                      ⚠️ {req.legal_consequence}
                    </div>
                  )}
                  {req.statute_reference && (
                    <div style={{ fontSize: 11, color: "#92400E", fontStyle: "italic", marginTop: 2 }}>
                      Reference: {req.statute_reference}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button onClick={() => startEdit(req)}
                    style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid " + COLORS.border,
                      background: COLORS.white, color: COLORS.gray, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                    ✏️ Edit
                  </button>
                  {req.needs_attorney_review && (
                    <button onClick={() => approve(req.id)}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "none",
                        background: COLORS.success, color: COLORS.white, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                      ✓ Approve
                    </button>
                  )}
                  {req.active && (
                    <button onClick={() => removeReq(req.id)}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid " + COLORS.dangerBorder,
                        background: COLORS.white, color: COLORS.danger, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: COLORS.gray, fontSize: 14 }}>
          No requirements match this filter.
        </div>
      )}
    </div>
  );
}
