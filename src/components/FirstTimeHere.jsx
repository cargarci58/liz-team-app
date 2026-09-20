import { useState } from "react";

// ═══════════════════════════════════════════════════════════════
// FirstTimeHere — the three-line "what is this page for" strip.
//
// Every other bit of help in the app is PULL: the agent has to already know
// they need help and go find it (the ? button, the Help Center, 71 guides
// most people never open). This is the one piece that's PUSH — it sits on the
// page and explains the page, to someone who may never have done lead
// generation or tracked their own money and has no idea why this screen exists.
//
// Content lives in config/pageTips.js so the WORDS can be edited without
// touching this file. Three lines, one action, and a "Show me how" that opens
// the matching guide.
//
// Dismissal is per page, per user, in localStorage. Once dismissed it shrinks
// to a small "💡 First time here?" link so it's one tap to bring back — it
// never fully disappears, because "I closed it and now I can't find it" is
// the failure mode this whole feature exists to prevent.
//
// Props:
//   pageKey   — stable id for this page/tab (also the dismissal key)
//   tip       — { what, doFirst, why, guide?, action?: {label,key} }
//   userId    — scopes the dismissal so a shared computer doesn't hide it
//   onAction  — (key) => void, resolves tip.action.key to a real handler
//   onShowHow — (guideQuery) => void, opens the Help Center pre-searched
//   compact   — true inside a deal (tighter padding under the tab strip)
// ═══════════════════════════════════════════════════════════════

const NAVY = "#1A2B4A";
const RED = "#C0392B";
// The guide's own colour — used NOWHERE else in the app as a panel, on purpose
// (Carlos 9/20: it has to stand out so a new agent notices it immediately).
const GUIDE = "#4C1D95";        // deep violet panel
const GUIDE_LABEL = "#C4B5FD"; // light violet for the three row labels
const GUIDE_GOLD = "#FBBF24";  // the action button — the one thing to press

const storeKey = (userId, pageKey) => `tp_tip_seen:${userId || "anon"}:${pageKey}`;

export default function FirstTimeHere({ pageKey, tip, userId, onAction, onShowHow, compact = false }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(storeKey(userId, pageKey)) !== "1"; } catch { return true; }
  });
  if (!tip) return null;

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(storeKey(userId, pageKey), "1"); } catch { /* private mode */ }
  };
  const reopen = () => setOpen(true);

  // Collapsed: a quiet, always-present way back in.
  if (!open) {
    return (
      <div data-tour="tips" style={{ display: "flex", justifyContent: "flex-end", padding: compact ? "6px 24px 0" : "8px 24px 0" }}>
        <button onClick={reopen}
          style={{ background: GUIDE, border: "none", color: "#fff", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "5px 12px" }}>
          💡 First time here?
        </button>
      </div>
    );
  }

  // Label beside the text on a desktop, ABOVE it on a phone. No media query:
  // the text wants at least 220px, so once the card is narrower than
  // label + text it wraps onto its own line by itself.
  const row = (label, text) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "flex-start" }}>
      <span style={{ flex: "0 0 auto", minWidth: 104, whiteSpace: "nowrap", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: GUIDE_LABEL, paddingTop: 3 }}>{label}</span>
      <span style={{ flex: "1 1 220px", fontSize: 14.5, color: "#fff", lineHeight: 1.5 }}>{text}</span>
    </div>
  );

  return (
    <div data-tour="tips" style={{ padding: compact ? "10px 24px 0" : "14px 24px 0" }}>
      <div style={{ background: GUIDE, borderLeft: `6px solid ${GUIDE_GOLD}`, borderRadius: 12, padding: "13px 18px 14px 16px", display: "flex", flexDirection: "column", gap: 9, boxShadow: "0 6px 18px rgba(76,29,149,0.28)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", flex: 1, letterSpacing: "0.01em" }}>First time here?</span>
          <button onClick={dismiss} aria-label="Got it, hide this"
            style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "4px 10px" }}>
            Got it ×
          </button>
        </div>
        {row("What this is", tip.what)}
        {row("Do this first", tip.doFirst)}
        {row("Why it matters", tip.why)}
        {(tip.action || tip.guide) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", marginTop: 2 }}>
            <span aria-hidden="true" style={{ flex: "0 0 104px" }} />
            <div style={{ flex: "1 1 220px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {tip.action && onAction && (
              <button onClick={() => onAction(tip.action.key)}
                style={{ background: GUIDE_GOLD, color: "#2E1065", border: "none", borderRadius: 8, padding: "8px 15px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                {tip.action.label} →
              </button>
            )}
            {tip.guide && onShowHow && (
              <button onClick={() => onShowHow(tip.guide)}
                style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.6)", borderRadius: 8, padding: "8px 15px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                📖 Show me how
              </button>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
