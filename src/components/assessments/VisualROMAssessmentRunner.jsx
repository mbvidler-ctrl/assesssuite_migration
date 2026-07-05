import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { X, Save, ChevronRight, ChevronLeft, CheckCircle, AlertCircle, RotateCcw } from "lucide-react";

// ─── Joint + movement definitions ───────────────────────────────────────────
const JOINTS = [
  {
    key: "cervical", label: "Cervical Spine", emoji: "🔵",
    movements: ["Flexion","Extension","Lat. Flexion (L)","Lat. Flexion (R)","Rotation (L)","Rotation (R)"],
    normals:   ["40-60°","50-70°","35-45°","35-45°","60-80°","60-80°"],
  },
  {
    key: "thoracic", label: "Thoracic Spine", emoji: "🟣",
    movements: ["Rotation (L)","Rotation (R)","Extension","Lat. Flexion (L)","Lat. Flexion (R)"],
    normals:   ["30-35°","30-35°","15-20°","15-20°","15-20°"],
  },
  {
    key: "lumbar", label: "Lumbar Spine", emoji: "🟠",
    movements: ["Flexion","Extension","Lat. Flexion (L)","Lat. Flexion (R)","Rotation (L)","Rotation (R)"],
    normals:   ["40-60°","20-35°","20-30°","20-30°","5-15°","5-15°"],
  },
  {
    key: "shoulder_L", label: "Shoulder (Left)", emoji: "💪",
    movements: ["Flexion","Extension","Abduction","Adduction","Ext. Rotation","Int. Rotation"],
    normals:   ["0-180°","0-60°","0-180°","0-30°","0-90°","0-70°"],
  },
  {
    key: "shoulder_R", label: "Shoulder (Right)", emoji: "💪",
    movements: ["Flexion","Extension","Abduction","Adduction","Ext. Rotation","Int. Rotation"],
    normals:   ["0-180°","0-60°","0-180°","0-30°","0-90°","0-70°"],
  },
  {
    key: "elbow_L", label: "Elbow (Left)", emoji: "🦾",
    movements: ["Flexion","Extension","Supination","Pronation"],
    normals:   ["0-150°","0°","0-80°","0-80°"],
  },
  {
    key: "elbow_R", label: "Elbow (Right)", emoji: "🦾",
    movements: ["Flexion","Extension","Supination","Pronation"],
    normals:   ["0-150°","0°","0-80°","0-80°"],
  },
  {
    key: "wrist_L", label: "Wrist (Left)", emoji: "✋",
    movements: ["Flexion","Extension","Radial Dev.","Ulnar Dev."],
    normals:   ["0-80°","0-70°","0-20°","0-30°"],
  },
  {
    key: "wrist_R", label: "Wrist (Right)", emoji: "✋",
    movements: ["Flexion","Extension","Radial Dev.","Ulnar Dev."],
    normals:   ["0-80°","0-70°","0-20°","0-30°"],
  },
  {
    key: "hip_L", label: "Hip (Left)", emoji: "🦵",
    movements: ["Flexion","Extension","Abduction","Adduction","Int. Rotation","Ext. Rotation"],
    normals:   ["0-120°","0-20°","0-45°","0-30°","0-45°","0-45°"],
  },
  {
    key: "hip_R", label: "Hip (Right)", emoji: "🦵",
    movements: ["Flexion","Extension","Abduction","Adduction","Int. Rotation","Ext. Rotation"],
    normals:   ["0-120°","0-20°","0-45°","0-30°","0-45°","0-45°"],
  },
  {
    key: "knee_L", label: "Knee (Left)", emoji: "🦿",
    movements: ["Flexion","Extension"],
    normals:   ["0-135°","0°"],
  },
  {
    key: "knee_R", label: "Knee (Right)", emoji: "🦿",
    movements: ["Flexion","Extension"],
    normals:   ["0-135°","0°"],
  },
  {
    key: "ankle_L", label: "Ankle (Left)", emoji: "🦶",
    movements: ["Dorsiflexion","Plantarflexion","Inversion","Eversion"],
    normals:   ["0-20°","0-50°","0-35°","0-15°"],
  },
  {
    key: "ankle_R", label: "Ankle (Right)", emoji: "🦶",
    movements: ["Dorsiflexion","Plantarflexion","Inversion","Eversion"],
    normals:   ["0-20°","0-50°","0-35°","0-15°"],
  },
];

