import LoginScreen from "./LoginScreen";
import BuyerCalculator from "./components/BuyerCalculator";
import PreApprovalCard, { PreApprovalBadge } from './components/PreApprovalCard';
import SellerCalculator from "./components/SellerCalculator";
import CMACalculator from "./components/CMACalculator";
import TxFormsTab from "./components/TxFormsTab";
import UserManagement from "./UserManagement";
import ContactsPage from "./ContactsPage";
import ExpensesPage from './ExpensesPage';
import FormsPage from './FormsPage';
import FormDownloadPage from './FormDownloadPage';
import ComplianceAdmin from "./ComplianceAdmin";
import TaskTemplatesAdmin from "./TaskTemplatesAdmin";
import ContractAutoIntake from "./ContractAutoIntake";
import ContractUploadPublic from "./ContractUploadPublic";
import ComplianceDashboard from "./ComplianceDashboard";
import DocumentsTab from "./DocumentsTab";
import TransactionChat from "./TransactionChat";
import Reports from "./Reports";
import DailyDashboard from "./DailyDashboard";
import VendorLibrary from "./VendorLibrary";
import ChangePassword from "./ChangePassword";
import CompanySettings from "./CompanySettings";
import AgentProfile from "./AgentProfile";
import ClientPortal from "./ClientPortal";
import FaqHelpButton from "./components/FaqHelpButton";

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
const REFERRAL_SOURCES = ["Past Client", "Referral", "Zillow", "Realtor.com", "Open House", "Sign Call", "Social Media", "Website", "Other"];
const OCCUPANCY_OPTIONS = ["Owner Occupied", "Tenant Occupied", "Vacant"];
const COUNTIES = ["Orange", "Osceola", "Seminole", "Polk", "Brevard", "Lake", "Volusia", "Hillsborough", "Other"];
const PARTY_ROLES = [
  "Listing Agent", "Buyer's Agent", "Transaction Coordinator",
  "Title Company", "Loan Officer/Lender", "Inspector", "Appraiser",
  "HOA Manager", "Seller", "Buyer", "Attorney", "Insurance Agent", "Referral", "Other"
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
    { name: "Prepare Estimated Net Sheet for Seller", phase: "active", daysFromOpen: null, category: "Pre-Listing", assignTo: "Listing Agent" },
    { name: "Receive All Listing Docs Signed (upload if wet signed)", phase: "active", daysFromOpen: null, category: "Pre-Listing", assignTo: "Listing Agent" },
    { name: "Send Copy of Listing Documents to Seller", phase: "active", daysFromOpen: null, category: "Pre-Listing", assignTo: "Listing Agent" },
    { name: "Upload Listing Agreement (required)", phase: "active", daysFromOpen: null, category: "Pre-Listing", assignTo: "Listing Agent" },
    { name: "Upload MLS Data Entry Form (required)", phase: "active", daysFromOpen: null, category: "Pre-Listing", assignTo: "Listing Agent" },
    { name: "Upload Broker's Seller Disclosure (required)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
    { name: "Upload Seller's Property Disclosure (required)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
    { name: "Upload Flood Disclosure (required)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
    { name: "Upload Estimated Net Sheet (required)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Listing Agent" },
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
    { name: "Prepare Estimated Net Sheet / Buyer Cost Estimate", phase: "active", daysFromOpen: null, category: "Showing", assignTo: "Buyer's Agent" },
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
    { name: "Upload Estimated Net Sheet / Buyer Cost Estimate (required)", phase: "active", daysFromOpen: null, category: "Disclosure", assignTo: "Buyer's Agent" },
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

const NEW_CONSTRUCTION_TASKS = [
  // ── PRE-CONTRACT (critical builder registration) ─────────
  { name: "Register as buyer's agent with builder (CRITICAL — first visit)", phase: "active", daysFromOpen: null, category: "Pre-Contract", assignTo: "Buyer's Agent" },
  // ── CONTRACT PHASE ───────────────────────────────────────
  { name: "Review and negotiate builder contract", phase: "contract", daysFromOpen: 0, category: "Contract", assignTo: "Buyer's Agent" },
  { name: "Submit earnest money to builder", phase: "contract", daysFromOpen: 3, category: "Contract", assignTo: "Buyer" },
  { name: "Loan application submitted", phase: "contract", daysFromOpen: 7, category: "Financing", assignTo: "Loan Officer/Lender" },
  { name: "Review HOA docs & community CC&Rs", phase: "contract", daysFromOpen: 10, category: "HOA", assignTo: "Buyer's Agent" },
  { name: "Buyer attends design center / structural options appointment", phase: "contract", daysFromOpen: 14, category: "Design", assignTo: "Buyer" },
  { name: "Track construction milestones (foundation/frame/drywall)", phase: "contract", daysFromOpen: null, category: "Construction", assignTo: "Buyer's Agent" },
  { name: "Schedule independent pre-drywall inspection", phase: "contract", daysFromOpen: null, category: "Inspection", assignTo: "Inspector" },
  { name: "Pre-drywall walk-through with builder", phase: "contract", daysFromOpen: null, category: "Construction", assignTo: "Buyer's Agent" },
  { name: "Schedule independent final inspection", phase: "contract", daysFromOpen: -14, category: "Inspection", assignTo: "Inspector" },
  { name: "Order home insurance", phase: "contract", daysFromOpen: -21, category: "Closing Prep", assignTo: "Insurance Agent" },
  { name: "Coordinate utilities setup (power, water, internet)", phase: "contract", daysFromOpen: -14, category: "Closing Prep", assignTo: "Buyer" },
  { name: "Builder orientation walk-through", phase: "contract", daysFromOpen: -10, category: "Closing Prep", assignTo: "Buyer's Agent" },
  { name: "Review builder warranty terms", phase: "contract", daysFromOpen: -7, category: "Closing Prep", assignTo: "Buyer's Agent" },
  { name: "Final walk-through with builder", phase: "contract", daysFromOpen: -1, category: "Closing Prep", assignTo: "Buyer's Agent" },
  // ── CLOSING PHASE ────────────────────────────────────────
  { name: "Verify all design center selections in final paperwork", phase: "closing", daysFromOpen: 0, category: "Closing", assignTo: "Buyer's Agent" },
  { name: "Final walk-through punch list signed off", phase: "closing", daysFromOpen: 0, category: "Closing", assignTo: "Buyer's Agent" },
  { name: "Buyer attends closing", phase: "closing", daysFromOpen: 0, category: "Closing", assignTo: "Buyer" },
  { name: "Receive builder warranty packet & set 11-month walk reminder", phase: "closing", daysFromOpen: 0, category: "Post-Closing", assignTo: "Buyer's Agent" },
];



const STATUS_CONFIG = {
  "Active": { color: "#B7860B", bg: "#FEF9E7" },
  "Under Contract": { color: "#1D4ED8", bg: "#DBEAFE" },
  "Inspection": { color: "#7C3AED", bg: "#EDE9FE" },
  "Appraisal": { color: "#0F766E", bg: "#CCFBF1" },
  "Clear to Close": { color: "#0369A1", bg: "#E0F2FE" },
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

// ===== Pipeline View (read-only) =====
const PIPELINE_COLUMNS = ["Active", "Under Contract", "Inspection", "Appraisal", "Clear to Close", "Closed"];

function PipelineCard({ tx, onSelect }) {
  const completed = tx.tasks ? tx.tasks.filter(t => t.status === "Completed").length : 0;
  const total = tx.tasks ? tx.tasks.length : 0;
  const progress = total > 0 ? Math.round(completed / total * 100) : 0;
  const overdue = tx.tasks ? tx.tasks.filter(t => { const d = daysUntil(t.dueDate); return d !== null && d < 0 && t.status !== "Completed" && t.status !== "Waived"; }).length : 0;
  const dtc = daysUntil(tx.closingDate);
  const price = tx.contractPrice || tx.listPrice;
  return (
    <div onClick={() => onSelect(tx.id)} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, marginBottom: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", cursor: "pointer" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{tx.type === "Buyer Representation" ? "🏡" : "🏠"}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{tx.type === "Buyer Representation" ? "Buyer" : "Listing"}</span>
        {overdue > 0 && <span title={`${overdue} overdue task(s)`} style={{ marginLeft: "auto", background: COLORS.dangerBg, color: COLORS.danger, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8 }}>⚠ {overdue}</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.navy, marginBottom: 2, lineHeight: 1.3 }}>{tx.address}</div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>{tx.city}, FL</div>
      {price && <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginBottom: 4 }}>${Number(price).toLocaleString()}</div>}
      {tx.closingDate && <div style={{ fontSize: 11, color: dtc !== null && dtc < 7 && dtc >= 0 ? COLORS.danger : COLORS.muted, marginBottom: 6 }}>📅 {tx.closingDate}{dtc !== null ? ` (${dtc < 0 ? "past" : dtc + "d"})` : ""}</div>}
      {total > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ height: 4, background: COLORS.bg, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: progress + "%", background: progress === 100 ? COLORS.success : COLORS.navy }} />
          </div>
          <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{completed}/{total} tasks</div>
        </div>
      )}
      {tx.assignedAgentName && <div style={{ fontSize: 10, color: COLORS.muted }}>👤 {tx.assignedAgentName}</div>}
    </div>
  );
}

