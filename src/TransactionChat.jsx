import { useState, useEffect, useRef } from "react";
import { io as socketIo } from "socket.io-client";

const API = "https://liz-team-server-api-production.up.railway.app";
const WS_URL = "https://liz-team-server-api-production.up.railway.app";

// One shared AudioContext for the whole module — creating a new one per beep
// triggers browser throttling after ~6 concurrent contexts and leaks resources.
let __sharedAudioCtx = null;
function getAudioCtx() {
  if (!__sharedAudioCtx) {
    try { __sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return null; }
  }
  return __sharedAudioCtx;
}

function playSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function playSendSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

// Notification permission used to be requested at module load — that fires
// the scary browser permission popup on the LOGIN screen for new users.
// Moved to first chat open so the user has shown intent to use chat.
function ensureNotificationPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    try { Notification.requestPermission(); } catch {}
  }
}

// `simple` = embedded in the Messages tab (agent view): no notify picker.
// `directTo` = a party {name, email}: PRIVATE chat — only shows the directed
// messages between you and them, and everything you send is visible to them
// alone (notify_emails). Guests/clients (standalone or portal) keep the picker.
// Turn raw URLs in a chat message into clickable links (attachments shared via
// broadcast/vendor-share arrive as links — testers couldn't click them).
function linkifyMessage(text, mine) {
  if (!text) return text;
  return String(text).split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: mine ? "#fff" : "#1A5276", textDecoration: "underline", wordBreak: "break-all", fontWeight: 600 }}>{part}</a>
      : part
  );
}

