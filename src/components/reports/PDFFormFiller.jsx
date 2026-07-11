
import React, { useState, useRef, useEffect } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { ClientCondition, ClientAssessment, Assessment, User, ClientReport } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import { FileDown, Printer, AlertCircle, Loader2, Save, Edit, Plus, Trash2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import { format } from 'date-fns';

// Import specialized components
import DVAPatientCarePlan from "./DVAPatientCarePlan";
import DVAEndCycleReport from "./DVAEndCycleReport";
import PrivateHealthInitialAssessment from "./PrivateHealthInitialAssessment";
import MedicareReferralAcceptance from "./MedicareReferralAcceptance";
import MedicareInitialLetter from "./MedicareInitialLetter";
import MedicareFinalLetter from "./MedicareFinalLetter";
import GPSummary from "./GPSummary";
import PrivateHealthProgressReport from "./PrivateHealthProgressReport"; // New import

const PrintableReport = React.forwardRef(({ reportContent, client, clinician, title, formType }, ref) => {
    const formatMultiline = (text) => {
        if (!text) return null;
        return text.split('\n').map((line, index) => (
            <React.Fragment key={index}>
                {line}
                <br />
            </React.Fragment>
        ));
    };

    if (formType === 'workcover_pmp' && reportContent) {
        return (
            <div ref={ref} className="printable-pmp">
                <style>{`
                    @media print {
                        @page { size: A4; margin: 1cm; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .printable-pmp { font-family: Arial, sans-serif; font-size: 9pt; line-height: 1.2; }
                        .pmp-table { border-collapse: collapse; width: 100%; }
                        .pmp-table td { border: 1px solid #000; padding: 4px; vertical-align: top; }
                        .pmp-header { font-size: 14pt; font-weight: bold; margin-bottom: 1em; }
                        .pmp-section-title { font-weight: bold; background-color: #e0e0e0 !important; padding: 4px; }
                        .pmp-checkbox { display: inline-block; width: 10px; height: 10px; border: 1px solid #000; margin-right: 5px; }
                        .pmp-field-label { font-weight: bold; }

                        /* Header styles for PMP as well */
                        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1em; padding-bottom: 0.5em; border-bottom: 1px solid #000; }
                        .header img { max-width: 100px; max-height: 50px; }
                        .clinic-details { text-align: right; font-size: 8pt; }
                    }
                `}</style>
                <div className="header">
                    {clinician?.clinic_logo_url ? (
                        <img src={clinician.clinic_logo_url} alt="Clinic Logo" />
                    ) : (
                        <h3 style={{fontSize: '10pt', margin: 0}}>{clinician?.clinic_name || ""}</h3>
                    )}
                    <div className="clinic-details">
                        <strong>{clinician?.clinic_name || ""}</strong>
                        <br />
                        {clinician?.clinic_address || ""}
                        <br />
                        {clinician?.clinic_phone || ""} | {clinician?.clinic_email || ""}
                    </div>
                </div>
                <div className="pmp-header">Form 032 Provider management plan</div>
                <table className="pmp-table">
                    <tbody>
                        <tr>
                            <td colSpan="2">
                                <div className="pmp-checkbox"></div> Exercise Physiologist
                            </td>
                        </tr>
                        <tr>
                            <td width="50%">
                                <div className="pmp-section-title">Worker's details</div>
                                <div><span className="pmp-field-label">Name:</span> {reportContent.worker_name}</div>
                                <div><span className="pmp-field-label">DOB:</span> {reportContent.worker_dob} &nbsp;&nbsp;&nbsp; <span className="pmp-field-label">DOI:</span> {reportContent.worker_doi}</div>
                                <div><span className="pmp-field-label">Diagnosis:</span> {reportContent.diagnosis}</div>
                                <div><span className="pmp-field-label">Claim number:</span> {reportContent.claim_number}</div>
                                <div><span className="pmp-field-label">Referring doctor:</span> {reportContent.referring_doctor}</div>
                                <div><span className="pmp-field-label">Worker's occupation:</span> {reportContent.worker_occupation}</div>
                            </td>
                            <td width="50%">
                                <div className="pmp-field-label">This is provider management plan no: 1</div>
                                <div><span className="pmp-field-label">Date of initial consultation for present injury:</span> {reportContent.initial_consult_date}</div>
                                <div><span className="pmp-field-label">Total consultations for this injury approved to date:</span> {reportContent.approved_consults}</div>
                                <div><span className="pmp-field-label">No. consultations required in this plan:</span> {reportContent.required_consults}</div>
                                <div className="pmp-field-label">Provider's contact details:</div>
                                <div>{clinician?.full_name}</div>
                                <div>{clinician?.clinic_name}</div>
                                <div>{clinician?.clinic_address}</div>
                                <div>Phone: {clinician?.clinic_phone}</div>
                            </td>
                        </tr>
                        <tr>
                            <td colSpan="2">
                                <div className="pmp-section-title">Treatment plan</div>
                                <div style={{ minHeight: '100px' }}>{formatMultiline(reportContent.treatment_plan)}</div>
                            </td>
                        </tr>
                        <tr>
                            <td colSpan="2">
                               <div className="pmp-section-title">Outcome measures used to assess and monitor worker's progress throughout treatment period</div>
                               <table className="pmp-table">
                                 <thead>
                                    <tr>
                                       <td><strong>Outcome measures</strong></td>
                                       <td><strong>Measures (at initial assessment)</strong></td>
                                       <td><strong>Current measures (at beginning of plan)</strong></td>
                                       <td><strong>Anticipated outcomes (at end of current plan)</strong></td>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {reportContent.outcome_measures?.map((om, i) => (
                                        <tr key={i}>
                                            <td>{om.measure_name}</td>
                                            <td>{om.initial_result}</td>
                                            <td>{om.current_result}</td>
                                            <td>{om.anticipated_outcome}</td>
                                        </tr>
                                    ))}
                                 </tbody>
                               </table>
                            </td>
                        </tr>
                         <tr>
                            <td colSpan="2">
                                <div className="pmp-section-title">Identified barriers to return to work and recommended strategies to overcome barriers</div>
                                <table className="pmp-table">
                                    <thead><tr><td><strong>Barriers</strong></td><td><strong>Recommended strategies</strong></td></tr></thead>
                                    <tbody>
                                    {reportContent.barriers?.map((b, i) => (
                                        <tr key={i}>
                                            <td width="50%">{b.barrier}</td>
                                            <td width="50%">{b.strategy}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </td>
                         </tr>
                     </tbody>
                 </table>
            </div>
        );
    }
    
    // Fallback for other reports
    return (
      <div ref={ref} className="printable-report">
        <style>{`
                @media print {
                    @page { size: A4; margin: 2cm; }
                    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .printable-report { width: 100%; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: black; background: white; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2em; padding-bottom: 1em; border-bottom: 2px solid #000; }
                    .header img { max-width: 150px; max-height: 75px; }
                    .clinic-details { text-align: right; font-size: 10pt; }
                    .report-title { text-align: center; font-size: 16pt; font-weight: bold; margin: 1em 0; }
                    .report-content h2 { color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin: 1.5em 0 1em; font-size: 14pt; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
                    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
                    th { background-color: #f1f5f9 !important; font-weight: 600; }
                }
            `}</style>

        <div className="header">
          {clinician?.clinic_logo_url ? (
            <img src={clinician.clinic_logo_url} alt="Clinic Logo" />
          ) : (
            <h2>{clinician?.clinic_name || ""}</h2>
          )}
          <div className="clinic-details">
            <strong>{clinician?.clinic_name || ""}</strong>
            <br />
            {clinician?.clinic_address || ""}
            <br />
            {clinician?.clinic_phone || ""} | {clinician?.clinic_email || ""}
          </div>
        </div>

        <div className="report-title">
          {title} for {client.full_name}
        </div>
        <div className="report-content" dangerouslySetInnerHTML={{ __html: reportContent }} />
      </div>
    );
});

// Component responsible for generating the WorkCover PMP (Form 32)
function Form32Generator({ client, onClose, editingReport }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const printRef = useRef(null);
  const [generatedContent, setGeneratedContent] = useState(editingReport ? editingReport.report_data : null);
  const [isEditing, setIsEditing] = useState(false);
  const [clinician, setClinician] = useState(null);
  const [clientData, setClientData] = useState({ conditions: [], assessments: [] });
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState([]);
  const [currentStep, setCurrentStep] = useState(editingReport ? 2 : 0); // 0: assessment selection, 1: generate, 2: edit/review

  useEffect(() => {
    const fetchInitialData = async () => {
        setIsDataLoading(true);
        try {
            const [userData, conditions, clientAssessmentsData, allAssessmentsData] = await Promise.all([
                User.me(),
                ClientCondition.filter({ client_id: client.id }),
                ClientAssessment.filter({ client_id: client.id, status: "completed" }),
                Assessment.list()
            ]);

            const assessmentMap = new Map(allAssessmentsData.map(a => [a.id, a]));
            const augmentedAssessments = clientAssessmentsData.map(ca => ({
                ...ca,
                name: assessmentMap.get(ca.assessment_id)?.name || 'Unknown Assessment',
                unit_of_measure: assessmentMap.get(ca.assessment_id)?.unit_of_measure || '',
                assessment_date: ca.assessment_date ? format(new Date(ca.assessment_date), 'dd/MM/yyyy') : 'N/A'
            }));

            setClinician(userData);
            setClientData({ conditions, assessments: augmentedAssessments });
            if (augmentedAssessments.length > 0 && !editingReport) { // Only select all if not editing a report
                setSelectedAssessmentIds(augmentedAssessments.map(a => a.id));
            }
        } catch(e) {
            toast.error("Could not load required data for the report.");
            setError("Could not load required data for the report.");
            console.error(e);
        } finally {
            setIsDataLoading(false);
        }
    }
    fetchInitialData();
  }, [client.id, editingReport]);

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
    }
  };

  const handleProceedToGenerate = () => {
    setCurrentStep(1);
  };

  const formTemplates = {
    workcover_pmp: { name: "WorkCover QLD Provider Management Plan (Form 32)" }
  };
  const template = formTemplates.workcover_pmp;


  const buildPmpPromptAndSchema = () => {
    // Filter to selected assessments only
    const selectedAssessments = clientData.assessments.filter(ca => selectedAssessmentIds.includes(ca.id));
    
    const prompt = `
You are an expert Australian Exercise Physiologist. Your task is to extract and format data to fill out a WorkCover QLD Provider Management Plan (Form 032).

Use the following client, clinician, and assessment data to populate the JSON object. Be concise and professional.

**Client Data:**
${JSON.stringify(client, null, 2)}

**Clinical Conditions:**
${JSON.stringify(clientData.conditions, null, 2)}

**Selected Assessment Results (ONLY use these assessments):**
${JSON.stringify(selectedAssessments, null, 2)}

**Clinician Data:**
${JSON.stringify(clinician, null, 2)}

Based on the data, populate the JSON schema below.
- For 'diagnosis', use the primary condition name from conditions.
- For 'treatment_plan', synthesize a plan based on goals, conditions, and assessment findings.
- For 'outcome_measures', list the completed assessments, their results, and a reasonable anticipated outcome.
- For 'barriers', identify potential barriers from the assessment notes or client goals.
- Use Australian date format DD/MM/YYYY for all dates.
- If data is not available, use "Not specified" or leave blank appropriately.
- Every string value must be plain text only — no HTML tags, no markdown, no code fences.
`;

    const schema = {
      type: "object",
      properties: {
        worker_name: { type: "string" },
        worker_dob: { type: "string", description: "Format as DD/MM/YYYY" },
        worker_doi: { type: "string", description: "Date of Injury, format as DD/MM/YYYY. Use workcover_date_of_injury if available." },
        diagnosis: { type: "string" },
        claim_number: { type: "string" },
        referring_doctor: { type: "string" },
        worker_occupation: { type: "string" },
        initial_consult_date: { type: "string", description: "Format as DD/MM/YYYY. Use today's date if not available." },
        approved_consults: { type: "string", description: "Number of consultations approved to date" },
        required_consults: { type: "string", description: "Number of consultations required in this plan" },
        treatment_plan: { type: "string", description: "Detailed treatment plan" },
        outcome_measures: {
          type: "array",
          items: {
            type: "object",
            properties: {
              measure_name: { type: "string" },
              initial_result: { type: "string" },
              current_result: { type: "string" },
              anticipated_outcome: { type: "string" }
            },
            required: ["measure_name", "initial_result", "current_result", "anticipated_outcome"]
          }
        },
        barriers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              barrier: { type: "string" },
              strategy: { type: "string" }
            },
            required: ["barrier", "strategy"]
          }
        }
      },
      required: ["worker_name", "worker_dob", "diagnosis", "treatment_plan"]
    };

    return { prompt, schema };
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const generateReport = async () => {
    if (!clinician) {
        toast.error("Clinician data not loaded yet. Please wait a moment.");
        return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const { prompt, schema } = buildPmpPromptAndSchema();
      const reportData = await InvokeLLM({ prompt, response_json_schema: schema });

      setGeneratedContent(typeof reportData === 'string' ? JSON.parse(reportData) : reportData);
      setCurrentStep(2); // Move to review step

    } catch (err) {
      console.error("Error generating report:", err);
      setError("Failed to generate the report. Please try again.");
      toast.error("An error occurred during report generation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveReport = async () => {
    setIsSaving(true);
    try {
      if (editingReport) {
        // Update existing report
        await ClientReport.update(editingReport.id, {
          report_data: generatedContent,
          html_content: printRef.current?.innerHTML || ""
        });
        toast.success("Report updated successfully!");
      } else {
        // Create new report
        await ClientReport.create({
          client_id: client.id,
          report_type: "workcover_pmp",
          report_name: `WorkCover Provider Management Plan - ${format(new Date(), 'dd/MM/yyyy')}`,
          report_date: todayLocal(),
          report_data: generatedContent,
          html_content: printRef.current?.innerHTML || ""
        });
        toast.success("Report saved to client file successfully!");
      }
    } catch (error) {
      console.error("Error saving/updating report:", error);
      toast.error("Failed to save/update report.");
    } finally {
      setIsSaving(false);
    }
  };

  // Structured-edit helpers: all edits are applied directly to the report-data
  // object so the saved shape is identical to the generated shape.
  const updateReportField = (field, value) => {
    setGeneratedContent(prev => ({ ...prev, [field]: value }));
  };

  const updateOutcomeMeasure = (index, field, value) => {
    setGeneratedContent(prev => ({
      ...prev,
      outcome_measures: (prev.outcome_measures || []).map((om, i) =>
        i === index ? { ...om, [field]: value } : om
      )
    }));
  };

  const addOutcomeMeasure = () => {
    setGeneratedContent(prev => ({
      ...prev,
      outcome_measures: [
        ...(prev.outcome_measures || []),
        { measure_name: "", initial_result: "", current_result: "", anticipated_outcome: "" }
      ]
    }));
  };

  const removeOutcomeMeasure = (index) => {
    setGeneratedContent(prev => ({
      ...prev,
      outcome_measures: (prev.outcome_measures || []).filter((_, i) => i !== index)
    }));
  };

  const updateBarrier = (index, field, value) => {
    setGeneratedContent(prev => ({
      ...prev,
      barriers: (prev.barriers || []).map((b, i) =>
        i === index ? { ...b, [field]: value } : b
      )
    }));
  };

  const addBarrier = () => {
    setGeneratedContent(prev => ({
      ...prev,
      barriers: [...(prev.barriers || []), { barrier: "", strategy: "" }]
    }));
  };

  const removeBarrier = (index) => {
    setGeneratedContent(prev => ({
      ...prev,
      barriers: (prev.barriers || []).filter((_, i) => i !== index)
    }));
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
                <title>${template.name} - ${client.full_name}</title>
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
        toast.error("Failed to open print dialog. Please try again.");
        if (printWindow) printWindow.close();
    }
  };
  
  if(isDataLoading) {
      return (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading client data...</p>
        </div>
      );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={handleClose} variant="outline">
          Close
        </Button>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="hidden">
        {generatedContent && clinician && (
          <PrintableReport
            ref={printRef}
            reportContent={generatedContent} // Pass object to PrintableReport
            client={client}
            clinician={clinician}
            title={template?.name || "Clinical Report"}
            formType={'workcover_pmp'} // Always workcover_pmp for this component
          />
        )}
      </div>

      <div className="space-y-6">
        {/* Step 0: Assessment Selection (Skipped if editing existing report) */}
        {currentStep === 0 && (
          <div className="space-y-6 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Select Assessments to Include</h3>
              <Button 
                onClick={handleSelectAllAssessments} 
                variant="outline" 
                size="sm"
              >
                {selectedAssessmentIds.length === clientData.assessments.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            {clientData.assessments.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto px-1 -mx-1">
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
                        <p><strong>Date:</strong> {assessment.assessment_date}</p>
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
            
            <div className="flex justify-end gap-3 mt-6">
              <Button onClick={handleClose} variant="outline">
                Cancel
              </Button>
              <Button 
                onClick={handleProceedToGenerate} 
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue with Selected ({selectedAssessmentIds.length})
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Generate (Skipped if editing existing report) */}
        {currentStep === 1 && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <FileDown className="w-8 h-8 text-blue-500" />
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{template.name}</h3>
                <p className="text-slate-600">for {client.full_name}</p>
                <p className="text-sm text-blue-600">
                  {selectedAssessmentIds.length} of {clientData.assessments.length} assessment(s) selected
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-slate-700">
                Ready to generate your {template.name.toLowerCase()}. This will pull data from the client's profile and create a structured report.
              </p>
              
              <div className="flex justify-center gap-4">
                <Button onClick={() => setCurrentStep(0)} variant="outline">
                  Change Assessments
                </Button>
                <Button
                  onClick={generateReport}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-3"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review/Edit */}
        {currentStep === 2 && generatedContent && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Review & Edit Report</h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsEditing(!isEditing)}
                  variant="outline"
                  size="sm"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {isEditing ? 'View Mode' : 'Edit Mode'}
                </Button>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-6 max-h-[65vh] overflow-y-auto px-1">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pmp_worker_name">Worker Name</Label>
                    <Input
                      id="pmp_worker_name"
                      value={generatedContent.worker_name || ""}
                      onChange={(e) => updateReportField('worker_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pmp_worker_dob">Date of Birth (DD/MM/YYYY)</Label>
                    <Input
                      id="pmp_worker_dob"
                      value={generatedContent.worker_dob || ""}
                      onChange={(e) => updateReportField('worker_dob', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pmp_worker_doi">Date of Injury (DD/MM/YYYY)</Label>
                    <Input
                      id="pmp_worker_doi"
                      value={generatedContent.worker_doi || ""}
                      onChange={(e) => updateReportField('worker_doi', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pmp_claim_number">Claim Number</Label>
                    <Input
                      id="pmp_claim_number"
                      value={generatedContent.claim_number || ""}
                      onChange={(e) => updateReportField('claim_number', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pmp_referring_doctor">Referring Doctor</Label>
                    <Input
                      id="pmp_referring_doctor"
                      value={generatedContent.referring_doctor || ""}
                      onChange={(e) => updateReportField('referring_doctor', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pmp_worker_occupation">Worker Occupation</Label>
                    <Input
                      id="pmp_worker_occupation"
                      value={generatedContent.worker_occupation || ""}
                      onChange={(e) => updateReportField('worker_occupation', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pmp_initial_consult_date">Initial Consultation Date (DD/MM/YYYY)</Label>
                    <Input
                      id="pmp_initial_consult_date"
                      value={generatedContent.initial_consult_date || ""}
                      onChange={(e) => updateReportField('initial_consult_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pmp_approved_consults">Consultations Approved to Date</Label>
                    <Input
                      id="pmp_approved_consults"
                      value={generatedContent.approved_consults || ""}
                      onChange={(e) => updateReportField('approved_consults', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pmp_required_consults">Consultations Required in This Plan</Label>
                    <Input
                      id="pmp_required_consults"
                      value={generatedContent.required_consults || ""}
                      onChange={(e) => updateReportField('required_consults', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="pmp_diagnosis">Diagnosis</Label>
                  <Textarea
                    id="pmp_diagnosis"
                    value={generatedContent.diagnosis || ""}
                    onChange={(e) => updateReportField('diagnosis', e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="pmp_treatment_plan">Treatment Plan</Label>
                  <Textarea
                    id="pmp_treatment_plan"
                    value={generatedContent.treatment_plan || ""}
                    onChange={(e) => updateReportField('treatment_plan', e.target.value)}
                    rows={8}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Outcome Measures</Label>
                    <Button onClick={addOutcomeMeasure} variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Add Measure
                    </Button>
                  </div>
                  {(generatedContent.outcome_measures || []).map((om, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Input
                          value={om.measure_name || ""}
                          onChange={(e) => updateOutcomeMeasure(index, 'measure_name', e.target.value)}
                          placeholder="Outcome measure"
                        />
                        <Button
                          onClick={() => removeOutcomeMeasure(index)}
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid md:grid-cols-3 gap-2">
                        <Input
                          value={om.initial_result || ""}
                          onChange={(e) => updateOutcomeMeasure(index, 'initial_result', e.target.value)}
                          placeholder="Initial result"
                        />
                        <Input
                          value={om.current_result || ""}
                          onChange={(e) => updateOutcomeMeasure(index, 'current_result', e.target.value)}
                          placeholder="Current result"
                        />
                        <Input
                          value={om.anticipated_outcome || ""}
                          onChange={(e) => updateOutcomeMeasure(index, 'anticipated_outcome', e.target.value)}
                          placeholder="Anticipated outcome"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Barriers and Strategies</Label>
                    <Button onClick={addBarrier} variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Add Barrier
                    </Button>
                  </div>
                  {(generatedContent.barriers || []).map((barrier, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="grid md:grid-cols-2 gap-2 flex-1">
                          <Textarea
                            value={barrier.barrier || ""}
                            onChange={(e) => updateBarrier(index, 'barrier', e.target.value)}
                            placeholder="Barrier"
                            rows={2}
                          />
                          <Textarea
                            value={barrier.strategy || ""}
                            onChange={(e) => updateBarrier(index, 'strategy', e.target.value)}
                            placeholder="Recommended strategy"
                            rows={2}
                          />
                        </div>
                        <Button
                          onClick={() => removeBarrier(index)}
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-slate-200 rounded-lg p-8 shadow-lg max-h-[60vh] overflow-y-auto">
                {clinician && (
                  <PrintableReport
                    reportContent={generatedContent}
                    client={client}
                    clinician={clinician}
                    title={template?.name || "Clinical Report"}
                    formType={'workcover_pmp'}
                  />
                )}
              </div>
            )}

            <div className="flex justify-center gap-4">
              {/* Only allow regenerate if not editing a historical report */}
              {!editingReport && (
                <Button onClick={() => setCurrentStep(1)} variant="outline">
                  Regenerate
                </Button>
              )}
              <Button
                onClick={handleSaveReport}
                disabled={isSaving}
                variant="outline"
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
              <Button
                onClick={handlePrint}
                className="bg-green-600 hover:bg-green-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print / Save as PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Component responsible for generating generic reports (non-WorkCover PMP and non-DVA)
function GenericReportFiller({ client, formType, onClose, editingReport }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const printRef = useRef(null);
    const [generatedContent, setGeneratedContent] = useState(editingReport ? editingReport.report_data.html : null);
    const [editableContent, setEditableContent] = useState(editingReport ? editingReport.report_data.html : "");
    const [isEditing, setIsEditing] = useState(false);
    const [clinician, setClinician] = useState(null);
    const [clientData, setClientData] = useState({ conditions: [], assessments: [] });
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [selectedAssessmentIds, setSelectedAssessmentIds] = useState([]);
    const [currentStep, setCurrentStep] = useState(editingReport ? 2 : 0); // 0: assessment selection, 1: generate, 2: edit/review

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsDataLoading(true);
            try {
                const [userData, conditions, clientAssessmentsData, allAssessmentsData] = await Promise.all([
                    User.me(),
                    ClientCondition.filter({ client_id: client.id }),
                    ClientAssessment.filter({ client_id: client.id, status: "completed" }),
                    Assessment.list()
                ]);

                const assessmentMap = new Map(allAssessmentsData.map(a => [a.id, a]));
                const augmentedAssessments = clientAssessmentsData.map(ca => ({
                    ...ca,
                    name: assessmentMap.get(ca.assessment_id)?.name || 'Unknown Assessment',
                    unit_of_measure: assessmentMap.get(ca.assessment_id)?.unit_of_measure || '',
                    // The existing 'assessment_date' property is already formatted as 'dd/MM/yyyy' in the original code.
                    // We add a new property 'assessment_date_sortable' for reliable sorting.
                    assessment_date_sortable: ca.assessment_date ? new Date(ca.assessment_date) : null 
                }));

                setClinician(userData);
                setClientData({ conditions, assessments: augmentedAssessments });
                if (augmentedAssessments.length > 0 && !editingReport) { // Only select all if not editing a report
                    setSelectedAssessmentIds(augmentedAssessments.map(a => a.id));
                }
            } catch(e) {
                toast.error("Could not load required data for the report.");
                setError("Could not load required data for the report.");
                console.error(e);
            } finally {
                setIsDataLoading(false);
            }
        }
        fetchInitialData();
    }, [client.id, editingReport]);

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
        }
    };

    const handleProceedToGenerate = () => {
        setCurrentStep(1);
    };

    const formTemplates = {
        workcover_pmp: { name: "WorkCover QLD Provider Management Plan (Form 32)" },
        workcover_progress: { name: "WorkCover QLD Progress Report" },
        dva_patient_care_plan: { name: "DVA Patient Care Plan" }, // Still needed for display name
        dva_end_cycle_report: { name: "DVA End-of-Cycle Report" },
        medicare_initial: { name: "Medicare Initial Letter to GP" },
        medicare_final: { name: "Medicare Final Letter to GP" },
        ndis_initial: { name: "NDIS Initial Assessment Report" },
        tac_functional: { name: "TAC/MAIC Functional Assessment" },
        aged_care_assessment: { name: "My Aged Care Assessment Report" } 
    };

    const template = formTemplates[formType] || { name: "Report" };

    const handleClose = () => {
        if (onClose) {
            onClose();
        }
    };

    const generateReport = async () => {
        if (!clinician) {
            toast.error("Clinician data not loaded yet. Please wait a moment.");
            return;
        }
        
        setIsProcessing(true);
        setError(null);
        
        try {
            const selectedAssessments = clientData.assessments.filter(ca => selectedAssessmentIds.includes(ca.id));
            
            // Group assessments by assessment_id to track progress over time
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

            // Build assessment table as HTML for insertion
            let assessmentTableHTML = `<table style="width: 100%; border-collapse: collapse; margin: 10px 0 20px 0;">
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
                assessmentGroup.results.sort((a, b) => 
                    a.assessment_date_sortable - b.assessment_date_sortable
                );
                
                const initial = assessmentGroup.results[0];
                const current = assessmentGroup.results[assessmentGroup.results.length - 1];
                
                const name = assessmentGroup.name;
                const unit = assessmentGroup.unit;
                
                // Format initial result
                const initialDate = initial.assessment_date_sortable 
                    ? initial.assessment_date_sortable.toLocaleDateString('en-AU', { 
                        day: 'numeric', month: 'long', year: 'numeric' 
                    }) 
                    : 'N/A';
                let initialResultText = `${initial.result_value !== undefined && initial.result_value !== null ? initial.result_value : 'N/A'}${initial.unit_of_measure ? ' ' + initial.unit_of_measure : ''}`;
                
                if (initial.additional_data) {
                    const data = initial.additional_data;
                    if (data.measurement_type === 'hand_grip_strength') {
                        initialResultText = `Dom ${data.dominant_best || '-'} kg; Non-Dom ${data.non_dominant_best || '-'} kg`;
                    } else if (data.measurement_type === 'blood_pressure') {
                        initialResultText = `${data.pre_exercise_systolic || '-'}/${data.pre_exercise_diastolic || '-'} mmHg`;
                    } else if (data.measurement_type === 'heart_rate') {
                        initialResultText = `${data.pre_exercise_hr || '-'} bpm`;
                    } else if (data.measurement_type === 'spo2') {
                        initialResultText = `${data.pre_exercise_spo2 || '-'}%`;
                    }
                }
                initialResultText += ` (${initialDate})`;
                
                // Format current result
                const currentDate = current.assessment_date_sortable 
                    ? current.assessment_date_sortable.toLocaleDateString('en-AU', { 
                        day: 'numeric', month: 'long', year: 'numeric' 
                    }) 
                    : 'N/A';
                let currentResultText = `${current.result_value !== undefined && current.result_value !== null ? current.result_value : 'N/A'}${current.unit_of_measure ? ' ' + current.unit_of_measure : ''}`;
                
                if (current.additional_data) {
                    const data = current.additional_data;
                    if (data.measurement_type === 'hand_grip_strength') {
                        currentResultText = `Dom ${data.dominant_best || '-'} kg; Non-Dom ${data.non_dominant_best || '-'} kg`;
                    } else if (data.measurement_type === 'blood_pressure') {
                        currentResultText = `${data.pre_exercise_systolic || '-'}/${data.pre_exercise_diastolic || '-'} mmHg`;
                    } else if (data.measurement_type === 'heart_rate') {
                        currentResultText = `${data.pre_exercise_hr || '-'} bpm`;
                    } else if (data.measurement_type === 'spo2') {
                        currentResultText = `${data.pre_exercise_spo2 || '-'}%`;
                    }
                }
                currentResultText += ` (${currentDate})`;
                
                // Calculate change
                let changeText = '';
                // Only calculate numeric change if both initial and current results are simple numeric values
                if (initial.result_value && current.result_value && 
                    !isNaN(Number(initial.result_value)) && !isNaN(Number(current.result_value)) &&
                    !initial.additional_data && !current.additional_data) {
                    const initialVal = Number(initial.result_value);
                    const currentVal = Number(current.result_value);
                    const change = currentVal - initialVal;
                    const percentChange = initialVal !== 0 ? ((change / initialVal) * 100).toFixed(1) : 'N/A';
                    
                    if (change > 0) {
                        changeText = `+${change.toFixed(1)}${unit ? ' ' + unit : ''}${percentChange !== 'N/A' ? ` (+${percentChange}%)` : ''}`;
                    } else if (change < 0) {
                        changeText = `${change.toFixed(1)}${unit ? ' ' + unit : ''}${percentChange !== 'N/A' ? ` (${percentChange}%)` : ''}`;
                    } else {
                        changeText = 'No change';
                    }
                } else {
                    changeText = 'N/A (complex measurement)';
                }
                
                assessmentTableHTML += `
<tr>
<td style="border: 1px solid #e2e8f0; padding: 12px;"><strong>${name}</strong></td>
<td style="border: 1px solid #e2e8f0; padding: 12px;">${initialResultText}</td>
<td style="border: 1px solid #e2e8f0; padding: 12px;">${currentResultText}</td>
<td style="border: 1px solid #e2e8f0; padding: 12px;">${changeText}</td>
</tr>`;

                // Add normative comparison row if available
                if (current.normative_comparison) {
                    const normative = current.normative_comparison.replace(/_/g, ' ');
                    assessmentTableHTML += `
<tr>
<td colspan="4" style="border: 1px solid #e2e8f0; padding: 8px; background-color: #f8fafc; font-size: 0.9em; font-style: italic;">Normative Comparison: ${normative}</td>
</tr>`;
                }
                
                // Add notes row if available
                if (current.notes && current.notes.trim()) {
                    assessmentTableHTML += `
<tr>
<td colspan="4" style="border: 1px solid #e2e8f0; padding: 8px; background-color: #f8fafc; font-size: 0.9em;">Notes: ${current.notes}</td>
</tr>`;
                }
            });

            assessmentTableHTML += `
</tbody>
</table>`;

            const llmPrompt = `
You are an expert Australian Exercise Physiologist writing a clinical report for a **${template.name}**.
The client is ${client.full_name}.
Format your entire output using basic HTML formatting (use <h2>, <h3>, <p>, <strong>, <ul>, <li> tags).
Return clean HTML only — no markdown, no code fences, no <html> or <body> wrapper.

**Client & Assessment Data:**
- Client: ${JSON.stringify(client, null, 2)}
- Conditions: ${JSON.stringify(clientData.conditions, null, 2)}
- Clinician: ${JSON.stringify(clinician, null, 2)}

**Instructions:**
Generate a comprehensive **${template.name}** based on the data provided.
Structure the report logically for this form type (DVA/Medicare/TAC/NDIS/Aged Care/WorkCover as applicable).
Ensure the language is professional, objective, and ready for another healthcare provider.

CRITICAL: When you reach the Assessment Results section:
1. Write ONLY this heading: <h2>Assessment Results</h2>
2. DO NOT write anything else in this section
3. DO NOT create a table or list assessments
4. The assessment table will be inserted automatically after your response

After the Assessment Results heading, continue with the next section (usually Clinical Interpretation or Treatment Plan).

Begin with the first section - no introduction text.
`;
            const reportData = await InvokeLLM({ prompt: llmPrompt });

            // Insert the assessment table after the Assessment Results heading
            let finalReport = reportData;
            const assessmentHeadingPattern = /<h2[^>]*>Assessment Results<\/h2>/i;
            
            if (assessmentHeadingPattern.test(finalReport)) {
                finalReport = finalReport.replace(
                    assessmentHeadingPattern,
                    `<h2>Assessment Results</h2>${assessmentTableHTML}`
                );
            } else {
                // If heading not found, append at the end
                finalReport = `${reportData}<h2>Assessment Results</h2>${assessmentTableHTML}`;
            }

            setGeneratedContent(finalReport);
            setEditableContent(finalReport);
            setCurrentStep(2);

        } catch (err) {
            console.error("Error generating report:", err);
            setError("Failed to generate the report. Please try again.");
            toast.error("An error occurred during report generation.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveReport = async () => {
        setIsSaving(true);
        try {
            const reportNames = {
                workcover_progress: "WorkCover Progress Report",
                dva_patient_care_plan: "DVA Patient Care Plan",
                dva_end_cycle_report: "DVA End-of-Cycle Report",
                medicare_initial: "Medicare Initial Assessment Letter",
                medicare_final: "Medicare Final Letter",
                ndis_initial: "NDIS Initial Assessment Report",
                tac_functional: "TAC/MAIC Functional Assessment",
                aged_care_assessment: "My Aged Care Assessment Report",
                private_health_initial: "Private Health Initial Assessment",
                private_health_progress: "Private Health Progress Report", // Added
                medicare_referral_acceptance: "Medicare Referral Acceptance",
                gp_summary: "GP Summary"
            };

            const contentToSave = isEditing ? editableContent : generatedContent;

            if (editingReport) {
                // Update existing report
                await ClientReport.update(editingReport.id, {
                    report_data: { html: contentToSave },
                    html_content: printRef.current?.innerHTML || ""
                });
                toast.success("Report updated successfully!");
            } else {
                // Create new report
                await ClientReport.create({
                    client_id: client.id,
                    report_type: formType,
                    report_name: `${reportNames[formType] || "Report"} - ${format(new Date(), 'dd/MM/yyyy')}`,
                    report_date: todayLocal(),
                    report_data: { html: contentToSave },
                    html_content: printRef.current?.innerHTML || ""
                });
                toast.success("Report saved to client file successfully!");
            }
        } catch (error) {
            console.error("Error saving/updating report:", error);
            toast.error("Failed to save/update report.");
        } finally {
            setIsSaving(false);
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
                    <title>${template.name} - ${client.full_name}</title>
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
            toast.error("Failed to open print dialog. Please try again.");
            if (printWindow) printWindow.close();
        }
    };
    
    if(isDataLoading) {
        return (
            <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-slate-600">Loading client data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={handleClose} variant="outline">
                    Close
                </Button>
            </div>
        );
    }

    return (
        <>
            <Toaster position="top-center" richColors />
            <div className="hidden">
                {generatedContent && clinician && (
                    <PrintableReport 
                        ref={printRef} 
                        reportContent={isEditing ? editableContent : generatedContent} 
                        client={client}
                        clinician={clinician}
                        title={template?.name || "Clinical Report"}
                        formType={formType} // Use the passed formType
                    />
                )}
            </div>

            <div className="space-y-6">
                {/* Step 0: Assessment Selection (Skipped if editing existing report) */}
                {currentStep === 0 && (
                <div className="space-y-6 text-left">
                    <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-slate-900">Select Assessments to Include</h3>
                    <Button 
                        onClick={handleSelectAllAssessments} 
                        variant="outline" 
                        size="sm"
                    >
                        {selectedAssessmentIds.length === clientData.assessments.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    </div>
                    
                    {clientData.assessments.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto px-1 -mx-1">
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
                                <p><strong>Date:</strong> {assessment.assessment_date}</p>
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
                    
                    <div className="flex justify-end gap-3 mt-6">
                    <Button onClick={handleClose} variant="outline">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleProceedToGenerate} 
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Continue with Selected ({selectedAssessmentIds.length})
                    </Button>
                    </div>
                </div>
                )}

                {/* Step 1: Generate (Skipped if editing existing report) */}
                {currentStep === 1 && (
                <div className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-6">
                    <FileDown className="w-8 h-8 text-blue-500" />
                    <div>
                        <h3 className="text-xl font-semibold text-slate-900">{template.name}</h3>
                        <p className="text-slate-600">for {client.full_name}</p>
                        <p className="text-sm text-blue-600">
                        {selectedAssessmentIds.length} of {clientData.assessments.length} assessment(s) selected
                        </p>
                    </div>
                    </div>

                    <div className="space-y-4">
                    <p className="text-slate-700">
                        Ready to generate your {template.name.toLowerCase()}. This will pull data from the client's profile and create a structured report.
                    </p>
                    
                    <div className="flex justify-center gap-4">
                        <Button onClick={() => setCurrentStep(0)} variant="outline">
                        Change Assessments
                        </Button>
                        <Button
                        onClick={generateReport}
                        disabled={isProcessing}
                        className="bg-blue-600 hover:bg-blue-700 px-8 py-3"
                        >
                        {isProcessing ? (
                            <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating Report...
                            </>
                        ) : (
                            <>
                            <FileDown className="w-4 h-4 mr-2" />
                            Generate Report
                            </>
                        )}
                        </Button>
                    </div>
                    </div>
                </div>
                )}

                {/* Step 2: Review/Edit */}
                {currentStep === 2 && generatedContent && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-slate-900">Review & Edit Report</h3>
                    <div className="flex gap-2">
                        <Button
                        onClick={() => {
                            if (isEditing) {
                                setGeneratedContent(editableContent); // Keep edits when returning to View Mode
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
                    </div>

                    {isEditing ? (
                    <div className="space-y-4">
                        <Label className="text-sm font-medium text-slate-700">
                        Edit Report Content:
                        </Label>
                        <RichTextEditor
                        value={editableContent}
                        onChange={setEditableContent}
                        className="max-h-[60vh] overflow-y-auto"
                        />
                        <p className="text-xs text-slate-500">
                          Tip: Edit the report exactly as it will appear. Changes are kept when you switch back to View Mode.
                        </p>
                    </div>
                    ) : (
                    <div className="bg-slate-50 rounded-md border p-6 max-h-[60vh] overflow-y-auto prose prose-blue max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: editableContent }} />
                    </div>
                    )}

                    <div className="flex justify-center gap-4">
                    {/* Only allow regenerate if not editing a historical report */}
                    {!editingReport && (
                        <Button onClick={() => setCurrentStep(1)} variant="outline">
                        Regenerate
                        </Button>
                    )}
                    <Button
                        onClick={handleSaveReport}
                        disabled={isSaving}
                        variant="outline"
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
                    <Button
                        onClick={handlePrint}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        Print / Save as PDF
                    </Button>
                    </div>
                </div>
                )}
            </div>
        </>
    );
}

// The main exported PDFFormFiller component acting as a dispatcher
export default function PDFFormFiller({ client, formType, onClose, editingReport }) {
    const selectedClient = client;
    const selectedReportInfo = { id: formType };
    const handleStartOver = onClose;

    if (!selectedClient || !selectedReportInfo.id) {
        return null;
    }

    // Use the Form32 generator for WorkCover PMP
    if (selectedReportInfo.id === "workcover_pmp") {
        return (
            <React.Suspense fallback={<div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" /><p className="text-slate-600">Loading Form 32...</p></div>}>
                <Form32Generator client={selectedClient} onClose={handleStartOver} editingReport={editingReport} />
            </React.Suspense>
        );
    }

    // Use the specialized DVA Patient Care Plan component
    if (selectedReportInfo.id === 'patient_care_plan') {
        return (
            <React.Suspense fallback={<div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" /><p className="text-slate-600">Loading DVA Patient Care Plan...</p></div>}>
                <DVAPatientCarePlan client={selectedClient} onClose={handleStartOver} editingReport={editingReport} />
            </React.Suspense>
        );
    }

    // Use the specialized DVA End-of-Cycle Report component
    if (selectedReportInfo.id === 'end_cycle_report' || selectedReportInfo.id === 'dva_end_cycle_report') {
        return (
            <React.Suspense fallback={<div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" /><p className="text-slate-600">Loading DVA End-of-Cycle Report...</p></div>}>
                <DVAEndCycleReport client={selectedClient} onClose={handleStartOver} editingReport={editingReport} />
            </React.Suspense>
        );
    }

    // Use the specialized Private Health Initial Assessment component
    if (selectedReportInfo.id === 'private_health_initial') {
        return (
            <React.Suspense fallback={<div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" /><p className="text-slate-600">Loading Initial Assessment...</p></div>}>
                <PrivateHealthInitialAssessment client={selectedClient} onClose={handleStartOver} editingReport={editingReport} />
            </React.Suspense>
        );
    }

    // Use the specialized Private Health Progress Report component
    if (selectedReportInfo.id === 'private_health_progress') {
        return (
            <React.Suspense fallback={<div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" /><p className="text-slate-600">Loading Progress Report...</p></div>}>
                <PrivateHealthProgressReport client={selectedClient} onClose={handleStartOver} editingReport={editingReport} />
            </React.Suspense>
        );
    }

    // Use the Medicare Referral Acceptance Letter component
    if (selectedReportInfo.id === 'medicare_referral_acceptance') {
        return (
            <React.Suspense fallback={<div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" /><p className="text-slate-600">Loading Referral Acceptance Letter...</p></div>}>
                <MedicareReferralAcceptance client={selectedClient} onClose={handleStartOver} editingReport={editingReport} />
            </React.Suspense>
        );
    }

    // Use the Medicare Initial Assessment Letter component
    if (selectedReportInfo.id === 'medicare_initial') {
        return (
            <React.Suspense fallback={<div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" /><p className="text-slate-600">Loading Initial Assessment Letter...</p></div>}>
                <MedicareInitialLetter client={selectedClient} onClose={handleStartOver} editingReport={editingReport} />
            </React.Suspense>
        );
    }

    // Use the Medicare Final Letter component
    if (selectedReportInfo.id === 'medicare_final') {
        return (
            <React.Suspense fallback={<div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" /><p className="text-slate-600">Loading Final Letter...</p></div>}>
                <MedicareFinalLetter client={selectedClient} onClose={handleStartOver} editingReport={editingReport} />
            </React.Suspense>
        );
    }

    // Use the GP Summary component
    if (selectedReportInfo.id === 'gp_summary') {
        return (
            <React.Suspense fallback={<div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" /><p className="text-slate-600">Loading GP Summary...</p></div>}>
                <GPSummary client={selectedClient} onClose={handleStartOver} editingReport={editingReport} />
            </React.Suspense>
        );
    }

    // Use the generic filler for all other forms
    return (
        <GenericReportFiller
            client={selectedClient}
            formType={selectedReportInfo.id}
            onClose={handleStartOver}
            editingReport={editingReport}
        />
    );
}