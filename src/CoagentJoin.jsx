import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// /join-deal/<token> (and older /add-agent-login/<token> links) — the ONE page a
// co-agent lands on from "Invite co-agent". Whoever they are:
//   new_login       → pick a password → their free TransactPro login is created
//   add_agent_login → their email has a client login → pick a password → the same
//                     email also gets an agent login (client access stays)
//   linked          → already an agent → just confirm; no password change, ever
// Then every deal naming this email as co-agent opens in their app, fully workable.
export default function CoagentJoin({ urlToken }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    fetch(API + "/public/coagent-join?token=" + encodeURIComponent(urlToken)).then(r => r.json())
      .then(d => { if (d.success) setInfo(d); else setErr(d.error || "This link isn't valid."); }).catch(() => setErr("Something went wrong."));
  }, [urlToken]);
  const submit = async () => {
    setErr("");
    if (info.mode !== "linked") {
      if (pw.length < 8) { setErr("Use at least 8 characters."); return; }
      if (pw !== pw2) { setErr("The two passwords don't match."); return; }
    }
    setBusy(true);
    try {
      const r = await fetch(API + "/public/coagent-join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: urlToken, newPassword: pw }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't save");
      try { localStorage.removeItem("tp_token"); localStorage.removeItem("tp_user"); } catch {}
      setDone(true);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const box = { maxWidth: 460, margin: "40px auto", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 24, fontFamily: "system-ui, -apple-system, sans-serif", color: "#1f2937" };
  const inp = { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 15, marginTop: 4, marginBottom: 12, fontFamily: "inherit" };
  const deals = (info && info.deals) || [];
  return (
    <div style={{ background: "#F4F4F4", minHeight: "100vh", padding: "1px 16px" }}>
      <div style={box}>
        <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 6 }}>🤝 Join the deal as co-agent</div>
        {!info && !err && <div style={{ color: "#6b7280" }}>Loading…</div>}
        {err && !done && <div style={{ color: "#922B21", fontWeight: 700, marginBottom: 10 }}>{err}</div>}
        {info && !done && <>
          {deals.length > 0 && (
            <div style={{ background: "#F4F4F4", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, marginBottom: 14 }}>
              {deals.map((d, i) => <div key={i}><b>{d.address}</b>{d.agent_name ? ` — with ${d.agent_name}` : ""}</div>)}
            </div>
          )}
          <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 16, lineHeight: 1.5 }}>
            {info.mode === "linked" ? <>You already have a TransactPro login (<b>{info.email}</b>). Tap below and the deal is added to your <b>My Deals</b>.</>
              : info.mode === "add_agent_login" ? <><b>{info.email}</b> already has a TransactPro client login. Pick a password to add an <b>agent login</b> to the same email — your client access stays.</>
              : <>Pick a password for your free TransactPro login (<b>{info.email}</b>). You'll work the deal there — people, messages, documents, timeline, every tool.</>}
          </div>
          {info.mode !== "linked" && <>
            <label style={{ fontSize: 13, color: "#6b7280" }}>Password (8+ characters)<input type="password" value={pw} onChange={e => setPw(e.target.value)} style={inp} /></label>
            <label style={{ fontSize: 13, color: "#6b7280" }}>Same password again<input type="password" value={pw2} onChange={e => setPw2(e.target.value)} style={inp} /></label>
          </>}
          <button disabled={busy} onClick={submit} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "#C0392B", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
            {busy ? "Saving…" : info.mode === "linked" ? "Add the deal to my account" : "Join the deal"}
          </button>
        </>}
        {done && <>
          <div style={{ fontSize: 15, marginBottom: 14, lineHeight: 1.5 }}>✅ You're in. Log in with <b>{info && info.email}</b>{info && info.mode !== "linked" ? " and the password you just picked" : ""} — the deal is under <b>My Deals</b>.</div>
          <a href="/" style={{ display: "block", textAlign: "center", padding: "12px 0", borderRadius: 10, background: "#C0392B", color: "#fff", fontWeight: 800, textDecoration: "none" }}>Log in →</a>
        </>}
      </div>
    </div>
  );
}
