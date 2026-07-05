import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  ExternalLink,
  Stethoscope,
  Shield,
  Users,
  Briefcase,
  Car,
  Heart,
  Scale,
  Home,
  Globe,
  AlertCircle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  BookOpen,
  DollarSign,
  ClipboardList,
} from "lucide-react";

const australiaFundingData = [
  {
    id: "medicare",
    title: "Medicare — MBS Chronic Disease Management",
    icon: Stethoscope,
    color: "blue",
    badge: "Federal",
    reports_required: [
      "Initial letter to GP (clinic letterhead) — client details, functional assessment, goals, outcome measures, intervention plan",
      "Final/progress letter to GP after all sessions are completed or at 6-month review",
    ],
    session_limit: "5 subsidised sessions per calendar year (items 10953 / 81100)",
    item_numbers: [
      "10953 — Exercise Physiology individual consultation (CDM)",
      "81100 — Exercise Physiology group session (CDM)",
    ],
    key_requirements: [
      "GP must have completed a GP Management Plan (GPMP) or Team Care Arrangement (TCA)",
      "Patient must have a chronic or terminal medical condition",
      "Referral must be current — check expiry date",
      "Medicare rebate: ~$57.10 per individual session (indexed annually)",
      "No standard form — use clinic letterhead for all correspondence",
    ],
    notes: "You bill Medicare directly via HICAPS or bulk bill. Always confirm the referral number and dates before the first session. Telehealth items are available under items 91166 / 91167.",
    links: [
      { name: "MBS Item 10953", url: "https://www9.health.gov.au/mbs/fullDisplay.cfm?q=10953&type=item" },
      { name: "MBS Item 81100 (Group)", url: "https://www9.health.gov.au/mbs/fullDisplay.cfm?q=81100&type=item" },
      { name: "MBS Online Search", url: "https://www.mbsonline.gov.au/internet/mbsonline/publishing.nsf/Content/Home" },
    ],
  },
  {
    id: "dva",
    title: "Department of Veterans' Affairs (DVA)",
    icon: Shield,
    color: "red",
    badge: "Federal",
    reports_required: [
      "Patient Care Plan — completed at initial consultation and signed by client",
      "End-of-Cycle Report — after 12 sessions or when referral expires (billed as item EP90)",
      "Progress/status update letter — if requested by DVA case manager",
    ],
    session_limit: "12 sessions per referral cycle (White/Gold card holders)",
    item_numbers: [
      "EP10 — Initial consultation",
      "EP20 — Subsequent consultation (individual)",
      "EP40 — Group session",
      "EP90 — End-of-cycle report",
    ],
    key_requirements: [
      "Client must hold Gold, White, or Orange DVA card (check card type for eligibility)",
      "Must be a DVA-registered exercise physiologist",
      "Submit claims through HICAPS or DVA Health Connect",
      "Patient Care Plan must be on file before first billing",
      "End-of-Cycle report required before continuation of care",
    ],
    notes: "DVA fees are set separately from Medicare. Fee schedule updated annually (July). Always use the DVA templates — custom formats may cause claim rejection.",
    links: [
      { name: "DVA Patient Care Plan Template (PDF)", url: "https://www.dva.gov.au/sites/default/files/files/providers/healthcycle/patient-care-plan-template.pdf" },
      { name: "DVA End-of-Cycle Report Template (PDF)", url: "https://www.dva.gov.au/sites/default/files/files/providers/healthcycle/end-of-cycle-report-template.pdf" },
      { name: "DVA Fee Schedule 2024 (PDF)", url: "https://www.dva.gov.au/sites/default/files/2024-07/exphysfees-1-jul-2024.pdf" },
      { name: "DVA Health Provider Portal", url: "https://www.dva.gov.au/health-and-treatment/health-providers" },
    ],
  },
  {
    id: "ndis",
    title: "NDIS — National Disability Insurance Scheme",
    icon: Users,
    color: "purple",
    badge: "Federal",
    reports_required: [
      "Initial Assessment Report — functional capacity, barriers, goals aligned to NDIS plan",
      "Service Agreement — must be signed before services begin",
      "Progress Reports — typically quarterly or as requested by participant/LAC/support coordinator",
      "Functional Capacity Evaluation (FCE) — if requested as part of plan review",
      "Discharge/Transition Summary — when supports cease",
    ],
    key_requirements: [
      "Services must be 'reasonable and necessary' and aligned to NDIS plan goals",
      "Must be a registered NDIS provider (or unregistered for self-managed participants)",
      "Use NDIS support categories: Capacity Building (code 07) for most EP services",
      "All reports must reference specific NDIS goals from the participant's plan",
      "Service agreements must include pricing, frequency, and cancellation policy",
      "Claims via NDIS Provider Portal (myplace) or via plan management",
    ],
    report_keywords: ["reasonable and necessary","functional capacity","independence","community participation","evidence-based","goal-oriented","person-centred","sustainable outcomes","daily living","capacity building"],
    report_tips: [
      "Capacity Building: Describe measurable improvements in daily living skills and function",
      "Independence: Document progress toward greater autonomy with specific tasks",
      "Social Participation: Include community engagement and social outcomes",
      "Goal Achievement: Align all activities with NDIS plan goals — quote them directly",
      "Evidence-Based: Reference objective outcome measures with pre/post data",
    ],
    notes: "Support line item codes change annually. Always confirm current pricing from the NDIS Price Guide before billing. The most common EP item is 07_001_0106_1_3 (Therapeutic Supports).",
    links: [
      { name: "NDIS Pricing Arrangements", url: "https://www.ndis.gov.au/providers/pricing-arrangements" },
      { name: "NDIS Provider Portal (myplace)", url: "https://myplace.ndis.gov.au" },
      { name: "NDIS Support Catalogue", url: "https://www.ndis.gov.au/providers/pricing-arrangements/support-catalogue" },
      { name: "NDIS Registration", url: "https://www.ndis.gov.au/providers/becoming-ndis-registered-provider" },
    ],
  },
  {
    id: "workcoverqld",
    title: "Workers' Compensation — QLD (WorkCover QLD)",
    icon: Briefcase,
    color: "orange",
    badge: "State — QLD",
    reports_required: [
      "Provider Management Plan (PMP) — within first 5 sessions",
      "Progress Review Report — every 4–6 weeks or as requested",
      "Capacity Certificate / Work Status Report — as directed by insurer",
      "Discharge / RTW Summary — at end of episode of care",
    ],
    key_requirements: [
      "Must be an approved WorkCover QLD provider",
      "All claims submitted via WorkCover QLD portal or fax",
      "PMP must outline treatment goals, expected duration, and RTW plan",
      "Practitioners must use current QLD fee schedule (updated 1 July annually)",
    ],
    notes: "QLD was the first state to fund exercise physiology under workers' comp. Treatment must be 'reasonably necessary'. Dispute resolution via Workers' Compensation Regulator.",
    links: [
      { name: "QLD PMP Template", url: "https://www.worksafe.qld.gov.au/service-providers/allied-health-and-return-to-work-providers/provider-management-plans" },
      { name: "QLD EP Fee Schedule 2024 (PDF)", url: "https://www.worksafe.qld.gov.au/__data/assets/pdf_file/0029/129935/Exercise-Physiology-Services-1-July-2024.pdf" },
      { name: "WorkCover QLD Provider Portal", url: "https://www.worksafe.qld.gov.au" },
    ],
  },
  {
    id: "siraNSW",
    title: "Workers' Compensation — NSW (SIRA / icare)",
    icon: Briefcase,
    color: "orange",
    badge: "State — NSW",
    reports_required: [
      "Allied Health Treatment Request (AHTR) — required for treatment approval beyond initial sessions",
      "Allied Health Progress Report — every 4–6 weeks",
      "Initial Assessment Report — functional status, goals, RTW plan",
      "Discharge Summary — at end of episode of care",
    ],
    key_requirements: [
      "Must be accredited with SIRA as an exercise physiologist",
      "First 8 sessions do not require pre-approval; AHTR required after",
      "AHTR must include objective findings, goals, expected sessions, and RTW milestones",
      "icare manages claims for most NSW injured workers; ReturnToWork is for coal workers",
      "Telehealth available for approved clients",
    ],
    notes: "NSW has strict timeframes for AHTR submission. Submit via the icare provider portal. Fee schedule updated February each year.",
    links: [
      { name: "SIRA AHTR Form & Guide", url: "https://www.sira.nsw.gov.au/resources-library/for-healthcare-providers/allied-health-treatment-request-ahtr-downloads" },
      { name: "NSW EP Fee Schedule 2024 (PDF)", url: "https://www.sira.nsw.gov.au/__data/assets/pdf_file/0006/1280661/Accredited-exercise-physiology-fees-and-practice-requirements-effective-1-february-2024.pdf" },
      { name: "icare Provider Portal", url: "https://www.icare.nsw.gov.au/providers" },
    ],
  },
  {
    id: "workcoverVIC",
    title: "Workers' Compensation — VIC (WorkSafe Victoria)",
    icon: Briefcase,
    color: "orange",
    badge: "State — VIC",
    reports_required: ["Initial Assessment Report","Treatment Plan — submitted for approval","Progress Reviews every 4–6 weeks","Discharge Summary"],
    key_requirements: [
      "Must be a registered WorkSafe Victoria provider",
      "Treatment requests submitted via provider portal or agent",
      "WorkSafe claim managed by authorised agents (Allianz, Gallagher Bassett, EML, etc.)",
      "Always communicate with the assigned agent, not WorkSafe directly",
    ],
    notes: "VIC agent-based system means each client has an insurer agent who authorises treatment. Build a relationship with the agent early.",
    links: [
      { name: "WorkSafe VIC Provider Portal", url: "https://www.worksafe.vic.gov.au/healthcare-providers" },
      { name: "WorkSafe VIC Fee Schedule", url: "https://www.worksafe.vic.gov.au/healthcare-providers/fees-and-invoicing" },
    ],
  },
  {
    id: "rtwSA",
    title: "Workers' Compensation — SA (ReturnToWorkSA)",
    icon: Briefcase,
    color: "orange",
    badge: "State — SA",
    reports_required: ["Initial Assessment Report","Recovery/RTW Plan","Progress Reports — 4–6 weekly","Discharge / Closure Summary"],
    key_requirements: ["Must be registered with ReturnToWorkSA","All invoices via the ReturnToWorkSA provider portal","Use the ReturnToWorkSA fee schedule for exercise physiology"],
    notes: "SA uses a recovery-focused model. Reports should emphasise RTW goals and functional recovery milestones.",
    links: [
      { name: "ReturnToWorkSA Providers", url: "https://www.rtwsa.com/providers" },
      { name: "RTWSA Fee Schedule", url: "https://www.rtwsa.com/providers/fees-and-billing" },
    ],
  },
  {
    id: "workcoverWA",
    title: "Workers' Compensation — WA (WorkCover WA)",
    icon: Briefcase,
    color: "orange",
    badge: "State — WA",
    reports_required: ["Initial Consultation Report","Treatment Plan (with employer/insurer approval for ongoing care)","Progress Reports","Discharge Summary"],
    key_requirements: ["Must be registered with WorkCover WA","Exercise physiology recognised as a compensable allied health service","Fee schedule is specific to WA"],
    notes: "WA has a separate Medical Fee Schedule. Always check approval limits before extending treatment.",
    links: [
      { name: "WorkCover WA Providers", url: "https://www.workcover.wa.gov.au/health-providers/allied-health-providers/" },
      { name: "WA Medical Fee Schedule", url: "https://www.workcover.wa.gov.au/resources/rates-fees-payments/previous-years-fees/#skip-to-content" },
    ],
  },
  {
    id: "tacVIC",
    title: "Motor Accident — TAC (VIC)",
    icon: Car,
    color: "yellow",
    badge: "State — VIC",
    reports_required: ["Initial Functional Assessment — injury summary, functional deficits, goals","Treatment Plan — with expected sessions and milestones","Progress Reports — every 4–6 weeks or when requesting further sessions","Discharge Summary"],
    key_requirements: ["Must be a registered TAC provider","Pre-approval required beyond initial 10 sessions","Use TAC fee schedule (EP fees listed separately to physio)","Claims via TAC provider portal","Telehealth available for eligible clients"],
    notes: "TAC is well-funded but requires strong justification for ongoing care. Reports should focus on functional improvement with objective data.",
    links: [
      { name: "TAC Provider Portal", url: "https://www.tac.vic.gov.au/providers" },
      { name: "TAC Fee Schedule (EP)", url: "https://www.tac.vic.gov.au/providers/fees-and-payments" },
      { name: "TAC Treatment Request Form", url: "https://www.tac.vic.gov.au/providers/treatment-request-forms" },
    ],
  },
  {
    id: "maicQLD",
    title: "Motor Accident — MAIC (QLD)",
    icon: Car,
    color: "yellow",
    badge: "State — QLD",
    reports_required: ["Initial Assessment Report","Treatment Plan","Progress Reports / Invoices","Discharge Summary"],
    key_requirements: ["Services funded under the CTP scheme via MAIC","Claims submitted to the at-fault driver's CTP insurer (Suncorp, Allianz, QBE, RACQ)","Insurer pre-approves ongoing care","Fee schedule set by MAIC — check annually"],
    notes: "QLD CTP insurers vary — Suncorp, Allianz, QBE, RACQ. Always contact the insurer directly for claim number and authorisation. MAIC oversees the scheme.",
    links: [
      { name: "MAIC QLD Provider Info", url: "https://maic.qld.gov.au/for-service-providers/" },
      { name: "MAIC Fee Schedule", url: "https://maic.qld.gov.au/for-service-providers/fees-and-charging/" },
    ],
  },
  {
    id: "maOther",
    title: "Motor Accident — Other States (NRMA, CTP, etc.)",
    icon: Car,
    color: "yellow",
    badge: "Multi-State",
    reports_required: ["Initial Assessment Report","Treatment Plan (approved by insurer)","Progress Reports","Discharge Summary"],
    key_requirements: ["NSW: SIRA CTP scheme — submit to fault insurer (NRMA, Allianz, QBE, etc.)","SA: CTP scheme managed by the Motor Accident Commission (now administered via approved insurers e.g. EML) — approval via insurer","WA: Insurance Commission of WA (ICWA)","ACT: MACA scheme via ACT Insurance Authority","TAS: Motor Accidents Insurance Board (MAIB)","Each state has its own fee schedule and approval process"],
    notes: "CTP motor accident schemes are state-based. Always get claim number, insurer contact, and pre-approval in writing before commencing or extending care.",
    links: [
      { name: "SIRA NSW CTP", url: "https://www.sira.nsw.gov.au/for-people-injured-in-a-car-accident" },
      { name: "CTP SA", url: "https://www.ctp.sa.gov.au/" },
      { name: "ICWA WA", url: "https://www.icwa.wa.gov.au" },
      { name: "MAIB TAS", url: "https://maib.tas.gov.au/" },
    ],
  },
  {
    id: "myagedcare",
    title: "My Aged Care — Home Care Packages (HCP)",
    icon: Home,
    color: "green",
    badge: "Federal",
    reports_required: ["Initial Functional Assessment — ADL function, mobility, risk factors, goals","Individual Care Plan — aligned to client's HCP goals","Progress Notes — as per service agreement frequency","Annual Review Report — recommended for case manager","Discharge Summary — when services end"],
    session_limit: "Determined by HCP level (L1–L4) and package budget",
    key_requirements: ["Client must be approved for HCP through My Aged Care portal","Services funded through HCP provider (not billed directly to My Aged Care)","Service Agreement required with client and package provider","Package Level 1: ~$10,271/yr, Level 2: ~$17,951/yr, Level 3: ~$38,597/yr, Level 4: ~$58,689/yr (2024–25)","Focus on: maintaining independence, falls prevention, mobility, function","Transition to Support at Home program from July 2025"],
    notes: "You are a sub-contractor to the HCP provider (e.g., BlueCare, Benetas, etc.). Negotiate your rate with the provider. Reports go to the case manager, not My Aged Care directly.",
    links: [
      { name: "My Aged Care Provider Portal", url: "https://hpe.servicesaustralia.gov.au/ACPP_general.html" },
      { name: "HCP Program Manual", url: "https://www.health.gov.au/resources/collections/home-care-packages-program-resources" },
      { name: "Support at Home (from July 2025)", url: "https://www.health.gov.au/our-work/support-at-home" },
    ],
  },
  {
    id: "chsp",
    title: "Commonwealth Home Support Programme (CHSP)",
    icon: Home,
    color: "green",
    badge: "Federal",
    reports_required: ["Initial Assessment / Client Profile","Individualised Support Plan","Progress Notes (as per funding agreement)","Exit Summary when services end"],
    key_requirements: ["Entry-level aged care — lower complexity than HCP","Client must have CHSP approval via My Aged Care","Services funded via Commonwealth grant to approved CHSP providers","Co-contribution from client may apply","Allied health includes: EP, physio, OT, podiatry, dietetics","Transitioning into Support at Home from July 2025"],
    notes: "CHSP is typically group or short-term individual services. EP may provide gym-based programs, falls prevention classes, or home exercise prescription. Funding is via the provider organisation, not fee-for-service.",
    links: [
      { name: "CHSP Program Manual", url: "https://www.health.gov.au/resources/publications/commonwealth-home-support-program-chsp-2025-27-manual-from-1-november-2025?language=en" },
      { name: "My Aged Care — CHSP", url: "https://www.myagedcare.gov.au/help-at-home/commonwealth-home-support-programme" },
    ],
  },
  {
    id: "privatehealth",
    title: "Private Health Insurance",
    icon: Heart,
    color: "pink",
    badge: "Private",
    reports_required: ["Generally no standard reports required","Justification letter may be requested for chronic or complex cases","Treat note for own records (recommended)"],
    key_requirements: ["Claim via HICAPS terminal using provider number and item code","Rebate amount varies by fund and policy level (Basic, Bronze, Silver, Gold)","Client must have extras cover that includes 'Exercise Physiology' or 'Allied Health'","Some funds require pre-approval for large claims or chronic disease programs","Common funds: Medibank, Bupa, HCF, NIB, HBF, CBHS, AHM, Teachers Health, Police Health","Rebate typically: $30–$65 per session depending on fund/policy"],
    notes: "Always verify with the client that their policy includes EP before billing. Rates are not standardised — clients often have different rebates for the same service.",
    links: [
      { name: "HICAPS Provider Info", url: "https://www.hicaps.com.au/" },
      { name: "Check Health Fund Rebates", url: "https://www.privatehealth.gov.au/dynamic/search/start" },
      { name: "Medibank Provider Info", url: "https://www.medibank.com.au/health-insurance/info/extras/exercise-physiology" },
    ],
  },
  {
    id: "selfmanaged",
    title: "Self-Funded / Private Pay",
    icon: DollarSign,
    color: "gray",
    badge: "Private",
    reports_required: ["No mandatory reports — provide as clinically indicated","Standard treatment notes for own records","Referral letters to GP or specialists if requested"],
    key_requirements: ["Fee set by practice — no schedule constraints","Invoice with ABN, provider number, and itemised service description","Offer receipt for potential tax deduction (if medically related)"],
    notes: "Self-funded clients have the most flexibility in treatment design. Still maintain clinical records to the same standard.",
    links: [],
  },
  {
    id: "legal",
    title: "Legal / Income Protection / TPD / Life Insurance",
    icon: Scale,
    color: "gray",
    badge: "Private / Legal",
    reports_required: ["Functional Capacity Evaluation (FCE) — detailed assessment of work and daily capacity","Medico-Legal Report — comprehensive, structured to solicitor's brief","Summary of restrictions and functional limitations","Treatment recommendations and prognosis","Expert witness report (if required for court/tribunal)"],
    key_requirements: ["Reports commissioned by solicitor, insurer, or case manager — follow their brief","Rate is negotiated case-by-case (typically $200–$400+ per hour)","Must hold appropriate professional indemnity insurance","FCE must use standardised, validated tools and be defensible","Maintain strict neutrality — report facts, not advocacy"],
    notes: "Turnaround times vary. Always confirm brief, fee, and deadline in writing before commencing. Retain all raw data and test results.",
    links: [{ name: "ESSA FCE Guidelines", url: "https://www.essa.org.au" }],
  },
  {
    id: "stateCancer",
    title: "Cancer Council / Cancer-Related Programs",
    icon: Heart,
    color: "purple",
    badge: "Non-Government",
    reports_required: ["Referral / intake form as required by program","Initial Assessment and individualised exercise plan","Progress Report at program midpoint and end"],
    key_requirements: ["Cancer Council programs vary by state — exercise physiology often funded via grants","Cancer Council WA: Life Now Exercise Program","Cancer Council QLD / Livestrong programs — check local availability","Prostate Cancer Foundation, Breast Cancer Network — specific programs","Some programs accessed via GP referral or direct self-referral"],
    notes: "Cancer programs are typically short-course, group-based, or subsidised. Funding and eligibility criteria vary widely by state and program. Contact your state Cancer Council for current programs.",
    links: [
      { name: "Cancer Council WA — Life Now Exercise", url: "https://cancerwa.asn.au/health-professionals/allied-health-professionals/" },
      { name: "Cancer Council Australia", url: "https://www.cancer.org.au" },
      { name: "Exercise Medicine Research Institute", url: "https://exercisemedicine.org.au" },
    ],
  },
  {
    id: "stateGovt",
    title: "State / Territory Government Programs",
    icon: Globe,
    color: "teal",
    badge: "State",
    reports_required: ["Varies by program — follow individual program guidelines","Standard assessment and progress reports usually required"],
    key_requirements: ["QLD: Community Sport and Recreation, Hospital Avoidance programs","NSW: HealthPathways, NSW Health community programs","VIC: Healthy Ageing programs, Local Government grants","SA: SA Health community programs","WA: WA Health Chronic Disease programs","ACT / NT / TAS: Check health department websites for current programs"],
    notes: "State and territory programs are often grant-funded and change each year. Check your local Primary Health Network (PHN) for referral pathways and current funded programs.",
    links: [
      { name: "Find Your PHN", url: "https://www.health.gov.au/initiatives-and-programs/primary-health-networks/find-your-phn" },
      { name: "QLD Health Community Programs", url: "https://www.health.qld.gov.au" },
      { name: "NSW Health", url: "https://www.health.nsw.gov.au" },
      { name: "VIC Health Programs", url: "https://www.health.vic.gov.au" },
    ],
  },
];

