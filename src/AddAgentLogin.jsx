import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// /add-agent-login/<token> — a co-agent whose email already has a CLIENT login
// adds an agent login to their OWN account (same email). Only the inbox owner
// has this link; setting the password here is what adds it. Then every deal
// that names this email as co-agent opens in their app with full access.
export default function AddAgentLogin({ urlToken }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    fetch(API + "/public/add-agent-login?token=" + encodeURIComponent(urlToken)).then(r => r.json())
      .then(d => { if (d.success) setInfo(d); else setErr(d.error || "This link isn't valid."); }).catch(() => setErr("Something went wrong."));
  }, [urlToken]);
  const submit = async () => {
    setErr("");
    if (pw.length < 8) { setErr("Use at least 8 characters."); return; }
    if (pw !== pw2) { setErr("The two passwords don't match."); return; }
    setBusy(true);
    try {
      const r = await fetch(API + "/public/add-agent-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: urlToken, newPassword: pw }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't save");
      try { localStorage.removeItem("tp_token"); localStorage.removeItem("tp_user"); } catch {}
      setDone(true);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const box = { maxWidth: 440, margin: "40px auto", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 24, fontFamily: "system-ui, -apple-system, sans-serif", color: "#1f2937" };
  const inp = { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 15, marginTop: 4, marginBottom: 12, fontFamily: "inherit" };
  return (
    <div style={{ background: "#F4F4F4", minHeight: "100vh", padding: "1px 16px" }}>
      <div style={box}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>🤝 Your TransactPro agent login</div>
        {!info && !err && <div style={{ color: "#6b7280" }}>Loading…</div>}
        {err && !done && <div style={{ color: "#922B21", fontWeight: 700, marginBottom: 10 }}>{err}</div>}
        {info && !done && <>
          <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 16, lineHeight: 1.5 }}>
            {info.alreadyAgent ? <>Set a password for <b>{info.email}</b>.</> : <>You've been added as a co-agent. This adds an <b>agent login</b> to <b>{info.email}</b> — same email; your client access stays.</>}
            {" "}Pick the password you'll log in with.
          </div>
          <label style={{ fontSize: 13, color: "#6b7280" }}>Password (8+ characters)<input type="password" value={pw} onChange={e => setPw(e.target.value)} style={inp} /></label>
          <label style={{ fontSize: 13, color: "#6b7280" }}>Same password again<input type="password" value={pw2} onChange={e => setPw2(e.target.value)} style={inp} /></label>
          <button disabled={busy} onClick={submit} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "#C0392B", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>{busy ? "Saving…" : "Add my agent login"}</button>
        </>}
        {done && <>
          <div style={{ fontSize: 15, marginBottom: 14 }}>✅ Done. Log in with <b>{info && info.email}</b> and your new password — the shared deal is under <b>My Deals</b>, with everything you need to work it.</div>
          <a href="/" style={{ display: "block", textAlign: "center", padding: "12px 0", borderRadius: 10, background: "#C0392B", color: "#fff", fontWeight: 800, textDecoration: "none" }}>Log in →</a>
        </>}
      </div>
    </div>
  );
}
