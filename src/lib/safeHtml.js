const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const ALLOWED_ELEMENTS = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "CAPTION", "CODE", "COL", "COLGROUP",
  "DD", "DIV", "DL", "DT", "EM", "FIGCAPTION", "FIGURE", "H1", "H2",
  "H3", "H4", "H5", "H6", "HR", "I", "IMG", "LI", "OL", "P", "PRE",
  "S", "SECTION", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TABLE",
  "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "U", "UL",
]);

const DROP_WITH_CONTENT = new Set([
  "APPLET", "AUDIO", "BASE", "CANVAS", "EMBED", "FRAME", "FRAMESET",
  "IFRAME", "LINK", "MATH", "META", "NOSCRIPT", "OBJECT", "PORTAL",
  "SCRIPT", "SOURCE", "STYLE", "SVG", "TEMPLATE", "TITLE", "TRACK", "VIDEO",
]);

const SAFE_STYLE_PROPERTIES = new Set([
  "background-color", "border", "border-bottom", "border-bottom-color",
  "border-bottom-style", "border-bottom-width", "border-collapse", "border-color",
  "border-left", "border-left-color", "border-left-style", "border-left-width",
  "border-radius", "border-right", "border-right-color", "border-right-style",
  "border-right-width", "border-spacing", "border-style", "border-top",
  "border-top-color", "border-top-style", "border-top-width", "border-width",
  "box-sizing", "break-after", "break-before", "break-inside", "clear", "color",
  "display", "float", "font-family", "font-size", "font-style", "font-variant",
  "font-weight", "height", "letter-spacing", "line-height", "list-style-position",
  "list-style-type", "margin", "margin-bottom", "margin-left", "margin-right",
  "margin-top", "max-height", "max-width", "min-height", "min-width", "opacity",
  "overflow", "overflow-wrap", "padding", "padding-bottom", "padding-left",
  "padding-right", "padding-top", "page-break-after", "page-break-before",
  "page-break-inside", "text-align", "text-decoration", "text-indent",
  "text-transform", "vertical-align", "white-space", "width", "word-break",
]);

const SAFE_DOCUMENT_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src data: blob:",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
].join("; ");

