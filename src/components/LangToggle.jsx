import React from "react";
import { useLang, setLang, saveLangToAccount, saveStaffLang } from "../i18n";

// EN | ES switch for client-facing screens. `account` = also save the choice
// on the signed-in client's account so emails and texts follow it.
// persist=false (agent previewing a client's portal) changes only this screen.
// staff = agent / TC header: saves their own screen language and reloads.
export default function LangToggle({ account = false, persist = true, staff = false, style }) {
  const lang = useLang();
  const pick = (l) => {
    if (l === lang) return;
    if (staff) { saveStaffLang(l); return; }
    setLang(l, { persist });
    if (account) saveLangToAccount(l);
  };
  const b = (l, label, aria) => (
    <button type="button" onClick={() => pick(l)} aria-pressed={lang === l} aria-label={aria} lang={l}
      style={{
        border: "none", background: lang === l ? "#0c4a6e" : "transparent", color: lang === l ? "#fff" : "#0c4a6e",
        fontWeight: 700, fontSize: 12.5, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
      }}>{label}</button>
  );
  return (
    <div role="group" aria-label="Language / Idioma"
      style={{ display: "inline-flex", gap: 2, padding: 2, border: "1.5px solid #0c4a6e", borderRadius: 8, background: "#fff", ...style }}>
      {b("en", "EN", "English")}
      {b("es", "ES", "Español")}
    </div>
  );
}
