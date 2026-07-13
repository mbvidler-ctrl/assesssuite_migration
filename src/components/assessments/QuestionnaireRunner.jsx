import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { saveAssessmentToSOAP } from './TestRunnerSOAPHelper';
import { todayLocal } from "@/lib/localDate";

export default function QuestionnaireRunner({ assessment, onSave, onClose, initialResponses = {}, isStandaloneMode = false, client }) {
  const [responses, setResponses] = useState(initialResponses);
  // Selection is tracked by OPTION INDEX (unique per question), not by value:
  // instruments like VISA-A/P repeat point values across options (Q8's A/B/C
  // rows all contain 0), and value-keyed radios both highlighted every
  // same-valued option and attributed the wrong option label in the SOAP
  // record — a clinical-documentation defect even though the score was
  // correct. `responses` stays value-keyed (the persistence contract).
  const [selectedOptions, setSelectedOptions] = useState({});
  const [selectedClient, setSelectedClient] = useState(client);
  const [allClients, setAllClients] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isStandaloneMode && !client) {
      loadClients();
    }
  }, [isStandaloneMode, client]);

  const loadClients = async () => {
    try {
      const user = await base44.auth.me();
      const orgs = await base44.entities.OrganizationMember.filter({ user_email: user.email });
      if (orgs.length > 0) {
        const clients = await base44.entities.Client.filter({ org_id: orgs[0].org_id });
        setAllClients(clients);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  };

  const calculateTotalScore = () => {
    let total = 0;
    Object.values(responses).forEach(value => {
      total += parseFloat(value) || 0;
    });
    return total;
  };

  const getMaxPossibleScore = () => {
    let max = 0;
    assessment.questions.forEach(q => {
      if (q.options && q.options.length > 0) {
        max += Math.max(...q.options.map(o => o.value || 0));
      } else if (q.question_type === 'yes_no') {
        max += 1;
      }
    });
    return max;
  };

  const buildSoapText = (totalScore) => {
    const maxScore = getMaxPossibleScore();
    let soapText = `• ${assessment.name}: ${totalScore}/${maxScore}\n\n  Individual Question Responses:\n`;
    assessment.questions.forEach((q, i) => {
      const resp = responses[i];
      let label = resp;
      if (q.question_type === 'yes_no') label = resp === 1 ? 'Yes' : 'No';
      else if (q.options) {
        // Prefer the actually-selected option (index-tracked); fall back to
        // a value lookup only for externally-hydrated responses.
        const opt = selectedOptions[i] !== undefined
          ? q.options[selectedOptions[i]]
          : q.options.find(o => o.value === parseFloat(resp));
        label = opt ? opt.label : resp;
      }
      soapText += `  Q${i+1}. ${q.question_text}\n      Answer: ${label}\n`;
    });
    return soapText;
  };

  const handleSave = async () => {
    if (isStandaloneMode && !selectedClient) {
      toast.error("Please select a client to assign this assessment to.");
      return;
    }

    setIsSubmitting(true);
    try {
      const totalScore = calculateTotalScore();
      const assessmentDate = todayLocal();
      const soapText = buildSoapText(totalScore);

      const additionalData = {
        responses,
        measurement_type: 'questionnaire',
        soap_text: soapText
      };

      if (isStandaloneMode && selectedClient) {
        const updateData = {
          status: 'completed',
          result_value: totalScore,
          assessment_date: assessmentDate,
          additional_data: additionalData,
          notes: soapText
        };

        const created = await base44.entities.ClientAssessment.create({
          org_id: selectedClient.org_id,
          client_id: selectedClient.id,
          assessment_id: assessment.id,
          ...updateData
        });

        await saveAssessmentToSOAP({
          clientToUse: selectedClient,
          appointmentId: null,
          objectiveText: soapText,
          assessmentToUpdateId: created.id,
          updateData
        });

        toast.success("Assessment completed and saved to client!");
      }
      
      onSave({
        result_value: totalScore,
        additional_data: additionalData,
        assessment_date: assessmentDate,
        notes: soapText
      });
    } catch (error) {
      console.error("Error saving assessment:", error);
      toast.error("Failed to save assessment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allAnswered = assessment.questions.every((q, index) => 
    responses[index] !== undefined && responses[index] !== null
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 sticky top-0 bg-white z-10 border-b">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold">{assessment.name}</CardTitle>
            <p className="text-sm text-slate-600 mt-1">{assessment.description}</p>
            
            {isStandaloneMode && (
              <div className="mt-3">
                <Label className="text-sm text-slate-600 mb-1 block">Assign to Client</Label>
                <Select 
                  value={selectedClient?.id || ''} 
                  onValueChange={(value) => {
                    const client = allClients.find(c => c.id === value);
                    setSelectedClient(client);
                  }}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Select a client to assign this test">
                      {selectedClient ? (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {selectedClient.full_name}
                        </div>
                      ) : (
                        <span className="text-slate-400">Select a client</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allClients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Instructions */}
          {assessment.instructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">{assessment.instructions}</p>
            </div>
          )}

          {/* Questions */}
          {assessment.questions.map((question, index) => (
            <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <Label className="text-base font-medium mb-3 block">
                {index + 1}. {question.question_text}
              </Label>

              {question.question_type === 'yes_no' ? (
                <RadioGroup
                  value={responses[index]?.toString()}
                  onValueChange={(value) => setResponses({...responses, [index]: parseFloat(value)})}
                >
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="1" id={`q${index}-yes`} />
                      <Label htmlFor={`q${index}-yes`} className="cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="0" id={`q${index}-no`} />
                      <Label htmlFor={`q${index}-no`} className="cursor-pointer">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              ) : question.options && question.options.length > 0 ? (
                <RadioGroup
                  value={selectedOptions[index]?.toString()}
                  onValueChange={(value) => {
                    const optIdx = parseInt(value, 10);
                    setSelectedOptions({ ...selectedOptions, [index]: optIdx });
                    setResponses({ ...responses, [index]: question.options[optIdx]?.value ?? 0 });
                  }}
                >
                  <div className="space-y-2">
                    {question.options.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-center space-x-2">
                        <RadioGroupItem value={optIndex.toString()} id={`q${index}-opt${optIndex}`} />
                        <Label htmlFor={`q${index}-opt${optIndex}`} className="cursor-pointer flex-1">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              ) : null}
            </div>
          ))}

          {/* Score Display */}
          {Object.keys(responses).length > 0 && (
            <div className="bg-slate-100 p-4 rounded-lg sticky bottom-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Current Score</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {calculateTotalScore()} / {getMaxPossibleScore()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Progress</p>
                  <p className="text-lg font-semibold">
                    {Object.keys(responses).length} / {assessment.questions.length} answered
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!allAnswered || isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : null}
              Save Questionnaire
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}