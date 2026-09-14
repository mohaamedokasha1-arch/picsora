/**
 * Extract the images embedded inside a PDF — locally, with pdf-lib only.
 *
 * Most PDFs store photos as DCTDecode (JPEG) streams: those are lifted out
 * byte-for-byte, so the downloaded file is the untouched original. Flate,
 * ASCII85 and uncompressed image streams are inflated and rebuilt as PNG from
 * their raw samples (8/4/2/1 bits per component, Gray / RGB / CMYK / Indexed).
 * Anything the browser cannot decode (JPX/JPEG2000, CCITT fax, JBIG2) is
 * counted — never silently dropped.
 */

import { loadDocument, loadPdfLib, PdfError } from './index';

export interface ExtractedPdfImage {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  sizeBytes: number;
  blob: Blob;
}

export interface ExtractImagesResult {
  images: ExtractedPdfImage[];
  /** Streams that could not be decoded in the browser (JPX, CCITT, JBIG2…). */
  skipped: number;
}

interface ColorInfo {
  components: number;
  kind: 'rgb' | 'gray' | 'cmyk' | 'indexed';
  palette?: Uint8Array;
  paletteComponents?: number;
}

const nameOf = (value: unknown): string => String(value).replace(/^\//, '');

/* ------------------------------------------------------------- decoding */

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new PdfError('pdfRenderFailed');
  const stream = new Blob([data.slice().buffer]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** ASCII85 (PDF flavour) → bytes. Tolerates whitespace and `~>` terminators. */
export function ascii85Decode(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  let tuple = 0;
  let count = 0;
  for (let i = 0; i < input.length; i += 1) {
    const code = input[i];
    if (code === 0x7e) break; // '~'
    if (code <= 0x20) continue; // whitespace
    if (code === 0x7a && count === 0) {
      out.push(0, 0, 0, 0); // 'z' → four zero bytes
      continue;
    }
    if (code < 0x21 || code > 0x75) continue; // '!'..'u'
    tuple = tuple * 85 + (code - 33);
    count += 1;
    if (count === 5) {
      out.push((tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff);
      tuple = 0;
      count = 0;
    }
  }
  if (count > 0) {
    for (let i = count; i < 5; i += 1) tuple = tuple * 85 + 84;
    const bytes = [(tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff];
    out.push(...bytes.slice(0, count - 1));
  }
  return new Uint8Array(out);
}

/** Reverse the PNG predictors applied before deflate (Predictor ≥ 10). */
export function undoPngPredictor(
  data: Uint8Array,
  columns: number,
  colors: number,
  bpc: number,
): Uint8Array {
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8));
  const rowLength = Math.ceil((colors * bpc * columns) / 8);
  const rows = Math.floor(data.length / (rowLength + 1));
  if (rows < 1) return data;
  const out = new Uint8Array(rows * rowLength);
  let prev = new Uint8Array(rowLength);
  for (let row = 0; row < rows; row += 1) {
    const type = data[row * (rowLength + 1)];
    const start = row * (rowLength + 1) + 1;
    const line = new Uint8Array(rowLength);
    for (let i = 0; i < rowLength; i += 1) {
      const raw = data[start + i];
      const left = i >= bpp ? line[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let value = raw;
      if (type === 1) value = raw + left;
      else if (type === 2) value = raw + up;
      else if (type === 3) value = raw + ((left + up) >> 1);
      else if (type === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = raw + predictor;
      }
      line[i] = value & 0xff;
    }
    out.set(line, row * rowLength);
    prev = line;
  }
  return out;
}

/** Read one sample (bit-packed components included) out of a row buffer. */
function sampleAt(data: Uint8Array, index: number, bpc: number): number {
  if (bpc === 8) return data[index];
  if (bpc === 16) return data[index * 2]; // high byte is plenty for display
  const perByte = 8 / bpc;
  const byte = data[Math.floor(index / perByte)];
  const shift = 8 - bpc * ((index % perByte) + 1);
  const mask = (1 << bpc) - 1;
  const raw = (byte >> shift) & mask;
  return Math.round((raw * 255) / mask);
}

/** Turn raw samples into RGBA pixels the canvas can display. */
export function samplesToRgba(
  raw: Uint8Array,
  width: number,
  height: number,
  bpc: number,
  color: ColorInfo,
): Uint8ClampedArray | null {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const pixels = width * height;

  if (color.kind === 'indexed') {
    const palette = color.palette;
    const components = color.paletteComponents ?? 3;
    if (!palette || bpc > 8) return null;
    for (let i = 0; i < pixels; i += 1) {
      const index = bpc === 8 ? raw[i] : sampleAt(raw, i, bpc);
      const base = index * components;
      rgba[i * 4] = palette[base] ?? 0;
      rgba[i * 4 + 1] = palette[base + 1] ?? palette[base] ?? 0;
      rgba[i * 4 + 2] = palette[base + 2] ?? palette[base] ?? 0;
      rgba[i * 4 + 3] = 255;
    }
    return rgba;
  }

  if (color.kind === 'gray') {
    for (let i = 0; i < pixels; i += 1) {
      const value = bpc === 8 ? raw[i] : sampleAt(raw, i, bpc);
      rgba[i * 4] = value;
      rgba[i * 4 + 1] = value;
      rgba[i * 4 + 2] = value;
      rgba[i * 4 + 3] = 255;
    }
    return rgba;
  }

  if (color.kind === 'cmyk') {
    for (let i = 0; i < pixels; i += 1) {
      const c = raw[i * 4] / 255;
      const m = raw[i * 4 + 1] / 255;
      const y = raw[i * 4 + 2] / 255;
      const k = raw[i * 4 + 3] / 255;
      rgba[i * 4] = 255 * (1 - c) * (1 - k);
      rgba[i * 4 + 1] = 255 * (1 - m) * (1 - k);
      rgba[i * 4 + 2] = 255 * (1 - y) * (1 - k);
      rgba[i * 4 + 3] = 255;
    }
    return rgba;
  }

  const step = color.components;
  for (let i = 0; i < pixels; i += 1) {
    if (bpc === 8) {
      rgba[i * 4] = raw[i * step];
      rgba[i * 4 + 1] = raw[i * step + 1];
      rgba[i * 4 + 2] = raw[i * step + 2];
    } else {
      rgba[i * 4] = sampleAt(raw, i * step, bpc);
      rgba[i * 4 + 1] = sampleAt(raw, i * step + 1, bpc);
      rgba[i * 4 + 2] = sampleAt(raw, i * step + 2, bpc);
    }
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

function rgbaToPngBlob(rgba: Uint8ClampedArray, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new PdfError('pdfRenderFailed'));
      return;
    }
    // createImageData (not `new ImageData`) — same result in every browser and
    // in the node canvas shim used by the test suite.
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new PdfError('pdfRenderFailed'));
    }, 'image/png');
  });
}

