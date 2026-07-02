import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const MUSCLE_GROUPS = {
  "Upper Limb": [
    "Elbow Flexors", "Elbow Extensors", "Wrist Flexors", "Wrist Extensors",
    "Finger Flexors", "Shoulder Internal Rotators",
  ],
  "Lower Limb": [
    "Hamstrings", "Quadriceps", "Gastrocnemius", "Soleus",
    "Hip Adductors", "Hip Flexors", "Tibialis Posterior",
  ],
};

const TARDIEU_SCORES = [
  { value: "0", label: "0 â€” No resistance throughout" },
  { value: "1", label: "1 â€” Slight resistance, no catch" },
  { value: "2", label: "2 â€” Clear catch at precise angle" },
  { value: "3", label: "3 â€” Fatigable clonus (< 10 sec)" },
  { value: "4", label: "4 â€” Unfatigable clonus (> 10 sec)" },
  { value: "5", label: "5 â€” Joint immobile" },
];

const VELOCITIES = [
  { key: "v1", label: "V1 â€” Slow Stretch", desc: "As slow as possible. Measures passive ROM (R2).", color: "bg-blue-50 border-blue-200" },
  { key: "v2", label: "V2 â€” Speed of Limb Under Gravity", desc: "Speed of limb falling under gravity. Moderate speed.", color: "bg-yellow-50 border-yellow-200" },
  { key: "v3", label: "V3 â€” Fast Stretch", desc: "As fast as possible. Used to provoke spasticity (R1).", color: "bg-red-50 border-red-200" },
];

const emptyVelocity = () => ({
  tardieu_score: "",
  r1_angle: "",
  r2_angle: "",
  catch_angle: "",
  clonus_present: false,
  clonus_duration: "",
  clonus_beats: "",
  clonus_sustained: "",
});

const emptyMuscleEntry = () => ({
  id: Date.now(),
  muscle_group: "",
  side: "Right",
  position: "Supine",
  v1: emptyVelocity(),
  v2: emptyVelocity(),
  v3: emptyVelocity(),
  notes: "",
  expanded: true,
});

function getInterpretation(entry) {
  const r1 = parseFloat(entry.v3.r1_angle);
  const r2 = parseFloat(entry.v1.r2_angle);
  const score = parseInt(entry.v3.tardieu_score);
  const lines = [];

  if (!isNaN(r1) && !isNaN(r2)) {
    const diff = r2 - r1;
    if (diff > 20) lines.push(`R2âˆ’R1 = ${diff.toFixed(0)}Â° â†’ Dynamic spasticity likely (velocity-dependent).`);
    else if (diff < 10) lines.push(`R2âˆ’R1 = ${diff.toFixed(0)}Â° â†’ Fixed soft tissue restriction / contracture likely.`);
    else lines.push(`R2âˆ’R1 = ${diff.toFixed(0)}Â° â†’ Mixed presentation (spasticity + contracture component).`);
  }

  if (!isNaN(score)) {
    if (score >= 3) lines.push(`Tardieu Score ${score}: Significant spastic hypertonia â€” clonus present.`);
    else if (score === 2) lines.push(`Tardieu Score ${score}: Clear velocity-dependent catch â€” moderate spasticity.`);
    else if (score === 1) lines.push(`Tardieu Score ${score}: Mild resistance â€” minimal spasticity.`);
    else if (score === 0) lines.push(`Tardieu Score 0: No spasticity detected.`);
  }

  return lines.join(" ");
}

