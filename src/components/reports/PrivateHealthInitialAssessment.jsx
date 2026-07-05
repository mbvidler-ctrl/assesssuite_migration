import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ClientCondition, ClientAssessment, Assessment, User, ClientReport } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import { ChevronLeft, ChevronRight, Loader2, Printer, Sparkles, Save, Edit, X } from "lucide-react";
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
        <h1>Private Health Initial Assessment Report</h1>
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
          Thank you for referring {client.full_name} for exercise physiology assessment and management. 
          I am writing to provide you with a comprehensive initial assessment report following their attendance at our clinic.
        </p>

        {/* Client Demographics */}
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
        {client.emergency_contact_name && (
          <div className="info-item" style={{marginTop: '0.5em'}}>
            <strong>Emergency Contact:</strong> {client.emergency_contact_name}
            {client.emergency_contact_phone && ` - ${client.emergency_contact_phone}`}
          </div>
        )}

        {/* Referral Information */}
        {(reportData.referral_reason || reportData.referral_date) && (
          <>
            <div className="section-heading">Referral Information</div>
            {reportData.referral_date && <p><strong>Referral Date:</strong> {formatDate(reportData.referral_date)}</p>}
            {reportData.referral_reason && <p><strong>Reason for Referral:</strong> {reportData.referral_reason}</p>}
          </>
        )}

        {/* Presenting Conditions */}
        {reportData.conditions && reportData.conditions.length > 0 && (
          <>
            <div className="section-heading">Presenting Conditions</div>
            <table>
              <thead>
                <tr>
                  <th>Condition</th>
                  <th>Type</th>
                  <th>Medication</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {reportData.conditions.map((condition, index) => (
                  <tr key={index}>
                    <td>{condition.condition_name}</td>
                    <td>{condition.condition_type === 'primary' ? 'Primary' : 'Comorbidity'}</td>
                    <td>{condition.medication || '-'}</td>
                    <td>{condition.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Medications */}
        {reportData.medications && reportData.medications.length > 0 && (
          <>
            <div className="section-heading">Current Medications</div>
            <ul>
              {reportData.medications.map((med, index) => (
                <li key={index}>{med}</li>
              ))}
            </ul>
          </>
        )}

        {/* Client Goals */}
        {reportData.client_goals && (
          <>
            <div className="section-heading">Client Goals</div>
            <p>{reportData.client_goals}</p>
          </>
        )}

        {/* Baseline Measures */}
        {reportData.baseline_measures && (
          <>
            <div className="section-heading">Baseline Measures</div>
            <div className="info-grid">
              {reportData.baseline_measures.bp && (
                <div className="info-item"><strong>Blood Pressure:</strong> {reportData.baseline_measures.bp}</div>
              )}
              {reportData.baseline_measures.hr && (
                <div className="info-item"><strong>Heart Rate:</strong> {reportData.baseline_measures.hr}</div>
              )}
              {reportData.baseline_measures.spo2 && (
                <div className="info-item"><strong>SpO₂:</strong> {reportData.baseline_measures.spo2}</div>
              )}
              {reportData.baseline_measures.bmi && (
                <div className="info-item"><strong>BMI:</strong> {reportData.baseline_measures.bmi}</div>
              )}
            </div>
          </>
        )}

        {/* Assessment Results */}
        {reportData.assessment_results && reportData.assessment_results.length > 0 && (
          <>
            <div className="section-heading">Functional Assessment Results</div>
            <table>
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Result</th>
                  <th>Date</th>
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {reportData.assessment_results.map((assessment, index) => (
                  <React.Fragment key={index}>
                    <tr>
                      <td><strong>{assessment.name}</strong></td>
                      <td>{assessment.result || '-'} {assessment.unit || ''}</td>
                      <td>{assessment.date || '-'}</td>
                      <td>{assessment.normative || '-'}</td>
                    </tr>
                    {assessment.notes && (
                      <tr>
                        <td colSpan="4" style={{backgroundColor: '#f8fafc', fontSize: '9pt', fontStyle: 'italic'}}>
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

        {/* Treatment Goals */}
        {reportData.treatment_goals && reportData.treatment_goals.length > 0 && (
          <>
            <div className="section-heading">Treatment Goals</div>
            <table>
              <thead>
                <tr>
                  <th>Goal</th>
                  <th>Target Date</th>
                </tr>
              </thead>
              <tbody>
                {reportData.treatment_goals.map((goal, index) => (
                  <tr key={index}>
                    <td>{goal.goal}</td>
                    <td>{goal.target_date ? formatDate(goal.target_date) : 'Ongoing'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Clinical Interpretation */}
        {reportData.clinical_interpretation && (
          <>
            <div className="section-heading">Clinical Interpretation</div>
            <div dangerouslySetInnerHTML={{ __html: reportData.clinical_interpretation.replace(/\n/g, '<br />') }} />
          </>
        )}

        {/* Proposed Management Plan (now accepts treatment_plan too) */}
        {(reportData.management_plan || reportData.treatment_plan) && (
          <>
            <div className="section-heading">Proposed Management Plan</div>
            <div dangerouslySetInnerHTML={{ __html: (reportData.management_plan || reportData.treatment_plan).replace(/\n/g, '<br />') }} />
          </>
        )}

        {/* Session Details */}
        {(reportData.session_frequency || reportData.session_duration || reportData.program_duration) && (
          <>
            <div className="section-heading">Proposed Session Details</div>
            {reportData.session_frequency && <p><strong>Frequency:</strong> {reportData.session_frequency}</p>}
            {reportData.session_duration && <p><strong>Session Duration:</strong> {reportData.session_duration}</p>}
            {reportData.program_duration && <p><strong>Program Duration:</strong> {reportData.program_duration}</p>}
          </>
        )}

        {/* Additional Notes */}
        {reportData.additional_notes && (
          <>
            <div className="section-heading">Additional Notes</div>
            <p>{reportData.additional_notes}</p>
          </>
        )}
        
        {/* Recommendations - display if present */}
        {reportData.recommendations && (
          <>
            <div className="section-heading">Recommendations</div>
            <div dangerouslySetInnerHTML={{ __html: reportData.recommendations.replace(/\n/g, '<br />') }} />
          </>
        )}

        {/* Closing */}
        <p style={{marginTop: '2em'}}>
          I trust this information is of value. Please do not hesitate to contact me should you require any further information or clarification.
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

export default function PrivateHealthInitialAssessment({ client, onClose, editingReport }) {
  const [currentStep, setCurrentStep] = useState(0); 
  const [isLoading, setIsLoading] = useState(true);
  const [rawClinicianData, setRawClinicianData] = useState(null); // Original clinician data from DB
  const [clinicianForPrint, setClinicianForPrint] = useState(null); // Clinician data adjusted for selected location for printing
  const [selectedLocation, setSelectedLocation] = useState(null); // The actual selected location object
  const [locations, setLocations] = useState([]); // List of all available locations for clinician
  const [clientData, setClientData] = useState({ conditions: [], assessments: [] });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState([]);
  const [historicGoals, setHistoricGoals] = useState([]);
  const [selectedHistoricGoalIds, setSelectedHistoricGoalIds] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  const [reportData, setReportData] = useState(() => {
    const baseReport = {
      recipient_type: "primary_gp", // Default to primary GP
      recipient_name: client.primary_gp_name || "",
      recipient_clinic: client.primary_gp_clinic_name || "",
      recipient_address: client.primary_gp_address || "",
      letter_date: new Date().toISOString().split('T')[0],
      referral_date: client.referral_date || "",
      referral_reason: client.referral_reason || "",
      conditions: [], // Array of ClientCondition objects
      medications: [], // Array of strings
      client_goals: client.client_goals || "", // Single string
      baseline_measures: {
        bp: "",
        hr: "",
        spo2: "",
        bmi: ""
      },
      assessment_results: [], // Array of objects for specific assessments
      treatment_goals: [], // Array of objects {goal: string, target_date: string}
      clinical_interpretation: "", // String
      management_plan: "", // String (originally used, now `treatment_plan` also maps here for display)
      session_frequency: "",
      program_duration: "",
      additional_notes: "",
      clinic_location_id: null, // New field to store the selected location's ID
      // NEW FIELDS added based on outline's AI generation and conceptual structure
      client_demographics: "",
      presenting_conditions: "", // String summary
      assessment_findings: "", // String summary
      treatment_plan: "", // New string field, AI generated (maps to management_plan for display)
      goals_objectives: "", // New string field, AI generated summary
      recommendations: ""
    };

    if (editingReport && editingReport.report_data) {
      const cleanData = { ...baseReport, ...editingReport.report_data };
      
      // Clean conditions array if it exists
      if (cleanData.conditions && Array.isArray(cleanData.conditions)) {
        cleanData.conditions = cleanData.conditions.map(c => ({
          condition_name: c.condition_name || '',
          condition_type: c.condition_type || '',
          medication: c.medication || '',
          diagnosis_date: c.diagnosis_date || '',
          notes: c.notes || ''
        }));
      }
      
      // Clean medications array if it exists
      if (cleanData.medications && Array.isArray(cleanData.medications)) {
        cleanData.medications = cleanData.medications.map(m => 
          typeof m === 'string' ? m : m.medication || m.name || ''
        ).filter(m => m);
      }
      
      // If an old report had prognosis, ensure it's not carried forward in the data model
      // eslint-disable-next-line no-unused-vars
      const { prognosis, ...dataWithoutPrognosis } = cleanData;
      return dataWithoutPrognosis;
    }
    return baseReport;
  });

  const printRef = useRef(null);

  const stepTitles = [
    "Select Location",              // New Step 0
    "Select Assessments",           // New Step 1 (was old 2)
    "Select Recipient",             // New Step 2 (was old 0)
    "Baseline Measures",            // New Step 3 (was old 1)
    "Treatment Goals",              // New Step 4 (was old 3)
    "Clinical Interpretation & Plan", // New Step 5 (was old 4)
    "Session Details",              // New Step 6 (was old 5)
    "Review & Print"                // New Step 7 (was old 6)
  ];

  // Add helper functions at component level too
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

  useEffect(() => {
    const initializeReport = async () => {
      await loadInitialData(); 
      if (editingReport) {
        // If editing an existing report, jump directly to the review step (index 7)
        setCurrentStep(7);
        setIsEditing(true); // Automatically enter edit mode for existing reports
      } else {
        // For a new report, start at the first step (Select Location)
        setCurrentStep(0);
      }
    };
    initializeReport();
  }, [client.id, editingReport]); // dependency array ensures re-run on client or editingReport change

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const currentClinician = await User.me();
      setRawClinicianData(currentClinician); // Store the raw clinician data

      const locs = currentClinician.locations || [];
      setLocations(locs);

      let initialSelectedLoc = null;
      if (editingReport && editingReport.report_data?.clinic_location_id) {
        initialSelectedLoc = locs.find(l => l.id === editingReport.report_data.clinic_location_id);
      }
      if (!initialSelectedLoc && locs.length > 0) {
        initialSelectedLoc = locs.find(l => l.is_main) || locs[0];
      }
      
      // Prepare the clinician object that will be passed to PrintableReport
      let clinicianToUseForPrint = { ...currentClinician }; // Start with raw data

      if (initialSelectedLoc) {
        setSelectedLocation(initialSelectedLoc);
        setReportData(prev => ({
          ...prev,
          clinic_location_id: initialSelectedLoc.id
        }));
        // Merge selected location details into the clinician object for print
        clinicianToUseForPrint = {
          ...currentClinician,
          clinic_name: initialSelectedLoc.name,
          clinic_address: initialSelectedLoc.address,
          clinic_phone: initialSelectedLoc.phone,
          clinic_email: initialSelectedLoc.email,
          clinic_logo_url: initialSelectedLoc.logo_url || currentClinician.profile_image_url,
        };
      }
      setClinicianForPrint(clinicianToUseForPrint); // Set the clinician object for printing

      // Load client-specific data
      const [conditions, clientAssessments, allAssessments] = await Promise.all([
        ClientCondition.filter({ client_id: client.id }),
        ClientAssessment.filter({ client_id: client.id, status: "completed" }),
        Assessment.list()
      ]);

      const assessmentMap = new Map(allAssessments.map(a => [a.id, a]));
      const enrichedAssessments = clientAssessments.map(ca => ({
        ...ca,
        name: assessmentMap.get(ca.assessment_id)?.name || 'Unknown',
        unit_of_measure: assessmentMap.get(ca.assessment_id)?.unit_of_measure || '',
        assessment_date_formatted: ca.assessment_date ? format(new Date(ca.assessment_date), 'dd/MM/yyyy') : 'N/A',
        assessment_date_sortable: ca.assessment_date ? new Date(ca.assessment_date) : null
      }));

      setClientData({ conditions, assessments: enrichedAssessments });

      if (editingReport) {
        // reportData is already initialized with cleaned data from editingReport
        // Ensure medications are populated from conditions for consistency in editing UI
        const medicationsFromReport = reportData.conditions
          .filter(c => c.medication && c.medication.trim())
          .map(c => c.medication);
        
        setReportData(prev => ({
          ...prev,
          medications: medicationsFromReport
        }));
        
      } else {
        setSelectedAssessmentIds(enrichedAssessments.map(a => a.id));

        const medications = conditions
          .filter(c => c.medication && c.medication.trim())
          .map(c => c.medication);

        setReportData(prev => ({
          ...prev,
          conditions: conditions,
          medications: medications,
          // Populate `presenting_conditions` string with a summary or first condition
          presenting_conditions: conditions.length > 0 
            ? conditions.map(c => c.condition_name).join(', ') 
            : ""
        }));

        extractGoalsFromOnboarding();
      }

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load client data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setReportData(prev => ({
      ...prev,
      clinic_location_id: location.id // Save selected location ID in reportData
    }));

    // Update the clinician object used for printing with selected location's details
    if (rawClinicianData) {
      setClinicianForPrint({
        ...rawClinicianData, // Use the raw clinician data as base
        clinic_name: location.name,
        clinic_address: location.address,
        clinic_phone: location.phone,
        clinic_email: location.email,
        clinic_logo_url: location.logo_url || rawClinicianData.profile_image_url,
      });
    }
  };

  const extractGoalsFromOnboarding = () => {
    const goals = [];
    let goalIdCounter = 0;

    if (client.client_goals) {
      const goalLines = client.client_goals.split('\n').filter(line => line.trim());
      goalLines.forEach(goal => {
        goals.push({
          id: `goal-${goalIdCounter++}`,
          goal: goal.trim(),
          source: "Client Onboarding"
        });
      });
    }

    setHistoricGoals(goals);
  };

  const handleNext = () => {
    if (currentStep === 0) { // Select Location step
      if (!selectedLocation) {
        toast.error("Please select a location.");
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
      target_date: ""
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
        target_date: ""
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
    
    // Sort assessments by date, most recent first
    selectedAssessments.sort((a, b) => {
      if (!a.assessment_date_sortable && !b.assessment_date_sortable) return 0;
      if (!a.assessment_date_sortable) return 1;
      if (!b.assessment_date_sortable) return -1;
      return b.assessment_date_sortable.getTime() - a.assessment_date_sortable.getTime();
    });

    if (selectedAssessments.length === 0) return;

    const assessmentResults = selectedAssessments.map(assessment => ({
      name: assessment.name,
      result: assessment.result_value,
      unit: assessment.unit_of_measure || '',
      date: assessment.assessment_date_formatted,
      normative: assessment.normative_comparison ? assessment.normative_comparison.replace(/_/g, ' ') : '-',
      notes: assessment.notes || ''
    }));

    setReportData(prev => ({ ...prev, assessment_results: assessmentResults }));
  };

  const handleAIGenerateReport = async () => {
    if (!reportData.presenting_conditions.trim() || !reportData.referral_reason.trim()) {
      toast.error("Please fill in 'Presenting Conditions' and 'Reason for Referral' before AI generation.");
      return;
    }

    setIsGenerating(true);
    try {
      const selectedAssessments = clientData.assessments.filter(ca => selectedAssessmentIds.includes(ca.id));

      const currentAssessmentResults = selectedAssessments.map(assessment => ({
        name: assessment.name,
        result: assessment.result_value,
        unit: assessment.unit_of_measure || '',
        date: assessment.assessment_date_formatted,
        normative: assessment.normative_comparison ? assessment.normative_comparison.replace(/_/g, ' ') : '-',
        notes: assessment.notes || ''
      }));

      // Clean client data for the prompt - only include necessary fields
      const cleanClientData = {
        full_name: client.full_name,
        date_of_birth: client.date_of_birth,
        gender: client.gender,
        pronouns: client.pronouns,
        age: calculateAge(client.date_of_birth)
      };

      // Clean conditions data
      const cleanConditions = clientData.conditions.map(c => ({
        condition_name: c.condition_name,
        condition_type: c.condition_type,
        medication: c.medication,
        diagnosis_date: c.diagnosis_date,
        notes: c.notes
      }));

      // Clean assessment data for the prompt
      const cleanAssessmentsForPrompt = currentAssessmentResults.map(a => ({
        name: a.name,
        date: a.date,
        result: `${a.result} ${a.unit}`.trim(),
        comparison: a.normative,
        notes: a.notes
      }));

      const interpretationPrompt = `You are an expert Exercise Physiologist writing an Initial Assessment Report for a private health client.
Client: ${cleanClientData.full_name} (DOB: ${formatDate(cleanClientData.date_of_birth)}, Age: ${cleanClientData.age}, Gender: ${cleanClientData.gender === 'other' ? client.gender_other : cleanClientData.gender || 'Not specified'})
Referral Reason: ${reportData.referral_reason}
Presenting Conditions (summary): ${reportData.presenting_conditions}
Client's Medical Conditions (detailed array): ${JSON.stringify(cleanConditions, null, 2)}
Current Medications (derived from conditions): ${cleanConditions.filter(c => c.medication && c.medication.trim()).map(c => c.medication).join(', ') || 'None reported'}
Baseline Measures: ${JSON.stringify(reportData.baseline_measures, null, 2)}
Assessment Results (from functional tests): ${JSON.stringify(cleanAssessmentsForPrompt, null, 2)}
Treatment Goals (from client & clinician): ${JSON.stringify(reportData.treatment_goals, null, 2)}

Generate comprehensive content for the following sections, ensuring each section is clearly delimited with a heading. Structure your response as JSON with keys matching the section titles:

{
  "client_demographics": "Detailed summary of client background, age, gender, and relevant social/medical history.",
  "assessment_findings": "Detailed analysis and interpretation of baseline measures and functional assessment results. Discuss patterns and significant findings.",
  "clinical_interpretation": "A comprehensive clinical interpretation (3-4 paragraphs) that: 1. Summarizes client's presenting conditions and functional limitations. 2. Discusses how findings relate to client goals. 3. Identifies key intervention areas.",
  "treatment_plan": "A detailed proposed management plan (3-4 paragraphs) that: 1. Outlines the exercise therapy approach. 2. Specifies types of exercises and interventions. 3. Describes focus areas and progression strategy. 4. Addresses contraindications or precautions.",
  "recommendations": "Any additional recommendations for the client or referring practitioner, including potential referrals or further investigations."
}

Use professional clinical language suitable for a GP or specialist.`;

      const generatedContentRaw = await InvokeLLM({ prompt: interpretationPrompt });
      let generatedContent;
      try {
        generatedContent = JSON.parse(generatedContentRaw);
        toast.success("AI content generated and parsed!");
      } catch (e) {
        console.error("Failed to parse AI generated content as JSON:", e);
        toast.error("AI generated content could not be parsed. Please check console for details.");
        setIsGenerating(false);
        return;
      }

      const finalReportData = {
        ...reportData,
        assessment_results: currentAssessmentResults.length > 0 ? currentAssessmentResults : reportData.assessment_results,
        conditions: cleanConditions,
        medications: cleanConditions.filter(c => c.medication && c.medication.trim()).map(c => c.medication),
        
        client_demographics: generatedContent.client_demographics || "",
        assessment_findings: generatedContent.assessment_findings || "",
        clinical_interpretation: generatedContent.clinical_interpretation || "",
        treatment_plan: generatedContent.treatment_plan || "", // New field
        management_plan: generatedContent.treatment_plan || reportData.management_plan, // Map AI's treatment_plan to existing management_plan for PrintableReport
        recommendations: generatedContent.recommendations || "",
      };
      
      if (!finalReportData.session_frequency) finalReportData.session_frequency = "Twice weekly";
      if (!finalReportData.session_duration) finalReportData.session_duration = "60 minutes per session";
      if (!finalReportData.program_duration) finalReportData.program_duration = "12 weeks initial program";

      setReportData(finalReportData);
      // No longer using editableContent state for editing, it's direct to reportData.

      setCurrentStep(7); // Jump to the review step
      setIsEditing(true); // Automatically switch to edit mode after AI generation

    } catch (error) {
      console.error("Error generating content:", error);
      toast.error("Failed to generate report sections");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTidyInterpretation = async () => {
    if (!reportData.clinical_interpretation.trim()) {
      toast.error("Please generate content first");
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = `Please tidy and improve the following clinical interpretation. Make it more professional and well-structured:

${reportData.clinical_interpretation}`;

      const tidied = await InvokeLLM({ prompt });
      setReportData(prev => ({ ...prev, clinical_interpretation: tidied }));
      toast.success("Interpretation tidied!");
    } catch (error) {
      console.error("Error tidying interpretation:", error);
      toast.error("Failed to tidy interpretation");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTidyPlan = async () => {
    if (!reportData.management_plan.trim() && !reportData.treatment_plan.trim()) {
      toast.error("Please generate content first");
      return;
    }

    setIsGenerating(true);
    try {
      const currentPlan = reportData.management_plan || reportData.treatment_plan;
      const prompt = `Please tidy and improve the following management plan. Make it more professional and well-structured:

${currentPlan}`;

      const tidied = await InvokeLLM({ prompt });
      setReportData(prev => ({ ...prev, management_plan: tidied, treatment_plan: tidied })); // Update both if present
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
      // With the new editing interface, changes are applied directly to reportData.
      // No need to parse editableContent.
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
          report_type: "private_health_initial",
          report_name: `Private Health Initial Assessment - ${format(new Date(), 'dd/MM/yyyy')}`,
          report_date: new Date().toISOString().split('T')[0],
          report_data: dataToSave,
          html_content: printRef.current?.innerHTML || ""
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

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error("Report content is not ready for printing.");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      // Fallback for browsers blocking pop-ups
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
          <title>Private Health Initial Assessment - ${client.full_name}</title>
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

  const handleRecipientTypeChange = (type) => {
    let recipientData = {
      recipient_type: type,
      recipient_name: "",
      recipient_clinic: "",
      recipient_address: ""
    };

    switch(type) {
      case "primary_gp":
        recipientData.recipient_name = client.primary_gp_name || "";
        recipientData.recipient_clinic = client.primary_gp_clinic_name || "";
        recipientData.recipient_address = client.primary_gp_address || "";
        break;
      case "hospital_gp":
        recipientData.recipient_name = client.hospital_gp_name || "";
        recipientData.recipient_clinic = client.hospital_name || "";
        recipientData.recipient_address = client.hospital_gp_address || "";
        break;
      case "specialist":
        recipientData.recipient_name = client.specialist_name || "";
        recipientData.recipient_clinic = client.specialist_clinic_name || "";
        recipientData.recipient_address = client.specialist_address || "";
        break;
      case "other":
        // Leave blank for manual entry
        break;
    }

    setReportData(prev => ({ ...prev, ...recipientData }));
  };

  if (isLoading || !clinicianForPrint) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      
      {/* Hidden printable report to capture HTML for saving/printing */}
      <div className="hidden">
        <PrintableReport 
          ref={printRef}
          reportData={reportData}
          client={client}
          clinician={clinicianForPrint} // Pass the prepared clinician object
        />
      </div>

      <div className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 w-full">
            {stepTitles.map((title, index) => (
              <div key={index} className="flex items-center w-auto">
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
                  <div className={`flex-grow h-1 mx-1 ${index < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-900">{stepTitles[currentStep]}</h3>

        {/* Step 0: Select Location (NEW) */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-900">Select Clinic Location</h3>
            <p className="text-sm text-slate-600">Choose the clinic location for this report.</p>

            {locations.length > 0 ? (
              <RadioGroup
                value={selectedLocation?.id || ''}
                onValueChange={(value) => handleLocationSelect(locations.find(loc => loc.id === value))}
                className="grid gap-3"
              >
                {locations.map((loc) => (
                  <div key={loc.id} className="flex items-center space-x-2 border rounded-lg p-3">
                    <RadioGroupItem value={loc.id} id={`location-${loc.id}`} />
                    <Label htmlFor={`location-${loc.id}`} className="flex-1 cursor-pointer">
                      <div className="font-medium">{loc.name} {loc.is_main && "(Main)"}</div>
                      <div className="text-sm text-slate-500">{loc.address}</div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <p className="text-center text-slate-500 py-8">No clinic locations found for your account.</p>
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

        {/* Step 1: Select Assessments (Moved from original Step 2) */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Select functional assessments performed</p>
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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">No completed assessments found.</p>
            )}

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setCurrentStep(0)}> {/* Back to new Step 0 (Location) */}
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={() => {
                  buildAssessmentResultsTable();
                  handleNext(); // Goes to new Step 2 (Select Recipient)
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue with Selected ({selectedAssessmentIds.length})
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select Recipient (Moved from original Step 0) */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Select Report Recipient</h3>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-3 block">
                  Who should this report be sent to?
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
                  <Label htmlFor="recipient_name">Recipient Name</Label>
                  <Input
                    id="recipient_name"
                    value={reportData.recipient_name}
                    onChange={(e) => setReportData(prev => ({ ...prev, recipient_name: e.target.value }))}
                    placeholder="Dr. John Smith"
                  />
                </div>

                <div>
                  <Label htmlFor="recipient_clinic">Clinic/Practice Name</Label>
                  <Input
                    id="recipient_clinic"
                    value={reportData.recipient_clinic}
                    onChange={(e) => setReportData(prev => ({ ...prev, recipient_clinic: e.target.value }))}
                    placeholder="Smith Medical Centre"
                  />
                </div>

                <div>
                  <Label htmlFor="recipient_address">Address</Label>
                  <Textarea
                    id="recipient_address"
                    value={reportData.recipient_address}
                    onChange={(e) => setReportData(prev => ({ ...prev, recipient_address: e.target.value }))}
                    placeholder="123 Main St, City, State, Postcode"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Referral Info */}
            <div className="space-y-4 pt-4 border-t">
                <div>
                    <Label htmlFor="referral_date">Referral Date</Label>
                    <Input
                        id="referral_date"
                        type="date"
                        value={reportData.referral_date}
                        onChange={(e) => setReportData(prev => ({ ...prev, referral_date: e.target.value }))}
                    />
                </div>
                <div>
                    <Label htmlFor="referral_reason">Reason for Referral *</Label>
                    <Textarea
                        id="referral_reason"
                        value={reportData.referral_reason}
                        onChange={(e) => setReportData(prev => ({ ...prev, referral_reason: e.target.value }))}
                        placeholder="e.g., General deconditioning, chronic back pain, post-op rehab"
                        rows={3}
                    />
                </div>
                <div>
                    <Label htmlFor="presenting_conditions">Presenting Conditions Summary *</Label>
                    <Textarea
                        id="presenting_conditions"
                        value={reportData.presenting_conditions}
                        onChange={(e) => setReportData(prev => ({ ...prev, presenting_conditions: e.target.value }))}
                        placeholder="e.g., Client presents with Type 2 Diabetes, hypertension, and knee osteoarthritis."
                        rows={3}
                    />
                </div>
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setCurrentStep(1)}> {/* Back to new Step 1 (Assessments) */}
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)} // Continue to new Step 3 (Baseline Measures)
                disabled={!reportData.recipient_name.trim() || !reportData.referral_reason.trim() || !reportData.presenting_conditions.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Baseline Measures (Moved from original Step 1) */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">Record baseline vital signs and measurements</p>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bp">Blood Pressure (mmHg)</Label>
                <Input
                  id="bp"
                  value={reportData.baseline_measures.bp}
                  onChange={(e) => setReportData(prev => ({
                    ...prev,
                    baseline_measures: { ...prev.baseline_measures, bp: e.target.value }
                  }))}
                  placeholder="e.g., 120/80"
                />
              </div>

              <div>
                <Label htmlFor="hr">Heart Rate (bpm)</Label>
                <Input
                  id="hr"
                  type="number"
                  value={reportData.baseline_measures.hr}
                  onChange={(e) => setReportData(prev => ({
                    ...prev,
                    baseline_measures: { ...prev.baseline_measures, hr: e.target.value }
                  }))}
                  placeholder="e.g., 72"
                />
              </div>

              <div>
                <Label htmlFor="spo2">SpO₂ (%)</Label>
                <Input
                  id="spo2"
                  type="number"
                  value={reportData.baseline_measures.spo2}
                  onChange={(e) => setReportData(prev => ({
                    ...prev,
                    baseline_measures: { ...prev.baseline_measures, spo2: e.target.value }
                  }))}
                  placeholder="e.g., 98"
                />
              </div>

              <div>
                <Label htmlFor="bmi">BMI (kg/m²)</Label>
                <Input
                  id="bmi"
                  type="number"
                  step="0.1"
                  value={reportData.baseline_measures.bmi}
                  onChange={(e) => setReportData(prev => ({
                    ...prev,
                    baseline_measures: { ...prev.baseline_measures, bmi: e.target.value }
                  }))}
                  placeholder="e.g., 24.5"
                />
              </div>
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setCurrentStep(2)}> {/* Back to new Step 2 (Select Recipient) */}
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext} // Continues to new Step 4 (Treatment Goals)
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Treatment Goals (Original Step 3) */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {/* Historic Goals */}
            {historicGoals.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3">Goals from Client Onboarding:</h4>
                <p className="text-sm text-blue-700 mb-3">Select goals to include in treatment plan</p>
                
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                  {historicGoals.map(goal => (
                    <div key={goal.id} className="flex items-start space-x-3 p-2 bg-white rounded">
                      <Checkbox
                        id={`historic-${goal.id}`}
                        checked={selectedHistoricGoalIds.includes(goal.id)}
                        onCheckedChange={() => handleToggleHistoricGoal(goal.id)}
                      />
                      <Label htmlFor={`historic-${goal.id}`} className="cursor-pointer text-sm flex-1">
                        {goal.goal}
                      </Label>
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
                <h4 className="font-semibold text-slate-900">Treatment Goals</h4>
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

                      <div>
                        <Label>Target Date</Label>
                        <Input
                          type="date"
                          value={goal.target_date}
                          onChange={(e) => updateGoal(index, 'target_date', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">
                  No goals added yet. Load from onboarding or add new goals.
                </p>
              )}
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setCurrentStep(3)}> {/* Back to new Step 3 (Baseline Measures) */}
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext} // Continues to new Step 5 (Clinical Interpretation & Plan)
                disabled={reportData.treatment_goals.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Clinical Interpretation & Plan (Original Step 4) */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="flex gap-3 mb-4">
              <Button
                onClick={handleAIGenerateReport}
                disabled={isGenerating}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> AI Generate Report & Review</>
                )}
              </Button>
            </div>

            {/* Client Demographics */}
            <div>
              <Label htmlFor="client_demographics">Client Demographics (AI Generated)</Label>
              <Textarea
                id="client_demographics"
                value={reportData.client_demographics}
                onChange={(e) => setReportData(prev => ({ ...prev, client_demographics: e.target.value }))}
                placeholder="AI will generate a summary of client background..."
                rows={5}
              />
            </div>

            {/* Assessment Findings */}
            <div>
              <Label htmlFor="assessment_findings">Assessment Findings (AI Generated)</Label>
              <Textarea
                id="assessment_findings"
                value={reportData.assessment_findings}
                onChange={(e) => setReportData(prev => ({ ...prev, assessment_findings: e.target.value }))}
                placeholder="AI will generate detailed analysis of test results..."
                rows={8}
              />
            </div>

            {/* Clinical Interpretation */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="clinical_interpretation">Clinical Interpretation *</Label>
                <Button
                  onClick={handleTidyInterpretation}
                  disabled={isGenerating || !reportData.clinical_interpretation.trim()}
                  variant="outline"
                  size="sm"
                >
                  <Sparkles className="w-3 h-3 mr-2" />
                  AI Tidy
                </Button>
              </div>
              <Textarea
                id="clinical_interpretation"
                value={reportData.clinical_interpretation}
                onChange={(e) => setReportData(prev => ({ ...prev, clinical_interpretation: e.target.value }))}
                placeholder="Summary of findings, functional limitations, and clinical impressions..."
                rows={8}
              />
            </div>

            {/* Management Plan (now treatment_plan for AI, but maps to management_plan for display) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="management_plan">Proposed Management Plan *</Label>
                <Button
                  onClick={handleTidyPlan}
                  disabled={isGenerating || (!reportData.management_plan.trim() && !reportData.treatment_plan.trim())}
                  variant="outline"
                  size="sm"
                >
                  <Sparkles className="w-3 h-3 mr-2" />
                  AI Tidy
                </Button>
              </div>
              <Textarea
                id="management_plan"
                value={reportData.management_plan || reportData.treatment_plan} // Use management_plan or fallback to treatment_plan
                onChange={(e) => setReportData(prev => ({ ...prev, management_plan: e.target.value, treatment_plan: e.target.value }))}
                placeholder="Detailed exercise therapy approach, interventions, and progression strategy..."
                rows={8}
              />
            </div>

            {/* Recommendations */}
            <div>
              <Label htmlFor="recommendations">Recommendations (AI Generated)</Label>
              <Textarea
                id="recommendations"
                value={reportData.recommendations}
                onChange={(e) => setReportData(prev => ({ ...prev, recommendations: e.target.value }))}
                placeholder="AI will generate additional recommendations..."
                rows={5}
              />
            </div>


            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setCurrentStep(4)}> {/* Back to new Step 4 (Treatment Goals) */}
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext} // Continues to new Step 6 (Session Details)
                disabled={!reportData.clinical_interpretation.trim() || (!reportData.management_plan.trim() && !reportData.treatment_plan.trim())}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Session Details (Original Step 5) */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">Proposed session structure and duration</p>

            <div>
              <Label htmlFor="session_frequency">Session Frequency *</Label>
              <Input
                id="session_frequency"
                value={reportData.session_frequency}
                onChange={(e) => setReportData(prev => ({ ...prev, session_frequency: e.target.value }))}
                placeholder="e.g., Twice weekly"
              />
            </div>

            <div>
              <Label htmlFor="session_duration">Session Duration *</Label>
              <Input
                id="session_duration"
                value={reportData.session_duration}
                onChange={(e) => setReportData(prev => ({ ...prev, session_duration: e.target.value }))}
                placeholder="e.g., 60 minutes per session"
              />
            </div>

            <div>
              <Label htmlFor="program_duration">Program Duration *</Label>
              <Input
                id="program_duration"
                value={reportData.program_duration}
                onChange={(e) => setReportData(prev => ({ ...prev, program_duration: e.target.value }))}
                placeholder="e.g., 12 weeks initial program"
              />
            </div>

            <div>
              <Label htmlFor="additional_notes">Additional Notes (Optional)</Label>
              <Textarea
                id="additional_notes"
                value={reportData.additional_notes}
                onChange={(e) => setReportData(prev => ({ ...prev, additional_notes: e.target.value }))}
                placeholder="Any other relevant information..."
                rows={4}
              />
            </div>

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setCurrentStep(5)}> {/* Back to new Step 5 (Clinical Interpretation & Plan) */}
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext} // Continues to new Step 7 (Review & Print)
                disabled={!reportData.session_frequency || !reportData.session_duration || !reportData.program_duration}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue to Review
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 7: Review & Print (Original Step 6) */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Review Report</h3>
              <Button
                onClick={() => {
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
              <div className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="edit_recipient_name">Recipient Name</Label>
                    <Input
                      id="edit_recipient_name"
                      value={reportData.recipient_name}
                      onChange={(e) => setReportData(prev => ({ ...prev, recipient_name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_recipient_clinic">Recipient Clinic</Label>
                    <Input
                      id="edit_recipient_clinic"
                      value={reportData.recipient_clinic}
                      onChange={(e) => setReportData(prev => ({ ...prev, recipient_clinic: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_recipient_address">Recipient Address</Label>
                    <Textarea
                      id="edit_recipient_address"
                      value={reportData.recipient_address}
                      onChange={(e) => setReportData(prev => ({ ...prev, recipient_address: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_demographics">Client Demographics</Label>
                    <Textarea
                      id="edit_demographics"
                      value={reportData.client_demographics}
                      onChange={(e) => setReportData(prev => ({ ...prev, client_demographics: e.target.value }))}
                      rows={4}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_presenting">Presenting Conditions</Label>
                    <Textarea
                      id="edit_presenting"
                      value={reportData.presenting_conditions}
                      onChange={(e) => setReportData(prev => ({ ...prev, presenting_conditions: e.target.value }))}
                      rows={5}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_assessment">Assessment Findings</Label>
                    <Textarea
                      id="edit_assessment"
                      value={reportData.assessment_findings}
                      onChange={(e) => setReportData(prev => ({ ...prev, assessment_findings: e.target.value }))}
                      rows={6}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_interpretation">Clinical Interpretation</Label>
                    <Textarea
                      id="edit_interpretation"
                      value={reportData.clinical_interpretation}
                      onChange={(e) => setReportData(prev => ({ ...prev, clinical_interpretation: e.target.value }))}
                      rows={5}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_plan">Treatment Plan</Label>
                    <Textarea
                      id="edit_plan"
                      value={reportData.treatment_plan}
                      onChange={(e) => setReportData(prev => ({ ...prev, treatment_plan: e.target.value }))}
                      rows={5}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_recommendations">Recommendations</Label>
                    <Textarea
                      id="edit_recommendations"
                      value={reportData.recommendations}
                      onChange={(e) => setReportData(prev => ({ ...prev, recommendations: e.target.value }))}
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-slate-200 rounded-lg p-8 shadow-lg max-h-[70vh] overflow-y-auto">
                {clinicianForPrint && (
                  <PrintableReport 
                    reportData={reportData}
                    client={client}
                    clinician={clinicianForPrint}
                  />
                )}
              </div>
            )}

            <div className="flex justify-between pt-6">
              <Button variant="outline" onClick={() => setCurrentStep(6)}> {/* Back to new Step 6 (Session Details) */}
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Edit
              </Button>
              <div className="flex gap-3">
                {!editingReport && (
                  <Button 
                    onClick={() => {
                      setCurrentStep(0); // Go back to start of wizard
                      setReportData(prev => ({ 
                        ...prev, 
                        clinical_interpretation: "", 
                        management_plan: "", 
                        treatment_plan: "",
                        client_demographics: "",
                        assessment_findings: "",
                        recommendations: ""
                      }));
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
    </>
  );
}