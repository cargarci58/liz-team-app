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
  const [dirty, setDirty] = useState(false);
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
    setDirty(false);
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

  // Any edit marks the box "unsaved" — removing a co-agent on screen without
  // saving left them with full access (Carlos 10/1).
  const set = (patch) => { setDirty(true); setForm(f => ({ ...f, ...patch })); };
  const setCo = (i, patch) => { setDirty(true); setForm(f => ({ ...f, coAgents: f.coAgents.map((c, j) => j === i ? { ...c, ...patch } : c) })); };
  const coTotal = form.coAgents.reduce((n, c) => n + (Number(c.share_pct) || 0), 0);

  const save = async (f = form) => {
    setSaving(true); setMsg("");
    try {
      const partners = f.deal_share_type === "co_shared" ? f.coAgents.map(c => ({ ...c, kind: "co_agent" }))
        : f.deal_share_type === "referral_in" ? [{ ...f.referral, kind: "referral_in" }] : [];
      const body = { deal_share_type: f.deal_share_type, referral_fee_pct: f.referral_fee_pct, partners };
      if (d.canOverridePlan) body.commission_plan_id = f.commission_plan_id || null;
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
  // REFERRAL partners follow along (view-only Partner link).
  const partnerActions = (p) => (!p.id || !p.email || d.canManagePartners === false) ? null : (
    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 11.5, color: C.muted }}>
      Let them follow the deal (view only) —
      <button onClick={async () => {
        const r = await fetch(API + "/transactions/" + txId + "/partners/" + p.id + "/invite", { method: "POST", headers, body: JSON.stringify({}) });
        const x = await r.json(); if (!r.ok || !x.success) { setMsg("⚠️ " + (x.error || "Couldn't draft it")); return; }
        setInvite({ kind: "partner", pid: p.id, to: x.to, toEmail: x.toEmail, subject: x.subject, body: x.body });
      }} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid " + C.blue, background: "#fff", color: C.blue, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>📨 Send partner link</button>
      <button onClick={async () => {
        const r = await fetch(API + "/transactions/" + txId + "/partners/" + p.id + "/link", { method: "POST", headers });
        const x = await r.json(); if (!r.ok || !x.success) { setMsg("⚠️ " + (x.error || "Couldn't make the link")); return; }
        try { await navigator.clipboard.writeText(x.link); setMsg("✅ Partner link copied — paste it in a text."); } catch { window.prompt("Copy this partner link:", x.link); }
      }} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid " + C.border, background: "#fff", color: C.text, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🔗 Copy link</button>
    </div>
  );

  // CO-AGENTS WORK the deal in their own app (Carlos 10/1). One button —
  // "Invite co-agent" — and a status: not invited → invited (waiting) → working.
  const coInvite = async (c) => {
    const r = await fetch(API + "/transactions/" + txId + "/coagents/" + c.id + "/invite", { method: "POST", headers, body: JSON.stringify({}) });
    const x = await r.json(); if (!r.ok || !x.success) { setMsg("⚠️ " + (x.error || "Couldn't draft it")); return; }
    setInvite({ kind: "coagent", pid: c.id, mode: x.mode, to: x.to, toEmail: x.toEmail, subject: x.subject, body: x.body });
  };
  const coAgentStatus = (c) => {
    const chip = (txt, bg, col) => <span style={{ fontSize: 11, fontWeight: 800, color: col, background: bg, borderRadius: 10, padding: "2px 8px" }}>{txt}</span>;
    const btn = (label, primary) => d.canManagePartners === false ? null : (
      <button onClick={() => coInvite(c)} style={{ padding: "4px 10px", borderRadius: 8, border: primary ? "none" : "1px solid " + C.blue, background: primary ? C.red : "#fff", color: primary ? "#fff" : C.blue, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
    );
    let body;
    if (!c.id) body = <span>Save sharing, then invite them.</span>;
    else if (!c.email) body = <span>Add their email and save sharing to invite them.</span>;
    else if (c.invite_status === "active") body = <>{chip("✓ Working this deal", "#D5F5E3", "#166534")} <span>It's in their TransactPro app{c.same_brokerage ? " (your brokerage)" : ""}.</span> {btn("📨 Email them about it", false)}</>;
    else if (c.invite_status === "invited") body = <>{chip("Invited · waiting for them", "#FEF3C7", "#92400E")} {c.invited_at && <span>sent {new Date(c.invited_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>} {btn("Resend invite", false)}</>;
    else body = <>{chip("Not invited yet", C.gray, C.muted)} {btn("📨 Invite co-agent", true)}</>;
    return <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 11.5, color: C.muted }}>{body}</div>;
  };

  const inp = { padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
  const calc = d.commission_calc;
  // ONLY the agent who created the deal changes WHO shares it (Carlos 10/1). The
  // co-agent (and anyone else) sees it all read-only; they edit commission % and
  // fees in the deal's Commission Details.
  const canEdit = d.canManagePartners !== false;

  return (
    <div style={{ background: "#fff", border: "1px solid " + C.border, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, color: "#0F2044", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Deal Sharing & Commission</h3>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Is this deal shared with a co-agent or a referral? Your net and the brokerage's income update from your brokerage's Commission Plan.</div>

      {!canEdit && (
        <div style={{ fontSize: 12.5, color: C.blue, background: C.gray, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>
          Only {d.creatorName || "the agent who created this deal"} can change its co-agent or referral partner. You can edit the commission % and fees in <b>Edit → Commission Details</b>.
        </div>
      )}
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
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
            {partnerActions(form.referral)}
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
              {canEdit ? <button onClick={() => {
                const rest = form.coAgents.filter((_, j) => j !== i);
                // A saved co-agent is removed for real right away — not left on
                // screen waiting for "Save sharing" while they keep access.
                if (!c.id) { set({ coAgents: rest }); return; }
                if (!window.confirm(`Remove ${c.name || "this co-agent"} as co-agent?\n\nThey lose access to this deal right away.`)) return;
                const next = { ...form, coAgents: rest, deal_share_type: rest.length ? form.deal_share_type : "standard" };
                setForm(next); save(next);
              }} title="Remove" style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>✕</button> : <span />}
              {coAgentStatus(c)}
            </div>
          ))}
          <datalist id="coagent-suggestions">
            {sugg.map(x => <option key={x.email} value={`${x.name} <${x.email}>`}>{x.team ? "Your brokerage" : x.brokerage || "Past co-agent"}</option>)}
          </datalist>
          {/* ONE co-agent per deal (Carlos 10/1). */}
          {canEdit && form.coAgents.length === 0 && (
            <button onClick={() => set({ coAgents: [{ name: "", email: "", brokerage: "", share_pct: 50 }] })}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px dashed " + C.blue, background: "#fff", color: C.blue, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>➕ Add co-agent</button>
          )}
          <div style={{ fontSize: 12, color: coTotal > 100 ? C.dark : C.muted, marginTop: 8 }}>
            Your share: <b>{Math.max(0, 100 - coTotal)}%</b>{coTotal > 100 ? " — co-agent shares add up to more than 100%" : ""}
          </div>
        </div>
      )}

      </fieldset>

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
        {(canEdit || d.canOverridePlan) && <button disabled={saving || coTotal > 100} onClick={() => save()}
          style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
          {saving ? "Saving…" : "Save sharing"}
        </button>}
        {dirty && !saving && (canEdit || d.canOverridePlan) && <span style={{ fontSize: 12.5, fontWeight: 700, color: C.dark }}>● Unsaved changes — tap Save sharing</span>}
        {msg && <span style={{ fontSize: 12.5, fontWeight: 700, color: msg.startsWith("✅") ? "#166534" : C.dark }}>{msg}</span>}
      </div>

      {invite && (
        <div onClick={() => setInvite(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, margin: "auto", padding: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Review before sending</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>To: <b>{invite.to}</b> &lt;{invite.toEmail}&gt; · nothing sends until you press Send.</div>
            {invite.kind === "coagent" && <div style={{ fontSize: 12, color: C.blue, background: C.gray, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
              {invite.mode === "linked" ? <>They already have a TransactPro agent login — the deal is added to their My Deals as soon as you send this.</>
                : invite.mode === "add_agent_login" ? <>This email already has a client login. Nothing changes until <b>they</b> open their private link and pick a password — then the same email also has an agent login. Keep <b>{"{{JOIN_LINK}}"}</b> in the message.</>
                : <>They don't have TransactPro yet. Their private link sets up a free login with a password <b>they</b> pick. Keep <b>{"{{JOIN_LINK}}"}</b> in the message.</>}
            </div>}
            <input value={invite.subject} onChange={e => setInvite(v => ({ ...v, subject: e.target.value }))} style={{ ...inp, marginBottom: 10 }} />
            <textarea value={invite.body} onChange={e => setInvite(v => ({ ...v, body: e.target.value }))} rows={11} style={{ ...inp, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setInvite(null)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid " + C.border, background: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={async () => {
                const url = invite.kind === "coagent" ? "/transactions/" + txId + "/coagents/" + invite.pid + "/invite" : "/transactions/" + txId + "/partners/" + invite.pid + "/invite";
                const r = await fetch(API + url, { method: "POST", headers, body: JSON.stringify({ confirm: true, subject: invite.subject, body: invite.body }) });
                const x = await r.json();
                if (!r.ok || !x.success) { alert(x.error || "Couldn't send"); return; }
                setInvite(null);
                setMsg(invite.kind !== "coagent" ? `✅ Partner link sent to ${invite.to}.`
                  : x.mode === "linked" ? `✅ ${invite.to} is working this deal — it's in their TransactPro app now.`
                  : `✅ Invite sent to ${invite.to}. When they open it and pick a password, the deal opens in their app (status changes to "Working this deal").`);
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
              {/* A co-agent viewing: "Your net" in the deal's calculation is the deal agent's. */}
              <span>{l.kind === "result" && d.viewer === "coagent" ? `${d.ownerName || "Deal agent"}'s net` : l.label}</span><span>{money(l.amount)}</span>
            </div>
          ))}
          {(calc.coAgents || []).map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted }}><span>{c.name}'s net</span><span>{money(c.net)}</span></div>
          ))}
          {d.viewer === "coagent" && d.agent_net_mine != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, color: "#166534", paddingTop: 4 }}><span>Your net</span><span>{money(d.agent_net_mine)}</span></div>
          )}
        </div>
      )}
    </div>
  );
}
