import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SimpleBarChart, SimpleLineChart, GroupedBarChart, COLORS } from "./AnalyticsCharts";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { format, startOfMonth } from "date-fns";

const STATUS_COLORS = { green: "#10b981", yellow: "#f59e0b", red: "#ef4444", grey: "#94a3b8" };
const STATUS_LABELS = { green: "Compliant", yellow: "Partial", red: "Poor", grey: "N/A" };

export default function ComplianceAnalytics({ soapNotes, clients, conditions }) {
  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);

  // Only notes with compliance data
  const notesWithCompliance = useMemo(() =>
    soapNotes.filter(n => n.compliance?.status),
    [soapNotes]
  );

  // Overall distribution
  const statusCounts = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0, grey: 0 };
    notesWithCompliance.forEach(n => {
      if (counts[n.compliance.status] !== undefined) counts[n.compliance.status]++;
    });
    return counts;
  }, [notesWithCompliance]);

  const distributionData = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: STATUS_LABELS[key], value, fill: STATUS_COLORS[key] }));

  // Compliance over time (monthly)
  const trendData = useMemo(() => {
    const months = {};
    notesWithCompliance.forEach(n => {
      if (!n.note_date) return;
      const key = format(new Date(n.note_date), "MMM yyyy");
      if (!months[key]) months[key] = { name: key, green: 0, yellow: 0, red: 0, total: 0, date: new Date(n.note_date) };
      months[key][n.compliance.status] = (months[key][n.compliance.status] || 0) + 1;
      months[key].total++;
    });
    return Object.values(months)
      .sort((a, b) => a.date - b.date)
      .slice(-12)
      .map(m => ({ ...m, pct_green: m.total ? Math.round((m.green / m.total) * 100) : 0 }));
  }, [notesWithCompliance]);

  // Top barriers
  const barrierCounts = useMemo(() => {
    const counts = {};
    notesWithCompliance.forEach(n => {
      (n.compliance.barriers || []).forEach(b => { counts[b] = (counts[b] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [notesWithCompliance]);

  // Most common actions
  const actionCounts = useMemo(() => {
    const counts = {};
    notesWithCompliance.forEach(n => {
      (n.compliance.actions_taken || []).forEach(a => { counts[a] = (counts[a] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [notesWithCompliance]);

  const complianceRate = notesWithCompliance.length > 0
    ? Math.round((statusCounts.green / notesWithCompliance.length) * 100)
    : 0;

  if (notesWithCompliance.length === 0) {
    return (
      <Card className="bg-white/80 border-slate-200/60">
        <CardContent className="py-12 text-center text-slate-400">
          No compliance data recorded yet. Start using the Compliance section in SOAP notes to see analytics here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(statusCounts).map(([key, count]) => (
          <Card key={key} className="bg-white/80 border-slate-200/60">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[key] }} />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{count}</p>
                  <p className="text-xs text-slate-500">{STATUS_LABELS[key]}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Distribution pie-style bar */}
        <Card className="bg-white/80 border-slate-200/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Compliance Distribution
              <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">{notesWithCompliance.length} sessions</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(statusCounts).filter(([, v]) => v > 0).map(([key, count]) => {
                const pct = Math.round((count / notesWithCompliance.length) * 100);
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{STATUS_LABELS[key]}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[key] }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-center mt-4 text-2xl font-bold text-green-600">{complianceRate}% <span className="text-sm font-normal text-slate-500">compliance rate</span></p>
          </CardContent>
        </Card>

        {/* Monthly trend */}
        <Card className="bg-white/80 border-slate-200/60">
          <CardHeader><CardTitle className="text-base">Compliance Rate Over Time (%)</CardTitle></CardHeader>
          <CardContent>
            <SimpleLineChart data={trendData} dataKey="pct_green" height={220} />
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top barriers */}
        <Card className="bg-white/80 border-slate-200/60">
          <CardHeader><CardTitle className="text-base">Most Common Barriers</CardTitle></CardHeader>
          <CardContent>
            {barrierCounts.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">No barriers recorded yet</p>
            ) : (
              <div className="space-y-2">
                {barrierCounts.map(({ name, count }, i) => {
                  const pct = barrierCounts[0] ? Math.round((count / barrierCounts[0].count) * 100) : 0;
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-0.5">
                          <span className="text-slate-700">{name}</span>
                          <span className="font-semibold text-slate-600">{count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions taken */}
        <Card className="bg-white/80 border-slate-200/60">
          <CardHeader><CardTitle className="text-base">Clinician Actions Taken</CardTitle></CardHeader>
          <CardContent>
            {actionCounts.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">No actions recorded yet</p>
            ) : (
              <div className="space-y-2">
                {actionCounts.map(({ name, count }, i) => {
                  const pct = actionCounts[0] ? Math.round((count / actionCounts[0].count) * 100) : 0;
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-0.5">
                          <span className="text-slate-700">{name}</span>
                          <span className="font-semibold text-slate-600">{count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly stacked sessions */}
      {trendData.length > 1 && (
        <Card className="bg-white/80 border-slate-200/60">
          <CardHeader><CardTitle className="text-base">Monthly Compliance Breakdown</CardTitle></CardHeader>
          <CardContent>
            <GroupedBarChart data={trendData} keys={["green", "yellow", "red"]} height={260} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}