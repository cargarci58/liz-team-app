import { useState, useEffect, useCallback } from "react";
import AssistantPanel from "./components/AssistantPanel";

// ── Transaction Coordinator portal ──────────────────────────────────────────
// One cross-brokerage home for an independent coordinator. Two sides:
//  1. The AGENT's deal (coordination view) — timeline, people, documents,
//     health, activity, send updates. Sees the whole deal incl. prices, but
//     NEVER the agent's commission/financials (the server never sends them).
//  2. The TC's OWN business (paid $149/mo tier) — their dashboard, their money
//     ledger + P&L, and their goals. Scoped to the coordinator, never the agent.
// All data comes from the self-contained /tc/* endpoints.

const API = "https://liz-team-server-api-production.up.railway.app";
const C = {
  ink: "#111111", red: "#C0392B", soft: "#FADBD8", paper: "#ffffff",
  bg: "#F7F4F2", line: "#e7e2df", muted: "#7a716c", green: "#1e8449", amber: "#B9770E",
};
const tok = () => localStorage.getItem("tp_token") || "";

async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok(), ...(opts.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const err = new Error(data.error || "Something went wrong"); err.status = r.status; throw err; }
  return data;
}

function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return String(d); }
}
const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const fullName = (u) => `${u?.firstName || u?.first_name || ""} ${u?.lastName || u?.last_name || ""}`.trim();

const card = { background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 14 };
const btn = (primary) => ({
  fontSize: 15, fontWeight: 700, padding: "10px 16px", borderRadius: 10, cursor: "pointer",
  border: primary ? "none" : `1px solid ${C.line}`, background: primary ? C.red : C.paper, color: primary ? "#fff" : C.ink,
});
const input = { fontSize: 16, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, width: "100%", boxSizing: "border-box" };
const pill = (bg, fg) => ({ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: bg, color: fg });

const ROLE_OPTIONS = ["Buyer", "Seller", "Buyer's Agent", "Listing Agent", "Lender", "Title", "Inspector", "Appraiser", "HOA", "Closing Attorney", "Other"];

