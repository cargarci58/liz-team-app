import React, { useEffect, useState } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// One-tap portal sign-in from an emailed magic link (/portal/:token).
// Exchanges the link token for a normal session, stores it exactly like the
// login screen does, and drops the client into their portal. Clients only —
// the server refuses staff accounts and we show the password screen instead.
export default function PortalMagicLogin({ urlToken }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API + "/auth/magic-exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: urlToken }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Sign-in link didn't work");
        localStorage.setItem("tp_token", data.token);
        localStorage.setItem("tp_user", JSON.stringify(data.user));
        window.location.href = "/";
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [urlToken]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#F9FAFB", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 32, maxWidth: 420, width: "100%",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)", textAlign: "center" }}>
        {!error ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#1A2B4A" }}>Opening your portal…</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>One moment — signing you in securely.</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1A2B4A", marginBottom: 10 }}>We couldn't sign you in automatically</div>
            <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 20 }}>{error}</div>
            <a href="/" style={{ display: "inline-block", background: "#1E8449", color: "#fff", textDecoration: "none",
              fontWeight: 700, fontSize: 15, padding: "12px 26px", borderRadius: 10 }}>
              Go to sign-in
            </a>
          </>
        )}
      </div>
    </div>
  );
}
