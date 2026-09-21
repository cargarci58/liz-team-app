import React, { useState } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// ──────────────────────────────────────────────────────────────────────────
// LEGAL CONSENT GATE
// Shown after login when the user has not accepted the CURRENT terms version.
// Blocks the app until the user ticks the box and accepts. Acceptance (version
// + timestamp) is recorded server-side via POST /auth/accept-terms.
//
// The Terms and Privacy text here is the SAME text as public/terms.html and
// public/privacy.html (keep them in sync — edit both). The AI Disclaimer also
// lives at public/ai-disclaimer.html. Bump the server's CURRENT_TERMS_VERSION
// after any material change so everyone re-accepts.
// ──────────────────────────────────────────────────────────────────────────

const EFFECTIVE_DATE = "September 21, 2026";

const TERMS_OF_SERVICE = "TERMS OF SERVICE\nEffective September 21, 2026 · TransactPro · transactagentpro.com\n\n1. ACCEPTANCE OF TERMS\n\n  By creating an account, accessing, or using TransactPro (the \"Service\"), you (\"you,\" \"User,\" \"Customer,\" or \"Brokerage\") agree to these Terms of Service (\"Terms\"). If you are using the Service on behalf of a brokerage or other organization, you represent that you have authority to bind that organization to these Terms. If you do not agree, do not use the Service.\n\n2. THE SERVICE\n\n  TransactPro is a multi-tenant software-as-a-service application for licensed real-estate professionals and brokerages. It provides transaction management, milestone tracking, party communication, document storage, AI-assisted data extraction, and related workflow tools. The Service does not provide legal, tax, or real-estate brokerage services itself; it is a tool that brokerages use to manage their own business.\n\n3. ELIGIBILITY & ACCOUNTS\n\n      • You must be at least 18 years old and legally able to enter into a binding contract.\n\n      • You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.\n\n      • You must provide accurate, current, and complete registration information, including your brokerage name, license number, and contact details.\n\n      • You agree to notify TransactPro promptly of any unauthorized use of your account.\n\n4. SUBSCRIPTION & BILLING\n\n      • The Service is offered on a subscription basis. Plan tiers, pricing, and free-trial terms are described on the Service's pricing page or in your subscription agreement.\n\n      • Subscriptions automatically renew until cancelled. You may cancel at any time through your account settings; cancellation takes effect at the end of the current billing period.\n\n      • Fees are non-refundable except where required by law.\n\n      • TransactPro reserves the right to change subscription fees on 30 days' written notice.\n\n5. ACCEPTABLE USE\n\n  You agree NOT to use the Service to:\n\n      • Violate any applicable law, regulation, or third-party right (including real-estate licensing laws, fair-housing laws, anti-discrimination laws, anti-spam laws, and intellectual-property laws).\n\n      • Upload or share content that is illegal, fraudulent, defamatory, obscene, harassing, or that you do not have the right to share.\n\n      • Use the Service to send unsolicited marketing communications to consumers who have not opted in.\n\n      • Reverse-engineer, decompile, scrape, or attempt to extract source code or training data from the Service.\n\n      • Use the Service to compete with TransactPro or build a competing product.\n\n      • Interfere with or disrupt the Service's infrastructure or other users' access.\n\n      • Misrepresent your identity, license status, or affiliation.\n\n6. CUSTOMER DATA\n\n      • You retain all rights to data, documents, and content you upload or generate through the Service (\"Customer Data\").\n\n      • You grant TransactPro a limited, non-exclusive license to host, process, transmit, and display Customer Data solely to operate and improve the Service for you.\n\n      • You are solely responsible for the accuracy, legality, and appropriateness of Customer Data, and for obtaining any consents required from the parties whose information you upload (clients, co-op agents, lenders, etc.).\n\n      • You acknowledge that real-estate transaction data may include sensitive personal information (names, addresses, phone numbers, email addresses, financial information, and in some cases Social Security or tax-identification numbers). You agree to handle such data in compliance with applicable privacy laws (including GDPR, CCPA, and state-level privacy laws as applicable).\n\n7. AI FEATURES\n\n  Some features (Contract Auto-Intake, receipt OCR, CMA comp extraction, pre-approval extraction) use third-party AI models to process documents you upload. You acknowledge that:\n\n      • AI extractions are best-effort and may contain errors. You are responsible for reviewing and verifying all AI-extracted data before relying on it for legal, financial, or business decisions.\n\n      • Uploaded documents are processed by Anthropic's Claude AI API. TransactPro does not use Customer Data to train AI models.\n\n8. INTELLECTUAL PROPERTY\n\n  TransactPro and its software, design, branding, and content are owned by TransactPro and protected by intellectual-property laws. These Terms grant you only a limited, revocable, non-transferable right to use the Service. No other rights are granted.\n\n9. THIRD-PARTY SERVICES\n\n  The Service relies on third-party providers including (but not limited to) Anthropic (AI), SendGrid (email delivery), Twilio (SMS), Cloudflare R2 (object storage), Railway (hosting), and Netlify (CDN/hosting). Your use of the Service is also subject to those providers' terms where applicable.\n\n9A. TEXT MESSAGING (SMS) TERMS\n\n  If you provide your mobile number and opt in, your real estate agent and their brokerage may send you transaction-related text messages through the Service (delivered via Twilio). These include appointment and milestone reminders, status updates on your transaction, document requests, and replies to messages you send. We do not send marketing or promotional text messages through this program, and consent to receive texts is never a condition of any purchase or service.\n\n      • How you opt in: you enter your mobile number and check an unchecked SMS-consent box on your agent's intake form (for example the buyer or seller intake form), or provide your number directly to your agent. The consent box reads: \"I agree to receive transaction-related text messages (appointment reminders, milestone status updates, and document requests) from my real estate agent and their brokerage at the cell number provided above. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of any purchase or service.\"\n\n      • Program: messages are sent by your real estate agent and their brokerage.\n\n      • Message frequency varies based on your transaction's activity.\n\n      • Message and data rates may apply, depending on your mobile carrier and plan.\n\n      • Opt out anytime: reply STOP to any message to unsubscribe — you'll receive one confirmation and no further texts. Reply START to opt back in. Reply HELP for help.\n\n      • Your mobile information is never sold or shared with third parties or affiliates for their own marketing or promotional purposes. See our Privacy Policy for full data-handling details.\n\n      • Mobile carriers are not liable for delayed or undelivered messages.\n\n10. DISCLAIMERS\n\n  THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE,\" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY. TRANSACTPRO DOES NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.\n\n  TransactPro is not a real-estate brokerage, law firm, accounting firm, or financial advisor. Nothing in the Service constitutes legal, tax, accounting, or real-estate advice.\n\n11. LIMITATION OF LIABILITY\n\n  TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRANSACTPRO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, REVENUES, DATA, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. TRANSACTPRO'S AGGREGATE LIABILITY UNDER THESE TERMS WILL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.\n\n12. INDEMNIFICATION\n\n  You agree to indemnify and hold harmless TransactPro and its affiliates, officers, and employees from any claims, damages, or expenses (including reasonable attorneys' fees) arising from (a) your violation of these Terms, (b) your Customer Data, or (c) your violation of applicable law or third-party rights.\n\n13. TERMINATION\n\n  You may terminate your account at any time. TransactPro may suspend or terminate your access immediately if you violate these Terms or for non-payment. Upon termination, your right to use the Service ends and TransactPro may delete your account and Customer Data after a reasonable retention period.\n\n14. GOVERNING LAW & DISPUTES\n\n  These Terms are governed by the laws of the State of Florida, USA, without regard to conflict-of-laws principles. Any dispute will be resolved in the state or federal courts located in Orange County, Florida, and you consent to the personal jurisdiction of those courts.\n\n15. CHANGES TO THESE TERMS\n\n  TransactPro may update these Terms from time to time. Material changes will be communicated by email or through the Service. Continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.\n\n16. CONTACT\n\n  Questions about these Terms? Email hello@transactagentpro.com.";

