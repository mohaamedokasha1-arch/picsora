/**
 * Tool search scoring — pure functions, no React and no i18n, so the ranking
 * can be unit tested against the real registry.
 *
 * The scorer matches tool *functions*, not just names: a query token may match
 * the name, the keywords, the short description or the category, and it is
 * expanded through a small synonym table plus simple word-form folding, so
 * "compress photo", "make picture smaller" and "shrink image" all reach the
 * Image Compressor.
 */

export interface SearchItem {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  popular: boolean;
  nameNorm: string;
  descNorm: string;
  keysNorm: string;
  catNorm: string;
}

/** Normalise Latin + Arabic queries: case, diacritics, alef/hamza variants. */
export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(foldArabicToken)
    .join(' ');
}

/**
 * Arabic carries the definite article and the feminine ending as affixes, so
 * "ضغط صورة" would never match "ضغط الصور" without folding both sides the same
 * way. Query and index both go through this, which keeps it consistent.
 */
function foldArabicToken(token: string): string {
  let out = token;
  if (out.length >= 4 && out.startsWith('ال')) out = out.slice(2);
  if (out.length >= 3 && out.endsWith('ه')) out = out.slice(0, -1);
  return out;
}

/**
 * Words that carry no intent. Filtering them out matters because the scorer
 * requires every token to match: a single filler word used to hide the right
 * tool completely ("make image smaller" used to lose the Image Compressor).
 */
const STOP_TOKENS = new Set([
  'a','an','the','my','me','i','you','your','it','is','are','be','to','of','for','with','in','on','at','by','from',
  'into','and','or','but','please','help','need','want','make','makes','making','get','have','has','using','use',
  'how','do','does','can','tool','tools','online','free','best','while','without','file','files',
  'من','في','على','عن','مع','او','و','ثم','هل','ما','هذا','هذه','ذلك','التي','الذي','كيف','اريد','ابغي','ابغى',
  'احتاج','لي','لك','هو','هي','لكي','عبر','باستخدام','اداه','بدون',
]);

/**
 * Everyday words people type instead of the words the tools use. Groups are
 * bidirectional: "photo" matches "image" and vice versa. Only words that are
 * genuinely interchangeable belong here — this must never turn a precise
 * query into a fuzzy one.
 */
const SYNONYM_GROUPS: string[][] = [
  ['image', 'photo', 'picture', 'pic', 'img', 'graphic', 'صورة', 'صور'],
  ['compress', 'compression', 'shrink', 'reduce', 'smaller', 'optimize', 'optimise', 'squeeze', 'downsize', 'ضغط'],
  ['resize', 'rescale', 'scale', 'dimensions', 'أبعاد'],
  ['convert', 'converter', 'conversion', 'change', 'transform', 'تحويل'],
  ['merge', 'combine', 'join', 'unite', 'concat', 'دمج'],
  ['split', 'divide', 'separate', 'تقسيم'],
  ['crop', 'trim', 'cut', 'قص'],
  ['rotate', 'turn', 'spin', 'تدوير'],
  ['remove', 'delete', 'erase', 'strip', 'get rid of', 'حذف'],
  ['watermark', 'stamp', 'brand', 'علامة مائية'],
  ['text', 'string', 'نص'],
  ['count', 'counter', 'tally', 'frequency', 'occurrences', 'عدد'],
  ['format', 'formatter', 'beautify', 'prettify', 'pretty', 'تنسيق'],
  ['encode', 'decode', 'encoding', 'decoding', 'ترميز'],
  ['hash', 'checksum', 'digest'],
  ['color', 'colour', 'palette', 'لون'],
  ['password', 'encrypt', 'lock', 'secure', 'حماية'],
  ['unlock', 'decrypt'],
  ['timestamp', 'epoch', 'unix'],
  ['spreadsheet', 'excel', 'csv'],
  ['blur', 'censor', 'redact', 'obscure', 'mosaic', 'pixelate', 'pixelated', 'تمويه', 'طمس'],
  ['grayscale', 'greyscale', 'monochrome', 'رمادي'],
  ['background', 'bg', 'خلفية'],
  ['metadata', 'exif', 'properties', 'details', 'بيانات'],
  ['page', 'pages', 'صفحات'],
  ['extract', 'pull out', 'export', 'استخراج'],
  ['sort', 'alphabetize', 'order', 'ترتيب'],
  ['line', 'lines', 'اسطر'],
  ['document', 'doc', 'file', 'ملف'],
  ['number', 'digits', 'رقم'],
  ['time', 'date', 'وقت'],
  ['size', 'حجم'],
];

const SYNONYMS = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    const others = new Set<string>();
    for (const other of group) if (other !== word) others.add(other);
    SYNONYMS.set(word, [...others]);
  }
}

/**
 * Cheap suffix folding so "resizing", "resized" and "resize" are the same
 * query. Deliberately conservative: it only ever *adds* candidates.
 */
