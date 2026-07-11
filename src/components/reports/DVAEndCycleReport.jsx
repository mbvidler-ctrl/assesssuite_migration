
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientCondition, ClientAssessment, Assessment, User } from "@/entities/all";
import { ClientReport } from "@/entities/ClientReport";
import { Plus, Trash2, Printer, Save, X, Loader2 } from "lucide-react"; // Updated icons, removed unnecessary
import { Toaster, toast } from "sonner";
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayLocal } from "@/lib/localDate";

// Helper function to build the assessment table HTML
const buildAssessmentTableHTML = (clientAssessments) => {
  const assessmentsByType = {};
  clientAssessments.forEach(assessment => {
    const key = assessment.assessment_id;
    if (!assessmentsByType[key]) {
      assessmentsByType[key] = {
        name: assessment.name,
        unit: assessment.unit || '', // Use the augmented 'unit' field
        results: []
      };
    }
    assessmentsByType[key].results.push(assessment);
  });

  let tableHTML = `<table style="width: 100%; border-collapse: collapse; margin: 10px 0 20px 0;">
<thead>
<tr style="background-color: #f1f5f9;">
<th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: 600;">Measure</th>
<th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: 600;">Initial Assessment Score<br/>Date:</th>
<th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: 600;">Start of This Cycle Score<br/>Date:</th>
<th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: 600;">End of This Cycle Score<br/>Date:</th>
</tr>
</thead>
<tbody>`;

  Object.values(assessmentsByType).forEach(assessmentGroup => {
    assessmentGroup.results.sort((a, b) => new Date(a.assessment_date) - new Date(b.assessment_date));

    const initial = assessmentGroup.results[0];
    // A more robust solution might track cycles explicitly. For now, assume first is initial, second is start, last is end.
    // If only one assessment, it's initial, start, and end.
    // If two assessments, first is initial/start, second is end.
    // If three or more, first is initial, second is start, last is end.
    let startOfCycle = assessmentGroup.results[0]; // Default to initial
    if (assessmentGroup.results.length > 1) {
        // If there's an assessment after the first, use the second one as 'start of cycle'.
        // This is a simplification; a real system might have explicit cycle start dates.
        startOfCycle = assessmentGroup.results[1];
    }
    const endOfCycle = assessmentGroup.results[assessmentGroup.results.length - 1];


    const formatResult = (assessment) => {
      const date = new Date(assessment.assessment_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
      let result = `${assessment.result_value || 'N/A'} ${assessment.unit || ''}`.trim();

      if (assessment.additional_data) {
        const data = assessment.additional_data;
        if (data.measurement_type === 'hand_grip_strength') {
          result = `Dom ${data.dominant_best || '-'} kg; Non-Dom ${data.non_dominant_best || '-'} kg`;
        } else if (data.measurement_type === 'blood_pressure') {
          result = `${data.pre_exercise_systolic || '-'}/${data.pre_exercise_diastolic || '-'} mmHg`;
        }
      }
      return `${result}<br/>${date}`;
    };

    tableHTML += `
<tr>
<td style="border: 1px solid #000; padding: 8px;"><strong>${assessmentGroup.name}</strong></td>
<td style="border: 1px solid #000; padding: 8px;">${initial ? formatResult(initial) : 'N/A'}</td>
<td style="border: 1px solid #000; padding: 8px;">${startOfCycle ? formatResult(startOfCycle) : 'N/A'}</td>
<td style="border: 1px solid #000; padding: 8px;">${endOfCycle ? formatResult(endOfCycle) : 'N/A'}</td>
</tr>`;
  });

  tableHTML += `
</tbody>
</table>`;

  return tableHTML;
};

// Helper function to generate the full HTML content of the report
const generateFullReportHtmlContent = (client, fullReportData, conditions, assessmentResults, selectedLocation, clinician) => {
  if (!fullReportData || !client || !clinician || !selectedLocation) {
    return 'Report data is incomplete. Please ensure all sections are filled.';
  }

  const {
    reportDate, cycleStartDate, cycleEndDate, totalSessions, treatmentFrequency,
    clientGoals, treatmentProvided, progressSummary, barriers, recommendations,
    additionalComments, signature
  } = fullReportData;

  const tableHTML = buildAssessmentTableHTML(assessmentResults);
  const reportGeneratedDate = format(new Date(reportDate), 'dd/MM/yyyy');

  const clinicName = selectedLocation?.name || clinician?.clinic_name || 'N/A';
  const clinicAddress = selectedLocation?.address || clinician?.clinic_address || '';
  const clinicPhone = selectedLocation?.phone || clinician?.clinic_phone || 'N/A';
  const clinicEmail = selectedLocation?.email || clinician?.clinic_email || '';
  const clinicLogoUrl = selectedLocation?.logo_url || clinician?.clinic_logo_url;

  let report = `
<h2 style="font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 3px;">DVA Client Details</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 1em;">
<tbody>
<tr>
<td style="border: 1px solid #000; padding: 5px; width: 30%; background-color: #f8f9fa; font-weight: bold;">Name</td>
<td style="border: 1px solid #000; padding: 5px; width: 70%;">${client.full_name || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">DOB</td>
<td style="border: 1px solid #000; padding: 5px;">${client.date_of_birth ? format(new Date(client.date_of_birth), 'dd/MM/yyyy') : 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">DVA File Number</td>
<td style="border: 1px solid #000; padding: 5px;">${client.dva_file_number || client.dva_card_number || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Phone</td>
<td style="border: 1px solid #000; padding: 5px;">${client.phone || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Cycle Start Date</td>
<td style="border: 1px solid #000; padding: 5px;">${cycleStartDate ? format(new Date(cycleStartDate), 'dd/MM/yyyy') : 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Cycle End Date</td>
<td style="border: 1px solid #000; padding: 5px;">${cycleEndDate ? format(new Date(cycleEndDate), 'dd/MM/yyyy') : 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Total Sessions</td>
<td style="border: 1px solid #000; padding: 5px;">${totalSessions || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Treatment Frequency</td>
<td style="border: 1px solid #000; padding: 5px;">${treatmentFrequency || 'N/A'}</td>
</tr>
<tr>
<td colspan="2" style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Condition(s) Being Managed/Reason for Referral</td>
</tr>
<tr>
<td colspan="2" style="border: 1px solid #000; padding: 5px;">${conditions.map(c => c.condition_name).join(', ') || 'N/A'}</td>
</tr>
</tbody>
</table>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 3px;">Client Goals and Progress</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 1em;">
<thead>
<tr style="background-color: #f1f5f9;">
<th style="border: 1px solid #000; padding: 5px; text-align: left; font-weight: 600;">Client Goal</th>
<th style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: 600; width: 15%;">Date Assessed</th>
<th style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: 600; width: 20%;">Status</th>
</tr>
</thead>
<tbody>
${clientGoals.filter(g => g.goal && g.goal.trim()).map(g => `
<tr>
<td style="border: 1px solid #000; padding: 5px;">${g.goal}</td>
<td style="border: 1px solid #000; padding: 5px; text-align: center;">${g.dateAssessed ? format(new Date(g.dateAssessed), 'dd/MM/yyyy') : 'N/A'}</td>
<td style="border: 1px solid #000; padding: 5px; text-align: center;">${g.status ? g.status.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'N/A'}</td>
</tr>
`).join('')}
</tbody>
</table>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 3px;">Treatment Provided</h2>
<p style="white-space: pre-wrap; margin-bottom: 1em;">${treatmentProvided || 'N/A'}</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 3px;">Progress Summary</h2>
<p style="white-space: pre-wrap; margin-bottom: 1em;">${progressSummary || 'N/A'}</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 3px;">Outcome Measures</h2>
${tableHTML}

<h2 style="font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 3px;">Barriers to Rehabilitation</h2>
<p style="white-space: pre-wrap; margin-bottom: 1em;">${barriers || 'N/A'}</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 3px;">Recommendations</h2>
<p style="white-space: pre-wrap; margin-bottom: 1em;">${recommendations || 'N/A'}</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 3px;">Additional Comments</h2>
<p style="white-space: pre-wrap; margin-bottom: 1em;">${additionalComments || 'N/A'}</p>


<h2 style="font-size: 14px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 3px;">Allied Health Provider Details</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 1em;">
<tbody>
<tr>
<td style="border: 1px solid #000; padding: 5px; width: 40%; background-color: #f8f9fa; font-weight: bold;">Name and Provider Number</td>
<td style="border: 1px solid #000; padding: 5px; width: 60%;">${clinician?.clinician_name || clinician?.full_name || 'N/A'} - ${clinician?.provider_number || 'N/A'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Allied Health Profession</td>
<td style="border: 1px solid #000; padding: 5px;">${clinician?.profession || 'Exercise Physiologist'}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Practice Name and Address</td>
<td style="border: 1px solid #000; padding: 5px;">${clinicName}<br/>${clinicAddress}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Phone</td>
<td style="border: 1px solid #000; padding: 5px;">${clinicPhone}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Email</td>
<td style="border: 1px solid #000; padding: 5px;">${clinicEmail}</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Provider Signature</td>
<td style="border: 1px solid #000; padding: 5px; height: 60px; vertical-align: top;">
  ${signature ? `<img src="${signature}" style="max-height: 50px; max-width: 200px;" alt="Clinician Signature" />` : 'N/A - Signature not provided'}
</td>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 5px; background-color: #f8f9fa; font-weight: bold;">Date</td>
<td style="border: 1px solid #000; padding: 5px;">${reportGeneratedDate}</td>
</tr>
</tbody>
</table>
`;
  return report;
};

const PrintableReport = ({ client, reportData, conditions, assessmentResults, location, clinician, onClose }) => {
  const clinicName = location?.name || clinician?.clinic_name || '';
  const clinicAddress = location?.address || clinician?.clinic_address || '';
  const clinicPhone = location?.phone || clinician?.phone || '';
  const clinicEmail = location?.email || clinician?.email || '';
  const clinicLogoUrl = location?.logo_url || clinician?.clinic_logo_url;

  // Generate the report content dynamically
  const reportContent = generateFullReportHtmlContent(
    client,
    reportData,
    conditions,
    assessmentResults,
    location,
    clinician
  );

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.warning("Popup blocked. Please allow popups for printing.");
      return;
    }

    try {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>DVA End-of-Cycle Report - ${client.full_name}</title>
          <meta charset="utf-8">
          <style>
            @media print {
              @page { size: A4; margin: 1cm; }
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .printable-report {
                width: 100%;
                font-family: Calibri, 'Segoe UI', Tahoma, sans-serif;
                font-size: 8pt;
                line-height: 1.2;
                color: #000 !important;
                background: white;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 0.5em;
                padding-bottom: 0.3em;
                border-bottom: 2px solid #000;
              }
              .clinic-details {
                text-align: right;
                font-size: 7pt;
                color: #000 !important;
                line-height: 1.1;
              }
              .report-title {
                text-align: center;
                font-size: 11pt;
                font-weight: bold;
                margin: 0.3em 0;
                color: #000 !important;
              }
              .report-content h2 {
                color: #000 !important;
                border-bottom: 1px solid #000;
                padding-bottom: 0.2rem;
                margin: 0.6em 0 0.3em;
                font-size: 9pt;
                font-weight: bold;
              }
              .report-content p {
                color: #000 !important;
                margin: 0.3em 0;
                font-size: 8pt;
                line-height: 1.2;
              }
              .report-content ul, .report-content ol {
                color: #000 !important;
                margin: 0.3em 0;
                padding-left: 1.2em;
              }
              .report-content li {
                color: #000 !important;
                font-size: 8pt;
                margin: 0.1em 0;
                line-height: 1.2;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 0.5em;
                font-size: 7.5pt;
              }
              th, td {
                border: 1px solid #000;
                padding: 3px 4px;
                text-align: left;
                color: #000 !important;
                font-size: 7.5pt;
                line-height: 1.1;
              }
              th {
                background-color: #e8e8e8 !important;
                font-weight: bold;
              }
              strong {
                color: #000 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="printable-report">
            <div class="header">
              ${clinicLogoUrl ? `<img src="${clinicLogoUrl}" alt="Clinic Logo" style="max-width: 100px; max-height: 50px;" />` : `<h2 style="margin: 0; font-size: 10pt; color: #000;">${clinicName}</h2>`}
              <div class="clinic-details">
                <strong>${clinicName}</strong><br />
                ${clinicAddress}<br />
                ${clinicPhone} | ${clinicEmail}
              </div>
            </div>
            <div class="report-title">
              DVA End-of-Cycle Report for ${client.full_name}
            </div>
            <div class="report-content" style="padding-top: 10px;">${reportContent}</div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        onClose(); // Close the preview modal after printing
      }, 500);
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Failed to open print dialog.");
      if (printWindow) printWindow.close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-xl font-bold">Report Preview</h3>
          <div className="flex space-x-2">
            <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700">
              <Printer className="w-4 h-4 mr-2" /> Print / Save as PDF
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" /> Close
            </Button>
          </div>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="printable-report min-h-[1122px]"> {/* Approximate A4 height for better visual preview */}
            <div className="header">
              {clinicLogoUrl ? (
                <img src={clinicLogoUrl} alt="Clinic Logo" style={{ maxWidth: '100px', maxHeight: '50px' }} />
              ) : (
                <h2 style={{ margin: 0, fontSize: '10pt', color: '#000' }}>{clinicName}</h2>
              )}
              <div className="clinic-details">
                <strong>${clinicName}</strong><br />
                ${clinicAddress}<br />
                ${clinicPhone} | ${clinicEmail}
              </div>
            </div>
            <div className="report-title">
              DVA End-of-Cycle Report for ${client.full_name}
            </div>
            <div className="report-content" dangerouslySetInnerHTML={{ __html: reportContent }} />
          </div>
        </div>
      </div>
    </div>
  );
};


