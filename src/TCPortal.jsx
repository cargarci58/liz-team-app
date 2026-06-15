import { useState, useEffect, useCallback } from "react";

// ── Transaction Coordinator portal ──────────────────────────────────────────
// One cross-brokerage home for an independent coordinator: every deal a paying
// agent invited them to. Coordination layer only (timeline / documents / people
// / send updates) — financials are never sent by the server. All data comes from
// the self-contained /tc/* endpoints, authorized by the assignment row.

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
  if (!r.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return String(d); }
}
const fullName = (u) => `${u?.firstName || u?.first_name || ""} ${u?.lastName || u?.last_name || ""}`.trim();

const card = { background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 14 };
const btn = (primary) => ({
  fontSize: 15, fontWeight: 700, padding: "10px 16px", borderRadius: 10, cursor: "pointer",
  border: primary ? "none" : `1px solid ${C.line}`, background: primary ? C.red : C.paper, color: primary ? "#fff" : C.ink,
});
const input = { fontSize: 16, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, width: "100%", boxSizing: "border-box" };
const pill = (bg, fg) => ({ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: bg, color: fg });

export default function TCPortal({ user, onLogout }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);

  const loadList = useCallback(async () => {
    try { const d = await api("/tc/transactions"); setList(d.transactions || []); }
    catch (e) { setErr(e.message); setList([]); }
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ background: C.ink, color: "#fff", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Coordinator Portal</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{fullName(user) || user?.email}</div>
        </div>
        <button onClick={onLogout} style={{ ...btn(false), background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>Log out</button>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: 18 }}>
        {openId
          ? <DealView txId={openId} onBack={() => { setOpenId(null); loadList(); }} />
          : <DealList list={list} err={err} onOpen={setOpenId} />}
      </div>
    </div>
  );
}

function DealList({ list, err, onOpen }) {
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
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              {[tx.city, tx.state].filter(Boolean).join(", ")}
            </div>
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
  const tabs = [
    { id: "timeline", label: "📅 Timeline" },
    { id: "people", label: `People (${parties.length})` },
    { id: "documents", label: "📎 Documents" },
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
        {(tx.owning_agent_email || tx.owning_agent_phone) && (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{[tx.owning_agent_email, tx.owning_agent_phone].filter(Boolean).join(" · ")}</div>
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
        <div>
          {parties.map(p => (
            <div key={p.id} style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{p.role}</div>
              <div style={{ fontWeight: 700 }}>{p.name || "—"}</div>
              <div style={{ fontSize: 13, color: C.muted }}>{[p.email, p.phone].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "documents" && (
        <DocsTab txId={txId} documents={documents} milestones={milestones} canUpload={permissions.docs} onChange={load} />
      )}

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

function DocsTab({ txId, documents, milestones, canUpload, onChange }) {
  const [busy, setBusy] = useState(false);
  const [msId, setMsId] = useState("");

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
      {documents.map(doc => (
        <div key={doc.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{doc.name}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{[doc.category, fmtDate(doc.created_at)].filter(Boolean).join(" · ")}</div>
          </div>
          <button style={btn(false)} onClick={() => view(doc.id)}>View</button>
        </div>
      ))}
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
