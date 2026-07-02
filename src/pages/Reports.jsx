import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Client, OrganizationMember } from "@/entities/all";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, FileText, Users, ArrowRight, X,
  Clipboard, Loader2, Sparkles,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import UnifiedReportWizard from "@/components/reports/UnifiedReportWizard";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// REPORT TYPE DEFINITIONS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const australiaReportTypes = {
  gp_summary: { label: "GP Summary Letter", category: "general", description: "Summary for referring GP", region: "australia" },
  custom_report: { label: "Custom Report", category: "general", description: "Custom formatted report", region: "australia" },
  progress_note: { label: "Progress / Extra Report", category: "general", description: "Free-form progress update or additional report â€” pulls all prior history", region: "australia" },
  workcover_pmp: { label: "WorkCover PMP", category: "workcover", description: "Provisional Medical Plan", region: "australia" },
  workcover_progress: { label: "WorkCover Progress Report", category: "workcover", description: "Progress update for WorkCover", region: "australia" },
  workcover_discharge: { label: "WorkCover Discharge / RTW Summary", category: "workcover", description: "Discharge and return to work summary", region: "australia" },
  dva_patient_care_plan: { label: "DVA Patient Care Plan", category: "dva", description: "Initial care plan for DVA clients", region: "australia" },
  dva_end_cycle_report: { label: "DVA End of Cycle Report", category: "dva", description: "Cycle completion summary", region: "australia" },
  medicare_referral_acceptance: { label: "Medicare Referral Acceptance", category: "medicare", description: "Acknowledge receipt of referral", region: "australia" },
  medicare_initial: { label: "Medicare Initial Assessment", category: "medicare", description: "Initial assessment letter", region: "australia" },
  medicare_final: { label: "Medicare Final Report", category: "medicare", description: "Treatment conclusion letter", region: "australia" },
  private_health_initial: { label: "Private Health Initial Assessment", category: "private_health", description: "Initial assessment for private health", region: "australia" },
  private_health_progress: { label: "Private Health Progress Report", category: "private_health", description: "Progress update for private health", region: "australia" },
  ndis_initial: { label: "NDIS Initial Assessment", category: "ndis", description: "Initial functional assessment", region: "australia" },
  ndis_progress: { label: "NDIS Progress Report", category: "ndis", description: "Progress update aligned to NDIS goals", region: "australia" },
  ndis_fce: { label: "NDIS Functional Capacity Evaluation", category: "ndis", description: "Comprehensive FCE across 7 NDIS domains", region: "australia" },
  ndis_discharge: { label: "NDIS Discharge / Transition Summary", category: "ndis", description: "Discharge summary with outcomes and recommendations", region: "australia" },
  sira_initial: { label: "NSW SIRA Initial Assessment", category: "workcover_nsw", description: "Initial assessment for NSW icare / SIRA clients", region: "australia" },
  sira_ahtr: { label: "NSW SIRA â€” Allied Health Treatment Request (AHTR)", category: "workcover_nsw", description: "Treatment request for sessions beyond initial approval", region: "australia" },
  sira_progress: { label: "NSW SIRA Progress Report", category: "workcover_nsw", description: "Progress update for NSW SIRA / icare", region: "australia" },
  sira_discharge: { label: "NSW SIRA Discharge Summary", category: "workcover_nsw", description: "Discharge summary for NSW SIRA", region: "australia" },
  worksafe_vic_initial: { label: "WorkSafe VIC Initial Assessment", category: "workcover_vic", description: "Initial assessment for WorkSafe Victoria clients", region: "australia" },
  worksafe_vic_progress: { label: "WorkSafe VIC Progress Report", category: "workcover_vic", description: "Progress update for WorkSafe VIC", region: "australia" },
  worksafe_vic_discharge: { label: "WorkSafe VIC Discharge Summary", category: "workcover_vic", description: "Discharge summary for WorkSafe VIC", region: "australia" },
  rtwsa_initial: { label: "ReturnToWorkSA Initial Assessment", category: "workcover_sa", description: "Initial assessment for ReturnToWorkSA clients", region: "australia" },
  rtwsa_progress: { label: "ReturnToWorkSA Progress Report", category: "workcover_sa", description: "Progress update for ReturnToWorkSA", region: "australia" },
  rtwsa_discharge: { label: "ReturnToWorkSA Discharge Summary", category: "workcover_sa", description: "Discharge summary for ReturnToWorkSA", region: "australia" },
  wa_workcover_initial: { label: "WorkCover WA Initial Assessment", category: "workcover_wa", description: "Initial assessment for WorkCover WA clients", region: "australia" },
  wa_workcover_progress: { label: "WorkCover WA Progress Report", category: "workcover_wa", description: "Progress update for WorkCover WA", region: "australia" },
  wa_workcover_discharge: { label: "WorkCover WA Discharge Summary", category: "workcover_wa", description: "Discharge summary for WorkCover WA", region: "australia" },
  tac_functional: { label: "TAC Functional Assessment / AHTRP", category: "tac_maic", description: "TAC Allied Health Treatment & Recovery Plan", region: "australia" },
  tac_progress: { label: "TAC Progress Report", category: "tac_maic", description: "Progress update for TAC VIC clients", region: "australia" },
  tac_discharge: { label: "TAC Discharge Summary", category: "tac_maic", description: "Discharge summary for TAC VIC clients", region: "australia" },
  maic_initial: { label: "MAIC QLD Initial Assessment", category: "tac_maic", description: "Initial assessment for MAIC QLD CTP clients", region: "australia" },
  maic_progress: { label: "MAIC QLD Progress Report", category: "tac_maic", description: "Progress update for MAIC QLD clients", region: "australia" },
  maic_discharge: { label: "MAIC QLD Discharge Summary", category: "tac_maic", description: "Discharge summary for MAIC QLD clients", region: "australia" },
  ctp_initial: { label: "CTP Motor Accident â€” Initial Assessment", category: "ctp", description: "Initial assessment for other-state CTP motor accident clients", region: "australia" },
  ctp_progress: { label: "CTP Motor Accident â€” Progress Report", category: "ctp", description: "Progress update for CTP clients", region: "australia" },
  ctp_discharge: { label: "CTP Motor Accident â€” Discharge Summary", category: "ctp", description: "Discharge summary for CTP clients", region: "australia" },
  aged_care_assessment: { label: "Aged Care Assessment", category: "aged_care", description: "Functional assessment for aged care", region: "australia" },
  hcp_initial: { label: "HCP â€” Initial Functional Assessment", category: "aged_care", description: "Initial assessment for Home Care Package clients", region: "australia" },
  hcp_care_plan: { label: "HCP â€” Individual Care Plan", category: "aged_care", description: "Individual care plan for HCP clients", region: "australia" },
  hcp_annual_review: { label: "HCP â€” Annual Review", category: "aged_care", description: "Annual review for Home Care Package clients", region: "australia" },
  chsp_initial: { label: "CHSP Initial Assessment", category: "chsp", description: "Initial assessment for CHSP clients", region: "australia" },
  chsp_support_plan: { label: "CHSP Support Plan", category: "chsp", description: "Support plan for CHSP clients", region: "australia" },
  legal_fce: { label: "Functional Capacity Evaluation (FCE)", category: "legal", description: "Comprehensive FCE for legal / insurance / TPD", region: "australia" },
  legal_medico: { label: "Medico-Legal / Independent Medical Report", category: "legal", description: "Medico-legal report for solicitors / insurers", region: "australia" },
  cancer_initial: { label: "Cancer / Oncology â€” Initial Assessment", category: "cancer", description: "Initial assessment for cancer exercise programs", region: "australia" },
  cancer_progress: { label: "Cancer / Oncology â€” Progress Report", category: "cancer", description: "Progress update for cancer exercise program clients", region: "australia" },
};

