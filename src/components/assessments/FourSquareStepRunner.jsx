import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Play, Pause, RotateCcw, Info, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

export default function FourSquareStepRunner({ client, onSave, onClose, initialData }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [data, setData] = useState({
    trial1: initialData?.trial1 || "",
    trial2: initialData?.trial2 || "",
    observations: initialData?.observations || "",
  });
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 0.01);
      }, 10);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const calculateBest = () => {
    const trials = [parseFloat(data.trial1) || 0, parseFloat(data.trial2) || 0].filter((v) => v > 0);
    return trials.length > 0 ? Math.min(...trials) : null;
  };

  const getInterpretation = (time) => {
    if (time > 15) return { text: "High fall risk (≥15s)", color: "text-red-700 bg-red-50 border-red-200" };
    if (time > 12) return { text: "Increased fall risk (12–15s)", color: "text-yellow-700 bg-yellow-50 border-yellow-200" };
    return { text: "Low fall risk (<12s)", color: "text-green-700 bg-green-50 border-green-200" };
  };

  const handleSave = () => {
    const best = calculateBest();
    if (!best) {
      toast.error("Please record at least one trial before saving.");
      return;
    }

    const interpretation = getInterpretation(best).text;

    const soapText = `• Four Square Step Test (FSST)\n  Best Time: ${best.toFixed(2)}s\n  Interpretation: ${interpretation}\n\n  Trials:\n    Trial 1: ${data.trial1 ? data.trial1 + "s" : "—"}\n    Trial 2: ${data.trial2 ? data.trial2 + "s" : "—"}${
      data.observations ? `\n\n  Observations: ${data.observations}` : ""
    }\n\n  Reference: Dite, W., & Temple, V. A. (2002). Development of a clinical measure of turning for older adults. American Journal of Physical Medicine & Rehabilitation, 81(3), 180–188.`;

    onSave({
      status: "completed",
      result_value: best,
      additional_data: {
        soap_text: soapText,
        trial1: parseFloat(data.trial1) || null,
        trial2: parseFloat(data.trial2) || null,
        best_time: best,
        interpretation,
      },
      notes: data.observations,
      assessment_date: todayLocal(),
    });
    toast.success("Four Square Step Test saved successfully.");
    setTimeout(() => onClose(), 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-slate-50 border-b px-6 py-4 flex justify-between items-start z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Four Square Step Test (FSST)</h2>
            <p className="text-sm text-slate-600 mt-1">Client: {client?.full_name || "Unknown"}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Assessment Overview</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div>
                <p className="font-semibold text-slate-900">Purpose:</p>
                <p className="text-slate-700">
                  Measures dynamic balance, agility, and stepping ability by requiring rapid stepping over obstacles in multiple directions. Used to assess fall risk, balance control, and lower limb function in older adults and patients with balance disorders.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Measurement:</p>
                <p className="text-slate-700">
                  <strong>Time to completion (seconds)</strong> — The faster the client completes the task, the better the balance and mobility. Best of two trials is recorded.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Population:</p>
                <p className="text-slate-700">
                  Older adults (65+), patients at risk of falls, those with balance disorders, neurological conditions, or lower limb impairments.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Setup & Equipment */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <button
                onClick={() => setExpandedSection(expandedSection === "setup" ? null : "setup")}
                className="w-full flex items-center justify-between font-semibold text-blue-900 hover:text-blue-700"
              >
                <span className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Setup &amp; Equipment
                </span>
                {expandedSection === "setup" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "setup" && (
              <CardContent className="text-sm text-blue-900 space-y-3">
                <div>
                  <p className="font-semibold">Equipment Required:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1 text-xs mt-1">
                    <li>4 canes or dowels (1 meter length, 1.5 inches diameter), placed perpendicular to each other forming a cross/square</li>
                    <li>Open floor space ≥2 meters × 2 meters</li>
                    <li>Stopwatch or timer (accurate to 0.01 seconds)</li>
                    <li>Client wearing comfortable, slip-resistant footwear</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold">Setup:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1 text-xs mt-1">
                    <li>Place 4 canes on the floor to form a square (each cane ~1 meter apart in a cross pattern)</li>
                    <li>Number the squares: square 1 (top-left), square 2 (top-right), square 3 (bottom-right), square 4 (bottom-left)</li>
                    <li>Client stands outside the square, facing into square 1</li>
                  </ul>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Protocol & Procedure */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <button
                onClick={() => setExpandedSection(expandedSection === "protocol" ? null : "protocol")}
                className="w-full flex items-center justify-between font-semibold text-amber-900 hover:text-amber-700"
              >
                <span className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Protocol &amp; Test Procedure
                </span>
                {expandedSection === "protocol" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "protocol" && (
              <CardContent className="text-sm text-amber-900 space-y-3">
                <div className="bg-white p-3 rounded border border-amber-200">
                  <p className="font-semibold mb-2">Test Sequence:</p>
                  <p className="text-xs">
                    <strong>Clockwise:</strong> Start in square 1 → step into square 2 (forward-right) → square 3 (back-right) → square 4 (back-left) → back to square 1 (forward-left)
                  </p>
                  <p className="text-xs mt-1">
                    <strong>Counter-clockwise:</strong> Reverse the sequence in the opposite direction
                  </p>
                  <p className="text-xs mt-2 font-semibold">
                    Both feet must fully contact each square before stepping to the next. Complete the sequence once clockwise, then once counter-clockwise (total: 2 full sequences).
                  </p>
                </div>
                <div className="bg-white p-3 rounded border border-amber-200">
                  <p className="font-semibold mb-1">Scoring Rules:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                    <li>Both feet must contact each square before moving to next</li>
                    <li>Hands may touch floor or walls for balance if needed (but penalizes score)</li>
                    <li>Time starts when first foot enters the square</li>
                    <li>Time stops when last foot exits square 1 after the reverse sequence</li>
                    <li>If client steps outside the square or loses balance, the trial is repeated</li>
                  </ul>
                </div>
                <div className="bg-white p-3 rounded border border-amber-200 italic">
                  <p className="font-semibold mb-1">Clinician Script:</p>
                  <p className="text-xs">
                    "This test measures your balance and stepping ability. You'll step over these lines in a specific pattern. First, you'll step clockwise (1→2→3→4→1), then counter-clockwise in reverse. Both feet must touch each square before moving to the next. I'll time you as you complete the pattern. Let's do a practice trial first to make sure you understand."
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Visual Diagram */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-base">Test Pattern Diagram</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-2">
              <div className="bg-white p-6 rounded border-2 border-green-200">
                <p className="text-xs font-mono mb-3 text-slate-600">Four squares arranged in a cross pattern:</p>
                <div className="space-y-3 max-w-xs mx-auto">
                  <div className="flex justify-center gap-1">
                    <div className="w-12 h-12 bg-blue-100 border-2 border-blue-400 flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <div className="w-12 h-12 bg-blue-100 border-2 border-blue-400 flex items-center justify-center text-xs font-bold">
                      2
                    </div>
                  </div>
                  <div className="flex justify-center gap-1">
                    <div className="w-12 h-12 bg-blue-100 border-2 border-blue-400 flex items-center justify-center text-xs font-bold">
                      4
                    </div>
                    <div className="w-12 h-12 bg-blue-100 border-2 border-blue-400 flex items-center justify-center text-xs font-bold">
                      3
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-3">
                  <strong>Clockwise:</strong> 1→2→3→4→1
                </p>
                <p className="text-xs text-slate-600">
                  <strong>Counter-clockwise:</strong> 1→4→3→2→1
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Interpretation & Norms */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <button
                onClick={() => setExpandedSection(expandedSection === "interpretation" ? null : "interpretation")}
                className="w-full flex items-center justify-between font-semibold text-green-900 hover:text-green-700"
              >
                <span>Score Interpretation &amp; Normative Data</span>
                {expandedSection === "interpretation" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "interpretation" && (
              <CardContent className="text-xs text-green-900 space-y-2">
                <div className="bg-white p-2 rounded border border-green-200">
                  <p className="font-semibold mb-1">Fall Risk Classification:</p>
                  <p><strong>&lt;12 seconds:</strong> Low fall risk; good balance and mobility</p>
                  <p><strong>12–15 seconds:</strong> Increased fall risk; some balance or agility deficits</p>
                  <p><strong>≥15 seconds:</strong> High fall risk; significant balance/mobility limitations</p>
                </div>
                <div className="bg-white p-2 rounded border border-green-200">
                  <p className="font-semibold mb-1">Normative Values:</p>
                  <p><strong>Healthy older adults (65–74):</strong> 8–12 seconds</p>
                  <p><strong>Older adults (75+):</strong> 12–15 seconds</p>
                  <p><strong>High fall risk (≥15s):</strong> Increased likelihood of future falls; recommend fall prevention strategies</p>
                </div>
                <div className="bg-white p-2 rounded border border-green-200">
                  <p className="font-semibold mb-1">Clinical Significance:</p>
                  <p>Each 1-second increase is associated with 1.1× increase in fall risk. Times ≥15s have 2–3× higher fall risk. Used to identify need for balance training, assistive devices, or environmental modifications.</p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Clinical Significance */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Clinical Significance &amp; Reliability</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-700 space-y-2">
              <p>
                <strong>Sensitivity &amp; Specificity:</strong> The FSST is a reliable and valid test for identifying older adults at high risk of falls. High test-retest reliability (ICC &gt;0.85) and good predictive validity for fall risk.
              </p>
              <p>
                <strong>MDC (Minimal Detectable Change):</strong> ~1.5 seconds represents true change in performance; smaller differences may reflect measurement error.
              </p>
              <p>
                <strong>Utility:</strong> Quick (≤5 minutes), requires minimal equipment, applicable to community and clinical settings. Useful for screening, baseline assessment, and monitoring response to balance training.
              </p>
            </CardContent>
          </Card>

          {/* References */}
          <Card className="border-slate-200 bg-slate-50">
            <CardHeader>
              <button
                onClick={() => setExpandedSection(expandedSection === "references" ? null : "references")}
                className="w-full flex items-center justify-between font-semibold text-slate-900 hover:text-slate-700"
              >
                <span>References &amp; Evidence</span>
                {expandedSection === "references" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </CardHeader>
            {expandedSection === "references" && (
              <CardContent className="text-xs text-slate-700 space-y-2">
                <p>
                  <strong>Dite, W., &amp; Temple, V. A.</strong> (2002). Development of a clinical measure of turning for older adults. <em>American Journal of Physical Medicine &amp; Rehabilitation</em>, 81(3), 180–188.
                </p>
                <p>
                  <strong>Whitney, S. L., Wrisley, D. M., Furman, J. M., Soto-Varela, A., &amp; Brown, K. E.</strong> (2005). Reliability and validity of the Dynamic Gait Index in people with vestibular disorders. <em>Otology &amp; Neurotology</em>, 26(4), 716–721.
                </p>
                <p>
                  <strong>Tinetti, M. E.</strong> (2003). Clinical practice: Preventing falls in elderly persons. <em>New England Journal of Medicine</em>, 348, 42–49.
                </p>
                <Button
                  onClick={() => window.open("https://www.apta.org/", "_blank")}
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  APTA Resources
                </Button>
              </CardContent>
            )}
          </Card>

          {/* Timer Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Test Timer</h3>
            <div className="flex items-center justify-between gap-4">
              <div className="text-5xl font-bold text-blue-600 font-mono">{timerSeconds.toFixed(2)}s</div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setTimerRunning(!timerRunning)}
                  variant={timerRunning ? "destructive" : "default"}
                  size="sm"
                >
                  {timerRunning ? (
                    <>
                      <Pause className="w-4 h-4 mr-1" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerSeconds(0);
                  }}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Trial Inputs */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <Label htmlFor="trial1" className="font-semibold text-sm">
                Trial 1 (seconds)
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="trial1"
                  type="number"
                  step="0.01"
                  value={data.trial1}
                  onChange={(e) => setData({ ...data, trial1: e.target.value })}
                  placeholder="Time"
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTimerRunning(false);
                    setData({ ...data, trial1: timerSeconds.toFixed(2) });
                  }}
                  disabled={timerSeconds === 0}
                >
                  Use
                </Button>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <Label htmlFor="trial2" className="font-semibold text-sm">
                Trial 2 (seconds)
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="trial2"
                  type="number"
                  step="0.01"
                  value={data.trial2}
                  onChange={(e) => setData({ ...data, trial2: e.target.value })}
                  placeholder="Time"
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTimerRunning(false);
                    setData({ ...data, trial2: timerSeconds.toFixed(2) });
                  }}
                  disabled={timerSeconds === 0}
                >
                  Use
                </Button>
              </div>
            </div>
          </div>

          {/* Results Display */}
          {calculateBest() && (
            <div className={`border-2 rounded-lg p-4 ${getInterpretation(calculateBest()).color}`}>
              <h4 className="font-semibold text-slate-900 mb-2">Best Time &amp; Fall Risk Assessment</h4>
              <p className="text-3xl font-bold mb-1">{calculateBest().toFixed(2)}s</p>
              <p className="font-semibold">{getInterpretation(calculateBest()).text}</p>
            </div>
          )}

          {/* Observations */}
          <div>
            <Label htmlFor="observations" className="font-semibold text-sm">
              Observations &amp; Clinical Notes
            </Label>
            <Textarea
              id="observations"
              value={data.observations}
              onChange={(e) => setData({ ...data, observations: e.target.value })}
              className="mt-2"
              rows={3}
              placeholder="Direction of difficulty, near misses, hesitations, hand use for balance, technique quality..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-slate-50 px-6 py-4 flex justify-between gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!data.trial1} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Save Results
          </Button>
        </div>
      </div>
    </div>
  );
}