import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Save, X, ChevronDown, ChevronUp, Music, BookOpen, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";
import { scoreTwentyMetreShuttle } from "@/lib/clinical/scorers/extrasPhysiological";

const LEVEL_VO2 = [
  { level: 1, vo2: 26.8 }, { level: 2, vo2: 30.2 }, { level: 3, vo2: 32.9 },
  { level: 4, vo2: 35.7 }, { level: 5, vo2: 38.5 }, { level: 6, vo2: 41.1 },
  { level: 7, vo2: 44.2 }, { level: 8, vo2: 46.8 }, { level: 9, vo2: 49.4 },
  { level: 10, vo2: 52.0 }, { level: 11, vo2: 54.5 }, { level: 12, vo2: 57.1 },
  { level: 13, vo2: 59.7 }, { level: 14, vo2: 62.2 }, { level: 15, vo2: 64.8 },
  { level: 16, vo2: 67.4 }, { level: 17, vo2: 70.0 }, { level: 18, vo2: 72.5 },
  { level: 19, vo2: 75.0 }, { level: 20, vo2: 77.5 }, { level: 21, vo2: 80.0 },
];

export default function TwentyMeterShuttleRunBeepTestRunner({ client, onSave, onClose }) {
  const [showInstructions, setShowInstructions] = useState(true);
  const [finalLevel, setFinalLevel] = useState("");
  const [finalShuttle, setFinalShuttle] = useState("");
  const [totalShuttles, setTotalShuttles] = useState("");
  const [rpe, setRpe] = useState("");
  const [terminationReason, setTerminationReason] = useState("");
  const [symptomsReported, setSymptomsReported] = useState("");
  const [peakHr, setPeakHr] = useState("");
  const [notes, setNotes] = useState("");
  const [preTestHr, setPreTestHr] = useState("");
  const [preTestBp, setPreTestBp] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!finalLevel || !finalShuttle || !terminationReason || !rpe) {
      toast.error("Please complete: Final Level, Final Shuttle, Termination Reason, and RPE");
      return;
    }

    setSaving(true);
    try {
      const birthDate = client?.date_of_birth ? new Date(client.date_of_birth) : null;
      const derivedAge = birthDate && Number.isFinite(birthDate.getTime())
        ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : undefined;
      const age = derivedAge !== undefined && derivedAge >= 14 && derivedAge <= 85 ? derivedAge : undefined;
      const clientSex = String(client?.gender || '').toLowerCase();
      await onSave(scoreTwentyMetreShuttle({
        final_level: finalLevel,
        final_shuttle: finalShuttle,
        total_shuttles_completed: totalShuttles,
        rpe,
        termination_reason: terminationReason,
        symptoms: symptomsReported,
        peak_hr: peakHr,
        pre_test_hr: preTestHr,
        pre_test_bp: preTestBp,
        age,
        sex: age !== undefined && ['male', 'female'].includes(clientSex) ? clientSex : undefined,
        notes,
      }, { assessmentDate: todayLocal(), assessmentName: '20-Meter Shuttle Run (Beep Test)', client }));

      toast.success("20m Shuttle Run results saved successfully");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save results. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">20-Meter Shuttle Run (Beep Test)</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">

          {/* Clinician Instructions */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowInstructions(!showInstructions)}>
              <CardTitle className="text-base flex items-center justify-between text-blue-800">
                <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Administration Instructions</span>
                {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CardTitle>
            </CardHeader>
            {showInstructions && (
              <CardContent className="text-sm text-blue-900 space-y-3">
                <div>
                  <p className="font-semibold mb-1">Equipment Required</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                    <li>Flat, non-slip surface ≥ 20 metres</li>
                    <li>Two marker cones placed exactly 20m apart</li>
                    <li>Calibrated audio file / CD player</li>
                    <li>Heart rate monitor (optional)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-1">Protocol</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-800">
                    <li>Mark two lines 20 m apart on a flat surface</li>
                    <li>Participant starts at one line; runs to the other before each beep</li>
                    <li>Speed increases every minute (each level)</li>
                    <li>Test ends when participant fails to reach the line twice consecutively</li>
                    <li>Record the last completed level and shuttle number</li>
                  </ol>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="font-semibold text-amber-800 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Stop Criteria</p>
                  <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                    <li>Chest pain, dizziness, or syncope</li>
                    <li>SpO₂ &lt; 88% or marked cyanosis</li>
                    <li>Participant request to stop</li>
                    <li>Failure to reach line twice consecutively</li>
                  </ul>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <p className="font-semibold text-blue-800 mb-2 flex items-center gap-1"><Volume2 className="w-3 h-3" /> Audio Resource</p>
                  <a
                    href="https://www.youtube.com/watch?v=p5oi-sEOWsI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline text-sm"
                  >
                    20m Shuttle Run Audio (Beep Test) — YouTube
                  </a>
                  <p className="text-xs text-blue-700 mt-1">Also available via ESSA, Fitness Australia, or the Léger & Lambert (1982) original.</p>
                </div>
                <div>
                  <p className="font-semibold mb-1">VO₂max Reference by Level (Ramsbottom et al., 1988)</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full border rounded overflow-hidden">
                      <thead className="bg-blue-100">
                        <tr>
                          {LEVEL_VO2.slice(0, 11).map(r => <th key={r.level} className="px-1.5 py-1 text-center">L{r.level}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          {LEVEL_VO2.slice(0, 11).map(r => <td key={r.level} className="px-1.5 py-1 text-center font-semibold text-blue-700">{r.vo2}</td>)}
                        </tr>
                      </tbody>
                    </table>
                    <table className="text-xs w-full border rounded overflow-hidden mt-1">
                      <thead className="bg-blue-100">
                        <tr>
                          {LEVEL_VO2.slice(11).map(r => <th key={r.level} className="px-1.5 py-1 text-center">L{r.level}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          {LEVEL_VO2.slice(11).map(r => <td key={r.level} className="px-1.5 py-1 text-center font-semibold text-blue-700">{r.vo2}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Values in mL/kg/min</p>
                </div>
                <p className="text-xs text-blue-600 italic">Reference: Ramsbottom R et al. (1988). Br J Sports Med, 22(4):141–144. | Léger LA & Lambert J (1982). Eur J Appl Physiol, 49:1–12.</p>
              </CardContent>
            )}
          </Card>

          {/* Pre-Test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Pre-Test Vitals (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Heart Rate (bpm)</Label>
                  <Input type="number" placeholder="e.g., 72" value={preTestHr} onChange={(e) => setPreTestHr(e.target.value)} />
                </div>
                <div>
                  <Label>Blood Pressure</Label>
                  <Input type="text" placeholder="e.g., 120/80" value={preTestBp} onChange={(e) => setPreTestBp(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Final Level *</Label>
                  <Input type="number" placeholder="e.g., 9" min="1" max="21" value={finalLevel} onChange={(e) => setFinalLevel(e.target.value)} />
                </div>
                <div>
                  <Label>Final Shuttle *</Label>
                  <Input type="number" placeholder="e.g., 5" min="1" max="20" value={finalShuttle} onChange={(e) => setFinalShuttle(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Total Shuttles Completed</Label>
                <Input type="number" placeholder="e.g., 78" value={totalShuttles} onChange={(e) => setTotalShuttles(e.target.value)} />
              </div>
              <div>
                <Label>Peak Heart Rate (bpm)</Label>
                <Input type="number" placeholder="e.g., 182" value={peakHr} onChange={(e) => setPeakHr(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* RPE & Termination */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assessment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>RPE (6–20) *</Label>
                <Input type="number" placeholder="e.g., 19" min="6" max="20" value={rpe} onChange={(e) => setRpe(e.target.value)} />
              </div>
              <div>
                <Label>Reason for Termination *</Label>
                <Select value={terminationReason} onValueChange={setTerminationReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Exhaustion (participant reached max)">Exhaustion (participant reached max)</SelectItem>
                    <SelectItem value="Participant request to stop">Participant request to stop</SelectItem>
                    <SelectItem value="Clinician stop (safety)">Clinician stop (safety)</SelectItem>
                    <SelectItem value="Pain limitation">Pain limitation</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Symptoms Reported</Label>
                <Textarea placeholder="e.g., dizziness, chest tightness, knee pain" value={symptomsReported} onChange={(e) => setSymptomsReported(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Protocol Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="e.g., outdoor surface, minor hamstring tightness, audio interruption" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              <Save className="mr-2 w-4 h-4" />
              {saving ? "Saving..." : "Save Results"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
