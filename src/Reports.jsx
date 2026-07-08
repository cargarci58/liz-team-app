import React, { useState, useEffect, useMemo } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const authFetch = async (path, options = {}) => {
  const token = localStorage.getItem("tp_token");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

// Print styles injected dynamically
const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden; }
    #reports-printable, #reports-printable * { visibility: visible; }
    #reports-printable { position: absolute; left: 0; top: 0; width: 100%; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
  }
`;

const COLORS = {
  red: "#C0392B", navy: "#0F2044", gold: "#B7860B",
  green: "#1E8449", gray: "#555", light: "#F4F4F4", border: "#DDD"
};

// Lead-generation presets. These are STARTING ESTIMATES of typical conversion
// rates by prospecting method — they get replaced by the agent's own numbers
// as soon as their call log has data ("Use my actual numbers"). Rates are the
// fraction that advances to the next funnel stage.
const LEAD_GEN_PRESETS = {
  sphere:   { label: "Sphere / Referrals",        dialToConv: 0.35, convToAppt: 0.25, apptToContract: 0.60, contractToClose: 0.90 },
  past:     { label: "Past Clients",              dialToConv: 0.40, convToAppt: 0.30, apptToContract: 0.65, contractToClose: 0.90 },
  openHouse:{ label: "Open Houses",               dialToConv: 0.30, convToAppt: 0.15, apptToContract: 0.40, contractToClose: 0.85 },
  farm:     { label: "Geographic Farm",           dialToConv: 0.20, convToAppt: 0.10, apptToContract: 0.40, contractToClose: 0.85 },
  online:   { label: "Online / Internet Leads",   dialToConv: 0.15, convToAppt: 0.08, apptToContract: 0.30, contractToClose: 0.80 },
  cold:     { label: "Cold Call / FSBO / Expired",dialToConv: 0.12, convToAppt: 0.05, apptToContract: 0.25, contractToClose: 0.80 },
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

// ── Commission calculator (client-side, mirrors backend NET_COMMISSION_SQL) ──
function calcComm(tx) {
  const price = Number(tx.contractPrice || tx.listPrice || 0);
  const listComm = tx.commissionListing ? price * Number(tx.commissionListing) / 100 : 0;
  const buyerComm = tx.commissionBuyer ? price * Number(tx.commissionBuyer) / 100 : 0;
  let ourGross = 0;
  if (tx.type === "Listing (Seller)") ourGross = listComm;
  else if (tx.type === "Buyer Representation") ourGross = buyerComm;
  else if (tx.type === "Dual Agency") ourGross = listComm + buyerComm;
  const txFee = Number(tx.transactionFee || 0);
  const split = tx.brokerageSplit ? ourGross * Number(tx.brokerageSplit) / 100 : 0;
  const flat = Number(tx.officeFlatFee || 0);
  return { gross: ourGross, net: ourGross + txFee - split - flat };
}

const fmt = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`;
const pct = (r) => (r == null ? "—" : `${(r * 100).toFixed(0)}%`);
const ratioTxt = (r) => (r == null ? "—" : r.toFixed(1));

