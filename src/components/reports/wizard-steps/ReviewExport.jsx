import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { FileText, Edit2, Check, X } from "lucide-react";

// --- Report-html edit partitioning -------------------------------------------
//
// The built report_html is a full HTML document: <head> styling, a letterhead
// preamble, a prose body, an embedded data-driven outcome-comparison table, and
// a signoff/footer tail. react-quill only understands a narrow set of inline
// formats, so feeding it the whole document strips the styling, the letterhead
// and the outcome table. To keep those intact, only the prose body is handed to
// the editor; the non-prose structure is preserved deterministically and the
// document is re-composed on apply.
//
// Strategy:
//   * <head> styling, the letterhead preamble and the signoff/footer tail are
//     captured verbatim and never pass through the editor.
//   * The data-driven outcome table (identified by its fixed header signature,
//     which distinguishes it from prose pipe-tables that also carry
//     class="outcome") is lifted out and replaced with a text slot before
//     editing, then re-inserted at that slot on apply — so it survives whatever
//     the editor does to the surrounding prose.
//   * The editable body region is wrapped in a [data-assess-body] marker on
//     re-composition so subsequent edits partition deterministically, even
//     after the editor has unwrapped the original .section / .lp blocks.

const SLOT_TEXT = "Outcome comparison table will be inserted here automatically.";
const SLOT_HTML = `<p><em>${SLOT_TEXT}</em></p>`;
const SLOT_RE = new RegExp(
  `<p\\b[^>]*>(?:(?!</p>)[\\s\\S])*?${SLOT_TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:(?!</p>)[\\s\\S])*?</p>`,
  "i"
);

const isProseBlock = (el) =>
  el.classList && (el.classList.contains("section") || el.classList.contains("lp"));

// The data-driven outcome-comparison table has a fixed column signature. Prose
// pipe-tables (also class="outcome", emitted by renderRichText) do not, so they
// stay in the editable body and are never mistaken for the data table.
function isOutcomeComparisonTable(table) {
  const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
    (th.textContent || "").trim().toLowerCase()
  );
  return headers[0] === "assessment" && headers.includes("most recent") && headers.includes("interpretation");
}

function findOutcomeComparisonTable(root) {
  const candidates = [];
  if (root.matches && root.matches("table.outcome")) candidates.push(root);
  candidates.push(...root.querySelectorAll("table.outcome"));
  return candidates.find(isOutcomeComparisonTable) || null;
}

// Lift the data table (and its trailing direction note) out of `region`,
// leaving a text slot in its place. Mutates the live DOM inside `region`.
// Returns the extracted block HTML (empty string when the report has no
// data-driven table).
function extractOutcomeTable(doc, region) {
  const table = findOutcomeComparisonTable(region);
  if (!table) return "";
  const parts = [table.outerHTML];
  const note = table.nextElementSibling;
  if (
    note &&
    note.tagName === "P" &&
    /direction of benefit|direction is recorded/i.test(note.textContent || "")
  ) {
    parts.push(note.outerHTML);
    note.remove();
  }
  const slot = doc.createElement("p");
  slot.innerHTML = `<em>${SLOT_TEXT}</em>`;
  table.replaceWith(slot);
  return parts.join("");
}

/**
 * Split a built report_html document into the parts needed for prose-only
 * editing. Returns null for anything that is not a structured report document
 * (e.g. legacy content or an already-normalised fragment), so the caller can
 * fall back to editing the raw HTML unchanged.
 */
export function splitReportHtml(html) {
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") return null;
  if (!html || !/<style[\s>]/i.test(html)) return null;

  const doc = new window.DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  if (!body || !doc.head || doc.head.querySelectorAll("style").length === 0) return null;

  const headHtml = doc.head.innerHTML;
  const children = Array.from(body.children);

  // Prefer the explicit marker written on a previous re-composition; fall back
  // to the .section / .lp heuristic for a freshly built document.
  const marker = body.querySelector("[data-assess-body]");
  let preambleHtml;
  let postambleHtml;
  let region;

  if (marker && marker.parentElement === body) {
    const idx = children.indexOf(marker);
    preambleHtml = children.slice(0, idx).map((el) => el.outerHTML).join("");
    postambleHtml = children.slice(idx + 1).map((el) => el.outerHTML).join("");
    region = marker;
  } else {
    const firstIdx = children.findIndex(isProseBlock);
    if (firstIdx === -1) return null;
    let lastIdx = firstIdx;
    for (let i = children.length - 1; i >= firstIdx; i--) {
      if (isProseBlock(children[i])) { lastIdx = i; break; }
    }
    preambleHtml = children.slice(0, firstIdx).map((el) => el.outerHTML).join("");
    postambleHtml = children.slice(lastIdx + 1).map((el) => el.outerHTML).join("");
    region = doc.createElement("div");
    children.slice(firstIdx, lastIdx + 1).forEach((el) => region.appendChild(el));
  }

  const outcomeTableHtml = extractOutcomeTable(doc, region);
  const editableBodyHtml = region.innerHTML;

  return { headHtml, preambleHtml, postambleHtml, outcomeTableHtml, editableBodyHtml };
}

/**
 * Re-compose a full report_html document from the preserved parts and the
 * editor's prose output, re-inserting the outcome table at its slot.
 */
export function recomposeReportHtml(parts, editedBodyHtml) {
  let body = editedBodyHtml || "";
  if (parts.outcomeTableHtml) {
    body = SLOT_RE.test(body)
      ? body.replace(SLOT_RE, () => parts.outcomeTableHtml)
      : body + parts.outcomeTableHtml;
  }
  return (
    `<!DOCTYPE html><html><head>${parts.headHtml}</head><body>` +
    `${parts.preambleHtml}<div data-assess-body>${body}</div>${parts.postambleHtml}` +
    `</body></html>`
  );
}

export default function ReviewExport({ reportHtml, client, clinician, onEditHtml }) {
  const [isEditing, setIsEditing] = useState(false);
  // The prose handed to the editor. When editParts is set, the letterhead,
  // styling and outcome table are held aside and re-applied on save; when it is
  // null (unstructured/legacy content) the raw HTML is edited directly.
  const [editableBody, setEditableBody] = useState("");
  const [editParts, setEditParts] = useState(null);

  const handleStartEdit = () => {
    const parts = splitReportHtml(reportHtml);
    if (parts) {
      setEditParts(parts);
      setEditableBody(parts.editableBodyHtml);
    } else {
      setEditParts(null);
      setEditableBody(reportHtml || "");
    }
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const nextHtml = editParts ? recomposeReportHtml(editParts, editableBody) : editableBody;
    onEditHtml(nextHtml);
    setIsEditing(false);
    setEditParts(null);
    setEditableBody("");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditParts(null);
    setEditableBody("");
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Review & Edit Report</h3>
        </div>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={handleStartEdit}>
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
          <p className="text-xs text-slate-500">
            Edit the report wording below — tweak text, remove sections, or add custom content. The letterhead,
            outcome comparison table, and styling are preserved automatically.
          </p>
          <RichTextEditor
            value={editableBody}
            onChange={setEditableBody}
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
