import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClientCondition, ClientAssessment, Assessment, User } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import { Printer, Loader2, ChevronLeft, ChevronRight, X, Wand2, Save, Edit } from "lucide-react"; // Added Edit icon
import { Toaster, toast } from "sonner";
import { format } from 'date-fns';
import { ClientReport } from "@/entities/ClientReport";

const PrintableReport = React.forwardRef(({ letterData, client, clinician }, ref) => {
  if (!letterData || !client || !clinician) {
    return <div className="text-center text-gray-500">Loading report data...</div>;
  }
  return (
    <div ref={ref} className="printable-report">
      <style>{`
        @media print {
          @page { size: A4; margin: 2.5cm; }
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .printable-report { 
            width: 100%; 
            font-family: 'Times New Roman', Times, serif; 
            font-size: 11pt; 
            line-height: 1.6; 
            color: #000 !important; 
            background: white; 
          }
          .clinic-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 2em; 
            padding-bottom: 1em; 
            border-bottom: 2px solid #000; 
          }
          .clinic-header img { 
            max-width: 150px; 
            max-height: 75px; 
          }
          .clinic-details { 
            text-align: right; 
            font-size: 10pt; 
            color: #000 !important;
          }
          .letter-header { 
            margin-bottom: 2em;
          }
          .gp-address {
            margin-bottom: 2em;
            color: #000 !important;
          }
          .letter-date {
            margin-bottom: 2em;
            color: #000 !important;
          }
          .letter-salutation {
            margin-bottom: 1em;
            color: #000 !important;
          }
          .letter-subject {
            font-weight: bold;
            margin-bottom: 1.5em;
            color: #000 !important;
          }
          .letter-body p {
            margin: 1em 0;
            color: #000 !important;
          }
          .section-heading {
            font-weight: bold;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            color: #000 !important;
          }
          .letter-closing {
            margin-top: 2em;
            color: #000 !important;
          }
          .clinician-signature {
            margin-top: 2em;
            color: #000 !important;
          }
        }
      `}</style>

      <div className="clinic-header">
        {clinician?.clinic_logo_url ? (
          <img src={clinician.clinic_logo_url} alt="Clinic Logo" />
        ) : (
          <h2 style={{ margin: 0, color: '#000' }}>{clinician?.clinic_name || ""}</h2>
        )}
        <div className="clinic-details">
          <strong>{clinician?.clinic_name || ""}</strong><br />
          {clinician?.clinic_address || ""}<br />
          {clinician?.clinic_phone || ""} | {clinician?.clinic_email || ""}
        </div>
      </div>

      <div className="letter-header">
        <div className="gp-address">
          {letterData.gp_name}<br />
          {letterData.gp_clinic_name}<br />
          {letterData.gp_address}
        </div>

        <div className="letter-date">
          {letterData.letter_date ? format(new Date(letterData.letter_date), 'dd/MM/yyyy') : ''}
        </div>

        <div className="letter-salutation">
          Dear {letterData.gp_name},
        </div>

        <div className="letter-subject">
          RE: Treatment Report for {client.full_name} (DOB: {client.date_of_birth ? format(new Date(client.date_of_birth), 'dd/MM/yyyy') : 'Not specified'})
        </div>
      </div>

      <div className="letter-body">
        <p>
          Referral Type: {letterData.referral_type}<br />
          Referral Date: {letterData.referral_date ? format(new Date(letterData.referral_date), 'dd/MM/yyyy') : ''}
        </p>

        <p>
          Thank you for your referral of {client.full_name}. I have now finished the Initial Assessment with {client.full_name}, and have provided a summary below
        </p>

        <div className="section-heading">Clinical Summary</div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{letterData.clinical_summary}</div>

        <div className="section-heading">Management Plan</div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{letterData.management_plan}</div>

        <p>
          Feel free to contact me on {clinician?.clinic_phone || '[phone]'} or via email if you have any questions.
        </p>

        <div className="letter-closing">
          Healthy Regards,
        </div>

        <div className="clinician-signature">
          <strong>{clinician?.clinician_name || clinician?.full_name}</strong><br />
          Accredited Exercise Physiologist (AEP), ESSAM<br />
          Provider Number: {clinician?.provider_number || '[Provider Number]'}
        </div>
      </div>
    </div>
  );
});

