import { useState, useEffect, useRef } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";
const WS_URL = "https://liz-team-server-api-production.up.railway.app";

function playSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

if (typeof Notification !== "undefined" && Notification.permission === "default") {
  Notification.requestPermission();
}

export default function TransactionChat({ transactionId, user, parties = [], style, onUnreadChange, unreadCount = 0 }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState(null);
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
      .catch(() => {})
      .finally(() => setLoading(false));

    // Mark chat as read on open (server-side tracking for unread badge)
    fetch(`${API}/chat/${transactionId}/mark-read`, { method: "POST", headers: { "Authorization": "Bearer " + tok } }).catch(() => {});

    const connect = () => {
      const socket = window.io(WS_URL, { auth: { token: tok }, transports: ["websocket", "polling"] });
      socket.on("connect", () => { setConnected(true); socket.emit("join_transaction", transactionId); });
      socket.on("disconnect", () => setConnected(false));
      socket.on("chat_history", msgs => { setMessages(msgs); setLoading(false); markAsRead(); });
      socket.on("chat_error", err => { setAccessError(err?.error || "Access denied"); setConnected(false); });
      socket.on("new_message", msg => {
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

    if (window.io) { connect(); }
    else {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js";
      s.onload = connect;
      document.head.appendChild(s);
    }

    return () => {
      markAsRead();
      if (socketRef.current) {
        socketRef.current.emit("leave_transaction", transactionId);
        socketRef.current.disconnect();
      }
    };
  }, [transactionId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = () => {
    if (!newMsg.trim() || !socketRef.current) return;
    socketRef.current.emit("send_message", { transactionId, message: newMsg.trim() });
    setNewMsg("");
  };

  const myId = getMyId();
  const isMe = msg => msg.user_id === myId;
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
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>💬 Transaction Chat</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#4CAF50" : "#888" }} />
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{connected ? "Live" : "Connecting..."}</span>
        </div>
      </div>

      <div style={{ background: "#FEF9E7", borderBottom: "1px solid #F9E79F", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <span>⚠️</span>
        <span style={{ fontSize: 12, color: "#7D6608" }}>All parties on this transaction can see messages here. Offline parties receive email notifications.</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#888", padding: 20 }}>Loading messages...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#888", padding: 30 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 600 }}>No messages yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Start the conversation — everyone on this transaction will be notified.</div>
          </div>
        ) : messages.map((msg, i) => {
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
                      {msg.sender_name} · {msg.sender_role}
                    </div>
                  )}
                  <div style={{ background: mine ? "#C0392B" : unread ? "#FFF3CD" : "#fff", color: mine ? "#fff" : "#111", padding: "10px 14px", borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", fontSize: 14, lineHeight: 1.5, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: mine ? "none" : unread ? "2px solid #F0C040" : "1px solid #E5E7EB" }}>
                    {msg.message}
                  </div>
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

      <div style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #DDD", display: "flex", gap: 8 }}>
        <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
          placeholder={connected ? "Type a message... (Enter to send)" : "Connecting..."}
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
