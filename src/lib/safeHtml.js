const HTML_TEXT_ENTITIES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/**
 * Encode an untrusted scalar for an HTML text or quoted-attribute context.
 * This keeps print-only static markup from interpreting persisted clinical
 * values as executable HTML.
 */
export function escapeHtmlText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_TEXT_ENTITIES[character]);
}

/**
 * Build the standalone SOAP history print document from text-only values.
 * All dynamic values cross one encoding boundary before entering the markup.
 */
export function buildSoapHistoryPrintHtml({ clientName, noteDate, history = [] }) {
  const safeClientName = escapeHtmlText(clientName);
  const safeNoteDate = escapeHtmlText(noteDate);
  const historyHtml = history.map((entry) => {
    const safeAction = escapeHtmlText(entry?.action);
    const safeUserEmail = escapeHtmlText(entry?.userEmail);
    const safeTimestamp = escapeHtmlText(entry?.timestamp);
    return `
      <div style="margin-bottom: 16px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <p style="font-weight: 600; margin: 0 0 4px 0;">
          <span style="text-transform: capitalize;">${safeAction}</span> by ${safeUserEmail}
        </p>
        <p style="color: #64748b; font-size: 12px; margin: 0;">${safeTimestamp}</p>
      </div>
    `;
  }).join('');

  return `
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
        <title>SOAP Note History - ${safeClientName}</title>
      </head>
      <body style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
        <h1 style="font-size: 24px; margin-bottom: 8px;">SOAP Note History</h1>
        <p style="color: #64748b; margin-bottom: 24px;">Client: ${safeClientName} | Note Date: ${safeNoteDate}</p>
        ${historyHtml}
      </body>
    </html>
  `;
}
