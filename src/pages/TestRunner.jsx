import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Toaster, toast } from "sonner";
import { buildTimeProfession } from "@/lib/profession";

import AssessmentTestRunnerRouter from "../components/assessments/AssessmentTestRunnerRouter";

export default function TestRunnerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientAssessmentId = searchParams.get('clientAssessmentId');
  const appointmentId = searchParams.get('appointmentId');
  const careEpisodeId = searchParams.get('careEpisodeId') || searchParams.get('episode_id');
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
        if (buildTimeProfession.id === 'physio' && (
          !careEpisodeId || ca.physio_care_episode_id !== careEpisodeId
        )) {
          toast.error('Open this assessment from its selected Physio care episode.');
          const episodeQuery = ca.physio_care_episode_id
            ? `&episode_id=${encodeURIComponent(ca.physio_care_episode_id)}`
            : '';
          navigate(createPageUrl(`PhysioEpisodes?client_id=${encodeURIComponent(ca.client_id)}${episodeQuery}`));
          return;
        }
        if (careEpisodeId && ca.physio_care_episode_id !== careEpisodeId) {
          throw new Error('Assessment does not belong to the selected care episode');
        }
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
  }, [careEpisodeId, clientAssessmentId, navigate]);

  const handleClose = () => {
    if (careEpisodeId && client) {
      navigate(createPageUrl(`PhysioEpisodes?client_id=${client.id}&episode_id=${careEpisodeId}`));
    } else if (appointmentId) {
      navigate(createPageUrl("Calendar"));
    } else {
      if (client) {
        navigate(createPageUrl(`ClientProfile?id=${client.id}`));
      } else {
        navigate(createPageUrl("AssessmentLibrary"));
      }
    }
  };

  // The TestRunner component persists the completed record and SOAP note
  // itself before invoking onComplete, so no second update is issued here —
  // the previous redundant update overwrote runner-saved additional_data
  // with an empty object on the deep-link /TestRunner flow.
  const handleSaveAndExit = async () => {
    if (!clientAssessment) return;

    try {
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
        navigate(careEpisodeId
          ? createPageUrl(`PhysioEpisodes?client_id=${clientAssessment.client_id}&episode_id=${careEpisodeId}`)
          : createPageUrl(`ClientProfile?id=${clientAssessment.client_id}`));
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
        <AssessmentTestRunnerRouter
          client={client}
          assessment={assessment}
          clientAssessment={clientAssessment}
          onClose={handleClose}
          onComplete={handleSaveAndExit}
          isStandaloneMode={false}
        />
      </div>
    </>
  );
}
