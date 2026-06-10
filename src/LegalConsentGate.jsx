import React, { useState } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// ──────────────────────────────────────────────────────────────────────────
// LEGAL CONSENT GATE
// Shown after login when the user has not accepted the CURRENT terms version.
// Blocks the app until the user ticks the box and accepts. Acceptance (version
// + timestamp) is recorded server-side via POST /auth/accept-terms.
//
// ⚠️  ALL DOCUMENT TEXT BELOW IS PLACEHOLDER for your attorney to replace.
//     Search for "[[PLACEHOLDER" to find every spot that needs lawyer review.
//     Effective date and version are driven by the backend CURRENT_TERMS_VERSION.
// ──────────────────────────────────────────────────────────────────────────

const EFFECTIVE_DATE = "June 10, 2026";

// ─── PLACEHOLDER LEGAL DOCUMENTS ───────────────────────────────────────────
const TERMS_OF_SERVICE = `TERMS OF SERVICE  —  [[PLACEHOLDER — attorney to replace entire document]]
Effective: ${EFFECTIVE_DATE}

1. ACCEPTANCE OF TERMS
By creating an account or using TransactPro ("the Service"), you agree to these
Terms of Service. If you do not agree, do not use the Service.

2. BETA / EARLY ACCESS — "AS IS"
The Service is provided on a beta, early-access basis. IT IS PROVIDED "AS IS" AND
"AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. You use it at
your own risk and should not rely on it as your sole system of record for any
transaction. [[PLACEHOLDER — attorney to confirm beta/warranty disclaimer]]

3. YOU ARE THE REAL ESTATE PROFESSIONAL OF RECORD
The Service is a transaction-coordination tool. It does not provide real estate
brokerage, legal, tax, appraisal, or financial advice. You are solely responsible
for compliance with Florida Statutes Chapter 475, FREC rules, all required agency
and property disclosures, and the supervision of your brokerage. AI-assisted
content (CMA values, document drafts, scripts, suggestions) is a starting point
only and must be independently reviewed before use. [[PLACEHOLDER — attorney]]

4. YOUR CONTACTS, CONSENT & MESSAGING
You represent and warrant that you have obtained all legally required consent
before adding any person's email or phone number and before the Service sends
them email or text messages on your behalf, including prior express written
consent where required by the Florida Telephone Solicitation Act (Fla. Stat.
§ 501.059), the federal TCPA, and CAN-SPAM. You are the sender/initiator of those
communications and accept responsibility for them. [[PLACEHOLDER — attorney]]

5. DATA & PRIVACY
Your use of data is also governed by our Privacy Policy. As between you and us,
you are the controller of the personal information of your clients and contacts
that you enter; we process it to provide the Service. [[PLACEHOLDER — attorney]]

6. LIMITATION OF LIABILITY
TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR ANY INDIRECT,
INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS,
LOST DATA, OR MISSED DEADLINES, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL
LIABILITY IS LIMITED TO THE AMOUNT YOU PAID US IN THE PRIOR 12 MONTHS.
[[PLACEHOLDER — attorney to set cap and carve-outs]]

7. INDEMNIFICATION, TERMINATION, GOVERNING LAW
[[PLACEHOLDER — attorney. Suggested governing law: State of Florida.]]

8. CHANGES
We may update these Terms. Material changes will re-prompt you to accept on next
login. [[PLACEHOLDER — attorney]]`;

const PRIVACY_POLICY = `PRIVACY POLICY  —  [[PLACEHOLDER — attorney to replace entire document]]
Effective: ${EFFECTIVE_DATE}

1. WHAT WE COLLECT
Account info (name, email, phone, brokerage), transaction and contact data you
enter, documents you upload, and usage/log data. [[PLACEHOLDER — attorney]]

2. HOW WE USE IT
To operate the Service: coordinate transactions, send reminders/updates to the
parties you designate, and improve the product. [[PLACEHOLDER — attorney]]

3. SUB-PROCESSORS / SERVICE PROVIDERS
We share data with vendors strictly to run the Service, including (current list):
 • SendGrid (Twilio) — outbound email
 • Twilio — outbound SMS text messaging
 • Cloudflare R2 — document storage
 • Railway — application hosting / database
 • Anthropic (Claude) — AI-assisted content features
[[PLACEHOLDER — attorney to confirm vendor list, DPAs, and any data-transfer terms]]

4. TEXT MESSAGING / SMS
Recipients can opt out of texts at any time by replying STOP; we honor opt-outs
across all messaging. Message and data rates may apply. [[PLACEHOLDER — attorney]]

5. EMAIL
Automated emails include an unsubscribe mechanism. [[PLACEHOLDER — attorney]]

6. DATA RETENTION, SECURITY, YOUR RIGHTS
[[PLACEHOLDER — attorney. Address Florida Digital Bill of Rights applicability,
retention periods, access/deletion requests, and breach notification.]]

7. CONTACT
[[PLACEHOLDER — attorney to insert business legal name + mailing address +
privacy contact email.]]`;

const AI_DISCLAIMER = `AI-ASSISTED FEATURES DISCLAIMER  —  [[PLACEHOLDER — attorney to review]]
Effective: ${EFFECTIVE_DATE}

Some features use artificial intelligence to generate content, including but not
limited to comparative market analysis (CMA) values and pricing suggestions,
document and email drafts, follow-up scripts, and task suggestions.

THIS AI-GENERATED CONTENT IS PROVIDED FOR CONVENIENCE ONLY. IT IS NOT REAL ESTATE,
LEGAL, TAX, APPRAISAL, OR FINANCIAL ADVICE, MAY BE INACCURATE OR INCOMPLETE, AND
MUST BE INDEPENDENTLY VERIFIED BY A QUALIFIED PROFESSIONAL BEFORE YOU RELY ON IT
OR SHARE IT WITH A CLIENT OR THIRD PARTY. You remain solely responsible for any
content you send or decisions you make. Pricing outputs are estimates and are not
appraisals. [[PLACEHOLDER — attorney]]`;

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
          TransactPro is in <strong>beta</strong>. Please review and accept the
          following to continue. By accepting, you confirm you have permission to
          contact the people you add and that you will independently verify any
          AI-generated content before relying on it.
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
