import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, X, FileText, ChevronDown, ChevronUp, History, LockKeyhole } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { SecureFileLink } from "@/components/files/SecureFile";
import { uploadTenantFile } from "@/lib/fileIntegrations";

/**
 * The shared JavaScript wrappers are inferred as ref-only components under
 * checkJs. Keep the compatibility surface local and describe only the native
 * props this editor actually supplies.
 */
const ReportLabel = /** @type {React.ComponentType<React.PropsWithChildren<React.LabelHTMLAttributes<HTMLLabelElement>>>} */ (
  /** @type {unknown} */ (Label)
);
const ReportTextarea = /** @type {React.ComponentType<React.TextareaHTMLAttributes<HTMLTextAreaElement>>} */ (
  /** @type {unknown} */ (Textarea)
);

// Core V1 keeps guidance deterministic and visible to the clinician. It is not
// converted into a browser-owned prompt or sent to a generic integration.
const SECTION_GUIDANCE = {
  "Referral Details": "Referrer, practice, referral date, reason and applicable item number.",
  "Client Background": "Relevant history, conditions, medicines and prior allied-health involvement.",
  "Background": "Relevant history, conditions, medicines and reason for this episode of care.",
  "Assessment Findings & Results": "Use recorded results and units. Distinguish observation from interpretation.",
  "Baseline Outcome Measures & Results": "Record baseline results and dates so later comparisons remain auditable.",
  "Outcome Measures (baseline vs current)": "The verified outcome table is inserted automatically; add only clinician-authored interpretation.",
  "Goals & Outcomes": "Record measurable, time-bound goals aligned with the client's documented priorities.",
  "Plan / Recommendations": "State each recommendation, frequency, duration and its evidence basis.",
  "Recommendations": "State each recommendation, frequency, duration and its evidence basis.",
  "Provider Signature": "Confirm the practitioner identity and credentials before signing.",
};

const CORE_DRAFTING_MESSAGE =
  "Core-assisted drafting is unavailable until the purpose-specific report endpoint and review workflow are connected. Continue with clinician-authored draft text; no client context leaves this page.";

