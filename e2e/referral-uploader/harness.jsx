import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import ReferralUploader from '@/components/documents/ReferralUploader';

import { harnessState } from './harness-state.js';

function recordCallback(type, value) {
  harnessState.calls.callbacks.push({
    type,
    id: value?.id || null,
    org_id: value?.org_id || null,
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <MemoryRouter>
    <div className="min-h-screen bg-slate-50 p-8">
      <ReferralUploader
        existingClients={[]}
        allAssessments={[]}
        onClientCreated={(client) => recordCallback('created', client)}
        onClientUpdated={(client) => recordCallback('updated', client)}
      />
      <Toaster duration={15_000} />
    </div>
  </MemoryRouter>,
);

globalThis.__referralAssurance.unmount = () => root.unmount();
