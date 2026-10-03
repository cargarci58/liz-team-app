import { t as tr } from "../i18n";
import { useState, useEffect } from "react";

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
//   scenes    — walkthrough scene numbers for this page (config/pageTips PAGE_SCENES)
//   onWatch   — (scenes) => void, plays just those scenes in Kristen's voice.
//               When BOTH are given the strip is the one-line "▶ Watch" bar
//               instead of the three lines (Carlos 9/20: replace the banner
//               with a short clip that explains the page and walks them through it).
// ═══════════════════════════════════════════════════════════════

const NAVY = "#1A2B4A";
const RED = "#C0392B";
// The guide's own colour — used NOWHERE else in the app as a panel, on purpose
// (Carlos 9/20: it has to stand out so a new agent notices it immediately, but
// the first violet was "too bright" — a calmer medium blue, kept clearly
// lighter than the navy header so the two never read as one thing).
const GUIDE = "#1E40AF";        // medium blue panel
const GUIDE_LABEL = "#BFDBFE"; // light blue for the three row labels
const GUIDE_GOLD = "#FBBF24";  // the action button — the one thing to press

const storeKey = (userId, pageKey) => `tp_tip_seen:${userId || "anon"}:${pageKey}`;

// "Hide tips on all pages" — one switch for every strip (testers read the
// collapsed "First time here?" pill as "Close didn't work"). Turned back on
// from ⚙️ Menu → ❓ Help & Guides → Start Here. Every mounted strip listens
// for the change event so they all disappear/reappear at once.
const allOffKey = (userId) => `tp_tips_off:${userId || "anon"}`;
const TIPS_EVENT = "tp-page-tips-changed";
export function pageTipsAreOff(userId) {
  try { return localStorage.getItem(allOffKey(userId)) === "1"; } catch { return false; }
}
export function setPageTipsOff(userId, off) {
  try { off ? localStorage.setItem(allOffKey(userId), "1") : localStorage.removeItem(allOffKey(userId)); } catch { /* private mode */ }
  try { window.dispatchEvent(new Event(TIPS_EVENT)); } catch { /* ignore */ }
}

export default function FirstTimeHere({ pageKey, tip, userId, onAction, onShowHow, compact = false, scenes = null, onWatch = null }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(storeKey(userId, pageKey)) !== "1"; } catch { return true; }
  });
  const [allOff, setAllOff] = useState(() => pageTipsAreOff(userId));
  useEffect(() => {
    const sync = () => setAllOff(pageTipsAreOff(userId));
    sync();
    window.addEventListener(TIPS_EVENT, sync);
    return () => window.removeEventListener(TIPS_EVENT, sync);
  }, [userId]);
  if (!tip || allOff) return null;
  const hasClip = !!(onWatch && scenes && scenes.length);

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(storeKey(userId, pageKey), "1"); } catch { /* private mode */ }
  };
  const reopen = () => setOpen(true);
  const hideAll = () => setPageTipsOff(userId, true);
  const hideAllBtn = (
    <button onClick={hideAll}
      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "4px 2px", textDecoration: "underline", flex: "0 0 auto" }}>
      {tr("Hide tips on all pages")}
    </button>
  );

  // Collapsed: a quiet, always-present way back in.
  if (!open) {
    return (
      <div data-tour="tips" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, padding: compact ? "6px 24px 0" : "8px 24px 0" }}>
        <button onClick={reopen}
          style={{ background: GUIDE, border: "none", color: "#fff", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "5px 12px" }}>
          {hasClip ? "🎬" : "💡"} {tr("First time here?")}
        </button>
        <button onClick={hideAll} aria-label={tr("Hide tips on all pages")} title={tr("Hide tips on all pages")}
          style={{ background: "none", border: "none", color: "#6B7280", fontSize: 16, lineHeight: 1, cursor: "pointer", padding: "4px 6px", fontFamily: "inherit" }}>
          ×
        </button>
      </div>
    );
  }

  // The clip version: one line + a play button. The narration explains the
  // page and walks through it, so the three text rows aren't repeated here.
  if (hasClip) {
    return (
      <div data-tour="tips" style={{ padding: compact ? "10px 24px 0" : "14px 24px 0" }}>
        <div style={{ background: GUIDE, borderLeft: `6px solid ${GUIDE_GOLD}`, borderRadius: 12, padding: "11px 14px 11px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px", boxShadow: "0 6px 18px rgba(30,64,175,0.25)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
          <button onClick={() => onWatch(scenes)}
            style={{ background: GUIDE_GOLD, color: "#2E1065", border: "none", borderRadius: 999, padding: "9px 16px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flex: "0 0 auto" }}>
            {tr("▶ Watch how this page works")}
          </button>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: GUIDE_LABEL }}>{scenes.length > 1 ? tr("First time here? · about {n} minutes", { n: scenes.length }) : tr("First time here? · about 1 minute")}</div>
            <div style={{ fontSize: 14, color: "#fff", lineHeight: 1.45 }}>{tr(tip.what)}</div>
          </div>
          {hideAllBtn}
          <button onClick={dismiss} aria-label={tr("Got it, hide this")}
            style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "4px 10px", flex: "0 0 auto" }}>
            {tr("Got it ×")}
          </button>
        </div>
      </div>
    );
  }

  // Label beside the text on a desktop, ABOVE it on a phone. No media query:
  // the text wants at least 220px, so once the card is narrower than
  // label + text it wraps onto its own line by itself.
  const row = (label, text) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "flex-start" }}>
      <span style={{ flex: "0 0 auto", minWidth: 104, whiteSpace: "nowrap", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: GUIDE_LABEL, paddingTop: 3 }}>{tr(label)}</span>
      <span style={{ flex: "1 1 220px", fontSize: 14.5, color: "#fff", lineHeight: 1.5 }}>{tr(text)}</span>
    </div>
  );

  return (
    <div data-tour="tips" style={{ padding: compact ? "10px 24px 0" : "14px 24px 0" }}>
      <div style={{ background: GUIDE, borderLeft: `6px solid ${GUIDE_GOLD}`, borderRadius: 12, padding: "13px 18px 14px 16px", display: "flex", flexDirection: "column", gap: 9, boxShadow: "0 6px 18px rgba(30,64,175,0.25)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", flex: 1, letterSpacing: "0.01em" }}>{tr("First time here?")}</span>
          {hideAllBtn}
          <button onClick={dismiss} aria-label={tr("Got it, hide this")}
            style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "4px 10px" }}>
            {tr("Got it ×")}
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
                {tr(tip.action.label)} →
              </button>
            )}
            {tip.guide && onShowHow && (
              <button onClick={() => onShowHow(tip.guide)}
                style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.6)", borderRadius: 8, padding: "8px 15px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {tr("📖 Show me how")}
              </button>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
