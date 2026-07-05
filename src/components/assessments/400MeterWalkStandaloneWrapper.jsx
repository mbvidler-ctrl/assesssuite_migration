import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import FourHundredMeterWalkTestRunner from "./400MeterWalkTestRunner";
import ClientSelectorModal from "./ClientSelectorModal";

export default function FourHundredMeterWalkStandaloneWrapper({ 
  assessment,
  client,
  clientAssessment,
  onSave,
  onClose 
}) {
  const [selectedClient, setSelectedClient] = useState(client || null);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(!client);

  useEffect(() => {
    if (!client) {
      const loadClients = async () => {
        try {
          const user = await base44.auth.me();
          const memberships = await base44.entities.OrganizationMember.filter({
            user_email: user.email
          });

          if (memberships && memberships.length > 0) {
            const orgId = memberships[0].org_id;
            const clientList = await base44.entities.Client.filter({
              org_id: orgId
            });
            setClients(clientList || []);
          }
        } catch (error) {
          console.error("Error loading clients:", error);
        } finally {
          setIsLoading(false);
        }
      };

      loadClients();
    }
  }, [client]);

  const handleSave = async (testData) => {
    if (!selectedClient) return;

    try {
      const now = new Date();
      const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      // Build objective text same way as TestRunnerExtras
      let objectiveText = `Assessment completed on ${dateStr}:\n\n`;
      
      if (testData.result_value !== null && testData.result_value !== undefined) {
        objectiveText += `• ${assessment.name}: ${testData.result_value}s\n`;
      }
      
      // Add additional data fields
      if (testData.additional_data && typeof testData.additional_data === 'object') {
        const skipKeys = ['measurement_type', 'soap_text', 'responses'];
        Object.entries(testData.additional_data).forEach(([key, value]) => {
          if (skipKeys.includes(key)) return;
          if (value === null || value === undefined || value === '') return;
          if (typeof value === 'object' && !Array.isArray(value)) {
            objectiveText += `\n  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:\n`;
            Object.entries(value).forEach(([subKey, subValue]) => {
              if (subValue === null || subValue === undefined || subValue === '') return;
              objectiveText += `    - ${subKey.replace(/_/g, ' ')}: ${subValue}\n`;
            });
          } else if (Array.isArray(value) && value.length > 0) {
            objectiveText += `  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${value.join(', ')}\n`;
          } else {
            objectiveText += `  ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${value}\n`;
          }
        });
      }
      
      if (testData.notes && testData.notes.trim()) {
        objectiveText += `\n  Clinical Notes: ${testData.notes}\n`;
      }

      // If an existing clientAssessment record exists, update it
      if (clientAssessment?.id) {
        await base44.entities.ClientAssessment.update(clientAssessment.id, {
          status: 'completed',
          result_value: testData.result_value,
          assessment_date: testData.assessment_date || new Date().toISOString().split('T')[0],
          notes: testData.notes,
          additional_data: testData.additional_data || {}
        });

        if (onSave) onSave(testData);
        onClose();
        return;
      }

      // Otherwise create a new record (standalone / library mode)
      let appointment = await base44.entities.Appointment.filter({
        client_id: selectedClient.id,
        start_time: { 
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
          $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
        }
      });

      let appointmentId = appointment?.[0]?.id;

      if (!appointmentId) {
        const newAppt = await base44.entities.Appointment.create({
          org_id: selectedClient.org_id,
          client_id: selectedClient.id,
          title: `${assessment.name} Assessment`,
          start_time: now.toISOString(),
          end_time: new Date(now.getTime() + 60 * 60000).toISOString(),
          status: 'completed'
        });
        appointmentId = newAppt.id;
      }

      await base44.entities.ClientAssessment.create({
        org_id: selectedClient.org_id,
        client_id: selectedClient.id,
        assessment_id: assessment.id,
        appointment_id: appointmentId,
        status: 'completed',
        result_value: testData.result_value,
        assessment_date: new Date().toISOString().split('T')[0],
        notes: testData.notes,
        additional_data: testData.additional_data || {}
      });

      if (onSave) onSave(testData);
      onClose();
    } catch (error) {
      console.error("Error saving assessment:", error);
    }
  };

  if (!selectedClient && isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!selectedClient) {
    return (
      <ClientSelectorModal
        isOpen={true}
        clients={clients}
        testName="400-Meter Walk Test"
        onSelect={setSelectedClient}
        onCancel={onClose}
      />
    );
  }

  return (
    <FourHundredMeterWalkTestRunner
      client={selectedClient}
      assessment={assessment}
      onSave={handleSave}
      onClose={onClose}
    />
  );
}