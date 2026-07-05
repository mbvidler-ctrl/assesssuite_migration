import React, { useState } from "react";
import { X, ZoomIn } from "lucide-react";

// ── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ image, onClose }) {
  if (!image) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 py-3 border-b bg-slate-50">
          <p className="text-sm font-semibold text-slate-700">{image.caption}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 bg-white flex items-center justify-center">
          {image.svg}
        </div>
        {image.notes && (
          <div className="px-4 pb-4 text-xs text-slate-500 space-y-1">
            {image.notes.map((n, i) => <p key={i}>{n}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SVG Diagrams ─────────────────────────────────────────────────────────────

// Diagram 1: Starting Position — patient prone, supported on plinth
function DiagramStartingPosition() {
  return (
    <svg viewBox="0 0 480 220" className="w-full" aria-label="Starting Position">
      {/* Plinth/bench */}
      <rect x="20" y="120" width="440" height="18" rx="3" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
      <rect x="20" y="138" width="440" height="6" rx="2" fill="#9ca3af"/>
      {/* Bench legs */}
      <rect x="40" y="144" width="12" height="40" rx="2" fill="#6b7280"/>
      <rect x="428" y="144" width="12" height="40" rx="2" fill="#6b7280"/>
      <rect x="160" y="144" width="12" height="40" rx="2" fill="#6b7280"/>
      <rect x="308" y="144" width="12" height="40" rx="2" fill="#6b7280"/>

      {/* Patient body prone — lower body on bench */}
      {/* Legs on bench */}
      <rect x="220" y="106" width="200" height="22" rx="10" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
      {/* Pelvis block — at bench edge */}
      <ellipse cx="222" cy="117" rx="22" ry="14" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5"/>

      {/* Torso hanging off edge */}
      <path d="M222 111 Q200 108 120 112 Q100 113 90 116" stroke="#fbbf24" strokeWidth="20" strokeLinecap="round" fill="none"/>
      {/* Torso supported (slightly drooping for "starting" — will be horizontal in hold) */}
      <path d="M222 111 Q180 115 120 118 Q100 119 90 122" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="4,3"/>

      {/* Arms crossed over chest */}
      <path d="M140 112 Q130 106 120 110 Q115 113 125 116 Q135 119 140 113" stroke="#92400e" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M135 110 Q145 104 155 108 Q160 111 150 115 Q140 118 135 113" stroke="#92400e" strokeWidth="3" fill="none" strokeLinecap="round"/>

      {/* Head */}
      <ellipse cx="85" cy="118" rx="16" ry="13" fill="#fed7aa" stroke="#f59e0b" strokeWidth="1.5"/>
      {/* Face profile looking down */}
      <path d="M78 115 Q74 118 76 122 Q78 124 80 122" stroke="#92400e" strokeWidth="1.5" fill="none"/>

      {/* ASIS alignment arrow & label */}
      <line x1="222" y1="85" x2="222" y2="105" stroke="#dc2626" strokeWidth="2" markerEnd="url(#arrowRed)"/>
      <rect x="172" y="68" width="100" height="18" rx="4" fill="#fee2e2" stroke="#dc2626" strokeWidth="1"/>
      <text x="222" y="81" textAnchor="middle" fontSize="9" fill="#dc2626" fontWeight="600">ASIS / Iliac crest</text>
      <text x="222" y="90" textAnchor="middle" fontSize="8" fill="#dc2626">aligned at bench edge</text>

      {/* Bench edge marker */}
      <line x1="222" y1="100" x2="222" y2="145" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3,2"/>

      {/* Gravity arrow on torso */}
      <line x1="150" y1="95" x2="150" y2="112" stroke="#6b7280" strokeWidth="1.5" markerEnd="url(#arrowGrey)"/>
      <text x="154" y="105" fontSize="8" fill="#6b7280">gravity</text>

      {/* Labels */}
      <text x="370" y="112" textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">Lower body on bench</text>
      <text x="130" y="145" textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">Unsupported upper body</text>

      <defs>
        <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#dc2626"/>
        </marker>
        <marker id="arrowGrey" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#6b7280"/>
        </marker>
      </defs>
    </svg>
  );
}

// Diagram 2: Stabilisation Setup — straps on thighs, pelvis, calves
function DiagramStabilisationSetup() {
  return (
    <svg viewBox="0 0 480 220" className="w-full" aria-label="Stabilisation Setup">
      {/* Plinth */}
      <rect x="20" y="120" width="440" height="18" rx="3" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
      <rect x="20" y="138" width="440" height="6" rx="2" fill="#9ca3af"/>
      <rect x="40" y="144" width="12" height="40" rx="2" fill="#6b7280"/>
      <rect x="428" y="144" width="12" height="40" rx="2" fill="#6b7280"/>

      {/* Lower body prone on bench */}
      <rect x="225" y="104" width="195" height="22" rx="10" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
      <ellipse cx="225" cy="115" rx="22" ry="15" fill="#f59e0b" stroke="#d97706" strokeWidth="2"/>

      {/* Calves / feet */}
      <rect x="350" y="106" width="70" height="16" rx="8" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
      <ellipse cx="418" cy="114" rx="12" ry="8" fill="#fed7aa" stroke="#f59e0b" strokeWidth="1.5"/>

      {/* Torso hanging off (horizontal - correct position) */}
      <path d="M225 109 Q185 108 120 108 Q100 108 90 110" stroke="#fbbf24" strokeWidth="20" strokeLinecap="round" fill="none"/>

      {/* Arms crossed */}
      <path d="M140 106 Q130 100 120 104 Q115 107 125 111 Q135 114 140 107" stroke="#92400e" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M135 104 Q145 98 155 102 Q160 105 150 109 Q140 112 135 107" stroke="#92400e" strokeWidth="3" fill="none" strokeLinecap="round"/>

      {/* Head */}
      <ellipse cx="84" cy="110" rx="16" ry="13" fill="#fed7aa" stroke="#f59e0b" strokeWidth="1.5"/>

      {/* STRAP 1 — calves */}
      <rect x="340" y="100" width="16" height="28" rx="3" fill="none" stroke="#2563eb" strokeWidth="3"/>
      <line x1="340" y1="100" x2="325" y2="92" stroke="#2563eb" strokeWidth="2"/>
      <rect x="300" y="84" width="50" height="14" rx="3" fill="#dbeafe" stroke="#2563eb" strokeWidth="1"/>
      <text x="325" y="94" textAnchor="middle" fontSize="8" fill="#1d4ed8" fontWeight="600">Calf strap</text>

      {/* STRAP 2 — thighs */}
      <rect x="270" y="100" width="16" height="28" rx="3" fill="none" stroke="#7c3aed" strokeWidth="3"/>
      <line x1="278" y1="100" x2="278" y2="86" stroke="#7c3aed" strokeWidth="2"/>
      <rect x="248" y="74" width="60" height="14" rx="3" fill="#ede9fe" stroke="#7c3aed" strokeWidth="1"/>
      <text x="278" y="84" textAnchor="middle" fontSize="8" fill="#5b21b6" fontWeight="600">Thigh strap</text>

      {/* STRAP 3 — pelvis */}
      <rect x="212" y="99" width="26" height="32" rx="3" fill="none" stroke="#dc2626" strokeWidth="3"/>
      <line x1="225" y1="99" x2="225" y2="82" stroke="#dc2626" strokeWidth="2"/>
      <rect x="190" y="68" width="70" height="14" rx="3" fill="#fee2e2" stroke="#dc2626" strokeWidth="1"/>
      <text x="225" y="78" textAnchor="middle" fontSize="8" fill="#991b1b" fontWeight="600">Pelvic strap</text>

      {/* Horizontal alignment indicator */}
      <line x1="88" y1="110" x2="222" y2="110" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="5,3"/>
      <text x="155" y="105" textAnchor="middle" fontSize="8" fill="#16a34a" fontWeight="600">Horizontal trunk ✓</text>

      {/* Bench edge */}
      <line x1="222" y1="95" x2="222" y2="145" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x="240" y="160" fontSize="8" fill="#dc2626">bench edge</text>

      <text x="240" y="195" textAnchor="middle" fontSize="9" fill="#374151">Three-point fixation: calves · thighs · pelvis</text>
    </svg>
  );
}

// Diagram 3: Correct Horizontal Hold — side profile
function DiagramHorizontalHold() {
  return (
    <svg viewBox="0 0 480 240" className="w-full" aria-label="Correct Horizontal Hold">
      {/* Plinth */}
      <rect x="20" y="130" width="440" height="18" rx="3" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
      <rect x="20" y="148" width="440" height="6" rx="2" fill="#9ca3af"/>
      <rect x="40" y="154" width="12" height="40" rx="2" fill="#6b7280"/>
      <rect x="428" y="154" width="12" height="40" rx="2" fill="#6b7280"/>

      {/* Lower body on bench */}
      <rect x="225" y="115" width="190" height="22" rx="10" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
      <ellipse cx="225" cy="126" rx="22" ry="14" fill="#f59e0b" stroke="#d97706" strokeWidth="2"/>

      {/* Torso — HORIZONTAL, perfectly level */}
      <path d="M225 120 Q185 120 120 120 Q100 120 88 120" stroke="#fbbf24" strokeWidth="20" strokeLinecap="round" fill="none"/>

      {/* Arms CROSSED over chest */}
      <path d="M148 113 Q138 107 128 111 Q122 114 132 118 Q142 121 148 114" stroke="#92400e" strokeWidth="3.5" fill="#fed7aa" strokeLinecap="round"/>
      <path d="M143 111 Q153 105 163 109 Q168 112 158 116 Q148 119 143 114" stroke="#92400e" strokeWidth="3.5" fill="#fed7aa" strokeLinecap="round"/>
      {/* Cross indicator */}
      <text x="148" y="128" textAnchor="middle" fontSize="8" fill="#92400e" fontWeight="600">arms crossed</text>

      {/* Head */}
      <ellipse cx="82" cy="120" rx="16" ry="13" fill="#fed7aa" stroke="#f59e0b" strokeWidth="1.5"/>

      {/* HORIZONTAL REFERENCE LINE */}
      <line x1="30" y1="120" x2="450" y2="120" stroke="#16a34a" strokeWidth="2" strokeDasharray="8,4"/>

      {/* Angle arc + label showing 0° (horizontal) */}
      <path d="M 225 120 m 0 0 a 30 30 0 0 0 0 -30" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="4,2"/>
      <text x="258" y="107" fontSize="9" fill="#16a34a" fontWeight="700">0° — Horizontal ✓</text>

      {/* Bench edge */}
      <line x1="225" y1="105" x2="225" y2="155" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x="228" y="168" fontSize="8" fill="#dc2626">bench edge</text>

      {/* Spine indicator */}
      <path d="M210 120 Q213 116 215 120 Q218 124 220 120" stroke="#7c3aed" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <text x="200" y="112" fontSize="8" fill="#7c3aed" fontWeight="600">neutral spine</text>

      {/* Green check */}
      <circle cx="60" cy="200" r="12" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5"/>
      <path d="M54 200 L58 205 L67 194" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>

      <text x="78" y="197" fontSize="9" fill="#16a34a" fontWeight="700">Trunk parallel to bench surface</text>
      <text x="78" y="210" fontSize="8" fill="#374151">Timer starts once this position is stable</text>
      <text x="78" y="222" fontSize="8" fill="#374151">Stop when trunk drops {'>'} 10° below horizontal</text>
    </svg>
  );
}

// Diagram 4: Common Compensation / Failure — trunk drop > 10°
function DiagramCompensation() {
  return (
    <svg viewBox="0 0 480 240" className="w-full" aria-label="Common Compensation Example">
      {/* Plinth */}
      <rect x="20" y="130" width="440" height="18" rx="3" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
      <rect x="20" y="148" width="440" height="6" rx="2" fill="#9ca3af"/>
      <rect x="40" y="154" width="12" height="40" rx="2" fill="#6b7280"/>
      <rect x="428" y="154" width="12" height="40" rx="2" fill="#6b7280"/>

      {/* Lower body on bench */}
      <rect x="225" y="116" width="190" height="22" rx="10" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
      <ellipse cx="225" cy="127" rx="22" ry="14" fill="#f59e0b" stroke="#d97706" strokeWidth="2"/>

      {/* Torso — DROOPING (failure position, ~20° below horizontal) */}
      <path d="M225 122 Q200 126 160 134 Q130 139 100 143 Q90 145 80 146" stroke="#fbbf24" strokeWidth="20" strokeLinecap="round" fill="none"/>

      {/* Arms drooping */}
      <path d="M148 133 Q138 128 128 133 Q122 136 132 140 Q142 143 148 136" stroke="#92400e" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M143 131 Q153 126 163 130 Q168 133 158 137 Q148 140 143 135" stroke="#92400e" strokeWidth="3" fill="none" strokeLinecap="round"/>

      {/* Head */}
      <ellipse cx="74" cy="148" rx="16" ry="13" fill="#fed7aa" stroke="#f59e0b" strokeWidth="1.5"/>

      {/* HORIZONTAL REFERENCE LINE (correct position) */}
      <line x1="30" y1="122" x2="450" y2="122" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="6,4"/>
      <text x="340" y="118" fontSize="8" fill="#16a34a">Correct horizontal</text>

      {/* ANGLE arc showing >10° drop */}
      <path d="M 225 122 L 225 145" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="2,2"/>
      <path d="M 225 122 L 175 140" stroke="#dc2626" strokeWidth="2"/>
      <path d="M225,122 a25,25 0 0,1 -22,11" fill="none" stroke="#dc2626" strokeWidth="1.5"/>
      <text x="185" y="120" fontSize="9" fill="#dc2626" fontWeight="700">&gt;10° drop</text>
      <text x="185" y="130" fontSize="8" fill="#dc2626">⚠ STOP TEST</text>

      {/* Red X */}
      <circle cx="60" cy="200" r="12" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.5"/>
      <path d="M54 194 L66 206 M66 194 L54 206" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round"/>

      <text x="78" y="197" fontSize="9" fill="#dc2626" fontWeight="700">Trunk drop {'>'} 10° below horizontal = test end</text>
      <text x="78" y="210" fontSize="8" fill="#374151">Other stop criteria: hands leave hips/chest, patient requests stop</text>
      <text x="78" y="222" fontSize="8" fill="#374151">Neurological symptoms, severe pain — stop immediately</text>
    </svg>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
const IMAGES = [
  {
    id: "start",
    caption: "Starting Position",
    notes: [
      "Patient lies prone. ASIS/iliac crest aligned precisely at the bench edge.",
      "Upper body hangs unsupported. Lower body remains on bench surface.",
      "Clinician confirms alignment before straps are applied.",
    ],
    svg: <DiagramStartingPosition />,
    thumb: <DiagramStartingPosition />,
  },
  {
    id: "stab",
    caption: "Stabilisation Setup",
    notes: [
      "Three-point fixation: pelvic strap, thigh strap, calf strap.",
      "Straps must be firm but not restrict circulation.",
      "Arms crossed over chest — standard protocol position.",
    ],
    svg: <DiagramStabilisationSetup />,
    thumb: <DiagramStabilisationSetup />,
  },
  {
    id: "hold",
    caption: "Correct Horizontal Hold",
    notes: [
      "Trunk held perfectly parallel to bench surface (0°).",
      "Neutral lumbar spine — no hyperextension.",
      "Timer starts once stable horizontal position is confirmed.",
    ],
    svg: <DiagramHorizontalHold />,
    thumb: <DiagramHorizontalHold />,
  },
  {
    id: "comp",
    caption: "Common Compensation — Trunk Drop",
    notes: [
      "Test ends when trunk drops >10° below horizontal.",
      "Also stop for: pain, neurological symptoms, patient request.",
      "Document the reason for stopping as part of the assessment.",
    ],
    svg: <DiagramCompensation />,
    thumb: <DiagramCompensation />,
  },
];

export default function BieringSorensenDiagrams() {
  const [lightbox, setLightbox] = useState(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {IMAGES.map(img => (
          <div
            key={img.id}
            className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden cursor-pointer group hover:border-amber-400 hover:shadow-md transition-all"
            onClick={() => setLightbox(img)}
          >
            <div className="relative bg-white p-2">
              <div className="pointer-events-none">{img.thumb}</div>
              <div className="absolute top-2 right-2 bg-white/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <p className="text-xs text-center text-slate-600 font-medium py-2 px-3 bg-slate-50 border-t border-slate-200">
              {img.caption}
              <span className="text-amber-500 ml-1 text-xs">(click to expand)</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 space-y-1">
        <p><strong>Key Setup Points:</strong></p>
        <p>① ASIS/iliac crest aligned precisely at the bench edge</p>
        <p>② Lower body secured with straps at thighs, pelvis, and calves</p>
        <p>③ Arms folded across chest (not behind neck)</p>
        <p>④ Trunk initially supported — released on clinician command</p>
        <p>⑤ Timer starts once horizontal trunk alignment is confirmed</p>
        <p>⑥ Correct horizontal position = trunk parallel to bench surface</p>
        <p>⑦ Stop at &gt;10° trunk drop below horizontal</p>
      </div>

      <Lightbox image={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}