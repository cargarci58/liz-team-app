import { useState, useEffect } from 'react';

const ROLE_LABELS = {
  buyer: 'Buyer',
  seller: 'Seller',
  agent: 'Agent (Our Side)',
  co_op_agent: 'Co-op Agent',
  title: 'Title / Closing',
  lender: 'Lender',
  inspector: 'Inspector',
  hoa: 'HOA / Condo',
  tc: 'Transaction Coordinator',
  general: 'General',
};

export default function FaqHelpButton({ transactionId, apiBase, token }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [roleBucket, setRoleBucket] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const url = transactionId
      ? `${apiBase}/transactions/${transactionId}/faqs`
      : `${apiBase}/me/faqs`;
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
      .then(data => {
        setRoleBucket(data.role_bucket);
        setFaqs(data.faqs || []);
      })
      .catch(err => {
        console.error('FAQ load error', err);
        setError('Could not load FAQs.');
      })
      .finally(() => setLoading(false));
  }, [open, transactionId, apiBase, token]);

  const toggle = (id) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const filtered = search.trim()
    ? faqs.filter(f =>
        f.question.toLowerCase().includes(search.toLowerCase()) ||
        f.answer.toLowerCase().includes(search.toLowerCase()))
    : faqs;

  // Group filtered by role_bucket (your role first, then general)
  const yourRoleFaqs = filtered.filter(f => f.role_bucket === roleBucket);
  const generalFaqs = filtered.filter(f => f.role_bucket === 'general' && roleBucket !== 'general');

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open FAQ help"
        title="Frequently Asked Questions for this transaction"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#C0392B',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          fontSize: '24px',
          fontWeight: 'bold',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ?
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#222' }}>
                  Help & FAQs
                </div>
                {roleBucket && (
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                    Showing answers for: <strong>{ROLE_LABELS[roleBucket] || roleBucket}</strong>
                  </div>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee' }}>
              <input
                type="text"
                placeholder="Search questions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {loading && <div style={{ color: '#666' }}>Loading…</div>}
              {error && <div style={{ color: '#C0392B' }}>{error}</div>}
              {!loading && !error && filtered.length === 0 && (
                <div style={{ color: '#666' }}>No FAQs match your search.</div>
              )}

              {!loading && !error && yourRoleFaqs.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                  }}>
                    For {ROLE_LABELS[roleBucket] || roleBucket}
                  </div>
                  {yourRoleFaqs.map(f => (
                    <FaqRow key={f.id} faq={f} isOpen={expanded.has(f.id)} onToggle={() => toggle(f.id)} />
                  ))}
                </div>
              )}

              {!loading && !error && generalFaqs.length > 0 && (
                <div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                  }}>
                    General
                  </div>
                  {generalFaqs.map(f => (
                    <FaqRow key={f.id} faq={f} isOpen={expanded.has(f.id)} onToggle={() => toggle(f.id)} />
                  ))}
                </div>
              )}
            </div>

            {/* Footer disclaimer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #eee',
              fontSize: '12px',
              color: '#888',
              background: '#fafafa',
            }}>
              These FAQs are educational only and not legal advice. For legal or tax questions, consult a real estate attorney or CPA.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FaqRow({ faq, isOpen, onToggle }) {
  return (
    <div style={{
      borderBottom: '1px solid #f0f0f0',
      padding: '10px 0',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          color: '#222',
          fontSize: '14px',
          fontWeight: '600',
        }}
      >
        <span>{faq.question}</span>
        <span style={{ color: '#999', flexShrink: 0 }}>{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div style={{
          marginTop: '8px',
          fontSize: '14px',
          color: '#444',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}>
          {faq.answer}
        </div>
      )}
    </div>
  );
}