export default function TCPortal({ user, onLogout }) {
  const [nav, setNav] = useState("dashboard"); // dashboard | deals | business
  const [openId, setOpenId] = useState(null);

  // Deal list for the AI assistant's snapshot (TC parity: same 🎙 button as
  // the agent app). Shapes normalized to what AssistantPanel expects; the
  // server-side lookup tools are TC-scoped by the token's role, so the AI
  // only ever sees this coordinator's assigned deals.
  const [assistTx, setAssistTx] = useState([]);
  useEffect(() => {
    api("/tc/transactions").then(d => setAssistTx((d.transactions || []).map(t => ({
      id: t.id, address: t.address, status: t.status,
      closingDate: t.closing_date || "",
      price: t.contract_price || t.list_price || "",
      type: t.transaction_type || "",
      next_milestone: t.next_milestone ? { name: t.next_milestone.name, dueDate: t.next_milestone.due_date } : null,
    })))).catch(() => {});
  }, []);

  const NAVS = [
    { id: "dashboard", label: "🏠 Dashboard" },
    { id: "deals", label: "📁 Deals" },
    { id: "business", label: "💼 My Business" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ background: C.ink, color: "#fff", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Coordinator Portal</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{fullName(user) || user?.email}</div>
        </div>
        <button onClick={onLogout} style={{ ...btn(false), background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>Log out</button>
      </div>

      {!openId && (
        <div style={{ background: C.paper, borderBottom: `1px solid ${C.line}`, display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto" }}>
          {NAVS.map(n => (
            <button key={n.id} onClick={() => setNav(n.id)}
              style={{ ...btn(nav === n.id), whiteSpace: "nowrap", padding: "8px 14px", fontSize: 14 }}>{n.label}</button>
          ))}
        </div>
      )}

      <div style={{ maxWidth: 820, margin: "0 auto", padding: 18 }}>
        {openId
          ? <DealView txId={openId} onBack={() => setOpenId(null)} />
          : nav === "dashboard" ? <Dashboard onOpen={setOpenId} onGoDeals={() => setNav("deals")} />
          : nav === "deals" ? <Deals onOpen={setOpenId} />
          : <Business user={user} />}
      </div>

      <AssistantPanel
        token={tok()}
        contacts={[]}
        transactions={assistTx}
        currentView={openId ? "deal" : nav}
        currentDealAddress={openId ? (assistTx.find(t => String(t.id) === String(openId))?.address || "") : ""}
        onOpenDeal={(id) => { setOpenId(id); }}
        onNavigate={(target) => {
          setOpenId(null);
          setNav(target === "reports" || target === "expenses" ? "business" : target === "dashboard" || target === "home" ? "dashboard" : "deals");
        }}
      />
    </div>
  );
}

// ── PHASE B: dashboard across all the TC's deals ────────────────────────────
function Dashboard({ onOpen, onGoDeals }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/tc/dashboard").then(setD).catch(e => setErr(e.message)); }, []);

  if (err) return <div style={{ ...card, color: C.red }}>⚠️ {err}</div>;
  if (!d) return <div style={{ ...card, color: C.muted }}>Loading your numbers…</div>;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueClass = (m) => {
    const raw = m.scheduled_date || m.due_date; if (!raw) return C.muted;
    const dd = new Date(raw); dd.setHours(0, 0, 0, 0);
    if (dd < today) return C.red; if (dd.getTime() === today.getTime()) return C.amber; return C.muted;
  };
  const stat = (label, value, sub) => (
    <div style={{ ...card, marginBottom: 0, textAlign: "center", flex: "1 1 130px" }}>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {stat("Active deals", d.totals.active)}
        {stat("Closed", d.totals.closed)}
        {stat("Win rate", d.winRate == null ? "—" : d.winRate + "%", "closed vs ended")}
        {stat("On-time", d.onTimePct == null ? "—" : d.onTimePct + "%", "milestones")}
      </div>

      {d.byStatus.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Your book</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {d.byStatus.map(s => (
              <span key={s.status} style={pill(C.bg, C.ink)}>{s.status}: <strong>{s.n}</strong></span>
            ))}
          </div>
          <button style={{ ...btn(false), marginTop: 12 }} onClick={onGoDeals}>View all deals →</button>
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>What's due</div>
        {d.due.length === 0 && <div style={{ color: C.muted, fontSize: 14 }}>Nothing scheduled is open right now. 🎉</div>}
        {d.due.map(m => (
          <div key={m.id} onClick={() => onOpen(m.transaction_id)}
            style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: `1px solid ${C.line}`, cursor: "pointer" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{m.address}</div>
            </div>
            <div style={{ fontSize: 12, color: dueClass(m), fontWeight: 700, whiteSpace: "nowrap" }}>
              {fmtDate(m.scheduled_date || m.due_date)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Deal list ───────────────────────────────────────────────────────────────
function Deals({ onOpen }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/tc/transactions").then(d => setList(d.transactions || [])).catch(e => { setErr(e.message); setList([]); }); }, []);

  if (err) return <div style={{ ...card, color: C.red }}>⚠️ {err}</div>;
  if (list === null) return <div style={{ ...card, color: C.muted }}>Loading your deals…</div>;
  if (list.length === 0) return (
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>No deals yet</div>
      <div style={{ color: C.muted, fontSize: 14 }}>When an agent adds you as the coordinator on a transaction, it shows up here automatically — all of them in one place.</div>
    </div>
  );
  return (
    <>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>{list.length} deal{list.length === 1 ? "" : "s"} you're coordinating</div>
      {list.map(tx => {
        const total = Number(tx.milestone_total || 0), done = Number(tx.milestone_done || 0);
        const pct = total ? Math.round((done / total) * 100) : 0;
        const agent = `${tx.owning_agent_first_name || ""} ${tx.owning_agent_last_name || ""}`.trim();
        return (
          <div key={tx.id} style={{ ...card, cursor: "pointer" }} onClick={() => onOpen(tx.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{tx.address || "—"}</div>
              <span style={pill(C.soft, C.red)}>{tx.status}</span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{[tx.city, tx.state].filter(Boolean).join(", ")}</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>
              <strong>Acting for</strong> {agent || "the agent"}{tx.owning_brokerage ? ` · ${tx.owning_brokerage}` : ""}
            </div>
            <div style={{ marginTop: 10, height: 7, background: C.bg, borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: C.red }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginTop: 5 }}>
              <span>{done}/{total} milestones</span>
              {tx.next_milestone && <span>Next: {tx.next_milestone.name}{tx.next_milestone.due_date ? ` · ${fmtDate(tx.next_milestone.due_date)}` : ""}</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}

function DealView({ txId, onBack }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("timeline");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try { setD(await api(`/tc/transaction/${txId}`)); }
    catch (e) { setErr(e.message); }
  }, [txId]);
  useEffect(() => { load(); }, [load]);

  if (err) return <div style={{ ...card, color: C.red }}>⚠️ {err} <button style={{ ...btn(false), marginLeft: 10 }} onClick={onBack}>Back</button></div>;
  if (!d) return <div style={{ ...card, color: C.muted }}>Loading…</div>;

  const { transaction: tx, parties, milestones, documents, permissions } = d;
  const agent = `${tx.owning_agent_first_name || ""} ${tx.owning_agent_last_name || ""}`.trim();
  const price = tx.contract_price || tx.list_price;
  const tabs = [
    { id: "timeline", label: "📅 Timeline" },
    { id: "people", label: `People (${parties.length})` },
    { id: "documents", label: "📎 Documents" },
    { id: "health", label: "🩺 Health" },
    { id: "activity", label: "🧾 Activity" },
    ...(permissions.reminders ? [{ id: "send", label: "✉️ Send Update" }] : []),
  ];

  const act = async (fn) => { setBusy("1"); try { await fn(); await load(); } catch (e) { alert("⚠️ " + e.message); } setBusy(""); };

  return (
    <>
      <button style={{ ...btn(false), marginBottom: 12 }} onClick={onBack}>← All deals</button>
      <div style={{ ...card, background: C.ink, color: "#fff" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{tx.address}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
          Acting for <strong>{agent || "the agent"}</strong>{tx.owning_brokerage ? ` · ${tx.owning_brokerage}` : ""} · {tx.status}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
          {price ? <>Price <strong>{money(price)}</strong>{tx.contract_price ? "" : " (list)"}</> : null}
          {tx.closing_date ? `  ·  Closing ${fmtDate(tx.closing_date)}` : ""}
        </div>
        {(tx.owning_agent_email || tx.owning_agent_phone) && (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{[tx.owning_agent_email, tx.owning_agent_phone].filter(Boolean).join(" · ")}</div>
        )}
        {/* TC parity with the agent app's fall-through flow: archives the whole
            contract for compliance, files docs to a "Last contract" folder,
            clears the other side's people, resets the deal to Active. */}
        {/under contract|inspection|appraisal|clear to close|pending/i.test(tx.status || "") && (
          <button
            disabled={!!busy}
            onClick={() => act(async () => {
              const reason = (window.prompt('Contract fell through?\n\nThis archives the FULL contract record (people, timeline, terms, documents list), files its documents to a "Last contract" folder, removes the other side\'s people, and resets the deal to Active with a fresh timeline. Messages stay.\n\nType the reason: financing, inspection, appraisal, buyer_cold_feet, seller_side, insurance, title, or other') || "").trim().toLowerCase();
              if (!reason) return;
              await api(`/transactions/${txId}/fall-through`, { method: "POST", body: JSON.stringify({ reason }) });
              alert("✓ Contract archived and deal reset to Active. The archive is on the deal's record; let the agent know about MLS + deposit release.");
            })}
            style={{ ...btn(false), marginTop: 10, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            💔 Contract fell through…
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ ...btn(tab === t.id), whiteSpace: "nowrap", padding: "8px 14px", fontSize: 14 }}>{t.label}</button>
        ))}
      </div>

      {tab === "timeline" && (
        <div>
          {!permissions.milestones && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>View-only — the agent hasn't enabled timeline edits for you on this deal.</div>}
          {milestones.length === 0 && <div style={{ ...card, color: C.muted }}>No timeline items yet.</div>}
          {milestones.map(m => {
            const done = m.status === "Completed";
            return (
              <div key={m.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 700, textDecoration: done ? "line-through" : "none", color: done ? C.muted : C.ink }}>{m.name}</div>
                  <span style={pill(done ? "#e8f5ee" : C.soft, done ? C.green : C.red)}>{m.status}</span>
                </div>
                {(m.scheduled_date || m.due_date) && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                    {m.scheduled_date ? `Scheduled ${fmtDate(m.scheduled_date)}${m.scheduled_time ? " " + m.scheduled_time : ""}` : `Due ${fmtDate(m.due_date)}`}
                  </div>
                )}
                {m.requires_document && (
                  <div style={{ fontSize: 12, marginTop: 4, color: m.document_uploaded ? C.green : C.amber }}>
                    {m.document_uploaded ? "📎 Document on file" : "📎 Document needed"}
                  </div>
                )}
                {permissions.milestones && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {!done && <button disabled={!!busy} style={btn(true)} onClick={() => act(() => api(`/tc/milestones/${m.id}/complete`, { method: "PATCH" }))}>✓ Mark done</button>}
                    {done && <button disabled={!!busy} style={btn(false)} onClick={() => act(() => api(`/tc/milestones/${m.id}/reopen`, { method: "PATCH" }))}>Undo</button>}
                    {!done && <ScheduleControl onSave={(date, time) => act(() => api(`/tc/milestones/${m.id}/schedule`, { method: "PATCH", body: JSON.stringify({ date, time }) }))} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "people" && (
        <PeopleTab txId={txId} parties={parties} canEdit={permissions.parties} onChange={load} />
      )}

      {tab === "documents" && (
        <DocsTab txId={txId} documents={documents} milestones={milestones} canUpload={permissions.docs} onChange={load} />
      )}

      {tab === "health" && <HealthTab txId={txId} />}

      {tab === "activity" && <ActivityTab txId={txId} />}

      {tab === "send" && permissions.reminders && (
        <SendUpdate txId={txId} parties={parties} identity={permissions.emailIdentity} />
      )}
    </>
  );
}

function ScheduleControl({ onSave }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  if (!open) return <button style={btn(false)} onClick={() => setOpen(true)}>📅 Set date</button>;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...input, width: "auto" }} />
      <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...input, width: "auto" }} />
      <button style={btn(true)} disabled={!date} onClick={() => onSave(date, time)}>Save</button>
    </span>
  );
}

// ── People tab (add / edit / remove) ────────────────────────────────────────
function PeopleTab({ txId, parties, canEdit, onChange }) {
  const [editing, setEditing] = useState(null); // party object or {new:true}
  const [busy, setBusy] = useState(false);

  const blank = { role: "Buyer", name: "", email: "", phone: "", company: "" };
  const save = async (form) => {
    setBusy(true);
    try {
      if (form.id) await api(`/tc/party/${form.id}`, { method: "PATCH", body: JSON.stringify(form) });
      else await api(`/tc/transaction/${txId}/party`, { method: "POST", body: JSON.stringify(form) });
      setEditing(null); await onChange();
    } catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };
  const remove = async (p) => {
    if (!window.confirm(`Remove ${p.name || "this person"} from the deal?`)) return;
    setBusy(true);
    try { await api(`/tc/party/${p.id}`, { method: "DELETE" }); await onChange(); }
    catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };

  return (
    <div>
      {canEdit && !editing && (
        <button style={{ ...btn(true), marginBottom: 12 }} onClick={() => setEditing({ ...blank })}>＋ Add person</button>
      )}
      {editing && <PartyForm initial={editing} busy={busy} onCancel={() => setEditing(null)} onSave={save} />}
      {parties.map(p => (
        <div key={p.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{p.role}</div>
            {canEdit && (p.role || "").toLowerCase() !== "transaction coordinator" && (
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...btn(false), padding: "4px 10px", fontSize: 12 }} onClick={() => setEditing({ ...p })}>Edit</button>
                <button style={{ ...btn(false), padding: "4px 10px", fontSize: 12, color: C.red, borderColor: C.soft }} onClick={() => remove(p)}>Remove</button>
              </div>
            )}
          </div>
          <div style={{ fontWeight: 700 }}>{p.name || "—"}</div>
          <div style={{ fontSize: 13, color: C.muted }}>{[p.email, p.phone, p.company].filter(Boolean).join(" · ")}</div>
        </div>
      ))}
    </div>
  );
}

function PartyForm({ initial, busy, onCancel, onSave }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{f.id ? "Edit person" : "Add person"}</div>
      <select value={f.role} onChange={set("role")} style={{ ...input, marginBottom: 8 }}>
        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <input placeholder="Full name" value={f.name || ""} onChange={set("name")} style={{ ...input, marginBottom: 8 }} />
      <input placeholder="Email" value={f.email || ""} onChange={set("email")} style={{ ...input, marginBottom: 8 }} />
      <input placeholder="Phone" value={f.phone || ""} onChange={set("phone")} style={{ ...input, marginBottom: 8 }} />
      <input placeholder="Company / brokerage" value={f.company || ""} onChange={set("company")} style={{ ...input, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn(true)} disabled={busy || !f.name.trim()} onClick={() => onSave(f)}>{busy ? "Saving…" : "Save"}</button>
        <button style={btn(false)} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function HealthTab({ txId }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  // Fall-through archives (TC parity with the agent app's "Past contracts").
  const [fails, setFails] = useState([]);
  const [restoreMsg, setRestoreMsg] = useState("");
  const load = useCallback(() => api(`/tc/transaction/${txId}/deal-doctor`).then(setD).catch(() => setD({ dealDoctor: null })), [txId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api(`/transactions/${txId}/failed-contracts`).then(x => setFails(x.archives || [])).catch(() => {}); }, [txId]);
  const run = async () => { setBusy(true); try { setD(await api(`/tc/transaction/${txId}/deal-doctor`, { method: "POST" })); } catch (e) { alert("⚠️ " + e.message); } setBusy(false); };
  const restore = async () => {
    setRestoreMsg("Working…");
    try {
      const r = await api(`/transactions/${txId}/failed-contracts/restore-pre-contract`, { method: "POST" });
      setRestoreMsg(`✓ Restored ${r.restored} checkmark(s), closed ${r.remindersClosed || 0} stale reminder(s).`);
    } catch (e) { setRestoreMsg("⚠️ " + e.message); }
  };

  if (!d) return <div style={{ ...card, color: C.muted }}>Loading…</div>;
  const dd = d.dealDoctor;
  const hc = { green: C.green, yellow: C.amber, red: C.red };
  return (
    <div>
      {fails.length > 0 && (
        <div style={{ ...card, borderColor: C.soft }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>💔 Past contracts on this deal</div>
          {fails.map(f => (
            <div key={f.id} style={{ fontSize: 13, color: C.muted, padding: "4px 0" }}>
              Fell through {fmtDate(f.created_at)} — {(f.reason || "other").replace(/_/g, " ")}
              {(f.snapshot?.parties || []).length ? ` · ${(f.snapshot.parties || []).map(p => p.name).filter(Boolean).slice(0, 4).join(", ")}` : ""}
            </div>
          ))}
          <button style={{ ...btn(false), marginTop: 8 }} onClick={restore}>↩ Restore pre-contract checkmarks / clear stale reminders</button>
          {restoreMsg && <div style={{ fontSize: 12.5, marginTop: 6, color: restoreMsg.startsWith("✓") ? C.green : C.red }}>{restoreMsg}</div>}
        </div>
      )}
      <button style={{ ...btn(true), marginBottom: 12 }} disabled={busy} onClick={run}>{busy ? "Checking…" : "🩺 Run check-up"}</button>
      {!dd && <div style={{ ...card, color: C.muted }}>No check-up yet — tap “Run check-up” for a quick read on this deal's risk and the next move.</div>}
      {dd && (
        <div style={card}>
          <span style={pill(hc[dd.health] + "22", hc[dd.health] || C.muted)}>● {String(dd.health || "").toUpperCase()}</span>
          <div style={{ marginTop: 12 }}><strong>Biggest risk</strong><div style={{ color: C.muted, marginTop: 2 }}>{dd.risk}</div></div>
          <div style={{ marginTop: 12 }}><strong>Do this today</strong><div style={{ color: C.muted, marginTop: 2 }}>{dd.move}</div></div>
          {dd.draft && dd.draft.channel !== "none" && dd.draft.body && (
            <div style={{ marginTop: 12, background: C.bg, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Ready draft → {dd.draft.toRole} ({dd.draft.channel}){dd.draft.subject ? ` · ${dd.draft.subject}` : ""}</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{dd.draft.body}</div>
            </div>
          )}
          {d.at && <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Updated {fmtDate(d.at)}</div>}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ txId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api(`/tc/transaction/${txId}/activity`).then(d => setRows(d.activities || [])).catch(() => setRows([])); }, [txId]);
  if (rows === null) return <div style={{ ...card, color: C.muted }}>Loading…</div>;
  if (rows.length === 0) return <div style={{ ...card, color: C.muted }}>No activity logged yet.</div>;
  return (
    <div style={card}>
      {rows.map(a => (
        <div key={a.id} style={{ padding: "9px 0", borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 14 }}>{a.details || a.action}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{a.user_name || "—"} · {fmtDate(a.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

function DocsTab({ txId, documents, milestones, canUpload, onChange }) {
  const [busy, setBusy] = useState(false);
  const [msId, setMsId] = useState("");

  const needed = milestones.filter(m => m.requires_document);
  const view = async (id) => {
    try { const d = await api(`/tc/documents/${id}/view-url`); window.open(d.viewUrl, "_blank"); }
    catch (e) { alert("⚠️ " + e.message); }
  };
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(",")[1]);
        fr.onerror = rej; fr.readAsDataURL(file);
      });
      await api(`/tc/transaction/${txId}/documents`, {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileType: file.type || "application/octet-stream", base64, milestoneId: msId || null }),
      });
      setMsId("");
      await onChange();
    } catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };

  return (
    <div>
      {needed.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Required documents</div>
          {needed.map(m => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 14 }}>{m.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: m.document_uploaded ? C.green : C.amber }}>{m.document_uploaded ? "✓ On file" : "Needed"}</span>
            </div>
          ))}
        </div>
      )}
      {canUpload && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Upload a document</div>
          <select value={msId} onChange={e => setMsId(e.target.value)} style={{ ...input, marginBottom: 8 }}>
            <option value="">General (not tied to a milestone)</option>
            {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="file" disabled={busy} onChange={e => upload(e.target.files[0])} style={{ fontSize: 14 }} />
          {busy && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Uploading…</div>}
        </div>
      )}
      {documents.length === 0 && <div style={{ ...card, color: C.muted }}>No documents on file yet.</div>}
      {/* Grouped by folder like the agent app — fall-through archives land in
          a "Fell through — (buyer)" folder that must be visible here too. */}
      {(() => {
        const groups = {};
        for (const doc of documents) { const k = doc.folder || ""; (groups[k] = groups[k] || []).push(doc); }
        const keys = Object.keys(groups).sort((a, b) => (a === "") - (b === "") || a.localeCompare(b));
        return keys.map(k => (
          <div key={k || "root"}>
            {k && <div style={{ fontWeight: 800, fontSize: 13, color: C.ink, margin: "10px 0 6px" }}>📁 {k}</div>}
            {groups[k].map(doc => (
              <div key={doc.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{doc.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{[doc.category, fmtDate(doc.created_at)].filter(Boolean).join(" · ")}</div>
                </div>
                <button style={btn(false)} onClick={() => view(doc.id)}>View</button>
              </div>
            ))}
          </div>
        ));
      })()}
    </div>
  );
}

function SendUpdate({ txId, parties, identity }) {
  const recipients = parties.filter(p => p.email);
  const [picked, setPicked] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const toggle = (email) => setPicked(p => p.includes(email) ? p.filter(e => e !== email) : [...p, email]);
  const send = async () => {
    setBusy(true); setDone("");
    try {
      const d = await api(`/tc/transaction/${txId}/message`, {
        method: "POST",
        body: JSON.stringify({ recipientEmails: picked, subject, message }),
      });
      setDone(`✅ Sent to ${d.sent} recipient${d.sent === 1 ? "" : "s"}.`);
      setMessage(""); setSubject(""); setPicked([]);
    } catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
        Goes out in the agent's name{identity === "cobrand" ? " (co-branded with you)" : ""}.
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Send to</div>
      <div style={{ marginBottom: 12 }}>
        {recipients.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>No party on this deal has an email.</div>}
        {recipients.map(p => (
          <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 14 }}>
            <input type="checkbox" checked={picked.includes(p.email)} onChange={() => toggle(p.email)} />
            <span>{p.name || p.email} <span style={{ color: C.muted }}>· {p.role}</span></span>
          </label>
        ))}
      </div>
      <input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} style={{ ...input, marginBottom: 8 }} />
      <textarea placeholder="Your message…" value={message} onChange={e => setMessage(e.target.value)} rows={5} style={{ ...input, marginBottom: 10, resize: "vertical" }} />
      <button style={btn(true)} disabled={busy || !message.trim() || picked.length === 0} onClick={send}>{busy ? "Sending…" : "Send update"}</button>
      {done && <div style={{ color: C.green, fontSize: 14, marginTop: 10 }}>{done}</div>}
    </div>
  );
}

// ── PHASE C: the TC's own business (paid $149/mo) ───────────────────────────
function Business({ user }) {
  const [acct, setAcct] = useState(null);
  useEffect(() => { api("/tc/account").then(setAcct).catch(() => setAcct({ subscription: { active: false, priceMonthly: 149 } })); }, []);
  if (!acct) return <div style={{ ...card, color: C.muted }}>Loading…</div>;
  if (!acct.subscription.active) return <Upgrade price={acct.subscription.priceMonthly} onDone={() => api("/tc/account").then(setAcct)} />;
  return <BusinessSuite />;
}

function Upgrade({ price, onDone }) {
  const [busy, setBusy] = useState(false);
  const subscribe = async () => {
    if (!window.confirm(`Start your coordinator subscription at $${price}/month?`)) return;
    setBusy(true);
    try { await api("/tc/subscribe", { method: "POST" }); await onDone(); }
    catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };
  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 20 }}>Run your whole business here</div>
      <div style={{ color: C.muted, marginTop: 6, fontSize: 14 }}>
        Coordinating deals an agent invited you to is always free. Unlock your own business tools to track your income, expenses, and goals across every deal you run.
      </div>
      <ul style={{ color: C.ink, fontSize: 14, marginTop: 12, paddingLeft: 18 }}>
        <li>Your money: income, expenses, and a simple profit & loss</li>
        <li>Your goals: deals and income targets with live progress</li>
        <li>Add your own transactions, not just invited ones</li>
      </ul>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 14 }}>${price}<span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>/month</span></div>
      <button style={{ ...btn(true), marginTop: 12 }} disabled={busy} onClick={subscribe}>{busy ? "Starting…" : "Start subscription"}</button>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>You can cancel anytime.</div>
    </div>
  );
}

function BusinessSuite() {
  const [sub, setSub] = useState("money"); // money | goals
  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[{ id: "money", label: "💵 Money" }, { id: "goals", label: "🎯 Goals" }].map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{ ...btn(sub === s.id), padding: "8px 14px", fontSize: 14 }}>{s.label}</button>
        ))}
      </div>
      {sub === "money" ? <Money /> : <Goals />}
    </>
  );
}

function Money() {
  const [d, setD] = useState(null);
  const [kind, setKind] = useState("income");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/tc/ledger").then(setD).catch(e => setD({ error: e.message })), []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setBusy(true);
    try {
      await api("/tc/ledger", { method: "POST", body: JSON.stringify({ kind, amount: Number(amount), label }) });
      setAmount(""); setLabel(""); await load();
    } catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };
  const del = async (id) => { try { await api(`/tc/ledger/${id}`, { method: "DELETE" }); await load(); } catch (e) { alert("⚠️ " + e.message); } };

  if (!d) return <div style={{ ...card, color: C.muted }}>Loading…</div>;
  if (d.error) return <div style={{ ...card, color: C.red }}>⚠️ {d.error}</div>;
  const s = d.summary;
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ ...card, marginBottom: 0, flex: 1, textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{money(s.income)}</div><div style={{ fontSize: 12, color: C.muted }}>Income</div></div>
        <div style={{ ...card, marginBottom: 0, flex: 1, textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: C.red }}>{money(s.expense)}</div><div style={{ fontSize: 12, color: C.muted }}>Expenses</div></div>
        <div style={{ ...card, marginBottom: 0, flex: 1, textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800 }}>{money(s.net)}</div><div style={{ fontSize: 12, color: C.muted }}>Net</div></div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Add an entry</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {["income", "expense"].map(k => (
            <button key={k} onClick={() => setKind(k)} style={{ ...btn(kind === k), padding: "8px 14px", fontSize: 14, textTransform: "capitalize" }}>{k}</button>
          ))}
        </div>
        <input placeholder="What for? (e.g. Smith deal retainer)" value={label} onChange={e => setLabel(e.target.value)} style={{ ...input, marginBottom: 8 }} />
        <input placeholder="Amount" type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...input, marginBottom: 10 }} />
        <button style={btn(true)} disabled={busy || !(Number(amount) > 0)} onClick={add}>{busy ? "Adding…" : "Add"}</button>
      </div>

      {d.entries.length === 0 && <div style={{ ...card, color: C.muted }}>No entries yet. Add your first above.</div>}
      {d.entries.map(e => (
        <div key={e.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700 }}>{e.label || (e.kind === "income" ? "Income" : "Expense")}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{[e.category, fmtDate(e.entry_date || e.created_at)].filter(Boolean).join(" · ")}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontWeight: 800, color: e.kind === "income" ? C.green : C.red }}>{e.kind === "income" ? "+" : "−"}{money(e.amount)}</span>
            <button style={{ ...btn(false), padding: "4px 10px", fontSize: 12 }} onClick={() => del(e.id)}>✕</button>
          </div>
        </div>
      ))}
    </>
  );
}

function Goals() {
  const [d, setD] = useState(null);
  const [form, setForm] = useState({ dealsGoal: "", incomeGoal: "", period: "month" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/tc/goals").then(r => { setD(r); setForm({ dealsGoal: r.goal?.deals_goal ?? "", incomeGoal: r.goal?.income_goal ?? "", period: r.goal?.period || "month" }); }).catch(e => setD({ error: e.message })), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    try { await api("/tc/goals", { method: "PUT", body: JSON.stringify(form) }); await load(); }
    catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };

  if (!d) return <div style={{ ...card, color: C.muted }}>Loading…</div>;
  if (d.error) return <div style={{ ...card, color: C.red }}>⚠️ {d.error}</div>;
  const p = d.progress || { closedDeals: 0, income: 0 };
  const bar = (done, goal, color) => {
    const pct = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;
    return <div style={{ height: 9, background: C.bg, borderRadius: 99, overflow: "hidden", marginTop: 6 }}><div style={{ width: pct + "%", height: "100%", background: color }} /></div>;
  };
  return (
    <>
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Set your target</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {["month", "year"].map(pr => (
            <button key={pr} onClick={() => setForm(f => ({ ...f, period: pr }))} style={{ ...btn(form.period === pr), padding: "8px 14px", fontSize: 14, textTransform: "capitalize" }}>Per {pr}</button>
          ))}
        </div>
        <input placeholder="Deals goal" type="number" value={form.dealsGoal} onChange={e => setForm(f => ({ ...f, dealsGoal: e.target.value }))} style={{ ...input, marginBottom: 8 }} />
        <input placeholder="Income goal ($)" type="number" value={form.incomeGoal} onChange={e => setForm(f => ({ ...f, incomeGoal: e.target.value }))} style={{ ...input, marginBottom: 10 }} />
        <button style={btn(true)} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save goal"}</button>
      </div>

      {d.goal && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Progress</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Closed deals</span><span><strong>{p.closedDeals}</strong>{d.goal.deals_goal ? ` / ${d.goal.deals_goal}` : ""}</span></div>
            {d.goal.deals_goal ? bar(p.closedDeals, d.goal.deals_goal, C.red) : null}
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Income</span><span><strong>{money(p.income)}</strong>{d.goal.income_goal ? ` / ${money(d.goal.income_goal)}` : ""}</span></div>
            {d.goal.income_goal ? bar(p.income, d.goal.income_goal, C.green) : null}
          </div>
        </div>
      )}
    </>
  );
}
