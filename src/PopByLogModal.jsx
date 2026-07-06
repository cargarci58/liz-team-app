import { useState, useEffect, useRef } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";
const lbl = { display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4 };
const inp = { width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
const cname = (c) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "(no name)";

// Log a pop-by delivered to ANY contact. Used from the Pop-Bys page (no preset —
// shows a contact search) and from a contact's profile (contact preset). Saves to
// the contact's history + resets their pop-by cadence.
export default function PopByLogModal({ token, contact: presetContact, onClose, onSaved }) {
  const [contact, setContact] = useState(presetContact || null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [gift, setGift] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const tRef = useRef(null);

  useEffect(() => {
    if (contact || !search.trim()) { setResults([]); return; }
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => {
      fetch(API + "/contacts?search=" + encodeURIComponent(search.trim()), { headers: { Authorization: "Bearer " + token } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { const all = (d && d.contacts) || []; setResults(all.slice(0, 8).concat(all.length > 8 ? [{ id: "__more__", _more: all.length - 8 }] : [])); })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(tRef.current);
  }, [search, contact]);

  const save = async () => {
    if (!contact) { setErr("Pick a contact first."); return; }
    if (!gift.trim()) { setErr("Add what you gave."); return; }
    setSaving(true); setErr("");
    try {
      const r = await fetch(API + "/contacts/" + contact.id + "/pop-by", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ gift: gift.trim(), note: note.trim(), deliveredAt: date }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't save that");
      onSaved && onSaved(contact);
      onClose();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 5000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 460, margin: "auto", padding: 20, boxShadow: "0 10px 40px rgba(0,0,0,0.2)", fontFamily: "inherit" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 4 }}>🎁 Log a Pop-By</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Record a gift you dropped off. It saves to that contact's history.</div>

        <label style={lbl}>Contact</label>
        {contact ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, marginBottom: 14 }}>
            <span style={{ fontWeight: 700, color: "#111", flex: 1 }}>{cname(contact)}</span>
            {!presetContact && <button onClick={() => { setContact(null); setSearch(""); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", textDecoration: "underline", fontSize: 12, fontFamily: "inherit" }}>change</button>}
          </div>
        ) : (
          <div style={{ position: "relative", marginBottom: 14 }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a contact by name…" style={inp} />
            {results.length > 0 && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: "auto" }}>
                {results.map(c => c._more ? (
                  <div key="__more__" style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                    …and {c._more} more match{c._more === 1 ? "" : "es"} — keep typing to narrow it down
                  </div>
                ) : (
                  <div key={c.id} onClick={() => { setContact(c); setResults([]); }} style={{ padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}>
                    {cname(c)}{c.phone && <span style={{ color: "#9ca3af", fontSize: 12 }}> · {c.phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <label style={lbl}>What you gave</label>
        <input value={gift} onChange={e => setGift(e.target.value)} placeholder="e.g. Pumpkin + a handwritten note" style={{ ...inp, marginBottom: 14 }} />

        <label style={lbl}>When delivered</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, marginBottom: 14 }} />

        <label style={lbl}>Note (optional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Anything to remember…" style={{ ...inp, marginBottom: 14, resize: "vertical" }} />

        {err && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff", color: "#6b7280", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button disabled={saving} onClick={save} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#0F6E56", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "wait" : "pointer", fontFamily: "inherit" }}>{saving ? "Saving…" : "Save pop-by"}</button>
        </div>
      </div>
    </div>
  );
}
