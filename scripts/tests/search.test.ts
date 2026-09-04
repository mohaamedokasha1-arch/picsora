import { TOOLS } from '../../lib/tools/registry';

const SYNONYMS: Record<string, string[]> = {
  iphone: ['heic-to-jpg', 'heic-to-png', 'heif-to-jpg', 'heif-to-png', 'photo-metadata-viewer'],
  ios: ['heic-to-jpg', 'heic-to-png', 'heif-to-jpg', 'heif-to-png'],
  apple: ['heic-to-jpg', 'heic-to-png', 'heif-to-jpg', 'heif-to-png'],
  compress: ['image-compressor', 'exact-kb-image-compressor', 'pdf-compressor'],
  '500kb': ['exact-kb-image-compressor', 'image-compressor'],
  '200kb': ['exact-kb-image-compressor', 'image-compressor'],
  '100kb': ['exact-kb-image-compressor', 'image-compressor'],
  'remove background': ['png-to-jpg', 'jpg-to-png', 'signature-maker'],
  ocr: ['ocr-image-to-text', 'pdf-to-text'],
  'ضغط': ['image-compressor', 'exact-kb-image-compressor', 'pdf-compressor'],
  'تحويل': ['jpg-to-png', 'png-to-jpg', 'heic-to-jpg', 'jpg-to-webp'],
};

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function matchesWithTypoTolerance(query: string, token: string): boolean {
  if (token.includes(query) || query.includes(token)) return true;
  if (query.length >= 4 && token.length >= 4) {
    if (Math.abs(query.length - token.length) <= 1 && levenshtein(query, token) <= 1) {
      return true;
    }
  }
  return false;
}

function searchTools(query: string): string[] {
  const q = query.trim().toLowerCase();
  const results = new Set<string>();

  for (const [key, slugs] of Object.entries(SYNONYMS)) {
    if (q.includes(key) || key.includes(q)) {
      slugs.forEach((s) => results.add(s));
    }
  }

  for (const tool of TOOLS) {
    const tokens = [...tool.keywords, tool.slug, tool.nameKey];
    if (tool.slug.includes(q) || tokens.some((k) => k.toLowerCase().includes(q))) {
      results.add(tool.slug);
    } else {
      // Typo tolerance
      const tokenParts = tokens.flatMap((k) => k.toLowerCase().split(/[\s-_]+/));
      if (tokenParts.some((tok) => matchesWithTypoTolerance(q, tok))) {
        results.add(tool.slug);
      }
    }
  }

  return Array.from(results);
}

let fails = 0;
const assert = (name: string, condition: boolean) => {
  if (!condition) {
    fails++;
    console.log('FAIL:', name);
  }
};

// 1. Synonyms check
assert('iphone finds heic', searchTools('iphone').includes('heic-to-jpg'));
assert('500kb finds exact-kb', searchTools('500kb').includes('exact-kb-image-compressor'));
assert('ضغط finds image-compressor', searchTools('ضغط').includes('image-compressor'));
assert('ocr finds ocr-image-to-text', searchTools('ocr').includes('ocr-image-to-text'));

// 2. Typo tolerance check
assert('comress (typo) finds compressor', searchTools('comress').includes('image-compressor'));
assert('resiz (typo) finds resizer', searchTools('resiz').includes('image-resizer'));
assert('compres (typo) finds compressor', searchTools('compres').includes('image-compressor'));

console.log(fails ? `\n${fails} SEARCH FAILURES` : '\nSEARCH ALL PASS');