const usaFundingData = [
  {
    id: "usa-core",
    title: "Core Documentation Pack (All Payers)",
    icon: ClipboardList,
    color: "blue",
    badge: "Universal",
    reports_required: ["Initial Evaluation / Examination — patient history, objective findings, functional status, diagnosis","Plan of Care (POC) — goals, frequency, duration, skilled need justification","Progress Report / Re-examination — periodic, with outcome measures showing change","Discharge Summary — outcomes achieved, home program, recommendations","Prior Authorization Packet — when required by payer"],
    key_requirements: ["Always include objective outcome measures (TUG, 6MWT, FIM, etc.) with pre/post data","Document 'skilled need' explicitly — why a licensed clinician is required","Show functional progress toward measurable goals","Keep all signatures, dates, and NPI numbers complete","Retain records for minimum 7 years (varies by state)"],
    notes: "This core set applies across Medicare, Medicaid, VA, TRICARE, and commercial payers. Add payer-specific forms and addenda on top of this baseline.",
    links: [{ name: "APTA Documentation Elements", url: "https://www.apta.org/your-practice/documentation" }],
  },
  {
    id: "usa-medicare",
    title: "Medicare (Part B) — Outpatient Rehab Therapy",
    icon: Stethoscope,
    color: "blue",
    badge: "Federal",
    reports_required: ["Initial Evaluation / Examination","Plan of Care (POC) — physician/NPP certification required every 90 days","Progress Report — required at least every 10 treatment days (functional maintenance)","Discharge Summary","Functional Limitation Reporting (G-codes) — on applicable claims"],
    session_limit: "No hard cap — subject to therapy cap exceptions & KX modifier above $2,230/year (2024)",
    key_requirements: ["Physician or NPP must certify/re-certify the plan of care","KX modifier required when therapy cap threshold is exceeded (medical necessity documentation required)","AT modifier required for maintenance therapy (chronic conditions)","CMS PQRS/Quality Payment Program — report applicable measures","Medicare Advantage (Part C) plans may have additional requirements","Telehealth PT/OT covered under select circumstances (check current CMS guidance)"],
    notes: "Medicare audits are common. Keep documentation airtight — skilled need, functional goals, measurable progress. Use CMS MLN resources as your documentation benchmark.",
    links: [
      { name: "CMS Outpatient Rehab Documentation (PDF)", url: "https://www.cms.gov/files/document/mln905365-complying-outpatient-rehabilitation-therapy-documentation-requirements.pdf" },
      { name: "CMS Therapy Services Overview", url: "https://www.cms.gov/medicare/coding-billing/therapy-services" },
      { name: "CMS Medicare Learning Network", url: "https://www.cms.gov/outreach-and-education/medicare-learning-network-mln/mlnproducts" },
    ],
  },
  {
    id: "usa-medicaid",
    title: "Medicaid (State-Administered)",
    icon: Users,
    color: "purple",
    badge: "Federal / State",
    reports_required: ["Initial Evaluation / Examination","Prior Authorization Packet — required in most states for PT/OT/SLP","Plan of Care (POC)","Progress Reports — for re-authorization","Discharge Summary"],
    key_requirements: ["Medicaid rules vary significantly by state — always check state-specific Medicaid manual","Most states use Managed Care Organizations (MCOs) — each MCO has its own auth process","Prior auth denial is common; build objective, functional justification into every packet","EPSDT covers children — broader scope than adult Medicaid","Session limits vary: typically 20–60 visits/year depending on state and diagnosis"],
    notes: "Always capture the MCO name, plan ID, and authorization number before treatment. Some states require specific evaluation forms. Check state Medicaid portal for current fee schedules.",
    links: [
      { name: "Medicaid.gov Provider Info", url: "https://www.medicaid.gov/medicaid/index.html" },
      { name: "MACPAC — Prior Auth in Medicaid (PDF)", url: "https://www.macpac.gov/wp-content/uploads/2024/08/Prior-Authorization-in-Medicaid.pdf" },
    ],
  },
  {
    id: "usa-chip",
    title: "CHIP — Children's Health Insurance Program",
    icon: Heart,
    color: "pink",
    badge: "Federal / State",
    reports_required: ["Initial Evaluation / Examination","Prior Authorization Packet (if required by state plan)","Plan of Care","Progress Reports for re-authorization","Discharge Summary"],
    key_requirements: ["Covers children in families that earn too much for Medicaid but cannot afford private insurance","Administered by states — documentation requirements similar to state Medicaid","EPSDT benefit applies","Most states process CHIP and Medicaid through the same MCO networks"],
    notes: "CHIP is handled through your state's Medicaid agency. If you bill Medicaid in your state, CHIP billing is typically the same system and process.",
    links: [
      { name: "CHIP Overview — healthcare.gov", url: "https://www.healthcare.gov/medicaid-chip/childrens-health-insurance-program/" },
      { name: "Medicaid.gov — CHIP State Plans", url: "https://www.medicaid.gov/chip/state-program-information/index.html" },
    ],
  },
  {
    id: "usa-va",
    title: "Veterans Affairs (VA) — Community Care Network",
    icon: Shield,
    color: "red",
    badge: "Federal",
    reports_required: ["Initial Evaluation / Examination","Progress Updates — as requested or at episode milestones","Discharge Summary — submit promptly after services end"],
    key_requirements: ["Community care requires VA referral / authorization — do NOT see patient without it","Record authorization number and date on every note and invoice","Submit medical documentation to VA within 30 days of last visit","Optum (TriWest in some regions) manages Community Care Network — bill them, not VA directly"],
    notes: "The VA is one of the better-paying payers but documentation timeliness is strictly enforced. Delays in submitting notes can affect payment and future referrals.",
    links: [
      { name: "VA Community Care Fact Sheet (PDF)", url: "https://www.va.gov/COMMUNITYCARE/docs/pubfiles/factsheets/FactSheet_27-02.pdf" },
      { name: "VA Provider Reference Library", url: "https://www.va.gov/COMMUNITYCARE/providers/reference.asp" },
    ],
  },
  {
    id: "usa-tricare",
    title: "TRICARE — Military Health System",
    icon: Shield,
    color: "red",
    badge: "Federal",
    reports_required: ["Initial Evaluation / Examination","Prior Authorization Packet — required for most outpatient PT/OT","Progress Report — for re-authorization or continued care","Discharge Summary"],
    key_requirements: ["Must be a TRICARE-authorized provider","TRICARE Prime requires referral from Primary Care Manager (PCM)","TRICARE Select: no referral needed but prior auth may apply","TRICARE For Life (TFL): Medicare crossover plan — follow Medicare documentation rules"],
    notes: "TRICARE rules vary by plan. TRICARE For Life is the most straightforward (Medicare secondary). Always verify beneficiary plan type before scheduling.",
    links: [
      { name: "TRICARE — Referrals and Pre-Authorizations", url: "https://tricare.mil/GettingCare/ReferralsPreAuth" },
      { name: "TRICARE Provider Resources", url: "https://www.tricare.mil/About/Partners/Providers" },
    ],
  },
  {
    id: "usa-workcomp",
    title: "Workers' Compensation (State-Based)",
    icon: Briefcase,
    color: "orange",
    badge: "State",
    reports_required: ["Initial Work Capacity Evaluation","Initial Assessment Report — diagnosis, mechanism of injury, treatment plan","Work Status Report / Capacity Certificate — periodic, with explicit RTW restrictions","Progress Report — every 4–6 weeks","FCE — often requested at claim closure or dispute","Discharge / RTW Summary"],
    key_requirements: ["Rules vary by state — each state has its own WC fee schedule and forms","Major states: CA (DWC), TX (TDI), NY (NYSIFS), FL (DFS), IL (IWCC)","California: Most restrictive — MTUS guidelines govern treatment decisions","Most states require provider to be on approved/certified provider list"],
    notes: "Workers' comp adjusters are often the gatekeeper for ongoing treatment. Build adjuster relationships and submit clear, objective reports that justify the clinical value of services.",
    links: [
      { name: "APTA WC Documentation Guide", url: "https://www.apta.org/your-practice/documentation" },
      { name: "CA DWC Provider Info", url: "https://www.dir.ca.gov/dwc/HCProviders.htm" },
    ],
  },
  {
    id: "usa-commercial",
    title: "Commercial / Private Insurance",
    icon: Heart,
    color: "pink",
    badge: "Private",
    reports_required: ["Initial Evaluation / Examination","Prior Authorization Packet — required by most major plans","Progress Report — typically every 4–6 weeks for re-authorization","Discharge Summary"],
    key_requirements: ["Prior auth is standard — submit early (2–3 business days before first visit)","Major insurers: UnitedHealthcare, Anthem (BCBS), Aetna, Cigna, Humana","CPT codes: 97110 (therapeutic exercise), 97530 (therapeutic activities), 97001 (initial eval)","Visit limits vary: typically 20–60 visits/year"],
    notes: "Commercial payers are the most variable. Always verify: (1) patient's specific plan, (2) PT/OT benefits, (3) prior auth requirements, (4) network status. Appeal denials with clinical documentation.",
    links: [
      { name: "UnitedHealthcare Provider Portal", url: "https://www.unitedhealthcareonline.com" },
      { name: "Aetna Provider Resources", url: "https://www.aetna.com/health-care-professionals" },
      { name: "Cigna Provider Portal", url: "https://cignaforhcp.cigna.com" },
      { name: "Anthem (BCBS) Provider Portal", url: "https://www.anthem.com/provider/" },
    ],
  },
  {
    id: "usa-selfpay",
    title: "Self-Pay / Cash Pay",
    icon: DollarSign,
    color: "gray",
    badge: "Private",
    reports_required: ["No mandatory payer reports","Standard treatment notes for own records","Superbill provided to patient for self-submission to insurer (if requested)"],
    key_requirements: ["Set fees at practice discretion","Provide itemised superbill with CPT codes, diagnosis (ICD-10), NPI, and date of service","Good Faith Estimate required under No Surprises Act for uninsured patients"],
    notes: "Self-pay is increasingly common for concierge or direct-pay PT practices. Still document clinically as if billing insurance — it protects you legally.",
    links: [{ name: "CMS — No Surprises Act (Good Faith Estimate)", url: "https://www.cms.gov/nosurprises/consumers/good-faith-estimates" }],
  },
  {
    id: "usa-autoinsurance",
    title: "Auto / Motor Vehicle Accident Insurance",
    icon: Car,
    color: "yellow",
    badge: "State / Private",
    reports_required: ["Initial Evaluation / Examination","Accident-related injury documentation","Progress Reports — submitted to adjuster","Functional Status Reports","Discharge Summary","Medical-legal report (if litigation involved)"],
    key_requirements: ["PIP (Personal Injury Protection) — no-fault states: FL, NY, NJ, MI, PA, etc.","At-fault states: bill at-fault driver's liability insurer (via attorney or adjuster)","Letter of Protection (LOP): attorney guarantees payment from settlement","Documentation must link all findings to the accident (causation is key)"],
    notes: "Auto injury cases often involve attorneys. If you receive a letter of protection, ensure your practice has a written agreement. Document every session — these records may be used in court.",
    links: [{ name: "NCSL — No-Fault Auto Insurance Laws by State", url: "https://www.ncsl.org/financial-services/auto-insurance/no-fault-auto-insurance" }],
  },
  {
    id: "usa-schoolbased",
    title: "School-Based Services (IDEA / Part B & C)",
    icon: Users,
    color: "teal",
    badge: "Federal / State",
    reports_required: ["Evaluation Report — per IDEA Part B (school age) or Part C (early intervention)","Individualized Education Program (IEP) — PT/OT goals and minutes","IFSP (Individualized Family Service Plan) — for Part C (0–3 years)","Progress Reports — tied to IEP reporting periods","Annual Review / Re-evaluation (every 3 years)"],
    key_requirements: ["Part B (3–21 years): PT/OT services written into IEP by the school team","Part C (0–3 years): Early intervention services via IFSP","All services must relate to educational performance, not medical need"],
    notes: "School-based PT/OT is education-focused, not medical. Goals relate to participation in the educational environment. Medicaid can be billed concurrently in many states for eligible students.",
    links: [{ name: "IDEA — OSERS Overview", url: "https://sites.ed.gov/idea/" }],
  },
  {
    id: "usa-hospice",
    title: "Hospice & Palliative Care",
    icon: Heart,
    color: "purple",
    badge: "Medicare / Medicaid",
    reports_required: ["Comfort-focused evaluation — function, safety, comfort goals","Plan of Care contributions within the interdisciplinary team (IDT)","Progress Notes","IDT meeting documentation"],
    key_requirements: ["PT/OT services in hospice must be comfort-focused (not rehabilitative)","Included in Medicare Hospice Benefit (per diem rate — no separate PT/OT billing)","Palliative care (non-hospice): may bill Medicare Part B or commercial normally"],
    notes: "In hospice, PT/OT is part of the bundled per diem — not separately billed. In palliative care clinics (non-hospice), standard outpatient billing applies.",
    links: [
      { name: "CMS Hospice Benefit Overview", url: "https://www.cms.gov/Medicare/Medicare-Fee-for-Service-Payment/Hospice" },
      { name: "APTA — Hospice and Palliative Care", url: "https://www.apta.org/your-practice/practice-settings/hospice-and-palliative-care" },
    ],
  },
];

