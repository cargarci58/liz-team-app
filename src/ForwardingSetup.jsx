import { t as tr, locale as uiLocale } from "./i18n";
import { useEffect, useRef, useState } from "react";

// Email forwarding setup — the app DETECTS the person's email provider (from
// their login email's domain + its mail servers), shows ONLY those steps, and
// shows live status: ✅ working / ⏳ confirmation waiting / ⚠️ not set up.
// "Send me a test email" proves it end-to-end. (Carlos 9/28: new agents won't
// know which email they use or which steps apply.) Used in My Profile for
// agents AND TCs.
const API = "https://liz-team-server-api-production.up.railway.app";
const C = { red: "#C0392B", darkRed: "#922B21", light: "#F4F4F4", blue: "#0c4a6e", green: "#1E8449", gray: "#6B7280", border: "#DDD" };
const PROVIDERS = [
  { key: "gmail", label: "Gmail / Google Workspace" },
  { key: "outlook", label: "Outlook / Hotmail / Microsoft 365" },
  { key: "icloud", label: "iCloud Mail" },
  { key: "yahoo", label: "Yahoo" },
  { key: "aol", label: "AOL" },
  { key: "other", label: "Something else" },
];

function Steps({ provider, address, confirm }) {
  const code = <b style={{ background: "#fff", border: "1px solid #BBF7D0", borderRadius: 6, padding: "1px 6px", wordBreak: "break-all" }}>{address}</b>;
  const ol = { margin: "6px 0 0", paddingLeft: 20, lineHeight: 1.65 };
  if (provider === "gmail") return (
    <ol style={ol}>
      <li>{tr("Open Gmail → Settings ⚙️ →")} <b>{tr("See all settings")}</b> → <b>{tr("Forwarding and POP/IMAP")}</b> → <b>{tr("Add a forwarding address")}</b> {tr("→ paste")} {code} {tr("→ Next → Proceed.")}</li>
      <li>{tr("Gmail sends a confirmation to TransactPro.")} {confirm && confirm.link
        ? <><b>{tr("It's here →")}</b> <a href={confirm.link} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginLeft: 4, padding: "4px 10px", borderRadius: 6, background: C.green, color: "#fff", fontWeight: 700, textDecoration: "none" }}>{tr("Confirm forwarding")}</a> {tr("then click")} <b>{tr("Confirm")}</b> {tr("on Google's page.")}</>
        : <>{tr("It shows up")} <b>{tr("on this page")}</b> {tr("within a minute (refresh) — or in Win the Day → 📥 Mail to file. Click")} <b>{tr("Confirm forwarding")}</b>{tr(", then")} <b>{tr("Confirm")}</b> {tr("on Google's page.")}</>}</li>
      <li>{tr("Back in Gmail's Forwarding page,")} <b>{tr("refresh")}</b>{tr(". It must no longer say \"Verify fw-…\".")}</li>
      <li>{tr("Select")} <b>{tr("\"Forward a copy of incoming mail to fw-…\"")}</b> {tr("and")} <b>{tr("\"keep … copy in the Inbox\"")}</b> {tr("→ click")} <b>{tr("Save Changes")}</b>.</li>
      <li>{tr("Press")} <b>{tr("Send me a test email")}</b> {tr("below.")}</li>
    </ol>
  );
  if (provider === "outlook") return (
    <ol style={ol}>
      <li>{tr("Open Outlook (outlook.com or Outlook on the web) → Settings ⚙️ →")} <b>{tr("Mail")}</b> → <b>{tr("Forwarding")}</b>.</li>
      <li>{tr("Turn on")} <b>{tr("Enable forwarding")}</b> {tr("→ paste")} {code}.</li>
      <li>{tr("Check")} <b>{tr("\"Keep a copy of forwarded messages\"")}</b> → <b>{tr("Save")}</b>{tr(". No confirmation needed. (Outlook may first ask you to verify your own account with a code — that's Microsoft, one time.)")}</li>
      <li>{tr("Press")} <b>{tr("Send me a test email")}</b> {tr("below.")}</li>
      <li style={{ color: C.gray }}>{tr("Work (Microsoft 365) email and it says forwarding is blocked? Ask whoever manages your company email to allow automatic forwarding.")}</li>
    </ol>
  );
  if (provider === "icloud") return (
    <ol style={ol}>
      <li>{tr("Go to")} <b>{tr("icloud.com/mail")}</b> {tr("→ Settings ⚙️ →")} <b>{tr("Preferences")}</b> → <b>{tr("General")}</b>.</li>
      <li>{tr("Check")} <b>{tr("\"Forward my email to\"")}</b> {tr("→ paste")} {code}{tr(". Leave \"Delete messages after forwarding\"")} <b>{tr("unchecked")}</b> {tr("→ Done.")}</li>
      <li>{tr("Press")} <b>{tr("Send me a test email")}</b> {tr("below.")}</li>
    </ol>
  );
  if (provider === "yahoo" || provider === "aol") return (
    <div style={{ marginTop: 6, lineHeight: 1.6 }}>
      <b>{provider === "yahoo" ? tr("Free Yahoo Mail") : tr("AOL Mail")} {tr("doesn't allow automatic forwarding.")}</b> {tr("Two options:")}
      <ol style={ol}>
        <li>{tr("Use a Gmail or Outlook address for your deals (change your login email in Team settings, or ask your admin), then come back here,")} <b>{tr("or")}</b></li>
        <li>{provider === "yahoo" ? <>{tr("With")} <b>{tr("Yahoo Mail Plus")}</b>{tr(": Settings ⚙️ → More settings →")} <b>{tr("Mailboxes")}</b> {tr("→ your address →")} <b>{tr("Forwarding")}</b> {tr("→ paste")} {code} {tr("→ Verify.")}</> : <>{tr("Forward deal emails by hand to")} {code} {tr("— the app files them.")}</>}</li>
      </ol>
    </div>
  );
  return (
    <ol style={ol}>
      <li>{tr("In your email's settings, look for")} <b>{tr("Forwarding")}</b> {tr("(sometimes under \"Mail\", \"Rules\" or \"Accounts\").")}</li>
      <li>{tr("Forward all incoming mail to")} {code} {tr("and choose to")} <b>{tr("keep a copy")}</b> {tr("in your inbox → Save. If it sends a confirmation, it shows up on this page — click it.")}</li>
      <li>{tr("Press")} <b>{tr("Send me a test email")}</b> {tr("below. Stuck? Ask whoever manages your email, or send your admin a screenshot of the settings page.")}</li>
    </ol>
  );
}

