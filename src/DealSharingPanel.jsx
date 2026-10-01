import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// DEAL SHARING + COMMISSION (deal Overview, agent/admin only — never TCs).
// Standard / Co-shared (co-agents with a share %) / Referral In (the referring
// agent's fee comes off the top). Shows the brokerage's Commission Plan result:
// every step, the agent's net and the brokerage income. Admins can switch this
// one deal to a different plan.
const C = { red: "#C0392B", dark: "#922B21", gray: "#F4F4F4", blue: "#0c4a6e", text: "#1f2937", muted: "#6b7280", border: "#E5E7EB" };
const money = (n) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(Number(n) || 0)).toLocaleString();
const TYPES = [
  { v: "standard", label: "Standard", hint: "Just you on this deal." },
  { v: "co_shared", label: "🤝 Co-shared", hint: "You and one or more co-agents share this deal and its commission." },
  { v: "referral_in", label: "↘️ Referral In", hint: "Another agent referred this client to you — you pay them a referral fee." },
];

export default function DealSharingPanel({ txId, onChanged }) {
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + tok };
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [invite, setInvite] = useState(null);
  const [sugg, setSugg] = useState([]);         // repeat co-agents: past co-agents + your brokerage's agents
  useEffect(() => {
    fetch(API + "/co-agents/suggestions", { headers }).then(r => r.ok ? r.json() : null).then(x => { if (x && x.suggestions) setSugg(x.suggestions); }).catch(() => {});
    // eslint-disable-next-line
  }, []);
  // Typing a name and picking a suggestion fills their email + brokerage — the
  // SAME email every time, so it's the same person's account on every deal.
  const pickCo = (i, value) => {
    const m = String(value || "").match(/<([^>]+)>\s*$/);
    const hit = m && sugg.find(x => x.email === m[1].toLowerCase());
    if (hit) setCo(i, { name: hit.name, email: hit.email, brokerage: hit.brokerage || "", phone: hit.phone || "" });
    else setCo(i, { name: value });
  };   // { pid, to, toEmail, subject, body } — review before sending

  const load = () => fetch(API + "/transactions/" + txId + "/sharing", { headers }).then(r => r.ok ? r.json() : null).then(x => {
    if (!x || !x.success) { setD(false); return; }
    setD(x);
    const ref = x.partners.find(p => p.kind === "referral_in");
    setForm({
      deal_share_type: x.deal_share_type || "standard",
      referral_fee_pct: x.referral_fee_pct ?? "",
      referral: ref ? { ...ref } : { kind: "referral_in", name: "", email: "", phone: "", brokerage: "" },
      coAgents: x.partners.filter(p => p.kind === "co_agent").map(p => ({ ...p })),
      commission_plan_id: x.commission_plan_id || "",
    });
  }).catch(() => setD(false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [txId]);

  if (d === false) return null;        // not the deal's agent/admin → nothing to show
  if (!d || !form) return null;

  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const setCo = (i, patch) => setForm(f => ({ ...f, coAgents: f.coAgents.map((c, j) => j === i ? { ...c, ...patch } : c) }));
  const coTotal = form.coAgents.reduce((n, c) => n + (Number(c.share_pct) || 0), 0);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const partners = form.deal_share_type === "co_shared" ? form.coAgents.map(c => ({ ...c, kind: "co_agent" }))
        : form.deal_share_type === "referral_in" ? [{ ...form.referral, kind: "referral_in" }] : [];
      const body = { deal_share_type: form.deal_share_type, referral_fee_pct: form.referral_fee_pct, partners };
      if (d.canOverridePlan) body.commission_plan_id = form.commission_plan_id || null;
      const r = await fetch(API + "/transactions/" + txId + "/sharing", { method: "PUT", headers, body: JSON.stringify(body) });
      const x = await r.json();
      if (!r.ok || !x.success) throw new Error(x.error || "Could not save");
      setMsg("✅ Saved — commission recalculated.");
      await load();
      onChanged && onChanged(x);
    } catch (e) { setMsg("⚠️ " + e.message); }
    setSaving(false);
  };

  // PARTNER LINK — for a saved partner with an email who doesn't use the app:
  // review-gated email (draft → edit → Send) or copy the link to text it.
  const partnerActions = (p) => (!p.id || !p.email || p.user_id) ? null : (
    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 11.5, color: C.muted }}>
      Doesn't use TransactPro —
      {/* A co-agent WORKS the deal → needs an app login. Free, own account, shared deals only. */}
      {p.kind === "co_agent" && (
        <button onClick={async () => {
          const r = await fetch(API + "/transactions/" + txId + "/partners/" + p.id + "/app-invite", { method: "POST", headers, body: JSON.stringify({}) });
          const x = await r.json(); if (!r.ok || !x.success) { setMsg("⚠️ " + (x.error || "Couldn't draft it")); return; }
          setInvite({ pid: p.id, to: x.to, toEmail: x.toEmail, subject: x.subject, body: x.body, endpoint: "app-invite", existing: x.existing });
        }} style={{ padding: "4px 10px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🔑 Give them a free TransactPro login</button>
      )}
      <button onClick={async () => {
        const r = await fetch(API + "/transactions/" + txId + "/partners/" + p.id + "/invite", { method: "POST", headers, body: JSON.stringify({}) });
        const x = await r.json(); if (!r.ok || !x.success) { setMsg("⚠️ " + (x.error || "Couldn't draft it")); return; }
        setInvite({ pid: p.id, to: x.to, toEmail: x.toEmail, subject: x.subject, body: x.body });
      }} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid " + C.blue, background: "#fff", color: C.blue, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>📨 Send partner link</button>
      <button onClick={async () => {
        const r = await fetch(API + "/transactions/" + txId + "/partners/" + p.id + "/link", { method: "POST", headers });
        const x = await r.json(); if (!r.ok || !x.success) { setMsg("⚠️ " + (x.error || "Couldn't make the link")); return; }
        try { await navigator.clipboard.writeText(x.link); setMsg("✅ Partner link copied — paste it in a text."); } catch { window.prompt("Copy this partner link:", x.link); }
      }} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid " + C.border, background: "#fff", color: C.text, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🔗 Copy link</button>
    </div>
  );

  const inp = { padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
  const calc = d.commission_calc;

  return (
    <div style={{ background: "#fff", border: "1px solid " + C.border, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, color: "#0F2044", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Deal Sharing & Commission</h3>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Is this deal shared with a co-agent or a referral? Your net and the brokerage's income update from your brokerage's Commission Plan.</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        {TYPES.map(t => (
          <button key={t.v} onClick={() => set({ deal_share_type: t.v })}
            style={{ padding: "8px 14px", borderRadius: 20, border: "1.5px solid " + (form.deal_share_type === t.v ? C.blue : C.border), background: form.deal_share_type === t.v ? C.blue : "#fff", color: form.deal_share_type === t.v ? "#fff" : C.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{TYPES.find(t => t.v === form.deal_share_type).hint}</div>

      {form.deal_share_type === "referral_in" && (
        <div style={{ background: C.gray, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            <input placeholder="Referring agent's name" value={form.referral.name || ""} onChange={e => set({ referral: { ...form.referral, name: e.target.value } })} style={inp} />
            <input placeholder="Their email" value={form.referral.email || ""} onChange={e => set({ referral: { ...form.referral, email: e.target.value } })} style={inp} />
            <input placeholder="Their brokerage" value={form.referral.brokerage || ""} onChange={e => set({ referral: { ...form.referral, brokerage: e.target.value } })} style={inp} />
            <input placeholder="Referral fee %" type="number" value={form.referral_fee_pct} onChange={e => set({ referral_fee_pct: e.target.value })} style={inp} />
            {partnerActions({ ...form.referral, user_id: null })}
          </div>
        </div>
      )}

      {form.deal_share_type === "co_shared" && (
        <div style={{ background: C.gray, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          {form.coAgents.map((c, i) => (
            <div key={c.id || i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr)) 40px", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input placeholder="Co-agent's name — start typing" list="coagent-suggestions" value={c.name || ""} onChange={e => pickCo(i, e.target.value)} style={inp} />
              <input placeholder="Their email" value={c.email || ""} onChange={e => setCo(i, { email: e.target.value })} style={inp} />
              <input placeholder="Their brokerage (if different)" value={c.brokerage || ""} onChange={e => setCo(i, { brokerage: e.target.value })} style={inp} />
              <input placeholder="Their share %" type="number" value={c.share_pct ?? ""} onChange={e => setCo(i, { share_pct: e.target.value })} style={inp} />
              <button onClick={() => set({ coAgents: form.coAgents.filter((_, j) => j !== i) })} title="Remove" style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
              {partnerActions(c)}
              {c.user_id && <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: C.blue }}>✓ Uses TransactPro{c.same_brokerage ? " (your brokerage)" : " (another brokerage)"} — this deal shows up in their own app with their own share.</div>}
            </div>
          ))}
          <datalist id="coagent-suggestions">
            {sugg.map(x => <option key={x.email} value={`${x.name} <${x.email}>`}>{x.team ? "Your brokerage" : x.brokerage || "Past co-agent"}</option>)}
          </datalist>
          <button onClick={() => set({ coAgents: [...form.coAgents, { name: "", email: "", brokerage: "", share_pct: form.coAgents.length ? "" : 50 }] })}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px dashed " + C.blue, background: "#fff", color: C.blue, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>➕ Add co-agent</button>
          <div style={{ fontSize: 12, color: coTotal > 100 ? C.dark : C.muted, marginTop: 8 }}>
            Your share: <b>{Math.max(0, 100 - coTotal)}%</b>{coTotal > 100 ? " — co-agent shares add up to more than 100%" : ""}
          </div>
        </div>
      )}

      {d.canOverridePlan && d.plans.length > 0 && (
        <label style={{ display: "block", fontSize: 12.5, color: C.text, marginBottom: 12 }}>
          Commission plan for this deal (admin)
          <select value={form.commission_plan_id} onChange={e => set({ commission_plan_id: e.target.value })} style={{ ...inp, marginTop: 4 }}>
            <option value="">The agent's usual plan</option>
            {d.plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_default ? " (brokerage default)" : ""}</option>)}
          </select>
        </label>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button disabled={saving || coTotal > 100} onClick={save}
          style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
          {saving ? "Saving…" : "Save sharing"}
        </button>
        {msg && <span style={{ fontSize: 12.5, fontWeight: 700, color: msg.startsWith("✅") ? "#166534" : C.dark }}>{msg}</span>}
      </div>

      {invite && (
        <div onClick={() => setInvite(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, margin: "auto", padding: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Review before sending</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>To: <b>{invite.to}</b> &lt;{invite.toEmail}&gt; · nothing sends until you press Send.</div>
            {invite.endpoint === "app-invite" && !invite.existing && <div style={{ fontSize: 12, color: C.blue, background: C.gray, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>Sending creates their free login. Keep <b>{"{{SET_PASSWORD_LINK}}"}</b> in the message — it becomes their private set-password link.</div>}
            <input value={invite.subject} onChange={e => setInvite(v => ({ ...v, subject: e.target.value }))} style={{ ...inp, marginBottom: 10 }} />
            <textarea value={invite.body} onChange={e => setInvite(v => ({ ...v, body: e.target.value }))} rows={11} style={{ ...inp, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setInvite(null)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid " + C.border, background: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={async () => {
                const r = await fetch(API + "/transactions/" + txId + "/partners/" + invite.pid + "/" + (invite.endpoint || "invite"), { method: "POST", headers, body: JSON.stringify({ confirm: true, subject: invite.subject, body: invite.body }) });
                const x = await r.json();
                if (!r.ok || !x.success) { alert(x.error || "Couldn't send"); return; }
                setInvite(null);
                setMsg(invite.endpoint === "app-invite" ? `✅ ${invite.to} ${x.created ? "has a free TransactPro login — the email with their set-password link is on its way" : "is linked to their TransactPro account"}. The deal opens in their app with full access.` : `✅ Partner link sent to ${invite.to}.`);
                load();
              }} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>✅ Send</button>
            </div>
          </div>
        </div>
      )}

      {calc && (
        <div style={{ borderTop: "1px solid " + C.border, paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>How it's worked out — <b>{calc.planName}</b></div>
          {calc.lines.map((l, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0",
              fontWeight: l.kind === "result" || l.kind === "brokerage_total" || l.kind === "gross" ? 800 : 500,
              color: l.kind === "result" ? "#166534" : l.kind === "brokerage_total" ? C.blue : l.kind === "info" ? C.muted : C.text,
              borderTop: l.kind === "result" ? "1px solid " + C.border : "none" }}>
              <span>{l.label}</span><span>{money(l.amount)}</span>
            </div>
          ))}
          {(calc.coAgents || []).map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted }}><span>{c.name}'s net</span><span>{money(c.net)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
