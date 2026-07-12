import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, AlertTriangle, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { todayLocal } from "@/lib/localDate";

const SIDE_OPTIONS = ["Left", "Right", "Bilateral"];
const END_FEEL_OPTIONS = [
  "Firm/Normal (intact ACL)",
  "Soft/Abnormal (ACL insufficiency)",
  "Hard/Bony",
  "Empty (pain limits full assessment)",
  "Absent end-feel (complete rupture suspected)",
];
const TRANSLATION_GRADE = [
  { value: "0", label: "Grade 0 – No laxity (<3mm)" },
  { value: "1+", label: "Grade 1+ – Mild laxity (3–5mm)" },
  { value: "2+", label: "Grade 2+ – Moderate laxity (6–10mm)" },
  { value: "3+", label: "Grade 3+ – Severe laxity (>10mm)" },
];

export default function AnteriorDrawerTestKneeRunner({ client, onSave, onClose }) {
  const [side, setSide] = useState("Left");
  const [anteriorTranslation, setAnteriorTranslation] = useState("");
  const [translationGrade, setTranslationGrade] = useState("");
  const [endFeel, setEndFeel] = useState("");
  const [painOnTest, setPainOnTest] = useState("");
  const [painLocation, setPainLocation] = useState("");
  const [comparedToContralateral, setComparedToContralateral] = useState("");
  const [suspectedACLTear, setSuspectedACLTear] = useState("");
  const [additionalFindings, setAdditionalFindings] = useState("");
  const [notes, setNotes] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) =>
    setExpandedSection(expandedSection === section ? null : section);

  const handleSave = () => {
    if (!translationGrade && !anteriorTranslation) {
      toast.error("Please enter anterior translation measurement or laxity grade.");
      return;
    }

    const isPositive =
      translationGrade === "2+" ||
      translationGrade === "3+" ||
      (anteriorTranslation !== "" && parseFloat(anteriorTranslation) > 5);
    const overallResult = isPositive ? "Positive" : "Negative";

    const gradeLabel = TRANSLATION_GRADE.find((g) => g.value === translationGrade);

    const soapLines = [
      `• Anterior Drawer Test (Knee) — ${side} Side`,
      `  Overall Result: ${overallResult}`,
      anteriorTranslation ? `  Anterior Translation: ${anteriorTranslation} mm` : null,
      translationGrade ? `  Laxity Grade: ${gradeLabel ? gradeLabel.label : translationGrade}` : null,
      endFeel ? `  End Feel: ${endFeel}` : null,
      painOnTest ? `  Pain on Test: ${painOnTest}` : null,
      painLocation ? `  Pain Location: ${painLocation}` : null,
      comparedToContralateral ? `  Contralateral Comparison: ${comparedToContralateral}` : null,
      suspectedACLTear ? `  Clinical Impression: ${suspectedACLTear}` : null,
      additionalFindings ? `  Additional Findings: ${additionalFindings}` : null,
      notes ? `  Clinical Notes: ${notes}` : null,
      `  Diagnostic accuracy: Sensitivity ~41%, Specificity ~95% for acute ACL tears (Benjaminse et al., 2006).`,
      `  Best combined with Lachman Test and Pivot Shift Test for ACL evaluation.`,
    ]
      .filter(Boolean)
      .join("\n");

    onSave({
      status: "completed",
      result_value: isPositive ? 1 : 0,
      additional_data: {
        measurement_type: "anterior_drawer_knee",
        soap_text: soapLines,
        side,
        anterior_translation_mm: anteriorTranslation ? parseFloat(anteriorTranslation) : null,
        translation_grade: translationGrade,
        end_feel: endFeel,
        pain_on_test: painOnTest,
        pain_location: painLocation,
        compared_to_contralateral: comparedToContralateral,
        suspected_acl_tear: suspectedACLTear,
        additional_findings: additionalFindings,
        overall_result: isPositive ? "Positive" : "Negative",
      },
      notes,
      assessment_date: todayLocal(),
    });
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Anterior Drawer Test (Knee)</h2>
          <p className="text-sm text-slate-500 mt-0.5">Special orthopaedic test — ACL integrity assessment</p>
          {client && <p className="text-xs text-slate-400 mt-0.5">Client: {client.full_name}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Demo Image */}
       <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
         <img
           src="https://images.unsplash.com/photo-1576091160550-2173f7f869?w=800&q=80"
           alt="Anterior Drawer Test positioning"
           className="w-full h-48 object-cover object-center"
           onError={(e) => {
             e.target.style.display = "none";
           }}
         />
         <div className="px-4 py-2 bg-slate-100 text-xs text-slate-500 text-center">
           Client supine, knee at 90° flexion — clinician draws tibia anteriorly
         </div>
       </div>

      {/* Clinical Overview — collapsible */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-0 pt-3 px-4">
          <button
            onClick={() => toggleSection("overview")}
            className="w-full flex items-center justify-between text-blue-900 font-semibold text-sm"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Clinical Overview &amp; Purpose
            </span>
            {expandedSection === "overview" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </CardHeader>
        {expandedSection === "overview" && (
          <CardContent className="pt-3 pb-4 px-4 text-xs text-blue-900 space-y-2">
            <p>
              <strong>Purpose:</strong> Assesses the integrity of the Anterior Cruciate Ligament (ACL) by evaluating
              anterior tibial translation relative to the femur. A positive test suggests ACL insufficiency or rupture.
            </p>
            <p>
              <strong>Mechanism:</strong> The ACL resists anterior translation of the tibia on the femur. Laxity or
              absence of a firm end-feel indicates ligamentous insufficiency.
            </p>
            <p>
              <strong>Accuracy:</strong> Sensitivity ~41%, Specificity ~95% for acute ACL tears. Less sensitive in
              acute settings due to hamstring guarding. Most reliable in chronic ACL insufficiency.
            </p>
            <p>
              <strong>Limitations:</strong> Hamstring spasm, pain, and effusion can produce false negatives. Always
              combine with the Lachman Test (higher sensitivity) and Pivot Shift Test for comprehensive ACL evaluation.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Protocol — collapsible */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-0 pt-3 px-4">
          <button
            onClick={() => toggleSection("protocol")}
            className="w-full flex items-center justify-between text-amber-900 font-semibold text-sm"
          >
            <span>Step-by-Step Protocol</span>
            {expandedSection === "protocol" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </CardHeader>
        {expandedSection === "protocol" && (
          <CardContent className="pt-3 pb-4 px-4 text-xs text-amber-900 space-y-2">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Client supine on plinth with knee flexed to <strong>90°</strong> and foot flat on table.</li>
              <li>
                Clinician sits on client's foot to stabilise, or uses body weight — ensure the foot is fully
                secured.
              </li>
              <li>
                Place both hands behind the proximal tibia with thumbs on the tibial plateau anteriorly.
              </li>
              <li>
                Ensure hamstrings are <strong>relaxed</strong> (palpate for guarding before applying force).
              </li>
              <li>Apply a firm, smooth anterior force to the tibia and assess for translation.</li>
              <li>Note: amount of displacement, end-feel, and symptom reproduction.</li>
              <li>Repeat on the contralateral side for comparison.</li>
            </ol>
            <div className="bg-white rounded border border-amber-200 p-2 mt-1">
              <p className="font-semibold mb-0.5">Clinician Script:</p>
              <p className="italic">
                "I'm going to bend your knee and gently pull your lower leg forward. Please relax your thigh and
                hamstring muscles as much as possible. Tell me if you feel any pain or discomfort."
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Grading Reference — collapsible */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-0 pt-3 px-4">
          <button
            onClick={() => toggleSection("grading")}
            className="w-full flex items-center justify-between text-green-900 font-semibold text-sm"
          >
            <span>Grading &amp; Interpretation Guide</span>
            {expandedSection === "grading" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </CardHeader>
        {expandedSection === "grading" && (
          <CardContent className="pt-3 pb-4 px-4 text-xs text-green-900 space-y-2">
            <table className="w-full text-xs border rounded overflow-hidden">
              <thead className="bg-green-100">
                <tr>
                  <th className="px-2 py-1.5 text-left">Grade</th>
                  <th className="px-2 py-1.5 text-left">Translation</th>
                  <th className="px-2 py-1.5 text-left">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Grade 0", "<3mm", "No laxity — ACL intact"],
                  ["Grade 1+", "3–5mm", "Mild laxity — partial tear possible"],
                  ["Grade 2+", "6–10mm", "Moderate laxity — significant ACL injury"],
                  ["Grade 3+", ">10mm", "Severe laxity — complete ACL rupture"],
                ].map(([grade, trans, interp], i) => (
                  <tr key={grade} className={i % 2 === 0 ? "bg-white" : "bg-green-50"}>
                    <td className="px-2 py-1.5 font-semibold">{grade}</td>
                    <td className="px-2 py-1.5">{trans}</td>
                    <td className="px-2 py-1.5">{interp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              <strong>End Feel:</strong> Firm end-feel = intact ACL. Soft/absent end-feel = ACL insufficiency.
            </p>
            <p>
              <strong>Positive Test:</strong> ≥6mm anterior translation (Grade 2+/3+) OR soft/absent end-feel
              (in absence of hamstring guarding).
            </p>
          </CardContent>
        )}
      </Card>

      {/* References — collapsible */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader className="pb-0 pt-3 px-4">
          <button
            onClick={() => toggleSection("references")}
            className="w-full flex items-center justify-between text-slate-700 font-semibold text-sm"
          >
            <span>References</span>
            {expandedSection === "references" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </CardHeader>
        {expandedSection === "references" && (
          <CardContent className="pt-3 pb-4 px-4 text-xs text-slate-600 space-y-2">
            <p>
              <strong>Benjaminse A, Gokeler A, van der Schans CP.</strong> (2006). Clinical diagnosis of an anterior
              cruciate ligament rupture: a meta-analysis. <em>Journal of Orthopaedic & Sports Physical Therapy</em>,
              36(5), 267–288.
            </p>
            <p>
              <strong>Malanga GA, Andrus S, Nadler SF, McLean J.</strong> (2003). Physical examination of the knee:
              a review of the original test description and scientific validity of common orthopaedic tests.
              <em> Archives of Physical Medicine and Rehabilitation</em>, 84(4), 592–603.
            </p>
            <p>
              <strong>van Eck CF, van den Bekerom MPJ, Fu FH, Poolman RW, Kerkhoffs GMMJ.</strong> (2013). Methods to
              diagnose acute anterior cruciate ligament rupture. <em>Knee Surgery, Sports Traumatology, Arthroscopy</em>,
              21(8), 1895–1903.
            </p>
          </CardContent>
        )}
      </Card>

      {/* ─── DATA ENTRY ─── */}

      {/* Side */}
      <div>
        <Label>Side Tested</Label>
        <Select value={side} onValueChange={setSide}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIDE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Measurements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Anterior Translation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Measured Translation (mm)</Label>
            <Input
              type="number"
              step="0.5"
              placeholder="e.g. 6"
              value={anteriorTranslation}
              onChange={(e) => setAnteriorTranslation(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Laxity Grade</Label>
            <Select value={translationGrade} onValueChange={setTranslationGrade}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select grade..." />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATION_GRADE.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* End Feel */}
      <div>
        <Label>End Feel</Label>
        <Select value={endFeel} onValueChange={setEndFeel}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select end feel..." />
          </SelectTrigger>
          <SelectContent>
            {END_FEEL_OPTIONS.map((ef) => (
              <SelectItem key={ef} value={ef}>
                {ef}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pain */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pain Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Pain Reproduced on Test?</Label>
            <Select value={painOnTest} onValueChange={setPainOnTest}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="No pain">No pain</SelectItem>
                <SelectItem value="Mild pain (1–3/10)">Mild pain (1–3/10)</SelectItem>
                <SelectItem value="Moderate pain (4–6/10)">Moderate pain (4–6/10)</SelectItem>
                <SelectItem value="Severe pain (7–10/10)">Severe pain (7–10/10)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pain Location (if present)</Label>
            <Input
              placeholder="e.g. anteromedial joint line, diffuse anterior knee"
              value={painLocation}
              onChange={(e) => setPainLocation(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contralateral Comparison */}
      <div>
        <Label>Comparison to Contralateral Side</Label>
        <Input
          placeholder="e.g. 3mm greater translation compared to right knee"
          value={comparedToContralateral}
          onChange={(e) => setComparedToContralateral(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Clinical Impression */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Clinical Impression</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Suspected ACL Injury?</Label>
            <Select value={suspectedACLTear} onValueChange={setSuspectedACLTear}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="No – Test negative, ACL likely intact">
                  No – Test negative, ACL likely intact
                </SelectItem>
                <SelectItem value="Inconclusive – Further investigation recommended">
                  Inconclusive – Further investigation recommended
                </SelectItem>
                <SelectItem value="Yes – Positive test, partial ACL tear suspected">
                  Yes – Positive test, partial ACL tear suspected
                </SelectItem>
                <SelectItem value="Yes – Positive test, complete ACL rupture suspected">
                  Yes – Positive test, complete ACL rupture suspected
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Additional Findings</Label>
            <Input
              placeholder="e.g. guarding observed, co-existing meniscal symptoms, effusion present"
              value={additionalFindings}
              onChange={(e) => setAdditionalFindings(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clinical Interpretation Banner */}
      {translationGrade && (
        <div
          className={`rounded-lg p-3 border-2 text-sm font-semibold flex items-center gap-2 ${
            translationGrade === "2+" || translationGrade === "3+"
              ? "bg-red-50 border-red-300 text-red-700"
              : translationGrade === "1+"
              ? "bg-yellow-50 border-yellow-300 text-yellow-700"
              : "bg-green-50 border-green-300 text-green-700"
          }`}
        >
          {translationGrade === "2+" || translationGrade === "3+" ? (
            <>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Positive Test — ACL insufficiency suspected. Recommend imaging and orthopaedic review.
            </>
          ) : translationGrade === "1+" ? (
            <>⚠ Equivocal — mild laxity. Correlate with Lachman and clinical history.</>
          ) : (
            <>✓ Grade 0 — No significant laxity detected. ACL likely intact.</>
          )}
        </div>
      )}

      {/* Clinical Notes */}
      <div>
        <Label>Clinical Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Hamstring guarding noted, test quality, client cooperation, further recommendations..."
          rows={3}
          className="mt-1"
        />
      </div>

      {/* Footer */}
      <div className="flex justify-between pt-2 border-t">
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4 mr-2" />
          Save Assessment
        </Button>
      </div>
    </div>
  );
}