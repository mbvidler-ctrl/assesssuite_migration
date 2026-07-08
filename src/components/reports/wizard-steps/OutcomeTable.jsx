import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  buildOutcomeComparison,
  formatScore,
  formatChange,
  OUTCOME_DIRECTION_NOTE,
  SINGLE_POINT_LABEL,
} from "@/lib/clinical/outcomeComparison";

// I2 / G9: data-driven baseline-vs-current outcomes table. Renders the same
// comparison rows (shaped by buildOutcomeComparison) that the saved-report
// serialiser embeds, so what the clinician sees in the wizard is exactly what
// the report carries. Interpretation is direction-aware only where the
// catalogue records a direction of benefit; otherwise wording stays neutral.

const TONE_BADGE = {
  good: "bg-green-100 text-green-700",
  bad: "bg-red-100 text-red-700",
  neutral: "bg-slate-100 text-slate-600",
  unknown: "bg-blue-50 text-blue-700",
};

function ChangeIcon({ change }) {
  if (!Number.isFinite(change) || change === 0) return <Minus className="w-3 h-3" />;
  return change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;
}

function ScoreCell({ value, unit, date }) {
  return (
    <div>
      <span className="font-medium text-slate-800">
        {formatScore(value)}{unit ? ` ${unit}` : ""}
      </span>
      {date && <div className="text-xs text-slate-400">{date}</div>}
    </div>
  );
}

export default function OutcomeTable({ assessments, title = "Outcome Measures — Baseline vs Most Recent" }) {
  const rows = buildOutcomeComparison(assessments);

  if (rows.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 text-center">
        <ClipboardList className="w-6 h-6 text-slate-300 mx-auto mb-1" />
        <p className="text-sm text-slate-500">
          No completed assessment results with recorded scores are available for comparison.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-white">
            <TableHead className="text-xs">Assessment</TableHead>
            <TableHead className="text-xs">Baseline</TableHead>
            <TableHead className="text-xs">Most Recent</TableHead>
            <TableHead className="text-xs">Change</TableHead>
            <TableHead className="text-xs">Interpretation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} className="text-sm">
              <TableCell className="font-medium text-slate-800">{row.name}</TableCell>
              <TableCell>
                <ScoreCell value={row.baselineValue} unit={row.unit} date={row.baselineDate} />
              </TableCell>
              {row.hasComparison ? (
                <>
                  <TableCell>
                    <ScoreCell value={row.latestValue} unit={row.unit} date={row.latestDate} />
                  </TableCell>
                  <TableCell className="text-slate-700">
                    {formatChange(row.change, row.unit)}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${TONE_BADGE[row.interpretation.tone] || TONE_BADGE.neutral} flex w-fit items-center gap-1 text-xs font-medium`}>
                      <ChangeIcon change={row.change} />
                      {row.interpretation.label}
                    </Badge>
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-slate-400">—</TableCell>
                  <TableCell className="text-slate-400">—</TableCell>
                  <TableCell>
                    <span className="text-xs italic text-slate-500">{SINGLE_POINT_LABEL}</span>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-400">{OUTCOME_DIRECTION_NOTE}</p>
      </div>
    </div>
  );
}
