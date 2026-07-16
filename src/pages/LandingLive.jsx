import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate, Link } from "react-router-dom";

// Icon map by funder tag
const tagIcon = (tag) => {
  const map = { "WorkCover": "🦺", "WorkCover NSW": "🦺", "WorkSafe VIC": "🦺", "ReturnToWorkSA": "🦺", "WorkCover WA": "🦺", "DVA": "🎖", "Medicare": "❤", "NDIS": "♿", "TAC": "🚗", "MAIC": "🚗", "CTP": "🚗", "Aged Care": "👴", "CHSP": "👴", "HCP": "👴", "Legal / FCE": "⚖", "Medico-Legal": "⚖", "Cancer": "🎗", "Cardiac": "❤", "GP / General": "🏥", "Private Health": "🏥", "ACC": "🚗", "Disability": "♿", "WSIB": "🦺", "WorkSafeBC": "🦺", "WCB Alberta": "🦺", "EHB": "🏥", "VAC": "🎖", "NHS": "🏥", "Cardiac UK": "❤", "Pulmonary": "🫁", "Cancer UK": "🎗", "PMI": "🏥", "RTW UK": "🦺", "FCE UK": "⚖", "HealthierSG": "❤", "CDMP": "❤", "WICA": "🦺", "Corporate": "🏥", "HSE": "🏥", "Cardiac IE": "❤", "PIAB": "⚖", "Private IE": "🏥", "Medical Aid": "🏥", "COIDA": "🦺", "RAF": "🚗", "GEMS": "🏥" };
  return map[tag] || "📄";
};

