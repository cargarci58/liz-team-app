import { useState, useEffect, useRef, useCallback } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// ────────────────────────────────────────────────────────────
// PUBLIC BUYER SIGNING PAGE — /sign-offer/<token>
// DocuSign-style guided flow:
//   1. Consent + adopt a signature (draw or type) — once.
//   2. The actual package renders in-page (pdf.js); yellow SIGN/INITIAL
//      markers show every spot for THIS signer; the page walks them
//      stop-by-stop (auto-scroll → tap to apply → next).
//   3. Finish → the server stamps the real signatures + certificate.
// No login: possession of the private emailed link is the identity check
// (same standard as mainstream e-sign platforms).
// ────────────────────────────────────────────────────────────

const PAGE_W = 612; // letter-size PDF points; stop coords are in this space

function initialsOf(name) {
  return String(name || "").trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 3).join(".").toUpperCase() + ".";
}

// Signature pad: plain canvas + pointer events (finger, stylus, mouse).
function SignaturePad({ onChange, typedName, mode }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.offsetWidth, h = 170;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e2a5a";
  }, []);

  useEffect(() => {
    if (mode !== "type") return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
    if (typedName) {
      ctx.font = "italic 42px 'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive";
      ctx.fillStyle = "#1e2a5a";
      ctx.textBaseline = "middle";
      ctx.fillText(typedName, 14, 85);
      dirty.current = true;
      onChange(c.toDataURL("image/png"));
    } else {
      dirty.current = false;
      onChange(null);
    }
  }, [typedName, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => { if (mode !== "draw") return; e.preventDefault(); drawing.current = true; const ctx = canvasRef.current.getContext("2d"); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => { if (mode !== "draw" || !drawing.current) return; e.preventDefault(); const ctx = canvasRef.current.getContext("2d"); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true; };
  const up = () => { if (mode !== "draw" || !drawing.current) return; drawing.current = false; if (dirty.current) onChange(canvasRef.current.toDataURL("image/png")); };
  const clear = () => { const c = canvasRef.current; const dpr = window.devicePixelRatio || 1; c.getContext("2d").clearRect(0, 0, c.width / dpr, c.height / dpr); dirty.current = false; onChange(null); };

  return (
    <div>
      <canvas ref={canvasRef}
        style={{ width: "100%", height: 170, background: "#fff", border: "2px dashed #94a3b8", borderRadius: 10, touchAction: "none", cursor: mode === "draw" ? "crosshair" : "default" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>{mode === "draw" ? "Sign above with your finger or mouse" : "Your typed signature appears above"}</span>
        {mode === "draw" && (
          <button type="button" onClick={clear} style={{ fontSize: 12, fontWeight: 700, color: "#7f1d1d", background: "none", border: "1px solid #fca5a5", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
        )}
      </div>
    </div>
  );
}

// In-page PDF viewer with guided stop markers. Renders every page via pdf.js
// (loaded on demand so the main app bundle stays small).
function GuidedPacketViewer({ token, stops, applied, current, sigDataUrl, signerName, onApply }) {
  const [pages, setPages] = useState([]); // [{num, width, height, dataUrl}]
  const [renderErr, setRenderErr] = useState(null);
  const wrapRefs = useRef({});
  const containerRef = useRef(null);
  const [cssWidth, setCssWidth] = useState(680);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const resp = await fetch(API + "/public/offer-sign/" + token + "/packet.pdf");
        if (!resp.ok) throw new Error("Couldn't load the package for viewing.");
        const bytes = new Uint8Array(await resp.arrayBuffer());
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let i = 1; i <= doc.numPages && !cancelled; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (900 / base.width) * dpr * 0.75; // crisp but memory-sane
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width; canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
          const entry = { num: i, width: base.width, height: base.height, dataUrl: canvas.toDataURL("image/jpeg", 0.85) };
          if (!cancelled) setPages(prev => [...prev, entry]);
        }
      } catch (e) { if (!cancelled) setRenderErr(e.message); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const measure = () => { if (containerRef.current) setCssWidth(containerRef.current.offsetWidth); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Auto-scroll to the current stop whenever it changes.
  useEffect(() => {
    const stop = stops[current];
    if (!stop) return;
    const el = wrapRefs.current["stop-" + current];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [current, stops, pages.length]);

  if (renderErr) return (
    <div style={{ fontSize: 13, color: "#7f1d1d", padding: 12 }}>
      ⚠️ {renderErr} <a href={API + "/public/offer-sign/" + token + "/packet.pdf"} target="_blank" rel="noreferrer">Open the package in a new tab</a> to review it, then continue below.
    </div>
  );

  const stopsByPage = {};
  stops.forEach((s, i) => { (stopsByPage[s.page] = stopsByPage[s.page] || []).push({ ...s, idx: i }); });

  return (
    <div ref={containerRef}>
      {pages.length === 0 && <div style={{ color: "#64748b", fontSize: 14, padding: 16, textAlign: "center" }}>Loading the package…</div>}
      {pages.map(p => {
        const scale = cssWidth / p.width;
        return (
          <div key={p.num} style={{ position: "relative", marginBottom: 12, boxShadow: "0 2px 10px rgba(2,6,23,0.12)", borderRadius: 6, overflow: "hidden" }}>
            <img src={p.dataUrl} alt={"Page " + p.num} style={{ display: "block", width: "100%" }} />
            {(stopsByPage[p.num] || []).map(s => {
              const isApplied = applied.has(s.idx);
              const isCurrent = s.idx === current;
              const h = (s.kind === "signature" ? (s.h || 24) + 6 : 16) * scale;
              const w = (s.kind === "signature" ? 170 : 34) * scale;
              const left = s.x * scale;
              const top = (p.height - s.y) * scale - h;
              return (
                <div key={s.idx} ref={el => { wrapRefs.current["stop-" + s.idx] = el; }}
                  onClick={() => !isApplied && onApply(s.idx)}
                  style={{
                    position: "absolute", left, top, width: w, height: h,
                    display: "flex", alignItems: "flex-end", cursor: isApplied ? "default" : "pointer",
                    border: isApplied ? "none" : (isCurrent ? "2px solid #ca8a04" : "2px dashed #ca8a04"),
                    background: isApplied ? "transparent" : (isCurrent ? "rgba(254,240,138,0.75)" : "rgba(254,240,138,0.4)"),
                    borderRadius: 4, boxSizing: "border-box",
                    animation: isCurrent && !isApplied ? "signpulse 1.2s ease-in-out infinite" : "none",
                  }}>
                  {isApplied ? (
                    s.kind === "signature" && sigDataUrl
                      ? <img src={sigDataUrl} alt="signature" style={{ height: "100%", maxWidth: "100%", objectFit: "contain", objectPosition: "left bottom" }} />
                      : <span style={{ fontFamily: "'Snell Roundhand','Brush Script MT',cursive", fontStyle: "italic", fontWeight: 700, color: "#1e2a5a", fontSize: Math.max(10, 12 * scale * 1.6), lineHeight: 1 }}>{s.kind === "signature" ? signerName : initialsOf(signerName)}</span>
                  ) : (
                    <span style={{ fontSize: Math.max(8, 9 * scale * 1.4), fontWeight: 800, color: "#854d0e", padding: 2, lineHeight: 1 }}>
                      {s.kind === "signature" ? "✍️ SIGN" : "INITIAL"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <style>{"@keyframes signpulse { 0%,100% { box-shadow: 0 0 0 0 rgba(202,138,4,0.5);} 50% { box-shadow: 0 0 0 7px rgba(202,138,4,0);} }"}</style>
    </div>
  );
}

export default function OfferSignPublic({ urlToken }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [phase, setPhase] = useState("adopt"); // adopt → guide → done
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState("draw");
  const [typedName, setTypedName] = useState("");
  const [sigDataUrl, setSigDataUrl] = useState(null);
  const [applied, setApplied] = useState(new Set());
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(API + "/public/offer-sign/" + urlToken);
        const b = await r.json();
        if (!r.ok) throw new Error(b.error || "This signing link isn't valid.");
        setData(b);
      } catch (e) { setLoadErr(e.message); }
    })();
  }, [urlToken]);

  const stops = (data && data.stops) || [];

  const applyStop = useCallback((idx) => {
    setApplied(prev => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
    // advance to the next un-applied stop (wrapping back to any skipped ones)
    setCurrent(() => {
      let nxt = -1;
      for (let i = idx + 1; i < stops.length; i++) if (!applied.has(i)) { nxt = i; break; }
      if (nxt === -1) for (let i = 0; i < stops.length; i++) if (i !== idx && !applied.has(i)) { nxt = i; break; }
      return nxt === -1 ? idx : nxt;
    });
  }, [stops.length, applied]);

  const applyAll = () => {
    setApplied(new Set(stops.map((_, i) => i)));
    setCurrent(stops.length - 1);
  };

  const allApplied = stops.length === 0 || applied.size >= stops.length;

  const submit = async () => {
    setError(null);
    if (!sigDataUrl) { setError("Adopt your signature first."); setPhase("adopt"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(API + "/public/offer-sign/" + urlToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, signatureDataUrl: sigDataUrl, kind: mode === "type" ? "typed" : "drawn" }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't save your signature.");
      setPhase("done");
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  };

  const shell = (inner, wide) => (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "24px 12px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: wide ? 760 : 720, margin: "0 auto" }}>
        <div style={{ background: "#0c4a6e", color: "#fff", borderRadius: "14px 14px 0 0", padding: "18px 24px" }}>
          <div style={{ fontSize: 12, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>Electronic signature</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{data?.propertyAddress ? "Offer — " + data.propertyAddress : "Your offer package"}</div>
          {data?.agentName && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Prepared by {data.agentName}</div>}
        </div>
        <div style={{ background: "#fff", borderRadius: "0 0 14px 14px", padding: 22, boxShadow: "0 8px 30px rgba(2,6,23,0.08)" }}>{inner}</div>
      </div>
    </div>
  );

  if (loadErr) return shell(<div style={{ color: "#7f1d1d", fontSize: 15 }}>⚠️ {loadErr}<div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>If you think this is a mistake, contact your agent for a fresh link.</div></div>);
  if (!data) return shell(<div style={{ color: "#64748b", fontSize: 15 }}>Loading your offer package…</div>);
  if (data.status === "cancelled") return shell(<div style={{ fontSize: 15, color: "#374151" }}>This signing request was cancelled by your agent. If you're still expecting to sign, ask them to send a new link.</div>);
  if (phase === "done" || data.status === "signed") return shell(
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ fontSize: 46 }}>🎉</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#15803d", marginTop: 8 }}>You're all set{data.signerName ? ", " + data.signerName.split(" ")[0] : ""}!</div>
      <div style={{ fontSize: 14, color: "#374151", marginTop: 10, lineHeight: 1.6 }}>
        Your signature and initials have been applied to the offer package.<br />
        {data.agentName || "Your agent"} will send the offer to the listing side and keep you posted.
      </div>
    </div>
  );

  // ── Phase 1: consent + adopt signature ──
  if (phase === "adopt") return shell(
    <div>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 16 }}>
        Hi <strong>{data.signerName}</strong> — your offer package is ready to sign. Two quick steps:
        first adopt your signature, then we'll walk you through <strong>each place</strong> it goes — {stops.length > 0 ? <strong>{stops.filter(s => s.kind === "signature").length} signature{stops.filter(s => s.kind === "signature").length === 1 ? "" : "s"} and {stops.filter(s => s.kind === "initials").length} initial spot{stops.filter(s => s.kind === "initials").length === 1 ? "" : "s"}</strong> : "every signature and initial spot"} — one at a time.
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>1 · Agree to sign electronically</div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
          <span style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.55 }}>{data.consentText}</span>
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>2 · Adopt your signature</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[["draw", "✍️ Draw"], ["type", "⌨️ Type"]].map(([m, label]) => (
            <button key={m} type="button" onClick={() => { setMode(m); setSigDataUrl(null); if (m === "type" && !typedName) setTypedName(data.signerName || ""); }}
              style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "1px solid " + (mode === m ? "#0c4a6e" : "#cbd5e1"), background: mode === m ? "#0c4a6e" : "#fff", color: mode === m ? "#fff" : "#374151" }}>
              {label}
            </button>
          ))}
        </div>
        {mode === "type" && (
          <input value={typedName} onChange={e => setTypedName(e.target.value)} placeholder="Type your full legal name"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 15, marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" }} />
        )}
        <SignaturePad mode={mode} typedName={typedName} onChange={setSigDataUrl} />
        <div style={{ marginTop: 10, fontSize: 12.5, color: "#475569" }}>
          Your initials will be applied as: <span style={{ fontFamily: "'Snell Roundhand','Brush Script MT',cursive", fontStyle: "italic", fontWeight: 700, fontSize: 17, color: "#1e2a5a" }}>{initialsOf(data.signerName)}</span>
        </div>
      </div>
      {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, fontSize: 13, color: "#7f1d1d", marginBottom: 14 }}>⚠️ {error}</div>}
      <button type="button"
        onClick={() => {
          setError(null);
          if (!consent) { setError("Please check the consent box first."); return; }
          if (!sigDataUrl) { setError(mode === "draw" ? "Please sign in the box first." : "Please type your name first."); return; }
          setPhase("guide");
          setCurrent(0);
        }}
        style={{ width: "100%", padding: "14px 0", background: "#0c4a6e", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
        Start signing →
      </button>
    </div>
  );

  // ── Phase 2: guided walk through every stop ──
  const sigCount = stops.filter(s => s.kind === "signature").length;
  return shell(
    <div>
      <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.55, marginBottom: 12 }}>
        Review the package below. Tap each <span style={{ background: "#fef08a", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>yellow marker</span> to place your {sigCount ? "signature or initials" : "initials"} — we'll take you to each one in order.
      </div>
      <GuidedPacketViewer token={urlToken} stops={stops} applied={applied} current={current}
        sigDataUrl={sigDataUrl} signerName={data.signerName} onApply={applyStop} />
      {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, fontSize: 13, color: "#7f1d1d", margin: "12px 0" }}>⚠️ {error}</div>}
      {/* Sticky action bar */}
      <div style={{ position: "sticky", bottom: 8, background: "#0f172a", color: "#fff", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, boxShadow: "0 8px 30px rgba(2,6,23,0.45)", marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {allApplied ? "✅ All spots signed" : `${applied.size} of ${stops.length} placed`}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!allApplied && (
            <button type="button" onClick={() => applyStop(current)}
              style={{ padding: "9px 16px", background: "#fef08a", color: "#713f12", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {stops[current] && stops[current].kind === "signature" ? "✍️ Sign here" : "Place initials"} ({applied.size + 1}/{stops.length})
            </button>
          )}
          {!allApplied && applied.size > 0 && (
            <button type="button" onClick={applyAll}
              style={{ padding: "9px 14px", background: "transparent", color: "#e2e8f0", border: "1px solid #475569", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Apply to all remaining
            </button>
          )}
          {allApplied && (
            <button type="button" onClick={submit} disabled={submitting}
              style={{ padding: "10px 20px", background: submitting ? "#64748b" : "#22c55e", color: "#052e16", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: submitting ? "default" : "pointer", fontFamily: "inherit" }}>
              {submitting ? "Finishing…" : "Finish & submit ✓"}
            </button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 10, textAlign: "center" }}>
        A record of who signed, when, and from where is attached to the package as a signature certificate.
      </div>
    </div>,
    true
  );
}
