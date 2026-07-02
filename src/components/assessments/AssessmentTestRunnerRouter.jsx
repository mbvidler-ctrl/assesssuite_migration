import React, { useState, useEffect, useRef } from "react";
import SixMeterWalkStandaloneWrapper from "./SixMeterWalkStandaloneWrapper";
import EightFootUpandGoStandaloneWrapper from "./8FootUpandGoStandaloneWrapper";
import FourHundredMeterWalkStandaloneWrapper from "./400MeterWalkStandaloneWrapper";
import SixMinuteStepTestStandaloneWrapper from "./SixMinuteStepTestStandaloneWrapper";
import TestRunner from "./TestRunner";
import QuestionnaireRunner from "./QuestionnaireRunner";
import TestRunnerExtras, { canHandleAssessment } from "./TestRunnerExtras";
import FunctionalIndependenceMeasureFIMRunner from "./FunctionalIndependenceMeasureFIMRunner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, User } from "lucide-react";

// ClientSelectorStep is only shown in true standalone/library mode (isStandaloneMode={true} with no client)
// DO NOT call AssessmentTestRunnerRouter with isStandaloneMode={true} from contexts where the client is already known.
// Always pass isStandaloneMode={false} OR client={client} from: SOAPNoteModal, ClientProfile, PendingAssessmentsModal, etc.
// This ensures the "Select Client" dialog ONLY appears when launching from Assessment Library.

