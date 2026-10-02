// ═══════════════════════════════════════════════════════════════
// In-app "Are you sure?" and "Type something" boxes.
//
// Replaces the browser's window.confirm / window.prompt. Those can be blocked
// by the browser ("prevent this page from creating more dialogs"), and a blocked
// confirm silently returns false / a blocked prompt returns null — screens then
// did the wrong thing without asking. These live in the page, are keyboard and
// screen-reader friendly, and can't be blocked.
//
//   if (!(await askConfirm("Delete this note?", { okLabel: "Delete", danger: true }))) return;
//   const name = await askText("Folder name?", "New folder");   // null = cancelled
//
// Self-mounting: works on every page (agent app, portals, public signing pages)
// without a provider. Closing the box, Esc, or tapping outside = Cancel.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { UI, btn } from "./kit";
import { t } from "../i18n";

let pushDialog = null;     // set by the mounted host
const queue = [];          // calls made before the host finished mounting

function ensureHost() {
  if (pushDialog || typeof document === "undefined") return;
  if (document.getElementById("tp-dialog-host")) return;
  const el = document.createElement("div");
  el.id = "tp-dialog-host";
  document.body.appendChild(el);
  createRoot(el).render(<DialogHost />);
}

function open(spec) {
  return new Promise((resolve) => {
    const item = { ...spec, resolve };
    if (pushDialog) pushDialog(item);
    else { queue.push(item); ensureHost(); }
  });
}

/** Resolves true (OK) or false (Cancel / closed). */
export function askConfirm(message, opts = {}) {
  return open({ kind: "confirm", message: String(message ?? ""), ...opts });
}

/** Resolves the typed text, or null if cancelled. */
export function askText(message, defaultValue = "", opts = {}) {
  return open({ kind: "prompt", message: String(message ?? ""), defaultValue: defaultValue == null ? "" : String(defaultValue), ...opts });
}

function DialogHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    pushDialog = (item) => setItems((xs) => [...xs, item]);
    if (queue.length) setItems((xs) => [...xs, ...queue.splice(0)]);
    return () => { pushDialog = null; };
  }, []);
  const current = items[0];
  if (!current) return null;
  const finish = (value) => {
    current.resolve(value);
    setItems((xs) => xs.slice(1));
  };
  return <Dialog key={items.length + ":" + current.message} spec={current} onDone={finish} />;
}

function Dialog({ spec, onDone }) {
  const isPrompt = spec.kind === "prompt";
  const [val, setVal] = useState(spec.defaultValue || "");
  const okRef = useRef(null);
  const cancelRef = useRef(null);
  const inputRef = useRef(null);
  const cancel = () => onDone(isPrompt ? null : false);
  const ok = () => onDone(isPrompt ? val : true);
  useEffect(() => {
    const prev = document.activeElement;
    // Dangerous actions start on Cancel so a stray Enter can't delete anything.
    (isPrompt ? inputRef.current : spec.danger ? cancelRef.current : okRef.current)?.focus();
    if (isPrompt) inputRef.current?.select();
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); try { prev && prev.focus && prev.focus(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const okLabel = spec.okLabel || t("OK");
  const cancelLabel = spec.cancelLabel || t("Cancel");
  return (
    <div onClick={cancel}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="tp-dialog-msg" onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 460, margin: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        {spec.title && (
          <div style={{ padding: "16px 20px 0", fontSize: 17, fontWeight: 800, color: UI.text }}>{spec.title}</div>
        )}
        <div id="tp-dialog-msg" style={{ padding: "16px 20px 4px", fontSize: 15, color: UI.text, lineHeight: 1.55, whiteSpace: "pre-line", maxHeight: "60vh", overflowY: "auto" }}>
          {spec.message}
        </div>
        {isPrompt && (
          <div style={{ padding: "8px 20px 0" }}>
            {spec.multiline ? (
              <textarea ref={inputRef} value={val} onChange={(e) => setVal(e.target.value)} rows={4} aria-label={spec.message}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 16, borderRadius: 8, border: `1.5px solid ${UI.border}`, fontFamily: "inherit", resize: "vertical" }} />
            ) : (
              <input ref={inputRef} value={val} onChange={(e) => setVal(e.target.value)} aria-label={spec.message}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } }}
                placeholder={spec.placeholder || ""}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 16, borderRadius: 8, border: `1.5px solid ${UI.border}`, fontFamily: "inherit" }} />
            )}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 20px 18px", flexWrap: "wrap" }}>
          <button ref={cancelRef} onClick={cancel} style={btn("neutral")}>{cancelLabel}</button>
          <button ref={okRef} onClick={ok} style={btn(spec.danger ? "danger" : "primary")}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}
