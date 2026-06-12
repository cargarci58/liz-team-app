import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'https://liz-team-server-api-production.up.railway.app';
const CATEGORIES = ['Disclosures','Addendums','Checklists','Marketing','Brokerage Policies','Other'];
const SIDE_LABELS = { listing: '🏠 Listing', buyer: '🔑 Buyer' };

export default function FormsPage({ user, onBack }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('All');
  const [filterSide, setFilterSide] = useState('All');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [editingForm, setEditingForm] = useState(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const token = () => localStorage.getItem('tp_token');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/forms`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await r.json();
      setForms(data.forms || []);
    } catch (e) { alert('Failed to load forms: ' + e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = forms.filter(f => {
    if (filterCat !== 'All' && f.category !== filterCat) return false;
    if (filterSide !== 'All' && !(f.sides || []).includes(filterSide)) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f); return acc;
  }, {});

  async function handleDownload(form) {
    if (!form.has_file) {
      alert(`📋 "${form.name}"\n\nThis form is a placeholder. An admin must upload the licensed PDF before agents can download or share it.`);
      return;
    }
    try {
      let r;
      try {
        r = await fetch(`${API}/forms/${form.id}/download-url`, { headers: { Authorization: `Bearer ${token()}` } });
      } catch (netErr) {
        throw new Error(`Cannot reach the server at ${API} — ${netErr.message}. Check your connection or browser devtools → Network for the blocked request.`);
      }
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        throw new Error(`Server returned HTTP ${r.status}. ${body.slice(0, 200)}`);
      }
      const data = await r.json();
      if (data.downloadUrl) window.open(data.downloadUrl, '_blank');
      else alert(data.error || 'Download failed');
    } catch (e) { console.error('[forms] download failed', e); alert('Download error: ' + e.message); }
  }

  async function handleDelete(form) {
    if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    try {
      const r = await fetch(`${API}/forms/${form.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
      if (!r.ok) { const d = await r.json(); alert(d.error || 'Delete failed'); return; }
      load();
    } catch (e) { alert('Delete error: ' + e.message); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => onBack && onBack()} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4 }} title="Back to dashboard">←</button>
          <h1 style={{ margin: 0, fontSize: 28 }}>📋 Forms Library</h1>
        </div>
        {isAdmin && (
          <button onClick={() => setShowUpload(true)}
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none',
                     padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            ➕ Add Form
          </button>
        )}
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#1e3a8a' }}>
        <strong>💡 What is this?</strong> Your brokerage's forms in one place. Agents can download to fill out manually, or send to clients/co-op agents via chat or shareable link. Placeholders (🚧) need a licensed PDF uploaded by an admin before they can be used.
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <input type="text" placeholder="🔍 Search forms..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 200px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterSide} onChange={e => setFilterSide(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}>
          <option value="All">Both Sides</option>
          <option value="listing">🏠 Listing only</option>
          <option value="buyer">🔑 Buyer only</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading forms...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', background: '#f9fafb', borderRadius: 8 }}>
          No forms match your filters.
        </div>
      ) : (
        Object.keys(grouped).sort().map(cat => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, color: '#374151', margin: '0 0 8px 0', paddingBottom: 6, borderBottom: '2px solid #e5e7eb' }}>{cat}</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {grouped[cat].map(f => (
                <FormCard key={f.id} form={f} isAdmin={isAdmin}
                  onDownload={() => handleDownload(f)}
                  onEdit={() => setEditingForm(f)}
                  onDelete={() => handleDelete(f)}
                  onReload={load} />
              ))}
            </div>
          </div>
        ))
      )}

      {showUpload && <UploadFormModal onClose={() => setShowUpload(false)} onSaved={() => { setShowUpload(false); load(); }} />}
      {editingForm && <EditFormModal form={editingForm} onClose={() => setEditingForm(null)} onSaved={() => { setEditingForm(null); load(); }} />}
    </div>
  );
}

function FormCard({ form, isAdmin, onDownload, onEdit, onDelete, onReload }) {
  const sideBadges = (form.sides || []).map(s => SIDE_LABELS[s] || s).join('  ·  ');
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{form.name}</span>
          {!form.has_file && <span title="No file uploaded" style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>🚧 PLACEHOLDER</span>}
          {form.is_system_default && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>System</span>}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sideBadges}</div>
        {form.description && <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>{form.description}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onDownload} title={form.has_file ? 'Download' : 'No file yet'}
          style={{ background: form.has_file ? '#059669' : '#9ca3af', color: 'white', border: 'none',
                   padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ⬇️ Download
        </button>
        {isAdmin && (
          <>
            <button onClick={onEdit} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>✏️</button>
            <button onClick={onDelete} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>🗑️</button>
          </>
        )}
      </div>
    </div>
  );
}

