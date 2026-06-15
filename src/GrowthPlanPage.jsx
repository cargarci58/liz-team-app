import React, { useState, useEffect } from "react";

// ════════════════════════════════════════════════════════════════
// GROWTH PLAN — a dead-simple, vision-clear business plan for an agent.
// "How much do you want to earn?" → the app back-calculates the daily
// activity that gets you there (1-year plan), then lays out a 5-year
// vision ladder for the track you choose. Self-contained; no external data.
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

const TRACKS = [
  { id: "solo", emoji: "🧍", name: "Solo Pro", tag: "Stay independent, work smart, keep more." },
  { id: "team", emoji: "👥", name: "Build a Team", tag: "Hire help, then agents — multiply yourself." },
  { id: "brokerage", emoji: "🏢", name: "Open a Brokerage", tag: "Grow into an owner who leads an office." },
];

// Year-1 quarterly focus checklist (the agent checks these off through the year).
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
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [incomeGoal, setIncomeGoal] = useState(100000);
  const [avgNet, setAvgNet] = useState(7500);
  const [track, setTrack] = useState("solo");
  const [why, setWhy] = useState("");
  const [checklist, setChecklist] = useState({});
  const [oneYear, setOneYear] = useState(null);
  const [fiveYear, setFiveYear] = useState([]);

  useEffect(() => {
    authFetch("/growth-plan")
      .then(d => {
        if (d.plan) {
          setIncomeGoal(Number(d.plan.incomeGoal) || 100000);
          setAvgNet(Number(d.plan.avgNetPerDeal) || 7500);
          setTrack(d.plan.visionTrack || "solo");
          setWhy(d.plan.why || "");
          setChecklist(d.plan.year1Checklist || {});
        }
        setOneYear(d.oneYear || null);
        setFiveYear(d.fiveYear || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setSavedMsg("");
    try {
      const d = await authFetch("/growth-plan", {
        method: "PUT",
        body: JSON.stringify({ incomeGoal, avgNetPerDeal: avgNet, visionTrack: track, why, year1Checklist: checklist }),
      });
      setOneYear(d.oneYear || oneYear);
      setFiveYear(d.fiveYear || fiveYear);
      setSavedMsg("Saved ✓");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch { setSavedMsg("Could not save — try again."); }
    setSaving(false);
  };

  const toggle = (id) => setChecklist(c => ({ ...c, [id]: !c[id] }));
  const allItems = Q_CHECKLIST.flatMap(q => q.items);
  const doneCount = allItems.filter(i => checklist[i.id]).length;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.gray }}>Loading your plan…</div>;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "16px 16px 60px", fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.ink }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: C.gray, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>}
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🎯 My Growth Plan</div>
          <div style={{ fontSize: 13, color: C.gray }}>Where you're going this year — and over the next five.</div>
        </div>
      </div>

      {/* THE NUMBER */}
      <div style={{ background: C.navy, color: C.white, borderRadius: 16, padding: 22, marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", opacity: 0.8 }}>Start with one number</div>
        <div style={{ fontSize: 15, margin: "8px 0 14px" }}>How much do you want to earn this year?</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Income goal (net to you)</div>
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
      </div>

      {/* 1-YEAR BACK-CALC */}
      {oneYear && (
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
            💡 The big idea: <b>{oneYear.dialsPerDay} meaningful outreach touches a day</b> (calls, texts, DMs, door-knocks) is what feeds the whole plan. Fine-tune the conversion rates anytime in <b>Reports → Goal Planner</b>.
          </div>
        </div>
      )}

      {/* YEAR-1 CHECKLIST */}
      <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, textTransform: "uppercase", letterSpacing: 1 }}>This Year, Quarter by Quarter</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: doneCount === allItems.length ? C.green : C.gray }}>{doneCount}/{allItems.length} done</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {Q_CHECKLIST.map(q => (
            <div key={q.q} style={{ flex: "1 1 180px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.gold, marginBottom: 8 }}>{q.q}</div>
              {q.items.map(it => (
                <label key={it.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!checklist[it.id]} onChange={() => toggle(it.id)} style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: checklist[it.id] ? C.gray : C.ink, textDecoration: checklist[it.id] ? "line-through" : "none", lineHeight: 1.4 }}>{it.t}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 5-YEAR VISION TRACK */}
      <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Your 5-Year Vision</div>
      <div style={{ fontSize: 13, color: C.gray, marginBottom: 12 }}>Pick the path that fits where you want to be. Your ladder updates to match.</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        {TRACKS.map(t => (
          <button key={t.id} onClick={() => setTrack(t.id)} style={{
            flex: "1 1 200px", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
            background: track === t.id ? C.navy : C.white, color: track === t.id ? C.white : C.ink,
            border: `2px solid ${track === t.id ? C.navy : C.line}`, borderRadius: 12, padding: 14,
          }}>
            <div style={{ fontSize: 20 }}>{t.emoji}</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{t.name}</div>
            <div style={{ fontSize: 12, opacity: track === t.id ? 0.85 : 0.7, marginTop: 2 }}>{t.tag}</div>
          </button>
        ))}
      </div>

      {/* THE LADDER */}
      <div style={{ marginBottom: 22 }}>
        {fiveYear.map((y, i) => (
          <div key={y.year} style={{ display: "flex", gap: 14, marginBottom: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: i === 0 ? C.red : C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>Y{y.year}</div>
              {i < fiveYear.length - 1 && <div style={{ width: 2, flex: 1, background: C.line, minHeight: 18 }} />}
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
      <div style={{ background: C.bg, borderRadius: 14, padding: 18, marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.navy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Why this matters to you</div>
        <div style={{ fontSize: 12, color: C.gray, marginBottom: 8 }}>On the hard days, this is what you come back to.</div>
        <textarea value={why} onChange={e => setWhy(e.target.value)} placeholder="e.g. Give my kids options I never had. Pay off the house in 5 years. Build something that outlasts me."
          rows={3} style={{ width: "100%", fontSize: 14, padding: 12, border: `1px solid ${C.line}`, borderRadius: 10, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
      </div>

      {/* SAVE */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, position: "sticky", bottom: 0, background: "linear-gradient(transparent, #fff 40%)", padding: "14px 0" }}>
        <button onClick={save} disabled={saving} style={{ background: C.red, color: "#fff", border: "none", borderRadius: 10, padding: "13px 28px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
          {saving ? "Saving…" : "Save My Plan"}
        </button>
        {savedMsg && <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{savedMsg}</span>}
      </div>
    </div>
  );
}
