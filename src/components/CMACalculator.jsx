import { useState, useMemo } from "react";

const FL_UPGRADES = [
  { id: "hurricane_windows",  label: "Hurricane Impact Windows",     value: 15000 },
  { id: "new_roof",           label: "New Roof (< 5 yrs)",            value: 12000 },
  { id: "solar_owned",        label: "Solar Panels (Owned)",          value: 18000 },
  { id: "updated_kitchen",    label: "Updated Kitchen (< 5 yrs)",     value: 20000 },
  { id: "updated_baths",      label: "Updated Bathrooms (< 5 yrs)",   value: 12000 },
  { id: "pool",               label: "Pool",                          value: 25000 },
  { id: "screened_lanai",     label: "Screened Lanai",                value: 8000 },
  { id: "new_hvac",           label: "New HVAC (< 5 yrs)",            value: 6000 },
  { id: "new_water_heater",   label: "New Water Heater (< 5 yrs)",    value: 1500 },
  { id: "fenced_yard",        label: "Fenced Yard",                   value: 4000 },
  { id: "cul_de_sac",         label: "Cul-de-Sac",                    value: 5000 },
  { id: "water_view",         label: "Water View / Waterfront",       value: 30000 },
  { id: "no_hoa",             label: "No HOA",                        value: 8000 },
  { id: "garage_3car",        label: "3-Car Garage",                  value: 10000 },
  { id: "fl_room",            label: "Florida Room / Sunroom",        value: 6000 },
  { id: "primary_residence",  label: "Homestead Exemption Possible",  value: 3000 },
];

function money(n) {
  if (!isFinite(n)) return "$0";
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? "-$" : "$") + abs.toLocaleString("en-US");
}

const inputStyle = {
  padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 4,
  fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box",
};

const btnStyle = (bg, color) => ({
  background: bg, color, border: "none", borderRadius: 6, padding: "8px 14px",
  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
});

function Info({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 6 }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{ background: "#dbeafe", color: "#1e3a8a", border: "none", borderRadius: "50%", width: 16, height: 16, fontSize: 10, fontWeight: 700, cursor: "pointer", lineHeight: "16px", padding: 0 }}>?</button>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "absolute", top: 20, left: 0, zIndex: 50, background: "#1f2937", color: "white", padding: "8px 12px", borderRadius: 6, fontSize: 11, lineHeight: 1.4, width: 240, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", cursor: "pointer" }}>
          {children}
        </div>
      )}
    </span>
  );
}

