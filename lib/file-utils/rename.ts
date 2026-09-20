/**
 * Bulk file-rename engine — pure functions over file names. Only the NAME is
 * ever rewritten; contents are untouched and everything stays in memory until
 * the user downloads the results.
 */

export interface RenameOptions {
  prefix: string;
  suffix: string;
  /** Find/replace applied to the base name (empty find = no-op). */
  find: string;
  replace: string;
  /** Remove every occurrence of this literal from the base name. */
  removeText: string;
  /** Append sequential numbers (001, 002, …). */
  numbering: boolean;
  startNumber: number;
  padding: number; // 1..6 digits
  numberPosition: 'suffix' | 'prefix';
  caseMode: 'keep' | 'lower' | 'upper';
  /** Replace whitespace runs with this string ('' = leave spaces). */
  spaceReplacement: string;
  /** Prepend the file's last-modified date (YYYYMMDD-). */
  datePrefix: boolean;
}

export const DEFAULT_RENAME_OPTIONS: RenameOptions = {
  prefix: '',
  suffix: '',
  find: '',
  replace: '',
  removeText: '',
  numbering: true,
  startNumber: 1,
  padding: 3,
  numberPosition: 'suffix',
  caseMode: 'keep',
  spaceReplacement: '',
  datePrefix: false,
};

export interface RenamePlan {
  /** Index into the original file list. */
  index: number;
  original: string;
  renamed: string;
  /** True when the name actually changes. */
  changed: boolean;
}

/** Filesystem-hostile characters become '_' (Windows/macOS/Linux-safe). */
export function sanitizeSegment(segment: string): string {
  // eslint-disable-next-line no-control-regex
  return segment.replace(/[\\/:*?"<>|\u0000-\u001F\u007F-\u009F]/g, '_').trim();
}

function splitName(name: string): { base: string; ext: string } {
  const idx = name.lastIndexOf('.');
  if (idx > 0 && idx < name.length - 1) {
    return { base: name.slice(0, idx), ext: name.slice(idx) };
  }
  return { base: name, ext: '' };
}

function formatDatePrefix(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-`;
}

/** Apply the rename options to one file name. */
export function renameOne(
  original: string,
  options: RenameOptions,
  sequence: number,
  lastModified: number,
): string {
  const { base, ext } = splitName(original || 'file');
  let out = base;
  if (options.find) out = out.split(options.find).join(options.replace ?? '');
  if (options.removeText) out = out.split(options.removeText).join('');
  if (options.spaceReplacement !== '') out = out.replace(/\s+/g, options.spaceReplacement);
  if (options.caseMode === 'lower') out = out.toLowerCase();
  if (options.caseMode === 'upper') out = out.toUpperCase();
  out = sanitizeSegment(out) || 'file';

  const num = String(sequence).padStart(Math.max(1, Math.min(6, options.padding)), '0');
  const prefix = sanitizeSegment(options.prefix);
  const suffix = sanitizeSegment(options.suffix);
  let name = `${prefix}${out}${suffix}`;
  if (options.numbering) {
    name = options.numberPosition === 'prefix' ? `${num}-${name}` : `${name}-${num}`;
  }
  if (options.datePrefix) {
    name = `${formatDatePrefix(new Date(lastModified || Date.now()))}${name}`;
  }
  if (name.length > 180) name = name.slice(0, 180).trim();
  return `${name}${ext.toLowerCase() === ext ? ext : ext}`;
}

/** Build the full rename plan, resolving collisions with -2, -3, … suffixes. */
export function planRename(
  files: { name: string; lastModified: number }[],
  options: RenameOptions,
): RenamePlan[] {
  const used = new Set<string>();
  const start = Math.max(0, Math.floor(options.startNumber) || 0);
  return files.map((file, index) => {
    let renamed = renameOne(file.name, options, start + index, file.lastModified);
    if (used.has(renamed.toLowerCase())) {
      const { base, ext } = splitName(renamed);
      let n = 2;
      while (used.has(`${base}-${n}${ext}`.toLowerCase()) && n < 10000) n += 1;
      renamed = `${base}-${n}${ext}`;
    }
    used.add(renamed.toLowerCase());
    return { index, original: file.name, renamed, changed: renamed !== file.name };
  });
}

/** Re-wrap files with their new names (contents untouched). */
export function applyPlan(files: File[], plan: RenamePlan[]): File[] {
  return plan.map((p) => {
    const source = files[p.index];
    if (!source || !p.changed) return source;
    try {
      return new File([source], p.renamed, { type: source.type, lastModified: source.lastModified });
    } catch {
      return source;
    }
  });
}
