import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function SelectDateRange({ dateRange, onChange }) {
  return (
    <div className="space-y-6 pt-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Report Period</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => onChange({ ...dateRange, startDate: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date (optional for single-date reports)</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate || ''}
                onChange={(e) => onChange({ ...dateRange, endDate: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <p className="text-sm text-slate-500 mt-3">
            Select a single date for initial assessments, or a date range for progress reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}