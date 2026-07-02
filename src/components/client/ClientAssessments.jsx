import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ClipboardList, CheckCircle, Play, Eye, ChevronDown, ChevronUp, Trash2, AlertTriangle, Upload } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AssessmentLibraryModal from '../assessments/AssessmentLibraryModal';
import AssessmentTestRunnerRouter from '../assessments/AssessmentTestRunnerRouter';
import CompletedAssessmentViewer from '../assessments/CompletedAssessmentViewer';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ClientAssessments({ client, clientAssessments, allAssessments, onAssessmentUpdate }) {
  const parseDate = (dateString) => {
    if (!dateString) return null;
    let date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date;
    }
    const parts = dateString.split('/');
    if (parts.length === 3) {
      date = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
  };
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [runningTest, setRunningTest] = useState(null);
  const [viewingAssessment, setViewingAssessment] = useState(null);

  const [isPendingOpen, setIsPendingOpen] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [isMainExpanded, setIsMainExpanded] = useState(false);

  const addAssessmentToClient = async (assessment) => {
    try {
      // Check if assessment already exists for this client
      const existingAssessment = clientAssessments.find(
        ca => ca.assessment_id === assessment.id && ca.status === 'pending'
      );
      
      if (existingAssessment) {
        toast.error(`"${assessment.name}" is already in ${client.full_name}'s pending assessments.`);
        return;
      }

      await base44.entities.ClientAssessment.create({
        org_id: client.org_id,
        client_id: client.id,
        assessment_id: assessment.id,
        assessment_date: new Date().toISOString().split('T')[0],
        status: "pending",
      });
      onAssessmentUpdate();
      toast.success(`"${assessment.name}" has been added to ${client.full_name}'s pending assessments.`);
    } catch (error) {
      console.error("Failed to add assessment:", error);
      toast.error("Failed to add assessment. Please try again.");
    }
  };

  const handleDeleteAssessment = async (clientAssessment) => {
    try {
      await base44.entities.ClientAssessment.delete(clientAssessment.id);
      const assessmentName = getAssessmentName(clientAssessment.assessment_id);
      toast.success(`"${assessmentName}" has been removed from ${client.full_name}'s profile.`);
      onAssessmentUpdate();
    } catch (error) {
      console.error("Failed to delete assessment:", error);
      toast.error("Failed to remove assessment.");
    }
  };

  const handleStartTest = (clientAssessment) => {
    const assessmentDetails = getAssessmentDetails(clientAssessment.assessment_id);
    if (assessmentDetails) {
      setRunningTest({ assessment: assessmentDetails, clientAssessment });
    } else {
      toast.error("This assessment is no longer available in the library. Please contact support if this continues.");
    }
  };

  const handleAssessmentSave = async (clientAssessmentId, resultData) => {
    try {
      await base44.entities.ClientAssessment.update(clientAssessmentId, {
        status: resultData.status || "completed",
        result_value: resultData.result_value,
        assessment_date: resultData.assessment_date || new Date().toISOString().split("T")[0],
        notes: resultData.notes,
        additional_data: resultData.additional_data,
      });
      toast.success("Assessment saved successfully.");
      onAssessmentUpdate();
    } catch (error) {
      console.error("Failed to save assessment:", error);
      toast.error("Failed to save assessment.");
    }
  };

  const handleViewAssessment = (clientAssessment) => {
    const assessmentDetails = getAssessmentDetails(clientAssessment.assessment_id);
    if (assessmentDetails) {
      setViewingAssessment({ assessment: assessmentDetails, clientAssessment });
    } else {
      toast.error("Cannot view results - assessment details are no longer available in the library.");
    }
  };
  
  const handleTestComplete = () => {
    setRunningTest(null);
    onAssessmentUpdate();
  };

  // Improved helper function with better error handling
  const getAssessmentDetails = (assessmentId) => {
    if (!allAssessments || !Array.isArray(allAssessments)) {
      console.warn("allAssessments is not properly loaded");
      return null;
    }
    
    const assessment = allAssessments.find(a => a && a.id === assessmentId);
    if (!assessment) {
      console.warn(`Assessment with ID ${assessmentId} not found in library`);
    }
    return assessment;
  };

  const getAssessmentName = (assessmentId) => {
    const assessment = getAssessmentDetails(assessmentId);
    return assessment ? assessment.name : 'Unknown Assessment (Deleted)';
  };

  const getAssessmentUnit = (assessmentId) => {
    const assessment = getAssessmentDetails(assessmentId);
    return assessment ? (assessment.unit_of_measure || '') : '';
  };

  const getResultDisplay = (ca) => {
    const additionalData = ca.additional_data;
    const unit = getAssessmentUnit(ca.assessment_id);

    // 1RM Testing - new format
    if (additionalData?.measurement_type === '1rm_testing' && additionalData?.exercise_tested) {
      return (
        <div>
          <p className="font-bold text-lg text-blue-600">
            {ca.result_value} {additionalData.units || unit}
          </p>
          <p className="text-xs text-slate-600">{additionalData.exercise_tested}</p>
        </div>
      );
    }

    // 1RM Testing - old format (legacy)
    if (additionalData?.measurement_type === 'one_rm' && additionalData?.one_rm_data?.exercises) {
      const exercises = additionalData.one_rm_data.exercises;
      const exerciseNames = exercises.map(ex => ex.exercise_name).join(', ');
      return (
        <div>
          <p className="font-bold text-lg text-blue-600">
            {ca.result_value} {unit}
          </p>
          <p className="text-xs text-slate-600">{exerciseNames}</p>
        </div>
      );
    }

    // 1-Minute Sit-to-Stand - show chair height
    if (additionalData?.measurement_type === '1min_sit_to_stand') {
      return (
        <div>
          <p className="font-bold text-lg text-blue-600">{ca.result_value} reps</p>
          <p className="text-xs text-slate-600">Chair: {additionalData.chair_height_cm || 'N/A'} cm</p>
        </div>
      );
    }

    // DASS-21 - show subscale summary
    if (additionalData?.measurement_type === 'dass21' || 
        (additionalData?.depression_score !== undefined && additionalData?.anxiety_score !== undefined)) {
      return (
        <div>
          <p className="font-bold text-sm text-blue-600">
            D:{additionalData.depression_score} A:{additionalData.anxiety_score} S:{additionalData.stress_score}
          </p>
        </div>
      );
    }

    // 6MWT - show distance with meter suffix
    if (additionalData?.measurement_type === '6mwt') {
      return (
        <div>
          <p className="font-bold text-lg text-blue-600">{ca.result_value} meters</p>
        </div>
      );
    }

    // 10-Second Repeated Jump Test - show number of jumps
    if (additionalData?.measurement_type === '10_second_repeated_jump' || additionalData?.measurement_type === 'repeated_jump') {
      return (
        <div>
          <p className="font-bold text-lg text-blue-600">{additionalData.total_jumps} number of jumps</p>
          <p className="text-xs text-slate-600">Best RSI: {additionalData.best_rsi?.toFixed(3) || 'N/A'}</p>
        </div>
      );
    }

    // Handle EMS data if present
    if (additionalData?.measurement_type === 'ems') {
      return (
        <div>
          <p className="font-bold text-lg text-blue-600">{ca.result_value}</p>
          {additionalData.ems_data && (
            <p className="text-xs text-slate-600">
              {typeof additionalData.ems_data === 'object' ? JSON.stringify(additionalData.ems_data) : additionalData.ems_data}
            </p>
          )}
        </div>
      );
    }

    // Default: score + unit
    return (
      <div>
        <p className="font-bold text-lg text-blue-600">
          {ca.result_value} <span className="text-sm font-normal text-slate-500">{unit}</span>
        </p>
      </div>
    );
  };

  // Filter out assessments that no longer exist in the library
  const validClientAssessments = React.useMemo(() => {
    if (!allAssessments || !Array.isArray(allAssessments) || !clientAssessments || !Array.isArray(clientAssessments)) {
      return [];
    }
    
    return clientAssessments.filter(ca => {
      const assessment = allAssessments.find(a => a && a.id === ca.assessment_id);
      if (!assessment) {
        console.warn(`Client assessment ${ca.id} references deleted assessment ${ca.assessment_id} - filtering out`);
        return false;
      }
      if (assessment.name?.toLowerCase().includes('ymca')) return false;
      return true;
    });
  }, [clientAssessments, allAssessments]);

  const pendingAssessments = React.useMemo(() => {
    return validClientAssessments.filter(a => a.status === 'pending');
  }, [validClientAssessments]);
  
  const completedAssessments = React.useMemo(() => {
    return validClientAssessments
      .filter(a => a.status === 'completed')
      .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date));
  }, [validClientAssessments]);

  const getInterpretationForAssessment = (clientAssessment) => {
    const assessment = getAssessmentDetails(clientAssessment.assessment_id);
    if (!assessment) return null;

    const score = clientAssessment.result_value;
    switch (assessment.name) {
      case "Berg Balance Scale":
        if (score >= 45) return { level: "Low fall risk", bgColor: "bg-green-100", color: "text-green-800" };
        if (score >= 21) return { level: "Medium fall risk", bgColor: "bg-yellow-100", color: "text-yellow-800" };
        return { level: "High fall risk", bgColor: "bg-red-100", color: "text-red-800" };
      case "PHQ-9":
        if (score <= 4) return { level: "Minimal depression", bgColor: "bg-green-100", color: "text-green-800" };
        if (score <= 9) return { level: "Mild depression", bgColor: "bg-yellow-100", color: "text-yellow-800" };
        if (score <= 14) return { level: "Moderate depression", bgColor: "bg-orange-100", color: "text-orange-800" };
        if (score <= 19) return { level: "Mod. severe depression", bgColor: "bg-red-100", color: "text-red-800" };
        return { level: "Severe depression", bgColor: "bg-red-100", color: "text-red-800" };
      case "GAD-7":
         if (score <= 4) return { level: "Minimal anxiety", bgColor: "bg-green-100", color: "text-green-800" };
        if (score <= 9) return { level: "Mild anxiety", bgColor: "bg-yellow-100", color: "text-yellow-800" };
        if (score <= 14) return { level: "Moderate anxiety", bgColor: "bg-orange-100", color: "text-orange-800" };
        return { level: "Severe anxiety", bgColor: "bg-red-100", color: "text-red-800" };
      default:
        return null;
    }
  };

  const AssessmentCardItem = ({ ca, type }) => {
    const assessmentExists = getAssessmentDetails(ca.assessment_id) !== null;
    
    // Don't render if assessment doesn't exist
    if (!assessmentExists) {
      return null;
    }
    
    const interpretation = getInterpretationForAssessment(ca);

    return (
      <Card className="bg-white/60 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-slate-800">
                  {getAssessmentName(ca.assessment_id)}
                  {getAssessmentDetails(ca.assessment_id)?.is_deleted && (
                    <span className="text-orange-600 font-normal ml-2">(Historical)</span>
                  )}
                </h4>
                {ca.source === 'uploaded' && (
                  <Badge variant="outline" className="bg-purple-50 border-purple-300 text-purple-700">
                    <Upload className="w-3 h-3 mr-1" />
                    Uploaded
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {type === 'pending' ? 'Added on ' : 'Completed on '}
                {(() => {
                  const dateStr = ca.assessment_date || ca.created_date;
                  const date = parseDate(dateStr);
                  return date ? format(date, 'PPP') : 'N/A';
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {type === 'pending' ? (
                <>
                  <Button 
                    size="sm" 
                    onClick={() => handleStartTest(ca)}
                    disabled={!assessmentExists}
                  >
                    <Play className="w-4 h-4 mr-2" /> Start Test
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="outline">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Assessment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove "{getAssessmentName(ca.assessment_id)}" from {client.full_name}'s profile? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteAssessment(ca)} className="bg-red-600 hover:bg-red-700">
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <>
                  <div className="text-right">
                    {getResultDisplay(ca)}
                    {interpretation && (
                        <Badge 
                          variant="outline" 
                          className={`mt-1 border-0 ${interpretation.bgColor} ${interpretation.color}`}
                        >
                          {interpretation.level}
                        </Badge>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleViewAssessment(ca)}
                    disabled={!assessmentExists}
                  >
                    <Eye className="w-4 h-4 mr-2" /> View Results
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="outline">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Completed Assessment</AlertDialogTitle>
                        <AlertDialogDescription>
                          <span className="text-red-600 font-semibold">Warning:</span> You are about to delete a completed assessment with results. This will permanently remove "{getAssessmentName(ca.assessment_id)}" and all associated data for {client.full_name}. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteAssessment(ca)} className="bg-red-600 hover:bg-red-700">
                          Delete Assessment
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">

      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader className="cursor-pointer" onClick={() => setIsMainExpanded(!isMainExpanded)}>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    Client Assessments
                  </CardTitle>
                  <Badge variant="secondary">{pendingAssessments.length + completedAssessments.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLibraryOpen(true);
                    }}
                    size="sm"
                  >
                      <Plus className="w-4 h-4 mr-2" /> Add Assessment
                  </Button>
                  {isMainExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
            </div>
        </CardHeader>
        {isMainExpanded && (
          <CardContent>
              <div className="space-y-6">
                {/* Pending Assessments */}
                <Card>
                    <CardHeader className="cursor-pointer p-4" onClick={() => setIsPendingOpen(!isPendingOpen)}>
                        <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                            <Play className="w-5 h-5" /> Pending Assessments
                            <Badge variant="secondary">{pendingAssessments.length}</Badge>
                        </CardTitle>
                        {isPendingOpen ? <ChevronUp /> : <ChevronDown />}
                        </div>
                    </CardHeader>
                    {isPendingOpen && (
                        <CardContent>
                        {pendingAssessments.length > 0 ? (
                            <div className="space-y-3">
                            {pendingAssessments.map(ca => <AssessmentCardItem key={ca.id} ca={ca} type="pending" />)}
                            </div>
                        ) : (
                            <p className="text-slate-500 text-center py-4">No pending assessments.</p>
                        )}
                        </CardContent>
                    )}
                </Card>

                {/* Completed Assessments */}
                <Card>
                    <CardHeader className="cursor-pointer p-4" onClick={() => setIsCompletedOpen(!isCompletedOpen)}>
                        <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                            <CheckCircle className="w-5 h-5" /> Completed Assessments
                            <Badge variant="secondary">{completedAssessments.length}</Badge>
                        </CardTitle>
                        {isCompletedOpen ? <ChevronUp /> : <ChevronDown />}
                        </div>
                    </CardHeader>
                    {isCompletedOpen && (
                        <CardContent>
                        {completedAssessments.length > 0 ? (
                            <div className="space-y-3">
                            {completedAssessments.map(ca => <AssessmentCardItem key={ca.id} ca={ca} type="completed" />)}
                            </div>
                        ) : (
                            <p className="text-slate-500 text-center py-4">No completed assessments.</p>
                        )}
                        </CardContent>
                    )}
                </Card>
            </div>
          </CardContent>
        )}
      </Card>

      {isLibraryOpen && (
        <AssessmentLibraryModal
          clientId={client.id}
          client={client}
          onClose={() => setIsLibraryOpen(false)}
          onSelectAssessment={addAssessmentToClient}
        />
      )}

      {runningTest && (
        <AssessmentTestRunnerRouter
          assessment={runningTest.assessment}
          client={client}
          clientAssessment={runningTest.clientAssessment}
          onClose={handleTestComplete}
          onSave={(resultData) => handleAssessmentSave(runningTest.clientAssessment.id, resultData)}
          isStandaloneMode={false}
        />
      )}

      {viewingAssessment && (
        <CompletedAssessmentViewer
          client={client}
          assessment={viewingAssessment.assessment}
          clientAssessment={viewingAssessment.clientAssessment}
          onClose={() => setViewingAssessment(null)}
        />
      )}
    </div>
  );
}