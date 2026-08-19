import React from 'react';
import { useState, useEffect, useRef } from "react";
import PopByLogModal from "./PopByLogModal";

const API = "https://liz-team-server-api-production.up.railway.app";

const TEMP_META = {
  hot:    { emoji: "🔥", label: "Hot",    color: "#dc2626", bg: "#fee2e2" },
  warm:   { emoji: "🌤",  label: "Warm",   color: "#d97706", bg: "#fef3c7" },
  cold:   { emoji: "❄️",  label: "Cold",   color: "#0284c7", bg: "#e0f2fe" },
  // Legacy values kept only so old badges still render; not selectable anymore
  // (these moved to Type / Tier to remove the Type-vs-Status overlap).
  sphere: { emoji: "👥", label: "Sphere", color: "#7c3aed", bg: "#ede9fe" },
  past:   { emoji: "🏡", label: "Past",   color: "#16a34a", bg: "#dcfce7" },
  dnc:    { emoji: "🚫", label: "DNC",    color: "#6b7280", bg: "#f3f4f6" },
};
// Temp is now purely opportunity heat: Hot / Warm / Cold.
const TEMP_SELECTABLE = ["hot", "warm", "cold"];

const TYPE_OPTIONS = ["lead", "buyer", "seller", "past_client", "sphere", "vendor", "other"];

// Plain-language, no-jargon walkthrough for agents. Opened from "How Contacts Work".
function ContactsGuide({ onClose }) {
  const card = { background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 };
  const h = { fontSize: 16, fontWeight: 800, color: "#0c4a6e", marginBottom: 6 };
  const p = { fontSize: 14, color: "#374151", lineHeight: 1.6 };
  const step = (n, title, body) => (
    <div style={{ ...card, display: "flex", gap: 12 }}>
      <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 16, background: "#0c4a6e", color: "white", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
      <div><div style={h}>{title}</div><div style={p}>{body}</div></div>
    </div>
  );
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 6000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#f9fafb", borderRadius: 14, maxWidth: 640, width: "100%", maxHeight: "92vh", overflowY: "auto", padding: 24, margin: "auto" }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#111", marginBottom: 4 }}>📖 How Your Contacts Work</div>
        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 18 }}>A 2-minute guide. This is your relationship list — the people who will give you business and referrals. The app tells you who to call each day so you never lose touch.</div>

        <div style={{ ...card, background: "#eff6ff", border: "1px solid #93c5fd" }}>
          <div style={h}>The 3 simple labels on every contact</div>
          <div style={p}>
            <strong>👤 Type</strong> = who they are to you (Buyer, Seller, Past Client, Sphere…).<br/>
            <strong>⭐ Tier</strong> = how likely they are to send you business — <strong>A</strong> = your best advocates, down to <strong>D</strong>. (Your relationship grade.)<br/>
            <strong>🌡 Temp</strong> = how "hot" the opportunity is right now — 🔥 Hot, 🌤 Warm, ❄️ Cold.
          </div>
        </div>

        {step(1, "Open the app each morning → Win the Day", "Your dashboard shows exactly who to call today, why, and any birthdays or anniversaries this week. You don't have to remember anyone — the app remembers for you.")}
        {step(2, "Make the call", "Tap the green 📞 Log Call button next to the person. Their notes and reason for calling are right there so you know what to say.")}
        {step(3, "Log what happened", "After the call, pick the outcome (Reached, Left Voicemail, etc.), type a quick 'reason for next call' (like \"follow up on pre-approval\"), and the app automatically schedules the next call for you.")}
        {step(4, "That's the whole loop", "Call → log it → the app picks the next date → it shows up again on the right day. Hot leads come back fast, sphere & past clients come back on a relaxed schedule. You just work the list.")}

        <div style={card}>
          <div style={h}>👥 Groups</div>
          <div style={p}>Tag people by where you met them — "Bunco," "Church," "Open House." Use <strong>Manage Groups</strong> to create one, or check several contacts and click <strong>Add to Group</strong>. Then filter to see everyone from that group at once.</div>
        </div>
        <div style={card}>
          <div style={h}>📥 Adding people</div>
          <div style={p}><strong>+ Add Contact</strong> for one person. <strong>Import CSV</strong> to bring in a whole list — it won't create duplicates or erase your call notes.</div>
        </div>
        <div style={card}>
          <div style={h}>⭐ Your daily list builds itself</div>
          <div style={p}>You don't set anything up. Each contact's tier sets their rhythm (A clients come up often, D rarely), and Win the Day automatically shows the right handful for today — never hundreds at once. Work them, and the next ones appear tomorrow.</div>
        </div>
        <div style={card}>
          <div style={h}>🎂 Birthdays, 🎁 pop-bys & 📬 Items of Value</div>
          <div style={p}>Birthdays and anniversaries pop up on your daily list that week. If you turn on <strong>Pop-bys</strong> (top of the page) the app reminds you to drop off a small gift to your best clients a few times a year — with a seasonal gift idea. <strong>Items of Value</strong> reminds you to send a helpful note/market update. Both are optional.</div>
        </div>

        <div style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic", margin: "8px 0 16px" }}>👉 The golden rule: open the app, work today's list, log every call. Do that daily and your follow-up runs itself.</div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "#0c4a6e", color: "white", border: "none", borderRadius: 8, padding: "12px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Got it — let's go</button>
        </div>
      </div>
    </div>
  );
}

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
const th = { padding: "12px 12px", fontSize: 13, fontWeight: 800, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "left", borderBottom: "2px solid #cbd5e1" };
const td = { padding: "10px 12px", verticalAlign: "middle" };

