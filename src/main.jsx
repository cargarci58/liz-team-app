import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PartyUploadPage from './PartyUploadPage.jsx'
import ResetPasswordPage from './ResetPasswordPage.jsx'
import FormDownloadPage from './FormDownloadPage'
import ContractUploadPublic from './ContractUploadPublic'
import OfferReviewPublic from './OfferReviewPublic'
import MilestoneActionPublic from './MilestoneActionPublic'

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
                           path.startsWith('/review-offers/') || path.startsWith('/milestone-action/');
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
} else if (path.startsWith('/milestone-action/')) {
  const token = path.split('/milestone-action/')[1];
  Root = <MilestoneActionPublic urlToken={token} />;
} else Root = <App />;

createRoot(document.getElementById('root')).render(Root);
