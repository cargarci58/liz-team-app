import { useEffect, useRef, useState } from "react";

// Frame a profile photo for the round email-signature avatar (Carlos 9/28:
// tc1's upload was center-cropped and cut his head off). Drag to move, slider
// to zoom; the circle is exactly what the signature shows. Saves a 480×480
// JPEG square — small, fast, and framed by the person, not by guesswork.
const VIEW = 260;   // on-screen frame size (px)
const OUT = 480;    // saved image size (px)

export default function PhotoCropper({ src, onCancel, onSave }) {
  const imgRef = useRef(null);
  const drag = useRef(null);
  const [nat, setNat] = useState(null);          // natural { w, h }
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // image top-left inside the frame (px, at current scale)
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // "cover" scale: at zoom 1 the short side exactly fills the frame.
  const base = nat ? VIEW / Math.min(nat.w, nat.h) : 1;
  const scale = base * zoom;
  const dispW = nat ? nat.w * scale : 0, dispH = nat ? nat.h * scale : 0;
  const clamp = (p, w = dispW, h = dispH) => ({
    x: Math.min(0, Math.max(VIEW - w, p.x)),
    y: Math.min(0, Math.max(VIEW - h, p.y)),
  });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const n = { w: img.naturalWidth, h: img.naturalHeight };
      setNat(n);
      const b = VIEW / Math.min(n.w, n.h);
      // Start centered horizontally and near the TOP (faces are usually in the
      // upper part of a portrait) instead of dead center.
      setPos({ x: (VIEW - n.w * b) / 2, y: Math.min(0, Math.max(VIEW - n.h * b, -(n.h * b - VIEW) * 0.15)) });
    };
    img.onerror = () => setErr("Couldn't open that picture. Try a JPG or PNG (iPhone HEIC photos may need to be exported as JPG).");
    img.src = src;
  }, [src]);

  // Zoom around the frame's center so the face stays put.
  const changeZoom = (z) => {
    if (!nat) return;
    const newScale = base * z;
    const cx = (VIEW / 2 - pos.x) / scale, cy = (VIEW / 2 - pos.y) / scale;
    const next = { x: VIEW / 2 - cx * newScale, y: VIEW / 2 - cy * newScale };
    setZoom(z);
    setPos(clamp(next, nat.w * newScale, nat.h * newScale));
  };

  const down = (e) => { e.preventDefault(); drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if (!drag.current) return; const d = drag.current; setPos(clamp({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) })); };
  const up = () => { drag.current = null; };

  const save = async () => {
    if (!imgRef.current || !nat) return;
    setBusy(true); setErr("");
    try {
      const c = document.createElement("canvas");
      c.width = OUT; c.height = OUT;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, OUT, OUT);
      // Source rect = what's visible in the frame, in natural-image pixels.
      const sx = -pos.x / scale, sy = -pos.y / scale, sw = VIEW / scale;
      ctx.drawImage(imgRef.current, sx, sy, sw, sw, 0, 0, OUT, OUT);
      const dataUrl = c.toDataURL("image/jpeg", 0.9);
      await onSave(dataUrl.split(",")[1]);
    } catch (e) {
      setErr(/tainted|insecure/i.test(String(e && e.message)) ? "This photo can't be re-framed here — please upload it again." : ("Couldn't save: " + (e && e.message ? e.message : e)));
      setBusy(false);
    }
  };

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 5000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 16px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 360, padding: 20, textAlign: "center", fontFamily: "inherit" }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Position your photo</div>
        <div style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 14 }}>Drag to move · slide to zoom. The circle is exactly what your email signature shows.</div>
        <div
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ position: "relative", width: VIEW, height: VIEW, margin: "0 auto", overflow: "hidden", borderRadius: 8, background: "#F4F4F4", cursor: nat ? "grab" : "default", touchAction: "none", userSelect: "none" }}>
          {nat && <img src={src} alt="" draggable={false} crossOrigin="anonymous"
            style={{ position: "absolute", left: pos.x, top: pos.y, width: dispW, height: dispH, maxWidth: "none", pointerEvents: "none" }} />}
          {/* dim everything outside the round avatar */}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "0 0 0 999px rgba(0,0,0,0.45)", border: "2px solid #fff", pointerEvents: "none" }} />
          {!nat && !err && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontSize: 13 }}>Loading…</div>}
        </div>
        <input type="range" min="1" max="4" step="0.01" value={zoom} disabled={!nat}
          onChange={e => changeZoom(Number(e.target.value))}
          style={{ width: VIEW, marginTop: 14 }} aria-label="Zoom" />
        {err && <div style={{ color: "#922B21", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          <button onClick={onCancel} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={save} disabled={!nat || busy} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#C0392B", color: "#fff", fontWeight: 700, cursor: nat && !busy ? "pointer" : "default", opacity: nat && !busy ? 1 : 0.6, fontFamily: "inherit" }}>
            {busy ? "Saving…" : "Save photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
