
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { ClientCondition, ClientAssessment, Assessment, User, ClientReport } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import { Printer, Loader2, ChevronLeft, ChevronRight, X, Wand2, Save, Plus, Edit } from "lucide-react";
import { Toaster, toast } from "sonner";
import { format } from 'date-fns';

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
          ul { margin: 0.5em 0; padding-left: 1.5em; }
          li { margin: 0.3em 0; }
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
          RE: Final Letter for {client.full_name} (DOB: {formatDate(client.date_of_birth)})
        </div>
      </div>

      <div className="letter-body">
        <p>
          This letter is to inform you that {client.full_name} has completed their Exercise Physiology program under Medicare CDM.
        </p>

        {reportData.summary && (
          <>
            <div className="section-title">Program Summary</div>
            <div dangerouslySetInnerHTML={{ __html: reportData.summary.replace(/\n/g, '<br />') }} />
          </>
        )}

        {reportData.goals_achieved && (
          <>
            <div className="section-title">Goals Achieved</div>
            <div dangerouslySetInnerHTML={{ __html: reportData.goals_achieved.replace(/\n/g, '<br />') }} />
          </>
        )}

        {reportData.recommendations && (
          <>
            <div className="section-title">Recommendations</div>
            <div dangerouslySetInnerHTML={{ __html: reportData.recommendations.replace(/\n/g, '<br />') }} />
          </>
        )}

        <div className="letter-closing">
          Thank you for the opportunity to work with {client.full_name}. If you have any questions, please do not hesitate to contact me.
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

