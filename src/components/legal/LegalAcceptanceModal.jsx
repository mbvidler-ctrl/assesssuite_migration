import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertCircle, Sparkles, Stethoscope, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function LegalAcceptanceModal({ isOpen, onAccept, user }) {
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleAccept = async () => {
    setIsSaving(true);
    try {
      await base44.entities.LegalAcceptance.create({
        user_email: user.email,
        user_role: user.role === 'admin' ? 'Admin' : 'Clinician',
        document_set_id: "allied-assess-session-acknowledgement-v1",
        document_set_version: "2.0.0",
        accepted_documents: ["session_acknowledgement"],
        accepted: true,
        ip_address: await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => d.ip).catch(() => 'unknown'),
        user_agent: navigator.userAgent,
        session_timestamp: new Date().toISOString()
      });
      toast.success("Session acknowledgement recorded");
      onAccept();
    } catch (error) {
      console.error("Error saving acceptance:", error);
      toast.error("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDecline = () => {
    base44.auth.logout();
    window.location.href = "https://www.google.com";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">

        {/* Logo / Header */}
        <div className="flex items-center justify-center mb-6">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68746e3e91f52664774f3d05/c1a23eb59_AlliedAssessBETTER.png"
            alt="Allied Assess"
            className="h-12 w-auto"
          />
        </div>

        <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
          Session Acknowledgement
        </h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          Required each session â€” your acceptance is logged with a timestamp.
        </p>

        {/* Acknowledgement points */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              Allied Assess provides <strong>clinical guidance only</strong>. I retain full professional and legal responsibility for all clinical decisions and client outcomes.
            </p>
          </div>

          <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
            <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <strong>Some content</strong> is generated or assisted by AI. All AI-generated content must be reviewed and approved by me before clinical use.
            </p>
          </div>

          <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
            <Stethoscope className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              Treatment protocols are <strong>reference frameworks only</strong> and must be adapted to each client's individual presentation. Each client is unique and results must be interpreted in context.
            </p>
          </div>

          <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              I hold current professional registration, have obtained appropriate client consent, and am handling data in accordance with the <strong>Privacy Act 1988</strong> and applicable health records legislation.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <Button
          onClick={handleAccept}
          disabled={isSaving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-base mb-3"
        >
          {isSaving ? "Recording..." : "I Agree & Continue"}
        </Button>

        <button
          onClick={handleDecline}
          className="w-full text-sm text-slate-400 hover:text-red-500 transition-colors py-1"
        >
          Decline & exit
        </button>
      </div>
    </div>
  );
}