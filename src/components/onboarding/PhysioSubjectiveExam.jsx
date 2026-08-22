import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, ClipboardList } from "lucide-react";

// A 0-10 numeric pain rating with a plain-language descriptor per point,
// consistent with the numeric rating scale already used for pain_level
// elsewhere in this codebase (see MedicalHistory.jsx). This is a
// non-proprietary scale and may be reproduced in full.
const painDescriptor = (num) => {
  if (num === 0) return "No pain";
  if (num <= 3) return "Mild";
  if (num <= 6) return "Moderate";
  return "Severe";
};

function PainRatingField({ id, label, value, onChange }) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</Label>
      <Select value={value?.toString() || ""} onValueChange={(v) => onChange(v ? parseInt(v, 10) : "")}>
        <SelectTrigger id={id} className="mt-1">
          <SelectValue placeholder="Select a rating" />
        </SelectTrigger>
        <SelectContent>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <SelectItem key={num} value={num.toString()}>
              {num} - {painDescriptor(num)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
// Field order and content follow the SOAP subjective data points set out in
// the Australian Physiotherapy Association's "Guidelines for writing
// clinical notes" (2018, version 5). No proprietary outcome-measure item
// wording (ODI, NDI, DASH/QuickDASH, KOOS, HOOS, STarT Back, Tampa Scale,
// Pain Catastrophising Scale) is reproduced here; where such a measure is
// used clinically it is referenced by name with a manually entered score,
// never by embedding its questionnaire items.
export default function PhysioSubjectiveExam({ data, onNext, onBack, onSaveAndFinishLater, canGoBack, isSubmitting }) {
  const [formData, setFormData] = useState({
    physio_subj_presenting_complaint: data.physio_subj_presenting_complaint || "",
    physio_subj_body_chart_area: data.physio_subj_body_chart_area || "",
    physio_subj_mechanism_of_onset: data.physio_subj_mechanism_of_onset || "",
    physio_subj_duration: data.physio_subj_duration || "",
    physio_subj_pattern_night: data.physio_subj_pattern_night || "",
    physio_subj_pattern_morning: data.physio_subj_pattern_morning || "",
    physio_subj_pattern_evening: data.physio_subj_pattern_evening || "",
    physio_subj_aggravating_factors: data.physio_subj_aggravating_factors || "",
    physio_subj_easing_factors: data.physio_subj_easing_factors || "",
    physio_subj_pain_descriptors: data.physio_subj_pain_descriptors || "",
    physio_subj_current_pain: data.physio_subj_current_pain ?? "",
    physio_subj_worst_pain_last_week: data.physio_subj_worst_pain_last_week ?? "",
    physio_subj_best_pain_last_week: data.physio_subj_best_pain_last_week ?? "",
    physio_subj_previous_episodes: data.physio_subj_previous_episodes || "",
    physio_subj_investigations_to_date: data.physio_subj_investigations_to_date || "",
    physio_subj_current_medications: data.physio_subj_current_medications || "",
    physio_subj_other_health_professionals: data.physio_subj_other_health_professionals || "",
    physio_subj_patient_goals: data.physio_subj_patient_goals || "",
    physio_subj_occupation_and_functional_demands: data.physio_subj_occupation_and_functional_demands || "",
    physio_subj_social_home_situation: data.physio_subj_social_home_situation || "",
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-teal-800">
            <ClipboardList className="w-5 h-5" />
            Subjective Examination
          </CardTitle>
          <p className="text-sm text-teal-600">
            Record the client's own account of the presenting problem, following the Australian Physiotherapy
            Association's clinical notes guidelines.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Presenting complaint and history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="physio_subj_presenting_complaint" className="text-sm font-medium text-slate-700">
              Presenting complaint
            </Label>
            <Textarea
              id="physio_subj_presenting_complaint"
              value={formData.physio_subj_presenting_complaint}
              onChange={(e) => handleChange("physio_subj_presenting_complaint", e.target.value)}
              placeholder="What is the client presenting with, in their own words?"
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="physio_subj_body_chart_area" className="text-sm font-medium text-slate-700">
              Body chart / area affected
            </Label>
            <Textarea
              id="physio_subj_body_chart_area"
              value={formData.physio_subj_body_chart_area}
              onChange={(e) => handleChange("physio_subj_body_chart_area", e.target.value)}
              placeholder="Describe the location, distribution, and radiation of symptoms"
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="physio_subj_mechanism_of_onset" className="text-sm font-medium text-slate-700">
                Mechanism of onset
              </Label>
              <Textarea
                id="physio_subj_mechanism_of_onset"
                value={formData.physio_subj_mechanism_of_onset}
                onChange={(e) => handleChange("physio_subj_mechanism_of_onset", e.target.value)}
                placeholder="How and when did the problem begin?"
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="physio_subj_duration" className="text-sm font-medium text-slate-700">
                Duration
              </Label>
              <Textarea
                id="physio_subj_duration"
                value={formData.physio_subj_duration}
                onChange={(e) => handleChange("physio_subj_duration", e.target.value)}
                placeholder="e.g., 3 weeks, 6 months, ongoing since 2019"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Symptom behaviour</CardTitle>
          <p className="text-sm text-slate-600">24-hour pattern and modifying factors</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="physio_subj_pattern_morning" className="text-sm font-medium text-slate-700">
                Morning
              </Label>
              <Textarea
                id="physio_subj_pattern_morning"
                value={formData.physio_subj_pattern_morning}
                onChange={(e) => handleChange("physio_subj_pattern_morning", e.target.value)}
                placeholder="Symptoms on waking, morning stiffness..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="physio_subj_pattern_evening" className="text-sm font-medium text-slate-700">
                Evening
              </Label>
              <Textarea
                id="physio_subj_pattern_evening"
                value={formData.physio_subj_pattern_evening}
                onChange={(e) => handleChange("physio_subj_pattern_evening", e.target.value)}
                placeholder="How symptoms build or ease across the day..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="physio_subj_pattern_night" className="text-sm font-medium text-slate-700">
                Night
              </Label>
              <Textarea
                id="physio_subj_pattern_night"
                value={formData.physio_subj_pattern_night}
                onChange={(e) => handleChange("physio_subj_pattern_night", e.target.value)}
                placeholder="Sleep disturbance, night pain..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="physio_subj_aggravating_factors" className="text-sm font-medium text-slate-700">
                Aggravating factors
              </Label>
              <Textarea
                id="physio_subj_aggravating_factors"
                value={formData.physio_subj_aggravating_factors}
                onChange={(e) => handleChange("physio_subj_aggravating_factors", e.target.value)}
                placeholder="What makes the symptoms worse?"
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="physio_subj_easing_factors" className="text-sm font-medium text-slate-700">
                Easing factors
              </Label>
              <Textarea
                id="physio_subj_easing_factors"
                value={formData.physio_subj_easing_factors}
                onChange={(e) => handleChange("physio_subj_easing_factors", e.target.value)}
                placeholder="What relieves the symptoms?"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="physio_subj_pain_descriptors" className="text-sm font-medium text-slate-700">
              Pain descriptors
            </Label>
            <Textarea
              id="physio_subj_pain_descriptors"
              value={formData.physio_subj_pain_descriptors}
              onChange={(e) => handleChange("physio_subj_pain_descriptors", e.target.value)}
              placeholder="e.g., sharp, dull, burning, aching, throbbing, shooting"
              className="mt-1"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Pain rating</CardTitle>
          <p className="text-sm text-slate-600">0 (no pain) to 10 (worst pain imaginable)</p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <PainRatingField
              id="physio_subj_current_pain"
              label="Current pain"
              value={formData.physio_subj_current_pain}
              onChange={(v) => handleChange("physio_subj_current_pain", v)}
            />
            <PainRatingField
              id="physio_subj_worst_pain_last_week"
              label="Worst pain in the last week"
              value={formData.physio_subj_worst_pain_last_week}
              onChange={(v) => handleChange("physio_subj_worst_pain_last_week", v)}
            />
            <PainRatingField
              id="physio_subj_best_pain_last_week"
              label="Best pain in the last week"
              value={formData.physio_subj_best_pain_last_week}
              onChange={(v) => handleChange("physio_subj_best_pain_last_week", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Relevant history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="physio_subj_previous_episodes" className="text-sm font-medium text-slate-700">
              Previous episodes
            </Label>
            <Textarea
              id="physio_subj_previous_episodes"
              value={formData.physio_subj_previous_episodes}
              onChange={(e) => handleChange("physio_subj_previous_episodes", e.target.value)}
              placeholder="Prior episodes of this or a related problem, and how they resolved"
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="physio_subj_investigations_to_date" className="text-sm font-medium text-slate-700">
              Investigations to date
            </Label>
            <Textarea
              id="physio_subj_investigations_to_date"
              value={formData.physio_subj_investigations_to_date}
              onChange={(e) => handleChange("physio_subj_investigations_to_date", e.target.value)}
              placeholder="Imaging, blood tests, or other investigations already undertaken"
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="physio_subj_current_medications" className="text-sm font-medium text-slate-700">
              Current medications
            </Label>
            <p className="text-xs text-slate-500 mt-1 mb-2">
              Physiotherapists do not prescribe medications. Record client-reported medications for reference only.
            </p>
            <Textarea
              id="physio_subj_current_medications"
              value={formData.physio_subj_current_medications}
              onChange={(e) => handleChange("physio_subj_current_medications", e.target.value)}
              placeholder="Medications the client reports currently taking"
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="physio_subj_other_health_professionals" className="text-sm font-medium text-slate-700">
              Other health professionals involved
            </Label>
            <Textarea
              id="physio_subj_other_health_professionals"
              value={formData.physio_subj_other_health_professionals}
              onChange={(e) => handleChange("physio_subj_other_health_professionals", e.target.value)}
              placeholder="GP, specialists, other allied health providers currently involved in the client's care"
              className="mt-1"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Function and context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="physio_subj_patient_goals" className="text-sm font-medium text-slate-700">
              Patient's own goals
            </Label>
            <Textarea
              id="physio_subj_patient_goals"
              value={formData.physio_subj_patient_goals}
              onChange={(e) => handleChange("physio_subj_patient_goals", e.target.value)}
              placeholder="What does the client want to achieve, in their own words?"
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="physio_subj_occupation_and_functional_demands" className="text-sm font-medium text-slate-700">
              Occupation and functional demands
            </Label>
            <Textarea
              id="physio_subj_occupation_and_functional_demands"
              value={formData.physio_subj_occupation_and_functional_demands}
              onChange={(e) => handleChange("physio_subj_occupation_and_functional_demands", e.target.value)}
              placeholder="Occupation and the physical demands it places on the client"
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="physio_subj_social_home_situation" className="text-sm font-medium text-slate-700">
              Social and home situation
            </Label>
            <Textarea
              id="physio_subj_social_home_situation"
              value={formData.physio_subj_social_home_situation}
              onChange={(e) => handleChange("physio_subj_social_home_situation", e.target.value)}
              placeholder="Living situation, supports available, home environment factors relevant to care"
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-6">
        <div className="flex gap-2">
          {canGoBack && (
            <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {onSaveAndFinishLater && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onSaveAndFinishLater(formData)}
              className="text-slate-600"
              disabled={isSubmitting}
            >
              Save & Finish Later
            </Button>
          )}
        </div>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}