const ukFundingData = [
  {
    id: "uk-nhs-ers",
    title: "NHS Exercise Referral Scheme (ERS)",
    icon: Stethoscope,
    color: "blue",
    badge: "NHS England",
    reports_required: ["Initial Assessment Report — baseline fitness, health screen, contraindications, goals","Progress Report — mid-programme update to referring GP/practice nurse","Completion/Discharge Report — outcomes, adherence, recommendations for ongoing activity","Non-Completion Report — if client exits early, reason documented"],
    session_limit: "Typically 12–24 weeks depending on local ICB commissioning",
    key_requirements: ["Referral must come from a GP, practice nurse, or other qualified healthcare professional","Client must have a long-term condition, be sedentary, or be at clinical risk","Exercise professionals must hold Level 3 Exercise Referral qualification (REPs/CIMSPA recognised)","PARQ+ or equivalent pre-participation health screen required","Schemes vary by ICB (Integrated Care Board) — always get local ERS pathway documentation"],
    notes: "NHS ERS is commissioned locally by Integrated Care Boards. Rules, report formats, and fees vary significantly by region. CEP-UK is the main professional body for CEPs. AHCS registration is the gold-standard register.",
    links: [
      { name: "NICE PH54 — Exercise Referral Guideline", url: "https://www.nice.org.uk/guidance/ph54" },
      { name: "CIMSPA — Exercise Referral Standards", url: "https://www.cimspa.co.uk/library-and-resources/cimspa-professional-standards/" },
      { name: "CEP-UK — Clinical Exercise Physiology UK", url: "https://www.clinicalexercisephysiology.org.uk" },
      { name: "AHCS — Clinical Exercise Physiologist Register", url: "https://www.ahcs.ac.uk" },
    ],
  },
  {
    id: "uk-nhs-cardiac",
    title: "NHS Cardiac Rehabilitation (Phase III/IV)",
    icon: Heart,
    color: "red",
    badge: "NHS England",
    reports_required: ["Initial Clinical Assessment — CPET results, cardiovascular risk, contraindications, goals","Phase III Completion Report — discharge outcomes including exercise capacity, risk factor change","Phase IV Referral Letter — onward referral to community maintenance programme","Adverse Event Report — any clinical incidents during exercise sessions"],
    session_limit: "Phase III: typically 8–12 weeks (BACPR standard); Phase IV: ongoing community",
    key_requirements: ["Must follow BACPR (British Association for Cardiovascular Prevention & Rehabilitation) standards","Minimum qualification: Level 4 Exercise Instructor — Cardiac Rehabilitation","NACR (National Audit of Cardiac Rehabilitation) data submission required for NHS teams","Risk stratification using validated tools (e.g. CPET, Bruce protocol, ISWT)"],
    notes: "BACPR standards are the gold standard for UK cardiac rehab. NACR audit data is submitted annually for all NHS programmes.",
    links: [
      { name: "BACPR — Standards and Core Components", url: "https://www.bacpr.com" },
      { name: "NACR — National Audit of Cardiac Rehab", url: "https://www.nacr.org.uk" },
      { name: "NICE NG185 — Cardiac Rehab Guideline", url: "https://www.nice.org.uk/guidance/ng185" },
    ],
  },
  {
    id: "uk-nhs-pulmonary",
    title: "NHS Pulmonary Rehabilitation",
    icon: Stethoscope,
    color: "teal",
    badge: "NHS England",
    reports_required: ["Initial Assessment — spirometry, MRC dyspnoea scale, 6MWT or ISWT, SGRQ/CAT","Mid-Programme Review — attendance, progress, clinical changes","Completion Report — outcome measures, exercise capacity change, PROM scores, onward referral","Non-Completion/Dropout Report — reason and clinical status at exit"],
    session_limit: "Minimum 12 supervised sessions per NICE guideline NG115",
    key_requirements: ["Referral from GP or respiratory specialist required","Indicated for: COPD (FEV1/FVC < 0.7), ILD, bronchiectasis, other chronic respiratory conditions","Must follow BTS/ACPRC Pulmonary Rehabilitation guidelines","NACAP data submission required for NHS services"],
    notes: "Pulmonary rehab is among the most evidence-based NHS exercise interventions. NICE NG115 mandates access to PR for eligible COPD patients.",
    links: [
      { name: "NICE NG115 — Pulmonary Rehabilitation", url: "https://www.nice.org.uk/guidance/ng115" },
      { name: "British Thoracic Society Guidelines", url: "https://www.brit-thoracic.org.uk" },
    ],
  },
  {
    id: "uk-nhs-cancer",
    title: "NHS Cancer Rehabilitation / MOVE More",
    icon: Heart,
    color: "purple",
    badge: "NHS / Macmillan",
    reports_required: ["Holistic Needs Assessment (HNA) — completed with patient pre/post programme","Initial Exercise Assessment — fitness level, contraindications, treatment-related side effects","MOVE More Progress Report — attendance, exercise capacity, wellbeing outcomes","End-of-Programme Report — outcomes, recommendations, onward referral"],
    session_limit: "Varies by programme — typically 8–12 weeks",
    key_requirements: ["MOVE More accreditation (Macmillan Cancer Support) strongly recommended","Level 4 Cancer Rehab Exercise Instructor qualification required","Close liaison with oncology MDT required","Outcome tools: FACT-G, HADS, 6MWT, grip strength, EORTC QLQ-C30"],
    notes: "Macmillan's MOVE More programme accredits cancer exercise services. NHS Long Term Plan commits to cancer rehab as standard.",
    links: [
      { name: "Macmillan MOVE More Programme", url: "https://www.macmillan.org.uk/healthcare-professionals/innovation-in-cancer-care/move-more" },
      { name: "CEP-UK Cancer Resources", url: "https://www.clinicalexercisephysiology.org.uk/resources" },
    ],
  },
  {
    id: "uk-pmi",
    title: "Private Medical Insurance (PMI)",
    icon: Shield,
    color: "green",
    badge: "Private",
    reports_required: ["Initial Assessment / Consultation Report","Treatment / Rehabilitation Plan","Progress Reports — at intervals required by insurer (typically every 4–6 sessions)","Discharge Report"],
    key_requirements: ["Prior authorisation required from insurer before starting treatment","Major insurers: BUPA, AXA Health, Aviva, Vitality, Cigna UK, WPA","Must be on insurer's approved provider panel","AHCS registration or equivalent required by most PMI providers","ICD-10 diagnosis codes required on all claims"],
    notes: "PMI coverage for CEPs is growing. BUPA and AXA are most likely to fund exercise physiology/rehabilitation. Vitality actively funds exercise services as part of their wellness model.",
    links: [
      { name: "BUPA Provider Portal", url: "https://provider.bupa.co.uk" },
      { name: "AXA Health Provider Hub", url: "https://www.axahealth.co.uk/health-professionals" },
      { name: "Vitality Health Provider", url: "https://www.vitality.co.uk/health/professionals/" },
    ],
  },
  {
    id: "uk-fitnote",
    title: "Fit Note / Return to Work (DWP / Occupational Health)",
    icon: Briefcase,
    color: "orange",
    badge: "DWP / Employer",
    reports_required: ["Functional Capacity / Work Capacity Assessment Report — physical tolerances and limitations","Return to Work Progress Report — for employer, HR, or occupational health","FCE Report — if requested by employer, occupational health, or DWP"],
    key_requirements: ["Fit Notes are issued by GPs — CEPs support the RTW process with functional reports","Report must address: physical demands of specific job role vs. client's current functional capacity","DWP Work Capability Assessment may use your report as supporting evidence","PIP (Personal Independence Payment) functional reports may support applications"],
    notes: "CEPs are increasingly working in occupational health and RTW settings. Keep reports factual and objective — avoid commenting on benefit entitlement.",
    links: [
      { name: "DWP — Fit Note Guidance for Employers", url: "https://www.gov.uk/government/publications/fit-note-guidance-for-employers-and-line-managers" },
      { name: "DWP — Functional Assessment Guide", url: "https://www.gov.uk/government/collections/functional-assessment-guide" },
    ],
  },
  {
    id: "uk-self-pay",
    title: "Self-Pay / Private Practice",
    icon: DollarSign,
    color: "gray",
    badge: "Private",
    reports_required: ["No mandatory payer forms","Clinical notes for own records","GP / Specialist Summary Letter — on request"],
    key_requirements: ["ICO registration required for UK-GDPR/data protection compliance","Professional indemnity insurance required","AHCS/RCEP registration strongly recommended"],
    notes: "Self-pay CEP rates in the UK typically range £50–£120/session (2024). Register with the ICO for data protection. CEP-UK membership provides professional support, CPD resources, and job description templates.",
    links: [
      { name: "ICO — Data Protection Registration", url: "https://ico.org.uk/for-organisations/register" },
      { name: "CEP-UK Professional Resources", url: "https://www.clinicalexercisephysiology.org.uk/resources" },
      { name: "RCEP — Registered Clinical Exercise Physiologist", url: "https://www.ahcs.ac.uk/registers/clinical-exercise-physiologist" },
    ],
  },
];