const PRIVACY_POLICY = "PRIVACY POLICY\nEffective September 21, 2026 · TransactPro · transactagentpro.com\n\n  TransactPro (\"we,\" \"our,\" or \"us\") provides software-as-a-service transaction-management tools to real-estate brokerages and agents. This Privacy Policy explains what personal information we collect, how we use it, who we share it with, and the rights you have over your data.\n\n1. WHO'S COVERED BY THIS POLICY\n\n      • Brokerage admins and agents (\"Users\") who create accounts to use the Service.\n\n      • Clients and counterparties (\"Parties\") whose information Users add to transactions (buyers, sellers, co-op agents, lenders, title agents, inspectors, etc.).\n\n      • Visitors to public pages on our website.\n\n2. WHAT WE COLLECT\n\n      \n        • Account info — Name, email, phone, role, password hash, license number, brokerage affiliation\n\n        • Brokerage info — Business name, DBA, address, EIN, MLS broker ID, logo, brand colors\n\n        • Transaction data — Property addresses, contract prices, dates, party contact info, milestones, documents you upload, chat messages between you and parties\n\n        • Documents — Contracts, addenda, disclosures, receipts, pre-approval letters, IDs — whatever you choose to upload\n\n        • Communications — Email + SMS messages sent through the Service, in-app chat history\n\n        • Usage data — Pages visited, features used, error logs, IP address, browser type\n\n        • Cookies / local storage — Session tokens, UI preferences (sort order, view mode), test-plan progress\n\n  We do not knowingly collect data from anyone under 13 years old. If we learn we have collected such data, we will delete it.\n\n3. HOW WE USE IT\n\n      • To provide and maintain the Service: authenticate your account, save your transactions, send notifications you've requested.\n\n      • To send transactional emails and SMS — welcome emails to parties you've added, milestone alerts, password resets, chat replies, daily call reminders.\n\n      • To process documents with AI: receipts (OCR), comps (CMA extraction), pre-approval letters, contracts (auto-intake). Documents are processed by Anthropic's Claude AI. We do not allow third parties to train models on your data.\n\n      • To improve the Service: aggregate usage analytics, error monitoring, bug-fix prioritization.\n\n      • To comply with legal obligations (subpoenas, valid law-enforcement requests, tax reporting where applicable).\n\n4. WHO WE SHARE WITH\n\n  We share data only with the third-party services required to operate the Service:\n\n      \n        • Anthropic (Claude AI) — Processing documents and receipts for AI extraction\n\n        • SendGrid (Twilio) — Email delivery\n\n        • Twilio — SMS delivery\n\n        • Cloudflare R2 — Object storage for uploaded documents\n\n        • Railway — Application hosting + database\n\n        • Netlify — Frontend hosting + CDN\n\n        • Stripe — Payment processing (if applicable to your plan)\n\n  We do not sell personal data. We do not share data for third-party advertising. No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.\n\n  Multi-tenancy: Each brokerage's data is isolated. Users from one brokerage cannot see another brokerage's transactions, parties, documents, or messages. Tenant isolation is enforced at the database query level.\n\n5. HOW LONG WE KEEP IT\n\n      • Account data: while your account is active, plus up to 24 months after termination unless we are required to retain it longer for legal or tax reasons.\n\n      • Documents and transaction records: retained while your account is active. You may delete individual documents at any time. After account termination, documents are retained for 90 days then permanently deleted (unless legal hold applies).\n\n      • Logs and analytics: 90 days.\n\n6. YOUR RIGHTS\n\n  Depending on where you live, you may have rights under privacy laws (such as GDPR if in the EU/UK, CCPA if in California, or various state laws). These can include:\n\n      • Access: Request a copy of the personal information we hold about you.\n\n      • Correction: Ask us to fix inaccurate data.\n\n      • Deletion: Ask us to delete your data, subject to legal-retention requirements.\n\n      • Portability: Request your data in a machine-readable format.\n\n      • Objection / Restriction: Object to certain processing or ask us to restrict it.\n\n      • Withdraw consent: Where processing relies on your consent, you may withdraw it.\n\n      • Non-discrimination (CCPA): We won't deny service or charge different prices for exercising privacy rights.\n\n  To exercise any of these rights, email privacy@transactagentpro.com. We will respond within 30 days.\n\n7. SECURITY\n\n      • Passwords are hashed with bcrypt.\n\n      • All API and frontend traffic is encrypted in transit (TLS/HTTPS).\n\n      • Authentication uses signed JWT tokens with limited lifetime.\n\n      • Login endpoint is rate-limited to deter brute-force attempts.\n\n      • Tenant isolation is enforced server-side — clients cannot bypass it.\n\n      • Sensitive request errors do not expose stack traces.\n\n      • Despite reasonable measures, no system is 100% secure. You're responsible for keeping your password confidential and notifying us of any compromise.\n\n8. INTERNATIONAL TRANSFERS\n\n  The Service is hosted in the United States. If you access it from outside the U.S., your data will be transferred to and processed in the U.S. By using the Service, you consent to this transfer.\n\n9. TEXT MESSAGING (SMS) PROGRAM\n\n  If you provide your mobile number and opt in, your real estate agent and their brokerage may send you transaction-related text messages through the Service (delivered via Twilio). These include appointment and milestone reminders, status updates on your transaction, document requests, and replies to messages you send. We do not send marketing or promotional text messages through this program.\n\n      • How you opt in: you provide your mobile number and check an SMS-consent box during account setup in the client portal, or provide your number directly to your agent. The consent box reads: \"I agree to receive transaction-related text messages (reminders, status updates, and document requests) from my agent and brokerage at the number provided. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help.\"\n\n      • No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.\n\n      • Message frequency varies based on your transaction's activity.\n\n      • Message and data rates may apply, depending on your mobile carrier and plan.\n\n      • Opt out anytime: reply STOP to any message to unsubscribe — you'll receive one confirmation and no further texts. Reply START to opt back in.\n\n      • Need help? reply HELP, contact your agent, or email privacy@transactagentpro.com.\n\n      • Mobile carriers are not liable for delayed or undelivered messages.\n\n10. CHANGES TO THIS POLICY\n\n  We may update this Privacy Policy from time to time. The \"Last updated\" date at the top reflects when. Material changes will be communicated by email or through the Service.\n\n11. CONTACT\n\n  Questions, requests, or complaints? Email privacy@transactagentpro.com.";

