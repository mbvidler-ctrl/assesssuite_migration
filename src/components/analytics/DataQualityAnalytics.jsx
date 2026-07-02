import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";

function QualityMetric({ label, value, total, variant }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const color = variant === "good"
    ? pct >= 80 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-600"
    : pct <= 5 ? "text-green-600" : pct <= 20 ? "text-yellow-600" : "text-red-600";
  const barColor = variant === "good"
    ? pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444"
    : pct <= 5 ? "#10b981" : pct <= 20 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-slate-700">{label}</span>
        <span className={`text-sm font-bold ${color}`}>{pct}% <span className="font-normal text-slate-400">({value}/{total})</span></span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

export default function DataQualityAnalytics({ clients, clientAssessments, soapNotes, assessmentDefs }) {
  const defMap = useMemo(() => Object.fromEntries(assessmentDefs.map(d => [d.id, d])), [assessmentDefs]);

  const metrics = useMemo(() => {
    const totalAssessments = clientAssessments.length;
    const withResult = clientAssessments.filter(ca => ca.result_value != null).length;
    const unknownAssessment = clientAssessments.filter(ca => !defMap[ca.assessment_id]).length;
    const totalClients = clients.length;
    const withDOB = clients.filter(c => c.date_of_birth).length;
    const withGender = clients.filter(c => c.gender).length;
    const withFunding = clients.filter(c => c.funding_source).length;
    const totalNotes = soapNotes.length;
    const withCompliance = soapNotes.filter(n => n.compliance?.status).length;

    return {
      totalAssessments,
      withResult,
      unknownAssessment,
      totalClients,
      withDOB,
      withGender,
      withFunding,
      totalNotes,
      withCompliance,
    };
  }, [clients, clientAssessments, soapNotes, defMap]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-white/80 border-slate-200/60">
          <CardHeader><CardTitle className="text-base">Assessment Data Quality</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <QualityMetric label="Assessments with result value" value={metrics.withResult} total={metrics.totalAssessments} variant="good" />
            <QualityMetric label="Unknown assessment mappings" value={metrics.unknownAssessment} total={metrics.totalAssessments} variant="bad" />
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200/60">
          <CardHeader><CardTitle className="text-base">Client Record Completeness</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <QualityMetric label="Date of birth recorded" value={metrics.withDOB} total={metrics.totalClients} variant="good" />
            <QualityMetric label="Gender recorded" value={metrics.withGender} total={metrics.totalClients} variant="good" />
            <QualityMetric label="Funding source recorded" value={metrics.withFunding} total={metrics.totalClients} variant="good" />
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200/60">
          <CardHeader><CardTitle className="text-base">Compliance Recording</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <QualityMetric label="SOAP notes with compliance data" value={metrics.withCompliance} total={metrics.totalNotes} variant="good" />
            {metrics.unknownAssessment > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">{metrics.unknownAssessment} assessment records have unknown mappings</p>
                    <p className="text-xs text-amber-700 mt-1">These may be from deleted assessments or data import issues.</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="bg-white/80 border-slate-200/60">
        <CardHeader><CardTitle className="text-base">Data Quality Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: "Total Clients", value: metrics.totalClients },
              { label: "Total Assessments", value: metrics.totalAssessments },
              { label: "Total SOAP Notes", value: metrics.totalNotes },
              { label: "With Compliance", value: metrics.withCompliance },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}