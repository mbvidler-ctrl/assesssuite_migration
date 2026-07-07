import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

// Testing bypass — DEMO ONLY.
// One-click sign-in as a seeded synthetic account for each role, so a tester can
// see the app from each permission level without typing credentials. These are
// throwaway seed accounts on synthetic data; there is no real client information
// in this environment. This page must never ship to a production tenant with
// real users.
const ROLES = [
  {
    key: "admin",
    label: "Simulate Admin Access",
    blurb: "Platform administrator — Assessment Audit, Approvals and Analytics.",
    email: "admin@local.test",
    password: "change-me-local",
    landing: "/AdminAnalytics",
    accent: "#7c3aed",
  },
  {
    key: "clinician",
    label: "Simulate Clinician Access",
    blurb: "Exercise physiologist — clients, assessments, SOAP notes and reports.",
    email: "clinician@org-alpha.seed.test",
    password: "SeedDemo!2026",
    landing: "/Dashboard",
    accent: "#2563eb",
  },
  {
    key: "user",
    label: "Simulate User Access",
    blurb: "Practice owner (standard non-admin user) — the org owner's view.",
    email: "owner@org-alpha.seed.test",
    password: "SeedDemo!2026",
    landing: "/Dashboard",
    accent: "#0d9488",
  },
];

export default function TestingBypass() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const enterAs = async (role) => {
    setError("");
    setBusy(role.key);
    try {
      const res = await base44.auth.loginViaEmailPassword(role.email, role.password);
      const token = res && (res.access_token || res.token);
      if (token) localStorage.setItem("base44_access_token", token);
      window.location.href = role.landing || "/Dashboard";
    } catch (err) {
      setError((role.label + " failed: " + (err && err.message ? err.message : "unknown error")));
      setBusy("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%)", padding: "24px", fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: "20px", padding: "40px", maxWidth: "480px", width: "100%", boxShadow: "0 8px 48px rgba(15,23,42,0.12)", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#fef3c7", color: "#92400e", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px", padding: "6px 14px", borderRadius: "100px", marginBottom: "18px", textTransform: "uppercase" }}>Testing bypass — demo only</div>
        <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", marginBottom: "8px", letterSpacing: "-0.5px" }}>Choose a role to explore</h1>
        <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6, marginBottom: "26px" }}>Sign in instantly as a synthetic demonstration account. All data is synthetic and contained; nothing here touches real client information.</p>

        {error && (
          <div style={{ marginBottom: "18px", padding: "12px", borderRadius: "10px", background: "#fef2f2", color: "#b91c1c", fontSize: "13px" }}>{error}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {ROLES.map((role) => (
            <button
              key={role.key}
              onClick={() => enterAs(role)}
              disabled={!!busy}
              style={{ textAlign: "left", background: "#fff", border: "2px solid " + role.accent, borderRadius: "12px", padding: "16px 18px", cursor: busy ? "wait" : "pointer", opacity: busy && busy !== role.key ? 0.5 : 1, transition: "transform 0.1s, box-shadow 0.2s" }}
            >
              <div style={{ fontSize: "16px", fontWeight: 700, color: role.accent, marginBottom: "3px" }}>
                {busy === role.key ? "Signing in…" : role.label}
              </div>
              <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>{role.blurb}</div>
            </button>
          ))}
        </div>

        <button onClick={() => navigate("/")} disabled={!!busy} style={{ marginTop: "24px", background: "none", border: "none", color: "#94a3b8", fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}>Back to landing page</button>
      </div>
    </div>
  );
}
