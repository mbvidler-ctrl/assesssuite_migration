import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import SixMinuteStepTestRunner from "./SixMinuteStepTestRunner";
import ClientSelectorModal from "./ClientSelectorModal";
import { generateSOAPForSpecialMeasurements } from "./SOAPObjectiveGenerator";

// Wrapper to handle standalone 6-Minute Step Test from assessment library
// If called with client prop, skips ClientSelectorModal and goes straight to test runner
// Only shows ClientSelectorModal when client is null (true standalone mode)
export default function SixMinuteStepTestStandaloneWrapper({ assessment, client, clientAssessment, onSave, onClose, clinicianNotes }) {
  const [selectedClient, setSelectedClient] = useState(client || null);
  const [allClients, setAllClients] = useState([]);
  const [showClientSelector, setShowClientSelector] = useState(!client);

  React.useEffect(() => {
    const loadClients = async () => {
      try {
        const user = await base44.auth.me();
        const orgMemberships = await base44.entities.OrganizationMember.filter({ user_email: user.email });
        const userOrgId = orgMemberships.length > 0 ? orgMemberships[0].org_id : null;
        
        if (userOrgId) {
          const clients = await base44.entities.Client.filter({ org_id: userOrgId });
          setAllClients(clients);
        }
      } catch (error) {
        console.error("Error loading clients:", error);
      }
    };
    loadClients();
  }, []);

  const handleSaveTest = async (data) => {
    if (!selectedClient) {
      toast.error("Please select a client first");
      return;
    }

    try {
      const now = new Date();

      // Update the launched pending record when one exists — creating a new
      // record here left the pending assessment stuck at "pending" and
      // produced a duplicate completed row.
      let appointmentId = clientAssessment?.appointment_id;

      if (!appointmentId) {
        // Find or create appointment for today
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

        let existingAppts = await base44.entities.Appointment.filter({
          client_id: selectedClient.id,
          start_time: { $gte: todayStart, $lt: tomorrowStart }
        });

        appointmentId = existingAppts?.[0]?.id;

        if (!appointmentId) {
          const newAppt = await base44.entities.Appointment.create({
            org_id: selectedClient.org_id,
            client_id: selectedClient.id,
            title: `${assessment.name}`,
            start_time: now.toISOString(),
            end_time: new Date(now.getTime() + 60 * 60000).toISOString(),
            status: 'completed'
          });
          appointmentId = newAppt.id;
        }
      }

      const recordData = {
        status: 'completed',
        result_value: data.result_value,
        assessment_date: data.assessment_date,
        notes: data.notes,
        additional_data: data.additional_data
      };

      if (clientAssessment?.id) {
        await base44.entities.ClientAssessment.update(clientAssessment.id, { ...recordData, appointment_id: appointmentId });
      } else {
        await base44.entities.ClientAssessment.create({
          org_id: selectedClient.org_id,
          client_id: selectedClient.id,
          assessment_id: assessment.id,
          appointment_id: appointmentId,
          ...recordData
        });
      }

      // Generate SOAP note entry
      let objectiveText = `• ${assessment.name}:\n  Steps completed: ${data.result_value}\n  Step height: ${data.additional_data.step_height} cm\n  Age: ${data.additional_data.age}, Gender: ${data.additional_data.gender}\n${data.notes ? `\n  Notes: ${data.notes}` : ''}`;
      if (clinicianNotes && clinicianNotes.trim()) {
        objectiveText += `\n\nClinician Notes (recorded during assessment):\n${clinicianNotes.trim()}`;
      }

      // Find or create SOAP note for appointment
      let existingSoapNotes = await base44.entities.SOAPNote.filter({
        client_id: selectedClient.id,
        appointment_id: appointmentId
      });

      if (existingSoapNotes && existingSoapNotes.length > 0) {
        const soapNote = existingSoapNotes[0];
        const updatedObjective = soapNote.objective 
          ? `${soapNote.objective}\n\n${objectiveText}`
          : objectiveText;
        
        await base44.entities.SOAPNote.update(soapNote.id, {
          objective: updatedObjective
        });
      } else {
        await base44.entities.SOAPNote.create({
          org_id: selectedClient.org_id,
          client_id: selectedClient.id,
          appointment_id: appointmentId,
          note_date: now.toISOString(),
          objective: objectiveText,
          status: 'draft'
        });
      }

      toast.success("6-Minute Step Test saved successfully!");
      if (onSave) onSave(data);
      onClose();
    } catch (error) {
      console.error("Error saving assessment:", error);
      toast.error("Failed to save assessment");
    }
  };

  if (!showClientSelector && selectedClient) {
    return (
      <SixMinuteStepTestRunner
        client={selectedClient}
        onSave={handleSaveTest}
        onClose={onClose}
      />
    );
  }

  return (
    <ClientSelectorModal
      isOpen={showClientSelector}
      clients={allClients}
      testName="6-Minute Step Test"
      onSelect={(client) => {
        setSelectedClient(client);
        setShowClientSelector(false);
      }}
      onCancel={onClose}
    />
  );
}