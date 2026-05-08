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
  const [selectedParties, setSelectedParties] = useState([]);
  const [showPartySelect, setShowPartySelect] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const endRef = useRef(null);
  const tok = localStorage.getItem("tp_token") || "";

  // Get last viewed time from localStorage
  const getLastViewed = () => localStorage.getItem("chat_viewed_" + transactionId) || "1970-01-01T00:00:00.000Z";
  const markAsRead = () => localStorage.setItem("chat_viewed_" + transactionId, new Date().toISOString());

  const getMyId = () => {
    try { const u = JSON.parse(localStorage.getItem("tp_user") || "{}"); return u.id || u.userId; } catch { return null; }
  };

  useEffect(() => {
    if (!transactionId) return;

    // Mark as read when chat opens
    markAsRead();
    if (onUnreadChange) onUnreadChange(0);

    // Load history
    fetch(`${API}/chat/${transactionId}`, { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json())
      .then(data => { if (data.messages) setMessages(data.messages); })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Connect Socket
    const connect = () => {
      const socket = window.io(WS_URL, { auth: { token: tok }, transports: ["websocket", "polling"] });
      socket.on("connect", () => { setConnected(true); socket.emit("join_transaction", transactionId); });
      socket.on("disconnect", () => setConnected(false));
      socket.on("chat_history", msgs => { setMessages(msgs); setLoading(false); markAsRead(); });
      socket.on("new_message", msg => {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.user_id !== getMyId()) {
          playSound();
          if (document.hidden && Notification.permission === "granted") {
            try { new Notification("New message from " + msg.sender_name, { body: msg.message }); } catch {}
          }
        }
        markAsRead(); // Mark as read since user is viewing chat
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

    const sendBulkMessage = async () => {
    if (!newMsg.trim() || selectedParties.length === 0) return;
    const tok = localStorage.getItem("tp_token") || "";
    for (const partyId of selectedParties) {
      const party = parties.find(p => p.id === partyId);
      if (!party) continue;
      if (party.phone) {
        try { await fetch(`${API}/sms/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok }, body: JSON.stringify({ transactionId, toPhone: party.phone, toName: party.name, message: newMsg.trim(), fromName: "The Liz Team" }) }); } catch {}
      }
      if (party.email) {
        try { await fetch(`${API}/email/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok }, body: JSON.stringify({ transactionId, toEmail: party.email, toName: party.name, subject: `Message from The Liz Team — ${transactionId}`, message: newMsg.trim(), fromName: "The Liz Team" }) }); } catch {}
      }
    }
    setNewMsg("");
    setSelectedParties([]);
    setShowPartySelect(false);
  };

  return () => {
      markAsRead();
      if (socketRef.current) { socketRef.current.emit("leave_transaction", transactionId); socketRef.current.disconnect(); }
    };
  }, [transactionId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);



  const sendMessage = () => {
    if (!newMsg.trim() || !socketRef.current) return;
    socketRef.current.emit("send_message", { transactionId, message: newMsg.trim() });
    setNewMsg("");
  };

  const myId = getMyId();
  const lastViewed = getLastViewed();
  const isMe = msg => msg.user_id === myId;
  // Unread = from others + arrived before we opened this session (use unreadCount from parent)
  const unreadCutoff = messages.length - unreadCount;
  const isUnread = (msg, idx) => !isMe(msg) && idx >= unreadCutoff && unreadCount > 0;

  const formatTime = ts => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const formatDate = ts => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const roleColors = { admin: "#C0392B", agent: "#1A5276", tc: "#B7770D", client: "#1E8449" };

  let lastDate = null;
  let shownNewDivider = false;

  const sendBulkMessage = async () => {
    if (!newMsg.trim() || selectedParties.length === 0) return;
    const tok = localStorage.getItem("tp_token") || "";
    for (const partyId of selectedParties) {
      const party = parties.find(p => p.id === partyId);
      if (!party) continue;
      if (party.phone) {
        try { await fetch(`${API}/sms/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok }, body: JSON.stringify({ transactionId, toPhone: party.phone, toName: party.name, message: newMsg.trim(), fromName: "The Liz Team" }) }); } catch {}
      }
      if (party.email) {
        try { await fetch(`${API}/email/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok }, body: JSON.stringify({ transactionId, toEmail: party.email, toName: party.name, subject: `Message from The Liz Team — ${transactionId}`, message: newMsg.trim(), fromName: "The Liz Team" }) }); } catch {}
      }
    }
    setNewMsg("");
    setSelectedParties([]);
    setShowPartySelect(false);
  };

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
        <span style={{ fontSize: 12, color: "#7D6608" }}>All parties with portal access can see messages in this chat.</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#888", padding: 20 }}>Loading messages...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#888", padding: 30 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 600 }}>No messages yet</div>
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

          const sendBulkMessage = async () => {
    if (!newMsg.trim() || selectedParties.length === 0) return;
    const tok = localStorage.getItem("tp_token") || "";
    for (const partyId of selectedParties) {
      const party = parties.find(p => p.id === partyId);
      if (!party) continue;
      if (party.phone) {
        try { await fetch(`${API}/sms/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok }, body: JSON.stringify({ transactionId, toPhone: party.phone, toName: party.name, message: newMsg.trim(), fromName: "The Liz Team" }) }); } catch {}
      }
      if (party.email) {
        try { await fetch(`${API}/email/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok }, body: JSON.stringify({ transactionId, toEmail: party.email, toName: party.name, subject: `Message from The Liz Team — ${transactionId}`, message: newMsg.trim(), fromName: "The Liz Team" }) }); } catch {}
      }
    }
    setNewMsg("");
    setSelectedParties([]);
    setShowPartySelect(false);
  };

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
        {showPartySelect && (
          <div style={{ borderTop: "1px solid #EEE", padding: "12px 16px", maxHeight: 200, overflowY: "auto" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>Send to parties:</div>
            {parties.filter(p => (p.phone && p.phone.trim()) || (p.email && p.email.trim())).map(p => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={selectedParties.includes(p.id)} onChange={e => setSelectedParties(e.target.checked ? [...selectedParties, p.id] : selectedParties.filter(id => id !== p.id))} />
                {p.name} ({p.role})
              </label>
            ))}
            <button onClick={() => setSelectedParties(parties.filter(p => (p.phone && p.phone.trim()) || (p.email && p.email.trim())).map(p => p.id))} style={{ marginTop: 8, fontSize: 11, color: "#C0392B", background: "none", border: "none", cursor: "pointer" }}>Select all</button>
          </div>
        )}
        <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
          placeholder={connected ? "Type a message... (Enter to send)" : "Connecting..."}
          disabled={!connected}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 24, border: "1.5px solid #DDD", fontSize: 14, fontFamily: "inherit", outline: "none", background: connected ? "#fff" : "#F5F5F5" }} />
        <button onClick={() => setShowPartySelect(!showPartySelect)} style={{ width: 40, height: 40, borderRadius: "50%", background: showPartySelect ? "#C0392B" : "#E0E0E0", color: "#fff", border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 8 }} title="Send to specific parties">👥</button>
        <button onClick={selectedParties.length > 0 ? sendBulkMessage : sendMessage} disabled={(!connected && selectedParties.length === 0) || !newMsg.trim()}
          style={{ width: 40, height: 40, borderRadius: "50%", background: connected && newMsg.trim() ? "#C0392B" : "#DDD", color: "#fff", border: "none", cursor: connected && newMsg.trim() ? "pointer" : "not-allowed", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          →
        </button>
      </div>
    </div>
  );
}