const countryData = {
  au: [
    { icon: "🏥", tag: "GP / General", title: "GP Summary Letter", desc: "Brief update to referring GP summarising interventions and next steps." },
    { icon: "📄", tag: "GP / General", title: "Progress / Extra Report", desc: "Free-form progress update or additional report — pulls all prior history." },
    { icon: "📄", tag: "GP / General", title: "Custom Report", desc: "Custom formatted report — choose any sections and tailor to any referrer or funder." },
    { icon: "🦺", tag: "WorkCover", title: "WorkCover PMP", desc: "Pain management program report documenting injury background, functional capacity, goals, and RTW plan." },
    { icon: "🦺", tag: "WorkCover", title: "WorkCover Progress Report", desc: "Interval progress report with baseline vs current outcome measures and updated RTW recommendations." },
    { icon: "🦺", tag: "WorkCover", title: "WorkCover Discharge / RTW Summary", desc: "Final RTW summary including treatment outcomes, final work capacity, and self-management plan." },
    { icon: "🦺", tag: "WorkCover NSW", title: "NSW SIRA Initial Assessment", desc: "SIRA-aligned initial assessment documenting injury background, functional capacity, and RTW plan." },
    { icon: "🦺", tag: "WorkCover NSW", title: "NSW SIRA — Allied Health Treatment Request (AHTR)", desc: "Formal treatment extension request with outcome measures and skilled need justification." },
    { icon: "🦺", tag: "WorkCover NSW", title: "NSW SIRA Progress Report", desc: "Progress report for icare/SIRA-funded clients with functional test results and RTW updates." },
    { icon: "🦺", tag: "WorkCover NSW", title: "NSW SIRA Discharge Summary", desc: "Discharge report documenting final functional capacity and RTW outcome." },
    { icon: "🦺", tag: "WorkSafe VIC", title: "WorkSafe VIC Initial Assessment", desc: "Initial WorkSafe VIC assessment documenting injury, functional baselines, and RTW plan." },
    { icon: "🦺", tag: "WorkSafe VIC", title: "WorkSafe VIC Progress Report", desc: "Progress report with outcome measures and updated RTW recommendations for WorkSafe VIC funders." },
    { icon: "🦺", tag: "WorkSafe VIC", title: "WorkSafe VIC Discharge Summary", desc: "Discharge summary with final functional status and RTW outcome for WorkSafe VIC." },
    { icon: "🦺", tag: "ReturnToWorkSA", title: "ReturnToWorkSA Initial Assessment", desc: "RTWSA-aligned initial assessment with functional measures and recovery/RTW plan." },
    { icon: "🦺", tag: "ReturnToWorkSA", title: "ReturnToWorkSA Progress Report", desc: "Progress report for RTWSA-funded clients with outcome measures and RTW updates." },
    { icon: "🦺", tag: "ReturnToWorkSA", title: "ReturnToWorkSA Discharge Summary", desc: "Final discharge summary for RTWSA clients." },
    { icon: "🦺", tag: "WorkCover WA", title: "WorkCover WA Initial Assessment", desc: "Initial assessment for WorkCover WA-funded clients documenting injury, capacity, and RTW plan." },
    { icon: "🦺", tag: "WorkCover WA", title: "WorkCover WA Progress Report", desc: "Progress report with functional measures and RTW updates for WorkCover WA." },
    { icon: "🦺", tag: "WorkCover WA", title: "WorkCover WA Discharge Summary", desc: "Final discharge summary for WorkCover WA clients." },
    { icon: "🎖", tag: "DVA", title: "DVA Patient Care Plan", desc: "DVA-compliant care plan with accepted conditions, goals, and proposed exercise intervention." },
    { icon: "🎖", tag: "DVA", title: "DVA End of Cycle Report", desc: "End-of-cycle progress report with outcome measures and justification for further treatment." },
    { icon: "❤", tag: "Medicare", title: "Medicare Referral Acceptance", desc: "Referral acceptance letter for Medicare CDM-referred clients." },
    { icon: "❤", tag: "Medicare", title: "Medicare Initial Assessment (GPCCMP)", desc: "Initial assessment report for Medicare-referred chronic disease clients with exercise prescription." },
    { icon: "❤", tag: "Medicare", title: "Medicare Final Report", desc: "End-of-referral report with goal attainment and GP discharge communication." },
    { icon: "🏥", tag: "Private Health", title: "Private Health Initial Assessment", desc: "Initial assessment for private health-funded clients with diagnosis, goals, and treatment plan." },
    { icon: "🏥", tag: "Private Health", title: "Private Health Progress Report", desc: "Progress report for private health clients documenting outcomes and updated goals." },
    { icon: "♿", tag: "NDIS", title: "NDIS Initial Assessment", desc: "Comprehensive NDIS initial report across 7 functional domains with support justification." },
    { icon: "♿", tag: "NDIS", title: "NDIS Progress Report", desc: "NDIS goal-aligned progress report with functional domain updates and support recommendations." },
    { icon: "♿", tag: "NDIS", title: "NDIS Functional Capacity Evaluation", desc: "Detailed NDIS FCE documenting capacity across all 7 domains with AT recommendations." },
    { icon: "♿", tag: "NDIS", title: "NDIS Discharge / Transition Summary", desc: "NDIS discharge report with outcomes, self-management plan, and future support recommendations." },
    { icon: "🚗", tag: "TAC", title: "TAC Allied Health Treatment & Recovery Plan (AHTRP)", desc: "TAC-aligned functional assessment with accident background, functional tolerances, and treatment plan." },
    { icon: "🚗", tag: "TAC", title: "TAC Progress Report", desc: "TAC progress report with outcome measures and justification for continued treatment." },
    { icon: "🚗", tag: "TAC", title: "TAC Discharge Summary", desc: "TAC discharge summary with final functional status and RTW/return-to-activity outcome." },
    { icon: "🚗", tag: "MAIC", title: "MAIC QLD Initial Assessment", desc: "Initial report for MAIC QLD motor accident clients documenting injury, functional status, and treatment plan." },
    { icon: "🚗", tag: "MAIC", title: "MAIC QLD Progress Report", desc: "Progress report for MAIC-funded clients with functional outcomes and updated goals." },
    { icon: "🚗", tag: "MAIC", title: "MAIC QLD Discharge Summary", desc: "Discharge summary for MAIC motor accident clients." },
    { icon: "🚗", tag: "CTP", title: "CTP Motor Accident — Initial Assessment", desc: "Initial report for CTP motor accident clients with functional assessment and treatment plan." },
    { icon: "🚗", tag: "CTP", title: "CTP Motor Accident — Progress Report", desc: "Progress report for CTP-funded clients with outcome measures and goals update." },
    { icon: "🚗", tag: "CTP", title: "CTP Motor Accident — Discharge Summary", desc: "Discharge summary for CTP motor accident clients." },
    { icon: "👴", tag: "HCP", title: "Home Care Package — Initial Functional Assessment", desc: "HCP initial assessment including falls risk, ADL capacity, mobility, and goals." },
    { icon: "👴", tag: "HCP", title: "Home Care Package — Individual Care Plan", desc: "HCP care plan with service types, exercise program, and review schedule." },
    { icon: "👴", tag: "HCP", title: "Home Care Package — Annual Review", desc: "Annual HCP review comparing functional outcomes and updating the service plan." },
    { icon: "👴", tag: "CHSP", title: "CHSP Initial Assessment", desc: "CHSP initial assessment with falls risk, ADL capacity, and support plan." },
    { icon: "👴", tag: "CHSP", title: "CHSP Support Plan", desc: "CHSP support plan with service goals, frequency, and client consent." },
    { icon: "👴", tag: "Aged Care", title: "Aged Care Assessment", desc: "Comprehensive aged care assessment with functional status, falls risk, cognition screening, and management plan." },
    { icon: "⚖", tag: "Legal / FCE", title: "Functional Capacity Evaluation (FCE)", desc: "Detailed medicolegal FCE documenting postural tolerances, material handling, validity indicators, and RTW recommendations." },
    { icon: "⚖", tag: "Medico-Legal", title: "Medico-Legal / Independent Medical Report", desc: "Independent medico-legal report with causation analysis, diagnosis, functional limitations, and responses to legal questions." },
    { icon: "🎗", tag: "Cancer", title: "Cancer / Oncology — Initial Assessment", desc: "Oncology initial assessment with cancer type, treatment status, side effects, exercise precautions, and prescription." },
    { icon: "🎗", tag: "Cancer", title: "Cancer / Oncology — Progress Report", desc: "Progress report for cancer rehab clients with outcome measures and updated exercise prescription." },
    { icon: "❤", tag: "Cardiac", title: "Cardiac Rehab — Phase I (Inpatient)", desc: "Inpatient cardiac rehab report with event summary, activity progression, education, and Phase II recommendations." },
    { icon: "❤", tag: "Cardiac", title: "Cardiac Rehab — Phase II (Outpatient)", desc: "Outpatient cardiac rehab report with risk stratification, exercise prescription, and outcome measures." },
    { icon: "❤", tag: "Cardiac", title: "Cardiac Rehab — Phase III Completion Report", desc: "Phase III completion report with exercise capacity change, risk factor improvements, and maintenance recommendations." },
    { icon: "❤", tag: "Cardiac", title: "Cardiac Rehab — Phase IV Referral Letter", desc: "Phase IV referral letter summarising outcomes and recommended community maintenance exercise parameters." },
  ],
  nz: [
    { icon: "🚗", tag: "ACC", title: "ACC — Initial Assessment Report", desc: "ACC-aligned initial report documenting injury background, assessment findings, goals, and proposed treatment plan." },
    { icon: "🚗", tag: "ACC", title: "ACC — Progress Report (ACC32 Extension)", desc: "Progress report for ACC extension requests with outcome measures and treatment justification." },
    { icon: "🚗", tag: "ACC", title: "ACC — Functional Capacity Evaluation (FCE)", desc: "FCE for ACC clients documenting physical tolerances, work capacity, and RTW recommendations." },
    { icon: "🚗", tag: "ACC", title: "ACC — Discharge / Completion Summary", desc: "Discharge summary for ACC clients with functional outcomes and home programme." },
    { icon: "♿", tag: "Disability", title: "Disability Support — Functional Assessment", desc: "Whaikaha/MoH-aligned functional assessment documenting support needs across ADL domains." },
    { icon: "🏥", tag: "Private Health", title: "Private Insurance — Initial Assessment", desc: "Initial assessment report for NZ private insurance-funded clients." },
    { icon: "🏥", tag: "Private Health", title: "Private Insurance — Progress Report", desc: "Progress report for NZ private insurance clients with outcomes and justification for continued sessions." },
    { icon: "🏥", tag: "GP / General", title: "GP Summary Letter", desc: "Professional GP correspondence summarising EP assessment findings and intervention." },
    { icon: "📄", tag: "GP / General", title: "Progress / Extra Report", desc: "Free-form progress update for NZ clients." },
    { icon: "📄", tag: "GP / General", title: "Custom Report", desc: "Custom formatted report for any NZ funder or referrer." },
  ],
  uk: [
    { icon: "🏥", tag: "NHS", title: "NHS ERS — Initial Assessment", desc: "NHS Exercise Referral Scheme initial assessment with risk stratification, fitness baseline, and exercise prescription." },
    { icon: "🏥", tag: "NHS", title: "NHS ERS — Progress Report", desc: "NHS ERS mid-programme progress report with attendance, outcome measures, and goals update." },
    { icon: "🏥", tag: "NHS", title: "NHS ERS — Completion / Discharge Report", desc: "NHS ERS end-of-programme report with exercise capacity change and ongoing activity recommendations." },
    { icon: "❤", tag: "Cardiac UK", title: "Cardiac Rehab — Initial Clinical Assessment", desc: "UK cardiac rehab initial assessment with BACPR/SIGN risk stratification, exercise tolerance, and Phase II prescription." },
    { icon: "❤", tag: "Cardiac UK", title: "Cardiac Rehab — Phase III Completion Report", desc: "UK cardiac rehab completion report with outcomes, risk factor improvements, and Phase IV referral." },
    { icon: "🫁", tag: "Pulmonary", title: "Pulmonary Rehab — Initial Assessment", desc: "UK pulmonary rehab assessment with spirometry, MRC dyspnoea, ISWT/6MWT, and SGRQ/CAT." },
    { icon: "🫁", tag: "Pulmonary", title: "Pulmonary Rehab — Completion Report", desc: "UK pulmonary rehab completion with exercise capacity change and maintenance recommendations." },
    { icon: "🎗", tag: "Cancer UK", title: "Cancer Rehab — Initial Exercise Assessment", desc: "UK cancer rehab initial report with HNA summary, fitness baseline, and exercise prescription." },
    { icon: "🎗", tag: "Cancer UK", title: "Cancer Rehab — Progress Report", desc: "UK cancer rehab progress report with attendance, outcomes, and updated exercise tolerance." },
    { icon: "🎗", tag: "Cancer UK", title: "Cancer Rehab — End-of-Programme Report", desc: "UK cancer rehab end-of-programme with outcomes, wellbeing results, and onward referral." },
    { icon: "🏥", tag: "PMI", title: "PMI — Initial Assessment / Consultation Report", desc: "UK private medical insurance initial report with clinical justification for treatment." },
    { icon: "🏥", tag: "PMI", title: "PMI — Progress Report", desc: "PMI progress report with outcome measures and justification for continued treatment." },
    { icon: "🏥", tag: "PMI", title: "PMI — Discharge Report", desc: "PMI discharge report with treatment outcomes and home programme." },
    { icon: "⚖", tag: "FCE UK", title: "FCE / Work Capacity Assessment", desc: "UK work capacity assessment documenting functional tolerances, validity indicators, and RTW recommendations." },
    { icon: "🦺", tag: "RTW UK", title: "Return to Work Progress Report", desc: "UK RTW progress report with current functional status, work capacity, and graded RTW plan." },
    { icon: "🏥", tag: "GP / General", title: "GP / Specialist Summary Letter", desc: "UK GP correspondence summarising assessment findings and intervention." },
    { icon: "📄", tag: "GP / General", title: "Progress / Extra Report", desc: "Free-form progress update for UK clients." },
    { icon: "📄", tag: "GP / General", title: "Custom Report", desc: "Custom report for any UK funder or referrer." },
  ],
  ca: [
    { icon: "🦺", tag: "WSIB", title: "WSIB — Initial Assessment Report", desc: "WSIB Ontario initial report with mechanism of injury, functional limitations, diagnosis, and RTW recommendations." },
    { icon: "🦺", tag: "WSIB", title: "WSIB — Functional Abilities Form (FAF)", desc: "WSIB FAF documenting physical tolerances, work status, restrictions, and expected return date." },
    { icon: "🦺", tag: "WSIB", title: "WSIB — Progress Report", desc: "WSIB progress report with outcome measures, functional progress, and goals update." },
    { icon: "🦺", tag: "WSIB", title: "WSIB — Return-to-Work Summary", desc: "WSIB RTW discharge summary with final capacity, remaining restrictions, and employer recommendations." },
    { icon: "🦺", tag: "WorkSafeBC", title: "WorkSafeBC — Initial Assessment", desc: "WorkSafeBC initial report documenting claim details, functional assessment, and RTW plan." },
    { icon: "🦺", tag: "WorkSafeBC", title: "WorkSafeBC — Functional Capacity Assessment (FCA)", desc: "WorkSafeBC FCA with testing results, work tolerances, and disability rating recommendations." },
    { icon: "🦺", tag: "WorkSafeBC", title: "WorkSafeBC — Progress Report", desc: "Progress report for WorkSafeBC-funded clients with functional outcomes and updated plan." },
    { icon: "🦺", tag: "WCB Alberta", title: "WCB Alberta — Initial Assessment", desc: "WCB Alberta initial assessment documenting injury, capacity, diagnosis, and RTW plan." },
    { icon: "🦺", tag: "WCB Alberta", title: "WCB Alberta — Functional Capacity Evaluation (FCE)", desc: "WCB Alberta FCE with physical demands classification, validity indicators, and RTW recommendations." },
    { icon: "🦺", tag: "WCB Alberta", title: "WCB Alberta — Progress Report", desc: "Progress report for WCB Alberta clients with outcome measures and work capacity update." },
    { icon: "🏥", tag: "EHB", title: "Extended Health Benefits — Initial Assessment", desc: "EHB initial report with assessment findings, diagnosis, and clinical justification for treatment." },
    { icon: "🏥", tag: "EHB", title: "Extended Health Benefits — Progress Report", desc: "EHB progress report with outcome measures and justification for continued sessions." },
    { icon: "🎖", tag: "VAC", title: "Veterans Affairs Canada — Initial Assessment", desc: "VAC initial assessment with service-related history, functional limitations, and rehabilitation plan." },
    { icon: "🎖", tag: "VAC", title: "Veterans Affairs Canada — Progress Report", desc: "VAC progress report aligned to rehabilitation goals with functional outcomes update." },
    { icon: "🏥", tag: "GP / General", title: "GP Summary Letter", desc: "Professional GP correspondence summarising EP assessment and intervention." },
    { icon: "📄", tag: "GP / General", title: "Progress / Extra Report", desc: "Free-form progress update for Canadian clients." },
    { icon: "📄", tag: "GP / General", title: "Custom Report", desc: "Custom report for any Canadian funder or referrer." },
  ],
  us: [
    { icon: "🏥", tag: "USA", title: "Initial Evaluation / Examination", desc: "ACSM-aligned initial evaluation with subjective/objective findings, goals, and plan of care." },
    { icon: "🏥", tag: "USA", title: "Plan of Care / Certification Packet", desc: "Insurance plan of care with diagnoses, goals, frequency/duration, and ordering provider certification." },
    { icon: "🏥", tag: "USA", title: "Progress Report / Re-examination", desc: "Progress re-examination with objective results, goal attainment, and clinical justification for continued care." },
    { icon: "🏥", tag: "USA", title: "Discharge Summary", desc: "Discharge report with goal attainment, functional status, home programme, and referral recommendations." },
    { icon: "🏥", tag: "USA", title: "Prior Authorization / Medical Necessity", desc: "Prior auth packet with clinical summary, objective findings, goal rationale, and skilled need justification." },
    { icon: "🏥", tag: "GP / General", title: "GP Summary Letter", desc: "Physician correspondence summarising EP assessment and intervention." },
    { icon: "📄", tag: "GP / General", title: "Progress / Extra Report", desc: "Free-form progress update for US clients." },
    { icon: "📄", tag: "GP / General", title: "Custom Report", desc: "Custom report for any US insurer, hospital, or referrer." },
  ],
  ie: [
    { icon: "🏥", tag: "HSE", title: "HSE — Initial Assessment Report", desc: "HSE programme initial assessment with risk stratification, baseline assessment, and exercise prescription." },
    { icon: "🏥", tag: "HSE", title: "HSE — Progress Review Report", desc: "HSE mid-programme progress review with attendance, outcomes, and updated plan." },
    { icon: "🏥", tag: "HSE", title: "HSE — Discharge Summary", desc: "HSE discharge summary with programme outcomes and maintenance recommendations." },
    { icon: "❤", tag: "Cardiac IE", title: "Cardiac Rehab — Initial Assessment (Ireland)", desc: "Irish cardiac rehab initial assessment with cardiovascular risk factors, exercise assessment, and Phase II prescription." },
    { icon: "❤", tag: "Cardiac IE", title: "Cardiac Rehab — Completion Report (Ireland)", desc: "Irish cardiac rehab completion with outcomes, risk factor improvements, and maintenance recommendations." },
    { icon: "⚖", tag: "PIAB", title: "PIAB — Personal Injury Functional Assessment", desc: "PIAB-aligned functional assessment with injury background, capacity measures, and prognosis." },
    { icon: "🏥", tag: "Private IE", title: "Private Insurance — Initial Assessment (Ireland)", desc: "Initial assessment for Irish private insurance clients with assessment findings and treatment plan." },
    { icon: "🏥", tag: "Private IE", title: "Private Insurance — Progress Report (Ireland)", desc: "Progress report for Irish private insurance clients with outcomes and justification for continued sessions." },
    { icon: "🏥", tag: "Private IE", title: "Private Insurance — Discharge Report (Ireland)", desc: "Discharge report for Irish private insurance clients with outcomes and home programme." },
    { icon: "🏥", tag: "GP / General", title: "GP / Specialist Summary Letter (Ireland)", desc: "Irish GP correspondence summarising EP assessment and intervention." },
    { icon: "📄", tag: "GP / General", title: "Progress / Extra Report", desc: "Free-form progress update for Irish clients." },
    { icon: "📄", tag: "GP / General", title: "Custom Report", desc: "Custom report for any Irish funder or referrer." },
  ],
  sg: [
    { icon: "❤", tag: "HealthierSG", title: "Healthier SG — Initial Assessment Report", desc: "Healthier SG initial assessment with health plan goals, chronic conditions, and exercise/rehab plan." },
    { icon: "❤", tag: "HealthierSG", title: "Healthier SG — Programme Progress Report", desc: "Progress report with chronic disease indicators (HbA1c, BP, BMI) and engagement update." },
    { icon: "❤", tag: "HealthierSG", title: "Healthier SG — Completion / Discharge Report", desc: "Completion report with chronic disease indicator changes and self-management recommendations." },
    { icon: "❤", tag: "CDMP", title: "CDMP — Initial Exercise Assessment", desc: "CDMP initial report with chronic disease indicators, fitness baseline, and exercise prescription." },
    { icon: "❤", tag: "CDMP", title: "CDMP — Progress / Review Report", desc: "CDMP progress review with chronic disease indicators, exercise capacity, and adherence update." },
    { icon: "❤", tag: "CDMP", title: "CDMP — Discharge Summary", desc: "CDMP discharge with chronic disease indicator changes and home programme." },
    { icon: "🦺", tag: "WICA", title: "WICA — Work Injury Assessment", desc: "MOM WICA work injury report with functional assessment, diagnosis, and RTW recommendations." },
    { icon: "🦺", tag: "WICA", title: "WICA — Return-to-Work Plan", desc: "WICA RTW plan with graded return duties, employer recommendations, and expected RTW date." },
    { icon: "🏥", tag: "Corporate", title: "Corporate / Private Insurance — Initial Assessment", desc: "Initial assessment for Singapore private insurance and corporate health clients." },
    { icon: "🏥", tag: "GP / General", title: "GP Summary Letter", desc: "Physician correspondence summarising EP findings and exercise prescription." },
    { icon: "📄", tag: "GP / General", title: "Progress / Extra Report", desc: "Free-form progress update for Singapore clients." },
    { icon: "📄", tag: "GP / General", title: "Custom Report", desc: "Custom report for any Singapore funder or referrer." },
  ],
  za: [
    { icon: "🏥", tag: "Medical Aid", title: "Medical Aid — Initial Assessment Report", desc: "Medical aid initial report with ICD-10 diagnosis, assessment findings, and clinical motivation for treatment." },
    { icon: "🏥", tag: "Medical Aid", title: "Medical Aid — Progress Report", desc: "Progress report for medical aid clients with outcome measures and motivation for continued sessions." },
    { icon: "🏥", tag: "Medical Aid", title: "Medical Aid — Discharge Report", desc: "Discharge report for medical aid clients with final outcomes and home programme." },
    { icon: "🦺", tag: "COIDA", title: "COIDA — Initial Assessment Report", desc: "COIDA initial report with injury background, functional assessment, and RTW recommendations." },
    { icon: "🦺", tag: "COIDA", title: "COIDA — Progress Report", desc: "COIDA progress report with outcome measures, work capacity update, and goals update." },
    { icon: "🦺", tag: "COIDA", title: "COIDA — Return-to-Work Summary", desc: "COIDA RTW discharge with final capacity, remaining restrictions, and employer recommendations." },
    { icon: "🚗", tag: "RAF", title: "RAF — Initial Assessment Report", desc: "RAF motor vehicle accident initial report with functional assessment, diagnosis, and treatment plan." },
    { icon: "🚗", tag: "RAF", title: "RAF — Progress Report", desc: "RAF progress report with functional outcomes and updated goals." },
    { icon: "🏥", tag: "GEMS", title: "GEMS — Initial Assessment Report", desc: "GEMS government employees medical scheme initial report with ICD-10 diagnosis and clinical motivation." },
    { icon: "🏥", tag: "GEMS", title: "GEMS — Progress Report", desc: "GEMS progress report with outcome measures and motivation for continued sessions." },
    { icon: "🏥", tag: "GP / General", title: "GP Summary Letter", desc: "GP correspondence summarising EP assessment and intervention." },
    { icon: "📄", tag: "GP / General", title: "Progress / Extra Report", desc: "Free-form progress update for South African clients." },
    { icon: "📄", tag: "GP / General", title: "Custom Report", desc: "Custom report for any South African funder or referrer." },
  ],
};

