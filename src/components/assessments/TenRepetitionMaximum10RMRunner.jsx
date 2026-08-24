import React, { useState } from 'react';
import { Dumbbell, Info, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { todayLocal } from '@/lib/localDate';
import {
  TEN_RM_LOAD_CONSTRAINTS,
  TEN_RM_RUNNER_SPEC,
  validateAndScoreTenRm,
} from '@/lib/clinical/scorers/classDRepairs';

const SUGGESTED_EXERCISES = [
  'Leg press',
  'Knee extension',
  'Hamstring curl',
  'Chest press',
  'Seated row',
  'Lat pulldown',
  'Calf raise',
  'Shoulder press',
];

export default function TenRepetitionMaximum10RMRunner({ client, onSave, onClose }) {
  const [exercise, setExercise] = useState('');
  const [load, setLoad] = useState('');
  const [unit, setUnit] = useState('kg');
  const [equipment, setEquipment] = useState('');
  const [testStandard, setTestStandard] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = (event) => {
    event.preventDefault();
    try {
      const payload = validateAndScoreTenRm(
        {
          exercise,
          load,
          unit,
          equipment,
          test_standard: testStandard,
          notes,
        },
        { assessmentDate: todayLocal() },
      );
      onSave(payload);
      toast.success('10RM result validated and ready to save.');
    } catch (error) {
      toast.error(error?.message || 'Unable to validate the 10RM result.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <Card className="my-6 w-full max-w-3xl bg-white">
        <CardHeader className="border-b bg-gradient-to-r from-teal-50 to-cyan-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Dumbbell className="h-5 w-5 text-teal-700" />
                Ten Repetition Maximum (10RM)
              </CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                {client?.full_name ? `${client.full_name} • ` : ''}
                Record the greatest load completed for ten repetitions under the documented standard.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close 10RM">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This is a dedicated 10RM record. It stores the directly observed ten-repetition
                maximum and does not substitute or overwrite a 1RM result.
              </p>
            </div>

            <div>
              <Label htmlFor="ten-rm-exercise">Exercise tested *</Label>
              <Input
                id="ten-rm-exercise"
                list="ten-rm-exercise-suggestions"
                value={exercise}
                onChange={(event) => setExercise(event.target.value)}
                maxLength={120}
                className="mt-1"
                placeholder="e.g. Leg press"
              />
              <datalist id="ten-rm-exercise-suggestions">
                {SUGGESTED_EXERCISES.map((name) => <option key={name} value={name} />)}
              </datalist>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <div>
                <Label htmlFor="ten-rm-load">10RM load *</Label>
                <Input
                  id="ten-rm-load"
                  type="number"
                  min={TEN_RM_LOAD_CONSTRAINTS.min}
                  max={TEN_RM_LOAD_CONSTRAINTS.max}
                  step={TEN_RM_LOAD_CONSTRAINTS.step}
                  value={load}
                  onChange={(event) => setLoad(event.target.value)}
                  className="mt-1"
                  placeholder="e.g. 80"
                />
              </div>
              <div>
                <Label>Unit *</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="lb">Pounds (lb)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="ten-rm-equipment">Equipment or setup</Label>
              <Input
                id="ten-rm-equipment"
                value={equipment}
                onChange={(event) => setEquipment(event.target.value)}
                maxLength={200}
                className="mt-1"
                placeholder="Machine, free weight, seat setting or other setup"
              />
            </div>

            <div>
              <Label htmlFor="ten-rm-standard">Range-of-motion or technique standard</Label>
              <Textarea
                id="ten-rm-standard"
                value={testStandard}
                onChange={(event) => setTestStandard(event.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-1"
                placeholder="Document the standard used to decide whether each repetition counted"
              />
            </div>

            <div>
              <Label htmlFor="ten-rm-notes">Clinical notes</Label>
              <Textarea
                id="ten-rm-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={4000}
                rows={3}
                className="mt-1"
                placeholder="Optional observations"
              />
            </div>

            <div className="flex justify-between border-t pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                <Save className="mr-2 h-4 w-4" /> Save 10RM result
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
