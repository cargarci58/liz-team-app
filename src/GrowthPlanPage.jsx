import React, { useState, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════════
// GROWTH PLAN — a dead-simple, vision-clear business plan for an agent.
// "How much do you want to earn?" → the app back-calculates the daily
// activity that gets you there (1-year plan), then lays out a 5-year
// vision ladder for the track you choose.
// The income goal is ONE shared number — the same one in Financials →
// Budget and Reports → Goal Planner. Everything autosaves.
// ════════════════════════════════════════════════════════════════
const API = "https://liz-team-server-api-production.up.railway.app";
const authFetch = async (path, options = {}) => {
  const token = localStorage.getItem("tp_token") || "";
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

const C = {
  red: "#C0392B", navy: "#1A2B4A", ink: "#222", gray: "#666", line: "#E3E3E3",
  bg: "#F7F7F8", white: "#fff", gold: "#B7860B", green: "#1E8449", blue: "#1A5276",
};
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString();

// Mirrors the server funnel so the numbers update instantly as you type.
const RATES = { dialToConv: 0.12, convToAppt: 0.20, apptToContract: 0.45, contractToClose: 0.90 };
function calcFunnel(incomeGoal, avgNet) {
  const ceil = (n) => (isFinite(n) && n > 0 ? Math.ceil(n) : 0);
  const closings = ceil(incomeGoal / (avgNet || 1));
  const contracts = ceil(closings / RATES.contractToClose);
  const appointments = ceil(contracts / RATES.apptToContract);
  const conversations = ceil(appointments / RATES.convToAppt);
  const dials = ceil(conversations / RATES.dialToConv);
  return {
    closings, appointments, conversations,
    closingsPerMonth: Math.round((closings / 12) * 10) / 10,
    appointmentsPerWeek: Math.round((appointments / 50) * 10) / 10,
    conversationsPerWeek: ceil(conversations / 50),
    dialsPerWeek: ceil(dials / 50),
    dialsPerDay: ceil(dials / 250),
  };
}

// Client-side ladders (mirror the server) so picking a track changes the
// 5-year plan INSTANTLY, no save round-trip.
const LADDERS = {
  solo: [
    { year: 1, theme: "Survive & Build the Base", moves: ["Hit your income goal", "Add 200+ people to your database", "Lock in a daily lead-gen habit"] },
    { year: 2, theme: "Get Consistent", moves: ["Repeat last year without the panic", "30%+ of deals from repeat/referral", "Systematize your follow-up"] },
    { year: 3, theme: "Systematize", moves: ["Document your transaction process", "Hire your first help (TC or assistant)", "Raise average sale price or count"] },
    { year: 4, theme: "Leverage", moves: ["Offload admin completely", "Add a showing/buyer partner", "Protect your time for dollar-productive work"] },
    { year: 5, theme: "Scale or Choose Freedom", moves: ["Double your year-1 income", "Decide: stay leveraged-solo or build a team", "Bank a real reserve"] },
  ],
  team: [
    { year: 1, theme: "Foundation", moves: ["Hit your income goal solo", "Prove a repeatable lead source", "Save toward your first hire"] },
    { year: 2, theme: "First Hire", moves: ["Bring on an admin/TC", "Free 10+ hours/week for selling", "Standardize client experience"] },
    { year: 3, theme: "Build the Team", moves: ["Add your first buyer's agent", "Generate enough leads to feed them", "Define splits & accountability"] },
    { year: 4, theme: "Team Systems", moves: ["2-3 agents producing", "CRM + onboarding playbook", "Lead-gen budget that scales"] },
    { year: 5, theme: "Lead the Team", moves: ["You list, the team sells", "Team out-produces old solo-you 3x+", "Step toward owner, not operator"] },
  ],
  brokerage: [
    { year: 1, theme: "Master the Craft", moves: ["Hit your income goal", "Learn every part of the deal", "Build a referral-worthy reputation"] },
    { year: 2, theme: "Build a Team", moves: ["Hire admin + first agent", "Create your value proposition", "Track team-level numbers"] },
    { year: 3, theme: "Scale the Team", moves: ["5+ agents", "Recruiting becomes a system", "Profit beyond your own production"] },
    { year: 4, theme: "Prepare to Brokerage", moves: ["Study the brokerage model & compliance", "Build recruiting + training engine", "Secure capital/runway"] },
    { year: 5, theme: "Open / Run a Brokerage", moves: ["Launch or buy a brokerage", "Income largely independent of personal sales", "Lead a profitable office"] },
  ],
};

const TRACKS = [
  { id: "solo", emoji: "🧍", name: "Solo Pro", tag: "Stay independent, work smart, keep more." },
  { id: "team", emoji: "👥", name: "Build a Team", tag: "Hire help, then agents — multiply yourself." },
  { id: "brokerage", emoji: "🏢", name: "Open a Brokerage", tag: "Grow into an owner who leads an office." },
];

const Q_CHECKLIST = [
  { q: "Q1 — Foundation", items: [
    { id: "q1a", t: "Set my income goal & know my daily number" },
    { id: "q1b", t: "Put 200+ people into my database/CRM" },
    { id: "q1c", t: "Lock in a daily lead-gen time block" },
  ] },
  { q: "Q2 — Momentum", items: [
    { id: "q2a", t: "Hit my appointments-per-week target" },
    { id: "q2b", t: "Ask every closed client for a review + referral" },
    { id: "q2c", t: "Start one consistent marketing habit (social/email)" },
  ] },
  { q: "Q3 — Consistency", items: [
    { id: "q3a", t: "On pace for half my yearly closings" },
    { id: "q3b", t: "Review my numbers vs. plan, adjust" },
    { id: "q3c", t: "Build a simple follow-up system" },
  ] },
  { q: "Q4 — Finish & Plan", items: [
    { id: "q4a", t: "Hit my income goal" },
    { id: "q4b", t: "Write next year's goal" },
    { id: "q4c", t: "Decide my next move on the 5-year ladder" },
  ] },
];

function StatCard({ big, label, sub, color }) {
  return (
    <div style={{ flex: "1 1 130px", background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || C.navy, lineHeight: 1.1 }}>{big}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function GrowthPlanPage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(""); // "", "saving", "saved", "error"
  const [incomeGoal, setIncomeGoal] = useState(100000);
  const [avgNet, setAvgNet] = useState(7500);
  const [track, setTrack] = useState("solo");
  const [why, setWhy] = useState("");
  const [checklist, setChecklist] = useState({});
  const [goalSource, setGoalSource] = useState("default");
  const hydrated = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    authFetch("/growth-plan")
      .then(d => {
        if (d.plan) {
          setIncomeGoal(Number(d.plan.incomeGoal) || 100000);
          setAvgNet(Number(d.plan.avgNetPerDeal) || 7500);
          setTrack(d.plan.visionTrack || "solo");
          setWhy(d.plan.why || "");
          setChecklist(d.plan.year1Checklist || {});
          setGoalSource(d.plan.goalSource || "default");
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setTimeout(() => { hydrated.current = true; }, 0); });
  }, []);

  // Autosave: whenever anything changes (after the initial load), persist after a
  // short pause so the agent never has to hunt for a Save button.
  useEffect(() => {
    if (!hydrated.current) return;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { doSave(); }, 700);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomeGoal, avgNet, track, why, checklist]);

  const doSave = async () => {
    try {
      await authFetch("/growth-plan", {
        method: "PUT",
        body: JSON.stringify({ incomeGoal, avgNetPerDeal: avgNet, visionTrack: track, why, year1Checklist: checklist }),
      });
      setGoalSource("financials");
      setStatus("saved");
      setTimeout(() => setStatus(s => (s === "saved" ? "" : s)), 2500);
    } catch { setStatus("error"); }
  };

  const toggle = (id) => setChecklist(c => ({ ...c, [id]: !c[id] }));

  const oneYear = calcFunnel(Number(incomeGoal) || 0, Number(avgNet) || 0);
  const ladder = LADDERS[track] || LADDERS.solo;
  const allItems = Q_CHECKLIST.flatMap(q => q.items);
  const doneCount = allItems.filter(i => checklist[i.id]).length;
  const pct = Math.round((doneCount / allItems.length) * 100);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.gray }}>Loading your plan…</div>;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "16px 16px 60px", fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.ink }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: C.gray, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🎯 My Growth Plan</div>
          <div style={{ fontSize: 13, color: C.gray }}>Where you're going this year — and over the next five.</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, minWidth: 70, textAlign: "right", color: status === "error" ? C.red : status === "saving" ? C.gray : C.green }}>
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : status === "error" ? "Save failed" : ""}
        </div>
      </div>

      {/* THE NUMBER */}
      <div style={{ background: C.navy, color: C.white, borderRadius: 16, padding: 22, marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", opacity: 0.8 }}>Start with one number</div>
        <div style={{ fontSize: 15, margin: "8px 0 14px" }}>How much do you want to earn this year?</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Income goal</div>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "4px 12px" }}>
              <span style={{ fontSize: 20, fontWeight: 700 }}>$</span>
              <input value={incomeGoal} onChange={e => setIncomeGoal(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric"
                style={{ background: "none", border: "none", color: "#fff", fontSize: 22, fontWeight: 800, width: 150, fontFamily: "inherit", outline: "none" }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Avg. net commission per deal</div>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "4px 12px" }}>
              <span style={{ fontSize: 20, fontWeight: 700 }}>$</span>
              <input value={avgNet} onChange={e => setAvgNet(e.target.value.replace(/\D/g, "").slice(0, 7))} inputMode="numeric"
                style={{ background: "none", border: "none", color: "#fff", fontSize: 22, fontWeight: 800, width: 110, fontFamily: "inherit", outline: "none" }} />
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 12, lineHeight: 1.5 }}>
          🔗 This is your <b>one</b> income goal — the same number in <b>Financials → Budget</b> and <b>Reports → Goal Planner</b>. Change it here and it updates everywhere{goalSource === "financials" ? " (currently in sync with Financials)" : ""}.
        </div>
      </div>

      {/* 1-YEAR BACK-CALC — updates live as you type */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Your 1-Year Plan</div>
        <div style={{ fontSize: 13, color: C.gray, marginBottom: 12 }}>To earn <b>{money(incomeGoal)}</b>, here's what it takes — broken down so you always know your daily number.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          <StatCard big={oneYear.closings} label="closings this year" sub={`~${oneYear.closingsPerMonth}/month`} color={C.red} />
          <StatCard big={oneYear.appointments} label="appointments" sub={`~${oneYear.appointmentsPerWeek}/week`} color={C.gold} />
          <StatCard big={oneYear.conversations} label="real conversations" sub={`~${oneYear.conversationsPerWeek}/week`} color={C.blue} />
          <StatCard big={oneYear.dialsPerDay} label="outreach/day" sub={`~${oneYear.dialsPerWeek}/week`} color={C.green} />
        </div>
        <div style={{ fontSize: 12, color: C.gray, background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
          💡 The big idea: <b>{oneYear.dialsPerDay} meaningful outreach touches a day</b> (calls, texts, DMs, door-knocks) feeds the whole plan. Fine-tune the conversion rates anytime in <b>Reports → Goal Planner</b>.
        </div>
      </div>

      {/* YEAR-1 CHECKLIST with live progress */}
      <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, textTransform: "uppercase", letterSpacing: 1 }}>This Year, Quarter by Quarter</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: pct === 100 ? C.green : C.gray }}>{doneCount}/{allItems.length}</div>
        </div>
        {/* progress bar */}
        <div style={{ background: C.bg, borderRadius: 8, height: 12, overflow: "hidden", margin: "8px 0 4px" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? C.green : C.gold, transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? C.green : C.gray, marginBottom: 14 }}>
          {pct === 100 ? "🎉 You completed your year-1 plan — outstanding!" : `${pct}% of your year-1 plan done`}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {Q_CHECKLIST.map(q => {
            const qDone = q.items.filter(it => checklist[it.id]).length;
            const qComplete = qDone === q.items.length;
            return (
              <div key={q.q} style={{ flex: "1 1 180px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: qComplete ? C.green : C.gold, marginBottom: 8 }}>
                  {qComplete ? "✓ " : ""}{q.q} <span style={{ color: C.gray, fontWeight: 600 }}>({qDone}/{q.items.length})</span>
                </div>
                {q.items.map(it => (
                  <label key={it.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!checklist[it.id]} onChange={() => toggle(it.id)} style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: C.green }} />
                    <span style={{ fontSize: 13, color: checklist[it.id] ? C.gray : C.ink, textDecoration: checklist[it.id] ? "line-through" : "none", lineHeight: 1.4 }}>{it.t}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5-YEAR VISION TRACK — ladder changes instantly on click */}
      <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Your 5-Year Vision</div>
      <div style={{ fontSize: 13, color: C.gray, marginBottom: 12 }}>Pick the path that fits where you want to be — the ladder below updates to match.</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        {TRACKS.map(t => (
          <button key={t.id} onClick={() => setTrack(t.id)} style={{
            flex: "1 1 200px", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
            background: track === t.id ? C.navy : C.white, color: track === t.id ? C.white : C.ink,
            border: `2px solid ${track === t.id ? C.navy : C.line}`, borderRadius: 12, padding: 14,
          }}>
            <div style={{ fontSize: 20 }}>{t.emoji}{track === t.id ? "  ✓" : ""}</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{t.name}</div>
            <div style={{ fontSize: 12, opacity: track === t.id ? 0.85 : 0.7, marginTop: 2 }}>{t.tag}</div>
          </button>
        ))}
      </div>

      {/* THE LADDER */}
      <div style={{ marginBottom: 22 }}>
        {ladder.map((y, i) => (
          <div key={y.year} style={{ display: "flex", gap: 14, marginBottom: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: i === 0 ? C.red : C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>Y{y.year}</div>
              {i < ladder.length - 1 && <div style={{ width: 2, flex: 1, background: C.line, minHeight: 18 }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{y.theme}</div>
              <div style={{ marginTop: 4 }}>
                {(y.moves || []).map((m, j) => (
                  <div key={j} style={{ fontSize: 13, color: C.gray, lineHeight: 1.5 }}>• {m}</div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* YOUR WHY */}
      <div style={{ background: C.bg, borderRadius: 14, padding: 18, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Why this matters to you</div>
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 8 }}>On the hard days, this is what you come back to.</div>
        <textarea value={why} onChange={e => setWhy(e.target.value)} placeholder="e.g. Give my kids options I never had. Pay off the house in 5 years. Build something that outlasts me."
          rows={3} style={{ width: "100%", fontSize: 14, padding: 12, border: `1px solid ${C.line}`, borderRadius: 10, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
      </div>

      <div style={{ fontSize: 12, color: C.gray, textAlign: "center" }}>Everything on this page saves automatically.</div>
    </div>
  );
}
