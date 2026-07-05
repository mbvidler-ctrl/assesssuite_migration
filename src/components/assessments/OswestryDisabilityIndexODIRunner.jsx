import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Info } from "lucide-react";
import { toast } from "sonner";

const SECTIONS = [
  {
    id: "pain_intensity", label: "Section 1: Pain Intensity",
    options: ["I have no pain at the moment.", "The pain is very mild at the moment.", "The pain is moderate at the moment.", "The pain is fairly severe at the moment.", "The pain is very severe at the moment.", "The pain is the worst imaginable at the moment."],
  },
  {
    id: "personal_care", label: "Section 2: Personal Care (Washing, Dressing, etc.)",
    options: ["I can look after myself normally without causing extra pain.", "I can look after myself normally but it causes extra pain.", "It is painful to look after myself and I am slow and careful.", "I need some help but manage most of my personal care.", "I need help every day in most aspects of self care.", "I do not get dressed, wash with difficulty and stay in bed."],
  },
  {
    id: "lifting", label: "Section 3: Lifting",
    options: ["I can lift heavy weights without extra pain.", "I can lift heavy weights but it gives extra pain.", "Pain prevents me from lifting heavy weights off the floor, but I can manage light to medium weights.", "I can lift only very light weights.", "I cannot lift or carry anything at all.", "I cannot lift or carry anything at all."],
  },
  {
    id: "walking", label: "Section 4: Walking",
    options: ["Pain does not prevent me walking any distance.", "Pain prevents me walking more than 1 mile.", "Pain prevents me walking more than 1/2 mile.", "Pain prevents me walking more than 100 yards.", "I can only walk using a stick or crutches.", "I am in bed most of the time and have to crawl to the toilet."],
  },
  {
    id: "sitting", label: "Section 5: Sitting",
    options: ["I can sit in any chair as long as I like.", "I can only sit in my favourite chair as long as I like.", "Pain prevents me sitting more than 1 hour.", "Pain prevents me sitting more than 30 minutes.", "Pain prevents me sitting more than 10 minutes.", "Pain prevents me from sitting at all."],
  },
  {
    id: "standing", label: "Section 6: Standing",
    options: ["I can stand as long as I want without extra pain.", "I can stand as long as I want but it gives me extra pain.", "Pain prevents me from standing for more than 1 hour.", "Pain prevents me from standing for more than 30 minutes.", "Pain prevents me from standing for more than 10 minutes.", "Pain prevents me from standing at all."],
  },
  {
    id: "sleeping", label: "Section 7: Sleeping",
    options: ["My sleep is never disturbed by pain.", "My sleep is occasionally disturbed by pain.", "Because of pain I have less than 6 hours sleep.", "Because of pain I have less than 4 hours sleep.", "Because of pain I have less than 2 hours sleep.", "Pain prevents me from sleeping at all."],
  },
  {
    id: "sex_life", label: "Section 8: Sex Life (if applicable)",
    options: ["My sex life is normal and causes no extra pain.", "My sex life is normal but causes some extra pain.", "My sex life is nearly normal but is very painful.", "My sex life is severely restricted by pain.", "My sex life is nearly absent because of pain.", "Pain prevents any sex life at all."],
  },
  {
    id: "social_life", label: "Section 9: Social Life",
    options: ["My social life is normal and gives me no extra pain.", "My social life is normal but increases the degree of pain.", "Pain has no significant effect on my social life apart from limiting my more energetic interests.", "Pain has restricted my social life and I do not go out as often.", "Pain has restricted my social life to my home.", "I have no social life because of pain."],
  },
  {
    id: "travelling", label: "Section 10: Travelling",
    options: ["I can travel anywhere without extra pain.", "I can travel anywhere but it gives me extra pain.", "Pain is bad but I can manage journeys over 2 hours.", "Pain restricts me to journeys of less than 1 hour.", "Pain restricts me to short necessary journeys of under 30 minutes.", "Pain prevents me from travelling except to receive treatment."],
  },
];

