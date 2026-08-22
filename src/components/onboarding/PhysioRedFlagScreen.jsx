import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react";

// International Framework for Red Flags for Potential Serious Spinal
// Pathologies (Finucane et al., Journal of Orthopaedic & Sports Physical
// Therapy, 2020). Questions are grouped by the underlying serious pathology
// the framework organises around (rather than presented as one flat list),
// because a positive response only carries clinical meaning in relation to
// the pathology it is a feature of — a cluster within a group is what drives
// escalation, not any single isolated response. A cervical arterial
// dysfunction screen is appended, consistent with current musculoskeletal
// practice guidance for any presentation involving the cervical spine.
const RED_FLAG_GROUPS = [
  {
    prefix: "cauda",
    heading: "Cauda equina syndrome",
    intro:
      "Cauda equina syndrome is a surgical emergency. A positive or uncertain response to any question below requires immediate escalation for urgent medical assessment, ordinarily via emergency department referral.",
    items: [
      {
        key: "bladder_dysfunction",
        label:
          "Has the client noticed altered bladder function (for example, retention, incontinence, or loss of sensation of bladder filling)?",
      },
      {
        key: "bowel_dysfunction",
        label:
          "Has the client noticed altered bowel function (for example, incontinence or loss of anal sphincter tone)?",
      },
      {
        key: "saddle_anaesthesia",
        label: "Does the client report saddle anaesthesia or altered perineal sensation?",
      },
      {
        key: "bilateral_leg_symptoms",
        label: "Does the client report bilateral leg pain, weakness, or sensory disturbance?",
      },
      {
        key: "sexual_sensation",
        label: "Has the client noticed loss of sexual sensation or altered sexual function?",
      },
    ],
  },
  {
    prefix: "fracture",
    heading: "Fracture",
    intro:
      "Vertebral fracture risk rises with trauma, bone fragility, and age; the significance of any single feature depends on the others present.",
    items: [
      {
        key: "significant_trauma",
        label:
          "Has there been a history of significant trauma (for example, a fall from height or a motor vehicle accident), assessed relative to the client's age and bone health?",
      },
      {
        key: "osteoporosis_or_steroid_use",
        label: "Does the client have a history of osteoporosis or prolonged corticosteroid use?",
      },
      {
        key: "age_over_70",
        label: "Is the client aged over 70 years?",
      },
      {
        key: "sudden_severe_pain",
        label: "Was there a sudden onset of severe, unremitting pain?",
      },
    ],
  },
  {
    prefix: "malignancy",
    heading: "Malignancy",
    intro:
      "Malignancy is an uncommon cause of spinal pain, but the consequence of missing it is serious enough that these features must always be actively screened for.",
    items: [
      {
        key: "history_of_cancer",
        label: "Does the client have a past history of malignancy?",
      },
      {
        key: "unexplained_weight_loss",
        label: "Has the client experienced unexplained weight loss?",
      },
      {
        key: "unremitting_night_pain",
        label:
          "Is the pain unremitting, particularly at night, and not relieved by rest or a change of position?",
      },
      {
        key: "new_onset_over_50",
        label: "Is this a new onset of spinal pain in a client aged over 50 years?",
      },
    ],
  },
  {
    prefix: "infection",
    heading: "Infection",
    intro:
      "Spinal infection can progress rapidly. Where suspected, prompt medical referral is required rather than a period of conservative monitoring.",
    items: [
      {
        key: "fever_or_systemic_illness",
        label: "Does the client report fever, chills, or other signs of systemic illness?",
      },
      {
        key: "recent_surgery_or_procedure",
        label: "Has the client had recent spinal surgery, an epidural, or another invasive procedure?",
      },
      {
        key: "immunosuppression",
        label:
          "Is the client immunosuppressed (for example, diabetes, long-term corticosteroid use, HIV, organ transplant, or active cancer treatment)?",
      },
      {
        key: "intravenous_drug_use",
        label: "Does the client have a history of intravenous drug use?",
      },
    ],
  },
  {
    prefix: "inflammatory",
    heading: "Inflammatory arthropathy",
    intro:
      "Inflammatory arthropathy is suggested by a pattern of features rather than by any single feature in isolation.",
    items: [
      {
        key: "insidious_onset_under_45",
        label: "Was there an insidious onset of symptoms before age 45?",
      },
      {
        key: "morning_stiffness_over_30min",
        label: "Does the client report morning stiffness lasting more than 30 minutes?",
      },
      {
        key: "improves_with_exercise",
        label: "Do symptoms improve with exercise and fail to settle with rest?",
      },
      {
        key: "night_pain_second_half",
        label: "Does pain wake the client during the second half of the night?",
      },
    ],
  },
  {
    prefix: "cad",
    heading: "Cervical arterial dysfunction",
    intro:
      "These features may indicate compromise of the vertebrobasilar or carotid circulation. A positive or uncertain response warrants caution before proceeding with cervical assessment or treatment techniques, particularly end-range cervical movement or manipulation.",
    items: [
      { key: "dizziness", label: "Does the client report dizziness?" },
      { key: "diplopia", label: "Does the client report diplopia (double vision)?" },
      { key: "dysarthria", label: "Does the client report dysarthria (slurred speech)?" },
      { key: "dysphagia", label: "Does the client report dysphagia (difficulty swallowing)?" },
      { key: "drop_attacks", label: "Has the client experienced drop attacks (sudden unexplained falls)?" },
      { key: "nausea", label: "Does the client report nausea associated with neck movement or position?" },
      { key: "nystagmus", label: "Has nystagmus (involuntary eye movement) been observed or reported?" },
      {
        key: "sudden_onset_headache",
        label: "Has the client experienced a headache of sudden onset, unlike any headache previously experienced?",
      },
    ],
  },
];

