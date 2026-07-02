import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const BODY_REGIONS = [
  { id: 'head', label: 'Head', x: 50, y: 8, width: 12, height: 8 },
  { id: 'neck', label: 'Neck', x: 50, y: 16, width: 8, height: 5 },
  { id: 'left_shoulder', label: 'L Shoulder', x: 30, y: 22, width: 12, height: 8 },
  { id: 'right_shoulder', label: 'R Shoulder', x: 70, y: 22, width: 12, height: 8 },
  { id: 'chest', label: 'Chest', x: 50, y: 28, width: 20, height: 12 },
  { id: 'upper_back', label: 'Upper Back', x: 50, y: 28, width: 20, height: 12, back: true },
  { id: 'left_arm', label: 'L Arm', x: 22, y: 32, width: 8, height: 18 },
  { id: 'right_arm', label: 'R Arm', x: 78, y: 32, width: 8, height: 18 },
  { id: 'left_elbow', label: 'L Elbow', x: 20, y: 38, width: 6, height: 6 },
  { id: 'right_elbow', label: 'R Elbow', x: 80, y: 38, width: 6, height: 6 },
  { id: 'left_forearm', label: 'L Forearm', x: 18, y: 45, width: 6, height: 12 },
  { id: 'right_forearm', label: 'R Forearm', x: 82, y: 45, width: 6, height: 12 },
  { id: 'left_hand', label: 'L Hand', x: 15, y: 58, width: 8, height: 8 },
  { id: 'right_hand', label: 'R Hand', x: 85, y: 58, width: 8, height: 8 },
  { id: 'abdomen', label: 'Abdomen', x: 50, y: 42, width: 18, height: 10 },
  { id: 'lower_back', label: 'Lower Back', x: 50, y: 42, width: 18, height: 10, back: true },
  { id: 'left_hip', label: 'L Hip', x: 38, y: 52, width: 10, height: 8 },
  { id: 'right_hip', label: 'R Hip', x: 62, y: 52, width: 10, height: 8 },
  { id: 'groin', label: 'Groin', x: 50, y: 54, width: 10, height: 6 },
  { id: 'left_thigh', label: 'L Thigh', x: 38, y: 60, width: 10, height: 14 },
  { id: 'right_thigh', label: 'R Thigh', x: 62, y: 60, width: 10, height: 14 },
  { id: 'left_knee', label: 'L Knee', x: 38, y: 74, width: 8, height: 6 },
  { id: 'right_knee', label: 'R Knee', x: 62, y: 74, width: 8, height: 6 },
  { id: 'left_shin', label: 'L Shin/Calf', x: 38, y: 80, width: 8, height: 12 },
  { id: 'right_shin', label: 'R Shin/Calf', x: 62, y: 80, width: 8, height: 12 },
  { id: 'left_ankle', label: 'L Ankle', x: 38, y: 92, width: 6, height: 4 },
  { id: 'right_ankle', label: 'R Ankle', x: 62, y: 92, width: 6, height: 4 },
  { id: 'left_foot', label: 'L Foot', x: 38, y: 96, width: 8, height: 4 },
  { id: 'right_foot', label: 'R Foot', x: 62, y: 96, width: 8, height: 4 },
];

const PAIN_COLORS = {
  1: '#93C5FD', // blue-300
  2: '#60A5FA', // blue-400
  3: '#3B82F6', // blue-500
  4: '#FBBF24', // amber-400
  5: '#F59E0B', // amber-500
  6: '#F97316', // orange-500
  7: '#EF4444', // red-500
  8: '#DC2626', // red-600
  9: '#B91C1C', // red-700
  10: '#7F1D1D', // red-900
};

