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
  // First + last initial only — matches the server's stamping and fits the
  // small initials boxes on the contract footer.
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const chars = parts.length === 1 ? [parts[0][0]] : [parts[0][0], parts[parts.length - 1][0]];
  return chars.join(".").toUpperCase() + ".";
}

// Crop a signature canvas to its ink bounding box (+ padding) so the PNG has
// no dead whitespace — otherwise the stamped signature floats above the
// signature line because the image bottom is padding, not ink.
function trimmedSignature(canvas) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  let img;
  try { img = ctx.getImageData(0, 0, W, H); } catch { return canvas.toDataURL("image/png"); }
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (img.data[(y * W + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // blank canvas
  const pad = 8;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1; out.height = maxY - minY + 1;
  out.getContext("2d").drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

// Signature pad: plain canvas + pointer events (finger, stylus, mouse).
function SignaturePad({ onChange, typedName, mode }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  // The canvas can mount BEFORE layout settles (offsetWidth ≈ 0) — sizing it
  // then leaves a sliver-wide canvas where nothing registers. Measure until
  // layout gives a real width, and size only then.
  const [cw, setCw] = useState(0);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let raf;
    const measure = () => {
      const w = c.offsetWidth;
      if (w > 40) setCw(w); else raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !cw) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = cw * dpr; c.height = 170 * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e2a5a";
  }, [cw]);

  useEffect(() => {
    if (mode !== "type" || !cw) return;
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
      onChange(trimmedSignature(c));
    } else {
      dirty.current = false;
      onChange(null);
    }
  }, [typedName, mode, cw]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => { if (mode !== "draw") return; e.preventDefault(); drawing.current = true; const ctx = canvasRef.current.getContext("2d"); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => { if (mode !== "draw" || !drawing.current) return; e.preventDefault(); const ctx = canvasRef.current.getContext("2d"); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true; };
  const up = () => { if (mode !== "draw" || !drawing.current) return; drawing.current = false; if (dirty.current) onChange(trimmedSignature(canvasRef.current)); };
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
function GuidedPacketViewer({ token, base, stops, applied, current, sigDataUrl, signerName, onApply, textMap = {}, fileQuery = "" }) {
  const [pages, setPages] = useState([]); // [{num, width, height, dataUrl}]
  const [renderErr, setRenderErr] = useState(null);
  const wrapRefs = useRef({});
  const containerRef = useRef(null);
  const [cssWidth, setCssWidth] = useState(680);

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const resp = await fetch(API + "/public/" + base + "/" + token + "/packet.pdf" + fileQuery);
        if (!resp.ok) throw new Error("Couldn't load the package for viewing.");
        const bytes = new Uint8Array(await resp.arrayBuffer());
        // The packet's flattened forms reference non-embedded standard fonts —
        // pdf.js needs standardFontDataUrl or those pages stall silently.
        const doc = await pdfjs.getDocument({
          data: bytes,
          useSystemFonts: true,
          standardFontDataUrl: "/pdf-fonts/",
        }).promise;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
        for (let i = 1; i <= doc.numPages && !cancelled; i++) {
          let entry;
          try {
            const page = await withTimeout(doc.getPage(i), 15000);
            const vp0 = page.getViewport({ scale: 1 });
            const scale = (900 / vp0.width) * dpr * 0.75; // crisp but memory-sane
            const vp = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = vp.width; canvas.height = vp.height;
            await withTimeout(page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise, 15000);
            entry = { num: i, width: vp0.width, height: vp0.height, dataUrl: canvas.toDataURL("image/jpeg", 0.85) };
          } catch (pageErr) {
            // One bad page must never block the rest — show a placeholder;
            // the full-package link is always available for review.
            console.error("[sign-viewer] page " + i + " failed: " + pageErr.message);
            entry = { num: i, width: PAGE_W, height: 792, dataUrl: null };
          }
          if (!cancelled) setPages(prev => [...prev, entry]);
        }
      } catch (e) { if (!cancelled) setRenderErr(e.message); }
    })();
    return () => { cancelled = true; };
  }, [token, base, fileQuery]);

  useEffect(() => {
    const measure = () => { if (containerRef.current) setCssWidth(containerRef.current.offsetWidth); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Auto-scroll to the current stop whenever it changes (the element only
  // exists in the viewer that owns the stop — other viewers no-op).
  useEffect(() => {
    const el = wrapRefs.current["stop-" + current];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [current, stops, pages.length]);

  if (renderErr) return (
    <div style={{ fontSize: 13, color: "#7f1d1d", padding: 12 }}>
      ⚠️ {renderErr} <a href={API + "/public/" + base + "/" + token + "/packet.pdf"} target="_blank" rel="noreferrer">Open the package in a new tab</a> to review it, then continue below.
    </div>
  );

  const stopsByPage = {};
  stops.forEach((s, i) => { (stopsByPage[s.page] = stopsByPage[s.page] || []).push({ ...s, idx: s.gidx != null ? s.gidx : i }); });

  return (
    <div ref={containerRef}>
      {pages.length === 0 && <div style={{ color: "#64748b", fontSize: 14, padding: 16, textAlign: "center" }}>Loading the package…</div>}
      {pages.map(p => {
        const scale = cssWidth / p.width;
        return (
          <div key={p.num} style={{ position: "relative", marginBottom: 12, boxShadow: "0 2px 10px rgba(2,6,23,0.12)", borderRadius: 6, overflow: "hidden" }}>
            {p.dataUrl
              ? <img src={p.dataUrl} alt={"Page " + p.num} style={{ display: "block", width: "100%" }} />
              : <div style={{ width: "100%", height: (p.height / p.width) * cssWidth, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#64748b" }}>
                  Page {p.num} preview unavailable — use "Open full package" above to review it
                </div>}
            {(stopsByPage[p.num] || []).map(s => {
              // "auto" stops need nothing from the signer — dates fill in with
              // the signing date, pre-written text stamps as the agent wrote it.
              if (s.auto) {
                const ah = (s.kind === "checkbox" ? 14 : 18) * scale;
                const aw = (s.kind === "checkbox" ? 14 : s.kind === "date" ? 90 : 140) * scale;
                return (
                  <div key={s.idx}
                    style={{ position: "absolute", left: s.x * scale, top: (p.height - s.y) * scale - ah, width: aw, height: ah, display: "flex", alignItems: s.kind === "checkbox" ? "center" : "flex-end", justifyContent: s.kind === "checkbox" ? "center" : "flex-start", border: "1.5px dashed #94a3b8", background: "rgba(241,245,249,0.7)", borderRadius: 4, boxSizing: "border-box" }}>
                    <span style={{ fontSize: Math.max(8, 9 * scale * 1.3), fontWeight: 700, color: "#475569", padding: s.kind === "checkbox" ? 0 : 2, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden" }}>
                      {s.kind === "date" ? "📅 dated when you sign" : s.kind === "checkbox" ? "X" : s.text}
                    </span>
                  </div>
                );
              }
              const isApplied = applied.has(s.idx);
              const isCurrent = s.idx === current;
              const h = (s.kind === "signature" ? (s.h || 24) + 6 : s.kind === "text" ? 20 : (s.h || 16)) * scale;
              const w = (s.w || (s.kind === "signature" ? 170 : s.kind === "text" ? 140 : 34)) * scale;
              const left = s.x * scale;
              const top = (p.height - s.y) * scale - h;
              return (
                <div key={s.idx} ref={el => { wrapRefs.current["stop-" + s.idx] = el; }}
                  onClick={() => onApply(s.idx)}
                  style={{
                    position: "absolute", left, top, width: w, height: h,
                    display: "flex", alignItems: "flex-end", cursor: (isApplied && s.kind !== "text") ? "default" : "pointer",
                    border: isApplied ? "none" : (isCurrent ? "2px solid #ca8a04" : "2px dashed #ca8a04"),
                    background: isApplied ? "transparent" : (isCurrent ? "rgba(254,240,138,0.75)" : "rgba(254,240,138,0.4)"),
                    borderRadius: 4, boxSizing: "border-box",
                    animation: isCurrent && !isApplied ? "signpulse 1.2s ease-in-out infinite" : "none",
                  }}>
                  {isApplied ? (
                    s.kind === "signature" && sigDataUrl
                      ? <img src={sigDataUrl} alt="signature" style={{ height: "100%", maxWidth: "100%", objectFit: "contain", objectPosition: "left bottom" }} />
                      : s.kind === "text"
                        ? <span title="Tap to change" style={{ fontWeight: 700, color: "#1e2a5a", fontSize: Math.max(9, 10 * scale * 1.4), lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden" }}>{textMap[s.idx] || ""}</span>
                        : <span style={{ fontFamily: "'Snell Roundhand','Brush Script MT',cursive", fontStyle: "italic", fontWeight: 700, color: "#1e2a5a", fontSize: Math.max(10, (s.kind === "initials" ? (s.h || 16) * 1.2 : 12 * 1.6) * scale), lineHeight: 1 }}>{s.kind === "signature" ? signerName : initialsOf(signerName)}</span>
                  ) : (
                    <span style={{ fontSize: Math.max(8, 9 * scale * 1.4), fontWeight: 800, color: "#854d0e", padding: 2, lineHeight: 1 }}>
                      {s.kind === "signature" ? "✍️ SIGN" : s.kind === "text" ? "💬 TYPE" : "INITIAL"}
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

export default function OfferSignPublic({ urlToken, kind = "offer" }) {
  // Same page signs OFFER PACKETS and standalone DOCUMENTS (net sheets etc.);
  // only the API base differs.
  const base = kind === "doc" ? "doc-sign" : "offer-sign";
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
        const r = await fetch(API + "/public/" + base + "/" + urlToken);
        const b = await r.json();
        if (!r.ok) throw new Error(b.error || "This signing link isn't valid.");
        setData(b);
      } catch (e) { setLoadErr(e.message); }
    })();
  }, [urlToken, base]);

  // A doc-signing link may cover SEVERAL documents (bundled round). Offers are
  // always a single packet. Stops are flattened across documents; gidx is each
  // stop's global position so the guided walk runs straight through the bundle.
  const docsArr = !data ? []
    : kind === "doc"
      ? (Array.isArray(data.docs) && data.docs.length ? data.docs : [{ docId: null, name: data.docName, stops: data.stops || [] }])
      : [{ docId: null, name: null, stops: data.stops || [] }];
  const stops = docsArr.flatMap((d, di) => (d.stops || []).map(s => ({
    ...s, docIdx: di, textKey: (d.docId ? d.docId + ":" : "") + s.id,
  }))).map((s, i) => ({ ...s, gidx: i }));
  // "auto" stops (dates, agent-pre-written text) fill themselves — the signer
  // only works through the interactive ones.
  const interactiveCount = stops.filter(s => !s.auto).length;
  const [textMap, setTextMap] = useState({}); // stop gidx → signer-typed text

  const applyStop = useCallback((idx) => {
    const s = stops[idx];
    if (!s || s.auto) return;
    if (s.kind === "text") {
      const v = window.prompt("Type what should go in this box:", textMap[idx] || "");
      if (v === null) return;
      const t = v.trim().slice(0, 120);
      if (!t) return;
      setTextMap(m => ({ ...m, [idx]: t }));
    }
    setApplied(prev => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
    // advance to the next un-applied interactive stop (wrapping back to skipped ones)
    setCurrent(() => {
      let nxt = -1;
      for (let i = idx + 1; i < stops.length; i++) if (!stops[i].auto && !applied.has(i)) { nxt = i; break; }
      if (nxt === -1) for (let i = 0; i < stops.length; i++) if (i !== idx && !stops[i].auto && !applied.has(i)) { nxt = i; break; }
      return nxt === -1 ? idx : nxt;
    });
  }, [stops, applied, textMap]);

  const applyAll = () => {
    // Text boxes still need typing — everything else applies in one go.
    setApplied(prev => {
      const next = new Set(prev);
      stops.forEach((s, i) => { if (!s.auto && (s.kind !== "text" || textMap[i])) next.add(i); });
      return next;
    });
    const firstText = stops.findIndex((s, i) => !s.auto && s.kind === "text" && !textMap[i]);
    setCurrent(firstText >= 0 ? firstText : stops.length - 1);
  };

  const allApplied = interactiveCount === 0 || applied.size >= interactiveCount;

  const submit = async () => {
    setError(null);
    if (!sigDataUrl) { setError("Adopt your signature first."); setPhase("adopt"); return; }
    setSubmitting(true);
    try {
      const textValues = {};
      stops.forEach((s) => { if (s.kind === "text" && !s.auto && textMap[s.gidx]) textValues[s.textKey] = textMap[s.gidx]; });
      const r = await fetch(API + "/public/" + base + "/" + urlToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, signatureDataUrl: sigDataUrl, kind: mode === "type" ? "typed" : "drawn", textValues }),
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
          <div style={{ fontSize: 20, fontWeight: 800 }}>{data?.docName ? data.docName : (data?.propertyAddress ? "Offer — " + data.propertyAddress : "Your offer package")}</div>
          {data?.docName && data?.propertyAddress && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{data.propertyAddress}</div>}
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
        {kind === "doc" ? (docsArr.length > 1 ? "Your signature has been applied to all " + docsArr.length + " documents." : "Your signature has been applied to the document.") : "Your signature and initials have been applied to the offer package."}<br />
        {kind === "doc" ? (data.agentName || "Your agent") + " has been notified and has the signed " + (docsArr.length > 1 ? "copies." : "copy.") : (data.agentName || "Your agent") + " will send the offer to the listing side and keep you posted."}
      </div>
    </div>
  );

  // ── Phase 1: consent + adopt signature ──
  if (phase === "adopt") return shell(
    <div>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 16 }}>
        Hi <strong>{data.signerName}</strong> — {kind === "doc" ? (docsArr.length > 1 ? "these " + docsArr.length + " documents are ready for your signature." : "this document is ready for your signature.") : "your offer package is ready to sign."} Two quick steps:
        first adopt your signature, then we'll walk you through <strong>each place</strong> it goes — {interactiveCount > 0 ? <strong>{[
          [stops.filter(s => !s.auto && s.kind === "signature").length, "signature", "signatures"],
          [stops.filter(s => !s.auto && s.kind === "initials").length, "initial spot", "initial spots"],
          [stops.filter(s => !s.auto && s.kind === "text").length, "box to fill in", "boxes to fill in"],
        ].filter(([n]) => n > 0).map(([n, one, many]) => n + " " + (n === 1 ? one : many)).join(" and ")}</strong> : "every signature and initial spot"} — one at a time.
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
          setCurrent(Math.max(0, stops.findIndex(s => !s.auto)));
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.55, flex: 1, minWidth: 220 }}>
          Review the package below. Tap each <span style={{ background: "#fef08a", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>yellow marker</span> to place your {sigCount ? "signature or initials" : "initials"} — we'll take you to each one in order.
        </div>
        <a href={API + "/public/" + base + "/" + urlToken + "/packet.pdf"} target="_blank" rel="noreferrer"
          style={{ fontSize: 12, fontWeight: 700, color: "#075985", whiteSpace: "nowrap" }}>Open full package ↗</a>
      </div>
      {docsArr.map((d, di) => (
        <div key={d.docId || di}>
          {docsArr.length > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "#e0f2fe", border: "1px solid #bae6fd", borderRadius: 8, padding: "8px 12px", margin: di === 0 ? "0 0 8px" : "16px 0 8px" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#0c4a6e" }}>📄 Document {di + 1} of {docsArr.length} — {d.name}</span>
              <a href={API + "/public/" + base + "/" + urlToken + "/packet.pdf" + (d.docId ? "?doc=" + d.docId : "")} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, fontWeight: 700, color: "#075985", whiteSpace: "nowrap" }}>Open ↗</a>
            </div>
          )}
          <GuidedPacketViewer token={urlToken} base={base} stops={stops.filter(s => s.docIdx === di)} applied={applied} current={current}
            sigDataUrl={sigDataUrl} signerName={data.signerName} onApply={applyStop} textMap={textMap}
            fileQuery={d.docId ? "?doc=" + d.docId : ""} />
        </div>
      ))}
      {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, fontSize: 13, color: "#7f1d1d", margin: "12px 0" }}>⚠️ {error}</div>}
      {/* Sticky action bar */}
      <div style={{ position: "sticky", bottom: 8, background: "#0f172a", color: "#fff", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, boxShadow: "0 8px 30px rgba(2,6,23,0.45)", marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {allApplied ? "✅ All spots signed" : `${applied.size} of ${interactiveCount} placed`}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!allApplied && (
            <button type="button" onClick={() => applyStop(current)}
              style={{ padding: "9px 16px", background: "#fef08a", color: "#713f12", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {stops[current] && stops[current].kind === "signature" ? "✍️ Sign here" : stops[current] && stops[current].kind === "text" ? "💬 Type text" : "Place initials"} ({applied.size + 1}/{interactiveCount})
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
