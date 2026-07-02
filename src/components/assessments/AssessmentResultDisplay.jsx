import React from "react";
import { Badge } from "@/components/ui/badge";

export default function AssessmentResultDisplay({ assessment, client, clientAssessment, normativeComparison }) {
  // Override unit for tests where result_value is VO2max but assessment unit_of_measure says "meters"
  const isVO2Result = ['cooper_test', '12_minute_walk_run_test'].includes(clientAssessment.additional_data?.measurement_type)
    || clientAssessment.additional_data?.vo2_max !== undefined;
  const displayUnit = isVO2Result ? 'ml/kg/min' : assessment.unit_of_measure;
  const displayLabel = isVO2Result ? 'Estimated VOâ‚‚max' : 'Result';

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-4 rounded-lg border border-slate-200">
        <p className="text-sm font-medium text-slate-600 mb-1">{displayLabel}</p>
        <p className="text-3xl font-bold text-slate-900">
          {clientAssessment.result_value}
          {displayUnit && (
            <span className="text-lg font-normal text-slate-500 ml-2">{displayUnit}</span>
          )}
        </p>
      </div>

      {clientAssessment.additional_data && Object.keys(clientAssessment.additional_data).length > 0 && (
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
          {Object.entries(clientAssessment.additional_data).map(([key, value]) => {
            if (key === 'measurement_type' || value === null || value === undefined || value === '') return null;
            if (typeof value === 'object') return null;
            return (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-medium text-slate-900">{String(value)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}