const AI_DISCLAIMER = "AI-ASSISTED FEATURES DISCLAIMER\nEffective September 21, 2026 · TransactPro · transactagentpro.com\n\nTransactPro includes features that use artificial intelligence (\"AI Features\"). This Disclaimer explains what they do, what they do not do, and what you agree to when you use them. It is part of the Terms of Service.\n\n1. WHAT THE AI FEATURES DO\nAI Features read, summarize, extract, draft, and suggest. Examples include: reading an uploaded contract and proposing dates, prices, deposits, and party details; reading a received offer; extracting dates from an addendum; drafting emails, reminders, updates, and scripts in your name; suggesting a milestone update from a reply; the nightly Deal Doctor check-up; sorting bank-statement lines into expense categories; extracting comparable-sale data for a CMA; estimating a contact's likelihood to move; and answering questions through the in-app assistant. Documents and text you provide are processed by third-party AI models (currently Anthropic's Claude) under contractual terms that prohibit using your data to train their models.\n\n2. AI OUTPUT IS A DRAFT, NOT A DECISION\nAI output can be wrong, incomplete, out of date, or misleading — including a misread date, a wrong dollar amount, a missed contingency, an incorrect party, or a confidently stated error. Every AI extraction, draft, estimate, and suggestion is presented to you for review BEFORE it is saved, sent, or relied upon. You are solely responsible for reviewing and verifying AI output against the source documents and for every action you take based on it. If the AI's reading of a contract differs from the contract, the contract controls.\n\n3. NOTHING HERE IS PROFESSIONAL ADVICE\nAI Features do not provide legal, tax, accounting, financial, appraisal, lending, insurance, or real-estate brokerage advice. A net sheet is an estimate, not a closing statement. A CMA or \"likely to move\" score is a statistical aid, not an appraisal or a guarantee. Deal Doctor risk levels and suggested moves are suggestions, not instructions. Consult the appropriate licensed professional for any decision that requires one.\n\n4. YOUR PROFESSIONAL OBLIGATIONS ARE UNCHANGED\nYou remain responsible for complying with all laws and rules that govern your license and your business, including Florida Chapter 475, FREC rules, your MLS rules, fair-housing laws, advertising rules, and your brokerage's policies. AI-drafted communications are sent in your name and are your communications. You must read them before they go out, and you may not use AI Features to generate content that is discriminatory, deceptive, or otherwise unlawful.\n\n5. ACCURACY, AVAILABILITY, AND CHANGES\nAI Features are provided \"as is\" and \"as available.\" We do not warrant that AI output will be accurate, complete, timely, or fit for any particular purpose, and we may change, suspend, or remove AI Features, or change the models behind them, at any time. Our liability for AI Features is limited as set out in the Terms of Service.\n\n6. HOW YOUR DATA IS HANDLED\nContent sent to AI models is used only to produce the output you requested. We do not sell it and do not permit AI providers to train on it. Processing is described in the Privacy Policy. Do not upload documents you are not authorized to share.\n\n7. HUMAN IN THE LOOP\nEvery consequential action the AI proposes — sending a message, changing a date, completing a step, filing a document — requires your confirmation. If you ever see the app act on AI output without asking you first, report it to support@transactagentpro.com.\n\nBy accepting the Terms of Service you acknowledge that you have read and understood this Disclaimer.\n";

