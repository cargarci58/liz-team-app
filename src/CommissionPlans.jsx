import { t as tr } from "./i18n";
import { useState, useEffect } from "react";
import { askConfirm } from "./ui/dialogs";

const API = "https://liz-team-server-api-production.up.railway.app";

// COMMISSION PLANS (Company Settings). How THIS brokerage works out commission:
// an ordered list of steps the admin turns on/off and reorders, with a live
// $400,000 example underneath so they can check it matches how they really pay.
// Brokerage default plan → a different plan per agent → (admin) per-deal
// override on the deal's Sharing box. Only admins edit; agents can look.
const STEP_INFO = {
  referral: { title: "Referral fee off the top", help: "When a deal is a Referral In, the referring agent's fee (the % on the deal) comes off first." },
  co_agent: { title: "Co-agent split", help: "On a co-shared deal, each co-agent's share % is split off." },
  brokerage_split: { title: "Brokerage split", help: "The brokerage's % of the agent's commission. A % typed on the deal itself wins." },
  cap: { title: "Annual cap", help: "Once an agent has paid the brokerage this much in split this calendar year, the split stops." },
  flat_fee: { title: "Flat fee per deal", help: "A fixed $ the agent pays the brokerage on every deal (a \"100% plan\")." },
  team_split: { title: "Team leader split", help: "A % of the agent's share that goes to the team leader." },
  office_fee: { title: "Office fee", help: "The deal's office flat fee, paid by the agent to the brokerage." },
};
const C = { red: "#C0392B", dark: "#922B21", gray: "#F4F4F4", blue: "#0c4a6e", text: "#1f2937", muted: "#6b7280", border: "#E5E7EB" };
const money = (n) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(Number(n) || 0)).toLocaleString();

