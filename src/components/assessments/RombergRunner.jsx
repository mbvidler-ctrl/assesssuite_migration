import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Play, Pause, RotateCcw, ExternalLink, ChevronDown, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { todayLocal } from "@/lib/localDate";

export default function RombergRunner({ onSave, onClose, initialData }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [data, setData] = useState({
    eyes_open_time: initialData?.eyes_open_time || "",
    eyes_closed_time: initialData?.eyes_closed_time || "",
    result: initialData?.result || "",
    observations: initialData?.observations || ""
  });

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 0.1);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const handleSave = () => {
    if (!data.result) {
      toast.error("Please select a test result before saving.");
      return;
    }

    const eyesOpen = parseFloat(data.eyes_open_time) || 0;
    const eyesClosed = parseFloat(data.eyes_closed_time) || 0;
    let interpretation = '';
    
    if (data.result === 'positive') {
      interpretation = 'Positive Romberg - Proprioceptive/vestibular deficit likely';
    } else if (data.result === 'negative') {
      interpretation = 'Negative Romberg - Normal balance control maintained';
    }

    const soapText = [
      `• Romberg Test of Standing Balance: ${interpretation}`,
      `  Eyes Open: ${eyesOpen > 0 ? eyesOpen.toFixed(1) + 's' : 'Not recorded'}`,
      `  Eyes Closed: ${eyesClosed > 0 ? eyesClosed.toFixed(1) + 's' : 'Not recorded'}`,
      data.observations ? `  Observations: ${data.observations}` : null,
      `  Reference: Romberg MH (1853); Lanska & Goetz (2000). Neurology, 55(8), 1201-1206.`,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: data.result === 'positive' ? 1 : 0,
      additional_data: {
        soap_text: soapText,
        eyes_open_time: eyesOpen || null,
        eyes_closed_time: eyesClosed || null,
        result: data.result,
        interpretation,
        observations: data.observations,
        measurement_type: 'romberg'
      },
      notes: data.observations,
      assessment_date: todayLocal()
    });
    toast.success("Romberg Test results saved.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto p-6 space-y-4">
        
        {/* Header */}
        <div className="border-b pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Romberg Test of Standing Balance</h1>
            <p className="text-slate-600 mt-2">Assessment of proprioceptive and vestibular balance control</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Instructions & Clinical Guidance */}
        <Collapsible defaultOpen={true}>
          <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-slate-900 hover:bg-slate-50 p-2 rounded">
            <ChevronDown className="w-4 h-4" /> Instructions & Clinical Guidance
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="protocol">Protocol</TabsTrigger>
                <TabsTrigger value="interpretation">Interpretation</TabsTrigger>
                <TabsTrigger value="references">References</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Info className="w-5 h-5" /> Assessment Overview
                  </h4>
                  <div className="space-y-3 text-sm text-blue-800">
                    <p>
                      The Romberg Test is a clinical neurological assessment used to evaluate proprioceptive and vestibular balance control. It distinguishes between sensory ataxia and cerebellar dysfunction.
                    </p>
                    <p>
                      <strong>Purpose:</strong> Assess whether vision is necessary to maintain standing balance. A positive test (loss of balance with eyes closed) indicates proprioceptive or vestibular dysfunction.
                    </p>
                    <p>
                      <strong>Population:</strong> Useful in evaluating neurological conditions, vestibular disorders, proprioceptive neuropathy, and general balance deficits. Can be used with any age group.
                    </p>
                    <p>
                      <strong>Safety:</strong> Clinician must stand nearby to catch client if balance is lost. Test is contraindicated if client has severe balance problems at baseline.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="protocol" className="mt-4 space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3">Test Protocol</h4>
                  <div className="space-y-4 text-sm text-green-800">
                    <div>
                      <p className="font-semibold mb-2">Pre-Test Setup:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Ensure safe environment with clear space around client</li>
                        <li>Remove obstacles and ensure non-slip surface</li>
                        <li>Stand close by (arm's reach) to provide safety support</li>
                        <li>Ensure good lighting to observe client clearly</li>
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-green-300">
                      <p className="font-semibold mb-2">Client Instructions:</p>
                      <p className="italic text-green-700 bg-white p-2 rounded border border-green-200">
                        "Stand with your feet together and arms at your sides, looking straight ahead. I will time two 30-second periods. First, keep your eyes open. Then I'll ask you to close your eyes. Tell me if you feel like you're going to fall."
                      </p>
                    </div>
                    <div className="pt-3 border-t border-green-300">
                      <p className="font-semibold mb-2">Test Execution:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Eyes Open: Time 30 seconds while client stands with eyes open</li>
                        <li>Eyes Closed: Time 30 seconds while client stands with eyes closed</li>
                        <li>Record actual time if client loses balance before 30 seconds</li>
                        <li>Catch client immediately if balance is lost (safety first)</li>
                        <li>Observe for sway, compensatory arm movements, and foot positioning</li>
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-green-300">
                      <p className="font-semibold mb-2">Stopping Criteria:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Client loses balance or falls</li>
                        <li>Client opens eyes during eyes-closed phase (record time)</li>
                        <li>Client reports severe dizziness or distress</li>
                        <li>30 seconds completed successfully</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="interpretation" className="mt-4 space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-3">Interpretation Guidelines</h4>
                  <div className="space-y-4 text-sm text-purple-800">
                    <p className="font-semibold">True Romberg Test Findings:</p>
                    <div className="space-y-2">
                      <div className="bg-white border border-purple-200 rounded p-3">
                        <p className="font-semibold text-green-700">Negative Romberg (Normal)</p>
                        <p className="text-xs mt-1">• Stable stance with eyes open (≥30 seconds)</p>
                        <p className="text-xs">• Stable stance with eyes closed (≥30 seconds)</p>
                        <p className="text-xs">• Minimal sway in either condition</p>
                      </div>
                      <div className="bg-white border border-purple-200 rounded p-3">
                        <p className="font-semibold text-amber-700">Positive Romberg (Proprioceptive/Vestibular Deficit)</p>
                        <p className="text-xs mt-1">• Stable with eyes open (normal vision compensation)</p>
                        <p className="text-xs">• Instability, sway, or fall with eyes closed (vision-dependent balance)</p>
                        <p className="text-xs">• Suggests: Proprioceptive neuropathy, vestibular dysfunction, dorsal column disease</p>
                      </div>
                      <div className="bg-white border border-purple-200 rounded p-3">
                        <p className="font-semibold text-red-700">Unsteady Both Conditions (NOT True Romberg)</p>
                        <p className="text-xs mt-1">• Imbalance with eyes open AND closed</p>
                        <p className="text-xs">• Suggests: Cerebellar dysfunction, basal ganglia disorder, motor weakness</p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-purple-300">
                      <p className="font-semibold">Normal Duration:</p>
                      <p className="text-xs">• Healthy adults: Can stand ≥30 seconds both conditions</p>
                      <p className="text-xs">• Older adults: May show mild increased sway but remain stable</p>
                      <p className="text-xs">• Loss of balance before 30s (particularly with eyes closed) = significant finding</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="references" className="mt-4 space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-3">References & Evidence</h4>
                  <div className="space-y-2 text-sm">
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/11076821/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-amber-700 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Lanska DJ, Goetz CG. (2000). Romberg's sign: development, adoption, and adaptation. Neurology 55(8):1201-1206
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/16954293/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-amber-700 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Springer S, Yogev Shalev G, Madigan ML, et al. (2006). Effects of dual tasking on gait variability. J Gerontol 61A(4):356-364
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/23229896/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-amber-700 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Tinetti ME. (2003). Clinical practice. Preventing falls in elderly persons. N Engl J Med 348:42-49
                    </a>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>

        {/* Test Execution */}
        <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border-blue-300">
          <CardHeader>
            <CardTitle>Test Execution & Timing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-3">30-Second Timer</h4>
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-blue-600 font-mono">
                  {timerSeconds.toFixed(1)}s
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setTimerRunning(!timerRunning)}
                    variant={timerRunning ? "destructive" : "default"}
                    size="lg"
                  >
                    {timerRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {timerRunning ? 'Stop' : 'Start'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setTimerRunning(false);
                      setTimerSeconds(0);
                    }}
                    variant="outline"
                    size="lg"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
              {timerSeconds >= 30 && (
                <p className="mt-3 text-green-600 font-semibold text-lg">✓ 30 seconds completed</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <Label htmlFor="eyes_open" className="font-semibold block mb-2">Eyes Open Duration (seconds)</Label>
                <div className="flex gap-2">
                  <Input
                    id="eyes_open"
                    type="number"
                    step="0.1"
                    max="30"
                    value={data.eyes_open_time}
                    onChange={(e) => setData({...data, eyes_open_time: e.target.value})}
                    placeholder="0.0 to 30.0"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setTimerRunning(false);
                      setData({...data, eyes_open_time: Math.min(timerSeconds, 30).toFixed(1)});
                    }}
                    disabled={timerSeconds === 0}
                  >
                    Use
                  </Button>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <Label htmlFor="eyes_closed" className="font-semibold block mb-2">Eyes Closed Duration (seconds)</Label>
                <div className="flex gap-2">
                  <Input
                    id="eyes_closed"
                    type="number"
                    step="0.1"
                    max="30"
                    value={data.eyes_closed_time}
                    onChange={(e) => setData({...data, eyes_closed_time: e.target.value})}
                    placeholder="0.0 to 30.0"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setTimerRunning(false);
                      setData({...data, eyes_closed_time: Math.min(timerSeconds, 30).toFixed(1)});
                    }}
                    disabled={timerSeconds === 0}
                  >
                    Use
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Result */}
        <Card>
          <CardHeader>
            <CardTitle>Test Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Select the overall result based on balance performance with eyes open and closed:
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={data.result === 'negative' ? "default" : "outline"}
                  onClick={() => setData({...data, result: 'negative'})}
                  className="h-auto py-4 flex-col"
                >
                  <span className="font-semibold">Negative (Normal)</span>
                  <span className="text-xs mt-1">Stable eyes open and closed</span>
                </Button>
                <Button
                  type="button"
                  variant={data.result === 'positive' ? "default" : "outline"}
                  onClick={() => setData({...data, result: 'positive'})}
                  className="h-auto py-4 flex-col"
                >
                  <span className="font-semibold">Positive (Abnormal)</span>
                  <span className="text-xs mt-1">Unstable with eyes closed</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Observations */}
        <div>
          <Label htmlFor="observations" className="font-semibold block mb-2">Clinical Observations</Label>
          <Textarea
            id="observations"
            value={data.observations}
            onChange={(e) => setData({...data, observations: e.target.value})}
            placeholder="Describe sway direction, compensatory strategies, arm movements, near-falls, pain or dizziness reports, environmental factors..."
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!data.result}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Romberg Test Results
          </Button>
        </div>
      </div>
    </div>
  );
}