import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, X, Play, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function ApleysCompressionTestRunner({ client, onSave, onClose }) {
  const [trialData, setTrialData] = useState([]);
  const [notes, setNotes] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isTestCompleted, setIsTestCompleted] = useState(false);

  const handleStartTest = () => {
    setIsRunning(true);
    setIsTestCompleted(false);
    setTrialData([]);
    setNotes("");
  };

  const handleEndTest = () => {
    setIsRunning(false);
    setIsTestCompleted(true);
    const resultValue = calculateResultValue(trialData);
    const additionalData = {
      soap_text: `â€¢ Apley's Compression Test\n  Positive Trials: ${resultValue}\n  Pain Locations: ${trialData.map(t => t.painLocation).join(', ')}`,
      measurement_type: "ApleysCompressionTest",
      trials: trialData,
    };
    onSave({
      status: "completed",
      result_value: resultValue,
      additional_data: additionalData,
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Test completed and saved successfully.");
  };

  const handleAddTrial = (painLocation) => {
    if (!isRunning) {
      toast.error("Please start the test before adding trials.");
      return;
    }
    const newTrial = { painLocation, timestamp: new Date().toISOString() };
    setTrialData((prevData) => [...prevData, newTrial]);
    toast.success("Trial added successfully.");
  };

  const handleRemoveTrial = (index) => {
    const updatedData = [...trialData];
    updatedData.splice(index, 1);
    setTrialData(updatedData);
    toast.success("Trial removed successfully.");
  };

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
  };

  const calculateResultValue = (trials) => {
    const positiveTrials = trials.filter(
      (trial) => trial.painLocation !== "none"
    ).length;
    return positiveTrials;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        {/* Clinician Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
          <p className="font-semibold">ðŸ“‹ Administration Instructions</p>
          <p><strong>Position:</strong> Client prone with knee flexed to 90Â°. Clinician stabilises thigh by kneeling on popliteal fossa (or applies counterpressure).</p>
          <p><strong>Compression:</strong> Apply downward axial force through the heel/foot. Rotate tibia medially and laterally while maintaining compression. Note location and quality of pain.</p>
          <p><strong>Distraction:</strong> Lift the leg (distraction) and repeat rotation. Compare: if pain is greater with compression than distraction â†’ meniscal pathology more likely. If pain greater with distraction â†’ ligamentous/capsular involvement more likely.</p>
          <p><strong>Positive test:</strong> Medial or lateral joint-line pain during compression with rotation.</p>
        </div>

        {/* Norms & Interpretation */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
          <p className="font-semibold text-slate-700">ðŸ“Š Diagnostic Accuracy</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-300 rounded">
              <thead className="bg-slate-200"><tr><th className="p-2 text-left">Metric</th><th className="p-2 text-center">Value</th></tr></thead>
              <tbody>
                <tr className="border-t border-slate-200"><td className="p-2">Sensitivity</td><td className="p-2 text-center">~61%</td></tr>
                <tr className="border-t border-slate-200 bg-white"><td className="p-2">Specificity</td><td className="p-2 text-center">~70%</td></tr>
                <tr className="border-t border-slate-200"><td className="p-2">Positive LR</td><td className="p-2 text-center">~2.0</td></tr>
                <tr className="border-t border-slate-200 bg-white"><td className="p-2">Negative LR</td><td className="p-2 text-center">~0.56</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Best used as part of a cluster of tests. Positive test alone has modest diagnostic value. MRI remains gold standard for meniscal tears.</p>
        </div>

        {/* Reference */}
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
          <p className="font-semibold">ðŸ“– Reference</p>
          <p>Apley AG. (1947). The diagnosis of meniscus injuries. <em>Journal of Bone and Joint Surgery, 29</em>(1), 78â€“84.</p>
          <p>Scholten RJPM et al. (2001). The accuracy of physical diagnostic tests for assessing meniscal lesions of the knee. <em>Journal of Family Practice, 50</em>(11), 938â€“944.</p>
        </div>

        <Card>
        <CardHeader>
          <CardTitle>Apley's Compression Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>
              The Apley's Compression Test assesses meniscal integrity by
              applying compression with rotation in the prone position. A
              positive test is indicated by pain during compression, suggesting
              meniscal pathology.
            </p>
            <p>
              The test involves the client lying prone with the knee flexed at
              90 degrees. The examiner applies downward pressure on the heel
              while rotating the tibia internally and externally.
            </p>
            <p>
              A positive result is indicated by pain during compression, which
              suggests meniscal pathology.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={handleStartTest}
          disabled={isRunning}
          className="flex items-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>Start Test</span>
        </Button>
        <Button
          variant="outline"
          onClick={handleEndTest}
          disabled={!isRunning}
          className="flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>End Test</span>
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          className="flex items-center space-x-2"
        >
          <X className="w-4 h-4" />
          <span>Close</span>
        </Button>
      </div>

      {isRunning && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Label htmlFor="painLocation">Pain Location</Label>
              <select
                id="painLocation"
                className="input"
                onChange={(e) =>
                  handleAddTrial(e.target.value)
                }
              >
                <option value="none">Select</option>
                <option value="medial">Medial</option>
                <option value="lateral">Lateral</option>
                <option value="none">No Pain</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Trial Data</h3>
            {trialData.length === 0 ? (
              <p>No trials added yet.</p>
            ) : (
              <ul className="space-y-2">
                {trialData.map((trial, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center"
                  >
                    <span>
                      Trial {index + 1}:{" "}
                      {trial.painLocation === "none"
                        ? "No Pain"
                        : `${trial.painLocation.charAt(0).toUpperCase() +
                            trial.painLocation.slice(1)} Pain`}
                    </span>
                    <Button
                      variant="link"
                      onClick={() => handleRemoveTrial(index)}
                      className="text-red-500"
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={handleNotesChange}
              placeholder="Enter any additional notes here..."
              rows={4}
            />
          </div>
        </div>
      )}

      {isTestCompleted && (
        <div className="space-y-2">
          <Badge variant="outline" className="text-green-500">
            Test Completed
          </Badge>
          <p>
            The test has been completed. The result value is{" "}
            {calculateResultValue(trialData)} positive trials.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}