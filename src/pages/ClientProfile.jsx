import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import {
  Phone,
  Mail,
  Home,
  FileText,
  Edit,
  Trash2,
  ArrowLeft,
  Calendar,
  Pill,
  Share2,
  Plus,
  User as UserIcon,
  ClipboardList,
  Utensils,
  Download,
} from "lucide-react";
import { format, differenceInYears } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import ClientAssessments from "@/components/client/ClientAssessments";
import ClientConditions from "@/components/client/ClientConditions";
import AssessmentRecommendations from "@/components/client/AssessmentRecommendations";
import MedicationAlerts from "@/components/client/MedicationAlerts";
import SavedReports from "@/components/client/SavedReports";
import EditClientInfoModal from "../components/client/EditClientInfoModal";
import ClientSOAPNotes from "@/components/client/ClientSOAPNotes";
import PrintableOnboardingReport from "../components/client/PrintableOnboardingReport";
import ProgressVisualization from "@/components/client/ProgressVisualization";
import ClientDocuments from "@/components/client/ClientDocuments";
import OnboardingStatus from "@/components/client/OnboardingStatus";
import OnboardingEpisodes from "@/components/client/OnboardingEpisodes";
import NutritionSummaryCard from "@/components/client/NutritionSummaryCard";
import NutritionTab from "@/components/client/NutritionTab";
import ClientDataExporter from "@/components/client/ClientDataExporter";
import AdverseEventsTab from "@/components/client/AdverseEventsTab";

