import React from "react";
import { AlertTriangle } from "lucide-react";

// Verbatim propagation of the suite's own release-status line — never
// paraphrased, never silently dropped. See documentRegistry.js.
export default function ReleaseStatusBanner({ releaseStatus, version }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-6">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-amber-900">
        <p className="font-semibold">{releaseStatus}</p>
        <p className="text-amber-700 mt-0.5">Version {version}</p>
      </div>
    </div>
  );
}
