import { useState, useEffect } from "react";
import { CALL_SCRIPT_GROUPS, CALL_OBJECTIONS, recommendCallScriptKeys, fillCallScript } from "../config/callScripts";

const API = "https://liz-team-server-api-production.up.railway.app";

// 📜 Scripts button for call screens (Log Call popup, Win-the-Day call list,
// Follow-Up Review). Opens a side panel the agent can read WHILE on the phone:
// the script that fits this contact first, then objection quick-answers, then
// the agent's own saved call scripts. Wording lives in config/callScripts.js.
export function CallScriptsButton({ contact, token, compact }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(true); }}
        style={{ background: "#fff", color: "#7c2d12", border: "1px solid #fdba74", borderRadius: 8,
          padding: compact ? "4px 10px" : "7px 14px", fontSize: compact ? 11 : 12.5, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        📜 Scripts
      </button>
      {open && <CallScriptPanel contact={contact} token={token} onClose={() => setOpen(false)} />}
    </>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { try { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch (e) {} }}
      style={{ flexShrink: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 9px",
        fontSize: 11, fontWeight: 700, color: done ? "#15803d" : "#555", cursor: "pointer", fontFamily: "inherit" }}>
      {done ? "✓ Copied" : "📋 Copy"}
    </button>
  );
}

export default function CallScriptPanel({ contact, token, onClose }) {
  const recommended = recommendCallScriptKeys(contact);
  const [groupKey, setGroupKey] = useState(recommended[0]);
  const [openObjection, setOpenObjection] = useState(null);
  const [mine, setMine] = useState([]);
  useEffect(() => {
    fetch(API + "/scripts", { headers: { Authorization: "Bearer " + (token || "") } })
      .then(r => r.json()).then(d => { if (d && d.success) setMine((d.scripts || []).filter(s => s.side === "calls")); })
      .catch(() => {});
  }, []);

  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "this contact";
  const group = CALL_SCRIPT_GROUPS.find(g => g.key === groupKey) || CALL_SCRIPT_GROUPS[0];
  const ordered = [
    ...recommended.map(k => CALL_SCRIPT_GROUPS.find(g => g.key === k)).filter(Boolean),
    ...CALL_SCRIPT_GROUPS.filter(g => !recommended.includes(g.key)),
  ];
  const fill = (t) => fillCallScript(t, contact);
  const section = { fontSize: 11, fontWeight: 800, color: "#7c2d12", textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 8px" };

  return (
    // Right-side sheet (full width on phones) so the agent can read while they talk.
    <div onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 4700, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "flex-end" }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 440, height: "100%", overflowY: "auto", boxShadow: "-8px 0 30px rgba(0,0,0,0.2)", fontFamily: "inherit" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 1, background: "#7c2d12", color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>📜 Call scripts</div>
            <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Calling {name}</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
        </div>

        <div style={{ padding: "4px 16px 40px" }}>
          <div style={section}>Pick the kind of call</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ordered.map(g => {
              const on = g.key === group.key;
              const sug = recommended.includes(g.key);
              return (
                <button type="button" key={g.key} onClick={() => setGroupKey(g.key)}
                  style={{ padding: "6px 10px", borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    border: `1.5px solid ${on ? "#7c2d12" : sug ? "#fdba74" : "#e5e7eb"}`,
                    background: on ? "#7c2d12" : sug ? "#fff7ed" : "#fff", color: on ? "#fff" : "#374151" }}>
                  {sug ? "⭐ " : ""}{g.situation}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>⭐ = suggested for {contact?.first_name || "this contact"}</div>

          <div style={{ marginTop: 14, fontSize: 15, fontWeight: 800, color: "#111" }}>{group.situation}</div>
          {group.why && <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 3, lineHeight: 1.45 }}>{group.why}</div>}
          {group.scripts.map((s, i) => (
            <div key={i} style={{ background: "#F9FAFB", border: "1px solid #e5e7eb", borderLeft: "3px solid #C0392B", borderRadius: 8, padding: "10px 12px", marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#922B21" }}>{i + 1}. {s.title}</div>
                <CopyBtn text={fill(s.body)} />
              </div>
              <div style={{ fontSize: 14.5, color: "#111", lineHeight: 1.6 }}>{fill(s.body)}</div>
            </div>
          ))}

          <div style={section}>💬 When they say…</div>
          {CALL_OBJECTIONS.map((o, i) => {
            const isOpen = openObjection === i;
            return (
              <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 6, overflow: "hidden" }}>
                <button type="button" onClick={() => setOpenObjection(isOpen ? null : i)}
                  style={{ width: "100%", textAlign: "left", background: isOpen ? "#fff7ed" : "#fff", border: "none", padding: "10px 12px", fontSize: 13.5, fontWeight: 700, color: "#111", cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>{o.says}</span><span style={{ color: "#9ca3af" }}>{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 12px 12px", background: "#fff7ed" }}>
                    <div style={{ fontSize: 14, color: "#111", lineHeight: 1.6 }}>{fill(o.answer)}</div>
                  </div>
                )}
              </div>
            );
          })}

          <div style={section}>⭐ My call scripts</div>
          {mine.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#9ca3af", fontStyle: "italic" }}>None yet — add your own on the Scripts page, “📞 Calls” tab.</div>
          ) : mine.map(s => (
            <div key={s.id} style={{ background: "#F9FAFB", border: "1px dashed #C0392B", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#922B21" }}>{s.title || s.situation || "My script"}</div>
                <CopyBtn text={fill(s.body)} />
              </div>
              <div style={{ fontSize: 14.5, color: "#111", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{fill(s.body)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
