import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Play, Square, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const NORMS = [
  { age: "60–64", male: "14–19", female: "12–17", below: "<14 / <12" },
  { age: "65–69", male: "12–18", female: "11–16", below: "<12 / <11" },
  { age: "70–74", male: "12–17", female: "10–15", below: "<12 / <10" },
  { age: "75–79", male: "11–17", female: "10–15", below: "<11 / <10" },
  { age: "80–84", male: "10–15", female: "9–14", below: "<10 / <9" },
  { age: "85–89", male: "8–14", female: "8–13", below: "<8 / <8" },
  { age: "90–94", male: "7–12", female: "4–11", below: "<7 / <4" },
];

function getInterpretation(count, age, gender) {
  const ageNum = parseInt(age);
  const norm = NORMS.find(n => {
    const [lo, hi] = n.age.split("–").map(Number);
    return ageNum >= lo && ageNum <= hi;
  });
  if (!norm || !count) return null;
  const [lo, hi] = (gender === "male" ? norm.male : norm.female).split("–").map(Number);
  if (count >= hi) return { label: "Above average", color: "text-green-700", bg: "bg-green-50 border-green-300" };
  if (count >= lo) return { label: "Average", color: "text-blue-700", bg: "bg-blue-50 border-blue-300" };
  return { label: "Below average — consider falls risk assessment", color: "text-red-700", bg: "bg-red-50 border-red-300" };
}

