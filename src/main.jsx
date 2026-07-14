import { Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PartyUploadPage from './PartyUploadPage.jsx'
import ResetPasswordPage from './ResetPasswordPage.jsx'
import FormDownloadPage from './FormDownloadPage'
import ContractUploadPublic from './ContractUploadPublic'
import OfferReviewPublic from './OfferReviewPublic'
import OfferSignPublic from './OfferSignPublic'
import MilestoneActionPublic from './MilestoneActionPublic'
import PortalMagicLogin from './PortalMagicLogin'
import TcIntakePublic from './TcIntakePublic'

// Stale-deploy self-heal: after a new Netlify build, the hashed JS chunks
// change. A tab that was already open (or one served the SPA index.html
// fallback for a now-missing chunk) throws "Failed to fetch dynamically
// imported module" when it lazy-loads something (e.g. jsPDF for the LOI / CMA
// PDF). Vite fires `vite:preloadError` on that failure — reload once to pull
// the fresh index + chunk hashes. A 15s cooldown prevents a reload loop if the
// asset is genuinely gone.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('vitePreloadReloadAt') || 0);
    if (Date.now() - last > 15000) {
      sessionStorage.setItem('vitePreloadReloadAt', String(Date.now()));
      e.preventDefault();
      window.location.reload();
    }
  } catch (_) { window.location.reload(); }
});

// Global 401 interceptor — if any API call comes back unauthorized
// (expired/revoked token), clear stored credentials and force a fresh
// login instead of leaving the UI silently broken.
const API_HOST = "liz-team-server-api-production.up.railway.app";
const __origFetch = window.fetch.bind(window);
let __reloadingForAuth = false;
window.fetch = async function patchedFetch(input, init) {
  const res = await __origFetch(input, init);
  try {
    const urlStr = typeof input === "string" ? input : (input && input.url) || "";
    const isApiCall = urlStr.includes(API_HOST);
    // Skip auth endpoints — a 401 there is "wrong credentials", not "session expired".
    // Let the LoginScreen / forgot-password / reset-password forms show their own error.
    const isAuthEndpoint = /\/auth\/(login|register|forgot-password|reset-password)/.test(urlStr);
    if (isApiCall && res.status === 401 && !__reloadingForAuth && !isAuthEndpoint) {
      const path = window.location.pathname;
      const isPublicPath = path.startsWith('/upload/') || path.startsWith('/reset-password') ||
                           path.startsWith('/form-download/') || path.startsWith('/upload-contract/') ||
                           path.startsWith('/review-offers/') || path.startsWith('/milestone-action/') ||
                           path.startsWith('/tc-intake/') || path.startsWith('/portal/');
      if (!isPublicPath) {
        __reloadingForAuth = true;
        try { localStorage.removeItem('tp_token'); localStorage.removeItem('tp_user'); } catch (_) {}
        alert('Your session has expired. Please log in again.');
        window.location.href = '/';
      }
    }
  } catch (_) {}
  return res;
};

// Public routes — no login required (must be checked BEFORE the App auth gate)
const path = window.location.pathname;
let Root;
if (path.startsWith('/upload/')) Root = <PartyUploadPage />;
else if (path.startsWith('/reset-password')) Root = <ResetPasswordPage />;
else if (path.startsWith('/form-download/')) {
  const token = path.split('/form-download/')[1];
  Root = <FormDownloadPage token={token} />;
} else if (path.startsWith('/upload-contract/')) {
  const token = path.split('/upload-contract/')[1];
  Root = <ContractUploadPublic urlToken={token} />;
} else if (path.startsWith('/review-offers/')) {
  const token = path.split('/review-offers/')[1];
  Root = <OfferReviewPublic urlToken={token} />;
} else if (path.startsWith('/sign-offer/')) {
  const token = path.split('/sign-offer/')[1];
  Root = <OfferSignPublic urlToken={token} />;
} else if (path.startsWith('/sign-doc/')) {
  const token = path.split('/sign-doc/')[1];
  Root = <OfferSignPublic urlToken={token} kind="doc" />;
} else if (path.startsWith('/milestone-action/')) {
  const token = path.split('/milestone-action/')[1];
  Root = <MilestoneActionPublic urlToken={token} />;
} else if (path.startsWith('/portal/')) {
  const token = path.split('/portal/')[1];
  Root = <PortalMagicLogin urlToken={token} />;
} else if (path.startsWith('/tc-intake/')) {
  const tcUserId = path.split('/tc-intake/')[1];
  Root = <TcIntakePublic tcUserId={tcUserId} />;
} else Root = <App />;

// Catch any render-time exception so a glitch shows a recoverable message
// instead of a blank white page (which leaves the user stuck with no clue).
// The actual error is shown + logged so a recurring crash is diagnosable.
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error('App crashed:', err, info); } catch (_) {} }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>😕</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#0F2044' }}>Something went wrong</div>
          <div style={{ fontSize: 14, color: '#555', maxWidth: 420 }}>The page hit an unexpected error. Reloading usually fixes it.</div>
          <button onClick={() => window.location.reload()} style={{ padding: '12px 28px', background: '#C0392B', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Reload</button>
          <pre style={{ fontSize: 11, color: '#999', maxWidth: 420, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(this.state.err && this.state.err.message || this.state.err)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(<ErrorBoundary>{Root}</ErrorBoundary>);
