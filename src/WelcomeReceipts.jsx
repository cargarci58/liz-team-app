import { t as tr, locale as uiLocale } from "./i18n";
import { useEffect, useState, useCallback } from "react";
import { askConfirm } from "./ui/dialogs";
import { t, useLang, applyPreferredLang } from "./i18n";
import LangToggle from "./components/LangToggle";

// Welcome-email receipts: did every party (title, lender, co-op agent, clients…)
// actually get the Under-Contract welcome email? Shown on the People tab (agent
// AND coordinator mode) and used by the Win-the-Day "not confirmed" card.
// Reminders to a party are NEVER automatic — the agent/TC reviews the text in
// WelcomeReminderModal and presses Send.
const API = "https://liz-team-server-api-production.up.railway.app";
const C = { red: "#C0392B", darkRed: "#922B21", gray: "#6B7280", light: "#F4F4F4", border: "#E5E7EB", blue: "#0c4a6e", green: "#1E8449", black: "#1F2937" };
const authHeaders = () => ({ "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") });
const fmt = (d) => d ? new Date(d).toLocaleString(uiLocale(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

function statusOf(r) {
  if (r.confirmed_at) {
    const how = r.confirmed_via === "button" ? "clicked ✅" : r.confirmed_via === "reply" ? "replied" : `marked by ${r.confirmed_by_name || "agent"}`;
    return { label: `✅ Confirmed ${fmt(r.confirmed_at)} · ${how}`, color: C.green, bg: "#E9F7EF" };
  }
  if (r.bounced_at) return { label: "⚠️ Bounced — email address is wrong", color: C.darkRed, bg: "#FADBD8" };
  const bits = [r.delivered_at ? "📬 Delivered" : "📤 Sent " + fmt(r.sent_at), r.opened_at ? "opened" : null,
    r.reminder_count ? `${r.reminder_count} reminder${r.reminder_count > 1 ? "s" : ""} sent` : null].filter(Boolean);
  return { label: bits.join(" · ") + " — not confirmed yet", color: C.blue, bg: "#E0F2FE" };
}

export function WelcomeReminderModal({ receiptId, onClose, onSent }) {
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`${API}/welcome-receipts/${receiptId}/reminder-draft`, { headers: authHeaders() })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => ok ? setDraft(d) : setErr(d.error || "Could not load the reminder."))
      .catch(() => setErr("Network error — try again."));
  }, [receiptId]);
  const send = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/welcome-receipts/${receiptId}/send-reminder`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ subject: draft.subject, body: draft.body }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Send failed");
      onSent && onSent();
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  const inp = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 16, fontFamily: "inherit" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 3000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 16px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, padding: 22 }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{tr("📭 Ask them to confirm the welcome email")}</div>
        <div style={{ fontSize: 13, color: C.gray, marginBottom: 14 }}>{tr("Review the message. Nothing is sent until you press Send. It includes their one-click ✅ button.")}</div>
        {!draft && !err && <div style={{ color: C.gray }}>{tr("Loading…")}</div>}
        {draft && draft.bounced && (
          <div style={{ background: "#FADBD8", color: C.darkRed, borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}>
            {tr("⚠️ Their last email to")} {draft.to} {tr("bounced. Fix the address in People and use their Send Welcome instead — a reminder to the same address will bounce too.")}
          </div>
        )}
        {draft && (<>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, marginBottom: 4 }}>{tr("To")}</div>
          <div style={{ fontSize: 14, marginBottom: 12 }}>{draft.toName ? `${draft.toName} · ` : ""}{draft.to}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, marginBottom: 4 }}>{tr("Subject")}</div>
          <input value={draft.subject} onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} style={{ ...inp, marginBottom: 12 }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, marginBottom: 4 }}>{tr("Message")}</div>
          <textarea value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} rows={10} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
        </>)}
        {err && <div style={{ color: C.darkRed, fontSize: 13, marginTop: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid " + C.border, background: "#fff", color: C.gray, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{tr("Cancel")}</button>
          <button onClick={send} disabled={!draft || busy} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0c4a6e", color: "#fff", fontWeight: 700, cursor: draft && !busy ? "pointer" : "default", opacity: draft && !busy ? 1 : 0.6, fontFamily: "inherit" }}>
            {busy ? tr("Sending…") : tr("✉️ Send reminder")}
          </button>
        </div>
      </div>
    </div>
  );
}

export async function markWelcomeReceiptConfirmed(receiptId, name) {
  if (!(await askConfirm(`Mark ${name || "this person"} as confirmed?\n\nUse this when they told you directly (phone, text, in person) that they got the welcome email.`, { okLabel: tr("Yes, confirmed") }))) return false;
  const r = await fetch(`${API}/welcome-receipts/${receiptId}/mark-confirmed`, { method: "POST", headers: authHeaders(), body: "{}" });
  if (!r.ok) { alert(tr("Could not save — please try again.")); return false; }
  return true;
}

export default function WelcomeReceiptsPanel({ tx }) {
  const [rows, setRows] = useState(null);
  const [remindId, setRemindId] = useState(null);
  const load = useCallback(() => {
    fetch(`${API}/transactions/${tx.id}/welcome-receipts`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { receipts: [] })
      .then(d => setRows(d.receipts || []))
      .catch(() => setRows([]));
  }, [tx.id]);
  useEffect(() => { load(); }, [load, (tx.parties || []).length]);
  if (!rows || !rows.length) return null;
  const done = rows.filter(r => r.confirmed_at).length;
  return (
    <div style={{ border: "1px solid " + C.border, borderRadius: 12, padding: 14, marginBottom: 16, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{tr("📩 Welcome email received?")}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: done === rows.length ? C.green : C.darkRed }}>{done} {tr("of")} {rows.length} {tr("confirmed")}</div>
      </div>
      {rows.map(r => {
        const s = statusOf(r);
        return (
          <div key={r.id} style={{ borderTop: "1px solid " + C.border, padding: "10px 0" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{r.party_name || r.party_email} <span style={{ fontWeight: 500, color: C.gray, fontSize: 12 }}>· {r.party_role}</span></div>
            <div style={{ display: "inline-block", marginTop: 4, fontSize: 12, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 6, padding: "2px 8px" }}>{tr(s.label)}</div>
            {!r.confirmed_at && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {!r.bounced_at && (
                  <button onClick={() => setRemindId(r.id)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#0c4a6e", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{tr("✉️ Review & send reminder")}</button>
                )}
                <button onClick={async () => { if (await markWelcomeReceiptConfirmed(r.id, r.party_name)) load(); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid " + C.green, background: "#fff", color: C.green, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{tr("✓ They told me they got it")}</button>
                {r.party_phone && <a href={"tel:" + r.party_phone} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid " + C.border, color: C.blue, fontWeight: 700, fontSize: 12, textDecoration: "none" }}>{tr("📞 Call")}</a>}
              </div>
            )}
            {r.bounced_at && !r.confirmed_at && <div style={{ fontSize: 12, color: C.darkRed, marginTop: 6 }}>{tr("Fix their email on their card below, then use their ✉️ Send Welcome.")}</div>}
          </div>
        );
      })}
      {remindId && <WelcomeReminderModal receiptId={remindId} onClose={() => setRemindId(null)} onSent={() => { setRemindId(null); load(); }} />}
    </div>
  );
}

// Public, no-login page behind the ✅ button in the email. Opening the page
// does NOT confirm — the person must press the button (link scanners open
// every link, so a GET must never count as a receipt).
export function WelcomeReceivedPublic({ urlToken }) {
  useLang();
  const token = urlToken || window.location.pathname.split("/welcome-received/")[1];
  const [state, setState] = useState("loading");
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token || token === "preview") { setState(token === "preview" ? "preview" : "expired"); return; }
    fetch(`${API}/public/welcome-receipt/${encodeURIComponent(token)}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (d && d.language) applyPreferredLang(d.language); if (!ok || !d.success) return setState("expired"); setInfo(d); setState(d.confirmed ? "done" : "ready"); })
      .catch(() => setState("error"));
  }, [token]);
  const confirm = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/public/welcome-receipt/${encodeURIComponent(token)}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      setState(r.ok ? "done" : "error");
    } catch { setState("error"); }
    setBusy(false);
  };
  const wrap = (children) => (
    <div style={{ minHeight: "100vh", background: C.light, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.10)", maxWidth: 440, width: "100%", padding: 28, textAlign: "center", color: C.black }}><div style={{ display: "flex", justifyContent: "flex-end", marginTop: -12, marginRight: -12, marginBottom: 6 }}><LangToggle /></div>{children}</div>
    </div>
  );
  if (state === "loading") return wrap(<div style={{ color: C.gray }}>{t("Loading…")}</div>);
  if (state === "preview") return wrap(<><div style={{ fontSize: 44 }}>👀</div><div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>{t("Preview only")}</div><div style={{ color: C.gray, fontSize: 14, marginTop: 6 }}>{t("Each person gets their own personal confirm link when the email is actually sent.")}</div></>);
  if (state === "expired") return wrap(<><div style={{ fontSize: 44 }}>🔗</div><div style={{ fontWeight: 800, fontSize: 18, marginTop: 8 }}>{t("This link is no longer valid")}</div><div style={{ color: C.gray, fontSize: 14, marginTop: 6 }}>{t("Just reply to the email and let your agent know you received it.")}</div></>);
  if (state === "error") return wrap(<><div style={{ fontWeight: 800, fontSize: 18 }}>{t("Something went wrong")}</div><div style={{ color: C.gray, fontSize: 14, marginTop: 6 }}>{t("Please try again, or reply \"Received\" to the email.")}</div></>);
  const who = info?.agentName || t("Your agent");
  if (state === "done") return wrap(<><div style={{ fontSize: 52 }}>✅</div><div style={{ fontWeight: 800, fontSize: 20, marginTop: 8 }}>{t("Thank you — confirmed!")}</div><div style={{ color: C.gray, fontSize: 14, marginTop: 6 }}>{info?.address
    ? t("{who} knows you received the welcome email for {address}. You can close this page.", { who, address: info.address })
    : t("{who} knows you received the welcome email. You can close this page.", { who })}</div></>);
  return wrap(<>
    <div style={{ fontSize: 13, fontWeight: 700, color: C.gray, letterSpacing: ".05em" }}>{t("WELCOME EMAIL")}</div>
    <div style={{ fontWeight: 800, fontSize: 20, margin: "8px 0 4px" }}>{info?.address || t("Your transaction")}</div>
    <div style={{ color: C.gray, fontSize: 14, marginBottom: 18 }}>{info?.partyName ? t("Hi {name} — ", { name: info.partyName.split(" ")[0] }) : ""}{info?.agentName
      ? t("please confirm you received the welcome email from {agent}.", { agent: info.agentName })
      : t("please confirm you received the welcome email.")}</div>
    <button onClick={confirm} disabled={busy} style={{ width: "100%", background: "#0c4a6e", color: "#fff", border: "none", borderRadius: 12, padding: "15px 0", fontWeight: 800, fontSize: 17, cursor: "pointer" }}>
      {busy ? t("Saving…") : t("✅ Yes, I received it")}
    </button>
  </>);
}
