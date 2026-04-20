import { useState, useEffect, useRef } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// Play notification sound
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {}
}

// Request notification permission
if (typeof Notification !== "undefined" && Notification.permission === "default") {
  Notification.requestPermission();
}

function showBrowserNotification(senderName, message) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(`New message from ${senderName}`, {
        body: message.length > 80 ? message.slice(0, 80) + "..." : message,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
      });
    } catch {}
  }
}
const WS_URL = "https://liz-team-server-api-production.up.railway.app";

export default function TransactionChat({ transactionId, user, style, onUnreadChange }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const endRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const tok = localStorage.getItem("tp_token") || "";

  useEffect(() => {
    if (!transactionId) return;

    // Load history via REST first
    fetch(`${API}/chat/${transactionId}`, {
      headers: { "Authorization": "Bearer " + tok }
    })
      .then(r => r.json())
      .then(data => { if (data.messages) setMessages(data.messages); })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Connect Socket.io
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js";
    script.onload = () => {
      const socket = window.io(WS_URL, {
        auth: { token: tok },
        transports: ["websocket", "polling"],
      });

      socket.on("connect", () => {
        setConnected(true);
        socket.emit("join_transaction", transactionId);
      });

      socket.on("disconnect", () => setConnected(false));

      socket.on("chat_history", (msgs) => {
        setMessages(msgs);
        setLoading(false);
      });

      socket.on("new_message", (msg) => {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Notify if message is from someone else
        if (msg.user_id !== socket.user?.userId) {
          playNotificationSound();
          if (document.hidden) {
            showBrowserNotification(msg.sender_name, msg.message);
          }
          // Increment unread if chat tab is not active
          setUnreadCount(prev => {
            const next = prev + 1;
            if (onUnreadChange) onUnreadChange(next);
            return next;
          });
        }
      });

      socket.on("connect_error", (e) => {
        console.error("Chat connect error:", e.message);
        setConnected(false);
      });

      socketRef.current = socket;
    };
    document.head.appendChild(script);

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave_transaction", transactionId);
        socketRef.current.disconnect();
      }
    };
  }, [transactionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset unread when tab is visible
  useEffect(() => {
    setUnreadCount(0);
    if (onUnreadChange) onUnreadChange(0);
  }, []);

  const sendMessage = () => {
    if (!newMsg.trim() || !socketRef.current) return;
    socketRef.current.emit("send_message", { transactionId, message: newMsg.trim() });
    setNewMsg("");
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const formatDate = (ts) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const isMe = (msg) => msg.user_id === user?.userId || msg.user_id === user?.id;

  const roleColors = {
    admin: "#C0392B", agent: "#1A5276", tc: "#B7770D",
    client: "#1E8449", "Transaction Coordinator": "#B7770D",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 400, background: "#F8F9FA", borderRadius: 12, overflow: "hidden", border: "1px solid #DDD", ...style }}>
      {/* Header */}
      <div style={{ background: "#111", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>💬 Transaction Chat</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#4CAF50" : "#888" }} />
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{connected ? "Live" : "Connecting..."}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#888", padding: 20 }}>Loading messages...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#888", padding: 30 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No messages yet</div>
            <div style={{ fontSize: 13 }}>Start the conversation below</div>
          </div>
        ) : (() => {
          let lastDate = null;
          return messages.map((msg, i) => {
            const msgDate = formatDate(msg.created_at);
            const showDate = msgDate !== lastDate;
            lastDate = msgDate;
            const mine = isMe(msg);
            const roleColor = roleColors[msg.sender_role] || "#555";

            return (
              <div key={msg.id || i}>
                {showDate && (
                  <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <span style={{ background: "#E5E7EB", color: "#555", fontSize: 11, padding: "3px 10px", borderRadius: 10 }}>{msgDate}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 4 }}>
                  <div style={{ maxWidth: "75%" }}>
                    {!mine && (
                      <div style={{ fontSize: 11, color: roleColor, fontWeight: 700, marginBottom: 2, paddingLeft: 4 }}>
                        {msg.sender_name} · {msg.sender_role}
                      </div>
                    )}
                    <div style={{
                      background: mine ? "#C0392B" : "#fff",
                      color: mine ? "#fff" : "#111",
                      padding: "10px 14px",
                      borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      fontSize: 14,
                      lineHeight: 1.5,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      border: mine ? "none" : "1px solid #E5E7EB",
                    }}>
                      {msg.message}
                    </div>
                    <div style={{ fontSize: 10, color: "#888", marginTop: 2, textAlign: mine ? "right" : "left", paddingLeft: 4, paddingRight: 4 }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })()}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #DDD", display: "flex", gap: 8 }}>
        <input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
          placeholder={connected ? "Type a message... (Enter to send)" : "Connecting..."}
          disabled={!connected}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 24, border: "1.5px solid #DDD", fontSize: 14, fontFamily: "inherit", outline: "none", background: connected ? "#fff" : "#F5F5F5" }}
        />
        <button onClick={sendMessage} disabled={!connected || !newMsg.trim()}
          style={{ width: 40, height: 40, borderRadius: "50%", background: connected && newMsg.trim() ? "#C0392B" : "#DDD", color: "#fff", border: "none", cursor: connected && newMsg.trim() ? "pointer" : "not-allowed", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          →
        </button>
      </div>
    </div>
  );
}
