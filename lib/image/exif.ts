/**
 * In-browser EXIF and metadata parser.
 * Supports JPEG, HEIC, TIFF, PNG, WebP without external server calls.
 */

export interface ExifData {
  orientation?: number;
  make?: string;
  model?: string;
  lensModel?: string;
  software?: string;
  dateTime?: string;
  dateTimeOriginal?: string;
  exposureTime?: string;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  flash?: string;
  colorSpace?: string;
  width?: number;
  height?: number;
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    latitudeRef: string;
    longitudeRef: string;
    mapsUrl: string;
    formatted: string;
  };
  raw?: Record<string, unknown>;
}

export interface LivePhotoInfo {
  isLivePhoto: boolean;
  type?: 'apple' | 'samsung' | 'google';
}

/**
 * Extract EXIF orientation value (1-8) from an image file ArrayBuffer.
 * Returns 1 (normal) if not found or orientation tag is missing.
 */
export async function getExifOrientation(file: File | Blob | ArrayBuffer): Promise<number> {
  const meta = await parseExifMetadata(file);
  return meta?.orientation || 1;
}

/**
 * Detect if a file is a Live Photo (Apple Live Photo, Samsung Motion Photo, Google Motion Photo).
 */
export async function detectLivePhoto(file: File | Blob): Promise<LivePhotoInfo> {
  try {
    const buffer = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder('latin1').decode(bytes);

    // Apple Live Photo markers
    if (
      text.includes('com.apple.quicktime.live-photo') ||
      text.includes('Apple Live Photo') ||
      text.includes('ContentIdentifier') ||
      text.includes('MediaGroupUUID')
    ) {
      return { isLivePhoto: true, type: 'apple' };
    }

    // Samsung / Google Motion Photo markers in XMP
    if (text.includes('GCamera:MotionPhoto') || text.includes('MotionPhoto_Data')) {
      return { isLivePhoto: true, type: 'google' };
    }
    if (text.includes('Samsung:MotionPhoto') || text.includes('SEF')) {
      return { isLivePhoto: true, type: 'samsung' };
    }

    // Check tail of file for embedded MP4 (common for motion photos)
    if (file.size > 200 * 1024) {
      const tailBuf = await file.slice(Math.max(0, file.size - 64 * 1024)).arrayBuffer();
      const tailBytes = new Uint8Array(tailBuf);
      const tailText = new TextDecoder('latin1').decode(tailBytes);
      if (tailText.includes('ftypmp42') || tailText.includes('ftypisom') || tailText.includes('QuickTime')) {
        return { isLivePhoto: true, type: 'apple' };
      }
    }
  } catch {
    /* ignore parsing error */
  }

  return { isLivePhoto: false };
}

/**
 * Apply EXIF orientation transformation onto a target 2D canvas context.
 * Adjusts canvas dimensions if rotation is 90 or 270 degrees.
 */
export function applyOrientationToCanvas(
  canvas: HTMLCanvasElement,
  img: CanvasImageSource,
  orientation: number,
  srcWidth: number,
  srcHeight: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Orientations 5, 6, 7, 8 swap width and height
  const swap = orientation >= 5 && orientation <= 8;
  canvas.width = swap ? srcHeight : srcWidth;
  canvas.height = swap ? srcWidth : srcHeight;

  ctx.save();

  switch (orientation) {
    case 2: // flip horizontal
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      break;
    case 3: // 180 rotate
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(Math.PI);
      ctx.drawImage(img, 0, 0);
      break;
    case 4: // flip vertical
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, 0);
      break;
    case 5: // transpose (flip h + 90 ccw)
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, -srcHeight);
      break;
    case 6: // 90 CW
      ctx.translate(canvas.width, 0);
      ctx.rotate(0.5 * Math.PI);
      ctx.drawImage(img, 0, 0);
      break;
    case 7: // transverse (flip h + 90 cw)
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, 0);
      break;
    case 8: // 270 CW / 90 CCW
      ctx.translate(0, canvas.height);
      ctx.rotate(-0.5 * Math.PI);
      ctx.drawImage(img, 0, 0);
      break;
    case 1:
    default:
      ctx.drawImage(img, 0, 0);
      break;
  }

  ctx.restore();
}

/**
 * Full EXIF reader from JPEG / TIFF / HEIC buffer.
 */
