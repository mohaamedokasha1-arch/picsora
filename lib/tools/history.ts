/**
 * Favorites + recently-used tools, stored in localStorage only.
 *
 * Privacy model matches the rest of the app: nothing leaves the device, no
 * account, no sync. Slugs are validated against the registry on read so a
 * renamed tool can never render a dead card. All helpers are SSR-safe.
 */
import { SLUGS } from './registry';

const FAVORITES_KEY = 'piclizer:favorites:v1';
const RECENT_KEY = 'piclizer:recent:v1';
const MAX_FAVORITES = 48;
const MAX_RECENT = 8;

const KNOWN = new Set<string>(SLUGS);

function read(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate + dedupe: stale slugs from removed tools are dropped.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item === 'string' && KNOWN.has(item) && !seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
    return out;
  } catch {
    return [];
  }
}

function write(key: string, slugs: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(slugs));
    window.dispatchEvent(new CustomEvent('piclizer:history', { detail: { key } }));
  } catch {
    // Storage full or blocked (private mode) — the app works fine without it.
  }
}

export function getFavorites(): string[] {
  return read(FAVORITES_KEY);
}

export function isFavorite(slug: string): boolean {
  return read(FAVORITES_KEY).includes(slug);
}

/** Toggle a favorite. Returns the new state (true = now favorited). */
export function toggleFavorite(slug: string): boolean {
  if (!KNOWN.has(slug)) return false;
  const current = read(FAVORITES_KEY);
  if (current.includes(slug)) {
    write(FAVORITES_KEY, current.filter((s) => s !== slug));
    return false;
  }
  write(FAVORITES_KEY, [slug, ...current].slice(0, MAX_FAVORITES));
  return true;
}

export function getRecent(): string[] {
  return read(RECENT_KEY);
}

/** Record a tool visit (most-recent-first, deduped, capped). */
export function pushRecent(slug: string): void {
  if (!KNOWN.has(slug)) return;
  write(RECENT_KEY, [slug, ...read(RECENT_KEY).filter((s) => s !== slug)].slice(0, MAX_RECENT));
}

export function clearRecent(): void {
  write(RECENT_KEY, []);
}
