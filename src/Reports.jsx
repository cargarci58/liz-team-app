import { useState, useEffect } from "react";

const COLORS = {
  red: "#C0392B", navy: "#0F2044", gold: "#B7860B",
  green: "#1E8449", gray: "#555", light: "#F4F4F4", border: "#DDD"
};

function BarChart({ data, title, color = "#C0392B", valuePrefix = "$" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #DDD" }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.navy, marginBottom: 16 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 10, color: COLORS.gray, fontWeight: 600 }}>
              {d.value > 0 ? `${valuePrefix}${d.value >= 1000000 ? (d.value/1000000).toFixed(1)+"M" : d.value >= 1000 ? (d.value/1000).toFixed(0)+"K" : d.value}` : ""}
            </div>
            <div style={{ width: "100%", background: color, borderRadius: "4px 4px 0 0", height: `${(d.value / max) * 120}px`, minHeight: d.value > 0 ? 4 : 0, transition: "height 0.5s ease" }} />
            <div style={{ fontSize: 10, color: COLORS.gray, textAlign: "center", whiteSpace: "nowrap" }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = COLORS.navy }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #DDD", textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Reports({ transactions, onBack }) {
  const fmt = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`;

  // Commission calculator
  const calcComm = (tx) => {
    const price = Number(tx.contractPrice || tx.listPrice || 0);
    const listComm = tx.commissionListing ? price * Number(tx.commissionListing) / 100 : 0;
    const buyerComm = tx.commissionBuyer ? price * Number(tx.commissionBuyer) / 100 : 0;
    const total = listComm + buyerComm;
    const txFee = Number(tx.transactionFee || 0);
    const split = tx.brokerageSplit ? total * Number(tx.brokerageSplit) / 100 : 0;
    const flat = Number(tx.officeFlatFee || 0);
    return { gross: total, net: total + txFee - split - flat };
  };

  // Pipeline stats
  const active = transactions.filter(t => t.status === "Active");
  const underContract = transactions.filter(t => t.status === "Under Contract");
  const closed = transactions.filter(t => t.status === "Closed");

  const projectedGross = [...active, ...underContract].reduce((acc, tx) => acc + calcComm(tx).gross, 0);
  const projectedNet = [...active, ...underContract].reduce((acc, tx) => acc + calcComm(tx).net, 0);
  const closedGross = closed.reduce((acc, tx) => acc + calcComm(tx).gross, 0);
  const closedNet = closed.reduce((acc, tx) => acc + calcComm(tx).net, 0);
  const totalVolume = transactions.filter(t => t.status !== "Cancelled").reduce((acc, tx) => acc + Number(tx.contractPrice || tx.listPrice || 0), 0);

  // Monthly closing volume (last 6 months)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleString("en-US", { month: "short" });
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const vol = closed.filter(tx => {
      if (!tx.closingDate) return false;
      const cd = new Date(tx.closingDate);
      return cd.getFullYear() === yr && cd.getMonth() === mo;
    }).reduce((acc, tx) => acc + Number(tx.contractPrice || tx.listPrice || 0), 0);
    months.push({ label, value: vol });
  }

  // Monthly commission
  const monthlyComm = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleString("en-US", { month: "short" });
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const comm = closed.filter(tx => {
      if (!tx.closingDate) return false;
      const cd = new Date(tx.closingDate);
      return cd.getFullYear() === yr && cd.getMonth() === mo;
    }).reduce((acc, tx) => acc + calcComm(tx).net, 0);
    monthlyComm.push({ label, value: Math.round(comm) });
  }

  // Pipeline table
  const pipeline = [...active, ...underContract].map(tx => ({
    ...tx,
    gross: calcComm(tx).gross,
    net: calcComm(tx).net,
  })).filter(tx => tx.gross > 0).sort((a, b) => b.gross - a.gross);

  return (
    <div style={{ minHeight: "100vh", background: "#F4F4F4", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>←</button>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>📊 Reports & Analytics</div>
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

        {/* Summary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
          <StatCard label="Total Volume" value={fmt(totalVolume)} sub="All transactions" color={COLORS.navy} />
          <StatCard label="Projected Gross" value={fmt(projectedGross)} sub="Active + Under Contract" color={COLORS.gold} />
          <StatCard label="Projected Net" value={fmt(projectedNet)} sub="After splits & fees" color={COLORS.gold} />
          <StatCard label="Closed Gross" value={fmt(closedGross)} sub="All closed transactions" color={COLORS.green} />
          <StatCard label="Closed Net" value={fmt(closedNet)} sub="Your take-home" color={COLORS.green} />
          <StatCard label="Avg Days to Close" value={(() => {
            const closedWithDates = closed.filter(tx => tx.openDate && tx.closingDate);
            if (!closedWithDates.length) return "—";
            const avg = closedWithDates.reduce((acc, tx) => {
              const diff = new Date(tx.closingDate) - new Date(tx.openDate);
              return acc + diff / 86400000;
            }, 0) / closedWithDates.length;
            return Math.round(avg) + "d";
          })()} sub="Open to Close" color={COLORS.red} />
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <BarChart data={months} title="Monthly Closing Volume (6 months)" color={COLORS.navy} />
          <BarChart data={monthlyComm} title="Monthly Net Commission (6 months)" color={COLORS.green} />
        </div>

        {/* Commission Pipeline Table */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDD", overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: COLORS.navy, padding: "14px 20px" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>💰 Commission Pipeline</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 }}>Active and under contract transactions with commission data</div>
          </div>
          {pipeline.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: COLORS.gray }}>No commission data yet. Add commission percentages via ✏️ Edit on each transaction.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FA" }}>
                  {["Property", "Status", "Price", "List %", "Buyer %", "Gross Comm", "Net Comm"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: COLORS.gray, textTransform: "uppercase", borderBottom: "1px solid #DDD" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pipeline.map((tx, i) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid #F0F0F0", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{tx.address}<br/><span style={{ fontSize: 11, color: COLORS.gray, fontWeight: 400 }}>{tx.city}, FL</span></td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: tx.status === "Under Contract" ? "#DBEAFE" : "#FEF9E7", color: tx.status === "Under Contract" ? "#1D4ED8" : COLORS.gold, fontWeight: 600 }}>{tx.status}</span></td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{tx.contractPrice || tx.listPrice ? fmt(Number(tx.contractPrice || tx.listPrice)) : "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{tx.commissionListing ? `${tx.commissionListing}%` : "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{tx.commissionBuyer ? `${tx.commissionBuyer}%` : "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: COLORS.navy }}>{tx.gross > 0 ? fmt(tx.gross) : "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: COLORS.green }}>{tx.net > 0 ? fmt(tx.net) : "—"}</td>
                  </tr>
                ))}
                <tr style={{ background: "#F0FFF4", borderTop: "2px solid #1E8449" }}>
                  <td colSpan={5} style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13 }}>PIPELINE TOTAL</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: COLORS.navy }}>{fmt(projectedGross)}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: COLORS.green }}>{fmt(projectedNet)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Transaction Summary Table */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDD", overflow: "hidden" }}>
          <div style={{ background: COLORS.navy, padding: "14px 20px" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>🏠 All Transactions Summary</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8F9FA" }}>
                {["Property", "Type", "Status", "Price", "Closing Date", "Net Commission"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: COLORS.gray, textTransform: "uppercase", borderBottom: "1px solid #DDD" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.filter(t => t.status !== "Cancelled").map((tx, i) => {
                const { net } = calcComm(tx);
                const statusColors = { Active: "#FEF9E7", "Under Contract": "#DBEAFE", Closed: "#F0FFF4", "On Hold": "#F3F4F6" };
                const statusText = { Active: COLORS.gold, "Under Contract": "#1D4ED8", Closed: COLORS.green, "On Hold": COLORS.gray };
                return (
                  <tr key={tx.id} style={{ borderBottom: "1px solid #F0F0F0", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                    <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600 }}>{tx.address}</td>
                    <td style={{ padding: "11px 16px", fontSize: 12, color: COLORS.gray }}>{tx.type}</td>
                    <td style={{ padding: "11px 16px" }}><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: statusColors[tx.status] || "#F3F4F6", color: statusText[tx.status] || COLORS.gray, fontWeight: 600 }}>{tx.status}</span></td>
                    <td style={{ padding: "11px 16px", fontSize: 13 }}>{tx.contractPrice || tx.listPrice ? fmt(Number(tx.contractPrice || tx.listPrice)) : "—"}</td>
                    <td style={{ padding: "11px 16px", fontSize: 12, color: COLORS.gray }}>{tx.closingDate ? new Date(tx.closingDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: net > 0 ? COLORS.green : COLORS.gray }}>{net > 0 ? fmt(net) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