function wordForms(token: string): string[] {
  const forms = new Set<string>([token]);
  if (token.length > 5 && token.endsWith('ing')) {
    const stem = token.slice(0, -3);
    forms.add(stem);
    forms.add(`${stem}e`);
  }
  if (token.length > 4 && token.endsWith('ed')) {
    forms.add(token.slice(0, -2));
    forms.add(token.slice(0, -1));
  }
  if (token.length > 3 && token.endsWith('s')) forms.add(token.slice(0, -1));
  if (token.length > 4 && token.endsWith('es')) forms.add(token.slice(0, -2));
  if (token.length > 5 && token.endsWith('er')) forms.add(token.slice(0, -2));
  return [...forms];
}

/** Every spelling of a token the scorer should try, synonyms included. */
export function tokenVariants(token: string): string[] {
  const out = new Set<string>();
  for (const form of wordForms(token)) {
    out.add(form);
    for (const synonym of SYNONYMS.get(form) ?? []) {
      out.add(synonym);
      for (const nested of wordForms(synonym)) out.add(nested);
    }
  }
  return [...out].filter(Boolean);
}

/** True when every char of `needle` appears in order inside `haystack`. */
function subsequence(needle: string, haystack: string): boolean {
  if (!needle) return true;
  let j = 0;
  for (let i = 0; i < haystack.length && j < needle.length; i += 1) {
    if (haystack[i] === needle[j]) j += 1;
  }
  return j === needle.length;
}

/**
 * Best score a single token can reach. `strong` marks a real hit on the name,
 * keywords, description or category — the subsequence fallbacks exist to catch
 * typos, but they must never be the only reason a tool is returned.
 */
function scoreToken(item: SearchItem, token: string, compactName: string): { score: number; strong: boolean } {
  let best = 0;
  let strong = false;
  for (const variant of tokenVariants(token)) {
    if (variant.length < 2) continue;
    let score = 0;
    let isStrong = true;
    if (item.nameNorm.includes(variant)) score = variant.length >= 3 ? 100 : 60;
    else if (compactName.includes(variant.replace(/[\s-]+/g, ''))) score = 70;
    else if (item.keysNorm.includes(variant)) score = 45;
    else if (item.descNorm.includes(variant)) score = 25;
    else if (item.catNorm.includes(variant)) score = 12;
    else if (variant.length >= 4 && subsequence(variant, compactName)) {
      score = 18;
      isStrong = false;
    } else if (variant.length >= 4 && subsequence(variant, item.keysNorm.replace(/\s+/g, ''))) {
      score = 6;
      isStrong = false;
    }
    if (score > best) {
      best = score;
      strong = isStrong;
    } else if (score === best && score > 0 && isStrong) {
      strong = true;
    }
  }
  return { score: best, strong };
}

/**
 * Do the meaningful query tokens appear in the item's own name in the same
 * order? "convert png to jpg" must prefer PNG → JPG over JPG → PNG, which is
 * the only thing separating the two.
 */
function followsQueryOrder(item: SearchItem, tokens: string[]): boolean {
  // Only the tokens that really appear in the name count ("convert png to jpg"
  // still orders png before jpg).
  const positions: number[] = [];
  for (const token of tokens) {
    if (token.length < 2 || STOP_TOKENS.has(token)) continue;
    let at = -1;
    for (const variant of tokenVariants(token)) {
      if (variant.length < 2) continue;
      const index = item.nameNorm.indexOf(variant);
      if (index >= 0 && (at === -1 || index < at)) at = index;
    }
    if (at >= 0) positions.push(at);
  }
  if (positions.length < 2) return false;
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i] <= positions[i - 1]) return false;
  }
  return true;
}

export function scoreItem(item: SearchItem, tokens: string[], raw: string): number {
  let score = 0;
  let strong = 0;
  const compactName = item.nameNorm.replace(/[\s-]+/g, '');
  for (const token of tokens) {
    // Single characters and filler words carry no signal — ignore them
    // instead of letting them veto every result.
    if (token.length < 2 || STOP_TOKENS.has(token)) continue;
    const hit = scoreToken(item, token, compactName);
    score += hit.score;
    if (hit.strong) strong += 1;
  }
  // A tool must be a real hit for at least one meaningful token; a couple of
  // coincidental letters inside one word is not a match.
  if (strong === 0) return -1;
  // Whole-phrase matches are the strongest signal there is.
  if (item.nameNorm.includes(raw)) score += 90;
  else if (item.keysNorm.includes(raw)) score += 80;
  else if (item.descNorm.includes(raw)) score += 60;
  // Exact / prefix matches rank first, then the tools whose name reads in the
  // same order as the query (png → jpg beats jpg → png).
  if (item.nameNorm.startsWith(raw)) score += 60;
  else if (followsQueryOrder(item, tokens)) score += 25;
  if (item.popular) score += 5;
  return score;
}

/** Rank the index for a query. Returns at most `limit` tools, best first. */
export function searchTools<T extends SearchItem>(items: T[], query: string, limit = 8): T[] {
  const raw = normalizeQuery(query);
  if (!raw) return [];
  // Single characters and filler words ("a pdf", "make my picture smaller")
  // are dropped instead of being allowed to veto every result.
  const tokens = raw.split(' ').filter((token) => token.length > 1 && !STOP_TOKENS.has(token));
  return items
    .map((item) => ({ item, score: scoreItem(item, tokens, raw) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.item.slug.localeCompare(b.item.slug))
    .slice(0, limit)
    .map((entry) => entry.item);
}
