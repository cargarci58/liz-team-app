// ============================================================================
// CMA TOOL — React port of reference/cma-tool-v5/index.html App component.
// Markup + classNames are reproduced verbatim (scoped under .cma-root via
// cmaTool.css). All math comes from ./lib/cmaAnalysis.js (the frozen engine).
// Integration changes vs. the standalone tool:
//   - subject seeds from the transaction (address / year built / list price)
//   - "Print / Save as PDF" renders into an isolated window (no app chrome)
//   - wrapped in a local ErrorBoundary (preserves the source's crash guard)
// Do NOT change the math or the seller-report design here — see CLAUDE.md.
// ============================================================================
import React, { useState, useMemo, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import './cmaTool.css';
import cmaCssRaw from './cmaTool.css?raw';
import {
  fmtMoney,
  fmtPsf,
  fmtPct,
  fmtMoneySigned,
  UPGRADE_LIBRARY,
  normalizeCompRow,
  computeOutlierInfo,
  computeMarketDirection,
  computeUpgradeAdjustment,
  runAnalysis,
} from './lib/cmaAnalysis.js';
import { normalizeRentalRow, computeRentalAnalysis } from './lib/rentalAnalysis.js';

// Backend base URL — matches the hardcoded value used elsewhere in the app
// (CMACalculator, SMSPanel). Multi-tenant: every branding/profile call below is
// scoped to the logged-in agent's tenant by the auth token.
const API_BASE = 'https://liz-team-server-api-production.up.railway.app';

// ===== MLS SEARCH GUIDE (verbatim from index.html) =====
function MLSGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mls-guide">
      <div className="mls-guide-header" onClick={() => setOpen(!open)}>
        <div>
          <div className="mls-guide-title">📋 MLS Search Setup — How to pull the right data</div>
        </div>
        <div className="mls-guide-icon">{open ? '▲ HIDE' : '▼ SHOW'}</div>
      </div>
      {open && (
        <div className="mls-guide-body">
          <p>The quality of your CMA depends entirely on pulling the right comps from MLS. Use these search parameters every time. For best results, save these as a named search in MLS so it's one click for every future CMA.</p>
          <h4>Search Parameters</h4>
          <table>
            <thead><tr><th>Parameter</th><th>Setting</th></tr></thead>
            <tbody>
              <tr><td>Status</td><td>Sold + Pending + Active + Expired (all four)</td></tr>
              <tr><td>Property Type</td><td>Match subject (Single Family Detached, Townhouse, etc.)</td></tr>
              <tr><td>Geographic</td><td>Same subdivision first; 0.5 mile radius as fallback</td></tr>
              <tr><td>Heated Sqft</td><td>Subject ±15-20% (e.g., 2,541 sqft → 2,000-3,000)</td></tr>
              <tr><td>Beds</td><td>Subject ±1 (e.g., 4 BR → 3-5 BR)</td></tr>
              <tr><td>Baths</td><td>No filter — adjust in analysis</td></tr>
              <tr><td>Year Built</td><td>Subject ±10 years (±15 for older neighborhoods)</td></tr>
              <tr><td>Close Date</td><td>Last 6 months primary; expand to 9-12 if needed</td></tr>
              <tr><td>Pool</td><td>No filter — tool calculates pool premium</td></tr>
              <tr><td>Lot Size</td><td>No filter — tool handles lot adjustment</td></tr>
            </tbody>
          </table>
          <h4>Required CSV Export Columns</h4>
          <p>The tool reads these standard MLS export fields. Set up a "CMA Export" report view in MLS with these columns:</p>
          <p><strong>Required:</strong> <code>Address</code>, <code>City</code>, <code>Zip</code>, <code>Legal Subdivision Name</code>, <code>Heated Area</code>, <code>Current Price</code>, <code>LP / SqFt</code>, <code>SP / SqFt</code>, <code>Close Date</code>, <code>On Market Date</code>, <code>CDOM</code>, <code>ADOM</code>, <code>Status</code></p>
          <p><strong>Recommended:</strong> <code>Beds</code>, <code>Full Baths</code>, <code>Half Baths</code>, <code>Year Built</code>, <code>Pool</code>, <code>View</code>, <code>Water View</code>, <code>Lot Size Acres</code>, <code>Sold Terms</code>, <code>List Agent</code>, <code>Selling Agent</code>, <code>Stories</code> or <code>Levels</code>, <code>Garage Spaces</code></p>
          <h4>Before You Upload — Pre-Flight Checklist</h4>
          <ul>
            <li><strong>Aim for 8-15 comps</strong> after filtering — fewer than 5 is risky, more than 20 dilutes the analysis</li>
            <li><strong>Check for distress sales</strong> — foreclosure, family transfer, estate liquidation — exclude these manually</li>
            <li><strong>Spread closing dates</strong> across the period; all 8 closing in one month = thin dataset</li>
            <li><strong>Exclude the subject's own prior sale</strong> if it shows up</li>
            <li><strong>Save the CSV as comma-delimited</strong>, not XLSX</li>
          </ul>
          <h4>For Low-Volume Subdivisions</h4>
          <p>When a community has fewer than 5 closed sales in 6 months (e.g., Isles of Lake Nona, smaller luxury enclaves):</p>
          <ul>
            <li>Expand the time window to 12 months in the same subdivision (do NOT cross subdivision lines first)</li>
            <li>Widen sqft tolerance to ±25%</li>
            <li>Use Active + Expired heavily as context — they show current competition and rejected prices</li>
            <li>Only as last resort, pull from a directly-adjacent subdivision with same school zone and builder profile</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ===== TREND CHART (verbatim from index.html) =====
function TrendChart({ points }) {
  if (!points || points.length < 2) return null;
  const width = 760, height = 180, padding = 36;
  const xs = points.map((p) => p.date.getTime());
  const ys = points.map((p) => p.psf);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys) * 0.95, yMax = Math.max(...ys) * 1.05;
  const xScale = (x) => padding + ((x - xMin) / (xMax - xMin)) * (width - padding * 2);
  const yScale = (y) => height - padding - ((y - yMin) / (yMax - yMin)) * (height - padding * 2);
  const n = points.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanYv = ys.reduce((s, v) => s + v, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanYv), 0);
  const den = xs.reduce((s, x) => s + Math.pow(x - meanX, 2), 0);
  const slope = den > 0 ? num / den : 0;
  const intercept = meanYv - slope * meanX;
  const lineY1 = intercept + slope * xMin;
  const lineY2 = intercept + slope * xMax;
  const trendUp = lineY2 > lineY1;
  const trendColor = trendUp ? '#1E8449' : '#C0392B';
  const fmtDate = (d) => `${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxHeight: 200 }}>
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#DDDDDD" strokeWidth="1" />
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#DDDDDD" strokeWidth="1" />
      <text x={padding - 6} y={padding + 4} textAnchor="end" fontSize="10" fill="#666666" fontFamily="Segoe UI, system-ui, sans-serif">${yMax.toFixed(0)}</text>
      <text x={padding - 6} y={height - padding + 4} textAnchor="end" fontSize="10" fill="#666666" fontFamily="Segoe UI, system-ui, sans-serif">${yMin.toFixed(0)}</text>
      <text x={padding} y={height - padding + 18} textAnchor="start" fontSize="10" fill="#666666" fontFamily="Segoe UI, system-ui, sans-serif">{fmtDate(new Date(xMin))}</text>
      <text x={width - padding} y={height - padding + 18} textAnchor="end" fontSize="10" fill="#666666" fontFamily="Segoe UI, system-ui, sans-serif">{fmtDate(new Date(xMax))}</text>
      <line x1={xScale(xMin)} y1={yScale(lineY1)} x2={xScale(xMax)} y2={yScale(lineY2)} stroke={trendColor} strokeWidth="2" strokeDasharray="4 4" opacity="0.7" />
      {points.map((p, i) => (
        <circle key={i} cx={xScale(p.date.getTime())} cy={yScale(p.psf)} r="4" fill="#C0392B" />
      ))}
    </svg>
  );
}

// Maps the seller-intake condition label (stored on the transaction) to the
// CMA's condition-tier code. Falls back to the baseline ("move_in").
const CONDITION_TIER_MAP = {
  'Premium / Renovated': 'premium',
  'Move-In Ready': 'move_in',
  'Original but Maintained': 'original_maintained',
  'Needs Some Work': 'needs_work',
  'Major Updates Needed': 'major_updates',
  // Also accept the tier code itself (the CMA re-saves specs to the tx).
  premium: 'premium', move_in: 'move_in', original_maintained: 'original_maintained',
  needs_work: 'needs_work', major_updates: 'major_updates',
};

// Seed the upgrade grid from the upgrades the seller checked at intake.
// intake_details.upgrades is { upgradeId: true }; the grid wants { id: { checked } }.
// Only ids present in the UPGRADE_LIBRARY survive — anything else is ignored.
const makeInitialUpgrades = (tx) => {
  const out = {};
  const picked = tx?.intakeDetails?.upgrades;
  if (picked && typeof picked === 'object') {
    for (const id of Object.keys(picked)) {
      if (picked[id]) out[id] = { checked: true };
    }
  }
  return out;
};

// Seed the subject from the transaction. Property specs are captured at intake
// (seller form) and re-saved each time a CMA is run, so the Subject tab
// pre-fills. The agent can still edit anything.
const makeInitialSubject = (tx) => ({
  address: tx?.address || '',
  sqft: tx?.sqft != null && tx?.sqft !== '' ? String(tx.sqft) : '',
  beds: tx?.beds != null && tx?.beds !== '' ? String(tx.beds) : '',
  baths: tx?.baths != null && tx?.baths !== '' ? String(tx.baths) : '',
  yearBuilt: tx?.yearBuilt ? String(tx.yearBuilt) : '',
  lotSize: tx?.lotAcres != null && tx?.lotAcres !== '' ? String(tx.lotAcres) : '',
  poolType: tx?.poolType ? String(tx.poolType).toLowerCase() : 'none',
  stories: tx?.stories ? String(tx.stories) : '1',
  garageSpaces: tx?.garageSpaces ? String(tx.garageSpaces) : '2',
  hasWaterView: !!tx?.hasWaterView,
  hasGolfView: !!tx?.hasGolfView,
  conditionTier: CONDITION_TIER_MAP[tx?.propertyCondition] || 'move_in',
  lotQuality: 'standard',
  isCurrentlyListed: false,
  currentListPrice: tx?.listPrice ? String(tx.listPrice) : '',
  currentDOM: '',
  priceReductions: '',
  showingActivity: 'moderate',
  offersReceived: 'none',
  manualPriceOverride: '',
  manualPriceNote: '',
  monthlyHOA: '',
  propertyTaxAnnual: '',
  insuranceAnnual: '',
  estMortgagePayment: '',
});

function CmaTool({ tx, token, currentUser, standalone = false, initialCma = null, onConvertToTransaction }) {
  // ===== BRANDING (multi-tenant) =====
  // The masthead and the client-facing seller report must carry the LOGGED-IN
  // agent and THEIR brokerage — never a hardcoded brokerage. Seed from the
  // current user, then enrich with the tenant's company name + the agent's
  // profile (phone/license). All requests are tenant-scoped by the token.
  const [branding, setBranding] = useState({
    brokerage: '',
    agentName: ((currentUser?.firstName || '') + ' ' + (currentUser?.lastName || '')).trim(),
    license: '',
    phone: '',
    email: currentUser?.email || '',
  });
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: 'Bearer ' + token };
    fetch(API_BASE + '/settings/company', { headers })
      .then((r) => r.json())
      .then((d) => { if (d?.company?.name) setBranding((b) => ({ ...b, brokerage: d.company.name })); })
      .catch(() => {});
    fetch(API_BASE + '/profile', { headers })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.profile) return;
        setBranding((b) => ({
          ...b,
          agentName: ((d.profile.firstName || '') + ' ' + (d.profile.lastName || '')).trim() || b.agentName,
          phone: d.profile.phone || b.phone,
          license: d.profile.licenseNumber || d.profile.license_number || b.license,
          email: d.profile.email || b.email,
        }));
      })
      .catch(() => {});
  }, [token]);

  // Display strings (never fall back to any specific brokerage/agent).
  const brokerageBrand = branding.brokerage || branding.agentName || 'Comparative Market Analysis';
  const agentDisplayName = branding.agentName || 'Your Agent';
  const agentTitleLine = ['Licensed Realtor', branding.brokerage].filter(Boolean).join(' · ');

  // ── Draft autosave ──────────────────────────────────────────────────────
  // The CMA tab unmounts when the agent switches to another tab, which would
  // otherwise wipe all in-progress work. Persist a per-transaction draft to
  // localStorage so switching tabs (and even reloading) keeps the data. The
  // draft is cleared only by "+ New CMA".
  const draftKey = `cma_draft_${initialCma?.id || (standalone ? 'standalone' : tx?.id) || 'anon'}`;
  const loadDraft = () => {
    try { return JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch { return null; }
  };

  // When reopening a SAVED standalone CMA, seed from it (it wins over any draft).
  // Saved comps are the previously-selected set, so re-select all of them.
  const reopen = standalone && initialCma ? initialCma : null;

  // The id of the standalone CMA being edited (null until first save). Drives the
  // Save vs. Update label and lets "Create Transaction" link back to this record.
  const [standaloneCmaId, setStandaloneCmaId] = useState(reopen?.id || null);

  const [mode, setMode] = useState(() => loadDraft()?.mode || 'agent');
  const [comps, setComps] = useState(() => (reopen?.comps_data) || loadDraft()?.comps || []);
  const [selectedIds, setSelectedIds] = useState(() => new Set(reopen?.comps_data ? reopen.comps_data.map((c) => c.id) : (loadDraft()?.selectedIds || [])));
  const [filename, setFilename] = useState(() => loadDraft()?.filename || '');
  const [subject, setSubject] = useState(() => (reopen?.subject) || loadDraft()?.subject || makeInitialSubject(tx));
  const [upgrades, setUpgrades] = useState(() => (reopen?.upgrades) || loadDraft()?.upgrades || makeInitialUpgrades(tx));
  const [marketOverride, setMarketOverride] = useState(() => (reopen?.market_override) || loadDraft()?.marketOverride || 'auto');
  const [dragging, setDragging] = useState(false);
  const [filters, setFilters] = useState(() => loadDraft()?.filters || { similarSize: true, timeWindow: '9' });
  const [statusFilter, setStatusFilter] = useState(() => loadDraft()?.statusFilter || { SLD: true, PND: true, ACT: true, EXP: true });
  const [rentalComps, setRentalComps] = useState(() => loadDraft()?.rentalComps || []);
  const [rentalFilename, setRentalFilename] = useState(() => loadDraft()?.rentalFilename || '');
  const rentalInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const printRef = useRef(null);
  const [saveState, setSaveState] = useState(null); // { status: 'saving'|'ok'|'err', msg }

  // Autosave the working draft whenever it changes (survives tab switch / reload).
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ mode, comps, selectedIds: [...selectedIds], filename, subject, upgrades, marketOverride, filters, statusFilter, rentalComps, rentalFilename })
      );
    } catch {
      /* localStorage full or unavailable — non-fatal */
    }
  }, [draftKey, mode, comps, selectedIds, filename, subject, upgrades, marketOverride, filters, statusFilter, rentalComps, rentalFilename]);

  const resetCMA = () => {
    if (window.confirm('Start a new CMA? This will clear the comps and analysis (subject details reset to the transaction).')) {
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setComps([]);
      setSelectedIds(new Set());
      setFilename('');
      setRentalComps([]);
      setRentalFilename('');
      setSaveState(null);
      setSubject(makeInitialSubject(tx));
      setUpgrades({});
      setMarketOverride('auto');
      setFilters({ similarSize: true, timeWindow: '9' });
      setStatusFilter({ SLD: true, PND: true, ACT: true, EXP: true });
      setMode('agent');
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    setFilename(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data
          .map((row, idx) => normalizeCompRow(row, idx))
          .filter((c) => c.address && c.sqft && (c.currentPrice || c.effectivePsf));
        setComps(parsed);
        setSelectedIds(new Set());
        // Don't fail silently: a wrong/empty export looks like "nothing happened".
        if (parsed.length === 0) {
          setSaveState({ status: 'err', msg: `Couldn't read any comps from "${file.name}". Make sure it's a comma-delimited MLS export (.csv) with Address, Heated/Living Sqft, and a Price column. See the "Required CSV Export Columns" guide above.` });
        } else {
          setSaveState({ status: 'ok', msg: `Loaded ${parsed.length} comp${parsed.length === 1 ? '' : 's'} from ${file.name}.` });
        }
      },
      error: (err) => setSaveState({ status: 'err', msg: `Could not read that file: ${err?.message || 'unknown error'}. Make sure it's a .csv MLS export.` }),
    });
  };

  // Rental option (Phase 2): a SEPARATE MLS export of recently leased comps.
  const handleRentalFile = (file) => {
    if (!file) return;
    setRentalFilename(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data
          .map((row, idx) => normalizeRentalRow(row, idx))
          .filter((c) => c.address && c.rentPsf != null && c.rentPsf > 0);
        setRentalComps(parsed);
      },
    });
  };

  // Print the active view into an isolated window so the app chrome (header,
  // tabs, sidebar) doesn't bleed into the seller's PDF. Reuses the scoped CSS.
  const printView = () => {
    const node = printRef.current;
    if (!node) {
      window.print();
      return;
    }
    const w = window.open('', '_blank', 'width=940,height=1100');
    if (!w) {
      window.print();
      return;
    }
    w.document.open();
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8" />` +
        `<title>${subject.address || 'CMA'} — Seller Report</title>` +
        `<style>${cmaCssRaw}</style></head>` +
        `<body><div class="cma-root">${node.innerHTML}</div></body></html>`
    );
    w.document.close();
    // Give fonts/styles a beat to load before printing.
    w.focus();
    setTimeout(() => {
      w.print();
    }, 500);
  };

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]); // strip data: prefix (matches /documents/upload)
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

  // Save the seller report to the transaction's Documents. Scalable + no backend
  // browser engine: the PDF is rendered in THIS browser (client CPU), then the
  // structured CMA record is persisted (snapshot + writes the subject specs back
  // to the transaction so the next CMA auto-fills). See CLAUDE.md PDF decision.
  const saveToDocuments = async () => {
    if (!tx?.id || !token) {
      setSaveState({ status: 'err', msg: 'Open this CMA from inside a transaction to save it.' });
      return;
    }
    const node = printRef.current?.querySelector('.sr-page');
    if (!node) {
      setSaveState({ status: 'err', msg: 'Open the Seller Report first, then Save.' });
      return;
    }
    setSaveState({ status: 'saving', msg: 'Generating PDF…' });
    let iframe;
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const safeAddr = (subject.address || 'CMA').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'CMA';
      const filename = `CMA-${safeAddr}-${new Date().toISOString().slice(0, 10)}.pdf`;

      // Produce the SAME condensed report the browser Print/Save-PDF path makes.
      // html2canvas ignores @media print, so we render a self-contained copy in a
      // hidden iframe whose width (940px, like the print window) keeps the desktop
      // 3-column layout (narrower would trip the report's mobile breakpoints), and
      // we inline the @media print rules as always-on. Then we slice the captured
      // image across US-Letter pages with jsPDF for a deterministic page count.
      const printInner = (() => {
        const css = cmaCssRaw;
        const i = css.indexOf('@media print');
        if (i < 0) return '';
        const open = css.indexOf('{', i);
        if (open < 0) return '';
        let depth = 0;
        let k = open;
        for (; k < css.length; k++) {
          const ch = css[k];
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) break; }
        }
        return css.slice(open + 1, k); // inner rules of the @media print block
      })();
      // Render close to the letter page width so the captured image maps ~1:1 to
      // the page (no shrink-down) — the print CSS forces the desktop columns, so a
      // page-width render no longer trips the report's mobile breakpoints. This is
      // what keeps the saved PDF's type as big as the on-screen/print layout.
      const RENDER_W = 800;
      iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${RENDER_W}px;height:3000px;border:0;`;
      document.body.appendChild(iframe);
      const idoc = iframe.contentDocument;
      idoc.open();
      idoc.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8" />` +
          `<style>${cmaCssRaw}</style><style>${printInner}</style></head>` +
          `<body style="margin:0;width:${RENDER_W}px;background:#fff">` +
          `<div class="cma-root" style="background:#fff"><div class="sr-page">${node.innerHTML}</div></div>` +
          `</body></html>`
      );
      idoc.close();
      if (idoc.fonts && idoc.fonts.ready) { try { await idoc.fonts.ready; } catch (e) { /* fonts optional */ } }
      await new Promise((r) => setTimeout(r, 450)); // let layout settle
      const target = idoc.querySelector('.sr-page');
      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: RENDER_W });

      const pdf = new jsPDF('p', 'pt', 'letter');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const srRect = target.getBoundingClientRect();
      const scale = canvas.width / srRect.width;   // canvas px per CSS px (~2)
      const cssToPt = pageW / srRect.width;         // CSS px -> PDF pt at full width
      const pageCssHeight = pageH / cssToPt;        // CSS px that fills one page
      const totalCss = srRect.height;

      // Smart page breaks: collect the bottom edge of every atomic block (cover,
      // property line, each section child — heading/paragraph/hero/comp-list/
      // strategy row/etc., each comp row, signature, footer) so a page never
      // splits a row, card, heading, or paragraph mid-way.
      const srTop = srRect.top;
      const units = target.querySelectorAll(
        '.sr-cover, .sr-property, .sr-section > *, .sr-comp-card, .sr-signature, .sr-footer'
      );
      const breaks = Array.from(new Set(
        Array.from(units).map((el) => el.getBoundingClientRect().bottom - srTop)
      )).filter((b) => b > 0 && b < totalCss).sort((a, b) => a - b);
      breaks.push(totalCss);

      // Greedily fill each page up to the last safe break that fits.
      const segments = [];
      let start = 0;
      let guard = 0;
      while (start < totalCss - 0.5 && guard++ < 80) {
        const limit = start + pageCssHeight;
        let cut = null;
        for (const b of breaks) { if (b > start + 1 && b <= limit + 0.5) cut = b; }
        if (cut == null) cut = Math.min(limit, totalCss); // a block taller than a page: hard cut
        segments.push([start, cut]);
        start = cut;
      }

      // Render each segment as its own top-aligned page (cropped via a temp canvas
      // so there is no bleed between pages).
      const tmp = document.createElement('canvas');
      const tctx = tmp.getContext('2d');
      segments.forEach(([s, e], i) => {
        const sTopPx = Math.round(s * scale);
        const sHpx = Math.max(1, Math.round((e - s) * scale));
        tmp.width = canvas.width;
        tmp.height = sHpx;
        tctx.fillStyle = '#ffffff';
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.drawImage(canvas, 0, sTopPx, canvas.width, sHpx, 0, 0, canvas.width, sHpx);
        if (i > 0) pdf.addPage();
        pdf.addImage(tmp.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, (e - s) * cssToPt);
      });
      const blob = pdf.output('blob');
      const base64 = await blobToBase64(blob);
      setSaveState({ status: 'saving', msg: 'Saving to Documents…' });
      const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
      const up = await fetch(API_BASE + '/documents/upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactionId: tx.id, fileName: filename, fileType: 'application/pdf', category: 'CMA Report', base64 }),
      });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(upData.error || 'Upload failed');
      const documentId = upData?.document?.id || upData?.documentId || upData?.id || null;
      // Persist the CMA snapshot + write subject specs back to the transaction.
      await fetch(API_BASE + `/transactions/${tx.id}/cmas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ subject, comps: selected, upgrades, marketOverride, analysis, documentId }),
      }).catch(() => {});
      setSaveState({ status: 'ok', msg: `Saved "${filename}" to this transaction's Documents.` });
    } catch (e) {
      setSaveState({ status: 'err', msg: e?.message || 'Could not save to Documents.' });
    } finally {
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }
  };

  // ── Standalone CMA persistence (no transaction yet) ─────────────────────
  // Used for pre-listing valuations the agent runs before a deal exists.
  // Saves the structured analysis to /cmas so it can be reopened or turned
  // into a transaction later. Returns the saved id (or null on failure).
  const saveStandalone = async () => {
    if (!token) { setSaveState({ status: 'err', msg: 'Please sign in to save this CMA.' }); return null; }
    if (!subject.address) { setSaveState({ status: 'err', msg: 'Add the property address before saving.' }); return null; }
    setSaveState({ status: 'saving', msg: 'Saving CMA…' });
    try {
      const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
      const body = JSON.stringify({ subject, comps: selected, upgrades, marketOverride, analysis });
      const url = standaloneCmaId ? `${API_BASE}/cmas/${standaloneCmaId}` : `${API_BASE}/cmas`;
      const r = await fetch(url, { method: standaloneCmaId ? 'PUT' : 'POST', headers, body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Save failed');
      const id = d.cmaId || standaloneCmaId;
      if (id && id !== standaloneCmaId) setStandaloneCmaId(id);
      setSaveState({ status: 'ok', msg: 'CMA saved. Find it later under 📊 CMA, or turn it into a transaction.' });
      return id;
    } catch (e) {
      setSaveState({ status: 'err', msg: e?.message || 'Could not save CMA.' });
      return null;
    }
  };

  // Turn this standalone CMA into a real transaction. Saves first (so the
  // record exists and carries the recommended price), then hands the subject
  // up to the app, which opens the New Transaction form pre-filled.
  const convertToTransaction = async () => {
    if (!subject.address) {
      // The Subject section (incl. the address field) only appears AFTER comps are
      // imported, so guide the user to the right step instead of failing silently.
      const msg = comps.length === 0
        ? 'First import your MLS comps in Section 01 below — the Subject details (including the property address) appear right after. Then tap Create Transaction.'
        : 'Add the property address in the Subject section below, then tap Create Transaction.';
      setSaveState({ status: 'err', msg });
      return;
    }
    const id = await saveStandalone();
    if (onConvertToTransaction) onConvertToTransaction({ cmaId: id, subject, analysis });
  };

  // ===== DERIVED STATE (same dependency wiring as the source useMemos) =====
  const filteredComps = useMemo(() => {
    if (!comps.length) return [];
    return comps.filter((c) => {
      if (!statusFilter[c.status]) return false;
      if (filters.similarSize && subject.sqft) {
        const target = parseFloat(subject.sqft);
        if (target && c.sqft) {
          const pct = Math.abs(c.sqft - target) / target;
          if (pct > 0.2) return false;
        }
      }
      const tw = parseInt(filters.timeWindow);
      if (tw && c.closeDate && c.status === 'SLD') {
        const parts = c.closeDate.split('/');
        if (parts.length === 3) {
          const d = new Date(parts[2], parts[0] - 1, parts[1]);
          const monthsAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30);
          if (monthsAgo > tw) return false;
        }
      }
      return true;
    });
  }, [comps, filters, statusFilter, subject.sqft]);

  const selected = useMemo(() => comps.filter((c) => selectedIds.has(c.id)), [comps, selectedIds]);

  const healthStats = useMemo(() => {
    const stats = { SLD: 0, PND: 0, ACT: 0, EXP: 0 };
    selected.forEach((c) => {
      if (stats[c.status] !== undefined) stats[c.status]++;
    });
    return stats;
  }, [selected]);

  const outlierInfo = useMemo(() => computeOutlierInfo(selected), [selected]);
  const marketDirection = useMemo(() => computeMarketDirection(selected, marketOverride, outlierInfo), [selected, marketOverride, outlierInfo]);
  const upgradeAdjustment = useMemo(() => computeUpgradeAdjustment(upgrades), [upgrades]);
  const analysis = useMemo(
    () => runAnalysis({ selected, subject, upgradeAdjustment, marketDirection, outlierInfo, comps }),
    [selected, subject, upgradeAdjustment, marketDirection, outlierInfo, comps]
  );

  const rentalAnalysis = useMemo(() => {
    // Use the recommended price when the sale analysis is complete; otherwise fall
    // back to a manual override or the current list price so rent vs. buy / yield
    // still works (e.g. a buyer-side rental check before a full sale CMA).
    const saleValue =
      analysis?.tiers?.[1]?.listPrice ??
      (subject.manualPriceOverride && parseFloat(subject.manualPriceOverride) > 0 ? parseFloat(subject.manualPriceOverride) : null) ??
      (subject.currentListPrice && parseFloat(subject.currentListPrice) > 0 ? parseFloat(subject.currentListPrice) : null);
    return computeRentalAnalysis({
      rentalComps,
      subjectSqft: subject.sqft,
      saleValue,
      monthlyCarry: analysis?.monthlyCarry ?? 0,
    });
  }, [rentalComps, subject.sqft, subject.manualPriceOverride, subject.currentListPrice, analysis]);

  const toggleComp = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleUpgrade = (id) => setUpgrades((prev) => ({ ...prev, [id]: { ...prev[id], checked: !prev[id]?.checked } }));
  const updateUpgradeValue = (id, value) => setUpgrades((prev) => ({ ...prev, [id]: { ...prev[id], customValue: value } }));
  const selectAll = () => setSelectedIds(new Set(filteredComps.map((c) => c.id)));
  const clearAll = () => setSelectedIds(new Set());
  const recommendedTier = analysis?.tiers[1];

  // Standalone-only toolbar: Save the CMA (no transaction needed) and turn it
  // into a real deal. Reused across the agent + seller headers below.
  const standaloneBar = standalone ? (
    <>
      <button className="btn btn-ghost" onClick={saveStandalone} disabled={saveState?.status === 'saving'}>
        {saveState?.status === 'saving' ? 'Saving…' : (standaloneCmaId ? '💾 Update CMA' : '💾 Save CMA')}
      </button>
      <button className="btn btn-primary" onClick={convertToTransaction} disabled={saveState?.status === 'saving'} title="Create a transaction pre-filled from this CMA">
        🏠 Create Transaction
      </button>
      {/* Show save/validation feedback right next to the buttons — it also renders
          lower down, but a user clicking Create Transaction at the top never saw
          a bottom-of-page message and thought the button did nothing. (tester: CMA) */}
      {saveState && saveState.status !== 'saving' && (
        <div style={{ flexBasis: '100%', marginTop: 6, fontSize: 13, fontWeight: 600,
          color: saveState.status === 'ok' ? '#1E8449' : '#B8232F' }}>
          {saveState.status === 'ok' ? '✓ ' : '⚠ '}{saveState.msg}
        </div>
      )}
    </>
  ) : null;

  // ===========================================================================
  // AGENT VIEW
  // ===========================================================================
  if (mode === 'agent') {
    return (
      <div className="cma-root" ref={printRef}>
        <header className="masthead no-print">
          <div className="container masthead-inner">
            <div>
              <div className="brand">{brokerageBrand} <span className="brand-mark">·</span> CMA Intelligence</div>
              <div className="brand-sub">Comparative Market Analysis · Pricing Discipline System</div>
            </div>
            <div className="header-actions">
              {analysis && (
                <div className="mode-toggle">
                  <button className={`mode-btn ${mode === 'agent' ? 'active' : ''}`} onClick={() => setMode('agent')}>Agent View</button>
                  <button className={`mode-btn ${mode === 'seller' ? 'active' : ''}`} onClick={() => setMode('seller')}>Seller Report</button>
                </div>
              )}
              {standaloneBar}
              {(comps.length > 0 || subject.address) && <button className="btn-danger" onClick={resetCMA}>+ New CMA</button>}
            </div>
          </div>
        </header>

        <div className="container">
          <MLSGuide />

          {/* Pre-import banner: show the property details already on file (from
              the seller intake) so the agent knows the Subject step is
              pre-filled before importing comps. Read-only summary. */}
          {comps.length === 0 && (() => {
            // Read from the SAVED transaction (not `subject`, which carries
            // editor defaults like garage=2 / move_in). Buyer deals have no
            // property specs, so this stays empty and the banner hides itself.
            const poolLabels = { private: 'Private pool', community: 'Community pool', none: 'No pool' };
            const chips = [];
            if (tx?.beds) chips.push(`${tx.beds} bed`);
            if (tx?.baths) chips.push(`${tx.baths} bath`);
            if (tx?.sqft) chips.push(`${Number(tx.sqft).toLocaleString()} sqft`);
            if (tx?.lotAcres) chips.push(`${tx.lotAcres} ac lot`);
            if (tx?.yearBuilt) chips.push(`Built ${tx.yearBuilt}`);
            if (tx?.garageSpaces && String(tx.garageSpaces) !== '0') chips.push(`${tx.garageSpaces}-car garage`);
            if (tx?.poolType && tx.poolType !== 'none') chips.push(poolLabels[tx.poolType] || tx.poolType);
            if (tx?.hasWaterView) chips.push('Water view');
            if (tx?.hasGolfView) chips.push('Golf view');
            if (tx?.propertyCondition) chips.push(tx.propertyCondition);
            const picked = (tx?.intakeDetails && tx.intakeDetails.upgrades) || {};
            const upLabels = UPGRADE_LIBRARY.filter((u) => picked[u.id]).map((u) => u.name);
            if (!chips.length && !upLabels.length) return null;
            const chipStyle = { fontSize: 12, background: 'white', border: '1px solid var(--rule)', borderRadius: 12, padding: '3px 10px' };
            return (
              <section className="section no-print">
                <div style={{ background: '#f0f9f4', border: '1px solid var(--green)', borderRadius: 2, padding: '16px 20px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: 'var(--green)' }}>✓ Property details already on file (from intake)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {chips.map((c, i) => <span key={i} style={chipStyle}>{c}</span>)}
                  </div>
                  {upLabels.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Upgrades:</span>
                      {upLabels.map((u, i) => <span key={i} style={chipStyle}>{u}</span>)}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>These auto-fill the Subject step automatically once you import comps — edit anything there.</div>
                </div>
              </section>
            );
          })()}

          <section className="section no-print">
            <div className="section-num">01 · DATA</div>
            <h2 className="section-title">Import MLS comp data</h2>
            <p className="section-sub">
              A <strong>comp</strong> is a comparable, recently-sold home near your property. In your MLS, search nearby
              sold (plus active/pending) listings, <strong>export the results as a CSV file</strong>, and drop it below.
              New to this? Open <strong>📋 MLS Search Setup</strong> above for the exact search settings and the columns to include.
            </p>
            {comps.length === 0 ? (
              <div
                className={`upload-zone ${dragging ? 'drag' : ''}`}
                onClick={() => fileInputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div className="primary">Drop your MLS CSV export here</div>
                <div className="secondary">or click to choose the .csv file from your computer</div>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => handleFile(e.target.files[0])} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'white', border: '1px solid var(--rule)', borderRadius: 2 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{filename}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{comps.length} comps loaded</div>
                </div>
                <button className="btn-mini" onClick={() => { setComps([]); setSelectedIds(new Set()); setFilename(''); }}>Replace file</button>
              </div>
            )}
          </section>

          {comps.length > 0 && (
            <section className="section no-print">
              <div className="section-num">02 · SUBJECT</div>
              <h2 className="section-title">Subject property details</h2>
              <p className="section-sub">Square footage is required. Every other field improves the accuracy of the price.</p>

              <div className="form-card">
                <div className="form-card-title">Property basics</div>
                <div className="form-grid">
                  <div className="field"><label className="field-label">Address</label><input type="text" placeholder="13346 Alderley Dr" value={subject.address} onChange={(e) => setSubject({ ...subject, address: e.target.value })} /></div>
                  <div className="field"><label className="field-label">Heated Sqft <span className="opt">required</span></label><input type="number" placeholder="3170" value={subject.sqft} onChange={(e) => setSubject({ ...subject, sqft: e.target.value })} /></div>
                  <div className="field"><label className="field-label">Beds</label><input type="number" placeholder="4" value={subject.beds} onChange={(e) => setSubject({ ...subject, beds: e.target.value })} /></div>
                  <div className="field"><label className="field-label">Year Built</label><input type="number" placeholder="2019" value={subject.yearBuilt} onChange={(e) => setSubject({ ...subject, yearBuilt: e.target.value })} /></div>
                  <div className="field"><label className="field-label">Lot Size (acres)</label><input type="number" step="0.01" placeholder="0.20" value={subject.lotSize} onChange={(e) => setSubject({ ...subject, lotSize: e.target.value })} /></div>
                </div>
              </div>

              <div className="form-card" style={{ borderLeft: '4px solid var(--accent)' }}>
                <div className="form-card-title">⭐ Condition & lot — based on Liz's in-person walkthrough</div>
                <div className="form-card-sub">These are the most important inputs for an accurate price. The comp data cannot tell us about condition or lot quality — Liz's judgment from the listing appointment does. Be honest. A home rated higher than reality will sit on the market.</div>
                <div className="form-grid">
                  <div className="field">
                    <label className="field-label">Condition Tier</label>
                    <select value={subject.conditionTier} onChange={(e) => setSubject({ ...subject, conditionTier: e.target.value })}>
                      <option value="premium">Premium / Recently Renovated (+7%)</option>
                      <option value="move_in">Move-In Ready (baseline)</option>
                      <option value="original_maintained">Original but Maintained (−4%)</option>
                      <option value="needs_work">Original + Needs Work (−10%)</option>
                      <option value="major_updates">Major Updates Needed (−17%)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Lot Quality</label>
                    <select value={subject.lotQuality} onChange={(e) => setSubject({ ...subject, lotQuality: e.target.value })}>
                      <option value="premium">Premium Lot (+5%)</option>
                      <option value="above_avg">Above-Average Lot (+2%)</option>
                      <option value="standard">Standard Lot (baseline)</option>
                      <option value="below_avg">Below-Average Lot (−3%)</option>
                      <option value="problem">Problem Lot (−7%)</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--accent)' }}>Tip:</strong> If you have photos of the kitchen, baths, flooring, and living spaces, upload them to a chat with Claude and ask "What condition tier?" for a second opinion before selecting.
                </div>
              </div>

              <div className="form-card">
                <div className="form-card-title">Features that affect price</div>
                <div className="form-card-sub">These all get factored into the recommended price using comp data where possible, Florida rules of thumb where not.</div>
                <div className="form-grid">
                  <div className="field">
                    <label className="field-label">Pool</label>
                    <select value={subject.poolType} onChange={(e) => setSubject({ ...subject, poolType: e.target.value })}>
                      <option value="private">Private pool (best)</option>
                      <option value="community">Community pool only</option>
                      <option value="none">No pool at all</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Stories</label>
                    <select value={subject.stories} onChange={(e) => setSubject({ ...subject, stories: e.target.value })}>
                      <option value="1">1 Story</option>
                      <option value="2">2 Story</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Garage Spaces</label>
                    <select value={subject.garageSpaces} onChange={(e) => setSubject({ ...subject, garageSpaces: e.target.value })}>
                      <option value="1">1-car</option>
                      <option value="2">2-car</option>
                      <option value="3">3-car</option>
                      <option value="4">4-car</option>
                    </select>
                  </div>
                  <div className="checkbox-field"><input type="checkbox" id="cma-wv" checked={subject.hasWaterView} onChange={(e) => setSubject({ ...subject, hasWaterView: e.target.checked })} /><label htmlFor="cma-wv">Water view (pond/lake)</label></div>
                  <div className="checkbox-field"><input type="checkbox" id="cma-gv" checked={subject.hasGolfView} onChange={(e) => setSubject({ ...subject, hasGolfView: e.target.checked })} /><label htmlFor="cma-gv">Golf course view</label></div>
                </div>
              </div>

              <div className="form-card">
                <div className="form-card-title">Is this home currently listed?</div>
                <div className="form-card-sub">If yes, the home's actual market behavior matters more than any computed price. The tool will use this to recommend the right reduction strategy when the listing has stalled.</div>
                <div className="checkbox-field" style={{ marginBottom: subject.isCurrentlyListed ? 18 : 0 }}>
                  <input type="checkbox" id="cma-listed" checked={subject.isCurrentlyListed} onChange={(e) => setSubject({ ...subject, isCurrentlyListed: e.target.checked })} />
                  <label htmlFor="cma-listed">Yes, this home is currently on the market</label>
                </div>
                {subject.isCurrentlyListed && (
                  <>
                    <div className="form-grid">
                      <div className="field"><label className="field-label">Current List Price ($)</label><input type="number" placeholder="614999" value={subject.currentListPrice} onChange={(e) => setSubject({ ...subject, currentListPrice: e.target.value })} /></div>
                      <div className="field"><label className="field-label">Days on Market</label><input type="number" placeholder="56" value={subject.currentDOM} onChange={(e) => setSubject({ ...subject, currentDOM: e.target.value })} /></div>
                      <div className="field"><label className="field-label">Total $ Reduced So Far</label><input type="number" placeholder="44000" value={subject.priceReductions} onChange={(e) => setSubject({ ...subject, priceReductions: e.target.value })} /></div>
                      <div className="field">
                        <label className="field-label">Showing Activity</label>
                        <select value={subject.showingActivity} onChange={(e) => setSubject({ ...subject, showingActivity: e.target.value })}>
                          <option value="high">High (5+/week)</option>
                          <option value="moderate">Moderate (2-4/week)</option>
                          <option value="low">Low (1/week or less)</option>
                          <option value="none">None / very rare</option>
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label">Offers Received</label>
                        <select value={subject.offersReceived} onChange={(e) => setSubject({ ...subject, offersReceived: e.target.value })}>
                          <option value="none">None</option>
                          <option value="lowball">Lowball offers only</option>
                          <option value="reasonable">Reasonable but rejected</option>
                          <option value="multiple">Multiple offers</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--accent)' }}>Total $ Reduced:</strong> Enter the dollar amount the listing has been cut since the original list price. For example, if it was listed at $659,000 and is now $614,999, enter <strong>44000</strong>. This tells the tool how aggressively the market has already rejected this home — homes with significant prior reductions need bigger further cuts to find a buyer.
                    </div>
                  </>
                )}
              </div>

              <div className="form-card" style={{ borderLeft: '4px solid var(--gold)' }}>
                <div className="form-card-title">⚖ Manual price override <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 13 }}>· optional</span></div>
                <div className="form-card-sub">If your judgment about this specific home tells you a different number than the tool calculated, enter your price here and it replaces the recommended tier. The tool does not always have enough information to be right — Liz's experience does. Use this freely.</div>
                <div className="form-grid">
                  <div className="field"><label className="field-label">Your List Price ($)</label><input type="number" placeholder="599000" value={subject.manualPriceOverride} onChange={(e) => setSubject({ ...subject, manualPriceOverride: e.target.value })} /></div>
                  <div className="field" style={{ gridColumn: 'span 2' }}><label className="field-label">Why this number? <span className="opt">optional note</span></label><input type="text" placeholder="e.g., Condition tier was understated, or pond view is uniquely valuable in this pocket" value={subject.manualPriceNote} onChange={(e) => setSubject({ ...subject, manualPriceNote: e.target.value })} /></div>
                </div>
              </div>

              <div className="form-card">
                <div className="form-card-title">Carrying cost <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 13 }}>· optional</span></div>
                <div className="form-card-sub">Powers the Cost of Waiting calculation. Get HOA from listing, property tax from county appraiser site, insurance from HOI dec page, mortgage P&I from seller's statement.</div>
                <div className="form-grid">
                  <div className="field"><label className="field-label">Monthly HOA ($)</label><input type="number" placeholder="205" value={subject.monthlyHOA} onChange={(e) => setSubject({ ...subject, monthlyHOA: e.target.value })} /></div>
                  <div className="field"><label className="field-label">Annual Property Tax ($)</label><input type="number" placeholder="12000" value={subject.propertyTaxAnnual} onChange={(e) => setSubject({ ...subject, propertyTaxAnnual: e.target.value })} /></div>
                  <div className="field"><label className="field-label">Annual Insurance ($)</label><input type="number" placeholder="3500" value={subject.insuranceAnnual} onChange={(e) => setSubject({ ...subject, insuranceAnnual: e.target.value })} /></div>
                  <div className="field"><label className="field-label">Mortgage P&I ($/mo)</label><input type="number" placeholder="6500" value={subject.estMortgagePayment} onChange={(e) => setSubject({ ...subject, estMortgagePayment: e.target.value })} /></div>
                </div>
              </div>
            </section>
          )}

          {comps.length > 0 && (
            <section className="section">
              <div className="section-num">03 · COMPS</div>
              <h2 className="section-title">Comparable properties</h2>
              <p className="section-sub no-print">Tap rows to select. Outliers (price-per-sqft &gt;2.5× normal deviation from median) are flagged in red and automatically excluded from tier calculations even if you select them.</p>

              {!subject.sqft && (
                <div className="data-info"><strong>Enter the subject's Heated Sqft in section 02 above</strong> to run the pricing analysis. You can select comps now — the verdict and pricing tiers appear once sqft is set.</div>
              )}

              {selected.length > 0 && (
                <>
                  <div className="health-grid">
                    <div className="health-stat sold"><div className="health-stat-val">{healthStats.SLD}</div><div className="health-stat-label">Sold</div></div>
                    <div className="health-stat pnd"><div className="health-stat-val">{healthStats.PND}</div><div className="health-stat-label">Pending</div></div>
                    <div className="health-stat act"><div className="health-stat-val">{healthStats.ACT}</div><div className="health-stat-label">Active</div></div>
                    <div className="health-stat exp"><div className="health-stat-val">{healthStats.EXP}</div><div className="health-stat-label">Expired</div></div>
                  </div>

                  {outlierInfo.details.length > 0 && (
                    <div className="data-warning">
                      <strong>⚠ {outlierInfo.details.length} outlier comp(s) detected and auto-excluded from calculations:</strong>
                      <ul style={{ marginTop: 8, marginLeft: 18 }}>
                        {outlierInfo.details.map((o) => (
                          <li key={o.id}>{o.address} at ${o.psf.toFixed(0)}/sqft ({o.devPct > 0 ? '+' : ''}{o.devPct.toFixed(0)}% from median). Likely not comparable — consider unchecking.</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {healthStats.SLD === 0 && <div className="data-warning"><strong>No Sold comps selected.</strong> Pricing without closed sales is risky.</div>}
                  {healthStats.SLD > 0 && healthStats.SLD < 3 && <div className="data-info"><strong>Only {healthStats.SLD} Sold comp(s).</strong> Add more for a stronger analysis.</div>}
                  {healthStats.SLD >= 3 && <div className="data-good"><strong>{healthStats.SLD} Sold comps.</strong> Solid foundation. {healthStats.EXP > 0 && `${healthStats.EXP} expired listing(s) provide useful ceiling data.`}</div>}
                </>
              )}

              <div className="comp-table-wrap">
                <div className="comp-controls no-print">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <div className={`filter-chip ${statusFilter.SLD ? 'active' : ''}`} onClick={() => setStatusFilter({ ...statusFilter, SLD: !statusFilter.SLD })}>Sold</div>
                    <div className={`filter-chip ${statusFilter.PND ? 'active' : ''}`} onClick={() => setStatusFilter({ ...statusFilter, PND: !statusFilter.PND })}>Pending</div>
                    <div className={`filter-chip ${statusFilter.ACT ? 'active' : ''}`} onClick={() => setStatusFilter({ ...statusFilter, ACT: !statusFilter.ACT })}>Active</div>
                    <div className={`filter-chip ${statusFilter.EXP ? 'active' : ''}`} onClick={() => setStatusFilter({ ...statusFilter, EXP: !statusFilter.EXP })}>Expired</div>
                    <div style={{ width: 1, background: 'var(--rule)', margin: '0 4px' }}></div>
                    <div className={`filter-chip ${filters.similarSize ? 'active' : ''}`} onClick={() => setFilters({ ...filters, similarSize: !filters.similarSize })}>Similar Size ±20%</div>
                    <div style={{ width: 1, background: 'var(--rule)', margin: '0 4px' }}></div>
                    <div className={`filter-chip ${filters.timeWindow === '6' ? 'active' : ''}`} onClick={() => setFilters({ ...filters, timeWindow: '6' })}>6 mo</div>
                    <div className={`filter-chip ${filters.timeWindow === '9' ? 'active' : ''}`} onClick={() => setFilters({ ...filters, timeWindow: '9' })}>9 mo</div>
                    <div className={`filter-chip ${filters.timeWindow === '12' ? 'active' : ''}`} onClick={() => setFilters({ ...filters, timeWindow: '12' })}>12 mo</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="comp-count"><strong>{selectedIds.size}</strong> selected · {filteredComps.length} shown · {comps.length} total</span>
                    <button className="btn-mini" onClick={selectAll}>Select all visible</button>
                    <button className="btn-mini" onClick={clearAll}>Clear</button>
                  </div>
                </div>
                <div className="comp-table-scroll">
                  <table className="comp-table">
                    <thead><tr><th></th><th>Status</th><th>Address</th><th>SqFt</th><th>Yr</th><th>Pool</th><th>Sty</th><th>Gar</th><th>Price</th><th>$/sf</th><th>SP/LP</th><th>DOM</th><th>Closed</th></tr></thead>
                    <tbody>
                      {filteredComps.length === 0 ? (
                        <tr><td colSpan="13" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No comps match filters.</td></tr>
                      ) : (
                        filteredComps.map((c) => {
                          const isOutlier = selectedIds.has(c.id) && outlierInfo.outlierIds.has(c.id);
                          return (
                            <tr key={c.id} className={`${selectedIds.has(c.id) ? 'selected' : ''} ${isOutlier ? 'outlier' : ''}`} onClick={() => toggleComp(c.id)}>
                              <td><input type="checkbox" checked={selectedIds.has(c.id)} readOnly /></td>
                              <td><span className={`status-pill status-${c.status.toLowerCase()}`}>{c.status}</span></td>
                              <td className="addr-cell">{c.address}{isOutlier && <span className="outlier-flag">OUTLIER</span>}</td>
                              <td className="price-cell" style={{ color: 'var(--accent)' }}>{c.sqft ? c.sqft.toLocaleString() : '—'}</td>
                              <td>{c.yearBuilt || '—'}</td>
                              <td style={{ fontSize: 11 }}>{c.poolType === 'private' ? 'Private' : c.poolType === 'community' ? 'Comm' : '—'}</td>
                              <td>{c.stories || '—'}</td>
                              <td>{c.garageSpaces || '—'}</td>
                              <td className="price-cell">{fmtMoney(c.currentPrice)}</td>
                              <td className="price-cell">{c.effectivePsf ? '$' + c.effectivePsf.toFixed(0) : '—'}</td>
                              <td className="price-cell">{c.spLpRatio ? (c.spLpRatio * 100).toFixed(1) + '%' : '—'}</td>
                              <td>{c.adom || c.cdom || '—'}</td>
                              <td style={{ fontSize: 12 }}>{c.closeDate}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {comps.length > 0 && subject.sqft && (
            <section className={`section ${rentalAnalysis ? '' : 'no-print'}`}>
              <div className="section-num">RENTAL <span style={{ color: 'var(--muted)' }}>· optional</span></div>
              <h2 className="section-title">Rent vs. sell</h2>
              <p className="section-sub">
                Upload a SEPARATE MLS export of recently <strong>leased</strong> comps (same area/size, status Leased/Rented). The tool estimates the monthly rent for this home and compares renting to selling — useful when a seller is weighing holding the property, or when advising a buyer on rent vs. buy. This is independent of the sale analysis above.
              </p>
              {rentalComps.length === 0 ? (
                <div className="upload-zone" onClick={() => rentalInputRef.current.click()}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  <div className="primary">Drop leased-comps CSV here</div>
                  <div className="secondary">or click to browse — MLS export of recently rented homes</div>
                  <input ref={rentalInputRef} type="file" accept=".csv" onChange={(e) => handleRentalFile(e.target.files[0])} />
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 18px', background: 'white', border: '1px solid var(--rule)', borderRadius: 2, marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{rentalFilename}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{rentalComps.length} leased comps loaded{rentalAnalysis ? ` · ${rentalAnalysis.count} used` : ''}</div>
                    </div>
                    <button className="btn-mini" onClick={() => { setRentalComps([]); setRentalFilename(''); }}>Replace file</button>
                  </div>
                  {!rentalAnalysis ? (
                    <div className="data-info"><strong>Need 2+ leased comps with rent and sqft</strong> to estimate. Check the CSV has a rent (Lease Price / Current Price) and a sqft (Heated Area / Living Area) column.</div>
                  ) : (
                    <div className="carry-wrap">
                      <div className="carry-grid">
                        <div><div className="carry-stat-label">Est. Monthly Rent</div><div className="carry-stat-val">{fmtMoney(rentalAnalysis.estMonthlyRent)}</div></div>
                        <div><div className="carry-stat-label">Annual Rent</div><div className="carry-stat-val">{fmtMoney(rentalAnalysis.annualRent)}</div></div>
                        <div><div className="carry-stat-label">Gross Yield</div><div className="carry-stat-val">{rentalAnalysis.grossYield != null ? fmtPct(rentalAnalysis.grossYield) : '—'}</div></div>
                        <div><div className="carry-stat-label">Rent Multiple (GRM)</div><div className="carry-stat-val">{rentalAnalysis.grm != null ? rentalAnalysis.grm.toFixed(1) : '—'}</div></div>
                      </div>
                      <div className="carry-narrative">
                        Based on <strong>${rentalAnalysis.medianRentPsf.toFixed(2)}/sqft/mo</strong> median rent across {rentalAnalysis.count} leased comps, this home would rent for about <strong>{fmtMoney(rentalAnalysis.estMonthlyRent)}/mo</strong>.{' '}
                        {rentalAnalysis.grossYield != null && rentalAnalysis.saleValue != null && <>That's a <strong>{fmtPct(rentalAnalysis.grossYield)}</strong> gross yield on a {fmtMoney(rentalAnalysis.saleValue)} sale price. </>}
                        {rentalAnalysis.onePercentRuleMet != null && <>The 1% rule is <strong>{rentalAnalysis.onePercentRuleMet ? 'met' : 'not met'}</strong>. </>}
                        {rentalAnalysis.rentVsOwn && (
                          rentalAnalysis.rentVsOwn.diff >= 0
                            ? <>Estimated rent <strong>covers</strong> the {fmtMoney(rentalAnalysis.rentVsOwn.monthlyCarry)}/mo carrying cost with <strong>{fmtMoney(rentalAnalysis.rentVsOwn.diff)}/mo</strong> to spare — holding and renting is cash-flow positive.</>
                            : <>Estimated rent is <strong>{fmtMoney(Math.abs(rentalAnalysis.rentVsOwn.diff))}/mo short</strong> of the {fmtMoney(rentalAnalysis.rentVsOwn.monthlyCarry)}/mo carrying cost — holding and renting is cash-flow negative.</>
                        )}
                        {rentalAnalysis.saleValue == null && <span style={{ color: 'var(--muted)' }}> Enter a list price or finish the sale analysis to see yield, GRM, and the 1% rule.</span>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {comps.length > 0 && subject.sqft && selectedIds.size >= 2 && (
            <section className="section no-print">
              <div className="section-num">04 · UPGRADES</div>
              <h2 className="section-title">Property upgrades</h2>
              <p className="section-sub">Florida-tuned recovery rates. Override any cost if known.</p>
              <div className="upgrade-grid">
                {UPGRADE_LIBRARY.map((u) => {
                  const data = upgrades[u.id] || {};
                  return (
                    <div key={u.id} className={`upgrade-row ${data.checked ? 'active' : ''}`} onClick={() => toggleUpgrade(u.id)}>
                      <input type="checkbox" checked={!!data.checked} readOnly />
                      <div className="upgrade-info">
                        <div className="upgrade-name">{u.name}</div>
                        <div className="upgrade-meta">
                          Default cost: ${u.costFL.toLocaleString()} · Recovery: {(u.recovery * 100).toFixed(0)}%
                          {data.checked && <span style={{ marginLeft: 8 }}>· Override: <input type="number" placeholder={u.costFL} value={data.customValue || ''} onChange={(e) => updateUpgradeValue(u.id, e.target.value)} style={{ width: 80, padding: '2px 4px', fontSize: 11, border: '1px solid var(--rule)', borderRadius: 2 }} onClick={(e) => e.stopPropagation()} /></span>}
                        </div>
                      </div>
                      {data.checked && <div className="upgrade-value">+{fmtMoney((data.customValue ? parseFloat(data.customValue) : u.costFL) * u.recovery)}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {analysis && (
            <>
              <section className="section">
                <div className="section-num">05 · MARKET DIRECTION</div>
                <h2 className="section-title">Where is the market headed?</h2>
                <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: 2, padding: 28, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, marginBottom: 20 }}>
                    <div style={{ flex: '1 1 280px' }}>
                      <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Detected Direction</div>
                      <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", fontSize: 36, fontWeight: 600, marginBottom: 6, color: analysis.marketDirection.annualPct > 0.02 ? 'var(--green)' : analysis.marketDirection.annualPct < -0.02 ? 'var(--red)' : 'var(--ink)' }}>
                        {analysis.marketDirection.label}
                      </div>
                      <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", fontSize: 14, color: 'var(--accent)', marginBottom: 10 }}>
                        {analysis.marketDirection.annualPct >= 0 ? '+' : ''}{(analysis.marketDirection.annualPct * 100).toFixed(1)}% annualized
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{analysis.marketDirection.desc}</div>
                    </div>
                    <div className="no-print" style={{ flex: '1 1 280px' }}>
                      <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Manual Override</div>
                      <select value={marketOverride} onChange={(e) => setMarketOverride(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid var(--rule)', borderRadius: 2, background: 'var(--paper-deep)' }}>
                        <option value="auto">Auto-detect (recommended)</option>
                        <option value="rising">Rising (+8%)</option>
                        <option value="flat">Flat</option>
                        <option value="softening_mild">Softening (-4%)</option>
                        <option value="softening_strong">Falling (-10%)</option>
                      </select>
                    </div>
                  </div>
                </div>
                {analysis.marketDirection.dated && analysis.marketDirection.dated.length >= 4 && (
                  <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: 2, padding: 24 }}>
                    <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>$/sqft trend · {analysis.marketDirection.dataPoints} sold comps</div>
                    <TrendChart points={analysis.marketDirection.dated} />
                  </div>
                )}
              </section>

              <section className="section">
                <div className="section-num">06 · INVENTORY</div>
                <h2 className="section-title">Market context</h2>
                <div className="inv-card">
                  <div className="inv-grid">
                    <div><div className="inv-stat-label">Months Supply</div><div className="inv-stat-val">{analysis.monthsSupply.toFixed(1)}</div></div>
                    <div><div className="inv-stat-label">Active Listings</div><div className="inv-stat-val">{comps.filter((c) => c.status === 'ACT').length}</div></div>
                    <div><div className="inv-stat-label">Sold (12 mo)</div><div className="inv-stat-val">{comps.filter((c) => c.status === 'SLD').length}</div></div>
                    <div><div className="inv-stat-label">Market Type</div><div className="inv-stat-val" style={{ color: analysis.invVerdict.color, fontSize: 18 }}>{analysis.invVerdict.label}</div></div>
                  </div>
                  <div className="inv-verdict"><strong>{analysis.invVerdict.label}.</strong> {analysis.invVerdict.desc}</div>
                </div>
              </section>

              <section className="section">
                <div className="section-num">07 · ADJUSTMENTS</div>
                <h2 className="section-title">How we got to the price</h2>
                <p className="section-sub">Full transparency on every adjustment. Use this when sellers ask "why is your number that?"</p>
                <div className="adj-card">
                  <div className="adj-title">Pricing build-up</div>
                  <div className="adj-row base">
                    <div className="adj-label">Base value <span className="source">${analysis.medianPsf.toFixed(0)}/sqft × {parseFloat(subject.sqft).toLocaleString()} sqft</span></div>
                    <div className="adj-value">{fmtMoney(analysis.baseValue)}</div>
                  </div>
                  {analysis.adjustments.map((a, i) => (
                    <div key={i} className="adj-row">
                      <div className="adj-label">{a.name} <span className="source">{a.source}</span></div>
                      <div className={`adj-value ${a.value >= 0 ? 'pos' : 'neg'}`}>{fmtMoneySigned(a.value)}</div>
                    </div>
                  ))}
                  {analysis.upgradeBoost > 0 && (
                    <div className="adj-row">
                      <div className="adj-label">Upgrades <span className="source">Florida recovery rates</span></div>
                      <div className="adj-value pos">{fmtMoneySigned(analysis.upgradeBoost)}</div>
                    </div>
                  )}
                  {Math.abs(analysis.marketAdjPct) > 0.005 && (
                    <div className="adj-row">
                      <div className="adj-label">Market direction <span className="source">{(analysis.marketAdjPct * 100).toFixed(2)}% forward adjustment</span></div>
                      <div className={`adj-value ${analysis.marketAdjPct >= 0 ? 'pos' : 'neg'}`}>{fmtMoneySigned((analysis.baseValue + analysis.totalAdjustments + analysis.upgradeBoost) * analysis.marketAdjPct)}</div>
                    </div>
                  )}
                  <div className="adj-row total">
                    <div className="adj-label">Comp-supported sale price <span className="source">based on adjustments above</span></div>
                    <div className="adj-value">{fmtMoney(analysis.baseValue + analysis.totalAdjustments + analysis.upgradeBoost + (analysis.baseValue + analysis.totalAdjustments + analysis.upgradeBoost) * analysis.marketAdjPct)}</div>
                  </div>
                </div>
              </section>

              <section className="section">
                <div className="section-num">08 · VERDICT</div>
                <h2 className="section-title">The recommended list price</h2>

                {analysis.manualOverrideApplied && (
                  <div className="insight good" style={{ marginBottom: 18 }}>
                    <strong>⚖ Manual price override active.</strong> Recommended price is set by Liz's judgment at <strong>{fmtMoney(parseFloat(subject.manualPriceOverride))}</strong>, not from the comp math.
                    {subject.manualPriceNote && <><br /><br /><em>Reason: {subject.manualPriceNote}</em></>}
                    <br /><br />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>To return to comp-based pricing, clear the "Your List Price" field above.</span>
                  </div>
                )}
                {analysis.currentListingOverride?.wasOverridden && !analysis.manualOverrideApplied && (
                  <div className="insight warn" style={{ marginBottom: 18 }}>
                    <strong>⚠ Current listing override active.</strong> This home has been listed at {fmtMoney(analysis.currentListingOverride.currentPrice)} for {analysis.currentListingOverride.dom} days. {analysis.currentListingOverride.failureReason}.
                    {analysis.currentListingOverride.reductionAmount > 0 && (
                      <> Already cut <strong>{fmtMoney(analysis.currentListingOverride.reductionAmount)}</strong> from original list price of <strong>{fmtMoney(analysis.currentListingOverride.originalListPrice)}</strong> — that's a <strong>{(analysis.currentListingOverride.reductionPctSoFar * 100).toFixed(1)}% reduction</strong> already absorbed by the market with no offers.</>
                    )}
                    <br /><br />
                    <strong>Staleness depth: {analysis.currentListingOverride.stalenessDepth.toUpperCase()} stale.</strong>{' '}
                    {analysis.currentListingOverride.stalenessDepth === 'deeply' && 'The home has been deeply rejected by the market — gentle reductions have already been tried and failed. The next cut needs to be aggressive (5%+) to find a new buyer pool.'}
                    {analysis.currentListingOverride.stalenessDepth === 'moderate' && 'The home has been moderately rejected — gentle 1-2% cuts will likely fail. Meaningful reductions (3-7%) are needed to reactivate buyer interest.'}
                    {analysis.currentListingOverride.stalenessDepth === 'barely' && 'The home is just starting to stall. A modest reduction (2-3%) plus fresh marketing can still generate renewed activity.'}
                    <br /><br />
                    {analysis.currentListingOverride.currentIsBelowComps ? (
                      <>The comp math says this home should sell around <strong>{fmtMoney(analysis.currentListingOverride.compSupportedSale)}</strong>, but the home has been listed <em>below</em> that and still hasn't sold. That's a strong signal the comp math is overestimating — there are factors the data can't capture (condition, lot, marketing, layout) that buyers can see in person.</>
                    ) : (
                      <>The comp math would have recommended <strong>{fmtMoney(analysis.currentListingOverride.compRecommended)}</strong>, but that's <em>above</em> the price the market has already refused. The tool is recommending reductions based on real market behavior, not just computed comp medians.</>
                    )}
                    <br /><br />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>The "Expected DOM" below refers to days AFTER the reduction takes effect, not total days since the original listing.</span>
                  </div>
                )}
                {analysis.currentListingOverride && !analysis.currentListingOverride.wasOverridden && !analysis.manualOverrideApplied && (
                  <div className="insight" style={{ marginBottom: 18 }}>
                    <strong>Currently listed at {fmtMoney(analysis.currentListingOverride.currentPrice)} for {analysis.currentListingOverride.dom} days.</strong> {analysis.currentListingOverride.staleness < 1.2 ? 'Still within normal market window — proceed with comp-based pricing.' : 'Approaching elevated DOM — watch for stalling signs over the next 2-3 weeks.'}
                  </div>
                )}

                <div className="verdict-card">
                  <div className="verdict-card-inner">
                    <div className="verdict-label">{analysis.manualOverrideApplied ? "Liz's recommended price" : analysis.currentListingOverride?.wasOverridden ? 'Recommended price reset' : 'Recommended list price'}</div>
                    <div className="verdict-price">{fmtMoney(recommendedTier.listPrice)}</div>
                    <div className="verdict-sub">
                      At {fmtPsf(recommendedTier.psf)}. Expected sale: <strong>{fmtMoney(recommendedTier.expectedSale)}</strong>. {recommendedTier.isPostReduction ? <>Expected to sell in <strong>~{recommendedTier.expectedDom} days after the reduction</strong>.</> : <>Expected DOM: <strong>~{recommendedTier.expectedDom} days</strong>.</>}
                    </div>
                    <div className="verdict-stats">
                      <div><div className="verdict-stat-label">Median $/sqft</div><div className="verdict-stat-value">${analysis.medianPsf.toFixed(0)}</div></div>
                      <div><div className="verdict-stat-label">Clean Comps</div><div className="verdict-stat-value">{analysis.cleanCompCount}</div></div>
                      <div><div className="verdict-stat-label">List-to-Sale</div><div className="verdict-stat-value">{fmtPct(analysis.medianRatio)}</div></div>
                      <div><div className="verdict-stat-label">Typical DOM</div><div className="verdict-stat-value">{analysis.medianAdom.toFixed(0)}d</div></div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="section">
                <div className="section-num">09 · STRATEGY</div>
                <h2 className="section-title">Three pricing options</h2>
                <div className="tier-grid">
                  {analysis.tiers.map((t, idx) => (
                    <div key={t.name} className={`tier-card ${idx === 1 ? 'market' : ''}`}>
                      <div className="tier-name">{t.name}</div>
                      <div className="tier-price">{fmtMoney(t.listPrice)}</div>
                      <div className="tier-psf">{fmtPsf(t.psf)}</div>
                      <div className="tier-meta">
                        <div className="tier-meta-row"><span className="label">Expected sale</span><span className="val">{fmtMoney(t.expectedSale)}</span></div>
                        <div className="tier-meta-row"><span className="label">{t.isPostReduction ? 'Sells in (after reduction)' : 'Expected DOM'}</span><span className="val">~{t.expectedDom} days</span></div>
                        <div className="tier-meta-row"><span className="label">Sells in 60 days</span><span className="val">{fmtPct(t.prob60, 0)}</span></div>
                        <div className="tier-meta-row"><span className="label">Reduction risk</span><span className="val" style={{ color: t.riskOfReduction > 0.5 ? 'var(--red)' : t.riskOfReduction > 0.2 ? 'var(--gold)' : 'var(--green)' }}>{fmtPct(t.riskOfReduction, 0)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
                {analysis.aggressiveWasCapped && (
                  <div className="insight warn"><strong>Note:</strong> Aggressive tier was capped at 25% above Market to prevent unrealistic pricing. The raw upper percentile of your comp set suggested a higher number, which is usually a sign of an outlier comp influencing the math.</div>
                )}
              </section>

              {analysis.monthlyCarry > 0 && (
                <section className="section">
                  <div className="section-num">10 · COST OF WAITING</div>
                  <h2 className="section-title">The price of overpricing</h2>
                  <div className="carry-wrap">
                    <div className="carry-grid">
                      <div><div className="carry-stat-label">Monthly</div><div className="carry-stat-val">{fmtMoney(analysis.monthlyCarry)}</div></div>
                      <div><div className="carry-stat-label">90 Days</div><div className="carry-stat-val danger">{fmtMoney(analysis.monthlyCarry * 3)}</div></div>
                      <div><div className="carry-stat-label">180 Days</div><div className="carry-stat-val danger">{fmtMoney(analysis.monthlyCarry * 6)}</div></div>
                      <div><div className="carry-stat-label">Aggressive Upside</div><div className="carry-stat-val">{fmtMoney(analysis.tiers[0].expectedSale - analysis.tiers[1].expectedSale)}</div></div>
                    </div>
                  </div>
                </section>
              )}

              {analysis.buyerAgents.length > 0 && (
                <section className="section">
                  <div className="section-num">11 · BUYER AGENT OUTREACH</div>
                  <h2 className="section-title">Agents to contact when listing goes live</h2>
                  <p className="section-sub">These selling agents have closed 2+ deals in this subdivision recently. They have active buyer pipelines for this market. Personal outreach beats MLS syndication every time at the luxury tier.</p>
                  <div className="agent-list">
                    {analysis.buyerAgents.map((a, i) => (
                      <div key={i} className="agent-row">
                        <div>
                          <div className="agent-name">{a.name}</div>
                          <div className="agent-meta">Most recent close: {a.latest}</div>
                        </div>
                        <div className="agent-count">{a.count} deals</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="section no-print" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={() => setMode('seller')}>View Seller Report →</button>
                <button className="btn btn-primary" onClick={printView}>Print / Save as PDF</button>
              </section>
            </>
          )}

          <footer className="footer">{branding.brokerage || brokerageBrand} · CMA Intelligence</footer>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // SELLER VIEW
  // ===========================================================================
  if (!analysis) {
    return (
      <div className="cma-root">
        <header className="masthead no-print">
          <div className="container masthead-inner">
            <div>
              <div className="brand">{brokerageBrand} <span className="brand-mark">·</span> CMA Intelligence</div>
              <div className="brand-sub">Seller Report</div>
            </div>
            <div className="header-actions">
              <div className="mode-toggle">
                <button className={`mode-btn ${mode === 'agent' ? 'active' : ''}`} onClick={() => setMode('agent')}>Agent View</button>
                <button className={`mode-btn ${mode === 'seller' ? 'active' : ''}`} onClick={() => setMode('seller')}>Seller Report</button>
              </div>
              {standaloneBar}
              {(comps.length > 0 || subject.address) && <button className="btn-danger" onClick={resetCMA}>+ New CMA</button>}
            </div>
          </div>
        </header>
        <div className="container">
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: 2, padding: 48, textAlign: 'center', marginTop: 40 }}>
            <h2 style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 16 }}>Seller Report Not Ready</h2>
            <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
              The seller report needs a complete analysis. Switch back to the Agent View to make sure you have a CSV loaded, the subject sqft filled in, and at least 2 comps selected. Your data is still safe — nothing has been lost.
            </p>
            <button className="btn btn-primary" onClick={() => setMode('agent')}>← Back to Agent View</button>
          </div>
        </div>
      </div>
    );
  }

  const md = analysis.marketDirection;
  const isFalling = md.annualPct < -0.02;
  const isRising = md.annualPct > 0.02;

  return (
    <div className="cma-root">
      <header className="masthead no-print">
        <div className="container masthead-inner">
          <div>
            <div className="brand">{brokerageBrand} <span className="brand-mark">·</span> CMA Intelligence</div>
            <div className="brand-sub">Seller Report</div>
          </div>
          <div className="header-actions">
            <div className="mode-toggle">
              <button className={`mode-btn ${mode === 'agent' ? 'active' : ''}`} onClick={() => setMode('agent')}>Agent View</button>
              <button className={`mode-btn ${mode === 'seller' ? 'active' : ''}`} onClick={() => setMode('seller')}>Seller Report</button>
            </div>
            {standaloneBar}
            {!standalone && (
              <button className="btn btn-ghost" onClick={saveToDocuments} disabled={saveState?.status === 'saving'}>
                {saveState?.status === 'saving' ? 'Saving…' : '⬇ Save to Documents'}
              </button>
            )}
            <button className="btn btn-primary" onClick={printView}>Print / Save PDF</button>
            <button className="btn-danger" onClick={resetCMA}>+ New CMA</button>
          </div>
        </div>
      </header>
      {saveState && saveState.status !== 'saving' && (
        <div className="container no-print" style={{ paddingTop: 12 }}>
          <div className={saveState.status === 'ok' ? 'data-good' : 'data-warning'} style={{ margin: 0 }}>
            <strong>{saveState.status === 'ok' ? '✓ ' : '⚠ '}</strong>{saveState.msg}
          </div>
        </div>
      )}

      <div className="container" style={{ paddingTop: 20 }} ref={printRef}>
        <div className="sr-page">
          <div className="sr-cover">
            <div className="sr-cover-inner">
              <div className="sr-brand">{brokerageBrand}</div>
              <div className="sr-tagline">Your Pricing Analysis</div>
              <h1 className="sr-cover-title">Pricing Your Home<br />To Actually Sell</h1>
              <div className="sr-cover-sub">An honest, data-driven look at what your home will sell for — based on real recent sales, not guesses or wishful thinking.</div>
              <div className="sr-cover-divider"></div>
            </div>
          </div>

          <div className="sr-property">
            <div className="sr-property-label">Prepared for the home at</div>
            <div className="sr-property-addr">{subject.address || 'Subject Property'}</div>
            <div className="sr-property-details">
              {subject.sqft && `${parseInt(subject.sqft).toLocaleString()} sqft`}
              {subject.beds && ` · ${subject.beds} bedrooms`}
              {subject.yearBuilt && ` · Built ${subject.yearBuilt}`}
              {subject.poolType === 'private' && ' · Private Pool'}
              {subject.stories === '2' && ' · 2 Story'}
              {subject.garageSpaces && ` · ${subject.garageSpaces}-car garage`}
            </div>
          </div>

          <div className="sr-section">
            <div className="sr-eyebrow">Our Recommendation</div>
            <h1 className="sr-h1">Here's what your home should list for.</h1>
            <div className="sr-hero-price">
              <div className="sr-hero-price-label">Recommended List Price</div>
              <div className="sr-hero-price-val">{fmtMoney(recommendedTier.listPrice)}</div>
              <div className="sr-hero-price-psf">{fmtPsf(recommendedTier.psf)}</div>
              <div className="sr-hero-price-stats">
                <div className="sr-hero-stat"><div className="sr-hero-stat-label">Expected Sale</div><div className="sr-hero-stat-val">{fmtMoney(recommendedTier.expectedSale)}</div></div>
                <div className="sr-hero-stat"><div className="sr-hero-stat-label">Expected Timeline</div><div className="sr-hero-stat-val">~{recommendedTier.expectedDom} days</div></div>
                <div className="sr-hero-stat"><div className="sr-hero-stat-label">Sells in 60 Days</div><div className="sr-hero-stat-val">{fmtPct(recommendedTier.prob60, 0)}</div></div>
              </div>
            </div>
            <div className="sr-body">
              <p>This price isn't a guess. It's built on <strong>{analysis.soldCount} recent sale{analysis.soldCount === 1 ? '' : 's'}</strong> of homes just like yours{analysis.expiredCount > 0 && `, plus ${analysis.expiredCount} listing${analysis.expiredCount === 1 ? '' : 's'} the market rejected at higher prices`}.</p>
              <p>The pages that follow show you the actual sales we used, where the market is headed, and your three pricing options.</p>
            </div>
          </div>

          <div className="sr-section">
            <div className="sr-eyebrow">The Evidence</div>
            <h2 className="sr-h2">What homes like yours actually sold for.</h2>
            <div className="sr-body"><p>These are the most relevant recent sales. Buyers and appraisers will look at these same homes when deciding what yours is worth.</p></div>
            <div className="sr-comp-list">
              {selected.filter((c) => (c.status === 'SLD' || c.status === 'PND') && !outlierInfo.outlierIds.has(c.id)).slice(0, 6).map((c) => (
                <div key={c.id} className="sr-comp-card">
                  <div>
                    <div className="sr-comp-addr">{c.address}</div>
                    <div className="sr-comp-meta">
                      {c.sqft?.toLocaleString()} sqft
                      {c.yearBuilt && ` · Built ${c.yearBuilt}`}
                      {c.poolType === 'private' && ' · Private Pool'}
                      {c.stories && ` · ${c.stories} story`}
                      {c.status === 'PND' && ' · Pending'}
                    </div>
                  </div>
                  <div className="sr-comp-price-col"><div className="sr-comp-price">{fmtMoney(c.currentPrice)}</div></div>
                  <div className="sr-comp-price-col"><div className="sr-comp-psf">${c.effectivePsf?.toFixed(0)}/sqft</div></div>
                </div>
              ))}
            </div>
            <div className="sr-key-insight">
              <div className="sr-key-insight-label">The Bottom Line</div>
              <div className="sr-key-insight-body">
                Across these sales, the typical price is <strong>${analysis.medianPsf.toFixed(0)} per square foot</strong>. For your {parseInt(subject.sqft).toLocaleString()} sqft home, that's the foundation of our recommendation — then we adjusted for your specific features (pool, story count, garage, view) and any upgrades you've made.
              </div>
            </div>
          </div>

          {md.confidence !== 'none' && (
            <div className="sr-section">
              <div className="sr-eyebrow">Market Trend</div>
              <h2 className="sr-h2">{isFalling ? 'The market is moving against us.' : isRising ? 'The market is working in our favor.' : 'The market is steady right now.'}</h2>
              <div className={`sr-market ${isFalling ? 'falling' : isRising ? 'rising' : 'flat'}`}>
                <div className="sr-market-label">Market Direction</div>
                <div className="sr-market-status">{md.label}{Math.abs(md.annualPct) > 0.01 && ` (${md.annualPct >= 0 ? '+' : ''}${(md.annualPct * 100).toFixed(1)}% per year)`}</div>
                <div className="sr-market-body">{md.desc}</div>
              </div>
              <div className="sr-body">
                {isFalling ? (
                  <p><strong>This matters more than most sellers realize.</strong> Even pricing "at market" today means selling for less by the time the home closes — because the market keeps moving while your home sits. We've already adjusted our recommended price to where the market will <em>be</em> when your home closes — not where it was when these comps sold.</p>
                ) : isRising ? (
                  <p>Recent sales show prices are appreciating. We've accounted for this in your recommended price — pricing slightly above the most recent closed sales because the market is moving with us.</p>
                ) : (
                  <p>A flat market gives us a clear read — your home is worth what comparable homes are selling for today, and that's not changing quickly.</p>
                )}
              </div>
            </div>
          )}

          <div className="sr-section">
            <div className="sr-eyebrow">Your Choice</div>
            <h2 className="sr-h2">You have three pricing options.</h2>
            <div className="sr-body"><p>Many sellers think pricing high is a "free test." The data tells a different story. Here's the honest breakdown:</p></div>
            <div className="sr-strategies">
              <div className="sr-strategy danger">
                <div className="sr-strategy-badge">RISKY</div>
                <div className="sr-strategy-label">Aggressive</div>
                <div className="sr-strategy-price">{fmtMoney(analysis.tiers[0].listPrice)}</div>
                <div className="sr-strategy-detail">
                  <div className="row"><span className="lbl">Likely sells in</span><span className="v">~{analysis.tiers[0].expectedDom} days</span></div>
                  <div className="row"><span className="lbl">60-day chance</span><span className="v">{fmtPct(analysis.tiers[0].prob60, 0)}</span></div>
                  <div className="row"><span className="lbl">Likely final sale</span><span className="v">{fmtMoney(analysis.tiers[0].expectedSale)}</span></div>
                </div>
              </div>
              <div className="sr-strategy rec">
                <div className="sr-strategy-badge">RECOMMENDED</div>
                <div className="sr-strategy-label">{analysis.tiers[1].name === 'Recommended' || analysis.tiers[1].override ? analysis.tiers[1].name : 'Market Price'}</div>
                <div className="sr-strategy-price">{fmtMoney(analysis.tiers[1].listPrice)}</div>
                <div className="sr-strategy-detail">
                  <div className="row"><span className="lbl">Likely sells in</span><span className="v">~{analysis.tiers[1].expectedDom} days</span></div>
                  <div className="row"><span className="lbl">60-day chance</span><span className="v">{fmtPct(analysis.tiers[1].prob60, 0)}</span></div>
                  <div className="row"><span className="lbl">Likely final sale</span><span className="v">{fmtMoney(analysis.tiers[1].expectedSale)}</span></div>
                </div>
              </div>
              <div className="sr-strategy fast">
                <div className="sr-strategy-badge">FASTEST</div>
                <div className="sr-strategy-label">Quick Sale</div>
                <div className="sr-strategy-price">{fmtMoney(analysis.tiers[2].listPrice)}</div>
                <div className="sr-strategy-detail">
                  <div className="row"><span className="lbl">Likely sells in</span><span className="v">~{analysis.tiers[2].expectedDom} days</span></div>
                  <div className="row"><span className="lbl">60-day chance</span><span className="v">{fmtPct(analysis.tiers[2].prob60, 0)}</span></div>
                  <div className="row"><span className="lbl">Likely final sale</span><span className="v">{fmtMoney(analysis.tiers[2].expectedSale)}</span></div>
                </div>
              </div>
            </div>
            <div className="sr-key-insight">
              <div className="sr-key-insight-label">The Aggressive Trap</div>
              <div className="sr-key-insight-body">
                Listing at <strong>{fmtMoney(analysis.tiers[0].listPrice)}</strong> sounds appealing, but only has a <strong>{fmtPct(analysis.tiers[0].prob60, 0)} chance</strong> of selling in 60 days. After likely price cuts, you'd probably net <strong>{fmtMoney(analysis.tiers[0].expectedSale)}</strong> — only <strong>{fmtMoney(analysis.tiers[0].expectedSale - analysis.tiers[1].expectedSale)} more</strong> than the recommended price, in exchange for months of carrying costs.
              </div>
            </div>
          </div>

          {analysis.monthlyCarry > 0 && (
            <div className="sr-section">
              <div className="sr-eyebrow">The Hidden Cost</div>
              <h2 className="sr-h2">Every month costs you real money.</h2>
              <div className="sr-body"><p>Most sellers don't calculate this. Here's what you pay every month just to hold the home:</p></div>
              <div className="sr-cost-section">
                <div className="sr-cost-eyebrow">Your Carrying Cost</div>
                <div className="sr-cost-title">What waiting actually costs you</div>
                <div className="sr-cost-grid">
                  <div className="sr-cost-cell"><div className="sr-cost-cell-label">Every Month</div><div className="sr-cost-cell-val">{fmtMoney(analysis.monthlyCarry)}</div></div>
                  <div className="sr-cost-cell bad"><div className="sr-cost-cell-label">90 Extra Days</div><div className="sr-cost-cell-val">{fmtMoney(analysis.monthlyCarry * 3)}</div></div>
                  <div className="sr-cost-cell bad"><div className="sr-cost-cell-label">180 Extra Days</div><div className="sr-cost-cell-val">{fmtMoney(analysis.monthlyCarry * 6)}</div></div>
                </div>
                <div className="sr-cost-body">If listing higher adds 90 days to your timeline, that costs <strong>{fmtMoney(analysis.monthlyCarry * 3)}</strong> — often more than any premium from the higher list price.</div>
              </div>
            </div>
          )}

          <div className="sr-section">
            <div className="sr-eyebrow">Our Honest Advice</div>
            <h2 className="sr-h2">List at {fmtMoney(recommendedTier.listPrice)}.</h2>
            <div className="sr-body">
              <p>This price respects what your home is genuinely worth, positions you to sell in a reasonable timeframe, and gives you the best chance of <strong>netting the most money</strong> after accounting for carrying costs and avoided price reductions.</p>
              <p>Homes priced right from day one sell faster, attract stronger offers, and net more money than homes that start high and chase the market down.</p>
              {isFalling && <p><strong>One more thing.</strong> The market is softening right now. Pricing correctly today is more important than ever — every month of delay costs you twice: in carrying costs, and in the market moving away from your price.</p>}
            </div>
          </div>

          <div className="sr-signature">
            <div className="sr-signature-text">We've put real care into this analysis. If you have questions about the comps, the math, or our marketing plan, we'd love to walk you through it in person.</div>
            <div className="sr-signature-name">{agentDisplayName}</div>
            <div className="sr-signature-title">{agentTitleLine}{branding.license ? ` · Lic. ${branding.license}` : ''}{branding.phone ? ` · ${branding.phone}` : ''}</div>
          </div>

          <div className="sr-footer">
            Prepared {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · Based on {analysis.soldCount} sold, {analysis.pendingCount} pending, {analysis.activeCount} active, and {analysis.expiredCount} expired comparable properties
          </div>
        </div>
      </div>
    </div>
  );
}

// Local crash guard — preserves the ErrorBoundary wrapper from the source tool
// so a render error in the CMA tab can't blank the whole transaction page.
class CmaErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('CMA Tool Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, maxWidth: 700, margin: '0 auto' }}>
          <div style={{ background: 'white', border: '2px solid #C0392B', padding: 28, borderRadius: 8 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#C0392B', marginBottom: 12 }}>The CMA tool hit an error</h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#222', marginBottom: 16 }}>
              Your data is still in memory. Switch tabs and back, or reload, to retry. If it keeps happening, send a screenshot of the detail below.
            </p>
            <div style={{ background: '#f7e6e1', padding: 12, borderRadius: 6, fontFamily: 'monospace', fontSize: 13, color: '#5a1f15', wordBreak: 'break-word' }}>
              {this.state.error?.message || String(this.state.error)}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CmaToolWrapped(props) {
  return (
    <CmaErrorBoundary>
      <CmaTool {...props} />
    </CmaErrorBoundary>
  );
}
