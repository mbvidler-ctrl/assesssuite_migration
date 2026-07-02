import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Toaster, toast } from "sonner";

import TestRunner from "../components/assessments/TestRunner";

export default function TestRunnerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientAssessmentId = searchParams.get('clientAssessmentId');
  const appointmentId = searchParams.get('appointmentId');
  const returnTo = searchParams.get("returnTo");
  
  const [clientAssessment, setClientAssessment] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!clientAssessmentId) {
        toast.error("No assessment specified");
        navigate(createPageUrl("AssessmentLibrary"));
        return;
      }

      try {
        const clientAssessmentData = await base44.entities.ClientAssessment.filter({ id: clientAssessmentId });
        if (!clientAssessmentData || clientAssessmentData.length === 0) {
          toast.error("Assessment not found");
          navigate(createPageUrl("AssessmentLibrary"));
          return;
        }

        const ca = clientAssessmentData[0];
        setClientAssessment(ca);

        const [allAssessmentsData, allClientsData] = await Promise.all([
          base44.entities.Assessment.list(),
          base44.entities.Client.list()
        ]);

        const assessmentItem = allAssessmentsData.find(a => a.id === ca.assessment_id);
        const clientItem = allClientsData.find(c => c.id === ca.client_id);

        if (assessmentItem) setAssessment(assessmentItem);
        if (clientItem) setClient(clientItem);

      } catch (error) {
        console.error("Failed to load test runner data:", error);
        toast.error("Failed to load assessment data");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [clientAssessmentId, navigate]);

  const handleClose = () => {
    if (appointmentId) {
      navigate(createPageUrl("Calendar"));
    } else {
      if (client) {
        navigate(createPageUrl(`ClientProfile?id=${client.id}`));
      } else {
        navigate(createPageUrl("AssessmentLibrary"));
      }
    }
  };

  const handleSaveAndExit = async (result, notes, barriers, normativeComparison, additionalData) => {
    if (!clientAssessment) return;

    try {
      const updateData = {
        result_value: result,
        notes: notes,
        status: 'completed',
        assessment_date: new Date().toISOString().split('T')[0],
        normative_comparison: normativeComparison,
        barriers: barriers,
        additional_data: additionalData || {}
      };

      await base44.entities.ClientAssessment.update(clientAssessment.id, updateData);
      toast.success("Assessment completed successfully!");
      
      if (returnTo) {
        const decodedUrl = decodeURIComponent(returnTo);
        try {
          const url = new URL(decodedUrl);
          navigate(url.pathname + url.search);
        } catch {
          navigate(decodedUrl);
        }
      } else {
        navigate(createPageUrl(`ClientProfile?clientId=${clientAssessment.client_id}`));
      }

    } catch (error) {
      console.error("Failed to save assessment:", error);
      toast.error(`Failed to save assessment: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 flex items-center justify-center">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 p-8">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-slate-700">Loading assessment...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!clientAssessment || !assessment || !client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 flex items-center justify-center">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 p-8">
          <p className="text-slate-700">Assessment data not found.</p>
          <Button 
            onClick={() => navigate(createPageUrl("AssessmentLibrary"))}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
        <TestRunner
          client={client}
          assessment={assessment}
          clientAssessment={clientAssessment}
          onClose={handleClose}
          onComplete={handleSaveAndExit}
        />
      </div>
    </>
  );
}