import { useState, useEffect } from 'react';
import { t, useLang, applyPreferredLang } from './i18n';
import LangToggle from './components/LangToggle';

const API = import.meta.env.VITE_API_URL || 'https://liz-team-server-api-production.up.railway.app';

export default function FormDownloadPage({ token }) {
  useLang();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/public/form-download/${token}`);
        const data = await r.json();
        if (data && data.language) applyPreferredLang(data.language);
        if (!r.ok) { setState({ loading: false, error: data.error || 'Link error', data: null }); return; }
        setState({ loading: false, error: null, data });
      } catch (e) { setState({ loading: false, error: e.message, data: null }); }
    })();
  }, [token]);

  function handleDownload() {
    if (!state.data?.downloadUrl) return;
    setDownloading(true);
    // Open in new tab (browser handles download via Content-Disposition)
    window.open(state.data.downloadUrl, '_blank');
    setTimeout(() => setDownloading(false), 1500);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -12, marginRight: -12 }}><LangToggle /></div>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <h1 style={{ margin: '8px 0', fontSize: 22, color: '#1f2937' }}>{t('TransactPro Form')}</h1>
        </div>

        {state.loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>{t('Loading…')}</div>
        )}

        {state.error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, color: '#991b1b' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>⚠️ {t('Cannot download this form')}</div>
            <div style={{ fontSize: 14 }}>{t(state.error)}</div>
            <div style={{ fontSize: 12, marginTop: 10, color: '#6b7280' }}>
              {t('Links expire 7 days after they are sent. If this one has expired, please ask your agent to send a new link.')}
            </div>
          </div>
        )}

        {state.data && (
          <>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>{t('Form')}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', marginTop: 4 }}>{state.data.formName}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>📄 {state.data.fileName}</div>
            </div>

            <button onClick={handleDownload} disabled={downloading}
              style={{ width: '100%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', padding: '14px', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: downloading ? 'wait' : 'pointer' }}>
              {downloading ? '⏳ ' + t('Opening…') : '⬇️ ' + t('Download Form')}
            </button>

            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 16, textAlign: 'center', lineHeight: 1.5 }}>
              {t("This is a secure, time-limited download link from your real estate agent. The file will open in a new tab. If your browser doesn't start the download, check your popup blocker.")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
