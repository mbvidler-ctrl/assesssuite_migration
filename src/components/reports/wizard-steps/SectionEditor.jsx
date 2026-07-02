import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Sparkles, Loader2, Upload, X, FileText, ChevronDown, ChevronUp, History } from "lucide-react";
import { InvokeLLM, UploadFile } from "@/api/integrations";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { META_TEMPLATES, REPORT_META_TEMPLATE_MAP } from "@/components/reports/UnifiedReportWizard";

const SECTION_GUIDANCE = {
  "Referral Details": {
    hint: "Referring GP/specialist name, practice, referral date, reason for referral, referral type and item number if applicable.",
    prompt: "State in 3â€“5 lines only: referring practitioner full name and practice, referral date, reason for referral, referral type (e.g. GPCCMP, DVA, NDIS, WorkCover), and Medicare item number if applicable. No prose â€” present as labelled lines (e.g. 'Referring GP: Dr Jane Smith, XYZ Medical Centre')."
  },
  "Client Background": {
    hint: "Age, DOB, diagnosis, relevant history, medications, prior allied health. Max 100 words.",
    prompt: "Write max 100 words. Include: age, DOB, primary diagnosis/condition, relevant medical history, current medications affecting exercise, and any prior allied health involvement. No filler. Do not repeat in later sections."
  },
  "Background": {
    hint: "Relevant history, conditions, medications, reason for episode. Max 100 words.",
    prompt: "Write max 100 words. State: primary diagnosis, relevant comorbidities, current medications, reason for this episode of care. Use clinician-to-clinician language. Stop at 100 words."
  },
  "Presenting Complaint / History": {
    hint: "Onset, mechanism, symptom history, pain score (0â€“10), functional limitations.",
    prompt: "Max 100 words. State: onset date, mechanism of injury or illness, current symptoms, pain score (0â€“10 NRS), and specific functional limitations. Use objective descriptors. No preamble."
  },
  "Subjective": {
    hint: "Client-reported symptoms, pain, functional limitations, goals. Max 80 words.",
    prompt: "Max 80 words. Document exactly what the client reported: pain score and location, functional limitations, goals, and any concerns. Quote client language where appropriate (e.g. 'Client reports 6/10 pain with stair climbing')."
  },
  "Objective / Assessment Findings": {
    hint: "Results table: Test | Result | Norm | Interpretation. One row per test.",
    prompt: "Present all results as a plain text table with columns: Test | Result (with units) | Normative Range (age/sex) | Interpretation (Below/Within/Above Normal). One row per test. No prose descriptions â€” the table IS the section. If no assessments are available, write 'No assessment data recorded for this visit.'"
  },
  "Assessment Findings & Results": {
    hint: "Results table: Test | Result | Norm | Interpretation.",
    prompt: "Present all assessment results as a plain text table: Test | Result (with units) | Normative Range | Interpretation. One row per test. Flag anything outside normal range with an asterisk (*). No prose â€” table only."
  },
  "Baseline Functional Assessment Results": {
    hint: "Baseline results table. These are the reference values for future comparison.",
    prompt: "Present baseline results as a plain text table: Test | Baseline Result (with units) | Normative Range (age/sex) | Status (Below/Within/Above). Label the table 'BASELINE â€” [Date]'. These values will be compared at end of cycle."
  },
  "Objective Assessment Findings & Outcome Measures": {
    hint: "Results table: Test | Result | Norm | Interpretation.",
    prompt: "Plain text table only: Test | Result (with units) | Normative Range | Interpretation. One row per completed test. Flag abnormal results with (*). No prose."
  },
  "Baseline Assessment Findings & Outcome Measures": {
    hint: "Baseline results table for end-of-cycle comparison.",
    prompt: "Plain text table: Test | Baseline Result (units) | Normative Range | Status. Label 'BASELINE â€” [Date]'. These establish the reference point for progress measurement."
  },
  "Functional Capacity Assessment Results (across 7 NDIS domains)": {
    hint: "7 NDIS domains â€” one paragraph per domain, max 30 words each. Reference assessment results.",
    prompt: "Address all 7 NDIS support domains. Format as labelled sections: 'Daily Activities:', 'Self-Care:', 'Communication:', 'Social & Community Participation:', 'Learning:', 'Home Living:', 'Health & Wellbeing:'. For each: one sentence stating functional level + one sentence referencing the supporting assessment result. Max 30 words per domain."
  },
  "NDIS Functional Impact Statement": {
    hint: "ICF language â€” body functions, activity limitations, participation restrictions. Link to NDIS supports.",
    prompt: "Max 120 words. Use ICF framework: (1) Body Functions/Structures impaired, (2) Activity Limitations with specific examples, (3) Participation Restrictions with specific examples. End with one sentence linking to reasonable and necessary NDIS supports. Reference at least one assessment result by name and value."
  },
  "Current Functional Status": {
    hint: "Functional status across domains â€” reference assessment results. Max 120 words.",
    prompt: "Max 120 words. State current functional level across: mobility, ADLs, work capacity, strength, and endurance. For each domain, reference the specific assessment result that supports the statement (e.g. 'Cardiovascular endurance: 6MWT 340m â€” below age/sex norm of 450m, limiting sustained work activity')."
  },
  "Treatment Delivered to Date": {
    hint: "Sessions attended, intervention types, progression, response. Max 120 words.",
    prompt: "Max 120 words. State: total sessions approved, sessions attended (attendance rate %), date range, intervention types (e.g. resistance training, cardiovascular conditioning, hydrotherapy), program progression, and client's response (tolerance, adherence, adverse events if any). Draw from SOAP notes if available."
  },
  "Progress to Date": {
    hint: "Pre vs post table: Test | Baseline | Current | Change | Rating.",
    prompt: "Present progress as a plain text table: Test | Baseline (date) | Current (date) | Absolute Change | Progress Rating. Use ratings: Achieved / Significant Progress / Moderate Progress / Limited Progress / No Progress. Follow the table with max 50 words of narrative on overall functional change. No other prose."
  },
  "Goals & Outcomes": {
    hint: "SMART goals â€” measurable, time-bound. 3â€“5 goals max.",
    prompt: "State 3â€“5 SMART goals as a numbered list. Format each as: '[Goal statement] â€” Target: [measurable outcome] by [timeframe]'. Align to client-stated priorities and funder requirements. No prose paragraphs â€” numbered list only."
  },
  "Treatment Plan": {
    hint: "Numbered list: intervention, frequency, duration, rationale. Max 150 words.",
    prompt: "Numbered list only. For each intervention state: (1) type of intervention, (2) frequency (e.g. 2x/week), (3) session duration, (4) number of sessions, (5) one-line clinical rationale. Max 150 words total. No prose paragraphs."
  },
  "Plan / Recommendations": {
    hint: "Numbered recommendations with frequency/duration. Max 120 words.",
    prompt: "Numbered list. Each recommendation must include: what, how often, for how long, and why (one clause). Include onward referrals and next review date. Max 120 words."
  },
  "Recommendations": {
    hint: "Numbered clinical recommendations with justification. Max 150 words.",
    prompt: "Numbered list. For each recommendation: state the action, the frequency/quantity, and a brief evidence-based rationale (one clause). Include equipment, referrals, and review schedule. Max 150 words."
  },
  "Prognosis": {
    hint: "Expected outcome, timeframe, facilitating and barrier factors. Max 80 words.",
    prompt: "Max 80 words. State: (1) expected functional outcome, (2) estimated timeframe, (3) two facilitating factors, (4) two barrier factors. Reference at least one assessment result to justify. No filler language."
  },
  "Reason for Referral Acceptance": {
    hint: "Confirm GPCCMP eligibility, chronic condition, and brief plan. Max 80 words.",
    prompt: "Max 80 words. Confirm: (1) referral accepted, (2) qualifying chronic condition(s), (3) eligibility criteria met, (4) brief overview of planned EP intervention (type, frequency, duration). No preamble."
  },
  "Planned Initial Assessment Date": {
    hint: "Date, location, clinician. 2â€“3 lines maximum.",
    prompt: "State in 3 labelled lines only: 'Assessment Date:', 'Location:', 'Clinician:'. No prose."
  },
  "Response to Treatment": {
    hint: "Adherence rate, exercise tolerance, symptom changes, functional gains. Max 100 words.",
    prompt: "Max 100 words. State: attendance rate (%), tolerance to exercise (RPE range, adverse events), symptom changes (pain scores before/after if available), and specific functional improvements observed. Reference SOAP note data if available."
  },
  "Outcome Summary": {
    hint: "Pre vs post table: Test | Initial | Final | Change. Then 2-sentence narrative.",
    prompt: "Plain text table: Test | Initial Result (date) | Final Result (date) | Absolute Change | Goal Achieved (Y/N). Follow with max 2 sentences on overall functional gains and whether treatment goals were achieved. No other prose."
  },
  "Future Recommendations": {
    hint: "Numbered list â€” community exercise, GP review, self-management, referrals. Max 100 words.",
    prompt: "Numbered list, max 100 words total. Include: community exercise options (specific program names if known), self-management strategies, GP review requirements, and any specialist or allied health referrals. One line per recommendation."
  },
  "DVA Card & Accepted Conditions": {
    hint: "Card type, card number, accepted conditions. Labelled lines only.",
    prompt: "Present as labelled lines: 'DVA Card Type:', 'Card Number:', 'Accepted Conditions relevant to this referral:' (list each condition). No prose."
  },
  "Cycle Summary": {
    hint: "Sessions approved, attended, date range, interventions. Max 80 words.",
    prompt: "Max 80 words. State: sessions approved, sessions attended (attendance %), cycle dates (fromâ€“to), intervention types delivered. No filler."
  },
  "Functional Gains": {
    hint: "Pre vs post table then 2-sentence narrative.",
    prompt: "Plain text table: Test | Cycle Start | Cycle End | Change. Follow with max 2 sentences quantifying overall functional gains. Numbers and units required for every result."
  },
  "Justification for Further Funding": {
    hint: "Residual deficits, unmet goals, risk without treatment. Max 120 words.",
    prompt: "Max 120 words. State: (1) specific residual functional deficits with supporting assessment values, (2) goals not yet achieved with current status, (3) risk of functional decline without continued intervention. No generic statements â€” every claim must be supported by a named assessment result or clinical observation."
  },
  "Request for Further Funding": {
    hint: "Sessions requested, focus, expected outcomes. Numbered list.",
    prompt: "State as labelled lines: 'Sessions Requested:', 'Clinical Focus for Next Cycle:', 'Expected Functional Outcomes:' (numbered list of 2â€“3 measurable outcomes). Max 80 words."
  },
  "Injury Description & Mechanism": {
    hint: "Date of injury, mechanism, body parts, diagnosis, surgical/medical history. Max 80 words.",
    prompt: "Max 80 words. State: date of injury, mechanism, body parts affected, initial diagnosis, and any surgical or significant medical interventions since injury. Factual and chronological. No prose filler."
  },
  "WorkCover Claim Details": {
    hint: "Claim number, employer, job title, date of injury, insurer. Labelled lines.",
    prompt: "Present as labelled lines: 'Claim Number:', 'Employer:', 'Job Title/Occupation:', 'Date of Injury:', 'Managing Insurer:'. No prose."
  },
  "Functional Capacity Assessment": {
    hint: "Results table: Test | Result | Job Demand | Status (Meets/Does Not Meet).",
    prompt: "Plain text table: Test | Result (units) | Pre-Injury / Job Demand Requirement | Status (Meets / Does Not Meet). Follow with max 50 words on overall work capacity conclusion. Reference specific job tasks where possible."
  },
  "Return to Work Plan": {
    hint: "Graduated RTW table: Week | Hours | Duties | Restrictions.",
    prompt: "Present RTW plan as a plain text table: Week | Hours/Day | Permitted Duties | Restrictions. Follow with: 'Full Duties Target Date:' and 'Progression Criteria:' as labelled lines. Max 100 words total including table."
  },
  "Barriers to Recovery": {
    hint: "Physical, psychological, workplace, system barriers. Hyphen list with impact and action.",
    prompt: "Hyphen list. For each barrier: '- [Barrier type]: [specific barrier] â€” Impact: [effect on recovery] â€” Action: [what was done or recommended]'. Max 4 barriers. No prose paragraphs."
  },
  "RTW Timeline": {
    hint: "Key milestones with dates. Table format.",
    prompt: "Plain text table: Milestone | Target Date | Status. Include: modified duties start, progression checkpoint, full duties target, estimated case closure. No prose."
  },
  "Equipment Recommendations": {
    hint: "Equipment/modifications list with rationale. Numbered list.",
    prompt: "Numbered list. For each item: '(n) [Equipment/modification] â€” Rationale: [one-clause evidence-based reason]'. Max 5 items."
  },
  "NDIS Plan Goals": {
    hint: "Client's NDIS goals verbatim, then EP sub-goals and measurable outcomes.",
    prompt: "For each NDIS plan goal: (1) state the goal exactly as written in the plan, (2) state the EP sub-goal in SMART format, (3) state the measurable outcome indicator. Present as a numbered list. No prose paragraphs."
  },
  "Support Needs Summary": {
    hint: "NDIS domains â€” support type, frequency, justification. Max 30 words per domain.",
    prompt: "For each relevant NDIS domain: '[Domain]: [support type required], [frequency] â€” [one-clause justification referencing assessment evidence]'. Max 30 words per domain. Present as labelled sections."
  },
  "Reasonable & Necessary Justification": {
    hint: "Link EP services to NDIS criteria â€” effective, appropriate, value for money. Max 120 words.",
    prompt: "Max 120 words. Address NDIS reasonable and necessary criteria: (1) effective â€” reference assessment evidence showing EP intervention works for this condition, (2) appropriate â€” explain why EP specifically, not another discipline, (3) value for money â€” state frequency and total hours and expected functional outcome. No filler."
  },
  "Participant Profile": {
    hint: "Diagnosis, functional profile, living situation, informal supports, plan dates. Max 100 words.",
    prompt: "Max 100 words. State: primary and secondary diagnoses, brief functional profile, living situation, informal support network, NDIS plan start/end dates, and relevant funding categories. Factual â€” no prose narrative."
  },
  "Goals Progress": {
    hint: "Goal | Baseline | Current | Evidence | Rating â€” table format.",
    prompt: "Plain text table: Goal | Baseline Status | Current Status (with evidence) | Progress Rating. Use ratings: Achieved / Significant Progress / Moderate Progress / Limited Progress / No Progress. One row per goal. Follow with max 30 words on overall progress narrative."
  },
  "Transition Plan": {
    hint: "Community exercise, self-management, carer training, referrals. Numbered list. Max 100 words.",
    prompt: "Numbered list, max 100 words. Include: specific community exercise programs, self-management strategies taught, any carer training provided, referrals to other services, and ongoing supports required. One line per item."
  },
  "Accident & Injury Summary": {
    hint: "Date, mechanism, injuries, acute treatment, current status. Max 80 words.",
    prompt: "Max 80 words. State: date of accident, mechanism, injuries sustained with diagnoses, acute medical treatment received, and current injury status. Chronological and factual."
  },
  "TAC Claim Details": {
    hint: "Claim number, accident date, vehicle type, claimed injuries. Labelled lines.",
    prompt: "Present as labelled lines: 'TAC Claim Number:', 'Date of Accident:', 'Vehicle Type:', 'Injuries Included in Claim:'. No prose."
  },
  "Rehabilitation Goals": {
    hint: "SMART RTW and functional goals. Numbered list.",
    prompt: "Numbered list. Format each goal: '[Goal] â€” Target: [measurable outcome] by [date]'. Include RTW goals, return to activity goals, and ADL goals. Align to TAC/MAIC/ACC recovery expectations. Max 5 goals."
  },
  "Treatment Approach": {
    hint: "Numbered list: intervention type, frequency, duration, rationale. Max 150 words.",
    prompt: "Numbered list. For each intervention: (1) type (e.g. progressive resistance training), (2) frequency (e.g. 2x/week), (3) session duration, (4) total sessions, (5) one-clause rationale based on assessment findings. Max 150 words."
  },
  "Clinical Summary": {
    hint: "Key findings, functional status, treatment delivered, current status. Max 150 words.",
    prompt: "Max 150 words. Write for a GP audience. Sentence 1: client and reason for report. Sentence 2â€“3: key assessment findings with values. Sentence 4â€“5: treatment delivered and response. Final sentence: current functional status and recommendation. No preamble, no sign-off."
  },
  "Key Assessment Findings": {
    hint: "Most clinically significant results â€” abnormals flagged. Max 5 findings.",
    prompt: "Hyphen list, max 5 items. Format each: '- [Test name]: [result with units] ([normative range]) â€” [one-clause clinical significance]'. Flag anything outside normal range. Items requiring GP action should be marked with (ACTION REQUIRED)."
  },
  "Medication Considerations": {
    hint: "Medications affecting exercise â€” effects observed, GP review recommendations.",
    prompt: "Hyphen list. For each relevant medication: '- [Medication]: [effect on exercise response observed] â€” [recommendation if any]'. Only include medications with exercise implications. If none, write 'No exercise-significant medication interactions identified.'"
  },
  "Onward Referrals": {
    hint: "Numbered referral list with rationale. Max 5 referrals.",
    prompt: "Numbered list. For each referral: '[Discipline/Service] â€” Reason: [one-clause clinical rationale]'. Max 5 items. Include specialist, allied health, and community services as relevant."
  },
  "Session Summary": {
    hint: "Sessions in period â€” frequency, interventions, milestones. Max 100 words.",
    prompt: "Max 100 words. State: number of sessions in period, attendance rate, frequency, intervention types delivered, and 1â€“2 key clinical milestones. Draw from SOAP notes if available. No session-by-session detail."
  },
  "Outcome Measures": {
    hint: "Change table: Test | Previous | Current | Change.",
    prompt: "Plain text table: Test | Previous Result (date) | Current Result (date) | Absolute Change | Direction (Improved / Declined / Unchanged). One row per test. No prose â€” table only."
  },
  "Barriers / Setbacks": {
    hint: "Hyphen list â€” barrier, impact, action taken.",
    prompt: "Hyphen list. Format: '- [Barrier]: [specific description] â€” Impact: [effect on progress] â€” Action: [management strategy]'. Max 4 items. No prose paragraphs."
  },
  "Purpose of Report": {
    hint: "Report type, audience, period, content. 2â€“3 labelled lines.",
    prompt: "Present as labelled lines: 'Report Type:', 'Prepared For:', 'Reporting Period:', 'Contents:'. Max 30 words. No prose."
  },
  "SIRA Claim Details": {
    hint: "SIRA claim number, date of injury, employer, insurer, occupation. Labelled lines.",
    prompt: "Present as labelled lines: 'SIRA Claim Number:', 'Date of Injury:', 'Employer:', 'Managing Insurer:', 'Occupation/Job Title:'. No prose."
  },
};

