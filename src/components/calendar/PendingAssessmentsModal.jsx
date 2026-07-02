import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardList, Play, CheckCircle2, Clock, X, Plus } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import AssessmentTestRunnerRouter from "../assessments/AssessmentTestRunnerRouter";

export default function PendingAssessmentsModal({ 
  isOpen, 
  onClose, 
  clientId,
  client,
  appointmentId,
  onAssessmentCompleted 
}) {
  const navigate = useNavigate();
  const [pendingAssessments, setPendingAssessments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningAssessment, setRunningAssessment] = useState(null);
  const [clinicianNotes, setClinicianNotes] = useState('');

  useEffect(() => {
    if (isOpen && clientId) {
      loadPendingAssessments();
    }
  }, [isOpen, clientId]);

  const loadPendingAssessments = async () => {
    setIsLoading(true);
    try {
      // Get all client assessments that are pending
      const clientAssessments = await base44.entities.ClientAssessment.filter({ 
        client_id: clientId,
        status: 'pending'
      });

      // Get assessment details for each
      const assessmentsWithDetails = await Promise.all(
        clientAssessments.map(async (ca) => {
          const assessments = await base44.entities.Assessment.filter({ id: ca.assessment_id });
          return {
            ...ca,
            assessment: assessments[0] || null
          };
        })
      );

      setPendingAssessments(assessmentsWithDetails.filter(a => a.assessment));
    } catch (error) {
      console.error("Error loading pending assessments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAssessment = (item) => {
    setRunningAssessment(item);
  };

  const handleAssessmentComplete = () => {
    setRunningAssessment(null);
    setClinicianNotes('');
    loadPendingAssessments();
    if (onAssessmentCompleted) {
      onAssessmentCompleted();
    }
    onClose();
  };

  return (
    <>
      {runningAssessment && (
        <div className="fixed inset-0 z-[80] bg-white flex">
          <div className="flex-1 min-w-0 overflow-auto">
            <AssessmentTestRunnerRouter
              assessment={runningAssessment.assessment}
              client={client}
              clientAssessment={runningAssessment}
              isStandaloneMode={false}
              clinicianNotes={clinicianNotes}
              onClose={() => {
                setRunningAssessment(null);
                setClinicianNotes('');
              }}
              onComplete={() => {
                handleAssessmentComplete();
                setClinicianNotes('');
              }}
            />
          </div>
        </div>
      )}

      <Dialog open={isOpen && !runningAssessment} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              Pending Assessments
            </DialogTitle>
          </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : pendingAssessments.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No pending assessments</p>
            <p className="text-sm text-slate-500 mt-1">
              All assessments for this client have been completed
            </p>
            <Button
              onClick={() => navigate(`${createPageUrl("AssessmentLibrary")}?clientId=${clientId}`)}
              className="mt-4 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Assessments
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {pendingAssessments.length} assessment{pendingAssessments.length !== 1 ? 's' : ''} queued for this client
            </p>
            
            {pendingAssessments.map((item) => (
              <div 
                key={item.id} 
                className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900">
                      {item.assessment?.name || 'Unknown Assessment'}
                    </h4>
                    <p className="text-sm text-slate-500 mt-1">
                      {item.assessment?.category || 'General'}
                    </p>
                    {item.assessment?.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {item.assessment.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="ml-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending
                  </Badge>
                </div>
                
                <Button
                  onClick={() => handleRunAssessment(item)}
                  className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run Assessment
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}