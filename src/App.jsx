import LoginScreen from "./LoginScreen";
import BuyerCalculator from "./components/BuyerCalculator";
import PreApprovalCard, { PreApprovalBadge } from './components/PreApprovalCard';
import SellerCalculator from "./components/SellerCalculator";
import TxFormsTab from "./components/TxFormsTab";
import UserManagement from "./UserManagement";
import FormDownloadPage from './FormDownloadPage';
import ContractUploadPublic from "./ContractUploadPublic";
import TransactionChat from "./TransactionChat";
import DailyDashboard from "./DailyDashboard";
import CoordinatorCommandCenter from "./CoordinatorCommandCenter";
import UnreadMessagesInbox from "./UnreadMessagesInbox";
import { CoordinatorSummaryPanel } from "./AgentCoordinatorViews";
import ChangePassword from "./ChangePassword";
import LegalConsentGate from "./LegalConsentGate";
import FaqHelpButton from "./components/FaqHelpButton";
import HelpCenter from "./components/HelpCenter";
import OnboardingGuide from "./components/OnboardingGuide";
import AppTour from "./components/AppTour";
import SpotlightTour from "./components/SpotlightTour";

const API = "https://liz-team-server-api-production.up.railway.app";
// Platform developer account — only this email sees the Superuser Dashboard.
// Swap via VITE_SUPERUSER_EMAIL at build time; backend mirrors with SUPERUSER_EMAIL.
const SUPERUSER_EMAIL = ((import.meta.env && import.meta.env.VITE_SUPERUSER_EMAIL) || "cgarcia@thelizteam.com").toLowerCase();

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";

// ── Code-split heavy, route-level screens so the phone only downloads the
// ── code for the screen you actually open, instead of one giant bundle up front.
// ── These MUST come after the `lazy` import above (const declarations are not
// ── hoisted — placing them above it blanks the whole app in dev).
const CmaTool = lazy(() => import("./cma/CmaTool"));
const ContactsPage = lazy(() => import("./ContactsPage"));
const PopBysPage = lazy(() => import("./PopBysPage"));
const ScriptsPage = lazy(() => import("./ScriptsPage"));
const StandaloneCmaPage = lazy(() => import("./StandaloneCmaPage"));
const GrowthPlanPage = lazy(() => import("./GrowthPlanPage"));
const ExpensesPage = lazy(() => import('./ExpensesPage'));
const FormsPage = lazy(() => import('./FormsPage'));
const SuperuserDashboard = lazy(() => import('./SuperuserDashboard'));
const ComplianceAdmin = lazy(() => import("./ComplianceAdmin"));
const TaskTemplatesAdmin = lazy(() => import("./TaskTemplatesAdmin"));
const ContractAutoIntake = lazy(() => import("./ContractAutoIntake"));
const ComplianceDashboard = lazy(() => import("./ComplianceDashboard"));
const DocumentsTab = lazy(() => import("./DocumentsTab"));
// The spot editor is shared with the lease package (same chunk as DocumentsTab).
const AdjustSpotsModal = lazy(() => import("./DocumentsTab").then(m => ({ default: m.AdjustSpotsModal })));
const OffersTab = lazy(() => import("./OffersTab"));
const Reports = lazy(() => import("./Reports"));
const VendorLibrary = lazy(() => import("./VendorLibrary"));
const ShareVendorModalLazy = lazy(() => import("./VendorLibrary").then(m => ({ default: m.ShareVendorModal })));
const CompanySettings = lazy(() => import("./CompanySettings"));
const AgentProfile = lazy(() => import("./AgentProfile"));
const CalendarView = lazy(() => import("./CalendarView"));
const ClientPortal = lazy(() => import("./ClientPortal"));
const TCPortal = lazy(() => import("./TCPortal"));
const CoordinatorPanel = lazy(() => import("./CoordinatorPanel"));

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

// Fallback shown while a code-split screen's chunk downloads.
function LazyLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#888", fontSize: 14, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      Loading…
    </div>
  );
}

const TRANSACTION_TYPES = ["Listing (Seller)", "Buyer Representation", "Dual Agency", "Lease — Landlord", "Lease — Tenant"];
// Lease deals run their own milestone tracks but reuse the buyer/listing "side"
// model: a landlord lease is listing-side (own-side client = the owner, a seller
// role), a tenant lease is buyer-side (own-side client = the tenant, a buyer role).
const isLeaseType = (type) => type === "Lease — Landlord" || type === "Lease — Tenant";
const isBuyerSideType = (type) => type === "Buyer Representation" || type === "Dual Agency" || type === "Lease — Tenant";
// Lease term options + end-date math. A 12-month lease that begins on a date
// ends the day BEFORE that date a year later (e.g. 07/01/2026 → 06/30/2027).
const LEASE_TERMS = ["1 Year", "6 Months", "Month-to-Month", "Custom"];
function computeLeaseEnd(start, term) {
  if (!start) return "";
  const p = String(start).slice(0, 10).split("-");
  if (p.length !== 3) return "";
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  if (isNaN(d.getTime())) return "";
  if (term === "6 Months") d.setMonth(d.getMonth() + 6);
  else if (term === "1 Year") d.setFullYear(d.getFullYear() + 1);
  else return ""; // Month-to-Month / Custom → no fixed end
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Short label + icon for a transaction type, lease-aware.
const txTypeShort = (type) => type === "Lease — Landlord" ? "Rental — Landlord"
  : type === "Lease — Tenant" ? "Rental — Tenant"
  : type === "Buyer Representation" ? "Buyer" : "Listing";
const txTypeIcon = (type) => isLeaseType(type) ? "🔑" : type === "Buyer Representation" ? "🏡" : "🏠";
// The agent's CLIENT on a deal — the buyer (buyer-side) or seller (listing). Shown
// on every card under the address so it's obvious who the customer is. Excludes
// agents (a "Buyer's Agent" is not the buyer). Returns "" if none on file.
const clientNameForTx = (tx) => {
  const parties = (tx && tx.parties) || [];
  const type = (tx && (tx.type || tx.transactionType || tx.transaction_type)) || "";
  const want = isBuyerSideType(type) ? /buyer|tenant/i : /seller|landlord/i;
  const names = parties
    .filter(p => p && p.role && want.test(p.role) && !/agent/i.test(p.role))
    .map(p => (p.name || "").trim())
    .filter(Boolean);
  // de-dupe (same person listed twice) and join co-clients with " & "
  return [...new Set(names)].join(" & ");
};
const clientLabelForTx = (tx) => (isBuyerSideType(tx && (tx.type || tx.transactionType)) ? "Buyer" : "Seller");
const PROPERTY_TYPES = ["Single Family", "Condo/Townhouse", "Multi-Family", "Land", "Commercial"];
const REFERRAL_SOURCES = ["Past Client", "Referral", "Zillow", "Realtor.com", "Open House", "Sign Call", "Social Media", "Website", "Other"];
const OCCUPANCY_OPTIONS = ["Owner Occupied", "Tenant Occupied", "Vacant"];
const COUNTIES = ["Orange", "Osceola", "Seminole", "Polk", "Brevard", "Lake", "Volusia", "Hillsborough", "Other"];
const PARTY_ROLES = [
  "Listing Agent", "Buyer's Agent", "Transaction Coordinator",
  "Builder", "Title Company", "Loan Officer/Lender", "Inspector", "Appraiser",
  "HOA Manager", "Seller", "Buyer", "Attorney", "Insurance Agent", "Referral",
  "Photographer", "Handyman", "Plumber", "Electrician", "General Contractor",
  "Roofer", "HVAC", "Other"
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
    { name: "Change MLS Status from Active to Under Contract", phase: "contract", daysFromOpen: 0, category: "Contract", assignTo: "Listing Agent" },
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

// Property-type visual treatment. Residential is the norm, so it stays clean
// (no badge); the non-residential types — especially Commercial — get a badge
// and a distinct accent so they're never mistaken for a house. Used on the
// pipeline cards, the list/table rows, and the deal header. Matches on a regex
// so it tolerates the slightly different values the backend stores
// ("Commercial", "Vacant Land" vs "Land", "Lease" vs "Rental").
const COMMERCIAL_ACCENT = "#0E7490"; // teal — distinct from every status color
function propertyTypeBadge(tx) {
  // RENTAL is keyed off the TRANSACTION type (Lease — Landlord/Tenant), not the
  // property type — a rental of a single-family home is still a single-family
  // property. Takes precedence so every card/list/table view instantly reads as
  // a rental (purple) vs a resale listing. Side shown in the label.
  if (isLeaseType(tx?.type || tx?.transaction_type)) {
    const tenant = /tenant/i.test(tx?.type || tx?.transaction_type || "");
    return { label: tenant ? "🔑 RENTAL · Tenant" : "🔑 RENTAL · Landlord", color: "#6D28D9", bg: "#EDE9FE" };
  }
  // Match the backend's deal-"world" detection: read EITHER property type OR
  // construction type, so a deal marked commercial/land in just one field still
  // shows the right badge (and lines up with its commercial/land timeline + docs).
  const pt = `${tx?.propertyType || ""} ${tx?.constructionType || ""}`;
  if (/commercial/i.test(pt)) return { label: "🏢 Commercial", color: COMMERCIAL_ACCENT, bg: "#CFF6F8" };
  if (/vacant ?land|\bland\b/i.test(pt)) return { label: "🟩 Land", color: "#15803D", bg: "#DCFCE7" };
  if (/lease|rental/i.test(pt)) return { label: "🔑 Lease", color: "#6D28D9", bg: "#EDE9FE" };
  return null; // residential → no badge (keeps the common case uncluttered)
}
// Left-edge accent color so the property type is obvious at a glance in the
// card/list views (commercial teal, land green, lease purple). Residential →
// no accent. Kept in sync with the badge color above.
function propertyTypeAccent(tx) {
  const b = propertyTypeBadge(tx);
  return b ? b.color : null;
}

const TASK_STATUS = {
  "Pending": { color: COLORS.muted, bg: "#F3F4F6" },
  "In Progress": { color: COLORS.info, bg: COLORS.infoBg },
  "Completed": { color: COLORS.success, bg: COLORS.successBg },
  "Overdue": { color: COLORS.danger, bg: COLORS.dangerBg },
  "Waived": { color: COLORS.muted, bg: "#F3F4F6" },
};

// ===== Pipeline View (read-only) =====
// Columns are DERIVED from the timeline, not the manual status: contract-phase
// deals sort by what work is still OPEN (inspection → financing → clear-to-close),
// and Active splits for-sale listings from buyer searches. "Under Contract" stays
// only for deals with no timeline yet.
const PIPELINE_COLUMNS = ["Active Listings", "Buyer Searches", "Under Contract", "Inspection", "Financing / Appraisal", "Clear to Close", "Closed"];
const PIPELINE_COLUMN_STYLE = {
  "Active Listings": "Active", "Buyer Searches": "Active", "Financing / Appraisal": "Appraisal",
};
function pipelineStageFor(t) {
  const st = t.status;
  if (st === "Active" || st === "New") {
    const type = t.type || t.transactionType || "";
    return (/buyer/i.test(type) && !/listing|seller|dual/i.test(type)) ? "Buyer Searches" : "Active Listings";
  }
  if (["Under Contract", "Inspection", "Appraisal", "Clear to Close"].includes(st)) {
    const ms = t.milestoneSummary || {};
    if (!ms.total) return "Under Contract";                       // no timeline yet
    if ((ms.openInspection || 0) > 0) return "Inspection";
    if ((ms.openFinancing || 0) > 0) return "Financing / Appraisal";
    return "Clear to Close";                                      // all gates done or N/A
  }
  return st; // Closed (Cancelled filtered out upstream)
}

function PipelineCard({ tx, onSelect }) {
  // Progress reflects the Auto-TC timeline (milestones) ONLY. The legacy tasks
  // table is a separate system that "clear timeline" doesn't touch — using it as
  // a fallback showed stale progress that never reset. No timeline = no bar.
  const ms = tx.milestoneSummary;
  const completed = ms ? (ms.done || 0) : 0;
  const total = ms ? (ms.total || 0) : 0;
  const progress = total > 0 ? Math.round(completed / total * 100) : 0;
  const overdue = ms ? (ms.overdue || 0) : 0;
  const dtc = daysUntil(tx.closingDate);
  const price = tx.contractPrice || tx.listPrice;
  // Deal health light: red = overdue items; yellow = closing within a week or no due date set; green = on track.
  const health = overdue > 0 ? { c: "#C0392B", t: "Needs attention" }
    : (dtc !== null && dtc >= 0 && dtc < 7) ? { c: "#E0A800", t: "Closing soon" }
    : { c: "#1E8449", t: "On track" };
  const next = tx.nextMilestone;
  return (
    <div onClick={() => onSelect(tx.id)} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderLeft: propertyTypeAccent(tx) ? `4px solid ${propertyTypeAccent(tx)}` : `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, marginBottom: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", cursor: "pointer" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span title={health.t} style={{ width: 9, height: 9, borderRadius: "50%", background: health.c, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 14 }}>{txTypeIcon(tx.type)}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{txTypeShort(tx.type)}</span>
        {propertyTypeBadge(tx) && <span title={`${propertyTypeBadge(tx).label.replace(/^\S+\s/, "")} property`} style={{ background: propertyTypeBadge(tx).bg, color: propertyTypeBadge(tx).color, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8 }}>{propertyTypeBadge(tx).label}</span>}
        {tx.constructionType === "New Construction" && <span title="New Construction" style={{ background: "#FEF9E7", color: "#B7770D", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8 }}>🏗️ NC</span>}
        {overdue > 0 && tx.status !== "Closed" && <span title={`${overdue} overdue item(s)`} style={{ marginLeft: "auto", background: COLORS.dangerBg, color: COLORS.danger, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8 }}>⚠ {overdue}</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.navy, marginBottom: 2, lineHeight: 1.3 }}>{tx.address}</div>
      {clientNameForTx(tx) && <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.text, marginBottom: 1 }}>👤 {clientLabelForTx(tx)}: {clientNameForTx(tx)}</div>}
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>{tx.city}, FL</div>
      {price && <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginBottom: 4 }}>${Number(price).toLocaleString()}</div>}
      {tx.closingDate && <div style={{ fontSize: 11, color: dtc !== null && dtc < 7 && dtc >= 0 ? COLORS.danger : COLORS.muted, marginBottom: 6 }}>📅 {formatDate(tx.closingDate)}{dtc !== null ? ` (${dtc < 0 ? "past" : dtc + "d"})` : ""}</div>}
      {next && next.name && tx.status !== "Closed" && (
        <div style={{ fontSize: 11, color: COLORS.navy, marginBottom: 6, background: "#F8FAFC", borderRadius: 6, padding: "4px 8px" }} title="Next action on this deal">
          ⏭️ <b>Next:</b> {next.name}{next.dueDate ? ` · ${formatDate(next.dueDate)}` : ""}
        </div>
      )}
      {total > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ height: 4, background: COLORS.bg, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: progress + "%", background: progress === 100 ? COLORS.success : COLORS.navy }} />
          </div>
          <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{completed}/{total} done</div>
        </div>
      )}
      {tx.assignedAgentName && <div style={{ fontSize: 10, color: COLORS.muted }}>👤 {tx.assignedAgentName}</div>}
      {tx.isGuestView && tx.owningBrokerageName && <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>🏢 Managed by {tx.owningBrokerageName}</div>}
    </div>
  );
}

function PipelineColumn({ status, transactions, onSelect }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[PIPELINE_COLUMN_STYLE[status]] || STATUS_CONFIG["Active"];
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
  const grouped = PIPELINE_COLUMNS.reduce((acc, s) => { acc[s] = transactions.filter(t => pipelineStageFor(t) === s); return acc; }, {});
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
    img, video { max-width: 100% !important; height: auto; }
    input, textarea, select { max-width: 100%; }
    @media (max-width: 768px) {
      /* Universal: collapse any inline multi-column grid to a single column on phones.
         Opt out per-element with data-keep-grid="" (e.g. the month calendar). */
      [style*="grid-template-columns"]:not([data-keep-grid]) { grid-template-columns: 1fr !important; }
      /* Universal: button clusters / flex rows WRAP on phones instead of running
         off the right edge (body clips h-scroll, so overflow = unreachable —
         "have to turn the phone sideways", Carlos 7/27). Documents checklist
         actions, People row buttons, etc. Opt out with data-no-wrap="". */
      div[style*="display: flex"]:not([data-no-wrap]) { flex-wrap: wrap !important; }
      /* Button clusters marked flex-shrink:0 must still give way on a phone —
         otherwise they poke past the right edge no matter what wraps. */
      div[style*="flex-shrink: 0"][style*="gap"]:not([data-no-wrap]) { flex-shrink: 1 !important; min-width: 0 !important; }
      /* Floating ? help button: smaller + bottom-LEFT so it stops covering the
         action buttons phones put bottom-right. */
      .help-fab {
        width: 40px !important; height: 40px !important; font-size: 17px !important;
        bottom: 10px !important; left: 10px !important; right: auto !important;
        opacity: 0.75;
      }
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
function today() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); } // EASTERN day — UTC rolled a day forward every evening
function addDays(date, days) { const clean = String(date).includes("T") ? String(date).split("T")[0] : String(date); const d = new Date(clean + "T00:00:00"); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function formatDate(s) { if (!s) return "—"; const clean = String(s).includes("T") ? String(s).split("T")[0] : String(s); const d = new Date(clean + "T00:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function daysUntil(s) { if (!s) return null; const clean = String(s).includes("T") ? String(s).split("T")[0] : String(s); const diff = new Date(clean + "T00:00:00") - new Date(today() + "T00:00:00"); return Math.round(diff / 86400000); }
function formatTime(iso) { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function roleColor(role) { const c = ["#1D4ED8","#15803D","#C9A84C","#7C3AED","#DC2626","#0F766E","#B45309","#9D174D"]; return c[String(role || "").length % c.length]; }

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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: wide ? 800 : 520, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <h2 style={{ margin: 0, fontSize: 18, color: COLORS.navy, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: COLORS.muted }}>×</button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

function TransactionListView({ transactions, sortKey, sortDir, toggleSort, onSelect, onLeadAction }) {
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
                          <div style={{ fontWeight: 700, color: "#991b1b", fontSize: 13 }}>{isBuyerSideType(tx.type) ? "NEW BUYER INQUIRY" : "NEW SELLER LEAD"} — Action Required</div>
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
                // Progress = Auto-TC timeline (milestones), not the legacy tasks table.
                const ms = tx.milestoneSummary;
                const completed = ms ? (ms.done || 0) : 0;
                const total = ms ? (ms.total || 0) : 0;
                const progress = total > 0 ? Math.round(completed / total * 100) : 0;
                const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG["Active"];
                const price = tx.contractPrice || tx.listPrice;
                return (
                  <tr key={tx.id} onClick={() => onSelect(tx.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`, borderLeft: propertyTypeAccent(tx) ? `4px solid ${propertyTypeAccent(tx)}` : "4px solid transparent" }}
                    onMouseEnter={e => e.currentTarget.style.background = COLORS.bg}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: COLORS.navy, display: "flex", alignItems: "center", gap: 6 }}>
                        {tx.address}
                        {propertyTypeBadge(tx) && <span style={{ background: propertyTypeBadge(tx).bg, color: propertyTypeBadge(tx).color, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, whiteSpace: "nowrap" }}>{propertyTypeBadge(tx).label}</span>}
                      </div>
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
                    <td style={{ padding: "12px 14px", color: COLORS.muted, fontSize: 11 }}>{txTypeShort(tx.type)}</td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr><td colSpan="7" style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>Nothing here — if you have a search or filter on, clear it up top. Otherwise tap ➕ New Deal to start one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="tx-list-mobile">
        {transactions.length === 0 && <div style={{ padding: 40, textAlign: "center", color: COLORS.muted, background: "#fff", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>Nothing here — if you have a search or filter on, clear it up top. Otherwise tap ➕ New Deal to start one.</div>}
        {transactions.map(tx => {
          // Progress = Auto-TC timeline (milestones), not the legacy tasks table.
          const ms = tx.milestoneSummary;
          const completed = ms ? (ms.done || 0) : 0;
          const total = ms ? (ms.total || 0) : 0;
          const progress = total > 0 ? Math.round(completed / total * 100) : 0;
          const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG["Active"];
          const price = tx.contractPrice || tx.listPrice;
          return (
            <div key={tx.id} onClick={() => onSelect(tx.id)} style={{ background: !tx.assignedAgentId ? "#fef3c7" : tx.needsReview ? "#eff6ff" : tx.needsFirstContact ? "#fef2f2" : "#fff", border: `2px solid ${!tx.assignedAgentId ? "#fde68a" : tx.needsReview ? "#bfdbfe" : tx.needsFirstContact ? "#fecaca" : COLORS.border}`, borderLeft: propertyTypeAccent(tx) ? `5px solid ${propertyTypeAccent(tx)}` : undefined, borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
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
                  🔔 {isBuyerSideType(tx.type) ? "NEW BUYER INQUIRY" : "NEW SELLER LEAD"} — Contact Within 24hrs
                </div>
              )}
              {tx.assignedAgentId && !tx.needsReview && tx.leadConverted === false && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ background: "#FEF9E7", color: "#B7860B", border: "1px solid #F1C40F", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
                    🌱 {isBuyerSideType(tx.type) ? "INQUIRY" : "LEAD"} — not yet confirmed
                  </span>
                  {onLeadAction && <button onClick={e => { e.stopPropagation(); onLeadAction(tx.id, "confirm"); }} style={{ background: "#B7860B", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Confirm</button>}
                  {onLeadAction && <button onClick={e => { e.stopPropagation(); onLeadAction(tx.id, "cancel"); }} style={{ background: "transparent", color: "#B7860B", border: "1px solid #C9A227", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕ Not Pursuing</button>}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: COLORS.navy, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{tx.address}</span>
                    {propertyTypeBadge(tx) && <span style={{ background: propertyTypeBadge(tx).bg, color: propertyTypeBadge(tx).color, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0 }}>{propertyTypeBadge(tx).label}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{tx.city}, FL · {txTypeShort(tx.type)}</div>
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
  const initials = String(party.name || "?").trim().split(/\s+/).map(w => w[0] || "").join("").toUpperCase().substr(0, 2) || "?";
  const color = roleColor(party.role);
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color + "22", color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>{initials}</div>;
}

function PartyCard({ party, txId, onRemove, onEdit, onClick, onInvite, onCopyLoginLink, onSendFollowup, onSendWelcome, onResetPassword, onResetPin }) {
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
        {party.email && party.role && /buyer|seller/i.test(party.role) && !/agent/i.test(party.role) && (
          party.lastLoginAt
            ? <div style={{ fontSize: 11, color: "#1E8449", fontWeight: 700, marginTop: 4 }}>🟢 Viewed portal — last seen {new Date(party.lastLoginAt).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</div>
            : <div style={{ fontSize: 11, color: "#9A6700", fontWeight: 700, marginTop: 4 }}>⚪ Hasn't logged into portal yet</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {onInvite && <button onClick={e => { e.stopPropagation(); onInvite(); }} style={{ background: "none", border: "1px solid #C0392B", borderRadius: 6, cursor: "pointer", color: "#C0392B", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>Send Invite</button>}
        {onCopyLoginLink && party.email && party.role && /buyer|seller/i.test(party.role) && !/agent/i.test(party.role) && <button onClick={e => { e.stopPropagation(); onCopyLoginLink(); }} title="Get a portal login link to text or share directly — useful if the invite email didn't arrive. They still set their own PIN." style={{ background: "none", border: "1px solid #1E8449", borderRadius: 6, cursor: "pointer", color: "#1E8449", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>🔗 Login Link</button>}
        {onSendFollowup && (party.email || party.phone) && <button onClick={e => { e.stopPropagation(); onSendFollowup(party); }} style={{ background: "#C0392B", border: "1px solid #C0392B", borderRadius: 6, cursor: "pointer", color: "#fff", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>Follow Up</button>}
        {onSendWelcome && party.email && <button onClick={e => { e.stopPropagation(); onSendWelcome(party); }} title="Send (or re-send) the role-specific welcome email with key dates, financial summary, parties roster, and the contract document package. Use this when you've added or corrected this party's email after the initial Under Contract send." style={{ background: "#1E8449", border: "1px solid #1E8449", borderRadius: 6, cursor: "pointer", color: "#fff", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>✉️ Send Welcome</button>}
        {onResetPassword && party.email && <button onClick={e => { e.stopPropagation(); onResetPassword(party); }} title="Email a one-time secure link so this party can set a new password. The link expires in 1 hour. Use this when a party calls saying they can't log in." style={{ background: "#7c3aed", border: "1px solid #7c3aed", borderRadius: 6, cursor: "pointer", color: "#fff", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>🔐 Reset PW</button>}
        {onResetPin && party.email && <button onClick={e => { e.stopPropagation(); onResetPin(party); }} title="Clear this client's forgotten portal PIN. Next time they open their portal link they'll be asked to CREATE a new PIN — nothing is emailed." style={{ background: "#0e7490", border: "1px solid #0e7490", borderRadius: 6, cursor: "pointer", color: "#fff", fontSize: 11, padding: "2px 8px", fontWeight: 600 }}>🔢 Reset PIN</button>}
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 560, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", margin: "auto" }}>
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
                  <div style={{ fontSize: 13, color: COLORS.muted, fontStyle: "italic" }}>No parties with phone numbers. Add phone numbers in the People tab.</div>
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
function SMSPanel({ tx, onUpdate, currentUser, sendOnly = false }) {
  const [companyName, setCompanyName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentFullName, setAgentFullName] = useState("");
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch("https://liz-team-server-api-production.up.railway.app/settings/company", { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json()).then(d => { if (d.company) setCompanyName(d.company.name || ""); }).catch(e => console.error("[bg]", e && e.message ? e.message : e));
    fetch("https://liz-team-server-api-production.up.railway.app/profile", { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json()).then(d => { 
        if (d.profile) {
          setAgentPhone(d.profile.phone || "");
          setAgentFullName(((d.profile.firstName || "") + " " + (d.profile.lastName || "")).trim());
        }
      }).catch(e => console.error("[bg]", e && e.message ? e.message : e));
  }, []);
  const [serverOnline, setServerOnline] = useState(null);
  const [emailOnline, setEmailOnline] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  // Remembers the last choice — but NEVER auto-restores "both": a remembered
  // Both silently double-sent a plain text as text+email days later (Carlos
  // 7/27). Email/Text carry over; Both must be an explicit pick every time.
  const [channel, setChannel] = useState(() => { const v = localStorage.getItem("tp_last_channel") || ""; return v === "both" ? "" : v; });
  const [sending, setSending] = useState(false);
  const [showReminderSMS, setShowReminderSMS] = useState(false);
  const [reminderTask, setReminderTask] = useState("");
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderChannel, setReminderChannel] = useState("email");
  const [reminderParties, setReminderParties] = useState([]);
  const [reminderSending, setReminderSending] = useState(false);
  // Two-step model (Carlos): first pick WHAT you're doing — chat in the app vs
  // send an email/text — then (for sends) WHO it's for. Never show the chat and
  // the everyone-composer side by side; that read as two competing "everyone"s.
  const [surface, setSurface] = useState("send"); // "chat" | "send"
  const [mode, setMode] = useState("direct");      // send audience: "direct" | "group"
  const [chatPosting, setChatPosting] = useState(false);
  const [gSubject, setGSubject] = useState("");
  const [gMessage, setGMessage] = useState("");
  const [gChannel, setGChannel] = useState(() => localStorage.getItem("tp_last_channel") || "");   // remembers last choice; "" = never chosen
  const [gAttach, setGAttach] = useState([]); // [{ id, name }]
  const [gSending, setGSending] = useState(false);
  const [gResult, setGResult] = useState(null);
  // Group recipients: pick a subset (not always everyone) + type in addresses
  // that aren't on the deal. Defaults to NONE selected (empty Set) so the agent
  // deliberately ticks who gets it. null = "all parties" (set by Select all);
  // any other Set = an explicit subset. gExtra holds typed-in emails not on the deal.
  const [gSelectedIds, setGSelectedIds] = useState(new Set());
  const [gExtra, setGExtra] = useState([]); // [{ name, email }]
  const [gNewEmail, setGNewEmail] = useState("");
  const [gNewName, setGNewName] = useState("");
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docList, setDocList] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch(`${SMS_SERVER}/health`).then(r => r.json()).then(d => {
      setServerOnline(true);
      setEmailOnline(!!d.email);
    }).catch(() => setServerOnline(false));
  }, []);

  // Authoritative message history comes from message_log on the server. The
  // optimistic tx.smsThreads only persists if the follow-up transaction PUT
  // succeeds, so sent messages could vanish on refresh — load the log so they
  // always show.
  const [logged, setLogged] = useState([]);
  const loadLogged = () => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(`${SMS_SERVER}/client/messages/${tx.id}`, { headers: { Authorization: "Bearer " + tok } })
      .then(r => r.json()).then(d => { if (d && d.success) setLogged(d.messages || []); }).catch(() => {});
  };
  useEffect(() => { loadLogged(); }, [tx.id]);
  // Opening a conversation = those messages are read. Server first (so it holds
  // across devices/reloads), then clear locally so the badge drops instantly.
  const markThreadRead = (party) => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(`${SMS_SERVER}/transactions/${tx.id}/thread-read`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
      body: JSON.stringify({ email: party.email || "", phone: party.phone || "" }),
    }).catch(() => {});
    const pe = (party.email || "").toLowerCase();
    const pp = (party.phone || "").replace(/[^0-9]/g, "").slice(-10);
    setLogged(prev => prev.map(m => {
      if ((m.direction || "outbound") !== "inbound" || m.read_at) return m;
      const me = (m.to_email || "").toLowerCase();
      const mp = (m.to_phone || "").replace(/[^0-9]/g, "").slice(-10);
      return ((pe && me === pe) || (pp && mp === pp)) ? { ...m, read_at: new Date().toISOString() } : m;
    }));
  };

  // SMS inbound polling removed - using message_log instead

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selectedParty, tx.smsThreads]);

  const partiesWithContact = tx.parties.filter(p => (p.phone && p.phone.trim()) || (p.email && p.email.trim()));
  const normalizePhone = p => { const d = p.replace(/\D/g, ""); return d.length === 10 ? `+1${d}` : `+${d}`; };
  const getThread = party => {
    const threads = tx.smsThreads || {};
    const phoneKey = party.phone ? normalizePhone(party.phone) : null;
    const emailKey = party.email || null;
    const phoneThread = phoneKey ? (threads[phoneKey] || []) : [];
    const emailThread = emailKey ? (threads[emailKey] || []) : [];
    // Merge in authoritative message_log rows for this party (by email/phone).
    const partyEmail = (party.email || "").toLowerCase();
    const partyPhone = party.phone ? normalizePhone(party.phone) : null;
    const fromLog = (logged || []).filter(m =>
      (partyEmail && (m.to_email || "").toLowerCase() === partyEmail) ||
      (partyPhone && m.to_phone && normalizePhone(m.to_phone) === partyPhone)
    ).map(m => ({ id: m.id, body: m.body, subject: m.subject, direction: m.direction || "outbound", channel: m.channel, timestamp: m.created_at, status: "sent", read_at: m.read_at || null }));
    // Dedupe by id (optimistic push reuses the server msg id), then sort.
    const seen = new Set();
    const list = [...phoneThread, ...emailThread, ...fromLog]
      .filter(x => { const k = x.id || (x.timestamp + "|" + (x.body || "")); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    // A "Both" send is ONE message delivered two ways — show ONE bubble tagged
    // both channels, not two identical bubbles (read as an accidental double
    // send — Carlos 7/27). Merge same-body outbound sms+email within 2 minutes.
    const out = [];
    for (const m of list) {
      const prev = out[out.length - 1];
      if (prev && m.direction === "outbound" && prev.direction === "outbound"
          && (m.body || "") === (prev.body || "") && m.channel !== prev.channel
          && Math.abs(new Date(m.timestamp) - new Date(prev.timestamp)) < 120000) {
        prev.channel = "both";
        continue;
      }
      out.push({ ...m });
    }
    return out;
  };

  const rememberChannel = (v) => { try { localStorage.setItem("tp_last_channel", v); } catch {} };
  const ChannelPicker = ({ value, onChange: onChangeRaw }) => {
    const onChange = (v) => { rememberChannel(v); onChangeRaw(v); };
    return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#0F2044", marginBottom: 5 }}>
        How should this go out? {!value && <span style={{ color: "#C0392B" }}>👉 pick one</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[["email", "📧 Email"], ["sms", "📱 Text"], ["both", "📧 + 📱 Both"]].map(([v, label]) => (
          <button key={v} onClick={() => onChange(v)} style={{ padding: "10px 16px", borderRadius: 10, border: "2px solid " + (value === v ? "#0F2044" : "#D1D5DB"), background: value === v ? "#0F2044" : "#fff", color: value === v ? "#fff" : "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
        ))}
      </div>
    </div>
    );
  };

  const sendMessage = async () => {
    if (!selectedParty || !message.trim() || !serverOnline) return;
    if (!channel) { alert("Pick how to send it first — 📧 Email or 📱 Text."); return; }
    setSending(true);
    try {
      const isSMS = channel === "sms" || channel === "both";
      const isEmail = channel === "email" || channel === "both";
      let anySent = false;
      console.log("Sending via channel:", channel, "SMS:", isSMS, "Email:", isEmail, "phone:", selectedParty.phone, "email:", selectedParty.email);
      if (isSMS && selectedParty.phone) {
        try {
          const res = await fetch(`${SMS_SERVER}/sms/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toPhone: selectedParty.phone, toName: selectedParty.name, toRole: selectedParty.role, message: message.trim(), fromName: "The Liz Team", attachDocIds: gAttach.map(a => a.id) }) });
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
            const res = await fetch(`${SMS_SERVER}/email/send`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ transactionId: tx.id, transactionAddress: tx.address, toEmail: emailAddr, toName: selectedParty.name, toRole: selectedParty.role, subject: subject || `Re: ${tx.address}`, message: message.trim(), fromName: "The Liz Team", attachDocIds: gAttach.map(a => a.id) }) });
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
        } else { alert("No email address for this party. Add one in the People tab."); }
      }
      if (anySent) { setMessage(""); setSubject(""); setGAttach([]); loadLogged(); }
      else alert("Send failed. Check server and credentials.");
    } catch { alert("Server unreachable."); }
    setSending(false);
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

  // ── Group send (pick who — some, all, or type in others) ──────
  // HOA managers are reference-only — never messaged/emailed/invited (matches the
  // welcome-email + invite rules elsewhere). Exclude them so they can't be picked,
  // and so "Select all" never includes them. (tester finding #12)
  const gContactable = tx.parties.filter(p => ((p.email && p.email.trim()) || (p.phone && p.phone.trim())) && !/hoa/i.test(p.role || ""));
  // null = everyone (default); otherwise the explicit subset the agent ticked.
  const gSelectedSet = gSelectedIds === null ? new Set(gContactable.map(p => p.id)) : gSelectedIds;
  const isRecipientOn = (id) => gSelectedSet.has(id);
  const toggleRecipient = (id) => {
    const next = new Set(gSelectedSet);
    next.has(id) ? next.delete(id) : next.add(id);
    setGSelectedIds(next);
  };
  const addExtraEmail = () => {
    const email = gNewEmail.trim();
    if (!/.+@.+\..+/.test(email)) { alert("Enter a valid email address."); return; }
    if (gExtra.some(e => e.email.toLowerCase() === email.toLowerCase()) ||
        gContactable.some(p => (p.email || "").toLowerCase() === email.toLowerCase())) {
      alert("That email is already on the list."); return;
    }
    setGExtra(prev => [...prev, { name: gNewName.trim(), email }]);
    setGNewEmail(""); setGNewName("");
  };
  // The actual recipients of a group send = ticked parties + typed-in addresses.
  const gChosenParties = gContactable.filter(p => gSelectedSet.has(p.id));
  const gChosen = [
    ...gChosenParties.map(p => ({ name: p.name, email: p.email || "", phone: p.phone || "", role: p.role || "" })),
    ...gExtra.map(e => ({ name: e.name || e.email, email: e.email, phone: "", role: "" })),
  ];
  const gWithEmail = gChosen.filter(p => p.email && p.email.trim());
  const gWithPhone = gChosen.filter(p => p.phone && p.phone.trim());
  const gNoContact = gChosen.filter(p => !(p.email && p.email.trim()) && !(p.phone && p.phone.trim()));
  // Who can't be reached ON THE CHOSEN CHANNEL — the note only talks about the
  // channel the agent actually picked (Email-only never mentions text, etc.).
  const gUnreachable = gChannel === "email" ? gChosen.filter(p => !(p.email && p.email.trim()))
                     : gChannel === "sms"  ? gChosen.filter(p => !(p.phone && p.phone.trim()))
                     : gNoContact;
  const gReachable = gChosen.length - gUnreachable.length; // can actually get it on the chosen channel

  const sendGroup = async () => {
    if (!gMessage.trim()) return;
    if (!gChannel) { alert("Pick how to send it first — 📧 Email, 📱 Text, or Both."); return; }
    setGSending(true);
    try {
      const res = await fetch(`${SMS_SERVER}/transactions/${tx.id}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") },
        body: JSON.stringify({ subject: gSubject, message: gMessage.trim(), channel: gChannel, attachDocIds: gAttach.map(a => a.id), recipients: gChosen }),
      });
      const d = await res.json();
      if (d.success) { setGResult(d.results || []); setGMessage(""); setGSubject(""); setGAttach([]); setGExtra([]); setGSelectedIds(new Set()); loadLogged(); }
      else alert("Send failed: " + (d.error || "unknown error"));
    } catch { alert("Server unreachable."); }
    setGSending(false);
  };

  // Post the picked files into the chat as secure download links (chat
  // messages are text, so files travel as links — same as SMS). In a private
  // chat the post is directed: only that person (and you) ever sees it.
  const chatTarget = surface === "chat" && mode === "direct" && selectedParty && selectedParty.email ? selectedParty : null;
  const postFilesToChat = async () => {
    if (!gAttach.length || chatPosting) return;
    setChatPosting(true);
    try {
      const res = await fetch(`${SMS_SERVER}/transactions/${tx.id}/chat-attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") },
        body: JSON.stringify({ docIds: gAttach.map(a => a.id), notifyEmails: chatTarget ? [chatTarget.email.toLowerCase()] : undefined }),
      });
      const d = await res.json();
      if (d.success) setGAttach([]);
      else alert(d.error || "Couldn't share the files.");
    } catch { alert("Server unreachable."); }
    setChatPosting(false);
  };

  // One attach bar for both chat views — group room and private chat.
  const renderChatAttachBar = () => {
    const first = chatTarget ? (chatTarget.name || "").split(" ")[0] : null;
    return (
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button onClick={openDocPicker} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #0F2044", background: "#fff", color: "#0F2044", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📎 Attach from Documents</button>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #0F2044", background: "#fff", color: "#0F2044", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: uploading ? 0.5 : 1 }}>{uploading ? "Uploading..." : "💻 Upload"}</button>
        {gAttach.map(a => (
          <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F0F4FF", border: "1px solid #C7D2FE", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#0F2044" }}>
            📄 {a.name}
            <button onClick={() => setGAttach(prev => prev.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 14, lineHeight: 1 }}>×</button>
          </span>
        ))}
        {gAttach.length > 0 ? (
          <button onClick={postFilesToChat} disabled={chatPosting} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#15803D", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: chatPosting ? 0.5 : 1 }}>{chatPosting ? "Sharing..." : `Share ${gAttach.length} file${gAttach.length > 1 ? "s" : ""} ${first ? `with ${first} only` : "in chat"}`}</button>
        ) : (
          <span style={{ fontSize: 11, color: "#6B7280" }}>{first ? `Files go privately to ${first} as secure download links.` : "Files post into the chat as secure download links."}</span>
        )}
      </div>
    );
  };

  const openDocPicker = () => {
    setDocPickerOpen(true);
    if (docList === null) {
      const tok = localStorage.getItem("tp_token") || "";
      fetch(`${SMS_SERVER}/documents/${tx.id}`, { headers: { Authorization: "Bearer " + tok } })
        .then(r => r.json()).then(d => setDocList(d.documents || [])).catch(() => setDocList([]));
    }
  };
  const toggleAttach = doc => setGAttach(prev => prev.find(a => a.id === doc.id) ? prev.filter(a => a.id !== doc.id) : [...prev, { id: doc.id, name: doc.name }]);

  const uploadFromComputer = async file => {
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result.split(",")[1]); fr.onerror = reject; fr.readAsDataURL(file); });
      const res = await fetch(`${SMS_SERVER}/documents/upload`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type, category: "Email Attachments", base64 }) });
      const d = await res.json();
      if (d.success && d.docId) { setGAttach(prev => [...prev, { id: d.docId, name: file.name }]); setDocList(null); }
      else alert("Upload failed: " + (d.error || "unknown error"));
    } catch (e) { alert("Upload error: " + e.message); }
    setUploading(false);
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
      </div>

      {/* The two choices the agent must make: WHO (over the conversations list) and HOW (over the messaging window) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0F2044", marginBottom: 5 }}>1. Select who to message:</div>
          <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 8, padding: 3, gap: 2, border: "1.5px solid #C9A84C" }}>
            {[["direct", "👤 One person"], ["group", "👥 Group / several"]].map(([v, label]) => (
              <button key={v} onClick={() => setMode(v)} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: mode === v ? "#C9A84C" : "transparent", color: mode === v ? "#fff" : "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
            ))}
          </div>
        </div>
        {/* In the merged Messages hub the in-app chat is its own section, so this
            sender is email/text only (sendOnly hides the chat-surface toggle). */}
        {!sendOnly && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F2044", marginBottom: 5 }}>2. Select how to send it:</div>
            <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 8, padding: 3, gap: 2, border: "1.5px solid #0F2044" }}>
              {[["send", "📨 Email / Text"], ["chat", "💬 Chat in the app"]].map(([v, label]) => (
                <button key={v} onClick={() => setSurface(v)} style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: surface === v ? "#0F2044" : "transparent", color: surface === v ? "#fff" : "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFromComputer(f); e.target.value = ""; }} />

      {surface === "chat" && mode === "direct" && (
        <div data-msg-grid style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, height: "min(900px, calc(100vh - 180px))", minHeight: 600 }}>
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #E5E7EB", fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Chat privately with...</div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {tx.parties.filter(p => p.email && p.email.trim()).map(party => {
                const isSelected = selectedParty?.id === party.id;
                return (
                  <div key={party.id} onClick={() => setSelectedParty(party)} style={{ padding: "12px 14px", borderBottom: "1px solid #E5E7EB", cursor: "pointer", background: isSelected ? "#F0F4FF" : "#fff", borderLeft: `3px solid ${isSelected ? "#0F2044" : "transparent"}`, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1D4ED822", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{party.name.split(" ").map(w => w[0]).join("").toUpperCase().substr(0, 2)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#1A1A2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{party.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#C9A84C" }}>{party.role}</div>
                    </div>
                  </div>
                );
              })}
              {tx.parties.filter(p => p.email && p.email.trim()).length === 0 && (
                <div style={{ padding: 20, fontSize: 13, color: "#6B7280" }}>No parties with an email yet — private chat needs one. Add it in the People tab.</div>
              )}
            </div>
          </div>
          {selectedParty && selectedParty.email ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
              {renderChatAttachBar()}
              <div style={{ flex: 1, minHeight: 0 }}>
                <TransactionChat simple directTo={selectedParty} transactionId={tx.id} user={null} parties={tx.parties || []} style={{ height: "100%" }} unreadCount={0} onUnreadChange={() => {}} />
              </div>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "#6B7280", padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 40 }}>🔒</div>
              <div style={{ fontWeight: 700, color: "#0F2044" }}>← Pick a person to chat privately</div>
              <div style={{ fontSize: 13 }}>Only you and them see it. For the whole group, switch to "👥 Everyone" above.</div>
            </div>
          )}
        </div>
      )}

      {surface === "chat" && mode === "group" && (
        <div>
          <div style={{ marginBottom: 12 }}>{renderChatAttachBar()}</div>
          <div style={{ height: 620 }}>
            <TransactionChat simple transactionId={tx.id} user={null} parties={tx.parties || []} style={{ height: "100%" }} unreadCount={0} onUnreadChange={() => {}} />
          </div>
        </div>
      )}

      {surface === "send" && mode === "group" && (
        <div style={{ maxWidth: 760 }}>
            {/* Composer */}
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0F2044", marginBottom: 4 }}>Message the group</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14 }}>Pick who gets this below — everyone, just a few, or add an email that isn't on the deal. A copy is also saved in the in-app Chat.</div>

              {/* Recipients — some, all, or add an address not on the deal */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>To ({gChosen.length} selected)</div>
                  {gContactable.length > 0 && (
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => setGSelectedIds(null)} style={{ background: "none", border: "none", color: "#0F2044", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Select all</button>
                      <button onClick={() => setGSelectedIds(new Set())} style={{ background: "none", border: "none", color: "#6B7280", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Clear</button>
                    </div>
                  )}
                </div>
                {gContactable.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#6B7280" }}>No parties with contact info yet — add them in the People tab, or type an email below.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }} data-keep-grid="">
                    {gContactable.map(p => (
                      <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1A1A2E", cursor: "pointer", padding: "4px 2px" }}>
                        <input type="checkbox" checked={isRecipientOn(p.id)} onChange={() => toggleRecipient(p.id)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name} <span style={{ color: "#C9A84C", fontWeight: 600 }}>· {p.role}</span>
                          {!(p.email && p.email.trim()) && <span style={{ color: "#B45309" }}> (text only)</span>}
                          {!(p.phone && p.phone.trim()) && <span style={{ color: "#6B7280" }}> (email only)</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {gExtra.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {gExtra.map((e, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 6, padding: "3px 8px", fontSize: 12, color: "#0F2044" }}>
                        ✉️ {e.name ? `${e.name} · ` : ""}{e.email}
                        <button onClick={() => setGExtra(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 14, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <input value={gNewName} onChange={e => setGNewName(e.target.value)} placeholder="Name (optional)" style={{ flex: "0 1 130px", padding: "7px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                  <input value={gNewEmail} onChange={e => setGNewEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addExtraEmail(); } }} placeholder="Add another email…" style={{ flex: "1 1 180px", padding: "7px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                  <button onClick={addExtraEmail} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "1px solid #0F2044", background: "#fff", color: "#0F2044", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <ChannelPicker value={gChannel} onChange={setGChannel} />
              </div>

              {(gChannel === "email" || gChannel === "both") && (
                <input value={gSubject} onChange={e => setGSubject(e.target.value)} placeholder={`Email subject (default: Update: ${tx.address})`} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }} />
              )}

              <textarea value={gMessage} onChange={e => setGMessage(e.target.value)} rows={12} placeholder="Type your message to the selected recipients..." style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 220, boxSizing: "border-box", marginBottom: 10 }} />

              {/* Attachments */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: gAttach.length ? 8 : 0 }}>
                  <button onClick={openDocPicker} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #0F2044", background: "#fff", color: "#0F2044", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📎 Attach from Documents</button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #0F2044", background: "#fff", color: "#0F2044", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: uploading ? 0.5 : 1 }}>{uploading ? "Uploading..." : "💻 Upload"}</button>
                </div>
                {gAttach.map(a => (
                  <div key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F0F4FF", border: "1px solid #C7D2FE", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#0F2044", marginRight: 6, marginBottom: 6 }}>
                    📄 {a.name}
                    <button onClick={() => setGAttach(prev => prev.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {gAttach.length > 0 && (gChannel === "sms" || gChannel === "both") && (
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>Texted parties get a secure download link (files can't attach to a text).</div>
                )}
              </div>

              {/* Reachability note */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#374151", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Who will get this</div>
                {gChosen.length === 0 ? <div style={{ color: "#6B7280" }}>Nobody selected yet — tick a recipient above or add an email.</div> : (
                  <>
                    <div>
                      {gChannel !== "sms" && <>📧 {gWithEmail.length} by email</>}
                      {gChannel === "both" && " · "}
                      {gChannel !== "email" && <>📱 {gWithPhone.length} by text</>}
                    </div>
                    {gUnreachable.length > 0 && (
                      <div style={{ color: "#DC2626", fontWeight: 600 }}>
                        🚫 {gUnreachable.length} {gUnreachable.length === 1 ? "recipient has" : "recipients have"} no {gChannel === "sms" ? "phone" : gChannel === "email" ? "email" : "phone or email"} — {gChannel === "both" ? "add contact info to reach them" : `won't get this ${gChannel === "sms" ? "text" : "email"}`}
                      </div>
                    )}
                  </>
                )}
              </div>

              {gResult && (
                <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 12px", fontSize: 12, marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: "#15803D", marginBottom: 4 }}>Sent ✓</div>
                  {gResult.map((r, i) => (
                    <div key={i} style={{ color: "#374151" }}>{r.name}: {r.email === true ? "📧" : ""}{r.sms === true ? " 📱" : ""}{r.email === false ? " email failed" : ""}{r.sms === false ? " text failed" : ""}{r.email === null && r.sms === null ? "—" : ""}</div>
                  ))}
                </div>
              )}

              <button onClick={sendGroup} disabled={!gChannel || !gMessage.trim() || gSending || gReachable === 0} style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: "#15803D", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: (!gChannel || !gMessage.trim() || gSending || gReachable === 0) ? 0.5 : 1 }}>{gSending ? "Sending..." : !gChannel ? "Pick Email or Text above" : `Send to ${gReachable} recipient${gReachable === 1 ? "" : "s"}`}</button>
            </div>
        </div>
      )}

      {docPickerOpen && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
              <div style={{ background: "#fff", borderRadius: 14, width: 480, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", "data-modal": "", margin: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid #E5E7EB" }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#0F2044" }}>Attach from Documents</div>
                  <button onClick={() => setDocPickerOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6B7280" }}>×</button>
                </div>
                <div style={{ padding: "12px 22px 22px" }}>
                  {docList === null ? <div style={{ color: "#6B7280", padding: 20, textAlign: "center" }}>Loading...</div> :
                    docList.length === 0 ? <div style={{ color: "#6B7280", padding: 20, textAlign: "center" }}>No documents on this deal yet.</div> :
                    docList.map(doc => {
                      const on = !!gAttach.find(a => a.id === doc.id);
                      return (
                        <label key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${on ? "#0F2044" : "#E5E7EB"}`, borderRadius: 8, cursor: "pointer", marginBottom: 8 }}>
                          <input type="checkbox" checked={on} onChange={() => toggleAttach(doc)} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                            <div style={{ fontSize: 11, color: "#6B7280" }}>{doc.category || doc.folder || "General"}</div>
                          </div>
                        </label>
                      );
                    })}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <button onClick={() => setDocPickerOpen(false)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F2044", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
                  </div>
                </div>
              </div>
            </div>
          )}

      {surface === "send" && mode === "direct" && (partiesWithContact.length === 0 ? (
        <div style={{ textAlign: "center", color: "#6B7280", padding: 40 }}>No parties with phone or email. Add contact info in the People tab.</div>
      ) : (
        <div data-msg-grid style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, height: "min(900px, calc(100vh - 180px))", minHeight: 600 }}>
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #E5E7EB", fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Conversations</div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {partiesWithContact.map(party => {
                const thread = getThread(party);
                const last = thread[thread.length - 1];
                // TRUE unread (was a lifetime total that never cleared): inbound
                // rows without read_at. Opening the conversation marks them read.
                const inbound = thread.filter(m => m.direction === "inbound" && !m.read_at).length;
                const isSelected = selectedParty?.id === party.id;
                return (
                  <div key={party.id} onClick={() => { setSelectedParty(party); if (inbound > 0) markThreadRead(party); }} style={{ padding: "12px 14px", borderBottom: "1px solid #E5E7EB", cursor: "pointer", background: isSelected ? "#F0F4FF" : "#fff", borderLeft: `3px solid ${isSelected ? "#0F2044" : "transparent"}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1D4ED822", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{party.name.split(" ").map(w => w[0]).join("").toUpperCase().substr(0, 2)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#1A1A2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{party.name}</div>
                          {inbound > 0 && <div style={{ background: "#DC2626", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{inbound}</div>}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#C9A84C" }}>{party.role}</div>
                        <div style={{ fontSize: 10, color: "#6B7280" }}>{party.phone ? "📱 " : ""}{party.email ? "📧" : ""}</div>
                        <div style={{ fontSize: 12.5, color: "#4B5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{last ? `${last.direction === "outbound" ? "You: " : ""}${last.body}` : "No messages yet"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowReminderSMS(true)} style={{ margin: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#0F2044", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>⏰ Send a deadline reminder</button>
          </div>

          {/* overflowY auto (not hidden): with the thread holding a real reading
              height, a short laptop screen must scroll the pane — never clip the
              composer's Send button out of reach. */}
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden" }}>
            {!selectedParty ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", flexDirection: "column", gap: 8, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 40 }}>📧</div>
                <div style={{ fontWeight: 700, color: "#0F2044" }}>← Pick a person to email or text them privately</div>
                <div style={{ fontSize: 13 }}>Only they see it. To reach everyone at once, switch to "👥 To everyone" above.</div>
              </div>
            ) : (
              <>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 12, background: "#F7F8FA", flexWrap: "wrap" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1D4ED822", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{selectedParty.name.split(" ").map(w => w[0]).join("").toUpperCase().substr(0, 2)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedParty.name}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{selectedParty.phone && `📱 ${selectedParty.phone}`}{selectedParty.phone && selectedParty.email && " · "}{selectedParty.email && `📧 ${selectedParty.email}`}</div>
                  </div>
                </div>
                {/* The conversation needs a REAL reading pane — at 140px a single
                    bubble showed as an unreadable sliver above the composer. */}
                <div style={{ flex: 1, minHeight: 300, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {getThread(selectedParty).length === 0 && <div style={{ textAlign: "center", color: "#6B7280", fontSize: 13, marginTop: 40 }}>No messages yet. Choose 📧 Email or 📱 Text below, then type your message.</div>}
                  {getThread(selectedParty).map(m => {
                    const isOut = m.direction === "outbound";
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: isOut ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "82%" }}>
                          <div style={{ fontSize: 12, color: "#4B5563", marginBottom: 4, textAlign: isOut ? "right" : "left", fontWeight: 600 }}>{isOut ? "You" : selectedParty.name} · {formatTime(m.timestamp)} {m.channel === "both" ? "📧 + 📱 Both" : m.channel === "email" ? "📧 Email" : "📱 Text"}</div>
                          <div style={{ background: isOut ? "#0F2044" : "#F3F4F6", color: isOut ? "#fff" : "#1A1A2E", padding: "12px 16px", borderRadius: isOut ? "14px 14px 4px 14px" : "14px 14px 14px 4px", fontSize: 15.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                            {m.channel === "email" && m.subject && <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, opacity: 0.92, borderBottom: isOut ? "1px solid rgba(255,255,255,0.25)" : "1px solid #D1D5DB", paddingBottom: 6 }}>{m.subject}</div>}
                            {m.body}
                          </div>
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
                <div style={{ padding: "10px 18px 0", borderTop: "1px solid #E5E7EB" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: gAttach.length ? 8 : 0 }}>
                    <button onClick={openDocPicker} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #0F2044", background: "#fff", color: "#0F2044", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📎 Attach from Documents</button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #0F2044", background: "#fff", color: "#0F2044", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: uploading ? 0.5 : 1 }}>{uploading ? "Uploading..." : "💻 Upload"}</button>
                  </div>
                  {gAttach.map(a => (
                    <div key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F0F4FF", border: "1px solid #C7D2FE", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#0F2044", marginRight: 6, marginBottom: 6 }}>
                      📄 {a.name}
                      <button onClick={() => setGAttach(prev => prev.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 14, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  {gAttach.length > 0 && channel !== "email" && (
                    <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Texts get a secure download link (files can't attach to a text).</div>
                  )}
                </div>
                {/* Required channel choice — sits right above the box you type in + Send, so it can't be missed */}
                <div style={{ padding: "12px 18px", borderTop: "1px solid #E5E7EB", background: channel ? "#fff" : "#FFF7ED" }}>
                  <ChannelPicker value={channel} onChange={setChannel} />
                  {selectedParty && !selectedParty.phone && (channel === "sms" || channel === "both") && (
                    <div style={{ fontSize: 12, color: "#C0392B", marginTop: 6, fontWeight: 600 }}>⚠️ No phone on file for {selectedParty.name} — add one in the People tab to text them.</div>
                  )}
                </div>
                <div style={{ padding: "12px 18px", borderTop: "1px solid #E5E7EB", display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && channel === "sms") { e.preventDefault(); sendMessage(); } }} placeholder={!channel ? "Pick Email or Text above first…" : channel === "sms" ? "Type message... (Shift+Enter for new line)" : "Write your email..."} rows={channel === "sms" ? 3 : 8} style={{ flex: "1 1 100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 15, lineHeight: 1.55, fontFamily: "inherit", resize: "vertical", minHeight: channel === "sms" ? 70 : 200, boxSizing: "border-box" }} />
                  <button onClick={sendMessage} disabled={!channel || !message.trim() || sending} title={!channel ? "Pick Email or Text first" : ""} style={{ height: 44, minWidth: 70, borderRadius: 8, border: "none", background: "#15803D", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: (!channel || !message.trim() || sending) ? 0.5 : 1 }}>{sending ? "..." : "Send"}</button>
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
      ))}

      {showReminderSMS && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: 560, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", "data-modal": "", margin: "auto" }}>
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
function PersonalTaskAddButton({ token, hideTrigger = false, forceOpen = false, onCloseExternal }) {
  const [open, setOpen] = useState(false);
  const isOpen = open || forceOpen;
  const closeAll = () => { setOpen(false); if (onCloseExternal) onCloseExternal(); };
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
    const d = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }) + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDueDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
  };

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
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
      setTitle(""); setNotes(""); setDueDate(""); setCategory(""); closeAll();
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  return (
    <>
      {!hideTrigger && (
        <button onClick={() => setOpen(true)}
          style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}
          title="Add a general task — not tied to any transaction">
          📝 + Task
        </button>
      )}
      {isOpen && (
        <div onClick={() => !saving && closeAll()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", margin: "auto" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2332", marginBottom: 6 }}>📝 Add General Task</div>
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: "#1E3A8A", lineHeight: 1.5 }}>
              <strong>What this is:</strong> A general to-do that's NOT tied to any transaction (e.g., "Renew real estate license", "Order business cards"). Appears on your Win-the-Day dashboard.
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
              <button onClick={() => !saving && closeAll()} disabled={saving}
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

function WinTheDayButton({ token, onViewTransactions, coordinatorMode = false, onOpenTransaction }) {
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
      <button data-tour="winday" onClick={() => setShowModal(true)}
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

            {/* Coordinator: show the exception Command Center here too, so the
                ⚡ popup matches the home view (it was missing before — you had to
                refresh to see it). */}
            {coordinatorMode && (
              <CoordinatorCommandCenter
                token={token}
                onOpenTransaction={(txId, tab) => { setShowModal(false); onOpenTransaction && onOpenTransaction(txId, tab); }}
              />
            )}
            {/* Dashboard content */}
            <DailyDashboard
              token={token}
              user={null}
              coordinatorMode={coordinatorMode}
              onViewTransactions={() => { setShowModal(false); onViewTransactions && onViewTransactions(); }}
              onOpenTransactionMilestones={(txId, tab) => { setShowModal(false); onOpenTransaction && onOpenTransaction(txId, tab); }}
              onOpenInboundReply={(txId) => { setShowModal(false); onOpenTransaction && onOpenTransaction(txId, "replies"); }}
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
    "Survey": "📐", "Contractor": "🔧",
    "General Contractor": "👷", "Handyman": "🛠️", "Plumber": "🚰",
    "Electrician": "⚡", "HVAC": "❄️", "Roofer": "🏠", "Photographer": "📷",
    "Moving Company": "🚚", "Locksmith": "🔑", "Other": "👤",
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
          // Hide vendors already on this transaction — but ONLY on a real email
          // match. Parties without an email produced "" here, which "matched"
          // every email-less vendor and silently hid them all from the list.
          const existingEmails = new Set(tx.parties.map(p => (p.email || "").toLowerCase().trim()).filter(Boolean));
          setVendors((data.vendors || []).filter(v => {
            const ve = (v.email || "").toLowerCase().trim();
            return !(ve && existingEmails.has(ve));
          }));
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchVendors();
  }, []);

  // After assigning, offer to SHARE the vendor with the agent's client right
  // away (text/email/both) — the assignment completes either way; onAssigned
  // fires when the agent finishes so the panel doesn't unmount mid-share.
  const [assigned, setAssigned] = useState(null); // { vendor, party }
  const [showShare, setShowShare] = useState(false);
  const clientRecipients = (tx.parties || [])
    .filter(p => /^(co[- ]?)?(buyer|seller)$/i.test((p.role || "").trim()) && (p.email || p.phone))
    .map(p => ({ key: "party:" + p.id, name: p.name || p.email || p.phone, email: p.email || "", phone: p.phone || "", source: "deal" }));
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
        setAssigned({ vendor, party: data.party });
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

      {assigned ? (
        <div style={{ textAlign: "center", padding: 20 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{assigned.vendor.name} is on this deal</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Want to share their contact card with your client right now — by text, email, or both?</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => setShowShare(true)}
              style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              📤 Share with client (text / email)
            </button>
            <button onClick={() => onAssigned(assigned.party)}
              style={{ background: "#fff", color: "#555", border: "1.5px solid #D1D5DB", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Done — no share
            </button>
          </div>
          {showShare && (
            <Suspense fallback={null}>
              <ShareVendorModalLazy vendor={assigned.vendor} presetTxId={tx.id} presetRecipients={clientRecipients}
                onClose={() => { setShowShare(false); onAssigned(assigned.party); }} />
            </Suspense>
          )}
        </div>
      ) : loading ? (
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
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12,
            paddingBottom: 4 }}>
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
// BROKER FILE PANEL (New Construction compliance — retention docs)
// ═══════════════════════════════════════════════════════════════
function BrokerFilePanel({ txId, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState(null);
  const fileInputRef = useRef(null);
  const pendingTypeRef = useRef(null);

  const fetchData = async () => {
    try {
      const res = await fetch(API + "/broker-file/" + txId, {
        headers: { Authorization: "Bearer " + token }
      });
      const d = await res.json();
      if (d.success) setData(d);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [txId]);

  const handleUploadClick = (docType) => {
    pendingTypeRef.current = docType;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    const docType = pendingTypeRef.current;
    if (!file || !docType) return;
    e.target.value = "";

    if (file.size > 50 * 1024 * 1024) { alert("File too large (50MB max)"); return; }

    setUploadingType(docType);
    try {
      // Server-proxied upload (browser→R2 presigned PUT fails CORS → "Failed to fetch").
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const upRes = await fetch(API + "/broker-file/" + txId + "/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          documentType: docType,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          base64
        })
      });
      const upData = await upRes.json();
      if (!upRes.ok || !upData.success) {
        alert("Upload failed: " + (upData.error || "please try again"));
        setUploadingType(null);
        return;
      }
      await fetchData();
    } catch (err) {
      alert("Upload error: " + err.message);
    }
    setUploadingType(null);
    pendingTypeRef.current = null;
  };

  if (loading) return null;
  if (!data || data.total === 0) return null;

  const pct = Math.round((data.uploaded / data.total) * 100);
  const complete = data.complete;

  return (
    <div style={{ background: complete ? "#D1FAE5" : "#FFFBEB",
      borderRadius: 14, padding: 16, marginBottom: 12,
      border: "1px solid " + (complete ? "#86EFAC" : "#FCD34D") }}>
      <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileSelected} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: complete ? "#065F46" : "#92400E" }}>
          {complete ? "✅ Broker File Complete" : "📂 Broker File Compliance"}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, color: complete ? "#065F46" : "#92400E" }}>
          {data.uploaded}/{data.total} documents
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#78350F", marginBottom: 12, lineHeight: 1.5 }}>
        New Construction broker file. Florida law requires these documents to be retained for 5 years (Fla. Stat. § 475.5015). Upload each as you obtain it.
      </div>

      {data.items.map(item => (
        <div key={item.documentType} style={{
          background: "#fff",
          borderRadius: 10,
          padding: 12,
          marginBottom: 8,
          borderLeft: "4px solid " + (item.uploaded ? "#1E8449" : "#C0392B"),
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111", marginBottom: 3 }}>
              {item.uploaded ? "✅ " : "○ "}
              {item.documentType.replace(/_/g, " ")}
            </div>
            <div style={{ fontSize: 11, color: "#555", lineHeight: 1.4 }}>
              {item.description}
            </div>
            {item.uploaded && item.uploadedDoc && (
              <div style={{ fontSize: 10, color: "#1E8449", marginTop: 4 }}>
                📎 {item.uploadedDoc.name}
              </div>
            )}
          </div>
          {!item.uploaded && (
            <button
              onClick={() => handleUploadClick(item.documentType)}
              disabled={uploadingType === item.documentType}
              style={{
                background: "#C0392B", color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 14px", fontWeight: 700,
                fontSize: 12, cursor: "pointer", whiteSpace: "nowrap"
              }}>
              {uploadingType === item.documentType ? "Uploading..." : "📎 Upload"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULE CLOSING MODAL — agent inputs title-co/attorney closing
// details, reviews & edits the email, then sends to OWN SIDE only.
// ═══════════════════════════════════════════════════════════════
function ScheduleClosingModal({ tx, token, milestone, onClose, onDone }) {
  const isBuyer = (tx.type || "").toLowerCase().includes("buyer");
  const isDual = (tx.type || "").toLowerCase().includes("dual");
  const sideLabel = isDual ? "your buyer & seller" : isBuyer ? "your buyer" : "your seller";
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [amount, setAmount] = useState("");
  const [bring, setBring] = useState("A valid government-issued photo ID");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [edited, setEdited] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const prettyWhen = () => {
    if (!date) return "[closing date]";
    try {
      const d = new Date(date + "T" + (time || "10:00"));
      return d.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) +
        " at " + d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
    } catch { return date + " " + (time || ""); }
  };
  const buildBody = () => {
    return `Hi there,\n\nGreat news — your closing for ${tx.address} is scheduled!\n\n` +
      `When: ${prettyWhen()}\n` +
      `Where: ${location || "[closing location]"}\n` +
      (amount ? `Amount due at closing: ${amount}\n` : "") +
      (bring ? `What to bring: ${bring}\n` : "") +
      `\nPlease plan to arrive a few minutes early. Bring funds by wire or cashier's check as the title company instructed — confirm the method with them in advance.\n\n` +
      `If anything changes or you have questions, just reply to this email or call me anytime.\n\nLooking forward to getting you to the finish line!`;
  };
  // Auto-fill the preview from the fields until the agent hand-edits it.
  useEffect(() => {
    if (!edited) {
      setSubject(`Your closing is scheduled — ${tx.address}`);
      setBody(buildBody());
    }
  }, [date, time, location, amount, bring]); // eslint-disable-line

  const send = async () => {
    if (!date) { setErr("Please enter the closing date."); return; }
    setSending(true); setErr("");
    try {
      const r = await fetch(API + "/transactions/" + tx.id + "/schedule-closing", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ date, time, location, amount, emailSubject: subject, emailBody: body, send: true }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || "Failed to schedule closing");
      onDone();
    } catch (e) { setErr(e.message || "Something went wrong."); setSending(false); }
  };
  const saveOnly = async () => {
    if (!date) { setErr("Please enter the closing date."); return; }
    setSending(true); setErr("");
    try {
      const r = await fetch(API + "/transactions/" + tx.id + "/schedule-closing", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ date, time, location, amount, send: false }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || "Failed to save");
      onDone();
    } catch (e) { setErr(e.message || "Something went wrong."); setSending(false); }
  };

  const fld = { width: "100%", padding: "9px 10px", borderRadius: 8, border: "1.5px solid #D1D5DB", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
  const lbl = { fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" };
  return (
    <div onClick={() => !sending && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, padding: 22, maxWidth: 600, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", margin: "auto" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1E3A8A", marginBottom: 4 }}>🗓️ Schedule the Closing</div>
        <div style={{ fontSize: 13, color: "#1a2332", fontWeight: 600, marginBottom: 14 }}>{tx.address}</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ flex: "1 1 150px" }}>
            <label style={lbl}>Closing date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fld} />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={lbl}>Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={fld} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Location (title company / attorney address)</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="e.g. ABC Title, 123 Main St, City, FL" style={fld} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: "1 1 150px" }}>
            <label style={lbl}>Amount due at closing</label>
            <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. $14,250.00 (cash to close)" style={fld} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={lbl}>What to bring</label>
            <input type="text" value={bring} onChange={e => setBring(e.target.value)} style={fld} />
          </div>
        </div>

        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "#1E40AF", lineHeight: 1.5 }}>
          ✉️ Review &amp; edit the email below before sending. It goes to <strong>{sideLabel}</strong> only — never the other side. A day-before reminder will go out automatically.
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={lbl}>Email subject</label>
          <input type="text" value={subject} onChange={e => { setSubject(e.target.value); setEdited(true); }} style={fld} />
        </div>
        <div style={{ marginBottom: 6 }}>
          <label style={lbl}>Email message (editable)</label>
          <textarea value={body} onChange={e => { setBody(e.target.value); setEdited(true); }} rows={11}
            style={{ ...fld, resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }} />
        </div>
        {edited && (
          <button onClick={() => { setEdited(false); setSubject(`Your closing is scheduled — ${tx.address}`); setBody(buildBody()); }}
            style={{ background: "none", border: "none", color: "#1E3A8A", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 8 }}>
            ↻ Reset email to the fields above
          </button>
        )}

        {err && <div style={{ color: "#C0392B", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={send} disabled={sending}
            style={{ flex: "2 1 220px", padding: "12px 0", borderRadius: 9, border: "none", background: "#1E3A8A", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {sending ? "Sending…" : `📨 Send to ${sideLabel} & Mark Done`}
          </button>
          <button onClick={saveOnly} disabled={sending}
            style={{ flex: "1 1 150px", padding: "12px 0", borderRadius: 9, border: "1.5px solid #1E3A8A", background: "#fff", color: "#1E3A8A", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Save without emailing
          </button>
          <button onClick={onClose} disabled={sending}
            style={{ flex: "1 1 90px", padding: "12px 0", borderRadius: 9, border: "1.5px solid #D1D5DB", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MILESTONES TAB
// ═══════════════════════════════════════════════════════════════
function MilestonesTab({ tx, token, onSummaryChange, coordinatorMode = false }) {
  const [milestones, setMilestones] = useState([]);
  const [compliance, setCompliance] = useState({});
  const [availableDocs, setAvailableDocs] = useState([]);
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
        setAvailableDocs(data.availableDocs || []);
      }
    } catch (e) {}
  };

  // Attach a file already on the deal to this milestone — no re-upload. Satisfies
  // compliance immediately and labels the file so it ticks the Documents tab too.
  const assignExistingToMilestone = async (milestoneId, docId) => {
    if (!docId) return;
    setUploadingFor(milestoneId);
    try {
      const res = await fetch(API + "/documents/" + docId + "/milestone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ milestoneId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not attach document");
      await fetchCompliance();
    } catch (err) {
      alert("Could not attach document: " + err.message);
    }
    setUploadingFor(null);
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
      // Server-proxied upload (browser→R2 presigned PUT fails CORS).
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const upRes = await fetch(API + "/documents/upload", {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          transactionId: tx.id,
          milestoneId,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          markComplete: !isRetroactive,
          base64
        })
      });
      const upData = await upRes.json();
      if (!upRes.ok || !upData.success) throw new Error(upData.error || "Upload failed");

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
  const [scheduleDates, setScheduleDates] = useState({});
  const [scheduleAccess, setScheduleAccess] = useState({}); // mid -> { who, code } (inspection access details)
  const [scheduleTimes, setScheduleTimes] = useState({});

  const API = "https://liz-team-server-api-production.up.railway.app";
  // Coordinators act through the dedicated /tc/* endpoints (cross-brokerage,
  // money-free); only complete/reopen/schedule have a /tc route. Defined AFTER the
  // local `const API` above to avoid a temporal-dead-zone crash at render.
  const mBase = coordinatorMode ? API + "/tc/milestones/" : API + "/milestones/";

  useEffect(() => { fetchMilestones(); }, [tx.id]);

  // Keep the pipeline card's progress bar in sync with timeline edits.
  // The card reads tx.milestoneSummary, which is loaded once with the list;
  // recompute it here (mirroring the backend) and bubble it up on every change.
  useEffect(() => {
    // Bubble even when empty so clearing the timeline resets the card to 0/0.
    if (!onSummaryChange || loading) return;
    const active = milestones.filter(m => m.is_na !== true);
    const total = active.length;
    const done = active.filter(m => m.status === "Completed" || m.status === "Waived").length;
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const overdue = active.filter(m =>
      m.status !== "Completed" && m.status !== "Waived" && m.due_date && String(m.due_date).slice(0, 10) < todayStr
    ).length;
    const next = milestones.find(m => m.status !== "Completed" && m.status !== "Waived" && m.is_na !== true) || null;
    onSummaryChange(tx.id, { total, done, overdue }, next ? { name: next.name, dueDate: next.due_date } : null);
  }, [milestones, loading]);

  const fetchMilestones = async () => {
    setLoading(true);
    try {
      const res = await fetch(API + "/milestones/" + tx.id + "?_=" + Date.now(), {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store"
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

  const [resetting, setResetting] = useState(false);
  const handleReset = async () => {
    if (!window.confirm("Rebuild this deal's checklist?\n\nThis clears the current items and rebuilds the full start-to-finish timeline for this deal's current stage. Your uploaded documents and parties are NOT touched.")) return;
    setResetting(true);
    try {
      const res = await fetch(API + "/milestones/reset/" + tx.id, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) { await fetchMilestones(); await fetchCompliance(); }
      else alert("Could not rebuild: " + (data.error || "unknown error"));
    } catch (e) { alert("Error rebuilding checklist"); }
    setResetting(false);
  };

  // Recalculate every milestone due date from the deal's contract (executed) date
  // and refresh Win-the-Day. Shows the resulting dates so you can SEE what's set —
  // the definitive fix + diagnostic for any "dates look wrong" situation. Keeps
  // your progress (only dates change), unlike Reset & Rebuild.
  const [recalcing, setRecalcing] = useState(false);
  const handleRecalc = async () => {
    setRecalcing(true);
    try {
      const res = await fetch(API + "/transactions/" + tx.id + "/recalculate-dates", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Failed");
      await fetchMilestones();
      const lines = (d.milestones || []).slice(0, 30).map(m => `• ${m.name}: ${m.due || "no date yet"}`).join("\n");
      alert(
        `Dates recalculated from the contract date.\n\n` +
        `Contract (executed) date: ${d.executedDate || "NOT SET"}\n` +
        `Closing date: ${d.closingDate || "not set"}\n` +
        `Status: ${d.status}\n` +
        `Updated ${d.changed} date${d.changed === 1 ? "" : "s"}.\n\n` +
        `Timeline now:\n${lines}`
      );
    } catch (e) { alert("Could not recalculate: " + e.message); }
    setRecalcing(false);
  };

  const handleComplete = async (milestoneId) => {
    setCompleting(milestoneId);
    try {
      await fetch(mBase + milestoneId + "/complete", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token }
      });
      setMilestones(prev => prev.map(m =>
        m.id === milestoneId ? { ...m, status: "Completed", completed_at: new Date().toISOString() } : m
      ));
    } catch (e) { alert("Error completing milestone"); }
    setCompleting(null);
  };

  // Undo an accidental completion — reverts the milestone back to Pending.
  const handleReopen = async (milestoneId) => {
    if (!window.confirm("Reopen this step? It goes back to pending and reminders resume.")) return;
    setCompleting(milestoneId);
    try {
      const r = await fetch(mBase + milestoneId + "/reopen", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token }
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Failed");
      setMilestones(prev => prev.map(m =>
        m.id === milestoneId ? { ...m, status: "Pending", completed_at: null, completed_by_name: null } : m
      ));
    } catch (e) { alert("Error reopening milestone"); }
    setCompleting(null);
  };

  // Scheduling-type milestone (e.g. "Inspection Scheduled"): record the date the
  // buyer's agent gave us and mark it done — no document needed.
  const handleSchedule = async (milestoneId, date, time, access) => {
    if (!date) { alert("Pick the scheduled date first."); return; }
    setCompleting(milestoneId);
    try {
      const r = await fetch(mBase + milestoneId + "/schedule", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ date, time: time || null, complete: true, accessWho: access?.who || null, accessCode: access?.code || null })
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Failed");
      setMilestones(prev => prev.map(m =>
        m.id === milestoneId ? { ...m, status: "Completed", completed_at: new Date().toISOString(), scheduled_date: date, scheduled_time: time || null, notes: d.milestone?.notes ?? m.notes } : m
      ));
    } catch (e) { alert("Error saving scheduled date: " + e.message); }
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
  const [closingModalFor, setClosingModalFor] = useState(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [waiveJustification, setWaiveJustification] = useState("");
  const [waiveConfirm, setWaiveConfirm] = useState(false);
  const [waiving, setWaiving] = useState(false);

  const handleWaive = async () => {
    if (!waiveModalFor) return;
    if (!waiveReason) { alert("Select a reason for waiving."); return; }
    
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
      await fetchMilestones();
      await fetchCompliance();
      setWaiveModalFor(null);
      setWaiveReason("");
      setWaiveJustification("");
      setWaiveConfirm(false);
    } catch (e) { alert("Error waiving milestone: " + e.message); }
    setWaiving(false);
  };

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const daysUntil = (d) => d ? Math.round((new Date(String(d).slice(0, 10) + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000) : null;

  const getMilestoneStatus = (m) => {
    if (m.status === "Completed") return "completed";
    if (m.status === "Waived") return "waived";
    if (!m.due_date) return "pending";
    const days = daysUntil(m.due_date);
    if (days < 0) return "overdue";
    if (days === 0) return "today";
    if (days <= 3) return "soon";
    return "upcoming";
  };

  const statusConfig = {
    completed: { color: "#1E8449", bg: "#D5F5E3", label: "Done", icon: "✅" },
    waived:    { color: "#92400E", bg: "#FEF3C7", label: "Waived", icon: "⚠️" },
    overdue:   { color: "#C0392B", bg: "#FADBD8", label: "Overdue", icon: "🔴" },
    today:     { color: "#C0392B", bg: "#FADBD8", label: "Due Today", icon: "⚡" },
    soon:      { color: "#B7770D", bg: "#FEF9E7", label: "Due Soon", icon: "🟡" },
    upcoming:  { color: "#555555", bg: "#F4F4F4", label: "Upcoming", icon: "⏳" },
    pending:   { color: "#555555", bg: "#F4F4F4", label: "Pending", icon: "○" },
  };

  // Auto-TC: one combined timeline grouped by phase (Active → Under Contract → Closing).
  const PHASE_META = {
    active:   { label: "📋 Active — Pre-Contract Checklist", order: 0 },
    contract: { label: "📝 Under Contract", order: 1 },
    closing:  { label: "🔑 Closing", order: 2 },
    other:    { label: "Other", order: 3 },
  };
  const OWNER_LABELS = {
    listing_agent: "Listing Agent", buyer_agent: "Buyer's Agent", seller_agent: "Listing Agent",
    shared: "Both Agents", title: "Title", lender: "Lender", inspector: "Inspector",
    buyer: "Buyer", seller: "Seller", hoa: "HOA",
  };

  // Plain-English "how do I know this is done?" note for steps agents commonly
  // ask about. Keyed off the system template NAME (regex), so it works statewide
  // for every tenant. Returns null when there's nothing helpful to add.
  const milestoneHelpText = (name) => {
    const n = (name || "").toLowerCase();
    if (/compliance audit|file complete/.test(n))
      return "Mark done when the file is complete: no \"compliance gap\" alerts on this deal (every required document uploaded), all signed disclosures and the executed contract are in, and the other closing steps are done. If you're closing the file without a document you know is missing, use Waive — N/A instead.";
    if (/thank-?you|review request/.test(n))
      return "Mark done once you've sent your client a thank-you note and asked for a review or testimonial. This is a private reminder — it doesn't email the client automatically.";
    return null;
  };

  // Appointment-type milestones: the responsible party comes back with a concrete
  // date (and usually a clock time) — the agent records it here so the timeline +
  // reminders anchor to the real appointment. Keyed off the system template NAME,
  // so it works statewide for every tenant. "Closing Scheduled" is excluded — it
  // has its own modal (date + time + location + amount + client email).
  const fmtTime = (t) => {
    if (!t) return "";
    const [hStr, m] = String(t).split(":");
    let h = parseInt(hStr, 10);
    if (isNaN(h)) return t;
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + (m || "00") + " " + ap;
  };

  const milestoneScheduleSpec = (name) => {
    const n = (name || "").toLowerCase();
    if (/closing scheduled/.test(n)) return null;
    // Inspections are appointments — but the inspection-PERIOD deadline is not.
    if (/inspection/.test(n) && !/period|binsr/.test(n)) return { time: true };
    if (/professional photos/.test(n)) return { time: true };
    if (/walk-?through/.test(n)) return { time: true };
    if (/appraisal (ordered|scheduled)/.test(n)) return { time: true };
    if (/showings?|property tours?/.test(n)) return { time: true };
    if (/wdo|termite/.test(n)) return { time: true };
    return null;
  };

  const grouped = milestones.reduce((acc, m) => {
    const key = (m.phase && PHASE_META[m.phase]) ? m.phase : "other";
    acc[key] = acc[key] || [];
    acc[key].push(m);
    return acc;
  }, {});
  const orderedPhases = Object.keys(grouped).sort((a, b) => (PHASE_META[a]?.order ?? 9) - (PHASE_META[b]?.order ?? 9));

  // COMPLIANCE GATE (listings): the signed listing package is what authorizes the
  // agent to market the home, so the launch actions (photos, MLS go-live, sign,
  // showings) stay LOCKED until "Listing Package Signed & Executed" is done.
  const isListingDeal = /listing|seller/i.test(tx?.transaction_type || tx?.transactionType || tx?.type || "");
  const listingGateMs = milestones.find(m => /listing package signed/i.test(m.name || ""));
  const listingGateSatisfied = !listingGateMs || ["completed", "waived"].includes(getMilestoneStatus(listingGateMs));
  const isLaunchLocked = (m) => isListingDeal && !listingGateSatisfied
    && /^(Marketing|Access)$/.test(m.category || "")
    && !/listing package signed/i.test(m.name || "");

  // N/A items (e.g. appraisal steps on a cash deal) don't count against
  // progress — a finished deal must read 100%, not 96%.
  const countable = milestones.filter(m => m.is_na !== true);
  const completed = countable.filter(m => m.status === "Completed" || m.status === "Waived").length;
  const total = countable.length;
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
          Build This Deal's Timeline
        </div>
        <div style={{ color: "#555", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Create the full start-to-finish checklist for this deal — built automatically for its
          current stage and contract details. Due dates fill in from the contract date when one is set.
        </div>
        {(!tx.openDate && !tx.executedDate) && (
          <div style={{ background: "#FEF9E7", border: "1px solid #F9CA24", borderRadius: 10,
            padding: 12, marginBottom: 20, fontSize: 13, color: "#B7770D" }}>
            Tip: add a contract date so deadlines and reminders can be calculated. (You can build the list now either way.)
          </div>
        )}
        <button onClick={handleReset} disabled={resetting}
          style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 12,
            padding: "14px 32px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
          {resetting ? "Building…" : "🔄 Reset & Rebuild Checklist"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 16 }}>
      {(tx.constructionType === "New Construction") ? (
        <BrokerFilePanel txId={tx.id} token={token} />
      ) : (() => {
        const complianceArr = Object.values(compliance);
        const totalRequired = complianceArr.filter(c => c.documentRequired && c.status !== "Waived").length;
        const uploaded = complianceArr.filter(c => c.documentRequired && c.documentUploaded && c.status !== "Waived").length;
        const completedWithoutDoc = complianceArr.filter(c =>
          c.documentRequired && !c.documentUploaded && c.status === "Completed" && c.status !== "Waived"
        ).length;
        const waivedCount = complianceArr.filter(c => c.status === "Waived").length;
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

      {!tx.openDate && !tx.executedDate && milestones.some(m => !m.due_date && m.phase !== "active") && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 13, color: "#991B1B" }}>
          ⚠️ <b>No contract date set.</b> Add the contract/effective date to this deal so deadlines can be calculated and reminders can go out. Items below have no due date until then.
        </div>
      )}

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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {/* Recalculate Dates is coordination, not financial — available to the
              coordinator too. Reset & Rebuild stays agent-only. */}
          <button onClick={handleRecalc} disabled={recalcing}
            style={{ fontSize: 11, fontWeight: 600, color: "#0c4a6e", background: "#E0F2FE",
              border: "1px solid #7DD3FC", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
            title="Recalculate every milestone due date from the contract (executed) date, and show the dates. Keeps your progress — only dates change.">
            {recalcing ? "Recalculating…" : "🔧 Recalculate Dates"}
          </button>
          {!coordinatorMode && (
          <button onClick={handleReset} disabled={resetting}
            style={{ fontSize: 11, fontWeight: 600, color: "#555", background: "#F9FAFB",
              border: "1px solid #E5E7EB", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
            title="Clear and rebuild this deal's full timeline from the latest template. Documents and parties are not touched.">
            {resetting ? "Rebuilding…" : "🔄 Reset & Rebuild Checklist"}
          </button>
          )}
        </div>
      </div>

      {orderedPhases.map((phaseKey) => {
        const items = grouped[phaseKey];
        const isNC = tx.constructionType === "New Construction";
        const visibleItems = isNC ? items.filter(m => m.is_na !== true && getMilestoneStatus(m) !== "waived") : items;
        if (visibleItems.length === 0) return null;
        const phaseLabel = PHASE_META[phaseKey]?.label || phaseKey;
        return (
        <div key={phaseKey} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1a2332", letterSpacing: 0.3,
            marginBottom: 10, paddingBottom: 6, borderBottom: "2px solid #EEE" }}>{phaseLabel}</div>
          {visibleItems.map(m => {
            const ms = getMilestoneStatus(m);
            const cfg = statusConfig[ms];
            const days = daysUntil(m.due_date);
            const isCompleted = ms === "completed";
            const isWaived = ms === "waived";
            const isClosed = isCompleted || isWaived;
            // Scheduling-type step: capture the appointment date (and time) the
            // responsible party communicates, instead of a document. Covers photos,
            // inspections, WDO/termite, appraisal visit, walk-through, showings, etc.
            const isClosingSchedule = /closing scheduled/i.test(m.name || "");
            const scheduleSpec = milestoneScheduleSpec(m.name);
            const isScheduling = !!scheduleSpec;
            const launchLocked = isLaunchLocked(m);
            return (
              <div key={m.id} style={{ background: "#fff", borderRadius: 12, padding: 14,
                marginBottom: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                borderLeft: "4px solid " + (isClosed ? (isWaived ? "#92400E" : "#1E8449") : cfg.color),
                opacity: isClosed ? 0.75 : 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontSize: 18 }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#111",
                      textDecoration: isClosed ? "line-through" : "none", marginBottom: 4 }}>
                      {m.name}
                      {m.is_hard_block && !isClosed && tx.constructionType !== "New Construction" && (
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700,
                          color: "#C0392B", background: "#FADBD8",
                          padding: "2px 7px", borderRadius: 20 }}>REQUIRED</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#777", marginBottom: 2 }}>
                      {m.category}{m.owner_role && OWNER_LABELS[m.owner_role] ? " · 👤 " + OWNER_LABELS[m.owner_role] : ""}
                    </div>
                    {!isClosed && milestoneHelpText(m.name) && (
                      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "6px 9px", marginTop: 4, marginBottom: 2, fontSize: 11, lineHeight: 1.5, color: "#1E40AF" }}>
                        💡 {milestoneHelpText(m.name)}
                      </div>
                    )}
                    {m.due_date && (
                      <div style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>
                        {isWaived ? "Waived" : isCompleted ? "Completed" :
                         days === 0 ? "Due today" :
                         days < 0 ? Math.abs(days) + "d overdue" :
                         "Due in " + days + "d"} · {m.due_date}
                      </div>
                    )}
                    {m.scheduled_date && (
                      <div style={{ fontSize: 12, color: "#1E8449", fontWeight: 700, marginTop: 2 }}>📅 Scheduled: {m.scheduled_date}{m.scheduled_time ? " · " + fmtTime(m.scheduled_time) : ""}</div>
                    )}
                    {m.notes && (
                      <div style={{ fontSize: 12, color: "#0e7490", marginTop: 2 }}>🔑 {m.notes}</div>
                    )}
                    {m.requires_document && !m.document_uploaded && !isClosed && m.status !== "Waived" && (
                      <div style={{ fontSize: 11, color: "#B7770D", marginTop: 2 }}>📎 Document required</div>
                    )}
                    {isCompleted && m.completed_by_name && (
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>by {m.completed_by_name}</div>
                    )}
                    {isClosed && !isWaived && compliance[m.id]?.documentRequired && !compliance[m.id]?.documentUploaded && (
                      <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 6, padding: 8, marginTop: 6, fontSize: 11, color: "#991B1B" }}>
                        ⚠️ Compliance gap: marked complete but missing {compliance[m.id].requiredDocType}
                      </div>
                    )}
                  </div>
                </div>
                {compliance[m.id]?.documentRequired && !isClosed && compliance[m.id]?.status !== "Waived" && (
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
                {isClosed && !isWaived && compliance[m.id]?.documentRequired && !compliance[m.id]?.documentUploaded && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {availableDocs.length > 0 && (
                      <select value="" disabled={uploadingFor === m.id}
                        onChange={e => assignExistingToMilestone(m.id, e.target.value)}
                        title="Attach a file already on this deal"
                        style={{ flex: "1 1 160px", padding: "9px 10px", borderRadius: 8, border: "1.5px solid #C0392B",
                          fontSize: 13, fontFamily: "inherit", background: "#fff", color: "#C0392B", fontWeight: 600, cursor: "pointer" }}>
                        <option value="">📄 Use existing document…</option>
                        {availableDocs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    )}
                    <button onClick={() => handleUploadClick(m.id)} disabled={uploadingFor === m.id}
                      style={{ flex: "1 1 160px", padding: "10px 0", borderRadius: 8, border: "1.5px solid #C0392B",
                        background: "#fff", color: "#C0392B", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      {uploadingFor === m.id ? "Uploading..." : "📎 Upload Missing Document"}
                    </button>
                  </div>
                )}
                {isClosed && (
                  <div style={{ marginTop: 10 }}>
                    <button onClick={() => handleReopen(m.id)} disabled={completing === m.id}
                      style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #D1D5DB",
                        background: "#fff", color: "#555", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                      {completing === m.id ? "..." : "↩ Reopen (undo)"}
                    </button>
                    <span style={{ fontSize: 11, color: "#999", marginLeft: 8 }}>Clicked done by mistake? Put it back.</span>
                  </div>
                )}
                {!isClosed && launchLocked && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12,
                    background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px" }}>
                    <span style={{ fontSize: 16 }}>🔒</span>
                    <div style={{ fontSize: 12, color: "#991B1B", lineHeight: 1.5 }}>
                      Locked until the <b>listing package is signed</b>. Florida requires the signed listing agreement and disclosures before you market the home — complete <b>“Listing Package Signed &amp; Executed”</b> at the top to unlock this.
                    </div>
                  </div>
                )}
                {!isClosed && !launchLocked && isClosingSchedule && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <button onClick={() => setClosingModalFor(m)}
                      style={{ flex: "2 1 240px", padding: "11px 0", borderRadius: 8, border: "none",
                        background: "#1E3A8A", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      🗓️ Set Closing Date & Notify Client
                    </button>
                    <div style={{ flex: "1 1 100%", fontSize: 11, color: "#555", marginTop: 2 }}>
                      Enter the closing date/time/location & amount the title company or attorney gave you. You'll review &amp; edit the email before it's sent — to your side only.
                    </div>
                    <button onClick={() => coordinatorMode ? alert("Waiving a required document is the agent's decision. Mark the milestone done if you have what you need, or ask the agent to waive it.") : setWaiveModalFor(m)}
                      style={{ flex: "1 1 90px", padding: "9px 0", borderRadius: 8,
                        border: "1.5px solid #E5B14A", background: "#FFFBEB",
                        color: "#92400E", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                      ⚠️ Waive — N/A
                    </button>
                  </div>
                )}
                {!isClosed && !launchLocked && isScheduling && (() => {
                  const dVal = scheduleDates[m.id] ?? (m.scheduled_date || "");
                  const tVal = scheduleTimes[m.id] ?? (m.scheduled_time || "");
                  const isInspection = /inspection|wdo|termite/i.test(m.name || "");
                  const aVal = scheduleAccess[m.id] || { who: "", code: "" };
                  const setA = (patch) => setScheduleAccess(sa => ({ ...sa, [m.id]: { ...aVal, ...patch } }));
                  return (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <input type="date" value={dVal}
                      onChange={e => setScheduleDates(s => ({ ...s, [m.id]: e.target.value }))}
                      style={{ flex: "1 1 140px", padding: "9px 10px", borderRadius: 8, border: "1.5px solid #D1D5DB", fontSize: 13, fontFamily: "inherit" }} />
                    {scheduleSpec.time && (
                      <input type="time" value={tVal}
                        onChange={e => setScheduleTimes(s => ({ ...s, [m.id]: e.target.value }))}
                        style={{ flex: "1 1 110px", padding: "9px 10px", borderRadius: 8, border: "1.5px solid #D1D5DB", fontSize: 13, fontFamily: "inherit" }} />
                    )}
                    {isInspection && (
                      <>
                        <input type="text" value={aVal.who} placeholder="Who lets the inspector in? (lockbox / listing agent / seller home)"
                          onChange={e => setA({ who: e.target.value })}
                          style={{ flex: "2 1 240px", padding: "9px 10px", borderRadius: 8, border: "1.5px solid #D1D5DB", fontSize: 13, fontFamily: "inherit" }} />
                        <input type="text" value={aVal.code} placeholder="Door / lockbox code (optional)"
                          onChange={e => setA({ code: e.target.value })}
                          style={{ flex: "1 1 160px", padding: "9px 10px", borderRadius: 8, border: "1.5px solid #D1D5DB", fontSize: 13, fontFamily: "inherit" }} />
                      </>
                    )}
                    <button onClick={() => handleSchedule(m.id, dVal, tVal, isInspection ? aVal : null)} disabled={completing === m.id || !dVal}
                      style={{ flex: "2 1 220px", padding: "10px 0", borderRadius: 8, border: "none",
                        background: dVal ? "#1E8449" : "#9CA3AF", color: "#fff", fontWeight: 700, fontSize: 13, cursor: dVal ? "pointer" : "not-allowed" }}>
                      {completing === m.id ? "Saving..." : "✓ Confirm Date" + (scheduleSpec.time ? " & Time" : "") + " & Mark Done"}
                    </button>
                    <div style={{ flex: "1 1 100%", fontSize: 11, color: "#555", marginTop: 2 }}>
                      Enter the date{scheduleSpec.time ? " and time" : ""} the responsible party gave you. It's recorded on the deal so you can follow up, and reminders anchor to it.
                    </div>
                    <button onClick={() => coordinatorMode ? alert("Waiving a required document is the agent's decision. Mark the milestone done if you have what you need, or ask the agent to waive it.") : setWaiveModalFor(m)}
                      style={{ flex: "1 1 90px", padding: "9px 0", borderRadius: 8,
                        border: "1.5px solid #E5B14A", background: "#FFFBEB",
                        color: "#92400E", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                      ⚠️ Waive — N/A
                    </button>
                  </div>
                  );
                })()}
                {!isClosed && !launchLocked && !isScheduling && !isClosingSchedule && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {compliance[m.id]?.documentRequired && tx.constructionType !== "New Construction" ? (
                      <>
                        <button onClick={() => handleUploadClick(m.id)} disabled={uploadingFor === m.id}
                          style={{ flex: "2 1 200px", padding: "10px 0", borderRadius: 8, border: "none",
                            background: "#C0392B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                          {uploadingFor === m.id ? "Uploading..." : "📎 Upload Document & Complete"}
                        </button>
                        {availableDocs.length > 0 && (
                          <select value="" disabled={uploadingFor === m.id}
                            onChange={e => assignExistingToMilestone(m.id, e.target.value)}
                            title="Attach a file already on this deal"
                            style={{ flex: "1 1 160px", padding: "9px 10px", borderRadius: 8, border: "1.5px solid #C0392B",
                              fontSize: 13, fontFamily: "inherit", background: "#fff", color: "#C0392B", fontWeight: 600, cursor: "pointer" }}>
                            <option value="">📄 Use existing document…</option>
                            {availableDocs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        )}
                        <button onClick={() => handleComplete(m.id)} disabled={completing === m.id}
                          style={{ flex: "1 1 130px", padding: "10px 0", borderRadius: 8, border: "1.5px solid #1E8449",
                            background: "#fff", color: "#1E8449", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                          {completing === m.id ? "Saving..." : "✓ Mark Done"}
                        </button>
                        <div style={{ flex: "1 1 100%", fontSize: 11, color: "#92400E", textAlign: "center", marginTop: 2 }}>
                          📎 Already uploaded it? Pick "Use existing document" to file it here — no need to upload twice.
                        </div>
                      </>
                    ) : (
                      <button onClick={() => handleComplete(m.id)} disabled={completing === m.id}
                        style={{ flex: 2, padding: "9px 0", borderRadius: 8, border: "none",
                          background: "#C0392B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        {completing === m.id ? "Saving..." : "Mark Complete"}
                      </button>
                    )}
                    <button onClick={() => coordinatorMode ? alert("Waiving a required document is the agent's decision. Mark the milestone done if you have what you need, or ask the agent to waive it.") : setWaiveModalFor(m)}
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
        );
      })}


      {closingModalFor && (
        <ScheduleClosingModal tx={tx} token={token} milestone={closingModalFor}
          onClose={() => setClosingModalFor(null)}
          onDone={async () => { setClosingModalFor(null); await fetchMilestones(); }} />
      )}

      {waiveModalFor && (
        <div onClick={() => !waiving && setWaiveModalFor(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 14, padding: 22, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", margin: "auto" }}>
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
                <option value="Bundled with another document upload">Bundled with another document upload</option>
                <option value="Document exists outside our system">Document exists outside our system (e.g. brokerage uses different form)</option>
                <option value="Buyer/seller declined">Buyer/seller declined and signed waiver</option>
                <option value="Other">Other (explain in justification)</option>
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#1a2332", marginBottom: 6 }}>Justification <span style={{ color: "#C0392B" }}>*</span></label>
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
              <button onClick={handleWaive} disabled={waiving || !waiveReason || !waiveConfirm}
                style={{ flex: 2, padding: "11px 0", borderRadius: 8, border: "none", background: (waiving || !waiveReason || !waiveConfirm) ? "#D1A878" : "#92400E", color: "#fff", fontWeight: 700, fontSize: 14, cursor: (waiving || !waiveReason || !waiveConfirm) ? "not-allowed" : "pointer" }}>
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

  const isSeller = /listing|seller/i.test(tx.type || "");
  const client = (tx.parties || []).find(p => p.role === (isSeller ? "Seller" : "Buyer"));
  const budget = tx.listPrice ? "$" + Number(tx.listPrice).toLocaleString() : "Not specified";
  const totalSteps = isSeller ? 7 : 5;

  const toggleStep = async (stepNumber) => {
    setUpdating(stepNumber);
    const newDone = stepsDone.includes(stepNumber) ? false : true;
    try {
      const r = await fetch(API_URL + "/transactions/" + tx.id + "/intake-step", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ stepNumber, done: newDone, totalSteps })
      });
      const d = await r.json();
      if (d.success) {
        setStepsDone(d.steps);
        if (d.allDone && onContactLogged) onContactLogged();
      }
    } catch (e) { alert("Failed: " + e.message); }
    setUpdating(null);
  };

  const allDone = Array.from({ length: totalSteps }, (_, i) => i + 1).every(n => stepsDone.includes(n));
  if (allDone) return null;

  const steps = isSeller ? [
    { num: 1, icon: "📞", title: "Contact the seller within 24 hours", why: "Prompt response wins the listing and establishes your fiduciary relationship.", action: client?.phone ? "Call or text " + (client.name || "seller") + " at " + client.phone : client?.email ? "Email " + (client.name || "seller") + " at " + client.email : "Add seller contact info first" },
    { num: 2, icon: "🤝", title: "Schedule a Listing Consultation", why: "Review the home, timeline, and pricing — and present your marketing plan.", action: "Set up a 30–60 minute walkthrough (in person or video)" },
    { num: 3, icon: "📋", title: "Sign the Listing Agreement (Exclusive Right of Sale)", why: "Required under Florida law before marketing the property. Establishes your commission.", action: "Send via DocuSign, Dotloop, or in person at the consultation" },
    { num: 4, icon: "📸", title: "Schedule professional photography", why: "Quality photos are the #1 driver of online showings — book before going live.", action: "Book a photographer (add drone/video for luxury or acreage)" },
    { num: 5, icon: "📝", title: "Write the listing copy & enter MLS data", why: "Complete, accurate MLS data and compelling copy maximize exposure and avoid compliance issues.", action: "Draft the description and enter every property detail in the MLS" },
    { num: 6, icon: "🪧", title: "Place sign & install lockbox", why: "Signage captures drive-by interest; the lockbox lets agents show the home.", action: "Order/install the yard sign and set up the lockbox for showings" },
    { num: 7, icon: "💰", title: "Confirm pricing with a CMA", why: "An accurate list price from a comparative market analysis prevents stale-listing price drops.", action: "Run a CMA for " + (tx.address || "the property") + " and review it with the seller" },
  ] : [
    { num: 1, icon: "📞", title: "Contact the buyer within 24 hours", why: "Florida law requires prompt response. First contact establishes your fiduciary relationship.", action: client?.phone ? "Call or text " + (client.name || "buyer") + " at " + client.phone : client?.email ? "Email " + (client.name || "buyer") + " at " + client.email : "Add buyer contact info first" },
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
          <div style={{ fontWeight: 800, color: "#991b1b", fontSize: 16 }}>{isSeller ? "New Seller Listing" : "New Buyer Inquiry"} — {doneCount}/{totalSteps} Steps Complete</div>
          <div style={{ fontSize: 13, color: "#7f1d1d", marginTop: 2 }}>
            {client ? (client.name || "") + (client.phone ? " · " + client.phone : "") + (client.email ? " · " + client.email : "") : (isSeller ? "Seller info in parties tab" : "Buyer info in parties tab")} · {isSeller ? "List price" : "Budget"}: {budget}
          </div>
        </div>
      </div>
      <div style={{ background: "#fecaca", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ background: "#1e8449", height: "100%", width: (doneCount / totalSteps * 100) + "%", transition: "width 0.3s" }} />
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
      warning += "\n   (Add their email in the People tab if they should receive it.)\n";
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
      const sentList = (d.sent || []).map(p => `  ✅ ${p.name} (${p.role}) — ${p.email}`).join("\n");
      const failedList = (d.failed || []).map(p => `  ❌ ${p.name} (${p.role}) — ${p.email}\n      → ${p.error}`).join("\n");
      if (d.success && (d.emailsSent || 0) > 0) {
        alert(`✅ Welcome emails sent to ${d.emailsSent} parties.${sentList ? "\n\n" + sentList : ""}`);
        toggleStep(2);
      } else if ((d.emailsSent || 0) > 0 && (d.emailsFailed || 0) > 0) {
        alert(`⚠️ Partial send: ${d.emailsSent} delivered, ${d.emailsFailed} FAILED.\n\nDelivered:\n${sentList}\n\nFailed:\n${failedList}`);
      } else if ((d.emailsFailed || 0) > 0) {
        alert(`❌ No welcome emails delivered (${d.emailsFailed} failed).\n\n${failedList}`);
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
    { num: 2, icon: "👥", title: "Verify All Parties & Contact Info", why: "Title, lender, inspector, co-op agent must be reachable. Missing email or phone breaks the welcome email and the entire group communication chain. The wrong title company at closing causes wire fraud risk.", action: "Open the People tab. Confirm every party has a name, working phone, and email. Add any missing parties (e.g. title company, lender) that the contract names but were not extracted.", cta: "Open People Tab", onCta: () => { setPartiesOpened(true); setActiveTab("parties"); }, isPartiesStep: true },
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 540, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden", margin: "auto" }}>
        <div style={{ background: "#f59e0b", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>⚠️ Assign This Lead to an Agent</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          {/* Lead summary */}
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: "#78350f", fontWeight: 700, marginBottom: 4 }}>Lead Details</div>
            <div style={{ fontSize: 14, color: "#1a2332" }}>{tx.address}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{tx.type || (isBuyer ? "Buyer Representation" : "Listing (Seller)")} · {tx.parties && tx.parties[0] ? tx.parties[0].name : "Party info in transaction"}</div>
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

// Notes textarea that signals when there's more text than fits — shows a
// "⌄ more" badge in the corner whenever the content overflows and isn't
// scrolled to the bottom, so the agent knows to keep reading.
function NotesField({ value, onChange }) {
  const ref = useRef(null);
  const [more, setMore] = useState(false);

  const recompute = () => {
    const el = ref.current;
    if (!el) return;
    // more text below if not scrolled to the bottom (small tolerance)
    setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 4);
  };
  useEffect(() => { recompute(); }, [value]);

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={ref}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        onScroll={recompute}
        rows={4}
        style={{ width: "100%", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", fontFamily: "inherit", fontSize: 14, resize: "vertical", boxSizing: "border-box", overflowY: "auto" }}
      />
      {more && (
        <div
          onClick={() => { const el = ref.current; if (el) el.scrollBy({ top: el.clientHeight - 24, behavior: "smooth" }); }}
          title="More notes below — click to scroll"
          style={{ position: "absolute", right: 12, bottom: 12, background: COLORS.navy, color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.25)", pointerEvents: "auto", userSelect: "none" }}
        >
          ⌄ more
        </div>
      )}
    </div>
  );
}

// Notes section on the Overview tab: an "Add Note" composer that prepends a
// dated note on top, leaving any auto-captured intake notes intact below.
function NotesSection({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const addNote = () => {
    const t = draft.trim();
    if (!t) return;
    const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    const entry = `[${stamp}] ${t}`;
    onChange(value && value.trim() ? entry + "\n\n" + value : entry);
    setDraft("");
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-start" }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addNote(); } }}
          rows={2}
          placeholder="Add a new note… it'll be added on top of the notes below"
          style={{ flex: 1, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", fontFamily: "inherit", fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
        />
        <Btn onClick={addNote} small>+ Add Note</Btn>
      </div>
      <NotesField value={value} onChange={onChange} />
    </div>
  );
}

// Every outbound email + text this deal has sent (message_log), newest first —
// the audit trail an agent checks when a party says "I never got it."
function SentHistoryPanel({ txId }) {
  const [rows, setRows] = useState(null);
  const [openId, setOpenId] = useState(null);
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(`${API}/client/messages/${txId}`, { headers: { Authorization: "Bearer " + tok } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setRows(((d && d.messages) || []).filter(m => (m.direction || "outbound") === "outbound").reverse()))
      .catch(() => setRows([]));
  }, [txId]);
  if (rows === null) return <div style={{ padding: 24, color: COLORS.muted, fontSize: 13 }}>Loading sent history…</div>;
  if (rows.length === 0) return <div style={{ padding: 24, color: COLORS.muted, fontSize: 13 }}>Nothing sent on this deal yet — welcome emails, reminders, and updates will show here the moment they go out.</div>;
  return (
    <div style={{ padding: 12 }}>
      {rows.map(m => {
        const isOpen = openId === m.id;
        const when = m.created_at ? new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
        return (
          <div key={m.id} onClick={() => setOpenId(isOpen ? null : m.id)}
            style={{ border: "1px solid " + COLORS.border, borderRadius: 10, padding: "10px 14px", marginBottom: 8, cursor: "pointer", background: "#fff" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 15 }}>{m.channel === "sms" ? "📱" : "📧"}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.text }}>{m.to_name || m.to_email || m.to_phone || "—"}</span>
              <span style={{ fontSize: 12, color: COLORS.muted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isOpen ? "normal" : "nowrap" }}>{m.subject || (m.body || "").slice(0, 80)}</span>
              <span style={{ fontSize: 11, color: COLORS.muted, whiteSpace: "nowrap" }}>{when}</span>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid " + COLORS.bg, fontSize: 13, color: COLORS.text, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {(m.to_email || m.to_phone) && <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>To: {[m.to_email, m.to_phone].filter(Boolean).join(" · ")}</div>}
                {m.body || "(no message body recorded)"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// After an offer is accepted, preview every welcome/initial email before sending.
// The agent reviews each rendered email and clicks Send per recipient (or Send All).
// HOA + no-email parties are listed as skipped (never emailed).
// Exported: OffersTab opens this after ✅ Accepted (review-gated — accept itself
// never sends anything).
export function WelcomeEmailPreview({ txId, onClose, onlyPartyId = null }) {
  const hdrs = { "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") };
  const [previews, setPreviews] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sel, setSel] = useState(0);
  const [sentIds, setSentIds] = useState({});   // partyId -> true
  const [busy, setBusy] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [excludedDocs, setExcludedDocs] = useState({}); // docId -> true (removed by agent)
  const fileRef = useRef(null);
  // "Attach another file" → pick from the deal's own documents (Carlos 7/24:
  // the full executed contract is already here; don't make me re-upload it).
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [dealDocs, setDealDocs] = useState([]);
  const loadDealDocs = async () => {
    try {
      const r = await fetch(`${API}/documents/${txId}`, { headers: hdrs });
      const d = await r.json();
      setDealDocs((d.documents || []).filter(x => /pdf$/i.test(x.mime_type || "")));
    } catch { setDealDocs([]); }
  };
  // Attaching an existing doc = tag it "Offer / Contract" so it becomes a
  // shareable contract attachment, then refresh the previews.
  const attachExisting = async (docId) => {
    setAttaching(true);
    try {
      await fetch(`${API}/documents/${docId}/category`, {
        method: "PATCH", headers: { ...hdrs, "Content-Type": "application/json" },
        body: JSON.stringify({ category: "Contract Package" }),
      });
      setExcludedDocs(s => { const n = { ...s }; delete n[docId]; return n; });
      await loadPreviews();
      setShowDocPicker(false);
    } catch (e) { alert("Could not attach: " + e.message); }
    finally { setAttaching(false); }
  };

  const removeAttachment = (docId) => setExcludedDocs(s => ({ ...s, [docId]: true }));
  const restoreAttachment = (docId) => setExcludedDocs(s => { const n = { ...s }; delete n[docId]; return n; });
  const excludeList = () => Object.keys(excludedDocs);

  const previewDoc = async (docId) => {
    try {
      const r = await fetch(`${API}/documents/${docId}/view-url`, { headers: hdrs });
      const d = await r.json();
      if (!d.success || !d.viewUrl) throw new Error(d.error || "Could not open document");
      window.open(d.viewUrl, "_blank", "noopener");
    } catch (e) { alert(e.message); }
  };

  const loadPreviews = (seedDefaults) => {
    return fetch(`${API}/transactions/${txId}/welcome-emails/preview`, { method: "POST", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then(r => r.json())
      .then(d => {
        if (!d.success) throw new Error(d.error || "Could not build previews");
        // Single-party mode (✉️ Send Welcome on one person's card): show only
        // that recipient's email — same preview + attachments, scoped down.
        let pv = d.previews || [];
        if (onlyPartyId) pv = pv.filter(p => String(p.partyId) === String(onlyPartyId));
        setPreviews(pv);
        setSkipped(onlyPartyId ? [] : (d.skipped || []));
        if (onlyPartyId && pv.length === 0) throw new Error("Couldn't build a preview for this person — check they have a valid email, then try again.");
        // Default attachments to the MAIN contract only — pre-exclude addenda/
        // disclosures; the agent opts them back in with "undo". Only seed once.
        if (seedDefaults) {
          const ex = {};
          pv.forEach(p => (p.attachments || []).forEach(a => { if (!a.isBaseContract && a.id) ex[a.id] = true; }));
          setExcludedDocs(ex);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadPreviews(true); }, [txId]);

  // Attach an extra file: upload it to the transaction as a Contract Package
  // document so it rides along on the welcome emails, then refresh the preview.
  const attachFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("File too large — max 10 MB so it fits as an email attachment."); return; }
    setAttaching(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const rd = new FileReader();
        rd.onload = () => resolve(String(rd.result).split(",")[1]);
        rd.onerror = () => reject(new Error("Could not read file"));
        rd.readAsDataURL(file);
      });
      const r = await fetch(`${API}/documents/upload`, {
        method: "POST", headers: { ...hdrs, "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txId, fileName: file.name, fileType: file.type || "application/pdf", category: "Contract Package", base64 })
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      await loadPreviews();
    } catch (e) { alert("Could not attach: " + e.message); }
    finally { setAttaching(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const sendOne = async (p) => {
    if (!p.partyId) { alert("This recipient can't be sent individually (missing id). Use Send All."); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API}/transactions/${txId}/parties/${p.partyId}/send-welcome`, { method: "POST", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify({ excludeDocIds: excludeList() }) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Email was not sent.");
      setSentIds(s => ({ ...s, [p.partyId]: true }));
    } catch (e) { alert("Could not send: " + e.message); }
    finally { setBusy(false); }
  };

  const sendAll = async () => {
    if (!window.confirm(`Send all ${previews.length} welcome email(s) now?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/transactions/${txId}/send-welcome-emails`, { method: "POST", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify({ excludeDocIds: excludeList() }) });
      const d = await r.json();
      const done = {};
      (d.sent || []).forEach(s => { const m = previews.find(p => p.email === s.email); if (m) done[m.partyId] = true; });
      setSentIds(prev => ({ ...prev, ...done }));
      if (d.emailsFailed) alert(`${d.emailsSent} sent, ${d.emailsFailed} failed. Check the ones still marked unsent.`);
      else {
        // All sent — close the screen (Carlos 7/24: staying open after Send All
        // made it look like something was still pending).
        alert(`✅ All ${d.emailsSent} welcome email(s) sent.`);
        onClose();
      }
    } catch (e) { alert("Send all failed: " + e.message); }
    finally { setBusy(false); }
  };

  const cur = previews[sel];
  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  // Near-full-screen: agents review the ENTIRE rendered email here before it
  // sends — a short box forced scrolling inside a tiny iframe and hid content.
  const box = { background: "#fff", borderRadius: 12, width: "100%", maxWidth: 1240, height: "94vh", maxHeight: "94vh", display: "flex", flexDirection: "column", overflow: "hidden" };

  return (
    <div style={overlay}>
      <div style={box}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid " + COLORS.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy }}>✉️ Preview Welcome Emails</div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Review each email, then Send. Nothing is sent until you click Send.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {previews.length > 0 && <button onClick={sendAll} disabled={busy} style={{ background: "#1E8449", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Send All</button>}
            <button onClick={onClose} style={{ background: "#fff", color: COLORS.text, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{Object.keys(sentIds).length > 0 ? "Done" : "Cancel — send later"}</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>Building previews…</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.danger }}>{error}</div>
        ) : previews.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.muted }}>
            No emails to send (no parties with valid email addresses).
            {skipped.length > 0 && <div style={{ marginTop: 8, fontSize: 12 }}>Skipped: {skipped.map(s => `${s.name || s.role} (${s.reason})`).join(", ")}</div>}
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            {/* recipient list */}
            <div style={{ width: 240, borderRight: "1px solid " + COLORS.border, overflowY: "auto", flexShrink: 0 }}>
              {previews.map((p, i) => (
                <div key={p.partyId || i} onClick={() => setSel(i)} style={{ padding: "12px 14px", borderBottom: "1px solid " + COLORS.border, cursor: "pointer", background: i === sel ? "#EFF6FF" : "#fff" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{p.role} · {p.email}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: sentIds[p.partyId] ? "#1E8449" : COLORS.amber, marginTop: 2 }}>{sentIds[p.partyId] ? "✓ Sent" : "Not sent"}</div>
                </div>
              ))}
              {skipped.length > 0 && (
                <div style={{ padding: "10px 14px", fontSize: 11, color: COLORS.muted }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Not emailed</div>
                  {skipped.map((s, i) => <div key={i}>{s.name || s.role} — {s.reason === "hoa_reference_only" ? "HOA (reference only)" : s.reason === "no_email" ? "no email" : s.reason === "duplicate_email" ? "duplicate (same email already included)" : s.reason}</div>)}
                </div>
              )}
            </div>
            {/* rendered email */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid " + COLORS.border, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><strong>To:</strong> {cur?.email} &nbsp; <strong>Subj:</strong> {cur?.subject}</div>
                <button onClick={() => sendOne(cur)} disabled={busy || sentIds[cur?.partyId]} style={{ background: sentIds[cur?.partyId] ? "#9CA3AF" : "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: sentIds[cur?.partyId] ? "default" : "pointer", fontFamily: "inherit", flexShrink: 0 }}>{sentIds[cur?.partyId] ? "✓ Sent" : "Send"}</button>
              </div>
              {/* attachments for this recipient — click name to preview, X to remove */}
              <div style={{ padding: "8px 16px", borderBottom: "1px solid " + COLORS.border, background: "#F9FAFB", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted }}>📎 Attachments:</span>
                {(() => {
                  const all = cur?.attachments || [];
                  const active = all.filter(a => !excludedDocs[a.id]);
                  const removed = all.filter(a => excludedDocs[a.id]);
                  return (
                    <>
                      {active.length === 0 && removed.length === 0 && (
                        <span style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic" }}>None for this recipient{cur && /inspector|hoa/i.test(cur.role || "") ? " (role gets no documents)" : ""}</span>
                      )}
                      {active.map((a) => (
                        <span key={a.id} style={{ fontSize: 12, color: COLORS.text, background: "#fff", border: "1px solid " + COLORS.border, borderRadius: 6, padding: "3px 6px 3px 8px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span onClick={() => previewDoc(a.id)} title="Click to preview" style={{ cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>📄 {a.name}</span>
                          <button onClick={() => removeAttachment(a.id)} title="Remove from emails" style={{ background: "none", border: "none", color: "#B91C1C", cursor: "pointer", fontSize: 14, fontWeight: 800, lineHeight: 1, padding: "0 2px" }}>×</button>
                        </span>
                      ))}
                      {removed.map((a) => (
                        <span key={a.id} style={{ fontSize: 12, color: COLORS.muted, background: "#fff", border: "1px dashed " + COLORS.border, borderRadius: 6, padding: "3px 8px", textDecoration: "line-through", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {a.name}
                          <button onClick={() => restoreAttachment(a.id)} title="Add back" style={{ background: "none", border: "none", color: "#1E8449", cursor: "pointer", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>undo</button>
                        </span>
                      ))}
                    </>
                  );
                })()}
                <input ref={fileRef} type="file" style={{ display: "none" }} onChange={e => attachFile(e.target.files && e.target.files[0])} />
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={() => { setShowDocPicker(true); loadDealDocs(); }} disabled={attaching} style={{ background: "#fff", color: "#1E8449", border: "1px solid #1E8449", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📁 From this deal</button>
                  <button onClick={() => fileRef.current && fileRef.current.click()} disabled={attaching} style={{ background: "#fff", color: "#1E8449", border: "1px solid #1E8449", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{attaching ? "Attaching…" : "📤 Upload"}</button>
                </div>
              </div>
              {showDocPicker && (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid " + COLORS.border, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.navy }}>Pick a document already on this deal</span>
                    <button onClick={() => setShowDocPicker(false)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 16, cursor: "pointer" }}>✕</button>
                  </div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {dealDocs.length === 0 ? (
                      <div style={{ fontSize: 12, color: COLORS.muted, padding: "4px 0" }}>Loading…</div>
                    ) : dealDocs.map(d => (
                      <button key={d.id} disabled={attaching} onClick={() => attachExisting(d.id)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", textAlign: "left", padding: "8px 10px", marginBottom: 4, borderRadius: 7, border: "1px solid " + COLORS.border, background: "#fff", cursor: attaching ? "default" : "pointer", fontFamily: "inherit" }}>
                        <span style={{ fontSize: 12.5, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {d.name}</span>
                        <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: "#1E8449" }}>Attach →</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>Tip: pick <b>“Fully Executed Contract”</b> to attach the complete signed package.</div>
                </div>
              )}
              <div style={{ padding: "4px 16px", fontSize: 11, color: COLORS.muted, borderBottom: "1px solid " + COLORS.border, background: "#F9FAFB" }}>Removing an attachment (×) applies to everyone — it won't be sent to any party.</div>
              {/* Loud guard: this is the deal's INTRO email — sending it to a
                  contract-eligible role with the contract missing is exactly how
                  the title company ended up without the executed contract. */}
              {(() => {
                const all = cur?.attachments || [];
                const active = all.filter(a => !excludedDocs[a.id]);
                const roleGetsDocs = cur && !/inspector|hoa/i.test(cur.role || "");
                const contractAttached = active.some(a => a.isBaseContract);
                if (!roleGetsDocs || contractAttached) return null;
                return (
                  <div style={{ padding: "8px 16px", fontSize: 12.5, fontWeight: 700, color: "#991B1B", background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
                    ⚠️ The executed contract is NOT attached to this email{all.some(a => a.isBaseContract) ? " — click “undo” above to add it back" : " — upload it to Documents (Contract Package) or use “+ Attach another file”"}. This recipient likely needs the contract.
                  </div>
                );
              })()}
              <iframe title="email-preview" srcDoc={cur?.html || ""} style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Pending offers received on a listing. Several can sit here at once; the agent
// reviews them and approves one (which auto-rejects the rest on the server).
function ListingOffers({ txId, txStatus, refreshKey, onReview, onReceiveOffer }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const hdrs = { "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") };

  const load = () => {
    fetch(`${API}/contracts/uploads`, { headers: hdrs })
      .then(r => r.json())
      .then(d => {
        const mine = (d.uploads || []).filter(u =>
          u.existing_transaction_id === txId &&
          ["pending", "extracting", "ready_for_review"].includes(u.status)
        );
        setOffers(mine);
      })
      .catch(e => console.error("Load offers failed:", e))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [txId, refreshKey]);

  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signingId, setSigningId] = useState(null);
  const signedRefs = useRef({});

  // Upload the signed copy (seller signed outside the app) into this offer's folder.
  const uploadSigned = async (offerId, file) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert("File too large (max 50 MB)."); return; }
    setSigningId(offerId);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const rd = new FileReader();
        rd.onload = () => resolve(String(rd.result).split(",")[1]);
        rd.onerror = () => reject(new Error("Could not read file"));
        rd.readAsDataURL(file);
      });
      const r = await fetch(`${API}/contracts/uploads/${offerId}/signed-copy`, {
        method: "POST", headers: { ...hdrs, "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type || "application/pdf", base64 })
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Upload failed");
      load();
      // A signed contract IS the executed agreement — so this is the moment to
      // start the transaction. On a pre-contract listing, AUTOMATICALLY open the
      // Review & Accept flow (no skippable prompt): the agent confirms every date,
      // amount, and party — adding the title company, lender, etc. — then Approve
      // moves the listing to Under Contract and the welcome-email step picks the
      // recipients. Already under contract → just file the replacement copy.
      const preContract = ["Active", "Coming Soon", "New"].includes(txStatus);
      if (preContract) {
        onReview(offerId);
      } else {
        alert("Signed copy saved to this offer's folder in Documents.");
      }
    } catch (e) { alert("Could not upload signed copy: " + e.message); }
    finally { setSigningId(null); }
  };

  const reject = async (id) => {
    if (!window.confirm("Reject this offer? This does not change the listing.")) return;
    try {
      const r = await fetch(`${API}/contracts/uploads/${id}/reject`, { method: "POST", headers: hdrs });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Failed");
      load();
    } catch (e) { alert(e.message); }
  };

  const shareWithSellers = async () => {
    setSharing(true);
    try {
      const r = await fetch(`${API}/transactions/${txId}/offer-share-link`, { method: "POST", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Could not create link");
      setShareUrl(d.url);
    } catch (e) { alert(e.message); }
    finally { setSharing(false); }
  };

  const copyShare = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return null;
  if (offers.length === 0) {
    return (
      <div style={{ background: "#F9FAFB", border: "1px dashed " + COLORS.border, borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: COLORS.muted }}>No pending offers on this listing yet. When a buyer's agent sends one, tap <strong>Receive Offer</strong> to log it here. <em>(You write offers on a buyer deal — not on your own listing.)</em></span>
        <button onClick={onReceiveOffer} style={{ background: "#1E8449", border: "none", color: "#fff", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📥 Receive Offer</button>
      </div>
    );
  }

  const decisionBadge = (d) => {
    if (!d) return null;
    const accepted = d === "accepted";
    return <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: accepted ? "#1E8449" : "#B91C1C", borderRadius: 20, padding: "2px 10px" }}>{accepted ? "✓ Seller accepted" : "Seller declined"}</span>;
  };

  return (
    <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#92400E" }}>📥 Pending Offers ({offers.length})</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={shareWithSellers} disabled={sharing} style={{ background: "#fff", border: "1px solid #1E8449", color: "#1E8449", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{sharing ? "Creating…" : "🔗 Share with Sellers"}</button>
          <button onClick={onReceiveOffer} style={{ background: "#1E8449", border: "none", color: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Receive Another Offer</button>
        </div>
      </div>
      {shareUrl && (
        <div style={{ background: "#fff", border: "1px solid #1E8449", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: "#166534", marginBottom: 6, fontWeight: 600 }}>Send this secure link to your seller(s). They'll see all offers side by side and mark Accept/Decline — their choice shows here. You can re-send it any time; nothing is final until you Accept an offer.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input readOnly value={shareUrl} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: 200, fontSize: 12, padding: "8px 10px", border: "1px solid " + COLORS.border, borderRadius: 6, fontFamily: "inherit" }} />
            <button onClick={copyShare} style={{ background: copied ? "#1E8449" : COLORS.navy, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{copied ? "✓ Copied" : "Copy"}</button>
          </div>
        </div>
      )}
      {offers.map(o => {
        const exd = o.extracted_data || {};
        const t = exd.transaction || {};
        const parties = exd.parties || [];
        const buyer = parties.find(p => (p.role || "").toLowerCase() === "buyer");
        const buyerAgent = parties.find(p => (p.role || "").toLowerCase().includes("buyer") && (p.role || "").toLowerCase().includes("agent"));
        const ready = o.status === "ready_for_review";
        return (
          <div key={o.id} style={{ background: "#fff", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: COLORS.text }}>
              <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {t.contract_price ? "$" + Number(t.contract_price).toLocaleString() : (ready ? "Price not read" : "Processing…")}
                {decisionBadge(o.seller_decision)}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>
                {!ready ? "reading contract…" : (
                  buyer?.name || buyerAgent?.name ? (
                    <>
                      {buyer?.name && <span><strong>Buyer:</strong> {buyer.name}</span>}
                      {buyer?.name && buyerAgent?.name && <span> · </span>}
                      {buyerAgent?.name && <span><strong>Buyer's Agent:</strong> {buyerAgent.name}{buyerAgent.company ? ` (${buyerAgent.company})` : ""}</span>}
                    </>
                  ) : (o.original_filename || "Offer")
                )}
              </div>
              {(() => {
                const dl = t.offer_acceptance_deadline;
                if (!dl) return null;
                const d = new Date(dl + "T00:00:00");
                if (isNaN(d)) return null;
                const today = new Date(); today.setHours(0,0,0,0);
                const days = Math.round((d - today) / 86400000);
                const expired = days < 0;
                const urgent = days <= 2;
                const label = expired ? `Offer expired ${Math.abs(days)}d ago` : days === 0 ? "Must accept by today" : `Must accept in ${days}d`;
                return (
                  <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: expired ? "#B91C1C" : urgent ? "#B7770D" : COLORS.muted }}>
                    ⏰ {label} <span style={{ fontWeight: 400 }}>({new Date(dl + "T00:00:00").toLocaleDateString()})</span>
                  </div>
                );
              })()}
              {(() => {
                // Signed copy is satisfied either by the explicit upload OR by an
                // executed purchase contract already filed in Documents.
                const signedOnFile = o.has_signed_copy || o.contract_doc_on_file;
                return (
                  <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: signedOnFile ? "#1E8449" : COLORS.muted }}>
                    {o.has_signed_copy ? "✓ Signed copy on file"
                      : o.contract_doc_on_file ? "✓ Contract on file (in Documents)"
                      : "✎ Awaiting signed copy"}
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <input ref={el => signedRefs.current[o.id] = el} type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: "none" }} onChange={e => uploadSigned(o.id, e.target.files && e.target.files[0])} />
              <button onClick={() => signedRefs.current[o.id] && signedRefs.current[o.id].click()} disabled={signingId === o.id} style={{ background: "#fff", border: "1px solid " + COLORS.navy, color: COLORS.navy, borderRadius: 6, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{signingId === o.id ? "Uploading…" : ((o.has_signed_copy || o.contract_doc_on_file) ? "Replace Signed Copy" : "⤴ Upload Signed Copy")}</button>
              {ready && <button onClick={() => onReview(o.id)} style={{ background: "#1E8449", border: "none", color: "#fff", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Review &amp; Accept</button>}
              <button onClick={() => reject(o.id)} style={{ background: "#fff", border: "1px solid #E5E7EB", color: "#B91C1C", borderRadius: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Reject</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Shows any automated follow-ups still running for this deal, with a one-tap Stop.
// Without this, a "general" follow-up keeps nagging until max-nudges/STOP/upload —
// the agent has no way to call it off once the party handles it offline.
function ActiveFollowups({ txId }) {
  const [chases, setChases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(null);
  const token = localStorage.getItem("tp_token") || "";

  const load = async () => {
    try {
      const res = await fetch(API + "/chases/by-transaction/" + txId, { headers: { Authorization: "Bearer " + token } });
      const data = await res.json();
      if (data.success) setChases(data.chases || []);
    } catch (e) { /* silent — non-critical panel */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, [txId]);

  const stop = async (chase) => {
    if (!window.confirm(`Stop the automated follow-up for "${chase.label}" to ${chase.target_party_name || "this party"}?\n\nNo more reminder emails or texts will be sent for it.`)) return;
    setStopping(chase.id);
    try {
      const res = await fetch(API + "/chases/" + chase.id + "/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ reason: "Stopped by agent from deal view" })
      });
      const data = await res.json();
      if (data.success) setChases(prev => prev.filter(c => c.id !== chase.id));
      else alert("Could not stop follow-up: " + (data.error || "unknown"));
    } catch (e) { alert("Could not stop follow-up. Please try again."); }
    setStopping(null);
  };

  if (loading || chases.length === 0) return null;

  return (
    <div style={{ background: "#FEF6F4", border: "1px solid #F0C9C0", borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>🔔 Active Follow-Ups ({chases.length})</div>
      {chases.map(c => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid #F5DAD3" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              To {c.target_party_name || c.target_party_email}{c.target_party_role ? " (" + c.target_party_role + ")" : ""} · {c.nudge_count} of {c.max_nudges} reminders sent
            </div>
          </div>
          <button onClick={() => stop(c)} disabled={stopping === c.id} style={{ flexShrink: 0, background: "#fff", border: "1px solid #C0392B", color: "#C0392B", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {stopping === c.id ? "Stopping…" : "Stop"}
          </button>
        </div>
      ))}
    </div>
  );
}

// SELLER MARKETING LOG — agent logs what they're doing to sell the home; each
// entry shows up in the seller's portal "Marketing" feed as proof-of-work.
// Completed Marketing/Showings milestones already auto-appear there; this is for
// the extra touches (social posts, open houses, email blasts, price changes).
const MKT_PRESETS = [
  { type: "photos", label: "Professional photos taken" },
  { type: "mls", label: "Listed on the MLS" },
  { type: "social", label: "Posted on social media" },
  { type: "openhouse", label: "Open house held" },
  { type: "email", label: "Emailed to our buyer database" },
  { type: "signage", label: "Yard sign installed" },
  { type: "showing", label: "Showing held" },
  { type: "feature", label: "Featured on real-estate sites" },
  { type: "price", label: "Price improvement" },
];
function MarketingLogPanel({ tx }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const [date, setDate] = useState("");
  const token = localStorage.getItem("tp_token") || "";
  const hdrs = { "Content-Type": "application/json", Authorization: "Bearer " + token };
  const load = async () => {
    try {
      const res = await fetch(API + "/transactions/" + tx.id + "/marketing", { headers: hdrs });
      const d = await res.json();
      if (d.success) setItems(d.items || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, [tx.id]);
  const add = async (type, label) => {
    if (!label || !label.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(API + "/transactions/" + tx.id + "/marketing", {
        method: "POST", headers: hdrs,
        body: JSON.stringify({ type, label: label.trim(), date: date || undefined }),
      });
      const d = await res.json();
      if (d.success) { setItems(prev => [d.item, ...prev]); setCustom(""); }
      else alert("Could not save: " + (d.error || "unknown"));
    } catch (e) { alert("Could not save. Try again."); }
    setAdding(false);
  };
  const remove = async (id) => {
    if (!window.confirm("Remove this marketing entry? The seller will no longer see it.")) return;
    try {
      const res = await fetch(API + "/transactions/" + tx.id + "/marketing/" + id, { method: "DELETE", headers: hdrs });
      const d = await res.json();
      if (d.success) setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) { alert("Could not remove. Try again."); }
  };
  return (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 14, color: COLORS.navy, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>📣 Marketing Log</h3>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>Tap to log what you're doing to sell this home. Each entry appears in the seller's portal as proof of your work. (Completed marketing milestones show there automatically.)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {MKT_PRESETS.map(p => (
          <button key={p.type} onClick={() => add(p.type, p.label)} disabled={adding} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 16, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ {p.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Something else you did…" style={{ flex: "1 1 200px", fontSize: 14, padding: "9px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "inherit" }} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ fontSize: 13, padding: "9px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "inherit" }} />
        <button onClick={() => add("action", custom)} disabled={adding || !custom.trim()} style={{ background: COLORS.navy, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: custom.trim() ? "pointer" : "default", opacity: custom.trim() ? 1 : 0.5, fontFamily: "inherit" }}>Add</button>
      </div>
      {loading ? <div style={{ fontSize: 13, color: COLORS.muted }}>Loading…</div>
        : items.length === 0 ? <div style={{ fontSize: 13, color: COLORS.muted }}>No marketing logged yet — tap a button above to add the first.</div>
        : items.map(it => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: `1px solid ${COLORS.bg}` }}>
            <div><span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{it.label}</span><span style={{ fontSize: 12, color: COLORS.muted }}> · {formatDate(it.activity_date)}</span></div>
            <button onClick={() => remove(it.id)} style={{ flexShrink: 0, background: "none", border: "none", color: COLORS.muted, fontSize: 16, cursor: "pointer" }}>✕</button>
          </div>
        ))}
    </div>
  );
}

// Shows the full text + downloadable attachments of every reply a party has sent
// back to one of this deal's automated emails (the inbound_emails table). This is
// where the Win-the-Day "💬 …replied" card lands.
function InboundRepliesPanel({ tx, coordinatorMode = false, onInboundRead }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);   // message id being replied to
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentNote, setSentNote] = useState({});   // msgId -> "✅ Sent"
  const [attach, setAttach] = useState([]);        // [{id,name}] to send with the reply
  const [uploading, setUploading] = useState(false);
  const [docPicker, setDocPicker] = useState(false);
  const [docList, setDocList] = useState(null);    // null = not loaded yet
  const replyFileRef = useRef(null);
  const tok = localStorage.getItem("tp_token") || "";
  const API = "https://liz-team-server-api-production.up.railway.app";
  useEffect(() => {
    let alive = true;
    fetch(`${API}/transactions/${tx.id}/inbound-emails`, { headers: { Authorization: "Bearer " + tok } })
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        setMessages(Array.isArray(d.messages) ? d.messages : []);
        setLoading(false);
        // The server marks these read on fetch; clear the global 🔔 now too.
        if (typeof onInboundRead === "function") onInboundRead(tx.id);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tx.id]);

  const openAttachment = async (msgId, idx) => {
    try {
      const r = await fetch(`${API}/inbound-emails/${msgId}/attachment/${idx}`, { headers: { Authorization: "Bearer " + tok } });
      const d = await r.json();
      if (d.url) window.open(d.url, "_blank");
      else alert("Could not open that attachment.");
    } catch { alert("Could not open that attachment."); }
  };

  // The deal's own email address — give it to any third party (title, lender,
  // the other agent). Anything sent or Reply-All'd to it files itself here.
  const [captureAddr, setCaptureAddr] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/transactions/${tx.id}/capture-address`, { headers: { Authorization: "Bearer " + tok } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d && d.address) setCaptureAddr(d.address); })
      .catch(() => {});
    return () => { alive = false; };
  }, [tx.id]);
  const copyCaptureAddr = () => {
    try { navigator.clipboard.writeText(captureAddr); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { alert(captureAddr); }
  };
  const captureBanner = captureAddr ? (
    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 14px", marginBottom: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#166534", marginBottom: 4 }}>📧 THIS DEAL'S EMAIL ADDRESS</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <code style={{ fontSize: 13, color: "#14532D", wordBreak: "break-all" }}>{captureAddr}</code>
        <button onClick={copyCaptureAddr} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, border: "1px solid #166534", background: "#fff", color: "#166534", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{copied ? "✅ Copied" : "Copy"}</button>
      </div>
      <div style={{ fontSize: 12, color: "#166534", marginTop: 6, lineHeight: 1.5 }}>
        Give this to the title company, lender, or anyone on the deal — or CC it on any email about this property. Every message sent to it lands here automatically, so the AI always has the full picture.
      </div>
    </div>
  ) : null;

  // Attach an existing deal document.
  const openDocPicker = () => {
    setDocPicker(true);
    if (docList === null) {
      fetch(`${API}/documents/${tx.id}`, { headers: { Authorization: "Bearer " + tok } })
        .then(r => r.json()).then(d => setDocList(d.documents || [])).catch(() => setDocList([]));
    }
  };
  const toggleAttach = (doc) => setAttach(prev => prev.find(a => a.id === doc.id) ? prev.filter(a => a.id !== doc.id) : [...prev, { id: doc.id, name: doc.name }]);
  // Upload from the computer → saved to the deal's Documents (server-proxied), then attached.
  const uploadFromComputer = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result.split(",")[1]); fr.onerror = reject; fr.readAsDataURL(file); });
      const res = await fetch(`${API}/documents/upload`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type, category: "Email Attachments", base64 }) });
      const d = await res.json();
      if (d.success && d.docId) { setAttach(prev => [...prev, { id: d.docId, name: file.name }]); setDocList(null); }
      else alert("Upload failed: " + (d.error || "unknown error"));
    } catch (e) { alert("Upload error: " + e.message); }
    setUploading(false);
  };

  // Reply to whoever wrote in, on the SAME channel they used (text → text,
  // email → email). Reuses the tested /broadcast path (agent) or the /tc message
  // endpoint (cross-tenant TC); both thread the reply so their next reply comes
  // back here too.
  const sendReply = async (m) => {
    if (!replyText.trim()) return;
    const isSms = m.channel === "sms";
    const toPhone = m.from_phone;
    const toEmail = m.from_email;
    if (isSms ? !toPhone : !toEmail) { alert(isSms ? "No phone number to text back." : "No email address to respond to."); return; }
    setSending(true);
    try {
      const attachDocIds = attach.map(a => a.id);
      const subject = "Re: " + (m.subject || "your message");
      let url, body;
      if (coordinatorMode) {
        url = `${API}/tc/transaction/${tx.id}/message`;
        body = isSms
          ? { channel: "sms", subject, message: replyText.trim(), recipientPhones: [toPhone], attachDocIds }
          : { channel: "email", subject, message: replyText.trim(), recipientEmails: [toEmail], attachDocIds };
      } else {
        url = `${API}/transactions/${tx.id}/broadcast`;
        body = {
          channel: isSms ? "sms" : "email", subject, message: replyText.trim(), expectsReply: true, attachDocIds,
          recipients: [isSms
            ? { name: m.from_name || toPhone, phone: toPhone, role: m.party_role || "" }
            : { name: m.from_name || toEmail, email: toEmail, role: m.party_role || "" }],
        };
      }
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
        body: JSON.stringify(body),
      });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed to send");
      setSentNote(prev => ({ ...prev, [m.id]: (isSms ? "✅ Text sent" : "✅ Reply sent") + (attach.length ? ` with ${attach.length} attachment${attach.length === 1 ? "" : "s"}` : "") }));
      setReplyTo(null); setReplyText(""); setAttach([]);
    } catch (e) { alert("⚠️ " + e.message); }
    setSending(false);
  };

  // Re-assign a (mis-routed) reply to the correct deal — for shared-number texts
  // where the sender is on 2+ deals. Loads the deal list on demand.
  const [reassignFor, setReassignFor] = useState(null);
  const [dealList, setDealList] = useState(null);
  const openReassign = (msgId) => {
    setReassignFor(msgId);
    if (dealList === null) {
      fetch(`${API}/transactions`, { headers: { Authorization: "Bearer " + tok } })
        .then(r => r.json()).then(d => setDealList((d.transactions || d || []).map(t => ({ id: t.id, address: t.address })))).catch(() => setDealList([]));
    }
  };
  const reassign = async (msgId, transactionId) => {
    try {
      const r = await fetch(`${API}/inbound-emails/${msgId}/reassign`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
        body: JSON.stringify({ transactionId }),
      });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed");
      setReassignFor(null);
      setMessages(prev => prev.filter(x => x.id !== msgId));  // moved off this deal
      alert("Moved to the selected deal.");
    } catch (e) { alert("⚠️ " + e.message); }
  };

  if (loading) return <div style={{ padding: 24, color: COLORS.gray }}>Loading replies…</div>;
  if (!messages.length) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {captureBanner}
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 28, textAlign: "center", color: COLORS.gray }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>💬</div>
        <div style={{ fontWeight: 700, color: COLORS.navy, marginBottom: 4 }}>No replies yet</div>
        <div style={{ fontSize: 13 }}>When a party replies to one of your automated emails or texts, their message shows up here.</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {captureBanner}
      {messages.map(m => {
        // Treat as SMS if channel is 'sms', OR if from_phone is set —
        // inbound emails never carry a phone number, so presence of from_phone
        // is a reliable signal regardless of what the channel column says.
        const isSmsMsg = m.channel === "sms" || !!m.from_phone;
        const mWithChannel = { ...m, channel: isSmsMsg ? "sms" : "email" };
        m = mWithChannel;
        const atts = Array.isArray(m.attachments) ? m.attachments : [];
        const when = m.created_at ? new Date(m.created_at).toLocaleString() : "";
        return (
          <div key={m.id} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              <div>
                {!m.read_at && m.status === "received" && <span style={{ marginRight: 8, fontSize: 11, fontWeight: 800, background: "#C0392B", color: "#fff", padding: "2px 8px", borderRadius: 20 }}>● NEW</span>}
                <span style={{ marginRight: 8, fontSize: 11, fontWeight: 700, background: m.channel === "sms" ? "#E0F2FE" : m.channel === "chat" ? "#EDE9FE" : "#F3F4F6", color: m.channel === "sms" ? "#0369A1" : m.channel === "chat" ? "#6D28D9" : "#374151", padding: "2px 8px", borderRadius: 6 }}>{m.channel === "sms" ? "📱 Text" : m.channel === "chat" ? "💬 Chat" : "📧 Email"}</span>
                <span style={{ fontWeight: 700, color: COLORS.navy }}>{m.from_name || m.from_phone || m.from_email || "A party"}</span>
                {m.party_role && <span style={{ marginLeft: 8, fontSize: 12, background: COLORS.bg, color: COLORS.gray, padding: "2px 8px", borderRadius: 6 }}>{m.party_role}</span>}
              </div>
              <span style={{ fontSize: 12, color: COLORS.gray }}>{when}</span>
            </div>

            {/* Shared-number guess flag: this person is on 2+ deals — let the agent move it */}
            {m.ambiguous && (
              <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 13, color: "#9A3412" }}>
                ⚠️ This person is on more than one of your deals — we filed this text here as our best guess.{" "}
                <button onClick={() => openReassign(m.id)} style={{ background: "none", border: "none", color: COLORS.navy, textDecoration: "underline", cursor: "pointer", fontWeight: 700, fontSize: 13, padding: 0 }}>Move to another deal</button>
                {reassignFor === m.id && (
                  <div style={{ marginTop: 8 }}>
                    {dealList === null ? <span style={{ color: COLORS.gray }}>Loading your deals…</span>
                     : <select defaultValue="" onChange={e => e.target.value && reassign(m.id, e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", maxWidth: "100%" }}>
                         <option value="" disabled>Pick the right deal…</option>
                         {dealList.filter(d => d.id !== tx.id).map(d => <option key={d.id} value={d.id}>{d.address}</option>)}
                       </select>}
                  </div>
                )}
              </div>
            )}

            {m.subject && m.channel !== "sms" && <div style={{ fontWeight: 600, color: COLORS.navy, marginBottom: 6 }}>{m.subject}</div>}
            {(m.body_text || m.snippet)
              ? <div style={{ whiteSpace: "pre-wrap", color: "#333", fontSize: 14, lineHeight: 1.5 }}>{m.body_text || m.snippet}</div>
              : (
                <div style={{ fontSize: 13, color: COLORS.gray }}>
                  <span style={{ fontStyle: "italic" }}>No readable text was extracted from this reply.</span>{" "}
                  <button onClick={async () => {
                    try {
                      const r = await fetch(`${API}/inbound-emails/${m.id}/raw`, { headers: { Authorization: "Bearer " + tok } });
                      const d = await r.json();
                      if (d.hasRaw && (d.readable || d.raw)) alert("Original reply:\n\n" + (d.readable || d.raw));
                      else alert("The original content wasn't saved for this reply (it arrived before we started keeping a copy). Ask the sender to resend, or check any attachment above.");
                    } catch (e) { alert("Could not load the original: " + e.message); }
                  }} style={{ background: "none", border: "none", color: COLORS.navy, textDecoration: "underline", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }}>View original email</button>
                </div>
              )}
            {atts.length > 0 && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray, marginBottom: 6 }}>📎 Attachments</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {atts.map((a, i) => (
                    <button key={i} onClick={() => openAttachment(m.id, i)}
                      style={{ border: `1px solid ${COLORS.border}`, background: COLORS.bg, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: COLORS.navy }}>
                      📄 {a.filename || `Attachment ${i + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {atts.length === 0 && m.attachment_count > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: COLORS.gray }}>📎 {m.attachment_count} attachment(s) were sent before attachment saving was enabled — ask the sender to resend if you still need them.</div>
            )}

            {/* Reply by email to whoever wrote in */}
            <div style={{ marginTop: 14, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
              {sentNote[m.id] && <div style={{ color: "#1E8449", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{sentNote[m.id]}</div>}
              {replyTo === m.id ? (
                <div>
                  <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                    {m.channel === "sms"
                      ? <>Replying by <b style={{ color: "#0369A1" }}>📱 text</b> to <b style={{ color: COLORS.navy }}>{m.from_name || m.from_phone}</b> {m.from_phone ? `· ${m.from_phone}` : ""}</>
                      : <>Replying by <b style={{ color: COLORS.navy }}>📧 email</b> to <b style={{ color: COLORS.navy }}>{m.from_name || m.from_email}</b> {m.from_email ? `· ${m.from_email}` : ""}</>}
                  </div>
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4} autoFocus placeholder={`Write your reply to ${m.from_name || "them"}…`}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", marginBottom: 8 }} />

                  {/* Attach: from the deal's Documents, or upload from this computer */}
                  <input ref={replyFileRef} type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFromComputer(f); e.target.value = ""; }} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: attach.length ? 8 : 10 }}>
                    <button onClick={openDocPicker} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: `1px solid ${COLORS.navy}`, background: "#fff", color: COLORS.navy, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📎 Attach from Documents</button>
                    <button onClick={() => replyFileRef.current?.click()} disabled={uploading} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: `1px solid ${COLORS.navy}`, background: "#fff", color: COLORS.navy, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: uploading ? 0.5 : 1 }}>{uploading ? "Uploading…" : "💻 Upload from computer"}</button>
                  </div>
                  {attach.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {attach.map(a => (
                        <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F0F4FF", border: "1px solid #C7D2FE", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: COLORS.navy, marginRight: 6, marginBottom: 6 }}>
                          📄 {a.name}
                          <button onClick={() => setAttach(prev => prev.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.gray, fontSize: 14, lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  {docPicker && (
                    <div onClick={() => setDocPicker(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
                      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, maxWidth: 520, width: "100%", margin: "auto", padding: 20, boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.navy }}>📎 Attach from Documents</div>
                          <button onClick={() => setDocPicker(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: COLORS.gray }}>×</button>
                        </div>
                        {docList === null ? <div style={{ padding: 20, textAlign: "center", color: COLORS.gray }}>Loading documents…</div>
                         : docList.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: COLORS.gray }}>No documents on this deal yet. Use “Upload from computer” instead.</div>
                         : docList.map(doc => {
                          const on = !!attach.find(a => a.id === doc.id);
                          return (
                            <label key={doc.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 6px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer", fontSize: 14 }}>
                              <input type="checkbox" checked={on} onChange={() => toggleAttach(doc)} />
                              <span>📄 {doc.name}{doc.category ? <span style={{ color: COLORS.gray }}> · {doc.category}</span> : null}</span>
                            </label>
                          );
                        })}
                        <button onClick={() => setDocPicker(false)} style={{ marginTop: 14, width: "100%", background: COLORS.navy, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    {(() => { const canReply = m.channel === "sms" ? !!m.from_phone : !!m.from_email; return (
                    <button onClick={() => sendReply(m)} disabled={sending || !replyText.trim() || !canReply}
                      style={{ background: (sending || !replyText.trim() || !canReply) ? "#ccc" : "#15803D", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                      {sending ? "Sending…" : m.channel === "sms" ? "📱 Send text" : "📧 Send reply"}
                    </button> ); })()}
                    <button onClick={() => { setReplyTo(null); setReplyText(""); setAttach([]); }}
                      style={{ background: "#fff", color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                      Cancel
                    </button>
                  </div>
                  {(m.channel === "sms" ? !m.from_phone : !m.from_email) && <div style={{ fontSize: 12, color: "#C0392B", marginTop: 6 }}>No {m.channel === "sms" ? "phone number" : "email address"} on this reply to respond to.</div>}
                </div>
              ) : (
                <button onClick={() => { setReplyTo(m.id); setReplyText(""); }}
                  style={{ background: "#fff", color: COLORS.navy, border: `1px solid ${COLORS.navy}`, borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  {m.channel === "sms" ? "↩️ Reply by text" : "↩️ Reply by email"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Send the Deal Doctor's drafted message straight from the panel — editable
// content, recipients pre-filled from the deal's parties (the role the draft is
// for is pre-checked), add another email, attach a deal document or upload one
// from the computer. Sends via the same /broadcast path the Messages composer uses.
function DealDoctorSendModal({ tx, draft, onClose, onSent }) {
  const tok = localStorage.getItem("tp_token") || "";
  const hdrs = { "Content-Type": "application/json", Authorization: "Bearer " + tok };
  const parties = (tx.parties || []).filter(p => p && (p.email || p.phone));
  const roleMatches = (p) => {
    const want = String(draft.toRole || "").toLowerCase().trim();
    if (!want) return false;
    const r = String(p.role || "").toLowerCase();
    return r === want || r.includes(want) || want.includes(r);
  };
  const [subject, setSubject] = useState(draft.subject || `Update — ${tx.address || "your transaction"}`);
  const [body, setBody] = useState(draft.body || "");
  const [picked, setPicked] = useState(() => {
    const s = {}; parties.forEach((p, i) => { s[p.id || i] = roleMatches(p) && !!p.email; }); return s;
  });
  const [extraEmail, setExtraEmail] = useState("");
  const [extraEmails, setExtraEmails] = useState([]);
  const [docs, setDocs] = useState([]);
  const [attach, setAttach] = useState({});
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/documents/${tx.id}`, { headers: hdrs })
      .then(r => r.json()).then(d => { if (d.documents) setDocs(d.documents); }).catch(() => {});
  }, [tx.id]);

  const addExtra = () => {
    const e = extraEmail.trim();
    if (e && e.includes("@") && !extraEmails.includes(e)) setExtraEmails(l => [...l, e]);
    setExtraEmail("");
  };
  const uploadFromComputer = async (file) => {
    if (!file) return;
    setUploading(true); setErr("");
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(new Error("Could not read file")); r.readAsDataURL(file); });
      const r = await fetch(`${API}/documents/upload`, { method: "POST", headers: hdrs, body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type || "application/octet-stream", category: "Shared", base64 }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Upload failed");
      setDocs(list => [{ id: d.docId, name: file.name, mime_type: file.type }, ...list]);
      setAttach(a => ({ ...a, [d.docId]: true }));
    } catch (e) { setErr(e.message); } finally { setUploading(false); }
  };
  const send = async () => {
    setErr("");
    const recipients = [
      ...parties.filter((p, i) => picked[p.id || i] && p.email).map(p => ({ name: p.name, email: p.email, role: p.role })),
      ...extraEmails.map(e => ({ name: e, email: e })),
    ];
    if (recipients.length === 0) { setErr("Pick at least one recipient."); return; }
    if (!body.trim()) { setErr("The message can't be empty."); return; }
    setSending(true);
    try {
      const attachDocIds = Object.keys(attach).filter(k => attach[k]);
      const r = await fetch(`${API}/transactions/${tx.id}/broadcast`, {
        method: "POST", headers: hdrs,
        body: JSON.stringify({ subject, message: body, channel: "email", recipients, attachDocIds }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || "Send failed");
      onSent && onSent(recipients.length);
    } catch (e) { setErr(e.message); setSending(false); }
  };

  const label = { fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 6, display: "block" };
  const input = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 14, fontFamily: "inherit" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, margin: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        <div style={{ background: "#1A2B4A", color: "#fff", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>✉️ Send this message</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, maxHeight: "75vh", overflowY: "auto" }}>
          <div style={{ marginBottom: 14 }}>
            <span style={label}>To</span>
            {parties.length === 0 && <div style={{ fontSize: 13, color: "#94A3B8" }}>No parties with contact info on this deal yet.</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {parties.map((p, i) => {
                const key = p.id || i; const on = !!picked[key];
                return (
                  <button key={key} disabled={!p.email} onClick={() => setPicked(s => ({ ...s, [key]: !s[key] }))}
                    title={p.email || "No email"}
                    style={{ border: `1.5px solid ${on ? "#1A2B4A" : "#CBD5E1"}`, background: on ? "#EEF2F7" : "#fff", color: p.email ? "#1a2332" : "#94A3B8", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: p.email ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                    {on ? "✓ " : ""}{p.name || p.email}{p.role ? ` · ${p.role}` : ""}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={extraEmail} onChange={e => setExtraEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }} placeholder="Add another email…" style={{ ...input, flex: 1 }} />
              <button onClick={addExtra} style={{ background: "#EEF2F7", border: "1px solid #CBD5E1", borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
            {extraEmails.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {extraEmails.map(e => <span key={e} style={{ background: "#EEF2F7", borderRadius: 999, padding: "4px 10px", fontSize: 12 }}>{e} <span onClick={() => setExtraEmails(l => l.filter(x => x !== e))} style={{ cursor: "pointer", color: "#94A3B8", marginLeft: 4 }}>×</span></span>)}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={label}>Subject</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={input} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={label}>Message</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={9} style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={label}>Attach (optional)</span>
            {docs.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {docs.slice(0, 30).map(d => {
                  const on = !!attach[d.id];
                  return (
                    <button key={d.id} onClick={() => setAttach(a => ({ ...a, [d.id]: !a[d.id] }))}
                      style={{ border: `1.5px solid ${on ? "#1E8449" : "#CBD5E1"}`, background: on ? "#EAFAF1" : "#fff", color: "#1a2332", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {on ? "📎 " : ""}{d.name}
                    </button>
                  );
                })}
                {docs.length > 30 && (
                  <span style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic", alignSelf: "center" }}>
                    …and {docs.length - 30} more in the Documents tab (showing the 30 newest)
                  </span>
                )}
              </div>
            )}
            <label style={{ display: "inline-block", background: "#fff", border: "1px dashed #CBD5E1", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
              {uploading ? "Uploading…" : "⬆️ Upload from computer"}
              <input type="file" style={{ display: "none" }} disabled={uploading} onChange={e => { uploadFromComputer(e.target.files[0]); e.target.value = ""; }} />
            </label>
          </div>
          {err && <div style={{ background: "#FDEDEC", border: "1px solid #F5B7B1", color: "#922B21", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ background: "#fff", border: "1px solid #CBD5E1", color: "#475569", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={send} disabled={sending}
              style={{ background: sending ? "#9CA3AF" : "#1E8449", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 800, cursor: sending ? "default" : "pointer", fontFamily: "inherit" }}>
              {sending ? "Sending…" : "✉️ Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 🩺 AI Deal Doctor — shows the deal's biggest risk + the one move to make today,
// with a ready-to-send draft when a party needs a nudge. Reads the stored nightly
// check-up on open; "Run check-up" refreshes it live.
function DealDoctorPanel({ tx }) {
  const [dd, setDd] = useState(null);
  const [at, setAt] = useState(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const [snoozeUntil, setSnoozeUntil] = useState(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sentNote, setSentNote] = useState("");
  const hdrs = { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") };

  useEffect(() => {
    let alive = true;
    fetch(`${API}/transactions/${tx.id}/deal-doctor`, { headers: hdrs })
      .then(r => r.json()).then(d => { if (alive && d.success) { setDd(d.dealDoctor); setAt(d.at); setSnoozeUntil(d.snoozeUntil || null); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [tx.id]);

  const snooze = async (days) => {
    setSnoozeOpen(false); setErr("");
    const prev = { dd, at, snoozeUntil };
    setDd(null); setAt(null);  // optimistic
    try {
      const r = await fetch(`${API}/transactions/${tx.id}/deal-doctor/snooze`, { method: "POST", headers: hdrs, body: JSON.stringify({ days }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Could not snooze");
      setSnoozeUntil(d.snoozeUntil);
    } catch (e) { setErr(e.message); setDd(prev.dd); setAt(prev.at); setSnoozeUntil(prev.snoozeUntil); }
  };

  const run = async () => {
    setRunning(true); setErr("");
    try {
      const r = await fetch(`${API}/transactions/${tx.id}/deal-doctor`, { method: "POST", headers: hdrs });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Could not run a check-up");
      setDd(d.dealDoctor); setAt(d.at); setSnoozeUntil(null);  // running lifts any snooze
    } catch (e) { setErr(e.message); } finally { setRunning(false); }
  };

  // Clear the current check-up once handled — tonight's run brings back a fresh
  // read if the risk still stands.
  const clear = async () => {
    setErr("");
    const prev = dd, prevAt = at;
    setDd(null); setAt(null);  // optimistic
    try {
      const r = await fetch(`${API}/transactions/${tx.id}/deal-doctor`, { method: "DELETE", headers: hdrs });
      if (!r.ok) throw new Error("Could not clear");
    } catch (e) { setErr(e.message); setDd(prev); setAt(prevAt); }
  };

  const tone = { red: { bar: "#C0392B", bg: "#FDEDEC", dot: "🔴" }, yellow: { bar: "#B7770D", bg: "#FEF9E7", dot: "🟡" }, green: { bar: "#1E8449", bg: "#EAFAF1", dot: "🟢" } };
  const t = dd ? (tone[dd.health] || tone.yellow) : tone.yellow;
  const draft = dd && dd.draft && dd.draft.channel !== "none" ? dd.draft : null;
  const copyDraft = () => {
    if (!draft) return;
    const text = (draft.subject ? `Subject: ${draft.subject}\n\n` : "") + (draft.body || "");
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };
  const ago = at ? new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
  const snoozedFuture = snoozeUntil && new Date(snoozeUntil) > new Date();
  const snoozeLabel = snoozedFuture ? new Date(snoozeUntil).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : null;
  const snoozeBtn = (label, days) => (
    <button onClick={() => snooze(days)}
      style={{ background: "#fff", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
  );

  return (
    <div style={{ border: `1px solid ${dd ? t.bar : "#E5E7EB"}`, borderLeft: `5px solid ${dd ? t.bar : "#94A3B8"}`, background: dd ? t.bg : "#F8FAFC", borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#1A2B4A" }}>🩺 Transaction Check {dd && <span style={{ fontSize: 16 }}>{t.dot}</span>}</div>
        <button onClick={run} disabled={running}
          style={{ background: running ? "#9CA3AF" : "#1A2B4A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: running ? "default" : "pointer", fontFamily: "inherit" }}>
          {running ? "Checking…" : dd ? "↻ Re-check" : snoozedFuture ? "↻ Check now" : "Run check-up"}
        </button>
      </div>
      {err && <div style={{ color: "#C0392B", fontSize: 13, marginTop: 8 }}>{err}</div>}
      {!dd && !err && snoozedFuture && <div style={{ fontSize: 13, color: "#64748B", marginTop: 8 }}>😴 Snoozed until <b>{snoozeLabel}</b> — I'll keep this deal quiet until then. Tap “Check now” to look sooner.</div>}
      {!dd && !err && !snoozedFuture && <div style={{ fontSize: 13, color: "#64748B", marginTop: 8 }}>Tap “Run check-up” and I'll review this deal — the biggest risk right now and the one move to make today.</div>}
      {dd && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: ".04em" }}>⚠️ BIGGEST RISK</div>
            <div style={{ fontSize: 14, color: "#1a2332", marginTop: 2 }}>{dd.risk}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: ".04em" }}>✅ DO THIS TODAY</div>
            <div style={{ fontSize: 14, color: "#1a2332", marginTop: 2, fontWeight: 600 }}>{dd.move}</div>
          </div>
          {draft && (
            <div style={{ marginTop: 12, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: ".04em", marginBottom: 6 }}>
                ✍️ READY-TO-SEND {draft.channel === "sms" ? "TEXT" : "EMAIL"}{draft.toRole ? ` · to the ${draft.toRole}` : ""}
              </div>
              {draft.subject && <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2332", marginBottom: 4 }}>{draft.subject}</div>}
              <div style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{draft.body}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => setSendOpen(true)}
                  style={{ background: "#1E8449", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  ✉️ Send this
                </button>
                <button onClick={copyDraft}
                  style={{ background: "#fff", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {copied ? "✓ Copied" : "📋 Copy"}
                </button>
                {sentNote && <span style={{ fontSize: 12, color: "#1E8449", fontWeight: 700 }}>{sentNote}</span>}
              </div>
            </div>
          )}
          {sendOpen && draft && (
            <DealDoctorSendModal tx={tx} draft={draft} onClose={() => setSendOpen(false)}
              onSent={(n) => { setSendOpen(false); setSentNote(`✓ Sent to ${n} recipient${n === 1 ? "" : "s"}`); setTimeout(() => setSentNote(""), 6000); }} />
          )}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button onClick={clear} title="I've handled this — clear it. Tonight's check-up will flag anything still outstanding."
                style={{ background: "#1E8449", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ✓ Mark handled
              </button>
              <button onClick={() => setSnoozeOpen(o => !o)} title="Set this aside for a bit — I'll keep it quiet, then bring it back."
                style={{ background: "#fff", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                😴 Not today
              </button>
              {ago && <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>Checked {ago}</span>}
            </div>
            {snoozeOpen && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Remind me:</span>
                {snoozeBtn("Tomorrow", 1)}
                {snoozeBtn("In 3 days", 3)}
                {snoozeBtn("In a week", 7)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Coordinator teams (sub-accounts) ─────────────────────────────────────────
const _tcApi = "https://liz-team-server-api-production.up.railway.app";
const _tcHdrs2 = () => ({ "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") });

// "My Team" — a lead coordinator invites/lists/removes assistant logins.
function CoordinatorTeamModal({ currentUser, onClose }) {
  const [data, setData] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = useCallback(() => fetch(`${_tcApi}/tc/team`, { headers: _tcHdrs2() }).then(r => r.json()).then(setData).catch(e => setData({ error: e.message })), []);
  useEffect(() => { load(); }, [load]);
  const invite = async () => {
    setBusy(true); setNote("");
    try {
      const r = await fetch(`${_tcApi}/tc/team`, { method: "POST", headers: _tcHdrs2(), body: JSON.stringify({ name, email }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed");
      setNote(d.reused ? "✅ Added to your team." : "✅ Invite sent — they'll get a setup link by email.");
      setName(""); setEmail(""); await load();
    } catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };
  const remove = async (m) => {
    if (!window.confirm(`Remove ${m.first_name || m.email} from your team? Any deals assigned to them go back to you.`)) return;
    try { const r = await fetch(`${_tcApi}/tc/team/${m.id}`, { method: "DELETE", headers: _tcHdrs2() }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed"); await load(); }
    catch (e) { alert("⚠️ " + e.message); }
  };
  const isLead = data?.isLead;
  return (
    <Modal title="👥 My Team" onClose={onClose}>
      {!data && <div style={{ color: COLORS.muted }}>Loading…</div>}
      {data?.error && <div style={{ color: COLORS.danger }}>⚠️ {data.error}</div>}
      {data && !data.error && (
        <>
          <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 14, lineHeight: 1.5 }}>
            {isLead ? "Add assistants who work under you. You can reassign any deal to a teammate from the deal's People tab — they'll see and work just that deal." : "You're a team member. Your lead coordinator assigns deals to you; they show up on your dashboard."}
          </div>
          {isLead && (
            <div style={{ background: COLORS.bg, borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Add a team member</div>
              <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
              <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }} />
              <Btn small onClick={invite} disabled={busy || !email.trim() || !name.trim()}>{busy ? "Adding…" : "Send invite"}</Btn>
              {note && <div style={{ color: COLORS.success, fontSize: 13, marginTop: 8 }}>{note}</div>}
            </div>
          )}
          {(data.members || []).map(m => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderTop: `1px solid ${COLORS.border}` }}>
              <div>
                <div style={{ fontWeight: 600 }}>{`${m.first_name || ""} ${m.last_name || ""}`.trim() || m.email}{m.is_lead && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: COLORS.navy, background: "#E5EDFF", padding: "2px 8px", borderRadius: 20 }}>LEAD</span>}</div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>{m.email}{m.last_login_at ? " · active" : " · invite pending"}</div>
              </div>
              {isLead && !m.is_lead && <button onClick={() => remove(m)} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.danger, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

// "My Services" — coordinator sets pricing + availability, shares their intake
// link, and reviews incoming intake requests.
function CoordinatorServicesModal({ currentUser, onClose }) {
  const [tab, setTab] = useState("services");
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(false);
  const [reqs, setReqs] = useState(null);
  const [copied, setCopied] = useState(false);
  const intakeUrl = `${window.location.origin}/tc-intake/${currentUser?.id}`;
  useEffect(() => {
    fetch(`${_tcApi}/tc/profile`, { headers: _tcHdrs2() }).then(r => r.json()).then(d => {
      const p = d.profile || {};
      setF({ availableForHire: !!p.tc_available_for_hire, feeListing: p.tc_fee_listing ?? "", feeSeller: p.tc_fee_seller ?? "", feeBuyer: p.tc_fee_buyer ?? "", bio: p.tc_bio || "", serviceArea: p.tc_service_area || "" });
    }).catch(() => setF({ availableForHire: false, feeListing: "", feeSeller: "", feeBuyer: "", bio: "", serviceArea: "" }));
  }, []);
  const loadReqs = useCallback(() => fetch(`${_tcApi}/tc/intake-requests`, { headers: _tcHdrs2() }).then(r => r.json()).then(d => setReqs(d.requests || [])).catch(() => setReqs([])), []);
  useEffect(() => { if (tab === "requests") loadReqs(); }, [tab, loadReqs]);
  const save = async () => {
    setSaved(false);
    try {
      const r = await fetch(`${_tcApi}/tc/profile`, { method: "PUT", headers: _tcHdrs2(), body: JSON.stringify(f) });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert("⚠️ " + e.message); }
  };
  const decide = async (id, decision) => {
    try { const r = await fetch(`${_tcApi}/tc/intake-requests/${id}/${decision}`, { method: "POST", headers: _tcHdrs2() }); if (!r.ok) throw new Error((await r.json()).error || "Failed"); await loadReqs(); }
    catch (e) { alert("⚠️ " + e.message); }
  };
  const fld = { width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
  const lab = { fontSize: 12, fontWeight: 700, color: COLORS.muted, display: "block", marginBottom: 4, marginTop: 12 };
  const pendingCount = (reqs || []).filter(r => r.status === "pending").length;
  return (
    <Modal title="💼 My Services" onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["services", "Pricing & Link"], ["requests", `Requests${pendingCount ? ` (${pendingCount})` : ""}`]].map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${tab === id ? COLORS.navy : COLORS.border}`, background: tab === id ? COLORS.navy : "#fff", color: tab === id ? "#fff" : COLORS.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
        ))}
      </div>
      {tab === "services" && (!f ? <div style={{ color: COLORS.muted }}>Loading…</div> : (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={f.availableForHire} onChange={e => setF(p => ({ ...p, availableForHire: e.target.checked }))} style={{ width: 16, height: 16 }} />
            List me in the coordinator directory (agents can find & hire me)
          </label>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>Off = private; you only work with agents who invite you directly.</div>
          <label style={lab}>Listing — put on MLS, full service ($)</label>
          <input style={fld} type="number" value={f.feeListing} onChange={e => setF(p => ({ ...p, feeListing: e.target.value }))} placeholder="e.g. 595" />
          <label style={lab}>Seller representation — cash or financed ($)</label>
          <input style={fld} type="number" value={f.feeSeller} onChange={e => setF(p => ({ ...p, feeSeller: e.target.value }))} placeholder="e.g. 450" />
          <label style={lab}>Buyer representation ($)</label>
          <input style={fld} type="number" value={f.feeBuyer} onChange={e => setF(p => ({ ...p, feeBuyer: e.target.value }))} placeholder="e.g. 395" />
          <label style={lab}>Service area</label>
          <input style={fld} value={f.serviceArea} onChange={e => setF(p => ({ ...p, serviceArea: e.target.value }))} placeholder="e.g. Central Florida" />
          <label style={lab}>Short bio (shown to agents & on your intake page)</label>
          <textarea style={{ ...fld, resize: "vertical" }} rows={3} value={f.bio} onChange={e => setF(p => ({ ...p, bio: e.target.value }))} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
            <Btn onClick={save}>Save</Btn>
            {saved && <span style={{ color: COLORS.success, fontSize: 13, fontWeight: 700 }}>✓ Saved</span>}
          </div>
          <div style={{ background: COLORS.bg, borderRadius: 10, padding: 12, marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Your intake link</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>Share this with agents or clients so they can submit a deal to you.</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ fontSize: 12, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", wordBreak: "break-all", flex: "1 1 200px" }}>{intakeUrl}</code>
              <Btn small variant="secondary" onClick={() => { navigator.clipboard?.writeText(intakeUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? "✓ Copied" : "Copy"}</Btn>
            </div>
          </div>
        </>
      ))}
      {tab === "requests" && (!reqs ? <div style={{ color: COLORS.muted }}>Loading…</div> : (
        reqs.length === 0 ? <div style={{ color: COLORS.muted, fontSize: 14 }}>No intake requests yet. Share your link to start receiving deals.</div> : (
          reqs.map(r => (
            <div key={r.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{r.submitter_name} <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>· {r.submitter_role}</span></div>
                <span style={{ fontSize: 11, fontWeight: 700, color: r.status === "pending" ? COLORS.gold : r.status === "accepted" ? COLORS.success : COLORS.muted }}>{r.status}</span>
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>{[r.deal_type, r.property_address].filter(Boolean).join(" · ")}</div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{[r.submitter_email, r.submitter_phone].filter(Boolean).join(" · ")}</div>
              {r.details?.notes && <div style={{ fontSize: 13, marginTop: 6 }}>{r.details.notes}</div>}
              {r.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Btn small onClick={() => decide(r.id, "accept")}>Accept</Btn>
                  <Btn small variant="ghost" onClick={() => decide(r.id, "decline")}>Decline</Btn>
                </div>
              )}
            </div>
          ))
        )
      ))}
    </Modal>
  );
}

// Per-deal "Handled by" control — the lead reassigns the deal to a teammate.
function CoordinatorAssignControl({ tx, currentUser }) {
  const asg = tx.coordinatorAssignment || {};
  const isLead = asg.coordinatorUserId && currentUser && String(asg.coordinatorUserId) === String(currentUser.id);
  const [team, setTeam] = useState(null);
  const [handler, setHandler] = useState(asg.handlerUserId || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (isLead) fetch(`${_tcApi}/tc/team`, { headers: _tcHdrs2() }).then(r => r.json()).then(d => setTeam(d.members || [])).catch(() => setTeam([])); }, [isLead]);
  const assign = async (val) => {
    setBusy(true);
    try {
      const r = await fetch(`${_tcApi}/tc/transaction/${tx.id}/handler`, { method: "PATCH", headers: _tcHdrs2(), body: JSON.stringify({ handlerUserId: val || null }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed");
      setHandler(val);
    } catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };
  const members = (team || []).filter(m => !m.is_lead);
  // Member viewing a deal assigned to them (not the lead): show a read-only note.
  if (!isLead) {
    if (!asg.handlerUserId) return null;
    return <div style={{ marginBottom: 16, fontSize: 12, color: COLORS.muted }}>🧭 Assigned to you by the lead coordinator.</div>;
  }
  if (!members.length) return null; // lead with no team yet — nothing to assign
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Handled by</div>
      <select value={handler} disabled={busy} onChange={e => assign(e.target.value)}
        style={{ width: "100%", maxWidth: 320, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit" }}>
        <option value="">Me (lead coordinator)</option>
        {members.map(m => <option key={m.id} value={m.id}>{`${m.first_name || ""} ${m.last_name || ""}`.trim() || m.email}</option>)}
      </select>
    </div>
  );
}

// Coordinator's "Send Update" composer — emails parties on the deal in the agent's
// voice via the money-free /tc message endpoint (the agent SMS panel is tenant-
// scoped and not the coordinator's to use).
function CoordinatorSendUpdate({ tx }) {
  const recipients = (tx.parties || []).filter(p => p.email);
  const [picked, setPicked] = useState([]);
  const [channel, setChannel] = useState("");   // "" = must pick (email / sms / both)
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const toggle = (email) => setPicked(p => p.includes(email) ? p.filter(e => e !== email) : [...p, email]);
  const wantEmail = channel === "email" || channel === "both";
  const send = async () => {
    if (!channel) { alert("Pick how to send it first — 📧 Email or 📱 Text."); return; }
    setBusy(true); setDone("");
    try {
      const r = await fetch(`${API}/tc/transaction/${tx.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") },
        body: JSON.stringify({ recipientEmails: picked, subject, message, channel }),
      });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed");
      setDone(`✅ Sent to ${d.sent} recipient${d.sent === 1 ? "" : "s"}.`);
      setMessage(""); setSubject(""); setPicked([]); setChannel("");
    } catch (e) { alert("⚠️ " + e.message); }
    setBusy(false);
  };
  const chanBtn = (v, label) => (
    <button key={v} onClick={() => setChannel(v)} style={{ padding: "10px 16px", borderRadius: 10, border: "2px solid " + (channel === v ? "#0F2044" : "#D1D5DB"), background: channel === v ? "#0F2044" : "#fff", color: channel === v ? "#fff" : "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
  );
  return (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>Goes out in the agent's name (or co-branded with you, if enabled).</div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Send to</div>
      <div style={{ marginBottom: 12 }}>
        {recipients.length === 0 && <div style={{ fontSize: 13, color: COLORS.muted }}>No party on this deal has an email.</div>}
        {recipients.map(p => (
          <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 14 }}>
            <input type="checkbox" checked={picked.includes(p.email)} onChange={() => toggle(p.email)} />
            <span>{p.name || p.email} <span style={{ color: COLORS.muted }}>· {p.role}</span></span>
          </label>
        ))}
      </div>
      {/* Explicit channel choice — no silent default */}
      <div style={{ fontSize: 12, fontWeight: 800, color: "#0F2044", marginBottom: 5 }}>How should this go out? {!channel && <span style={{ color: "#C0392B" }}>👉 pick one</span>}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {chanBtn("email", "📧 Email")}{chanBtn("sms", "📱 Text")}{chanBtn("both", "📧 + 📱 Both")}
      </div>
      {wantEmail && <input placeholder="Subject (for the email)" value={subject} onChange={e => setSubject(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />}
      <textarea placeholder="Your message…" value={message} onChange={e => setMessage(e.target.value)} rows={5} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10, resize: "vertical" }} />
      <button onClick={send} disabled={busy || !channel || !message.trim() || picked.length === 0} style={{ background: (busy || !channel || !message.trim() || picked.length === 0) ? "#ccc" : "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{busy ? "Sending…" : !channel ? "Pick Email or Text above" : channel === "sms" ? "Send text" : channel === "both" ? "Send text + email" : "Send email"}</button>
      {done && <div style={{ color: "#1E8449", fontSize: 14, marginTop: 10 }}>{done}</div>}
    </div>
  );
}

// Lease document generator — fills the agent's official FL lease forms (ERL,
// lease, flood, lead-paint) from the deal + a short questionnaire, then saves
// each filled PDF to the deal's Documents tab. Forms render server-side.
function LeaseDocsModal({ tx, onClose, onGenerated }) {
  const tok = localStorage.getItem("tp_token") || "";
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  // Ready-made signing round returned by generate (signers + pre-placed stops).
  const [signPack, setSignPack] = useState(null);
  const [sigRows, setSigRows] = useState([]);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState(null);
  // "✏️ Adjust spots" — move/resize/add blocks on a generated doc before sending.
  const [adjustDoc, setAdjustDoc] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/transactions/${tx.id}/lease-docs`, { headers: { Authorization: "Bearer " + tok } });
        if (!res.ok) throw new Error("Could not load");
        const data = await res.json();
        setForms(data.forms || []);
        setSelected(Object.fromEntries((data.forms || []).map(f => [f.docType, true])));
        setQuestions(data.questions || []);
        const init = {};
        (data.questions || []).forEach(q => { init[q.key] = q.type === "date" ? String(q.value || "").slice(0, 10) : (q.value || ""); });
        // If no end date came from the deal, derive it from the term + start.
        if (!init.term_end && (init.lease_term === "1 Year" || init.lease_term === "6 Months")) {
          init.term_end = computeLeaseEnd(init.term_begin, init.lease_term);
        }
        setAnswers(init);
      } catch (e) { setError("Could not load the form data. Try again."); }
      finally { setLoading(false); }
    })();
  }, [tx.id]);
  const groups = [...new Set(questions.map(q => q.group))];
  // Update an answer; if the lease term or start date changes, recompute the
  // end date for a fixed-length term.
  const setAnswer = (key, value) => setAnswers(a => {
    const next = { ...a, [key]: value };
    if (key === "lease_term") next.term_end = (value === "1 Year" || value === "6 Months") ? computeLeaseEnd(a.term_begin, value) : (value === "Month-to-Month" ? "" : a.term_end);
    else if (key === "term_begin" && (a.lease_term === "1 Year" || a.lease_term === "6 Months")) next.term_end = computeLeaseEnd(value, a.lease_term);
    return next;
  });
  const generate = async () => {
    setBusy(true); setError("");
    try {
      const docTypes = Object.keys(selected).filter(k => selected[k]);
      if (!docTypes.length) { setError("Pick at least one form."); setBusy(false); return; }
      const res = await fetch(`${API}/transactions/${tx.id}/lease-docs/generate`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
        body: JSON.stringify({ docTypes, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDone(data.documents || []);
      if (Array.isArray(data.signers) && Array.isArray(data.placements) && data.placements.length) {
        setSignPack(data);
        setSigRows(data.signers.map(s => ({ name: s.name || "", email: s.email || "" })));
      }
    } catch (e) { setError(e.message || "Could not generate the documents."); }
    finally { setBusy(false); }
  };
  // One tap sends every generated form for signature — stops pre-placed on the
  // right lines. Signers WITHOUT an email are dropped and the remaining stop
  // indexes are renumbered so nobody inherits someone else's lines.
  const sendForSignatures = async () => {
    setSending(true); setError("");
    try {
      const kept = [];
      sigRows.forEach((s, i) => { if ((s.email || "").trim() && (s.name || "").trim()) kept.push(i); });
      if (!kept.length) throw new Error("Add an email for at least one signer.");
      const idxMap = {};
      kept.forEach((oldI, newI) => { idxMap[oldI + 1] = newI + 1; });
      const placements = (signPack.placements || [])
        .filter(p => idxMap[p.signer])
        .map(p => ({ ...p, signer: idxMap[p.signer] }));
      const [first, ...rest] = signPack.documents;
      const res = await fetch(`${API}/documents/${first.id}/request-signatures`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
        body: JSON.stringify({
          alsoDocIds: rest.map(d => d.id),
          signers: kept.map(i => ({ name: sigRows[i].name.trim(), email: sigRows[i].email.trim() })),
          placements,
          skipSignerlessDocs: true,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Could not send the signing links");
      setSentTo(kept.map(i => sigRows[i].name.trim()).join(", "));
    } catch (e) { setError(e.message || "Could not send the signing links."); }
    finally { setSending(false); }
  };
  const inp = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 12, maxWidth: 640, width: "100%", margin: "auto", padding: 24, boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 19, color: COLORS.navy }}>📦 Lease Listing Package</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: COLORS.muted }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>{tx.address} · {tx.type}. The app fills your official Florida Realtors forms — then everyone signs in-app with one link each.</div>
        {loading ? <div style={{ padding: 30, textAlign: "center", color: COLORS.muted }}>Loading deal data…</div>
         : done ? (
           <div>
             <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 10, padding: 16, marginBottom: 16 }}>
               <div style={{ fontWeight: 800, color: "#065F46", marginBottom: 8 }}>✓ Generated {done.length} document{done.length !== 1 ? "s" : ""}</div>
               <ul style={{ margin: 0, paddingLeft: 18, color: "#065F46", fontSize: 13 }}>{done.map(d => <li key={d.id}>{d.name}</li>)}</ul>
             </div>
             {sentTo ? (
               <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13.5, color: "#0C4A6E" }}>
                 ✍️ Signing links sent to <strong>{sentTo}</strong>. Each person signs everything in one sitting; every signed copy files back into Documents with its certificate, and you'll get a pop-up.
               </div>
             ) : signPack ? (
               <div style={{ background: "#FAF5FF", border: "1px solid #D8B4FE", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                 <div style={{ fontWeight: 800, fontSize: 13.5, color: "#86198F", marginBottom: 4 }}>✍️ Send for signatures — one tap</div>
                 <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>Signature, initials and date spots are already placed on every form. Check the emails and send — landlords, tenants and you each sign only the pages that need you.</div>
                 <div style={{ marginBottom: 10 }}>
                   {signPack.documents.map(d => (
                     <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "4px 0" }}>
                       <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {d.name}</span>
                       <button onClick={() => setAdjustDoc(d)}
                         title="Move, resize, remove or add signature/initials/date/text/check-mark blocks on this form"
                         style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 7, border: "1px solid #CBD5E1", background: "#fff", color: "#334155", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                         ✏️ Adjust spots
                       </button>
                     </div>
                   ))}
                 </div>
                 {sigRows.map((s, i) => (
                   <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                     <input value={s.name} onChange={e => setSigRows(rs => rs.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} placeholder="Name"
                       style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 7, border: "1.5px solid #CCC", fontSize: 13, fontFamily: "inherit" }} />
                     <input value={s.email} onChange={e => setSigRows(rs => rs.map((r, j) => j === i ? { ...r, email: e.target.value } : r))} placeholder="Email"
                       style={{ flex: 1.2, minWidth: 0, padding: "8px 10px", borderRadius: 7, border: "1.5px solid " + ((s.email || "").trim() ? "#CCC" : "#F5B7B1"), fontSize: 13, fontFamily: "inherit" }} />
                   </div>
                 ))}
                 <button onClick={sendForSignatures} disabled={sending}
                   style={{ width: "100%", marginTop: 6, background: sending ? "#94A3B8" : "#86198F", color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 800, cursor: sending ? "default" : "pointer", fontFamily: "inherit" }}>
                   {sending ? "Sending links…" : "Send signing links ✍️"}
                 </button>
               </div>
             ) : (
               <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>They're saved to the <strong>Documents</strong> tab, ready to review and send for signature.</div>
             )}
             {error && <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, padding: 10, fontSize: 13, color: "#7F1D1D", marginBottom: 12 }}>⚠️ {error}</div>}
             <button onClick={onGenerated} style={{ width: "100%", background: COLORS.navy, color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Open Documents →</button>
             {adjustDoc && signPack && (
               <Suspense fallback={null}>
                 <AdjustSpotsModal doc={adjustDoc} headers={{ Authorization: "Bearer " + tok }}
                   signerNames={sigRows.map(s => s.name)}
                   initial={signPack.placements.filter(p => String(p.docId) === String(adjustDoc.id)).map(({ docId, ...p }) => p)}
                   onSave={(newPs) => setSignPack(g => ({ ...g, placements: [
                     ...g.placements.filter(p => String(p.docId) !== String(adjustDoc.id)),
                     ...newPs.map(p => ({ ...p, docId: String(adjustDoc.id) })),
                   ] }))}
                   onClose={() => setAdjustDoc(null)} />
               </Suspense>
             )}
           </div>
         ) : (
           <div>
             <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.navy, marginBottom: 8 }}>Forms to generate</div>
             <div style={{ marginBottom: 18 }}>
               {forms.map(f => (
                 <label key={f.docType} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 6, cursor: "pointer" }}>
                   <input type="checkbox" checked={!!selected[f.docType]} onChange={e => setSelected(s => ({ ...s, [f.docType]: e.target.checked }))} />
                   <span style={{ fontSize: 14 }}>{f.label}</span>
                 </label>
               ))}
             </div>
             {groups.map(g => (
               <div key={g} style={{ marginBottom: 16 }}>
                 <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.navy, marginBottom: 8 }}>{g}</div>
                 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} data-keep-grid>
                   {questions.filter(q => q.group === g).map(q => (
                     <div key={q.key}>
                       <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, marginBottom: 3 }}>{q.label}</div>
                       {q.type === "select" ? (
                         <select value={answers[q.key] || ""} onChange={e => setAnswer(q.key, e.target.value)} style={inp}>
                           {(q.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                         </select>
                       ) : (
                         <input type={q.type === "date" ? "date" : "text"} inputMode={q.type === "money" ? "decimal" : undefined}
                           value={answers[q.key] || ""} onChange={e => setAnswer(q.key, e.target.value)} style={inp} />
                       )}
                     </div>
                   ))}
                 </div>
               </div>
             ))}
             {error && <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
             <button disabled={busy} onClick={generate} style={{ width: "100%", background: busy ? "#9CA3AF" : "#6D28D9", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>{busy ? "Generating…" : "Generate & Save to Documents"}</button>
           </div>
         )}
      </div>
    </div>
  );
}

// ── FIRST-TIME TIP — a one-time 1-2-3 explainer for a heavy screen. Shows
// until dismissed (per browser); never comes back after "Got it".
function FirstTimeTip({ tipKey, children }) {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("tp_tip_" + tipKey) === "1"; } catch { return false; } });
  if (hidden) return null;
  return (
    <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "12px 16px", margin: "0 0 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 20 }}>👋</span>
      <div style={{ flex: 1, fontSize: 13, color: "#1E3A8A", lineHeight: 1.6 }}>{children}</div>
      <button onClick={() => { setHidden(true); try { localStorage.setItem("tp_tip_" + tipKey, "1"); } catch {} }}
        style={{ background: "#1E40AF", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
        Got it
      </button>
    </div>
  );
}

// ── "WHAT'S NEXT" STRIP — the one thing a rookie needs on every deal screen:
// the single next step, in plain words, always visible, tap → timeline.
function NextStepStrip({ txId, coordinatorMode, onOpenTimeline }) {
  const [next, setNext] = useState(null);
  useEffect(() => {
    let dead = false;
    const tok = localStorage.getItem("tp_token") || "";
    const base = coordinatorMode ? API + "/tc/milestones/" : API + "/milestones/";
    fetch(base + txId, { headers: { Authorization: "Bearer " + tok } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (dead) return;
        const ms = (d && (d.milestones || d)) || [];
        const dstr = (x) => (typeof x === "string" ? x.split("T")[0] : x ? new Date(x).toISOString().split("T")[0] : null);
        const open = (Array.isArray(ms) ? ms : []).filter(m => !["Completed", "Waived"].includes(m.status) && !m.is_na);
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
        const overdue = open.filter(m => dstr(m.due_date) && dstr(m.due_date) < today)
          .sort((a, b) => (dstr(a.due_date) < dstr(b.due_date) ? -1 : 1));
        const upcoming = open.filter(m => !overdue.includes(m)).sort((a, b) => {
          const da = dstr(a.due_date) || "9999", db = dstr(b.due_date) || "9999";
          return da === db ? (a.sort_order || 0) - (b.sort_order || 0) : (da < db ? -1 : 1);
        });
        setNext(overdue[0] || upcoming[0] || null);
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [txId, coordinatorMode]);
  if (!next) return null;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const due = typeof next.due_date === "string" ? next.due_date.split("T")[0] : next.due_date ? new Date(next.due_date).toISOString().split("T")[0] : null;
  const isOverdue = due && due < today;
  const dueLabel = !due ? "" : isOverdue ? ` — was due ${formatDate(due)}` : due === today ? " — due TODAY" : ` — due ${formatDate(due)}`;
  return (
    <div onClick={onOpenTimeline}
      style={{ background: isOverdue ? "#FEF2F2" : "#F0FDF4", borderBottom: `1px solid ${isOverdue ? "#FECACA" : "#BBF7D0"}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexWrap: "wrap" }}>
      <span style={{ fontSize: 16 }}>{isOverdue ? "⚠️" : "👉"}</span>
      <span style={{ fontSize: 13.5, color: isOverdue ? "#7F1D1D" : "#14532D" }}>
        <b>{isOverdue ? "Behind: " : "Next step: "}</b>{next.name}{dueLabel}
      </span>
      <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 800, color: isOverdue ? "#B91C1C" : "#166534" }}>Open the timeline →</span>
    </div>
  );
}

function TransactionDetail({ tx, onUpdate, onLocalUpdate, coordinatorMode = false, onBack, contacts, onInviteParty = [], onCopyLoginLink, onSaveContact, onOpenContactBook, onDuplicate, currentUser, initialTab = "overview", navSignal = 0, dashboardUnread = 0, onMilestoneSummary, onInboundRead }) {
  // Staff (agent + coordinator) comms tabs are merged into one "messages" hub, so
  // a deep-link to chat/replies/sms opens the hub on the right section. Guests keep
  // their standalone chat tab.
  const _isStaffInit = !tx.isGuestView;
  const [showTxMore, setShowTxMore] = useState(false);      // header ⋯ menu
  const [showMoreTabs, setShowMoreTabs] = useState(false);   // 'More ▾' tab dropdown
  const [moreTabsPos, setMoreTabsPos] = useState({ top: 0, left: 0 }); // fixed-position anchor (the tab bar clips absolute children)
  const [activeTab, setActiveTab] = useState(
    (_isStaffInit && ["chat", "replies", "sms"].includes(initialTab)) ? "messages" : initialTab
  );
  const [msgSection, setMsgSection] = useState(
    initialTab === "replies" ? "replies" : initialTab === "sms" ? "send" : "chat"
  );
  // Re-route to the requested tab whenever the parent bumps navSignal — this fires
  // even if we're ALREADY mounted on this deal (clicking the floating new-message
  // alert while standing on the deal). Skip the initial render (navSignal 0) so we
  // don't override a tab the user manually picked.
  const _navFirst = useRef(true);
  useEffect(() => {
    if (_navFirst.current) { _navFirst.current = false; return; }
    if (_isStaffInit && ["chat", "replies", "sms"].includes(initialTab)) {
      setActiveTab("messages");
      setMsgSection(initialTab === "replies" ? "replies" : initialTab === "sms" ? "send" : "chat");
    } else {
      setActiveTab(initialTab);
    }
  }, [navSignal]);
  const [showAssignAgent, setShowAssignAgent] = useState(false);
  const [showAddParty, setShowAddParty] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState(null);  // guest taps a paid feature
  const [showAssignVendor, setShowAssignVendor] = useState(false);
  const [pendingInviteParty, setPendingInviteParty] = useState(null);
  const [partyFromContactBook, setPartyFromContactBook] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [followupParty, setFollowupParty] = useState(null);
  const [followupForm, setFollowupForm] = useState({ subject: "", message: "" });
  const [followupSubmitting, setFollowupSubmitting] = useState(false);
  const [sendingWelcomeFor, setSendingWelcomeFor] = useState(null); // kept for PartyCard prop compat
  // Per-party welcome send is REVIEW-GATED like everything else: opens the full
  // preview (rendered email + attachments you can add/remove) scoped to this one
  // person — never a blind confirm-and-send. Works for agents and coordinators.
  const [welcomePreviewPartyId, setWelcomePreviewPartyId] = useState(null);
  const onSendWelcome = (party) => {
    if (!party || !party.id) return;
    if (!party.email) { alert(`${party.name || "This party"} has no email address. Add one in Edit, then try again.`); return; }
    setWelcomePreviewPartyId(party.id);
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
  // Coordinators can't use the whole-tx PUT (blocked + tenant-scoped). Route their
  // party changes to the dedicated /tc party endpoints and patch local state.
  const _tcHdrs = () => ({ "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") });
  const _setParties = (parties) => onLocalUpdate && onLocalUpdate({ ...tx, parties });
  const coordAddParty = async (np) => {
    try {
      const r = await fetch(`${API}/tc/transaction/${tx.id}/party`, { method: "POST", headers: _tcHdrs(), body: JSON.stringify(np) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed");
      _setParties([...(tx.parties || []), d.party]);
    } catch (e) { alert("⚠️ " + e.message); }
  };
  const coordEditParty = async (ep) => {
    try {
      const r = await fetch(`${API}/tc/party/${ep.id}`, { method: "PATCH", headers: _tcHdrs(), body: JSON.stringify(ep) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed");
      _setParties(tx.parties.map(p => p.id === ep.id ? { ...p, ...ep } : p));
    } catch (e) { alert("⚠️ " + e.message); }
  };
  const coordDeleteParty = async (id) => {
    try {
      const r = await fetch(`${API}/tc/party/${id}`, { method: "DELETE", headers: _tcHdrs() });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Failed");
      _setParties(tx.parties.filter(p => p.id !== id));
    } catch (e) { alert("⚠️ " + e.message); }
  };
  const updateTask = updated => update({ tasks: tx.tasks.map(t => t.id === updated.id ? updated : t) });
  const [chatUnread, setChatUnread] = useState(0);

  // Unread party-reply badge for the 💬 Replies tab. Loaded on open, cleared
  // (and marked read on the server) once the agent views the tab.
  const [unreadReplyCount, setUnreadReplyCount] = useState(0);
  useEffect(() => {
    if (tx.isGuestView) return;
    const tok = localStorage.getItem("tp_token") || "";
    fetch(`https://liz-team-server-api-production.up.railway.app/transactions/${tx.id}/inbound-emails/unread-count`, { headers: { Authorization: "Bearer " + tok } })
      .then(r => r.json()).then(d => setUnreadReplyCount(d.count || 0)).catch(() => {});
  }, [tx.id]);
  useEffect(() => {
    // The agent is "viewing replies" either on the legacy standalone tab OR the
    // merged Messages hub (activeTab "messages" + the Replies section). The old
    // check only matched the standalone tab, so in the hub replies never got
    // marked read and the 🔔 alert never cleared.
    const viewingReplies = activeTab === "replies" || (activeTab === "messages" && msgSection === "replies");
    if (!viewingReplies || unreadReplyCount === 0) return;
    const tok = localStorage.getItem("tp_token") || "";
    fetch(`https://liz-team-server-api-production.up.railway.app/transactions/${tx.id}/inbound-emails/mark-read`, { method: "POST", headers: { Authorization: "Bearer " + tok } })
      .then(() => { if (typeof onInboundRead === "function") onInboundRead(tx.id); })  // clear the global badge now, don't wait for the 15s poll
      .catch(() => {});
    setUnreadReplyCount(0);
    // unreadReplyCount MUST be a dep: when the deal opens straight into Replies,
    // this effect first runs before the count has loaded (count=0 → bails); it has
    // to re-run once the count arrives, or the messages never get marked read.
  }, [activeTab, msgSection, unreadReplyCount]);
  const [showEditTx, setShowEditTx] = useState(false);
  const [showPortalPreview, setShowPortalPreview] = useState(false);
  const [offerCreateSignal, setOfferCreateSignal] = useState(0);  // header "Create Offer" → OffersTab creates
  const [editTxForm, setEditTxForm] = useState({});
  const [showReceiveOffer, setShowReceiveOffer] = useState(false);
  const [reviewOfferId, setReviewOfferId] = useState(null);
  const [showLeaseDocs, setShowLeaseDocs] = useState(false);
  // Bumped whenever the Receive Offer / review modal closes so the Pending Offers
  // panel (which stays mounted behind the modal) reloads — without this, a freshly
  // received/saved offer never appears and looks like it didn't save.
  const [offersRefresh, setOffersRefresh] = useState(0);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Pre-fill helper — used everywhere the Edit modal opens.
  // CRITICAL RULE: Edit modal must NEVER open blank. Every field comes from current tx.
  const buildEditTxForm = (tt = tx) => ({
    assignedAgent: tt.assignedAgentId || "",
    referralSource: tt.referralSource || "",
    address: tt.address || "",
    city: tt.city || "",
    state: tt.state || "FL",
    zipCode: tt.zipCode || "",
    county: tt.county || "",
    propertyType: tt.propertyType || "Single Family",
    constructionType: tt.constructionType || "Resale",
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
    yearBuilt: tt.yearBuilt || "",
    inHoa: tt.inHoa || "",
    floodZone: tt.floodZone || "",
    sellerIsForeign: tt.sellerIsForeign || false,
    isCoastal: tt.isCoastal || false,
    representationExpiresOn: tt.representationExpiresOn || "",
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
  useEffect(() => { const tok = localStorage.getItem("tp_token") || ""; fetch(API + "/users", { headers: { "Authorization": "Bearer " + tok } }).then(r => r.json()).then(d => { if (d.users) setTeamMembers(d.users.filter(u => u.role === "agent" || u.role === "admin")); }).catch(e => console.error("[bg]", e && e.message ? e.message : e)); }, []);
  const chatUnreadRef = useRef(0);
  const setChatUnreadBoth = (n) => { chatUnreadRef.current = n; setChatUnread(n); };
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; if (activeTab === "chat") setChatUnreadBoth(0); }, [activeTab]);

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
  // Header Progress = the Auto-TC timeline (same source as the deal cards).
  // The legacy tasks list drove this before — its ARCHIVED rows padded the
  // denominator, so a fully-done deal read 88% (Carlos, Budworth 7/17).
  const msSum = tx.milestoneSummary || tx.milestone_summary || null;
  const activeTasks = tx.tasks.filter(t => t.status !== "Archived");
  const progress = msSum && msSum.total > 0
    ? Math.min(100, Math.round((msSum.done || 0) / msSum.total * 100))
    : activeTasks.length > 0 ? Math.round(activeTasks.filter(t => t.status === "Completed").length / activeTasks.length * 100) : 0;
  const CATEGORY_ORDER = ["Pre-Listing", "Consultation", "Showing", "Contract", "Disclosure", "Marketing", "Escrow", "Inspection", "HOA", "Appraisal", "Insurance", "Title", "Financing", "Closing", "Post-Closing", "Commission Disbursement", "General"];
  const tasksByCategory = tx.tasks.filter(t => t.status !== "Archived").reduce((acc, t) => { acc[t.category] = acc[t.category] || []; acc[t.category].push(t); return acc; }, {});
  const sortedTaskCategories = Object.entries(tasksByCategory).sort(([a], [b]) => { const ai = CATEGORY_ORDER.indexOf(a); const bi = CATEGORY_ORDER.indexOf(b); return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi); });
  const smsMsgCount = Object.values(tx.smsThreads || {}).reduce((a, t) => a + t.length, 0);

  const isBuyerSideTx = tx.type === "Buyer Representation" || tx.type === "Dual Agency" || tx.type === "Lease — Tenant";
  const isListingSideTx = tx.type === "Listing (Seller)" || tx.type === "Dual Agency" || tx.type === "Lease — Landlord";
  // Guest = the opposing-side agent / vendor (not the paying agent). The server
  // flags this on the transaction payload (is_guest_view). Guests see ALL tab titles
  // (full capability showcase); the ones they can actually open are GUEST_ALLOWED_TABS
  // (their own scoped view). Clicking any other tab pops the paid-subscription paywall
  // instead of opening it — so private owner data (timeline/notes/activity/etc.) never
  // loads for a guest.
  const isGuest = !!tx.isGuestView;
  // A party is an OWN-SIDE portal client (the only one who'll actually see THIS
  // deal in their portal) when their role matches the side we represent: seller
  // on a listing, buyer on a buyer-rep, either on dual. Used to gate the "Login
  // Link" button so we never hand out a link for the opposing party — that link
  // would open a different transaction of theirs, not this one.
  const isOwnSideClientRole = (role) => {
    const r = (role || "").toLowerCase().trim();
    if (tx.type === "Dual Agency") return /^(co[- ]?)?(buyer|seller)$/.test(r);
    if (isListingSideTx) return /^(co[- ]?)?seller$/.test(r);
    if (isBuyerSideTx) return /^(co[- ]?)?buyer$/.test(r);
    return false;
  };
  const GUEST_ALLOWED_TABS = ["overview", "parties", "documents", "chat"];
  // Coordinator = the invited TC working the agent's deal. Full coordination
  // surface, but the agent's money (commission/net-sheets) and sales tools (CMA,
  // offers) are hidden. Set from the coordinator-view flag on the tx payload.
  const isCoordinator = !!tx.isCoordinatorView || coordinatorMode;
  const COORD_HIDDEN_TABS = ["cma", "offers", "calculator", "buyer-net", "seller-calc"];

  // Rookie rule: FIVE tabs you actually live in; everything else under "More ▾".
  const primaryTabs = [
    { id: "overview", label: "Overview" },
    { id: "milestones", label: "📅 Timeline" },
    ...(isBuyerSideTx && !isGuest ? [{ id: "offers", label: "📝 Offers" }] : []),
    { id: "documents", label: "📎 Documents" },
    { id: "parties", label: `People (${(isCoordinator ? tx.parties.filter(p => (p.email || "").toLowerCase() !== (currentUser?.email || "").toLowerCase()) : tx.parties).length})` },
    ...(!isGuest
      ? [{ id: "messages", label: (chatUnread > 0 || dashboardUnread > 0 || unreadReplyCount > 0) ? `💬 Messages (${Math.max(chatUnread, dashboardUnread) + unreadReplyCount})` : "💬 Messages" }]
      : []),
    ...(isGuest ? [{ id: "chat", label: (chatUnread > 0 || dashboardUnread > 0) ? `💬 Group Chat (${Math.max(chatUnread, dashboardUnread)})` : "💬 Group Chat" }] : []),
  ].filter(t => !isCoordinator || !COORD_HIDDEN_TABS.includes(t.id));
  const moreTabs = [
    ...(isListingSideTx ? [{ id: "seller-calc", label: "💰 Seller's Net Sheet" }] : []),
    ...(isBuyerSideTx ? [{ id: "buyer-net", label: "💰 Buyer's Net Sheet" }, { id: "calculator", label: "🧮 Buyers Calculator" }] : []),
    { id: "cma", label: "📊 CMA (pricing)" },
    { id: "tx-forms", label: "📄 Blank Forms" },
    { id: "notes", label: "🗒 Internal Notes" },
    { id: "reminders", label: "⏰ Reminders" },
    { id: "activity", label: "🕓 Activity Log" },
  ].filter(t => !isCoordinator || !COORD_HIDDEN_TABS.includes(t.id));
  const tabs = [...primaryTabs, ...moreTabs];
  // Tab click handler: a guest opening a non-allowed tab gets the paywall, not the tab.
  const handleTabClick = (t) => {
    if (isGuest && !GUEST_ALLOWED_TABS.includes(t.id)) { setPaywallFeature(t.label.replace(/\s*\(\d+\)\s*$/, "")); return; }
    setActiveTab(t.id);
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh" }}>
      <div data-tx-detail-header="" style={{ background: COLORS.navy, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 22, opacity: 0.7 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>{tx.address}</div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{tx.city}, FL {tx.zipCode} · {tx.county} County · {tx.type}</div>
          {isGuest && tx.owningBrokerageName && <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 }}>🏢 Managed by {tx.owningBrokerageName}</div>}
        </div>
        {propertyTypeBadge(tx) && <Badge label={propertyTypeBadge(tx).label} color={propertyTypeBadge(tx).color} bg={propertyTypeBadge(tx).bg} />}
        {isGuest && <span style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>👤 Shared with you · view only</span>}
        {isCoordinator && <span style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>🧭 Coordinator</span>}
        {!isCoordinator && <>
        <select value={tx.status} onChange={e => {
          if (isGuest) { setPaywallFeature("Changing transaction status"); e.target.value = tx.status; return; }
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
        {/* ONE green action per side; Edit; everything else under ⋯ */}
        {!isGuest && tx.type === "Buyer Representation" && !["Closed", "Cancelled"].includes(tx.status) && (
          <button onClick={() => { setActiveTab("offers"); setOfferCreateSignal(n => n + 1); }} title="Build and send your buyer's offer to the listing agent" style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "none", background: "#1E8449", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📝 Create Offer</button>
        )}
        {tx.type !== "Buyer Representation" && !isLeaseType(tx.type) && !["Closed", "Cancelled"].includes(tx.status) && (
          <button onClick={() => isGuest ? setPaywallFeature("Receiving offers") : (setActiveTab("overview"), setShowReceiveOffer(true))} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "none", background: "#1E8449", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📥 Receive Offer</button>
        )}
        {/* Lease deals: the ONE green action is the lease package (ERL, lease,
            disclosures — filled + sent for signatures in one flow). */}
        {!isGuest && isLeaseType(tx.type) && !["Closed", "Cancelled"].includes(tx.status) && (
          <button onClick={() => setShowLeaseDocs(true)} title="Fill the lease listing forms (ERL, lease, flood, lead-paint) and send them for signatures" style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "none", background: "#1E8449", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📦 Lease Package</button>
        )}
        <button onClick={() => isGuest ? setPaywallFeature("Editing a transaction") : openEditTx()} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowTxMore(v => !v)} title="More actions" style={{ fontSize: 15, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>⋯</button>
          {showTxMore && (
            <>
              <div onClick={() => setShowTxMore(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
              <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 201, minWidth: 230, padding: 4 }}>
                {[
                  !isGuest && { icon: "👁", label: "Preview Client Portal", fn: () => setShowPortalPreview(true) },
                  tx.type !== "Buyer Representation" && !["Closed", "Cancelled"].includes(tx.status) && { icon: "📋", label: "Review Offers Received", fn: () => { setActiveTab("overview"); setTimeout(() => { const el = document.getElementById("pending-offers-panel"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); } },
                  { icon: "🖨️", label: "Print", fn: () => isGuest ? setPaywallFeature("Printing") : window.print() },
                  { icon: "🧬", label: "Copy this deal (duplicate)", fn: () => isGuest ? setPaywallFeature("Duplicating a transaction") : (onDuplicate && onDuplicate(tx)) },
                  { divider: true },
                  tx.status !== "Cancelled" && { icon: "🚫", label: "Cancel this deal…", danger: true, fn: () => isGuest ? setPaywallFeature("Cancelling a transaction") : (((window.prompt(`Cancel "${tx.address || "this transaction"}"? It will be HIDDEN from your dashboard (not deleted). Type CANCEL to confirm.`) || "").trim().toUpperCase() === "CANCEL") && update({ status: "Cancelled" })) },
                  tx.status === "Cancelled" && { icon: "♻️", label: "Restore this deal", fn: () => isGuest ? setPaywallFeature("Restoring a transaction") : update({ status: "Active" }) },
                ].filter(Boolean).map((it, i) => it.divider ? (
                  <div key={i} style={{ height: 1, background: "#e5e7eb", margin: "6px 8px" }} />
                ) : (
                  <button key={i} onClick={() => { setShowTxMore(false); it.fn(); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "none", border: "none", borderRadius: 6, fontSize: 13, color: it.danger ? "#B91C1C" : "#1f2937", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                    onMouseEnter={e => e.currentTarget.style.background = it.danger ? "#FEF2F2" : "#f3f4f6"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}>
                    <span style={{ fontSize: 15 }}>{it.icon}</span>
                    <span>{it.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        </>}
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
          { label: "Texts Sent", value: smsMsgCount },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.highlight ? COLORS.danger : COLORS.navy, marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {!isGuest && activeTab !== "milestones" && (
        <NextStepStrip txId={tx.id} coordinatorMode={coordinatorMode} onOpenTimeline={() => setActiveTab("milestones")} />
      )}
      <div style={{ background: "#fff", borderBottom: `1px solid ${COLORS.border}`, display: "flex", overflowX: "auto" }}>
        {primaryTabs.map(t => (
          <button key={t.id} onClick={() => handleTabClick(t)} style={{ padding: "12px 20px", background: "none", border: "none", borderBottom: `3px solid ${activeTab === t.id ? COLORS.navy : "transparent"}`, color: activeTab === t.id ? COLORS.navy : COLORS.muted, fontWeight: activeTab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>{t.label}{isGuest && !GUEST_ALLOWED_TABS.includes(t.id) ? " 🔒" : ""}</button>
        ))}
        {moreTabs.length > 0 && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            {(() => { const activeMore = moreTabs.find(t => t.id === activeTab); return (
              <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMoreTabsPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 230)) }); setShowMoreTabs(v => !v); }}
                style={{ padding: "12px 20px", background: "none", border: "none", borderBottom: `3px solid ${activeMore ? COLORS.navy : "transparent"}`, color: activeMore ? COLORS.navy : COLORS.muted, fontWeight: activeMore ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {activeMore ? activeMore.label : "More"} ▾
              </button>
            ); })()}
            {showMoreTabs && (
              <>
                <div onClick={() => setShowMoreTabs(false)} style={{ position: "fixed", inset: 0, zIndex: 299 }} />
                {/* FIXED position: the tab bar scrolls horizontally (overflowX:auto),
                    which CLIPS absolutely-positioned children — the menu opened but
                    was invisible. Anchored to the button's viewport rect instead. */}
                <div style={{ position: "fixed", left: moreTabsPos.left, top: moreTabsPos.top, zIndex: 300, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", minWidth: 210, padding: 4 }}>
                  {moreTabs.map(t => (
                    <button key={t.id} onClick={() => { setShowMoreTabs(false); handleTabClick(t); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: activeTab === t.id ? "#F0F4FA" : "none", border: "none", borderRadius: 6, fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, color: "#1f2937", cursor: "pointer", fontFamily: "inherit" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                      onMouseLeave={e => e.currentTarget.style.background = activeTab === t.id ? "#F0F4FA" : "none"}>
                      {t.label}{isGuest && !GUEST_ALLOWED_TABS.includes(t.id) ? " 🔒" : ""}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: 24, maxWidth: 940, margin: "0 auto" }}>
        {activeTab === "overview" && (
          <div>
            {!isGuest && (
              <FirstTimeTip tipKey="deal">
                <b>This is your deal's home base.</b> ① The green strip up top always shows your <b>next step</b>. ② <b>📅 Timeline</b> is every deadline — the app watches them for you. ③ <b>📎 Documents</b> holds the paperwork and gets things signed. That's 90% of what you'll use.
              </FirstTimeTip>
            )}
            {!isGuest && <DealDoctorPanel tx={tx} />}
            {/* Agent oversight: when a TC runs this deal, show what's done / left /
                what the TC has done, so the agent can answer a client cold. */}
            {!isGuest && !coordinatorMode && tx.coordinatorName && (
              <CoordinatorSummaryPanel txId={tx.id} token={localStorage.getItem("tp_token") || ""} />
            )}
            {!isGuest && tx.assignedAgentId && !tx.needsReview && tx.leadConverted === false && (
              <div style={{ background: "#FEF9E7", border: "1px solid #F1C40F", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 24 }}>🌱</span>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 800, color: "#7A5C00", fontSize: 15, marginBottom: 4 }}>This is still a {isBuyerSideType(tx.type) ? "buyer inquiry" : "seller lead"} — not yet confirmed</div>
                    <div style={{ fontSize: 13, color: "#7A5C00", lineHeight: 1.5 }}>It came in from your intake link and hasn't been worked into a real deal yet. <strong>Confirm</strong> it to keep working it, or <strong>Not Pursuing</strong> if it went nowhere. (You can also set any status from the selector at the top.)</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API}/transactions/${tx.id}/confirm-lead`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") } });
                          if (!res.ok) throw new Error("Failed");
                          onUpdate({ ...tx, leadConverted: true });
                        } catch { alert("Could not confirm — please try again."); }
                      }}
                      style={{ background: "#B7860B", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      ✓ Confirm Lead
                    </button>
                    <button
                      onClick={async () => {
                        if ((window.prompt("Mark this lead as Not Pursuing? It will be set to Cancelled and removed from your active list (you can reactivate it later). Type CANCEL to confirm.") || "").trim().toUpperCase() !== "CANCEL") return;
                        try {
                          const res = await fetch(`${API}/transactions/${tx.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ status: "Cancelled" }) });
                          if (!res.ok) throw new Error("Failed");
                          onUpdate({ ...tx, status: "Cancelled", leadConverted: true });
                        } catch { alert("Could not update — please try again."); }
                      }}
                      style={{ background: "transparent", color: "#7A5C00", border: "1px solid #C9A227", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      ✕ Not Pursuing
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Rentals take applications, not offers — no offers panel on lease deals. */}
            {!isGuest && tx.type !== "Buyer Representation" && !isLeaseType(tx.type) && !["Closed", "Cancelled"].includes(tx.status) && (
              <div id="pending-offers-panel" style={{ marginBottom: 20, scrollMarginTop: 80 }}>
                <ListingOffers txId={tx.id} txStatus={tx.status} refreshKey={offersRefresh} onReview={(id) => setReviewOfferId(id)} onReceiveOffer={() => setShowReceiveOffer(true)} />
              </div>
            )}
            {(showReceiveOffer || reviewOfferId) && (
              <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 300, overflowY: "auto" }}>
                <ContractAutoIntake
                  token={localStorage.getItem("tp_token") || ""}
                  user={currentUser}
                  existingTransactionId={tx.id}
                  reviewUploadId={reviewOfferId || undefined}
                  currentStatus={tx.status}
                  onBack={() => { setShowReceiveOffer(false); setReviewOfferId(null); setOffersRefresh(n => n + 1); }}
                  onApproved={() => { setShowReceiveOffer(false); setReviewOfferId(null); setOffersRefresh(n => n + 1); setShowEmailPreview(true); }}
                />
              </div>
            )}
            {!isGuest && ["Under Contract", "Inspection", "Appraisal", "Clear to Close", "Closed"].includes(tx.status) && (
              <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: COLORS.muted }}>Send the welcome &amp; intro emails to all parties — you can preview each before it goes out.</div>
                <button onClick={() => setShowEmailPreview(true)} style={{ background: "#1E8449", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✉️ Preview &amp; Send Welcome Emails</button>
              </div>
            )}
            {(tx.transaction_type || tx.type) && /buyer|dual/i.test(tx.transaction_type || tx.type) && (
              <PreApprovalCard transactionId={tx.id} isAgent={true} />
            )}
            {/* Buyer Search Criteria — read-only summary of what the buyer
                submitted at intake (stored in intake_details). Shows the agent
                the budget, must-haves, financing and timeline at a glance. */}
            {tx.intakeDetails && tx.intakeDetails.source === "buyer_intake" && (() => {
              const d = tx.intakeDetails;
              const money = (v) => (v != null && v !== "" && !isNaN(Number(v))) ? "$" + Number(v).toLocaleString() : null;
              const timelineLabels = { asap: "As soon as possible", "1-3mo": "1–3 months", "3-6mo": "3–6 months", "6mo+": "6+ months" };
              const housingLabels = { renting: "Renting", own: "Owns a home", family: "Living with family" };
              const preApprovedLabels = { yes: "Pre-approved", no: "Needs a lender", cash: "Cash buyer" };
              const budget = (money(d.budgetMin) && money(d.budgetMax)) ? `${money(d.budgetMin)} – ${money(d.budgetMax)}`
                : (money(d.budgetMax) || money(d.budgetMin) || null);
              const bedBath = [d.bedroomsMin ? `${d.bedroomsMin}+ bed` : null, d.bathroomsMin ? `${d.bathroomsMin}+ bath` : null].filter(Boolean).join(" · ") || null;
              const rows = [
                ["Budget", budget],
                ["Areas", d.preferredAreas],
                ["Property type", d.propType],
                ["Beds / baths", bedBath],
                ["Down payment", money(d.downPayment)],
                ["Financing", preApprovedLabels[d.preApproved] || d.preApproved],
                ["Lender", d.lenderName],
                ["Pre-approval amount", money(d.preApprovalAmount)],
                ["Timeline", timelineLabels[d.timeline] || d.timeline],
                ["First-time buyer", d.firstTime === "yes" ? "Yes" : d.firstTime === "no" ? "No" : null],
                ["Current housing", housingLabels[d.currentHousing] || d.currentHousing],
                ["Must-haves", d.mustHaves],
              ].filter(([, v]) => v != null && v !== "");
              if (!rows.length) return null;
              return (
                <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#1A5276", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>🔍 Buyer Search Criteria <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>from intake</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 200px) 1fr", rowGap: 8, columnGap: 16, fontSize: 14 }}>
                    {rows.map(([label, value]) => (
                      <div key={label} style={{ display: "contents" }}>
                        <div style={{ color: COLORS.muted, fontWeight: 600 }}>{label}</div>
                        <div style={{ color: COLORS.ink || "#111" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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
            {(tx.isCash || /cash/i.test(tx.financingType || "")) && (
              <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#065F46" }}>
                💵 Cash deal — no lender or financing. No loan application, lender appraisal, or financing contingency applies.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {[
                { title: "Property", rows: [["Assigned Agent", tx.assignedAgentName || "—"], ["Referral Source", tx.referralSource || "—"], ["Address", tx.address], ["City/County", `${tx.city}, ${tx.county} County`], ["Zip", tx.zipCode], ["Type", tx.propertyType], ["Transaction", tx.type], ["MLS #", tx.mlsNumber],
                  ["Year Built", tx.yearBuilt || "—"],
                  ["HOA", tx.inHoa === "yes" ? `Yes${tx.hoaFeeMonthly ? ` · $${Number(tx.hoaFeeMonthly).toLocaleString()}/mo` : ""}` : tx.inHoa === "no" ? "No" : "—"],
                  ["Flood Zone", tx.floodZone || "—"],
                  ["Lockbox / Gate Codes", tx.propertyAccess || "—"], ["Remote Closing", tx.mailAway || "No"]] },
                { title: isCoordinator ? "Price & Dates" : "Financials", rows: (() => {
                    // Coordinator: price + dates only — the agent's commission/splits/
                    // fees are never shown.
                    const _isCashDeal = tx.isCash || /cash/i.test(tx.financingType || "");
                    const _financingLabel = _isCashDeal
                      ? "💵 Cash — no lender"
                      : (tx.financingType
                          ? `${tx.financingType}${tx.financingContingency && tx.financingContingencyDays ? ` · ${tx.financingContingencyDays}d contingency` : ""}`
                          : (tx.financingContingency ? `Financed${tx.financingContingencyDays ? ` · ${tx.financingContingencyDays}d contingency` : ""}` : "—"));
                    const dateRows = [
                      ["List Price", tx.listPrice ? `$${Number(tx.listPrice).toLocaleString()}` : "—"],
                      ["Contract Price", tx.contractPrice ? `$${Number(tx.contractPrice).toLocaleString()}` : "—"],
                      ["Financing", _financingLabel],
                      ["Open Date", formatDate(tx.openDate)],
                      ["Executed Date", formatDate(tx.executedDate)],
                      ["Closing Date", formatDate(tx.closingDate)],
                      ["Days to Close", daysToClose !== null ? `${daysToClose}d` : "—"],
                      ["Remote Closing", tx.mailAway || "No"],
                    ];
                    if (isCoordinator) return dateRows;
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
                      ...dateRows,
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
              {/* ALL parties, clients first then agents then vendors — the old
                  first-6 cap silently hid the title company / HOA on full deals. */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {[...tx.parties].sort((a, b) => {
                  const rank = (p) => {
                    const r = (p.role || "").toLowerCase();
                    if (/^buyer$|^seller$/.test(r)) return 0;
                    if (/agent/.test(r)) return 1;
                    if (/title/.test(r)) return 2;
                    if (/lender|loan/.test(r)) return 3;
                    if (/hoa/.test(r)) return 4;
                    return 5;
                  };
                  return rank(a) - rank(b) || String(a.role || "").localeCompare(String(b.role || ""));
                }).map(p => <PartyCard key={p.id} party={p} />)}
              </div>
            </div>
            {!isGuest && /listing|seller|dual/i.test(tx.transactionType || tx.type || "") && (
              <MarketingLogPanel tx={tx} />
            )}
            <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, color: COLORS.navy, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</h3>
              <NotesSection value={tx.notes} onChange={v => update({ notes: v })} />
            </div>
          </div>
        )}

        {activeTab === "milestones" && (
          <div>
            {/* Pre-contract deals only show the active-phase steps; testers thought the
                inspection/closing-scheduling steps were "missing". Explain they unlock. */}
            {["Active", "New"].includes(tx.status) && !isCoordinator && (
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#1E3A8A" }}>
                📅 You're seeing the <strong>active / pre-contract</strong> steps. Contract &amp; closing steps — inspection dates, appraisal, scheduling the closing — <strong>unlock automatically once this deal goes Under Contract</strong>.
              </div>
            )}
            <MilestonesTab tx={tx} token={localStorage.getItem("tp_token") || ""} onSummaryChange={onMilestoneSummary} coordinatorMode={isCoordinator} />
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
            {!isGuest && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {/* Full preview + Send All for welcome emails — same modal the offer-accept
                    flow uses. Surfaced here (and not just buried in Overview/per-party) so
                    agents get the full email preview and can send everyone at once. */}
                {!isCoordinator && tx.parties.some(p => p.email && p.email.trim()) && (
                  <Btn onClick={() => setShowEmailPreview(true)} small>✉️ Preview &amp; Send Welcome Emails</Btn>
                )}
                {!isCoordinator && <Btn onClick={() => setShowAssignVendor(true)} small>🏆 Assign Vendor</Btn>}
                <Btn onClick={() => setShowAddParty(true)} small>+ Add Party</Btn>
              </div>
            )}
            {/* Coordinator: show the agent who owns/sent this deal, with contact info. */}
            {isCoordinator && (tx.assignedAgentName || tx.owningAgentEmail) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Agent · sent you this deal</div>
                <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <PartyAvatar party={{ name: tx.assignedAgentName || "Agent", role: "Agent" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>{tx.assignedAgentName || "Agent"}</div>
                    <div style={{ fontSize: 12, color: roleColor("Agent"), fontWeight: 600, marginBottom: 2 }}>{tx.owningAgentTitle || "Agent"}{tx.owningBrokerageName ? " · " + tx.owningBrokerageName : ""}</div>
                    {tx.owningAgentEmail && <div style={{ fontSize: 12, color: COLORS.muted }}>{tx.owningAgentEmail}</div>}
                    {tx.owningAgentPhone && <div style={{ fontSize: 12, color: COLORS.muted }}>{tx.owningAgentPhone}</div>}
                  </div>
                </div>
              </div>
            )}
            {isCoordinator && <CoordinatorAssignControl tx={tx} currentUser={currentUser} />}
            {!isGuest && !isCoordinator && <ActiveFollowups txId={tx.id} />}
            {!isGuest && !isCoordinator && <Suspense fallback={null}><CoordinatorPanel txId={tx.id} /></Suspense>}
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
              const members = tx.parties.filter(p => p.role === role && !p.isVendor && !p.is_vendor && !(isCoordinator && (p.email || "").toLowerCase() === (currentUser?.email || "").toLowerCase()));
              if (!members.length) return null;
              return <div key={role} style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{role}</div>{members.map(p => <PartyCard key={p.id} party={p} txId={tx.id} onEdit={isGuest ? () => setPaywallFeature("Editing parties") : () => setEditingParty({ ...p })} onRemove={isGuest ? () => setPaywallFeature("Removing parties") : () => isCoordinator ? coordDeleteParty(p.id) : update({ parties: tx.parties.filter(pp => pp.id !== p.id) })} onInvite={isGuest ? () => setPaywallFeature("Inviting parties to the app") : (isCoordinator ? undefined : (onInviteParty && isOwnSideClientRole(p.role) ? () => onInviteParty(p) : undefined))} onCopyLoginLink={isGuest ? () => setPaywallFeature("Sharing portal login links") : (isCoordinator ? undefined : (onCopyLoginLink && isOwnSideClientRole(p.role) ? () => onCopyLoginLink(p) : undefined))} onSendFollowup={isGuest ? () => setPaywallFeature("Follow-up reminders") : (party) => setFollowupParty(party)} onResetPin={(!isGuest && !isCoordinator && isOwnSideClientRole(p.role)) ? async (p2) => {
                if (!window.confirm(`Reset the portal PIN for ${p2.name}?\n\nTheir old PIN stops working immediately. The next time they open their portal link, they'll be asked to create a new PIN.`)) return;
                try {
                  const r = await fetch(API + "/admin/clients/reset-portal-pin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") }, body: JSON.stringify({ email: p2.email }) });
                  const d = await r.json();
                  if (!r.ok || !d.success) throw new Error(d.error || "Reset failed");
                  alert(`✅ PIN cleared for ${p2.name}. Tell them to open their portal link again — it will ask them to CREATE a new 4-digit PIN.`);
                } catch (e) { alert("Could not reset PIN: " + e.message); }
              } : undefined} onSendWelcome={isGuest ? () => setPaywallFeature("Welcome emails") : onSendWelcome} onResetPassword={undefined /* password login retired for clients — portal is link+PIN; staff resets live in Team settings */} />)}</div>;
            })}
            {(() => {
              const vendorParties = tx.parties.filter(p => (p.isVendor || p.is_vendor || !PARTY_ROLES.includes(p.role)) && !(isCoordinator && (p.email || "").toLowerCase() === (currentUser?.email || "").toLowerCase()));
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
                        onEdit={isGuest ? () => setPaywallFeature("Editing parties") : () => setEditingParty({ ...p })}
                      onRemove={isGuest ? () => setPaywallFeature("Removing parties") : async () => {
                        if (!window.confirm("Remove this vendor from the transaction?")) return;
                        const tok = localStorage.getItem("tp_token") || "";
                        try {
                          await fetch("https://liz-team-server-api-production.up.railway.app/transactions/" + tx.id + "/party/" + p.id, {
                            method: "DELETE", headers: { Authorization: "Bearer " + tok }
                          });
                        } catch(e) {}
                        onUpdate({ ...tx, parties: tx.parties.filter(pp => pp.id !== p.id) });
                      }}
                        onInvite={isGuest ? () => setPaywallFeature("Inviting parties to the app") : (onInviteParty && isOwnSideClientRole(p.role) ? () => onInviteParty(p) : undefined)}
                        onSendFollowup={isGuest ? () => setPaywallFeature("Follow-up reminders") : (party) => setFollowupParty(party)}
                        onSendWelcome={isGuest ? () => setPaywallFeature("Welcome emails") : onSendWelcome} onResetPassword={undefined /* password login retired for clients — portal is link+PIN; staff resets live in Team settings */} />
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

        {activeTab === "sms" && (isCoordinator ? <CoordinatorSendUpdate tx={tx} /> : <SMSPanel tx={tx} onUpdate={onUpdate} />)}

        {activeTab === "replies" && <InboundRepliesPanel tx={tx} coordinatorMode={coordinatorMode} onInboundRead={onInboundRead} />}

        {/* MESSAGES HUB — one tab, three clearly-separated channels. Same for the
            agent and the coordinator (the only difference is the "Send" tool). */}
        {activeTab === "messages" && !isGuest && (
          <div>
            <div style={{ display: "flex", gap: 8, padding: "12px 12px 0", flexWrap: "wrap" }}>
              {[
                ["chat", "💬 Group chat", chatUnread > 0 ? chatUnread : 0],
                ["replies", "📥 Client replies", unreadReplyCount > 0 ? unreadReplyCount : 0],
                ["send", "📤 Send a text or email", 0],
                ["sent", "🧾 Sent history", 0],
              ].map(([id, label, n]) => (
                <button key={id} onClick={() => setMsgSection(id)}
                  style={{ padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit",
                    fontWeight: 700, fontSize: 13,
                    background: msgSection === id ? "#0F2044" : "#eef2f7", color: msgSection === id ? "#fff" : "#374151" }}>
                  {label}{n > 0 ? ` (${n})` : ""}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", padding: "8px 14px 0" }}>
              {msgSection === "chat" && "The deal's group chat — everyone on it (you, the agent/coordinator, and any parties like the photographer, title, lender)."}
              {msgSection === "replies" && "Replies the clients sent back — approve any milestone updates."}
              {msgSection === "send" && (isCoordinator ? "Send the client an email/text update in the agent's voice." : "Send an email or text to a party (or the whole group).")}
              {msgSection === "sent" && "Every email and text this deal has sent — welcome emails, reminders, updates — newest first."}
            </div>
            {msgSection === "chat" && <div style={{ padding: 12, height: 500 }}><TransactionChat transactionId={tx.id} user={null} parties={tx.parties || []} style={{ height: "100%" }} unreadCount={chatUnread} onUnreadChange={() => {}} /></div>}
            {msgSection === "replies" && <InboundRepliesPanel tx={tx} coordinatorMode={coordinatorMode} onInboundRead={onInboundRead} />}
            {msgSection === "send" && (isCoordinator ? <CoordinatorSendUpdate tx={tx} /> : <SMSPanel tx={tx} onUpdate={onUpdate} sendOnly />)}
            {msgSection === "sent" && <SentHistoryPanel txId={tx.id} />}
          </div>
        )}

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

        {activeTab === "documents" && <DocumentsTab tx={tx} coordinatorMode={isCoordinator} />}
        {activeTab === "offers" && <OffersTab tx={tx} token={localStorage.getItem("tp_token") || ""} currentUser={currentUser} createSignal={offerCreateSignal} />}
        {activeTab === "calculator" && (
          <div style={{ padding: 20 }}>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#7f1d1d" }}>
              <strong>🎓 Why this matters:</strong> Use this with your buyer to set realistic expectations on price, monthly payment, and cash-to-close BEFORE writing offers. Florida's doc stamps, intangible tax, and insurance costs surprise most first-time buyers.
            </div>
            <BuyerCalculator transactionId={tx.id} token={localStorage.getItem("tp_token") || ""} county={tx.county} />
          </div>
        )}

        {activeTab === "buyer-net" && (
          <div style={{ padding: 20 }}>
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#14532d" }}>
              <strong>🎓 Why this matters:</strong> Give your buyer a clear estimate of the cash they'll need at closing, then generate a branded English or Spanish net sheet and save it to Documents.
            </div>
            <BuyerCalculator mode="net" transactionId={tx.id} token={localStorage.getItem("tp_token") || ""} county={tx.county} />
          </div>
        )}

        {activeTab === "cma" && (
          <CmaTool tx={tx} token={localStorage.getItem("tp_token") || ""} currentUser={currentUser} />
        )}

        {activeTab === "seller-calc" && (
          <div style={{ padding: 20 }}>
            <div style={{ background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#0c4a6e" }}>
              <strong>🎓 Why this matters:</strong> Sellers want to know what they'll walk away with. Use this BEFORE the listing appointment to set realistic expectations on commission, FL doc stamps (~0.7%), title fees, and mortgage payoff. Avoids "I thought I was getting more" at closing.
            </div>
            <SellerCalculator transactionId={tx.id} token={localStorage.getItem("tp_token") || ""} county={tx.county} />
          </div>
        )}

        {activeTab === "tx-forms" && (
          <TxFormsTab tx={tx} side={isListingSideTx ? "listing" : "buyer"} isAdmin={false} />
        )}

        {activeTab === "activity" && (() => {
          if (!activitiesLoaded) {
            const tok = localStorage.getItem("tp_token") || "";
            fetch(API + "/activity/" + tx.id, { headers: { "Authorization": "Bearer " + tok } })
              .then(r => r.json()).then(d => { if (d.activities) setActivities(d.activities); setActivitiesLoaded(true); }).catch(e => console.error("[bg]", e && e.message ? e.message : e));
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
              const _remHdrs = { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") };
              // Reminders live in their own table — the whole-tx PUT doesn't persist
              // them, so Done/Snooze MUST hit the dedicated reminders endpoints or
              // they reappear on reload.
              const isDone = !!r.doneAt;
              const bumpToTomorrow = async () => {
                const next = new Date();
                next.setDate(next.getDate() + 1);
                const iso = next.toISOString().slice(0, 10);
                try { await fetch(`${API}/reminders/save`, { method: "POST", headers: _remHdrs, body: JSON.stringify({ id: r.id, transactionId: tx.id, title: r.title, message: r.message, date: iso, channels: r.channels, parties: r.parties }) }); } catch {}
                update({ reminders: (tx.reminders || []).map(rr => rr.id === r.id ? { ...rr, date: iso } : rr) });
              };
              const markDone = async () => {
                try { await fetch(`${API}/reminders/${r.id}/done`, { method: "POST", headers: _remHdrs }); } catch {}
                update({ reminders: (tx.reminders || []).map(rr => rr.id === r.id ? { ...rr, doneAt: new Date().toISOString() } : rr) });
              };
              const reopenReminder = async () => {
                try { await fetch(`${API}/reminders/${r.id}/reopen`, { method: "POST", headers: _remHdrs }); } catch {}
                update({ reminders: (tx.reminders || []).map(rr => rr.id === r.id ? { ...rr, doneAt: null } : rr) });
              };
              const removeReminder = async () => {
                try { await fetch(`${API}/reminders/${r.id}`, { method: "DELETE", headers: _remHdrs }); } catch {}
                update({ reminders: (tx.reminders || []).filter(rr => rr.id !== r.id) });
              };
              return (
                <div key={r.id} style={{ background: isDone ? "#F8FAF8" : "#fff", border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${isDone ? "#1E8449" : COLORS.gold}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, opacity: isDone ? 0.75 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, textDecoration: isDone ? "line-through" : "none", color: isDone ? "#6B7280" : COLORS.text }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 3 }}>
                      {formatDate(r.date)}{" "}
                      {isDone
                        ? <span style={{ color: "#1E8449", fontWeight: 700 }}>✅ Done {formatDate(r.doneAt)}</span>
                        : d !== null && <span style={{ color: d < 0 ? COLORS.danger : d <= 3 ? COLORS.warning : COLORS.muted }}>({d === 0 ? "Today" : d > 0 ? `in ${d}d` : `${Math.abs(d)}d ago`})</span>}
                    </div>
                    {r.message && <div style={{ fontSize: 13, marginTop: 4, fontStyle: "italic" }}>{r.message}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {isDone ? (
                      <button onClick={reopenReminder} title="Not actually done? Bring it back — it returns to Win The Day too" style={{ background: "#fff", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>↩️ Reopen</button>
                    ) : (
                      <>
                        <button onClick={markDone} title="Mark done — stays here for the record, stops all nagging" style={{ background: "#1E8449", border: "none", color: "#fff", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Done</button>
                        <button onClick={bumpToTomorrow} title="Snooze 1 day — reappears tomorrow" style={{ background: "#fff", border: `1px solid ${COLORS.border}`, color: COLORS.muted, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>⏰ Not Today</button>
                      </>
                    )}
                    <button onClick={removeReminder} title="Delete reminder" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, fontSize: 18, padding: "0 6px" }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingParty && (
        <Modal title="Edit Party" onClose={() => setEditingParty(null)}>
          <Input label="Role" value={PARTY_ROLES.includes(editingParty.role) ? editingParty.role : "Other"} onChange={v => setEditingParty(p => ({ ...p, role: v }))} options={PARTY_ROLES} required />
          {(editingParty.role === "Other" || (editingParty.role && !PARTY_ROLES.includes(editingParty.role))) && (
            <Input label="Specify role" value={editingParty.role === "Other" ? "" : editingParty.role} onChange={v => setEditingParty(p => ({ ...p, role: v.trim() ? v : "Other" }))} placeholder="e.g. Notary, Surveyor, Co-buyer" />
          )}
          <Input label="Full Name" value={editingParty.name} onChange={v => setEditingParty(p => ({ ...p, name: v }))} required />
          <Input label="Company / Brokerage" value={editingParty.company || ""} onChange={v => setEditingParty(p => ({ ...p, company: v }))} />
          <Input label="Email" value={editingParty.email || ""} onChange={v => setEditingParty(p => ({ ...p, email: v }))} type="email" />
          <Input label="Cell Phone (for SMS)" value={editingParty.phone || ""} onChange={v => setEditingParty(p => ({ ...p, phone: v }))} type="tel" />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setEditingParty(null)}>Cancel</Btn>
            <Btn onClick={async () => {
              const editedParty = editingParty;
              // Editing a party ONLY saves — it never emails anyone, not even a
              // prompt. To (re)send a welcome, use the ✉️ Send Welcome button on
              // the party row, which sends to that one person on purpose.
              if (isCoordinator) await coordEditParty(editedParty);
              else await update({ parties: tx.parties.map(p => p.id === editedParty.id ? editedParty : p) });
              setEditingParty(null);
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
      {showLeaseDocs && (
        <LeaseDocsModal tx={tx} onClose={() => setShowLeaseDocs(false)} onGenerated={() => { setShowLeaseDocs(false); setActiveTab("documents"); }} />
      )}
      {showPortalPreview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: COLORS.bg, overflowY: "auto" }}>
          <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: COLORS.muted }}>Loading the client's view…</div>}>
            <ClientPortal
              user={currentUser || { firstName: "Preview" }}
              previewTxId={tx.id}
              onExitPreview={() => setShowPortalPreview(false)}
              onLogout={() => setShowPortalPreview(false)}
            />
          </Suspense>
        </div>
      )}
      {paywallFeature && (
        <div onClick={() => setPaywallFeature(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", margin: "auto" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>✨</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.navy, marginBottom: 8 }}>{paywallFeature} is a paid feature</div>
            <div style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6, marginBottom: 20 }}>
              You're viewing this transaction as an invited party. {paywallFeature} — along with your own pipeline, automated reminders, documents, and more — is part of a TransactPro subscription.
            </div>
            <button onClick={() => setPaywallFeature(null)} style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Subscribe to unlock</button>
            <div style={{ marginTop: 12 }}><button onClick={() => setPaywallFeature(null)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Maybe later</button></div>
          </div>
        </div>
      )}
      {/* Tab-independent: opened from Overview AND the People tab (rendering it
          inside the overview block made the People-tab button do nothing). */}
      {showEmailPreview && (
        <WelcomeEmailPreview
          txId={tx.id}
          onClose={() => { setShowEmailPreview(false); window.location.reload(); }}
        />
      )}
      {/* Single-party variant: the ✉️ Send Welcome button on a person's card. */}
      {welcomePreviewPartyId && (
        <WelcomeEmailPreview
          txId={tx.id}
          onlyPartyId={welcomePreviewPartyId}
          onClose={() => setWelcomePreviewPartyId(null)}
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
          <Input label="Role" value={PARTY_ROLES.includes(partyForm.role) ? partyForm.role : "Other"} onChange={v => setPartyForm(f => ({ ...f, role: v }))} options={PARTY_ROLES} required />
          {(partyForm.role === "Other" || (partyForm.role && !PARTY_ROLES.includes(partyForm.role))) && (
            <Input label="Specify role" value={partyForm.role === "Other" ? "" : partyForm.role} onChange={v => setPartyForm(f => ({ ...f, role: v.trim() ? v : "Other" }))} placeholder="e.g. Notary, Surveyor, Co-buyer" />
          )}
          <Input label="Full Name" value={partyForm.name} onChange={v => setPartyForm(f => ({ ...f, name: v }))} required />
          <Input label="Company / Brokerage" value={partyForm.company} onChange={v => setPartyForm(f => ({ ...f, company: v }))} />
          <Input label="Email" value={partyForm.email} onChange={v => setPartyForm(f => ({ ...f, email: v }))} type="email" />
          <Input label="Cell Phone (for SMS)" value={partyForm.phone} onChange={v => setPartyForm(f => ({ ...f, phone: v }))} type="tel" placeholder="407-555-0100" />
          {(partyForm.role === "Buyer" || partyForm.role === "Seller") && (<>
            <Input label="Mailing Address" value={partyForm.mailingAddress} onChange={v => setPartyForm(f => ({ ...f, mailingAddress: v }))} />
            <Input label="Preferred Communication" value={partyForm.preferredComm} onChange={v => setPartyForm(f => ({ ...f, preferredComm: v }))} options={["Email", "Phone", "Text"]} />
            <Input label="Checks Email Frequently?" value={partyForm.checksEmail} onChange={v => setPartyForm(f => ({ ...f, checksEmail: v }))} options={["Yes", "No"]} />
            {partyForm.role === "Buyer" && <Input label="Primary Residence?" value={partyForm.primaryResidence} onChange={v => setPartyForm(f => ({ ...f, primaryResidence: v }))} options={["Yes", "No"]} />}
            <Input label="Closing remotely? (mail-away / mobile notary)" value={partyForm.mailAway} onChange={v => setPartyForm(f => ({ ...f, mailAway: v }))} options={["Yes", "No"]} />
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
                if (isCoordinator) {
                  // Coordinator: save via the /tc party endpoint (no whole-tx PUT,
                  // no portal-invite flow).
                  coordAddParty(partyForm);
                } else {
                  update({ parties: [...tx.parties, newParty] });
                  if (document.getElementById("saveContact")?.checked && onSaveContact) {
                    onSaveContact({ ...partyForm, id: genId() });
                  }
                  // Portals are for the agent's OWN client only (buyer on a buyer-rep
                  // deal, seller on a listing) + the TC — never title/lender/co-op/etc.
                  const invitable = isOwnSideClientRole(newParty.role);
                  const invitedNow = invitable && document.getElementById("sendInvitation")?.checked;
                  if (invitedNow && onInviteParty) {
                    onInviteParty({ ...newParty });
                  }
                  // Prompt to send invite if email present and not already invited
                  if (invitable && !invitedNow && newParty.email && onInviteParty) {
                    setPendingInviteParty(newParty);
                  }
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif", overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden", margin: "auto" }}>
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
                  if (newStatus === "Cancelled" && (window.prompt(`Cancel "${tx.address || "this transaction"}"? It will be HIDDEN from your dashboard (not deleted). Type CANCEL to confirm.`) || "").trim().toUpperCase() !== "CANCEL") return;
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
                No parties with email/phone yet. Add them in the People tab to enable follow-ups.
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
          {(() => {
            // Role-smart quick asks — one tap prefills subject + message, editable after.
            const fn = (followupParty.name || "").split(" ")[0] || "there";
            const SUGG = {
              lender: [
                ["Loan application status", `Hi ${fn} — quick check on ${tx.address}: has the buyer's loan application been received and is anything outstanding from them?`],
                ["Appraisal ordered?", `Hi ${fn} — has the appraisal been ordered for ${tx.address}? Any ETA on the appointment?`],
                ["Loan approval / commitment ETA", `Hi ${fn} — where do we stand on loan approval for ${tx.address}? Our financing deadline is coming up and I want to stay ahead of it.`],
                ["Closing Disclosure timing", `Hi ${fn} — closing on ${tx.address} is approaching. Will the CD be out at least 3 business days before closing?`],
              ],
              title: [
                ["EMD received?", `Hi ${fn} — can you confirm the earnest money deposit for ${tx.address} was received, and send the receipt?`],
                ["Title commitment status", `Hi ${fn} — any update on the title commitment for ${tx.address}?`],
                ["Closing time & wire instructions", `Hi ${fn} — can we confirm the closing time for ${tx.address}, and get the wire/cash-to-close instructions (my client will verify by phone)?`],
              ],
              inspector: [
                ["Inspection report ETA", `Hi ${fn} — when should we expect the inspection report for ${tx.address}?`],
              ],
              hoa: [
                ["Estoppel / approval status", `Hi ${fn} — checking on the estoppel and any HOA approval requirements for ${tx.address}.`],
              ],
            };
            const r = (followupParty.role || "").toLowerCase();
            const list = /lender|loan/.test(r) ? SUGG.lender : /title/.test(r) ? SUGG.title : /inspector/.test(r) ? SUGG.inspector : /hoa/.test(r) ? SUGG.hoa : null;
            if (!list) return null;
            return (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Quick asks for a {followupParty.role}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {list.map(([label, msg]) => (
                    <button key={label} onClick={() => setFollowupForm({ subject: label + " — " + tx.address, message: msg })}
                      style={{ background: "#EFF6FF", border: "1px solid #93C5FD", color: "#1E40AF", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden", fontFamily: "system-ui, sans-serif", margin: "auto" }}>
            <div style={{ background: "#111", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Edit Transaction</div>
              <button onClick={() => setShowEditTx(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 20, cursor: "pointer" }}>x</button>
            </div>
            <div style={{ padding: 24, overflowY: "auto", maxHeight: "70vh" }}>
              {(() => {
                const isListing = !/buyer/i.test(editTxForm.type || "");
                const rows = [
                  [isListing ? "Listing Agreement Start Date" : "Open Date", "openDate", "date"],
                  [isListing ? "Listing agreement expires" : "Buyer agreement expires", "representationExpiresOn", "date"],
                  ["Closing Date", "closingDate", "date"],
                  ["Executed Date", "executedDate", "date"],
                  ["Contract Price", "contractPrice", "number"],
                  ["MLS Number", "mlsNumber", "text"],
                ];
                return rows.map(([label, field, type]) => (
                <div key={field} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
                  <input type={type} value={editTxForm[field] ? (type === "date" ? String(editTxForm[field]).slice(0,10) : editTxForm[field]) : ""} onChange={e => setEditTxForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
                  {field === "representationExpiresOn" && isListing && <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>We'll warn you 14, 7, and 1 days before it expires so the listing doesn't lapse in the MLS.</div>}
                </div>
                ));
              })()}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>City</div><input value={editTxForm.city || ""} onChange={e => setEditTxForm(f => ({ ...f, city: e.target.value }))} placeholder="City" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} /></div><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>ZIP</div><input value={editTxForm.zipCode || ""} onChange={e => setEditTxForm(f => ({ ...f, zipCode: e.target.value }))} placeholder="ZIP code" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} /></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>County</div><select value={editTxForm.county || ""} onChange={e => setEditTxForm(f => ({ ...f, county: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit" }}>{["Orange","Osceola","Seminole","Polk","Lake","Volusia","Other"].map(c => <option key={c}>{c}</option>)}</select></div><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Property Type</div><select value={editTxForm.propertyType || ""} onChange={e => setEditTxForm(f => ({ ...f, propertyType: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit" }}>{(PROPERTY_TYPES.includes(editTxForm.propertyType) || !editTxForm.propertyType ? PROPERTY_TYPES : [editTxForm.propertyType, ...PROPERTY_TYPES]).map(t => <option key={t}>{t}</option>)}</select></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Year Built <span style={{ color: "#C0392B" }}>*</span></div>
                  <input type="number" value={editTxForm.yearBuilt || ""} onChange={e => setEditTxForm(f => ({ ...f, yearBuilt: e.target.value }))} placeholder="e.g. 1998"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid " + (editTxForm.yearBuilt ? "#CCC" : "#E5A5A5"), fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Sets which disclosures apply (e.g. lead-based paint on pre-1978 homes).</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>In an HOA / condo association? <span style={{ color: "#C0392B" }}>*</span></div>
                  <select value={editTxForm.inHoa || ""} onChange={e => setEditTxForm(f => ({ ...f, inHoa: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid " + (editTxForm.inHoa ? "#CCC" : "#E5A5A5"), fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }}>
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Adds the HOA disclosure when Yes.</div>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Construction Type</div><select value={editTxForm.constructionType || "Resale"} onChange={e => setEditTxForm(f => ({ ...f, constructionType: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit" }}>{["Resale","New Construction","Vacant Land","Commercial"].map(t => <option key={t}>{t}</option>)}</select></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Transaction Type</div><select value={editTxForm.type || ""} onChange={e => setEditTxForm(f => ({ ...f, type: e.target.value }))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit" }}>{TRANSACTION_TYPES.map(t => <option key={t}>{t}</option>)}</select></div><div><div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>{isLeaseType(editTxForm.type) ? "Monthly Rent ($)" : "List Price ($)"}</div><input type="number" value={editTxForm.listPrice || ""} onChange={e => setEditTxForm(f => ({ ...f, listPrice: e.target.value }))} placeholder="450000" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} /></div></div>
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
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Lockbox / Gate / Alarm Codes</div>
                <textarea value={editTxForm.propertyAccess || ""} onChange={e => setEditTxForm(f => ({ ...f, propertyAccess: e.target.value }))} placeholder="Lockbox code, gate code, special instructions..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", minHeight: 60, resize: "vertical" }} />
              </div>
              <div style={{ background: "#F4F4F4", borderRadius: 10, padding: 16, marginBottom: 16, display: isCoordinator ? "none" : "block" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#111" }}>Commission Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[["Listing Agent Commission %", "commissionListing"], ["Buyer Agent Commission %", "commissionBuyer"], ["Transaction Fee", "transactionFee"], ["Brokerage Split %", "brokerageSplit"], ["Office Flat Fee", "officeFlatFee"]].map(([label, field]) => (
                    <div key={field}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                      <input value={editTxForm[field] || ""} onChange={e => setEditTxForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 4 }}>Closing remotely? (mail-away)</div>
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
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Deposit deadline (earnest money)</div>
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
                  {/* Agreement start/expiration are set up top (Transaction Details) for every deal type. */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Flood Zone</div>
                    <input value={editTxForm.floodZone || ""} onChange={e => setEditTxForm(f => ({ ...f, floodZone: e.target.value }))} placeholder="e.g. AE, X" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                    <div style={{ fontSize: 11.5, color: "#888", marginTop: 4 }}>From the flood map (your title company or realtor MLS sheet has it). X = low risk. AE or A = flood insurance likely required — the app adds the flood addendum.</div>
                  </div>
                  {/* Compliance-checklist triggers the app can't infer */}
                  <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#333", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!editTxForm.sellerIsForeign} onChange={e => setEditTxForm(f => ({ ...f, sellerIsForeign: e.target.checked }))} />
                      <span>Seller is a <b>foreign person</b> (FIRPTA) <span style={{ color: "#888", fontWeight: 400 }}>— adds FIRPTA docs; withholding is the buyer's liability if missed</span></span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#333", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!editTxForm.isCoastal} onChange={e => setEditTxForm(f => ({ ...f, isCoastal: e.target.checked }))} />
                      <span><b>Coastal</b> property (seaward of the CCCL) <span style={{ color: "#888", fontWeight: 400 }}>— adds the coastal/erosion disclosure</span></span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#333", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!editTxForm.sellerPaysBuyerBroker} onChange={e => setEditTxForm(f => ({ ...f, sellerPaysBuyerBroker: e.target.checked }))} />
                      <span>Seller is <b>paying the buyer's broker</b> commission <span style={{ color: "#888", fontWeight: 400 }}>— adds the Seller's Agreement re Buyer-Broker Comp (Rider GG)</span></span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#333", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!editTxForm.isShortSale} onChange={e => setEditTxForm(f => ({ ...f, isShortSale: e.target.checked }))} />
                      <span><b>Short sale</b> <span style={{ color: "#888", fontWeight: 400 }}>— adds the Short Sale Addendum</span></span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#333", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!editTxForm.hasSellerFinancing} onChange={e => setEditTxForm(f => ({ ...f, hasSellerFinancing: e.target.checked }))} />
                      <span><b>Seller financing</b> <span style={{ color: "#888", fontWeight: 400 }}>— adds the Seller Financing Addendum</span></span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#333", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!editTxForm.sellerPostClosingOccupancy} onChange={e => setEditTxForm(f => ({ ...f, sellerPostClosingOccupancy: e.target.checked }))} />
                      <span>Seller <b>stays after closing</b> <span style={{ color: "#888", fontWeight: 400 }}>— adds the Post-Closing Occupancy Agreement</span></span>
                    </label>
                  </div>
                  <div style={{ marginBottom: 14, maxWidth: 280 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Financing Type</div>
                    <select value={editTxForm.financingType || ""} onChange={e => setEditTxForm(f => ({ ...f, financingType: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 14, fontFamily: "inherit" }}>
                      <option value="">—</option>
                      <option>Conventional</option>
                      <option>FHA</option>
                      <option>VA</option>
                      <option>Cash</option>
                      <option>Other</option>
                    </select>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>FHA or VA adds the FHA/VA Financing Addendum to the checklist.</div>
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
                  // Year Built is required on real property deals — it determines which
                  // disclosures apply (lead-based paint, etc.). Skip the check for
                  // prospecting/buyer-search records that have no property yet.
                  const isProspect = /^\s*buyer search\b/i.test(editTxForm.address || "");
                  const yb = parseInt(editTxForm.yearBuilt, 10);
                  if (!isProspect && (!editTxForm.yearBuilt || !Number.isFinite(yb) || yb < 1800 || yb > 2100)) {
                    alert("Please enter the Year Built (a valid 4-digit year). It's required to determine which disclosures this deal needs — for example, lead-based paint applies only to homes built before 1978.");
                    return;
                  }
                  if (!isProspect && !editTxForm.inHoa) {
                    alert("Please answer whether the property is in an HOA or condo association. It determines whether the HOA disclosure is required.");
                    return;
                  }
                  // The form is pre-filled from the tx via buildEditTxForm, so an empty
                  // value means the user intentionally cleared the field. Merge directly
                  // and let empty strings through — otherwise clearing a field silently
                  // saves the old value. Also: the form writes to `assignedAgent` but
                  // updateTransaction reads `assignedAgentId` — map the new value over.
                  // Also map the new agent's NAME so the deal/card updates immediately
                  // instead of showing the old name until a manual reload. (tester #10)
                  const _assignedMember = teamMembers.find(m => String(m.id) === String(editTxForm.assignedAgent));
                  const updated = { ...tx, ...editTxForm, assignedAgentId: editTxForm.assignedAgent,
                    assignedAgentName: _assignedMember ? `${_assignedMember.first_name} ${_assignedMember.last_name}` : (editTxForm.assignedAgent ? tx.assignedAgentName : "") };
                  // Recompute contract-phase task deadlines whenever ANY of the basis
                  // dates change (closing, executed, open). These are legal deadlines
                  // — if the contract is re-executed, inspection-period and EMD
                  // deadlines MUST shift; leaving them on the old date is a compliance
                  // risk. Always overwrite rather than only-when-empty so re-executed
                  // contracts actually update.
                  const datesChanged = (
                    (editTxForm.closingDate && editTxForm.closingDate !== tx.closingDate) ||
                    (editTxForm.executedDate && editTxForm.executedDate !== tx.executedDate) ||
                    (editTxForm.openDate && editTxForm.openDate !== tx.openDate)
                  );
                  if (datesChanged) {
                    const templates = FLORIDA_TASK_TEMPLATES[tx.type] || [];
                    updated.tasks = tx.tasks.map(task => {
                      const template = templates.find(t => t.name === task.name);
                      if (template && template.phase === "contract") {
                        if (template.daysFromOpen < 0 && editTxForm.closingDate) {
                          return { ...task, dueDate: addDays(editTxForm.closingDate, template.daysFromOpen) };
                        }
                        if (template.daysFromOpen >= 0) {
                          const cd = editTxForm.executedDate || editTxForm.openDate;
                          return { ...task, dueDate: cd ? addDays(cd, template.daysFromOpen) : task.dueDate };
                        }
                      }
                      return task;
                    });
                  }
                  onUpdate(updated); setShowEditTx(false);
                  // If constructionType changed, fire the backend PATCH
                  if (editTxForm.constructionType && editTxForm.constructionType !== tx.constructionType) {
                    const tok = localStorage.getItem("tp_token") || "";
                    fetch(API + "/transactions/" + tx.id + "/construction-type", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
                      body: JSON.stringify({ constructionType: editTxForm.constructionType })
                    }).catch(e => console.error("[bg]", e && e.message ? e.message : e));
                  }
                }} style={{ padding: "10px 20px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- NEW TRANSACTION ──────────────────────────────────────────
function NewTransactionForm({ onSave, onCancel, prefill = null, cmaId = null, onImportContract = null, currentUser = null }) {
  const [step, setStep] = useState(1); // 1 property · 2 client · 3 price & source
  const [form, setForm] = useState({ address: "", city: "", county: "Osceola", zipCode: "", type: "Listing (Seller)", propertyType: "Single Family", constructionType: "Resale", listPrice: "", contractPrice: "", mlsNumber: "", openDate: today(), closingDate: "", executedDate: "", representationExpiresOn: "", leaseTerm: "1 Year", notes: "", status: "Active", assignedAgent: "", referralSource: "", occupancyStatus: "", propertyAccess: "", commissionListing: "", commissionBuyer: "", transactionFee: "", brokerageSplit: "", officeFlatFee: "", commissionNotes: "", clientName: "", clientEmail: "", clientPhone: "", ...(prefill || {}) });
  const [teamAgents, setTeamAgents] = useState([]);
  useEffect(() => { const tok = localStorage.getItem("tp_token") || ""; fetch(API + "/users", { headers: { "Authorization": "Bearer " + tok } }).then(r => r.json()).then(d => { if (d.users) setTeamAgents(d.users.filter(u => u.role === "agent" || u.role === "admin" || u.role === "superadmin")); }).catch(e => console.error("[bg]", e && e.message ? e.message : e)); }, []);
  // Rookie default: assign the deal to YOURSELF — nobody should fail to create
  // a deal because they didn't know what "Assigned Agent" meant.
  useEffect(() => {
    if (currentUser?.id) setForm(p => (p.assignedAgent ? p : { ...p, assignedAgent: currentUser.id }));
  }, [currentUser]);
  const [useFLTemplates, setUseFLTemplates] = useState(true);
  const [taskTemplates, setTaskTemplates] = useState([]);
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/task-templates?state=FL&transactionType=" + encodeURIComponent(form.type), {
      headers: { "Authorization": "Bearer " + tok }
    }).then(r => r.json()).then(d => {
      if (d.success) setTaskTemplates(d.templates || []);
    }).catch(e => console.error("[bg]", e && e.message ? e.message : e));
  }, [form.type]);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const isListingSide = /listing|landlord/i.test(form.type);
  // Step 2 contact picker: search the agent's Contacts and fill the client
  // fields with one tap (Carlos 7/20: "doesn't let me choose from contacts").
  const [contactSearch, setContactSearch] = useState("");
  const [contactHits, setContactHits] = useState([]);
  useEffect(() => {
    const q = contactSearch.trim();
    if (q.length < 2) { setContactHits([]); return; }
    const t = setTimeout(async () => {
      try {
        const tok = localStorage.getItem("tp_token") || "";
        const r = await fetch(API + "/contacts?search=" + encodeURIComponent(q), { headers: { Authorization: "Bearer " + tok } });
        const d = await r.json();
        setContactHits((d.contacts || []).slice(0, 6));
      } catch { setContactHits([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [contactSearch]);
  const handleSave = async () => {
    if (!form.address || !form.city) { alert("Please enter the property address and city."); return; }
    if (!form.assignedAgent) { alert("Pick which agent this deal belongs to."); return; }
    if (!form.referralSource) { alert("Pick where this client came from — it powers your reports."); return; }
    if (isListingSide) {
      const ybNum = parseInt(form.yearBuilt, 10);
      if (!form.yearBuilt || !Number.isFinite(ybNum) || ybNum < 1800 || ybNum > 2100) { alert("Please enter the Year Built (4 digits) — it decides which disclosures this listing needs (e.g. lead paint before 1978)."); return; }
      if (!form.inHoa) { alert("Please answer whether the property is in an HOA / condo association."); return; }
      if (!form.occupancyStatus) { alert("Please pick who lives in the property right now."); return; }
    }
    const contractDate = form.executedDate || form.openDate;
    const tasks = useFLTemplates ? taskTemplates.filter(t => t.phase === "active").map(t => ({ id: genId(), name: t.task_name, category: t.category, assignTo: t.default_assignee_role, dueDate: null, status: "Pending", notes: "", phase: "active" })) : [];
    // If the agent entered their client up front, seed them as the first party
    // with the role implied by the side of the deal. Optional — a blank client
    // just creates the deal with no parties (added later in the Parties tab).
    const clientRole = /buyer/i.test(form.type) ? "Buyer"
      : form.type === "Lease — Tenant" ? "Tenant"
      : form.type === "Lease — Landlord" ? "Landlord"
      : "Seller";
    const initialParties = (form.clientName || form.clientEmail) ? [{
      role: clientRole,
      name: (form.clientName || "").trim(),
      email: (form.clientEmail || "").trim(),
      phone: (form.clientPhone || "").trim(),
      company: "",
    }] : [];
    const tok = localStorage.getItem("tp_token") || "";
    try {
      const res = await fetch(API + "/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
        body: JSON.stringify({ ...form, parties: initialParties, tasks, reminders: [], smsThreads: {} }),
      });
      const data = await res.json();
      if (data.success && data.transaction) {
        const t = data.transaction;
        // If this transaction was started from a saved standalone CMA, record the
        // link so that CMA isn't offered for conversion again.
        if (cmaId) {
          fetch(API + "/cmas/" + cmaId + "/link-transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
            body: JSON.stringify({ transactionId: t.id }),
          }).catch(e => console.error("[bg]", e && e.message ? e.message : e));
        }
        onSave({
          id: t.id, address: t.address, city: t.city, state: t.state,
          zipCode: t.zip_code || form.zipCode, county: t.county || form.county,
          mlsNumber: t.mls_number || form.mlsNumber, propertyType: t.property_type || form.propertyType, constructionType: t.construction_type || form.constructionType || "Resale",
          type: t.transaction_type || form.type, status: t.status || form.status,
          listPrice: t.list_price || form.listPrice, contractPrice: t.contract_price || form.contractPrice,
          openDate: t.open_date || form.openDate, closingDate: t.closing_date || form.closingDate,
          executedDate: t.executed_date || form.executedDate,
          representationExpiresOn: t.representation_expires_on || form.representationExpiresOn,
          notes: t.notes || form.notes,
          assignedAgentId: t.assigned_agent || form.assignedAgent,
          referralSource: t.referral_source || form.referralSource,
          occupancyStatus: t.occupancy_status || form.occupancyStatus,
          // These two were missing here — Edit opened blank on a freshly
          // created deal until a full reload (Carlos 7/20, lease deal).
          yearBuilt: t.year_built || form.yearBuilt || "",
          inHoa: t.in_hoa === true ? "yes" : t.in_hoa === false ? "no" : (form.inHoa || ""),
          propertyAccess: t.property_access || form.propertyAccess,
          commissionListing: t.commission_listing || form.commissionListing,
          commissionBuyer: t.commission_buyer || form.commissionBuyer,
          transactionFee: t.transaction_fee || form.transactionFee,
          brokerageSplit: t.brokerage_split || form.brokerageSplit,
          officeFlatFee: t.office_flat_fee || form.officeFlatFee,
          commissionNotes: t.commission_notes || form.commissionNotes,
          smsThreads: {}, parties: initialParties, tasks, messages: [], reminders: [],
        });
      } else {
        alert("Failed to save transaction: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error("Save error:", e);
      alert("Could not save transaction. Check your connection.");
    }
  };
  // ── 3-STEP WIZARD (rookie-first). Step gating replaces alert()-validation:
  // Next stays disabled until the step is complete, with a plain hint why.
  const yearOk = () => { const n = parseInt(form.yearBuilt, 10); return Number.isFinite(n) && n >= 1800 && n <= 2100; };
  const step1Ok = form.address.trim() && form.city.trim() && (!isListingSide || (yearOk() && form.inHoa && form.occupancyStatus));
  const step3Ok = !!form.referralSource && !!form.assignedAgent;
  const SOURCES = ["Referral", "Past client / Sphere", "Sign call", "Online (Zillow, etc.)", "Open house", "Social media", "Other"];
  const inputBig = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 16, fontFamily: "inherit", boxSizing: "border-box" };
  const chip = (on) => ({ padding: "10px 16px", borderRadius: 20, border: on ? "2px solid #0F2044" : "1px solid #d1d5db", background: on ? "#0F2044" : "#fff", color: on ? "#fff" : "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
  const lblW = { fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" };
  const [moreTypes, setMoreTypes] = useState(false);
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh" }}>
      <div style={{ background: COLORS.navy, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 22, opacity: 0.7 }}>←</button>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>➕ New Deal</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 }}>Three quick steps — about a minute. You can add details later.</div>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 60px" }}>
        {onImportContract && step === 1 && (
          <div onClick={onImportContract} style={{ marginBottom: 14, background: "#EFF6FF", border: "1.5px dashed #3B82F6", borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>📥</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#1E40AF" }}>Already have a signed contract? Import it instead</div>
              <div style={{ fontSize: 12.5, color: "#1E3A8A" }}>Upload it — AI reads it and builds the whole deal for you.</div>
            </div>
          </div>
        )}

        {/* Progress: Step X of 3 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          {[["1", "Property"], ["2", "Client"], ["3", "Price"]].map(([n, label], i) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < 2 ? "0 0 auto" : "0 0 auto" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: step > i ? "#0F2044" : "#E5E7EB", color: step > i ? "#fff" : "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>{n}</div>
              <span style={{ fontSize: 13, fontWeight: 700, color: step > i ? "#0F2044" : "#9CA3AF" }}>{label}</span>
              {i < 2 && <div style={{ width: 28, height: 2, background: step > i + 1 ? "#0F2044" : "#E5E7EB" }} />}
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 2px 12px rgba(15,32,68,0.08)" }}>
          {step === 1 && (
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#0F2044", marginBottom: 14 }}>What kind of deal is this?</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }} data-keep-grid="">
                <button type="button" onClick={() => f("type")("Listing (Seller)")}
                  style={{ padding: "16px 12px", borderRadius: 12, border: /^listing/i.test(form.type) ? "2.5px solid #0F2044" : "1px solid #d1d5db", background: /^listing/i.test(form.type) ? "#F0F4FA" : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                  <div style={{ fontSize: 26 }}>🏠</div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "#0F2044", marginTop: 4 }}>I'm SELLING it</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>A listing — I represent the seller</div>
                </button>
                <button type="button" onClick={() => f("type")("Buyer Representation")}
                  style={{ padding: "16px 12px", borderRadius: 12, border: /^buyer/i.test(form.type) ? "2.5px solid #0F2044" : "1px solid #d1d5db", background: /^buyer/i.test(form.type) ? "#F0F4FA" : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                  <div style={{ fontSize: 26 }}>🏡</div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "#0F2044", marginTop: 4 }}>I'm helping someone BUY</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>I represent the buyer</div>
                </button>
                <button type="button" onClick={() => f("type")("Lease — Landlord")}
                  style={{ padding: "16px 12px", borderRadius: 12, border: form.type === "Lease — Landlord" ? "2.5px solid #6D28D9" : "1px solid #d1d5db", background: form.type === "Lease — Landlord" ? "#EDE9FE" : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                  <div style={{ fontSize: 26 }}>🔑</div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "#0F2044", marginTop: 4 }}>I'm LEASING it out</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>A rental listing — I represent the owner</div>
                </button>
                <button type="button" onClick={() => f("type")("Lease — Tenant")}
                  style={{ padding: "16px 12px", borderRadius: 12, border: form.type === "Lease — Tenant" ? "2.5px solid #6D28D9" : "1px solid #d1d5db", background: form.type === "Lease — Tenant" ? "#EDE9FE" : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                  <div style={{ fontSize: 26 }}>🧳</div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "#0F2044", marginTop: 4 }}>Helping someone RENT</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>I represent the tenant</div>
                </button>
              </div>
              <button type="button" onClick={() => setMoreTypes(m => !m)} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 12 }}>
                {moreTypes ? "▴ Hide other types" : "▾ It's dual agency"}
              </button>
              {moreTypes && (
                <select value={form.type} onChange={e => f("type")(e.target.value)} style={{ ...inputBig, marginBottom: 12 }}>
                  {["Listing (Seller)", "Buyer Representation", "Dual Agency", "Lease — Landlord", "Lease — Tenant"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {/* Commercial + land get their own timelines and doc sets — one tap here
                  routes the deal onto the right track (detected via propertyType). */}
              {!/lease/i.test(form.type) && (
                <div style={{ marginBottom: 12 }}>
                  <label style={lblW}>What kind of property?</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => f("propertyType")("Single Family")} style={chip(!/commercial|land/i.test(form.propertyType || ""))}>🏠 Residential</button>
                    <button type="button" onClick={() => f("propertyType")("Commercial")} style={chip(/commercial/i.test(form.propertyType || ""))}>🏢 Commercial</button>
                    <button type="button" onClick={() => f("propertyType")("Vacant Land")} style={chip(/land/i.test(form.propertyType || ""))}>🟩 Vacant Land</button>
                  </div>
                </div>
              )}

              <label style={lblW}>{isListingSide ? "Property address *" : "Address (or the area they're searching) *"}</label>
              <input value={form.address} onChange={e => f("address")(e.target.value)} placeholder={isListingSide ? "123 Main St" : "e.g. Lake Nona area, or an address"} style={{ ...inputBig, marginBottom: 12 }} />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 12 }} data-keep-grid="">
                <div>
                  <label style={lblW}>City *</label>
                  <input value={form.city} onChange={e => f("city")(e.target.value)} placeholder="Orlando" style={inputBig} />
                </div>
                <div>
                  <label style={lblW}>ZIP</label>
                  <input value={form.zipCode} onChange={e => f("zipCode")(e.target.value)} style={inputBig} />
                </div>
              </div>

              {isListingSide && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }} data-keep-grid="">
                    <div>
                      <label style={lblW}>Year built *</label>
                      <input value={form.yearBuilt || ""} onChange={e => f("yearBuilt")(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 1998" style={inputBig} />
                      <div style={{ fontSize: 11.5, color: "#6B7280", marginTop: 3 }}>Decides which disclosures you need (lead paint = before 1978).</div>
                    </div>
                    <div>
                      <label style={lblW}>HOA or condo association? *</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => f("inHoa")("yes")} style={chip(form.inHoa === "yes")}>Yes</button>
                        <button type="button" onClick={() => f("inHoa")("no")} style={chip(form.inHoa === "no")}>No</button>
                      </div>
                    </div>
                  </div>
                  <label style={lblW}>Who lives there right now? *</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    {[["Owner Occupied", "🏠 The owner"], ["Tenant Occupied", "👥 A tenant"], ["Vacant", "📭 Nobody — vacant"]].map(([v, label]) => (
                      <button key={v} type="button" onClick={() => f("occupancyStatus")(v)} style={chip(form.occupancyStatus === v)}>{label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#0F2044", marginBottom: 4 }}>Who is your client?</div>
              <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>Optional — you can add or change this later under the deal's People. Adding an email now lets the app send them updates automatically.</div>
              <label style={lblW}>📇 Pick from your Contacts</label>
              <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Start typing a name, email or phone…" style={{ ...inputBig, marginBottom: contactHits.length ? 4 : 12 }} />
              {contactHits.length > 0 && (
                <div style={{ border: "1px solid #d1d5db", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
                  {contactHits.map(c => {
                    const nm = [c.first_name, c.last_name].filter(Boolean).join(" ");
                    return (
                      <button key={c.id} type="button"
                        onClick={() => { setForm(v => ({ ...v, clientName: nm, clientEmail: c.email || "", clientPhone: c.phone || "" })); setContactSearch(""); setContactHits([]); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "#fff", border: "none", borderBottom: "1px solid #F3F4F6", cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#0F2044" }}>{nm || c.email || c.phone}</span>
                        <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 8 }}>{[c.email, c.phone].filter(Boolean).join(" · ")}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <label style={lblW}>{/buyer|tenant/i.test(form.type) ? "Buyer's name" : "Seller's name"}</label>
              <input value={form.clientName} onChange={e => f("clientName")(e.target.value)} placeholder="First and last name" style={{ ...inputBig, marginBottom: 12 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} data-keep-grid="">
                <div>
                  <label style={lblW}>Phone</label>
                  <input value={form.clientPhone} onChange={e => f("clientPhone")(e.target.value)} placeholder="(407) 555-0100" style={inputBig} />
                </div>
                <div>
                  <label style={lblW}>Email</label>
                  <input value={form.clientEmail} onChange={e => f("clientEmail")(e.target.value)} placeholder="name@email.com" style={inputBig} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#0F2044", marginBottom: 14 }}>{/lease/i.test(form.type) ? "Rent & source" : "Price & source"}</div>
              <label style={lblW}>{/lease/i.test(form.type) ? "Monthly rent ($)" : (isListingSide ? "List price ($)" : "Their budget — top end ($)")}</label>
              <input value={form.listPrice} onChange={e => f("listPrice")(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={isListingSide ? "e.g. 450000" : "e.g. 400000"} style={{ ...inputBig, marginBottom: 4 }} />
              <div style={{ fontSize: 11.5, color: "#6B7280", marginBottom: 14 }}>A rough number is fine — you can change it anytime.</div>
              {isListingSide && !/lease/i.test(form.type) && (
                <div style={{ marginBottom: 14 }}>
                  <label style={lblW}>Listing agreement expires (optional)</label>
                  <input type="date" value={form.representationExpiresOn} onChange={e => f("representationExpiresOn")(e.target.value)} style={inputBig} />
                  <div style={{ fontSize: 11.5, color: "#6B7280", marginTop: 3 }}>The app will remind you before it runs out.</div>
                </div>
              )}
              <label style={lblW}>Where did this client come from? *</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {SOURCES.map(src => (
                  <button key={src} type="button" onClick={() => f("referralSource")(src)} style={chip(form.referralSource === src)}>{src}</button>
                ))}
              </div>
              {teamAgents.length > 1 && (
                <div style={{ marginBottom: 4 }}>
                  <label style={lblW}>Whose deal is this?</label>
                  <select value={form.assignedAgent} onChange={e => f("assignedAgent")(e.target.value)} style={inputBig}>
                    <option value="">— pick an agent —</option>
                    {teamAgents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Footer: Back / Next / Create */}
          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            {step > 1 && (
              <button type="button" onClick={() => setStep(v => v - 1)} style={{ flex: 1, padding: "13px 0", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
            )}
            {step < 3 && (
              <button type="button" disabled={step === 1 && !step1Ok} onClick={() => setStep(v => v + 1)}
                style={{ flex: 2, padding: "13px 0", borderRadius: 10, border: "none", background: (step === 1 && !step1Ok) ? "#9CA3AF" : "#0F2044", color: "#fff", fontWeight: 800, fontSize: 15, cursor: (step === 1 && !step1Ok) ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                Next →
              </button>
            )}
            {step === 3 && (
              <button type="button" disabled={!step3Ok} onClick={handleSave}
                style={{ flex: 2, padding: "13px 0", borderRadius: 10, border: "none", background: !step3Ok ? "#9CA3AF" : "#1E8449", color: "#fff", fontWeight: 800, fontSize: 15, cursor: !step3Ok ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                ✓ Create Deal
              </button>
            )}
          </div>
          {step === 1 && !step1Ok && (
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8, textAlign: "center" }}>
              {!form.address.trim() || !form.city.trim() ? "Enter the address and city to continue." : "Answer year built, HOA, and who lives there — they decide which disclosures this listing needs."}
            </div>
          )}
          {step === 3 && !step3Ok && (
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8, textAlign: "center" }}>Pick where this client came from{teamAgents.length > 1 ? " and whose deal it is" : ""} to finish.</div>
          )}
          {step === 3 && (
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 12, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: 10 }}>
              ✅ When you tap Create, the app builds the deal's timeline, checklist, and reminders for you. Commission details, MLS number, and everything else can be added later from the deal.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

// ── TOOLS MENU — everything that isn't daily-critical lives one tap away.
// Keeps the header at five buttons so a brand-new agent is never overwhelmed.
function ToolsMenu({ coordinatorMode, onOpenPopBys, onOpenScripts, onOpenCMA, onOpenGrowthPlan, onOpenExpenses, onVendors, onCalendar, onIntakeLinks, onAddTask, onTcTeam, onTcServices }) {
  const [open, setOpen] = useState(false);
  const items = coordinatorMode ? [
    ["💵", "My Money", onOpenExpenses],
    ["👥", "Team", onTcTeam],
    ["💼", "My Services", onTcServices],
    ["📅", "Calendar", onCalendar],
    ["📝", "Add a Task", onAddTask],
  ] : [
    ["💵", "My Money", onOpenExpenses],
    ["📊", "Price a Home (CMA)", onOpenCMA],
    ["🔗", "Buyer/Seller Intake Links", onIntakeLinks],
    ["🎁", "Pop-Bys", onOpenPopBys],
    ["📜", "Scripts", onOpenScripts],
    ["🎯", "Growth Plan", onOpenGrowthPlan],
    ["🤝", "Vendors", onVendors],
    ["📅", "Calendar", onCalendar],
    ["📝", "Add a Task", onAddTask],
  ];
  return (
    <div style={{ position: "relative" }} data-tour="tools">
      <button onClick={() => setOpen(!open)} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
        🧰 Tools {open ? "▴" : "▾"}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
          <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "white", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 201, minWidth: 230, padding: 4 }}>
            {items.filter(it => it[2]).map(([icon, label, fn], i) => (
              <button key={i} onClick={() => { setOpen(false); fn(); }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "none", border: "none", borderRadius: 4, fontSize: 13, color: "#1f2937", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── APP HEADER — the one navigation bar (home + pipeline). Five buttons, always
// the same: Today, My Deals, New Deal, Contacts, Tools (+ the gear menu). The
// logo and 🏠 both go home, so a new agent is never lost.
function AppHeader(props) {
  const { view, coordinatorMode, currentUser, isFreeGuest, onHome, onDeals, onNew, onOpenContacts, onLogout } = props;
  const [brand, setBrand] = useState({ name: "", logoUrl: "" });
  useEffect(() => {
    if (isFreeGuest) return;
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/settings/company", { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.company) setBrand({ name: d.company.name || "", logoUrl: d.company.logoUrl || "" }); })
      .catch(() => {});
  }, [isFreeGuest]);
  const btn = (active) => ({ background: active ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" });
  return (
    <div style={{ background: COLORS.navy, padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
      <div onClick={onHome} title="Back to Win The Day" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, cursor: "pointer" }}>
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name || "Logo"} style={{ height: 40, maxWidth: 140, objectFit: "contain", background: "#fff", borderRadius: 6, padding: 4 }} onError={e => { e.target.style.display = "none"; }} />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 8, background: COLORS.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>T</span>
          </div>
        )}
        <div>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>{brand.name || "TransactPro"}</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{brand.name ? "Powered by TransactPro" : "Real Estate Transaction Management"}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button data-tour="home" onClick={onHome} style={btn(view === "home")} title="Your daily list — what needs attention today">🏆 Win The Day</button>
        <button data-tour="deals" onClick={onDeals} style={btn(view === "dashboard")} title="All your listings and buyers">📋 My Deals</button>
        {!coordinatorMode && <button data-tour="new" onClick={onNew} style={{ ...btn(false), background: "#C0392B", border: "none" }}>➕ New Deal</button>}
        <button data-tour="contacts" onClick={onOpenContacts} style={btn(false)}>📇 Contacts</button>
        <ToolsMenu
          coordinatorMode={coordinatorMode}
          onOpenPopBys={props.onOpenPopBys} onOpenScripts={props.onOpenScripts} onOpenCMA={props.onOpenCMA}
          onOpenGrowthPlan={props.onOpenGrowthPlan} onOpenExpenses={props.onOpenExpenses} onVendors={props.onVendors}
          onCalendar={props.onCalendar} onIntakeLinks={props.onIntakeLinks} onAddTask={props.onAddTask}
          onTcTeam={props.onTcTeam} onTcServices={props.onTcServices}
        />
        <SettingsMenu
          currentUser={currentUser}
          onOpenContactBook={props.onOpenContactBook}
          contactCount={props.contactCount}
          onReports={props.onReports}
          onGoalPlanner={props.onGoalPlanner}
          onAgentProfile={props.onAgentProfile}
          onOpenComplianceDash={props.onOpenComplianceDash}
          onOpenCompliance={props.onOpenCompliance}
          onOpenTaskTmpls={props.onOpenTaskTmpls}
          onCompanySettings={props.onCompanySettings}
          onOpenSuperuser={props.onSuperuser}
          onOpenForms={props.onOpenForms}
          onChangePassword={props.onChangePassword}
          onOpenTeam={props.onOpenTeam}
          onHelp={props.onHelp}
          onFeedback={props.onFeedback}
          onSupport={props.onSupport}
          onLogout={onLogout}
        />
        <TenantSwitcher currentUser={currentUser} />
      </div>
    </div>
  );
}

function SettingsMenu({ currentUser, onOpenContactBook, contactCount, onReports, onGoalPlanner, onAgentProfile, onOpenComplianceDash, onOpenCompliance, onOpenTaskTmpls, onCompanySettings, onChangePassword, onOpenForms, onOpenTeam, onOpenSuperuser, onHelp, onFeedback, onSupport, onLogout }) {
  const [open, setOpen] = useState(false);
  const isAdmin = ["admin", "superadmin"].includes(currentUser?.role);
  const items = [];

  if (onHelp) items.push({ icon: "❓", label: "Help & Guides", onClick: onHelp });
  if (onFeedback) items.push({ icon: "📣", label: "Send Feedback", onClick: onFeedback });
  if (onSupport) items.push({ icon: "✉️", label: "Contact Support", onClick: onSupport });
  // Public marketing/pricing pages live on the website, not in the app — link them
  // so they're reachable (testers couldn't find them). Relative path: Netlify serves
  // the static file directly, on whatever domain the user is on.
  items.push({ icon: "🌐", label: "Features & Pricing (web)", onClick: () => window.open("/features.html", "_blank", "noopener") });
  items.push({ icon: "📒", label: `Address Book${contactCount > 0 ? ` (${contactCount})` : ""}`, onClick: onOpenContactBook });
  items.push({ icon: "📈", label: "Reports", onClick: onReports });
  if (onGoalPlanner) items.push({ icon: "🎯", label: "Goal Planner", onClick: onGoalPlanner });
  items.push({ icon: "👤", label: "My Profile", onClick: onAgentProfile });
  if (onOpenForms) items.push({ icon: "📄", label: "Forms Library", onClick: onOpenForms });
  items.push({ icon: "🔒", label: "Change Password", onClick: onChangePassword });
  if (isAdmin) {
    items.push({ divider: true });
    if (onOpenTeam) items.push({ icon: "👥", label: "Team Members / Invite", onClick: onOpenTeam });
    items.push({ icon: "🛡️", label: "Compliance Dashboard", onClick: onOpenComplianceDash });
    items.push({ icon: "⚖️", label: "Doc Requirements", onClick: onOpenCompliance });
    items.push({ icon: "📝", label: "Task Templates", onClick: onOpenTaskTmpls });
    items.push({ icon: "⚙️", label: "Company Settings", onClick: onCompanySettings });
  }
  if ((currentUser?.email || "").toLowerCase() === SUPERUSER_EMAIL && onOpenSuperuser) {
    items.push({ divider: true });
    items.push({ icon: "👑", label: "Superuser Dashboard", onClick: onOpenSuperuser });
  }
  if (onLogout) {
    items.push({ divider: true });
    items.push({ icon: "🚪", label: "Sign Out", onClick: onLogout });
  }

  return (
    <div style={{ position: "relative" }} data-tour="menu">
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

// Compact at-a-glance sales-stats strip for the dashboard. Pulls the same
// numbers as Reports → Sales Stats; clicking it opens the full report.
function DashboardSalesStrip({ onOpen }) {
  const [stats, setStats] = useState(null);
  const [rate, setRate] = useState(null);
  useEffect(() => {
    const auth = { Authorization: "Bearer " + (localStorage.getItem("tp_token") || "") };
    fetch(API + "/reports/sales-stats", { headers: auth })
      .then(r => r.ok ? r.json() : null).then(d => setStats(d && d.success ? d.stats : null)).catch(() => {});
    fetch(API + "/market/mortgage-rate", { headers: auth })
      .then(r => r.ok ? r.json() : null).then(d => { if (d && d.success && d.configured && (d.monthlyAvg != null || d.rate != null)) setRate(d); }).catch(() => {});
  }, []);
  if (!stats) return null;
  const m = (n) => n == null ? "—" : (n >= 1000000 ? `$${(n/1000000).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`);
  const items = [
    { label: "Active Listings", value: stats.activeListings ?? 0 },
    { label: "Active Buyers", value: stats.activeBuyers ?? 0 },
    { label: "Avg Sale Price", value: m(stats.avgSalePrice), sub: "12mo" },
    { label: "Sale-to-List", value: stats.saleToListPct == null ? "—" : `${Number(stats.saleToListPct).toFixed(0)}%`, sub: "12mo" },
    { label: "Avg Days to Close", value: stats.avgDaysToClose == null ? "—" : `${stats.avgDaysToClose}d`, sub: "12mo" },
    { label: "Avg Commission", value: m(stats.avgCommissionGross), sub: "12mo" },
  ];
  return (
    <div onClick={onOpen} title="Open full Sales Stats report" style={{ background: "#EEF2F7", borderBottom: `1px solid ${COLORS.border}`, padding: "12px 24px", display: "flex", gap: 22, alignItems: "center", flexWrap: "nowrap", overflowX: "auto", cursor: onOpen ? "pointer" : "default" }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>📊 My Stats</span>
      {items.map(it => (
        <div key={it.label} style={{ flexShrink: 0, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.navy, lineHeight: 1 }}>{it.value}</div>
          <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2, whiteSpace: "nowrap" }}>{it.label}{it.sub ? ` · ${it.sub}` : ""}</div>
        </div>
      ))}
      {rate && (
        <div style={{ flexShrink: 0, textAlign: "center", marginLeft: "auto", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 14px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1A5276", lineHeight: 1 }}>{(rate.monthlyAvg ?? rate.rate).toFixed(2)}%</div>
          <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2, whiteSpace: "nowrap" }}>📈 30-yr rate{rate.monthLabel ? ` · ${rate.monthLabel} avg` : ""}</div>
        </div>
      )}
    </div>
  );
}

function Dashboard({ transactions, coordinatorMode = false, unreadCounts = {}, onSelect, onNew, onOpenContactBook, onOpenContacts, onOpenPopBys, onOpenScripts, onOpenCMA, onOpenGrowthPlan, onOpenExpenses, onOpenForms, contactCount, onLogout, onOpenTeam, onOpenCompliance, onOpenComplianceDash, onOpenTaskTmpls, onOpenContractIntake, onChangePassword, onReports, onGoalPlanner, onHome, onVendors, onCalendar, onCompanySettings, onSuperuser, onAgentProfile, onIntakeLinks, onViewTransactions, onHelp, onFeedback, onSupport, currentUser, isFreeGuest = false }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showTcTeam, setShowTcTeam] = useState(false);
  const [showTcServices, setShowTcServices] = useState(false);
  // Tenant branding for the navbar — fetched once on mount. A free guest belongs to
  // no single brokerage (they may be on deals from many), so they get NEUTRAL platform
  // branding here; each brokerage's identity shows on its own transaction card instead.
  const [tenantBrand, setTenantBrand] = useState({ name: "", logoUrl: "" });
  useEffect(() => {
    if (isFreeGuest) return;  // keep neutral TransactPro branding for guests
    const tok = localStorage.getItem("tp_token") || "";
    fetch("https://liz-team-server-api-production.up.railway.app/settings/company", { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.company) setTenantBrand({ name: d.company.name || "", logoUrl: d.company.logoUrl || "" }); })
      .catch(e => console.error("[bg]", e && e.message ? e.message : e));
  }, [isFreeGuest]);
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
  // Agent oversight: "" all, "yes" run by a coordinator, "no" handled by me alone.
  const [coordFilter, setCoordFilter] = useState("");
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
      .catch(e => console.error("[bg]", e && e.message ? e.message : e));
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
    if (coordFilter) params.set("coordinated", coordFilter);
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
  }, [debouncedSearch, filter, sortKey, sortDir, agentFilter, propTypeFilter, txTypeFilter, closingFrom, closingTo, coordFilter]);

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
      .catch(e => console.error("[bg]", e && e.message ? e.message : e))
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
      .catch(e => console.error("[bg]", e && e.message ? e.message : e));
  }, [transactions.length]);

  // Hydrate snake_case server fields into camelCase the UI expects
  // ─── Saved Views ───
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/saved-views", { headers: { "Authorization": "Bearer " + tok } })
      .then(r => r.json())
      .then(d => { if (d.views) setSavedViews(d.views); })
      .catch(e => console.error("[bg]", e && e.message ? e.message : e));
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

  // Confirm / cancel a lead straight from the card. Optimistically flips the
  // raw paged row so the badge clears without a full refetch.
  const onLeadAction = async (txId, kind) => {
    const tok = localStorage.getItem("tp_token") || "";
    try {
      let res;
      if (kind === "cancel") {
        if (!window.confirm("Mark this lead as Not Pursuing? It will be set to Cancelled and removed from your active list.")) return;
        res = await fetch(`${API}/transactions/${txId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok }, body: JSON.stringify({ status: "Cancelled" }) });
      } else {
        res = await fetch(`${API}/transactions/${txId}/confirm-lead`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok } });
      }
      if (!res.ok) throw new Error("Failed");
      setPagedTxs(prev => prev.map(r => r.id === txId ? { ...r, lead_converted: true, ...(kind === "cancel" ? { status: "Cancelled" } : {}) } : r));
    } catch { alert("Could not update — please try again."); }
  };

  const hydratedPagedTxs = [...pagedTxs].sort((a, b) => {
    // Tier 1: New buyer/seller inquiries that still need first contact
    // (from the public intake forms) — always pinned at the top.
    if (a.needs_first_contact !== b.needs_first_contact) {
      return a.needs_first_contact ? -1 : 1;
    }
    // Tier 2: Everything else by closing date, soonest first.
    // Transactions without a closing date sink to the bottom.
    const aClose = a.closing_date ? new Date(a.closing_date).getTime() : Infinity;
    const bClose = b.closing_date ? new Date(b.closing_date).getTime() : Infinity;
    return aClose - bClose;
  }).map(t => ({
    id: t.id,
    address: t.address,
    city: t.city,
    state: t.state,
    zipCode: t.zip_code,
    county: t.county,
    mlsNumber: t.mls_number,
    propertyType: t.property_type,
    constructionType: t.construction_type || "Resale",
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
    parties: (t.parties || []).filter(Boolean).map(p => ({ id: p.id, role: p.role, name: p.name, email: p.email, phone: p.phone, company: p.company, isVendor: p.isVendor || false, vendorStatus: p.vendorStatus || null, vendorCategory: p.vendorCategory || null, vendorDescription: p.vendorDescription || null, lastLoginAt: p.lastLoginAt || null })),
    tasks: (t.tasks || []).filter(Boolean).map(tk => ({ id: tk.id, name: tk.name, status: tk.status, dueDate: tk.dueDate, category: tk.category, assignTo: tk.assignTo })),
    milestoneSummary: t.milestone_summary || null,
    nextMilestone: t.next_milestone || null,
    coordinatorName: t.coordinator_name || null,
    isGuestView: t.is_guest_view || false,
    guestSide: t.guest_side || null,
    reminders: (t.reminders || []).filter(Boolean),
    smsThreads: t.sms_threads || {},
    needsFirstContact: t.needs_first_contact || false,
    submittedVia: t.submitted_via || null,
    leadConverted: t.lead_converted !== false,
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
    yearBuilt: t.year_built || "",
    floodZone: t.flood_zone || "",
    sellerIsForeign: t.seller_is_foreign || false,
    isCoastal: t.is_coastal || false,
    inHoa: t.in_hoa === true ? "yes" : t.in_hoa === false ? "no" : "",
    hoaFeeMonthly: t.hoa_fee_monthly || "",
    financingType: t.financing_type || "",
    sellerPaysBuyerBroker: t.seller_pays_buyer_broker || false,
    isShortSale: t.is_short_sale || false,
    hasSellerFinancing: t.has_seller_financing || false,
    sellerPostClosingOccupancy: t.seller_post_closing_occupancy || false,
    representationExpiresOn: t.representation_expires_on ? String(t.representation_expires_on).slice(0, 10) : "",
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
    // Status priority sort with two pinned tiers above the status ranking:
    //   Tier 1: New buyer/seller inquiries that still need first contact —
    //           Florida-law urgency, always pin to top of the list.
    //   Tier 2: Transactions closing within the next 14 days — show next
    //           so the agent sees what's about to close right under leads.
    //   Tier 3: Everything else ranked by status priority (Active first,
    //           Closed near the bottom).
    if (sortKey === "status") {
      // Tier 1 — always pinned to top regardless of sort direction.
      // New inquiries from the public intake forms need first contact
      // within 24 hrs (Florida law), so they outrank everything else.
      if (a.needsFirstContact !== b.needsFirstContact) {
        return a.needsFirstContact ? -1 : 1;
      }

      // Tier 2 — also always pinned regardless of sort direction.
      // Transactions closing within 14 days, soonest first.
      const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
      const aClose = a.closingDate ? new Date(a.closingDate).getTime() : null;
      const bClose = b.closingDate ? new Date(b.closingDate).getTime() : null;
      const aDays = aClose != null ? Math.round((aClose - todayMs) / 86400000) : Infinity;
      const bDays = bClose != null ? Math.round((bClose - todayMs) / 86400000) : Infinity;
      const aSoon = aDays >= 0 && aDays <= 14;
      const bSoon = bDays >= 0 && bDays <= 14;
      if (aSoon !== bSoon) return aSoon ? -1 : 1;
      if (aSoon && bSoon) return aDays - bDays;

      // Tier 3 — status priority. Respects sortDir so the user can
      // still flip the underlying ordering with the asc/desc toggle.
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
        av = a.milestoneSummary && a.milestoneSummary.total ? (a.milestoneSummary.done || 0) / a.milestoneSummary.total : 0;
        bv = b.milestoneSummary && b.milestoneSummary.total ? (b.milestoneSummary.done || 0) / b.milestoneSummary.total : 0;
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
    // "Active Listings" = FOR-SALE listings still on the market — not buyer
    // searches, not rentals, not under contract (those have their own tiles).
    active: transactions.filter(t => t.status === "Active" && /listing|seller|dual/i.test(t.type || "") && !/lease/i.test(t.type || "")).length,
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
    totalVolume: transactions.filter(t => t.status !== "Cancelled" && !/lease|rental/i.test(t.type || t.transactionType || t.transaction_type || "")).reduce((a, t) => a + (Number(t.contractPrice) || Number(t.listPrice) || 0), 0),
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
        {/* Header lives in AppHeader now (one nav bar for the whole app). */}
        <div style={{ height: 12 }} />
        <div data-stats-bar="" style={{ display: "flex", marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {(() => { const s = dashStats || stats; const clearAdv = () => { setAgentFilter(""); setPropTypeFilter(""); setTxTypeFilter(""); setDatePreset(""); }; return [["Active Listings", s.active, COLORS.gold, () => { setViewMode("cards"); setFilter("Active"); setClosingFrom(""); setClosingTo(""); clearAdv(); }], ["Under Contract", s.underContract, "#93C5FD", () => { setViewMode("cards"); setFilter("Under Contract"); setClosingFrom(""); setClosingTo(""); clearAdv(); }], ["Closing This Month", s.closingSoon, s.closingSoon > 0 ? "#FDE68A" : "rgba(255,255,255,0.4)", () => { const t = new Date(); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0); setViewMode("cards"); setFilter("All"); clearAdv(); setClosingFrom(t.toISOString().split("T")[0]); setClosingTo(last.toISOString().split("T")[0]); }], ["Closed", s.closed, "#6EE7B7", () => { setViewMode("cards"); setFilter("Closed"); setClosingFrom(""); setClosingTo(""); clearAdv(); }], ...(coordinatorMode ? [] : [["Volume", `$${((s.totalVolume || 0) / 1000000).toFixed(2)}M`, COLORS.gold, null], ["Pending Commission", `$${Math.round(s.pendingCommissionGross || 0).toLocaleString()}`, "#FDBA74", null], ["Under Contract Commission", `$${Math.round(s.underContractCommissionGross || 0).toLocaleString()}`, "#93C5FD", null], ["Closed Commission", s.totalCommission > 0 ? `$${Math.round(s.totalCommission).toLocaleString()}` : "$0", "#6EE7B7", null]])]; })().map(([label, value, color, onClick]) => (
            <div key={label} onClick={onClick} style={{ padding: "12px 20px", flex: 1, cursor: onClick ? "pointer" : "default" }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}{onClick && " ↗"}</div>
              <div style={{ color, fontSize: 22, fontWeight: 800, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      {showSaveViewModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }} onClick={() => !saveViewLoading && setShowSaveViewModal(false)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", margin: "auto" }} onClick={e => e.stopPropagation()}>
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
      {!isFreeGuest && !coordinatorMode && <DashboardSalesStrip onOpen={onReports} />}
      <div data-toolbar="" style={{ background: "#fff", borderBottom: `1px solid ${COLORS.border}`, padding: "12px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search address, city, MLS #..." style={{ flex: 1, maxWidth: 340, padding: "8px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit" }} />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
            background: "#fff", color: "#111", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", minWidth: 160 }}>
          <option value="All">📂 Read All (default)</option>
          <option value="Leads">🌱 New Leads & Inquiries</option>
          <option value="Active">🏷️ Active Listings Only</option>
          <option value="Under Contract">📝 Under Contract Only</option>
          <option value="Closed">✅ Closed Only</option>
          <option value="On Hold">⏸️ On Hold</option>
          <option value="Cancelled">❌ Cancelled</option>
        </select>
        {!coordinatorMode && (
          <select value={coordFilter} onChange={e => setCoordFilter(e.target.value)}
            title="Who's handling these deals"
            style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
              background: "#fff", color: "#111", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", minWidth: 170 }}>
            <option value="">👥 Anyone handling</option>
            <option value="yes">🧭 With my coordinator</option>
            <option value="no">🙋 Just mine</option>
          </select>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, position: "relative" }}>
          <button onClick={() => setShowViewsMenu(v => !v)} title="Layout & saved views" style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.text, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>🗂 Views {savedViews.length > 0 && <span style={{ background: COLORS.bg, color: COLORS.muted, borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{savedViews.length}</span>} <span style={{ fontSize: 9 }}>▾</span></button>
          {showViewsMenu && (
            <>
              <div onClick={() => setShowViewsMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", minWidth: 280, maxWidth: 360, zIndex: 101, maxHeight: 400, overflowY: "auto" }}>
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`, fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Layout</div>
                {[["cards", "▦ Cards"], ["list", "☰ List"], ["kanban", "⋮⋮ Pipeline"]].map(([mode, label]) => (
                  <div key={mode} onClick={() => { setViewMode(mode); setShowViewsMenu(false); }} style={{ padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: viewMode === mode ? COLORS.navy : COLORS.text, background: viewMode === mode ? COLORS.bg : "#fff" }}
                    onMouseEnter={e => e.currentTarget.style.background = COLORS.bg}
                    onMouseLeave={e => e.currentTarget.style.background = viewMode === mode ? COLORS.bg : "#fff"}>
                    <span style={{ flex: 1 }}>{label}</span>
                    {viewMode === mode && <span style={{ color: COLORS.navy, fontSize: 14 }}>✓</span>}
                  </div>
                ))}
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
        <TransactionListView transactions={hydratedPagedTxs} sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} onSelect={onSelect} onLeadAction={onLeadAction} />
      ) : viewMode === "kanban" ? (
        <PipelineBoard transactions={transactions.filter(t => t.status !== "Cancelled")} onSelect={onSelect} />
      ) : (
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }} data-tx-grid="">
        {hydratedPagedTxs.map(tx => {
          // Progress = Auto-TC timeline (milestones), not the legacy tasks table.
          const ms = tx.milestoneSummary;
          const completed = ms ? (ms.done || 0) : 0;
          const total = ms ? (ms.total || 0) : 0;
          const overdue = ms ? (ms.overdue || 0) : 0;
          const dtc = daysUntil(tx.closingDate);
          const progress = total > 0 ? Math.round(completed / total * 100) : 0;
          const cfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG["Active"];
          const smsMsgCount = Object.values(tx.smsThreads || {}).reduce((a, t) => a + t.length, 0);
          // At-a-glance commission for this deal (agent view only). Net = our gross
          // commission + transaction fee − brokerage split − office flat fee.
          const cardNetComm = (() => {
            const price = Number(tx.contractPrice || tx.listPrice || 0);
            const listComm = tx.commissionListing ? price * Number(tx.commissionListing) / 100 : 0;
            const buyerComm = tx.commissionBuyer ? price * Number(tx.commissionBuyer) / 100 : 0;
            const our = tx.type === "Listing (Seller)" ? listComm : tx.type === "Buyer Representation" ? buyerComm : tx.type === "Dual Agency" ? listComm + buyerComm : 0;
            if (!our) return 0;
            const split = tx.brokerageSplit ? our * Number(tx.brokerageSplit) / 100 : 0;
            return our + Number(tx.transactionFee || 0) - split - Number(tx.officeFlatFee || 0);
          })();
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
                  🔔 {isBuyerSideType(tx.type) ? "NEW BUYER INQUIRY" : "NEW SELLER LEAD"} — Contact Within 24hrs
                </div>
              )}
              {tx.assignedAgentId && !tx.needsReview && tx.leadConverted === false && (
                <div style={{ background: "#FEF9E7", color: "#B7860B", padding: "8px 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span>🌱 {isBuyerSideType(tx.type) ? "INQUIRY" : "LEAD"} — not yet confirmed</span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); onLeadAction(tx.id, "confirm"); }} style={{ background: "#B7860B", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Confirm</button>
                    <button onClick={e => { e.stopPropagation(); onLeadAction(tx.id, "cancel"); }} style={{ background: "#fff", color: "#B7860B", border: "1px solid #C9A227", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕ Not Pursuing</button>
                  </span>
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
                    <span style={{ fontSize: 13 }}>{txTypeIcon(tx.type)}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                      color: tx.type === "Buyer Representation" ? "#60A5FA" : "#F87171",
                      background: tx.type === "Buyer Representation" ? "rgba(59,130,246,0.15)" : "rgba(192,57,43,0.15)",
                      padding: "2px 8px", borderRadius: 20
                    }}>
                      {tx.type === "Buyer Representation" ? "Buyer" : tx.type === "Dual Agency" ? "Dual" : "Listing"}
                    </span>
                    <Badge label={tx.status} color={cfg.color} bg={cfg.bg} />
                    {propertyTypeBadge(tx) && <Badge label={propertyTypeBadge(tx).label} color={propertyTypeBadge(tx).color} bg={propertyTypeBadge(tx).bg} />}
                  </div>
                  <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 15, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.address}</div>
                  {clientNameForTx(tx) && (
                    <div style={{ color: "rgba(255,255,255,0.92)", fontSize: 12.5, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>👤 {clientLabelForTx(tx)}: {clientNameForTx(tx)}</div>
                  )}
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{tx.city}, FL · {tx.county} County</div>
                  {/* Coordinator: show which brokerage/agent this deal belongs to — they juggle many across firms. */}
                  {coordinatorMode && tx.owningBrokerageName && (
                    <div style={{ display: "inline-block", marginTop: 6, color: "#FCD34D", fontSize: 11, fontWeight: 700, background: "rgba(252,211,77,0.15)", border: "1px solid rgba(252,211,77,0.4)", borderRadius: 6, padding: "2px 8px" }}>
                      🏢 {tx.owningBrokerageName}{tx.assignedAgentName ? " · " + tx.assignedAgentName : ""}
                    </div>
                  )}
                  {/* Agent view: this deal is run by a transaction coordinator. */}
                  {!coordinatorMode && tx.coordinatorName && (
                    <div style={{ display: "inline-block", marginTop: 6, color: "#A7F3D0", fontSize: 11, fontWeight: 700, background: "rgba(16,110,86,0.25)", border: "1px solid rgba(16,185,129,0.5)", borderRadius: 6, padding: "2px 8px" }}>
                      🧭 Coordinated by {tx.coordinatorName}
                    </div>
                  )}
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

                {/* Commission at a glance (agent view only) */}
                {!coordinatorMode && cardNetComm > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#EAF7EF", border: "1px solid #BBE6CC", borderRadius: 8, padding: "7px 12px", marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#1E8449", textTransform: "uppercase", letterSpacing: "0.05em" }}>💵 Est. Commission</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#1E8449" }}>${Math.round(cardNetComm).toLocaleString()}</span>
                  </div>
                )}

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
                    <span style={{ fontWeight: 600, color: "#555" }}>Progress: {completed}/{total} done</span>
                    <span style={{ fontWeight: 800, color: progress === 100 ? "#1E8449" : progress > 50 ? "#B7770D" : "#555" }}>{progress}%</span>
                  </div>
                  <div style={{ height: 7, background: "#E5E7EB", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${progress}%`,
                      background: progress === 100 ? "#1E8449" : tx.type === "Buyer Representation" ? "#3B82F6" : "#C0392B",
                      borderRadius: 4, transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    {["Contract", "Inspection", "Title", "Closing"].map((milestone) => {
                      // Only highlight stages the transaction has actually reached
                      const stageReached = {
                        "Contract":   ["Under Contract","Inspection","Appraisal","Clear to Close","Closed"].includes(tx.status),
                        "Inspection": ["Inspection","Appraisal","Clear to Close","Closed"].includes(tx.status),
                        "Title":      ["Appraisal","Clear to Close","Closed"].includes(tx.status),
                        "Closing":    ["Clear to Close","Closed"].includes(tx.status),
                      }[milestone];
                      // Stage dots follow the deal's status (where it actually is),
                      // not the legacy tasks table. Green once the stage is reached.
                      const isDone = stageReached;
                      const isStarted = stageReached;
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

                {/* Next action (matches the Pipeline view) */}
                {tx.nextMilestone && tx.nextMilestone.name && (
                  <div style={{ fontSize: 11, color: "#0F2744", marginBottom: 10, background: "#F8FAFC", borderRadius: 6, padding: "5px 8px" }} title="Next action on this deal">
                    ⏭️ <b>Next:</b> {tx.nextMilestone.name}{tx.nextMilestone.dueDate ? ` · ${tx.nextMilestone.dueDate}` : ""}
                  </div>
                )}

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
        {hydratedPagedTxs.length === 0 && !pagedLoading && (
          (search || filter !== "All" || activeFilterCount > 0) ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: COLORS.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy, marginBottom: 6 }}>Nothing matches your search or filters</div>
              <div style={{ marginBottom: 14 }}>Your deals are still here — they're just hidden by the current filter.</div>
              <button onClick={() => { setSearch(""); setFilter("All"); clearAllFilters(); }}
                style={{ padding: "11px 22px", background: COLORS.navy, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                Show all my deals
              </button>
            </div>
          ) : (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: COLORS.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy, marginBottom: 6 }}>No deals yet — let's start your first one</div>
              <div style={{ marginBottom: 14 }}>Tap <b>➕ New Deal</b> up top: the address, your client, the price — about a minute.</div>
              {!coordinatorMode && <button onClick={onNew} style={{ padding: "11px 22px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>➕ Start my first deal</button>}
            </div>
          )
        )}
      </div>
      )}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {pagedLoading && <div style={{ textAlign: "center", padding: 16, color: COLORS.muted, fontSize: 13 }}>Loading…</div>}
      {!pagedHasMore && hydratedPagedTxs.length > 0 && pagedTotal > 0 && <div style={{ textAlign: "center", padding: 16, color: COLORS.muted, fontSize: 12 }}>Showing all {viewMode === "pipeline" ? transactions.filter(t => t.status !== "Cancelled").length : pagedTotal} transactions</div>}

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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: 680, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", margin: "auto" }}>
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
    const matchSearch = !search || (c.name || "").toLowerCase().includes(search.toLowerCase()) || (c.company || "").toLowerCase().includes(search.toLowerCase()) || (c.email || "").toLowerCase().includes(search.toLowerCase());
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 720, maxWidth: "100%", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", margin: "auto" }}>
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
              <Input label="Role" value={PARTY_ROLES.includes(form.role) ? form.role : "Other"} onChange={f("role")} options={PARTY_ROLES} required />
              {(form.role === "Other" || (form.role && !PARTY_ROLES.includes(form.role))) && (
                <Input label="Specify role" value={form.role === "Other" ? "" : form.role} onChange={v => f("role")(v.trim() ? v : "Other")} placeholder="e.g. Notary, Surveyor, Co-buyer" />
              )}
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

function MainApp({ onLogout, currentUser, coordinatorMode = false }) {
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});       // in-app chat, per tx
  const [inboundCounts, setInboundCounts] = useState({});     // client email replies, per tx
  const [signAlerts, setSignAlerts] = useState([]);           // pop-up notifications (e-sign events)
  const [floatHiddenSig, setFloatHiddenSig] = useState("");   // ✕-hidden chip signature (re-shows on NEW alerts)
  const [showAddTask, setShowAddTask] = useState(false);      // "Add a Task" from the Tools menu
  const [showTcTeamG, setShowTcTeamG] = useState(false);      // coordinator Team modal (Tools menu)
  const [showTcServicesG, setShowTcServicesG] = useState(false);
  const [initialDetailTab, setInitialDetailTab] = useState("overview");
  // Bumped on every openTransactionMilestones() call so the detail view re-routes
  // to the requested tab EVEN WHEN you're already viewing that same deal (e.g. you
  // click the floating "new message" alert while standing on the deal — without a
  // changing signal the tab state never re-applies and nothing appears to happen).
  const [detailNavSignal, setDetailNavSignal] = useState(0);
  const token = localStorage.getItem("tp_token") || "";
  const authHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

  // Poll unread chat counts every 15s across the whole app (not just dashboard)
  const prevTotalRef = useRef(null);
  const pollSigRef = useRef("");   // last poll payload signature — skip no-change re-renders
  const audioCtxRef = useRef(null);
  useEffect(() => {
    // Unlock audio on first user interaction (required by Chrome/Safari autoplay policy).
    // Self-removes after the first successful unlock so we don't fire on every
    // click/keydown for the rest of the session.
    const unlockAudio = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume();
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== "suspended") {
          document.removeEventListener("click", unlockAudio);
          document.removeEventListener("keydown", unlockAudio);
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
        // Poll BOTH channels — in-app chat AND inbound client replies — so the
        // alert covers "any message received."
        const [chatRes, inboundRes, notifRes] = await Promise.all([
          fetch(`${API}/chat/unread/counts`, { headers: { "Authorization": `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
          fetch(`${API}/inbound/unread/counts`, { headers: { "Authorization": `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
          // E-sign pop-ups ("Oscar just signed…") ride the same 15s poll + chime.
          fetch(`${API}/notifications/unseen`, { headers: { "Authorization": `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
        ]);
        if (stopped) return;
        const chat = (chatRes && chatRes.success && chatRes.counts) || {};
        const inbound = (inboundRes && inboundRes.success && inboundRes.counts) || {};
        const notifs = (notifRes && notifRes.success && notifRes.notifications) || [];
        const total = Object.values(chat).reduce((a, b) => a + b, 0) + Object.values(inbound).reduce((a, b) => a + b, 0) + notifs.length;
        if (prevTotalRef.current !== null && total > prevTotalRef.current) playDashboardAlert();
        prevTotalRef.current = total;
        // Only touch state when the payload actually CHANGED. Unconditional
        // setState here re-rendered the ENTIRE app every 15s with fresh object
        // identities — and any click mid-render could be swallowed ("I have to
        // click everything twice"). Same-data polls are now no-ops.
        const sig = JSON.stringify([chat, inbound, notifs.map(n => n.id)]);
        if (pollSigRef.current !== sig) {
          pollSigRef.current = sig;
          setUnreadCounts(chat);
          setInboundCounts(inbound);
          setSignAlerts(notifs);
        }
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

  // Clear the inbound-reply count for a deal the moment the agent views its
  // Replies section (the server mark-read already ran in the detail view) — so the
  // global 🔔 alert disappears immediately instead of lingering until the next poll.
  const markInboundRead = (transactionId) => {
    setInboundCounts(prev => { const n = { ...prev }; delete n[transactionId]; return n; });
  };

  // Load transactions from database on mount.
  // includeClosed=true so the Pipeline view's "Closed" column actually
  // populates and recently-closed deals don't vanish from the dashboard.
  // Backend caps at LIMIT 500, so this is safe at brokerage scale.
  const loadTransactions = () => {
    return fetch(`${API}/${coordinatorMode ? "tc/pipeline" : "transactions"}?includeClosed=true`, { headers: authHeaders })
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
    constructionType: t.construction_type || "Resale",
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
            owningAgentEmail: t.owning_agent_email || null,
            owningAgentPhone: t.owning_agent_phone || null,
            owningAgentTitle: t.owning_agent_title || null,
            coordinatorAssignment: t.coordinator_assignment || null,
            owningTenantId: t.tenant_id,
            owningBrokerageName: t.brokerage_name,
            owningBrokerageColor: t.brokerage_color,
            messages: t.internal_notes || [],
            parties: (t.parties || []).filter(Boolean).map(p => ({ id: p.id, role: p.role, name: p.name, email: p.email, phone: p.phone, company: p.company, isVendor: p.isVendor || false, vendorStatus: p.vendorStatus || null, vendorCategory: p.vendorCategory || null, vendorDescription: p.vendorDescription || null, lastLoginAt: p.lastLoginAt || null })),
            tasks: (t.tasks || []).filter(Boolean).map(tk => ({ id: tk.id, name: tk.name, status: tk.status, dueDate: tk.dueDate, category: tk.category, assignTo: tk.assignTo })),
            milestoneSummary: t.milestone_summary || null,
            nextMilestone: t.next_milestone || null,
            coordinatorName: t.coordinator_name || null,
            isGuestView: t.is_guest_view || false,
            guestSide: t.guest_side || null,
            isCoordinatorView: t.is_coordinator_view || false,
            reminders: (t.reminders || []).filter(Boolean).map(r => ({ id: r.id, title: r.title, date: r.date, message: r.message, channels: r.channels, parties: r.parties || [], sent: r.sent, doneAt: r.doneAt || null })),
            needsFirstContact: t.needs_first_contact || false,
            submittedVia: t.submitted_via || null,
            leadConverted: t.lead_converted !== false,
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
            yearBuilt: t.year_built || "",
            floodZone: t.flood_zone || "",
    sellerIsForeign: t.seller_is_foreign || false,
    isCoastal: t.is_coastal || false,
    inHoa: t.in_hoa === true ? "yes" : t.in_hoa === false ? "no" : "",
    hoaFeeMonthly: t.hoa_fee_monthly || "",
    financingType: t.financing_type || "",
    sellerPaysBuyerBroker: t.seller_pays_buyer_broker || false,
    isShortSale: t.is_short_sale || false,
    hasSellerFinancing: t.has_seller_financing || false,
    sellerPostClosingOccupancy: t.seller_post_closing_occupancy || false,
            representationExpiresOn: t.representation_expires_on ? String(t.representation_expires_on).slice(0, 10) : "",
            contractFormType: t.contract_form_type || "",
            occupancyStatus: t.occupancy_status || "",
            // CMA subject auto-fill: property specs captured at intake (and
            // re-saved each time a CMA is run) so the Subject tab pre-fills.
            beds: t.beds ?? "",
            baths: t.baths ?? "",
            sqft: t.sqft ?? "",
            lotAcres: t.lot_acres ?? "",
            stories: t.stories ?? "",
            garageSpaces: t.garage_spaces ?? "",
            poolType: t.pool_type || "",
            hasWaterView: t.has_water_view || false,
            hasGolfView: t.has_golf_view || false,
            propertyCondition: t.property_condition || "",
            intakeDetails: t.intake_details || null,
          }));
          // Pin buyer/seller intake transactions needing first contact to top
          const sorted = [...rawTxs].sort((a, b) => {
            const aNew = a.needsFirstContact ? 1 : 0;
            const bNew = b.needsFirstContact ? 1 : 0;
            return bNew - aNew;
          });
          setTransactions(sorted);
          return sorted;
        }
        return [];
      })
      .catch(e => { console.error("Failed to load transactions:", e); return []; })
      .finally(() => setTxLoading(false));
  };
  useEffect(() => { loadTransactions(); }, []);

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
  // When a standalone CMA is turned into a transaction, the New Transaction form
  // opens pre-filled from the CMA subject; cmaConvert carries that across.
  const [cmaConvert, setCmaConvert] = useState(null); // { prefill, cmaId } | null
  const onCreateTransactionFromCma = ({ cmaId, subject, analysis }) => {
    const rec = analysis && Array.isArray(analysis.tiers) ? analysis.tiers[1]?.listPrice : null;
    setCmaConvert({
      cmaId: cmaId || null,
      prefill: {
        address: subject?.address || "",
        yearBuilt: subject?.yearBuilt || "",
        listPrice: rec != null ? String(Math.round(rec)) : (subject?.currentListPrice || ""),
        type: "Listing (Seller)",
      },
    });
    setView("new");
  };
  const [showReports, setShowReports] = useState(false);
  const [reportsTab, setReportsTab] = useState("overview");
  const openReports = (tab = "overview") => { setReportsTab(tab); setShowReports(true); };
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  // Deep link: a briefing/email link like ?deal=<txId>[&tab=documents] opens that
  // deal directly — so every alert can point at the action, not the homepage.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current || transactions.length === 0) return;
    const sp = new URLSearchParams(window.location.search);
    const dealId = sp.get("deal");
    if (!dealId) return;
    const t = transactions.find(x => x.id === dealId);
    if (t) {
      deepLinkedRef.current = true;
      setSelectedId(dealId);
      setInitialDetailTab(sp.get("tab") || "overview");
      setView("detail");
    }
  }, [transactions]);

  // Deep link: a briefing/email link like ?view=contacts or ?view=popbys opens
  // that page directly (the morning briefing's "Open today's calls" / "Plan your
  // pop-by run" buttons). Runs once on mount; safelisted to known pages.
  const viewLinkedRef = useRef(false);
  useEffect(() => {
    if (viewLinkedRef.current) return;
    const v = new URLSearchParams(window.location.search).get("view");
    if (v && ["contacts", "popbys", "scripts", "expenses", "forms", "cma"].includes(v)) {
      viewLinkedRef.current = true;
      setView(v);
    }
  }, []);
  const [contacts, setContacts] = useState([]);
  // Freemium: a free guest (invited party) sees every feature but is paywalled on use.
  const [isFreeGuest, setIsFreeGuest] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState(null);
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/me/access", { headers: { Authorization: "Bearer " + tok } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIsFreeGuest(!!d.isFreeGuest); })
      .catch(() => {});
  }, []);
  // Wrap a nav action: free guests get the paywall prompt instead of the feature.
  const guard = (label, fn) => () => { if (isFreeGuest) setPaywallFeature(label); else fn(); };
  const [showTeam, setShowTeam] = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);
  const [showTaskTmpls, setShowTaskTmpls] = useState(false);
  const [showContractIntake, setShowContractIntake] = useState(false);
  const [showComplianceDash, setShowComplianceDash] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [forcePasswordReset, setForcePasswordReset] = useState(false);
  const [showCompanySettings, setShowCompanySettings] = useState(false);
  const [showSuperuser, setShowSuperuser] = useState(false);
  const [showAgentProfile, setShowAgentProfile] = useState(false);
  const [showIntakeLinks, setShowIntakeLinks] = useState(false);
  const [showContactBook, setShowContactBook] = useState(false);
  const [showVendorLibrary, setShowVendorLibrary] = useState(false);
  const [contactBookCallback, setContactBookCallback] = useState(null);

  // Help Center: bump this counter to open it from ⚙️ Menu → ❓ Help.
  const [helpSignal, setHelpSignal] = useState(0);
  // Feedback: bump to open the Help Center straight to the 📣 Feedback tab (⚙️ Menu → 📣 Feedback).
  const [feedbackSignal, setFeedbackSignal] = useState(0);
  // Contact Support: bump to open the Help Center support form (⚙️ Menu → ✉️ Contact Support).
  const [supportSignal, setSupportSignal] = useState(0);
  // 🎬 App Tour — replayable swipe-through (last onboarding step + Help Center).
  const [showTour, setShowTour] = useState(false);

  // First-time onboarding walkthrough -------------------------------------
  const isAdminUser = ["admin", "superadmin"].includes(currentUser?.role);
  const onboardKey = `tp_onboarding_v1_${currentUser?.id || "anon"}`;
  // The walkthrough flag lives on the USER (login response → currentUser.onboarding),
  // with localStorage as a same-device cache. Server state wins: phones that clear
  // site data between visits lost the localStorage flag, so the welcome overlay
  // re-appeared on every mobile login and its backdrop ate the first tap on
  // "View All My Transactions" — the recurring "have to click twice" bug.
  const [onboard, setOnboard] = useState(() => {
    const fromServer = currentUser?.onboarding;
    if (fromServer && typeof fromServer === "object") {
      return { active: !fromServer.dismissed && !fromServer.finished, done: new Set(fromServer.done || []) };
    }
    try {
      const raw = localStorage.getItem(onboardKey);
      if (raw) { const p = JSON.parse(raw); return { active: !p.dismissed && !p.finished, done: new Set(p.done || []) }; }
    } catch (e) { /* ignore */ }
    return { active: true, done: new Set() };  // brand-new sign-in → walk them through it
  });
  const persistOnboard = (active, doneSet, extra = {}) => {
    const next = { active, done: doneSet };
    setOnboard(next);
    const payload = { done: [...doneSet], dismissed: !!extra.dismissed, finished: !!extra.finished };
    try { localStorage.setItem(onboardKey, JSON.stringify(payload)); } catch (e) { /* ignore */ }
    // Server is the durable copy — and keep the cached tp_user in sync so a
    // remount in this session (or this device's next login) sees the same state.
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/me/onboarding", { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok }, body: JSON.stringify(payload) })
      .catch(e => console.error("[onboarding save]", e && e.message ? e.message : e));
    try {
      const u = JSON.parse(localStorage.getItem("tp_user") || "null");
      if (u) { u.onboarding = payload; localStorage.setItem("tp_user", JSON.stringify(u)); }
    } catch (e) { /* ignore */ }
  };
  // Order: Company → Profile → Goals (Company is admin-only, so non-admins start at Profile), then the App Tour.
  const onboardSteps = [];
  if (isAdminUser) onboardSteps.push({ key: "company", emoji: "⚙️", title: "Set up company settings", desc: "Add your brokerage name, logo, and branding — it shows on everything your clients see.", where: "⚙️ Menu → ⚙️ Company Settings", go: () => setShowCompanySettings(true) });
  onboardSteps.push({ key: "profile", emoji: "👤", title: "Set up your profile", desc: "Add your photo, signature, and contact info — used on every email and form you send.", where: "⚙️ Menu → 👤 My Profile", go: () => setShowAgentProfile(true) });
  onboardSteps.push({ key: "goals", emoji: "🎯", title: "Set up your goals", desc: "Tell the app your income target so it can plan your day for you.", where: "⚙️ Menu → 🎯 Goal Planner", go: () => openReports("goals") });
  onboardSteps.push({ key: "tour", tour: true, emoji: "🎬", title: "Take the 60-second tour", desc: "A quick look at what every button does — then you're ready to roll." });
  const onboardTakeMeThere = (step) => {
    const nextDone = new Set(onboard.done); nextDone.add(step.key);
    persistOnboard(true, nextDone);
    step.go();
  };
  const onboardStartTour = (step) => {
    const nextDone = new Set(onboard.done); nextDone.add(step.key);
    persistOnboard(true, nextDone);
    setView("dashboard");   // spotlight tour highlights the dashboard toolbar
    setShowTour(true);
  };
  const restartTour = () => persistOnboard(true, new Set());

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
    // Capture the prior tx so we can roll back if the server rejects the save.
    let previous = null;
    setTransactions(txs => { previous = txs.find(t => t.id === updated.id) || null; return txs.map(t => t.id === updated.id ? updated : t); });
    // Coordinators: keep the local state change but NEVER fire the full-tx PUT —
    // the server blocks it for TCs (by design), and every TC-allowed action
    // (reminder done/snooze, docs, milestones) already persists via its own
    // endpoint. Firing it anyway popped "Save failed. Coordinators update deals
    // through the coordination tools…" after a successful Done (Carlos 7/28).
    try { if ((JSON.parse(localStorage.getItem("tp_user") || "{}").role || "") === "tc") return; } catch {}
    const freshTok = localStorage.getItem("tp_token") || "";
    const freshH = { "Content-Type": "application/json", "Authorization": "Bearer " + freshTok };
    const rollback = () => { if (previous) setTransactions(txs => txs.map(t => t.id === updated.id ? previous : t)); };
    try {
      const r = await fetch(API + "/transactions/" + updated.id, { method: "PUT", headers: freshH, body: JSON.stringify({ address: updated.address, city: updated.city, state: updated.state, zipCode: updated.zipCode, county: updated.county, mlsNumber: updated.mlsNumber, propertyType: updated.propertyType, type: updated.type, status: updated.status, listPrice: updated.listPrice, contractPrice: updated.contractPrice, openDate: updated.openDate, closingDate: updated.closingDate, executedDate: updated.executedDate, notes: updated.notes, propertyAccess: updated.propertyAccess, commissionListing: updated.commissionListing, commissionBuyer: updated.commissionBuyer, transactionFee: updated.transactionFee, brokerageSplit: updated.brokerageSplit, officeFlatFee: updated.officeFlatFee, mailAway: updated.mailAway, commissionNotes: updated.commissionNotes, referralSource: updated.referralSource, assignedAgent: updated.assignedAgentId, occupancyStatus: updated.occupancyStatus, earnestMoneyAmount: updated.earnestMoneyAmount, emdDeadline: updated.emdDeadline, inspectionPeriodDays: updated.inspectionPeriodDays, inspectionPeriodEnd: updated.inspectionPeriodEnd, financingContingency: updated.financingContingency, financingContingencyDays: updated.financingContingencyDays, appraisalContingency: updated.appraisalContingency, appraisalContingencyDays: updated.appraisalContingencyDays, hoaApprovalRequired: updated.hoaApprovalRequired, hoaApprovalDays: updated.hoaApprovalDays, surveyRequired: updated.surveyRequired, isCash: updated.isCash, yearBuilt: updated.yearBuilt, inHoa: updated.inHoa, floodZone: updated.floodZone, sellerIsForeign: updated.sellerIsForeign, isCoastal: updated.isCoastal, financingType: updated.financingType, sellerPaysBuyerBroker: updated.sellerPaysBuyerBroker, isShortSale: updated.isShortSale, hasSellerFinancing: updated.hasSellerFinancing, sellerPostClosingOccupancy: updated.sellerPostClosingOccupancy, representationExpiresOn: updated.representationExpiresOn, contractFormType: updated.contractFormType, additionalTerms: updated.additionalTerms, internalNotes: updated.messages || [], smsThreads: updated.smsThreads || {}, parties: updated.parties || [], tasks: updated.tasks || [], reminders: updated.reminders || [] }) });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        console.error("Save error:", e);
        rollback();
        alert("Save failed: " + (e.error || "Please try again."));
      }
    } catch (e) {
      console.error("Save failed:", e);
      rollback();
      alert("Save failed. Check your connection and try again.");
    }
  }, []);
  // Live-update the pipeline card's progress when timeline milestones change.
  const applyMilestoneSummary = useCallback((txId, summary, nextMilestone) => {
    setTransactions(txs => txs.map(t => t.id === txId
      ? { ...t, milestoneSummary: summary, nextMilestone: nextMilestone !== undefined ? nextMilestone : t.nextMilestone }
      : t));
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
          propertyType: t.property_type, constructionType: t.construction_type || "Resale", type: t.transaction_type,
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
        // trim + split on runs of whitespace: a party saved as " Gilberto Colon"
        // (leading space) used to produce an EMPTY first name → "Name and email
        // required" even though the dialog showed a perfectly good name.
        body: JSON.stringify({
          email: String(party.email || "").trim(),
          firstName: String(party.name || "").trim().split(/\s+/)[0],
          lastName: String(party.name || "").trim().split(/\s+/).slice(1).join(" ") || ".",
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
        alert(party.email + " already has a portal account — we just re-sent their one-tap login link by email.\n\nIf they still don't see it (check spam), use the 🔗 Login Link button to copy the link and text it to them directly.");
      } else if (res.ok) {
        alert("Invitation sent to " + party.email + "! They'll get an email with a one-tap link to their portal (they set a 4-digit PIN on first use).");
      } else if (data.error === "Email already registered") {
        alert(party.email + " is already registered — we re-sent their login link by email. If it doesn't arrive, use 🔗 Login Link to share it directly.");
      } else {
        alert("Failed: " + (data.error || "Unknown error"));
      }
    } catch (e) { alert("Error: " + e.message); }
  };

  // Get a portal login LINK to share manually (text/WhatsApp/phone) when email
  // isn't reliable. Ensures the account exists, then copies the link to the
  // clipboard. The link still needs their private PIN, so it's safe to send.
  const copyPartyLoginLink = async (party, tx) => {
    if (!party.email) { alert("This party has no email address. Add one first."); return; }
    const tok = localStorage.getItem("tp_token") || "";
    try {
      const res = await fetch(API + "/transactions/" + tx.id + "/party-login-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
        body: JSON.stringify({ email: party.email }),
      });
      const data = await res.json();
      if (!res.ok || !data.link) throw new Error(data.error || "Could not create link");
      if (data.staff) { alert(data.message || "This is a staff account — they sign in with email and password."); return; }
      try { await navigator.clipboard.writeText(data.link); } catch { /* clipboard may be blocked; still show it below */ }
      window.prompt(
        `Login link for ${party.name || party.email} — copied to your clipboard. Text or email it to them.\n\nThey'll set a private 4-digit PIN the first time (the link alone can't sign anyone in).`,
        data.link
      );
    } catch (e) { alert("Could not create login link: " + e.message); }
  };

  const openTransactionMilestones = async (txId, tab = "documents") => {
    if (!txId) return;
    let t = transactions.find(t => t.id === txId);
    if (!t) {
      // Not in the loaded list (stale/empty pipeline, or a deal just assigned).
      // Refresh the pipeline once and look again — don't dump the user to the
      // list (or a blank detail) when the deal really does exist.
      console.warn("[openTransactionMilestones] tx not loaded, refreshing:", txId);
      const fresh = await loadTransactions();
      t = (fresh || []).find(x => x.id === txId);
    }
    if (t) {
      setSelectedId(txId);
      setInitialDetailTab(tab); // default Documents (where they upload); inbound cards land on Replies
      setDetailNavSignal(n => n + 1); // force the tab to re-route even if already on this deal
      setView("detail");
    } else {
      console.error("[openTransactionMilestones] tx still not found after refresh:", txId);
      alert("Couldn't open that transaction — it may have been moved or you no longer have access. Try refreshing.");
    }
  };

  // The Win-the-Day monthly-financials card lives in DailyDashboard (which has
  // no navigation props for app-level pages) — it asks for the Financials page
  // via this event.
  useEffect(() => {
    const h = () => setView("expenses");
    window.addEventListener("tp:open-financials", h);
    return () => window.removeEventListener("tp:open-financials", h);
  }, []);

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
    <Suspense fallback={<LazyLoading />}>
      {/* FLOATING ALERT CHIP — one generic, persistent pointer (Carlos 7/28:
          individual pop-ups vanished on click and the alert was gone). Clicking
          it NEVER dismisses anything — it opens Win The Day, where every alert
          has its own box with Done / Take-me-there. ✕ only hides the chip until
          new alerts arrive; the alerts themselves stay until acknowledged. */}
      {signAlerts.length > 0 && floatHiddenSig !== signAlerts.map(n => n.id).join(",") && (
        <div style={{ position: "fixed", top: 70, right: 14, zIndex: 9998, maxWidth: 320 }}>
          <div
            onClick={() => { setView("dashboard"); setSelectedId(null); }}
            style={{ background: "#fff", border: "2px solid #dc2626", borderRadius: 12, padding: "12px 14px", boxShadow: "0 10px 30px rgba(2,6,23,0.25)", cursor: "pointer", animation: "signAlertIn 0.35s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#b91c1c", lineHeight: 1.35 }}>
                🔔 You have {signAlerts.length} new alert{signAlerts.length === 1 ? "" : "s"}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setFloatHiddenSig(signAlerts.map(n => n.id).join(",")); }} title="Hide (alerts stay on Win The Day)"
                style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: "#374151", marginTop: 4, lineHeight: 1.4 }}>{signAlerts[0].title}{signAlerts.length > 1 ? ` (+${signAlerts.length - 1} more)` : ""}</div>
            <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 6, fontWeight: 700 }}>Tap to open Win The Day →</div>
          </div>
          <style>{"@keyframes signAlertIn { from { transform: translateX(30px); opacity: 0; } to { transform: none; opacity: 1; } }"}</style>
        </div>
      )}

      {/* GLOBAL NEW-MESSAGE ALERT — pulsing, fixed, shows on EVERY screen so a new
          chat/message is never missed while the user is working elsewhere. Clears
          itself once the messages are read. */}
      {(() => {
        // ANY message — in-app chat OR an inbound client reply — fires the alert,
        // for the agent AND the TC alike. Only count deals that are in the loaded
        // pipeline so the alert can always OPEN cleanly — otherwise an unread on a
        // deal the user can't open (e.g. a TC who's a party but not the coordinator
        // on a closed deal) created a dead-end "couldn't open that transaction" with
        // no way to clear it. The server already scopes counts to accessible deals;
        // this just keeps the badge to ones we can actually navigate to.
        const known = new Set((transactions || []).map(t => t.id));
        const merged = {};
        for (const [id, n] of Object.entries(unreadCounts || {})) if (n > 0 && known.has(id)) merged[id] = (merged[id] || 0) + n;
        for (const [id, n] of Object.entries(inboundCounts || {})) if (n > 0 && known.has(id)) merged[id] = (merged[id] || 0) + n;
        const entries = Object.entries(merged);
        const total = entries.reduce((a, [, n]) => a + n, 0);
        if (total === 0) return null;
        const kindFor = (id) => ((inboundCounts || {})[id] > 0 ? "replies" : "chat");
        const go = () => {
          if (entries.length === 1) { openTransactionMilestones(entries[0][0], kindFor(entries[0][0])); return; }
          // Multiple deals → the New Messages inbox at the top of Home. If we're
          // ALREADY on Home the view switch is invisible — scroll the inbox into
          // view and flash it so the click always visibly does something.
          setShowReports(false); setShowCalendar(false); setView("home");
          setTimeout(() => {
            const el = document.getElementById("unread-inbox");
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.style.transition = "box-shadow 0.3s";
              el.style.boxShadow = "0 0 0 4px rgba(192,57,43,0.55)";
              setTimeout(() => { el.style.boxShadow = "none"; }, 1600);
            }
          }, 200);
        };
        return (
          <>
            <style>{`@keyframes mpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}`}</style>
            <div onClick={go} title="You have new messages — tap to read"
              style={{ position: "fixed", bottom: 18, left: 18, zIndex: 9998, background: "#C0392B", color: "#fff", borderRadius: 30, padding: "13px 20px", boxShadow: "0 8px 26px rgba(192,57,43,0.55)", cursor: "pointer", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 10, animation: "mpulse 1.6s ease-in-out infinite", maxWidth: "calc(100vw - 36px)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              🔔 {total} new message{total === 1 ? "" : "s"}{entries.length > 1 ? ` · ${entries.length} deals` : ""} <span style={{ textDecoration: "underline", whiteSpace: "nowrap" }}>Read →</span>
            </div>
          </>
        );
      })()}
      {paywallFeature && (
        <div onClick={() => setPaywallFeature(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 99999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", fontFamily: "'Segoe UI', system-ui, sans-serif", margin: "auto" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>✨</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#1a2332", marginBottom: 8 }}>{paywallFeature} is a paid feature</div>
            <div style={{ fontSize: 14, color: "#667085", lineHeight: 1.6, marginBottom: 20 }}>
              You're on a free invited-party account. {paywallFeature} — plus your own transaction pipeline, contacts, expense tracking, reminders, intake links, and more — comes with a TransactPro subscription. Feel free to look around!
            </div>
            <button onClick={() => setPaywallFeature(null)} style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>Subscribe to unlock</button>
            <div style={{ marginTop: 12 }}><button onClick={() => setPaywallFeature(null)} style={{ background: "none", border: "none", color: "#667085", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Maybe later</button></div>
          </div>
        </div>
      )}
      {showReports && <Reports transactions={transactions} onBack={() => setShowReports(false)} currentUser={currentUser} initialTab={reportsTab} />}

      {!showReports && view === "new" && (
        <NewTransactionForm
          currentUser={currentUser}
          prefill={cmaConvert?.prefill || null}
          cmaId={cmaConvert?.cmaId || null}
          onSave={(tx) => { setCmaConvert(null); addTransaction(tx); }}
          onCancel={() => { setCmaConvert(null); setView(cmaConvert ? "cma" : "home"); }}
          onImportContract={() => { setCmaConvert(null); setView("home"); setShowContractIntake(true); }}
        />
      )}
      {view === "cma" && (
        <StandaloneCmaPage
          token={localStorage.getItem("tp_token") || ""}
          currentUser={currentUser}
          onBack={() => setView("dashboard")}
          onCreateTransactionFromCma={onCreateTransactionFromCma}
        />
      )}
      {!showReports && !showCalendar && view === "detail" && selectedTx && (
        <TransactionDetail
          initialTab={initialDetailTab}
          navSignal={detailNavSignal}
          dashboardUnread={unreadCounts[selectedId] || 0}
          tx={selectedTx}
          coordinatorMode={coordinatorMode}
          onUpdate={updateTransaction}
          onLocalUpdate={(updated) => setTransactions(txs => txs.map(t => t.id === updated.id ? updated : t))}
          onMilestoneSummary={applyMilestoneSummary}
          onInboundRead={markInboundRead}
          onDuplicate={duplicateTransaction}
          currentUser={currentUser}
          onBack={() => setView("dashboard")}
          contacts={contacts}
          onSaveContact={addContact}
          onOpenContactBook={openContactBook}
          onInviteParty={(party) => invitePartyToPortal(party, selectedTx)}
          onCopyLoginLink={(party) => copyPartyLoginLink(party, selectedTx)}
        />
      )}
      {/* Never blank: detail requested but the deal isn't loaded yet. */}
      {!showReports && !showCalendar && view === "detail" && !selectedTx && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ color: "#64748B", fontSize: 15, marginBottom: 16 }}>Loading this transaction…</div>
          <button onClick={() => setView(coordinatorMode ? "home" : "dashboard")}
            style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            ← Back
          </button>
        </div>
      )}
      {/* ONE header for the whole app (home + deals). Every other screen has a
          back button; the logo and 🏠 always return to Today. */}
      {!showReports && !showCalendar && (view === "home" || view === "dashboard") && (
        <AppHeader
          view={view}
          coordinatorMode={coordinatorMode}
          currentUser={currentUser}
          isFreeGuest={isFreeGuest}
          contactCount={contacts.length}
          onHome={() => { setShowReports(false); setShowCalendar(false); setView("home"); }}
          onDeals={() => { setShowReports(false); setShowCalendar(false); setView("dashboard"); }}
          onNew={guard("Creating transactions", () => setView("new"))}
          onOpenContacts={guard("Contacts", () => setView("contacts"))}
          onOpenPopBys={guard("Pop-Bys", () => setView("popbys"))}
          onOpenScripts={guard("Scripts", () => setView("scripts"))}
          onOpenCMA={guard("CMA", () => setView("cma"))}
          onOpenGrowthPlan={guard("Growth Plan", () => setView("growthplan"))}
          onOpenExpenses={guard("Financials", () => setView("expenses"))}
          onVendors={guard("The Vendor library", () => setShowVendorLibrary(true))}
          onCalendar={guard("Calendar", () => setShowCalendar(true))}
          onIntakeLinks={guard("My Intake Links", () => setShowIntakeLinks(true))}
          onAddTask={() => setShowAddTask(true)}
          onTcTeam={() => setShowTcTeamG(true)}
          onTcServices={() => setShowTcServicesG(true)}
          onOpenContactBook={guard("Contacts", () => openContactBook(null))}
          onReports={guard("Reports", () => openReports("overview"))}
          onGoalPlanner={guard("Goal Planner", () => openReports("goals"))}
          onAgentProfile={() => setShowAgentProfile(true)}
          onOpenComplianceDash={guard("The Compliance dashboard", () => setShowComplianceDash(true))}
          onOpenCompliance={guard("Compliance tools", () => setShowCompliance(true))}
          onOpenTaskTmpls={guard("Task templates", () => setShowTaskTmpls(true))}
          onCompanySettings={guard("Company settings", () => setShowCompanySettings(true))}
          onChangePassword={() => setShowChangePassword(true)}
          onOpenForms={guard("The Forms library", () => setView("forms"))}
          onOpenTeam={guard("Team management", () => setShowTeam(true))}
          onSuperuser={() => setShowSuperuser(true)}
          onHelp={() => setHelpSignal(n => n + 1)}
          onFeedback={() => setFeedbackSignal(n => n + 1)}
          onSupport={() => setSupportSignal(n => n + 1)}
          onLogout={onLogout}
        />
      )}
      {showAddTask && (
        <PersonalTaskAddButton token={localStorage.getItem("tp_token") || ""} hideTrigger forceOpen onCloseExternal={() => setShowAddTask(false)} />
      )}
      {showTcTeamG && <CoordinatorTeamModal currentUser={currentUser} onClose={() => setShowTcTeamG(false)} />}
      {showTcServicesG && <CoordinatorServicesModal currentUser={currentUser} onClose={() => setShowTcServicesG(false)} />}
      {!showReports && view === "home" && (
        <>
          {/* NEW-MESSAGES ALERT — top of the home for BOTH agent and coordinator, so a
              new chat is impossible to miss across many deal cards. Driven by the
              unread counts MainApp already polls. */}
          <UnreadMessagesInbox unreadCounts={unreadCounts} inboundCounts={inboundCounts} transactions={transactions} onOpen={openTransactionMilestones} />
          {/* Coordinator's exception command center sits ABOVE Win-the-Day: the
              ranked "needs you" view across all their deals, AI-handled rest collapsed. */}
          {coordinatorMode && (
            <CoordinatorCommandCenter
              token={localStorage.getItem("tp_token") || ""}
              onOpenTransaction={openTransactionMilestones}
            />
          )}
          <DailyDashboard
            token={localStorage.getItem("tp_token") || ""}
            user={currentUser}
            coordinatorMode={coordinatorMode}
            onViewTransactions={() => { setShowReports(false); setShowCalendar(false); setView("dashboard"); }}
            onOpenTransactionMilestones={openTransactionMilestones}
            onOpenInboundReply={(txId) => openTransactionMilestones(txId, "replies")}
            onOpenPopBys={() => setView("popbys")}
          />
        </>
      )}
      {!showReports && !showCalendar && view === "dashboard" && (
        <Dashboard
          transactions={transactions}
          coordinatorMode={coordinatorMode}
          unreadCounts={unreadCounts}
          onViewTransactions={() => { setShowReports(false); setShowCalendar(false); setView("dashboard"); }}
          onSelect={(id, tab) => { setSelectedId(id); setInitialDetailTab(tab || "overview"); setView("detail"); }}
          onNew={guard("Creating transactions", () => setView("new"))}
          onOpenContactBook={guard("Contacts", () => openContactBook(null))}
          onOpenContacts={guard("Contacts", () => setView("contacts"))} onOpenPopBys={guard("Pop-Bys", () => setView("popbys"))} onOpenScripts={guard("Scripts", () => setView("scripts"))} onOpenCMA={guard("CMA", () => setView("cma"))} onOpenGrowthPlan={guard("Growth Plan", () => setView("growthplan"))} onOpenExpenses={guard("Financials", () => setView("expenses"))} onOpenForms={guard("The Forms library", () => setView("forms"))}
          contactCount={contacts.length}
          onLogout={onLogout}
          onOpenTeam={guard("Team management", () => setShowTeam(true))}
          onOpenCompliance={guard("Compliance tools", () => setShowCompliance(true))}
          onOpenComplianceDash={guard("The Compliance dashboard", () => setShowComplianceDash(true))}
          onOpenTaskTmpls={guard("Task templates", () => setShowTaskTmpls(true))}
          onOpenContractIntake={guard("Contract intake", () => setShowContractIntake(true))}
          onChangePassword={() => setShowChangePassword(true)}
          onReports={guard("Reports", () => openReports("overview"))}
          onGoalPlanner={guard("Goal Planner", () => openReports("goals"))}
          onCompanySettings={guard("Company settings", () => setShowCompanySettings(true))}
          onSuperuser={() => setShowSuperuser(true)}
          onAgentProfile={() => setShowAgentProfile(true)}
          onIntakeLinks={guard("My Intake Links", () => setShowIntakeLinks(true))}
          onHelp={() => setHelpSignal(n => n + 1)}
          onFeedback={() => setFeedbackSignal(n => n + 1)}
          onSupport={() => setSupportSignal(n => n + 1)}
          currentUser={currentUser}
          isFreeGuest={isFreeGuest}
          onHome={() => setView("home")}
          onVendors={guard("The Vendor library", () => setShowVendorLibrary(true))}
          onCalendar={guard("Calendar", () => setShowCalendar(true))}
        />
      )}
      {showCalendar && (
        <Suspense fallback={<LazyLoading />}>
          <CalendarView
            transactions={transactions}
            onBack={() => setShowCalendar(false)}
            onSelectTx={(id) => { setShowCalendar(false); setSelectedId(id); setView("detail"); }}
          />
        </Suspense>
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
      {view === "popbys" && (
        <PopBysPage token={localStorage.getItem("tp_token") || ""} onBack={() => setView("dashboard")} />
      )}
      {view === "scripts" && (
        <ScriptsPage token={localStorage.getItem("tp_token") || ""} onBack={() => setView("dashboard")} currentUser={currentUser} />
      )}
      {view === "growthplan" && (
        <GrowthPlanPage onBack={() => setView("dashboard")} />
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
      {showSuperuser && <SuperuserDashboard onClose={() => setShowSuperuser(false)} token={localStorage.getItem("tp_token") || ""} />}
      {forcePasswordReset && <ChangePassword forceReset onClose={() => setForcePasswordReset(false)} />}
      {showCompanySettings && <CompanySettings onClose={() => setShowCompanySettings(false)} onChangePassword={() => { setShowCompanySettings(false); setShowChangePassword(true); }} />}
      {showAgentProfile && <AgentProfile currentUser={currentUser} onClose={() => setShowAgentProfile(false)} />}
      {showIntakeLinks && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif", overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 500, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden", margin: "auto" }}>
            <div style={{ background: "#111", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>🔗 New Buyer / Seller Intake Forms</div>
              <button onClick={() => setShowIntakeLinks(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer" }}>x</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>Send these to a NEW buyer or seller (or fill them out yourself). Each submission creates a new lead in your pipeline.</p>
              {[{ label: "🏠 New Seller Intake Form", type: "seller", color: "#C0392B" }, { label: "🏡 New Buyer Intake Form", type: "buyer", color: "#1A5276" }].map(({ label, type, color }) => {
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

      {/* App-wide Help — floating ? button + ⚙️ Menu → ❓ Help */}
      {!isFreeGuest && (
        <HelpCenter
          apiBase={API}
          token={localStorage.getItem("tp_token") || ""}
          openSignal={helpSignal}
          feedbackSignal={feedbackSignal}
          supportSignal={supportSignal}
          isAdmin={isAdminUser}
          onGoals={() => openReports("goals")}
          onProfile={() => setShowAgentProfile(true)}
          onCompany={isAdminUser ? () => setShowCompanySettings(true) : null}
          onRestartTour={restartTour}
          onTour={() => { setView("dashboard"); setShowTour(true); }}
        />
      )}

      {/* First-time welcome walkthrough — hides while a target screen or the tour is open so the user can act */}
      {onboard.active && !isFreeGuest && !showTour && !showAgentProfile && !showCompanySettings && !showReports && (
        <OnboardingGuide
          steps={onboardSteps}
          doneKeys={onboard.done}
          onTakeMeThere={onboardTakeMeThere}
          onStartTour={onboardStartTour}
          onDismiss={() => persistOnboard(false, onboard.done, { dismissed: true })}
          onFinish={() => persistOnboard(false, onboard.done, { finished: true })}
        />
      )}

      {/* 🎬 App Tour — from onboarding step 4 or Help Center */}
      {showTour && (
        <SpotlightTour
          onClose={() => setShowTour(false)}
          onCreateFirst={() => { setShowTour(false); setView("new"); }}
        />
      )}
    </Suspense>
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

  // Legal consent gate — block the app until the user accepts the current Terms
  // of Service / Privacy Policy / AI disclaimer. Shows for anyone whose stored
  // acceptance is missing or stale (termsAccepted !== true). Skipped only while a
  // forced password reset is pending (handled above).
  if (authUser.termsAccepted !== true) {
    return <LegalConsentGate onAccepted={(version) => {
      const updated = { ...authUser, termsAccepted: true, termsAcceptedVersion: version || authUser.termsCurrentVersion };
      localStorage.setItem("tp_user", JSON.stringify(updated));
      setAuthUser(updated);
    }} />;
  }

  if (authUser.role === "client") {
    return (
      <Suspense fallback={<LazyLoading />}>
        <ClientPortal user={authUser} onLogout={() => {
          localStorage.removeItem("tp_token");
          localStorage.removeItem("tp_user");
          setAuthUser(null);
        }} />
        <FaqHelpButton apiBase={API} token={localStorage.getItem("tp_token") || ""} />
      </Suspense>
    );
  }

  // Transaction coordinators get the SAME agent app, in coordinator mode: scoped
  // to the deals they're invited to, agent financials hidden, agent-sales tools
  // hidden. (Was a separate slim portal; Carlos wants the full app experience.)
  return (
    <>
      <MainApp currentUser={authUser} coordinatorMode={authUser.role === "tc"} onLogout={() => {
        localStorage.removeItem("tp_token");
        localStorage.removeItem("tp_user");
        setAuthUser(null);
      }} />
      {/* HelpCenter (floating ? + ⚙️ Menu → ❓ Help) is mounted inside MainApp. */}
    </>
  );
}

export default AuthGate;
// deploy trigger Wed Apr 22 20:35:35 EDT 2026
// redeploy Thu Apr 23 14:43:56 EDT 2026
