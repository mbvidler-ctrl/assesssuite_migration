import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Save, Printer, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import SelectDateRange from "./wizard-steps/SelectDateRange";
import SelectAssessments from "./wizard-steps/SelectAssessments";
import SectionEditor from "./wizard-steps/SectionEditor";
import ReviewExport from "./wizard-steps/ReviewExport";

// --- Meta-template definitions (controls length & AI tone) ---
export const META_TEMPLATES = {
  short_referral_letter: {
    key: "short_referral_letter",
    label: "Short Referral Letter",
    recommended_length_pages: 1,
    description: "Brief update to referrers â€” inform that treatment has started, succinct summary of interventions and next steps.",
    ai_instruction: "Write concisely for a 1-page referral letter. Each section should be 2â€“4 sentences maximum. Use clear, direct clinical language appropriate for a GP or referrer. Do NOT pad with unnecessary background â€” focus only on what is clinically relevant and actionable.",
  },
  comprehensive_progress_report: {
    key: "comprehensive_progress_report",
    label: "Comprehensive Progress Report",
    recommended_length_pages: 2,
    description: "Plan reviews, progress reports for insurers or funders. Includes baseline and current measures, goal progress, and specific recommendations.",
    ai_instruction: "Write a thorough but focused 2-page report. Each section should be 1â€“3 short paragraphs. Include baseline vs current outcome measures, goal progress with specific data, and clear clinical reasoning. Be specific and evidence-based â€” avoid vague generalities.",
  },
  functional_capacity_evaluation: {
    key: "functional_capacity_evaluation",
    label: "Functional Capacity Evaluation",
    recommended_length_pages: 2,
    description: "Detailed FCE/FCA â€” physical and functional abilities, work capacity, and return-to-work recommendations.",
    ai_instruction: "Write a detailed, structured functional capacity evaluation. Be specific about measured tolerances (e.g. lifting capacity in kg, standing tolerance in minutes). Reference actual test results with values. Use objective, medicolegal-quality language. Organise findings clearly. Avoid vague qualitative statements without supporting data.",
  },
};

// --- Map each report type key to its meta-template ---
export const REPORT_META_TEMPLATE_MAP = {
  // Australia General
  gp_summary: "short_referral_letter",
  custom_report: "comprehensive_progress_report",
  progress_note: "comprehensive_progress_report",
  // WorkCover
  workcover_pmp: "comprehensive_progress_report",
  workcover_progress: "comprehensive_progress_report",
  workcover_discharge: "short_referral_letter",
  // NSW SIRA
  sira_initial: "comprehensive_progress_report",
  sira_ahtr: "comprehensive_progress_report",
  sira_progress: "comprehensive_progress_report",
  sira_discharge: "short_referral_letter",
  // WorkSafe VIC
  worksafe_vic_initial: "comprehensive_progress_report",
  worksafe_vic_progress: "comprehensive_progress_report",
  worksafe_vic_discharge: "short_referral_letter",
  // RTWSA
  rtwsa_initial: "comprehensive_progress_report",
  rtwsa_progress: "comprehensive_progress_report",
  rtwsa_discharge: "short_referral_letter",
  // WorkCover WA
  wa_workcover_initial: "comprehensive_progress_report",
  wa_workcover_progress: "comprehensive_progress_report",
  wa_workcover_discharge: "short_referral_letter",
  // DVA
  dva_patient_care_plan: "comprehensive_progress_report",
  dva_end_cycle_report: "comprehensive_progress_report",
  // Medicare
  medicare_referral_acceptance: "short_referral_letter",
  medicare_initial: "comprehensive_progress_report",
  medicare_final: "comprehensive_progress_report",
  // NDIS
  ndis_initial: "comprehensive_progress_report",
  ndis_progress: "comprehensive_progress_report",
  ndis_fce: "functional_capacity_evaluation",
  ndis_discharge: "short_referral_letter",
  // Private health
  private_health_initial: "comprehensive_progress_report",
  private_health_progress: "comprehensive_progress_report",
  // Aged care
  aged_care_assessment: "comprehensive_progress_report",
  hcp_initial: "comprehensive_progress_report",
  hcp_care_plan: "comprehensive_progress_report",
  hcp_annual_review: "comprehensive_progress_report",
  chsp_initial: "comprehensive_progress_report",
  chsp_support_plan: "comprehensive_progress_report",
  // TAC/MAIC
  tac_functional: "functional_capacity_evaluation",
  tac_progress: "comprehensive_progress_report",
  tac_discharge: "short_referral_letter",
  maic_initial: "comprehensive_progress_report",
  maic_progress: "comprehensive_progress_report",
  maic_discharge: "short_referral_letter",
  // CTP
  ctp_initial: "comprehensive_progress_report",
  ctp_progress: "comprehensive_progress_report",
  ctp_discharge: "short_referral_letter",
  // Legal
  legal_fce: "functional_capacity_evaluation",
  legal_medico: "functional_capacity_evaluation",
  // Cancer
  cancer_initial: "comprehensive_progress_report",
  cancer_progress: "comprehensive_progress_report",
  // Cardiac
  cardiac_phase1: "comprehensive_progress_report",
  cardiac_phase2: "comprehensive_progress_report",
  cardiac_phase3: "short_referral_letter",
  cardiac_phase4: "short_referral_letter",
  // USA
  us_initial_evaluation: "comprehensive_progress_report",
  us_plan_of_care: "comprehensive_progress_report",
  us_progress_report: "comprehensive_progress_report",
  us_discharge_summary: "short_referral_letter",
  us_prior_auth: "comprehensive_progress_report",
  // UK
  uk_nhs_ers_initial: "comprehensive_progress_report",
  uk_nhs_ers_progress: "comprehensive_progress_report",
  uk_nhs_ers_completion: "short_referral_letter",
  uk_cardiac_initial: "comprehensive_progress_report",
  uk_cardiac_completion: "short_referral_letter",
  uk_pulmonary_initial: "comprehensive_progress_report",
  uk_pulmonary_completion: "short_referral_letter",
  uk_cancer_initial: "comprehensive_progress_report",
  uk_cancer_progress: "comprehensive_progress_report",
  uk_cancer_completion: "short_referral_letter",
  uk_pmi_initial: "comprehensive_progress_report",
  uk_pmi_progress: "comprehensive_progress_report",
  uk_pmi_discharge: "short_referral_letter",
  uk_fce: "functional_capacity_evaluation",
  uk_rtw_progress: "comprehensive_progress_report",
  uk_gp_summary: "short_referral_letter",
  // Canada
  ca_wsib_initial: "comprehensive_progress_report",
  ca_wsib_faf: "functional_capacity_evaluation",
  ca_wsib_progress: "comprehensive_progress_report",
  ca_wsib_rtw: "short_referral_letter",
  ca_worksafebc_initial: "comprehensive_progress_report",
  ca_worksafebc_fca: "functional_capacity_evaluation",
  ca_worksafebc_progress: "comprehensive_progress_report",
  ca_wcb_alberta_initial: "comprehensive_progress_report",
  ca_wcb_alberta_fce: "functional_capacity_evaluation",
  ca_wcb_alberta_progress: "comprehensive_progress_report",
  ca_ehb_initial: "comprehensive_progress_report",
  ca_ehb_progress: "comprehensive_progress_report",
  ca_vac_initial: "comprehensive_progress_report",
  ca_vac_progress: "comprehensive_progress_report",
  // New Zealand
  nz_acc_initial: "comprehensive_progress_report",
  nz_acc_progress: "comprehensive_progress_report",
  nz_acc_fce: "functional_capacity_evaluation",
  nz_acc_discharge: "short_referral_letter",
  nz_disability_initial: "comprehensive_progress_report",
  nz_private_initial: "comprehensive_progress_report",
  nz_private_progress: "comprehensive_progress_report",
  // Singapore
  sg_healthiersg_initial: "comprehensive_progress_report",
  sg_healthiersg_progress: "comprehensive_progress_report",
  sg_healthiersg_completion: "short_referral_letter",
  sg_cdmp_initial: "comprehensive_progress_report",
  sg_cdmp_progress: "comprehensive_progress_report",
  sg_cdmp_discharge: "short_referral_letter",
  sg_wica_initial: "functional_capacity_evaluation",
  sg_wica_rtw: "comprehensive_progress_report",
  sg_corporate_initial: "comprehensive_progress_report",
  // Ireland
  ie_hse_initial: "comprehensive_progress_report",
  ie_hse_progress: "comprehensive_progress_report",
  ie_hse_discharge: "short_referral_letter",
  ie_cardiac_initial: "comprehensive_progress_report",
  ie_cardiac_completion: "short_referral_letter",
  ie_piab_fce: "functional_capacity_evaluation",
  ie_private_initial: "comprehensive_progress_report",
  ie_private_progress: "comprehensive_progress_report",
  ie_private_discharge: "short_referral_letter",
  ie_gp_summary: "short_referral_letter",
  // South Africa
  za_medaid_initial: "comprehensive_progress_report",
  za_medaid_progress: "comprehensive_progress_report",
  za_medaid_discharge: "short_referral_letter",
  za_coida_initial: "comprehensive_progress_report",
  za_coida_progress: "comprehensive_progress_report",
  za_coida_rtw: "short_referral_letter",
  za_raf_initial: "comprehensive_progress_report",
  za_raf_progress: "comprehensive_progress_report",
  za_gems_initial: "comprehensive_progress_report",
  za_gems_progress: "comprehensive_progress_report",
};

// --- Prior report relationships ---
const PRIOR_REPORT_DEPS = {
  dva_end_cycle_report: ["dva_patient_care_plan", "dva_end_cycle_report"],
  dva_patient_care_plan: [],
  workcover_progress: ["workcover_pmp", "workcover_progress"],
  medicare_final: ["medicare_referral_acceptance", "medicare_initial"],
  medicare_initial: ["medicare_referral_acceptance"],
  private_health_progress: ["private_health_initial", "private_health_progress"],
  ndis_initial: [],
  ndis_progress: ["ndis_initial"],
  ndis_fce: ["ndis_initial", "ndis_progress"],
  ndis_discharge: ["ndis_initial", "ndis_progress"],
  workcover_discharge: ["workcover_pmp", "workcover_progress"],
  sira_ahtr: ["sira_initial"],
  sira_initial: [],
  sira_progress: ["sira_initial", "sira_ahtr"],
  sira_discharge: ["sira_initial", "sira_progress"],
  worksafe_vic_initial: [],
  worksafe_vic_progress: ["worksafe_vic_initial"],
  worksafe_vic_discharge: ["worksafe_vic_initial", "worksafe_vic_progress"],
  rtwsa_initial: [],
  rtwsa_progress: ["rtwsa_initial"],
  rtwsa_discharge: ["rtwsa_initial", "rtwsa_progress"],
  wa_workcover_initial: [],
  wa_workcover_progress: ["wa_workcover_initial"],
  wa_workcover_discharge: ["wa_workcover_initial", "wa_workcover_progress"],
  tac_functional: [],
  tac_progress: ["tac_functional"],
  tac_discharge: ["tac_functional", "tac_progress"],
  maic_initial: [],
  maic_progress: ["maic_initial"],
  maic_discharge: ["maic_initial", "maic_progress"],
  ctp_initial: [],
  ctp_progress: ["ctp_initial"],
  ctp_discharge: ["ctp_initial", "ctp_progress"],
  hcp_initial: [],
  hcp_care_plan: ["hcp_initial"],
  hcp_annual_review: ["hcp_initial", "hcp_care_plan"],
  chsp_initial: [],
  chsp_support_plan: ["chsp_initial"],
  legal_fce: [],
  legal_medico: ["legal_fce"],
  cancer_initial: [],
  cancer_progress: ["cancer_initial"],
  aged_care_assessment: [],
  gp_summary: ["medicare_initial", "private_health_initial", "dva_patient_care_plan"],
  progress_note: [],
  custom_report: [],
  us_progress_report: ["us_initial_evaluation", "us_plan_of_care"],
  us_discharge_summary: ["us_initial_evaluation", "us_progress_report"],
  us_prior_auth: ["us_initial_evaluation", "us_progress_report"],
};

