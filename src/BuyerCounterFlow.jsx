// Buyer side of a counter-offer: the LISTING agent countered OUR buyer's offer.
// Lives on the buyer deal's 📝 Offers tab (OffersTab.jsx).
//
// The rules this screen teaches (Carlos 10/1):
//   • Tap "🔁 They countered" and point the app at their email / document —
//     it reads it against everything your buyer signed and lists every change.
//   • Anything changed in their document that their email doesn't mention is
//     flagged red; you tick "I see it" on each before it can be saved.
//   • Your buyer answers: accept (a revised offer with the changes filled in),
//     counter back (same, then edit), initial their marked-up copy, or say no.
//   • Nothing is sent until you press Send — the agent handles everything.
import { t as tr, tn, locale as uiLocale } from "./i18n";
import { useEffect, useState, lazy, Suspense } from "react";
import { askConfirm, askText } from "./ui/dialogs";

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
const toLocalInput = (d) => { if (!d) return ""; const x = new Date(d); if (isNaN(x)) return ""; const p = (n) => String(n).padStart(2, "0"); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`; };
const DocSignModal = lazy(() => import("./DocumentsTab").then(m => ({ default: m.DocSignModal })));

export const BUYER_STEPS = ["Offer sent", "They countered", "Your buyer's answer", "Buyer signs", "Sent back", "Seller accepts"];

export const HOW_BUYER_COUNTERS = (
  <div style={{ background: "#fff", border: "1px solid " + C.border, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: C.text, lineHeight: 1.55, marginTop: 8 }}>
    <strong>{tr("When the seller counters your buyer's offer")}</strong>
    <ol style={{ margin: "6px 0 0 18px", padding: 0 }}>
      <li><strong>{tr("They countered")}</strong> {tr("— tap 🔁 They countered and pick the listing agent's email (or the document, or type the changes). The app reads it against everything your buyer signed and lists every change.")}</li>
      <li><strong>{tr("Check it")}</strong> {tr("— anything changed in their document that their email doesn't mention is flagged red. Tick \"I see it\" on each one, fix anything it read wrong, and save.")}</li>
      <li><strong>{tr("Your buyer's answer")}</strong> {tr("— Accept their counter (a revised offer with their changes filled in), Counter back (same, then change what your buyer wants), Buyer initials their copy (initials placed beside each change), or Buyer says no.")}</li>
      <li><strong>{tr("Buyer signs, you send it back")}</strong> {tr("— the revised offer goes through the same steps as the first one: packet → buyer signatures → 📧 Send to listing agent.")}</li>
      <li><strong>{tr("Seller accepts")}</strong> {tr("— tap ✅ Seller accepted on the revised offer. When the executed contract comes back, upload it — the app checks it against what your buyer signed.")}</li>
    </ol>
  </div>
);

export function useTheirCounters(txId, refreshKey) {
  const [state, setState] = useState({ counters: [], loaded: false });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/transactions/${txId}/their-counters`, { headers: hdrs() })
      .then(r => r.ok ? r.json() : null)
      .then(b => { if (alive) setState(s => b ? { counters: b.counters || [], loaded: true } : { ...s, loaded: true }); })
      .catch(() => { if (alive) setState(s => ({ ...s, loaded: true })); });
    return () => { alive = false; };
  }, [txId, refreshKey, tick]);
  return [state, () => setTick(t => t + 1)];
}

