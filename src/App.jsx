import LoginScreen from "./LoginScreen";
import UserManagement from "./UserManagement";
import DocumentsTab from "./DocumentsTab";
import TransactionChat from "./TransactionChat";
import Reports from "./Reports";
import CalendarView from "./CalendarView";
import ChangePassword from "./ChangePassword";
import CompanySettings from "./CompanySettings";
import AgentProfile from "./AgentProfile";
import ClientPortal from "./ClientPortal";
const API = "https://liz-team-server-api-production.up.railway.app";

import { useState, useEffect, useCallback, useRef } from "react";

const COLORS = {
  navy: "#111111", gold: "#C0392B", lightGold: "#FADBD8",
  bg: "#F4F4F4", white: "#FFFFFF", text: "#111111", muted: "#666666",
  border: "#DDDDDD", success: "#1E8449", successBg: "#D5F5E3",
  warning: "#B7770D", warningBg: "#FEF9E7", danger: "#C0392B",
  dangerBg: "#FADBD8", info: "#1A5276", infoBg: "#D6EAF8",
  // TransactPro brand
  red: "#C0392B", darkRed: "#922B21", lightRed: "#FADBD8",
  black: "#111111", darkGray: "#222222", gray: "#555555",
  lightGray: "#F4F4F4", midGray: "#CCCCCC",
};

const SMS_SERVER = API;

const TRANSACTION_TYPES = ["Listing (Seller)", "Buyer Representation", "Dual Agency"];
const PROPERTY_TYPES = ["Single Family", "Condo/Townhouse", "Multi-Family", "Land", "Commercial"];
const COUNTIES = ["Orange", "Osceola", "Seminole", "Polk", "Brevard", "Lake", "Volusia", "Hillsborough", "Other"];
const PARTY_ROLES = [
  "Listing Agent", "Buyer's Agent", "Transaction Coordinator",
  "Title Company", "Loan Officer/Lender", "Inspector", "Appraiser",
  "HOA Manager", "Seller", "Buyer", "Attorney", "Insurance Agent", "Other"
];

const EMAIL_TEMPLATES = [
  { label: "Intro", subject: (addr) => `Your Transaction — ${addr}`, body: (name, addr, agent) => `Hi ${name},

This is ${agent}. I wanted to reach out regarding your transaction at ${addr}.

I'm here to guide you through this process and make sure everything goes smoothly. Please don't hesitate to reach out if you have any questions.

Best regards,
${agent}` },
  { label: "Documents Needed", subject: (addr) => `Documents Required — ${addr}`, body: (name, addr, agent) => `Hi ${name},

I hope you're doing well! I'm reaching out regarding ${addr} because we still need the following documents to keep your transaction on track.

Please send these as soon as possible to avoid any delays in your closing.

If you have any questions about what's needed, please call or text me directly.

Best regards,
${agent}` },
  { label: "Inspection Scheduled", subject: (addr) => `Inspection Scheduled — ${addr}`, body: (name, addr, agent, closing) => `Hi ${name},

Great news! The inspection for ${addr} has been scheduled.

Please ensure the property is accessible at the scheduled time. If you have a lockbox code, please confirm it's active.

If you have any questions, don't hesitate to reach out.

Best regards,
${agent}` },
  { label: "Closing Reminder", subject: (addr) => `Closing Reminder — ${addr}`, body: (name, addr, agent, closing) => `Hi ${name},

This is a reminder that your closing for ${addr} is approaching${closing ? " on " + closing : ""}.

Please make sure you:
• Have a valid government-issued photo ID
• Have your cashier's check or wire transfer ready (if applicable)
• Review all closing documents in advance
• Confirm the closing time and location with the title company

Please don't hesitate to contact me with any questions.

Best regards,
${agent}` },
  { label: "Under Contract", subject: (addr) => `Under Contract — ${addr}`, body: (name, addr, agent, closing) => `Hi ${name},

Excellent news! ${addr} is now officially under contract!

Closing Date: ${closing || "TBD"}

Here are the next steps:
• Inspection will be scheduled within the inspection period
• Please ensure all requested documents are submitted promptly
• Stay in touch with your lender if financing is involved

I'll keep you updated every step of the way. Feel free to reach out anytime.

Best regards,
${agent}` },
  { label: "Clear to Close", subject: (addr) => `Clear to Close — ${addr}`, body: (name, addr, agent, closing) => `Hi ${name},

Fantastic news! We have received Clear to Close for ${addr}!

Closing Date: ${closing || "TBD"}

This means all conditions have been satisfied and we are ready to close. The title company will be reaching out with final closing figures and instructions.

Please review the Closing Disclosure carefully and contact me with any questions.

We're almost there!

Best regards,
${agent}` },
  { label: "Thank You", subject: (addr) => `Thank You — ${addr}`, body: (name, addr, agent) => `Hi ${name},

Thank you so much for trusting us with your real estate transaction at ${addr}.

It was a pleasure working with you and I hope we exceeded your expectations. If you ever need anything in the future or know someone buying or selling, I would love to help!

A referral is the greatest compliment I can receive.

Wishing you all the best!

Warm regards,
${agent}` },
];

// phase: "active" = pre-contract tasks (no due dates, sorted by category)
// phase: "contract" = under contract tasks (due dates from executed date)
// phase: "closing" = post-closing tasks (due dates from closing date)
const FLORIDA_TASK_TEMPLATES = {
  "Listing (Seller)": [
    // ── PHASE 1: PRE-LISTING PREP ────────────────────────────
    { name: "Draft Listing Docs for Listing Appointment", phase: "active", daysFromOpen: null, category: "Pre-Listing", assignTo: "Listing Agent" },
    { name: "Receive All Listing Docs Signed (upload if wet signed)", phase: "active", daysFromOpen: null, category: "Pre-Listing", assignTo: "Listing Agent" },
    { name: "Send Copy of Listing Documents to Seller", phase: "active", daysFromOpen: null, category: "Pre-Listing", assignTo: "Listing Agent" },
    { name: "Upload Listing Agreement (required)", phase: "active", daysFromOpen: null, category: "Pre-Listing", assignTo: "Listing Agent" },
    { name: "Upload MLS Data Entry Form (required)", phase: "active", daysFromOpen: null, category: "Pre-Listing", assignTo: "Listing Agent" },
    { name: "Upload Broker's Seller Disclosure (required)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
    { name: "Upload Seller's Property Disclosure (required)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
    { name: "Upload Flood Disclosure (required)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
    { name: "Upload Rider B - HOA (if applicable)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
    { name: "Upload Rider A - Condominium (if applicable)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
    { name: "Upload Rider P - Lead-Based Paint (if built before 1978)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
    { name: "Upload Rider AA - Licensee Disclosure (if agent related to seller)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
    { name: "Confirm HOA/Condo Docs if Applicable", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Transaction Coordinator" },
    { name: "Pre-Listing Home Inspection (optional)", phase: "active", daysFromOpen: null, category: "Inspection", assignTo: "Inspector" },
    // ── PHASE 2: MARKETING ───────────────────────────────────
    { name: "Schedule Property Photos / Drone / Virtual Tour", phase: "active", daysFromOpen: null, category: "Marketing", assignTo: "Listing Agent" },
    { name: "Input Listing into MLS (Stellar MLS)", phase: "active", daysFromOpen: null, category: "Marketing", assignTo: "Listing Agent" },
    { name: "Send MLS Listing to Seller for Review", phase: "active", daysFromOpen: null, category: "Marketing", assignTo: "Listing Agent" },
    { name: "Review Showing Times and Instructions with Seller", phase: "active", daysFromOpen: null, category: "Marketing", assignTo: "Listing Agent" },
    { name: "Once Active - Send Seller Active MLS Broker Synopsis", phase: "active", daysFromOpen: null, category: "Marketing", assignTo: "Listing Agent" },
    { name: "Print and Upload Active MLS Broker Synopsis", phase: "active", daysFromOpen: null, category: "Marketing", assignTo: "Transaction Coordinator" },
    { name: "Syndicate to Zillow, Realtor.com, etc.", phase: "active", daysFromOpen: null, category: "Marketing", assignTo: "Listing Agent" },
    { name: "Schedule Open House (if applicable)", phase: "active", daysFromOpen: null, category: "Marketing", assignTo: "Listing Agent" },
    { name: "Review and Negotiate Offer(s)", phase: "active", daysFromOpen: null, category: "Marketing", assignTo: "Listing Agent" },
    // ── PHASE 3: UNDER CONTRACT ──────────────────────────────
    { name: "Execute FR/Bar AS-IS or Standard Contract", phase: "contract", daysFromOpen: 0, category: "Contract", assignTo: "Transaction Coordinator" },
    { name: "Send Fully Executed Contract to All Parties", phase: "contract", daysFromOpen: 0, category: "Contract", assignTo: "Transaction Coordinator" },
    { name: "Open Escrow / Title Order", phase: "contract", daysFromOpen: 1, category: "Title", assignTo: "Title Company" },
    { name: "Verify Earnest Money Deposit Received (3 business days)", phase: "contract", daysFromOpen: 3, category: "Escrow", assignTo: "Transaction Coordinator" },
    { name: "Confirm Inspection Scheduled", phase: "contract", daysFromOpen: 3, category: "Inspection", assignTo: "Listing Agent" },
    { name: "Inspection Period Ends (default 10 days per FR/Bar)", phase: "contract", daysFromOpen: 10, category: "Inspection", assignTo: "Inspector" },
    { name: "Buyer Inspection Notice & Seller Response (BINSR)", phase: "contract", daysFromOpen: 12, category: "Inspection", assignTo: "Listing Agent" },
    { name: "HOA Approval (if applicable)", phase: "contract", daysFromOpen: 14, category: "HOA", assignTo: "HOA Manager" },
    { name: "Appraisal Ordered", phase: "contract", daysFromOpen: 14, category: "Financing", assignTo: "Appraiser" },
    { name: "Title Search Completed", phase: "contract", daysFromOpen: 14, category: "Title", assignTo: "Title Company" },
    { name: "Survey (if required)", phase: "contract", daysFromOpen: 14, category: "Title", assignTo: "Title Company" },
    { name: "Appraisal Report Received", phase: "contract", daysFromOpen: 21, category: "Financing", assignTo: "Appraiser" },
    { name: "Loan Approval Period Monitoring (if financed)", phase: "contract", daysFromOpen: 21, category: "Financing", assignTo: "Loan Officer/Lender" },
    { name: "Title Commitment Issued", phase: "contract", daysFromOpen: 21, category: "Title", assignTo: "Title Company" },
    { name: "Homeowner's Insurance Binding (Buyer to provide)", phase: "contract", daysFromOpen: 21, category: "Insurance", assignTo: "Insurance Agent" },
    { name: "Closing Disclosure (CD) Review", phase: "contract", daysFromOpen: -3, category: "Closing", assignTo: "Title Company" },
    { name: "Final Walk-Through (24-48 hrs before closing)", phase: "contract", daysFromOpen: -1, category: "Closing", assignTo: "Listing Agent" },
    { name: "Confirm Wire Transfer / Proceeds", phase: "contract", daysFromOpen: -1, category: "Closing", assignTo: "Title Company" },
    // ── PHASE 4: POST-CLOSING ────────────────────────────────
    { name: "Closing Day / Deed Recorded", phase: "closing", daysFromOpen: 0, category: "Post-Closing", assignTo: "Title Company" },
    { name: "Collect Keys / Garage Remotes from Seller", phase: "closing", daysFromOpen: 0, category: "Post-Closing", assignTo: "Listing Agent" },
    { name: "MLS Status Update to Closed", phase: "closing", daysFromOpen: 1, category: "Post-Closing", assignTo: "Listing Agent" },
    { name: "Commission Disbursement (per DBPR rules)", phase: "closing", daysFromOpen: 1, category: "Post-Closing", assignTo: "Transaction Coordinator" },
    { name: "Send Thank You Note to Seller", phase: "closing", daysFromOpen: 1, category: "Post-Closing", assignTo: "Listing Agent" },
    { name: "Request Google/Zillow Review from Seller", phase: "closing", daysFromOpen: 2, category: "Post-Closing", assignTo: "Listing Agent" },
  ],
  "Buyer Representation": [
    // ── PHASE 1: BUYER CONSULTATION ──────────────────────────
    { name: "Execute Buyer Representation Agreement (per FL SB 1076)", phase: "active", daysFromOpen: null, category: "Consultation", assignTo: "Buyer's Agent" },
    { name: "Buyer Needs Analysis / Consultation Notes", phase: "active", daysFromOpen: null, category: "Consultation", assignTo: "Buyer's Agent" },
    { name: "Verify Pre-Approval Letter Obtained", phase: "active", daysFromOpen: null, category: "Consultation", assignTo: "Loan Officer/Lender" },
    { name: "Set Up MLS Property Search / Auto Alerts", phase: "active", daysFromOpen: null, category: "Consultation", assignTo: "Buyer's Agent" },
    { name: "Review Market Conditions with Buyer", phase: "active", daysFromOpen: null, category: "Consultation", assignTo: "Buyer's Agent" },
    { name: "Discuss Buyer's Must-Haves vs Nice-to-Haves", phase: "active", daysFromOpen: null, category: "Consultation", assignTo: "Buyer's Agent" },
    // ── PHASE 2: SHOWINGS ────────────────────────────────────
    { name: "Schedule and Conduct Property Showings", phase: "active", daysFromOpen: null, category: "Showing", assignTo: "Buyer's Agent" },
    { name: "Provide Showing Feedback and Market Analysis", phase: "active", daysFromOpen: null, category: "Showing", assignTo: "Buyer's Agent" },
    { name: "Discuss Offer Strategy with Buyer", phase: "active", daysFromOpen: null, category: "Showing", assignTo: "Buyer's Agent" },
    { name: "Submit Offer (FR/Bar Contract)", phase: "active", daysFromOpen: null, category: "Showing", assignTo: "Buyer's Agent" },
    { name: "Negotiate Offer / Counter Offer", phase: "active", daysFromOpen: null, category: "Showing", assignTo: "Buyer's Agent" },
    // ── PHASE 3: UNDER CONTRACT ──────────────────────────────
    { name: "Send Fully Executed Contract to All Parties", phase: "contract", daysFromOpen: 0, category: "Contract", assignTo: "Transaction Coordinator" },
    { name: "Earnest Money Deposit to Escrow (3 business days per FL law)", phase: "contract", daysFromOpen: 3, category: "Escrow", assignTo: "Transaction Coordinator" },
    { name: "Open Title Order", phase: "contract", daysFromOpen: 1, category: "Title", assignTo: "Title Company" },
    { name: "Schedule Home Inspection", phase: "contract", daysFromOpen: 2, category: "Inspection", assignTo: "Inspector" },
    { name: "Submit Formal Loan Application", phase: "contract", daysFromOpen: 5, category: "Financing", assignTo: "Loan Officer/Lender" },
    { name: "Inspection Period Ends (default 10 days per FR/Bar)", phase: "contract", daysFromOpen: 10, category: "Inspection", assignTo: "Inspector" },
    { name: "Appraisal Ordered by Lender", phase: "contract", daysFromOpen: 10, category: "Financing", assignTo: "Appraiser" },
    { name: "Review Inspection Report with Buyer", phase: "contract", daysFromOpen: 11, category: "Inspection", assignTo: "Buyer's Agent" },
    { name: "Submit BINSR / Request Repairs or Credit", phase: "contract", daysFromOpen: 11, category: "Inspection", assignTo: "Buyer's Agent" },
    { name: "HOA Application & Approval (if applicable)", phase: "contract", daysFromOpen: 14, category: "HOA", assignTo: "HOA Manager" },
    { name: "Loan Approval / Commitment Letter Received", phase: "contract", daysFromOpen: 21, category: "Financing", assignTo: "Loan Officer/Lender" },
    { name: "Review Title Commitment with Buyer", phase: "contract", daysFromOpen: 21, category: "Title", assignTo: "Title Company" },
    { name: "Bind Homeowner's Insurance", phase: "contract", daysFromOpen: 21, category: "Insurance", assignTo: "Insurance Agent" },
    { name: "Review Closing Disclosure (3-day wait per RESPA)", phase: "contract", daysFromOpen: -3, category: "Closing", assignTo: "Buyer's Agent" },
    { name: "Wire Closing Funds to Title Company", phase: "contract", daysFromOpen: -1, category: "Closing", assignTo: "Buyer" },
    { name: "Final Walk-Through", phase: "contract", daysFromOpen: -1, category: "Closing", assignTo: "Buyer's Agent" },
    // ── PHASE 4: POST-CLOSING ────────────────────────────────
    { name: "Closing Day / Keys Delivered to Buyer", phase: "closing", daysFromOpen: 0, category: "Post-Closing", assignTo: "Title Company" },
    { name: "Remind Buyer to Change Locks", phase: "closing", daysFromOpen: 0, category: "Post-Closing", assignTo: "Buyer's Agent" },
    { name: "Remind Buyer to Transfer Utilities", phase: "closing", daysFromOpen: 0, category: "Post-Closing", assignTo: "Transaction Coordinator" },
    { name: "Commission Disbursement", phase: "closing", daysFromOpen: 1, category: "Post-Closing", assignTo: "Transaction Coordinator" },
    { name: "Send Thank You Note to Buyer", phase: "closing", daysFromOpen: 1, category: "Post-Closing", assignTo: "Buyer's Agent" },
    { name: "Request Google/Zillow Review from Buyer", phase: "closing", daysFromOpen: 2, category: "Post-Closing", assignTo: "Buyer's Agent" },
    { name: "Remind Buyer to Update Address (USPS, Bank, DMV, etc.)", phase: "closing", daysFromOpen: 3, category: "Post-Closing", assignTo: "Transaction Coordinator" },
  ],
  "Dual Agency": []
};

const STATUS_CONFIG = {
  "Active": { color: "#B7860B", bg: "#FEF9E7" },
  "Under Contract": { color: "#1D4ED8", bg: "#DBEAFE" },
  "Closed": { color: "#1E8449", bg: "#F0FFF4" },
  "On Hold": { color: "#6B7280", bg: "#F3F4F6" },
  "Cancelled": { color: "#C0392B", bg: "#FEE2E2" },
};

const TASK_STATUS = {
  "Pending": { color: COLORS.muted, bg: "#F3F4F6" },
  "In Progress": { color: COLORS.info, bg: COLORS.infoBg },
  "Completed": { color: COLORS.success, bg: COLORS.successBg },
  "Overdue": { color: COLORS.danger, bg: COLORS.dangerBg },
  "Waived": { color: COLORS.muted, bg: "#F3F4F6" },
};


// ─── INJECT MOBILE STYLES ─────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("lizteam-mobile")) {
  const s = document.createElement("style");
  s.id = "lizteam-mobile";
  s.textContent = `
    *, *::before, *::after { box-sizing: border-box !important; }
    body { overflow-x: hidden !important; }
    #root { max-width: 100vw; overflow-x: hidden; }
    input, textarea, select { font-size: 16px !important; }
    @media (max-width: 768px) {
      [data-stats-bar] { overflow-x: auto !important; -webkit-overflow-scrolling: touch; flex-wrap: nowrap !important; padding-bottom: 8px; }
      [data-stats-bar] > div { min-width: 120px !important; flex-shrink: 0 !important; }
      [data-msg-grid] { grid-template-columns: 1fr !important; height: auto !important; min-height: 480px; }
      [data-form-grid] { grid-template-columns: 1fr !important; }
      [data-tx-grid] { grid-template-columns: 1fr !important; }
      [data-modal] { width: 100% !important; max-width: 100vw !important; max-height: 100vh !important; border-radius: 0 !important; overflow-y: auto !important; }
      [data-tabs] { overflow-x: auto !important; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch; }
      [data-header] { flex-wrap: wrap !important; gap: 8px !important; }
    }
  `;
  document.head.appendChild(s);
}

function genId() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); }); }
function today() { return new Date().toISOString().split("T")[0]; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().split("T")[0]; }
function formatDate(s) { if (!s) return "—"; const clean = String(s).includes("T") ? String(s).split("T")[0] : String(s); const d = new Date(clean + "T00:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function daysUntil(s) { if (!s) return null; const clean = String(s).includes("T") ? String(s).split("T")[0] : String(s); const diff = new Date(clean + "T00:00:00") - new Date(today() + "T00:00:00"); return Math.round(diff / 86400000); }
function formatTime(iso) { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function roleColor(role) { const c = ["#1D4ED8","#15803D","#C9A84C","#7C3AED","#DC2626","#0F766E","#B45309","#9D174D"]; return c[role.length % c.length]; }

const INITIAL_TRANSACTIONS = [{
  id: "demo1", address: "1842 Magnolia Blossom Dr", city: "St. Cloud", county: "Osceola",
  zipCode: "34771", type: "Listing (Seller)", propertyType: "Single Family",
  listPrice: 435000, contractPrice: 428500, status: "Under Contract",
  openDate: addDays(today(), -15), closingDate: addDays(today(), 25),
  mlsNumber: "O6234871", notes: "Seller motivated. HOA docs requested.",
  parties: [
    { id: genId(), role: "Listing Agent", name: "Limarys Garcia", email: "liz@thelizteam.com", phone: "4075550100" },
    { id: genId(), role: "Buyer's Agent", name: "Mark Stevens", email: "mstevens@realty.com", phone: "4075550201" },
    { id: genId(), role: "Transaction Coordinator", name: "Ana Ruiz", email: "ana@tclizteam.com", phone: "4075550102" },
    { id: genId(), role: "Title Company", name: "Sunshine Title Group", email: "closing@sunshinetitle.com", phone: "4075550300" },
    { id: genId(), role: "Inspector", name: "Tom Brady Inspections", email: "tom@fl-inspect.com", phone: "4075550400" },
  ],
  tasks: [], messages: [], reminders: [], smsThreads: {},
}];
INITIAL_TRANSACTIONS[0].tasks = FLORIDA_TASK_TEMPLATES["Listing (Seller)"].map((t, i) => ({
  id: genId(), name: t.name, category: t.category, assignTo: t.assignTo,
  dueDate: t.daysFromOpen >= 0 ? addDays(INITIAL_TRANSACTIONS[0].openDate, t.daysFromOpen) : (INITIAL_TRANSACTIONS[0].closingDate ? addDays(INITIAL_TRANSACTIONS[0].closingDate, t.daysFromOpen) : null),
  status: i < 8 ? "Completed" : i < 12 ? "In Progress" : "Pending", notes: "",
}));

function Badge({ label, color, bg }) {
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color, background: bg, whiteSpace: "nowrap" }}>{label}</span>;
}

function Btn({ children, onClick, variant = "primary", small, disabled, style = {} }) {
  const styles = {
    primary: { background: COLORS.navy, color: "#fff", border: `1px solid ${COLORS.navy}` },
    secondary: { background: "#fff", color: COLORS.navy, border: `1px solid ${COLORS.navy}` },
    ghost: { background: "transparent", color: COLORS.muted, border: `1px solid ${COLORS.border}` },
    danger: { background: COLORS.danger, color: "#fff", border: `1px solid ${COLORS.danger}` },
    gold: { background: COLORS.gold, color: "#fff", border: `1px solid ${COLORS.gold}` },
    green: { background: COLORS.success, color: "#fff", border: `1px solid ${COLORS.success}` },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...styles[variant], padding: small ? "4px 12px" : "8px 18px", borderRadius: 8, fontSize: small ? 12 : 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit", ...style }}>{children}</button>;
}

function Input({ label, value, onChange, type = "text", placeholder, required, options, style = {} }) {
  const base = { width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", color: COLORS.text, background: "#fff", boxSizing: "border-box", ...style };
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}{required && <span style={{ color: COLORS.danger }}> *</span>}</label>}
      {options ? <select value={value} onChange={e => onChange(e.target.value)} style={base}><option value="">Select...</option>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>
        : type === "textarea" ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...base, resize: "vertical" }} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} />}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: wide ? 800 : 520, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <h2 style={{ margin: 0, fontSize: 18, color: COLORS.navy, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: COLORS.muted }}>×</button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

function PartyAvatar({ party, size = 40 }) {
  const initials = party.name.split(" ").map(w => w[0]).join("").toUpperCase().substr(0, 2);
  const color = roleColor(party.role);
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color + "22", color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>{initials}</div>;
}

function PartyCard({ party, onRemove, onEdit, onClick, onInvite }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8, cursor: onClick ? "pointer" : "default" }}>
      <PartyAvatar party={party} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{party.name}</div>
        <div style={{ fontSize: 12, color: roleColor(party.role), fontWeight: 600, marginBottom: 2 }}>{party.role}</div>
        {party.company && <div style={{ fontSize: 12, color: COLORS.muted }}>{party.company}</div>}
        {party.email && <div style={{ fontSize: 12, color: COLORS.muted }}>{party.email}</div>}
        {party.phone && <div style={{ fontSize: 12, color: COLORS.muted }}>{party.phone}</div>}
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {onInvite && <button onClick={e => { e.stopPropagation(); onInvite(); }} style={{ background: "none", border: "1px solid #C0392B", borderRadius: 6, cursor: "pointer", color: "#C0392B", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>Send Invite</button>}
        {onEdit && <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: "pointer", color: COLORS.muted, fontSize: 12, padding: "2px 8px" }}>Edit</button>}
        {onRemove && <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, fontSize: 16 }}>×</button>}
      </div>
    </div>
  );
}