export async function parseExifMetadata(source: File | Blob | ArrayBuffer): Promise<ExifData> {
  let buffer: ArrayBuffer;
  if (source instanceof ArrayBuffer) {
    buffer = source;
  } else {
    buffer = await source.arrayBuffer();
  }

  const dataView = new DataView(buffer);
  const result: ExifData = {};

  try {
    // 1. Check if JPEG (starts with 0xFFD8)
    if (dataView.getUint16(0, false) === 0xffd8) {
      let offset = 2;
      const length = dataView.byteLength;

      while (offset < length) {
        if (dataView.getUint8(offset) !== 0xff) break;
        const marker = dataView.getUint8(offset + 1);

        // APP1 marker (0xFFE1) contains EXIF
        if (marker === 0xe1) {
          const app1Length = dataView.getUint16(offset + 2, false);
          // Check for 'Exif\0\0'
          if (
            dataView.getUint32(offset + 4, false) === 0x45786966 &&
            dataView.getUint16(offset + 8, false) === 0x0000
          ) {
            const tiffOffset = offset + 10;
            parseTiff(dataView, tiffOffset, result);
            break;
          }
          offset += 2 + app1Length;
        } else if (marker === 0xd9 || marker === 0xda) {
          // End of image or start of scan
          break;
        } else {
          offset += 2 + dataView.getUint16(offset + 2, false);
        }
      }
    }
    // 2. Check if direct TIFF (II = 0x4949 or MM = 0x4D4D)
    else if (
      (dataView.getUint16(0, false) === 0x4949 && dataView.getUint16(2, true) === 0x002a) ||
      (dataView.getUint16(0, false) === 0x4d4d && dataView.getUint16(2, false) === 0x002a)
    ) {
      parseTiff(dataView, 0, result);
    }
    // 3. Check for HEIC / HEIF / MP4 box container
    else if (dataView.byteLength >= 16) {
      const brand = String.fromCharCode(
        dataView.getUint8(4),
        dataView.getUint8(5),
        dataView.getUint8(6),
        dataView.getUint8(7),
      );
      if (brand === 'ftyp') {
        // Search for 'Exif' box or TIFF header inside HEIC
        const uint8 = new Uint8Array(buffer);
        for (let i = 0; i < uint8.length - 8; i++) {
          if (
            uint8[i] === 0x45 &&
            uint8[i + 1] === 0x78 &&
            uint8[i + 2] === 0x69 &&
            uint8[i + 3] === 0x66 &&
            uint8[i + 4] === 0x00 &&
            uint8[i + 5] === 0x00
          ) {
            const tiffOffset = i + 6;
            parseTiff(dataView, tiffOffset, result);
            break;
          } else if (
            (uint8[i] === 0x49 && uint8[i + 1] === 0x49 && uint8[i + 2] === 0x2a && uint8[i + 3] === 0x00) ||
            (uint8[i] === 0x4d && uint8[i + 1] === 0x4d && uint8[i + 2] === 0x00 && uint8[i + 3] === 0x2a)
          ) {
            parseTiff(dataView, i, result);
            break;
          }
        }
      }
    }
  } catch {
    /* parsing error, return whatever extracted */
  }

  return result;
}

function parseTiff(dataView: DataView, tiffOffset: number, result: ExifData) {
  const byteOrderMarker = dataView.getUint16(tiffOffset, false);
  const littleEndian = byteOrderMarker === 0x4949; // 'II'

  if (byteOrderMarker !== 0x4949 && byteOrderMarker !== 0x4d4d) {
    return;
  }

  const firstIFDOffset = dataView.getUint32(tiffOffset + 4, littleEndian);
  if (firstIFDOffset < 8) return;

  const ifd0 = tiffOffset + firstIFDOffset;
  parseIFD(dataView, tiffOffset, ifd0, littleEndian, result);
}