export default function ClientProfile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("id");

  const [client, setClient] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [allAssessments, setAllAssessments] = useState([]);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [showOnboardingReport, setShowOnboardingReport] = useState(false);
  const [showAPSSModal, setShowAPSSModal] = useState(false);
  const [activeTab, setActiveTab] = useState("progress");
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [showDataExporter, setShowDataExporter] = useState(false);

  const referralSourceLabels = {
    gp: "General Practitioner",
    wc_case_manager: "WorkCover Case Manager",
    aged_care_case_manager: "Aged Care Case Manager",
    ndis_support_coordinator: "NDIS Support Coordinator",
    dva: "DVA",
    self_referral: "Self Referral",
    other: "Other",
  };

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const refreshAssessments = async () => {
    try {
      const rawAssessmentsData = await base44.entities.ClientAssessment.filter({ client_id: clientId });
      const assessmentsData = rawAssessmentsData
        .filter(assessment => {
          if (!assessment.assessment_date) return true;
          const testDate = new Date(assessment.assessment_date);
          return !isNaN(testDate.getTime());
        })
        .sort((a, b) => {
          if (!a.assessment_date) return 1;
          if (!b.assessment_date) return -1;
          return new Date(b.assessment_date) - new Date(a.assessment_date);
        });
      setAssessments(assessmentsData);
    } catch (error) {
      console.error("Error refreshing assessments:", error);
    }
  };

  const loadClientData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      const memberships = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
      
      if (memberships.length === 0) {
        toast.error("You don't belong to any organization.");
        navigate(createPageUrl("Clients"));
        return;
      }
      
      const userOrgId = (memberships.find(m => m.is_primary) || memberships[0]).org_id;
      
      const clientData = await base44.entities.Client.filter({ 
        id: clientId,
        org_id: userOrgId 
      });
      
      if (clientData.length === 0) {
        toast.error("Client not found or you don't have permission to view this client.");
        navigate(createPageUrl("Clients"));
        return;
      }

      const client = clientData[0];
      setClient(client);

      const [conditionsData, rawAssessmentsData, allAssessmentsData] = await Promise.all([
        base44.entities.ClientCondition.filter({ client_id: clientId }),
        base44.entities.ClientAssessment.filter({ client_id: clientId }),
        base44.entities.Assessment.list(),
      ]);

      const assessmentsData = rawAssessmentsData
        .filter(assessment => {
          if (!assessment.assessment_date) return true;
          const testDate = new Date(assessment.assessment_date);
          if (isNaN(testDate.getTime())) {
            console.warn('Skipping assessment with invalid date:', assessment.assessment_date);
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          if (!a.assessment_date) return 1;
          if (!b.assessment_date) return -1;
          return new Date(b.assessment_date) - new Date(a.assessment_date);
        });

      setConditions(conditionsData);
      setAssessments(assessmentsData);
      setAllAssessments(allAssessmentsData);

    } catch (error) {
      console.error("Error loading client data:", error);
      toast.error("Failed to load client data.");
      navigate(createPageUrl("Clients"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    try {
      // Retention model: archive, never destroy — see Clients.jsx
      // handleDeleteClient for the rationale (orphaning + retention).
      await base44.entities.Client.update(client.id, {
        archived: true,
        archived_date: new Date().toISOString(),
      });
      toast.success(`Client "${client.full_name}" has been archived.`);
      navigate(createPageUrl("Clients"));
    } catch (error) {
      console.error("Error archiving client:", error);
      toast.error("Failed to archive client.");
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const parseDate = (dateString) => {
    if (!dateString) return null;
    let date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
    const parts = dateString.split('/');
    if (parts.length === 3) {
      date = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
      if (!isNaN(date.getTime())) return date;
    }
    return null;
  };

  const getAge = (dateOfBirth) => {
    const dob = parseDate(dateOfBirth);
    if (!dob) return "N/A";
    return differenceInYears(new Date(), dob);
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <p>Loading client profile...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 text-center">
        <p>Client not found.</p>
      </div>
    );
  }

  return (
    <>
      <Toaster richColors position="top-center" />
      
      {showOnboardingReport && (
        <PrintableOnboardingReport 
          client={client}
          onClose={() => setShowOnboardingReport(false)}
        />
      )}

      {editingSection && (
        <EditClientInfoModal
          client={client}
          section={editingSection}
          conditions={conditions}
          onClose={() => setEditingSection(null)}
          onSuccess={() => {
            setEditingSection(null);
            loadClientData();
          }}
        />
      )}

      {showAPSSModal && (
        <EditClientInfoModal
          client={client}
          section="apss"
          conditions={conditions}
          onClose={() => setShowAPSSModal(false)}
          onSuccess={() => {
            setShowAPSSModal(false);
            loadClientData();
          }}
        />
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive{" "}
              <span className="font-bold">{client.full_name}</span>? The client will no
              longer appear in your lists, but their records are retained securely in
              line with clinical record-keeping obligations and can be restored by an
              administrator.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteClient}>
              Archive Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate(createPageUrl("Clients"))}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <UserIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    {client.full_name}
                  </h1>
                  <p className="text-slate-600">
                    Age {getAge(client.date_of_birth)} • Client Profile
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowOnboardingReport(true)}
                variant="outline"
                className="bg-white"
              >
                <FileText className="w-4 h-4 mr-2" />
                View Onboarding Report
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <UserIcon className="w-5 h-5 text-blue-600" />
                      Personal Information
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setEditingSection('personal')}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-600">Date of Birth:</span>
                    <span className="font-medium">
                      {client.date_of_birth && parseDate(client.date_of_birth)
                        ? format(parseDate(client.date_of_birth), "PPP")
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-600">Gender:</span>
                    <span className="font-medium capitalize">
                      {client.gender === "other" ? client.gender_other : client.gender || "N/A"}
                    </span>
                  </div>
                  {client.pronouns && (
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4"></span>
                      <span className="text-sm text-slate-600">Pronouns:</span>
                      <span className="font-medium">{client.pronouns}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-blue-600" />
                      Contact Details
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setEditingSection('contact')}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-600">Phone:</span>
                    <span className="font-medium">{client.phone || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-600">Email:</span>
                    <span className="font-medium">{client.email || "N/A"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Home className="w-4 h-4 text-slate-500 mt-0.5" />
                    <span className="text-sm text-slate-600">Address:</span>
                    <span className="font-medium">{client.address || "N/A"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Share2 className="w-5 h-5 text-blue-600" />
                      Referral Information
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setEditingSection('referral')}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(client.referral_source || client.referral_source_name) && (
                    <div className="pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default" className="bg-blue-600">Primary Referral</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-600">Source:</span>
                          <Badge variant="secondary">
                            {referralSourceLabels[client.referral_source] || client.referral_source || "N/A"}
                          </Badge>
                        </div>
                        {client.referral_source_name && (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600">Referrer:</span>
                            <span className="font-medium">{client.referral_source_name}</span>
                          </div>
                        )}
                        {client.referral_date && parseDate(client.referral_date) && (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600">Date:</span>
                            <span className="font-medium">{format(parseDate(client.referral_date), "PPP")}</span>
                          </div>
                        )}
                        {client.referral_reason && (
                          <div className="space-y-1">
                            <span className="text-sm text-slate-600">Reason:</span>
                            <p className="text-sm font-medium">{client.referral_reason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {client.additional_referrals && client.additional_referrals.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700">Additional Referrals:</h4>
                      {client.additional_referrals.map((referral, index) => (
                        <div key={index} className="p-3 bg-slate-50 rounded-lg space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600">Source:</span>
                            <Badge variant="outline">
                              {referralSourceLabels[referral.referral_source] || referral.referral_source}
                            </Badge>
                          </div>
                          {referral.referral_source_name && (
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-slate-600">Referrer:</span>
                              <span className="font-medium text-sm">{referral.referral_source_name}</span>
                            </div>
                          )}
                          {referral.referral_date && parseDate(referral.referral_date) && (
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-slate-600">Date:</span>
                              <span className="font-medium text-sm">{format(parseDate(referral.referral_date), "PPP")}</span>
                            </div>
                          )}
                          {referral.referral_reason && (
                            <div className="space-y-1">
                              <span className="text-sm text-slate-600">Reason:</span>
                              <p className="text-sm">{referral.referral_reason}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!client.referral_source && !client.referral_source_name && (!client.additional_referrals || client.additional_referrals.length === 0) && (
                    <p className="text-slate-500 text-sm">No referral information recorded</p>
                  )}
                </CardContent>
              </Card>

              <ClientConditions
                conditions={conditions}
                clientId={clientId}
                onConditionsUpdated={loadClientData}
                selectedCondition={selectedCondition}
                setSelectedCondition={setSelectedCondition}
              />

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Pill className="w-5 h-5 text-blue-600" />
                      Current Medications
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setEditingSection('medications')}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {conditions.filter(c => c.medication && c.medication.trim() !== "").length > 0 ? (
                    <div className="space-y-2">
                      {conditions
                        .filter(c => c.medication && c.medication.trim() !== "")
                        .map((condition, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                            <span className="font-medium">{condition.medication}</span>
                            <span className="text-sm text-slate-600">for {condition.condition_name}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No medications recorded</p>
                  )}
                </CardContent>
              </Card>
              
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Client Goals
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setEditingSection('goals')}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {client.client_goals ? (
                    <p className="text-sm text-slate-700 whitespace-pre-line">{client.client_goals}</p>
                  ) : (
                    <p className="text-slate-500 text-sm">No goals recorded</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-blue-600" />
                      Pre-Exercise Screening
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setShowAPSSModal(true)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg border ${client.apss_completed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Safety Screen</span>
                        {client.apss_completed ? (
                          <Badge className="bg-green-100 text-green-700 border-0">Completed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-700 border-yellow-300">Pending</Badge>
                        )}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg border ${client.apss_stage2_completed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Clinical Risk Review</span>
                        {client.apss_stage2_completed ? (
                          <Badge className="bg-green-100 text-green-700 border-0">Completed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-700 border-yellow-300">Pending</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setShowAPSSModal(true)}>
                    {client.apss_completed || client.apss_stage2_completed ? 'Update Screening' : 'Complete Screening'}
                  </Button>
                </CardContent>
              </Card>

              {client.cultural_considerations && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-blue-600" />
                        Cultural Considerations
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setEditingSection('cultural')}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700">{client.cultural_considerations}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <OnboardingStatus client={client} conditions={conditions} />
              <OnboardingEpisodes client={client} onReOnboardStarted={() => {}} />
              <ClientDocuments 
                clientId={clientId} 
                client={client}
              />
              <NutritionSummaryCard 
                clientId={clientId}
                client={client}
                onCreatePlan={() => setShowNutritionModal(true)}
              />
              <MedicationAlerts
                conditions={conditions}
                client={client}
                clientAge={getAge(client.date_of_birth)}
              />
            </div>
          </div>

          <AssessmentRecommendations
            clientConditions={conditions}
            allAssessments={allAssessments}
            clientAssessments={assessments}
            clientId={clientId}
            onAssessmentAdded={loadClientData}
            client={client}
          />

          <SavedReports client={client} />

          <ClientSOAPNotes client={client} />

          <ClientAssessments
            client={client}
            clientAssessments={assessments}
            allAssessments={allAssessments}
            onAssessmentUpdate={refreshAssessments}
          />

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardHeader>
              <CardTitle>Progress Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressVisualization client={client} conditions={conditions} />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-900">
                <Download className="w-5 h-5" />
                Client Data Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 mb-4">
                Export all client information in a comprehensive PDF format for client requests, data portability, or compliance purposes.
              </p>
              <Button onClick={() => setShowDataExporter(true)} className="w-full bg-purple-600 hover:bg-purple-700">
                <Download className="w-4 h-4 mr-2" />
                Export Client Data
              </Button>
            </CardContent>
          </Card>

          <AdverseEventsTab client={client} />
        </div>
      </div>

      <Dialog open={showNutritionModal} onOpenChange={setShowNutritionModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-green-600" />
              Nutrition Plan - {client.full_name}
            </DialogTitle>
          </DialogHeader>
          <NutritionTab client={client} onUpdate={loadClientData} />
        </DialogContent>
      </Dialog>

      <ClientDataExporter
        client={client}
        isOpen={showDataExporter}
        onClose={() => setShowDataExporter(false)}
      />
    </>
  );
}