const DOCS = [
  { key: "tos", label: "Terms of Service", body: TERMS_OF_SERVICE },
  { key: "privacy", label: "Privacy Policy", body: PRIVACY_POLICY },
  { key: "ai", label: "AI Disclaimer", body: AI_DISCLAIMER },
];

// Standalone viewer (also exportable for a Help/footer link).
export function LegalDocViewer({ initial = "tos", onClose }) {
  const [tab, setTab] = useState(initial);
  const doc = DOCS.find(d => d.key === tab) || DOCS[0];
  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {DOCS.map(d => (
            <button key={d.key} onClick={() => setTab(d.key)}
              style={d.key === tab ? tabActive : tabBtn}>{d.label}</button>
          ))}
          {onClose && <button onClick={onClose} style={{ ...tabBtn, marginLeft: "auto" }}>✕ Close</button>}
        </div>
        <pre style={docText}>{doc.body}</pre>
      </div>
    </div>
  );
}

// The blocking gate.
export default function LegalConsentGate({ onAccepted }) {
  const [checked, setChecked] = useState(false);
  const [viewing, setViewing] = useState(null); // doc key or null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    if (!checked || saving) return;
    setSaving(true); setError("");
    try {
      const token = localStorage.getItem("tp_token") || "";
      const res = await fetch(API + "/auth/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      });
      if (!res.ok) { setError("Could not save your acceptance. Please try again."); setSaving(false); return; }
      const data = await res.json().catch(() => ({}));
      onAccepted(data.version);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  if (viewing) return <LegalDocViewer initial={viewing} onClose={() => setViewing(null)} />;

  return (
    <div style={overlay}>
      <div style={{ ...card, maxWidth: 540 }}>
        <h2 style={{ margin: "0 0 6px", color: "#1a2332", fontSize: 22 }}>Before you start</h2>
        <p style={{ color: "#475569", lineHeight: 1.55, marginTop: 0 }}>
          Please review and accept the following to continue. By accepting, you
          confirm you have permission to contact the people you add to your deals
          and that you will review any AI-drafted content before relying on it.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
          {DOCS.map(d => (
            <button key={d.key} onClick={() => setViewing(d.key)} style={linkRow}>
              <span>📄 {d.label}</span>
              <span style={{ color: "#b91c2f", fontWeight: 600 }}>Read →</span>
            </button>
          ))}
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", color: "#1a2332", lineHeight: 1.45 }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
          <span>I have read and agree to the <strong>Terms of Service</strong>, <strong>Privacy Policy</strong>, and <strong>AI Disclaimer</strong>.</span>
        </label>

        {error && <p style={{ color: "#b91c2f", marginTop: 10 }}>{error}</p>}

        <button onClick={accept} disabled={!checked || saving}
          style={{ ...acceptBtn, opacity: (!checked || saving) ? 0.5 : 1, cursor: (!checked || saving) ? "not-allowed" : "pointer" }}>
          {saving ? "Saving…" : "Agree & Continue"}
        </button>
      </div>
    </div>
  );
}

// ─── styles (centered, scrollable per app modal pattern) ───
const overlay = {
  position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 100000,
  display: "flex", alignItems: "flex-start", justifyContent: "center",
  overflowY: "auto", padding: "40px 16px",
};
const card = {
  background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 720,
  margin: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
};
const docText = {
  whiteSpace: "pre-wrap", fontFamily: "ui-monospace,Menlo,monospace", fontSize: 13,
  color: "#1a2332", lineHeight: 1.5, background: "#f8fafc", border: "1px solid #e2e8f0",
  borderRadius: 10, padding: 16, maxHeight: "60vh", overflowY: "auto", margin: 0,
};
const tabBtn = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff",
  color: "#475569", fontWeight: 600, cursor: "pointer",
};
const tabActive = { ...tabBtn, background: "#b91c2f", color: "#fff", borderColor: "#b91c2f" };
const linkRow = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc",
  color: "#1a2332", fontWeight: 600, cursor: "pointer", fontSize: 15,
};
const acceptBtn = {
  marginTop: 18, width: "100%", padding: "13px", borderRadius: 10, border: "none",
  background: "#b91c2f", color: "#fff", fontWeight: 700, fontSize: 16,
};