function getInterpretation(pct) {
  if (pct <= 20) return { label: "Minimal Disability (0–20%)", desc: "Patient can manage most ADL. No treatment needed other than advice.", color: "bg-green-100 text-green-800 border-green-300" };
  if (pct <= 40) return { label: "Moderate Disability (21–40%)", desc: "Patient experiences more pain and difficulty. Conservative treatment recommended.", color: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (pct <= 60) return { label: "Severe Disability (41–60%)", desc: "Pain impacts daily function significantly. Detailed investigation required.", color: "bg-orange-100 text-orange-800 border-orange-300" };
  if (pct <= 80) return { label: "Crippled (61–80%)", desc: "Back pain significantly impairs all aspects of function. Active intervention required.", color: "bg-red-100 text-red-800 border-red-300" };
  return { label: "Bed Bound / Exaggerating (81–100%)", desc: "Patient is bed-bound or symptoms are exaggerated. Evaluate carefully.", color: "bg-red-200 text-red-900 border-red-400" };
}

export default function OswestryDisabilityIndexODIRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");

  const answered = Object.keys(responses).length;
  const allAnswered = answered === SECTIONS.length;
  const rawScore = Object.values(responses).reduce((s, v) => s + v, 0);
  const percentage = allAnswered ? ((rawScore / (answered * 5)) * 100).toFixed(1) : null;
  const interp = percentage ? getInterpretation(parseFloat(percentage)) : null;

  const handleSave = () => {
    if (!allAnswered) { toast.error("Please answer all 10 sections"); return; }
    const lines = SECTIONS.map(s => `  ${s.label}: ${responses[s.id]}/5`).join("\n");
    const soap = `• Oswestry Disability Index (ODI)\n  Score: ${rawScore}/50 (${percentage}%) — ${interp.label}\n  ${interp.desc}\n\n  Section Scores:\n${lines}${notes ? `\n\n  Notes: ${notes}` : ""}\n  MCID: 10–12.8 percentage points\n  Reference: Fairbank JC et al. (1980). The Oswestry low back pain disability questionnaire. Physiotherapy, 66(8):271-3.`;
    onSave({ status: "completed", result_value: parseFloat(percentage), notes, assessment_date: new Date().toISOString().split("T")[0], additional_data: { soap_text: soap, measurement_type: "questionnaire", raw_score: rawScore, percentage: parseFloat(percentage), section_scores: responses, disability_level: interp.label } });
    toast.success("ODI saved.");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 p-5 border-b flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-900">Oswestry Disability Index (ODI)</h2><p className="text-slate-500 text-sm mt-0.5">Low back pain disability — 10 sections</p></div>
          <div className="flex items-center gap-3">
            {percentage && <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${interp.color}`}>{percentage}%</div>}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" />Instructions</p>
            <p>Please read each section and select ONE statement that best describes your condition <strong>today</strong>. Mark only ONE statement per section.</p>
          </div>

          {SECTIONS.map(section => (
            <Card key={section.id} className={responses[section.id] !== undefined ? "border-blue-200 bg-blue-50/20" : ""}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-700">{section.label}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {section.options.map((opt, i) => (
                  <button key={i} type="button" onClick={() => setResponses(p => ({ ...p, [section.id]: i }))} className={`w-full text-left flex gap-3 items-start p-2.5 rounded-lg border transition-colors text-sm ${responses[section.id] === i ? "border-blue-500 bg-blue-50 font-medium" : "border-transparent hover:bg-slate-50 hover:border-slate-200"}`}>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${responses[section.id] === i ? "bg-blue-500 border-blue-500" : "border-slate-300"}`}>
                      {responses[section.id] === i && <span className="w-2 h-2 bg-white rounded-full" />}
                    </span>
                    <span className="text-slate-700 leading-snug">{i}) {opt}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}

          {allAnswered && (
            <div className={`border-2 rounded-xl p-4 text-center ${interp.color}`}>
              <p className="text-3xl font-bold">{rawScore}/50 ({percentage}%)</p>
              <p className="font-semibold text-lg mt-1">{interp.label}</p>
              <p className="text-sm mt-1">{interp.desc}</p>
            </div>
          )}

          <div><Label>Clinical Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Work capacity, functional goals, treatment progress..." rows={3} className="mt-1" /></div>
        </div>

        <div className="border-t p-4 bg-slate-50 flex justify-between items-center">
          <span className="text-sm text-slate-500">{answered}/10 answered</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!allAnswered} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}