const usaReportTypes = {
  us_initial_evaluation: { label: "Initial Evaluation / Examination", category: "common_usa", description: "Start of care episode; establishes medical necessity and baseline function", region: "usa", payers: ["Medicare Part B", "VA", "Workers' Comp", "Commercial", "Medicaid", "TRICARE"] },
  us_plan_of_care: { label: "Plan of Care / Certification", category: "common_usa", description: "Certified plan of care or physician/NPP review", region: "usa", payers: ["Medicare Part B", "Commercial", "Medicaid"] },
  us_progress_report: { label: "Progress Report / Re-examination", category: "common_usa", description: "Periodic reporting; demonstrates progress and ongoing skilled need", region: "usa", payers: ["Medicare Part B", "VA", "Workers' Comp", "Commercial", "Medicaid", "TRICARE"] },
  us_discharge_summary: { label: "Discharge Summary", category: "common_usa", description: "End of episode; documents outcomes, status, and recommendations", region: "usa", payers: ["Medicare Part B", "VA", "Workers' Comp", "Commercial", "Medicaid", "TRICARE"] },
  us_prior_auth: { label: "Prior Authorization / Medical Necessity Packet", category: "authorization", description: "Pre-auth or ongoing authorization for commercial/Medicaid plans", region: "usa", payers: ["Commercial", "Medicaid"] },
  progress_note: { label: "Progress / Extra Report", category: "general", description: "Free-form progress update or additional report â€” pulls all prior history", region: "usa" },
};

