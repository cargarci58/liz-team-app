import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// REFERRALS OUT (Tools → Referrals Out). Clients you sent to another agent, who
// does the work and pays you a referral fee. You keep it up to date; the app
// drafts an "any update?" email you review before it goes (the partner answers
// with one tap, no login). "Mark paid" files the fee as income on your P&L.
const C = { red: "#C0392B", dark: "#922B21", gray: "#F4F4F4", blue: "#0c4a6e", text: "#1f2937", muted: "#6b7280", border: "#E5E7EB" };
const STATUS = [["sent", "Referred"], ["working", "Still working"], ["under_contract", "Under contract"], ["closed", "Closed"], ["lost", "Lost"]];
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString();
const EMPTY = { client_name: "", client_email: "", client_phone: "", client_kind: "buyer", area: "", partner_name: "", partner_email: "", partner_phone: "", partner_brokerage: "", fee_pct: 25, commission_pct: 3, est_price: "", status: "sent", expected_close: "", notes: "" };

export default function ReferralsOutPage({ onBack }) {
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + tok };
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);       // form object (with id when editing)
  const [checkin, setCheckin] = useState(null); // { id, to, toEmail, subject, body }
  const [msg, setMsg] = useState("");

  const load = () => fetch(API + "/referrals-out", { headers }).then(r => r.json()).then(d => setList(d.referrals || [])).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    const isNew = !edit.id;
    const r = await fetch(API + "/referrals-out" + (isNew ? "" : "/" + edit.id), { method: isNew ? "POST" : "PUT", headers, body: JSON.stringify(edit) });
    const d = await r.json();
    if (!r.ok || !d.success) { alert(d.error || "Couldn't save"); return; }
    setEdit(null); setMsg(isNew ? "✅ Referral added." : "✅ Saved."); load();
  };
  const askUpdate = async (x) => {
    const r = await fetch(API + "/referrals-out/" + x.id + "/checkin", { method: "POST", headers, body: JSON.stringify({}) });
    const d = await r.json();
    if (!r.ok || !d.success) { alert(d.error || "Couldn't draft it"); return; }
    setCheckin({ id: x.id, to: d.to, toEmail: d.toEmail, subject: d.subject, body: d.body });
  };
  const markPaid = async (x) => {
    const v = window.prompt(`Fee you received from ${x.partner_name} for ${x.client_name}:`, String(x.expected_fee || ""));
    if (v == null) return;
    const r = await fetch(API + "/referrals-out/" + x.id + "/paid", { method: "POST", headers, body: JSON.stringify({ amount: Number(String(v).replace(/[^0-9.]/g, "")) }) });
    const d = await r.json();
    if (!r.ok || !d.success) { alert(d.error || "Couldn't save"); return; }
    setMsg("✅ Marked paid — it's on your P&L as Referral Fee income."); load();
  };
  // REFERRAL AGREEMENT — the other brokerage signs it (Carlos 10/1). Create it
  // from this referral, review it, then send it for e-signature to you + them.
  const [agree, setAgree] = useState(null);   // { x, docId, signers, busy }
  const openDoc = async (docId) => {
    const r = await fetch(API + "/documents/" + docId + "/view-url", { headers });
    const d = await r.json();
    if (d.viewUrl) window.open(d.viewUrl, "_blank", "noopener"); else alert(d.error || "Couldn't open it");
  };
  const makeAgreement = async (x) => {
    setAgree({ x, busy: true });
    const r = await fetch(API + "/referrals-out/" + x.id + "/agreement", { method: "POST", headers });
    const d = await r.json();
    if (!r.ok || !d.success) { setAgree(null); alert(d.error || "Couldn't create it"); return; }
    setAgree({ x, docId: d.docId, signers: d.signers, busy: false });
    load();
  };
  const sendAgreement = async () => {
    setAgree(a => ({ ...a, busy: true }));
    const r = await fetch(API + "/documents/" + agree.docId + "/request-signatures", { method: "POST", headers,
      body: JSON.stringify({ signers: agree.signers.map(s => ({ name: s.name, email: s.email })) }) });
    const d = await r.json();
    if (!r.ok || d.success === false) { setAgree(a => ({ ...a, busy: false })); alert(d.error || "Couldn't send it"); return; }
    setAgree(null); setMsg(`✅ Agreement sent for signature to you and ${agree.x.partner_name}. You'll both get the signed copy by email.`); load();
  };
  const agreementLine = (x) => {
    const a = x.agreement;
    if (!a) return null;
    if (a.status === "signed") return <span style={{ fontSize: 12, fontWeight: 800, color: "#166534" }}>✅ Agreement signed · <a href="#" onClick={e => { e.preventDefault(); openDoc(a.signedDocId); }} style={{ color: C.blue }}>open</a></span>;
    if (a.status === "sent") return <span style={{ fontSize: 12, fontWeight: 800, color: "#92400E" }}>✍️ Agreement out for signature · {a.signed} of {a.signed + a.pending} signed</span>;
    return <span style={{ fontSize: 12, color: C.muted }}>📝 Agreement drafted, not sent yet</span>;
  };
  const remove = async (x) => {
    if (!window.confirm(`Stop tracking the referral of ${x.client_name}?`)) return;
    await fetch(API + "/referrals-out/" + x.id, { method: "DELETE", headers }).catch(() => {});
    load();
  };

  const inp = { padding: "9px 11px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
  const btn = (primary) => ({ padding: "8px 14px", borderRadius: 8, border: primary ? "none" : "1px solid " + C.border, background: primary ? C.red : "#fff", color: primary ? "#fff" : C.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });
  const field = (k, label, type = "text") => (
    <label style={{ fontSize: 12, color: C.muted }}>{label}
      <input type={type} value={edit[k] ?? ""} onChange={e => setEdit(f => ({ ...f, [k]: e.target.value }))} style={{ ...inp, marginTop: 3 }} />
    </label>
  );
  const open = (list || []).filter(x => !["closed", "lost"].includes(x.status) || (x.status === "closed" && !x.paid_at));
  const done = (list || []).filter(x => !open.includes(x));
  const expected = (list || []).filter(x => x.status === "closed" && !x.paid_at).reduce((n, x) => n + (x.expected_fee || 0), 0);

  const row = (x) => (
    <div key={x.id} style={{ background: "#fff", border: "1px solid " + (x.update_due ? "#E6B0AA" : C.border), borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{x.client_name} <span style={{ fontWeight: 500, color: C.muted, fontSize: 12.5 }}>· {x.client_kind}{x.area ? ` · ${x.area}` : ""}</span></div>
          <div style={{ marginTop: 4 }}><span style={{ background: C.dark, color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>↗️ REFERRAL OUT · to {x.partner_name}{x.partner_brokerage ? ` (${x.partner_brokerage})` : ""}</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.blue }}>{x.status_label}{x.paid_at ? " · paid" : ""}</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>{x.fee_pct}% fee · {x.paid_at ? "received" : "expected"} <b style={{ color: "#166534" }}>{money(x.paid_at ? x.fee_amount : x.expected_fee)}</b></div>
        </div>
      </div>
      {x.partner_note && <div style={{ fontSize: 12.5, color: C.text, marginTop: 6, background: C.gray, borderRadius: 8, padding: "6px 10px" }}>💬 {x.partner_name}: {x.partner_note}</div>}
      {x.update_due && <div style={{ fontSize: 12, color: C.dark, marginTop: 6, fontWeight: 700 }}>⏰ No update in 3+ weeks — a good time to check in.</div>}
      {x.agreement && <div style={{ marginTop: 6 }}>{agreementLine(x)}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {(!x.agreement || x.agreement.status === "draft") && <button onClick={() => makeAgreement(x)} style={btn(!x.agreement)}>📝 Referral agreement</button>}
        {!x.paid_at && x.status !== "lost" && <button onClick={() => askUpdate(x)} style={btn(!!x.update_due)}>📨 Ask for an update</button>}
        {x.status === "closed" && !x.paid_at && <button onClick={() => markPaid(x)} style={btn(true)}>💵 Mark paid</button>}
        <button onClick={() => setEdit({ ...x, expected_close: x.expected_close ? String(x.expected_close).slice(0, 10) : "" })} style={btn(false)}>✏️ Edit</button>
        <button onClick={() => remove(x)} style={{ ...btn(false), color: C.dark }}>🗑</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "16px 16px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        {onBack && <button onClick={onBack} style={btn(false)}>← Back</button>}
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0F2044" }}>↗️ Referrals Out</div>
        <span style={{ flex: 1 }} />
        <button onClick={() => setEdit({ ...EMPTY })} style={btn(true)}>➕ New referral</button>
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Clients you sent to another agent. You keep these up to date; tap <b>Ask for an update</b> and the partner can answer with one tap. {expected > 0 && <>Expected, not yet paid: <b style={{ color: "#166534" }}>{money(expected)}</b>.</>}</div>
      {msg && <div style={{ fontSize: 13, fontWeight: 700, color: msg.startsWith("✅") ? "#166534" : C.dark, marginBottom: 10 }}>{msg}</div>}
      {list === null && <div style={{ color: C.muted }}>Loading…</div>}
      {list && list.length === 0 && <div style={{ background: C.gray, borderRadius: 12, padding: 16, fontSize: 13.5 }}>No referrals yet. Tap <b>➕ New referral</b> when you send a client to another agent.</div>}
      {open.map(row)}
      {done.length > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, margin: "18px 0 8px" }}>Paid & closed out</div>}
      {done.map(row)}

      {edit && (
        <div onClick={() => setEdit(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, margin: "auto", padding: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>{edit.id ? "Edit referral" : "New referral out"}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>CLIENT</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
              {field("client_name", "Name *")}{field("client_email", "Email")}{field("client_phone", "Phone")}
              <label style={{ fontSize: 12, color: C.muted }}>Buying or selling
                <select value={edit.client_kind} onChange={e => setEdit(f => ({ ...f, client_kind: e.target.value }))} style={{ ...inp, marginTop: 3 }}><option value="buyer">Buyer</option><option value="seller">Seller</option></select>
              </label>
              {field("area", "Area / city")}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>PARTNER AGENT</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
              {field("partner_name", "Name *")}{field("partner_email", "Email")}{field("partner_phone", "Phone")}{field("partner_brokerage", "Brokerage")}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>MONEY & STATUS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
              {field("fee_pct", "Referral fee %", "number")}{field("commission_pct", "Their commission %", "number")}{field("est_price", "Price (est. or sold) $", "number")}
              <label style={{ fontSize: 12, color: C.muted }}>Status
                <select value={edit.status} onChange={e => setEdit(f => ({ ...f, status: e.target.value }))} style={{ ...inp, marginTop: 3 }}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              {field("expected_close", "Expected close", "date")}
            </div>
            <label style={{ fontSize: 12, color: C.muted }}>Notes<textarea value={edit.notes || ""} onChange={e => setEdit(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inp, marginTop: 3, resize: "vertical" }} /></label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setEdit(null)} style={btn(false)}>Cancel</button>
              <button onClick={save} style={btn(true)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {agree && (
        <div onClick={() => !agree.busy && setAgree(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, margin: "auto", padding: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>📝 Referral agreement — {agree.x.client_name}</div>
            {agree.busy && !agree.docId ? <div style={{ color: C.muted, fontSize: 13.5 }}>Creating the agreement…</div> : <>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Filled from this referral: both brokerages, the client, and the {agree.x.fee_pct}% referral fee. Read it first — nothing is sent until you tap Send.</div>
              <button onClick={() => openDoc(agree.docId)} style={{ ...btn(false), marginBottom: 14 }}>👁 Review the agreement</button>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>WHO SIGNS (in this order)</div>
              {(agree.signers || []).map((s, i) => (
                <div key={i} style={{ fontSize: 13.5, padding: "6px 0", borderTop: "1px solid " + C.gray }}>{i + 1}. <b>{s.name}</b> · {s.email} <span style={{ color: C.muted }}>— {s.role}</span></div>
              ))}
              <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Each signer gets a private signing link by email. When both have signed, you both receive the signed copy with its certificate.</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                <button disabled={agree.busy} onClick={() => setAgree(null)} style={btn(false)}>Not now</button>
                <button disabled={agree.busy} onClick={sendAgreement} style={btn(true)}>{agree.busy ? "Sending…" : "✍️ Send for signature"}</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {checkin && (
        <div onClick={() => setCheckin(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, margin: "auto", padding: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Review before sending</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>To: <b>{checkin.to}</b> &lt;{checkin.toEmail}&gt; · nothing sends until you press Send.</div>
            <input value={checkin.subject} onChange={e => setCheckin(v => ({ ...v, subject: e.target.value }))} style={{ ...inp, marginBottom: 10 }} />
            <textarea value={checkin.body} onChange={e => setCheckin(v => ({ ...v, body: e.target.value }))} rows={14} style={{ ...inp, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setCheckin(null)} style={btn(false)}>Cancel</button>
              <button onClick={async () => {
                const r = await fetch(API + "/referrals-out/" + checkin.id + "/checkin", { method: "POST", headers, body: JSON.stringify({ confirm: true, subject: checkin.subject, body: checkin.body }) });
                const d = await r.json();
                if (!r.ok || !d.success) { alert(d.error || "Couldn't send"); return; }
                setCheckin(null); setMsg(`✅ Check-in sent to ${checkin.to}.`); load();
              }} style={btn(true)}>✅ Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Public one-tap page the partner lands on (/referral-update/<token>) — confirms
// the status they tapped, with optional close date / price / note.
export function ReferralUpdatePublic({ urlToken }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [f, setF] = useState({ expectedClose: "", price: "", note: "" });
  useEffect(() => {
    fetch(API + "/public/referral-update?token=" + encodeURIComponent(urlToken)).then(r => r.json())
      .then(d => { if (d.success) setInfo(d); else setErr(d.error || "This link has expired."); }).catch(() => setErr("Something went wrong."));
  }, [urlToken]);
  const submit = async () => {
    const r = await fetch(API + "/public/referral-update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: urlToken, ...f }) });
    const d = await r.json();
    if (!r.ok || !d.success) { setErr(d.error || "Couldn't save"); return; }
    setDone(true);
  };
  const box = { maxWidth: 460, margin: "40px auto", background: "#fff", border: "1px solid " + C.border, borderRadius: 14, padding: 22, fontFamily: "system-ui, sans-serif", color: C.text };
  const inp = { padding: "10px 12px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 15, width: "100%", boxSizing: "border-box", marginTop: 4, fontFamily: "inherit" };
  if (err) return <div style={box}><b>Can't open this.</b><div style={{ color: C.muted, marginTop: 6 }}>{err}</div></div>;
  if (!info) return <div style={box}>Loading…</div>;
  if (done) return <div style={box}><div style={{ fontSize: 18, fontWeight: 800 }}>✅ Thank you!</div><div style={{ color: C.muted, marginTop: 6 }}>{info.agent} has your update on {info.client}.</div></div>;
  return (
    <div style={{ background: C.gray, minHeight: "100vh", padding: "1px 16px" }}>
      <div style={box}>
        <div style={{ fontSize: 13, color: C.muted }}>Update for {info.agent}</div>
        <div style={{ fontSize: 19, fontWeight: 800, margin: "4px 0 14px" }}>{info.client}: <span style={{ color: C.blue }}>{info.statusLabel}</span></div>
        {(info.status === "under_contract" || info.status === "working") && <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 10 }}>Expected closing date (optional)<input type="date" value={f.expectedClose} onChange={e => setF(x => ({ ...x, expectedClose: e.target.value }))} style={inp} /></label>}
        {(info.status === "under_contract" || info.status === "closed") && <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 10 }}>{info.status === "closed" ? "Sold price" : "Contract price"} (optional)<input type="number" value={f.price} onChange={e => setF(x => ({ ...x, price: e.target.value }))} style={inp} /></label>}
        <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 14 }}>Anything to add? (optional)<textarea value={f.note} onChange={e => setF(x => ({ ...x, note: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} /></label>
        <button onClick={submit} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: C.red, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>Send update</button>
      </div>
    </div>
  );
}
