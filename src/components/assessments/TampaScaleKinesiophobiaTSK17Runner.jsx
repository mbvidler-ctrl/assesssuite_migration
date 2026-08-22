import React, { useState } from 'react';
import { Save, X, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { todayLocal } from '@/lib/localDate';
import {
  TSK_RUNNER_SPEC,
  validateAndScoreTsk,
} from '@/lib/clinical/scorers/classDRepairs';

export default function TampaScaleKinesiophobiaTSK17Runner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    try {
      const payload = validateAndScoreTsk(
        { responses, notes },
        { assessmentDate: todayLocal() },
      );
      onSave(payload);
      toast.success('TSK-17 scored and ready to save.');
    } catch (error) {
      toast.error(error?.message || 'Unable to score the TSK-17.');
    }
  };

  const completedCount = TSK_RUNNER_SPEC.items.filter(({ key }) => responses[key] !== undefined).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden bg-white">
        <CardHeader className="shrink-0 border-b bg-gradient-to-r from-teal-50 to-cyan-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">
                Tampa Scale for Kinesiophobia (TSK-17)
              </CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                {client?.full_name ? `${client.full_name} • ` : ''}
                Rate every statement from strongly disagree to strongly agree.
              </p>
              <p className="mt-1 text-xs font-medium text-teal-800" aria-live="polite">
                {completedCount} of {TSK_RUNNER_SPEC.items.length} items answered
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close TSK-17">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>
                Answer based on how you feel now. Every item is required. Items 4, 8, 12 and 16
                are reverse-scored automatically; the completed total ranges from 17 to 68.
              </p>
              <p className="mt-1 text-xs text-blue-700">
                Instrument wording and scoring source: NSW SIRA reprint of the original TSK.
              </p>
            </div>
          </div>

          {TSK_RUNNER_SPEC.items.map((item, index) => (
            <fieldset key={item.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-900">
                {index + 1}. {item.prompt}
              </legend>
              <RadioGroup
                className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                value={responses[item.key] === undefined ? '' : String(responses[item.key])}
                onValueChange={(value) => setResponses((current) => ({
                  ...current,
                  [item.key]: Number(value),
                }))}
                aria-label={`TSK item ${index + 1}`}
              >
                {item.options.map((option) => {
                  const inputId = `${item.key}-${option.value}`;
                  return (
                    <Label
                      key={option.value}
                      htmlFor={inputId}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm hover:border-teal-300"
                    >
                      <RadioGroupItem id={inputId} value={String(option.value)} />
                      <span>{option.label}</span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </fieldset>
          ))}

          <div>
            <Label htmlFor="tsk-notes">Clinical notes</Label>
            <Textarea
              id="tsk-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={4000}
              className="mt-1"
              placeholder="Optional observations or context"
            />
          </div>
        </CardContent>

        <div className="flex shrink-0 justify-between border-t bg-slate-50 p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700">
            <Save className="mr-2 h-4 w-4" /> Score and continue
          </Button>
        </div>
      </Card>
    </div>
  );
}
