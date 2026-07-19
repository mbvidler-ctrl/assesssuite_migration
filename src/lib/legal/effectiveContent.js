import {
  SUITE_PUBLICATION_AUTHORITY,
  SUITE_VERSION,
} from "./documentRegistry.js";

/**
 * Returns the exact legal-instrument text presented by the public legal page.
 * Both the browser and the server use this function so the acceptance receipt
 * is fingerprinted over the same bytes the practitioner can read.
 */
export function effectiveLegalContent(content, { status, effectiveDate } = {}) {
  if (status !== "effective" || !effectiveDate) return content;
  return content
    .replace(/^\*\*Release status:\*\*.*$/m, "**Release status:** Effective  ")
    .replace(/^\*\*Effective date:\*\*.*$/m, `**Effective date:** ${effectiveDate}  `)
    .replace(
      /^\*\*Approved by:\*\*.*$/m,
      `**Publication authority:** ${SUITE_PUBLICATION_AUTHORITY}  `,
    )
    .replace(
      /^\*\*Publication authority:\*\*.*$/m,
      `**Publication authority:** ${SUITE_PUBLICATION_AUTHORITY}  `,
    )
    .replace(/^\*\*Version:\*\*.*$/m, `**Version:** ${SUITE_VERSION}  `);
}
