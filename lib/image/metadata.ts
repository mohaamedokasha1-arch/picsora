/**
 * Local image metadata reader: file facts (name, type, size, dimensions) plus
 * the EXIF fields cameras embed in photos — including GPS.
 *
 * Everything is parsed from the first few megabytes of the file in the
 * browser: JPEG (APP1/Exif), PNG (eXIf + IHDR), WebP (EXIF + VP8X) and GIF.
 * No dependency, no upload, no server round-trip.
 */

export interface MetadataEntry {
  /** Translation-agnostic key: the UI maps it to a human label. */
  key: string;
  /** Already-formatted, human readable value (numbers/units baked in). */
  value: string;
}

export interface GpsPosition {
  latitude: number;
  longitude: number;
  /** e.g. "37.7749, -122.4194" — ready to copy into a map. */
  label: string;
  altitude?: number;
}

export interface ImageMetadataReport {
  fileName: string;
  fileType: string;
  fileSize: number;
  lastModified: number;
  width: number;
  height: number;
  megapixels: number;
  aspectRatio: string;
  /** Well-known EXIF fields, in a stable display order. */
  exif: MetadataEntry[];
  /** Every remaining EXIF tag that has no friendly label. */
  extra: MetadataEntry[];
  gps?: GpsPosition;
}

/** Bytes we are willing to scan — EXIF/metadata always sits at the front. */
const MAX_SCAN_BYTES = 4 * 1024 * 1024;

/* ------------------------------------------------------------ TIFF/EXIF */

const TAG_LABELS: Record<number, string> = {
  0x0100: 'imageWidth',
  0x0101: 'imageHeight',
  0x010e: 'description',
  0x010f: 'cameraMake',
  0x0110: 'cameraModel',
  0x0112: 'orientation',
  0x011a: 'xResolution',
  0x011b: 'yResolution',
  0x0128: 'resolutionUnit',
  0x0131: 'software',
  0x0132: 'dateTime',
  0x013b: 'artist',
  0x8298: 'copyright',
  0x829a: 'exposureTime',
  0x829d: 'fNumber',
  0x8822: 'exposureProgram',
  0x8827: 'iso',
  0x9000: 'exifVersion',
  0x9003: 'dateTimeOriginal',
  0x9004: 'dateTimeDigitized',
  0x9201: 'shutterSpeed',
  0x9204: 'exposureBias',
  0x9205: 'maxAperture',
  0x9207: 'meteringMode',
  0x9209: 'flash',
  0x920a: 'focalLength',
  0x9286: 'userComment',
  0xa001: 'colorSpace',
  0xa002: 'pixelXDimension',
  0xa003: 'pixelYDimension',
  0xa402: 'exposureMode',
  0xa403: 'whiteBalance',
  0xa405: 'focalLength35mm',
  0xa432: 'lensSpecification',
  0xa433: 'lensMake',
  0xa434: 'lensModel',
};

/** Display order for the friendly fields (unknown ones keep tag order). */
const DISPLAY_ORDER: string[] = [
  'description',
  'cameraMake',
  'cameraModel',
  'lensModel',
  'lensMake',
  'lensSpecification',
  'dateTimeOriginal',
  'dateTimeDigitized',
  'dateTime',
  'exposureTime',
  'fNumber',
  'iso',
  'exposureProgram',
  'exposureBias',
  'meteringMode',
  'flash',
  'focalLength',
  'focalLength35mm',
  'maxAperture',
  'whiteBalance',
  'exposureMode',
  'colorSpace',
  'orientation',
  'xResolution',
  'yResolution',
  'resolutionUnit',
  'software',
  'artist',
  'copyright',
  'userComment',
  'imageWidth',
  'imageHeight',
];

type ExifValue = string | number | number[] | { num: number; den: number }[] | { num: number; den: number };

interface RawEntry {
  tag: number;
  value: ExifValue;
}

function orientationText(value: number): string {
  const map: Record<number, string> = {
    1: 'normal',
    2: 'mirrored',
    3: 'rotated180',
    4: 'mirroredVertical',
    5: 'mirroredRotated90',
    6: 'rotated90',
    7: 'mirroredRotated270',
    8: 'rotated270',
  };
  return map[value] ?? String(value);
}

function flashText(value: number): string {
  if ((value & 0x20) === 0) return 'noFlash';
  return value & 0x1 ? 'flashFired' : 'flashNotFired';
}

function exposureProgramText(value: number): string {
  const map: Record<number, string> = {
    0: 'notDefined',
    1: 'manual',
    2: 'program',
    3: 'aperturePriority',
    4: 'shutterPriority',
    5: 'creative',
    6: 'action',
    7: 'portrait',
    8: 'landscape',
  };
  return map[value] ?? String(value);
}

