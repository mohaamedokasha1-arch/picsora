/**
 * Pure text transformations — zero dependencies, no side effects.
 * Every export takes a string (plus options) and returns a value, which makes
 * each one trivially unit-testable in isolation from the UI.
 */

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function containsArabic(input: string): boolean {
  return ARABIC_RANGE.test(input);
}

/* ------------------------------------------------------------------ counts */

export interface TextStats {
  charactersWithSpaces: number;
  charactersWithoutSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  uniqueWords: number;
  readingMinutes: number;
  speakingMinutes: number;
  frequencies: { word: string; count: number }[];
}

const EN_STOP_WORDS = new Set(
  'a about above after again against all am an and any are as at be because been before being below between both but by can did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with you your yours yourself yourselves'.split(
    ' ',
  ),
);

const AR_STOP_WORDS = new Set(
  'في من على إلى عن أن إن كان كانت هذا هذه ذلك تلك التي الذي ما لا و أو ثم قد كل بعض بين مع هو هي هم هن أنا نحن أنت أنتم لكن حتى إذا كما هناك هنالك عند عندما بعد قبل لدى غير سوف لم لن يا أي أيها'.split(
    ' ',
  ),
);

/** Unicode-aware word splitting that works for both Latin and Arabic script. */
export function splitWords(input: string): string[] {
  const matches = input.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu);
  return matches ?? [];
}

