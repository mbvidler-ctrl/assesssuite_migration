
import React, { useState } from "react";
import { ClientCondition } from "@/entities/ClientCondition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Stethoscope, Plus, Edit, Trash2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import EditConditionModal from "./EditConditionModal"; // Renamed from AddConditionModal

export default function ClientConditions({
  conditions,
  clientId,
  onConditionsUpdated,
  selectedCondition, // This prop is no longer directly used internally but kept in signature
  setSelectedCondition, // This prop is no longer directly used internally but kept in signature
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conditionToDelete, setConditionToDelete] = useState(null);
  const [editingCondition, setEditingCondition] = useState(null); // New state for the condition being edited or added

  const handleEdit = (condition) => {
    setEditingCondition(condition); // Set the condition to be edited
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingCondition(null); // Clear editingCondition for adding a new one
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!conditionToDelete) return;

    setIsDeleting(true);
    try {
      await ClientCondition.delete(conditionToDelete.id);
      toast.success("Condition deleted successfully");
      setConditionToDelete(null);
      onConditionsUpdated();
    } catch (error) {
      console.error("Failed to delete condition:", error);
      toast.error("Failed to delete condition");
    }
    setIsDeleting(false);
  };

  return (
    <>
      <Toaster richColors position="top-center" />
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-blue-600" />
              Medical Conditions
            </CardTitle>
            {/* Changed from Link to Button and onClick */}
            <Button size="sm" variant="outline" onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Condition
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {conditions && conditions.length > 0 ? (
            <div className="space-y-3">
              {conditions.map((condition) => (
                <div
                  key={condition.id}
                  className="p-3 bg-slate-50 rounded-lg flex justify-between items-start"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {condition.condition_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={
                          condition.condition_type === "primary"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          condition.condition_type === "primary"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {condition.condition_type}
                      </Badge>
                      {condition.diagnosis_date && (
                        <Badge variant="outline">
                          Dx: {condition.diagnosis_date}
                        </Badge>
                      )}
                      {/* Added Medication Badge */}
                      {condition.medication && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700">
                          Med: {condition.medication}
                        </Badge>
                      )}
                    </div>
                    {condition.notes && (
                      <p className="text-xs text-slate-600 mt-2">
                        {condition.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => handleEdit(condition)}
                    >
                      <Edit className="w-4 h-4 text-slate-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => setConditionToDelete(condition)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No conditions recorded.</p>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <EditConditionModal // Using the refactored/renamed modal component
          clientId={clientId}
          condition={editingCondition} // Pass the condition to be edited (or null for add)
          onClose={() => {
            setIsModalOpen(false);
            setEditingCondition(null); // Clear editing state on close
          }}
          onSuccess={() => { // Renamed prop from onConditionAdded
            setIsModalOpen(false);
            setEditingCondition(null); // Clear editing state on success
            onConditionsUpdated();
            toast.success(
              editingCondition // Check editingCondition to determine if it was an update or add
                ? "Condition updated successfully"
                : "New condition added successfully"
            );
          }}
        />
      )}

      <Dialog open={!!conditionToDelete} onOpenChange={setConditionToDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Are you sure you want to delete the condition "
            <span className="font-semibold">
              {conditionToDelete?.condition_name}
            </span>
            "? This action cannot be undone.
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConditionToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            {/* Added variant="destructive" to the delete button */}
            <Button onClick={handleDelete} disabled={isDeleting} variant="destructive">
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}