const ukReportTypes = {
  uk_nhs_ers_initial: { label: "NHS ERS â€” Initial Assessment", category: "nhs_ers", description: "Baseline fitness, health screen, contraindications and goals for NHS Exercise Referral", region: "uk" },
  uk_nhs_ers_progress: { label: "NHS ERS â€” Progress Report", category: "nhs_ers", description: "Mid-programme update to referring GP or practice nurse", region: "uk" },
  uk_nhs_ers_completion: { label: "NHS ERS â€” Completion / Discharge Report", category: "nhs_ers", description: "Programme outcomes, adherence, and recommendations for ongoing activity", region: "uk" },
  uk_cardiac_initial: { label: "Cardiac Rehab â€” Initial Clinical Assessment", category: "cardiac", description: "BACPR-aligned initial assessment: CPET, risk stratification, goals", region: "uk" },
  uk_cardiac_completion: { label: "Cardiac Rehab â€” Phase III Completion Report", category: "cardiac", description: "Discharge outcomes including exercise capacity change and risk factor improvements", region: "uk" },
  uk_cardiac_phase4: { label: "Cardiac Rehab â€” Phase IV Referral Letter", category: "cardiac", description: "Onward referral to community maintenance programme", region: "uk" },
  uk_pulmonary_initial: { label: "Pulmonary Rehab â€” Initial Assessment", category: "pulmonary", description: "Spirometry, MRC dyspnoea, ISWT/6MWT, SGRQ/CAT baseline", region: "uk" },
  uk_pulmonary_completion: { label: "Pulmonary Rehab â€” Completion Report", category: "pulmonary", description: "Outcome measures, exercise capacity change, PROM scores, onward referral", region: "uk" },
  uk_cancer_initial: { label: "Cancer Rehab â€” Initial Exercise Assessment", category: "cancer_uk", description: "MOVE More / NHS cancer exercise initial assessment with HNA", region: "uk" },
  uk_cancer_progress: { label: "Cancer Rehab â€” Progress Report", category: "cancer_uk", description: "Attendance, exercise capacity, and wellbeing outcomes for cancer rehab", region: "uk" },
  uk_cancer_completion: { label: "Cancer Rehab â€” End-of-Programme Report", category: "cancer_uk", description: "Outcomes, recommendations, and onward referral for cancer exercise programme", region: "uk" },
  uk_pmi_initial: { label: "PMI â€” Initial Assessment / Consultation Report", category: "pmi", description: "Initial assessment for BUPA, AXA Health, Aviva, Vitality or other PMI", region: "uk" },
  uk_pmi_progress: { label: "PMI â€” Progress Report", category: "pmi", description: "Progress update for private medical insurance re-authorisation", region: "uk" },
  uk_pmi_discharge: { label: "PMI â€” Discharge Report", category: "pmi", description: "Discharge summary for private medical insurance", region: "uk" },
  uk_fce: { label: "FCE / Work Capacity Assessment", category: "legal_uk", description: "Functional capacity evaluation for DWP, occupational health, or employer RTW", region: "uk" },
  uk_rtw_progress: { label: "Return to Work Progress Report", category: "legal_uk", description: "Functional progress report for employer, HR or occupational health", region: "uk" },
  uk_gp_summary: { label: "GP / Specialist Summary Letter", category: "general_uk", description: "Clinical summary letter to referring GP or specialist", region: "uk" },
  progress_note: { label: "Progress / Extra Report", category: "general_uk", description: "Free-form progress update or additional report", region: "uk" },
};

