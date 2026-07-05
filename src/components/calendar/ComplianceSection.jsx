import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = [
  {
    key: "green",
    label: "Compliant",
    sub: "Keeping up well",
    bg: "bg-green-500",
    ring: "ring-green-500",
    text: "text-white",
    lightBg: "bg-green-50 border-green-300",
  },
  {
    key: "yellow",
    label: "Partial",
    sub: "Inconsistent",
    bg: "bg-yellow-400",
    ring: "ring-yellow-400",
    text: "text-white",
    lightBg: "bg-yellow-50 border-yellow-300",
  },
  {
    key: "red",
    label: "Poor",
    sub: "Not keeping up",
    bg: "bg-red-500",
    ring: "ring-red-500",
    text: "text-white",
    lightBg: "bg-red-50 border-red-300",
  },
  {
    key: "grey",
    label: "N/A",
    sub: "No home program",
    bg: "bg-slate-400",
    ring: "ring-slate-400",
    text: "text-white",
    lightBg: "bg-slate-50 border-slate-300",
  },
];

const BARRIERS = [
  "Pain",
  "Fatigue",
  "Low motivation",
  "Forgot",
  "Time constraints",
  "Mental health",
  "Access issues",
  "Unsure how to complete program",
  "Other",
];

const ACTIONS_YELLOW = [
  "Education provided",
  "Program adjusted",
  "Reviewed barriers",
  "Follow-up next session",
];

const ACTIONS_RED = [
  "Education provided",
  "Program simplified",
  "Reviewed barriers",
  "Follow-up next session",
  "Refer onward",
];

const FREQUENCIES = [
  "Daily",
  "4–6x/week",
  "2–3x/week",
  "1x/week",
];

export default function ComplianceSection({ value = {}, onChange, disabled = false }) {
  const status = value.status || null;

  const update = (patch) => onChange({ ...value, ...patch });

  const toggleBarrier = (barrier) => {
    const current = value.barriers || [];
    const next = current.includes(barrier)
      ? current.filter((b) => b !== barrier)
      : [...current, barrier];
    update({ barriers: next });
  };

  const toggleAction = (action) => {
    const current = value.actions_taken || [];
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action];
    update({ actions_taken: next });
  };

  const activeStatus = STATUSES.find((s) => s.key === status);

  return (
    <div className="space-y-3">
      <Label className="text-lg font-semibold">Compliance / Home Program Adherence</Label>

      {/* Traffic light buttons */}
      <div className="flex flex-wrap gap-3 mt-2">
        {STATUSES.map((s) => {
          const selected = status === s.key;
          return (
            <button
              key={s.key}
              type="button"
              disabled={disabled}
              onClick={() => update({ status: s.key, barriers: [], actions_taken: [], frequency: null, notes: "" })}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all
                ${selected
                  ? `${s.bg} ${s.text} border-transparent ring-2 ${s.ring} ring-offset-2 shadow-md`
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}
                ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <span className={`w-3 h-3 rounded-full shrink-0 ${selected ? "bg-white/70" : s.bg}`} />
              <span>{s.label}</span>
              <span className={`text-xs font-normal ${selected ? "opacity-80" : "text-slate-400"}`}>
                {s.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Conditional fields */}
      {status === "green" && (
        <div className={`rounded-xl border p-4 space-y-3 ${activeStatus.lightBg}`}>
          <div>
            <Label className="text-sm font-medium text-slate-700">Frequency (optional)</Label>
            <Select
              value={value.frequency || ""}
              onValueChange={(v) => update({ frequency: v })}
              disabled={disabled}
            >
              <SelectTrigger className="mt-1 w-48 bg-white">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">Notes (optional)</Label>
            <Textarea
              value={value.notes || ""}
              onChange={(e) => update({ notes: e.target.value })}
              disabled={disabled}
              rows={2}
              placeholder="Optional compliance notes..."
              className="mt-1 bg-white"
            />
          </div>
        </div>
      )}

      {(status === "yellow" || status === "red") && (
        <div className={`rounded-xl border p-4 space-y-4 ${activeStatus.lightBg}`}>
          {/* Barriers */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">Barriers to adherence</Label>
            <div className="flex flex-wrap gap-2">
              {BARRIERS.map((b) => {
                const checked = (value.barriers || []).includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleBarrier(b)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all
                      ${checked
                        ? status === "red"
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-yellow-400 text-white border-yellow-400"
                        : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"}
                      ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action taken */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">Action taken</Label>
            <div className="space-y-1.5">
              {(status === "red" ? ACTIONS_RED : ACTIONS_YELLOW).map((a) => (
                <div key={a} className="flex items-center gap-2">
                  <Checkbox
                    id={`action-${a}`}
                    checked={(value.actions_taken || []).includes(a)}
                    onCheckedChange={() => toggleAction(a)}
                    disabled={disabled}
                  />
                  <label htmlFor={`action-${a}`} className="text-sm text-slate-700 cursor-pointer select-none">{a}</label>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium text-slate-700">
              {status === "red" ? "Reason for poor compliance *" : "Notes (optional)"}
            </Label>
            <Textarea
              value={value.notes || ""}
              onChange={(e) => update({ notes: e.target.value })}
              disabled={disabled}
              rows={2}
              placeholder={status === "red" ? "Describe reasons for poor compliance..." : "Optional notes..."}
              className="mt-1 bg-white"
            />
          </div>
        </div>
      )}

      {status === null && (
        <p className="text-xs text-slate-400 italic">Select a compliance status above</p>
      )}
    </div>
  );
}