// Compute adjusted comp price
function computeComp(subject, comp) {
  if (!comp.soldPrice || !comp.sqft) return null;
  const basePricePerSqft = comp.soldPrice / comp.sqft;

  // Upgrade adjustments: subject HAS but comp DOESN'T → add comp's value UP toward subject
  //                     comp HAS but subject DOESN'T → subtract from comp value
  let upgradeAdj = 0;
  const adjustments = [];
  for (const u of FL_UPGRADES) {
    const subjectHas = !!(subject.upgrades && subject.upgrades[u.id]);
    const compHas = !!(comp.upgrades && comp.upgrades[u.id]);
    if (subjectHas && !compHas) {
      upgradeAdj += u.value;
      adjustments.push({ label: u.label, sign: "+", value: u.value, reason: "Subject has, comp doesn't" });
    } else if (!subjectHas && compHas) {
      upgradeAdj -= u.value;
      adjustments.push({ label: u.label, sign: "-", value: u.value, reason: "Comp has, subject doesn't" });
    }
  }

  // Custom upgrade rows
  if (subject.customUpgrades) {
    for (const cu of subject.customUpgrades) {
      if (cu.label && cu.value) {
        upgradeAdj += Number(cu.value) || 0;
        adjustments.push({ label: cu.label + " (custom)", sign: "+", value: Number(cu.value) || 0, reason: "Subject has custom upgrade" });
      }
    }
  }

  // Square footage adjustment using comp's $/sqft
  const sqftDiff = (subject.sqft || 0) - (comp.sqft || 0);
  const sqftAdj = sqftDiff * basePricePerSqft;
  if (sqftDiff !== 0) {
    adjustments.push({ label: `Sqft difference (${sqftDiff > 0 ? "+" : ""}${sqftDiff})`, sign: sqftDiff > 0 ? "+" : "-", value: Math.abs(sqftAdj), reason: `$${Math.round(basePricePerSqft)}/sqft × ${Math.abs(sqftDiff)} sqft` });
  }

  // Lot adjustment ($3/sqft of land difference)
  const lotDiff = (subject.lotSqft || 0) - (comp.lotSqft || 0);
  const lotAdj = lotDiff * 3;
  if (Math.abs(lotDiff) > 1000) {
    adjustments.push({ label: `Lot size difference (${lotDiff > 0 ? "+" : ""}${lotDiff} sqft)`, sign: lotDiff > 0 ? "+" : "-", value: Math.abs(lotAdj), reason: "Land valued at $3/sqft" });
  }

  // Age adjustment ($500/year newer)
  const ageDiff = (subject.yearBuilt || 0) - (comp.yearBuilt || 0);
  const ageAdj = ageDiff * 500;
  if (Math.abs(ageDiff) >= 5) {
    adjustments.push({ label: `Age difference (${ageDiff > 0 ? "+" : ""}${ageDiff} yrs)`, sign: ageDiff > 0 ? "+" : "-", value: Math.abs(ageAdj), reason: "$500/yr newer" });
  }

  const adjustedValue = comp.soldPrice + upgradeAdj + sqftAdj + lotAdj + ageAdj;
  return { basePricePerSqft, adjustedValue, adjustments };
}

