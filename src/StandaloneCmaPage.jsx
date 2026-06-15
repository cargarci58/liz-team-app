// ============================================================================
// STANDALONE CMA PAGE
// A Comparative Market Analysis the agent runs BEFORE a transaction exists —
// e.g. a pre-listing valuation / listing presentation. Lists the agent's saved
// CMAs (GET /cmas), opens the full CMA tool in standalone mode, and hands a
// finished CMA up to the app to spin into a real transaction.
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import CmaTool from './cma/CmaTool';

const API_BASE = 'https://liz-team-server-api-production.up.railway.app';

const fmtMoney = (n) =>
  n == null || n === '' ? '—' : '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmtDate = (s) => {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
};

export default function StandaloneCmaPage({ token, currentUser, onBack, onCreateTransactionFromCma }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState('list'); // 'list' | 'tool'
  const [current, setCurrent] = useState(null); // full CMA object when reopening, null for a new one
  const [busy, setBusy] = useState(false);

  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(API_BASE + '/cmas', { headers: { Authorization: 'Bearer ' + token } });
      const d = await r.json().catch(() => ({}));
      setList(d.success ? (d.cmas || []) : []);
    } catch { setList([]); }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadList(); }, [loadList]);

  const openNew = () => { setCurrent(null); setScreen('tool'); };

  const openSaved = async (id) => {
    setBusy(true);
    try {
      const r = await fetch(API_BASE + '/cmas/' + id, { headers: { Authorization: 'Bearer ' + token } });
      const d = await r.json().catch(() => ({}));
      if (d.success && d.cma) { setCurrent(d.cma); setScreen('tool'); }
      else alert('Could not open that CMA.');
    } catch { alert('Could not open that CMA.'); }
    setBusy(false);
  };

  const deleteSaved = async (id, label) => {
    if (!window.confirm(`Delete the CMA for "${label || 'this property'}"? This can't be undone.`)) return;
    try {
      const r = await fetch(API_BASE + '/cmas/' + id, { method: 'DELETE', headers });
      if (r.ok) setList((l) => l.filter((c) => c.id !== id));
    } catch { /* ignore */ }
  };

  const backToList = () => { setScreen('list'); setCurrent(null); loadList(); };

  // ── Tool screen ──────────────────────────────────────────────────────────
  if (screen === 'tool') {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f5f7' }}>
        <div style={{ background: '#1a2b4a', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={backToList} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20, opacity: 0.8 }}>←</button>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>CMA — back to my CMAs</div>
        </div>
        <CmaTool
          standalone
          initialCma={current}
          token={token}
          currentUser={currentUser}
          onConvertToTransaction={(payload) => onCreateTransactionFromCma && onCreateTransactionFromCma(payload)}
        />
      </div>
    );
  }

  // ── List / launcher screen ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background: '#1a2b4a', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 22, opacity: 0.7 }}>←</button>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>📊 CMA — Comparative Market Analysis</div>
      </div>

      <div style={{ maxWidth: 880, margin: '28px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, color: '#1a2b4a' }}>My CMAs</h2>
            <div style={{ fontSize: 13, color: '#667085' }}>
              Run a pricing analysis before a deal exists. Save it, then turn it into a transaction when you win the listing.
            </div>
          </div>
          <button onClick={openNew} style={{ background: '#C0392B', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            ＋ New CMA
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#667085' }}>Loading your CMAs…</div>
        ) : list.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e4e7ec', borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2b4a', marginBottom: 6 }}>No CMAs yet</div>
            <div style={{ fontSize: 13, color: '#667085', maxWidth: 440, margin: '0 auto 18px' }}>
              Start a pricing analysis for a property you're about to list. You can pull MLS comps, set the recommended price, and save it here — no transaction required.
            </div>
            <button onClick={openNew} style={{ background: '#C0392B', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              ＋ Start your first CMA
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {list.map((c) => (
              <div key={c.id} style={{ background: '#fff', border: '1px solid #e4e7ec', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a2b4a', lineHeight: 1.3 }}>{c.label || 'Untitled CMA'}</div>
                <div style={{ fontSize: 13, color: '#475467' }}>
                  Recommended: <strong style={{ color: '#1a2b4a' }}>{fmtMoney(c.recommended_price)}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#98a2b3' }}>Updated {fmtDate(c.updated_at || c.created_at)}</div>
                {c.converted_transaction_id && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1E8449', background: '#eafaf1', borderRadius: 8, padding: '3px 8px', alignSelf: 'flex-start' }}>
                    ✓ Became a transaction
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button onClick={() => openSaved(c.id)} disabled={busy} style={{ flex: 1, background: '#1a2b4a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Open</button>
                  <button onClick={() => deleteSaved(c.id, c.label)} style={{ background: '#fff', color: '#C0392B', border: '1px solid #f0d0cb', borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
