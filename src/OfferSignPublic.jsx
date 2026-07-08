import { useState, useEffect, useRef } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// ────────────────────────────────────────────────────────────
// PUBLIC BUYER SIGNING PAGE — /sign-offer/<token>
// The buyer reviews the full offer package, consents to e-sign
// (ESIGN / Fla. Stat. 668.50), then draws or types a signature.
// No login: possession of the private emailed link is the identity
// check (same standard as mainstream e-sign platforms).
// ────────────────────────────────────────────────────────────

// Signature pad: plain canvas + pointer events (works with finger, stylus, mouse).
function SignaturePad({ onChange, typedName, mode }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const setup = () => {
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
  };
  useEffect(() => { setup(); }, []);

  // Typed mode: render the name in a script font onto the canvas.
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
  const down = (e) => {
    if (mode !== "draw") return;
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e) => {
    if (mode !== "draw" || !drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dirty.current = true;
  };
  const up = () => {
    if (mode !== "draw" || !drawing.current) return;
    drawing.current = false;
    if (dirty.current) onChange(canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    c.getContext("2d").clearRect(0, 0, c.width / dpr, c.height / dpr);
    dirty.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas ref={canvasRef}
        style={{ width: "100%", height: 170, background: "#fff", border: "2px dashed #94a3b8", borderRadius: 10, touchAction: "none", cursor: mode === "draw" ? "crosshair" : "default" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>{mode === "draw" ? "Sign above with your finger or mouse" : "Your typed signature appears above"}</span>
        {mode === "draw" && (
          <button type="button" onClick={clear} style={{ fontSize: 12, fontWeight: 700, color: "#7f1d1d", background: "none", border: "1px solid #fca5a5", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export default function OfferSignPublic({ urlToken }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState("draw"); // draw | type
  const [typedName, setTypedName] = useState("");
  const [sigDataUrl, setSigDataUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
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

  const submit = async () => {
    setError(null);
    if (!consent) { setError("Please check the consent box first."); return; }
    if (!sigDataUrl) { setError(mode === "draw" ? "Please sign in the box first." : "Please type your name first."); return; }
    setSubmitting(true);
    try {
      const r = await fetch(API + "/public/offer-sign/" + urlToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, signatureDataUrl: sigDataUrl, kind: mode === "type" ? "typed" : "drawn" }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || "Couldn't save your signature.");
      setDone(true);
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  };

  const shell = (inner) => (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "24px 12px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ background: "#0c4a6e", color: "#fff", borderRadius: "14px 14px 0 0", padding: "18px 24px" }}>
          <div style={{ fontSize: 12, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>Electronic signature</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{data?.propertyAddress ? "Offer — " + data.propertyAddress : "Your offer package"}</div>
          {data?.agentName && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Prepared by {data.agentName}</div>}
        </div>
        <div style={{ background: "#fff", borderRadius: "0 0 14px 14px", padding: 24, boxShadow: "0 8px 30px rgba(2,6,23,0.08)" }}>{inner}</div>
      </div>
    </div>
  );

  if (loadErr) return shell(<div style={{ color: "#7f1d1d", fontSize: 15 }}>⚠️ {loadErr}<div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>If you think this is a mistake, contact your agent for a fresh link.</div></div>);
  if (!data) return shell(<div style={{ color: "#64748b", fontSize: 15 }}>Loading your offer package…</div>);
  if (data.status === "cancelled") return shell(<div style={{ fontSize: 15, color: "#374151" }}>This signing request was cancelled by your agent. If you're still expecting to sign, ask them to send a new link.</div>);
  if (done || data.status === "signed") return shell(
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div style={{ fontSize: 46 }}>🎉</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#15803d", marginTop: 8 }}>You're all set{data.signerName ? ", " + data.signerName.split(" ")[0] : ""}!</div>
      <div style={{ fontSize: 14, color: "#374151", marginTop: 10, lineHeight: 1.6 }}>
        Your signature has been applied to the offer package.<br />
        {data.agentName || "Your agent"} will send the offer to the listing side and keep you posted.
      </div>
    </div>
  );

  return shell(
    <div>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 16 }}>
        Hi <strong>{data.signerName}</strong> — your offer package is ready. Please <strong>review the entire package</strong> below, then sign at the bottom. Your signature will be applied to the contract, the addenda, and the disclosures in the package.
      </div>

      {/* Package review */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.04em" }}>1 · Review the package</div>
          {data.packetUrl && (
            <a href={data.packetUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: "#075985" }}>Open full screen ↗</a>
          )}
        </div>
        {data.packetUrl ? (
          <iframe title="Offer package" src={data.packetUrl} style={{ width: "100%", height: 460, border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc" }} />
        ) : (
          <div style={{ fontSize: 13, color: "#7f1d1d" }}>The package couldn't be loaded — use the link your agent sent, or contact them.</div>
        )}
      </div>

      {/* Consent */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>2 · Agree to sign electronically</div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
          <span style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.55 }}>{data.consentText}</span>
        </label>
      </div>

      {/* Signature */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>3 · Sign</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[["draw", "✍️ Draw"], ["type", "⌨️ Type"]].map(([m, label]) => (
            <button key={m} type="button" onClick={() => { setMode(m); setSigDataUrl(null); }}
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
      </div>

      {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, fontSize: 13, color: "#7f1d1d", marginBottom: 14 }}>⚠️ {error}</div>}

      <button type="button" onClick={submit} disabled={submitting}
        style={{ width: "100%", padding: "14px 0", background: submitting ? "#94a3b8" : "#15803d", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: submitting ? "default" : "pointer", fontFamily: "inherit" }}>
        {submitting ? "Applying your signature…" : "Apply my signature ✓"}
      </button>
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 10, textAlign: "center" }}>
        A record of who signed, when, and from where is attached to the package as a signature certificate.
      </div>
    </div>
  );
}
