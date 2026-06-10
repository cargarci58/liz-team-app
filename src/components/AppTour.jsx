import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// AppTour — a 60-second "what you can do here" swipe-through.
// Used in two places: as the final onboarding step, and as a
// replayable 🎬 App Tour inside the Help Center.
// Props:
//   onClose():        dismiss the tour
//   onCreateFirst():  (optional) jump straight to "+ New Transaction"
// ═══════════════════════════════════════════════════════════════

const RED = '#C0392B';

const CARDS = [
  { emoji: '🏠', title: 'Your Dashboard', body: 'Every deal at a glance with live stats up top. Tap any card to open that transaction.' },
  { emoji: '➕', title: 'New Transaction', body: 'Start a listing or a buyer here. Your timeline, checklist, and client reminders build themselves automatically.' },
  { emoji: '📇', title: 'Contacts', body: 'Your people — clients, vendors, anyone you email. Add them once and reuse them everywhere.' },
  { emoji: '🏆', title: 'Win the Day', body: "Your daily to-do list. The app tells you exactly what needs attention today so nothing slips." },
  { emoji: '🎁', title: 'Pop-Bys', body: 'Plan gift drop-offs to past clients — the app suggests a gift, writes a note, and maps your route.' },
  { emoji: '💵', title: 'Financials', body: 'Track expenses, see a simple P&L, and import a bank statement. Closed-deal commission flows in on its own.' },
  { emoji: '🏆', title: 'Vendors', body: 'Your preferred vendor list (lenders, inspectors, title…). Share them with a client in one tap.' },
  { emoji: '🔗', title: 'New Buyer/Seller Intake', body: 'Text or email a link to a new client. When they fill it out, a fresh lead lands in your pipeline.' },
  { emoji: '📊', title: 'Reports & Goals', body: 'See your numbers and use the Goal Planner to back-calculate the daily activity to hit your income goal. (⚙️ Menu)' },
  { emoji: '❓', title: 'Help, anytime', body: 'Stuck on anything? The red ? button (bottom-right) has step-by-step guides and FAQs for every task.' },
];

export default function AppTour({ onClose, onCreateFirst }) {
  const [i, setI] = useState(0);
  const last = i === CARDS.length - 1;
  const card = CARDS[i];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2800, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: 24, margin: 'auto', marginTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            App Tour · {i + 1} of {CARDS.length}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#999', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 22 }}>
          {CARDS.map((_, idx) => (
            <div key={idx} style={{ flex: 1, height: 5, borderRadius: 3, background: idx <= i ? RED : '#eee' }} />
          ))}
        </div>

        <div style={{ textAlign: 'center', padding: '4px 4px 8px' }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>{card.emoji}</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: '#111' }}>{card.title}</div>
          <div style={{ fontSize: 14.5, color: '#555', margin: '12px 0 4px', lineHeight: 1.6, minHeight: 70 }}>{card.body}</div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
          <button
            onClick={() => setI(n => Math.max(0, n - 1))}
            disabled={i === 0}
            style={{ background: 'none', border: '1px solid #ddd', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, color: i === 0 ? '#ccc' : '#444', cursor: i === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >← Back</button>
          <div style={{ flex: 1 }} />
          {!last ? (
            <button onClick={() => setI(n => Math.min(CARDS.length - 1, n + 1))} style={primaryBtn}>Next →</button>
          ) : onCreateFirst ? (
            <button onClick={onCreateFirst} style={primaryBtn}>Create my first deal →</button>
          ) : (
            <button onClick={onClose} style={primaryBtn}>Done</button>
          )}
        </div>
        {last && onCreateFirst && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>I'll explore on my own</button>
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtn = { background: RED, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' };
