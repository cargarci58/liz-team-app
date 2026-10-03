// ═══════════════════════════════════════════════════════════════
// Company / LLC / trust signers (Carlos 10/2): when a buyer or seller is an
// entity, the contract stays in the ENTITY's name but a PERSON signs for it.
// The signing link goes to that person; their own signature and initials are
// stamped, with "for ABC LLC, Managing Member" under the signature.
//
// Row shape used by every signer list: { name, email, isEntity?, entity?, title? }
//   name   = the PERSON who signs (what the e-sign engine stamps / greets)
//   entity = company / LLC / trust name (what the contract says)
// ═══════════════════════════════════════════════════════════════
import { t as tr } from "../i18n";
import { UI } from "./kit";

export const ENTITY_RE = /\b(L\.?L\.?C|L\.?L\.?P|L\.?P|Inc|Incorporated|Corp|Corporation|Company|Co|Ltd|Limited|P\.?A|P\.?L\.?L\.?C|Trust|Trustees?|Holdings|Properties|Investments?|Ventures|Group|Partners(hip)?|Enterprises|Estate of)\b\.?/i;
export const looksLikeEntity = (name) => ENTITY_RE.test(String(name || ""));

// Turn a suggested signer whose name is a company into an entity row:
// the company moves to `entity`, the person's name is left for the agent.
export function entityAwareRow(r) {
  if (!r || r.isEntity != null) return r;
  if (looksLikeEntity(r.name)) return { ...r, isEntity: true, entity: r.name, name: "", title: r.title || "" };
  return { ...r, isEntity: false };
}

// Ready-to-send signer: { name, email, entity?, title? } — entity only when on.
export function signerPayload(r) {
  const out = { name: (r.name || "").trim(), email: (r.email || "").trim() };
  if (r.isEntity && (r.entity || "").trim()) { out.entity = r.entity.trim(); out.title = (r.title || "").trim(); }
  return out;
}

// What's missing on an entity row (for the send button's validation).
export function entityRowProblem(r) {
  if (!r.isEntity) return null;
  if (!(r.entity || "").trim()) return "Enter the company / trust name.";
  if (!(r.name || "").trim()) return `Enter the name of the person signing for ${r.entity}.`;
  return null;
}

const TITLES = ["Managing Member", "Member", "Manager", "President", "Vice President", "CEO", "Owner", "Trustee", "Authorized Signer", "Partner", "Personal Representative"];

export default function SignerEntityFields({ row, onChange, compact = false }) {
  const set = (k, v) => onChange({ ...row, [k]: v });
  const inp = { flex: 1, minWidth: 0, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit" };
  return (
    <div style={{ marginTop: compact ? 4 : 6 }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: UI.blue, cursor: "pointer" }}>
        <input type="checkbox" checked={!!row.isEntity}
          onChange={e => onChange(e.target.checked
            ? { ...row, isEntity: true, entity: row.entity || (looksLikeEntity(row.name) ? row.name : ""), name: looksLikeEntity(row.name) ? "" : row.name }
            : { ...row, isEntity: false, name: row.name || row.entity || "", entity: "", title: "" })} />
        {tr("🏢 Signing for a company, LLC, or trust")}
      </label>
      {row.isEntity && (
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 8, padding: 8, marginTop: 6 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <input value={row.entity || ""} onChange={e => set("entity", e.target.value)} placeholder={tr("Company / LLC / trust name (as on the contract)")} aria-label={tr("Company, LLC, or trust name")} style={{ ...inp, flexBasis: "100%" }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input list="tp-signer-titles" value={row.title || ""} onChange={e => set("title", e.target.value)} placeholder={tr("Their title (e.g. Managing Member)")} aria-label={tr("Signer's title")} style={inp} />
            <datalist id="tp-signer-titles">{TITLES.map(t => <option key={t} value={t} />)}</datalist>
          </div>
          <div style={{ fontSize: 11.5, color: UI.muted, marginTop: 6, lineHeight: 1.45 }}>
            {tr("Put the")} <b>{tr("person who signs")}</b> {tr("in the name box above. They sign and initial with their own name; the contract stays in the company's name, and \"for")} {row.entity || tr("the company")}{row.title ? ", " + tr(row.title) : ""}{tr("\" prints under their signature.")}
          </div>
        </div>
      )}
    </div>
  );
}