function meteringText(value: number): string {
  const map: Record<number, string> = {
    0: 'unknown',
    1: 'average',
    2: 'centerWeighted',
    3: 'spot',
    4: 'multiSpot',
    5: 'pattern',
    6: 'partial',
  };
  return map[value] ?? String(value);
}

function rationalToNumber(value: { num: number; den: number }): number {
  if (!value || value.den === 0) return 0;
  return value.num / value.den;
}

/** Render one EXIF tag as a display string. */
export function formatExifValue(key: string, value: ExifValue): string {
  const first = Array.isArray(value) ? value[0] : value;
  switch (key) {
    case 'exposureTime': {
      const r = first as { num: number; den: number };
      const seconds = rationalToNumber(r);
      if (!seconds) return String(value);
      if (seconds >= 1) return `${Number(seconds.toFixed(2))} s`;
      return `1/${Math.round(1 / seconds)} s`;
    }
    case 'shutterSpeed': {
      const apex = typeof first === 'number' ? first : rationalToNumber(first as { num: number; den: number });
      const seconds = Math.pow(2, -apex);
      return seconds >= 1 ? `${Number(seconds.toFixed(2))} s` : `1/${Math.round(1 / seconds)} s`;
    }
    case 'fNumber':
      return `f/${Number(rationalToNumber(first as { num: number; den: number }).toFixed(1))}`;
    case 'maxAperture': {
      const apex = rationalToNumber(first as { num: number; den: number });
      return `f/${Number(Math.pow(Math.SQRT2, apex).toFixed(1))}`;
    }
    case 'focalLength':
      return `${Number(rationalToNumber(first as { num: number; den: number }).toFixed(1))} mm`;
    case 'focalLength35mm':
      return `${first} mm (35 mm)`;
    case 'exposureBias': {
      const v = rationalToNumber(first as { num: number; den: number });
      return `${v > 0 ? '+' : ''}${Number(v.toFixed(2))} EV`;
    }
    case 'iso':
      return `ISO ${first}`;
    case 'orientation':
      return orientationText(Number(first));
    case 'flash':
      return flashText(Number(first));
    case 'exposureProgram':
      return exposureProgramText(Number(first));
    case 'meteringMode':
      return meteringText(Number(first));
    case 'resolutionUnit':
      return Number(first) === 3 ? 'dpi (cm)' : Number(first) === 2 ? 'dpi' : 'none';
    case 'xResolution':
    case 'yResolution':
      return `${Number(rationalToNumber(first as { num: number; den: number }).toFixed(0))}`;
    case 'lensSpecification':
      return (value as { num: number; den: number }[])
        .map((v) => Number(rationalToNumber(v).toFixed(1)))
        .join(' – ');
    case 'colorSpace':
      return Number(first) === 1 ? 'sRGB' : Number(first) === 65535 ? 'Uncalibrated' : String(first);
    case 'exposureMode':
      return Number(first) === 0 ? 'auto' : Number(first) === 1 ? 'manual' : 'bracket';
    case 'whiteBalance':
      return Number(first) === 0 ? 'auto' : 'manual';
    case 'exifVersion':
      return String(first).replace(/\0+$/, '');
    default:
      if (Array.isArray(value)) {
        return value
          .map((v) =>
            typeof v === 'object' ? Number(rationalToNumber(v as { num: number; den: number }).toFixed(2)).toString() : String(v),
          )
          .join(', ');
      }
      if (typeof value === 'object' && value !== null) {
        return Number(rationalToNumber(value as { num: number; den: number }).toFixed(2)).toString();
      }
      return String(value).replace(/\0/g, '').trim();
  }
}

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8, 11: 4, 12: 8 };

