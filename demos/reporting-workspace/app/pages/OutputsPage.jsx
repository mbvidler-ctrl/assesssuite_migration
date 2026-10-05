import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { REQUEST_STATUSES } from '@domain/reportTypes.mjs';

import { api } from '../lib/api';
import { describeError, formatDate, recipientRoleLabel, statusLabel } from '../lib/format';
import { CompletenessChips, StatusBadge } from '../components/StatusBadge';

export default function OutputsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.requests({ status }), api.episodes()])
      .then(([requestResult, episodeResult]) => {
        if (cancelled) return;
        setRequests(requestResult.requests);
        setEpisodes(episodeResult.episodes);
      })
      .catch((failure) => { if (!cancelled) setError(describeError(failure)); });
    return () => { cancelled = true; };
  }, [status]);

  const overdue = (requests || []).filter((entry) => entry.is_overdue).length;

  return (
    <div className="space-y-6" data-testid="outputs-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports and outputs</h1>
          <p className="text-sm text-slate-600">Every formal output begins as a request. Status, owner, due date and evidence completeness are visible before any draft exists.</p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-slate-600">Status</span>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} data-testid="status-filter">
            <option value="">All</option>
            {Object.values(REQUEST_STATUSES).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </label>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {overdue > 0 ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800" data-testid="overdue-banner">{overdue} request{overdue === 1 ? ' is' : 's are'} past the due date.</p> : null}
      <Card>
        <CardContent className="p-0">
          <Table data-testid="requests-table">
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Report</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests === null ? (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-500">Loading…</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-500">No report requests match this filter.</TableCell></TableRow>
              ) : requests.map((entry) => (
                <TableRow key={entry.id} className="cursor-pointer" onClick={() => navigate(`/requests/${encodeURIComponent(entry.id)}`)} data-request-id={entry.id}>
                  <TableCell>
                    <div className="font-medium">{entry.client_display_name}</div>
                    <div className="text-xs text-slate-500">{entry.physio_care_episode_id}</div>
                  </TableCell>
                  <TableCell>
                    <div>{entry.report_label}</div>
                    <div className="text-xs text-slate-500">{entry.purpose}</div>
                  </TableCell>
                  <TableCell>
                    <div>{entry.recipient?.name}</div>
                    <div className="text-xs text-slate-500">{recipientRoleLabel(entry.recipient?.role)}</div>
                  </TableCell>
                  <TableCell>{entry.owner?.display_name || entry.owner?.id || '—'}</TableCell>
                  <TableCell>
                    <span className={entry.is_overdue ? 'font-semibold text-red-700' : ''}>{formatDate(entry.due_date)}</span>
                    {entry.is_overdue ? <Badge variant="destructive" className="ml-1">Overdue</Badge> : null}
                  </TableCell>
                  <TableCell><StatusBadge status={entry.status} /></TableCell>
                  <TableCell><CompletenessChips summary={entry.completeness_summary} blockingGaps={entry.blocking_gaps} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Care episodes</CardTitle>
          <CardDescription>Open an episode to inspect its evidence and request a report from that context.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 md:grid-cols-2" data-testid="episode-list">
            {episodes.map((episode) => (
              <li key={episode.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{episode.client_display_name}</div>
                    <div className="text-sm text-slate-600">{episode.title}</div>
                    <div className="text-xs text-slate-500">{episode.presenting_problem}</div>
                  </div>
                  {episode.synthetic ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">Synthetic</Badge> : null}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{episode.request_count} request{episode.request_count === 1 ? '' : 's'} · {episode.approved_request_count} approved</span>
                  <Button asChild size="sm" variant="outline"><Link to={`/episodes/${encodeURIComponent(episode.id)}`}>Open episode workspace</Link></Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