export function countSentences(input: string): number {
  const text = input.trim();
  if (!text) return 0;
  // Split on Latin and Arabic sentence terminators, ignoring empty fragments.
  const parts = text.split(/[.!?؟…]+[\s"'”)\]]*|\n{2,}/u).filter((p) => p.trim().length > 0);
  return parts.length;
}

export function analyzeText(input: string, stopWordLang: 'en' | 'ar' = 'en'): TextStats {
  const words = splitWords(input);
  const lower = words.map((w) => w.toLowerCase());
  const unique = new Set(lower);
  const stop = stopWordLang === 'ar' ? AR_STOP_WORDS : EN_STOP_WORDS;

  const freq = new Map<string, number>();
  for (const word of lower) {
    if (stop.has(word) || word.length < 2) continue;
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  const frequencies = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  const paragraphs = input.trim() ? input.trim().split(/\n\s*\n+/).filter((p) => p.trim()).length : 0;

  return {
    charactersWithSpaces: [...input].length,
    charactersWithoutSpaces: [...input.replace(/\s/g, '')].length,
    words: words.length,
    sentences: countSentences(input),
    paragraphs,
    lines: input ? input.split('\n').length : 0,
    uniqueWords: unique.size,
    readingMinutes: words.length / 200,
    speakingMinutes: words.length / 130,
    frequencies,
  };
}

/* ------------------------------------------------------------- whitespace */

export interface SpaceOptions {
  trimLeading: boolean;
  trimTrailing: boolean;
  collapseSpaces: boolean;
  collapseBlankLines: boolean;
  removeBlankLines: boolean;
  tabsToSpaces: boolean;
  removeAllWhitespace: boolean;
}

export const defaultSpaceOptions: SpaceOptions = {
  trimLeading: true,
  trimTrailing: true,
  collapseSpaces: true,
  collapseBlankLines: true,
  removeBlankLines: false,
  tabsToSpaces: false,
  removeAllWhitespace: false,
};

export function removeExtraSpaces(input: string, options: SpaceOptions): string {
  if (options.removeAllWhitespace) return input.replace(/\s+/g, '');
  let text = input;
  if (options.tabsToSpaces) text = text.replace(/\t/g, ' ');
  if (options.collapseSpaces) text = text.replace(/[^\S\r\n]{2,}/g, ' ');
  let lines = text.split('\n');
  if (options.trimLeading) lines = lines.map((l) => l.replace(/^[^\S\r\n]+/, ''));
  if (options.trimTrailing) lines = lines.map((l) => l.replace(/[^\S\r\n]+$/, ''));
  text = lines.join('\n');
  if (options.removeBlankLines) {
    text = text
      .split('\n')
      .filter((l) => l.trim() !== '')
      .join('\n');
  } else if (options.collapseBlankLines) {
    text = text.replace(/\n{3,}/g, '\n\n');
  }
  return text;
}

/* ------------------------------------------------------------------- case */

export type CaseMode =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'screamingSnake'
  | 'alternating'
  | 'inverse';

function tokenize(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function convertCase(input: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper':
      return input.toUpperCase();
    case 'lower':
      return input.toLowerCase();
    case 'title':
      return input.replace(/\p{L}[\p{L}'’]*/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    case 'sentence': {
      const lowered = input.toLowerCase();
      return lowered.replace(/(^\s*|[.!?؟]\s+)(\p{L})/gu, (_m, p, c: string) => p + c.toUpperCase());
    }
    case 'camel': {
      const parts = tokenize(input);
      return parts
        .map((p, i) => (i === 0 ? p.toLowerCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()))
        .join('');
    }
    case 'pascal':
      return tokenize(input)
        .map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase())
        .join('');
    case 'snake':
      return tokenize(input).map((p) => p.toLowerCase()).join('_');
    case 'kebab':
      return tokenize(input).map((p) => p.toLowerCase()).join('-');
    case 'screamingSnake':
      return tokenize(input).map((p) => p.toUpperCase()).join('_');
    case 'alternating':
      return [...input]
        .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
        .join('');
    case 'inverse':
      return [...input]
        .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
        .join('');
    default:
      return input;
  }
}

/* ---------------------------------------------------------------- cleaner */

export interface CleanOptions {
  stripHtml: boolean;
  removeUrls: boolean;
  removeEmails: boolean;
  removePhones: boolean;
  removeNumbers: boolean;
  removePunctuation: boolean;
  removeSpecial: boolean;
  removeEmoji: boolean;
  removeLineBreaks: boolean;
  removeDuplicateLines: boolean;
  sortLines: boolean;
  reverseLines: boolean;
  removeLinesContaining: string;
  find: string;
  replace: string;
}

export const defaultCleanOptions: CleanOptions = {
  stripHtml: false,
  removeUrls: false,
  removeEmails: false,
  removePhones: false,
  removeNumbers: false,
  removePunctuation: false,
  removeSpecial: false,
  removeEmoji: false,
  removeLineBreaks: false,
  removeDuplicateLines: false,
  sortLines: false,
  reverseLines: false,
  removeLinesContaining: '',
  find: '',
  replace: '',
};

export function cleanText(input: string, options: CleanOptions): string {
  let text = input;
  if (options.stripHtml) text = text.replace(/<[^>]*>/g, '');
  if (options.removeUrls) text = text.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '');
  if (options.removeEmails) text = text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '');
  if (options.removePhones) text = text.replace(/\+?\d[\d\s().-]{6,}\d/g, '');
  if (options.removeEmoji) text = text.replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '');
  if (options.removeNumbers) text = text.replace(/[\p{Nd}]/gu, '');
  if (options.removePunctuation) text = text.replace(/[\p{P}\p{S}]/gu, '');
  if (options.removeSpecial) text = text.replace(/[^\p{L}\s]/gu, '');
  if (options.find) text = text.split(options.find).join(options.replace);

  let lines = text.split('\n');
  if (options.removeLinesContaining) {
    const needle = options.removeLinesContaining.toLowerCase();
    lines = lines.filter((l) => !l.toLowerCase().includes(needle));
  }
  if (options.removeDuplicateLines) {
    const seen = new Set<string>();
    lines = lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true)));
  }
  if (options.sortLines) lines = [...lines].sort((a, b) => a.localeCompare(b));
  if (options.reverseLines) lines = [...lines].reverse();
  text = lines.join('\n');

  if (options.removeLineBreaks) text = text.replace(/\s*\n+\s*/g, ' ').trim();
  return text;
}

/* --------------------------------------------------------------- reverser */

export type ReverseMode = 'characters' | 'words' | 'eachLine' | 'lineOrder';

export function reverseText(input: string, mode: ReverseMode): string {
  switch (mode) {
    case 'characters':
      // Split by code points so surrogate pairs / emoji stay intact.
      return [...input].reverse().join('');
    case 'words':
      return input.split(/(\s+)/).reverse().join('');
    case 'eachLine':
      return input
        .split('\n')
        .map((line) => [...line].reverse().join(''))
        .join('\n');
    case 'lineOrder':
      return input.split('\n').reverse().join('\n');
    default:
      return input;
  }
}

/* ------------------------------------------------------------- duplicates */

export interface DedupeOptions {
  caseSensitive: boolean;
  trim: boolean;
  keep: 'first' | 'last';
}

export interface DedupeResult {
  text: string;
  before: number;
  after: number;
  removed: number;
}

