import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HorizBarChart } from "./AnalyticsCharts";

export default function AssessmentCoverageAnalytics({ clients, clientAssessments, assessmentDefs, conditions }) {
  const defMap = useMemo(() => Object.fromEntries(assessmentDefs.map(d => [d.id, d])), [assessmentDefs]);
  const totalClients = clients.length || 1;

  // % of clients receiving each assessment
  const coverageData = useMemo(() => {
    const clientsPerAssessment = {};
    clientAssessments.forEach(ca => {
      const name = defMap[ca.assessment_id]?.name;
      if (!name) return;
      if (!clientsPerAssessment[name]) clientsPerAssessment[name] = new Set();
      clientsPerAssessment[name].add(ca.client_id);
    });
    return Object.entries(clientsPerAssessment)
      .map(([name, set]) => ({ name, count: set.size, pct: Math.round((set.size / totalClients) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [clientAssessments, defMap, totalClients]);

  // Assessments used per condition (top conditions)
  const conditionAssessmentMap = useMemo(() => {
    // Map client → conditions
    const clientConditions = {};
    conditions.forEach(c => {
      if (!clientConditions[c.client_id]) clientConditions[c.client_id] = [];
      clientConditions[c.client_id].push(c.condition_name);
    });

    // For each assessment run, find the conditions of that client
    const conditionAssessments = {};
    clientAssessments.forEach(ca => {
      const name = defMap[ca.assessment_id]?.name;
      if (!name) return;
      (clientConditions[ca.client_id] || []).forEach(cond => {
        if (!conditionAssessments[cond]) conditionAssessments[cond] = {};
        conditionAssessments[cond][name] = (conditionAssessments[cond][name] || 0) + 1;
      });
    });

    return conditionAssessments;
  }, [clientAssessments, conditions, defMap]);

  const topConditions = Object.entries(conditionAssessmentMap)
    .sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))
    .slice(0, 5);

  // Assessments with zero usage
  const usedAssessmentNames = new Set(clientAssessments.map(ca => defMap[ca.assessment_id]?.name).filter(Boolean));
  const unusedAssessments = assessmentDefs.filter(d => !usedAssessmentNames.has(d.name) && !d.is_deleted);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4 text-center">
        <Card className="bg-white/80 border-slate-200/60">
          <CardContent className="pt-5 pb-4">
            <p className="text-3xl font-bold text-blue-600">{usedAssessmentNames.size}</p>
            <p className="text-xs text-slate-500 mt-1">Assessment types used</p>
          </CardContent>
        </Card>
        <Card className="bg-white/80 border-slate-200/60">
          <CardContent className="pt-5 pb-4">
            <p className="text-3xl font-bold text-purple-600">{assessmentDefs.filter(d => !d.is_deleted).length}</p>
            <p className="text-xs text-slate-500 mt-1">Total in library</p>
          </CardContent>
        </Card>
        <Card className="bg-white/80 border-slate-200/60">
          <CardContent className="pt-5 pb-4">
            <p className="text-3xl font-bold text-amber-600">{unusedAssessments.length}</p>
            <p className="text-xs text-slate-500 mt-1">Not yet used</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/80 border-slate-200/60">
        <CardHeader>
          <CardTitle className="text-base">Assessment Coverage (clients receiving each)</CardTitle>
        </CardHeader>
        <CardContent>
          {coverageData.length === 0 ? (
            <p className="text-slate-400 text-sm py-6 text-center">No assessment data yet</p>
          ) : (
            <div className="space-y-2">
              {coverageData.map(({ name, count, pct }) => (
                <div key={name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-slate-700 truncate max-w-xs">{name}</span>
                    <span className="text-sm font-semibold text-slate-600 ml-2 shrink-0">{count} clients ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {topConditions.length > 0 && (
        <Card className="bg-white/80 border-slate-200/60">
          <CardHeader><CardTitle className="text-base">Top Assessments by Condition</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-5">
              {topConditions.map(([condition, assessments]) => {
                const sorted = Object.entries(assessments).sort((a, b) => b[1] - a[1]).slice(0, 5);
                return (
                  <div key={condition}>
                    <p className="text-sm font-semibold text-slate-800 mb-2">{condition}</p>
                    <div className="space-y-1 pl-2">
                      {sorted.map(([name, count]) => (
                        <div key={name} className="flex justify-between text-xs text-slate-600">
                          <span className="truncate max-w-xs">{name}</span>
                          <span className="font-semibold ml-2">{count}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {unusedAssessments.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader><CardTitle className="text-base text-amber-900">Assessments Not Yet Used ({unusedAssessments.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unusedAssessments.slice(0, 30).map(a => (
                <Badge key={a.id} variant="outline" className="text-xs text-amber-800 border-amber-300 bg-white">{a.name}</Badge>
              ))}
              {unusedAssessments.length > 30 && (
                <span className="text-xs text-amber-600">+{unusedAssessments.length - 30} more</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}