function PipelineColumn({ status, transactions, onSelect }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Active"];
  return (
    <div style={{ minWidth: 260, width: 260, background: COLORS.bg, borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 280px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${cfg.color}` }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
        <div style={{ fontWeight: 700, fontSize: 12, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{status}</div>
        <div style={{ marginLeft: "auto", background: "#fff", color: COLORS.muted, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>{transactions.length}</div>
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: COLORS.muted, fontSize: 11, fontStyle: "italic" }}>No transactions</div>
        ) : (
          transactions.map(tx => <PipelineCard key={tx.id} tx={tx} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

function PipelineBoard({ transactions, onSelect }) {
  const grouped = PIPELINE_COLUMNS.reduce((acc, s) => { acc[s] = transactions.filter(t => t.status === s); return acc; }, {});
  return (
    <div style={{ padding: 16, display: "flex", gap: 12, overflowX: "auto", overflowY: "hidden" }}>
      {PIPELINE_COLUMNS.map(s => <PipelineColumn key={s} status={s} transactions={grouped[s]} onSelect={onSelect} />)}
    </div>
  );
}
// ===== End Pipeline =====



// ─── INJECT MOBILE STYLES ─────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("lizteam-mobile")) {
  const s = document.createElement("style");
  s.id = "lizteam-mobile";
  s.textContent = `
    *, *::before, *::after { box-sizing: border-box !important; }
    .tx-list-desktop { display: block; }
    .tx-list-mobile { display: none; }
    body { overflow-x: hidden !important; }
    #root { max-width: 100vw; overflow-x: hidden; }
    input, textarea, select { font-size: 16px !important; }
    @media (max-width: 768px) {
      /* Stats bar: 2-col grid on mobile, no horizontal scroll */
      [data-stats-bar] {
        display: grid !important;
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 1px;
        background: rgba(255,255,255,0.08);
        overflow: visible !important;
        padding-bottom: 0 !important;
        margin-top: 12px !important;
      }
      [data-stats-bar] > div {
        min-width: 0 !important;
        flex-shrink: 1 !important;
        padding: 10px 14px !important;
        background: #0F2044;
      }
      [data-stats-bar] > div > div:first-child {
        font-size: 10px !important;
      }
      [data-stats-bar] > div > div:nth-child(2) {
        font-size: 18px !important;
      }
      /* Toolbar: stack search and chip group; chips/sort/view scroll horizontally */
      [data-toolbar] {
        flex-direction: column !important;
        align-items: stretch !important;
        padding: 10px 16px !important;
        gap: 8px !important;
        flex-wrap: nowrap !important;
      }
      [data-toolbar] > input { max-width: 100% !important; width: 100% !important; }
      [data-toolbar] > div, [data-toolbar] > button {
        margin-left: 0 !important;
      }
      [data-toolbar] > div {
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
        flex-wrap: nowrap !important;
        white-space: nowrap;
        scrollbar-width: thin;
        padding-bottom: 4px;
        max-width: 100%;
      }
      [data-toolbar] > div > * { flex-shrink: 0 !important; }
      [data-msg-grid] { grid-template-columns: 1fr !important; height: auto !important; min-height: 480px; }
      [data-form-grid] { grid-template-columns: 1fr !important; }
      [data-tx-grid] { grid-template-columns: 1fr !important; }
      [data-modal] { width: 100% !important; max-width: 100vw !important; max-height: 100vh !important; border-radius: 0 !important; overflow-y: auto !important; }
      [data-tabs] { overflow-x: auto !important; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch; }
      .tx-list-desktop { display: none !important; }
      .tx-list-mobile { display: block !important; }
      [data-header] { flex-wrap: wrap !important; gap: 8px !important; }
      [data-dash-header] {
        padding-top: 10px !important;
        padding-bottom: 6px !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
      }
      [data-dash-logo] {
        gap: 8px !important;
      }
      [data-dash-logo] > div:first-child {
        width: 28px !important;
        height: 28px !important;
        border-radius: 6px !important;
      }
      [data-dash-logo] > div:first-child > span {
        font-size: 14px !important;
      }
      [data-dash-logo] > div:nth-child(2) > div:first-child {
        font-size: 15px !important;
        line-height: 1.1 !important;
      }
      [data-dash-logo] > div:nth-child(2) > div:nth-child(2) {
        font-size: 9px !important;
        line-height: 1.1 !important;
        margin-top: 1px !important;
      }
      [data-tx-detail-header] {
        padding: 10px 12px !important;
        gap: 8px !important;
        position: relative !important;
      }
      [data-tx-detail-header] > div:first-of-type {
        flex: 1 1 calc(100% - 60px) !important;
        min-width: 0 !important;
      }
      [data-tx-detail-header] > div:first-of-type > div:first-child {
        font-size: 14px !important;
        line-height: 1.3 !important;
        word-break: break-word;
      }
      [data-tx-detail-header] > div:first-of-type > div:nth-child(2) {
        font-size: 11px !important;
      }
      [data-tx-detail-header] > select,
      [data-tx-detail-header] > button {
        flex-shrink: 0 !important;
      }
      [data-tx-detail-header]::after {
        content: "";
        flex-basis: 100%;
        height: 0;
      }
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
      {options ? <select value={value} onChange={e => onChange(e.target.value)} style={base}><option value="">Select...</option>{options.map(o => typeof o === "object" ? <option key={o.value} value={o.value}>{o.label}</option> : <option key={o} value={o}>{o}</option>)}</select>
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

function TransactionListView({ transactions, sortKey, sortDir, toggleSort, onSelect }) {
  const arrow = (key) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  const fmtPrice = (p) => p ? "$" + Number(p).toLocaleString() : "—";
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const cols = [
    { key: "address", label: "Address" },
    { key: "status", label: "Status" },
    { key: "closingDate", label: "Closing" },
    { key: "openDate", label: "Open" },
    { key: "price", label: "Price" },
    { key: "progress", label: "Progress" },
  ];
  return (
    <div style={{ padding: "16px 24px" }}>
      <div className="tx-list-desktop" style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}` }}>
                {cols.map(c => (
                  <th key={c.key} onClick={() => toggleSort(c.key)} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: COLORS.navy, cursor: "pointer", userSelect: "none", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11 }}>{c.label}{arrow(c.key)}</th>
                ))}
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: COLORS.navy, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11 }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {transactions.filter(tx => tx.needsFirstContact).map(tx => (
                <tr key={"alert-" + tx.id} style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
                  <td colSpan="7" style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20 }}>🔔</span>
                        <div>
                          <div style={{ fontWeight: 700, color: "#991b1b", fontSize: 13 }}>NEW BUYER INQUIRY — Action Required</div>
                          <div style={{ fontSize: 12, color: "#7f1d1d" }}>{tx.address} · {tx.city}, FL · Contact within 24 hours</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={e => { e.stopPropagation(); onSelect(tx.id); }} style={{ background: "#c8102e", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View →</button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {transactions.map(tx => {
                const completed = tx.tasks ? tx.tasks.filter(t => t.status === "Completed").length : 0;
                const total = tx.tasks ? tx.tasks.length : 0;
                const progress = total > 0 ? Math.round(completed / total * 100) : 0;
                const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG["Active"];
                const price = tx.contractPrice || tx.listPrice;
                return (
                  <tr key={tx.id} onClick={() => onSelect(tx.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${COLORS.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = COLORS.bg}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: COLORS.navy }}>{tx.address}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{tx.city}, FL</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 12, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 11 }}>{tx.status}</span>
                    </td>
                    <td style={{ padding: "12px 14px", color: COLORS.text }}>{fmtDate(tx.closingDate)}</td>
                    <td style={{ padding: "12px 14px", color: COLORS.muted }}>{fmtDate(tx.openDate)}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: COLORS.navy }}>{fmtPrice(price)}</td>
                    <td style={{ padding: "12px 14px", minWidth: 140 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: progress + "%", height: "100%", background: progress === 100 ? COLORS.success : progress > 50 ? COLORS.gold : COLORS.muted }} />
                        </div>
                        <span style={{ fontSize: 11, color: COLORS.muted, minWidth: 32, textAlign: "right" }}>{progress}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", color: COLORS.muted, fontSize: 11 }}>{tx.type === "Buyer Representation" ? "Buyer" : "Listing"}</td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr><td colSpan="7" style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>No transactions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="tx-list-mobile">
        {transactions.length === 0 && <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, background: "#fff", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>No transactions found.</div>}
        {transactions.map(tx => {
          const completed = tx.tasks ? tx.tasks.filter(t => t.status === "Completed").length : 0;
          const total = tx.tasks ? tx.tasks.length : 0;
          const progress = total > 0 ? Math.round(completed / total * 100) : 0;
          const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG["Active"];
          const price = tx.contractPrice || tx.listPrice;
          return (
            <div key={tx.id} onClick={() => onSelect(tx.id)} style={{ background: !tx.assignedAgentId ? "#fef3c7" : tx.needsReview ? "#eff6ff" : tx.needsFirstContact ? "#fef2f2" : "#fff", border: `2px solid ${!tx.assignedAgentId ? "#fde68a" : tx.needsReview ? "#bfdbfe" : tx.needsFirstContact ? "#fecaca" : COLORS.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
              {!tx.assignedAgentId && (
                <div style={{ background: "#f59e0b", color: "white", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, marginBottom: 8, display: "inline-block" }}>
                  ⚠️ UNASSIGNED LEAD — Tap to Assign an Agent
                </div>
              )}
              {tx.assignedAgentId && tx.needsReview && (
                <div style={{ background: "#2563eb", color: "white", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, marginBottom: 8, display: "inline-block" }}>
                  📋 NEW FROM CONTRACT — Review & Verify
                </div>
              )}
              {tx.assignedAgentId && !tx.needsReview && tx.needsFirstContact && (
                <div style={{ background: "#c8102e", color: "white", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, marginBottom: 8, display: "inline-block" }}>
                  🔔 NEW BUYER INQUIRY — Contact Within 24hrs
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: COLORS.navy, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis" }}>{tx.address}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{tx.city}, FL · {tx.type === "Buyer Representation" ? "Buyer" : "Listing"}</div>
                </div>
                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap" }}>{tx.status}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 12 }}>
                <div style={{ color: COLORS.muted }}>Closing: <strong style={{ color: COLORS.text }}>{fmtDate(tx.closingDate)}</strong></div>
                <div style={{ color: COLORS.navy, fontWeight: 600 }}>{fmtPrice(price)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1, height: 5, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: progress + "%", height: "100%", background: progress === 100 ? COLORS.success : progress > 50 ? COLORS.gold : COLORS.muted }} />
                </div>
                <span style={{ fontSize: 10, color: COLORS.muted, minWidth: 30, textAlign: "right" }}>{progress}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PartyAvatar({ party, size = 40 }) {
  const initials = party.name.split(" ").map(w => w[0]).join("").toUpperCase().substr(0, 2);
  const color = roleColor(party.role);
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color + "22", color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>{initials}</div>;
}

function PartyCard({ party, txId, onRemove, onEdit, onClick, onInvite, onSendFollowup, onSendWelcome, onResetPassword }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8, cursor: onClick ? "pointer" : "default" }}>
      <PartyAvatar party={party} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{party.name}</div>
        {txId && party.role && /buyer/i.test(party.role) && <PreApprovalBadge transactionId={txId} />}
        <div style={{ fontSize: 12, color: roleColor(party.role), fontWeight: 600, marginBottom: 2 }}>{party.role}</div>
        {party.company && <div style={{ fontSize: 12, color: COLORS.muted }}>{party.company}</div>}
        {party.email && <div style={{ fontSize: 12, color: COLORS.muted }}>{party.email}</div>}
        {party.phone && <div style={{ fontSize: 12, color: COLORS.muted }}>{party.phone}</div>}
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {onInvite && <button onClick={e => { e.stopPropagation(); onInvite(); }} style={{ background: "none", border: "1px solid #C0392B", borderRadius: 6, cursor: "pointer", color: "#C0392B", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>Send Invite</button>}
        {onSendFollowup && (party.email || party.phone) && <button onClick={e => { e.stopPropagation(); onSendFollowup(party); }} style={{ background: "#C0392B", border: "1px solid #C0392B", borderRadius: 6, cursor: "pointer", color: "#fff", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>Follow Up</button>}
        {onSendWelcome && party.email && <button onClick={e => { e.stopPropagation(); onSendWelcome(party); }} title="Send (or re-send) the role-specific welcome email with key dates, financial summary, parties roster, and the contract document package. Use this when you've added or corrected this party's email after the initial Under Contract send." style={{ background: "#1E8449", border: "1px solid #1E8449", borderRadius: 6, cursor: "pointer", color: "#fff", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>✉️ Send Welcome</button>}
        {onResetPassword && party.email && <button onClick={e => { e.stopPropagation(); onResetPassword(party); }} title="Email a one-time secure link so this party can set a new password. The link expires in 1 hour. Use this when a party calls saying they can't log in." style={{ background: "#7c3aed", border: "1px solid #7c3aed", borderRadius: 6, cursor: "pointer", color: "#fff", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>🔐 Reset PW</button>}
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
  const partiesWithPhone = tx.parties.filter(p => (p.phone && p.phone.trim()) || (p.email && p.email.trim()));

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
    const tok = localStorage.getItem("tp_token") || "";
    for (const party of parties) {
      const partyResult = { name: party.name, smsSuccess: null, emailSuccess: null, error: null };
      // Send SMS if party has phone
      if (party.phone) {
        try {
          const res = await fetch(`${SMS_SERVER}/sms/send`, {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
            body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toPhone: party.phone, toName: party.name, toRole: party.role, message: message.trim(), fromName: "The Liz Team" }),
          });
          const data = await res.json();
          partyResult.smsSuccess = data.success;
          if (!data.success) partyResult.error = data.error;
        } catch { partyResult.smsSuccess = false; partyResult.error = "SMS unreachable"; }
      }
      // Send Email if party has email
      if (party.email) {
        try {
          const res = await fetch(`${SMS_SERVER}/email/send`, {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
            body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toEmail: party.email, toName: party.name, toRole: party.role, subject: `⏰ Reminder: ${task.name} — ${tx.address}`, message: message.trim(), fromName: "The Liz Team" }),
          });
          const data = await res.json();
          partyResult.emailSuccess = data.success;
          if (!data.success && !partyResult.error) partyResult.error = data.error;
        } catch { partyResult.emailSuccess = false; if (!partyResult.error) partyResult.error = "Email unreachable"; }
      }
      const success = (partyResult.smsSuccess === true || partyResult.smsSuccess === null) && (partyResult.emailSuccess === true || partyResult.emailSuccess === null);
      results.push({ name: party.name, success, error: partyResult.error, details: partyResult });
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




// ═══════════════════════════════════════════════════════════════
// WIN THE DAY BUTTON + MODAL
// ═══════════════════════════════════════════════════════════════
function PersonalTaskAddButton({ token }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const CATEGORIES = ["Buyer", "Seller", "Pre-Approval", "Follow Up", "Other"];
  const API = "https://liz-team-server-api-production.up.railway.app";

  const PRESETS = [
    { label: "Today", days: 0 }, { label: "Tomorrow", days: 1 },
    { label: "2 days", days: 2 }, { label: "3 days", days: 3 },
    { label: "1 week", days: 7 }, { label: "2 weeks", days: 14 },
    { label: "1 month", days: 30 }, { label: "3 months", days: 90 },
    { label: "6 months", days: 180 }, { label: "1 year", days: 365 },
  ];

  const setPreset = (days) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  };

  const today = new Date().toISOString().slice(0, 10);
  const selectedDays = dueDate ? Math.round((new Date(dueDate + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000) : null;

  const save = async () => {
    if (!title.trim()) { alert("Task title required"); return; }
    setSaving(true);
    try {
      const r = await fetch(API + "/personal-tasks", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), notes: notes || null, due_date: dueDate || null, category: category || null })
      });
      if (!r.ok) { const e = await r.json(); alert("Failed: " + (e.error || "unknown")); setSaving(false); return; }
      window.dispatchEvent(new Event("wintheday:refresh"));
      setTitle(""); setNotes(""); setDueDate(""); setCategory(""); setOpen(false);
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}
        title="Add a personal task — not tied to any transaction">
        📝 + Task
      </button>
      {open && (
        <div onClick={() => !saving && setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2332", marginBottom: 6 }}>📝 Add Personal Task</div>
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: "#1E3A8A", lineHeight: 1.5 }}>
              <strong>What this is:</strong> A personal to-do that's NOT tied to any transaction (e.g., "Renew real estate license", "Order business cards"). Appears on your Win-the-Day dashboard.
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>Category</div>
              <select value={category} onChange={e => setCategory(e.target.value)} disabled={saving}
                style={{ width: "100%", padding: 9, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }}>
                <option value="">— select category —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>Task <span style={{ color: "#C0392B" }}>*</span></div>
              <input value={title} onChange={e => setTitle(e.target.value)} disabled={saving}
                placeholder="What do you need to do?"
                style={{ width: "100%", padding: 9, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>When?</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {PRESETS.map(p => {
                  const active = selectedDays === p.days;
                  return (
                    <button key={p.label} type="button" onClick={() => setPreset(p.days)} disabled={saving}
                      style={{ padding: "6px 10px", borderRadius: 16, border: active ? "1.5px solid #0c4a6e" : "1px solid #d1d5db", background: active ? "#0c4a6e" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#6b7280" }}>Or custom date:</span>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={saving}
                  style={{ padding: 6, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, fontFamily: "inherit" }} />
                {dueDate && (
                  <button type="button" onClick={() => setDueDate("")} disabled={saving}
                    style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>Notes (optional)</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={saving} rows={3}
                style={{ width: "100%", padding: 9, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => !saving && setOpen(false)} disabled={saving}
                style={{ flex: 1, padding: 11, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>
                Cancel
              </button>
              <button onClick={save} disabled={saving || !title.trim()}
                style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: (saving || !title.trim()) ? "#9ca3af" : "#1E8449", color: "#fff", fontWeight: 700, fontSize: 14, cursor: (saving || !title.trim()) ? "not-allowed" : "pointer" }}>
                {saving ? "Saving..." : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WinTheDayButton({ token }) {
  const [taskCount, setTaskCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const API = "https://liz-team-server-api-production.up.railway.app";

  // Poll every 5 min + listen for explicit refresh events (e.g. after a task is added)
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 5 * 60 * 1000);
    const handler = () => fetchCount();
    window.addEventListener("wintheday:refresh", handler);
    window.addEventListener("focus", handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener("wintheday:refresh", handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  const fetchCount = async () => {
    try {
      const [tasksRes, callsRes] = await Promise.all([
        fetch(API + "/dashboard/tasks", { headers: { Authorization: "Bearer " + token } }),
        fetch(API + "/contacts/due-today", { headers: { Authorization: "Bearer " + token } }).catch(() => null),
      ]);
      const data = await tasksRes.json();
      let total = 0;
      if (data.success) total += (data.overdue?.length || 0) + (data.dueToday?.length || 0);
      if (callsRes && callsRes.ok) {
        const c = await callsRes.json();
        total += (c.calls?.length || 0);
      }
      setTaskCount(total);
    } catch (e) {}
  };

  const btnColor = taskCount === 0 ? "rgba(255,255,255,0.12)" :
                   taskCount <= 2 ? "#B7770D" : "#C0392B";
  const btnBorder = taskCount === 0 ? "1px solid rgba(255,255,255,0.22)" :
                    taskCount <= 2 ? "1px solid #F59E0B" : "1px solid #E74C3C";

  return (
    <>
      <button onClick={() => setShowModal(true)}
        style={{ background: btnColor, border: btnBorder,
          color: "#fff", borderRadius: 8, padding: "7px 14px",
          cursor: "pointer", fontSize: 12, fontWeight: 700,
          fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          transition: "all 0.2s" }}>
        ⚡ Win The Day
        {taskCount > 0 && (
          <span style={{ background: "#fff",
            color: taskCount <= 2 ? "#B7770D" : "#C0392B",
            borderRadius: 20, padding: "1px 7px",
            fontSize: 11, fontWeight: 800 }}>
            {taskCount}
          </span>
        )}
      </button>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000,
          display: "flex", flexDirection: "column" }}>
          {/* Backdrop */}
          <div onClick={() => setShowModal(false)}
            style={{ position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }} />

          {/* Modal */}
          <div style={{ position: "relative", marginTop: "auto",
            background: "#F4F4F4", borderRadius: "20px 20px 0 0",
            maxHeight: "85vh", overflowY: "auto",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.3)",
            animation: "slideUp 0.25s ease" }}>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

            {/* Handle bar */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#CCC" }} />
            </div>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", padding: "12px 20px 0" }}>
              <div style={{ fontWeight: 800, fontSize: 20, color: "#111" }}>
                ⚡ Win The Day
              </div>
              <button onClick={() => { setShowModal(false); fetchCount(); }}
                style={{ background: "none", border: "none", fontSize: 24,
                  cursor: "pointer", color: "#555", padding: "0 4px" }}>
                ✕
              </button>
            </div>

            {/* Dashboard content */}
            <DailyDashboard
              token={token}
              user={null}
              onViewTransactions={() => setShowModal(false)}
              onOpenTransactionMilestones={(txId) => { setShowModal(false); }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ASSIGN VENDOR PANEL
// ═══════════════════════════════════════════════════════════════
function AssignVendorPanel({ tx, token, onClose, onAssigned }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const API = "https://liz-team-server-api-production.up.railway.app";

  const CATEGORY_ICONS = {
    "Inspector": "🔍", "Lender": "🏦", "Title Company": "📋",
    "Insurance": "🛡️", "Attorney": "⚖️", "Pest Control": "🐛",
    "Survey": "📐", "Contractor": "🔧", "Moving Company": "🚚",
    "Locksmith": "🔑", "Other": "👤",
  };

  useEffect(() => {
    const fetchVendors = async () => {
      setLoading(true);
      try {
        const res = await fetch(API + "/vendors", {
          headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        if (data.success) {
          // Filter out vendors already on this transaction
          const existingEmails = tx.parties.map(p => (p.email || "").toLowerCase());
          setVendors((data.vendors || []).filter(v =>
            !existingEmails.includes((v.email || "").toLowerCase())
          ));
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchVendors();
  }, []);

  const handleAssign = async (vendor) => {
    setAssigning(vendor.id);
    try {
      const res = await fetch(API + "/vendors/assign/" + tx.id, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: vendor.id })
      });
      const data = await res.json();
      if (data.success) {
        onAssigned(data.party);
      } else {
        alert(data.error || "Error assigning vendor");
      }
    } catch (e) { alert("Error assigning vendor"); }
    setAssigning(null);
  };

  const categories = ["All", ...new Set(vendors.map(v => v.category))];
  const filtered = selectedCategory === "All" ? vendors : vendors.filter(v => v.category === selectedCategory);

  return (
    <div style={{ background: "#F4F4F4", borderRadius: 14, padding: 16, marginBottom: 16,
      border: "2px solid #C0392B" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>🏆 Assign Preferred Vendor</div>
        <button onClick={onClose} style={{ background: "none", border: "none",
          fontSize: 20, cursor: "pointer", color: "#555" }}>✕</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 20, color: "#555" }}>Loading vendors...</div>
      ) : vendors.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: "#555" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No vendors available</div>
          <div style={{ fontSize: 13 }}>All your vendors are already on this transaction, or your library is empty.</div>
        </div>
      ) : (
        <>
          {/* Category filter */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12,
            paddingBottom: 4, scrollbarWidth: "none" }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                style={{ padding: "5px 12px", borderRadius: 20, border: "none",
                  whiteSpace: "nowrap", fontSize: 12, cursor: "pointer",
                  background: selectedCategory === cat ? "#C0392B" : "#fff",
                  color: selectedCategory === cat ? "#fff" : "#555",
                  fontWeight: selectedCategory === cat ? 700 : 500 }}>
                {cat === "All" ? "All" : (CATEGORY_ICONS[cat] || "") + " " + cat}
              </button>
            ))}
          </div>

          {/* Vendor list */}
          {filtered.map(v => (
            <div key={v.id} style={{ background: "#fff", borderRadius: 10, padding: 12,
              marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{CATEGORY_ICONS[v.category] || "👤"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{v.name}</div>
                {v.company && <div style={{ fontSize: 12, color: "#C0392B", fontWeight: 600 }}>{v.company}</div>}
                {v.description && <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{v.description}</div>}
              </div>
              <button onClick={() => handleAssign(v)} disabled={assigning === v.id}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none",
                  background: "#C0392B", color: "#fff", fontWeight: 700,
                  fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
                {assigning === v.id ? "..." : "Assign"}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MILESTONES TAB
// ═══════════════════════════════════════════════════════════════
function MilestonesTab({ tx, token }) {
  const [milestones, setMilestones] = useState([]);
  const [compliance, setCompliance] = useState({});
  const [uploadingFor, setUploadingFor] = useState(null);
  const fileInputRef = useRef(null);
  const pendingMilestoneRef = useRef(null);

  const fetchCompliance = async () => {
    try {
      const res = await fetch(API + "/documents/compliance/" + tx.id, {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.success) {
        const map = {};
        data.compliance.forEach(c => { map[c.milestoneId] = c; });
        setCompliance(map);
      }
    } catch (e) {}
  };

  useEffect(() => { fetchCompliance(); }, []);

  const handleUploadClick = (milestoneId) => {
    pendingMilestoneRef.current = milestoneId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    const milestoneId = pendingMilestoneRef.current;
    if (!file || !milestoneId) return;
    e.target.value = "";

    if (file.size > 50 * 1024 * 1024) { alert("File too large (50MB max)"); return; }

    setUploadingFor(milestoneId);
    // If milestone is already completed, retroactive upload — don't try to re-complete
    const currentMilestone = milestones.find(m => m.id === milestoneId);
    const isRetroactive = currentMilestone?.status === "Completed";
    try {
      const urlRes = await fetch(API + "/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          transactionId: tx.id,
          milestoneId,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          markComplete: !isRetroactive
        })
      });
      const urlData = await urlRes.json();
      if (!urlData.success) throw new Error(urlData.error || "Could not get upload URL");

      const putRes = await fetch(urlData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      alert(isRetroactive ? "✅ Document uploaded to existing milestone." : "✅ Document uploaded and milestone marked complete!");
      if (!isRetroactive) {
        setMilestones(prev => prev.map(m =>
          m.id === milestoneId ? { ...m, status: "Completed", completed_at: new Date().toISOString() } : m
        ));
      }
      fetchCompliance();
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    setUploadingFor(null);
    pendingMilestoneRef.current = null;
  };
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(null);

  const API = "https://liz-team-server-api-production.up.railway.app";

  useEffect(() => { fetchMilestones(); }, [tx.id]);

  const fetchMilestones = async () => {
    setLoading(true);
    try {
      const res = await fetch(API + "/milestones/" + tx.id, {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.success) setMilestones(data.milestones || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!tx.openDate && !tx.executedDate) {
      alert("Please add a contract date to this transaction first.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(API + "/milestones/generate/" + tx.id, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) { await fetchMilestones(); }
    } catch (e) { alert("Error generating milestones"); }
    setGenerating(false);
  };

  const handleComplete = async (milestoneId) => {
    setCompleting(milestoneId);
    try {
      await fetch(API + "/milestones/" + milestoneId + "/complete", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token }
      });
      setMilestones(prev => prev.map(m =>
        m.id === milestoneId ? { ...m, status: "Completed", completed_at: new Date().toISOString() } : m
      ));
    } catch (e) { alert("Error completing milestone"); }
    setCompleting(null);
  };

  const handleSnooze = async (milestoneId) => {
    try {
      await fetch(API + "/milestones/" + milestoneId + "/snooze", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ days: 1 })
      });
      setMilestones(prev => prev.map(m => {
        if (m.id !== milestoneId) return m;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { ...m, snooze_until: tomorrow.toISOString().split("T")[0] };
      }));
    } catch (e) {}
  };

  const [waiveModalFor, setWaiveModalFor] = useState(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [waiveJustification, setWaiveJustification] = useState("");
  const [waiveConfirm, setWaiveConfirm] = useState(false);
  const [waiving, setWaiving] = useState(false);

  const handleWaive = async () => {
    if (!waiveModalFor) return;
    if (!waiveReason) { alert("Select a reason for waiving."); return; }
    if (waiveJustification.trim().length < 10) { alert("Justification must be at least 10 characters."); return; }
    if (!waiveConfirm) { alert("Please confirm you take responsibility for this waiver."); return; }
    setWaiving(true);
    try {
      const r = await fetch(API + "/milestones/" + waiveModalFor.id + "/waive", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: waiveReason, justification: waiveJustification.trim() })
      });
      const d = await r.json();
      if (!r.ok) { alert("Could not waive: " + (d.error || "unknown error")); setWaiving(false); return; }
      setMilestones(prev => prev.map(m =>
        m.id === waiveModalFor.id
          ? { ...m, status: "Waived", waived_reason: waiveReason, waived_justification: waiveJustification.trim() }
          : m
      ));
      setWaiveModalFor(null);
      setWaiveReason("");
      setWaiveJustification("");
      setWaiveConfirm(false);
    } catch (e) { alert("Error waiving milestone: " + e.message); }
    setWaiving(false);
  };

  const today = new Date().toISOString().split("T")[0];
  const daysUntil = (d) => d ? Math.round((new Date(d) - new Date(today)) / 86400000) : null;

  const getMilestoneStatus = (m) => {
    if (m.status === "Completed") return "completed";
    if (!m.due_date) return "pending";
    const days = daysUntil(m.due_date);
    if (days < 0) return "overdue";
    if (days === 0) return "today";
    if (days <= 3) return "soon";
    return "upcoming";
  };

  const statusConfig = {
    completed: { color: "#1E8449", bg: "#D5F5E3", label: "Done", icon: "✅" },
    overdue:   { color: "#C0392B", bg: "#FADBD8", label: "Overdue", icon: "🔴" },
    today:     { color: "#C0392B", bg: "#FADBD8", label: "Due Today", icon: "⚡" },
    soon:      { color: "#B7770D", bg: "#FEF9E7", label: "Due Soon", icon: "🟡" },
    upcoming:  { color: "#555555", bg: "#F4F4F4", label: "Upcoming", icon: "⏳" },
    pending:   { color: "#555555", bg: "#F4F4F4", label: "Pending", icon: "○" },
  };

  const grouped = milestones.reduce((acc, m) => {
    acc[m.category] = acc[m.category] || [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const completed = milestones.filter(m => m.status === "Completed").length;
  const total = milestones.length;
  const progress = total > 0 ? Math.round(completed / total * 100) : 0;

  if (loading) return (
    <div style={{ padding: 32, textAlign: "center", color: "#555" }}>Loading milestones...</div>
  );

  if (milestones.length === 0) return (
    <div style={{ padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
        <div style={{ fontWeight: 700, fontSize: 18, color: "#111", marginBottom: 8 }}>
          Set Up Smart Tracking
        </div>
        <div style={{ color: "#555", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Generate all Florida-standard milestones automatically. Due dates are calculated from your contract date.
        </div>
        {(!tx.openDate && !tx.executedDate) && (
          <div style={{ background: "#FEF9E7", border: "1px solid #F9CA24", borderRadius: 10,
            padding: 12, marginBottom: 20, fontSize: 13, color: "#B7770D" }}>
            Add a contract date to this transaction first so deadlines can be calculated.
          </div>
        )}
        <button onClick={handleGenerate} disabled={generating}
          style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 12,
            padding: "14px 32px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
          {generating ? "Generating..." : "Generate Milestones"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 16 }}>
      {(() => {
        const complianceArr = Object.values(compliance);
        const totalRequired = complianceArr.filter(c => c.documentRequired).length;
        const uploaded = complianceArr.filter(c => c.documentRequired && c.documentUploaded).length;
        const completedWithoutDoc = complianceArr.filter(c =>
          c.documentRequired && !c.documentUploaded && c.status === "Completed"
        ).length;
        if (totalRequired === 0) return null;
        const pct = totalRequired === 0 ? 100 : Math.round((uploaded / totalRequired) * 100);
        return (
          <div style={{ background: completedWithoutDoc > 0 ? "#FEE2E2" : (pct === 100 ? "#D1FAE5" : "#FFFBEB"),
            borderRadius: 14, padding: 16, marginBottom: 12,
            border: "1px solid " + (completedWithoutDoc > 0 ? "#FCA5A5" : (pct === 100 ? "#86EFAC" : "#FCD34D")) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color:
                completedWithoutDoc > 0 ? "#991B1B" : (pct === 100 ? "#065F46" : "#92400E") }}>
                {pct === 100 ? "✅ Fully Compliant" : "📋 Compliance Status"}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color:
                completedWithoutDoc > 0 ? "#991B1B" : (pct === 100 ? "#065F46" : "#92400E") }}>
                {uploaded}/{totalRequired} documents
              </div>
            </div>
            {completedWithoutDoc > 0 && (
              <div style={{ fontSize: 12, color: "#991B1B", marginTop: 4, lineHeight: 1.5 }}>
                ⚠️ <strong>{completedWithoutDoc}</strong> milestone{completedWithoutDoc > 1 ? "s" : ""} marked complete but missing required document{completedWithoutDoc > 1 ? "s" : ""}.
                Scroll down to upload the missing files.
              </div>
            )}
            {completedWithoutDoc === 0 && pct < 100 && (
              <div style={{ fontSize: 12, color: "#78350F", marginTop: 4, lineHeight: 1.5 }}>
                Upload required documents as milestones complete to keep this transaction compliant.
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Progress</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#C0392B" }}>{completed}/{total} done</div>
        </div>
        <div style={{ background: "#F4F4F4", borderRadius: 20, height: 10, overflow: "hidden" }}>
          <div style={{ width: progress + "%", height: "100%",
            background: progress === 100 ? "#1E8449" : "#C0392B",
            borderRadius: 20, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#555", letterSpacing: 1,
            textTransform: "uppercase", marginBottom: 8 }}>{category}</div>
          {items.map(m => {
            const ms = getMilestoneStatus(m);
            const cfg = statusConfig[ms];
            const days = daysUntil(m.due_date);
            const isCompleted = ms === "completed";
            return (
              <div key={m.id} style={{ background: "#fff", borderRadius: 12, padding: 14,
                marginBottom: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                borderLeft: "4px solid " + (isCompleted ? "#1E8449" : cfg.color),
                opacity: isCompleted ? 0.75 : 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontSize: 18 }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#111",
                      textDecoration: isCompleted ? "line-through" : "none", marginBottom: 4 }}>
                      {m.name}
                      {m.is_hard_block && !isCompleted && (
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700,
                          color: "#C0392B", background: "#FADBD8",
                          padding: "2px 7px", borderRadius: 20 }}>REQUIRED</span>
                      )}
                    </div>
                    {m.due_date && (
                      <div style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>
                        {isCompleted ? "Completed" :
                         days === 0 ? "Due today" :
                         days < 0 ? Math.abs(days) + "d overdue" :
                         "Due in " + days + "d"} · {m.due_date}
                      </div>
                    )}
                    {m.requires_document && !m.document_uploaded && !isCompleted && (
                      <div style={{ fontSize: 11, color: "#B7770D", marginTop: 2 }}>📎 Document required</div>
                    )}
                    {isCompleted && m.completed_by_name && (
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>by {m.completed_by_name}</div>
                    )}
                    {isCompleted && compliance[m.id]?.documentRequired && !compliance[m.id]?.documentUploaded && (
                      <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 6, padding: 8, marginTop: 6, fontSize: 11, color: "#991B1B" }}>
                        ⚠️ Compliance gap: marked complete but missing {compliance[m.id].requiredDocType}
                      </div>
                    )}
                  </div>
                </div>
                {compliance[m.id]?.documentRequired && !isCompleted && (
                  <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 8, padding: 12, marginTop: 10, fontSize: 12, lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 4, fontSize: 13 }}>
                      📎 Required: {compliance[m.id].requiredDocType}
                    </div>
                    <div style={{ color: "#78350F", marginBottom: compliance[m.id].legalConsequence ? 8 : 0 }}>
                      {compliance[m.id].description}
                    </div>
                    {compliance[m.id].legalConsequence && (
                      <div style={{ borderTop: "1px solid #FCD34D", paddingTop: 8, marginTop: 4 }}>
                        <div style={{ fontWeight: 700, color: "#92400E", fontSize: 11, letterSpacing: 0.5, marginBottom: 2 }}>
                          ⚠️ WHY THIS MATTERS
                        </div>
                        <div style={{ color: "#78350F", fontSize: 12 }}>
                          {compliance[m.id].legalConsequence}
                        </div>
                        {compliance[m.id].statuteReference && (
                          <div style={{ color: "#92400E", fontSize: 10, fontStyle: "italic", marginTop: 3 }}>
                            Reference: {compliance[m.id].statuteReference}
                          </div>
                        )}
                      </div>
                    )}
                    {compliance[m.id].isConditional && compliance[m.id].conditionalLogic && (
                      <div style={{ borderTop: "1px solid #FCD34D", paddingTop: 8, marginTop: 8, color: "#78350F", fontSize: 11, fontStyle: "italic" }}>
                        Only applies if: {compliance[m.id].conditionalLogic}
                      </div>
                    )}
                  </div>
                )}
                {isCompleted && compliance[m.id]?.documentRequired && !compliance[m.id]?.documentUploaded && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => handleUploadClick(m.id)} disabled={uploadingFor === m.id}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1.5px solid #C0392B",
                        background: "#fff", color: "#C0392B", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      {uploadingFor === m.id ? "Uploading..." : "📎 Upload Missing Document"}
                    </button>
                  </div>
                )}
                {!isCompleted && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {compliance[m.id]?.documentRequired ? (
                      <>
                        <button onClick={() => handleUploadClick(m.id)} disabled={uploadingFor === m.id}
                          style={{ flex: "2 1 100%", padding: "10px 0", borderRadius: 8, border: "none",
                            background: "#C0392B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                          {uploadingFor === m.id ? "Uploading..." : "📎 Upload Document & Complete"}
                        </button>
                        <div style={{ flex: "1 1 100%", fontSize: 11, color: "#92400E", textAlign: "center", marginTop: 4 }}>
                          🔒 Document required — cannot mark complete without it
                        </div>
                      </>
                    ) : (
                      <button onClick={() => handleComplete(m.id)} disabled={completing === m.id}
                        style={{ flex: 2, padding: "9px 0", borderRadius: 8, border: "none",
                          background: "#C0392B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        {completing === m.id ? "Saving..." : "Mark Complete"}
                      </button>
                    )}
                    <button onClick={() => setWaiveModalFor(m)}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 8,
                        border: "1.5px solid #E5B14A", background: "#FFFBEB",
                        color: "#92400E", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                      ⚠️ Waive — N/A
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}


      {waiveModalFor && (
        <div onClick={() => !waiving && setWaiveModalFor(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, padding: 22, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#92400E", marginBottom: 6 }}>⚠️ Waive Milestone — Not Applicable</div>
            <div style={{ fontSize: 14, color: "#1a2332", fontWeight: 700, marginBottom: 10 }}>{waiveModalFor.name}</div>
            <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, lineHeight: 1.5, color: "#78350F" }}>
              <strong>What this does:</strong> Marks this milestone complete <strong>without</strong> a document. The transaction can keep moving.<br/><br/>
              <strong>Why it matters:</strong> Your broker and compliance team can see every waiver. If audited, you must be able to defend this decision. A permanent audit-log entry is created with your name, the reason, and your justification.
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#1a2332", marginBottom: 6 }}>Reason this is not applicable <span style={{ color: "#C0392B" }}>*</span></label>
              <select value={waiveReason} onChange={e => setWaiveReason(e.target.value)} disabled={waiving}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #D1D5DB", fontSize: 14, fontFamily: "inherit", background: "#fff" }}>
                <option value="">-- Select a reason --</option>
                <option value="Cash deal — no lender">Cash deal — no lender</option>
                <option value="New construction — no inspection">New construction — no inspection</option>
                <option value="Not applicable to this property type">Not applicable to this property type</option>
                <option value="Document exists outside our system">Document exists outside our system (e.g. brokerage uses different form)</option>
                <option value="Buyer/seller declined">Buyer/seller declined and signed waiver</option>
                <option value="Other">Other (explain in justification)</option>
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#1a2332", marginBottom: 6 }}>Justification <span style={{ color: "#C0392B" }}>*</span> <span style={{ fontWeight: 400, color: "#6b7280" }}>(min 10 chars — be specific)</span></label>
              <textarea value={waiveJustification} onChange={e => setWaiveJustification(e.target.value)} disabled={waiving}
                placeholder="Example: Buyer is paying all-cash via wire transfer from Chase. No financing involved. Confirmed via signed cash letter dated 5/15/26."
                rows={4}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #D1D5DB", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 18, cursor: "pointer", fontSize: 13, color: "#1a2332" }}>
              <input type="checkbox" checked={waiveConfirm} onChange={e => setWaiveConfirm(e.target.checked)} disabled={waiving} style={{ marginTop: 3, flexShrink: 0 }} />
              <span>I confirm this waiver is justified and I take responsibility for compliance on this transaction.</span>
            </label>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { if (!waiving) { setWaiveModalFor(null); setWaiveReason(""); setWaiveJustification(""); setWaiveConfirm(false); } }} disabled={waiving}
                style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1.5px solid #D1D5DB", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 14, cursor: waiving ? "not-allowed" : "pointer" }}>
                Cancel
              </button>
              <button onClick={handleWaive} disabled={waiving || !waiveReason || waiveJustification.trim().length < 10 || !waiveConfirm}
                style={{ flex: 2, padding: "11px 0", borderRadius: 8, border: "none", background: (waiving || !waiveReason || waiveJustification.trim().length < 10 || !waiveConfirm) ? "#D1A878" : "#92400E", color: "#fff", fontWeight: 700, fontSize: 14, cursor: (waiving || !waiveReason || waiveJustification.trim().length < 10 || !waiveConfirm) ? "not-allowed" : "pointer" }}>
                {waiving ? "Waiving..." : "⚠️ Waive This Milestone"}
              </button>
            </div>
          </div>
        </div>
      )}
      <button onClick={handleGenerate} disabled={generating}
        style={{ width: "100%", padding: 13, borderRadius: 10,
          border: "1.5px solid #DDD", background: "#fff",
          color: "#555", fontWeight: 600, fontSize: 14, cursor: "pointer", marginTop: 8 }}>
        {generating ? "Generating..." : "Add Missing Milestones"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={handleFileSelected}
      />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// BUYER INTAKE CHECKLIST — 5-step guided onboarding
// ═══════════════════════════════════════════════════════════════
function BuyerIntakeChecklist({ tx, token, onContactLogged }) {
  const [stepsDone, setStepsDone] = useState(tx.intakeStepsDone || []);
  const [updating, setUpdating] = useState(null);
  const API_URL = "https://liz-team-server-api-production.up.railway.app";

  const buyer = (tx.parties || []).find(p => p.role === "Buyer");
  const budget = tx.listPrice ? "$" + Number(tx.listPrice).toLocaleString() : "Not specified";

  const toggleStep = async (stepNumber) => {
    setUpdating(stepNumber);
    const newDone = stepsDone.includes(stepNumber) ? false : true;
    try {
      const r = await fetch(API_URL + "/transactions/" + tx.id + "/intake-step", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ stepNumber, done: newDone })
      });
      const d = await r.json();
      if (d.success) {
        setStepsDone(d.steps);
        if (d.allDone && onContactLogged) onContactLogged();
      }
    } catch (e) { alert("Failed: " + e.message); }
    setUpdating(null);
  };

  const allDone = [1,2,3,4,5].every(n => stepsDone.includes(n));
  if (allDone) return null;

  const steps = [
    { num: 1, icon: "📞", title: "Contact the buyer within 24 hours", why: "Florida law requires prompt response. First contact establishes your fiduciary relationship.", action: buyer?.phone ? "Call or text " + (buyer.name || "buyer") + " at " + buyer.phone : buyer?.email ? "Email " + (buyer.name || "buyer") + " at " + buyer.email : "Add buyer contact info first" },
    { num: 2, icon: "🤝", title: "Schedule a Buyer Consultation", why: "Understand their needs, timeline, and qualifications — and explain your role as their agent.", action: "Set up a 30-60 minute meeting (in person, Zoom, or phone)" },
    { num: 3, icon: "📋", title: "Send Buyer Representation Agreement", why: "Required under Florida law before showing properties. Establishes your commission.", action: "Send via DocuSign, Dotloop, or in person at consultation" },
    { num: 4, icon: "🏠", title: "Set up MLS auto-alerts", why: "Buyers expect to see new listings immediately. Same-day alerts show you are proactive.", action: "Search: " + (tx.address || "").replace("Buyer Search — ", "") + " · Budget: " + budget },
    { num: 5, icon: "💰", title: "Confirm pre-approval or proof of funds", why: "Cannot write a credible offer without financing confirmation.", action: "Ask buyer for lender pre-approval letter or bank statement" },
  ];

  const doneCount = stepsDone.length;

  return (
    <div style={{ background: "#fef2f2", border: "2px solid #fecaca", borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>🔔</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: "#991b1b", fontSize: 16 }}>New Buyer Inquiry — {doneCount}/5 Steps Complete</div>
          <div style={{ fontSize: 13, color: "#7f1d1d", marginTop: 2 }}>
            {buyer ? (buyer.name || "") + (buyer.phone ? " · " + buyer.phone : "") + (buyer.email ? " · " + buyer.email : "") : "Buyer info in parties tab"} · Budget: {budget}
          </div>
        </div>
      </div>
      <div style={{ background: "#fecaca", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ background: "#1e8449", height: "100%", width: (doneCount / 5 * 100) + "%", transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((step) => {
          const isDone = stepsDone.includes(step.num);
          const isUpdating = updating === step.num;
          return (
            <div key={step.num} style={{ background: isDone ? "#f0fdf4" : "white", borderRadius: 8, padding: 14, border: `1px solid ${isDone ? "#bbf7d0" : "#fecaca"}`, opacity: isDone ? 0.7 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>{isDone ? "✅" : step.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ background: isDone ? "#1e8449" : "#c8102e", color: "white", borderRadius: "50%", width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{step.num}</span>
                    <span style={{ fontWeight: 700, color: "#1a2332", fontSize: 14, textDecoration: isDone ? "line-through" : "none" }}>{step.title}</span>
                  </div>
                  {!isDone && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, lineHeight: 1.5 }}><strong style={{ color: "#92400e" }}>Why:</strong> {step.why}</div>}
                  {!isDone && <div style={{ fontSize: 13, color: "#1a2332", marginBottom: 10, background: "#f9fafb", padding: "6px 10px", borderRadius: 6 }}>📌 {step.action}</div>}
                  <button onClick={() => toggleStep(step.num)} disabled={isUpdating} style={{ background: isDone ? "white" : "#1e8449", color: isDone ? "#6b7280" : "white", border: isDone ? "1px solid #d1d5db" : "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: isUpdating ? "wait" : "pointer", fontFamily: "inherit", opacity: isUpdating ? 0.7 : 1 }}>
                    {isUpdating ? "..." : (isDone ? "↺ Undo" : "✓ Mark Done")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// ASSIGN AGENT MODAL — guided assignment for unassigned leads
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// CONTRACT REVIEW CHECKLIST — 5-step guided verification after auto-intake
// ═══════════════════════════════════════════════════════════════
function ContractReviewChecklist({ tx, token, onCleared, setActiveTab, openEditTx }) {
  const [stepsDone, setStepsDone] = useState(tx.reviewStepsDone || []);
  const [updating, setUpdating] = useState(null);
  const [partiesOpened, setPartiesOpened] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);

  const partiesValid = (tx.parties || []).length > 0 && (tx.parties || []).every(p => p.email || p.phone);
  const partiesWithEmail = (tx.parties || []).filter(p => p.email && p.email.includes("@"));

  const sendWelcomeEmails = async () => {
    // Build a comprehensive review warning
    const allParties = tx.parties || [];
    const partiesNoEmail = allParties.filter(p => !p.email || !p.email.includes("@"));
    const recipientList = partiesWithEmail.map(p => `  • ${p.name} (${p.role}) → ${p.email}`).join("\n");

    const missing = [];
    if (!tx.contractPrice) missing.push("Contract Price");
    if (!tx.executedDate) missing.push("Executed Date");
    if (!tx.closingDate) missing.push("Closing Date");
    if (!tx.earnestMoneyAmount) missing.push("Earnest Money Amount");
    if (!tx.address || tx.address.includes("pending")) missing.push("Property Address");

    let warning = "⚠️  BEFORE SENDING — REVIEW EVERYTHING\n\n";
    warning += "The welcome email will include the transaction details below. If any are wrong or missing, FIX THEM FIRST — recipients will see exactly what is in the transaction right now.\n\n";
    warning += "─── EMAILS WILL BE SENT TO ───\n" + recipientList + "\n";
    if (partiesNoEmail.length > 0) {
      warning += "\n⚠️  These parties have NO email and will NOT receive the welcome:\n";
      warning += partiesNoEmail.map(p => `  • ${p.name} (${p.role})`).join("\n");
      warning += "\n   (Add their email in the Parties tab if they should receive it.)\n";
    }
    if (missing.length > 0) {
      warning += "\n⚠️  MISSING TRANSACTION FIELDS that the email needs:\n";
      warning += missing.map(m => `  • ${m}`).join("\n");
      warning += "\n   Cancel now, fix these in Edit Transaction, then come back.\n";
    }
    warning += "\n─── CONFIRM ───\nClick OK only if every party email is correct AND every transaction field is filled in. This action cannot be undone — once sent, recipients have the email.";

    if (!window.confirm(warning)) return;
    setSendingEmails(true);
    try {
      const r = await fetch("https://liz-team-server-api-production.up.railway.app/transactions/" + tx.id + "/send-welcome-emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + token }
      });
      const d = await r.json();
      if (d.success) {
        alert(`✅ Welcome emails sent to ${d.emailsSent} parties.`);
        toggleStep(2);
      } else {
        alert("Could not send: " + (d.error || "Unknown error"));
      }
    } catch (e) { alert("Error: " + e.message); }
    setSendingEmails(false);
  };
  const API_URL = "https://liz-team-server-api-production.up.railway.app";

  const toggleStep = async (stepNumber) => {
    setUpdating(stepNumber);
    const newDone = !stepsDone.includes(stepNumber);
    try {
      const r = await fetch(API_URL + "/transactions/" + tx.id + "/review-step", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ stepNumber, done: newDone })
      });
      const d = await r.json();
      if (d.success) {
        setStepsDone(d.steps);
        if (d.allDone && onCleared) onCleared();
      }
    } catch (e) { alert("Failed: " + e.message); }
    setUpdating(null);
  };

  const openEditModal = () => { openEditTx(); };

  const baseSteps = [
    { num: 1, icon: "🏠", title: "Verify Property, Dates & Contingencies", why: "Address, dates (executed/closing/EMD), price, and contingency days (inspection, financing, appraisal) ALL come from the contract and ALL drive milestones, tasks, and legal deadlines. A wrong county breaks MLS compliance. A wrong closing date voids the contract. A wrong inspection day forfeits buyer rights. Handwritten changes are commonly misread by AI.", action: "Click below to open the Edit Transaction form. Compare every field side-by-side against the executed contract. Pay close attention to anything that was crossed out or written by hand.", cta: "Open Edit Form", onCta: openEditModal },
    { num: 2, icon: "👥", title: "Verify All Parties & Contact Info", why: "Title, lender, inspector, co-op agent must be reachable. Missing email or phone breaks the welcome email and the entire group communication chain. The wrong title company at closing causes wire fraud risk.", action: "Open the Key Parties tab. Confirm every party has a name, working phone, and email. Add any missing parties (e.g. title company, lender) that the contract names but were not extracted.", cta: "Open Parties Tab", onCta: () => { setPartiesOpened(true); setActiveTab("parties"); }, isPartiesStep: true },
  ];
  const termsStep = tx.additionalTerms
    ? { num: 3, icon: "📝", title: "Read & Confirm Additional Terms", why: "Custom clauses override the standard form. These can be repair credits, occupancy provisions, contingent-on-sale clauses, escalation clauses, or seller concessions. Each is binding and missing one can cost thousands or break the deal.", action: "Read every line of the Additional Terms box shown above. The same text is also saved in the transaction Notes for easy lookup later. If anything looks wrong or was cut off, edit the Notes directly.", cta: "Show Notes", onCta: () => setActiveTab("overview") }
    : { num: 3, icon: "📝", title: "Confirm No Custom Clauses Were Missed", why: "The AI did not detect any custom clauses. But Florida contracts sometimes include handwritten or typed terms beyond the standard form — repair credits, contingent-on-sale clauses, refrigerator-stays, occupancy provisions, etc. These are binding even if missed by AI.", action: "Quickly re-scan the executed contract for any 'Additional Terms', 'Special Clauses', 'Other Provisions', or 'Riders' section. If you find any, click below and paste them into the Notes field.", cta: "Open Edit Form", onCta: openEditModal };
  const steps = [...baseSteps, termsStep];
  const doneCount = stepsDone.length;

  return (
    <div style={{ background: "#eff6ff", border: "2px solid #2563eb", borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 26 }}>📋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: "#1e3a8a", fontSize: 16 }}>NEW FROM CONTRACT — {doneCount}/3 Verified</div>
          <div style={{ fontSize: 12, color: "#1e40af", marginTop: 2 }}>
            The AI extracted this data from the contract. As the agent of record, you must verify each section below. The banner clears when all 5 are done.
          </div>
        </div>
      </div>
      <div style={{ background: "#bfdbfe", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ background: "#1e8449", height: "100%", width: (doneCount / 5 * 100) + "%", transition: "width 0.3s" }} />
      </div>

      {tx.additionalTerms && (
        <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#854d0e", marginBottom: 6 }}>📝 Additional Terms / Special Clauses extracted from contract (also saved in Notes):</div>
          <div style={{ fontSize: 12, color: "#713f12", whiteSpace: "pre-wrap", lineHeight: 1.5, fontFamily: "monospace", background: "white", padding: 10, borderRadius: 6 }}>{tx.additionalTerms}</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map(step => {
          const isDone = stepsDone.includes(step.num);
          const isUpdating = updating === step.num;
          return (
            <div key={step.num} style={{ background: isDone ? "#f0fdf4" : "white", borderRadius: 8, padding: 14, border: `1px solid ${isDone ? "#bbf7d0" : "#bfdbfe"}`, opacity: isDone ? 0.7 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>{isDone ? "✅" : step.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ background: isDone ? "#1e8449" : "#2563eb", color: "white", borderRadius: "50%", width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{step.num}</span>
                    <span style={{ fontWeight: 700, color: "#1a2332", fontSize: 14, textDecoration: isDone ? "line-through" : "none" }}>{step.title}</span>
                  </div>
                  {!isDone && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, lineHeight: 1.5 }}><strong style={{ color: "#1e40af" }}>Why:</strong> {step.why}</div>}
                  {!isDone && <div style={{ fontSize: 13, color: "#1a2332", marginBottom: 10, background: "#f9fafb", padding: "6px 10px", borderRadius: 6 }}>📌 {step.action}</div>}
                  {!isDone && step.isPartiesStep && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <button onClick={(e) => { e.stopPropagation(); step.onCta(); }}
                        style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>
                        {step.cta} →
                      </button>

                      <div style={{ borderTop: "1px solid #bfdbfe", paddingTop: 10, marginTop: 4 }}>
                        <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 8 }}>
                          After verifying/adding/fixing parties, pick one:
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); sendWelcomeEmails(); }}
                          disabled={sendingEmails || partiesWithEmail.length === 0}
                          title={partiesWithEmail.length === 0 ? "At least one party needs a valid email address" : ""}
                          style={{ background: partiesWithEmail.length === 0 ? "#9ca3af" : "#1e8449", color: "white", border: "none", borderRadius: 6, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: partiesWithEmail.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", display: "block", marginBottom: 8, width: "100%", textAlign: "left" }}>
                          {sendingEmails ? "Sending..." : `✉️ Send welcome emails to ${partiesWithEmail.length} parties — Recommended`}
                        </button>
                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, paddingLeft: 4 }}>
                          Sends a professional intro to every party with their role, key dates, and party roster. Marks this step verified.
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); toggleStep(step.num); }}
                          disabled={isUpdating}
                          style={{ background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: isUpdating ? "wait" : "pointer", fontFamily: "inherit", display: "block", width: "100%", textAlign: "left" }}>
                          {isUpdating ? "..." : "✓ Mark Verified without sending emails"}
                        </button>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, paddingLeft: 4 }}>
                          Use this if you want to call parties first or send emails manually later.
                        </div>
                      </div>
                    </div>
                  )}
                  {!isDone && !step.isPartiesStep && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={(e) => { e.stopPropagation(); step.onCta(); }}
                        style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {step.cta} →
                      </button>
                      <button onClick={() => toggleStep(step.num)} disabled={isUpdating}
                        style={{ background: "#1e8449", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: isUpdating ? "wait" : "pointer", fontFamily: "inherit", opacity: isUpdating ? 0.7 : 1 }}>
                        {isUpdating ? "..." : "✓ Mark Verified"}
                      </button>
                    </div>
                  )}
                  {isDone && (
                    <button onClick={() => toggleStep(step.num)} disabled={isUpdating}
                      style={{ background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: isUpdating ? "wait" : "pointer", fontFamily: "inherit" }}>
                      {isUpdating ? "..." : "↺ Undo"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssignAgentModal({ tx, token, onClose, onAssigned, currentUser }) {
  const [users, setUsers] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(currentUser?.id || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const API_URL = "https://liz-team-server-api-production.up.railway.app";

  useEffect(() => {
    fetch(API_URL + "/users/brokerage", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.users); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const isBuyer = tx.type === "Buyer Representation";
  const leadType = isBuyer ? "buyer" : "seller";

  const handleAssign = async () => {
    if (!selectedAgentId) { alert("Please select an agent first."); return; }
    setSaving(true);
    try {
      const r = await fetch(API_URL + "/transactions/" + tx.id + "/assign-agent", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgentId })
      });
      const d = await r.json();
      if (d.success) {
        alert("✅ Lead assigned to " + d.assignedTo + ".\n\nThey have been notified by email and SMS to contact this " + leadType + " within 24 hours.");
        if (onAssigned) onAssigned(selectedAgentId);
        onClose();
      } else {
        alert("Error: " + (d.error || "Could not assign"));
      }
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 540, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ background: "#f59e0b", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>⚠️ Assign This Lead to an Agent</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          {/* Lead summary */}
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: "#78350f", fontWeight: 700, marginBottom: 4 }}>Lead Details</div>
            <div style={{ fontSize: 14, color: "#1a2332" }}>{tx.address}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{isBuyer ? "Buyer Representation" : "Listing (Seller)"} · {tx.parties && tx.parties[0] ? tx.parties[0].name : "Party info in transaction"}</div>
          </div>

          {/* What / Why / What proves */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2332", marginBottom: 6 }}>📋 What you are about to do</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
              Pick an agent who will take ownership of this {leadType} lead. They become responsible for first contact, the buyer/seller representation agreement, and all follow-up.
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>⚠️ Why this matters</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
              Florida law and brokerage policy require prompt first contact (within 24 hours). Until assigned, no one is responsible for this lead and it can go cold fast. You can assign it to yourself if you are taking it, or to another agent at your brokerage.
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46", marginBottom: 6 }}>✅ What happens next</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
              The agent you pick will receive an email and SMS with the lead details. The transaction card will turn red with the "Contact Within 24hrs" banner. The 5-step intake checklist will activate inside the transaction.
            </div>
          </div>

          {/* Agent picker */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>SELECT AGENT</div>
            {loading ? (
              <div style={{ fontSize: 13, color: "#9ca3af", padding: 12 }}>Loading agents at your brokerage…</div>
            ) : (
              <select value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 14, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }}>
                <option value="">— Pick an agent —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}{u.id === currentUser?.id ? " (me)" : ""} · {u.role === "admin" || u.role === "superadmin" ? "Admin" : "Agent"}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} disabled={saving}
              style={{ flex: 1, padding: 13, borderRadius: 10, border: "1.5px solid #d1d5db", background: "#fff", color: "#6b7280", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button onClick={handleAssign} disabled={saving || !selectedAgentId}
              style={{ flex: 2, padding: 13, borderRadius: 10, border: "none", background: selectedAgentId ? "#f59e0b" : "#d1d5db", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving || !selectedAgentId ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {saving ? "Assigning…" : "👤 Assign Agent & Notify"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DueDatePresetPicker({ label, value, onChange }) {
  const PRESETS = [
    { label: "Today", days: 0 },
    { label: "Tomorrow", days: 1 },
    { label: "2 days", days: 2 },
    { label: "3 days", days: 3 },
    { label: "1 week", days: 7 },
    { label: "2 weeks", days: 14 },
    { label: "1 month", days: 30 },
    { label: "3 months", days: 90 },
    { label: "6 months", days: 180 },
    { label: "1 year", days: 365 },
  ];

  const setPreset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    onChange(d.toISOString().slice(0, 10));
  };

  const today = new Date().toISOString().slice(0, 10);
  const selectedDays = value ? Math.round((new Date(value + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000) : null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>{label || "Due Date"}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {PRESETS.map(p => {
          const active = selectedDays === p.days;
          return (
            <button key={p.label} type="button" onClick={() => setPreset(p.days)}
              style={{
                padding: "6px 10px", borderRadius: 16, border: active ? "1.5px solid #0c4a6e" : "1px solid #d1d5db",
                background: active ? "#0c4a6e" : "#fff", color: active ? "#fff" : "#374151",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit"
              }}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>Or custom date:</span>
        <input type="date" value={value || ""} onChange={e => onChange(e.target.value)}
          style={{ padding: 6, borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, fontFamily: "inherit" }} />
        {value && (
          <button type="button" onClick={() => onChange("")}
            style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function TransactionDetail({ tx, onUpdate, onBack, contacts, onInviteParty = [], onSaveContact, onOpenContactBook, onDuplicate, currentUser, initialTab = "overview", dashboardUnread = 0 }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showAssignAgent, setShowAssignAgent] = useState(false);
  const [showAddParty, setShowAddParty] = useState(false);
  const [showAssignVendor, setShowAssignVendor] = useState(false);
  const [pendingInviteParty, setPendingInviteParty] = useState(null);
  const [partyFromContactBook, setPartyFromContactBook] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [followupParty, setFollowupParty] = useState(null);
  const [followupForm, setFollowupForm] = useState({ subject: "", message: "" });
  const [followupSubmitting, setFollowupSubmitting] = useState(false);
  const [sendingWelcomeFor, setSendingWelcomeFor] = useState(null);
  const onSendWelcome = async (party) => {
    if (!party || !party.id) return;
    if (!party.email) { alert(`${party.name || "This party"} has no email address. Add one in Edit, then try again.`); return; }
    const isResend = (party.welcome_email_sent_at || party.welcomeEmailSentAt) ? true : false;
    const verb = isResend ? "RE-SEND" : "SEND";
    const confirmMsg = `${verb} the role-specific welcome email to ${party.name} (${party.role}) at ${party.email}?\n\nThis email includes:\n• Key dates (loan, appraisal, inspection, HOA, closing)\n• Financial summary (price, EMD, loan type)\n• Parties roster (filtered for their role)\n• Contract document package (if applicable to their role)\n\nWhy this matters: the welcome email is the agent's formal handoff. It tells this party what they need to do, when, and gives them the documents proving the deal is real.`;
    if (!window.confirm(confirmMsg)) return;
    setSendingWelcomeFor(party.id);
    try {
      const tok = localStorage.getItem("tp_token") || "";
      const res = await fetch(`https://liz-team-server-api-production.up.railway.app/transactions/${tx.id}/parties/${party.id}/send-welcome`, {
        method: "POST",
        headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      alert(`✅ Welcome email sent to ${party.name} at ${party.email}.\n\nIf they don't see it in 1–2 minutes, ask them to check spam.`);
    } catch (e) {
      alert(`❌ Could not send welcome email: ${e.message}`);
    } finally {
      setSendingWelcomeFor(null);
    }
  };
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

  // Pre-fill helper — used everywhere the Edit modal opens.
  // CRITICAL RULE: Edit modal must NEVER open blank. Every field comes from current tx.
  // Reusable welcome-email sender — used by checklist + Parties tab + post-edit prompt
  const sendWelcomeEmailsFromTx = async (targetParties = null) => {
    const partiesWithEmail = (targetParties || tx.parties || []).filter(p => p.email && p.email.includes("@"));
    if (partiesWithEmail.length === 0) {
      alert("No party has a valid email address yet. Add emails first, then try again.");
      return false;
    }
    const allParties = tx.parties || [];
    const partiesNoEmail = allParties.filter(p => !p.email || !p.email.includes("@"));
    const recipientList = partiesWithEmail.map(p => `  • ${p.name} (${p.role}) → ${p.email}`).join("\n");
    const missing = [];
    if (!tx.contractPrice) missing.push("Contract Price");
    if (!tx.executedDate) missing.push("Executed Date");
    if (!tx.closingDate) missing.push("Closing Date");
    if (!tx.earnestMoneyAmount) missing.push("Earnest Money Amount");
    if (!tx.address || tx.address.includes("pending")) missing.push("Property Address");
    let warning = "\u26a0\ufe0f  BEFORE SENDING \u2014 REVIEW EVERYTHING\n\n";
    warning += "The welcome email will include the transaction details below. If any are wrong or missing, FIX THEM FIRST \u2014 recipients will see exactly what is in the transaction right now.\n\n";
    warning += "\u2500\u2500\u2500 EMAILS WILL BE SENT TO \u2500\u2500\u2500\n" + recipientList + "\n";
    if (partiesNoEmail.length > 0) {
      warning += "\n\u26a0\ufe0f  These parties have NO email and will NOT receive the welcome:\n";
      warning += partiesNoEmail.map(p => `  \u2022 ${p.name} (${p.role})`).join("\n");
      warning += "\n   (Add their email if they should receive it.)\n";
    }
    if (missing.length > 0) {
      warning += "\n\u26a0\ufe0f  MISSING TRANSACTION FIELDS that the email needs:\n";
      warning += missing.map(m => `  \u2022 ${m}`).join("\n");
      warning += "\n   Cancel now, fix these in Edit Transaction, then come back.\n";
    }
    warning += "\n\u2500\u2500\u2500 CONFIRM \u2500\u2500\u2500\nClick OK only if every party email is correct AND every transaction field is filled in. This action cannot be undone \u2014 once sent, recipients have the email.";
    if (!window.confirm(warning)) return false;
    try {
      const r = await fetch("https://liz-team-server-api-production.up.railway.app/transactions/" + tx.id + "/send-welcome-emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") }
      });
      const d = await r.json();
      if (d.success) {
        alert(`\u2705 Welcome emails sent to ${d.emailsSent} parties.`);
        return true;
      } else {
        alert("Could not send: " + (d.error || "Unknown error"));
        return false;
      }
    } catch (e) { alert("Error: " + e.message); return false; }
  };

  const buildEditTxForm = (tt = tx) => ({
    assignedAgent: tt.assignedAgentId || "",
    referralSource: tt.referralSource || "",
    address: tt.address || "",
    city: tt.city || "",
    state: tt.state || "FL",
    zipCode: tt.zipCode || "",
    county: tt.county || "",
    propertyType: tt.propertyType || "Single Family",
    type: tt.type || "",
    mlsNumber: tt.mlsNumber || "",
    listPrice: tt.listPrice || "",
    contractPrice: tt.contractPrice || "",
    openDate: tt.openDate ? String(tt.openDate).slice(0, 10) : "",
    executedDate: tt.executedDate ? String(tt.executedDate).slice(0, 10) : "",
    closingDate: tt.closingDate ? String(tt.closingDate).slice(0, 10) : "",
    status: tt.status || "Active",
    notes: tt.notes || "",
    propertyAccess: tt.propertyAccess || "",
    occupancyStatus: tt.occupancyStatus || "",
    earnestMoneyAmount: tt.earnestMoneyAmount || "",
    emdDeadline: tt.emdDeadline ? String(tt.emdDeadline).slice(0, 10) : "",
    inspectionPeriodDays: tt.inspectionPeriodDays || "",
    inspectionPeriodEnd: tt.inspectionPeriodEnd ? String(tt.inspectionPeriodEnd).slice(0, 10) : "",
    financingContingency: tt.financingContingency || false,
    financingContingencyDays: tt.financingContingencyDays || "",
    appraisalContingency: tt.appraisalContingency || false,
    appraisalContingencyDays: tt.appraisalContingencyDays || "",
    hoaApprovalRequired: tt.hoaApprovalRequired || false,
    hoaApprovalDays: tt.hoaApprovalDays || "",
    surveyRequired: tt.surveyRequired || false,
    isCash: tt.isCash || false,
    contractFormType: tt.contractFormType || "",
    commissionListing: tt.commissionListing || "",
    commissionBuyer: tt.commissionBuyer || "",
    transactionFee: tt.transactionFee || "",
    brokerageSplit: tt.brokerageSplit || "",
    officeFlatFee: tt.officeFlatFee || "",
    mailAway: tt.mailAway || "No",
    commissionNotes: tt.commissionNotes || "",
    additionalTerms: tt.additionalTerms || "",
  });
  const openEditTx = () => { setEditTxForm(buildEditTxForm(tx)); setShowEditTx(true); };
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

  const isBuyerSideTx = tx.type === "Buyer Representation" || tx.type === "Dual Agency";
  const isListingSideTx = tx.type === "Listing (Seller)" || tx.type === "Dual Agency";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "milestones", label: "🎯 Milestones" },
    { id: "tasks", label: `Tasks${overdueTasks > 0 ? ` ⚠${overdueTasks}` : ""}` },
    { id: "parties", label: `Parties (${tx.parties.length})` },
    { id: "sms", label: `Messages${smsMsgCount > 0 ? ` (${smsMsgCount})` : ""}` },
    { id: "notes", label: "Internal Notes" },
    { id: "documents", label: "📎 Documents" },
    { id: "chat", label: (chatUnread > 0 || dashboardUnread > 0) ? `💬 Group Chat (${Math.max(chatUnread, dashboardUnread)})` : "💬 Group Chat" },
    ...(isBuyerSideTx ? [{ id: "calculator", label: "🧮 Buyer Calc" }] : []),
    ...(isListingSideTx ? [{ id: "cma", label: "📊 CMA" }, { id: "seller-calc", label: "💰 Seller Net" }] : []),
    { id: "tx-forms", label: "📋 Forms" },
    { id: "activity", label: "📋 Activity Log" },
    { id: "reminders", label: "Reminders" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh" }}>
      <div data-tx-detail-header="" style={{ background: COLORS.navy, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap" }}>
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
        <button onClick={openEditTx} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
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
            {(tx.transaction_type || tx.type) && /buyer|dual/i.test(tx.transaction_type || tx.type) && (
              <PreApprovalCard transactionId={tx.id} isAgent={true} />
            )}
            {tx.assignedAgentId && tx.needsReview && (
              <ContractReviewChecklist tx={tx} token={localStorage.getItem("tp_token") || ""} onCleared={() => onUpdate({ ...tx, needsReview: false })} setActiveTab={setActiveTab} openEditTx={openEditTx} />
            )}
            {!tx.assignedAgentId && (
              <div style={{ background: "#fef3c7", border: "2px solid #f59e0b", borderRadius: 12, padding: 18, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 26 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: "#78350f", fontSize: 16, marginBottom: 6 }}>UNASSIGNED LEAD — Action Required</div>
                    <div style={{ fontSize: 13, color: "#92400e", marginBottom: 8, lineHeight: 1.5 }}>
                      <strong>What to do:</strong> Click the button below to assign this lead to an agent at your brokerage. You can pick yourself if you are taking it.
                    </div>
                    <div style={{ fontSize: 13, color: "#92400e", marginBottom: 8, lineHeight: 1.5 }}>
                      <strong>Why it matters:</strong> Florida law requires prompt first contact (within 24 hours). Until assigned, no one is responsible for this lead and it can go cold quickly. Brokerage admins are notified by email and SMS that this lead is waiting.
                    </div>
                    <div style={{ fontSize: 13, color: "#92400e", marginBottom: 12, lineHeight: 1.5 }}>
                      <strong>What happens after assigning:</strong> The assigned agent gets an email + SMS. The card turns red with the "Contact Within 24hrs" banner. The 5-step onboarding checklist activates.
                    </div>
                    <button onClick={() => setShowAssignAgent(true)}
                      style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      👤 Assign Agent & Notify
                    </button>
                  </div>
                </div>
              </div>
            )}
            {tx.assignedAgentId && tx.needsFirstContact && (
              <BuyerIntakeChecklist tx={tx} token={localStorage.getItem("tp_token") || ""} onContactLogged={() => onUpdate({ ...tx, needsFirstContact: false })} />
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {[
                { title: "Property", rows: [["Assigned Agent", tx.assignedAgentName || "—"], ["Referral Source", tx.referralSource || "—"], ["Address", tx.address], ["City/County", `${tx.city}, ${tx.county} County`], ["Zip", tx.zipCode], ["Type", tx.propertyType], ["Transaction", tx.type], ["MLS #", tx.mlsNumber], ["Lockbox Access", tx.propertyAccess || "—"], ["Mail-Away", tx.mailAway || "No"]] },
                { title: "Financials", rows: (() => {
                    const price = Number(tx.contractPrice || tx.listPrice || 0);
                    const listComm = tx.commissionListing ? (price * Number(tx.commissionListing) / 100) : 0;
                    const buyerComm = tx.commissionBuyer ? (price * Number(tx.commissionBuyer) / 100) : 0;
                    // Determine which side is OURS based on transaction type
                    const isListing = tx.type === "Listing (Seller)";
                    const isBuyer = tx.type === "Buyer Representation";
                    const isDual = tx.type === "Dual Agency";
                    const ourComm = isListing ? listComm : isBuyer ? buyerComm : isDual ? (listComm + buyerComm) : 0;
                    const txFee = Number(tx.transactionFee || 0);
                    const split = tx.brokerageSplit ? ourComm * Number(tx.brokerageSplit) / 100 : 0;
                    const flatFee = Number(tx.officeFlatFee || 0);
                    const netComm = ourComm + txFee - split - flatFee;
                    return [
                      ["List Price", tx.listPrice ? `$${Number(tx.listPrice).toLocaleString()}` : "—"],
                      ["Contract Price", tx.contractPrice ? `$${Number(tx.contractPrice).toLocaleString()}` : "—"],
                      ["Open Date", formatDate(tx.openDate)],
                      ["Executed Date", formatDate(tx.executedDate)],
                      ["Closing Date", formatDate(tx.closingDate)],
                      ["Days to Close", daysToClose !== null ? `${daysToClose}d` : "—"],
                      ["Mail-Away", tx.mailAway || "No"],
                      [isBuyer ? "Listing Commission (other side — not ours)" : "Listing Commission", tx.commissionListing ? `${tx.commissionListing}% ($${listComm.toLocaleString(undefined,{maximumFractionDigits:0})})` : "—"],
                      [isListing ? "Buyer Commission (other side — not ours)" : "Buyer Commission", tx.commissionBuyer ? `${tx.commissionBuyer}% ($${buyerComm.toLocaleString(undefined,{maximumFractionDigits:0})})` : "—"],
                      ["Transaction Fee", tx.transactionFee ? `$${Number(tx.transactionFee).toLocaleString()}` : "—"],
                      ["Brokerage Split", tx.brokerageSplit ? `${tx.brokerageSplit}% (-$${split.toLocaleString(undefined,{maximumFractionDigits:0})})` : "—"],
                      ["Office Flat Fee", tx.officeFlatFee ? `-$${Number(tx.officeFlatFee).toLocaleString()}` : "—"],
                      ["Our Gross Commission", ourComm > 0 ? `$${ourComm.toLocaleString(undefined,{maximumFractionDigits:0})}` : "—"],
                      ["Our Estimated Net", netComm > 0 ? `$${netComm.toLocaleString(undefined,{maximumFractionDigits:0})}` : "—"],
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

        {activeTab === "milestones" && (
            <MilestonesTab tx={tx} token={localStorage.getItem("tp_token") || ""} />
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
            {/* Welcome-email reminder banner — shows when transaction is Under Contract or needs review and at least one party has an email */}
            {(tx.needsReview || tx.status === "Under Contract") && (tx.parties || []).some(p => p.email && p.email.includes("@")) && (
              <div style={{ background: "#eff6ff", border: "2px solid #2563eb", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>✉️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: "#1e3a8a", fontSize: 14, marginBottom: 4 }}>Ready to send welcome emails?</div>
                    <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.5, marginBottom: 10 }}>
                      <strong>What this does:</strong> Sends a professional intro to every party with their role, key dates, and party roster — so the whole team starts on the same page.<br/>
                      <strong>Before you click:</strong> Confirm every email and phone below is correct. You will see a final summary list before anything sends.
                    </div>
                    <button onClick={() => sendWelcomeEmailsFromTx()}
                      style={{ background: "#1e8449", color: "white", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      ✉️ Send Welcome Emails to {(tx.parties || []).filter(p => p.email && p.email.includes("@")).length} Parties
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
              <Btn onClick={() => setShowAssignVendor(true)} small>🏆 Assign Vendor</Btn>
              <Btn onClick={() => setShowAddParty(true)} small>+ Add Party</Btn>
            </div>
            {showAssignVendor && (
              <AssignVendorPanel
                tx={tx}
                token={localStorage.getItem("tp_token") || ""}
                onClose={() => setShowAssignVendor(false)}
                onAssigned={(party) => {
                  onUpdate({ ...tx, parties: [...tx.parties, party] });
                  setShowAssignVendor(false);
                }}
              />
            )}
            {PARTY_ROLES.map(role => {
              const members = tx.parties.filter(p => p.role === role && !p.isVendor && !p.is_vendor);
              if (!members.length) return null;
              return <div key={role} style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{role}</div>{members.map(p => <PartyCard key={p.id} party={p} txId={tx.id} onEdit={() => setEditingParty({ ...p })} onRemove={() => update({ parties: tx.parties.filter(pp => pp.id !== p.id) })} onInvite={onInviteParty ? () => onInviteParty(p) : undefined} onSendFollowup={(party) => setFollowupParty(party)} onSendWelcome={onSendWelcome} onResetPassword={async (p) => {
              if (!confirm("Email a password reset link to " + (p.name || p.email) + "?\n\nThe link expires in 1 hour.")) return;
              try {
                const r = await fetch("https://liz-team-server-api-production.up.railway.app/users/" + encodeURIComponent(p.email) + "/send-reset-link", { method: "POST", headers: { Authorization: "Bearer " + (localStorage.getItem("tp_token") || ""), "Content-Type": "application/json" }, body: JSON.stringify({ email: p.email }) });
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || "Failed");
                alert("✅ Reset link sent to " + p.email);
              } catch (e) { alert("⚠️ " + e.message); }
            }} />)}</div>;
            })}
            {(() => {
              const vendorParties = tx.parties.filter(p => p.isVendor || p.is_vendor || !PARTY_ROLES.includes(p.role));
              if (!vendorParties.length) return null;
              const vendorGroups = vendorParties.reduce((acc, p) => {
                const key = p.vendorCategory || p.vendor_category || p.role || "Other";
                acc[key] = acc[key] || [];
                acc[key].push(p);
                return acc;
              }, {});
              return Object.entries(vendorGroups).map(([cat, members]) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cat}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#C0392B", background: "#FADBD8", padding: "2px 8px", borderRadius: 20 }}>PREFERRED VENDOR</span>
                  </div>
                  {members.map(p => (
                    <div key={p.id}>
                      <PartyCard party={p} txId={tx.id}
                        onEdit={() => setEditingParty({ ...p })}
                      onRemove={async () => {
                        if (!window.confirm("Remove this vendor from the transaction?")) return;
                        const tok = localStorage.getItem("tp_token") || "";
                        try {
                          await fetch("https://liz-team-server-api-production.up.railway.app/transactions/" + tx.id + "/party/" + p.id, {
                            method: "DELETE", headers: { Authorization: "Bearer " + tok }
                          });
                        } catch(e) {}
                        onUpdate({ ...tx, parties: tx.parties.filter(pp => pp.id !== p.id) });
                      }}
                        onInvite={onInviteParty ? () => onInviteParty(p) : undefined}
                        onSendWelcome={onSendWelcome} onResetPassword={async (p) => {
              if (!confirm("Email a password reset link to " + (p.name || p.email) + "?\n\nThe link expires in 1 hour.")) return;
              try {
                const r = await fetch("https://liz-team-server-api-production.up.railway.app/users/" + encodeURIComponent(p.email) + "/send-reset-link", { method: "POST", headers: { Authorization: "Bearer " + (localStorage.getItem("tp_token") || ""), "Content-Type": "application/json" }, body: JSON.stringify({ email: p.email }) });
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || "Failed");
                alert("✅ Reset link sent to " + p.email);
              } catch (e) { alert("⚠️ " + e.message); }
            }} />
                      {(p.vendorStatus === "selected" || p.vendor_status === "selected") && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px", background: "#D5F5E3", borderRadius: 8,
                          marginTop: -8, marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: "#1E8449", fontWeight: 600 }}>
                            ✅ Selected by client
                          </span>
                          <button onClick={async () => {
                            if (!window.confirm("Reset this vendor selection? The buyer will be able to choose again.")) return;
                            const tok = localStorage.getItem("tp_token") || "";
                            try {
                              const res = await fetch("https://liz-team-server-api-production.up.railway.app/vendors/reset/" + tx.id + "/" + p.id, {
                                method: "PATCH",
                                headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }
                              });
                              const data = await res.json();
                              if (data.success) {
                                const updatedParties = tx.parties.map(pp =>
                                  pp.id === p.id ? { ...pp, vendorStatus: "available", selected_by_name: null } : pp
                                );
                                onUpdate({ ...tx, parties: updatedParties });
                              }
                            } catch (e) { alert("Error resetting vendor"); }
                          }}
                            style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 6,
                              border: "1px solid #1E8449", background: "#fff",
                              color: "#1E8449", fontSize: 12, fontWeight: 600,
                              cursor: "pointer" }}>
                            Reset Selection
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ));
            })()}
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
        {activeTab === "calculator" && (
          <div style={{ padding: 20 }}>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#7f1d1d" }}>
              <strong>🎓 Why this matters:</strong> Use this with your buyer to set realistic expectations on price, monthly payment, and cash-to-close BEFORE writing offers. Florida's doc stamps, intangible tax, and insurance costs surprise most first-time buyers.
            </div>
            <BuyerCalculator />
          </div>
        )}

        {activeTab === "cma" && (
          <div style={{ padding: 20 }}>
            <div style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#1e3a8a" }}>
              <strong>🎓 Why this matters:</strong> A defensible CMA protects you legally and helps the seller trust your pricing. Pull 3-6 comps from MLS, enter them here. The system applies FL-specific upgrade adjustments (hurricane windows, solar, new roof, etc.) and generates a branded PDF for the listing appointment.
            </div>
            <CMACalculator transactionId={tx.id} token={localStorage.getItem("tp_token") || ""} />
          </div>
        )}

        {activeTab === "seller-calc" && (
          <div style={{ padding: 20 }}>
            <div style={{ background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#0c4a6e" }}>
              <strong>🎓 Why this matters:</strong> Sellers want to know what they'll walk away with. Use this BEFORE the listing appointment to set realistic expectations on commission, FL doc stamps (~0.7%), title fees, and mortgage payoff. Avoids "I thought I was getting more" at closing.
            </div>
            <SellerCalculator transactionId={tx.id} token={localStorage.getItem("tp_token") || ""} />
          </div>
        )}

        {activeTab === "tx-forms" && (
          <TxFormsTab tx={tx} side={isListingSideTx ? "listing" : "buyer"} isAdmin={false} />
        )}

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
        {activeTab === "chat" && <div style={{ padding: 20, height: 500 }}><TransactionChat transactionId={tx.id} user={null} parties={tx.parties || []} style={{ height: "100%" }} unreadCount={chatUnread} onUnreadChange={() => {}} /></div>}
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
            <Btn onClick={async () => {
              const editedParty = editingParty;
              update({ parties: tx.parties.map(p => p.id === editedParty.id ? editedParty : p) });
              setEditingParty(null);
              // Prompt to send welcome to just this party — only if they have a valid email
              if (editedParty.email && editedParty.email.includes("@") && (tx.status === "Under Contract" || tx.needsReview)) {
                setTimeout(() => {
                  if (window.confirm(`Send a welcome email to ${editedParty.name} (${editedParty.role}) at ${editedParty.email} now?\n\nThis sends the standard welcome with transaction details. Click Cancel to wait and send to all parties together later.`)) {
                    sendWelcomeEmailsFromTx([editedParty]);
                  }
                }, 200);
              }
            }}>Save Changes</Btn>
          </div>
        </Modal>
      )}
      {showAssignAgent && (
        <AssignAgentModal
          tx={tx}
          token={localStorage.getItem("tp_token") || ""}
          currentUser={currentUser}
          onClose={() => setShowAssignAgent(false)}
          onAssigned={(agentId) => onUpdate({ ...tx, assignedAgentId: agentId })}
        />
      )}
      {showAddParty && (
        <Modal title="Add Party" onClose={() => { setShowAddParty(false); setPartyFromContactBook(false); }}>
          <ContactAutocomplete
            token={localStorage.getItem("tp_token") || ""}
            onSelect={(c) => {
              const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ");
              setPartyForm(f => ({
                ...f,
                name: fullName || f.name,
                email: c.email || f.email,
                phone: c.phone || f.phone,
                mailingAddress: [c.address, c.city, c.state, c.zip_code].filter(Boolean).join(", ") || f.mailingAddress,
              }));
              setPartyFromContactBook(true);
            }}
          />
          {contacts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Btn small variant="secondary" onClick={() => onOpenContactBook && onOpenContactBook(contact => {
                setPartyForm({ role: contact.role, name: contact.name, company: contact.company || "", email: contact.email || "", phone: contact.phone || "" });
                setPartyFromContactBook(true);
                setShowAddParty(true);
              })}>📒 Pick from Address Book</Btn>
              <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 10 }}>(transaction-party shortcuts)</span>
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
                const invitedNow = document.getElementById("sendInvitation")?.checked;
                if (invitedNow && onInviteParty) {
                  onInviteParty({ ...newParty });
                }
                // Prompt to send invite if email present and not already invited
                if (!invitedNow && newParty.email && onInviteParty) {
                  setPendingInviteParty(newParty);
                }
                setPartyForm({ role: "", name: "", email: "", phone: "", company: "" });
                setPartyFromContactBook(false);
                setShowAddParty(false);
              }
            }}>Add Party</Btn>
          </div>
        </Modal>
      )}
      {pendingInviteParty && (
        <Modal title="Send invitation?" onClose={() => setPendingInviteParty(null)}>
          <div style={{ marginBottom: 18, fontSize: 14, color: COLORS.text, lineHeight: 1.5 }}>
            Would you like to send a portal invitation to <strong>{pendingInviteParty.name}</strong> at <strong>{pendingInviteParty.email}</strong> now?
          </div>
          <div style={{ background: COLORS.infoBg, border: "1px solid " + COLORS.info, borderRadius: 8, padding: 12, fontSize: 12, color: COLORS.info, marginBottom: 18 }}>
            They will get an email with a link to access this transaction. You can also send the invite later from the party's card.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setPendingInviteParty(null)}>Skip</Btn>
            <Btn onClick={() => {
              if (onInviteParty) onInviteParty(pendingInviteParty);
              setPendingInviteParty(null);
            }}>Send Invite Now</Btn>
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
                  {tx.type === "Buyer Representation" && (
                    <div style={{ marginBottom: 14, padding: 12, background: "#FFF7ED", border: "1.5px solid #FDBA74", borderRadius: 8 }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input type="checkbox" checked={!!statusChangeModal.form.isNewConstruction} onChange={e => setStatusChangeModal(m => ({ ...m, form: { ...m.form, isNewConstruction: e.target.checked } }))}
                          style={{ marginTop: 3, width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#9A3412" }}>🏗️ This is a new construction purchase</div>
                          <div style={{ fontSize: 11, color: "#9A3412", opacity: 0.85, marginTop: 2 }}>Adds 19 new construction tasks (design center, builder warranty, inspections, etc.)</div>
                        </div>
                      </label>
                    </div>
                  )}
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
                    let mergedTasks = [...updatedExisting, ...newContractTasks];
                    if (form.isNewConstruction) {
                      const ncExisting = new Set(mergedTasks.map(t => t.name));
                      const ncNew = NEW_CONSTRUCTION_TASKS.filter(t => !ncExisting.has(t.name));
                      const computeNcDue = (t) => {
                        if (t.daysFromOpen === null || t.daysFromOpen === undefined) return null;
                        if (t.daysFromOpen < 0 && form.closingDate) return addDays(form.closingDate, t.daysFromOpen);
                        if (t.daysFromOpen >= 0) return addDays(form.executedDate, t.daysFromOpen);
                        return null;
                      };
                      const ncTasks = ncNew.map(t => ({ id: genId(), name: t.name, category: t.category, phase: t.phase, status: "Pending", dueDate: computeNcDue(t), assignTo: t.assignTo, notes: "" }));
                      mergedTasks = [...mergedTasks, ...ncTasks];
                    }
                    updates.tasks = mergedTasks;
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
      {showAddTask && (() => {
        const partyOptions = (tx.parties || []).filter(p => p.email || p.phone).map(p => ({
          value: p.id,
          label: `${p.name} (${p.role})${p.email ? " — " + p.email : ""}${p.phone ? " — " + p.phone : ""}`
        }));
        return (
        <Modal title="Add Task" onClose={() => setShowAddTask(false)}>
          <Input label="Task Name" value={taskForm.name} onChange={v => setTaskForm(f => ({ ...f, name: v }))} required />
          <Input label="Category" value={taskForm.category} onChange={v => setTaskForm(f => ({ ...f, category: v }))} options={["Buyer","Seller","Pre-Approval","Follow Up","Contract","Disclosure","Escrow","Inspection","Financing","Title","HOA","Insurance","Marketing","Closing","Post-Closing","Other"]} />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>Who is responsible? (for follow-ups)</div>
            <select value={taskForm.assignedPartyId || ""}
              onChange={e => {
                const partyId = e.target.value;
                const party = (tx.parties || []).find(p => p.id === partyId);
                setTaskForm(f => ({
                  ...f,
                  assignedPartyId: partyId,
                  assignedPartyEmail: party?.email || "",
                  assignedPartyName: party?.name || "",
                  assignedPartyPhone: party?.phone || "",
                  assignTo: party?.role || ""
                }));
              }}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #DDD", fontSize: 13, boxSizing: "border-box" }}>
              <option value="">No specific party</option>
              {partyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {partyOptions.length === 0 && (
              <div style={{ fontSize: 11, color: "#B7770D", marginTop: 4 }}>
                No parties with email/phone yet. Add them in the Parties tab to enable follow-ups.
              </div>
            )}
          </div>
          <DueDatePresetPicker label="When to follow up?"
            value={taskForm.dueDate}
            onChange={v => setTaskForm(f => ({ ...f, dueDate: v }))} />
          <Input label="Notes" value={taskForm.notes} onChange={v => setTaskForm(f => ({ ...f, notes: v }))} type="textarea" />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowAddTask(false)}>Cancel</Btn>
            <Btn onClick={async () => {
              if (taskForm.name) {
                update({ tasks: [...tx.tasks, { ...taskForm, id: genId(), status: "Pending" }] });
                setTaskForm({ name: "", category: "Contract", assignTo: "", dueDate: "", notes: "", assignedPartyId: "", assignedPartyEmail: "", assignedPartyName: "", assignedPartyPhone: "" });
                setShowAddTask(false);
                // Regenerate daily tasks for this tx so the new task shows on Win-the-Day immediately
                try {
                  await fetch(API + "/transactions/" + tx.id + "/regenerate-daily-tasks", {
                    method: "POST",
                    headers: { Authorization: "Bearer " + token }
                  });
                  window.dispatchEvent(new Event("wintheday:refresh"));
                } catch (e) { /* non-fatal — cron will catch it tomorrow */ }
              }
            }}>Add Task</Btn>
          </div>
        </Modal>
        );
      })()}
      {followupParty && (
        <Modal title={`Send Follow-Up to ${followupParty.name}`} onClose={() => { setFollowupParty(null); setFollowupForm({ subject: "", message: "" }); }}>
          <div style={{ background:"#F3F4F6", borderRadius:8, padding:10, marginBottom:12, fontSize:12 }}>
            <div><strong>To:</strong> {followupParty.name} ({followupParty.role})</div>
            {followupParty.email && <div>📧 {followupParty.email}</div>}
            {followupParty.phone && <div>📱 {followupParty.phone}</div>}
            <div style={{ marginTop:4 }}><strong>Property:</strong> {tx.address}</div>
          </div>
          <Input label="Subject (what's this about?)" value={followupForm.subject} onChange={v => setFollowupForm(f => ({ ...f, subject: v }))} required />
          <Input label="Message" value={followupForm.message} onChange={v => setFollowupForm(f => ({ ...f, message: v }))} type="textarea" />
          <div style={{ background:"#EFF6FF", borderRadius:8, padding:10, marginBottom:12, fontSize:11, color:"#1E3A8A", lineHeight:1.5 }}>
            We'll send an SMS + email to {followupParty.name.split(" ")[0]} right away.
            If they don't respond, we'll follow up every 48h → 24h → 12h up to 5 times.
            You'll get a Win the Day alert if they go silent.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => { setFollowupParty(null); setFollowupForm({ subject: "", message: "" }); }}>Cancel</Btn>
            <Btn disabled={followupSubmitting || !followupForm.subject} onClick={async () => {
              if (!followupForm.subject) { alert("Please add a subject"); return; }
              setFollowupSubmitting(true);
              try {
                const res = await fetch(API + "/chases/start", {
                  method: "POST",
                  headers: { "Content-Type":"application/json", Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") },
                  body: JSON.stringify({
                    transactionId: tx.id,
                    targetType: "general",
                    targetEmail: followupParty.email,
                    subject: followupForm.subject,
                    customMessage: followupForm.message || null
                  })
                });
                const data = await res.json();
                if (data.success) {
                  alert("Follow-up started! First message will be sent shortly to " + followupParty.name);
                  setFollowupParty(null);
                  setFollowupForm({ subject: "", message: "" });
                } else if (data.error && data.error.includes("already active")) {
                  alert("A follow-up is already running for this party. It will keep going until resolved.");
                  setFollowupParty(null);
                } else {
                  alert("Could not start follow-up: " + (data.error || "unknown"));
                }
              } catch (e) { alert("Network error"); }
              setFollowupSubmitting(false);
            }}>{followupSubmitting ? "Sending..." : "Send Follow-Up"}</Btn>
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
              <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #EEE" }}>Property Information</div>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Address</div><input value={editTxForm.address || ""} onChange={e => setEditTxForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>City</div><input value={editTxForm.city || ""} onChange={e => setEditTxForm(f => ({ ...f, city: e.target.value }))} placeholder="Orlando" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} /></div><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>ZIP</div><input value={editTxForm.zipCode || ""} onChange={e => setEditTxForm(f => ({ ...f, zipCode: e.target.value }))} placeholder="32801" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} /></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>County</div><select value={editTxForm.county || ""} onChange={e => setEditTxForm(f => ({ ...f, county: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit" }}>{["Orange","Osceola","Seminole","Polk","Lake","Volusia","Other"].map(c => <option key={c}>{c}</option>)}</select></div><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Property Type</div><select value={editTxForm.propertyType || ""} onChange={e => setEditTxForm(f => ({ ...f, propertyType: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit" }}>{["Single Family","Townhouse","Condominium","Villa","Multi-Family","Land"].map(t => <option key={t}>{t}</option>)}</select></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Transaction Type</div><select value={editTxForm.type || ""} onChange={e => setEditTxForm(f => ({ ...f, type: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit" }}>{["Listing (Seller)","Buyer Representation","Dual Agency"].map(t => <option key={t}>{t}</option>)}</select></div><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>List Price ($)</div><input type="number" value={editTxForm.listPrice || ""} onChange={e => setEditTxForm(f => ({ ...f, listPrice: e.target.value }))} placeholder="450000" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} /></div></div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #EEE", marginTop: 8 }}>Transaction Details</div>
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
              {/* UNDER CONTRACT DETAILS — visible when status is Under Contract or any later phase */}
              {(tx.status === "Under Contract" || tx.status === "Inspection" || tx.status === "Appraisal" || tx.status === "Clear to Close" || tx.status === "Closed" || editTxForm.earnestMoneyAmount || editTxForm.emdDeadline) && (
                <>
                  <div style={{ borderTop: "2px solid #2563eb", margin: "20px 0 14px 0", paddingTop: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1e3a8a", marginBottom: 4 }}>📋 Under Contract Details</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 14 }}>These come from the executed contract. Verify each field matches the original.</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Earnest Money ($)</div>
                      <input type="number" value={editTxForm.earnestMoneyAmount || ""} onChange={e => setEditTxForm(f => ({ ...f, earnestMoneyAmount: e.target.value }))} placeholder="5000" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>EMD Deadline</div>
                      <input type="date" value={editTxForm.emdDeadline ? String(editTxForm.emdDeadline).slice(0,10) : ""} onChange={e => setEditTxForm(f => ({ ...f, emdDeadline: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Inspection (days)</div>
                      <input type="number" value={editTxForm.inspectionPeriodDays || ""} onChange={e => setEditTxForm(f => ({ ...f, inspectionPeriodDays: e.target.value }))} placeholder="10" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Financing (days)</div>
                      <input type="number" value={editTxForm.financingContingencyDays || ""} onChange={e => setEditTxForm(f => ({ ...f, financingContingencyDays: e.target.value }))} placeholder="30" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Appraisal (days)</div>
                      <input type="number" value={editTxForm.appraisalContingencyDays || ""} onChange={e => setEditTxForm(f => ({ ...f, appraisalContingencyDays: e.target.value }))} placeholder="30" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!editTxForm.isCash} onChange={e => setEditTxForm(f => ({ ...f, isCash: e.target.checked }))} /> Cash deal
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!editTxForm.hoaApprovalRequired} onChange={e => setEditTxForm(f => ({ ...f, hoaApprovalRequired: e.target.checked }))} /> HOA approval required
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!editTxForm.surveyRequired} onChange={e => setEditTxForm(f => ({ ...f, surveyRequired: e.target.checked }))} /> Survey required
                    </label>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Occupancy</div>
                      <select value={editTxForm.occupancyStatus || ""} onChange={e => setEditTxForm(f => ({ ...f, occupancyStatus: e.target.value }))}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 13, fontFamily: "inherit" }}>
                        <option value="">—</option>
                        <option>Owner Occupied</option>
                        <option>Tenant Occupied</option>
                        <option>Vacant</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Notes</div>
                <textarea value={editTxForm.notes || ""} onChange={e => setEditTxForm(f => ({ ...f, notes: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", minHeight: 80, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setShowEditTx(false)} style={{ padding: "10px 18px", border: "1px solid #CCC", borderRadius: 8, background: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={() => {
                  // Don't let empty form fields wipe out existing values — only apply fields the user actually set or that were pre-filled
                  const cleanedForm = Object.fromEntries(
                    Object.entries(editTxForm).filter(([k, v]) => v !== "" && v !== null && v !== undefined)
                  );
                  const updated = { ...tx, ...cleanedForm }; if (editTxForm.closingDate && editTxForm.closingDate !== tx.closingDate) { const templates = FLORIDA_TASK_TEMPLATES[tx.type] || []; updated.tasks = tx.tasks.map(task => {
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
  const [form, setForm] = useState({ address: "", city: "", county: "Osceola", zipCode: "", type: "Listing (Seller)", propertyType: "Single Family", listPrice: "", contractPrice: "", mlsNumber: "", openDate: today(), closingDate: "", executedDate: "", notes: "", status: "Active", assignedAgent: "", referralSource: "", occupancyStatus: "", propertyAccess: "", commissionListing: "", commissionBuyer: "", transactionFee: "", brokerageSplit: "", officeFlatFee: "", commissionNotes: "" });
  const [teamAgents, setTeamAgents] = useState([]);
  useEffect(() => { const tok = localStorage.getItem("tp_token") || ""; fetch(API + "/users", { headers: { "Authorization": "Bearer " + tok } }).then(r => r.json()).then(d => { if (d.users) setTeamAgents(d.users.filter(u => u.role === "agent" || u.role === "admin" || u.role === "superadmin")); }).catch(() => {}); }, []);
  const [useFLTemplates, setUseFLTemplates] = useState(true);
  const [taskTemplates, setTaskTemplates] = useState([]);
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/task-templates?state=FL&transactionType=" + encodeURIComponent(form.type), {
      headers: { "Authorization": "Bearer " + tok }
    }).then(r => r.json()).then(d => {
      if (d.success) setTaskTemplates(d.templates || []);
    }).catch(() => {});
  }, [form.type]);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const handleSave = async () => {
    if (!form.address || !form.city || !form.assignedAgent || !form.referralSource || !form.occupancyStatus) { alert("Please fill all required fields: Address, City, Assigned Agent, Referral Source, and Occupancy Status."); return; }
    const contractDate = form.executedDate || form.openDate;
    const tasks = useFLTemplates ? taskTemplates.filter(t => t.phase === "active").map(t => ({ id: genId(), name: t.task_name, category: t.category, assignTo: t.default_assignee_role, dueDate: null, status: "Pending", notes: "", phase: "active" })) : [];
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
          executedDate: t.executed_date || form.executedDate,
          notes: t.notes || form.notes,
          assignedAgentId: t.assigned_agent || form.assignedAgent,
          referralSource: t.referral_source || form.referralSource,
          occupancyStatus: t.occupancy_status || form.occupancyStatus,
          propertyAccess: t.property_access || form.propertyAccess,
          commissionListing: t.commission_listing || form.commissionListing,
          commissionBuyer: t.commission_buyer || form.commissionBuyer,
          transactionFee: t.transaction_fee || form.transactionFee,
          brokerageSplit: t.brokerage_split || form.brokerageSplit,
          officeFlatFee: t.office_flat_fee || form.officeFlatFee,
          commissionNotes: t.commission_notes || form.commissionNotes,
          smsThreads: {}, parties: [], tasks, messages: [], reminders: [],
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
          <Input label="Occupancy Status" value={form.occupancyStatus} onChange={f("occupancyStatus")} options={OCCUPANCY_OPTIONS} required />
        </div>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, color: COLORS.navy, fontWeight: 700 }}>Pricing & Dates</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Input label="List Price ($)" value={form.listPrice} onChange={f("listPrice")} type="number" /><Input label="Contract Price ($)" value={form.contractPrice} onChange={f("contractPrice")} type="number" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Input label="Open Date" value={form.openDate} onChange={f("openDate")} type="date" /><Input label="Closing Date" value={form.closingDate} onChange={f("closingDate")} type="date" /></div>
          <Input label="Executed Date" value={form.executedDate} onChange={f("executedDate")} type="date" />
          <Input label="Status" value={form.status} onChange={f("status")} options={Object.keys(STATUS_CONFIG)} />
        </div>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, color: COLORS.navy, fontWeight: 700 }}>Assignment & Source</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Input label="Assigned Agent" value={form.assignedAgent} onChange={f("assignedAgent")} options={teamAgents.map(a => ({ value: a.id, label: `${a.first_name} ${a.last_name}` }))} required />
            <Input label="Referral Source" value={form.referralSource} onChange={f("referralSource")} options={REFERRAL_SOURCES} required />
          </div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, color: COLORS.navy, fontWeight: 700 }}>Property Access</h3>
          <Input label="Lockbox / Gate / Alarm Codes & Access Notes" value={form.propertyAccess} onChange={f("propertyAccess")} type="textarea" placeholder="Lockbox code: 1234. Gate code: 5678. Alarm: disarm with..." />
        </div>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, color: COLORS.navy, fontWeight: 700 }}>Commission Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Input label="Listing Commission (%)" value={form.commissionListing} onChange={f("commissionListing")} type="number" />
            <Input label="Buyer Commission (%)" value={form.commissionBuyer} onChange={f("commissionBuyer")} type="number" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Input label="Transaction Fee ($)" value={form.transactionFee} onChange={f("transactionFee")} type="number" />
            <Input label="Brokerage Split (%)" value={form.brokerageSplit} onChange={f("brokerageSplit")} type="number" />
          </div>
          <Input label="Office Flat Fee ($)" value={form.officeFlatFee} onChange={f("officeFlatFee")} type="number" />
          <Input label="Commission Notes" value={form.commissionNotes} onChange={f("commissionNotes")} type="textarea" />
        </div>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 28, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: COLORS.navy, fontWeight: 700 }}>Florida Task Templates</h3>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}>
            <input type="checkbox" checked={useFLTemplates} onChange={e => setUseFLTemplates(e.target.checked)} style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 14 }}>Auto-load Florida FR/Bar checklist for <strong>{form.type}</strong></span>
          </label>
          {useFLTemplates && <div style={{ background: COLORS.infoBg, borderRadius: 8, padding: 12, fontSize: 12, color: COLORS.info }}><strong>{taskTemplates.length} workflow tasks</strong> will be created. Compliance milestones (EMD, BINSR, Loan, Title, Closing, etc.) are tracked separately and will appear in the Milestones tab.</div>}
        </div>
        <Input label="Notes" value={form.notes} onChange={f("notes")} type="textarea" />
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!form.address || !form.city || !form.assignedAgent || !form.referralSource || !form.occupancyStatus}>Create Transaction</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════
// ContactAutocomplete — search-as-you-type dropdown for CRM contacts
// Fires onSelect(contact) when a result is picked.
// ═══════════════════════════════════════════════════════════════
function ContactAutocomplete({ token, onSelect }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch("https://liz-team-server-api-production.up.railway.app/contacts/search?q=" + encodeURIComponent(q), {
          headers: { Authorization: "Bearer " + token }
        });
        const data = await r.json();
        setResults(data.contacts || []);
        setOpen(true);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [q, token]);

  const TEMP_EMOJI = { hot: "🔥", warm: "🌤", cold: "❄️", sphere: "👥", past: "🏡" };

  const pick = (c) => {
    onSelect && onSelect(c);
    setQ("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
        🔍 Search your contacts (optional)
      </label>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Type a name, email, or phone to auto-fill from your CRM..."
        style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
      />
      {open && results.length > 0 && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 2, background: "white", border: "1px solid #d1d5db", borderRadius: 6, boxShadow: "0 6px 18px rgba(0,0,0,0.18)", zIndex: 201, maxHeight: 280, overflowY: "auto" }}>
            {results.map(c => {
              const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "(no name)";
              return (
                <button key={c.id} onClick={() => pick(c)}
                  style={{ display: "block", width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #f3f4f6", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <div style={{ fontWeight: 600, color: "#111" }}>
                    {TEMP_EMOJI[c.temperature] || "•"} {name}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    {[c.email, c.phone, c.contact_type].filter(Boolean).join(" · ")}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
      {loading && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Searching...</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SettingsMenu — dropdown that consolidates 6+ buttons into one
// ═══════════════════════════════════════════════════════════════
function SettingsMenu({ currentUser, onOpenContactBook, contactCount, onReports, onAgentProfile, onOpenComplianceDash, onOpenCompliance, onOpenTaskTmpls, onCompanySettings, onChangePassword, onOpenForms }) {
  const [open, setOpen] = useState(false);
  const isAdmin = ["admin", "superadmin"].includes(currentUser?.role);
  const items = [];

  items.push({ icon: "📒", label: `Address Book${contactCount > 0 ? ` (${contactCount})` : ""}`, onClick: onOpenContactBook });
  items.push({ icon: "📊", label: "Reports", onClick: onReports });
  items.push({ icon: "👤", label: "My Profile", onClick: onAgentProfile });
  if (onOpenForms) items.push({ icon: "📋", label: "Forms Library", onClick: onOpenForms });
  items.push({ icon: "🔒", label: "Change Password", onClick: onChangePassword });
  if (isAdmin) {
    items.push({ divider: true });
    items.push({ icon: "📊", label: "Compliance Dashboard", onClick: onOpenComplianceDash });
    items.push({ icon: "⚖️", label: "Doc Requirements", onClick: onOpenCompliance });
    items.push({ icon: "📝", label: "Task Templates", onClick: onOpenTaskTmpls });
    items.push({ icon: "⚙️", label: "Company Settings", onClick: onCompanySettings });
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.88)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
        ⚙️ Menu {open ? "▴" : "▾"}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
          <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "white", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 201, minWidth: 240, padding: 4 }}>
            {items.map((it, i) => it.divider ? (
              <div key={i} style={{ height: 1, background: "#e5e7eb", margin: "6px 8px" }} />
            ) : (
              <button key={i} onClick={() => { setOpen(false); it.onClick && it.onClick(); }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "none", border: "none", borderRadius: 4, fontSize: 13, color: "#1f2937", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <span style={{ fontSize: 16 }}>{it.icon}</span>
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Dashboard({ transactions, unreadCounts = {}, onSelect, onNew, onOpenContactBook, onOpenContacts, onOpenExpenses, onOpenForms, contactCount, onLogout, onOpenTeam, onOpenCompliance, onOpenComplianceDash, onOpenTaskTmpls, onOpenContractIntake, onChangePassword, onReports, onHome, onVendors, onCompanySettings, onAgentProfile, onIntakeLinks, currentUser }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("tp_view_mode") || "cards");
  const [sortKey, setSortKey] = useState(() => { const saved = localStorage.getItem("tp_sort_key"); return saved && saved !== "closingDate" ? saved : "status"; });
  const [sortDir, setSortDir] = useState(() => localStorage.getItem("tp_sort_dir") || "asc");
  useEffect(() => { localStorage.setItem("tp_view_mode", viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem("tp_sort_key", sortKey); }, [sortKey]);
  useEffect(() => { localStorage.setItem("tp_sort_dir", sortDir); }, [sortDir]);

  // Advanced filters
  const readUrl = () => {
    if (typeof window === "undefined") return {};
    const sp = new URLSearchParams(window.location.search);
    return {
      assignedAgent: sp.get("agent") || "",
      propertyType: sp.get("propType") || "",
      transactionType: sp.get("txType") || "",
      datePreset: sp.get("datePreset") || "",
      closingDateFrom: sp.get("from") || "",
      closingDateTo: sp.get("to") || "",
    };
  };
  const initFilters = readUrl();
  const [agentFilter, setAgentFilter] = useState(initFilters.assignedAgent);
  const [propTypeFilter, setPropTypeFilter] = useState(initFilters.propertyType);
  const [txTypeFilter, setTxTypeFilter] = useState(initFilters.transactionType);
  const [datePreset, setDatePreset] = useState(initFilters.datePreset);
  const [closingFrom, setClosingFrom] = useState(initFilters.closingDateFrom);
  const [closingTo, setClosingTo] = useState(initFilters.closingDateTo);
  const [showFilters, setShowFilters] = useState(false);
  const [agentList, setAgentList] = useState([]);

  // Fetch agents for the dropdown (one-time)
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/users", { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json())
      .then(d => { if (d.users) setAgentList(d.users.filter(u => ["agent","admin","superadmin","tc"].includes(u.role))); })
      .catch(() => {});
  }, []);

  // Resolve datePreset to actual from/to dates
  useEffect(() => {
    if (!datePreset || datePreset === "custom") return;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    if (datePreset === "thisWeek") {
      const day = today.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(today); mon.setDate(today.getDate() + diffToMon);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setClosingFrom(mon.toISOString().split("T")[0]);
      setClosingTo(sun.toISOString().split("T")[0]);
    } else if (datePreset === "thisMonth") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setClosingFrom(first.toISOString().split("T")[0]);
      setClosingTo(last.toISOString().split("T")[0]);
    } else if (datePreset === "next30") {
      const end = new Date(today); end.setDate(today.getDate() + 30);
      setClosingFrom(todayStr);
      setClosingTo(end.toISOString().split("T")[0]);
    }
  }, [datePreset]);

  // Sync filters to URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const setOrDelete = (k, v) => v ? sp.set(k, v) : sp.delete(k);
    setOrDelete("agent", agentFilter);
    setOrDelete("propType", propTypeFilter);
    setOrDelete("txType", txTypeFilter);
    setOrDelete("datePreset", datePreset);
    setOrDelete("from", closingFrom);
    setOrDelete("to", closingTo);
    const qs = sp.toString();
    const newUrl = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }, [agentFilter, propTypeFilter, txTypeFilter, datePreset, closingFrom, closingTo]);

  const clearAllFilters = () => {
    setAgentFilter(""); setPropTypeFilter(""); setTxTypeFilter("");
    setDatePreset(""); setClosingFrom(""); setClosingTo("");
  };

  const activeFilterCount = [agentFilter, propTypeFilter, txTypeFilter, closingFrom || closingTo].filter(Boolean).length;

  // Paged transactions state
  const [pagedTxs, setPagedTxs] = useState([]);
  const [savedViews, setSavedViews] = useState([]);
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [saveViewAsDefault, setSaveViewAsDefault] = useState(false);
  const [saveViewLoading, setSaveViewLoading] = useState(false);
  const [showViewsMenu, setShowViewsMenu] = useState(false);
  const [defaultViewApplied, setDefaultViewApplied] = useState(false);
  const [pagedTotal, setPagedTotal] = useState(0);
  const [pagedPage, setPagedPage] = useState(1);
  const [pagedHasMore, setPagedHasMore] = useState(false);
  const [pagedLoading, setPagedLoading] = useState(false);
  const [pagedError, setPagedError] = useState(null);
  const [dashStats, setDashStats] = useState(null);
  const sentinelRef = useRef(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const buildPagedUrl = (page) => {
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("pageSize", 50);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filter === "Under Contract") {
      params.set("status", "Under Contract");
    } else if (filter && filter !== "All") {
      params.set("status", filter);
    }
    if (sortKey) params.set("sortKey", sortKey);
    if (sortDir) params.set("sortDir", sortDir);
    if (agentFilter) params.set("assignedAgent", agentFilter);
    if (propTypeFilter) params.set("propertyType", propTypeFilter);
    if (txTypeFilter) params.set("transactionType", txTypeFilter);
    if (closingFrom) params.set("closingDateFrom", closingFrom);
    if (closingTo) params.set("closingDateTo", closingTo);
    return API + "/transactions/paged?" + params.toString();
  };

  // Fetch page 1 on filter/sort/search change
  useEffect(() => {
    let cancelled = false;
    const tok = localStorage.getItem("tp_token") || "";
    setPagedLoading(true);
    setPagedError(null);
    fetch(buildPagedUrl(1), { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) { setPagedError(data.error); setPagedTxs([]); setPagedTotal(0); setPagedHasMore(false); }
        else {
          setPagedTxs(data.transactions || []);
          setPagedTotal(data.total || 0);
          setPagedHasMore(!!data.hasMore);
          setPagedPage(1);
        }
      })
      .catch(e => { if (!cancelled) { setPagedError(e.message); setPagedTxs([]); } })
      .finally(() => { if (!cancelled) setPagedLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, filter, sortKey, sortDir, agentFilter, propTypeFilter, txTypeFilter, closingFrom, closingTo]);

  const loadMore = () => {
    if (pagedLoading || !pagedHasMore) return;
    const next = pagedPage + 1;
    const tok = localStorage.getItem("tp_token") || "";
    setPagedLoading(true);
    fetch(buildPagedUrl(next), { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setPagedTxs(prev => [...prev, ...(data.transactions || [])]);
          setPagedTotal(data.total || 0);
          setPagedHasMore(!!data.hasMore);
          setPagedPage(next);
        }
      })
      .catch(() => {})
      .finally(() => setPagedLoading(false));
  };

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: "200px" });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [pagedHasMore, pagedLoading, pagedPage]);

  // Stats fetch — re-run when global transactions change (proxy for create/edit/delete)
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/transactions/stats", { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json())
      .then(data => { if (!data.error) setDashStats(data); })
      .catch(() => {});
  }, [transactions.length]);

  // Hydrate snake_case server fields into camelCase the UI expects
  // ─── Saved Views ───
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/saved-views", { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json())
      .then(d => { if (d.views) setSavedViews(d.views); })
      .catch(() => {});
  }, []);

  const applyView = (view) => {
    if (!view) return;
    const f = view.filters || {};
    setAgentFilter(f.agentFilter || "");
    setPropTypeFilter(f.propTypeFilter || "");
    setTxTypeFilter(f.txTypeFilter || "");
    setDatePreset(f.datePreset || "");
    setClosingFrom(f.closingFrom || "");
    setClosingTo(f.closingTo || "");
    setFilter(f.statusFilter || "All");
    if (view.sortKey && view.sortKey !== 'closingDate') setSortKey(view.sortKey); else setSortKey('status');
    if (view.sortDir) setSortDir(view.sortDir);
    if (view.viewMode) setViewMode(view.viewMode);
    setShowViewsMenu(false);
  };

  const handleDeleteView = async (id, e) => {
    if (e) e.stopPropagation();
    if (!confirm("Delete this saved view?")) return;
    try {
      const tok = localStorage.getItem("tp_token") || "";
      const res = await fetch(API + "/saved-views/" + id, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + tok }
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert("Failed to delete: " + (d.error || res.status)); return; }
      setSavedViews(prev => prev.filter(v => v.id !== id));
    } catch (err) {
      alert("Network error: " + err.message);
    }
  };

  const handleToggleDefault = async (id, currentDefault, e) => {
    if (e) e.stopPropagation();
    try {
      const tok = localStorage.getItem("tp_token") || "";
      const res = await fetch(API + "/saved-views/" + id + "/default", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
        body: JSON.stringify({ isDefault: !currentDefault })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert("Failed: " + (d.error || res.status)); return; }
      setSavedViews(prev => prev.map(v => ({ ...v, isDefault: v.id === id ? !currentDefault : false })));
    } catch (err) {
      alert("Network error: " + err.message);
    }
  };

  // Auto-apply default view on first load (after savedViews are fetched)
  useEffect(() => {
    if (defaultViewApplied) return;
    if (savedViews.length === 0) return;
    const def = savedViews.find(v => v.isDefault);
    if (def) applyView(def);
    setDefaultViewApplied(true);
  }, [savedViews, defaultViewApplied]);

  const handleSaveView = async () => {
    if (!saveViewName.trim()) { alert("Please enter a name"); return; }
    setSaveViewLoading(true);
    try {
      const tok = localStorage.getItem("tp_token") || "";
      const filters = {
        agentFilter,
        propTypeFilter,
        txTypeFilter,
        datePreset,
        closingFrom,
        closingTo,
        statusFilter: filter,
      };
      const res = await fetch(API + "/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
        body: JSON.stringify({ name: saveViewName.trim(), filters, sortKey, sortDir, viewMode, isDefault: saveViewAsDefault })
      });
      const data = await res.json();
      if (!res.ok) { alert("Failed to save view: " + (data.error || res.status)); return; }
      // Append the new view (or replace if it became default)
      setSavedViews(prev => {
        const others = saveViewAsDefault ? prev.map(v => ({ ...v, isDefault: false })) : prev;
        return [data.view, ...others];
      });
      setShowSaveViewModal(false);
      setSaveViewName("");
      setSaveViewAsDefault(false);
    } catch (e) {
      alert("Network error: " + e.message);
    } finally {
      setSaveViewLoading(false);
    }
  };

  const hydratedPagedTxs = [...pagedTxs].sort((a, b) => {
    const aUnassigned = !a.assigned_agent ? 4 : 0;
    const bUnassigned = !b.assigned_agent ? 4 : 0;
    const aReview = a.needs_review ? 2 : 0;
    const bReview = b.needs_review ? 2 : 0;
    const aNew = a.needs_first_contact ? 1 : 0;
    const bNew = b.needs_first_contact ? 1 : 0;
    return (bUnassigned + bReview + bNew) - (aUnassigned + aReview + aNew);
  }).map(t => ({
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
    executedDate: t.executed_date,
    notes: t.notes,
    propertyAccess: t.property_access,
    commissionListing: t.commission_listing,
    commissionBuyer: t.commission_buyer,
    transactionFee: t.transaction_fee,
    brokerageSplit: t.brokerage_split,
    officeFlatFee: t.office_flat_fee,
    commissionNotes: t.commission_notes,
    referralSource: t.referral_source,
    assignedAgentId: t.assigned_agent_id,
    assignedAgentName: t.assigned_agent_name,
    owningTenantId: t.tenant_id,
    owningBrokerageName: t.brokerage_name,
    owningBrokerageColor: t.brokerage_color,
    messages: t.internal_notes || [],
    parties: (t.parties || []).filter(Boolean).map(p => ({ id: p.id, role: p.role, name: p.name, email: p.email, phone: p.phone, company: p.company, isVendor: p.isVendor || false, vendorStatus: p.vendorStatus || null, vendorCategory: p.vendorCategory || null, vendorDescription: p.vendorDescription || null })),
    tasks: (t.tasks || []).filter(Boolean).map(tk => ({ id: tk.id, name: tk.name, status: tk.status, dueDate: tk.dueDate, category: tk.category, assignTo: tk.assignTo })),
    reminders: (t.reminders || []).filter(Boolean),
    smsThreads: t.sms_threads || {},
    needsFirstContact: t.needs_first_contact || false,
    submittedVia: t.submitted_via || null,
    intakeStepsDone: t.intake_steps_done || [],
    needsReview: t.needs_review || false,
    reviewReason: t.review_reason || null,
    additionalTerms: t.additional_terms || null,
    reviewStepsDone: t.review_steps_done || [],
    earnestMoneyAmount: t.earnest_money_amount || "",
    emdDeadline: t.emd_deadline || "",
    inspectionPeriodDays: t.inspection_period_days || "",
    inspectionPeriodEnd: t.inspection_period_end || "",
    financingContingency: t.financing_contingency || false,
    financingContingencyDays: t.financing_contingency_days || "",
    appraisalContingency: t.appraisal_contingency || false,
    appraisalContingencyDays: t.appraisal_contingency_days || "",
    hoaApprovalRequired: t.hoa_approval_required || false,
    hoaApprovalDays: t.hoa_approval_days || "",
    surveyRequired: t.survey_required || false,
    isCash: t.is_cash || false,
    contractFormType: t.contract_form_type || "",
    occupancyStatus: t.occupancy_status || "",
  }));

  const [showOverdue, setShowOverdue] = useState(false);
  const [remindingTask, setRemindingTask] = useState(null);
  const [remindingTx, setRemindingTx] = useState(null);
  const filtered = transactions.filter(tx => ((filter === "All" ? (tx.status !== "Cancelled" && tx.status !== "Closed") : tx.status === filter)) && (!search || tx.address.toLowerCase().includes(search.toLowerCase()) || tx.city.toLowerCase().includes(search.toLowerCase()) || (tx.mlsNumber || "").toLowerCase().includes(search.toLowerCase()) || (tx.parties || []).some(p => p && p.name && p.name.toLowerCase().includes(search.toLowerCase()))));
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    let av, bv;
    // Status priority sort — Active first, then contract stages, then closed
    if (sortKey === "status") {
      const priorities = {
        "Active": 1, "Under Contract": 2, "Inspection": 3,
        "Appraisal": 4, "Clear to Close": 5, "On Hold": 6,
        "Closed": 7, "Cancelled": 8
      };
      const pa = priorities[a.status] || 9;
      const pb = priorities[b.status] || 9;
      if (pa !== pb) return sortDir === "asc" ? pa - pb : pb - pa;
      if (a.closingDate && b.closingDate) return new Date(a.closingDate) - new Date(b.closingDate);
      return 0;
    }
    switch (sortKey) {
      case "address": av = (a.address || "").toLowerCase(); bv = (b.address || "").toLowerCase(); break;
      case "status": av = a.status || ""; bv = b.status || ""; break;
      case "price": av = Number(a.contractPrice || a.listPrice || 0); bv = Number(b.contractPrice || b.listPrice || 0); break;
      case "openDate": av = a.openDate ? new Date(a.openDate).getTime() : 0; bv = b.openDate ? new Date(b.openDate).getTime() : 0; break;
      case "progress":
        av = a.tasks && a.tasks.length ? a.tasks.filter(t => t.status === "Completed").length / a.tasks.length : 0;
        bv = b.tasks && b.tasks.length ? b.tasks.filter(t => t.status === "Completed").length / b.tasks.length : 0;
        break;
      case "closingDate":
      default:
        av = a.closingDate ? new Date(a.closingDate).getTime() : Number.MAX_SAFE_INTEGER;
        bv = b.closingDate ? new Date(b.closingDate).getTime() : Number.MAX_SAFE_INTEGER;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
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
    closingSoon: (() => {
      const today = new Date();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return transactions.filter(t => {
        if (!t.closingDate) return false;
        if (!["Active", "Under Contract"].includes(t.status)) return false;
        const cd = new Date(t.closingDate);
        return cd >= today && cd <= endOfMonth;
      }).length;
    })(),
    totalVolume: transactions.filter(t => t.status !== "Cancelled").reduce((a, t) => a + (Number(t.contractPrice) || Number(t.listPrice) || 0), 0),
    pendingCommissionGross: transactions.filter(t => !["Closed", "Cancelled", "On Hold"].includes(t.status)).reduce((acc, t) => {
      const price = Number(t.contractPrice || t.listPrice || 0);
      const isListing = t.type === "Listing (Seller)";
      const isBuyer = t.type === "Buyer Representation";
      const isDual = t.type === "Dual Agency";
      const ourListComm = (isListing || isDual) && t.commissionListing ? price * Number(t.commissionListing) / 100 : 0;
      const ourBuyerComm = (isBuyer || isDual) && t.commissionBuyer ? price * Number(t.commissionBuyer) / 100 : 0;
      return acc + ourListComm + ourBuyerComm;
    }, 0),
    pendingCommissionNet: transactions.filter(t => !["Closed", "Cancelled", "On Hold"].includes(t.status)).reduce((acc, t) => {
      const price = Number(t.contractPrice || t.listPrice || 0);
      const isListing = t.type === "Listing (Seller)";
      const isBuyer = t.type === "Buyer Representation";
      const isDual = t.type === "Dual Agency";
      const ourListComm = (isListing || isDual) && t.commissionListing ? price * Number(t.commissionListing) / 100 : 0;
      const ourBuyerComm = (isBuyer || isDual) && t.commissionBuyer ? price * Number(t.commissionBuyer) / 100 : 0;
      const ourComm = ourListComm + ourBuyerComm;
      const txFee = Number(t.transactionFee || 0);
      const split = t.brokerageSplit ? ourComm * Number(t.brokerageSplit) / 100 : 0;
      const flatFee = Number(t.officeFlatFee || 0);
      return acc + (ourComm + txFee - split - flatFee);
    }, 0),
    pendingCount: transactions.filter(t => !["Closed", "Cancelled", "On Hold"].includes(t.status)).length,
  };
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh" }}>
      <div style={{ background: COLORS.navy, padding: "0 24px" }}>
        <div data-dash-header="" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 20, paddingBottom: 8 }}>
          <div data-dash-logo="" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: COLORS.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>T</span>
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>TransactPro</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Real Estate Transaction Management</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={onNew} style={{ background: "#C0392B", border: "none", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>+ New Transaction</button>
            <button onClick={() => onOpenContacts && onOpenContacts()} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>📇 Contacts</button>
            <button onClick={() => onOpenExpenses && onOpenExpenses()} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>💵 Expense Tracker</button>
            <WinTheDayButton token={localStorage.getItem("tp_token") || ""} />
            <PersonalTaskAddButton token={localStorage.getItem("tp_token") || ""} />
            <button onClick={onVendors} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.88)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>🏆 Vendors</button>
            <button onClick={onIntakeLinks} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.88)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>🔗 My Intake Links</button>
            <button onClick={onOpenContractIntake} style={{ background: "#1E8449", border: "1px solid rgba(255,255,255,0.22)", color: "#ffffff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>📄 Upload Contract</button>
            <SettingsMenu
              currentUser={currentUser}
              onOpenContactBook={onOpenContactBook}
              contactCount={contactCount}
              onReports={onReports}
              onAgentProfile={onAgentProfile}
              onOpenComplianceDash={onOpenComplianceDash}
              onOpenCompliance={onOpenCompliance}
              onOpenTaskTmpls={onOpenTaskTmpls}
              onCompanySettings={onCompanySettings}
              onOpenForms={onOpenForms}
              onChangePassword={onChangePassword}
            />
            <TenantSwitcher currentUser={currentUser} />
            <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.88)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>Sign Out</button>
          </div>
        </div>
        <div data-stats-bar="" style={{ display: "flex", marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {(() => { const s = dashStats || stats; return [["Active Listings", s.active, COLORS.gold, null], ["Under Contract", s.underContract, "#93C5FD", null], ["Closing This Month", s.closingSoon, s.closingSoon > 0 ? "#FDE68A" : "rgba(255,255,255,0.4)", null], ["Volume", `$${((s.totalVolume || 0) / 1000000).toFixed(2)}M`, COLORS.gold, null], ["Pending Commission", `$${Math.round(s.pendingCommissionGross || 0).toLocaleString()}`, "#FDBA74", null], ["Closed", s.closed, "#6EE7B7", null], ["Closed Commission", s.totalCommission > 0 ? `$${Math.round(s.totalCommission).toLocaleString()}` : "$0", "#6EE7B7", null]]; })().map(([label, value, color, onClick]) => (
            <div key={label} onClick={onClick} style={{ padding: "12px 20px", flex: 1, cursor: onClick ? "pointer" : "default" }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}{onClick && " ↗"}</div>
              <div style={{ color, fontSize: 22, fontWeight: 800, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      {showSaveViewModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => !saveViewLoading && setShowSaveViewModal(false)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy, marginBottom: 6 }}>💾 Save Current View</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>Save your current filters, sort, and view mode so you can come back to it with one click.</div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>View name</label>
            <input autoFocus value={saveViewName} onChange={e => setSaveViewName(e.target.value)} maxLength={100} placeholder="e.g. My Active Listings" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", marginBottom: 16, boxSizing: "border-box" }} onKeyDown={e => { if (e.key === "Enter") handleSaveView(); }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text, marginBottom: 20, cursor: "pointer" }}>
              <input type="checkbox" checked={saveViewAsDefault} onChange={e => setSaveViewAsDefault(e.target.checked)} />
              <span>Set as my default view (auto-loads when I open the app)</span>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowSaveViewModal(false)} disabled={saveViewLoading} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.text, fontSize: 13, fontWeight: 600, cursor: saveViewLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saveViewLoading ? 0.5 : 1 }}>Cancel</button>
              <button onClick={handleSaveView} disabled={saveViewLoading || !saveViewName.trim()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: COLORS.navy, color: "#fff", fontSize: 13, fontWeight: 600, cursor: (saveViewLoading || !saveViewName.trim()) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (saveViewLoading || !saveViewName.trim()) ? 0.5 : 1 }}>{saveViewLoading ? "Saving…" : "Save View"}</button>
            </div>
          </div>
        </div>
      )}
      <div data-toolbar="" style={{ background: "#fff", borderBottom: `1px solid ${COLORS.border}`, padding: "12px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search address, city, MLS #..." style={{ flex: 1, maxWidth: 340, padding: "8px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit" }} />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
            background: "#fff", color: "#111", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", minWidth: 160 }}>
          <option value="All">All Active</option>
          <option value="Active">Active Only</option>
          <option value="Under Contract">Under Contract</option>
          <option value="Closed">Closed Only</option>
          <option value="On Hold">On Hold</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, position: "relative" }}>
          <button onClick={() => setShowViewsMenu(v => !v)} title="My saved views" style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.text, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>📋 Views {savedViews.length > 0 && <span style={{ background: COLORS.bg, color: COLORS.muted, borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{savedViews.length}</span>} <span style={{ fontSize: 9 }}>▾</span></button>
          {showViewsMenu && (
            <>
              <div onClick={() => setShowViewsMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", minWidth: 280, maxWidth: 360, zIndex: 101, maxHeight: 400, overflowY: "auto" }}>
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`, fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>My Saved Views</div>
                {savedViews.length === 0 ? (
                  <div style={{ padding: "20px 14px", textAlign: "center", color: COLORS.muted, fontSize: 13 }}>No saved views yet.<br/><span style={{ fontSize: 11 }}>Click 💾 Save to create one.</span></div>
                ) : (
                  savedViews.map(v => (
                    <div key={v.id} onClick={() => applyView(v)} style={{ padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.bg}
                      onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, display: "flex", alignItems: "center", gap: 6 }}>
                          {v.isDefault && <span title="Default view" style={{ color: COLORS.gold, fontSize: 12 }}>★</span>}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</span>
                        </div>
                      </div>
                      <button onClick={(e) => handleToggleDefault(v.id, v.isDefault, e)} title={v.isDefault ? "Unset as default" : "Set as default"} style={{ background: "none", border: "none", cursor: "pointer", color: v.isDefault ? COLORS.gold : COLORS.muted, fontSize: 14, padding: 4 }}>{v.isDefault ? "★" : "☆"}</button>
                      <button onClick={(e) => handleDeleteView(v.id, e)} title="Delete view" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, fontSize: 14, padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = COLORS.danger} onMouseLeave={e => e.currentTarget.style.color = COLORS.muted}>×</button>
                    </div>
                  ))
                )}
                <div onClick={() => { setShowViewsMenu(false); setShowSaveViewModal(true); }} style={{ padding: "12px 14px", borderTop: `1px solid ${COLORS.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: COLORS.navy, background: "#FAFAFA" }}
                  onMouseEnter={e => e.currentTarget.style.background = COLORS.bg}
                  onMouseLeave={e => e.currentTarget.style.background = "#FAFAFA"}>
                  <span style={{ fontSize: 14 }}>+</span>
                  <span>Save current as new view</span>
                </div>
              </div>
            </>
          )}
        </div>
        <button data-filter-btn="" onClick={() => setShowFilters(true)} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${activeFilterCount > 0 ? COLORS.navy : COLORS.border}`, background: activeFilterCount > 0 ? COLORS.navy : "#fff", color: activeFilterCount > 0 ? "#fff" : COLORS.text, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
          <span>⚙ Filters</span>
          {activeFilterCount > 0 && <span style={{ background: "#fff", color: COLORS.navy, borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{activeFilterCount}</span>}
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Sort:</span>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "#fff", fontSize: 12, fontWeight: 600, color: COLORS.navy, cursor: "pointer", fontFamily: "inherit" }}>
            <option value="closingDate">Closing Date</option>
            <option value="openDate">Open Date</option>
            <option value="address">Address</option>
            <option value="status">Status</option>
            <option value="price">Price</option>
            <option value="progress">Progress</option>
          </select>
          <button onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")} title={sortDir === "asc" ? "Ascending" : "Descending"} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.navy, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minWidth: 36 }}>{sortDir === "asc" ? "↑" : "↓"}</button>
        </div>
        <div style={{ display: "flex", gap: 4, background: COLORS.bg, borderRadius: 8, padding: 3, border: `1px solid ${COLORS.border}` }}>
          <button onClick={() => setViewMode("cards")} title="Card view" style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: viewMode === "cards" ? COLORS.navy : "transparent", color: viewMode === "cards" ? "#fff" : COLORS.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>▦ Cards</button>
          <button onClick={() => setViewMode("list")} title="List view" style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: viewMode === "list" ? COLORS.navy : "transparent", color: viewMode === "list" ? "#fff" : COLORS.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>☰ List</button>
          <button onClick={() => setViewMode("kanban")} title="Kanban / Pipeline view" style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: viewMode === "kanban" ? COLORS.navy : "transparent", color: viewMode === "kanban" ? "#fff" : COLORS.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>⋮⋮ Pipeline</button>
        </div>
      </div>
      {activeFilterCount > 0 && (
        <div style={{ background: "#fff", borderBottom: `1px solid ${COLORS.border}`, padding: "8px 24px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Filters:</span>
          {agentFilter && (() => {
            const a = agentList.find(x => x.id === agentFilter);
            const label = a ? `${a.first_name} ${a.last_name}` : "Agent";
            return <span style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>Agent: {label}<button onClick={() => setAgentFilter("")} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button></span>;
          })()}
          {(closingFrom || closingTo) && (
            <span style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
              {datePreset && datePreset !== "custom" ? (datePreset === "thisWeek" ? "This Week" : datePreset === "thisMonth" ? "This Month" : "Next 30 Days") : (closingFrom || "...") + " → " + (closingTo || "...")}
              <button onClick={() => { setDatePreset(""); setClosingFrom(""); setClosingTo(""); }} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          )}
          {propTypeFilter && (
            <span style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>{propTypeFilter}<button onClick={() => setPropTypeFilter("")} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button></span>
          )}
          {txTypeFilter && (
            <span style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "3px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>{txTypeFilter}<button onClick={() => setTxTypeFilter("")} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button></span>
          )}
          <button onClick={clearAllFilters} style={{ marginLeft: "auto", background: "none", border: "none", color: COLORS.danger, fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em" }}>Clear all</button>
        </div>
      )}
      {viewMode === "list" ? (
        <TransactionListView transactions={hydratedPagedTxs} sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} onSelect={onSelect} />
      ) : viewMode === "kanban" ? (
        <PipelineBoard transactions={transactions.filter(t => t.status !== "Cancelled")} onSelect={onSelect} />
      ) : (
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }} data-tx-grid="">
        {hydratedPagedTxs.map(tx => {
          const completed = (tx.tasks || []).filter(t => t.status === "Completed").length;
          const overdue = (tx.tasks || []).filter(t => { const d = daysUntil(t.dueDate); return d !== null && d < 0 && t.status !== "Completed" && t.status !== "Waived"; }).length;
          const dtc = daysUntil(tx.closingDate);
          const progress = (tx.tasks || []).length > 0 ? Math.round(completed / tx.tasks.length * 100) : 0;
          const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG["Active"];
          const smsMsgCount = Object.values(tx.smsThreads || {}).reduce((a, t) => a + t.length, 0);
          return (
            <div key={tx.id} onClick={() => onSelect(tx.id)} style={{ background: "#fff", border: !tx.assignedAgentId ? "3px solid #f59e0b" : tx.needsReview ? "3px solid #2563eb" : tx.needsFirstContact ? "3px solid #c8102e" : `1px solid ${COLORS.border}`, borderRadius: 12, cursor: "pointer", overflow: "hidden" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
              {!tx.assignedAgentId && (
                <div style={{ background: "#f59e0b", color: "white", padding: "8px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                  ⚠️ UNASSIGNED LEAD — Tap to Assign an Agent
                </div>
              )}
              {tx.assignedAgentId && tx.needsReview && (
                <div style={{ background: "#2563eb", color: "white", padding: "8px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                  📋 NEW FROM CONTRACT — Review & Verify Details
                </div>
              )}
              {tx.assignedAgentId && !tx.needsReview && tx.needsFirstContact && (
                <div style={{ background: "#c8102e", color: "white", padding: "8px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                  🔔 NEW BUYER INQUIRY — Contact Within 24hrs
                </div>
              )}
              {/* Card Header - Color coded by type */}
              <div style={{
                background: tx.type === "Buyer Representation" ? "#0F2744" : "#1A1A1A",
                padding: "14px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                borderLeft: `5px solid ${tx.type === "Buyer Representation" ? "#3B82F6" : "#C0392B"}`
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{tx.type === "Buyer Representation" ? "🏡" : "🏠"}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                      color: tx.type === "Buyer Representation" ? "#60A5FA" : "#F87171",
                      background: tx.type === "Buyer Representation" ? "rgba(59,130,246,0.15)" : "rgba(192,57,43,0.15)",
                      padding: "2px 8px", borderRadius: 20
                    }}>
                      {tx.type === "Buyer Representation" ? "Buyer" : tx.type === "Dual Agency" ? "Dual" : "Listing"}
                    </span>
                    <Badge label={tx.status} color={cfg.color} bg={cfg.bg} />
                  </div>
                  <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 15, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.address}</div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{tx.city}, FL · {tx.county} County</div>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: "14px 16px", background: "#fff" }}>

                {/* Price + Closing row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                      {tx.contractPrice ? "Contract Price" : "List Price"}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>
                      {tx.contractPrice ? `$${Number(tx.contractPrice).toLocaleString()}` : tx.listPrice ? `$${Number(tx.listPrice).toLocaleString()}` : "TBD"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Closing</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: dtc !== null && dtc <= 7 && dtc >= 0 ? "#C0392B" : "#111" }}>
                      {tx.closingDate ? formatDate(tx.closingDate) : "TBD"}
                    </div>
                    {dtc !== null && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: dtc < 0 ? "#C0392B" : dtc <= 14 ? "#B7770D" : "#888", marginTop: 1 }}>
                        {dtc < 0 ? `${Math.abs(dtc)}d past` : dtc === 0 ? "Today!" : `${dtc}d away`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Notification badges */}
                {(smsMsgCount > 0 || unreadCounts[tx.id] > 0) && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {smsMsgCount > 0 && <Badge label={`${smsMsgCount} SMS`} color={COLORS.success} bg={COLORS.successBg} />}
                    {unreadCounts[tx.id] > 0 && (
                      <span onClick={e => { e.stopPropagation(); onSelect(tx.id, "chat"); }} style={{ cursor: "pointer" }}>
                        <Badge label={`💬 ${unreadCounts[tx.id]} new`} color="#fff" bg="#C0392B" />
                      </span>
                    )}
                  </div>
                )}

                {/* Progress */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, color: "#555" }}>Progress: {completed}/{tx.tasks.length} tasks</span>
                    <span style={{ fontWeight: 800, color: progress === 100 ? "#1E8449" : progress > 50 ? "#B7770D" : "#555" }}>{progress}%</span>
                  </div>
                  <div style={{ height: 7, background: "#E5E7EB", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${progress}%`,
                      background: progress === 100 ? "#1E8449" : tx.type === "Buyer Representation" ? "#3B82F6" : "#C0392B",
                      borderRadius: 4, transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    {["Contract", "Inspection", "Title", "Closing"].map((milestone) => {
                      const milestoneTasks = tx.tasks.filter(t => t.category === milestone);
                      const milestoneCompleted = milestoneTasks.filter(t => t.status === "Completed").length;
                      const milestoneProgress = milestoneTasks.length > 0 ? milestoneCompleted / milestoneTasks.length : 0;
                      const isDone = milestoneProgress === 1 && milestoneTasks.length > 0;
                      const isStarted = milestoneProgress > 0;
                      const dotColor = isDone ? "#1E8449" : isStarted ? (tx.type === "Buyer Representation" ? "#3B82F6" : "#C0392B") : "#D1D5DB";
                      return (
                        <div key={milestone} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                          <div style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor, marginBottom: 3 }} />
                          <span style={{ fontSize: 9, color: isDone ? "#1E8449" : "#999", fontWeight: isDone ? 700 : 400 }}>{milestone}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #F3F4F6" }}>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {tx.parties.length} {tx.parties.length === 1 ? "party" : "parties"}
                  </div>
                  {overdue > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#C0392B", padding: "2px 10px", borderRadius: 20 }}>
                      ⚠️ {overdue} overdue
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {hydratedPagedTxs.length === 0 && !pagedLoading && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: COLORS.muted }}><div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div><div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy, marginBottom: 6 }}>No transactions found</div><div>Click "+ New Transaction" to get started.</div></div>}
      </div>
      )}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {pagedLoading && <div style={{ textAlign: "center", padding: 16, color: COLORS.muted, fontSize: 13 }}>Loading…</div>}
      {!pagedHasMore && hydratedPagedTxs.length > 0 && pagedTotal > 0 && <div style={{ textAlign: "center", padding: 16, color: COLORS.muted, fontSize: 12 }}>Showing all {pagedTotal} transactions</div>}

      {showFilters && (
        <Modal title="Filter Transactions" onClose={() => setShowFilters(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Assigned Agent</label>
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", background: "#fff" }}>
                <option value="">All agents</option>
                {agentList.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Closing Date</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {[{k:"thisWeek",l:"This Week"},{k:"thisMonth",l:"This Month"},{k:"next30",l:"Next 30 Days"},{k:"custom",l:"Custom"}].map(p => (
                  <button key={p.k} onClick={() => setDatePreset(p.k)} style={{ padding: "6px 12px", borderRadius: 16, border: `1px solid ${datePreset === p.k ? COLORS.navy : COLORS.border}`, background: datePreset === p.k ? COLORS.navy : "#fff", color: datePreset === p.k ? "#fff" : COLORS.text, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{p.l}</button>
                ))}
                {(datePreset || closingFrom || closingTo) && <button onClick={() => { setDatePreset(""); setClosingFrom(""); setClosingTo(""); }} style={{ padding: "6px 12px", borderRadius: 16, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.danger, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>× Clear</button>}
              </div>
              {datePreset === "custom" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input type="date" value={closingFrom} onChange={e => setClosingFrom(e.target.value)} placeholder="From" style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit" }} />
                  <input type="date" value={closingTo} onChange={e => setClosingTo(e.target.value)} placeholder="To" style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit" }} />
                </div>
              )}
              {datePreset && datePreset !== "custom" && (closingFrom || closingTo) && (
                <div style={{ fontSize: 12, color: COLORS.muted }}>{closingFrom} → {closingTo}</div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Property Type</label>
              <select value={propTypeFilter} onChange={e => setPropTypeFilter(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", background: "#fff" }}>
                <option value="">All property types</option>
                {PROPERTY_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Transaction Type</label>
              <select value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", background: "#fff" }}>
                <option value="">All transaction types</option>
                {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 8, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
              <Btn variant="ghost" onClick={() => { clearAllFilters(); }}>Clear All</Btn>
              <Btn onClick={() => setShowFilters(false)}>Apply</Btn>
            </div>
          </div>
        </Modal>
      )}
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

function TenantSwitcher({ currentUser }) {
  const [open, setOpen] = useState(false);
  const memberships = currentUser?.memberships || [];
  const activeId = currentUser?.tenantId;
  if (memberships.length < 2) return null;
  const active = memberships.find(m => m.tenantId === activeId) || memberships[0];

  const switchTo = async (tenantId) => {
    if (tenantId === activeId) { setOpen(false); return; }
    const tok = localStorage.getItem("tp_token") || "";
    try {
      const res = await fetch(API + "/auth/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
        body: JSON.stringify({ tenantId })
      });
      const data = await res.json();
      if (!data.success) { alert("Could not switch: " + (data.error || "Unknown error")); return; }
      localStorage.setItem("tp_token", data.token);
      localStorage.setItem("tp_user", JSON.stringify(data.user));
      window.location.reload();
    } catch (e) { alert("Switch failed: " + e.message); }
  };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
        🏢 {active?.tenantName || "Brokerage"} <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #DDD", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", minWidth: 240, zIndex: 999, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", fontSize: 11, color: "#888", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #EEE" }}>Switch Brokerage</div>
            {memberships.map(m => {
              const isActive = m.tenantId === activeId;
              return (
                <div key={m.tenantId} onClick={() => switchTo(m.tenantId)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: isActive ? "#F4F6F8" : "#fff", borderBottom: "1px solid #F4F6F8" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{m.tenantName}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{m.role}</div>
                  </div>
                  {isActive && <span style={{ color: "#1E8449", fontSize: 14 }}>✓</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MainApp({ onLogout, currentUser }) {
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [initialDetailTab, setInitialDetailTab] = useState("overview");
  const token = localStorage.getItem("tp_token") || "";
  const authHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

  // Poll unread chat counts every 15s across the whole app (not just dashboard)
  const prevTotalRef = useRef(null);
  const audioCtxRef = useRef(null);
  useEffect(() => {
    // Unlock audio on first user interaction (required by Chrome/Safari autoplay policy)
    const unlockAudio = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume();
        }
      } catch {}
    };
    document.addEventListener("click", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
    };
  }, []);
  useEffect(() => {
    let stopped = false;
    const playDashboardAlert = () => {
      try {
        const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      } catch {}
    };
    const fetchCounts = async () => {
      try {
        const res = await fetch(`${API}/chat/unread/counts`, { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        if (stopped || !data.success) return;
        const counts = data.counts || {};
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        if (prevTotalRef.current !== null && total > prevTotalRef.current) playDashboardAlert();
        prevTotalRef.current = total;
        setUnreadCounts(counts);
      } catch {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => { stopped = true; clearInterval(interval); };
  }, [token]);

  // Mark a transaction as read (call when user opens chat for that tx)
  const markChatRead = async (transactionId) => {
    setUnreadCounts(prev => { const n = { ...prev }; delete n[transactionId]; return n; });
    try {
      await fetch(`${API}/chat/${transactionId}/mark-read`, { method: "POST", headers: { "Authorization": `Bearer ${token}` } });
    } catch {}
  };

  // Load transactions from database on mount
  useEffect(() => {
    fetch(`${API}/transactions`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        if (data.transactions) {
          // Normalize DB format to app format
          const rawTxs = data.transactions.map(t => ({
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
            owningTenantId: t.tenant_id,
            owningBrokerageName: t.brokerage_name,
            owningBrokerageColor: t.brokerage_color,
            messages: t.internal_notes || [],
            parties: (t.parties || []).filter(Boolean).map(p => ({ id: p.id, role: p.role, name: p.name, email: p.email, phone: p.phone, company: p.company, isVendor: p.isVendor || false, vendorStatus: p.vendorStatus || null, vendorCategory: p.vendorCategory || null, vendorDescription: p.vendorDescription || null })),
            tasks: (t.tasks || []).filter(Boolean).map(tk => ({ id: tk.id, name: tk.name, status: tk.status, dueDate: tk.dueDate, category: tk.category, assignTo: tk.assignTo })),
            reminders: (t.reminders || []).filter(Boolean).map(r => ({ id: r.id, title: r.title, date: r.date, message: r.message, channels: r.channels, parties: r.parties || [], sent: r.sent })),
            needsFirstContact: t.needs_first_contact || false,
            submittedVia: t.submitted_via || null,
            intakeStepsDone: t.intake_steps_done || [],
            needsReview: t.needs_review || false,
            reviewReason: t.review_reason || null,
            additionalTerms: t.additional_terms || null,
            reviewStepsDone: t.review_steps_done || [],
            earnestMoneyAmount: t.earnest_money_amount || "",
            emdDeadline: t.emd_deadline || "",
            inspectionPeriodDays: t.inspection_period_days || "",
            inspectionPeriodEnd: t.inspection_period_end || "",
            financingContingency: t.financing_contingency || false,
            financingContingencyDays: t.financing_contingency_days || "",
            appraisalContingency: t.appraisal_contingency || false,
            appraisalContingencyDays: t.appraisal_contingency_days || "",
            hoaApprovalRequired: t.hoa_approval_required || false,
            hoaApprovalDays: t.hoa_approval_days || "",
            surveyRequired: t.survey_required || false,
            isCash: t.is_cash || false,
            contractFormType: t.contract_form_type || "",
            occupancyStatus: t.occupancy_status || "",
          }));
          // Pin buyer/seller intake transactions needing first contact to top
          const sorted = [...rawTxs].sort((a, b) => {
            const aNew = a.needsFirstContact ? 1 : 0;
            const bNew = b.needsFirstContact ? 1 : 0;
            return bNew - aNew;
          });
          setTransactions(sorted);
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
  const [view, setView] = useState("home");
  const [showReports, setShowReports] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [showTeam, setShowTeam] = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);
  const [showTaskTmpls, setShowTaskTmpls] = useState(false);
  const [showContractIntake, setShowContractIntake] = useState(false);
  const [showComplianceDash, setShowComplianceDash] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [forcePasswordReset, setForcePasswordReset] = useState(false);
  const [showCompanySettings, setShowCompanySettings] = useState(false);
  const [showAgentProfile, setShowAgentProfile] = useState(false);
  const [showIntakeLinks, setShowIntakeLinks] = useState(false);
  const [showContactBook, setShowContactBook] = useState(false);
  const [showVendorLibrary, setShowVendorLibrary] = useState(false);
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
    try { const r = await fetch(API + "/transactions/" + updated.id, { method: "PUT", headers: freshH, body: JSON.stringify({ address: updated.address, city: updated.city, state: updated.state, zipCode: updated.zipCode, county: updated.county, mlsNumber: updated.mlsNumber, propertyType: updated.propertyType, type: updated.type, status: updated.status, listPrice: updated.listPrice, contractPrice: updated.contractPrice, openDate: updated.openDate, closingDate: updated.closingDate, executedDate: updated.executedDate, notes: updated.notes, propertyAccess: updated.propertyAccess, commissionListing: updated.commissionListing, commissionBuyer: updated.commissionBuyer, transactionFee: updated.transactionFee, brokerageSplit: updated.brokerageSplit, officeFlatFee: updated.officeFlatFee, mailAway: updated.mailAway, commissionNotes: updated.commissionNotes, referralSource: updated.referralSource, assignedAgent: updated.assignedAgentId, occupancyStatus: updated.occupancyStatus, earnestMoneyAmount: updated.earnestMoneyAmount, emdDeadline: updated.emdDeadline, inspectionPeriodDays: updated.inspectionPeriodDays, inspectionPeriodEnd: updated.inspectionPeriodEnd, financingContingency: updated.financingContingency, financingContingencyDays: updated.financingContingencyDays, appraisalContingency: updated.appraisalContingency, appraisalContingencyDays: updated.appraisalContingencyDays, hoaApprovalRequired: updated.hoaApprovalRequired, hoaApprovalDays: updated.hoaApprovalDays, surveyRequired: updated.surveyRequired, isCash: updated.isCash, contractFormType: updated.contractFormType, additionalTerms: updated.additionalTerms, internalNotes: updated.messages || [], smsThreads: updated.smsThreads || {}, parties: updated.parties || [], tasks: updated.tasks || [], reminders: updated.reminders || [] }) }); if (!r.ok) { const e = await r.json(); console.error("Save error:", e); } } catch(e) { console.error("Save failed:", e); }
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
          role: ["Transaction Coordinator", "Listing Agent", "Buyer's Agent", "Co-Agent"].includes(party.role) ? "agent" : "client",
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
      if (res.ok && data.existing) {
        alert(party.email + " already has an account. They've been added to your brokerage and notified by email.");
      } else if (res.ok) {
        alert("Invitation sent to " + party.email + "! They will receive an email with portal access and transaction details.");
      } else if (data.error === "Email already registered") {
        alert(party.email + " is already registered. They've been notified.");
      } else {
        alert("Failed: " + (data.error || "Unknown error"));
      }
    } catch (e) { alert("Error: " + e.message); }
  };

  const openTransactionMilestones = (txId) => {
    const t = transactions.find(t => t.id === txId);
    if (t) { setSelectedId(txId); setInitialDetailTab("milestones"); setView("detail"); }
  };

  // Public upload route — no auth required
  if (window.location.pathname.startsWith("/form-download/")) {
    const token = window.location.pathname.split("/form-download/")[1];
    return <FormDownloadPage token={token} />;
  }
  if (window.location.pathname.startsWith("/upload-contract/")) {
    const token = window.location.pathname.split("/upload-contract/")[1];
    return <ContractUploadPublic urlToken={token} />;
  }

  return (
    <>
      {showReports && <Reports transactions={transactions} onBack={() => setShowReports(false)} />}
      
      {!showReports && view === "new" && <NewTransactionForm onSave={addTransaction} onCancel={() => setView("home")} />}
      {!showReports && !showCalendar && view === "detail" && selectedTx && (
        <TransactionDetail
          initialTab={initialDetailTab}
          dashboardUnread={unreadCounts[selectedId] || 0}
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
      {!showReports && view === "home" && (
        <DailyDashboard
          token={localStorage.getItem("tp_token") || ""}
          user={currentUser}
          onViewTransactions={() => setView("dashboard")}
          onOpenTransactionMilestones={openTransactionMilestones}
        />
      )}
      {!showReports && !showCalendar && view === "dashboard" && (
        <Dashboard
          transactions={transactions}
          unreadCounts={unreadCounts}
          onSelect={(id, tab) => { setSelectedId(id); setInitialDetailTab(tab || "overview"); setView("detail"); }}
          onNew={() => setView("new")}
          onOpenContactBook={() => openContactBook(null)}
          onOpenContacts={() => setView("contacts")} onOpenExpenses={() => setView("expenses")} onOpenForms={() => setView("forms")}
          contactCount={contacts.length}
          onLogout={onLogout}
          onOpenTeam={() => setShowTeam(true)}
          onOpenCompliance={() => setShowCompliance(true)}
          onOpenComplianceDash={() => setShowComplianceDash(true)}
          onOpenTaskTmpls={() => setShowTaskTmpls(true)}
          onOpenContractIntake={() => setShowContractIntake(true)}
          onChangePassword={() => setShowChangePassword(true)}
          onReports={() => setShowReports(true)}
          onCompanySettings={() => setShowCompanySettings(true)}
          onAgentProfile={() => setShowAgentProfile(true)}
          onIntakeLinks={() => setShowIntakeLinks(true)}
          currentUser={currentUser}
          onHome={() => setView("home")}
          onVendors={() => setShowVendorLibrary(true)}
        />
      )}
      {showTeam && <UserManagement onClose={() => setShowTeam(false)} />}
      {view === "expenses" && (
        <ExpensesPage onBack={() => setView("dashboard")} />
      )}
      {view === "forms" && (
        <FormsPage user={currentUser} onBack={() => setView("dashboard")} />
      )}
      {view === "contacts" && (
        <ContactsPage token={localStorage.getItem("tp_token") || ""} onBack={() => setView("dashboard")} />
      )}
      {showCompliance && (
        <div style={{ position:"fixed", inset:0, background:"#fff", zIndex:200, overflowY:"auto" }}>
          <div style={{ position:"sticky", top:0, background:"#fff", borderBottom:"1px solid #DDD", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, zIndex:1 }}>
            <button onClick={() => setShowCompliance(false)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer" }}>←</button>
            <div style={{ fontWeight:700, fontSize:16 }}>Compliance Admin</div>
          </div>
          <ComplianceAdmin token={localStorage.getItem("tp_token") || ""} user={currentUser} />
        </div>
      )}
      {showContractIntake && (
        <div style={{ position:"fixed", inset:0, background:"#fff", zIndex:200, overflowY:"auto" }}>
          <ContractAutoIntake
            token={localStorage.getItem("tp_token") || ""}
            user={currentUser}
            onBack={() => setShowContractIntake(false)}
            onApproved={(txId) => {
              setShowContractIntake(false);
              const t = transactions.find(t => t.id === txId);
              if (t) { setSelectedTx(t); setView("detail"); }
              else { window.location.reload(); }
            }}
          />
        </div>
      )}
      {showTaskTmpls && (
        <div style={{ position:"fixed", inset:0, background:"#fff", zIndex:200, overflowY:"auto" }}>
          <div style={{ position:"sticky", top:0, background:"#fff", borderBottom:"1px solid #DDD", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, zIndex:1 }}>
            <button onClick={() => setShowTaskTmpls(false)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer" }}>←</button>
            <div style={{ fontWeight:700, fontSize:16 }}>Task Templates</div>
          </div>
          <TaskTemplatesAdmin token={localStorage.getItem("tp_token") || ""} />
        </div>
      )}
      {showComplianceDash && (
        <div style={{ position:"fixed", inset:0, background:"#fff", zIndex:200, overflowY:"auto" }}>
          <div style={{ position:"sticky", top:0, background:"#fff", borderBottom:"1px solid #DDD", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, zIndex:1 }}>
            <button onClick={() => setShowComplianceDash(false)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer" }}>←</button>
            <div style={{ fontWeight:700, fontSize:16 }}>Compliance Dashboard</div>
          </div>
          <ComplianceDashboard
            token={localStorage.getItem("tp_token") || ""}
            onOpenTransaction={(txId) => {
              const t = transactions.find(t => t.id === txId);
              if (t) { setShowComplianceDash(false); setSelectedTx(t); setView("detail"); }
            }}
          />
        </div>
      )}

      {showChangePassword && <ChangePassword onClose={() => setShowChangePassword(false)} />}
      {forcePasswordReset && <ChangePassword forceReset onClose={() => setForcePasswordReset(false)} />}
      {showCompanySettings && <CompanySettings onClose={() => setShowCompanySettings(false)} onChangePassword={() => { setShowCompanySettings(false); setShowChangePassword(true); }} />}
      {showAgentProfile && <AgentProfile currentUser={currentUser} onClose={() => setShowAgentProfile(false)} />}
      {showIntakeLinks && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 500, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ background: "#111", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>🔗 Your Intake Form Links</div>
              <button onClick={() => setShowIntakeLinks(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer" }}>x</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>Share these links with clients. The form automatically creates a transaction in your account.</p>
              {[{ label: "🏠 Seller Intake Form", type: "seller", color: "#C0392B" }, { label: "🏡 Buyer Intake Form", type: "buyer", color: "#1A5276" }].map(({ label, type, color }) => {
                const slug = currentUser?.slug || "";
                const url = window.location.origin + "/" + type + ".html?agent=" + slug + "&uid=" + (currentUser?.id || "");
                return (
                  <div key={type} style={{ marginBottom: 16, padding: 16, background: "#F8F9FA", borderRadius: 10, border: "1px solid #EEE" }}>
                    <div style={{ fontWeight: 700, color, marginBottom: 8 }}>{label}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input readOnly value={url} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #DDD", fontSize: 12, fontFamily: "inherit", background: "#fff" }} onClick={e => e.target.select()} />
                      <button onClick={() => { navigator.clipboard.writeText(url); alert("Link copied!"); }} style={{ padding: "8px 14px", background: color, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12, fontFamily: "inherit", whiteSpace: "nowrap" }}>Copy</button>
                    </div>
                    <button onClick={() => window.open(url, "_blank")} style={{ marginTop: 8, background: "none", border: "none", color, cursor: "pointer", fontSize: 12, fontFamily: "inherit", textDecoration: "underline" }}>Preview form</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showVendorLibrary && <VendorLibrary onClose={() => setShowVendorLibrary(false)} />}
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
    return (
      <>
        <ClientPortal user={authUser} onLogout={() => {
          localStorage.removeItem("tp_token");
          localStorage.removeItem("tp_user");
          setAuthUser(null);
        }} />
        <FaqHelpButton apiBase={API} token={localStorage.getItem("tp_token") || ""} />
      </>
    );
  }

  return (
    <>
      <MainApp currentUser={authUser} onLogout={() => {
        localStorage.removeItem("tp_token");
        localStorage.removeItem("tp_user");
        setAuthUser(null);
      }} />
      <FaqHelpButton apiBase={API} token={localStorage.getItem("tp_token") || ""} />
    </>
  );
}

export default AuthGate;
// deploy trigger Wed Apr 22 20:35:35 EDT 2026
// redeploy Thu Apr 23 14:43:56 EDT 2026
