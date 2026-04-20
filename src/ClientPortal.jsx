import { useState, useEffect, useRef } from "react";
import TransactionChat from "./TransactionChat";

const API = "https://liz-team-server-api-production.up.railway.app";

const C = {
  red: "#C0392B", black: "#111111", gray: "#555555",
  lightGray: "#F4F4F4", midGray: "#CCCCCC", white: "#FFFFFF",
  success: "#1E8449", successBg: "#D5F5E3", border: "#DDDDDD",
  warning: "#B7770D", warningBg: "#FEF9E7",
};

const STATUS_COLORS = {
  "Active": { color: "#B7770D", bg: "#FEF9E7" },
  "Under Contract": { color: "#1A5276", bg: "#D6EAF8" },
  "Closed": { color: "#1E8449", bg: "#D5F5E3" },
  "On Hold": { color: "#555", bg: "#F5F5F5" },
  "Cancelled": { color: "#C0392B", bg: "#FADBD8" },
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function daysUntil(d) {
  if (!d) return null;
  return Math.round((new Date(d) - new Date()) / 86400000);
}

export default function ClientPortal({ user, onLogout }) {
  const [tx, setTx] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  useEffect(() => { activeTabRef.current = activeTab; if (activeTab === "chat") setChatUnread(0); }, [activeTab]);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const activeTabRef = useRef(activeTab);
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };

  useEffect(() => {
    fetch(`${API}/transactions`, { headers })
      .then(r => r.json())
      .then(data => {
        if (data.transactions && data.transactions.length > 0) {
          const t = data.transactions[0];
          setTx({
            id: t.id,
            address: t.address,
            city: t.city,
            state: t.state,
            status: t.status,
            listPrice: t.list_price,
            contractPrice: t.contract_price,
            openDate: t.open_date,
            closingDate: t.closing_date,
            propertyType: t.property_type,
            type: t.transaction_type,
            parties: (t.parties || []).filter(Boolean),
            tasks: (t.tasks || []).filter(Boolean),
          });
          // Load documents
          return fetch(`${API}/client/documents/${t.id}`, { headers });
        }
      })
      .then(r => r && r.json())
      .then(data => { if (data && data.documents) setDocs(data.documents); })
      .catch(e => console.error("Load failed:", e))
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !tx) return;
    setUploading(true);
    try {
      const res = await fetch(`${API}/documents/upload-url`, {
        method: "POST", headers,
        body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type, category: "Client Upload" }),
      });
      const data = await res.json();
      if (!data.uploadUrl) throw new Error("No upload URL");
      await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const docsRes = await fetch(`${API}/client/documents/${tx.id}`, { headers });
      const docsData = await docsRes.json();
      if (docsData.documents) setDocs(docsData.documents);
      alert("Document uploaded successfully!");
    } catch (e) { alert("Upload failed: " + e.message); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await fetch(`${API}/documents/download/${doc.id}`, { headers });
      const data = await res.json();
      if (data.downloadUrl) window.open(data.downloadUrl, "_blank");
    } catch (e) { alert("Download failed"); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.lightGray, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏠</div>
        <div style={{ fontWeight: 600, color: C.gray }}>Loading your transaction...</div>
      </div>
    </div>
  );

  const completedTasks = tx ? tx.tasks.filter(t => t.status === "Completed").length : 0;
  const totalTasks = tx ? tx.tasks.length : 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const daysToClose = tx ? daysUntil(tx.closingDate) : null;
  const statusCfg = tx ? (STATUS_COLORS[tx.status] || STATUS_COLORS["Active"]) : {};
  const agent = tx ? tx.parties.find(p => p.role === "Listing Agent" || p.role === "Buyer's Agent") : null;

  return (
    <div style={{ minHeight: "100vh", background: C.lightGray, fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.black, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.red, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>T</span>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>TransactPro</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Client Portal</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Hi, {user.firstName}!</div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Sign Out</button>
        </div>
      </div>

      {!tx ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.black, marginBottom: 8 }}>No Transaction Found</div>
          <div style={{ color: C.gray, fontSize: 15 }}>Your agent hasn't linked a transaction to your account yet. Please contact them.</div>
          {agent && <div style={{ marginTop: 20, color: C.red, fontWeight: 600 }}>{agent.name} · {agent.phone || agent.email}</div>}
        </div>
      ) : (
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>
          {/* Property Card */}
          <div style={{ background: C.black, borderRadius: 14, padding: 24, marginBottom: 20, color: "#fff" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{tx.type}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{tx.address}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>{tx.city}, {tx.state} · {tx.propertyType}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ padding: "4px 12px", borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, fontWeight: 700, fontSize: 13 }}>{tx.status}</span>
              {tx.contractPrice && <span style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13 }}>${Number(tx.contractPrice).toLocaleString()}</span>}
            </div>
          </div>

          {/* Key Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Closing Date</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.black }}>{formatDate(tx.closingDate)}</div>
              {daysToClose !== null && tx.status !== "Closed" && (
                <div style={{ fontSize: 12, color: daysToClose <= 14 ? C.red : C.gray, marginTop: 4 }}>
                  {daysToClose > 0 ? `${daysToClose} days away` : daysToClose === 0 ? "Today!" : "Past closing date"}
                </div>
              )}
            </div>
            <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Progress</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.black }}>{progress}% Complete</div>
              <div style={{ background: C.lightGray, borderRadius: 4, height: 6, marginTop: 8 }}>
                <div style={{ background: C.red, borderRadius: 4, height: 6, width: `${progress}%`, transition: "width 0.5s" }} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 0, background: C.white, borderRadius: "12px 12px 0 0", overflowX: "auto" }}>
            {[["overview", "Overview"], ["documents", "📎 Documents"], ["chat", chatUnread > 0 ? `💬 Group Chat (${chatUnread})` : "💬 Group Chat"], ["contact", "Contact Agent"]].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{ padding: "12px 20px", border: "none", background: "none", borderBottom: `3px solid ${activeTab === id ? C.red : "transparent"}`, color: activeTab === id ? C.red : C.gray, fontWeight: activeTab === id ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
            ))}
          </div>

          <div style={{ background: C.white, borderRadius: "0 0 12px 12px", border: `1px solid ${C.border}`, borderTop: "none" }}>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Transaction Milestones</div>
                {tx.tasks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 30, color: C.gray }}>No tasks yet</div>
                ) : (
                  <div>
                    {["Completed", "In Progress", "Pending"].map(status => {
                      const filtered = tx.tasks.filter(t => t.status === status);
                      if (filtered.length === 0) return null;
                      return (
                        <div key={status} style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{status} ({filtered.length})</div>
                          {filtered.map(task => (
                            <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.lightGray, borderRadius: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 16 }}>{task.status === "Completed" ? "✅" : task.status === "In Progress" ? "🔄" : "⏳"}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: task.status === "Completed" ? C.gray : C.black, textDecoration: task.status === "Completed" ? "line-through" : "none" }}>{task.name}</div>
                                {task.dueDate && <div style={{ fontSize: 11, color: C.gray }}>{formatDate(task.dueDate)}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === "documents" && (
              <div style={{ padding: 20 }}>
                <div style={{ background: C.lightGray, border: `2px dashed ${C.midGray}`, borderRadius: 12, padding: 20, marginBottom: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Upload a Document</div>
                  <div style={{ fontSize: 13, color: C.gray, marginBottom: 12 }}>Share documents with your agent</div>
                  <label style={{ padding: "8px 20px", background: C.red, color: "#fff", borderRadius: 8, cursor: uploading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13 }}>
                    {uploading ? "Uploading..." : "Choose File"}
                    <input type="file" onChange={handleUpload} disabled={uploading} style={{ display: "none" }} />
                  </label>
                </div>

                {docs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 30, color: C.gray }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                    <div>No documents yet</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{docs.length} document{docs.length !== 1 ? "s" : ""}</div>
                    {docs.map(doc => (
                      <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 24 }}>📄</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
                          <div style={{ fontSize: 11, color: C.gray }}>{new Date(doc.created_at).toLocaleDateString()}</div>
                        </div>
                        <button onClick={() => handleDownload(doc)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontSize: 12, color: "#1A5276" }}>Download</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === "chat" && (
              <div style={{ padding: 16, height: 480 }}><TransactionChat transactionId={tx?.id} user={null} style={{ height: "100%" }} unreadCount={chatUnread} onUnreadChange={() => {}} /></div>
            )}
            {activeTab === "messages_old" && (
              <div style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Message Your Agent</div>
                <div style={{ background: C.lightGray, borderRadius: 12, padding: 16, marginBottom: 16, maxHeight: 300, overflowY: "auto" }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: "center", color: C.gray, padding: 20 }}>No messages yet. Send your agent a message below.</div>
                  ) : messages.map(m => (
                    <div key={m.id} style={{ marginBottom: 12, display: "flex", justifyContent: m.direction === "inbound" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "80%", background: m.direction === "inbound" ? C.red : "#fff", color: m.direction === "inbound" ? "#fff" : C.black, padding: "10px 14px", borderRadius: 12, fontSize: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
                        <div>{m.body}</div>
                        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>{new Date(m.created_at || m.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type your message..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit" }}
                    onKeyDown={async e => {
                      if (e.key === "Enter" && newMsg.trim() && tx && !sending) {
                        setSending(true);
                        try {
                          const res = await fetch(API + "/client/message", { method: "POST", headers, body: JSON.stringify({ transactionId: tx.id, message: newMsg.trim() }) });
                          const data = await res.json();
                          if (data.success) { setMessages(prev => [...prev, { ...data.message, created_at: new Date().toISOString() }]); setNewMsg(""); }
                        } catch (e) { alert("Failed to send message"); }
                        setSending(false);
                      }
                    }} />
                  <button onClick={async () => {
                    if (!newMsg.trim() || !tx || sending) return;
                    setSending(true);
                    try {
                      const res = await fetch(API + "/client/message", { method: "POST", headers, body: JSON.stringify({ transactionId: tx.id, message: newMsg.trim() }) });
                      const data = await res.json();
                      if (data.success) { setMessages(prev => [...prev, { ...data.message, created_at: new Date().toISOString() }]); setNewMsg(""); }
                    } catch { alert("Failed to send"); }
                    setSending(false);
                  }} style={{ padding: "10px 18px", background: C.red, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                    {sending ? "..." : "Send"}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: C.gray, marginTop: 8 }}>Your agent will receive an email notification and can reply through the app.</div>
              </div>
            )}

            {/* Contact Tab */}
            {activeTab === "contact" && (
              <div style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Your Transaction Team</div>
                {tx.parties.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 30, color: C.gray }}>No contacts listed yet</div>
                ) : (
                  tx.parties.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.black, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                        {(p.name || "?")[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 4 }}>{p.role}</div>
                        {p.email && <div style={{ fontSize: 13, color: C.gray }}>✉️ <a href={`mailto:${p.email}`} style={{ color: "#1A5276" }}>{p.email}</a></div>}
                        {p.phone && <div style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>📞 <a href={`tel:${p.phone}`} style={{ color: "#1A5276" }}>{p.phone}</a></div>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: C.gray }}>
            Powered by TransactPro · Secure Real Estate Transaction Management
          </div>
        </div>
      )}
    </div>
  );
}
