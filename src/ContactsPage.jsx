import { useState, useEffect, useRef } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const TEMP_META = {
  hot:    { emoji: "🔥", label: "Hot",    color: "#dc2626", bg: "#fee2e2" },
  warm:   { emoji: "🌤",  label: "Warm",   color: "#d97706", bg: "#fef3c7" },
  cold:   { emoji: "❄️",  label: "Cold",   color: "#0284c7", bg: "#e0f2fe" },
  sphere: { emoji: "👥", label: "Sphere", color: "#7c3aed", bg: "#ede9fe" },
  past:   { emoji: "🏡", label: "Past",   color: "#16a34a", bg: "#dcfce7" },
  dnc:    { emoji: "🚫", label: "DNC",    color: "#6b7280", bg: "#f3f4f6" },
};

const TYPE_OPTIONS = ["lead", "buyer", "seller", "past_client", "sphere", "vendor", "other"];

const OUTCOMES = [
  { id: "spoke_interested", label: "✅ Reached - Interested",  short: "Interested" },
  { id: "spoke_not_now",    label: "💬 Reached - Not Now",     short: "Not now" },
  { id: "left_vm",          label: "📵 Left Voicemail",        short: "Left VM" },
  { id: "no_answer",        label: "📞 No Answer",              short: "No answer" },
  { id: "wrong_number",     label: "❌ Wrong Number",           short: "Wrong #" },
  { id: "meeting_set",      label: "📅 Meeting Set",            short: "Meeting" },
  { id: "dnc",              label: "🛑 Do Not Contact",         short: "DNC" },
];

// Mirror of backend cadence defaults (system defaults). Used for live preview.
const CADENCE = {
  hot:    { spoke_interested: 2, spoke_not_now: 14, left_vm: 1, no_answer: 1, meeting_set: 7 },
  warm:   { spoke_interested: 7, spoke_not_now: 30, left_vm: 3, no_answer: 3, meeting_set: 14 },
  cold:   { spoke_interested: 14, spoke_not_now: 90, left_vm: 14, no_answer: 14, meeting_set: 21 },
  sphere: { spoke_interested: 30, spoke_not_now: 90, left_vm: 14, no_answer: 14, meeting_set: 30 },
  past:   { spoke_interested: 60, spoke_not_now: 180, left_vm: 30, no_answer: 30, meeting_set: 90 },
};

