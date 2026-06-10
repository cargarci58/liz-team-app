import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// OnboardingGuide — the first-time, step-by-step welcome walkthrough.
// Shows on a brand-new user's first sign-in. Walks them through the
// three setup steps, pointing at the ⚙️ Menu (top-right). Each step has
// a one-tap "Show me" that opens the real screen. Dismissible at any
// time ("Skip setup"); re-launchable from the Help Center.
//
// This is presentational — MainApp owns the step state + localStorage so
// the card can re-appear (advanced) after the user closes a target screen.
// Props:
//   steps:       [{ key, emoji, title, desc, where, go() }]
//   doneKeys:    Set of completed step keys
//   onTakeMeThere(step): mark done + open the screen (card hides while open)
//   onDismiss():  turn the walkthrough off
//   onFinish():   all done — close it
// ═══════════════════════════════════════════════════════════════

const RED = '#C0392B';

export default function OnboardingGuide({ steps, doneKeys, onTakeMeThere, onDismiss, onFinish }) {
  // The "current" step = first one not yet done.
  const currentIdx = steps.findIndex(s => !doneKeys.has(s.key));
  const allDone = currentIdx === -1;
  const [welcomed, setWelcomed] = useState(false);

  // Welcome splash first, then the checklist.
  if (!welcomed && doneKeys.size === 0) {
    return (
      <Overlay>
        <div style={{ textAlign: 'center', padding: '8px 4px' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>👋</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>Welcome! Let's get you set up.</div>
          <div style={{ fontSize: 14, color: '#555', margin: '10px 0 22px', lineHeight: 1.55 }}>
            Three quick steps and you're ready to go. We'll walk you through exactly where to click — it takes about 2 minutes.
          </div>
          <button onClick={() => setWelcomed(true)} style={primaryBtn}>Start setup →</button>
          <div>
            <button onClick={onDismiss} style={linkBtn}>I'll do it later</button>
          </div>
        </div>
      </Overlay>
    );
  }

  if (allDone) {
    return (
      <Overlay>
        <div style={{ textAlign: 'center', padding: '8px 4px' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>You're all set!</div>
          <div style={{ fontSize: 14, color: '#555', margin: '10px 0 22px', lineHeight: 1.55 }}>
            Nice work. You can re-open this anytime from the <strong>❓ Help</strong> button (bottom-right) or <strong>⚙️ Menu → ❓ Help</strong>.
          </div>
          <button onClick={onFinish} style={primaryBtn}>Go to my dashboard →</button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Setup · Step {currentIdx + 1} of {steps.length}
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', fontSize: 12, color: '#999', cursor: 'pointer', fontFamily: 'inherit' }}>Skip setup</button>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ flex: 1, height: 6, borderRadius: 3, background: doneKeys.has(s.key) ? RED : (i === currentIdx ? '#F1948A' : '#eee') }} />
        ))}
      </div>

      {steps.map((s, i) => {
        const done = doneKeys.has(s.key);
        const isCurrent = i === currentIdx;
        return (
          <div key={s.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 12, marginBottom: 10, border: isCurrent ? `2px solid ${RED}` : '1px solid #eee', background: isCurrent ? '#FCF3F2' : '#fff', opacity: done ? 0.7 : 1 }}>
            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: done ? '#1E8449' : (isCurrent ? RED : '#ccc'), color: '#fff', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {done ? '✓' : i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#222' }}>{s.emoji} {s.title}</div>
              <div style={{ fontSize: 13, color: '#555', margin: '4px 0 6px', lineHeight: 1.45 }}>{s.desc}</div>
              {isCurrent && (
                <>
                  <div style={{ fontSize: 12.5, color: '#777', marginBottom: 10, lineHeight: 1.5 }}>
                    👉 Where to click: <strong>{s.where}</strong> (top-right of your screen).
                  </div>
                  <button onClick={() => onTakeMeThere(s)} style={primaryBtn}>Show me — open it now →</button>
                </>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 6 }}>
        You can turn this off anytime — it'll always be in the ❓ Help button.
      </div>
    </Overlay>
  );
}

function Overlay({ children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2600, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: 24, margin: 'auto', marginTop: 40 }}>
        {children}
      </div>
    </div>
  );
}

const primaryBtn = { background: RED, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' };
const linkBtn = { background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer', marginTop: 14, fontFamily: 'inherit' };