function TaskRow({ task, onUpdate, onRemind, onRemove }) {
  const due = daysUntil(task.dueDate);
  const isOverdue = due !== null && due < 0 && task.status !== "Completed" && task.status !== "Waived";
  const effectiveStatus = isOverdue && task.status === "Pending" ? "Overdue" : task.status;
  const cfg = TASK_STATUS[effectiveStatus] || TASK_STATUS["Pending"];
  return (
    <div style={{ background: "#fff", border: `1px solid ${isOverdue ? COLORS.danger + "40" : COLORS.border}`, borderLeft: `3px solid ${cfg.color}`, borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
      <input type="checkbox" checked={task.status === "Completed"} onChange={e => onUpdate({ ...task, status: e.target.checked ? "Completed" : "Pending" })} style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: task.status === "Completed" ? COLORS.muted : COLORS.text, textDecoration: task.status === "Completed" ? "line-through" : "none" }}>{task.name}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: COLORS.muted }}>{task.category}</span>
          {task.assignTo && <span style={{ fontSize: 11, color: COLORS.muted }}>→ {task.assignTo}</span>}
          {task.dueDate && <span style={{ fontSize: 11, color: isOverdue ? COLORS.danger : COLORS.muted }}>{formatDate(task.dueDate)}{due !== null && task.status !== "Completed" && ` (${due === 0 ? "Today" : due > 0 ? `${due}d` : `${Math.abs(due)}d overdue`})`}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {onRemind && task.status !== "Completed" && task.status !== "Waived" && (
          <button onClick={() => onRemind(task)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: `1px solid ${isOverdue ? COLORS.danger : COLORS.border}`, background: isOverdue ? COLORS.dangerBg : "#F9FAFB", color: isOverdue ? COLORS.danger : COLORS.muted, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap" }}>
            {isOverdue ? "⚠ Remind" : "📱 Remind"}
          </button>
        )}
        <Badge label={effectiveStatus} color={cfg.color} bg={cfg.bg} />
        <select value={task.status} onChange={e => onUpdate({ ...task, status: e.target.value })} style={{ fontSize: 12, padding: "3px 6px", borderRadius: 6, border: `1px solid ${COLORS.border}`, fontFamily: "inherit" }}>
          {Object.keys(TASK_STATUS).map(s => <option key={s}>{s}</option>)}
        </select>
        {onRemove && <button onClick={() => { if (window.confirm("Delete this task?")) onRemove(task.id); }} style={{ background: "none", border: "none", color: "#CCC", cursor: "pointer", fontSize: 16, padding: "2px 4px", lineHeight: 1 }} title="Delete task">×</button>}
      </div>
    </div>
  );
}

