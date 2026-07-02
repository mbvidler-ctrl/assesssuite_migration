import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, XCircle, Save } from "lucide-react";
import { toast } from "sonner";

export default function EditQualityChecksModal({ assessment, onClose, onSaved }) {
  const [qualityChecks, setQualityChecks] = useState({
    has_test_runner: assessment.has_test_runner || false,
    results_add_to_soap: assessment.results_add_to_soap || false,
    has_normatives: assessment.has_normatives || false,
    has_instructions: assessment.has_instructions || false,
    has_references: assessment.has_references || false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckboxChange = (field, value) => {
    setQualityChecks(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await base44.entities.Assessment.update(assessment.id, qualityChecks);
      toast.success("Quality checks updated successfully!");
      onSaved();
    } catch (error) {
      console.error("Failed to update quality checks:", error);
      toast.error("Failed to update quality checks. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkItems = [
    { field: 'has_test_runner', label: 'Has a test runner' },
    { field: 'results_add_to_soap', label: 'Results add correctly to SOAP notes' },
    { field: 'has_normatives', label: 'Results have normatives' },
    { field: 'has_instructions', label: 'Has instructions to clinician' },
    { field: 'has_references', label: 'Has references' },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Edit Quality Checks</DialogTitle>
          <p className="text-sm text-slate-600 mt-1">
            {assessment.name}
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {checkItems.map(item => (
              <div key={item.field} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                <Checkbox 
                  id={item.field}
                  checked={qualityChecks[item.field]}
                  onCheckedChange={(checked) => handleCheckboxChange(item.field, checked)}
                />
                <Label 
                  htmlFor={item.field} 
                  className="flex-1 cursor-pointer flex items-center gap-2"
                >
                  {qualityChecks[item.field] ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  {item.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}