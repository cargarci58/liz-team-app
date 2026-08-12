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

const GREETING = "How can I help you today?";
const CHIPS = [
  { label: "📞 Dial someone", send: "" , fill: "call " },
  { label: "✅ Today's tasks", send: "What are my tasks today?" },
  { label: "🏠 Deal status", send: "", fill: "what's the status of " },
  { label: "💬 Unread messages", send: "Do I have unread messages?" },
  { label: "📝 Add a task", send: "", fill: "remind me to " },
  { label: "❓ How do I…", send: "", fill: "how do I " },
];

const OFFLINE_HINT =
  "I can dial a contact (“call Maria”), show your tasks (“what's due today?”), open a deal (“open Palm Ave”), add a reminder (“remind me to call the lender tomorrow”), or explain the app (“how do I share a document?”).";

// Condensed Help Center guides — sent to the server brain and used by the
// offline router. Static, computed once.
const GUIDES = GUIDE_SECTIONS.map(sec => ({
  heading: sec.heading,
  items: (sec.items || []).map(g => ({ title: g.title, steps: g.steps || [] })),
}));

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

function speak(text, onDone) {
  try {
    if (!window.speechSynthesis || !text) { if (onDone) onDone(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.04;
    // Prefer a natural-sounding en-US voice when the device has one.
    const voices = window.speechSynthesis.getVoices() || [];
    const preferred =
      voices.find(v => /en[-_]US/i.test(v.lang) && /natural|premium|enhanced|neural|samantha|google us/i.test(v.name)) ||
      voices.find(v => /en[-_]US/i.test(v.lang));
    if (preferred) u.voice = preferred;
    if (onDone) { u.onend = onDone; u.onerror = onDone; }
    window.speechSynthesis.speak(u);
  } catch { if (onDone) onDone(); }
}

function stopSpeaking() {
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
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
  const [speakOn, setSpeakOn] = useState(() => localStorage.getItem("tp_assist_speak") !== "off");
  const tasksRef = useRef(null);              // /dashboard/tasks snapshot (fetched on open)
  const recRef = useRef(null);
  const scrollRef = useRef(null);
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

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

  const refreshTasks = () => {
    fetch(API + "/dashboard/tasks", { headers: { Authorization: "Bearer " + token } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && d.success) tasksRef.current = d; })
      .catch(() => {});
  };

  const openPanel = () => {
    setOpen(true);
    refreshTasks();
    if (msgs.length === 0) {
      setMsgs([{ role: "assistant", text: GREETING, cards: [] }]);
    }
    if (speakOn) speak(GREETING);
  };

  const closePanel = () => {
    setOpen(false);
    stopSpeaking();
    stopListening();
  };

  // ——— Voice input ———
  const stopListening = () => {
    try { recRef.current && recRef.current.stop(); } catch {}
    setListening(false);
    setInterim("");
  };

  const MIC_BLOCKED_NOTE =
    "Your browser is blocking the microphone. Tap the 🔒 (or AA) icon next to the address bar → Microphone → Allow, then try the mic again. Tip: the mic key on your phone's keyboard also dictates straight into the text box.";

  const startListening = async () => {
    if (!SR) return;
    stopSpeaking();
    setMicNote(null);
    // Ask for the mic explicitly BEFORE starting recognition: this forces the
    // browser's permission prompt to appear now, and lets us explain when
    // it's blocked — the recognizer alone fails silently on many phones
    // (the original "I click the mic and nothing happens" bug).
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      } catch {
        setMicNote(MIC_BLOCKED_NOTE);
        return;
      }
    }
    try {
      const rec = new SR();
      recRef.current = rec;
      rec.lang = "en-US";
      rec.interimResults = true;   // show words as they're heard — proof it's working
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let finalText = "", interimText = "";
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
          else interimText += e.results[i][0].transcript;
        }
        if (finalText.trim()) {
          setListening(false);
          setInterim("");
          try { rec.stop(); } catch {}
          send(finalText.trim(), { voice: true });
        } else {
          setInterim(interimText);
        }
      };
      rec.onerror = (e) => {
        setListening(false);
        setInterim("");
        const code = (e && e.error) || "";
        if (code === "not-allowed" || code === "service-not-allowed") setMicNote(MIC_BLOCKED_NOTE);
        else if (code === "no-speech") setMicNote("I didn't hear anything — tap the mic and start talking right away.");
        else if (code === "audio-capture") setMicNote("No working microphone was found on this device.");
        else if (code === "network") setMicNote("Voice recognition couldn't reach its service — check your connection, or use the mic key on your keyboard to dictate into the text box.");
        else if (code !== "aborted") setMicNote("Voice input didn't start. Tip: the mic key on your phone's keyboard dictates straight into the text box.");
      };
      rec.onend = () => { setListening(false); setInterim(""); };
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setMicNote("Voice input isn't available in this browser. Tip: the mic key on your phone's keyboard dictates straight into the text box.");
    }
  };

  // ——— Snapshot the server brain reasons over ———
  const buildSnapshot = () => {
    const tasks = tasksRef.current || {};
    return {
      contacts: (contacts || []).slice(0, 400).map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, role: c.role, company: c.company })),
      deals: (transactions || []).slice(0, 150).map(t => ({ id: t.id, address: t.address, status: t.status, closingDate: t.closingDate || t.closing_date || "", price: t.listPrice || t.price || "", type: t.type || "" })),
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
    stopSpeaking();
    setMicNote(null);
    setInput("");
    setBusy(true);
    setMsgs(prev => [...prev, { role: "user", text, cards: [] }]);

    let out = null;
    try {
      const history = msgs.slice(-8).map(m => ({ role: m.role, text: m.text }));
      const r = await fetch(API + "/assistant", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          context: { screen: currentView || "", dealAddress: currentDealAddress || "" },
          snapshot: buildSnapshot(),
          guides: GUIDES,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d && (d.reply || (d.cards && d.cards.length))) {
          out = { reply: d.reply || "", speak: d.speak || d.reply || "", cards: Array.isArray(d.cards) ? d.cards : [] };
        }
      }
    } catch {}

    // Server brain unreachable → offline router.
    if (!out) {
      const local = routeLocal(text, localCtx());
      out = local
        ? { reply: local.reply, speak: local.speak || local.reply, cards: local.cards || [] }
        : { reply: "I didn't catch that. " + OFFLINE_HINT, speak: "I didn't catch that — try asking me to dial a contact, show your tasks, or open a deal.", cards: [] };
    }

    setMsgs(prev => [...prev, { role: "assistant", text: out.reply, cards: out.cards }]);
    setBusy(false);
    if ((voice || speakOn) && openRef.current) speak(out.speak);
  };

  const spokenConfirm = (text) => { if (speakOn) speak(text); };

  // ——— Render ———
  return (
    <>
      {/* Floating launcher — sits ABOVE the red "?" Help button (bottom 24). */}
      {!open && (
        <button
          onClick={openPanel}
          title="Ask the AI assistant — type or talk"
          style={{ position: "fixed", bottom: 92, right: 24, width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${NAVY}, #34506e)`, color: "#fff", border: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.28)", cursor: "pointer", fontSize: 24, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          🎙️
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
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>Type or talk — I can dial, show, and explain</div>
              </div>
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
              {busy && <div style={{ fontSize: 13, color: "#6b7280", padding: "4px 2px" }}>Thinking…</div>}
              {listening && (
                <div style={{ fontSize: 13, color: RED, fontWeight: 700, padding: "4px 2px" }}>
                  ● Listening — go ahead…{interim && <span style={{ color: "#6b7280", fontWeight: 400 }}> “{interim}”</span>}
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
                  onClick={() => { if (ch.send) send(ch.send); else setInput(ch.fill); }}
                  style={{ whiteSpace: "nowrap", background: "#fff", border: "1px solid #D1D5DB", borderRadius: 16, padding: "6px 11px", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
                  {ch.label}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div style={{ display: "flex", gap: 8, padding: "8px 12px 12px", alignItems: "center", flexShrink: 0 }}>
              {SR && (
                <button onClick={listening ? stopListening : startListening} title={listening ? "Stop listening" : "Talk instead of typing"}
                  style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: listening ? RED : "#fff", color: listening ? "#fff" : NAVY, border: listening ? "none" : "1.5px solid " + NAVY, fontSize: 18, cursor: "pointer" }}>
                  🎤
                </button>
              )}
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") send(input); }}
                placeholder='Try “dial Maria” or “what’s due today?”'
                style={{ flex: 1, padding: "11px 14px", borderRadius: 22, border: "1px solid #D1D5DB", fontSize: 14, fontFamily: "inherit", outline: "none", background: "#fff" }}
              />
              <button onClick={() => send(input)} disabled={!input.trim() || busy}
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