export default function MedicareFinalLetter({ client, onClose, editingReport }) {
  const [currentStep, setCurrentStep] = useState(editingReport ? 5 : 0); // Total 6 steps now (0-5)
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clinician, setClinician] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [reportData, setReportData] = useState(() => {
    if (editingReport && editingReport.report_data) {
      return editingReport.report_data;
    }
    return {
      recipient_type: "primary_gp", // New field for recipient type
      gp_name: client.primary_gp_name || "",
      gp_clinic_name: client.primary_gp_clinic_name || "",
      gp_address: client.primary_gp_address || "",
      letter_date: new Date().toISOString().split('T')[0],
      summary: "",
      goals_achieved: "",
      recommendations: ""
    };
  });

  const printRef = useRef(null);

  const stepTitles = [
    "Select Assessments", // New Step 0
    "Select Recipient",   // New Step 1 (replaces old Step 0 GP Details)
    "Program Summary",    // Old Step 1, now Step 2
    "Goals & Recommendations", // Old Step 2, now Step 3
    "Generate Content",   // Old Step 3, now Step 4
    "Review & Print"      // Old Step 4, now Step 5
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const currentClinician = await User.me();
      setClinician(currentClinician);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load clinician data");
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
        recipientData.gp_clinic_name = client.hospital_name || "";
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
    // Validation for new Step 1: Select Recipient
    if (currentStep === 1) {
      if (!reportData.gp_name || !reportData.gp_clinic_name || !reportData.gp_address) {
        toast.error("Please fill in all required GP details");
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setIsEditing(false); // Reset editing mode when navigating back
    }
  };

  const handleChange = (field, value) => {
    setReportData(prev => ({ ...prev, [field]: value }));
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
          report_type: "medicare_final",
          report_name: `Medicare Final Letter - ${format(new Date(), 'dd/MM/yyyy')}`,
          report_date: new Date().toISOString().split('T')[0],
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
      document.body.innerHTML = printRef.current.innerHTML;
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
          <title>Medicare Final Letter - ${client.full_name}</title>
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

  const getDisplayReportData = () => {
    return reportData;
  };

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
      <Toaster position="top-center" richColors />
      
      <div className="hidden">
        {clinician && (
          <PrintableReport 
            ref={printRef} 
            reportData={getDisplayReportData()}
            client={client}
            clinician={clinician}
          />
        )}
      </div>

      <div className="bg-white rounded-lg w-full mx-auto">
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Medicare Final Letter</h3>
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
          {/* Step 0: Select Assessments (Placeholder as per outline) */}
          {currentStep === 0 && (
            <div className="space-y-6 text-center">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Assessments Selection (Placeholder)</h4>
              <p className="text-slate-600 mb-6">
                This step is a placeholder for future assessment selection functionality.
              </p>
              <div className="flex justify-center gap-3 pt-6">
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
                {/* Close button is already in the main header, removing redundant one here */}
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-3 block">
                    Who should this final letter be sent to?
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
                  <h4 className="font-semibold text-slate-800">Recipient Details</h4>
                  <div>
                    <Label htmlFor="gp_name">GP/Provider Name *</Label>
                    <Input
                      id="gp_name"
                      value={reportData.gp_name}
                      onChange={(e) => handleChange('gp_name', e.target.value)}
                      placeholder="Dr. John Smith"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gp_clinic_name">Clinic/Practice Name *</Label>
                    <Input
                      id="gp_clinic_name"
                      value={reportData.gp_clinic_name}
                      onChange={(e) => handleChange('gp_clinic_name', e.target.value)}
                      placeholder="Smith Medical Centre"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gp_address">Address *</Label>
                    <Textarea
                      id="gp_address"
                      value={reportData.gp_address}
                      onChange={(e) => handleChange('gp_address', e.target.value)}
                      placeholder="123 Main St, City, State, Postcode"
                      rows={3}
                      className="mt-1"
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
                  disabled={!reportData.gp_name || !reportData.gp_clinic_name || !reportData.gp_address}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Program Summary (Old Step 1) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-slate-700">Program Summary</Label>
                <RichTextEditor
                  value={reportData.summary}
                  onChange={(value) => handleChange('summary', value)}
                  placeholder="Describe the program duration, number of sessions attended, and overall participation..."
                  className="mt-1"
                />
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

          {/* Step 3: Goals & Recommendations (Old Step 2) */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-slate-700">Goals Achieved</Label>
                <RichTextEditor
                  value={reportData.goals_achieved}
                  onChange={(value) => handleChange('goals_achieved', value)}
                  placeholder="Describe the goals that were achieved during the program..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">Recommendations</Label>
                <RichTextEditor
                  value={reportData.recommendations}
                  onChange={(value) => handleChange('recommendations', value)}
                  placeholder="Provide recommendations for ongoing management or further referrals..."
                  className="mt-1"
                />
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

          {/* Step 4: Generate Content (Info Only) (Old Step 3) */}
          {currentStep === 4 && (
            <div className="space-y-6 text-center">
              <div className="py-8">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Review Content</h4>
                <p className="text-slate-600 mb-6">
                  Review the information you've provided before generating the final letter.
                </p>
                
                <div className="bg-slate-50 rounded-lg p-6 text-left space-y-4 max-w-2xl mx-auto">
                  <div>
                    <h5 className="font-semibold text-slate-800">Program Summary:</h5>
                    {reportData.summary ? (
                      <div className="text-slate-600" dangerouslySetInnerHTML={{ __html: reportData.summary.replace(/\n/g, '<br />') }} />
                    ) : (
                      <p className="text-slate-600">Not provided</p>
                    )}
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-800">Goals Achieved:</h5>
                    {reportData.goals_achieved ? (
                      <div className="text-slate-600" dangerouslySetInnerHTML={{ __html: reportData.goals_achieved.replace(/\n/g, '<br />') }} />
                    ) : (
                      <p className="text-slate-600">Not provided</p>
                    )}
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-800">Recommendations:</h5>
                    {reportData.recommendations ? (
                      <div className="text-slate-600" dangerouslySetInnerHTML={{ __html: reportData.recommendations.replace(/\n/g, '<br />') }} />
                    ) : (
                      <p className="text-slate-600">Not provided</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-center gap-4 mt-8">
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
            </div>
          )}

          {/* Step 5: Review & Print (Old Step 4) */}
          {currentStep === 5 && clinician && (
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
                      <Label htmlFor="edit_gp_name">GP/Provider Name</Label>
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
                    <Label>Program Summary</Label>
                    <RichTextEditor
                      value={reportData.summary}
                      onChange={(value) => handleChange('summary', value)}
                      placeholder="Describe the program duration, number of sessions attended, and overall participation..."
                    />
                  </div>

                  <div>
                    <Label>Goals Achieved</Label>
                    <RichTextEditor
                      value={reportData.goals_achieved}
                      onChange={(value) => handleChange('goals_achieved', value)}
                      placeholder="Describe the goals that were achieved during the program..."
                    />
                  </div>

                  <div>
                    <Label>Recommendations</Label>
                    <RichTextEditor
                      value={reportData.recommendations}
                      onChange={(value) => handleChange('recommendations', value)}
                      placeholder="Provide recommendations for ongoing management or further referrals..."
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-white border-2 border-slate-200 rounded-lg p-8 shadow-lg max-h-[70vh] overflow-y-auto">
                  <PrintableReport 
                    reportData={getDisplayReportData()}
                    client={client}
                    clinician={clinician}
                  />
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back to Edit
                </Button>
                <div className="flex gap-3">
                  {!editingReport && (
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
      </div>
    </>
  );
}