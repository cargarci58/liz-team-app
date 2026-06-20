import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const C = { card: "#fff", border: "#E5E7EB", navy: "#0F2044", gray: "#64748B", green: "#16A34A", red: "#DC2626", amber: "#D97706" };
const healthColor = (h) => h === "red" ? C.red : h === "yellow" ? C.amber : h === "green" ? C.green : "#CBD5E1";
const dot = (h) => <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: healthColor(h), flexShrink: 0 }} title={h || "no health read yet"} />;
function ago(d) {
  if (!d) return "";
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 3600) return Math.round(s / 60) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  return Math.round(s / 86400) + "d ago";
}
// Human label for a coordinator activity-log row (kept generic — actions vary).
const actionVerb = (a) => ({
  document_requested: "📎 Requested a document",
  coordinator_message: "✉️ Emailed a party",
  coordinator_autopilot: "✅ Sent today's reminders",
  milestone_completed: "✔️ Completed a step",
  milestone_reopened: "↩️ Reopened a step",
  document_uploaded: "📄 Uploaded a document",
  party_added: "👤 Added a party",
  party_updated: "✏️ Updated a party",
}[a] || "🧭 Took an action");

// ── PER-DEAL SUMMARY (agent's Overview tab, for a TC-handled deal) ────────────
export function CoordinatorSummaryPanel({ txId, token }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let stop = false;
    fetch(API + "/transactions/" + txId + "/coordinator-summary", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!stop) { setD(j && j.success ? j : null); setLoading(false); } })
      .catch(() => { if (!stop) setLoading(false); });
    return () => { stop = true; };
  }, [txId]);
  if (loading) return null;
  if (!d || !d.coordinatorName) return null; // not coordinated → nothing to show
  const pct = d.progress.total > 0 ? Math.round(d.progress.done / d.progress.total * 100) : 0;
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderLeft: "4px solid " + healthColor(d.health), borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {dot(d.health)}
        <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>🧭 Handled by your coordinator</span>
        <span style={{ fontSize: 13, color: C.gray }}>· {d.coordinatorName}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.gray }}>{d.progress.done} of {d.progress.total} steps done</span>
      </div>
      <div style={{ height: 8, background: "#EEF2F6", borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ width: pct + "%", height: "100%", background: C.green }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} data-keep-grid="">
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>✅ Done recently</div>
          {d.doneRecently.length === 0 ? <div style={{ fontSize: 13, color: C.gray }}>Nothing completed yet.</div> :
            d.doneRecently.map((m, i) => (
              <div key={i} style={{ fontSize: 13, color: "#1a2332", padding: "3px 0" }}>✓ {m.name}{m.completedAt ? <span style={{ color: C.gray }}> · {ago(m.completedAt)}</span> : null}</div>
            ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>⏳ What's left / next</div>
          {d.upcoming.length === 0 ? <div style={{ fontSize: 13, color: C.gray }}>Nothing outstanding.</div> :
            d.upcoming.map((m, i) => (
              <div key={i} style={{ fontSize: 13, color: "#1a2332", padding: "3px 0" }}>• {m.name}{m.dueDate ? <span style={{ color: C.gray }}> · due {m.dueDate}</span> : <span style={{ color: C.gray }}> · no date</span>}</div>
            ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>🧭 What {d.coordinatorName} has done</div>
        {d.tcActivity.length === 0 ? <div style={{ fontSize: 13, color: C.gray }}>No coordinator activity logged yet.</div> :
          d.tcActivity.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#1a2332", padding: "4px 0", borderTop: i ? "1px solid #F1F5F9" : "none" }}>
              <span>{actionVerb(a.action)}</span>
              {a.details && <span style={{ color: C.gray, flex: 1, minWidth: 0 }}>— {a.details}</span>}
              <span style={{ color: C.gray, marginLeft: "auto", whiteSpace: "nowrap" }}>{ago(a.at)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// A deal "needs a look" when something is off or imminent — overdue, an unhealthy
// AI read, or a deadline due today/tomorrow. Everything else is on track.
const deskNeedsLook = (d) => d.overdue > 0 || d.health === "red" || d.health === "yellow" ||
  (d.nextWhen && /today|tomorrow/.test(d.nextWhen));

function DeskRow({ d, onOpenTransaction }) {
  return (
    <div onClick={() => onOpenTransaction && onOpenTransaction(d.txId)}
      style={{ background: C.card, border: "1px solid " + C.border, borderLeft: "4px solid " + healthColor(d.health), borderRadius: 12, padding: 14, marginBottom: 10, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {dot(d.health)}
        <span style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>{d.address}</span>
        <span style={{ fontSize: 12, color: C.gray }}>· {d.status}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.gray }}>{d.msDone}/{d.msTotal} done</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {d.overdue > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: C.red, borderRadius: 20, padding: "2px 9px" }}>{d.overdue} overdue</span>}
        {d.nextName && <span style={{ fontSize: 12, color: "#1a2332" }}>Next: <b>{d.nextName}</b>{d.nextWhen ? " · " + d.nextWhen : ""}</span>}
        {d.closingDate && <span style={{ fontSize: 12, color: C.gray }}>· closing {d.closingDate}</span>}
      </div>
      {d.lastTcAction && (
        <div style={{ fontSize: 12, color: C.gray, marginTop: 6 }}>
          Last: {actionVerb(d.lastTcAction.action)}{d.lastTcAction.details ? " — " + d.lastTcAction.details : ""} · {ago(d.lastTcAction.at)}
        </div>
      )}
    </div>
  );
}

// ── COORDINATOR DESK (agent home roll-up of every TC-handled deal) ────────────
// Oversight, not action: collapsed by default, surfaces only the deals that need
// a look, and tucks the on-track ones behind a count. Sits BELOW the agent's day.
export function AgentCoordinatorDesk({ token, onOpenTransaction }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [showOk, setShowOk] = useState(false);
  const load = () => {
    fetch(API + "/agent/coordinator-desk", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(j => setData(j && j.success ? j : null))
      .catch(() => {});
  };
  useEffect(() => { load(); const h = () => load(); window.addEventListener("focus", h); return () => window.removeEventListener("focus", h); }, []);
  if (!data || data.total === 0) return null; // no TC-handled deals → hide entirely
  const needLook = data.deals.filter(deskNeedsLook);
  const onTrack = data.deals.filter(d => !deskNeedsLook(d));
  return (
    <div style={{ maxWidth: 920, margin: "16px auto 0", padding: "0 16px" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", textAlign: "left", background: "#F8FAFC", border: "1px solid " + C.border, borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>🧭 Coordinator Desk</span>
        <span style={{ fontSize: 13, color: C.gray }}>
          {data.total} deal{data.total === 1 ? "" : "s"} with your TC · {needLook.length > 0 ? <b style={{ color: C.red }}>{needLook.length} need a look</b> : "all on track ✅"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: C.gray }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {needLook.map(d => <DeskRow key={d.txId} d={d} onOpenTransaction={onOpenTransaction} />)}
          {onTrack.length > 0 && (
            <>
              <button onClick={() => setShowOk(s => !s)} style={{ width: "100%", textAlign: "left", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#166534", cursor: "pointer", fontFamily: "inherit" }}>
                ✅ {onTrack.length} on track & handled by your TC {showOk ? "▲" : "▼"}
              </button>
              {showOk && <div style={{ marginTop: 10 }}>{onTrack.map(d => <DeskRow key={d.txId} d={d} onOpenTransaction={onOpenTransaction} />)}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
