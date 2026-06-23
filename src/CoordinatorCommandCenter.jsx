import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// COORDINATOR DAILY PLAN + OVERVIEW (banner above the unified deal list).
// The per-deal work lives in ONE comprehensive card per transaction in the deal
// list below (Win-the-Day, enriched) — this banner is just: a one-line status
// summary + the approve-first autopilot ("here's what I'll send today") + a
// collapsed count of the deals that are on track. No per-deal cards here, so a
// transaction never appears twice.
export default function CoordinatorCommandCenter({ token, onOpenTransaction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnTrack, setShowOnTrack] = useState(false);
  const [plan, setPlan] = useState([]);          // grouped by deal: {txId, address, lines:[]}
  const [skip, setSkip] = useState({});           // txId -> true means "don't send this one"
  const [doing, setDoing] = useState(false);
  const [planMsg, setPlanMsg] = useState(null);

  const load = () => {
    // The per-deal cards live in the Win-the-Day list below this banner — tell it
    // to reload too, so Refresh visibly updates the whole screen, not just here.
    try { window.dispatchEvent(new Event("wintheday:refresh")); } catch (e) {}
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

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "8px 16px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🧭 Command Center</div>
        <button onClick={load} style={{ background: "none", border: "1px solid " + C.border, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: C.gray, cursor: "pointer", fontFamily: "inherit" }}>↻ Refresh</button>
      </div>
      <div style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>
        {data.needsYouCount === 0
          ? `All ${data.total} of your transactions are on track — the app is handling them. Nothing needs you right now. ✅`
          : `${data.needsYouCount} of your ${data.total} transactions need a look. The other ${data.onTrackCount} are on track and handled.`}
      </div>

      {/* (New-messages alert now renders ABOVE this banner, from the home — shared
          UnreadMessagesInbox — so it shows reliably for the TC and the agent.) */}

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

      {data.needsYouCount > 0 && (
        <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, letterSpacing: 0.4, textTransform: "uppercase" }}>
          Deals that need you — most urgent first
        </div>
      )}
    </div>
  );
}
