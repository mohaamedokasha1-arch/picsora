/**
 * DPI (dots-per-inch) metadata reader/writer for JPEG and PNG — pure byte
 * manipulation, fully local.
 *
 * Honesty matters here: DPI metadata never changes a single pixel. It only
 * tells printers and layout software how large the image should appear on
 * paper (physical size = pixels ÷ DPI). The UI must always show pixel
 * dimensions alongside the DPI value so users understand the difference.
 */

export interface DpiInfo {
  dpiX: number;
  dpiY: number;
  /** Where the value came from (or 'none' when the file stores nothing). */
  source: 'jfif' | 'exif' | 'phys' | 'none';
}

const DEFAULT_DPI = 72;

/**
 * Read DPI metadata from JPEG (JFIF APP0 / EXIF) or PNG (pHYs) bytes.
 * Returns null for unsupported formats.
 */
export function readDpi(bytes: Uint8Array, format: 'jpg' | 'jpeg' | 'png'): DpiInfo | null {
  try {
    if (format === 'png') return readPngDpi(bytes);
    return readJpegDpi(bytes);
  } catch {
    return { dpiX: DEFAULT_DPI, dpiY: DEFAULT_DPI, source: 'none' };
  }
}

function readPngDpi(bytes: Uint8Array): DpiInfo {
  const none: DpiInfo = { dpiX: DEFAULT_DPI, dpiY: DEFAULT_DPI, source: 'none' };
  if (bytes.length < 33) return none;
  // Skip the 8-byte signature + IHDR chunk (25 bytes total).
  let pos = 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let guard = 0; guard < 64 && pos + 12 <= bytes.length; guard += 1) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    if (!Number.isFinite(length) || length > bytes.length) return none;
    if (type === 'pHYs' && length === 9 && pos + 12 + 9 <= bytes.length) {
      const ppux = view.getUint32(pos + 8);
      const ppuy = view.getUint32(pos + 12);
      const unit = bytes[pos + 16];
      if (unit === 1 && ppux > 0 && ppuy > 0) {
        return { dpiX: Math.round(ppux * 0.0254), dpiY: Math.round(ppuy * 0.0254), source: 'phys' };
      }
      return none;
    }
    if (type === 'IDAT' || type === 'IEND') return none;
    pos += 12 + length;
  }
  return none;
}

function readJpegDpi(bytes: Uint8Array): DpiInfo {
  const none: DpiInfo = { dpiX: DEFAULT_DPI, dpiY: DEFAULT_DPI, source: 'none' };
  if (bytes.length < 20 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return none;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 2;
  for (let guard = 0; guard < 32 && pos + 4 <= bytes.length; guard += 1) {
    if (bytes[pos] !== 0xff) return none;
    const marker = bytes[pos + 1];
    if (marker === 0xda || marker === 0xd9) return none; // start of scan / end
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      pos += 2;
      continue;
    }
    const segLen = view.getUint16(pos + 2);
    if (segLen < 2 || pos + 2 + segLen > bytes.length) return none;
    if (marker === 0xe0 && segLen >= 14) {
      // APP0 JFIF: "JFIF\0" + version(2) + units(1) + xDensity(2) + yDensity(2)
      const id = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
      if (id === 'JFIF') {
        const units = bytes[pos + 11];
        const x = view.getUint16(pos + 12);
        const y = view.getUint16(pos + 14);
        if (units === 1 && x > 0 && y > 0) return { dpiX: x, dpiY: y, source: 'jfif' };
        if (units === 2 && x > 0 && y > 0) {
          return { dpiX: Math.round(x * 2.54), dpiY: Math.round(y * 2.54), source: 'jfif' };
        }
        return none;
      }
    }
    pos += 2 + segLen;
  }
  return none;
}

/**
 * Write DPI metadata into JPEG (JFIF APP0) or PNG (pHYs) bytes.
 * Pixel data is copied untouched — only metadata changes. Throws
 * `dpi-write-failed` when the file structure is unexpected.
 */
export function writeDpi(bytes: Uint8Array, format: 'jpg' | 'jpeg' | 'png', dpi: number): Uint8Array {
  const rounded = Math.max(1, Math.min(2400, Math.round(dpi)));
  if (!Number.isFinite(rounded)) throw new Error('dpi-write-failed');
  return format === 'png' ? writePngDpi(bytes, rounded) : writeJpegDpi(bytes, rounded);
}

function writePngDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (bytes.length < 33) throw new Error('dpi-write-failed');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let physAt = -1;
  let physLen = 0;
  let idatAt = -1;
  for (let guard = 0; guard < 64 && pos + 12 <= bytes.length; guard += 1) {
    const length = view.getUint32(pos);
    if (!Number.isFinite(length) || length > bytes.length) throw new Error('dpi-write-failed');
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    if (type === 'pHYs') {
      physAt = pos;
      physLen = length;
      break;
    }
    if (type === 'IDAT') {
      idatAt = pos;
      break;
    }
    if (type === 'IEND') throw new Error('dpi-write-failed');
    pos += 12 + length;
  }

  // pHYs chunk: length(9) + "pHYs" + ppux(4) + ppuy(4) + unit(1) + crc(4)
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const cview = new DataView(chunk.buffer);
  cview.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
  cview.setUint32(8, ppm);
  cview.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  cview.setUint32(17, crc32(chunk.subarray(4, 17)));

  if (physAt >= 0) {
    const out = new Uint8Array(bytes.length - (12 + physLen) + chunk.length);
    out.set(bytes.subarray(0, physAt), 0);
    out.set(chunk, physAt);
    out.set(bytes.subarray(physAt + 12 + physLen), physAt + chunk.length);
    return out;
  }
  if (idatAt < 0) throw new Error('dpi-write-failed');
  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.subarray(0, idatAt), 0);
  out.set(chunk, idatAt);
  out.set(bytes.subarray(idatAt), idatAt + chunk.length);
  return out;
}

function writeJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('dpi-write-failed');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // If a JFIF APP0 segment already exists, patch its density fields in place.
  if (bytes[2] === 0xff && bytes[3] === 0xe0 && bytes.length >= 20) {
    const segLen = view.getUint16(4);
    const id = String.fromCharCode(bytes[6], bytes[7], bytes[8], bytes[9]);
    if (id === 'JFIF' && segLen >= 14 && 2 + segLen <= bytes.length) {
      const out = new Uint8Array(bytes);
      const oview = new DataView(out.buffer);
      out[13] = 1; // units: dots per inch
      oview.setUint16(14, dpi);
      oview.setUint16(16, dpi);
      return out;
    }
  }
  // Otherwise insert a fresh JFIF APP0 segment right after SOI.
  const app0 = new Uint8Array(18);
  app0.set([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x01], 0);
  const aview = new DataView(app0.buffer);
  aview.setUint16(12, dpi);
  aview.setUint16(14, dpi);
  app0[16] = 0;
  app0[17] = 0;
  const out = new Uint8Array(bytes.length + app0.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(bytes.subarray(2), 2 + app0.length);
  return out;
}

/** Physical print size in centimetres for pixel dimensions at a DPI. */
export function printSizeCm(px: number, dpi: number): number {
  if (!Number.isFinite(px) || !Number.isFinite(dpi) || dpi <= 0) return 0;
  return (px / dpi) * 2.54;
}

/* ------------------------------------------------------- CRC-32 (PNG) */

let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      // eslint-disable-next-line no-bitwise
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    // eslint-disable-next-line no-bitwise
    table[n] = c >>> 0;
  }
  CRC_TABLE = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = crcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  // eslint-disable-next-line no-bitwise
  return (crc ^ 0xffffffff) >>> 0;
}
