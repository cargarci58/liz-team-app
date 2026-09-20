import { useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// TourModal — plays the narrated tour inside the app.
//
// The tour itself is a static page at /tour/index.html (public/tour/): a
// 960×540 animated stage + Kristen's pre-rendered narration (MP3s in
// public/tour/audio, rendered ONCE server-side, so every agent hears the
// exact same voice on every device — nothing depends on the browser's
// speech engine). This modal just frames it in an iframe:
//   cut = 'marketing'  → the 2-minute tour (10 scenes)
//   cut = 'learn'      → every screen and feature, 9 chapters (40 scenes)
//   chapter            → start the learn cut at that chapter (1-based)
//   scenes             → play ONLY these learn scenes (e.g. ['3.3','3.4']) — the per-page clip
// The page posts {type:'tour:close'} when its end-card Close is tapped.
// ═══════════════════════════════════════════════════════════════
export default function TourModal({ cut = 'marketing', chapter, scenes, onClose }) {
  useEffect(() => {
    const onMsg = (e) => { if (e.data && e.data.type === 'tour:close') onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('message', onMsg);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const qs = new URLSearchParams({ cut, embed: '1' });
  if (cut === 'learn' && chapter) qs.set('chapter', String(chapter));
  if (cut === 'learn' && scenes && scenes.length) qs.set('scenes', scenes.join(','));
  const src = `/tour/index.html?${qs.toString()}`;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(11,15,25,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(1100px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {cut === 'learn' ? (scenes && scenes.length ? '🎬 How this page works' : '📚 Learn the app, chapter by chapter') : '🎬 The 2-minute tour'}
          </div>
          <button onClick={onClose} aria-label="Close the tour" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Close
          </button>
        </div>
        {/* 16:9 stage + caption + controls ≈ 16:11.5; the frame gets that ratio so nothing inside scrolls. */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 11.6', maxHeight: 'calc(100vh - 70px)', borderRadius: 12, overflow: 'hidden', background: '#0B0F19', border: '1px solid #28324A' }}>
          <iframe
            title={cut === 'learn' ? 'Learn TransactPro, chapter by chapter' : 'The 2-minute TransactPro tour'}
            src={src}
            allow="autoplay"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: '#0B0F19' }}
          />
        </div>
      </div>
    </div>
  );
}