export default function TransactionChat({ transactionId, user, parties = [], style, onUnreadChange, unreadCount = 0, clientView = false, simple = false, directTo = null, viewAsEmail = null }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [confirmAll, setConfirmAll] = useState(false); // guard before blasting everyone
  const socketRef = useRef(null);
  const endRef = useRef(null);
  const tok = localStorage.getItem("tp_token") || "";

  const getLastViewed = () => localStorage.getItem("chat_viewed_" + transactionId) || "1970-01-01T00:00:00.000Z";
  const markAsRead = () => localStorage.setItem("chat_viewed_" + transactionId, new Date().toISOString());

  const getMyId = () => {
    try { const u = JSON.parse(localStorage.getItem("tp_user") || "{}"); return u.id || u.userId; } catch { return null; }
  };

  useEffect(() => {
    if (!transactionId) return;
    setAccessError(null);
    markAsRead();
    if (onUnreadChange) onUnreadChange(0);

    fetch(`${API}/chat/${transactionId}`, { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setAccessError(data.error); setLoading(false); return; }
        if (data.messages) setMessages(data.messages);
      })
      .catch(e => console.error("[bg]", e && e.message ? e.message : e))
      .finally(() => setLoading(false));

    // Mark chat as read on open (server-side tracking for unread badge)
    fetch(`${API}/chat/${transactionId}/mark-read`, { method: "POST", headers: { "Authorization": "Bearer " + tok } }).catch(e => console.error("[bg]", e && e.message ? e.message : e));

    // Ask for notification permission now that the user has opened a chat.
    ensureNotificationPermission();

    const connect = () => {
      // socket.io-client built-in reconnection: keep trying with growing backoff
      // so a brief network blip doesn't strand the user on "Connecting…".
      const socket = socketIo(WS_URL, {
        auth: { token: tok },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      });
      socket.on("connect", () => { setConnected(true); socket.emit("join_transaction", viewAsEmail ? { transactionId, viewAs: viewAsEmail } : transactionId); });
      socket.on("disconnect", () => setConnected(false));
      socket.on("chat_history", msgs => { setMessages(msgs); setLoading(false); markAsRead(); });
      socket.on("chat_error", err => { setAccessError(err?.error || "Access denied"); setConnected(false); });
      socket.on("new_message", msg => {
        // Preview-as-client: hide live messages the previewed client wouldn't see
        // (directed to others, or staff broadcasts not addressed to them).
        if (viewAsEmail) {
          let n = msg.notify_emails;
          if (typeof n === "string") { try { n = JSON.parse(n); } catch { n = null; } }
          const mine = Array.isArray(n) && n.length > 0
            ? n.map(x => String(x).toLowerCase()).includes(String(viewAsEmail).toLowerCase())
            : !["agent", "tc", "admin", "superadmin", "system"].includes((msg.sender_role || "").toLowerCase());
          if (!mine) return;
        }
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.user_id !== getMyId()) {
          playSound();
          if (document.hidden && Notification.permission === "granted") {
            try { new Notification("New message from " + msg.sender_name, { body: msg.message }); } catch {}
          }
        }
        markAsRead();
      });
      socket.on("connect_error", () => setConnected(false));
      socketRef.current = socket;
    };

    connect();

    return () => {
      markAsRead();
      if (socketRef.current) {
        socketRef.current.emit("leave_transaction", transactionId);
        socketRef.current.disconnect();
      }
    };
  }, [transactionId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const directEmail = (directTo?.email || "").trim().toLowerCase();

  const partyEmails = parties.filter(p => p.email);
  const doSend = () => {
    if (!newMsg.trim() || !socketRef.current) return;
    const payload = { transactionId, message: newMsg.trim() };
    if (directEmail) payload.notifyEmails = [directEmail];
    else if (selectedEmails.length > 0) payload.notifyEmails = selectedEmails;
    socketRef.current.emit("send_message", payload);
    playSendSound();
    setNewMsg("");
    setSelectedEmails([]);
    setPickerOpen(false);
    setConfirmAll(false);
  };
  const sendMessage = () => {
    if (!newMsg.trim() || !socketRef.current) return;
    // Guard against the easy mistake: blasting the WHOLE group when you meant one
    // person. "Everyone" (no specific pick) on a multi-party deal must confirm
    // first. A specific pick (1+ selected) sends straight through.
    if (!directEmail && !clientView && !simple && selectedEmails.length === 0 && partyEmails.length > 1) {
      setConfirmAll(true);
      return;
    }
    doSend();
  };

  // Private view: only the directed traffic between me and this party — my
  // messages addressed to them alone, and their directed messages.
  const notifyList = (m) => {
    let n = m.notify_emails;
    if (typeof n === "string") { try { n = JSON.parse(n); } catch { n = null; } }
    return Array.isArray(n) ? n.map(x => String(x).toLowerCase()) : [];
  };
  const visibleMessages = directEmail
    ? messages.filter(m => {
        const arr = notifyList(m);
        if (!arr.length) return false; // public room messages stay in the group view
        if (arr.includes(directEmail)) return true; // directed at them (mine or other staff)
        return (m.sender_name || "").trim().toLowerCase() === (directTo.name || "").trim().toLowerCase(); // their directed replies
      })
    : messages;

  const myId = getMyId();
  // Previewing AS the client: the agent's own id must NOT make staff messages
  // render as the client's outgoing bubbles — show everything with sender labels.
  const isMe = msg => !viewAsEmail && msg.user_id === myId;
  const unreadCutoff = messages.length - unreadCount;
  const isUnread = (msg, idx) => !isMe(msg) && idx >= unreadCutoff && unreadCount > 0;

  const formatTime = ts => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const formatDate = ts => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const roleColors = { admin: "#C0392B", superadmin: "#C0392B", agent: "#1A5276", tc: "#B7770D", client: "#1E8449" };

  let lastDate = null;
  let shownNewDivider = false;

  if (accessError) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888", ...style }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Chat unavailable</div>
        <div style={{ fontSize: 13 }}>{accessError}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 400, background: "#F8F9FA", borderRadius: 12, overflow: "hidden", border: "1px solid #DDD", ...style }}>
      <div style={{ background: "#111", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{directTo ? `🔒 Private chat: ${directTo.name}` : "💬 Group Chat"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#4CAF50" : "#888" }} />
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{connected ? "Live" : "Connecting..."}</span>
        </div>
      </div>

      <div style={{ background: "#FEF9E7", borderBottom: "1px solid #F9E79F", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <span>{directTo ? "🔒" : "👀"}</span>
        <span style={{ fontSize: 12, color: "#7D6608" }}>{directTo ? `Only you and ${directTo.name} can see this conversation. They get an email if they're not in the app.` : simple ? "Everyone on this deal can see this chat. For a private message, switch to 👤 One person above." : clientView ? "Messages your agent shares with you (and your own) appear here. Your agent also has separate side-conversations with the other agent and vendors — those aren't shown." : "Visible to everyone unless you pick a recipient with To: — pick one for a private side message. Offline parties receive email notifications."}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#888", padding: 20 }}>Loading messages...</div>
        ) : visibleMessages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#888", padding: 30 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{directTo ? "🔒" : "💬"}</div>
            <div style={{ fontWeight: 600 }}>No messages yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{directTo ? `Start a private conversation — only ${directTo.name} will see it.` : "Start the conversation — everyone on this transaction will be notified."}</div>
          </div>
        ) : visibleMessages.map((msg, i) => {
          const msgDate = formatDate(msg.created_at);
          const showDate = msgDate !== lastDate;
          if (showDate) lastDate = msgDate;
          const mine = isMe(msg);
          const unread = isUnread(msg, i);
          const showNewDivider = unread && !shownNewDivider;
          if (showNewDivider) shownNewDivider = true;
          const roleColor = roleColors[msg.sender_role] || "#555";

          return (
            <div key={msg.id || i}>
              {showDate && (
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <span style={{ background: "#E5E7EB", color: "#555", fontSize: 11, padding: "3px 10px", borderRadius: 10 }}>{msgDate}</span>
                </div>
              )}
              {showNewDivider && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, height: 1, background: "#E67E22" }} />
                  <span style={{ fontSize: 11, color: "#E67E22", fontWeight: 700, whiteSpace: "nowrap" }}>NEW MESSAGES</span>
                  <div style={{ flex: 1, height: 1, background: "#E67E22" }} />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 4 }}>
                <div style={{ maxWidth: "75%" }}>
                  {!mine && (
                    <div style={{ fontSize: 11, color: roleColor, fontWeight: 700, marginBottom: 2, paddingLeft: 4 }}>
                      {msg.sender_name} · {msg.sender_role}{(() => {
                        const n = notifyList(msg);
                        if (n.length === 0) return null;
                        const names = n.map(e => { const p = parties.find(pp => (pp.email || "").toLowerCase() === e); return p ? (p.name || e).split(" ")[0] : e; });
                        return <span style={{ color: "#92400E", fontWeight: 600 }}> · 🔒 to {names.join(", ")}</span>;
                      })()}
                    </div>
                  )}
                  {mine && !clientView && (() => {
                    const n = notifyList(msg);
                    return (
                      <div style={{ fontSize: 10.5, color: n.length ? "#92400E" : "#9CA3AF", fontWeight: 700, marginBottom: 2, textAlign: "right", paddingRight: 4 }}>
                        {n.length
                          ? "🔒 to " + n.map(e => { const p = parties.find(pp => (pp.email || "").toLowerCase() === e); return p ? (p.name || e).split(" ")[0] : e; }).join(", ")
                          : "👥 to everyone"}
                      </div>
                    );
                  })()}
                  <div style={{ background: mine ? "#C0392B" : unread ? "#FFF3CD" : "#fff", color: mine ? "#fff" : "#111", padding: "10px 14px", borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", fontSize: 14, lineHeight: 1.5, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: mine ? "none" : unread ? "2px solid #F0C040" : "1px solid #E5E7EB", whiteSpace: "pre-wrap" }}>
                    {linkifyMessage(msg.message, mine)}
                  </div>
                  {!clientView && !directTo && Array.isArray(msg.notify_emails) && msg.notify_emails.length > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: mine ? "#fff" : "#1A5276", marginTop: 4, textAlign: mine ? "right" : "left", padding: "4px 10px", borderRadius: 10, background: mine ? "rgba(0,0,0,0.35)" : "#D6E4F0", display: "inline-block", border: mine ? "1px solid rgba(255,255,255,0.3)" : "1px solid #A9C5DC" }}>
                      📧 Notified: {(msg.notify_emails || []).map(e => {
                        const p = parties.find(p => (p.email || "").toLowerCase() === e.toLowerCase());
                        return p ? p.name : e;
                      }).join(", ")}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2, textAlign: mine ? "right" : "left", paddingLeft: 4, paddingRight: 4 }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {pickerOpen && (
        <div style={{ background: "#FAFBFC", borderTop: "1px solid #E5E7EB", padding: "10px 16px", maxHeight: 260, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Who should get this message?</div>
          {/* Everyone (whole group) — the default */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", cursor: "pointer", fontSize: 13, fontWeight: 700, background: selectedEmails.length === 0 ? "#E7F1FB" : "transparent", borderRadius: 8 }}>
            <input type="checkbox" checked={selectedEmails.length === 0} onChange={() => setSelectedEmails([])} />
            <span>👥 Everyone on the deal</span>
          </label>
          <div style={{ fontSize: 11, color: "#888", margin: "8px 0 2px" }}>…or send to specific people only:</div>
          {parties.filter(p => p.email).length === 0 ? (
            <div style={{ fontSize: 12, color: "#888", fontStyle: "italic" }}>No parties with emails on this transaction.</div>
          ) : parties.filter(p => p.email).map(p => {
            const checked = selectedEmails.includes(p.email.toLowerCase());
            return (
              <label key={p.id || p.email} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", fontSize: 13, background: checked ? "#E7F1FB" : "transparent", borderRadius: 8 }}>
                <input type="checkbox" checked={checked} onChange={e => {
                  const em = p.email.toLowerCase();
                  setSelectedEmails(prev => e.target.checked ? [...prev.filter(x => x !== em), em] : prev.filter(x => x !== em));
                }} />
                <span style={{ color: "#111" }}>{p.name}</span>
                <span style={{ color: "#888", fontSize: 11 }}>· {p.role}</span>
              </label>
            );
          })}
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#888" }}>{selectedEmails.length === 0 ? "Goes to the whole group." : `Only ${selectedEmails.length} selected will get it.`}</span>
            <button onClick={() => setPickerOpen(false)} style={{ background: "#1A5276", color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
          </div>
        </div>
      )}
      {/* Safety confirm before sending to the WHOLE group */}
      {confirmAll && (
        <div style={{ background: "#FEF3C7", borderTop: "1px solid #FCD34D", padding: "12px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#92400e", marginBottom: 4 }}>⚠️ Send to EVERYONE on this deal? ({partyEmails.length} people)</div>
          <div style={{ fontSize: 12, color: "#7c2d12", marginBottom: 10 }}>{partyEmails.map(p => p.name).join(", ")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={doSend} style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Yes, send to all {partyEmails.length}</button>
            <button onClick={() => { setConfirmAll(false); setPickerOpen(true); }} style={{ background: "#fff", color: "#92400e", border: "1.5px solid #FCD34D", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>No — pick specific people</button>
          </div>
        </div>
      )}
      <div style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #DDD", display: "flex", gap: 8, alignItems: "center" }}>
        {!simple && !directTo && (
          <button onClick={() => setPickerOpen(!pickerOpen)} title="Choose who gets this message"
            style={{ flexShrink: 0, maxWidth: 170, padding: "9px 12px", borderRadius: 20, border: "1.5px solid " + (selectedEmails.length > 0 ? "#1A5276" : "#CBD5E1"), background: selectedEmails.length > 0 ? "#1A5276" : "#fff", color: selectedEmails.length > 0 ? "#fff" : "#1A5276", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "inherit" }}>
            📤 To: {selectedEmails.length === 0 ? "Everyone" : (selectedEmails.length === 1 ? "1 person" : `${selectedEmails.length} people`)} ▾
          </button>
        )}
        <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
          placeholder={directTo ? `Message ${(directTo.name || "").split(" ")[0]} privately...` : selectedEmails.length > 0 ? `Notify ${selectedEmails.length} party · type message...` : (connected ? (simple ? "Message everyone..." : "Type a message... (Enter to send)") : "Connecting...")}
          disabled={!connected}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 24, border: "1.5px solid #DDD", fontSize: 14, fontFamily: "inherit", outline: "none", background: connected ? "#fff" : "#F5F5F5" }} />
        <button onClick={sendMessage} disabled={!connected || !newMsg.trim()}
          style={{ width: 40, height: 40, borderRadius: "50%", background: connected && newMsg.trim() ? "#C0392B" : "#DDD", color: "#fff", border: "none", cursor: connected && newMsg.trim() ? "pointer" : "not-allowed", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          →
        </button>
      </div>
    </div>
  );
}