export function removeDuplicateLines(input: string, options: DedupeOptions): DedupeResult {
  const lines = input.split('\n');
  const key = (line: string) => {
    const value = options.trim ? line.trim() : line;
    return options.caseSensitive ? value : value.toLowerCase();
  };

  let output: string[];
  if (options.keep === 'first') {
    const seen = new Set<string>();
    output = lines.filter((l) => {
      const k = key(l);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } else {
    const lastIndex = new Map<string, number>();
    lines.forEach((l, i) => lastIndex.set(key(l), i));
    output = lines.filter((l, i) => lastIndex.get(key(l)) === i);
  }

  return {
    text: output.join('\n'),
    before: lines.length,
    after: output.length,
    removed: lines.length - output.length,
  };
}

/* -------------------------------------------------------------------- slug */

/** Minimal transliteration table (Arabic + accented Latin → ASCII). */
const TRANSLITERATE: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'aa', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh',
  د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z',
  ع: 'a', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w',
  ي: 'y', ى: 'a', ة: 'h', ء: 'a', ئ: 'y', ؤ: 'w',
  ß: 'ss', æ: 'ae', ø: 'o', đ: 'd', ł: 'l', þ: 'th',
};

export interface SlugOptions {
  separator: '-' | '_';
  uppercase: boolean;
  transliterate: boolean;
  removeStopWords: boolean;
}

export function slugify(input: string, options: SlugOptions): string {
  let text = input.trim();
  if (options.transliterate) {
    text = text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u064B-\u0652]/g, '')
      .split('')
      .map((c) => TRANSLITERATE[c] ?? c)
      .join('');
  }
  let words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (options.removeStopWords && words.length > 1) {
    const filtered = words.filter((w) => !EN_STOP_WORDS.has(w) && !AR_STOP_WORDS.has(w));
    if (filtered.length) words = filtered;
  }
  const slug = words.join(options.separator);
  return options.uppercase ? slug.toUpperCase() : slug;
}

/* ------------------------------------------------------------ lorem ipsum */

const LOREM_WORDS =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nulla gravida orci a odio nullam varius turpis et commodo pharetra est eros suscipit mauris'.split(
    ' ',
  );

const ARABIC_LOREM_WORDS =
  'نص بديل هذا مثال على كلمات عربية تستخدم لملء التصميم قبل كتابة المحتوى الحقيقي وهي غير مترابطة المعنى وتصلح لاختبار الخطوط والفقرات والعناوين والمسافات في الصفحة بشكل واقعي ويمكن توليد المزيد منها حسب الحاجة لتجربة القوالب والواجهات المختلفة'.split(
    ' ',
  );

export type LoremUnit = 'words' | 'sentences' | 'paragraphs';

export interface LoremOptions {
  unit: LoremUnit;
  count: number;
  startWithLorem: boolean;
  html: boolean;
  language: 'latin' | 'arabic';
}

function pick(words: string[], rng: () => number): string {
  return words[Math.floor(rng() * words.length)];
}

function makeSentence(words: string[], rng: () => number, arabic: boolean): string {
  const length = 6 + Math.floor(rng() * 9);
  const parts = Array.from({ length }, () => pick(words, rng));
  const sentence = parts.join(' ');
  const capitalized = arabic ? sentence : sentence[0].toUpperCase() + sentence.slice(1);
  return `${capitalized}${arabic ? '.' : '.'}`;
}

export function generateLorem(options: LoremOptions, rng: () => number = Math.random): string {
  const arabic = options.language === 'arabic';
  const words = arabic ? ARABIC_LOREM_WORDS : LOREM_WORDS;
  const opener = arabic ? 'نص بديل يستخدم لملء التصميم' : 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

  if (options.unit === 'words') {
    const list: string[] = [];
    if (options.startWithLorem) list.push(...opener.replace(/,/g, '').split(' '));
    while (list.length < options.count) list.push(pick(words, rng));
    const text = list.slice(0, options.count).join(' ');
    const final = text.charAt(0).toUpperCase() + text.slice(1) + '.';
    return options.html ? `<p>${final}</p>` : final;
  }

  if (options.unit === 'sentences') {
    const sentences: string[] = [];
    for (let i = 0; i < options.count; i += 1) {
      sentences.push(i === 0 && options.startWithLorem ? `${opener}.` : makeSentence(words, rng, arabic));
    }
    const text = sentences.join(' ');
    return options.html ? `<p>${text}</p>` : text;
  }

  const paragraphs: string[] = [];
  for (let p = 0; p < options.count; p += 1) {
    const sentenceCount = 3 + Math.floor(rng() * 4);
    const sentences: string[] = [];
    for (let i = 0; i < sentenceCount; i += 1) {
      sentences.push(p === 0 && i === 0 && options.startWithLorem ? `${opener}.` : makeSentence(words, rng, arabic));
    }
    paragraphs.push(sentences.join(' '));
  }
  return options.html
    ? paragraphs.map((p) => `<p>${p}</p>`).join('\n')
    : paragraphs.join('\n\n');
}
