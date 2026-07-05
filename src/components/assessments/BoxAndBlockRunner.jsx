import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Play, Pause, RotateCcw, Plus, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

export default function BoxAndBlockRunner({ client, onSave, onClose, initialData }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);

  // Calculate age from DOB if available
  const clientAge = client?.date_of_birth ? Math.floor((new Date() - new Date(client.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) : null;
  const clientSex = client?.gender ? client.gender.charAt(0).toUpperCase() + client.gender.slice(1) : null;

  const [data, setData] = useState({
    dominant_hand: initialData?.dominant_hand || "right",
    dominant_count: initialData?.dominant_count || 0,
    non_dominant_count: initialData?.non_dominant_count || 0,
    observations: initialData?.observations || ""
  });

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          const newTime = prev + 0.1;
          if (newTime >= 60) {
            setTimerRunning(false);
            return 60;
          }
          return newTime;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const handleSave = () => {
    const dom = parseInt(data.dominant_count) || 0;
    const nonDom = parseInt(data.non_dominant_count) || 0;
    const soapText = `• Box and Block Test\n  Dominant Hand (${data.dominant_hand}): ${dom} blocks\n  Non-Dominant Hand: ${nonDom} blocks\n  Asymmetry: ${Math.abs(dom - nonDom)} blocks${data.observations ? `\n  Observations: ${data.observations}` : ''}`;
    onSave({
      result_value: dom,
      additional_data: {
        soap_text: soapText,
        dominant_hand: data.dominant_hand,
        dominant_count: dom,
        non_dominant_count: nonDom,
        total_blocks: dom + nonDom,
      },
      notes: data.observations,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl bg-white max-h-[92vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 sticky top-0 bg-white z-10 border-b pb-4">
          <div>
            <CardTitle className="text-xl font-bold">Box and Block Test</CardTitle>
            {client && (
              <p className="text-sm text-slate-600 mt-1">Client: <strong>{client.full_name}</strong></p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">

          {/* Equipment & Instructions (collapsible) */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between bg-blue-50 px-4 py-3 text-left"
              onClick={() => setShowInstructions(!showInstructions)}
            >
              <span className="font-semibold text-blue-900 text-sm">📋 Equipment, Instructions & References</span>
              {showInstructions ? <ChevronUp className="w-4 h-4 text-blue-700" /> : <ChevronDown className="w-4 h-4 text-blue-700" />}
            </button>
            {showInstructions && (
              <div className="bg-white px-4 py-4 space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Equipment Required</h4>
                  <ul className="list-disc list-inside text-slate-700 space-y-1">
                    <li>Standardised wooden box: <strong>53.7 cm long × 25.4 cm wide × 8.5 cm high</strong> with a central partition of the same height dividing it into two equal compartments</li>
                    <li><strong>150 wooden blocks</strong>, each a <strong>2.5 cm cube</strong></li>
                    <li>All 150 blocks placed in one compartment at the start of each trial</li>
                    <li>Stopwatch (60-second count)</li>
                    <li>Table at appropriate height for the client (seated)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Test Protocol</h4>
                  <ol className="list-decimal list-inside text-slate-700 space-y-1">
                    <li>Client sits at a table with the box placed lengthwise in front of them</li>
                    <li>All 150 blocks placed in the compartment on the side of the hand being tested</li>
                    <li><strong>Practice trial:</strong> Allow 15 seconds to familiarise with the task</li>
                    <li>Instruct client: <em>"Move as many blocks as possible, one at a time, from this side to the other side, over the partition, as fast as you can. If you move 2 blocks at a time, they will not be counted. You may not grasp blocks already in the other side."</em></li>
                    <li>Start the 60-second timer and count blocks moved</li>
                    <li>Test the dominant hand first, then the non-dominant hand</li>
                    <li>Record the number of blocks successfully moved in 60 seconds for each hand</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Scoring</h4>
                  <p className="text-slate-700">Score = number of blocks transferred in 60 seconds per hand. Only blocks that clear the partition and land fully in the opposite compartment count. Blocks moved two at a time do not count.</p>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Where to Purchase</h4>
                  <p className="text-slate-600 text-xs mb-2">The standardised Box and Block Test kit (box + 150 cubes) is available from several suppliers:</p>
                  <div className="space-y-1.5 mb-4">
                    <a href="https://www.fabrication-enterprises.com/products/box-and-block-test" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      Fabrication Enterprises (US) – Original manufacturer
                    </a>
                    <a href="https://www.performancehealth.com/box-and-block-test" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      Performance Health / Patterson Medical
                    </a>
                    <a href="https://www.stoeltingco.com/box-and-block-test.html" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      Stoelting Co. – Research-grade kit
                    </a>
                    <a href="https://www.physioworks.com.au" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      PhysioWorks Australia (search "Box and Block Test")
                    </a>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">References & Resources</h4>
                  <div className="space-y-2">
                    <a
                      href="https://www.sralab.org/rehabilitation-measures/box-and-block-test"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      Shirley Ryan AbilityLab – Box and Block Test (Normative Data & Instructions)
                    </a>
                    <a
                      href="https://www.physio-pedia.com/Box_and_Block_Test"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      Physiopedia – Box and Block Test
                    </a>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/3908171/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      Mathiowetz et al. (1985) – Original normative data (PubMed)
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Client Demographics */}
          {(clientAge || clientSex) && (
            <div className="grid md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
              {clientAge && (
                <div>
                  <Label className="text-sm text-slate-700">Age</Label>
                  <p className="text-lg font-semibold text-slate-900">{clientAge} years</p>
                </div>
              )}
              {clientSex && (
                <div>
                  <Label className="text-sm text-slate-700">Sex</Label>
                  <p className="text-lg font-semibold text-slate-900">{clientSex}</p>
                </div>
              )}
            </div>
          )}

          {/* Timer */}
           <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
             <h3 className="font-semibold text-slate-900 mb-3">60-Second Timer</h3>
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-bold font-mono ${timerSeconds >= 60 ? 'text-green-600' : 'text-blue-600'}`}>
                {(60 - timerSeconds).toFixed(1)}s
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => setTimerRunning(!timerRunning)}
                  variant={timerRunning ? "destructive" : "default"}
                  size="sm"
                  disabled={timerSeconds >= 60}
                >
                  {timerRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  {timerRunning ? 'Stop' : 'Start'}
                </Button>
                <Button
                  type="button"
                  onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {timerSeconds >= 60 && (
              <p className="mt-2 text-green-600 font-semibold">✓ 60 seconds complete! Record block count below.</p>
            )}
          </div>

          {/* Dominant Hand Selection */}
          <div>
            <Label>Dominant Hand</Label>
            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant={data.dominant_hand === 'right' ? "default" : "outline"}
                onClick={() => setData({ ...data, dominant_hand: 'right' })}
                className="flex-1"
              >
                Right
              </Button>
              <Button
                type="button"
                variant={data.dominant_hand === 'left' ? "default" : "outline"}
                onClick={() => setData({ ...data, dominant_hand: 'left' })}
                className="flex-1"
              >
                Left
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Dominant Hand */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <Label className="mb-3 block font-semibold">
                {data.dominant_hand === 'right' ? 'Right' : 'Left'} Hand (Dominant)
              </Label>
              <div className="flex items-center justify-center gap-4 mb-3">
                <Button type="button" onClick={() => setData({ ...data, dominant_count: Math.max(0, data.dominant_count - 1) })} variant="outline" size="sm">-</Button>
                <div className="text-5xl font-bold text-blue-600">{data.dominant_count}</div>
                <Button type="button" onClick={() => setData({ ...data, dominant_count: data.dominant_count + 1 })} variant="default" size="sm"><Plus className="w-4 h-4" /></Button>
              </div>
              <Input
                type="number"
                value={data.dominant_count}
                onChange={(e) => setData({ ...data, dominant_count: parseInt(e.target.value) || 0 })}
                className="text-center text-xl font-bold"
                placeholder="Blocks moved"
              />
              <p className="text-xs text-slate-500 mt-1 text-center">blocks in 60 seconds</p>
            </div>

            {/* Non-Dominant Hand */}
            <div className="bg-green-50 p-4 rounded-lg">
              <Label className="mb-3 block font-semibold">
                {data.dominant_hand === 'right' ? 'Left' : 'Right'} Hand (Non-Dominant)
              </Label>
              <div className="flex items-center justify-center gap-4 mb-3">
                <Button type="button" onClick={() => setData({ ...data, non_dominant_count: Math.max(0, data.non_dominant_count - 1) })} variant="outline" size="sm">-</Button>
                <div className="text-5xl font-bold text-green-600">{data.non_dominant_count}</div>
                <Button type="button" onClick={() => setData({ ...data, non_dominant_count: data.non_dominant_count + 1 })} variant="default" size="sm"><Plus className="w-4 h-4" /></Button>
              </div>
              <Input
                type="number"
                value={data.non_dominant_count}
                onChange={(e) => setData({ ...data, non_dominant_count: parseInt(e.target.value) || 0 })}
                className="text-center text-xl font-bold"
                placeholder="Blocks moved"
              />
              <p className="text-xs text-slate-500 mt-1 text-center">blocks in 60 seconds</p>
            </div>
          </div>

          {(data.dominant_count > 0 || data.non_dominant_count > 0) && (
            <div className="bg-slate-100 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-3">Results Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-600">Dominant</p>
                  <p className="text-2xl font-bold text-blue-600">{data.dominant_count}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Non-Dominant</p>
                  <p className="text-2xl font-bold text-green-600">{data.non_dominant_count}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Asymmetry</p>
                  <p className={`text-2xl font-bold ${Math.abs(data.dominant_count - data.non_dominant_count) > 10 ? 'text-red-600' : 'text-slate-700'}`}>
                    {Math.abs(data.dominant_count - data.non_dominant_count)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="observations">Observations</Label>
            <Textarea
              id="observations"
              value={data.observations}
              onChange={(e) => setData({ ...data, observations: e.target.value })}
              className="mt-1"
              rows={2}
              placeholder="Grip quality, tremor, dropped blocks, fatigue, compensatory strategies..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={data.dominant_count === 0 && data.non_dominant_count === 0}>
              <Save className="w-4 h-4 mr-2" />
              Save Results
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}