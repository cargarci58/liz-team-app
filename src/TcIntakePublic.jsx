import { useState, useEffect } from "react";

// Public intake questionnaire — an agent or client submits a deal to a transaction
// coordinator. No login. Lands in the coordinator's portal as a pending request.
const API = "https://liz-team-server-api-production.up.railway.app";
const C = { ink: "#111", red: "#C0392B", bg: "#F7F4F2", line: "#e2ded9", muted: "#6b6b6b", green: "#1e8449" };
const money = (n) => n == null ? null : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

const wrap = { minHeight: "100vh", background: C.bg, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: C.ink };
const card = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, maxWidth: 620, margin: "0 auto" };
const label = { fontSize: 13, fontWeight: 700, display: "block", marginBottom: 5, marginTop: 14 };
const input = { width: "100%", fontSize: 16, padding: "11px 13px", borderRadius: 10, border: `1px solid ${C.line}`, boxSizing: "border-box" };

export default function TcIntakePublic({ tcUserId }) {
  const [coord, setCoord] = useState(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ submitterRole: "agent", name: "", email: "", phone: "", dealType: "listing", propertyAddress: "", notes: "" });
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    fetch(`${API}/public/tc-intake/${tcUserId}`).then(r => r.json())
      .then(d => { if (d.success) setCoord(d.coordinator); else setErr(d.error || "Not found"); })
      .catch(() => setErr("Could not load this page."));
  }, [tcUserId]);

  const feeFor = (t) => coord ? (t === "listing" ? coord.feeListing : t === "seller" ? coord.feeSeller : coord.feeBuyer) : null;
  const submit = async () => {
    if (!f.name.trim() || !f.email.trim()) { alert("Please add your name and email."); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API}/public/tc-intake/${tcUserId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, details: { notes: f.notes } }),
      });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed");
      setDone(true);
    } catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };

  if (err) return <div style={wrap}><div style={{ ...card, marginTop: 60, color: C.red }}>⚠️ {err}</div></div>;
  if (!coord) return <div style={wrap}><div style={{ ...card, marginTop: 60, color: C.muted }}>Loading…</div></div>;
  if (done) return (
    <div style={wrap}><div style={{ ...card, marginTop: 60, textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>✅</div>
      <h2 style={{ margin: "10px 0" }}>Request sent</h2>
      <div style={{ color: C.muted, fontSize: 15 }}>Thanks! {coord.name} has received your transaction and will reach out to confirm.</div>
    </div></div>
  );

  return (
    <div style={wrap}>
      <div style={{ background: C.ink, color: "#fff", padding: "18px 20px", textAlign: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{coord.name}</div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>Transaction Coordinator{coord.serviceArea ? " · " + coord.serviceArea : ""}</div>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ ...card, marginBottom: 14 }}>
          {coord.bio && <div style={{ fontSize: 14, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>{coord.bio}</div>}
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Submit a transaction</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Fill this out to hand a deal to {coord.name}. They'll review and confirm with you.</div>

          <label style={label}>I'm a…</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["agent", "Agent"], ["client", "Buyer / Seller"]].map(([v, l]) => (
              <button key={v} onClick={() => setF(p => ({ ...p, submitterRole: v }))}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${f.submitterRole === v ? C.red : C.line}`, background: f.submitterRole === v ? "#FDEDEC" : "#fff", color: f.submitterRole === v ? C.red : C.ink, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{l}</button>
            ))}
          </div>

          <label style={label}>Type of transaction</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["listing", "Listing (on MLS)"], ["seller", "Seller rep"], ["buyer", "Buyer rep"]].map(([v, l]) => (
              <button key={v} onClick={() => setF(p => ({ ...p, dealType: v }))}
                style={{ flex: "1 1 30%", padding: "10px 0", borderRadius: 10, border: `1.5px solid ${f.dealType === v ? C.red : C.line}`, background: f.dealType === v ? "#FDEDEC" : "#fff", color: f.dealType === v ? C.red : C.ink, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                {l}{feeFor(v) != null && <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{money(feeFor(v))}</div>}
              </button>
            ))}
          </div>

          <label style={label}>Your name *</label>
          <input style={input} value={f.name} onChange={set("name")} />
          <label style={label}>Email *</label>
          <input style={input} type="email" value={f.email} onChange={set("email")} />
          <label style={label}>Phone</label>
          <input style={input} type="tel" value={f.phone} onChange={set("phone")} />
          <label style={label}>Property address</label>
          <input style={input} value={f.propertyAddress} onChange={set("propertyAddress")} placeholder="123 Main St, City, FL" />
          <label style={label}>Anything else we should know?</label>
          <textarea style={{ ...input, resize: "vertical" }} rows={4} value={f.notes} onChange={set("notes")} placeholder="Contract dates, parties, deadlines…" />

          <button onClick={submit} disabled={busy}
            style={{ width: "100%", marginTop: 18, padding: "13px 0", borderRadius: 10, border: "none", background: busy ? "#bbb" : C.red, color: "#fff", fontWeight: 800, fontSize: 15, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Sending…" : "Send to coordinator"}
          </button>
        </div>
      </div>
    </div>
  );
}
