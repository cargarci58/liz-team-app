import { useState } from "react";
import { t as tr } from "../i18n";

const API = "https://liz-team-server-api-production.up.railway.app";

// Deal Overview line: when the listing / buyer agreement expires, with a way to
// change it right here when it's extended (Carlos 10/5). Same save path as the
// Win-the-Day card and the calendar.
export default function AgreementExpiryStrip({ tx }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  if (!tx || /^(closed|cancelled)$/i.test(tx.status || "")) return null;

  const buyer = /buyer|tenant/i.test(tx.type || "");
  const label = buyer ? tr("Buyer agreement") : tr("Listing agreement");
  const exp = tx.representationExpiresOn ? String(tx.representationExpiresOn).slice(0, 10) : "";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const days = exp ? Math.round((new Date(exp + "T00:00:00Z") - new Date(today + "T00:00:00Z")) / 86400000) : null;
  const fromAi = exp && tx.representationExpiresSource === "ai";
  const pretty = exp ? new Date(exp + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";

  const tone = !exp ? { bg: "#FEF9C3", border: "#FDE047", color: "#713F12" }
    : days < 0 || days <= 7 ? { bg: "#FEF2F2", border: "#FCA5A5", color: "#991B1B" }
    : days <= 30 ? { bg: "#FFF7ED", border: "#FDBA74", color: "#9A3412" }
    : { bg: "#F8FAFC", border: "#E2E8F0", color: "#334155" };

  const save = async (value) => {
    if (!value || saving) return;
    setSaving(true);
    try {
      const r = await fetch(API + "/transactions/" + tx.id + "/agreement-expiration", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") },
        body: JSON.stringify({ date: value }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not save the date.");
      setEditing(false);
      try { window.dispatchEvent(new CustomEvent("deals:refresh")); window.dispatchEvent(new CustomEvent("wintheday:refresh")); } catch { /* ignore */ }
    } catch (e) { alert(e.message || tr("Could not save the date.")); }
    setSaving(false);
  };

  const btn = { background: "#fff", border: "1px solid #CBD5E1", borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 700, color: "#0c4a6e", cursor: "pointer", fontFamily: "inherit" };
  return (
    <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14, color: tone.color }}>
      <span style={{ fontWeight: 700 }}>🏁 {label}</span>
      {!exp ? (
        <span>{tr("— no expiration date saved, so you won't get a warning before it lapses.")}</span>
      ) : (
        <span>
          {days < 0 ? tr("EXPIRED on {date}", { date: pretty })
            : days === 0 ? tr("expires TODAY ({date})", { date: pretty })
            : tr("expires {date} · in {n} days", { date: pretty, n: days })}
          {!buyer && days < 0 ? tr(" — not on the MLS") : ""}
          {fromAi ? tr(" · read from the signed agreement") : ""}
        </span>
      )}
      <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {editing ? (
          <>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} autoFocus
              style={{ padding: "5px 8px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
            <button onClick={() => save(date)} disabled={saving || !date} style={{ ...btn, background: "#0c4a6e", color: "#fff", border: "none", opacity: saving || !date ? 0.6 : 1 }}>{saving ? tr("Saving…") : tr("Save")}</button>
            <button onClick={() => setEditing(false)} style={{ ...btn, color: "#475569" }}>{tr("Cancel")}</button>
          </>
        ) : (
          <>
            {fromAi && <button onClick={() => save(exp)} disabled={saving} style={{ ...btn, color: "#166534" }}>{tr("✓ Correct")}</button>}
            <button onClick={() => { setDate(exp || ""); setEditing(true); }} style={btn}>{exp ? tr("✏️ Change") : tr("➕ Add the date")}</button>
          </>
        )}
      </span>
    </div>
  );
}
