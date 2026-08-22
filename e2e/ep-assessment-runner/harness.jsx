import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';

import AssessmentTestRunnerRouter from '@/components/assessments/AssessmentTestRunnerRouter';
import catalogueManifest from '../../server/catalogue/physio-catalogue-manifest.json';

import { harnessState, resetHarnessState } from './harness-state.js';

const EP_FRAIL_CANONICAL_ID = 'assessment:ep-import:691eb4e43832246976294ae4';

function loadFrozenEpAssessment() {
  const definition = catalogueManifest.canonicalAssessments.find(
    (candidate) => candidate.canonicalId === EP_FRAIL_CANONICAL_ID,
  );
  if (!definition) throw new Error(`Frozen EP assessment is missing: ${EP_FRAIL_CANONICAL_ID}`);
  return {
    ...definition.content,
    id: definition.content.source_id,
    canonical_id: definition.canonicalId,
  };
}

const client = Object.freeze({
  id: 'ep-browser-client-1',
  org_id: 'ep-browser-org-1',
  full_name: 'EP Browser Fixture',
});

function Harness() {
  const [result, setResult] = useState(null);
  const scenario = new URLSearchParams(window.location.search).get('scenario') || 'frail-zero';
  const assessment = scenario === 'unknown'
    ? { canonical_id: 'assessment:unregistered', name: 'Synthetic Unregistered Assessment' }
    : loadFrozenEpAssessment();

  const captureResult = (value) => {
    harnessState.result = JSON.parse(JSON.stringify(value));
    setResult(value);
  };

  if (result) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <h1 className="text-xl font-bold">EP runner result receipt</h1>
        <pre data-testid="assessment-result">{JSON.stringify(result, null, 2)}</pre>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <AssessmentTestRunnerRouter
        assessment={assessment}
        client={client}
        isStandaloneMode={false}
        onSave={captureResult}
        onComplete={() => {}}
        onClose={() => {}}
      />
      <Toaster duration={15_000} />
    </main>
  );
}

resetHarnessState();
globalThis.__epAssessmentBrowser = {
  snapshot() {
    return JSON.parse(JSON.stringify(harnessState));
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(<Harness />);
