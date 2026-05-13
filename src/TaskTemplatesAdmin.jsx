import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  white: "#fff", black: "#111", gray: "#555", border: "#DDD",
  red: "#C0392B", warning: "#B7770D", warningBg: "#FFFBEB", warningBorder: "#FCD34D",
  success: "#1E8449", successBg: "#D1FAE5",
};

const EMPTY = {
  state: "FL", transaction_type: "Listing (Seller)", phase: "active",
  category: "", task_name: "", description: "",
  default_assignee_role: "", days_from_open: null, is_required: false,
  sort_order: 100, active: true, notes: ""
};

const PHASES = ["active", "contract", "closing"];
const TX_TYPES = ["Listing (Seller)", "Buyer Representation"];
const CATEGORIES = ["Pre-Listing", "Consultation", "Marketing", "Showing", "Contract", "Title", "Inspection", "Financing", "Insurance", "Closing", "Post-Closing", "HOA", "Disclosure", "Other"];
const ROLES = ["Listing Agent", "Buyer\u0027s Agent", "Transaction Coordinator", "Title Company", "Loan Officer/Lender", "Inspector", "Appraiser", "Insurance Agent", "HOA Manager"];

export default function TaskTemplatesAdmin({ token }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(API + "/admin/task-templates", { headers: { Authorization: "Bearer " + token } });
      const d = await res.json();
      if (d.success) setTemplates(d.templates);
    } catch (e) { alert("Failed to load templates"); }
    setLoading(false);
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setForm({
      state: t.state || "", transaction_type: t.transaction_type,
      phase: t.phase, category: t.category || "",
      task_name: t.task_name, description: t.description || "",
      default_assignee_role: t.default_assignee_role || "",
      days_from_open: t.days_from_open, is_required: t.is_required,
      sort_order: t.sort_order, active: t.active, notes: t.notes || ""
    });
  };

  const save = async (isNew) => {
    const body = { ...form, state: form.state || null };
    const url = isNew ? API + "/admin/task-templates" : API + "/admin/task-templates/" + editingId;
    const method = isNew ? "POST" : "PUT";
    try {
      const res = await fetch(url, {
        method, headers: { "Content-Type":"application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body)
      });
      const d = await res.json();
      if (d.success) { setEditingId(null); setShowCreate(false); fetchTemplates(); }
      else alert("Save failed: " + (d.error || "?"));
    } catch (e) { alert("Network error"); }
  };

  const deactivate = async (id) => {
    if (!confirm("Deactivate this template? It will stop applying to new transactions.")) return;
    try {
      await fetch(API + "/admin/task-templates/" + id, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      fetchTemplates();
    } catch (e) {}
  };

  const filtered = templates.filter(t => {
    if (filter === "all") return true;
    if (filter === "listing") return t.transaction_type === "Listing (Seller)" && t.active;
    if (filter === "buyer") return t.transaction_type === "Buyer Representation" && t.active;
    if (filter === "inactive") return !t.active;
    return true;
  });

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: COLORS.gray }}>Loading...</div>;

  const Field = ({ label, children }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, marginBottom: 4, letterSpacing: 0.5 }}>{label}</div>
      {children}
    </div>
  );
  const inputStyle = { width: "100%", padding: 8, borderRadius: 6, border: "1px solid " + COLORS.border, fontSize: 13, boxSizing: "border-box" };
  const input = (k, ph) => <input type="text" value={form[k] || ""} placeholder={ph} onChange={e => setForm({ ...form, [k]: e.target.value })} style={inputStyle} />;
  const numinput = (k) => <input type="number" value={form[k] === null ? "" : form[k]} onChange={e => setForm({ ...form, [k]: e.target.value === "" ? null : parseInt(e.target.value) })} style={inputStyle} />;
  const select = (k, opts) => <select value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} style={inputStyle}><option value="">(none)</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select>;
  const textarea = (k) => <textarea value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }} />;

  const Editor = ({ isNew, onSave, onCancel }) => (
    <div style={{ background: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, border: "2px solid " + COLORS.red }}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>{isNew ? "➕ New Task Template" : "✏️ Edit Task Template"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="STATE">{input("state", "FL")}</Field>
        <Field label="TRANSACTION TYPE">{select("transaction_type", TX_TYPES)}</Field>
        <Field label="PHASE">{select("phase", PHASES)}</Field>
        <Field label="CATEGORY">{select("category", CATEGORIES)}</Field>
      </div>
      <Field label="TASK NAME">{input("task_name", "e.g. Schedule property photos")}</Field>
      <Field label="DESCRIPTION">{textarea("description")}</Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="DEFAULT ASSIGNEE">{select("default_assignee_role", ROLES)}</Field>
        <Field label="DAYS FROM OPEN (optional)">{numinput("days_from_open")}</Field>
        <Field label="SORT ORDER">{numinput("sort_order")}</Field>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={form.is_required} onChange={e => setForm({ ...form, is_required: e.target.checked })} /> Required</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active</label>
      </div>
      <Field label="NOTES">{input("notes", "Internal notes")}</Field>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: 11, borderRadius: 8, border: "1.5px solid " + COLORS.border, background: COLORS.white, color: COLORS.gray, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        <button onClick={onSave} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: COLORS.red, color: COLORS.white, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{isNew ? "Create" : "Save Changes"}</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 80px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.black, marginBottom: 4 }}>📝 Task Templates</div>
        <div style={{ fontSize: 13, color: COLORS.gray }}>Workflow tasks auto-attached to new transactions. Compliance milestones are managed separately.</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["all", "All " + templates.length], ["listing", "Listing"], ["buyer", "Buyer"], ["inactive", "Inactive"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: "8px 14px", borderRadius: 20, border: "1.5px solid " + COLORS.border, background: filter === k ? COLORS.red : COLORS.white, color: filter === k ? COLORS.white : COLORS.gray, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{l}</button>
        ))}
        <button onClick={() => { setShowCreate(true); setForm(EMPTY); }} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 20, border: "none", background: COLORS.success, color: COLORS.white, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>➕ Add Template</button>
      </div>

      {showCreate && <Editor isNew onSave={() => save(true)} onCancel={() => { setShowCreate(false); setForm(EMPTY); }} />}

      {filtered.map(t => (
        <div key={t.id}>
          {editingId === t.id ? <Editor onSave={() => save(false)} onCancel={() => setEditingId(null)} /> : (
            <div style={{ background: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderLeft: "4px solid " + (t.active ? COLORS.success : COLORS.border), opacity: t.active ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t.task_name}</div>
                    <span style={{ background: "#DBEAFE", color: "#1E40AF", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{t.transaction_type}</span>
                    <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{t.phase}</span>
                    {t.category && <span style={{ background: "#F3E8FF", color: "#6B21A8", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{t.category}</span>}
                    {!t.active && <span style={{ background: "#E5E7EB", color: "#374151", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>INACTIVE</span>}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.gray }}>
                    {t.default_assignee_role && <span>→ {t.default_assignee_role}</span>}
                    {t.days_from_open !== null && <span> · {t.days_from_open} days from open</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button onClick={() => startEdit(t)} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid " + COLORS.border, background: COLORS.white, color: COLORS.gray, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>✏️ Edit</button>
                  {t.active && <button onClick={() => deactivate(t.id)} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid #FCA5A5", background: COLORS.white, color: "#991B1B", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>Deactivate</button>}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
