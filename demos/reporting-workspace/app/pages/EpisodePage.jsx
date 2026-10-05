import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { api } from '../lib/api';
import { categoryLabel, describeError, formatDate } from '../lib/format';
import CompletenessPanel from '../components/CompletenessPanel';
import NewRequestDialog from '../components/NewRequestDialog';
import { CompletenessChips, StatusBadge } from '../components/StatusBadge';

function EvidenceItem({ entry }) {
  const [open, setOpen] = useState(false);
  const values = Object.entries(entry.content).filter(([, value]) => value !== '' && value !== null && value !== undefined);
  return (
    <li className="p-2 text-xs" data-source-id={entry.source_id}>
      <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOpen((current) => !current)}>
        <span>
          <span className="font-medium text-slate-800">{entry.label}</span>
          {entry.recorded_at ? <span className="ml-1 text-slate-500">{formatDate(entry.recorded_at)}</span> : null}
          {entry.ai_assisted ? <Badge variant="outline" className="ml-1 border-orange-300 bg-orange-50 text-orange-900">AI-assisted</Badge> : null}
          {entry.flags.includes('unpublished_note') ? <Badge variant="outline" className="ml-1">Unpublished</Badge> : null}
        </span>
        <span className="font-mono text-[10px] text-slate-400">{entry.content_sha256.slice(0, 10)}</span>
      </button>
      {open ? (
        <table className="demo-kv mt-2 w-full">
          <tbody>
            {values.length === 0 ? <tr><td className="italic text-slate-400">No recorded values.</td></tr> : values.map(([key, value]) => (
              <tr key={key}><th>{key.replace(/_/g, ' ')}</th><td className="whitespace-pre-wrap break-words">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </li>
  );
}

export default function EpisodePage({ principal }) {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [reportTypes, setReportTypes] = useState([]);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [demoMessage, setDemoMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.episode(episodeId), api.reportTypes()])
      .then(([workspaceResult, typesResult]) => {
        if (cancelled) return;
        setWorkspace(workspaceResult);
        setReportTypes(typesResult.report_types);
      })
      .catch((failure) => { if (!cancelled) setError(describeError(failure)); });
    return () => { cancelled = true; };
  }, [episodeId, reloadToken]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const entry of workspace?.evidence || []) {
      if (!groups.has(entry.category)) groups.set(entry.category, []);
      groups.get(entry.category).push(entry);
    }
    return [...groups.entries()];
  }, [workspace]);

  const simulate = async (change) => {
    setDemoMessage('');
    try {
      const result = await api.simulateSourceChange({ episode_id: episodeId, change });
      setDemoMessage(`Demo control applied: ${result.change} (${result.record.entity} ${result.record.id}${result.record.path ? ` ${result.record.path}` : ''}). Existing drafts and snapshots are unchanged until a clinician refreshes.`);
      setReloadToken((value) => value + 1);
    } catch (failure) {
      setDemoMessage(describeError(failure));
    }
  };

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!workspace) return <p className="text-sm text-slate-500">Loading episode workspace…</p>;

  const canAuthor = ['clinician', 'senior_clinician'].includes(principal.role);

  return (
    <div className="space-y-6" data-testid="episode-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500"><Link to="/" className="underline">Reports and outputs</Link> / Episode workspace</p>
          <h1 className="text-2xl font-semibold text-slate-900">{workspace.client.display_name}</h1>
          <p className="text-sm text-slate-600">{workspace.episode.title} · {workspace.episode.presenting_problem} · commenced {formatDate(workspace.episode.episode_start_date)}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {workspace.client.synthetic ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">Synthetic demonstration patient</Badge> : null}
            <Badge variant="outline">Episode {workspace.episode.status}</Badge>
            <Badge variant="outline">Funding: {workspace.client.funding_source?.replace(/_/g, ' ') || 'not recorded'}</Badge>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="request-report">Request a report</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Report requests for this episode</CardTitle>
            <CardDescription>Requests are the entry point for every formal output; the evidence panel shows what each report type can draw on today.</CardDescription>
          </CardHeader>
          <CardContent>
            {workspace.requests.length === 0 ? <p className="text-sm text-slate-500">No requests yet.</p> : (
              <ul className="divide-y divide-slate-100" data-testid="episode-requests">
                {workspace.requests.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <Link to={`/requests/${encodeURIComponent(entry.id)}`} className="font-medium text-blue-700 underline">{entry.report_label}</Link>
                      <div className="text-xs text-slate-500">{entry.purpose} · for {entry.recipient?.name} · due {formatDate(entry.due_date)}{entry.is_overdue ? ' (overdue)' : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CompletenessChips summary={entry.completeness_summary} blockingGaps={entry.blocking_gaps} />
                      <StatusBadge status={entry.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Evidence available today</CardTitle>
            <CardDescription>Requirement-based, per report type. Present means recorded, not verified.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={reportTypes[0]?.id || 'PHYSIO_PROGRESS_REPORT'}>
              <TabsList className="flex w-full flex-wrap">
                {reportTypes.map((type) => <TabsTrigger key={type.id} value={type.id} className="text-xs">{type.label.replace('Physiotherapy ', '')}</TabsTrigger>)}
              </TabsList>
              {reportTypes.map((type) => (
                <TabsContent key={type.id} value={type.id}>
                  <CompletenessPanel completeness={workspace.completeness_by_type[type.id]} compact />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evidence catalogue</CardTitle>
          <CardDescription>{workspace.evidence.length} addressable, content-hashed sources derived from the episode record. Identity fields are minimised before anything is pinned.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {grouped.map(([category, entries]) => (
              <div key={category} className="rounded-md border border-slate-200 bg-white">
                <h3 className="border-b border-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{categoryLabel(category)} ({entries.length})</h3>
                <ul className="divide-y divide-slate-100">{entries.map((entry) => <EvidenceItem key={entry.source_id} entry={entry} />)}</ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {canAuthor ? (
        <Card className="border-dashed border-amber-300">
          <CardHeader>
            <CardTitle className="text-base">Demonstration controls</CardTitle>
            <CardDescription>These mutate the synthetic episode record so the workflow can show that a later source change never silently alters an existing draft or approved snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => simulate('add_reassessment')} data-testid="simulate-reassessment">Add a reassessment measurement</Button>
            <Button size="sm" variant="outline" onClick={() => simulate('achieve_first_goal')} data-testid="simulate-goal">Mark the first goal achieved</Button>
            <Button size="sm" variant="outline" onClick={() => simulate('record_adherence')} data-testid="simulate-adherence">Record home-program adherence</Button>
            {demoMessage ? <p className="w-full text-xs text-slate-600" data-testid="demo-message">{demoMessage}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {dialogOpen ? (
        <NewRequestDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          workspace={workspace}
          reportTypes={reportTypes}
          defaultOwnerId={canAuthor ? principal.user_id : workspace.clinicians[0]?.id}
          onCreated={(requestId) => { setDialogOpen(false); navigate(`/requests/${encodeURIComponent(requestId)}`); }}
        />
      ) : null}
    </div>
  );
}