const fieldKey = (prefix, itemKey) => `physio_screen_${prefix}_${itemKey}`;

// A single red flag question: yes/no/unsure, with a details field that
// appears for "yes" and "unsure" alike, since an uncertain response still
// needs to be documented for the reasoning recorded at the end of the form.
/**
 * @param {{
 *   id: string,
 *   label: string,
 *   value: string,
 *   onChange: (value: string) => void,
 *   detailsValue: string,
 *   onDetailsChange: (value: string) => void,
 *   error?: string,
 *   detailsError?: string,
 * }} props
 */
function RedFlagQuestion({ id, label, value, onChange, detailsValue, onDetailsChange, error, detailsError }) {
  const showDetails = value === "yes" || value === "unsure";
  return (
    <div className="border-b border-slate-200 pb-4 last:border-b-0 last:pb-0">
      <Label className="text-sm leading-relaxed block mb-3 font-medium">{label}</Label>
      <RadioGroup value={value} onValueChange={onChange} aria-invalid={Boolean(error)}>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id={`${id}_yes`} />
            <Label htmlFor={`${id}_yes`} className="cursor-pointer font-normal">Yes</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id={`${id}_no`} />
            <Label htmlFor={`${id}_no`} className="cursor-pointer font-normal">No</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="unsure" id={`${id}_unsure`} />
            <Label htmlFor={`${id}_unsure`} className="cursor-pointer font-normal">Unsure</Label>
          </div>
        </div>
      </RadioGroup>
      {error && <p className="text-red-600 text-sm mt-2" role="alert">{error}</p>}
      {showDetails && (
        <div className="mt-3 pl-4 border-l-2 border-orange-200">
          <Label htmlFor={`${id}_details`} className="text-sm text-slate-600">Please provide details</Label>
          <Textarea
            id={`${id}_details`}
            value={detailsValue}
            onChange={(e) => onDetailsChange(e.target.value)}
            placeholder="Describe the finding..."
            rows={2}
            className={`mt-1 ${detailsError ? "border-red-500" : ""}`}
            aria-invalid={Boolean(detailsError)}
          />
          {detailsError && <p className="text-red-600 text-sm mt-1" role="alert">{detailsError}</p>}
        </div>
      )}
    </div>
  );
}

