import React, { useEffect, useState } from "react";
const API = "https://liz-team-server-api-production.up.railway.app";

// Phone-friendly magic form: the agent answers ONLY the missing business-term
// questions an assistant/TC needs to finish the listing package. No login —
// the tokenized link is the credential (7-day expiry, field-whitelisted).
export default function FillInfoPublic({ token }) {
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/fill-info/${token}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); else setErr(d.error || "Link problem"); })
      .catch(() => setErr("Could not load — check your connection."));
  }, [token]);

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/public/fill-info/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Could not save");
      setDone(true);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const box = { maxWidth: 480, margin: "40px auto", padding: 24, fontFamily: "'Segoe UI', system-ui, sans-serif" };
  if (err && !data) return <div style={box}><h2>⚠️ {err}</h2></div>;
  if (!data) return <div style={box}>Loading…</div>;
  if (done) return (
    <div style={box}>
      <h2 style={{ color: "#166534" }}>✅ Done — thank you!</h2>
      <p style={{ color: "#374151", lineHeight: 1.6 }}>Your answers are saved on <b>{data.address}</b> and your team has been notified. The listing package can continue — you can close this page.</p>
    </div>
  );
  return (
    <div style={box}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: ".05em" }}>TransactPro · Quick answers needed</div>
      <h2 style={{ margin: "6px 0 4px" }}>{data.address}</h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>Your team is preparing the listing package and needs {data.fields.length === 1 ? "one answer" : `${data.fields.length} answers`} from you. Takes under a minute.</p>
      {data.fields.map(f => (
        <div key={f.key} style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5 }}>{f.label}</label>
          <input
            type={f.key === "terminationDate" ? "date" : "text"}
            defaultValue={f.current ?? ""}
            placeholder={f.key === "price" ? "e.g. 450000" : f.key.includes("Pct") || f.key.includes("Comp") ? "e.g. 2.5" : ""}
            onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            style={{ width: "100%", padding: "12px 14px", fontSize: 16, borderRadius: 10, border: "1px solid #d1d5db", boxSizing: "border-box" }}
          />
        </div>
      ))}
      {err && <div style={{ color: "#b91c1c", marginBottom: 12 }}>⚠️ {err}</div>}
      <button onClick={submit} disabled={busy}
        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "#1E8449", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
        {busy ? "Saving…" : "✅ Save my answers"}
      </button>
    </div>
  );
}
