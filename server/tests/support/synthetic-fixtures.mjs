import { deflateSync } from 'node:zlib';

export const PROFILE_A = Object.freeze({
  full_name: 'Alex River',
  date_of_birth: '1990-01-02',
  diagnoses: ['ankle sprain', 'asthma'],
  referrer: 'Dr Synthetic',
  phone: null,
});

export const PROFILE_DOB_CHANGE = Object.freeze({
  ...PROFILE_A,
  date_of_birth: '1991-03-04',
});

export const PROFILE_FILL = Object.freeze({
  full_name: 'Alex River',
  date_of_birth: null,
  diagnoses: ['asthma', 'migraine'],
  referrer: null,
  phone: '0400000000',
});

export const MERGED_PROFILE = Object.freeze({
  full_name: 'Alex River',
  date_of_birth: '1990-01-02',
  diagnoses: ['ankle sprain', 'asthma', 'migraine'],
  referrer: 'Dr Synthetic',
  phone: '0400000000',
});

export const REFERRAL_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    full_name: { type: 'string' },
    date_of_birth: { type: ['string', 'null'], format: 'date' },
    diagnoses: { type: 'array', items: { type: 'string' } },
    referrer: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
  },
  required: ['full_name', 'date_of_birth', 'diagnoses', 'referrer', 'phone'],
});

const CSV_FIXTURES = Object.freeze({
  'referral-primary.csv': 'fixture_id,full_name,date_of_birth,diagnoses,referrer,phone\nASSURANCE_PROFILE_A,Alex River,1990-01-02,"ankle sprain|asthma",Dr Synthetic,\n',
  'referral-primary-dob-change.csv': 'fixture_id,full_name,date_of_birth,diagnoses,referrer,phone\nASSURANCE_PROFILE_DOB_CHANGE,Alex River,1991-03-04,"ankle sprain|asthma",Dr Synthetic,\n',
  'referral-additional.csv': 'fixture_id,full_name,date_of_birth,diagnoses,referrer,phone\nASSURANCE_PROFILE_FILL,Alex River,,"asthma|migraine",,0400000000\n',
});

export function csvFixture(name = 'referral-primary.csv') {
  const fixture = CSV_FIXTURES[name];
  if (!fixture) throw new Error('unknown synthetic CSV fixture');
  return Buffer.from(fixture, 'utf8');
}

function escapePdfText(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

/** Builds a small valid text PDF without introducing a PDF dependency. */
export function pdfFixture({ marker = 'ASSURANCE_PROFILE_A', dateOfBirth = '1990-01-02' } = {}) {
  const lines = [
    'SYNTHETIC REFERRAL - NOT A REAL PATIENT',
    `FIXTURE ID: ${marker}`,
    'NAME: ALEX RIVER',
    `DATE OF BIRTH: ${dateOfBirth}`,
    'DIAGNOSES: ANKLE SPRAIN; ASTHMA',
    'REFERRER: DR SYNTHETIC',
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

const FONT = {
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  ':': ['00000','00100','00100','00000','00100','00100','00000'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','10000','11110','00001','00001','11110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00001','01110'],
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01111'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['01110','00100','00100','00100','00100','00100','01110'],
  J: ['00001','00001','00001','00001','10001','10001','01110'],
  K: ['10001','10010','10100','11000','10100','10010','10001'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'],
  X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  Z: ['11111','00001','00010','00100','01000','10000','11111'],
};

let crcTable;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, value) => {
      let crc = value;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
      return crc >>> 0;
    });
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const payload = Buffer.concat([typeBuffer, data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(payload));
  return Buffer.concat([length, payload, checksum]);
}

/** Builds a visible, OCR-friendly RGB PNG and embeds only a synthetic fixture marker. */
export function pngFixture({ marker = 'ASSURANCE_PROFILE_A', dateOfBirth = '1990-01-02' } = {}) {
  const lines = [
    'SYNTHETIC REFERRAL',
    'NAME: ALEX RIVER',
    `DOB: ${dateOfBirth}`,
    'DIAGNOSES: ANKLE SPRAIN ASTHMA',
    'REFERRER: DR SYNTHETIC',
  ];
  const scale = 4;
  const padding = 12;
  const charWidth = 6 * scale;
  const lineHeight = 9 * scale;
  const width = Math.max(...lines.map((line) => line.length)) * charWidth + padding * 2;
  const height = lines.length * lineHeight + padding * 2;
  const pixels = Buffer.alloc(width * height * 3, 255);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    for (let charIndex = 0; charIndex < lines[lineIndex].length; charIndex += 1) {
      const glyph = FONT[lines[lineIndex][charIndex]] || FONT[' '];
      for (let gy = 0; gy < 7; gy += 1) {
        for (let gx = 0; gx < 5; gx += 1) {
          if (glyph[gy][gx] !== '1') continue;
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) {
              const x = padding + charIndex * charWidth + gx * scale + sx;
              const y = padding + lineIndex * lineHeight + gy * scale + sy;
              const offset = (y * width + x) * 3;
              pixels[offset] = 15;
              pixels[offset + 1] = 23;
              pixels[offset + 2] = 42;
            }
          }
        }
      }
    }
  }
  const scanlines = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 3 + 1);
    scanlines[rowOffset] = 0;
    pixels.copy(scanlines, rowOffset + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('tEXt', Buffer.from(`assurance-fixture\0${marker}`, 'latin1')),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function detectFixtureProfile(rawText) {
  if (rawText.includes('ASSURANCE_PROFILE_DOB_CHANGE') || rawText.includes('1991-03-04')) return PROFILE_DOB_CHANGE;
  if (rawText.includes('ASSURANCE_PROFILE_FILL') || rawText.includes('0400000000')) return PROFILE_FILL;
  return PROFILE_A;
}