function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((date - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return Math.abs(diff) + "d overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return "In " + diff + "d";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtLong(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function computeDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}

const inputStyle = {
  padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6,
  fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box",
};
const btnStyle = (bg, color) => ({
  background: bg, color, border: "none", borderRadius: 6, padding: "8px 14px",
  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
});
const th = { padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" };
const td = { padding: "10px 12px", verticalAlign: "middle" };

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// ============================================================
// LOG CALL MODAL — FUB-style: outcome → what next + note + temp
// ============================================================
function LogCallModal({ contact, token, onClose, onLogged }) {
  const [step, setStep] = useState(1);
  const [outcome, setOutcome] = useState(null);
  const [followUpDays, setFollowUpDays] = useState(7);
  const [customDate, setCustomDate] = useState("");
  const [noFollowUp, setNoFollowUp] = useState(false);
  const [notes, setNotes] = useState("");
  const [newTemp, setNewTemp] = useState(contact.temperature || "warm");
  const [saving, setSaving] = useState(false);

  const PRESETS = [
    { label: "Tomorrow",    days: 1 },
    { label: "In 3 days",   days: 3 },
    { label: "Next week",   days: 7 },
    { label: "In 2 weeks",  days: 14 },
    { label: "In 1 month",  days: 30 },
    { label: "In 3 months", days: 90 },
  ];

  const pickOutcome = (o) => {
    setOutcome(o);
    if (o.id === "dnc" || o.id === "wrong_number") {
      setNoFollowUp(true);
    } else {
      const days = (CADENCE[newTemp] && CADENCE[newTemp][o.id]) || 7;
      setFollowUpDays(days);
      setNoFollowUp(false);
    }
    setStep(2);
  };

  // Recompute suggested days when temperature changes
  useEffect(() => {
    if (!outcome || customDate || noFollowUp) return;
    const days = (CADENCE[newTemp] && CADENCE[newTemp][outcome.id]) || 7;
    setFollowUpDays(days);
  }, [newTemp]);

  const computedNextDate = () => {
    if (noFollowUp) return null;
    if (customDate) return new Date(customDate);
    return computeDate(followUpDays);
  };

  const save = async () => {
    if (!outcome) return;
    setSaving(true);
    try {
      const next = computedNextDate();
      // Temperature update first if changed
      if (newTemp !== contact.temperature) {
        await fetch(API + "/contacts/" + contact.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ temperature: newTemp })
        });
      }
      const body = { outcome: outcome.id, notes: notes || null };
      if (noFollowUp) body.overrideNextCallAt = null;
      else if (next) body.overrideNextCallAt = next.toISOString();

      const r = await fetch(API + "/contacts/" + contact.id + "/log-call", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      onLogged && onLogged(data);
      onClose();
    } catch (e) { alert("Failed: " + e.message); }
    finally { setSaving(false); }
  };

  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || contact.phone || "Contact";
  const m = TEMP_META[newTemp] || TEMP_META.warm;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📞 Log Call · {contactName}</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          {step === 1 ? "What was the outcome of this call?" : "What's next with this lead?"}
        </div>

        {step === 1 && (
          <div style={{ display: "grid", gap: 6 }}>
            {OUTCOMES.map(o => (
              <button key={o.id} onClick={() => pickOutcome(o)}
                style={{ ...btnStyle("#f3f4f6", "#1f2937"), textAlign: "left", padding: "12px 16px", fontSize: 14 }}
                onMouseEnter={e => e.currentTarget.style.background = "#e5e7eb"}
                onMouseLeave={e => e.currentTarget.style.background = "#f3f4f6"}>
                {o.label}
              </button>
            ))}
          </div>
        )}

        {step === 2 && outcome && (
          <div>
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#15803d", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>What just happened</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#14532d", marginTop: 2 }}>{outcome.label}</div>
            </div>

            {/* What's next — preset chips + custom */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                🔮 When should I call them next?
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {PRESETS.map(p => {
                  const active = !noFollowUp && !customDate && followUpDays === p.days;
                  return (
                    <button key={p.days} onClick={() => { setFollowUpDays(p.days); setNoFollowUp(false); setCustomDate(""); }}
                      style={{ ...btnStyle(active ? "#0c4a6e" : "#f3f4f6", active ? "white" : "#374151"), padding: "6px 12px", fontSize: 12 }}>
                      {p.label}
                    </button>
                  );
                })}
                <button onClick={() => setNoFollowUp(true)}
                  style={{ ...btnStyle(noFollowUp ? "#6b7280" : "#f3f4f6", noFollowUp ? "white" : "#374151"), padding: "6px 12px", fontSize: 12 }}>
                  No follow-up
                </button>
              </div>
              {!noFollowUp && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="date" value={customDate}
                    onChange={e => { setCustomDate(e.target.value); setNoFollowUp(false); }}
                    style={{ ...inputStyle, width: 180 }} />
                  <span style={{ fontSize: 11, color: "#6b7280" }}>or pick a custom date</span>
                </div>
              )}
              {!noFollowUp && (
                <div style={{ marginTop: 10, padding: 10, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 6, fontSize: 13, color: "#1e3a8a" }}>
                  <strong>Next call scheduled:</strong> {fmtLong(computedNextDate())}
                </div>
              )}
              {noFollowUp && (
                <div style={{ marginTop: 10, padding: 10, background: "#f3f4f6", borderRadius: 6, fontSize: 13, color: "#6b7280" }}>
                  No follow-up scheduled. This lead won't appear in your daily call list.
                </div>
              )}
            </div>

            <Field label="📝 What did you talk about? (optional)" hint="You'll see these notes next time you call this person.">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="e.g. Looking in $600-700k range, contingent on selling current home, kids in Lake Mary schools..."
                style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <Field label={"🌡 Temperature — " + m.emoji + " " + m.label} hint="Did this call change how hot this lead is? Changing this adjusts how often you'll be reminded to call them.">
              <select value={newTemp} onChange={e => setNewTemp(e.target.value)} style={inputStyle}>
                {Object.entries(TEMP_META).filter(([k]) => k !== "dnc").map(([k, meta]) => (
                  <option key={k} value={k}>{meta.emoji} {meta.label}</option>
                ))}
              </select>
            </Field>

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => setStep(1)} style={btnStyle("#e5e7eb", "#374151")}>← Back</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onClose} style={btnStyle("#e5e7eb", "#374151")}>Cancel</button>
                <button onClick={save} disabled={saving} style={btnStyle("#0c4a6e", "white")}>
                  {saving ? "Saving..." : "✓ Save Call Log"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Public wrapper button that opens LogCallModal
// ============================================================
export function LogCallButton({ contact, token, onLogged, compact }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ ...btnStyle("#0c4a6e", "white"), padding: compact ? "4px 10px" : "6px 14px", fontSize: compact ? 11 : 12 }}>
        {compact ? "📞 Log" : "📞 Log Call"}
      </button>
      {open && <LogCallModal contact={contact} token={token} onClose={() => setOpen(false)} onLogged={(d) => { setOpen(false); onLogged && onLogged(d); }} />}
    </>
  );
}

