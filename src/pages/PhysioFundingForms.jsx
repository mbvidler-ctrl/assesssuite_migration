import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createPageUrl } from "@/utils";

const REVIEWED_DATE = "29 August 2026";

const PATHWAYS = [
  {
    id: "medicare-gpccmp",
    category: "Commonwealth",
    title: "Medicare GP Chronic Condition Management Plan",
    jurisdiction: "Australia",
    summary: "Individual physiotherapy under MBS item 10960, with video and telephone items where the current MBS rules permit them.",
    trigger: "A valid GP or prescribed medical practitioner referral under a current GPCCMP or eligible transitional care-plan arrangement.",
    requirements: [
      "Confirm the referral, eligible condition and remaining allied-health service allocation before claiming.",
      "Record a physiotherapy assessment, treatment delivered and clinically relevant outcome measures.",
      "Send a written report after the first and last service, and earlier when clinically necessary.",
      "Keep the referral and reporting evidence with the episode of care.",
    ],
    reportTypes: ["Medicare Referral Acceptance", "Medicare Initial Assessment", "Medicare Final Report", "GP Summary Letter"],
    links: [
      { label: "Services and referral rules", url: "https://www.servicesaustralia.gov.au/services-available-under-gp-chronic-condition-management-plan?context=20" },
      { label: "Current MBS billing rules", url: "https://www.servicesaustralia.gov.au/mbs-billing-rules-for-chronic-condition-allied-health-and-other-primary-health-care-items?context=20" },
    ],
  },
  {
    id: "dva",
    category: "Commonwealth",
    title: "Department of Veterans’ Affairs physiotherapy",
    jurisdiction: "Australia",
    summary: "DVA-funded physiotherapy for eligible Veteran Card holders, including the treatment-cycle workflow and physiotherapy-specific fee schedule.",
    trigger: "A valid DVA referral and entitlement for the condition being treated; check the TPI Gold Card physiotherapy exception.",
    requirements: [
      "Start or update a Patient Care Plan with SMART goals and validated outcome measures.",
      "Track the treatment cycle: up to 12 sessions or one year, whichever ends first, unless an applicable exception applies.",
      "Complete and send the End of Cycle Report to the usual GP and referrer when required.",
      "Use prior financial approval and RAP forms where the requested service or item requires them.",
    ],
    reportTypes: ["DVA Patient Care Plan", "DVA End of Cycle Report", "Physiotherapy Progress Report"],
    links: [
      { label: "DVA physiotherapist guidance", url: "https://www.dva.gov.au/providers/information-for-dental-psychology-allied-health-providers/physiotherapists" },
      { label: "Treatment-cycle resources", url: "https://www.dva.gov.au/providers/information-for-dental-psychology-allied-health-providers/allied-health-treatment-cycle/treatment-cycle-information-for-allied-health-providers" },
    ],
  },
  {
    id: "ndis",
    category: "Disability",
    title: "NDIS therapeutic supports",
    jurisdiction: "Australia",
    summary: "Physiotherapy assessment and intervention linked to participant goals, function, participation and disability-related support needs.",
    trigger: "Participant agreement and an available plan budget that can fund the proposed support under the current NDIS support catalogue.",
    requirements: [
      "Link each intervention and recommendation to the participant’s stated goals and disability-related functional needs.",
      "Record baseline and review outcome measures, functional change and the rationale for ongoing skilled physiotherapy.",
      "Use the current support item and current pricing schedule; do not reuse a prior-year item or price without checking.",
      "Retain service agreement, consent, appointment and report evidence for claims and reviews.",
    ],
    reportTypes: ["NDIS Initial Assessment", "NDIS Progress Report", "NDIS Functional Capacity Evaluation", "NDIS Discharge / Transition Summary"],
    links: [
      { label: "Current NDIS pricing schedule", url: "https://www.ndis.gov.au/providers/pricing-and-payments/pricing/pricing-arrangements" },
      { label: "Provider guidance", url: "https://www.ndis.gov.au/providers" },
    ],
  },
  {
    id: "workcover-qld",
    category: "Compensation",
    title: "Queensland workers’ compensation",
    jurisdiction: "Queensland",
    summary: "Physiotherapy for an accepted work-related injury, coordinated with the insurer, treating team and return-to-work plan.",
    trigger: "Insurer acceptance or approval for the compensable injury and any required approval beyond initial or pre-approved treatment.",
    requirements: [
      "Document compensable injury findings, functional limits, work capacity, barriers and measurable outcomes.",
      "Submit the current Provider Management Plan (Form 32) before the last approved session when further treatment requires approval.",
      "Use the current allied-health table of costs and include required claim and service details on invoices.",
      "Separate treatment for unrelated or pre-existing conditions from the compensable episode.",
    ],
    reportTypes: ["WorkCover PMP", "WorkCover Progress Report", "WorkCover Discharge / RTW Summary"],
    links: [
      { label: "Allied-health provider guidance", url: "https://www.worksafe.qld.gov.au/service-providers/Allied-health-and-workplace-rehabilitation-providers" },
      { label: "Form 32 Provider Management Plan", url: "https://www.worksafe.qld.gov.au/resources/forms" },
    ],
  },
  {
    id: "sira-nsw",
    category: "Compensation",
    title: "NSW SIRA workers compensation and CTP",
    jurisdiction: "New South Wales",
    summary: "The Allied Health Treatment Request (AHTR) supports approval, person-centred goals, recovery at work and standardised outcome monitoring.",
    trigger: "A workers compensation or motor accident claim, with approval requirements determined by scheme, practitioner status and time since injury.",
    requirements: [
      "Complete the AHTR at the scheme-required point and submit it to the insurer managing the claim.",
      "Record compensable presentation, risk screening, function, work participation, SMART goals and self-management.",
      "Use standardised outcome measures to demonstrate treatment effectiveness; SIRA does not mandate one specific measure.",
      "Check the current fees and practice requirements before providing services that may require prior approval.",
    ],
    reportTypes: ["NSW SIRA Initial Assessment", "NSW SIRA AHTR", "NSW SIRA Progress Report", "NSW SIRA Discharge Summary"],
    links: [
      { label: "AHTR requirements", url: "https://www.sira.nsw.gov.au/health-providers/allied-health-treatment-request-ahtr" },
      { label: "Download AHTR and examples", url: "https://www.sira.nsw.gov.au/resources-library/for-healthcare-providers/allied-health-treatment-request-ahtr-downloads" },
    ],
  },
  {
    id: "worksafe-vic",
    category: "Compensation",
    title: "WorkSafe Victoria physiotherapy",
    jurisdiction: "Victoria",
    summary: "Outcome-focused physiotherapy under WorkSafe’s clinical framework, including the Early Intervention Physiotherapy Framework where applicable.",
    trigger: "An accepted or provisionally supported work injury and the agent’s approval requirements for the proposed services.",
    requirements: [
      "Adopt a biopsychosocial approach and measurable function, participation and return-to-work goals.",
      "Record self-management strategies, treatment effectiveness and the planned reduction or progression of care.",
      "Coordinate with the agent, treating medical practitioner, employer and occupational rehabilitation provider as required.",
      "Check current provider registration, EIPF and fee requirements before claiming.",
    ],
    reportTypes: ["WorkSafe VIC Initial Assessment", "WorkSafe VIC Progress Report", "WorkSafe VIC Discharge Summary"],
    links: [
      { label: "Physiotherapy service guidelines", url: "https://www.worksafe.vic.gov.au/physiotherapy-services-guidelines" },
      { label: "Early Intervention Physiotherapy Framework", url: "https://www.worksafe.vic.gov.au/early-intervention-physiotherapy-framework-eipf" },
    ],
  },
  {
    id: "tac-vic",
    category: "Compensation",
    title: "Transport Accident Commission physiotherapy",
    jurisdiction: "Victoria",
    summary: "Physiotherapy for transport-accident injuries, including the Allied Health Treatment and Recovery Plan (AHTRP) when required.",
    trigger: "An eligible TAC claim and any approval required by the current physiotherapy policy or direct TAC request.",
    requirements: [
      "Record the new episode, barriers to recovery, functional goals, management and progress against measures.",
      "Complete and submit the AHTRP when the physiotherapy policy or TAC requires it.",
      "Use current TAC physiotherapy item descriptors and rates for the service date.",
      "Keep claim, correspondence, plan and report evidence together in the care episode.",
    ],
    reportTypes: ["TAC Functional Assessment / AHTRP", "TAC Progress Report", "TAC Discharge Summary"],
    links: [
      { label: "TAC provider forms", url: "https://www.tac.vic.gov.au/providers/documents-and-forms" },
      { label: "Physiotherapy rates", url: "https://www.tac.vic.gov.au/providers/invoicing-and-fees/fee-schedule/physiotherapy-services/physiotherapy-current-rates" },
    ],
  },
  {
    id: "rtwsa",
    category: "Compensation",
    title: "ReturnToWorkSA physiotherapy",
    jurisdiction: "South Australia",
    summary: "Collaborative physiotherapy management planning and review for recovery and return to work.",
    trigger: "A compensable injury and the case manager’s approval or scheme authority for the proposed physiotherapy.",
    requirements: [
      "Use the current Physiotherapy Management Plan to document shared goals, current function, risk and proposed management.",
      "Provide the plan to the patient, case manager and doctor as required.",
      "Track progress against objective measures and update the management plan when treatment direction changes.",
      "Check the current physiotherapy fee schedule and restricted-consultation rules.",
    ],
    reportTypes: ["ReturnToWorkSA Initial Assessment", "ReturnToWorkSA Progress Report", "ReturnToWorkSA Discharge Summary"],
    links: [
      { label: "Allied-health provider guidance", url: "https://www.rtwsa.com/service-providers/allied-health" },
      { label: "Physiotherapy plans and fee schedule", url: "https://www.rtwsa.com/publications/publications" },
    ],
  },
  {
    id: "workcover-wa",
    category: "Compensation",
    title: "WorkCover WA physiotherapy",
    jurisdiction: "Western Australia",
    summary: "Physiotherapy under WA workers compensation, with a Treatment Management Plan for longer treatment courses.",
    trigger: "A compensable injury and insurer authority for treatment; plan approval is relevant where the episode is likely to exceed the current consultation threshold.",
    requirements: [
      "Use the Physiotherapy Treatment Management Plan when more than 10 consultations are likely.",
      "Document diagnosis, areas treated, screening, function, goals, work status, self-management and proposed services.",
      "Submit reports and plans within current fee-order and prior-approval rules.",
      "Use the current health-services fee order for service dates and report item limits.",
    ],
    reportTypes: ["WorkCover WA Initial Assessment", "WorkCover WA Progress Report", "WorkCover WA Discharge Summary"],
    links: [
      { label: "Physiotherapy Treatment Management Plan", url: "https://www.workcover.wa.gov.au/health-providers/physiotherapy-treatment-management-plan/" },
      { label: "Current rates, fees and forms", url: "https://www.workcover.wa.gov.au/resources/rates-fees-payments/" },
    ],
  },
  {
    id: "comcare",
    category: "Compensation",
    title: "Comcare physiotherapy",
    jurisdiction: "Commonwealth jurisdiction",
    summary: "Physiotherapy for employees with accepted claims under the SRC Act, with a Physiotherapy Treatment Plan for ongoing services.",
    trigger: "An accepted claim and claims-manager approval for the proposed medical treatment.",
    requirements: [
      "Submit a Physiotherapy Treatment Plan where services are expected to exceed five sessions, after a treatment gap over 12 months, or when the employee changes clinic.",
      "Record activity and work limitations, measurable goals, outcome measures, proposed services and self-management.",
      "Discuss further services with Comcare at the end of an approved plan before continuing where required.",
      "Use the current jurisdiction-specific physiotherapy rate and plan item.",
    ],
    reportTypes: ["Physiotherapy Initial Assessment", "Physiotherapy Progress Report", "WorkCover Discharge / RTW Summary"],
    links: [
      { label: "Allied-health and physiotherapy rules", url: "https://www.comcare.gov.au/service-providers/medical-allied-health/allied-health" },
      { label: "Physiotherapy Treatment Plan", url: "https://www.comcare.gov.au/claims/forms" },
    ],
  },
  {
    id: "support-at-home",
    category: "Aged care",
    title: "Support at Home and restorative care",
    jurisdiction: "Australia",
    summary: "Physiotherapy delivered as clinical support or through a restorative pathway under a participant’s assessed aged-care needs and goals.",
    trigger: "A Support at Home assessment and support plan delivered through an authorised registered provider arrangement.",
    requirements: [
      "Link physiotherapy to assessed needs, independence, safety, function and the participant’s goals and preferences.",
      "Coordinate with the care partner and other providers, including any Restorative Care Pathway milestones.",
      "Record baseline function, falls risk, mobility, home programme, progress and review or discharge status.",
      "Confirm the current service-list, pricing and claiming arrangement with the registered provider.",
    ],
    reportTypes: ["Aged Care Assessment", "Initial Functional Assessment", "Individual Care Plan", "Annual Review"],
    links: [
      { label: "Delivering Support at Home services", url: "https://www.health.gov.au/our-work/support-at-home/delivering-services-for-support-at-home" },
      { label: "Services under Support at Home", url: "https://www.health.gov.au/our-work/support-at-home/delivering-services-for-support-at-home/services-under-support-at-home" },
    ],
  },
  {
    id: "private-health",
    category: "Private",
    title: "Private health extras and self-funded care",
    jurisdiction: "Australia",
    summary: "Out-of-hospital physiotherapy may be covered under a patient’s extras policy; benefits and limits vary by insurer and policy.",
    trigger: "Patient consent to proceed after the practice confirms fees and the patient confirms available cover or accepts self-funding.",
    requirements: [
      "Use the treating physiotherapist’s valid provider details and the insurer’s current claiming channel and item rules.",
      "Give the patient clear fee and expected gap information before treatment.",
      "Do not claim both Medicare and private health benefits for the same service.",
      "Provide clinical reports only when requested or clinically useful, with consent for the recipient.",
    ],
    reportTypes: ["Private Health Initial Assessment", "Private Health Progress Report", "Physiotherapy Discharge Summary"],
    links: [
      { label: "What private health insurance covers", url: "https://www.health.gov.au/topics/private-health-insurance/what-private-health-insurance-covers" },
      { label: "Out-of-pocket cost guidance", url: "https://www.health.gov.au/topics/private-health-insurance/what-private-health-insurance-covers/out-of-pocket-costs" },
    ],
  },
];

