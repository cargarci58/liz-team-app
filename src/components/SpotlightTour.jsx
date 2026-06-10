import { useState, useLayoutEffect, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// SpotlightTour — a guided product tour that highlights the REAL
// buttons in place: it dims the whole screen except the target
// button and shows a tooltip pointing at it. Walks the dashboard
// toolbar one button at a time (Back / Next), ending with a CTA.
//
// Targets are found by [data-tour="<key>"] attributes on the live
// buttons. A step whose target isn't on screen is skipped.
//
// Props:
//   onClose():        dismiss the tour
//   onCreateFirst():  (optional) jump to "+ New Transaction" on the last step
// ═══════════════════════════════════════════════════════════════

const RED = '#C0392B';
const PAD = 6;          // breathing room around the highlighted button
const TIP_W = 320;      // tooltip width

const STEPS = [
  { key: 'new', emoji: '➕', title: 'Start a deal here', body: 'Click "+ New Transaction" to start a listing or a buyer. Your timeline, checklist, and client reminders build themselves automatically.' },
  { key: 'contacts', emoji: '📇', title: 'Your contacts', body: 'Everyone you work with — clients, vendors, anyone you email. Add them once and reuse them everywhere.' },
  { key: 'winday', emoji: '🏆', title: 'Win the Day', body: "Your daily to-do list. The app tells you exactly what needs attention today so nothing slips." },
  { key: 'popbys', emoji: '🎁', title: 'Pop-Bys', body: 'Plan gift drop-offs to past clients — the app suggests a gift, writes a note, and maps your route.' },
  { key: 'financials', emoji: '💵', title: 'Financials', body: 'Track expenses, see a simple P&L, and import a bank statement. Closed-deal commission flows in on its own.' },
  { key: 'vendors', emoji: '🏆', title: 'Vendors', body: 'Your preferred vendor list (lenders, inspectors, title…). Share them with a client in one tap.' },
  { key: 'intake', emoji: '🔗', title: 'New Buyer/Seller Intake', body: 'Text or email a link to a new client. When they fill it out, a fresh lead lands in your pipeline.' },
  { key: 'menu', emoji: '⚙️', title: 'Everything else is in the Menu', body: 'Reports & Goal Planner, your Profile, Company Settings, Forms — and this Help — all live under ⚙️ Menu. That\'s the tour!' },
];

export default function SpotlightTour({ onClose, onCreateFirst }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  const findEl = (key) => document.querySelector(`[data-tour="${key}"]`);

  // Measure the current target; retry a few frames if it's not painted yet.
  const measure = useCallback(() => {
    const step = STEPS[i];
    if (!step) return;
    const el = findEl(step.key);
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
  }, [i]);

  // On step change: locate the target (with a couple of retries), skipping missing ones.
  useLayoutEffect(() => {
    let tries = 0;
    let raf;
    const attempt = () => {
      const step = STEPS[i];
      if (!step) return;
      const el = findEl(step.key);
      if (el) { measure(); return; }
      tries += 1;
      if (tries < 8) { raf = requestAnimationFrame(attempt); return; }
      // Target genuinely absent (e.g. hidden for this user) → skip forward.
      if (i < STEPS.length - 1) setI(i + 1); else onClose();
    };
    attempt();
    return () => raf && cancelAnimationFrame(raf);
  }, [i, measure, onClose]);

  // Keep the spotlight glued to the button as the page scrolls / resizes.
  useEffect(() => {
    const onMove = () => measure();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [measure]);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  if (!step) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

  // Tooltip placement: below the target if there's room, else above.
  let tipTop, tipLeft;
  if (rect) {
    const below = rect.top + rect.height + 14;
    const wantAbove = rect.top + rect.height + 200 > vh;
    tipTop = wantAbove ? Math.max(12, rect.top - 12 - 190) : below;
    tipLeft = Math.min(Math.max(12, rect.left + rect.width / 2 - TIP_W / 2), vw - TIP_W - 12);
  } else {
    tipTop = vh / 2 - 90;
    tipLeft = Math.max(12, vw / 2 - TIP_W / 2);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, fontFamily: 'system-ui, sans-serif' }}>
      {/* Dim everything except the target — the giant box-shadow is the mask. */}
      {rect ? (
        <div style={{
          position: 'fixed',
          top: rect.top - PAD, left: rect.left - PAD,
          width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          borderRadius: 12,
          boxShadow: `0 0 0 3px ${RED}, 0 0 0 9999px rgba(0,0,0,0.62)`,
          pointerEvents: 'none',
          transition: 'all 0.25s ease',
        }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)' }} />
      )}

      {/* Tooltip card */}
      <div style={{
        position: 'fixed', top: tipTop, left: tipLeft, width: TIP_W, maxWidth: 'calc(100vw - 24px)',
        background: '#fff', borderRadius: 14, boxShadow: '0 16px 50px rgba(0,0,0,0.4)', padding: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tour · {i + 1} of {STEPS.length}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {STEPS.map((_, idx) => (
            <div key={idx} style={{ flex: 1, height: 4, borderRadius: 2, background: idx <= i ? RED : '#eee' }} />
          ))}
        </div>

        <div style={{ fontSize: 17, fontWeight: 800, color: '#111', marginBottom: 6 }}>{step.emoji} {step.title}</div>
        <div style={{ fontSize: 14, color: '#555', lineHeight: 1.55, marginBottom: 16 }}>{step.body}</div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setI(n => Math.max(0, n - 1))}
            disabled={i === 0}
            style={{ background: 'none', border: '1px solid #ddd', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, color: i === 0 ? '#ccc' : '#444', cursor: i === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >← Back</button>
          <div style={{ flex: 1 }} />
          {!last ? (
            <button onClick={() => setI(n => Math.min(STEPS.length - 1, n + 1))} style={primaryBtn}>Next →</button>
          ) : onCreateFirst ? (
            <button onClick={onCreateFirst} style={primaryBtn}>Create my first deal →</button>
          ) : (
            <button onClick={onClose} style={primaryBtn}>Done</button>
          )}
        </div>
        {last && onCreateFirst && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#999', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>I'll explore on my own</button>
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtn = { background: RED, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' };