const countryButtons = [
  { code: "au", label: "🇦🇺 Australia" },
  { code: "nz", label: "🇳🇿 New Zealand" },
  { code: "uk", label: "🇬🇧 United Kingdom" },
  { code: "ca", label: "🇨🇦 Canada" },
  { code: "us", label: "🇺🇸 United States" },
  { code: "ie", label: "🇮🇪 Ireland" },
  { code: "sg", label: "🇸🇬 Singapore" },
  { code: "za", label: "🇿🇦 South Africa" },
];

export default function LandingLive() {
  const [activeCountry, setActiveCountry] = useState("au");
  const navigate = useNavigate();

  const showSuccess = new URLSearchParams(window.location.search).get('success') === 'true';

  useEffect(() => {
    function animateCounter(id, target, suffix, duration) {
      const el = document.getElementById(id);
      if (!el) return;
      const start = performance.now();
      function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    }
    function onVisible(el, callback) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { callback(); observer.disconnect(); }
        });
      }, { threshold: 0.3 });
      observer.observe(el);
    }
    const statSection = document.querySelector('.stat-row');
    if (statSection) {
      onVisible(statSection, () => {
        animateCounter('stat-assessments', 226, '+', 1200);
        animateCounter('stat-reports', 128, '+', 1000);
      });
    }
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&display=swap');
        .lp * { margin: 0; padding: 0; box-sizing: border-box; }
        .lp { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; background: #fff; }
        .lp a { text-decoration: none; color: inherit; }
        .lp nav { display: flex; justify-content: space-between; align-items: center; padding: 18px 60px; position: sticky; top: 0; background: rgba(255,255,255,0.97); backdrop-filter: blur(8px); border-bottom: 1px solid #f0f0f0; z-index: 100; }
        .lp .nav-brand { display: flex; flex-direction: column; }
        .lp .nav-logo { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
        .lp .nav-logo span { color: #2563eb; }
        .lp .nav-product { font-size: 11px; color: #64748b; font-weight: 500; margin-top: 1px; }
        .lp .nav-links { display: flex; gap: 32px; align-items: center; }
        .lp .nav-links a { font-size: 15px; color: #555; font-weight: 500; transition: color 0.2s; }
        .lp .nav-links a:hover { color: #2563eb; }
        .lp .nav-cta { background: #2563eb; color: #fff !important; padding: 10px 22px; border-radius: 8px; font-weight: 600; font-size: 14px !important; cursor: pointer; }
        .lp .nav-cta:hover { background: #1d4ed8 !important; }
        .lp .nav-signin { background: transparent; color: #374151 !important; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px !important; cursor: pointer; border: 1px solid #e2e8f0; }
        .lp .nav-signin:hover { background: #f8fafc !important; border-color: #cbd5e1 !important; }
        .lp .hero { background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%); padding: 100px 60px 90px; text-align: center; }
        .lp .hero-badge { display: inline-block; background: #dbeafe; color: #1d4ed8; font-size: 13px; font-weight: 600; padding: 6px 16px; border-radius: 100px; margin-bottom: 28px; }
        .lp .hero-company { font-size: 15px; font-weight: 700; color: #2563eb; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px; }
        .lp .hero h1 { font-size: 56px; font-weight: 900; line-height: 1.1; color: #0f172a; max-width: 840px; margin: 0 auto 12px; letter-spacing: -1.5px; font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif; }
        .lp .hero-product { font-size: 22px; font-weight: 700; color: #2563eb; margin-bottom: 24px; }
        .lp .hero p { font-size: 20px; color: #475569; max-width: 620px; margin: 0 auto 40px; line-height: 1.7; }
        .lp .hero-ctas { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
        .lp .btn-primary { background: #2563eb; color: #fff; padding: 16px 36px; border-radius: 10px; font-size: 17px; font-weight: 700; transition: background 0.2s, transform 0.1s; display: inline-block; cursor: pointer; border: none; }
        .lp .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); }
        .lp .btn-secondary { background: #fff; color: #2563eb; border: 2px solid #2563eb; padding: 16px 36px; border-radius: 10px; font-size: 17px; font-weight: 700; display: inline-block; }
        .lp .btn-secondary:hover { background: #eff6ff; }
        .lp .hero-sub { margin-top: 18px; font-size: 14px; color: #94a3b8; }
        .lp .ep-strip { background: #0f172a; padding: 16px 60px; text-align: center; }
        .lp .ep-strip p { color: #94a3b8; font-size: 14px; font-weight: 500; }
        .lp .ep-strip p strong { color: #e2e8f0; }
        .lp section { padding: 90px 60px; }
        .lp .section-label { font-size: 12px; font-weight: 700; color: #2563eb; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
        .lp h2 { font-size: 42px; font-weight: 800; color: #0f172a; line-height: 1.2; letter-spacing: -1px; margin-bottom: 16px; font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif; }
        .lp .section-sub { font-size: 18px; color: #64748b; line-height: 1.7; max-width: 600px; margin-bottom: 52px; }
        .lp .problem { background: #fff; text-align: center; }
        .lp .problem h2 { max-width: 700px; margin: 0 auto 16px; }
        .lp .problem .section-sub { margin: 0 auto 52px; }
        .lp .problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1000px; margin: 0 auto; }
        .lp .problem-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 32px; text-align: left; }
        .lp .problem-card .icon { font-size: 28px; margin-bottom: 14px; }
        .lp .problem-card h3 { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
        .lp .problem-card p { font-size: 15px; color: #64748b; line-height: 1.6; }
        .lp .features { background: #f8fafc; }
        .lp .features-grid { display: flex; flex-direction: column; gap: 0; max-width: 900px; margin: 0 auto; }
        .lp .feature-card { background: transparent; border-radius: 0; padding: 32px 0; border: none; border-bottom: 1px solid #e2e8f0; position: relative; overflow: visible; box-shadow: none; display: flex; gap: 28px; align-items: flex-start; transition: none; }
        .lp .feature-card:last-child { border-bottom: none; }
        .lp .feature-card::before { content: ""; display: none; }
        .lp .feature-card:hover { box-shadow: none; transform: none; }
        .lp .feature-card:nth-child(1) { --accent-color: transparent; }
        .lp .feature-card:nth-child(2) { --accent-color: transparent; }
        .lp .feature-card:nth-child(3) { --accent-color: transparent; }
        .lp .feature-card:nth-child(4) { --accent-color: transparent; }
        .lp .feature-card:nth-child(5) { --accent-color: transparent; }
        .lp .feature-card:nth-child(6) { --accent-color: transparent; }
        .lp .feature-card:nth-child(7) { --accent-color: transparent; }
        .lp .feature-card:nth-child(8) { --accent-color: transparent; }
        .lp .feature-icon { width: 48px; height: 48px; border-radius: 8px; background: #f8fafc; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0; flex-shrink: 0; box-shadow: none; }
        .lp .feature-card:nth-child(1) .feature-icon { --bg-color: transparent; }
        .lp .feature-card:nth-child(2) .feature-icon { --bg-color: transparent; }
        .lp .feature-card:nth-child(3) .feature-icon { --bg-color: transparent; }
        .lp .feature-card:nth-child(4) .feature-icon { --bg-color: transparent; }
        .lp .feature-card:nth-child(5) .feature-icon { --bg-color: transparent; }
        .lp .feature-card:nth-child(6) .feature-icon { --bg-color: transparent; }
        .lp .feature-card:nth-child(7) .feature-icon { --bg-color: transparent; }
        .lp .feature-card:nth-child(8) .feature-icon { --bg-color: transparent; }
        .lp .feature-card h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px; text-align: left; letter-spacing: -0.3px; font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif; }
        .lp .feature-card p { font-size: 14px; color: #64748b; line-height: 1.6; text-align: left; font-weight: 400; font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif; }
        .lp .feature-card-content { flex: 1; }
        .lp .library { background: linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 50%, #f0fdf4 100%); position: relative; text-align: center; overflow: hidden; }
        .lp .library .section-label { color: #2563eb; }
        .lp .library h2 { color: #0f172a; }
        .lp .library .section-sub { color: #475569; margin-left: auto; margin-right: auto; }
        .lp .stat-row { display: flex; gap: 24px; margin-bottom: 48px; flex-wrap: wrap; justify-content: center; }
        .lp .stat-box { background: rgba(255,255,255,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.9); border-radius: 16px; padding: 28px 40px; box-shadow: 0 4px 24px rgba(37,99,235,0.08); }
        .lp .stat-box .number { font-size: 48px; font-weight: 900; color: #2563eb; line-height: 1; }
        .lp .stat-box .label { font-size: 14px; color: #64748b; margin-top: 4px; font-weight: 500; }
        .lp .categories { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 40px; justify-content: center; }
        .lp .cat-pill { background: rgba(255,255,255,0.75); backdrop-filter: blur(8px); border: 1px solid rgba(37,99,235,0.2); color: #2563eb; padding: 8px 18px; border-radius: 100px; font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(37,99,235,0.06); }

        .lp .screenshot-row { display: flex; gap: 32px; margin-bottom: 64px; justify-content: center; align-items: center; animation: scroll-carousel 30s linear infinite; }
        .lp .screenshot-card { flex: 0 0 340px; min-width: 240px; max-width: 340px; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 40px rgba(15,23,42,0.18); border: 3px solid #fff; background: #fff; transition: transform 0.2s; }
        .lp .screenshot-card:nth-child(1) { transform: rotate(-2.5deg); }
        .lp .screenshot-card:nth-child(2) { transform: rotate(1.2deg) translateY(-10px); }
        .lp .screenshot-card:nth-child(3) { transform: rotate(-1.5deg) translateY(6px); }
        .lp .screenshot-card:nth-child(4) { transform: rotate(2.2deg) translateY(-8px); }
        .lp .screenshot-card:nth-child(5) { transform: rotate(-1.8deg) translateY(4px); }
        .lp .screenshot-card:hover { transform: rotate(0deg) translateY(-4px) scale(1.02) !important; }
        @keyframes scroll-carousel { 
          0% { transform: translateX(0); }
          100% { transform: translateX(-20%); }
        }
        .lp .screenshot-card img { width: 100%; display: block; }
        
        .lp .ep-focus { background: #fff; }
        .lp .country-tabs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 36px; }
        .lp .country-btn { background: #f1f5f9; border: 2px solid #e2e8f0; color: #475569; padding: 10px 20px; border-radius: 100px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .lp .country-btn:hover { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
        .lp .country-btn.active { background: #2563eb; border-color: #2563eb; color: #fff; }
        .lp .report-carousel-wrap { position: relative; }
        .lp .report-carousel { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 16px; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .lp .report-carousel::-webkit-scrollbar { display: none; }
        .lp .report-card { flex: 0 0 260px; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; transition: border-color 0.2s, box-shadow 0.2s; background: #fff; }
        .lp .report-card:hover { border-color: #2563eb; box-shadow: 0 4px 20px rgba(37,99,235,0.08); }
        .lp .report-card .rep-icon { font-size: 24px; margin-bottom: 10px; }
        .lp .report-tag { display: inline-block; background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 100px; margin-bottom: 10px; letter-spacing: 0.5px; text-transform: uppercase; }
        .lp .report-card h3 { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px; line-height: 1.4; }
        .lp .report-card p { font-size: 13px; color: #64748b; line-height: 1.6; }
        .lp .carousel-nav { display: flex; gap: 10px; margin-top: 20px; }
        .lp .carousel-btn { width: 38px; height: 38px; border-radius: 50%; border: 2px solid #e2e8f0; background: #fff; color: #374151; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .lp .carousel-btn:hover { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
        .lp .report-count { font-size: 13px; color: #94a3b8; margin-top: 12px; }
        .lp .reporting { background: linear-gradient(135deg, #eff6ff, #f0f9ff); }
        .lp .reporting-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: start; }
        .lp .funder-list { display: flex; flex-direction: column; gap: 8px; max-height: 520px; overflow-y: auto; padding-right: 4px; scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent; }
        .lp .funder-list::-webkit-scrollbar { width: 4px; }
        .lp .funder-list::-webkit-scrollbar-track { background: transparent; }
        .lp .funder-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        .lp .funder-item { display: flex; align-items: center; gap: 14px; background: #fff; border-radius: 10px; padding: 14px 18px; border: 1px solid #e2e8f0; }
        .lp .funder-check { width: 24px; height: 24px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #16a34a; font-size: 13px; font-weight: 700; flex-shrink: 0; }
        .lp .funder-item span { font-size: 14px; color: #475569; font-weight: 400; }
        .lp .capabilities { background: #f8fafc; }
        .lp .cap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .lp .cap-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 22px; display: flex; align-items: center; gap: 12px; }
        .lp .cap-dot { width: 9px; height: 9px; background: #2563eb; border-radius: 50%; flex-shrink: 0; }
        .lp .cap-item span { font-size: 14px; color: #374151; font-weight: 500; }
        .lp .coming-soon { background: #0f172a; padding: 70px 60px; text-align: center; }
        .lp .coming-soon h2 { color: #fff; margin-bottom: 14px; }
        .lp .coming-soon p { color: #94a3b8; font-size: 18px; max-width: 560px; margin: 0 auto 40px; line-height: 1.7; }
        .lp .discipline-pills { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
        .lp .discipline-pill { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 10px 20px; border-radius: 100px; font-size: 14px; font-weight: 500; }
        .lp .discipline-pill.current { background: #2563eb; border-color: #2563eb; color: #fff; }
        .lp .pricing { background: #fff; text-align: center; }
        .lp .pricing .section-sub { margin: 0 auto 52px; }
        .lp .pricing-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; max-width: 780px; margin: 0 auto 24px; }
        .lp .pricing-card { border: 2px solid #e2e8f0; border-radius: 20px; padding: 44px 40px; text-align: left; position: relative; }
        .lp .pricing-card.featured { border-color: #2563eb; background: #eff6ff; }
        .lp .popular-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: #2563eb; color: #fff; font-size: 12px; font-weight: 700; padding: 4px 16px; border-radius: 100px; white-space: nowrap; }
        .lp .plan-name { font-size: 13px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .lp .price { font-size: 52px; font-weight: 900; color: #0f172a; line-height: 1; margin-bottom: 4px; }
        .lp .price span { font-size: 20px; font-weight: 500; color: #64748b; }
        .lp .billing { font-size: 14px; color: #64748b; margin-bottom: 24px; }
        .lp .save-badge { display: inline-block; background: #dcfce7; color: #16a34a; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 100px; margin-bottom: 24px; }
        .lp .pricing-features { list-style: none; display: flex; flex-direction: column; gap: 11px; margin-bottom: 32px; padding: 0; }
        .lp .pricing-features li { display: flex; align-items: center; gap: 10px; font-size: 15px; color: #374151; }
        .lp .pricing-features li::before { content: "✓"; color: #16a34a; font-weight: 700; }
        .lp .pricing-note { font-size: 14px; color: #94a3b8; }
        .lp .final-cta { background: #f8fafc; padding: 60px 60px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
        .lp .final-cta h2 { color: #0f172a; margin-bottom: 16px; }
        .lp .final-cta p { font-size: 20px; color: #64748b; max-width: 560px; margin: 0 auto 40px; line-height: 1.7; }
        .lp .btn-white { background: #2563eb; color: #fff; padding: 18px 44px; border-radius: 10px; font-size: 18px; font-weight: 800; display: inline-block; transition: background 0.15s, transform 0.15s; cursor: pointer; border: none; }
        .lp .btn-white:hover { background: #1d4ed8; transform: translateY(-2px); }
        .lp footer { background: #0f172a; padding: 32px 60px 24px; display: flex; flex-direction: column; gap: 12px; }
        .lp .footer-top { display: flex; flex-direction: column; gap: 8px; }
        .lp .footer-brand { display: flex; flex-direction: column; gap: 8px; }
        .lp .footer-col { display: flex; flex-direction: column; gap: 8px; }
        .lp .footer-col-title { font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .lp .footer-col a { font-size: 13px; color: #e2e8f0; transition: color 0.2s; }
        .lp .footer-col a:hover { color: #60a5fa; }
        .lp .footer-col > div { font-size: 13px; color: #e2e8f0; }
        .lp .footer-bottom { text-align: right; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
        .lp .footer-logo { font-size: 18px; font-weight: 800; color: #fff; }
        .lp .footer-logo span { color: #60a5fa; }
        .lp .footer-product { font-size: 12px; color: #475569; margin-top: 3px; }
        .lp .footer-tagline { font-size: 12px; color: #334155; margin-top: 2px; }
        .lp .footer-links { display: flex; gap: 24px; }
        .lp .footer-links a { font-size: 13px; color: #64748b; }
        .lp .footer-links a:hover { color: #94a3b8; }
        @media (max-width: 900px) {
          .lp nav { padding: 16px 24px; }
          .lp .nav-links { display: none; }
          .lp .hero { padding: 60px 24px 50px; }
          .lp .hero h1 { font-size: 36px; }
          .lp section { padding: 60px 24px; }
          .lp .problem-grid, .lp .features-grid, .lp .ep-grid, .lp .reporting-grid, .lp .cap-grid, .lp .pricing-grid { grid-template-columns: 1fr; }
          .lp .ep-strip, .lp .coming-soon { padding: 40px 24px; }
          .lp footer { padding: 32px 24px; flex-direction: column; text-align: center; }
        }
      `}</style>

      <div className="lp">
        {showSuccess && (
          <div style={{ background: '#d1fae5', borderBottom: '2px solid #10b981', padding: '20px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 999 }}>
            <p style={{ fontSize: '18px', fontWeight: '600', color: '#065f46', margin: '0 0 10px 0' }}>
              🎉 Payment successful! Welcome to AssessSuite Clinical.
            </p>
            <p style={{ color: '#047857', margin: '0 0 14px 0' }}>
              Click below to create your account and get started.
            </p>
            <a href="https://assesssuite.com" style={{ background: '#10b981', color: 'white', padding: '10px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>
              Create Your Account →
            </a>
          </div>
        )}
        <nav>
          <div className="nav-brand">
            <div style={{height: "56px", overflow: "hidden", display: "flex", alignItems: "center"}}>
              <img src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/358c0c514_Logo-Transparent1.png" alt="AssessSuite Clinical" style={{height: "200px", width: "auto", marginTop: "-70px", marginBottom: "-70px"}} />
            </div>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#assessments">Assessments</a>
            <a href="#reporting">Reports</a>
            <a href="#pricing">Pricing</a>
            <a onClick={() => navigate('/login')} style={{cursor:'pointer', textDecoration:'none'}}>Sign In</a>
            <a onClick={() => navigate('/register')} className="nav-cta" style={{display:'inline-block',border: 'none', cursor: 'pointer', textDecoration:'none', color:'#fff'}}>Get Started →</a>
          </div>
        </nav>

        <section className="hero">
          <h1>Exercise Physiology at its Clinical Best.</h1>
          <p>AssessSuite Clinical gives clinicians the tools to assess with greater accuracy, document more efficiently, and deliver more consistent client care. Designed specifically for Exercise Physiologists, the platform brings together assessments, clinical notes, outcome tracking, and professional reporting into one modern workflow built for growing practices and evolving healthcare systems.</p>
          <div className="hero-ctas">
            <button onClick={() => navigate('/register')} className="btn-primary" style={{display:'inline-block',cursor:'pointer',border:'none'}}>Get Started →</button>
            <p style={{marginTop:'14px',fontSize:'0.95rem',color:'#475569'}}>Already using AssessSuite? <a onClick={() => navigate('/login')} style={{cursor:'pointer',textDecoration:'underline',fontWeight:600,color:'#2563eb'}}>Sign in</a></p>
          </div>
        </section>

        <section className="library" id="assessments">
          <h2>The most complete Exercise Physiologist assessment library available.</h2>
          <p className="section-sub">226+ validated clinical assessments — all with built-in clinician instructions, normative data, and automated interpretation. If you run it in practice, it's in here.</p>

          <div className="screenshot-row">
            <div className="screenshot-card">
              <img src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/f3de54057_image.png" alt="10-Metre Walk Test with clinician instructions" />
            </div>
            <div className="screenshot-card">
              <img src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/5eb559ca6_image.png" alt="Trial runner showing gait speed measurements" />
            </div>
            <div className="screenshot-card">
              <img src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/e9df29d41_image.png" alt="Visual ROM Assessment — joint selector" />
            </div>
            <div className="screenshot-card">
              <img src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/07f2f5d2f_image.png" alt="Assessment summary with ROM results" />
            </div>
            <div className="screenshot-card">
              <img src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/63773537e_image.png" alt="DASS-21 questionnaire with instructions" />
            </div>
            <div className="screenshot-card">
              <img src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/a0e2d7fd0_image.png" alt="DASS-21 results and clinical interpretation" />
            </div>
            <div className="screenshot-card">
              <img src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/262107ccf_image.png" alt="PHQ-9 mental health questionnaire runner" />
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-box"><div className="number" id="stat-assessments">0</div><div className="label">Clinical Assessments & Growing</div></div>
            <div className="stat-box"><div className="number" id="stat-reports">0</div><div className="label">Report Templates</div></div>
          </div>
          <div className="categories">
            {["Cardiovascular & Aerobic Fitness","Strength & Power","Balance & Vestibular","Mobility & Flexibility","Neurological & Cognitive","Pain & Psychological","Respiratory & Metabolic","Functional Independence","Outcome Measures & Questionnaires","Sports Performance & Agility","Body Composition","Chronic Disease Management"].map(c => (
              <div key={c} className="cat-pill">{c}</div>
            ))}
            <a href="mailto:admin@assesssuite.com?subject=Assessment%20Request%20-%20AssessSuite%20Clinical" className="cat-pill" style={{textDecoration: "none"}}>
              Request an Assessment
            </a>
          </div>

        </section>

        <section className="reporting" id="reporting">
          <div className="reporting-grid">
            <div>
              <h2>Reports structured around funder requirements.</h2>
              <p className="section-sub">Select your country to see every funder-ready report AssessSuite Clinical generates — structured EP reports with objective data tables, goal-based outcomes, and clinical justification built in.</p>
              <div className="country-tabs" style={{marginBottom: 0}}>
                {countryButtons.map(({ code, label }) => (
                  <button
                    key={code}
                    className={`country-btn${activeCountry === code ? " active" : ""}`}
                    onClick={() => setActiveCountry(code)}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div className="funder-list">
              {countryData[activeCountry].map(({ icon, tag, title }) => (
                <div key={title} className="funder-item">
                  <div className="funder-check">✓</div>
                  <span><strong style={{color:"#0f172a"}}>{tag}</strong> — {title}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pricing" id="pricing">
           <h2>Simple, transparent pricing.</h2>
           <p className="section-sub">One subscription per EP clinician. Everything included. No hidden fees, no per-report charges, no feature tiers.</p>
           <div className="pricing-grid">
             <div className="pricing-card">
               <div className="plan-name">Monthly</div>
               <div className="price">$55<span>/mo</span></div>
               <div className="billing">Billed monthly. Cancel anytime.</div>
               <ul className="pricing-features">
                 {["Unlimited assessments","Unlimited clients","All 226+ EP assessments","Automated SOAP notes","Full report generation","Multi-clinician support","All future updates included"].map(f => <li key={f}>{f}</li>)}
               </ul>
               <button onClick={() => navigate('/register')} className="btn-primary" style={{width:"100%",textAlign:"center",display:"block",border:'none',cursor:'pointer',color:'#fff'}}>Get Started →</button>
             </div>
             <div className="pricing-card featured">
               <div className="popular-badge">BEST VALUE</div>
               <div className="plan-name">Annual</div>
               <div className="price">$45<span>/mo</span></div>
               <div className="billing">Billed annually — $540/year.</div>
               <div className="save-badge">Save $120/year</div>
               <ul className="pricing-features">
                 {["Unlimited assessments","Unlimited clients","All 226+ EP assessments","Automated SOAP notes","Full report generation","Multi-clinician support","All future updates included"].map(f => <li key={f}>{f}</li>)}
               </ul>
               <button onClick={() => navigate('/register')} className="btn-primary" style={{width:"100%",textAlign:"center",display:"block",border:'none',cursor:'pointer',color:'#fff'}}>Get Started →</button>
             </div>
           </div>
           <p className="pricing-note">One subscription = one clinician. Each EP in your practice needs their own subscription.</p>
           <p className="pricing-note" style={{marginTop: "20px"}}>Looking for corporate pricing? <a href="mailto:admin@assesssuite.com?subject=Corporate%20Pricing%20Inquiry%20-%20AssessSuite%20Clinical" style={{color: "#2563eb", textDecoration: "none", fontWeight: 500}}>Reach out</a> for teams and multi-clinic practices.</p>
         </section>

        <section className="features" id="features">
           <h2>Everything an Exercise Physiologist needs.</h2>
           <p className="section-sub">From first assessment to final report — AssessSuite Clinical handles the clinical work and the paperwork.</p>
           <div className="features-grid">
             <div className="feature-card">
               <div className="feature-icon">🧪</div>
               <div className="feature-card-content"><h3>226+ EP Assessments</h3><p>Every test you run is built in — with clinician administration scripts, normative data, and interpretation guides. No more hunting for reference values mid-session. New assessments are added monthly, and missing ones can be requested directly from the platform.</p></div>
             </div>
             <div className="feature-card">
               <div className="feature-icon">📋</div>
               <div className="feature-card-content"><h3>Automated SOAP Notes</h3><p>Every completed assessment instantly generates a structured SOAP note populated with results, normative classifications, and clinical commentary. Zero typing required.</p></div>
             </div>
             <div className="feature-card">
               <div className="feature-icon">📄</div>
               <div className="feature-card-content"><h3>Funder-Ready Reports</h3><p>Generate professional EP reports tailored for NDIS, WorkCover, Medicare, DVA, and TAC — following best-practice guidelines with goal-based outcomes and objective data tables.</p></div>
             </div>
             <div className="feature-card">
               <div className="feature-icon">📈</div>
               <div className="feature-card-content"><h3>Progress Tracking</h3><p>Automatic pre and post comparisons across assessment dates. See exactly how your client is responding to intervention — with trend analysis built in.</p></div>
             </div>
             <div className="feature-card">
               <div className="feature-icon">👥</div>
               <div className="feature-card-content"><h3>Client & Episode Management</h3><p>Full client profiles with onboarding, referral tracking, episode history, funding sources, and client goals — all in one organised place.</p></div>
             </div>
             <div className="feature-card">
               <div className="feature-icon">🔒</div>
               <div className="feature-card-content"><h3>Digital Consent & Policies</h3><p>Capture signed consent, privacy agreements, and assessment policies digitally. Compliant, timestamped, and linked to every client episode.</p></div>
             </div>
             <div className="feature-card">
               <div className="feature-icon">💊</div>
               <div className="feature-card-content"><h3>Exercise Treatment Protocols</h3><p>Evidence-based exercise prescription and treatment protocols built in — so every client gets a structured, clinically justified program aligned to their assessment results and goals.</p></div>
             </div>
             <div className="feature-card">
               <div className="feature-icon">🥗</div>
               <div className="feature-card-content"><h3>Nutrition Within EP Scope</h3><p>Dietary guidance tools scoped specifically to Exercise Physiology practice — covering energy intake for chronic disease management, body composition, and physical performance. No dietetic advice, no scope creep. Just what EPs are qualified and registered to provide.</p></div>
             </div>
           </div>
           <div style={{marginTop: "40px", paddingTop: "40px", borderTop: "1px solid #e2e8f0", textAlign: "center"}}>
             <p style={{fontSize: "14px", color: "#64748b", maxWidth: "700px", margin: "0 auto"}}>
               <strong>Note:</strong> AssessSuite Clinical is assessment software built specifically for Exercise Physiologists. It is not clinic management software — it doesn't handle billing, referrer invoicing, or practice administration. It focuses on what EPs do: run assessments, generate SOAP notes, and create evidence-based reports.
             </p>
           </div>
         </section>

        <section className="final-cta">
          <h2>Ready to spend less time documenting<br />and more time with clients?</h2>
          <p>Join Exercise Physiologists already using AssessSuite Clinical to run better assessments, write better reports, and reclaim their clinical time.</p>
          <button onClick={() => navigate('/register')} className="btn-white" style={{display:"inline-block",border:'none',cursor:'pointer',color:'#fff'}}>Sign In / Sign Up →</button>
        </section>

        <footer>
          <div className="footer-top">
            <div className="footer-brand">
              <img 
                src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/29dfd4c64_Logo-Transparent1.png" 
                alt="AssessSuite Clinical Logo" 
                style={{maxWidth: "180px", marginBottom: "12px", filter: "brightness(0) invert(1)"}}
              />
            </div>

            <div className="footer-col">
              <div className="footer-col-title">Contact &amp; Support</div>
              <a href="tel:1800317553" style={{color:"#fff"}}>📞 1800 317 553</a>
              <a href="mailto:admin@assesssuite.com" style={{color:"#fff"}}>✉ admin@assesssuite.com</a>
              <div style={{fontSize:"12px",color:"#fff",marginTop:"4px"}}>Mon–Thu, 10:00am–2:00pm AEST</div>
            </div>

            <div className="footer-col">
              <div className="footer-col-title">About Us</div>
              <div style={{fontSize:"13px",color:"#fff",lineHeight:"1.7"}}>
                AssessSuite Clinical is a product of<br/>
                <strong style={{color:"#fff"}}>Assess Suite Pty Ltd</strong><br/>
                ABN 53 694 044 481<br/>
                Australian Private Company
              </div>
            </div>

            <div className="footer-col">
              <div className="footer-col-title">Legal</div>
              <Link to="/legal/privacy" style={{color:"#fff"}}>Privacy Policy</Link>
              <Link to="/legal/terms" style={{color:"#fff"}}>Terms of Service</Link>
            </div>
          </div>

          <div className="footer-bottom" style={{textAlign:"right", position:"relative"}}>
            <span style={{color:"#fff"}}>© 2026 Assess Suite Pty Ltd. All rights reserved.</span>

          </div>
        </footer>

      </div>

      {/* Privacy Policy and Terms of Service modals removed — this stale,
          June-2026-dated inline copy predated and diverged from the approved
          policy suite (RC-2026.07.11). The footer links above now point to
          the real /legal/privacy and /legal/terms routes, which render the
          approved suite text verbatim (src/legal-content/, documentRegistry.js).
          The "Coming Soon" gate on every sign-in/sign-up CTA was removed the
          same way — CTAs now navigate to /register directly. */}
    </>
  );
}