const ROM_PCTS = [
  { label: "Full (100%)", value: 100, color: "bg-green-500" },
  { label: "¾ (75%)",    value: 75,  color: "bg-lime-500" },
  { label: "½ (50%)",    value: 50,  color: "bg-yellow-500" },
  { label: "¼ (25%)",    value: 25,  color: "bg-orange-500" },
  { label: "Minimal (<25%)", value: 10, color: "bg-red-500" },
  { label: "Unable (0%)", value: 0,  color: "bg-red-800" },
];

function romColor(pct) {
  if (pct === null) return "bg-slate-100 text-slate-400";
  if (pct >= 90)  return "bg-green-100 text-green-800 border-green-300";
  if (pct >= 70)  return "bg-lime-100 text-lime-800 border-lime-300";
  if (pct >= 45)  return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (pct >= 20)  return "bg-orange-100 text-orange-800 border-orange-300";
  return "bg-red-100 text-red-800 border-red-300";
}

export default function VisualROMAssessmentRunner({ onSave, onClose }) {
  // selectedJoints: set of joint keys to assess
  const [phase, setPhase] = useState("select"); // select | assess | summary
  const [selectedJoints, setSelectedJoints] = useState(new Set());
  const [jointIdx, setJointIdx] = useState(0);
  const [movementIdx, setMovementIdx] = useState(0);
  // results[jointKey][movementName] = { rom: number|null, pain: bool|null, note: string }
  const [results, setResults] = useState({});
  const [globalNotes, setGlobalNotes] = useState("");

  const activeJoints = JOINTS.filter(j => selectedJoints.has(j.key));
  const currentJoint = activeJoints[jointIdx];
  const currentMovement = currentJoint?.movements[movementIdx];
  const currentNormal = currentJoint?.normals[movementIdx];

  const getResult = (jointKey, movement) =>
    results[jointKey]?.[movement] || { rom: null, pain: null, note: "" };

  const setResult = (jointKey, movement, field, value) => {
    setResults(prev => ({
      ...prev,
      [jointKey]: {
        ...prev[jointKey],
        [movement]: { ...getResult(jointKey, movement), [field]: value },
      },
    }));
  };

  const current = currentJoint ? getResult(currentJoint.key, currentMovement) : {};

  const totalMovements = activeJoints.reduce((s, j) => s + j.movements.length, 0);
  const doneMovements = activeJoints.reduce((s, j) =>
    s + j.movements.filter(m => getResult(j.key, m).rom !== null).length, 0);

  // Navigation
  const goNext = () => {
    if (movementIdx < currentJoint.movements.length - 1) {
      setMovementIdx(m => m + 1);
    } else if (jointIdx < activeJoints.length - 1) {
      setJointIdx(j => j + 1);
      setMovementIdx(0);
    } else {
      setPhase("summary");
    }
  };

  const goPrev = () => {
    if (movementIdx > 0) {
      setMovementIdx(m => m - 1);
    } else if (jointIdx > 0) {
      setJointIdx(j => j - 1);
      setMovementIdx(JOINTS.find(j => j.key === activeJoints[jointIdx - 1].key)?.movements.length - 1 || 0);
    }
  };

  const handleSave = () => {
    // Build SOAP text
    let soapText = `• Visual ROM Assessment\n\n`;
    activeJoints.forEach(joint => {
      soapText += `  ${joint.label}:\n`;
      joint.movements.forEach((mv, i) => {
        const r = getResult(joint.key, mv);
        if (r.rom !== null) {
          soapText += `    ${mv}: ${r.rom}% ROM (Normal: ${joint.normals[i]})`;
          soapText += r.pain ? " — PAIN reported" : " — No pain";
          if (r.note) soapText += ` | Note: ${r.note}`;
          soapText += "\n";
        }
      });
    });
    if (globalNotes) soapText += `\n  Clinical Notes: ${globalNotes}`;

    onSave({
      result_value: Math.round(doneMovements > 0 ?
        activeJoints.reduce((sum, j) =>
          sum + j.movements.reduce((s, m) => s + (getResult(j.key, m).rom ?? 0), 0), 0
        ) / totalMovements : 0),
      notes: globalNotes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        measurement_type: "visual_rom",
        soap_text: soapText,
        results,
        joints_assessed: activeJoints.map(j => j.label),
      },
    });
  };

  // ─── Phase: Joint Selection ───────────────────────────────────────────────
  if (phase === "select") {
    return (
      <div className="bg-white rounded-xl w-full flex flex-col" style={{ maxHeight: "85vh" }}>
        <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Visual ROM Assessment</h2>
            <p className="text-sm text-slate-500 mt-0.5">Select which joints to assess</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {JOINTS.map(joint => {
              const selected = selectedJoints.has(joint.key);
              return (
                <button
                  key={joint.key}
                  onClick={() => {
                    setSelectedJoints(prev => {
                      const next = new Set(prev);
                      if (next.has(joint.key)) next.delete(joint.key);
                      else next.add(joint.key);
                      return next;
                    });
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selected
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="text-2xl">{joint.emoji}</span>
                  <p className={`mt-1 text-sm font-semibold ${selected ? "text-blue-800" : "text-slate-700"}`}>
                    {joint.label}
                  </p>
                  <p className="text-xs text-slate-400">{joint.movements.length} movements</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center shrink-0">
          <p className="text-sm text-slate-500">{selectedJoints.size} joint{selectedJoints.size !== 1 ? "s" : ""} selected</p>
          <Button
            disabled={selectedJoints.size === 0}
            onClick={() => { setJointIdx(0); setMovementIdx(0); setPhase("assess"); }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Start Assessment <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // ─── Phase: Assess ────────────────────────────────────────────────────────
  if (phase === "assess" && currentJoint) {
    const isFirst = jointIdx === 0 && movementIdx === 0;
    const progress = Math.round((doneMovements / totalMovements) * 100);

    return (
      <div className="bg-white rounded-xl w-full flex flex-col" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentJoint.emoji}</span>
                <h2 className="text-lg font-bold text-slate-900">{currentJoint.label}</h2>
              </div>
              <p className="text-base font-semibold text-blue-700 mt-0.5">{currentMovement}</p>
              <p className="text-xs text-slate-500">Normal range: <strong>{currentNormal}</strong></p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">{doneMovements}/{totalMovements} done</p>
              <div className="w-24 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ROM % selector */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">Range of Motion</p>
            <div className="grid grid-cols-3 gap-2">
              {ROM_PCTS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setResult(currentJoint.key, currentMovement, "rom", opt.value)}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    current.rom === opt.value
                      ? `${opt.color} text-white border-transparent shadow-md scale-105`
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pain toggle */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">Pain on Movement?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setResult(currentJoint.key, currentMovement, "pain", false)}
                className={`py-4 rounded-xl border-2 font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  current.pain === false
                    ? "bg-green-500 text-white border-transparent shadow-md"
                    : "border-slate-200 bg-white text-slate-700 hover:border-green-300"
                }`}
              >
                <CheckCircle className="w-5 h-5" /> No Pain
              </button>
              <button
                onClick={() => setResult(currentJoint.key, currentMovement, "pain", true)}
                className={`py-4 rounded-xl border-2 font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  current.pain === true
                    ? "bg-red-500 text-white border-transparent shadow-md"
                    : "border-slate-200 bg-white text-slate-700 hover:border-red-300"
                }`}
              >
                <AlertCircle className="w-5 h-5" /> Pain Reported
              </button>
            </div>
          </div>

          {/* Quick note */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Quick Note (optional)</p>
            <textarea
              rows={2}
              value={current.note || ""}
              onChange={e => setResult(currentJoint.key, currentMovement, "note", e.target.value)}
              placeholder="e.g. pain at end range, guarding, stiffness..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Movement status strip for current joint */}
          <div className="flex gap-1 flex-wrap">
            {currentJoint.movements.map((mv, i) => {
              const r = getResult(currentJoint.key, mv);
              const isActive = i === movementIdx;
              return (
                <button
                  key={mv}
                  onClick={() => setMovementIdx(i)}
                  title={mv}
                  className={`h-2 flex-1 rounded-full transition-all min-w-[12px] ${
                    isActive ? "bg-blue-500" :
                    r.rom !== null ? (r.pain ? "bg-red-400" : "bg-green-400") : "bg-slate-200"
                  }`}
                />
              );
            })}
          </div>
          <p className="text-xs text-center text-slate-400">
            Movement {movementIdx + 1} of {currentJoint.movements.length} — {currentJoint.label}
          </p>
        </div>

        {/* Footer nav */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center shrink-0">
          <Button variant="outline" onClick={goPrev} disabled={isFirst}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button
            onClick={goNext}
            disabled={current.rom === null || current.pain === null}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {jointIdx === activeJoints.length - 1 && movementIdx === currentJoint.movements.length - 1
              ? <><Save className="w-4 h-4 mr-1" /> View Summary</>
              : <>Next <ChevronRight className="w-4 h-4 ml-1" /></>}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Phase: Summary ───────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl w-full flex flex-col" style={{ maxHeight: "85vh" }}>
      <div className="p-5 border-b bg-gradient-to-r from-green-50 to-blue-50 flex justify-between items-start shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Assessment Summary</h2>
          <p className="text-sm text-slate-500 mt-0.5">{doneMovements} movements assessed across {activeJoints.length} joint{activeJoints.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setJointIdx(0); setMovementIdx(0); setPhase("assess"); }}>
            <RotateCcw className="w-4 h-4 mr-1" /> Re-assess
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {activeJoints.map(joint => (
          <Card key={joint.key} className="border-slate-200">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
              <span>{joint.emoji}</span>
              <h3 className="font-semibold text-slate-800">{joint.label}</h3>
            </div>
            <CardContent className="p-3">
              <div className="space-y-2">
                {joint.movements.map((mv, i) => {
                  const r = getResult(joint.key, mv);
                  if (r.rom === null) return null;
                  return (
                    <div key={mv} className="flex items-center gap-3">
                      <div className="flex-1 text-sm text-slate-700">{mv}</div>
                      <div className="flex items-center gap-1">
                        <div className={`px-2 py-0.5 rounded-full text-xs font-bold border ${romColor(r.rom)}`}>
                          {r.rom}%
                        </div>
                        <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.pain ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        }`}>
                          {r.pain ? "Pain" : "No Pain"}
                        </div>
                        {r.note && <span className="text-xs text-slate-400 italic truncate max-w-[120px]">{r.note}</span>}
                      </div>
                      {/* Mini bar */}
                      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            r.rom >= 90 ? "bg-green-500" : r.rom >= 70 ? "bg-lime-500" :
                            r.rom >= 45 ? "bg-yellow-500" : r.rom >= 20 ? "bg-orange-500" : "bg-red-500"
                          }`}
                          style={{ width: `${r.rom}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">Overall Clinical Notes</p>
          <Textarea
            value={globalNotes}
            onChange={e => setGlobalNotes(e.target.value)}
            rows={3}
            placeholder="Overall observations, compensatory patterns, recommendations..."
            className="text-sm"
          />
        </div>
      </div>

      <div className="p-4 border-t bg-slate-50 flex justify-between items-center shrink-0">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" /> Save Assessment
        </Button>
      </div>
    </div>
  );
}