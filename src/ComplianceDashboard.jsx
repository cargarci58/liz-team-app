import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  white: "#fff", black: "#111", gray: "#555", border: "#DDD",
  red: "#C0392B", lightRed: "#FADBD8",
  warning: "#B7770D", warningBg: "#FFFBEB", warningBorder: "#FCD34D",
  success: "#1E8449", successBg: "#D1FAE5", successBorder: "#86EFAC",
  danger: "#991B1B", dangerBg: "#FEE2E2", dangerBorder: "#FCA5A5",
};

export default function ComplianceDashboard({ token, onOpenTransaction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("gaps");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(API + "/admin/compliance-overview", {
        headers: { Authorization: "Bearer " + token }
      });
      const d = await res.json();
      if (d.success) setData(d);
    } catch (e) {}
    setLoading(false);
  };

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: COLORS.gray }}>Loading compliance overview...</div>;
  if (!data) return <div style={{ padding: 32, textAlign: "center", color: COLORS.danger }}>Failed to load. Admin access required.</div>;

  const filtered = data.transactions.filter(t => {
    if (filter === "all") return true;
    if (filter === "critical") return t.completedWithoutDoc > 0;
    if (filter === "gaps") return t.hasGaps;
    if (filter === "compliant") return t.compliancePct === 100;
    return true;
  });

  const StatCard = ({ label, value, color, bg }) => (
    <div style={{ background: bg, borderRadius: 12, padding: 14, flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "16px 16px 80px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.black, marginBottom: 4 }}>
          Broker Compliance Overview
        </div>
        <div style={{ fontSize: 13, color: COLORS.gray }}>
          Real-time view of document compliance across all active transactions.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <StatCard label="Total Transactions" value={data.stats.totalTransactions} color="#111827" bg="#F3F4F6" />
        <StatCard label="Fully Compliant" value={data.stats.fullyCompliant} color="#065F46" bg={COLORS.successBg} />
        <StatCard label="With Gaps" value={data.stats.withGaps} color="#92400E" bg={COLORS.warningBg} />
        <StatCard label="Critical Gaps" value={data.stats.criticalGaps} color={COLORS.danger} bg={COLORS.dangerBg} />
        <StatCard label="Pending Docs" value={data.stats.pendingDocs} color={COLORS.warning} bg={COLORS.warningBg} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          ["gaps", "Has Gaps " + data.stats.withGaps],
          ["critical", "Critical " + data.stats.criticalGaps],
          ["compliant", "Compliant " + data.stats.fullyCompliant],
          ["all", "All " + data.stats.totalTransactions]
        ].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ padding: "8px 14px", borderRadius: 20, border: "1.5px solid " + COLORS.border,
              background: filter === key ? COLORS.red : COLORS.white,
              color: filter === key ? COLORS.white : COLORS.gray,
              fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {label}
          </button>
        ))}
        <button onClick={fetchData}
          style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 20, border: "1.5px solid " + COLORS.border,
            background: COLORS.white, color: COLORS.gray, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
          Refresh
        </button>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: COLORS.gray }}>
          {filter === "gaps" || filter === "critical"
            ? "No transactions with gaps in this view."
            : "No transactions match this filter."}
        </div>
      )}

      {filtered.map(tx => {
        const isCritical = tx.completedWithoutDoc > 0;
        const isCompliant = tx.compliancePct === 100;
        const accent = isCritical ? COLORS.danger : (isCompliant ? COLORS.success : COLORS.warning);

        return (
          <div key={tx.transactionId}
            onClick={() => onOpenTransaction && onOpenTransaction(tx.transactionId)}
            style={{ background: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderLeft: "4px solid " + accent,
              cursor: onOpenTransaction ? "pointer" : "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{tx.address}</div>
                <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                  {tx.transactionType} - {tx.status}
                  {tx.agentName && " - Agent: " + tx.agentName}
                  {tx.closingDate && " - Closing " + tx.closingDate}
                </div>
                {isCritical && (
                  <div style={{ background: COLORS.dangerBg, border: "1px solid " + COLORS.dangerBorder, borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 12, color: COLORS.danger, fontWeight: 700 }}>
                    {tx.completedWithoutDoc} milestone(s) marked complete WITHOUT required documents
                  </div>
                )}
                {tx.missingDocs.length > 0 && (
                  <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 4 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Missing:</div>
                    {tx.missingDocs.slice(0, 5).map((d, i) => (
                      <div key={i} style={{ marginLeft: 4 }}>
                        {d.severity === "critical" ? "[!]" : "-"} {d.docType} <span style={{ color: "#9CA3AF" }}>({d.milestone})</span>
                      </div>
                    ))}
                    {tx.missingDocs.length > 5 && <div style={{ marginLeft: 4, color: "#9CA3AF" }}>...and {tx.missingDocs.length - 5} more</div>}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", minWidth: 100 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: accent }}>{tx.compliancePct}%</div>
                <div style={{ fontSize: 11, color: COLORS.gray }}>{tx.uploaded}/{tx.totalRequired} docs</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
