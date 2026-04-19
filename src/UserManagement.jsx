import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

const C = {
  red: "#C0392B", darkRed: "#922B21", lightRed: "#FADBD8",
  black: "#111111", gray: "#555555", lightGray: "#F4F4F4",
  midGray: "#CCCCCC", white: "#FFFFFF", success: "#1E8449",
  successBg: "#D5F5E3", border: "#DDDDDD",
};

const ROLES = ["admin", "agent", "tc", "client"];
const ROLE_LABELS = { admin: "Admin", agent: "Agent", tc: "Transaction Coordinator", client: "Client" };
const ROLE_COLORS = { admin: "#C0392B", agent: "#1A5276", tc: "#B7770D", client: "#1E8449" };

export default function UserManagement({ onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "agent" });

  const tok = localStorage.getItem("tp_token") || "";
  const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + tok };

  useEffect(() => {
    fetch(`${API}/users`, { headers })
      .then(r => r.json())
      .then(d => { if (d.users) setUsers(d.users); })
      .catch(e => console.error("Load users failed:", e))
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError(""); setInviting(true);
    try {
      const res = await fetch(`${API}/auth/invite`, { method: "POST", headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invite failed"); return; }
      setUsers(prev => [...prev, { ...data.user, is_active: true, created_at: new Date().toISOString() }]);
      setSuccess(`Invite sent to ${form.email}! They'll receive their login credentials by email.`);
      setForm({ firstName: "", lastName: "", email: "", phone: "", role: "agent" });
      setShowInvite(false);
    } catch { setError("Could not send invite. Try again."); }
    finally { setInviting(false); }
  };

  const toggleActive = async (user) => {
    try {
      await fetch(`${API}/users/${user.id}`, {
        method: "PUT", headers,
        body: JSON.stringify({ role: user.role, isActive: !user.is_active, firstName: user.first_name, lastName: user.last_name, phone: user.phone }),
      });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch (e) { console.error("Toggle failed:", e); }
  };

  const changeRole = async (user, newRole) => {
    try {
      await fetch(`${API}/users/${user.id}`, {
        method: "PUT", headers,
        body: JSON.stringify({ role: newRole, isActive: user.is_active, firstName: user.first_name, lastName: user.last_name, phone: user.phone }),
      });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (e) { console.error("Role change failed:", e); }
  };

  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.midGray}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 0, width: "100%", maxWidth: 700, height: "100vh", maxHeight: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.black }}>
          <div>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 18 }}>👥 Team Management</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>{users.length} team member{users.length !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setShowInvite(true); setError(""); setSuccess(""); }}
              style={{ padding: "8px 16px", background: C.red, color: C.white, border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              + Invite User
            </button>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: C.white, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18 }}>×</button>
          </div>
        </div>

        {/* Success/Error */}
        {success && <div style={{ background: C.successBg, color: C.success, padding: "12px 24px", fontSize: 13 }}>✅ {success}</div>}
        {error && <div style={{ background: C.lightRed, color: C.darkRed, padding: "12px 24px", fontSize: 13 }}>⚠️ {error}</div>}

        {/* Invite Form */}
        {showInvite && (
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, background: C.lightGray }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: C.black }}>Invite New Team Member</div>
            <form onSubmit={handleInvite}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: "block", marginBottom: 4, textTransform: "uppercase" }}>First Name *</label>
                  <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required style={inputStyle} placeholder="Jane" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Last Name *</label>
                  <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required style={inputStyle} placeholder="Smith" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required style={inputStyle} placeholder="jane@brokerage.com" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} placeholder="407-555-0100" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.gray, display: "block", marginBottom: 4, textTransform: "uppercase" }}>Role *</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={inviting} style={{ padding: "8px 20px", background: C.red, color: C.white, border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {inviting ? "Sending..." : "Send Invite"}
                </button>
                <button type="button" onClick={() => setShowInvite(false)} style={{ padding: "8px 16px", background: "none", border: `1px solid ${C.midGray}`, borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: C.gray }}>Loading team members...</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.gray }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              <div style={{ fontWeight: 600 }}>No team members yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Click "Invite User" to add your first team member</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 580, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.lightGray }}>
                  {["Name", "Email", "Role", "Status", "Last Login", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr key={user.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : C.lightGray }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: ROLE_COLORS[user.role] || C.gray, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                          {(user.first_name?.[0] || "")}{(user.last_name?.[0] || "")}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{user.first_name} {user.last_name}</div>
                          <div style={{ fontSize: 11, color: C.gray }}>{user.phone || ""}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.gray }}>{user.email}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <select value={user.role} onChange={e => changeRole(user, e.target.value)}
                        style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontFamily: "inherit", color: ROLE_COLORS[user.role] || C.black, fontWeight: 600 }}>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 12, background: user.is_active ? C.successBg : "#F5F5F5", color: user.is_active ? C.success : C.gray }}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.gray }}>
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button onClick={() => toggleActive(user)}
                        style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: `1px solid ${user.is_active ? "#FCA5A5" : C.midGray}`, background: "none", color: user.is_active ? C.red : C.gray, cursor: "pointer", fontFamily: "inherit" }}>
                        {user.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody></table></div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", borderTop: `1px solid ${C.border}`, background: C.lightGray, fontSize: 12, color: C.gray, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>💡 Invited users receive an email with temporary login credentials</div>
          <div style={{ fontWeight: 600 }}>{users.filter(u => u.is_active).length} active · {users.filter(u => !u.is_active).length} inactive</div>
        </div>
      </div>
    </div>
  );
}
