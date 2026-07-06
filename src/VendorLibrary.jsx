import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const COLORS = {
  red: "#C0392B", black: "#111111", gray: "#555555",
  lightGray: "#F4F4F4", border: "#DDDDDD", white: "#FFFFFF",
  success: "#1E8449", successBg: "#D5F5E3",
  warning: "#B7770D", warningBg: "#FEF9E7",
};

const VENDOR_CATEGORIES = [
  "Inspector", "Lender", "Title Company", "Insurance",
  "Attorney", "Pest Control", "Survey", "Contractor",
  "General Contractor", "Handyman", "Plumber", "Electrician",
  "HVAC", "Roofer", "Photographer", "Painter", "Drywall", "Pool Service", "Sign Services",
  "Moving Company", "Locksmith", "Other"
];

const CATEGORY_ICONS = {
  "Inspector": "🔍", "Lender": "🏦", "Title Company": "📋",
  "Insurance": "🛡️", "Attorney": "⚖️", "Pest Control": "🐛",
  "Survey": "📐", "Contractor": "🔧",
  "General Contractor": "👷", "Handyman": "🛠️", "Plumber": "🚰",
  "Electrician": "⚡", "HVAC": "❄️", "Roofer": "🏠", "Photographer": "📷",
  "Painter": "🎨", "Drywall": "🧱", "Pool Service": "🏊", "Sign Services": "🪧",
  "Moving Company": "🚚", "Locksmith": "🔑", "Other": "👤",
};