export default function SectionEditor({
  sections,
  content,
  onChange,
  client,
  clinician,
  priorReports,
  soapNotes,
}) {
  const [activeSection, setActiveSection] = useState(sections[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const canvasRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  React.useEffect(() => {
    if (!sections.includes(activeSection)) setActiveSection(sections[0]);
  }, [activeSection, sections]);

  const isSignatureSection = activeSection?.toLowerCase().includes("signature");
  const isAttachmentSection = activeSection?.toLowerCase().includes("attachment");
  const activeGuidance = SECTION_GUIDANCE[activeSection];

  React.useEffect(() => {
    if (isSignatureSection && clinician && !content[activeSection]) {
      const autoText = `${clinician.full_name || ""}${clinician.provider_number ? `\nProvider Number: ${clinician.provider_number}` : ""}${clinician.profession ? `\nProfession: ${clinician.profession}` : ""}`;
      onChange({ ...content, [activeSection]: autoText, [`${activeSection}_ai_drafted`]: false });
    }
  }, [activeSection, clinician, content, isSignatureSection, onChange]);

  const getCoordinates = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const point = event.touches?.[0] || event;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const startDrawing = (event) => {
    event.preventDefault();
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const point = getCoordinates(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#000";
    setIsDrawing(true);
  };

  const draw = (event) => {
    event.preventDefault();
    if (!isDrawing) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const point = getCoordinates(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = (event) => {
    event.preventDefault();
    setIsDrawing(false);
    if (!canvasRef.current) return;
    onChange({
      ...content,
      [`${activeSection}_signature`]: canvasRef.current.toDataURL(),
    });
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange({ ...content, [`${activeSection}_signature`]: null });
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      if (!client?.org_id) throw new Error("Client practice is required before uploading report attachments.");
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadTenantFile({ file, org_id: client.org_id, purpose: "report-attachment" }));
      }
      const attachments = uploaded.map((result, index) => ({ url: result.file_url, name: files[index].name }));
      await Promise.all(attachments.map((attachment) => base44.entities.ClientDocument.create({
        org_id: client.org_id,
        client_id: client.id,
        document_type: "report",
        file_url: attachment.url,
        file_name: attachment.name,
        notes: `Attached to report section: ${activeSection}`,
      })));
      onChange({
        ...content,
        [`${activeSection}_attachments`]: [...(content[`${activeSection}_attachments`] || []), ...attachments],
      });
      toast.success(`${files.length} file(s) uploaded`);
    } catch (error) {
      toast.error(error?.message || "Failed to upload files");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index) => {
    const attachments = content[`${activeSection}_attachments`] || [];
    onChange({ ...content, [`${activeSection}_attachments`]: attachments.filter((_, itemIndex) => itemIndex !== index) });
  };

  const completedSections = sections.filter((section) => content[section]?.trim()).length;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
        <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span><strong>Draft-only mode.</strong> {CORE_DRAFTING_MESSAGE}</span>
      </div>

      {((priorReports?.length || 0) > 0 || (soapNotes?.length || 0) > 0) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-blue-800"
            onClick={() => setShowContext((shown) => !shown)}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Local source records available for clinician reference
              <Badge variant="secondary" className="bg-blue-100 text-xs text-blue-700">
                {priorReports?.length || 0} reports · {soapNotes?.length || 0} notes
              </Badge>
            </div>
            {showContext ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showContext && (
            <div className="space-y-3 px-4 pb-3">
              {(priorReports || []).map((report) => (
                <div key={report.id} className="rounded border border-blue-100 bg-white px-2 py-1 text-xs text-blue-900">
                  {report.report_name} <span className="text-blue-400">({report.report_date})</span>
                </div>
              ))}
              {(soapNotes || []).slice(0, 5).map((note) => (
                <div key={note.id} className="rounded border border-blue-100 bg-white px-2 py-1 text-xs text-blue-900">
                  Session note recorded: <span className="font-medium">{note.note_date || "date unavailable"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-slate-600">
        <span className="font-semibold text-blue-600">{completedSections}</span> of {sections.length} sections completed
      </p>

      <div className="flex gap-4">
        <div className="w-48 flex-shrink-0 space-y-1">
          {sections.map((section) => (
            <button
              type="button"
              key={section}
              onClick={() => setActiveSection(section)}
              className={`w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${activeSection === section ? "bg-blue-600 font-semibold text-white" : content[section]?.trim() ? "border border-green-200 bg-green-50 text-green-800" : "border border-slate-200 bg-slate-50 text-slate-600"}`}
            >
              {section}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3">
          <ReportLabel className="text-sm font-semibold text-slate-700">{activeSection}</ReportLabel>
          {activeGuidance && !isSignatureSection && !isAttachmentSection && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Clinician drafting guide: </strong>{activeGuidance}
            </div>
          )}

          {isSignatureSection ? (
            <div className="space-y-3">
              <ReportTextarea value={content[activeSection] || ""} onChange={(event) => onChange({ ...content, [activeSection]: event.target.value })} placeholder="Provider name and credentials..." className="min-h-[80px] text-sm" />
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="mb-2 text-xs text-slate-500">Draw signature below:</p>
                <canvas ref={canvasRef} width={400} height={120} className="w-full cursor-crosshair rounded border bg-white" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                <Button size="sm" variant="outline" onClick={clearSignature} className="mt-2 text-xs">Clear Signature</Button>
              </div>
            </div>
          ) : isAttachmentSection ? (
            <div className="space-y-3">
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx" multiple className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="text-xs">
                <Upload className="mr-2 h-4 w-4" />{isUploading ? "Uploading..." : "Upload Files"}
              </Button>
              {(content[`${activeSection}_attachments`] || []).map((attachment, index) => (
                <div key={`${attachment.url}-${index}`} className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" /><SecureFileLink href={attachment.url} orgId={client.org_id} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">{attachment.name}</SecureFileLink></div>
                  <button type="button" onClick={() => removeAttachment(index)} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          ) : (
            <ReportTextarea
              value={content[activeSection] || ""}
              onChange={(event) => onChange({ ...content, [activeSection]: event.target.value, [`${activeSection}_ai_drafted`]: false })}
              placeholder={`Write the ${activeSection} section here. Core-assisted drafting is pending server integration.`}
              className="min-h-[280px] resize-y text-sm leading-relaxed"
            />
          )}

          <p className="text-xs text-slate-400">{content[activeSection]?.trim() ? `${content[activeSection].trim().split(/\s+/).length} words` : "Empty — clinician-authored draft required"}</p>
        </div>
      </div>
    </div>
  );
}
