import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

export default function ImportToSOAPModal({ isOpen, onClose, protocolData, conditionName }) {
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
      const userData = await base44.auth.me();
      
      // Get user's organization
      const orgMemberships = await base44.entities.OrganizationMember.filter({ user_email: userData.email });
      const userOrgId = orgMemberships.length > 0 ? orgMemberships[0].org_id : null;

      if (!userOrgId) {
        console.warn("User has no organization membership");
        setClients([]);
        setIsLoading(false);
        return;
      }

      // Load clients from user's organization only
      const allClients = await base44.entities.Client.filter({ org_id: userOrgId });
      setClients(allClients.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setIsLoading(false);
    }
  };

  const generatePlanText = () => {
    let planText = `TREATMENT PROTOCOL: ${conditionName}\n\n`;

    if (protocolData.exercise_prescription) {
      planText += `EXERCISE PRESCRIPTION:\n`;
      
      if (protocolData.exercise_prescription.exercises) {
        protocolData.exercise_prescription.exercises.forEach((ex, i) => {
          planText += `\n${i + 1}. ${ex.name} (${ex.type})\n`;
          planText += `   Dosage: ${ex.dosage}\n`;
          planText += `   Purpose: ${ex.purpose}\n`;
          if (ex.modifications) {
            planText += `   Modifications: ${ex.modifications}\n`;
          }
        });
      }

      planText += `\n`;
      if (protocolData.exercise_prescription.frequency) {
        planText += `Frequency: ${protocolData.exercise_prescription.frequency}\n`;
      }
      if (protocolData.exercise_prescription.session_duration) {
        planText += `Session Duration: ${protocolData.exercise_prescription.session_duration}\n`;
      }
      if (protocolData.exercise_prescription.program_duration) {
        planText += `Program Duration: ${protocolData.exercise_prescription.program_duration}\n`;
      }
    }

    if (protocolData.progression?.phases?.[0]) {
      const firstPhase = protocolData.progression.phases[0];
      planText += `\nCURRENT PHASE: ${firstPhase.phase_name}\n`;
      planText += `Goals: ${firstPhase.goals}\n`;
      planText += `Duration: ${firstPhase.duration}\n`;
    }

    return planText;
  };

  const handleSelectClient = async (client) => {
    try {
      const planText = generatePlanText();
      const today = new Date();
      const todayDateStr = today.toISOString().split('T')[0];
      
      // Check if there's a SOAP note for today
      const allClientNotes = await base44.entities.SOAPNote.filter({ client_id: client.id });
      const todayNote = allClientNotes.find(note => {
        const noteDate = new Date(note.note_date).toISOString().split('T')[0];
        return noteDate === todayDateStr;
      });

      if (todayNote) {
        // Append to existing plan
        const updatedPlan = todayNote.plan ? `${todayNote.plan}\n\n${planText}` : planText;
        await base44.entities.SOAPNote.update(todayNote.id, { plan: updatedPlan });
        toast.success(`Protocol added to ${client.full_name}'s notes for today`);
      } else {
        // Create new SOAP note for today
        await base44.entities.SOAPNote.create({
          org_id: client.org_id,
          client_id: client.id,
          note_date: today.toISOString(),
          plan: planText,
          status: 'draft',
          subjective: '',
          objective: '',
          assessment: '',
          other: ''
        });
        toast.success(`Protocol added to ${client.full_name}'s notes for today`);
      }

      onClose();
    } catch (error) {
      console.error("Error adding protocol to client:", error);
      toast.error("Failed to add protocol to client notes");
    }
  };

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
                  <p className="font-medium text-slate-900">{client.full_name}</p>
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