export default function ForwardingSetup() {
  const [s, setS] = useState(null);
  const [override, setOverride] = useState("");
  const [copied, setCopied] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const poll = useRef(null);
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") };
  const load = () => fetch(API + "/me/forward-setup", { headers }).then(r => r.ok ? r.json() : null).then(d => { if (d) setS(d); return d; }).catch(() => null);
  useEffect(() => { load(); return () => clearInterval(poll.current); }, []);
  if (!s || !s.address) return null;
  const provider = override || s.provider;
  const sendTest = async () => {
    setTestMsg("Sending…");
    try {
      const r = await fetch(API + "/me/forward-setup/test", { method: "POST", headers, body: "{}" });
      const d = await r.json();
      if (!r.ok) { setTestMsg(d.error || "Couldn't send the test."); return; }
      setTestMsg(`Test sent to ${d.sentTo}. Watching for it to come back…`);
      clearInterval(poll.current);
      const started = Date.now();
      poll.current = setInterval(async () => {
        const d2 = await load();
        if (d2 && d2.status === "working" && d2.lastReceivedAt && new Date(d2.lastReceivedAt).getTime() > started - 5000) {
          clearInterval(poll.current); setTestMsg("✅ It came back — forwarding works!");
        } else if (Date.now() - started > 3 * 60 * 1000) {
          clearInterval(poll.current); setTestMsg("⚠️ The test hasn't come back after 3 minutes, so forwarding isn't on yet. Re-check the steps above.");
        }
      }, 10000);
    } catch { setTestMsg("Network error — try again."); }
  };
  const badge = s.status === "working"
    ? { t: `✅ Forwarding is working${s.lastReceivedAt ? " — last email " + new Date(s.lastReceivedAt).toLocaleString(uiLocale(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}`, c: C.green, bg: "#E9F7EF" }
    : s.status === "confirm_waiting"
      ? { t: "⏳ Almost there — confirm the forwarding request below", c: C.blue, bg: "#E0F2FE" }
      : { t: "⚠️ Not set up yet — no email has come through", c: C.darkRed, bg: "#FADBD8" };
  return (
    <div style={{ marginBottom: 20, padding: 16, background: "#F0FDF4", borderRadius: 10, border: "1px solid #BBF7D0" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{tr("📥 Catch deal emails sent to your inbox")}</div>
      <div style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: badge.c, background: badge.bg, borderRadius: 8, padding: "4px 10px", marginBottom: 10 }}>{badge.t}</div>
      <div style={{ fontSize: 12.5, color: "#444", marginBottom: 10, lineHeight: 1.5 }}>
        {tr("Title companies, lenders and other agents often email")} <b>{tr("you")}</b> {tr("directly. Forward your inbox to your personal TransactPro address once, and emails whose")} <b>{tr("subject mentions one of your deals")}</b> {tr("(its address or someone on it) file themselves. Everything else is ignored.")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <code style={{ fontSize: 13, fontWeight: 700, color: "#14532D", wordBreak: "break-all", background: "#fff", padding: "6px 10px", borderRadius: 8, border: "1px solid #BBF7D0" }}>{s.address}</code>
        <button onClick={() => { try { navigator.clipboard.writeText(s.address); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { alert(s.address); } }}
          style={{ padding: "8px 14px", background: "#0c4a6e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
          {copied ? tr("✅ Copied") : tr("Copy address")}
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: "#333" }}>
        {tr("Your email")} <b>{s.email}</b> {tr("uses:")}{" "}
        <select value={provider} onChange={e => setOverride(e.target.value)} style={{ fontSize: 14, padding: "3px 6px", borderRadius: 6, border: "1px solid " + C.border, fontFamily: "inherit" }}>
          {PROVIDERS.map(p => <option key={p.key} value={p.key}>{tr(p.label)}</option>)}
        </select>
        {!override && s.provider !== "other" && <span style={{ color: C.gray }}> {tr("(detected automatically — change it if that's wrong)")}</span>}
      </div>
      <div style={{ fontSize: 12.5, color: "#333" }}><Steps provider={provider} address={s.address} confirm={s.pendingConfirm} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={sendTest} style={{ padding: "8px 14px", background: "#fff", color: C.blue, border: "1.5px solid " + C.blue, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
          {tr("📨 Send me a test email")}
        </button>
        <button onClick={load} style={{ padding: "8px 12px", background: "none", color: C.gray, border: "1px solid " + C.border, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>{tr("↻ Check status")}</button>
        {testMsg && <span style={{ fontSize: 12.5, color: "#333" }}>{testMsg}</span>}
      </div>
    </div>
  );
}
