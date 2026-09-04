'use client';

import * as React from 'react';

const FAVORITES_KEY = 'piclizer_favorites';
const RECENT_KEY = 'piclizer_recent_tools';

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isFavorite(slug: string): boolean {
  return getFavorites().includes(slug);
}

export function toggleFavorite(slug: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const favs = getFavorites();
    const idx = favs.indexOf(slug);
    let next: string[];
    let added = false;
    if (idx >= 0) {
      next = favs.filter((s) => s !== slug);
      added = false;
    } else {
      next = [slug, ...favs];
      added = true;
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('piclizer:favorites_changed', { detail: next }));
    return added;
  } catch {
    return false;
  }
}

export function recordRecentTool(slug: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const recents: string[] = raw ? JSON.parse(raw) : [];
    const next = [slug, ...recents.filter((s) => s !== slug)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('piclizer:recent_changed', { detail: next }));
  } catch {
    /* ignore storage errors */
  }
}

export function getRecentTools(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useFavorites(): [string[], (slug: string) => void] {
  const [favs, setFavs] = React.useState<string[]>([]);

  React.useEffect(() => {
    setFavs(getFavorites());
    const onStorage = () => setFavs(getFavorites());
    window.addEventListener('storage', onStorage);
    window.addEventListener('piclizer:favorites_changed', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('piclizer:favorites_changed', onStorage);
    };
  }, []);

  const toggle = React.useCallback((slug: string) => {
    toggleFavorite(slug);
    setFavs(getFavorites());
  }, []);

  return [favs, toggle];
}

export function useRecentTools(): string[] {
  const [recent, setRecent] = React.useState<string[]>([]);

  React.useEffect(() => {
    setRecent(getRecentTools());
    const onStorage = () => setRecent(getRecentTools());
    window.addEventListener('storage', onStorage);
    window.addEventListener('piclizer:recent_changed', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('piclizer:recent_changed', onStorage);
    };
  }, []);

  return recent;
}
