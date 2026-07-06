import { describe, it, expect } from 'vitest';
import { imageDimensions, validatePhoto, MAX_PHOTO_BYTES, MIN_SHORT_EDGE } from '../../src/lib/photo-admin';

// Minimal synthetic headers — just enough structure for a dimension parser.

function pngBytes(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // signature
  const dv = new DataView(b.buffer);
  dv.setUint32(8, 13); // IHDR length
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  dv.setUint32(16, width);
  dv.setUint32(20, height);
  return b;
}

function jpegBytes(width: number, height: number): Uint8Array {
  // SOI, APP0 (skipped by the parser), SOF0 with dimensions.
  const b = new Uint8Array(2 + 4 + 2 + 2 + 2 + 1 + 2 + 2);
  const dv = new DataView(b.buffer);
  let o = 0;
  b.set([0xff, 0xd8], o); o += 2;          // SOI
  b.set([0xff, 0xe0], o); o += 2;          // APP0 marker
  dv.setUint16(o, 4); o += 2;              // APP0 length (len bytes incl. itself)
  o += 2;                                  // APP0 payload (2 bytes)
  b.set([0xff, 0xc0], o); o += 2;          // SOF0
  dv.setUint16(o, 8); o += 2;              // SOF0 length
  b[o] = 8; o += 1;                        // precision
  dv.setUint16(o, height); o += 2;
  dv.setUint16(o, width); o += 2;
  return b;
}

function webpBytes(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46]);         // "RIFF"
  b.set([0x57, 0x45, 0x42, 0x50], 8);      // "WEBP"
  b.set([0x56, 0x50, 0x38, 0x58], 12);     // "VP8X"
  const w = width - 1, h = height - 1;
  b[24] = w & 0xff; b[25] = (w >> 8) & 0xff; b[26] = (w >> 16) & 0xff;
  b[27] = h & 0xff; b[28] = (h >> 8) & 0xff; b[29] = (h >> 16) & 0xff;
  return b;
}

describe('imageDimensions', () => {
  it('reads PNG dimensions', () => {
    expect(imageDimensions(pngBytes(1200, 1500))).toEqual({ width: 1200, height: 1500 });
  });
  it('reads JPEG dimensions (skipping leading segments)', () => {
    expect(imageDimensions(jpegBytes(1364, 1818))).toEqual({ width: 1364, height: 1818 });
  });
  it('reads WebP (VP8X) dimensions', () => {
    expect(imageDimensions(webpBytes(1000, 1000))).toEqual({ width: 1000, height: 1000 });
  });
  it('returns null for unrecognizable bytes', () => {
    expect(imageDimensions(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull();
  });
});

describe('validatePhoto', () => {
  const good = { type: 'image/jpeg', size: 500_000, bytes: jpegBytes(1364, 1818) };

  it('accepts a valid jpeg and reports its dimensions', () => {
    expect(validatePhoto(good)).toEqual({ ok: true, width: 1364, height: 1818 });
  });
  it('rejects a disallowed mime type', () => {
    expect(validatePhoto({ ...good, type: 'image/gif' })).toHaveProperty('error');
  });
  it('rejects an oversize file', () => {
    expect(validatePhoto({ ...good, size: MAX_PHOTO_BYTES + 1 })).toHaveProperty('error');
  });
  it('rejects when the short edge is under the sharpness floor', () => {
    const small = validatePhoto({ ...good, bytes: jpegBytes(MIN_SHORT_EDGE - 1, 2000) });
    expect(small).toHaveProperty('error');
  });
  it('rejects bytes that do not decode as an image', () => {
    expect(validatePhoto({ ...good, bytes: new Uint8Array(16) })).toHaveProperty('error');
  });
});