const canadaFundingData = [
  {
    id: "ca-wsib",
    title: "WSIB — Ontario Workplace Safety & Insurance Board",
    icon: Briefcase,
    color: "orange",
    badge: "Province — ON",
    reports_required: ["Functional Abilities Form (FAF) — must use WSIB-approved form 2647A","Initial Assessment Report — injury mechanism, functional limitations, treatment plan","Work Transition Assessment (if applicable) — for modified/alternate work planning","Progress Reports — typically every 4–6 weeks as requested by WSIB case manager","FCE Report — requested at claim plateau or dispute","Discharge / Return-to-Work Summary"],
    session_limit: "Pre-approved blocks — typically 10–15 sessions; extension requires justification",
    key_requirements: ["Must be registered with WSIB as an approved provider before billing","Kinesiologists (R.Kin) are the recognised EP-equivalent in Ontario","Use WSIB Functional Abilities Form (2647A) — not custom letterhead","Document work-specific functional tolerances: sit, stand, lift, carry, bend, reach","R.Kin regulated under Ontario Kinesiology Act"],
    notes: "In Ontario, the Kinesiology Act regulates the profession. R.Kin is the recognised credential for exercise physiology-equivalent practice. WSIB billing requires separate WSIB provider registration.",
    links: [
      { name: "WSIB — Health Care Provider Registration", url: "https://www.wsib.ca/en/health-care-providers" },
      { name: "WSIB — Functional Abilities Form (FAF)", url: "https://www.wsib.ca/en/functional-abilities-form" },
      { name: "Ontario Kinesiology Association", url: "https://www.oka.on.ca" },
    ],
  },
  {
    id: "ca-worksafebc",
    title: "WorkSafeBC — British Columbia",
    icon: Briefcase,
    color: "red",
    badge: "Province — BC",
    reports_required: ["Functional Capacity Assessment (FCA) Report — WorkSafeBC standardised format","Initial Assessment / Treatment Plan","Progress Reports — submitted to WorkSafeBC adjudicator","Work Capacity Evaluation — functional tolerances and job demands analysis","Discharge / RTW Summary"],
    session_limit: "Pre-approved blocks — adjudicator must approve extensions beyond initial authorisation",
    key_requirements: ["Must be registered with College of Kinesiologists of BC (CKIN)","Regulated under BC Health Professions Act — Kinesiology Regulation","Use WorkSafeBC billing codes and approved fee schedule","FCAs must follow WorkSafeBC standardised methodology"],
    notes: "WorkSafeBC fee schedules are published annually. CKIN regulates kinesiology in BC. Always document objective functional measures — WorkSafeBC reviews reports for evidence of functional progression.",
    links: [
      { name: "WorkSafeBC — Health Care Providers", url: "https://www.worksafebc.com/en/health-care-providers" },
      { name: "College of Kinesiologists of BC (CKIN)", url: "https://www.ckin.bc.ca" },
      { name: "WorkSafeBC — Fee Schedules", url: "https://www.worksafebc.com/en/health-care-providers/billing-payments" },
    ],
  },
  {
    id: "ca-wcb-alberta",
    title: "WCB Alberta — Workers' Compensation Board",
    icon: Briefcase,
    color: "orange",
    badge: "Province — AB",
    reports_required: ["Functional Capacity Evaluation (FCE) Report — if requested by WCB adjudicator","Initial Assessment Report","Functional Progress Report — every 4–6 weeks","Return to Work Readiness Report","Discharge Summary"],
    session_limit: "Pre-approved in blocks — typically up to 12 sessions initially",
    key_requirements: ["WCB Alberta billing requires enrolment as an approved provider","Use WCB Alberta approved fee schedule and billing codes","FCEs must use validated methodology (e.g. Isernhagen, Blankenship)","Alberta Kinesiology Association (AKA) membership demonstrates professional standing"],
    notes: "Alberta kinesiology is not yet legislatively regulated but AKA membership is the recognised standard. WCB Alberta is receptive to kinesiology/exercise physiology in functional restoration programmes.",
    links: [
      { name: "WCB Alberta — Health Care Providers", url: "https://www.wcb.ab.ca/health-care-providers/" },
      { name: "Alberta Kinesiology Association (AKA)", url: "https://www.albertakinesiology.ca" },
    ],
  },
  {
    id: "ca-ehb",
    title: "Extended Health Benefits (EHB) / Group Insurance",
    icon: Shield,
    color: "blue",
    badge: "Private",
    reports_required: ["Initial Assessment Summary — for insurer or employer plan administrator","Treatment / Rehabilitation Plan","Progress Reports — for pre-approval of additional sessions","Discharge Summary"],
    key_requirements: ["Major carriers: Sun Life, Manulife, Canada Life, Blue Cross, Great-West Life, Desjardins","R.Kin or Registered Exercise Physiologist (CEP-CSEP) credential usually required","Kinesiology is covered by many group plans — verify eligible disciplines","Annual limits typically CAD $500–$1,500 per discipline"],
    notes: "Canadian group benefits plans increasingly cover kinesiology and exercise physiology. Always verify whether the plan covers kinesiology vs physiotherapy vs both — they are billed separately.",
    links: [
      { name: "Sun Life Provider Resources", url: "https://www.sunlife.ca/en/health-professionals/" },
      { name: "Canadian Kinesiology Alliance", url: "https://www.cka.ca" },
      { name: "CSEP — CEP Credential", url: "https://csep.ca/certifications/csep-cep/" },
    ],
  },
  {
    id: "ca-vac",
    title: "Veterans Affairs Canada (VAC)",
    icon: Shield,
    color: "red",
    badge: "Federal",
    reports_required: ["Initial Assessment Report","Treatment Plan — submitted with prior authorisation request","Progress Reports — as requested by VAC case manager","Discharge / Completion Report"],
    key_requirements: ["Prior authorisation from VAC mandatory before commencing treatment","Submit via VAC Health Care Connect portal","Kinesiology/Exercise Physiology covered under Physical Rehabilitation services","R.Kin or equivalent credential required"],
    notes: "VAC funds exercise physiology/kinesiology as part of physical rehabilitation for veterans with service-related injuries. Pre-authorisation is mandatory — never see a veteran without VAC approval in place.",
    links: [
      { name: "VAC — Health and Treatment Benefits", url: "https://www.veterans.gc.ca/en/health-and-wellness" },
      { name: "VAC Health Care Connect Portal", url: "https://www.veterans.gc.ca/en/health-and-wellness/find-a-health-care-professional" },
    ],
  },
  {
    id: "ca-self-pay",
    title: "Self-Pay / Private Practice",
    icon: DollarSign,
    color: "gray",
    badge: "Private",
    reports_required: ["No mandatory payer forms","Clinical notes for own records","GP / Specialist Summary on request"],
    key_requirements: ["HST/GST registration required if annual revenue exceeds CAD $30,000","PIPEDA / provincial privacy law compliance required","Professional liability insurance required","R.Kin or CSEP-CEP credential strongly recommended"],
    notes: "Self-pay kinesiology/exercise physiology rates typically range CAD $80–$180/session (2024). Rates vary significantly by province and urban/rural location.",
    links: [
      { name: "Canadian Kinesiology Alliance", url: "https://www.cka.ca" },
      { name: "CSEP — Certified Exercise Physiologist", url: "https://csep.ca" },
    ],
  },
];

