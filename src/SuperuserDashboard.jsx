import React, { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = { navy: "#1A2B4A", gold: "#C9A84C", muted: "#6B7280", border: "#E5E7EB", bg: "#F9FAFB", danger: "#C0392B", green: "#1E8449", amber: "#B7770D" };
// Fluorescent status colors — high-saturation so each light is instantly distinguishable.
const STATUS = { ok: "#00E676", down: "#FF1744", attn: "#FFEA00" };

// Service labels for the health grid (keys must match backend /admin/superuser/health)
const SERVICES = [
  { key: "backend", label: "Backend API (Railway)" },
  { key: "database", label: "Database (Postgres)" },
  { key: "frontend", label: "Frontend (Netlify)" },
  { key: "storage", label: "Document Storage (R2)" },
  { key: "email", label: "Email (SendGrid)" },
  { key: "sms", label: "SMS (Telnyx/Twilio)" },
  { key: "ai_anthropic", label: "AI — Anthropic" },
];

// Variable data that drifts statewide and needs periodic review (every 3 months).
const REVIEW_ITEMS = [
  { key: "fl_tax_millage", label: "FL property-tax millage rates", where: "flTaxRates.js", note: "Reset each fall by county/city. Orange verified; rest estimates. Source: FL DOR / county appraisers. Still need title co.'s full statewide city schedule." },
  { key: "homeowners_insurance", label: "Homeowners insurance default rate", where: "net sheets", note: "Currently ~1% of price. FL market volatile. Source: FL OIR." },
  { key: "title_insurance", label: "Title insurance promulgated rates", where: "BuyerCalculator.jsx", note: "FL DFS promulgated tiers ($5.75/$1k to $100k, $5.00/$1k after)." },
  { key: "doc_stamps_intangible", label: "Doc-stamp & intangible tax rates", where: "BuyerCalculator.jsx", note: "$0.70/$100 deed ($0.60 Miami-Dade), $0.35/$100 note, 0.2% intangible. Statutory — rarely change." },
  { key: "loan_limits", label: "Conforming / FHA / VA loan limits", where: "net sheets", note: "Updated annually." },
  { key: "misc_rates", label: "Recording fees, estoppel caps, PMI, default mortgage rate, commission norms", where: "net sheets", note: "Review post-NAR commission norms too." },
];

const REVIEW_INTERVAL_DAYS = 92; // ~3 months

// Feedback kind → label + accent
const FB_KIND = {
  bug: { label: "🐞 Bug", color: "#C0392B" },
  suggestion: { label: "💡 Idea", color: "#B7770D" },
  other: { label: "💬 Note", color: "#1A2B4A" },
};
const FB_FILTERS = [
  { id: "new", label: "New" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

function fmtDateTime(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return "—"; }
}

// Color a status: green = healthy, red = broken/down, yellow = needs attention
// (not configured), gray = still loading / no data yet.
function statusColor(status) {
  if (status === "ok") return STATUS.ok;
  if (status === "down") return STATUS.down;
  if (status === "unconfigured") return STATUS.attn;
  return COLORS.muted; // loading / unknown
}

function statusDot(status) {
  const c = statusColor(status);
  const glow = status === "ok" || status === "down" || status === "unconfigured";
  return <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: c, flexShrink: 0, boxShadow: glow ? `0 0 8px ${c}, 0 0 3px ${c}` : "none" }} />;
}

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); } catch { return "—"; }
}