export default function SectionEditor({ sections, content, onChange, client, clientAssessments, clientConditions, selectedAssessmentIds, clinician, priorReports, soapNotes, reportTypeKey, reportTitle }) {
  const [activeSection, setActiveSection] = useState(sections[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTidying, setIsTidying] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [signature, setSignature] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const canvasRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  const isSignatureSection = activeSection?.toLowerCase().includes('signature') || activeSection?.toLowerCase().includes('provider signature');
  const getSectionGuidance = (sectionName) => SECTION_GUIDANCE[sectionName] || null;
  const activeGuidance = getSectionGuidance(activeSection);
  const isAttachmentSection = activeSection?.toLowerCase().includes('attachment');

  React.useEffect(() => {
    if (isSignatureSection && clinician && !content[activeSection]) {
      const autoText = `${clinician.full_name || ''}${clinician.provider_number ? `\nProvider Number: ${clinician.provider_number}` : ''}${clinician.profession ? `\nProfession: ${clinician.profession}` : ''}`;
      onChange({ ...content, [activeSection]: autoText });
    }
  }, [activeSection, clinician]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(false);
    if (canvasRef.current) {
      const signatureData = canvasRef.current.toDataURL();
      setSignature(signatureData);
      const textContent = content[activeSection] || '';
      onChange({ ...content, [activeSection]: textContent, [`${activeSection}_signature`]: signatureData });
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignature("");
      onChange({ ...content, [`${activeSection}_signature`]: null });
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const uploadPromises = files.map(file => UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const existingAttachments = content[`${activeSection}_attachments`] || [];
      const newAttachments = results.map((result, index) => ({ url: result.file_url, name: files[index].name }));
      const documentPromises = newAttachments.map(attachment =>
        base44.entities.ClientDocument.create({
          client_id: client.id, document_type: "report",
          file_url: attachment.url, file_name: attachment.name,
          notes: `Attached to report section: ${activeSection}`
        })
      );
      await Promise.all(documentPromises);
      onChange({ ...content, [`${activeSection}_attachments`]: [...existingAttachments, ...newAttachments] });
      toast.success(`${files.length} file(s) uploaded`);
    } catch (error) {
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index) => {
    const attachments = content[`${activeSection}_attachments`] || [];
    onChange({ ...content, [`${activeSection}_attachments`]: attachments.filter((_, i) => i !== index) });
  };

  const buildFullContext = (forSection = null) => {
    const allAssessments = clientAssessments || [];
    const assessmentsToUse = selectedAssessmentIds && selectedAssessmentIds.length > 0
      ? allAssessments.filter(ca => selectedAssessmentIds.includes(ca.id))
      : allAssessments;

    const formattedAssessments = assessmentsToUse.map(a => {
      const additional = a.additional_data || {};
      return {
        name: a.name,
        date: a.assessment_date,
        result: a.result_value,
        unit: a.unit_of_measure,
        notes: a.notes,
        soap_text: additional.soap_text || null,
        normative_comparison: additional.normative_comparison || null,
        interpretation: additional.interpretation || null,
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const clientContext = {
      name: client.full_name,
      dob: client.date_of_birth,
      age: client.date_of_birth ? Math.floor((new Date() - new Date(client.date_of_birth)) / 31557600000) : null,
      conditions: (clientConditions || []).map(c => ({ name: c.condition_name, medication: c.medication, notes: c.notes, pain_level: c.pain_level })),
      goals: client.client_goals || null,
      referral: { source: client.referral_source, reason: client.referral_reason, date: client.referral_date },
      funding: client.funding_source,
      assessments: formattedAssessments,
      apss_stage1: client.apss_completed ? {
        risk_factors: [
          client.apss_q1_heart_stroke && 'Heart/stroke history',
          client.apss_q2_chest_pain && 'Chest pain',
          client.apss_q3_faint_dizzy && 'Dizziness',
          client.apss_q4_asthma && 'Asthma',
          client.apss_q5_diabetes_control && 'Diabetes control issues',
          client.apss_q6_other_conditions && 'Other conditions'
        ].filter(Boolean),
        activity_minutes: client.apss_q7_total_minutes
      } : null,
      apss_stage2: client.apss_stage2_completed ? {
        bmi: client.apss_s2_bmi,
        blood_pressure: `${client.apss_s2_systolic_bp}/${client.apss_s2_diastolic_bp}`,
        smoking: client.apss_s2_smoking,
        medications: client.apss_s2_prescribed_medications
      } : null,
      dva_info: client.funding_source === 'dva' ? { card_number: client.dva_card_number, accepted_conditions: client.dva_accepted_conditions } : null,
      ndis_info: client.funding_source === 'ndis' ? { number: client.ndis_number, goals: client.ndis_goals, functional_impact: client.ndis_functional_impact } : null,
      workcover_info: client.funding_source === 'workcover_qld' ? { injury_date: client.workcover_date_of_injury, injury_description: client.workcover_injury_description, work_capacity: client.workcover_work_capacity, rtw_planning: client.workcover_rtw_planning } : null,
      tac_info: client.funding_source === 'tac_maic' ? { claim_number: client.tac_maic_claim_number, injury_description: client.tac_maic_injury_description, functional_limitations: client.tac_maic_functional_limitations } : null,
    };

    const priorReportContext = priorReports && priorReports.length > 0
      ? priorReports.map(r => {
          const sections = r.section_content ? Object.entries(r.section_content)
            .filter(([, v]) => v?.trim())
            .map(([k, v]) => `  ${k}: ${v.substring(0, 300)}`)
            .join('\n') : 'No section content available.';
          return `--- ${r.report_name} (${r.report_date}) ---\n${sections}`;
        }).join('\n\n')
      : null;

    const soapContext = soapNotes && soapNotes.length > 0
      ? soapNotes.slice(0, 10).map(n =>
          `[${n.note_date || 'Date unknown'}]\nS: ${n.subjective || ''}\nO: ${n.objective || ''}\nA: ${n.assessment || ''}\nP: ${n.plan || ''}`
        ).join('\n---\n')
      : null;

    return { clientContext, priorReportContext, soapContext };
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { clientContext, priorReportContext, soapContext } = buildFullContext(activeSection);
      const hasAssessments = clientContext.assessments && clientContext.assessments.length > 0;
      const assessmentSummary = hasAssessments
        ? [
            `Test | Date | Result | Normative Range | Classification`,
            `-----|------|--------|-----------------|---------------`,
            ...clientContext.assessments.map(a =>
              `${a.name} | ${a.date} | ${a.result ? `${a.result} ${a.unit || ''}`.trim() : 'Not recorded'} | ${a.normative_comparison || 'â€”'} | ${a.classification || 'â€”'}`
            )
          ].join('\n')
        : 'No assessment results available.';

      const sectionGuidance = SECTION_GUIDANCE[activeSection];
      const sectionSpecificInstructions = sectionGuidance
        ? `\n\nSECTION-SPECIFIC REQUIREMENTS for "${activeSection}":\n${sectionGuidance.prompt}${sectionGuidance.maxWords ? `\n- Write no more than ${sectionGuidance.maxWords} words for this section. Be tight.` : ''}`
        : '';

      const metaKey = REPORT_META_TEMPLATE_MAP[reportTypeKey];
      const meta = metaKey ? META_TEMPLATES[metaKey] : null;
      const metaInstruction = meta
        ? `\n\nREPORT FORMAT GUIDANCE (${meta.label} â€” target ${meta.recommended_length_pages} page${meta.recommended_length_pages > 1 ? 's' : ''}):\n${meta.ai_instruction}`
        : '';

      const prompt = `You are an expert Exercise Physiologist (AEP) writing the "${activeSection}" section of a "${reportTitle || 'clinical'}" report for an allied health practice.

REPORT TYPE: ${reportTitle || reportTypeKey || 'Clinical Report'}
SECTION BEING WRITTEN: ${activeSection}${metaInstruction}

CLIENT INFORMATION:
${JSON.stringify(clientContext, null, 2)}

ASSESSMENT RESULTS (IMPORTANT â€” reference these specifically by name, result, and clinical meaning):
${assessmentSummary}

${priorReportContext ? `PRIOR REPORTS FOR THIS CLIENT (use to maintain consistency and show progress):
${priorReportContext}
` : ''}
${soapContext ? `RECENT SOAP / SESSION NOTES (use to reflect actual treatment delivered):
${soapContext}
` : ''}${sectionSpecificInstructions}

CLINICAL WRITING RULES â€” FOLLOW STRICTLY:

1. WORD LIMITS â€” enforce without exception:
   - Referral acceptance / confirmation letters: max 150 words total
   - GP/specialist summary letters: max 300 words total
   - Individual progress, initial, or discharge report sections: max 200 words per section
   - FCE / functional capacity sections: max 250 words per section
   - Treatment plan / care plan sections: max 200 words per section
   Stop at the limit. Do not pad to fill space.

2. NO REPETITION â€” each section must contain NEW information only:
   - Never restate diagnosis, DOB, or background already stated in a prior section
   - Never repeat assessment result values stated elsewhere in the report
   - Reference prior sections with "as noted above" â€” do not restate detail

3. STRUCTURE â€” use the most scannable format for the content type:
   - Assessment results: plain text table (Test | Result | Norm | Interpretation)
   - Goal progress: one line per goal (Goal -> Baseline -> Current -> Rating)
   - Recommendations: numbered list with frequency/hours on every line
   - Barriers: plain hyphens as bullet points, one per line
   - Prose paragraphs: only for narrative sections (background, prognosis, clinical reasoning)

4. GOAL LINKING â€” every finding must connect to a goal or functional outcome:
   - Do not state a result without explaining its functional significance
   - Use language like "limiting [goal]", "supports return to [activity]", "demonstrates readiness for [task]"
   - Use rating scales for progress: Achieved / Significant Progress / Moderate Progress / Limited Progress / No Progress

5. FUNDER AUDIENCE â€” adjust tone and terminology to the report type:
   - NDIS: ICF language, support domains, line item codes where applicable
   - WorkCover / RTW (all states): work capacity, job demands, RTW timeline, barriers
   - Medicare / DVA: chronic disease management, functional change, cycle justification
   - FCE / Legal: consistency of effort, reliability of results, overall work capacity
   - GP letter: plain clinical English, key message in first two sentences
   - UK NHS ERS / Cardiac / Pulmonary / Cancer Rehab: programme outcomes, BACPR/BTS guideline language
   - UK PMI: insurer-focused, concise functional status and treatment justification
   - Canada WSIB: FAF-relevant functional tolerances (Form 2647A) where applicable
   - Canada WorkSafeBC / WCB Alberta: FCE findings, RTW classification, functional tolerances
   - Canada EHB / VAC: private insurer or Veterans Affairs programme language
   - NZ ACC: ACC32 extension criteria, programme outcome KPIs
   - NZ Disability Support / Private Insurance: functional independence, support needs
   - Singapore Healthier SG / CDMP: MOH programme KPIs, chronic disease management language
   - Singapore WICA: work injury functional tolerances, RTW plan
   - Ireland HSE / Cardiac Rehab: HSE programme outcomes, PIAB FCE standards
   - South Africa Medical Aid: scheme-compliant language, ICD-10 codes
   - South Africa COIDA: functional capacity, RTW classification, compensation board language
   - South Africa RAF: road accident functional capacity, impairment rating

6. SIGN-OFF READINESS:
   - Include practitioner name, qualification, and registration number in the final section ONLY
   - All dates must be explicitly stated â€” never "recently" or "previously"
   - All numbers must include units (480m, 85kg, 3x/week, 45 min)

7. EXCLUDE â€” never include:
   - Preamble ("This report aims to...", "It is my pleasure to...")
   - Sign-offs ("Please do not hesitate to contact me...")
   - Repeated section headers within body text
   - Speculative language without evidence ("may", "could potentially")
   - Generic filler ("The client has been working hard toward their goals")

Write ONLY the "${activeSection}" section. Return ONLY plain text â€” no HTML, no markdown, no bullet symbols except plain hyphens for lists.`;

      const response = await InvokeLLM({ prompt });
      onChange({ ...content, [activeSection]: response });
      toast.success("Content generated!");
    } catch (error) {
      toast.error("Failed to generate content");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTidy = async () => {
    if (!content[activeSection]?.trim()) { toast.error("Please add some content first"); return; }
    setIsTidying(true);
    try {
      const prompt = `You are editing a clinical report section. Apply these rules strictly and return ONLY the corrected plain text:

1. Cut any sentence that repeats information already present in the same section
2. Replace vague language ("significantly improved", "worked hard", "the client has been progressing well") with specific measurable statements â€” if no data exists to support the claim, delete the sentence
3. Convert any prose list of assessment results into a plain text table: Test | Result | Norm | Interpretation
4. Remove all preamble, sign-offs, and filler phrases
5. Enforce a 200-word maximum â€” cut from the bottom if over the limit
6. Ensure every finding is linked to a goal or functional outcome
7. Use plain hyphens for bullet points, no symbols

SECTION TO EDIT:
${content[activeSection]}`;
      const response = await InvokeLLM({ prompt });
      onChange({ ...content, [activeSection]: response });
      toast.success("Content tidied!");
    } catch (error) {
      toast.error("Failed to tidy content");
    } finally {
      setIsTidying(false);
    }
  };

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    const newContent = { ...content };
    try {
      const { clientContext, priorReportContext, soapContext } = buildFullContext();
      for (const section of sections) {
        if (section.toLowerCase().includes('signature') || section.toLowerCase().includes('attachment')) continue;
        const hasAssessments = clientContext.assessments && clientContext.assessments.length > 0;
        const assessmentSummary = hasAssessments
          ? [
              `Test | Date | Result | Normative Range | Classification`,
              `-----|------|--------|-----------------|---------------`,
              ...clientContext.assessments.map(a =>
                `${a.name} | ${a.date} | ${a.result ? `${a.result} ${a.unit || ''}`.trim() : 'Not recorded'} | ${a.normative_comparison || 'â€”'} | ${a.classification || 'â€”'}`
              )
            ].join('\n')
          : 'No assessment results available.';

        const sg = SECTION_GUIDANCE[section];
        const sgInstructions = sg ? `\n\nSECTION-SPECIFIC REQUIREMENTS for "${section}":\n${sg.prompt}${sg.maxWords ? `\n- Write no more than ${sg.maxWords} words for this section. Be tight.` : ''}` : '';
        const metaKey = REPORT_META_TEMPLATE_MAP[reportTypeKey];
        const meta = metaKey ? META_TEMPLATES[metaKey] : null;
        const metaInstruction = meta
          ? `\n\nREPORT FORMAT GUIDANCE (${meta.label} â€” target ${meta.recommended_length_pages} page${meta.recommended_length_pages > 1 ? 's' : ''}):\n${meta.ai_instruction}`
          : '';
        const prompt = `You are an expert Exercise Physiologist (AEP) writing the "${section}" section of a "${reportTitle || 'clinical'}" report.

REPORT TYPE: ${reportTitle || reportTypeKey || 'Clinical Report'}
SECTION BEING WRITTEN: ${section}${metaInstruction}

CLIENT INFORMATION:
${JSON.stringify(clientContext, null, 2)}

ASSESSMENT RESULTS (reference these specifically by name, result, and clinical meaning):
${assessmentSummary}

${priorReportContext ? `PRIOR REPORTS FOR THIS CLIENT:\n${priorReportContext}\n` : ''}
${soapContext ? `RECENT SOAP / SESSION NOTES:\n${soapContext}\n` : ''}${sgInstructions}

CLINICAL WRITING RULES â€” FOLLOW STRICTLY:

1. WORD LIMITS â€” enforce without exception:
   - Referral acceptance / confirmation letters: max 150 words total
   - GP/specialist summary letters: max 300 words total
   - Individual progress, initial, or discharge report sections: max 200 words per section
   - FCE / functional capacity sections: max 250 words per section
   - Treatment plan / care plan sections: max 200 words per section
   Stop at the limit. Do not pad to fill space.

2. NO REPETITION â€” each section must contain NEW information only:
   - Never restate diagnosis, DOB, or background already stated in a prior section
   - Never repeat assessment result values stated elsewhere in the report
   - Reference prior sections with "as noted above" â€” do not restate detail

3. STRUCTURE â€” use the most scannable format for the content type:
   - Assessment results: plain text table (Test | Result | Norm | Interpretation)
   - Goal progress: one line per goal (Goal -> Baseline -> Current -> Rating)
   - Recommendations: numbered list with frequency/hours on every line
   - Barriers: plain hyphens as bullet points, one per line
   - Prose paragraphs: only for narrative sections (background, prognosis, clinical reasoning)

4. GOAL LINKING â€” every finding must connect to a goal or functional outcome:
   - Do not state a result without explaining its functional significance
   - Use language like "limiting [goal]", "supports return to [activity]", "demonstrates readiness for [task]"
   - Use rating scales for progress: Achieved / Significant Progress / Moderate Progress / Limited Progress / No Progress

5. FUNDER AUDIENCE â€” adjust tone and terminology to the report type:
   - NDIS: ICF language, support domains, line item codes where applicable
   - WorkCover / RTW (all states): work capacity, job demands, RTW timeline, barriers
   - Medicare / DVA: chronic disease management, functional change, cycle justification
   - FCE / Legal: consistency of effort, reliability of results, overall work capacity
   - GP letter: plain clinical English, key message in first two sentences
   - UK NHS ERS / Cardiac / Pulmonary / Cancer Rehab: programme outcomes, BACPR/BTS guideline language
   - UK PMI: insurer-focused, concise functional status and treatment justification
   - Canada WSIB: FAF-relevant functional tolerances (Form 2647A) where applicable
   - Canada WorkSafeBC / WCB Alberta: FCE findings, RTW classification, functional tolerances
   - Canada EHB / VAC: private insurer or Veterans Affairs programme language
   - NZ ACC: ACC32 extension criteria, programme outcome KPIs
   - NZ Disability Support / Private Insurance: functional independence, support needs
   - Singapore Healthier SG / CDMP: MOH programme KPIs, chronic disease management language
   - Singapore WICA: work injury functional tolerances, RTW plan
   - Ireland HSE / Cardiac Rehab: HSE programme outcomes, PIAB FCE standards
   - South Africa Medical Aid: scheme-compliant language, ICD-10 codes
   - South Africa COIDA: functional capacity, RTW classification, compensation board language
   - South Africa RAF: road accident functional capacity, impairment rating

6. SIGN-OFF READINESS:
   - Include practitioner name, qualification, and registration number in the final section ONLY
   - All dates must be explicitly stated â€” never "recently" or "previously"
   - All numbers must include units (480m, 85kg, 3x/week, 45 min)

7. EXCLUDE â€” never include:
   - Preamble ("This report aims to...", "It is my pleasure to...")
   - Sign-offs ("Please do not hesitate to contact me...")
   - Repeated section headers within body text
   - Speculative language without evidence ("may", "could potentially")
   - Generic filler ("The client has been working hard toward their goals")

Write ONLY the "${section}" section. Return ONLY plain text â€” no HTML, no markdown, no bullet symbols except plain hyphens for lists.`;
        const response = await InvokeLLM({ prompt });
        newContent[section] = response;
      }
      onChange(newContent);
      toast.success("All sections generated!");
    } catch (error) {
      toast.error("Failed to generate all sections");
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const completedSections = sections.filter(s => content[s]?.trim()).length;

  return (
    <div className="space-y-4 pt-2">
      {((priorReports && priorReports.length > 0) || (soapNotes && soapNotes.length > 0)) && (
        <div className="border border-blue-200 rounded-lg bg-blue-50">
          <button
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-800"
            onClick={() => setShowContext(!showContext)}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Prior context available for AI generation
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                {(priorReports?.length || 0)} prior report{priorReports?.length !== 1 ? 's' : ''} Â· {(soapNotes?.length || 0)} SOAP note{soapNotes?.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {showContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showContext && (
            <div className="px-4 pb-3 space-y-3">
              {priorReports && priorReports.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-blue-700 mb-1">Prior Reports</p>
                  <div className="space-y-1">
                    {priorReports.map(r => (
                      <div key={r.id} className="text-xs text-blue-900 bg-white rounded px-2 py-1 border border-blue-100">
                        {r.report_name} <span className="text-blue-400">({r.report_date})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {soapNotes && soapNotes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-blue-700 mb-1">Recent SOAP Notes ({soapNotes.length})</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {soapNotes.slice(0, 5).map(n => (
                      <div key={n.id} className="text-xs text-blue-900 bg-white rounded px-2 py-1 border border-blue-100">
                        <span className="font-medium">{n.note_date}</span> â€” {n.subjective ? n.subjective.substring(0, 80) + '...' : 'No subjective noted'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-blue-600">{completedSections}</span> of {sections.length} sections completed
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateAll}
          disabled={isGeneratingAll}
          className="border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          {isGeneratingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Generate All Sections
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="w-48 flex-shrink-0 space-y-1">
          {sections.map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                activeSection === section
                  ? 'bg-blue-600 text-white font-semibold'
                  : content[section]?.trim()
                  ? 'bg-green-50 text-green-800 border border-green-200 hover:bg-green-100'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {content[section]?.trim() && activeSection !== section && (
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 mb-0.5" />
              )}
              {section}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-slate-700">{activeSection}</Label>
            <div className="flex gap-2">
              {!isSignatureSection && !isAttachmentSection && (
                <>
                  <Button size="sm" variant="outline" onClick={handleTidy} disabled={isTidying || !content[activeSection]?.trim()} className="text-xs">
                    {isTidying ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                    Tidy
                  </Button>
                  <Button size="sm" onClick={handleGenerate} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                    {isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    {content[activeSection]?.trim() ? 'Regenerate' : 'AI Generate'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {activeGuidance && !isSignatureSection && !isAttachmentSection && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">ðŸ’¡</span>
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">This section should include: </span>{activeGuidance.hint}
              </p>
            </div>
          )}

          {isSignatureSection ? (
            <div className="space-y-3">
              <Textarea
                value={content[activeSection] || ""}
                onChange={(e) => onChange({ ...content, [activeSection]: e.target.value })}
                placeholder="Provider name and credentials..."
                className="min-h-[80px] text-sm"
              />
              <div className="border rounded-lg p-3 bg-slate-50">
                <p className="text-xs text-slate-500 mb-2">Draw signature below:</p>
                <canvas
                  ref={canvasRef} width={400} height={120}
                  className="border rounded bg-white cursor-crosshair w-full"
                  onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                />
                <Button size="sm" variant="outline" onClick={clearSignature} className="mt-2 text-xs">Clear Signature</Button>
              </div>
            </div>
          ) : isAttachmentSection ? (
            <div className="space-y-3">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="text-xs">
                {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload Files
              </Button>
              <div className="space-y-2">
                {(content[`${activeSection}_attachments`] || []).map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 rounded px-3 py-2 border">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <a href={att.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">{att.name}</a>
                    </div>
                    <button onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Textarea
              value={content[activeSection] || ""}
              onChange={(e) => onChange({ ...content, [activeSection]: e.target.value })}
              placeholder={`Write the ${activeSection} section here, or click AI Generate to auto-fill...`}
              className="min-h-[280px] text-sm leading-relaxed resize-y"
            />
          )}

          <p className="text-xs text-slate-400">
            {content[activeSection]?.trim()
              ? `${content[activeSection].trim().split(/\s+/).length} words`
              : 'Empty â€” type freely or use AI Generate'}
          </p>
        </div>
      </div>
    </div>
  );
}