const nzFundingData = [
  {
    id: "nz-acc",
    title: "ACC — Accident Compensation Corporation",
    icon: Shield,
    color: "blue",
    badge: "National",
    reports_required: ["Initial Assessment Report — injury, functional status, goals, treatment plan","ACC32 Prior Approval Request — required for treatment beyond initial allocation","Progress Report — submitted with ACC32 extension requests","FCE Report — if requested by ACC case manager at claim resolution","Discharge / Completion Summary"],
    session_limit: "Initial allocation typically 6–12 sessions; extension via ACC32 prior approval",
    key_requirements: ["Must hold current ACC contract or work under a registered provider","ACC45 claim lodgement by treating practitioner (GP, physio, etc.)","Exercise Physiologists in NZ: no standalone statutory register (as of 2024)","NZSCA or ESSA membership demonstrates professional standing","Document: mechanism of injury, functional limitations, evidence-based treatment rationale"],
    notes: "New Zealand's ACC system provides universal coverage for physical injury regardless of fault. Exercise physiologists work extensively in ACC-funded rehabilitation. Check the current ACC allied health fee schedule — rates are updated annually.",
    links: [
      { name: "ACC — For Providers", url: "https://www.acc.co.nz/for-providers/" },
      { name: "ACC32 — Prior Approval Form", url: "https://www.acc.co.nz/for-providers/treatment-recovery/prior-approval-treatment" },
    ],
  },
  {
    id: "nz-moh",
    title: "Ministry of Health — Disability Support Services",
    icon: Users,
    color: "purple",
    badge: "National",
    reports_required: ["Functional Assessment Report — standardised DSS format","Needs Assessment Report — completed by NASC","Service Plan / Goals Documentation","Review Report — at scheduled review intervals"],
    key_requirements: ["Services must be needs-assessed by a NASC (Needs Assessment Service Coordination)","Funding allocated per individual based on needs assessment","Whaikaha — Ministry of Disabled People oversees disability support reform","Enabling Good Lives (EGL) principles guide service delivery"],
    notes: "Disability Support Services are transitioning under Whaikaha (Ministry of Disabled People). Exercise physiology is increasingly recognised in disability support for functional independence outcomes.",
    links: [
      { name: "Whaikaha — Ministry of Disabled People", url: "https://www.whaikaha.govt.nz" },
      { name: "Health NZ — Disability Support Services", url: "https://www.tewhatuora.govt.nz/for-the-health-sector/disability-support-services" },
    ],
  },
  {
    id: "nz-private",
    title: "Private Health Insurance",
    icon: Heart,
    color: "green",
    badge: "Private",
    reports_required: ["Initial Assessment Report","Treatment / Rehabilitation Plan","Progress Reports for re-authorisation","Discharge Summary"],
    key_requirements: ["Major insurers: Southern Cross Health Insurance, NIB, AIA NZ, Accuro","Prior approval often required for ongoing treatment","NZSCA or equivalent professional membership strengthens claims"],
    notes: "Southern Cross is the dominant private health insurer in NZ. Exercise physiology coverage varies by plan. Plans increasingly include 'active recovery' and 'allied health' benefits that may cover EP services.",
    links: [
      { name: "Southern Cross Provider Resources", url: "https://www.southerncross.co.nz/providers" },
      { name: "NIB NZ Providers", url: "https://www.nib.co.nz/providers" },
    ],
  },
  {
    id: "nz-self-pay",
    title: "Self-Pay / Private Practice",
    icon: DollarSign,
    color: "gray",
    badge: "Private",
    reports_required: ["No mandatory payer forms","Clinical notes for own records","GP Summary on request"],
    key_requirements: ["Privacy Act 2020 compliance required","Professional indemnity insurance required","GST registration if annual revenue exceeds NZD $60,000","NZSCA, ESSA (NZ members), or Exercise NZ membership recommended"],
    notes: "Self-pay EP rates in NZ typically range NZD $80–$160/session (2024). ACC's no-fault system means most injury-related work is funded via ACC rather than self-pay.",
    links: [
      { name: "Exercise NZ", url: "https://www.exercisenz.org.nz" },
      { name: "Sports Medicine New Zealand", url: "https://www.sportsmedicine.org.nz" },
    ],
  },
];

