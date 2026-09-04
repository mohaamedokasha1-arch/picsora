import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { escapeHtml as escapeHtmlSafe, sanitizeFilename as sanitizeFilenameSafe } from '@/lib/security/sanitize';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatPercent(original: number, current: number): string {
  if (!original || original <= 0) return '0%';
  const saved = ((original - current) / original) * 100;
  return `${Math.max(0, Math.round(saved))}%`;
}

/**
 * Escape a string so it is safe to embed in HTML.
 *
 * Delegates to the hardened implementation in `lib/security/sanitize` (which
 * also neutralises `/` and backticks) so there is a single escaping routine in
 * the codebase.
 */
export function escapeHtml(input: string): string {
  return escapeHtmlSafe(input);
}

/**
 * Sanitize a user-provided string into a safe file name.
 *
 * Delegates to `lib/security/sanitize`, which additionally strips path
 * separators, traversal sequences, control characters, bidi-override spoofing
 * and Windows reserved device names before slugifying.
 */
export function sanitizeFilename(name: string, fallback = 'file'): string {
  return sanitizeFilenameSafe(name, fallback);
}
