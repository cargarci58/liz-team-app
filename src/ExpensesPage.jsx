import React, { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://liz-team-server-api-production.up.railway.app';

const getToken = () => localStorage.getItem('tp_token');

const authFetch = async (path, options = {}) => {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
  } catch (netErr) {
    // TypeError("Failed to fetch") lands here — surfaces CORS/network issues
    // with the API URL attached so a tester can act on the message instead of
    // staring at a generic "Failed to fetch" toast.
    console.error('[authFetch] network failure', API_URL + path, netErr);
    throw new Error(`Cannot reach the server (${API_URL}${path}) — ${netErr.message}. Check your connection or open devtools → Network to see if the request is being blocked.`);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Request failed: ${res.status}`);
  }
  return res.json();
};

// Poll an enqueued AI job until it's done or fails.
const pollAiJob = async (jobId, { timeoutMs = 120000, intervalMs = 1500 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, intervalMs));
    const data = await authFetch(`/ai-jobs/${jobId}`);
    const job = data.job;
    if (!job) throw new Error('Job not found');
    if (job.status === 'completed') return job.result || {};
    if (job.status === 'failed') throw new Error(job.error || 'AI job failed');
  }
  throw new Error('AI job timed out');
};

const fmtCurrency = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const todayISO = () => new Date().toISOString().split('T')[0];

const startOfYearISO = () => `${new Date().getFullYear()}-01-01`;

// ============================================================
// MAIN PAGE
// ============================================================
export default function ExpensesPage({ onBack }) {
  const [viewMode, setViewMode] = useState('simple'); // simple | advanced
  const [activeTab, setActiveTab] = useState('expenses'); // expenses | income | budget | pnl | import
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filterStart, setFilterStart] = useState(startOfYearISO());
  const [filterEnd, setFilterEnd] = useState(todayISO());
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDeductible, setFilterDeductible] = useState('all'); // all | yes | no

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [teachOpen, setTeachOpen] = useState(false);

  useEffect(() => {
    loadCategories();
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStart, filterEnd, filterCategory]);

  const loadCategories = async () => {
    try {
      const data = await authFetch('/expenses/categories');
      setCategories(data.categories || data || []);
    } catch (e) {
      console.error('Load categories failed:', e);
    }
  };

  const loadExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStart) params.set('start_date', filterStart);
      if (filterEnd) params.set('end_date', filterEnd);
      if (filterCategory) params.set('category', filterCategory);
      const data = await authFetch(`/expenses?${params.toString()}`);
      setExpenses(data.expenses || data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    try {
      await authFetch(`/expenses/${id}`, { method: 'DELETE' });
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  // Apply client-side filters (search + deductible)
  const visibleExpenses = expenses.filter(exp => {
    if (filterDeductible === 'mileage' && !exp.is_mileage) return false;
    if (filterDeductible === 'cash' && exp.is_mileage) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      const hay = `${exp.vendor || ''} ${exp.description || ''} ${exp.notes || ''} ${exp.category || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Totals
  const totalAll = visibleExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalMileage = visibleExpenses.filter(e => e.is_mileage).reduce((s, e) => s + Number(e.amount || 0), 0);
  const countMileage = visibleExpenses.filter(e => e.is_mileage).length;
  const countAll = visibleExpenses.length;

  // CSV Export
  const exportCSV = () => {
    if (visibleExpenses.length === 0) {
      alert('No expenses to export with current filters.');
      return;
    }
    const headers = ['Date', 'Vendor', 'Category', 'Amount', 'Type', 'Miles', 'Rate', 'Notes', 'Receipt'];
    const rows = visibleExpenses.map(e => [
      e.occurred_at ? e.occurred_at.split('T')[0] : '',
      e.vendor || '',
      e.category || '',
      Number(e.amount || 0).toFixed(2),
      e.is_mileage ? 'Mileage' : 'Cash',
      e.mileage_miles || '',
      e.mileage_rate || '',
      (e.notes || '').replace(/\n/g, ' '),
      e.receipt_key ? 'Yes' : 'No'
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => {
        const s = String(cell ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${filterStart}_to_${filterEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: 'white',
        padding: '20px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 14,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                ← Back
              </button>
            )}
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>💵 My Money</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 3 }}>
              {[['simple', 'Simple'], ['advanced', 'Accountant view']].map(([k, l]) => (
                <button key={k} onClick={() => setViewMode(k)} style={{
                  border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 18, fontSize: 13, fontWeight: 600,
                  background: viewMode === k ? 'white' : 'transparent', color: viewMode === k ? '#059669' : 'white',
                }}>{l}</button>
              ))}
            </div>
            <button
              onClick={() => setTeachOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.25)', color: 'white',
                border: '1px solid rgba(255,255,255,0.4)', borderRadius: 20,
                padding: '6px 14px', fontSize: 13, cursor: 'pointer'
              }}
            >
              ℹ️ Help
            </button>
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
          {viewMode === 'simple'
            ? "See how much you're making, spending, and keeping — in plain English. Private to you."
            : "Expenses, income, budget, P&L, and bank import. Your data is private — even admins can't see it."}
        </div>
      </div>

      {viewMode === 'simple' && (
        <SimpleMoneyView
          categories={categories}
          goAdvanced={(tab) => { if (tab) setActiveTab(tab); setViewMode('advanced'); }}
        />
      )}

      {viewMode === 'advanced' && (<div>

      {/* Tab bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 24px', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {[
          ['expenses', '💵 Expenses'],
          ['income', '💰 Income'],
          ['budget', '🎯 Budget vs Actuals'],
          ['pnl', '📈 Profit & Loss'],
          ['import', '🏦 Import Statement'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '14px 16px', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
              color: activeTab === key ? '#059669' : '#6b7280',
              borderBottom: activeTab === key ? '3px solid #10b981' : '3px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'income' && <IncomeTab />}
      {activeTab === 'budget' && <BudgetTab categories={categories} />}
      {activeTab === 'pnl' && <PnLTab />}
      {activeTab === 'import' && <ImportTab categories={categories} onCommitted={() => loadExpenses()} />}

      {activeTab === 'expenses' && (<div>

      {/* Summary cards */}
      <div style={{ padding: '20px 24px 0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <SummaryCard label="Total Expenses" value={fmtCurrency(totalAll)} sub={`${countAll} item${countAll === 1 ? '' : 's'}`} color="#1f2937" />
        <SummaryCard label="Mileage" value={fmtCurrency(totalMileage)} sub={`${countMileage} trip${countMileage === 1 ? '' : 's'}`} color="#10b981" />
        <SummaryCard label="Cash Expenses" value={fmtCurrency(totalAll - totalMileage)} sub="non-mileage" color="#6b7280" />
        <SummaryCard label="Period" value={`${fmtDate(filterStart)} → ${fmtDate(filterEnd)}`} sub="" color="#3b82f6" smallValue />
      </div>

      {/* Action bar */}
      <div style={{ padding: '16px 24px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => { setEditingExpense(null); setAddModalOpen(true); }}
          style={primaryBtn('#10b981')}
        >
          ➕ Add Expense
        </button>
        <button
          onClick={() => setReportModalOpen(true)}
          style={primaryBtn('#3b82f6')}
        >
          📊 Tax Report
        </button>
        <button
          onClick={exportCSV}
          style={primaryBtn('#6b7280')}
        >
          ⬇️ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{
        margin: '0 24px',
        background: 'white',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        alignItems: 'end'
      }}>
        <Field label="From">
          <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="To">
          <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Category">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={inputStyle}>
            <option value="">All categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select value={filterDeductible} onChange={e => setFilterDeductible(e.target.value)} style={inputStyle}>
            <option value="all">All types</option>
            <option value="cash">Cash expenses</option>
            <option value="mileage">Mileage only</option>
          </select>
        </Field>
        <Field label="Search">
          <input
            type="text"
            placeholder="vendor, notes..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      {/* Table */}
      <div style={{ margin: '16px 24px', background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading expenses...</div>}
        {error && <div style={{ padding: 20, color: '#dc2626', background: '#fef2f2' }}>Error: {error}</div>}
        {!loading && !error && visibleExpenses.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💵</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>No expenses yet</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>Add your first expense or snap a receipt to get started.</div>
            <button
              onClick={() => { setEditingExpense(null); setAddModalOpen(true); }}
              style={{ ...primaryBtn('#10b981'), marginTop: 16 }}
            >
              ➕ Add Your First Expense
            </button>
          </div>
        )}
        {!loading && !error && visibleExpenses.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <Th>Date</Th>
                  <Th>Vendor</Th>
                  <Th>Category</Th>
                  <Th>Notes</Th>
                  <Th align="right">Amount</Th>
                  <Th align="center">Type</Th>
                  <Th align="center">Receipt</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visibleExpenses.map(exp => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <Td>{fmtDate(exp.occurred_at)}</Td>
                    <Td><strong>{exp.vendor || '—'}</strong></Td>
                    <Td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: '#eff6ff',
                        color: '#1e40af',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600
                      }}>
                        {exp.category || 'Uncategorized'}
                      </span>
                    </Td>
                    <Td style={{ color: '#6b7280', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={exp.notes || ''}>
                      {exp.notes || ''}
                    </Td>
                    <Td align="right" style={{ fontWeight: 600 }}>{fmtCurrency(exp.amount)}</Td>
                    <Td align="center">
                      {exp.is_mileage ? (
                        <span style={{ fontSize: 11, padding: '2px 8px', background: '#d1fae5', color: '#065f46', borderRadius: 10, fontWeight: 600 }}>🚗 Mileage</span>
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 8px', background: '#f3f4f6', color: '#4b5563', borderRadius: 10, fontWeight: 600 }}>💵 Cash</span>
                      )}
                    </Td>
                    <Td align="center">
                      {exp.receipt_key ? (
                        <button
                          onClick={async () => {
                            try {
                              const data = await authFetch(`/expenses/receipt-view-url?key=${encodeURIComponent(exp.receipt_key)}`);
                              if (data.viewUrl) window.open(data.viewUrl, '_blank');
                            } catch (e) { alert('Could not load receipt: ' + e.message); }
                          }}
                          title="View receipt"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#059669', padding: 4 }}
                        >
                          📎
                        </button>
                      ) : (
                        <span style={{ color: '#d1d5db' }}>—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <button
                        onClick={() => { setEditingExpense(exp); setAddModalOpen(true); }}
                        style={iconBtn}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        style={iconBtn}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
                <tr>
                  <Td colSpan={4} style={{ textAlign: 'right', paddingRight: 12 }}>Total ({countAll}):</Td>
                  <Td align="right">{fmtCurrency(totalAll)}</Td>
                  <Td colSpan={3} style={{ fontSize: 12, color: '#10b981' }}>
                    Mileage: {fmtCurrency(totalMileage)}
                  </Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      </div>)}

      </div>)}

      {/* Modals */}
      {addModalOpen && (
        <AddExpenseModal
          categories={categories}
          expense={editingExpense}
          onClose={() => { setAddModalOpen(false); setEditingExpense(null); }}
          onSaved={() => { setAddModalOpen(false); setEditingExpense(null); loadExpenses(); }}
        />
      )}
      {reportModalOpen && (
        <ReportModal
          categories={categories}
          onClose={() => setReportModalOpen(false)}
        />
      )}
      {teachOpen && (
        <TeachModal onClose={() => setTeachOpen(false)} />
      )}
    </div>
  );
}

// ============================================================
// ADD / EDIT EXPENSE MODAL
// ============================================================
function AddExpenseModal({ categories, expense, onClose, onSaved }) {
  const isEdit = !!expense;
  const [vendor, setVendor] = useState(expense?.vendor || '');
  const [amount, setAmount] = useState(expense?.amount || '');
  const [occurredAt, setOccurredAt] = useState(expense?.occurred_at ? expense.occurred_at.split('T')[0] : todayISO());
  const [category, setCategory] = useState(expense?.category || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [receiptKey, setReceiptKey] = useState(expense?.receipt_key || '');
  const [isMileage, setIsMileage] = useState(!!expense?.is_mileage);
  const [mileageMiles, setMileageMiles] = useState(expense?.mileage_miles || '');
  const [mileageRate, setMileageRate] = useState(expense?.mileage_rate || '0.67');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrPreview, setOcrPreview] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Auto-compute mileage amount when miles/rate change
  useEffect(() => {
    if (isMileage && mileageMiles && mileageRate) {
      const computed = (Number(mileageMiles) * Number(mileageRate)).toFixed(2);
      setAmount(computed);
    }
  }, [isMileage, mileageMiles, mileageRate]);

  const handleReceiptUpload = async (file) => {
    if (!file) return;
    setOcrLoading(true);
    setError(null);
    setOcrPreview(null);
    try {
      // Step 1: get presigned R2 PUT URL
      setOcrStatus('Getting upload URL...');
      const presign = await authFetch('/expenses/receipt-upload-url', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name || `receipt_${Date.now()}.jpg`,
          fileType: file.type || 'image/jpeg'
        })
      });
      const { uploadUrl, receiptKey: newKey } = presign;

      // Step 2: PUT file directly to R2
      setOcrStatus('Uploading receipt...');
      let putRes;
      try {
        putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file
        });
      } catch (netErr) {
        throw new Error(`Network error uploading receipt to R2 — ${netErr.message}. Most common cause: R2 bucket CORS rejecting PUTs from this origin.`);
      }
      if (!putRes.ok) throw new Error(`R2 storage rejected the receipt (HTTP ${putRes.status}). The signed URL may have expired or the content-type doesn't match the signature.`);

      setReceiptKey(newKey);

      // Step 3: enqueue AI extraction job
      setOcrStatus('AI reading receipt...');
      const enqueued = await authFetch('/expenses/extract-receipt', {
        method: 'POST',
        body: JSON.stringify({ receiptKey: newKey })
      });
      if (!enqueued.jobId) throw new Error(enqueued.error || 'Could not start receipt scan');

      // Step 4: poll until done
      const result = await pollAiJob(enqueued.jobId);
      const extracted = result.extracted || result;
      setOcrPreview(extracted);

      if (extracted.vendor) setVendor(extracted.vendor);
      if (extracted.amount != null) setAmount(String(extracted.amount));
      if (extracted.occurred_at) setOccurredAt(extracted.occurred_at);
      if (extracted.suggested_category) setCategory(extracted.suggested_category);
      if (extracted.notes) setNotes(extracted.notes);

      setOcrStatus('');
    } catch (e) {
      setError('Receipt scan failed: ' + e.message);
      setOcrStatus('');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Enter a valid amount greater than 0.');
      return;
    }
    if (!occurredAt) {
      setError('Pick an expense date.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vendor: vendor || null,
        amount: Number(amount),
        occurredAt: occurredAt,
        category: category || 'Other',
        notes: notes || null,
        receiptKey: receiptKey || null,
        isMileage: !!isMileage,
        mileageMiles: isMileage && mileageMiles ? Number(mileageMiles) : null,
        mileageRate: isMileage && mileageRate ? Number(mileageRate) : null
      };
      if (isEdit) {
        await authFetch(`/expenses/${expense.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await authFetch('/expenses', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      onSaved();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={isEdit ? '✏️ Edit Expense' : '➕ Add Expense'} width={620}>
      {/* Receipt OCR */}
      {!isEdit && (
        <div style={{
          background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
          border: '1px dashed #10b981',
          borderRadius: 10,
          padding: 16,
          marginBottom: 16
        }}>
          <div style={{ fontWeight: 600, color: '#065f46', marginBottom: 6 }}>
            📸 Snap a receipt — let AI fill it in
          </div>
          <div style={{ fontSize: 13, color: '#047857', marginBottom: 10 }}>
            Take a photo or upload a PDF/image. AI extracts vendor, amount, date, and category. You review before saving.
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => handleReceiptUpload(e.target.files?.[0])}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={e => handleReceiptUpload(e.target.files?.[0])}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={ocrLoading}
              style={{ ...primaryBtn('#10b981'), opacity: ocrLoading ? 0.6 : 1 }}
            >
              📷 Take Photo
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrLoading}
              style={{ ...secondaryBtn, opacity: ocrLoading ? 0.6 : 1, borderColor: '#10b981', color: '#065f46' }}
            >
              📎 Upload File
            </button>
          </div>
          {ocrLoading && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#065f46' }}>
              🔄 {ocrStatus || 'Processing...'}
            </div>
          )}
          {ocrPreview && !ocrLoading && (
            <div style={{ marginTop: 10, padding: 10, background: 'white', borderRadius: 8, fontSize: 13, color: '#065f46' }}>
              ✨ <strong>AI extracted:</strong> {ocrPreview.vendor || 'unknown vendor'} • {fmtCurrency(ocrPreview.amount || 0)} • {fmtDate(ocrPreview.occurred_at)}
              {ocrPreview.suggested_category && <> • <em>{ocrPreview.suggested_category}</em></>}
              <div style={{ marginTop: 4, fontSize: 12 }}>Review the fields below — edit anything that looks off.</div>
            </div>
          )}
        </div>
      )}

      {/* Mileage toggle */}
      <div style={{ marginBottom: 14, padding: 10, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151' }}>
          <input
            type="checkbox"
            checked={isMileage}
            onChange={e => setIsMileage(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          🚗 This is a mileage expense (auto-calculates amount from miles × rate)
        </label>
        {isMileage && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
            <Field label="Miles driven">
              <input type="number" step="0.1" min="0" value={mileageMiles} onChange={e => setMileageMiles(e.target.value)} placeholder="e.g. 23.5" style={inputStyle} />
            </Field>
            <Field label="IRS rate ($/mile)" hint="2026: $0.67">
              <input type="number" step="0.001" min="0" value={mileageRate} onChange={e => setMileageRate(e.target.value)} placeholder="0.67" style={inputStyle} />
            </Field>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Vendor" hint={isMileage ? 'Optional for mileage' : 'Who you paid'}>
          <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder={isMileage ? 'e.g. Client showing' : 'e.g. Office Depot'} style={inputStyle} />
        </Field>
        <Field label="Amount *" hint={isMileage ? 'Auto-calculated' : ''}>
          <input
            type="number" step="0.01" min="0" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={isMileage}
            style={{ ...inputStyle, background: isMileage ? '#f3f4f6' : 'white' }}
          />
        </Field>
        <Field label="Date *">
          <input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Category">
          <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
            <option value="">— pick one —</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes" hint="What was bought / business purpose / which client">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="e.g. Client lunch with the Garcias re: 123 Oak Dr listing"
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      {receiptKey && (
        <div style={{ fontSize: 13, color: '#059669', marginBottom: 12 }}>
          📎 Receipt attached ({receiptKey.split('/').pop()})
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={secondaryBtn}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn('#10b981'), opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Expense')}
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// TAX REPORT MODAL
// ============================================================
function ReportModal({ categories, onClose }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const data = await authFetch(`/expenses/report?start_date=${startDate}&end_date=${endDate}`);
      setReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const byCategory = report?.by_category || report?.categories || [];
  const totalAll = report?.total || byCategory.reduce((s, c) => s + Number(c.total || 0), 0);

  const exportReportCSV = () => {
    if (!byCategory.length) return;
    const headers = ['Category', 'Count', 'Total'];
    const rows = byCategory.map(c => [
      c.category || c.category_name || c.name || 'Uncategorized',
      c.count || 0,
      Number(c.total || 0).toFixed(2)
    ]);
    const csv = [headers, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax_report_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalShell onClose={onClose} title={`📊 Tax Report — ${year}`} width={640}>
      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        fontSize: 13,
        color: '#1e40af'
      }}>
        <strong>What this is:</strong> Year-end summary of your business expenses by category. Hand this (or the CSV) to your accountant at tax time — it maps to Schedule C categories. <strong>Not tax advice;</strong> talk to your CPA.
      </div>

      <Field label="Tax Year">
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inputStyle, maxWidth: 200 }}>
          {[0, 1, 2, 3].map(i => {
            const y = new Date().getFullYear() - i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </Field>

      {loading && <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Loading...</div>}
      {error && <div style={{ padding: 10, color: '#dc2626' }}>Error: {error}</div>}

      {report && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <SummaryCard label="Total Expenses" value={fmtCurrency(totalAll)} sub={`${year}`} color="#1f2937" />
            <SummaryCard label="Categories" value={String(byCategory.length)} sub="distinct" color="#3b82f6" />
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <Th>Category</Th>
                  <Th align="right">Count</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {byCategory.length === 0 && (
                  <tr><Td colSpan={3} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No expenses for {year} yet.</Td></tr>
                )}
                {byCategory.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <Td>{c.category || c.category_name || c.name || 'Uncategorized'}</Td>
                    <Td align="right">{c.count || 0}</Td>
                    <Td align="right" style={{ fontWeight: 600 }}>{fmtCurrency(c.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={secondaryBtn}>Close</button>
            <button onClick={exportReportCSV} style={primaryBtn('#3b82f6')}>⬇️ Export Report CSV</button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ============================================================
// TEACH MODAL
// ============================================================
function TeachModal({ onClose }) {
  return (
    <ModalShell onClose={onClose} title="💵 How the Expense Tracker helps you" width={520}>
      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
        <p><strong>Why this exists:</strong> As an independent contractor real estate agent, you can deduct legitimate business expenses on Schedule C — every deduction reduces your taxable income. But only if you can prove it.</p>

        <p><strong>What this does:</strong></p>
        <ul style={{ marginLeft: 18 }}>
          <li><strong>Snap receipts</strong> — AI reads them and auto-fills the form. You confirm.</li>
          <li><strong>Categorize</strong> — Mileage, marketing, MLS dues, office supplies, client gifts, CE, etc.</li>
          <li><strong>Tag deductible</strong> — Mark which expenses are business (most should be).</li>
          <li><strong>Year-end report</strong> — Hand the summary to your CPA in January.</li>
        </ul>

        <p><strong>Privacy:</strong> Your expenses are <em>private to you</em>. Brokerage admins cannot see them. Other agents cannot see them. This is your business, not the brokerage's.</p>

        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 10, marginTop: 12, fontSize: 13 }}>
          ⚠️ <strong>Not tax advice.</strong> What's deductible depends on your situation. Always confirm with a licensed CPA before filing.
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} style={primaryBtn('#10b981')}>Got it</button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// SIMPLE "MY MONEY" VIEW — plain-language default for non-accountants
// ============================================================
const COMMON_BILLS = [
  ['MLS Fees', 'MLS dues'],
  ['E&O Insurance', 'E&O insurance'],
  ['Marketing', 'Marketing & ads'],
  ['Software / Tech', 'Software / CRM'],
  ['Gas / Mileage', 'Car & gas'],
  ['Office Supplies', 'Phone & office'],
];

function SimpleMoneyView({ categories, goAdvanced }) {
  const [pnl, setPnl] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGoal, setShowGoal] = useState(false);
  const [showBills, setShowBills] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [editSetup, setEditSetup] = useState(false);

  const year = new Date().getFullYear();

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [p, b] = await Promise.all([
        authFetch(`/finance/pnl?from=${year}-01-01&to=${year}-12-31`),
        authFetch('/budget'),
      ]);
      setPnl(p);
      setItems(b.items || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const made = pnl?.income?.total || 0;
  const spent = pnl?.expenses?.total || 0;
  const kept = made - spent;
  const incomeItems = items.filter(i => i.kind === 'income');
  const expenseItems = items.filter(i => i.kind !== 'income');
  const goal = incomeItems.reduce((s, i) => s + budgetedForPeriod(i, 'year'), 0);
  const monthlyBills = expenseItems.reduce((s, i) => s + budgetedForPeriod(i, 'month'), 0);

  const hasGoal = goal > 0;
  const hasBills = expenseItems.length > 0;
  const hasActivity = made > 0 || spent > 0;
  const setupDone = hasGoal && hasBills && hasActivity;

  // pace
  const elapsed = Math.min(1, (new Date() - new Date(year, 0, 1)) / (365 * 24 * 3600 * 1000));
  const goalPct = hasGoal ? Math.round(made / goal * 100) : 0;
  const expectedByNow = goal * elapsed;
  const onPace = made >= expectedByNow;
  const keepRate = made > 0 ? Math.round(kept / made * 100) : 0;

  const topCosts = [...(pnl?.expenses?.by_category || [])].sort((a, b) => b.total - a.total).slice(0, 3);

  const Step = ({ done, n, title, children }) => (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: n === 1 ? 'none' : '1px solid #f3f4f6' }}>
      <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, background: done ? '#10b981' : '#e5e7eb', color: done ? 'white' : '#6b7280' }}>{done ? '✓' : n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: 6 }}>{title}</div>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px 24px', maxWidth: 920, margin: '0 auto' }}>
      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>}
      {error && <div style={{ padding: 20, color: '#dc2626', background: '#fef2f2', borderRadius: 8 }}>Error: {error}</div>}

      {!loading && !error && (
        <>
          {/* SETUP CHECKLIST */}
          {(!setupDone || editSetup) && (
            <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px 20px', marginBottom: 20, border: '1px solid #d1fae5' }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#065f46', marginBottom: 4 }}>👋 Let's set up your business money</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Three quick things. You can change them anytime.</div>

              <Step done={hasGoal} n={1} title="How much do you want to make this year?">
                {hasGoal
                  ? <div style={{ fontSize: 14, color: '#374151' }}>Your goal: <strong>{fmtCurrency(goal)}</strong> &nbsp;<button onClick={() => setShowGoal(true)} style={linkBtn}>change</button></div>
                  : <button onClick={() => setShowGoal(true)} style={primaryBtn('#10b981')}>Set my income goal</button>}
              </Step>

              <Step done={hasBills} n={2} title="What do you pay every month to run your business?">
                {hasBills
                  ? <div style={{ fontSize: 14, color: '#374151' }}>About <strong>{fmtCurrency(monthlyBills)}/mo</strong> in bills &nbsp;<button onClick={() => setShowBills(true)} style={linkBtn}>edit</button></div>
                  : <button onClick={() => setShowBills(true)} style={primaryBtn('#10b981')}>Add my monthly bills</button>}
              </Step>

              <Step done={hasActivity} n={3} title="Add what you've made and spent">
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>The easiest way is to upload a bank statement — we'll sort it for you. Or add things one at a time.</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => goAdvanced('import')} style={primaryBtn('#3b82f6')}>🏦 Upload a bank statement</button>
                  <button onClick={() => setShowAddIncome(true)} style={secondaryBtn}>➕ Money I made</button>
                  <button onClick={() => setShowAddExpense(true)} style={secondaryBtn}>➖ Money I spent</button>
                </div>
              </Step>

              {setupDone && (
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <button onClick={() => setEditSetup(false)} style={linkBtn}>Done editing ✓</button>
                </div>
              )}
            </div>
          )}

          {setupDone && !editSetup && (
            <div style={{ textAlign: 'right', marginBottom: 8 }}>
              <button onClick={() => setEditSetup(true)} style={linkBtn}>⚙️ Edit my goal & bills</button>
            </div>
          )}

          {/* THE 3 BIG NUMBERS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 14, marginBottom: 18 }}>
            <BigMoneyCard emoji="💰" label="Money you made" value={made} sub={`so far in ${year}`} color="#059669" />
            <BigMoneyCard emoji="💸" label="Money you spent" value={spent} sub={`so far in ${year}`} color="#dc2626" />
            <BigMoneyCard emoji={kept >= 0 ? '✅' : '⚠️'} label="Money you kept" value={kept} sub="after paying expenses" color={kept >= 0 ? '#059669' : '#dc2626'} big />
          </div>

          {/* GOAL PROGRESS — plain */}
          {hasGoal && (
            <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '18px 20px', marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ fontWeight: 700, color: '#1f2937' }}>Your goal: make {fmtCurrency(goal)} this year</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>You've made <strong style={{ color: '#059669' }}>{fmtCurrency(made)}</strong></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 10px' }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: '#059669' }}>{goalPct}%</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>{goal - made > 0 ? `${fmtCurrency(goal - made)} to go` : 'You hit your goal! 🎉'}</div>
              </div>
              <div style={{ position: 'relative', background: '#f3f4f6', borderRadius: 8, height: 16, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, goalPct)}%`, height: '100%', background: onPace ? '#10b981' : '#f59e0b' }} />
                {elapsed > 0 && elapsed < 1 && <div title="Where you'd be if earning evenly" style={{ position: 'absolute', top: -2, bottom: -2, left: `${elapsed * 100}%`, width: 2, background: '#1f2937' }} />}
              </div>
              <div style={{ fontSize: 13, marginTop: 8, fontWeight: 600, color: onPace ? '#059669' : '#b45309' }}>
                {made === 0 ? '➡️ Add what you\'ve made (or upload a statement) to see how you\'re tracking.'
                  : onPace ? '👍 You\'re on pace to hit your goal — keep it up!'
                  : `⏳ A little behind — by now you'd want about ${fmtCurrency(expectedByNow)}. ${fmtCurrency(expectedByNow - made)} would catch you up.`}
              </div>
            </div>
          )}

          {/* PLAIN-ENGLISH SUMMARY */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '16px 20px', marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: '#065f46', marginBottom: 6 }}>📖 In plain English</div>
            <div style={{ fontSize: 15, color: '#1f2937', lineHeight: 1.6 }}>
              {!hasActivity ? (
                <>Nothing's been added yet. Add what you've made and spent — or just <button onClick={() => goAdvanced('import')} style={linkBtn}>upload a bank statement</button> — and I'll do the math for you.</>
              ) : (
                <>
                  You've earned <strong>{fmtCurrency(made)}</strong> and spent <strong>{fmtCurrency(spent)}</strong>, so you've kept <strong style={{ color: kept >= 0 ? '#059669' : '#dc2626' }}>{fmtCurrency(kept)}</strong> so far this year.
                  {made > 0 && <> That means out of every dollar you make, you keep about <strong>{keepRate}¢</strong>.</>}
                  {kept < 0 && <> Right now you're spending more than you make — worth a look at your biggest costs below.</>}
                </>
              )}
            </div>
          </div>

          {/* BIGGEST COSTS */}
          {topCosts.length > 0 && (
            <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px 20px', marginBottom: 18 }}>
              <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 10 }}>Where your money goes</div>
              {topCosts.map((c, i) => {
                const pctOfSpend = spent > 0 ? Math.round(c.total / spent * 100) : 0;
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 3 }}>
                      <span style={{ color: '#374151' }}>{c.category}</span>
                      <span style={{ fontWeight: 600 }}>{fmtCurrency(c.total)} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({pctOfSpend}%)</span></span>
                    </div>
                    <div style={{ background: '#f3f4f6', borderRadius: 5, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${pctOfSpend}%`, height: '100%', background: '#dc2626', opacity: 0.7 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* QUICK ACTIONS */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => setShowAddIncome(true)} style={primaryBtn('#10b981')}>➕ Money I made</button>
            <button onClick={() => setShowAddExpense(true)} style={primaryBtn('#dc2626')}>➖ Money I spent</button>
            <button onClick={() => goAdvanced('import')} style={primaryBtn('#3b82f6')}>🏦 Upload a bank statement</button>
            <button onClick={() => goAdvanced('pnl')} style={secondaryBtn}>📈 See the full details</button>
          </div>
        </>
      )}

      {showGoal && <GoalSetupModal existing={incomeItems[0] || null} onClose={() => setShowGoal(false)} onSaved={() => { setShowGoal(false); load(); }} />}
      {showBills && <BillsSetupModal existing={expenseItems} onClose={() => setShowBills(false)} onSaved={() => { setShowBills(false); load(); }} />}
      {showAddIncome && <IncomeModal entry={null} onClose={() => setShowAddIncome(false)} onSaved={() => { setShowAddIncome(false); load(); }} />}
      {showAddExpense && <AddExpenseModal categories={categories} expense={null} onClose={() => setShowAddExpense(false)} onSaved={() => { setShowAddExpense(false); load(); }} />}
    </div>
  );
}

function BigMoneyCard({ emoji, label, value, sub, color, big }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 20, borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{emoji} {label}</div>
      <div style={{ fontSize: big ? 34 : 28, fontWeight: 800, color, marginTop: 6 }}>{fmtCurrency(value)}</div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// "How much do you want to make this year?" — creates/updates a yearly income goal.
function GoalSetupModal({ existing, onClose, onSaved }) {
  const [amount, setAmount] = useState(existing?.amount || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setError(null);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError('Enter how much you want to make.'); return; }
    setSaving(true);
    try {
      const payload = { kind: 'income', label: 'My income goal', category: 'Income', amount: Number(amount), frequency: 'annual' };
      if (existing) await authFetch(`/budget/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await authFetch('/budget', { method: 'POST', body: JSON.stringify(payload) });
      onSaved();
    } catch (e) { setError(e.message); setSaving(false); }
  };
  return (
    <ModalShell onClose={onClose} title="🎯 Your income goal" width={460}>
      <div style={{ fontSize: 14, color: '#374151', marginBottom: 14 }}>How much would you like to make this year (before expenses)? A rough number is fine — you can change it anytime.</div>
      <Field label="I want to make this year">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22, color: '#6b7280' }}>$</span>
          <input type="number" step="1000" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="220,000" style={{ ...inputStyle, fontSize: 20, fontWeight: 700 }} autoFocus />
        </div>
      </Field>
      {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={secondaryBtn}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ ...primaryBtn('#10b981'), opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save goal'}</button>
      </div>
    </ModalShell>
  );
}

// "What do you pay every month?" — quick monthly expense budget setup from
// common bills + any custom lines the agent adds.
function BillsSetupModal({ existing, onClose, onSaved }) {
  const monthlyExisting = (existing || []).filter(i => i.frequency === 'monthly');
  const byCat = {};
  monthlyExisting.forEach(i => { byCat[i.category] = i; });
  const presetCats = COMMON_BILLS.map(([cat]) => cat);

  const [rows, setRows] = useState(() => {
    const preset = COMMON_BILLS.map(([cat, label]) => ({ cat, label, amount: byCat[cat]?.amount || '', id: byCat[cat]?.id || null, custom: false }));
    // Any existing monthly bills the agent already added that aren't in the preset list
    const customExisting = monthlyExisting
      .filter(i => !presetCats.includes(i.category))
      .map(i => ({ cat: i.category, label: i.label || i.category, amount: i.amount || '', id: i.id, custom: true }));
    return [...preset, ...customExisting];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setAmt = (i, v) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, amount: v } : r));
  const setName = (i, v) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, label: v, cat: v } : r));
  const addCustom = () => setRows(prev => [...prev, { cat: '', label: '', amount: '', id: null, custom: true }]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true); setError(null);
    try {
      for (const r of rows) {
        const amt = Number(r.amount);
        if (r.amount === '' || isNaN(amt) || amt <= 0) continue;
        const name = (r.label || '').trim() || (r.custom ? 'Other' : r.cat);
        const cat = (r.cat || '').trim() || (r.custom ? 'Other' : r.cat);
        const payload = { kind: 'expense', label: name, category: cat.slice(0, 80), amount: amt, frequency: 'monthly' };
        if (r.id) await authFetch(`/budget/${r.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        else await authFetch('/budget', { method: 'POST', body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (e) { setError(e.message); setSaving(false); }
  };

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <ModalShell onClose={onClose} title="🧾 Your monthly business bills" width={520}>
      <div style={{ fontSize: 14, color: '#374151', marginBottom: 14 }}>About how much do you pay each month? Fill in what applies, add your own below, and leave the rest blank.</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {r.custom ? (
            <input value={r.label} onChange={e => setName(i, e.target.value)} placeholder="Name this bill (e.g. Assistant)" style={{ ...inputStyle, flex: 1 }} />
          ) : (
            <div style={{ flex: 1, fontSize: 14, color: '#374151' }}>{r.label}</div>
          )}
          <span style={{ color: '#9ca3af' }}>$</span>
          <input type="number" step="1" min="0" value={r.amount} onChange={e => setAmt(i, e.target.value)} placeholder="0" style={{ ...inputStyle, maxWidth: 110, textAlign: 'right' }} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>/mo</span>
          {r.custom
            ? <button onClick={() => removeRow(i)} style={iconBtn} title="Remove">✕</button>
            : <span style={{ width: 24 }} />}
        </div>
      ))}
      <button onClick={addCustom} style={{ ...secondaryBtn, marginTop: 2 }}>➕ Add another bill</button>
      <div style={{ textAlign: 'right', fontWeight: 700, color: '#1f2937', marginTop: 12 }}>About {fmtCurrency(total)}/month</div>
      {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, margin: '12px 0', fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} style={secondaryBtn}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ ...primaryBtn('#10b981'), opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save my bills'}</button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// INCOME TAB — manual / other (non-commission) income
// ============================================================
const INCOME_CATEGORIES = ['Commission (manual)', 'Referral Fee', 'Rental Income', 'BPO / Valuation', 'Bonus', 'Sign / Lockbox Rebate', 'Other Income'];

function IncomeTab() {
  const [rows, setRows] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState(startOfYearISO());
  const [to, setTo] = useState(todayISO());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      // /income = manual entries; /finance/pnl = auto commission income from closed deals
      const [inc, pnl] = await Promise.all([
        authFetch(`/income?from=${from}&to=${to}`),
        authFetch(`/finance/pnl?from=${from}&to=${to}`),
      ]);
      setRows(inc.income || []);
      setCommissions(pnl?.income?.commissions || []);
      setCommissionTotal(Number(pnl?.income?.commission_total || 0));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const manualTotal = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const grandTotal = manualTotal + commissionTotal;

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this income entry?')) return;
    try { await authFetch(`/income/${id}`, { method: 'DELETE' }); setRows(p => p.filter(r => r.id !== id)); }
    catch (e) { alert('Delete failed: ' + e.message); }
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
        <Field label="From"><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} /></Field>
        <Field label="To"><input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} /></Field>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={primaryBtn('#10b981')}>➕ Add Other Income</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 12, marginBottom: 20 }}>
        <SummaryCard label="Total Income" value={fmtCurrency(grandTotal)} sub="commissions + other" color="#059669" />
        <SummaryCard label="Commission Income" value={fmtCurrency(commissionTotal)} sub={`${commissions.length} closed deal${commissions.length === 1 ? '' : 's'}`} color="#10b981" />
        <SummaryCard label="Other Income" value={fmtCurrency(manualTotal)} sub={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`} color="#3b82f6" />
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>}
      {error && <div style={{ padding: 20, color: '#dc2626', background: '#fef2f2', borderRadius: 8 }}>Error: {error}</div>}

      {!loading && !error && (
        <>
          {/* Commission income — auto from closed deals */}
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#065f46' }}>💼 Commission income <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af' }}>— auto from your closed deals (net of split & fees)</span></span>
              <span style={{ fontWeight: 700, color: '#059669' }}>{fmtCurrency(commissionTotal)}</span>
            </div>
            {commissions.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>No deals closed in this period. Mark a deal "Closed" with a closing date and it shows up here.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr><Th>Closing</Th><Th>Property</Th><Th>Type</Th><Th align="right">Sale Price</Th><Th align="right">Net Commission</Th></tr>
                </thead>
                <tbody>
                  {commissions.map(d => (
                    <tr key={d.transaction_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <Td>{fmtDate(d.closing_date)}</Td>
                      <Td><strong>{d.address || 'Property'}</strong>{d.city ? <span style={{ color: '#9ca3af' }}>, {d.city}</span> : ''}</Td>
                      <Td style={{ color: '#6b7280', fontSize: 13 }}>{d.transaction_type || ''}</Td>
                      <Td align="right" style={{ color: '#6b7280' }}>{fmtCurrency(d.price)}</Td>
                      <Td align="right" style={{ fontWeight: 600, color: '#059669' }}>{fmtCurrency(d.net_commission)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Other / manual income */}
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#1e40af' }}>➕ Other income <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af' }}>— referrals, rentals, bonuses, BPOs</span></span>
              <span style={{ fontWeight: 700, color: '#059669' }}>{fmtCurrency(manualTotal)}</span>
            </div>
            {rows.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>No other income recorded. Use "Add Other Income" for non-commission earnings.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr><Th>Date</Th><Th>Source</Th><Th>Category</Th><Th>Notes</Th><Th align="right">Amount</Th><Th align="right">Actions</Th></tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <Td>{fmtDate(r.occurred_at)}</Td>
                      <Td><strong>{r.source || '—'}</strong></Td>
                      <Td><span style={{ padding: '2px 8px', background: '#ecfdf5', color: '#065f46', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{r.category || 'Other Income'}</span></Td>
                      <Td style={{ color: '#6b7280' }}>{r.notes || ''}</Td>
                      <Td align="right" style={{ fontWeight: 600, color: '#059669' }}>{fmtCurrency(r.amount)}</Td>
                      <Td align="right">
                        <button onClick={() => { setEditing(r); setModalOpen(true); }} style={iconBtn} title="Edit">✏️</button>
                        <button onClick={() => handleDelete(r.id)} style={iconBtn} title="Delete">🗑️</button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {modalOpen && <IncomeModal entry={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSaved={() => { setModalOpen(false); setEditing(null); load(); }} />}
    </div>
  );
}

function IncomeModal({ entry, onClose, onSaved }) {
  const isEdit = !!entry;
  const [amount, setAmount] = useState(entry?.amount || '');
  const [source, setSource] = useState(entry?.source || '');
  const [category, setCategory] = useState(entry?.category || 'Other Income');
  const [occurredAt, setOccurredAt] = useState(entry?.occurred_at ? entry.occurred_at.split('T')[0] : todayISO());
  const [notes, setNotes] = useState(entry?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setError(null);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError('Enter a valid amount.'); return; }
    if (!occurredAt) { setError('Pick a date.'); return; }
    setSaving(true);
    try {
      const payload = { amount: Number(amount), source: source || null, category, occurredAt, notes: notes || null };
      if (isEdit) await authFetch(`/income/${entry.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await authFetch('/income', { method: 'POST', body: JSON.stringify(payload) });
      onSaved();
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <ModalShell onClose={onClose} title={isEdit ? '✏️ Edit Income' : '➕ Add Income'} width={520}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Amount *"><input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} /></Field>
        <Field label="Date *"><input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} style={inputStyle} /></Field>
        <Field label="Source" hint="Who paid you"><input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. ABC Realty referral" style={inputStyle} /></Field>
        <Field label="Category">
          <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
            {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} /></Field>
      {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={secondaryBtn}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ ...primaryBtn('#10b981'), opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : (isEdit ? 'Save' : 'Add Income')}</button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// BUDGET vs ACTUALS TAB
// ============================================================
const FREQ_LABEL = { monthly: 'Monthly', annual: 'Yearly', one_time: 'One-time' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function budgetedForPeriod(item, period) {
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();
  const amt = Number(item.amount || 0);
  if (period === 'year') {
    if (item.frequency === 'monthly') return amt * 12;
    if (item.frequency === 'annual') return amt;
    return (item.year == null || Number(item.year) === thisYear) ? amt : 0; // one_time
  }
  // month
  if (item.frequency === 'monthly') return amt;
  if (item.frequency === 'annual') return Number(item.due_month) === thisMonth ? amt : 0;
  return (Number(item.due_month) === thisMonth && (item.year == null || Number(item.year) === thisYear)) ? amt : 0;
}

function BudgetTab({ categories }) {
  const [items, setItems] = useState([]);
  const [pnl, setPnl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('year'); // year | month
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const range = (() => {
    const now = new Date();
    const y = now.getFullYear();
    if (period === 'month') {
      const m = now.getMonth();
      const from = new Date(y, m, 1).toISOString().split('T')[0];
      const to = new Date(y, m + 1, 0).toISOString().split('T')[0];
      return { from, to };
    }
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  })();

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [b, p] = await Promise.all([
        authFetch('/budget'),
        authFetch(`/finance/pnl?from=${range.from}&to=${range.to}`),
      ]);
      setItems(b.items || []);
      setPnl(p);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this budget line?')) return;
    try { await authFetch(`/budget/${id}`, { method: 'DELETE' }); setItems(p => p.filter(i => i.id !== id)); }
    catch (e) { alert('Delete failed: ' + e.message); }
  };

  const expenseItems = items.filter(i => i.kind !== 'income');
  const incomeItems = items.filter(i => i.kind === 'income');

  // Budget-vs-actual by expense category
  const actualByCat = {};
  (pnl?.expenses?.by_category || []).forEach(c => { actualByCat[c.category] = Number(c.total || 0); });
  const budgetByCat = {};
  expenseItems.forEach(i => {
    const cat = i.category || 'Uncategorized';
    budgetByCat[cat] = (budgetByCat[cat] || 0) + budgetedForPeriod(i, period);
  });
  const allCats = Array.from(new Set([...Object.keys(budgetByCat), ...Object.keys(actualByCat)])).sort();

  const totalBudgetExp = Object.values(budgetByCat).reduce((s, v) => s + v, 0);
  const totalActualExp = pnl?.expenses?.total || 0;
  const incomeGoal = incomeItems.reduce((s, i) => s + budgetedForPeriod(i, period), 0);
  const actualIncome = pnl?.income?.total || 0;
  const netSoFar = actualIncome - totalActualExp;

  // How far into the period are we? (for "expected by now" pacing)
  const elapsedFraction = (() => {
    const now = new Date();
    if (period === 'month') {
      const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return Math.min(1, now.getDate() / dim);
    }
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.min(1, (now - start) / (365 * 24 * 3600 * 1000));
  })();

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
        💡 This tab compares your <strong>plan</strong> to <strong>reality</strong>. Set an <strong>income goal</strong> (what you want to earn) and your <strong>planned expenses</strong> (MLS, E&O, marketing…). The bars below show how you're tracking. Add lines with <strong>➕ Add Budget Line</strong>.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
          {[['year', 'This Year'], ['month', 'This Month']].map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{
              border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              background: period === k ? 'white' : 'transparent', color: period === k ? '#059669' : '#6b7280',
              boxShadow: period === k ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
            }}>{l}</button>
          ))}
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={primaryBtn('#10b981')}>➕ Add Budget Line</button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>}
      {error && <div style={{ padding: 20, color: '#dc2626', background: '#fef2f2', borderRadius: 8 }}>Error: {error}</div>}

      {!loading && !error && (
        <>
          {/* INCOME GOAL */}
          <GoalProgress
            label={`Income Goal — ${period === 'year' ? 'This Year' : 'This Month'}`}
            goal={incomeGoal}
            actual={actualIncome}
            elapsed={elapsedFraction}
            actualLabel="Earned so far"
            emptyHint="No income goal set yet. Click ➕ Add Budget Line → 📥 Income Goal to set your target (e.g. $220,000/yr)."
            footer={`Earned = closed-deal commissions${pnl?.income?.other_total ? ' + other income' : ''}. Your net (income − expenses) so far is ${fmtCurrency(netSoFar)}.`}
          />

          {/* EXPENSE BUDGET */}
          <div style={{ fontWeight: 700, color: '#374151', margin: '8px 2px 10px' }}>Expense Budget</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 12, marginBottom: 16 }}>
            <SummaryCard label="Planned to spend" value={fmtCurrency(totalBudgetExp)} sub={period === 'year' ? 'full-year budget' : 'this month'} color="#6b7280" />
            <SummaryCard label="Actually spent" value={fmtCurrency(totalActualExp)} sub={`${totalBudgetExp > 0 ? Math.round(totalActualExp / totalBudgetExp * 100) : 0}% of budget used`} color={totalActualExp > totalBudgetExp ? '#dc2626' : '#10b981'} />
            <SummaryCard label="Left in budget" value={fmtCurrency(totalBudgetExp - totalActualExp)} sub={totalActualExp > totalBudgetExp ? 'over budget' : 'remaining'} color={totalActualExp > totalBudgetExp ? '#dc2626' : '#3b82f6'} />
          </div>

          {/* Budget vs actual by category */}
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#1f2937' }}>Expenses by category — planned vs actual</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr><Th>Category</Th><Th align="right">Budgeted</Th><Th align="right">Actual</Th><Th align="right">Remaining</Th><Th>Usage</Th></tr>
              </thead>
              <tbody>
                {allCats.length === 0 && <tr><Td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>No budget lines yet. Add MLS fees, E&O, marketing, etc.</Td></tr>}
                {allCats.map(cat => {
                  const bud = budgetByCat[cat] || 0;
                  const act = actualByCat[cat] || 0;
                  const pct = bud > 0 ? Math.min(100, Math.round(act / bud * 100)) : (act > 0 ? 100 : 0);
                  const over = act > bud && bud > 0;
                  return (
                    <tr key={cat} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <Td>{cat}</Td>
                      <Td align="right">{fmtCurrency(bud)}</Td>
                      <Td align="right" style={{ fontWeight: 600 }}>{fmtCurrency(act)}</Td>
                      <Td align="right" style={{ color: over ? '#dc2626' : '#059669' }}>{fmtCurrency(bud - act)}</Td>
                      <Td>
                        <div style={{ background: '#f3f4f6', borderRadius: 6, height: 10, overflow: 'hidden', minWidth: 90 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: over ? '#dc2626' : pct > 85 ? '#f59e0b' : '#10b981' }} />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Budget line management */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px,1fr))', gap: 16 }}>
            <BudgetLineList title="📤 Planned Expenses" hint="What you expect to spend" items={expenseItems} period={period} onEdit={(i) => { setEditing(i); setModalOpen(true); }} onDelete={handleDelete} />
            <BudgetLineList title="📥 Income Goal" hint="What you want to earn" items={incomeItems} period={period} onEdit={(i) => { setEditing(i); setModalOpen(true); }} onDelete={handleDelete} />
          </div>
        </>
      )}

      {modalOpen && <BudgetModal item={editing} categories={categories} onClose={() => { setModalOpen(false); setEditing(null); }} onSaved={() => { setModalOpen(false); setEditing(null); load(); }} />}
    </div>
  );
}

// Big single-metric progress card (goal vs actual) with pacing.
function GoalProgress({ label, goal, actual, elapsed, actualLabel, emptyHint, footer }) {
  if (!goal || goal <= 0) {
    return (
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: 18, marginBottom: 16, borderLeft: '4px solid #3b82f6' }}>
        <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>{label}</div>
        <div style={{ color: '#6b7280', fontSize: 14 }}>{emptyHint}</div>
      </div>
    );
  }
  const pct = Math.round(actual / goal * 100);
  const expected = goal * (elapsed || 0);
  const onPace = actual >= expected;
  const remaining = goal - actual;
  return (
    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: 18, marginBottom: 20, borderLeft: '4px solid #10b981' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 700, color: '#1f2937' }}>{label}</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{actualLabel}: <strong style={{ color: '#059669' }}>{fmtCurrency(actual)}</strong> of <strong>{fmtCurrency(goal)}</strong> goal</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 10px' }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#059669' }}>{pct}%</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{remaining > 0 ? `${fmtCurrency(remaining)} to go` : 'goal reached 🎉'}</div>
      </div>
      <div style={{ position: 'relative', background: '#f3f4f6', borderRadius: 8, height: 16, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: onPace ? '#10b981' : '#f59e0b', transition: 'width .3s' }} />
        {elapsed > 0 && elapsed < 1 && (
          <div title="Where you'd be if earning evenly all period" style={{ position: 'absolute', top: -2, bottom: -2, left: `${elapsed * 100}%`, width: 2, background: '#1f2937' }} />
        )}
      </div>
      <div style={{ fontSize: 12, color: onPace ? '#059669' : '#b45309', marginTop: 8, fontWeight: 600 }}>
        {onPace ? '✅ On pace' : '⏳ Behind pace'} — at this point in the period you'd expect about {fmtCurrency(expected)} {onPace ? '' : `(you're ${fmtCurrency(expected - actual)} under)`}
      </div>
      {footer && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{footer}</div>}
    </div>
  );
}

function BudgetLineList({ title, hint, items, period, onEdit, onDelete }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#1f2937' }}>
        {title}{hint && <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af' }}> — {hint}</span>}
      </div>
      {items.length === 0 && <div style={{ padding: 20, color: '#6b7280', fontSize: 14 }}>None yet.</div>}
      {items.map(i => (
        <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>{i.label || i.category || '—'}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {i.category ? i.category + ' • ' : ''}{FREQ_LABEL[i.frequency] || i.frequency}
              {i.frequency !== 'monthly' && i.due_month ? ' • ' + MONTHS[i.due_month - 1] : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, color: '#1f2937' }}>{fmtCurrency(i.amount)}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtCurrency(budgetedForPeriod(i, period))}/{period === 'year' ? 'yr' : 'mo'}</div>
          </div>
          <button onClick={() => onEdit(i)} style={iconBtn} title="Edit">✏️</button>
          <button onClick={() => onDelete(i.id)} style={iconBtn} title="Delete">🗑️</button>
        </div>
      ))}
    </div>
  );
}

function BudgetModal({ item, categories, onClose, onSaved }) {
  const isEdit = !!item;
  const [kind, setKind] = useState(item?.kind || 'expense');
  const [label, setLabel] = useState(item?.label || '');
  const [category, setCategory] = useState(item?.category || '');
  const [amount, setAmount] = useState(item?.amount || '');
  const [frequency, setFrequency] = useState(item?.frequency || 'monthly');
  const [dueMonth, setDueMonth] = useState(item?.due_month || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setError(null);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError('Enter a valid amount.'); return; }
    setSaving(true);
    try {
      const payload = { kind, label: label || null, category: kind === 'income' ? (category || 'Income') : (category || 'Other'), amount: Number(amount), frequency, dueMonth: frequency !== 'monthly' && dueMonth ? Number(dueMonth) : null, notes: notes || null };
      if (isEdit) await authFetch(`/budget/${item.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await authFetch('/budget', { method: 'POST', body: JSON.stringify(payload) });
      onSaved();
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <ModalShell onClose={onClose} title={isEdit ? '✏️ Edit Budget Line' : '➕ Add Budget Line'} width={540}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['expense', '📤 Planned Expense'], ['income', '📥 Income Goal']].map(([k, l]) => (
          <button key={k} onClick={() => { setKind(k); if (!isEdit) setFrequency(k === 'income' ? 'annual' : 'monthly'); }} style={{
            flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
            border: kind === k ? '2px solid #10b981' : '1px solid #d1d5db',
            background: kind === k ? '#ecfdf5' : 'white', color: kind === k ? '#065f46' : '#6b7280',
          }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Name / Label" hint="e.g. MLS dues"><input value={label} onChange={e => setLabel(e.target.value)} placeholder="What is this?" style={inputStyle} /></Field>
        <Field label="Amount *"><input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} /></Field>
        <Field label="Category">
          {kind === 'expense' ? (
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              <option value="">— pick one —</option>
              {(categories || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value="Other">Other</option>
            </select>
          ) : (
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              <option value="">— pick one —</option>
              {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </Field>
        <Field label="Frequency">
          <select value={frequency} onChange={e => setFrequency(e.target.value)} style={inputStyle}>
            <option value="monthly">Monthly (recurs every month)</option>
            <option value="annual">Yearly (once a year)</option>
            <option value="one_time">One-time</option>
          </select>
        </Field>
        {frequency !== 'monthly' && (
          <Field label="Month due" hint="when it hits">
            <select value={dueMonth} onChange={e => setDueMonth(e.target.value)} style={inputStyle}>
              <option value="">— any —</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
        )}
      </div>
      <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} /></Field>
      {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={secondaryBtn}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ ...primaryBtn('#10b981'), opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : (isEdit ? 'Save' : 'Add Line')}</button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// PROFIT & LOSS TAB
// ============================================================
function PnLTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [pnl, setPnl] = useState(null);
  const [company, setCompany] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeals, setShowDeals] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      // Company + profile are best-effort letterhead info — don't fail the P&L if they error
      const [data, comp, prof] = await Promise.all([
        authFetch(`/finance/pnl?from=${year}-01-01&to=${year}-12-31`),
        authFetch('/settings/company').catch(() => null),
        authFetch('/profile').catch(() => null),
      ]);
      setPnl(data);
      setCompany(comp?.company || null);
      setProfile(prof?.profile || null);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year]);

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const printPnL = () => {
    if (!pnl) return;
    const rowsHtml = (arr, color) => arr.map(c => `<tr><td style="padding:6px 12px">${esc(c.category)}</td><td style="padding:6px 12px;text-align:right;color:${color}">${fmtCurrency(c.total)}</td></tr>`).join('');

    const c = company || {};
    const accent = c.primaryColor || '#059669';
    const cityLine = [c.city, c.state, c.zip].filter(Boolean).join(', ').replace(', ' + (c.zip || ''), ' ' + (c.zip || '')).trim();
    const contactBits = [c.phone, c.email, c.website].filter(Boolean).map(esc).join(' &nbsp;•&nbsp; ');
    const brokerName = c.name ? esc(c.name) : 'My Real Estate Business';
    const agentName = profile ? esc(`${profile.firstName || ''} ${profile.lastName || ''}`.trim()) : '';
    const agentLine = agentName ? `Prepared for: <strong>${agentName}</strong>${profile?.title ? ' — ' + esc(profile.title) : ''}${profile?.email ? ' &nbsp;•&nbsp; ' + esc(profile.email) : ''}` : '';
    const logoHtml = c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="" style="max-height:64px;max-width:220px;object-fit:contain" onerror="this.style.display='none'"/>` : '';

    const letterhead = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid ${accent};padding-bottom:14px">
        <div>
          <div style="font-size:24px;font-weight:800;color:${accent}">${brokerName}</div>
          ${c.dbaName ? `<div style="color:#6b7280;font-size:13px">DBA ${esc(c.dbaName)}</div>` : ''}
          ${c.address ? `<div style="color:#4b5563;font-size:13px;margin-top:2px">${esc(c.address)}</div>` : ''}
          ${cityLine ? `<div style="color:#4b5563;font-size:13px">${esc(cityLine)}</div>` : ''}
          ${contactBits ? `<div style="color:#6b7280;font-size:12px;margin-top:4px">${contactBits}</div>` : ''}
          ${c.licenseNumber ? `<div style="color:#9ca3af;font-size:12px">License #${esc(c.licenseNumber)}</div>` : ''}
        </div>
        <div style="text-align:right">${logoHtml}</div>
      </div>`;

    const html = `<!doctype html><html><head><title>Profit & Loss ${year} — ${brokerName}</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;max-width:720px;margin:30px auto;padding:0 20px}
      h1{color:${accent};margin:14px 0 0}h2{border-bottom:2px solid ${accent};padding-bottom:4px;margin-top:24px;font-size:16px}
      table{width:100%;border-collapse:collapse;font-size:14px}.tot{font-weight:700;border-top:2px solid #e5e7eb}
      .net{font-size:20px;font-weight:800;padding:14px;border-radius:8px;margin-top:20px;text-align:center}</style></head><body>
      ${letterhead}
      <h1>Profit &amp; Loss Statement</h1>
      <div style="color:#6b7280">Tax year ${year} &nbsp;•&nbsp; generated ${fmtDate(todayISO())}</div>
      ${agentLine ? `<div style="color:#6b7280;margin-top:2px">${agentLine}</div>` : ''}
      <h2>Income</h2><table>
        <tr><td style="padding:6px 12px">Commission income (closed deals)</td><td style="padding:6px 12px;text-align:right;color:#059669">${fmtCurrency(pnl.income.commission_total)}</td></tr>
        ${rowsHtml(pnl.income.other, '#059669')}
        <tr class="tot"><td style="padding:6px 12px">Total Income</td><td style="padding:6px 12px;text-align:right;color:#059669">${fmtCurrency(pnl.income.total)}</td></tr>
      </table>
      <h2>Expenses</h2><table>
        ${rowsHtml(pnl.expenses.by_category, '#dc2626')}
        <tr class="tot"><td style="padding:6px 12px">Total Expenses</td><td style="padding:6px 12px;text-align:right;color:#dc2626">${fmtCurrency(pnl.expenses.total)}</td></tr>
      </table>
      <div class="net" style="background:${pnl.net_profit >= 0 ? '#ecfdf5' : '#fef2f2'};color:${pnl.net_profit >= 0 ? '#065f46' : '#dc2626'}">
        Net ${pnl.net_profit >= 0 ? 'Profit' : 'Loss'}: ${fmtCurrency(pnl.net_profit)}</div>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px">Commission income is computed from your closed transactions (net of brokerage split & fees). Not tax advice — confirm with your CPA.</p>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups to print the P&L.'); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 350);
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
        <Field label="Tax Year">
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inputStyle, maxWidth: 160 }}>
            {[0, 1, 2, 3].map(i => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
          </select>
        </Field>
        <button onClick={printPnL} disabled={!pnl} style={primaryBtn('#3b82f6')}>🖨️ Print P&L</button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>}
      {error && <div style={{ padding: 20, color: '#dc2626', background: '#fef2f2', borderRadius: 8 }}>Error: {error}</div>}

      {pnl && !loading && (
        <>
          {(company || profile) && (
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderLeft: `4px solid ${company?.primaryColor || '#059669'}` }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: company?.primaryColor || '#059669' }}>{company?.name || 'My Real Estate Business'}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Profit &amp; Loss — {year}
                  {profile ? ` • ${[profile.firstName, profile.lastName].filter(Boolean).join(' ')}` : ''}
                </div>
              </div>
              {company?.logoUrl && <img src={company.logoUrl} alt="" style={{ maxHeight: 44, maxWidth: 160, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, marginBottom: 20 }}>
            <SummaryCard label="Total Income" value={fmtCurrency(pnl.income.total)} sub={`${year}`} color="#10b981" />
            <SummaryCard label="Total Expenses" value={fmtCurrency(pnl.expenses.total)} sub={`${year}`} color="#dc2626" />
            <SummaryCard label={pnl.net_profit >= 0 ? 'Net Profit' : 'Net Loss'} value={fmtCurrency(pnl.net_profit)} sub="income − expenses" color={pnl.net_profit >= 0 ? '#059669' : '#dc2626'} />
          </div>

          {/* Income */}
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#065f46', display: 'flex', justifyContent: 'space-between' }}>
              <span>Income</span><span>{fmtCurrency(pnl.income.total)}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                <tr style={{ borderTop: '1px solid #f3f4f6' }}>
                  <Td>
                    Commission income (closed deals)
                    {pnl.income.commissions.length > 0 && (
                      <button onClick={() => setShowDeals(s => !s)} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12 }}>
                        {showDeals ? 'hide' : `${pnl.income.commissions.length} deal${pnl.income.commissions.length === 1 ? '' : 's'}`}
                      </button>
                    )}
                  </Td>
                  <Td align="right" style={{ fontWeight: 600, color: '#059669' }}>{fmtCurrency(pnl.income.commission_total)}</Td>
                </tr>
                {showDeals && pnl.income.commissions.map(d => (
                  <tr key={d.transaction_id} style={{ borderTop: '1px solid #f9fafb', background: '#fafafa' }}>
                    <Td style={{ paddingLeft: 28, color: '#6b7280', fontSize: 13 }}>{fmtDate(d.closing_date)} — {d.address || 'Property'}</Td>
                    <Td align="right" style={{ color: '#6b7280', fontSize: 13 }}>{fmtCurrency(d.net_commission)}</Td>
                  </tr>
                ))}
                {pnl.income.other.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <Td>{c.category}</Td><Td align="right" style={{ color: '#059669' }}>{fmtCurrency(c.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expenses */}
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: '#991b1b', display: 'flex', justifyContent: 'space-between' }}>
              <span>Expenses</span><span>{fmtCurrency(pnl.expenses.total)}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {pnl.expenses.by_category.length === 0 && <tr><Td colSpan={2} style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>No expenses for {year}.</Td></tr>}
                {pnl.expenses.by_category.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <Td>{c.category} <span style={{ color: '#9ca3af', fontSize: 12 }}>({c.count})</span></Td>
                    <Td align="right" style={{ color: '#dc2626' }}>{fmtCurrency(c.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// BANK STATEMENT IMPORT TAB
// ============================================================
function ImportTab({ categories, onCommitted }) {
  const [accountType, setAccountType] = useState('checking');
  const [periodLabel, setPeriodLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [importId, setImportId] = useState(null);
  const [lines, setLines] = useState([]);
  const [committing, setCommitting] = useState(false);
  const [done, setDone] = useState(null);
  const [history, setHistory] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const fileRef = useRef(null);

  const loadHistory = async () => {
    try { const d = await authFetch('/bank-import'); setHistory(d.imports || []); } catch { /* non-fatal */ }
  };
  useEffect(() => { loadHistory(); }, []);

  const deleteImport = async (imp) => {
    const label = `${imp.account_type === 'credit_card' ? 'Credit card' : 'Checking'} — ${(imp.period_label || '').trim() || imp.file_name || 'statement'}`;
    if (!window.confirm(`Remove "${label}"?\n\nThis takes its ${imp.committed_count || 0} saved transaction(s) back out of your Expenses, Income, and P&L. You can re-import the statement later if needed.`)) return;
    setDeletingId(imp.id); setError(null);
    try {
      const r = await authFetch(`/bank-import/${imp.id}`, { method: 'DELETE' });
      await loadHistory();
      onCommitted && onCommitted();
      setDone(null);
      setStatus(`Removed ${r.removedExpenses || 0} expense and ${r.removedIncome || 0} income item(s).`);
      setTimeout(() => setStatus(''), 4000);
    } catch (e) { setError(e.message); } finally { setDeletingId(null); }
  };

  const catNames = (categories || []).map(c => c.name);
  const allCatOptions = Array.from(new Set([...catNames, 'Commission', 'Other Income', 'Other']));

  const handleUpload = async (file) => {
    if (!file) return;
    setBusy(true); setError(null); setDone(null); setLines([]); setImportId(null);
    try {
      setStatus('Uploading statement...');
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(file);
      });
      const up = await authFetch('/bank-import/upload', { method: 'POST', body: JSON.stringify({ fileName: file.name, fileType: file.type || 'application/octet-stream', base64 }) });
      if (!up.fileKey) throw new Error(up.error || 'Upload failed');
      setStatus('AI reading your statement (this can take a minute)...');
      const enq = await authFetch('/bank-import/parse', { method: 'POST', body: JSON.stringify({ fileKey: up.fileKey, fileName: file.name, accountType, periodLabel: periodLabel || null }) });
      if (!enq.jobId) throw new Error(enq.error || 'Could not start parsing');
      await pollAiJob(enq.jobId, { timeoutMs: 180000 });
      setStatus('Loading transactions...');
      const data = await authFetch(`/bank-import/${enq.importId}`);
      setImportId(enq.importId);
      setLines((data.lines || []).map(l => ({
        id: l.id, include: !(l.is_transfer || l.duplicate_of_deal),
        txn_date: l.txn_date ? l.txn_date.split('T')[0] : '',
        description: l.description || '', amount: Number(l.amount || 0),
        direction: l.direction || 'expense', category: l.suggested_category || 'Other',
        is_transfer: !!l.is_transfer, duplicate_of_deal: l.duplicate_of_deal || null,
      })));
      if (!data.lines || data.lines.length === 0) setError('No transactions were found in that file. Try a CSV export from your bank, or a clearer PDF.');
      setStatus('');
    } catch (e) { setError(e.message); setStatus(''); } finally { setBusy(false); }
  };

  const updateLine = (id, patch) => setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

  const commit = async (force = false) => {
    const toCommit = lines.filter(l => l.include);
    if (toCommit.length === 0) { setError('Nothing selected to import.'); return; }
    setCommitting(true); setError(null);
    try {
      const res = await authFetch(`/bank-import/${importId}/commit`, { method: 'POST', body: JSON.stringify({ lines: toCommit, force }) });
      setDone(res.committed);
      setLines([]); setImportId(null);
      await loadHistory();
      onCommitted && onCommitted();
    } catch (e) {
      // Duplicate-import guard returns a 409 whose body is JSON; offer to override.
      let dup = null;
      try { const p = JSON.parse(e.message); if (p && p.error === 'duplicate_import') dup = p; } catch { /* not json */ }
      if (dup) {
        setCommitting(false);
        if (window.confirm(`${dup.message}\n\nImport it anyway?`)) return commit(true);
        return;
      }
      setError(e.message);
    } finally { setCommitting(false); }
  };

  const includedExp = lines.filter(l => l.include && l.direction === 'expense').reduce((s, l) => s + Number(l.amount || 0), 0);
  const includedInc = lines.filter(l => l.include && l.direction === 'income').reduce((s, l) => s + Number(l.amount || 0), 0);

  return (
    <div style={{ padding: '20px 24px' }}>
      {!lines.length && (
        <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px dashed #3b82f6', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>🏦 Import a bank or credit-card statement</div>
          <div style={{ fontSize: 13, color: '#1e3a8a', marginBottom: 14 }}>
            Upload a monthly statement (CSV export works best; PDF and screenshots also work). AI sorts each transaction into income vs expense and suggests a category. You review everything before it's saved.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 12 }}>
            <Field label="Account type">
              <select value={accountType} onChange={e => setAccountType(e.target.value)} style={inputStyle}>
                <option value="checking">Checking / Bank</option>
                <option value="credit_card">Credit Card</option>
              </select>
            </Field>
            <Field label="Statement period" hint="optional"><input value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} placeholder="e.g. May 2026" style={inputStyle} /></Field>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.ofx,.qfx,application/pdf,image/*" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...primaryBtn('#3b82f6'), opacity: busy ? 0.6 : 1 }}>
            {busy ? '⏳ Working...' : '📎 Upload Statement'}
          </button>
          {status && <div style={{ marginTop: 10, fontSize: 13, color: '#1e40af' }}>🔄 {status}</div>}
        </div>
      )}

      {done != null && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, padding: 16, color: '#065f46', marginBottom: 16 }}>
          ✅ Imported <strong>{done}</strong> transaction{done === 1 ? '' : 's'}. They now appear in your Expenses, Income, and P&L. <button onClick={() => setDone(null)} style={{ ...secondaryBtn, marginLeft: 8 }}>Import another</button>
        </div>
      )}

      {error && <div style={{ padding: 12, color: '#dc2626', background: '#fef2f2', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      {lines.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <SummaryCard label="Will add — Expenses" value={fmtCurrency(includedExp)} sub={`${lines.filter(l => l.include && l.direction === 'expense').length} items`} color="#dc2626" />
            <SummaryCard label="Will add — Income" value={fmtCurrency(includedInc)} sub={`${lines.filter(l => l.include && l.direction === 'income').length} items`} color="#10b981" />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => setLines(p => p.map(l => ({ ...l, include: true })))} style={secondaryBtn}>Select all</button>
              <button onClick={() => setLines(p => p.map(l => ({ ...l, include: false })))} style={secondaryBtn}>Select none</button>
              <button onClick={commit} disabled={committing} style={{ ...primaryBtn('#10b981'), opacity: committing ? 0.6 : 1 }}>{committing ? 'Importing...' : `✅ Import ${lines.filter(l => l.include).length} selected`}</button>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <tr><Th align="center">Add?</Th><Th>Date</Th><Th>Description</Th><Th align="center">Type</Th><Th>Category</Th><Th align="right">Amount</Th></tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: l.include ? 1 : 0.45 }}>
                    <Td align="center"><input type="checkbox" checked={l.include} onChange={e => updateLine(l.id, { include: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} /></Td>
                    <Td><input type="date" value={l.txn_date} onChange={e => updateLine(l.id, { txn_date: e.target.value })} style={{ ...inputStyle, padding: '4px 6px', fontSize: 12 }} /></Td>
                    <Td><input value={l.description} onChange={e => updateLine(l.id, { description: e.target.value })} style={{ ...inputStyle, padding: '4px 6px', fontSize: 12, minWidth: 160 }} /></Td>
                    <Td align="center">
                      <select value={l.direction} onChange={e => updateLine(l.id, { direction: e.target.value })} style={{ ...inputStyle, padding: '4px 6px', fontSize: 12, color: l.direction === 'income' ? '#059669' : '#dc2626', fontWeight: 600 }}>
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </Td>
                    <Td>
                      <select value={l.category} onChange={e => updateLine(l.id, { category: e.target.value })} style={{ ...inputStyle, padding: '4px 6px', fontSize: 12, minWidth: 130 }}>
                        {!allCatOptions.includes(l.category) && <option value={l.category}>{l.category}</option>}
                        {allCatOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Td>
                    <Td align="right"><input type="number" step="0.01" value={l.amount} onChange={e => updateLine(l.id, { amount: e.target.value })} style={{ ...inputStyle, padding: '4px 6px', fontSize: 12, maxWidth: 100, textAlign: 'right', fontWeight: 600 }} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// SHARED PRIMITIVES
// ============================================================
function ModalShell({ children, onClose, title, width = 560 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 14, width: '100%', maxWidth: width,
          maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'white', zIndex: 1
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1f2937' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6, fontSize: 12 }}>— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, sub, color, smallValue }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: smallValue ? 14 : 22, fontWeight: 700, color: '#1f2937', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th style={{
      padding: '10px 12px', textAlign: align, fontSize: 12,
      fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5
    }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', colSpan, style = {} }) {
  return (
    <td colSpan={colSpan} style={{ padding: '10px 12px', textAlign: align, color: '#1f2937', ...style }}>
      {children}
    </td>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  background: 'white',
  boxSizing: 'border-box',
  outline: 'none'
};

const primaryBtn = (color) => ({
  background: color,
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: '9px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
});

const secondaryBtn = {
  background: 'white',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '9px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer'
};

const iconBtn = {
  background: 'none',
  border: 'none',
  fontSize: 16,
  cursor: 'pointer',
  padding: '4px 6px',
  borderRadius: 4
};

const linkBtn = {
  background: 'none',
  border: 'none',
  color: '#3b82f6',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  padding: 0,
  textDecoration: 'underline'
};
