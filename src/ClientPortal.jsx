import React, { useState, useEffect, useRef } from "react";
import BuyerCalculator from "./components/BuyerCalculator";
import SellerCalculator from "./components/SellerCalculator";
import TransactionChat from "./TransactionChat";
// Liability-critical client-facing claim logic lives in one tested module.
import { deriveStage, strongClaimFor } from "./portalClaims";
import { flTaxRate, deedDocStampPer100 } from "./lib/flTaxRates";

const API = "https://liz-team-server-api-production.up.railway.app";

// FL seller net-sheet estimate for ONE offer — same math as the full Seller
// Net Proceeds calculator, grounded in the offer's price + closing date and the
// deal's real commission/county where known. Defaults to FL norms otherwise so
// the seller always sees a ballpark. Estimate only; title co. issues the official sheet.
function estimateSellerNet(offer, context) {
  const price = Number(offer.contractPrice) || 0;
  if (price <= 0) return null;
  const county = context?.county || undefined;
  const commissionPct = (context?.commissionPct != null) ? Number(context.commissionPct) : 6; // FL norm
  const commission = price * (Math.max(0, commissionPct) / 100);
  const docStamps = Math.ceil(price / 100) * deedDocStampPer100(county);
  const titleIns = price <= 100000 ? price * 0.00575 : 100000 * 0.00575 + (price - 100000) * 0.00500;
  const recording = 30;
  const titleFees = 575 + 400 + 499; // settlement + search/lien + processing (calculator defaults)
  // Prorated taxes (paid in arrears) — seller credits buyer Jan 1 → closing.
  let proratedTaxes = 0;
  if (offer.closingDate) {
    const cd = new Date(offer.closingDate + (offer.closingDate.length <= 10 ? "T00:00:00" : ""));
    if (!isNaN(cd)) {
      const daysOwned = Math.max(0, Math.round((cd - new Date(cd.getFullYear(), 0, 1)) / 86400000));
      const rate = flTaxRate(undefined, county).rate;
      proratedTaxes = price * (rate / 100) * (daysOwned / 365);
    }
  }
  const totalCosts = commission + docStamps + titleIns + recording + titleFees + proratedTaxes;
  return {
    price, commission, commissionPct, docStamps, titleIns, recording, titleFees, proratedTaxes,
    totalCosts,
    netProceeds: price - totalCosts,
    commissionKnown: context?.commissionPct != null,
    countyKnown: !!context?.county,
  };
}

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

// Plain-English, client-facing milestone labels (+ why it matters). A seller
// should never see a cryptic internal name like "Keys / Remotes / Garage
// Openers" with no context, and should never be handed BUYER tasks.
const CLIENT_MILESTONE_COPY = [
  { re: /utilities|move-?out/i, label: "Plan your utilities & move-out", why: "As closing nears, arrange for your power, water, and internet to stop or transfer, and have the home cleared out." },
  { re: /keys|remotes|garage|openers|fobs?/i, label: "Gather keys, remotes & garage openers", why: "Bring all house keys, garage remotes, mailbox keys, and gate fobs to closing so the new owner can be handed everything." },
  { re: /home ?warranty/i, label: "Home warranty", why: "Optional coverage — your agent will tell you if it's part of your deal." },
  { re: /final walk/i, label: "Final walk-through", why: "The buyer takes one last look before closing to confirm the home's condition." },
  { re: /closing disclosure|cd review|settlement statement|alta/i, label: "Review your closing figures", why: "You'll get a settlement statement with your final numbers — review it and ask your agent about anything unclear." },
  { re: /lead-?based paint|lead paint/i, label: "Lead-paint disclosure", why: "A required form for homes built before 1978." },
  { re: /property disclosure|spd/i, label: "Property disclosure", why: "The form describing the home's condition and history for the buyer." },
  { re: /survey/i, label: "Property survey", why: "Confirms the property lines — usually ordered through the title company." },
  { re: /hoa|estoppel/i, label: "HOA documents", why: "Your HOA provides the estoppel/financial info needed to close." },
  { re: /appraisal/i, label: "Appraisal", why: "" },
  { re: /inspection/i, label: "Home inspection", why: "" },
  { re: /financing|loan/i, label: "Buyer's financing", why: "" },
  { re: /title|lien/i, label: "Title work", why: "" },
];
function humanizeForClient(name) {
  const hit = CLIENT_MILESTONE_COPY.find(e => e.re.test(name || ""));
  if (hit) return { label: hit.label, why: hit.why };
  const clean = String(name || "this step").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return { label: clean, why: "" };
}

// Forward-looking, conversational phrasing for the "what's coming up" list — so a
// step like "Closing Scheduled" reads as something STILL TO HAPPEN, never as if
// it's already done. Tense matters: the seller shouldn't think it's scheduled.
const COMING_UP_COPY = [
  { re: /financing|loan/i, text: "The buyer's lender finalizes their loan" },
  { re: /clear to close/i, text: "The lender gives the all-clear to close" },
  { re: /closing scheduled|schedule closing/i, text: "We set your closing day and time" },
  { re: /cd|closing disclosure|settlement statement|alta/i, text: "You'll review your final closing numbers" },
  { re: /final walk/i, text: "The buyer does a final walk-through" },
  { re: /appraisal/i, text: "The appraisal is reviewed" },
  { re: /title|lien|estoppel/i, text: "The title company prepares everything for closing" },
  { re: /inspection|repair/i, text: "The home inspection wraps up" },
  { re: /survey/i, text: "The property survey is completed" },
  { re: /insurance/i, text: "Insurance is lined up for closing" },
  { re: /walk|possession|keys/i, text: "We hand over the keys at closing" },
];
function comingUpLabel(name) {
  const hit = COMING_UP_COPY.find(e => e.re.test(name || ""));
  if (hit) return hit.text;
  return humanizeForClient(name).label;
}

// STAGE_ORDER + deriveStage now live in ./portalClaims (tested, build-gated).

