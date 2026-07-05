import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Trash2 } from 'lucide-react';

const MMT_GRADES = [
  { value: 0, label: '0 - No contraction', description: 'No visible or palpable muscle contraction' },
  { value: 1, label: '1 - Trace', description: 'Slight contraction felt, no movement' },
  { value: 2, label: '2 - Poor', description: 'Full ROM with gravity eliminated' },
  { value: 3, label: '3 - Fair', description: 'Full ROM against gravity only' },
  { value: 4, label: '4 - Good', description: 'Full ROM against moderate resistance' },
  { value: 5, label: '5 - Normal', description: 'Full ROM against maximal resistance' }
];

const MUSCLE_GROUPS = {
  'Shoulder': ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Internal Rotation', 'External Rotation'],
  'Elbow': ['Flexion', 'Extension', 'Supination', 'Pronation'],
  'Wrist': ['Flexion', 'Extension', 'Radial Deviation', 'Ulnar Deviation'],
  'Hip': ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Internal Rotation', 'External Rotation'],
  'Knee': ['Flexion', 'Extension'],
  'Ankle': ['Dorsiflexion', 'Plantarflexion', 'Inversion', 'Eversion'],
  'Trunk': ['Flexion', 'Extension', 'Lateral Flexion Left', 'Lateral Flexion Right', 'Rotation Left', 'Rotation Right'],
  'Neck': ['Flexion', 'Extension', 'Lateral Flexion Left', 'Lateral Flexion Right', 'Rotation Left', 'Rotation Right']
};

const TESTING_POSITIONS = {
  'Shoulder Flexion': 'Seated or standing. Stabilize scapula. Arm at side, palm facing inward. Resist upward movement.',
  'Shoulder Extension': 'Prone with arm off edge of table or standing. Resist backward movement.',
  'Shoulder Abduction': 'Seated. Arm at side. Resist outward movement away from body.',
  'Shoulder Internal Rotation': 'Prone with shoulder abducted 90°, elbow flexed 90°. Resist internal rotation.',
  'Shoulder External Rotation': 'Prone with shoulder abducted 90°, elbow flexed 90°. Resist external rotation.',
  'Elbow Flexion': 'Seated, arm at side, elbow 90°, palm up. Resist flexion at forearm.',
  'Elbow Extension': 'Seated or standing, elbow flexed. Resist extension at forearm.',
  'Wrist Flexion': 'Forearm supported, wrist neutral. Resist flexion at hand.',
  'Wrist Extension': 'Forearm supported, wrist neutral. Resist extension at hand.',
  'Hip Flexion': 'Seated with knees flexed 90°. Resist at distal thigh.',
  'Hip Extension': 'Prone. Resist at posterior thigh.',
  'Hip Abduction': 'Side-lying, test leg up. Resist at lateral knee or ankle.',
  'Knee Flexion': 'Prone, knee flexed ~45-90°. Resist at posterior ankle.',
  'Knee Extension': 'Seated, knee flexed 90°. Resist at anterior ankle.',
  'Ankle Dorsiflexion': 'Seated or supine. Resist at dorsum of foot.',
  'Ankle Plantarflexion': 'Prone with foot over edge or seated. Resist at plantar surface.'
};

