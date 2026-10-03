import { t as tr, locale as uiLocale } from "./i18n";
import { useState, useEffect, useRef } from "react";
import ReminderPlanReview from "./ReminderPlanReview";

const API = "https://liz-team-server-api-production.up.railway.app";

// COORDINATOR DAILY PLAN + OVERVIEW (banner above the unified deal list).
// The per-deal work lives in ONE comprehensive card per transaction in the deal
// list below (Win-the-Day, enriched) — this banner is just: a one-line status
// summary + the approve-first autopilot ("here's what I'll send today", every
// message previewable/editable/holdable) + a count of the deals that are on
// track. No per-deal cards here, so a transaction never appears twice.
export default function CoordinatorCommandCenter({ token, onOpenTransaction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [planKey, setPlanKey] = useState(0);        // bump → the review list reloads
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const planDone = useRef(null);                    // resolves when the review list finished loading

  // silent = background refresh (tab focus / after a send): no button spinner and
  // the review list is NOT reloaded, so a TC's half-done edits/unchecks survive
  // switching windows. The Refresh button reloads everything.
  const load = (silent) => {
    // The per-deal cards live in the Win-the-Day list below this banner — tell it
    // to reload too, so Refresh visibly updates the whole screen, not just here.
    try { window.dispatchEvent(new Event("wintheday:refresh")); } catch (e) {}
    if (!silent) setRefreshing(true);
    const planLoaded = silent ? Promise.resolve() : Promise.race([
      new Promise(res => { planDone.current = res; }), new Promise(r => setTimeout(r, 15000)),
    ]);
    if (!silent) setPlanKey(k => k + 1);
    const cc = fetch(API + "/tc/command-center", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d && d.success ? d : null); setLoading(false); })
      .catch(() => { setLoading(false); });
    // Keep the spinner up at least briefly so a fast refresh is still visible.
    if (silent) return;
    Promise.all([cc, planLoaded, new Promise(r => setTimeout(r, 600))]).then(() => {
      setRefreshing(false);
      setUpdatedAt(new Date());
    });
  };
  useEffect(() => { load(true); /* refresh when the tab regains focus */
    const h = () => load(true); window.addEventListener("focus", h);
    return () => window.removeEventListener("focus", h);
    // eslint-disable-next-line
  }, []);

  if (loading) return <div style={{ padding: 20, color: "#64748B", fontSize: 14 }}>{tr("Loading your command center…")}</div>;
  if (!data) return null;

  const C = { card: "#fff", border: "#E5E7EB", navy: "#0F2044", red: "#DC2626", gray: "#64748B" };
  const timeLabel = updatedAt ? updatedAt.toLocaleTimeString(uiLocale(), { hour: "numeric", minute: "2-digit" }) : null;

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "8px 16px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>{tr("🧭 Command Center")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {timeLabel && !refreshing && <span style={{ fontSize: 11.5, color: "#166534", fontWeight: 600 }}>{tr("✓ Updated")} {timeLabel}</span>}
          <button onClick={() => load(false)} disabled={refreshing}
            style={{ background: refreshing ? "#F4F4F4" : "none", border: "1px solid " + C.border, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: C.gray, cursor: refreshing ? "wait" : "pointer", fontFamily: "inherit" }}>
            {refreshing ? tr("↻ Refreshing…") : tr("↻ Refresh")}
          </button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>
        {data.needsYouCount === 0
          ? tr("All {total} of your transactions are on track — the app is handling them. Nothing needs you right now. ✅", { total: data.total })
          : tr("{needsYouCount} of your {total} transactions need a look. The other {onTrackCount} are on track and handled.", { needsYouCount: data.needsYouCount, total: data.total, onTrackCount: data.onTrackCount })}
      </div>

      {/* (New-messages alert now renders ABOVE this banner, from the home — shared
          UnreadMessagesInbox — so it shows reliably for the TC and the agent.) */}

      {/* APPROVE-FIRST PLAN — every message previewable, editable, holdable. */}
      <ReminderPlanReview token={token} reloadKey={planKey}
        onLoaded={() => { planDone.current && planDone.current(); }}
        onSent={() => setTimeout(() => load(true), 800)} />

      {data.needsYouCount > 0 && (
        <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, letterSpacing: 0.4, textTransform: "uppercase" }}>
          {tr("Deals that need you — most urgent first")}
        </div>
      )}
    </div>
  );
}
