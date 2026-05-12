import { useState, useEffect, useRef } from "react";
import TransactionChat from "./TransactionChat";

const API = "https://liz-team-server-api-production.up.railway.app";

const C = {
  red: "#C0392B", black: "#111111", gray: "#555555",
  lightGray: "#F4F4F4", midGray: "#CCCCCC", white: "#FFFFFF",
  success: "#1E8449", successBg: "#D5F5E3", border: "#DDDDDD",
  warning: "#B7770D", warningBg: "#FEF9E7",
};

function formatDate(d) {
  if (!d) return "TBD";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function daysUntil(d) {
  if (!d) return null;
  return Math.round((new Date(d) - new Date()) / 86400000);
}

// ── PROGRESS TRACKER ─────────────────────────────────────────
function ProgressTracker({ status, transactionType }) {
  const isSeller = transactionType && transactionType.includes("Seller");
  const isBuyer = transactionType && transactionType.includes("Buyer");

  const sellerSteps = [
    { key: "Active", label: "Listed", icon: "🏠" },
    { key: "Showings", label: "Showings", icon: "👀" },
    { key: "Under Contract", label: "Under Contract", icon: "✍️" },
    { key: "Inspection", label: "Inspection", icon: "🔍" },
    { key: "Clear to Close", label: "Clear to Close", icon: "✅" },
    { key: "Closed", label: "Sold!", icon: "🎉" },
  ];

  const buyerSteps = [
    { key: "Active", label: "Searching", icon: "🔍" },
    { key: "Under Contract", label: "Under Contract", icon: "✍️" },
    { key: "Inspection", label: "Inspection", icon: "🏗️" },
    { key: "Appraisal", label: "Financing", icon: "🏦" },
    { key: "Clear to Close", label: "Clear to Close", icon: "✅" },
    { key: "Closed", label: "Keys!", icon: "🗝️" },
  ];

  const steps = isSeller ? sellerSteps : buyerSteps;

  const statusOrder = ["Active", "Under Contract", "Inspection", "Appraisal", "Clear to Close", "Closed"];
  const currentIndex = Math.max(0, statusOrder.indexOf(status));

  const getStepIndex = (stepKey) => {
    const idx = statusOrder.indexOf(stepKey);
    return idx === -1 ? 0 : idx;
  };

  return (
    <div style={{ padding: "20px 16px 8px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)",
        textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
        WHERE YOU ARE TODAY
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
        {steps.map((step, i) => {
          const stepIdx = getStepIndex(step.key);
          const isDone = stepIdx < currentIndex;
          const isCurrent = stepIdx === currentIndex;
          const isLast = i === steps.length - 1;

          return (
            <div key={step.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
              {/* Connector line */}
              {!isLast && (
                <div style={{ position: "absolute", top: 14, left: "50%", width: "100%", height: 3,
                  background: isDone ? C.red : "rgba(255,255,255,0.15)", zIndex: 0 }} />
              )}
              {/* Circle */}
              <div style={{ width: 30, height: 30, borderRadius: "50%", zIndex: 1,
                background: isDone ? C.red : isCurrent ? "#fff" : "rgba(255,255,255,0.15)",
                border: isCurrent ? "3px solid " + C.red : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, marginBottom: 6 }}>
                {isDone ? "✓" : isCurrent ? <span style={{ fontSize: 14 }}>{step.icon}</span> : ""}
              </div>
              {/* Label */}
              <div style={{ fontSize: 10, fontWeight: isCurrent ? 800 : 500,
                color: isCurrent ? "#fff" : isDone ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
                textAlign: "center", lineHeight: 1.3 }}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LATEST UPDATE CARD ────────────────────────────────────────
function LatestUpdateCard({ tx, agentName }) {
  const daysToClose = daysUntil(tx.closingDate);

  const getUpdateMessage = () => {
    if (tx.status === "Closed") return "Congratulations! Your transaction has successfully closed. Thank you for trusting us with this important milestone.";
    if (tx.status === "Clear to Close") return "Great news — you have been cleared to close! Everything is in order and you are almost at the finish line.";
    if (tx.status === "Inspection") return "The inspection phase is underway. Your agent is reviewing all inspection items and will keep you informed of any next steps.";
    if (tx.status === "Under Contract") return "You are officially under contract! Your agent is coordinating all the moving parts to keep things on track toward closing.";
    if (daysToClose !== null && daysToClose <= 7 && daysToClose >= 0) return `Closing is just ${daysToClose} day${daysToClose === 1 ? "" : "s"} away! Your agent is making sure everything is ready for a smooth closing day.`;
    return "Your transaction is active and moving forward. Your agent is working hard behind the scenes and will reach out with any important updates.";
  };

  return (
    <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: "4px solid " + C.red }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 8 }}>LATEST UPDATE</div>
      <div style={{ fontSize: 14, color: C.black, lineHeight: 1.7, marginBottom: 10 }}>
        {getUpdateMessage()}
      </div>
      {agentName && (
        <div style={{ fontSize: 12, color: C.gray }}>— {agentName}</div>
      )}
    </div>
  );
}

// ── ACTION NEEDED CARD ────────────────────────────────────────
function ActionNeededCard({ tx }) {
  const getAction = () => {
    if (tx.status === "Active" && tx.transactionType && tx.transactionType.includes("Buyer")) {
      return { icon: "💡", text: "Stay in close contact with your lender to make sure your pre-approval is current and ready when you find the right home." };
    }
    if (tx.status === "Under Contract") {
      return { icon: "📋", text: "Watch your email — your lender or title company may request documents. Respond quickly to avoid any delays." };
    }
    if (tx.status === "Inspection") {
      return { icon: "🔍", text: "Review inspection results with your agent carefully. You typically have a limited window to request repairs." };
    }
    if (tx.status === "Clear to Close") {
      return { icon: "🏦", text: "Confirm wire transfer instructions directly with the title company by phone. Never wire money based on email instructions alone." };
    }
    if (tx.status === "Closed") {
      return { icon: "🎉", text: "Welcome! Remember to update your address with the post office, bank, and utilities. Keep all closing documents in a safe place." };
    }
    return null;
  };

  const action = getAction();
  if (!action) return null;

  return (
    <div style={{ background: C.warningBg, borderRadius: 14, padding: 16, marginBottom: 14,
      border: "1px solid #F9CA24" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.warning, textTransform: "uppercase",
        letterSpacing: 1, marginBottom: 8 }}>GOOD TO KNOW</div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 20 }}>{action.icon}</span>
        <div style={{ fontSize: 13, color: C.black, lineHeight: 1.6 }}>{action.text}</div>
      </div>
    </div>
  );
}

// ── MAIN CLIENT PORTAL ────────────────────────────────────────
export default function ClientPortal({ user, onLogout }) {
  const [tx, setTx] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [chatUnread, setChatUnread] = useState(0);
  const activeTabRef = useRef(activeTab);
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === "chat") setChatUnread(0);
  }, [activeTab]);

  useEffect(() => {
    fetch(API + "/client/transactions", { headers })
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
            transactionType: t.transaction_type,
            parties: (t.parties || []).filter(Boolean),
            tasks: (t.tasks || []).filter(Boolean),
            owningBrokerage: t.owning_brokerage,
            brokerageColor: t.brokerage_color,
            owningAgentName: [t.owning_agent_first_name, t.owning_agent_last_name].filter(Boolean).join(" "),
            owningAgentEmail: t.owning_agent_email,
            owningAgentPhone: t.owning_agent_phone,
            owningAgentTitle: t.owning_agent_title,
          });
          return fetch(API + "/client/documents/" + t.id, { headers });
        }
      })
      .then(r => r && r.json())
      .then(data => { if (data && data.documents) setDocs(data.documents); })
      .catch(e => console.error("Load failed:", e))
      .finally(() => setLoading(false));
  }, []);

  // Poll for unread chat
  useEffect(() => {
    if (!tx) return;
    let initialized = false;
    let lastCount = 0;
    const myId = (() => { try { const u = JSON.parse(localStorage.getItem("tp_user") || "{}"); return u.id || u.userId; } catch { return null; } })();
    const poll = async () => {
      if (activeTabRef.current === "chat") return;
      try {
        const r = await fetch(API + "/chat/" + tx.id, { headers: { "Authorization": "Bearer " + tok } });
        const d = await r.json();
        if (d.messages) {
          const others = d.messages.filter(m => m.user_id !== myId);
          if (!initialized) { lastCount = others.length; initialized = true; return; }
          if (others.length > lastCount) {
            setChatUnread(prev => prev + (others.length - lastCount));
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator(); const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
              osc.start(); osc.stop(ctx.currentTime + 0.3);
            } catch {}
          }
          lastCount = others.length;
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [tx]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !tx) return;
    setUploading(true);
    try {
      const res = await fetch(API + "/documents/upload-url", {
        method: "POST", headers,
        body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type, category: "Client Upload" }),
      });
      const data = await res.json();
      if (!data.uploadUrl) throw new Error("No upload URL");
      await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const docsRes = await fetch(API + "/client/documents/" + tx.id, { headers });
      const docsData = await docsRes.json();
      if (docsData.documents) setDocs(docsData.documents);
      alert("Document uploaded successfully!");
    } catch (e) { alert("Upload failed: " + e.message); }
    finally { setUploading(false); if (e.target) e.target.value = ""; }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await fetch(API + "/documents/download/" + doc.id, { headers });
      const data = await res.json();
      if (data.downloadUrl) window.open(data.downloadUrl, "_blank");
    } catch { alert("Download failed"); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: C.lightGray, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
        <div style={{ fontWeight: 600, color: C.gray }}>Loading your transaction...</div>
      </div>
    </div>
  );

  const daysToClose = tx ? daysUntil(tx.closingDate) : null;
  const agentName = tx ? tx.owningAgentName : "";
  const agentPhone = tx ? tx.owningAgentPhone : "";
  const agentEmail = tx ? tx.owningAgentEmail : "";

  const tabs = [
    { id: "home", label: "🏠 My Transaction" },
    { id: "documents", label: "📎 Documents" },
    { id: "chat", label: chatUnread > 0 ? "💬 Chat (" + chatUnread + ")" : "💬 Chat" },
    { id: "team", label: "👥 My Team" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.lightGray,
      fontFamily: "system-ui, sans-serif", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: C.black, padding: "16px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>TransactPro</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
            Hi {user.firstName}! 👋
          </div>
        </div>
        <button onClick={onLogout}
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "6px 14px",
            cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
          Sign Out
        </button>
      </div>

      {!tx ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.black, marginBottom: 8 }}>
            No Transaction Found
          </div>
          <div style={{ color: C.gray, fontSize: 15, lineHeight: 1.6 }}>
            Your agent has not linked a transaction to your account yet.
            Please contact them directly.
          </div>
        </div>
      ) : (
        <>
          {/* Property Hero */}
          <div style={{ background: C.black, padding: "20px 20px 0" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)",
              fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              {tx.transactionType || "Your Transaction"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 2 }}>
              {tx.address}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>
              {tx.city}, {tx.state}
            </div>

            {/* Closing date pill */}
            {tx.closingDate && tx.status !== "Closed" && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6,
                background: daysToClose !== null && daysToClose <= 7 ? C.red : "rgba(255,255,255,0.1)",
                borderRadius: 20, padding: "5px 14px", marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>📅</span>
                <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
                  Closing {formatDate(tx.closingDate)}
                  {daysToClose !== null && daysToClose >= 0 && " · " + daysToClose + " days away"}
                </span>
              </div>
            )}
            {tx.status === "Closed" && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6,
                background: "#1E8449", borderRadius: 20, padding: "5px 14px" }}>
                <span style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>🎉 Transaction Closed</span>
              </div>
            )}

            {/* Progress tracker */}
            <ProgressTracker status={tx.status} transactionType={tx.transactionType} />
          </div>

          {/* Bottom Tab Nav */}
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.white,
            borderTop: "1px solid " + C.border, display: "flex", zIndex: 100,
            paddingBottom: "env(safe-area-inset-bottom)" }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ flex: 1, padding: "10px 4px 8px", border: "none",
                  background: "none", color: activeTab === tab.id ? C.red : C.gray,
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  borderTop: "2px solid " + (activeTab === tab.id ? C.red : "transparent") }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ padding: "16px 16px 100px", maxWidth: 600, margin: "0 auto" }}>

            {/* HOME TAB */}
            {activeTab === "home" && (
              <div>
                <LatestUpdateCard tx={tx} agentName={agentName} />
                <ActionNeededCard tx={tx} />

                {/* Key dates */}
                <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.gray,
                    textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>KEY DATES</div>
                  {[
                    { label: "Contract Date", value: formatDate(tx.openDate) },
                    { label: "Closing Date", value: formatDate(tx.closingDate) },
                    { label: tx.contractPrice ? "Contract Price" : "List Price",
                      value: tx.contractPrice || tx.listPrice ?
                        "$" + Number(tx.contractPrice || tx.listPrice).toLocaleString() : "TBD" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", paddingBottom: 10, marginBottom: 10,
                      borderBottom: "1px solid " + C.lightGray }}>
                      <span style={{ fontSize: 13, color: C.gray }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.black }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Agent contact card */}
                {agentName && (
                  <div style={{ background: C.white, borderRadius: 14, padding: 18,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.gray,
                      textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>YOUR AGENT</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.black,
                        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                        {agentName[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: C.black }}>{agentName}</div>
                        {tx.owningBrokerage && (
                          <div style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>{tx.owningBrokerage}</div>
                        )}
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          {agentPhone && (
                            <a href={"tel:" + agentPhone}
                              style={{ flex: 1, padding: "8px 0", background: C.black, color: "#fff",
                                borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 600,
                                textDecoration: "none" }}>📞 Call</a>
                          )}
                          {agentEmail && (
                            <a href={"mailto:" + agentEmail}
                              style={{ flex: 1, padding: "8px 0", background: C.lightGray, color: C.black,
                                borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 600,
                                textDecoration: "none" }}>✉️ Email</a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DOCUMENTS TAB */}
            {activeTab === "documents" && (
              <div>
                <div style={{ background: C.white, borderRadius: 14, padding: 20,
                  marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Upload a Document</div>
                  <div style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>
                    Share documents with your agent securely
                  </div>
                  <label style={{ display: "inline-block", padding: "10px 24px", background: C.red,
                    color: "#fff", borderRadius: 10, cursor: uploading ? "not-allowed" : "pointer",
                    fontWeight: 700, fontSize: 14 }}>
                    {uploading ? "Uploading..." : "Choose File"}
                    <input type="file" onChange={handleUpload} disabled={uploading}
                      style={{ display: "none" }} />
                  </label>
                </div>

                {docs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: C.gray }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
                    <div>No documents yet</div>
                  </div>
                ) : docs.map(doc => (
                  <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12,
                    padding: 16, background: C.white, borderRadius: 12, marginBottom: 8,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                    <span style={{ fontSize: 28 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {doc.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.gray }}>
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button onClick={() => handleDownload(doc)}
                      style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid " + C.border,
                        background: C.white, cursor: "pointer", fontSize: 12,
                        fontWeight: 600, color: "#1A5276" }}>
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CHAT TAB */}
            {activeTab === "chat" && (
              <div style={{ height: 500 }}>
                <TransactionChat transactionId={tx?.id} user={null}
                  style={{ height: "100%" }} unreadCount={chatUnread} onUnreadChange={() => {}} />
              </div>
            )}

            {/* TEAM TAB */}
            {activeTab === "team" && (
              <div>
                <div style={{ fontSize: 13, color: C.gray, marginBottom: 16, lineHeight: 1.6 }}>
                  Your transaction team is here to support you every step of the way.
                </div>
                {tx.parties.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: C.gray }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
                    <div>No team members listed yet</div>
                  </div>
                ) : tx.parties.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14,
                    padding: 16, background: C.white, borderRadius: 12, marginBottom: 10,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.black,
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      {(p.name || "?")[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 6 }}>{p.role}</div>
                      {p.email && (
                        <a href={"mailto:" + p.email}
                          style={{ fontSize: 13, color: "#1A5276", display: "block" }}>
                          ✉️ {p.email}
                        </a>
                      )}
                      {p.phone && (
                        <a href={"tel:" + p.phone}
                          style={{ fontSize: 13, color: "#1A5276", marginTop: 2, display: "block" }}>
                          📞 {p.phone}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
