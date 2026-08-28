import { useState, useRef, useEffect } from "react";
import { routeLocal } from "../lib/assistantLocal.js";
import { GUIDE_SECTIONS } from "./HelpCenter.jsx";

// ═══════════════════════════════════════════════════════════════
// AssistantPanel — the app-wide AI assistant ("Ask Liz").
//
// One floating 🎙 button on every screen. Tap → a chat panel where the
// agent types or SPEAKS a request and the assistant answers in text,
// cards, and (optionally) out loud:
//   • DO:    "dial Maria" → contact card with tap-to-call
//   • SHOW:  "what's due today?" → task list; "open Palm Ave" → the deal
//   • TEACH: "how do I upload a bank statement?" → numbered steps
//
// The brain lives on the SERVER: POST {API}/assistant receives the
// message + a compact snapshot of this agent's data (contacts, deals,
// today's tasks) + the Help Center guides, and Claude answers with
// { reply, speak, cards } (see reference/server/assistant-route.js).
// If that endpoint isn't reachable, routeLocal() (src/lib/
// assistantLocal.js) handles the core commands offline so the panel
// still works. Clarifying questions come back as "choices" cards —
// tap a button to answer.
//
// Writes are CONFIRM-FIRST: the AI can only PROPOSE a task
// (create_task card); nothing is saved, sent, or dialed until the
// agent taps the confirm button. Voice replies use the browser's
// speech synthesis; the mic uses webkitSpeechRecognition (hidden on
// browsers without it).
// ═══════════════════════════════════════════════════════════════

const API = "https://liz-team-server-api-production.up.railway.app";
const NAVY = "#1a2332";
const RED = "#C0392B";

// Bumped on every assistant change — shown in the panel header so "which
// version am I actually running?" is answerable at a glance (cache issues).
const BUILD_TAG = "v25";

const GREETING = "How can I help you today?";
// Set if holding the mic stream ever breaks the recognizer on this device
// (some Android builds refuse a second capture) — from then on, timers only.
let METER_OFF = false;
// Nothing heard for this long and the mic closes itself, out loud.
const QUIET_CLOSE_MS = 8000;
const IS_IOS = typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
   (/Mac/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
const SIGN_OFF = "I didn't hear anything, so I'm closing the mic. Tap it whenever you need me.";
const CHIPS = [
  { label: "❓ How do I…", send: "", fill: "how do I " },
  { label: "📞 Dial someone", send: "" , fill: "call " },
  { label: "✅ Today's tasks", send: "What are my tasks today?" },
  { label: "🏠 Deal status", send: "", fill: "what's the status of " },
  { label: "💬 Unread messages", send: "Do I have unread messages?" },
  { label: "📝 Add a task", send: "", fill: "remind me to " },
  // The Help Center is no longer a floating button of its own — this chip (and
  // ⚙️ Menu → ❓ Help & Guides) is how you reach the full guide library.
  { label: "📖 Browse all guides", nav: "help" },
];

const OFFLINE_HINT =
  "I can dial a contact (“call Maria”), show your tasks (“what's due today?”), open a deal (“open Palm Ave”), add a reminder (“remind me to call the lender tomorrow”), or explain the app (“how do I share a document?”).";

// The server brain now owns the full help library (routes/app-knowledge.js
// + its search_help tool) — guides are no longer shipped with each request.
// GUIDE_SECTIONS stays imported for the OFFLINE router only.

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

// Universal fallback: browsers with no native speech recognition (Firefox,
// Brave, some Android WebViews) — or where it errors — record audio with
// MediaRecorder and let the server transcribe it (POST /assistant/transcribe).
const CAN_RECORD = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" &&
  !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// Reads the streaming answer (POST /assistant/stream, server-sent events) and
// hands each piece of text over the moment it arrives, so the panel can start
// speaking before the full answer — cards and all — finishes generating.
async function readAnswerStream(res, onDelta) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", answer = null, err = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let cut;
    while ((cut = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      const ev = /^event: (.*)$/m.exec(block);
      const dl = /^data: (.*)$/m.exec(block);
      if (!ev || !dl) continue;
      let data;
      try { data = JSON.parse(dl[1]); } catch { continue; }
      if (ev[1] === "delta") { if (data.text) onDelta(data.text); }
      else if (ev[1] === "done") answer = data;
      else if (ev[1] === "error") err = data.error || "error";
    }
  }
  if (!answer) throw new Error(err || "stream ended with no answer");
  return answer;
}

// Trailing abbreviations that end in a period but not a sentence.
const SENTENCE_ABBR = /(?:^|[\s(])(?:st|ave|rd|dr|blvd|ct|ln|pkwy|hwy|apt|ste|mr|mrs|ms|jr|sr|no|vs|approx|est|e\.g|i\.e)\.$/i;

// ————— Voice activity meter ————————————————————————————————————
// The recognizer "finalizes" a phrase at ordinary mid-sentence pauses, so a
// timer started from its output cuts people off while they're still thinking.
// This watches the microphone's actual level instead, so the turn can only end
// after the room has genuinely gone quiet. Falls back to timers alone if
// WebAudio isn't available.
function startVoiceMeter(stream) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || !stream) return null;
    const ctx = new Ctx();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0.2;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const meter = { lastVoiceAt: Date.now(), floor: 0.01, stop: null };
    const id = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      // Noise floor tracks the room: drops instantly to a new quiet level,
      // creeps up slowly, so a humming office doesn't read as speech.
      meter.floor = rms < meter.floor ? rms : meter.floor * 0.995 + rms * 0.005;
      if (rms > Math.max(0.011, meter.floor * 2.5)) meter.lastVoiceAt = Date.now();
    }, 80);
    meter.stop = () => {
      clearInterval(id);
      try { src.disconnect(); } catch {}
      try { ctx.close(); } catch {}
    };
    return meter;
  } catch { return null; }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// `queue: true` adds this sentence BEHIND whatever is already playing instead
// of cutting it off — that's what lets a streamed answer start out loud on
// sentence one while sentence two is still being written.
function speak(text, onDone, { queue = false } = {}) {
  // Deferred: speechSynthesis.speak()/cancel() on macOS Chrome can hang the
  // tab for many seconds (long-standing Chromium bug, worst with the local
  // "Enhanced/Premium/Samantha" voices). Running it after a tick means the
  // click that triggered speech always paints first — the panel opens, the
  // mic indicator updates — even if the speech engine then stalls.
  setTimeout(() => {
    try {
      if (!window.speechSynthesis || !text) { if (onDone) onDone(); return; }
      if (!queue && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.04;
      // Prefer Google's en-US voice (Chrome, streamed, doesn't trigger the
      // hang), else the plain system default. NEVER pick the Enhanced/
      // Premium/Samantha local voices — they're the ones that freeze.
      const voices = window.speechSynthesis.getVoices() || [];
      const preferred =
        voices.find(v => /en[-_]US/i.test(v.lang) && /google/i.test(v.name)) ||
        voices.find(v => /en[-_]US/i.test(v.lang) && v.default) ||
        voices.find(v => /en[-_]US/i.test(v.lang) && !/enhanced|premium|natural|neural|samantha/i.test(v.name));
      if (preferred) u.voice = preferred;
      if (onDone) {
        // onend does NOT always fire (Chrome drops it when the tab is
        // backgrounded, or when the engine stalls). Everything downstream —
        // re-opening the mic for the next question — hangs on it, so back it
        // with a timer and take whichever lands first.
        //
        // That timer MUST start when this sentence starts SPEAKING, not when
        // it was queued: sentence 3 of a streamed answer is queued seconds
        // before it plays, and a timer started at queue time expired while
        // sentence 1 was still talking — the panel thought the reply was over,
        // re-opened the mic, and cut the assistant off mid-answer.
        let done = false;
        const finish = () => { if (done) return; done = true; onDone(); };
        u.onend = finish;
        u.onerror = finish;
        u.onstart = () => setTimeout(finish, Math.min(60000, 2000 + text.length * 90));
        // Backstop for an utterance that never starts at all (engine wedged).
        setTimeout(finish, 180000);
      }
      window.speechSynthesis.speak(u);
    } catch { if (onDone) onDone(); }
  }, 0);
}

// Safari (iOS especially) ignores speechSynthesis.speak() unless the page has
// already spoken once from a real tap. Burn that one inside the click handler
// with a silent utterance, so later speech — the greeting, the answers — is
// allowed to play.
let speechUnlocked = false;
function unlockSpeech() {
  if (speechUnlocked) return;
  try {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    speechUnlocked = true;
  } catch {}
}

function stopSpeaking() {
  // cancel() while idle is what wedges some Chrome/macOS combos — only
  // cancel when something is actually queued or speaking.
  try {
    if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      window.speechSynthesis.cancel();
    }
  } catch {}
}

