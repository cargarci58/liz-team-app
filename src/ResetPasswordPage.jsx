import { useState, useEffect } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) setError("This reset link is missing its token. Open the most recent reset email and click the button there.");
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (pw1.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (pw1 !== pw2) { setError("Passwords don\'t match."); return; }
    setSubmitting(true);
    try {
      const r = await fetch(API + "/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw1 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Reset failed");
      setDone(true);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0c4a6e", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "white", borderRadius: 12, maxWidth: 440, width: "100%", padding: 32, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#111" }}>Reset Your Password</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Choose a new password to regain access to your account.</div>
        </div>

        {done ? (
          <div>
            <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: 16, textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#14532d", marginBottom: 4 }}>✅ Password Updated</div>
              <div style={{ fontSize: 13, color: "#14532d" }}>You can now sign in with your new password.</div>
            </div>
            <a href="/" style={{ display: "block", textAlign: "center", background: "#0c4a6e", color: "white", textDecoration: "none", padding: "12px 20px", borderRadius: 6, fontWeight: 700 }}>Go to Sign In</a>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>New Password</label>
            <input type="password" value={pw1} onChange={e => setPw1(e.target.value)} required autoFocus
              placeholder="At least 8 characters"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, marginBottom: 14, boxSizing: "border-box", fontFamily: "inherit" }} />

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Confirm New Password</label>
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} required
              placeholder="Repeat your new password"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, marginBottom: 14, boxSizing: "border-box", fontFamily: "inherit" }} />

            {error && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: 10, fontSize: 13, color: "#7f1d1d", marginBottom: 14 }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={submitting || !token}
              style={{ width: "100%", background: submitting ? "#9ca3af" : "#0c4a6e", color: "white", border: "none", padding: "12px 20px", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: submitting ? "wait" : "pointer", fontFamily: "inherit" }}>
              {submitting ? "Updating..." : "Update Password"}
            </button>

            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 16, textAlign: "center" }}>
              💡 Tip: Use a unique password — don\'t reuse one from other accounts.
            </div>

            <a href="/" style={{ display: "block", textAlign: "center", marginTop: 16, fontSize: 12, color: "#0c4a6e", textDecoration: "none" }}>← Back to Sign In</a>
          </form>
        )}
      </div>
    </div>
  );
}
