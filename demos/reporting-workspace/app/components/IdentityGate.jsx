import React, { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { api, setToken } from '../lib/api';
import { describeError, titleCase } from '../lib/format';

export default function IdentityGate({ onSession }) {
  const [identities, setIdentities] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.identities()
      .then((result) => { if (!cancelled) setIdentities(result.identities); })
      .catch((failure) => { if (!cancelled) setError(describeError(failure)); });
    return () => { cancelled = true; };
  }, []);

  const choose = async (key) => {
    setBusy(key);
    setError('');
    try {
      const session = await api.openSession(key);
      setToken(session.token);
      onSession(session.principal);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Alert className="mb-6 border-amber-300 bg-amber-50 text-amber-900">
        <AlertTitle>Demonstration workspace — synthetic data only</AlertTitle>
        <AlertDescription>
          This is a cloned workspace for the evidence-grounded reporting workflow. It runs against fixture records that describe no real person, has no real authentication, and never contacts an AI provider. Choose a demonstration identity to see how role-based admission shapes the workflow.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Choose a demonstration identity</CardTitle>
          <CardDescription>Each identity carries a role and an approval capability. Suspended and other-practice identities exist to show that admission fails closed.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {identities.map((identity) => (
            <button
              key={identity.key}
              type="button"
              onClick={() => choose(identity.key)}
              disabled={busy !== ''}
              className="rounded-lg border border-slate-200 p-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
              data-testid={`identity-${identity.key}`}
            >
              <div className="font-medium text-slate-900">{identity.display_name}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                <Badge variant="outline">{titleCase(identity.role)}</Badge>
                {identity.can_approve_reports ? <Badge variant="secondary">Can approve reports</Badge> : null}
                {identity.account_status !== 'active' ? <Badge variant="destructive">{titleCase(identity.account_status)}</Badge> : null}
              </div>
              <div className="mt-2 text-xs text-slate-500">{identity.organisation || 'No organisation membership'}</div>
            </button>
          ))}
        </CardContent>
      </Card>
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      <p className="mt-6 text-xs text-slate-500">
        <Button variant="link" className="h-auto p-0 text-xs" onClick={() => { setToken(''); window.location.reload(); }}>Clear stored session</Button>
      </p>
    </div>
  );
}