// A/B/C/D tier badge — distinct colors so the classification pops.
function tierBadgeStyle(tier) {
  const map = {
    "A+": { bg: "#065f46", color: "#fff" },
    "A":  { bg: "#16a34a", color: "#fff" },
    "B":  { bg: "#2563eb", color: "#fff" },
    "C":  { bg: "#d97706", color: "#fff" },
    "D":  { bg: "#6b7280", color: "#fff" },
  };
  const c = map[(tier || "").toUpperCase()] || { bg: "#e5e7eb", color: "#374151" };
  return { background: c.bg, color: c.color, padding: "2px 9px", borderRadius: 12, fontSize: 12, fontWeight: 800, minWidth: 22, display: "inline-block", textAlign: "center" };
}

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
  const [newTier, setNewTier] = useState(contact.tier || ""); // A+/A/B/C/D letter grade, editable right here (Carlos 8/19)
  const [nextReason, setNextReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null); // null = loading, [] = none

  // Pull this contact's past calls so the agent sees what they talked about
  // last time BEFORE logging the new call.
  useEffect(() => {
    let alive = true;
    fetch(API + "/contacts/" + contact.id + "/calls", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive) setHistory(Array.isArray(d) ? d : (d && Array.isArray(d.calls) ? d.calls : [])); })
      .catch(() => { if (alive) setHistory([]); });
    return () => { alive = false; };
  }, [contact.id]);

  const outcomeLabel = (id) => (OUTCOMES.find(o => o.id === id) || {}).label || id;

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
      // Temperature / letter-grade update first if changed
      const changes = {};
      if (newTemp !== contact.temperature) changes.temperature = newTemp;
      if ((newTier || "") !== (contact.tier || "")) changes.tier = newTier || null;
      if (Object.keys(changes).length) {
        await fetch(API + "/contacts/" + contact.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify(changes)
        });
      }
      const body = { outcome: outcome.id, notes: notes || null, nextCallReason: nextReason || null };
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
    <div style={{ position: "fixed", inset: 0, zIndex: 4500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onMouseDown={e => { if (e.target === e.currentTarget) e.currentTarget.dataset.downOnBackdrop = "1"; else delete e.currentTarget.dataset.downOnBackdrop; }} onClick={e => { const ok = e.target === e.currentTarget && e.currentTarget.dataset.downOnBackdrop; delete e.currentTarget.dataset.downOnBackdrop; if (ok) onClose(); }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24, margin: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📞 Log Call · {contactName}</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          {step === 1 ? "What was the outcome of this call?" : "What's next with this lead?"}
        </div>

        {step === 1 && history && history.length > 0 && (
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>🕑 Your full history ({history.length} interaction{history.length === 1 ? "" : "s"})</div>
            <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
              {history.map((h, i) => (
                <div key={h.id || i} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: i < history.length - 1 ? "1px solid #EEF2F7" : "none" }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {h.created_at ? new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""} · <span style={{ fontWeight: 700, color: "#334155" }}>{outcomeLabel(h.outcome)}</span>
                    {(h.by_first || h.by_last) ? <span style={{ color: "#94a3b8" }}> · by {[h.by_first, h.by_last].filter(Boolean).join(" ")}</span> : null}
                  </div>
                  {h.notes && <div style={{ fontSize: 13, color: "#1f2937", marginTop: 2, lineHeight: 1.45 }}>"{h.notes}"</div>}
                  {h.next_call_scheduled_at && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>↳ next: {new Date(h.next_call_scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {step === 1 && history === null && (
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>Loading past conversations…</div>
        )}

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

            {!noFollowUp && (
              <Field label="🎯 Reason for the next call (optional)" hint="Shows on your Win the Day list so you know why you're calling.">
                <input value={nextReason} onChange={e => setNextReason(e.target.value)}
                  placeholder="e.g. Follow up on pre-approval, check in re: listing, send comps"
                  style={inputStyle} />
              </Field>
            )}

            <Field label="📝 What did you talk about? (optional)" hint="You'll see these notes next time you call this person.">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="e.g. Looking in $600-700k range, contingent on selling current home, kids in Lake Mary schools..."
                style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <Field label={"🌡 Temp — " + m.emoji + " " + m.label} hint="Did this call change how hot this lead is? Changing this adjusts how often you'll be reminded to call them.">
              <select value={TEMP_SELECTABLE.includes(newTemp) ? newTemp : "warm"} onChange={e => setNewTemp(e.target.value)} style={inputStyle}>
                {TEMP_SELECTABLE.map(k => (
                  <option key={k} value={k}>{TEMP_META[k].emoji} {TEMP_META[k].label}</option>
                ))}
              </select>
            </Field>

            {/* Letter grade, right where the call ends — no detour through Edit
                Contact to demote an A to B/C/D after a call (Carlos 8/19). */}
            <Field label={"⭐ Grade — " + (newTier || "not set")}
              hint="A = your best advocates, down to D = rarely contact. The letter sets their call rhythm: A+/A monthly, B every 3 months, C twice a year, D once a year. Tap the current letter to clear it.">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["A+", "A", "B", "C", "D"].map(t => {
                  const on = newTier === t;
                  const badge = tierBadgeStyle(t);
                  return (
                    <button type="button" key={t} onClick={() => setNewTier(on ? "" : t)}
                      style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                        border: on ? "2px solid " + badge.background : "1.5px solid #d1d5db",
                        background: on ? badge.background : "#fff", color: on ? badge.color : "#374151" }}>
                      {on ? "✓ " : ""}{t}
                    </button>
                  );
                })}
              </div>
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
export function LogCallButton({ contact, token, onLogged, compact, large, autoOpen }) {
  const [open, setOpen] = useState(!!autoOpen);
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
  const [showMoreFields, setShowMoreFields] = useState(isEdit); // quick add = 4 fields; details fold open when editing
  const [form, setForm] = useState({
    firstName: (contact && contact.first_name) || "",
    lastName: (contact && contact.last_name) || "",
    email: (contact && contact.email) || "",
    phone: (contact && contact.phone) || "",
    contactType: (contact && contact.contact_type) || "lead",
    temperature: (contact && contact.temperature) || "warm",
    source: (contact && contact.source) || "",
    tier: (contact && contact.tier) || "",
    spouse_name: (contact && contact.spouse_name) || "",
    birthday: (contact && contact.birthday ? contact.birthday.slice(0,10) : "") || "",
    wedding_anniversary: (contact && contact.wedding_anniversary ? contact.wedding_anniversary.slice(0,10) : "") || "",
    referred_by: (contact && contact.referred_by) || "",
    address: (contact && contact.address) || "",
    city: (contact && contact.city) || "",
    state: (contact && contact.state) || "FL",
    zip_code: (contact && contact.zip_code) || "",
    popby_address: (contact && contact.popby_address) || "",
    last_moved_on: (contact && contact.last_moved_on ? contact.last_moved_on.slice(0,10) : "") || "",
    move_cycle_years: (contact && contact.move_cycle_years) || "",
    groups: (contact && Array.isArray(contact.tags) ? contact.tags : []),
    notes: (contact && contact.notes) || "",
    messagingConsent: !!(contact && contact.messaging_consent),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [newGroup, setNewGroup] = useState("");
  useEffect(() => {
    fetch(API + "/contacts/groups", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json()).then(d => setAvailableGroups((d.groups || []).map(g => g.name))).catch(() => {});
  }, []);

  const toggleGroup = (name) => setForm(f => ({
    ...f,
    groups: f.groups.includes(name) ? f.groups.filter(g => g !== name) : [...f.groups, name],
  }));
  const addNewGroup = () => {
    const n = newGroup.trim();
    if (!n) return;
    if (!availableGroups.includes(n)) setAvailableGroups(g => [...g, n]);
    setForm(f => ({ ...f, groups: f.groups.includes(n) ? f.groups : [...f.groups, n] }));
    setNewGroup("");
  };

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const url = isEdit ? (API + "/contacts/" + contact.id) : (API + "/contacts");
      const method = isEdit ? "PUT" : "POST";
      // form.groups holds the selected group names → tags. Also fold in a group
      // the user typed in the "+ New group" box but didn't click Add — otherwise
      // it's silently dropped and the group shows 0 members.
      const groups = Array.isArray(form.groups) ? [...form.groups] : [];
      const pending = newGroup.trim();
      if (pending && !groups.includes(pending)) groups.push(pending);
      const payload = { ...form, tags: groups };
      delete payload.groups;
      // CREATE reads camelCase zipCode; UPDATE reads snake_case zip_code.
      // Send exactly ONE — both at once makes the UPDATE set the same column
      // twice, which Postgres rejects ("Internal error", Carlos 7/22).
      if (!isEdit) { payload.zipCode = payload.zip_code; delete payload.zip_code; }
      // Empty date/tier strings must be null (empty string breaks a DATE column).
      for (const k of ["birthday", "wedding_anniversary", "tier", "spouse_name", "referred_by", "last_moved_on"]) {
        if (payload[k] === "") payload[k] = null;
      }
      payload.move_cycle_years = payload.move_cycle_years === "" || payload.move_cycle_years == null ? null : Math.max(1, parseInt(payload.move_cycle_years) || 0) || null;
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Save failed");
      onSaved && onSaved(data.contact);
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onMouseDown={e => { if (e.target === e.currentTarget) e.currentTarget.dataset.downOnBackdrop = "1"; else delete e.currentTarget.dataset.downOnBackdrop; }} onClick={e => { const ok = e.target === e.currentTarget && e.currentTarget.dataset.downOnBackdrop; delete e.currentTarget.dataset.downOnBackdrop; if (ok) onClose(); }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24, margin: "auto" }}>
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

        {(form.phone || form.email) && (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "2px 0 12px", padding: "10px 12px", background: "#fef6f6", border: "1px solid #f3d4d4", borderRadius: 8, cursor: "pointer", fontSize: 12.5, color: "#7a1f2b", lineHeight: 1.4 }}>
            <input type="checkbox" checked={form.messagingConsent} onChange={e => update("messagingConsent", e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>I have this person's permission to contact them by email and text. <span style={{ color: "#9a3b46" }}>(Required by Florida law before automated messages can be sent.)</span></span>
          </label>
        )}

        <Field label="How important is this person to your business?" hint="This decides how often the app reminds you to stay in touch. You can always change it.">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["A", "⭐ VIP", "past clients & referrers"], ["B", "👍 Regular", "stay in touch"], ["C", "🌱 Just met", "new connection"]].map(([t, label, sub]) => {
              const on = form.tier === t || (t === "A" && form.tier === "A+");
              return (
                <button type="button" key={t} onClick={() => update("tier", t)}
                  style={{ padding: "10px 14px", borderRadius: 10, border: on ? "2px solid #0c4a6e" : "1px solid #d1d5db", background: on ? "#0c4a6e" : "#fff", color: on ? "#fff" : "#374151", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{label}</div>
                  <div style={{ fontSize: 10.5, opacity: 0.75 }}>{sub}</div>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Where do you know them from?" hint="e.g. Referral, open house, Zillow, church, gym…"><input value={form.source} onChange={e => update("source", e.target.value)} style={inputStyle} /></Field>

        {!showMoreFields && (
          <button type="button" onClick={() => setShowMoreFields(true)}
            style={{ width: "100%", padding: "10px 0", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
            ▾ More details (optional) — birthday, spouse, groups, lead heat…
          </button>
        )}
        {showMoreFields && (<>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Type">
            <select value={form.contactType} onChange={e => update("contactType", e.target.value)} style={inputStyle}>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="How hot is this lead? 🔥">
            <select value={TEMP_SELECTABLE.includes(form.temperature) ? form.temperature : "warm"} onChange={e => update("temperature", e.target.value)} style={inputStyle}>
              {TEMP_SELECTABLE.map(k => (
                <option key={k} value={k}>{TEMP_META[k].emoji} {TEMP_META[k].label}</option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Precise grade (optional)" hint="Fine-tune the importance you picked above (A+ = top referrers, D = rarely contact).">
            <select value={form.tier} onChange={e => update("tier", e.target.value)} style={inputStyle}>
              <option value="">— none —</option>
              {["A+","A","B","C","D"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Referred By"><input value={form.referred_by} onChange={e => update("referred_by", e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Spouse / Partner Name"><input value={form.spouse_name} onChange={e => update("spouse_name", e.target.value)} style={inputStyle} /></Field>
        <Field label="Home address"><input value={form.address} onChange={e => update("address", e.target.value)} placeholder="123 Main St" style={inputStyle} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
          <Field label="City"><input value={form.city} onChange={e => update("city", e.target.value)} style={inputStyle} /></Field>
          <Field label="State"><input value={form.state} onChange={e => update("state", e.target.value)} style={inputStyle} /></Field>
          <Field label="ZIP"><input value={form.zip_code} onChange={e => update("zip_code", e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Pop-by address (if different from above)" hint="Where to drop off pop-by gifts. Leave blank to use the main address."><input value={form.popby_address} onChange={e => update("popby_address", e.target.value)} style={inputStyle} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Birthday"><input type="date" value={form.birthday} onChange={e => update("birthday", e.target.value)} style={inputStyle} /></Field>
          <Field label="Wedding Anniversary"><input type="date" value={form.wedding_anniversary} onChange={e => update("wedding_anniversary", e.target.value)} style={inputStyle} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Last time they moved" hint="When they bought / moved into their current home. We'll remind you to check in as their move cycle comes around."><input type="date" value={form.last_moved_on} onChange={e => update("last_moved_on", e.target.value)} style={inputStyle} /></Field>
          <Field label="Moves about every ___ years" hint="Most people move every few years — the app reminds you to check in as their time gets close. Leave blank for the default (3)."><input type="number" min="1" max="30" placeholder="3" value={form.move_cycle_years} onChange={e => update("move_cycle_years", e.target.value.replace(/\D/g, "").slice(0,2))} style={inputStyle} /></Field>
        </div>
        {!isEdit && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: -8, marginBottom: 4 }}>Tip: birthday, anniversaries, and "last moved" save once you create the contact and reopen it to edit.</div>}
        <Field label="Groups" hint="Optional — tag where you know them from. Pick any that apply (a contact can be in several, or none).">
          {availableGroups.length === 0 && form.groups.length === 0 ? (
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>No groups yet — create one below or in "Manage Groups".</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {Array.from(new Set([...availableGroups, ...form.groups])).map(name => {
                const on = form.groups.includes(name);
                return (
                  <button type="button" key={name} onClick={() => toggleGroup(name)}
                    style={{ padding: "4px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      border: on ? "1px solid #166534" : "1px solid #d1d5db", background: on ? "#dcfce7" : "white", color: on ? "#166534" : "#6b7280" }}>
                    {on ? "✓ " : ""}{name}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={newGroup} onChange={e => setNewGroup(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addNewGroup(); } }}
              placeholder="+ New group (e.g. Bunco)" style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
            <button type="button" onClick={addNewGroup} style={btnStyle("#e0e7ff", "#3730a3")}>Add</button>
          </div>
        </Field>
        <Field label="Notes"><textarea value={form.notes} onChange={e => update("notes", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></Field>
        </>)}

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
    <div onClick={() => !busy && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999, display:"flex", alignItems: "flex-start", justifyContent:"center", padding:16, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:14, padding:22, maxWidth:640, width:"100%", maxHeight:"90vh", overflowY:"auto", margin: "auto" }}>
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
    <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={safeClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24, margin: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📥 Import Contacts (CSV)</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          Upload a CSV export from your CRM, Google Contacts, Excel, or any spreadsheet. Column matching is automatic.
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
  const [moveScore, setMoveScore] = useState(null);
  const [showPopBy, setShowPopBy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(API + "/contacts/" + contact.id + "/move-score", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d && d.success) setMoveScore(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [contact.id]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + "/contacts/" + contact.id + "/history", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await r.json();
      setCallHistory(data.history || []);
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
              Last called: <strong>{fmtPastDate(contact.last_contacted_at)}</strong>
            </div>
          </div>

          {/* Likely to Move — score + why, from move cycle + engagement signals */}
          {moveScore && (moveScore.lastMovedOn || moveScore.score > 0) && (() => {
            const s = moveScore.score || 0;
            const c = s >= 75 ? { bg: "#fef2f2", bd: "#fecaca", fg: "#b91c1c", tag: "🔥 Hot — call now" }
                    : s >= 50 ? { bg: "#fffbeb", bd: "#fde68a", fg: "#b45309", tag: "👀 Worth a call" }
                    : { bg: "#f0fdf4", bd: "#bbf7d0", fg: "#15803d", tag: "Keeping an eye on it" };
            return (
              <div style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={innerTitle(c.fg)}>🏡 Likely to Move</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: c.fg }}>{s}%</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.fg, marginBottom: 6 }}>{c.tag}</div>
                {moveScore.lastMovedOn && <div style={{ fontSize: 13, marginBottom: 2 }}>🏠 Last moved: {fmtDate(moveScore.lastMovedOn)}{moveScore.yearsSince != null ? ` (~${moveScore.yearsSince} yrs ago)` : ""}</div>}
                {moveScore.nextMoveDate && <div style={{ fontSize: 13, marginBottom: 4 }}>🔄 Move-cycle mark: {fmtDate(moveScore.nextMoveDate)} (every {moveScore.cycle} yrs)</div>}
                {moveScore.engagement && (moveScore.engagement.clicks90 > 0 || moveScore.engagement.opens90 > 0) && (
                  <div style={{ fontSize: 13, marginBottom: 4 }}>📬 Newsletter (90d): opened {moveScore.engagement.opens90}, <strong>clicked {moveScore.engagement.clicks90}</strong></div>
                )}
                {Array.isArray(moveScore.reasons) && moveScore.reasons.length > 0 && (
                  <div style={{ fontSize: 12, color: "#374151", marginTop: 4 }}>Why: {moveScore.reasons.join("; ")}.</div>
                )}
              </div>
            );
          })()}

          {/* Relationship card — tier, spouse, key dates, groups, referred-by, notes */}
          {(contact.tier || contact.spouse_name || contact.birthday || contact.wedding_anniversary || contact.referred_by || (Array.isArray(contact.tags) && contact.tags.length) || contact.personal_notes || contact.popby_address || contact.last_moved_on) && (
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <div style={innerTitle("#0c4a6e")}>⭐ Relationship</div>
              {contact.tier && <div style={{ fontSize: 13, marginBottom: 4 }}>Tier: <span style={{ ...tierBadgeStyle(contact.tier) }}>{contact.tier}</span></div>}
              {contact.spouse_name && <div style={{ fontSize: 13, marginBottom: 4 }}>💑 Spouse/partner: <strong>{contact.spouse_name}</strong></div>}
              {contact.birthday && <div style={{ fontSize: 13, marginBottom: 4 }}>🎂 Birthday: {fmtDate(contact.birthday)}</div>}
              {contact.wedding_anniversary && <div style={{ fontSize: 13, marginBottom: 4 }}>💍 Anniversary: {fmtDate(contact.wedding_anniversary)}</div>}
              {contact.referred_by && <div style={{ fontSize: 13, marginBottom: 4 }}>🙏 Referred by: <strong>{contact.referred_by}</strong></div>}
              {Array.isArray(contact.tags) && contact.tags.length > 0 && (
                <div style={{ fontSize: 13, marginBottom: 4, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                  👥 Groups: {contact.tags.map(t => <span key={t} style={{ background: "#dbeafe", color: "#1e3a8a", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{t}</span>)}
                </div>
              )}
              {contact.popby_address && <div style={{ fontSize: 13, marginBottom: 4 }}>🎁 Pop-by address: {contact.popby_address}</div>}
              {contact.personal_notes && <div style={{ fontSize: 12, color: "#374151", marginTop: 6, paddingTop: 6, borderTop: "1px solid #bae6fd" }}>{contact.personal_notes}</div>}
            </div>
          )}

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

          {/* Log a pop-by for this contact */}
          <button onClick={() => setShowPopBy(true)}
            style={{ width: "100%", marginBottom: 16, background: "#fff", color: "#0F6E56", border: "2px solid #0F6E56", borderRadius: 8, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            🎁 Log a Pop-By
          </button>

          {/* Activity history — calls + pop-bys in one timeline */}
          <div style={sectionTitle}>
            📋 Activity History
            <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600, marginLeft: 4 }}>({callHistory.length})</span>
          </div>

          {loading && <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", padding: 20 }}>Loading...</div>}
          {!loading && callHistory.length === 0 && (
            <div style={{ background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 8, padding: 20, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
              Nothing logged yet. Tap <strong>📞 Log Call</strong> or <strong>🎁 Log a Pop-By</strong> above to start the history.
            </div>
          )}
          {!loading && callHistory.map(item => {
            const when = new Date(item.at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
            if (item.kind === "pop_by") {
              return (
                <div key={"p" + item.id} style={{ background: "white", border: "1px solid #e5e7eb", borderLeft: "4px solid #0F6E56", borderRadius: 8, padding: 14, marginBottom: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0F6E56" }}>🎁 Pop-by delivered</span>
                    <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{when}</span>
                  </div>
                  {item.gift && <div style={{ fontSize: 14, color: "#1f2937" }}>{item.gift}</div>}
                  {item.note && <div style={{ fontSize: 13, color: "#1f2937", marginTop: 6, padding: 10, background: "#f9fafb", borderRadius: 6, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{item.note}</div>}
                </div>
              );
            }
            const o = outcomeMeta[item.outcome] || { label: item.outcome, color: "#6b7280" };
            return (
              <div key={"c" + item.id} style={{ background: "white", border: "1px solid #e5e7eb", borderLeft: `4px solid ${o.color}`, borderRadius: 8, padding: 14, marginBottom: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: o.color }}>{o.label}</span>
                  <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{when}</span>
                </div>
                {item.notes && (
                  <div style={{ fontSize: 14, color: "#1f2937", marginTop: 6, padding: 10, background: "#f9fafb", borderRadius: 6, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {item.notes}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e5e7eb" }}>
                  {item.by && "Logged by " + item.by + " · "}
                  {item.nextCallScheduledAt ? "📅 Next call: " + new Date(item.nextCallScheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "No follow-up scheduled"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {showPopBy && (
        <PopByLogModal token={token} contact={contact} onClose={() => setShowPopBy(false)} onSaved={() => { setShowPopBy(false); load(); onLogged && onLogged(); }} />
      )}
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 540, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24, margin: "auto" }}>
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
// EMAIL NEWSLETTER / MASS MAILING
// ============================================================
const NEWSLETTER_STARTER = `Hi {first_name},

Here's a quick look at what's happening in our local market this month:

• Homes are taking an average of __ days to sell right now.
• Inventory is [up / down] compared to last month, which means it's a [buyer's / seller's] market.
• Interest rates are around __%, so this is a good time to [buy / refinance / list].

If you've been wondering what your home is worth in today's market, just reply to this email and I'll put together a free, no-pressure estimate for you.

Always here if you have any questions about real estate!`;

function CampaignModal({ token, groupList, onClose }) {
  const [status, setStatus] = useState(null);            // null = loading
  const [audienceKind, setAudienceKind] = useState("all");
  const [audienceValue, setAudienceValue] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(NEWSLETTER_STARTER);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendDay, setSendDay] = useState(1);
  const [campaigns, setCampaigns] = useState([]);

  const authHeaders = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const loadCampaigns = () => fetch(API + "/marketing/campaigns", { headers: { Authorization: "Bearer " + token } })
    .then(r => r.json()).then(d => setCampaigns(d.campaigns || [])).catch(() => {});
  useEffect(() => {
    fetch(API + "/marketing/status", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json()).then(setStatus).catch(() => setStatus({ configured: false }));
    loadCampaigns();
  }, []);
  // Re-preview the audience whenever it changes.
  useEffect(() => {
    if (!status || !status.configured) return;
    let alive = true;
    setPreviewing(true);
    fetch(API + "/marketing/preview", { method: "POST", headers: authHeaders, body: JSON.stringify({ audience_kind: audienceKind, audience_value: audienceValue || null }) })
      .then(r => r.json()).then(d => { if (alive) setPreview(d); }).catch(() => {}).finally(() => { if (alive) setPreviewing(false); });
    return () => { alive = false; };
  }, [audienceKind, audienceValue, status]);

  const send = async () => {
    if (!subject.trim()) return alert("Add a subject line.");
    if (!body.trim()) return alert("Write a message first.");
    const n = preview && preview.count;
    if (!confirm(`Send this newsletter now${n != null ? ` to about ${n} contact${n === 1 ? "" : "s"}` : ""}?\n\nEveryone gets a one-click unsubscribe link, and anyone who already opted out is skipped automatically. This will NOT affect your transaction emails.`)) return;
    setBusy(true);
    try {
      const r = await fetch(API + "/marketing/send", { method: "POST", headers: authHeaders, body: JSON.stringify({ subject, body, audience_kind: audienceKind, audience_value: audienceValue || null }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      alert(`✅ Sent to ${d.sent} contact${d.sent === 1 ? "" : "s"}.`
        + (d.skipped ? `\nSkipped ${d.skipped} (opted out or no email).` : "")
        + (d.cappedOut ? `\n${d.cappedOut} held back — you hit this month's send limit.` : "")
        + (d.failed ? `\n${d.failed} failed to send.` + (d.firstError ? `\n\nReason from email provider:\n${d.firstError}` : "") : ""));
      loadCampaigns();
      if (d.sent > 0) onClose();   // close after a successful send
    } catch (e) { alert("Error: " + e.message); }
    finally { setBusy(false); }
  };

  const schedule = async () => {
    if (!subject.trim()) return alert("Add a subject line.");
    if (!body.trim()) return alert("Write a message first.");
    if (!confirm(`Schedule this to send automatically on day ${sendDay} of every month?`)) return;
    setBusy(true);
    try {
      const r = await fetch(API + "/marketing/schedule", { method: "POST", headers: authHeaders, body: JSON.stringify({ subject, body, audience_kind: audienceKind, audience_value: audienceValue || null, send_day: sendDay }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      alert(`✅ Scheduled. This newsletter will send automatically on day ${sendDay} of every month — and you can pause it anytime below.`);
      loadCampaigns();
    } catch (e) { alert("Error: " + e.message); }
    finally { setBusy(false); }
  };

  const toggleCamp = async (id) => { await fetch(API + `/marketing/campaigns/${id}/toggle`, { method: "POST", headers: authHeaders }).catch(() => {}); loadCampaigns(); };
  const delCamp = async (id) => { if (!confirm("Delete this campaign?")) return; await fetch(API + `/marketing/campaigns/${id}`, { method: "DELETE", headers: authHeaders }).catch(() => {}); loadCampaigns(); };

  const monthly = campaigns.filter(c => c.schedule_kind === "monthly");
  const audienceLabel = audienceKind === "all" ? "everyone in your contacts"
    : audienceKind === "group" ? `the "${audienceValue || "…"}" group`
    : `Tier ${audienceValue || "…"} contacts`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 640, width: "100%", margin: "24px 0", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>📣 Email Newsletter</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>×</button>
        </div>

        {status === null && <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>Loading…</div>}

        {status && !status.configured && (
          <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: 16, color: "#78350f", fontSize: 14, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>One-time setup needed first</div>
            Newsletter sending isn't switched on yet. It needs its <strong>own separate sending address</strong> (a marketing subdomain) so it can never affect the important emails your transactions depend on.
            <div style={{ marginTop: 10, fontSize: 13 }}>Once your admin finishes the email setup, this screen unlocks and you can write &amp; send. Nothing here can send mail until then.</div>
          </div>
        )}

        {status && status.configured && (
          <>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              Send a friendly update to your database. A one-click <strong>unsubscribe</strong> link and your mailing address are added automatically (required by law), opted-out contacts are skipped, and this is sent on a <strong>separate lane from your transaction emails</strong> so it can't hurt them.
            </div>

            {/* Audience */}
            <label style={lbl}>Who gets it?</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <select value={audienceKind} onChange={e => { setAudienceKind(e.target.value); setAudienceValue(""); }} style={{ ...inputStyle, width: 200 }}>
                <option value="all">Everyone in my contacts</option>
                <option value="group">A specific group</option>
                <option value="tier">A specific tier</option>
              </select>
              {audienceKind === "group" && (
                <select value={audienceValue} onChange={e => setAudienceValue(e.target.value)} style={{ ...inputStyle, width: 200 }}>
                  <option value="">Pick a group…</option>
                  {groupList.map(g => <option key={g.name} value={g.name}>{g.name} ({g.count})</option>)}
                </select>
              )}
              {audienceKind === "tier" && (
                <select value={audienceValue} onChange={e => setAudienceValue(e.target.value)} style={{ ...inputStyle, width: 140 }}>
                  <option value="">Pick a tier…</option>
                  {["A+", "A", "B", "C", "D"].map(t => <option key={t} value={t}>Tier {t}</option>)}
                </select>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#0c4a6e", fontWeight: 600, marginBottom: 16 }}>
              {previewing ? "Counting recipients…" : preview ? `📨 Will reach ${preview.count} contact${preview.count === 1 ? "" : "s"} (${audienceLabel}, after skipping opt-outs and contacts with no email).` : ""}
            </div>

            {/* Subject + body */}
            <label style={lbl}>Subject line</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Your June market update 🏡" style={{ ...inputStyle, width: "100%", marginBottom: 12 }} />
            <label style={lbl}>Message</label>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Tip: type <code>{"{first_name}"}</code> and it's swapped for each person's name. Your signature is added automatically.</div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} style={{ ...inputStyle, width: "100%", fontFamily: "inherit", lineHeight: 1.5, resize: "vertical", marginBottom: 16 }} />

            {/* Send now */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
              <button onClick={send} disabled={busy} style={{ ...btnStyle("#0c4a6e", "white"), opacity: busy ? 0.6 : 1 }}>{busy ? "Working…" : "📤 Send Now"}</button>
              <span style={{ color: "#9ca3af", fontSize: 13 }}>or schedule it to repeat:</span>
            </div>

            {/* Schedule monthly */}
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🔁 Send automatically every month</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, color: "#374151" }}>On day</span>
                <select value={sendDay} onChange={e => setSendDay(parseInt(e.target.value, 10))} style={{ ...inputStyle, width: 80 }}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span style={{ fontSize: 14, color: "#374151" }}>of every month</span>
                <button onClick={schedule} disabled={busy} style={{ ...btnStyle("#16a34a", "white"), opacity: busy ? 0.6 : 1 }}>Save Monthly</button>
              </div>
            </div>

            {/* Existing monthly schedules */}
            {monthly.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Your monthly newsletters</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {monthly.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.subject}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          Day {c.send_day} monthly · {c.is_active ? "Active" : "Paused"}
                          {c.last_sent_at ? ` · last sent ${new Date(c.last_sent_at).toLocaleDateString()} (${c.last_sent_count})` : " · not sent yet"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => toggleCamp(c.id)} style={btnStyle(c.is_active ? "#fef3c7" : "#dcfce7", c.is_active ? "#92400e" : "#166534")}>{c.is_active ? "Pause" : "Resume"}</button>
                        <button onClick={() => delCamp(c.id)} style={btnStyle("#fee2e2", "#991b1b")}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
const lbl = { display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4 };

// ============================================================
// MAIN PAGE
// ============================================================
function SortableTh({ label, col, sortBy, setSortBy, hint }) {
  const active = sortBy.col === col;
  const arrow = active ? (sortBy.dir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th
      style={{ padding: "12px 12px", textAlign: "left", borderBottom: "2px solid #cbd5e1", fontWeight: 800, fontSize: 13, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
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
  const [filter, setFilter] = useState({ temperature: "", type: "", due: "", search: "", missing: "", group: "", tier: "" });
  const [groupList, setGroupList] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [sortBy, setSortBy] = useState({ col: "", dir: "asc" });
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFillMissing, setShowFillMissing] = useState(false);
  const [showBulkSchedule, setShowBulkSchedule] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [showGroups, setShowGroups] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [popBysEnabled, setPopBysEnabled] = useState(false);
  const [iovEnabled, setIovEnabled] = useState(false);
  const [showPopbyInfo, setShowPopbyInfo] = useState(false);

  useEffect(() => {
    fetch(API + "/contacts/prefs", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json()).then(d => { setPopBysEnabled(!!d.popBysEnabled); setIovEnabled(!!d.itemsOfValueEnabled); }).catch(() => {});
  }, []);

  const savePref = async (patch) => {
    try {
      await fetch(API + "/contacts/prefs", {
        method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {}
  };
  // Pop-bys / Items of Value compute live from the tier rhythm, so toggling the
  // pref takes effect immediately on Win the Day — no build step.
  const togglePopBys = (val) => { setPopBysEnabled(val); savePref({ popBysEnabled: val }); };
  const toggleIov = (val) => { setIovEnabled(val); savePref({ itemsOfValueEnabled: val }); };

  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  useEffect(() => { setPage(1); }, [filter.temperature, filter.type, filter.due, filter.missing, filter.group, filter.tier, filter.search, sortBy.col, sortBy.dir]);
  const pageCount = Math.max(1, Math.ceil(contacts.length / PAGE_SIZE));
  const pagedContacts = contacts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      if (filter.group) params.set("group", filter.group);
      if (filter.tier) params.set("tier", filter.tier);
      if (sortBy.col) { params.set("sort", sortBy.col); params.set("dir", sortBy.dir); }
      const r = await fetch(API + "/contacts?" + params, { headers: { Authorization: "Bearer " + token }});
      const data = await r.json();
      if (myId !== loadRequestId.current) return; // stale — a newer load() has started
      setContacts(data.contacts || []);
    } catch (e) { console.error(e); }
    finally { if (myId === loadRequestId.current) setLoading(false); }
  };

  useEffect(() => { load(); }, [filter.temperature, filter.type, filter.due, filter.missing, filter.group, filter.tier, sortBy.col, sortBy.dir]);

  const loadGroups = async () => {
    try {
      const r = await fetch(API + "/contacts/groups", { headers: { Authorization: "Bearer " + token } });
      const d = await r.json();
      if (r.ok) setGroupList(d.groups || []);
    } catch {}
  };
  useEffect(() => { loadGroups(); }, []);

  const createGroup = async () => {
    const name = prompt("New group name:");
    if (!name || !name.trim()) return;
    try {
      const r = await fetch(API + "/contacts/groups", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Failed"); }
      await loadGroups();
      alert("✅ Group \"" + name.trim() + "\" created. Now add contacts to it.");
    } catch (e) { alert("Error: " + e.message); }
  };

  const deleteGroup = async (name) => {
    if (!confirm("Delete group \"" + name + "\"? It will be removed from all contacts (contacts themselves are kept).")) return;
    try {
      const r = await fetch(API + "/contacts/groups/" + encodeURIComponent(name), { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Failed"); }
      if (filter.group === name) setFilter(f => ({ ...f, group: "" }));
      await loadGroups(); await load();
    } catch (e) { alert("Error: " + e.message); }
  };

  const bulkSetTier = async () => {
    if (selected.size === 0) return;
    const t = prompt("Set tier for the selected " + selected.size + " contact(s)?\nType: A+, A, B, C, or D");
    if (!t || !t.trim()) return;
    try {
      const r = await fetch(API + "/contacts/bulk-tier", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], tier: t.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setSelected(new Set());
      await load();
      alert("✅ Set " + d.count + " contact(s) to tier " + d.tier + ".");
    } catch (e) { alert("Error: " + e.message); }
  };

  const bulkAddToGroup = async () => {
    if (selected.size === 0) return;
    const g = prompt("Add the selected " + selected.size + " contact(s) to which group?\n(e.g. Bunco, Church, Open House)");
    if (!g || !g.trim()) return;
    try {
      const r = await fetch(API + "/contacts/bulk-group", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], group: g.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setSelected(new Set());
      await loadGroups();
      await load();
      alert("✅ Added " + d.count + " contact(s) to group \"" + d.group + "\".");
    } catch (e) { alert("Error: " + e.message); }
  };

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

  // ── Mailing labels (Avery 5160 — 30 per sheet, 1" x 2-5/8") ────────────
  // Pure-frontend print: opens a window sized exactly to the Avery 5160 grid
  // and prints. No backend change — the list already returns address fields.
  const escHtml = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const buildLabel = (c) => {
    const name = (c.envelope_salutation && c.envelope_salutation.trim())
      || [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    const street = (c.address || "").trim();
    const cityState = [c.city, c.state].filter(Boolean).join(", ");
    const cityZip = [cityState, c.zip_code].filter(Boolean).join(" ").trim();
    return { name, street, cityZip, hasAddr: !!(street || cityZip) };
  };
  const printLabels = (list) => {
    const labels = list.map(buildLabel).filter(l => l.hasAddr);
    const skipped = list.length - labels.length;
    if (labels.length === 0) {
      alert("None of these contacts have a mailing address on file, so there's nothing to print.\n\nAdd a street/city/state/zip to a contact (Edit), then try again.");
      return;
    }
    if (skipped > 0 && !confirm(`${labels.length} label${labels.length === 1 ? "" : "s"} will print.\n\n${skipped} contact${skipped === 1 ? " was" : "s were"} skipped — no mailing address on file.\n\nContinue?`)) return;
    const cells = labels.map(l => `
      <div class="label">
        <div class="nm">${escHtml(l.name)}</div>
        ${l.street ? `<div>${escHtml(l.street)}</div>` : ""}
        ${l.cityZip ? `<div>${escHtml(l.cityZip)}</div>` : ""}
      </div>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mailing Labels</title>
      <style>
        @page { size: 8.5in 11in; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
        .bar { padding: 14px 20px; background: #0c4a6e; color: #fff; font: 600 14px Arial; display: flex; align-items: center; gap: 14px; }
        .bar button { background: #fff; color: #0c4a6e; border: 0; border-radius: 6px; padding: 8px 16px; font: 700 14px Arial; cursor: pointer; }
        .bar span { font-weight: 400; opacity: .9; }
        .sheet { width: 8.5in; padding: 0.5in 0.1875in 0 0.1875in; display: flex; flex-wrap: wrap; align-content: flex-start; }
        .label { width: 2.625in; height: 1in; margin-right: 0.125in; padding: 0.12in 0.2in; overflow: hidden;
                 display: flex; flex-direction: column; justify-content: center; font-size: 11pt; line-height: 1.25; break-inside: avoid; }
        .label:nth-child(3n) { margin-right: 0; }
        .nm { font-weight: 700; }
        @media print { .bar { display: none; } }
      </style></head><body>
      <div class="bar"><button onclick="window.print()">🖨 Print Labels</button>
        <span>${labels.length} label${labels.length === 1 ? "" : "s"} • Avery 5160 (also 8160 / 5260 / 8460). Set printer scale to 100% / Actual Size.</span></div>
      <div class="sheet">${cells}</div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Your browser blocked the print window. Please allow pop-ups for this site and try again."); return; }
    w.document.write(html);
    w.document.close();
  };

  // ── Export to CSV ──────────────────────────────────────────────────────
  // Downloads whatever is currently shown (filters/search apply) as a CSV
  // that re-imports cleanly via 📥 Import CSV. Column names match the importer.
  const exportCsv = () => {
    if (contacts.length === 0) { alert("There are no contacts to export right now. Clear your filters or add a contact first."); return; }
    const cols = [
      ["first_name", "First Name"], ["last_name", "Last Name"],
      ["email", "Email"], ["phone", "Phone"],
      ["contact_type", "Type"], ["temperature", "Temperature"], ["tier", "Tier"],
      ["source", "Source"],
      ["address", "Address"], ["city", "City"], ["state", "State"], ["zip_code", "Zip"],
      ["tags", "Groups"], ["spouse_name", "Spouse"], ["birthday", "Birthday"],
      ["notes", "Notes"],
    ];
    const cell = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = cols.map(c => c[1]).join(",");
    const rows = contacts.map(c => cols.map(([k]) => {
      let v = c[k];
      if (k === "tags") v = Array.isArray(c.tags) ? c.tags.join("; ") : "";
      if ((k === "birthday") && v) v = String(v).slice(0, 10); // YYYY-MM-DD
      return cell(v);
    }).join(","));
    const csv = "﻿" + [header, ...rows].join("\r\n"); // BOM → Excel reads UTF-8
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    a.href = url;
    a.download = `contacts-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowMenu(v => !v)} style={btnStyle("#e5e7eb", "#374151")}>☰ Tools ▾</button>
            {showMenu && (
              <>
                <div onMouseDown={e => { if (e.target === e.currentTarget) e.currentTarget.dataset.dob = "1"; else delete e.currentTarget.dataset.dob; }} onClick={e => { if (e.target === e.currentTarget && e.currentTarget.dataset.dob === "1") setShowMenu(false); delete e.currentTarget.dataset.dob; }} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50, background: "white", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 6, minWidth: 220 }}>
                  {[
                    { label: "📣 Email Newsletter", on: () => setShowCampaign(true), hint: "mass email" },
                    { label: "👥 Manage Groups", on: () => setShowGroups(true) },
                    { label: "📤 Export to CSV", on: exportCsv, hint: `${contacts.length} shown` },
                    { label: "🏷 Print Mailing Labels", on: () => printLabels(contacts), hint: "Avery 5160" },
                    { label: "⚙ Settings", on: () => setShowSettings(true) },
                  ].map(it => (
                    <button key={it.label} onClick={() => { setShowMenu(false); it.on(); }}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "10px 12px", borderRadius: 6, fontSize: 14, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span>{it.label}</span>
                      {it.hint && <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af" }}>{it.hint}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Surfaced as its own button — it was buried in the Tools menu and testers
              couldn't find it. (round-2: contacts CSV import) */}
          <button onClick={() => setShowImport(true)} style={btnStyle("#e5e7eb", "#374151")}>📥 Import CSV</button>
          <button onClick={() => setShowAdd(true)} style={btnStyle("#0c4a6e", "white")}>+ Add Contact</button>
        </div>
      </div>

      <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, fontSize: 12, color: "#78350f", marginBottom: 10 }}>
        💡 New here, or training an agent? <button onClick={() => setShowGuide(true)} style={{ background: "#0c4a6e", color: "white", border: "none", borderRadius: 6, padding: "5px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginLeft: 4 }}>📖 How Contacts Work — Start Here</button>
      </div>
      {showPopbyInfo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 6000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onMouseDown={e => { if (e.target === e.currentTarget) e.currentTarget.dataset.dob = "1"; else delete e.currentTarget.dataset.dob; }} onClick={e => { if (e.target === e.currentTarget && e.currentTarget.dataset.dob === "1") setShowPopbyInfo(false); delete e.currentTarget.dataset.dob; }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 440, width: "100%", padding: 24, margin: "auto" }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>🎁 What's a "pop-by"?</div>
            <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
              A pop-by is when you personally drop off a small, thoughtful gift to a top client — a pie in the fall, a cold drink in summer, a little something just to say hello. It keeps you top-of-mind so they think of you (and refer you) when real estate comes up.
              <br/><br/>
              Turn this on and the app will remind you to pop by your A/B clients a few times a year and suggest gift ideas. <strong>It's optional</strong> — leave it off if pop-bys aren't your style.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowPopbyInfo(false)} style={btnStyle("#0c4a6e", "white")}>Got it</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 20, background: "#f7f8fa", padding: "8px 0" }}>
        <input placeholder="🔍 Search name, email, phone..." value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          style={{ ...inputStyle, flex: 1, minWidth: 200, maxWidth: 320 }} />
        <select value={filter.temperature} onChange={e => setFilter(f => ({ ...f, temperature: e.target.value }))} style={{ ...inputStyle, width: 140 }}>
          <option value="">All temps</option>
          {TEMP_SELECTABLE.map(k => <option key={k} value={k}>{TEMP_META[k].emoji} {TEMP_META[k].label}</option>)}
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
        <select value={filter.tier} onChange={e => setFilter(f => ({ ...f, tier: e.target.value }))} style={{ ...inputStyle, width: 120 }} title="Filter by tier">
          <option value="">All tiers</option>
          {["A+","A","B","C","D"].map(t => <option key={t} value={t}>Tier {t}</option>)}
        </select>
        <select value={filter.group} onChange={e => setFilter(f => ({ ...f, group: e.target.value }))} style={{ ...inputStyle, width: 170 }} title="Filter by group">
          <option value="">All groups</option>
          {groupList.map(g => <option key={g.name} value={g.name}>{g.name} ({g.count})</option>)}
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
          <button onClick={bulkSetTier} style={btnStyle("#e0e7ff", "#3730a3")}>⭐ Set Tier</button>
          <button onClick={bulkAddToGroup} style={btnStyle("#dcfce7", "#166534")}>👥 Add to Group</button>
          <button onClick={() => printLabels(contacts.filter(c => selected.has(c.id)))} style={btnStyle("#fef9c3", "#854d0e")} title="Print Avery 5160 mailing labels for the selected contacts">🏷 Print Labels</button>
          <button onClick={() => bulkAction("archive")} style={btnStyle("#fef3c7", "#92400e")}>📦 Archive</button>
          <button onClick={() => bulkAction("unarchive")} style={btnStyle("#e0e7ff", "#3730a3")}>📤 Un-archive</button>
          <button onClick={() => bulkAction("delete")} style={btnStyle("#fee2e2", "#991b1b")}>🗑 Delete Forever</button>
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Clear selection</button>
        </div>
      )}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr style={{ background: "#eef2f7" }}>
              <th style={{ ...th, width: 32 }}>
                <input type="checkbox" checked={contacts.length > 0 && selected.size === contacts.length} onChange={toggleAll}
                  title="Select all" style={{ cursor: "pointer" }} />
              </th>
              <SortableTh label="Name" col="name" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableTh label="Tier" col="tier" sortBy={sortBy} setSortBy={setSortBy} hint="A/B/C/D priority classification" />
              <SortableTh label="Phone" col="phone" sortBy={sortBy} setSortBy={setSortBy} hint="Click twice → empties at top" />
              <SortableTh label="Type" col="type" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableTh label="Temp" col="temperature" sortBy={sortBy} setSortBy={setSortBy} hint="Opportunity heat: Hot / Warm / Cold" />
              <SortableTh label="Last Called" col="last_called" sortBy={sortBy} setSortBy={setSortBy} />
              <SortableTh label="Next Call" col="next_call" sortBy={sortBy} setSortBy={setSortBy} />
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</td></tr>}
            {!loading && contacts.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                No contacts yet. Click <strong>+ Add Contact</strong> or <strong>📥 Import CSV</strong>.
              </td></tr>
            )}
            {!loading && pagedContacts.map(c => {
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
                  <td style={td}>
                    {c.tier ? (
                      <span style={{ ...tierBadgeStyle(c.tier) }}>{c.tier}</span>
                    ) : <span style={{ color: "#d1d5db" }}>—</span>}
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

      {/* Pagination */}
      {!loading && contacts.length > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 14 }}>
          <button onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={page === 1} style={{ ...btnStyle(page === 1 ? "#f3f4f6" : "#0c4a6e", page === 1 ? "#9ca3af" : "white"), cursor: page === 1 ? "default" : "pointer" }}>← Prev</button>
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
            Page {page} of {pageCount} · showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, contacts.length)} of {contacts.length}
          </span>
          <button onClick={() => { setPage(p => Math.min(pageCount, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={page === pageCount} style={{ ...btnStyle(page === pageCount ? "#f3f4f6" : "#0c4a6e", page === pageCount ? "#9ca3af" : "white"), cursor: page === pageCount ? "default" : "pointer" }}>Next →</button>
        </div>
      )}

      {/* Back to top */}
      <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        title="Back to top"
        style={{ position: "fixed", bottom: 24, right: 24, zIndex: 30, background: "#0c4a6e", color: "white", border: "none", borderRadius: "50%", width: 46, height: 46, fontSize: 20, cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.25)" }}>↑</button>

      {showAdd && <ContactModal token={token} onClose={() => setShowAdd(false)} onSaved={() => load()} />}
      {showGuide && <ContactsGuide onClose={() => setShowGuide(false)} />}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onMouseDown={e => { if (e.target === e.currentTarget) e.currentTarget.dataset.dob = "1"; else delete e.currentTarget.dataset.dob; }} onClick={e => { if (e.target === e.currentTarget && e.currentTarget.dataset.dob === "1") setShowSettings(false); delete e.currentTarget.dataset.dob; }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 480, width: "100%", padding: 24, margin: "auto" }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>⚙ Contact Settings</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 16 }}>
              Your daily call list builds itself from each contact's tier — open Win the Day and the right people are already there.
            </div>
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#78350f" }}>
              🎁 <strong>Pop-bys / gift runs moved to their own page.</strong> Open <strong>🎁 Pop-Bys</strong> from your Dashboard to turn them on, set your tiers, budget &amp; frequency, get gift ideas, and plan a delivery route.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowSettings(false)} style={btnStyle("#0c4a6e", "white")}>Done</button>
            </div>
          </div>
        </div>
      )}
      {showGroups && (
        <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onMouseDown={e => { if (e.target === e.currentTarget) e.currentTarget.dataset.dob = "1"; else delete e.currentTarget.dataset.dob; }} onClick={e => { if (e.target === e.currentTarget && e.currentTarget.dataset.dob === "1") setShowGroups(false); delete e.currentTarget.dataset.dob; }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 24, margin: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>👥 Manage Groups</div>
              <button onClick={createGroup} style={btnStyle("#16a34a", "white")}>+ New Group</button>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
              Groups let you tag where contacts came from (Bunco, Church, Open House). Create one here, then add contacts to it from the list or the contact form.
            </div>
            {groupList.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: 13, padding: 20, textAlign: "center" }}>No groups yet. Click "+ New Group".</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {groupList.map(g => (
                  <div key={g.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                    <button onClick={() => { setFilter(f => ({ ...f, group: g.name })); setShowGroups(false); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#0c4a6e", textAlign: "left" }}>
                      {g.name} <span style={{ color: "#6b7280", fontWeight: 400 }}>· {g.count} contact{g.count === 1 ? "" : "s"}</span>
                    </button>
                    <button onClick={() => deleteGroup(g.name)} title="Delete group" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#b91c1c", fontSize: 13 }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowGroups(false)} style={btnStyle("#e5e7eb", "#374151")}>Close</button>
            </div>
          </div>
        </div>
      )}
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
      {showCampaign && <CampaignModal token={token} groupList={groupList} onClose={() => setShowCampaign(false)} />}
    </div>
  );
}