const singaporeFundingData = [
  {
    id: "sg-healthiersg",
    title: "Healthier SG — MOH Health Promotion Programme",
    icon: Stethoscope,
    color: "red",
    badge: "MOH / National",
    reports_required: ["Allied Health Assessment Report — functional status, exercise capacity, chronic disease context","Health Plan Documentation — aligned to patient's Healthier SG health plan with enrolled GP","Programme Progress Report — outcomes aligned to health plan goals","Completion / Discharge Report"],
    key_requirements: ["Exercise physiologists work as part of Healthier SG care teams in polyclinics/community health","Services must align with patient's enrolled GP's Health Plan","Allied Health Professional (AHP) registration with AHPC required","Outcome measures: chronic disease control, physical activity minutes, functional capacity"],
    notes: "Healthier SG is Singapore's national preventive health strategy launched 2023. Exercise physiologists embedded in polyclinics and community health settings play a key role in chronic disease management.",
    links: [
      { name: "MOH — Healthier SG", url: "https://www.healthiersg.gov.sg" },
      { name: "MOH — Allied Health Professions (AHPC)", url: "https://www.moh.gov.sg/hpp/allied-health-professionals" },
    ],
  },
  {
    id: "sg-cdmp",
    title: "CDMP — Chronic Disease Management Programme",
    icon: Heart,
    color: "orange",
    badge: "MOH / MediSave",
    reports_required: ["Referral documentation from registered GP or specialist","Initial Exercise Assessment — functional capacity, contraindications, chronic disease context","CDMP-aligned Treatment Plan","Progress / Review Report","Discharge Summary with chronic disease outcomes (HbA1c, BP, lipids)"],
    session_limit: "MediSave: up to SGD $500/year per chronic condition (CDMP MediSave withdrawal)",
    key_requirements: ["CDMP covers: T2DM, hypertension, hyperlipidaemia, asthma, COPD, and more","Must work within a CDMP-accredited institution","MediSave withdrawal for exercise therapy requires MOH-accredited institution","AHPC registration required"],
    notes: "Singapore's CDMP allows MediSave to be used for exercise therapy at accredited institutions. One of the most direct EP funding pathways in Singapore. Private independent practices typically cannot access this unless accredited.",
    links: [
      { name: "MOH — CDMP Information", url: "https://www.moh.gov.sg/cost-financing/healthcare-schemes-subsidies/chronic-disease-management-programme-(cdmp)" },
      { name: "CPF — MediSave for CDMP", url: "https://www.cpf.gov.sg/member/healthcare/using-your-medisave-savings/paying-for-outpatient-treatments" },
    ],
  },
  {
    id: "sg-chas",
    title: "CHAS — Community Health Assist Scheme",
    icon: Users,
    color: "blue",
    badge: "MOH / MOF",
    reports_required: ["CHAS-eligible provider documentation at approved GP clinics or community partners","Clinical treatment records per CHAS guidelines"],
    key_requirements: ["CHAS subsidises healthcare for lower- and middle-income Singaporeans at approved clinics","Exercise physiology under CHAS primarily via polyclinics or MOH-approved community partners","Independent private EP practices typically cannot claim CHAS subsidies"],
    notes: "CHAS focuses on primary care access. EP within CHAS-funded services is primarily institution-based (restructured hospitals, polyclinics).",
    links: [
      { name: "MOH — CHAS Scheme", url: "https://www.chas.sg" },
      { name: "Agency for Integrated Care (AIC)", url: "https://www.aic.sg" },
    ],
  },
  {
    id: "sg-wica",
    title: "WICA — Work Injury Compensation Act",
    icon: Briefcase,
    color: "orange",
    badge: "Ministry of Manpower",
    reports_required: ["Medical Assessment Report — injury, functional limitations, work capacity","Return-to-Work Plan documentation","Medical Leave / Temporary Incapacity Report","Permanent Incapacity Assessment (if applicable)"],
    key_requirements: ["Work injury claims under WICA managed by Ministry of Manpower (MOM)","Exercise physiologists provide functional restoration as part of RTW programme","Reports must address: current functional status, work demands, RTW timeline","AHPC registration required"],
    notes: "WICA provides no-fault compensation for work injuries. Exercise physiology in WICA is primarily hospital or rehabilitation centre-based.",
    links: [{ name: "MOM — Work Injury Compensation", url: "https://www.mom.gov.sg/workplace-safety-and-health/work-injury-compensation" }],
  },
  {
    id: "sg-private",
    title: "Private / Corporate Health Insurance",
    icon: Heart,
    color: "green",
    badge: "Private",
    reports_required: ["Initial Assessment Report","Treatment Plan","Progress Reports for pre-authorisation","Discharge Summary"],
    key_requirements: ["Corporate group health schemes often include allied health / wellness benefits","Pre-authorisation from insurer required for ongoing sessions","Major insurers: AIA Singapore, Prudential, Great Eastern, NTUC Income, Singlife"],
    notes: "Singapore's corporate insurance market often provides exercise physiology benefits under wellness or allied health riders.",
    links: [
      { name: "AIA Singapore Health Professionals", url: "https://www.aia.com.sg/en/health-wellness" },
      { name: "NTUC Income Corporate Benefits", url: "https://www.income.com.sg/business/employee-benefits" },
    ],
  },
];

