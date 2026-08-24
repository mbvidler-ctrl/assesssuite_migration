import React, { useState, useEffect, useRef } from "react";
import SixMeterWalkStandaloneWrapper from "./SixMeterWalkStandaloneWrapper";
import EightFootUpandGoStandaloneWrapper from "./8FootUpandGoStandaloneWrapper";
import FourHundredMeterWalkStandaloneWrapper from "./400MeterWalkStandaloneWrapper";
import SixMinuteStepTestStandaloneWrapper from "./SixMinuteStepTestStandaloneWrapper";
import TestRunner from "./TestRunner";
import QuestionnaireRunner from "./QuestionnaireRunner";
import TestRunnerExtras from "./TestRunnerExtras";
import { resolveRegisteredAssessmentRoute } from "./assessmentRunnerRegistry";
import FunctionalIndependenceMeasureFIMRunner from "./FunctionalIndependenceMeasureFIMRunner";
import StructuredAssessmentRunner from './StructuredAssessmentRunner';
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
      } catch (e) {
        // Malformed optional test-runner data is ignored by the fallback router.
      }
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
// - Assessment Library (true standalone): NO client prop, isStandaloneMode={true} → shows selector
// - SOAP Notes, Client Profile, etc (already have client): PASS client prop, isStandaloneMode={false} → goes straight to runner
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
  const [compactNotesViewport] = useState(() => window.innerWidth < 768);
  const [showNotes, setShowNotes] = useState(() => window.innerWidth >= 768);
  const [pos, setPos] = useState({ x: window.innerWidth - 296, y: 80 });
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

  // Floating notes panel — sits above the runner modal overlay
  const notesSidebar = showNotes ? (
    <div
      className="fixed z-[10000] flex flex-col bg-white border border-slate-200 rounded-xl shadow-2xl"
      style={compactNotesViewport
        ? { inset: 'auto 12px 12px 12px', maxHeight: '70vh' }
        : { top: pos.y, left: pos.x, width: '280px', maxHeight: 'calc(100vh - 100px)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-slate-200 rounded-t-xl bg-slate-50 select-none md:cursor-grab md:active:cursor-grabbing"
        onMouseDown={compactNotesViewport ? undefined : handleDragStart}
      >
        <span className="text-sm font-semibold text-slate-700">📝 Clinician Notes</span>
        <button
          type="button"
          onClick={() => setShowNotes(false)}
          aria-label="Close clinician notes"
          className="flex h-11 w-11 items-center justify-center text-lg leading-none text-slate-400 hover:text-slate-600 md:h-auto md:w-auto"
        >
          ✕
        </button>
      </div>
      <textarea
        className="flex-1 w-full p-4 text-sm text-slate-700 bg-white border-none resize-none focus:outline-none focus:ring-0 placeholder-slate-400"
        placeholder={"Jot notes as you assess...\n\nThese will be appended to the SOAP note on save."}
        value={clinicianNotes}
        onChange={(e) => setClinicianNotes(e.target.value)}
        style={compactNotesViewport
          ? { minHeight: '180px', maxHeight: 'calc(70vh - 100px)' }
          : { minHeight: '260px', maxHeight: 'calc(100vh - 220px)' }}
      />
      <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-200 rounded-b-xl bg-slate-50">
        Notes auto-append to SOAP on save
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setShowNotes(true)}
      className="fixed right-0 top-1/2 z-[10000] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-slate-200 bg-white shadow-lg transition-colors hover:bg-slate-50 md:right-auto md:h-auto md:w-auto md:translate-y-0 md:flex-col md:px-2 md:py-3"
      style={compactNotesViewport ? undefined : { top: pos.y, left: pos.x }}
      title="Open clinician notes"
      aria-label="Open clinician notes"
    >
      <span className="text-base">📝</span>
      <span className="hidden text-xs text-slate-500 md:block md:[text-orientation:mixed] md:[writing-mode:vertical-rl]">Notes</span>
    </button>
  );

  const wrapWithNotes = (runner) => (
    <>
      {runner}
      {notesSidebar}
    </>
  );

  const registeredRoute = resolveRegisteredAssessmentRoute(assessment);
  if (!registeredRoute) {
    return wrapWithNotes(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Assessment route not registered</h2>
          <p className="text-sm text-slate-600">
            {assessment?.name || 'This assessment'} has no canonical runner route. It cannot be opened until its canonical ID is registered.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  const complete = (resultData) => {
    if (onSave) onSave(resultData);
    (onComplete || onClose)(resultData);
  };

  switch (registeredRoute.host) {
    case 'questionnaire':
      return wrapWithNotes(
        <QuestionnaireRunner
          assessment={assessment}
          client={selectedClient}
          clientAssessment={clientAssessment}
          onSave={complete}
          onClose={onClose}
          isStandaloneMode={isStandaloneMode}
          clinicianNotes={clinicianNotes}
          scoringKey={registeredRoute.scoringKey}
        />
      );
    case 'structured':
      return wrapWithNotes(
        <StructuredAssessmentRunner
          assessment={assessment}
          client={selectedClient}
          clientAssessment={clientAssessment}
          onSave={complete}
          onClose={onClose}
          isStandaloneMode={isStandaloneMode}
          clinicianNotes={clinicianNotes}
          scoringKey={registeredRoute.scoringKey}
        />
      );
    case 'extras':
      return wrapWithNotes(
        <TestRunnerExtras
          assessment={assessment}
          client={selectedClient}
          clientAssessment={clientAssessment}
          onClose={onClose}
          onComplete={complete}
          isStandaloneMode={isStandaloneMode}
          clinicianNotes={clinicianNotes}
          runnerKey={registeredRoute.runnerKey}
        />
      );
    case 'test-runner':
      return wrapWithNotes(
        <TestRunner
          client={selectedClient || { full_name: 'Unknown Client' }}
          assessment={assessment}
          clientAssessment={clientAssessment || {
            id: null,
            assessment_id: assessment.id,
            client_id: selectedClient?.id || null,
            status: 'pending',
          }}
          onClose={onClose}
          onComplete={complete}
          isStandaloneMode={isStandaloneMode}
          clinicianNotes={clinicianNotes}
          runnerKey={registeredRoute.runnerKey}
        />
      );
    case 'standalone-6-meter-walk':
      return wrapWithNotes(<SixMeterWalkStandaloneWrapper assessment={assessment} client={selectedClient} clientAssessment={clientAssessment} onSave={complete} onClose={onClose} clinicianNotes={clinicianNotes} />);
    case 'standalone-8-foot-up-go':
      return wrapWithNotes(<EightFootUpandGoStandaloneWrapper assessment={assessment} client={selectedClient} clientAssessment={clientAssessment} onSave={complete} onClose={onClose} clinicianNotes={clinicianNotes} />);
    case 'standalone-400-meter-walk':
      return wrapWithNotes(<FourHundredMeterWalkStandaloneWrapper assessment={assessment} client={selectedClient} clientAssessment={clientAssessment} onSave={complete} onClose={onClose} clinicianNotes={clinicianNotes} />);
    case 'standalone-6-minute-step':
      return wrapWithNotes(<SixMinuteStepTestStandaloneWrapper assessment={assessment} client={selectedClient} clientAssessment={clientAssessment} onSave={complete} onClose={onClose} clinicianNotes={clinicianNotes} />);
    case 'fim':
      return wrapWithNotes(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
          <div className="w-full max-w-2xl max-h-[90vh]" onClick={(event) => event.stopPropagation()}>
            <FunctionalIndependenceMeasureFIMRunner
              client={selectedClient}
              assessment={assessment}
              clientAssessment={clientAssessment}
              onSave={complete}
              onClose={onClose}
            />
          </div>
        </div>
      );
    default:
      return wrapWithNotes(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Invalid canonical runner host</h2>
            <p className="text-sm text-slate-600">The registered host “{registeredRoute.host}” is not implemented.</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      );
  }
}
