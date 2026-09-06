import React, { useRef } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Renders server-generated report HTML in a sandboxed frame. The document
 * carries its own styles and contains no scripts; the frame allows only what
 * printing needs.
 */
export default function DocumentFrame({ html, title, onPrint = null }) {
  const frameRef = useRef(null);
  const print = () => {
    const frame = frameRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      if (onPrint) onPrint();
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={print} data-testid="print-document">Print / save as PDF</Button>
      </div>
      <iframe
        ref={frameRef}
        title={title}
        className="demo-document-frame"
        sandbox="allow-same-origin allow-modals"
        srcDoc={html || '<p>No document.</p>'}
        data-testid="document-frame"
      />
    </div>
  );
}
