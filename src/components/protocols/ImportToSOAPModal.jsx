import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { todayLocal } from "@/lib/localDate";
import {
  clientPickerDisplayName,
  filterClientPickerRows,
  loadAccessibleClientPickerRows,
} from "@/lib/protocolClientPicker";
import {
  BLOCKED_BY_PUBLISHED_MESSAGE,
  PROTOCOL_PROVENANCE,
  buildProtocolPlanText,
  selectProtocolImportTarget,
} from "@/lib/clinical/protocolImport";
import { aiProvenanceEntry, appendAiProvenance } from "@/lib/clinical/aiProvenance";

// `provenance` deliberately DEFAULTS TO AI: a missing or unrecognised prop
// must fail towards over-disclosure, never towards presenting an AI draft as
// reviewed content.
export default function ImportToSOAPModal({ isOpen, onClose, protocolData, conditionName, provenance, droppedPaths }) {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      // The server scopes Client.list() to every current membership and legal
      // acceptance held by this session. Narrowing here to memberships[0]
      // hid valid clients for multi-practice users and made ordering depend on
      // an arbitrary API row. The shared helper also tolerates retained legacy
      // clients whose full_name is absent instead of crashing the whole modal.
      setClients(await loadAccessibleClientPickerRows(base44.entities.Client));
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectClient = async (client) => {
    try {
      const resolvedProvenance = provenance === PROTOCOL_PROVENANCE.REVIEWED
        ? PROTOCOL_PROVENANCE.REVIEWED
        : PROTOCOL_PROVENANCE.AI;
      const dateLabel = format(new Date(), 'dd/MM/yyyy');
      // The shared builder carries the provenance block, the contraindications
      // and the references into the note. The old inline generator dropped all
      // three, so what reached the clinical record was not what the clinician
      // reviewed on screen.
      const planText = buildProtocolPlanText(protocolData, {
        conditionName,
        provenance: resolvedProvenance,
        dateLabel,
        // Carry the normaliser's dropped paths so the note states the same
        // thing the screen does — dropped contraindications are never written
        // as "none were supplied".
        droppedPaths,
      });
      const todayDateStr = todayLocal();

      // note_date may be a full timestamp, so it is compared on the LOCAL
      // calendar day — a UTC comparison shifts morning notes to yesterday.
      // A published note is a finalised record and is never appended to; the
      // server refuses that write outright.
      const allClientNotes = await base44.entities.SOAPNote.filter({ client_id: client.id });
      const target = selectProtocolImportTarget(allClientNotes, { todayDateStr });
      const provenanceEntry = resolvedProvenance === PROTOCOL_PROVENANCE.AI
        ? aiProvenanceEntry({
            source: 'treatment-protocol-import',
            fields: ['plan'],
            dateLabel,
            subject: typeof conditionName === 'string' ? conditionName : null,
          })
        : null;

      if (target.mode === 'append') {
        const todayNote = target.note;
        const updatedPlan = todayNote.plan ? `${todayNote.plan}\n\n${planText}` : planText;
        const payload = { plan: updatedPlan };
        if (provenanceEntry) {
          payload.ai_provenance = appendAiProvenance(todayNote.ai_provenance, provenanceEntry);
        }
        await base44.entities.SOAPNote.update(todayNote.id, payload);
        toast.success(`Protocol added to ${clientPickerDisplayName(client)}'s notes for today`);
      } else {
        const payload = {
          org_id: client.org_id,
          client_id: client.id,
          note_date: todayDateStr,
          plan: planText,
          status: 'draft',
          subjective: '',
          objective: '',
          assessment: '',
          other: ''
        };
        if (provenanceEntry) {
          payload.ai_provenance = appendAiProvenance(null, provenanceEntry);
        }
        await base44.entities.SOAPNote.create(payload);
        toast.success(
          target.blockedByPublished
            ? BLOCKED_BY_PUBLISHED_MESSAGE
            : `Protocol added to ${clientPickerDisplayName(client)}'s notes for today`,
        );
      }

      onClose();
    } catch (error) {
      console.error("Error adding protocol to client:", error);
      toast.error("Failed to add protocol to client notes");
    }
  };

  const filteredClients = filterClientPickerRows(clients, searchTerm);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Import Protocol to Client Plan
          </DialogTitle>
          <p className="text-sm text-slate-600 mt-2">
            Select a client to add this {conditionName} protocol to their SOAP note plan
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className="w-full p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-all"
                >
                  <p className="font-medium text-slate-900">{clientPickerDisplayName(client)}</p>
                  <p className="text-sm text-slate-600">{client.email || 'No email'}</p>
                </button>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500">No clients found</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
