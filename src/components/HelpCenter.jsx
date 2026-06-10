import { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// HelpCenter — the app-wide "?" help. Three tabs:
//   1) Start Here   → the 1-2-3 first-day setup (Goals → Profile → Company)
//   2) How-To       → searchable step-by-step guides for every common task
//   3) FAQs         → role-based Q&A from the server (/me/faqs)
// Every guide is written as simple numbered steps that tell the user
// exactly where to click. Built to be opened from the floating button
// AND from ⚙️ Menu → ❓ Help.
// ═══════════════════════════════════════════════════════════════

const ROLE_LABELS = {
  buyer: 'Buyer', seller: 'Seller', agent: 'Agent (Our Side)',
  co_op_agent: 'Co-op Agent', title: 'Title / Closing', lender: 'Lender',
  inspector: 'Inspector', hoa: 'HOA / Condo', tc: 'Transaction Coordinator',
  general: 'General',
};

// Each guide: { title, where (one-liner on where to find it), steps: [..] }
// `cta` (optional) wires a "Take me there" button to a real screen.
const GUIDE_SECTIONS = [
  {
    heading: 'Daily use',
    items: [
      {
        title: 'Start a new transaction',
        steps: [
          'Click the red "+ New Transaction" button at the top of your dashboard.',
          'Fill in the property address, the type (listing or buyer), and the key dates.',
          'Hit Save — your timeline, checklist, and reminders build themselves automatically.',
        ],
      },
      {
        title: 'Add a contact',
        steps: [
          'Click "📇 Contacts" in the top bar.',
          'Tap "+ Add Contact" and enter their name, email, and phone.',
          'Save — they\'re now available everywhere you send emails or share documents.',
        ],
      },
      {
        title: 'Work your "Win the Day" list',
        steps: [
          'Click the "Win the Day" button in the top bar.',
          'Each card is one thing to do today — a reminder, a nudge, or a follow-up.',
          'Do it, then tap the card to mark it done or "Not Today" to push it.',
        ],
      },
      {
        title: 'See everything for one deal',
        steps: [
          'On the dashboard, click any transaction card.',
          'Use the tabs (Overview, Timeline, Documents, Parties, Messages) to move around.',
          'The Timeline tab is your step-by-step checklist for that deal.',
        ],
      },
    ],
  },
  {
    heading: 'Documents & offers',
    items: [
      {
        title: 'Share a document with a client',
        steps: [
          'Open a transaction and go to the "Documents" tab.',
          'Find the document, then click the "📤 Share" button next to it.',
          'Pick who gets it (or type any email) and send — it goes out in your name.',
        ],
      },
      {
        title: 'Receive an offer on your listing',
        steps: [
          'Open one of your Active listings.',
          'Click "📥 Receive Offer" and upload the offer — it parks as a pending offer (no emails go out yet).',
          'Review your pending offers, then approve the one your seller accepts.',
        ],
      },
      {
        title: 'Send your forms (FAR/BAR, disclosures…)',
        steps: [
          'Open ⚙️ Menu → "📋 Forms Library" (or the Forms tab inside a deal).',
          'Pick the form you need and fill it in.',
          'Save or send it straight to your client.',
        ],
      },
    ],
  },
  {
    heading: 'Grow your business',
    items: [
      {
        title: 'Run a CMA (pricing report)',
        steps: [
          'Open a buyer or seller transaction.',
          'Go to the CMA tab and enter the subject property + comps.',
          'Generate the report, then print or email the Seller version.',
        ],
      },
      {
        title: 'Send Pop-By gifts',
        steps: [
          'Click "🎁 Pop-Bys" in the top bar.',
          'Pick the contacts you want to visit — the app suggests a gift and a note for each.',
          'Use the map route to plan your run, then mark each one delivered.',
        ],
      },
      {
        title: 'Invite a new buyer or seller (intake)',
        steps: [
          'Click "🔗 New Buyer/Seller Intake" in the top bar.',
          'Copy the buyer or seller link and text/email it to your new client.',
          'When they fill it out, a new lead lands in your pipeline automatically.',
        ],
      },
      {
        title: 'Check your numbers (Reports)',
        steps: [
          'Open ⚙️ Menu → "📊 Reports".',
          'Review your activity, conversion funnel, and pipeline.',
          'Use the Goal Planner tab to back-calculate the daily calls you need to hit your income goal.',
        ],
      },
    ],
  },
  {
    heading: 'Money',
    items: [
      {
        title: 'Track expenses & see your P&L',
        steps: [
          'Click "💵 Financials" in the top bar.',
          'Start in the simple "Money" view — add an expense or import a bank statement.',
          'Closed-deal commission flows in on its own; flip to the Advanced view only if you want full accounting.',
        ],
      },
    ],
  },
];

export default function HelpCenter({ apiBase, token, onGoals, onProfile, onCompany, onRestartTour, isAdmin, openSignal }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('start'); // start | guides | faqs

  // Allow opening from elsewhere (⚙️ Menu → ❓ Help) by bumping `openSignal`.
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());

  // FAQs (role-based, loaded lazily when the FAQs tab is first opened)
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqError, setFaqError] = useState(null);
  const [roleBucket, setRoleBucket] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [faqLoaded, setFaqLoaded] = useState(false);

  useEffect(() => {
    if (!open || tab !== 'faqs' || faqLoaded) return;
    setFaqLoading(true); setFaqError(null);
    fetch(`${apiBase}/me/faqs`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
      .then(data => { setRoleBucket(data.role_bucket); setFaqs(data.faqs || []); setFaqLoaded(true); })
      .catch(() => setFaqError('Could not load FAQs.'))
      .finally(() => setFaqLoading(false));
  }, [open, tab, faqLoaded, apiBase, token]);

  const toggle = (key) => {
    const next = new Set(expanded);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpanded(next);
  };

  const matches = (txt) => !search.trim() || txt.toLowerCase().includes(search.toLowerCase());

  // Filter how-to guides by search
  const filteredSections = GUIDE_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.filter(it => matches(it.title) || it.steps.some(matches)),
  })).filter(sec => sec.items.length > 0);

  const yourRoleFaqs = faqs.filter(f => (!search.trim() || matches(f.question) || matches(f.answer)) && f.role_bucket === roleBucket);
  const generalFaqs = faqs.filter(f => (!search.trim() || matches(f.question) || matches(f.answer)) && f.role_bucket === 'general' && roleBucket !== 'general');

  const RED = '#C0392B';

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer',
        background: tab === id ? '#fff' : 'transparent',
        color: tab === id ? RED : '#666',
        fontWeight: tab === id ? 800 : 600, fontSize: 13,
        borderBottom: tab === id ? `2px solid ${RED}` : '2px solid transparent',
        fontFamily: 'inherit',
      }}
    >{label}</button>
  );

  const StepGuide = ({ gkey, title, steps, footer }) => {
    const isOpen = expanded.has(gkey);
    return (
      <div style={{ border: '1px solid #eee', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
        <button onClick={() => toggle(gkey)} style={{ width: '100%', textAlign: 'left', background: isOpen ? '#FCF3F2' : '#fff', border: 'none', padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, color: '#222', fontFamily: 'inherit' }}>
          <span>{title}</span>
          <span style={{ color: RED, flexShrink: 0, fontSize: 18 }}>{isOpen ? '−' : '+'}</span>
        </button>
        {isOpen && (
          <div style={{ padding: '4px 14px 14px' }}>
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
              {steps.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 10 }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: RED, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span style={{ fontSize: 13.5, color: '#333', lineHeight: 1.5 }}>{s}</span>
                </li>
              ))}
            </ol>
            {footer}
          </div>
        )}
      </div>
    );
  };

  // The 1-2-3 "Start Here" setup steps, wired to real screens.
  const setupSteps = [
    { n: 1, emoji: '🎯', title: 'Set up your goals', desc: 'Tell the app your income target so it can plan your day.', where: '⚙️ Menu → 🎯 Goal Planner', go: onGoals },
    { n: 2, emoji: '👤', title: 'Set up your profile', desc: 'Add your photo, signature, and contact info — used on every email and form.', where: '⚙️ Menu → 👤 My Profile', go: onProfile },
  ];
  if (isAdmin && onCompany) {
    setupSteps.push({ n: 3, emoji: '⚙️', title: 'Set up company settings', desc: 'Add your brokerage name, logo, and branding.', where: '⚙️ Menu → ⚙️ Company Settings', go: onCompany });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Help"
        title="Help — guides & FAQs"
        style={{ position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%', background: RED, color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: 24, fontWeight: 'bold', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >?</button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Header */}
            <div style={{ background: '#111', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>❓ Help Center</div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', background: '#f5f5f5', borderBottom: '1px solid #eee' }}>
              {tabBtn('start', '🚀 Start Here')}
              {tabBtn('guides', '📖 How-To Guides')}
              {tabBtn('faqs', '💬 FAQs')}
            </div>

            {/* Search (guides + faqs only) */}
            {tab !== 'start' && (
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee' }}>
                <input type="text" placeholder={tab === 'guides' ? 'Search guides…' : 'Search questions…'} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            )}

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {tab === 'start' && (
                <div>
                  <div style={{ fontSize: 14, color: '#333', marginBottom: 16, lineHeight: 1.5 }}>
                    New here? Do these three things first. Each button takes you straight to the right screen.
                  </div>
                  {setupSteps.map(s => (
                    <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, border: '1px solid #eee', borderRadius: 12, marginBottom: 12 }}>
                      <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: RED, color: '#fff', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.n}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#222' }}>{s.emoji} {s.title}</div>
                        <div style={{ fontSize: 13, color: '#555', margin: '4px 0 6px', lineHeight: 1.45 }}>{s.desc}</div>
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>Find it at: {s.where}</div>
                        {s.go && (
                          <button onClick={() => { setOpen(false); s.go(); }} style={{ background: RED, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Take me there →</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {onRestartTour && (
                    <button onClick={() => { setOpen(false); onRestartTour(); }} style={{ marginTop: 6, background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#444', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>↻ Replay the welcome walkthrough</button>
                  )}
                </div>
              )}

              {tab === 'guides' && (
                <div>
                  {filteredSections.length === 0 && <div style={{ color: '#666' }}>No guides match your search.</div>}
                  {filteredSections.map(sec => (
                    <div key={sec.heading} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{sec.heading}</div>
                      {sec.items.map(it => (
                        <StepGuide key={it.title} gkey={`g:${it.title}`} title={it.title} steps={it.steps} />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {tab === 'faqs' && (
                <div>
                  {faqLoading && <div style={{ color: '#666' }}>Loading…</div>}
                  {faqError && <div style={{ color: RED }}>{faqError}</div>}
                  {!faqLoading && !faqError && faqLoaded && yourRoleFaqs.length === 0 && generalFaqs.length === 0 && (
                    <div style={{ color: '#666' }}>No questions match your search.</div>
                  )}
                  {yourRoleFaqs.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>For {ROLE_LABELS[roleBucket] || roleBucket}</div>
                      {yourRoleFaqs.map(f => (
                        <StepGuide key={f.id} gkey={`f:${f.id}`} title={f.question} steps={[f.answer]} />
                      ))}
                    </div>
                  )}
                  {generalFaqs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>General</div>
                      {generalFaqs.map(f => (
                        <StepGuide key={f.id} gkey={`f:${f.id}`} title={f.question} steps={[f.answer]} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', fontSize: 12, color: '#888', background: '#fafafa' }}>
              These guides are educational only and not legal advice. For legal or tax questions, consult a real estate attorney or CPA.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
