import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ClientCondition, ClientAssessment, Assessment, User, Client } from "@/entities/all";
import { ClientReport } from "@/entities/ClientReport";
import { InvokeLLM } from "@/integrations/Core";
import { Wand2, Printer, Loader2, Sparkles, ChevronLeft, ChevronRight, Save, Edit } from "lucide-react";
import { Toaster, toast } from "sonner";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge"; // Added Badge import

const PrintableReport = React.forwardRef(({ reportContent, client, clinician }, ref) => {
  // Ensure reportContent is a string before rendering. If it's a data object, extract html_content.
  const contentToRender = typeof reportContent === 'object' && reportContent !== null && 'html_content' in reportContent
    ? reportContent.html_content
    : reportContent;

  return (
    <div ref={ref} className="printable-report">
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .printable-report { 
            width: 100%; 
            font-family: Calibri, 'Segoe UI', Tahoma, sans-serif; 
            font-size: 9pt; 
            line-height: 1.3; 
            color: #000 !important; 
            background: white; 
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 1em; 
            padding-bottom: 0.5em; 
            border-bottom: 2px solid #000; 
          }
          .clinic-details { 
            text-align: right; 
            font-size: 8pt; 
            color: #000 !important;
          }
          .report-title { 
            text-align: center; 
            font-size: 12pt; 
            font-weight: bold; 
            margin: 0.5em 0; 
            color: #000 !important;
          }
          .report-content h2 { 
            color: #000 !important; 
            border-bottom: 1px solid #000; 
            padding-bottom: 0.3rem; 
            margin: 1em 0 0.5em; 
            font-size: 10pt; 
            font-weight: bold;
          }
          .report-content p {
            color: #000 !important;
            margin: 0.5em 0;
            font-size: 9pt;
          }
          .report-content ul, .report-content ol {
            color: #000 !important;
            margin: 0.5em 0;
            padding-left: 1.5em;
          }
          .report-content li {
            color: #000 !important;
            font-size: 9pt;
            margin: 0.2em 0;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 1em; 
            font-size: 9pt;
          }
          th, td { 
            border: 1px solid #000; 
            padding: 4px 6px; 
            text-align: left; 
            color: #000 !important;
            font-size: 9pt;
          }
          th { 
            background-color: #e8e8e8 !important; 
            font-weight: bold; 
          }
          strong {
            color: #000 !important;
          }
        }
      `}</style>

      <div className="header">
        {clinician?.clinic_logo_url ? (
          <img src={clinician.clinic_logo_url} alt="Clinic Logo" style={{ maxWidth: '120px', maxHeight: '60px' }} />
        ) : (
          <h2 style={{ margin: 0, fontSize: '11pt', color: '#000' }}>{clinician?.clinic_name || ""}</h2>
        )}
        <div className="clinic-details">
          <strong>{clinician?.clinic_name || ""}</strong><br />
          {clinician?.clinic_address || ""}<br />
          {clinician?.clinic_phone || ""} | {clinician?.clinic_email || ""}
        </div>
      </div>

      <div className="report-title">
        DVA Patient Care Plan for {client.full_name}
      </div>
      <div className="report-content" dangerouslySetInnerHTML={{ __html: contentToRender }} />
    </div>
  );
});

export default function DVAPatientCarePlan({ client, onClose, editingReport }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [clinician, setClinician] = useState(null);
  const [clientData, setClientData] = useState({ conditions: [], assessments: [] });
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState([]);

  // Location selection state
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);

  // Step 1: DVA-specific details (formerly Step 0)
  const [referralDate, setReferralDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientConsented, setClientConsented] = useState(false);
  const [referringClinician, setReferringClinician] = useState("");
  const [previousTreatment, setPreviousTreatment] = useState("");
  const [clinicianSignature, setClinicianSignature] = useState("");
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Step 2: Assessments (formerly Step 1)

  // Step 3: Client Goals (formerly Step 2)
  const [goalsAgreed, setGoalsAgreed] = useState("");
  const [clientGoalsText, setClientGoalsText] = useState("");
  const [includeOnboardingGoals, setIncludeOnboardingGoals] = useState(true);

  // Step 4: Interpretation (formerly Step 3)
  const [interpretation, setInterpretation] = useState("");
  const [isGeneratingInterpretation, setIsGeneratingInterpretation] = useState(false);
  const [isTidyingInterpretation, setIsTidyingInterpretation] = useState(false);

  // Step 5: Management Plan (formerly Step 4)
  const [managementPlan, setManagementPlan] = useState("");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isTidyingPlan, setIsTidyingPlan] = useState(false);

  // Step 6: Review & Print (formerly Step 5)
  const [finalReport, setFinalReport] = useState(""); // This is the HTML string of the report
  const [reportDetailsToSave, setReportDetailsToSave] = useState({}); // State to hold report data object before saving

  // New state for editing functionality
  const [isEditing, setIsEditing] = useState(false);

  const [isSaving, setIsSaving] = useState(false); // State for saving loading indicator
  const printRef = useRef(null);

  const stepTitles = [
    "Select Location", // New Step 0
    "DVA Details & Signature", // Formerly Step 0, now Step 1
    "Select Assessments",      // Formerly Step 1, now Step 2
    "Client Goals",            // Formerly Step 2, now Step 3
    "Interpretation",          // Formerly Step 3, now Step 4
    "Management Plan",         // Formerly Step 4, now Step 5
    "Review & Print"           // Formerly Step 5, now Step 6
  ];

  useEffect(() => {
    loadInitialData();
  }, [client.id, editingReport]);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // If signature exists, re-draw it
      if (clinicianSignature) {
        const img = new Image();
        img.src = clinicianSignature;
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear if signature is empty
      }
    }
  }, [currentStep, clinicianSignature]); // Re-run if step changes or signature state changes

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [currentClinician, conditions, clientAssessmentsData, assessmentsData] = await Promise.all([
        User.me(),
        ClientCondition.filter({ client_id: client.id }),
        ClientAssessment.filter({ client_id: client.id, status: "completed" }),
        Assessment.list(),
      ]);

      setClinician(currentClinician);
      setLocations(currentClinician.locations || []);

      const assessmentMap = new Map(assessmentsData.map(a => [a.id, a]));
      const augmentedClientAssessments = clientAssessmentsData.map(ca => ({
        ...ca,
        name: assessmentMap.get(ca.assessment_id)?.name || 'Unknown Assessment',
        unit_of_measure: assessmentMap.get(ca.assessment_id)?.unit_of_measure || '',
      }));
      setClientData({ conditions, assessments: augmentedClientAssessments });

      if (editingReport) {
        // Load data from existing report for editing
        const reportData = editingReport.report_data;

        // Set location from report data
        const savedLocationId = reportData.selectedLocationId;
        if (savedLocationId && currentClinician.locations) {
          const loc = currentClinician.locations.find(l => l.id === savedLocationId);
          setSelectedLocation(loc);
        } else {
          // Fallback if location ID is not saved or not found
          const mainLoc = currentClinician.locations?.find(l => l.is_main) || currentClinician.locations?.[0];
          setSelectedLocation(mainLoc || null);
        }

        setReferralDate(reportData.referralDate || new Date().toISOString().split('T')[0]);
        setClientConsented(reportData.clientConsented || false);
        setReferringClinician(reportData.referringClinician || "");
        setPreviousTreatment(reportData.previousTreatment || "");
        setClinicianSignature(reportData.clinicianSignature || "");
        setSelectedAssessmentIds(reportData.selectedAssessmentIds || []);
        setGoalsAgreed(reportData.goalsAgreed || "");
        setClientGoalsText(reportData.clientGoalsText || "");
        setInterpretation(reportData.interpretation || "");
        setManagementPlan(reportData.managementPlan || "");
        setFinalReport(editingReport.html_content); // The stored HTML for display
        setReportDetailsToSave(reportData); // The structured data
        setCurrentStep(6); // Jump directly to new review step (Step 6)
      } else {
        // Normal new report flow
        const mainLoc = currentClinician.locations?.find(l => l.is_main) || currentClinician.locations?.[0];
        setSelectedLocation(mainLoc || null);

        setSelectedAssessmentIds(augmentedClientAssessments.map(a => a.id));

        if (client.dva_pcp_goals) {
          setClientGoalsText(client.dva_pcp_goals);
        }
        if (typeof client.dva_pcp_goals_agreed === 'boolean') {
          setGoalsAgreed(client.dva_pcp_goals_agreed ? 'yes' : 'no');
        }
      }

    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load initial data for report.");
    } finally {
      setIsLoading(false);
    }
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round'; // Ensure lineJoin is set
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        setClinicianSignature(canvas.toDataURL());
      }
    }
  };

  const clearSignature = () => {
    setClinicianSignature(""); // Clear the state first
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleAssessmentToggle = (assessmentId) => {
    setSelectedAssessmentIds(prev =>
      prev.includes(assessmentId)
        ? prev.filter(id => id !== assessmentId)
        : [...prev, assessmentId]
    );
  };

  const handleSelectAllAssessments = () => {
    if (selectedAssessmentIds.length === clientData.assessments.length) {
      setSelectedAssessmentIds([]);
    } else {
      setSelectedAssessmentIds(clientData.assessments.map(a => a.id));
    };
  };

  const handleLoadOnboardingGoals = () => {
    if (client.client_goals) {
      if (clientGoalsText.trim()) {
        setClientGoalsText(clientGoalsText + '\n\n' + client.client_goals);
      } else {
        setClientGoalsText(client.client_goals);
      }
      setIncludeOnboardingGoals(true);
      toast.success("Onboarding goals loaded!");
    }
  };

  const buildAssessmentTableHTML = () => {
    const selectedAssessments = clientData.assessments.filter(ca => selectedAssessmentIds.includes(ca.id));

    const assessmentsByType = {};
    selectedAssessments.forEach(assessment => {
      const key = assessment.assessment_id;
      if (!assessmentsByType[key]) {
        assessmentsByType[key] = {
          name: assessment.name,
          unit: assessment.unit_of_measure || '',
          results: []
        };
      }
      assessmentsByType[key].results.push(assessment);
    });

    let tableHTML = `<table style="width: 100%; border-collapse: collapse; margin: 10px 0 20px 0;">
<thead>
<tr style="background-color: #f1f5f9;">
<th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-weight: 600;">Assessment Name</th>
<th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-weight: 600;">Initial Result</th>
<th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-weight: 600;">Current Result</th>
<th style="border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-weight: 600;">Change</th>
</tr>
</thead>
<tbody>`;

    Object.values(assessmentsByType).forEach(assessmentGroup => {
      assessmentGroup.results.sort((a, b) => new Date(a.assessment_date) - new Date(b.assessment_date));

      const initial = assessmentGroup.results[0];
      const current = assessmentGroup.results[assessmentGroup.results.length - 1];

      const initialDate = new Date(initial.assessment_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
      const currentDate = new Date(current.assessment_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

      let initialResultText = `${initial.result_value || 'N/A'} ${initial.unit_of_measure || ''}`.trim();
      let currentResultText = `${current.result_value || 'N/A'} ${current.unit_of_measure || ''}`.trim();

      if (initial.additional_data) {
        const data = initial.additional_data;
        if (data.measurement_type === 'hand_grip_strength') {
          initialResultText = `Dom ${data.dominant_best || '-'} kg; Non-Dom ${data.non_dominant_best || '-'} kg`;
        } else if (data.measurement_type === 'blood_pressure') {
          initialResultText = `${data.pre_exercise_systolic || '-'}/${data.pre_exercise_diastolic || '-'} mmHg`;
        }
      }

      if (current.additional_data) {
        const data = current.additional_data;
        if (data.measurement_type === 'hand_grip_strength') {
          currentResultText = `Dom ${data.dominant_best || '-'} kg; Non-Dom ${data.non_dominant_best || '-'} kg`;
        } else if (data.measurement_type === 'blood_pressure') {
          currentResultText = `${data.pre_exercise_systolic || '-'}/${data.pre_exercise_diastolic || '-'} mmHg`;
        }
      }

      initialResultText += ` (${initialDate})`;
      currentResultText += ` (${currentDate})`;

      let changeText = '';
      if (initial.result_value && current.result_value && !isNaN(Number(initial.result_value)) && !isNaN(Number(current.result_value)) && !initial.additional_data && !current.additional_data) {
        const change = Number(current.result_value) - Number(initial.result_value);
        const percentChange = Number(initial.result_value) !== 0 ? ((change / Number(initial.result_value)) * 100).toFixed(1) : 'N/A';

        if (change > 0) {
          changeText = `+${change.toFixed(1)} ${initial.unit_of_measure || ''} (+${percentChange}%)`.trim();
        } else if (change < 0) {
          changeText = `${change.toFixed(1)} ${initial.unit_of_measure || ''} (${percentChange}%)`.trim();
        } else {
          changeText = 'No change';
        }
      } else {
        changeText = 'N/A (complex measurement)';
      }

      tableHTML += `
<tr>
<td style="border: 1px solid #e2e8f0; padding: 12px;"><strong>${assessmentGroup.name}</strong></td>
<td style="border: 1px solid #e2e8f0; padding: 12px;">${initialResultText}</td>
<td style="border: 1px solid #e2e8f0; padding: 12px;">${currentResultText}</td>
<td style="border: 1px solid #e2e8f0; padding: 12px;">${changeText}</td>
</tr>`;

      if (current.normative_comparison) {
        tableHTML += `
<tr>
<td colspan="4" style="border: 1px solid #e2e8f0; padding: 8px; background-color: #f8fafc; font-size: 0.9em; font-style: italic;">Normative Comparison: ${current.normative_comparison.replace(/_/g, ' ')}</td>
</tr>`;
      }

      if (current.notes && current.notes.trim()) {
        tableHTML += `
<tr>
<td colspan="4" style="border: 1px solid #e2e8f0; padding: 8px; background-color: #f8fafc; font-size: 0.9em;">Notes: ${current.notes}</td>
</tr>`;
      }
    });

    tableHTML += `
</tbody>
</table>`;

    return tableHTML;
  };

  const handleGenerateInterpretation = async () => {
    setIsGeneratingInterpretation(true);
    try {
      const tableHTML = buildAssessmentTableHTML();
      
      // Fetch recent SOAP notes for context
      const { SOAPNote } = await import('@/entities/SOAPNote');
      const recentNotes = await SOAPNote.filter({ client_id: client.id });
      const sortedNotes = recentNotes.sort((a, b) => new Date(b.note_date) - new Date(a.note_date)).slice(0, 3);
      
      const soapContext = sortedNotes.length > 0 ? `

Recent SOAP Notes (for clinical context):
${sortedNotes.map(note => `
Date: ${format(new Date(note.note_date), 'dd/MM/yyyy')}
Subjective: ${note.subjective || 'N/A'}
Objective: ${note.objective || 'N/A'}
Assessment: ${note.assessment || 'N/A'}
Plan: ${note.plan || 'N/A'}
`).join('\n---\n')}` : '';

      const prompt = `
You are an expert Exercise Physiologist writing the "Interpretation of Outcome Measures" section for a DVA Patient Care Plan.

Client: ${client.full_name}
Conditions: ${JSON.stringify(clientData.conditions.map(c => c.condition_name), null, 2)}
Goals: ${clientGoalsText || 'No specific goals set yet for this cycle.'}

Assessment Results:
${tableHTML}${soapContext}

Write a professional clinical interpretation of these assessment results. Include:
1. Overall functional capacity assessment
2. Specific strengths and areas of concern based on the results
3. How the results relate to the client's conditions and stated goals
4. Clinical significance of any changes or comparisons to normative data
5. Functional implications for daily activities
6. Reference to recent session progress if relevant

Keep it concise (2-3 paragraphs), professional, and clinically focused.
Return ONLY plain text, no HTML tags or markdown.
`;

      const response = await InvokeLLM({ prompt });
      setInterpretation(response);
      toast.success("Interpretation generated successfully!");
    } catch (error) {
      console.error("Error generating interpretation:", error);
      toast.error("Failed to generate interpretation.");
    } finally {
      setIsGeneratingInterpretation(false);
    }
  };

  const handleTidyInterpretation = async () => {
    if (!interpretation.trim()) {
      toast.error("Please write something first before tidying up.");
      return;
    }

    setIsTidyingInterpretation(true);
    try {
      const prompt = `
You are an expert Exercise Physiologist. Take the following interpretation text and make it more professional, concise, and clinically appropriate for a DVA Patient Care Plan.

IMPORTANT: Return ONLY plain text paragraphs. Do NOT use any HTML tags, markdown, or formatting codes. Write in complete sentences and paragraphs.

Original text:
${interpretation}

Return only the improved plain text version with proper paragraphs, no additional commentary, no HTML tags, no markdown.
`;

      const response = await InvokeLLM({ prompt });
      setInterpretation(response);
      toast.success("Interpretation tidied up successfully!");
    } catch (error) {
      console.error("Error tidying interpretation:", error);
      toast.error("Failed to tidy interpretation.");
    } finally {
      setIsTidyingInterpretation(false);
    }
  };

  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    try {
      // Fetch recent SOAP notes for context
      const { SOAPNote } = await import('@/entities/SOAPNote');
      const recentNotes = await SOAPNote.filter({ client_id: client.id });
      const sortedNotes = recentNotes.sort((a, b) => new Date(b.note_date) - new Date(a.note_date)).slice(0, 3);
      
      const soapContext = sortedNotes.length > 0 ? `

Recent SOAP Notes (for treatment progress context):
${sortedNotes.map(note => `
Date: ${format(new Date(note.note_date), 'dd/MM/yyyy')}
Subjective: ${note.subjective || 'N/A'}
Objective: ${note.objective || 'N/A'}
Assessment: ${note.assessment || 'N/A'}
Plan: ${note.plan || 'N/A'}
`).join('\n---\n')}` : '';

      const prompt = `
You are an expert Exercise Physiologist writing the "Proposed Management Plan" section for a DVA Patient Care Plan.

Client: ${client.full_name}
DOB: ${client.date_of_birth}
Conditions: ${JSON.stringify(clientData.conditions.map(c => c.condition_name), null, 2)}
Client Goals: ${clientGoalsText || 'Not specified'}

Interpretation of Results:
${interpretation}${soapContext}

Create a comprehensive, evidence-based management plan that includes:
1. Treatment goals (SMART format) - aligned with client goals where possible.
2. Exercise prescription (frequency, intensity, duration, type)
3. Progression plan over the next 12 sessions based on recent progress
4. Expected outcomes
5. Monitoring and review schedule
6. Any precautions or contraindications

Return ONLY plain text with natural formatting (numbered lists with 1. 2. 3. or bullet points with -), NO HTML tags or markdown.
Keep it professional and appropriate for DVA requirements.
`;

      const response = await InvokeLLM({ prompt });
      setManagementPlan(response);
      toast.success("Management plan generated successfully!");
    } catch (error) {
      console.error("Error generating plan:", error);
      toast.error("Failed to generate management plan.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleTidyPlan = async () => {
    if (!managementPlan.trim()) {
      toast.error("Please write something first before tidying up.");
      return;
    }

    setIsTidyingPlan(true);
    try {
      const prompt = `
You are an expert Exercise Physiologist. Take the following management plan and make it more professional, structured, and clinically appropriate for a DVA Patient Care Plan.

IMPORTANT: Return ONLY plain text with proper paragraphs and structure. Do NOT use any HTML tags, markdown, or formatting codes. You can use natural text formatting like numbered lists (1. 2. 3.) or bullet points with dashes (-) but NO HTML or markdown syntax.

Original text:
${managementPlan}

Return only the improved plain text version with clear structure, no additional commentary, no HTML tags, no markdown.
`;

      const response = await InvokeLLM({ prompt });
      setManagementPlan(response);
      toast.success("Management plan tidied up successfully!");
    } catch (error) {
      console.error("Error tidying plan:", error);
      toast.error("Failed to tidy management plan.");
    } finally {
      setIsTidyingPlan(false);
    }
  };

  // Builds the report HTML and the structured report-data object from the
  // current field values. Pure with respect to component state.
  const buildFinalReport = () => {
    const tableHTML = buildAssessmentTableHTML();
    const reportDate = format(new Date(), 'dd/MM/yyyy');

    // Use selectedLocation for clinic details in the report
    const clinicianDetailsForReport = selectedLocation ? { ...clinician, ...selectedLocation } : clinician;

    let reportHtml = `
<h2>DVA Client Details</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 2em;">
<tbody>
<tr>
<td style="border: 1px solid #000; padding: 8px; width: 40%; background-color: #f8f9fa; font-weight: bold;">Name</td>
<td style="border: 1px solid #000; padding: 8px; width: 60%;">${client.full_name}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">DVA File Number</td>
<td style="border: 1px solid #000; padding: 8px;">${client.dva_file_number || client.dva_card_number || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Date of Birth</td>
<td style="border: 1px solid #000; padding: 8px;">${client.date_of_birth ? format(new Date(client.date_of_birth), 'dd/MM/yyyy') : 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Phone</td>
<td style="border: 1px solid #000; padding: 8px;">${client.phone || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Referring Clinician</td>
<td style="border: 1px solid #000; padding: 8px;">${referringClinician || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Referral Date for This Cycle</td>
<td style="border: 1px solid #000; padding: 8px;">${referralDate ? format(new Date(referralDate), 'dd/MM/yyyy') : 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Previous Treatment</td>
<td style="border: 1px solid #000; padding: 8px;">${previousTreatment || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Has the client consented to this Patient Care Plan?</td>
<td style="border: 1px solid #000; padding: 8px;">${clientConsented ? 'Yes ☑' : 'No â˜'}</td>
</tr>
</tbody>
</table>

<h2>Condition(s) Being Managed/Reason(s) for Referral</h2>
<p>${clientData.conditions.map(c => c.condition_name).join(', ') || 'N/A'}</p>

<h2>Client Goals</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 2em;">
<tbody>
<tr>
<td style="border: 1px solid #000; padding: 8px; width: 40%; background-color: #f8f9fa; font-weight: bold;">Goals have been set and agreed to with the client:</td>
<td style="border: 1px solid #000; padding: 8px; width: 60%;">${goalsAgreed === 'yes' ? 'Yes ☑ No â˜' : 'Yes â˜ No ☑'}</td>
</tr>
<tr>
<td colspan="2" style="border: 1px solid #000; padding: 12px;">
${clientGoalsText ? clientGoalsText.split('\n').map(line => `<p style="margin: 0.5em 0;">${line}</p>`).join('') : '<p style="color: #666;">No goals specified</p>'}
</td>
</tr>
</tbody>
</table>

<h2>Assessment Results</h2>
${tableHTML}

<h2>Interpretation of Outcome Measures and Additional Comments</h2>
${interpretation.split('\n').map(para => `<p style="margin: 0.5em 0;">${para}</p>`).join('')}

<h2>Proposed Management Plan</h2>
${managementPlan.split('\n').map(para => `<p style="0.5em 0;">${para}</p>`).join('')}

<h2>Allied Health Provider Details</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 2em;">
<tbody>
<tr>
<td style="border: 1px solid #000; padding: 8px; width: 40%; background-color: #f8f9fa; font-weight: bold;">Name and Provider Number</td>
<td style="border: 1px solid #000; padding: 8px; width: 60%;">${clinicianDetailsForReport?.full_name || 'N/A'} - ${clinicianDetailsForReport?.provider_number || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Allied Health Profession</td>
<td style="border: 1px solid #000; padding: 8px;">${clinicianDetailsForReport?.profession || 'Exercise Physiologist'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Practice Name and Address</td>
<td style="border: 1px solid #000; padding: 8px;">${clinicianDetailsForReport?.clinic_name || 'N/A'}<br/>${clinicianDetailsForReport?.clinic_address || ''}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Phone</td>
<td style="border: 1px solid #000; padding: 8px;">${clinicianDetailsForReport?.clinic_phone || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Fax</td>
<td style="border: 1px solid #000; padding: 8px;">N/A</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Provider Signature</td>
<td style="border: 1px solid #000; padding: 8px; height: 60px; vertical-align: top;">
  ${clinicianSignature ? `<img src="${clinicianSignature}" alt="Clinician Signature" style="max-width: 200px; max-height: 60px;" />` : 'N/A - Signature not provided'}
</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Date</td>
<td style="border: 1px solid #000; padding: 8px;">${reportDate}</td>
</tr>
</tbody>
</table>
`;

    // Prepare data for saving
    const reportDetails = {
      client_id: client.id,
      selectedLocationId: selectedLocation?.id || null, // Save selected location ID
      referralDate,
      clientConsented,
      referringClinician,
      previousTreatment,
      clinicianSignature,
      selectedAssessmentIds,
      goalsAgreed,
      clientGoalsText,
      interpretation,
      managementPlan,
      clinician_id: clinician?.id,
      clinician_full_name: clinician?.full_name,
      clinician_provider_number: clinicianDetailsForReport?.provider_number, // Use location's provider number
      clinician_profession: clinician?.profession,
      clinician_clinic_name: clinicianDetailsForReport?.clinic_name, // Use location's clinic name
      clinician_clinic_address: clinicianDetailsForReport?.clinic_address, // Use location's clinic address
      clinician_clinic_phone: clinicianDetailsForReport?.clinic_phone, // Use location's clinic phone
      conditions: clientData.conditions.map(c => ({ id: c.id, name: c.condition_name })),
      selectedAssessments: clientData.assessments.filter(ca => selectedAssessmentIds.includes(ca.id)).map(ca => ({
        id: ca.id,
        assessment_id: ca.assessment_id,
        name: ca.name,
        assessment_date: ca.assessment_date,
        result_value: ca.result_value,
        unit_of_measure: ca.unit_of_measure,
        normative_comparison: ca.normative_comparison,
        notes: ca.notes,
        additional_data: ca.additional_data,
      })),
      html_content: reportHtml, // Store the generated HTML content for saving
    };

    return { reportHtml, reportDetails };
  };

  const handleGenerateFinalReport = async () => {
    const { reportHtml, reportDetails } = buildFinalReport();
    setFinalReport(reportHtml);
    setReportDetailsToSave(reportDetails);

    // Save goals to client record for use in End Cycle Report
    try {
      const pcpHistory = client.dva_pcp_history || [];
      // Prevent duplicate history entries if report is being regenerated/edited
      const isNewEntry = !editingReport || !pcpHistory.some(entry =>
        entry.goals === clientGoalsText && entry.goals_agreed === (goalsAgreed === 'yes')
      );

      if (isNewEntry) {
        pcpHistory.push({
          date: new Date().toISOString(),
          goals: clientGoalsText,
          goals_agreed: goalsAgreed === 'yes'
        });

        await Client.update(client.id, {
          dva_pcp_history: pcpHistory
        });
      }
    } catch (error) {
      console.error("Error saving goals to client:", error);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error("Report content is not ready for printing.");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');

    if (!printWindow) {
      toast.warning("Popup blocked. Using current window print...");
      const originalContent = document.body.innerHTML;
      document.body.innerHTML = printRef.current.outerHTML;
      window.print();
      document.body.innerHTML = originalContent;
      return;
    }

    try {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>DVA Patient Care Plan - ${client.full_name}</title>
          <meta charset="utf-8">
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
        </html>
      `);

      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Failed to open print dialog.");
      if (printWindow) printWindow.close();
    }
  };

  const handleSaveReport = async () => {
    if (!finalReport && (!reportDetailsToSave || Object.keys(reportDetailsToSave).length === 0)) {
      toast.error("Report content or details are missing. Please generate the report first.");
      return;
    }

    let dataToSave;
    let htmlContentToSave;

    if (isEditing) {
      // Rebuild the report from the current field values so edits are reflected
      const { reportHtml, reportDetails } = buildFinalReport();
      setFinalReport(reportHtml);
      setReportDetailsToSave(reportDetails);
      dataToSave = reportDetails;
      htmlContentToSave = reportHtml;
    } else {
      dataToSave = reportDetailsToSave;
      htmlContentToSave = printRef.current?.innerHTML || "";
    }

    setIsSaving(true);
    try {
      if (editingReport) {
        await ClientReport.update(editingReport.id, {
          org_id: client.org_id,
          client_id: client.id,
          report_type: "dva_patient_care_plan",
          report_name: `DVA Patient Care Plan - ${format(new Date(), 'dd/MM/yyyy')}`,
          report_date: new Date().toISOString().split('T')[0],
          report_data: dataToSave,
          html_content: htmlContentToSave,
        });
        toast.success("Report updated successfully!");
      } else {
        await ClientReport.create({
          org_id: client.org_id,
          client_id: client.id,
          report_type: "dva_patient_care_plan",
          report_name: `DVA Patient Care Plan - ${format(new Date(), 'dd/MM/yyyy')}`,
          report_date: new Date().toISOString().split('T')[0],
          report_data: dataToSave,
          html_content: htmlContentToSave,
        });
        toast.success("Report saved to client file successfully!");
      }
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Failed to save report.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 0) { // Step 0: Select Location
      if (!selectedLocation) {
        toast.error("Please select a location for the report.");
        return;
      }
    } else if (currentStep === 1) { // Step 1: DVA Details & Signature
      if (!clientConsented || !clinicianSignature || !referralDate) {
        toast.error("Please ensure all required DVA details are filled and signature is provided.");
        return;
      }
    } else if (currentStep === 2) { // Step 2: Select Assessments
      if (selectedAssessmentIds.length === 0) {
        toast.error("Please select at least one assessment to include.");
        return;
      }
    } else if (currentStep === 3) { // Step 3: Client Goals
      if (!goalsAgreed) {
        toast.error("Please indicate if goals have been agreed to with the client.");
        return;
      }
    } else if (currentStep === 4) { // Step 4: Interpretation
      if (!interpretation.trim()) {
        toast.error("Please provide an interpretation before proceeding.");
        return;
      }
    } else if (currentStep === 5) { // Step 5: Management Plan
      if (!managementPlan.trim()) {
        toast.error("Please provide a management plan before proceeding.");
        return;
      }
      handleGenerateFinalReport(); // Generate report before moving to review
    }
    setCurrentStep(currentStep + 1);
  };

  const handlePreviousStep = () => {
    setCurrentStep(currentStep - 1);
  };


  return (
    <>
      <Toaster position="top-center" richColors />

      {/* Hidden printable version */}
      <div className="hidden">
        {finalReport && clinician && (
          <PrintableReport
            ref={printRef}
            reportContent={finalReport}
            client={client}
            clinician={selectedLocation ? { ...clinician, ...selectedLocation } : clinician} // Pass merged clinician/location data
          />
        )}
      </div>

      <div className="bg-white rounded-lg w-full mx-auto">
        {/* Progress indicator */}
        <div className="p-4 border-b">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">
                Step {currentStep + 1} of {stepTitles.length}: {stepTitles[currentStep]}
              </span>
              <span className="text-sm text-slate-500">
                {Math.round(((currentStep + 1) / stepTitles.length) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / stepTitles.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">Loading client data...</p>
          </div>
        ) : (
          <div className="p-6 min-h-[500px]">
            {/* Step 0: Select Location */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-slate-900">Select Clinic Location for Report</h3>

                {locations.length === 0 ? (
                  <p className="text-slate-600">No locations configured. Please add locations in your profile settings.</p>
                ) : (
                  <div className="space-y-3">
                    {locations.map((location) => (
                      <div
                        key={location.id}
                        onClick={() => setSelectedLocation(location)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedLocation?.id === location.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-semibold text-slate-900">{location.clinic_name}</h5>
                              {location.is_main && (
                                <Badge variant="secondary" className="text-xs">Main</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{location.clinic_address}</p>
                            <p className="text-sm text-slate-600">Provider: {location.provider_number || 'N/A'}</p>
                          </div>
                          {selectedLocation?.id === location.id && (
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleNextStep}
                    disabled={!selectedLocation}
                  >
                    Next: DVA Details
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: DVA-specific details (formerly Step 0) */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-slate-900">DVA Client & Provider Details</h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Client Name</Label>
                    <Input value={client.full_name} disabled className="mt-1 bg-slate-50" />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">DVA File Number</Label>
                    <Input
                      value={client.dva_file_number || client.dva_card_number || ''}
                      disabled
                      className="mt-1 bg-slate-50"
                      placeholder="Set in client profile"
                    />
                  </div>

                  <div>
                    <Label htmlFor="referralDate" className="text-sm font-medium text-slate-700">
                      Referral Date for This Cycle *
                    </Label>
                    <Input
                      id="referralDate"
                      type="date"
                      value={referralDate}
                      onChange={(e) => setReferralDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="referringClinician" className="text-sm font-medium text-slate-700">
                      Referring Clinician
                    </Label>
                    <Input
                      id="referringClinician"
                      value={referringClinician}
                      onChange={(e) => setReferringClinician(e.target.value)}
                      placeholder="e.g., Dr. Smith"
                      className="mt-1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="previousTreatment" className="text-sm font-medium text-slate-700">
                      Previous Treatment
                    </Label>
                    <Textarea
                      id="previousTreatment"
                      value={previousTreatment}
                      onChange={(e) => setPreviousTreatment(e.target.value)}
                      placeholder="Describe any previous treatment the client has received..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Checkbox
                    id="consent"
                    checked={clientConsented}
                    onCheckedChange={setClientConsented}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="consent" className="font-semibold text-slate-900 cursor-pointer">
                      Has the client consented to this Patient Care Plan? *
                    </Label>
                    <p className="text-sm text-slate-600 mt-1">
                      The client must provide informed consent before proceeding with this care plan.
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-slate-50">
                  <Label className="text-sm font-medium text-slate-700 mb-3 block">
                    Provider Signature *
                  </Label>
                  {clinicianSignature ? (
                    <div className="space-y-3">
                      <div className="border rounded bg-white p-4 flex justify-center">
                        <img src={clinicianSignature} alt="Clinician Signature" className="max-h-24 max-w-full h-auto" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearSignature}
                      >
                        Clear Signature
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="border rounded bg-white overflow-hidden">
                        <canvas
                          ref={canvasRef}
                          width={400}
                          height={150}
                          className="cursor-crosshair w-full"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          style={{ touchAction: 'none' }}
                        />
                      </div>
                      <p className="text-xs text-slate-500">Sign above with your mouse or touchscreen</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearSignature}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={handlePreviousStep}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNextStep}
                    disabled={!clientConsented || !clinicianSignature || !referralDate}
                  >
                    Next: Select Assessments
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Assessment Selection (formerly Step 1) */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">Select Assessments to Include</h3>
                  <Button
                    onClick={handleSelectAllAssessments}
                    variant="outline"
                    size="sm"
                  >
                    {selectedAssessmentIds.length === clientData.assessments.length && clientData.assessments.length > 0 ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                {clientData.assessments.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {clientData.assessments.map(assessment => (
                      <div key={assessment.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <Checkbox
                          id={`assessment-${assessment.id}`}
                          checked={selectedAssessmentIds.includes(assessment.id)}
                          onCheckedChange={() => handleAssessmentToggle(assessment.id)}
                        />
                        <div className="grid gap-1.5 leading-none flex-1">
                          <Label htmlFor={`assessment-${assessment.id}`} className="font-semibold text-slate-800 cursor-pointer">
                            {assessment.name}
                          </Label>
                          <div className="text-sm text-slate-600">
                            <p><strong>Date:</strong> {new Date(assessment.assessment_date).toLocaleDateString('en-AU')}</p>
                            <p><strong>Result:</strong> {assessment.result_value} {assessment.unit_of_measure}</p>
                            {assessment.normative_comparison && (
                              <p><strong>Comparison:</strong> {assessment.normative_comparison.replace(/_/g, ' ')}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">No completed assessments found for this client.</p>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={handlePreviousStep}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNextStep}
                    disabled={selectedAssessmentIds.length === 0}
                  >
                    Next: Client Goals
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Client Goals (formerly Step 2) */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Client Goals</h3>
                  <p className="text-sm text-slate-600">Set and agree on treatment goals with the client</p>
                </div>

                {client.client_goals && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-1">Goals from Client Onboarding:</h4>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap mb-3">{client.client_goals}</p>
                    <Button
                      type="button"
                      onClick={handleLoadOnboardingGoals}
                      variant="outline"
                      size="sm"
                      className="bg-white"
                    >
                      Load Onboarding Goals
                    </Button>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Have goals been set and agreed to with the client? *
                  </Label>
                  <RadioGroup value={goalsAgreed} onValueChange={setGoalsAgreed} className="flex gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="goals-yes" />
                      <Label htmlFor="goals-yes" className="cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="goals-no" />
                      <Label htmlFor="goals-no" className="cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="client_goals" className="text-sm font-medium text-slate-700">
                    Client Goals
                  </Label>
                  <p className="text-xs text-slate-500 mb-2">
                    Document the specific, measurable goals agreed upon with the client (use SMART goals where possible)
                  </p>
                  <Textarea
                    id="client_goals"
                    value={clientGoalsText}
                    onChange={(e) => setClientGoalsText(e.target.value)}
                    placeholder="e.g.,
• Return to playing tennis twice weekly without shoulder pain within 8 weeks
• Walk 2km continuously without rest breaks by end of treatment cycle
• Reduce lower back pain from 7/10 to 3/10 during daily activities"
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex justify-between pt-6">
                  <Button type="button" variant="outline" onClick={handlePreviousStep}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNextStep}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Interpretation (formerly Step 3) */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-slate-900">Interpretation of Outcome Measures</h3>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 max-h-60 overflow-y-auto">
                  <h4 className="font-semibold text-slate-800 mb-2">Assessment Results (for reference)</h4>
                  <div dangerouslySetInnerHTML={{ __html: buildAssessmentTableHTML() }} />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    Write your interpretation of the assessment results:
                  </Label>
                  <Textarea
                    value={interpretation}
                    onChange={(e) => setInterpretation(e.target.value)}
                    placeholder="Interpret the assessment results, discussing functional capacity, progress, and clinical significance..."
                    rows={12}
                  />
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={handleGenerateInterpretation}
                      disabled={isGeneratingInterpretation}
                      variant="outline"
                      size="sm"
                    >
                      {isGeneratingInterpretation ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                      ) : (
                        <><Wand2 className="w-4 h-4 mr-2" /> AI Generate</>
                      )}
                    </Button>
                    <Button
                      onClick={handleTidyInterpretation}
                      disabled={isTidyingInterpretation || !interpretation.trim()}
                      variant="outline"
                      size="sm"
                    >
                      {isTidyingInterpretation ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Tidying...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> AI Tidy Up</>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={handlePreviousStep}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNextStep}
                    disabled={!interpretation.trim()}
                  >
                    Next: Management Plan
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Management Plan (formerly Step 4) */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-slate-900">Proposed Management Plan</h3>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    Write the proposed management plan:
                  </Label>
                  <Textarea
                    value={managementPlan}
                    onChange={(e) => setManagementPlan(e.target.value)}
                    placeholder="Describe the treatment goals, exercise prescription, progression plan, and expected outcomes..."
                    rows={12}
                  />
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={handleGeneratePlan}
                      disabled={isGeneratingPlan}
                      variant="outline"
                      size="sm"
                    >
                      {isGeneratingPlan ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                      ) : (
                        <><Wand2 className="w-4 h-4 mr-2" /> AI Generate</>
                      )}
                    </Button>
                    <Button
                      onClick={handleTidyPlan}
                      disabled={isTidyingPlan || !managementPlan.trim()}
                      variant="outline"
                      size="sm"
                    >
                      {isTidyingPlan ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Tidying...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> AI Tidy Up</>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={handlePreviousStep}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNextStep}
                    disabled={!managementPlan.trim()}
                  >
                    Generate Report
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 6: Review & Print (formerly Step 5) */}
            {currentStep === 6 && finalReport && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">Review Report</h3>
                  <Button
                    onClick={() => {
                      if (isEditing) {
                        // Rebuild the report from the edited fields before returning to view mode
                        const { reportHtml, reportDetails } = buildFinalReport();
                        setFinalReport(reportHtml);
                        setReportDetailsToSave(reportDetails);
                      }
                      setIsEditing(!isEditing);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {isEditing ? 'View Mode' : 'Edit Mode'}
                  </Button>
                </div>

                {isEditing ? (
                  <div className="space-y-6 max-h-[65vh] overflow-y-auto px-1">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit_referring_clinician">Referring Clinician</Label>
                        <Input
                          id="edit_referring_clinician"
                          value={referringClinician}
                          onChange={(e) => setReferringClinician(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_referral_date">Referral Date for This Cycle</Label>
                        <Input
                          id="edit_referral_date"
                          type="date"
                          value={referralDate}
                          onChange={(e) => setReferralDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="edit_previous_treatment">Previous Treatment</Label>
                      <Textarea
                        id="edit_previous_treatment"
                        value={previousTreatment}
                        onChange={(e) => setPreviousTreatment(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="edit_client_consented"
                        checked={clientConsented}
                        onCheckedChange={(checked) => setClientConsented(checked === true)}
                      />
                      <Label htmlFor="edit_client_consented">Client has consented to this Patient Care Plan</Label>
                    </div>

                    <div>
                      <Label>Goals have been set and agreed to with the client</Label>
                      <RadioGroup
                        value={goalsAgreed}
                        onValueChange={setGoalsAgreed}
                        className="flex gap-6 mt-2"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="yes" id="edit_goals_agreed_yes" />
                          <Label htmlFor="edit_goals_agreed_yes">Yes</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="no" id="edit_goals_agreed_no" />
                          <Label htmlFor="edit_goals_agreed_no">No</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div>
                      <Label htmlFor="edit_client_goals">Client Goals (one per line)</Label>
                      <Textarea
                        id="edit_client_goals"
                        value={clientGoalsText}
                        onChange={(e) => setClientGoalsText(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit_interpretation">Interpretation of Outcome Measures and Additional Comments</Label>
                      <Textarea
                        id="edit_interpretation"
                        value={interpretation}
                        onChange={(e) => setInterpretation(e.target.value)}
                        rows={8}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit_management_plan">Proposed Management Plan</Label>
                      <Textarea
                        id="edit_management_plan"
                        value={managementPlan}
                        onChange={(e) => setManagementPlan(e.target.value)}
                        rows={8}
                      />
                    </div>

                    <p className="text-xs text-slate-500">
                      Assessment selections and the signature are edited on their own steps — use Back to reach them.
                      The report is rebuilt from these fields when you return to View Mode or save.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border-2 border-slate-200 rounded-lg p-8 shadow-lg max-h-[70vh] overflow-y-auto">
                    <div className="prose max-w-none">
                      <PrintableReport
                        reportContent={finalReport}
                        client={client}
                        clinician={selectedLocation ? { ...clinician, ...selectedLocation } : clinician} // Pass merged clinician/location data
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={handlePreviousStep}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back to Edit
                  </Button>
                  <div className="flex gap-3">
                    {!editingReport && (
                      <Button
                        onClick={async () => {
                          await handleGenerateFinalReport();
                          // No need to change step, already on step 6, just regenerate content
                        }}
                        variant="outline"
                      >
                        Regenerate
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveReport}
                      disabled={isSaving}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isSaving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" /> {editingReport ? 'Update Report' : 'Save to Client File'}</>
                      )}
                    </Button>
                    <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700">
                      <Printer className="w-4 h-4 mr-2" />
                      Print / Save as PDF
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}