import React from "react";
import { useAuth } from "@/lib/AuthContext";

export default function CreateAccount() {
  const { navigateToLogin } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: '20px', padding: '56px 48px', maxWidth: '500px', width: '100%', textAlign: 'center', boxShadow: '0 4px 40px rgba(15,23,42,0.10)', border: '1px solid #e2e8f0' }}>
        
        <img src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/358c0c514_Logo-Transparent1.png" alt="AssessSuite Clinical" style={{ height: '56px', marginBottom: '28px' }} />
        
        <div style={{ background: '#dcfce7', color: '#16a34a', fontSize: '13px', fontWeight: 700, padding: '6px 16px', borderRadius: '100px', display: 'inline-block', marginBottom: '20px' }}>
          âœ“ Subscription confirmed
        </div>

        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', marginBottom: '12px', letterSpacing: '-0.5px', lineHeight: 1.3 }}>
          Create your account to get started
        </h1>
        
        <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '32px', lineHeight: 1.7 }}>
          You're one step away from accessing AssessSuite Clinical. Click below to create your login â€” use the same email you used at checkout.
        </p>

        <button
          onClick={navigateToLogin}
          style={{ width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', padding: '16px', fontSize: '17px', fontWeight: 700, cursor: 'pointer', marginBottom: '16px' }}
        >
          Create My Account â†’
        </button>

        <p style={{ fontSize: '13px', color: '#94a3b8' }}>
          On the next screen, click <strong style={{ color: '#374151' }}>"Need an account? Sign up"</strong> to register.
        </p>

        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            Already have an account? <button onClick={navigateToLogin} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}