// ─── TASK REMINDER MODAL ──────────────────────────────────────
function TaskReminderModal({ task, tx, onClose }) {
  const [serverOnline, setServerOnline] = useState(null);
  const [selectedParties, setSelectedParties] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const due = daysUntil(task.dueDate);
  const isOverdue = due !== null && due < 0;
  const partiesWithPhone = tx.parties.filter(p => p.phone && p.phone.trim());

  useEffect(() => {
    fetch(`${SMS_SERVER}/health`).then(r => r.json()).then(() => setServerOnline(true)).catch(() => setServerOnline(false));
    // Pre-select the assigned party if they have a phone
    const assigned = tx.parties.find(p => p.role === task.assignTo && p.phone);
    if (assigned) setSelectedParties([assigned.id]);
    // Pre-fill message
    const urgency = isOverdue ? `⚠️ OVERDUE by ${Math.abs(due)} day${Math.abs(due) !== 1 ? "s" : ""}` : due === 0 ? "due TODAY" : `due in ${due} day${due !== 1 ? "s" : ""}`;
    setMessage(`Hi, this is The Liz Team Realty.\n\nThis is a reminder that the following task is ${urgency}:\n\n📋 ${task.name}\n📍 ${tx.address}, ${tx.city}, FL\n📅 Due: ${formatDate(task.dueDate)}\n\nPlease take action as soon as possible. Thank you!`);
  }, []);

  const toggleParty = (id) => setSelectedParties(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const send = async () => {
    if (!selectedParties.length || !message.trim()) return;
    setSending(true);
    const parties = selectedParties.map(id => tx.parties.find(p => p.id === id)).filter(Boolean);
    const results = [];
    for (const party of parties) {
      try {
        const res = await fetch(`${SMS_SERVER}/sms/send`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toPhone: party.phone, toName: party.name, toRole: party.role, message: message.trim(), fromName: "The Liz Team" }),
        });
        const data = await res.json();
        results.push({ name: party.name, success: data.success, error: data.error });
      } catch {
        results.push({ name: party.name, success: false, error: "Server unreachable" });
      }
    }
    setResult(results);
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 560, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, color: COLORS.navy, fontWeight: 700 }}>📱 Send Task Reminder</h2>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 3 }}>{tx.address} · {tx.city}, FL</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: COLORS.muted }}>×</button>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Task info */}
          <div style={{ background: isOverdue ? COLORS.dangerBg : COLORS.infoBg, border: `1px solid ${isOverdue ? COLORS.danger + "40" : COLORS.info + "40"}`, borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: isOverdue ? COLORS.danger : COLORS.info }}>{task.name}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
              {task.category} · Assigned to: {task.assignTo || "—"} · Due: {formatDate(task.dueDate)}
              {due !== null && <span style={{ fontWeight: 700, color: isOverdue ? COLORS.danger : COLORS.warning, marginLeft: 6 }}>
                {isOverdue ? `(${Math.abs(due)}d overdue)` : due === 0 ? "(Due today!)" : `(${due}d remaining)`}
              </span>}
            </div>
          </div>

          {/* SMS Server status */}
          {serverOnline === false && (
            <div style={{ background: COLORS.dangerBg, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: COLORS.danger }}>
              SMS server is not running. Start it first to send reminders.
            </div>
          )}

          {!result ? (
            <>
              {/* Party selection */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Notify</div>
                {partiesWithPhone.length === 0 && (
                  <div style={{ fontSize: 13, color: COLORS.muted, fontStyle: "italic" }}>No parties with phone numbers. Add phone numbers in the Parties tab.</div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, "data-form-grid": "" }}>
                  {partiesWithPhone.map(p => (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: `1px solid ${selectedParties.includes(p.id) ? COLORS.navy : COLORS.border}`, borderRadius: 8, cursor: "pointer", background: selectedParties.includes(p.id) ? "#F0F4FF" : "#fff" }}>
                      <input type="checkbox" checked={selectedParties.includes(p.id)} onChange={() => toggleParty(p.id)} />
                      <PartyAvatar party={p} size={28} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: COLORS.muted }}>{p.role}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {partiesWithPhone.length > 0 && (
                  <button onClick={() => setSelectedParties(partiesWithPhone.map(p => p.id))} style={{ marginTop: 6, fontSize: 12, color: COLORS.info, background: "none", border: "none", cursor: "pointer" }}>Select all</button>
                )}
              </div>

              {/* Editable message */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Message (editable)</div>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={8} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{message.length} characters · Edit freely before sending</div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                <Btn onClick={send} disabled={!selectedParties.length || !message.trim() || sending || !serverOnline} variant={isOverdue ? "danger" : "primary"}>
                  {sending ? "Sending..." : `Send to ${selectedParties.length} part${selectedParties.length !== 1 ? "ies" : "y"}`}
                </Btn>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                {result.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: r.success ? COLORS.success : COLORS.danger, flexShrink: 0 }} />
                    <div style={{ fontSize: 14 }}><strong>{r.name}</strong> — {r.success ? "Reminder sent ✓" : `Failed: ${r.error}`}</div>
                  </div>
                ))}
              </div>
              <Btn onClick={onClose}>Done</Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function SMSPanel({ tx, onUpdate, currentUser }) {
  const [companyName, setCompanyName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentFullName, setAgentFullName] = useState("");
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch("https://liz-team-server-api-production.up.railway.app/settings/company", { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json()).then(d => { if (d.company) setCompanyName(d.company.name || ""); }).catch(() => {});
    fetch("https://liz-team-server-api-production.up.railway.app/profile", { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json()).then(d => { 
        if (d.profile) {
          setAgentPhone(d.profile.phone || "");
          setAgentFullName(((d.profile.firstName || "") + " " + (d.profile.lastName || "")).trim());
        }
      }).catch(() => {});
  }, []);
  const [serverOnline, setServerOnline] = useState(null);
  const [emailOnline, setEmailOnline] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [channel, setChannel] = useState("sms");
  const [sending, setSending] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkChannel, setBulkChannel] = useState("sms");
  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [showReminderSMS, setShowReminderSMS] = useState(false);
  const [reminderTask, setReminderTask] = useState("");
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderChannel, setReminderChannel] = useState("both");
  const [reminderParties, setReminderParties] = useState([]);
  const [reminderSending, setReminderSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch(`${SMS_SERVER}/health`).then(r => r.json()).then(d => {
      setServerOnline(true);
      setEmailOnline(!!d.email);
    }).catch(() => setServerOnline(false));
  }, []);

  // SMS inbound polling removed - using message_log instead

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selectedParty, tx.smsThreads]);

  const partiesWithContact = tx.parties.filter(p => (p.phone && p.phone.trim()) || (p.email && p.email.trim()));
  const normalizePhone = p => { const d = p.replace(/\D/g, ""); return d.length === 10 ? `+1${d}` : `+${d}`; };
  const getThread = party => { const threads = tx.smsThreads || {}; const phoneKey = party.phone ? normalizePhone(party.phone) : null; const emailKey = party.email || null; const phoneThread = phoneKey ? (threads[phoneKey] || []) : []; const emailThread = emailKey ? (threads[emailKey] || []) : []; return [...phoneThread, ...emailThread].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); };

  const ChannelPicker = ({ value, onChange }) => (
    <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 8, padding: 3, gap: 2, overflowX: "auto", WebkitOverflowScrolling: "touch", flexShrink: 0 }}>
      {[["sms", "SMS"], ["email", "Email"], ["both", "SMS+Email"]].map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: value === v ? "#0F2044" : "transparent", color: value === v ? "#fff" : "#6B7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
      ))}
    </div>
  );

  const sendMessage = async () => {
    if (!selectedParty || !message.trim() || !serverOnline) return;
    setSending(true);
    try {
      const isSMS = channel === "sms" || channel === "both";
      const isEmail = channel === "email" || channel === "both";
      let anySent = false;
      console.log("Sending via channel:", channel, "SMS:", isSMS, "Email:", isEmail, "phone:", selectedParty.phone, "email:", selectedParty.email);
      if (isSMS && selectedParty.phone) {
        try {
          const res = await fetch(`${SMS_SERVER}/sms/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toPhone: selectedParty.phone, toName: selectedParty.name, toRole: selectedParty.role, message: message.trim(), fromName: "The Liz Team" }) });
          const d = await res.json();
          if (d.success) {
            anySent = true;
            const phone = normalizePhone(selectedParty.phone);
            const newThreads = { ...(tx.smsThreads || {}) };
            if (!newThreads[phone]) newThreads[phone] = [];
            newThreads[phone].push({ ...(d.message || {}), id: d.message?.id || Math.random().toString(36), body: message.trim(), direction: "outbound", channel: "sms", timestamp: new Date().toISOString(), status: "sent" });
            onUpdate({ ...tx, smsThreads: newThreads });
          }
        } catch(e) { console.error("SMS error", e); }
      }
      if (isEmail) {
        const emailAddr = selectedParty.email || "";
        console.log("Attempting email to:", emailAddr);
        if (emailAddr) {
          try {
            const res = await fetch(`${SMS_SERVER}/email/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toEmail: emailAddr, toName: selectedParty.name, toRole: selectedParty.role, subject: subject || `Re: ${tx.address}`, message: message.trim(), fromName: "The Liz Team" }) });
            const d = await res.json();
            console.log("Email result:", d);
            if (d.success) {
              anySent = true;
              const newThreads = { ...(tx.smsThreads || {}) };
              const key = emailAddr;
              if (!newThreads[key]) newThreads[key] = [];
              newThreads[key].push({ id: d.message?.id || Date.now().toString(), body: message.trim(), direction: "outbound", channel: "email", timestamp: new Date().toISOString(), status: "sent" });
              onUpdate({ ...tx, smsThreads: newThreads });
            } else alert("Email failed: " + (d.error || "Unknown error"));
          } catch(e) { console.error("Email error", e); alert("Email error: " + e.message); }
        } else { alert("No email address for this party. Add one in the Parties tab."); }
      }
      if (anySent) { setMessage(""); setSubject(""); }
      else alert("Send failed. Check server and credentials.");
    } catch { alert("Server unreachable."); }
    setSending(false);
  };

  const sendBulk = async () => {
    if (!bulkMessage.trim() || !bulkSelected.length) return;
    setBulkSending(true);
    const parties = bulkSelected.map(id => tx.parties.find(p => p.id === id)).filter(Boolean);
    const results = [];
    for (const party of parties) {
      const r = { name: party.name, sms: null, email: null };
      if ((bulkChannel === "sms" || bulkChannel === "both") && party.phone) {
        try { const res = await fetch(`${SMS_SERVER}/sms/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toPhone: party.phone, toName: party.name, message: `[The Liz Team - ${tx.address}]\n${bulkMessage.trim()}`, fromName: "The Liz Team" }) }); const d = await res.json(); r.sms = d.success; } catch { r.sms = false; }
      }
      if ((bulkChannel === "email" || bulkChannel === "both") && party.email) {
        try { const res = await fetch(`${SMS_SERVER}/email/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toEmail: party.email, toName: party.name, subject: bulkSubject || `Update: ${tx.address}`, message: bulkMessage.trim(), fromName: "The Liz Team" }) }); const d = await res.json(); r.email = d.success; } catch { r.email = false; }
      }
      results.push(r);
    }
    setBulkResult(results);
    setBulkSending(false);
  };

  const sendReminder = async () => {
    if (!reminderTask || !reminderParties.length) return;
    setReminderSending(true);
    const task = tx.tasks.find(t => t.id === reminderTask);
    const reminderBody = `Reminder: ${task?.name}\nProperty: ${tx.address}, ${tx.city}, FL\nDue: ${formatDate(task?.dueDate)}\n\n${reminderMsg}\n\n- The Liz Team Realty`;
    const parties = reminderParties.map(id => tx.parties.find(p => p.id === id)).filter(Boolean);
    let sent = 0;
    for (const party of parties) {
      if ((reminderChannel === "sms" || reminderChannel === "both") && party.phone) {
        try { await fetch(`${SMS_SERVER}/sms/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toPhone: party.phone, toName: party.name, message: reminderBody, fromName: "The Liz Team" }) }); sent++; } catch {}
      }
      if ((reminderChannel === "email" || reminderChannel === "both") && party.email) {
        try { await fetch(`${SMS_SERVER}/email/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toEmail: party.email, toName: party.name, subject: `Reminder: ${task?.name} - ${tx.address}`, message: reminderBody, fromName: "The Liz Team" }) }); sent++; } catch {}
      }
    }
    alert(`Reminders sent: ${sent} messages delivered.`);
    setShowReminderSMS(false);
    setReminderSending(false);
  };

  if (serverOnline === false) {
    return (
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F2044", marginBottom: 8 }}>Communication Server Not Running</div>
        <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 440, margin: "0 auto 20px" }}>In Terminal: cd ~/Downloads/LizTeamApp/sms-server && node server.js</div>
        <button onClick={() => { setServerOnline(null); fetch(`${SMS_SERVER}/health`).then(r => r.json()).then(d => { setServerOnline(true); setEmailOnline(!!d.email); }).catch(() => setServerOnline(false)); }} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #0F2044", background: "#fff", color: "#0F2044", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Retry Connection</button>
      </div>
    );
  }
  if (serverOnline === null) return <div style={{ textAlign: "center", padding: 60, color: "#6B7280" }}>Connecting to server...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#15803D" }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#15803D" }} /> SMS Online</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: emailOnline ? "#15803D" : "#DC2626" }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: emailOnline ? "#15803D" : "#DC2626" }} /> Email {emailOnline ? "Online" : "Not configured"}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowReminderSMS(true)} style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid #0F2044", background: "#fff", color: "#0F2044", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Deadline Reminder</button>
          <button onClick={() => { setShowBulk(true); setBulkSelected([]); setBulkMessage(""); setBulkSubject(""); setBulkResult(null); setBulkChannel("sms"); }} style={{ padding: "4px 12px", borderRadius: 8, border: "none", background: "#C9A84C", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Broadcast</button>
        </div>
      </div>

      {partiesWithContact.length === 0 ? (
        <div style={{ textAlign: "center", color: "#6B7280", padding: 40 }}>No parties with phone or email. Add contact info in the Parties tab.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, height: 560, "data-msg-grid": "" }}>
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #E5E7EB", fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Conversations</div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {partiesWithContact.map(party => {
                const thread = getThread(party);
                const last = thread[thread.length - 1];
                const inbound = thread.filter(m => m.direction === "inbound").length;
                const isSelected = selectedParty?.id === party.id;
                return (
                  <div key={party.id} onClick={() => setSelectedParty(party)} style={{ padding: "12px 14px", borderBottom: "1px solid #E5E7EB", cursor: "pointer", background: isSelected ? "#F0F4FF" : "#fff", borderLeft: `3px solid ${isSelected ? "#0F2044" : "transparent"}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1D4ED822", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{party.name.split(" ").map(w => w[0]).join("").toUpperCase().substr(0, 2)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#1A1A2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{party.name}</div>
                          {inbound > 0 && <div style={{ background: "#DC2626", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{inbound}</div>}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#C9A84C" }}>{party.role}</div>
                        <div style={{ fontSize: 10, color: "#6B7280" }}>{party.phone ? "📱 " : ""}{party.email ? "📧" : ""}</div>
                        <div style={{ fontSize: 11, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last ? `${last.direction === "outbound" ? "You: " : ""}${last.body}` : "No messages yet"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!selectedParty ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 40 }}>💬</div>
                <div>Select a party to start messaging</div>
              </div>
            ) : (
              <>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 12, background: "#F7F8FA", flexWrap: "wrap" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1D4ED822", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{selectedParty.name.split(" ").map(w => w[0]).join("").toUpperCase().substr(0, 2)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedParty.name}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{selectedParty.phone && `📱 ${selectedParty.phone}`}{selectedParty.phone && selectedParty.email && " · "}{selectedParty.email && `📧 ${selectedParty.email}`}</div>
                  </div>
                  <ChannelPicker value={channel} onChange={setChannel} />
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {getThread(selectedParty).length === 0 && <div style={{ textAlign: "center", color: "#6B7280", fontSize: 13, marginTop: 40 }}>No messages yet. Select SMS, Email, or both above then type below.</div>}
                  {getThread(selectedParty).map(m => {
                    const isOut = m.direction === "outbound";
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: isOut ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "72%" }}>
                          <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 3, textAlign: isOut ? "right" : "left" }}>{isOut ? "You" : selectedParty.name} · {formatTime(m.timestamp)} {m.channel === "email" ? "📧" : "📱"}</div>
                          <div style={{ background: isOut ? "#0F2044" : "#F3F4F6", color: isOut ? "#fff" : "#1A1A2E", padding: "10px 14px", borderRadius: isOut ? "14px 14px 4px 14px" : "14px 14px 14px 4px", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.body}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                {(channel === "email" || channel === "both") && (
                  <div style={{ padding: "8px 18px 0", borderTop: "1px solid #E5E7EB" }}>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={`Subject (default: Re: ${tx.address})`} style={{ width: "100%", padding: "7px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                )}
                <div style={{ padding: "8px 18px", borderTop: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6, fontWeight: 600 }}>📝 EMAIL TEMPLATES</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {EMAIL_TEMPLATES.map((tmpl, i) => (
                      <button key={i} onClick={() => {
                        try {
                          const agentFirst = agentFullName || (currentUser ? ((currentUser.firstName || "") + " " + (currentUser.lastName || "")).trim() : "");
                          const email = (currentUser && currentUser.email) ? currentUser.email : "";
                          const phone = agentPhone || "";
                          const company = companyName || "";
                          // Don't include signature in body - HTML email builder adds it automatically
                          const sig = "";
                          const firstName = (selectedParty && selectedParty.name) ? selectedParty.name.split(" ")[0] : "there";
                          const body = tmpl.body(firstName, tx.address || "", sig, formatDate(tx.closingDate));
                          setMessage(body);
                          setSubject(tmpl.subject(tx.address || ""));
                        } catch(e) { console.error("Template error:", e); }
                      }} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 14, border: "1px solid #C0392B", background: "#FEF2F2", color: "#C0392B", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {tmpl.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "12px 18px", borderTop: "1px solid #E5E7EB", display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && channel === "sms") { e.preventDefault(); sendMessage(); } }} placeholder="Type message... (Shift+Enter for new line)" rows={8} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 120, boxSizing: "border-box" }} />
                  <button onClick={sendMessage} disabled={!message.trim() || sending} style={{ height: 52, minWidth: 70, borderRadius: 8, border: "none", background: "#15803D", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: (!message.trim() || sending) ? 0.5 : 1 }}>{sending ? "..." : "Send"}</button>
                </div>
                <div style={{ margin: "0 18px 12px", padding: "10px 14px", borderTop: "2px solid #C0392B", background: "#F9FAFB", borderRadius: "0 0 8px 8px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", fontWeight: 700, marginRight: 4 }}>Signature:</div>
                    <div style={{ fontSize: 12, color: "#333", lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700 }}>{agentFullName || "Your Name"}</span>
                      {companyName ? <span style={{ color: "#C0392B" }}> · {companyName}</span> : <span style={{ color: "#C0392B" }}> · The Liz Team Realty</span>}
                      {agentPhone && <span style={{ color: "#666" }}> · {agentPhone}</span>}
                    </div>
                  </div>
              </>
            )}
          </div>
        </div>
      )}

      {showBulk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: 600, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", "data-modal": "" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: "#0F2044" }}>Broadcast to Parties</div>
              <button onClick={() => setShowBulk(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6B7280" }}>x</button>
            </div>
            <div style={{ padding: "20px 24px 24px" }}>
              {!bulkResult ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Send via</div>
                    <ChannelPicker value={bulkChannel} onChange={setBulkChannel} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0F2044", marginBottom: 10 }}>Recipients</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, "data-form-grid": "" }}>
                      {partiesWithContact.map(p => (
                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${bulkSelected.includes(p.id) ? "#0F2044" : "#E5E7EB"}`, borderRadius: 8, cursor: "pointer" }}>
                          <input type="checkbox" checked={bulkSelected.includes(p.id)} onChange={e => setBulkSelected(prev => e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))} />
                          <div><div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: "#6B7280" }}>{p.role} {p.phone ? "📱" : ""}{p.email ? "📧" : ""}</div></div>
                        </label>
                      ))}
                    </div>
                    <button onClick={() => setBulkSelected(partiesWithContact.map(p => p.id))} style={{ marginTop: 8, fontSize: 12, color: "#1D4ED8", background: "none", border: "none", cursor: "pointer" }}>Select all</button>
                  </div>
                  {(bulkChannel === "email" || bulkChannel === "both") && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Email Subject</label>
                      <input value={bulkSubject} onChange={e => setBulkSubject(e.target.value)} placeholder={`Update: ${tx.address}`} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                  )}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Message</label>
                    <textarea value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={() => setShowBulk(false)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    <button onClick={sendBulk} disabled={!bulkMessage.trim() || !bulkSelected.length || bulkSending} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#C9A84C", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: bulkSending ? 0.5 : 1 }}>{bulkSending ? "Sending..." : `Send to ${bulkSelected.length} parties`}</button>
                  </div>
                </>
              ) : (
                <>
                  {bulkResult.map((r, i) => (
                    <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #E5E7EB" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{r.name}</div>
                      {r.sms !== null && <div style={{ fontSize: 12, color: r.sms ? "#15803D" : "#DC2626" }}>📱 SMS: {r.sms ? "Sent" : "Failed"}</div>}
                      {r.email !== null && <div style={{ fontSize: 12, color: r.email ? "#15803D" : "#DC2626" }}>📧 Email: {r.email ? "Sent" : "Failed"}</div>}
                    </div>
                  ))}
                  <div style={{ marginTop: 16 }}><button onClick={() => setShowBulk(false)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F2044", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Done</button></div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showReminderSMS && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: 560, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", "data-modal": "" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: "#0F2044" }}>Send Deadline Reminder</div>
              <button onClick={() => setShowReminderSMS(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6B7280" }}>x</button>
            </div>
            <div style={{ padding: "20px 24px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Send via</div>
                <ChannelPicker value={reminderChannel} onChange={setReminderChannel} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Select Task</label>
                <select value={reminderTask} onChange={e => setReminderTask(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14, fontFamily: "inherit" }}>
                  <option value="">Select a pending task...</option>
                  {tx.tasks.filter(t => t.status !== "Completed" && t.status !== "Waived").map(t => (
                    <option key={t.id} value={t.id}>{t.name} - {formatDate(t.dueDate)}</option>
                  ))}
                </select>
              </div>
              {reminderTask && (() => { const task = tx.tasks.find(t => t.id === reminderTask); return task ? <div style={{ background: "#FEF3C7", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, color: "#B45309" }}><strong>{task.name}</strong> - Due: {formatDate(task.dueDate)}</div> : null; })()}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", marginBottom: 8 }}>Notify</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, "data-form-grid": "" }}>
                  {partiesWithContact.map(p => (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: `1px solid ${reminderParties.includes(p.id) ? "#0F2044" : "#E5E7EB"}`, borderRadius: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={reminderParties.includes(p.id)} onChange={e => setReminderParties(prev => e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))} />
                      <div style={{ fontSize: 13 }}>{p.name} <span style={{ color: "#6B7280", fontSize: 11 }}>({p.role}) {p.phone ? "📱" : ""}{p.email ? "📧" : ""}</span></div>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Additional note (optional)</label>
                <textarea value={reminderMsg} onChange={e => setReminderMsg(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowReminderSMS(false)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={sendReminder} disabled={!reminderTask || !reminderParties.length || reminderSending} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F2044", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: reminderSending ? 0.5 : 1 }}>{reminderSending ? "Sending..." : `Send to ${reminderParties.length} parties`}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionDetail({ tx, onUpdate, onBack, contacts, onInviteParty = [], onSaveContact, onOpenContactBook, onDuplicate, currentUser }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddParty, setShowAddParty] = useState(false);
  const [partyFromContactBook, setPartyFromContactBook] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showContractWizard, setShowContractWizard] = useState(false);
  const [contractWizardForm, setContractWizardForm] = useState({});
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [remindingTask, setRemindingTask] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [partyForm, setPartyForm] = useState({ role: "", name: "", email: "", phone: "", company: "", mailingAddress: "", preferredComm: "Email", checksEmail: "Yes", primaryResidence: "Yes", mailAway: "No" });
  const [taskForm, setTaskForm] = useState({ name: "", category: "Contract", assignTo: "", dueDate: "", notes: "" });
  const [reminderForm, setReminderForm] = useState({ title: "", date: "", message: "", channels: "both", parties: [] });

  const update = changes => onUpdate({ ...tx, ...changes });
  const updateTask = updated => update({ tasks: tx.tasks.map(t => t.id === updated.id ? updated : t) });
  const [chatUnread, setChatUnread] = useState(0);
  const [showEditTx, setShowEditTx] = useState(false);
  const [editTxForm, setEditTxForm] = useState({});
  const [statusChangeModal, setStatusChangeModal] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  useEffect(() => { const tok = localStorage.getItem("tp_token") || ""; fetch(API + "/users", { headers: { "Authorization": "Bearer " + tok } }).then(r => r.json()).then(d => { if (d.users) setTeamMembers(d.users.filter(u => u.role === "agent" || u.role === "admin")); }).catch(() => {}); }, []);
  const chatUnreadRef = useRef(0);
  const setChatUnreadBoth = (n) => { chatUnreadRef.current = n; setChatUnread(n); };
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; if (activeTab !== "chat") setChatUnreadBoth(0); }, [activeTab]);

  // Poll for new chat messages to show unread badge
  useEffect(() => {
    if (!tx.id) return;
    const tok = localStorage.getItem("tp_token") || "";
    let lastCount = 0;
    let initialized = false;
    let myId = null;
    try { const u = JSON.parse(localStorage.getItem("tp_user") || "{}"); myId = u.id || u.userId; } catch {}

    const checkMessages = async () => {
      if (activeTabRef.current === "chat") return;
      try {
        const res = await fetch("https://liz-team-server-api-production.up.railway.app/chat/" + tx.id, {
          headers: { "Authorization": "Bearer " + tok }
        });
        const data = await res.json();
        if (data.messages) {
          const otherMessages = data.messages.filter(m => m.user_id !== myId);
          const newCount = otherMessages.length;
          if (!initialized) { lastCount = newCount; initialized = true; return; }
          if (newCount > lastCount) {
            const diff = newCount - lastCount;
            setChatUnreadBoth(chatUnreadRef.current + diff);
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
          lastCount = newCount;
        }
      } catch {}
    };

    checkMessages();
    const interval = setInterval(checkMessages, 10000);
    return () => clearInterval(interval);
  }, [tx.id]);

  const completedTasks = tx.tasks.filter(t => t.status === "Completed").length;
  const overdueTasks = tx.tasks.filter(t => { const d = daysUntil(t.dueDate); return d !== null && d < 0 && t.status !== "Completed" && t.status !== "Waived"; }).length;
  const daysToClose = daysUntil(tx.closingDate);
  const statusCfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG["Active"];
  const progress = tx.tasks.length > 0 ? Math.round(completedTasks / tx.tasks.length * 100) : 0;
  const CATEGORY_ORDER = ["Pre-Listing", "Consultation", "Showing", "Contract", "Disclosure", "Marketing", "Escrow", "Inspection", "HOA", "Appraisal", "Insurance", "Title", "Financing", "Closing", "Post-Closing", "Commission Disbursement", "General"];
  const tasksByCategory = tx.tasks.reduce((acc, t) => { acc[t.category] = acc[t.category] || []; acc[t.category].push(t); return acc; }, {});
  const sortedTaskCategories = Object.entries(tasksByCategory).sort(([a], [b]) => { const ai = CATEGORY_ORDER.indexOf(a); const bi = CATEGORY_ORDER.indexOf(b); return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi); });
  const smsMsgCount = Object.values(tx.smsThreads || {}).reduce((a, t) => a + t.length, 0);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: `Tasks${overdueTasks > 0 ? ` ⚠${overdueTasks}` : ""}` },
    { id: "parties", label: `Parties (${tx.parties.length})` },
    { id: "sms", label: `Messages${smsMsgCount > 0 ? ` (${smsMsgCount})` : ""}` },
    { id: "notes", label: "Internal Notes" },
    { id: "documents", label: "📎 Documents" },
    { id: "chat", label: chatUnread > 0 ? `💬 Group Chat (${chatUnread})` : "💬 Group Chat" },
    { id: "activity", label: "📋 Activity Log" },
    { id: "reminders", label: "Reminders" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh" }}>
      <div style={{ background: COLORS.navy, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 22, opacity: 0.7 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>{tx.address}</div>
          <div style={{ color: COLORS.gold, fontSize: 13 }}>{tx.city}, FL {tx.zipCode} · {tx.county} County · {tx.type}</div>
        </div>
        <Badge label={tx.status} color={statusCfg.color} bg={statusCfg.bg} />
        <select value={tx.status} onChange={e => {
          const newStatus = e.target.value;
          if (newStatus === tx.status) return;
          if (["Under Contract","Closed","On Hold","Cancelled"].includes(tx.status) && newStatus === "Active") {
            const confirmed = window.confirm("Change back to Active?\n\nAll contract task due dates will be cleared and tasks reset to Pending.");
            if (!confirmed) { e.target.value = tx.status; return; }
            const clearedTasks = tx.tasks.map(t => {
              const tmpl = (FLORIDA_TASK_TEMPLATES[tx.type] || []).find(tmp => tmp.name === t.name);
              if (tmpl && tmpl.phase === "contract") return { ...t, dueDate: null, status: "Pending" };
              return t;
            });
            update({ status: newStatus, tasks: clearedTasks, closingDate: null, executedDate: null, contractPrice: null, commissionListing: null, commissionBuyer: null, transactionFee: null, brokerageSplit: null, officeFlatFee: null, commissionNotes: null });
            return;
          }
          setStatusChangeModal({ newStatus, form: { executedDate: tx.executedDate || "", closingDate: tx.closingDate || "", inspectionDays: "10", note: "" } });
          e.target.value = tx.status;
        }} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "none", fontFamily: "inherit", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer" }}>
          {Object.keys(STATUS_CONFIG).map(s => <option key={s} style={{ color: COLORS.text, background: "#fff" }}>{s}</option>)}
        </select>
        <button onClick={() => onDuplicate && onDuplicate(tx)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>⧉ Duplicate</button>
        <button onClick={() => { setEditTxForm({ assignedAgent: tx.assignedAgentId || "", referralSource: tx.referralSource || "", closingDate: tx.closingDate || "", contractPrice: tx.contractPrice || "", openDate: tx.openDate || "", executedDate: tx.executedDate || "", status: tx.status, mlsNumber: tx.mlsNumber || "", notes: tx.notes || "", propertyAccess: tx.propertyAccess || "", commissionListing: tx.commissionListing || "", commissionBuyer: tx.commissionBuyer || "", transactionFee: tx.transactionFee || "", brokerageSplit: tx.brokerageSplit || "", officeFlatFee: tx.officeFlatFee || "", mailAway: tx.mailAway || "No", commissionNotes: tx.commissionNotes || "" }); setShowEditTx(true); }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
        <button onClick={() => window.print()} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>🖨️ Print</button>
        <button onClick={async () => {
          const tok = localStorage.getItem("tp_token") || "";
          const res = await fetch(API + "/transactions/" + tx.id + "/pdf", { headers: { "Authorization": "Bearer " + tok } });
          if (!res.ok) { alert("PDF generation failed"); return; }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = "TransactPro-" + (tx.address || "report").replace(/[^a-z0-9]/gi, "-") + "-" + (tx.city || "").replace(/[^a-z0-9]/gi, "-") + ".pdf"; a.click();
          URL.revokeObjectURL(url);
        }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>📄 PDF</button>
        {tx.status !== "Cancelled" && (
          <button onClick={() => { if (window.confirm("Cancel this transaction? It will be hidden from your dashboard but not deleted.")) update({ status: "Cancelled" }); }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,100,100,0.5)", background: "rgba(255,100,100,0.15)", color: "#FCA5A5", cursor: "pointer", fontFamily: "inherit" }}>Cancel Transaction</button>
        )}
        {tx.status === "Cancelled" && (
          <button onClick={() => update({ status: "Active" })} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(100,255,100,0.5)", background: "rgba(100,255,100,0.15)", color: "#6EE7B7", cursor: "pointer", fontFamily: "inherit" }}>Restore Transaction</button>
        )}
      </div>

      <div style={{ background: "#fff", borderBottom: `1px solid ${COLORS.border}`, padding: "12px 24px", display: "flex", gap: 24, overflowX: "auto" }}>
        {[
          { label: "Price", value: tx.contractPrice ? `$${Number(tx.contractPrice).toLocaleString()}` : tx.listPrice ? `$${Number(tx.listPrice).toLocaleString()}` : "TBD" },
          { label: "MLS #", value: tx.mlsNumber || "—" },
          { label: "Open Date", value: formatDate(tx.openDate) },
          { label: "Closing Date", value: formatDate(tx.closingDate) },
          { label: "Days to Close", value: daysToClose !== null ? `${daysToClose}d` : "—", highlight: daysToClose !== null && daysToClose <= 7 },
          { label: "Progress", value: `${progress}%` },
          { label: "Overdue", value: overdueTasks, highlight: overdueTasks > 0 },
          { label: "SMS Sent", value: smsMsgCount },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.highlight ? COLORS.danger : COLORS.navy, marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderBottom: `1px solid ${COLORS.border}`, display: "flex", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "12px 20px", background: "none", border: "none", borderBottom: `3px solid ${activeTab === t.id ? COLORS.navy : "transparent"}`, color: activeTab === t.id ? COLORS.navy : COLORS.muted, fontWeight: activeTab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 940, margin: "0 auto" }}>
        {activeTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {[
                { title: "Property", rows: [["Assigned Agent", tx.assignedAgentName || "—"], ["Referral Source", tx.referralSource || "—"], ["Address", tx.address], ["City/County", `${tx.city}, ${tx.county} County`], ["Zip", tx.zipCode], ["Type", tx.propertyType], ["Transaction", tx.type], ["MLS #", tx.mlsNumber], ["Lockbox Access", tx.propertyAccess || "—"], ["Mail-Away", tx.mailAway || "No"]] },
                { title: "Financials", rows: (() => {
                    const price = Number(tx.contractPrice || tx.listPrice || 0);
                    const listComm = tx.commissionListing ? (price * Number(tx.commissionListing) / 100) : 0;
                    const buyerComm = tx.commissionBuyer ? (price * Number(tx.commissionBuyer) / 100) : 0;
                    const totalComm = listComm + buyerComm;
                    const txFee = Number(tx.transactionFee || 0);
                    const split = tx.brokerageSplit ? totalComm * Number(tx.brokerageSplit) / 100 : 0;
                    const flatFee = Number(tx.officeFlatFee || 0);
                    const netComm = totalComm + txFee - split - flatFee;
                    return [
                      ["List Price", tx.listPrice ? `$${Number(tx.listPrice).toLocaleString()}` : "—"],
                      ["Contract Price", tx.contractPrice ? `$${Number(tx.contractPrice).toLocaleString()}` : "—"],
                      ["Open Date", formatDate(tx.openDate)],
                      ["Executed Date", formatDate(tx.executedDate)],
                      ["Closing Date", formatDate(tx.closingDate)],
                      ["Days to Close", daysToClose !== null ? `${daysToClose}d` : "—"],
                      ["Mail-Away", tx.mailAway || "No"],
                      ["Listing Commission", tx.commissionListing ? `${tx.commissionListing}% ($${listComm.toLocaleString(undefined,{maximumFractionDigits:0})})` : "—"],
                      ["Buyer Commission", tx.commissionBuyer ? `${tx.commissionBuyer}% ($${buyerComm.toLocaleString(undefined,{maximumFractionDigits:0})})` : "—"],
                      ["Transaction Fee", tx.transactionFee ? `$${Number(tx.transactionFee).toLocaleString()}` : "—"],
                      ["Brokerage Split", tx.brokerageSplit ? `${tx.brokerageSplit}% (-$${split.toLocaleString(undefined,{maximumFractionDigits:0})})` : "—"],
                      ["Office Flat Fee", tx.officeFlatFee ? `-$${Number(tx.officeFlatFee).toLocaleString()}` : "—"],
                      ["Total Gross Commission", totalComm > 0 ? `$${totalComm.toLocaleString(undefined,{maximumFractionDigits:0})}` : "—"],
                      ["Est. Net Commission", netComm > 0 ? `$${netComm.toLocaleString(undefined,{maximumFractionDigits:0})}` : "—"],
                    ];
                  })() },
              ].map(({ title, rows }) => (
                <div key={title} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 14, color: COLORS.navy, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</h3>
                  {rows.map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${COLORS.bg}`, fontSize: 13 }}><span style={{ color: COLORS.muted }}>{k}</span><span style={{ color: COLORS.text, fontWeight: 600 }}>{v || "—"}</span></div>)}
                </div>
              ))}
            </div>
            {overdueTasks > 0 && (
              <div style={{ background: COLORS.dangerBg, border: `1px solid ${COLORS.danger}40`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, color: COLORS.danger, marginBottom: 8 }}>⚠ {overdueTasks} Overdue Task{overdueTasks > 1 ? "s" : ""}</div>
                {tx.tasks.filter(t => { const d = daysUntil(t.dueDate); return d !== null && d < 0 && t.status !== "Completed" && t.status !== "Waived"; }).map(t => (
                  <div key={t.id} style={{ fontSize: 13, color: COLORS.danger, marginBottom: 4 }}>· {t.name} — {formatDate(t.dueDate)} ({Math.abs(daysUntil(t.dueDate))}d overdue)</div>
                ))}
              </div>
            )}
            <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, color: COLORS.navy, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Key Parties</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {tx.parties.slice(0, 6).map(p => <PartyCard key={p.id} party={p} />)}
              </div>
            </div>
            <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, color: COLORS.navy, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</h3>
              <textarea value={tx.notes} onChange={e => update({ notes: e.target.value })} rows={4} style={{ width: "100%", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", fontFamily: "inherit", fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: COLORS.muted }}>{completedTasks}/{tx.tasks.length} complete {overdueTasks > 0 && <span style={{ color: COLORS.danger }}>· {overdueTasks} overdue</span>}</div>
              <Btn onClick={() => setShowAddTask(true)} small>+ Add Task</Btn>
              {tx.tasks.length > 0 && (
                <Btn onClick={() => { if (window.confirm("Delete all tasks? This cannot be undone.")) update({ tasks: [] }); }} small variant="secondary">🗑 Clear All</Btn>
              )}
              {tx.tasks.length === 0 && (
                <Btn onClick={() => {
                  if (window.confirm("Generate Florida task checklist for this transaction? This will add all standard FL tasks.")) {
                    const templates = FLORIDA_TASK_TEMPLATES[tx.type] || [];
                    const contractDate = tx.executedDate || tx.openDate;
                    const currentPhase = tx.status === "Closed" ? ["active", "contract", "closing"] :
                                        tx.status === "Under Contract" ? ["active", "contract"] : ["active"];
                    const newTasks = templates
                      .filter(t => currentPhase.includes(t.phase || "active"))
                      .map(t => ({
                        id: genId(),
                        name: t.name,
                        category: t.category,
                        assignTo: t.assignTo,
                        dueDate: t.phase === "active" ? null :
                          t.phase === "closing"
                            ? (tx.closingDate ? addDays(tx.closingDate, t.daysFromOpen || 0) : null)
                            : t.daysFromOpen !== null && t.daysFromOpen >= 0
                              ? (contractDate ? addDays(contractDate, t.daysFromOpen) : null)
                              : (tx.closingDate ? addDays(tx.closingDate, t.daysFromOpen) : null),
                        status: "Pending",
                        notes: "",
                        phase: t.phase || "active"
                      }));
                    update({ tasks: newTasks });
                  }
                }} small variant="secondary">🏠 Generate FL Tasks</Btn>
              )}
            </div>
            {sortedTaskCategories.map(([cat, tasks]) => (
              <div key={cat} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "4px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cat} ({tasks.filter(t => t.status === "Completed").length}/{tasks.length})</div>
                {tasks.some(t => t.status !== "Completed") && <button onClick={() => update({ tasks: tx.tasks.map(t => tasks.find(ct => ct.id === t.id) ? { ...t, status: "Completed" } : t) })} style={{ fontSize: 10, color: COLORS.success, background: "none", border: `1px solid ${COLORS.success}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>✓ All Done</button>}
              </div>
                {tasks.map(t => <TaskRow key={t.id} task={t} onUpdate={updateTask} onRemind={setRemindingTask} onRemove={id => update({ tasks: tx.tasks.filter(tk => tk.id !== id) })} />)}
              </div>
            ))}
          </div>
        )}

        {activeTab === "parties" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}><Btn onClick={() => setShowAddParty(true)} small>+ Add Party</Btn></div>
            {PARTY_ROLES.map(role => {
              const members = tx.parties.filter(p => p.role === role);
              if (!members.length) return null;
              return <div key={role} style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{role}</div>{members.map(p => <PartyCard key={p.id} party={p} onEdit={() => setEditingParty({ ...p })} onRemove={() => update({ parties: tx.parties.filter(pp => pp.id !== p.id) })} onInvite={onInviteParty ? () => onInviteParty(p) : undefined} />)}</div>;
            })}
          </div>
        )}

        {activeTab === "sms" && <SMSPanel tx={tx} onUpdate={onUpdate} />}

        {activeTab === "notes" && (
          <div>
            <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 16, minHeight: 300, maxHeight: 500, overflowY: "auto" }}>
              {(tx.messages || []).length === 0 && <div style={{ textAlign: "center", color: COLORS.muted, padding: 40 }}>No internal notes yet.</div>}
              {(tx.messages || []).map(m => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "The Liz Team" ? "flex-end" : "flex-start", marginBottom: 14 }}>
                  <div style={{ maxWidth: "75%" }}>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 3, textAlign: m.sender === "The Liz Team" ? "right" : "left" }}>{m.sender} · {new Date(m.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                    <div style={{ background: m.sender === "The Liz Team" ? COLORS.navy : "#F3F4F6", color: m.sender === "The Liz Team" ? "#fff" : COLORS.text, padding: "10px 14px", borderRadius: 10, fontSize: 14 }}>{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newMessage.trim()) { update({ messages: [...(tx.messages || []), { id: genId(), sender: "The Liz Team", role: "Agent", text: newMessage.trim(), timestamp: new Date().toISOString() }] }); setNewMessage(""); } }} placeholder="Internal note (Enter to save)..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit" }} />
              <Btn onClick={() => { if (newMessage.trim()) { update({ messages: [...(tx.messages || []), { id: genId(), sender: "The Liz Team", role: "Agent", text: newMessage.trim(), timestamp: new Date().toISOString() }] }); setNewMessage(""); } }}>Save</Btn>
            </div>
          </div>
        )}

        {activeTab === "documents" && <DocumentsTab tx={tx} />}
        {activeTab === "activity" && (() => {
          if (!activitiesLoaded) {
            const tok = localStorage.getItem("tp_token") || "";
            fetch(API + "/activity/" + tx.id, { headers: { "Authorization": "Bearer " + tok } })
              .then(r => r.json()).then(d => { if (d.activities) setActivities(d.activities); setActivitiesLoaded(true); }).catch(() => {});
          }
          const icons = { transaction_created: "🏠", status_changed: "🔄", party_added: "👤", document_uploaded: "📎", email_sent: "📧", sms_sent: "📱", task_completed: "✅" };
          return (
            <div style={{ padding: 20, overflowY: "auto", maxHeight: 500 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: COLORS.navy }}>Transaction Activity Log</div>
              {activities.length === 0 ? (
                <div style={{ textAlign: "center", color: COLORS.muted, padding: 40 }}>No activity recorded yet.</div>
              ) : activities.map(a => (
                <div key={a.id} style={{ display: "flex", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{icons[a.action] || "📌"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{a.details}</div>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{a.user_name} · {new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        {activeTab === "chat" && <div style={{ padding: 20, height: 500 }}><TransactionChat transactionId={tx.id} user={null} style={{ height: "100%" }} unreadCount={chatUnread} onUnreadChange={() => {}} /></div>}
        {activeTab === "reminders" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}><Btn onClick={() => setShowAddReminder(true)} small>+ Add Reminder</Btn></div>
            {(tx.reminders || []).length === 0 && <div style={{ textAlign: "center", color: COLORS.muted, padding: 40 }}>No reminders set.</div>}
            {(tx.reminders || []).map(r => {
              const d = daysUntil(r.date);
              return (
                <div key={r.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.gold}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 3 }}>{formatDate(r.date)} {d !== null && <span style={{ color: d < 0 ? COLORS.danger : d <= 3 ? COLORS.warning : COLORS.muted }}>({d === 0 ? "Today" : d > 0 ? `in ${d}d` : `${Math.abs(d)}d ago`})</span>}</div>
                    {r.message && <div style={{ fontSize: 13, marginTop: 4, fontStyle: "italic" }}>{r.message}</div>}
                  </div>
                  <button onClick={() => update({ reminders: (tx.reminders || []).filter(rr => rr.id !== r.id) })} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingParty && (
        <Modal title="Edit Party" onClose={() => setEditingParty(null)}>
          <Input label="Role" value={editingParty.role} onChange={v => setEditingParty(p => ({ ...p, role: v }))} options={PARTY_ROLES} required />
          <Input label="Full Name" value={editingParty.name} onChange={v => setEditingParty(p => ({ ...p, name: v }))} required />
          <Input label="Company / Brokerage" value={editingParty.company || ""} onChange={v => setEditingParty(p => ({ ...p, company: v }))} />
          <Input label="Email" value={editingParty.email || ""} onChange={v => setEditingParty(p => ({ ...p, email: v }))} type="email" />
          <Input label="Cell Phone (for SMS)" value={editingParty.phone || ""} onChange={v => setEditingParty(p => ({ ...p, phone: v }))} type="tel" />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setEditingParty(null)}>Cancel</Btn>
            <Btn onClick={() => { update({ parties: tx.parties.map(p => p.id === editingParty.id ? editingParty : p) }); setEditingParty(null); }}>Save Changes</Btn>
          </div>
        </Modal>
      )}
      {showAddParty && (
        <Modal title="Add Party" onClose={() => { setShowAddParty(false); setPartyFromContactBook(false); }}>
          {contacts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Btn small variant="secondary" onClick={() => onOpenContactBook && onOpenContactBook(contact => {
                setPartyForm({ role: contact.role, name: contact.name, company: contact.company || "", email: contact.email || "", phone: contact.phone || "" });
                setPartyFromContactBook(true);
                setShowAddParty(true);
              })}>👥 Pick from Contact Book</Btn>
              <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 10 }}>or fill in manually below</span>
            </div>
          )}
          <Input label="Role" value={partyForm.role} onChange={v => setPartyForm(f => ({ ...f, role: v }))} options={PARTY_ROLES} required />
          <Input label="Full Name" value={partyForm.name} onChange={v => setPartyForm(f => ({ ...f, name: v }))} required />
          <Input label="Company / Brokerage" value={partyForm.company} onChange={v => setPartyForm(f => ({ ...f, company: v }))} />
          <Input label="Email" value={partyForm.email} onChange={v => setPartyForm(f => ({ ...f, email: v }))} type="email" />
          <Input label="Cell Phone (for SMS)" value={partyForm.phone} onChange={v => setPartyForm(f => ({ ...f, phone: v }))} type="tel" placeholder="407-555-0100" />
          {(partyForm.role === "Buyer" || partyForm.role === "Seller") && (<>
            <Input label="Mailing Address" value={partyForm.mailingAddress} onChange={v => setPartyForm(f => ({ ...f, mailingAddress: v }))} />
            <Input label="Preferred Communication" value={partyForm.preferredComm} onChange={v => setPartyForm(f => ({ ...f, preferredComm: v }))} options={["Email", "Phone", "Text"]} />
            <Input label="Checks Email Frequently?" value={partyForm.checksEmail} onChange={v => setPartyForm(f => ({ ...f, checksEmail: v }))} options={["Yes", "No"]} />
            {partyForm.role === "Buyer" && <Input label="Primary Residence?" value={partyForm.primaryResidence} onChange={v => setPartyForm(f => ({ ...f, primaryResidence: v }))} options={["Yes", "No"]} />}
            <Input label="Mail-Away / Mobile Closing?" value={partyForm.mailAway} onChange={v => setPartyForm(f => ({ ...f, mailAway: v }))} options={["Yes", "No"]} />
          </>)}
          {!partyFromContactBook && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer", fontSize: 13, color: COLORS.muted }}>
              <input type="checkbox" id="saveContact" style={{ width: 15, height: 15 }} />
              Save this contact to my Contact Book for future transactions
            </label>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer", fontSize: 13, color: "#C0392B", fontWeight: 600 }}>
            <input type="checkbox" id="sendInvitation" style={{ width: 15, height: 15 }} />
            Send portal invitation to this party
          </label>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowAddParty(false)}>Cancel</Btn>
            <Btn onClick={() => {
              if (partyForm.role && partyForm.name) {
                const newParty = { ...partyForm, id: genId() };
                update({ parties: [...tx.parties, newParty] });
                if (document.getElementById("saveContact")?.checked && onSaveContact) {
                  onSaveContact({ ...partyForm, id: genId() });
                }
                if (document.getElementById("sendInvitation")?.checked && onInviteParty) {
                  onInviteParty({ ...newParty });
                }
                setPartyForm({ role: "", name: "", email: "", phone: "", company: "" });
                setPartyFromContactBook(false);
                setShowAddParty(false);
              }
            }}>Add Party</Btn>
          </div>
        </Modal>
      )}
      {statusChangeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ background: "#0F2044", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
                {statusChangeModal.newStatus === "Under Contract" ? "Under Contract Details" :
                 statusChangeModal.newStatus === "Closed" ? "Closing Details" :
                 statusChangeModal.newStatus === "On Hold" ? "Place On Hold" :
                 statusChangeModal.newStatus === "Cancelled" ? "Cancel Transaction" :
                 "Change Status"}
              </div>
              <button onClick={() => setStatusChangeModal(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 20, cursor: "pointer" }}>x</button>
            </div>
            <div style={{ padding: 24 }}>
              {statusChangeModal.newStatus === "Under Contract" && (
                <>
                  <div style={{ background: "#F0FFF4", border: "1px solid #1E8449", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#1E8449", fontWeight: 600 }}>
                    All contract task due dates will be calculated from these dates.
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Executed Date (Contract Date) *</label>
                    <input type="date" value={statusChangeModal.form.executedDate} onChange={e => setStatusChangeModal(m => ({ ...m, form: { ...m.form, executedDate: e.target.value } }))}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Closing Date *</label>
                    <input type="date" value={statusChangeModal.form.closingDate} onChange={e => setStatusChangeModal(m => ({ ...m, form: { ...m.form, closingDate: e.target.value } }))}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Inspection Period (days)</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["7", "10", "15", "custom"].map(d => (
                        <button key={d} type="button" onClick={() => setStatusChangeModal(m => ({ ...m, form: { ...m.form, inspectionDays: d === "custom" ? "" : d } }))}
                          style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid " + (statusChangeModal.form.inspectionDays === d ? "#C0392B" : "#CCC"), background: statusChangeModal.form.inspectionDays === d ? "#FEF2F2" : "#fff", color: statusChangeModal.form.inspectionDays === d ? "#C0392B" : "#555", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                          {d === "custom" ? "Custom" : d + " days"}
                        </button>
                      ))}
                    </div>
                    {(statusChangeModal.form.inspectionDays === "" || !["7","10","15"].includes(statusChangeModal.form.inspectionDays)) && (
                      <input type="number" placeholder="Enter days" value={statusChangeModal.form.inspectionDays} onChange={e => setStatusChangeModal(m => ({ ...m, form: { ...m.form, inspectionDays: e.target.value } }))}
                        style={{ marginTop: 8, width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                    )}
                  </div>
                </>
              )}
              {statusChangeModal.newStatus === "Closed" && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Actual Closing Date</label>
                  <input type="date" value={statusChangeModal.form.closingDate} onChange={e => setStatusChangeModal(m => ({ ...m, form: { ...m.form, closingDate: e.target.value } }))}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              )}
              {(statusChangeModal.newStatus === "On Hold" || statusChangeModal.newStatus === "Cancelled") && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                    {statusChangeModal.newStatus === "Cancelled" ? "Cancellation Reason" : "Reason for Hold"}
                  </label>
                  <textarea value={statusChangeModal.form.note} onChange={e => setStatusChangeModal(m => ({ ...m, form: { ...m.form, note: e.target.value } }))}
                    placeholder={statusChangeModal.newStatus === "Cancelled" ? "e.g. Financing fell through..." : "e.g. Waiting for probate..."}
                    rows={3} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", resize: "none" }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => setStatusChangeModal(null)} style={{ padding: "10px 18px", border: "1px solid #CCC", borderRadius: 8, background: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={() => {
                  const { newStatus, form } = statusChangeModal;
                  const inspDays = parseInt(form.inspectionDays) || 10;
                  const updates = { status: newStatus };
                  if (form.closingDate) updates.closingDate = form.closingDate;
                  if (form.executedDate) updates.executedDate = form.executedDate;
                  if (form.note) updates.notes = (tx.notes ? tx.notes + "\n\n" : "") + newStatus + " Note: " + form.note;
                  if (newStatus === "Under Contract" && form.executedDate) {
                    const templates = FLORIDA_TASK_TEMPLATES[tx.type] || [];
                    const existingNames = tx.tasks.map(t => t.name);
                    const updatedExisting = tx.tasks.map(t => {
                      const tmpl = templates.find(tmp => tmp.name === t.name);
                      if (tmpl && tmpl.phase === "contract") {
                        let days = tmpl.daysFromOpen;
                        if (t.name.includes("Inspection Period")) days = inspDays;
                        if (t.name.includes("BINSR") || t.name.includes("Review Inspection")) days = inspDays + 2;
                        if (days !== null && days >= 0) return { ...t, dueDate: addDays(form.executedDate, days) };
                        else if (days < 0 && form.closingDate) return { ...t, dueDate: addDays(form.closingDate, days) };
                      }
                      return t;
                    });
                    const newContractTasks = templates
                      .filter(t => t.phase === "contract" && !existingNames.includes(t.name))
                      .map(t => {
                        let days = t.daysFromOpen;
                        if (t.name.includes("Inspection Period")) days = inspDays;
                        if (t.name.includes("BINSR") || t.name.includes("Review Inspection")) days = inspDays + 2;
                        // Auto-complete tasks that are done at contract execution
                        const autoComplete = t.name.includes("Send Fully Executed Contract") || t.name.includes("Execute FR/Bar");
                        return { id: genId(), name: t.name, category: t.category, assignTo: t.assignTo, dueDate: days !== null && days >= 0 ? addDays(form.executedDate, days) : (form.closingDate ? addDays(form.closingDate, days) : null), status: autoComplete ? "Completed" : "Pending", notes: "", phase: "contract" };
                      });
                    updates.tasks = [...updatedExisting, ...newContractTasks];
                  }
                  if (newStatus === "Closed" && form.closingDate) {
                    const templates = FLORIDA_TASK_TEMPLATES[tx.type] || [];
                    const existingNames = tx.tasks.map(t => t.name);
                    const newClosingTasks = templates
                      .filter(t => t.phase === "closing" && !existingNames.includes(t.name))
                      .map(t => ({ id: genId(), name: t.name, category: t.category, assignTo: t.assignTo, dueDate: addDays(form.closingDate, t.daysFromOpen || 0), status: "Pending", notes: "", phase: "closing" }));
                    if (newClosingTasks.length > 0) updates.tasks = [...tx.tasks, ...newClosingTasks];
                  }
                  update(updates);
                  setStatusChangeModal(null);
                }} style={{ padding: "10px 24px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showContractWizard && (
        <Modal title="🎉 Under Contract — Enter Contract Details" onClose={() => setShowContractWizard(false)}>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 16, background: "#F0FFF4", border: "1px solid #1E8449", borderRadius: 8, padding: 12 }}>
            Congratulations! Please fill in the contract details. Task due dates will be calculated automatically from the executed date.
          </div>
          <Input label="Contract Executed Date *" value={contractWizardForm.executedDate} onChange={v => setContractWizardForm(f => ({ ...f, executedDate: v }))} type="date" required />
          <Input label="Closing Date *" value={contractWizardForm.closingDate} onChange={v => setContractWizardForm(f => ({ ...f, closingDate: v }))} type="date" required />
          <Input label="Contract Price ($)" value={contractWizardForm.contractPrice} onChange={v => setContractWizardForm(f => ({ ...f, contractPrice: v }))} type="number" />
          <Input label="Listing Commission (%)" value={contractWizardForm.commissionListing} onChange={v => setContractWizardForm(f => ({ ...f, commissionListing: v }))} type="number" />
          <Input label="Buyer Agent Commission (%)" value={contractWizardForm.commissionBuyer} onChange={v => setContractWizardForm(f => ({ ...f, commissionBuyer: v }))} type="number" />
          <Input label="Transaction Fee ($)" value={contractWizardForm.transactionFee} onChange={v => setContractWizardForm(f => ({ ...f, transactionFee: v }))} type="number" />
          <Input label="Brokerage Split (%)" value={contractWizardForm.brokerageSplit} onChange={v => setContractWizardForm(f => ({ ...f, brokerageSplit: v }))} type="number" />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="ghost" onClick={() => setShowContractWizard(false)}>Skip for Now</Btn>
            <Btn onClick={() => {
              if (!contractWizardForm.executedDate || !contractWizardForm.closingDate) {
                alert("Please enter the Executed Date and Closing Date.");
                return;
              }
              // Add contract phase tasks and update dates
              const templates = FLORIDA_TASK_TEMPLATES[tx.type] || [];
              const existingTaskNames = tx.tasks.map(t => t.name);
              
              // Update dates on existing contract/closing tasks
              const updatedExisting = tx.tasks.map(task => {
                const template = templates.find(t => t.name === task.name);
                if (template && template.phase === "contract" && template.daysFromOpen !== null) {
                  const dueDate = template.daysFromOpen >= 0
                    ? addDays(contractWizardForm.executedDate, template.daysFromOpen)
                    : addDays(contractWizardForm.closingDate, template.daysFromOpen);
                  return { ...task, dueDate, status: "Pending" };
                }
                if (template && template.phase === "closing" && template.daysFromOpen !== null) {
                  const dueDate = addDays(contractWizardForm.closingDate, template.daysFromOpen || 0);
                  return { ...task, dueDate, status: "Pending" };
                }
                return task;
              });

              // Add new contract phase tasks that don't exist yet
              const newContractTasks = templates
                .filter(t => t.phase === "contract" && !existingTaskNames.includes(t.name))
                .map(t => ({
                  id: genId(),
                  name: t.name,
                  category: t.category,
                  assignTo: t.assignTo,
                  dueDate: t.daysFromOpen !== null && t.daysFromOpen >= 0
                    ? addDays(contractWizardForm.executedDate, t.daysFromOpen)
                    : addDays(contractWizardForm.closingDate, t.daysFromOpen),
                  status: "Pending",
                  notes: "",
                  phase: "contract"
                }));

              const updatedTasks = [...updatedExisting, ...newContractTasks];
              update({
                status: "Under Contract",
                executedDate: contractWizardForm.executedDate,
                closingDate: contractWizardForm.closingDate,
                contractPrice: contractWizardForm.contractPrice || tx.contractPrice,
                commissionListing: contractWizardForm.commissionListing || tx.commissionListing,
                commissionBuyer: contractWizardForm.commissionBuyer || tx.commissionBuyer,
                transactionFee: contractWizardForm.transactionFee || tx.transactionFee,
                brokerageSplit: contractWizardForm.brokerageSplit || tx.brokerageSplit,
                tasks: updatedTasks,
              });
              setShowContractWizard(false);
            }}>Save & Go Under Contract</Btn>
          </div>
        </Modal>
      )}
      {showAddTask && (
        <Modal title="Add Task" onClose={() => setShowAddTask(false)}>
          <Input label="Task Name" value={taskForm.name} onChange={v => setTaskForm(f => ({ ...f, name: v }))} required />
          <Input label="Category" value={taskForm.category} onChange={v => setTaskForm(f => ({ ...f, category: v }))} options={["Contract","Disclosure","Escrow","Inspection","Financing","Title","HOA","Insurance","Marketing","Closing","Post-Closing"]} />
          <Input label="Assign To" value={taskForm.assignTo} onChange={v => setTaskForm(f => ({ ...f, assignTo: v }))} options={PARTY_ROLES} />
          <Input label="Due Date" value={taskForm.dueDate} onChange={v => setTaskForm(f => ({ ...f, dueDate: v }))} type="date" />
          <Input label="Notes" value={taskForm.notes} onChange={v => setTaskForm(f => ({ ...f, notes: v }))} type="textarea" />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowAddTask(false)}>Cancel</Btn>
            <Btn onClick={() => { if (taskForm.name) { update({ tasks: [...tx.tasks, { ...taskForm, id: genId(), status: "Pending" }] }); setTaskForm({ name: "", category: "Contract", assignTo: "", dueDate: "", notes: "" }); setShowAddTask(false); } }}>Add Task</Btn>
          </div>
        </Modal>
      )}
      {showAddReminder && (
        <Modal title="Add Reminder" onClose={() => setShowAddReminder(false)}>
          <Input label="Title" value={reminderForm.title} onChange={v => setReminderForm(f => ({ ...f, title: v }))} required />
          <Input label="Date" value={reminderForm.date} onChange={v => setReminderForm(f => ({ ...f, date: v }))} type="date" required />
          <Input label="Message" value={reminderForm.message} onChange={v => setReminderForm(f => ({ ...f, message: v }))} type="textarea" />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowAddReminder(false)}>Cancel</Btn>
            <Btn onClick={async () => {
              if (reminderForm.title && reminderForm.date) {
                const newId = genId();
                const newReminder = { ...reminderForm, id: newId };
                update({ reminders: [...(tx.reminders || []), newReminder] });
                // Persist to DB
                try {
                  const tok = localStorage.getItem("tp_token") || "";
                  await fetch(API + "/reminders/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
                    body: JSON.stringify({ id: newId, transactionId: tx.id, title: reminderForm.title, message: reminderForm.message, date: reminderForm.date, channels: reminderForm.channels || "both", parties: reminderForm.parties || [] })
                  });
                } catch (e) { console.error("Reminder save error:", e); }
                setReminderForm({ title: "", date: "", message: "", channels: "both", parties: [] });
                setShowAddReminder(false);
              }
            }}>Add</Btn>
          </div>
        </Modal>
      )}
      {remindingTask && <TaskReminderModal task={remindingTask} tx={tx} onClose={() => setRemindingTask(null)} />}
      {showEditTx && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>
            <div style={{ background: "#111", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Edit Transaction</div>
              <button onClick={() => setShowEditTx(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 20, cursor: "pointer" }}>x</button>
            </div>
            <div style={{ padding: 24, overflowY: "auto", maxHeight: "70vh" }}>
              {[["Open Date", "openDate", "date"], ["Closing Date", "closingDate", "date"], ["Executed Date", "executedDate", "date"], ["Contract Price", "contractPrice", "number"], ["MLS Number", "mlsNumber", "text"]].map(([label, field, type]) => (
                <div key={field} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
                  <input type={type} value={editTxForm[field] || ""} onChange={e => setEditTxForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Referral Source</div>
                <select value={editTxForm.referralSource || ""} onChange={e => setEditTxForm(f => ({ ...f, referralSource: e.target.value }))}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit" }}>
                  <option value="">— Select Source —</option>
                  {["Past Client", "Referral - Past Client", "Referral - Agent", "Zillow", "Realtor.com", "Social Media", "Google", "Open House", "Sign Call", "Cold Call", "Walk-In", "Other"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {teamMembers.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Assigned Agent</div>
                  <select value={editTxForm.assignedAgent || ""} onChange={e => setEditTxForm(f => ({ ...f, assignedAgent: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit" }}>
                    <option value="">— Select Agent —</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Lockbox Access / CBS Code</div>
                <textarea value={editTxForm.propertyAccess || ""} onChange={e => setEditTxForm(f => ({ ...f, propertyAccess: e.target.value }))} placeholder="Lockbox code, gate code, special instructions..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", minHeight: 60, resize: "vertical" }} />
              </div>
              <div style={{ background: "#F4F4F4", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#111" }}>Commission Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[["Listing Agent Commission %", "commissionListing"], ["Buyer Agent Commission %", "commissionBuyer"], ["Transaction Fee", "transactionFee"], ["Brokerage Split %", "brokerageSplit"], ["Office Flat Fee", "officeFlatFee"]].map(([label, field]) => (
                    <div key={field}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                      <input value={editTxForm[field] || ""} onChange={e => setEditTxForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 4 }}>Mail-Away Closing?</div>
                    <select value={editTxForm.mailAway || "No"} onChange={e => setEditTxForm(f => ({ ...f, mailAway: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 13, fontFamily: "inherit" }}>
                      <option>No</option><option>Yes</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 4 }}>Additional Credits / Referrals</div>
                  <input value={editTxForm.commissionNotes || ""} onChange={e => setEditTxForm(f => ({ ...f, commissionNotes: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Notes</div>
                <textarea value={editTxForm.notes || ""} onChange={e => setEditTxForm(f => ({ ...f, notes: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", minHeight: 80, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowEditTx(false)} style={{ padding: "10px 18px", border: "1px solid #CCC", borderRadius: 8, background: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={() => { const updated = { ...tx, ...editTxForm }; if (editTxForm.closingDate && editTxForm.closingDate !== tx.closingDate) { const templates = FLORIDA_TASK_TEMPLATES[tx.type] || []; updated.tasks = tx.tasks.map(task => {
                      const template = templates.find(t => t.name === task.name);
                      if (template && template.phase === "contract") {
                        if (template.daysFromOpen < 0 && editTxForm.closingDate) {
                          return { ...task, dueDate: addDays(editTxForm.closingDate, template.daysFromOpen) };
                        }
                        if (template.daysFromOpen >= 0 && !task.dueDate) {
                          const cd = editTxForm.executedDate || editTxForm.openDate;
                          return { ...task, dueDate: cd ? addDays(cd, template.daysFromOpen) : null };
                        }
                      }
                      return task;
                    }); } onUpdate(updated); setShowEditTx(false); }} style={{ padding: "10px 20px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- NEW TRANSACTION ──────────────────────────────────────────
function NewTransactionForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ address: "", city: "", county: "Osceola", zipCode: "", type: "Listing (Seller)", propertyType: "Single Family", listPrice: "", contractPrice: "", mlsNumber: "", openDate: today(), closingDate: "", notes: "", status: "Active" });
  const [useFLTemplates, setUseFLTemplates] = useState(true);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const handleSave = async () => {
    if (!form.address || !form.city) return;
    const contractDate = form.executedDate || form.openDate;
    const tasks = useFLTemplates ? (FLORIDA_TASK_TEMPLATES[form.type] || []).filter(t => t.phase === "active").map(t => ({ id: genId(), name: t.name, category: t.category, assignTo: t.assignTo, dueDate: null, status: "Pending", notes: "", phase: "active" })) : [];
    const tok = localStorage.getItem("tp_token") || "";
    try {
      const res = await fetch(API + "/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
        body: JSON.stringify({ ...form, parties: [], tasks, reminders: [], smsThreads: {} }),
      });
      const data = await res.json();
      if (data.success && data.transaction) {
        const t = data.transaction;
        onSave({
          id: t.id, address: t.address, city: t.city, state: t.state,
          zipCode: t.zip_code || form.zipCode, county: t.county || form.county,
          mlsNumber: t.mls_number || form.mlsNumber, propertyType: t.property_type || form.propertyType,
          type: t.transaction_type || form.type, status: t.status || form.status,
          listPrice: t.list_price || form.listPrice, contractPrice: t.contract_price || form.contractPrice,
          openDate: t.open_date || form.openDate, closingDate: t.closing_date || form.closingDate,
          notes: t.notes || form.notes, smsThreads: {}, parties: [], tasks, messages: [], reminders: [],
        });
      } else {
        alert("Failed to save transaction: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error("Save error:", e);
      alert("Could not save transaction. Check your connection.");
    }
  };
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh" }}>
      <div style={{ background: COLORS.navy, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 22, opacity: 0.7 }}>←</button>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>New Transaction</div>
      </div>
      <div style={{ maxWidth: 680, margin: "32px auto", padding: "0 24px" }}>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, color: COLORS.navy, fontWeight: 700 }}>Property Information</h3>
          <Input label="Street Address" value={form.address} onChange={f("address")} required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Input label="City" value={form.city} onChange={f("city")} required /><Input label="County" value={form.county} onChange={f("county")} options={COUNTIES} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Input label="Zip Code" value={form.zipCode} onChange={f("zipCode")} /><Input label="MLS Number" value={form.mlsNumber} onChange={f("mlsNumber")} placeholder="O6..." /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Input label="Transaction Type" value={form.type} onChange={f("type")} options={TRANSACTION_TYPES} /><Input label="Property Type" value={form.propertyType} onChange={f("propertyType")} options={PROPERTY_TYPES} /></div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, color: COLORS.navy, fontWeight: 700 }}>Pricing & Dates</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Input label="List Price ($)" value={form.listPrice} onChange={f("listPrice")} type="number" /><Input label="Contract Price ($)" value={form.contractPrice} onChange={f("contractPrice")} type="number" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Input label="Open Date" value={form.openDate} onChange={f("openDate")} type="date" /><Input label="Closing Date" value={form.closingDate} onChange={f("closingDate")} type="date" /></div>
          <Input label="Status" value={form.status} onChange={f("status")} options={Object.keys(STATUS_CONFIG)} />
        </div>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: COLORS.navy, fontWeight: 700 }}>Florida Task Templates</h3>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}>
            <input type="checkbox" checked={useFLTemplates} onChange={e => setUseFLTemplates(e.target.checked)} style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 14 }}>Auto-load Florida FR/Bar checklist for <strong>{form.type}</strong></span>
          </label>
          {useFLTemplates && <div style={{ background: COLORS.infoBg, borderRadius: 8, padding: 12, fontSize: 12, color: COLORS.info }}><strong>{(FLORIDA_TASK_TEMPLATES[form.type] || []).length} tasks</strong> will be created with EMD deadlines, inspection period, BINSR, loan approval, title, and closing requirements.</div>}
        </div>
        <Input label="Notes" value={form.notes} onChange={f("notes")} type="textarea" />
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!form.address || !form.city}>Create Transaction</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────
function Dashboard({ transactions, onSelect, onNew, onOpenContactBook, contactCount, onLogout, onOpenTeam, onChangePassword, onReports, onCalendar, onCompanySettings, onAgentProfile }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showOverdue, setShowOverdue] = useState(false);
  const [remindingTask, setRemindingTask] = useState(null);
  const [remindingTx, setRemindingTx] = useState(null);
  const filtered = transactions.filter(tx => ((filter === "All" ? tx.status !== "Cancelled" : tx.status === filter)) && (!search || tx.address.toLowerCase().includes(search.toLowerCase()) || tx.city.toLowerCase().includes(search.toLowerCase()) || (tx.mlsNumber || "").toLowerCase().includes(search.toLowerCase()) || (tx.parties || []).some(p => p && p.name && p.name.toLowerCase().includes(search.toLowerCase()))));
  const stats = {
    active: transactions.filter(t => t.status === "Active").length,
    underContract: transactions.filter(t => t.status === "Under Contract").length,
    closed: transactions.filter(t => t.status === "Closed").length,
    overdueAny: transactions.reduce((acc, t) => acc + t.tasks.filter(tk => { const d = daysUntil(tk.dueDate); return d !== null && d < 0 && tk.status !== "Completed" && tk.status !== "Waived"; }).length, 0),
    totalCommission: transactions.filter(t => t.status === "Closed").reduce((acc, t) => {
      const price = Number(t.contractPrice || t.listPrice || 0);
      const listComm = t.commissionListing ? price * Number(t.commissionListing) / 100 : 0;
      const buyerComm = t.commissionBuyer ? price * Number(t.commissionBuyer) / 100 : 0;
      const txFee = Number(t.transactionFee || 0);
      const split = t.brokerageSplit ? (listComm + buyerComm) * Number(t.brokerageSplit) / 100 : 0;
      const flatFee = Number(t.officeFlatFee || 0);
      return acc + (listComm + buyerComm + txFee - split - flatFee);
    }, 0),
    closingSoon: transactions.filter(t => { const d = daysUntil(t.closingDate); return d !== null && d >= 0 && d <= 14 && t.status === "Under Contract"; }).length,
    totalVolume: transactions.filter(t => t.status !== "Cancelled").reduce((a, t) => a + (Number(t.contractPrice) || Number(t.listPrice) || 0), 0),
  };
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh" }}>
      <div style={{ background: COLORS.navy, padding: "0 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 20, paddingBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: COLORS.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>T</span>
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>TransactPro</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Real Estate Transaction Management</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={onOpenContactBook} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Contacts{contactCount > 0 ? ` (${contactCount})` : ""}</button>
            <button onClick={onNew} style={{ background: "#C0392B", border: "none", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>+ New Transaction</button>
            <button onClick={onReports} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>📊 Reports</button>
            <button onClick={onCalendar} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>📅 Calendar</button>
            <button onClick={onAgentProfile} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>👤 Profile</button>
            <button onClick={onCompanySettings} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>⚙️ Settings</button>
            <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Sign Out</button>
          </div>
        </div>
        <div data-stats-bar="" style={{ display: "flex", marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {[["Active Listings", stats.active, COLORS.gold, null], ["Under Contract", stats.underContract, "#93C5FD", null], ["Closed", stats.closed, "#6EE7B7", null], ["Overdue Tasks", stats.overdueAny, stats.overdueAny > 0 ? "#FCA5A5" : "#6EE7B7", stats.overdueAny > 0 ? () => setShowOverdue(true) : null], ["Closing ≤14d", stats.closingSoon, stats.closingSoon > 0 ? "#FDE68A" : "rgba(255,255,255,0.4)", null], ["Volume", `$${(stats.totalVolume / 1000000).toFixed(2)}M`, COLORS.gold, null], ["Closed Commission", stats.totalCommission > 0 ? `$${Math.round(stats.totalCommission).toLocaleString()}` : "$0", "#6EE7B7", null]].map(([label, value, color, onClick]) => (
            <div key={label} onClick={onClick} style={{ padding: "12px 20px", flex: 1, cursor: onClick ? "pointer" : "default" }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}{onClick && " ↗"}</div>
              <div style={{ color, fontSize: 22, fontWeight: 800, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: "#fff", borderBottom: `1px solid ${COLORS.border}`, padding: "12px 24px", display: "flex", gap: 12, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search address, city, MLS #..." style={{ flex: 1, maxWidth: 340, padding: "8px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 6 }}>
          {["All", "Active", "Under Contract", "Closed", "On Hold", "Cancelled"].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${s === "Cancelled" ? (filter === s ? COLORS.danger : COLORS.danger + "60") : filter === s ? COLORS.navy : COLORS.border}`, background: s === "Cancelled" ? (filter === s ? COLORS.danger : "#FEE2E2") : filter === s ? COLORS.navy : "#fff", color: s === "Cancelled" ? (filter === s ? "#fff" : COLORS.danger) : filter === s ? "#fff" : COLORS.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {filtered.map(tx => {
          const completed = tx.tasks.filter(t => t.status === "Completed").length;
          const overdue = tx.tasks.filter(t => { const d = daysUntil(t.dueDate); return d !== null && d < 0 && t.status !== "Completed" && t.status !== "Waived"; }).length;
          const dtc = daysUntil(tx.closingDate);
          const progress = tx.tasks.length > 0 ? Math.round(completed / tx.tasks.length * 100) : 0;
          const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG["Active"];
          const smsMsgCount = Object.values(tx.smsThreads || {}).reduce((a, t) => a + t.length, 0);
          return (
            <div key={tx.id} onClick={() => onSelect(tx.id)} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, cursor: "pointer", overflow: "hidden" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
              <div style={{ background: COLORS.navy, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div><div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{tx.address}</div><div style={{ color: COLORS.gold, fontSize: 12, marginTop: 2 }}>{tx.city}, FL · {tx.county}</div></div>
                <Badge label={tx.status} color={cfg.color} bg={cfg.bg} />
              </div>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div><div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Price</div><div style={{ fontSize: 17, fontWeight: 800, color: COLORS.navy }}>{tx.contractPrice ? `$${Number(tx.contractPrice).toLocaleString()}` : tx.listPrice ? `$${Number(tx.listPrice).toLocaleString()}` : "TBD"}</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase" }}>Closing</div><div style={{ fontSize: 13, fontWeight: 700, color: dtc !== null && dtc <= 7 ? COLORS.danger : COLORS.text }}>{formatDate(tx.closingDate)}</div>{dtc !== null && <div style={{ fontSize: 11, color: dtc <= 0 ? COLORS.danger : dtc <= 14 ? COLORS.warning : COLORS.muted }}>{dtc < 0 ? `${Math.abs(dtc)}d past` : dtc === 0 ? "Today!" : `${dtc}d away`}</div>}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <Badge label={tx.type} color={COLORS.info} bg={COLORS.infoBg} />
                  {smsMsgCount > 0 && <Badge label={`${smsMsgCount} SMS`} color={COLORS.success} bg={COLORS.successBg} />}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Progress: {completed}/{tx.tasks.length} tasks</span>
                    <span style={{ fontWeight: 700, color: progress === 100 ? COLORS.success : progress > 50 ? COLORS.warning : COLORS.muted }}>{progress}%</span>
                  </div>
                  <div style={{ height: 8, background: COLORS.border, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: progress === 100 ? COLORS.success : progress > 66 ? "#F59E0B" : COLORS.gold, borderRadius: 4, transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                    {["Contract", "Inspection", "Title", "Closing"].map((milestone, i) => {
                      const milestoneTasks = tx.tasks.filter(t => t.category === milestone);
                      const milestoneCompleted = milestoneTasks.filter(t => t.status === "Completed").length;
                      const milestoneProgress = milestoneTasks.length > 0 ? milestoneCompleted / milestoneTasks.length : 0;
                      const isDone = milestoneProgress === 1 && milestoneTasks.length > 0;
                      const isStarted = milestoneProgress > 0;
                      return (
                        <div key={milestone} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: isDone ? COLORS.success : isStarted ? COLORS.gold : COLORS.border, border: `2px solid ${isDone ? COLORS.success : isStarted ? COLORS.gold : COLORS.border}`, marginBottom: 3 }} />
                          <span style={{ fontSize: 9, color: isDone ? COLORS.success : COLORS.muted, fontWeight: isDone ? 700 : 400, whiteSpace: "nowrap" }}>{milestone}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{tx.parties.length} parties</div>
                  {overdue > 0 && <Badge label={`${overdue} overdue`} color={COLORS.danger} bg={COLORS.dangerBg} />}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: COLORS.muted }}><div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div><div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy, marginBottom: 6 }}>No transactions found</div><div>Click "+ New Transaction" to get started.</div></div>}
      </div>

      {showOverdue && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: 680, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: `1px solid ${COLORS.border}`, position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: COLORS.danger, fontWeight: 700 }}>⚠ Overdue Tasks — Action Required</h2>
                <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>These tasks need your attention today</div>
              </div>
              <button onClick={() => setShowOverdue(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: COLORS.muted }}>×</button>
            </div>
            <div style={{ padding: "16px 24px 24px" }}>
              {transactions.map(tx => {
                const overdueTasks = tx.tasks.filter(t => { const d = daysUntil(t.dueDate); return d !== null && d < 0 && t.status !== "Completed" && t.status !== "Waived"; });
                if (!overdueTasks.length) return null;
                return (
                  <div key={tx.id} style={{ marginBottom: 24 }}>
                    <div onClick={() => { onSelect(tx.id); setShowOverdue(false); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.navy, borderRadius: "10px 10px 0 0", padding: "10px 16px", cursor: "pointer" }}>
                      <div>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{tx.address}</div>
                        <div style={{ color: COLORS.gold, fontSize: 12 }}>{tx.city}, FL · {tx.type}</div>
                      </div>
                      <div style={{ color: "#fff", fontSize: 12, opacity: 0.7 }}>Open transaction →</div>
                    </div>
                    <div style={{ border: `1px solid ${COLORS.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                      {overdueTasks.map((t, i) => {
                        const daysLate = Math.abs(daysUntil(t.dueDate));
                        return (
                          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < overdueTasks.length - 1 ? `1px solid ${COLORS.border}` : "none", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.danger, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{t.name}</div>
                              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{t.category} · Assigned to: {t.assignTo || "—"} · Due: {formatDate(t.dueDate)}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                              <button onClick={() => { setRemindingTask(t); setRemindingTx(tx); }} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: `1px solid ${COLORS.danger}`, background: COLORS.dangerBg, color: COLORS.danger, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>⚠ Remind</button>
                              <div style={{ background: COLORS.dangerBg, color: COLORS.danger, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{daysLate}d overdue</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {transactions.every(tx => !tx.tasks.some(t => { const d = daysUntil(t.dueDate); return d !== null && d < 0 && t.status !== "Completed" && t.status !== "Waived"; })) && (
                <div style={{ textAlign: "center", padding: 40, color: COLORS.success }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                  <div style={{ fontWeight: 700 }}>No overdue tasks — great job!</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {remindingTask && remindingTx && <TaskReminderModal task={remindingTask} tx={remindingTx} onClose={() => { setRemindingTask(null); setRemindingTx(null); }} />}
    </div>
  );
}
function ContactBook({ contacts, onClose, onSelect, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [form, setForm] = useState({ role: "", name: "", company: "", email: "", phone: "", notes: "" });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const filtered = contacts.filter(c => {
    const matchRole = filterRole === "All" || c.role === filterRole;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.company || "").toLowerCase().includes(search.toLowerCase()) || (c.email || "").toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const handleSave = async () => {
    if (!form.name || !form.role) return;
    const tok = localStorage.getItem("tp_token") || "";
    const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };
    try {
      if (editingContact) {
        const res = await fetch(API + "/contacts/" + editingContact.id, { method: "PUT", headers, body: JSON.stringify(form) });
        const data = await res.json();
        if (data.success) onEdit({ ...editingContact, ...form });
      } else {
        const res = await fetch(API + "/contacts", { method: "POST", headers, body: JSON.stringify(form) });
        const data = await res.json();
        if (data.success && data.contact) onAdd(data.contact);
      }
    } catch(e) { console.error("Contact save failed:", e); }
    setForm({ role: "", name: "", company: "", email: "", phone: "", notes: "" });
    setShowAddContact(false);
    setEditingContact(null);
  };

  const startEdit = (c) => { setEditingContact(c); setForm({ role: c.role, name: c.name, company: c.company || "", email: c.email || "", phone: c.phone || "", notes: c.notes || "" }); setShowAddContact(true); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 720, maxWidth: "100%", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: COLORS.navy, fontWeight: 700 }}>Contact Book</h2>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>{contacts.length} saved contacts</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => { setEditingContact(null); setForm({ role: "", name: "", company: "", email: "", phone: "", notes: "" }); setShowAddContact(true); }} small variant="gold">+ New Contact</Btn>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: COLORS.muted }}>×</button>
          </div>
        </div>

        {/* Search and filter */}
        <div style={{ padding: "12px 24px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 10, flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company, email..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit" }} />
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13, fontFamily: "inherit", color: COLORS.text }}>
            <option value="All">All Roles</option>
            {PARTY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Add/Edit form */}
        {showAddContact && (
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bg, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginBottom: 12 }}>{editingContact ? "Edit Contact" : "New Contact"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, "data-form-grid": "" }}>
              <Input label="Full Name" value={form.name} onChange={f("name")} required />
              <Input label="Role" value={form.role} onChange={f("role")} options={PARTY_ROLES} required />
              <Input label="Company / Brokerage" value={form.company} onChange={f("company")} />
              <Input label="Email" value={form.email} onChange={f("email")} type="email" />
              <Input label="Cell Phone" value={form.phone} onChange={f("phone")} type="tel" />
              <Input label="Notes" value={form.notes} onChange={f("notes")} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <Btn variant="ghost" small onClick={() => { setShowAddContact(false); setEditingContact(null); }}>Cancel</Btn>
              <Btn small onClick={handleSave} disabled={!form.name || !form.role}>{editingContact ? "Save Changes" : "Add Contact"}</Btn>
            </div>
          </div>
        )}

        {/* Contact list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px" }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div style={{ fontWeight: 700, color: COLORS.navy, marginBottom: 4 }}>No contacts yet</div>
              <div style={{ fontSize: 13 }}>Add contacts to reuse them across transactions</div>
            </div>
          )}
          {filtered.map(c => (
            <div key={c.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <PartyAvatar party={c} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{c.name}</div>
                <div style={{ fontSize: 12, color: roleColor(c.role), fontWeight: 600 }}>{c.role}{c.company ? ` · ${c.company}` : ""}</div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>{[c.email, c.phone].filter(Boolean).join(" · ")}</div>
                {c.notes && <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic", marginTop: 2 }}>{c.notes}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {onSelect && <Btn small variant="green" onClick={() => { onSelect(c); onClose(); }}>+ Add to Transaction</Btn>}
                <Btn small variant="secondary" onClick={() => startEdit(c)}>Edit</Btn>
                <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, fontSize: 18, padding: "0 4px" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MainApp({ onLogout, currentUser }) {
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const token = localStorage.getItem("tp_token") || "";
  const authHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

  // Load transactions from database on mount
  useEffect(() => {
    fetch(`${API}/transactions`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        if (data.transactions) {
          // Normalize DB format to app format
          const normalized = data.transactions.map(t => ({
            id: t.id,
            address: t.address,
            city: t.city,
            state: t.state,
            zipCode: t.zip_code,
            county: t.county,
            mlsNumber: t.mls_number,
            propertyType: t.property_type,
            type: t.transaction_type,
            status: t.status,
            listPrice: t.list_price,
            contractPrice: t.contract_price,
            openDate: t.open_date,
            closingDate: t.closing_date,
            notes: t.notes,
            smsThreads: t.sms_threads || {},
            executedDate: t.executed_date,
            propertyAccess: t.property_access,
            commissionListing: t.commission_listing,
            commissionBuyer: t.commission_buyer,
            transactionFee: t.transaction_fee,
            brokerageSplit: t.brokerage_split,
            officeFlatFee: t.office_flat_fee,
            mailAway: t.mail_away,
            commissionNotes: t.commission_notes,
            referralSource: t.referral_source,
            assignedAgentId: t.assigned_agent_id,
            assignedAgentName: t.assigned_agent_name,
            messages: t.internal_notes || [],
            parties: (t.parties || []).filter(Boolean).map(p => ({ id: p.id, role: p.role, name: p.name, email: p.email, phone: p.phone, company: p.company })),
            tasks: (t.tasks || []).filter(Boolean).map(tk => ({ id: tk.id, name: tk.name, status: tk.status, dueDate: tk.dueDate, category: tk.category, assignTo: tk.assignTo })),
            reminders: (t.reminders || []).filter(Boolean).map(r => ({ id: r.id, title: r.title, date: r.date, message: r.message, channels: r.channels, parties: r.parties || [], sent: r.sent })),
          }));
          setTransactions(normalized);
        }
      })
      .catch(e => console.error("Failed to load transactions:", e))
      .finally(() => setTxLoading(false));
  }, []);

  // Load contacts from database
  useEffect(() => {
    fetch(`${API}/contacts`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        if (data.contacts) {
          setContacts(data.contacts.map(c => ({ id: c.id, role: c.role, name: c.name, email: c.email, phone: c.phone, company: c.company, notes: c.notes })));
        }
      })
      .catch(e => console.error("Failed to load contacts:", e));
  }, []);
  const [view, setView] = useState("dashboard");
  const [showReports, setShowReports] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [showTeam, setShowTeam] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [forcePasswordReset, setForcePasswordReset] = useState(false);
  const [showCompanySettings, setShowCompanySettings] = useState(false);
  const [showAgentProfile, setShowAgentProfile] = useState(false);
  const [showContactBook, setShowContactBook] = useState(false);
  const [contactBookCallback, setContactBookCallback] = useState(null);

  useEffect(() => {
    // Contacts saved to DB via API
  }, [contacts]);

  const addContact = (c) => setContacts(prev => [c, ...prev]);
  const editContact = (c) => setContacts(prev => prev.map(x => x.id === c.id ? c : x));
  const deleteContact = async (id) => {
    setContacts(prev => prev.filter(x => x.id !== id));
    const tok = localStorage.getItem("tp_token") || "";
    try { await fetch(API + "/contacts/" + id, { method: "DELETE", headers: { "Authorization": "Bearer " + tok } }); } catch(e) { console.error("Delete failed:", e); }
  };

  const openContactBook = (onSelect) => {
    setContactBookCallback(() => onSelect);
    setShowContactBook(true);
  };

  const selectedTx = transactions.find(t => t.id === selectedId);
  const tok = localStorage.getItem("tp_token") || "";
  const aH = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };
  const updateTransaction = useCallback(async (updated) => {
    setTransactions(txs => txs.map(t => t.id === updated.id ? updated : t));
    const freshTok = localStorage.getItem("tp_token") || "";
    const freshH = { "Content-Type": "application/json", "Authorization": "Bearer " + freshTok };
    try { const r = await fetch(API + "/transactions/" + updated.id, { method: "PUT", headers: freshH, body: JSON.stringify({ address: updated.address, city: updated.city, state: updated.state, zipCode: updated.zipCode, county: updated.county, mlsNumber: updated.mlsNumber, propertyType: updated.propertyType, type: updated.type, status: updated.status, listPrice: updated.listPrice, contractPrice: updated.contractPrice, openDate: updated.openDate, closingDate: updated.closingDate, executedDate: updated.executedDate, notes: updated.notes, propertyAccess: updated.propertyAccess, commissionListing: updated.commissionListing, commissionBuyer: updated.commissionBuyer, transactionFee: updated.transactionFee, brokerageSplit: updated.brokerageSplit, officeFlatFee: updated.officeFlatFee, mailAway: updated.mailAway, commissionNotes: updated.commissionNotes, referralSource: updated.referralSource, assignedAgent: updated.assignedAgentId, internalNotes: updated.messages || [], smsThreads: updated.smsThreads || {}, parties: updated.parties || [], tasks: updated.tasks || [], reminders: updated.reminders || [] }) }); if (!r.ok) { const e = await r.json(); console.error("Save error:", e); } } catch(e) { console.error("Save failed:", e); }
  }, []);
  const addTransaction = tx => { setTransactions(txs => [tx, ...txs]); setSelectedId(tx.id); setView("detail"); };

  const duplicateTransaction = async (tx) => {
    const newAddr = window.prompt("Enter address for the new transaction:", tx.address + " (Copy)");
    if (!newAddr) return;
    const tok = localStorage.getItem("tp_token") || "";
    const freshH = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };
    const newTx = {
      address: newAddr, city: tx.city, state: tx.state, zipCode: tx.zipCode,
      county: tx.county, mlsNumber: "", propertyType: tx.propertyType,
      type: tx.type, status: "Active", listPrice: tx.listPrice,
      contractPrice: "", openDate: "", closingDate: "", notes: tx.notes || "",
      commissionListing: tx.commissionListing, commissionBuyer: tx.commissionBuyer,
      brokerageSplit: tx.brokerageSplit, officeFlatFee: tx.officeFlatFee,
      parties: [], smsThreads: {},
      tasks: (tx.tasks || []).map(t => ({ ...t, id: genId(), status: "Pending", dueDate: null })),
      reminders: [],
    };
    try {
      const res = await fetch(API + "/transactions", { method: "POST", headers: freshH, body: JSON.stringify(newTx) });
      const data = await res.json();
      if (data.success && data.transaction) {
        const t = data.transaction;
        const normalized = {
          id: t.id, address: t.address, city: t.city, state: t.state,
          zipCode: t.zip_code, county: t.county, mlsNumber: t.mls_number,
          propertyType: t.property_type, type: t.transaction_type,
          status: t.status, listPrice: t.list_price, contractPrice: t.contract_price,
          openDate: t.open_date, closingDate: t.closing_date, notes: t.notes,
          smsThreads: {}, parties: [], tasks: newTx.tasks, reminders: [],
          commissionListing: t.commission_listing, commissionBuyer: t.commission_buyer,
        };
        setTransactions(txs => [normalized, ...txs]);
        setSelectedId(normalized.id);
        setView("detail");
      }
    } catch (e) { alert("Failed to duplicate: " + e.message); }
  };

  const invitePartyToPortal = async (party, tx) => {
    if (!party.email) { alert("This party has no email address. Add one first."); return; }
    if (!window.confirm(`Send portal invitation to ${party.name} (${party.email})?`)) return;
    const tok = localStorage.getItem("tp_token") || "";
    // Find agent and TC from transaction parties
    const agent = tx && tx.parties ? tx.parties.find(p => p.role === "Listing Agent" || p.role === "Buyer's Agent") : null;
    const tc = tx && tx.parties ? tx.parties.find(p => p.role === "Transaction Coordinator") : null;
    try {
      const res = await fetch(API + "/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
        body: JSON.stringify({
          email: party.email,
          firstName: party.name.split(" ")[0],
          lastName: party.name.split(" ").slice(1).join(" ") || ".",
          role: "client",
          phone: party.phone || "",
          partyRole: party.role,
          transactionAddress: tx ? tx.address : "",
          transactionCity: tx ? tx.city : "",
          agentName: agent ? agent.name : "",
          agentPhone: agent ? agent.phone : "",
          agentEmail: agent ? agent.email : "",
          tcName: tc ? tc.name : "",
          tcPhone: tc ? tc.phone : "",
          tcEmail: tc ? tc.email : "",
        }),
      });
      const data = await res.json();
      if (res.ok || data.error === "Email already registered") {
        alert("Invitation sent to " + party.email + "! They will receive an email with portal access and transaction details.");
      } else {
        alert("Failed: " + (data.error || "Unknown error"));
      }
    } catch (e) { alert("Error: " + e.message); }
  };

  return (
    <>
      {showReports && <Reports transactions={transactions} onBack={() => setShowReports(false)} />}
      {showCalendar && <CalendarView transactions={transactions} onBack={() => setShowCalendar(false)} onSelectTx={id => { setSelectedId(id); setView("detail"); setShowCalendar(false); }} />}
      {!showReports && view === "new" && <NewTransactionForm onSave={addTransaction} onCancel={() => setView("dashboard")} />}
      {!showReports && !showCalendar && view === "detail" && selectedTx && (
        <TransactionDetail
          tx={selectedTx}
          onUpdate={updateTransaction}
          onDuplicate={duplicateTransaction}
          currentUser={currentUser}
          onBack={() => setView("dashboard")}
          contacts={contacts}
          onSaveContact={addContact}
          onOpenContactBook={openContactBook}
          onInviteParty={(party) => invitePartyToPortal(party, selectedTx)}
        />
      )}
      {!showReports && !showCalendar && view === "dashboard" && (
        <Dashboard
          transactions={transactions}
          onSelect={id => { setSelectedId(id); setView("detail"); }}
          onNew={() => setView("new")}
          onOpenContactBook={() => openContactBook(null)}
          contactCount={contacts.length}
          onLogout={onLogout}
          onOpenTeam={() => setShowTeam(true)}
          onChangePassword={() => setShowChangePassword(true)}
          onReports={() => setShowReports(true)}
          onCompanySettings={() => setShowCompanySettings(true)}
          onAgentProfile={() => setShowAgentProfile(true)}
          onCalendar={() => setShowCalendar(true)}
        />
      )}
      {showTeam && <UserManagement onClose={() => setShowTeam(false)} />}

      {showChangePassword && <ChangePassword onClose={() => setShowChangePassword(false)} />}
      {forcePasswordReset && <ChangePassword forceReset onClose={() => setForcePasswordReset(false)} />}
      {showCompanySettings && <CompanySettings onClose={() => setShowCompanySettings(false)} onChangePassword={() => { setShowCompanySettings(false); setShowChangePassword(true); }} />}
      {showAgentProfile && <AgentProfile currentUser={currentUser} onClose={() => setShowAgentProfile(false)} />}
      {showContactBook && (
        <ContactBook
          contacts={contacts}
          onClose={() => { setShowContactBook(false); setContactBookCallback(null); }}
          onSelect={contactBookCallback}
          onAdd={addContact}
          onEdit={editContact}
          onDelete={deleteContact}
        />
      )}
    </>
  );
}


// Auth state lives here - completely isolated from MainApp
function AuthGate() {
  const [authUser, setAuthUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tp_user")); } catch { return null; }
  });
  const [forcePasswordReset, setForcePasswordReset] = useState(false);

  if (forcePasswordReset) {
    return <ChangePassword forceReset onClose={() => { setForcePasswordReset(false); }} />;
  }

  if (!authUser) {
    return <LoginScreen onLogin={(user, token) => {
      localStorage.setItem("tp_token", token);
      localStorage.setItem("tp_user", JSON.stringify(user));
      setAuthUser(user);
      if (user.passwordResetRequired) setForcePasswordReset(true);
    }} />;
  }

  if (authUser.role === "client") {
    return <ClientPortal user={authUser} onLogout={() => {
      localStorage.removeItem("tp_token");
      localStorage.removeItem("tp_user");
      setAuthUser(null);
    }} />;
  }

  return <MainApp currentUser={authUser} onLogout={() => {
    localStorage.removeItem("tp_token");
    localStorage.removeItem("tp_user");
    setAuthUser(null);
  }} />;
}

export default AuthGate;
// deploy trigger Wed Apr 22 20:35:35 EDT 2026
