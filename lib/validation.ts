import type { ImageFormat } from '@/lib/types';
import { mimeFromExt } from '@/lib/image/format';

export interface FormatRule {
  /** Accepted formats (by extension). */
  extensions: ImageFormat[];
  /** Accepted MIME types. */
  mimes: string[];
  /** Human-readable label of accepted formats. */
  label: string;
  maxFileSizeMB: number;
  maxFiles: number;
}

export interface ValidationResult {
  valid: boolean;
  errorKey?: string;
  params?: Record<string, string | number>;
}

/** Validate a single file against a tool's format rule. */
export async function validateFile(file: File, rule: FormatRule): Promise<ValidationResult> {
  // 0-byte check
  if (!file.size) {
    return { valid: false, errorKey: 'emptyFile' };
  }
  // Size check
  if (file.size > rule.maxFileSizeMB * 1024 * 1024) {
    return { valid: false, errorKey: 'fileTooLarge', params: { size: String(rule.maxFileSizeMB) } };
  }
  // Extension check
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!rule.extensions.includes(ext as ImageFormat)) {
    return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
  }
  // Magic-byte verification (defense in depth)
  const { sniffFormat } = await import('@/lib/image/format');
  const sniffed = await sniffFormat(file);
  if (sniffed && sniffed !== ext && !(ext === 'jpeg' && sniffed === 'jpg')) {
    return { valid: false, errorKey: 'mimeMismatch' };
  }
  // MIME check (do not trust extension alone)
  if (file.type && file.type !== 'application/octet-stream') {
    const accepted = rule.mimes.some((m) => file.type === m);
    if (!accepted) {
      // If MIME is not in the accepted list but the extension+sniff passed, be lenient
      // (browsers sometimes report generic MIME types). Only reject clearly wrong MIME.
      const clearlyWrong =
        /^(application\/pdf|text\/|audio\/|video\/)/.test(file.type);
      if (clearlyWrong) {
        return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
      }
    }
  }
  return { valid: true };
}

export function defaultRuleFor(extensions: ImageFormat[], maxFiles = 10, maxFileSizeMB = 50): FormatRule {
  const mimes = extensions.map((e) => mimeFromExt(e));
  const label = extensions.map((e) => e.toUpperCase()).join(', ');
  return { extensions, mimes, label, maxFileSizeMB, maxFiles };
}
