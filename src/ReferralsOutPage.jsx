import { t as tr, locale as uiLocale } from "./i18n";
import { useState, useEffect } from "react";
import BackButton from "./ui/BackButton";

const API = "https://liz-team-server-api-production.up.railway.app";

// REFERRALS OUT (Tools → Referrals Out). Clients you sent to another agent, who
// does the work and pays you a referral fee. You keep it up to date; the app
// drafts an "any update?" email you review before it goes (the partner answers
// with one tap, no login). "Mark paid" files the fee as income on your P&L.
const C = { red: "#C0392B", dark: "#922B21", gray: "#F4F4F4", blue: "#0c4a6e", text: "#1f2937", muted: "#6b7280", border: "#E5E7EB" };
const STATUS = [["sent", "Referred"], ["working", "Still working"], ["under_contract", "Under contract"], ["closed", "Closed"], ["lost", "Lost"]];
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString();
const EMPTY = { client_name: "", client_email: "", client_phone: "", client_kind: "buyer", area: "", partner_name: "", partner_email: "", partner_phone: "", partner_brokerage: "", fee_pct: 25, commission_pct: 3, est_price: "", status: "sent", expected_close: "", notes: "",
  preapproved: "", lender_name: "", preapproval_amount: "", price_min: "", price_max: "", timeframe: "", client_needs: "", property_address: "", contract_date: "",
  partner_license: "", partner_brokerage_address: "", partner_broker_name: "", partner_broker_email: "", term_months: 12 };
const day = (v) => v ? String(v).slice(0, 10) : "";