export default function ThirtySecondChairStandTestRunner({ client, onSave, onClose }) {
  const [isTesting, setIsTesting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [standCount, setStandCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [age, setAge] = useState(
    client?.date_of_birth
      ? String(Math.floor((Date.now() - new Date(client.date_of_birth)) / (365.25 * 24 * 3600 * 1000)))
      : ""
  );
  const [gender, setGender] = useState(client?.gender === "male" || client?.gender === "female" ? client.gender : "");
  const [showInstructions, setShowInstructions] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isTesting) return;
    if (timeLeft <= 0) {
      clearInterval(timerRef.current);
      setIsTesting(false);
      setIsCompleted(true);
      toast.success("30 seconds complete! Record final stand count.");
      return;
    }
    timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [isTesting, timeLeft]);

  const handleStart = () => {
    if (!age || !gender) { toast.error("Please enter age and gender first."); return; }
    setStandCount(0);
    setTimeLeft(30);
    setIsCompleted(false);
    setIsTesting(true);
  };

  const handleStop = () => {
    clearInterval(timerRef.current);
    setIsTesting(false);
    setIsCompleted(true);
  };

  const interp = getInterpretation(standCount, age, gender);

  const handleSave = () => {
    if (!isCompleted && standCount === 0) { toast.error("Please complete the test first."); return; }
    const soapText = [
      `• 30-Second Chair Stand Test`,
      `  Repetitions: ${standCount}`,
      interp ? `  Interpretation: ${interp.label}` : "",
      `  Age: ${age} | Gender: ${gender === "male" ? "Male" : "Female"}`,
      notes ? `  Notes: ${notes}` : "",
      `  MCID: 2–3 repetitions | <10 reps: consider falls risk referral`,
      `  Reference: Rikli & Jones (1999). Journal of Aging and Physical Activity, 7(2), 129–161.`,
    ].filter(Boolean).join("\n");

    onSave({
      status: "completed",
      result_value: standCount,
      additional_data: {
        soap_text: soapText,
        measurement_type: "30_second_chair_stand",
        stand_count: standCount,
        age,
        gender,
        interpretation: interp?.label,
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
    toast.success("Assessment saved.");
  };

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">30-Second Chair Stand Test</h2>
          <p className="text-sm text-slate-500">Lower body strength &amp; functional mobility — Rikli &amp; Jones</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Instructions */}
      <div className="border border-blue-200 rounded-lg overflow-hidden">
        <button onClick={() => setShowInstructions(v => !v)}
          className="w-full flex justify-between items-center bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          📋 Administration Instructions (Rikli &amp; Jones Protocol)
          {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showInstructions && (
          <div className="bg-blue-50 px-4 pb-4 text-sm text-blue-800 space-y-2">
            <p><strong>Setup:</strong> Standard chair (~43 cm seat height) against a wall. Client sits in middle of seat, feet shoulder-width apart and flat on floor, arms crossed over chest.</p>
            <p className="italic">"When I say 'Go', rise to a full standing position then sit back down. Repeat as many times as you can in 30 seconds. I'll be counting your complete stands."</p>
            <p><strong>Count:</strong> Count each time client reaches full standing position. If client is more than halfway up when time expires, count as a full stand. Note if hands are used for support.</p>
            <p><strong>Safety:</strong> Demonstrate the movement first. Ensure client is stable before starting. Stop if client reports dizziness, chest pain, or joint pain.</p>
          </div>
        )}
      </div>

      {/* Normative Table */}
      <div className="border border-slate-200 rounded-lg p-3">
        <p className="font-semibold text-slate-700 text-sm mb-2">📊 Normative Values — 30-Second Sit-to-Stand (repetitions)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-slate-300 rounded overflow-hidden">
            <thead className="bg-slate-200">
              <tr>
                <th className="p-2 text-left">Age</th>
                <th className="p-2 text-center">Men (avg)</th>
                <th className="p-2 text-center">Women (avg)</th>
                <th className="p-2 text-center">Below Average</th>
              </tr>
            </thead>
            <tbody>
              {NORMS.map((n, i) => (
                <tr key={n.age} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="p-2 font-medium">{n.age}</td>
                  <td className="p-2 text-center text-blue-700">{n.male}</td>
                  <td className="p-2 text-center text-pink-700">{n.female}</td>
                  <td className="p-2 text-center text-red-600">{n.below}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-1">Source: Rikli &amp; Jones (1999, 2013). Senior Fitness Test Manual.</p>
      </div>

      {/* Setup */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Client Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-600">Age</Label>
            <Input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 70" disabled={isTesting} className="mt-1 h-9" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Gender</Label>
            <select value={gender} onChange={e => setGender(e.target.value)} disabled={isTesting}
              className="w-full mt-1 h-9 border border-slate-300 rounded-md px-2 text-sm bg-white">
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timer + Counter */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className={`px-4 py-2 text-sm font-semibold text-center ${isTesting ? "bg-green-100 text-green-800" : isCompleted ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}>
          {isTesting ? "🟢 Test Running — Count every full stand!" : isCompleted ? "✅ Test Complete" : "Ready to start"}
        </div>

        <div className="bg-white p-5 flex flex-col items-center gap-4">
          {/* Timer */}
          <div className={`text-8xl font-bold font-mono tabular-nums ${isTesting ? (timeLeft <= 5 ? "text-red-600" : "text-green-600") : "text-slate-300"}`}>
            {timeLeft}
          </div>
          <p className="text-xs text-slate-400 -mt-2">seconds remaining</p>

          {/* Big counter button */}
          {isTesting && (
            <button onClick={() => setStandCount(c => c + 1)}
              className="w-full max-w-xs py-8 rounded-2xl bg-green-600 hover:bg-green-700 active:scale-95 transition-transform text-white text-center shadow-lg">
              <div className="text-6xl font-bold">{standCount}</div>
              <div className="text-lg font-semibold mt-1">TAP TO COUNT STAND</div>
            </button>
          )}

          {!isTesting && isCompleted && (
            <div className="text-center">
              <div className="text-6xl font-bold text-slate-800">{standCount}</div>
              <div className="text-sm text-slate-500 mt-1">stands completed</div>
              {/* Manual adjust after test */}
              <div className="flex items-center gap-3 mt-3 justify-center">
                <Button variant="outline" size="sm" onClick={() => setStandCount(c => Math.max(0, c - 1))}>−</Button>
                <span className="text-xs text-slate-500">Adjust count</span>
                <Button variant="outline" size="sm" onClick={() => setStandCount(c => c + 1)}>+</Button>
              </div>
            </div>
          )}

          {!isTesting && !isCompleted && (
            <div className="text-5xl font-bold text-slate-200">—</div>
          )}

          {/* Controls */}
          <div className="flex gap-3">
            {!isTesting ? (
              <Button onClick={handleStart} className="bg-green-600 hover:bg-green-700 text-white px-8">
                <Play className="w-4 h-4 mr-2" /> Start Test
              </Button>
            ) : (
              <Button onClick={handleStop} variant="destructive" className="px-8">
                <Square className="w-4 h-4 mr-2" /> Stop Early
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Live interpretation */}
      {isCompleted && interp && (
        <div className={`rounded-lg border px-4 py-3 ${interp.bg}`}>
          <p className="font-semibold text-sm text-slate-800">{standCount} repetitions — <span className={interp.color}>{interp.label}</span></p>
        </div>
      )}

      <div>
        <Label className="text-sm font-semibold text-slate-700">Notes</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Hands used for support? Balance issues? Pain reported? Assistive device..." className="mt-1 text-sm" />
      </div>

      {/* References */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">📖 References</p>
        <p>1. Rikli RE &amp; Jones CJ. (1999). Development and validation of a functional fitness test for community-residing older adults. <em>Journal of Aging and Physical Activity</em>, 7(2), 129–161.</p>
        <p>2. Rikli RE &amp; Jones CJ. (2013). <em>Senior Fitness Test Manual</em> (2nd ed.). Human Kinetics.</p>
        <p>3. Bohannon RW. (2006). Reference values for the five-repetition sit-to-stand test. <em>Journal of Strength and Conditioning Research</em>.</p>
      </div>

      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" />Close</Button>
        <Button onClick={handleSave} disabled={isTesting || (!isCompleted && standCount === 0)}
          className="bg-blue-600 hover:bg-blue-700 text-white">
          Save Assessment
        </Button>
      </div>
    </div>
  );
}