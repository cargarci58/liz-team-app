import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'https://liz-team-server-api-production.up.railway.app';

// Poll an enqueued AI job until it's done or fails.
async function pollAiJob(jobId, { timeoutMs = 120000, intervalMs = 1500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, intervalMs));
    const r = await fetch(`${API}/ai-jobs/${jobId}`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('tp_token') }
    });
    if (!r.ok) throw new Error('Job lookup failed');
    const data = await r.json();
    const job = data.job;
    if (!job) throw new Error('Job not found');
    if (job.status === 'completed') return job.result || {};
    if (job.status === 'failed') throw new Error(job.error || 'AI job failed');
  }
  throw new Error('AI job timed out');
}

export default function PreApprovalCard({ transactionId, isAgent = true, onChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/transactions/${transactionId}/preapproval`, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('tp_token') }
      });
      const j = await r.json();
      setData(j);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (transactionId) load(); }, [transactionId]);

  const view = async () => {
    const r = await fetch(`${API}/transactions/${transactionId}/preapproval/view-url`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('tp_token') }
    });
    const { url } = await r.json();
    window.open(url, '_blank');
  };

  if (loading) {
    return <div style={cardStyle}><div style={{ color: '#888' }}>Loading pre-approval…</div></div>;
  }

  const pa = data?.preapproval;

  // Empty state
  if (!pa) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 18 }}>💰</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Pre-Approval Letter</span>
        </div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
          No pre-approval on file
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          Required to build offers. Buyers can also upload from their Client Portal.
        </div>
        <button onClick={() => setUploadOpen(true)} style={primaryBtn}>📤 Upload Pre-Approval</button>
        {uploadOpen && (
          <UploadModal
            transactionId={transactionId}
            onClose={() => setUploadOpen(false)}
            onSaved={() => { setUploadOpen(false); load(); onChange && onChange(); }}
          />
        )}
      </div>
    );
  }

  // Has letter — show status
  const expBadge = data.is_expired
    ? { bg: '#fee', color: '#c00', label: '🚨 EXPIRED' }
    : data.expiring_soon
      ? { bg: '#fff4e0', color: '#a05a00', label: `⚠️ Expires in ${data.days_until_expiration} day${data.days_until_expiration === 1 ? '' : 's'}` }
      : null;

  const fmtMoney = n => n ? `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 18 }}>💰</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Pre-Approval Letter</span>
      </div>

      {expBadge && (
        <div style={{
          background: expBadge.bg, color: expBadge.color, padding: '6px 10px',
          borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 10
        }}>{expBadge.label}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12, fontSize: 13 }}>
        <div><span style={lbl}>Lender</span><div>{pa.lender_company || pa.lender_name || '—'}</div></div>
        <div><span style={lbl}>Loan Type</span><div>{pa.loan_type || '—'}</div></div>
        <div><span style={lbl}>Max Loan</span><div>{fmtMoney(pa.loan_amount)}</div></div>
        <div><span style={lbl}>Expires</span><div>{fmtDate(pa.expiration_date)}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={view} style={secondaryBtn}>👁 View</button>
        {isAgent && <button onClick={() => setUploadOpen(true)} style={secondaryBtn}>🔄 Replace</button>}
      </div>

      {uploadOpen && (
        <UploadModal
          transactionId={transactionId}
          onClose={() => setUploadOpen(false)}
          onSaved={() => { setUploadOpen(false); load(); onChange && onChange(); }}
        />
      )}
    </div>
  );
}