export default function DVAEndCycleReport({ client, onClose, editingReport }) {
  const [clinician, setClinician] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [reportData, setReportData] = useState({
    reportDate: editingReport?.report_data?.reportDate || todayLocal(),
    cycleStartDate: editingReport?.report_data?.cycleStartDate || "",
    cycleEndDate: editingReport?.report_data?.cycleEndDate || "",
    totalSessions: editingReport?.report_data?.totalSessions || "",
    treatmentFrequency: editingReport?.report_data?.treatmentFrequency || "",
  });

  const [clientGoals, setClientGoals] = useState(editingReport?.report_data?.clientGoals || [
    { goal: "", dateAssessed: todayLocal(), status: "" }
  ]);

  const [conditions, setConditions] = useState([]);
  const [assessmentResults, setAssessmentResults] = useState([]);

  const [treatmentProvided, setTreatmentProvided] = useState(
    editingReport?.report_data?.treatmentProvided || ""
  );
  const [progressSummary, setProgressSummary] = useState(
    editingReport?.report_data?.progressSummary || ""
  );
  const [barriers, setBarriers] = useState(
    editingReport?.report_data?.barriers || ""
  );
  const [recommendations, setRecommendations] = useState(
    editingReport?.report_data?.recommendations || ""
  );
  const [additionalComments, setAdditionalComments] = useState(
    editingReport?.report_data?.additionalComments || ""
  );

  const canvasRef = useRef(null);
  const [signature, setSignature] = useState(editingReport?.report_data?.signature || null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const loadDataAndSetInitialState = async () => {
      setIsLoading(true);
      try {
        const [clinicianData, conditionsData, clientAssessmentsData, assessmentsData] = await Promise.all([
          User.me(),
          ClientCondition.filter({ client_id: client.id }),
          ClientAssessment.filter({ client_id: client.id, status: "completed" }),
          Assessment.list(),
        ]);

        setClinician(clinicianData);

        const locs = clinicianData.locations || [];
        setLocations(locs);

        // If editing, try to find the saved location
        let initialSelectedLocation = null;
        if (editingReport?.report_data?.locationId) {
            initialSelectedLocation = locs.find(l => l.id === editingReport.report_data.locationId);
        }
        // Fallback to main or first if not found or not editing
        if (!initialSelectedLocation) {
            initialSelectedLocation = locs.find(l => l.is_main) || locs[0];
        }
        if (initialSelectedLocation) {
          setSelectedLocation(initialSelectedLocation);
        }

        setConditions(conditionsData);

        const assessmentsWithDetails = clientAssessmentsData.map(ca => {
          const assessmentInfo = assessmentsData.find(a => a.id === ca.assessment_id);
          return {
            ...ca,
            name: assessmentInfo?.name || "Unknown Assessment",
            unit: assessmentInfo?.unit_of_measure || ""
          };
        });

        setAssessmentResults(assessmentsWithDetails);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Failed to load initial data for report.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDataAndSetInitialState();
  }, [client.id, editingReport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    if (signature && !isDrawing) { // Only draw if signature exists and not actively drawing
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before redrawing
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // Scale image to fit canvas
      };
      img.src = signature;
    } else if (!signature && !isDrawing) {
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear if no signature
    }
  }, [signature, isDrawing]); // Depend on signature and isDrawing

  const handleLoadOnboardingGoals = () => {
    if (client.client_goals) {
      const goalLines = client.client_goals.split('\n').filter(line => line.trim());
      const newGoals = goalLines.map(goalText => ({
        goal: goalText.trim(),
        dateAssessed: todayLocal(),
        status: ""
      }));
      
      setClientGoals([...clientGoals.filter(g => g.goal.trim() !== ''), ...newGoals]);
      toast.success(`${newGoals.length} goal(s) loaded from onboarding`);
    } else {
      toast.info("No onboarding goals found for this client");
    }
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    if (!isDrawing) return; // Prevent saving if not drawing
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignature(null);
  };

  const handleAddGoal = () => {
    setClientGoals([...clientGoals, { goal: "", dateAssessed: todayLocal(), status: "" }]);
  };

  const handleRemoveGoal = (index) => {
    setClientGoals(clientGoals.filter((_, i) => i !== index));
  };

  const handleGoalChange = (index, field, value) => {
    const updated = [...clientGoals];
    updated[index][field] = value;
    setClientGoals(updated);
  };

  const handleSave = async () => {
    if (!selectedLocation) {
      toast.error("Please select a location");
      return;
    }

    if (!signature) {
      toast.error("Please provide your signature");
      return;
    }

    setIsSaving(true);
    try {
      const fullReportData = {
        reportDate: reportData.reportDate,
        cycleStartDate: reportData.cycleStartDate,
        cycleEndDate: reportData.cycleEndDate,
        totalSessions: reportData.totalSessions,
        treatmentFrequency: reportData.treatmentFrequency,
        clientGoals,
        treatmentProvided,
        progressSummary,
        barriers,
        recommendations,
        additionalComments,
        signature,
        locationId: selectedLocation.id,
      };

      const htmlContent = generateFullReportHtmlContent(
        client,
        fullReportData,
        conditions,
        assessmentResults,
        selectedLocation,
        clinician
      );

      const reportRecord = {
        client_id: client.id,
        report_type: "dva_end_cycle_report",
        report_name: `DVA End of Cycle Report - ${format(new Date(reportData.reportDate), 'dd/MM/yyyy')}`,
        report_date: reportData.reportDate,
        report_data: fullReportData, // Save the structured data
        html_content: htmlContent, // Save the generated HTML content
      };

      if (editingReport) {
        await ClientReport.update(editingReport.id, reportRecord);
        toast.success("Report updated successfully");
      } else {
        await ClientReport.create(reportRecord);
        toast.success("Report saved successfully");
      }

      onClose();
    } catch (error) {
      console.error("Failed to save report:", error);
      toast.error("Failed to save report");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintPreview = () => { // Renamed to avoid confusion with internal handlePrint of PrintableReport
    setShowPreview(true);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-slate-600">Loading report data...</p>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">DVA End of Cycle Report</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* Location Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Practice Location</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedLocation?.id || ''} // Ensure value is a string
                onValueChange={(value) => {
                  const loc = locations.find(l => l.id === value);
                  setSelectedLocation(loc);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select practice location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} - {loc.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Report Details */}
          <Card>
            <CardHeader>
              <CardTitle>Report Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Report Date</Label>
                  <Input
                    type="date"
                    value={reportData.reportDate}
                    onChange={(e) => setReportData({ ...reportData, reportDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cycle Start Date</Label>
                  <Input
                    type="date"
                    value={reportData.cycleStartDate}
                    onChange={(e) => setReportData({ ...reportData, cycleStartDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cycle End Date</Label>
                  <Input
                    type="date"
                    value={reportData.cycleEndDate}
                    onChange={(e) => setReportData({ ...reportData, cycleEndDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Total Sessions Completed</Label>
                  <Input
                    type="number"
                    value={reportData.totalSessions}
                    onChange={(e) => setReportData({ ...reportData, totalSessions: e.target.value })}
                    placeholder="e.g., 15"
                  />
                </div>
                <div>
                  <Label>Treatment Frequency</Label>
                  <Input
                    value={reportData.treatmentFrequency}
                    onChange={(e) => setReportData({ ...reportData, treatmentFrequency: e.target.value })}
                    placeholder="e.g., 2x per week"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Goals */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Client Goals and Progress</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleLoadOnboardingGoals}>
                    Load from Onboarding
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleAddGoal}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Goal
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientGoals.map((goal, index) => (
                <div key={index} className="border p-4 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-3">
                      <div>
                        <Label>Goal {index + 1}</Label>
                        <Textarea
                          value={goal.goal}
                          onChange={(e) => handleGoalChange(index, "goal", e.target.value)}
                          placeholder="Describe the client's goal"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Date Assessed</Label>
                          <Input
                            type="date"
                            value={goal.dateAssessed}
                            onChange={(e) => handleGoalChange(index, "dateAssessed", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Status</Label>
                          <Select
                            value={goal.status}
                            onValueChange={(value) => handleGoalChange(index, "status", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="achieved">Achieved</SelectItem>
                              <SelectItem value="progressing">Progressing Well</SelectItem>
                              <SelectItem value="partial">Partially Achieved</SelectItem>
                              <SelectItem value="not_achieved">Not Yet Achieved</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    {clientGoals.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveGoal(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Treatment Provided */}
          <Card>
            <CardHeader>
              <CardTitle>Treatment Provided</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={treatmentProvided}
                onChange={(e) => setTreatmentProvided(e.target.value)}
                placeholder="Describe the treatment interventions provided during this cycle..."
                rows={6}
              />
            </CardContent>
          </Card>

          {/* Progress Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Progress Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={progressSummary}
                onChange={(e) => setProgressSummary(e.target.value)}
                placeholder="Summarize the client's overall progress..."
                rows={6}
              />
            </CardContent>
          </Card>

          {/* Barriers */}
          <Card>
            <CardHeader>
              <CardTitle>Barriers to Rehabilitation</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={barriers}
                onChange={(e) => setBarriers(e.target.value)}
                placeholder="Describe any barriers encountered..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="Provide recommendations for future treatment..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Additional Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
                placeholder="Any additional information..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Signature */}
          <Card>
            <CardHeader>
              <CardTitle>Clinician Signature</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  className="border border-slate-300 rounded cursor-crosshair"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp} // Stop drawing if mouse leaves canvas
                  onTouchStart={handleMouseDown} // For touch devices
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseUp}
                />
                <Button variant="outline" size="sm" onClick={clearSignature}>
                  Clear Signature
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handlePrintPreview} disabled={!signature || !selectedLocation}>
              <Printer className="w-4 h-4 mr-2" />
              Preview & Print
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !signature || !selectedLocation}>
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingReport ? "Update Report" : "Save Report"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {showPreview && (
        <PrintableReport
          client={client}
          reportData={{
            ...reportData,
            clientGoals,
            treatmentProvided,
            progressSummary,
            barriers,
            recommendations,
            additionalComments,
            signature,
          }}
          conditions={conditions}
          assessmentResults={assessmentResults}
          location={selectedLocation}
          clinician={clinician}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}