// ————— Card renderers ———————————————————————————————————————————

function ContactCard({ contact }) {
  const btn = (href, bg, label) => (
    <a key={label} href={href} style={{ flex: 1, textAlign: "center", background: bg, color: "#fff", borderRadius: 8, padding: "10px 8px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
      {label}
    </a>
  );
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, marginTop: 8 }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: NAVY }}>{contact.name}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
        {[contact.role, contact.company, contact.phone].filter(Boolean).join(" · ")}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {contact.phone && btn(`tel:${contact.phone}`, "#1E8449", "📞 Call")}
        {contact.phone && btn(`sms:${contact.phone}`, "#1A5276", "💬 Text")}
        {contact.email && btn(`mailto:${contact.email}`, "#6b7280", "✉️ Email")}
      </div>
    </div>
  );
}

function TasksCard({ card }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, marginTop: 8 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 6 }}>{card.title}</div>
      {(card.items || []).length === 0 && <div style={{ fontSize: 13, color: "#6b7280" }}>Nothing here. 🎉</div>}
      {(card.items || []).slice(0, 8).map((t, i) => (
        <div key={i} style={{ padding: "6px 0", borderTop: i ? "1px solid #F3F4F6" : "none" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{t.title}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{[t.where, t.due && `due ${t.due}`].filter(Boolean).join(" · ")}</div>
        </div>
      ))}
      {(card.items || []).length > 8 && (
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>…and {card.items.length - 8} more on Win the Day.</div>
      )}
    </div>
  );
}

function DealCard({ card, onOpenDeal }) {
  const d = card.deal || {};
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, marginTop: 8 }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>🏠 {d.address}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
        {[d.status, d.closingDate && `closing ${d.closingDate}`, d.price && `$${Number(d.price).toLocaleString()}`].filter(Boolean).join(" · ")}
      </div>
      <button onClick={() => onOpenDeal(d.id, card.tab)} style={{ marginTop: 10, width: "100%", background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "10px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
        Open this deal →
      </button>
    </div>
  );
}

function HelpCard({ card, onNavigate }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, marginTop: 8 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: NAVY, marginBottom: 6 }}>📘 {card.title}</div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {(card.steps || []).map((s, i) => (
          <li key={i} style={{ fontSize: 13, color: "#374151", marginBottom: 5, lineHeight: 1.45 }}>{s}</li>
        ))}
      </ol>
      {card.target && (
        <button onClick={() => onNavigate(card.target)} style={{ marginTop: 8, background: "#EFF6FF", color: "#1A5276", border: "1px solid #BFDBFE", borderRadius: 8, padding: "8px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Take me there →
        </button>
      )}
    </div>
  );
}

function CreateTaskCard({ card, token, onSpokenConfirm }) {
  const [state, setState] = useState("idle"); // idle | saving | done | cancelled | error
  const t = card.task || {};
  if (state === "done") {
    return <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: 12, marginTop: 8, fontSize: 13, fontWeight: 700, color: "#166534" }}>✓ Task added — it's on your Win the Day.</div>;
  }
  if (state === "cancelled") {
    return <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 12, marginTop: 8, fontSize: 13, color: "#6b7280" }}>Task discarded.</div>;
  }
  const save = async () => {
    setState("saving");
    try {
      const r = await fetch(API + "/personal-tasks", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ title: t.title, notes: t.notes || null, due_date: t.due_date || null, category: t.category || null }),
      });
      if (!r.ok) throw new Error("save failed");
      window.dispatchEvent(new Event("wintheday:refresh"));
      setState("done");
      if (onSpokenConfirm) onSpokenConfirm("Task added.");
    } catch {
      setState("error");
    }
  };
  return (
    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: 14, marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.04em" }}>New task — confirm to add</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginTop: 6 }}>{t.title}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{[t.due_date ? `Due ${t.due_date}` : "No due date", t.category].filter(Boolean).join(" · ")}</div>
      {state === "error" && <div style={{ fontSize: 12, color: RED, marginTop: 6 }}>Couldn't save — try again.</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => setState("cancelled")} disabled={state === "saving"} style={{ flex: 1, background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 8, padding: "9px 10px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        <button onClick={save} disabled={state === "saving"} style={{ flex: 2, background: "#1E8449", color: "#fff", border: "none", borderRadius: 8, padding: "9px 10px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          {state === "saving" ? "Saving…" : "✓ Add task"}
        </button>
      </div>
    </div>
  );
}

// Shared shell for proposal cards: amber "review & confirm" box with
// Cancel + confirm buttons, mirroring CreateTaskCard's states.
function ProposalCard({ badge, confirmLabel, doneText, spokenText, body, doAction, onSpokenConfirm, danger = false }) {
  const [state, setState] = useState("idle"); // idle | saving | done | cancelled | error
  if (state === "done") {
    return <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: 12, marginTop: 8, fontSize: 13, fontWeight: 700, color: "#166534" }}>✓ {doneText}</div>;
  }
  if (state === "cancelled") {
    return <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 12, marginTop: 8, fontSize: 13, color: "#6b7280" }}>Discarded.</div>;
  }
  const run = async () => {
    setState("saving");
    try {
      await doAction();
      setState("done");
      if (onSpokenConfirm) onSpokenConfirm(spokenText);
    } catch { setState("error"); }
  };
  return (
    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: 14, marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.04em" }}>{badge}</div>
      {body}
      {state === "error" && <div style={{ fontSize: 12, color: RED, marginTop: 6 }}>Couldn't do that — try again.</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => setState("cancelled")} disabled={state === "saving"} style={{ flex: 1, background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 8, padding: "9px 10px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        <button onClick={run} disabled={state === "saving"} style={{ flex: 2, background: danger ? RED : "#1E8449", color: "#fff", border: "none", borderRadius: 8, padding: "9px 10px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          {state === "saving" ? "Working…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}

// draft_email — the FULL draft is shown (recipient, subject, body) and
// NOTHING sends until the agent taps Send.
function DraftEmailCard({ card, token, onSpokenConfirm }) {
  const e = card.email || {};
  if (!e.toEmail || !e.message) return null;
  return (
    <ProposalCard
      badge="Email draft — review, then send"
      confirmLabel="✉️ Send email"
      doneText={`Sent to ${e.toName || e.toEmail}.`}
      spokenText="Email sent."
      onSpokenConfirm={onSpokenConfirm}
      body={
        <>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>To: <b style={{ color: "#111" }}>{e.toName || ""}</b> {e.toEmail}</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: NAVY, marginTop: 4 }}>{e.subject || "(no subject)"}</div>
          <div style={{ fontSize: 12.5, color: "#374151", marginTop: 6, whiteSpace: "pre-wrap", background: "#fff", border: "1px solid #F3E8C8", borderRadius: 8, padding: 10, maxHeight: 180, overflowY: "auto" }}>{e.message}</div>
        </>
      }
      doAction={async () => {
        const r = await fetch(API + "/email/send", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: e.transactionId || null, toEmail: e.toEmail, toName: e.toName || "", toRole: e.toRole || "", subject: e.subject || "", message: e.message }),
        });
        if (!r.ok) throw new Error("send failed");
      }}
    />
  );
}

