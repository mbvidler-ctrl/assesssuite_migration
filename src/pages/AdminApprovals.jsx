import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, Mail, User as UserIcon, Loader2, ShieldCheck, Settings, Key, Eye, FileText, Scale, BarChart3, MessageSquare, Users, Search, Library, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Sparkles, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import AssessmentModal from "@/components/assessments/AssessmentModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LEGAL_DOCS = {
  terms_conditions_global: { title: "Terms & Conditions", icon: Scale },
  privacy_policy_global: { title: "Privacy Policy", icon: ShieldCheck },
  medical_health_disclaimer_global: { title: "Medical & Health Disclaimer", icon: AlertCircle },
  professional_use_disclaimer_global: { title: "Professional Use Disclaimer", icon: FileText },
  ai_automation_transparency_global: { title: "AI & Automation Transparency", icon: Sparkles }
};

const LEGAL_DOCUMENT_CONTENT = {
  terms_conditions_global: `## TERMS & CONDITIONS

**AssessSuite**

Last updated: 30 December 2025

### 1. Acceptance of Terms

By accessing or using AssessSuite (the "Application", "Service"), you agree to be bound by these Terms & Conditions and all incorporated policies. If you do not agree, you must not use the Application.

### 2. Intended Users

AssessSuite is intended for qualified health professionals (including Exercise Physiologists and other allied health professionals) and authorised end users accessing the Application under appropriate professional supervision. You confirm that you are legally permitted to use the Application in your jurisdiction.

### 3. Nature of the Application

AssessSuite is a clinical decision-support and documentation platform.
The Application provides assessment frameworks, reference information, workflow tools, and reporting support.

AssessSuite does not provide medical advice, diagnosis, or treatment and does not replace professional judgement or clinical responsibility. All outputs are assistive only.

### 4. Account Responsibility

You are responsible for maintaining the confidentiality of your login credentials and for all activity conducted under your account. Information entered into the Application must be accurate, lawful, and appropriate for clinical use.

AssessSuite may suspend or terminate accounts where misuse, unauthorised access, data scraping, reverse engineering, or other suspicious activity is detected.

### 5. Intellectual Property

All software, workflows, assessment logic, prompts, templates, reports, layouts, and underlying systems within AssessSuite are the intellectual property of AssessSuite unless otherwise stated.

You may not copy, reproduce, reverse engineer, scrape, distribute, commercialise, or use any part of the Application to create competing products or services.

### 6. Fees and Billing

Access to AssessSuite may require payment. By subscribing, you agree to the pricing, billing cycle, and payment terms presented at the time of purchase. Prices may change with reasonable notice.

### 7. No Refund and No Cancellation Policy

All payments are final.

Due to immediate access to proprietary software, workflows, and intellectual property:

- No refunds are provided for any reason
- No partial refunds are provided for unused time
- No refunds are provided for change of mind or non-use

Nothing in this section excludes rights that cannot be excluded under applicable consumer protection laws.

### 8. Suspension and Termination

AssessSuite may suspend or terminate access without refund if these Terms are breached, the Application is used unlawfully, or intellectual property misuse is suspected.

### 9. Limitation of Liability

To the maximum extent permitted by law, AssessSuite is provided "as is". AssessSuite is not liable for clinical outcomes, decisions, or actions taken based on Application outputs. Any liability is limited to the amount paid by the user in the preceding three months, if any.

### 10. Governing Law

These Terms are governed by the laws of Australia. Mandatory consumer rights under applicable local laws are not excluded.`,

  privacy_policy_global: `## PRIVACY POLICY

**AssessSuite**

Last updated: 30 December 2025

### 1. Information Collected

AssessSuite may collect personal information such as name, email address, professional details, usage data, and health-related data entered by users as part of clinical workflows.

### 2. Sensitive and Health Data

Health and assessment data entered into AssessSuite is treated as sensitive information and handled with enhanced safeguards.

### 3. Use of Information

Information is used to:

- Operate and improve the Application
- Generate clinical reports and documentation
- Maintain security and audit integrity
- Comply with legal and regulatory obligations

AssessSuite does not sell user data.

### 4. Data Storage and Transfers

Data may be stored or processed in jurisdictions outside your own. Appropriate safeguards are implemented consistent with recognised data protection principles.

### 5. User Rights

Users may request access to their data, correction of inaccuracies, or deletion of data, subject to legal, clinical, and record-keeping obligations.

### 6. Security

AssessSuite implements reasonable administrative, technical, and organisational measures to protect data. No system is completely secure, and users acknowledge this risk.`,

  medical_health_disclaimer_global: `## MEDICAL & HEALTH DISCLAIMER

**AssessSuite**

Last updated: 30 December 2025

AssessSuite does not provide medical advice, diagnosis, or treatment.

The Application is not intended for emergency use and does not replace consultation with qualified healthcare providers. Information generated by AssessSuite should not be relied upon as the sole basis for clinical decisions.

Clinicians must apply independent professional judgement at all times.`,

  professional_use_disclaimer_global: `## PROFESSIONAL USE DISCLAIMER

**AssessSuite**

Last updated: 30 December 2025

AssessSuite is a clinical support tool only.

Responsibility for:

- Assessment selection
- Interpretation of results
- Clinical decision-making
- Client safety

remains entirely with the treating clinician.

Use of AssessSuite does not create a clinician–patient relationship between AssessSuite and any user or client.`,

  ai_automation_transparency_global: `## AI & AUTOMATION TRANSPARENCY

**AssessSuite**

Last updated: 30 December 2025

AssessSuite may use automated processes to assist with:

- Structuring assessments
- Generating summaries
- Comparing reference or normative information

Automation is assistive only and does not replace professional oversight. Outputs may require clinician review, modification, or rejection before use.`
};

