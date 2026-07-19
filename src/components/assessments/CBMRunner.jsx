import React, { useState, useRef } from "react";
import { todayLocal } from "@/lib/localDate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Info, Upload, FileText, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { uploadTenantFile } from "@/lib/fileIntegrations";

const CBM_ITEMS = [
  { id: 1, name: "Unilateral Stance", max: 5 },
  { id: 2, name: "Tandem Walk", max: 5 },
  { id: 3, name: "180° Turn", max: 5 },
  { id: 4, name: "Step Up and Over", max: 5 },
  { id: 5, name: "Forward to Backward Walking", max: 5 },
  { id: 6, name: "Crouch and Walk", max: 5 },
  { id: 7, name: "Lateral Foot Scoots", max: 5 },
  { id: 8, name: "Hopping Forward", max: 5 },
  { id: 9, name: "Running with Controlled Stop", max: 5 },
  { id: 10, name: "Forward Lunge", max: 5 },
  { id: 11, name: "Lateral Dodging", max: 5 },
  { id: 12, name: "Stairs Ascent", max: 5 },
  { id: 13, name: "Walking and Looking", max: 6 }
];

export default function CBMRunner({ client, onSave, onClose }) {
  const [scores, setScores] = useState({});
  const [assistiveDevice, setAssistiveDevice] = useState("none");
  const [assistanceNeeded, setAssistanceNeeded] = useState("no");
  const [tasksOmitted, setTasksOmitted] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const calculateTotal = () => {
    return Object.values(scores).reduce((sum, score) => sum + (parseFloat(score) || 0), 0);
  };

  const handleScoreChange = (itemId, value) => {
    setScores({ ...scores, [itemId]: value });
  };

  const getInterpretation = (total) => {
    if (total >= 80) return { level: 'High Community-Level Balance', color: 'text-green-600', bg: 'bg-green-50' };
    if (total >= 60) return { level: 'Moderate Community Balance', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { level: 'Significant Balance Impairment', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const total = calculateTotal();
  const interpretation = getInterpretation(total);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!client?.org_id) {
      toast.error("Client practice is required before uploading a score sheet");
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await uploadTenantFile({
        file,
        org_id: client.org_id,
        purpose: 'clinical-attachment',
        subject_date_of_birth: client.date_of_birth || undefined,
      });
      setUploadedFile({ name: file.name, url: file_url });
      toast.success("Score sheet uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload file");
    }
    setUploading(false);
  };

  const handleSave = () => {
    if (Object.keys(scores).length === 0) {
      toast.error("Please score at least one item");
      return;
    }

    const itemLines = CBM_ITEMS.map(item =>
      `  • ${item.name}: ${scores[item.id] ?? 'N/A'} / ${item.max}`
    ).join('\n');

    const soap_text = [
      `Community Balance & Mobility Scale (CB&M)`,
      `Total Score: ${total} / 96 — ${interpretation.level}`,
      ``,
      `Item Scores:`,
      itemLines,
      ``,
      `Assistive Device: ${assistiveDevice === 'none' ? 'None' : assistiveDevice}`,
      `Assistance/Guarding: ${assistanceNeeded}`,
      tasksOmitted ? `Tasks Omitted: ${tasksOmitted}` : null,
    ].filter(Boolean).join('\n');

    onSave({
      result_value: total,
      additional_data: {
        item_scores: scores,
        total_score: total,
        assistive_device: assistiveDevice,
        assistance_needed: assistanceNeeded,
        tasks_omitted: tasksOmitted,
        interpretation: interpretation.level,
        soap_text,
        score_sheet_url: uploadedFile?.url || null,
        score_sheet_name: uploadedFile?.name || null,
      },
      notes: notes,
      assessment_date: todayLocal()
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Community Balance & Mobility Scale</h2>
              <p className="text-slate-600 mt-1">High-level balance and mobility assessment</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Reference */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold">📖 Reference</p>
              <p>Howe JA, Inness EL, Venturini A, Williams JI, & Verrier MC. (2006). The Community Balance and Mobility Scale — a balance measure for individuals with traumatic brain injury. <em>Clinical Rehabilitation, 20</em>(10), 885–895.</p>
            </div>

            {/* Norms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-2">
              <p className="font-semibold text-slate-700">📊 Score Interpretation (/96)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 rounded">
                  <thead className="bg-slate-200"><tr><th className="p-2 text-left">Score</th><th className="p-2 text-left">Interpretation</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="p-2">≥80</td><td className="p-2 text-green-700">High community-level balance and mobility</td></tr>
                    <tr className="border-t bg-white"><td className="p-2">60–79</td><td className="p-2 text-yellow-700">Moderate — community mobility with some limitations</td></tr>
                    <tr className="border-t"><td className="p-2">&lt;60</td><td className="p-2 text-red-700">Significant balance impairment — high fall risk in community</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Healthy adults typically score ≥80. MCID not established. Designed for higher-functioning individuals — ceiling effects rare. Source: Howe et al. (2006).</p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  📋 Test Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800">
                <p>Administer all CB&M items in standard sequence. Use standardised instructions and demonstrations from the CB&M manual. Score 0–5 for most items (item 13 scored 0–6). Higher scores indicate better community-level balance and mobility. Provide demonstration before each task.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Item Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {CBM_ITEMS.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <span className="font-medium">{item.id}. {item.name}</span>
                      </div>
                      <div className="w-32">
                        <Select
                          value={scores[item.id]?.toString() || ''}
                          onValueChange={(value) => handleScoreChange(item.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Score" />
                          </SelectTrigger>
                          <SelectContent>
                            {[...Array(item.max + 1)].map((_, i) => (
                              <SelectItem key={i} value={i.toString()}>{i}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {total > 0 && (
              <Card className={`${interpretation.bg} border-2`}>
                <CardHeader>
                  <CardTitle className={`text-lg ${interpretation.color}`}>
                    Total Score: {total} / 96
                  </CardTitle>
                </CardHeader>
                <CardContent className={interpretation.color}>
                  <p className="font-semibold">{interpretation.level}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Assistive Device Used</Label>
                  <Select value={assistiveDevice} onValueChange={setAssistiveDevice}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="cane">Cane</SelectItem>
                      <SelectItem value="walker">Walker</SelectItem>
                      <SelectItem value="gait_belt">Gait Belt Only</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Physical Assistance or Guarding Needed</Label>
                  <Select value={assistanceNeeded} onValueChange={setAssistanceNeeded}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="guarding_only">Guarding Only</SelectItem>
                      <SelectItem value="minimal">Minimal Assistance</SelectItem>
                      <SelectItem value="moderate">Moderate Assistance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tasks Not Attempted & Reasons</Label>
                  <Textarea
                    value={tasksOmitted}
                    onChange={(e) => setTasksOmitted(e.target.value)}
                    placeholder="e.g., Item 8 (hopping) omitted due to knee pain"
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Clinical Notes & Fall-Prevention Recommendations</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observations, safety concerns, recommendations..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Upload Completed Score Sheet (optional)</Label>
                  <p className="text-xs text-slate-500 mb-2">Attach the physical CB&M score sheet (PDF, image, etc.)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {uploadedFile ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm text-green-800 flex-1 truncate">{uploadedFile.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadedFile(null)}
                        className="text-slate-500 hover:text-red-600 h-auto p-1"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full border-dashed"
                    >
                      {uploading ? (
                        <>Uploading...</>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Score Sheet
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave}
            disabled={Object.keys(scores).length === 0}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save CB&M Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}
