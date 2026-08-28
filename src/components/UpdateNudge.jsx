import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// UpdateNudge — "a new version is ready" toast.
//
// Agents keep the app tab open for days, so deploys never reach them
// until they reload. Every 5 minutes this quietly re-fetches the site's
// index.html and compares the main bundle filename (it's content-hashed,
// so a new deploy = a new name) against the one this page loaded with.
// When they differ, a small bottom-center toast offers one-tap reload.
// Dismissing hides it until the NEXT deploy after that.
// ═══════════════════════════════════════════════════════════════

const CHECK_EVERY_MS = 5 * 60 * 1000;
const BUNDLE_RE = /assets\/index-[A-Za-z0-9_-]+\.js/;

function currentBundle() {
  try {
    const s = Array.from(document.querySelectorAll("script[src]"))
      .map(el => el.getAttribute("src") || "")
      .find(src => BUNDLE_RE.test(src));
    return s ? s.match(BUNDLE_RE)[0] : null;
  } catch { return null; }
}

export default function UpdateNudge() {
  const [freshBundle, setFreshBundle] = useState(null);   // newer bundle seen on the server
  const [dismissed, setDismissed] = useState(null);       // bundle name the user dismissed

  useEffect(() => {
    const mine = currentBundle();
    if (!mine) return;   // dev server or unexpected markup — stay silent
    let stopped = false;
    const check = async () => {
      try {
        const html = await fetch("/", { cache: "no-store" }).then(r => (r.ok ? r.text() : ""));
        const m = html.match(BUNDLE_RE);
        if (!stopped && m && m[0] !== mine) setFreshBundle(m[0]);
      } catch {}
    };
    const t = setInterval(check, CHECK_EVERY_MS);
    return () => { stopped = true; clearInterval(t); };
  }, []);

  if (!freshBundle || freshBundle === dismissed) return null;
  return (
    <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 4000, background: "#1a2332", color: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.35)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, fontFamily: "system-ui, sans-serif", maxWidth: "calc(100vw - 32px)" }}>
      <span style={{ fontSize: 13.5 }}>✨ A new version of the app is ready.</span>
      <button onClick={() => window.location.reload()} style={{ background: "#1E8449", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        Update now
      </button>
      <button onClick={() => setDismissed(freshBundle)} title="Later" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 18, cursor: "pointer", padding: 0 }}>×</button>
    </div>
  );
}
