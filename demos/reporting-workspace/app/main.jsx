import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import './styles.css';
import { api, getToken, setToken } from './lib/api';
import { titleCase } from './lib/format';
import IdentityGate from './components/IdentityGate';
import WorkspaceErrorBoundary from './components/WorkspaceErrorBoundary';
import EpisodePage from './pages/EpisodePage';
import OutputsPage from './pages/OutputsPage';
import RequestPage from './pages/RequestPage';
import SnapshotPage from './pages/SnapshotPage';

function Shell() {
  const [principal, setPrincipal] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const location = useLocation();

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api.session()
      .then((result) => { if (!cancelled) setPrincipal(result.principal); })
      .catch(() => { setToken(''); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  if (checking) return <div className="p-6 text-sm text-slate-500">Restoring the demonstration session…</div>;
  if (!principal) return <IdentityGate onSession={setPrincipal} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-amber-300 bg-amber-100 px-4 py-1 text-center text-xs text-amber-900" data-testid="synthetic-banner">
        Demonstration workspace — synthetic data only. No real patient, clinician or organisation is represented. AI drafting is unavailable by design.
      </div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-base font-semibold">AssessSuite · Reports and outputs</Link>
            <nav className="flex gap-3 text-sm">
              <Link to="/" className={location.pathname === '/' ? 'font-semibold text-blue-700' : 'text-slate-600'}>Outputs</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-xs" data-testid="principal">
            <span className="font-medium">{principal.display_name}</span>
            <Badge variant="outline">{titleCase(principal.role)}</Badge>
            {principal.can_approve_reports ? <Badge variant="secondary">Approver</Badge> : null}
            <Button size="sm" variant="ghost" onClick={() => { setToken(''); setPrincipal(null); }} data-testid="switch-identity">Switch identity</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">
        <WorkspaceErrorBoundary resetKey={location.pathname}>
          <Routes>
            <Route path="/" element={<OutputsPage principal={principal} />} />
            <Route path="/episodes/:episodeId" element={<EpisodePage principal={principal} />} />
            <Route path="/requests/:requestId" element={<RequestPage principal={principal} />} />
            <Route path="/snapshots/:snapshotId" element={<SnapshotPage principal={principal} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WorkspaceErrorBoundary>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  </React.StrictMode>,
);
