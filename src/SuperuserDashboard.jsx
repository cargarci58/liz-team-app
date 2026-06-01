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

  useEffect(() => { loadHealth(); loadReviews(); }, []);

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
      </div>
    </div>
  );
}

export default SuperuserDashboard;