// Latest counter on an offer (ignores re-read drafts, which the list never returns).
export const counterForOffer = (offer, counters) =>
  counters.filter(c => c.offerId === offer.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

// Which step the buyer's offer is on + the one line of "what's next".
export function buyerOfferState(offer, counter) {
  if (!counter) {
    if (offer.status === "sent" || offer.status === "countered") return { step: 0, tone: "wait", line: "Waiting on the seller. If the listing agent counters, tap 🔁 They countered — the app reads it and lists every change." };
    return null;
  }
  const n = (counter.changes || []).length;
  if (counter.status === "recorded") return { step: 1, tone: "bad", line: `The seller countered: ${n} change${n === 1 ? "" : "s"}${counter.deadline ? ` — answer by ${fmtWhen(counter.deadline)}` : ""}. Talk to your buyer, then pick their answer below.` };
  if (counter.status === "accepted_by_buyer" || counter.status === "countered_back") {
    const rs = counter.revisionStatus;
    if (rs === "sent") return { step: 4, tone: "wait", line: "The revised offer was sent back. Waiting on the seller — it's the newest row above." };
    if (rs === "accepted") return { step: 5, tone: "good", line: "The seller accepted the revised offer." };
    return { step: counter.revisionSigning === "out_for_signature" ? 3 : 2, tone: "info", line: counter.status === "accepted_by_buyer"
      ? "Your buyer accepts. Finish the revised offer (their changes are filled in): generate the packet → buyer signs → 📧 Send to listing agent."
      : "Your buyer counters back. Open the revised offer, change what your buyer wants, then generate the packet → buyer signs → 📧 Send to listing agent." };
  }
  if (counter.status === "initialing") return { step: 3, tone: "wait", line: `Your buyer got a link to initial the changes${counter.initialsSentAt ? ` (${fmtWhen(counter.initialsSentAt)})` : ""}. When they finish, the initialed copy becomes a revised offer ready to send back.` };
  if (counter.status === "initialed") {
    if (counter.revisionStatus === "sent") return { step: 4, tone: "wait", line: "The initialed counter was sent back. Waiting on the seller." };
    return { step: 3, tone: "good", line: "Your buyer initialed the counter. Send it back: 📧 Send to listing agent on the revised offer (newest row above)." };
  }
  if (counter.status === "declined") return { step: 2, tone: "bad", line: `Your buyer said no to the counter.${counter.note ? ` Note: ${counter.note}` : ""}` };
  return null;
}

// Displayed timeline. Carlos 10/2: "Offer sent" used to be the CURRENT pill
// while waiting, which read as if it hadn't been sent. Now the history is shown
// done (✓ Buyer signed → ✓ Offer sent) and the current step is the seller's
// answer. `step` is still buyerOfferState()'s internal number (0 = waiting on
// the seller) — only the display is shifted by the two done steps.
const DISPLAY_STEPS = (countered) => ["Buyer signed", "Offer sent", countered ? "They countered" : "Seller's answer", "Your buyer's answer", "Buyer signs", "Sent back", "Seller accepts"];
export function BuyerStepTracker({ step, tone }) {
  const color = tone === "bad" ? C.red : tone === "good" ? C.green : C.blue;
  const cur = step + 2;
  const steps = DISPLAY_STEPS(step >= 1);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", margin: "4px 0 6px" }}>
      {steps.map((s, i) => (
        <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 12,
            background: i < cur ? C.greenBg : i === cur ? color : C.bg, color: i < cur ? C.green : i === cur ? "#fff" : C.muted,
            border: `1px solid ${i < cur ? "#BFE3C9" : i === cur ? color : C.border}` }}>{i < cur ? "✓ " : `${i + 1} `}{s}{i === cur && step === 0 ? tr(" — waiting") : ""}</span>
          {i < steps.length - 1 && <span style={{ color: C.muted, fontSize: 10 }}>→</span>}
        </span>
      ))}
    </div>
  );
}

