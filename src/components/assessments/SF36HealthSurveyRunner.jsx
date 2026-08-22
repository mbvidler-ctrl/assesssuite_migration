import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Save, X, ExternalLink, ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { todayLocal } from "@/lib/localDate";
import { PROM_NEURO_SF36_SF36_QUESTIONS as SF36_QUESTIONS, PROM_NEURO_SF36_SCALE_OPTIONS as SCALE_OPTIONS } from '@/lib/clinical/scorers/extrasPromNeuro';



export default function SF36HealthSurveyRunner({ client, onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");

  const handleResponseChange = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: parseInt(value)
    }));
  };

  const completedQuestions = Object.keys(responses).length;
  const allQuestionsAnswered = completedQuestions === 36;

  const calculateDomainScores = () => {
    const domains = {
      PF: { items: [1,2,3,4,5,6,7,8,9,10], score: 0 },
      RP: { items: [11,12,13,14], score: 0 },
      BP: { items: [15,16], score: 0 },
      GH: { items: [17,18,19,20,21], score: 0 },
      VT: { items: [22,23,24,25], score: 0 },
      SF: { items: [26,27], score: 0 },
      RE: { items: [28,29,30], score: 0 },
      MH: { items: [31,32,33,34,35,36], score: 0 }
    };

    for (const domain of Object.values(domains)) {
      let sum = 0;
      for (const itemId of domain.items) {
        sum += responses[itemId] || 0;
      }
      domain.score = domain.items.length > 0 ? Math.round((sum / (domain.items.length * 6)) * 100) : 0;
    }

    return domains;
  };

  const handleSave = () => {
    if (!allQuestionsAnswered) {
      toast.error("Please answer all 36 questions before saving.");
      return;
    }

    const domains = calculateDomainScores();
    const pcs = Math.round((domains.PF.score + domains.RP.score + domains.BP.score + domains.GH.score) / 4);
    const mcs = Math.round((domains.VT.score + domains.SF.score + domains.RE.score + domains.MH.score) / 4);

    const soapText = [
      `• SF-36 Health Survey (Short Form Health Survey)`,
      `  Physical Component Summary (PCS): ${pcs}/100`,
      `  Mental Component Summary (MCS): ${mcs}/100`,
      `  Domain Scores:`,
      `    - Physical Functioning: ${domains.PF.score}/100`,
      `    - Role-Physical: ${domains.RP.score}/100`,
      `    - Bodily Pain: ${domains.BP.score}/100`,
      `    - General Health: ${domains.GH.score}/100`,
      `    - Vitality: ${domains.VT.score}/100`,
      `    - Social Functioning: ${domains.SF.score}/100`,
      `    - Role-Emotional: ${domains.RE.score}/100`,
      `    - Mental Health: ${domains.MH.score}/100`,
      notes ? `  Clinical Notes: ${notes}` : null,
      `  Reference: Ware JE Jr, Sherbourne CD. (1992). The MOS 36-Item Short-Form Health Survey (SF-36). Med Care 30(6):473-483.`,
    ].filter(Boolean).join('\n');

    onSave({
      status: "completed",
      result_value: pcs,
      additional_data: {
        measurement_type: "sf36_survey",
        responses,
        pcs,
        mcs,
        domain_scores: {
          physical_functioning: domains.PF.score,
          role_physical: domains.RP.score,
          bodily_pain: domains.BP.score,
          general_health: domains.GH.score,
          vitality: domains.VT.score,
          social_functioning: domains.SF.score,
          role_emotional: domains.RE.score,
          mental_health: domains.MH.score,
        },
        soap_text: soapText,
      },
      notes,
      assessment_date: todayLocal(),
    });
    toast.success("SF-36 Health Survey saved successfully.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto p-6 space-y-4">
        
        {/* Header */}
        <div className="border-b pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">SF-36 Health Survey</h1>
            <p className="text-slate-600 mt-2">36-item assessment of health-related quality of life</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Clinician Instructions */}
        <div className="bg-blue-600 text-white rounded-lg px-4 py-3 text-sm">
          <p className="font-semibold mb-0.5">💬 Clinician Instructions</p>
          <p className="text-blue-100">This questionnaire asks the patient about their health and how they feel over the <strong className="text-white">past 4 weeks</strong>. Read each question aloud or have the patient self-complete. For each item, ask the patient to choose the answer that best describes how they feel. There are no right or wrong answers — record the first response that comes to mind.</p>
        </div>

        {/* Clinical Guidance */}
        <Collapsible defaultOpen={true}>
          <CollapsibleTrigger className="flex items-center gap-2 font-semibold text-slate-900 hover:bg-slate-50 p-2 rounded">
            <ChevronDown className="w-4 h-4" /> Clinical Guidance & References
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="domains">Domains</TabsTrigger>
                <TabsTrigger value="scoring">Interpretation</TabsTrigger>
                <TabsTrigger value="references">References</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Info className="w-5 h-5" /> Assessment Overview
                  </h4>
                  <div className="space-y-3 text-sm text-blue-800">
                    <p>
                      The SF-36 Health Survey is a 36-item, patient-reported outcome measure of health-related quality of life (HRQOL). It is one of the most widely used generic HRQOL instruments globally.
                    </p>
                    <p>
                      <strong>Purpose:</strong> Assess overall health status across 8 domains (physical, role, pain, general health, vitality, social, emotional, mental health).
                    </p>
                    <p>
                      <strong>Populations:</strong> Suitable for general population, chronic disease management, clinical trials, and population health surveillance (age ≥18 years).
                    </p>
                    <p>
                      <strong>Scoring:</strong> 8 domain scores (0-100) are calculated and combined into two summary measures: Physical Component Summary (PCS) and Mental Component Summary (MCS).
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="domains" className="mt-4 space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3">The 8 Health Domains</h4>
                  <div className="space-y-2 text-sm text-green-800">
                    <p><strong>Physical Functioning (PF)</strong> - Ability to perform physical activities</p>
                    <p><strong>Role-Physical (RP)</strong> - Impact of physical health on work/activities</p>
                    <p><strong>Bodily Pain (BP)</strong> - Severity of pain and limitations</p>
                    <p><strong>General Health (GH)</strong> - Overall health perception</p>
                    <p><strong>Vitality (VT)</strong> - Energy and fatigue levels</p>
                    <p><strong>Social Functioning (SF)</strong> - Ability to engage socially</p>
                    <p><strong>Role-Emotional (RE)</strong> - Impact of emotional health on activities</p>
                    <p><strong>Mental Health (MH)</strong> - Emotional wellbeing and mood</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="scoring" className="mt-4 space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-3">Score Interpretation</h4>
                  <div className="space-y-3 text-sm text-purple-800">
                    <p className="font-semibold">Domain Scores (0-100 scale):</p>
                    <div className="grid gap-2">
                      <div className="bg-white border border-purple-200 rounded p-2">
                        <p className="text-xs"><strong>90-100:</strong> Excellent health/function</p>
                      </div>
                      <div className="bg-white border border-purple-200 rounded p-2">
                        <p className="text-xs"><strong>70-89:</strong> Good health/function</p>
                      </div>
                      <div className="bg-white border border-purple-200 rounded p-2">
                        <p className="text-xs"><strong>50-69:</strong> Fair health/function</p>
                      </div>
                      <div className="bg-white border border-purple-200 rounded p-2">
                        <p className="text-xs"><strong>0-49:</strong> Poor health/function</p>
                      </div>
                    </div>
                    <p className="pt-2 text-xs italic">
                      Population mean for all domains is approximately 50 (SD=10) in general US population.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="references" className="mt-4 space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-3">Key References</h4>
                  <div className="space-y-2 text-sm">
                    <a href="https://pubmed.ncbi.nlm.nih.gov/1593914/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-amber-700 hover:underline">
                      <ExternalLink className="w-4 h-4" />
                      Ware JE Jr, Sherbourne CD. (1992). MOS 36-Item SF-36. Med Care 30(6):473-483
                    </a>
                    <a href="https://pubmed.ncbi.nlm.nih.gov/9734764/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-amber-700 hover:underline">
                      <ExternalLink className="w-4 h-4" />
                      Ware JE Jr, Kosinski M, Bayliss MS, et al. (1995). Comparison of SF-36 health survey. Med Care 33(4):AS264-AS279
                    </a>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>

        {/* Questions */}
        <div className="space-y-4">
          {SF36_QUESTIONS.map((q) => (
            <Card key={q.id}>
              <CardContent className="pt-6">
                <div className="mb-3">
                  <Label className="font-semibold text-slate-900">{q.id}. {q.text}</Label>
                </div>
                <RadioGroup value={responses[q.id]?.toString() || ""} onValueChange={(value) => handleResponseChange(q.id, value)}>
                  <div className="space-y-2">
                    {SCALE_OPTIONS[q.scale].map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`q${q.id}-${option.value}`} />
                        <Label htmlFor={`q${q.id}-${option.value}`} className="cursor-pointer text-sm">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress */}
        {completedQuestions > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-600">
                Progress: <span className="font-semibold text-blue-600">{completedQuestions}/36</span> questions answered
              </p>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(completedQuestions / 36) * 100}%` }}></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <div>
          <Label htmlFor="notes" className="font-semibold block mb-2">Clinical Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record any relevant observations about client's health status, limitations, or contextual factors..."
            rows={3}
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
            disabled={!allQuestionsAnswered}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save SF-36 Results
          </Button>
        </div>
      </div>
    </div>
  );
}