function UploadFormModal({ onClose, onSaved }) {
  const [step, setStep] = useState(1); // 1=pick file, 2=AI suggest+confirm, 3=uploading
  const [file, setFile] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [meta, setMeta] = useState({ name: '', category: 'Disclosures', sides: ['listing','buyer'], description: '' });
  const [progress, setProgress] = useState('');
  const token = () => localStorage.getItem('tp_token');

  async function handleFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f); setSuggesting(true);
    try {
      const r = await fetch(`${API}/forms/ai-suggest`, {
        method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ fileName: f.name })
      });
      const data = await r.json();
      if (data.suggestion) setMeta({
        name: data.suggestion.name || f.name.replace(/\.pdf$/i,''),
        category: data.suggestion.category || 'Other',
        sides: data.suggestion.sides && data.suggestion.sides.length ? data.suggestion.sides : ['listing','buyer'],
        description: data.suggestion.description || ''
      });
      setStep(2);
    } catch (err) {
      setMeta({ ...meta, name: f.name.replace(/\.pdf$/i,'') });
      setStep(2);
    } finally { setSuggesting(false); }
  }

  function toggleSide(s) {
    setMeta(m => {
      const has = m.sides.includes(s);
      const next = has ? m.sides.filter(x => x !== s) : [...m.sides, s];
      return { ...m, sides: next.length ? next : [s] };
    });
  }

  async function handleSave() {
    if (!meta.name || !meta.category) { alert('Name and category required'); return; }
    setStep(3); setProgress('Creating form...');
    try {
      const cr = await fetch(`${API}/forms`, {
        method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(meta)
      });
      const created = await cr.json();
      if (!created.form) throw new Error(created.error || 'Create failed');
      setProgress('Uploading file...');
      // Server-proxied upload (browser→R2 presigned PUT fails CORS).
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      const u = await fetch(`${API}/forms/${created.form.id}/upload`, {
        method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/pdf', base64 })
      });
      const udata = await u.json();
      if (!u.ok || !udata.key) throw new Error(udata.error || 'Upload failed');
      setProgress('Finalizing...');
      await fetch(`${API}/forms/${created.form.id}/finalize-upload`, {
        method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ key: udata.key, fileName: file.name, fileSize: file.size })
      });
      onSaved();
    } catch (e) { alert('Error: ' + e.message); setStep(2); }
  }

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalCard} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>➕ Add Form</h2>
        <div style={{ background:'#fef3c7', border:'1px solid #fde68a', padding:10, borderRadius:6, fontSize:13, color:'#78350f', marginBottom:16 }}>
          ⚠️ Upload only PDFs your brokerage is licensed to use (e.g. your own FAR/BAR member copies). Do not redistribute copyrighted forms outside your license.
        </div>

        {step === 1 && (
          <>
            <p style={{ fontSize: 14, color: '#4b5563' }}>Choose a PDF file. We'll analyze the filename and pre-fill the details for you.</p>
            <input type="file" accept="application/pdf" onChange={handleFile}
              style={{ display: 'block', marginTop: 12, padding: 8 }} />
            {suggesting && <div style={{ marginTop: 12, color: '#6366f1' }}>✨ Analyzing filename with AI...</div>}
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize:13, color:'#059669', margin:'0 0 12px' }}>✨ AI suggested these — review and confirm:</p>
            <label style={labelStyle}>Form Name</label>
            <input value={meta.name} onChange={e => setMeta({...meta, name: e.target.value})} style={inputStyle} />
            <label style={labelStyle}>Category</label>
            <select value={meta.category} onChange={e => setMeta({...meta, category: e.target.value})} style={inputStyle}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label style={labelStyle}>Applies to which side?</label>
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              {['listing','buyer'].map(s => (
                <button key={s} onClick={() => toggleSide(s)} type="button"
                  style={{ flex:1, padding:'8px 12px', border:'2px solid', borderColor: meta.sides.includes(s) ? '#6366f1' : '#d1d5db',
                           background: meta.sides.includes(s) ? '#eef2ff' : 'white', borderRadius:6, cursor:'pointer', fontWeight:600 }}>
                  {SIDE_LABELS[s]} {meta.sides.includes(s) ? '✓' : ''}
                </button>
              ))}
            </div>
            <label style={labelStyle}>Description (shown to agents)</label>
            <textarea value={meta.description} onChange={e => setMeta({...meta, description: e.target.value})}
              style={{ ...inputStyle, height: 60 }} placeholder="What this form is for, when to use it..." />
            <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'flex-end' }}>
              <button onClick={onClose} style={btnSecondary}>Cancel</button>
              <button onClick={handleSave} style={btnPrimary}>💾 Save & Upload</button>
            </div>
          </>
        )}

        {step === 3 && (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 12 }}>⏳ {progress}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Please don't close this window.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditFormModal({ form, onClose, onSaved }) {
  const [meta, setMeta] = useState({
    name: form.name, category: form.category, sides: form.sides || ['listing','buyer'], description: form.description || ''
  });
  const [replacing, setReplacing] = useState(false);
  const token = () => localStorage.getItem('tp_token');

  function toggleSide(s) {
    setMeta(m => {
      const has = m.sides.includes(s);
      const next = has ? m.sides.filter(x => x !== s) : [...m.sides, s];
      return { ...m, sides: next.length ? next : [s] };
    });
  }

  async function handleSave() {
    try {
      const r = await fetch(`${API}/forms/${form.id}`, {
        method: 'PATCH', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(meta)
      });
      if (!r.ok) { const d = await r.json(); alert(d.error || 'Save failed'); return; }
      onSaved();
    } catch (e) { alert('Save error: ' + e.message); }
  }

  async function handleReplace(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setReplacing(true);
    try {
      // Server-proxied upload (browser→R2 presigned PUT fails CORS).
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(f);
      });
      const u = await fetch(`${API}/forms/${form.id}/upload`, {
        method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ fileName: f.name, contentType: f.type || 'application/pdf', base64 })
      });
      const udata = await u.json();
      if (!u.ok || !udata.key) throw new Error(udata.error || 'Upload failed');
      await fetch(`${API}/forms/${form.id}/finalize-upload`, {
        method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ key: udata.key, fileName: f.name, fileSize: f.size })
      });
      alert('✓ File uploaded'); onSaved();
    } catch (err) { alert('Upload error: ' + err.message); }
    finally { setReplacing(false); }
  }

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalCard} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>✏️ Edit Form</h2>
        <label style={labelStyle}>Form Name</label>
        <input value={meta.name} onChange={e => setMeta({...meta, name: e.target.value})} style={inputStyle} />
        <label style={labelStyle}>Category</label>
        <select value={meta.category} onChange={e => setMeta({...meta, category: e.target.value})} style={inputStyle}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={labelStyle}>Applies to which side?</label>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          {['listing','buyer'].map(s => (
            <button key={s} onClick={() => toggleSide(s)} type="button"
              style={{ flex:1, padding:'8px 12px', border:'2px solid', borderColor: meta.sides.includes(s) ? '#6366f1' : '#d1d5db',
                       background: meta.sides.includes(s) ? '#eef2ff' : 'white', borderRadius:6, cursor:'pointer', fontWeight:600 }}>
              {SIDE_LABELS[s]} {meta.sides.includes(s) ? '✓' : ''}
            </button>
          ))}
        </div>
        <label style={labelStyle}>Description</label>
        <textarea value={meta.description} onChange={e => setMeta({...meta, description: e.target.value})}
          style={{ ...inputStyle, height: 60 }} />

        <div style={{ marginTop: 16, padding: 12, background: '#f9fafb', borderRadius: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            {form.has_file ? '📄 Replace PDF File' : '📤 Upload PDF File'}
          </div>
          <input type="file" accept="application/pdf" onChange={handleReplace} disabled={replacing} />
          {replacing && <div style={{ marginTop: 6, color: '#6366f1', fontSize: 12 }}>⏳ Uploading...</div>}
        </div>

        <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary}>💾 Save Changes</button>
        </div>
      </div>
    </div>
  );
}

const modalBackdrop = { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const modalCard = { background:'white', borderRadius:12, padding:24, maxWidth:520, width:'92%', maxHeight:'90vh', overflowY:'auto' };
const labelStyle = { display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:4, marginTop:10 };
const inputStyle = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:14, boxSizing:'border-box' };
const btnPrimary = { background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'white', border:'none', padding:'10px 18px', borderRadius:8, cursor:'pointer', fontWeight:600 };
const btnSecondary = { background:'#e5e7eb', color:'#374151', border:'none', padding:'10px 18px', borderRadius:8, cursor:'pointer', fontWeight:600 };
