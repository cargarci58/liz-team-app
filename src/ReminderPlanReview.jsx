import { t as tr, tn } from "./i18n";
import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// APPROVE-FIRST REVIEW of today's reminder outreach (TC). Lists EVERY message
// that would go out — party emails, the agent's copies, text messages — each
// with its own checkbox and a "Preview & edit" panel showing the real email.
// Only the checked messages are sent, with the TC's edits. Used by the Command
// Center banner (all deals) and the per-card "Send reminder" (txId = one deal).
export default function ReminderPlanReview({ token, txId, reloadKey, onSent, onLoaded, inModal }) {
  const [actions, setActions] = useState(null);   // null = loading
  const [held, setHeld] = useState({});           // key -> true = don't send
  const [edits, setEdits] = useState({});         // key -> { subject, text }
  const [openKey, setOpenKey] = useState(null);
  const [view, setView] = useState("email");      // "email" (as they'll see it) | "edit"
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [skipping, setSkipping] = useState(null);

  useEffect(() => {
    let dead = false;
    fetch(API + "/tc/action-plan" + (txId ? "?txId=" + encodeURIComponent(txId) : ""), { headers: { Authorization: "Bearer " + token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (dead) return; setActions((d && d.actions) || []); setHeld({}); setEdits({}); setOpenKey(null); onLoaded && onLoaded(); })
      .catch(() => { if (!dead) { setActions([]); onLoaded && onLoaded(); } });
    return () => { dead = true; };
    // eslint-disable-next-line
  }, [token, txId, reloadKey]);

  if (actions === null) return inModal ? <div style={{ padding: 12, color: "#64748B", fontSize: 14 }}>{tr("Loading what would go out…")}</div> : null;
  if (actions.length === 0) {
    if (msg) return <div style={{ marginBottom: 14, fontSize: 13, fontWeight: 700, color: msg.startsWith("✅") ? "#166534" : "#991B1B" }}>{tr(msg)}</div>;
    return inModal ? <div style={{ padding: 12, color: "#64748B", fontSize: 14 }}>{tr("Nothing is due to go out on this deal today. ✅")}</div> : null;
  }

  const checked = actions.filter(a => !held[a.key]);
  const byDeal = [];
  actions.forEach(a => {
    let g = byDeal.find(x => x.txId === a.txId);
    if (!g) { g = { txId: a.txId, address: a.address, items: [] }; byDeal.push(g); }
    g.items.push(a);
  });
  const isEdited = (a) => !!edits[a.key];
  const editVal = (a) => edits[a.key] || { subject: a.subject || "", text: a.text || "" };
  const setEdit = (a, patch) => setEdits(e => {
    const next = { ...editVal(a), ...patch };
    const copy = { ...e };
    if (next.subject === (a.subject || "") && next.text === (a.text || "")) delete copy[a.key]; else copy[a.key] = next;
    return copy;
  });

  const send = async () => {
    if (checked.length === 0) return;
    setSending(true); setMsg(null);
    try {
      const sendEdits = {};
      checked.forEach(a => { if (edits[a.key]) sendEdits[a.key] = edits[a.key]; });
      const r = await fetch(API + "/tc/action-plan/execute", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ keys: checked.map(a => a.key), edits: sendEdits }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Failed");
      const who = (d.sent || []).map(x => `${x.channel === "sms" ? "text" : "email"} to ${x.to}${x.role && !x.isAgent ? ` (${x.role})` : ""}`);
      setMsg(who.length ? tr("✅ Sent: {v1}.", { v1: who.join(", ") }) : "✅ Done — nothing needed sending.");
      // Sent ones leave the list; anything held stays, still reviewable.
      setActions(list => list.filter(x => held[x.key]));
      onSent && onSent(d);
    } catch (e) { setMsg("⚠️ " + e.message); }
    setSending(false);
  };

  // "Don't send" — drop it from today's plan for good (nothing is sent).
  const skip = async (a) => {
    setSkipping(a.key); setMsg(null);
    try {
      const r = await fetch(API + "/tc/action-plan/skip", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ keys: [a.key] }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't skip it");
      setActions(list => list.filter(x => x.key !== a.key));
      if (openKey === a.key) setOpenKey(null);
      setMsg(`✅ Won't send: ${a.summary.replace(/^(Email|Text) /, "")}${a.role && !a.isAgent ? ` (${a.role})` : ""}. Nothing went out.`);
    } catch (e) { setMsg("⚠️ " + e.message); }
    setSkipping(null);
  };

  const icon = (a) => a.channel === "sms" ? "💬" : a.isAgent ? "📋" : "📧";
  const box = inModal ? {} : { background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: 16, marginBottom: 16 };
  const linkBtn = { background: "none", border: "1px solid #93C5FD", color: "#1E40AF", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
  const tab = (on) => ({ ...linkBtn, background: on ? "#1E40AF" : "#fff", color: on ? "#fff" : "#1E40AF" });

  return (
    <div style={box}>
      {!inModal && <div style={{ fontSize: 15, fontWeight: 800, color: "#1E3A8A", marginBottom: 4 }}>{tr("🤖 Here's what I'll send today")}</div>}
      <div style={{ fontSize: 12.5, color: "#1E40AF", marginBottom: 12 }}>
        {tr("Tap")} <b>{tr("👀 Preview & edit")}</b> {tr("to read or change any message.")} <b>{tr("⏸ Not now")}</b> {tr("holds it for later;")} <b>{tr("🚫 Don't send")}</b> {tr("removes it for today. Only messages still checked go out.")}
      </div>
      {byDeal.map(g => (
        <div key={g.txId} style={{ padding: "8px 0", borderTop: "1px solid #DBEAFE" }}>
          {!txId && <div style={{ fontWeight: 700, fontSize: 14, color: "#1a2332", marginBottom: 4 }}>{g.address}</div>}
          {g.items.map(a => {
            const open = openKey === a.key;
            const ev = editVal(a);
            return (
              <div key={a.key} style={{ padding: "6px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={!held[a.key]} onChange={e => setHeld(h => ({ ...h, [a.key]: !e.target.checked }))}
                    style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: held[a.key] ? "#94A3B8" : "#1a2332", fontWeight: 600, textDecoration: held[a.key] ? "line-through" : "none" }}>
                      {icon(a)} {tr(a.summary)}{a.role && !a.isAgent ? ` · ${a.role}` : ""}
                      {isEdited(a) && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: "#0c4a6e", background: "#E0F2FE", borderRadius: 6, padding: "1px 6px" }}>{tr("✏️ edited")}</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#475569", marginTop: 2 }}>
                      {a.channel === "email" ? <>{tr("Subject: “")}{ev.subject}” · {a.detail}</> : a.detail}
                    </div>
                    {a.channel !== "sms" && a.fromName && (
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{tr("From:")} {a.fromName}{a.ccAgent ? tr(" · agent CC'd") : ""}</div>
                    )}
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <button onClick={() => { setOpenKey(open ? null : a.key); setView("email"); }} style={linkBtn}>
                        {open ? tr("Close preview") : tr("👀 Preview & edit")}
                      </button>
                      <button onClick={() => setHeld(h => ({ ...h, [a.key]: !h[a.key] }))} style={linkBtn}>
                        {held[a.key] ? tr("↩ Include again") : tr("⏸ Not now")}
                      </button>
                      <button disabled={skipping === a.key} onClick={() => skip(a)}
                        style={{ ...linkBtn, borderColor: "#E6B0AA", color: "#922B21" }}>
                        {skipping === a.key ? "…" : tr("🚫 Don't send")}
                      </button>
                    </div>
                    {held[a.key] && <div style={{ fontSize: 11.5, color: "#922B21", marginTop: 4 }}>{tr("On hold — won't go out now. It'll be here again next time you open this.")}</div>}
                  </div>
                </div>
                {open && (
                  <div style={{ margin: "8px 0 4px 28px", background: "#fff", border: "1px solid #BFDBFE", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6, marginBottom: 8 }}>
                      <div><b>{tr("To:")}</b> {a.to}{a.channel === "sms" ? ` · ${a.phone}` : a.toEmail ? ` <${a.toEmail}>` : ""}</div>
                      {a.fromName && <div><b>{tr("From:")}</b> {a.fromName}{a.fromEmail ? ` <${a.fromEmail}>` : ""} {tr("— replies come to")} {a.ccAgent ? tr("you") : tr("the agent")}</div>}
                      {a.ccAgent && <div><b>{tr("CC:")}</b> {a.ccAgent} {tr("(the agent)")}</div>}
                    </div>
                    {a.channel === "sms" ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 4 }}>{tr("Text message")}</div>
                        <div style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "#F4F4F4", borderRadius: 8, padding: 10 }}>{a.text}</div>
                        <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 6 }}>{tr("Texts are a fixed alert and can't be reworded — uncheck it to hold it.")}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                          <button onClick={() => setView("email")} style={tab(view === "email")}>{tr("As they'll see it")}</button>
                          <button onClick={() => setView("edit")} style={tab(view === "edit")}>{tr("✏️ Edit wording")}</button>
                          {isEdited(a) && <button onClick={() => setEdits(e => { const c = { ...e }; delete c[a.key]; return c; })} style={linkBtn}>{tr("↺ Undo my edits")}</button>}
                        </div>
                        {view === "email" ? (
                          isEdited(a) ? (
                            <div>
                              <div style={{ fontSize: 12, color: "#0c4a6e", marginBottom: 6 }}>{tr("Your edited version will be sent (with")} {a.fromName ? `${a.fromName}'s` : tr("your")} {tr("signature):")}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{ev.subject}</div>
                              <div style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "#F4F4F4", borderRadius: 8, padding: 10 }}>{ev.text}</div>
                            </div>
                          ) : (
                            <iframe title={tr("Email preview")} sandbox="" srcDoc={a.html || ""}
                              style={{ width: "100%", height: 420, border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }} />
                          )
                        ) : (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>{tr("Subject")}</label>
                            <input value={ev.subject} onChange={e => setEdit(a, { subject: e.target.value })}
                              style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, fontFamily: "inherit", margin: "4px 0 10px", boxSizing: "border-box" }} />
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>{tr("Message")}</label>
                            <textarea value={ev.text} onChange={e => setEdit(a, { text: e.target.value })} rows={12}
                              style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, fontFamily: "inherit", marginTop: 4, resize: "vertical", boxSizing: "border-box" }} />
                            <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>{tr("Your signature is added automatically. Keep the “Mark it done” link so they can confirm in one tap.")}</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={send} disabled={sending || checked.length === 0}
          style={{ background: sending || checked.length === 0 ? "#93C5FD" : "#0c4a6e", color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 15, fontWeight: 800, cursor: sending ? "wait" : "pointer", fontFamily: "inherit" }}>
          {sending ? tr("Sending…") : tn(checked.length, "✅ Send {n} checked message", "✅ Send {n} checked messages")}
        </button>
        <span style={{ fontSize: 12, color: "#1E40AF" }}>{tr("Nothing goes out until you approve.")}</span>
      </div>
      {msg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: msg.startsWith("✅") ? "#166534" : "#991B1B" }}>{tr(msg)}</div>}
    </div>
  );
}
