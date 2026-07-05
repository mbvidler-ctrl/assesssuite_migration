import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ClientFunnelAnalytics({ clients, clientAssessments, soapNotes }) {
  const stages = useMemo(() => {
    const total = clients.length;
    const withAssessment = new Set(clientAssessments.map(ca => ca.client_id)).size;
    const withSOAP = new Set(soapNotes.map(n => n.client_id)).size;
    const withCompliance = new Set(soapNotes.filter(n => n.compliance?.status).map(n => n.client_id)).size;

    return [
      { label: "Client Created", count: total, color: "#3b82f6" },
      { label: "Assessment Completed", count: withAssessment, color: "#6366f1" },
      { label: "SOAP Note Recorded", count: withSOAP, color: "#a855f7" },
      { label: "Compliance Recorded", count: withCompliance, color: "#10b981" },
    ];
  }, [clients, clientAssessments, soapNotes]);

  const maxCount = stages[0]?.count || 1;

  return (
    <Card className="bg-white/80 border-slate-200/60">
      <CardHeader><CardTitle className="text-base">Client Journey Funnel</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, i) => {
            const pct = Math.round((stage.count / maxCount) * 100);
            const dropOff = i > 0 ? stages[i - 1].count - stage.count : 0;
            return (
              <div key={stage.label}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: stage.color }}>
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{stage.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {dropOff > 0 && (
                      <span className="text-xs text-red-500">−{dropOff} drop-off</span>
                    )}
                    <span className="font-bold text-slate-800">{stage.count}</span>
                    <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: stage.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-4 text-center">
          Shows the proportion of clients progressing through each stage of care
        </p>
      </CardContent>
    </Card>
  );
}