// start_chase — recurring polite follow-up until resolved; agent confirms.
function StartChaseCard({ card, token, onSpokenConfirm }) {
  const c = card.chase || {};
  if (!c.transactionId || !c.targetEmail) return null;
  return (
    <ProposalCard
      badge="Follow-up chase — confirm to start"
      confirmLabel="🔁 Start follow-up"
      doneText={`Chasing ${c.targetName || c.targetEmail} until it's done.`}
      spokenText="Follow-up started."
      onSpokenConfirm={onSpokenConfirm}
      body={
        <>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginTop: 6 }}>{c.subject || "Follow-up"}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Nags {c.targetName || c.targetEmail} politely until resolved — stop it anytime from the deal's Active Follow-Ups.</div>
          {c.message && <div style={{ fontSize: 12.5, color: "#374151", marginTop: 6, whiteSpace: "pre-wrap", background: "#fff", border: "1px solid #F3E8C8", borderRadius: 8, padding: 10, maxHeight: 140, overflowY: "auto" }}>{c.message}</div>}
        </>
      }
      doAction={async () => {
        const r = await fetch(API + "/chases/start", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: c.transactionId, targetType: "general", targetEmail: c.targetEmail, subject: c.subject || "", customMessage: c.message || "" }),
        });
        if (!r.ok) throw new Error("chase failed");
      }}
    />
  );
}

// log_call — records a call outcome on a contact (drives their cadence).
const CALL_OUTCOME_LABELS = {
  spoke_interested: "Spoke — interested", spoke_not_now: "Spoke — not now", left_vm: "Left voicemail",
  no_answer: "No answer", wrong_number: "Wrong number", meeting_set: "Meeting set", text_sent: "Text sent", dnc: "Do not contact",
};
function LogCallCard({ card, token, onSpokenConfirm }) {
  const c = card.call || {};
  if (!c.contactId || !c.outcome) return null;
  return (
    <ProposalCard
      badge="Log this call — confirm"
      confirmLabel="📞 Log call"
      doneText={`Call logged for ${c.contactName || "contact"}.`}
      spokenText="Call logged."
      onSpokenConfirm={onSpokenConfirm}
      body={
        <>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginTop: 6 }}>{c.contactName || "Contact"} — {CALL_OUTCOME_LABELS[c.outcome] || c.outcome}</div>
          {c.notes && <div style={{ fontSize: 12.5, color: "#374151", marginTop: 4 }}>{c.notes}</div>}
        </>
      }
      doAction={async () => {
        const r = await fetch(API + "/contacts/" + c.contactId + "/log-call", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ outcome: c.outcome, notes: c.notes || "" }),
        });
        if (!r.ok) throw new Error("log failed");
      }}
    />
  );
}

// app_action — a server-validated catalog action (add note, complete a step,
// schedule, waive, reminder, status change…). The server already resolved
// method/path/body from its whitelist; we show the plain-language summary
// and execute only on the confirm tap.
function AppActionCard({ card, token, onSpokenConfirm }) {
  if (!card.method || !card.path || !card.summary) return null;
  return (
    <ProposalCard
      badge={card.danger ? "Confirm this change" : "Confirm to do this"}
      confirmLabel={card.confirmLabel || "✓ Do it"}
      doneText={card.doneText || "Done."}
      spokenText="Done."
      danger={!!card.danger}
      onSpokenConfirm={onSpokenConfirm}
      body={<div style={{ fontWeight: 700, fontSize: 14, color: NAVY, marginTop: 6 }}>{card.summary}</div>}
      doAction={async () => {
        const r = await fetch(API + card.path, {
          method: card.method,
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify(card.body || {}),
        });
        if (!r.ok) throw new Error("action failed");
        // Both: the task counter, and the loaded deals — a confirmed action
        // changes the database, and the screen behind this panel is still
        // showing what it loaded earlier.
        window.dispatchEvent(new Event("wintheday:refresh"));
        window.dispatchEvent(new Event("deals:refresh"));
      }}
    />
  );
}

