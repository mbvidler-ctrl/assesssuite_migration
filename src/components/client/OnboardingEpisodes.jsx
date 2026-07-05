import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import {
  History,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
  Target,
  CreditCard,
  CheckCircle2,
  Circle,
  ClipboardList,
} from "lucide-react";

export default function OnboardingEpisodes({ client, onReOnboardStarted }) {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEpisode, setExpandedEpisode] = useState(null);
  const [showReOnboardDialog, setShowReOnboardDialog] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (client?.id) loadEpisodes();
  }, [client?.id]);

  const loadEpisodes = async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.ClientOnboardingEpisode.filter({ client_id: client.id });
      const sorted = (data || []).sort((a, b) => (b.episode_number || 0) - (a.episode_number || 0));
      setEpisodes(sorted);
    } catch (err) {
      console.error("Failed to load episodes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartReOnboard = async () => {
    setIsStarting(true);
    try {
      for (const ep of episodes) {
        if (ep.status === "active") {
          await base44.entities.ClientOnboardingEpisode.update(ep.id, { status: "archived" });
        }
      }

      await base44.entities.Client.update(client.id, {
        apss_completed: false,
        apss_stage2_completed: false,
        consent_confirmed: false,
        privacy_consent: false,
        assessment_consent: false,
        pricing_explained: false,
        client_completed_sections: [],
        apss_q1_heart_stroke: false,
        apss_q1_details: null,
        apss_q2_chest_pain: false,
        apss_q2_details: null,
        apss_q3_faint_dizzy: false,
        apss_q3_details: null,
        apss_q4_asthma: false,
        apss_q4_details: null,
        apss_q5_diabetes_control: false,
        apss_q5_details: null,
        apss_q6_other_conditions: false,
        apss_q6_details: null,
        apss_s2_high_blood_pressure: false,
        apss_s2_high_cholesterol: false,
        apss_s2_high_blood_sugar: false,
        apss_s2_musculoskeletal_issues: false,
        apss_s2_musculoskeletal_details: null,
        apss_s2_hospital_admissions: false,
        apss_s2_hospital_admissions_details: null,
        apss_s2_pregnancy: false,
        apss_s2_pregnancy_details: null,
        client_goals: null,
      });

      toast.success("Re-onboarding started — previous episode archived.");
      setShowReOnboardDialog(false);
      if (onReOnboardStarted) onReOnboardStarted();
      navigate(createPageUrl(`Onboarding?id=${client.id}`));
    } catch (err) {
      console.error("Re-onboard failed:", err);
      toast.error("Failed to start re-onboarding. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const fundingLabels = {
    dva: "DVA", medicare: "Medicare", private_health: "Private Health",
    workcover_qld: "WorkCover QLD", ndis: "NDIS", tac_maic: "TAC/MAIC",
    aged_care: "Aged Care", my_aged_care: "My Aged Care",
    self_funded: "Self-Funded", other: "Other",
  };

  const CheckIcon = ({ done }) => done
    ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
    : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />;

  if (isLoading) return null;

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-5 h-5 text-purple-600" />
              Onboarding Episodes
              {episodes.length > 0 && (
                <Badge variant="secondary" className="ml-1">{episodes.length}</Badge>
              )}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="border-purple-200 text-purple-700 hover:bg-purple-50 gap-1.5"
              onClick={() => setShowReOnboardDialog(true)}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-onboard Client
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {episodes.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No completed onboarding episodes yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Episodes are saved when onboarding is completed via the Onboarding page.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {episodes.map((ep) => {
                const isExpanded = expandedEpisode === ep.id;
                const isActive = ep.status === "active";
                return (
                  <div
                    key={ep.id}
                    className={`border rounded-lg overflow-hidden ${isActive ? "border-purple-200 bg-purple-50/40" : "border-slate-200 bg-slate-50/40"}`}
                  >
                    <button
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-white/60 transition-colors"
                      onClick={() => setExpandedEpisode(isExpanded ? null : ep.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? "bg-purple-600 text-white" : "bg-slate-400 text-white"}`}>
                          {ep.episode_number || "?"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-900">
                              {ep.episode_label || `Episode ${ep.episode_number}`}
                            </span>
                            <Badge
                              variant={isActive ? "default" : "secondary"}
                              className={`text-xs ${isActive ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-500"}`}
                            >
                              {isActive ? "Active" : "Archived"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {ep.episode_date && (
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(ep.episode_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            )}
                            {ep.funding_source && (
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <CreditCard className="w-3 h-3" />
                                {fundingLabels[ep.funding_source] || ep.funding_source}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      }
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-200 p-4 bg-white/70 space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Completion Status</p>
                          <div className="grid grid-cols-2 gap-1.5 text-sm">
                            {[
                              ["APSS Stage 1", ep.apss_completed],
                              ["APSS Stage 2", ep.apss_stage2_completed],
                              ["Consent Confirmed", ep.consent_confirmed],
                              ["Privacy Consent", ep.privacy_consent],
                              ["Assessment Consent", ep.assessment_consent],
                              ["Pricing Explained", ep.pricing_explained],
                            ].map(([label, done]) => (
                              <div key={label} className="flex items-center gap-1.5 text-slate-700">
                                <CheckIcon done={done} />
                                <span className="text-xs">{label}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {ep.client_goals && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                              <Target className="w-3.5 h-3.5" /> Goals
                            </p>
                            <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-200">
                              {ep.client_goals}
                            </p>
                          </div>
                        )}

                        {ep.medical_conditions_snapshot && ep.medical_conditions_snapshot.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Medical Conditions at Onboarding</p>
                            <div className="flex flex-wrap gap-1.5">
                              {ep.medical_conditions_snapshot.map((c, i) => (
                                <Badge key={i} variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700">
                                  {c.condition_name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {(ep.referral_source || ep.referral_source_name || ep.referral_reason) && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Referral</p>
                            <div className="text-sm text-slate-700 space-y-0.5 bg-slate-50 p-2.5 rounded border border-slate-200">
                              {ep.referral_source_name && <p><span className="font-medium">From:</span> {ep.referral_source_name}</p>}
                              {ep.referral_reason && <p><span className="font-medium">Reason:</span> {ep.referral_reason}</p>}
                              {ep.referral_date && <p><span className="font-medium">Date:</span> {new Date(ep.referral_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showReOnboardDialog} onOpenChange={setShowReOnboardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-600" />
              Re-onboard {client?.full_name}?
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-2 text-sm text-slate-700">
              <p>This will start a fresh onboarding episode for this client.</p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2 space-y-1 text-sm text-green-800">
                <p className="font-semibold">✓ What's kept:</p>
                <ul className="ml-3 space-y-0.5 list-disc text-xs">
                  <li>Name, date of birth, contact details</li>
                  <li>Funding source &amp; referral info</li>
                  <li>All previous episode history (archived, always viewable)</li>
                </ul>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2 space-y-1 text-sm text-amber-800">
                <p className="font-semibold">⟳ What gets reset:</p>
                <ul className="ml-3 space-y-0.5 list-disc text-xs">
                  <li>APSS Stage 1 &amp; 2 answers</li>
                  <li>Client goals</li>
                  <li>Consent flags</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowReOnboardDialog(false)}>Cancel</Button>
            <Button
              onClick={handleStartReOnboard}
              disabled={isStarting}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {isStarting ? (
                <><span className="animate-spin">⟳</span> Starting...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Start Re-onboarding</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}