import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Activity, BarChart3, Loader2,
  TrendingUp, UserCheck, ClipboardList, Download, ShieldCheck, Database
} from "lucide-react";
import { differenceInYears } from "date-fns";
import { SimpleBarChart, HorizBarChart } from "@/components/analytics/AnalyticsCharts";
import ComplianceAnalytics from "@/components/analytics/ComplianceAnalytics";
import ClientFunnelAnalytics from "@/components/analytics/ClientFunnelAnalytics";
import DataQualityAnalytics from "@/components/analytics/DataQualityAnalytics";
import AssessmentCoverageAnalytics from "@/components/analytics/AssessmentCoverageAnalytics";

// ── De-identification helpers ─────────────────────────────────────────────

const AGE_BANDS = [
  { label: "Under 18", min: 0, max: 17 },
  { label: "18–29", min: 18, max: 29 },
  { label: "30–44", min: 30, max: 44 },
  { label: "45–59", min: 45, max: 59 },
  { label: "60–69", min: 60, max: 69 },
  { label: "70–79", min: 70, max: 79 },
  { label: "80+", min: 80, max: 999 },
];

function getAgeBand(dob) {
  if (!dob) return "Unknown";
  const age = differenceInYears(new Date(), new Date(dob));
  const band = AGE_BANDS.find(b => age >= b.min && age <= b.max);
  return band ? band.label : "Unknown";
}

function normaliseFunding(raw) {
  if (!raw) return "Unknown";
  const map = {
    dva: "DVA", ndis: "NDIS", workcover_qld: "Rehab / WorkCover",
    tac_maic: "Rehab / WorkCover", medicare: "Medicare",
    private_health: "Private Health", self_funded: "Self-Funded",
    aged_care: "Aged Care", my_aged_care: "Aged Care", other: "Other"
  };
  return map[raw] || "Other";
}

