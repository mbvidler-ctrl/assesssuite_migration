import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Shared renderer for suite legal content. Deliberately plain, dense prose —
// this is a legal instrument, not marketing copy; no decorative styling.
const components = {
  h1: (props) => <h1 className="text-2xl font-bold text-slate-900 mt-8 mb-3 first:mt-0" {...props} />,
  h2: (props) => <h2 className="text-lg font-bold text-slate-900 mt-6 mb-2" {...props} />,
  h3: (props) => <h3 className="text-base font-semibold text-slate-900 mt-4 mb-1.5" {...props} />,
  h4: (props) => <h4 className="text-sm font-semibold text-slate-800 mt-3 mb-1" {...props} />,
  p: (props) => <p className="text-sm leading-relaxed text-slate-700 mb-3" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 text-sm text-slate-700 mb-3 space-y-1" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 text-sm text-slate-700 mb-3 space-y-1" {...props} />,
  li: (props) => <li {...props} />,
  strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
  a: (props) => <a className="text-blue-700 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer" {...props} />,
  blockquote: (props) => (
    <blockquote className="border-l-4 border-slate-300 bg-slate-50 pl-4 py-2 my-3 text-sm text-slate-600 italic" {...props} />
  ),
  code: (props) => <code className="bg-slate-100 text-slate-800 rounded px-1 py-0.5 text-xs font-mono" {...props} />,
  pre: (props) => <pre className="bg-slate-100 rounded-lg p-3 my-3 overflow-x-auto text-xs font-mono" {...props} />,
  hr: () => <hr className="my-6 border-slate-200" />,
  table: (props) => (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full border border-slate-200 text-xs" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-slate-900 text-white" {...props} />,
  th: (props) => <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold" {...props} />,
  td: (props) => <td className="border border-slate-200 px-2 py-1.5 align-top" {...props} />,
};

export default function LegalMarkdown({ content }) {
  return (
    <div>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
