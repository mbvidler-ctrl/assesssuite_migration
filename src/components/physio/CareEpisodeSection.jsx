import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function CareEpisodeSection({ icon: Icon, title, description, action = null, children, tone = 'teal' }) {
  const iconTone = tone === 'amber'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : tone === 'violet'
      ? 'bg-violet-50 text-violet-700 border-violet-200'
      : 'bg-teal-50 text-teal-700 border-teal-200';

  return (
    <Card className="border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`rounded-xl border p-2 ${iconTone}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-900">{title}</CardTitle>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-7 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function StatusBadge({ status }) {
  const normalized = String(status || 'not recorded').replaceAll('_', ' ');
  const tones = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    achieved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    clear: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    due: 'bg-amber-50 text-amber-700 border-amber-200',
    planning: 'bg-amber-50 text-amber-700 border-amber-200',
    on_hold: 'bg-amber-50 text-amber-700 border-amber-200',
    referred: 'bg-rose-50 text-rose-700 border-rose-200',
    managed: 'bg-amber-50 text-amber-700 border-amber-200',
    discharged: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return <Badge variant="outline" className={`capitalize ${tones[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{normalized}</Badge>;
}

export function Field({ label, value, children = null, className = '' }) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {children || <p className="text-sm text-slate-800">{value || 'Not recorded'}</p>}
    </div>
  );
}