// ── PROGRESS TRACKER ─────────────────────────────────────────
function ProgressTracker({ status, transactionType }) {
  const isSeller = transactionType && transactionType.includes("Seller");

  const sellerSteps = [
    { key: "Active", label: "Listed", icon: "🏠" },
    { key: "Under Contract", label: "Contract", icon: "✍️" },
    { key: "Inspection", label: "Inspection", icon: "🔍" },
    { key: "Appraisal", label: "Financing", icon: "🏦" },
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
function LatestUpdateCard({ tx, agentName, stage }) {
  // Driven by the REAL milestone progress (stage), not the coarse DB status —
  // so a deal that's past appraisal never reads "you're under contract."
  const isBuyer = tx.transactionType && tx.transactionType.includes("Buyer");
  const getUpdateMessage = () => {
    if (tx.status === "Closed") return isBuyer
      ? "Congratulations — you're officially a homeowner! 🎉 Thank you for letting us be part of it."
      : "Congratulations — your home is sold! 🎉 Thank you for trusting us with this.";
    const eff = (stage && stage.effectiveStatus) || tx.status;
    if (eff === "Clear to Close") return "Great news — the loan is clear to close! We're setting up your closing day now. You're almost there. 🎉";
    if (eff === "Appraisal") return "The appraisal came back, and the buyer's lender is finalizing their loan — the last big step before we head to the closing table.";
    if (eff === "Inspection") return "We're through the inspection stage and moving toward closing. Your agent is keeping everything on track.";
    if (eff === "Under Contract") return "You're under contract! Your agent is working through the early contract steps to keep everything on schedule.";
    return "Your transaction is moving forward — your agent is working behind the scenes and will reach out with any updates.";
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

// ── CLOSING COUNTDOWN + MOVING CHECKLIST ──────────────────────
// Appears in the final stretch (closing ≤30 days, not yet Closed). A big,
// reassuring countdown + a plain-English checklist so a non-tech buyer/seller
// knows exactly what to do before closing day — led by the wire-fraud warning,
// the single most important thing to protect them.
function ClosingCountdownCard({ tx }) {
  const days = daysUntil(tx.closingDate);
  if (tx.status === "Closed") return null;
  if (days === null || days < 0 || days > 30) return null;
  const isBuyer = tx.transactionType && tx.transactionType.includes("Buyer");
  const headline = days === 0 ? "Closing is today! 🎉" : days === 1 ? "1 day to closing" : `${days} days to closing`;
  const items = isBuyer ? [
    { icon: "🛡️", text: "Confirm your homeowner's insurance is active starting on closing day." },
    { icon: "👀", text: "Do your final walk-through with your agent to make sure the home is in the agreed condition." },
    { icon: "💡", text: "Set up utilities in your name (electric, water, internet) to start on closing day." },
    { icon: "🪪", text: "Bring a government-issued photo ID to closing." },
    { icon: "📦", text: "Plan your move and forward your mail to the new address." },
  ] : [
    { icon: "📦", text: "Be fully packed and moved out by closing day." },
    { icon: "💡", text: "Schedule your utilities to stop (or transfer) the day after closing." },
    { icon: "🔑", text: "Gather all keys, garage remotes, mailbox keys, and appliance manuals to hand over." },
    { icon: "🪪", text: "Bring a government-issued photo ID to closing." },
    { icon: "📫", text: "Forward your mail to your new address." },
  ];
  return (
    <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: "4px solid " + C.red }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>CLOSING COUNTDOWN</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.black, marginBottom: 4 }}>{headline}</div>
      <div style={{ fontSize: 13, color: C.gray, marginBottom: 14 }}>{formatDate(tx.closingDate)} — here's how to be ready.</div>

      {/* Wire-fraud warning — the most important thing for them to see. */}
      <div style={{ background: "#FDEDEC", border: "1px solid #F1948A", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#922B21", marginBottom: 4 }}>⚠️ Protect your money from wire fraud</div>
        <div style={{ fontSize: 13, color: "#922B21", lineHeight: 1.6 }}>
          Before sending ANY money, call the title company using a phone number you looked up yourself — never a number or wiring instructions from an email. Wiring instructions in email can be faked. When in doubt, call your agent first.
        </div>
      </div>

      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingBottom: 10, marginBottom: 10, borderBottom: i < items.length - 1 ? "1px solid " + C.lightGray : "none" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{it.icon}</span>
          <span style={{ fontSize: 14, color: C.black, lineHeight: 1.5 }}>{it.text}</span>
        </div>
      ))}
      <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>Questions about any of these? Just message your agent — that's what they're here for.</div>
    </div>
  );
}

