
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ClientCondition, ClientAssessment, Assessment, User, ClientReport, Appointment } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import { ChevronLeft, ChevronRight, Loader2, Printer, Sparkles, Save, Edit } from "lucide-react";
import { Toaster, toast } from "sonner";
import { format } from 'date-fns';
import { todayLocal } from "@/lib/localDate";

const PrintableReport = React.forwardRef(({ reportData, client, clinician }, ref) => {
  const formatDate = (date) => {
    if (!date) return 'Not specified';
    try {
      // Ensure date is a valid Date object before formatting
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      return format(dateObj, 'dd MMMM yyyy');
    } catch (e) {
      console.error("Error formatting date:", e);
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
          @page { size: A4; margin: 2cm; }
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .printable-report { 
            width: 100%; 
            font-family: Arial, sans-serif; 
            font-size: 11pt; 
            line-height: 1.5; 
            color: black; 
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
          .clinic-details { text-align: right; font-size: 10pt; line-height: 1.4; }
          .letter-header { margin-bottom: 2em; }
          .letter-header h1 { font-size: 16pt; font-weight: bold; margin: 0 0 0.5em; text-align: center; }
          .recipient-info { margin-bottom: 1.5em; font-size: 10pt; }
          .letter-body { font-size: 11pt; line-height: 1.6; }
          .section-heading { 
            font-size: 13pt; 
            font-weight: bold; 
            color: #1e3a8a; 
            border-bottom: 1px solid #e2e8f0; 
            padding-bottom: 0.3rem; 
            margin: 1.5em 0 0.8em; 
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 1em 0; 
            font-size: 10pt; 
          }
          th, td { 
            border: 1px solid #e2e8f0; 
            padding: 8px; 
            text-align: left; 
          }
          th { 
            background-color: #f1f5f9 !important; 
            font-weight: 600; 
          }
          .info-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 0.5em; 
            margin: 1em 0; 
          }
          .info-item { margin: 0.3em 0; }
          .signature-section { 
            margin-top: 3em; 
            page-break-inside: avoid; 
          }
          ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
          li { margin: 0.3em 0; }
          p { margin: 0.5em 0; }
        }
      `}</style>

      {/* Clinic Header */}
      <div className="clinic-header">
        {clinician?.clinic_logo_url && (
          <img src={clinician.clinic_logo_url} alt="Clinic Logo" />
        )}
        <div className="clinic-details">
          <strong>{clinician?.clinic_name || ""}</strong><br />
          {clinician?.clinic_address || ""}<br />
          {clinician?.clinic_phone || ""} | {clinician?.clinic_email || ""}
        </div>
      </div>

      {/* Letter Header */}
      <div className="letter-header">
        <h1>Private Health Progress Report</h1>
        <div className="recipient-info">
          <p><strong>Date:</strong> {formatDate(reportData.letter_date)}</p>
          <p><strong>To:</strong> {reportData.recipient_name}</p>
          {reportData.recipient_clinic && <p>{reportData.recipient_clinic}</p>}
          {reportData.recipient_address && <p>{reportData.recipient_address}</p>}
        </div>
        <p>Re: <strong>{client.full_name}</strong> (DOB: {formatDate(client.date_of_birth)})</p>
      </div>

      {/* Letter Body */}
      <div className="letter-body">
        <p>Dear {reportData.recipient_name || 'Doctor'},</p>
        
        <p>
          I am writing to provide you with an update on the progress of {client.full_name}, 
          who has been attending exercise physiology sessions at our clinic for management of their health conditions.
        </p>

        {/* Client Details */}
        <div className="section-heading">Client Details</div>
        <div className="info-grid">
          <div className="info-item"><strong>Full Name:</strong> {client.full_name}</div>
          <div className="info-item"><strong>Date of Birth:</strong> {formatDate(client.date_of_birth)} ({calculateAge(client.date_of_birth)} years)</div>
          <div className="info-item"><strong>Gender:</strong> {client.gender === 'other' ? client.gender_other : client.gender || 'Not specified'}</div>
          {client.pronouns && <div className="info-item"><strong>Pronouns:</strong> {client.pronouns}</div>}
          <div className="info-item"><strong>Phone:</strong> {client.phone || 'Not specified'}</div>
          <div className="info-item"><strong>Email:</strong> {client.email || 'Not specified'}</div>
        </div>
        {client.address && (
          <div className="info-item" style={{marginTop: '0.5em'}}>
            <strong>Address:</strong> {client.address}
          </div>
        )}

        {/* Session Summary */}
        <div className="section-heading">Session Summary</div>
        <p><strong>Total Sessions Completed:</strong> {reportData.total_sessions || 'Not specified'}</p>
        <p><strong>Period Covered:</strong> {formatDate(reportData.period_start)} to {formatDate(reportData.period_end)}</p>
        <p><strong>Session Attendance:</strong> {reportData.attendance_rate || 'Not specified'}</p>

        {/* Assessment Results */}
        {reportData.assessment_results && reportData.assessment_results.length > 0 && (
          <>
            <div className="section-heading">Assessment Results - Progress Tracking</div>
            <table>
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Baseline</th>
                  <th>Current</th>
                  <th>Change</th>
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {reportData.assessment_results.map((assessment, index) => (
                  <React.Fragment key={index}>
                    <tr>
                      <td><strong>{assessment.name}</strong></td>
                      <td>
                        {assessment.initial_result || '-'} {assessment.unit || ''}
                        {assessment.initial_date && <><br /><span style={{fontSize: '9pt', color: '#666'}}>({assessment.initial_date})</span></>}
                      </td>
                      <td>
                        {assessment.current_result || '-'} {assessment.unit || ''}
                        {assessment.current_date && <><br /><span style={{fontSize: '9pt', color: '#666'}}>({assessment.current_date})</span></>}
                      </td>
                      <td>{assessment.change || '-'}</td>
                      <td>{assessment.normative || '-'}</td>
                    </tr>
                    {assessment.notes && (
                      <tr>
                        <td colSpan="5" style={{backgroundColor: '#f8fafc', fontSize: '9pt', fontStyle: 'italic'}}>
                          Notes: {assessment.notes}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Goals Progress */}
        {reportData.treatment_goals && reportData.treatment_goals.length > 0 && (
          <>
            <div className="section-heading">Progress Toward Goals</div>
            <table>
              <thead>
                <tr>
                  <th>Goal</th>
                  <th>Date Set</th>
                  <th>Status</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {reportData.treatment_goals.map((goal, index) => (
                  <tr key={index}>
                    <td>{goal.goal}</td>
                    <td>{goal.date_assessed ? formatDate(goal.date_assessed) : '-'}</td>
                    <td>
                      {goal.status === 'completely_achieved' && 'Completely Achieved'}
                      {goal.status === 'ongoing' && 'Ongoing'}
                      {goal.status === 'not_met' && 'Not Met'}
                    </td>
                    <td>{goal.outcome_notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Clinical Summary */}
        {reportData.clinical_summary && (
          <>
            <div className="section-heading">Clinical Summary</div>
            <div dangerouslySetInnerHTML={{ __html: reportData.clinical_summary.replace(/\n/g, '<br />') }} />
          </>
        )}

        {/* Ongoing Management Plan */}
        {reportData.ongoing_plan && (
          <>
            <div className="section-heading">Ongoing Management Plan</div>
            <div dangerouslySetInnerHTML={{ __html: reportData.ongoing_plan.replace(/\n/g, '<br />') }} />
          </>
        )}

        {/* Additional Notes */}
        {reportData.additional_notes && (
          <>
            <div className="section-heading">Additional Notes</div>
            <p>{reportData.additional_notes}</p>
          </>
        )}

        {/* Closing */}
        <p style={{marginTop: '2em'}}>
          Please do not hesitate to contact me if you have any questions or require further information.
        </p>

        {/* Signature */}
        <div className="signature-section">
          <p>Yours sincerely,</p>
          <p style={{marginTop: '2em'}}>
            <strong>{clinician?.clinician_name || clinician?.full_name || ""}</strong><br />
            {clinician?.profession || "Exercise Physiologist"}<br />
            {clinician?.qualifications || ""}<br />
            {clinician?.provider_number && `Provider Number: ${clinician.provider_number}`}
          </p>
        </div>
      </div>
    </div>
  );
});

export default function PrivateHealthProgressReport({ client, onClose, editingReport }) {
  const [currentStep, setCurrentStep] = useState(0); // Initial step is 0 (Select Location)
  const [isLoading, setIsLoading] = useState(true);
  const [clinician, setClinician] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clientData, setClientData] = useState({ conditions: [], assessments: [], appointments: [] });
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState([]);
  const [historicGoals, setHistoricGoals] = useState([]);
  const [selectedHistoricGoalIds, setSelectedHistoricGoalIds] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  const [reportData, setReportData] = useState(() => {
    if (editingReport && editingReport.report_data) {
      return editingReport.report_data;
    }
    return {
      recipient_type: "gp", // gp, specialist
      recipient_name: client.primary_gp_name || "",
      recipient_clinic: client.primary_gp_clinic_name || "",
      recipient_address: client.primary_gp_address || "",
      letter_date: todayLocal(),
      period_start: "",
      period_end: todayLocal(),
      total_sessions: "",
      attendance_rate: "", // Changed from session_frequency
      attendance_notes: "",
      assessment_results: [],
      treatment_goals: [],
      clinical_summary: "",
      ongoing_plan: "",
      additional_notes: "",
      clinic_location_id: null // New field for selected location ID
    };
  });

  const printRef = useRef(null);

  const stepTitles = [
    "Select Location",
    "Select Recipient",
    "Session Summary",
    "Select Assessments",
    "Treatment Goals & Progress",
    "Clinical Summary & Plan",
    "Review & Print"
  ];

  // Load initial data including clinician, client, assessments, and locations
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [currentClinician, conditions, clientAssessments, allAssessments, appointments, reports] = await Promise.all([
          User.me(),
          ClientCondition.filter({ client_id: client.id }),
          ClientAssessment.filter({ client_id: client.id, status: "completed" }),
          Assessment.list(),
          Appointment.filter({ client_id: client.id, status: "completed" }),
          ClientReport.filter({ client_id: client.id })
        ]);

        setClinician(currentClinician);

        const locs = currentClinician.locations || [];
        setLocations(locs);
        
        let initialSelectedLocation = null;
        if (editingReport && editingReport.report_data && editingReport.report_data.clinic_location_id) {
          initialSelectedLocation = locs.find(l => l.id === editingReport.report_data.clinic_location_id);
        }
        // Fallback to main or first if not found or not editing
        if (!initialSelectedLocation) {
          initialSelectedLocation = locs.find(l => l.is_main) || locs[0];
        }
        setSelectedLocation(initialSelectedLocation);


        const assessmentMap = new Map(allAssessments.map(a => [a.id, a]));
        const enrichedAssessments = clientAssessments.map(ca => ({
          ...ca,
          name: assessmentMap.get(ca.assessment_id)?.name || 'Unknown',
          unit_of_measure: assessmentMap.get(ca.assessment_id)?.unit_of_measure || '',
          assessment_date_formatted: ca.assessment_date ? format(new Date(ca.assessment_date), 'dd/MM/yyyy') : 'N/A',
          assessment_date_sortable: ca.assessment_date ? new Date(ca.assessment_date) : null
        }));

        setClientData({ conditions, assessments: enrichedAssessments, appointments });

        // Calculate session stats
        const completedSessions = appointments.filter(a => a.status === 'completed');
        if (completedSessions.length > 0) {
          const sortedSessions = completedSessions.sort((a, b) => 
            new Date(a.start_time) - new Date(b.start_time)
          );
          // Only set these if we're not editing an existing report,
          // or if the existing report doesn't have period_start defined (e.g., legacy)
          if (!editingReport || !reportData.period_start) {
            setReportData(prev => ({
              ...prev,
              total_sessions: completedSessions.length.toString(),
              period_start: format(new Date(sortedSessions[0].start_time), 'yyyy-MM-dd'),
              period_end: format(new Date(sortedSessions[sortedSessions.length - 1].start_time), 'yyyy-MM-dd')
            }));
          }
        }

        // Extract goals from reports and onboarding
        extractGoalsFromReports(reports);

        // If editing report, set reportData and jump to review step
        if (editingReport && editingReport.report_data) {
          setReportData(editingReport.report_data);
          setCurrentStep(stepTitles.length - 1); // Jump to "Review & Print"
        }

      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load client data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [client.id, editingReport, reportData.period_start, stepTitles.length]);

  const extractGoalsFromReports = (reports) => {
    const goals = [];
    let goalIdCounter = 0;

    reports.forEach(report => {
      if (report.report_data && report.report_data.treatment_goals) {
        if (report.report_type === 'private_health_initial' || 
            report.report_type === 'medicare_initial' ||
            report.report_type === 'dva_patient_care_plan') {
          report.report_data.treatment_goals.forEach(goal => {
            if (goal.goal) {
              goals.push({
                id: `goal-${goalIdCounter++}`,
                goal: goal.goal,
                reportName: report.report_name,
                reportDate: report.report_date,
                reportId: report.id
              });
            }
          });
        }
      }
    });

    if (client.client_goals) {
      const goalLines = client.client_goals.split('\n').filter(line => line.trim());
      goalLines.forEach(goal => {
        goals.push({
          id: `goal-${goalIdCounter++}`,
          goal: goal.trim(),
          reportName: "Client Onboarding",
          reportDate: client.created_date
        });
      });
    }

    goals.sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));
    setHistoricGoals(goals);
  };

  const handleNext = () => {
    if (currentStep === 0) { // New step: Select Location
      if (!selectedLocation) {
        toast.error("Please select a clinic location to proceed.");
        return;
      }
    } else if (currentStep === 1) { // Old step 0: Select Recipient
      if (!reportData.recipient_name.trim()) {
        toast.error("Please enter a recipient name.");
        return;
      }
    } else if (currentStep === 2) { // Old step 1: Session Summary
      if (!reportData.total_sessions || !reportData.attendance_rate) {
        toast.error("Please fill in all required session summary fields.");
        return;
      }
    } else if (currentStep === 3) { // Old step 2: Select Assessments
      // No explicit validation needed, can continue without selections
      buildAssessmentResultsTable(); // Make sure assessment results are built before proceeding
    } else if (currentStep === 4) { // Old step 3: Treatment Goals
      // No explicit validation needed, user can continue without goals
    } else if (currentStep === 5) { // Old step 4: Clinical Summary & Plan
      if (!reportData.clinical_summary.trim() || !reportData.ongoing_plan.trim()) {
        toast.error("Please provide both a clinical summary and an ongoing plan.");
        return;
      }
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

  const handleToggleHistoricGoal = (goalId) => {
    setSelectedHistoricGoalIds(prev => 
      prev.includes(goalId) 
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleLoadSelectedGoals = () => {
    const selectedGoals = historicGoals.filter(g => selectedHistoricGoalIds.includes(g.id));
    
    if (selectedGoals.length === 0) {
      toast.error("Please select at least one goal");
      return;
    }

    const newGoals = selectedGoals.map(g => ({
      goal: g.goal,
      date_assessed: todayLocal(),
      status: "not_met",
      outcome_notes: ""
    }));

    setReportData(prev => ({
      ...prev,
      treatment_goals: [...prev.treatment_goals, ...newGoals]
    }));

    setSelectedHistoricGoalIds([]);
    toast.success(`${selectedGoals.length} goal(s) added`);
  };

  const addNewGoal = () => {
    setReportData(prev => ({
      ...prev,
      treatment_goals: [...prev.treatment_goals, {
        goal: "",
        date_assessed: todayLocal(),
        status: "not_met",
        outcome_notes: ""
      }]
    }));
  };

  const removeGoal = (index) => {
    setReportData(prev => ({
      ...prev,
      treatment_goals: prev.treatment_goals.filter((_, i) => i !== index)
    }));
  };

  const updateGoal = (index, field, value) => {
    setReportData(prev => ({
      ...prev,
      treatment_goals: prev.treatment_goals.map((goal, i) => 
        i === index ? { ...goal, [field]: value } : goal
      )
    }));
  };

  const buildAssessmentResultsTable = () => {
    const selectedAssessments = clientData.assessments.filter(ca => selectedAssessmentIds.includes(ca.id));
    
    if (selectedAssessments.length === 0) {
      setReportData(prev => ({ ...prev, assessment_results: [] }));
      return;
    }

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

    const assessmentResults = [];
    Object.values(assessmentsByType).forEach(assessmentGroup => {
      assessmentGroup.results.sort((a, b) => 
        (a.assessment_date_sortable || 0) - (b.assessment_date_sortable || 0)
      );
      
      const initial = assessmentGroup.results[0];
      const current = assessmentGroup.results[assessmentGroup.results.length - 1];
      
      let changeText = '';
      if (initial.result_value && current.result_value && 
          !isNaN(Number(initial.result_value)) && !isNaN(Number(current.result_value))) {
        const initialVal = Number(initial.result_value);
        const currentVal = Number(current.result_value);
        const change = currentVal - initialVal;
        const percentChange = initialVal !== 0 ? ((change / initialVal) * 100).toFixed(1) : 'N/A';
        
        if (change > 0) {
          changeText = `+${change.toFixed(1)}${assessmentGroup.unit ? ' ' + assessmentGroup.unit : ''}${percentChange !== 'N/A' ? ` (+${percentChange}%)` : ''}`;
        } else if (change < 0) {
          changeText = `${change.toFixed(1)}${assessmentGroup.unit ? ' ' + assessmentGroup.unit : ''}${percentChange !== 'N/A' ? ` (${percentChange}%)` : ''}`;
        } else {
          changeText = 'No change';
        }
      } else {
        changeText = '-';
      }

      assessmentResults.push({
        name: assessmentGroup.name,
        initial_result: initial.result_value,
        initial_date: initial.assessment_date_formatted,
        current_result: current.result_value,
        current_date: current.assessment_date_formatted,
        change: changeText,
        unit: assessmentGroup.unit,
        normative: current.normative_comparison ? current.normative_comparison.replace(/_/g, ' ') : '-',
        notes: current.notes || ''
      });
    });

    setReportData(prev => ({ ...prev, assessment_results: assessmentResults }));
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      // Ensure assessment results are up-to-date before generating summary
      buildAssessmentResultsTable();

      const prompt = `You are an expert Exercise Physiologist writing a Progress Report for a private health client.

Client: ${client.full_name}
Presenting Conditions: ${JSON.stringify(clientData.conditions, null, 2)}
Sessions Completed: ${reportData.total_sessions}
Period: ${reportData.period_start} to ${reportData.period_end}
Assessment Results: ${JSON.stringify(reportData.assessment_results, null, 2)}
Treatment Goals: ${JSON.stringify(reportData.treatment_goals, null, 2)}

Write a comprehensive "Clinical Summary" section (3-4 paragraphs) that:
1. Summarizes the client's engagement and attendance
2. Discusses progress in assessment results and functional improvements
3. Addresses progress toward treatment goals
4. Highlights any barriers or challenges encountered

Use professional clinical language suitable for a GP or specialist.
Return clean HTML using only <p>, <ul>, <li>, and <strong> tags — no markdown, no code fences, no newline characters.`;

      const summary = await InvokeLLM({ prompt });
      setReportData(prev => ({ ...prev, clinical_summary: summary }));
      toast.success("Clinical summary generated!");

      // Generate ongoing plan
      const planPrompt = `You are an expert Exercise Physiologist writing a Progress Report.

Based on the clinical summary you just wrote:
${summary}

Write a concise "Ongoing Management Plan" section (2-3 paragraphs) that:
1. Recommends continuation or modification of exercise therapy
2. Suggests session frequency and duration
3. Outlines any additional referrals or investigations needed
4. Provides a timeframe for next review

Be specific and actionable for the referring practitioner.
Return clean HTML using only <p>, <ul>, <li>, and <strong> tags — no markdown, no code fences, no newline characters.`;

      const plan = await InvokeLLM({ prompt: planPrompt });
      setReportData(prev => ({ ...prev, ongoing_plan: plan }));
      toast.success("Management plan generated!");

    } catch (error) {
      console.error("Error generating content:", error);
      toast.error("Failed to generate report sections");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTidySummary = async () => {
    if (!reportData.clinical_summary.trim()) {
      toast.error("Please generate content first");
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = `Please tidy and improve the following clinical summary for a progress report. Make it more professional and well-structured.

Return clean HTML using only <p>, <ul>, <li>, and <strong> tags — no markdown, no code fences, no commentary.

${reportData.clinical_summary}`;

      const tidied = await InvokeLLM({ prompt });
      setReportData(prev => ({ ...prev, clinical_summary: tidied }));
      toast.success("Summary tidied!");
    } catch (error) {
      console.error("Error tidying summary:", error);
      toast.error("Failed to tidy summary");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTidyPlan = async () => {
    if (!reportData.ongoing_plan.trim()) {
      toast.error("Please generate content first");
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = `Please tidy and improve the following ongoing management plan. Make it more professional and well-structured.

Return clean HTML using only <p>, <ul>, <li>, and <strong> tags — no markdown, no code fences, no commentary.

${reportData.ongoing_plan}`;

      const tidied = await InvokeLLM({ prompt });
      setReportData(prev => ({ ...prev, ongoing_plan: tidied }));
      toast.success("Plan tidied!");
    } catch (error) {
      console.error("Error tidying plan:", error);
      toast.error("Failed to tidy plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveReport = async () => {
    setIsSaving(true);
    try {
      // Add selected location ID to report data
      const dataToSave = {
        ...reportData,
        clinic_location_id: selectedLocation?.id || null
      };

      if (editingReport) {
        await ClientReport.update(editingReport.id, {
          report_data: dataToSave,
          html_content: printRef.current?.outerHTML || ""
        });
        toast.success("Report updated successfully!");
        onClose(); // Close the modal after updating
      } else {
        await ClientReport.create({
          client_id: client.id,
          report_type: "private_health_progress",
          report_name: `Private Health Progress Report - ${format(new Date(), 'dd/MM/yyyy')}`,
          report_date: todayLocal(),
          report_data: dataToSave,
          html_content: printRef.current?.outerHTML || ""
        });
        toast.success("Report saved to client file successfully!");
        onClose(); // Close the modal after saving new report
      }
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Failed to save report.");
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
      // Fallback for pop-up blockers: directly print current document body
      const originalContent = document.body.innerHTML;
      document.body.innerHTML = printRef.current.outerHTML;
      window.print();
      document.body.innerHTML = originalContent; // Restore original content
      window.location.reload(); // Refresh to ensure full functionality
      return;
    }

    try {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Private Health Progress Report - ${client.full_name}</title>
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
      toast.error("Failed to open print dialog.");
      if (printWindow) printWindow.close();
    }
  };

  // Create a combined clinician object for the PrintableReport component
  const clinicianForPrint = useMemo(() => {
    if (!clinician) return null;
    if (!selectedLocation) return clinician; // Fallback to main clinician if no location selected or default

    return {
      ...clinician,
      clinic_name: selectedLocation.name || clinician.clinic_name,
      clinic_address: selectedLocation.address || clinician.clinic_address,
      clinic_phone: selectedLocation.phone || clinician.clinic_phone,
      clinic_email: selectedLocation.email || clinician.clinic_email,
      clinic_logo_url: selectedLocation.logo_url || clinician.clinic_logo_url,
    };
  }, [clinician, selectedLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentReportDataForPrint = reportData;

  return (
    <>
      <Toaster position="top-center" richColors />
      
      {/* Hidden printable version */}
      <div className="hidden">
        <PrintableReport 
          ref={printRef}
          reportData={currentReportDataForPrint}
          client={client}
          clinician={clinicianForPrint} // Use the combined object here
        />
      </div>

      <div className="space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-6">
          {stepTitles.map((title, index) => (
            <div key={index} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index === currentStep 
                  ? 'bg-blue-600 text-white' 
                  : index < currentStep 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {index < currentStep ? '✓' : index + 1}
              </div>
              {index < stepTitles.length - 1 && (
                <div className={`w-12 h-1 ${index < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-slate-900">{stepTitles[currentStep]}</h3>

        {/* Step 0: Select Location */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <Label>Select Clinic Location *</Label>
              <RadioGroup
                value={selectedLocation?.id}
                onValueChange={(value) => {
                  const loc = locations.find(l => l.id === value);
                  setSelectedLocation(loc);
                }}
                className="mt-2 space-y-2"
              >
                {locations.length > 0 ? (
                  locations.map((loc) => (
                    <div key={loc.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={loc.id} id={loc.id} />
                      <Label htmlFor={loc.id} className="cursor-pointer">
                        {loc.name} ({loc.address ? loc.address.split(',')[0] : 'No address specified'})
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No clinic locations found for your account. Please set up locations in your profile.</p>
                )}
              </RadioGroup>
            </div>

            {selectedLocation && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900">Selected Location Details</h4>
                <p><strong>Name:</strong> {selectedLocation.name}</p>
                <p><strong>Address:</strong> {selectedLocation.address}</p>
                <p><strong>Phone:</strong> {selectedLocation.phone}</p>
                <p><strong>Email:</strong> {selectedLocation.email}</p>
                {selectedLocation.logo_url && (
                  <img src={selectedLocation.logo_url} alt="Clinic Logo" className="max-w-[100px] max-h-[50px] mt-2" />
                )}
              </div>
            )}

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleNext}
                disabled={!selectedLocation}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Select Recipient (was Step 0) */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <Label>Who is this report for? *</Label>
              <RadioGroup
                value={reportData.recipient_type}
                onValueChange={(value) => {
                  setReportData(prev => {
                    if (value === 'gp') {
                      return {
                        ...prev,
                        recipient_type: value,
                        recipient_name: client.primary_gp_name || "",
                        recipient_clinic: client.primary_gp_clinic_name || "",
                        recipient_address: client.primary_gp_address || ""
                      };
                    } else {
                      return {
                        ...prev,
                        recipient_type: value,
                        recipient_name: client.specialist_name || "",
                        recipient_clinic: client.specialist_clinic_name || "",
                        recipient_address: client.specialist_address || ""
                      };
                    }
                  });
                }}
                className="mt-2 space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gp" id="gp" />
                  <Label htmlFor="gp" className="cursor-pointer">General Practitioner (GP)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specialist" id="specialist" />
                  <Label htmlFor="specialist" className="cursor-pointer">Specialist</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900">
                {reportData.recipient_type === 'gp' ? 'GP Details' : 'Specialist Details'}
              </h4>
              
              <div>
                <Label htmlFor="recipient_name">Name *</Label>
                <Input
                  id="recipient_name"
                  value={reportData.recipient_name}
                  onChange={(e) => setReportData(prev => ({ ...prev, recipient_name: e.target.value }))}
                  placeholder={reportData.recipient_type === 'gp' ? "Dr. John Smith" : "Dr. Jane Doe"}
                />
              </div>

              <div>
                <Label htmlFor="recipient_clinic">Clinic/Practice Name</Label>
                <Input
                  id="recipient_clinic"
                  value={reportData.recipient_clinic}
                  onChange={(e) => setReportData(prev => ({ ...prev, recipient_clinic: e.target.value }))}
                  placeholder="Practice name"
                />
              </div>

              <div>
                <Label htmlFor="recipient_address">Address</Label>
                <Textarea
                  id="recipient_address"
                  value={reportData.recipient_address}
                  onChange={(e) => setReportData(prev => ({ ...prev, recipient_address: e.target.value }))}
                  placeholder="Full practice address"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext}
                disabled={!reportData.recipient_name.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Session Summary (was Step 1) */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="period_start">Period Start Date *</Label>
                <Input
                  id="period_start"
                  type="date"
                  value={reportData.period_start}
                  onChange={(e) => setReportData(prev => ({ ...prev, period_start: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="period_end">Period End Date *</Label>
                <Input
                  id="period_end"
                  type="date"
                  value={reportData.period_end}
                  onChange={(e) => setReportData(prev => ({ ...prev, period_end: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="total_sessions">Total Sessions Completed *</Label>
                <Input
                  id="total_sessions"
                  type="number"
                  value={reportData.total_sessions}
                  onChange={(e) => setReportData(prev => ({ ...prev, total_sessions: e.target.value }))}
                  placeholder="e.g., 12"
                />
              </div>

              <div>
                <Label htmlFor="attendance_rate">Session Attendance *</Label>
                <Input
                  id="attendance_rate"
                  value={reportData.attendance_rate}
                  onChange={(e) => setReportData(prev => ({ ...prev, attendance_rate: e.target.value }))}
                  placeholder="e.g., Twice weekly, 80%"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="attendance_notes">Attendance Notes</Label>
              <Textarea
                id="attendance_notes"
                value={reportData.attendance_notes}
                onChange={(e) => setReportData(prev => ({ ...prev, attendance_notes: e.target.value }))}
                placeholder="Any notes about attendance, adherence, or engagement (optional)"
                rows={3}
              />
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext}
                disabled={!reportData.total_sessions || !reportData.attendance_rate}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Select Assessments (was Step 2) */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Select assessments to include in the progress report</p>
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
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {clientData.assessments.map((assessment) => (
                  <div key={assessment.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-slate-50">
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
                        Date: {assessment.assessment_date_formatted} | 
                        Result: {assessment.result_value} {assessment.unit_of_measure}
                      </p>
                      {assessment.normative_comparison && (
                        <p className="text-xs text-slate-500">
                          {assessment.normative_comparison.replace(/_/g, ' ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">No completed assessments found.</p>
            )}

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue with Selected ({selectedAssessmentIds.length})
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Treatment Goals & Progress (was Step 3) */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {/* Historic Goals */}
            {historicGoals.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3">Goals from Previous Reports:</h4>
                <p className="text-sm text-blue-700 mb-3">Select goals to track progress</p>
                
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                  {historicGoals.map(goal => (
                    <div key={goal.id} className="flex items-start space-x-3 p-2 bg-white rounded">
                      <Checkbox
                        id={`historic-${goal.id}`}
                        checked={selectedHistoricGoalIds.includes(goal.id)}
                        onCheckedChange={() => handleToggleHistoricGoal(goal.id)}
                      />
                      <div className="flex-1">
                        <Label htmlFor={`historic-${goal.id}`} className="cursor-pointer text-sm">
                          {goal.goal}
                        </Label>
                        <p className="text-xs text-slate-500">
                          From: {goal.reportName} ({format(new Date(goal.reportDate), 'dd/MM/yyyy')})
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={handleLoadSelectedGoals}
                  disabled={selectedHistoricGoalIds.length === 0}
                  size="sm"
                  variant="outline"
                >
                  Load Selected Goals ({selectedHistoricGoalIds.length})
                </Button>
              </div>
            )}

            {/* Current Goals */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-900">Treatment Goals & Progress</h4>
                <Button onClick={addNewGoal} size="sm" variant="outline">
                  + Add New Goal
                </Button>
              </div>

              {reportData.treatment_goals.length > 0 ? (
                <div className="space-y-4">
                  {reportData.treatment_goals.map((goal, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-white space-y-3">
                      <div className="flex items-start justify-between">
                        <h5 className="font-medium text-slate-900">Goal {index + 1}:</h5>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeGoal(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </Button>
                      </div>

                      <div>
                        <Label>Goal Description *</Label>
                        <Textarea
                          value={goal.goal}
                          onChange={(e) => updateGoal(index, 'goal', e.target.value)}
                          placeholder="e.g., Improve mobility to walk 500m without pain"
                          rows={2}
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label>Date Assessed</Label>
                          <Input
                            type="date"
                            value={goal.date_assessed}
                            onChange={(e) => updateGoal(index, 'date_assessed', e.target.value)}
                          />
                        </div>

                        <div>
                          <Label>Status *</Label>
                          <RadioGroup
                            value={goal.status}
                            onValueChange={(value) => updateGoal(index, 'status', value)}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="not_met" id={`not_met_${index}`} />
                              <Label htmlFor={`not_met_${index}`} className="cursor-pointer">Not Met</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="ongoing" id={`ongoing_${index}`} />
                              <Label htmlFor={`ongoing_${index}`} className="cursor-pointer">Ongoing</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="completely_achieved" id={`achieved_${index}`} />
                              <Label htmlFor={`achieved_${index}`} className="cursor-pointer">Completely Achieved</Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>

                      <div>
                        <Label>Progress Notes</Label>
                        <Textarea
                          value={goal.outcome_notes}
                          onChange={(e) => updateGoal(index, 'outcome_notes', e.target.value)}
                          placeholder="Comments on progress toward this goal"
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">
                  No goals added yet. Load from previous reports or add new goals.
                </p>
              )}
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Clinical Summary & Plan (was Step 4) */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="flex gap-3 mb-4">
              <Button
                onClick={handleGenerateSummary}
                disabled={isGenerating}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> AI Generate Both Sections</>
                )}
              </Button>
            </div>

            {/* Clinical Summary */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="clinical_summary">Clinical Summary *</Label>
                <Button
                  onClick={handleTidySummary}
                  disabled={isGenerating || !reportData.clinical_summary.trim()}
                  variant="outline"
                  size="sm"
                >
                  <Sparkles className="w-3 h-3 mr-2" />
                  AI Tidy
                </Button>
              </div>
              <RichTextEditor
                value={reportData.clinical_summary}
                onChange={(value) => setReportData(prev => ({ ...prev, clinical_summary: value }))}
                placeholder="Summary of client's progress, engagement, and outcomes..."
              />
            </div>

            {/* Ongoing Management Plan */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="ongoing_plan">Ongoing Management Plan *</Label>
                <Button
                  onClick={handleTidyPlan}
                  disabled={isGenerating || !reportData.ongoing_plan.trim()}
                  variant="outline"
                  size="sm"
                >
                  <Sparkles className="w-3 h-3 mr-2" />
                  AI Tidy
                </Button>
              </div>
              <RichTextEditor
                value={reportData.ongoing_plan}
                onChange={(value) => setReportData(prev => ({ ...prev, ongoing_plan: value }))}
                placeholder="Recommendations for ongoing treatment, session frequency, and next review..."
              />
            </div>

            {/* Additional Notes */}
            <div>
              <Label htmlFor="additional_notes">Additional Notes (Optional)</Label>
              <Textarea
                id="additional_notes"
                value={reportData.additional_notes}
                onChange={(e) => setReportData(prev => ({ ...prev, additional_notes: e.target.value }))}
                placeholder="Any other relevant information..."
                rows={3}
              />
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext}
                disabled={!reportData.clinical_summary.trim() || !reportData.ongoing_plan.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue to Review
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Review & Print (was Step 5) */}
        {currentStep === 6 && (
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
                    <Label htmlFor="edit_recipient_name">Recipient Name</Label>
                    <Input
                      id="edit_recipient_name"
                      value={reportData.recipient_name || ""}
                      onChange={(e) => setReportData(prev => ({ ...prev, recipient_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_recipient_clinic">Recipient Clinic</Label>
                    <Input
                      id="edit_recipient_clinic"
                      value={reportData.recipient_clinic || ""}
                      onChange={(e) => setReportData(prev => ({ ...prev, recipient_clinic: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit_recipient_address">Recipient Address</Label>
                  <Textarea
                    id="edit_recipient_address"
                    value={reportData.recipient_address || ""}
                    onChange={(e) => setReportData(prev => ({ ...prev, recipient_address: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="edit_letter_date">Letter Date</Label>
                    <Input
                      id="edit_letter_date"
                      type="date"
                      value={reportData.letter_date || ""}
                      onChange={(e) => setReportData(prev => ({ ...prev, letter_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_period_start">Period Start</Label>
                    <Input
                      id="edit_period_start"
                      type="date"
                      value={reportData.period_start || ""}
                      onChange={(e) => setReportData(prev => ({ ...prev, period_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_period_end">Period End</Label>
                    <Input
                      id="edit_period_end"
                      type="date"
                      value={reportData.period_end || ""}
                      onChange={(e) => setReportData(prev => ({ ...prev, period_end: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_total_sessions">Total Sessions Completed</Label>
                    <Input
                      id="edit_total_sessions"
                      value={reportData.total_sessions || ""}
                      onChange={(e) => setReportData(prev => ({ ...prev, total_sessions: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_attendance_rate">Session Attendance</Label>
                    <Input
                      id="edit_attendance_rate"
                      value={reportData.attendance_rate || ""}
                      onChange={(e) => setReportData(prev => ({ ...prev, attendance_rate: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Clinical Summary</Label>
                  <RichTextEditor
                    value={reportData.clinical_summary}
                    onChange={(value) => setReportData(prev => ({ ...prev, clinical_summary: value }))}
                  />
                </div>

                <div>
                  <Label>Ongoing Management Plan</Label>
                  <RichTextEditor
                    value={reportData.ongoing_plan}
                    onChange={(value) => setReportData(prev => ({ ...prev, ongoing_plan: value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="edit_additional_notes">Additional Notes</Label>
                  <Textarea
                    id="edit_additional_notes"
                    value={reportData.additional_notes || ""}
                    onChange={(e) => setReportData(prev => ({ ...prev, additional_notes: e.target.value }))}
                    rows={3}
                  />
                </div>

                <p className="text-xs text-slate-500">
                  Assessment results and treatment goals are edited on their own steps — use Back to reach them. All other keys of the saved report are preserved unchanged.
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 max-h-[60vh] overflow-y-auto">
                <div className="prose max-w-none">
                  <PrintableReport 
                    reportData={currentReportDataForPrint}
                    client={client}
                    clinician={clinicianForPrint}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Edit
              </Button>
              <div className="flex gap-3">
                {!editingReport && (
                  <Button 
                    onClick={() => {
                      setCurrentStep(0);
                      setReportData(prev => ({
                        ...prev,
                        clinical_summary: "",
                        ongoing_plan: "",
                        additional_notes: ""
                      })); // Clear generated content
                      setIsEditing(false);
                    }} 
                    variant="outline"
                  >
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