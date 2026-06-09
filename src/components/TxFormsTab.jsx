import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'https://liz-team-server-api-production.up.railway.app';

export default function TxFormsTab({ tx, side, isAdmin }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('All');
  const [sharing, setSharing] = useState(null);
  const token = () => localStorage.getItem('tp_token');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/forms?side=${side}`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await r.json();
      setForms(data.forms || []);
    } catch (e) { console.error('Forms load error:', e); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [side]);

  const categories = ['All', ...new Set(forms.map(f => f.category))];
  const filtered = filterCat === 'All' ? forms : forms.filter(f => f.category === filterCat);

  async function handleDownload(form) {
    if (!form.has_file) {
      alert(`📋 "${form.name}" is a placeholder.\n\nAn admin must upload the licensed PDF before this form can be downloaded. Open Settings → Forms Library to upload.`);
      return;
    }
    try {
      const r = await fetch(`${API}/forms/${form.id}/download-url`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await r.json();
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank');
      else alert(data.error || 'Download failed');
    } catch (e) { alert('Error: ' + e.message); }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#1e3a8a' }}>
        <strong>📋 Forms for this transaction</strong> — showing only forms that apply to the {side === 'listing' ? 'listing/seller side' : 'buyer side'}. Download to fill out and send, or use 🔗 Share to send a 7-day public link to a party. Need a form not listed here? Open Settings → Forms Library to add it.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {categories.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid', borderColor: filterCat === c ? '#6366f1' : '#d1d5db',
                     background: filterCat === c ? '#eef2ff' : 'white', color: filterCat === c ? '#4338ca' : '#374151',
                     fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: '#6b7280', background: '#f9fafb', borderRadius: 8 }}>
          No forms in this category for the {side} side.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(f => (
            <div key={f.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12,
                                       display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</span>
                  <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 4 }}>{f.category}</span>
                  {!f.has_file && <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>🚧 PLACEHOLDER</span>}
                </div>
                {f.description && <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>{f.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleDownload(f)} disabled={!f.has_file}
                  style={{ background: f.has_file ? '#059669' : '#9ca3af', color: 'white', border: 'none',
                           padding: '6px 12px', borderRadius: 6, cursor: f.has_file ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
                  ⬇️ Download
                </button>
                <button onClick={() => setSharing(f)} disabled={!f.has_file}
                  style={{ background: f.has_file ? '#6366f1' : '#9ca3af', color: 'white', border: 'none',
                           padding: '6px 12px', borderRadius: 6, cursor: f.has_file ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
                  🔗 Share Link
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sharing && <ShareLinkModal form={sharing} tx={tx} onClose={() => setSharing(null)} />}
    </div>
  );
}

function ShareLinkModal({ form, tx, onClose }) {
  const [step, setStep] = useState('confirm');
  const [linkData, setLinkData] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const token = () => localStorage.getItem('tp_token');

  async function generate() {
    setStep('generating');
    try {
      const r = await fetch(`${API}/forms/${form.id}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ transactionId: tx.id })
      });
      const data = await r.json();
      if (!r.ok) { setErrMsg(data.error || 'Failed'); setStep('error'); return; }
      setLinkData(data); setStep('done');
    } catch (e) { setErrMsg(e.message); setStep('error'); }
  }

  function copyLink() {
    if (!linkData?.url) return;
    navigator.clipboard.writeText(linkData.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems: 'flex-start', justifyContent:'center', zIndex:1000, overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background:'white', borderRadius:12, padding:24, maxWidth:480, width:'92%', margin: 'auto' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>🔗 Share Form Link</h2>

        {step === 'confirm' && (
          <>
            <div style={{ background:'#f9fafb', borderRadius:6, padding:12, marginBottom:12 }}>
              <div style={{ fontSize:12, color:'#6b7280' }}>Form</div>
              <div style={{ fontWeight:600 }}>{form.name}</div>
            </div>
            <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:6, padding:12, fontSize:13, color:'#78350f', marginBottom:16 }}>
              <strong>🎓 What this does:</strong> Generates a secure download link that expires in 7 days. Anyone with the link can download the form. Copy and paste it into chat, email, or text. Useful for sending a form to a co-op agent, lender, or client who isn't a TransactPro user.
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={onClose} style={{ background:'#e5e7eb', color:'#374151', border:'none', padding:'10px 18px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>Cancel</button>
              <button onClick={generate} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'white', border:'none', padding:'10px 18px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>Generate Link</button>
            </div>
          </>
        )}

        {step === 'generating' && <div style={{ textAlign:'center', padding:24, color:'#6366f1' }}>⏳ Generating secure link...</div>}

        {step === 'done' && linkData && (
          <>
            <div style={{ background:'#d1fae5', border:'1px solid #6ee7b7', borderRadius:6, padding:12, fontSize:13, color:'#064e3b', marginBottom:12 }}>
              ✓ Link generated. Expires {new Date(linkData.expiresAt).toLocaleDateString()} {new Date(linkData.expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              <input readOnly value={linkData.url} onClick={e => e.target.select()}
                style={{ flex:1, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:12, fontFamily:'monospace' }} />
              <button onClick={copyLink} style={{ background: copied ? '#059669' : '#6366f1', color:'white', border:'none', padding:'8px 14px', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:13 }}>
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:16 }}>Paste this link into chat, email, or a text message. The recipient does not need a TransactPro account.</div>
            <button onClick={onClose} style={{ background:'#e5e7eb', color:'#374151', border:'none', padding:'10px 18px', borderRadius:8, cursor:'pointer', fontWeight:600, width:'100%' }}>Done</button>
          </>
        )}

        {step === 'error' && (
          <>
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:12, fontSize:13, color:'#991b1b', marginBottom:16 }}>
              ⚠️ {errMsg}
            </div>
            <button onClick={onClose} style={{ background:'#e5e7eb', color:'#374151', border:'none', padding:'10px 18px', borderRadius:8, cursor:'pointer', fontWeight:600, width:'100%' }}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}