const canadaReportTypes = {
  ca_wsib_initial: { label: "WSIB â€” Initial Assessment Report", category: "wsib", description: "Initial assessment for Ontario WSIB workplace injury claims", region: "canada" },
  ca_wsib_faf: { label: "WSIB â€” Functional Abilities Form (FAF)", category: "wsib", description: "WSIB-required FAF (Form 2647A) for functional tolerances and work status", region: "canada" },
  ca_wsib_progress: { label: "WSIB â€” Progress Report", category: "wsib", description: "Functional progress update for WSIB case manager", region: "canada" },
  ca_wsib_rtw: { label: "WSIB â€” Return-to-Work Summary", category: "wsib", description: "RTW readiness and discharge summary for WSIB Ontario", region: "canada" },
  ca_worksafebc_initial: { label: "WorkSafeBC â€” Initial Assessment", category: "worksafebc", description: "Initial assessment for WorkSafeBC workplace injury claims (BC)", region: "canada" },
  ca_worksafebc_fca: { label: "WorkSafeBC â€” Functional Capacity Assessment (FCA)", category: "worksafebc", description: "Standardised FCA report for WorkSafeBC", region: "canada" },
  ca_worksafebc_progress: { label: "WorkSafeBC â€” Progress Report", category: "worksafebc", description: "Functional progress update for WorkSafeBC adjudicator", region: "canada" },
  ca_wcb_alberta_initial: { label: "WCB Alberta â€” Initial Assessment", category: "wcb_ab", description: "Initial assessment for WCB Alberta workplace injury claims", region: "canada" },
  ca_wcb_alberta_fce: { label: "WCB Alberta â€” Functional Capacity Evaluation (FCE)", category: "wcb_ab", description: "FCE report for WCB Alberta claim resolution or dispute", region: "canada" },
  ca_wcb_alberta_progress: { label: "WCB Alberta â€” Progress Report", category: "wcb_ab", description: "Functional progress update for WCB Alberta adjudicator", region: "canada" },
  ca_ehb_initial: { label: "Extended Health Benefits â€” Initial Assessment", category: "ehb", description: "Initial assessment summary for group insurance / EHB providers", region: "canada" },
  ca_ehb_progress: { label: "Extended Health Benefits â€” Progress Report", category: "ehb", description: "Progress report for EHB pre-approval of additional sessions", region: "canada" },
  ca_vac_initial: { label: "Veterans Affairs Canada â€” Initial Assessment", category: "vac", description: "Initial assessment for VAC rehabilitation programme", region: "canada" },
  ca_vac_progress: { label: "Veterans Affairs Canada â€” Progress Report", category: "vac", description: "Progress update for VAC case manager", region: "canada" },
  progress_note: { label: "Progress / Extra Report", category: "general_ca", description: "Free-form progress update or additional report", region: "canada" },
};

const nzReportTypes = {
  nz_acc_initial: { label: "ACC â€” Initial Assessment Report", category: "acc", description: "Initial assessment for ACC injury claim â€” injury, functional status, goals, treatment plan", region: "nz" },
  nz_acc_progress: { label: "ACC â€” Progress Report (ACC32 Extension)", category: "acc", description: "Progress report submitted with ACC32 prior approval extension request", region: "nz" },
  nz_acc_fce: { label: "ACC â€” Functional Capacity Evaluation (FCE)", category: "acc", description: "FCE report requested by ACC case manager at claim resolution", region: "nz" },
  nz_acc_discharge: { label: "ACC â€” Discharge / Completion Summary", category: "acc", description: "Discharge summary at end of ACC-funded treatment", region: "nz" },
  nz_disability_initial: { label: "Disability Support â€” Functional Assessment", category: "disability_nz", description: "Functional assessment report for Ministry of Health / Whaikaha disability support", region: "nz" },
  nz_private_initial: { label: "Private Insurance â€” Initial Assessment", category: "private_nz", description: "Initial assessment for Southern Cross, NIB, or AIA NZ private health insurance", region: "nz" },
  nz_private_progress: { label: "Private Insurance â€” Progress Report", category: "private_nz", description: "Progress update for private health insurance re-authorisation", region: "nz" },
  progress_note: { label: "Progress / Extra Report", category: "general_nz", description: "Free-form progress update or additional report", region: "nz" },
};

