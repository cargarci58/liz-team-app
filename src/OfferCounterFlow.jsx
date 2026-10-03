// Counter-offers on a listing — the step tracker, the counter screen, the
// "what came back" review and the seller-signs-last launcher. Lives inside the
// listing's 📥 Pending Offers panel (ListingOffers in App.jsx).
//
// The rules this screen teaches (Carlos 10/1):
//   • The LISTING AGENT counters and sends it — no seller approval step.
//   • The buyer's side strikes & initials the changes, or resubmits.
//   • What comes back is checked against the counter; anything that changed
//     and was NOT in the counter is flagged and locks the seller's signature.
//   • The SELLER ALWAYS SIGNS LAST.
import { t as tr, tn, locale as uiLocale } from "./i18n";
import { useEffect, useState, lazy, Suspense } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";
const C = {
  red: "#C0392B", darkRed: "#922B21", bg: "#F4F4F4", border: "#DDDDDD", text: "#111111", muted: "#666666",
  blue: "#0c4a6e", blueBg: "#f0f9ff", green: "#1E8449", greenBg: "#EAF7EE", amber: "#B7770D", amberBg: "#FEF9E7",
};
const hdrs = () => ({ Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") });
const jsonHdrs = () => ({ ...hdrs(), "Content-Type": "application/json" });
const btn = (primary, color = C.blue) => ({  // blue = normal action; pass C.red only for destructive
  background: primary ? color : "#fff", color: primary ? "#fff" : color, border: `1px solid ${color}`,
  borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
});
const fmtWhen = (d) => d ? new Date(d).toLocaleString(uiLocale(), { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "";
const DocSignModal = lazy(() => import("./DocumentsTab").then(m => ({ default: m.DocSignModal })));

export const STEPS = ["Received", "Countered", "Waiting on buyer's agent", "Check what came back", "Seller signs", "Under Contract"];

// Short "how this works" text per step (shown under the step on demand).
const HOW = {
  0: "Read the offer's terms. If your seller wants changes, tap Counter — you change the terms right on the screen and the app writes the counter to the buyer's agent. If it's good as-is, send it to your seller to sign (the seller signs last).",
  1: "You change the terms, then review the email to the buyer's agent and send it. No seller approval or signature is needed at this step — the seller signs last, after the buyer accepts.",
  2: "The buyer's agent either strikes and initials your changes or resubmits the offer with the new terms. When they reply, the revised offer lands here by itself. If it went to your own inbox instead, upload it or pick it from Documents.",
  3: "The app compares what came back to the original offer plus ONLY your changes. Anything else that changed is flagged red, and your seller can't be sent the offer to sign until you accept each one or counter again. Spots it couldn't read are yellow — check them by eye.",
  4: "The seller always signs last. The app places the seller's initials and signature for you — you check them before the link goes out. The signed copy files itself in Documents.",
  5: "Accept moves the listing Under Contract with the final terms, builds the timeline, and lets you preview the welcome emails before anything is sent.",
};

// What step an offer is on + the one line of "what's next".
export function offerState(offer, counters) {
  const mine = counters.filter(c => c.uploadId === offer.id || c.responseUploadId === offer.id);
  const live = mine.filter(c => !["withdrawn"].includes(c.status)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  const reading = ["pending", "extracting"].includes(offer.status);
  if (reading) return { step: 0, tone: "info", line: "Reading the offer… this takes about a minute.", counter: live };
  if (live && live.uploadId === offer.id && live.responseUploadId !== offer.id) {
    if (live.status === "draft" || live.status === "awaiting_seller") return { step: 1, tone: "info", line: "Your counter is saved but not sent yet. Review the email to the buyer's agent and send it.", counter: live };
    if (live.status === "sent") return { step: 2, tone: "wait", line: `Sent to ${live.toName || live.toEmail || "the buyer's agent"} ${fmtWhen(live.sentAt)}. Expires ${fmtWhen(live.expiresAt)}. When the initialed or revised offer comes back, it shows up here by itself.`, counter: live };
    if (live.status === "expired") return { step: 2, tone: "bad", line: `Your counter expired ${fmtWhen(live.expiresAt)} with no answer. Follow up, counter again, or reject the offer.`, counter: live };
    if (live.status === "superseded") return { step: 0, tone: "info", line: "Read the terms. Counter, send it to your seller to sign as-is, or reject.", counter: null };
  }
  if (live && live.responseUploadId === offer.id) {
    if (live.checkStatus !== "done" || ["response_received"].includes(live.status)) return { step: 3, tone: "info", line: "The buyer's side replied. Checking what came back against your counter…", counter: live };
    if (live.status === "checked") {
      const open = live.openItems || 0;
      return open
        ? { step: 3, tone: "bad", line: `${open} thing${open > 1 ? "s" : ""} to review — changes that weren't in your counter, missing initials, or spots to check by eye. Your seller can't sign until each one is cleared.`, counter: live }
        : { step: 4, tone: "good", line: "Everything matches your counter. Send it to your seller to sign — the seller signs last.", counter: live };
    }
    if (live.status === "seller_signing") return { step: 4, tone: "wait", line: `Sent to your seller to sign ${fmtWhen(live.sellerSignSentAt)}. You'll get a pop-up and an email the moment they sign.`, counter: live };
    if (live.status === "seller_signed") return { step: 5, tone: "good", line: "Your seller signed (last). Accept it to go Under Contract with the final terms.", counter: live };
  }
  if (offer.has_signed_copy || offer.hasSignedCopy) return { step: 5, tone: "good", line: "The seller's signed copy is on file. Accept it to go Under Contract.", counter: null };
  if (offer.seller_signing_doc_id) return { step: 4, tone: "wait", line: "Sent to your seller to sign as-is. You'll get a pop-up and an email the moment they sign.", counter: null };
  return { step: 0, tone: "info", line: "Read the terms. Counter, send it to your seller to sign as-is, or reject.", counter: null };
}

export function StepTracker({ step, tone }) {
  const color = tone === "bad" ? C.red : tone === "good" ? C.green : C.blue;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", margin: "8px 0 6px" }}>
      {STEPS.map((s, i) => {
        const done = i < step, cur = i === step;
        return (
          <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              fontSize: 11, fontWeight: cur ? 800 : 600, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap",
              background: cur ? color : done ? C.greenBg : C.bg, color: cur ? "#fff" : done ? C.green : C.muted,
              border: `1px solid ${cur ? color : done ? "#B7E1C1" : C.border}`,
            }}>{done ? "✓ " : `${i + 1} `}{s}</span>
            {i < STEPS.length - 1 && <span style={{ color: "#666666", fontSize: 11 }}>→</span>}
          </span>
        );
      })}
    </div>
  );
}

export function NextLine({ state }) {
  const [how, setHow] = useState(false);
  const bg = state.tone === "bad" ? "#FDEDEC" : state.tone === "good" ? C.greenBg : state.tone === "wait" ? C.amberBg : C.blueBg;
  const fg = state.tone === "bad" ? C.darkRed : state.tone === "good" ? C.green : state.tone === "wait" ? "#7A5C00" : C.blue;
  return (
    <div style={{ background: bg, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: fg, lineHeight: 1.45 }}>
      <strong>{tr("What's next:")} </strong>{state.line}{" "}
      <button onClick={() => setHow(h => !h)} style={{ background: "none", border: "none", color: C.blue, textDecoration: "underline", cursor: "pointer", fontSize: 12, padding: 0, fontFamily: "inherit" }}>{how ? tr("Hide") : tr("How this works")}</button>
      {how && <div style={{ marginTop: 6, color: "#333", fontSize: 12.5 }}>{HOW[state.step]}</div>}
    </div>
  );
}

// Thread history: Offer → Counter 1 → Revised → Counter 2 → …
export function ThreadLine({ offer, counters }) {
  const root = offer.thread_root_id || offer.threadRootId || offer.id;
  const thread = counters.filter(c => c.threadRootId === root).sort((a, b) => a.round - b.round);
  if (!thread.length) return null;
  const parts = [];
  for (const c of thread) {
    if (c.sentAt) parts.push(`Counter ${c.round} sent ${new Date(c.sentAt).toLocaleDateString()}`);
    else if (["draft", "awaiting_seller"].includes(c.status)) parts.push(`Counter ${c.round} (not sent)`);
    if (c.responseLinkedAt) parts.push(`Revised offer ${new Date(c.responseLinkedAt).toLocaleDateString()}`);
    if (c.sellerSignedAt) parts.push(`Seller signed ${new Date(c.sellerSignedAt).toLocaleDateString()}`);
    if (c.status === "expired") parts.push(`Counter ${c.round} expired`);
  }
  return <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{tr("🧵 Offer received ·")} {parts.join(" · ")}</div>;
}

// ── COUNTER SCREEN ───────────────────────────────────────────────────────────
export function CounterModal({ uploadId, address, onClose, onDone }) {
  const [data, setData] = useState(null);
  const [vals, setVals] = useState({});
  const [exp, setExp] = useState(() => {
    const d = new Date(Date.now() + 86400000); d.setHours(17, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T17:00`;
  });
  const [stage, setStage] = useState("terms");     // terms | email
  const [counter, setCounter] = useState(null);
  const [mail, setMail] = useState({ to: "", toName: "", subject: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/contracts/uploads/${uploadId}/counter-terms`, { headers: hdrs() })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!ok) throw new Error(b.error || "Couldn't load the offer's terms");
        setData(b);
        const v = {};
        for (const t of b.terms) v[t.key] = b.draft && b.draft.termsAfter && t.key in b.draft.termsAfter ? b.draft.termsAfter[t.key] : t.value;
        setVals(v);
        if (b.draft) {
          if (b.draft.expiresAt) { const d = new Date(b.draft.expiresAt); const pad = (n) => String(n).padStart(2, "0"); setExp(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`); }
        }
      })
      .catch(e => setErr(e.message));
  }, [uploadId]);

  const norm = (t, v) => {
    if (v === null || v === undefined || String(v).trim() === "") return "";
    if (["money", "percent", "days"].includes(t.type)) { const n = Number(String(v).replace(/[$,%\s]/g, "")); return isNaN(n) ? String(v).trim() : String(n); }
    if (t.type === "bool") return /^(true|yes|1)$/i.test(String(v)) ? "true" : /^(false|no|0)$/i.test(String(v)) ? "false" : String(v);
    if (t.type === "date") return String(v).slice(0, 10);
    return String(v).trim().replace(/\s+/g, " ");
  };
  const changed = (t) => norm(t, vals[t.key]) !== norm(t, t.value);
  const changedList = data ? data.terms.filter(changed) : [];

  const save = async () => {
    setErr("");
    if (!changedList.length) { setErr("Change at least one term — that's what the counter sends."); return; }
    setBusy(true);
    try {
      const terms = {}; for (const t of changedList) terms[t.key] = vals[t.key];
      const r = await fetch(`${API}/contracts/uploads/${uploadId}/counters`, {
        method: "POST", headers: jsonHdrs(), body: JSON.stringify({ terms, expiresAt: new Date(exp).toISOString() }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't save the counter");
      setCounter(b.counter);
      setMail({ to: b.counter.toEmail || data.buyerAgent.email || "", toName: b.counter.toName || data.buyerAgent.name || "", subject: b.counter.emailSubject || "", body: b.counter.emailBody || "" });
      setStage("email");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const send = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await fetch(`${API}/offer-counters/${counter.id}/send`, { method: "POST", headers: jsonHdrs(), body: JSON.stringify(mail) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't send the counter");
      onDone && onDone(b.counter);
      onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const groups = data ? [...new Set(data.terms.map(t => t.group))] : [];
  const input = (t) => {
    const v = vals[t.key];
    const style = { width: "100%", padding: "8px 10px", border: `1px solid ${changed(t) ? C.red : C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: changed(t) ? "#FFF7F6" : "#fff", boxSizing: "border-box" };
    const set = (x) => setVals(s => ({ ...s, [t.key]: x }));
    if (t.type === "bool") return (
      <select value={v === true || /^(true|yes)$/i.test(String(v)) ? "true" : v === false || /^(false|no)$/i.test(String(v)) ? "false" : ""} onChange={e => set(e.target.value === "" ? null : e.target.value === "true")} style={style}>
        <option value="">—</option><option value="true">{tr("Yes")}</option><option value="false">{tr("No")}</option>
      </select>);
    if (t.type === "date") return <input type="date" value={v ? String(v).slice(0, 10) : ""} onChange={e => set(e.target.value || null)} style={style} />;
    if (t.type === "longtext") return <textarea rows={3} value={v || ""} onChange={e => set(e.target.value)} style={{ ...style, resize: "vertical" }} />;
    return <input value={v === null || v === undefined ? "" : String(v)} onChange={e => set(e.target.value)} placeholder={t.type === "money" ? "$" : t.type === "days" ? tr("days") : ""} inputMode={["money", "percent", "days"].includes(t.type) ? "decimal" : undefined} style={style} />;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 760, margin: "auto", boxShadow: "0 12px 50px rgba(0,0,0,0.25)", overflow: "hidden", fontFamily: "inherit" }}>
        <div style={{ background: "#111", color: "#fff", padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{tr("🔁 Counter this offer")}{data ? tr(" — round {n}", { n: data.round }) : ""}</div>
            <div style={{ fontSize: 12.5, opacity: 0.85 }}>{address}{data && data.buyers.length ? tr(" · from {v1}", { v1: data.buyers.join(" & ") }) : ""}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          {err && <div style={{ background: "#FDEDEC", border: "1px solid #F5B7B1", color: C.darkRed, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>⚠️ {tr(err)}</div>}
          {!data && !err && <div style={{ color: C.muted }}>{tr("Loading the offer's terms…")}</div>}

          {data && stage === "terms" && (
            <>
              <div style={{ background: C.blueBg, border: "1px solid #bae6fd", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.blue, lineHeight: 1.5, marginBottom: 14 }}>
                <strong>{tr("Step 1 of 2 — change the terms your seller wants.")}</strong> {tr("Every term the app read from the offer is below. Edit only what changes — changed terms turn red. Everything else stays exactly as the buyer wrote it.")}
              </div>
              {groups.map(g => (
                <div key={g} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{g}</div>
                  {data.terms.filter(t => t.group === g).map(t => (
                    <div key={t.key} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr) minmax(0, 1.2fr)", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F0F0F0" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{tr(t.label)}</div>
                      <div style={{ fontSize: 12.5, color: C.muted }} title={tr("What the buyer offered")}>{t.display === "—" ? <em>{tr("not in the offer")}</em> : t.display}</div>
                      <div>{input(t)}</div>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14, marginTop: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{tr("Counter expires")}</div>
                  <input type="datetime-local" value={exp} onChange={e => setExp(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{tr("You get a reminder a day before it lapses.")}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{tr("Who signs when")}</div>
                  <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{tr("You send the counter. The buyer initials your changes (or resubmits). Your seller signs last — after the buyer accepts.")}</div>
                </div>
              </div>
              {changedList.length > 0 && (
                <div style={{ marginTop: 14, background: C.bg, borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
                  <strong>{tr("Your counter changes")} {changedList.length} {tr("term")}{changedList.length > 1 ? "s" : ""}:</strong>
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{changedList.map(t => <li key={t.key}>{tr(t.label)}</li>)}</ul>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button onClick={onClose} style={btn(false, "#555")}>{tr("Cancel")}</button>
                <button onClick={save} disabled={busy} style={btn(true)}>{busy ? tr("Saving…") : tr("Next: review the email →")}</button>
              </div>
            </>
          )}

          {data && stage === "email" && counter && (
            <>
              <div style={{ background: C.blueBg, border: "1px solid #bae6fd", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.blue, lineHeight: 1.5, marginBottom: 14 }}>
                <strong>{tr("Step 2 of 2 — review the email to the buyer's agent.")}</strong> {tr("Edit anything you like. It asks them to strike and initial your changes or resubmit, and their reply comes back to this deal automatically. Nothing is sent until you press Send.")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10, marginBottom: 10 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700 }}>{tr("To (name)")}<input value={mail.toName} onChange={e => setMail(m => ({ ...m, toName: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginTop: 4, boxSizing: "border-box", fontFamily: "inherit" }} /></label>
                <label style={{ fontSize: 12.5, fontWeight: 700 }}>{tr("To (email)")}<input value={mail.to} onChange={e => setMail(m => ({ ...m, to: e.target.value }))} placeholder={tr("buyer's agent email")} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginTop: 4, boxSizing: "border-box", fontFamily: "inherit" }} /></label>
              </div>
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>{tr("Subject")}<input value={mail.subject} onChange={e => setMail(m => ({ ...m, subject: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginTop: 4, marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" }} /></label>
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>{tr("Message")}<textarea rows={14} value={mail.body} onChange={e => setMail(m => ({ ...m, body: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginTop: 4, boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }} /></label>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <button onClick={() => setStage("terms")} style={btn(false, "#555")}>{tr("← Back to the terms")}</button>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { onDone && onDone(counter); onClose(); }} style={btn(false, C.blue)}>{tr("Save, send later")}</button>
                  <button onClick={send} disabled={busy} style={btn(true)}>{busy ? tr("Sending…") : tr("Send counter to the buyer's agent")}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── WHAT CAME BACK ───────────────────────────────────────────────────────────
export function ReturnedOfferReview({ counter, onClose, onChanged, onCounterAgain, onSendToSeller }) {
  const [c, setC] = useState(counter);
  const [busy, setBusy] = useState("");
  const items = (c.check && c.check.items) || [];
  const res = c.resolutions || {};
  const reds = items.filter(i => i.severity === "red"), yellows = items.filter(i => i.severity === "yellow"), greens = items.filter(i => i.severity === "green");
  const open = items.filter(i => i.severity !== "green" && !res[i.id]).length;

  const resolve = async (it, action) => {
    setBusy(it.id);
    try {
      const r = await fetch(`${API}/offer-counters/${c.id}/resolve`, { method: "POST", headers: jsonHdrs(), body: JSON.stringify({ itemId: it.id, action }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't save");
      setC(b.counter); onChanged && onChanged(b.counter);
    } catch (e) { alert(e.message); } finally { setBusy(""); }
  };
  const openFile = async (which) => {
    try {
      const r = await fetch(`${API}/offer-counters/${c.id}/file/${which}`, { headers: hdrs() });
      const b = await r.json();
      if (b.url) window.open(b.url, "_blank"); else throw new Error(b.error || "Couldn't open it");
    } catch (e) { alert(e.message); }
  };
  const recheck = async () => {
    setBusy("recheck");
    try {
      const r = await fetch(`${API}/offer-counters/${c.id}/recheck`, { method: "POST", headers: hdrs() });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't re-check");
      setC(b.counter); onChanged && onChanged(b.counter);
    } catch (e) { alert(e.message); } finally { setBusy(""); }
  };

  const Item = ({ it }) => {
    const done = res[it.id];
    const color = it.severity === "red" ? C.red : it.severity === "yellow" ? C.amber : C.green;
    return (
      <div style={{ border: `1px solid ${done ? "#B7E1C1" : color}`, background: done ? C.greenBg : "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{it.severity === "red" ? "🔴" : it.severity === "yellow" ? "⚠️" : "✓"} {tr(it.label)}</div>
            {(it.before || it.after) && <div style={{ fontSize: 12.5, color: "#333", marginTop: 3 }}><span style={{ color: C.muted }}>{tr("Before:")}</span> {it.before || "—"} &nbsp;→&nbsp; <span style={{ color: C.muted }}>{tr("Now:")}</span> <strong>{it.after || "—"}</strong></div>}
            {it.detail && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{it.detail}</div>}
            {it.page && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{tr("Page")} {it.page}</div>}
            {done && <div style={{ fontSize: 11.5, color: C.green, marginTop: 3, fontWeight: 700 }}>{done.action === "checked" ? tr("Checked") : tr("Accepted")} {tr("by")} {done.byName || tr("you")} · {new Date(done.at).toLocaleString()}</div>}
          </div>
          {it.severity !== "green" && (
            done
              ? <button onClick={() => resolve(it, "undo")} disabled={!!busy} style={btn(false, "#555")}>{tr("Undo")}</button>
              : <button onClick={() => resolve(it, it.severity === "yellow" ? "checked" : "accept")} disabled={!!busy} style={btn(true, it.severity === "yellow" ? C.amber : C.red)}>{busy === it.id ? tr("Saving…") : it.severity === "yellow" ? tr("I checked it") : tr("Accept this change")}</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 760, margin: "auto", boxShadow: "0 12px 50px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ background: "#111", color: "#fff", padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{tr("🔎 What came back — counter round")} {c.round}</div>
            <div style={{ fontSize: 12.5, opacity: 0.85 }}>{tr("Compared to the original offer plus only your changes")}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <button onClick={() => openFile("original")} style={btn(false, C.blue)}>{tr("📄 Open the original offer")}</button>
            <button onClick={() => openFile("returned")} style={btn(false, C.blue)}>{tr("📄 Open what came back")}</button>
            <button onClick={recheck} disabled={!!busy} style={btn(false, "#555")}>{busy === "recheck" ? tr("Checking…") : tr("↻ Check again")}</button>
          </div>
          {c.check && c.check.summary && <div style={{ fontSize: 13, color: "#333", marginBottom: 12 }}>{tr(c.check.summary)}</div>}
          {reds.length > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: C.red, margin: "6px 0" }}>{tr("Doesn't match your counter — accept each one, or counter again")}</div>}
          {reds.map(it => <Item key={it.id} it={it} />)}
          {yellows.length > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: C.amber, margin: "10px 0 6px" }}>{tr("Couldn't read clearly — check by eye")}</div>}
          {yellows.map(it => <Item key={it.id} it={it} />)}
          {greens.length > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: C.green, margin: "10px 0 6px" }}>{tr("As you asked")}</div>}
          {greens.map(it => <Item key={it.id} it={it} />)}
          {!items.length && <div style={{ color: C.muted }}>{tr("Nothing to report.")}</div>}
          <div style={{ marginTop: 16, background: open ? "#FDEDEC" : C.greenBg, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: open ? C.darkRed : C.green }}>
            {open ? tn(open, "🔒 {n} item still open — your seller can't be sent this offer to sign until each one is accepted or checked, or you counter again.", "🔒 {n} items still open — your seller can't be sent this offer to sign until each one is accepted or checked, or you counter again.")
                  : tr("✅ Everything is cleared. Next: send it to your seller to sign — the seller signs last.")}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={() => onCounterAgain && onCounterAgain(c)} style={btn(false)}>{tr("🔁 Counter again")}</button>
            <button onClick={() => onSendToSeller && onSendToSeller(c)} disabled={!!open} style={{ ...btn(true, C.blue), opacity: open ? 0.45 : 1 }}>{tr("✍️ Send to seller to sign")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SELLER SIGNS LAST ────────────────────────────────────────────────────────
// Loads the offer + sellers + auto-placed seller blocks and opens the e-sign
// window pre-filled for the agent to preview. `target` = {counterId} or {uploadId}.
export function SellerSigningLauncher({ target, tx, onClose, onSent }) {
  const [pkg, setPkg] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const url = target.counterId ? `${API}/offer-counters/${target.counterId}/seller-signing` : `${API}/contracts/uploads/${target.uploadId}/seller-signing`;
    fetch(url, { headers: hdrs() }).then(r => r.json().then(b => ({ ok: r.ok, b }))).then(({ ok, b }) => {
      if (!ok) throw new Error(b.error || "Couldn't prepare the signing round");
      setPkg(b);
    }).catch(e => setErr(e.message));
  }, [target.counterId, target.uploadId]);
  if (err) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 420, fontSize: 14 }} onClick={e => e.stopPropagation()}>⚠️ {tr(err)}<div style={{ textAlign: "right", marginTop: 12 }}><button onClick={onClose} style={btn(false, "#555")}>{tr("Close")}</button></div></div>
    </div>);
  if (!pkg) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, fontSize: 14 }}>{tr("Finding the seller's initial and signature spots…")}</div>
    </div>);
  const counts = pkg.placements.reduce((m, p) => ({ ...m, [p.kind]: (m[p.kind] || 0) + 1 }), {});
  const intro = (
    <>
      <strong>{tr("The seller signs last.")}</strong> {tr("The app placed")} {counts.initials || 0} {tr(counts.initials === 1 ? "initial" : "initials")}, {counts.signature || 0} {tr(counts.signature === 1 ? "signature" : "signatures")}{counts.date ? tn(counts.date, " and {n} date", " and {n} dates") : ""} {tr("for")} {pkg.signers.map(s => s.name).filter(Boolean).join(" & ") || tr("the seller")} {tr("— look them over on the pages below. Tap a block to remove it, or pick a block type and tap the page to add one.")}
      {pkg.notes && pkg.notes.length > 0 && <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{pkg.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </>
  );
  return (
    <Suspense fallback={null}>
      <DocSignModal tx={tx} doc={pkg.doc} allDocs={[]} headers={hdrs()} onClose={onClose}
        initialRows={pkg.signers.length ? pkg.signers : null} initialPlacements={pkg.placements} autoPlace intro={intro}
        onSent={async (docId) => {
          const url = target.counterId ? `${API}/offer-counters/${target.counterId}/seller-signing-sent` : `${API}/contracts/uploads/${target.uploadId}/seller-signing-sent`;
          await fetch(url, { method: "POST", headers: jsonHdrs(), body: JSON.stringify({ documentId: docId }) });
          onSent && onSent();
        }} />
    </Suspense>
  );
}

// ── "It came back to my own inbox" — pick the revised offer from Documents ────
export function PickReturnedDoc({ counter, txId, onClose, onLinked }) {
  const [docs, setDocs] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    fetch(`${API}/documents/${txId}`, { headers: hdrs() }).then(r => r.json()).then(b => {
      setDocs((b.documents || []).filter(d => /pdf$/i.test(d.mime_type || "") && !/^✍️ Signed/.test(d.name || "")));
    }).catch(() => setDocs([]));
  }, [txId]);
  const pick = async (d) => {
    setBusy(d.id);
    try {
      const r = await fetch(`${API}/offer-counters/${counter.id}/response`, { method: "POST", headers: jsonHdrs(), body: JSON.stringify({ documentId: d.id }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't use that file");
      onLinked && onLinked(); onClose();
    } catch (e) { alert(e.message); } finally { setBusy(""); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, margin: "auto", padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{tr("Which file is the revised offer?")}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>{tr("Pick the initialed or resubmitted offer the buyer's agent sent back. The app reads it and checks it against your counter.")}</div>
        {docs === null && <div style={{ color: C.muted }}>{tr("Loading…")}</div>}
        {docs && docs.length === 0 && <div style={{ color: C.muted }}>{tr("No PDFs on this deal yet — upload it with Receive Offer instead.")}</div>}
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {(docs || []).map(d => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 6 }}>
              <div style={{ minWidth: 0, fontSize: 13 }}><div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {d.name}</div><div style={{ fontSize: 11.5, color: C.muted }}>{new Date(d.created_at).toLocaleString()}</div></div>
              <button onClick={() => pick(d)} disabled={!!busy} style={btn(true, C.blue)}>{busy === d.id ? tr("Reading…") : tr("Use this")}</button>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "right", marginTop: 10 }}><button onClick={onClose} style={btn(false, "#555")}>{tr("Close")}</button></div>
      </div>
    </div>
  );
}

export function useOfferCounters(txId, refreshKey) {
  // `loaded` stays false until the first answer — until then the panel must not
  // guess an offer's step (it would show "Received" + Counter on a countered offer).
  const [state, setState] = useState({ counters: [], uploads: [], loaded: false });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/transactions/${txId}/offer-counters`, { headers: hdrs() })
      .then(r => r.ok ? r.json() : null).then(b => { if (alive) setState(s => b ? { counters: b.counters || [], uploads: b.uploads || [], loaded: true } : { ...s, loaded: true }); })
      .catch(() => { if (alive) setState(s => ({ ...s, loaded: true })); });
    return () => { alive = false; };
  }, [txId, refreshKey, tick]);
  return [state, () => setTick(t => t + 1)];
}