export default function ReferralsOutPage({ onBack }) {
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + tok };
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);       // form object (with id when editing)
  const [checkin, setCheckin] = useState(null); // { id, to, toEmail, subject, body }
  const [msg, setMsg] = useState("");

  const load = () => fetch(API + "/referrals-out", { headers }).then(r => r.json()).then(d => setList(d.referrals || [])).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  // Opened from a My Deals card → straight into that referral's form.
  const [openId] = useState(() => { try { const v = sessionStorage.getItem("tp_open_referral"); sessionStorage.removeItem("tp_open_referral"); return v; } catch { return null; } });
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!openId || opened || !list) return;
    const x = list.find(r => String(r.id) === String(openId));
    if (x) { setOpened(true); editOf(x); }
    // eslint-disable-next-line
  }, [list, openId]);
  const editOf = (x) => setEdit({ ...EMPTY, ...Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v == null ? "" : v])),
    expected_close: day(x.expected_close), contract_date: day(x.contract_date) });

  const save = async () => {
    const isNew = !edit.id;
    const r = await fetch(API + "/referrals-out" + (isNew ? "" : "/" + edit.id), { method: isNew ? "POST" : "PUT", headers, body: JSON.stringify(edit) });
    const d = await r.json();
    if (!r.ok || !d.success) { alert(d.error || tr("Couldn't save")); return; }
    setEdit(null); setMsg(isNew ? "✅ Referral added." : "✅ Saved."); load();
  };
  const askUpdate = async (x) => {
    const r = await fetch(API + "/referrals-out/" + x.id + "/checkin", { method: "POST", headers, body: JSON.stringify({}) });
    const d = await r.json();
    if (!r.ok || !d.success) { alert(d.error || tr("Couldn't draft it")); return; }
    setCheckin({ id: x.id, to: d.to, toEmail: d.toEmail, subject: d.subject, body: d.body });
  };
  const markPaid = async (x) => {
    const v = window.prompt(`Fee you received from ${x.partner_name} for ${x.client_name}:`, String(x.expected_fee || ""));
    if (v == null) return;
    const r = await fetch(API + "/referrals-out/" + x.id + "/paid", { method: "POST", headers, body: JSON.stringify({ amount: Number(String(v).replace(/[^0-9.]/g, "")) }) });
    const d = await r.json();
    if (!r.ok || !d.success) { alert(d.error || tr("Couldn't save")); return; }
    setMsg("✅ Marked paid — it's on your P&L as Referral Fee income."); load();
  };
  // REFERRAL AGREEMENT — the other brokerage signs it (Carlos 10/1). Create it
  // from this referral, review it, then send it for e-signature to you + them.
  const [agree, setAgree] = useState(null);   // { x, docId, signers, busy }
  const openDoc = async (docId) => {
    const r = await fetch(API + "/documents/" + docId + "/view-url", { headers });
    const d = await r.json();
    if (d.viewUrl) window.open(d.viewUrl, "_blank", "noopener"); else alert(d.error || tr("Couldn't open it"));
  };
  // Step 1 — WHO SIGNS: each brokerage's broker / authorized representative
  // (Carlos 10/1), agents optional. Step 2 — review the PDF, then send.
  const makeAgreement = async (x) => {
    const rep = await fetch(API + "/referral-broker-rep", { headers }).then(r => r.json()).catch(() => ({}));
    setAgree({ x, step: "who", canSave: !!rep.canSave, saveDefault: false,
      who: { ref_broker_name: x.ref_broker_name || rep.name || "", ref_broker_email: x.ref_broker_email || rep.email || "",
        partner_broker_name: x.partner_broker_name || "", partner_broker_email: x.partner_broker_email || "", agents_sign: !!x.agents_sign } });
  };
  const generateAgreement = async () => {
    const w = agree.who;
    if (!w.ref_broker_name || !w.ref_broker_email) { alert(tr("Add who signs for your brokerage — your broker or authorized representative.")); return; }
    if (!w.partner_broker_name || !w.partner_broker_email) { alert(tr("Add who signs for ") + (agree.x.partner_brokerage || tr("their brokerage")) + tr(" — their broker or authorized representative.")); return; }
    setAgree(a => ({ ...a, busy: true }));
    if (agree.saveDefault) await fetch(API + "/referral-broker-rep", { method: "PUT", headers, body: JSON.stringify({ name: w.ref_broker_name, email: w.ref_broker_email }) }).catch(() => {});
    const r = await fetch(API + "/referrals-out/" + agree.x.id + "/agreement", { method: "POST", headers, body: JSON.stringify(w) });
    const d = await r.json();
    if (!r.ok || !d.success) { setAgree(a => ({ ...a, busy: false })); alert(d.error || tr("Couldn't create it")); return; }
    setAgree(a => ({ ...a, step: "review", docId: d.docId, signers: d.signers, busy: false }));
    load();
  };
  const sendAgreement = async () => {
    setAgree(a => ({ ...a, busy: true }));
    const r = await fetch(API + "/documents/" + agree.docId + "/request-signatures", { method: "POST", headers,
      body: JSON.stringify({ signers: agree.signers.map(s => ({ name: s.name, email: s.email })) }) });
    const d = await r.json();
    if (!r.ok || d.success === false) { setAgree(a => ({ ...a, busy: false })); alert(d.error || tr("Couldn't send it")); return; }
    setAgree(null); setMsg(tr("✅ Agreement sent for signature to {v1}. Everyone gets the signed copy by email.", { v1: agree.signers.map(s => s.name).join(", ") })); load();
  };
  const agreementLine = (x) => {
    const a = x.agreement;
    if (!a) return null;
    if (a.status === "signed") return <span style={{ fontSize: 12, fontWeight: 800, color: "#166534" }}>{tr("✅ Agreement signed ·")} <a href="#" onClick={e => { e.preventDefault(); openDoc(a.signedDocId); }} style={{ color: C.blue }}>{tr("open")}</a></span>;
    if (a.status === "sent") return <span style={{ fontSize: 12, fontWeight: 800, color: "#92400E" }}>{tr("✍️ Agreement out for signature ·")} {a.signed} {tr("of")} {a.signed + a.pending} {tr("signed")}</span>;
    return <span style={{ fontSize: 12, color: C.muted }}>{tr("📝 Agreement drafted, not sent yet")}</span>;
  };
  const remove = async (x) => {
    if (!window.confirm(`Stop tracking the referral of ${x.client_name}?`)) return;
    await fetch(API + "/referrals-out/" + x.id, { method: "DELETE", headers }).catch(() => {});
    load();
  };

  const inp = { padding: "9px 11px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
  const btn = (primary) => ({ padding: "8px 14px", borderRadius: 8, border: primary ? "none" : "1px solid " + C.border, background: primary ? C.blue : "#fff", color: primary ? "#fff" : C.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });
  const field = (k, label, type = "text") => (
    <label style={{ fontSize: 12, color: C.muted }}>{tr(label)}
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
          <div style={{ fontWeight: 800, fontSize: 15 }}>{x.client_name} <span style={{ fontWeight: 500, color: C.muted, fontSize: 12.5 }}>· {x.client_kind === "seller" ? tr("listing") : tr("buyer")}{x.area ? ` · ${x.area}` : ""}</span></div>
          {x.property_address && <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>🏠 {x.property_address}</div>}
          {x.client_kind !== "seller" && x.preapproved && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{x.preapproved === "cash" ? tr("Cash buyer") : x.preapproved === "yes" ? `Pre-approved${x.preapproval_amount ? " " + money(x.preapproval_amount) : ""}` : tr("Not pre-approved yet")}</div>}
          <div style={{ marginTop: 4 }}><span style={{ background: C.dark, color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>{tr("↗️ REFERRAL OUT · to")} {x.partner_name}{x.partner_brokerage ? ` (${x.partner_brokerage})` : ""}</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.blue }}>{x.status_label}{x.paid_at ? tr(" · paid") : ""}</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>{x.fee_pct}{tr("% fee ·")} {x.paid_at ? tr("received") : tr("expected")} <b style={{ color: "#166534" }}>{money(x.paid_at ? x.fee_amount : x.expected_fee)}</b></div>
          {x.my_net != null && x.my_net > 0 && <div style={{ fontSize: 12, color: C.muted }}>{tr("your net")} {money(x.my_net)}</div>}
          {x.expected_close && <div style={{ fontSize: 12, color: C.muted }}>{tr("closing")} {new Date(String(x.expected_close).slice(0, 10) + "T12:00:00").toLocaleDateString(uiLocale(), { month: "short", day: "numeric" })}</div>}
        </div>
      </div>
      {x.partner_note && <div style={{ fontSize: 12.5, color: C.text, marginTop: 6, background: C.gray, borderRadius: 8, padding: "6px 10px" }}>💬 {x.partner_name}: {x.partner_note}</div>}
      {x.update_due && <div style={{ fontSize: 12, color: C.dark, marginTop: 6, fontWeight: 700 }}>{tr("⏰ No update in 3+ weeks — a good time to check in.")}</div>}
      {x.agreement && <div style={{ marginTop: 6 }}>{agreementLine(x)}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {(!x.agreement || x.agreement.status === "draft") && <button onClick={() => makeAgreement(x)} style={btn(!x.agreement)}>{tr("📝 Referral agreement")}</button>}
        {!x.paid_at && x.status !== "lost" && <button onClick={() => askUpdate(x)} style={btn(!!x.update_due)}>{tr("📨 Ask for an update")}</button>}
        {x.status === "closed" && !x.paid_at && <button onClick={() => markPaid(x)} style={btn(true)}>{tr("💵 Mark paid")}</button>}
        <button onClick={() => editOf(x)} style={btn(false)}>{tr("✏️ Open / update")}</button>
        <button onClick={() => remove(x)} style={{ ...btn(false), color: C.dark }}>🗑</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "16px 16px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        {onBack && <BackButton onClick={onBack} to="My Deals" />}
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0F2044" }}>{tr("↗️ Referrals Out")}</div>
        <span style={{ flex: 1 }} />
        <button onClick={() => setEdit({ ...EMPTY })} style={btn(true)}>{tr("➕ New referral")}</button>
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{tr("Clients you sent to another agent. You keep these up to date; tap")} <b>{tr("Ask for an update")}</b> {tr("and the partner can answer with one tap.")} {expected > 0 && <>{tr("Expected, not yet paid:")} <b style={{ color: "#166534" }}>{money(expected)}</b>.</>}</div>
      {msg && <div style={{ fontSize: 13, fontWeight: 700, color: msg.startsWith("✅") ? "#166534" : C.dark, marginBottom: 10 }}>{tr(msg)}</div>}
      {list === null && <div style={{ color: C.muted }}>{tr("Loading…")}</div>}
      {list && list.length === 0 && <div style={{ background: C.gray, borderRadius: 12, padding: 16, fontSize: 13.5 }}>{tr("No referrals yet. Tap")} <b>{tr("➕ New referral")}</b> {tr("when you send a client to another agent.")}</div>}
      {open.map(row)}
      {done.length > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, margin: "18px 0 8px" }}>{tr("Paid & closed out")}</div>}
      {done.map(row)}

      {edit && (
        <div onClick={() => setEdit(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 640, margin: "auto", padding: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{edit.id ? tr("Referral — ") + (edit.client_name || "") : tr("New referral out")}</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>{tr("Fill in what you know now — come back and update it when the other agent finds the home or lists the property.")}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[["buyer", "🔑 Buyer referral"], ["seller", "🏡 Listing referral"]].map(([v, l]) => (
                <button key={v} onClick={() => setEdit(f => ({ ...f, client_kind: v }))} style={{ flex: 1, padding: "9px 10px", borderRadius: 20, border: "1.5px solid " + (edit.client_kind === v ? C.blue : C.border), background: edit.client_kind === v ? C.blue : "#fff", color: edit.client_kind === v ? "#fff" : C.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{tr(l)}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>{tr("CLIENT")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
              {field("client_name", "Name *")}{field("client_email", "Email")}{field("client_phone", "Phone")}
            </div>
            {edit.client_kind === "seller" ? <>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>{tr("PROPERTY TO LIST")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
                {field("property_address", "Address")}{field("est_price", "Estimated value $", "number")}{field("area", "City / area")}{field("timeframe", "When do they want to list?")}
              </div>
            </> : <>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>{tr("WHAT THEY'RE BUYING")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: C.muted }}>{tr("Pre-approved?")}
                  <select value={edit.preapproved || ""} onChange={e => setEdit(f => ({ ...f, preapproved: e.target.value }))} style={{ ...inp, marginTop: 3 }}>
                    <option value="">{tr("Not sure")}</option><option value="yes">{tr("Yes")}</option><option value="no">{tr("Not yet")}</option><option value="cash">{tr("Cash buyer")}</option>
                  </select>
                </label>
                {edit.preapproved === "yes" && <>{field("preapproval_amount", "Pre-approved for $", "number")}{field("lender_name", "Lender")}</>}
                {field("price_min", "Price from $", "number")}{field("price_max", "Price to $", "number")}
                {field("area", "Areas")}{field("timeframe", "Timeframe (e.g. within 3 months)")}
              </div>
            </>}
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 12 }}>{tr("What they need (beds, must-haves, situation)")}
              <textarea value={edit.client_needs || ""} onChange={e => setEdit(f => ({ ...f, client_needs: e.target.value }))} rows={2} style={{ ...inp, marginTop: 3, resize: "vertical" }} />
            </label>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>{tr("RECEIVING AGENT & BROKERAGE")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 6 }}>
              {field("partner_name", "Agent name *")}{field("partner_email", "Agent email")}{field("partner_phone", "Agent phone")}
              {field("partner_brokerage", "Brokerage")}{field("partner_license", "Brokerage license #")}{field("partner_brokerage_address", "Brokerage address")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
              {field("partner_broker_name", "Their broker / representative")}{field("partner_broker_email", "Broker's email")}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>{tr("FEE & STATUS")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
              {field("fee_pct", "Referral fee %", "number")}{field("commission_pct", "Their commission %", "number")}{field("term_months", "Agreement good for (months)", "number")}
              <label style={{ fontSize: 12, color: C.muted }}>{tr("Status")}
                <select value={edit.status} onChange={e => setEdit(f => ({ ...f, status: e.target.value }))} style={{ ...inp, marginTop: 3 }}>{STATUS.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select>
              </label>
            </div>
            {edit.id && <>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>{tr("WHEN THEY FIND IT — THE DEAL")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}>
                {edit.client_kind !== "seller" && field("property_address", "Property address")}
                {field("est_price", edit.client_kind === "seller" ? "List / contract price $" : "Contract price $", "number")}
                {field("contract_date", "Contract date", "date")}{field("expected_close", "Closing date", "date")}
                {field("closed_price", "Sold price $", "number")}
              </div>
            </>}
            <label style={{ fontSize: 12, color: C.muted }}>{tr("Your private notes")}<textarea value={edit.notes || ""} onChange={e => setEdit(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inp, marginTop: 3, resize: "vertical" }} /></label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setEdit(null)} style={btn(false)}>{tr("Cancel")}</button>
              <button onClick={save} style={btn(true)}>{tr("Save")}</button>
            </div>
          </div>
        </div>
      )}

      {agree && (
        <div onClick={() => !agree.busy && setAgree(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, margin: "auto", padding: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{tr("📝 Referral agreement —")} {agree.x.client_name}</div>
            {agree.step === "who" ? <>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>{tr("A referral agreement is between the two")} <b>{tr("brokerages")}</b>{tr(", so each broker (or their authorized representative) signs it.")}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>{tr("SIGNS FOR YOUR BROKERAGE")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 6 }}>
                <input placeholder={tr("Broker / representative name")} value={agree.who.ref_broker_name} onChange={e => setAgree(a => ({ ...a, who: { ...a.who, ref_broker_name: e.target.value } }))} style={inp} />
                <input placeholder={tr("Their email")} value={agree.who.ref_broker_email} onChange={e => setAgree(a => ({ ...a, who: { ...a.who, ref_broker_email: e.target.value } }))} style={inp} />
              </div>
              {agree.canSave && <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}><input type="checkbox" checked={agree.saveDefault} onChange={e => setAgree(a => ({ ...a, saveDefault: e.target.checked }))} /> {tr("Use this person for every referral in our brokerage")}</label>}
              <div style={{ fontSize: 12, fontWeight: 800, color: C.red, margin: "6px 0" }}>{tr("SIGNS FOR")} {(agree.x.partner_brokerage || "THEIR BROKERAGE").toUpperCase()}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
                <input placeholder={tr("Their broker / representative name")} value={agree.who.partner_broker_name} onChange={e => setAgree(a => ({ ...a, who: { ...a.who, partner_broker_name: e.target.value } }))} style={inp} />
                <input placeholder={tr("Their email")} value={agree.who.partner_broker_email} onChange={e => setAgree(a => ({ ...a, who: { ...a.who, partner_broker_email: e.target.value } }))} style={inp} />
              </div>
              <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={agree.who.agents_sign} onChange={e => setAgree(a => ({ ...a, who: { ...a.who, agents_sign: e.target.checked } }))} /> {tr("The two agents sign too (after the brokers)")}</label>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                <button disabled={agree.busy} onClick={() => setAgree(null)} style={btn(false)}>{tr("Cancel")}</button>
                <button disabled={agree.busy} onClick={generateAgreement} style={btn(true)}>{agree.busy ? tr("Creating…") : tr("Create the agreement")}</button>
              </div>
            </> : <>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>{tr("Filled from this referral: both brokerages, the client's details, and the")} {agree.x.fee_pct}{tr("% referral fee. Read it first — nothing is sent until you tap Send.")}</div>
              <button onClick={() => openDoc(agree.docId)} style={{ ...btn(false), marginBottom: 14 }}>{tr("👁 Review the agreement")}</button>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>{tr("WHO SIGNS (in this order)")}</div>
              {(agree.signers || []).map((s, i) => (
                <div key={i} style={{ fontSize: 13.5, padding: "6px 0", borderTop: "1px solid " + C.gray }}>{i + 1}. <b>{s.name}</b> · {s.email} <span style={{ color: C.muted }}>— {s.role}</span></div>
              ))}
              <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{tr("Each signer gets a private signing link by email. When everyone has signed, they all receive the signed copy with its certificate.")}</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                <button disabled={agree.busy} onClick={() => setAgree(null)} style={btn(false)}>{tr("Not now")}</button>
                <button disabled={agree.busy} onClick={sendAgreement} style={btn(true)}>{agree.busy ? tr("Sending…") : tr("✍️ Send for signature")}</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {checkin && (
        <div onClick={() => setCheckin(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, margin: "auto", padding: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{tr("Review before sending")}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>{tr("To:")} <b>{checkin.to}</b> &lt;{checkin.toEmail}{tr("> · nothing sends until you press Send.")}</div>
            <input value={checkin.subject} onChange={e => setCheckin(v => ({ ...v, subject: e.target.value }))} style={{ ...inp, marginBottom: 10 }} />
            <textarea value={checkin.body} onChange={e => setCheckin(v => ({ ...v, body: e.target.value }))} rows={14} style={{ ...inp, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setCheckin(null)} style={btn(false)}>{tr("Cancel")}</button>
              <button onClick={async () => {
                const r = await fetch(API + "/referrals-out/" + checkin.id + "/checkin", { method: "POST", headers, body: JSON.stringify({ confirm: true, subject: checkin.subject, body: checkin.body }) });
                const d = await r.json();
                if (!r.ok || !d.success) { alert(d.error || tr("Couldn't send")); return; }
                setCheckin(null); setMsg(tr("✅ Check-in sent to {to}.", { to: checkin.to })); load();
              }} style={btn(true)}>{tr("✅ Send")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// MY DEALS strip (Carlos 10/1: a referral out is a deal you keep updating).
// Open referrals show as cards under the deal filters; tapping one opens its
// form on Referrals Out. Read-only here — no timeline, no client emails.
export function ReferralsOutStrip({ onOpen }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/referrals-out", { headers: { Authorization: "Bearer " + tok } }).then(r => r.ok ? r.json() : null)
      .then(d => setList(((d && d.referrals) || []).filter(x => !x.paid_at && x.status !== "lost"))).catch(() => {});
  }, []);
  if (!list.length) return null;
  const go = (id) => { try { if (id) sessionStorage.setItem("tp_open_referral", id); } catch {} onOpen && onOpen(); };
  return (
    <div style={{ padding: "12px 24px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.dark, textTransform: "uppercase", letterSpacing: 0.4 }}>{tr("↗️ Referred out (")}{list.length})</span>
        <button onClick={() => go(null)} style={{ background: "none", border: "none", color: C.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{tr("See all →")}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {list.map(x => (
          <button key={x.id} onClick={() => go(x.id)} style={{ textAlign: "left", background: "#fff", border: "1px solid " + (x.update_due ? "#E6B0AA" : C.border), borderLeft: "4px solid " + C.dark, borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{x.property_address || x.client_name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{x.property_address ? x.client_name + " · " : ""}{x.client_kind === "seller" ? tr("listing") : tr("buyer")} → {x.partner_name}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: C.blue }}>{x.status_label}</span>
              <span style={{ color: "#166534", fontWeight: 700 }}>{x.expected_fee > 0 ? money(x.expected_fee) + tr(" fee") : ""}</span>
            </div>
          </button>
        ))}
      </div>
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
  if (err) return <div style={box}><b>{tr("Can't open this.")}</b><div style={{ color: C.muted, marginTop: 6 }}>{tr(err)}</div></div>;
  if (!info) return <div style={box}>{tr("Loading…")}</div>;
  if (done) return <div style={box}><div style={{ fontSize: 18, fontWeight: 800 }}>{tr("✅ Thank you!")}</div><div style={{ color: C.muted, marginTop: 6 }}>{info.agent} {tr("has your update on")} {info.client}.</div></div>;
  return (
    <div style={{ background: C.gray, minHeight: "100vh", padding: "1px 16px" }}>
      <div style={box}>
        <div style={{ fontSize: 13, color: C.muted }}>{tr("Update for")} {info.agent}</div>
        <div style={{ fontSize: 19, fontWeight: 800, margin: "4px 0 14px" }}>{info.client}: <span style={{ color: C.blue }}>{info.statusLabel}</span></div>
        {(info.status === "under_contract" || info.status === "working") && <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 10 }}>{tr("Expected closing date (optional)")}<input type="date" value={f.expectedClose} onChange={e => setF(x => ({ ...x, expectedClose: e.target.value }))} style={inp} /></label>}
        {(info.status === "under_contract" || info.status === "closed") && <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 10 }}>{info.status === "closed" ? tr("Sold price") : tr("Contract price")} {tr("(optional)")}<input type="number" value={f.price} onChange={e => setF(x => ({ ...x, price: e.target.value }))} style={inp} /></label>}
        <label style={{ fontSize: 13, color: C.muted, display: "block", marginBottom: 14 }}>{tr("Anything to add? (optional)")}<textarea value={f.note} onChange={e => setF(x => ({ ...x, note: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} /></label>
        <button onClick={submit} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "#0c4a6e", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>{tr("Send update")}</button>
      </div>
    </div>
  );
}