function parseIFD(
  dataView: DataView,
  tiffOffset: number,
  ifdOffset: number,
  littleEndian: boolean,
  result: ExifData,
) {
  if (ifdOffset + 2 > dataView.byteLength) return;
  const numEntries = dataView.getUint16(ifdOffset, littleEndian);

  let exifSubIfdOffset = 0;
  let gpsSubIfdOffset = 0;

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > dataView.byteLength) break;

    const tag = dataView.getUint16(entryOffset, littleEndian);
    const type = dataView.getUint16(entryOffset + 2, littleEndian);
    const count = dataView.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = entryOffset + 8;

    switch (tag) {
      case 0x0112: // Orientation
        result.orientation = readShortOrLong(dataView, valueOffset, type, littleEndian);
        break;
      case 0x010f: // Make
        result.make = readAscii(dataView, tiffOffset, valueOffset, count, littleEndian);
        break;
      case 0x0110: // Model
        result.model = readAscii(dataView, tiffOffset, valueOffset, count, littleEndian);
        break;
      case 0x0131: // Software
        result.software = readAscii(dataView, tiffOffset, valueOffset, count, littleEndian);
        break;
      case 0x0132: // DateTime
        result.dateTime = readAscii(dataView, tiffOffset, valueOffset, count, littleEndian);
        break;
      case 0x8769: // Exif SubIFD Pointer
        exifSubIfdOffset = dataView.getUint32(valueOffset, littleEndian);
        break;
      case 0x8825: // GPS SubIFD Pointer
        gpsSubIfdOffset = dataView.getUint32(valueOffset, littleEndian);
        break;
      case 0x0100: // ImageWidth
        result.width = readShortOrLong(dataView, valueOffset, type, littleEndian);
        break;
      case 0x0101: // ImageHeight
        result.height = readShortOrLong(dataView, valueOffset, type, littleEndian);
        break;
    }
  }

  // Parse Exif SubIFD
  if (exifSubIfdOffset > 0) {
    parseExifSubIFD(dataView, tiffOffset, tiffOffset + exifSubIfdOffset, littleEndian, result);
  }

  // Parse GPS SubIFD
  if (gpsSubIfdOffset > 0) {
    parseGpsSubIFD(dataView, tiffOffset, tiffOffset + gpsSubIfdOffset, littleEndian, result);
  }
}

function parseExifSubIFD(
  dataView: DataView,
  tiffOffset: number,
  ifdOffset: number,
  littleEndian: boolean,
  result: ExifData,
) {
  if (ifdOffset + 2 > dataView.byteLength) return;
  const numEntries = dataView.getUint16(ifdOffset, littleEndian);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > dataView.byteLength) break;

    const tag = dataView.getUint16(entryOffset, littleEndian);
    const type = dataView.getUint16(entryOffset + 2, littleEndian);
    const count = dataView.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = entryOffset + 8;

    switch (tag) {
      case 0x9003: // DateTimeOriginal
        result.dateTimeOriginal = readAscii(dataView, tiffOffset, valueOffset, count, littleEndian);
        break;
      case 0x829a: { // ExposureTime (shutter speed)
        const rat = readRational(dataView, tiffOffset, valueOffset, littleEndian);
        if (rat) {
          result.exposureTime = rat.numerator === 1 ? `1/${rat.denominator}s` : rat.denominator === 1 ? `${rat.numerator}s` : `${(rat.numerator / rat.denominator).toFixed(4)}s`;
        }
        break;
      }
      case 0x829d: { // FNumber
        const rat = readRational(dataView, tiffOffset, valueOffset, littleEndian);
        if (rat && rat.denominator !== 0) {
          result.fNumber = Number((rat.numerator / rat.denominator).toFixed(1));
        }
        break;
      }
      case 0x8827: // ISO
        result.iso = readShortOrLong(dataView, valueOffset, type, littleEndian);
        break;
      case 0x920a: { // FocalLength
        const rat = readRational(dataView, tiffOffset, valueOffset, littleEndian);
        if (rat && rat.denominator !== 0) {
          result.focalLength = Number((rat.numerator / rat.denominator).toFixed(1));
        }
        break;
      }
      case 0xa434: // LensModel
        result.lensModel = readAscii(dataView, tiffOffset, valueOffset, count, littleEndian);
        break;
      case 0x9209: { // Flash
        const flashVal = readShortOrLong(dataView, valueOffset, type, littleEndian);
        result.flash = (flashVal & 1) !== 0 ? 'Fired' : 'Did not fire';
        break;
      }
      case 0xa001: { // ColorSpace
        const cs = readShortOrLong(dataView, valueOffset, type, littleEndian);
        result.colorSpace = cs === 1 ? 'sRGB' : cs === 65535 ? 'Uncalibrated / Adobe RGB' : `Custom (${cs})`;
        break;
      }
      case 0xa002: // PixelXDimension
        if (!result.width) result.width = readShortOrLong(dataView, valueOffset, type, littleEndian);
        break;
      case 0xa003: // PixelYDimension
        if (!result.height) result.height = readShortOrLong(dataView, valueOffset, type, littleEndian);
        break;
    }
  }
}

