import React, { useEffect, useRef, useState } from "react";

const API = "https://liz-team-server-api-production.up.railway.app";

// Portal sign-in from an emailed link (/portal/:token) — protected by a PIN.
// Step 1: the link is exchanged for a short-lived step token (never a session).
// Step 2: the client creates (first visit) or enters their 4-digit PIN.
// Only then does a session start — so a forwarded email alone shows nothing.
export default function PortalMagicLogin({ urlToken }) {
  const [phase, setPhase] = useState("loading"); // loading | setup | verify | error
  const [stepToken, setStepToken] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const pinRef = useRef(null);

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
        setStepToken(data.stepToken);
        setFirstName(data.firstName || "");
        setPhase(data.mode === "setup" ? "setup" : "verify");
        setTimeout(() => pinRef.current && pinRef.current.focus(), 50);
      } catch (e) {
        setError(e.message);
        setPhase("error");
      }
    })();
  }, [urlToken]);

  const submitPin = async () => {
    setNotice(null);
    if (!/^\d{4,6}$/.test(pin)) { setNotice("Your PIN should be 4 digits (up to 6)."); return; }
    if (phase === "setup" && pin !== pin2) { setNotice("Those PINs don't match — try again."); setPin(""); setPin2(""); return; }
    setBusy(true);
    try {
      const res = await fetch(API + "/auth/magic-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepToken, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "That didn't work — try again.");
      localStorage.setItem("tp_token", data.token);
      localStorage.setItem("tp_user", JSON.stringify(data.user));
      // If the link was generated from a specific deal (?tx=…), remember it so the
      // portal opens THAT property — a client on multiple deals would otherwise
      // land on whichever ranks highest, not the one their agent shared.
      try {
        const focusTx = new URLSearchParams(window.location.search).get("tx");
        if (focusTx) localStorage.setItem("tp_portal_focus_tx", focusTx);
      } catch { /* no-op */ }
      window.location.href = "/";
    } catch (e) {
      setNotice(e.message);
      setPin("");
      setBusy(false);
      setTimeout(() => pinRef.current && pinRef.current.focus(), 50);
    }
  };

  const pinInput = (value, setValue, ref, label, autoFocus) => (
    <div style={{ marginBottom: 14, textAlign: "left" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <input
        ref={ref}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(e) => { if (e.key === "Enter") submitPin(); }}
        style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", borderRadius: 10,
          border: "1.5px solid #CCC", fontSize: 24, letterSpacing: 12, textAlign: "center", fontFamily: "inherit" }}
      />
    </div>
  );

  const card = (children) => (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#F9FAFB", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 32, maxWidth: 420, width: "100%",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)", textAlign: "center" }}>{children}</div>
    </div>
  );

  if (phase === "loading") return card(<>
    <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
    <div style={{ fontWeight: 700, fontSize: 18, color: "#1A2B4A" }}>Opening your portal…</div>
    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>One moment — checking your secure link.</div>
  </>);

  if (phase === "error") return card(<>
    <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
    <div style={{ fontWeight: 700, fontSize: 17, color: "#1A2B4A", marginBottom: 10 }}>We couldn't open your portal</div>
    <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 20 }}>{error}</div>
    <a href="/" style={{ display: "inline-block", background: "#1E8449", color: "#fff", textDecoration: "none",
      fontWeight: 700, fontSize: 15, padding: "12px 26px", borderRadius: 10 }}>Go to sign-in</a>
  </>);

  const isSetup = phase === "setup";
  return card(<>
    <div style={{ fontSize: 44, marginBottom: 10 }}>{isSetup ? "🔐" : "👋"}</div>
    <div style={{ fontWeight: 800, fontSize: 19, color: "#1A2B4A", marginBottom: 6 }}>
      {isSetup ? `Welcome${firstName ? ", " + firstName : ""}! One quick step` : `Welcome back${firstName ? ", " + firstName : ""}`}
    </div>
    <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 18 }}>
      {isSetup
        ? "Create a 4-digit PIN to protect your transaction details — like a debit-card PIN. It's all you'll ever need to remember."
        : "Enter your 4-digit PIN to open your portal."}
    </div>
    {pinInput(pin, setPin, pinRef, isSetup ? "Choose your PIN" : "Your PIN", true)}
    {isSetup && pinInput(pin2, setPin2, null, "Type it once more")}
    {notice && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B",
      borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 14, textAlign: "left" }}>{notice}</div>}
    <button onClick={submitPin} disabled={busy}
      style={{ width: "100%", background: busy ? "#9CA3AF" : "#1E8449", color: "#fff", border: "none",
        fontWeight: 700, fontSize: 16, padding: "14px 0", borderRadius: 10, cursor: busy ? "default" : "pointer" }}>
      {busy ? "One moment…" : isSetup ? "Save my PIN & open portal" : "Open my portal"}
    </button>
    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 14 }}>
      {isSetup ? "You'll use this PIN every time you open a portal link." : "Forgot your PIN? Reply to any email from your agent and we'll reset it."}
    </div>
  </>);
}