const singaporeReportTypes = {
  sg_healthiersg_initial: { label: "Healthier SG â€” Initial Assessment Report", category: "healthiersg", description: "Initial allied health assessment aligned to patient's Healthier SG Health Plan", region: "singapore" },
  sg_healthiersg_progress: { label: "Healthier SG â€” Programme Progress Report", category: "healthiersg", description: "Progress update aligned to Healthier SG health plan goals", region: "singapore" },
  sg_healthiersg_completion: { label: "Healthier SG â€” Completion / Discharge Report", category: "healthiersg", description: "Programme outcomes and completion summary for Healthier SG", region: "singapore" },
  sg_cdmp_initial: { label: "CDMP â€” Initial Exercise Assessment", category: "cdmp", description: "Initial assessment for CDMP/MediSave chronic disease management programme", region: "singapore" },
  sg_cdmp_progress: { label: "CDMP â€” Progress / Review Report", category: "cdmp", description: "Progress update for CDMP programme with chronic disease outcome measures", region: "singapore" },
  sg_cdmp_discharge: { label: "CDMP â€” Discharge Summary", category: "cdmp", description: "Discharge summary with chronic disease outcomes (HbA1c, BP, lipids)", region: "singapore" },
  sg_wica_initial: { label: "WICA â€” Work Injury Assessment", category: "wica", description: "Functional assessment for WICA work injury compensation claim", region: "singapore" },
  sg_wica_rtw: { label: "WICA â€” Return-to-Work Plan", category: "wica", description: "RTW plan documentation for Ministry of Manpower work injury claim", region: "singapore" },
  sg_corporate_initial: { label: "Corporate / Private Insurance â€” Initial Assessment", category: "private_sg", description: "Initial assessment for corporate group health scheme or private insurer", region: "singapore" },
  progress_note: { label: "Progress / Extra Report", category: "general_sg", description: "Free-form progress update or additional report", region: "singapore" },
};

const irelandReportTypes = {
  ie_hse_initial: { label: "HSE â€” Initial Assessment Report", category: "hse", description: "Initial assessment for HSE-commissioned cardiac, pulmonary, or cancer rehab programme", region: "ireland" },
  ie_hse_progress: { label: "HSE â€” Progress Review Report", category: "hse", description: "Progress review note for HSE programme", region: "ireland" },
  ie_hse_discharge: { label: "HSE â€” Discharge Summary", category: "hse", description: "Discharge summary for HSE-funded exercise physiology programme", region: "ireland" },
  ie_cardiac_initial: { label: "Cardiac Rehab â€” Initial Assessment", category: "cardiac_ie", description: "Irish Heart Foundation-aligned cardiac rehab initial assessment", region: "ireland" },
  ie_cardiac_completion: { label: "Cardiac Rehab â€” Completion Report", category: "cardiac_ie", description: "Cardiac rehab phase completion report with outcomes", region: "ireland" },
  ie_piab_fce: { label: "PIAB â€” Functional Capacity Report", category: "piab", description: "Functional assessment / expert report for PIAB personal injury claim", region: "ireland" },
  ie_private_initial: { label: "Private Health â€” Initial Assessment", category: "private_ie", description: "Initial assessment for VHI, Laya Healthcare or Irish Life Health", region: "ireland" },
  ie_private_progress: { label: "Private Health â€” Progress Report", category: "private_ie", description: "Progress update for VHI / Laya / Irish Life Health re-authorisation", region: "ireland" },
  ie_private_discharge: { label: "Private Health â€” Discharge Summary", category: "private_ie", description: "Discharge summary for private health insurance", region: "ireland" },
  ie_gp_summary: { label: "GP / Specialist Summary Letter", category: "general_ie", description: "Clinical summary letter to referring GP or specialist", region: "ireland" },
  progress_note: { label: "Progress / Extra Report", category: "general_ie", description: "Free-form progress update or additional report", region: "ireland" },
};