export default function BodyPainChart({ painLocations = [], onPainLocationsChange, readOnly = false, printMode = false }) {
  const [selectedIntensity, setSelectedIntensity] = useState(5);
  const [view, setView] = useState('front'); // 'front' or 'back'

  const handleRegionClick = (regionId) => {
    if (readOnly) return;
    
    const existingIndex = painLocations.findIndex(p => p.region === regionId);
    if (existingIndex >= 0) {
      // Update existing
      const updated = [...painLocations];
      updated[existingIndex] = { region: regionId, intensity: selectedIntensity };
      onPainLocationsChange(updated);
    } else {
      // Add new
      onPainLocationsChange([...painLocations, { region: regionId, intensity: selectedIntensity }]);
    }
  };

  const handleRemoveRegion = (regionId) => {
    if (readOnly) return;
    onPainLocationsChange(painLocations.filter(p => p.region !== regionId));
  };

  const getPainForRegion = (regionId) => {
    return painLocations.find(p => p.region === regionId);
  };

  const visibleRegions = BODY_REGIONS.filter(r => view === 'back' ? r.back : !r.back);

  if (printMode) {
    return (
      <div className="body-pain-chart-print">
        <div className="flex justify-center gap-8 mb-4">
          {/* Front View */}
          <div className="text-center">
            <p className="text-sm font-semibold mb-2">Front View</p>
            <svg viewBox="0 0 100 100" className="w-48 h-64 border border-gray-300">
              {/* Simple body outline - front */}
              <ellipse cx="50" cy="10" rx="8" ry="8" fill="none" stroke="#666" strokeWidth="0.5" />
              <line x1="50" y1="18" x2="50" y2="22" stroke="#666" strokeWidth="0.5" />
              <rect x="35" y="22" width="30" height="30" rx="3" fill="none" stroke="#666" strokeWidth="0.5" />
              <line x1="35" y1="28" x2="20" y2="55" stroke="#666" strokeWidth="0.5" />
              <line x1="65" y1="28" x2="80" y2="55" stroke="#666" strokeWidth="0.5" />
              <line x1="42" y1="52" x2="40" y2="85" stroke="#666" strokeWidth="0.5" />
              <line x1="58" y1="52" x2="60" y2="85" stroke="#666" strokeWidth="0.5" />
              <ellipse cx="38" cy="90" rx="5" ry="3" fill="none" stroke="#666" strokeWidth="0.5" />
              <ellipse cx="62" cy="90" rx="5" ry="3" fill="none" stroke="#666" strokeWidth="0.5" />
              
              {/* Pain markers */}
              {painLocations.map(pain => {
                const region = BODY_REGIONS.find(r => r.id === pain.region && !r.back);
                if (!region) return null;
                return (
                  <circle
                    key={pain.region}
                    cx={region.x}
                    cy={region.y}
                    r="4"
                    fill={PAIN_COLORS[pain.intensity] || '#EF4444'}
                    stroke="#000"
                    strokeWidth="0.3"
                  />
                );
              })}
            </svg>
          </div>
          
          {/* Back View */}
          <div className="text-center">
            <p className="text-sm font-semibold mb-2">Back View</p>
            <svg viewBox="0 0 100 100" className="w-48 h-64 border border-gray-300">
              {/* Simple body outline - back */}
              <ellipse cx="50" cy="10" rx="8" ry="8" fill="none" stroke="#666" strokeWidth="0.5" />
              <line x1="50" y1="18" x2="50" y2="22" stroke="#666" strokeWidth="0.5" />
              <rect x="35" y="22" width="30" height="30" rx="3" fill="none" stroke="#666" strokeWidth="0.5" />
              <line x1="35" y1="28" x2="20" y2="55" stroke="#666" strokeWidth="0.5" />
              <line x1="65" y1="28" x2="80" y2="55" stroke="#666" strokeWidth="0.5" />
              <line x1="42" y1="52" x2="40" y2="85" stroke="#666" strokeWidth="0.5" />
              <line x1="58" y1="52" x2="60" y2="85" stroke="#666" strokeWidth="0.5" />
              <ellipse cx="38" cy="90" rx="5" ry="3" fill="none" stroke="#666" strokeWidth="0.5" />
              <ellipse cx="62" cy="90" rx="5" ry="3" fill="none" stroke="#666" strokeWidth="0.5" />
              
              {/* Pain markers for back */}
              {painLocations.map(pain => {
                const region = BODY_REGIONS.find(r => r.id === pain.region && r.back);
                if (!region) return null;
                return (
                  <circle
                    key={pain.region}
                    cx={region.x}
                    cy={region.y}
                    r="4"
                    fill={PAIN_COLORS[pain.intensity] || '#EF4444'}
                    stroke="#000"
                    strokeWidth="0.3"
                  />
                );
              })}
            </svg>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex justify-center gap-1 text-xs mb-2">
          {[1,2,3,4,5,6,7,8,9,10].map(i => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: PAIN_COLORS[i] }}></div>
              <span>{i}</span>
            </div>
          ))}
        </div>
        
        {/* Pain locations list */}
        {painLocations.length > 0 && (
          <div className="mt-2 text-sm">
            <p className="font-semibold">Marked Pain Locations:</p>
            <ul className="list-disc list-inside">
              {painLocations.map(pain => {
                const region = BODY_REGIONS.find(r => r.id === pain.region);
                return (
                  <li key={pain.region}>
                    {region?.label}: {pain.intensity}/10
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="body-pain-chart space-y-4">
      {/* Intensity Selector */}
      {!readOnly && (
        <div className="bg-slate-50 p-3 rounded-lg">
          <p className="text-sm font-medium text-slate-700 mb-2">Select pain intensity, then tap body region:</p>
          <div className="flex gap-1 flex-wrap">
            {[1,2,3,4,5,6,7,8,9,10].map(i => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedIntensity(i)}
                className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                  selectedIntensity === i 
                    ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' 
                    : 'hover:scale-105'
                }`}
                style={{ 
                  backgroundColor: PAIN_COLORS[i],
                  color: i >= 7 ? 'white' : 'black'
                }}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex justify-center gap-2">
        <Button
          type="button"
          variant={view === 'front' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('front')}
        >
          Front View
        </Button>
        <Button
          type="button"
          variant={view === 'back' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('back')}
        >
          Back View
        </Button>
      </div>

      {/* Body Diagram */}
      <div className="flex justify-center">
        <svg viewBox="0 0 100 100" className="w-64 h-80 md:w-80 md:h-96">
          {/* Body outline */}
          <g stroke="#94A3B8" strokeWidth="0.5" fill="#F1F5F9">
            {/* Head */}
            <ellipse cx="50" cy="10" rx="8" ry="8" />
            {/* Neck */}
            <rect x="46" y="17" width="8" height="5" rx="1" />
            {/* Torso */}
            <path d="M35 22 Q30 25 30 35 L30 52 Q30 55 35 55 L42 55 L42 52 L58 52 L58 55 L65 55 Q70 55 70 52 L70 35 Q70 25 65 22 Z" />
            {/* Left Arm */}
            <path d="M30 25 Q22 28 20 35 L18 50 Q16 55 15 58 L17 60 L22 55 L25 40 Q26 32 30 28 Z" />
            {/* Right Arm */}
            <path d="M70 25 Q78 28 80 35 L82 50 Q84 55 85 58 L83 60 L78 55 L75 40 Q74 32 70 28 Z" />
            {/* Left Leg */}
            <path d="M42 52 L40 75 Q39 78 38 80 L36 92 Q35 95 38 96 L42 96 Q44 95 43 92 L44 80 Q45 75 45 72 L48 55 Z" />
            {/* Right Leg */}
            <path d="M58 52 L60 75 Q61 78 62 80 L64 92 Q65 95 62 96 L58 96 Q56 95 57 92 L56 80 Q55 75 55 72 L52 55 Z" />
          </g>

          {/* Clickable regions */}
          {visibleRegions.map(region => {
            const pain = getPainForRegion(region.id);
            return (
              <g key={region.id}>
                <circle
                  cx={region.x}
                  cy={region.y}
                  r={Math.min(region.width, region.height) / 2}
                  fill={pain ? PAIN_COLORS[pain.intensity] : 'transparent'}
                  stroke={pain ? '#000' : '#CBD5E1'}
                  strokeWidth={pain ? '1' : '0.5'}
                  strokeDasharray={pain ? 'none' : '2,2'}
                  className={!readOnly ? 'cursor-pointer hover:stroke-blue-500 hover:stroke-2 transition-all' : ''}
                  onClick={() => handleRegionClick(region.id)}
                />
                {pain && (
                  <text
                    x={region.x}
                    y={region.y + 1}
                    textAnchor="middle"
                    fontSize="4"
                    fontWeight="bold"
                    fill={pain.intensity >= 7 ? 'white' : 'black'}
                  >
                    {pain.intensity}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Pain Locations List */}
      {painLocations.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-sm font-semibold text-slate-700 mb-2">Marked Pain Locations:</p>
          <div className="flex flex-wrap gap-2">
            {painLocations.map(pain => {
              const region = BODY_REGIONS.find(r => r.id === pain.region);
              return (
                <div 
                  key={pain.region}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-sm"
                  style={{ 
                    backgroundColor: PAIN_COLORS[pain.intensity],
                    color: pain.intensity >= 7 ? 'white' : 'black'
                  }}
                >
                  <span>{region?.label}: {pain.intensity}/10</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRegion(pain.region)}
                      className="hover:opacity-70"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}