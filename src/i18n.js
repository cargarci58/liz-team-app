// ═══════════════════════════════════════════════════════════════
// Client-facing language (English / Español).
//
// Only the screens a CLIENT sees use this (portal, sign / upload / confirm
// pages). Agent and TC screens stay English for now.
//
// How it works: the English text IS the key. `t("Your documents")` returns the
// Spanish from src/i18n/es.js when Spanish is on, and the English as-is when it
// isn't — or when a phrase has no Spanish yet (never a blank, never a key name).
// Placeholders: t("Hi {name}", { name }) — same braces in both languages.
//
// Which language: the client's own pick (the EN | ES switch, remembered on the
// device) → what their agent set on them ("Preferred language" on the party,
// sent by the server) → English.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import ES, { ES_PATTERNS } from "./i18n/es.js";

const STORE_KEY = "tp_lang";
const listeners = new Set();

function readStored() {
  try { const v = localStorage.getItem(STORE_KEY); return v === "es" || v === "en" ? v : null; } catch { return null; }
}

// Default is English: Spanish only when the agent marked the person Español
// (server tells the page) or the client tapped ES on this device.
let current = readStored() || "en";
try { document.documentElement.lang = current; } catch { /* no DOM in tests */ }

export function getLang() { return current; }

// persist=false: apply a server-provided preference without overriding a
// choice the client made themselves on this device.
export function setLang(lang, { persist = true } = {}) {
  const next = lang === "es" ? "es" : "en";
  if (persist) { try { localStorage.setItem(STORE_KEY, next); } catch { /* private mode */ } }
  if (next === current) return;
  current = next;
  try { document.documentElement.lang = next; } catch { /* no DOM */ }
  listeners.forEach(fn => fn());
}

// The agent's setting (or the account's saved choice) — used only when the
// client hasn't flipped the switch on this device.
export function applyPreferredLang(lang) {
  if (lang !== "es" && lang !== "en") return;
  if (readStored()) return;
  setLang(lang, { persist: false });
}

// Re-render a component when the language changes. Returns the current code.
export function useLang() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(n => n + 1);
    listeners.add(bump);
    return () => { listeners.delete(bump); };
  }, []);
  return current;
}

function fill(s, vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

// Spanish for text that comes from the deal itself (milestone and document
// names) — the server translates those once and caches them; pages pass the
// pairs in here so t() finds them like any other phrase.
const RUNTIME_ES = Object.create(null);
export function addSpanish(map) {
  if (!map || typeof map !== "object") return;
  let changed = false;
  for (const [en, es] of Object.entries(map)) {
    if (en && es && RUNTIME_ES[en] !== es) { RUNTIME_ES[en] = es; changed = true; }
  }
  if (changed && current === "es") listeners.forEach(fn => fn());
}

export function t(en, vars) {
  let s = en;
  if (current === "es" && en != null) {
    if (Object.prototype.hasOwnProperty.call(ES, en)) s = ES[en];
    else if (RUNTIME_ES[en]) s = RUNTIME_ES[en];
    else {
      const hit = ES_PATTERNS.find(([re]) => re.test(String(en)));
      if (hit) s = String(en).replace(hit[0], hit[1]);
    }
  }
  return fill(String(s == null ? "" : s), vars);
}

// Plural helper: tn(n, "{n} day", "{n} days").
export function tn(n, one, many, vars) {
  return t(Number(n) === 1 ? one : many, { n, ...(vars || {}) });
}

export const locale = () => (current === "es" ? "es-US" : "en-US");

// Dates/times in the active language. Same options as toLocaleDateString.
export function fmtDate(d, opts) {
  if (!d) return "";
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x)) return "";
  return x.toLocaleDateString(locale(), opts);
}
export function fmtTime(d, opts) {
  if (!d) return "";
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x)) return "";
  return x.toLocaleTimeString(locale(), opts || { hour: "numeric", minute: "2-digit" });
}

// Save the client's pick on their account too, so emails and texts follow it.
// Best-effort; the switch works on the device even if this fails.
const API = "https://liz-team-server-api-production.up.railway.app";
export function saveLangToAccount(lang) {
  let token = null;
  try { token = localStorage.getItem("tp_token"); } catch { /* none */ }
  if (!token) return;
  fetch(API + "/client/language", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ language: lang }),
  }).catch(() => {});
}