// Subject Property tab
function SubjectTab({ subject, setSubject }) {
  const update = (k, v) => setSubject(s => ({ ...s, [k]: v }));
  const toggleUpgrade = (id) => setSubject(s => ({
    ...s, upgrades: { ...(s.upgrades || {}), [id]: !((s.upgrades || {})[id]) }
  }));
  const addCustom = () => setSubject(s => ({
    ...s, customUpgrades: [...(s.customUpgrades || []), { label: "", value: 0 }]
  }));
  const updateCustom = (i, k, v) => setSubject(s => {
    const arr = [...(s.customUpgrades || [])];
    arr[i] = { ...arr[i], [k]: v };
    return { ...s, customUpgrades: arr };
  });
  const removeCustom = (i) => setSubject(s => ({
    ...s, customUpgrades: (s.customUpgrades || []).filter((_, idx) => idx !== i)
  }));

  return (
    <div>
      <div style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#1e3a8a" }}>
        💡 <strong>Subject property:</strong> The home you're pricing. Enter specs first, then check off any upgrades. The system uses these to adjust each comp.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div>
          <label style={lbl}>Address</label>
          <input value={subject.address || ""} onChange={e => update("address", e.target.value)} style={inputStyle} placeholder="123 Main St" />
        </div>
        <div>
          <label style={lbl}>City, ZIP</label>
          <input value={subject.cityZip || ""} onChange={e => update("cityZip", e.target.value)} style={inputStyle} placeholder="Orlando, 32801" />
        </div>
        <div>
          <label style={lbl}>Beds</label>
          <input type="number" value={subject.beds || ""} onChange={e => update("beds", Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>Baths</label>
          <input type="number" step="0.5" value={subject.baths || ""} onChange={e => update("baths", Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>Living Sqft</label>
          <input type="number" value={subject.sqft || ""} onChange={e => update("sqft", Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>Lot Sqft</label>
          <input type="number" value={subject.lotSqft || ""} onChange={e => update("lotSqft", Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>Year Built</label>
          <input type="number" value={subject.yearBuilt || ""} onChange={e => update("yearBuilt", Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>Garage Spaces</label>
          <input type="number" value={subject.garage || ""} onChange={e => update("garage", Number(e.target.value))} style={inputStyle} />
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "#1f2937" }}>FL Upgrades / Features</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>Check anything the subject property has. Dollar values are FL market averages — you can override on individual comps.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
        {FL_UPGRADES.map(u => (
          <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "6px 8px", background: (subject.upgrades && subject.upgrades[u.id]) ? "#dbeafe" : "#f9fafb", borderRadius: 4, cursor: "pointer", border: "1px solid " + ((subject.upgrades && subject.upgrades[u.id]) ? "#93c5fd" : "#e5e7eb") }}>
            <input type="checkbox" checked={!!(subject.upgrades && subject.upgrades[u.id])} onChange={() => toggleUpgrade(u.id)} style={{ margin: 0 }} />
            <span style={{ flex: 1 }}>{u.label}</span>
            <span style={{ color: "#6b7280" }}>+{money(u.value)}</span>
          </label>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "#1f2937" }}>Custom Upgrades</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>Anything not in the standard list. Examples: tankless water heater, generator, smart home wiring, high-end appliances.</div>
      {(subject.customUpgrades || []).map((cu, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input value={cu.label} onChange={e => updateCustom(i, "label", e.target.value)} placeholder="Description" style={{ ...inputStyle, flex: 2 }} />
          <input type="number" value={cu.value} onChange={e => updateCustom(i, "value", Number(e.target.value))} placeholder="$ adjustment" style={{ ...inputStyle, width: 130 }} />
          <button onClick={() => removeCustom(i)} style={{ ...btnStyle("#fee2e2", "#7f1d1d"), padding: "4px 8px" }}>✕</button>
        </div>
      ))}
      <button onClick={addCustom} style={{ ...btnStyle("#e0e7ff", "#3730a3"), fontSize: 12, padding: "6px 12px" }}>+ Add Custom Upgrade</button>
    </div>
  );
}

// Single Comp editor
function CompCard({ comp, idx, onChange, onRemove, subjectUpgrades }) {
  const update = (k, v) => onChange({ ...comp, [k]: v });
  const toggleUpgrade = (id) => onChange({
    ...comp, upgrades: { ...(comp.upgrades || {}), [id]: !((comp.upgrades || {})[id]) }
  });

  const result = useMemo(() => computeComp({ upgrades: subjectUpgrades }, comp), [comp, subjectUpgrades]);
  const pricePerSqft = comp.soldPrice && comp.sqft ? comp.soldPrice / comp.sqft : 0;

  return (
    <div style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 14, marginBottom: 12, background: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: "#1f2937" }}>Comp #{idx + 1}</div>
        <button onClick={onRemove} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div style={{ gridColumn: "span 2" }}>
          <label style={lbl}>Address</label>
          <input value={comp.address || ""} onChange={e => update("address", e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>Sold Date</label>
          <input type="date" value={comp.soldDate || ""} onChange={e => update("soldDate", e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>Sold Price</label>
          <input type="number" value={comp.soldPrice || ""} onChange={e => update("soldPrice", Number(e.target.value))} style={inputStyle} placeholder="475000" />
        </div>
        <div>
          <label style={lbl}>Sqft</label>
          <input type="number" value={comp.sqft || ""} onChange={e => update("sqft", Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>$/Sqft</label>
          <input type="text" value={pricePerSqft ? "$" + Math.round(pricePerSqft) : ""} readOnly style={{ ...inputStyle, background: "#f3f4f6", color: "#1f2937", fontWeight: 700 }} />
        </div>
        <div>
          <label style={lbl}>Beds</label>
          <input type="number" value={comp.beds || ""} onChange={e => update("beds", Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>Baths</label>
          <input type="number" step="0.5" value={comp.baths || ""} onChange={e => update("baths", Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>Lot Sqft</label>
          <input type="number" value={comp.lotSqft || ""} onChange={e => update("lotSqft", Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>Year Built</label>
          <input type="number" value={comp.yearBuilt || ""} onChange={e => update("yearBuilt", Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={lbl}>DOM</label>
          <input type="number" value={comp.dom || ""} onChange={e => update("dom", Number(e.target.value))} style={inputStyle} placeholder="Days" />
        </div>
      </div>

      <details style={{ marginBottom: 8 }}>
        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151" }}>This comp has these features:</summary>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 8 }}>
          {FL_UPGRADES.map(u => (
            <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 6px", background: (comp.upgrades && comp.upgrades[u.id]) ? "#dbeafe" : "transparent", borderRadius: 3, cursor: "pointer" }}>
              <input type="checkbox" checked={!!(comp.upgrades && comp.upgrades[u.id])} onChange={() => toggleUpgrade(u.id)} style={{ margin: 0 }} />
              <span>{u.label}</span>
            </label>
          ))}
        </div>
      </details>

      {result && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: 10, fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: "#14532d", marginBottom: 4 }}>Adjusted Value: {money(result.adjustedValue)}</div>
          {result.adjustments.length > 0 && (
            <div style={{ color: "#374151", lineHeight: 1.5, fontSize: 11 }}>
              {result.adjustments.map((a, i) => (
                <div key={i}>{a.sign}{money(a.value)} — {a.label}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 2 };

export default function CMACalculator({ transactionId, token } = {}) {
  const [tab, setTab] = useState("subject");
  const [subject, setSubject] = useState({ upgrades: {}, customUpgrades: [] });
  const [comps, setComps] = useState([{ upgrades: {} }, { upgrades: {} }, { upgrades: {} }]);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState(null);

  const addComp = () => {
    if (comps.length >= 6) return;
    setComps([...comps, { upgrades: {} }]);
  };
  const updateComp = (i, c) => {
    const arr = [...comps];
    arr[i] = c;
    setComps(arr);
  };
  const removeComp = (i) => setComps(comps.filter((_, idx) => idx !== i));

  const compResults = comps
    .map(c => computeComp(subject, c))
    .filter(r => r && isFinite(r.adjustedValue));

  const summary = useMemo(() => {
    if (compResults.length === 0) return null;
    const values = compResults.map(r => r.adjustedValue).sort((a, b) => a - b);
    const min = values[0];
    const max = values[values.length - 1];
    const median = values[Math.floor(values.length / 2)];
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const avgDOM = comps.filter(c => c.dom).reduce((s, c) => s + c.dom, 0) / (comps.filter(c => c.dom).length || 1);
    const avgPSF = compResults.reduce((s, r) => s + r.basePricePerSqft, 0) / compResults.length;
    return { min, max, median, avg, avgDOM, avgPSF };
  }, [comps, subject]);

  const generatePdf = async () => {
    if (!transactionId || !token) {
      setGenMsg({ type: "error", text: "Open this calculator from inside a transaction to generate a compliance PDF." });
      return;
    }
    setGenerating(true);
    setGenMsg(null);
    try {
      const API = "https://liz-team-server-api-production.up.railway.app";
      const r = await fetch(API + "/transactions/" + transactionId + "/cma-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          subject,
          comps: comps.map((c, i) => ({ ...c, compResult: compResults[i] || null })),
          summary,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setGenMsg({ type: "success", text: "CMA saved as \"" + data.filename + "\". Open Documents tab to download/print." });
    } catch (e) {
      setGenMsg({ type: "error", text: e.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1f2937" }}>Quick CMA</h2>
      <p style={{ margin: "4px 0 16px", fontSize: 13, color: "#6b7280" }}>
        Comparative Market Analysis. Enter subject property + 3-6 comps. App computes adjusted values and suggests a list price.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "2px solid #e5e7eb" }}>
        {[
          { id: "subject", label: "🏠 Subject Property" },
          { id: "comps", label: `📊 Comps (${comps.length})` },
          { id: "result", label: "📈 Suggested Price" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: "10px 8px", background: "transparent", border: "none",
              borderBottom: tab === t.id ? "3px solid #0c4a6e" : "3px solid transparent",
              cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? "#0c4a6e" : "#6b7280", marginBottom: -2 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "subject" && <SubjectTab subject={subject} setSubject={setSubject} />}

      {tab === "comps" && (
        <div>
          <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "#78350f" }}>
            💡 <strong>Pull comps from MLS:</strong> 3-6 recently sold homes (within last 6 months, ½ mile, similar specs). Enter their sold price + specs. The system auto-adjusts for differences from your subject.
          </div>
          {comps.map((c, i) => (
            <CompCard key={i} comp={c} idx={i}
              onChange={(updated) => updateComp(i, updated)}
              onRemove={() => removeComp(i)}
              subjectUpgrades={subject.upgrades} />
          ))}
          {comps.length < 6 && (
            <button onClick={addComp} style={btnStyle("#e0e7ff", "#3730a3")}>+ Add Comp ({6 - comps.length} more allowed)</button>
          )}
        </div>
      )}

      {tab === "result" && (
        <div>
          {!summary || compResults.length === 0 ? (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 16, textAlign: "center", color: "#7f1d1d" }}>
              Add at least one comp with sold price + sqft to see suggested pricing.
            </div>
          ) : (
            <>
              <div style={{ background: "linear-gradient(135deg, #0c4a6e, #075985)", color: "white", padding: 20, borderRadius: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 13, opacity: 0.9 }}>Suggested List Price Range</div>
                <div style={{ fontSize: 32, fontWeight: 800, marginTop: 4 }}>{money(summary.min)} – {money(summary.max)}</div>
                <div style={{ fontSize: 14, opacity: 0.95, marginTop: 8 }}>
                  Recommended: <strong>{money(summary.median)}</strong> (median of {compResults.length} comps)
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.3)", paddingTop: 10 }}>
                  Avg comp $/sqft: <strong>${Math.round(summary.avgPSF)}</strong>
                  {summary.avgDOM > 0 && <> · Avg DOM: <strong>{Math.round(summary.avgDOM)} days</strong></>}
                </div>
              </div>

              <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Per-Comp Breakdown</div>
                {compResults.map((r, i) => (
                  <div key={i} style={{ borderTop: i > 0 ? "1px solid #f3f4f6" : "none", padding: "10px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span><strong>Comp #{i + 1}</strong> {comps[i].address || "(no address)"}</span>
                      <span><strong>{money(r.adjustedValue)}</strong></span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      Sold {money(comps[i].soldPrice)} · {Math.round(r.basePricePerSqft)} $/sqft · {r.adjustments.length} adjustments
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {transactionId && (
            <div style={{ marginTop: 20, padding: 16, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#78350f", marginBottom: 6 }}>📄 Generate Compliance CMA PDF</div>
              <div style={{ fontSize: 12, color: "#78350f", marginBottom: 10, lineHeight: 1.5 }}>
                Generate a branded CMA report for this transaction. Includes subject, all comps, adjustments, and recommended price. Saves to Documents under "CMA Report" for compliance.
              </div>
              <button onClick={generatePdf} disabled={generating}
                style={{ ...btnStyle(generating ? "#9ca3af" : "#0c4a6e", "white"), padding: "10px 18px" }}>
                {generating ? "Generating..." : "📄 Generate CMA PDF"}
              </button>
              {genMsg && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 6, fontSize: 12,
                  background: genMsg.type === "success" ? "#dcfce7" : "#fee2e2",
                  border: "1px solid " + (genMsg.type === "success" ? "#86efac" : "#fca5a5"),
                  color: genMsg.type === "success" ? "#14532d" : "#7f1d1d" }}>
                  {genMsg.type === "success" ? "✅ " : "⚠️ "}{genMsg.text}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
