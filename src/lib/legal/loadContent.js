// Bulk-loads every copied suite document as a raw string at build time
// (Vite 6 glob-import), keyed by filename, so LegalDocumentPage / the
// acceptance forms never need a dynamic per-file import path.
const modules = import.meta.glob("../../legal-content/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const byFilename = {};
for (const [path, content] of Object.entries(modules)) {
  const filename = path.split("/").pop();
  byFilename[filename] = content;
}

export function loadLegalContent(filename) {
  const content = byFilename[filename];
  if (!content) throw new Error(`Legal content file not found: ${filename}`);
  return content;
}
