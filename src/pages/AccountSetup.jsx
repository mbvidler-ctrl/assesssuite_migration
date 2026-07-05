import React from "react";
import { useAuth } from "@/lib/AuthContext";

export default function AccountSetup() {
  const { navigateToLogin } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const paymentSuccess = params.get('payment') === 'success';

  const steps = [
    {
      number: "1",
      title: "Create Your Account",
      desc: "Set up your login credentials to access the platform.",
      active: true,
    },
    {
      number: "2",
      title: "Select Your Subscription",
      desc: "Choose the subscription plan that best suits your needs.",
      active: false,
    },
    {
      number: "3",
      title: "Access Your Dashboard",
      desc: "Begin using assessments, SOAP notes, outcome measures, reports, and clinical tools.",
      active: false,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "560px", width: "100%" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <img
            src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/358c0c514_Logo-Transparent1.png"
            alt="AssessSuite Clinical"
            style={{ height: "60px", width: "auto" }}
          />
        </div>

        {/* Success banner */}
        {paymentSuccess && (
          <div style={{ background: "#d1fae5", border: "2px solid #10b981", borderRadius: "12px", padding: "16px 20px", marginBottom: "24px", textAlign: "center" }}>
            <p style={{ color: "#065f46", fontWeight: 700, fontSize: "16px", margin: "0 0 4px 0" }}>🎉 Payment successful!</p>
            <p style={{ color: "#047857", fontSize: "14px", margin: 0 }}>Now create your account to access the platform.</p>
          </div>
        )}

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: "20px", padding: "48px 40px", boxShadow: "0 8px 48px rgba(15,23,42,0.1)" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", marginBottom: "8px", letterSpacing: "-0.5px", textAlign: "center" }}>
            Create Your AssessSuite Clinical Account
          </h1>
          <p style={{ fontSize: "15px", color: "#64748b", textAlign: "center", marginBottom: "36px", lineHeight: 1.6 }}>
            Follow these simple steps to get started with AssessSuite Clinical.
          </p>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "36px" }}>
            {steps.map((step) => (
              <div key={step.number} style={{ display: "flex", gap: "16px", alignItems: "flex-start", background: step.active ? "#eff6ff" : "#f8fafc", border: `2px solid ${step.active ? "#2563eb" : "#e2e8f0"}`, borderRadius: "12px", padding: "18px 20px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: step.active ? "#2563eb" : "#e2e8f0", color: step.active ? "#fff" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "16px", flexShrink: 0 }}>
                  {step.number}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: step.active ? "#0f172a" : "#64748b", fontSize: "15px", marginBottom: "4px" }}>{step.title}</div>
                  <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Instructional text */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px 18px", marginBottom: "28px", fontSize: "14px", color: "#475569", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 8px 0" }}><strong style={{ color: "#0f172a" }}>New User?</strong> Enter your email address and create a password to set up your AssessSuite Clinical account.</p>
            <p style={{ margin: 0 }}><strong style={{ color: "#0f172a" }}>Already Have an Account?</strong> Log in using your existing email and password.</p>
          </div>

          <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", marginBottom: "24px" }}>
            AssessSuite Clinical is a professional assessment and reporting platform for Exercise Physiologists and allied health professionals. Creating an account takes less than a minute.
          </p>

          {/* CTA */}
          <button
            onClick={navigateToLogin}
            style={{ width: "100%", background: "#2563eb", color: "#fff", border: "none", borderRadius: "12px", padding: "18px", fontSize: "17px", fontWeight: 800, cursor: "pointer", letterSpacing: "-0.3px" }}
          >
            Continue to Account Creation →
          </button>

          <p style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: "#94a3b8" }}>
            By creating an account you agree to our{" "}
            <a href="https://assesssuite.com/#terms" style={{ color: "#2563eb", textDecoration: "none" }}>Terms of Service</a>
            {" "}and{" "}
            <a href="https://assesssuite.com/#privacy-policy" style={{ color: "#2563eb", textDecoration: "none" }}>Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}