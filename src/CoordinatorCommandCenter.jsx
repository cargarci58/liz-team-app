import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// THE COORDINATOR COMMAND CENTER — exception-based oversight.
// The AI runs every deal; this surfaces only the ones that need a human, ranked
// by risk, so one person can oversee hundreds. Green/handled deals stay collapsed.
export default function CoordinatorCommandCenter({ token, onOpenTransaction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnTrack, setShowOnTrack] = useState(false);

  const load = () => {
    fetch(API + "/tc/command-center", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d && d.success ? d : null); setLoading(false); })
      .catch(() => { setLoading(false); });
  };
  useEffect(() => { load(); /* refresh when the tab regains focus */
    const h = () => load(); window.addEventListener("focus", h);
    return () => window.removeEventListener("focus", h);
  }, []);

  if (loading) return <div style={{ padding: 20, color: "#64748B", fontSize: 14 }}>Loading your command center…</div>;
  if (!data) return null;

  const healthDot = (h) => {
    const c = h === "red" ? "#DC2626" : h === "yellow" ? "#D97706" : h === "green" ? "#16A34A" : "#CBD5E1";
    return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0 }} title={h || "no health read yet"} />;
  };
  const C = { card: "#fff", border: "#E5E7EB", navy: "#0F2044", red: "#DC2626", gray: "#64748B" };

  const chip = (label, color) => (
    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: color, borderRadius: 20, padding: "2px 9px" }}>{label}</span>
  );

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "8px 16px 24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🧭 Command Center</div>
        <button onClick={load} style={{ background: "none", border: "1px solid " + C.border, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: C.gray, cursor: "pointer", fontFamily: "inherit" }}>↻ Refresh</button>
      </div>
      <div style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>
        {data.needsYouCount === 0
          ? `All ${data.total} of your transactions are on track — the app is handling them. Nothing needs you right now. ✅`
          : `${data.needsYouCount} of your ${data.total} transactions need a look. The other ${data.onTrackCount} are on track and handled.`}
      </div>

      {/* NEEDS YOU — ranked exception queue */}
      {data.needsYou.map(d => {
        const accent = d.health === "red" || d.overdue > 0 ? C.red : "#D97706";
        return (
          <div key={d.txId} style={{ background: C.card, border: "1px solid " + C.border, borderLeft: "4px solid " + accent, borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                {healthDot(d.health)}
                <span style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>{d.address}</span>
                <span style={{ fontSize: 12, color: C.gray }}>· {d.status}</span>
              </div>
              <button onClick={() => onOpenTransaction && onOpenTransaction(d.txId)} style={{ background: C.navy, color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Open →</button>
            </div>
            <div style={{ fontSize: 14, color: "#1a2332", marginTop: 8, fontWeight: 600 }}>{d.reason}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {d.overdue > 0 && chip(`${d.overdue} overdue`, C.red)}
              {d.docGaps > 0 && chip(`${d.docGaps} missing doc${d.docGaps === 1 ? "" : "s"}`, "#7C3AED")}
              {d.unreadReplies > 0 && chip(`${d.unreadReplies} unread repl${d.unreadReplies === 1 ? "y" : "ies"}`, "#0EA5E9")}
              {d.dueSoon > 0 && chip(`${d.dueSoon} due soon`, "#D97706")}
              {d.closingDate && chip(`Closing ${d.closingDate}`, "#475569")}
            </div>
          </div>
        );
      })}

      {/* ON TRACK — collapsed by default; the app's got these */}
      {data.onTrackCount > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowOnTrack(s => !s)} style={{ width: "100%", textAlign: "left", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 14px", fontSize: 14, fontWeight: 700, color: "#166534", cursor: "pointer", fontFamily: "inherit" }}>
            ✅ {data.onTrackCount} on track & handled {showOnTrack ? "▲" : "▼"}
          </button>
          {showOnTrack && (
            <div style={{ marginTop: 8 }}>
              {data.onTrack.map(d => (
                <div key={d.txId} onClick={() => onOpenTransaction && onOpenTransaction(d.txId)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #F1F5F9", cursor: "pointer", fontSize: 13 }}>
                  {healthDot(d.health)}
                  <span style={{ fontWeight: 600, color: "#1a2332" }}>{d.address}</span>
                  <span style={{ color: C.gray }}>· {d.status}</span>
                  {d.closingDate && <span style={{ marginLeft: "auto", color: C.gray, fontSize: 12 }}>Closing {d.closingDate}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
