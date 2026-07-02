import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Users } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const activities = [
  "Walk around the house",
  "Walk up or down stairs",
  "Bend over and pick up a slipper",
  "Reach for small can at eye level",
  "Stand on tiptoes and reach",
  "Stand on chair and reach",
  "Sweep the floor",
  "Walk to car in driveway",
  "Get into or out of car",
  "Walk across parking lot",
  "Walk up or down ramp",
  "Walk in crowded mall",
  "Bumped into by people",
  "Step onto escalator (with railing)",
  "Step onto escalator (with parcels)",
  "Walk on icy sidewalks"
];

export default function ActivitiesspecificBalanceConfidenceABCScaleRunner({ client, onSave, onClose, isStandaloneMode }) {
  const [responses, setResponses] = useState(Array(16).fill(""));
  const [notes, setNotes] = useState("");
  const [selectedClient, setSelectedClient] = useState(client);
  const [allClients, setAllClients] = useState([]);

  useEffect(() => {
    if (!client) {
      base44.auth.me().then(user =>
        base44.entities.OrganizationMember.filter({ user_email: user.email }).then(orgs => {
          if (orgs.length > 0) {
            base44.entities.Client.filter({ org_id: orgs[0].org_id }).then(setAllClients);
          }
        })
      ).catch(() => {});
    }
  }, [client]);

  const handleResponseChange = (index, value) => {
    const newResponses = [...responses];
    newResponses[index] = value;
    setResponses(newResponses);
  };

  const handleSave = () => {
    if (!selectedClient && !client) {
      toast.error("Please select a client.");
      return;
    }
    const invalid = responses.some((r) => r === "" || isNaN(r) || r < 0 || r > 100);
    if (invalid) {
      toast.error("Please provide valid responses (0-100%) for all activities.");
      return;
    }

    const totalScore = responses.reduce((acc, curr) => acc + parseFloat(curr), 0);
    const resultValue = parseFloat((totalScore / activities.length).toFixed(1));

    const interpretation = resultValue < 50 
      ? 'Low functioning' 
      : resultValue < 67 
      ? 'Low balance confidence and fall risk' 
      : 'Good balance confidence';

    const soap_text = `â€¢ Activities-specific Balance Confidence (ABC) Scale:\n  Average Score: ${resultValue}%\n  Interpretation: ${interpretation}\n  Individual Activity Scores:\n${activities.map((activity, i) => `    ${i + 1}. ${activity}: ${responses[i]}%`).join('\n')}\n${notes ? `\n  Clinical Notes: ${notes}` : ''}`;

    onSave({
      result_value: resultValue,
      additional_data: {
        soap_text,
        activities_responses: responses.map(r => parseFloat(r)),
        total_score: totalScore,
        interpretation,
        measurement_type: 'abc_scale'
      },
      notes,
      assessment_date: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Activities-specific Balance Confidence (ABC) Scale</CardTitle>
            {!client && (
              <div className="mt-2">
                <Label className="text-sm text-slate-600 mb-1 block">Assign to Client</Label>
                <Select
                  value={selectedClient?.id || ''}
                  onValueChange={(value) => setSelectedClient(allClients.find(c => c.id === value))}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Select a client">
                      {selectedClient ? (
                        <div className="flex items-center gap-2"><Users className="w-4 h-4" />{selectedClient.full_name}</div>
                      ) : (
                        <span className="text-slate-400">Select a client</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allClients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Instructions:</strong> For each of the following activities, please indicate your level of confidence in doing the activity without losing your balance or becoming unsteady from choosing a number from 0% to 100%.
              </p>
              <p className="text-xs text-blue-700 mt-2">
                0% = No Confidence | 50% = Moderate Confidence | 100% = Completely Confident
              </p>
            </div>
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Label className="flex-1 text-sm font-medium">{index + 1}. {activity}</Label>
                  <Input
                    type="number"
                    value={responses[index]}
                    onChange={(e) => handleResponseChange(index, e.target.value)}
                    className="w-24"
                    min="0"
                    max="100"
                    step="10"
                    placeholder="0-100"
                  />
                  <span className="text-sm font-medium text-slate-600">%</span>
                </div>
              ))}
            </div>

            {responses.some(r => r !== "") && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
                <h4 className="font-semibold text-green-900 mb-2">Current Average Score</h4>
                <p className="text-3xl font-bold text-green-600">
                  {(responses.reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0) / activities.length).toFixed(1)}%
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {(() => {
                    const avg = responses.reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0) / activities.length;
                    if (avg < 50) return 'Low functioning';
                    if (avg < 67) return 'Low balance confidence and fall risk';
                    return 'Good balance confidence';
                  })()}
                </p>
              </div>
            )}

            <div className="mt-6">
              <Label>Clinical Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any additional clinical observations..."
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={onClose}>
            <X />
            Close
          </Button>
          <Button onClick={handleSave}>
            <Save />
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}