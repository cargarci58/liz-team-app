import React, { useState, useEffect, useRef } from "react";
import BuyerCalculator from "./components/BuyerCalculator";
import SellerCalculator from "./components/SellerCalculator";
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

  const sellerSteps = [
    { key: "Active", label: "Listed", icon: "🏠" },
    { key: "Under Contract", label: "Contract", icon: "✍️" },
    { key: "Inspection", label: "Inspection", icon: "🔍" },
    { key: "Clear to Close", label: "Clear to Close", icon: "✅" },
    { key: "Closed", label: "Sold!", icon: "🎉" },
  ];

  const buyerSteps = [
    { key: "Active", label: "Searching", icon: "🔍" },
    { key: "Under Contract", label: "Contract", icon: "✍️" },
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
    <div style={{ padding: "20px 20px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)",
        textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 20 }}>
        WHERE YOU ARE TODAY
      </div>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {steps.map((step, i) => {
          const stepIdx = getStepIndex(step.key);
          const isDone = stepIdx < currentIndex;
          const isCurrent = stepIdx === currentIndex;
          const isLast = i === steps.length - 1;

          return (
            <div key={step.key} style={{ flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", position: "relative" }}>
              {/* Connector line */}
              {!isLast && (
                <div style={{ position: "absolute", top: 16, left: "50%", width: "100%", height: 2,
                  background: isDone ? "#C0392B" : "rgba(255,255,255,0.2)", zIndex: 0 }} />
              )}
              {/* Circle */}
              <div style={{ width: 32, height: 32, borderRadius: "50%", zIndex: 1,
                background: isDone ? "#C0392B" : isCurrent ? "#ffffff" : "rgba(255,255,255,0.08)",
                border: isCurrent ? "3px solid #C0392B" : isDone ? "none" : "2px solid rgba(255,255,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, marginBottom: 8, flexShrink: 0 }}>
                {isDone
                  ? <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>✓</span>
                  : isCurrent
                  ? <span style={{ fontSize: 15 }}>{step.icon}</span>
                  : <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>○</span>
                }
              </div>
              {/* Label */}
              <div style={{
                fontSize: 10, fontWeight: isCurrent ? 800 : 500, textAlign: "center",
                lineHeight: 1.3, maxWidth: 60,
                color: isCurrent ? "#ffffff" : isDone ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.45)"
              }}>
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



// ── VENDORS TAB ───────────────────────────────────────────────
const VENDOR_CATEGORY_ICONS = {
  "Inspector": "🔍", "Lender": "🏦", "Title Company": "📋",
  "Insurance": "🛡️", "Attorney": "⚖️", "Pest Control": "🐛",
  "Survey": "📐", "Contractor": "🔧", "Moving Company": "🚚",
  "Locksmith": "🔑", "Other": "👤",
};

const VENDOR_CATEGORIES_LIST = [
  "Inspector", "Lender", "Title Company", "Insurance",
  "Attorney", "Pest Control", "Survey", "Contractor",
  "Moving Company", "Locksmith", "Other"
];

function AddOwnVendorForm({ category, transactionId, token, onDone, onCancel }) {
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const API = "https://liz-team-server-api-production.up.railway.app";

  const handleSubmit = async () => {
    if (!form.name) { alert("Please enter a name"); return; }
    setSaving(true);
    try {
      const res = await fetch(API + "/vendors/client-add/" + transactionId, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, category })
      });
      const data = await res.json();
      if (data.success) onDone(data.party);
      else alert(data.error || "Error adding vendor");
    } catch (e) { alert("Error adding vendor"); }
    setSaving(false);
  };

  return (
    <div style={{ background: "#FEF9E7", borderRadius: 12, padding: 16,
      border: "1px solid #F9CA24", marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
        Add Your Own {category}
      </div>
      {[["Name *", "name", "text"], ["Company", "company", "text"],
        ["Phone", "phone", "tel"], ["Email", "email", "email"]].map(([label, key, type]) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>{label}</div>
          <input type={type} value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
              border: "1.5px solid #DDD", fontSize: 14,
              fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #DDD",
            background: "#fff", color: "#555", fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          style={{ flex: 2, padding: 10, borderRadius: 8, border: "none",
            background: "#C0392B", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}

function VendorCategorySection({ category, vendors, transactionId, token, onUpdate }) {
  const [selecting, setSelecting] = useState(null);
  const [showAddOwn, setShowAddOwn] = useState(false);
  const API = "https://liz-team-server-api-production.up.railway.app";

  const icon = VENDOR_CATEGORY_ICONS[category] || "👤";
  const selected = vendors.find(v => v.vendor_status === "selected");
  const available = vendors.filter(v => v.vendor_status === "available");

  const handleSelect = async (vendor) => {
    if (!window.confirm("Select " + vendor.name + " as your " + category + "?")) return;
    setSelecting(vendor.id);
    try {
      const res = await fetch(API + "/vendors/select/" + transactionId + "/" + vendor.id, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) onUpdate();
      else alert(data.error || "Error selecting vendor");
    } catch (e) { alert("Error selecting vendor"); }
    setSelecting(null);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#555",
        textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        {icon} {category}
      </div>

      {/* Selected vendor */}
      {selected && (
        <div style={{ background: "#D5F5E3", borderRadius: 12, padding: 16,
          marginBottom: 8, border: "2px solid #1E8449" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1E8449",
              textTransform: "uppercase" }}>Your {category}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{selected.name}</div>
          {selected.company && <div style={{ fontSize: 13, color: "#1E8449", fontWeight: 600 }}>{selected.company}</div>}
          {selected.vendor_description && (
            <div style={{ fontSize: 13, color: "#555", marginTop: 4, lineHeight: 1.5 }}>
              {selected.vendor_description}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {selected.phone && (
              <a href={"tel:" + selected.phone}
                style={{ flex: 1, padding: "8px 0", background: "#111", color: "#fff",
                  borderRadius: 8, textAlign: "center", fontSize: 13,
                  fontWeight: 600, textDecoration: "none" }}>📞 Call</a>
            )}
            {selected.email && (
              <a href={"mailto:" + selected.email}
                style={{ flex: 1, padding: "8px 0", background: "#F4F4F4", color: "#111",
                  borderRadius: 8, textAlign: "center", fontSize: 13,
                  fontWeight: 600, textDecoration: "none" }}>✉️ Email</a>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 10, textAlign: "center" }}>
            Need to change? Contact your agent.
          </div>
        </div>
      )}

      {/* Available vendors to choose from */}
      {!selected && available.map(v => (
        <div key={v.id} style={{ background: "#fff", borderRadius: 12, padding: 16,
          marginBottom: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 4 }}>{v.name}</div>
          {v.company && <div style={{ fontSize: 13, color: "#C0392B", fontWeight: 600 }}>{v.company}</div>}
          {v.vendor_description && (
            <div style={{ fontSize: 13, color: "#555", marginTop: 6, lineHeight: 1.5 }}>
              {v.vendor_description}
            </div>
          )}
          {v.phone && <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>📞 {v.phone}</div>}
          <button onClick={() => handleSelect(v)} disabled={selecting === v.id}
            style={{ width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 8,
              border: "none", background: "#C0392B", color: "#fff",
              fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {selecting === v.id ? "Selecting..." : "Select This " + category}
          </button>
        </div>
      ))}

      {/* Add own vendor option */}
      {!selected && (
        <div>
          {!showAddOwn ? (
            <button onClick={() => setShowAddOwn(true)}
              style={{ width: "100%", padding: 13, borderRadius: 10,
                border: "2px dashed #DDD", background: "#fff",
                color: "#555", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              + I already have a {category} I want to use
            </button>
          ) : (
            <AddOwnVendorForm
              category={category}
              transactionId={transactionId}
              token={token}
              onDone={() => { setShowAddOwn(false); onUpdate(); }}
              onCancel={() => setShowAddOwn(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function VendorsTab({ tx, token, user }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const API = "https://liz-team-server-api-production.up.railway.app";

  useEffect(() => { fetchVendors(); }, [tx.id]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await fetch(API + "/vendors/transaction/" + tx.id, {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.success) setVendors(data.vendors || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
      Loading vendors...
    </div>
  );

  if (vendors.length === 0) return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 32,
      textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
      <div style={{ fontWeight: 700, fontSize: 18, color: "#111", marginBottom: 8 }}>
        No Vendors Yet
      </div>
      <div style={{ color: "#555", fontSize: 14, lineHeight: 1.6 }}>
        Your agent will add preferred vendors here for you to choose from.
        You can also add your own vendors if you already have someone in mind.
      </div>
    </div>
  );

  // Group by category
  const grouped = vendors.reduce((acc, v) => {
    acc[v.vendor_category] = acc[v.vendor_category] || [];
    acc[v.vendor_category].push(v);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 16, lineHeight: 1.6 }}>
        Choose your preferred vendors below. Once selected, they will be
        added to your transaction team and can communicate through the app.
      </div>
      {Object.entries(grouped).map(([category, items]) => (
        <VendorCategorySection
          key={category}
          category={category}
          vendors={items}
          transactionId={tx.id}
          token={token}
          onUpdate={fetchVendors}
        />
      ))}
    </div>
  );
}


// ── FAQ COMPONENT ─────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: "How long does the closing process take?", a: "In Florida, a typical real estate transaction takes 30-45 days from contract to closing. Cash transactions can close faster, sometimes in 2-3 weeks. Your closing date is set in your contract." },
  { q: "What is earnest money and do I get it back?", a: "Earnest money is a deposit (typically 1-3% of the purchase price) that shows the seller you are serious. If you cancel during the inspection period you usually get it back. After the inspection period it depends on the reason for cancellation." },
  { q: "What happens during the inspection?", a: "A licensed home inspector examines the property from top to bottom — roof, foundation, plumbing, electrical, HVAC, and more. You typically have 10-15 days to complete the inspection and request repairs from the seller." },
  { q: "What is an appraisal and why does it matter?", a: "An appraisal is an independent evaluation of the home's market value ordered by your lender. If the home appraises below the purchase price you may need to negotiate with the seller or cover the difference." },
  { q: "What does Clear to Close mean?", a: "Clear to Close means your lender has approved your loan and all conditions have been satisfied. This is the final green light before closing day. Once you receive this, closing is imminent." },
  { q: "What do I bring to closing?", a: "Bring a valid government-issued photo ID, your cashier's check or proof of wire transfer if applicable, and any documents your lender or title company requested. Your agent will give you specific instructions." },
  { q: "Is wire fraud a real risk?", a: "Yes — wire fraud is very common in real estate. Never wire money based on email instructions alone. Always call the title company directly using a number you find independently to confirm wire instructions before sending any money." },
  { q: "When do I get the keys?", a: "You typically receive the keys at the closing table after all documents are signed and funds are confirmed. In some cases key transfer may be scheduled for later that day if funding takes time." },
  { q: "What is title insurance?", a: "Title insurance protects you against claims on your property from before you owned it — like unpaid taxes, liens, or ownership disputes. It is a one-time fee paid at closing and protects you for as long as you own the home." },
  { q: "What should I NOT do while under contract?", a: "Do not make large purchases, open new credit cards, change jobs, or move money between bank accounts without telling your lender. These can affect your loan approval. Stay financially stable until after closing." },
];

function FaqItem({ item }) {
  const [open, setOpen] = useState(false);
  const C = { red: "#C0392B", black: "#111111", gray: "#555555", lightGray: "#F4F4F4", border: "#DDDDDD" };
  return (
    <div style={{ background: "#fff", borderRadius: 12, marginBottom: 10,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: "100%", padding: "16px 18px", border: "none",
          background: "none", textAlign: "left", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 12, fontFamily: "inherit" }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.black, lineHeight: 1.4 }}>
          {item.q}
        </span>
        <span style={{ fontSize: 20, color: C.red, flexShrink: 0, fontWeight: 300 }}>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 16px", fontSize: 13, color: C.gray,
          lineHeight: 1.7, borderTop: "1px solid " + C.lightGray, paddingTop: 12 }}>
          {item.a}
        </div>
      )}
    </div>
  );
}

function FaqTab({ agentPhone }) {
  const C = { red: "#C0392B", gray: "#555555" };
  return (
    <div>
      <div style={{ fontSize: 13, color: C.gray, marginBottom: 16, lineHeight: 1.6 }}>
        Common questions about your real estate transaction answered simply.
      </div>
      {FAQ_ITEMS.map((item, i) => <FaqItem key={i} item={item} />)}
      <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: C.gray }}>
        Have another question?{" "}
        {agentPhone && (
          <a href={"tel:" + agentPhone} style={{ color: C.red, fontWeight: 600 }}>
            Call your agent
          </a>
        )}
      </div>
    </div>
  );
}

// ── MAIN CLIENT PORTAL ────────────────────────────────────────
export default function ClientPortal({ user, onLogout }) {
  const [tx, setTx] = useState(null);
  const [allTx, setAllTx] = useState([]);
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

  const mapTx = (t) => ({
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

  useEffect(() => {
    fetch(API + "/client/transactions", { headers })
      .then(r => r.json())
      .then(data => {
        // A client can have MULTIPLE properties (e.g. selling two at once).
        // Keep them all and let the client switch; default to the first.
        const list = (data.transactions || []).map(mapTx);
        setAllTx(list);
        if (list.length > 0) {
          setTx(list[0]);
          return fetch(API + "/client/documents/" + list[0].id, { headers });
        }
      })
      .then(r => r && r.json())
      .then(data => { if (data && data.documents) setDocs(data.documents); })
      .catch(e => console.error("Load failed:", e))
      .finally(() => setLoading(false));
  }, []);

  // Switch which property the portal is showing.
  const switchProperty = (id) => {
    const next = allTx.find(t => t.id === id);
    if (!next) return;
    setTx(next);
    setDocs([]);
    fetch(API + "/client/documents/" + id, { headers })
      .then(r => r.json())
      .then(data => { if (data && data.documents) setDocs(data.documents); })
      .catch(e => console.error("Load docs failed:", e));
  };

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
    if (file.size > 50 * 1024 * 1024) {
      alert(`File too large. Maximum is 50 MB, this file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
      if (e.target) e.target.value = "";
      return;
    }
    const ALLOWED = [
      "application/pdf",
      "image/jpeg", "image/png", "image/heic", "image/heif", "image/gif", "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (file.type && !ALLOWED.includes(file.type)) {
      alert(`File type "${file.type}" not allowed. Please upload a PDF, image, or Word document.`);
      if (e.target) e.target.value = "";
      return;
    }
    setUploading(true);
    let docId = null;
    try {
      const res = await fetch(API + "/documents/upload-url", {
        method: "POST", headers,
        body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type, category: "Client Upload" }),
      });
      const data = await res.json();
      if (!data.uploadUrl) throw new Error("No upload URL");
      docId = data.docId;
      const putRes = await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("Storage upload failed (" + putRes.status + ")");
      // 2-step: confirm the R2 PUT succeeded so the row flips from
      // pending_upload to active. Otherwise the doc never appears.
      const finRes = await fetch(API + "/documents/" + docId + "/finalize", { method: "POST", headers });
      if (!finRes.ok) throw new Error("Finalize failed");
      docId = null;
      const docsRes = await fetch(API + "/client/documents/" + tx.id, { headers });
      const docsData = await docsRes.json();
      if (docsData.documents) setDocs(docsData.documents);
      alert("Document uploaded successfully!");
    } catch (err) {
      alert("Upload failed: " + err.message);
      if (docId) {
        fetch(API + "/documents/" + docId + "/pending", { method: "DELETE", headers }).catch(e => console.error("[bg]", e && e.message ? e.message : e));
      }
    }
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

  const isBuyerSide = tx && (tx.type === "Buyer Representation" || tx.type === "Dual Agency" || (tx.transactionType && tx.transactionType.includes("Buyer")));
  const isSellerSide = tx && (tx.type === "Listing (Seller)" || tx.type === "Dual Agency" || (tx.transactionType && (tx.transactionType.includes("Listing") || tx.transactionType.includes("Seller"))));

  // Hide the OPPOSITE side's agent from "My Team" so a client never sees (and
  // can't cold-call) the other side's agent. Seller-side clients don't see the
  // buyer's agent; buyer-side clients don't see the listing/seller's agent.
  // Their own agent still shows at the top via owningAgent. Role strings vary
  // ("Buyer's Agent"/"Buyer Agent", "Listing Agent"/"Seller's Agent") so match loosely.
  const hideOppositeAgent = (role) => {
    const r = (role || "").toLowerCase();
    if (!r.includes("agent")) return false;
    if (isSellerSide && r.includes("buyer")) return true;
    if (isBuyerSide && (r.includes("listing") || r.includes("seller"))) return true;
    return false;
  };
  const teamParties = tx ? tx.parties.filter(p => p.role !== "Buyer" && p.role !== "Seller" && !hideOppositeAgent(p.role)) : [];

  const tabs = [
    { id: "home", label: "🏠 My Transaction" },
    { id: "documents", label: "📎 Documents" },
    { id: "chat", label: chatUnread > 0 ? "💬 Chat (" + chatUnread + ")" : "💬 Chat" },
    { id: "team", label: "👥 My Team" },
    { id: "vendors", label: "🏆 Vendors" },
    ...(isBuyerSide ? [{ id: "calculator", label: "🧮 Buyer Calc" }] : []),
    ...(isSellerSide ? [{ id: "seller-calc", label: "💰 Net Proceeds" }] : []),
    { id: "faq", label: "❓ FAQ" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.lightGray,
      fontFamily: "system-ui, sans-serif", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: "#111111", padding: "14px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "2px solid #C0392B" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#C0392B",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 2px 8px rgba(192,57,43,0.4)" }}>
            <span style={{ color: "#fff", fontSize: 20, fontWeight: 900, lineHeight: 1 }}>T</span>
          </div>
          <div>
            <div style={{ color: "#ffffff", fontWeight: 800, fontSize: 17, letterSpacing: "-0.3px" }}>
              TransactPro
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 1, fontWeight: 500 }}>
              Welcome, {user.firstName}! 👋
            </div>
          </div>
        </div>
        <button onClick={onLogout}
          style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.5)",
            color: "#ffffff", borderRadius: 8, padding: "7px 18px",
            cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            letterSpacing: "0.3px" }}>
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
            {allTx.length > 1 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Your Properties ({allTx.length})</div>
                <select value={tx.id} onChange={e => switchProperty(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>
                  {allTx.map(t => <option key={t.id} value={t.id} style={{ color: "#111" }}>{t.address}{t.city ? ", " + t.city : ""} — {t.status}</option>)}
                </select>
              </div>
            )}
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

          {/* Top Horizontal Scroll Tabs */}
          <div style={{ display: "flex", overflowX: "auto", borderBottom: "2px solid " + C.border,
            background: C.white, scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ padding: "12px 18px", border: "none", background: "none", whiteSpace: "nowrap",
                  borderBottom: "3px solid " + (activeTab === tab.id ? C.red : "transparent"),
                  color: activeTab === tab.id ? C.red : C.gray,
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ padding: "16px 16px 40px", maxWidth: 600, margin: "0 auto" }}>

            {/* HOME TAB */}
            {activeTab === "home" && (
              <div>
                <LatestUpdateCard tx={tx} agentName={agentName} />
                <ActionNeededCard tx={tx} />

                {/* Key Dates & Financials */}
                <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.gray,
                    textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                    KEY DATES & DETAILS
                  </div>
                  {[
                    { label: "Property", value: tx.address + (tx.city ? ", " + tx.city : "") },
                    { label: "Property Type", value: tx.propertyType || "—" },
                    { label: "Transaction Type", value: tx.transactionType || "—" },
                    { label: "Contract Date", value: formatDate(tx.openDate) },
                    { label: "Closing Date", value: formatDate(tx.closingDate) },
                    { label: "Days to Closing", value: daysUntil(tx.closingDate) !== null && daysUntil(tx.closingDate) >= 0 ? daysUntil(tx.closingDate) + " days" : tx.status === "Closed" ? "Closed" : "TBD" },
                    { label: "Contract Price", value: tx.contractPrice ? "$" + Number(tx.contractPrice).toLocaleString() : "TBD" },
                    ...(tx.listPrice && tx.listPrice !== tx.contractPrice ? [{ label: "List Price", value: "$" + Number(tx.listPrice).toLocaleString() }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", paddingBottom: 10, marginBottom: 10,
                      borderBottom: "1px solid " + C.lightGray }}>
                      <span style={{ fontSize: 13, color: C.gray }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.black,
                        textAlign: "right", maxWidth: "60%" }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* What Happens Next */}
                <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.gray,
                    textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                    WHAT HAPPENS NEXT
                  </div>
                  {(() => {
                    const isBuyer = tx.transactionType && tx.transactionType.includes("Buyer");
                    const steps = {
                      "Active": isBuyer ? [
                        { icon: "🏦", text: "Make sure your pre-approval letter is current" },
                        { icon: "🔍", text: "Continue searching for your ideal home with your agent" },
                        { icon: "📋", text: "Once you find the right home, your agent will help you submit a strong offer" },
                      ] : [
                        { icon: "📸", text: "Professional photos and marketing are being prepared" },
                        { icon: "🏠", text: "Your home will be listed on MLS and major platforms" },
                        { icon: "📅", text: "Showings will be scheduled as buyers express interest" },
                      ],
                      "Under Contract": [
                        { icon: "🔍", text: "Schedule and complete the home inspection" },
                        { icon: "💰", text: "Ensure earnest money deposit is submitted on time" },
                        { icon: "🏦", text: "Work closely with your lender to complete loan application" },
                        { icon: "📋", text: "Review and respond to any inspection findings" },
                      ],
                      "Inspection": [
                        { icon: "📋", text: "Review inspection report carefully with your agent" },
                        { icon: "🔧", text: "Decide which repairs to request from the seller" },
                        { icon: "🏦", text: "Keep in close contact with your lender" },
                      ],
                      "Appraisal": [
                        { icon: "🏦", text: "Appraisal is being completed by your lender" },
                        { icon: "📋", text: "Respond quickly to any document requests from your lender" },
                        { icon: "✅", text: "Await loan approval — you are almost there" },
                      ],
                      "Clear to Close": [
                        { icon: "🏦", text: "Contact title company to confirm wire instructions by phone" },
                        { icon: "🚶", text: "Schedule your final walk-through" },
                        { icon: "📋", text: "Bring valid photo ID and any remaining documents to closing" },
                        { icon: "🔑", text: "Get ready to receive your keys!" },
                      ],
                      "Closed": [
                        { icon: "🎉", text: "Congratulations! The transaction is complete" },
                        { icon: "📮", text: "Update your address with the post office and your bank" },
                        { icon: "🔑", text: "Consider changing the locks for added security" },
                        { icon: "📁", text: "Keep all closing documents in a safe place for tax purposes" },
                      ],
                    };
                    const currentSteps = steps[tx.status] || steps["Active"];
                    return currentSteps.map((step, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start",
                        marginBottom: 12 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{step.icon}</span>
                        <span style={{ fontSize: 13, color: C.black, lineHeight: 1.6 }}>{step.text}</span>
                      </div>
                    ));
                  })()}
                </div>

                {/* Agent contact card */}
                {agentName && (
                  <div style={{ background: C.white, borderRadius: 14, padding: 18,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)", marginBottom: 14 }}>
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

                        {/* VENDORS TAB */}
            {activeTab === "vendors" && (
              <VendorsTab tx={tx} token={localStorage.getItem("tp_token") || ""} user={user} />
            )}

            {/* FAQ TAB */}
            {activeTab === "calculator" && (
              <div style={{ padding: 16 }}>
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#7f1d1d" }}>
                  <strong>🎓 Why this matters:</strong> Buying a home in Florida has costs many buyers don't expect — doc stamps, intangible tax, insurance. Use these calculators to plan with no surprises at closing.
                </div>
                <BuyerCalculator />
              </div>
            )}

            {activeTab === "seller-calc" && (
              <div style={{ padding: 16 }}>
                <div style={{ background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#0c4a6e" }}>
                  <strong>🎓 Why this matters:</strong> Estimate the cash you'll walk away with after selling. Florida sellers typically pay agent commission, doc stamps (~0.7%), title insurance, and any negotiated concessions or repairs. This gives you a realistic net.
                </div>
                <SellerCalculator />
              </div>
            )}

            {activeTab === "faq" && (
              <FaqTab agentPhone={agentPhone} />
            )}

            {/* TEAM TAB */}
            {activeTab === "team" && (
              <div>
                <div style={{ fontSize: 13, color: C.gray, marginBottom: 16, lineHeight: 1.6 }}>
                  Your transaction team is here to support you every step of the way.
                </div>
                {/* Always show agent first */}
                {agentName && (
                  <div style={{ display: "flex", alignItems: "center", gap: 14,
                    padding: 16, background: C.white, borderRadius: 12, marginBottom: 10,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderLeft: "4px solid " + C.red }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.black,
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      {agentName[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{agentName}</div>
                      <div style={{ fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 6 }}>
                        Your Agent {tx.owningBrokerage ? "· " + tx.owningBrokerage : ""}
                      </div>
                      {agentPhone && (
                        <a href={"tel:" + agentPhone}
                          style={{ fontSize: 13, color: "#1A5276", display: "block" }}>
                          📞 {agentPhone}
                        </a>
                      )}
                      {agentEmail && (
                        <a href={"mailto:" + agentEmail}
                          style={{ fontSize: 13, color: "#1A5276", marginTop: 2, display: "block" }}>
                          ✉️ {agentEmail}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {teamParties.length === 0 && !agentName ? (
                  <div style={{ textAlign: "center", padding: 40, color: C.gray }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
                    <div>No team members listed yet</div>
                  </div>
                ) : teamParties.map(p => (
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