export default function PhysioRedFlagScreen({ data, onNext, onBack, onSaveAndFinishLater, canGoBack, isSubmitting }) {
  /** @returns {Record<string, string>} */
  const buildInitialState = () => {
    /** @type {Record<string, string>} */
    const state = {};
    RED_FLAG_GROUPS.forEach((group) => {
      group.items.forEach((item) => {
        const key = fieldKey(group.prefix, item.key);
        state[key] = data[key] || "";
        state[`${key}_details`] = data[`${key}_details`] || "";
      });
    });
    state.physio_screen_clinical_reasoning = data.physio_screen_clinical_reasoning || "";
    state.physio_screen_outcome = data.physio_screen_outcome || "";
    state.physio_screen_escalation_disposition = data.physio_screen_escalation_disposition || "";
    state.physio_screen_escalation_recipient = data.physio_screen_escalation_recipient || "";
    state.physio_screen_escalation_time = data.physio_screen_escalation_time || "";
    state.physio_screen_activity_restriction = data.physio_screen_activity_restriction || "";

    // Never hydrate a contradictory legacy/draft record as "clear". The user
    // must resolve the positive finding before the screen can be completed.
    const hasFinding = RED_FLAG_GROUPS.some((group) =>
      group.items.some((item) => ["yes", "unsure"].includes(state[fieldKey(group.prefix, item.key)]))
    );
    if (hasFinding && state.physio_screen_outcome === "no_red_flags") {
      state.physio_screen_outcome = "";
    }
    if (!hasFinding) {
      state.physio_screen_escalation_disposition = "";
      state.physio_screen_escalation_recipient = "";
      state.physio_screen_escalation_time = "";
      state.physio_screen_activity_restriction = "";
    }
    return state;
  };

  /** @type {[Record<string, string>, React.Dispatch<React.SetStateAction<Record<string, string>>>]} */
  const [formData, setFormData] = useState(buildInitialState);
  /** @type {[Record<string, string>, React.Dispatch<React.SetStateAction<Record<string, string>>>]} */
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleResponseChange = (field, value) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        [field]: value,
        [`${field}_details`]: value === "no" ? "" : prev[`${field}_details`],
        // A new positive/uncertain finding invalidates a previously clear screen.
        physio_screen_outcome:
        (value === "yes" || value === "unsure") && prev.physio_screen_outcome === "no_red_flags"
          ? ""
          : prev.physio_screen_outcome,
      };
      const stillHasFinding = RED_FLAG_GROUPS.some((group) =>
        group.items.some((item) => ["yes", "unsure"].includes(next[fieldKey(group.prefix, item.key)]))
      );
      if (!stillHasFinding) {
        next.physio_screen_escalation_disposition = "";
        next.physio_screen_escalation_recipient = "";
        next.physio_screen_escalation_time = "";
        next.physio_screen_activity_restriction = "";
      }
      return next;
    });
    setErrors((prev) => ({
      ...prev,
      [field]: "",
      [`${field}_details`]: value === "no" ? "" : prev[`${field}_details`],
      physio_screen_outcome:
        (value === "yes" || value === "unsure") && prev.physio_screen_outcome === "no_red_flags"
          ? "A positive or uncertain finding cannot be recorded as a clear screen."
          : prev.physio_screen_outcome,
    }));
  };

  // The framework does not itself grade severity across categories at
  // screening stage — a "yes" or "unsure" anywhere is a positive finding
  // that the alert below surfaces, leaving the weighting of it to the
  // practitioner's own clinical reasoning, captured separately below.
  const hasPositiveResponse = RED_FLAG_GROUPS.some((group) =>
    group.items.some((item) => {
      const value = formData[fieldKey(group.prefix, item.key)];
      return value === "yes" || value === "unsure";
    })
  );

  const buildStructuredPayload = (completionStatus) => {
    const responses = RED_FLAG_GROUPS.flatMap((group) =>
      group.items.map((item) => {
        const key = fieldKey(group.prefix, item.key);
        return {
          group: group.prefix,
          group_label: group.heading,
          question: item.key,
          response: formData[key] || null,
          details: formData[`${key}_details`]?.trim() || null,
          requires_escalation: formData[key] === "yes" || formData[key] === "unsure",
        };
      })
    );
    const findings = responses.filter((response) => response.requires_escalation);
    return {
      ...formData,
      // Kept alongside the flat compatibility fields so downstream reports
      // have one coherent, versioned record to consume.
      physio_screen_summary: {
        schema_version: 1,
        completion_status: completionStatus,
        recorded_at: new Date().toISOString(),
        responses,
        finding_count: findings.length,
        finding_keys: findings.map((finding) => `${finding.group}.${finding.question}`),
        outcome: formData.physio_screen_outcome || null,
        clinical_reasoning: formData.physio_screen_clinical_reasoning.trim() || null,
        escalation: findings.length > 0
          ? {
              disposition: formData.physio_screen_escalation_disposition || null,
              recipient: formData.physio_screen_escalation_recipient.trim() || null,
              action_time: formData.physio_screen_escalation_time || null,
              activity_restriction: formData.physio_screen_activity_restriction.trim() || null,
            }
          : null,
      },
    };
  };

  /** @returns {Record<string, string>} */
  const validateForCompletion = () => {
    /** @type {Record<string, string>} */
    const newErrors = {};
    RED_FLAG_GROUPS.forEach((group) => {
      group.items.forEach((item) => {
        const key = fieldKey(group.prefix, item.key);
        const value = formData[key];
        if (!value) newErrors[key] = "Select Yes, No, or Unsure.";
        if ((value === "yes" || value === "unsure") && !formData[`${key}_details`].trim()) {
          newErrors[`${key}_details`] = "Document the positive or uncertain finding.";
        }
      });
    });
    if (!formData.physio_screen_outcome) {
      newErrors.physio_screen_outcome = "Please record the screen outcome.";
    } else if (hasPositiveResponse && formData.physio_screen_outcome === "no_red_flags") {
      newErrors.physio_screen_outcome = "A positive or uncertain finding cannot be recorded as a clear screen.";
    }
    if (!formData.physio_screen_clinical_reasoning.trim()) {
      newErrors.physio_screen_clinical_reasoning = "Clinical reasoning and action taken must be recorded.";
    }
    if (hasPositiveResponse) {
      if (!formData.physio_screen_escalation_disposition) {
        newErrors.physio_screen_escalation_disposition = "Select the escalation disposition.";
      }
      if (!formData.physio_screen_escalation_recipient.trim()) {
        newErrors.physio_screen_escalation_recipient = "Record who received or will receive the escalation.";
      }
      if (!formData.physio_screen_escalation_time) {
        newErrors.physio_screen_escalation_time = "Record the escalation or planned action time.";
      }
      if (!formData.physio_screen_activity_restriction.trim()) {
        newErrors.physio_screen_activity_restriction = "Record the activity or treatment restriction pending review.";
      }
    }
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForCompletion();
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) onNext(buildStructuredPayload("complete"));
  };

  const handleSaveDraft = () => {
    // Drafts may be incomplete, but must not persist the clinically
    // contradictory combination of a finding and a clear outcome.
    if (hasPositiveResponse && formData.physio_screen_outcome === "no_red_flags") {
      setErrors((prev) => ({
        ...prev,
        physio_screen_outcome: "A positive or uncertain finding cannot be saved as a clear screen.",
      }));
      return;
    }
    onSaveAndFinishLater(buildStructuredPayload("draft"));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Always visible regardless of any response given — this is a standing
          safety notice, not conditional feedback. */}
      <Card className="border-2 border-amber-300 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
            <div className="text-sm text-amber-800 space-y-2">
              <p className="font-semibold text-amber-900">Red flag screen — clinical reasoning required</p>
              <p>
                A positive ("Yes") or uncertain ("Unsure") response to any question below requires the treating
                practitioner to consider urgent referral for medical assessment. This screen is a prompt, not a
                substitute for clinical reasoning: the practitioner's own judgement governs the response to any
                finding.
              </p>
              <p>
                Both the outcome of this screen and the reasoning behind it must be recorded below before this
                section can be completed.
              </p>
              {hasPositiveResponse && (
                <p className="font-semibold text-red-700">
                  One or more positive or uncertain responses have been recorded above. Confirm the outcome and the
                  action taken in the fields below.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {RED_FLAG_GROUPS.map((group) => (
        <Card key={group.prefix}>
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">{group.heading}</CardTitle>
            <p className="text-sm text-slate-600">{group.intro}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.items.map((item) => {
              const key = fieldKey(group.prefix, item.key);
              return (
                <RedFlagQuestion
                  key={key}
                  id={key}
                  label={item.label}
                  value={formData[key]}
                  onChange={(value) => handleResponseChange(key, value)}
                  detailsValue={formData[`${key}_details`]}
                  onDetailsChange={(value) => handleChange(`${key}_details`, value)}
                  error={errors[key]}
                  detailsError={errors[`${key}_details`]}
                />
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card className="border-2 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Screen outcome</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-slate-700 block mb-2">Outcome *</Label>
            <RadioGroup
              value={formData.physio_screen_outcome}
              onValueChange={(value) => handleChange("physio_screen_outcome", value)}
            >
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="no_red_flags"
                    id="physio_screen_outcome_none"
                    disabled={hasPositiveResponse}
                  />
                  <Label
                    htmlFor="physio_screen_outcome_none"
                    className={`font-normal ${hasPositiveResponse ? "cursor-not-allowed text-slate-400" : "cursor-pointer"}`}
                  >
                    No red flags identified
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="red_flags_present_managed" id="physio_screen_outcome_managed" />
                  <Label htmlFor="physio_screen_outcome_managed" className="cursor-pointer font-normal">
                    Red flags present — managed within scope of physiotherapy practice
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="red_flags_present_referred" id="physio_screen_outcome_referred" />
                  <Label htmlFor="physio_screen_outcome_referred" className="cursor-pointer font-normal">
                    Red flags present — referred for urgent medical assessment
                  </Label>
                </div>
              </div>
            </RadioGroup>
            {errors.physio_screen_outcome && (
              <p className="text-red-600 text-sm mt-1" role="alert">{errors.physio_screen_outcome}</p>
            )}
          </div>

          {hasPositiveResponse && (
            <div className="rounded-md border-2 border-red-200 bg-red-50 p-4 space-y-4">
              <div>
                <p className="font-semibold text-red-900">Escalation record required</p>
                <p className="text-sm text-red-800 mt-1">
                  Complete every field below. Do not continue with unrestricted assessment or treatment while a
                  potentially serious finding remains unresolved.
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700 block mb-2">Disposition *</Label>
                <RadioGroup
                  value={formData.physio_screen_escalation_disposition}
                  onValueChange={(value) => handleChange("physio_screen_escalation_disposition", value)}
                  aria-invalid={Boolean(errors.physio_screen_escalation_disposition)}
                >
                  <div className="space-y-2">
                    {[
                      ["emergency_services", "Emergency services / emergency department"],
                      ["urgent_same_day", "Urgent same-day medical assessment"],
                      ["expedited_medical_review", "Expedited medical review arranged"],
                    ].map(([value, label]) => (
                      <div className="flex items-center space-x-2" key={value}>
                        <RadioGroupItem value={value} id={`physio_screen_disposition_${value}`} />
                        <Label htmlFor={`physio_screen_disposition_${value}`} className="cursor-pointer font-normal">
                          {label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
                {errors.physio_screen_escalation_disposition && (
                  <p className="text-red-600 text-sm mt-1" role="alert">
                    {errors.physio_screen_escalation_disposition}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="physio_screen_escalation_recipient">Escalation recipient *</Label>
                <Input
                  id="physio_screen_escalation_recipient"
                  value={formData.physio_screen_escalation_recipient}
                  onChange={(e) => handleChange("physio_screen_escalation_recipient", e.target.value)}
                  placeholder="Role/service and name if known"
                  className={`mt-1 ${errors.physio_screen_escalation_recipient ? "border-red-500" : ""}`}
                  aria-invalid={Boolean(errors.physio_screen_escalation_recipient)}
                />
                {errors.physio_screen_escalation_recipient && (
                  <p className="text-red-600 text-sm mt-1" role="alert">
                    {errors.physio_screen_escalation_recipient}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="physio_screen_escalation_time">Escalation or planned action time *</Label>
                <Input
                  id="physio_screen_escalation_time"
                  type="datetime-local"
                  value={formData.physio_screen_escalation_time}
                  onChange={(e) => handleChange("physio_screen_escalation_time", e.target.value)}
                  className={`mt-1 ${errors.physio_screen_escalation_time ? "border-red-500" : ""}`}
                  aria-invalid={Boolean(errors.physio_screen_escalation_time)}
                />
                {errors.physio_screen_escalation_time && (
                  <p className="text-red-600 text-sm mt-1" role="alert">
                    {errors.physio_screen_escalation_time}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="physio_screen_activity_restriction">Activity / treatment restriction *</Label>
                <Textarea
                  id="physio_screen_activity_restriction"
                  value={formData.physio_screen_activity_restriction}
                  onChange={(e) => handleChange("physio_screen_activity_restriction", e.target.value)}
                  placeholder="State what is withheld or restricted pending medical assessment"
                  rows={2}
                  className={`mt-1 ${errors.physio_screen_activity_restriction ? "border-red-500" : ""}`}
                  aria-invalid={Boolean(errors.physio_screen_activity_restriction)}
                />
                {errors.physio_screen_activity_restriction && (
                  <p className="text-red-600 text-sm mt-1" role="alert">
                    {errors.physio_screen_activity_restriction}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="physio_screen_clinical_reasoning" className="text-sm font-medium text-slate-700">
              Clinical reasoning and action taken *
            </Label>
            <p className="text-xs text-slate-500 mt-1 mb-2">
              Record the reasoning behind the outcome selected above, including any action taken or referral made.
            </p>
            <Textarea
              id="physio_screen_clinical_reasoning"
              value={formData.physio_screen_clinical_reasoning}
              onChange={(e) => handleChange("physio_screen_clinical_reasoning", e.target.value)}
              placeholder="Document the findings, clinical interpretation, consultation, escalation steps, and safety-net instructions."
              rows={4}
              className={errors.physio_screen_clinical_reasoning ? "border-red-500" : ""}
            />
            {errors.physio_screen_clinical_reasoning && (
              <p className="text-red-500 text-sm mt-1">{errors.physio_screen_clinical_reasoning}</p>
            )}
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
              onClick={handleSaveDraft}
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