/** Parse a TIFF/EXIF block. Returns raw entries for IFD0, the Exif IFD and GPS. */
export function parseExifTiff(bytes: Uint8Array, start: number): { entries: RawEntry[]; gps: RawEntry[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = String.fromCharCode(bytes[start], bytes[start + 1]) === 'II';
  const u16 = (offset: number) => view.getUint16(offset, little);
  const u32 = (offset: number) => view.getUint32(offset, little);

  if (u16(start + 2) !== 42) return { entries: [], gps: [] };

  const readValues = (type: number, count: number, offset: number): ExifValue | null => {
    const size = TYPE_SIZES[type];
    if (!size) return null;
    const total = size * count;
    const dataOffset = total <= 4 ? offset : start + u32(offset);
    if (dataOffset + total > bytes.length) return null;

    if (type === 2) {
      let text = '';
      for (let i = 0; i < count; i += 1) text += String.fromCharCode(bytes[dataOffset + i]);
      return text.replace(/\0+$/, '');
    }
    const numbers: (number | { num: number; den: number })[] = [];
    for (let i = 0; i < count; i += 1) {
      const at = dataOffset + i * size;
      switch (type) {
        case 1:
        case 7:
          numbers.push(bytes[at]);
          break;
        case 3:
          numbers.push(u16(at));
          break;
        case 4:
          numbers.push(u32(at));
          break;
        case 9:
          numbers.push(view.getInt32(at, little));
          break;
        case 5:
          numbers.push({ num: u32(at), den: u32(at + 4) });
          break;
        case 10:
          numbers.push({ num: view.getInt32(at, little), den: view.getInt32(at + 4, little) });
          break;
        default:
          numbers.push(0);
      }
    }
    if (count === 1) return numbers[0] as ExifValue;
    return numbers as ExifValue;
  };

  const readIfd = (ifdOffset: number): { entries: RawEntry[]; next: number } => {
    const out: RawEntry[] = [];
    if (ifdOffset + 2 > bytes.length) return { entries: out, next: 0 };
    const count = u16(ifdOffset);
    for (let i = 0; i < count; i += 1) {
      const entryOffset = ifdOffset + 2 + i * 12;
      if (entryOffset + 12 > bytes.length) break;
      const tag = u16(entryOffset);
      const type = u16(entryOffset + 2);
      const valueCount = u32(entryOffset + 4);
      if (valueCount > 4096) continue;
      const value = readValues(type, valueCount, entryOffset + 8);
      if (value !== null) out.push({ tag, value });
    }
    const next = ifdOffset + 2 + count * 12 + 4 <= bytes.length ? u32(ifdOffset + 2 + count * 12) : 0;
    return { entries: out, next };
  };

  const ifd0Offset = start + u32(start + 4);
  const { entries } = readIfd(ifd0Offset);

  const exifPointer = entries.find((e) => e.tag === 0x8769)?.value;
  const gpsPointer = entries.find((e) => e.tag === 0x8825)?.value;
  const exifEntries = typeof exifPointer === 'number' ? readIfd(start + exifPointer).entries : [];
  const gpsEntries = typeof gpsPointer === 'number' ? readIfd(start + gpsPointer).entries : [];

  return {
    entries: [...entries.filter((e) => e.tag < 0x8769 || e.tag > 0x8825), ...exifEntries],
    gps: gpsEntries,
  };
}

function gpsFrom(entries: RawEntry[]): GpsPosition | undefined {
  const value = (tag: number) => entries.find((e) => e.tag === tag)?.value;
  const toDegrees = (raw: ExifValue, ref: string): number | null => {
    if (!Array.isArray(raw) || raw.length < 3) return null;
    const parts = raw.map((v) => rationalToNumber(v as { num: number; den: number }));
    const [d, m, s] = parts;
    const degrees = d + m / 60 + s / 3600;
    if (!Number.isFinite(degrees)) return null;
    return ref === 'S' || ref === 'W' ? -degrees : degrees;
  };
  const latRef = String(value(1) ?? 'N').trim().toUpperCase();
  const lonRef = String(value(3) ?? 'E').trim().toUpperCase();
  const latitude = toDegrees(value(2) ?? [], latRef);
  const longitude = toDegrees(value(4) ?? [], lonRef);
  if (latitude === null || longitude === null || (latitude === 0 && longitude === 0)) return undefined;
  const altitudeRaw = value(6);
  const altitude = typeof altitudeRaw === 'object' ? rationalToNumber(altitudeRaw as { num: number; den: number }) : undefined;
  return {
    latitude,
    longitude,
    altitude: Number.isFinite(altitude) ? Number(altitude?.toFixed(1)) : undefined,
    label: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
  };
}

/* --------------------------------------------------------------- sniffers */

interface ContainerInfo {
  type?: string;
  width?: number;
  height?: number;
  exifStart?: number;
}

/** Walk the JPEG segment chain looking for the Exif APP1 payload. */
function readJpeg(bytes: Uint8Array): ContainerInfo {
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) break;
    if (marker === 0xe1) {
      const payload = offset + 4;
      if (
        bytes[payload] === 0x45 && // E
        bytes[payload + 1] === 0x78 && // x
        bytes[payload + 2] === 0x69 && // i
        bytes[payload + 3] === 0x66 // f
      ) {
        return { type: 'JPEG', exifStart: payload + 6 };
      }
    }
    if (marker === 0xda) break; // start of scan — no metadata follows
    offset += 2 + length;
  }
  return { type: 'JPEG' };
}

function readPng(bytes: Uint8Array): ContainerInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const info: ContainerInfo = { type: 'PNG' };
  let offset = 8;
  while (offset + 8 < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (type === 'IHDR') {
      info.width = view.getUint32(offset + 8);
      info.height = view.getUint32(offset + 12);
    } else if (type === 'eXIf') {
      info.exifStart = offset + 8;
    }
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  return info;
}

