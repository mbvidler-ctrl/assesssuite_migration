import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";

export default function ClientDataExporter({ client, isOpen, onClose }) {
  const [isExporting, setIsExporting] = useState(false);
  const [showSelectMode, setShowSelectMode] = useState(false);
  const [selectedSections, setSelectedSections] = useState({
    personal: true,
    contact: true,
    referral: true,
    funding: true,
    conditions: true,
    medications: true,
    goals: true,
    apss: true,
    cultural: true,
    assessments: true,
    soapNotes: true,
    reports: true,
    documents: true,
    nutritionPlans: true,
    onboarding: true,
  });

  const sectionLabels = {
    personal: "Personal Information",
    contact: "Contact Details",
    referral: "Referral Information",
    funding: "Funding Information",
    conditions: "Medical Conditions",
    medications: "Current Medications",
    goals: "Client Goals",
    apss: "APSS Pre-Exercise Screening",
    cultural: "Cultural Considerations",
    assessments: "Assessment Results",
    soapNotes: "SOAP Notes",
    reports: "Reports",
    documents: "Documents",
    nutritionPlans: "Nutrition Plans",
    onboarding: "Onboarding Data",
  };

  const toggleSection = (section) => {
    setSelectedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const selectAll = () => {
    const allSelected = {};
    Object.keys(selectedSections).forEach(key => {
      allSelected[key] = true;
    });
    setSelectedSections(allSelected);
  };

  const deselectAll = () => {
    const allDeselected = {};
    Object.keys(selectedSections).forEach(key => {
      allDeselected[key] = false;
    });
    setSelectedSections(allDeselected);
  };

  const exportAllData = async () => {
    selectAll();
    await generatePDF(true);
  };

  const exportSelectedData = async () => {
    await generatePDF(false);
  };

  const generatePDF = async (isFullExport) => {
    setIsExporting(true);
    try {
      // Fetch all client data
      const [conditions, assessments, soapNotes, reports, documents, nutritionPlans, allAssessments] = await Promise.all([
        base44.entities.ClientCondition.filter({ client_id: client.id }),
        base44.entities.ClientAssessment.filter({ client_id: client.id }, "-assessment_date"),
        base44.entities.SOAPNote.filter({ client_id: client.id }, "-note_date"),
        base44.entities.ClientReport.filter({ client_id: client.id }, "-report_date"),
        base44.entities.ClientDocument.filter({ client_id: client.id }),
        base44.entities.ClientNutritionPlan.filter({ client_id: client.id }),
        base44.entities.Assessment.list(),
      ]);

      // Create assessment map
      const assessmentMap = new Map(allAssessments.map(a => [a.id, a]));

      // Generate HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Client Data Export - ${client.full_name}</title>
          <style>
            body { font-family: 'Calibri', Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
            h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
            h2 { color: #2563eb; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; }
            h3 { color: #3b82f6; margin-top: 20px; }
            .section { margin-bottom: 30px; page-break-inside: avoid; }
            .info-row { margin: 8px 0; display: flex; }
            .label { font-weight: 600; color: #475569; min-width: 180px; }
            .value { color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: 600; color: #1e293b; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
            .badge-green { background-color: #dcfce7; color: #166534; }
            .badge-yellow { background-color: #fef3c7; color: #92400e; }
            .badge-blue { background-color: #dbeafe; color: #1e40af; }
            .export-date { text-align: right; color: #64748b; font-size: 14px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Client Data Export</h1>
          <div class="export-date">Exported: ${format(new Date(), "PPP 'at' p")}</div>
      `;

      // Personal Information
      if (isFullExport || selectedSections.personal) {
        htmlContent += `
          <div class="section">
            <h2>Personal Information</h2>
            <div class="info-row"><span class="label">Full Name:</span><span class="value">${client.full_name || "N/A"}</span></div>
            <div class="info-row"><span class="label">Date of Birth:</span><span class="value">${client.date_of_birth ? format(new Date(client.date_of_birth), "PPP") : "N/A"}</span></div>
            <div class="info-row"><span class="label">Gender:</span><span class="value">${client.gender === "other" ? client.gender_other : client.gender || "N/A"}</span></div>
            ${client.pronouns ? `<div class="info-row"><span class="label">Pronouns:</span><span class="value">${client.pronouns}</span></div>` : ""}
          </div>
        `;
      }

      // Contact Details
      if (isFullExport || selectedSections.contact) {
        htmlContent += `
          <div class="section">
            <h2>Contact Details</h2>
            <div class="info-row"><span class="label">Phone:</span><span class="value">${client.phone || "N/A"}</span></div>
            <div class="info-row"><span class="label">Email:</span><span class="value">${client.email || "N/A"}</span></div>
            <div class="info-row"><span class="label">Address:</span><span class="value">${client.address || "N/A"}</span></div>
            ${client.emergency_contact_name ? `<div class="info-row"><span class="label">Emergency Contact:</span><span class="value">${client.emergency_contact_name}</span></div>` : ""}
            ${client.emergency_contact_phone ? `<div class="info-row"><span class="label">Emergency Phone:</span><span class="value">${client.emergency_contact_phone}</span></div>` : ""}
          </div>
        `;
      }

      // Referral Information
      if ((isFullExport || selectedSections.referral) && (client.referral_source || client.referral_source_name)) {
        htmlContent += `
          <div class="section">
            <h2>Referral Information</h2>
            <h3>Primary Referral</h3>
            ${client.referral_source ? `<div class="info-row"><span class="label">Source:</span><span class="value">${client.referral_source}</span></div>` : ""}
            ${client.referral_source_name ? `<div class="info-row"><span class="label">Referrer:</span><span class="value">${client.referral_source_name}</span></div>` : ""}
            ${client.referral_source_address ? `<div class="info-row"><span class="label">Address:</span><span class="value">${client.referral_source_address}</span></div>` : ""}
            ${client.referral_source_email ? `<div class="info-row"><span class="label">Email:</span><span class="value">${client.referral_source_email}</span></div>` : ""}
            ${client.referral_date ? `<div class="info-row"><span class="label">Date:</span><span class="value">${format(new Date(client.referral_date), "PPP")}</span></div>` : ""}
            ${client.referral_reason ? `<div class="info-row"><span class="label">Reason:</span><span class="value">${client.referral_reason}</span></div>` : ""}
            
            ${client.additional_referrals && client.additional_referrals.length > 0 ? `
              <h3>Additional Referrals</h3>
              ${client.additional_referrals.map((ref, i) => `
                <div style="margin: 15px 0; padding: 10px; background: #f8fafc; border-left: 3px solid #3b82f6;">
                  <strong>Referral ${i + 1}</strong>
                  ${ref.referral_source ? `<div class="info-row"><span class="label">Source:</span><span class="value">${ref.referral_source}</span></div>` : ""}
                  ${ref.referral_source_name ? `<div class="info-row"><span class="label">Referrer:</span><span class="value">${ref.referral_source_name}</span></div>` : ""}
                  ${ref.referral_date ? `<div class="info-row"><span class="label">Date:</span><span class="value">${format(new Date(ref.referral_date), "PPP")}</span></div>` : ""}
                </div>
              `).join('')}
            ` : ""}
          </div>
        `;
      }

      // Funding Information
      if ((isFullExport || selectedSections.funding) && client.funding_source) {
        htmlContent += `
          <div class="section">
            <h2>Funding Information</h2>
            <div class="info-row"><span class="label">Funding Source:</span><span class="value">${client.funding_source || "N/A"}</span></div>
            ${client.medicare_number ? `<div class="info-row"><span class="label">Medicare Number:</span><span class="value">${client.medicare_number}</span></div>` : ""}
            ${client.dva_card_number ? `<div class="info-row"><span class="label">DVA Card Number:</span><span class="value">${client.dva_card_number}</span></div>` : ""}
            ${client.ndis_number ? `<div class="info-row"><span class="label">NDIS Number:</span><span class="value">${client.ndis_number}</span></div>` : ""}
            ${client.workcover_claim_number ? `<div class="info-row"><span class="label">WorkCover Claim:</span><span class="value">${client.workcover_claim_number}</span></div>` : ""}
          </div>
        `;
      }

      // Medical Conditions
      if ((isFullExport || selectedSections.conditions) && conditions.length > 0) {
        htmlContent += `
          <div class="section">
            <h2>Medical Conditions</h2>
            <table>
              <thead>
                <tr>
                  <th>Condition</th>
                  <th>Type</th>
                  <th>Diagnosis Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${conditions.map(c => `
                  <tr>
                    <td>${c.condition_name}</td>
                    <td>${c.condition_type}</td>
                    <td>${c.diagnosis_date ? format(new Date(c.diagnosis_date), "PPP") : "N/A"}</td>
                    <td><span class="badge ${c.is_active ? 'badge-green' : 'badge-yellow'}">${c.is_active ? "Active" : "Inactive"}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // Medications
      if ((isFullExport || selectedSections.medications) && conditions.some(c => c.medication)) {
        htmlContent += `
          <div class="section">
            <h2>Current Medications</h2>
            <table>
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>For Condition</th>
                </tr>
              </thead>
              <tbody>
                ${conditions.filter(c => c.medication).map(c => `
                  <tr>
                    <td>${c.medication}</td>
                    <td>${c.condition_name}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // Client Goals
      if ((isFullExport || selectedSections.goals) && client.client_goals) {
        htmlContent += `
          <div class="section">
            <h2>Client Goals</h2>
            <p>${client.client_goals.replace(/\n/g, '<br>')}</p>
          </div>
        `;
      }

      // APSS Screening
      if (isFullExport || selectedSections.apss) {
        htmlContent += `
          <div class="section">
            <h2>APSS Pre-Exercise Screening</h2>
            <div class="info-row"><span class="label">Stage 1:</span><span class="value">${client.apss_completed ? '<span class="badge badge-green">Completed</span>' : '<span class="badge badge-yellow">Pending</span>'}</span></div>
            <div class="info-row"><span class="label">Stage 2:</span><span class="value">${client.apss_stage2_completed ? '<span class="badge badge-green">Completed</span>' : '<span class="badge badge-yellow">Pending</span>'}</span></div>
          </div>
        `;
      }

      // Cultural Considerations
      if ((isFullExport || selectedSections.cultural) && client.cultural_considerations) {
        htmlContent += `
          <div class="section">
            <h2>Cultural Considerations</h2>
            <p>${client.cultural_considerations}</p>
          </div>
        `;
      }

      // Assessments
      if ((isFullExport || selectedSections.assessments) && assessments.length > 0) {
        htmlContent += `
          <div class="section">
            <h2>Assessment Results</h2>
            <table>
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Date</th>
                  <th>Result</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${assessments.map(a => {
                  const assessmentInfo = assessmentMap.get(a.assessment_id);
                  return `
                    <tr>
                      <td>${assessmentInfo?.name || "Unknown"}</td>
                      <td>${a.assessment_date ? format(new Date(a.assessment_date), "PPP") : "N/A"}</td>
                      <td>${a.result_value || "N/A"} ${assessmentInfo?.unit_of_measure || ""}</td>
                      <td><span class="badge ${a.status === 'completed' ? 'badge-green' : 'badge-yellow'}">${a.status}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // SOAP Notes
      if ((isFullExport || selectedSections.soapNotes) && soapNotes.length > 0) {
        htmlContent += `
          <div class="section">
            <h2>SOAP Notes</h2>
            ${soapNotes.map(note => `
              <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-left: 4px solid #3b82f6;">
                <h3>${format(new Date(note.note_date), "PPP")}</h3>
                ${note.subjective ? `<p><strong>Subjective:</strong> ${note.subjective}</p>` : ""}
                ${note.objective ? `<p><strong>Objective:</strong> ${note.objective}</p>` : ""}
                ${note.assessment ? `<p><strong>Assessment:</strong> ${note.assessment}</p>` : ""}
                ${note.plan ? `<p><strong>Plan:</strong> ${note.plan}</p>` : ""}
              </div>
            `).join('')}
          </div>
        `;
      }

      // Reports
      if ((isFullExport || selectedSections.reports) && reports.length > 0) {
        htmlContent += `
          <div class="section">
            <h2>Generated Reports</h2>
            <table>
              <thead>
                <tr>
                  <th>Report Name</th>
                  <th>Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${reports.map(r => `
                  <tr>
                    <td>${r.report_name}</td>
                    <td>${r.report_type}</td>
                    <td>${format(new Date(r.report_date), "PPP")}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // Documents
      if ((isFullExport || selectedSections.documents) && documents.length > 0) {
        htmlContent += `
          <div class="section">
            <h2>Documents</h2>
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Upload Date</th>
                </tr>
              </thead>
              <tbody>
                ${documents.map(d => `
                  <tr>
                    <td>${d.file_name}</td>
                    <td>${d.document_type}</td>
                    <td>${format(new Date(d.created_date), "PPP")}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // Nutrition Plans
      if ((isFullExport || selectedSections.nutritionPlans) && nutritionPlans.length > 0) {
        htmlContent += `
          <div class="section">
            <h2>Nutrition Plans</h2>
            ${nutritionPlans.map(plan => `
              <div style="margin: 15px 0; padding: 15px; background: #f0fdf4; border-left: 4px solid #16a34a;">
                <h3>Plan created: ${format(new Date(plan.created_date), "PPP")}</h3>
                ${plan.weight_goal ? `<div class="info-row"><span class="label">Weight Goal:</span><span class="value">${plan.weight_goal}</span></div>` : ""}
                ${plan.recommended_calories ? `<div class="info-row"><span class="label">Recommended Calories:</span><span class="value">${plan.recommended_calories} kcal/day</span></div>` : ""}
                ${plan.nutrition_goals ? `<p><strong>Goals:</strong> ${plan.nutrition_goals}</p>` : ""}
              </div>
            `).join('')}
          </div>
        `;
      }

      htmlContent += `
        </body>
        </html>
      `;

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Wait a moment then trigger print
      setTimeout(() => {
        printWindow.print();
      }, 500);

      toast.success("Client data export opened in new window");
      onClose();
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export client data");
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-blue-600" />
            Export Client Data - {client.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!showSelectMode ? (
            <div className="grid gap-4">
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">All Client Data</h3>
                      <p className="text-sm text-slate-600">
                        Export complete client record including all assessments, notes, reports, and documents
                      </p>
                    </div>
                    <Button 
                      onClick={exportAllData}
                      disabled={isExporting}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      Export All
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Select Client Data</h3>
                      <p className="text-sm text-slate-600">
                        Choose specific sections to include in the export
                      </p>
                    </div>
                    <Button 
                      onClick={() => setShowSelectMode(true)}
                      variant="outline"
                    >
                      Select Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Select Data to Export</h3>
                <div className="flex gap-2">
                  <Button onClick={selectAll} variant="outline" size="sm">Select All</Button>
                  <Button onClick={deselectAll} variant="outline" size="sm">Deselect All</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(sectionLabels).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-slate-50">
                    <Checkbox
                      id={key}
                      checked={selectedSections[key]}
                      onCheckedChange={() => toggleSection(key)}
                    />
                    <label
                      htmlFor={key}
                      className="text-sm font-medium leading-none cursor-pointer flex-1"
                    >
                      {label}
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button onClick={() => setShowSelectMode(false)} variant="outline">
                  Back
                </Button>
                <Button 
                  onClick={exportSelectedData}
                  disabled={isExporting || !Object.values(selectedSections).some(v => v)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Export Selected
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}