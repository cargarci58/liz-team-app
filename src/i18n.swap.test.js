import { describe, it, expect } from "vitest";
import { setLang, addSpanish, swapQuoted } from "./i18n";

describe("swapQuoted (AI answers on Spanish screens)", () => {
  it("swaps quoted button names it knows, keeps the rest", () => {
    addSpanish({ "📇 Contacts": "📇 Contactos" });
    setLang("es", { persist: false });
    expect(swapQuoted('Vaya a "📇 Contacts" y toque "Mystery Button".')).toBe('Vaya a "📇 Contactos" y toque "Mystery Button".');
    setLang("en", { persist: false });
    expect(swapQuoted('Go to "📇 Contacts".')).toBe('Go to "📇 Contacts".');
  });
});
