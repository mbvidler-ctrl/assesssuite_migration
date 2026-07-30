import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { AI_COPY, CAPABILITY_KEYS, capabilityStatusLabel } from "@/lib/aiCapabilities";

const CAPABILITY_ROWS = {
  general_clinical_llm: {
    name: "AI writing assistance",
    description: "Treatment protocols, SOAP drafting, report sections, medication considerations, assessment suggestions and nutrition advice.",
  },
  transcription: {
    name: "Session transcription",
    description: "Recording transcription and dissect-to-SOAP.",
  },
  document_extraction: {
    name: "Referral document extraction",
    description: "Reading uploaded referral documents into a reviewable draft.",
  },
};

function statusBadgeVariant(capability) {
  if (!capability || capability.reason === 'unknown') return 'secondary';
  return capability.available ? 'default' : 'outline';
}

function unavailableExplanation(capability) {
  if (!capability || capability.available !== false) return null;
  return capability.reason === 'unconfigured' ? AI_COPY.unavailableUnconfigured : AI_COPY.unavailableSwitchedOff;
}

export default function AiFeatureStatusCard() {
  const { capabilities, publicSettingsFetchedAt, refreshPublicSettings } = useAuth();

  const hasUnknown = CAPABILITY_KEYS.some((key) => capabilities?.[key]?.reason === 'unknown');

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
      <CardHeader>
        <CardTitle>{AI_COPY.panelTitle}</CardTitle>
        <p className="text-sm text-slate-600">{AI_COPY.panelIntro}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {CAPABILITY_KEYS.map((key) => {
          const capability = capabilities?.[key];
          const row = CAPABILITY_ROWS[key];
          const explanation = unavailableExplanation(capability);
          return (
            <div key={key} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
              <div>
                <p className="font-medium text-slate-900">{row.name}</p>
                <p className="text-sm text-slate-500">{row.description}</p>
                {explanation && <p className="text-xs text-slate-500 mt-1">{explanation}</p>}
              </div>
              <Badge variant={statusBadgeVariant(capability)}>{capabilityStatusLabel(capability)}</Badge>
            </div>
          );
        })}

        {hasUnknown && (
          <p className="text-xs text-slate-500">{AI_COPY.panelUnknown}</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            {AI_COPY.panelLastChecked}: {publicSettingsFetchedAt ? new Date(publicSettingsFetchedAt).toLocaleTimeString('en-AU') : '—'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refreshPublicSettings({ force: true })}>
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
            {AI_COPY.panelRecheck}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