function readWebp(bytes: Uint8Array): ContainerInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const info: ContainerInfo = { type: 'WebP' };
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size = view.getUint32(offset + 4, true);
    if (type === 'VP8X') {
      info.width = 1 + (bytes[offset + 12] | (bytes[offset + 13] << 8) | (bytes[offset + 14] << 16));
      info.height = 1 + (bytes[offset + 15] | (bytes[offset + 16] << 8) | (bytes[offset + 17] << 16));
    } else if (type === 'VP8 ') {
      info.width = view.getUint16(offset + 14, true) & 0x3fff;
      info.height = view.getUint16(offset + 16, true) & 0x3fff;
    } else if (type === 'VP8L') {
      const bits = view.getUint32(offset + 9, true);
      info.width = 1 + (bits & 0x3fff);
      info.height = 1 + ((bits >> 14) & 0x3fff);
    } else if (type === 'EXIF') {
      info.exifStart = offset + 8;
    }
    offset += 8 + size + (size % 2);
  }
  return info;
}

function readGif(bytes: Uint8Array): ContainerInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { type: 'GIF', width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

/** Detect the container from magic bytes and pull out what it holds. */
export function readContainer(bytes: Uint8Array): ContainerInfo {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return readJpeg(bytes);
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return readPng(bytes);
  }
  if (
    bytes.length > 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF' &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP'
  ) {
    return readWebp(bytes);
  }
  if (bytes.length > 10 && String.fromCharCode(bytes[0], bytes[1], bytes[2]) === 'GIF') return readGif(bytes);
  if (bytes.length > 4 && bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a) {
    return { type: 'TIFF', exifStart: 0 };
  }
  return {};
}

/* ----------------------------------------------------------------- public */

/**
 * Read everything we can about an image locally.
 * `width`/`height` come from the already-decoded preview, which is the most
 * reliable source, and act as a fallback when the container is exotic.
 */
export async function readImageMetadata(
  file: File,
  dimensions: { width: number; height: number },
): Promise<ImageMetadataReport> {
  const slice = file.slice(0, Math.min(file.size, MAX_SCAN_BYTES));
  const bytes = new Uint8Array(await slice.arrayBuffer());
  const container = readContainer(bytes);

  let entries: RawEntry[] = [];
  let gpsEntries: RawEntry[] = [];
  if (container.exifStart !== undefined && container.exifStart > 0 && container.exifStart < bytes.length) {
    const parsed = parseExifTiff(bytes, container.exifStart);
    entries = parsed.entries;
    gpsEntries = parsed.gps;
  }

  const width = dimensions.width || container.width || 0;
  const height = dimensions.height || container.height || 0;

  const exif: MetadataEntry[] = [];
  const extra: MetadataEntry[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = TAG_LABELS[entry.tag];
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
      exif.push({ key, value: formatExifValue(key, entry.value) });
    } else {
      extra.push({ key: `0x${entry.tag.toString(16).padStart(4, '0')}`, value: formatExifValue('', entry.value) });
    }
  }
  exif.sort((a, b) => {
    const ai = DISPLAY_ORDER.indexOf(a.key);
    const bi = DISPLAY_ORDER.indexOf(b.key);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const gps = gpsFrom(gpsEntries);

  const ratio = width && height ? greatestCommonRatio(width, height) : '';

  return {
    fileName: file.name,
    fileType: container.type ?? (file.type ? file.type.replace('image/', '').toUpperCase() : 'Unknown'),
    fileSize: file.size,
    lastModified: file.lastModified,
    width,
    height,
    megapixels: width && height ? Number(((width * height) / 1_000_000).toFixed(2)) : 0,
    aspectRatio: ratio,
    exif,
    extra,
    gps,
  };
}

function greatestCommonRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  const w = width / divisor;
  const h = height / divisor;
  // Very long ratios are noise — fall back to a rounded decimal.
  if (w > 50 || h > 50) return (width / height).toFixed(2);
  return `${w}:${h}`;
}

/** Flat, download-friendly JSON representation of the report. */
export function metadataToJson(report: ImageMetadataReport): string {
  const exif: Record<string, string> = {};
  for (const entry of report.exif) exif[entry.key] = entry.value;
  for (const entry of report.extra) exif[entry.key] = entry.value;
  return JSON.stringify(
    {
      file: {
        name: report.fileName,
        type: report.fileType,
        sizeBytes: report.fileSize,
        lastModified: new Date(report.lastModified).toISOString(),
        width: report.width,
        height: report.height,
        megapixels: report.megapixels,
        aspectRatio: report.aspectRatio,
      },
      gps: report.gps
        ? { latitude: report.gps.latitude, longitude: report.gps.longitude, altitude: report.gps.altitude }
        : null,
      exif,
    },
    null,
    2,
  );
}
