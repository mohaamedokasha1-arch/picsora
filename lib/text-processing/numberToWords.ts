/**
 * Number → words conversion for English and Arabic, implemented from scratch.
 * Supports integers up to the quadrillions plus decimals and currency mode.
 */

const EN_ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];

function enChunk(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) parts.push(`${EN_ONES[hundreds]} hundred`);
  if (rest) {
    if (rest < 20) parts.push(EN_ONES[rest]);
    else {
      const tens = Math.floor(rest / 10);
      const ones = rest % 10;
      parts.push(ones ? `${EN_TENS[tens]}-${EN_ONES[ones]}` : EN_TENS[tens]);
    }
  }
  return parts.join(' ');
}

export function integerToEnglish(value: bigint): string {
  if (value === 0n) return 'zero';
  const negative = value < 0n;
  let n = negative ? -value : value;
  const chunks: string[] = [];
  let scale = 0;
  while (n > 0n) {
    const chunk = Number(n % 1000n);
    if (chunk) chunks.unshift(`${enChunk(chunk)}${EN_SCALES[scale] ? ` ${EN_SCALES[scale]}` : ''}`);
    n /= 1000n;
    scale += 1;
  }
  const text = chunks.join(' ');
  return negative ? `negative ${text}` : text;
}

/* ------------------------------------------------------------------ Arabic */

const AR_ONES = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
  'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
/** [singular, dual, plural-few] for each scale. */
const AR_SCALES: [string, string, string][] = [
  ['', '', ''],
  ['ألف', 'ألفان', 'آلاف'],
  ['مليون', 'مليونان', 'ملايين'],
  ['مليار', 'ملياران', 'مليارات'],
  ['تريليون', 'تريليونان', 'تريليونات'],
  ['كوادريليون', 'كوادريليونان', 'كوادريليونات'],
];

function arChunk(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) parts.push(AR_HUNDREDS[hundreds]);
  if (rest) {
    if (rest < 20) parts.push(AR_ONES[rest]);
    else {
      const tens = Math.floor(rest / 10);
      const ones = rest % 10;
      parts.push(ones ? `${AR_ONES[ones]} و${AR_TENS[tens]}` : AR_TENS[tens]);
    }
  }
  return parts.join(' و');
}

/** Arabic tamyīz: 1 → singular, 2 → dual, 3–10 → broken plural, 11+ → accusative singular. */
function arScaleWord(chunk: number, scale: number): string {
  const [one, two, few] = AR_SCALES[scale];
  if (!one) return '';
  if (chunk === 1) return one;
  if (chunk === 2) return two;
  if (chunk >= 3 && chunk <= 10) return few;
  return scale === 1 ? 'ألفاً' : one;
}

export function integerToArabic(value: bigint): string {
  if (value === 0n) return 'صفر';
  const negative = value < 0n;
  let n = negative ? -value : value;
  const chunks: { value: number; scale: number }[] = [];
  let scale = 0;
  while (n > 0n) {
    const chunk = Number(n % 1000n);
    if (chunk) chunks.unshift({ value: chunk, scale });
    n /= 1000n;
    scale += 1;
  }
  const words = chunks.map(({ value: chunk, scale: s }) => {
    const scaleWord = arScaleWord(chunk, s);
    if (!scaleWord) return arChunk(chunk);
    if (chunk === 1 || chunk === 2) return scaleWord;
    return `${arChunk(chunk)} ${scaleWord}`;
  });
  const text = words.join(' و');
  return negative ? `سالب ${text}` : text;
}

/* ---------------------------------------------------------------- currency */

export interface CurrencyNames {
  code: string;
  enMajor: string;
  enMinor: string;
  arMajor: string;
  arMinor: string;
}

export const CURRENCIES: CurrencyNames[] = [
  { code: 'USD', enMajor: 'US dollars', enMinor: 'cents', arMajor: 'دولار أمريكي', arMinor: 'سنت' },
  { code: 'EUR', enMajor: 'euros', enMinor: 'cents', arMajor: 'يورو', arMinor: 'سنت' },
  { code: 'GBP', enMajor: 'pounds sterling', enMinor: 'pence', arMajor: 'جنيه إسترليني', arMinor: 'بنس' },
  { code: 'SAR', enMajor: 'Saudi riyals', enMinor: 'halalas', arMajor: 'ريال سعودي', arMinor: 'هللة' },
  { code: 'AED', enMajor: 'UAE dirhams', enMinor: 'fils', arMajor: 'درهم إماراتي', arMinor: 'فلس' },
  { code: 'EGP', enMajor: 'Egyptian pounds', enMinor: 'piastres', arMajor: 'جنيه مصري', arMinor: 'قرش' },
  { code: 'KWD', enMajor: 'Kuwaiti dinars', enMinor: 'fils', arMajor: 'دينار كويتي', arMinor: 'فلس' },
  { code: 'QAR', enMajor: 'Qatari riyals', enMinor: 'dirhams', arMajor: 'ريال قطري', arMinor: 'درهم' },
  { code: 'JOD', enMajor: 'Jordanian dinars', enMinor: 'fils', arMajor: 'دينار أردني', arMinor: 'فلس' },
];

export interface NumberToWordsOptions {
  language: 'en' | 'ar';
  currency?: string;
}

export interface NumberToWordsResult {
  words: string;
  error?: 'invalidNumber';
}

/** Convert Arabic-Indic digits to ASCII so both scripts are accepted. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[,\s_]/g, '');
}

export function numberToWords(raw: string, options: NumberToWordsOptions): NumberToWordsResult {
  const text = normalizeDigits(raw.trim());
  if (!text || !/^-?\d+(\.\d+)?$/.test(text)) return { words: '', error: 'invalidNumber' };

  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  const [intPart, fracPartRaw = ''] = body.split('.');
  const intValue = BigInt(intPart || '0');
  const isArabic = options.language === 'ar';
  const toWords = isArabic ? integerToArabic : integerToEnglish;

  const currency = options.currency ? CURRENCIES.find((c) => c.code === options.currency) : undefined;

  if (currency) {
    const minorDigits = (fracPartRaw + '00').slice(0, 2);
    const minorValue = BigInt(minorDigits);
    const majorWords = toWords(intValue);
    const majorName = isArabic ? currency.arMajor : currency.enMajor;
    const minorName = isArabic ? currency.arMinor : currency.enMinor;
    let out = `${majorWords} ${majorName}`;
    if (minorValue > 0n) {
      out += isArabic
        ? ` و${integerToArabic(minorValue)} ${minorName}`
        : ` and ${integerToEnglish(minorValue)} ${minorName}`;
    }
    if (negative) out = isArabic ? `سالب ${out}` : `negative ${out}`;
    return { words: capitalize(out, isArabic) };
  }

  let out = toWords(negative ? -intValue : intValue);
  if (fracPartRaw) {
    const digits = [...fracPartRaw]
      .map((d) => (isArabic ? AR_ONES[Number(d)] || 'صفر' : EN_ONES[Number(d)] || 'zero'))
      .join(' ');
    out += isArabic ? ` فاصلة ${digits}` : ` point ${digits}`;
  }
  return { words: capitalize(out, isArabic) };
}

function capitalize(text: string, isArabic: boolean): string {
  if (isArabic || !text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Render ASCII digits as Arabic-Indic numerals. */
export function toArabicNumerals(input: string): string {
  return input.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}