function VendorForm({ vendor, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: vendor?.name || "",
    company: vendor?.company || "",
    role: vendor?.role || "",
    phone: vendor?.phone || "",
    email: vendor?.email || "",
    website: vendor?.website || "",
    description: vendor?.description || "",
    category: vendor?.category || "Inspector",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.category) { alert("Name and category required"); return; }
    setSaving(true);
    const tok = localStorage.getItem("tp_token") || "";
    try {
      const url = vendor ? API + "/vendors/" + vendor.id : API + "/vendors";
      const method = vendor ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) onSave(data.vendor);
      else alert("Error: " + data.error);
    } catch (e) { alert("Error saving vendor"); }
    setSaving(false);
  };

  const field = (label, key, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray,
        textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 8,
          border: "1.5px solid " + COLORS.border, fontSize: 14,
          fontFamily: "inherit", boxSizing: "border-box" }} />
    </div>
  );

  return (
    <div style={{ background: COLORS.white, borderRadius: 16, padding: 24,
      boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>
        {vendor ? "Edit Vendor" : "Add New Vendor"}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>CATEGORY</div>
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1.5px solid " + COLORS.border, fontSize: 14,
            fontFamily: "inherit", background: COLORS.white }}>
          {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
        </select>
      </div>

      {field("Name *", "name", "text", "e.g. John Smith")}
      {field("Company", "company", "text", "e.g. ABC Inspections")}
      {field("Title / Role", "role", "text", "e.g. Senior Home Inspector")}
      {field("Phone", "phone", "tel", "e.g. 407-555-1234")}
      {field("Email", "email", "email", "e.g. john@abcinspections.com")}
      {field("Website", "website", "text", "e.g. www.abcinspections.com")}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          SHORT DESCRIPTION
        </div>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="e.g. Thorough inspections with detailed reports delivered within 24 hours."
          style={{ width: "100%", height: 80, padding: "10px 12px", borderRadius: 8,
            border: "1.5px solid " + COLORS.border, fontSize: 14,
            fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
        <div style={{ fontSize: 11, color: COLORS.gray, marginTop: 4 }}>
          This is what your clients will see when choosing a vendor.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: 13, borderRadius: 10,
            border: "1.5px solid " + COLORS.border, background: COLORS.white,
            color: COLORS.gray, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          style={{ flex: 2, padding: 13, borderRadius: 10, border: "none",
            background: COLORS.red, color: COLORS.white,
            fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          {saving ? "Saving..." : vendor ? "Save Changes" : "Add Vendor"}
        </button>
      </div>
    </div>
  );
}

// Share a vendor with people — typed-in recipients, your contacts, and/or a
// deal's parties — by email and/or text (and into the deal's in-app chat).
function ShareVendorModal({ vendor, onClose }) {
  const [chosen, setChosen] = useState([]);            // [{ key, name, email, phone, source }]
  const [channel, setChannel] = useState("email");     // "email" | "sms" | "both"
  const [message, setMessage] = useState("");
  const [txId, setTxId] = useState("");                // chosen deal → also posts to its in-app chat
  const [source, setSource] = useState(null);          // "contacts" | "deal" | null
  const [contacts, setContacts] = useState(null);
  const [deals, setDeals] = useState(null);
  const [search, setSearch] = useState("");
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPhone, setNPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const tok = localStorage.getItem("tp_token") || "";

  const has = (key) => chosen.some(c => c.key === key);
  const add = (r) => { if (!has(r.key)) setChosen(prev => [...prev, r]); };
  const remove = (key) => setChosen(prev => prev.filter(c => c.key !== key));

  const loadContacts = async () => {
    setSource("contacts");
    if (contacts !== null) return;
    try {
      const res = await fetch(API + "/contacts", { headers: { Authorization: "Bearer " + tok } });
      const d = await res.json();
      setContacts((d.contacts || []).map(c => ({
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "Contact",
        email: c.email || "", phone: c.phone || "",
      })));
    } catch { setContacts([]); }
  };
  const loadDeals = async () => {
    setSource("deal");
    if (deals !== null) return;
    try {
      const res = await fetch(API + "/transactions", { headers: { Authorization: "Bearer " + tok } });
      const d = await res.json();
      setDeals(d.transactions || []);
    } catch { setDeals([]); }
  };

  const addTyped = () => {
    if (!nEmail.trim() && !nPhone.trim()) { alert("Enter an email or phone."); return; }
    if (nEmail.trim() && !/.+@.+\..+/.test(nEmail.trim())) { alert("Enter a valid email."); return; }
    add({ key: "typed:" + (nEmail || nPhone), name: nName.trim() || nEmail.trim() || nPhone.trim(), email: nEmail.trim(), phone: nPhone.trim(), source: "typed" });
    setNName(""); setNEmail(""); setNPhone("");
  };

  const send = async () => {
    if (chosen.length === 0 && !txId) { alert("Add at least one recipient."); return; }
    setSending(true);
    try {
      const res = await fetch(API + "/vendors/" + vendor.id + "/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
        body: JSON.stringify({
          recipients: chosen.map(c => ({ name: c.name, email: c.email, phone: c.phone })),
          channel, message: message.trim(), transactionId: txId || undefined,
        }),
      });
      const d = await res.json();
      if (d.success) setResult(d.results || []);
      else alert("Share failed: " + (d.error || "unknown error"));
    } catch { alert("Server unreachable."); }
    setSending(false);
  };

  const wrap = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" };
  const card = { background: "#fff", borderRadius: 14, width: 520, maxWidth: "100%", margin: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" };
  const inp = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1.5px solid " + COLORS.border, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
  const srcBtn = (on) => ({ flex: 1, padding: "8px", borderRadius: 8, border: "1.5px solid " + (on ? COLORS.red : COLORS.border), background: on ? COLORS.red : "#fff", color: on ? "#fff" : COLORS.gray, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });

  const _matchingContacts = (contacts || []).filter(c => {
    if (!c.email && !c.phone) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (c.name || "").toLowerCase().includes(s) || (c.email || "").toLowerCase().includes(s) || (c.phone || "").includes(s);
  });
  const filteredContacts = _matchingContacts.slice(0, 50);
  const contactsHidden = _matchingContacts.length - filteredContacts.length; // shown when >0 so the cap is never silent
  const dealParties = txId && deals ? ((deals.find(t => String(t.id) === String(txId))?.parties) || []).filter(p => (p.email && p.email.trim()) || (p.phone && p.phone.trim())) : [];

  return (
    <div style={wrap} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid " + COLORS.border }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>📤 Share {vendor.name}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: COLORS.gray }}>×</button>
        </div>

        {result ? (
          <div style={{ padding: 20 }}>
            <div style={{ background: COLORS.successBg, border: "1px solid #86EFAC", borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: COLORS.success, marginBottom: 6 }}>Shared ✓</div>
              {result.map((r, i) => (
                <div key={i} style={{ color: "#374151" }}>{r.name}: {r.chat ? "💬 posted in chat" : ""}{r.email === true ? " 📧" : ""}{r.sms === true ? " 📱" : ""}{r.email === false ? " email failed" : ""}{r.sms === false ? " text failed" : ""}</div>
              ))}
            </div>
            <button onClick={onClose} style={{ marginTop: 16, width: "100%", padding: 12, borderRadius: 10, border: "none", background: COLORS.black, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Done</button>
          </div>
        ) : (
          <div style={{ padding: 20, maxHeight: "70vh", overflowY: "auto" }}>
            {/* chosen recipients */}
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray, textTransform: "uppercase", marginBottom: 6 }}>To ({chosen.length})</div>
            {chosen.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {chosen.map(c => (
                  <span key={c.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 6, padding: "3px 8px", fontSize: 12, color: "#0F2044" }}>
                    {c.name}{c.email ? " ✉️" : ""}{c.phone ? " 📱" : ""}
                    <button onClick={() => remove(c.key)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.gray, fontSize: 14, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}

            {/* recipient sources */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button style={srcBtn(source === "contacts")} onClick={loadContacts}>👥 My Contacts</button>
              <button style={srcBtn(source === "deal")} onClick={loadDeals}>🏠 A Deal's Parties</button>
              <button style={srcBtn(source === "typed")} onClick={() => setSource("typed")}>✍️ Type</button>
            </div>

            {source === "contacts" && (
              <div style={{ marginBottom: 14 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…" style={{ ...inp, marginBottom: 8 }} />
                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid " + COLORS.border, borderRadius: 8 }}>
                  {contacts === null ? <div style={{ padding: 14, color: COLORS.gray, fontSize: 13 }}>Loading…</div> :
                    filteredContacts.length === 0 ? <div style={{ padding: 14, color: COLORS.gray, fontSize: 13 }}>No contacts with an email or phone.</div> :
                    <>
                    {filteredContacts.map(c => {
                      const key = "contact:" + c.id;
                      return (
                        <div key={key} onClick={() => has(key) ? remove(key) : add({ key, name: c.name, email: c.email, phone: c.phone, source: "contacts" })}
                          style={{ padding: "8px 12px", borderBottom: "1px solid " + COLORS.lightGray, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: has(key) ? "#F0F4FF" : "#fff" }}>
                          <span style={{ fontSize: 13 }}>{c.name} <span style={{ color: COLORS.gray, fontSize: 11 }}>{c.email || c.phone}</span></span>
                          <span style={{ fontSize: 13 }}>{has(key) ? "✓" : "+"}</span>
                        </div>
                      );
                    })}
                    {contactsHidden > 0 && (
                      <div style={{ padding: "8px 12px", fontSize: 12, color: COLORS.gray, fontStyle: "italic" }}>
                        …and {contactsHidden} more match{contactsHidden === 1 ? "" : "es"} — type more of the name to narrow it down
                      </div>
                    )}
                    </>}
                </div>
              </div>
            )}

            {source === "deal" && (
              <div style={{ marginBottom: 14 }}>
                <select value={txId} onChange={e => setTxId(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
                  <option value="">{deals === null ? "Loading deals…" : "Choose a deal…"}</option>
                  {(deals || []).map(t => <option key={t.id} value={t.id}>{t.address || "Untitled deal"}</option>)}
                </select>
                {txId !== "" && (
                  <>
                    <div style={{ fontSize: 11, color: COLORS.gray, marginBottom: 6 }}>A copy also posts to this deal's in-app chat.</div>
                    <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid " + COLORS.border, borderRadius: 8 }}>
                      {dealParties.length === 0 ? <div style={{ padding: 14, color: COLORS.gray, fontSize: 13 }}>No parties with contact info on this deal.</div> :
                        dealParties.map(p => {
                          const key = "party:" + (p.id || p.email || p.phone);
                          return (
                            <div key={key} onClick={() => has(key) ? remove(key) : add({ key, name: p.name, email: p.email || "", phone: p.phone || "", source: "deal" })}
                              style={{ padding: "8px 12px", borderBottom: "1px solid " + COLORS.lightGray, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: has(key) ? "#F0F4FF" : "#fff" }}>
                              <span style={{ fontSize: 13 }}>{p.name} <span style={{ color: COLORS.red, fontSize: 11 }}>{p.role}</span></span>
                              <span style={{ fontSize: 13 }}>{has(key) ? "✓" : "+"}</span>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            )}

            {source === "typed" && (
              <div style={{ marginBottom: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input value={nName} onChange={e => setNName(e.target.value)} placeholder="Name (optional)" style={{ ...inp, flex: "1 1 100%" }} />
                <input value={nEmail} onChange={e => setNEmail(e.target.value)} placeholder="Email" style={{ ...inp, flex: "1 1 45%" }} />
                <input value={nPhone} onChange={e => setNPhone(e.target.value)} placeholder="Phone" style={{ ...inp, flex: "1 1 45%" }} />
                <button onClick={addTyped} style={{ ...srcBtn(false), flex: "1 1 100%", borderColor: COLORS.black }}>+ Add recipient</button>
              </div>
            )}

            {/* channel */}
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray, textTransform: "uppercase", marginBottom: 6 }}>Send via</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[["email", "📧 Email"], ["sms", "📱 Text"], ["both", "Both"]].map(([v, label]) => (
                <button key={v} onClick={() => setChannel(v)} style={srcBtn(channel === v)}>{label}</button>
              ))}
            </div>

            {/* optional note */}
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Add a personal note (optional)…" style={{ ...inp, resize: "vertical", marginBottom: 6 }} />
            <div style={{ fontSize: 11, color: COLORS.gray, marginBottom: 14 }}>Leave the note blank and a warm intro is added for you. The vendor's name, company, phone, email & description are always included.</div>

            <button onClick={send} disabled={sending || (chosen.length === 0 && !txId)} style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: COLORS.success, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: (sending || (chosen.length === 0 && !txId)) ? 0.5 : 1 }}>
              {sending ? "Sending…" : `Share with ${chosen.length || (txId ? "the deal" : "0")} ${chosen.length === 1 ? "person" : chosen.length ? "people" : ""}`.trim()}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function VendorCard({ vendor, onEdit, onDelete, onShare }) {
  const icon = CATEGORY_ICONS[vendor.category] || "👤";
  return (
    <div style={{ background: COLORS.white, borderRadius: 12, padding: 16,
      marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      borderLeft: "4px solid " + COLORS.red }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.black }}>{vendor.name}</div>
          {vendor.company && (
            <div style={{ fontSize: 13, color: COLORS.red, fontWeight: 600 }}>{vendor.company}</div>
          )}
          {vendor.role && (
            <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 2 }}>{vendor.role}</div>
          )}
          {vendor.description && (
            <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 6,
              lineHeight: 1.5, fontStyle: "italic" }}>"{vendor.description}"</div>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {vendor.phone && (
              <span style={{ fontSize: 12, color: COLORS.gray }}>📞 {vendor.phone}</span>
            )}
            {vendor.email && (
              <span style={{ fontSize: 12, color: COLORS.gray }}>✉️ {vendor.email}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <button onClick={() => onShare(vendor)}
            style={{ padding: "5px 12px", borderRadius: 6, border: "none",
              background: COLORS.red, color: "#fff", fontSize: 12,
              cursor: "pointer", fontWeight: 700 }}>📤 Share</button>
          <button onClick={() => onEdit(vendor)}
            style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid " + COLORS.border,
              background: COLORS.white, color: COLORS.gray, fontSize: 12,
              cursor: "pointer", fontWeight: 600 }}>Edit</button>
          <button onClick={() => onDelete(vendor)}
            style={{ padding: "5px 12px", borderRadius: 6, border: "none",
              background: COLORS.lightGray, color: COLORS.gray, fontSize: 12,
              cursor: "pointer", fontWeight: 600 }}>Remove</button>
        </div>
      </div>
    </div>
  );
}

export default function VendorLibrary({ onClose }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [sharingVendor, setSharingVendor] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    setLoading(true);
    const tok = localStorage.getItem("tp_token") || "";
    try {
      const res = await fetch(API + "/vendors", {
        headers: { Authorization: "Bearer " + tok }
      });
      const data = await res.json();
      if (data.success) setVendors(data.vendors || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSave = (vendor) => {
    if (editingVendor) {
      setVendors(prev => prev.map(v => v.id === vendor.id ? vendor : v));
    } else {
      setVendors(prev => [...prev, vendor]);
    }
    setShowForm(false);
    setEditingVendor(null);
  };

  const handleEdit = (vendor) => {
    setEditingVendor(vendor);
    setShowForm(true);
  };

  const handleDelete = async (vendor) => {
    if (!window.confirm(`Remove ${vendor.name} from your vendor library?`)) return;
    const tok = localStorage.getItem("tp_token") || "";
    try {
      await fetch(API + "/vendors/" + vendor.id, {
        method: "DELETE", headers: { Authorization: "Bearer " + tok }
      });
      setVendors(prev => prev.filter(v => v.id !== vendor.id));
    } catch (e) { alert("Error removing vendor"); }
  };

  const categories = ["All", ...VENDOR_CATEGORIES.filter(c =>
    vendors.some(v => v.category === c)
  )];

  const filtered = activeCategory === "All"
    ? vendors
    : vendors.filter(v => v.category === activeCategory);

  const grouped = filtered.reduce((acc, v) => {
    acc[v.category] = acc[v.category] || [];
    acc[v.category].push(v);
    return acc;
  }, {});

  return (
    <div style={{ position: "fixed", inset: 0, background: "#F4F4F4",
      zIndex: 2000, overflowY: "auto", fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: COLORS.black, padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onClose}
          style={{ background: "none", border: "none", color: "#fff",
            fontSize: 22, cursor: "pointer", opacity: 0.7 }}>←</button>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Preferred Vendors</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} in your library
          </div>
        </div>
        <button onClick={() => { setEditingVendor(null); setShowForm(true); }}
          style={{ marginLeft: "auto", background: COLORS.red, border: "none",
            color: "#fff", borderRadius: 10, padding: "8px 16px",
            fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          + Add Vendor
        </button>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>

        {/* Form */}
        {showForm && (
          <div style={{ marginBottom: 20 }}>
            <VendorForm
              vendor={editingVendor}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingVendor(null); }}
            />
          </div>
        )}

        {/* Category Filter */}
        {!showForm && vendors.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <select value={activeCategory} onChange={e => setActiveCategory(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1.5px solid " + COLORS.border, fontSize: 14,
                fontFamily: "inherit", fontWeight: 600, background: COLORS.white,
                color: COLORS.black, cursor: "pointer" }}>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === "All"
                    ? "All categories (" + vendors.length + ")"
                    : CATEGORY_ICONS[cat] + " " + cat + " (" + vendors.filter(v => v.category === cat).length + ")"}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: COLORS.gray }}>
            Loading vendors...
          </div>
        )}

        {/* Empty State */}
        {!loading && vendors.length === 0 && !showForm && (
          <div style={{ background: COLORS.white, borderRadius: 16, padding: 40,
            textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.black, marginBottom: 8 }}>
              Build Your Vendor Library
            </div>
            <div style={{ color: COLORS.gray, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Add your preferred inspectors, lenders, title companies, and other vendors.
              You can then assign them to transactions so your clients can choose.
            </div>
            <button onClick={() => setShowForm(true)}
              style={{ background: COLORS.red, color: "#fff", border: "none",
                borderRadius: 12, padding: "14px 32px", fontWeight: 700,
                fontSize: 16, cursor: "pointer" }}>
              + Add Your First Vendor
            </button>
          </div>
        )}

        {/* Vendor List */}
        {!loading && !showForm && Object.entries(grouped).map(([category, items]) => (
          <div key={category} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.gray,
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              {CATEGORY_ICONS[category]} {category} ({items.length})
            </div>
            {items.map(v => (
              <VendorCard key={v.id} vendor={v} onEdit={handleEdit} onDelete={handleDelete} onShare={setSharingVendor} />
            ))}
          </div>
        ))}
      </div>

      {sharingVendor && (
        <ShareVendorModal vendor={sharingVendor} onClose={() => setSharingVendor(null)} />
      )}
    </div>
  );
}
