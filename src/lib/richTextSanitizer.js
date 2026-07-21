const ALLOWED_ELEMENTS = Object.freeze({
  P: "p",
  DIV: "div",
  H2: "h2",
  H3: "h3",
  STRONG: "strong",
  B: "strong",
  EM: "em",
  I: "em",
  U: "u",
  OL: "ol",
  UL: "ul",
  LI: "li",
  BR: "br",
});

const DROP_WITH_CONTENT = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "MATH",
  "IMG",
  "VIDEO",
  "AUDIO",
  "SOURCE",
]);

const ALLOWED_LIST_TYPES = new Set(["ordered", "bullet"]);
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function copySanitizedNode(sourceNode, targetNode, ownerDocument) {
  if (sourceNode.nodeType === TEXT_NODE) {
    targetNode.appendChild(ownerDocument.createTextNode(sourceNode.nodeValue || ""));
    return;
  }

  if (sourceNode.nodeType !== ELEMENT_NODE) return;

  const sourceTag = sourceNode.tagName.toUpperCase();
  if (DROP_WITH_CONTENT.has(sourceTag)) return;

  const targetTag = ALLOWED_ELEMENTS[sourceTag];
  if (!targetTag) {
    for (const child of Array.from(sourceNode.childNodes)) {
      copySanitizedNode(child, targetNode, ownerDocument);
    }
    return;
  }

  const cleanElement = ownerDocument.createElement(targetTag);
  if (sourceTag === "LI") {
    const listType = sourceNode.getAttribute("data-list");
    if (ALLOWED_LIST_TYPES.has(listType)) cleanElement.setAttribute("data-list", listType);
  }

  for (const child of Array.from(sourceNode.childNodes)) {
    copySanitizedNode(child, cleanElement, ownerDocument);
  }
  targetNode.appendChild(cleanElement);
}

/**
 * Reconstruct rich text into a small, attribute-free element set. The only
 * retained attribute is Quill 2's data-list marker, limited to its two known
 * literal values. Rebuilding nodes instead of deleting known-bad attributes
 * makes unknown tags and event-handler variants fail closed.
 */
export function sanitizeRichTextHtml(value, ownerDocument = globalThis.document) {
  if (typeof value !== "string" || !value.trim()) return "";
  if (!ownerDocument?.createElement) return "";

  const sourceTemplate = ownerDocument.createElement("template");
  sourceTemplate.innerHTML = value;
  const cleanContainer = ownerDocument.createElement("div");

  for (const child of Array.from(sourceTemplate.content.childNodes)) {
    copySanitizedNode(child, cleanContainer, ownerDocument);
  }

  const visibleText = (cleanContainer.textContent || "")
    .replace(/[\u200B\uFEFF]/g, "")
    .trim();
  return visibleText ? cleanContainer.innerHTML : "";
}
