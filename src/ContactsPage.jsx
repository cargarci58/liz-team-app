import React from 'react';
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
  { id: "text_sent",        label: "📨 Text Sent",              short: "Text sent" },
  { id: "no_answer",        label: "📞 No Answer",              short: "No answer" },
  { id: "wrong_number",     label: "❌ Wrong Number",           short: "Wrong #" },
  { id: "meeting_set",      label: "📅 Meeting Set",            short: "Meeting" },
  { id: "dnc",              label: "🛑 Do Not Contact",         short: "DNC" },
];

// Mirror of backend cadence defaults (system defaults). Used for live preview.
const CADENCE = {
  hot:    { spoke_interested: 2, spoke_not_now: 14, left_vm: 1, text_sent: 2, no_answer: 1, meeting_set: 7 },
  warm:   { spoke_interested: 7, spoke_not_now: 30, left_vm: 3, text_sent: 3, no_answer: 3, meeting_set: 14 },
  cold:   { spoke_interested: 14, spoke_not_now: 90, left_vm: 14, text_sent: 14, no_answer: 14, meeting_set: 21 },
  sphere: { spoke_interested: 30, spoke_not_now: 90, left_vm: 14, text_sent: 14, no_answer: 14, meeting_set: 30 },
  past:   { spoke_interested: 60, spoke_not_now: 180, left_vm: 30, text_sent: 30, no_answer: 30, meeting_set: 90 },
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

// For columns showing a past event (e.g. "Last Called"). Never says "overdue".
function fmtPastDate(d) {
  if (!d) return "Never";
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return diff + "d ago";
  if (diff < 30) return Math.floor(diff / 7) + "w ago";
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
  const [followUpDaysList, setFollowUpDaysList] = useState([7]);
  const [customDate, setCustomDate] = useState("");
  const [noFollowUp, setNoFollowUp] = useState(false);
  const [notes, setNotes] = useState("");
  const [newTemp, setNewTemp] = useState(contact.temperature || "warm");
  const [saving, setSaving] = useState(false);

  const PRESETS = [
    { label: "Tomorrow",    days: 1 },
    { label: "In 2 days",   days: 2 },
    { label: "In 3 days",   days: 3 },
    { label: "Next week",   days: 7 },
    { label: "In 2 weeks",  days: 14 },
    { label: "In 1 month",  days: 30 },
    { label: "In 3 months", days: 90 },
    { label: "In 6 months", days: 180 },
  ];

  const pickOutcome = (o) => {
    setOutcome(o);
    if (o.id === "dnc" || o.id === "wrong_number") {
      setNoFollowUp(true);
    } else {
      const days = (CADENCE[newTemp] && CADENCE[newTemp][o.id]) || 7;
      setFollowUpDaysList([days]);
      setNoFollowUp(false);
    }
    setStep(2);
  };

  // Recompute suggested days when temperature changes
  useEffect(() => {
    if (!outcome || customDate || noFollowUp) return;
    const days = (CADENCE[newTemp] && CADENCE[newTemp][outcome.id]) || 7;
    setFollowUpDaysList([days]);
  }, [newTemp]);

  const computedNextDates = () => {
    if (noFollowUp) return [];
    const dates = followUpDaysList.map(d => computeDate(d));
    if (customDate) dates.push(new Date(customDate));
    const seen = new Set();
    return dates
      .filter(d => d && !isNaN(d))
      .filter(d => { const k = d.toISOString().slice(0,10); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => a - b);
  };

  const save = async () => {
    if (!outcome) return;
    setSaving(true);
    try {
      // Temperature update first if changed
      if (newTemp !== contact.temperature) {
        await fetch(API + "/contacts/" + contact.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ temperature: newTemp })
        });
      }
      const body = { outcome: outcome.id, notes: notes || null };
      if (noFollowUp) {
        body.followUps = [];
      } else {
        const dates = computedNextDates();
        body.followUps = dates.map(d => d.toISOString());
      }

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
                🔮 When should I call them next? (tap multiple — each creates a separate reminder)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {PRESETS.map(p => {
                  const active = !noFollowUp && followUpDaysList.includes(p.days);
                  return (
                    <button key={p.days} onClick={() => {
                      setNoFollowUp(false);
                      setFollowUpDaysList(prev => prev.includes(p.days) ? prev.filter(d => d !== p.days) : [...prev, p.days]);
                    }}
                      style={{ ...btnStyle(active ? "#0c4a6e" : "#f3f4f6", active ? "white" : "#374151"), padding: "6px 12px", fontSize: 12 }}>
                      {active ? "✓ " : ""}{p.label}
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
              {!noFollowUp && computedNextDates().length > 0 && (
                <div style={{ marginTop: 10, padding: 10, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 6, fontSize: 13, color: "#1e3a8a" }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    📅 {computedNextDates().length === 1 ? "Reminder scheduled:" : computedNextDates().length + " reminders scheduled:"}
                  </div>
                  {computedNextDates().map((d, i) => (
                    <div key={i} style={{ fontSize: 12, paddingLeft: 8 }}>• {fmtLong(d)}</div>
                  ))}
                  <div style={{ fontSize: 11, color: "#3730a3", marginTop: 6, fontStyle: "italic" }}>
                    Each reminder will appear in your daily call list on its scheduled day.
                  </div>
                </div>
              )}
              {!noFollowUp && computedNextDates().length === 0 && (
                <div style={{ marginTop: 10, padding: 10, background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 6, fontSize: 12, color: "#92400e" }}>
                  ⚠️ Pick at least one follow-up interval above, or choose "No follow-up".
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
export function LogCallButton({ contact, token, onLogged, compact, large }) {
  const [open, setOpen] = useState(false);
  // Three sizes: compact (inline rows), default (most places), large (the
  // primary CTA on a contact's detail drawer — make it actually feel primary).
  const sizeStyle = large
    ? { padding: "12px 22px", fontSize: 14, width: "100%", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }
    : compact
      ? { padding: "4px 10px", fontSize: 11 }
      : { padding: "6px 14px", fontSize: 12 };
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ ...btnStyle("#0c4a6e", "white"), ...sizeStyle }}>
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
function FillMissingModal({ token, onClose, onDone }) {
  const [step, setStep] = React.useState(1);
  const [rawRows, setRawRows] = React.useState([]);
  const [headers, setHeaders] = React.useState([]);
  const [mapping, setMapping] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const fileRef = React.useRef();
  const API = "https://liz-team-server-api-production.up.railway.app";

  const FIELDS = [
    { key: "email", label: "Email (required for matching)", required: true },
    { key: "phone", label: "Phone" },
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "zip_code", label: "Zip" },
    { key: "company", label: "Company" },
    { key: "notes", label: "Notes" },
  ];

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
    if (all.length < 2) { alert("File appears empty"); return; }
    const hdrs = all[0].map(h => h.trim());
    const data = all.slice(1).filter(r => r.some(c => c && c.trim()));
    setHeaders(hdrs);
    setRawRows(data);
    const auto = {};
    hdrs.forEach((h, idx) => {
      const lh = h.toLowerCase();
      if (lh === "email" || lh === "e-mail") auto.email = idx;
      else if (/phone|mobile|cell/.test(lh)) auto.phone = idx;
      else if (/^first[\s_]*name$/.test(lh) || lh === "fname") auto.first_name = idx;
      else if (/^last[\s_]*name$/.test(lh) || lh === "lname") auto.last_name = idx;
      else if (lh === "address" || lh === "street") auto.address = idx;
      else if (lh === "city") auto.city = idx;
      else if (lh === "state") auto.state = idx;
      else if (/zip|postal/.test(lh)) auto.zip_code = idx;
      else if (lh === "company" || lh === "organization") auto.company = idx;
      else if (lh === "notes" || lh === "note") auto.notes = idx;
    });
    setMapping(auto);
    setStep(2);
  };

  const submit = async () => {
    if (mapping.email === undefined) { alert("You must map the Email column."); return; }
    setBusy(true);
    const rows = rawRows.map(r => {
      const out = {};
      FIELDS.forEach(f => {
        if (mapping[f.key] !== undefined) out[f.key] = (r[mapping[f.key]] || "").trim();
      });
      return out;
    }).filter(r => r.email);
    try {
      const resp = await fetch(API + "/contacts/fill-missing", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ rows })
      });
      const data = await resp.json();
      if (!resp.ok) { alert("Failed: " + (data.error || "unknown")); setBusy(false); return; }
      setResult(data);
      setStep(3);
    } catch (e) { alert("Error: " + e.message); }
    setBusy(false);
  };

  return (
    <div onClick={() => !busy && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:14, padding:22, maxWidth:640, width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ fontSize:20, fontWeight:800, color:"#92400e", marginBottom:6 }}>🩹 Fill Missing Info from CSV</div>
        <div style={{ background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:8, padding:12, marginBottom:14, fontSize:13, color:"#78350f", lineHeight:1.5 }}>
          <strong>What this does:</strong> Re-imports a CSV from your other CRM and fills in <strong>only blank fields</strong> on existing contacts. <strong>Will never overwrite</strong> data you already have. Matches by <strong>email</strong>.<br/><br/>
          <strong>When to use:</strong> The first import was missing phones (or other fields) because the source CRM didn't include them. Export again with phones, upload here.
        </div>

        {step === 1 && (
          <div>
            <button onClick={() => fileRef.current?.click()} style={{ width:"100%", padding:14, borderRadius:10, border:"2px dashed #d1d5db", background:"#fafafa", cursor:"pointer", fontSize:14, fontWeight:600, color:"#374151" }}>
              📁 Choose CSV file
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e => onFile(e.target.files?.[0])} />
            <div style={{ marginTop:14, fontSize:12, color:"#6b7280" }}>The CSV must include an Email column.</div>
            <button onClick={onClose} style={{ marginTop:16, width:"100%", padding:10, borderRadius:8, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontWeight:600, cursor:"pointer" }}>Cancel</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize:13, color:"#374151", marginBottom:10 }}>{rawRows.length} rows detected. Map your CSV columns to fields:</div>
            {FIELDS.map(f => (
              <div key={f.key} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ width:200, fontSize:13, color: f.required ? "#92400e" : "#374151", fontWeight: f.required ? 700 : 500 }}>{f.label}</div>
                <select value={mapping[f.key] === undefined ? "" : mapping[f.key]}
                  onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value === "" ? undefined : parseInt(e.target.value) }))}
                  style={{ flex:1, padding:8, borderRadius:6, border:"1px solid #d1d5db", fontSize:13 }}>
                  <option value="">— skip —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display:"flex", gap:10, marginTop:18 }}>
              <button onClick={() => setStep(1)} disabled={busy} style={{ flex:1, padding:11, borderRadius:8, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontWeight:600, cursor:"pointer" }}>← Back</button>
              <button onClick={submit} disabled={busy || mapping.email === undefined} style={{ flex:2, padding:11, borderRadius:8, border:"none", background: (busy || mapping.email === undefined) ? "#d1a878" : "#92400e", color:"#fff", fontWeight:700, cursor: busy ? "wait" : "pointer" }}>
                {busy ? "Filling..." : "🩹 Fill Missing Info"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div>
            <div style={{ background:"#ecfdf5", border:"1px solid #6ee7b7", borderRadius:8, padding:14, marginBottom:14, fontSize:13, color:"#065f46" }}>
              <div style={{ fontWeight:700, marginBottom:6 }}>✅ Done</div>
              <div>Rows in CSV: <strong>{result.summary.total_rows}</strong></div>
              <div>Matched to existing contacts: <strong>{result.summary.matched}</strong></div>
              <div>Contacts updated: <strong>{result.summary.updated}</strong></div>
              <div>Already complete (no blanks): <strong>{result.summary.no_blanks_to_fill}</strong></div>
              <div>Skipped (no email in row): <strong>{result.summary.skipped_no_email}</strong></div>
              <div>Skipped (no match in your contacts): <strong>{result.summary.skipped_no_match}</strong></div>
            </div>
            {result.sample_updates && result.sample_updates.length > 0 && (
              <div style={{ fontSize:12, color:"#374151", marginBottom:14 }}>
                <div style={{ fontWeight:700, marginBottom:4 }}>Sample updates:</div>
                {result.sample_updates.map((s, i) => (
                  <div key={i}>• {s.email} → filled: {s.filled.join(", ")}</div>
                ))}
              </div>
            )}
            <button onClick={onDone} style={{ width:"100%", padding:11, borderRadius:8, border:"none", background:"#0c4a6e", color:"#fff", fontWeight:700, cursor:"pointer" }}>Close & Refresh</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportModal({ token, onClose, onImported, onFillMissing }) {
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
          <>
            <div style={{ border: "2px dashed #d1d5db", borderRadius: 8, padding: 32, textAlign: "center", background: "#f9fafb" }}>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files && e.target.files[0])} style={{ display: "none" }} />
              <button onClick={() => fileRef.current && fileRef.current.click()} style={btnStyle("#0c4a6e", "white")}>
                Choose CSV File
              </button>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 12 }}>
                Max 5,000 rows. Duplicates (same phone or email) are skipped automatically.
              </div>
            </div>
            {onFillMissing && (
              <div style={{ marginTop: 16, padding: 12, background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: "#78350f" }}>
                  Already have contacts but missing phones/emails? Re-import from another CRM to fill the gaps.
                </div>
                <button onClick={onFillMissing} style={{ ...btnStyle("#fef3c7", "#92400e"), border: "1px solid #fcd34d", whiteSpace: "nowrap" }}>
                  🩹 Fill Missing Info
                </button>
              </div>
            )}
          </>
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
            <div style={{ background: result.created > 0 ? "#dcfce7" : "#fee2e2", border: "1px solid " + (result.created > 0 ? "#86efac" : "#fca5a5"), borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: result.created > 0 ? "#14532d" : "#7f1d1d" }}>
                {result.created > 0 ? "✅ Import Complete" : "⚠️ Import Failed"}
              </div>
              <div style={{ fontSize: 13, color: result.created > 0 ? "#14532d" : "#7f1d1d", marginTop: 8 }}>
                Created: <strong>{result.created}</strong><br/>
                Skipped (duplicates / empty): <strong>{result.skipped}</strong><br/>
                Errors: <strong>{(result.errors && result.errors.length) || 0}</strong>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 16, maxHeight: 300, overflowY: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7f1d1d", marginBottom: 8 }}>First {Math.min(result.errors.length, 10)} errors:</div>
                {result.errors.slice(0, 10).map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#7f1d1d", marginBottom: 6, fontFamily: "monospace", wordBreak: "break-word" }}>
                    <strong>Row {i + 1}:</strong> {e.error || "Unknown error"}
                    <div style={{ color: "#991b1b", marginTop: 2 }}>{JSON.stringify(e.row).slice(0, 200)}</div>
                  </div>
                ))}
              </div>
            )}
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
// CONTACT DETAIL DRAWER — see all info + call history + notes
// ============================================================
function ContactDetailDrawer({ contact, token, onClose, onEdit, onLogged, onArchived, onDeleted }) {
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + "/contacts/" + contact.id + "/calls", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await r.json();
      setCallHistory(data.calls || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [contact.id]);

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || contact.phone || "(no name)";
  const m = TEMP_META[contact.temperature] || TEMP_META.warm;

  const outcomeMeta = {
    spoke_interested: { label: "✅ Reached - Interested", color: "#16a34a" },
    spoke_not_now: { label: "💬 Reached - Not Now", color: "#0284c7" },
    left_vm: { label: "📵 Left Voicemail", color: "#7c3aed" },
    no_answer: { label: "📞 No Answer", color: "#6b7280" },
    wrong_number: { label: "❌ Wrong Number", color: "#dc2626" },
    meeting_set: { label: "📅 Meeting Set", color: "#16a34a" },
    dnc: { label: "🛑 Do Not Contact", color: "#6b7280" },
  };

  // Section-title style — used for every titled block in the drawer so
  // labels actually stand out instead of getting lost as tiny uppercase
  // hints. Bigger, darker, with a small bottom border for separation.
  const sectionTitle = {
    fontSize: 15, fontWeight: 800, color: "#0c4a6e", marginBottom: 10,
    paddingBottom: 6, borderBottom: "2px solid #e5e7eb",
    display: "flex", alignItems: "center", gap: 6,
  };
  // For section titles that live INSIDE a colored card (Profile Notes,
  // Next Follow-Up) — bigger but no separator, color inherits from card.
  const innerTitle = (color) => ({
    fontSize: 14, fontWeight: 800, color: color || "#0c4a6e", marginBottom: 8,
    display: "flex", alignItems: "center", gap: 6,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "white", height: "100%", overflowY: "auto" }}>
        <div style={{ position: "sticky", top: 0, background: m.bg, borderBottom: "1px solid #e5e7eb", padding: "16px 20px", zIndex: 1 }}>
          <button onClick={onClose} style={{ float: "right", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#374151" }}>✕</button>
          <div style={{ fontSize: 11, color: m.color, fontWeight: 700, textTransform: "uppercase" }}>{m.emoji} {m.label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111", marginTop: 4 }}>{name}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            {(contact.contact_type || "").replace("_", " ")}
            {contact.source && " · from " + contact.source}
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {/* Contact info card */}
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, marginBottom: 20 }}>
            <div style={innerTitle("#374151")}>📇 Contact Info</div>
            {contact.phone && <div style={{ fontSize: 13, marginBottom: 4 }}>📞 <a href={"tel:" + contact.phone} style={{ color: "#0c4a6e" }}>{contact.phone}</a></div>}
            {contact.email && <div style={{ fontSize: 13, marginBottom: 4 }}>✉️ <a href={"mailto:" + contact.email} style={{ color: "#0c4a6e" }}>{contact.email}</a></div>}
            {(contact.address || contact.city) && (
              <div style={{ fontSize: 13, marginBottom: 4 }}>📍 {[contact.address, contact.city, contact.state, contact.zip_code].filter(Boolean).join(", ")}</div>
            )}
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
              Last called: <strong>{fmtDate(contact.last_contacted_at)}</strong>
            </div>
          </div>

          {/* Next Follow-Up card */}
          {(() => {
            if (!contact.next_call_due_at) {
              return (
                <div style={{ background: "#f3f4f6", border: "1px dashed #d1d5db", borderRadius: 8, padding: 16, marginBottom: 20, textAlign: "center" }}>
                  <div style={{ ...innerTitle("#6b7280"), justifyContent: "center" }}>🔮 Next Follow-Up</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>No follow-up scheduled. Log a call to plan the next one.</div>
                </div>
              );
            }

            const next = new Date(contact.next_call_due_at);
            const now = new Date();
            const days = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
            const overdue = days < 0;
            const today = days === 0;

            // Derive reason from most recent call outcome
            const REASONS = {
              spoke_interested: "Stay top-of-mind with an interested lead",
              spoke_not_now: "Check back after their wait period",
              left_vm: "Follow up — you left a voicemail",
              no_answer: "Try again — last call went unanswered",
              meeting_set: "Meeting prep / confirmation",
              wrong_number: "Verify contact info",
            };
            const lastCall = callHistory[0];
            const reason = lastCall ? (REASONS[lastCall.outcome] || "Scheduled follow-up") : "Scheduled follow-up";

            const bg = overdue ? "#fee2e2" : today ? "#fef3c7" : "#dbeafe";
            const border = overdue ? "#fca5a5" : today ? "#fcd34d" : "#93c5fd";
            const color = overdue ? "#7f1d1d" : today ? "#78350f" : "#1e3a8a";
            const statusLabel = overdue ? `⚠️ ${Math.abs(days)}d Overdue` : today ? "📞 Due Today" : `📅 In ${days} day${days === 1 ? "" : "s"}`;

            return (
              <div style={{ background: bg, border: "1px solid " + border, borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={innerTitle(color)}>🔮 Next Follow-Up</div>
                  <div style={{ fontSize: 12, color, fontWeight: 800, padding: "3px 10px", background: "rgba(255,255,255,0.6)", borderRadius: 12 }}>{statusLabel}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 4 }}>
                  {next.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </div>
                <div style={{ fontSize: 13, color: color, marginBottom: 6 }}>{reason}</div>
                {lastCall && lastCall.notes && (
                  <div style={{ fontSize: 12, color: "#374151", marginTop: 8, padding: 8, background: "rgba(255,255,255,0.6)", borderRadius: 4 }}>
                    <strong style={{ fontSize: 10, textTransform: "uppercase", color: "#6b7280" }}>Last call note:</strong><br/>
                    {lastCall.notes}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Profile notes */}
          {contact.notes && (
            <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={innerTitle("#854d0e")}>📌 Profile Notes</div>
              <div style={{ fontSize: 14, color: "#1f2937", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{contact.notes}</div>
            </div>
          )}

          {/* Action buttons — bigger so the primary CTA actually reads as one */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 auto", minWidth: 180 }}>
              <LogCallButton large contact={contact} token={token} onLogged={() => { load(); onLogged && onLogged(); }} />
            </div>
            <button
              onClick={() => onEdit(contact)}
              style={{ background: "#fff", color: "#0c4a6e", border: "2px solid #0c4a6e", borderRadius: 8, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              ✏️ Edit Contact
            </button>
          </div>

          {/* Call history */}
          <div style={sectionTitle}>
            📋 Call History
            <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600, marginLeft: 4 }}>({callHistory.length})</span>
          </div>

          {loading && <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", padding: 20 }}>Loading...</div>}
          {!loading && callHistory.length === 0 && (
            <div style={{ background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 8, padding: 20, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
              No calls logged yet. Tap <strong>📞 Log Call</strong> above to record your first contact.
            </div>
          )}
          {!loading && callHistory.map(call => {
            const o = outcomeMeta[call.outcome] || { label: call.outcome, color: "#6b7280" };
            const by = [call.by_first, call.by_last].filter(Boolean).join(" ");
            return (
              <div key={call.id} style={{ background: "white", border: "1px solid #e5e7eb", borderLeft: `4px solid ${o.color}`, borderRadius: 8, padding: 14, marginBottom: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: o.color }}>{o.label}</span>
                  <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
                    {new Date(call.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                {call.notes && (
                  <div style={{ fontSize: 14, color: "#1f2937", marginTop: 6, padding: 10, background: "#f9fafb", borderRadius: 6, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {call.notes}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e5e7eb" }}>
                  {by && "Logged by " + by + " · "}
                  {call.next_call_scheduled_at ? "📅 Next call: " + new Date(call.next_call_scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "No follow-up scheduled"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ============================================================
// BULK SCHEDULE MODAL — distribute calls across days
// ============================================================
function BulkScheduleModal({ token, contactCount, onClose, onScheduled }) {
  const [step, setStep] = useState(1); // 1: configure, 2: confirm, 3: result
  const [filter, setFilter] = useState({ temperature: "", type: "", hasNoFollowUp: true });
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [callsPerDay, setCallsPerDay] = useState(20);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch(API + "/contacts/bulk-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ filter, startDate, callsPerDay, skipWeekends }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setResult(data);
      setStep(3);
      onScheduled && onScheduled(data);
    } catch (e) { alert("Failed: " + e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 540, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>📅 Schedule Calls</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          Distribute your contacts into a daily call plan. The system staggers contacts across days so you have a manageable list every morning.
        </div>

        {step === 1 && (
          <div>
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#78350f" }}>
              💡 <strong>How this works:</strong> You have {contactCount} contacts. The app will assign each one a "next call" date, spreading them across business days. Tomorrow's calls show up in your Win-the-Day widget.
            </div>

            <Field label="Which contacts?" hint="Choose what to schedule">
              <select value={filter.hasNoFollowUp ? "no_follow" : "all"} onChange={e => setFilter(f => ({ ...f, hasNoFollowUp: e.target.value === "no_follow" }))} style={inputStyle}>
                <option value="no_follow">Only contacts without a next-call date (recommended)</option>
                <option value="all">All matching contacts (overrides existing schedule)</option>
              </select>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Temperature filter">
                <select value={filter.temperature} onChange={e => setFilter(f => ({ ...f, temperature: e.target.value }))} style={inputStyle}>
                  <option value="">All statuses</option>
                  {Object.entries(TEMP_META).filter(([k]) => k !== "dnc").map(([k, m]) => <option key={k} value={k}>{m.emoji} {m.label}</option>)}
                </select>
              </Field>
              <Field label="Type filter">
                <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                  <option value="">All types</option>
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Start on" hint="First day of your call plan">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </Field>

            <Field label="How many calls per day?" hint="Realistic: 10-25 calls/day. Don't overcommit — you'll burn out.">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {[5, 10, 20, 50].map(n => (
                  <button key={n} onClick={() => setCallsPerDay(n)} type="button"
                    style={{ ...btnStyle(callsPerDay === n ? "#0c4a6e" : "#f3f4f6", callsPerDay === n ? "white" : "#374151"), padding: "6px 12px", fontSize: 12 }}>
                    {n}/day
                  </button>
                ))}
              </div>
              <input type="number" min="1" max="200" value={callsPerDay}
                onChange={e => setCallsPerDay(Math.max(1, Math.min(200, parseInt(e.target.value) || 1)))}
                style={{ ...inputStyle, width: 120 }} />
            </Field>

            <Field label="Skip weekends?">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={skipWeekends} onChange={e => setSkipWeekends(e.target.checked)} style={{ width: 16, height: 16 }} />
                Skip Saturdays and Sundays (recommended)
              </label>
            </Field>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={onClose} style={btnStyle("#e5e7eb", "#374151")}>Cancel</button>
              <button onClick={() => setStep(2)} style={btnStyle("#0c4a6e", "white")}>Preview →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13, color: "#1e3a8a" }}>
              <strong>📋 Review your plan:</strong>
              <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
                <li>Filter: <strong>{filter.hasNoFollowUp ? "Only contacts without a follow-up" : "All matching contacts"}</strong>{filter.temperature ? " · " + (TEMP_META[filter.temperature] || {}).label : ""}{filter.type ? " · " + filter.type : ""}</li>
                <li>Start: <strong>{new Date(startDate + "T09:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong></li>
                <li>Pace: <strong>{callsPerDay} calls/day</strong></li>
                <li>Weekends: <strong>{skipWeekends ? "Skipped" : "Included"}</strong></li>
              </ul>
            </div>

            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, fontSize: 12, color: "#78350f", marginBottom: 16 }}>
              ⚠️ This will assign a "next call" date to each contact. {filter.hasNoFollowUp ? "Only contacts without a schedule will be affected." : "Existing schedules will be overwritten."}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button onClick={() => setStep(1)} style={btnStyle("#e5e7eb", "#374151")}>← Back</button>
              <button onClick={submit} disabled={submitting} style={btnStyle("#0c4a6e", "white")}>
                {submitting ? "Scheduling..." : "✓ Confirm Schedule"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div>
            <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#14532d", marginBottom: 8 }}>✅ Calls Scheduled</div>
              <div style={{ fontSize: 13, color: "#14532d", lineHeight: 1.7 }}>
                Scheduled: <strong>{result.scheduled} calls</strong><br/>
                First call: <strong>{new Date(result.first_call_date).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</strong><br/>
                Last call: <strong>{new Date(result.last_call_date).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</strong><br/>
                Span: <strong>{result.days_span} business days</strong> at {result.calls_per_day}/day
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: "#14532d", fontStyle: "italic" }}>
                💡 Your daily call list will appear in the ⚡ Win The Day widget on the dashboard each morning.
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
function SortableTh({ label, col, sortBy, setSortBy, hint }) {
  const active = sortBy.col === col;
  const arrow = active ? (sortBy.dir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th
      style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontWeight: 600, fontSize: 12, color: "#374151", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      title={hint || `Click to sort by ${label}`}
      onClick={() => {
        if (sortBy.col !== col) setSortBy({ col, dir: "asc" });
        else if (sortBy.dir === "asc") setSortBy({ col, dir: "desc" });
        else setSortBy({ col: "", dir: "asc" });
      }}
    >
      {label}{arrow}
    </th>
  );
}

export default function ContactsPage({ token, onBack }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ temperature: "", type: "", due: "", search: "", missing: "" });
  const [selected, setSelected] = useState(new Set());
  const [sortBy, setSortBy] = useState({ col: "", dir: "asc" });
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFillMissing, setShowFillMissing] = useState(false);
  const [showBulkSchedule, setShowBulkSchedule] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  // Track latest request — drop results from anything older. Without this,
  // typing in search or rapidly changing filters can race: an older response
  // arrives second and overwrites the current view with stale data.
  const loadRequestId = useRef(0);
  const load = async () => {
    const myId = ++loadRequestId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.temperature) params.set("temperature", filter.temperature);
      if (filter.type) params.set("type", filter.type);
      if (filter.due) params.set("due", filter.due);
      if (filter.search) params.set("search", filter.search);
      if (filter.missing) params.set("missing", filter.missing);
      if (sortBy.col) { params.set("sort", sortBy.col); params.set("dir", sortBy.dir); }
      const r = await fetch(API + "/contacts?" + params, { headers: { Authorization: "Bearer " + token }});
      const data = await r.json();
      if (myId !== loadRequestId.current) return; // stale — a newer load() has started
      setContacts(data.contacts || []);
    } catch (e) { console.error(e); }
    finally { if (myId === loadRequestId.current) setLoading(false); }
  };

  useEffect(() => { load(); }, [filter.temperature, filter.type, filter.due, filter.missing, sortBy.col, sortBy.dir]);

  const toggleOne = (id) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAll = () => setSelected(prev => prev.size === contacts.length ? new Set() : new Set(contacts.map(c => c.id)));

  const bulkAction = async (action) => {
    if (selected.size === 0) return;
    const verb = action === "delete" ? "PERMANENTLY DELETE" : action === "archive" ? "archive" : "un-archive";
    const noun = selected.size === 1 ? "contact" : "contacts";
    if (action === "delete") {
      if (!confirm("⚠️ Permanently delete " + selected.size + " " + noun + " AND all their call history?\n\nThis CANNOT be undone.")) return;
    } else {
      if (!confirm("Are you sure you want to " + verb + " " + selected.size + " " + noun + "?")) return;
    }
    try {
      const r = await fetch(API + "/contacts/bulk", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action })
      });
      const data = await r.json();
      if (!r.ok) { alert("Failed: " + (data.error || "unknown")); return; }
      setSelected(new Set());
      load();
    } catch (e) { alert("Error: " + e.message); }
  };

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowBulkSchedule(true)} style={btnStyle("#7c3aed", "white")}>📅 Schedule Calls</button>
          <button onClick={() => setShowImport(true)} style={btnStyle("#e5e7eb", "#374151")}>📥 Import CSV</button>
          <button onClick={() => setShowAdd(true)} style={btnStyle("#0c4a6e", "white")}>+ Add Contact</button>
        </div>
      </div>

      <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, fontSize: 12, color: "#78350f", marginBottom: 16 }}>
        💡 <strong>How this works:</strong> Add contacts and set their status (Hot, Warm, Cold, Sphere, Past Client, DNC). After every call, log the outcome — the system suggests when to call again. Hot leads get called every 2 days, sphere clients every 30, past clients every 60.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="🔍 Search name, email, phone..." value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          style={{ ...inputStyle, flex: 1, minWidth: 200, maxWidth: 320 }} />
        <select value={filter.temperature} onChange={e => setFilter(f => ({ ...f, temperature: e.target.value }))} style={{ ...inputStyle, width: 160 }}>
          <option value="">All statuses</option>
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
        <select value={filter.missing} onChange={e => setFilter(f => ({ ...f, missing: e.target.value }))} style={{ ...inputStyle, width: 200 }} title="Find contacts with missing info">
          <option value="">All contacts</option>
          <option value="no_phone">⚠️ Missing phone</option>
          <option value="no_email">⚠️ Missing email</option>
          <option value="no_phone_or_email">⚠️ Missing phone OR email</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a" }}>{selected.size} selected</div>
          <button onClick={() => bulkAction("archive")} style={btnStyle("#fef3c7", "#92400e")}>📦 Archive</button>
          <button onClick={() => bulkAction("unarchive")} style={btnStyle("#e0e7ff", "#3730a3")}>📤 Un-archive</button>
          <button onClick={() => bulkAction("delete")} style={btnStyle("#fee2e2", "#991b1b")}>🗑 Delete Forever</button>
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Clear selection</button>
        </div>
      )}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={{ ...th, width: 32 }}>
                <input type="checkbox" checked={contacts.length > 0 && selected.size === contacts.length} onChange={toggleAll}
                  title="Select all" style={{ cursor: "pointer" }} />
              </th>
              <SortableTh label="Name" col="name" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableTh label="Phone" col="phone" sortBy={sortBy} setSortBy={setSortBy} hint="Click twice → empties at top" />
              <SortableTh label="Type" col="type" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableTh label="Status" col="temperature" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableTh label="Last Called" col="last_called" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableTh label="Next Call" col="next_call" sortBy={sortBy} setSortBy={setSortBy} />
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</td></tr>}
            {!loading && contacts.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                No contacts yet. Click <strong>+ Add Contact</strong> or <strong>📥 Import CSV</strong>.
              </td></tr>
            )}
            {!loading && contacts.map(c => {
              const m = TEMP_META[c.temperature] || TEMP_META.warm;
              const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "(no name)";
              const overdue = c.next_call_due_at && new Date(c.next_call_due_at) < new Date();
              return (
                <tr key={c.id} style={{ borderTop: "1px solid #f3f4f6", background: selected.has(c.id) ? "#eff6ff" : "transparent" }}>
                  <td style={{ ...td, width: 32 }}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} style={{ cursor: "pointer" }} />
                  </td>
                  <td style={td}>
                    <button onClick={() => setViewing(c)} style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", cursor: "pointer", textAlign: "left", color: "#0c4a6e", fontWeight: 600, fontSize: 13 }}>
                      {name}
                    </button>
                    {c.email && <div style={{ fontSize: 11, color: "#6b7280" }}>{c.email}</div>}
                  </td>
                  <td style={td}>{c.phone || "—"}</td>
                  <td style={td}>{(c.contact_type || "").replace("_", " ")}</td>
                  <td style={td}>
                    <span style={{ background: m.bg, color: m.color, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                      {m.emoji} {m.label}
                    </span>
                  </td>
                  <td style={td}>{fmtPastDate(c.last_contacted_at)}</td>
                  <td style={{ ...td, color: overdue ? "#b91c1c" : "#374151", fontWeight: overdue ? 700 : 400 }}>
                    {fmtDate(c.next_call_due_at)}
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <LogCallButton contact={c} token={token} onLogged={load} compact />
                    <button onClick={() => setEditing(c)} style={{ ...btnStyle("#e5e7eb", "#374151"), padding: "4px 10px", fontSize: 11, marginLeft: 6 }}>Edit</button>
                    <button onClick={async () => {
                      if (!confirm("Archive " + name + "?")) return;
                      try {
                        await fetch(API + "/contacts/" + c.id, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ is_archived: true }) });
                        load();
                      } catch (e) { alert("Error: " + e.message); }
                    }} title="Archive contact" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, marginLeft: 6, padding: "2px 4px" }}>📦</button>
                    <button onClick={async () => {
                      if (!confirm("⚠️ Delete " + name + " forever?\n\nThis CANNOT be undone — call history will also be lost.")) return;
                      try {
                        await fetch(API + "/contacts/" + c.id, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
                        load();
                      } catch (e) { alert("Error: " + e.message); }
                    }} title="Delete forever" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, marginLeft: 4, padding: "2px 4px" }}>🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && <ContactModal token={token} onClose={() => setShowAdd(false)} onSaved={() => load()} />}
      {editing && <ContactModal contact={editing} token={token} onClose={() => setEditing(null)} onSaved={() => load()} />}
      {viewing && <ContactDetailDrawer contact={viewing} token={token} onClose={() => setViewing(null)} onEdit={(c) => { setViewing(null); setEditing(c); }} onLogged={load} onArchived={load} onDeleted={load} />}
      {showBulkSchedule && <BulkScheduleModal token={token} contactCount={contacts.length} onClose={() => setShowBulkSchedule(false)} onScheduled={() => load()} />}
      {showFillMissing && <FillMissingModal token={token} onClose={() => setShowFillMissing(false)} onDone={() => { setShowFillMissing(false); load(); }} />}
      {showImport && <ImportModal token={token}
        onClose={() => setShowImport(false)}
        onFillMissing={() => { setShowImport(false); setShowFillMissing(true); }}
        onImported={(data) => {
          // Reset all filters so newly imported contacts show
          setFilter({ temperature: "", type: "", due: "", search: "" });
          // Reload after a beat so backend has committed
          setTimeout(() => load(), 300);
        }} />}
    </div>
  );
}