const southAfricaReportTypes = {
  za_medaid_initial: { label: "Medical Aid â€” Initial Assessment Report", category: "medaid", description: "Initial assessment for South African medical aid scheme (Discovery, Momentum, Bonitas etc.)", region: "southafrica" },
  za_medaid_progress: { label: "Medical Aid â€” Progress / Review Report", category: "medaid", description: "Progress update for medical aid scheme re-authorisation", region: "southafrica" },
  za_medaid_discharge: { label: "Medical Aid â€” Discharge Summary", category: "medaid", description: "Discharge summary for medical aid scheme", region: "southafrica" },
  za_coida_initial: { label: "COIDA â€” Initial Assessment & Treatment Plan", category: "coida", description: "Initial assessment supporting COIDA/Compensation Fund workplace injury claim", region: "southafrica" },
  za_coida_progress: { label: "COIDA â€” Functional Progress Report", category: "coida", description: "Functional progress update supporting WCL5 progress medical report", region: "southafrica" },
  za_coida_rtw: { label: "COIDA â€” Return-to-Work / Functional Capacity Report", category: "coida", description: "RTW and FCE report for Compensation Fund claim resolution", region: "southafrica" },
  za_raf_initial: { label: "RAF â€” Road Accident Initial Assessment", category: "raf", description: "Initial assessment for Road Accident Fund motor vehicle injury claim", region: "southafrica" },
  za_raf_progress: { label: "RAF â€” Progress Report", category: "raf", description: "Progress update for RAF motor accident injury claim", region: "southafrica" },
  za_gems_initial: { label: "GEMS â€” Initial Assessment", category: "gems", description: "Initial assessment for GEMS government employees medical scheme", region: "southafrica" },
  za_gems_progress: { label: "GEMS â€” Progress Report", category: "gems", description: "Progress update for GEMS scheme re-authorisation", region: "southafrica" },
  progress_note: { label: "Progress / Extra Report", category: "general_za", description: "Free-form progress update or additional report", region: "southafrica" },
};

const reportTypesMap = {
  australia: australiaReportTypes,
  usa: usaReportTypes,
  uk: ukReportTypes,
  canada: canadaReportTypes,
  nz: nzReportTypes,
  singapore: singaporeReportTypes,
  ireland: irelandReportTypes,
  southafrica: southAfricaReportTypes,
};

const allReportTypes = {
  ...australiaReportTypes,
  ...usaReportTypes,
  ...ukReportTypes,
  ...canadaReportTypes,
  ...nzReportTypes,
  ...singaporeReportTypes,
  ...irelandReportTypes,
  ...southAfricaReportTypes,
};

const fundingSourceLabels = {
  dva: "DVA", private_health: "Private Health", medicare: "Medicare",
  workcover_qld: "WorkCover QLD", ndis: "NDIS", tac_maic: "TAC/MAIC",
  aged_care: "Aged Care", my_aged_care: "My Aged Care",
  self_funded: "Self-Funded", other: "Other",
};

const intlDefaults = {
  usa: ["us_initial_evaluation", "us_progress_report", "us_discharge_summary"],
  uk: ["uk_nhs_ers_initial", "uk_nhs_ers_completion", "uk_gp_summary"],
  canada: ["ca_wsib_initial", "ca_wsib_faf", "ca_ehb_initial"],
  nz: ["nz_acc_initial", "nz_acc_progress", "nz_acc_discharge"],
  singapore: ["sg_healthiersg_initial", "sg_cdmp_initial", "sg_cdmp_progress"],
  ireland: ["ie_hse_initial", "ie_private_initial", "ie_gp_summary"],
  southafrica: ["za_medaid_initial", "za_medaid_progress", "za_coida_initial"],
};

