// Pure validation for hero-photo uploads. The route trusts nothing from the
// client: mime whitelist, size cap, and dimensions parsed from the actual
// bytes (a short hero photo renders soft on the public site).

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MIN_SHORT_EDGE = 800;
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface Dimensions { width: number; height: number; }

function pngDims(b: Uint8Array, dv: DataView): Dimensions | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !sig.every((v, i) => b[i] === v)) return null;
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

function jpegDims(b: Uint8Array, dv: DataView): Dimensions | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2;
  while (o + 9 <= b.length) {
    if (b[o] !== 0xff) return null;
    const marker = b[o + 1];
    // SOF0–SOF15 carry dimensions (except DHT/JPG/DAC markers C4, C8, CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: dv.getUint16(o + 5), width: dv.getUint16(o + 7) };
    }
    o += 2 + dv.getUint16(o + 2); // skip segment (length includes itself)
  }
  return null;
}

function webpDims(b: Uint8Array, dv: DataView): Dimensions | null {
  const tag = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (b.length < 30 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return null;
  const chunk = tag(12);
  if (chunk === 'VP8X') {
    const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { width: w, height: h };
  }
  if (chunk === 'VP8 ') {
    // Lossy: 3-byte frame tag, 3-byte sync code, then 14-bit dimensions LE.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

/** Parse width/height from jpeg/png/webp bytes; null if unrecognizable. */
export function imageDimensions(bytes: Uint8Array): Dimensions | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    return pngDims(bytes, dv) ?? jpegDims(bytes, dv) ?? webpDims(bytes, dv);
  } catch {
    return null; // truncated buffer mid-parse
  }
}

export interface PhotoInput { type: string; size: number; bytes: Uint8Array; }

export function validatePhoto(
  input: PhotoInput,
): { ok: true; width: number; height: number } | { error: string } {
  if (!ALLOWED_TYPES.includes(input.type)) {
    return { error: 'Photo must be a JPEG, PNG, or WebP image' };
  }
  if (input.size > MAX_PHOTO_BYTES) {
    return { error: 'Photo is too large (10 MB max)' };
  }
  const dims = imageDimensions(input.bytes);
  if (!dims) return { error: 'That file does not look like a valid image' };
  if (Math.min(dims.width, dims.height) < MIN_SHORT_EDGE) {
    return { error: `Photo is too small — at least ${MIN_SHORT_EDGE}px on the short side keeps the hero sharp` };
  }
  return { ok: true, ...dims };
}