export default function CommissionPlans() {
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + tok };
  const [data, setData] = useState(null);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);       // { name, steps, is_default }
  const [example, setExample] = useState({ price: 400000, pct: 3, referralPct: 0, coAgentPct: 0, transactionFee: 395, officeFee: 0 });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => fetch(API + "/commission-plans", { headers }).then(r => r.json()).then(d => { setData(d.success ? d : false); }).catch(() => setData(false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Live example — the server's own calculator, so the preview IS the real math.
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => {
      fetch(API + "/commission-plans/preview", { method: "POST", headers, body: JSON.stringify({ ...example, steps: draft.steps }) })
        .then(r => r.json()).then(d => { if (d.success) setPreview(d.result); }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [draft, example]);

  if (data === false) return null;   // not available to this role (e.g. coordinators)
  if (!data) return <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{tr("Loading commission plans…")}</div>;
  const canEdit = data.canEdit;

  const startEdit = (p) => { setEditId(p.id); setDraft({ name: p.name, steps: p.steps, is_default: p.is_default }); setMsg(""); };
  const create = async (preset) => {
    setBusy(true);
    try {
      const r = await fetch(API + "/commission-plans", { method: "POST", headers, body: JSON.stringify({ preset, name: data.presets[preset].name }) });
      const d = await r.json(); if (!d.success) throw new Error(d.error || "Could not create");
      await load();
      setEditId(d.id); setDraft({ name: data.presets[preset].name, steps: data.presets[preset].steps, is_default: data.plans.length === 0 });
    } catch (e) { setMsg("⚠️ " + e.message); }
    setBusy(false);
  };
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(API + "/commission-plans/" + editId, { method: "PUT", headers, body: JSON.stringify(draft) });
      const d = await r.json(); if (!d.success) throw new Error(d.error || "Could not save");
      await load(); setMsg("✅ Saved — every deal on this plan is recalculated."); setEditId(null); setDraft(null);
    } catch (e) { setMsg("⚠️ " + e.message); }
    setBusy(false);
  };
  const remove = async (p) => {
    if (!(await askConfirm(tr("Delete the plan \"{name}\"? Agents and deals on it go back to the brokerage default.", { name: p.name }), { okLabel: tr("Delete"), danger: true }))) return;
    await fetch(API + "/commission-plans/" + p.id, { method: "DELETE", headers }).catch(() => {});
    if (editId === p.id) { setEditId(null); setDraft(null); }
    load();
  };
  const assign = async (agentId, planId) => {
    await fetch(API + "/users/" + agentId + "/commission-plan", { method: "PUT", headers, body: JSON.stringify({ planId: planId || null }) }).catch(() => {});
    load();
  };
  const setStep = (i, patch) => setDraft(d => ({ ...d, steps: d.steps.map((s, j) => j === i ? { ...s, ...patch } : s) }));
  const moveStep = (i, dir) => setDraft(d => {
    const steps = [...d.steps]; const j = i + dir;
    if (j < 0 || j >= steps.length) return d;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    return { ...d, steps };
  });

  const inp = { padding: "7px 9px", border: "1px solid " + C.border, borderRadius: 7, fontSize: 13, fontFamily: "inherit", width: 90 };
  const btn = (primary) => ({ padding: "8px 14px", borderRadius: 8, border: primary ? "none" : "1px solid " + C.border, background: primary ? C.blue : "#fff", color: primary ? "#fff" : C.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });
  const defaultPlan = data.plans.find(p => p.is_default);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, marginTop: 8 }}>{tr("Commission Plans")}</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
        {tr("How your brokerage works out commission. Every deal shows the")} <b>{tr("agent's net")}</b> {tr("and the")} <b>{tr("brokerage income")}</b> {tr("using these steps.")}
        {!canEdit && tr(" Only an admin can change plans.")}
      </div>

      {data.plans.length === 0 && (
        <div style={{ background: C.gray, borderRadius: 10, padding: 12, fontSize: 12.5, color: C.text, marginBottom: 10 }}>
          {tr("No plan yet — every deal uses the built-in")} <b>{tr("Standard split")}</b> {tr("(referral off the top → co-agent split → brokerage split → office fee; the transaction fee is brokerage income).")}
        </div>
      )}

      {data.plans.map(p => (
        <div key={p.id} style={{ border: "1px solid " + (editId === p.id ? C.blue : C.border), borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: 14, color: C.text }}>{p.name}</b>
            {p.is_default && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: C.blue, borderRadius: 10, padding: "2px 8px" }}>{tr("BROKERAGE DEFAULT")}</span>}
            <span style={{ flex: 1 }} />
            {canEdit && editId !== p.id && <button onClick={() => startEdit(p)} style={btn(false)}>{tr("✏️ Edit")}</button>}
            {canEdit && <button onClick={() => remove(p)} style={{ ...btn(false), color: C.dark }}>🗑</button>}
          </div>
          {editId !== p.id && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
              {p.steps.filter(s => s.enabled).map(s => STEP_INFO[s.type].title + (s.type === "brokerage_split" && s.brokeragePct ? ` ${s.brokeragePct}%` : s.type === "cap" ? ` $${Number(s.capAmount).toLocaleString()}` : s.type === "flat_fee" ? ` $${Number(s.amount).toLocaleString()}` : s.type === "team_split" ? ` ${s.pct}%` : "")).join(" → ")}
            </div>
          )}
          {editId === p.id && draft && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={{ ...inp, width: 220 }} />
                <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={!!draft.is_default} onChange={e => setDraft(d => ({ ...d, is_default: e.target.checked }))} /> {tr("Brokerage default")}
                </label>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{tr("Steps run top to bottom. Turn on what applies; use ▲▼ to change the order.")}</div>
              {draft.steps.map((s, i) => (
                <div key={s.type} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 0", borderTop: "1px solid " + C.gray, opacity: s.enabled ? 1 : 0.6 }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <button onClick={() => moveStep(i, -1)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, padding: 0 }}>▲</button>
                    <button onClick={() => moveStep(i, 1)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, padding: 0 }}>▼</button>
                  </div>
                  <input type="checkbox" checked={s.enabled} onChange={e => setStep(i, { enabled: e.target.checked })} style={{ marginTop: 3, width: 17, height: 17 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{tr(STEP_INFO[s.type].title)}</div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>{STEP_INFO[s.type].help}</div>
                    {s.enabled && s.type === "brokerage_split" && <label style={{ fontSize: 12 }}>{tr("Brokerage keeps")} <input type="number" value={s.brokeragePct} onChange={e => setStep(i, { brokeragePct: e.target.value })} style={inp} /> %</label>}
                    {s.enabled && s.type === "cap" && <label style={{ fontSize: 12 }}>{tr("Cap per year $")} <input type="number" value={s.capAmount} onChange={e => setStep(i, { capAmount: e.target.value })} style={inp} /></label>}
                    {s.enabled && s.type === "flat_fee" && <label style={{ fontSize: 12 }}>{tr("$ per deal")} <input type="number" value={s.amount} onChange={e => setStep(i, { amount: e.target.value })} style={inp} /></label>}
                    {s.enabled && s.type === "team_split" && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                        <label>{tr("Name")} <input value={s.label} onChange={e => setStep(i, { label: e.target.value })} style={{ ...inp, width: 140 }} /></label>
                        <label><input type="number" value={s.pct} onChange={e => setStep(i, { pct: e.target.value })} style={inp} /> %</label>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* LIVE EXAMPLE — the real calculator, so it matches every deal */}
              <div style={{ background: C.gray, borderRadius: 10, padding: 12, marginTop: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: C.blue, marginBottom: 6 }}>{tr("Example — check it matches how you pay")}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, marginBottom: 8 }}>
                  <label>{tr("Sale $")} <input type="number" value={example.price} onChange={e => setExample(x => ({ ...x, price: e.target.value }))} style={{ ...inp, width: 110 }} /></label>
                  <label>{tr("Commission %")} <input type="number" value={example.pct} onChange={e => setExample(x => ({ ...x, pct: e.target.value }))} style={inp} /></label>
                  <label>{tr("Referral %")} <input type="number" value={example.referralPct} onChange={e => setExample(x => ({ ...x, referralPct: e.target.value }))} style={inp} /></label>
                  <label>{tr("Co-agent %")} <input type="number" value={example.coAgentPct} onChange={e => setExample(x => ({ ...x, coAgentPct: e.target.value }))} style={inp} /></label>
                  <label>{tr("Transaction fee $")} <input type="number" value={example.transactionFee} onChange={e => setExample(x => ({ ...x, transactionFee: e.target.value }))} style={inp} /></label>
                  <label>{tr("Office fee $")} <input type="number" value={example.officeFee} onChange={e => setExample(x => ({ ...x, officeFee: e.target.value }))} style={inp} /></label>
                </div>
                {preview && preview.lines.map((l, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0",
                    fontWeight: l.kind === "result" || l.kind === "brokerage_total" || l.kind === "gross" ? 800 : 500,
                    color: l.kind === "result" ? "#166534" : l.kind === "brokerage_total" ? C.blue : C.text,
                    borderTop: l.kind === "result" ? "1px solid #d1d5db" : "none" }}>
                    <span>{tr(l.label)}</span><span>{money(l.amount)}</span>
                  </div>
                ))}
                {preview && preview.coAgents.map((c, i) => (
                  <div key={"co" + i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted }}><span>{tr("Co-agent's net")}</span><span>{money(c.net)}</span></div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button disabled={busy} onClick={save} style={btn(true)}>{busy ? tr("Saving…") : tr("Save plan")}</button>
                <button onClick={() => { setEditId(null); setDraft(null); }} style={btn(false)}>{tr("Cancel")}</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {canEdit && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontSize: 12.5, color: C.muted, alignSelf: "center" }}>{tr("Start a plan from:")}</span>
          {Object.entries(data.presets).map(([k, p]) => (
            <button key={k} disabled={busy} onClick={() => create(k)} style={btn(false)}>➕ {p.name}</button>
          ))}
        </div>
      )}

      {canEdit && data.plans.length > 0 && data.agents.length > 0 && (
        <div style={{ border: "1px solid " + C.border, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>{tr("Which plan each agent is on")}</div>
          {data.agents.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 13 }}>
              <span style={{ flex: 1 }}>{a.first_name} {a.last_name}</span>
              <select value={a.commission_plan_id || ""} onChange={e => assign(a.id, e.target.value)} style={{ ...inp, width: 200 }}>
                <option value="">{tr("Brokerage default")}{defaultPlan ? ` (${defaultPlan.name})` : ""}</option>
                {data.plans.map(p => <option key={p.id} value={p.id}>{tr(p.name)}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      {msg && <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, color: msg.startsWith("✅") ? "#166534" : C.dark }}>{msg}</div>}
    </div>
  );
}