const UNSAFE_CSS = /(?:@import|@font-face|@namespace|url\s*\(|image-set\s*\(|cross-fade\s*\(|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:|https?\s*:|\/\/)/i;
const UNSAFE_STYLE_VALUE = /(?:\\|@|url\s*\(|image-set\s*\(|cross-fade\s*\(|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:|https?\s*:|\/\/|var\s*\()/i;
const SAFE_DATA_IMAGE = /^data:image\/(?:gif|jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;
const HTML_TEXT_ENTITIES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

export function escapeHtmlText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => HTML_TEXT_ENTITIES[character]);
}

export function buildSoapHistoryPrintHtml({ clientName, noteDate, history = [] }) {
  const safeClientName = escapeHtmlText(clientName);
  const safeNoteDate = escapeHtmlText(noteDate);
  const historyHtml = history.map((entry) => `
    <div style="margin-bottom:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
      <p style="font-weight:600;margin:0 0 4px"><span style="text-transform:capitalize">${escapeHtmlText(entry?.action)}</span> by ${escapeHtmlText(entry?.userEmail)}</p>
      <p style="color:#64748b;font-size:12px;margin:0">${escapeHtmlText(entry?.timestamp)}</p>
    </div>
  `).join("");

  return `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>SOAP Note History - ${safeClientName}</title></head><body style="font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto"><h1 style="font-size:24px;margin-bottom:8px">SOAP Note History</h1><p style="color:#64748b;margin-bottom:24px">Client: ${safeClientName} | Note Date: ${safeNoteDate}</p>${historyHtml}</body></html>`;
}

function safeImageUrl(value) {
  const src = String(value || "").trim();
  if (SAFE_DATA_IMAGE.test(src)) return src;
  const origin = globalThis.location?.origin;
  return origin && origin !== "null" && src.startsWith(`blob:${origin}/`) ? src : "";
}

function safeAnchorUrl(value) {
  const url = String(value || "").trim();
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return "";
  const compact = url.replace(/\s/g, "").toLowerCase();
  if (/^(?:javascript|data|vbscript|file|blob):/.test(compact)) return "";
  if (/^(?:https?:|mailto:|tel:|#|\/[^/]|\.\.?\/)/i.test(url)) return url;
  return /^[a-z0-9][a-z0-9._~/?#=&%+\-]*$/i.test(url) ? url : "";
}

function copySafeStyle(source, target) {
  if (!source.style) return;
  for (const property of source.style) {
    const name = property.toLowerCase();
    const value = source.style.getPropertyValue(property).trim();
    if (!SAFE_STYLE_PROPERTIES.has(name) || !value || UNSAFE_STYLE_VALUE.test(value)) continue;
    target.style.setProperty(name, value);
  }
}

function copySafeAttributes(source, target) {
  const className = source.getAttribute("class");
  if (className && !/[\u0000-\u001f\u007f]/.test(className)) target.setAttribute("class", className);

  const id = source.getAttribute("id");
  if (id && /^[A-Za-z][\w:.-]*$/.test(id)) target.setAttribute("id", id);

  for (const name of ["title", "lang", "role", "aria-label", "aria-hidden"]) {
    const value = source.getAttribute(name);
    if (value !== null && !/[\u0000-\u001f\u007f]/.test(value)) target.setAttribute(name, value);
  }

  const dir = source.getAttribute("dir");
  if (/^(?:auto|ltr|rtl)$/i.test(dir || "")) target.setAttribute("dir", dir.toLowerCase());

  if (source.hasAttribute("data-assess-body")) target.setAttribute("data-assess-body", "");
  const listType = source.getAttribute("data-list");
  if (/^(?:ordered|bullet)$/.test(listType || "")) target.setAttribute("data-list", listType);

  if (["TD", "TH"].includes(source.tagName)) {
    for (const name of ["colspan", "rowspan"]) {
      const value = Number.parseInt(source.getAttribute(name), 10);
      if (value >= 1 && value <= 100) target.setAttribute(name, String(value));
    }
    const scope = source.getAttribute("scope");
    if (/^(?:col|colgroup|row|rowgroup)$/.test(scope || "")) target.setAttribute("scope", scope);
  }

  if (["COL", "COLGROUP"].includes(source.tagName)) {
    const span = Number.parseInt(source.getAttribute("span"), 10);
    if (span >= 1 && span <= 100) target.setAttribute("span", String(span));
  }

  if (source.tagName === "A") {
    const href = safeAnchorUrl(source.getAttribute("href"));
    if (href) target.setAttribute("href", href);
    if (source.getAttribute("target") === "_blank") target.setAttribute("target", "_blank");
    target.setAttribute("rel", "noopener noreferrer");
  }

  if (source.tagName === "IMG") {
    const src = safeImageUrl(source.getAttribute("src"));
    if (src) target.setAttribute("src", src);
    const alt = source.getAttribute("alt");
    if (alt) target.setAttribute("alt", alt);
    for (const name of ["width", "height"]) {
      const value = Number.parseInt(source.getAttribute(name), 10);
      if (value >= 1 && value <= 10000) target.setAttribute(name, String(value));
    }
  }

  copySafeStyle(source, target);
}

function copySanitizedNode(source, target, ownerDocument) {
  if (source.nodeType === TEXT_NODE) {
    target.appendChild(ownerDocument.createTextNode(source.nodeValue || ""));
    return;
  }
  if (source.nodeType !== ELEMENT_NODE) return;

  const tag = source.tagName.toUpperCase();
  if (DROP_WITH_CONTENT.has(tag)) return;
  if (!ALLOWED_ELEMENTS.has(tag)) {
    for (const child of source.childNodes) copySanitizedNode(child, target, ownerDocument);
    return;
  }

  if (tag === "IMG" && !safeImageUrl(source.getAttribute("src"))) return;

  const clean = ownerDocument.createElement(tag.toLowerCase());
  copySafeAttributes(source, clean);
  for (const child of source.childNodes) copySanitizedNode(child, clean, ownerDocument);
  target.appendChild(clean);
}

function parseInert(value, ownerDocument) {
  const template = ownerDocument.createElement("template");
  template.innerHTML = typeof value === "string" ? value : "";
  return template;
}

function sanitizedParts(value, ownerDocument) {
  const source = parseInert(value, ownerDocument);
  const title = source.content.querySelector("title")?.textContent?.trim() || "Document";
  const styles = Array.from(source.content.querySelectorAll("style"), (node) => sanitizeStyleSheet(node.textContent))
    .filter(Boolean);
  const container = ownerDocument.createElement("div");
  for (const child of source.content.childNodes) copySanitizedNode(child, container, ownerDocument);
  const html = container.innerHTML;
  const fragment = ownerDocument.createDocumentFragment();
  fragment.append(...container.childNodes);
  return { fragment, html, styles, title };
}

export function sanitizeStyleSheet(value) {
  if (typeof value !== "string") return "";
  const css = value.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const suspiciousEscapes = css.replace(/\\\./g, "").includes("\\");
  return css && !suspiciousEscapes && !UNSAFE_CSS.test(css) ? css : "";
}

export function sanitizeHtml(value, ownerDocument = globalThis.document) {
  if (typeof value !== "string" || !value || !ownerDocument?.createElement) return "";
  return sanitizedParts(value, ownerDocument).html;
}

export function sanitizeHtmlWithBreaks(value, ownerDocument = globalThis.document) {
  if (typeof value !== "string") return "";
  return sanitizeHtml(value.replace(/\r?\n/g, "<br>"), ownerDocument);
}

export function sanitizeHtmlDocument(value, ownerDocument = globalThis.document) {
  if (typeof value !== "string" || !ownerDocument?.createElement) return "";
  const { html, styles, title } = sanitizedParts(value, ownerDocument);
  const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${SAFE_DOCUMENT_CSP}"><title>${escape(title)}</title>${styles.map((css) => `<style>${css}</style>`).join("")}</head><body>${html}</body></html>`;
}

export function replaceWithSafeHtml(target, value) {
  if (!target?.ownerDocument?.createElement) return;
  const { fragment } = sanitizedParts(String(value || ""), target.ownerDocument);
  target.replaceChildren(fragment);
}

/**
 * Render a print/preview document without ever attaching attacker-created nodes.
 * @param {any} targetWindow
 * @param {unknown} value
 * @param {{ title?: string }} [options]
 */
export function renderSafeHtmlDocument(targetWindow, value, { title } = {}) {
  const targetDocument = targetWindow?.document;
  if (!targetDocument?.createElement) return false;

  targetDocument.open();
  targetDocument.close();
  const parts = sanitizedParts(String(value || ""), targetDocument);
  const head = targetDocument.head;
  const body = targetDocument.body;
  if (!head || !body) return false;

  const charset = targetDocument.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  const csp = targetDocument.createElement("meta");
  csp.setAttribute("http-equiv", "Content-Security-Policy");
  csp.setAttribute("content", SAFE_DOCUMENT_CSP);
  const titleElement = targetDocument.createElement("title");
  titleElement.textContent = title || parts.title;
  head.replaceChildren(charset, csp, titleElement);
  for (const css of parts.styles) {
    const style = targetDocument.createElement("style");
    style.textContent = css;
    head.appendChild(style);
  }
  body.replaceChildren(parts.fragment);
  try { targetWindow.opener = null; } catch { /* Cross-browser best effort. */ }
  return true;
}