function ClientSelectorStep({ assessment, onSelect, onClose }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const user = await base44.auth.me();
        const orgs = await base44.entities.OrganizationMember.filter({ user_email: user.email });
        if (orgs.length > 0) {
          const list = await base44.entities.Client.filter({ org_id: orgs[0].org_id });
          setClients(list || []);
        }
      } catch (e) {}
      setLoading(false);
    };
    load();
  }, []);

  const filtered = clients.filter(c =>
    c.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center p-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Select a Client</h2>
            <p className="text-sm text-slate-500 mt-0.5">Choose who this test is for: <span className="font-medium text-slate-700">{assessment.name}</span></p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-4">
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {loading ? (
            <p className="text-sm text-slate-500 text-center py-6">Loading clients...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No clients found.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {filtered.map(client => (
                <button
                  key={client.id}
                  onClick={() => onSelect(client)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                    {client.full_name?.charAt(0) || <User className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-medium text-slate-800 group-hover:text-blue-700">{client.full_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Smart router for deciding which test runner to use.
// 
// IMPORTANT: Client Prop Behavior
// - If client is provided: Router skips ClientSelectorStep and goes straight to test runner (even if isStandaloneMode=true)
// - If client is null and isStandaloneMode=true: Shows ClientSelectorStep first
// - If client is null and isStandaloneMode=false: Assumes client will be provided later (should not happen)
//
// Callers must respect this contract:
// - Assessment Library (true standalone): NO client prop, isStandaloneMode={true} â†’ shows selector
// - SOAP Notes, Client Profile, etc (already have client): PASS client prop, isStandaloneMode={false} â†’ goes straight to runner
// 
// All four StandaloneWrapper components (400MeterWalk, 6MeterWalk, 8FootUpandGo, 6MinuteStep) now:
// 1. Accept client prop
// 2. Initialize selectedClient = useState(client || null)
// 3. Only show ClientSelectorModal when !selectedClient
// 4. Receive client prop from this router: client={selectedClient}
export default function AssessmentTestRunnerRouter({ 
  assessment, 
  onClose, 
  onComplete = null,
  onSave = null,
  isStandaloneMode = true,
  client: initialClient = null,
  clientAssessment = null,
}) {
  const [selectedClient, setSelectedClient] = useState(initialClient);
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [showNotes, setShowNotes] = useState(true);
  const [pos, setPos] = useState({ x: window.innerWidth - 296, y: 80 });
  const assessmentName = assessment.name.toLowerCase();

  // If standalone mode and no client chosen yet, show selector first
  if (isStandaloneMode && !selectedClient) {
    return (
      <ClientSelectorStep
        assessment={assessment}
        onSelect={setSelectedClient}
        onClose={onClose}
      />
    );
  }

  const handleDragStart = (e) => {
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    const onMove = (ev) => {
      setPos({ x: ev.clientX - startX, y: ev.clientY - startY });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Floating notes panel â€” sits above the runner modal overlay
  const notesSidebar = showNotes ? (
    <div
      className="fixed z-[10000] flex flex-col bg-white border border-slate-200 rounded-xl shadow-2xl"
      style={{ top: pos.y, left: pos.x, width: '280px', maxHeight: 'calc(100vh - 100px)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-slate-200 rounded-t-xl bg-slate-50 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleDragStart}
      >
        <span className="text-sm font-semibold text-slate-700">ðŸ“ Clinician Notes</span>
        <button onClick={() => setShowNotes(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">âœ•</button>
      </div>
      <textarea
        className="flex-1 w-full p-4 text-sm text-slate-700 bg-white border-none resize-none focus:outline-none focus:ring-0 placeholder-slate-400"
        placeholder={"Jot notes as you assess...\n\nThese will be appended to the SOAP note on save."}
        value={clinicianNotes}
        onChange={(e) => setClinicianNotes(e.target.value)}
        style={{ minHeight: '260px', maxHeight: 'calc(100vh - 220px)' }}
      />
      <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-200 rounded-b-xl bg-slate-50">
        Notes auto-append to SOAP on save
      </div>
    </div>
  ) : (
    <button
      onClick={() => setShowNotes(true)}
      className="fixed z-[10000] bg-white border border-slate-200 rounded-lg shadow-lg px-2 py-3 flex flex-col items-center gap-1 hover:bg-slate-50 transition-colors"
      style={{ top: pos.y, left: pos.x }}
      title="Open clinician notes"
    >
      <span className="text-base">ðŸ“</span>
      <span className="text-slate-500 text-xs" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>Notes</span>
    </button>
  );

  const wrapWithNotes = (runner) => (
    <>
      {runner}
      {notesSidebar}
    </>
  );

  // Check for dedicated interactive runners
  if (assessmentName.includes('6') && assessmentName.includes('meter') && assessmentName.includes('walk')) {
    return wrapWithNotes(<SixMeterWalkStandaloneWrapper assessment={assessment} client={selectedClient} onClose={onClose} clinicianNotes={clinicianNotes} />);
  }

  if (assessmentName.includes('8') && assessmentName.includes('foot') && assessmentName.includes('go')) {
    return wrapWithNotes(<EightFootUpandGoStandaloneWrapper assessment={assessment} client={selectedClient} onClose={onClose} clinicianNotes={clinicianNotes} />);
  }

  if (assessmentName.includes('400') && assessmentName.includes('meter') && assessmentName.includes('walk')) {
    return wrapWithNotes(<FourHundredMeterWalkStandaloneWrapper assessment={assessment} client={selectedClient} clientAssessment={clientAssessment} onSave={onSave} onClose={onClose} clinicianNotes={clinicianNotes} />);
  }

  if (assessmentName.includes('6') && assessmentName.includes('minute') && assessmentName.includes('step')) {
    return wrapWithNotes(<SixMinuteStepTestStandaloneWrapper assessment={assessment} client={selectedClient} onClose={onClose} clinicianNotes={clinicianNotes} />);
  }

  if (assessmentName.toLowerCase().includes('functional independence measure') || (assessmentName.includes('fim') && assessmentName.includes('functional'))) {
    return wrapWithNotes(
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
        <div className="w-full max-w-2xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <FunctionalIndependenceMeasureFIMRunner 
            client={selectedClient} 
            assessment={assessment} 
            clientAssessment={clientAssessment} 
            clinicianNotes={clinicianNotes}
            onSave={(resultData) => {
              if (onSave) onSave(resultData);
              (onComplete || onClose)(resultData);
            }} 
            onClose={onClose} 
          />
        </div>
      </div>
    );
  }

  // Assessments handled by TestRunner (not TestRunnerExtras) â€” force them through TestRunner
  const testRunnerOnly = [
    'quickdash', 'quick dash',

    'mrc dyspnea',
    'ases', 'american shoulder', 'conley scale', 'perceived stress scale', 'pss-10',
    'constant', 'murley', 'lysholm', 'acl-rsi', 'acl return to sport', 'global rating of change',
    "st george's respiratory", 'sgrq', 'fabq', 'fear-avoidance beliefs', 'single leg hop',
    'drop vertical jump', 'clock drawing', 'tinetti', 'poma',
    'dass-21', 'dass21', 'dass 21', 'hospital anxiety and depression', 'hads', 'clinical frailty scale',
  ];
  // Precise GROC match â€” avoid matching "grocery"
  if (assessmentName.includes('global rating of change') || (assessmentName.includes('groc') && !assessmentName.includes('grocery'))) {
    return wrapWithNotes(
      <TestRunner
        client={selectedClient || { full_name: 'Unknown Client' }}
        assessment={assessment}
        clientAssessment={clientAssessment || { id: null, assessment_id: assessment.id, client_id: selectedClient?.id || null, status: 'pending' }}
        onClose={onClose}
        onComplete={(resultData) => {
          if (onSave) onSave(resultData);
          (onComplete || onClose)(resultData);
        }}
        isStandaloneMode={isStandaloneMode}
        clinicianNotes={clinicianNotes}
      />
    );
  }

  if (testRunnerOnly.some(keyword => assessmentName.toLowerCase().includes(keyword))) {
    return wrapWithNotes(
      <TestRunner
        client={selectedClient || { full_name: 'Unknown Client' }}
        assessment={assessment}
        clientAssessment={clientAssessment || { id: null, assessment_id: assessment.id, client_id: selectedClient?.id || null, status: 'pending' }}
        onClose={onClose}
        onComplete={(resultData) => {
          if (onSave) onSave(resultData);
          (onComplete || onClose)(resultData);
        }}
        isStandaloneMode={isStandaloneMode}
        clinicianNotes={clinicianNotes}
      />
    );
  }

  // Check if TestRunnerExtras handles this assessment
  if (canHandleAssessment(assessmentName)) {
    return wrapWithNotes(
      <TestRunnerExtras
        assessment={assessment}
        client={selectedClient}
        clientAssessment={clientAssessment}
        onClose={onClose}
        onComplete={(resultData) => {
          if (onSave) onSave(resultData);
          (onComplete || onClose)(resultData);
        }}
        isStandaloneMode={isStandaloneMode}
        clinicianNotes={clinicianNotes}
      />
    );
  }

  // Fallback to questionnaire runner
  if (assessment.is_questionnaire && assessment.questions && assessment.questions.length > 0) {
    return wrapWithNotes(
      <QuestionnaireRunner
        assessment={assessment}
        client={selectedClient}
        clientAssessment={clientAssessment}
        onSave={(resultData) => {
          if (onSave) onSave(resultData);
          (onComplete || onClose)(resultData);
        }}
        onClose={onClose}
        isStandaloneMode={isStandaloneMode}
        clinicianNotes={clinicianNotes}
      />
    );
  }

  // Default generic test runner
  return wrapWithNotes(
    <TestRunner
      client={selectedClient || { full_name: 'Unknown Client' }}
      assessment={assessment}
      clientAssessment={clientAssessment || {
        id: null,
        assessment_id: assessment.id,
        client_id: selectedClient?.id || null,
        status: 'pending'
      }}
      onClose={onClose}
      onComplete={(resultData) => {
        if (onSave) onSave(resultData);
        (onComplete || onClose)(resultData);
      }}
      isStandaloneMode={isStandaloneMode}
      clinicianNotes={clinicianNotes}
    />
  );
}