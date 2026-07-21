
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientCondition, ClientAssessment, Assessment, User } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import { Plus, Trash2, FileDown, Printer, AlertCircle, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { Toaster, toast } from "sonner";
import { format } from 'date-fns';
import { renderSafeHtmlDocument, replaceWithSafeHtml } from "@/lib/safeHtml";

const PrintableForm32 = React.forwardRef(({ formData, client, clinician }, ref) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      // Assuming dateString is already in DD/MM/YYYY or similar format from input,
      // if it's an ISO string, new Date() will parse it.
      // If it's DD/MM/YYYY, new Date() might fail, so convert it first.
      const parts = dateString.split('/');
      if (parts.length === 3) {
        // DD/MM/YYYY to YYYY-MM-DD for reliable Date parsing
        const isoDateString = `${parts[2]}-${parts[1]}-${parts[0]}`;
        return format(new Date(isoDateString), 'dd/MM/yyyy');
      }
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString; // Return as is if parsing fails, better than error
    }
  };

  const getServiceTypeDisplay = () => {
    const serviceTypes = {
      chiropractic: 'Chiropractic',
      exercise_physiologist: 'Exercise Physiologist',
      psychologist: 'Psychologist',
      speech_pathologist: 'Speech Pathologist',
      physiotherapy: 'Physiotherapy',
      occupational_therapy: 'Occupational Therapy',
      podiatrist: 'Podiatrist',
      osteopathy: 'Osteopathy',
    };
    if (formData.service_type === 'other') {
      return `Other: ${formData.service_other || 'Not specified'}`;
    }
    return serviceTypes[formData.service_type] || 'Not specified';
  };

  return (
    <div ref={ref} className="printable-form32">
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
            margin: 0;
            padding: 0;
          }
        }
        .printable-form32 { 
          font-family: Arial, sans-serif;
          font-size: 11pt; 
          line-height: 1.4;
          color: #000;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px; /* This padding will be overridden by page margin in print */
          box-sizing: border-box;
        }
        .form-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 15px;
        }
        .form-title {
          font-size: 20pt;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 5px;
        }
        .form-subtitle {
          font-size: 12pt;
          color: #64748b;
        }
        .section {
          margin-bottom: 25px;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 14pt;
          font-weight: bold;
          color: #1e40af;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 5px;
          margin-bottom: 15px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px 30px;
          margin-bottom: 15px;
        }
        .info-item {
          margin-bottom: 0; /* Adjusted from 10px in outline to remove extra space */
        }
        .label {
          font-weight: bold;
          color: #475569;
          font-size: 9pt;
          text-transform: uppercase;
          margin-bottom: 3px;
          display: block;
        }
        .value {
          font-size: 11pt;
          color: #000;
          word-wrap: break-word; /* Ensure long text wraps */
        }
        .content-box {
          border: 1px solid #cbd5e1;
          padding: 15px;
          background-color: #f8fafc;
          min-height: 80px;
          white-space: pre-wrap; /* Preserves whitespace and line breaks */
          word-wrap: break-word; /* Wraps long words */
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        .data-table th,
        .data-table td {
          border: 1px solid #cbd5e1;
          padding: 10px;
          text-align: left;
          vertical-align: top;
        }
        .data-table th {
          background-color: #f1f5f9;
          font-weight: bold;
        }
        .service-display {
          background-color: #dbeafe;
          padding: 10px;
          border-radius: 5px;
          font-weight: bold;
        }
      `}</style>

      <div className="form-header">
        <div className="form-title">Provider Management Plan</div>
        <div className="form-subtitle">WorkCover QLD Form 032</div>
      </div>

      <div className="section">
        <div className="section-title">Service Type</div>
        <div className="service-display">
          {getServiceTypeDisplay()}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Worker Details</div>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">Worker Name</span>
            <div className="value">{formData.worker_name || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Date of Birth</span>
            <div className="value">{formatDate(formData.worker_dob) || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Date of Injury</span>
            <div className="value">{formatDate(formData.worker_doi) || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Claim Number</span>
            <div className="value">{formData.claim_number || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Diagnosis</span>
            <div className="value">{formData.diagnosis || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Referring Doctor</span>
            <div className="value">{formData.referring_doctor || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Worker's Occupation</span>
            <div className="value">{formData.worker_occupation || 'Not provided'}</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Provider Details</div>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">Provider Name</span>
            <div className="value">{clinician?.full_name || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Clinic Name</span>
            <div className="value">{clinician?.clinic_name || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Provider Number</span>
            <div className="value">{clinician?.provider_number || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Clinic Phone</span>
            <div className="value">{clinician?.clinic_phone || 'Not provided'}</div>
          </div>
          <div className="info-item" style={{ gridColumn: '1 / -1' }}>
            <span className="label">Clinic Address</span>
            <div className="value">{clinician?.clinic_address || 'Not provided'}</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Plan Information</div>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">Provider Management Plan No.</span>
            <div className="value">{formData.plan_number || '1'}</div>
          </div>
          <div className="info-item">
            <span className="label">Date of Initial Consultation</span>
            <div className="value">{formatDate(formData.initial_consultation_date) || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Total Consultations Approved</span>
            <div className="value">{formData.total_consultations_approved || 'Not provided'}</div>
          </div>
          <div className="info-item">
            <span className="label">Consultations Required in This Plan</span>
            <div className="value">{formData.consultations_required || 'Not provided'}</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Treatment Plan</div>
        <div className="content-box">
          {formData.treatment_plan || 'Treatment plan not provided'}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Type and Number of Consultations Being Provided</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>TOC Item No.</th>
              <th>No. of Services or Costs</th>
            </tr>
          </thead>
          <tbody>
            {formData.consultation_types && formData.consultation_types.length > 0 ? (
              formData.consultation_types.map((consultation, index) => (
                <tr key={index}>
                  <td>{consultation.toc_item_no || ''}</td>
                  <td>{consultation.number_of_services || ''}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b' }}>
                  No consultation types specified
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <div className="section-title">Outcome Measures Used to Assess and Monitor Worker's Progress</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Outcome Measures</th>
              <th>Measures (at initial assessment)</th>
              <th>Current Measures (at beginning of plan)</th>
              <th>Anticipated Outcomes (at end of current plan)</th>
            </tr>
          </thead>
          <tbody>
            {formData.outcome_measures && formData.outcome_measures.length > 0 ? (
              formData.outcome_measures.map((measure, index) => (
                <tr key={index}>
                  <td>{measure.measure_name || ''}</td>
                  <td>{measure.initial_result || ''}</td>
                  <td>{measure.current_result || ''}</td>
                  <td>{measure.anticipated_outcome || ''}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b' }}>
                  No outcome measures specified
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <div className="section-title">Identified Barriers to Return to Work and Recommended Strategies</div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Barriers</th>
              <th style={{ width: '50%' }}>Recommended Strategies</th>
            </tr>
          </thead>
          <tbody>
            {formData.barriers && formData.barriers.length > 0 ? (
              formData.barriers.map((barrier, index) => (
                <tr key={index}>
                  <td>{barrier.barrier || ''}</td>
                  <td>{barrier.strategy || ''}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" style={{ textAlign: 'center', fontStyle: 'italic', color: '#64748b' }}>
                  No barriers specified
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section" style={{ marginTop: '40px' }}>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">Provider Signature</span>
            <div style={{ borderBottom: '1px solid #000', height: '30px', marginTop: '10px' }}></div>
          </div>
          <div className="info-item">
            <span className="label">Date</span>
            <div style={{ borderBottom: '1px solid #000', height: '30px', marginTop: '10px' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function Form32Generator({ client, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [clinician, setClinician] = useState(null);
  const [clientData, setClientData] = useState({ conditions: [], assessments: [] });
  const printRef = useRef(null);

  const [formData, setFormData] = useState({
    // Service type
    service_type: 'exercise_physiologist',
    service_other: '',
    
    // Worker details (auto-populated from client)
    worker_name: '',
    worker_dob: '',
    worker_doi: '',
    diagnosis: '',
    claim_number: '',
    referring_doctor: '',
    worker_occupation: '',
    
    // Plan details
    plan_number: '1',
    initial_consultation_date: '',
    total_consultations_approved: '',
    consultations_required: '',
    
    // Treatment plan
    treatment_plan: '',
    
    // Consultation types
    consultation_types: [{ toc_item_no: '', number_of_services: '' }],
    
    // Outcome measures
    outcome_measures: [{ measure_name: '', initial_result: '', current_result: '', anticipated_outcome: '' }],
    
    // Barriers
    barriers: [{ barrier: '', strategy: '' }]
  });

  const [errors, setErrors] = useState({});

  const stepTitles = [
    "Service Type & Worker Details",
    "Plan Details & Treatment Plan", 
    "Consultation Types",
    "Outcome Measures",
    "Barriers & Strategies",
    "Review & Generate Form"
  ];

  useEffect(() => {
    loadInitialData();
  }, [client.id]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [clinicianData, conditions, clientAssessmentsData, assessmentsData] = await Promise.all([
        User.me(),
        ClientCondition.filter({ client_id: client.id }),
        ClientAssessment.filter({ client_id: client.id, status: "completed" }),
        Assessment.list(),
      ]);
      
      setClinician(clinicianData);
      const assessmentMap = new Map(assessmentsData.map(a => [a.id, a]));
      const augmentedClientAssessments = clientAssessmentsData.map(ca => ({
        ...ca,
        name: assessmentMap.get(ca.assessment_id)?.name || 'Unknown Assessment',
        unit_of_measure: assessmentMap.get(ca.assessment_id)?.unit_of_measure || ''
      }));
      
      setClientData({ conditions, assessments: augmentedClientAssessments });
      
      // Auto-populate form with client data
      setFormData(prev => ({
        ...prev,
        worker_name: client.full_name || '',
        worker_dob: client.date_of_birth ? format(new Date(client.date_of_birth), 'dd/MM/yyyy') : '',
        worker_doi: client.workcover_date_of_injury ? format(new Date(client.workcover_date_of_injury), 'dd/MM/yyyy') : '',
        claim_number: client.workcover_claim_number || '',
        referring_doctor: client.referral_source_name || '',
        worker_occupation: client.workcover_workplace_tasks || '',
        diagnosis: conditions.length > 0 ? conditions[0].condition_name : '',
        initial_consultation_date: format(new Date(), 'dd/MM/yyyy')
      }));
      
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load initial data for Form 32.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const addArrayItem = (arrayName, newItem) => {
    setFormData(prev => ({
      ...prev,
      [arrayName]: [...prev[arrayName], newItem]
    }));
  };

  const updateArrayItem = (arrayName, index, field, value) => {
    setFormData(prev => ({
      ...prev,
      [arrayName]: prev[arrayName].map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeArrayItem = (arrayName, index) => {
    setFormData(prev => ({
      ...prev,
      [arrayName]: prev[arrayName].filter((_, i) => i !== index)
    }));
  };

  const validateCurrentStep = () => {
    const newErrors = {};
    
    switch (currentStep) {
      case 0: // Service type & Worker details
        if (!formData.service_type) newErrors.service_type = "Service type is required";
        if (formData.service_type === 'other' && !formData.service_other) newErrors.service_other = "Please specify other service type";
        if (!formData.worker_name) newErrors.worker_name = "Worker name is required";
        if (!formData.worker_dob) newErrors.worker_dob = "Date of birth is required";
        if (!formData.worker_doi) newErrors.worker_doi = "Date of injury is required";
        if (!formData.diagnosis) newErrors.diagnosis = "Diagnosis is required";
        if (!formData.claim_number) newErrors.claim_number = "Claim number is required";
        if (!formData.referring_doctor) newErrors.referring_doctor = "Referring doctor is required";
        if (!formData.worker_occupation) newErrors.worker_occupation = "Worker occupation is required";
        break;
        
      case 1: // Plan details & Treatment plan
        if (!formData.plan_number) newErrors.plan_number = "Plan number is required";
        if (!formData.initial_consultation_date) newErrors.initial_consultation_date = "Initial consultation date is required";
        if (!formData.total_consultations_approved) newErrors.total_consultations_approved = "Total consultations approved is required";
        if (!formData.consultations_required) newErrors.consultations_required = "Consultations required is required";
        if (!formData.treatment_plan || formData.treatment_plan.trim().length < 50) {
          newErrors.treatment_plan = "Treatment plan is required (minimum 50 characters)";
        }
        break;
        
      case 2: // Consultation types
        if (formData.consultation_types.length === 0) {
          newErrors.consultation_types = "At least one consultation type is required";
        } else {
          formData.consultation_types.forEach((consultation, index) => {
            if (!consultation.toc_item_no) newErrors[`consultation_${index}_toc`] = "TOC Item No. is required";
            if (!consultation.number_of_services) newErrors[`consultation_${index}_services`] = "Number of services is required";
          });
        }
        break;
        
      case 3: // Outcome measures
        if (formData.outcome_measures.length === 0) {
          newErrors.outcome_measures = "At least one outcome measure is required";
        } else {
          formData.outcome_measures.forEach((measure, index) => {
            if (!measure.measure_name) newErrors[`measure_${index}_name`] = "Measure name is required";
            if (!measure.initial_result) newErrors[`measure_${index}_initial`] = "Initial result is required";
            if (!measure.current_result) newErrors[`measure_${index}_current`] = "Current result is required";
            if (!measure.anticipated_outcome) newErrors[`measure_${index}_anticipated`] = "Anticipated outcome is required";
          });
        }
        break;
        
      case 4: // Barriers
        if (formData.barriers.length === 0) {
          newErrors.barriers = "At least one barrier and strategy is required";
        } else {
          formData.barriers.forEach((barrier, index) => {
            if (!barrier.barrier) newErrors[`barrier_${index}_barrier`] = "Barrier description is required";
            if (!barrier.strategy) newErrors[`barrier_${index}_strategy`] = "Strategy is required";
          });
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, stepTitles.length - 1));
    } else {
      toast.error("Please fill in all required fields before continuing.");
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const generateAIContent = async (field) => {
    setIsGenerating(true);
    try {
      let prompt = "";
      
      if (field === 'treatment_plan') {
        prompt = `Generate a comprehensive treatment plan for a WorkCover QLD Form 32 based on the following information:
        
Client: ${client.full_name}
Diagnosis: ${formData.diagnosis}
Occupation: ${formData.worker_occupation}
Conditions: ${JSON.stringify(clientData.conditions)}
Assessments: ${JSON.stringify(clientData.assessments)}

The treatment plan should be detailed, evidence-based, and appropriate for WorkCover QLD requirements. Include frequency, duration, specific interventions, and progression. Minimum 200 words.`;
      }
      
      const response = await InvokeLLM({ prompt });
      handleInputChange(field, response);
      toast.success(`${field.replace('_', ' ')} generated successfully!`);
      
    } catch (error) {
      console.error("Error generating AI content:", error);
      toast.error("Failed to generate content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error("Form content is not ready for printing.");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      toast.warning("Popup blocked. Using current window print...");
      const originalContent = document.body.innerHTML;
      replaceWithSafeHtml(document.body, printRef.current.outerHTML);
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
          <title>Form 032 - Provider Management Plan - ${client.full_name}</title>
          <meta charset="utf-8">
          <style>
            @media print {
              @page { size: A4; margin: 1.5cm; }
              body { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                margin: 0;
                padding: 0;
              }
            }
            .printable-form32 { 
              font-family: Arial, sans-serif;
              font-size: 11pt; 
              line-height: 1.4;
              color: #000;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px; /* This padding will be overridden by page margin in print */
              box-sizing: border-box;
            }
            .form-header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 3px solid #2563eb;
              padding-bottom: 15px;
            }
            .form-title {
              font-size: 20pt;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 5px;
            }
            .form-subtitle {
              font-size: 12pt;
              color: #64748b;
            }
            .section {
              margin-bottom: 25px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 14pt;
              font-weight: bold;
              color: #1e40af;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 5px;
              margin-bottom: 15px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px 30px;
              margin-bottom: 15px;
            }
            .info-item {
              margin-bottom: 0;
            }
            .label {
              font-weight: bold;
              color: #475569;
              font-size: 9pt;
              text-transform: uppercase;
              margin-bottom: 3px;
              display: block;
            }
            .value {
              font-size: 11pt;
              color: #000;
              word-wrap: break-word;
            }
            .content-box {
              border: 1px solid #cbd5e1;
              padding: 15px;
              background-color: #f8fafc;
              min-height: 80px;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            .data-table th,
            .data-table td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              text-align: left;
              vertical-align: top;
            }
            .data-table th {
              background-color: #f1f5f9;
              font-weight: bold;
            }
            .service-display {
              background-color: #dbeafe;
              padding: 10px;
              border-radius: 5px;
              font-weight: bold;
            }
          </style>
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

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-slate-600">Loading Form 32 data...</p>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      
      {/* Hidden printable form */}
      <div className="hidden">
        <PrintableForm32 ref={printRef} formData={formData} client={client} clinician={clinician} />
      </div>

      <div className="bg-white rounded-lg w-full mx-auto">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">WorkCover QLD Form 032</h2>
              <p className="text-slate-600 text-sm">Provider Management Plan for {client.full_name}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-slate-600 text-sm font-medium mt-2">
            Step {currentStep + 1} of {stepTitles.length}: <span className="text-slate-900 font-semibold">{stepTitles[currentStep]}</span>
          </p>
        </div>

        <div className="p-6 min-h-[400px]">
          {/* Step 0: Service Type & Worker Details */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Service Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Service Type *</Label>
                    <Select value={formData.service_type} onValueChange={(value) => handleInputChange('service_type', value)}>
                      <SelectTrigger className={`mt-1 ${errors.service_type ? "border-red-500" : ""}`}>
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chiropractic">Chiropractic</SelectItem>
                        <SelectItem value="exercise_physiologist">Exercise Physiologist</SelectItem>
                        <SelectItem value="psychologist">Psychologist</SelectItem>
                        <SelectItem value="speech_pathologist">Speech Pathologist</SelectItem>
                        <SelectItem value="physiotherapy">Physiotherapy</SelectItem>
                        <SelectItem value="occupational_therapy">Occupational Therapy</SelectItem>
                        <SelectItem value="podiatrist">Podiatrist</SelectItem>
                        <SelectItem value="osteopathy">Osteopathy</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.service_type && <p className="text-red-500 text-sm mt-1">{errors.service_type}</p>}
                  </div>
                  
                  {formData.service_type === 'other' && (
                    <div>
                      <Label htmlFor="service_other" className="text-sm font-medium text-slate-700">Other Service Type *</Label>
                      <Input
                        id="service_other"
                        value={formData.service_other}
                        onChange={(e) => handleInputChange('service_other', e.target.value)}
                        className={`mt-1 ${errors.service_other ? "border-red-500" : ""}`}
                        placeholder="Specify other service type"
                      />
                      {errors.service_other && <p className="text-red-500 text-sm mt-1">{errors.service_other}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Worker Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="worker_name" className="text-sm font-medium text-slate-700">Worker Name *</Label>
                      <Input
                        id="worker_name"
                        value={formData.worker_name}
                        onChange={(e) => handleInputChange('worker_name', e.target.value)}
                        className={`mt-1 ${errors.worker_name ? "border-red-500" : ""}`}
                      />
                      {errors.worker_name && <p className="text-red-500 text-sm mt-1">{errors.worker_name}</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="worker_dob" className="text-sm font-medium text-slate-700">Date of Birth *</Label>
                      <Input
                        id="worker_dob"
                        value={formData.worker_dob}
                        onChange={(e) => handleInputChange('worker_dob', e.target.value)}
                        placeholder="DD/MM/YYYY"
                        className={`mt-1 ${errors.worker_dob ? "border-red-500" : ""}`}
                      />
                      {errors.worker_dob && <p className="text-red-500 text-sm mt-1">{errors.worker_dob}</p>}
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="worker_doi" className="text-sm font-medium text-slate-700">Date of Injury *</Label>
                      <Input
                        id="worker_doi"
                        value={formData.worker_doi}
                        onChange={(e) => handleInputChange('worker_doi', e.target.value)}
                        placeholder="DD/MM/YYYY"
                        className={`mt-1 ${errors.worker_doi ? "border-red-500" : ""}`}
                      />
                      {errors.worker_doi && <p className="text-red-500 text-sm mt-1">{errors.worker_doi}</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="claim_number" className="text-sm font-medium text-slate-700">Claim Number *</Label>
                      <Input
                        id="claim_number"
                        value={formData.claim_number}
                        onChange={(e) => handleInputChange('claim_number', e.target.value)}
                        className={`mt-1 ${errors.claim_number ? "border-red-500" : ""}`}
                      />
                      {errors.claim_number && <p className="text-red-500 text-sm mt-1">{errors.claim_number}</p>}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="diagnosis" className="text-sm font-medium text-slate-700">Diagnosis *</Label>
                    <Input
                      id="diagnosis"
                      value={formData.diagnosis}
                      onChange={(e) => handleInputChange('diagnosis', e.target.value)}
                      className={`mt-1 ${errors.diagnosis ? "border-red-500" : ""}`}
                    />
                    {errors.diagnosis && <p className="text-red-500 text-sm mt-1">{errors.diagnosis}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="referring_doctor" className="text-sm font-medium text-slate-700">Referring Doctor *</Label>
                    <Input
                      id="referring_doctor"
                      value={formData.referring_doctor}
                      onChange={(e) => handleInputChange('referring_doctor', e.target.value)}
                      className={`mt-1 ${errors.referring_doctor ? "border-red-500" : ""}`}
                    />
                    {errors.referring_doctor && <p className="text-red-500 text-sm mt-1">{errors.referring_doctor}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="worker_occupation" className="text-sm font-medium text-slate-700">Worker Occupation *</Label>
                    <Input
                      id="worker_occupation"
                      value={formData.worker_occupation}
                      onChange={(e) => handleInputChange('worker_occupation', e.target.value)}
                      className={`mt-1 ${errors.worker_occupation ? "border-red-500" : ""}`}
                    />
                    {errors.worker_occupation && <p className="text-red-500 text-sm mt-1">{errors.worker_occupation}</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 1: Plan Details & Treatment Plan */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Plan Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="plan_number" className="text-sm font-medium text-slate-700">Plan Number *</Label>
                      <Input
                        id="plan_number"
                        value={formData.plan_number}
                        onChange={(e) => handleInputChange('plan_number', e.target.value)}
                        className={`mt-1 ${errors.plan_number ? "border-red-500" : ""}`}
                      />
                      {errors.plan_number && <p className="text-red-500 text-sm mt-1">{errors.plan_number}</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="initial_consultation_date" className="text-sm font-medium text-slate-700">Initial Consultation Date *</Label>
                      <Input
                        id="initial_consultation_date"
                        value={formData.initial_consultation_date}
                        onChange={(e) => handleInputChange('initial_consultation_date', e.target.value)}
                        placeholder="DD/MM/YYYY"
                        className={`mt-1 ${errors.initial_consultation_date ? "border-red-500" : ""}`}
                      />
                      {errors.initial_consultation_date && <p className="text-red-500 text-sm mt-1">{errors.initial_consultation_date}</p>}
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="total_consultations_approved" className="text-sm font-medium text-slate-700">Total Consultations Approved *</Label>
                      <Input
                        id="total_consultations_approved"
                        value={formData.total_consultations_approved}
                        onChange={(e) => handleInputChange('total_consultations_approved', e.target.value)}
                        className={`mt-1 ${errors.total_consultations_approved ? "border-red-500" : ""}`}
                      />
                      {errors.total_consultations_approved && <p className="text-red-500 text-sm mt-1">{errors.total_consultations_approved}</p>}
                    </div>
                    
                    <div>
                      <Label htmlFor="consultations_required" className="text-sm font-medium text-slate-700">Consultations Required *</Label>
                      <Input
                        id="consultations_required"
                        value={formData.consultations_required}
                        onChange={(e) => handleInputChange('consultations_required', e.target.value)}
                        className={`mt-1 ${errors.consultations_required ? "border-red-500" : ""}`}
                      />
                      {errors.consultations_required && <p className="text-red-500 text-sm mt-1">{errors.consultations_required}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Treatment Plan
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateAIContent('treatment_plan')}
                      disabled={isGenerating}
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                      AI Generate
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label htmlFor="treatment_plan" className="text-sm font-medium text-slate-700">Treatment Plan * (minimum 50 characters)</Label>
                    <Textarea
                      id="treatment_plan"
                      value={formData.treatment_plan}
                      onChange={(e) => handleInputChange('treatment_plan', e.target.value)}
                      rows={8}
                      className={`mt-1 ${errors.treatment_plan ? "border-red-500" : ""}`}
                      placeholder="Detailed treatment plan including frequency, duration, specific interventions, and progression..."
                    />
                    <div className="flex justify-between mt-1">
                      {errors.treatment_plan && <p className="text-red-500 text-sm">{errors.treatment_plan}</p>}
                      <p className="text-slate-500 text-sm">{formData.treatment_plan.length} characters</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Consultation Types */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Type and Number of Consultations
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addArrayItem('consultation_types', { toc_item_no: '', number_of_services: '' })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Consultation
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.consultation_types && <p className="text-red-500 text-sm">{errors.consultation_types}</p>}
                
                {formData.consultation_types.map((consultation, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <Label className="text-sm font-medium text-slate-700">TOC Item No. *</Label>
                      <Input
                        value={consultation.toc_item_no}
                        onChange={(e) => updateArrayItem('consultation_types', index, 'toc_item_no', e.target.value)}
                        placeholder="e.g., EP001"
                        className={`mt-1 ${errors[`consultation_${index}_toc`] ? "border-red-500" : ""}`}
                      />
                      {errors[`consultation_${index}_toc`] && <p className="text-red-500 text-sm mt-1">{errors[`consultation_${index}_toc`]}</p>}
                    </div>
                    
                    <div className="flex-1">
                      <Label className="text-sm font-medium text-slate-700">Number of Services *</Label>
                      <Input
                        value={consultation.number_of_services}
                        onChange={(e) => updateArrayItem('consultation_types', index, 'number_of_services', e.target.value)}
                        placeholder="e.g., 8"
                        className={`mt-1 ${errors[`consultation_${index}_services`] ? "border-red-500" : ""}`}
                      />
                      {errors[`consultation_${index}_services`] && <p className="text-red-500 text-sm mt-1">{errors[`consultation_${index}_services`]}</p>}
                    </div>
                    
                    {formData.consultation_types.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeArrayItem('consultation_types', index)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Outcome Measures */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Outcome Measures
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addArrayItem('outcome_measures', { measure_name: '', initial_result: '', current_result: '', anticipated_outcome: '' })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Measure
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.outcome_measures && <p className="text-red-500 text-sm">{errors.outcome_measures}</p>}
                
                {formData.outcome_measures.map((measure, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Outcome Measure {index + 1}</h4>
                      {formData.outcome_measures.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeArrayItem('outcome_measures', index)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Measure Name *</Label>
                      <Input
                        value={measure.measure_name}
                        onChange={(e) => updateArrayItem('outcome_measures', index, 'measure_name', e.target.value)}
                        placeholder="e.g., Berg Balance Scale"
                        className={`mt-1 ${errors[`measure_${index}_name`] ? "border-red-500" : ""}`}
                      />
                      {errors[`measure_${index}_name`] && <p className="text-red-500 text-sm mt-1">{errors[`measure_${index}_name`]}</p>}
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-slate-700">Initial Result *</Label>
                        <Input
                          value={measure.initial_result}
                          onChange={(e) => updateArrayItem('outcome_measures', index, 'initial_result', e.target.value)}
                          placeholder="e.g., 45/56"
                          className={`mt-1 ${errors[`measure_${index}_initial`] ? "border-red-500" : ""}`}
                        />
                        {errors[`measure_${index}_initial`] && <p className="text-red-500 text-sm mt-1">{errors[`measure_${index}_initial`]}</p>}
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium text-slate-700">Current Result *</Label>
                        <Input
                          value={measure.current_result}
                          onChange={(e) => updateArrayItem('outcome_measures', index, 'current_result', e.target.value)}
                          placeholder="e.g., 50/56"
                          className={`mt-1 ${errors[`measure_${index}_current`] ? "border-red-500" : ""}`}
                        />
                        {errors[`measure_${index}_current`] && <p className="text-red-500 text-sm mt-1">{errors[`measure_${index}_current`]}</p>}
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium text-slate-700">Anticipated Outcome *</Label>
                        <Input
                          value={measure.anticipated_outcome}
                          onChange={(e) => updateArrayItem('outcome_measures', index, 'anticipated_outcome', e.target.value)}
                          placeholder="e.g., 54/56"
                          className={`mt-1 ${errors[`measure_${index}_anticipated`] ? "border-red-500" : ""}`}
                        />
                        {errors[`measure_${index}_anticipated`] && <p className="text-red-500 text-sm mt-1">{errors[`measure_${index}_anticipated`]}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Barriers */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Barriers to Return to Work & Strategies
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addArrayItem('barriers', { barrier: '', strategy: '' })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Barrier
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.barriers && <p className="text-red-500 text-sm">{errors.barriers}</p>}
                
                {formData.barriers.map((barrier, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Barrier {index + 1}</h4>
                      {formData.barriers.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeArrayItem('barriers', index)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-slate-700">Barrier *</Label>
                        <Textarea
                          value={barrier.barrier}
                          onChange={(e) => updateArrayItem('barriers', index, 'barrier', e.target.value)}
                          placeholder="Describe the barrier to return to work..."
                          rows={3}
                          className={`mt-1 ${errors[`barrier_${index}_barrier`] ? "border-red-500" : ""}`}
                        />
                        {errors[`barrier_${index}_barrier`] && <p className="text-red-500 text-sm mt-1">{errors[`barrier_${index}_barrier`]}</p>}
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium text-slate-700">Recommended Strategy *</Label>
                        <Textarea
                          value={barrier.strategy}
                          onChange={(e) => updateArrayItem('barriers', index, 'strategy', e.target.value)}
                          placeholder="Strategy to overcome this barrier..."
                          rows={3}
                          className={`mt-1 ${errors[`barrier_${index}_strategy`] ? "border-red-500" : ""}`}
                        />
                        {errors[`barrier_${index}_strategy`] && <p className="text-red-500 text-sm mt-1">{errors[`barrier_${index}_strategy`]}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Form 032 Review</CardTitle>
                  <p className="text-sm text-slate-600">Please review all information before generating the final form.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-6 text-sm">
                    <div>
                      <h4 className="font-medium text-slate-900 mb-2">Worker Details</h4>
                      <div className="space-y-1 text-slate-600">
                        <p><strong>Name:</strong> {formData.worker_name}</p>
                        <p><strong>DOB:</strong> {formData.worker_dob}</p>
                        <p><strong>DOI:</strong> {formData.worker_doi}</p>
                        <p><strong>Claim:</strong> {formData.claim_number}</p>
                        <p><strong>Diagnosis:</strong> {formData.diagnosis}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-slate-900 mb-2">Plan Details</h4>
                      <div className="space-y-1 text-slate-600">
                        <p><strong>Plan Number:</strong> {formData.plan_number}</p>
                        <p><strong>Initial Date:</strong> {formData.initial_consultation_date}</p>
                        <p><strong>Total Approved:</strong> {formData.total_consultations_approved}</p>
                        <p><strong>Required:</strong> {formData.consultations_required}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Outcome Measures</h4>
                    <p className="text-sm text-slate-600">{formData.outcome_measures.length} measures defined</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Barriers & Strategies</h4>
                    <p className="text-sm text-slate-600">{formData.barriers.length} barriers identified with strategies</p>
                  </div>
                </CardContent>
              </Card>
              
              <div className="flex justify-center">
                <Button
                  onClick={handlePrint}
                  className="bg-green-600 hover:bg-green-700 px-8"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Generate & Print Form 032
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="p-4 border-t flex justify-between items-center bg-slate-50/50">
          <div>
            {currentStep > 0 && (
              <Button onClick={handlePrevious} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
            )}
          </div>

          <div>
            {currentStep < stepTitles.length - 1 && (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
