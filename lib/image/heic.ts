/**
 * HEIC / HEIF support for iPhone photos.
 *
 * Browsers (except Safari) cannot decode HEIC natively, so this module lazily
 * loads `heic2any` (a pure client-side decoder) only when a HEIC file is
 * actually opened. Nothing is ever uploaded — conversion runs 100% locally.
 */

export const HEIC_EXTS = ['heic', 'heif'] as const;

export const HEIC_MIMES = [
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];

export function extOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function isHeicExt(ext: string): boolean {
  return (HEIC_EXTS as readonly string[]).includes(ext.toLowerCase());
}

export function isHeicFile(file: File): boolean {
  if (HEIC_MIMES.includes(file.type.toLowerCase())) return true;
  return isHeicExt(extOf(file.name));
}

type Heic2AnyFn = (opts: {
  blob: Blob;
  toType?: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

let heicPromise: Promise<Heic2AnyFn> | null = null;

/** Dynamically import heic2any so it never lands in the main bundle. */
function loadHeic2Any(): Promise<Heic2AnyFn> {
  if (!heicPromise) {
    heicPromise = import('heic2any').then(
      (mod) => ((mod as { default?: Heic2AnyFn }).default ?? (mod as unknown as Heic2AnyFn)),
    );
  }
  return heicPromise;
}

/**
 * Convert the first image of a HEIC/HEIF file to a browser-readable Blob.
 * Throws `heic-convert-failed` when the file cannot be decoded locally.
 */
export async function convertHeicToBlob(
  file: File | Blob,
  toType: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  const heic2any = await loadHeic2Any();
  let out: Blob | Blob[];
  try {
    out = await heic2any({ blob: file, toType, quality });
  } catch {
    throw new Error('heic-convert-failed');
  }
  const first = Array.isArray(out) ? out[0] : out;
  if (!first || !(first instanceof Blob) || first.size === 0) {
    throw new Error('heic-convert-failed');
  }
  return first;
}

/**
 * Convert a HEIC/HEIF File into a decodable image File (JPEG by default),
 * keeping the original base name so downloads stay recognisable.
 */
export async function heicToImageFile(file: File, toExt: 'jpg' | 'png' = 'jpg'): Promise<File> {
  const mime = toExt === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await convertHeicToBlob(file, mime);
  const base = file.name.includes('.') ? file.name.slice(0, file.name.lastIndexOf('.')) : file.name;
  return new File([blob], `${base}.${toExt}`, { type: mime });
}

/** Extra `accept` tokens so iOS pickers offer HEIC files. */
export function heicAcceptTokens(): string[] {
  return [...HEIC_MIMES, '.heic', '.heif'];
}