export default function GPSummary({ client, onClose, editingReport }) { // Added editingReport prop
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [clinician, setClinician] = useState(null);
  const [clientData, setClientData] = useState({ conditions: [], assessments: [] });
  // Replaced original isGenerating and added new states
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isTidyingSummary, setIsTidyingSummary] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isTidyingPlan, setIsTidyingPlan] = useState(false);

  // Added new states for edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  const [letterData, setLetterData] = useState({
    gp_name: client.primary_gp_name || "",
    gp_clinic_name: client.primary_gp_clinic_name || "",
    gp_address: client.primary_gp_address || "",
    letter_date: new Date().toISOString().split('T')[0],
    referral_type: client.medicare_referral_type || "Private (GPCMP Exhausted)",
    referral_date: client.referral_date || new Date().toISOString().split('T')[0],
    clinical_summary: "",
    management_plan: ""
  });

  const printRef = useRef(null);

  const stepTitles = [
    "GP & Referral Details",
    "Clinical Summary",
    "Management Plan",
    "Review & Print" 
  ];

  useEffect(() => {
    loadInitialData();
    if (editingReport) {
      setLetterData(editingReport.report_data);
      setEditableContent(JSON.stringify(editingReport.report_data, null, 2));
      setCurrentStep(3); // Start at review step if editing an existing report
    }
  }, [editingReport]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [currentClinician, conditions, clientAssessments, allAssessments] = await Promise.all([
        User.me(),
        ClientCondition.filter({ client_id: client.id }),
        ClientAssessment.filter({ client_id: client.id, status: "completed" }),
        Assessment.list()
      ]);

      setClinician(currentClinician);

      const assessmentMap = new Map(allAssessments.map(a => [a.id, a]));
      const enrichedAssessments = clientAssessments.map(ca => ({
        ...ca,
        name: assessmentMap.get(ca.assessment_id)?.name || 'Unknown Assessment',
        unit_of_measure: assessmentMap.get(ca.assessment_id)?.unit_of_measure || ''
      }));

      setClientData({ conditions, assessments: enrichedAssessments });
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load clinician data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (!letterData.gp_name || !letterData.gp_clinic_name || !letterData.referral_date) {
        toast.error("Please fill in all required GP and referral details");
        return;
      }
    }
    if (currentStep === 1 && !letterData.clinical_summary.trim()) {
      toast.error("Please provide a clinical summary");
      return;
    }
    if (currentStep === 2 && !letterData.management_plan.trim()) {
      toast.error("Please provide a management plan");
      return;
    }
    
    // When moving from step 2 to step 3 (review), initialize editableContent
    if (currentStep === 2) {
      setEditableContent(JSON.stringify(letterData, null, 2));
      setIsEditing(false); // Default to view mode when entering step 3
    }

    if (currentStep < stepTitles.length - 1) { 
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleChange = (field, value) => {
    setLetterData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
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

      const prompt = `You are an expert Australian Exercise Physiologist writing a concise clinical summary for a GP.

Client: ${client.full_name} (DOB: ${client.date_of_birth ? format(new Date(client.date_of_birth), 'dd/MM/yyyy') : 'Not specified'})

Medical Conditions:
${clientData.conditions.map(c => `- ${c.condition_name}${c.medication ? ` (Medication: ${c.medication})` : ''}`).join('\n')}

Completed Assessments:
${clientData.assessments.map(a => `- ${a.name}: ${a.result_value} ${a.unit_of_measure || ''}${a.notes ? ` (${a.notes})` : ''}`).join('\n')}

Client Goals:
${client.client_goals || 'Not specified'}${soapContext}

Write a concise clinical summary paragraph (150-200 words) that:
1. Describes the client's presenting conditions and comorbidities
2. Summarizes key assessment findings (functional capacity, pain levels, ROM, strength, etc.)
3. Notes any barriers to rehabilitation and progress from recent sessions
4. Uses professional medical terminology suitable for a GP

Format as a single flowing paragraph without bullet points.`;

      const summary = await InvokeLLM({ prompt });
      handleChange('clinical_summary', summary);
      toast.success("Clinical summary generated successfully!");
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate clinical summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleTidySummary = async () => {
    if (!letterData.clinical_summary.trim()) {
      toast.error("Please write something first before tidying up.");
      return;
    }
    
    setIsTidyingSummary(true);
    try {
      const prompt = `You are an expert Exercise Physiologist. Take the following clinical summary text and make it more professional, concise, and clinically appropriate for a GP Summary letter.

IMPORTANT: Return ONLY plain text paragraphs. Do NOT use any HTML tags, markdown, or formatting codes. Write in complete sentences and paragraphs.

Original text:
${letterData.clinical_summary}

Return only the improved plain text version with proper paragraphs, no additional commentary, no HTML tags, no markdown.`;

      const response = await InvokeLLM({ prompt });
      handleChange('clinical_summary', response);
      toast.success("Clinical summary tidied up successfully!");
    } catch (error) {
      console.error("Error tidying summary:", error);
      toast.error("Failed to tidy summary.");
    } finally {
      setIsTidyingSummary(false);
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

      const prompt = `You are an expert Australian Exercise Physiologist. Based on the following client information and clinical summary, propose a concise management plan suitable for a GP referral letter.

Client: ${client.full_name} (DOB: ${client.date_of_birth ? format(new Date(client.date_of_birth), 'dd/MM/yyyy') : 'Not specified'})

Medical Conditions:
${clientData.conditions.map(c => `- ${c.condition_name}${c.medication ? ` (Medication: ${c.medication})` : ''}`).join('\n')}

Completed Assessments:
${clientData.assessments.map(a => `- ${a.name}: ${a.result_value} ${a.unit_of_measure || ''}${a.notes ? ` (${a.notes})` : ''}`).join('\n')}

Client Goals:
${client.client_goals || 'Not specified'}

Clinical Summary (provided separately, for context):
${letterData.clinical_summary}${soapContext}

Write a concise management plan paragraph (100-150 words) that outlines:
1.  Overall goals of the exercise physiology intervention.
2.  Key components of the proposed program (e.g., type of exercise, frequency).
3.  Expected outcomes or benefits based on recent progress.
4.  Mention that a full assessment and detailed management plan can be provided upon request or is attached.

Format as a single flowing paragraph without bullet points, suitable for a professional letter.`;

      const plan = await InvokeLLM({ prompt });
      handleChange('management_plan', plan);
      toast.success("Management plan generated successfully!");
    } catch (error) {
      console.error("Error generating plan:", error);
      toast.error("Failed to generate management plan.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleTidyPlan = async () => {
    if (!letterData.management_plan.trim()) {
      toast.error("Please write something first before tidying up.");
      return;
    }
    
    setIsTidyingPlan(true);
    try {
      const prompt = `You are an expert Exercise Physiologist. Take the following management plan text and make it more professional, structured, and clinically appropriate for a GP Summary letter.

IMPORTANT: Return ONLY plain text with proper paragraphs and structure. Do NOT use any HTML tags, markdown, or formatting codes. You can use natural text formatting like numbered lists (1. 2. 3.) or bullet points with dashes (-) but NO HTML or markdown syntax.

Original text:
${letterData.management_plan}

Return only the improved plain text version with clear structure, no additional commentary, no HTML tags, no markdown.`;

      const response = await InvokeLLM({ prompt });
      handleChange('management_plan', response);
      toast.success("Management plan tidied up successfully!");
    } catch (error) {
      console.error("Error tidying plan:", error);
      toast.error("Failed to tidy management plan.");
    } finally {
      setIsTidyingPlan(false);
    }
  };

  const handleToggleEditMode = () => {
    if (isEditing) { // Currently in edit mode, switching to view mode
      try {
        const parsedData = JSON.parse(editableContent);
        setLetterData(parsedData); // Update letterData from edited JSON
        setIsEditing(false);
      } catch (e) {
        toast.error("Invalid JSON format. Please correct it before switching to view mode.");
        console.error("JSON parsing error:", e);
      }
    } else { // Currently in view mode, switching to edit mode
      setEditableContent(JSON.stringify(letterData, null, 2)); // Populate with current letterData
      setIsEditing(true);
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
      window.location.reload();
      return;
    }

    try {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>GP Summary - ${client.full_name}</title>
          <meta charset="utf-8">
        </head>
        <body>
          ${printRef.current.outerHTML}
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
      toast.error("Failed to open print dialog. Please try again.");
      if (printWindow) printWindow.close();
    }
  };

  const handleSaveReport = async () => {
    setIsSaving(true);
    try {
      let dataToSave = letterData; // Default to current letterData
      if (isEditing) {
        try {
          dataToSave = JSON.parse(editableContent);
        } catch (e) {
          toast.error("Invalid JSON format in editable content. Please correct before saving.");
          setIsSaving(false);
          return;
        }
      }
      
      if (editingReport) {
        await ClientReport.update(editingReport.id, {
          org_id: client.org_id,
          client_id: client.id,
          report_type: "gp_summary",
          report_name: `GP Treatment Summary - ${format(new Date(), 'dd/MM/yyyy')}`,
          report_date: new Date().toISOString().split('T')[0],
          report_data: dataToSave,
          html_content: printRef.current?.outerHTML || ""
        });
        toast.success("Report updated successfully!");
      } else {
        await ClientReport.create({
          org_id: client.org_id,
          client_id: client.id,
          report_type: "gp_summary",
          report_name: `GP Treatment Summary - ${format(new Date(), 'dd/MM/yyyy')}`,
          report_date: new Date().toISOString().split('T')[0],
          report_data: dataToSave,
          html_content: printRef.current?.outerHTML || ""
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="hidden">
        {/* The hidden PrintableReport for the printRef */}
        {currentStep === 3 && clinician && ( 
          <PrintableReport 
            ref={printRef} 
            letterData={isEditing && editableContent ? (() => {
              try {
                const parsed = JSON.parse(editableContent);
                if (typeof parsed === 'object' && parsed !== null) {
                  return parsed;
                }
              } catch (e) {
                console.warn("Invalid JSON in editableContent for print preview (silent fallback):", e);
              }
              return letterData; // Fallback to current letterData if invalid or parsing fails
            })() : letterData}
            client={client}
            clinician={clinician}
          />
        )}
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">GP Summary</h3>
            <p className="text-sm text-slate-600">{stepTitles[currentStep]}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">
              Step {currentStep + 1} of {stepTitles.length}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / stepTitles.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 0: GP & Referral Details */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">GP Details</h4>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">GP Name *</Label>
                  <Input
                    value={letterData.gp_name}
                    onChange={(e) => handleChange('gp_name', e.target.value)}
                    placeholder="e.g., Dr. Ben Tay"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">GP Clinic Name *</Label>
                  <Input
                    value={letterData.gp_clinic_name}
                    onChange={(e) => handleChange('gp_clinic_name', e.target.value)}
                    placeholder="e.g., Nambour Medical Centre"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">GP Address *</Label>
                <Textarea
                  value={letterData.gp_address}
                  onChange={(e) => handleChange('gp_address', e.target.value)}
                  placeholder="e.g., 14 Daniel St, Nambour QLD 4560"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">Referral Information</h4>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Letter Date</Label>
                  <Input
                    type="date"
                    value={letterData.letter_date}
                    onChange={(e) => handleChange('letter_date', e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Referral Date *</Label>
                  <Input
                    type="date"
                    value={letterData.referral_date}
                    onChange={(e) => handleChange('referral_date', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Referral Type</Label>
                <Input
                  value={letterData.referral_type}
                  onChange={(e) => handleChange('referral_type', e.target.value)}
                  placeholder="e.g., Private (GPCMP Exhausted)"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Clinical Summary */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-900">Clinical Summary</h3>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Provide a concise clinical summary of the initial assessment findings. Include key points about the client's conditions, assessment results, functional capacity, and any barriers to rehabilitation.
              </p>

              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">
                  Clinical Summary:
                </Label>
                <Textarea
                  value={letterData.clinical_summary}
                  onChange={(e) => handleChange('clinical_summary', e.target.value)}
                  placeholder="e.g., Patricia presents with newly diagnosed T2DM in the context of multiple comorbidities including rheumatoid arthritis, cardiovascular disease (moderate aortic regurgitation, non-obstructive CAD), iron deficiency, and obesity..."
                  className="mt-1"
                  rows={12}
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isGeneratingSummary ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        AI Generate Summary
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleTidySummary}
                    disabled={isTidyingSummary || !letterData.clinical_summary.trim()}
                    variant="outline"
                    size="sm"
                  >
                    {isTidyingSummary ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Tidying...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        AI Tidy Up
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-6">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Management Plan */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-900">Management Plan</h3>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Outline the management plan including goals, treatment approach, frequency, and expected outcomes. You can also note that a full assessment with detailed management plan is attached.
              </p>

              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">
                  Ongoing Management Plan:
                </Label>
                <Textarea
                  value={letterData.management_plan}
                  onChange={(e) => handleChange('management_plan', e.target.value)}
                  placeholder="e.g., The overall plan is to improve glycaemic control, strength, balance, and functional mobility while supporting safe, sustainable self-management. (Full assessment including management plan has been attached to this summary for your reference)"
                  className="mt-1"
                  rows={8}
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={handleGeneratePlan}
                    disabled={isGeneratingPlan}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isGeneratingPlan ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        AI Generate Plan
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleTidyPlan}
                    disabled={isTidyingPlan || !letterData.management_plan.trim()}
                    variant="outline"
                    size="sm"
                  >
                    {isTidyingPlan ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Tidying...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        AI Tidy Up
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-6">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                Continue to Review
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Print - Now directly shows the formatted report */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Review Report</h3>
              <Button
                onClick={handleToggleEditMode}
                variant="outline"
                size="sm"
              >
                <Edit className="w-4 h-4 mr-2" />
                {isEditing ? 'View Mode' : 'Edit Mode'}
              </Button>
            </div>

            {/* Conditional Full Report Preview or Edit Area */}
            {isEditing ? (
              <div className="space-y-4">
                <Label className="text-sm font-medium text-slate-700">
                  Edit Report Data (JSON format):
                </Label>
                <Textarea
                  value={editableContent}
                  onChange={(e) => setEditableContent(e.target.value)}
                  rows={25}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-slate-500">
                  Tip: Edit the JSON data above to modify report content. Be careful to maintain valid JSON format.
                </p>
              </div>
            ) : (
              <div className="bg-white border-2 border-slate-200 rounded-lg p-8 shadow-lg max-h-[70vh] overflow-y-auto">
                <PrintableReport 
                  letterData={letterData}
                  client={client}
                  clinician={clinician}
                />
              </div>
            )}

            <div className="flex justify-between gap-3 pt-6">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Edit
              </Button>
              <div className="flex gap-3">
                {!editingReport && ( // Only show Regenerate if not editing an existing report
                  <Button onClick={() => setCurrentStep(0)} variant="outline">
                    Regenerate
                  </Button>
                )}
                <Button
                  onClick={handleSaveReport}
                  disabled={isSaving}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingReport ? 'Update Report' : 'Save to Client File'}
                    </>
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
    </>
  );
}