import React, { useState, useEffect, useRef } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientCondition, ClientAssessment, Assessment, User } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import { Wand2, Printer, Loader2, Sparkles, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { format } from 'date-fns';
import { ClientReport } from "@/entities/ClientReport"; // Added import

export default function CustomReportGenerator({ client, onClose }) {
  const [isLoading, setIsLoading] = useState(true);
  const [clinician, setClinician] = useState(null);
  const [clientData, setClientData] = useState({ conditions: [], assessments: [] });
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [reportContent, setReportContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTidying, setIsTidying] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Added state
  const [finalReport, setFinalReport] = useState("");
  const printRef = useRef(null);
  const [includeOnboardingGoals, setIncludeOnboardingGoals] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [client.id]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [currentClinician, conditions, clientAssessments] = await Promise.all([
        User.me(),
        ClientCondition.filter({ client_id: client.id }),
        ClientAssessment.filter({ client_id: client.id })
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

  const handleLoadOnboardingGoals = () => {
    if (client.client_goals) {
      if (reportContent.trim()) {
        setReportContent(reportContent + '\n\n## Client Goals from Onboarding\n\n' + client.client_goals);
      } else {
        setReportContent('## Client Goals from Onboarding\n\n' + client.client_goals);
      }
      setIncludeOnboardingGoals(true);
      toast.success("Onboarding goals loaded!");
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const selectedAssessments = clientData.assessments.filter(ca => selectedAssessmentIds.includes(ca.id));
      
      const assessmentsByTest = {};
      selectedAssessments.forEach(ca => {
        const key = ca.assessment_id;
        if (!assessmentsByTest[key]) {
          assessmentsByTest[key] = { name: ca.name, unit: ca.unit_of_measure, results: [] };
        }
        assessmentsByTest[key].results.push({
          date: ca.assessment_date,
          result: ca.result_value,
          notes: ca.notes
        });
        assessmentsByTest[key].results.sort((a, b) => new Date(a.date) - new Date(b.date));
      });

      const prompt = `You are an expert Exercise Physiologist creating a comprehensive clinical report for ${client.full_name}.

Client Information:
- Conditions: ${JSON.stringify(clientData.conditions, null, 2)}
- Assessment Results: ${JSON.stringify(assessmentsByTest, null, 2)}
${includeOnboardingGoals && client.client_goals ? `- Client Goals from Onboarding: ${client.client_goals}` : ''}

Create a detailed, professional report that includes:
1. Executive summary
2. Client background and presenting conditions
${includeOnboardingGoals ? '3. Client goals and treatment objectives' : ''}
${includeOnboardingGoals ? '4. Assessment findings and interpretation' : '3. Assessment findings and interpretation'}
${includeOnboardingGoals ? '5. Progress and outcomes' : '4. Progress and outcomes'}
${includeOnboardingGoals ? '6. Recommendations' : '5. Recommendations'}

Use professional medical terminology and format the report with clear headings and sections.`;

      const response = await InvokeLLM({ prompt });
      setReportContent(response);
      toast.success("Report generated successfully!");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTidyReport = async () => {
    if (!reportContent.trim()) {
      toast.error("Please generate or write some content first");
      return;
    }

    setIsTidying(true);
    try {
      const prompt = `You are an expert Exercise Physiologist. Please tidy up and improve the following clinical report, making it more professional, well-structured, and concise while maintaining all important clinical information:

${reportContent}

Return the improved version with proper formatting:`;

      const response = await InvokeLLM({ prompt });
      setReportContent(response);
      toast.success("Report tidied up successfully!");
    } catch (error) {
      console.error("Error tidying report:", error);
      toast.error("Failed to tidy report");
    } finally {
      setIsTidying(false);
    }
  };

  const handleGenerateFinalReport = () => {
    setFinalReport(reportContent);
    setCurrentStep(2);
  };

  const handlePrint = () => {
    window.print();
  };

  // Added handleSaveReport function
  const handleSaveReport = async () => {
    setIsSaving(true);
    try {
      await ClientReport.create({
        org_id: client.org_id,
        client_id: client.id,
        report_type: "custom_report",
        report_name: `Custom Report - ${format(new Date(), 'dd/MM/yyyy')}`,
        report_date: todayLocal(),
        report_data: { content: finalReport },
        html_content: printRef.current?.innerHTML || ""
      });
      
      toast.success("Report saved to client file successfully!");
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
      
      <div className="space-y-6">
        {/* Step 0: Select Assessments */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Select Assessments to Include</h3>
                <p className="text-sm text-slate-600">Choose which assessments to include in the report</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {clientData.assessments.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-600">No assessments found for this client.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {clientData.assessments.map((assessment) => (
                  <div key={assessment.id} className="flex items-start space-x-3 p-3 bg-white border border-slate-200 rounded-lg">
                    <Checkbox
                      id={`assessment-${assessment.id}`}
                      checked={selectedAssessmentIds.includes(assessment.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedAssessmentIds([...selectedAssessmentIds, assessment.id]);
                        } else {
                          setSelectedAssessmentIds(selectedAssessmentIds.filter(id => id !== assessment.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`assessment-${assessment.id}`} className="cursor-pointer font-medium">
                        {assessment.name}
                      </Label>
                      <p className="text-sm text-slate-600">
                        Date: {assessment.assessment_date ? format(new Date(assessment.assessment_date), 'dd/MM/yyyy') : 'N/A'} | 
                        Result: {assessment.result_value} {assessment.unit_of_measure}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (selectedAssessmentIds.length === 0) {
                    toast.error("Please select at least one assessment");
                    return;
                  }
                  setCurrentStep(1);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Generate/Edit Report */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Generate Custom Report</h3>
                <p className="text-sm text-slate-600">Create a comprehensive clinical report</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {client.client_goals && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900 mb-1">Goals from Client Onboarding:</h4>
                    <p className="text-sm text-green-800 whitespace-pre-wrap">{client.client_goals}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleLoadOnboardingGoals}
                    variant="outline"
                    size="sm"
                    className="bg-white ml-3"
                  >
                    Load Goals
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleGenerateReport}
                disabled={isGenerating || isTidying}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    AI Generate Report
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleTidyReport}
                disabled={isGenerating || isTidying || !reportContent.trim()}
                variant="outline"
              >
                {isTidying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Tidying...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Tidy Up
                  </>
                )}
              </Button>
            </div>

            <div>
              <Label htmlFor="report_content" className="text-sm font-medium text-slate-700 mb-2 block">
                Report Content
              </Label>
              <Textarea
                id="report_content"
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                placeholder="Report content will appear here after generation, or you can write your own..."
                rows={20}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                Back
              </Button>
              <Button 
                onClick={handleGenerateFinalReport}
                disabled={!reportContent.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue to Review
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Review & Print */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Review and Print</h3>
                <p className="text-sm text-slate-600">Review the final report before printing</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 prose max-w-none" ref={printRef}> {/* Added ref */}
              <div className="mb-6">
                <div className="flex justify-between items-start mb-4 pb-4 border-b">
                  {clinician?.clinic_logo_url && (
                    <img src={clinician.clinic_logo_url} alt="Clinic Logo" className="max-w-[150px] max-h-[80px]" />
                  )}
                  <div className="text-right text-sm">
                    <strong>{clinician?.clinic_name}</strong><br />
                    {clinician?.clinic_address}<br />
                    {clinician?.clinic_phone} | {clinician?.clinic_email}
                  </div>
                </div>
                <h2 className="text-center text-2xl font-bold">Clinical Report for {client.full_name}</h2>
              </div>
              
              <div dangerouslySetInnerHTML={{ __html: finalReport.replace(/\n/g, '<br />') }} />
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back to Edit
              </Button>
              <div className="flex gap-2">
                <Button onClick={handleSaveReport} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700"> {/* Added Save Report button */}
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Report"
                  )}
                </Button>
                <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Report
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}