import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

import { cn } from "@/lib/utils";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

const QUILL_FORMATS = ["header", "bold", "italic", "underline", "list"];

// Quill represents an empty document as a single empty paragraph. Normalising
// it to "" keeps existing emptiness checks (e.g. value.trim()) working.
const QUILL_EMPTY_VALUE = "<p><br></p>";

/**
 * Shared rich-text edit surface for report and letter content.
 *
 * Value in / value out is an HTML string, so components that already persist
 * HTML (and render it through a markup-interpreting view) keep the same
 * storage format.
 */
export default function RichTextEditor({ value, onChange, placeholder, className }) {
  const handleChange = (content) => {
    if (!onChange) return;
    onChange(content === QUILL_EMPTY_VALUE ? "" : content);
  };

  return (
    <div className={cn("rich-text-editor bg-white rounded-md border border-input", className)}>
      <style>{`
        .rich-text-editor .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid hsl(var(--border, 214.3 31.8% 91.4%));
          border-top-left-radius: calc(0.5rem - 2px);
          border-top-right-radius: calc(0.5rem - 2px);
        }
        .rich-text-editor .ql-container.ql-snow {
          border: none;
          border-bottom-left-radius: calc(0.5rem - 2px);
          border-bottom-right-radius: calc(0.5rem - 2px);
          font-size: 0.875rem;
          font-family: inherit;
        }
        .rich-text-editor .ql-editor {
          min-height: 10rem;
        }
      `}</style>
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={handleChange}
        placeholder={placeholder}
        modules={QUILL_MODULES}
        formats={QUILL_FORMATS}
      />
    </div>
  );
}
