import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Save, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const PSS_10_ITEMS = [
  { id: 1, text: "In the last month, how often have you been upset because of something that happened unexpectedly?", reversed: false },
  { id: 2, text: "In the last month, how often have you felt that you were unable to control the important things in your life?", reversed: false },
  { id: 3, text: "In the last month, how often have you felt nervous and stressed?", reversed: false },
  { id: 4, text: "In the last month, how often have you felt confident about your ability to handle your personal problems?", reversed: true },
  { id: 5, text: "In the last month, how often have you felt that things were going your way?", reversed: true },
  { id: 6, text: "In the last month, how often have you found that you could not cope with all the things that you had to do?", reversed: false },
  { id: 7, text: "In the last month, how often have you been able to control irritations in your life?", reversed: true },
  { id: 8, text: "In the last month, how often have you felt that you were on top of things?", reversed: true },
  { id: 9, text: "In the last month, how often have you been angered because of things that were outside of your control?", reversed: false },
  { id: 10, text: "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?", reversed: false }
];

export default function PSS10Runner({ onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState("");
  const [showClinicianInfo, setShowClinicianInfo] = useState(false);

  const handleScoreChange = (itemId, value, isReversed) => {
    // For reversed items, we store the actual value selected, calculation handles reversal
    setScores({ ...scores, [itemId]: { value, isReversed } });
  };

  const calculateTotal = () => {
    return PSS_10_ITEMS.reduce((sum, item) => {
      const scoreData = scores[item.id];
      if (!scoreData) return sum;
      
      const value = parseInt(scoreData.value);
      // Reverse scoring for items 4, 5, 7, 8 (4 - value)
      const actualScore = item.reversed ? (4 - value) : value;
      return sum + actualScore;
    }, 0);
  };

  const total = calculateTotal();

  const getInterpretation = () => {
    if (total <= 13) {
      return {
        level: 'Low perceived stress',
        color: 'text-green-600',
        bg: 'bg-green-50',
        description: 'Stress levels are well-managed. Continue current coping strategies.'
      };
    } else if (total <= 26) {
      return {
        level: 'Moderate perceived stress',
        color: 'text-yellow-600',
        bg: 'bg-yellow-50',
        description: 'Some stress management strategies may be beneficial. Exercise can help reduce stress.'
      };
    } else {
      return {
        level: 'High perceived stress',
        color: 'text-red-600',
        bg: 'bg-red-50',
        description: 'Significant stress. Consider referral for stress management, counseling, or psychological support alongside exercise.'
      };
    }
  };

  const interpretation = Object.keys(scores).length === 10 ? getInterpretation() : null;

  const handleSave = () => {
    if (Object.keys(scores).length < 10) {
      toast.error("Please complete all 10 items");
      return;
    }

    onSave({
      result_value: total,
      additional_data: {
        soap_text: `• Perceived Stress Scale (PSS-10)\n  Total Score: ${total}/40 — ${interpretation?.level}`,
        total_score: total,
        item_scores: Object.keys(scores).reduce((obj, key) => {
          obj[key] = scores[key].value;
          return obj;
        }, {}),
        interpretation: interpretation?.level
      },
      notes: notes,
      assessment_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Perceived Stress Scale (PSS-10)</h2>
              <p className="text-slate-600 mt-1">Assessment of perceived stress over the past month</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Clinician Instructions Collapsible */}
          <button
            onClick={() => setShowClinicianInfo(!showClinicianInfo)}
            className="w-full flex justify-between items-center px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg font-semibold text-indigo-900 hover:bg-indigo-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Clinician Instructions & Administration Guide
            </span>
            {showClinicianInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showClinicianInfo && (
            <Card className="bg-indigo-50 border-indigo-200">
              <CardContent className="pt-6 space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-indigo-900 mb-2">Purpose & Clinical Use</p>
                  <p className="text-indigo-800 mb-2">
                    The <strong>Perceived Stress Scale (PSS-10)</strong> is a 10-item self-report questionnaire that measures the degree to which situations in one's life are appraised as <strong>stressful, unpredictable, uncontrollable, and overwhelming</strong> over the past month. It is one of the most widely used psychological instruments for measuring non-specific perceived stress in both clinical and research settings.
                  </p>
                  <ul className="text-indigo-800 list-disc list-inside space-y-1">
                    <li>Screen for chronic stress in primary care, rehabilitation, occupational health, and mental health settings</li>
                    <li>Assess stress as a barrier to exercise adherence, recovery, and health behavior change</li>
                    <li>Monitor treatment response to stress management interventions (CBT, mindfulness, relaxation training)</li>
                    <li>Predict risk for stress-related conditions: anxiety, depression, burnout, cardiovascular disease, immune dysfunction</li>
                    <li>Baseline assessment in lifestyle medicine, cardiac rehabilitation, chronic pain management, and workplace wellness programs</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-2">Psychometric Properties</p>
                  <div className="bg-white p-3 rounded border border-indigo-300 space-y-2 text-xs">
                    <p className="text-indigo-800"><strong>Internal Consistency:</strong> Cronbach's α = 0.78–0.91 (excellent reliability across diverse populations)</p>
                    <p className="text-indigo-800"><strong>Test-Retest Reliability:</strong> r = 0.55–0.70 over 2–6 weeks (moderate-to-high stability; appropriate for a state measure sensitive to change)</p>
                    <p className="text-indigo-800"><strong>Construct Validity:</strong> Strong correlations with depression (r = 0.52–0.70), anxiety (r = 0.50–0.65), health complaints (r = 0.35–0.45), and negative affect (r = 0.60–0.75)</p>
                    <p className="text-indigo-800"><strong>Factor Structure:</strong> Two-factor model: Negative subscale (items 1, 2, 3, 6, 9, 10) and Positive subscale (items 4, 5, 7, 8, reverse-scored). Total score is most commonly used in clinical practice.</p>
                    <p className="text-indigo-800"><strong>Sensitivity to Change:</strong> PSS scores decrease significantly following stress management interventions, mindfulness-based stress reduction (MBSR), CBT, and exercise programs (effect sizes d = 0.40–0.80)</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-2">Administration Instructions</p>
                  <ol className="text-indigo-800 list-decimal list-inside space-y-1 text-xs">
                    <li><strong>Setting:</strong> Quiet, private environment. Can be self-administered (paper or digital) or clinician-administered (interview format).</li>
                    <li><strong>Time Frame:</strong> Emphasize "during the LAST MONTH" — not just recent days or general life stress.</li>
                    <li><strong>Instructions to Client:</strong> "Read each statement carefully. Indicate how OFTEN you felt or thought this way during the last month. There are no right or wrong answers. Answer honestly based on your actual experience."</li>
                    <li><strong>Response Scale:</strong> 0 = Never, 1 = Almost Never, 2 = Sometimes, 3 = Fairly Often, 4 = Very Often</li>
                    <li><strong>Completion Time:</strong> 3–5 minutes. No time limit, but encourage first instinct rather than overthinking.</li>
                    <li><strong>Scoring:</strong> Items 4, 5, 7, 8 are reverse-scored (4 – value). Sum all 10 items for total score (range 0–40). Higher scores = greater perceived stress.</li>
                    <li><strong>Missing Data:</strong> If 1–2 items missing, prorate based on completed items. If ≥3 items missing, administer again.</li>
                  </ol>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-2">Expanded Normative Data</p>
                  <div className="bg-white p-3 rounded border border-indigo-300 space-y-2 text-xs">
                    <p className="text-indigo-800 font-semibold">Community Adults (General Population):</p>
                    <ul className="text-indigo-800 list-disc list-inside space-y-0.5">
                      <li>Mean: 13.0–14.5 (SD ≈ 6.0–7.0)</li>
                      <li>Percentiles: 25th ≈ 9–10, 50th ≈ 13–14, 75th ≈ 18–19</li>
                      <li>Source: Cohen & Williamson (1988); U.S. national sample (N = 2,387)</li>
                    </ul>
                    <p className="text-indigo-800 font-semibold mt-2">University Students:</p>
                    <ul className="text-indigo-800 list-disc list-inside space-y-0.5">
                      <li>Mean: 15.0–17.0 (SD ≈ 6.5–7.5) — typically higher due to academic stress</li>
                      <li>Source: Multiple studies (Barg et al., 2018; Lee, 2012)</li>
                    </ul>
                    <p className="text-indigo-800 font-semibold mt-2">Clinical Populations:</p>
                    <ul className="text-indigo-800 list-disc list-inside space-y-0.5">
                      <li>Anxiety disorders: Mean ≈ 22–26</li>
                      <li>Depression: Mean ≈ 24–28</li>
                      <li>Chronic pain: Mean ≈ 19–23</li>
                      <li>Cardiac rehabilitation: Mean ≈ 16–20</li>
                    </ul>
                    <p className="text-indigo-800 font-semibold mt-2">Interpretation Guidelines:</p>
                    <ul className="text-indigo-800 list-disc list-inside space-y-0.5">
                      <li><strong>0–13 (Low):</strong> Below average stress; effective coping</li>
                      <li><strong>14–26 (Moderate):</strong> Average to elevated stress; consider stress management</li>
                      <li><strong>27–40 (High):</strong> Significantly elevated; clinical intervention recommended</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-2">Clinical Considerations & Red Flags</p>
                  <div className="bg-white p-3 rounded border border-indigo-300 space-y-2 text-xs">
                    <p className="text-indigo-800"><strong>High Stress (&gt;26):</strong> Screen for anxiety (GAD-7), depression (PHQ-9), burnout, insomnia. Assess suicide risk if score &gt;30 or client expresses hopelessness.</p>
                    <p className="text-indigo-800"><strong>Exercise Implications:</strong> Chronic stress impairs recovery, increases cortisol, reduces immune function, and elevates injury risk. Modify exercise intensity, prioritize restorative activities (yoga, tai chi, walking in nature), and integrate relaxation techniques.</p>
                    <p className="text-indigo-800"><strong>Cultural Considerations:</strong> PSS has been validated in 20+ languages. Some cultures may underreport stress due to stigma; use clinical judgment and observe nonverbal cues.</p>
                    <p className="text-indigo-800"><strong>Pregnancy:</strong> Elevated stress during pregnancy is associated with preterm birth and low birth weight. Refer to perinatal mental health specialist if score &gt;20.</p>
                    <p className="text-indigo-800"><strong>Older Adults:</strong> May report lower stress than younger adults, but high scores predict faster cognitive decline and functional impairment.</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-2">Scope of Practice & Referral Guidelines</p>
                  <div className="bg-white p-3 rounded border border-indigo-300 space-y-2 text-xs">
                    <p className="text-indigo-800"><strong>Who Can Administer:</strong> Any trained health professional (PT, OT, EP, nurse, GP, psychologist, social worker). No specific credential required.</p>
                    <p className="text-indigo-800"><strong>Interpretation:</strong> Results should be discussed in context of client's overall health, life circumstances, and coping resources. High scores warrant further assessment.</p>
                    <p className="text-indigo-800"><strong>Referral Indications:</strong>
                      <ul className="list-circle list-inside ml-4 mt-1 space-y-0.5">
                        <li>Score &gt;26: Refer to psychologist, counselor, or stress management program</li>
                        <li>Score &gt;30 or suicidal ideation: Urgent mental health referral</li>
                        <li>Concurrent depression/anxiety symptoms: Mental health assessment</li>
                        <li>Work-related stress: Occupational health referral</li>
                        <li>Perinatal stress: Perinatal mental health specialist</li>
                      </ul>
                    </p>
                    <p className="text-indigo-800"><strong>Documentation:</strong> Record score, interpretation, clinical observations, referrals made, and follow-up plan in client's health record.</p>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-2">Evidence-Based Interventions for Elevated Stress</p>
                  <div className="bg-white p-3 rounded border border-indigo-300 space-y-2 text-xs">
                    <p className="text-indigo-800 font-semibold">Exercise Prescription:</p>
                    <ul className="text-indigo-800 list-disc list-inside space-y-0.5">
                      <li>Aerobic exercise: 30 min moderate intensity, 5 days/week (reduces cortisol, improves mood)</li>
                      <li>Mind-body exercise: Yoga, tai chi, qigong (2–3 sessions/week; reduces perceived stress by 20–30%)</li>
                      <li>Nature-based activity: Walking in green spaces (lowers rumination, improves stress recovery)</li>
                    </ul>
                    <p className="text-indigo-800 font-semibold mt-2">Adjunctive Strategies:</p>
                    <ul className="text-indigo-800 list-disc list-inside space-y-0.5">
                      <li>Mindfulness-Based Stress Reduction (MBSR): 8-week program; effect size d = 0.60–0.80</li>
                      <li>Cognitive Behavioral Therapy (CBT): Gold standard for stress management</li>
                      <li>Breathing exercises: Diaphragmatic breathing, box breathing (acute stress reduction)</li>
                      <li>Sleep hygiene: 7–9 hours/night; poor sleep exacerbates stress</li>
                      <li>Social support: Strengthen connections; isolation worsens stress perception</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-indigo-900 mb-2">Key References</p>
                  <div className="bg-white p-3 rounded border border-indigo-300 space-y-2 text-xs">
                    <p className="text-indigo-800"><strong>Original Scale:</strong> Cohen S, Kamarck T, Mermelstein R. (1983). A global measure of perceived stress. <em>Journal of Health and Social Behavior, 24</em>(4), 385–396. <a href="https://pubmed.ncbi.nlm.nih.gov/6668417/" target="_blank" className="text-indigo-600 underline inline-flex items-center gap-1">PubMed <ExternalLink className="w-3 h-3" /></a></p>
                    <p className="text-indigo-800"><strong>Normative Data:</strong> Cohen S, Williamson G. (1988). Perceived stress in a probability sample of the United States. In: Spacapan S, Oskamp S (eds). <em>The Social Psychology of Health</em>. Newbury Park, CA: Sage.</p>
                    <p className="text-indigo-800"><strong>Psychometric Review:</strong> Lee E-H. (2012). Review of the psychometric evidence of the Perceived Stress Scale. <em>Asian Nursing Research, 6</em>(4), 121–127.</p>
                    <p className="text-indigo-800"><strong>Exercise & Stress:</strong> Childs E, de Wit H. (2014). Exercise training reduces baseline sympathetic activity in healthy young men. <em>Medicine & Science in Sports & Exercise, 46</em>(5), 980–987.</p>
                    <p className="text-indigo-800"><strong>MBSR Effectiveness:</strong> Khoury B, et al. (2015). Mindfulness-based stress reduction for healthy individuals: A meta-analysis. <em>Journal of Psychosomatic Research, 78</em>(6), 519–528.</p>
                    <p className="text-indigo-800"><strong>Australian Guidelines:</strong> Beyond Blue: National Mental Health Survey; RACGP guidelines for mental health in primary care. <a href="https://www.beyondblue.org.au" target="_blank" className="text-indigo-600 underline inline-flex items-center gap-1">beyondblue.org.au <ExternalLink className="w-3 h-3" /></a></p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-300 p-3 rounded">
                  <p className="text-indigo-800 text-xs"><strong>⚠ CRITICAL:</strong> PSS-10 is a screening tool, NOT a diagnostic instrument. High scores indicate need for comprehensive mental health assessment. If client expresses suicidal ideation, self-harm, or severe distress, initiate immediate safety protocol and refer to emergency mental health services.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Score Interpretation (/40)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Stress Level</th><th className="p-2 text-left">Action</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">0–13</td><td className="p-2 text-green-700">Low perceived stress</td><td className="p-2">Reinforce coping strategies</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">14–26</td><td className="p-2 text-yellow-700">Moderate perceived stress</td><td className="p-2">Stress management strategies; consider counselling</td></tr>
                    <tr className="border-t"><td className="p-2">27–40</td><td className="p-2 text-red-700">High perceived stress</td><td className="p-2">Referral to psychologist or counsellor</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Items 4, 5, 7, 8 are reverse-scored. Normative mean ~13–14 (community adults). Source: Cohen et al. (1983).</p>
            </div>

            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Cohen S, Kamarck T, & Mermelstein R. (1983). A global measure of perceived stress. <em>Journal of Health and Social Behavior, 24</em>(4), 385–396.</p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Clinician Script
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>"I'm going to ask you about your feelings and thoughts during the last month. For each question, please indicate how often you felt or thought a certain way."</p>
                <div className="mt-3 space-y-1">
                  <p><strong>0 = Never</strong></p>
                  <p><strong>1 = Almost never</strong></p>
                  <p><strong>2 = Sometimes</strong></p>
                  <p><strong>3 = Fairly often</strong></p>
                  <p><strong>4 = Very often</strong></p>
                </div>
                <p className="mt-3">"There are no right or wrong answers. We're interested in understanding how you've been coping with life's demands."</p>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                  ⚠ Clinical Considerations
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-amber-800">
                <p><strong>Stress & Exercise:</strong> High chronic stress can impair recovery, increase injury risk, and reduce exercise adherence. Stress management should be integrated with exercise programming.</p>
                <p className="mt-2"><strong>Holistic Approach:</strong> High scores may indicate need for referral to counseling, mindfulness programs, or relaxation training alongside exercise therapy.</p>
                <p className="mt-2"><strong>Monitor:</strong> Stress can manifest as fatigue, irritability, sleep disturbances, or changes in pain perception.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">PSS-10 Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {PSS_10_ITEMS.map((item) => (
                  <div key={item.id} className="border-b pb-4 last:border-b-0">
                    <Label className="text-base mb-2 block">
                      {item.id}. {item.text}
                      {item.reversed && <span className="text-xs text-purple-600 ml-2">(reverse scored)</span>}
                    </Label>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 1, 2, 3, 4].map((score) => (
                        <Button
                          key={score}
                          type="button"
                          variant={scores[item.id]?.value === score.toString() ? "default" : "outline"}
                          onClick={() => handleScoreChange(item.id, score.toString(), item.reversed)}
                          className="w-16"
                        >
                          {score}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {interpretation && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-xl ${interpretation.color}`}>
                    {interpretation.level}
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <div className="space-y-2">
                    <p className="font-semibold">Total Score: {total} / 40</p>
                    <p className="mt-2">{interpretation.description}</p>
                    {total > 26 && (
                      <p className="mt-3 p-3 bg-white/50 rounded">
                        <strong>Recommendation:</strong> Incorporate stress-reducing exercise modalities (e.g., yoga, tai chi, mindful walking) and consider referral to stress management services.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Stress triggers discussed, coping strategies, impact on exercise capacity, referrals made..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={Object.keys(scores).length < 10}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save PSS-10 Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}