import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Save, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const SECTIONS = {
  pain: {
    name: "Pain",
    questions: [
      { id: "P1", text: "How often is your knee painful?", 
        options: ["Never", "Monthly", "Weekly", "Daily", "Always"] },
      { id: "P2", text: "Twisting/pivoting on your knee", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P3", text: "Straightening knee fully", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P4", text: "Bending knee fully", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P5", text: "Walking on flat surface", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P6", text: "Going up or down stairs", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P7", text: "At night while in bed", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P8", text: "Sitting or lying", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "P9", text: "Standing upright", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] }
    ]
  },
  symptoms: {
    name: "Symptoms",
    questions: [
      { id: "Sy1", text: "How severe is your knee stiffness after first wakening in the morning?", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sy2", text: "How severe is your knee stiffness after sitting, lying, or resting later in the day?", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sy3", text: "Do you have swelling in your knee?", 
        options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "Sy4", text: "Do you feel grinding, hear clicking or any other type of noise when your knee moves?", 
        options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "Sy5", text: "Does your knee catch or hang up when moving?", 
        options: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
      { id: "Sy6", text: "Can you straighten your knee fully?", 
        options: ["Always", "Often", "Sometimes", "Rarely", "Never"] },
      { id: "Sy7", text: "Can you bend your knee fully?", 
        options: ["Always", "Often", "Sometimes", "Rarely", "Never"] }
    ]
  },
  adl: {
    name: "Activities of Daily Living",
    questions: [
      { id: "A1", text: "Descending stairs", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A2", text: "Ascending stairs", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A3", text: "Rising from sitting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A4", text: "Standing", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A5", text: "Bending to floor/picking up an object", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A6", text: "Walking on flat surface", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A7", text: "Getting in/out of car", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A8", text: "Going shopping", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A9", text: "Putting on socks/stockings", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A10", text: "Rising from bed", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A11", text: "Taking off socks/stockings", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A12", text: "Lying in bed (turning over, maintaining knee position)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A13", text: "Getting in/out of bath", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A14", text: "Sitting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A15", text: "Getting on/off toilet", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A16", text: "Heavy domestic duties (shovelling, scrubbing floors, etc)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "A17", text: "Light domestic duties (cooking, dusting, etc)", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] }
    ]
  },
  sport: {
    name: "Sport & Recreation",
    questions: [
      { id: "Sp1", text: "Squatting", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp2", text: "Running", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp3", text: "Jumping", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp4", text: "Turning/twisting on your injured knee", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] },
      { id: "Sp5", text: "Kneeling", options: ["None", "Mild", "Moderate", "Severe", "Extreme"] }
    ]
  },
  qol: {
    name: "Quality of Life",
    questions: [
      { id: "Q1", text: "How often are you aware of your knee problems?", 
        options: ["Never", "Monthly", "Weekly", "Daily", "Always"] },
      { id: "Q2", text: "Have you modified your lifestyle to avoid potentially damaging activities to your knee?", 
        options: ["Not at all", "Mildly", "Moderately", "Severely", "Totally"] },
      { id: "Q3", text: "How troubled are you with lack of confidence in your knee?", 
        options: ["Not at all", "Mildly", "Moderately", "Severely", "Totally"] },
      { id: "Q4", text: "In general, how much difficulty do you have with your knee?", 
        options: ["None", "Mild", "Moderate", "Severe", "Extreme"] }
    ]
  }
};

export default function KOOSRunner({ onSave, onClose }) {
  const [responses, setResponses] = useState({});
  const [activeTab, setActiveTab] = useState("pain");
  const [showClinicianInfo, setShowClinicianInfo] = useState(false);

  const handleResponseChange = (questionId, value) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const calculateSectionScore = (sectionKey) => {
    const section = SECTIONS[sectionKey];
    const sectionResponses = section.questions.map(q => responses[q.id]).filter(r => r !== undefined);
    if (sectionResponses.length === 0) return null;
    
    const sum = sectionResponses.reduce((acc, val) => acc + val, 0);
    const maxPossible = section.questions.length * 4;
    return ((1 - (sum / maxPossible)) * 100).toFixed(1);
  };

  const getTotalQuestions = () => {
    return Object.values(SECTIONS).reduce((sum, section) => sum + section.questions.length, 0);
  };

  const getAnsweredQuestions = () => {
    return Object.keys(responses).length;
  };

  const handleSave = () => {
    const totalQuestions = getTotalQuestions();
    const answered = getAnsweredQuestions();
    
    if (answered < totalQuestions) {
      toast.error(`Please answer all ${totalQuestions} questions (${answered}/${totalQuestions} completed)`);
      return;
    }

    const sectionScores = {};
    Object.keys(SECTIONS).forEach(key => {
      sectionScores[key] = parseFloat(calculateSectionScore(key));
    });

    const averageScore = Object.values(sectionScores).reduce((a, b) => a + b, 0) / Object.keys(sectionScores).length;

    const soapText = `• KOOS (Knee Injury and Osteoarthritis Outcome Score)\n  Average Score: ${averageScore.toFixed(1)}/100\n${Object.entries(sectionScores).map(([k, v]) => `  ${SECTIONS[k].name}: ${v}/100`).join('\n')}`;
    onSave({
      result_value: averageScore,
      additional_data: {
        soap_text: soapText,
        section_scores: sectionScores,
        measurement_type: 'koos',
      },
      notes: "",
      assessment_date: todayLocal()
    });
  };

  const allAnswered = getAnsweredQuestions() === getTotalQuestions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">KOOS</h2>
              <p className="text-slate-600 mt-1">Knee Injury and Osteoarthritis Outcome Score</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Patient Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Patient Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>This questionnaire assesses your views about your knee. Think about your knee symptoms and difficulties <strong>during the last week</strong>.</p>
                <p>Answer each question based on your experience. There are no right or wrong answers — your honest responses help guide your treatment.</p>
              </CardContent>
            </Card>

            {/* Clinician Instructions */}
            <button
              className="w-full flex justify-between items-center px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg font-semibold text-amber-900 text-sm hover:bg-amber-100 transition-colors"
              onClick={() => setShowClinicianInfo(!showClinicianInfo)}
            >
              <span className="flex items-center gap-2">📋 Clinician Instructions & Evidence</span>
              {showClinicianInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showClinicianInfo && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-6 space-y-5 text-sm">
                  <div>
                    <p className="font-semibold text-amber-900 mb-2">Purpose & Clinical Context</p>
                    <p className="text-amber-800 mb-2">
                      KOOS (Knee Injury and Osteoarthritis Outcome Score) is a validated, self-report patient-reported outcome measure (PROM) designed to assess knee-related problems across 5 distinct functional domains. Originally developed for knee ligament injuries (ACL), KOOS is now widely used for:
                    </p>
                    <ul className="text-amber-800 list-disc list-inside space-y-1 ml-2">
                      <li>Post-injury rehabilitation (ACL, meniscal, ligament injuries)</li>
                      <li>Post-surgical outcomes (arthroscopy, ACL reconstruction, meniscectomy)</li>
                      <li>Knee osteoarthritis monitoring and progression tracking</li>
                      <li>Conservative management response evaluation</li>
                      <li>Clinical trial primary/secondary outcomes</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-amber-900 mb-2">The 5 KOOS Domains & What They Measure</p>
                    <div className="bg-white p-3 rounded border border-amber-100 space-y-3">
                      <div>
                        <p className="font-semibold text-amber-900 text-xs">🔴 <strong>Pain (9 items)</strong></p>
                        <p className="text-amber-800 text-xs">Knee pain during specific activities (twisting, stairs, sport, etc.). Captures pain frequency and intensity across functional contexts. High pain scores often correlate with structural damage and/or inflammation.</p>
                      </div>
                      <div>
                        <p className="font-semibold text-amber-900 text-xs">🟠 <strong>Symptoms (7 items)</strong></p>
                        <p className="text-amber-800 text-xs">Stiffness (morning and after activity), swelling, crepitus, catching, and range of motion restrictions. Reflects synovial inflammation, cartilage damage, and mechanical dysfunction. Stiffness often improves first with treatment; catching may persist.</p>
                      </div>
                      <div>
                        <p className="font-semibold text-amber-900 text-xs">🟡 <strong>Activities of Daily Living — ADL (17 items)</strong></p>
                        <p className="text-amber-800 text-xs">The largest subscale; captures functional difficulty with stairs, walking, standing, bed mobility, dressing, bathing, and household tasks. Most sensitive to functional recovery post-injury or surgery. Often first area of improvement in rehabilitation.</p>
                      </div>
                      <div>
                        <p className="font-semibold text-amber-900 text-xs">🟢 <strong>Sport & Recreation (5 items)</strong></p>
                        <p className="text-amber-800 text-xs">Higher-demand activities: running, jumping, squatting, kneeling, turning. Most sensitive to functional limitations and highest threshold for return. Often last domain to normalize post-injury. Critical for work/sport return decisions.</p>
                      </div>
                      <div>
                        <p className="font-semibold text-amber-900 text-xs">🔵 <strong>Quality of Life — QoL (4 items)</strong></p>
                        <p className="text-amber-800 text-xs">Frequency of knee awareness, lifestyle modifications, lack of confidence, and overall difficulty perception. Psychosocial impact of knee problems; captures patient's subjective experience and fear-avoidance. Often remains impaired even after symptom improvement.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-amber-900 mb-2">Administration & Scoring Guidelines</p>
                    <ul className="text-amber-800 list-disc list-inside space-y-1 text-xs ml-2">
                      <li><strong>Timeframe:</strong> Always refer to "<strong>the past 7 days</strong>" — not "usual" or "ever". This ensures consistency and sensitivity to short-term change.</li>
                      <li><strong>Response Scale:</strong> 5-point Likert (0=None, 1=Mild, 2=Moderate, 3=Severe, 4=Extreme). Do NOT use intermediate values (no 0.5 scores).</li>
                      <li><strong>Scoring Formula:</strong> Raw score sum → convert to 0-100 scale per subscale using: (Sum of item scores / max possible score × 4) × 100. Higher = better function.</li>
                      <li><strong>Missing Data:</strong> If ≤2 items missing per subscale, impute using mean of completed items. If &gt;2 missing, subscale score invalid. Do NOT report overall average if subscales incomplete.</li>
                      <li><strong>Completion Time:</strong> 5-8 minutes typical. May take longer if patient has cognitive impairment or low literacy.</li>
                      <li><strong>Language:</strong> Validate translation (ISOQOL standard). Do NOT use back-translated or informal translations in clinical practice.</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-amber-900 mb-2">Normative Data & Clinical Interpretation</p>
                    <div className="bg-white p-3 rounded border border-amber-100 space-y-2 text-xs">
                      <p className="text-amber-800"><strong>Healthy controls (no knee disease):</strong> Mean ≈ 85-95 across all subscales.</p>
                      <p className="text-amber-800"><strong>Post-injury (acute, &lt;4 weeks post-op):</strong> Expect Pain 30-50, ADL 20-40, Sport 0-20 (severely limited).</p>
                      <p className="text-amber-800"><strong>Chronic/mild OA:</strong> Pain 50-70, ADL 60-80, Sport 30-50 (functional but with limitations).</p>
                      <p className="text-amber-800"><strong>Moderate-to-severe OA:</strong> Pain 30-50, ADL 30-60, Sport 0-30 (significant functional loss).</p>
                      <p className="text-amber-800"><strong>Minimal Clinically Important Difference (MCID):</strong> ≈ 8-10 points per subscale = meaningful change from patient's perspective.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-amber-900 mb-2">Longitudinal Tracking & Prognosis</p>
                    <ul className="text-amber-800 list-disc list-inside space-y-1 text-xs ml-2">
                      <li><strong>Post-ACL Reconstruction:</strong> Expect Pain/ADL improvement within 6-12 weeks; Sport/Recreation often takes 6-12 months to normalize.</li>
                      <li><strong>Post-Arthroscopy:</strong> Pain typically improves within 4 weeks; ADL by 8-12 weeks.</li>
                      <li><strong>OA Management:</strong> Conservative treatment (exercise, weight loss) may yield 5-15 point improvements; goal is slowing decline rather than restoration.</li>
                      <li><strong>Plateau Pattern:</strong> If scores plateau for &gt;3-4 weeks without progress, consider intervention change (therapy progression, imaging, specialist referral).</li>
                      <li><strong>Return-to-Sport Decision:</strong> Sport subscale &gt;56 traditionally used as threshold (expert consensus); some guidelines now recommend &gt;90% limb symmetry on strength testing alongside KOOS.</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-amber-900 mb-2">Clinical Interpretation Tips</p>
                    <div className="bg-white p-3 rounded border border-amber-100 space-y-2">
                      <p className="text-amber-800 text-xs"><strong>❗ Disproportionate subscale scores:</strong> If Pain is high but ADL is relatively preserved, consider psychological/fear-avoidance component. If ADL is low but Pain is mild, check for objective strength/ROM deficits.</p>
                      <p className="text-amber-800 text-xs"><strong>❗ Slow ADL recovery:</strong> Despite pain improvement, slow ADL recovery may indicate quadriceps weakness or proprioceptive deficits. Emphasize strength/balance training.</p>
                      <p className="text-amber-800 text-xs"><strong>❗ QoL improvement lag:</strong> QoL often lags behind symptom improvement. Address psychological factors (fear of re-injury, confidence-building) alongside physical rehab.</p>
                      <p className="text-amber-800 text-xs"><strong>❗ Sport score plateau:</strong> Common in older adults post-injury; may require modified sports or acceptance of functional limit rather than aggressive return.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-amber-900 mb-2">Psychometric Properties</p>
                    <ul className="text-amber-800 list-disc list-inside space-y-1 text-xs ml-2">
                      <li><strong>Reliability (Test-Retest):</strong> ICC = 0.76-0.94 across subscales (excellent).</li>
                      <li><strong>Validity:</strong> Correlates well with WOMAC, SF-36, VAS pain; discriminates between healthy and injured knees.</li>
                      <li><strong>Responsiveness:</strong> Effect sizes 0.5-1.2 (moderate-large) for detecting clinically important change over 3-6 months.</li>
                      <li><strong>Ceiling/Floor Effects:</strong> Minimal (&lt;10%) in most populations; may show some ceiling effect in very healthy controls.</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-amber-900 mb-2">Strengths & Limitations</p>
                    <div className="bg-white p-3 rounded border border-amber-100 space-y-2 text-xs">
                      <p className="text-amber-800"><strong>✅ Strengths:</strong> Multi-dimensional (5 domains), validated, responsive to change, brief, free, available in 30+ languages, widely accepted in research/clinical guidelines.</p>
                      <p className="text-amber-800"><strong>❌ Limitations:</strong> Patient-reported (subjective); does NOT measure ROM, strength, or clinical signs; can be influenced by mood/expectation; requires adequate literacy; may not be sensitive to very early or very late stages of recovery.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-amber-900 mb-2">Scope of Practice & Professional Responsibility</p>
                    <div className="bg-white p-3 rounded border border-amber-100 space-y-2">
                      <p className="text-amber-800 text-xs"><strong>Who Can Administer:</strong> KOOS can be administered by any healthcare professional (physiotherapist, occupational therapist, exercise physiologist, nurse, GP) and by trained support staff. No specialized certification required beyond understanding the instrument's purpose and limitations.</p>
                      <p className="text-amber-800 text-xs"><strong>Clinical Interpretation:</strong> Allied health professionals must interpret KOOS scores in context of physical examination findings (ROM, strength, hop tests, imaging where available). KOOS scores alone do NOT determine diagnosis or treatment decisions; they inform progress monitoring and guide management strategy adjustments.</p>
                      <p className="text-amber-800 text-xs"><strong>Return-to-Sport Decisions:</strong> Sport subscale scores inform but do NOT solely determine return-to-sport clearance. Require objective testing (strength symmetry index &gt;90%, hop test battery) and clinical judgment. Final clearance often requires physician/specialist approval (particularly post-ACL reconstruction).</p>
                      <p className="text-amber-800 text-xs"><strong>Documentation:</strong> Record all 5 subscale scores, overall score, assessment date, and relevant clinical context (post-op day, injury chronicity, concurrent treatments). Note if patient appears to have misunderstood questions or if significant discrepancy exists between KOOS scores and clinical presentation.</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-amber-900 mb-2">Clinical Recommendation: Complementary Assessments</p>
                    <p className="text-amber-800 text-xs">Do NOT rely on KOOS alone. Supplement with: strength testing (knee extension/flexion, hip abductors), ROM assessment, single-leg hop tests (for return-to-sport), proprioceptive testing, and imaging (if indicated by clinical presentation).</p>
                  </div>

                  <div>
                    <p className="font-semibold text-amber-900 mb-3">📚 Evidence Base & Key References</p>
                    <div className="bg-white p-4 rounded border border-amber-100 space-y-3 text-xs">
                      <div className="border-b border-amber-50 pb-3">
                        <p className="font-bold text-amber-900">Primary Development & Validation</p>
                        <ul className="text-amber-800 space-y-2 ml-3 mt-2">
                          <li>🔗 <strong>Original KOOS Paper:</strong> Roos EM, Klassbo M, Lohmander LS. (1999). "KOOS: a knee-specific outcome assessment tool." <em>Arthritis Care & Research, 12</em>(5), 331-335. doi:10.1002/1529-0131</li>
                          <li>🔗 <strong>ACL Validation Study:</strong> Roos EM, Lohmander LS. (2003). "KOOS is valid and responsive in evaluating the outcome of treatment for knee ligament injuries." <em>Journal of Clinical Epidemiology, 56</em>(6), 588-594.</li>
                          <li>🔗 <strong>OA Validation (vs WOMAC):</strong> Roos EM, Toksvig-Larsen S. (2003). "Knee injury and Osteoarthritis Outcome Score (KOOS) - validation and comparison to the WOMAC." <em>Health and Quality of Life Outcomes, 1</em>, 17.</li>
                        </ul>
                      </div>

                      <div className="border-b border-amber-50 pb-3">
                        <p className="font-bold text-amber-900">Return-to-Sport Evidence</p>
                        <ul className="text-amber-800 space-y-2 ml-3 mt-2">
                          <li>🔗 <strong>Barber-Westin & Noyes (2011):</strong> "Factors used to determine return to unrestricted sports activities after ACL reconstruction." <em>Sports Medicine, 41</em>(12), 987-1007.</li>
                          <li>🔗 <strong>ACL International Summit (2016):</strong> Consensus recommendations for return-to-sport decision-making post-ACL reconstruction (recommend KOOS Sport subscale &gt;56).</li>
                        </ul>
                      </div>

                      <div className="border-b border-amber-50 pb-3">
                        <p className="font-bold text-amber-900">Australian Clinical Guidelines</p>
                        <ul className="text-amber-800 space-y-2 ml-3 mt-2">
                          <li>📋 <strong>RACGP Red Book:</strong> General Practice Management of Knee Osteoarthritis — recommends KOOS for baseline and monitoring.</li>
                          <li>📋 <strong>ESSA Guidelines:</strong> Exercise and Sports Science Australia — recommend KOOS for musculoskeletal outcome tracking.</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-amber-900">Official Resources</p>
                        <div className="ml-3 mt-2">
                          <Button
                            onClick={() => window.open('https://www.koos.nu', '_blank')}
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 w-full justify-start"
                          >
                            <ExternalLink className="w-3 h-3 mr-2" />
                            Official KOOS Website — Scoring, Normatives, Translations
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Progress */}
            <div className="text-center text-sm text-slate-600">
              {getAnsweredQuestions()} / {getTotalQuestions()} questions answered
            </div>

            {/* Tabs for Sections */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="pain">Pain</TabsTrigger>
                <TabsTrigger value="symptoms">Symptoms</TabsTrigger>
                <TabsTrigger value="adl">Daily Living</TabsTrigger>
                <TabsTrigger value="sport">Sport/Rec</TabsTrigger>
                <TabsTrigger value="qol">QoL</TabsTrigger>
              </TabsList>

              {Object.entries(SECTIONS).map(([key, section]) => (
                <TabsContent key={key} value={key} className="mt-4 space-y-4">
                  <h3 className="font-bold text-lg text-slate-900">{section.name}</h3>
                  {key === "pain" && (
                    <p className="text-sm text-slate-600 italic mb-4">
                      What degree of pain have you experienced the last week when...?
                    </p>
                  )}
                  {key === "adl" && (
                    <p className="text-sm text-slate-600 italic mb-4">
                      What difficulty have you experienced the last week...?
                    </p>
                  )}
                  {key === "sport" && (
                    <p className="text-sm text-slate-600 italic mb-4">
                      What difficulty have you experienced the last week...?
                    </p>
                  )}

                  {section.questions.map((question, idx) => (
                    <Card key={question.id} className={responses[question.id] !== undefined ? "border-green-200 bg-green-50/30" : ""}>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold text-slate-900">
                          {question.id}. {question.text}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-5 gap-2">
                          {question.options.map((option, optIdx) => (
                            <Button
                              key={optIdx}
                              type="button"
                              variant={responses[question.id] === optIdx ? "default" : "outline"}
                              onClick={() => handleResponseChange(question.id, optIdx)}
                              className={`h-auto py-2 px-1 text-xs ${
                                responses[question.id] === optIdx ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-bold">{optIdx}</span>
                                <span className="text-[9px] leading-tight text-center">{option}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Section Score */}
                  {calculateSectionScore(key) !== null && (
                    <div className="bg-slate-100 p-4 rounded-lg text-center">
                      <p className="text-sm text-slate-600">Section Score</p>
                      <p className="text-2xl font-bold text-blue-600">{calculateSectionScore(key)} / 100</p>
                      <p className="text-xs text-slate-500 mt-1">Higher = Better function</p>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>

            {/* Overall Summary */}
            {allAnswered && (
              <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 border-2">
                <CardContent className="py-6">
                  <h3 className="font-bold text-slate-900 mb-4 text-center text-lg">KOOS Subscale Scores</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {Object.entries(SECTIONS).map(([key, section]) => (
                      <div key={key} className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-600 mb-1">{section.name}</p>
                        <p className="text-2xl font-bold text-blue-600">{calculateSectionScore(key)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-xs text-center text-slate-600 bg-white/70 rounded p-2">
                    Scores range 0-100. 0 = extreme knee problems, 100 = no knee problems
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {getAnsweredQuestions()} / {getTotalQuestions()} completed
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!allAnswered}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save KOOS Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}