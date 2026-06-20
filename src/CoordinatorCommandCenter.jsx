import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// THE COORDINATOR COMMAND CENTER — exception-based oversight.
// The AI runs every deal; this surfaces only the ones that need a human, ranked
// by risk, so one person can oversee hundreds. Green/handled deals stay collapsed.
export default function CoordinatorCommandCenter({ token, onOpenTransaction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnTrack, setShowOnTrack] = useState(false);
  // Approve-first plan: the app shows what it will send; the TC presses "Do it".
  const [plan, setPlan] = useState([]);          // grouped by deal: {txId, address, lines:[]}
  const [skip, setSkip] = useState({});           // txId -> true means "don't send this one"
  const [doing, setDoing] = useState(false);
  const [planMsg, setPlanMsg] = useState(null);

  const load = () => {
    fetch(API + "/tc/command-center", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d && d.success ? d : null); setLoading(false); })
      .catch(() => { setLoading(false); });
    fetch(API + "/tc/action-plan", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const byDeal = new Map();
        (d && d.actions || []).forEach(a => {
          if (!byDeal.has(a.txId)) byDeal.set(a.txId, { txId: a.txId, address: a.address, lines: [] });
          byDeal.get(a.txId).lines.push(`${a.summary} — ${a.detail}`);
        });
        setPlan(Array.from(byDeal.values()));
      })
      .catch(() => setPlan([]));
  };
  useEffect(() => { load(); /* refresh when the tab regains focus */
    const h = () => load(); window.addEventListener("focus", h);
    return () => window.removeEventListener("focus", h);
  }, []);

  const [handled, setHandled] = useState([]);   // {txId, label, undo} done this session
  const [busy, setBusy] = useState(null);        // `${txId}:${action}` in flight
  const [toast, setToast] = useState(null);

  const removeDeal = (txId) => setData(d => d ? ({ ...d, needsYou: d.needsYou.filter(x => x.txId !== txId), needsYouCount: Math.max(0, d.needsYouCount - 1) }) : d);
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  // Run a per-card action, then move the deal into "handled today".
  const act = async (deal, action, path, body, label, undo) => {
    setBusy(`${deal.txId}:${action}`);
    try {
      const r = await fetch(API + path, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body || {}),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't do that");
      removeDeal(deal.txId);
      setHandled(h => [{ txId: deal.txId, label, undo }, ...h]);
      flash("✅ " + label);
    } catch (e) { flash("⚠️ " + e.message); }
    setBusy(null);
  };
  const sendReminder = (deal) => act(deal, "remind", "/tc/action-plan/execute", { txIds: [deal.txId] }, `Sent reminders — ${deal.address}`);
  const sendFix = (deal) => act(deal, "fix", `/tc/transaction/${deal.txId}/send-deal-doctor-draft`, {}, `Sent the recommended message — ${deal.address}`);
  const requestDoc = (deal) => act(deal, "doc", `/tc/transaction/${deal.txId}/request-document`, {}, `Requested documents — ${deal.address}`);
  const snooze = (deal) => act(deal, "snooze", `/tc/transaction/${deal.txId}/snooze`, {}, `Snoozed to tomorrow — ${deal.address}`,
    () => fetch(API + `/tc/transaction/${deal.txId}/snooze`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ undo: true }) }));
  const undoHandled = async (item) => { try { if (item.undo) await item.undo(); } catch {} setHandled(h => h.filter(x => x !== item)); load(); };

  const approvedTxIds = plan.filter(p => !skip[p.txId]).map(p => p.txId);
  const doIt = async () => {
    if (approvedTxIds.length === 0) return;
    setDoing(true); setPlanMsg(null);
    try {
      const r = await fetch(API + "/tc/action-plan/execute", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ txIds: approvedTxIds }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Failed");
      setPlanMsg(`✅ Done — sent ${d.emails} email${d.emails === 1 ? "" : "s"} across ${d.deals} deal${d.deals === 1 ? "" : "s"}.`);
      setPlan([]); setSkip({});
      setTimeout(load, 800);
    } catch (e) { setPlanMsg("⚠️ " + e.message); }
    setDoing(false);
  };

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

      {/* APPROVE-FIRST PLAN — the app shows what it'll send; you press "Do it". */}
      {plan.length > 0 && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1E3A8A", marginBottom: 4 }}>🤖 Here's what I'll send today</div>
          <div style={{ fontSize: 12.5, color: "#1E40AF", marginBottom: 12 }}>Review and tap “Do it” — I'll handle the outreach for you. Uncheck any deal you want to hold.</div>
          {plan.map(p => (
            <div key={p.txId} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: "1px solid #DBEAFE" }}>
              <input type="checkbox" checked={!skip[p.txId]} onChange={e => setSkip(s => ({ ...s, [p.txId]: !e.target.checked }))} style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1a2332" }}>{p.address}</div>
                {p.lines.map((l, i) => <div key={i} style={{ fontSize: 12.5, color: "#475569", marginTop: 2 }}>• {l}</div>)}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={doIt} disabled={doing || approvedTxIds.length === 0}
              style={{ background: doing || approvedTxIds.length === 0 ? "#93C5FD" : "#1E8449", color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 15, fontWeight: 800, cursor: doing ? "wait" : "pointer", fontFamily: "inherit" }}>
              {doing ? "Sending…" : `✅ Okay, do it (${approvedTxIds.length} deal${approvedTxIds.length === 1 ? "" : "s"})`}
            </button>
            <span style={{ fontSize: 12, color: "#1E40AF" }}>Nothing goes out until you approve.</span>
          </div>
          {planMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: planMsg.startsWith("✅") ? "#166534" : "#991B1B" }}>{planMsg}</div>}
        </div>
      )}
      {planMsg && plan.length === 0 && <div style={{ marginBottom: 14, fontSize: 13, fontWeight: 700, color: planMsg.startsWith("✅") ? "#166534" : "#991B1B" }}>{planMsg}</div>}

      {/* Toast confirmation so an action never feels like the card just vanished. */}
      {toast && <div style={{ position: "sticky", top: 0, zIndex: 5, background: toast.startsWith("✅") ? "#DCFCE7" : "#FEE2E2", color: toast.startsWith("✅") ? "#166534" : "#991B1B", border: "1px solid " + (toast.startsWith("✅") ? "#86EFAC" : "#FCA5A5"), borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{toast}</div>}

      {/* NEEDS YOU — ranked exception queue, each card resolvable in one tap */}
      {data.needsYou.map(d => {
        const accent = d.health === "red" || d.overdue > 0 ? C.red : "#D97706";
        const isBusy = (act) => busy === `${d.txId}:${act}`;
        const primaryBtn = { background: "#0F6E56", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
        const ghostBtn = { background: "none", border: "1px solid " + C.border, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#334155", cursor: "pointer", fontFamily: "inherit" };
        return (
          <div key={d.txId} style={{ background: C.card, border: "1px solid " + C.border, borderLeft: "4px solid " + accent, borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
              {healthDot(d.health)}
              <span style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>{d.address}</span>
              <span style={{ fontSize: 12, color: C.gray }}>· {d.status}</span>
              {d.closingDate && <span style={{ marginLeft: "auto", fontSize: 12, color: C.gray }}>closing {d.closingDate}</span>}
            </div>
            <div style={{ fontSize: 14, color: "#1a2332", marginTop: 8, fontWeight: 600 }}>{d.reason}</div>
            {d.hasDraft && <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>🤖 A ready-to-send message is drafted for the {d.draftToRole}.</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {d.overdue > 0 && chip(`${d.overdue} overdue`, C.red)}
              {d.docGaps > 0 && chip(`${d.docGaps} missing doc${d.docGaps === 1 ? "" : "s"}`, "#7C3AED")}
              {d.unreadReplies > 0 && chip(`${d.unreadReplies} unread repl${d.unreadReplies === 1 ? "y" : "ies"}`, "#0EA5E9")}
              {d.dueSoon > 0 && chip(`${d.dueSoon} due soon`, "#D97706")}
            </div>
            {/* The actions that actually take care of it */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {d.hasDraft && <button disabled={!!busy} onClick={() => sendFix(d)} style={primaryBtn}>{isBusy("fix") ? "Sending…" : "✉️ Do this — send it"}</button>}
              {!d.hasDraft && (d.overdue > 0 || d.dueSoon > 0 || d.daysSinceActivity >= 10) && <button disabled={!!busy} onClick={() => sendReminder(d)} style={primaryBtn}>{isBusy("remind") ? "Sending…" : "Send reminder"}</button>}
              {d.docGaps > 0 && <button disabled={!!busy} onClick={() => requestDoc(d)} style={d.hasDraft ? ghostBtn : primaryBtn}>{isBusy("doc") ? "Sending…" : "Request document"}</button>}
              {d.unreadReplies > 0 && <button disabled={!!busy} onClick={() => onOpenTransaction && onOpenTransaction(d.txId, "replies")} style={ghostBtn}>Read &amp; reply</button>}
              <button disabled={!!busy} onClick={() => onOpenTransaction && onOpenTransaction(d.txId)} style={ghostBtn}>Open deal</button>
              <button disabled={!!busy} onClick={() => snooze(d)} style={ghostBtn}>{isBusy("snooze") ? "…" : "Not today"}</button>
            </div>
          </div>
        );
      })}

      {/* HANDLED TODAY — proof it was taken care of, with undo (not just vanished). */}
      {handled.length > 0 && (
        <div style={{ background: "#F8FAFC", border: "1px solid " + C.border, borderRadius: 12, padding: "12px 14px", margin: "8px 0" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#166534", marginBottom: 6 }}>✓ Handled today ({handled.length})</div>
          {handled.map((h, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: i ? "1px solid #EEF2F6" : "none", fontSize: 13 }}>
              <span style={{ color: "#16A34A" }}>✓</span>
              <span style={{ color: "#1a2332" }}>{h.label}</span>
              {h.undo && <button onClick={() => undoHandled(h)} style={{ marginLeft: "auto", background: "none", border: "none", color: C.gray, textDecoration: "underline", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Undo</button>}
            </div>
          ))}
        </div>
      )}

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
