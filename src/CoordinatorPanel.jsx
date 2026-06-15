import { useState, useEffect, useCallback } from "react";

// Agent-side card (Parties tab): invite a transaction coordinator to THIS deal,
// see who's assigned, toggle their permissions / email voice, and remove them.
// Talks to the self-contained /transactions/:txId/coordinator endpoints.

const API = "https://liz-team-server-api-production.up.railway.app";
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

const L = { line: "#e7e2df", red: "#C0392B", muted: "#7a716c", soft: "#FADBD8" };
const wrap = { border: `1px solid ${L.line}`, borderRadius: 14, padding: 16, marginBottom: 16, background: "#fff" };
const input = { fontSize: 16, padding: "10px 12px", borderRadius: 10, border: `1px solid ${L.line}`, width: "100%", boxSizing: "border-box" };
const btn = (p) => ({ fontSize: 14, fontWeight: 700, padding: "9px 14px", borderRadius: 10, cursor: "pointer", border: p ? "none" : `1px solid ${L.line}`, background: p ? L.red : "#fff", color: p ? "#fff" : "#111" });

export default function CoordinatorPanel({ txId }) {
  const [coords, setCoords] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [identity, setIdentity] = useState("agent");
  const [perm, setPerm] = useState({ milestones: true, docs: true, reminders: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try { const d = await api(`/transactions/${txId}/coordinator`); setCoords(d.coordinators || []); }
    catch { setCoords([]); }
  }, [txId]);
  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    setBusy(true); setMsg("");
    try {
      await api(`/transactions/${txId}/coordinator`, {
        method: "POST",
        body: JSON.stringify({ email, name, emailIdentity: identity, permissions: perm }),
      });
      setMsg("✅ Coordinator invited — they'll get a portal link by email.");
      setEmail(""); setName(""); setShowForm(false);
      await load();
    } catch (e) { setMsg("⚠️ " + e.message); }
    setBusy(false);
  };

  const togglePerm = async (c, key) => {
    try { await api(`/transactions/${txId}/coordinator/${c.id}`, { method: "PATCH", body: JSON.stringify({ permissions: { [key]: !c[`can_${key === "milestones" ? "edit_milestones" : key === "docs" ? "upload_docs" : "send_reminders"}`] } }) }); await load(); }
    catch (e) { alert("⚠️ " + e.message); }
  };
  const setVoice = async (c, voice) => {
    try { await api(`/transactions/${txId}/coordinator/${c.id}`, { method: "PATCH", body: JSON.stringify({ emailIdentity: voice }) }); await load(); }
    catch (e) { alert("⚠️ " + e.message); }
  };
  const remove = async (c) => {
    if (!confirm(`Remove ${c.coordinator_name || c.coordinator_email} from this deal? They lose access immediately.`)) return;
    try { await api(`/transactions/${txId}/coordinator/${c.id}`, { method: "DELETE" }); await load(); }
    catch (e) { alert("⚠️ " + e.message); }
  };

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: coords && coords.length ? 12 : 0 }}>
        <div style={{ fontWeight: 800 }}>🤝 Transaction Coordinator</div>
        {!showForm && <button style={btn(true)} onClick={() => setShowForm(true)}>+ Add coordinator</button>}
      </div>

      {coords && coords.map(c => (
        <div key={c.id} style={{ border: `1px solid ${L.line}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{c.coordinator_name || c.coordinator_email}</div>
              <div style={{ fontSize: 12, color: L.muted }}>{c.coordinator_email}</div>
            </div>
            <button style={btn(false)} onClick={() => remove(c)}>Remove</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 13 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={c.can_edit_milestones} onChange={() => togglePerm(c, "milestones")} /> Edit timeline</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={c.can_upload_docs} onChange={() => togglePerm(c, "docs")} /> Upload docs</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={c.can_send_reminders} onChange={() => togglePerm(c, "reminders")} /> Send updates</label>
          </div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <span style={{ color: L.muted }}>Emails sent as:</span>{" "}
            <select value={c.email_identity} onChange={e => setVoice(c, e.target.value)} style={{ fontSize: 14, padding: "4px 6px", borderRadius: 8, border: `1px solid ${L.line}` }}>
              <option value="agent">You (agent's voice)</option>
              <option value="cobrand">Co-branded (you + coordinator)</option>
            </select>
          </div>
        </div>
      ))}

      {showForm && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${L.line}`, paddingTop: 12 }}>
          <div style={{ fontSize: 13, color: L.muted, marginBottom: 10 }}>They get one portal with all the deals you (and other agents) invite them to. Free while you're on a paid plan.</div>
          <input placeholder="Coordinator email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...input, marginBottom: 8 }} />
          <input placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} style={{ ...input, marginBottom: 8 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, marginBottom: 8 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={perm.milestones} onChange={e => setPerm({ ...perm, milestones: e.target.checked })} /> Edit timeline</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={perm.docs} onChange={e => setPerm({ ...perm, docs: e.target.checked })} /> Upload docs</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={perm.reminders} onChange={e => setPerm({ ...perm, reminders: e.target.checked })} /> Send updates</label>
          </div>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            <span style={{ color: L.muted }}>Emails sent as:</span>{" "}
            <select value={identity} onChange={e => setIdentity(e.target.value)} style={{ fontSize: 14, padding: "4px 6px", borderRadius: 8, border: `1px solid ${L.line}` }}>
              <option value="agent">You (agent's voice)</option>
              <option value="cobrand">Co-branded (you + coordinator)</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn(true)} disabled={busy || !email.trim()} onClick={invite}>{busy ? "Inviting…" : "Send invite"}</button>
            <button style={btn(false)} onClick={() => { setShowForm(false); setMsg(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 14, color: msg.startsWith("✅") ? "#1e8449" : L.red }}>{msg}</div>}
    </div>
  );
}
