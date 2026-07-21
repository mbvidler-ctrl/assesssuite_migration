import React, { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";

import { cn } from "@/lib/utils";
import { sanitizeRichTextHtml } from "@/lib/richTextSanitizer";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

const QUILL_FORMATS = ["header", "bold", "italic", "underline", "list"];

function replaceEditorContents(editor, value) {
  const safeValue = sanitizeRichTextHtml(value, editor.root.ownerDocument);
  if (!safeValue) {
    editor.setText("", "silent");
    return "";
  }

  const contents = editor.clipboard.convert({ html: safeValue, text: "" });
  editor.setContents(contents, "silent");
  return safeValue;
}

function insertClipboardData(editor, transfer) {
  const range = editor.getSelection(true) || {
    index: Math.max(0, editor.getLength() - 1),
    length: 0,
  };

  if (range.length > 0) editor.deleteText(range.index, range.length, "user");

  const html = transfer.getData("text/html");
  if (html) {
    const safeHtml = sanitizeRichTextHtml(html, editor.root.ownerDocument);
    if (safeHtml) editor.clipboard.dangerouslyPasteHTML(range.index, safeHtml, "user");
    return;
  }

  const text = transfer.getData("text/plain");
  if (text) editor.insertText(range.index, text, "user");
}

/**
 * Shared rich-text edit surface for report and letter content.
 *
 * Value in / value out is an HTML string, so components that already persist
 * HTML (and render it through a markup-interpreting view) keep the same
 * storage format.
 */
export default function RichTextEditor({ value, onChange, placeholder, className }) {
  const editorHostRef = useRef(null);
  const editorRef = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const placeholderRef = useRef(placeholder);
  const lastEmittedValueRef = useRef(null);

  valueRef.current = value;
  onChangeRef.current = onChange;
  placeholderRef.current = placeholder;

  useEffect(() => {
    if (!editorHostRef.current) return undefined;

    const editor = new Quill(editorHostRef.current, {
      theme: "snow",
      placeholder: placeholderRef.current,
      modules: QUILL_MODULES,
      formats: QUILL_FORMATS,
    });
    const toolbar = editorHostRef.current.previousElementSibling?.classList.contains("ql-toolbar")
      ? editorHostRef.current.previousElementSibling
      : null;
    editorRef.current = editor;
    replaceEditorContents(editor, valueRef.current || "");

    const handleTextChange = (_delta, _previous, source) => {
      if (source === "silent") return;
      const safeValue = sanitizeRichTextHtml(editor.getSemanticHTML(), editor.root.ownerDocument);
      lastEmittedValueRef.current = safeValue;
      onChangeRef.current?.(safeValue);
    };
    const handlePaste = (event) => {
      if (!event.clipboardData) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      insertClipboardData(editor, event.clipboardData);
    };
    const handleDrop = (event) => {
      if (!event.dataTransfer) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      insertClipboardData(editor, event.dataTransfer);
    };

    editor.on("text-change", handleTextChange);
    editor.root.addEventListener("paste", handlePaste, true);
    editor.root.addEventListener("drop", handleDrop, true);

    return () => {
      editor.off("text-change", handleTextChange);
      editor.root.removeEventListener("paste", handlePaste, true);
      editor.root.removeEventListener("drop", handleDrop, true);
      toolbar?.remove();
      if (editorHostRef.current) {
        editorHostRef.current.replaceChildren();
        editorHostRef.current.removeAttribute("class");
      }
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const safeValue = sanitizeRichTextHtml(value || "", editor.root.ownerDocument);
    if (safeValue === lastEmittedValueRef.current) {
      lastEmittedValueRef.current = null;
      return;
    }

    const currentValue = sanitizeRichTextHtml(editor.getSemanticHTML(), editor.root.ownerDocument);
    if (currentValue !== safeValue) replaceEditorContents(editor, safeValue);
  }, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) editor.root.setAttribute("data-placeholder", placeholder || "");
  }, [placeholder]);

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
      <div ref={editorHostRef} />
    </div>
  );
}