export default function ManualMuscleTestRunner({ initialData, onSave, onClose }) {
  const [tests, setTests] = useState(initialData?.tests || []);
  const [currentTest, setCurrentTest] = useState({
    region: '',
    movement: '',
    side: 'left',
    grade: null,
    notes: ''
  });

  const handleAddTest = () => {
    if (!currentTest.region || !currentTest.movement || currentTest.grade === null) return;
    setTests([...tests, { ...currentTest, id: Date.now() }]);
    setCurrentTest({
      region: currentTest.region,
      movement: '',
      side: 'left',
      grade: null,
      notes: ''
    });
  };

  const handleRemoveTest = (id) => {
    setTests(tests.filter(t => t.id !== id));
  };

  const handleSave = () => {
    const avgGrade = tests.length > 0 ? (tests.reduce((sum, t) => sum + t.grade, 0) / tests.length).toFixed(1) : 0;
    const testLines = tests.map(t =>
      `  ${t.region} ${t.movement} (${t.side}): ${t.grade}/5${t.notes ? ` — ${t.notes}` : ''}`
    ).join('\n');
    const soapText = `• Manual Muscle Testing (MMT):\n${testLines}\n  Average Grade: ${avgGrade}/5`;

    onSave({
      result_value: parseFloat(avgGrade),
      additional_data: {
        soap_text: soapText,
        tests,
        average_grade: parseFloat(avgGrade),
      },
      notes: '',
      assessment_date: new Date().toISOString().split('T')[0],
    });
  };

  const getPositionInstruction = () => {
    if (!currentTest.region || !currentTest.movement) return null;
    return TESTING_POSITIONS[`${currentTest.region} ${currentTest.movement}`];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-xl font-bold">Manual Muscle Testing (MMT)</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Clinician Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
            <p className="font-semibold">📋 Administration Instructions (Kendall/MRC Protocol)</p>
            <p><strong>Positioning:</strong> Stabilise proximal segment. Apply resistance at the distal segment of the limb being tested. Break-test (isometric) or active ROM method may be used.</p>
            <p><strong>Grades 0–2:</strong> Test in gravity-eliminated position. <strong>Grades 3–5:</strong> Test against gravity.</p>
            <p className="italic">"Move your [body part] as far as you can / Hold while I push."</p>
            <p><strong>Note:</strong> Grades may be modified (+/−) but this tool uses whole numbers for simplicity. Document any modifications.</p>
          </div>

          {/* Norms */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
            <p className="font-semibold text-slate-700">📊 MMT Grade Interpretation</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-300 rounded">
                <thead className="bg-slate-200"><tr><th className="p-2 text-left">Grade</th><th className="p-2 text-left">Label</th><th className="p-2 text-left">Clinical Meaning</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2">5</td><td className="p-2">Normal</td><td className="p-2 text-green-700">Full ROM, full resistance</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">4</td><td className="p-2">Good</td><td className="p-2 text-teal-700">Full ROM, some resistance</td></tr>
                  <tr className="border-t"><td className="p-2">3</td><td className="p-2">Fair</td><td className="p-2 text-yellow-700">Full ROM, gravity only</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">2</td><td className="p-2">Poor</td><td className="p-2 text-orange-700">Full ROM, gravity eliminated</td></tr>
                  <tr className="border-t"><td className="p-2">1</td><td className="p-2">Trace</td><td className="p-2 text-red-700">Contraction felt, no movement</td></tr>
                  <tr className="border-t bg-white"><td className="p-2">0</td><td className="p-2">Zero</td><td className="p-2 text-red-900">No contraction</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Reference */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold">📖 Reference</p>
            <p>Kendall FP, McCreary EK, Provance PG, Rodgers MM, & Romani WA. (2005). <em>Muscles: Testing and Function with Posture and Pain</em> (5th ed.). Lippincott Williams & Wilkins.</p>
            <p>Medical Research Council. (1981). <em>Aids to the Examination of the Peripheral Nervous System</em>. Her Majesty's Stationery Office.</p>
          </div>

          {/* Current Test Entry */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-slate-900">Add New Muscle Test</h3>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Body Region</Label>
                <Select value={currentTest.region} onValueChange={(value) => setCurrentTest({ ...currentTest, region: value, movement: '' })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(MUSCLE_GROUPS).map(region => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Movement</Label>
                <Select
                  value={currentTest.movement}
                  onValueChange={(value) => setCurrentTest({ ...currentTest, movement: value })}
                  disabled={!currentTest.region}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select movement" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentTest.region && MUSCLE_GROUPS[currentTest.region].map(movement => (
                      <SelectItem key={movement} value={movement}>{movement}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Side</Label>
                <Select value={currentTest.side} onValueChange={(value) => setCurrentTest({ ...currentTest, side: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                    <SelectItem value="bilateral">Bilateral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {getPositionInstruction() && (
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                <p className="text-sm font-semibold text-blue-900 mb-1">Testing Position:</p>
                <p className="text-sm text-blue-800">{getPositionInstruction()}</p>
              </div>
            )}

            <div>
              <Label className="mb-3 block font-semibold">MMT Grade (0-5)</Label>
              <div className="space-y-2">
                {MMT_GRADES.map((grade) => (
                  <Button
                    key={grade.value}
                    type="button"
                    variant={currentTest.grade === grade.value ? 'default' : 'outline'}
                    onClick={() => setCurrentTest({ ...currentTest, grade: grade.value })}
                    className="w-full justify-start text-left h-auto py-3"
                  >
                    <div>
                      <div className="font-bold">{grade.label}</div>
                      <div className="text-xs opacity-80">{grade.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={currentTest.notes}
                onChange={(e) => setCurrentTest({ ...currentTest, notes: e.target.value })}
                className="mt-1"
                rows={2}
                placeholder="Any observations..."
              />
            </div>

            <Button
              type="button"
              onClick={handleAddTest}
              disabled={!currentTest.region || !currentTest.movement || currentTest.grade === null}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add This Test
            </Button>
          </div>

          {/* Recorded Tests */}
          {tests.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Recorded Tests ({tests.length})</h3>
              <div className="space-y-2">
                {tests.map((test) => (
                  <div key={test.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        {test.region} - {test.movement} ({test.side})
                      </p>
                      <p className="text-sm text-slate-600">
                        Grade: <span className={`font-bold ${test.grade >= 4 ? 'text-green-600' : test.grade >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {test.grade}/5
                        </span>
                        {test.notes && ` • ${test.notes}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveTest(test.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={tests.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              Save MMT Results ({tests.length} tests)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}