import React from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

// One non-invasive line, placed directly beside every distinct AI-generated
// content surface in the app. The full AI and Automated Processing
// Transparency Notice is captured as a consent event once, at sign-on
// (PractitionerNoticesSection.jsx, during ProfileSetup) — this component is
// deliberately NOT a second notice or a second consent capture, just a
// standing reminder with a link back to the one notice that already exists.
// Per Max's direction, 13 July 2026: exact wording, "here" hyperlinked only.
export default function AIDisclosureNote({ className = "" }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs text-slate-400 ${className}`}>
      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <span>
        AI generated content can make mistakes. To see the full AI and Automated Processing Transparency Notice
        please click{" "}
        <Link to="/legal/ai-notice" target="_blank" className="underline hover:text-slate-600">
          here
        </Link>
        .
      </span>
    </p>
  );
}
