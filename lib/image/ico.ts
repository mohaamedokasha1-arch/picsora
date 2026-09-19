/**
 * ICO (Windows icon) encoder + decoder — pure byte manipulation, no
 * dependencies, fully local.
 *
 * Encoding writes PNG-compressed entries (supported by every browser and
 * every Windows version since Vista), one per requested size.
 *
 * Decoding understands PNG-compressed entries plus classic 32-bit
 * uncompressed BMP entries (BI_RGB with an alpha channel), which together
 * cover virtually every real-world favicon.ico file.
 */

export interface IcoEntry {
  width: number;
  height: number;
  /** Raw entry bytes (a PNG file or a BMP DIB). */
  bytes: Uint8Array;
  /** 'png' for PNG-compressed entries, 'bmp' for classic DIB entries. */
  kind: 'png' | 'bmp';
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < PNG_MAGIC.length; i += 1) {
    if (bytes[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Build a multi-image `.ico` file from PNG blobs (one per icon size).
 * Throws `ico-encode-failed` on invalid input.
 */
export async function buildIco(pngs: { size: number; blob: Blob }[]): Promise<Blob> {
  if (!pngs.length || pngs.length > 16) throw new Error('ico-encode-failed');
  const parts: { size: number; bytes: Uint8Array }[] = [];
  for (const { size, blob } of pngs) {
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error('ico-encode-failed');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!isPng(bytes)) throw new Error('ico-encode-failed');
    if (bytes.length > 16 * 1024 * 1024) throw new Error('ico-encode-failed');
    parts.push({ size, bytes });
  }

  const headerSize = 6 + parts.length * 16;
  let total = headerSize;
  for (const p of parts) total += p.bytes.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, parts.length, true); // count

  let offset = headerSize;
  parts.forEach((p, i) => {
    const at = 6 + i * 16;
    out[at] = p.size >= 256 ? 0 : p.size;
    out[at + 1] = p.size >= 256 ? 0 : p.size;
    out[at + 2] = 0; // palette
    out[at + 3] = 0; // reserved
    view.setUint16(at + 4, 1, true); // planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, p.bytes.length, true);
    view.setUint32(at + 12, offset, true);
    out.set(p.bytes, offset);
    offset += p.bytes.length;
  });

  return new Blob([out.buffer as ArrayBuffer], { type: 'image/vnd.microsoft.icon' });
}

/** Parse an `.ico`/`.cur` file into its entries. Throws `ico-decode-failed`. */
export function parseIco(data: Uint8Array): IcoEntry[] {
  if (data.length < 6) throw new Error('ico-decode-failed');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const reserved = view.getUint16(0, true);
  const type = view.getUint16(2, true);
  const count = view.getUint16(4, true);
  if (reserved !== 0 || (type !== 1 && type !== 2) || count < 1 || count > 64) {
    throw new Error('ico-decode-failed');
  }
  if (data.length < 6 + count * 16) throw new Error('ico-decode-failed');

  const entries: IcoEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = 6 + i * 16;
    const width = data[at] === 0 ? 256 : data[at];
    const height = data[at + 1] === 0 ? 256 : data[at + 1];
    const bytesLen = view.getUint32(at + 8, true);
    const bytesOffset = view.getUint32(at + 12, true);
    // Bounds-check every entry against the real file size (never trust the
    // header of a user-supplied file).
    if (
      !Number.isFinite(bytesLen) ||
      !Number.isFinite(bytesOffset) ||
      bytesLen < 8 ||
      bytesLen > data.length ||
      bytesOffset > data.length - bytesLen
    ) {
      continue;
    }
    const bytes = data.slice(bytesOffset, bytesOffset + bytesLen);
    entries.push({ width, height, bytes, kind: isPng(bytes) ? 'png' : 'bmp' });
  }
  if (!entries.length) throw new Error('ico-decode-failed');
  return entries;
}

/**
 * Decode a classic 32-bit BMP (DIB) ICO entry into PNG bytes via canvas.
 * Only BI_RGB 32bpp is supported — the only BMP flavour worth handling for
 * icons (older bit depths are vanishingly rare and never carry alpha).
 */
export async function bmpEntryToPng(entry: IcoEntry): Promise<Blob> {
  if (entry.kind !== 'bmp') throw new Error('ico-decode-failed');
  const data = entry.bytes;
  if (data.length < 54) throw new Error('ico-decode-failed');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const headerSize = view.getUint32(0, true);
  const width = view.getInt32(4, true);
  const doubleHeight = view.getInt32(8, true);
  const planes = view.getUint16(12, true);
  const bpp = view.getUint16(14, true);
  const compression = view.getUint32(16, true);
  if (headerSize < 40 || width <= 0 || width > 1024 || planes !== 1 || bpp !== 32 || compression !== 0) {
    throw new Error('ico-decode-failed');
  }
  // The DIB height is XOR (colour) + AND (mask) stacked; the real height is half.
  const height = Math.floor(doubleHeight / 2);
  if (height <= 0 || height > 1024) throw new Error('ico-decode-failed');

  const rowBytes = width * 4;
  const pixelStart = headerSize;
  const pixelLen = rowBytes * height;
  // AND mask: 1 bit per pixel, rows padded to 32 bits. We only need to know
  // it exists inside the buffer; the alpha channel of the 32-bit XOR data
  // carries the real transparency.
  const maskRowBytes = Math.floor((width + 31) / 32) * 4;
  if (pixelStart + pixelLen + maskRowBytes * height > data.length + maskRowBytes * height) {
    // Lenient: some encoders truncate the mask; the colour data is what matters.
    if (pixelStart + pixelLen > data.length) throw new Error('ico-decode-failed');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  const image = ctx.createImageData(width, height);
  // BMP rows are stored bottom-up in B,G,R,A order.
  for (let y = 0; y < height; y += 1) {
    const srcRow = height - 1 - y;
    const srcAt = pixelStart + srcRow * rowBytes;
    for (let x = 0; x < width; x += 1) {
      const s = srcAt + x * 4;
      const d = (y * width + x) * 4;
      image.data[d] = data[s + 2];
      image.data[d + 1] = data[s + 1];
      image.data[d + 2] = data[s];
      image.data[d + 3] = data[s + 3];
    }
  }
  ctx.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error('ico-decode-failed');
  return blob;
}

/**
 * Extract the largest entry of an ICO file as a PNG Blob (best quality for
 * conversion to PNG/JPG/WebP). Prefers PNG entries, falls back to 32-bit BMP.
 */
export async function icoToPngBlob(data: Uint8Array): Promise<{ blob: Blob; width: number; height: number }> {
  const entries = parseIco(data);
  const pngs = entries.filter((e) => e.kind === 'png').sort((a, b) => b.width * b.height - a.width * a.height);
  if (pngs.length) {
    const best = pngs[0];
    const copy = new Uint8Array(best.bytes.length);
    copy.set(best.bytes);
    return {
      blob: new Blob([copy.buffer as ArrayBuffer], { type: 'image/png' }),
      width: best.width,
      height: best.height,
    };
  }
  const bmps = entries.filter((e) => e.kind === 'bmp').sort((a, b) => b.width * b.height - a.width * a.height);
  for (const entry of bmps) {
    try {
      const blob = await bmpEntryToPng(entry);
      return { blob, width: entry.width, height: entry.height };
    } catch {
      /* try the next entry */
    }
  }
  throw new Error('ico-decode-failed');
}
