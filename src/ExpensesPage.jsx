import React, { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://liz-team-server-api-production.up.railway.app';

const getToken = () => localStorage.getItem('tp_token');

const authFetch = async (path, options = {}) => {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Request failed: ${res.status}`);
  }
  return res.json();
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
      if (filterCategory) params.set('category_id', filterCategory);
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
    if (filterDeductible === 'yes' && !exp.tax_deductible) return false;
    if (filterDeductible === 'no' && exp.tax_deductible) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      const hay = `${exp.vendor || ''} ${exp.description || ''} ${exp.notes || ''} ${exp.category_name || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Totals
  const totalAll = visibleExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalDeductible = visibleExpenses.filter(e => e.tax_deductible).reduce((s, e) => s + Number(e.amount || 0), 0);
  const countAll = visibleExpenses.length;

  // CSV Export
  const exportCSV = () => {
    if (visibleExpenses.length === 0) {
      alert('No expenses to export with current filters.');
      return;
    }
    const headers = ['Date', 'Vendor', 'Category', 'Description', 'Amount', 'Tax Deductible', 'Payment Method', 'Notes'];
    const rows = visibleExpenses.map(e => [
      e.expense_date || '',
      e.vendor || '',
      e.category_name || '',
      e.description || '',
      Number(e.amount || 0).toFixed(2),
      e.tax_deductible ? 'Yes' : 'No',
      e.payment_method || '',
      (e.notes || '').replace(/\n/g, ' ')
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
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>💵 Expense Tracker</h1>
          </div>
          <button
            onClick={() => setTeachOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.25)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            ℹ️ How this helps you
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
          Track business expenses. Snap receipts. Export at tax time. Your data is private — even admins can't see it.
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ padding: '20px 24px 0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <SummaryCard label="Total Expenses" value={fmtCurrency(totalAll)} sub={`${countAll} item${countAll === 1 ? '' : 's'}`} color="#1f2937" />
        <SummaryCard label="Tax-Deductible" value={fmtCurrency(totalDeductible)} sub="for Schedule C" color="#059669" />
        <SummaryCard label="Non-Deductible" value={fmtCurrency(totalAll - totalDeductible)} sub="personal/other" color="#6b7280" />
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
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Tax-Deductible">
          <select value={filterDeductible} onChange={e => setFilterDeductible(e.target.value)} style={inputStyle}>
            <option value="all">All</option>
            <option value="yes">Deductible only</option>
            <option value="no">Non-deductible</option>
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
                  <Th>Description</Th>
                  <Th align="right">Amount</Th>
                  <Th align="center">Deductible</Th>
                  <Th align="center">Receipt</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visibleExpenses.map(exp => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <Td>{fmtDate(exp.expense_date)}</Td>
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
                        {exp.category_name || 'Uncategorized'}
                      </span>
                    </Td>
                    <Td style={{ color: '#6b7280', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exp.description || ''}
                    </Td>
                    <Td align="right" style={{ fontWeight: 600 }}>{fmtCurrency(exp.amount)}</Td>
                    <Td align="center">
                      {exp.tax_deductible ? (
                        <span style={{ color: '#059669', fontSize: 18 }}>✓</span>
                      ) : (
                        <span style={{ color: '#d1d5db' }}>—</span>
                      )}
                    </Td>
                    <Td align="center">
                      {exp.receipt_url ? (
                        <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                          📎 View
                        </a>
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
                  <Td colSpan={3} style={{ fontSize: 12, color: '#059669' }}>
                    Deductible: {fmtCurrency(totalDeductible)}
                  </Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

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
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date || todayISO());
  const [categoryId, setCategoryId] = useState(expense?.category_id || '');
  const [description, setDescription] = useState(expense?.description || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [paymentMethod, setPaymentMethod] = useState(expense?.payment_method || '');
  const [taxDeductible, setTaxDeductible] = useState(expense?.tax_deductible !== undefined ? !!expense.tax_deductible : true);
  const [receiptUrl, setReceiptUrl] = useState(expense?.receipt_url || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleReceiptUpload = async (file) => {
    if (!file) return;
    setOcrLoading(true);
    setError(null);
    try {
      // Convert to base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = () => rej(new Error('Read failed'));
        r.readAsDataURL(file);
      });

      const data = await authFetch('/expenses/extract-receipt', {
        method: 'POST',
        body: JSON.stringify({
          file_data: base64,
          file_name: file.name,
          mime_type: file.type
        })
      });

      // Backend returns extracted fields + uploaded receipt_url
      const extracted = data.extracted || data;
      setOcrPreview(extracted);

      if (extracted.vendor) setVendor(extracted.vendor);
      if (extracted.amount) setAmount(String(extracted.amount));
      if (extracted.expense_date) setExpenseDate(extracted.expense_date);
      if (extracted.description) setDescription(extracted.description);
      if (extracted.suggested_category_id) setCategoryId(extracted.suggested_category_id);
      if (data.receipt_url) setReceiptUrl(data.receipt_url);

    } catch (e) {
      setError('Receipt scan failed: ' + e.message);
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
    if (!expenseDate) {
      setError('Pick an expense date.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vendor: vendor || null,
        amount: Number(amount),
        expense_date: expenseDate,
        category_id: categoryId || null,
        description: description || null,
        notes: notes || null,
        payment_method: paymentMethod || null,
        tax_deductible: !!taxDeductible,
        receipt_url: receiptUrl || null
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
            Upload a photo or PDF of your receipt. We'll extract the vendor, amount, and date automatically. You can review and edit everything before saving.
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={e => handleReceiptUpload(e.target.files?.[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrLoading}
            style={{ ...primaryBtn('#10b981'), opacity: ocrLoading ? 0.6 : 1 }}
          >
            {ocrLoading ? '🔄 Scanning receipt...' : '📎 Upload Receipt'}
          </button>
          {ocrPreview && (
            <div style={{ marginTop: 10, padding: 10, background: 'white', borderRadius: 8, fontSize: 13, color: '#065f46' }}>
              ✨ <strong>AI extracted:</strong> {ocrPreview.vendor || 'unknown vendor'} • {fmtCurrency(ocrPreview.amount || 0)} • {fmtDate(ocrPreview.expense_date)}
              <div style={{ marginTop: 4, fontSize: 12 }}>Review the fields below — edit anything that looks off.</div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Vendor" hint="Who you paid">
          <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="e.g. Office Depot" style={inputStyle} />
        </Field>
        <Field label="Amount *" hint="">
          <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
        </Field>
        <Field label="Date *">
          <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Category">
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={inputStyle}>
            <option value="">— pick one —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Payment Method">
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={inputStyle}>
            <option value="">— optional —</option>
            <option value="Cash">Cash</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Debit Card">Debit Card</option>
            <option value="Check">Check</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Tax Deductible?" hint="Schedule C business expense">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', height: 38 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={taxDeductible}
                onChange={e => setTaxDeductible(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14 }}>{taxDeductible ? '✓ Yes, deductible' : 'No'}</span>
            </label>
          </div>
        </Field>
      </div>

      <Field label="Description" hint="Short summary">
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Printer paper and toner for closings" style={inputStyle} />
      </Field>

      <Field label="Notes" hint="Anything else (which client, which property, business purpose)">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="e.g. Client lunch with the Garcias re: 123 Oak Dr listing"
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
      </Field>

      {receiptUrl && (
        <div style={{ fontSize: 13, color: '#059669', marginBottom: 12 }}>
          📎 Receipt attached — <a href={receiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#059669' }}>view</a>
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
  const totalDeductible = report?.total_deductible || byCategory.filter(c => c.tax_deductible !== false).reduce((s, c) => s + Number(c.total || 0), 0);
  const totalAll = report?.total || byCategory.reduce((s, c) => s + Number(c.total || 0), 0);

  const exportReportCSV = () => {
    if (!byCategory.length) return;
    const headers = ['Category', 'Count', 'Total', 'Tax Deductible'];
    const rows = byCategory.map(c => [
      c.category_name || c.name || 'Uncategorized',
      c.count || 0,
      Number(c.total || 0).toFixed(2),
      c.tax_deductible !== false ? 'Yes' : 'No'
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
            <SummaryCard label="Tax-Deductible" value={fmtCurrency(totalDeductible)} sub="Schedule C" color="#059669" />
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
                    <Td>{c.category_name || c.name || 'Uncategorized'}</Td>
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
