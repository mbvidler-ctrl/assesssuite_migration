import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Eye,
  Calendar,
  Edit,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Printer
} from "lucide-react";
import { format } from "date-fns";
import { Toaster, toast } from "sonner";
import UnifiedReportWizard from "../reports/UnifiedReportWizard";

// All report type labels â€” used for display in saved list
const ALL_REPORT_LABELS = {
  gp_summary: "GP Summary Letter",
  gp_progress_letter: "GP Progress Letter",
  gp_discharge: "GP Discharge Summary",
  specialist_referral_letter: "Specialist Referral Letter",
  treating_team_update: "Treating Team Update",
  ep_discharge: "Discharge Summary (General)",
  ep_annual_review: "Annual Review",
  ep_referral_letter: "Referral Letter",
  custom_report: "Custom Report",
  workcover_pmp: "WorkCover PMP",
  workcover_progress: "WorkCover Progress Report",
  workcover_discharge: "WorkCover Discharge / Closure",
  workcover_capacity: "Work Capacity Certificate",
  workplace_rtw_plan: "Return to Work Plan",
  workplace_job_demands: "Job Demands Analysis",
  workplace_ergonomic: "Ergonomic / Worksite Assessment",
  tac_functional: "TAC Functional Assessment (VIC)",
  tac_progress: "TAC Progress Report (VIC)",
  maic_functional: "MAIC Functional Assessment (QLD)",
  maic_progress: "MAIC Progress Report (QLD)",
  ctp_nsw: "CTP / SIRA Assessment (NSW)",
  ctp_sa: "CTP Assessment (SA)",
  dva_patient_care_plan: "DVA Patient Care Plan",
  dva_end_cycle_report: "DVA End of Cycle Report",
  medicare_referral_acceptance: "Medicare Referral Acceptance",
  medicare_initial: "Medicare Initial Assessment",
  medicare_final: "Medicare Final Report",
  ep_diabetes_management: "Chronic Disease Management Report (Diabetes)",
  ep_cardiac_rehab: "Cardiac Rehabilitation Report",
  ep_pulmonary_rehab: "Pulmonary Rehabilitation Assessment",
  ep_cancer_rehab: "Cancer Rehabilitation Assessment",
  private_health_initial: "Private Health Initial Assessment",
  private_health_progress: "Private Health Progress Report",
  ndis_initial: "NDIS Initial Assessment",
  ndis_progress: "NDIS Progress Report",
  ndis_functional_capacity: "NDIS Functional Capacity Assessment",
  ndis_support_justification: "NDIS Support Justification Letter",
  aged_care_assessment: "Aged Care Assessment",
  my_aged_care_initial: "My Aged Care Initial Assessment",
  my_aged_care_progress: "My Aged Care Progress Review",
  ep_fall_prevention: "Falls Prevention Assessment",
  ep_exercise_prescription: "Exercise Prescription Report",
  ep_fitness_for_duty: "Fitness for Duty / Pre-Employment Assessment",
  ep_home_exercise: "Home Exercise Program Report",
  insurance_medical_report: "Independent Medical Report (Insurance)",
  legal_medico_legal: "Medico-Legal / Expert Witness Report",
  life_insurance: "Life Insurance Functional Assessment",
  us_initial_evaluation: "Initial Evaluation / Examination",
  us_progress_report: "Progress Report / Re-examination",
  us_discharge_summary: "Discharge Summary",
  us_plan_of_care: "Plan of Care / Certification",
  us_prior_auth: "Prior Authorization Request",
};

export default function SavedReports({ client }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [wizardReportType, setWizardReportType] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [viewingReport, setViewingReport] = useState(null);

  useEffect(() => {
    if (client && client.id) {
      loadReports();
    }
  }, [client?.id]);

  const loadReports = async () => {
    if (!client || !client.id) return;
    setIsLoading(true);
    try {
      const reportsData = await base44.entities.SavedReport.filter({ client_id: client.id });
      setReports(reportsData.sort((a, b) => new Date(b.report_date) - new Date(a.report_date)));
    } catch (error) {
      console.error("Error loading reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this report?")) {
      try {
        await base44.entities.SavedReport.delete(reportId);
        toast.success("Report deleted");
        loadReports();
      } catch (error) {
        console.error("Error deleting report:", error);
        toast.error("Failed to delete report");
      }
    }
  };

  const handleEditReport = (report, e) => {
    e.stopPropagation();
    setEditingReport(report);
    setWizardReportType(report.report_type);
    setShowWizard(true);
  };

  const handleViewReport = (report, e) => {
    e.stopPropagation();
    setViewingReport(report);
  };

  const handlePrintReport = (report, e) => {
    e && e.stopPropagation();
    const html = report.report_html || report.html_content;
    if (!html) {
      toast.error("No printable content for this report");
      return;
    }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleWizardClose = () => {
    setShowWizard(false);
    setEditingReport(null);
    setWizardReportType(null);
    loadReports();
  };

  const getReportLabel = (reportType) => {
    return ALL_REPORT_LABELS[reportType] || reportType?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Report';
  };

  if (!client || !client.id) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardContent className="py-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-slate-500">Loading reports...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Toaster richColors position="top-center" />

      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Client Reports
              </CardTitle>
              <Badge variant="secondary">{reports.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(createPageUrl("Reports") + `?clientId=${client.id}`);
                }}
                className="bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Report
              </Button>
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent>
            {isLoading ? (
              <p className="text-center text-slate-500 py-8">Loading reports...</p>
            ) : reports.length > 0 ? (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">{report.report_name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {getReportLabel(report.report_type)}
                          </Badge>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(report.report_date), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={(e) => handleViewReport(report, e)} title="View">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={(e) => handlePrintReport(report, e)} title="Print">
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={(e) => handleEditReport(report, e)} title="Edit">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleDeleteReport(report.id, e)}
                        className="text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No reports generated yet</p>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(createPageUrl("Reports") + `?clientId=${client.id}`);
                  }}
                  variant="outline"
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Report
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Edit via UnifiedReportWizard */}
      {showWizard && wizardReportType && (
        <UnifiedReportWizard
          isOpen={showWizard}
          onClose={handleWizardClose}
          client={client}
          existingReport={editingReport}
        />
      )}

      {/* View Report Modal */}
      {viewingReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{viewingReport.report_name}</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {format(new Date(viewingReport.report_date), 'dd MMMM yyyy')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePrintReport(viewingReport)}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" onClick={() => setViewingReport(null)}>Close</Button>
              </div>
            </div>
            <div className="p-6">
                      {(viewingReport.report_html || viewingReport.html_content) ? (
                <div dangerouslySetInnerHTML={{ __html: viewingReport.report_html || viewingReport.html_content }} />
              ) : (
                <pre className="whitespace-pre-wrap text-sm">No content available.</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}