const australiaRecommendations = {
  dva: ["dva_patient_care_plan", "dva_end_cycle_report", "gp_summary"],
  medicare: ["medicare_referral_acceptance", "medicare_initial", "medicare_final", "gp_summary"],
  private_health: ["private_health_initial", "private_health_progress", "gp_summary"],
  workcover_qld: ["workcover_pmp", "workcover_progress", "gp_summary"],
  ndis: ["ndis_initial", "gp_summary"],
  tac_maic: ["tac_functional", "gp_summary"],
  aged_care: ["aged_care_assessment", "gp_summary"],
  my_aged_care: ["aged_care_assessment", "gp_summary"],
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN PAGE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Reports() {
  const [clients, setClients] = useState([]);
  const [userOrgId, setUserOrgId] = useState(null);
  const [filteredClients, setFilteredClients] = useState([]);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedReportInfo, setSelectedReportInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRecentClients, setShowRecentClients] = useState(true);
  const [editingReport, setEditingReport] = useState(null);
  const [activeTab, setActiveTab] = useState("australia");
  const [showWizard, setShowWizard] = useState(false);

  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("clientId");
  const editReportId = searchParams.get("editReportId");

  const reportTypes = reportTypesMap[activeTab] || australiaReportTypes;

  const getRecommendedReports = () => {
    if (!selectedClient) return [];
    if (activeTab !== "australia") return intlDefaults[activeTab] || [];
    const recs = australiaRecommendations[selectedClient.funding_source] || ["gp_summary", "custom_report"];
    if (!recs.includes("progress_note")) recs.push("progress_note");
    return recs;
  };

  const getOtherReports = () => {
    const recommended = getRecommendedReports();
    return Object.keys(reportTypes).filter(type => !recommended.includes(type));
  };

  useEffect(() => { fetchCurrentUserOrg(); }, []);
  useEffect(() => { if (userOrgId) loadClients(); }, [userOrgId]);

  const [currentUser, setCurrentUser] = useState(null);

  const fetchCurrentUserOrg = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
      const memberships = await OrganizationMember.filter({ user_email: user.email });
      if (memberships.length > 0) {
        const primary = memberships.find(m => m.is_primary) || memberships[0];
        setUserOrgId(primary.org_id);
      } else {
        setUserOrgId(null);
        toast.error("You don't belong to any organization. Please contact support.");
      }
    } catch (error) {
      toast.error("Failed to load user organization.");
    }
  };

  useEffect(() => {
    if (clientId && clients.length > 0 && !selectedClient) {
      const pre = clients.find(c => c.id === clientId);
      if (pre) setSelectedClient(pre);
    }
  }, [clientId, clients, selectedClient]);

  useEffect(() => {
    if (editReportId && selectedClient) loadReportForEditing();
  }, [editReportId, selectedClient]);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await Client.filter({ org_id: userOrgId });
      setClients(data);
    } catch (error) {
      toast.error("Failed to load client list.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadReportForEditing = async () => {
    try {
      const reports = await base44.entities.SavedReport.filter({ id: editReportId });
      if (reports.length > 0) {
        const report = reports[0];
        setEditingReport(report);
        const matchingType = allReportTypes[report.report_type];
        setSelectedReportInfo({
          type: matchingType ? "form" : "custom",
          id: report.report_type || "custom_report",
          name: matchingType?.label || "Custom Report",
          description: matchingType?.description || "Editing a previously saved custom report.",
        });
        setShowWizard(true);
      }
    } catch (error) {
      toast.error("Failed to load report for editing.");
    }
  };

  useEffect(() => {
    if (clientSearchTerm) {
      setFilteredClients(clients.filter(c => c.full_name.toLowerCase().includes(clientSearchTerm.toLowerCase())));
      setShowRecentClients(false);
    } else {
      setFilteredClients([]);
      setShowRecentClients(true);
    }
  }, [clientSearchTerm, clients]);

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearchTerm("");
    setFilteredClients([]);
    setShowRecentClients(false);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setSelectedReportInfo(null);
    setEditingReport(null);
    setShowRecentClients(true);
  };

  const handleSelectReportType = (reportTypeId) => {
    setSelectedReportInfo({ id: reportTypeId });
    setShowWizard(true);
  };

  const recentClients = [...clients].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 10);
  const recommendedReports = getRecommendedReports();
  const otherReports = getOtherReports();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Report Generator</h1>
              <p className="text-slate-600">Select a region and client to generate reports.</p>
            </div>
          </div>

          {/* Region Selector */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardContent className="pt-6 pb-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex flex-wrap gap-1 h-auto p-1">
                  <TabsTrigger value="australia" className="text-sm">ðŸ‡¦ðŸ‡º Australia</TabsTrigger>
                  <TabsTrigger value="usa" className="text-sm">ðŸ‡ºðŸ‡¸ USA</TabsTrigger>
                  <TabsTrigger value="uk" className="text-sm">ðŸ‡¬ðŸ‡§ UK</TabsTrigger>
                  <TabsTrigger value="canada" className="text-sm">ðŸ‡¨ðŸ‡¦ Canada</TabsTrigger>
                  <TabsTrigger value="nz" className="text-sm">ðŸ‡³ðŸ‡¿ New Zealand</TabsTrigger>
                  <TabsTrigger value="singapore" className="text-sm">ðŸ‡¸ðŸ‡¬ Singapore</TabsTrigger>
                  <TabsTrigger value="ireland" className="text-sm">ðŸ‡®ðŸ‡ª Ireland</TabsTrigger>
                  <TabsTrigger value="southafrica" className="text-sm">ðŸ‡¿ðŸ‡¦ South Africa</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* Step 1: Client Selection */}
          {!selectedClient ? (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="text-blue-600" />
                  Step 1: Select a Client
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Search for a client by name..."
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                    {filteredClients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredClients.map((client) => (
                          <div key={client.id} className="p-3 hover:bg-slate-100 cursor-pointer" onClick={() => handleSelectClient(client)}>
                            {client.full_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {showRecentClients && recentClients.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Clients</h3>
                      <div className="grid gap-2 max-h-60 overflow-y-auto">
                        {recentClients.map(client => (
                          <div key={client.id} className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleSelectClient(client)}>
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-slate-900">{client.full_name}</p>
                                <p className="text-sm text-slate-600">{client.email}</p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Step 2: Report Type Selection */
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clipboard className="text-blue-600" />
                  Step 2: Select a Report Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                  <div>
                    <p className="font-semibold text-blue-800">Selected Client: {selectedClient.full_name}</p>
                    <p className="text-sm text-blue-600">
                      Funding: <Badge variant="secondary" className="capitalize">{fundingSourceLabels[selectedClient.funding_source] || "N/A"}</Badge>
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleClearClient}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {recommendedReports.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                        <h4 className="font-semibold text-slate-900">
                          {activeTab === "australia"
                            ? `Recommended for ${fundingSourceLabels[selectedClient.funding_source] || "This Client"}`
                            : `Common ${activeTab === "nz" ? "New Zealand" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Reports`}
                        </h4>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        {recommendedReports.map((reportTypeId) => {
                          const reportType = reportTypes[reportTypeId];
                          if (!reportType) return null;
                          return (
                            <button key={reportTypeId} onClick={() => handleSelectReportType(reportTypeId)}
                              className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-left group">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium text-slate-900 group-hover:text-blue-700">{reportType.label}</h5>
                                  <p className="text-xs text-slate-600 mt-1">{reportType.description}</p>
                                  {reportType.payers && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {reportType.payers.slice(0, 3).map((payer) => (
                                        <Badge key={payer} variant="outline" className="text-xs">{payer}</Badge>
                                      ))}
                                      {reportType.payers.length > 3 && (
                                        <Badge variant="outline" className="text-xs">+{reportType.payers.length - 3} more</Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {otherReports.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3">Other Report Formats</h4>
                      <p className="text-sm text-slate-600 mb-3">Need a different format? Generate reports for other funding sources or purposes.</p>
                      <div className="grid md:grid-cols-2 gap-3">
                        {otherReports.map((reportTypeId) => {
                          const reportType = reportTypes[reportTypeId];
                          if (!reportType) return null;
                          return (
                            <button key={reportTypeId} onClick={() => handleSelectReportType(reportTypeId)}
                              className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-left">
                              <h5 className="font-medium text-slate-900">{reportType.label}</h5>
                              <p className="text-xs text-slate-600 mt-1">{reportType.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {selectedClient && selectedReportInfo && (
        <UnifiedReportWizard
          key={showWizard ? `${selectedReportInfo?.id}-open` : 'closed'}
          isOpen={showWizard}
          onClose={(saved) => {
            setShowWizard(false);
            setSelectedReportInfo(null);
            setEditingReport(null);
            if (saved) {
              toast.success("Report saved to client profile!");
            }
          }}
          client={selectedClient}
          reportType={selectedReportInfo.id}
          existingReport={editingReport}
          clinician={currentUser}
        />
      )}
    </>
  );
}