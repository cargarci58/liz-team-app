// Pull ONE dialable number out of a phone field that may hold two numbers, an
// extension, or formatting — otherwise tel: gets a 14+ digit blob and won't dial.
export function telHref(raw) {
  if (!raw) return "";
  const s = String(raw);
  // first phone-like run (stops at a delimiter such as "/" "," ";" "or")
  const m = s.match(/\+?\d[\d().\-\s]{6,}\d/);
  let cleaned = (m ? m[0] : s).replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length > 11) { // two numbers ran together — keep the first
    const take = digits[0] === "1" ? 11 : 10;
    cleaned = (cleaned[0] === "+" ? "+" : "") + digits.slice(0, take);
  }
  return cleaned;
}
