import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft } from "lucide-react";

export default function ClientGoals({ data, onNext, onBack, canGoBack, onSaveAndFinishLater }) {
  const [formData, setFormData] = useState({
    client_goals: data.client_goals || ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="client_goals" className="text-sm font-medium text-slate-700">
          Client's Goals
        </Label>
        <p className="text-sm text-slate-500 mt-1 mb-3">
          What would the client like to achieve through these sessions? Please use the SMART goal framework if possible (Specific, Measurable, Achievable, Relevant, Time-bound).
        </p>
        <Textarea
          id="client_goals"
          value={formData.client_goals}
          onChange={(e) => handleChange("client_goals", e.target.value)}
          placeholder="e.g., 'To be able to walk 1km without stopping within 6 weeks to improve cardiovascular health.' or 'Reduce lower back pain from 7/10 to 3/10 during daily activities over the next month.'"
          className="mt-1 min-h-32"
          rows={6}
        />
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-slate-900 mb-2">Examples of Goals:</h4>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• Return to playing social tennis twice a week.</li>
          <li>• Lift my grandchild without shoulder pain.</li>
          <li>• Improve balance to reduce risk of falls.</li>
          <li>• Complete a 5k fun run.</li>
        </ul>
      </div>

      <div className="flex justify-between pt-6">
        <div className="flex gap-2">
          {canGoBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {onSaveAndFinishLater && (
            <Button type="button" variant="outline" onClick={() => onSaveAndFinishLater(formData)} className="text-slate-600">
              Save & Finish Later
            </Button>
          )}
        </div>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}