/* ------------------------------------------------------------- extraction */

/** Safety net: never hand a giant canvas to the browser. */
const MAX_PIXELS = 40_000_000;

export async function extractPdfImages(
  bytes: Uint8Array,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractImagesResult> {
  const { PDFRawStream, PDFName, PDFArray, PDFRef, PDFNumber } = await loadPdfLib();
  const doc = await loadDocument(bytes);
  const context = doc.context;
  const objects = context.enumerateIndirectObjects();
  const images: ExtractedPdfImage[] = [];
  let skipped = 0;

  const resolve = (obj: unknown): unknown => (obj instanceof PDFRef ? context.lookup(obj) : obj);
  /** Resolve a numeric entry of any PDF dictionary-like object. */
  const readNumber = (getter: (name: unknown) => unknown, key: string): number | null => {
    const value = resolve(getter(PDFName.of(key)));
    return value instanceof PDFNumber ? value.asNumber() : null;
  };

  const analyzeColorSpace = (raw: unknown): ColorInfo | null => {
    const value = resolve(raw);
    if (!value) return null;
    if (value instanceof PDFName) {
      const name = nameOf(value);
      if (name === 'DeviceRGB' || name === 'CalRGB') return { components: 3, kind: 'rgb' };
      if (name === 'DeviceGray' || name === 'CalGray') return { components: 1, kind: 'gray' };
      if (name === 'DeviceCMYK') return { components: 4, kind: 'cmyk' };
      return null;
    }
    if (Array.isArray(value) || typeof (value as { size?: unknown }).size === 'function') {
      const array = value as { size: () => number; get: (i: number) => unknown };
      const kind = nameOf(resolve(array.get(0)));
      if (kind === 'Indexed' || kind === 'I') {
        const base = analyzeColorSpace(array.get(1));
        const lookupObj = resolve(array.get(3));
        let palette: Uint8Array | null = null;
        if (lookupObj && typeof (lookupObj as { asUint8Array?: unknown }).asUint8Array === 'function') {
          palette = (lookupObj as { asUint8Array: () => Uint8Array }).asUint8Array();
        } else {
          const text = String(lookupObj ?? '');
          if (text) {
            palette = new Uint8Array(text.length);
            for (let i = 0; i < text.length; i += 1) palette[i] = text.charCodeAt(i) & 0xff;
          }
        }
        if (!palette || !base) return null;
        return {
          components: 1,
          kind: 'indexed',
          palette,
          paletteComponents: base.kind === 'gray' ? 1 : base.components,
        };
      }
      if (kind === 'ICCBased') {
        const profile = resolve(array.get(1)) as { dict?: { get: (n: unknown) => unknown } } | null;
        const n = profile?.dict ? resolve(profile.dict.get(PDFName.of('N'))) : null;
        const count = n instanceof PDFNumber ? n.asNumber() : 3;
        if (count === 1) return { components: 1, kind: 'gray' };
        if (count === 4) return { components: 4, kind: 'cmyk' };
        return { components: 3, kind: 'rgb' };
      }
      if (kind === 'CalRGB') return { components: 3, kind: 'rgb' };
      if (kind === 'CalGray') return { components: 1, kind: 'gray' };
    }
    return null;
  };

  const candidates = objects.filter(([, obj]) => obj instanceof PDFRawStream);
  let done = 0;

  for (const [ref, obj] of candidates) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    const subtype = dict.get(PDFName.of('Subtype'));
    done += 1;
    onProgress?.(done, candidates.length);
    if (!subtype || nameOf(subtype) !== 'Image') continue;

    const readDictNumber = (key: string) => readNumber((name) => dict.get(name as never), key);
    const width = readDictNumber('Width');
    const height = readDictNumber('Height');
    if (!width || !height || width * height > MAX_PIXELS) {
      skipped += 1;
      continue;
    }

    const filterValue = resolve(dict.get(PDFName.of('Filter')));
    const filters: string[] = [];
    if (filterValue instanceof PDFName) filters.push(nameOf(filterValue));
    else if (filterValue instanceof PDFArray) {
      for (let i = 0; i < filterValue.size(); i += 1) filters.push(nameOf(resolve(filterValue.get(i))));
    }

    const index = images.length + 1;
    const id = String(ref);

    // Already-compressed JPEG: lift the bytes out untouched.
    if (filters[filters.length - 1] === 'DCTDecode') {
      const blob = new Blob([obj.getContents().slice().buffer], { type: 'image/jpeg' });
      images.push({
        id,
        name: `image-${String(index).padStart(2, '0')}.jpg`,
        mime: 'image/jpeg',
        width,
        height,
        sizeBytes: blob.size,
        blob,
      });
      continue;
    }

    const decodable = filters.every((f) => ['FlateDecode', 'ASCII85Decode', 'Fl'].includes(f)) && filters.length <= 2;
    if (!decodable) {
      skipped += 1;
      continue;
    }

    try {
      // Explicitly widened: the decoders below all return plain Uint8Array.
      let raw: Uint8Array = obj.getContents().slice();
      for (let i = filters.length - 1; i >= 0; i -= 1) {
        if (filters[i] === 'ASCII85Decode') raw = ascii85Decode(raw);
        else if (filters[i] === 'FlateDecode' || filters[i] === 'Fl') raw = await inflate(raw);
      }

      const bpc = readDictNumber('BitsPerComponent') ?? 8;
      const color = analyzeColorSpace(dict.get(PDFName.of('ColorSpace')));
      if (!color) {
        skipped += 1;
        continue;
      }

      // Undo PNG predictors when the stream declares them.
      const parmsRaw = resolve(dict.get(PDFName.of('DecodeParms'))) ?? resolve(dict.get(PDFName.of('DP')));
      const parmsGet =
        parmsRaw && typeof (parmsRaw as { get?: unknown }).get === 'function'
          ? (parmsRaw as { get: (name: unknown) => unknown }).get.bind(parmsRaw)
          : null;
      if (parmsGet) {
        const predictor = resolve(parmsGet(PDFName.of('Predictor')));
        if (predictor instanceof PDFNumber && predictor.asNumber() >= 10) {
          const columns = readNumber(parmsGet, 'Columns') ?? width;
          const colors = readNumber(parmsGet, 'Colors') ?? color.components;
          const bits = readNumber(parmsGet, 'BitsPerComponent') ?? bpc;
          raw = undoPngPredictor(raw, columns, colors, bits);
        }
      }

      const expected = Math.ceil((width * height * color.components * bpc) / 8);
      if (raw.length + 8 < expected) {
        skipped += 1;
        continue;
      }

      const rgba = samplesToRgba(raw, width, height, bpc, color);
      if (!rgba) {
        skipped += 1;
        continue;
      }
      const blob = await rgbaToPngBlob(rgba, width, height);
      images.push({
        id,
        name: `image-${String(index).padStart(2, '0')}.png`,
        mime: 'image/png',
        width,
        height,
        sizeBytes: blob.size,
        blob,
      });
    } catch {
      skipped += 1;
    }
  }

  // Largest first — that is almost always what people are looking for.
  images.sort((a, b) => b.width * b.height - a.width * a.height);
  images.forEach((image, i) => {
    const ext = image.mime === 'image/jpeg' ? 'jpg' : 'png';
    image.name = `image-${String(i + 1).padStart(2, '0')}.${ext}`;
  });

  return { images, skipped };
}