const irelandFundingData = [
  {
    id: "ie-hse",
    title: "HSE — Health Service Executive (Public Sector)",
    icon: Stethoscope,
    color: "green",
    badge: "National / Public",
    reports_required: ["Referral accepted from GP, specialist, or physiotherapist","Initial Assessment Documentation — functional status, goals, programme plan","Progress Review Notes","Discharge Summary"],
    key_requirements: ["Exercise physiologists in HSE typically employed in cardiac, pulmonary, or cancer rehab","CORU registration required for applicable AHP roles","Services commissioned by HSE Community Healthcare Organisations (CHOs)","Sláintecare reform is expanding chronic disease management community programmes"],
    notes: "Ireland's health system is undergoing major reform under Sláintecare. Exercise physiology roles are growing in HSE community care, cardiac rehab, and community-based chronic disease management.",
    links: [
      { name: "HSE — Allied Health Professions", url: "https://www.hse.ie/eng/about/who/healthallies/ahp/" },
      { name: "CORU — Health and Social Care Professionals", url: "https://www.coru.ie" },
      { name: "Irish Heart Foundation — Cardiac Rehab", url: "https://www.irishheart.ie/your-heart/cardiac-rehabilitation/" },
    ],
  },
  {
    id: "ie-piab",
    title: "PIAB — Personal Injury Assessment Board",
    icon: Car,
    color: "orange",
    badge: "State",
    reports_required: ["Functional Assessment / Expert Report — if requested in the personal injury claim process","Medical report supporting treatment received","Attendance records and invoices for services claimed"],
    key_requirements: ["PIAB assesses personal injury claims (road accidents, workplace injuries, public liability)","Exercise physiology FCE or functional reports may be requested in legal/insurance context","Reports must be factual, objective, and clinician-signed"],
    notes: "PIAB replaced most personal injury court cases in Ireland. Exercise physiologists can provide functional capacity reports supporting injury assessment and treatment records in the PIAB process.",
    links: [{ name: "PIAB — Personal Injury Assessment Board", url: "https://www.piab.ie" }],
  },
  {
    id: "ie-private-insurance",
    title: "Private Health Insurance (VHI, Laya, Irish Life Health)",
    icon: Shield,
    color: "blue",
    badge: "Private",
    reports_required: ["Pre-authorisation request to insurer","GP or specialist referral letter","Initial Assessment and Treatment Plan","Progress Reports for re-authorisation","Discharge Summary"],
    key_requirements: ["Major insurers: VHI, Laya Healthcare, Irish Life Health, HSF Health Plan","Prior authorisation required for most services","Exercise physiology covered under 'allied health' or 'rehabilitation' benefits in many plans","Must be on approved provider panel"],
    notes: "Ireland has ~46% private health insurance uptake. VHI, Laya, and Irish Life Health are the major providers. Cardiac and cancer rehabilitation are most commonly funded.",
    links: [
      { name: "VHI Healthcare Professionals", url: "https://www.vhi.ie/health-professionals" },
      { name: "Laya Healthcare Providers", url: "https://www.layahealthcare.ie/health-professionals" },
      { name: "Irish Life Health Provider Information", url: "https://www.irishlifehealth.ie/health-professionals" },
    ],
  },
  {
    id: "ie-self-pay",
    title: "Self-Pay / Private Practice",
    icon: DollarSign,
    color: "gray",
    badge: "Private",
    reports_required: ["No mandatory payer forms","Clinical records for own use","GP / Specialist Summary on request"],
    key_requirements: ["GDPR / Data Protection Act 2018 compliance required","Revenue Commissioners registration if self-employed","Professional indemnity insurance required"],
    notes: "Self-pay EP rates in Ireland typically range €60–€120/session (2024). Clients may claim tax relief on qualified medical expenses under Revenue's Med 2 scheme.",
    links: [
      { name: "CORU — Registration for AHPs", url: "https://www.coru.ie" },
      { name: "Revenue — Medical Expenses Tax Relief", url: "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/health-expenses/index.aspx" },
    ],
  },
];

const southAfricaFundingData = [
  {
    id: "za-medical-schemes",
    title: "Medical Aid Schemes (Regulated Private Insurance)",
    icon: Shield,
    color: "green",
    badge: "Private / Regulated",
    reports_required: ["Initial Assessment Report — functional status, clinical context, goals","Pre-authorisation Request Letter — required for most scheme benefits","Biokineticist Treatment Plan","Progress / Review Report for continued authorisation","Discharge Summary"],
    session_limit: "Varies by scheme and plan: typically 6–12 sessions per benefit cycle",
    key_requirements: ["Biokineticists must be registered with HPCSA (Health Professions Council of SA)","Biokinetics is the South African equivalent of exercise physiology — regulated profession","BHF (Board of Healthcare Funders) tariff codes required on all claims","Major schemes: Discovery Health, Momentum Health, Bonitas, Medshield, GEMS","Pre-authorisation required for most rehab services beyond initial sessions"],
    notes: "South Africa has a well-established biokinetics profession regulated by HPCSA. Medical aid funding for biokinetics is standard across most mid-to-high-tier plans. BASA maintains current tariff and scheme information.",
    links: [
      { name: "HPCSA — Health Professions Council of SA", url: "https://www.hpcsa.co.za" },
      { name: "BASA — BioKinetics Association of SA", url: "https://www.basa.org.za" },
      { name: "Discovery Health Provider Resources", url: "https://www.discovery.co.za/portal/individual/health-providers" },
    ],
  },
  {
    id: "za-coida",
    title: "COIDA / Compensation Fund (Workmen's Compensation)",
    icon: Briefcase,
    color: "orange",
    badge: "National / DoEL",
    reports_required: ["Biokineticist Treatment Records supporting medical reports","Functional Capacity / Return-to-Work Assessment — if requested by Compensation Commissioner","Progress report supporting WCL5 (Progress Medical Report)","Discharge Summary"],
    key_requirements: ["COIDA covers workplace injuries — Department of Employment and Labour (DoEL)","Primary medical reports (WCL2, WCL5, final) must be completed by a medical doctor","Biokineticists provide functional restoration and RTW support","HPCSA registration mandatory"],
    notes: "COIDA funding for biokineticists is well established but Compensation Fund payment delays are a known issue. RAF (Road Accident Fund) is a separate pathway for motor vehicle accidents.",
    links: [
      { name: "Department of Employment and Labour — Compensation Fund", url: "https://www.labour.gov.za/compensation-fund" },
      { name: "RAF — Road Accident Fund", url: "https://www.raf.co.za" },
      { name: "BASA — Biokinetics Association", url: "https://www.basa.org.za" },
    ],
  },
  {
    id: "za-gems",
    title: "GEMS — Government Employees Medical Scheme",
    icon: Users,
    color: "blue",
    badge: "Public Sector",
    reports_required: ["Standard scheme authorisation documentation","Biokineticist Initial Assessment","Treatment Plan and Progress Reports","Discharge Summary"],
    key_requirements: ["GEMS covers South African government employees — one of SA's largest medical schemes","Biokinetics covered under Chronic Disease Management and specialist rehab benefits","GEMS requires HPCSA-registered biokineticists","Pre-authorisation required for most rehab services"],
    notes: "GEMS is one of the largest medical schemes in South Africa. Biokinetics is a recognised benefit. HPCSA registration and BHF tariff compliance are essential for claims processing.",
    links: [
      { name: "GEMS — Government Employees Medical Scheme", url: "https://www.gems.gov.za" },
      { name: "BASA — Tariff Information", url: "https://www.basa.org.za" },
    ],
  },
  {
    id: "za-self-pay",
    title: "Self-Pay / Private Practice",
    icon: DollarSign,
    color: "gray",
    badge: "Private",
    reports_required: ["No mandatory payer forms","Clinical records per HPCSA requirements","Medical report on request for patient"],
    key_requirements: ["HPCSA registration mandatory","POPIA (Protection of Personal Information Act) compliance required","Register with the Information Regulator for POPIA","Professional indemnity insurance required"],
    notes: "Private-pay biokineticist rates in SA typically range ZAR R500–R1,200/session (2024). POPIA is South Africa's privacy law — registration with the Information Regulator is required for all health practices.",
    links: [
      { name: "BASA — BioKinetics Association SA", url: "https://www.basa.org.za" },
      { name: "Information Regulator — POPIA", url: "https://www.justice.gov.za/inforeg/" },
      { name: "HPCSA Registration", url: "https://www.hpcsa.co.za" },
    ],
  },
];