export default function AdminApprovals() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState(null);
  const [viewingUserOrgId, setViewingUserOrgId] = useState(null);
  const [legalAcceptances, setLegalAcceptances] = useState([]);
  const [viewingAcceptance, setViewingAcceptance] = useState(null);
  const [comorbidityReport, setComorbidityReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [selectedUserForReport, setSelectedUserForReport] = useState(null);
  const [activeTab, setActiveTab] = useState('users');
  const [assessmentRequests, setAssessmentRequests] = useState([]);
  const [orgAssignResults, setOrgAssignResults] = useState(null);
  const [assigningOrgs, setAssigningOrgs] = useState(false);
  const [viewingUserClients, setViewingUserClients] = useState(null);
  const [userClients, setUserClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [assessmentSearch, setAssessmentSearch] = useState("");
  const [assessmentFilter, setAssessmentFilter] = useState("all"); // all | complete | incomplete | duplicate
  const [viewingAssessment, setViewingAssessment] = useState(null);
  const [deletingAssessment, setDeletingAssessment] = useState(null);
  const [expandedAssessments, setExpandedAssessments] = useState(new Set());
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [activatingUser, setActivatingUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      if (user.role !== 'admin') {
        toast.error("Access denied. Admin only.");
        return;
      }

      const [allUsers, acceptances, requests, allAssessments] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.LegalAcceptance.list('-created_date'),
        base44.entities.AssessmentRequest.list('-created_date'),
        base44.entities.Assessment.list()
      ]);
      setUsers(allUsers);
      setLegalAcceptances(acceptances);
      setAssessmentRequests(requests);
      setAssessments(allAssessments.filter(a => !a.is_deleted).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users.");
    }
    setLoading(false);
  };

  const handleDeleteAssessment = async (assessmentId) => {
    try {
      await base44.entities.Assessment.update(assessmentId, { 
        is_deleted: true,
        deleted_date: new Date().toISOString()
      });
      console.log("Assessment marked as deleted:", assessmentId);
      toast.success("Assessment deleted successfully");
      setDeletingAssessment(null);
      await loadData(); // Wait for reload to complete
    } catch (error) {
      console.error("Error deleting assessment:", error);
      toast.error("Failed to delete assessment");
    }
  };

  const toggleExpanded = (assessmentId) => {
    const newExpanded = new Set(expandedAssessments);
    if (newExpanded.has(assessmentId)) {
      newExpanded.delete(assessmentId);
    } else {
      newExpanded.add(assessmentId);
    }
    setExpandedAssessments(newExpanded);
  };

  const startEditing = (assessment) => {
    setEditingAssessmentId(assessment.id);
    setEditingData({
      has_test_runner: assessment.has_test_runner || false,
      results_add_to_soap: assessment.results_add_to_soap || false,
      has_normatives: assessment.has_normatives || false,
      has_instructions: assessment.has_instructions || false,
      has_references: assessment.has_references || false,
      search_tags: assessment.search_tags || []
    });
  };

  const saveAssessment = async (assessmentId) => {
    try {
      await base44.entities.Assessment.update(assessmentId, editingData);
      toast.success("Assessment updated successfully");
      setEditingAssessmentId(null);
      await loadData();
    } catch (error) {
      console.error("Error updating assessment:", error);
      toast.error("Failed to update assessment");
    }
  };

  const isAssessmentComplete = (assessment) => {
    return (
      (assessment.has_test_runner || false) &&
      (assessment.results_add_to_soap || false) &&
      (assessment.has_normatives || false) &&
      (assessment.has_instructions || false) &&
      (assessment.has_references || false)
    );
  };

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      let updatedCount = 0;
      let checksPassed = 0;
      let checksFailed = 0;
      
      for (const assessment of assessments) {
        let checks = {
          has_test_runner: false,
          results_add_to_soap: false,
          has_normatives: false,
          has_instructions: false,
          has_references: false
        };
        
        // 1. Has Test Runner: Check if assessment has proper test infrastructure
        // Questionnaires must have questions array with proper structure
        if (assessment.is_questionnaire) {
          if (assessment.questions && 
              Array.isArray(assessment.questions) && 
              assessment.questions.length > 0 &&
              assessment.questions.every(q => q.question_text && q.question_type)) {
            checks.has_test_runner = true;
          }
        } else {
          // Performance tests need unit_of_measure to run
          if (assessment.unit_of_measure && 
              assessment.unit_of_measure.trim().length > 0) {
            checks.has_test_runner = true;
          }
        }
        
        // 2. Results Add to SOAP: Must have complete configuration for SOAP export
        // Check for proper unit of measure OR questionnaire with scoring
        if (assessment.is_questionnaire) {
          if (assessment.scoring_system && 
              assessment.scoring_system.trim().length > 0 &&
              assessment.unit_of_measure &&
              assessment.unit_of_measure.trim().length > 0) {
            checks.results_add_to_soap = true;
          }
        } else {
          if (assessment.unit_of_measure && 
              assessment.unit_of_measure.trim().length > 0 &&
              assessment.scoring_system &&
              assessment.scoring_system.trim().length > 0) {
            checks.results_add_to_soap = true;
          }
        }
        
        // 3. Has Normatives: Verify VALID norms exist
        if (assessment.normative_data && 
            Array.isArray(assessment.normative_data) && 
            assessment.normative_data.length > 0) {
          const validNormatives = assessment.normative_data.every(norm => 
            norm.age_min !== undefined && 
            norm.age_max !== undefined && 
            norm.gender &&
            (norm.mean !== undefined || norm.percentile_25 !== undefined || norm.percentile_75 !== undefined)
          );
          if (validNormatives) {
            checks.has_normatives = true;
          }
        }
        
        // 4. Has Instructions: Must have clinician instructions AND client script
        if (assessment.instructions && 
            assessment.instructions.trim().length > 100 &&
            // Check for both instruction sections
            (assessment.instructions.toLowerCase().includes('instructions') || 
             assessment.instructions.toLowerCase().includes('protocol') ||
             assessment.instructions.toLowerCase().includes('procedure'))) {
          checks.has_instructions = true;
        }
        
        // 5. Has References: Must be REAL ARTICLES not books
        // Look for journal patterns, DOI, or year in parentheses (academic citation format)
        if (assessment.references && assessment.references.trim().length > 30) {
          const refs = assessment.references.toLowerCase();
          // Check for journal article indicators (not books)
          const hasJournalPattern = (
            refs.includes('journal') || 
            refs.includes('doi') ||
            refs.includes('et al') ||
            /\(\d{4}\)/.test(refs) || // Year in parentheses
            refs.includes('vol') ||
            refs.includes('pp.')
          );
          // Exclude books
          const hasBookPattern = (
            refs.includes('manual') ||
            refs.includes('handbook') ||
            refs.includes('textbook') ||
            refs.includes('press')
          );
          
          if (hasJournalPattern && !hasBookPattern) {
            checks.has_references = true;
          }
        }
        
        // Count results
        const passedCount = Object.values(checks).filter(v => v).length;
        if (passedCount === 5) checksPassed++;
        else checksFailed++;
        
        // Only update if something changed
        const needsUpdate = (
          assessment.has_test_runner !== checks.has_test_runner ||
          assessment.results_add_to_soap !== checks.results_add_to_soap ||
          assessment.has_normatives !== checks.has_normatives ||
          assessment.has_instructions !== checks.has_instructions ||
          assessment.has_references !== checks.has_references
        );
        
        if (needsUpdate) {
          await base44.entities.Assessment.update(assessment.id, checks);
          updatedCount++;
        }
      }
      
      toast.success(`Diagnostics complete! ${checksPassed} complete, ${checksFailed} need work. Updated ${updatedCount} assessments.`);
      await loadData();
    } catch (error) {
      console.error("Error running diagnostics:", error);
      toast.error("Failed to run diagnostics");
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const updateRequestStatus = async (requestId, status) => {
    try {
      await base44.entities.AssessmentRequest.update(requestId, { status });
      toast.success("Request status updated");
      loadData();
    } catch (error) {
      console.error("Error updating request:", error);
      toast.error("Failed to update request");
    }
  };

  const handleApprove = async (userId, userEmail) => {
    try {
      await base44.entities.User.update(userId, {
        account_status: "active",
        approved_by: currentUser.email,
        approved_date: new Date().toISOString()
      });
      toast.success(`Approved ${userEmail}`);
      loadData();
    } catch (error) {
      console.error("Error approving user:", error);
      toast.error("Failed to approve user.");
    }
  };

  const handleReject = async (userId, userEmail) => {
    try {
      await base44.entities.User.update(userId, {
        account_status: "rejected"
      });
      toast.success(`Rejected ${userEmail}`);
      loadData();
    } catch (error) {
      console.error("Error rejecting user:", error);
      toast.error("Failed to reject user.");
    }
  };

  const handleSuspend = async (userId, userEmail) => {
    try {
      await base44.entities.User.update(userId, {
        account_status: "suspended"
      });
      toast.success(`Suspended ${userEmail}`);
      loadData();
    } catch (error) {
      console.error("Error suspending user:", error);
      toast.error("Failed to suspend user.");
    }
  };

  const handleReactivate = async (userId, userEmail) => {
    try {
      await base44.entities.User.update(userId, {
        account_status: "active"
      });
      toast.success(`Reactivated ${userEmail}`);
      loadData();
    } catch (error) {
      console.error("Error reactivating user:", error);
      toast.error("Failed to reactivate user.");
    }
  };

  const loadComorbidityReport = async (userEmail = null) => {
    setLoadingReport(true);
    setSelectedUserForReport(userEmail);
    try {
      const response = await base44.functions.invoke('getComorbidityReport', { userEmail });
      console.log("Comorbidity report response:", response);
      const data = response.data || response;
      setComorbidityReport(data || { total_comorbidities: 0, unique_comorbidities: 0, comorbidities: [] });
    } catch (error) {
      console.error("Error loading comorbidity report:", error);
      toast.error("Failed to load comorbidity report.");
      setComorbidityReport({ total_comorbidities: 0, unique_comorbidities: 0, comorbidities: [] });
    }
    setLoadingReport(false);
  };

  const pendingUsers = users.filter(u => u.account_status === 'pending' || !u.account_status);
  const activeUsers = users.filter(u => u.account_status === 'active');
  const rejectedUsers = users.filter(u => u.account_status === 'rejected');
  const suspendedUsers = users.filter(u => u.account_status === 'suspended');

  // Check if an assessment is a potential duplicate
  const isDuplicate = (assessment, allAssessments) => {
    // Skip if explicitly marked as NOT a duplicate
    if (assessment.confirmed_not_duplicate) return false;
    
    const normalizeName = (name) => {
      return name
        .toLowerCase()
        .replace(/[()-]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/thirty/g, '30')
        .replace(/sixty/g, '60')
        .replace(/six/g, '6')
        .replace(/two/g, '2')
        .replace(/one/g, '1')
        .replace(/minute/g, 'min')
        .replace(/second/g, 'sec')
        .trim();
    };

    const currentNormalized = normalizeName(assessment.name);
    
    return allAssessments.some(other => {
      if (other.id === assessment.id) return false;
      // Skip if other is also marked as NOT a duplicate
      if (other.confirmed_not_duplicate) return false;
      
      const otherNormalized = normalizeName(other.name);
      
      // Check for very similar names (Levenshtein distance or simple includes)
      if (currentNormalized === otherNormalized) return true;
      // Only flag as duplicate if the shorter name is at least 80% the length of the longer one
      // This prevents "Sit and Reach" from matching "Chair Sit and Reach Test"
      const shorter = currentNormalized.length < otherNormalized.length ? currentNormalized : otherNormalized;
      const longer = currentNormalized.length >= otherNormalized.length ? currentNormalized : otherNormalized;
      if (shorter.length / longer.length >= 0.8 && (currentNormalized.includes(otherNormalized) || otherNormalized.includes(currentNormalized))) return true;
      
      return false;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldCheck className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
            <p className="text-slate-600">You need admin privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Settings</h1>
            <p className="text-slate-600">Manage account access, approvals, and view legal acceptances</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              Requests
              {assessmentRequests.filter(r => r.status === 'pending').length > 0 && (
                <Badge className="ml-1 bg-yellow-600 hover:bg-yellow-700">
                  {assessmentRequests.filter(r => r.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="assessments">Assessments</TabsTrigger>
            <TabsTrigger value="legal">Legal</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="reports" onClick={() => loadComorbidityReport()}>Reports</TabsTrigger>
            <TabsTrigger value="utilities">Utilities</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6 mt-6">

        {/* Awaiting Payment (manual activation is a fallback for exceptions only) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              Awaiting Payment ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
              <p>
                Accounts activate automatically on successful subscription payment. Manual activation here is a fallback for exceptions only (e.g. an out-of-band payment or a webhook failure).
              </p>
            </div>
            {pendingUsers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No accounts awaiting payment</p>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((user) => {
                  const paymentFailed = user.subscription_status === 'payment_failed';
                  return (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${paymentFailed ? 'bg-red-50 border-red-200' : 'bg-yellow-50'}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <UserIcon className="w-4 h-4 text-slate-600" />
                        <p className="font-semibold">{user.clinician_name || user.full_name || user.email}</p>
                        {paymentFailed && (
                          <Badge variant="destructive" className="text-xs">Payment failed</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail className="w-3 h-3" />
                        <p>{user.email}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Registered: {moment(user.created_date).format('MMM D, YYYY h:mm A')}
                      </p>
                      {user.profession && (
                        <Badge variant="outline" className="mt-2">{user.profession}</Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setActivatingUser(user)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Activate without payment
                      </Button>
                      <Button
                        onClick={() => handleReject(user.id, user.email)}
                        variant="destructive"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Active Users ({activeUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{user.clinician_name || user.full_name || user.email}</p>
                    <p className="text-sm text-slate-600">{user.email}</p>
                    {user.profession && <Badge variant="outline" className="mt-1 text-xs">{user.profession}</Badge>}
                    {user.approved_date && (
                      <p className="text-xs text-slate-500 mt-1">
                        Approved: {moment(user.approved_date).format('MMM D, YYYY')}
                      </p>
                    )}
                    {user.last_active && (
                      <p className="text-xs text-slate-500 mt-1">
                        Last active: {moment(user.last_active).fromNow()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        // Fetch fresh user data first
                        try {
                          const allUsers = await base44.entities.User.list();
                          const freshUser = allUsers.find(u => u.id === user.id);
                          setViewingUser(freshUser || user);
                          
                          // Fetch user's org ID
                          const orgMembers = await base44.entities.OrganizationMember.filter({ user_email: user.email });
                          setViewingUserOrgId(orgMembers.length > 0 ? orgMembers[0].org_id : null);
                        } catch (error) {
                          console.error("Error fetching user data:", error);
                          setViewingUser(user);
                          setViewingUserOrgId(null);
                        }
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setActiveTab('reports');
                        await loadComorbidityReport(user.email);
                      }}
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Comorbidities
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setLoadingClients(true);
                        setViewingUserClients(user);
                        try {
                          const clients = await base44.entities.Client.filter({ assigned_clinician_email: user.email });
                          setUserClients(clients || []);
                        } catch (error) {
                          console.error("Error loading clients:", error);
                          toast.error("Failed to load clients");
                          setUserClients([]);
                        }
                        setLoadingClients(false);
                      }}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Clients
                    </Button>
                    <Button
                      onClick={() => handleSuspend(user.id, user.email)}
                      variant="outline"
                      size="sm"
                      className="text-orange-600 hover:text-orange-700"
                    >
                      Suspend
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Suspended Users */}
        {suspendedUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-orange-600" />
                Suspended Users ({suspendedUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {suspendedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50">
                    <div>
                      <p className="font-medium">{user.clinician_name || user.full_name || user.email}</p>
                      <p className="text-sm text-slate-600">{user.email}</p>
                    </div>
                    <Button
                      onClick={() => handleReactivate(user.id, user.email)}
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Reactivate
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejected Users */}
        {rejectedUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                Rejected Users ({rejectedUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rejectedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg bg-red-50">
                    <div>
                      <p className="font-medium">{user.clinician_name || user.full_name || user.email}</p>
                      <p className="text-sm text-slate-600">{user.email}</p>
                    </div>
                    <Badge variant="destructive">Rejected</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}


    </TabsContent>

    <TabsContent value="requests" className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Assessment Requests ({assessmentRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assessmentRequests.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No assessment requests yet</p>
          ) : (
            <div className="space-y-4">
              {assessmentRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={
                          request.status === 'pending' ? 'bg-yellow-500' :
                          request.status === 'reviewed' ? 'bg-blue-500' :
                          request.status === 'completed' ? 'bg-green-500' :
                          'bg-red-500'
                        }>
                          {request.status}
                        </Badge>
                        <Badge variant="outline">
                          {request.request_type === 'new_assessment' ? 'New Assessment' : 'Error Report'}
                        </Badge>
                      </div>
                      {request.assessment_name && (
                        <h4 className="font-semibold text-slate-900 mb-1">{request.assessment_name}</h4>
                      )}
                      <p className="text-sm text-slate-600 mb-2 whitespace-pre-wrap">{request.details}</p>
                      <p className="text-xs text-slate-500">
                        Submitted by {request.user_name} ({request.user_email}) on {format(new Date(request.created_date), 'PPp')}
                      </p>
                      {request.admin_notes && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                          <strong>Admin Notes:</strong> {request.admin_notes}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      {request.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateRequestStatus(request.id, 'reviewed')}
                          >
                            Mark Reviewed
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateRequestStatus(request.id, 'completed')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Mark Complete
                          </Button>
                        </>
                      )}
                      {request.status === 'reviewed' && (
                        <Button
                          size="sm"
                          onClick={() => updateRequestStatus(request.id, 'completed')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="assessments" className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Library className="w-5 h-5 text-blue-600" />
              Assessment Library ({assessments.length})
            </CardTitle>

          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search assessments by name, category, or tags..."
                value={assessmentSearch}
                onChange={(e) => setAssessmentSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'All', count: assessments.length },
                { key: 'complete', label: '✓ Complete', count: assessments.filter(a => isAssessmentComplete(a)).length },
                { key: 'incomplete', label: '⚠ Incomplete', count: assessments.filter(a => !isAssessmentComplete(a) && !isDuplicate(a, assessments)).length },
                { key: 'duplicate', label: '⊘ Duplicate', count: assessments.filter(a => isDuplicate(a, assessments)).length },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setAssessmentFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    assessmentFilter === f.key
                      ? f.key === 'complete' ? 'bg-green-600 text-white border-green-600'
                        : f.key === 'incomplete' ? 'bg-yellow-500 text-white border-yellow-500'
                        : f.key === 'duplicate' ? 'bg-red-600 text-white border-red-600'
                        : 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${assessmentFilter === f.key ? 'bg-white/30' : 'bg-slate-100 text-slate-500'}`}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {assessments
              .filter(assessment => {
                const search = assessmentSearch.toLowerCase().trim();
                const matchesSearch = !search || (
                  (assessment.name || '').toLowerCase().includes(search) ||
                  (assessment.category || '').toLowerCase().includes(search) ||
                  (assessment.search_tags || []).some(tag => tag.toLowerCase().includes(search))
                );
                if (!matchesSearch) return false;

                const complete = isAssessmentComplete(assessment);
                const duplicate = isDuplicate(assessment, assessments);
                if (assessmentFilter === 'complete') return complete;
                if (assessmentFilter === 'incomplete') return !complete && !duplicate;
                if (assessmentFilter === 'duplicate') return duplicate;
                return true;
              })
              .map((assessment) => {
                const hasDuplicate = isDuplicate(assessment, assessments);
                const isExpanded = expandedAssessments.has(assessment.id);
                const isEditing = editingAssessmentId === assessment.id;
                const isComplete = isAssessmentComplete(assessment);
                
                return (
                  <div 
                    key={assessment.id} 
                    className={`border rounded-lg transition-all ${
                      isComplete ? 'bg-green-50 border-green-300' : 
                      hasDuplicate ? 'border-red-300 bg-red-50/50' : 
                      (assessment.has_test_runner || assessment.results_add_to_soap || assessment.has_normatives || assessment.has_instructions || assessment.has_references) ? 'bg-yellow-50 border-yellow-300' :
                      'bg-white'
                    }`}
                  >
                    <div 
                      className={`p-4 cursor-pointer hover:bg-opacity-80 transition-colors`}
                      onClick={() => toggleExpanded(assessment.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-900">{assessment.name}</h4>
                            {isComplete && (
                              <Badge className="bg-green-600 text-white text-xs">Complete</Badge>
                            )}
                            {!isComplete && (assessment.has_test_runner || assessment.results_add_to_soap || assessment.has_normatives || assessment.has_instructions || assessment.has_references) && (
                              <Badge className="bg-yellow-600 text-white text-xs">In Progress</Badge>
                            )}
                            {hasDuplicate && (
                              <Badge className="bg-red-600 text-white text-xs">Duplicate</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{assessment.description || 'No description'}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">{assessment.category || 'Uncategorized'}</Badge>
                            {assessment.unit_of_measure && (
                              <Badge variant="outline" className="text-xs bg-blue-50">
                                Unit: {assessment.unit_of_measure}
                              </Badge>
                            )}
                          </div>
                          {assessment.search_tags && assessment.search_tags.length > 0 && !isExpanded && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {assessment.search_tags.slice(0, 5).map((tag, idx) => (
                                <span key={idx} className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingAssessment(assessment);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t px-4 pb-4 space-y-4">
                        {!isEditing && (
                          <div className="flex gap-2 mt-4">
                            <Button
                              onClick={() => setViewingAssessment(assessment)}
                              variant="outline"
                              size="sm"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Assessment Details
                            </Button>
                            <Button
                              onClick={() => startEditing(assessment)}
                              variant="outline"
                              size="sm"
                            >
                              Edit Quality Checks
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingAssessmentId(assessment.id);
                                setEditingData({
                                  has_test_runner: true,
                                  results_add_to_soap: true,
                                  has_normatives: true,
                                  has_instructions: true,
                                  has_references: true,
                                  search_tags: assessment.search_tags || []
                                });
                                setTimeout(async () => {
                                  try {
                                    await base44.entities.Assessment.update(assessment.id, {
                                      has_test_runner: true,
                                      results_add_to_soap: true,
                                      has_normatives: true,
                                      has_instructions: true,
                                      has_references: true
                                    });
                                    toast.success("All quality checks marked complete");
                                    setEditingAssessmentId(null);
                                    await loadData();
                                  } catch (error) {
                                    console.error("Error updating assessment:", error);
                                    toast.error("Failed to update assessment");
                                  }
                                }, 100);
                              }}
                              variant="outline"
                              size="sm"
                              className="bg-green-50 text-green-700 hover:bg-green-100"
                            >
                              Check All
                            </Button>
                          </div>
                        )}

                        {isEditing ? (
                          <div className="space-y-4 mt-4">
                            <div className="space-y-3 bg-white p-4 rounded-lg border">
                              <h4 className="font-semibold text-slate-900 mb-3">Quality Checklist</h4>
                              
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  id={`test_runner_${assessment.id}`}
                                  checked={editingData.has_test_runner}
                                  onCheckedChange={(checked) => setEditingData({...editingData, has_test_runner: checked})}
                                />
                                <label htmlFor={`test_runner_${assessment.id}`} className="text-sm font-medium cursor-pointer">
                                  Has a test runner
                                </label>
                              </div>

                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  id={`soap_${assessment.id}`}
                                  checked={editingData.results_add_to_soap}
                                  onCheckedChange={(checked) => setEditingData({...editingData, results_add_to_soap: checked})}
                                />
                                <label htmlFor={`soap_${assessment.id}`} className="text-sm font-medium cursor-pointer">
                                  Results add correctly to SOAP notes
                                </label>
                              </div>

                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  id={`normatives_${assessment.id}`}
                                  checked={editingData.has_normatives}
                                  onCheckedChange={(checked) => setEditingData({...editingData, has_normatives: checked})}
                                />
                                <label htmlFor={`normatives_${assessment.id}`} className="text-sm font-medium cursor-pointer">
                                  Results have normatives
                                </label>
                              </div>

                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  id={`instructions_${assessment.id}`}
                                  checked={editingData.has_instructions}
                                  onCheckedChange={(checked) => setEditingData({...editingData, has_instructions: checked})}
                                />
                                <label htmlFor={`instructions_${assessment.id}`} className="text-sm font-medium cursor-pointer">
                                  Has instructions to clinician
                                </label>
                              </div>

                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  id={`references_${assessment.id}`}
                                  checked={editingData.has_references}
                                  onCheckedChange={(checked) => setEditingData({...editingData, has_references: checked})}
                                />
                                <label htmlFor={`references_${assessment.id}`} className="text-sm font-medium cursor-pointer">
                                  Has references
                                </label>
                              </div>
                            </div>

                            <div className="bg-white p-4 rounded-lg border">
                              <label className="text-sm font-semibold text-slate-900 block mb-2">Tags</label>
                              <Textarea
                                placeholder="Enter tags separated by commas (e.g., balance, mobility, strength)"
                                value={editingData.search_tags.join(', ')}
                                onChange={(e) => setEditingData({
                                  ...editingData, 
                                  search_tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                                })}
                                rows={3}
                              />
                              <p className="text-xs text-slate-500 mt-1">These tags help clinicians find this assessment</p>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                onClick={() => saveAssessment(assessment.id)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Save Changes
                              </Button>
                              <Button
                                onClick={() => setEditingAssessmentId(null)}
                                variant="outline"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3 mt-4">
                            <div className="bg-white p-4 rounded-lg border">
                              <h4 className="font-semibold text-slate-900 mb-3">Quality Status</h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  {assessment.has_test_runner ? 
                                    <CheckCircle className="w-4 h-4 text-green-600" /> : 
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  }
                                  <span className="text-sm">Has a test runner</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {assessment.results_add_to_soap ? 
                                    <CheckCircle className="w-4 h-4 text-green-600" /> : 
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  }
                                  <span className="text-sm">Results add correctly to SOAP notes</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {assessment.has_normatives ? 
                                    <CheckCircle className="w-4 h-4 text-green-600" /> : 
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  }
                                  <span className="text-sm">Results have normatives</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {assessment.has_instructions ? 
                                    <CheckCircle className="w-4 h-4 text-green-600" /> : 
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  }
                                  <span className="text-sm">Has instructions to clinician</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {assessment.has_references ? 
                                    <CheckCircle className="w-4 h-4 text-green-600" /> : 
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  }
                                  <span className="text-sm">Has references</span>
                                </div>
                              </div>
                            </div>

                            {assessment.search_tags && assessment.search_tags.length > 0 && (
                              <div className="bg-white p-4 rounded-lg border">
                                <h4 className="font-semibold text-slate-900 mb-2">Tags</h4>
                                <div className="flex flex-wrap gap-2">
                                  {assessment.search_tags.map((tag, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            {assessments.filter(assessment => {
              const search = assessmentSearch.toLowerCase().trim();
              const matchesSearch = !search || (
                (assessment.name || '').toLowerCase().includes(search) ||
                (assessment.category || '').toLowerCase().includes(search) ||
                (assessment.search_tags || []).some(tag => tag.toLowerCase().includes(search))
              );
              if (!matchesSearch) return false;
              const complete = isAssessmentComplete(assessment);
              const duplicate = isDuplicate(assessment, assessments);
              if (assessmentFilter === 'complete') return complete;
              if (assessmentFilter === 'incomplete') return !complete && !duplicate;
              if (assessmentFilter === 'duplicate') return duplicate;
              return true;
            }).length === 0 && (
              <div className="text-center py-12">
                <Library className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No assessments found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="legal" className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Legal Acceptances ({legalAcceptances.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {legalAcceptances.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No legal acceptances recorded</p>
          ) : (
            <div className="space-y-2">
              {legalAcceptances.map((acceptance) => (
                <div key={acceptance.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{acceptance.user_email}</p>
                      <Badge variant="outline" className="text-xs">{acceptance.user_role}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      Accepted: {moment(acceptance.created_date).format('MMM D, YYYY h:mm A')}
                    </p>
                    <p className="text-xs text-slate-500">Version: {acceptance.document_set_version}</p>
                  </div>
                  <Button
                    onClick={() => setViewingAcceptance(acceptance)}
                    variant="outline"
                    size="sm"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="documents" className="space-y-6 mt-6">
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-amber-900 mb-1">Force Re-acceptance</h4>
              <p className="text-sm text-amber-800 mb-3">
                If you've updated these legal documents, you can force all users to re-accept them. 
                This will delete all existing acceptances and require users to sign again on next login.
              </p>
              <Button
                onClick={async () => {
                  if (confirm("Are you sure you want to force ALL users to re-accept legal documents? This will delete all existing acceptances.")) {
                    try {
                      const acceptances = await base44.entities.LegalAcceptance.list();
                      for (const acceptance of acceptances) {
                        await base44.entities.LegalAcceptance.delete(acceptance.id);
                      }
                      toast.success(`Deleted ${acceptances.length} legal acceptances. All users will need to re-accept.`);
                      loadData();
                    } catch (error) {
                      console.error("Error deleting acceptances:", error);
                      toast.error("Failed to delete acceptances.");
                    }
                  }
                }}
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Force All Users to Re-accept
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {Object.entries(LEGAL_DOCUMENT_CONTENT).map(([key, content]) => {
          const Icon = LEGAL_DOCS[key]?.icon || FileText;
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-blue-600" />
                  {LEGAL_DOCS[key]?.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TabsContent>

    <TabsContent value="utilities" className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Assign Organizations to Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-slate-600">
              This utility will check all users and create organizations for those who don't have one yet.
            </p>
            <Button
              onClick={async () => {
                setAssigningOrgs(true);
                try {
                  const response = await base44.functions.invoke('assignOrganizations', {});
                  const data = response.data || response;
                  setOrgAssignResults(data);
                  toast.success(`Processed ${data.total_users} users`);
                } catch (error) {
                  console.error("Error assigning organizations:", error);
                  toast.error("Failed to assign organizations");
                } finally {
                  setAssigningOrgs(false);
                }
              }}
              disabled={assigningOrgs}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {assigningOrgs ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Run Organization Assignment'
              )}
            </Button>

            {orgAssignResults && (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-blue-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-slate-600">Total Users</p>
                      <p className="text-3xl font-bold text-blue-600">{orgAssignResults.total_users}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-slate-600">Already Had Orgs</p>
                      <p className="text-3xl font-bold text-green-600">{orgAssignResults.users_with_orgs}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-slate-600">Orgs Created</p>
                      <p className="text-3xl font-bold text-purple-600">{orgAssignResults.users_without_orgs}</p>
                    </CardContent>
                  </Card>
                </div>

                {orgAssignResults.created_orgs.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Organizations Created:</h4>
                    <div className="space-y-2">
                      {orgAssignResults.created_orgs.map((org, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg border">
                          <p className="font-medium text-slate-900">{org.email}</p>
                          <p className="text-sm text-slate-600">Org: {org.org_name}</p>
                          <p className="text-xs text-slate-500">ID: {org.org_id}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {orgAssignResults.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-red-800 mb-2">Errors:</h4>
                    <div className="space-y-2">
                      {orgAssignResults.errors.map((err, i) => (
                        <div key={i} className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <p className="font-medium text-red-900">{err.email}</p>
                          <p className="text-sm text-red-700">{err.error}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {orgAssignResults.all_users_with_orgs && orgAssignResults.all_users_with_orgs.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">All Users & Organization IDs:</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {orgAssignResults.all_users_with_orgs.map((user, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg border">
                          <p className="font-medium text-slate-900">{user.clinician_name || user.full_name || user.email}</p>
                          <p className="text-sm text-slate-600">{user.email}</p>
                          <p className="text-xs text-slate-500 font-mono">Org ID: {user.org_id}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
                )}
                </div>
                </CardContent>
                </Card>
                </TabsContent>

    <TabsContent value="reports" className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Comorbidity Report {selectedUserForReport ? `(${selectedUserForReport}'s Clients)` : '(All Clients)'}
          </CardTitle>
          {selectedUserForReport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadComorbidityReport(null)}
              className="mt-2"
            >
              View All Clients
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loadingReport ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : comorbidityReport ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-blue-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-600">Total Comorbidities</p>
                    <p className="text-3xl font-bold text-blue-600">{comorbidityReport.total_comorbidities}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-600">Unique Conditions</p>
                    <p className="text-3xl font-bold text-green-600">{comorbidityReport.unique_comorbidities}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-600">Avg per Condition</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {comorbidityReport.unique_comorbidities > 0 
                        ? (comorbidityReport.total_comorbidities / comorbidityReport.unique_comorbidities).toFixed(1)
                        : 0}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Comorbidity Breakdown</h3>
                <div className="space-y-3">
                  {(comorbidityReport.comorbidities || []).map((comorbidity, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{comorbidity.name}</p>
                        <p className="text-sm text-slate-600">{comorbidity.count} client{comorbidity.count !== 1 ? 's' : ''}</p>
                      </div>
                      <Badge variant="outline" className="text-lg px-4 py-1">
                        {comorbidity.count}
                      </Badge>
                    </div>
                  ))}
                  {(!comorbidityReport.comorbidities || comorbidityReport.comorbidities.length === 0) && (
                    <p className="text-center text-slate-500 py-8">No comorbidity data available</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">Click the tab to load the report</p>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>

      {/* User Details Modal */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  User Details
                </CardTitle>
                <Button onClick={() => setViewingUser(null)} variant="ghost" size="sm">✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-600">Full Name</label>
                  <p className="text-slate-900">{viewingUser.clinician_name || viewingUser.full_name || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Email</label>
                  <p className="text-slate-900">{viewingUser.email}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-600">Organization ID</label>
                  <p className="text-slate-900 font-mono text-sm">{viewingUserOrgId || 'Loading...'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Role</label>
                  <Badge>{viewingUser.role}</Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Status</label>
                  <Badge className={viewingUser.account_status === 'active' ? 'bg-green-100 text-green-800' : ''}>
                    {viewingUser.account_status || 'pending'}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Profession</label>
                  <p className="text-slate-900">{viewingUser.profession || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Provider Number</label>
                  <p className="text-slate-900">{viewingUser.provider_number || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Registered</label>
                  <p className="text-slate-900">{moment(viewingUser.created_date).format('MMM D, YYYY h:mm A')}</p>
                </div>
                {viewingUser.approved_date && (
                  <div>
                    <label className="text-sm font-medium text-slate-600">Approved</label>
                    <p className="text-slate-900">{moment(viewingUser.approved_date).format('MMM D, YYYY h:mm A')}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-slate-600">Last Active</label>
                  <p className="text-slate-900">
                    {viewingUser.last_active ? moment(viewingUser.last_active).fromNow() : 'Never'}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <h4 className="font-semibold text-slate-900 mb-3">Clinic Information</h4>
                <div>
                  <label className="text-sm font-medium text-slate-600">Clinic Name</label>
                  <p className="text-slate-900">{viewingUser.clinic_name || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Clinic Address</label>
                  <p className="text-slate-900">{viewingUser.clinic_address || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Clinic Phone</label>
                  <p className="text-slate-900">{viewingUser.clinic_phone || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Clinic Email</label>
                  <p className="text-slate-900">{viewingUser.clinic_email || 'Not provided'}</p>
                </div>
              </div>

              <div className="border-t pt-4 flex gap-2">
                <Button
                  onClick={async () => {
                    try {
                      await base44.entities.User.update(viewingUser.id, { role: viewingUser.role === 'admin' ? 'user' : 'admin' });
                      toast.success(`Updated ${viewingUser.email} role`);
                      setViewingUser(null);
                      loadData();
                    } catch (error) {
                      toast.error("Failed to update role");
                    }
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {viewingUser.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                </Button>
                <Button
                  onClick={() => {
                    window.open(`mailto:${viewingUser.email}?subject=Password Reset - AssessSuite&body=Hi ${viewingUser.full_name || 'there'},%0D%0A%0D%0ATo reset your password, please visit: ${window.location.origin}`, '_blank');
                    toast.success("Opening email client");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Send Password Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Clients Modal */}
      {viewingUserClients && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Clients - {viewingUserClients.clinician_name || viewingUserClients.full_name || viewingUserClients.email}
                </CardTitle>
                <Button onClick={() => setViewingUserClients(null)} variant="ghost" size="sm">✕</Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingClients ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : userClients.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No clients found for this user</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mb-4">
                    <p className="text-sm text-slate-600">Total Clients: <span className="font-semibold text-slate-900">{userClients.length}</span></p>
                  </div>
                  <div className="space-y-3">
                    {userClients.map((client) => (
                      <div key={client.id} className="p-4 border rounded-lg hover:bg-slate-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900">{client.full_name}</h4>
                            <div className="mt-1 space-y-1">
                              {client.email && (
                                <p className="text-sm text-slate-600 flex items-center gap-2">
                                  <Mail className="w-3 h-3" />
                                  {client.email}
                                </p>
                              )}
                              {client.phone && (
                                <p className="text-sm text-slate-600">{client.phone}</p>
                              )}
                              {client.date_of_birth && (
                                <p className="text-xs text-slate-500">
                                  DOB: {moment(client.date_of_birth).format('MMM D, YYYY')}
                                </p>
                              )}
                              <p className="text-xs text-slate-500">
                                Created: {moment(client.created_date).format('MMM D, YYYY')}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {client.consent_confirmed ? 'Active' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assessment Viewer Modal */}
      {viewingAssessment && (
        <AssessmentModal
          assessment={viewingAssessment}
          onClose={() => setViewingAssessment(null)}
        />
      )}

      {/* Delete Assessment Confirmation */}
      <AlertDialog open={!!deletingAssessment} onOpenChange={(open) => !open && setDeletingAssessment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingAssessment?.name}"? 
              <br /><br />
              This assessment will be removed from the library, but any historical client assessments will remain visible with a "(Historical)" label.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteAssessment(deletingAssessment.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Assessment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate Without Payment Confirmation */}
      <AlertDialog open={!!activatingUser} onOpenChange={(open) => !open && setActivatingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate without payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This activates the account WITHOUT a completed payment. Use only for a genuine exception. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (activatingUser) {
                  handleApprove(activatingUser.id, activatingUser.email);
                }
                setActivatingUser(null);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Activate without payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Legal Acceptance Viewer Modal */}
      {viewingAcceptance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50 overflow-y-auto">
          <Card className="max-w-4xl w-full my-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Legal Acceptance - {viewingAcceptance.user_email}
                </CardTitle>
                <Button onClick={() => setViewingAcceptance(null)} variant="ghost" size="sm">✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <label className="text-sm font-medium text-slate-600">User</label>
                  <p className="text-slate-900">{viewingAcceptance.user_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Role</label>
                  <Badge>{viewingAcceptance.user_role}</Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Accepted Date</label>
                  <p className="text-slate-900">{moment(viewingAcceptance.created_date).format('MMM D, YYYY h:mm A')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Version</label>
                  <p className="text-slate-900">{viewingAcceptance.document_set_version}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">IP Address</label>
                  <p className="text-slate-900 font-mono text-sm">{viewingAcceptance.ip_address || 'N/A'}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Documents Accepted</h4>
                <div className="flex flex-wrap gap-2">
                  {viewingAcceptance.accepted_documents?.map((doc, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {LEGAL_DOCS[doc]?.title || doc}
                    </Badge>
                  ))}
                </div>
              </div>

              {viewingAcceptance.digital_signature && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Digital Signature</h4>
                  <div className="border-2 border-slate-300 rounded-lg p-4 bg-white">
                    <img 
                      src={viewingAcceptance.digital_signature} 
                      alt="Digital Signature" 
                      className="max-h-32 mx-auto"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}