function MuscleEntryPanel({ entry, index, onChange, onRemove }) {
  const interp = getInterpretation(entry);
  const r1 = parseFloat(entry.v3.r1_angle);
  const r2 = parseFloat(entry.v1.r2_angle);
  const diff = !isNaN(r1) && !isNaN(r2) ? (r2 - r1).toFixed(0) : "â€”";

  const updateVel = (velKey, field, value) => {
    onChange(index, { ...entry, [velKey]: { ...entry[velKey], [field]: value } });
  };

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
      {/* Panel Header */}
      <div className="flex items-center justify-between bg-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-800 text-sm">
            {entry.muscle_group || `Muscle Group ${index + 1}`}
          </span>
          {entry.side && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{entry.side}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onChange(index, { ...entry, expanded: !entry.expanded })} className="text-slate-500 hover:text-slate-800">
            {entry.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {entry.expanded && (
        <div className="p-4 space-y-5 bg-white">
          {/* Setup */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-600">Muscle Group</Label>
              <Select value={entry.muscle_group} onValueChange={v => onChange(index, { ...entry, muscle_group: v })}>
                <SelectTrigger className="mt-1 text-xs h-8">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MUSCLE_GROUPS).map(([group, muscles]) => (
                    <React.Fragment key={group}>
                      <div className="px-2 py-1 text-xs font-bold text-slate-500 uppercase">{group}</div>
                      {muscles.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600">Side</Label>
              <Select value={entry.side} onValueChange={v => onChange(index, { ...entry, side: v })}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Left", "Right", "Bilateral"].map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600">Position</Label>
              <Select value={entry.position} onValueChange={v => onChange(index, { ...entry, position: v })}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Supine", "Sitting", "Standing", "Side-lying", "Prone"].map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Velocity Panels */}
          {VELOCITIES.map(({ key, label, desc, color }) => (
            <div key={key} className={`border rounded-lg p-3 space-y-3 ${color}`}>
              <div>
                <p className="font-semibold text-sm text-slate-800">{label}</p>
                <p className="text-xs text-slate-600">{desc}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-slate-600">Tardieu Score (0â€“5)</Label>
                  <Select value={entry[key].tardieu_score} onValueChange={v => updateVel(key, "tardieu_score", v)}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue placeholder="Score..." /></SelectTrigger>
                    <SelectContent>
                      {TARDIEU_SCORES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {(key === "v3" || key === "v2") && (
                  <div>
                    <Label className="text-xs text-slate-600">R1 Angle (Â°) â€” Catch</Label>
                    <Input type="number" value={entry[key].r1_angle} onChange={e => updateVel(key, "r1_angle", e.target.value)} className="mt-1 text-xs h-8" placeholder="e.g. 20" />
                  </div>
                )}
                {key === "v1" && (
                  <div>
                    <Label className="text-xs text-slate-600">R2 Angle (Â°) â€” Full ROM</Label>
                    <Input type="number" value={entry[key].r2_angle} onChange={e => updateVel(key, "r2_angle", e.target.value)} className="mt-1 text-xs h-8" placeholder="e.g. 45" />
                  </div>
                )}
                <div>
                  <Label className="text-xs text-slate-600">Catch Angle (Â°)</Label>
                  <Input type="number" value={entry[key].catch_angle} onChange={e => updateVel(key, "catch_angle", e.target.value)} className="mt-1 text-xs h-8" placeholder="e.g. 15" />
                </div>
              </div>

              {/* Clonus */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-slate-600">Clonus Present?</Label>
                  <div className="flex gap-2">
                    {["Yes", "No"].map(opt => (
                      <button key={opt}
                        onClick={() => updateVel(key, "clonus_present", opt === "Yes")}
                        className={`px-3 py-0.5 text-xs rounded-full border font-medium transition-colors ${entry[key].clonus_present === (opt === "Yes") ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                {entry[key].clonus_present && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-slate-600">Duration (sec)</Label>
                      <Input type="number" value={entry[key].clonus_duration} onChange={e => updateVel(key, "clonus_duration", e.target.value)} className="mt-1 text-xs h-8" placeholder="sec" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Beats</Label>
                      <Input type="number" value={entry[key].clonus_beats} onChange={e => updateVel(key, "clonus_beats", e.target.value)} className="mt-1 text-xs h-8" placeholder="count" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Type</Label>
                      <Select value={entry[key].clonus_sustained} onValueChange={v => updateVel(key, "clonus_sustained", v)}>
                        <SelectTrigger className="mt-1 text-xs h-8"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sustained" className="text-xs">Sustained</SelectItem>
                          <SelectItem value="Unsustained" className="text-xs">Unsustained</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* R2-R1 Summary */}
          {diff !== "â€”" && (
            <div className={`rounded-lg px-4 py-3 border ${parseFloat(diff) > 20 ? "bg-orange-50 border-orange-300" : parseFloat(diff) < 10 ? "bg-purple-50 border-purple-300" : "bg-slate-50 border-slate-300"}`}>
              <p className="text-xs font-bold text-slate-700">Calculated R2 âˆ’ R1 = <span className="text-lg">{diff}Â°</span></p>
              {interp && <p className="text-xs text-slate-600 mt-1">{interp}</p>}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold text-slate-600">Clinical Notes for this muscle group</Label>
            <Textarea value={entry.notes} onChange={e => onChange(index, { ...entry, notes: e.target.value })} rows={2} placeholder="Pain response, guarding, compliance, positioning difficulties..." className="mt-1 text-xs" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TardieuScaleRunner({ client, onSave, onClose }) {
  const [header, setHeader] = useState({
    side_tested: "Right",
    limb_tested: "",
    position: "Supine",
    diagnosis: "",
    clinician_notes: "",
  });
  const [entries, setEntries] = useState([emptyMuscleEntry()]);
  const [showInstructions, setShowInstructions] = useState(true);

  const updateEntry = (index, updated) => {
    setEntries(prev => prev.map((e, i) => i === index ? updated : e));
  };

  const removeEntry = (index) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const addEntry = () => {
    setEntries(prev => [...prev, emptyMuscleEntry()]);
  };

  const handleSave = () => {
    // Build comprehensive SOAP text
    const lines = [`â€¢ Tardieu Scale Assessment`, `  Diagnosis/Condition: ${header.diagnosis || "Not specified"}`];
    entries.forEach((entry, i) => {
      const r1 = parseFloat(entry.v3.r1_angle);
      const r2 = parseFloat(entry.v1.r2_angle);
      const diff = !isNaN(r1) && !isNaN(r2) ? (r2 - r1).toFixed(0) : "N/A";
      lines.push(`\n  Muscle Group ${i + 1}: ${entry.muscle_group} (${entry.side}) â€” Position: ${entry.position}`);
      lines.push(`    V1 (Slow): Score=${entry.v1.tardieu_score || "â€”"}, R2=${entry.v1.r2_angle || "â€”"}Â°, Catch=${entry.v1.catch_angle || "â€”"}Â°`);
      lines.push(`    V2 (Gravity): Score=${entry.v2.tardieu_score || "â€”"}, R1=${entry.v2.r1_angle || "â€”"}Â°, Catch=${entry.v2.catch_angle || "â€”"}Â°`);
      lines.push(`    V3 (Fast): Score=${entry.v3.tardieu_score || "â€”"}, R1=${entry.v3.r1_angle || "â€”"}Â°, Catch=${entry.v3.catch_angle || "â€”"}Â°`);
      lines.push(`    R2âˆ’R1 = ${diff}Â° | Interpretation: ${getInterpretation(entry) || "Insufficient data"}`);
      if (entry.v3.clonus_present) lines.push(`    Clonus: Present | Duration: ${entry.v3.clonus_duration || "?"}s | Type: ${entry.v3.clonus_sustained || "?"}`);
      if (entry.notes) lines.push(`    Notes: ${entry.notes}`);
    });
    if (header.clinician_notes) lines.push(`\n  General Notes: ${header.clinician_notes}`);

    const primaryScore = parseInt(entries[0]?.v3?.tardieu_score) || 0;
    const primaryR1 = parseFloat(entries[0]?.v3?.r1_angle) || 0;
    const primaryR2 = parseFloat(entries[0]?.v1?.r2_angle) || 0;

    onSave({
      result_value: primaryR2 - primaryR1,
      notes: header.clinician_notes,
      assessment_date: new Date().toISOString().split("T")[0],
      additional_data: {
        soap_text: lines.join("\n"),
        entries,
        header,
        primary_tardieu_score: primaryScore,
        primary_r2_minus_r1: primaryR2 - primaryR1,
      }
    });
  };

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tardieu Scale Assessment</h2>
          <p className="text-sm text-slate-500">Velocity-dependent spasticity grading with angle measurement</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Clinical Instructions Collapsible */}
      <div className="border border-blue-200 rounded-lg overflow-hidden">
        <button onClick={() => setShowInstructions(v => !v)}
          className="w-full flex justify-between items-center bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          ðŸ“‹ Clinician Instructions &amp; Protocol
          {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showInstructions && (
          <div className="p-4 text-sm text-slate-700 space-y-3 bg-white">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="font-bold text-blue-800 mb-1">V1 â€” Slow Stretch</p>
                <p className="text-xs">"Move the limb as slowly as possible." Measures passive ROM (R2 = full range). Assesses soft tissue extensibility without neural response.</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                <p className="font-bold text-yellow-800 mb-1">V2 â€” Gravity Speed</p>
                <p className="text-xs">Speed of limb falling under gravity. Used to detect moderate-velocity catch. Compare with V3 to quantify velocity dependency.</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <p className="font-bold text-red-800 mb-1">V3 â€” Fast Stretch</p>
                <p className="text-xs">"Move the limb as fast as possible." Designed to provoke spastic response. R1 = angle of muscle reaction during fast stretch. Key measure for spasticity.</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-slate-700">Scoring Guide (Tardieu/Modified Tardieu Scale)</p>
              <div className="grid grid-cols-2 gap-1">
                {TARDIEU_SCORES.map(s => <p key={s.value} className="text-slate-600">{s.label}</p>)}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
              <p className="font-semibold text-amber-800">ðŸ”‘ Key Calculation: R2 âˆ’ R1</p>
              <p className="text-amber-700 mt-1"><strong>&gt; 20Â°</strong> = Dynamic spasticity likely (velocity-dependent neural overactivity)</p>
              <p className="text-amber-700"><strong>&lt; 10Â°</strong> = Fixed soft tissue shortening / contracture likely</p>
              <p className="text-amber-700"><strong>10â€“20Â°</strong> = Mixed presentation (spasticity + contracture component)</p>
              <p className="text-amber-700 mt-1"><strong>R1</strong> = angle of catch on fast stretch (V3) | <strong>R2</strong> = full passive ROM on slow stretch (V1)</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
              <p className="font-semibold text-red-800">âš ï¸ Safety &amp; Contraindications</p>
              <p className="text-red-700">Do not perform during acute pain, fracture, dislocation, or severe spasm. Move limb smoothly â€” avoid forcing past resistance. Monitor for autonomic dysreflexia in SCI clients.</p>
            </div>
          </div>
        )}
      </div>

      {/* Session Header */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Session Details</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-600">Diagnosis / Condition</Label>
            <Input value={header.diagnosis} onChange={e => setHeader(h => ({ ...h, diagnosis: e.target.value }))}
              placeholder="e.g. Stroke, Cerebral Palsy, MS" className="mt-1 text-sm h-8" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600">Side Tested</Label>
            <Select value={header.side_tested} onValueChange={v => setHeader(h => ({ ...h, side_tested: v }))}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Left", "Right", "Bilateral"].map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600">Limb Tested</Label>
            <Select value={header.limb_tested} onValueChange={v => setHeader(h => ({ ...h, limb_tested: v }))}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {["Upper Limb", "Lower Limb", "Both"].map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Muscle Group Entries */}
      <div className="space-y-4">
        {entries.map((entry, index) => (
          <MuscleEntryPanel key={entry.id} entry={entry} index={index} onChange={updateEntry} onRemove={removeEntry} />
        ))}
        <Button variant="outline" onClick={addEntry} className="w-full border-dashed border-slate-400 text-slate-600 hover:bg-slate-50">
          <Plus className="w-4 h-4 mr-2" /> Add Another Muscle Group
        </Button>
      </div>

      {/* General Notes */}
      <div>
        <Label className="text-sm font-semibold text-slate-700">General Clinical Notes</Label>
        <Textarea value={header.clinician_notes} onChange={e => setHeader(h => ({ ...h, clinician_notes: e.target.value }))}
          rows={3} placeholder="Overall pain response, fatigue, positioning challenges, cognition, compliance..." className="mt-1 text-sm" />
      </div>

      {/* References */}
      <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">ðŸ“– References</p>
        <p>1. Tardieu G, Shentoub S, Delarue R. (1954). Ã€ la recherche d'une technique de mesure de la spasticitÃ©. <em>Revue Neurologique</em>, 91, 143â€“144.</p>
        <p>2. Boyd RN &amp; Graham HK. (1999). Objective measurement of clinical findings in the use of botulinum toxin type A for the management of children with cerebral palsy. <em>European Journal of Neurology</em>, 6(Suppl 4), S23â€“S35.</p>
        <p>3. Haugh AB, Pandyan AD, Johnson GR. (2006). A systematic review of the Tardieu Scale for the measurement of spasticity. <em>Disability &amp; Rehabilitation</em>, 28(15), 899â€“907.</p>
        <p>4. Patrick E &amp; Ada L. (2006). The Tardieu Scale differentiates contracture from spasticity whereas the Ashworth Scale is confounded by it. <em>Clinical Rehabilitation</em>, 20(2), 173â€“182.</p>
        <p>5. Gracies JM et al. (2010). Five-step clinical assessment in spastic paresis. <em>European Journal of Physical and Rehabilitation Medicine</em>, 46(3), 411â€“421.</p>
      </div>

      {/* Footer */}
      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={entries.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
          Save Assessment
        </Button>
      </div>
    </div>
  );
}