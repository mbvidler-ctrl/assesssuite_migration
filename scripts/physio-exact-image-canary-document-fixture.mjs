// Frozen, wholly synthetic referral used only by the immutable-image canary.
// This lives with the production canary rather than under server/tests so the
// real-provider journey has no dependency on a test harness or test fixture
// module. It contains no real person or provider information.

function escapePdfText(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

export function buildPhysioCanaryReferralPdf() {
  const lines = [
    'SYNTHETIC REFERRAL - NOT A REAL PATIENT',
    'FIXTURE ID: PHYSIO_EXACT_IMAGE_CANARY_REFERRAL_V1',
    'NAME: ALEX RIVER',
    'DATE OF BIRTH: 1990-01-02',
    'REFERRAL SOURCE: GP',
    'REFERRER NAME: DR SYNTHETIC',
    'PRIMARY CONDITION: ANKLE SPRAIN',
    'COMORBIDITIES: ASTHMA',
    'PRIMARY GP NAME: DR SYNTHETIC',
  ];
  const stream = [
    'BT',
    '/F1 14 Tf',
    '72 760 Td',
    ...lines.flatMap((line, index) => [
      index === 0 ? '' : '0 -24 Td',
      `(${escapePdfText(line)}) Tj`,
    ]).filter(Boolean),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}
