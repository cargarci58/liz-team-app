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
// Exported: the AI Assistant (AssistantPanel) answers "how do I…" questions
// from this same library, so help content has ONE source of truth.
export const GUIDE_SECTIONS = [
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
      {
        title: 'Get ALL deal emails into the app (even ones sent to your personal inbox)',
        steps: [
          'Every email the app sends already carries the deal\'s tracked address — when anyone hits Reply or Reply All, their message files itself to the deal automatically. No setup needed.',
          'Each deal also has its own email address: open the deal → Messages → Replies and copy it from the green box. Give it to the title company, lender, or the other agent — anything they send to it lands on that deal.',
          'For emails people send straight to YOUR inbox: go to ⚙️ Menu → 👤 My Profile → "Catch deal emails sent to your personal inbox" and follow the one-time Gmail/Outlook forwarding steps.',
          'Anything the app can\'t place automatically shows up on Win the Day under "📥 Mail to file" — file it to the right deal in one tap.',
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

export default function HelpCenter({ apiBase, token, onGoals, onProfile, onCompany, onRestartTour, onTour, isAdmin, openSignal, feedbackSignal, supportSignal }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('start'); // start | guides | faqs | feedback

  // ── Feedback / Report-a-problem form state ──
  const [fbKind, setFbKind] = useState('bug'); // bug | suggestion | other
  const [fbMessage, setFbMessage] = useState('');
  const [fbSending, setFbSending] = useState(false);
  const [fbDone, setFbDone] = useState(false);
  const [fbError, setFbError] = useState(null);

  const submitFeedback = () => {
    const msg = fbMessage.trim();
    if (!msg) { setFbError('Please tell us what happened or what you have in mind.'); return; }
    setFbSending(true); setFbError(null);
    fetch(`${apiBase}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind: fbKind, message: msg, page: (typeof window !== 'undefined' ? (window.location.hash || window.location.pathname) : '') }),
    })
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
      .then(() => { setFbDone(true); setFbMessage(''); })
      .catch(e => setFbError(e?.error || 'Could not send. Please try again.'))
      .finally(() => setFbSending(false));
  };

  // ── AI Support Assistant (🤖 Ask AI) chat state ──
  const [aiMessages, setAiMessages] = useState([]); // { role: 'user'|'assistant', content }
  const [aiInput, setAiInput] = useState('');
  const [aiSending, setAiSending] = useState(false);
  const [aiError, setAiError] = useState(null);

  const sendAi = (text) => {
    const q = (text != null ? text : aiInput).trim();
    if (!q || aiSending) return;
    const next = [...aiMessages, { role: 'user', content: q }];
    setAiMessages(next);
    setAiInput('');
    setAiSending(true);
    setAiError(null);
    fetch(`${apiBase}/support/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: next }),
    })
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
      .then(data => setAiMessages(m => [...m, { role: 'assistant', content: data.reply || "Sorry, I didn't catch that — could you rephrase?" }]))
      .catch(e => setAiError(e?.error || 'Could not reach the assistant. Please try again, or use the 📣 Feedback tab.'))
      .finally(() => setAiSending(false));
  };

  // Allow opening from elsewhere (⚙️ Menu → ❓ Help) by bumping `openSignal`.
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  // ⚙️ Menu → 📣 Feedback opens straight to the Feedback tab.
  useEffect(() => { if (feedbackSignal) { setTab('feedback'); setFbDone(false); setOpen(true); } }, [feedbackSignal]);
  // ⚙️ Menu → ✉️ Contact Support opens the same form pre-set to a support request.
  useEffect(() => { if (supportSignal) { setTab('feedback'); setFbKind('support'); setFbDone(false); setOpen(true); } }, [supportSignal]);
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
  // Order: Company → Profile → Goals (Company is admin-only, so non-admins start at Profile).
  const setupBase = [];
  if (isAdmin && onCompany) setupBase.push({ emoji: '⚙️', title: 'Set up company settings', desc: 'Add your brokerage name, logo, and branding — it shows on everything your clients see.', where: '⚙️ Menu → ⚙️ Company Settings', go: onCompany });
  setupBase.push({ emoji: '👤', title: 'Set up your profile', desc: 'Add your photo, signature, and contact info — used on every email and form.', where: '⚙️ Menu → 👤 My Profile', go: onProfile });
  setupBase.push({ emoji: '📥', title: 'Catch every deal email (2 min, once)', desc: 'Turn on email forwarding so messages sent straight to your inbox file themselves to the right deal automatically.', where: '⚙️ Menu → 👤 My Profile → 📥 Catch deal emails', go: onProfile });
  setupBase.push({ emoji: '🎯', title: 'Set up your goals', desc: 'Tell the app your income target so it can plan your day.', where: '⚙️ Menu → 🎯 Goal Planner', go: onGoals });
  const setupSteps = setupBase.map((s, i) => ({ ...s, n: i + 1 }));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Help"
        title="Help — guides & FAQs"
        className="help-fab"
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
              {tabBtn('ai', '🤖 Ask AI')}
              {tabBtn('guides', '📖 Guides')}
              {tabBtn('faqs', '💬 FAQs')}
              {tabBtn('feedback', '📣 Feedback')}
            </div>

            {/* Search (guides + faqs only) */}
            {(tab === 'guides' || tab === 'faqs') && (
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
                  {onTour && (
                    <button onClick={() => { setOpen(false); onTour(); }} style={{ marginTop: 6, marginBottom: 8, background: '#111', border: 'none', borderRadius: 8, padding: '11px 16px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>🎬 Take the 60-second app tour</button>
                  )}
                  {onRestartTour && (
                    <button onClick={() => { setOpen(false); onRestartTour(); }} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#444', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>↻ Replay the welcome walkthrough</button>
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

              {tab === 'ai' && (
                <div>
                  {aiMessages.length === 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 14, color: '#333', marginBottom: 12, lineHeight: 1.5 }}>
                        Hi! 👋 I'm your support assistant. Ask me anything about how to use the app — like "How do I receive an offer?" or "Where do I set my goals?"
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Try asking…</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                          'How do I start a new transaction?',
                          'How do I receive an offer?',
                          'Where do I set up my goals?',
                          'How do Pop-Bys work?',
                        ].map(q => (
                          <button key={q} onClick={() => sendAi(q)} style={{ padding: '8px 12px', borderRadius: 16, border: '1px solid #ddd', background: '#fff', color: '#444', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{q}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiMessages.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                      <div style={{
                        maxWidth: '85%', padding: '10px 13px', borderRadius: 14, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                        background: m.role === 'user' ? RED : '#F1F1F1',
                        color: m.role === 'user' ? '#fff' : '#222',
                        borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                        borderBottomLeftRadius: m.role === 'user' ? 14 : 4,
                      }}>{m.content}</div>
                    </div>
                  ))}
                  {aiSending && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                      <div style={{ padding: '10px 13px', borderRadius: 14, fontSize: 14, background: '#F1F1F1', color: '#888' }}>Thinking…</div>
                    </div>
                  )}
                  {aiError && <div style={{ color: RED, fontSize: 13, marginBottom: 10 }}>{aiError}</div>}

                  <div style={{ display: 'flex', gap: 8, marginTop: 6, position: 'sticky', bottom: 0, background: '#fff', paddingTop: 6 }}>
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') sendAi(); }}
                      placeholder="Type your question…"
                      style={{ flex: 1, padding: '11px 13px', border: '1px solid #ddd', borderRadius: 22, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                    <button onClick={() => sendAi()} disabled={aiSending || !aiInput.trim()} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '50%', border: 'none', background: (aiSending || !aiInput.trim()) ? '#ccc' : RED, color: '#fff', fontSize: 18, cursor: (aiSending || !aiInput.trim()) ? 'default' : 'pointer', fontFamily: 'inherit' }}>↑</button>
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 8, lineHeight: 1.4 }}>
                    AI answers can occasionally be off. For a bug or account issue, use the 📣 Feedback tab; for anything urgent on a live deal, call or text your broker.
                  </div>
                </div>
              )}

              {tab === 'feedback' && (
                <div>
                  {fbDone ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                      <div style={{ fontSize: 44, marginBottom: 8 }}>🙏</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#222', marginBottom: 6 }}>Thank you — we got it!</div>
                      <div style={{ fontSize: 13.5, color: '#555', lineHeight: 1.5, maxWidth: 380, margin: '0 auto 18px' }}>
                        Your note went straight to the team. We read every single one, and it helps us make the app better for you.
                      </div>
                      <button onClick={() => { setFbDone(false); setFbKind('bug'); }} style={{ background: RED, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Send another</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 14, color: '#333', marginBottom: 16, lineHeight: 1.5 }}>
                        Found a bug? Have an idea? Need a hand? Tell us — it goes straight to our team.
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>What kind of feedback is this?</div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        {[
                          { id: 'bug', label: '🐞 Something’s broken' },
                          { id: 'suggestion', label: '💡 Idea / request' },
                          { id: 'support', label: '🆘 Need help' },
                          { id: 'other', label: '💬 Other' },
                        ].map(opt => (
                          <button key={opt.id} onClick={() => setFbKind(opt.id)} style={{
                            flex: '1 1 auto', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: 13, fontWeight: 700,
                            border: fbKind === opt.id ? `2px solid ${RED}` : '1px solid #ddd',
                            background: fbKind === opt.id ? '#FCF3F2' : '#fff',
                            color: fbKind === opt.id ? RED : '#444',
                          }}>{opt.label}</button>
                        ))}
                      </div>
                      <textarea
                        value={fbMessage}
                        onChange={(e) => { setFbMessage(e.target.value); if (fbError) setFbError(null); }}
                        placeholder={fbKind === 'bug'
                          ? 'What happened? What were you trying to do, and what went wrong? The more detail, the faster we can fix it.'
                          : fbKind === 'suggestion'
                          ? 'What would you like to see? Describe the idea or the change you’re hoping for.'
                          : fbKind === 'support'
                          ? 'How can we help? Describe your question or the problem you’re running into and our support team will get back to you.'
                          : 'Tell us what’s on your mind.'}
                        rows={6}
                        maxLength={5000}
                        style={{ width: '100%', padding: '11px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
                      />
                      {fbError && <div style={{ color: RED, fontSize: 13, marginTop: 8 }}>{fbError}</div>}
                      <button
                        onClick={submitFeedback}
                        disabled={fbSending}
                        style={{ marginTop: 14, width: '100%', background: fbSending ? '#999' : RED, color: '#fff', border: 'none', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: 800, cursor: fbSending ? 'default' : 'pointer', fontFamily: 'inherit' }}
                      >{fbSending ? 'Sending…' : (fbKind === 'support' ? 'Send to support' : 'Send to the team')}</button>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 10, lineHeight: 1.45 }}>
                        We’ll know who sent it so we can follow up if needed. For an urgent issue with a live deal, call or text your contact directly.
                      </div>
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