const CATEGORIES = ["All", "Commonwealth", "Disability", "Compensation", "Aged care", "Private"];

function OfficialLink({ link }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={link.url} target="_blank" rel="noreferrer">
        {link.label}<ExternalLink className="ml-2 h-3.5 w-3.5" />
      </a>
    </Button>
  );
}

export default function PhysioFundingForms() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return PATHWAYS.filter((pathway) => (
      (category === "All" || pathway.category === category)
      && (!needle || [
        pathway.title,
        pathway.jurisdiction,
        pathway.summary,
        pathway.trigger,
        ...pathway.requirements,
        ...pathway.reportTypes,
      ].join(" ").toLowerCase().includes(needle))
    ));
  }, [category, query]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/40 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-xl bg-teal-600 p-3 text-white"><ClipboardList className="h-6 w-6" /></div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Physiotherapy funding & forms</h1>
                <p className="text-slate-600">Australian referral, approval, reporting and claiming pathways</p>
              </div>
            </div>
            <p className="max-w-4xl text-sm text-slate-600">
              Operational prompts for care episodes and reports, linked to the controlling scheme sources. Source set reviewed {REVIEWED_DATE}; always use the linked source for current fees, item codes and approval rules.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate(createPageUrl("AssessmentLibrary"))}>
              <Stethoscope className="mr-2 h-4 w-4" />Outcome measures
            </Button>
            <Button onClick={() => navigate(createPageUrl("Reports"))} className="bg-teal-600 hover:bg-teal-700">
              <FileText className="mr-2 h-4 w-4" />Create report
            </Button>
          </div>
        </div>

        <Card className="border-teal-200 bg-white/90">
          <CardContent className="space-y-4 pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scheme, jurisdiction, form or report…" className="pl-10" />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((item) => (
                <Button key={item} size="sm" variant={category === item ? "default" : "outline"} onClick={() => setCategory(item)} className={category === item ? "bg-teal-600 hover:bg-teal-700" : ""}>
                  {item}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          {filtered.map((pathway) => (
            <Card key={pathway.id} className="border-slate-200 bg-white/95 shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-xl text-slate-900">{pathway.title}</CardTitle>
                  <Badge variant="outline" className="shrink-0 border-teal-200 bg-teal-50 text-teal-800">{pathway.jurisdiction}</Badge>
                </div>
                <p className="text-sm leading-6 text-slate-600">{pathway.summary}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-blue-900"><ShieldCheck className="h-4 w-4" />Entry / authority</div>
                  <p className="text-sm leading-6 text-blue-900">{pathway.trigger}</p>
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><CheckCircle2 className="h-4 w-4 text-teal-600" />Episode checklist</h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {pathway.requirements.map((requirement) => (
                      <li key={requirement} className="flex items-start gap-2"><span className="mt-1 text-teal-600">•</span><span>{requirement}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><FileText className="h-4 w-4 text-indigo-600" />AssessSuite report paths</h3>
                  <div className="flex flex-wrap gap-2">
                    {pathway.reportTypes.map((report) => <Badge key={report} variant="secondary">{report}</Badge>)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {pathway.links.map((link) => <OfficialLink key={link.url} link={link} />)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <Card><CardContent className="py-12 text-center text-slate-600"><Building2 className="mx-auto mb-3 h-8 w-8 text-slate-400" />No funding pathway matches that search.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