// ════════════════════════════════════════════════════════════════
// TAB 1 — OVERVIEW (original report)
// ════════════════════════════════════════════════════════════════
function OverviewTab({ transactions }) {
  // SALES only — rentals/leases have rent (not a sale price) and would skew volume.
  const isSaleDeal = (t) => !/lease|rental/i.test(t.type || t.transactionType || t.transaction_type || "");
  const active = transactions.filter(t => t.status === "Active");
  const underContract = transactions.filter(t => t.status === "Under Contract");
  const closed = transactions.filter(t => t.status === "Closed");

  const projectedGross = [...active, ...underContract].reduce((acc, tx) => acc + calcComm(tx).gross, 0);
  const projectedNet = [...active, ...underContract].reduce((acc, tx) => acc + calcComm(tx).net, 0);
  const closedGross = closed.reduce((acc, tx) => acc + calcComm(tx).gross, 0);
  const closedNet = closed.reduce((acc, tx) => acc + calcComm(tx).net, 0);
  const totalVolume = transactions.filter(t => t.status !== "Cancelled" && isSaleDeal(t)).reduce((acc, tx) => acc + Number(tx.contractPrice || tx.listPrice || 0), 0);

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const label = d.toLocaleString("en-US", { month: "short" });
    const yr = d.getFullYear(), mo = d.getMonth();
    const vol = closed.filter(tx => {
      if (!tx.closingDate || !isSaleDeal(tx)) return false;
      const cd = new Date(tx.closingDate);
      return cd.getFullYear() === yr && cd.getMonth() === mo;
    }).reduce((acc, tx) => acc + Number(tx.contractPrice || tx.listPrice || 0), 0);
    months.push({ label, value: vol });
  }
  const monthlyComm = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const label = d.toLocaleString("en-US", { month: "short" });
    const yr = d.getFullYear(), mo = d.getMonth();
    const comm = closed.filter(tx => {
      if (!tx.closingDate) return false;
      const cd = new Date(tx.closingDate);
      return cd.getFullYear() === yr && cd.getMonth() === mo;
    }).reduce((acc, tx) => acc + calcComm(tx).net, 0);
    monthlyComm.push({ label, value: Math.round(comm) });
  }

  // Ordered by stage first (Active → Under Contract), then biggest commission —
  // pure commission-size sort interleaved the statuses and read as random.
  const STAGE_RANK = { "Active": 0, "Under Contract": 1, "Inspection": 2, "Appraisal": 3, "Clear to Close": 4, "Closed": 5 };
  const pipeline = [...active, ...underContract].map(tx => ({
    ...tx, gross: calcComm(tx).gross, net: calcComm(tx).net,
  })).filter(tx => tx.gross > 0)
    .sort((a, b) => (STAGE_RANK[a.status] ?? 9) - (STAGE_RANK[b.status] ?? 9) || b.gross - a.gross);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Volume" value={fmt(totalVolume)} sub="All transactions" color={COLORS.navy} />
        <StatCard label="Projected Gross" value={fmt(projectedGross)} sub="Active + Under Contract" color={COLORS.gold} />
        <StatCard label="Projected Net" value={fmt(projectedNet)} sub="After splits & fees" color={COLORS.gold} />
        <StatCard label="Closed Gross" value={fmt(closedGross)} sub="All closed transactions" color={COLORS.green} />
        <StatCard label="Closed Net" value={fmt(closedNet)} sub="Your take-home" color={COLORS.green} />
        <StatCard label="Avg Days to Close" value={(() => {
          const c = closed.filter(tx => tx.openDate && tx.closingDate);
          if (!c.length) return "—";
          const avg = c.reduce((a, tx) => a + (new Date(tx.closingDate) - new Date(tx.openDate)) / 86400000, 0) / c.length;
          return Math.round(avg) + "d";
        })()} sub="Open to Close" color={COLORS.red} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <BarChart data={months} title="Monthly Closing Volume (6 months)" color={COLORS.navy} />
        <BarChart data={monthlyComm} title="Monthly Net Commission (6 months)" color={COLORS.green} />
      </div>

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
            {[...transactions].filter(t => t.status !== "Cancelled")
              .sort((a, b) => ((STAGE_RANK[a.status] ?? 9) - (STAGE_RANK[b.status] ?? 9)) || String(a.closingDate || "9999").localeCompare(String(b.closingDate || "9999")))
              .map((tx, i) => {
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
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 2 — ACTIVITY & CONVERSION (call funnel → closings)
// ════════════════════════════════════════════════════════════════
function FunnelStage({ label, value, color, rate, rateLabel }) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ background: "#fff", border: "1px solid #DDD", borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 900, color }}>{value.toLocaleString()}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, marginTop: 4 }}>{label}</div>
      </div>
      {rate != null && (
        <div style={{ textAlign: "center", fontSize: 11, color: COLORS.gray, padding: "6px 0" }}>
          ↓ {pct(rate)}<br/><span style={{ fontSize: 10 }}>{rateLabel}</span>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ isAdmin }) {
  const [scope, setScope] = useState("agent");
  const [months, setMonths] = useState("12");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    authFetch(`/reports/activity?scope=${scope}&months=${months}`)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) { setErr("Could not load activity data."); setLoading(false); } });
    return () => { alive = false; };
  }, [scope, months]);

  const f = data?.funnel;
  const r = data?.ratios;

  return (
    <div>
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {isAdmin && (
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #DDD" }}>
            {[["agent", "My numbers"], ["team", "Whole team"]].map(([v, l]) => (
              <button key={v} onClick={() => setScope(v)} style={{ padding: "7px 14px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: scope === v ? COLORS.navy : "#fff", color: scope === v ? "#fff" : COLORS.gray }}>{l}</button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #DDD" }}>
          {[["12", "Last 12 mo"], ["all", "All time"]].map(([v, l]) => (
            <button key={v} onClick={() => setMonths(v)} style={{ padding: "7px 14px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: months === v ? COLORS.navy : "#fff", color: months === v ? "#fff" : COLORS.gray }}>{l}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: COLORS.gray }}>Loading activity…</div>}
      {err && <div style={{ padding: 40, textAlign: "center", color: COLORS.red }}>{err}</div>}

      {data && !loading && (
        <>
          {/* Headline ratio cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
            <StatCard label="Conversations / Closing" value={ratioTxt(r.conversationsPerClosing)} sub="Your key number" color={COLORS.red} />
            <StatCard label="Dials / Closing" value={ratioTxt(r.dialsPerClosing)} sub="Total calls per deal" color={COLORS.navy} />
            <StatCard label="Conversation Rate" value={pct(r.conversationRate)} sub="Reached a human / dial" color={COLORS.gold} />
            <StatCard label="Pull-Through" value={pct(r.closeRate)} sub="Contracts that closed" color={COLORS.green} />
          </div>

          {/* Funnel */}
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDD", padding: 20, marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.navy, marginBottom: 16 }}>📞 Activity Funnel — Calls to Closings</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <FunnelStage label="Dials" value={f.dials} color={COLORS.navy} rate={r.conversationRate} rateLabel="reached" />
              <FunnelStage label="Conversations" value={f.conversations} color={COLORS.gold} rate={r.appointmentRate} rateLabel="→ appt" />
              <FunnelStage label="Appointments" value={f.appointments} color={COLORS.gold} rate={r.contractRate} rateLabel="→ contract" />
              <FunnelStage label="Contracts" value={f.contracts} color={COLORS.green} rate={r.closeRate} rateLabel="→ close" />
              <FunnelStage label="Closings" value={f.closings} color={COLORS.green} />
            </div>
            <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 12, lineHeight: 1.5 }}>
              <b>Dials</b> = every logged call · <b>Conversations</b> = reached a person (Interested, Not Now, or Meeting Set) · <b>Appointments</b> = Meeting Set ·
              <b> Contracts</b> = deals that reached Under Contract or beyond · <b>Closings</b> = closed deals.
              {data.avgNetPerTx != null && <> Avg net per closed deal: <b>{fmt(data.avgNetPerTx)}</b>.</>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 3 — GOAL PLANNER (back-calc income → calls)
// ════════════════════════════════════════════════════════════════
function GoalPlannerTab({ transactions }) {
  const closed = transactions.filter(t => t.status === "Closed");
  const closedAvgNet = useMemo(() => {
    const withPrice = closed.filter(tx => Number(tx.contractPrice || tx.listPrice || 0) > 0);
    if (!withPrice.length) return null;
    return withPrice.reduce((a, tx) => a + calcComm(tx).net, 0) / withPrice.length;
  }, [transactions]);

  const [incomeGoal, setIncomeGoal] = useState(150000);
  const [method, setMethod] = useState("sphere");
  const [avgNet, setAvgNet] = useState(closedAvgNet ? Math.round(closedAvgNet) : 9000);
  const [weeks, setWeeks] = useState(50);
  const preset = LEAD_GEN_PRESETS[method];
  const [rates, setRates] = useState({ ...preset });
  const [activity, setActivity] = useState(null);
  const [saved, setSaved] = useState(false);

  // Load saved plan + the agent's real ratios on mount.
  useEffect(() => {
    authFetch("/reports/goals").then(d => {
      if (d.goal) {
        if (d.goal.income_goal != null) setIncomeGoal(Number(d.goal.income_goal));
        if (d.goal.avg_net_per_tx != null) setAvgNet(Number(d.goal.avg_net_per_tx));
        if (d.goal.lead_gen_method) setMethod(d.goal.lead_gen_method);
        if (d.goal.working_weeks != null) setWeeks(Number(d.goal.working_weeks));
        if (d.goal.assumptions && Object.keys(d.goal.assumptions).length) setRates(a => ({ ...a, ...d.goal.assumptions }));
      }
    }).catch(() => {});
    authFetch("/reports/activity?months=all").then(d => setActivity(d)).catch(() => {});
  }, []);

  // When method changes, load that preset's rates.
  const changeMethod = (m) => { setMethod(m); setRates({ ...LEAD_GEN_PRESETS[m] }); };

  const hasRealRatios = activity && activity.ratios && activity.ratios.conversationRate != null;
  const useMyNumbers = () => {
    if (!hasRealRatios) return;
    const ar = activity.ratios;
    setRates({
      dialToConv: ar.conversationRate ?? rates.dialToConv,
      convToAppt: ar.appointmentRate ?? rates.convToAppt,
      apptToContract: ar.contractRate ?? rates.apptToContract,
      contractToClose: ar.closeRate ?? rates.contractToClose,
    });
    if (activity.avgNetPerTx != null) setAvgNet(Math.round(activity.avgNetPerTx));
  };

  // ── Back-calculation ──
  const ceil = (n) => (isFinite(n) && n > 0 ? Math.ceil(n) : 0);
  const closings = ceil(incomeGoal / (avgNet || 1));
  const contracts = ceil(closings / (rates.contractToClose || 1));
  const appointments = ceil(contracts / (rates.apptToContract || 1));
  const conversations = ceil(appointments / (rates.convToAppt || 1));
  const dials = ceil(conversations / (rates.dialToConv || 1));
  const workDays = Math.max(1, (weeks || 50) * 5);
  const dialsPerWeek = ceil(dials / (weeks || 50));
  const dialsPerDay = ceil(dials / workDays);
  const convosPerWeek = ceil(conversations / (weeks || 50));

  const save = async () => {
    try {
      await authFetch("/reports/goals", {
        method: "PUT",
        body: JSON.stringify({
          incomeGoal, avgNetPerTx: avgNet, leadGenMethod: method, workingWeeks: weeks, assumptions: rates,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { alert("Could not save the plan. Try again."); }
  };

  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, fontWeight: 700, color: COLORS.gray, marginBottom: 6, display: "block" };
  const RateRow = ({ k, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ flex: 1, fontSize: 13, color: COLORS.navy }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input type="number" min="1" max="100" value={Math.round((rates[k] || 0) * 100)}
          onChange={e => setRates(a => ({ ...a, [k]: Math.min(100, Math.max(1, Number(e.target.value))) / 100 }))}
          style={{ width: 64, padding: "6px 8px", borderRadius: 6, border: "1px solid #CCC", fontSize: 14, textAlign: "right" }} />
        <span style={{ fontSize: 13, color: COLORS.gray }}>%</span>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ background: "#FFF8E1", border: "1px solid #F0E0A0", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#7A5C00", lineHeight: 1.5 }}>
        🎯 <b>The conversation to have with every agent:</b> "How much do you want to make?" We work backward from that number — to closings, contracts, appointments, and the <b>phone calls per day</b> it takes to get there with your lead-gen method.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(280px, 1.2fr)", gap: 20 }}>
        {/* INPUTS */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDD", padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.navy, marginBottom: 16 }}>Your Targets</div>

          <label style={labelStyle}>Net income goal (per year)</label>
          {/* step=1000 so the up/down arrows jump by $1,000 instead of $1 (tester #14) */}
          <input type="number" step="1000" min="0" value={incomeGoal} onChange={e => setIncomeGoal(Number(e.target.value))} style={{ ...inputStyle, marginBottom: 16 }} />

          <label style={labelStyle}>Lead-generation method</label>
          <select value={method} onChange={e => changeMethod(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }}>
            {Object.entries(LEAD_GEN_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <label style={labelStyle}>Avg net commission per closing</label>
          {/* step=500 so the arrows move by $500 rather than $1 (tester #14) */}
          <input type="number" step="500" min="0" value={avgNet} onChange={e => setAvgNet(Number(e.target.value))} style={{ ...inputStyle, marginBottom: 4 }} />
          <div style={{ fontSize: 11, color: COLORS.gray, marginBottom: 16 }}>
            {closedAvgNet ? `Your closed-deal average: ${fmt(closedAvgNet)}` : "No closed deals yet — using an estimate."}
          </div>

          <label style={labelStyle}>Working weeks per year</label>
          <input type="number" min="1" max="52" value={weeks} onChange={e => setWeeks(Number(e.target.value))} style={{ ...inputStyle, marginBottom: 20 }} />

          <div style={{ borderTop: "1px solid #EEE", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy }}>Conversion assumptions</div>
              <button onClick={useMyNumbers} disabled={!hasRealRatios} title={hasRealRatios ? "" : "Need logged calls + closings first"}
                style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: "1px solid " + (hasRealRatios ? COLORS.green : "#CCC"), background: hasRealRatios ? "#F0FFF4" : "#F4F4F4", color: hasRealRatios ? COLORS.green : "#AAA", cursor: hasRealRatios ? "pointer" : "not-allowed" }}>
                Use my actual numbers
              </button>
            </div>
            <RateRow k="dialToConv" label="Dials → Conversation" />
            <RateRow k="convToAppt" label="Conversation → Appointment" />
            <RateRow k="apptToContract" label="Appointment → Contract" />
            <RateRow k="contractToClose" label="Contract → Closing" />
          </div>

          <button onClick={save} style={{ width: "100%", marginTop: 18, padding: "12px", borderRadius: 8, border: "none", background: COLORS.green, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            {saved ? "✓ Saved" : "💾 Save my plan"}
          </button>
        </div>

        {/* OUTPUTS */}
        <div>
          <div style={{ background: COLORS.navy, borderRadius: 12, padding: "24px 20px", color: "#fff", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 13, opacity: 0.8 }}>To net {fmt(incomeGoal)} this year you need</div>
            <div style={{ fontSize: 44, fontWeight: 900, margin: "8px 0", color: COLORS.gold }}>{dialsPerDay.toLocaleString()}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>dials per day</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>≈ {dialsPerWeek.toLocaleString()} dials &amp; {convosPerWeek.toLocaleString()} conversations / week · {weeks} weeks</div>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #DDD", overflow: "hidden" }}>
            {[
              { label: "Closings needed", value: closings.toLocaleString(), sub: `${fmt(incomeGoal)} ÷ ${fmt(avgNet)} avg net`, color: COLORS.green },
              { label: "Contracts needed", value: contracts.toLocaleString(), sub: `${pct(rates.contractToClose)} close`, color: COLORS.green },
              { label: "Appointments needed", value: appointments.toLocaleString(), sub: `${pct(rates.apptToContract)} → contract`, color: COLORS.gold },
              { label: "Conversations needed", value: conversations.toLocaleString(), sub: `${pct(rates.convToAppt)} → appt`, color: COLORS.gold },
              { label: "Dials needed (year)", value: dials.toLocaleString(), sub: `${pct(rates.dialToConv)} reached`, color: COLORS.navy },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: i < 4 ? "1px solid #F0F0F0" : "none", background: i % 2 ? "#FAFAFA" : "#fff" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.navy }}>{row.label}</div>
                  <div style={{ fontSize: 11, color: COLORS.gray }}>{row.sub}</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: row.color }}>{row.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 12, lineHeight: 1.5 }}>
            Conversion rates start as typical estimates for your lead-gen method. Log calls and close deals, then tap <b>"Use my actual numbers"</b> to make this plan yours.
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// TAB — MY SALES STATS (current pipeline + last-12-month production)
// ════════════════════════════════════════════════════════════════
function SalesStatsTab() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    authFetch("/reports/sales-stats").then(d => setStats(d.stats || {})).catch(() => setErr(true));
  }, []);
  if (err) return <div style={{ color: COLORS.gray }}>Could not load sales stats.</div>;
  if (!stats) return <div style={{ color: COLORS.gray }}>Loading…</div>;
  const m = (n) => n == null ? "—" : fmt(n);
  const p = (n) => n == null ? "—" : `${Number(n).toFixed(n < 10 ? 1 : 0)}%`;
  const cards = [
    { label: "Active Listings", value: stats.activeListings ?? 0, sub: "right now", color: COLORS.red },
    { label: "Active Buyers", value: stats.activeBuyers ?? 0, sub: "right now", color: COLORS.navy },
    { label: "Avg. List Price", value: m(stats.avgListPrice), sub: "last 12 mo", color: COLORS.navy },
    { label: "Sale-to-List Price", value: p(stats.saleToListPct), sub: "last 12 mo", color: COLORS.green },
    { label: "Avg. Sales Price", value: m(stats.avgSalePrice), sub: "last 12 mo", color: COLORS.navy },
    { label: "Avg. Days to Close", value: stats.avgDaysToClose == null ? "—" : `${stats.avgDaysToClose} days`, sub: "list → closing, last 12 mo", color: COLORS.gold },
    { label: "Avg. Commission", value: p(stats.avgCommissionPct), sub: "last 12 mo", color: COLORS.green },
    { label: "Avg. Commission Gross", value: m(stats.avgCommissionGross), sub: "per deal, last 12 mo", color: COLORS.green },
  ];
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.navy, marginBottom: 4 }}>My Sales Stats</div>
      <div style={{ fontSize: 13, color: COLORS.gray, marginBottom: 16 }}>Your live pipeline plus your real production averages over the last 12 months ({stats.closed12mo ?? 0} closed deal{stats.closed12mo === 1 ? "" : "s"}).</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {cards.map(c => <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} color={c.color} />)}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB — ACTIVITIES REPORT (Calls/Conversations/Appointments/Pop-bys)
// ════════════════════════════════════════════════════════════════
function ActivitiesReportTab() {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    authFetch(`/reports/activities-report?year=${year}&period=${period}`)
      .then(d => setData(d)).catch(() => setData(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year, period]);

  const cols = data?.columns || [];
  const exportCsv = () => {
    if (!data) return;
    const head = ["Period"];
    cols.forEach(c => head.push(`${c.label} Actual`, `${c.label} Goal`, `${c.label} %`));
    const lines = [head.join(",")];
    const cellVals = (row) => { const o = [row.label]; cols.forEach(c => { const cell = row[c.key] || {}; o.push(cell.actual ?? "", cell.goal ?? "", cell.pct == null ? "" : cell.pct + "%"); }); return o.join(","); };
    data.rows.forEach(r => lines.push(cellVals(r)));
    lines.push(cellVals({ ...data.totals, label: "TOTAL" }));
    if (data.lastYearTotal) { const o = ["Last Year (total)"]; cols.forEach(c => o.push(data.lastYearTotal[c.key] ?? "", "", "")); lines.push(o.join(",")); }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `activities-report-${year}-${period}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const th = { padding: "8px 10px", fontSize: 11, fontWeight: 700, color: COLORS.navy, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${COLORS.border}`, textAlign: "center" };
  const td = { padding: "8px 10px", fontSize: 13, textAlign: "center", borderBottom: `1px solid ${COLORS.light}` };
  const pctColor = (p) => p == null ? COLORS.gray : p >= 100 ? COLORS.green : p >= 70 ? COLORS.gold : COLORS.red;

  return (
    <div>
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.navy, marginRight: "auto" }}>Activities Report</div>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontFamily: "inherit", fontSize: 13 }}>
          {[nowYear, nowYear - 1, nowYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
          {["month", "week"].map(pp => (
            <button key={pp} onClick={() => setPeriod(pp)} style={{ padding: "8px 14px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", textTransform: "capitalize", background: period === pp ? COLORS.navy : "#fff", color: period === pp ? "#fff" : COLORS.gray }}>{pp}</button>
          ))}
        </div>
        <button onClick={exportCsv} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>⬇ Export Data</button>
      </div>
      <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 12 }}>Pulled automatically from the calls you log in Win-the-Day and the pop-bys you deliver. Goals come from your income plan.</div>

      {loading ? <div style={{ color: COLORS.gray }}>Loading…</div> : !data ? <div style={{ color: COLORS.gray }}>Could not load report.</div> : (
        <div style={{ overflowX: "auto", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>{period === "month" ? "Month" : "Week of"}</th>
                {cols.map(c => <th key={c.key} style={th} colSpan={3}>{c.label}</th>)}
              </tr>
              <tr>
                <th style={th}></th>
                {cols.map(c => <React.Fragment key={c.key}><th style={{ ...th, fontSize: 10 }}>Actual</th><th style={{ ...th, fontSize: 10 }}>Goal</th><th style={{ ...th, fontSize: 10 }}>%</th></React.Fragment>)}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{row.label}</td>
                  {cols.map(c => { const cell = row[c.key] || {}; return (
                    <React.Fragment key={c.key}>
                      <td style={{ ...td, fontWeight: 700 }}>{cell.actual ?? 0}</td>
                      <td style={{ ...td, color: COLORS.gray }}>{cell.goal ?? "—"}</td>
                      <td style={{ ...td, fontWeight: 700, color: pctColor(cell.pct) }}>{cell.pct == null ? "—" : cell.pct + "%"}</td>
                    </React.Fragment>
                  ); })}
                </tr>
              ))}
              <tr style={{ background: COLORS.light }}>
                <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>TOTAL</td>
                {cols.map(c => { const cell = data.totals[c.key] || {}; return (
                  <React.Fragment key={c.key}>
                    <td style={{ ...td, fontWeight: 800 }}>{cell.actual ?? 0}</td>
                    <td style={{ ...td, color: COLORS.gray, fontWeight: 700 }}>{cell.goal ?? "—"}</td>
                    <td style={{ ...td, fontWeight: 800, color: pctColor(cell.pct) }}>{cell.pct == null ? "—" : cell.pct + "%"}</td>
                  </React.Fragment>
                ); })}
              </tr>
              {data.lastYearTotal && (
                <tr>
                  <td style={{ ...td, textAlign: "left", fontStyle: "italic", color: COLORS.gray }}>Last Year (total)</td>
                  {cols.map(c => (
                    <React.Fragment key={c.key}>
                      <td style={{ ...td, color: COLORS.gray }}>{data.lastYearTotal[c.key] ?? 0}</td>
                      <td style={td}></td><td style={td}></td>
                    </React.Fragment>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Reports({ transactions, onBack, currentUser, initialTab = "overview" }) {
  const [tab, setTab] = useState(initialTab);
  const isAdmin = ["admin", "superadmin"].includes(currentUser?.role);

  const TABS = [
    { id: "overview", label: "📊 Overview" },
    { id: "sales-stats", label: "🏆 Sales Stats" },
    { id: "activities", label: "✅ Activities Report" },
    { id: "activity", label: "📞 Activity & Conversion" },
    { id: "goals", label: "🎯 Goal Planner" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F4F4F4", fontFamily: "system-ui, sans-serif" }}>
      <style>{PRINT_STYLES}</style>
      <div className="no-print" style={{ background: "#111", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        {/* Labeled back button — a bare "←" was easy to miss; users couldn't tell
            how to get back (esp. mid-onboarding) and resorted to browser back. (tester #22) */}
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", borderRadius: 8, padding: "7px 14px", fontFamily: "inherit" }}>← Back</button>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>📊 Reports & Analytics</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>🖨️ Print Report</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print" style={{ background: "#fff", borderBottom: "1px solid #DDD", padding: "0 24px", display: "flex", gap: 4, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "14px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 14,
            fontWeight: tab === t.id ? 800 : 600, color: tab === t.id ? COLORS.red : COLORS.gray,
            borderBottom: tab === t.id ? `3px solid ${COLORS.red}` : "3px solid transparent", fontFamily: "inherit", whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      <div id="reports-printable" style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        {tab === "overview" && <OverviewTab transactions={transactions} />}
        {tab === "sales-stats" && <SalesStatsTab />}
        {tab === "activities" && <ActivitiesReportTab />}
        {tab === "activity" && <ActivityTab isAdmin={isAdmin} />}
        {tab === "goals" && <GoalPlannerTab transactions={transactions} />}
      </div>
    </div>
  );
}