// ── AGENT CARD — "this is YOUR agent" (branding + one-tap reach) ──
function AgentCard({ name, title, brokerage, phone, email, photo, brand }) {
  if (!name) return null;
  const initials = name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      {photo
        ? <img src={photo} alt={name} style={{ width: 58, height: 58, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${brand}` }} />
        : <div style={{ width: 58, height: 58, borderRadius: "50%", background: brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20, flexShrink: 0 }}>{initials}</div>}
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Your Agent</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#111" }}>{name}</div>
        <div style={{ fontSize: 12.5, color: "#666" }}>{[title, brokerage].filter(Boolean).join(" · ")}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {phone && <a href={"tel:" + phone} style={{ background: brand, color: "#fff", textDecoration: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700 }}>📞 Call</a>}
        {phone && <a href={"sms:" + phone} style={{ background: "#fff", color: brand, textDecoration: "none", border: `1.5px solid ${brand}`, borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700 }}>💬 Text</a>}
        {!phone && email && <a href={"mailto:" + email} style={{ background: brand, color: "#fff", textDecoration: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700 }}>✉️ Email</a>}
      </div>
    </div>
  );
}

// ── CELEBRATION CONFETTI (no dependency) ──────────────────────
function Confetti() {
  const colors = ["#C0392B", "#1E8449", "#B7770D", "#1A5276", "#7D3C98", "#C9A84C"];
  const pieces = Array.from({ length: 20 }, (_, i) => i);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: 16 }}>
      <style>{`@keyframes ccfall{0%{transform:translateY(-24px) rotate(0deg);opacity:1}100%{transform:translateY(240px) rotate(560deg);opacity:0}}`}</style>
      {pieces.map(i => (
        <div key={i} style={{ position: "absolute", top: -12, left: `${(i * 47) % 100}%`, width: 8, height: 13,
          background: colors[i % colors.length], borderRadius: 2,
          animation: `ccfall ${1.9 + (i % 5) * 0.3}s ${(i % 7) * 0.13}s ease-in infinite` }} />
      ))}
    </div>
  );
}

// ── JOURNEY HERO — celebratory headline + countdown (the emotional anchor) ──
function JourneyHero({ tx, stage }) {
  const days = daysUntil(tx.closingDate);
  const isBuyer = tx.transactionType && tx.transactionType.includes("Buyer");
  const eff = (stage && stage.effectiveStatus) || tx.status;
  const celebrate = eff === "Closed" || eff === "Clear to Close";
  const headline = eff === "Closed" ? (isBuyer ? "🎉 You're officially a homeowner!" : "🎉 Your home is sold — congratulations!")
    : eff === "Clear to Close" ? "🏁 You're clear to close — the finish line!"
    : days !== null && days >= 0 && days <= 45 ? (days === 0 ? "🔑 Closing is today!" : `🔑 ${days} day${days === 1 ? "" : "s"} to closing`)
    : isBuyer ? "🏡 Your home purchase is on track" : "🏡 Your home sale is on track";
  const sub = eff === "Closed" ? "Thank you for trusting us with this milestone."
    : isBuyer ? "We're handling every detail to get you to the closing table." : "We're working hard to get you sold and closed.";
  return (
    <div style={{ position: "relative", borderRadius: 16, padding: 22, marginBottom: 14, color: "#fff",
      background: celebrate ? "linear-gradient(135deg,#1E8449,#13502d)" : "linear-gradient(135deg,#1a2332,#34495e)",
      boxShadow: "0 6px 22px rgba(0,0,0,0.20)", overflow: "hidden" }}>
      {celebrate && <Confetti />}
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2, marginBottom: 6 }}>{headline}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.5 }}>{sub}</div>
        {tx.closingDate && tx.status !== "Closed" && (
          <div style={{ display: "inline-block", marginTop: 12, background: "rgba(255,255,255,0.14)", borderRadius: 20, padding: "5px 14px", fontSize: 12.5, fontWeight: 600 }}>
            📅 Closing {formatDate(tx.closingDate)}
          </div>
        )}
      </div>
    </div>
  );
}

// Warm, past-tense phrasing for completed milestones (the "wins" recap). The
// claim map (WIN_COPY) + strongClaimFor live in ./portalClaims (tested,
// build-gated). When no canned claim applies we fall back to a neutral,
// always-true humanized label — so an unknown milestone can never invent a
// false claim.
function winLabel(name) {
  return strongClaimFor(name) || humanizeForClient(name).label;
}

// ── SELLER OFFERS CARD — review pending offers & accept/decline in-portal ──
// The seller sees each offer's key terms and can record a decision. The agent
// still does the final Approve (which moves the deal Under Contract), so this is
// the seller telling their agent "yes, go with this one" — not a binding action.
function SellerOffersCard({ offers, context, headers, agentName, onDecided }) {
  const [busyId, setBusyId] = useState(null);
  const [docBusyId, setDocBusyId] = useState(null);
  const money = (v) => (v || v === 0) ? "$" + Number(v).toLocaleString() : "—";

  const viewDoc = async (offerId) => {
    setDocBusyId(offerId);
    try {
      const r = await fetch(API + "/client/offers/" + offerId + "/view-url", { headers });
      const d = await r.json();
      if (!d.success || !d.viewUrl) throw new Error(d.error || "Could not open document");
      window.open(d.viewUrl, "_blank", "noopener");
    } catch (e) { alert("Could not open the offer document: " + e.message); }
    finally { setDocBusyId(null); }
  };

  const decide = async (offerId, decision) => {
    const verb = decision === "accepted" ? "ACCEPT" : "decline";
    if (!window.confirm(`Let ${agentName || "your agent"} know you'd like to ${verb} this offer?\n\nYour agent will follow up to finalize — this notifies them of your choice.`)) return;
    setBusyId(offerId);
    try {
      const r = await fetch(API + "/client/offers/" + offerId + "/decision", {
        method: "POST", headers, body: JSON.stringify({ decision }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || "Could not save");
      onDecided && onDecided();
    } catch (e) { alert("Could not save your decision: " + e.message); }
    finally { setBusyId(null); }
  };

  return (
    <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: "2px solid " + C.warning }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.black, marginBottom: 4 }}>📥 Offers on your home ({offers.length})</div>
      <div style={{ fontSize: 13, color: C.gray, marginBottom: 14 }}>
        Review the offers below and tell {agentName || "your agent"} which one you'd like to move forward with. They'll handle the paperwork from there.
      </div>
      {offers.map((o, i) => {
        const decided = o.sellerDecision;
        return (
          <div key={o.id} style={{ border: "1px solid " + C.border, borderRadius: 12, padding: 14, marginBottom: i < offers.length - 1 ? 12 : 0, background: decided === "accepted" ? C.successBg : decided === "declined" ? "#FDEDEC" : C.white }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>Offer price</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.black, lineHeight: 1.1 }}>{money(o.contractPrice)}</div>
              </div>
              {o.buyerName && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>Buyer</div>
                  <div style={{ fontSize: 14, color: C.black, fontWeight: 700 }}>{o.buyerName}</div>
                </div>
              )}
            </div>
            {/* Clean labeled rows instead of a cramped run-on line */}
            <div style={{ borderTop: "1px solid " + C.lightGray, marginTop: 8, paddingTop: 4 }}>
              {[
                ["Financing", o.isCash ? "💵 Cash — no loan" : (o.loanType ? o.loanType + " loan" : "Financed (loan)")],
                ["Proposed closing", o.closingDate ? "📅 " + formatDate(o.closingDate) : null],
                ["Earnest money (deposit)", (o.earnestMoney || o.earnestMoney === 0) ? "🤝 " + money(o.earnestMoney) : null],
                ["Inspection period", o.inspectionPeriodDays ? "🔍 " + o.inspectionPeriodDays + " days to inspect" : null],
                ["Contingencies", [o.financingContingency && "financing", o.appraisalContingency && "appraisal"].filter(Boolean).join(", ") || (o.isCash ? "None" : null)],
              ].filter(([, v]) => v).map(([label, value], r) => (
                <div key={r} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid " + C.lightGray, fontSize: 13 }}>
                  <span style={{ color: C.gray, fontWeight: 600 }}>{label}</span>
                  <span style={{ color: C.black, fontWeight: 700, textAlign: "right" }}>{value}</span>
                </div>
              ))}
            </div>
            {o.additionalTerms && <div style={{ fontSize: 12.5, color: C.gray, marginTop: 8, fontStyle: "italic" }}>Note from buyer: “{o.additionalTerms}”</div>}
            <button onClick={() => viewDoc(o.id)} disabled={docBusyId === o.id}
              style={{ marginTop: 12, width: "100%", background: C.lightGray, color: C.black, border: "1px solid " + C.border, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {docBusyId === o.id ? "Opening…" : "📄 View the full offer document"}
            </button>
            {(() => {
              const net = estimateSellerNet(o, context);
              if (!net) return null;
              return (
                <div style={{ marginTop: 12, background: "#F0F7FB", border: "1px solid #BFDBEF", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: 0.5 }}>Estimated net proceeds at this price</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#0c4a6e", lineHeight: 1.2, margin: "2px 0 8px" }}>{money(net.netProceeds)}</div>
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#0c4a6e" }}>See how this is calculated</summary>
                    <table style={{ width: "100%", marginTop: 8, fontSize: 12.5, color: C.gray }}>
                      <tbody>
                        <tr><td style={{ padding: "3px 0" }}>Offer price</td><td style={{ textAlign: "right", fontWeight: 700, color: C.black }}>{money(net.price)}</td></tr>
                        <tr><td style={{ padding: "3px 0" }}>− Agent commission ({net.commissionPct}%)</td><td style={{ textAlign: "right", fontWeight: 600 }}>−{money(net.commission)}</td></tr>
                        <tr><td style={{ padding: "3px 0" }}>− FL doc stamps on deed</td><td style={{ textAlign: "right", fontWeight: 600 }}>−{money(net.docStamps)}</td></tr>
                        <tr><td style={{ padding: "3px 0" }}>− Owner's title insurance</td><td style={{ textAlign: "right", fontWeight: 600 }}>−{money(net.titleIns)}</td></tr>
                        <tr><td style={{ padding: "3px 0" }}>− Title & closing fees (est.)</td><td style={{ textAlign: "right", fontWeight: 600 }}>−{money(net.titleFees)}</td></tr>
                        <tr><td style={{ padding: "3px 0" }}>− Prorated property taxes</td><td style={{ textAlign: "right", fontWeight: 600 }}>−{money(net.proratedTaxes)}</td></tr>
                        <tr><td style={{ padding: "3px 0" }}>− Recording fees</td><td style={{ textAlign: "right", fontWeight: 600 }}>−{money(net.recording)}</td></tr>
                        <tr style={{ borderTop: "1px solid #BFDBEF" }}><td style={{ padding: "5px 0", fontWeight: 800, color: C.black }}>Estimated net to you</td><td style={{ textAlign: "right", fontWeight: 800, color: "#0c4a6e" }}>{money(net.netProceeds)}</td></tr>
                      </tbody>
                    </table>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 6, lineHeight: 1.4 }}>
                      Does not include your mortgage payoff{net.commissionKnown ? "" : ", and assumes a 6% commission"}. {net.countyKnown ? "" : "Tax estimate uses a statewide average. "}This is an estimate — your title company's net sheet is the official figure.
                    </div>
                  </details>
                </div>
              );
            })()}
            {/* Decision is never terminal — the seller can always accept, change
                their mind, or decline. The current choice is highlighted; the
                agent does the final binding Approve. */}
            {decided && (
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: decided === "accepted" ? C.success : C.red }}>
                {decided === "accepted" ? "✓ You've chosen this offer — your agent has been notified. You can still change your choice below." : "✕ You've declined this offer. You can change your choice below."}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => decide(o.id, "accepted")} disabled={busyId === o.id}
                style={{ flex: 1, minWidth: 130, background: decided === "accepted" ? C.success : C.white, color: decided === "accepted" ? "#fff" : C.success, border: "2px solid " + C.success, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {busyId === o.id ? "Saving…" : (decided === "accepted" ? "✓ Accepted" : "✓ Accept this offer")}
              </button>
              <button onClick={() => decide(o.id, "declined")} disabled={busyId === o.id}
                style={{ background: decided === "declined" ? C.red : C.white, color: decided === "declined" ? "#fff" : C.red, border: "2px solid " + C.red, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {decided === "declined" ? "✕ Declined" : "Decline"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── WINS CARD — "look how far we've come" (momentum) ──────────
function WinsCard({ timeline }) {
  if (!timeline || !Array.isArray(timeline.milestones)) return null;
  const meaningful = (m) => !/communication|weekly|thank|review request|compliance|reminder|set up|generate/i.test(m.name || "");
  const done = timeline.milestones.filter(m => (m.status === "Completed" || m.status === "Waived") && meaningful(m));
  if (done.length === 0) return null;
  // De-dupe by friendly label (so 3 "Appraisal..." milestones don't all read "Appraisal"),
  // keeping the most recent distinct wins.
  const seen = new Set();
  const recent = [];
  for (let i = done.length - 1; i >= 0 && recent.length < 5; i--) {
    const label = winLabel(done[i].name);
    if (seen.has(label)) continue;
    seen.add(label);
    recent.push({ ...done[i], _label: label });
  }
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
        🎉 Look how far we've come — {done.length} step{done.length === 1 ? "" : "s"} done
      </div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>Your most recent wins:</div>
      {recent.map((m, i) => (
        <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < recent.length - 1 ? "1px solid #F4F4F4" : "none" }}>
          <span style={{ color: "#1E8449", fontSize: 16, fontWeight: 800 }}>✓</span>
          <span style={{ fontSize: 14, color: "#111" }}>{m._label}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// BUYER GUIDE — loan types, credit coaching + tracker, first-time roadmap.
// All content is self-contained (no external data). Loan cards are built
// "rate-ready" so a daily-rate feed can drop into the rate slot later.
// ════════════════════════════════════════════════════════════════
const LOAN_TYPES = [
  { key: "conv", emoji: "🏦", name: "Conventional", down: "3%–20% down",
    who: "Buyers with steady income and decent credit (usually 620+).",
    how: "Not backed by the government. Put 20% down and you skip monthly mortgage insurance (PMI); less down means PMI until you reach 20% equity. The most common loan.",
    pros: ["No upfront mortgage-insurance fee", "PMI drops off at 20% equity", "Works for primary, second, or investment homes"],
    cons: ["Higher credit score needed", "PMI if under 20% down"] },
  { key: "fha", emoji: "🇺🇸", name: "FHA", down: "3.5% down",
    who: "First-time buyers or lower credit scores (often 580+).",
    how: "Backed by the Federal Housing Administration. Easier to qualify for, but you pay mortgage insurance (MIP) — usually for the life of the loan unless you refinance later.",
    pros: ["Low 3.5% down", "Forgiving on credit", "Seller can help with closing costs"],
    cons: ["Mortgage insurance for the life of the loan", "Loan limits by county", "Property must meet condition standards"] },
  { key: "va", emoji: "🎖️", name: "VA", down: "0% down",
    who: "Eligible veterans, active-duty service members, and some spouses.",
    how: "Guaranteed by the Dept. of Veterans Affairs. Zero down payment and no monthly mortgage insurance — one of the best loans available if you qualify.",
    pros: ["No down payment", "No monthly mortgage insurance", "Competitive rates"],
    cons: ["One-time VA funding fee", "Primary residence only", "Must have VA eligibility"] },
  { key: "usda", emoji: "🌾", name: "USDA Rural", down: "0% down",
    who: "Buyers in eligible rural/suburban areas under income limits.",
    how: "Backed by the U.S. Dept. of Agriculture for rural and many suburban areas. No down payment, but the home location and your income both have to qualify.",
    pros: ["No down payment", "Low mortgage-insurance cost", "Good rates"],
    cons: ["Location must be USDA-eligible", "Household income limits", "Primary residence only"] },
  { key: "jumbo", emoji: "💎", name: "Jumbo", down: "10%–20%+ down",
    who: "Buyers of higher-priced homes above the conforming loan limit.",
    how: "For loan amounts above the conventional limit. Stricter on credit, income, and reserves because the lender takes on more risk.",
    pros: ["Finances luxury / high-cost homes", "Competitive rates for strong buyers"],
    cons: ["Higher credit + cash reserves needed", "Larger down payment", "Tougher to qualify"] },
  { key: "arm", emoji: "📈", name: "Adjustable-Rate (ARM)", down: "varies",
    who: "Buyers who plan to move or refinance within a few years.",
    how: "The rate is fixed for a set period (e.g. 5 years on a 5/1 ARM), then adjusts with the market. Lower starting rate, but it can rise later.",
    pros: ["Lower initial rate", "Good if you won't keep the loan long"],
    cons: ["Rate (and payment) can rise later", "Harder to budget long-term"] },
];

function LoanTypesCard() {
  const [open, setOpen] = useState("conv");
  return (
    <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: "4px solid #1A5276" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>💰 Loan Types — What's Available</div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 4 }}>Tap any loan to learn how it works. Your lender confirms which fits you best.</div>
      <div style={{ fontSize: 11, color: "#1A5276", background: "#EAF2F8", borderRadius: 8, padding: "6px 10px", marginBottom: 12 }}>📅 Live daily rates are coming soon — for now, ask your lender for today's rate on each loan.</div>
      {LOAN_TYPES.map((l) => {
        const isOpen = open === l.key;
        return (
          <div key={l.key} style={{ borderBottom: "1px solid " + C.lightGray, paddingBottom: isOpen ? 12 : 0 }}>
            <div onClick={() => setOpen(isOpen ? "" : l.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", cursor: "pointer" }}>
              <span style={{ fontSize: 20 }}>{l.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.black }}>{l.name}</div>
                <div style={{ fontSize: 12, color: C.gray }}>{l.down}</div>
              </div>
              <span style={{ fontSize: 13, color: C.gray }}>{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && (
              <div style={{ paddingLeft: 30 }}>
                <div style={{ fontSize: 13, color: C.black, lineHeight: 1.55, marginBottom: 8 }}><b>Best for:</b> {l.who}</div>
                <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.55, marginBottom: 8 }}>{l.how}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 140px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.success, marginBottom: 3 }}>👍 PROS</div>
                    {l.pros.map((p, i) => <div key={i} style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>• {p}</div>)}
                  </div>
                  <div style={{ flex: "1 1 140px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.warning, marginBottom: 3 }}>👀 KEEP IN MIND</div>
                    {l.cons.map((p, i) => <div key={i} style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>• {p}</div>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const CREDIT_TIPS = [
  { icon: "💳", title: "Keep balances under 30% (ideally under 10%)", body: "Credit-card balance ÷ limit = your utilization. It's the fastest needle-mover. Paying a card down below 10% of its limit can jump your score in one cycle." },
  { icon: "⏰", title: "Never miss a payment", body: "Payment history is the single biggest factor. Even one 30-day late hurts. Put everything on autopay for at least the minimum." },
  { icon: "✂️", title: "Don't close old cards", body: "Older accounts help your score. Keep them open and use them once in a while so they stay active." },
  { icon: "🛑", title: "Don't open new credit while buying", body: "Each application dings your score and adds debt the lender sees. No new cards, cars, or financing until after closing." },
  { icon: "🔍", title: "Dispute errors", body: "Pull your free reports at annualcreditreport.com. Mistakes are common — disputing a wrong late payment or balance can raise your score quickly." },
  { icon: "📈", title: "Ask for a credit-limit increase", body: "A higher limit (without new spending) lowers your utilization instantly. Ask issuers you've paid on time." },
];

function CreditCoachCard({ txId }) {
  const [entries, setEntries] = useState([]);
  const [score, setScore] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const hdrs = { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") };
  useEffect(() => {
    if (!txId) return;
    fetch(API + "/client/credit/" + txId, { headers: hdrs })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.success) { setEntries(d.entries || []); const g = (d.entries || []).filter(e => e.goal_score).slice(-1)[0]; if (g) setGoal(String(g.goal_score)); } })
      .catch(() => {});
  }, [txId]);
  const latest = entries.length ? entries[entries.length - 1] : null;
  const first = entries.length ? entries[0] : null;
  const delta = latest && first && entries.length > 1 ? latest.score - first.score : null;
  const goalScore = latest?.goal_score || (goal ? parseInt(goal) : null);
  const save = async () => {
    setErr("");
    const s = parseInt(score);
    if (!(s >= 300 && s <= 850)) { setErr("Enter a score between 300 and 850."); return; }
    setSaving(true);
    try {
      const r = await fetch(API + "/client/credit/" + txId, { method: "POST", headers: hdrs, body: JSON.stringify({ score: s, goalScore: goal ? parseInt(goal) : null }) });
      const d = await r.json();
      if (d.success) { setEntries(e => [...e, d.entry]); setScore(""); }
      else setErr(d.error || "Could not save.");
    } catch { setErr("Could not save."); }
    setSaving(false);
  };
  const band = (s) => s >= 740 ? { t: "Very Good / Excellent", c: C.success } : s >= 670 ? { t: "Good", c: C.success } : s >= 580 ? { t: "Fair — room to grow", c: C.warning } : { t: "Needs work — let's build it", c: C.red };
  return (
    <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: "4px solid #1A5276" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>📊 Credit Health & Coaching</div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 12 }}>A better score = a better rate = a lower payment. Track yours here and follow the tips to raise it fast.</div>
      {latest && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: C.lightGray, borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: band(latest.score).c, lineHeight: 1 }}>{latest.score}</div>
            <div style={{ fontSize: 10, color: C.gray }}>your score</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: band(latest.score).c }}>{band(latest.score).t}</div>
            {delta !== null && <div style={{ fontSize: 12, color: delta >= 0 ? C.success : C.red }}>{delta >= 0 ? "▲ +" + delta : "▼ " + delta} since you started</div>}
            {goalScore && <div style={{ fontSize: 12, color: C.gray }}>🎯 Goal: {goalScore}{latest.score >= goalScore ? " — reached! 🎉" : " (" + (goalScore - latest.score) + " to go)"}</div>}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: entries.length ? 12 : 0 }}>
        <div>
          <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>Today's score</div>
          <input value={score} onChange={e => setScore(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="720" style={{ width: 80, fontSize: 16, padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 8 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>Goal (optional)</div>
          <input value={goal} onChange={e => setGoal(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="740" style={{ width: 80, fontSize: 16, padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 8 }} />
        </div>
        <button onClick={save} disabled={saving} style={{ background: "#1A5276", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{saving ? "Saving…" : "Log it"}</button>
      </div>
      {err && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{err}</div>}
      {entries.length > 1 && (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 50, marginBottom: 12, paddingTop: 4 }}>
          {entries.slice(-12).map((e, i) => {
            const h = Math.max(6, Math.round(((e.score - 300) / 550) * 46));
            return <div key={i} title={e.score + " · " + formatDate(e.recorded_on)} style={{ flex: 1, height: h, background: "#1A5276", borderRadius: "3px 3px 0 0", minWidth: 4 }} />;
          })}
        </div>
      )}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, margin: "4px 0 8px" }}>Raise your score — fastest first</div>
      {CREDIT_TIPS.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: i < CREDIT_TIPS.length - 1 ? "1px solid " + C.lightGray : "none" }}>
          <span style={{ fontSize: 16 }}>{t.icon}</span>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: C.black }}>{t.title}</div><div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>{t.body}</div></div>
        </div>
      ))}
    </div>
  );
}

const ROADMAP_STEPS = [
  { n: 1, t: "Get pre-approved", d: "A lender checks your income, credit, and savings and tells you what you can spend. This makes your offers real to sellers." },
  { n: 2, t: "Go shopping", d: "Tour homes with your agent. Tell them what you love and hate — it helps them find 'the one' faster." },
  { n: 3, t: "Make an offer", d: "Your agent prepares the offer and negotiates price and terms. You'll put down an earnest-money deposit to show you're serious." },
  { n: 4, t: "Under contract", d: "Offer accepted! Now the clock starts: inspections, appraisal, and your loan move forward together." },
  { n: 5, t: "Inspections & appraisal", d: "An inspector checks the home's condition; the lender's appraiser confirms it's worth the price. Your agent guides any repair requests." },
  { n: 6, t: "Loan approval", d: "Your lender finalizes everything. Keep your finances steady — this is the danger zone for surprises (see Don'ts)." },
  { n: 7, t: "Final walk-through", d: "You see the home one last time to confirm it's in the agreed condition before closing." },
  { n: 8, t: "Closing day 🎉", d: "You sign, funds transfer, and you get the keys. Welcome home!" },
];
const DOS = ["Stay in steady, documented employment", "Keep paying every bill on time", "Save your pay stubs and bank statements", "Keep money in your existing accounts", "Answer your lender's requests fast", "Ask your agent any question — there are no dumb ones"];
const DONTS = ["Don't open new credit cards or finance a car", "Don't change jobs without telling your lender", "Don't make large deposits you can't explain", "Don't co-sign a loan for anyone", "Don't max out or close credit cards", "Don't furniture-shop on credit before closing"];

function FirstTimeRoadmapCard() {
  return (
    <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: "4px solid #1A5276" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>🧭 Your Home-Buying Roadmap</div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>Never bought before? Here's exactly what happens, start to finish — so nothing catches you off guard.</div>
      {ROADMAP_STEPS.map((s, i) => (
        <div key={s.n} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: i < ROADMAP_STEPS.length - 1 ? 14 : 4 }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#1A5276", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{s.n}</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: C.black }}>{s.t}</div><div style={{ fontSize: 12.5, color: C.gray, lineHeight: 1.55 }}>{s.d}</div></div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
        <div style={{ flex: "1 1 150px", background: C.successBg, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.success, marginBottom: 8 }}>✅ DO</div>
          {DOS.map((d, i) => <div key={i} style={{ fontSize: 12.5, color: C.black, lineHeight: 1.5, marginBottom: 6 }}>• {d}</div>)}
        </div>
        <div style={{ flex: "1 1 150px", background: "#FDEDEC", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.red, marginBottom: 8 }}>🚫 DON'T (until after closing)</div>
          {DONTS.map((d, i) => <div key={i} style={{ fontSize: 12.5, color: C.black, lineHeight: 1.5, marginBottom: 6 }}>• {d}</div>)}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SELLER MARKETING FEED — proof of the work being done to sell the home.
// Merges agent-logged actions with auto-detected marketing milestones.
// ════════════════════════════════════════════════════════════════
const MKT_ICON = { photos: "📸", mls: "🌐", social: "📱", openhouse: "🚪", email: "✉️", signage: "🪧", price: "🏷️", showing: "👀", feature: "⭐", milestone: "✅", action: "📣" };
function MarketingFeedCard({ txId }) {
  const [data, setData] = useState(null);
  const hdrs = { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("tp_token") || "") };
  useEffect(() => {
    if (!txId) return;
    fetch(API + "/client/marketing/" + txId, { headers: hdrs })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d && d.success ? d : { items: [] }))
      .catch(() => setData({ items: [] }));
  }, [txId]);
  const items = data?.items || [];
  return (
    <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: "4px solid " + C.red }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>📣 Marketing Your Home</div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>Everything we're doing to get your home sold — as it happens.</div>
      {data === null ? (
        <div style={{ fontSize: 13, color: C.gray }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 13, color: C.gray, background: C.lightGray, borderRadius: 10, padding: 14 }}>Your marketing campaign is just getting started — check back soon to see everything your agent is doing to sell your home.</div>
      ) : (
        items.map((it, i) => (
          <div key={it.id || i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid " + C.lightGray : "none" }}>
            <span style={{ fontSize: 18 }}>{MKT_ICON[it.type] || "📣"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.black }}>{it.label}</div>
              {it.detail && <div style={{ fontSize: 12.5, color: C.gray, lineHeight: 1.5 }}>{it.detail}</div>}
              {it.date && <div style={{ fontSize: 11, color: C.midGray }}>{formatDate(it.date)}</div>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── MORTGAGE RATE CARD — this month's average 30-yr fixed (FRED) ──
// Shown to buyers (while shopping) and sellers (what buyers are seeing).
function MortgageRateCard({ isBuyerSide }) {
  const [rate, setRate] = useState(null);
  useEffect(() => {
    const tok = localStorage.getItem("tp_token") || "";
    fetch(API + "/market/mortgage-rate", { headers: { Authorization: "Bearer " + tok } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.success && d.configured && (d.monthlyAvg != null || d.rate != null)) setRate(d); })
      .catch(() => {});
  }, []);
  if (!rate) return null;
  const val = (rate.monthlyAvg ?? rate.rate).toFixed(2);
  return (
    <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: "4px solid #1A5276", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: "#1A5276", lineHeight: 1 }}>{val}%</div>
        <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>30-yr fixed</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.black }}>📈 {rate.monthLabel || "This month"}'s average mortgage rate</div>
        <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
          {isBuyerSide
            ? "The national average 30-year fixed rate this month. Your actual rate depends on your credit, down payment, and lender — ask yours for a quote."
            : "What buyers are seeing in the market right now — it shapes how much they can afford for your home."}
        </div>
      </div>
    </div>
  );
}

// ── SIDE VALUE CARD — buyer vs seller specific, warm + concrete ──
function SideValueCard({ tx }) {
  const isBuyer = tx.transactionType && tx.transactionType.includes("Buyer");
  const days = daysUntil(tx.closingDate);
  if (tx.status === "Closed") return null;
  const moveLine = days !== null && days >= 0
    ? <>You could be {isBuyer ? "moving in" : "handing over the keys"} <b>{days === 0 ? "today" : "in " + days + " day" + (days === 1 ? "" : "s")}</b>. </>
    : null;
  if (isBuyer) {
    return (
      <div style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: "4px solid #1A5276" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🏡 Your future home</div>
        <div style={{ fontSize: 14, color: "#111", lineHeight: 1.6 }}>
          {tx.contractPrice ? <>You're under contract at <b>${Number(tx.contractPrice).toLocaleString()}</b>. </> : null}
          {moveLine}
          Your agent is handling the financing, inspection, and closing details for you.
        </div>
      </div>
    );
  }
  const atOrAbove = tx.contractPrice && tx.listPrice && Number(tx.contractPrice) >= Number(tx.listPrice);
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: "4px solid #C0392B" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📣 Your sale</div>
      <div style={{ fontSize: 14, color: "#111", lineHeight: 1.6 }}>
        {tx.contractPrice ? <>You're under contract at <b>${Number(tx.contractPrice).toLocaleString()}</b>{atOrAbove ? " — at or above your asking price! 🎯" : ""}. </>
          : tx.listPrice ? <>Your home is listed at <b>${Number(tx.listPrice).toLocaleString()}</b>. </> : null}
        {moveLine}
        Your agent is actively driving the sale toward the closing table.
      </div>
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
  "Survey": "📐", "Contractor": "🔧",
  "General Contractor": "👷", "Handyman": "🛠️", "Plumber": "🚰",
  "Electrician": "⚡", "HVAC": "❄️", "Roofer": "🏠", "Photographer": "📷",
  "Moving Company": "🚚", "Locksmith": "🔑", "Other": "👤",
};

const VENDOR_CATEGORIES_LIST = [
  "Inspector", "Lender", "Title Company", "Insurance",
  "Attorney", "Pest Control", "Survey", "Contractor",
  "General Contractor", "Handyman", "Plumber", "Electrician",
  "HVAC", "Roofer", "Photographer",
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
// previewTxId (optional): agent "Preview client portal" mode — loads ONE deal
// via the owner-gated preview endpoint and shows exactly what the client sees.
export default function ClientPortal({ user, onLogout, previewTxId, onExitPreview }) {
  const isPreview = !!previewTxId;
  const [tx, setTx] = useState(null);
  const [allTx, setAllTx] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [chatUnread, setChatUnread] = useState(0);
  const [timeline, setTimeline] = useState(null);
  const [offers, setOffers] = useState([]);
  const [offersContext, setOffersContext] = useState(null);
  const [offersReload, setOffersReload] = useState(0);
  const activeTabRef = useRef(activeTab);
  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };

  // Auto-TC: load this transaction's timeline (progress + "my checklist").
  useEffect(() => {
    if (!tx?.id) { setTimeline(null); return; }
    fetch(API + "/client/milestones/" + tx.id, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => setTimeline(d && d.success ? d : null))
      .catch(() => setTimeline(null));
  }, [tx?.id]);

  // Seller portal: pending offers the seller can review & accept/decline.
  useEffect(() => {
    if (!tx?.id) { setOffers([]); return; }
    fetch(API + "/client/offers/" + tx.id, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setOffers(d && d.success ? (d.offers || []) : []); setOffersContext(d && d.success ? (d.context || null) : null); })
      .catch(() => { setOffers([]); setOffersContext(null); });
  }, [tx?.id, offersReload]);

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
    brokerageLogo: t.brokerage_logo,
    owningAgentName: [t.owning_agent_first_name, t.owning_agent_last_name].filter(Boolean).join(" "),
    owningAgentEmail: t.owning_agent_email,
    owningAgentPhone: t.owning_agent_phone,
    owningAgentTitle: t.owning_agent_title,
    owningAgentPhoto: t.owning_agent_photo,
  });

  useEffect(() => {
    const url = isPreview ? `${API}/client/transaction/${previewTxId}/preview` : `${API}/client/transactions`;
    fetch(url, { headers })
      .then(r => r.json())
      .then(data => {
        // A client can have MULTIPLE properties (e.g. selling two at once).
        // Keep them all and let the client switch; default to the LIVE deal —
        // an in-progress transaction (under contract / active) outranks a closed
        // one, and dead deals (cancelled/withdrawn) sink to the bottom. Ties keep
        // the backend's most-recent-first order. Generic status matching so it
        // works for any tenant/agent statewide (buyer or seller portal).
        const statusRank = (s) => {
          const v = (s || "").toLowerCase();
          if (/(cancel|withdraw|terminat|expired|dead|lost|fell)/.test(v)) return 4; // dead last
          if (v.includes("closed") || v.includes("sold")) return 3;                  // completed
          if (v.includes("under contract") || v.includes("inspection") || v.includes("appraisal")
              || v.includes("clear to close") || v.includes("pending")) return 0;    // most actionable
          if (v.includes("active")) return 1;
          if (v.includes("coming soon") || v.includes("new")) return 2;
          return 1; // unknown in-progress status → above closed/dead
        };
        const list = (data.transactions || []).map(mapTx)
          .sort((a, b) => statusRank(a.status) - statusRank(b.status));
        setAllTx(list);
        if (list.length > 0) {
          // If the agent shared a link for a SPECIFIC deal (?tx=… → stored at
          // login), open that one; otherwise fall back to the highest-ranked.
          // One-shot: clear the flag so later visits use the normal default.
          let focusId = null;
          try { focusId = localStorage.getItem("tp_portal_focus_tx"); localStorage.removeItem("tp_portal_focus_tx"); } catch { /* no-op */ }
          const chosen = (focusId && list.find(t => t.id === focusId)) || list[0];
          setTx(chosen);
          return fetch(API + "/client/documents/" + chosen.id, { headers });
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
    try {
      // Server-proxied upload (browser→R2 presigned PUT fails CORS).
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(API + "/documents/upload", {
        method: "POST", headers,
        body: JSON.stringify({ transactionId: tx.id, fileName: file.name, fileType: file.type || "application/octet-stream", category: "Client Upload", base64 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
      const docsRes = await fetch(API + "/client/documents/" + tx.id, { headers });
      const docsData = await docsRes.json();
      if (docsData.documents) setDocs(docsData.documents);
      alert("Document uploaded successfully!");
    } catch (err) {
      alert("Upload failed: " + err.message);
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
  const agentPhoto = tx ? tx.owningAgentPhoto : "";
  const agentTitle = tx ? tx.owningAgentTitle : "";
  const brokerage = tx ? tx.owningBrokerage : "";
  const brokerageLogo = tx ? tx.brokerageLogo : "";
  // The portal wears the AGENT's brokerage color — it's their portal, not generic.
  // Guard against unreadable near-white brand colors for the dark header.
  const rawBrand = (tx && tx.brokerageColor) || "";
  const isLight = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return false; const n = parseInt(m[1], 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 180; };
  const brand = rawBrand && !isLight(rawBrand) ? rawBrand : "#1A2B4A";
  // The TRUE stage from milestones (not the stuck DB status) drives the tracker,
  // latest update, hero, and "what's next" — so the seller never sees stale info.
  const stage = tx ? deriveStage(timeline, tx) : { effectiveStatus: "Active", lastDone: null, upcoming: [] };

  const isBuyerSide = tx && (tx.type === "Buyer Representation" || tx.type === "Dual Agency" || (tx.transactionType && tx.transactionType.includes("Buyer")));
  const isSellerSide = tx && (tx.type === "Listing (Seller)" || tx.type === "Dual Agency" || (tx.transactionType && (tx.transactionType.includes("Listing") || tx.transactionType.includes("Seller"))));
  // Greet the CLIENT by the name set on THIS deal — NOT the first name on the
  // account that owns the email. Shared/duplicate emails meant a seller named
  // here as "seller1" got greeted by the account holder's name ("Adrian"). Prefer
  // the own-side party whose email IS the logged-in person; fall back to any
  // own-side party, then the account name. In agent preview there's no logged-in
  // client, so the own-side party name is the only correct source.
  const myEmail = (user && user.email ? String(user.email) : "").trim().toLowerCase();
  const isOwnSideRole = (p) => {
    const r = (p.role || "").toLowerCase();
    return isSellerSide ? /^(co[- ]?)?seller$/.test(r) : /^(co[- ]?)?buyer$/.test(r);
  };
  const ownSideParties = tx ? (tx.parties || []).filter(isOwnSideRole) : [];
  const ownClientParty = ownSideParties.find(p => myEmail && (p.email || "").trim().toLowerCase() === myEmail) || ownSideParties[0] || null;
  const clientFirstName = ownClientParty && ownClientParty.name ? ownClientParty.name.trim().split(/\s+/)[0] : "";
  const greetName = clientFirstName || user.firstName || "there";

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
  // The client's own agent already shows at the top (owningAgent), and is usually
  // ALSO present in parties as "Listing Agent"/"Buyer's Agent" — drop that duplicate
  // by matching email (preferred) or name so the same person isn't listed twice.
  const isMyAgent = (p) => {
    const n = (s) => (s || "").trim().toLowerCase();
    return (agentEmail && n(p.email) === n(agentEmail)) || (agentName && n(p.name) === n(agentName));
  };
  const teamParties = tx ? tx.parties.filter(p =>
    p.role !== "Buyer" && p.role !== "Seller" && !hideOppositeAgent(p.role) && !isMyAgent(p)
  ) : [];

  const tabs = [
    { id: "home", label: "🏠 My Transaction" },
    { id: "documents", label: "📎 Documents" },
    { id: "chat", label: chatUnread > 0 ? "💬 Chat (" + chatUnread + ")" : "💬 Chat" },
    { id: "team", label: "👥 My Team" },
    ...(isBuyerSide ? [{ id: "buyer-guide", label: "🧭 Buyer Guide" }] : []),
    ...(isSellerSide ? [{ id: "marketing", label: "📣 Marketing" }] : []),
    { id: "vendors", label: "🏆 Vendors" },
    ...(isBuyerSide ? [{ id: "calculator", label: "🧮 Buyer Calc" }] : []),
    ...(isSellerSide ? [{ id: "seller-calc", label: "💰 Net Proceeds" }] : []),
    { id: "faq", label: "❓ FAQ" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.lightGray,
      fontFamily: "system-ui, sans-serif", paddingBottom: 80 }}>

      {/* Preview banner — agent is viewing the client's portal */}
      {isPreview && (
        <div style={{ background: "#B7770D", color: "#fff", padding: "10px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>👁 Preview — this is exactly what your client sees.</span>
          <button onClick={() => (onExitPreview ? onExitPreview() : onLogout && onLogout())}
            style={{ background: "#fff", color: "#7A5C00", border: "none", borderRadius: 8,
              padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 800, fontFamily: "inherit" }}>
            ← Back to deal
          </button>
        </div>
      )}

      {/* Header — wears the agent's brokerage brand */}
      <div style={{ background: brand, padding: "14px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {brokerageLogo
            ? <img src={brokerageLogo} alt={brokerage || "Brokerage"} style={{ height: 36, maxWidth: 140, objectFit: "contain", flexShrink: 0 }} />
            : <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "#fff", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{(brokerage || "T").charAt(0).toUpperCase()}</span>
              </div>}
          <div>
            <div style={{ color: "#ffffff", fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px" }}>
              {brokerage || "Your Transaction Portal"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 1, fontWeight: 500 }}>
              Welcome, {greetName}! 👋
            </div>
          </div>
        </div>
        <button onClick={() => (isPreview ? (onExitPreview ? onExitPreview() : onLogout && onLogout()) : onLogout && onLogout())}
          style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.5)",
            color: "#ffffff", borderRadius: 8, padding: "7px 18px",
            cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            letterSpacing: "0.3px" }}>
          {isPreview ? "Exit Preview" : "Sign Out"}
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
            <ProgressTracker status={stage.effectiveStatus} transactionType={tx.transactionType} />
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
                <JourneyHero tx={tx} stage={stage} />
                <AgentCard name={agentName} title={agentTitle} brokerage={brokerage} phone={agentPhone} email={agentEmail} photo={agentPhoto} brand={brand} />
                {isSellerSide && offers.length > 0 && (
                  <SellerOffersCard offers={offers} context={offersContext} headers={headers} agentName={agentName}
                    onDecided={() => setOffersReload(n => n + 1)} />
                )}
                {timeline && timeline.total > 0 && (() => {
                  // A seller listing that isn't under contract yet is in the
                  // PREP/launch stage — framing its progress as "% to closing" is
                  // misleading (the home may not even be in the MLS). Frame it as
                  // getting market-ready instead; only switch to "to closing" once
                  // the deal is actually under contract.
                  const isSellerListing = /listing|seller/i.test(tx.transactionType || "");
                  const preContract = isSellerListing && tx.status === "Active";
                  const progressHeadline = preContract
                    ? `You're ${timeline.progress}% to launch 🚀`
                    : `You're ${timeline.progress}% to closing 🎯`;
                  return (
                  <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.black }}>{progressHeadline}</div>
                      <div style={{ fontSize: 12, color: C.gray, fontWeight: 700 }}>{timeline.done}/{timeline.total} steps</div>
                    </div>
                    <div style={{ background: C.lightGray, borderRadius: 20, height: 12, overflow: "hidden" }}>
                      <div style={{ width: timeline.progress + "%", height: "100%", background: timeline.progress === 100 ? "#1E8449" : "#1a2332", borderRadius: 20, transition: "width .5s ease" }} />
                    </div>
                    {timeline.mine && timeline.mine.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>✅ What we need from you</div>
                        <div style={{ fontSize: 12, color: C.gray, marginBottom: 10 }}>A few things to take care of as we {preContract ? "get your home ready to list" : "head toward closing"} — no rush unless a date is shown.</div>
                        {timeline.mine.map((m, i) => {
                          const h = humanizeForClient(m.name);
                          return (
                            <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: i < timeline.mine.length - 1 ? "1px solid " + C.lightGray : "none" }}>
                              <span style={{ background: "#1a2332", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.black }}>{h.label}</div>
                                {h.why && <div style={{ fontSize: 12.5, color: C.gray, lineHeight: 1.5, marginTop: 2 }}>{h.why}</div>}
                                {m.due_date && <div style={{ fontSize: 12, color: "#B7770D", fontWeight: 600, marginTop: 2 }}>📅 by {formatDate(m.due_date)}</div>}
                                {m.requires_document && <div style={{ fontSize: 11, color: "#B7770D" }}>📎 Document needed{m.document_label ? `: ${m.document_label}` : ""}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {timeline.mine && timeline.mine.length === 0 && (
                      <div style={{ marginTop: 12, fontSize: 13, color: C.gray }}>Nothing needed from you right now — we'll let you know the moment something comes up. 👍</div>
                    )}
                  </div>
                  );
                })()}
                <SideValueCard tx={tx} />
                <LatestUpdateCard tx={tx} agentName={agentName} stage={stage} />
                <WinsCard timeline={timeline} />
                <ClosingCountdownCard tx={tx} />

                <MortgageRateCard isBuyerSide={isBuyerSide} />

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

                {/* What's coming up — the deal's REAL upcoming milestones (phase-
                    gated, so a pre-contract listing never shows post-contract steps).
                    When there are no in-phase milestones to list (e.g. listing is
                    done and an offer is on the table), fall back to a TRUE, phase-
                    appropriate "what's next" so the section never just vanishes. */}
                {(() => {
                  const preContract = stage.effectiveStatus === "Active";
                  let items = (stage.upcoming || []).map(m => comingUpLabel(m.name));
                  if (items.length === 0) {
                    if (preContract && isSellerSide && offers.length > 0) {
                      items = [
                        "Review the offer above with your agent",
                        "Decide together whether to accept, counter, or decline",
                        "When you accept, your home goes under contract and we begin inspection & appraisal",
                      ];
                    } else if (preContract && isSellerSide) {
                      items = [
                        "Your agent keeps actively marketing your home",
                        "We'll reach out the moment an offer comes in to review it together",
                      ];
                    }
                  }
                  if (items.length === 0) return null;
                  return (
                    <div style={{ background: C.white, borderRadius: 14, padding: 18, marginBottom: 14,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.gray,
                        textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                        WHAT'S COMING UP
                      </div>
                      <div style={{ fontSize: 12, color: C.gray, marginBottom: 12 }}>Here's what's still ahead — your agent handles most of this for you.</div>
                      {items.map((text, i) => (
                        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                          <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.lightGray, color: C.gray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ flex: 1, fontSize: 14, color: C.black, fontWeight: 600, lineHeight: 1.5 }}>{text}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* BUYER GUIDE TAB — loans, credit, first-time roadmap */}
            {activeTab === "buyer-guide" && isBuyerSide && (
              <div>
                <LoanTypesCard />
                <CreditCoachCard txId={tx.id} />
                <FirstTimeRoadmapCard />
              </div>
            )}

            {/* MARKETING TAB — seller's proof-of-work feed */}
            {activeTab === "marketing" && isSellerSide && (
              <div>
                <MarketingFeedCard txId={tx.id} />
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
                <TransactionChat transactionId={tx?.id} user={null} clientView={true}
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
