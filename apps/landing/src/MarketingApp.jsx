import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LandingLive from '@/pages/LandingLive';
import MarketingLegalDocument from './MarketingLegalDocument.jsx';

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || 'https://app.assesssuite.com').replace(/\/$/, '');
const BLOCKED_BACKEND_PATH = /^\/(?:api|functions|uploads)(?:\/|$)/i;

function ExternalAppRedirect() {
  const location = useLocation();

  useEffect(() => {
    if (!BLOCKED_BACKEND_PATH.test(location.pathname)) {
      window.location.replace(`${APP_ORIGIN}${location.pathname}${location.search}${location.hash}`);
    }
  }, [location]);

  if (BLOCKED_BACKEND_PATH.test(location.pathname)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <section className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Not found</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">This route is not available here.</h1>
          <a className="mt-6 inline-block text-blue-700 underline" href="/">Return to AssessSuite</a>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" role="status">
      <p className="text-sm text-slate-600">Opening the secure AssessSuite application&hellip;</p>
    </div>
  );
}

export default function MarketingApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingLive />} />
        <Route path="/Landing" element={<Navigate to="/" replace />} />
        <Route path="/legal/:slug" element={<MarketingLegalDocument />} />
        <Route path="*" element={<ExternalAppRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