function toCounts(arr, key) {
  return arr.reduce((acc, item) => {
    const v = item[key] || "Unknown";
    acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {});
}

function toChartData(countObj) {
  return Object.entries(countObj)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

const EXPORT_MIN_GROUP = 10;
const COLORS = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

// ── Reusable components ───────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [clientAssessments, setClientAssessments] = useState([]);
  const [assessmentDefs, setAssessmentDefs] = useState([]);
  const [soapNotes, setSoapNotes] = useState([]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const user = await base44.auth.me();
      setCurrentUser(user);

      if (user.role !== 'admin') {
        setIsLoading(false);
        return;
      }

      const [cls, conds, cas, defs, notes] = await Promise.all([
        base44.entities.Client.list(),
        base44.entities.ClientCondition.list(),
        base44.entities.ClientAssessment.list(),
        base44.entities.Assessment.list(),
        base44.entities.SOAPNote.list(),
      ]);
      setClients(cls || []);
      setConditions(conds || []);
      setClientAssessments(cas || []);
      setAssessmentDefs(defs || []);
      setSoapNotes(notes || []);
      setIsLoading(false);
    })();
  }, []);

  const defMap = useMemo(() =>
    Object.fromEntries(assessmentDefs.map(d => [d.id, d])),
    [assessmentDefs]
  );

  const deidentifiedClients = useMemo(() => clients.map(c => ({
    age_group: getAgeBand(c.date_of_birth),
    gender: c.gender ? c.gender.replace(/_/g, " ") : "Unknown",
    funding: normaliseFunding(c.funding_source),
  })), [clients]);

  // Population charts — no suppression for dashboard
  const ageChartData = toChartData(toCounts(deidentifiedClients, "age_group"));
  const genderChartData = toChartData(toCounts(deidentifiedClients, "gender"));
  const fundingChartData = toChartData(toCounts(deidentifiedClients, "funding"));

  // Conditions
  const allConditionCounts = toCounts(conditions.filter(c => c.condition_name), "condition_name");
  const allConditionsChartData = Object.entries(allConditionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  // Assessment usage — skip unmapped, no suppression
  const assessmentCounts = useMemo(() => {
    return clientAssessments.reduce((acc, ca) => {
      const name = defMap[ca.assessment_id]?.name;
      if (!name) return acc;
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
  }, [clientAssessments, defMap]);

  const assessmentChartData = Object.entries(assessmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  const unknownCount = clientAssessments.filter(ca => !defMap[ca.assessment_id]).length;

  // Results by age band
  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);

  const resultsByAssessment = useMemo(() => {
    const result = {};
    clientAssessments.forEach(ca => {
      if (ca.result_value == null) return;
      const name = defMap[ca.assessment_id]?.name;
      if (!name) return;
      const ageBand = getAgeBand(clientMap[ca.client_id]?.date_of_birth);
      if (!result[name]) result[name] = {};
      if (!result[name][ageBand]) result[name][ageBand] = [];
      result[name][ageBand].push(ca.result_value);
    });
    return result;
  }, [clientAssessments, defMap, clientMap]);

  const topAssessmentsWithResults = Object.entries(resultsByAssessment)
    .filter(([, bands]) => Object.values(bands).some(arr => arr.length > 0))
    .slice(0, 15);

  // Export helpers (suppression applied here only)
  function buildExportRows() {
    return deidentifiedClients.map(c => ({ age_group: c.age_group, gender: c.gender, funding: c.funding }));
  }
  function buildConditionExportRows() {
    return allConditionsChartData
      .filter(d => d.count >= EXPORT_MIN_GROUP)
      .map(({ name, count }) => ({ condition: name, client_count: count }));
  }
  function buildAssessmentExportRows() {
    return assessmentChartData
      .filter(d => d.count >= EXPORT_MIN_GROUP)
      .map(({ name, count }) => ({ assessment: name, times_run: count }));
  }
  function buildComplianceExportRows() {
    return soapNotes
      .filter(n => n.compliance?.status)
      .map(n => ({
        compliance_status: n.compliance.status,
        frequency: n.compliance.frequency || "",
        barriers: (n.compliance.barriers || []).join("; "),
        actions_taken: (n.compliance.actions_taken || []).join("; "),
      }));
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldCheck className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
            <p className="text-slate-600">You need admin privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-blue-600" /> Clinical Analytics
            </h1>
            <p className="text-slate-500 mt-1">Aggregated, de-identified data across all clinicians and clients</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>No identifiable client data. Exports suppress groups &lt;{EXPORT_MIN_GROUP}.</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Clients" value={clients.length} color="blue" />
          <StatCard icon={UserCheck} label="Assessments Run" value={clientAssessments.length} color="green" />
          <StatCard icon={ClipboardList} label="Unique Assessments Used" value={Object.keys(assessmentCounts).length} color="purple" />
          <StatCard icon={TrendingUp} label="Conditions Recorded" value={conditions.length} color="orange" />
        </div>

        {unknownCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-amber-800">
            <Database className="w-4 h-4 shrink-0" />
            <span><strong>{unknownCount}</strong> assessment records have unmapped definitions. See Data Quality tab.</span>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="population">
          <TabsList className="bg-white/70 border border-slate-200 flex-wrap h-auto gap-0.5">
            <TabsTrigger value="population">Population</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            <TabsTrigger value="assessments">Assessment Usage</TabsTrigger>
            <TabsTrigger value="coverage">Coverage</TabsTrigger>
            <TabsTrigger value="results">Results by Age</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="funnel">Client Funnel</TabsTrigger>
            <TabsTrigger value="quality">Data Quality</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          {/* POPULATION */}
          <TabsContent value="population" className="mt-4">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-white/80 border-slate-200/60">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" />Age Distribution</CardTitle></CardHeader>
                <CardContent><SimpleBarChart data={ageChartData} /></CardContent>
              </Card>
              <Card className="bg-white/80 border-slate-200/60">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-purple-600" />Gender Distribution</CardTitle></CardHeader>
                <CardContent><SimpleBarChart data={genderChartData} /></CardContent>
              </Card>
              <Card className="bg-white/80 border-slate-200/60">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-orange-600" />Funding Source</CardTitle></CardHeader>
                <CardContent><SimpleBarChart data={fundingChartData} /></CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* CONDITIONS */}
          <TabsContent value="conditions" className="mt-4">
            <Card className="bg-white/80 border-slate-200/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-600" />Top 20 Conditions (all types)
                  <Badge variant="outline" className="ml-2 text-xs">{conditions.length} total recorded</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HorizBarChart data={allConditionsChartData} height={Math.max(240, allConditionsChartData.length * 22)} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ASSESSMENT USAGE */}
          <TabsContent value="assessments" className="mt-4">
            <div className="space-y-4">
              <Card className="bg-white/80 border-slate-200/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="w-4 h-4 text-green-600" />Top 20 Most-Run Assessments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HorizBarChart data={assessmentChartData} height={Math.max(300, assessmentChartData.length * 22)} />
                </CardContent>
              </Card>
              <Card className="bg-white/80 border-slate-200/60">
                <CardContent className="pt-4">
                  {assessmentChartData.length === 0 ? (
                    <p className="text-slate-400 text-sm py-6 text-center">No assessment data recorded yet</p>
                  ) : (
                    <div className="space-y-2">
                      {assessmentChartData.map(({ name, count }, idx) => {
                        const pct = assessmentChartData[0] ? (count / assessmentChartData[0].count) * 100 : 0;
                        return (
                          <div key={name} className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              idx === 0 ? "bg-yellow-100 text-yellow-800" :
                              idx === 1 ? "bg-slate-100 text-slate-600" :
                              idx === 2 ? "bg-orange-100 text-orange-600" :
                              "bg-blue-50 text-blue-600"
                            }`}>{idx + 1}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
                                <span className="text-sm font-bold text-slate-600 ml-2 shrink-0">{count}×</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${pct}%` }} />
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
          </TabsContent>

          {/* ASSESSMENT COVERAGE */}
          <TabsContent value="coverage" className="mt-4">
            <AssessmentCoverageAnalytics
              clients={clients}
              clientAssessments={clientAssessments}
              assessmentDefs={assessmentDefs}
              conditions={conditions}
            />
          </TabsContent>

          {/* RESULTS BY AGE */}
          <TabsContent value="results" className="mt-4">
            <div className="space-y-4">
              {topAssessmentsWithResults.length === 0 && (
                <Card className="bg-white/80 border-slate-200/60">
                  <CardContent className="py-12 text-center text-slate-400">
                    No assessment results recorded yet.
                  </CardContent>
                </Card>
              )}
              {topAssessmentsWithResults.map(([name, bands]) => {
                const def = assessmentDefs.find(d => d.name === name);
                const rows = Object.entries(bands)
                  .filter(([, arr]) => arr.length > 0)
                  .sort((a, b) => {
                    const order = AGE_BANDS.map(b => b.label);
                    return order.indexOf(a[0]) - order.indexOf(b[0]);
                  })
                  .map(([band, arr]) => ({
                    band,
                    n: arr.length,
                    avg: (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1),
                    min: Math.min(...arr).toFixed(1),
                    max: Math.max(...arr).toFixed(1),
                  }));
                if (!rows.length) return null;
                return (
                  <Card key={name} className="bg-white/80 border-slate-200/60">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <ClipboardList className="w-4 h-4 text-purple-600" />
                        {name}
                        {def?.unit_of_measure && <span className="text-xs text-slate-400 font-normal">({def.unit_of_measure})</span>}
                        <Badge variant="outline" className="text-xs">{rows.reduce((s, r) => s + r.n, 0)} results</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b border-slate-100">
                            <th className="pb-2 font-medium text-slate-600">Age Band</th>
                            <th className="pb-2 font-medium text-slate-600 text-center">n</th>
                            <th className="pb-2 font-medium text-slate-600 text-right">Avg</th>
                            <th className="pb-2 font-medium text-slate-600 text-right">Min</th>
                            <th className="pb-2 font-medium text-slate-600 text-right">Max</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(r => (
                            <tr key={r.band} className="border-b border-slate-50">
                              <td className="py-1.5 text-slate-700">{r.band}</td>
                              <td className="py-1.5 text-center text-slate-500">{r.n}</td>
                              <td className="py-1.5 text-right font-semibold text-slate-800">{r.avg}</td>
                              <td className="py-1.5 text-right text-slate-500">{r.min}</td>
                              <td className="py-1.5 text-right text-slate-500">{r.max}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* COMPLIANCE */}
          <TabsContent value="compliance" className="mt-4">
            <ComplianceAnalytics
              soapNotes={soapNotes}
              clients={clients}
              conditions={conditions}
            />
          </TabsContent>

          {/* CLIENT FUNNEL */}
          <TabsContent value="funnel" className="mt-4">
            <ClientFunnelAnalytics
              clients={clients}
              clientAssessments={clientAssessments}
              soapNotes={soapNotes}
            />
          </TabsContent>

          {/* DATA QUALITY */}
          <TabsContent value="quality" className="mt-4">
            <DataQualityAnalytics
              clients={clients}
              clientAssessments={clientAssessments}
              soapNotes={soapNotes}
              assessmentDefs={assessmentDefs}
            />
          </TabsContent>

          {/* EXPORT */}
          <TabsContent value="export" className="mt-4">
            <div className="space-y-4">
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 text-sm">Export Policy</p>
                      <p className="text-amber-800 text-xs mt-1">
                        All exports are de-identified. No names, emails, DOBs, addresses or Medicare/DVA numbers are included.
                        Groups with fewer than {EXPORT_MIN_GROUP} records are excluded to prevent re-identification.
                        Free text fields are never included.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-white/80 border-slate-200/60">
                  <CardHeader><CardTitle className="text-base">Population Demographics</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-slate-500">De-identified rows: age band, gender, funding type.</p>
                    <p className="text-xs text-slate-400">Rows: {deidentifiedClients.length}</p>
                    <Button variant="outline" size="sm" onClick={() => exportCSV(buildExportRows(), "population_demographics.csv")}>
                      <Download className="w-4 h-4 mr-2" /> Download CSV
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 border-slate-200/60">
                  <CardHeader><CardTitle className="text-base">Condition Frequency</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-slate-500">Condition name and aggregated count. Groups &lt;{EXPORT_MIN_GROUP} excluded.</p>
                    <p className="text-xs text-slate-400">Conditions exported: {buildConditionExportRows().length}</p>
                    <Button variant="outline" size="sm" onClick={() => exportCSV(buildConditionExportRows(), "condition_frequency.csv")}>
                      <Download className="w-4 h-4 mr-2" /> Download CSV
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 border-slate-200/60">
                  <CardHeader><CardTitle className="text-base">Assessment Usage</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-slate-500">Assessment name and total run count. Groups &lt;{EXPORT_MIN_GROUP} excluded.</p>
                    <p className="text-xs text-slate-400">Assessments exported: {buildAssessmentExportRows().length}</p>
                    <Button variant="outline" size="sm" onClick={() => exportCSV(buildAssessmentExportRows(), "assessment_usage.csv")}>
                      <Download className="w-4 h-4 mr-2" /> Download CSV
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 border-slate-200/60">
                  <CardHeader><CardTitle className="text-base">Compliance Data</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-slate-500">Structured compliance data only. No free text. No client identifiers.</p>
                    <p className="text-xs text-slate-400">Records: {buildComplianceExportRows().length}</p>
                    <Button variant="outline" size="sm" onClick={() => exportCSV(buildComplianceExportRows(), "compliance_data.csv")}>
                      <Download className="w-4 h-4 mr-2" /> Download CSV
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}