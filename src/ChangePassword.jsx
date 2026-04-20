const API = "https://liz-team-server-api-production.up.railway.app";

export default function ChangePassword({ onClose }) {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const current = e.target.current.value;
    const newPwd = e.target.newPwd.value;
    const confirm = e.target.confirm.value;
    const err = document.getElementById("cp-error");
    const success = document.getElementById("cp-success");
    const btn = document.getElementById("cp-btn");
    err.textContent = ""; success.textContent = "";

    if (newPwd !== confirm) { err.textContent = "New passwords do not match"; return; }
    if (newPwd.length < 8) { err.textContent = "Password must be at least 8 characters"; return; }

    btn.textContent = "Saving..."; btn.disabled = true;
    try {
      const tok = localStorage.getItem("tp_token") || "";
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
        body: JSON.stringify({ currentPassword: current, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) { err.textContent = data.error || "Failed to change password"; btn.textContent = "Save Password"; btn.disabled = false; return; }
      success.textContent = "Password changed successfully!";
      setTimeout(() => onClose(), 1500);
    } catch { err.textContent = "Connection error. Try again."; btn.textContent = "Save Password"; btn.disabled = false; }
  };

  const inp = { width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #CCC", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box", display: "block", marginBottom: 14 };
  const lbl = { fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ background: "#111", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>🔒 Change Password</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <div id="cp-error" style={{ color: "#C0392B", fontSize: 13, marginBottom: 8, minHeight: 18 }}></div>
          <div id="cp-success" style={{ color: "#1E8449", fontSize: 13, marginBottom: 8, minHeight: 18 }}></div>
          <form onSubmit={handleSubmit}>
            <label style={lbl}>Current Password</label>
            <input name="current" type="password" required style={inp} placeholder="Your current password" autoComplete="current-password" />
            <label style={lbl}>New Password</label>
            <input name="newPwd" type="password" required style={inp} placeholder="Min 8 characters" autoComplete="new-password" />
            <label style={lbl}>Confirm New Password</label>
            <input name="confirm" type="password" required style={inp} placeholder="Repeat new password" autoComplete="new-password" />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" onClick={onClose} style={{ padding: "10px 18px", border: "1px solid #CCC", borderRadius: 8, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>Cancel</button>
              <button id="cp-btn" type="submit" style={{ padding: "10px 20px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>Save Password</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
