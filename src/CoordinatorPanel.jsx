import { useState, useEffect, useCallback } from "react";

// Agent-side card (Parties tab): invite a transaction coordinator to THIS deal —
// or reuse a saved one, drop them onto several of your deals at once, and set a
// default coordinator that's auto-added to every new deal you create. Each deal
// still gets its own assignment row underneath (per-deal permissions/voice).

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

const L = { line: "#e7e2df", red: "#C0392B", muted: "#7a716c", soft: "#FADBD8", green: "#1e8449" };
const wrap = { border: `1px solid ${L.line}`, borderRadius: 14, padding: 16, marginBottom: 16, background: "#fff" };
const input = { fontSize: 16, padding: "10px 12px", borderRadius: 10, border: `1px solid ${L.line}`, width: "100%", boxSizing: "border-box" };
const btn = (p) => ({ fontSize: 14, fontWeight: 700, padding: "9px 14px", borderRadius: 10, cursor: "pointer", border: p ? "none" : `1px solid ${L.line}`, background: p ? L.red : "#fff", color: p ? "#fff" : "#111" });
const chk = { display: "flex", gap: 6, alignItems: "center" };

export default function CoordinatorPanel({ txId }) {
  const [coords, setCoords] = useState(null);
  const [saved, setSaved] = useState([]);
  const [def, setDef] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [identity, setIdentity] = useState("agent");
  const [perm, setPerm] = useState({ milestones: true, docs: true, reminders: true });
  const [assignable, setAssignable] = useState([]);
  const [picked, setPicked] = useState(() => new Set([txId]));
  const [makeDefault, setMakeDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dir, setDir] = useState(null);       // directory of opt-in coordinators
  const [showDir, setShowDir] = useState(false);
  const money = (n) => n == null ? null : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const openDirectory = async () => {
    setShowDir(s => !s);
    if (dir === null) { try { const d = await api("/coordinators/directory"); setDir(d.coordinators || []); } catch { setDir([]); } }
  };

  const load = useCallback(async () => {
    try { const d = await api(`/transactions/${txId}/coordinator`); setCoords(d.coordinators || []); }
    catch { setCoords([]); }
  }, [txId]);
  const loadMeta = useCallback(async () => {
    try { const s = await api("/coordinators/saved"); setSaved(s.coordinators || []); } catch { setSaved([]); }
    try { const d = await api("/me/default-coordinator"); setDef(d.email ? d : null); } catch { setDef(null); }
  }, []);
  useEffect(() => { load(); loadMeta(); }, [load, loadMeta]);

  const refetchAssignable = useCallback(async (em) => {
    try {
      const d = await api(`/coordinators/assignable${em ? `?email=${encodeURIComponent(em)}` : ""}`);
      setAssignable(d.transactions || []);
    } catch { setAssignable([]); }
  }, []);

  const openForm = () => {
    setShowForm(true); setMsg(""); setPicked(new Set([txId]));
    refetchAssignable("");
  };
  const pickSaved = (em) => {
    const s = saved.find(x => x.coordinator_email === em);
    if (!s) { setEmail(""); return; }
    setEmail(s.coordinator_email);
    setName(s.coordinator_name || "");
    setIdentity(s.email_identity || "agent");
    setPerm({ milestones: s.can_edit_milestones, docs: s.can_upload_docs, reminders: s.can_send_reminders });
    refetchAssignable(s.coordinator_email);
  };
  const toggleDeal = (id) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); n.add(txId); return n; });

  const submit = async () => {
    setBusy(true); setMsg("");
    try {
      const ids = Array.from(new Set([txId, ...picked]));
      const d = await api("/coordinators/bulk-assign", {
        method: "POST",
        body: JSON.stringify({ email, name, emailIdentity: identity, permissions: perm, transactionIds: ids }),
      });
      if (makeDefault) {
        await api("/me/default-coordinator", { method: "PUT", body: JSON.stringify({ email, name, emailIdentity: identity, permissions: perm }) });
      }
      setMsg(`✅ Added to ${d.assigned} deal${d.assigned === 1 ? "" : "s"} — they'll get a portal link by email.`);
      setEmail(""); setName(""); setMakeDefault(false); setShowForm(false);
      await load(); await loadMeta();
    } catch (e) { setMsg("⚠️ " + e.message); }
    setBusy(false);
  };

  const permKey = (k) => k === "milestones" ? "can_edit_milestones" : k === "docs" ? "can_upload_docs" : "can_send_reminders";
  const togglePerm = async (c, key) => {
    try { await api(`/transactions/${txId}/coordinator/${c.id}`, { method: "PATCH", body: JSON.stringify({ permissions: { [key]: !c[permKey(key)] } }) }); await load(); }
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
  const clearDefault = async () => {
    if (!confirm("Stop auto-adding this coordinator to new deals?")) return;
    try { await api("/me/default-coordinator", { method: "PUT", body: JSON.stringify({ clear: true }) }); await loadMeta(); }
    catch (e) { alert("⚠️ " + e.message); }
  };

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: coords && coords.length ? 12 : 0 }}>
        <div style={{ fontWeight: 800 }}>🤝 Transaction Coordinator</div>
        {!showForm && <button style={btn(true)} onClick={openForm}>+ Add coordinator</button>}
      </div>

      {def && !showForm && (
        <div style={{ fontSize: 12, color: L.muted, marginBottom: 10 }}>
          ⭐ Auto-added to new deals: <strong>{def.name || def.email}</strong> · <span style={{ color: L.red, cursor: "pointer" }} onClick={clearDefault}>turn off</span>
        </div>
      )}

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
            <label style={chk}><input type="checkbox" checked={c.can_edit_milestones} onChange={() => togglePerm(c, "milestones")} /> Edit timeline</label>
            <label style={chk}><input type="checkbox" checked={c.can_upload_docs} onChange={() => togglePerm(c, "docs")} /> Upload docs</label>
            <label style={chk}><input type="checkbox" checked={c.can_send_reminders} onChange={() => togglePerm(c, "reminders")} /> Send updates</label>
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

          {saved.length > 0 && (
            <select onChange={e => pickSaved(e.target.value)} value={email} style={{ ...input, marginBottom: 8 }}>
              <option value="">— Reuse a saved coordinator —</option>
              {saved.map(s => <option key={s.coordinator_email} value={s.coordinator_email}>{s.coordinator_name || s.coordinator_email}</option>)}
            </select>
          )}

          <button type="button" onClick={openDirectory} style={{ background: "#fff", border: `1px solid ${L.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 8, fontFamily: "inherit" }}>
            {showDir ? "▾ Hide coordinator directory" : "🔎 Browse available coordinators"}
          </button>
          {showDir && (
            <div style={{ border: `1px solid ${L.line}`, borderRadius: 8, padding: 8, marginBottom: 10, maxHeight: 260, overflowY: "auto" }}>
              {dir === null && <div style={{ fontSize: 13, color: L.muted, padding: 6 }}>Loading…</div>}
              {dir && dir.length === 0 && <div style={{ fontSize: 13, color: L.muted, padding: 6 }}>No coordinators are listed for hire yet.</div>}
              {dir && dir.map(c => {
                const nm = `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email;
                const picked = email === c.email;
                return (
                  <div key={c.id} onClick={() => { setEmail(c.email); setName(nm); refetchAssignable(c.email); }}
                    style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", border: `1px solid ${picked ? "#C0392B" : "transparent"}`, background: picked ? "#FDEDEC" : "transparent" }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{nm}{c.tc_service_area ? <span style={{ fontWeight: 500, color: L.muted, fontSize: 12 }}> · {c.tc_service_area}</span> : null}</div>
                    <div style={{ fontSize: 12, color: L.muted, display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                      {c.tc_fee_listing != null && <span>Listing {money(c.tc_fee_listing)}</span>}
                      {c.tc_fee_seller != null && <span>Seller {money(c.tc_fee_seller)}</span>}
                      {c.tc_fee_buyer != null && <span>Buyer {money(c.tc_fee_buyer)}</span>}
                    </div>
                    {c.tc_bio && <div style={{ fontSize: 12, color: L.muted, marginTop: 3 }}>{c.tc_bio}</div>}
                  </div>
                );
              })}
            </div>
          )}

          <input placeholder="Coordinator email" value={email} onChange={e => setEmail(e.target.value)} onBlur={e => refetchAssignable(e.target.value)} style={{ ...input, marginBottom: 8 }} />
          <input placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} style={{ ...input, marginBottom: 8 }} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, marginBottom: 8 }}>
            <label style={chk}><input type="checkbox" checked={perm.milestones} onChange={e => setPerm({ ...perm, milestones: e.target.checked })} /> Edit timeline</label>
            <label style={chk}><input type="checkbox" checked={perm.docs} onChange={e => setPerm({ ...perm, docs: e.target.checked })} /> Upload docs</label>
            <label style={chk}><input type="checkbox" checked={perm.reminders} onChange={e => setPerm({ ...perm, reminders: e.target.checked })} /> Send updates</label>
          </div>

          <div style={{ fontSize: 13, marginBottom: 10 }}>
            <span style={{ color: L.muted }}>Emails sent as:</span>{" "}
            <select value={identity} onChange={e => setIdentity(e.target.value)} style={{ fontSize: 14, padding: "4px 6px", borderRadius: 8, border: `1px solid ${L.line}` }}>
              <option value="agent">You (agent's voice)</option>
              <option value="cobrand">Co-branded (you + coordinator)</option>
            </select>
          </div>

          {assignable.length > 0 && (
            <div style={{ border: `1px solid ${L.line}`, borderRadius: 10, padding: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Add to which deals?</div>
              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                {assignable.map(t => (
                  <label key={t.id} style={{ ...chk, padding: "4px 0", fontSize: 14, justifyContent: "space-between" }}>
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="checkbox" checked={picked.has(t.id) || t.id === txId} disabled={t.id === txId} onChange={() => toggleDeal(t.id)} />
                      <span>{t.address || "—"} {t.id === txId && <em style={{ color: L.muted }}>(this deal)</em>}</span>
                    </span>
                    {t.already && t.id !== txId && <span style={{ fontSize: 11, color: L.green }}>already on</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          <label style={{ ...chk, fontSize: 14, marginBottom: 10 }}>
            <input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} /> ⭐ Also make this my default coordinator on new deals
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn(true)} disabled={busy || !email.trim()} onClick={submit}>{busy ? "Adding…" : `Add to ${picked.size} deal${picked.size === 1 ? "" : "s"}`}</button>
            <button style={btn(false)} onClick={() => { setShowForm(false); setMsg(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 14, color: msg.startsWith("✅") ? L.green : L.red }}>{msg}</div>}
    </div>
  );
}
