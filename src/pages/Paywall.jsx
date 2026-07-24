import React from "react";
import { useAuth } from "@/lib/AuthContext";

export default function Paywall() {
  const { user, logout } = useAuth();

  const handleMonthly = () => {
    window.open('https://buy.stripe.com/8x2dRagG15Z7a15f3d24002', '_blank');
  };

  const handleAnnual = () => {
    window.open('https://buy.stripe.com/3cIbJ2fBX4V34GLbR124001', '_blank');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: '20px', padding: '56px 48px', maxWidth: '560px', width: '100%', textAlign: 'center', boxShadow: '0 4px 40px rgba(15,23,42,0.10)', border: '1px solid #e2e8f0' }}>
        <img src="/cadence-bio-clinics.svg" alt="Cadence Bio-Clinics" style={{ height: '60px', marginBottom: '32px' }} />
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '12px', letterSpacing: '-0.5px' }}>Subscribe to Get Started</h1>
        <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '40px', lineHeight: 1.7 }}>
          {user?.full_name ? `Welcome, ${user.full_name}! ` : ''}Your account is ready. Complete your subscription to access Cadence Bio-Clinics.
        </p>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button onClick={handleMonthly} style={{ flex: 1, minWidth: '200px', background: '#fff', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '24px 20px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='#2563eb'}
            onMouseLeave={e => e.currentTarget.style.borderColor='#e2e8f0'}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Monthly</div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>$55<span style={{ fontSize: '16px', fontWeight: 500, color: '#64748b' }}>/mo</span></div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>Billed monthly. Cancel anytime.</div>
          </button>

          <button onClick={handleAnnual} style={{ flex: 1, minWidth: '200px', background: '#eff6ff', border: '2px solid #2563eb', borderRadius: '12px', padding: '24px 20px', cursor: 'pointer', textAlign: 'left', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 12px', borderRadius: '100px', whiteSpace: 'nowrap' }}>BEST VALUE</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Annual</div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>$45<span style={{ fontSize: '16px', fontWeight: 500, color: '#64748b' }}>/mo</span></div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>Billed annually — $540/year. Save $120.</div>
          </button>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
          {['200+ standardised clinical assessments','Automated SOAP notes','Professional report generation','Nutrition & treatment protocol guidance','All future updates included'].map(f => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#374151' }}>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> {f}
            </li>
          ))}
        </ul>

        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
          Questions? <a href="https://demo.unimatter.com.au" style={{ color: '#2563eb', textDecoration: 'none' }}>Cadence Bio-Clinics demonstration</a> or the demonstration administrator
        </p>
        <button onClick={logout} style={{ background: 'none', border: 'none', fontSize: '13px', color: '#94a3b8', cursor: 'pointer' }}>Sign out</button>
      </div>
    </div>
  );
}