const colorMap = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-200",   icon: "text-blue-600",   badge: "bg-blue-100 text-blue-700" },
  red:    { bg: "bg-red-50",    border: "border-red-200",    icon: "text-red-600",    badge: "bg-red-100 text-red-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", icon: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
  orange: { bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-600", badge: "bg-orange-100 text-orange-700" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-200", icon: "text-yellow-600", badge: "bg-yellow-100 text-yellow-700" },
  green:  { bg: "bg-green-50",  border: "border-green-200",  icon: "text-green-600",  badge: "bg-green-100 text-green-700" },
  pink:   { bg: "bg-pink-50",   border: "border-pink-200",   icon: "text-pink-600",   badge: "bg-pink-100 text-pink-700" },
  teal:   { bg: "bg-teal-50",   border: "border-teal-200",   icon: "text-teal-600",   badge: "bg-teal-100 text-teal-700" },
  gray:   { bg: "bg-gray-50",   border: "border-gray-200",   icon: "text-gray-600",   badge: "bg-gray-100 text-gray-700" },
};

function FunderCard({ funder }) {
  const [expanded, setExpanded] = useState(false);
  const c = colorMap[funder.color] || colorMap.gray;
  const Icon = funder.icon;

  return (
    <Card className={`${c.bg} ${c.border} border hover:shadow-md transition-all duration-200 flex flex-col`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-white shadow-sm border ${c.border}`}>
              <Icon className={`w-4 h-4 ${c.icon}`} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 leading-tight">{funder.title}</CardTitle>
              {funder.badge && (
                <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.badge}`}>{funder.badge}</span>
              )}
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="flex-shrink-0 p-1 rounded-md hover:bg-white/60 transition-colors" aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-grow">
        <div>
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1">
            <FileText className="w-3 h-3" /> Reports Required
          </h4>
          <ul className="space-y-1">
            {funder.reports_required.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${c.icon}`} />
                {r}
              </li>
            ))}
          </ul>
        </div>

        {expanded && (
          <>
            {funder.session_limit && (
              <div className="bg-white/70 rounded-lg p-3 border border-white">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Session Limit</h4>
                <p className="text-sm text-slate-700">{funder.session_limit}</p>
              </div>
            )}
            {funder.item_numbers && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Item Numbers</h4>
                <ul className="space-y-1">
                  {funder.item_numbers.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 font-mono bg-white/60 rounded px-2 py-1 border border-white">{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {funder.key_requirements && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Key Requirements
                </h4>
                <ul className="space-y-1">
                  {funder.key_requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.icon.replace('text', 'bg')}`} />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {funder.report_tips && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-indigo-800 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> Report Writing Tips
                </h4>
                <ul className="space-y-1">
                  {funder.report_tips.map((tip, i) => (
                    <li key={i} className="text-xs text-indigo-700">
                      <strong>{tip.split(':')[0]}:</strong> {tip.split(':').slice(1).join(':')}
                    </li>
                  ))}
                </ul>
                {funder.report_keywords && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {funder.report_keywords.map((kw, i) => (
                      <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">{kw}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {funder.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Notes
                </h4>
                <p className="text-sm text-amber-800">{funder.notes}</p>
              </div>
            )}
            {funder.links && funder.links.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Resources & Forms</h4>
                <div className="flex flex-wrap gap-2">
                  {funder.links.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border bg-white hover:shadow-sm transition-all ${c.icon} ${c.border}`}>
                      <ExternalLink className="w-3 h-3" />
                      {link.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!expanded && funder.links && funder.links.length > 0 && (
          <button onClick={() => setExpanded(true)} className={`text-xs font-medium ${c.icon} hover:underline flex items-center gap-1`}>
            <ExternalLink className="w-3 h-3" />
            {funder.links.length} resource{funder.links.length > 1 ? 's' : ''} available — expand to view
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function FundingForms() {
  const [activeTab, setActiveTab] = useState("australia");

  const fundingDataMap = {
    australia: australiaFundingData,
    usa: usaFundingData,
    uk: ukFundingData,
    canada: canadaFundingData,
    nz: nzFundingData,
    singapore: singaporeFundingData,
    ireland: irelandFundingData,
    southafrica: southAfricaFundingData,
  };

  const fundingData = fundingDataMap[activeTab] || australiaFundingData;

  const banners = {
    australia: { text: `${australiaFundingData.length} Australian funders covered — from Medicare and DVA to state-based Workers' Comp, Motor Accident, NDIS, Aged Care, and private insurance.`, sub: "Click any card to expand full requirements, item numbers, report writing tips, and direct links to forms and fee schedules." },
    usa: { text: "USA funding requirements vary by payer, state, and plan. Start with the Core Documentation Pack, then add payer-specific requirements.", sub: "Always verify: patient plan details, prior auth requirements, network status, and current fee schedules before treatment." },
    uk: { text: `${ukFundingData.length} UK funding pathways covered — NHS Exercise Referral, Cardiac & Pulmonary Rehab, Cancer Rehab, PMI, Fit Notes, and private practice.`, sub: "Click any card to expand full requirements, qualifications needed, and direct links to guidelines and provider portals." },
    canada: { text: `${canadaFundingData.length} Canadian funding pathways — WSIB Ontario, WorkSafeBC, WCB Alberta, Extended Health Benefits, Veterans Affairs, and private practice.`, sub: "Regulatory requirements vary by province. Always confirm provider registration requirements in your province before billing." },
    nz: { text: `${nzFundingData.length} New Zealand funding pathways — ACC (the main pathway), Disability Support, private health insurance, and private practice.`, sub: "ACC's no-fault system covers most injury-related work. Confirm your current ACC contract status and fee schedule before billing." },
    singapore: { text: `${singaporeFundingData.length} Singapore funding pathways — Healthier SG, CDMP/MediSave, CHAS, WICA, and corporate/private insurance.`, sub: "Most funded EP services in Singapore are institution-based. AHPC registration and MOH accreditation are essential for public scheme access." },
    ireland: { text: `${irelandFundingData.length} Ireland funding pathways — HSE public services, PIAB personal injury, private health insurance (VHI/Laya/Irish Life), and private practice.`, sub: "Exercise physiology is not yet legislatively regulated in Ireland. CORU registration where applicable and professional indemnity insurance are essential." },
    southafrica: { text: `${southAfricaFundingData.length} South Africa funding pathways — Medical Aid Schemes, COIDA/Compensation Fund, GEMS, and private practice.`, sub: "Biokinetics is the regulated exercise physiology equivalent in South Africa. HPCSA registration is mandatory for all practice types." },
  };

  const banner = banners[activeTab] || banners.australia;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Funding Forms & Resources</h1>
            <p className="text-slate-600">Complete guide to documentation requirements, forms, and resources for every funder — across all regions.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="australia" className="flex items-center gap-1.5 text-sm">🇦🇺 Australia</TabsTrigger>
            <TabsTrigger value="usa" className="flex items-center gap-1.5 text-sm">🇺🇸 USA</TabsTrigger>
            <TabsTrigger value="uk" className="flex items-center gap-1.5 text-sm">🇬🇧 UK</TabsTrigger>
            <TabsTrigger value="canada" className="flex items-center gap-1.5 text-sm">🇨🇦 Canada</TabsTrigger>
            <TabsTrigger value="nz" className="flex items-center gap-1.5 text-sm">🇳🇿 New Zealand</TabsTrigger>
            <TabsTrigger value="singapore" className="flex items-center gap-1.5 text-sm">🇸🇬 Singapore</TabsTrigger>
            <TabsTrigger value="ireland" className="flex items-center gap-1.5 text-sm">🇮🇪 Ireland</TabsTrigger>
            <TabsTrigger value="southafrica" className="flex items-center gap-1.5 text-sm">🇿🇦 South Africa</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6 space-y-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm text-blue-900 font-medium">{banner.text}</p>
                    <p className="text-sm text-blue-800">{banner.sub}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
                <div className="text-2xl font-bold text-slate-900">{fundingData.length}</div>
                <div className="text-xs text-slate-500 mt-0.5">Funders Covered</div>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
                <div className="text-2xl font-bold text-slate-900">{fundingData.reduce((acc, f) => acc + (f.links?.length || 0), 0)}</div>
                <div className="text-xs text-slate-500 mt-0.5">Direct Resources</div>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
                <div className="text-2xl font-bold text-slate-900">{fundingData.reduce((acc, f) => acc + f.reports_required.length, 0)}</div>
                <div className="text-xs text-slate-500 mt-0.5">Report Types</div>
              </div>
            </div>

            <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-5">
              {fundingData.map((funder) => (
                <FunderCard key={funder.id} funder={funder} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}