
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientCondition, ClientAssessment, Assessment, User, ClientReport } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import { Printer, Loader2, ChevronLeft, ChevronRight, X, Save, Edit } from "lucide-react";
import { Toaster, toast } from "sonner";
import { SecureFileImage } from "@/components/files/SecureFile";
import { format } from 'date-fns';
import { todayLocal } from "@/lib/localDate";
import { renderSafeHtmlDocument, replaceWithSafeHtml, sanitizeHtml, sanitizeHtmlWithBreaks } from "@/lib/safeHtml";

const PrintableReport = React.forwardRef(({ reportData, client, clinician }, ref) => {
  const formatDate = (date) => {
    if (!date) return 'Not specified';
    try {
      return format(new Date(date), 'dd MMMM yyyy');
    } catch (e) {
      return 'Not specified';
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return 'Unknown';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

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
          .clinic-header img { max-width: 150px; max-height: 75px; }
          .clinic-details { text-align: right; font-size: 10pt; color: #000 !important; }
          .letter-header { margin-bottom: 2em; }
          .letter-date { margin-bottom: 2em; color: #000 !important; }
          .letter-salutation { margin-bottom: 1em; color: #000 !important; }
          .letter-subject { font-weight: bold; margin-bottom: 1.5em; color: #000 !important; }
          .letter-body p { margin: 1em 0; color: #000 !important; }
          .letter-closing { margin-top: 2em; color: #000 !important; }
          .clinician-signature { margin-top: 2em; color: #000 !important; }
          .section-title { font-weight: bold; margin-top: 1.5em; margin-bottom: 0.5em; color: #000 !important; }
          table { width: 100%; border-collapse: collapse; margin: 1em 0; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0 !important; font-weight: bold; }
        }
      `}</style>

      <div className="clinic-header">
        {clinician?.clinic_logo_url ? (
          <SecureFileImage src={clinician.clinic_logo_url} orgId={client.org_id} alt="Clinic Logo" />
        ) : (
          <h2 style={{ margin: 0, color: '#000' }}>{clinician?.clinic_name || ""}</h2>
        )}
        <div className="clinic-details">
          <strong>{clinician?.clinic_name || ""}</strong><br />
          {clinician?.clinic_address || ""}<br />
          Phone: {clinician?.clinic_phone || ""} | Email: {clinician?.clinic_email || ""}
        </div>
      </div>

      <div className="letter-header">
        <div className="letter-date">
          {formatDate(reportData.letter_date)}
        </div>

        <div style={{ marginBottom: '2em' }}>
          {reportData.gp_name}<br />
          {reportData.gp_clinic_name}<br />
          {reportData.gp_address}
        </div>

        <div className="letter-salutation">
          Dear {reportData.gp_name},
        </div>

        <div className="letter-subject">
          RE: Initial Assessment for {client.full_name} (DOB: {formatDate(client.date_of_birth)})
        </div>
      </div>

      <div className="letter-body">
        <p>
          Thank you for your referral of {client.full_name} for Exercise Physiology management under Medicare CDM.
        </p>

        <div className="section-title">Client Details</div>
        <p>
          <strong>Name:</strong> {client.full_name}<br />
          <strong>Date of Birth:</strong> {formatDate(client.date_of_birth)} ({calculateAge(client.date_of_birth)} years)<br />
          <strong>Address:</strong> {client.address || 'Not specified'}<br />
          <strong>Phone:</strong> {client.phone || 'Not specified'}<br />
          <strong>Email:</strong> {client.email || 'Not specified'}
        </p>

        <div className="section-title">Presenting Conditions</div>
        {reportData.conditions_html ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(reportData.conditions_html) }} />
        ) : (
          <p>No conditions documented.</p>
        )}

        <div className="section-title">Assessment Findings</div>
        {reportData.assessments_html ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(reportData.assessments_html) }} />
        ) : (
          <p>No assessments documented.</p>
        )}

        {reportData.goals && (
          <>
            <div className="section-title">Treatment Goals</div>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithBreaks(reportData.goals) }} />
          </>
        )}

        {reportData.management_plan && (
          <>
            <div className="section-title">Proposed Management Plan</div>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithBreaks(reportData.management_plan) }} />
          </>
        )}

        <div className="letter-closing">
          If you have any questions or require further information, please do not hesitate to contact me.
        </div>

        <div className="letter-closing">
          Yours sincerely,
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

export default function MedicareInitialLetter({ client, onClose, editingReport }) {
  const [currentStep, setCurrentStep] = useState(editingReport ? 5 : 0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clinician, setClinician] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [clientData, setClientData] = useState({ conditions: [], assessments: [] });
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState([]);

  const [reportData, setReportData] = useState(() => {
    if (editingReport && editingReport.report_data) {
      return editingReport.report_data;
    }
    return {
      recipient_type: "primary_gp",
      gp_name: client.primary_gp_name || "",
      gp_clinic_name: client.primary_gp_clinic_name || "",
      gp_address: client.primary_gp_address || "",
      letter_date: todayLocal(),
      assessment_date: todayLocal(),
      presenting_concerns: "",
      medical_history: "",
      assessment_findings: "",
      goals: "",
      treatment_plan: "",
      frequency_duration: "",
      next_review: "",
      // Existing fields for PrintableReport to consume
      conditions_html: "",
      assessments_html: "",
      management_plan: ""
    };
  });

  const printRef = useRef(null);

  const stepTitles = [
    "Select Assessments",
    "Select Recipient",
    "Generate Content",
    "Goals & Management",
    "Clinical Details",
    "Review & Print"
  ];

  useEffect(() => {
    loadInitialData();
    if (editingReport && editingReport.report_data) {
      setCurrentStep(5);
    }
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [currentClinician, conditions, clientAssessments] = await Promise.all([
        User.me(),
        ClientCondition.filter({ client_id: client.id }),
        ClientAssessment.filter({ client_id: client.id, status: "completed" })
      ]);

      setClinician(currentClinician);

      const assessmentIds = [...new Set(clientAssessments.map(ca => ca.assessment_id))];
      const assessmentDetails = await Promise.all(
        assessmentIds.map(id => Assessment.filter({ id }))
      );

      const enrichedAssessments = clientAssessments.map(ca => {
        const details = assessmentDetails.flat().find(d => d.id === ca.assessment_id);
        return { ...ca, name: details?.name, unit_of_measure: details?.unit_of_measure };
      });

      setClientData({ conditions, assessments: enrichedAssessments });
      setSelectedAssessmentIds(enrichedAssessments.map(a => a.id));
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load client data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecipientTypeChange = (type) => {
    let recipientData = {
      recipient_type: type,
      gp_name: "",
      gp_clinic_name: "",
      gp_address: ""
    };

    switch(type) {
      case "primary_gp":
        recipientData.gp_name = client.primary_gp_name || "";
        recipientData.gp_clinic_name = client.primary_gp_clinic_name || "";
        recipientData.gp_address = client.primary_gp_address || "";
        break;
      case "hospital_gp":
        recipientData.gp_name = client.hospital_gp_name || "";
        recipientData.gp_clinic_name = client.hospital_name || ""; // Assuming hospital name is clinic name
        recipientData.gp_address = client.hospital_gp_address || "";
        break;
      case "specialist":
        recipientData.gp_name = client.specialist_name || "";
        recipientData.gp_clinic_name = client.specialist_clinic_name || "";
        recipientData.gp_address = client.specialist_address || "";
        break;
      case "other":
        // Leave blank for manual entry
        break;
    }

    setReportData(prev => ({ ...prev, ...recipientData }));
  };

  const handleNext = () => {
    if (currentStep === 0 && selectedAssessmentIds.length === 0) {
      toast.error("Please select at least one assessment");
      return;
    }
    // New validation for Step 1 (Select Recipient)
    if (currentStep === 1) {
      if (!reportData.gp_name || !reportData.gp_clinic_name) { // GP address is often optional or can be partial
        toast.error("Please fill in recipient's name and clinic name");
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setIsEditing(false);
    }
  };

  const handleChange = (field, value) => {
    setReportData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateContent = async () => {
    try {
      const selectedAssessments = clientData.assessments.filter(ca => 
        selectedAssessmentIds.includes(ca.id)
      );

      const conditionsHtml = clientData.conditions.map(c => 
        `<li><strong>${c.condition_name}</strong>${c.medication ? ` - Medication: ${c.medication}` : ''}</li>`
      ).join('');

      const assessmentsHtml = selectedAssessments.map(a => 
        `<li><strong>${a.name}:</strong> ${a.result_value} ${a.unit_of_measure || ''} (${format(new Date(a.assessment_date), 'dd/MM/yyyy')})</li>`
      ).join('');

      setReportData(prev => ({
        ...prev,
        conditions_html: conditionsHtml ? `<ul>${conditionsHtml}</ul>` : '',
        assessments_html: assessmentsHtml ? `<ul>${assessmentsHtml}</ul>` : ''
      }));

      setCurrentStep(3); // Go to Goals & Management (old step 3, now step 4)
    } catch (error) {
      console.error("Error generating content:", error);
      toast.error("Failed to generate content");
    }
  };

  const handleSaveReport = async () => {
    setIsSaving(true);
    try {
      const dataToSave = reportData;

      if (editingReport) {
        await ClientReport.update(editingReport.id, {
          report_data: dataToSave,
          html_content: printRef.current?.innerHTML || ""
        });
        toast.success("Report updated successfully!");
      } else {
        await ClientReport.create({
          client_id: client.id,
          report_type: "medicare_initial",
          report_name: `Medicare Initial Assessment - ${format(new Date(), 'dd/MM/yyyy')}`,
          report_date: todayLocal(),
          report_data: dataToSave,
          html_content: printRef.current?.innerHTML || ""
        });
        toast.success("Report saved to client file successfully!");
      }
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Failed to save report");
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
      replaceWithSafeHtml(document.body, printRef.current.innerHTML);
      window.print();
      replaceWithSafeHtml(document.body, originalContent);
      window.location.reload();
      return;
    }

    try {
      renderSafeHtmlDocument(printWindow, `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Medicare Initial Assessment - ${client.full_name}</title>
          <meta charset="utf-8">
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
        </html>
      `);
      
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

  const displayReportData = reportData;

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-slate-600">Loading client data...</p>
      </div>
    );
  }

  return (
    <>
      <Toaster richColors position="top-center" />
      
      <div className="hidden">
        {clinician && (
          <PrintableReport 
            ref={printRef}
            reportData={displayReportData}
            client={client}
            clinician={clinician}
          />
        )}
      </div>

      <div className="bg-white rounded-lg w-full mx-auto">
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Medicare Initial Assessment Letter</h3>
            <p className="text-sm text-slate-600">{stepTitles[currentStep]}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-6 py-4">
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

        <div className="p-6 min-h-[500px]">
          {/* Step 0: Select Assessments */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">Select Assessments to Include</h3>
                <Button 
                  onClick={() => {
                    if (selectedAssessmentIds.length === clientData.assessments.length) {
                      setSelectedAssessmentIds([]);
                    } else {
                      setSelectedAssessmentIds(clientData.assessments.map(a => a.id));
                    }
                  }}
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
                        onCheckedChange={() => {
                          setSelectedAssessmentIds(prev =>
                            prev.includes(assessment.id)
                              ? prev.filter(id => id !== assessment.id)
                              : [...prev, assessment.id]
                          );
                        }}
                      />
                      <div className="grid gap-1.5 leading-none flex-1">
                        <Label htmlFor={`assessment-${assessment.id}`} className="font-semibold text-slate-800 cursor-pointer">
                          {assessment.name}
                        </Label>
                        <div className="text-sm text-slate-600">
                          <p><strong>Date:</strong> {assessment.assessment_date ? format(new Date(assessment.assessment_date), 'dd/MM/yyyy') : 'N/A'}</p>
                          <p><strong>Result:</strong> {assessment.result_value} {assessment.unit_of_measure}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">No completed assessments found for this client.</p>
              )}
              
              <div className="flex justify-end gap-3 mt-6">
                <Button onClick={onClose} variant="outline">
                  Cancel
                </Button>
                <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Select Recipient */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">Select GP/Recipient</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-3 block">
                    Who should this letter be sent to?
                  </Label>
                  <div className="grid gap-3">
                    <Button
                      type="button"
                      variant={reportData.recipient_type === "primary_gp" ? "default" : "outline"}
                      className="justify-start h-auto py-4 px-4"
                      onClick={() => handleRecipientTypeChange("primary_gp")}
                    >
                      <div className="text-left">
                        <div className="font-semibold">Primary GP</div>
                        {client.primary_gp_name && (
                          <div className="text-sm opacity-80 mt-1">
                            {client.primary_gp_name} - {client.primary_gp_clinic_name}
                          </div>
                        )}
                      </div>
                    </Button>

                    {client.hospital_gp_name && (
                      <Button
                        type="button"
                        variant={reportData.recipient_type === "hospital_gp" ? "default" : "outline"}
                        className="justify-start h-auto py-4 px-4"
                        onClick={() => handleRecipientTypeChange("hospital_gp")}
                      >
                        <div className="text-left">
                          <div className="font-semibold">Hospital/Rehab GP</div>
                          <div className="text-sm opacity-80 mt-1">
                            {client.hospital_gp_name} - {client.hospital_name}
                          </div>
                        </div>
                      </Button>
                    )}

                    {client.specialist_name && (
                      <Button
                        type="button"
                        variant={reportData.recipient_type === "specialist" ? "default" : "outline"}
                        className="justify-start h-auto py-4 px-4"
                        onClick={() => handleRecipientTypeChange("specialist")}
                      >
                        <div className="text-left">
                          <div className="font-semibold">Specialist</div>
                          <div className="text-sm opacity-80 mt-1">
                            {client.specialist_name} ({client.specialist_type}) - {client.specialist_clinic_name}
                          </div>
                        </div>
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant={reportData.recipient_type === "other" ? "default" : "outline"}
                      className="justify-start h-auto py-4 px-4"
                      onClick={() => handleRecipientTypeChange("other")}
                    >
                      <div className="text-left">
                        <div className="font-semibold">Other Healthcare Provider</div>
                        <div className="text-sm opacity-80 mt-1">
                          Enter details manually
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label htmlFor="gp_name">Recipient Name *</Label>
                    <Input
                      id="gp_name"
                      value={reportData.gp_name}
                      onChange={(e) => handleChange('gp_name', e.target.value)}
                      placeholder="Dr. John Smith"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gp_clinic_name">Clinic/Practice Name *</Label>
                    <Input
                      id="gp_clinic_name"
                      value={reportData.gp_clinic_name}
                      onChange={(e) => handleChange('gp_clinic_name', e.target.value)}
                      placeholder="Smith Medical Centre"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gp_address">Address</Label>
                    <Textarea
                      id="gp_address"
                      value={reportData.gp_address}
                      onChange={(e) => handleChange('gp_address', e.target.value)}
                      placeholder="123 Main St, City, State, Postcode"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">Letter Date</Label>
                    <Input
                      type="date"
                      value={reportData.letter_date}
                      onChange={(e) => handleChange('letter_date', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handleBack}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={handleNext}
                  disabled={!reportData.gp_name || !reportData.gp_clinic_name}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Generate Content */}
          {currentStep === 2 && (
            <div className="space-y-6 text-center">
              <div className="py-8">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Ready to Generate Assessment Content</h4>
                <p className="text-slate-600 mb-6">
                  We'll compile the client's conditions and selected assessment results into the report.
                </p>
                
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={handleBack}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleGenerateContent} className="bg-blue-600 hover:bg-blue-700">
                    Generate Content
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Goals & Management */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Treatment Goals</Label>
                  <RichTextEditor
                    value={reportData.goals}
                    onChange={(value) => handleChange('goals', value)}
                    placeholder="Enter short-term and long-term goals..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Proposed Management Plan</Label>
                  <RichTextEditor
                    value={reportData.management_plan}
                    onChange={(value) => handleChange('management_plan', value)}
                    placeholder="Enter frequency, type, and focus of sessions..."
                    className="mt-1"
                  />
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

          {/* Step 4: Clinical Details Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Presenting Conditions</h4>
                  {reportData.conditions_html ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(reportData.conditions_html) }} />
                  ) : (
                    <p className="text-slate-500">No conditions documented</p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Assessment Results</h4>
                  {reportData.assessments_html ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(reportData.assessments_html) }} />
                  ) : (
                    <p className="text-slate-500">No assessments documented</p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Goals</h4>
                  {reportData.goals ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithBreaks(reportData.goals) }} />
                  ) : (
                    <p className="text-slate-500">No goals specified</p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">Management Plan</h4>
                  {reportData.management_plan ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlWithBreaks(reportData.management_plan) }} />
                  ) : (
                    <p className="text-slate-500">No plan specified</p>
                  )}
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-6">
                <Button variant="outline" onClick={handleBack}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back to Edit
                </Button>
                <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                  Continue to Review
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Review & Print */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">Review Report</h3>
                <Button
                  onClick={() => setIsEditing(!isEditing)}
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
                      <Label htmlFor="edit_gp_name">Recipient Name</Label>
                      <Input
                        id="edit_gp_name"
                        value={reportData.gp_name || ""}
                        onChange={(e) => handleChange('gp_name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_gp_clinic_name">Clinic/Practice Name</Label>
                      <Input
                        id="edit_gp_clinic_name"
                        value={reportData.gp_clinic_name || ""}
                        onChange={(e) => handleChange('gp_clinic_name', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit_gp_address">Recipient Address</Label>
                    <Textarea
                      id="edit_gp_address"
                      value={reportData.gp_address || ""}
                      onChange={(e) => handleChange('gp_address', e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_letter_date">Letter Date</Label>
                    <Input
                      id="edit_letter_date"
                      type="date"
                      value={reportData.letter_date || ""}
                      onChange={(e) => handleChange('letter_date', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Presenting Conditions</Label>
                    <RichTextEditor
                      value={reportData.conditions_html}
                      onChange={(value) => handleChange('conditions_html', value)}
                      placeholder="List the client's presenting conditions..."
                    />
                  </div>

                  <div>
                    <Label>Assessment Findings</Label>
                    <RichTextEditor
                      value={reportData.assessments_html}
                      onChange={(value) => handleChange('assessments_html', value)}
                      placeholder="List the assessment results..."
                    />
                  </div>

                  <div>
                    <Label>Treatment Goals</Label>
                    <RichTextEditor
                      value={reportData.goals}
                      onChange={(value) => handleChange('goals', value)}
                      placeholder="Enter short-term and long-term goals..."
                    />
                  </div>

                  <div>
                    <Label>Proposed Management Plan</Label>
                    <RichTextEditor
                      value={reportData.management_plan}
                      onChange={(value) => handleChange('management_plan', value)}
                      placeholder="Enter frequency, type, and focus of sessions..."
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-white border-2 border-slate-200 rounded-lg p-8 shadow-lg max-h-[70vh] overflow-y-auto">
                  {clinician && (
                    <PrintableReport 
                      reportData={displayReportData}
                      client={client}
                      clinician={clinician}
                    />
                  )}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(4)}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back to Edit
                </Button>
                <div className="flex gap-3">
                  {!editingReport && (
                    <Button onClick={() => setCurrentStep(2)} variant="outline">
                      Regenerate
                    </Button>
                  )}
                  <Button onClick={handleSaveReport} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700">
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
      </div>
    </>
  );
}