function Card({ card, token, onOpenDeal, onNavigate, onSend, onSpokenConfirm }) {
  if (!card || !card.type) return null;
  switch (card.type) {
    case "contact":
      return <ContactCard contact={card.contact || {}} />;
    case "choices":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {(card.options || []).slice(0, 6).map((o, i) => (
            <button key={i} onClick={() => onSend(o.send || o.label)} style={{ textAlign: "left", background: "#fff", border: "1.5px solid " + NAVY, color: NAVY, borderRadius: 10, padding: "10px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {o.label}
            </button>
          ))}
        </div>
      );
    case "tasks":
      return <TasksCard card={card} />;
    case "deal":
      return <DealCard card={card} onOpenDeal={onOpenDeal} />;
    case "navigate":
      return (
        <button onClick={() => onNavigate(card.target)} style={{ marginTop: 8, background: "#fff", border: "1.5px solid " + NAVY, color: NAVY, borderRadius: 10, padding: "10px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "block" }}>
          {card.label || "Open"}
        </button>
      );
    case "create_task":
      return <CreateTaskCard card={card} token={token} onSpokenConfirm={onSpokenConfirm} />;
    case "draft_email":
      return <DraftEmailCard card={card} token={token} onSpokenConfirm={onSpokenConfirm} />;
    case "start_chase":
      return <StartChaseCard card={card} token={token} onSpokenConfirm={onSpokenConfirm} />;
    case "log_call":
      return <LogCallCard card={card} token={token} onSpokenConfirm={onSpokenConfirm} />;
    case "app_action":
      return <AppActionCard card={card} token={token} onSpokenConfirm={onSpokenConfirm} />;
    case "help":
      return <HelpCard card={card} onNavigate={onNavigate} />;
    default:
      return null;
  }
}

// ————— The panel ————————————————————————————————————————————————

export default function AssistantPanel({ token, contacts, transactions, currentView, currentDealAddress, onOpenDeal, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);      // { role: "user"|"assistant", text, cards }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");   // live transcript while talking
  const [micNote, setMicNote] = useState(null); // mic error/help text
  const [recording, setRecording] = useState(false);     // MediaRecorder fallback active
  const [transcribing, setTranscribing] = useState(false);
  const [micStarting, setMicStarting] = useState(false);  // instant tap feedback while the mic opens
  const [streamText, setStreamText] = useState("");      // answer text as it streams in
  // iOS asks for the mic once per visit no matter what the page does — the
  // only way to stop it is Safari's own per-site setting, so say so once.
  const [iosTip, setIosTip] = useState(() => IS_IOS && localStorage.getItem("tp_assist_iostip") !== "off");
  // Sentence queue for the streamed answer: each finished sentence is spoken
  // while the next is still arriving, and `onDone` (re-open the mic) fires
  // only once the LAST one has finished playing.
  const ttsRef = useRef({ seq: 0, pending: 0, closed: true, onDone: null });
  // True while the app's OWN voice is playing with the mic already open (the
  // greeting). Anything the mic hears in that window is our speaker, not the
  // agent, so it gets discarded.
  const speakingRef = useRef(false);
  const meterRef = useRef(null);        // live microphone level
  const micStreamRef = useRef(null);    // the stream the meter reads
  const silenceTimerRef = useRef(null);   // auto-send after a real pause
  const finishRef = useRef(null);         // ends the current listen session and sends
  const listenRef = useRef(null);         // current listen session { final, interim, sent }
  // Hands-free conversation: one mic tap starts it, and after each spoken
  // reply the mic re-opens by itself — until the agent says they're done
  // (server sets end_conversation), types instead, closes the panel, or a
  // listen comes back empty.
  const convoRef = useRef(false);
  // Short-term context: what the last answer showed, so follow-ups like
  // "text her instead" / "which one?" / "open it" resolve without repeating.
  const memoryRef = useRef({ contacts: [], deals: [], choices: [], tasks: [] });
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const recTimerRef = useRef(null);
  const [speakOn, setSpeakOn] = useState(() => localStorage.getItem("tp_assist_speak") !== "off");
  // Hands-free by default: opening the panel opens the mic, so the agent can
  // just start talking. The 🎤/🤐 header button turns that off for people who
  // would rather tap the mic themselves (setting sticks per device).
  const [autoMic, setAutoMic] = useState(() => localStorage.getItem("tp_assist_automic") !== "off");
  const autoMicRef = useRef(true);
  autoMicRef.current = autoMic;
  const tasksRef = useRef(null);              // /dashboard/tasks snapshot (fetched on open)
  const recRef = useRef(null);
  const scrollRef = useRef(null);
  const openRef = useRef(false);
  openRef.current = open;
  // Read at call time, not closure time: the hands-free loop calls send()
  // through callbacks created during the PREVIOUS exchange, whose captured
  // `msgs` is stale — follow-ups like "can you walk me through?" were sent
  // with history that didn't include the answer they refer to.
  const msgsRef = useRef([]);
  msgsRef.current = msgs;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy, streamText]);

  // Chrome loads speechSynthesis voices async — warm the list.
  useEffect(() => { try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch {} }, []);

  const toggleSpeak = () => {
    setSpeakOn(prev => {
      const next = !prev;
      localStorage.setItem("tp_assist_speak", next ? "on" : "off");
      if (!next) stopSpeaking();
      return next;
    });
  };

  // Auto-listen off = the mic never opens by itself (and closes right now if
  // it's open). Turning it back on while the panel is open starts listening.
  const toggleAutoMic = () => {
    const next = !autoMic;
    setAutoMic(next);
    autoMicRef.current = next;
    localStorage.setItem("tp_assist_automic", next ? "on" : "off");
    if (!next) {
      convoRef.current = false;
      ttsRef.current.onDone = null;   // don't let a finishing reply re-open it
      cancelListening();
      stopRecording();
      releaseMicStream();
    } else if (openRef.current && !busy) {
      armMic();
    }
  };

  // Open the mic for a hands-free turn. Native recognizer ONLY: it hears the
  // pause and sends by itself, while the record-and-transcribe fallback runs
  // until it's tapped — auto-starting THAT would leave a hot mic on a panel
  // nobody is talking to. Fallback browsers tap 🎤 as before.
  const armMic = (opts) => {
    if (!autoMicRef.current || !openRef.current || !SR) return;
    startListening(opts);
  };

  const ttsStart = (onDone) => {
    stopSpeaking();
    const t = ttsRef.current;
    t.seq += 1; t.pending = 0; t.closed = false; t.onDone = onDone || null;
  };
  // Fire the turn's onDone only once the browser has ACTUALLY stopped
  // speaking. Re-opening the mic runs stopSpeaking(), so firing a moment early
  // silences the end of the answer.
  const ttsDrain = (seq, tries = 0) => {
    const t = ttsRef.current;
    if (t.seq !== seq || !t.onDone) return;
    let talking = false;
    try { talking = !!(window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)); } catch {}
    if (talking && tries < 240) { setTimeout(() => ttsDrain(seq, tries + 1), 250); return; }
    const f = t.onDone;
    t.onDone = null;
    f();
  };
  const ttsSay = (text) => {
    const t = ttsRef.current;
    const seq = t.seq;
    if (!text || !text.trim()) return;
    t.pending += 1;
    speak(text, () => {
      const cur = ttsRef.current;
      if (cur.seq !== seq) return;         // a newer turn took over
      cur.pending -= 1;
      if (cur.closed && cur.pending <= 0 && cur.onDone) ttsDrain(seq);
    }, { queue: true });
  };
  const ttsEnd = () => {
    const t = ttsRef.current;
    t.closed = true;
    if (t.pending <= 0 && t.onDone) ttsDrain(t.seq);
  };

  const refreshTasks = () => {
    fetch(API + "/dashboard/tasks", { headers: { Authorization: "Bearer " + token } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && d.success) tasksRef.current = d; })
      .catch(() => {});
  };

  const openPanel = () => {
    setOpen(true);
    openRef.current = true;   // armMic() runs before the next render
    refreshTasks();
    if (msgs.length === 0) {
      setMsgs([{ role: "assistant", text: GREETING, cards: [] }]);
    }
    // Auto-listen opens the mic in THIS tap, and the greeting plays over the
    // top of it — armMic() FIRST (startListening cancels any speech as it
    // starts, so greeting-then-mic would cut itself off), then greet. What the
    // open mic picks up from our own speaker is thrown away, see speakingRef.
    if (autoMicRef.current && SR) {
      // iOS only lets a page speak if speech was started from a tap, and the
      // greeting now plays from an async callback — so claim that right here,
      // inside the click, with a silent utterance.
      unlockSpeech();
      armMic({
        onReady: () => {
          if (!speakOn || !openRef.current) return;
          const live = listenRef.current;
          speakingRef.current = true;
          if (live) live.muted = true;      // deaf while we greet
          speak(GREETING, () => {
            speakingRef.current = false;
            if (live && !live.sent && live.restart) live.restart();
          });
        },
      });
      return;
    }
    if (speakOn) speak(GREETING);
  };

  const closePanel = () => {
    setOpen(false);
    openRef.current = false;
    setMicStarting(false);   // else a mid-open close blocks the NEXT open
    convoRef.current = false;
    ttsRef.current.seq += 1;          // orphan the streamed speech queue
    ttsRef.current.onDone = null;
    stopSpeaking();
    cancelListening();
    stopRecording();
    releaseMicStream();   // panel closed = mic goes cold, recording dot off
  };

  // ——— Voice input ———
  // Tapping ⏹ SENDS what was heard so far (people tap it meaning "I'm done
  // talking", not "throw that away").
  const stopListening = () => {
    if (finishRef.current) { finishRef.current(); return; }
    try { recRef.current && recRef.current.stop(); } catch {}
    setListening(false);
    setInterim("");
  };

  // Closing the panel mid-listen DISCARDS instead of sending.
  const cancelListening = () => {
    releaseMic();
    if (listenRef.current) listenRef.current.sent = true;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    try { recRef.current && recRef.current.stop(); } catch {}
    setListening(false);
    setInterim("");
  };

  // Unblock instructions differ by device — phones show a 🔒/AA icon, desktop
  // Chrome hides it behind the "tune" icon at the left end of the address bar.
  const IS_TOUCH = typeof navigator !== "undefined" && (navigator.maxTouchPoints > 0 || /iPhone|iPad|Android/i.test(navigator.userAgent));
  const MIC_BLOCKED_NOTE = IS_TOUCH
    ? "Your browser is blocking the microphone. Tap the 🔒 (or AA) icon next to the address bar → Microphone → Allow, then reload and try the mic again. Tip: the mic key on your phone's keyboard also dictates straight into the text box."
    : "Your browser is blocking the microphone. Click the small icon at the LEFT end of the address bar (before the site name) → turn Microphone on, or open “Site settings” → Microphone → Allow. Then reload this page and try again. On a Mac, also check System Settings → Privacy & Security → Microphone → allow your browser.";

  // getUserMedia can HANG (mic held by Zoom/FaceTime, flaky hardware) — race
  // it against a timeout so the tap always resolves to visible feedback. If
  // the stream arrives AFTER we gave up, release it, or the mic stays
  // captured (red-dot on, and the next attempt can wedge).
  const getMicStream = () => new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; reject(new Error("mic-timeout")); }, 8000);
    navigator.mediaDevices.getUserMedia({ audio: true }).then(
      stream => {
        if (timedOut) { try { stream.getTracks().forEach(t => t.stop()); } catch {} return; }
        clearTimeout(timer);
        resolve(stream);
      },
      err => { if (!timedOut) { clearTimeout(timer); reject(err); } }
    );
  });

  // A stuck "Starting the microphone…" must always self-clear: whatever path
  // hangs (browser bug, wedged device), the watchdog resets the UI so the
  // panel never looks dead.
  useEffect(() => {
    if (!micStarting) return;
    const t = setTimeout(() => {
      setMicStarting(false);
      setMicNote("The microphone is taking too long to start. Reload the page and try again — and check nothing else (Zoom, FaceTime) is holding the mic. You can always type your question.");
    }, 12000);
    return () => clearTimeout(t);
  }, [micStarting]);

  // Between turns we stop the LEVEL METER but keep the microphone stream open.
  // Asking for the mic again is what makes iOS Safari re-prompt ("would like
  // to access the microphone") — once per question is unusable, so one grant
  // has to cover the whole conversation.
  const releaseMic = () => {
    try { meterRef.current && meterRef.current.stop(); } catch {}
    meterRef.current = null;
  };

  // Full release — the mic actually goes cold (and the phone's recording dot
  // goes out). Only when the panel closes or voice is switched off.
  const releaseMicStream = () => {
    releaseMic();
    try { micStreamRef.current && micStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
    micStreamRef.current = null;
  };

  // The one grant, reused. Re-asks only if the tracks died (tab backgrounded,
  // device switched, another app took the mic).
  const acquireMic = async () => {
    const held = micStreamRef.current;
    if (held && held.getTracks().some(t => t.readyState === "live")) return held;
    if (held) releaseMicStream();
    const stream = await getMicStream();
    micStreamRef.current = stream;
    return stream;
  };

  const startListening = async ({ onReady } = {}) => {
    if (!SR) return;
    // Re-entrancy guard: a second tap while the mic is still opening used to
    // start a SECOND recognizer (Chrome then throws, and the two sessions
    // fight). One voice flow at a time. (Ref check too — this can be called
    // from a speech-end callback whose state snapshot is stale.)
    if (micStarting || listening || recording) return;
    if (listenRef.current && !listenRef.current.sent) return;
    convoRef.current = true;
    stopSpeaking();
    setMicNote(null);
    setMicStarting(true);
    // Ask for the mic explicitly BEFORE starting recognition: this forces the
    // browser's permission prompt to appear now, and lets us explain when
    // it's blocked — the recognizer alone fails silently on many phones
    // (the original "I click the mic and nothing happens" bug).
    releaseMic();
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // Kept open across the whole conversation (see acquireMic): the level
        // meter reads this stream to tell "still talking" from "finished
        // talking". The recognizer captures separately and is unaffected.
        const stream = await acquireMic();
        if (METER_OFF) releaseMicStream();   // device refused sharing — hand it straight back
        else meterRef.current = startVoiceMeter(stream);
      } catch (err) {
        setMicStarting(false);
        setMicNote(err && err.message === "mic-timeout"
          ? "The microphone didn't respond — another app (Zoom, FaceTime, Teams?) may be using it. Close that app or restart the browser, then try again."
          : MIC_BLOCKED_NOTE);
        return;
      }
    }
    setMicStarting(false);
    try {
      const rec = new SR();
      recRef.current = rec;
      rec.lang = "en-US";
      rec.continuous = true;       // do NOT cut off at the first brief pause
      rec.interimResults = true;   // show words as they're heard — proof it's working
      rec.maxAlternatives = 1;

      // The browser's recognizer ends ITSELF at small pauses, mid-sentence —
      // that was the "cuts me off too fast" bug. So the recognizer is treated
      // as disposable: whenever it self-ends while the agent is still mid-
      // turn, it is silently RESTARTED and the words keep accumulating in
      // `base`. The ONLY things that end the turn are OUR pause timer
      // (~3s after the last words heard), the ⏹ tap, or the 90s cap.
      // `muted` = the greeting is still playing through the speaker, so
      // ignore everything the mic hears; when it finishes we RESTART the
      // recognizer, which is the only reliable way to drop what it already
      // transcribed (result indexes keep growing into the user's own speech,
      // so skipping by index swallowed the first thing they said).
      const session = { base: "", final: "", interim: "", sent: false, muted: !!speakingRef.current, wipe: false, startedAt: Date.now() };
      listenRef.current = session;
      const heardText = () => (session.base + " " + session.final + " " + session.interim).replace(/\s+/g, " ").trim();
      const finish = () => {
        if (session.sent) return;
        session.sent = true;
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        finishRef.current = null;
        setListening(false);
        setInterim("");
        try { rec.stop(); } catch {}
        releaseMic();
        const text = heardText();
        if (text) send(text, { voice: true });
        else if (Date.now() - session.startedAt < 4000) {
          // Nothing heard within a blink of opening: that is a bug or a
          // stumble, not a quiet room. Keep listening instead of scolding.
          session.sent = false;
          setListening(true);
          try { rec.start(); } catch {}
          armSilence(QUIET_CLOSE_MS);
          if (!meterRef.current && !METER_OFF && navigator.mediaDevices) {
            acquireMic().then(st => {
              if (session.sent) return;
              meterRef.current = startVoiceMeter(st);
            }).catch(() => {});
          }
        } else {
          // Quiet room — say so out loud and let go of the mic, instead of
          // leaving it open (and the recording light on) indefinitely.
          convoRef.current = false;
          setMicNote("I didn't hear anything, so I closed the mic — tap 🎤 whenever you need me.");
          if (speakOn) speak(SIGN_OFF);
        }
      };
      finishRef.current = finish;
      // Called when the greeting stops playing: throw away everything the mic
      // picked up of it and listen again from scratch.
      session.restart = () => {
        if (session.sent) return;
        session.wipe = true;
        setInterim("");
        armSilence(QUIET_CLOSE_MS);
        try { rec.stop(); } catch { session.muted = false; }
      };
      // Ending the turn takes TWO things: the recognizer has been quiet for a
      // beat, AND the microphone itself has gone silent. The timer alone used
      // to cut people off mid-sentence, because the recognizer finalizes a
      // phrase at every ordinary thinking pause.
      const schedule = (ms) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(tick, ms);
      };
      function tick() {
        const m = meterRef.current;
        const need = session.needQuiet || 0;
        if (m && need) {
          const quietFor = Date.now() - m.lastVoiceAt;
          // Still making sound — they're mid-thought. Keep listening, up to a
          // ceiling so a noisy room can't hold the turn open forever.
          if (quietFor < need && Date.now() - (session.waitStart || 0) < 10000) { schedule(200); return; }
        }
        finish();
      }
      // ms of quiet required before the turn ends.
      const armSilence = (ms, needQuiet = 0) => {
        session.needQuiet = needQuiet;
        session.waitStart = Date.now();
        schedule(ms);
      };

      rec.onresult = (e) => {
        let finalText = "", interimText = "";
        // Still our own voice playing — hear nothing, keep the long timer.
        if (session.muted) {
          session.base = "";
          setInterim("");
          armSilence(QUIET_CLOSE_MS);
          return;
        }
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
          else interimText += e.results[i][0].transcript;
        }
        session.final = finalText;
        session.interim = interimText;
        setInterim(heardText());
        // How long to wait before deciding the thought is done. The browser
        // only FINALIZES a phrase once it hears you stop, so a finalized
        // result with nothing still pending means we can send almost
        // immediately — that flat 3.5s wait was most of the "why is it taking
        // so long to answer me" delay. Words still being transcribed
        // (interim) get a longer beat so mid-sentence pauses don't cut in.
        // Finalized phrase with nothing pending: a short beat is enough — but
        // only counted from when the mic actually falls silent. Words still
        // being transcribed get a longer one.
        armSilence(interimText.trim() ? 1400 : 900, interimText.trim() ? 1400 : 900);
      };
      rec.onerror = (e) => {
        const code = (e && e.error) || "";
        // no-speech just means a quiet stretch — onend will restart us; the
        // pause/12s timers decide when the turn is really over.
        if (code === "no-speech" || code === "aborted") return;
        if (heardText()) { finish(); return; }  // salvage what we already got
        session.sent = true;
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        finishRef.current = null;
        setListening(false);
        setInterim("");
        if (code === "not-allowed" || code === "service-not-allowed") setMicNote(MIC_BLOCKED_NOTE);
        else if (code === "audio-capture") {
          // Holding the stream for the level meter can starve the recognizer
          // on some devices — give it the mic back and try once more.
          if (meterRef.current && !METER_OFF) {
            METER_OFF = true;
            releaseMicStream();   // hand the device back before retrying
            setTimeout(() => { if (openRef.current) startListening(); }, 250);
          } else setMicNote("No working microphone was found on this device.");
        }
        else {
          // Recognizer broke for a non-permission reason (e.g. its speech
          // service is unreachable in this browser). Hand off to the
          // record-and-transcribe fallback instead of giving up.
          if (CAN_RECORD) startRecording();
          else setMicNote("Voice input didn't start. Tip: the mic key on your phone's keyboard dictates straight into the text box.");
        }
      };
      rec.onend = () => {
        if (session.sent) return;
        if (session.wipe) {
          // Restart after the greeting: keep nothing, and un-mute — from here
          // on the only voice the mic hears is the agent's.
          session.wipe = false;
          session.muted = false;
          session.base = "";
        } else {
          // Self-ended mid-turn: bank the finalized words, restart, keep going.
          session.base = (session.base + " " + session.final + " " + session.interim).replace(/\s+/g, " ").trim();
        }
        session.final = "";
        session.interim = "";
        try { rec.start(); }
        catch {
          setTimeout(() => {
            if (session.sent) return;
            try { rec.start(); } catch { finish(); }
          }, 150);
        }
      };
      rec.start();
      setListening(true);
      // The mic is granted and live — safe to talk now. (Speaking BEFORE this
      // point means the permission dialog interrupts our own voice: iOS pauses
      // the page while it is up and the greeting is lost mid-word.)
      if (onReady) onReady();
      armSilence(QUIET_CLOSE_MS);
      // Absolute cap so a mic left open in a noisy room can't run forever.
      setTimeout(finish, 120000);
    } catch {
      setListening(false);
      if (CAN_RECORD) startRecording();
      else setMicNote("Voice input isn't available in this browser. Tip: the mic key on your phone's keyboard dictates straight into the text box.");
    }
  };

  // ——— Record-and-transcribe fallback (works in every modern browser) ———
  const stopRecording = () => {
    if (recTimerRef.current) { clearTimeout(recTimerRef.current); recTimerRef.current = null; }
    try {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
    } catch {}
  };

  const startRecording = async () => {
    // Guard double-taps (recording/micStarting), but NOT on `listening` — the
    // recognizer's error path hands off to this fallback in the same tick it
    // clears listening, and that state value is still stale here.
    if (recording || micStarting) return;
    stopSpeaking();
    setMicNote(null);
    setMicStarting(true);
    let stream;
    try {
      stream = await acquireMic();
    } catch (err) {
      setMicStarting(false);
      setMicNote(err && err.message === "mic-timeout"
        ? "The microphone didn't respond — another app (Zoom, FaceTime, Teams?) may be using it. Close that app or restart the browser, then try again."
        : MIC_BLOCKED_NOTE);
      return;
    }
    setMicStarting(false);
    try {
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
        .find(m => window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        setRecording(false);   // stream stays open — re-asking re-prompts on iOS
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 1500) { setMicNote("I didn't catch any audio — tap the mic, speak, then tap it again when you're done."); return; }
        setTranscribing(true);
        try {
          const audio = await blobToBase64(blob);
          const r = await fetch(API + "/assistant/transcribe", {
            method: "POST",
            headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
            body: JSON.stringify({ audio, mime: blob.type }),
          });
          const d = r.ok ? await r.json() : null;
          setTranscribing(false);
          if (d && d.success && d.text && d.text.trim()) {
            send(d.text.trim(), { voice: true });
          } else {
            setMicNote("Voice isn't fully set up for this browser yet. You can still type, or dictate with the mic key on your keyboard.");
          }
        } catch {
          setTranscribing(false);
          setMicNote("Couldn't reach the voice service — check your connection, or type your question.");
        }
      };
      mr.start();
      setRecording(true);
      // Hard stop at 30s so a forgotten mic never records indefinitely.
      recTimerRef.current = setTimeout(stopRecording, 30000);
    } catch {
      releaseMicStream();
      setMicNote("Voice input isn't available in this browser. You can still type, or dictate with the mic key on your keyboard.");
    }
  };

  // ——— Snapshot the server brain reasons over ———
  const buildSnapshot = () => {
    const tasks = tasksRef.current || {};
    return {
      contacts: (contacts || []).slice(0, 400).map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, role: c.role, company: c.company })),
      // Per deal: include the people (title company, lender, ...) and the next
      // open step — the list endpoint already ships them, and "who is the title
      // company on X?" should never need a server lookup. Dates trimmed to
      // YYYY-MM-DD so the voice reply never reads an ISO timestamp aloud.
      deals: (transactions || []).slice(0, 150).map(t => ({
        id: t.id, address: t.address, status: t.status,
        closingDate: String(t.closingDate || t.closing_date || "").slice(0, 10),
        price: t.listPrice || t.price || "", type: t.type || "",
        parties: (t.parties || []).slice(0, 14).map(p => ({ role: p.role, name: p.name, company: p.company, phone: p.phone, email: p.email })),
        nextStep: t.next_milestone ? { name: t.next_milestone.name, due: t.next_milestone.dueDate || t.next_milestone.due_date || "" } : undefined,
      })),
      tasks: {
        overdue: (tasks.overdue || []).slice(0, 40),
        dueToday: (tasks.dueToday || []).slice(0, 40),
        personal: {
          overdue: ((tasks.personal && tasks.personal.overdue) || []).slice(0, 20),
          dueToday: ((tasks.personal && tasks.personal.dueToday) || []).slice(0, 20),
        },
      },
    };
  };

  const localCtx = () => ({
    contacts: contacts || [],
    deals: (transactions || []).map(t => ({ id: t.id, address: t.address, status: t.status, closingDate: t.closingDate || t.closing_date || "", price: t.listPrice || t.price || "" })),
    tasks: tasksRef.current || {},
    guides: GUIDE_SECTIONS,
    now: new Date(),
  });

  const send = async (raw, { voice = false } = {}) => {
    const text = String(raw || "").trim();
    if (!text || busy) return;
    if (!voice) convoRef.current = false;  // typing = taking over manually
    stopSpeaking();
    setMicNote(null);
    setInput("");
    setBusy(true);
    setMsgs(prev => [...prev, { role: "user", text, cards: [] }]);

    let out = null;
    let fromServer = false;
    let spokenLive = false;   // the streamed answer was already read aloud
    // Reply aloud when the agent talked to us, or whenever voice replies are on.
    const wantSpeech = voice || speakOn;
    const history = msgsRef.current.slice(-8).map(m => ({ role: m.role, text: m.text }));
    const body = JSON.stringify({
      message: text,
      history,
      context: { screen: currentView || "", dealAddress: currentDealAddress || "", voice: !!voice },
      snapshot: buildSnapshot(),
    });
    const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
    // The server brain may do several lookups for a hard question, but the
    // panel must never hang on "Thinking…" — after 60s we abort and the
    // offline router answers what it can.
    const abort = new AbortController();
    const abortTimer = setTimeout(() => abort.abort(), 60000);

    // ——— Streamed answer: speak each sentence as it lands ———
    try {
      const r = await fetch(API + "/assistant/stream", { method: "POST", headers, signal: abort.signal, body });
      if (!r.ok || !r.body) throw new Error("no stream");
      let acc = "";        // everything received
      let spoken = 0;      // how much of it has been handed to the voice
      if (wantSpeech) {
        spokenLive = true;
        ttsStart(() => { if (voice && convoRef.current && openRef.current) startListening(); });
      }
      // Speak only COMPLETE sentences — the trailing fragment waits for the
      // next chunk so the voice never stops mid-word. Address abbreviations
      // ("123 Main St. is Friday") are NOT sentence ends; splitting there
      // makes the voice pause in the middle of a thought.
      const flush = (last) => {
        if (!wantSpeech) return;
        const tail = acc.slice(spoken);
        if (!tail) return;
        if (last) { spoken += tail.length; ttsSay(tail); return; }
        const re = /[.!?…](?=[\s"')\]]|$)/g;
        let m, cut = -1;
        while ((m = re.exec(tail))) {
          if (SENTENCE_ABBR.test(tail.slice(0, m.index + 1))) continue;
          cut = m.index + 1;
        }
        if (cut < 0) return;
        const chunk = tail.slice(0, cut);
        if (!chunk.trim()) return;
        spoken += chunk.length;
        ttsSay(chunk);
      };
      const d = await readAnswerStream(r, (piece) => {
        acc += piece;
        setStreamText(acc);
        flush(false);
      });
      if (d && (d.reply || (d.cards && d.cards.length))) {
        // Speak whatever the last sentence-boundary left behind, then close
        // the queue so the mic re-opens after the final word.
        if (wantSpeech) {
          if (d.reply && d.reply.length > acc.length) { acc = d.reply; setStreamText(acc); }
          flush(true);
          ttsEnd();
        }
        out = { reply: d.reply || acc || "", speak: d.speak || d.reply || "", cards: Array.isArray(d.cards) ? d.cards : [], end_conversation: !!d.end_conversation };
        fromServer = true;
      } else if (wantSpeech) { ttsEnd(); }
    } catch {
      if (spokenLive) { stopSpeaking(); ttsRef.current.seq += 1; ttsRef.current.onDone = null; spokenLive = false; }
    }
    setStreamText("");

    // ——— Streaming unavailable (old build, proxy that buffers) → plain POST ———
    if (!out) {
      try {
        const r = await fetch(API + "/assistant", { method: "POST", headers, signal: abort.signal, body });
        if (r.ok) {
          const d = await r.json();
          if (d && (d.reply || (d.cards && d.cards.length))) {
            out = { reply: d.reply || "", speak: d.speak || d.reply || "", cards: Array.isArray(d.cards) ? d.cards : [], end_conversation: !!d.end_conversation };
            fromServer = true;
          }
        }
      } catch {}
    }
    clearTimeout(abortTimer);

    // Server brain unreachable → offline router (with short-term memory so
    // follow-ups like "text her instead" / "which one?" resolve).
    if (!out) {
      const local = routeLocal(text, localCtx(), memoryRef.current);
      out = local
        ? { reply: local.reply, speak: local.speak || local.reply, cards: local.cards || [] }
        : { reply: "I didn't catch that. " + OFFLINE_HINT, speak: "I didn't catch that — try asking me to dial a contact, show your tasks, or open a deal.", cards: [] };
    }

    // Remember what this answer showed, for the next follow-up.
    {
      const cards = out.cards || [];
      const mem = memoryRef.current;
      const shownContacts = cards.filter(c => c.type === "contact").map(c => c.contact).filter(Boolean);
      const shownDeals = cards.filter(c => c.type === "deal").map(c => c.deal).filter(Boolean);
      const shownTasks = cards.filter(c => c.type === "tasks").flatMap(c => c.items || []);
      memoryRef.current = {
        contacts: shownContacts.length ? shownContacts : mem.contacts,
        deals: shownDeals.length ? shownDeals : mem.deals,
        tasks: shownTasks.length ? shownTasks : mem.tasks,
        // choices are only "pending" for one turn — answered or abandoned.
        choices: cards.filter(c => c.type === "choices").flatMap(c => c.options || []),
      };
    }

    setMsgs(prev => [...prev, { role: "assistant", text: out.reply, cards: out.cards }]);
    setBusy(false);

    // Hands-free loop: when a VOICE question finishes being answered aloud,
    // re-open the mic for the next one — unless the conversation is over.
    // The server decides "over" (end_conversation) so a "no" answering a
    // clarifying question doesn't hang up; in offline mode a plain closing
    // phrase ends it.
    const saidDone = /^(no+|nope|no,?\s?(thanks|thank you)|that'?s\s?(all|it)|nothing(\s?else)?|i'?m\s?(good|done|all\s?set)|all\s?set|we'?re\s?done|goodbye|bye)[.!\s]*$/i.test(text);
    const endConvo = !!out.end_conversation || (!fromServer && saidDone);
    if (endConvo) convoRef.current = false;
    if (spokenLive) {
      // Already read aloud while it streamed — the mic re-opens from the
      // speech queue's own finish callback.
      if (endConvo) { ttsRef.current.onDone = null; }
    } else if (wantSpeech && openRef.current) {
      speak(out.speak, () => {
        if (voice && convoRef.current && openRef.current) startListening();
      });
    }
  };

  const spokenConfirm = (text) => { if (speakOn) speak(text); };

  // ——— Render ———
  return (
    <>
      {/* THE one help button. There used to be two FABs — this one and a red "?"
          Help button below it — which split help in half, and on phones a CSS
          rule threw the "?" to the opposite corner. The Help Center lost its
          floating button; this is the only one now, so it wears a "?" (a
          microphone reads as "record something", not "get help") with a small
          mic badge to show you can also talk to it.

          APPEARANCE ONLY. Everything below this button — openPanel, the mic,
          speak() — is the version that was working; three speculative "fixes"
          to that logic broke both the voice and the mic on desktop and have
          been reverted wholesale. Don't change behaviour here without a
          reproduction; use /voice-check.html to measure first. */}
      {!open && (
        <button
          onClick={openPanel}
          className="assist-fab"
          aria-label="Get help — ask the assistant"
          title="Stuck? Ask me anything — type it or say it"
          style={{ position: "fixed", bottom: 24, right: 24, width: 58, height: 58, borderRadius: "50%", background: `linear-gradient(135deg, ${NAVY}, #34506e)`, color: "#fff", border: "none", boxShadow: "0 6px 18px rgba(0,0,0,0.30)", cursor: "pointer", fontSize: 25, fontWeight: 800, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>
          ?
          <span aria-hidden="true" style={{ position: "absolute", right: -1, bottom: -1, width: 22, height: 22, borderRadius: "50%", background: "#fff", border: `2px solid ${NAVY}`, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>🎤</span>
        </button>
      )}

      {open && (
        <div style={{ position: "fixed", bottom: 12, right: 12, left: "max(12px, calc(100vw - 444px))", zIndex: 3500, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ background: "#F8F9FA", borderRadius: 16, boxShadow: "0 12px 48px rgba(0,0,0,0.3)", border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 24px))", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ background: NAVY, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 20 }}>🎙️</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Assistant</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>Type or talk — I can dial, show, and explain · {BUILD_TAG}</div>
              </div>
              {(SR || CAN_RECORD) && (
                <button onClick={toggleAutoMic}
                  title={autoMic ? "Mic opens automatically — tap to turn auto-listen off" : "Auto-listen OFF — tap to have the mic open by itself"}
                  style={{ background: autoMic ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.25)", border: "none", borderRadius: 8, padding: "6px 9px", fontSize: 16, cursor: "pointer" }}>
                  {autoMic ? "🎤" : "🤐"}
                </button>
              )}
              <button onClick={toggleSpeak} title={speakOn ? "Voice replies ON — tap to mute" : "Voice replies OFF — tap to unmute"}
                style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: "6px 9px", fontSize: 16, cursor: "pointer" }}>
                {speakOn ? "🔊" : "🔇"}
              </button>
              <button onClick={closePanel} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 22, cursor: "pointer", padding: "0 2px" }}>×</button>
            </div>

            {/* Conversation */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "88%", borderRadius: 14, padding: "9px 13px", fontSize: 14, lineHeight: 1.45,
                    background: m.role === "user" ? NAVY : "#fff",
                    color: m.role === "user" ? "#fff" : "#111",
                    border: m.role === "user" ? "none" : "1px solid #E5E7EB",
                  }}>
                    {m.text}
                  </div>
                  {m.role === "assistant" && (m.cards || []).map((c, j) => (
                    <div key={j} style={{ width: "100%", maxWidth: "94%" }}>
                      <Card card={c} token={token} onOpenDeal={(id, tab) => { closePanel(); onOpenDeal(id, tab); }} onNavigate={(t) => { closePanel(); onNavigate(t); }} onSend={send} onSpokenConfirm={spokenConfirm} />
                    </div>
                  ))}
                </div>
              ))}
              {streamText && (
                <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <div style={{ maxWidth: "88%", borderRadius: 14, padding: "9px 13px", fontSize: 14, lineHeight: 1.45, background: "#fff", color: "#111", border: "1px solid #E5E7EB" }}>
                    {streamText}
                  </div>
                </div>
              )}
              {busy && !streamText && <div style={{ fontSize: 13, color: "#6b7280", padding: "4px 2px" }}>Thinking…</div>}
              {listening && (
                <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "10px 12px", marginTop: 4 }}>
                  <div style={{ fontSize: 13, color: RED, fontWeight: 700 }}>● Listening — take all the time you need.</div>
                  <div style={{ fontSize: 12, color: "#9A3412", marginTop: 2 }}>I'll answer as soon as you stop talking — or tap <b>⏹ to send</b> right away.</div>
                  {interim && <div style={{ fontSize: 12.5, color: "#374151", marginTop: 6, fontStyle: "italic" }}>“{interim}”</div>}
                </div>
              )}
              {recording && (
                <div style={{ fontSize: 13, color: RED, fontWeight: 700, padding: "4px 2px" }}>
                  ● Recording — speak, then tap the mic again when you're done…
                </div>
              )}
              {transcribing && <div style={{ fontSize: 13, color: "#6b7280", padding: "4px 2px" }}>Writing down what you said…</div>}
              {micStarting && <div style={{ fontSize: 13, color: "#6b7280", padding: "4px 2px" }}>Starting the microphone…</div>}
              {iosTip && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "9px 11px", fontSize: 12, color: "#475569", lineHeight: 1.5, marginTop: 4 }}>
                  <div style={{ flex: 1 }}>
                    📱 iPhone asks for the microphone once each visit. To stop it asking, open the iPhone <b>Settings</b> app → <b>Safari</b> → scroll down to <b>Microphone</b> → <b>Allow</b>. (Newer iPhones: Settings → Apps → Safari.)
                  </div>
                  <button onClick={() => { setIosTip(false); localStorage.setItem("tp_assist_iostip", "off"); }}
                    style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
                </div>
              )}
              {micNote && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#7F1D1D", lineHeight: 1.5, marginTop: 4 }}>
                  🎤 {micNote}
                </div>
              )}
            </div>

            {/* Suggestion chips */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 12px 4px", flexShrink: 0 }}>
              {CHIPS.map(ch => (
                <button key={ch.label}
                  onClick={() => { if (ch.nav) { closePanel(); onNavigate(ch.nav); } else if (ch.send) send(ch.send); else setInput(ch.fill); }}
                  style={{ whiteSpace: "nowrap", background: "#fff", border: "1px solid #D1D5DB", borderRadius: 16, padding: "6px 11px", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
                  {ch.label}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div style={{ display: "flex", gap: 8, padding: "8px 12px 12px", alignItems: "center", flexShrink: 0 }}>
              {(SR || CAN_RECORD) && (
                <button
                  onClick={() => {
                    unlockSpeech();   // claim Safari's speak-from-a-tap right
                    if (listening) stopListening();
                    else if (recording) stopRecording();
                    else if (SR) startListening();
                    else startRecording();
                  }}
                  title={listening || recording ? "Stop" : "Talk instead of typing"}
                  style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: listening || recording ? RED : "#fff", color: listening || recording ? "#fff" : NAVY, border: listening || recording ? "none" : "1.5px solid " + NAVY, fontSize: 18, cursor: "pointer" }}>
                  {listening || recording ? "⏹" : "🎤"}
                </button>
              )}
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") send(input); }}
                placeholder='Try “dial Maria” or “what’s due today?”'
                style={{ flex: 1, padding: "11px 14px", borderRadius: 22, border: "1px solid #D1D5DB", fontSize: 14, fontFamily: "inherit", outline: "none", background: "#fff" }}
              />
              <button onClick={() => { unlockSpeech(); send(input); }} disabled={!input.trim() || busy}
                style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: input.trim() && !busy ? "#1E8449" : "#D1D5DB", color: "#fff", border: "none", fontSize: 17, cursor: input.trim() && !busy ? "pointer" : "default" }}>
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