// Each report has mandatory sections (always included) and optional extras the clinician can add
const REPORT_TEMPLATES = {
  gp_summary: {
    id: "GP_SUMMARY_LETTER", title: "GP Summary Letter", funder: "GP",
    mandatory: [
      "Reason for Referral",
      "Relevant Medical History & Medications",
      "Clinical Assessment Findings",
      "Baseline Outcome Measures & Results",
      "Intervention Provided",
      "Progress & Response to Treatment",
      "Recommendations & Next Steps"
    ],
    optional: ["Additional Notes", "Referral to Other Services", "Attachments", "Provider Signature"]
  },
  custom_report: {
    id: "CUSTOM_REPORT", title: "Custom Report", funder: "CUSTOM",
    mandatory: ["Purpose of Report", "Background", "Assessment Findings & Results", "Plan / Recommendations"],
    optional: ["Additional Notes", "Outcome Measures", "Attachments", "Provider Signature"]
  },
  progress_note: {
    id: "PROGRESS_NOTE", title: "Progress / Extra Report", funder: "GENERAL",
    mandatory: [
      "Reason for Report",
      "Summary of Treatment to Date",
      "Outcome Measures (baseline vs current)",
      "Current Status & Progress",
      "Goals Update",
      "Plan Going Forward"
    ],
    optional: ["Additional Notes", "Barriers / Setbacks", "Attachments", "Provider Signature"]
  },
  workcover_pmp: {
    id: "WORKCOVER_PMP", title: "WorkCover PMP", funder: "WORKCOVER",
    mandatory: [
      "Injury / Mechanism of Injury & Background",
      "Relevant Medical History & Current Medications",
      "Baseline Functional Assessment Results",
      "Current Work Capacity & Restrictions",
      "Physical Capacity & Functional Limitations",
      "Barriers to Recovery / Risk Factors",
      "Short-term & Long-term Goals",
      "Proposed Management Plan (frequency / interventions)",
      "Return to Work (RTW) Plan & Recommendations"
    ],
    optional: ["RTW Timeline", "Workplace Communication Notes", "Equipment Recommendations", "Attachments", "Provider Signature"]
  },
  workcover_progress: {
    id: "WORKCOVER_PROGRESS_REPORT", title: "WorkCover Progress Report", funder: "WORKCOVER",
    mandatory: [
      "Summary of Treatment Provided to Date",
      "Outcome Measures (baseline vs current results)",
      "Functional Test Results",
      "Progress Against Goals",
      "Current Work Capacity & Duties",
      "Barriers / Setbacks",
      "Plan for Next Treatment Period",
      "Updated RTW Recommendations"
    ],
    optional: ["Workplace Communication Notes", "Attachments", "Provider Signature"]
  },
  dva_patient_care_plan: {
    id: "DVA_PATIENT_CARE_PLAN", title: "DVA Patient Care Plan", funder: "DVA",
    mandatory: [
      "Reason for Referral",
      "Accepted Conditions Being Managed",
      "Relevant Medical History & Medications",
      "Baseline Assessment Results & Outcome Measures",
      "Functional Capacity & Current Limitations",
      "Client Goals (short-term & long-term)",
      "Proposed Management Plan (interventions / exercise program)",
      "Frequency & Duration of Sessions",
      "Interpretation & Comments"
    ],
    optional: ["Equipment Recommendations", "Referral to Other Services", "Attachments", "Provider Signature"]
  },
  dva_end_cycle_report: {
    id: "DVA_END_OF_CYCLE_REPORT", title: "DVA End of Cycle Report", funder: "DVA",
    mandatory: [
      "Summary of Intervention Provided",
      "Outcome Measures (baseline vs end of cycle results)",
      "Response to Treatment & Progress Against Goals",
      "Current Functional Status",
      "Barriers / Risks Encountered",
      "Recommendations & Next Steps",
      "Justification for Further Treatment (if applicable)"
    ],
    optional: ["Request for Further Funding", "Attachments", "Provider Signature"]
  },
  medicare_referral_acceptance: {
    id: "MEDICARE_REFERRAL_ACCEPTANCE", title: "Medicare Referral Acceptance", funder: "MEDICARE",
    mandatory: [
      "Referral Received & Accepted",
      "Referring Practitioner Details",
      "Client Details & Chronic Condition(s)",
      "Planned Initial Assessment Date",
      "Planned Service Delivery (frequency / duration)",
      "Notes to Referrer"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  medicare_initial: {
    id: "MEDICARE_INITIAL_ASSESSMENT", title: "Medicare Initial Assessment (GPCCMP)", funder: "MEDICARE",
    mandatory: [
      "Reason for Referral",
      "Relevant Medical History & Current Medications",
      "Chronic Condition(s) Being Managed",
      "Baseline Assessment Findings & Outcome Measures",
      "Client Goals (patient-centred)",
      "Proposed Management Plan (interventions / exercise prescription)",
      "Frequency & Duration of Services",
      "Interpretation & Clinical Comments"
    ],
    optional: ["Equipment Needs", "Referral to Other Services", "Attachments", "Provider Signature"]
  },
  medicare_final: {
    id: "MEDICARE_FINAL_REPORT", title: "Medicare Final Report", funder: "MEDICARE",
    mandatory: [
      "Summary of Intervention Provided",
      "Outcome Measures (baseline vs final results)",
      "Progress Against Goals",
      "Current Clinical Status",
      "Recommendations (ongoing self-management / exercise program)",
      "Discharge / Handover Notes & GP Communication"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  private_health_initial: {
    id: "PRIVATE_HEALTH_INITIAL_ASSESSMENT", title: "Private Health Initial Assessment", funder: "PRIVATE_HEALTH",
    mandatory: [
      "Presenting Complaint & Referral Reason",
      "Relevant Medical History & Medications",
      "Baseline Assessment Findings & Outcome Measures",
      "Client Goals",
      "Proposed Management Plan",
      "Frequency & Duration of Sessions",
      "Interpretation & Comments"
    ],
    optional: ["Equipment Recommendations", "Referral to Other Services", "Attachments", "Provider Signature"]
  },
  private_health_progress: {
    id: "PRIVATE_HEALTH_PROGRESS_REPORT", title: "Private Health Progress Report", funder: "PRIVATE_HEALTH",
    mandatory: [
      "Summary of Treatment to Date",
      "Outcome Measures (baseline vs current results)",
      "Progress Against Goals",
      "Current Functional Capacity",
      "Updated Goals",
      "Plan for Next Treatment Period",
      "Recommendations"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  ndis_initial: {
    id: "NDIS_INITIAL_ASSESSMENT", title: "NDIS Initial Assessment", funder: "NDIS",
    mandatory: [
      "Participant Background (diagnosis / disability / living situation / supports)",
      "Functional Capacity Assessment Results (across 7 NDIS domains)",
      "Impact of Disability on Daily Function & Participation",
      "Risks & Safety Considerations (falls, fatigue, supervision needs)",
      "NDIS Goals (aligned to participant plan)",
      "Evidence of Reasonable & Necessary Support Need",
      "Proposed Supports & Intervention Plan",
      "Progress Measurement Plan (outcome measures / review timeline)",
      "Interpretation & Clinical Comments"
    ],
    optional: ["Equipment / AT Recommendations", "Support Coordination Notes", "Attachments", "Provider Signature"]
  },
  tac_functional: {
    id: "TAC_FUNCTIONAL_ASSESSMENT", title: "TAC Allied Health Treatment & Recovery Plan (AHTRP)", funder: "TAC",
    mandatory: [
      "Accident / Injury Background & Claim Details",
      "Current Symptoms & Subjective Complaints",
      "Objective Assessment Findings & Outcome Measures",
      "Functional Tolerance (sitting / standing / walking / lifting / stairs)",
      "ADL Impact & Assistance Needs",
      "Observed Movement Patterns & Key Limitations",
      "Functional Capacity Summary",
      "Goals (short-term & long-term)",
      "Proposed Treatment Plan (frequency / duration / interventions)",
      "Recommendations (supports / progression / referrals)"
    ],
    optional: ["Return to Activity / Sport Plan", "Attachments", "Provider Signature"]
  },
  ndis_progress: {
    id: "NDIS_PROGRESS_REPORT", title: "NDIS Progress Report", funder: "NDIS",
    mandatory: [
      "Summary of Supports Provided Since Last Report",
      "Outcome Measures (baseline vs current results)",
      "Progress Against NDIS Goals (quote goals directly from plan)",
      "Functional Capacity Changes Across NDIS Domains",
      "Barriers / Setbacks Encountered",
      "Updated Goals & Adjusted Plan",
      "Recommendation for Continued / Modified Supports",
      "Interpretation & Clinical Comments"
    ],
    optional: ["Equipment / AT Recommendations", "Support Coordination Notes", "Attachments", "Provider Signature"]
  },
  ndis_fce: {
    id: "NDIS_FUNCTIONAL_CAPACITY_EVALUATION", title: "NDIS Functional Capacity Evaluation", funder: "NDIS",
    mandatory: [
      "Participant Background (diagnosis / disability / living situation / supports)",
      "Purpose of Assessment",
      "Assessment Tools & Methods Used",
      "Functional Capacity Across 7 NDIS Domains (Mobility, Self-Care, Communication, Social Interaction, Learning, Daily Activities, Community Access)",
      "Objective Assessment Findings & Outcome Measures",
      "Impact of Functional Limitations on Daily Life & Participation",
      "Risks & Safety Considerations",
      "Evidence of Reasonable & Necessary Support Need",
      "Recommendations (type / frequency / duration of supports)",
      "Equipment / Assistive Technology Recommendations",
      "Summary & Clinical Conclusion"
    ],
    optional: ["Support Coordination Notes", "Carer / Family Input", "Attachments", "Provider Signature"]
  },
  ndis_discharge: {
    id: "NDIS_DISCHARGE_SUMMARY", title: "NDIS Discharge / Transition Summary", funder: "NDIS",
    mandatory: [
      "Summary of Supports Provided (duration / frequency / interventions)",
      "Outcome Measures (baseline vs discharge results)",
      "Progress Against NDIS Goals",
      "Current Functional Status & Capacity",
      "Reason for Discharge / Transition",
      "Home Exercise Program / Self-Management Plan",
      "Recommendations for Future Supports",
      "Referrals to Other Services"
    ],
    optional: ["Support Coordination Notes", "Attachments", "Provider Signature"]
  },
  workcover_discharge: {
    id: "WORKCOVER_DISCHARGE_RTW_SUMMARY", title: "WorkCover Discharge / RTW Summary", funder: "WORKCOVER",
    mandatory: [
      "Summary of Treatment Provided",
      "Outcome Measures (baseline vs final results)",
      "Progress Against Goals",
      "Final Work Capacity & Restrictions",
      "RTW Status & Outcome",
      "Ongoing Recommendations & Self-Management Plan",
      "Referrals to Other Services"
    ],
    optional: ["Workplace Communication Notes", "Attachments", "Provider Signature"]
  },
  sira_initial: {
    id: "SIRA_INITIAL_ASSESSMENT", title: "NSW SIRA Initial Assessment", funder: "WORKCOVER_NSW",
    mandatory: [
      "Injury / Mechanism of Injury & Claim Details",
      "Relevant Medical History & Current Medications",
      "Baseline Functional Assessment Results & Outcome Measures",
      "Current Work Capacity & Restrictions",
      "Physical Capacity & Functional Limitations",
      "Barriers to Recovery",
      "Short-term & Long-term Goals",
      "Proposed Management Plan (frequency / interventions)",
      "Return to Work (RTW) Plan & Recommendations"
    ],
    optional: ["RTW Timeline", "Workplace Communication Notes", "Equipment Recommendations", "Attachments", "Provider Signature"]
  },
  sira_ahtr: {
    id: "SIRA_ALLIED_HEALTH_TREATMENT_REQUEST", title: "NSW SIRA â€” Allied Health Treatment Request (AHTR)", funder: "WORKCOVER_NSW",
    mandatory: [
      "Claim / Client Details",
      "Diagnosis & Mechanism of Injury",
      "Objective Findings & Current Functional Status",
      "Treatment Provided to Date",
      "Outcome Measures (baseline vs current)",
      "Goals & Expected Outcomes",
      "Requested Number of Sessions & Frequency",
      "Skilled Need Justification",
      "Expected Duration of Treatment"
    ],
    optional: ["RTW Plan Update", "Barriers to Recovery", "Attachments", "Provider Signature"]
  },
  sira_progress: {
    id: "SIRA_PROGRESS_REPORT", title: "NSW SIRA Progress Report", funder: "WORKCOVER_NSW",
    mandatory: [
      "Summary of Treatment Provided to Date",
      "Outcome Measures (baseline vs current results)",
      "Progress Against Goals",
      "Current Work Capacity & Duties",
      "Barriers / Setbacks",
      "Plan for Next Treatment Period",
      "Updated RTW Recommendations"
    ],
    optional: ["Workplace Communication Notes", "Attachments", "Provider Signature"]
  },
  sira_discharge: {
    id: "SIRA_DISCHARGE_SUMMARY", title: "NSW SIRA Discharge Summary", funder: "WORKCOVER_NSW",
    mandatory: [
      "Summary of Treatment Provided",
      "Outcome Measures (baseline vs final results)",
      "Progress Against Goals",
      "Final Work Capacity & Restrictions",
      "RTW Status & Outcome",
      "Ongoing Recommendations & Self-Management Plan"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  worksafe_vic_initial: {
    id: "WORKSAFE_VIC_INITIAL_ASSESSMENT", title: "WorkSafe VIC Initial Assessment", funder: "WORKCOVER_VIC",
    mandatory: [
      "Injury / Mechanism of Injury & Claim Details",
      "Relevant Medical History & Current Medications",
      "Baseline Functional Assessment & Outcome Measures",
      "Current Work Capacity & Restrictions",
      "Physical Capacity & Functional Limitations",
      "Barriers to Recovery",
      "Short-term & Long-term Goals",
      "Proposed Management Plan",
      "RTW Plan & Recommendations"
    ],
    optional: ["RTW Timeline", "Equipment Recommendations", "Attachments", "Provider Signature"]
  },
  worksafe_vic_progress: {
    id: "WORKSAFE_VIC_PROGRESS_REPORT", title: "WorkSafe VIC Progress Report", funder: "WORKCOVER_VIC",
    mandatory: [
      "Summary of Treatment Provided to Date",
      "Outcome Measures (baseline vs current results)",
      "Progress Against Goals",
      "Current Work Capacity & Duties",
      "Barriers / Setbacks",
      "Plan for Next Treatment Period",
      "Updated RTW Recommendations"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  worksafe_vic_discharge: {
    id: "WORKSAFE_VIC_DISCHARGE_SUMMARY", title: "WorkSafe VIC Discharge Summary", funder: "WORKCOVER_VIC",
    mandatory: [
      "Summary of Treatment Provided",
      "Outcome Measures (baseline vs final results)",
      "Final Work Capacity & Restrictions",
      "RTW Status & Outcome",
      "Ongoing Recommendations & Self-Management Plan"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  rtwsa_initial: {
    id: "RTWSA_INITIAL_ASSESSMENT", title: "ReturnToWorkSA Initial Assessment", funder: "WORKCOVER_SA",
    mandatory: [
      "Injury / Mechanism of Injury & Claim Details",
      "Relevant Medical History & Current Medications",
      "Baseline Functional Assessment & Outcome Measures",
      "Current Work Capacity & Restrictions",
      "Physical Capacity & Functional Limitations",
      "Barriers to Recovery",
      "Short-term & Long-term Goals",
      "Proposed Management Plan",
      "Recovery / RTW Plan"
    ],
    optional: ["RTW Timeline", "Equipment Recommendations", "Attachments", "Provider Signature"]
  },
  rtwsa_progress: {
    id: "RTWSA_PROGRESS_REPORT", title: "ReturnToWorkSA Progress Report", funder: "WORKCOVER_SA",
    mandatory: [
      "Summary of Treatment Provided to Date",
      "Outcome Measures (baseline vs current results)",
      "Progress Against Recovery Goals",
      "Current Work Capacity & Duties",
      "Barriers / Setbacks",
      "Plan for Next Treatment Period",
      "Updated RTW Recommendations"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  rtwsa_discharge: {
    id: "RTWSA_DISCHARGE_SUMMARY", title: "ReturnToWorkSA Discharge Summary", funder: "WORKCOVER_SA",
    mandatory: [
      "Summary of Treatment Provided",
      "Outcome Measures (baseline vs final results)",
      "Final Work Capacity & Restrictions",
      "RTW Status & Outcome",
      "Ongoing Recommendations & Self-Management Plan"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  wa_workcover_initial: {
    id: "WA_WORKCOVER_INITIAL_ASSESSMENT", title: "WorkCover WA Initial Assessment", funder: "WORKCOVER_WA",
    mandatory: [
      "Injury / Mechanism of Injury & Claim Details",
      "Relevant Medical History & Current Medications",
      "Baseline Functional Assessment & Outcome Measures",
      "Current Work Capacity & Restrictions",
      "Physical Capacity & Functional Limitations",
      "Short-term & Long-term Goals",
      "Proposed Management Plan",
      "RTW Plan & Recommendations"
    ],
    optional: ["RTW Timeline", "Equipment Recommendations", "Attachments", "Provider Signature"]
  },
  wa_workcover_progress: {
    id: "WA_WORKCOVER_PROGRESS_REPORT", title: "WorkCover WA Progress Report", funder: "WORKCOVER_WA",
    mandatory: [
      "Summary of Treatment Provided to Date",
      "Outcome Measures (baseline vs current results)",
      "Progress Against Goals",
      "Current Work Capacity & Duties",
      "Plan for Next Treatment Period",
      "Updated RTW Recommendations"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  wa_workcover_discharge: {
    id: "WA_WORKCOVER_DISCHARGE_SUMMARY", title: "WorkCover WA Discharge Summary", funder: "WORKCOVER_WA",
    mandatory: [
      "Summary of Treatment Provided",
      "Outcome Measures (baseline vs final results)",
      "Final Work Capacity & Restrictions",
      "RTW Status & Outcome",
      "Ongoing Recommendations & Self-Management Plan"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  tac_discharge: {
    id: "TAC_DISCHARGE_SUMMARY", title: "TAC Discharge Summary", funder: "TAC",
    mandatory: [
      "Summary of Treatment Provided",
      "Outcome Measures (baseline vs final results)",
      "Progress Against Goals",
      "Final Functional Status",
      "RTW / Return to Activity Status",
      "Ongoing Recommendations & Self-Management Plan"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  maic_initial: {
    id: "MAIC_INITIAL_ASSESSMENT", title: "MAIC QLD Initial Assessment", funder: "MAIC",
    mandatory: [
      "Accident / Injury Background & Claim Details",
      "Current Symptoms & Subjective Complaints",
      "Objective Assessment Findings & Outcome Measures",
      "Functional Tolerance Summary",
      "ADL Impact & Assistance Needs",
      "Goals (short-term & long-term)",
      "Proposed Treatment Plan (frequency / duration / interventions)",
      "Recommendations"
    ],
    optional: ["Return to Activity Plan", "Attachments", "Provider Signature"]
  },
  maic_progress: {
    id: "MAIC_PROGRESS_REPORT", title: "MAIC QLD Progress Report", funder: "MAIC",
    mandatory: [
      "Summary of Treatment Provided to Date",
      "Outcome Measures (baseline vs current results)",
      "Progress Against Goals",
      "Current Functional Capacity",
      "Plan for Next Treatment Period",
      "Recommendations"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  maic_discharge: {
    id: "MAIC_DISCHARGE_SUMMARY", title: "MAIC QLD Discharge Summary", funder: "MAIC",
    mandatory: [
      "Summary of Treatment Provided",
      "Outcome Measures (baseline vs final results)",
      "Final Functional Status",
      "Ongoing Recommendations & Self-Management Plan"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  ctp_initial: {
    id: "CTP_INITIAL_ASSESSMENT", title: "CTP Motor Accident â€” Initial Assessment", funder: "CTP",
    mandatory: [
      "Accident / Injury Background & Claim Details",
      "Current Symptoms & Subjective Complaints",
      "Objective Assessment Findings & Outcome Measures",
      "Functional Tolerance (sitting / standing / walking / lifting)",
      "ADL Impact & Assistance Needs",
      "Goals (short-term & long-term)",
      "Proposed Treatment Plan",
      "Recommendations"
    ],
    optional: ["Return to Activity Plan", "Attachments", "Provider Signature"]
  },
  ctp_progress: {
    id: "CTP_PROGRESS_REPORT", title: "CTP Motor Accident â€” Progress Report", funder: "CTP",
    mandatory: [
      "Summary of Treatment Provided to Date",
      "Outcome Measures (baseline vs current results)",
      "Progress Against Goals",
      "Current Functional Capacity",
      "Plan for Next Treatment Period",
      "Recommendations"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  ctp_discharge: {
    id: "CTP_DISCHARGE_SUMMARY", title: "CTP Motor Accident â€” Discharge Summary", funder: "CTP",
    mandatory: [
      "Summary of Treatment Provided",
      "Outcome Measures (baseline vs final results)",
      "Final Functional Status",
      "Ongoing Recommendations & Self-Management Plan"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  hcp_initial: {
    id: "HCP_INITIAL_FUNCTIONAL_ASSESSMENT", title: "Home Care Package â€” Initial Functional Assessment", funder: "AGED_CARE",
    mandatory: [
      "Reason for Referral & Presenting Concerns",
      "Relevant Medical History & Medications",
      "Falls History & Risk Assessment",
      "Functional Assessment Findings & Outcome Measures",
      "ADL / IADL Capacity & Assistance Needs",
      "Mobility & Balance Assessment",
      "Cognitive Screening (if indicated)",
      "Client Goals (patient-centred)",
      "Proposed HCP Service Plan (frequency / interventions)",
      "Recommendations & Referrals"
    ],
    optional: ["Carer / Family Notes", "Equipment / Home Modification Recommendations", "Cognitive Screening Notes", "Attachments", "Provider Signature"]
  },
  hcp_care_plan: {
    id: "HCP_INDIVIDUAL_CARE_PLAN", title: "Home Care Package â€” Individual Care Plan", funder: "AGED_CARE",
    mandatory: [
      "Client Goals (aligned to HCP package goals)",
      "Service Types & Frequency",
      "Intervention Plan & Exercise Program",
      "Review Schedule",
      "Emergency / Safety Plan",
      "Client / Representative Consent"
    ],
    optional: ["Equipment Recommendations", "Home Modification Notes", "Carer Support Plan", "Attachments", "Provider Signature"]
  },
  hcp_annual_review: {
    id: "HCP_ANNUAL_REVIEW", title: "Home Care Package â€” Annual Review", funder: "AGED_CARE",
    mandatory: [
      "Summary of Services Provided",
      "Outcome Measures (baseline vs current results)",
      "Progress Against Goals",
      "Current Functional Status & ADL Capacity",
      "Falls Risk Review",
      "Updated Goals for Next Period",
      "Recommended Changes to Service Plan",
      "Recommendations & Referrals"
    ],
    optional: ["Carer / Family Notes", "Cognitive Update", "Attachments", "Provider Signature"]
  },
  chsp_initial: {
    id: "CHSP_INITIAL_ASSESSMENT", title: "CHSP Initial Assessment", funder: "CHSP",
    mandatory: [
      "Reason for Referral & Presenting Concerns",
      "Relevant Medical History & Medications",
      "Falls History & Risk Assessment",
      "Functional Assessment Findings & Outcome Measures",
      "ADL Capacity & Assistance Needs",
      "Client Goals",
      "Proposed Support Plan",
      "Recommendations"
    ],
    optional: ["Equipment Recommendations", "Carer Notes", "Attachments", "Provider Signature"]
  },
  chsp_support_plan: {
    id: "CHSP_SUPPORT_PLAN", title: "CHSP Support Plan", funder: "CHSP",
    mandatory: [
      "Client Goals (aligned to CHSP service types)",
      "Service Frequency & Duration",
      "Intervention Plan",
      "Review Schedule",
      "Client / Representative Consent"
    ],
    optional: ["Equipment Recommendations", "Attachments", "Provider Signature"]
  },
  legal_fce: {
    id: "LEGAL_FCE", title: "Functional Capacity Evaluation (FCE)", funder: "LEGAL",
    mandatory: [
      "Purpose & Referral Details",
      "Relevant Medical & Occupational History",
      "Assessment Tools & Methods Used",
      "Subjective Complaints & Consistency of Effort",
      "Postural Tolerances (sitting / standing / walking)",
      "Material Handling Capacities (lift / carry / push / pull)",
      "Hand Function & Fine Motor Assessment",
      "Cardiovascular & Endurance Findings",
      "Validity & Reliability Indicators",
      "Work Capacity Summary (hours / restrictions by category)",
      "Transferable Skills & Suitable Duties",
      "Prognosis & Recommendations"
    ],
    optional: ["Appendix: Raw Test Data", "Attachments", "Provider Signature"]
  },
  legal_medico: {
    id: "LEGAL_MEDICOLEGAL_REPORT", title: "Medico-Legal / Independent Medical Report", funder: "LEGAL",
    mandatory: [
      "Instructions & Purpose of Report",
      "Qualifications & Independence Statement",
      "Documents & Evidence Reviewed",
      "Relevant Medical & Occupational History",
      "Clinical Assessment Findings",
      "Diagnosis & Causation (relationship to incident / condition)",
      "Functional Limitations & Impact on Daily Life",
      "Prognosis",
      "Responses to Specific Questions from Solicitor / Insurer",
      "Summary & Conclusions"
    ],
    optional: ["Bibliography / References", "Appendices", "Provider Signature"]
  },
  cancer_initial: {
    id: "CANCER_INITIAL_ASSESSMENT", title: "Cancer / Oncology â€” Initial Assessment", funder: "CANCER",
    mandatory: [
      "Reason for Referral & Cancer Background",
      "Cancer Type, Stage & Treatment Status (surgery / chemo / radiotherapy / hormone)",
      "Treatment-Related Side Effects (fatigue, pain, neuropathy, lymphoedema, etc.)",
      "Relevant Medical History & Medications",
      "Baseline Fitness & Functional Assessment",
      "Outcome Measures (PROMS, fatigue scales, functional tests)",
      "Contraindications & Exercise Precautions",
      "Client Goals",
      "Proposed Exercise Prescription & Intervention Plan",
      "Recommendations & Referrals"
    ],
    optional: ["Lymphoedema Screening Notes", "Psychosocial Screening", "Attachments", "Provider Signature"]
  },
  cancer_progress: {
    id: "CANCER_PROGRESS_REPORT", title: "Cancer / Oncology â€” Progress Report", funder: "CANCER",
    mandatory: [
      "Summary of Treatment Provided",
      "Outcome Measures (baseline vs current results)",
      "Progress Against Goals",
      "Changes in Cancer Treatment / Side Effects",
      "Current Exercise Tolerance & Functional Status",
      "Updated Exercise Prescription",
      "Recommendations"
    ],
    optional: ["Psychosocial Update", "Attachments", "Provider Signature"]
  },
  cardiac_phase1: {
    id: "CARDIAC_PHASE1", title: "Cardiac Rehab â€” Phase I (Inpatient)", funder: "CARDIAC",
    mandatory: ["Reason for Referral & Cardiac Event Summary", "Relevant Medical History & Risk Factors", "Baseline Functional Assessment", "Inpatient Exercise Tolerance & Activity Progression", "Patient Education Delivered", "Discharge Functional Status", "Goals & Phase II Recommendations"],
    optional: ["Medications on Discharge", "Attachments", "Provider Signature"]
  },
  cardiac_phase2: {
    id: "CARDIAC_PHASE2", title: "Cardiac Rehab â€” Phase II (Outpatient)", funder: "CARDIAC",
    mandatory: ["Reason for Referral & Cardiac History", "Baseline Assessment & Risk Stratification", "Exercise Prescription & Program Design", "Education & Behaviour Change Interventions", "Outcome Measures (baseline vs current)", "Progress Against Goals", "Plan for Phase III / Maintenance"],
    optional: ["Psychosocial Screening Results", "Attachments", "Provider Signature"]
  },
  cardiac_phase3: {
    id: "CARDIAC_PHASE3", title: "Cardiac Rehab â€” Phase III Completion Report", funder: "CARDIAC",
    mandatory: ["Summary of Program Participation", "Outcome Measures (baseline vs end of program)", "Exercise Capacity Change (e.g. 6MWT, VO2 max, step test)", "Risk Factor Improvements", "Patient Education & Self-Management Achieved", "Discharge Functional Status & Goals Met", "Long-term Maintenance Recommendations"],
    optional: ["Return to Work / Activity Status", "Attachments", "Provider Signature"]
  },
  cardiac_phase4: {
    id: "CARDIAC_PHASE4", title: "Cardiac Rehab â€” Phase IV Referral Letter", funder: "CARDIAC",
    mandatory: ["Reason for Referral to Community Maintenance Program", "Summary of Phase II / III Participation & Outcomes", "Current Exercise Capacity & Functional Status", "Risk Stratification & Precautions", "Recommended Exercise Parameters", "Goals for Community Program"],
    optional: ["Medications", "Emergency Action Plan Notes", "Attachments", "Provider Signature"]
  },
  tac_progress: {
    id: "TAC_PROGRESS_REPORT", title: "TAC Progress Report", funder: "TAC",
    mandatory: [
      "Summary of Treatment Provided to Date",
      "Outcome Measures (baseline vs current results)",
      "Progress Against Goals",
      "Current Functional Capacity",
      "Goals Update",
      "Plan for Next Treatment Period",
      "Recommendations & Justification for Continued Treatment"
    ],
    optional: ["Attachments", "Provider Signature"]
  },
  aged_care_assessment: {
    id: "AGED_CARE_ASSESSMENT", title: "Aged Care Assessment", funder: "AGED_CARE",
    mandatory: [
      "Reason for Assessment & Referral Source",
      "Relevant Medical History & Medications",
      "Baseline Functional Assessment Results & Outcome Measures",
      "Falls Risk Assessment & Safety",
      "Functional Status (transfers / gait / stairs / ADLs)",
      "Cognitive Screening (if applicable)",
      "Home / Environment Considerations",
      "Equipment / Aids in Use",
      "Goals (function / independence / safety)",
      "Recommendations & Exercise / Management Plan",
      "Carer / Family Considerations"
    ],
    optional: ["Cognitive Screening Notes", "Carer / Family Notes", "Attachments", "Provider Signature"]
  },
  us_initial_evaluation: {
    id: "US_INITIAL_EVALUATION", title: "Initial Evaluation / Examination", funder: "USA",
    mandatory: [
      "Reason for Referral / Medical Necessity",
      "History & Subjective",
      "Objective Findings (tests / measures / outcome tools)",
      "Assessment / Clinical Impression",
      "Goals (measurable / short-term & long-term)",
      "Plan of Care (frequency / duration / interventions)",
      "Risk / Precautions",
      "Provider Signature & Credentials"
    ],
    optional: ["Attachments"]
  },
  us_plan_of_care: {
    id: "US_PLAN_OF_CARE_CERTIFICATION", title: "Plan of Care / Certification Packet", funder: "USA",
    mandatory: ["Diagnoses / Treatment Diagnoses", "Goals", "Frequency / Duration", "Interventions", "Certification / Ordering Provider Info", "Provider Signature & Date"],
    optional: ["Attachments"]
  },
  us_progress_report: {
    id: "US_PROGRESS_REPORT", title: "Progress Report / Re-examination", funder: "USA",
    mandatory: ["Interval History / Changes", "Objective Re-test Results", "Progress Toward Goals", "Clinical Justification for Continued Care", "Plan Updates (if any)", "Provider Signature & Credentials"],
    optional: ["Attachments"]
  },
  us_discharge_summary: {
    id: "US_DISCHARGE_SUMMARY", title: "Discharge Summary", funder: "USA",
    mandatory: ["Reason for Discharge", "Status at Discharge", "Outcomes / Goal Attainment", "Home Program / Self-management Plan", "Recommendations / Referrals", "Provider Signature & Credentials"],
    optional: ["Attachments"]
  },
  us_prior_auth: {
    id: "US_PRIOR_AUTH_PACK", title: "Prior Authorization / Medical Necessity", funder: "USA",
    mandatory: ["Clinical Summary", "Objective Findings", "Goal Rationale", "Requested Visits (number / frequency)", "Skilled Need Justification", "Attachments"],
    optional: ["Provider Signature"]
  },

  // â”€â”€â”€ UK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  uk_nhs_ers_initial: {
    id: "UK_NHS_ERS_INITIAL", title: "NHS ERS â€” Initial Assessment", funder: "UK_NHS",
    mandatory: ["Referral Details & Referring Clinician","Medical History & Contraindications","Physical Activity & Lifestyle Baseline","Baseline Fitness Assessment (ISWT / 6MWT / step test)","Resting Observations (HR, BP, SpO2, BMI)","Risk Stratification","Goals (short-term & long-term)","Exercise Prescription & Programme Plan"],
    optional: ["Psychological Screening (PHQ-9 / GAD-7)", "Attachments", "Provider Signature"]
  },
  uk_nhs_ers_progress: {
    id: "UK_NHS_ERS_PROGRESS", title: "NHS ERS â€” Progress Report", funder: "UK_NHS",
    mandatory: ["Summary of Attendance & Engagement","Outcome Measures (baseline vs current)","Exercise Capacity Progress","Adherence & Barriers","Goals Update","Plan for Remainder of Programme"],
    optional: ["Psychosocial Update", "Attachments", "Provider Signature"]
  },
  uk_nhs_ers_completion: {
    id: "UK_NHS_ERS_COMPLETION", title: "NHS ERS â€” Completion / Discharge Report", funder: "UK_NHS",
    mandatory: ["Programme Summary & Attendance","Outcome Measures (baseline vs end)","Exercise Capacity Change","Physical Activity Level at Discharge","Goals Achieved","Recommendations for Ongoing Activity","Onward Referral (if applicable)"],
    optional: ["Barriers & Relapse Prevention", "Attachments", "Provider Signature"]
  },
  uk_cardiac_initial: {
    id: "UK_CARDIAC_INITIAL", title: "Cardiac Rehab â€” Initial Clinical Assessment", funder: "UK_CARDIAC",
    mandatory: ["Cardiac Event Summary & Referral Details","Relevant Cardiac History & Medications","Cardiovascular Risk Factors","Baseline Exercise Tolerance Assessment (CPET / 6MWT / Incremental Shuttle)","Resting ECG & Haemodynamic Response","Risk Stratification (BACPR / SIGN)","Psychological Screening (PHQ-9 / GAD-7 / HADS)","Patient Goals","Phase II Exercise Prescription"],
    optional: ["Vocational / Return to Work Goals", "Attachments", "Provider Signature"]
  },
  uk_cardiac_completion: {
    id: "UK_CARDIAC_COMPLETION", title: "Cardiac Rehab â€” Phase III Completion Report", funder: "UK_CARDIAC",
    mandatory: ["Programme Summary & Attendance","Outcome Measures (baseline vs end of programme)","Exercise Capacity Change","Risk Factor Improvements (weight, BP, lipids, HbA1c)","Psychological Wellbeing Outcomes","Goals Achieved","Long-term Maintenance Recommendations","Phase IV Referral"],
    optional: ["Return to Work / Driving Status", "Attachments", "Provider Signature"]
  },
  uk_pulmonary_initial: {
    id: "UK_PULMONARY_INITIAL", title: "Pulmonary Rehab â€” Initial Assessment", funder: "UK_PULMONARY",
    mandatory: ["Referral Details & Respiratory Diagnosis","Spirometry Results (FEV1, FVC, FEV1/FVC)","MRC Dyspnoea Scale","Baseline Exercise Tolerance (ISWT / 6MWT)","SGRQ / CAT Score","Oxygen Saturation at Rest & Exercise","Comorbidities & Medications","Goals & Exercise Prescription"],
    optional: ["Anxiety / Depression Screening", "Attachments", "Provider Signature"]
  },
  uk_pulmonary_completion: {
    id: "UK_PULMONARY_COMPLETION", title: "Pulmonary Rehab â€” Completion Report", funder: "UK_PULMONARY",
    mandatory: ["Attendance & Engagement","Outcome Measures (baseline vs end)","Exercise Capacity Change (ISWT / 6MWT)","SGRQ / CAT Score Change","Breathlessness & Functional Improvement","Goals Achieved","Maintenance Recommendations & Onward Referral"],
    optional: ["Exacerbation Frequency", "Attachments", "Provider Signature"]
  },
  uk_cancer_initial: {
    id: "UK_CANCER_INITIAL", title: "Cancer Rehab â€” Initial Exercise Assessment", funder: "UK_CANCER",
    mandatory: ["Referral Details & Cancer Diagnosis / Treatment Status","Holistic Needs Assessment (HNA) Summary","Medical Clearance & Contraindications","Baseline Fitness Assessment","Fatigue & Wellbeing Screening","Goals","Exercise Prescription & Programme Plan"],
    optional: ["Psychological Referral", "Attachments", "Provider Signature"]
  },
  uk_cancer_progress: {
    id: "UK_CANCER_PROGRESS", title: "Cancer Rehab â€” Progress Report", funder: "UK_CANCER",
    mandatory: ["Attendance & Engagement","Outcome Measures (baseline vs current)","Exercise Tolerance Progress","Fatigue & Wellbeing Update","Cancer Treatment Changes","Goals Update","Plan Going Forward"],
    optional: ["Psychosocial Update", "Attachments", "Provider Signature"]
  },
  uk_cancer_completion: {
    id: "UK_CANCER_COMPLETION", title: "Cancer Rehab â€” End-of-Programme Report", funder: "UK_CANCER",
    mandatory: ["Programme Summary & Attendance","Outcome Measures (baseline vs end)","Exercise Capacity Change","Wellbeing & Fatigue Outcomes","Goals Achieved","Recommendations for Ongoing Activity","Onward Referral"],
    optional: ["Return to Work / ADL Status", "Attachments", "Provider Signature"]
  },
  uk_pmi_initial: {
    id: "UK_PMI_INITIAL", title: "PMI â€” Initial Assessment / Consultation Report", funder: "UK_PMI",
    mandatory: ["Referral Details & Insurer","Presenting Complaint & History","Relevant Medical History","Assessment Findings & Outcome Measures","Diagnosis / Clinical Impression","Goals","Proposed Treatment Plan (frequency, duration, modality)","Clinical Justification for Treatment"],
    optional: ["Prior Treatment", "Attachments", "Provider Signature"]
  },
  uk_pmi_progress: {
    id: "UK_PMI_PROGRESS", title: "PMI â€” Progress Report", funder: "UK_PMI",
    mandatory: ["Summary of Treatment to Date","Outcome Measures (baseline vs current)","Response to Treatment","Goals Update","Justification for Continued Treatment","Plan for Remaining Sessions"],
    optional: ["Barriers to Recovery", "Attachments", "Provider Signature"]
  },
  uk_pmi_discharge: {
    id: "UK_PMI_DISCHARGE", title: "PMI â€” Discharge Report", funder: "UK_PMI",
    mandatory: ["Summary of Treatment Provided","Outcome Measures (baseline vs discharge)","Goals Achieved","Functional Status at Discharge","Home Programme Provided","Discharge Recommendations"],
    optional: ["Onward Referral", "Attachments", "Provider Signature"]
  },
  uk_fce: {
    id: "UK_FCE", title: "FCE / Work Capacity Assessment", funder: "UK_LEGAL",
    mandatory: ["Referral Details & Purpose","Background & Work History","Medical History & Current Condition","Physical Assessment Findings","Functional Capacity Testing Results","Work Tolerances & Restrictions","Consistency of Effort / Validity Indicators","Opinions & Recommendations for RTW"],
    optional: ["Psychosocial Screening", "Attachments", "Provider Signature"]
  },
  uk_rtw_progress: {
    id: "UK_RTW_PROGRESS", title: "Return to Work Progress Report", funder: "UK_LEGAL",
    mandatory: ["Referral Details & Employer / Insurer","Summary of Treatment to Date","Current Functional Status","Work Capacity & Restrictions","Progress Against RTW Goals","Proposed Graded RTW Plan","Recommendations to Employer / Occupational Health"],
    optional: ["Barriers to RTW", "Attachments", "Provider Signature"]
  },
  uk_gp_summary: {
    id: "UK_GP_SUMMARY", title: "GP / Specialist Summary Letter", funder: "UK_GENERAL",
    mandatory: ["Reason for Referral","Assessment Findings & Outcome Measures","Diagnosis / Clinical Impression","Intervention Provided","Progress & Response to Treatment","Recommendations & Next Steps"],
    optional: ["Onward Referral", "Attachments", "Provider Signature"]
  },
  // â”€â”€â”€ Canada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ca_wsib_initial: {
    id: "CA_WSIB_INITIAL", title: "WSIB â€” Initial Assessment Report", funder: "CA_WSIB",
    mandatory: ["Referral Details & Claim Information","Mechanism of Injury & Background","Relevant Medical History","Assessment Findings & Functional Limitations","Diagnosis","Goals (short-term & long-term)","Proposed Treatment Plan","Return-to-Work Recommendations"],
    optional: ["Workplace Demands Analysis", "Attachments", "Provider Signature"]
  },
  ca_wsib_faf: {
    id: "CA_WSIB_FAF", title: "WSIB â€” Functional Abilities Form (FAF)", funder: "CA_WSIB",
    mandatory: ["Worker Information","Date of Assessment","Physical Tolerances (sitting, standing, walking, lifting)","Work Status & Restrictions","Functional Abilities Summary","Recommended Duties","Expected Date of Return to Full Duties"],
    optional: ["Attachments", "Provider Signature"]
  },
  ca_wsib_progress: {
    id: "CA_WSIB_PROGRESS", title: "WSIB â€” Progress Report", funder: "CA_WSIB",
    mandatory: ["Summary of Treatment to Date","Outcome Measures (baseline vs current)","Functional Progress","Work Capacity Update","Goals Update","Barriers to Recovery","Plan for Next Treatment Period"],
    optional: ["RTW Timeline Update", "Attachments", "Provider Signature"]
  },
  ca_wsib_rtw: {
    id: "CA_WSIB_RTW", title: "WSIB â€” Return-to-Work Summary", funder: "CA_WSIB",
    mandatory: ["Summary of Rehabilitation Programme","Outcome Measures at Discharge","Functional Capacity at Discharge","RTW Status & Duties","Remaining Restrictions (if any)","Recommendations for Employer / WSIB"],
    optional: ["Home Programme", "Attachments", "Provider Signature"]
  },
  ca_worksafebc_initial: {
    id: "CA_WORKSAFEBC_INITIAL", title: "WorkSafeBC â€” Initial Assessment", funder: "CA_WORKSAFEBC",
    mandatory: ["Claim Details & Referral","Mechanism of Injury","Medical History & Current Status","Assessment Findings","Diagnosis","Goals","Proposed Treatment Plan","RTW Recommendations"],
    optional: ["Workplace Demands", "Attachments", "Provider Signature"]
  },
  ca_worksafebc_fca: {
    id: "CA_WORKSAFEBC_FCA", title: "WorkSafeBC â€” Functional Capacity Assessment (FCA)", funder: "CA_WORKSAFEBC",
    mandatory: ["Referral Purpose","Background & Claim History","Physical Assessment","Functional Capacity Testing Results","Work Tolerances","Validity Indicators","Recommendations for RTW / Disability Rating"],
    optional: ["Attachments", "Provider Signature"]
  },
  ca_worksafebc_progress: {
    id: "CA_WORKSAFEBC_PROGRESS", title: "WorkSafeBC â€” Progress Report", funder: "CA_WORKSAFEBC",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs current)","Functional Progress","Work Capacity","Goals Update","Plan Going Forward"],
    optional: ["Attachments", "Provider Signature"]
  },
  ca_wcb_alberta_initial: {
    id: "CA_WCB_ALBERTA_INITIAL", title: "WCB Alberta â€” Initial Assessment", funder: "CA_WCB_AB",
    mandatory: ["Claim Details","Mechanism of Injury","Medical History","Assessment Findings","Diagnosis","Goals","Treatment Plan","RTW Recommendations"],
    optional: ["Workplace Demands", "Attachments", "Provider Signature"]
  },
  ca_wcb_alberta_fce: {
    id: "CA_WCB_ALBERTA_FCE", title: "WCB Alberta â€” Functional Capacity Evaluation (FCE)", funder: "CA_WCB_AB",
    mandatory: ["Referral Purpose & Claim Details","Physical Assessment Findings","FCE Testing Results","Work Tolerances & Physical Demands Classification","Validity & Reliability","Recommendations for RTW / Disability"],
    optional: ["Attachments", "Provider Signature"]
  },
  ca_wcb_alberta_progress: {
    id: "CA_WCB_ALBERTA_PROGRESS", title: "WCB Alberta â€” Progress Report", funder: "CA_WCB_AB",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs current)","Functional Progress","Work Capacity Update","Goals Update","Plan Going Forward"],
    optional: ["Attachments", "Provider Signature"]
  },
  ca_ehb_initial: {
    id: "CA_EHB_INITIAL", title: "Extended Health Benefits â€” Initial Assessment", funder: "CA_EHB",
    mandatory: ["Referral Details & Insurer","Presenting Complaint & History","Assessment Findings & Outcome Measures","Diagnosis","Goals","Proposed Treatment Plan","Clinical Justification"],
    optional: ["Attachments", "Provider Signature"]
  },
  ca_ehb_progress: {
    id: "CA_EHB_PROGRESS", title: "Extended Health Benefits â€” Progress Report", funder: "CA_EHB",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs current)","Response to Treatment","Goals Update","Justification for Continued Treatment","Plan for Remaining Sessions"],
    optional: ["Attachments", "Provider Signature"]
  },
  ca_vac_initial: {
    id: "CA_VAC_INITIAL", title: "Veterans Affairs Canada â€” Initial Assessment", funder: "CA_VAC",
    mandatory: ["Referral Details & VAC File Number","Presenting Complaint & Service-Related History","Medical History & Current Medications","Assessment Findings & Outcome Measures","Functional Limitations","Goals","Proposed Rehabilitation Plan"],
    optional: ["Psychosocial Screening", "Attachments", "Provider Signature"]
  },
  ca_vac_progress: {
    id: "CA_VAC_PROGRESS", title: "Veterans Affairs Canada â€” Progress Report", funder: "CA_VAC",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs current)","Functional Progress","Goals Update","VAC Rehabilitation Goals Alignment","Plan Going Forward"],
    optional: ["Psychosocial Update", "Attachments", "Provider Signature"]
  },
  // â”€â”€â”€ New Zealand â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  nz_acc_initial: {
    id: "NZ_ACC_INITIAL", title: "ACC â€” Initial Assessment Report", funder: "NZ_ACC",
    mandatory: ["Referral Details & ACC Claim Number","Mechanism of Injury & Background","Medical History & Current Medications","Assessment Findings & Outcome Measures","Diagnosis","Goals (short-term & long-term)","Proposed Treatment Plan (frequency, duration)","Expected Outcome & Timeframe"],
    optional: ["Workplace / ADL Impact", "Attachments", "Provider Signature"]
  },
  nz_acc_progress: {
    id: "NZ_ACC_PROGRESS", title: "ACC â€” Progress Report (ACC32 Extension)", funder: "NZ_ACC",
    mandatory: ["Claim Details","Treatment Summary to Date","Outcome Measures (baseline vs current)","Functional Progress","Goals Update","Justification for Extension of Treatment","Plan for Next Period"],
    optional: ["Barriers to Recovery", "Attachments", "Provider Signature"]
  },
  nz_acc_fce: {
    id: "NZ_ACC_FCE", title: "ACC â€” Functional Capacity Evaluation (FCE)", funder: "NZ_ACC",
    mandatory: ["Referral Purpose & Claim Details","Background & Injury History","Physical Assessment","FCE Testing Results & Work Tolerances","Validity Indicators","Recommendations for ACC / RTW"],
    optional: ["Attachments", "Provider Signature"]
  },
  nz_acc_discharge: {
    id: "NZ_ACC_DISCHARGE", title: "ACC â€” Discharge / Completion Summary", funder: "NZ_ACC",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs discharge)","Goals Achieved","Functional Status at Discharge","Home Programme Provided","Discharge Recommendations"],
    optional: ["Onward Referral", "Attachments", "Provider Signature"]
  },
  nz_disability_initial: {
    id: "NZ_DISABILITY_INITIAL", title: "Disability Support â€” Functional Assessment", funder: "NZ_DISABILITY",
    mandatory: ["Referral Details & Funding Source (Whaikaha / MoH)","Presenting Condition & Disability Impact","Assessment Findings across ADL Domains","Functional Capacity & Support Needs","Goals","Proposed Support Plan & Equipment"],
    optional: ["Carer / Family Input", "Attachments", "Provider Signature"]
  },
  nz_private_initial: {
    id: "NZ_PRIVATE_INITIAL", title: "Private Insurance â€” Initial Assessment", funder: "NZ_PRIVATE",
    mandatory: ["Referral & Insurer Details","Presenting Complaint & History","Assessment Findings & Outcome Measures","Diagnosis","Goals","Proposed Treatment Plan","Clinical Justification"],
    optional: ["Attachments", "Provider Signature"]
  },
  nz_private_progress: {
    id: "NZ_PRIVATE_PROGRESS", title: "Private Insurance â€” Progress Report", funder: "NZ_PRIVATE",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs current)","Response to Treatment","Goals Update","Justification for Continued Sessions","Plan Going Forward"],
    optional: ["Attachments", "Provider Signature"]
  },
  // â”€â”€â”€ Singapore â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sg_healthiersg_initial: {
    id: "SG_HEALTHIERSG_INITIAL", title: "Healthier SG â€” Initial Assessment Report", funder: "SG_HSG",
    mandatory: ["Referral Details & Enrolled Clinic","Health Plan Goals","Medical History & Chronic Conditions","Assessment Findings & Outcome Measures","Functional Limitations","Goals (aligned to Healthier SG Health Plan)","Proposed Exercise / Rehabilitation Plan"],
    optional: ["Dietary / Lifestyle Recommendations", "Attachments", "Provider Signature"]
  },
  sg_healthiersg_progress: {
    id: "SG_HEALTHIERSG_PROGRESS", title: "Healthier SG â€” Programme Progress Report", funder: "SG_HSG",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs current)","Chronic Disease Indicators (HbA1c, BP, BMI)","Goals Update","Engagement & Adherence","Plan Going Forward"],
    optional: ["Attachments", "Provider Signature"]
  },
  sg_healthiersg_completion: {
    id: "SG_HEALTHIERSG_COMPLETION", title: "Healthier SG â€” Completion / Discharge Report", funder: "SG_HSG",
    mandatory: ["Programme Summary","Outcome Measures (baseline vs end)","Chronic Disease Indicator Changes","Goals Achieved","Recommendations for Ongoing Self-Management","Onward Referral (if applicable)"],
    optional: ["Attachments", "Provider Signature"]
  },
  sg_cdmp_initial: {
    id: "SG_CDMP_INITIAL", title: "CDMP â€” Initial Exercise Assessment", funder: "SG_CDMP",
    mandatory: ["Referral Details & CDMP Chronic Conditions","Medical History & Contraindications","Baseline Assessment (fitness, strength, flexibility)","Chronic Disease Indicators (HbA1c, BP, lipids, BMI)","Goals","Exercise Prescription & Programme Plan"],
    optional: ["Dietary Advice", "Attachments", "Provider Signature"]
  },
  sg_cdmp_progress: {
    id: "SG_CDMP_PROGRESS", title: "CDMP â€” Progress / Review Report", funder: "SG_CDMP",
    mandatory: ["Treatment Summary","Chronic Disease Indicators (baseline vs current)","Exercise Capacity Progress","Adherence","Goals Update","Plan Going Forward"],
    optional: ["Attachments", "Provider Signature"]
  },
  sg_cdmp_discharge: {
    id: "SG_CDMP_DISCHARGE", title: "CDMP â€” Discharge Summary", funder: "SG_CDMP",
    mandatory: ["Programme Summary","Chronic Disease Indicators (baseline vs discharge)","Exercise Capacity Change","Goals Achieved","Home Programme","Discharge Recommendations"],
    optional: ["Onward Referral", "Attachments", "Provider Signature"]
  },
  sg_wica_initial: {
    id: "SG_WICA_INITIAL", title: "WICA â€” Work Injury Assessment", funder: "SG_WICA",
    mandatory: ["Claim Details & MOM Reference","Mechanism of Injury","Medical History & Current Status","Assessment Findings","Functional Limitations","Diagnosis","Proposed Treatment Plan","RTW Recommendations"],
    optional: ["Workplace Demands", "Attachments", "Provider Signature"]
  },
  sg_wica_rtw: {
    id: "SG_WICA_RTW", title: "WICA â€” Return-to-Work Plan", funder: "SG_WICA",
    mandatory: ["Claim Details","Current Functional Status","Work Capacity & Restrictions","Graded RTW Plan","Recommended Duties / Modifications","Expected RTW Date","Employer Recommendations"],
    optional: ["Attachments", "Provider Signature"]
  },
  sg_corporate_initial: {
    id: "SG_CORPORATE_INITIAL", title: "Corporate / Private Insurance â€” Initial Assessment", funder: "SG_PRIVATE",
    mandatory: ["Referral & Insurer Details","Presenting Complaint & History","Assessment Findings & Outcome Measures","Diagnosis","Goals","Proposed Treatment Plan","Clinical Justification"],
    optional: ["Attachments", "Provider Signature"]
  },
  // â”€â”€â”€ Ireland â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  ie_hse_initial: {
    id: "IE_HSE_INITIAL", title: "HSE â€” Initial Assessment Report", funder: "IE_HSE",
    mandatory: ["Referral Details & Programme Type (Cardiac/Pulmonary/Cancer)","Medical History & Current Status","Baseline Assessment Findings","Risk Stratification","Goals","Exercise Prescription & Programme Plan"],
    optional: ["Psychosocial Screening", "Attachments", "Provider Signature"]
  },
  ie_hse_progress: {
    id: "IE_HSE_PROGRESS", title: "HSE â€” Progress Review Report", funder: "IE_HSE",
    mandatory: ["Attendance & Engagement","Outcome Measures (baseline vs current)","Exercise Progress","Goals Update","Plan Going Forward"],
    optional: ["Attachments", "Provider Signature"]
  },
  ie_hse_discharge: {
    id: "IE_HSE_DISCHARGE", title: "HSE â€” Discharge Summary", funder: "IE_HSE",
    mandatory: ["Programme Summary & Attendance","Outcome Measures (baseline vs discharge)","Goals Achieved","Maintenance Recommendations","Onward Referral"],
    optional: ["Attachments", "Provider Signature"]
  },
  ie_cardiac_initial: {
    id: "IE_CARDIAC_INITIAL", title: "Cardiac Rehab â€” Initial Assessment (Ireland)", funder: "IE_CARDIAC",
    mandatory: ["Referral Details & Cardiac Event","Cardiovascular Risk Factors","Medical History & Medications","Baseline Exercise Assessment","Risk Stratification","Goals","Phase II Exercise Prescription"],
    optional: ["Psychological Screening", "Attachments", "Provider Signature"]
  },
  ie_cardiac_completion: {
    id: "IE_CARDIAC_COMPLETION", title: "Cardiac Rehab â€” Completion Report (Ireland)", funder: "IE_CARDIAC",
    mandatory: ["Programme Summary & Attendance","Outcome Measures (baseline vs end)","Exercise Capacity Change","Risk Factor Improvements","Goals Achieved","Long-term Maintenance Recommendations"],
    optional: ["Phase IV Referral", "Attachments", "Provider Signature"]
  },
  ie_piab_fce: {
    id: "IE_PIAB_FCE", title: "PIAB â€” Personal Injury Functional Assessment", funder: "IE_LEGAL",
    mandatory: ["Referral Details & PIAB Reference","Background & Injury History","Medical History","Assessment Findings & Outcome Measures","Functional Limitations","Prognosis & Recommendations"],
    optional: ["Consistency of Effort", "Attachments", "Provider Signature"]
  },
  ie_private_initial: {
    id: "IE_PRIVATE_INITIAL", title: "Private Insurance â€” Initial Assessment (Ireland)", funder: "IE_PRIVATE",
    mandatory: ["Referral & Insurer Details","Presenting Complaint & History","Assessment Findings & Outcome Measures","Diagnosis","Goals","Proposed Treatment Plan","Clinical Justification"],
    optional: ["Attachments", "Provider Signature"]
  },
  ie_private_progress: {
    id: "IE_PRIVATE_PROGRESS", title: "Private Insurance â€” Progress Report (Ireland)", funder: "IE_PRIVATE",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs current)","Response to Treatment","Goals Update","Justification for Continued Sessions","Plan Going Forward"],
    optional: ["Attachments", "Provider Signature"]
  },
  ie_private_discharge: {
    id: "IE_PRIVATE_DISCHARGE", title: "Private Insurance â€” Discharge Report (Ireland)", funder: "IE_PRIVATE",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs discharge)","Goals Achieved","Functional Status at Discharge","Home Programme","Discharge Recommendations"],
    optional: ["Onward Referral", "Attachments", "Provider Signature"]
  },
  ie_gp_summary: {
    id: "IE_GP_SUMMARY", title: "GP / Specialist Summary Letter (Ireland)", funder: "IE_GENERAL",
    mandatory: ["Reason for Referral","Assessment Findings & Outcome Measures","Diagnosis / Clinical Impression","Intervention Provided","Progress & Response to Treatment","Recommendations & Next Steps"],
    optional: ["Onward Referral", "Attachments", "Provider Signature"]
  },
  // â”€â”€â”€ South Africa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  za_medaid_initial: {
    id: "ZA_MEDAID_INITIAL", title: "Medical Aid â€” Initial Assessment Report", funder: "ZA_MEDAID",
    mandatory: ["Referral & Medical Aid Details (scheme / authorisation number)","Presenting Complaint & History","Medical History & Medications","Assessment Findings & Outcome Measures","Diagnosis (ICD-10 code)","Goals","Proposed Treatment Plan","Clinical Motivation for Treatment"],
    optional: ["Attachments", "Provider Signature"]
  },
  za_medaid_progress: {
    id: "ZA_MEDAID_PROGRESS", title: "Medical Aid â€” Progress Report", funder: "ZA_MEDAID",
    mandatory: ["Authorisation Reference","Treatment Summary","Outcome Measures (baseline vs current)","Response to Treatment","Goals Update","Motivation for Continued Sessions","Plan Going Forward"],
    optional: ["Attachments", "Provider Signature"]
  },
  za_medaid_discharge: {
    id: "ZA_MEDAID_DISCHARGE", title: "Medical Aid â€” Discharge Report", funder: "ZA_MEDAID",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs discharge)","Goals Achieved","Functional Status at Discharge","Home Programme","Discharge Recommendations"],
    optional: ["Onward Referral", "Attachments", "Provider Signature"]
  },
  za_coida_initial: {
    id: "ZA_COIDA_INITIAL", title: "COIDA â€” Initial Assessment Report", funder: "ZA_COIDA",
    mandatory: ["Claim Details & COIDA Reference","Mechanism of Injury & Background","Medical History","Assessment Findings","Diagnosis","Goals","Proposed Treatment Plan","RTW Recommendations"],
    optional: ["Workplace Demands", "Attachments", "Provider Signature"]
  },
  za_coida_progress: {
    id: "ZA_COIDA_PROGRESS", title: "COIDA â€” Progress Report", funder: "ZA_COIDA",
    mandatory: ["Treatment Summary","Outcome Measures (baseline vs current)","Functional Progress","Work Capacity Update","Goals Update","Plan Going Forward"],
    optional: ["RTW Timeline", "Attachments", "Provider Signature"]
  },
  za_coida_rtw: {
    id: "ZA_COIDA_RTW", title: "COIDA â€” Return-to-Work Summary", funder: "ZA_COIDA",
    mandatory: ["Claim Details","Rehabilitation Summary","Outcome Measures at Discharge","Functional Capacity at Discharge","RTW Status & Duties","Remaining Restrictions","Employer Recommendations"],
    optional: ["Attachments", "Provider Signature"]
  },
  za_raf_initial: {
    id: "ZA_RAF_INITIAL", title: "RAF â€” Initial Assessment Report", funder: "ZA_RAF",
    mandatory: ["Claim Details & RAF Reference","Mechanism of Injury (Motor Vehicle Accident)","Medical History & Current Status","Assessment Findings & Outcome Measures","Diagnosis","Functional Limitations","Goals","Proposed Treatment Plan"],
    optional: ["Psychosocial Screening", "Attachments", "Provider Signature"]
  },
  za_raf_progress: {
    id: "ZA_RAF_PROGRESS", title: "RAF â€” Progress Report", funder: "ZA_RAF",
    mandatory: ["Claim Details","Treatment Summary","Outcome Measures (baseline vs current)","Functional Progress","Goals Update","Plan Going Forward"],
    optional: ["Attachments", "Provider Signature"]
  },
  za_gems_initial: {
    id: "ZA_GEMS_INITIAL", title: "GEMS â€” Initial Assessment Report", funder: "ZA_GEMS",
    mandatory: ["GEMS Membership & Authorisation Details","Presenting Complaint & History","Medical History & Medications","Assessment Findings & Outcome Measures","Diagnosis (ICD-10)","Goals","Proposed Treatment Plan","Clinical Motivation"],
    optional: ["Attachments", "Provider Signature"]
  },
  za_gems_progress: {
    id: "ZA_GEMS_PROGRESS", title: "GEMS â€” Progress Report", funder: "ZA_GEMS",
    mandatory: ["Authorisation Reference","Treatment Summary","Outcome Measures (baseline vs current)","Response to Treatment","Goals Update","Motivation for Continued Sessions","Plan Going Forward"],
    optional: ["Attachments", "Provider Signature"]
  },
};

// Groups for display in step 0
const FUNDER_GROUPS = [
  { key: "DVA", label: "DVA (Department of Veterans' Affairs)", color: "bg-yellow-50 border-yellow-300 text-yellow-800", badge: "bg-yellow-100 text-yellow-800" },
  { key: "MEDICARE", label: "Medicare / CDSM", color: "bg-green-50 border-green-300 text-green-800", badge: "bg-green-100 text-green-800" },
  { key: "WORKCOVER", label: "WorkCover", color: "bg-orange-50 border-orange-300 text-orange-800", badge: "bg-orange-100 text-orange-800" },
  { key: "PRIVATE_HEALTH", label: "Private Health Insurance", color: "bg-purple-50 border-purple-300 text-purple-800", badge: "bg-purple-100 text-purple-800" },
  { key: "NDIS", label: "NDIS", color: "bg-blue-50 border-blue-300 text-blue-800", badge: "bg-blue-100 text-blue-800" },
  { key: "TAC", label: "TAC / MAIC", color: "bg-red-50 border-red-300 text-red-800", badge: "bg-red-100 text-red-800" },
  { key: "CARDIAC", label: "Cardiac Rehabilitation", color: "bg-red-50 border-red-300 text-red-800", badge: "bg-red-100 text-red-800" },
  { key: "AGED_CARE", label: "Aged Care", color: "bg-teal-50 border-teal-300 text-teal-800", badge: "bg-teal-100 text-teal-800" },
  { key: "WORKCOVER_NSW", label: "WorkCover NSW (SIRA / icare)", color: "bg-orange-50 border-orange-300 text-orange-800", badge: "bg-orange-100 text-orange-800" },
  { key: "WORKCOVER_VIC", label: "WorkSafe VIC", color: "bg-orange-50 border-orange-300 text-orange-800", badge: "bg-orange-100 text-orange-800" },
  { key: "WORKCOVER_SA", label: "ReturnToWorkSA", color: "bg-orange-50 border-orange-300 text-orange-800", badge: "bg-orange-100 text-orange-800" },
  { key: "WORKCOVER_WA", label: "WorkCover WA", color: "bg-orange-50 border-orange-300 text-orange-800", badge: "bg-orange-100 text-orange-800" },
  { key: "MAIC", label: "MAIC QLD (Motor Accident)", color: "bg-yellow-50 border-yellow-300 text-yellow-800", badge: "bg-yellow-100 text-yellow-800" },
  { key: "CTP", label: "CTP Motor Accident (Other States)", color: "bg-yellow-50 border-yellow-300 text-yellow-800", badge: "bg-yellow-100 text-yellow-800" },
  { key: "CHSP", label: "CHSP (Commonwealth Home Support)", color: "bg-teal-50 border-teal-300 text-teal-800", badge: "bg-teal-100 text-teal-800" },
  { key: "LEGAL", label: "Legal / FCE / Medico-Legal", color: "bg-slate-50 border-slate-400 text-slate-800", badge: "bg-slate-100 text-slate-700" },
  { key: "CANCER", label: "Cancer / Oncology Programs", color: "bg-purple-50 border-purple-300 text-purple-800", badge: "bg-purple-100 text-purple-800" },
  { key: "GP", label: "GP / Specialist Letters", color: "bg-slate-50 border-slate-300 text-slate-800", badge: "bg-slate-100 text-slate-700" },
  { key: "USA", label: "USA (Insurance / Medicare)", color: "bg-indigo-50 border-indigo-300 text-indigo-800", badge: "bg-indigo-100 text-indigo-800" },
  { key: "UK_NHS", label: "UK NHS", color: "bg-blue-50 border-blue-300 text-blue-800", badge: "bg-blue-100 text-blue-800" },
  { key: "UK_CARDIAC", label: "UK Cardiac", color: "bg-red-50 border-red-300 text-red-800", badge: "bg-red-100 text-red-800" },
  { key: "UK_PULMONARY", label: "UK Pulmonary", color: "bg-teal-50 border-teal-300 text-teal-800", badge: "bg-teal-100 text-teal-800" },
  { key: "UK_CANCER", label: "UK Cancer", color: "bg-purple-50 border-purple-300 text-purple-800", badge: "bg-purple-100 text-purple-800" },
  { key: "UK_PMI", label: "UK PMI", color: "bg-slate-50 border-slate-300 text-slate-800", badge: "bg-slate-100 text-slate-700" },
  { key: "UK_LEGAL", label: "UK Legal", color: "bg-slate-50 border-slate-400 text-slate-800", badge: "bg-slate-100 text-slate-700" },
  { key: "UK_GENERAL", label: "UK General", color: "bg-slate-50 border-slate-200 text-slate-700", badge: "bg-slate-100 text-slate-600" },
  { key: "CA_WSIB", label: "WSIB (Canada)", color: "bg-orange-50 border-orange-300 text-orange-800", badge: "bg-orange-100 text-orange-800" },
  { key: "CA_WORKSAFEBC", label: "WorkSafeBC (Canada)", color: "bg-orange-50 border-orange-300 text-orange-800", badge: "bg-orange-100 text-orange-800" },
  { key: "CA_WCB_AB", label: "WCB Alberta (Canada)", color: "bg-orange-50 border-orange-300 text-orange-800", badge: "bg-orange-100 text-orange-800" },
  { key: "CA_EHB", label: "EHB (Canada)", color: "bg-purple-50 border-purple-300 text-purple-800", badge: "bg-purple-100 text-purple-800" },
  { key: "CA_VAC", label: "VAC (Canada)", color: "bg-yellow-50 border-yellow-300 text-yellow-800", badge: "bg-yellow-100 text-yellow-800" },
  { key: "NZ_ACC", label: "ACC (New Zealand)", color: "bg-green-50 border-green-300 text-green-800", badge: "bg-green-100 text-green-800" },
  { key: "NZ_DISABILITY", label: "Disability Support (NZ)", color: "bg-blue-50 border-blue-300 text-blue-800", badge: "bg-blue-100 text-blue-800" },
  { key: "NZ_PRIVATE", label: "Private Insurance (NZ)", color: "bg-purple-50 border-purple-300 text-purple-800", badge: "bg-purple-100 text-purple-800" },
  { key: "SG_HSG", label: "Healthier SG (Singapore)", color: "bg-green-50 border-green-300 text-green-800", badge: "bg-green-100 text-green-800" },
  { key: "SG_CDMP", label: "CDMP (Singapore)", color: "bg-green-50 border-green-300 text-green-800", badge: "bg-green-100 text-green-800" },
  { key: "SG_WICA", label: "WICA (Singapore)", color: "bg-orange-50 border-orange-300 text-orange-800", badge: "bg-orange-100 text-orange-800" },
  { key: "SG_PRIVATE", label: "Private Insurance (SG)", color: "bg-purple-50 border-purple-300 text-purple-800", badge: "bg-purple-100 text-purple-800" },
  { key: "IE_HSE", label: "HSE (Ireland)", color: "bg-green-50 border-green-300 text-green-800", badge: "bg-green-100 text-green-800" },
  { key: "IE_CARDIAC", label: "Cardiac Rehab (Ireland)", color: "bg-red-50 border-red-300 text-red-800", badge: "bg-red-100 text-red-800" },
  { key: "IE_LEGAL", label: "PIAB (Ireland)", color: "bg-slate-50 border-slate-400 text-slate-800", badge: "bg-slate-100 text-slate-700" },
  { key: "IE_PRIVATE", label: "Private Insurance (IE)", color: "bg-purple-50 border-purple-300 text-purple-800", badge: "bg-purple-100 text-purple-800" },
  { key: "IE_GENERAL", label: "General (IE)", color: "bg-slate-50 border-slate-200 text-slate-700", badge: "bg-slate-100 text-slate-600" },
  { key: "ZA_MEDAID", label: "Medical Aid (SA)", color: "bg-purple-50 border-purple-300 text-purple-800", badge: "bg-purple-100 text-purple-800" },
  { key: "ZA_COIDA", label: "COIDA (SA)", color: "bg-orange-50 border-orange-300 text-orange-800", badge: "bg-orange-100 text-orange-800" },
  { key: "ZA_RAF", label: "RAF (SA)", color: "bg-yellow-50 border-yellow-300 text-yellow-800", badge: "bg-yellow-100 text-yellow-800" },
  { key: "ZA_GEMS", label: "GEMS (SA)", color: "bg-blue-50 border-blue-300 text-blue-800", badge: "bg-blue-100 text-blue-800" },
  { key: "GENERAL", label: "General / Other", color: "bg-slate-50 border-slate-200 text-slate-700", badge: "bg-slate-100 text-slate-600" },
  { key: "CUSTOM", label: "Custom", color: "bg-slate-50 border-slate-200 text-slate-700", badge: "bg-slate-100 text-slate-600" },
];

const FUNDING_SOURCE_TO_FUNDER = {
  dva: "DVA", medicare: "MEDICARE", workcover_qld: "WORKCOVER", workcover: "WORKCOVER",
  workcover_nsw: "WORKCOVER_NSW", sira: "WORKCOVER_NSW", icare: "WORKCOVER_NSW",
  workcover_vic: "WORKCOVER_VIC", worksafe_vic: "WORKCOVER_VIC",
  workcover_sa: "WORKCOVER_SA", rtwsa: "WORKCOVER_SA",
  workcover_wa: "WORKCOVER_WA",
  private_health: "PRIVATE_HEALTH", ndis: "NDIS", tac_maic: "TAC", tac: "TAC",
  maic: "MAIC", ctp: "CTP", motor_accident: "CTP",
  aged_care: "AGED_CARE", hcp: "AGED_CARE", chsp: "CHSP",
  cardiac: "CARDIAC",
  legal: "LEGAL", tpd: "LEGAL", income_protection: "LEGAL",
  cancer: "CANCER",
  general: "GENERAL", usa: "USA",
};

function buildReportHtml(template, activeSections, content, client, clinician, dateRange) {
  const today = format(new Date(), "dd MMMM yyyy");
  const clientDOB = client.date_of_birth ? format(new Date(client.date_of_birth), "dd/MM/yyyy") : "N/A";
  const age = client.date_of_birth ? Math.floor((new Date() - new Date(client.date_of_birth)) / 31557600000) : null;
  const rangeStr = dateRange?.start && dateRange?.end
    ? `${format(new Date(dateRange.start), "dd/MM/yyyy")} â€“ ${format(new Date(dateRange.end), "dd/MM/yyyy")}`
    : today;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:40px;}
  .header{border-bottom:2px solid #1a56db;padding-bottom:16px;margin-bottom:24px;}
  .header h1{font-size:20px;color:#1a56db;margin:0 0 4px;}
  .header p{margin:2px 0;font-size:12px;color:#555;}
  .client-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;margin-bottom:24px;display:flex;flex-wrap:wrap;gap:16px;}
  .client-box span{font-size:12px;color:#444;}
  .client-box strong{color:#1e293b;}
  .section{margin-bottom:24px;page-break-inside:avoid;}
  .section h2{font-size:14px;color:#1a56db;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px;}
  .section p{margin:0;line-height:1.7;white-space:pre-wrap;}
  .sig-area{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:16px;}
  .sig-area img{max-width:200px;display:block;margin:8px 0;}
  .footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#999;text-align:center;}
  @media print{body{padding:20px;}}
</style></head><body>
<div class="header">
  <h1>${template.title}</h1>
  <p>Report Period: ${rangeStr}</p>
  <p>Date Generated: ${today}</p>
  ${clinician ? `<p>Clinician: ${clinician.full_name || ''}${clinician.profession ? ` â€” ${clinician.profession}` : ''}${clinician.provider_number ? ` | Provider #: ${clinician.provider_number}` : ''}</p>` : ''}
</div>
<div class="client-box">
  <span><strong>Client:</strong> ${client.full_name}</span>
  <span><strong>DOB:</strong> ${clientDOB}${age ? ` (${age}y)` : ''}</span>
  ${client.funding_source ? `<span><strong>Funding:</strong> ${client.funding_source.toUpperCase()}</span>` : ''}
  ${client.dva_card_number ? `<span><strong>DVA #:</strong> ${client.dva_card_number}</span>` : ''}
  ${client.ndis_number ? `<span><strong>NDIS #:</strong> ${client.ndis_number}</span>` : ''}
  ${client.medicare_number ? `<span><strong>Medicare #:</strong> ${client.medicare_number}</span>` : ''}
</div>
${activeSections.filter(s => !s.toLowerCase().includes('signature') && !s.toLowerCase().includes('attachment')).map(section => {
  const text = content[section];
  if (!text?.trim()) return '';
  return `<div class="section"><h2>${section}</h2><p>${text.trim()}</p></div>`;
}).join('')}
${activeSections.filter(s => s.toLowerCase().includes('signature')).map(section => {
  const text = content[section];
  const sig = content[`${section}_signature`];
  return `<div class="sig-area"><p style="white-space:pre-wrap;font-size:12px;">${text || ''}</p>${sig ? `<img src="${sig}" alt="Signature"/>` : ''}<div style="margin-top:16px;border-top:1px solid #555;width:200px;padding-top:4px;font-size:11px;color:#555;">Signature</div></div>`;
}).join('')}
<div class="footer">Generated by Allied Assess Â· Confidential Clinical Document</div>
</body></html>`;
}

// Step 0: Report type selector grouped by funder
function ReportTypeSelector({ client, value, onChange }) {
  const clientFunder = FUNDING_SOURCE_TO_FUNDER[client?.funding_source?.toLowerCase()] || null;
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const init = {};
    FUNDER_GROUPS.forEach(g => { init[g.key] = g.key === clientFunder || g.key === "GP" || g.key === "GENERAL"; });
    return init;
  });

  const toggleGroup = (key) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-3 pt-2 max-h-[58vh] overflow-y-auto pr-1">
      <p className="text-sm text-slate-600 mb-3">
        Select the report type for <strong>{client?.full_name}</strong>.
        {clientFunder && <span className="ml-1 text-blue-600 font-medium">Client's funding: {clientFunder}</span>}
      </p>
      {FUNDER_GROUPS.map(group => {
        const groupTemplates = Object.entries(REPORT_TEMPLATES).filter(([, t]) => t.funder === group.key);
        if (groupTemplates.length === 0) return null;
        const isClientFunder = group.key === clientFunder;
        const isExpanded = expandedGroups[group.key];
        return (
          <div key={group.key} className={`border rounded-lg overflow-hidden ${isClientFunder ? 'border-blue-400 shadow-sm' : 'border-slate-200'}`}>
            <button
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold ${isClientFunder ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 text-slate-700'}`}
              onClick={() => toggleGroup(group.key)}
            >
              <div className="flex items-center gap-2">
                {group.label}
                {isClientFunder && <Badge className="bg-blue-600 text-white text-xs">Client's Funder</Badge>}
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {isExpanded && (
              <div className="divide-y divide-slate-100">
                {groupTemplates.map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => onChange(key)}
                    className={`w-full text-left px-4 py-3 transition-colors ${value === key ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-50 text-slate-700'}`}
                  >
                    <p className="text-sm font-medium">{template.title}</p>
                    <p className={`text-xs mt-0.5 ${value === key ? 'text-blue-100' : 'text-slate-400'}`}>
                      {template.mandatory.slice(0, 3).join(' Â· ')}{template.mandatory.length > 3 ? ` Â· +${template.mandatory.length - 3} more` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function UnifiedReportWizard({ isOpen, onClose, client, clientData, clinician, existingReport, reportType: preselectedReportType }) {
  const [step, setStep] = useState(0);
  const [reportTypeKey, setReportTypeKey] = useState("");
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState([]);
  const [activeSections, setActiveSections] = useState([]);
  const [sectionContent, setSectionContent] = useState({});
  const [reportHtml, setReportHtml] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [priorReports, setPriorReports] = useState([]);
  const [soapNotes, setSoapNotes] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [clientAssessments, setClientAssessments] = useState([]);
  const [clientConditions, setClientConditions] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  const reportTemplate = REPORT_TEMPLATES[reportTypeKey];
  const isEditing = !!existingReport;

  const STEPS = isEditing
    ? ["Edit Sections", "Review & Export"]
    : ["Report Type", "Date Range", "Select Assessments", "Sections", "Review & Export"];
  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && existingReport) {
      const key = Object.entries(REPORT_TEMPLATES).find(([, t]) => t.id === existingReport.report_type)?.[0] || "custom_report";
      setReportTypeKey(key);
      const saved = existingReport.section_content || {};
      setSectionContent(saved);
      setActiveSections(existingReport.active_sections || REPORT_TEMPLATES[key]?.mandatory || []);
      setDateRange({ start: existingReport.date_range_start, end: existingReport.date_range_end });
      setSelectedAssessmentIds(existingReport.assessment_ids || []);
      setStep(0);
    } else if (preselectedReportType) {
      setReportTypeKey(preselectedReportType);
      setDateRange({ start: null, end: null });
      setSelectedAssessmentIds([]);
      const tmpl = REPORT_TEMPLATES[preselectedReportType];
      if (tmpl) {
        setActiveSections([...tmpl.mandatory]);
        const initial = {};
        tmpl.mandatory.forEach(s => { initial[s] = ""; });
        setSectionContent(initial);
      } else {
        const fallbackSections = ["Background & Referral", "Assessment Findings", "Goals", "Plan & Recommendations"];
        setActiveSections(fallbackSections);
        const initial = {};
        fallbackSections.forEach(s => { initial[s] = ""; });
        setSectionContent(initial);
      }
      setReportHtml("");
      setStep(1);
    } else {
      setStep(0);
      setReportTypeKey("");
      setDateRange({ start: null, end: null });
      setSelectedAssessmentIds([]);
      setActiveSections([]);
      setSectionContent({});
      setReportHtml("");
    }
  }, [isOpen, existingReport, preselectedReportType]);

  useEffect(() => {
    if (!reportTypeKey || isEditing) return;
    const tmpl = REPORT_TEMPLATES[reportTypeKey];
    if (tmpl) {
      setActiveSections([...tmpl.mandatory]);
      const initial = {};
      tmpl.mandatory.forEach(s => { initial[s] = ""; });
      setSectionContent(initial);
    } else {
      const fallbackSections = ["Background & Referral", "Assessment Findings", "Goals", "Plan & Recommendations"];
      setActiveSections(fallbackSections);
      const initial = {};
      fallbackSections.forEach(s => { initial[s] = ""; });
      setSectionContent(initial);
    }
  }, [reportTypeKey]);

  useEffect(() => {
    if (!client?.id || !isOpen) return;
    const fetchAssessments = async () => {
      setLoadingAssessments(true);
      try {
        const [results, conditions, assessmentLibrary] = await Promise.all([
          base44.entities.ClientAssessment.filter({ client_id: client.id }),
          base44.entities.ClientCondition.filter({ client_id: client.id }),
          base44.entities.Assessment.list(),
        ]);
        const libraryMap = {};
        (assessmentLibrary || []).forEach(a => { libraryMap[a.id] = a; });
        const enriched = results.map(ca => {
          const lib = libraryMap[ca.assessment_id];
          return { ...ca, name: ca.name || lib?.name || "Unknown Assessment", unit_of_measure: ca.unit_of_measure || lib?.unit_of_measure || "" };
        });
        const completed = enriched.filter(a =>
          a.status === "completed" ||
          (a.result_value !== null && a.result_value !== undefined) ||
          (a.additional_data && a.additional_data.soap_text)
        );
        completed.sort((a, b) => new Date(b.assessment_date || b.created_date) - new Date(a.assessment_date || a.created_date));
        setClientAssessments(completed);
        setClientConditions(conditions || []);
      } catch (e) {
        console.error("Failed to fetch assessments", e);
        setClientAssessments([]);
      } finally {
        setLoadingAssessments(false);
      }
    };
    fetchAssessments();
  }, [client?.id, isOpen]);

  useEffect(() => {
    if (!client?.id || !reportTypeKey) return;
    const loadContext = async () => {
      setLoadingContext(true);
      try {
        const depKeys = PRIOR_REPORT_DEPS[reportTypeKey] || [];
        const depTypeIds = depKeys.map(k => REPORT_TEMPLATES[k]?.id).filter(Boolean);
        const [allReports, allSoap] = await Promise.all([
          base44.entities.SavedReport.filter({ client_id: client.id }),
          base44.entities.SOAPNote.filter({ client_id: client.id }),
        ]);
        const relevant = depTypeIds.length > 0
          ? allReports.filter(r => depTypeIds.includes(r.report_type) && r.id !== existingReport?.id)
          : reportTypeKey === "progress_note" ? allReports : [];
        setPriorReports(relevant.sort((a, b) => new Date(b.report_date) - new Date(a.report_date)));
        setSoapNotes(allSoap.sort((a, b) => new Date(b.note_date) - new Date(a.note_date)));
      } catch (e) { console.error("Failed to load context", e); }
      finally { setLoadingContext(false); }
    };
    loadContext();
  }, [client?.id, reportTypeKey]);

  const handleAddSection = (sectionName) => {
    if (activeSections.includes(sectionName)) return;
    setActiveSections(prev => [...prev, sectionName]);
    setSectionContent(prev => ({ ...prev, [sectionName]: "" }));
  };

  const handleRemoveSection = (sectionName) => {
    const mandatory = reportTemplate?.mandatory || [];
    if (mandatory.includes(sectionName)) { toast.error("This is a mandatory section and cannot be removed."); return; }
    setActiveSections(prev => prev.filter(s => s !== sectionName));
  };

  const handleNext = () => {
    if (!isEditing && step === 0 && !reportTypeKey) { toast.error("Please select a report type"); return; }
    if (step === STEPS.length - 2) {
      const html = buildReportHtml(reportTemplate, activeSections, sectionContent, client, clinician, dateRange);
      setReportHtml(html);
    }
    setStep(s => Math.min(s + 1, totalSteps - 1));
  };
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const handleSave = async () => {
    if (!reportTemplate) return;
    setIsSaving(true);
    try {
      // Build HTML if not already built (safety net)
      const finalHtml = reportHtml || buildReportHtml(reportTemplate, activeSections, sectionContent, client, clinician, dateRange);

      const payload = {
        client_id: client.id,
        org_id: client.org_id,
        report_type: reportTemplate.id,
        report_name: reportTemplate.title,
        report_date: format(new Date(), "yyyy-MM-dd"),
        date_range_start: dateRange.start || null,
        date_range_end: dateRange.end || null,
        assessment_ids: selectedAssessmentIds || [],
        section_content: sectionContent,
        active_sections: activeSections,
        report_html: finalHtml,
        status: "final",
      };
      if (isEditing && existingReport?.id) {
        await base44.entities.SavedReport.update(existingReport.id, payload);
        toast.success("Report updated!");
      } else {
        await base44.entities.SavedReport.create(payload);
        toast.success("Report saved to client profile!");
      }
      onClose(true);
    } catch (error) {
      console.error("Failed to save report:", error);
      toast.error(`Failed to save report: ${error?.message || "Unknown error"}`);
    } finally { setIsSaving(false); }
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    win.document.write(reportHtml);
    win.document.close();
    win.print();
  };

  const SectionStep = () => {
    const optional = (reportTemplate?.optional || []).filter(s => !activeSections.includes(s));
    return (
      <div className="space-y-3">
        {optional.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
            <span className="text-xs text-slate-500 self-center">Add optional section:</span>
            {optional.map(s => (
              <button key={s} onClick={() => handleAddSection(s)}
                className="flex items-center gap-1 text-xs px-2 py-1 border border-dashed border-blue-300 text-blue-600 rounded hover:bg-blue-50">
                <Plus className="w-3 h-3" /> {s}
              </button>
            ))}
          </div>
        )}
        <SectionEditor
          sections={activeSections}
          content={sectionContent}
          onChange={setSectionContent}
          client={client}
          clientAssessments={clientAssessments}
          clientConditions={clientConditions}
          selectedAssessmentIds={selectedAssessmentIds}
          clinician={clinician}
          priorReports={priorReports}
          soapNotes={soapNotes}
          mandatorySections={reportTemplate?.mandatory || []}
          onRemoveSection={handleRemoveSection}
          reportTypeKey={reportTypeKey}
          reportTitle={reportTemplate?.title}
        />
      </div>
    );
  };

  const getStepContent = () => {
    if (isEditing) {
      if (step === 0) return <SectionStep />;
      if (step === 1) return <ReviewExport reportHtml={reportHtml} client={client} clinician={clinician} onEditHtml={setReportHtml} />;
    }
    switch (step) {
      case 0: return <ReportTypeSelector client={client} value={reportTypeKey} onChange={setReportTypeKey} />;
      case 1: return <SelectDateRange dateRange={dateRange} onChange={setDateRange} />;
      case 2: {
        const filteredAssessments = (dateRange?.start && dateRange?.end)
          ? clientAssessments.filter(a => {
              const d = new Date(a.assessment_date || a.created_date);
              return d >= new Date(dateRange.start) && d <= new Date(dateRange.end);
            })
          : clientAssessments;
        return (
          <SelectAssessments
            assessments={filteredAssessments}
            selectedIds={selectedAssessmentIds}
            onChange={setSelectedAssessmentIds}
            isLoading={loadingAssessments}
          />
        );
      }
      case 3: return <SectionStep />;
      case 4: return <ReviewExport reportHtml={reportHtml} client={client} clinician={clinician} onEditHtml={setReportHtml} />;
      default: return null;
    }
  };

  const isLastStep = step === totalSteps - 1;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose(false)}>
      <DialogContent className="max-w-4xl w-full max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-200 flex-shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-800">
            {isEditing ? `Edit Report â€” ${reportTemplate?.title}` : "Create Clinical Report"}
          </DialogTitle>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Step {step + 1} of {totalSteps} â€” {STEPS[step]}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {loadingContext && step >= (isEditing ? 0 : 2) && (
            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded px-3 py-2 mt-3">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading prior reports and SOAP notes for AI context...
            </div>
          )}
          {getStepContent()}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
          <Button variant="outline" onClick={step === 0 ? () => onClose(false) : handleBack} disabled={isSaving}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="flex gap-2">
            {isLastStep ? (
              <>
                <Button variant="outline" onClick={handlePrint} disabled={isSaving}>
                  <Printer className="w-4 h-4 mr-1" /> Print / PDF
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  {isEditing ? "Save Changes" : "Save Report"}
                </Button>
              </>
            ) : (
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 text-white">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}