// The panel under a buyer's offer: what they changed + what to do next.
export function BuyerCounterPanel({ offer, counter, tx, onChanged, onOpenOffer, onTheyCountered }) {
  const st = buyerOfferState(offer, counter);
  const [busy, setBusy] = useState("");
  const [initialsFor, setInitialsFor] = useState(null);
  const [how, setHow] = useState(false);
  if (!st) return null;
  const post = async (path, body, label) => {
    setBusy(label);
    try {
      const r = await fetch(`${API}${path}`, { method: "POST", headers: jsonHdrs(), body: JSON.stringify(body || {}) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Something went wrong");
      return b;
    } finally { setBusy(""); }
  };
  const resubmit = async (mode) => {
    const msg = mode === "accept"
      ? "Your buyer ACCEPTS the seller's counter?\n\nThe app builds a revised offer with their changes filled in. Next you generate the packet, your buyer signs, and you send it back. Nothing is sent now."
      : "Your buyer wants to COUNTER BACK?\n\nThe app builds a revised offer with the seller's changes filled in and opens it so you can change what your buyer wants. Nothing is sent now.";
    if (!(await askConfirm(msg, { okLabel: mode === "accept" ? tr("Yes, accept counter") : tr("Yes, counter back") }))) return;
    try { const b = await post(`/their-counters/${counter.id}/resubmit`, { mode }, mode); onChanged && onChanged(); onOpenOffer && onOpenOffer(b.offerId); }
    catch (e) { alert(e.message); }
  };
  const decline = async () => {
    const note = await askText(tr("Your buyer says NO to the seller's counter. Add a note for the file (optional). This marks the offer withdrawn — tell the listing agent yourself; the app doesn't email them."), "", { okLabel: "Withdraw offer", multiline: true });
    if (note === null) return;
    try { await post(`/their-counters/${counter.id}/decline`, { note }, "decline"); onChanged && onChanged(); } catch (e) { alert(e.message); }
  };
  const reread = async () => {
    if (!(await askConfirm(tr("Re-read their counter? (Use this if you picked the wrong email or document.)"), { okLabel: tr("Re-read") }))) return;
    try { await post(`/their-counters/${counter.id}/reopen`, {}, "reread"); onChanged && onChanged(); onTheyCountered && onTheyCountered(); } catch (e) { alert(e.message); }
  };
  const box = st.tone === "bad" ? { bg: "#FDEDEC", bd: "#F5B7B1", fg: C.darkRed } : st.tone === "good" ? { bg: C.greenBg, bd: "#BFE3C9", fg: C.green } : { bg: C.blueBg, bd: "#bae6fd", fg: C.blue };
  return (
    <div style={{ background: "#FAFAFA", border: "1px solid " + C.border, borderRadius: 10, padding: "10px 12px" }}>
      <BuyerStepTracker step={st.step} tone={st.tone} />
      <div style={{ background: box.bg, border: "1px solid " + box.bd, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: box.fg }}>
        <strong>{tr("What's next:")}</strong> {st.line}{" "}
        <button onClick={() => setHow(h => !h)} style={{ background: "none", border: "none", color: C.blue, textDecoration: "underline", cursor: "pointer", fontSize: 12, padding: 0, fontFamily: "inherit" }}>{how ? tr("Hide") : tr("How this works")}</button>
      </div>
      {how && HOW_BUYER_COUNTERS}
      {counter && (counter.changes || []).length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{tr("🔁 What the seller changed")}{counter.round > 1 ? tr(" (round {n})", { n: counter.round }) : ""}{counter.source && counter.source.name ? <span style={{ fontWeight: 400, color: C.muted }}> {tr("— from")} {counter.source.name}</span> : null}</div>
          {(counter.changes || []).map(ch => (
            <div key={ch.id} style={{ padding: "3px 0", borderBottom: "1px solid #eee" }}>
              {ch.severity === "red" && <span title={tr(ch.why) || ""} style={{ color: C.red, fontWeight: 800 }}>🔴 </span>}
              <strong>{tr(ch.label)}:</strong> {ch.key ? <>{ch.beforeText} → <strong>{ch.afterText}</strong></> : ch.afterText}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 10 }}>
        {st.step === 0 && <button onClick={onTheyCountered} style={btn(true)}>{tr("🔁 They countered")}</button>}
        {counter && counter.status === "recorded" && <>
          <button onClick={() => resubmit("accept")} disabled={!!busy} style={btn(true, C.blue)}>{busy === "accept" ? tr("Building…") : tr("✅ Buyer accepts their counter")}</button>
          <button onClick={() => resubmit("counter_back")} disabled={!!busy} style={btn(false, C.blue)}>{busy === "counter_back" ? tr("Building…") : tr("↩️ Counter back")}</button>
          {counter.source && counter.source.hasPdf && <button onClick={() => setInitialsFor(counter)} disabled={!!busy} style={btn(false, C.blue)}>{tr("✍️ Buyer initials their copy")}</button>}
          <button onClick={decline} disabled={!!busy} style={btn(false, "#555")}>{tr("Buyer says no")}</button>
          <button onClick={reread} disabled={!!busy} style={{ ...btn(false, "#888"), fontWeight: 600 }}>{tr("Re-read it")}</button>
        </>}
        {counter && ["accepted_by_buyer", "countered_back", "initialed"].includes(counter.status) && counter.revisionOfferId && counter.revisionStatus !== "sent" && counter.revisionStatus !== "accepted" &&
          <button onClick={() => onOpenOffer && onOpenOffer(counter.revisionOfferId)} style={btn(true, C.blue)}>{tr("✏️ Open the revised offer")}</button>}
      </div>
      {initialsFor && <BuyerInitialsLauncher counter={initialsFor} tx={tx} onClose={() => setInitialsFor(null)} onSent={() => { setInitialsFor(null); onChanged && onChanged(); }} />}
    </div>
  );
}

// The buyer initials the listing agent's marked-up copy (initials pre-placed).
function BuyerInitialsLauncher({ counter, tx, onClose, onSent }) {
  const [pkg, setPkg] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`${API}/their-counters/${counter.id}/buyer-initials`, { headers: hdrs() }).then(r => r.json().then(b => ({ ok: r.ok, b }))).then(({ ok, b }) => {
      if (!ok) throw new Error(b.error || "Couldn't prepare the initials");
      setPkg(b);
    }).catch(e => setErr(e.message));
  }, [counter.id]);
  if (err) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 420, fontSize: 14 }} onClick={e => e.stopPropagation()}>⚠️ {tr(err)}<div style={{ textAlign: "right", marginTop: 12 }}><button onClick={onClose} style={btn(false, "#555")}>{tr("Close")}</button></div></div>
    </div>);
  if (!pkg) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, fontSize: 14 }}>{tr("Finding each change on their copy…")}</div>
    </div>);
  const intro = (
    <>
      <strong>{tr("Your buyer initials each change.")}</strong> {tr("The app placed")} {pkg.placements.length} {tr(pkg.placements.length === 1 ? "initial" : "initials")} {tr("beside the seller's changes for")} {pkg.signers.map(s => s.name).filter(Boolean).join(" & ") || tr("your buyer")} {tr("— check each page. Tap a block to remove it, or pick Initials and tap the page to add one.")}
      {pkg.notes && pkg.notes.length > 0 && <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{pkg.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </>
  );
  return (
    <Suspense fallback={null}>
      <DocSignModal tx={tx} doc={pkg.doc} allDocs={[]} headers={hdrs()} onClose={onClose}
        initialRows={pkg.signers.length ? pkg.signers : null} initialPlacements={pkg.placements} autoPlace intro={intro}
        onSent={async (docId) => {
          await fetch(`${API}/their-counters/${counter.id}/buyer-initials-sent`, { method: "POST", headers: jsonHdrs(), body: JSON.stringify({ documentId: docId }) });
          onSent && onSent();
        }} />
    </Suspense>
  );
}

// One input for a term, by type (options come from the server's term list).
function TermInput({ term, value, onChange }) {
  const st = { width: "100%", padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", background: "#fff" };
  if (!term) return <textarea rows={2} value={value || ""} onChange={e => onChange(e.target.value)} style={st} />;
  if (term.type === "select") return (
    <select value={value || ""} onChange={e => onChange(e.target.value)} style={st}>
      <option value="">—</option>
      {term.options.map(o => <option key={o} value={o}>{tr(o)}</option>)}
      {value && !term.options.includes(value) && <option value={value}>{tr(value)}</option>}
    </select>);
  if (term.type === "date") return <input type="date" value={value ? String(value).slice(0, 10) : ""} onChange={e => onChange(e.target.value)} style={st} />;
  if (["money", "days", "percent"].includes(term.type)) return <input inputMode="decimal" value={value ?? ""} onChange={e => onChange(e.target.value)} style={st} placeholder={term.type === "money" ? "$" : term.type === "percent" ? "%" : tr("days")} />;
  if (term.type === "addenda") return <input value={Array.isArray(value) ? value.join(", ") : (value || "")} onChange={e => onChange(e.target.value)} style={st} placeholder={tr("Rider letters, e.g. B, E, F")} />;
  return <textarea rows={term.type === "longtext" ? 3 : 1} value={value || ""} onChange={e => onChange(e.target.value)} style={st} />;
}

// ── "🔁 They countered" — point the app at their counter, check what it read ─
export function TheirCounterModal({ offer, address, onClose, onSaved }) {
  const [setup, setSetup] = useState(null);
  const [err, setErr] = useState("");
  const [stage, setStage] = useState("source");     // source | review
  const [src, setSrc] = useState(null);             // {kind:'email', id, attachmentKey} | {kind:'document', id} | {kind:'upload', file} | {kind:'typed'}
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState("");
  const [read, setRead] = useState(null);           // {counterId, items, deadline, summary, source}
  const [items, setItems] = useState([]);
  const [acks, setAcks] = useState({});
  const [deadline, setDeadline] = useState("");
  const [addKey, setAddKey] = useState("");

  useEffect(() => {
    fetch(`${API}/offers/${offer.id}/their-counter/setup`, { headers: hdrs() }).then(r => r.json().then(b => ({ ok: r.ok, b }))).then(({ ok, b }) => {
      if (!ok) throw new Error(b.error || "Couldn't load the offer");
      setSetup(b);
      if (b.emails && b.emails.length) setSrc({ kind: "email", id: b.emails[0].id, attachmentKey: (b.emails[0].attachments[0] || {}).key || null });
      else setSrc({ kind: "upload", file: null });
      if (b.draft && b.draft.items && b.draft.items.length) {
        setRead({ counterId: b.draft.id, items: b.draft.items, deadline: b.draft.deadline, summary: b.draft.summary, source: b.draft.source });
        setItems(b.draft.items.map(i => ({ ...i })));
        setDeadline(toLocalInput(b.draft.deadline));
        setStage("review");
      }
    }).catch(e => setErr(e.message));
  }, [offer.id]);

  const termOf = (key) => (setup && setup.terms || []).find(t => t.key === key) || null;

  const doRead = async () => {
    setErr(""); setBusy("read");
    try {
      const body = { text: typed || undefined };
      if (src.kind === "email") { body.inboundId = src.id; body.attachmentKey = src.attachmentKey || undefined; }
      else if (src.kind === "document") { if (!src.id) throw new Error("Pick the document."); body.documentId = src.id; }
      else if (src.kind === "upload") {
        if (!src.file) throw new Error("Choose their counter PDF.");
        const base64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(src.file); });
        body.file = { name: src.file.name, base64 };
      } else if (!typed.trim()) throw new Error("Type what they changed.");
      const r = await fetch(`${API}/offers/${offer.id}/their-counter/read`, { method: "POST", headers: jsonHdrs(), body: JSON.stringify(body) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't read their counter");
      setRead(b); setItems((b.items || []).map(i => ({ ...i }))); setAcks({}); setDeadline(toLocalInput(b.deadline)); setStage("review");
    } catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  const addTerm = () => {
    const t = termOf(addKey);
    if (!t) return;
    setItems(list => [...list, { id: "m" + Date.now(), key: t.key, label: t.label, before: t.value, beforeText: t.display, after: t.value, afterText: "", severity: "normal", origin: "agent" }]);
    setAddKey("");
  };
  const reds = items.filter(i => i.severity === "red");
  const unacked = reds.filter(i => !acks[i.id]);

  const save = async () => {
    setErr("");
    if (unacked.length) { setErr(tn(unacked.length, "Tick \"I see it\" on {n} flagged change first.", "Tick \"I see it\" on {n} flagged changes first.")); return; }
    setBusy("save");
    try {
      const r = await fetch(`${API}/their-counters/${read.counterId}/save`, {
        method: "POST", headers: jsonHdrs(),
        body: JSON.stringify({ items: items.map(i => ({ id: i.id, key: i.key, label: i.label, after: i.after })), acks, deadline: deadline ? new Date(deadline).toISOString() : null }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't save");
      onSaved && onSaved(b.counter);
      onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  const radio = (checked, onPick, label, extra) => (
    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", border: `1px solid ${checked ? C.blue : C.border}`, borderRadius: 8, marginBottom: 6, cursor: "pointer", background: checked ? C.blueBg : "#fff" }}>
      <input type="radio" checked={checked} onChange={onPick} style={{ marginTop: 3 }} />
      <span style={{ flex: 1, fontSize: 13 }}>{tr(label)}{checked && extra}</span>
    </label>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1500, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 12px" }}
      onMouseDown={e => { if (e.target === e.currentTarget) e.currentTarget.dataset.dob = "1"; else delete e.currentTarget.dataset.dob; }}
      onClick={e => { if (e.target === e.currentTarget && e.currentTarget.dataset.dob) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 760, overflow: "hidden" }}>
        <div style={{ background: C.text, color: "#fff", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 18, fontWeight: 800 }}>{tr("🔁 The seller countered")}</div><div style={{ fontSize: 12.5, opacity: 0.8 }}>{address}</div></div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {err && <div style={{ background: "#FDEDEC", border: "1px solid #F5B7B1", color: C.darkRed, borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>⚠️ {tr(err)}</div>}
          {!setup && !err && <div style={{ fontSize: 14, color: C.muted }}>{tr("Loading…")}</div>}

          {setup && stage === "source" && src && (
            <>
              <div style={{ background: C.blueBg, border: "1px solid #bae6fd", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.blue, lineHeight: 1.5, marginBottom: 14 }}>
                <strong>{tr("Step 1 of 2 — where is their counter?")}</strong> {tr("Pick the listing agent's email, their document, upload it, or type the changes. The app reads it against everything your buyer signed.")}
              </div>
              {(setup.emails || []).map(e => radio(src.kind === "email" && src.id === e.id, () => setSrc({ kind: "email", id: e.id, attachmentKey: (e.attachments[0] || {}).key || null }),
                <><strong>📧 {e.subject || tr("(no subject)")}</strong> <span style={{ color: C.muted }}>— {e.from}, {fmtWhen(e.receivedAt)}{e.attachments.length ? tr(" · 📎 {n} PDF", { n: e.attachments.length }) : ""}</span><div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{(e.snippet || "").slice(0, 160)}</div></>,
                e.attachments.length > 1 && (
                  <select value={src.attachmentKey || ""} onChange={ev => setSrc(s => ({ ...s, attachmentKey: ev.target.value }))} style={{ marginTop: 6, padding: 6, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13 }}>
                    {e.attachments.map(a => <option key={a.key} value={a.key}>{tr(a.name)}</option>)}
                  </select>)))}
              {radio(src.kind === "document", () => setSrc({ kind: "document", id: (setup.documents[0] || {}).id || "" }), <strong>{tr("📁 A document already on this deal")}</strong>,
                <select value={src.id || ""} onChange={ev => setSrc({ kind: "document", id: ev.target.value })} style={{ display: "block", marginTop: 6, padding: 6, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, maxWidth: "100%" }}>
                  {(setup.documents || []).map(d => <option key={d.id} value={d.id}>{tr(d.name)}</option>)}
                </select>)}
              {radio(src.kind === "upload", () => setSrc({ kind: "upload", file: null }), <strong>{tr("⬆ Upload their counter (PDF)")}</strong>,
                <input type="file" accept=".pdf,application/pdf" onChange={ev => setSrc({ kind: "upload", file: ev.target.files && ev.target.files[0] })} style={{ display: "block", marginTop: 6, fontSize: 13 }} />)}
              {radio(src.kind === "typed", () => setSrc({ kind: "typed" }), <strong>{tr("⌨️ They told me (phone / text) — I'll type the changes")}</strong>)}
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>{src.kind === "typed" ? tr("What they changed") : tr("Anything else they said (optional)")}
                <textarea rows={3} value={typed} onChange={e => setTyped(e.target.value)} placeholder={tr("e.g. Price $515,000, closing November 30, seller won't pay the home warranty")}
                  style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginTop: 4, boxSizing: "border-box", fontFamily: "inherit" }} />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button onClick={onClose} style={btn(false, "#555")}>{tr("Cancel")}</button>
                <button onClick={doRead} disabled={!!busy} style={btn(true)}>{busy === "read" ? tr("Reading… (about a minute)") : tr("🔎 Read their counter")}</button>
              </div>
            </>
          )}

          {setup && stage === "review" && read && (
            <>
              <div style={{ background: C.blueBg, border: "1px solid #bae6fd", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.blue, lineHeight: 1.5, marginBottom: 12 }}>
                <strong>{tr("Step 2 of 2 — check what they changed.")}</strong> {tr(read.summary) || ""} {tr("Fix anything the app read wrong, remove what isn't a change, or add a term it missed. Nothing is sent.")}
              </div>
              {reds.length > 0 && (
                <div style={{ background: "#FDEDEC", border: "1px solid #F5B7B1", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.darkRed, marginBottom: 12 }}>
                  🔴 <strong>{reds.length} {tr("change")}{reds.length > 1 ? "s" : ""} {tr("to look at closely")}</strong> {tr("— in their document but not in their email, or the email and document don't agree. Tick \"I see it\" on each one.")}
                </div>
              )}
              {items.length === 0 && <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>{tr("No changes found. Add the terms they changed below, or go back and pick a different email or document.")}</div>}
              {items.map((it, idx) => {
                const t = it.key ? termOf(it.key) : null;
                const red = it.severity === "red";
                return (
                  <div key={it.id} style={{ border: `1px solid ${red ? "#F5B7B1" : C.border}`, background: red ? "#FFF8F7" : "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{red ? "🔴 " : ""}{tr(it.label)}{it.page ? <span style={{ fontWeight: 400, color: C.muted, fontSize: 12 }}> {tr("· page")} {it.page}</span> : null}</div>
                      <button onClick={() => setItems(list => list.filter((_, j) => j !== idx))} title={tr("Not a change — remove")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>✕</button>
                    </div>
                    {it.detail && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{it.detail}</div>}
                    {red && it.why && <div style={{ fontSize: 12.5, color: C.darkRed, marginTop: 4, fontWeight: 600 }}>{tr(it.why)}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10, marginTop: 8, alignItems: "end" }}>
                      <div style={{ fontSize: 12.5 }}><div style={{ color: C.muted, fontWeight: 700, marginBottom: 3 }}>{tr("Your buyer's offer")}</div>{it.key ? (it.beforeText || "—") : "—"}</div>
                      <div style={{ fontSize: 12.5 }}><div style={{ color: C.muted, fontWeight: 700, marginBottom: 3 }}>{tr("Their counter")}</div>
                        <TermInput term={t} value={it.after} onChange={v => setItems(list => list.map((x, j) => j === idx ? { ...x, after: v } : x))} />
                      </div>
                    </div>
                    {red && (
                      <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, fontSize: 13, fontWeight: 700, color: C.darkRed, cursor: "pointer" }}>
                        <input type="checkbox" checked={!!acks[it.id]} onChange={e => setAcks(a => ({ ...a, [it.id]: e.target.checked }))} /> {tr("I see it — it's part of their counter")}
                      </label>
                    )}
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "6px 0 12px" }}>
                <select value={addKey} onChange={e => setAddKey(e.target.value)} style={{ padding: 7, borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13 }}>
                  <option value="">{tr("+ Add a term they changed…")}</option>
                  {(setup.terms || []).filter(t => !items.some(i => i.key === t.key)).map(t => <option key={t.key} value={t.key}>{t.group} — {tr(t.label)}</option>)}
                </select>
                {addKey && <button onClick={addTerm} style={btn(false, C.blue)}>{tr("Add")}</button>}
              </div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{tr("Their counter expires (optional)")}</label>
              <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 14, fontFamily: "inherit" }} />
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{tr("You get a Win the Day reminder a day before.")}</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={() => setStage("source")} style={btn(false, "#555")}>{tr("← Read something else")}</button>
                <button onClick={save} disabled={!!busy || !items.length} style={{ ...btn(true), opacity: unacked.length || !items.length ? 0.6 : 1 }}>{busy === "save" ? tr("Saving…") : tr("Save their counter")}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