function SuperuserDashboard({ onClose, token }) {
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);
  const [reviews, setReviews] = useState({});
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  // Feedback inbox
  const [feedback, setFeedback] = useState([]);
  const [fbCounts, setFbCounts] = useState({});
  const [fbLoading, setFbLoading] = useState(true);
  const [fbFilter, setFbFilter] = useState("new"); // new | in_progress | done | all
  const [fbBusyId, setFbBusyId] = useState(null);

  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + token };

  const loadHealth = () => {
    setHealthLoading(true); setHealthError(null);
    fetch(API + "/admin/superuser/health", { headers })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setHealth(d.checks || {}); setHealthLoading(false); })
      .catch(e => { setHealthError(String(e.message || e)); setHealthLoading(false); });
  };

  const loadReviews = () => {
    setReviewsLoading(true);
    fetch(API + "/admin/superuser/reviews", { headers })
      .then(r => r.json())
      .then(d => { setReviews(d.reviews || {}); setReviewsLoading(false); })
      .catch(() => setReviewsLoading(false));
  };

  const loadFeedback = (filter = fbFilter) => {
    setFbLoading(true);
    const qs = filter && filter !== "all" ? `?status=${filter}` : "";
    fetch(API + "/admin/superuser/feedback" + qs, { headers })
      .then(r => r.json())
      .then(d => { setFeedback(d.items || []); setFbCounts(d.counts || {}); setFbLoading(false); })
      .catch(() => setFbLoading(false));
  };

  const updateFeedback = async (id, patch) => {
    setFbBusyId(id);
    try {
      await fetch(API + "/admin/superuser/feedback/" + id, { method: "PATCH", headers, body: JSON.stringify(patch) });
      loadFeedback();
    } catch (e) { /* surfaced on reload */ }
    setFbBusyId(null);
  };

  useEffect(() => { loadHealth(); loadReviews(); loadFeedback(); }, []);
  useEffect(() => { loadFeedback(fbFilter); }, [fbFilter]);

  const markReviewed = async (key) => {
    setSavingKey(key);
    const next = { ...reviews, [key]: new Date().toISOString() };
    setReviews(next);
    try {
      await fetch(API + "/admin/superuser/reviews", { method: "POST", headers, body: JSON.stringify({ reviews: next }) });
    } catch (e) { /* optimistic; surfaced on next load */ }
    setSavingKey(null);
  };

  const dueInfo = (lastIso) => {
    if (!lastIso) return { due: null, overdue: true, label: "Never reviewed" };
    const due = new Date(new Date(lastIso).getTime() + REVIEW_INTERVAL_DAYS * 86400000);
    const overdue = due.getTime() < Date.now();
    return { due, overdue, label: (overdue ? "Overdue — was due " : "Next due ") + fmtDate(due) };
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 300, overflowY: "auto", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, color: COLORS.navy, fontWeight: 800 }}>👑 Superuser Dashboard</h1>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 14, color: COLORS.muted, fontFamily: "inherit" }}>Close</button>
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24 }}>Platform health and quarterly data-freshness checks. Visible only to you.</div>

        {/* ── Service Health ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: COLORS.navy, fontWeight: 700 }}>Service Health</h2>
          <button onClick={loadHealth} disabled={healthLoading} style={{ background: COLORS.navy, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: healthLoading ? "default" : "pointer", fontSize: 13, fontFamily: "inherit", opacity: healthLoading ? 0.6 : 1 }}>{healthLoading ? "Checking…" : "↻ Refresh"}</button>
        </div>
        {healthError && <div style={{ background: "#FDEDEC", border: `1px solid ${COLORS.danger}40`, color: COLORS.danger, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>Couldn't load health: {healthError}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginBottom: 12 }}>
          {SERVICES.map(svc => {
            const c = (health && health[svc.key]) || null;
            const status = c?.status || (healthLoading ? "loading" : "unknown");
            const accent = statusColor(status);
            const detailColor = status === "down" ? COLORS.danger : status === "unconfigured" ? "#B59A00" : COLORS.muted;
            const detailText = healthLoading ? "checking…"
              : !c ? "no data"
              : c.status === "ok" ? (c.detail || "OK")
              : c.status === "down" ? "DOWN — " + (c.detail || "")
              : c.status === "unconfigured" ? "Not configured — " + (c.detail || "")
              : (c.detail || c.status);
            return (
              <div key={svc.key} style={{ display: "flex", alignItems: "center", gap: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderLeft: `4px solid ${accent}`, borderRadius: 10, padding: "12px 14px" }}>
                {statusDot(status)}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy }}>{svc.label}</div>
                  <div style={{ fontSize: 11, color: detailColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detailText}</div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "0 0 36px", fontSize: 11, color: COLORS.muted }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{statusDot("ok")} Healthy</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{statusDot("unconfigured")} Needs attention</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{statusDot("down")} Down</span>
        </div>

        {/* ── Quarterly Review ── */}
        <h2 style={{ margin: "0 0 4px", fontSize: 16, color: COLORS.navy, fontWeight: 700 }}>Quarterly Data Review</h2>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>These values drift over time as the platform goes statewide. Re-check each every ~3 months and mark it reviewed.</div>
        {reviewsLoading ? (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {REVIEW_ITEMS.map(item => {
              const last = reviews[item.key];
              const { overdue, label } = dueInfo(last);
              return (
                <div key={item.key} style={{ border: `1px solid ${COLORS.border}`, borderLeft: `4px solid ${overdue ? COLORS.danger : COLORS.green}`, borderRadius: 10, padding: "12px 16px", background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.navy }}>{item.label} <span style={{ fontSize: 11, fontWeight: 500, color: COLORS.muted }}>· {item.where}</span></div>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 3 }}>{item.note}</div>
                      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: COLORS.muted }}>Last reviewed: <strong style={{ color: COLORS.navy }}>{fmtDate(last)}</strong></span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: overdue ? COLORS.danger : COLORS.green }}>{overdue && "⚠ "}{label}</span>
                      </div>
                    </div>
                    <button onClick={() => markReviewed(item.key)} disabled={savingKey === item.key} style={{ background: overdue ? COLORS.danger : COLORS.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: savingKey === item.key ? "default" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap", opacity: savingKey === item.key ? 0.6 : 1 }}>
                      {savingKey === item.key ? "Saving…" : "✓ Mark reviewed today"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Feedback Inbox ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "40px 0 4px" }}>
          <h2 style={{ margin: 0, fontSize: 16, color: COLORS.navy, fontWeight: 700 }}>
            Feedback Inbox{(fbCounts.new || 0) > 0 ? <span style={{ marginLeft: 8, background: COLORS.danger, color: "#fff", borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 700 }}>{fbCounts.new} new</span> : null}
          </h2>
          <button onClick={() => loadFeedback()} disabled={fbLoading} style={{ background: COLORS.navy, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: fbLoading ? "default" : "pointer", fontSize: 13, fontFamily: "inherit", opacity: fbLoading ? 0.6 : 1 }}>{fbLoading ? "Loading…" : "↻ Refresh"}</button>
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>Bugs, ideas, and notes submitted by agents from the in-app 📣 Feedback button.</div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {FB_FILTERS.map(f => {
            const active = fbFilter === f.id;
            const n = f.id === "all" ? null : fbCounts[f.id];
            return (
              <button key={f.id} onClick={() => setFbFilter(f.id)} style={{
                padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                border: active ? `2px solid ${COLORS.navy}` : `1px solid ${COLORS.border}`,
                background: active ? COLORS.navy : "#fff", color: active ? "#fff" : COLORS.muted,
              }}>{f.label}{typeof n === "number" ? ` (${n})` : ""}</button>
            );
          })}
        </div>

        {fbLoading ? (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Loading…</div>
        ) : feedback.length === 0 ? (
          <div style={{ color: COLORS.muted, fontSize: 13, padding: "16px 0" }}>Nothing here{fbFilter !== "all" ? ` in "${(FB_FILTERS.find(f => f.id === fbFilter) || {}).label}"` : ""}. 🎉</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {feedback.map(item => {
              const meta = FB_KIND[item.kind] || FB_KIND.other;
              const busy = fbBusyId === item.id;
              return (
                <div key={item.id} style={{ border: `1px solid ${COLORS.border}`, borderLeft: `4px solid ${meta.color}`, borderRadius: 10, padding: "12px 16px", background: item.status === "new" ? "#FFFDF5" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: meta.color }}>{meta.label}</span>
                      <span style={{ fontSize: 12, color: COLORS.navy, fontWeight: 700 }}>{item.user_name || "—"}</span>
                      <span style={{ fontSize: 12, color: COLORS.muted }}>{item.user_email || ""}</span>
                    </div>
                    <span style={{ fontSize: 11, color: COLORS.muted, whiteSpace: "nowrap" }}>{fmtDateTime(item.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: "#222", lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 8 }}>{item.message}</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                    {item.tenant_id != null && <span style={{ fontSize: 11, color: COLORS.muted }}>Tenant #{item.tenant_id}</span>}
                    {item.page && <span style={{ fontSize: 11, color: COLORS.muted }}>at <code style={{ background: COLORS.bg, padding: "1px 5px", borderRadius: 4 }}>{item.page}</code></span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {item.status !== "in_progress" && (
                      <button onClick={() => updateFeedback(item.id, { status: "in_progress" })} disabled={busy} style={{ background: "#fff", color: COLORS.amber, border: `1px solid ${COLORS.amber}`, borderRadius: 8, padding: "6px 12px", cursor: busy ? "default" : "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>◔ In progress</button>
                    )}
                    {item.status !== "done" && (
                      <button onClick={() => updateFeedback(item.id, { status: "done" })} disabled={busy} style={{ background: COLORS.green, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: busy ? "default" : "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>✓ Done</button>
                    )}
                    {item.status !== "new" && (
                      <button onClick={() => updateFeedback(item.id, { status: "new" })} disabled={busy} style={{ background: "#fff", color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 12px", cursor: busy ? "default" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>↩ Reopen</button>
                    )}
                    <span style={{ fontSize: 11, color: COLORS.muted, alignSelf: "center" }}>Status: <strong style={{ color: item.status === "done" ? COLORS.green : item.status === "in_progress" ? COLORS.amber : COLORS.danger }}>{item.status === "in_progress" ? "in progress" : item.status}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SuperuserDashboard;
