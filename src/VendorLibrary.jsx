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
  "Moving Company", "Locksmith", "Other"
];

const CATEGORY_ICONS = {
  "Inspector": "🔍", "Lender": "🏦", "Title Company": "📋",
  "Insurance": "🛡️", "Attorney": "⚖️", "Pest Control": "🐛",
  "Survey": "📐", "Contractor": "🔧", "Moving Company": "🚚",
  "Locksmith": "🔑", "Other": "👤",
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

function VendorCard({ vendor, onEdit, onDelete }) {
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
          <div style={{ display: "flex", gap: 8, overflowX: "auto",
            marginBottom: 16, paddingBottom: 4, scrollbarWidth: "none" }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                style={{ padding: "7px 14px", borderRadius: 20, border: "none", whiteSpace: "nowrap",
                  background: activeCategory === cat ? COLORS.red : COLORS.white,
                  color: activeCategory === cat ? "#fff" : COLORS.gray,
                  fontWeight: activeCategory === cat ? 700 : 500,
                  fontSize: 13, cursor: "pointer" }}>
                {cat === "All" ? "All" : CATEGORY_ICONS[cat] + " " + cat}
              </button>
            ))}
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
              <VendorCard key={v.id} vendor={v} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
