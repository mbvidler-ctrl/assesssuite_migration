import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function SelectAssessments({ assessments, selectedIds, onChange, isLoading }) {
  const handleToggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === assessments.length) {
      onChange([]);
    } else {
      onChange(assessments.map(a => a.id));
    }
  };

  const sorted = [...assessments].sort((a, b) => new Date(b.assessment_date) - new Date(a.assessment_date));

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-semibold text-slate-800">Select Assessments to Include</h3>
            <p className="text-xs text-slate-500">These results will be referenced by AI Generate in the report sections.</p>
          </div>
        </div>
        <Button onClick={handleSelectAll} variant="outline" size="sm" className="text-xs">
          {selectedIds.length === assessments.length ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-blue-400 mx-auto mb-2 animate-spin" />
          <p className="text-slate-500 text-sm">Loading assessments...</p>
        </Card>
      ) : assessments.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No completed assessments found for this client.</p>
          <p className="text-slate-400 text-xs mt-1">Try widening the date range, or generate report sections manually.</p>
        </Card>
      ) : (
        <>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            {selectedIds.length} of {assessments.length} selected
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {sorted.map(assessment => {
              const additional = assessment.additional_data || {};
              const hasSoapText = !!additional.soap_text;
              const hasResult = !!assessment.result_value;
              const isSelected = selectedIds.includes(assessment.id);
              return (
                <div
                  key={assessment.id}
                  onClick={() => handleToggle(assessment.id)}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Checkbox
                    id={`assessment-${assessment.id}`}
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(assessment.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor={`assessment-${assessment.id}`} className="font-medium text-slate-900 cursor-pointer text-sm">
                        {assessment.name || <span className="italic text-slate-400">Unknown Assessment</span>}
                      </Label>
                      {(hasSoapText || hasResult) && (
                        <Badge className="bg-green-100 text-green-700 text-xs px-1.5 py-0">
                          âœ“ Results
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{assessment.assessment_date ? format(new Date(assessment.assessment_date), 'dd/MM/yyyy') : 'No date'}</span>
                      {hasResult && (
                        <>
                          <span className="text-slate-300">â€¢</span>
                          <span className="font-medium text-slate-700">
                            {assessment.result_value} {assessment.unit_of_measure || ''}
                          </span>
                        </>
                      )}
                    </div>
                    {hasSoapText && (
                      <p className="text-xs text-slate-400 mt-1 truncate max-w-md">
                        â€¢ {additional.soap_text.substring(0, 120)}{additional.soap_text.length > 120 ? '...' : ''}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}