// ============================================================
// ADD/EDIT CONTACT MODAL
// ============================================================
function ContactModal({ contact, token, onClose, onSaved }) {
  const isEdit = !!(contact && contact.id);
  const [form, setForm] = useState({
    firstName: (contact && contact.first_name) || "",
    lastName: (contact && contact.last_name) || "",
    email: (contact && contact.email) || "",
    phone: (contact && contact.phone) || "",
    contactType: (contact && contact.contact_type) || "lead",
    temperature: (contact && contact.temperature) || "warm",
    source: (contact && contact.source) || "",
    notes: (contact && contact.notes) || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const url = isEdit ? (API + "/contacts/" + contact.id) : (API + "/contacts");
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      onSaved && onSaved(data.contact);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{isEdit ? "Edit Contact" : "Add Contact"}</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          Contacts are private to you. Temperature drives how often the system reminds you to call.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="First Name"><input value={form.firstName} onChange={e => update("firstName", e.target.value)} style={inputStyle} /></Field>
          <Field label="Last Name"><input value={form.lastName} onChange={e => update("lastName", e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Email"><input type="email" value={form.email} onChange={e => update("email", e.target.value)} style={inputStyle} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={e => update("phone", e.target.value)} style={inputStyle} /></Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Type">
            <select value={form.contactType} onChange={e => update("contactType", e.target.value)} style={inputStyle}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Temperature">
            <select value={form.temperature} onChange={e => update("temperature", e.target.value)} style={inputStyle}>
              {Object.entries(TEMP_META).filter(([k]) => k !== "dnc").map(([k, m]) => (
                <option key={k} value={k}>{m.emoji} {m.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Source" hint="Where did this lead come from? Zillow, Open House, Referral, etc."><input value={form.source} onChange={e => update("source", e.target.value)} style={inputStyle} /></Field>
        <Field label="Notes"><textarea value={form.notes} onChange={e => update("notes", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></Field>

        {err && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>⚠️ {err}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={btnStyle("#e5e7eb", "#374151")}>Cancel</button>
          <button onClick={save} disabled={saving} style={btnStyle("#0c4a6e", "white")}>{saving ? "Saving..." : (isEdit ? "Save" : "Add Contact")}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CSV IMPORT MODAL
// ============================================================
function ImportModal({ token, onClose, onImported }) {
  const [step, setStep] = useState(1);
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [defaultTemp, setDefaultTemp] = useState("warm");
  const [defaultType, setDefaultType] = useState("lead");
  const [source, setSource] = useState("CSV Import");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const parseCsv = (text) => {
    const rows = [];
    let cur = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { cur.push(field); field = ""; }
        else if (c === "\n" || c === "\r") {
          if (field || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; }
          if (c === "\r" && text[i+1] === "\n") i++;
        } else field += c;
      }
    }
    if (field || cur.length) { cur.push(field); rows.push(cur); }
    return rows;
  };

  const onFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const all = parseCsv(text);
    if (all.length < 2) { alert("File appears empty or invalid"); return; }
    const hdrs = all[0].map(h => h.trim());
    const data = all.slice(1).filter(r => r.some(c => c && c.trim()));
    setHeaders(hdrs);
    setRawRows(data);
    const auto = {};
    hdrs.forEach((h, idx) => {
      const lh = h.toLowerCase();
      if (/^first[\s_]*name$/.test(lh) || lh === "fname") auto.first_name = idx;
      else if (/^last[\s_]*name$/.test(lh) || lh === "lname") auto.last_name = idx;
      else if (lh === "name" || lh === "full name") auto.full_name = idx;
      else if (lh === "email" || lh === "e-mail") auto.email = idx;
      else if (/phone|mobile|cell/.test(lh)) auto.phone = idx;
      else if (lh === "notes" || lh === "note") auto.notes = idx;
      else if (lh === "city") auto.city = idx;
      else if (lh === "state") auto.state = idx;
      else if (lh === "source" || lh === "lead source") auto.source = idx;
    });
    setMapping(auto);
    setStep(2);
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const mapped = rawRows.map(row => {
        const o = {};
        Object.entries(mapping).forEach(([field, idx]) => {
          if (idx == null || idx === "") return;
          const val = row[idx];
          if (val == null) return;
          if (field === "full_name") {
            const parts = String(val).trim().split(/\s+/);
            o.first_name = parts[0] || "";
            o.last_name = parts.slice(1).join(" ") || "";
          } else o[field] = String(val).trim();
        });
        return o;
      });
      const r = await fetch(API + "/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ rows: mapped, defaultTemperature: defaultTemp, defaultContactType: defaultType, source })
      });
      const data = await r.json();
      setResult(data);
      setStep(3);
      onImported && onImported(data);
    } catch (e) { alert("Import failed: " + e.message); }
    finally { setImporting(false); }
  };

  const FIELDS = [
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "full_name", label: "Full Name (split into first/last)" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "notes", label: "Notes" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "zip_code", label: "Zip" },
    { key: "source", label: "Source" },
  ];

  // Allow closing only when not importing
  const safeClose = () => {
    if (importing) return;
    if (step === 3) { onClose(); return; }
    if (rawRows.length > 0 && !confirm("Discard this import? Your progress will be lost.")) return;
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={safeClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📥 Import Contacts (CSV)</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          Upload a CSV export from Follow Up Boss, Google Contacts, Excel, or any spreadsheet. Column matching is automatic.
        </div>

        {step === 1 && (
          <div style={{ border: "2px dashed #d1d5db", borderRadius: 8, padding: 32, textAlign: "center", background: "#f9fafb" }}>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files && e.target.files[0])} style={{ display: "none" }} />
            <button onClick={() => fileRef.current && fileRef.current.click()} style={btnStyle("#0c4a6e", "white")}>
              Choose CSV File
            </button>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 12 }}>
              Max 5,000 rows. Duplicates (same phone or email) are skipped automatically.
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 6, padding: 10, fontSize: 12, color: "#78350f", marginBottom: 16 }}>
              Detected <strong>{rawRows.length}</strong> rows. Match each CSV column to a contact field. Leave blank to skip.
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              {FIELDS.map(f => (
                <div key={f.key} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 13, color: "#374151" }}>{f.label}</label>
                  <select value={mapping[f.key] != null ? mapping[f.key] : ""}
                    onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                    style={inputStyle}>
                    <option value="">— skip —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Defaults for all imported contacts:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Temperature">
                  <select value={defaultTemp} onChange={e => setDefaultTemp(e.target.value)} style={inputStyle}>
                    {Object.entries(TEMP_META).filter(([k]) => k !== "dnc").map(([k, m]) => <option key={k} value={k}>{m.emoji} {m.label}</option>)}
                  </select>
                </Field>
                <Field label="Type">
                  <select value={defaultType} onChange={e => setDefaultType(e.target.value)} style={inputStyle}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Source label"><input value={source} onChange={e => setSource(e.target.value)} style={inputStyle} /></Field>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setStep(1)} style={btnStyle("#e5e7eb", "#374151")}>← Back</button>
              <button onClick={doImport} disabled={importing} style={btnStyle("#0c4a6e", "white")}>
                {importing ? "Importing..." : ("Import " + rawRows.length + " Contacts")}
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div>
            <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#14532d" }}>✅ Import Complete</div>
              <div style={{ fontSize: 13, color: "#14532d", marginTop: 8 }}>
                Created: <strong>{result.created}</strong><br/>
                Skipped (duplicates / empty): <strong>{result.skipped}</strong><br/>
                Errors: <strong>{(result.errors && result.errors.length) || 0}</strong>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={onClose} style={btnStyle("#0c4a6e", "white")}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function ContactsPage({ token, onBack }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ temperature: "", type: "", due: "", search: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.temperature) params.set("temperature", filter.temperature);
      if (filter.type) params.set("type", filter.type);
      if (filter.due) params.set("due", filter.due);
      if (filter.search) params.set("search", filter.search);
      const r = await fetch(API + "/contacts?" + params, { headers: { Authorization: "Bearer " + token }});
      const data = await r.json();
      setContacts(data.contacts || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter.temperature, filter.type, filter.due]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [filter.search]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      {onBack && (
        <button onClick={onBack}
          style={{ background: "transparent", border: "none", color: "#0c4a6e", cursor: "pointer", fontSize: 14, fontWeight: 600, marginBottom: 12, padding: "4px 0", fontFamily: "inherit" }}>
          ← Back to Dashboard
        </button>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>📇 Contacts</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Your private lead list. {contacts.length} contact{contacts.length === 1 ? "" : "s"}.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowImport(true)} style={btnStyle("#e5e7eb", "#374151")}>📥 Import CSV</button>
          <button onClick={() => setShowAdd(true)} style={btnStyle("#0c4a6e", "white")}>+ Add Contact</button>
        </div>
      </div>

      <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, fontSize: 12, color: "#78350f", marginBottom: 16 }}>
        💡 <strong>How this works:</strong> Add contacts and set their temperature. After every call, log the outcome — the system suggests when to call again. Hot leads get called every 2 days, sphere clients every 30, past clients every 60.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="🔍 Search name, email, phone..." value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          style={{ ...inputStyle, flex: 1, minWidth: 200, maxWidth: 320 }} />
        <select value={filter.temperature} onChange={e => setFilter(f => ({ ...f, temperature: e.target.value }))} style={{ ...inputStyle, width: 160 }}>
          <option value="">All temperatures</option>
          {Object.entries(TEMP_META).map(([k, m]) => <option key={k} value={k}>{m.emoji} {m.label}</option>)}
        </select>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))} style={{ ...inputStyle, width: 160 }}>
          <option value="">All types</option>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select>
        <select value={filter.due} onChange={e => setFilter(f => ({ ...f, due: e.target.value }))} style={{ ...inputStyle, width: 160 }}>
          <option value="">All calls</option>
          <option value="today">Due today / overdue</option>
          <option value="overdue">Overdue only</option>
        </select>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={th}>Name</th>
              <th style={th}>Phone</th>
              <th style={th}>Type</th>
              <th style={th}>Temp</th>
              <th style={th}>Last Called</th>
              <th style={th}>Next Call</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</td></tr>}
            {!loading && contacts.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                No contacts yet. Click <strong>+ Add Contact</strong> or <strong>📥 Import CSV</strong>.
              </td></tr>
            )}
            {!loading && contacts.map(c => {
              const m = TEMP_META[c.temperature] || TEMP_META.warm;
              const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "(no name)";
              const overdue = c.next_call_due_at && new Date(c.next_call_due_at) < new Date();
              return (
                <tr key={c.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{name}</div>
                    {c.email && <div style={{ fontSize: 11, color: "#6b7280" }}>{c.email}</div>}
                  </td>
                  <td style={td}>{c.phone || "—"}</td>
                  <td style={td}>{(c.contact_type || "").replace("_", " ")}</td>
                  <td style={td}>
                    <span style={{ background: m.bg, color: m.color, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                      {m.emoji} {m.label}
                    </span>
                  </td>
                  <td style={td}>{fmtDate(c.last_contacted_at)}</td>
                  <td style={{ ...td, color: overdue ? "#b91c1c" : "#374151", fontWeight: overdue ? 700 : 400 }}>
                    {fmtDate(c.next_call_due_at)}
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <LogCallButton contact={c} token={token} onLogged={load} compact />
                    <button onClick={() => setEditing(c)} style={{ ...btnStyle("#e5e7eb", "#374151"), padding: "4px 10px", fontSize: 11, marginLeft: 6 }}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && <ContactModal token={token} onClose={() => setShowAdd(false)} onSaved={() => load()} />}
      {editing && <ContactModal contact={editing} token={token} onClose={() => setEditing(null)} onSaved={() => load()} />}
      {showImport && <ImportModal token={token} onClose={() => setShowImport(false)} onImported={(data) => {
        // Reset all filters so newly imported contacts show
        setFilter({ temperature: "", type: "", due: "", search: "" });
        // Reload after a beat so backend has committed
        setTimeout(() => load(), 300);
      }} />}
    </div>
  );
}
