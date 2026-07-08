import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { FileText, Edit2, Check, X } from "lucide-react";

export default function ReviewExport({ reportHtml, client, clinician, onEditHtml }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editableHtml, setEditableHtml] = useState(reportHtml);

  const handleSaveEdit = () => {
    onEditHtml(editableHtml);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditableHtml(reportHtml);
    setIsEditing(false);
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Review & Edit Report</h3>
        </div>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="w-4 h-4 mr-1" /> Edit Report
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white">
              <Check className="w-4 h-4 mr-1" /> Apply Changes
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Edit the report below. Tweak wording, remove sections, or add custom content.</p>
          <RichTextEditor
            value={editableHtml}
            onChange={setEditableHtml}
            className="max-h-[60vh] overflow-y-auto"
          />
        </div>
      ) : (
        <Card className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: reportHtml }} />
        </Card>
      )}

      <p className="text-sm text-slate-500">
        Click <strong>Edit Report</strong> to make changes before saving or printing.
      </p>
    </div>
  );
}