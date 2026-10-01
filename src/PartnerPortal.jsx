import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// PARTNER LINK page (/partner/<token>) — an outside co-agent or referring agent
// follows ONLY the deals shared with them: status, timeline steps, closing date
// and their payout. Link + their own 4-digit PIN; read-only. The partner session
// is kept under its own key (never tp_token) so it can't mix with an app login.
const C = { red: "#C0392B", dark: "#922B21", gray: "#F4F4F4", blue: "#0c4a6e", text: "#1f2937", muted: "#6b7280", border: "#E5E7EB" };
const KEY = "tp_partner_session";
const fmtDate = (d) => d ? new Date(String(d).slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString();

export default function PartnerPortal({ urlToken }) {
  const [stage, setStage] = useState("loading");   // loading | pin | deals | error
  const [mode, setMode] = useState("verify");
  const [step, setStep] = useState(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [tab, setTab] = useState("timeline");   // timeline | people | messages | documents | notes (co-agents)

  const loadDeals = async (session) => {
    const r = await fetch(API + "/partner/deals", { headers: { Authorization: "Bearer " + session } });
    if (!r.ok) throw new Error("expired");
    const d = await r.json();
    setData(d); setStage("deals");
  };

  useEffect(() => {
    (async () => {
      let s = null;
      try { s = localStorage.getItem(KEY); } catch {}
      if (s) { try { await loadDeals(s); return; } catch { try { localStorage.removeItem(KEY); } catch {} } }
      try {
        const r = await fetch(API + "/partner/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: urlToken }) });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error(d.error || "This link isn't valid.");
        setMode(d.mode); setStep(d.stepToken); setStage("pin");
      } catch (e) { setErr(e.message); setStage("error"); }
    })();
    // eslint-disable-next-line
  }, []);

  const submitPin = async () => {
    setErr("");
    if (!/^\d{4}$/.test(pin)) { setErr("Enter 4 digits."); return; }
    if (mode === "setup" && pin !== pin2) { setErr("The two PINs don't match."); return; }
    try {
      const r = await fetch(API + "/partner/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stepToken: step, pin }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't sign in.");
      try { localStorage.setItem(KEY, d.session); } catch {}
      await loadDeals(d.session);
    } catch (e) { setErr(e.message); setPin(""); }
  };

  const shell = (children) => (
    <div style={{ minHeight: "100vh", background: C.gray, fontFamily: "system-ui, -apple-system, sans-serif", color: C.text }}>
      <div style={{ background: "#111", color: "#fff", padding: "14px 16px", fontWeight: 800 }}>🤝 Shared deals <span style={{ fontWeight: 500, opacity: 0.7, fontSize: 13 }}>· TransactPro</span></div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>{children}</div>
    </div>
  );
  const card = { background: "#fff", border: "1px solid " + C.border, borderRadius: 12, padding: 16, marginBottom: 12 };
  const inp = { padding: "12px 14px", fontSize: 20, letterSpacing: 8, textAlign: "center", border: "1px solid " + C.border, borderRadius: 10, width: 160, fontFamily: "inherit" };

  if (stage === "loading") return shell(<div style={{ color: C.muted }}>Opening…</div>);
  if (stage === "error") return shell(<div style={card}><b>Can't open this link.</b><div style={{ color: C.muted, marginTop: 6 }}>{err}</div></div>);
  if (stage === "pin") return shell(
    <div style={{ ...card, textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{mode === "setup" ? "Pick a 4-digit PIN" : "Enter your PIN"}</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{mode === "setup" ? "You'll use it every time you open this link." : "The 4-digit PIN you picked the first time."}</div>
      <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" style={inp} placeholder="••••" />
      {mode === "setup" && <div style={{ marginTop: 10 }}><input value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" style={inp} placeholder="again" /></div>}
      <div><button onClick={submitPin} style={{ marginTop: 14, padding: "11px 26px", borderRadius: 10, border: "none", background: C.red, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Open my deals</button></div>
      {err && <div style={{ color: C.dark, fontWeight: 700, marginTop: 10, fontSize: 13 }}>{err}</div>}
    </div>
  );

  const deals = (data && data.deals) || [];
  return shell(<>
    <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Deals shared with <b>{data.email}</b>. Read-only — questions go to the deal's agent.</div>
    {/* Co-agents work their deals in TransactPro — this page is only for referral partners. */}
    {(data.coAgentDeals || []).map(c => (
      <div key={"co" + c.id} style={{ ...card, background: "#FADBD8", border: "1px solid #E6B0AA" }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>🤝 {c.address}{c.city ? `, ${c.city}` : ""}</div>
        <div style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>
          You're the <b>co-agent</b> on this deal, so you work it in TransactPro — not on this page.{" "}
          {c.hasLogin ? <>Log in with <b>{data.email}</b> — it's under <b>My Deals</b>. <a href="/" style={{ color: C.red, fontWeight: 800 }}>Log in →</a></>
            : c.invited ? <>Open the invite email from {c.agentName} ("You're co-agent on {c.address}") and tap its link to pick your password.</>
            : <>Ask {c.agentName} to tap <b>Invite co-agent</b> on this deal — you'll get an email to pick your password.</>}
        </div>
      </div>
    ))}
    {deals.length === 0 && !(data.coAgentDeals || []).length && <div style={card}>No deals are shared with you right now.</div>}
    {deals.map(d => {
      const done = d.timeline.filter(m => m.done).length;
      const isOpen = open === d.id;
      return (
        <div key={d.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{d.address}{d.city ? `, ${d.city}` : ""}</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{d.role} · Agent: {d.agent.name}{d.agent.brokerage ? ` (${d.agent.brokerage})` : ""}</div>
            </div>
            <span style={{ alignSelf: "flex-start", background: C.blue, color: "#fff", fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 12 }}>{d.status}</span>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 13 }}>
            <div><div style={{ color: C.muted, fontSize: 11.5 }}>Closing</div><b>{fmtDate(d.closingDate)}</b></div>
            <div><div style={{ color: C.muted, fontSize: 11.5 }}>Timeline</div><b>{done} of {d.timeline.length} steps done</b></div>
            {d.payout != null && <div><div style={{ color: C.muted, fontSize: 11.5 }}>Your {d.role === "Referring agent" ? "referral fee" : "share"} (estimated)</div><b style={{ color: "#166534" }}>{money(d.payout)}</b></div>}
          </div>
          <button onClick={() => { setOpen(isOpen ? null : d.id); setTab("timeline"); }} style={{ marginTop: 10, background: "none", border: "1px solid " + C.border, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: C.blue }}>
            {isOpen ? "Hide timeline" : "Show timeline"}
          </button>
          {isOpen && tab === "timeline" && (
            <div style={{ marginTop: 10 }}>
              {d.timeline.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderTop: "1px solid " + C.gray, fontSize: 13 }}>
                  <span style={{ color: m.done ? C.muted : C.text, textDecoration: m.done ? "line-through" : "none" }}>{m.done ? "✅" : "⬜"} {m.name}</span>
                  <span style={{ color: C.muted, whiteSpace: "nowrap" }}>{fmtDate(m.date)}</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Questions? {d.agent.name}{d.agent.phone ? ` · ${d.agent.phone}` : ""}{d.agent.email ? ` · ${d.agent.email}` : ""}</div>
            </div>
          )}
        </div>
      );
    })}
    <button onClick={() => { try { localStorage.removeItem(KEY); } catch {} window.location.reload(); }} style={{ background: "none", border: "none", color: C.muted, textDecoration: "underline", cursor: "pointer", fontSize: 12.5 }}>Sign out</button>
  </>);
}