function parseGpsSubIFD(
  dataView: DataView,
  tiffOffset: number,
  ifdOffset: number,
  littleEndian: boolean,
  result: ExifData,
) {
  if (ifdOffset + 2 > dataView.byteLength) return;
  const numEntries = dataView.getUint16(ifdOffset, littleEndian);

  let latRef = 'N';
  let lonRef = 'E';
  let latDMS: number[] | null = null;
  let lonDMS: number[] | null = null;
  let altVal: number | undefined;

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > dataView.byteLength) break;

    const tag = dataView.getUint16(entryOffset, littleEndian);
    const count = dataView.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = entryOffset + 8;

    switch (tag) {
      case 0x0001: // GPSLatitudeRef
        latRef = String.fromCharCode(dataView.getUint8(valueOffset));
        break;
      case 0x0002: // GPSLatitude (3 rationals: deg, min, sec)
        latDMS = readRationals(dataView, tiffOffset, valueOffset, count, littleEndian);
        break;
      case 0x0003: // GPSLongitudeRef
        lonRef = String.fromCharCode(dataView.getUint8(valueOffset));
        break;
      case 0x0004: // GPSLongitude (3 rationals)
        lonDMS = readRationals(dataView, tiffOffset, valueOffset, count, littleEndian);
        break;
      case 0x0006: { // GPSAltitude
        const rat = readRational(dataView, tiffOffset, valueOffset, littleEndian);
        if (rat && rat.denominator !== 0) {
          altVal = Number((rat.numerator / rat.denominator).toFixed(1));
        }
        break;
      }
    }
  }

  if (latDMS && lonDMS && latDMS.length >= 3 && lonDMS.length >= 3) {
    let lat = latDMS[0] + latDMS[1] / 60 + latDMS[2] / 3600;
    if (latRef === 'S') lat = -lat;
    let lon = lonDMS[0] + lonDMS[1] / 60 + lonDMS[2] / 3600;
    if (lonRef === 'W') lon = -lon;

    const formatted = `${Math.abs(lat).toFixed(6)}° ${latRef}, ${Math.abs(lon).toFixed(6)}° ${lonRef}`;
    const mapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;

    result.gps = {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      altitude: altVal,
      latitudeRef: latRef,
      longitudeRef: lonRef,
      formatted,
      mapsUrl,
    };
  }
}

function readShortOrLong(dataView: DataView, offset: number, type: number, littleEndian: boolean): number {
  if (type === 3) return dataView.getUint16(offset, littleEndian); // SHORT
  if (type === 4) return dataView.getUint32(offset, littleEndian); // LONG
  return dataView.getUint16(offset, littleEndian);
}

function readAscii(
  dataView: DataView,
  tiffOffset: number,
  valueOffset: number,
  count: number,
  littleEndian: boolean,
): string {
  let offset = valueOffset;
  if (count > 4) {
    offset = tiffOffset + dataView.getUint32(valueOffset, littleEndian);
  }
  let str = '';
  for (let i = 0; i < count; i++) {
    if (offset + i >= dataView.byteLength) break;
    const charCode = dataView.getUint8(offset + i);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str.trim();
}

function readRational(
  dataView: DataView,
  tiffOffset: number,
  valueOffset: number,
  littleEndian: boolean,
): { numerator: number; denominator: number } | null {
  const actualOffset = tiffOffset + dataView.getUint32(valueOffset, littleEndian);
  if (actualOffset + 8 > dataView.byteLength) return null;
  const numerator = dataView.getUint32(actualOffset, littleEndian);
  const denominator = dataView.getUint32(actualOffset + 4, littleEndian);
  return { numerator, denominator };
}

function readRationals(
  dataView: DataView,
  tiffOffset: number,
  valueOffset: number,
  count: number,
  littleEndian: boolean,
): number[] {
  const actualOffset = tiffOffset + dataView.getUint32(valueOffset, littleEndian);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const off = actualOffset + i * 8;
    if (off + 8 > dataView.byteLength) break;
    const num = dataView.getUint32(off, littleEndian);
    const den = dataView.getUint32(off + 4, littleEndian);
    values.push(den === 0 ? 0 : num / den);
  }
  return values;
}