function UploadModal({ transactionId, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [stage, setStage] = useState('pick');
  const [createLenderParty, setCreateLenderParty] = useState(true); // pick | uploading | extracting | review | saving
  const [extracted, setExtracted] = useState(null);
  const [keyAndName, setKeyAndName] = useState(null);
  const [error, setError] = useState('');

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf')) {
      setError('Please upload a PDF file');
      return;
    }
    setError('');
    setStage('uploading');
    try {
      if (file.size > 9 * 1024 * 1024) throw new Error('File too large (max 9 MB)');

      // Read file as base64 and upload via server proxy (no R2 CORS issue)
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          const comma = result.indexOf(',');
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const upRes = await fetch(`${API}/transactions/${transactionId}/preapproval/upload-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('tp_token') },
        body: JSON.stringify({ filename: file.name, contentType: file.type, base64 })
      });
      const upBody = await upRes.json();
      if (!upRes.ok) throw new Error(upBody.error || 'Upload failed');
      const key = upBody.key;

      setKeyAndName({ key, filename: file.name });
      setStage('extracting');

      // 3) Enqueue AI extraction
      const exRes = await fetch(`${API}/transactions/${transactionId}/preapproval/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('tp_token') },
        body: JSON.stringify({ key })
      });
      const enqueued = await exRes.json();
      if (enqueued.error || !enqueued.jobId) throw new Error(enqueued.error || 'Could not start extraction');

      // 4) Poll until done
      const ex = await pollAiJob(enqueued.jobId);
      setExtracted({
        lender_company: ex.lender_company || '',
        loan_officer_name: ex.loan_officer_name || '',
        loan_officer_email: ex.loan_officer_email || '',
        loan_officer_phone: ex.loan_officer_phone || '',
        nmls_number: ex.nmls_number || '',
        loan_amount: ex.loan_amount || '',
        loan_type: ex.loan_type || '',
        expiration_date: ex.expiration_date || '',
      });
      setStage('review');
    } catch (e) {
      setError(e.message || 'Upload failed');
      setStage('pick');
    }
  };

  const save = async () => {
    setStage('saving');
    try {
      const res = await fetch(`${API}/transactions/${transactionId}/preapproval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('tp_token') },
        body: JSON.stringify({
          key: keyAndName.key,
          filename: keyAndName.filename,
          lender_company: extracted.lender_company,
          loan_officer_name: extracted.loan_officer_name,
          loan_officer_email: extracted.loan_officer_email,
          loan_officer_phone: extracted.loan_officer_phone,
          nmls_number: extracted.nmls_number,
          loan_amount: extracted.loan_amount,
          loan_type: extracted.loan_type,
          expiration_date: extracted.expiration_date,
          create_lender_party: createLenderParty,
        })
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      onSaved();
    } catch (e) {
      setError(e.message);
      setStage('review');
    }
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px 0' }}>📤 Upload Pre-Approval Letter</h3>
        <div style={teachBanner}>
          🎓 The pre-approval letter proves your buyer is financially qualified. Sellers require it with every offer. Upload a PDF and AI will extract the key details for your review.
        </div>

        {error && <div style={{ color: '#c00', marginBottom: 10, fontSize: 13 }}>{error}</div>}

        {stage === 'pick' && (
          <div>
            <input ref={fileRef} type="file" accept="application/pdf" onChange={onPick} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 12, color: '#888' }}>PDF only, max 10MB</div>
          </div>
        )}

        {stage === 'uploading' && <div style={statusLine}>⏳ Uploading to secure storage…</div>}
        {stage === 'extracting' && <div style={statusLine}>🤖 AI is reading the letter…</div>}
        {stage === 'saving' && <div style={statusLine}>💾 Saving…</div>}

        {stage === 'review' && extracted && (
          <div>
            <div style={{ fontSize: 13, color: '#444', marginBottom: 10 }}>
              ✨ AI extracted these fields. Review and correct before saving:
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 6px' }}>Lender Info</div>
            <FormField label="Lender Company" value={extracted.lender_company || ''}
              onChange={v => setExtracted({ ...extracted, lender_company: v })} />
            <FormField label="Loan Officer Name" value={extracted.loan_officer_name || ''}
              onChange={v => setExtracted({ ...extracted, loan_officer_name: v })} />
            <FormField label="Loan Officer Email" value={extracted.loan_officer_email || ''} type="email"
              onChange={v => setExtracted({ ...extracted, loan_officer_email: v })} />
            <FormField label="Loan Officer Phone" value={extracted.loan_officer_phone || ''}
              onChange={v => setExtracted({ ...extracted, loan_officer_phone: v })} />
            <FormField label="NMLS #" value={extracted.nmls_number || ''}
              onChange={v => setExtracted({ ...extracted, nmls_number: v })} />

            <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 6px' }}>Loan Details</div>
            <FormField label="Loan Type" value={extracted.loan_type || ''}
              onChange={v => setExtracted({ ...extracted, loan_type: v })}
              options={['Conventional', 'FHA', 'VA', 'USDA', 'Jumbo', 'Other']} />
            <FormField label="Max Loan Amount ($)" value={extracted.loan_amount || ''} type="number"
              onChange={v => setExtracted({ ...extracted, loan_amount: v ? Number(v) : null })} />
            <FormField label="Expiration Date" value={extracted.expiration_date || ''} type="date"
              onChange={v => setExtracted({ ...extracted, expiration_date: v })} />

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, marginTop: 14 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={createLenderParty} onChange={e => setCreateLenderParty(e.target.checked)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0c4a6e' }}>📋 Auto-create Lender party</div>
                  <div style={{ fontSize: 12, color: '#075985', marginTop: 2 }}>
                    Add the loan officer as a Lender party on this transaction (skipped if a Lender already exists). You can send them a welcome email after.
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          {stage === 'review' && <button onClick={save} style={primaryBtn}>💾 Save Pre-Approval</button>}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', options }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>{label}</div>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
          <option value="">— Select —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
      )}
    </div>
  );
}

// Module-level cache so the badge can render on every PartyCard without
// firing a separate fetch per card (Parties tab with 8 vendors = 8 identical
// hits otherwise). 30s TTL is plenty for a status indicator.
const __preapprovalCache = new Map();
const __PA_CACHE_TTL = 30 * 1000;
function fetchPreapprovalCached(transactionId) {
  const cached = __preapprovalCache.get(transactionId);
  if (cached && Date.now() - cached.ts < __PA_CACHE_TTL) return cached.promise;
  const promise = fetch(`${API}/transactions/${transactionId}/preapproval`, {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('tp_token') }
  }).then(r => r.json()).catch(() => null);
  __preapprovalCache.set(transactionId, { promise, ts: Date.now() });
  return promise;
}

// Small badge for PartyCard
export function PreApprovalBadge({ transactionId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchPreapprovalCached(transactionId).then(d => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, [transactionId]);

  if (!data) return null;
  if (!data.preapproval) {
    return <div style={{ fontSize: 11, color: '#c00', marginTop: 6 }}>💰 No pre-approval on file</div>;
  }
  if (data.is_expired) {
    return <div style={{ fontSize: 11, color: '#c00', marginTop: 6, fontWeight: 600 }}>💰 🚨 Pre-approval EXPIRED</div>;
  }
  if (data.expiring_soon) {
    return <div style={{ fontSize: 11, color: '#a05a00', marginTop: 6, fontWeight: 600 }}>💰 ⚠️ Pre-approval expires in {data.days_until_expiration}d</div>;
  }
  return <div style={{ fontSize: 11, color: '#080', marginTop: 6 }}>💰 ✅ Pre-approval current</div>;
}

// Styles
const cardStyle = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 14, marginBottom: 12 };
const headerStyle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 };
const lbl = { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 };
const primaryBtn = { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 13 };
const secondaryBtn = { background: '#f3f4f6', color: '#333', border: '1px solid #ddd', borderRadius: 6, padding: '7px 12px', fontWeight: 500, cursor: 'pointer', fontSize: 13 };
const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalBox = { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%', maxHeight: '90vh', overflow: 'auto' };
const teachBanner = { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14, lineHeight: 1.5 };
const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const statusLine = { padding: '12px 0', color: '#555', fontSize: 14 };
