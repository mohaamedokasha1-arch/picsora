/**
 * Search ranking tests.
 *
 * Search is the main way people find a tool, so the ranking is checked against
 * the REAL registry and the REAL locale files: a query like "compress photo"
 * must land on the Image Compressor, and every tool must be findable by its own
 * name in both languages.
 *
 * Run with:  npx tsx scripts/tool-tests/run-search.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOOLS } from '@/lib/tools/registry';
import { normalizeQuery, searchTools, type SearchItem } from '@/lib/tools/search';
import { assert, assertEq, summary, test } from './testkit';

type Messages = Record<string, unknown>;

function messages(locale: 'en' | 'ar'): Messages {
  return JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8')) as Messages;
}

function pick(source: Messages, path: string): string {
  const value = path.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
  return typeof value === 'string' ? value : '';
}

function buildIndex(locale: 'en' | 'ar'): SearchItem[] {
  const m = messages(locale);
  return TOOLS.map((tool) => {
    const name = pick(m, tool.nameKey);
    const description = pick(m, tool.shortKey);
    const category = pick(m, `categoryMeta.${tool.category}.name`);
    return {
      slug: tool.slug,
      name,
      description,
      icon: tool.icon,
      category,
      popular: tool.popular ?? false,
      nameNorm: normalizeQuery(name),
      descNorm: normalizeQuery(description),
      keysNorm: normalizeQuery(tool.keywords.join(' ')),
      catNorm: normalizeQuery(category),
    };
  });
}

const en = buildIndex('en');
const ar = buildIndex('ar');

function rank(query: string, index: SearchItem[] = en): string[] {
  return searchTools(index, query).map((item) => item.slug);
}

async function main() {
  console.log('\n🔎 tool search');

  await test('function words reach the right tool, not just the name', async () => {
    assertEq(rank('compress photo')[0], 'image-compressor', '"compress photo" → Image Compressor');
    assertEq(rank('resize picture')[0], 'image-resizer', '"resize picture" → Image Resizer');
    assertEq(rank('combine pdf')[0], 'pdf-merger', '"combine pdf" → PDF Merger');
    assertEq(rank('make image smaller')[0], 'image-compressor', '"make image smaller" → Image Compressor');
    assertEq(rank('shrink a photo')[0], 'image-compressor', '"shrink a photo" → Image Compressor');
    assertEq(rank('join two pdfs')[0], 'pdf-merger', '"join two pdfs" → PDF Merger');
    assertEq(rank('change image size')[0], 'image-resizer', '"change image size" → Image Resizer');
  });

  await test('word forms and plurals are folded', async () => {
    assertEq(rank('compressing images')[0], 'image-compressor', 'gerund is understood');
    assert(rank('convert pictures to jpg').includes('jpg-to-png'), 'plural + synonym reach the converter');
    assertEq(rank('convert png to jpg')[0], 'png-to-jpg', 'format names win for a format query');
    assertEq(rank('convert jpg to png')[0], 'jpg-to-png', 'the direction in the query is honoured');
    assert(rank('resizing').includes('image-resizer'), '"resizing" finds the resizer');
  });

  await test('every tool is findable by its own name', async () => {
    const misses: string[] = [];
    for (const tool of TOOLS) {
      const item = en.find((entry) => entry.slug === tool.slug);
      if (!item) continue;
      const results = rank(item.name);
      const first = en.find((entry) => entry.slug === results[0]);
      const tied = first?.nameNorm === item.nameNorm;
      if (results[0] !== tool.slug && !tied) {
        misses.push(`${tool.slug} → ${results.slice(0, 3).join(', ') || 'nothing'}`);
      }
    }
    assertEq(misses.length, 0, `all ${TOOLS.length} tools rank first for their own name${misses.length ? `: ${misses.join(' | ')}` : ''}`);
  });

  await test('the new tools are reachable by function words', async () => {
    assertEq(rank('blur a face')[0], 'image-blur', '"blur a face" → Image Blur');
    assert(
      ['image-blur', 'image-pixelate'].includes(rank('censor number plate')[0]),
      'a redaction query reaches a redaction tool',
    );
    assertEq(rank('blur number plate')[0], 'image-blur', '"blur number plate" → Image Blur');
    assertEq(rank('pixelate photo')[0], 'image-pixelate', '"pixelate photo" → Image Pixelate');
    assertEq(rank('brighten a dark photo')[0], 'brightness-contrast', '"brighten a dark photo" → Brightness & Contrast');
    assertEq(rank('black and white filter')[0], 'image-filters', '"black and white filter" → Image Filters');
    assertEq(rank('rounded corners')[0], 'rounded-corners', '"rounded corners" → Rounded Corners');
    assertEq(rank('exif viewer')[0], 'image-metadata', '"exif viewer" → Image Metadata');
    assertEq(rank('add page numbers to pdf')[0], 'pdf-page-numbers', 'page numbers');
    assertEq(rank('pdf watermark')[0], 'pdf-watermark', 'pdf watermark beats the image one');
    assertEq(rank('edit pdf metadata')[0], 'pdf-metadata-editor', 'pdf metadata editor');
    assertEq(rank('extract images from pdf')[0], 'pdf-extract-images', 'pdf image extractor');
    assertEq(rank('sort lines')[0], 'line-sorter', 'line sorter');
    assertEq(rank('extract emails from text')[0], 'text-extractor', 'text extractor');
    assertEq(rank('word frequency')[0], 'text-frequency-counter', 'frequency counter, not the word counter');
    assertEq(rank('json to csv')[0], 'json-csv-converter', 'json ↔ csv');
    assertEq(rank('parse a url')[0], 'url-parser', 'url parser');
    assertEq(rank('unix timestamp')[0], 'timestamp-converter', 'timestamp converter');
    assertEq(rank('cron expression')[0], 'cron-generator', 'cron generator');
  });

  await test('Arabic queries reach the same tools', async () => {
    assert(rank('ضغط صورة', ar).slice(0, 3).includes('image-compressor'), 'ضغط صورة → ضغط الصور');
    assert(
      ['image-compressor', 'image-to-exact-kb'].includes(rank('ضغط الصور', ar)[0]),
      'ضغط الصور reaches a compressor',
    );
    assertEq(rank('دمج ملفات pdf', ar)[0], 'pdf-merger', 'دمج pdf');
    assertEq(rank('تغيير حجم الصورة', ar)[0], 'image-resizer', 'تغيير الحجم');
    assertEq(rank('ترقيم صفحات pdf', ar)[0], 'pdf-page-numbers', 'ترقيم الصفحات');
    assertEq(rank('حذف الخلفية', ar)[0], 'background-remover', 'حذف الخلفية');
    // Two tools can share an Arabic name (they differ only in scope), so a tie
    // between identical names still counts as found.
    const arabicMisses: string[] = [];
    for (const tool of TOOLS) {
      const item = ar.find((entry) => entry.slug === tool.slug);
      if (!item) continue;
      const results = rank(item.name, ar);
      const first = ar.find((entry) => entry.slug === results[0]);
      const tied = first?.nameNorm === item.nameNorm;
      if (results[0] !== tool.slug && !tied) {
        arabicMisses.push(`${tool.slug} → ${results.slice(0, 3).join(', ') || 'nothing'}`);
      }
    }
    assertEq(arabicMisses.length, 0, `Arabic names all rank first${arabicMisses.length ? `: ${arabicMisses.join(' | ')}` : ''}`);
  });

  await test('unrelated queries return nothing, precise ones stay precise', async () => {
    assertEq(rank('zzzq qqqz').length, 0, 'junk returns no results');
    assertEq(rank('').length, 0, 'empty query returns nothing');
    assertEq(rank('    ').length, 0, 'whitespace query returns nothing');
    assertEq(rank('compress pdf')[0], 'pdf-compressor', 'pdf compressor first for "compress pdf"');
    const results = rank('compress photo');
    assert(results.length <= 8, 'never returns more than eight results');
    assertEq(new Set(results).size, results.length, 'no duplicate results');
  });

  process.exitCode = summary();
}

void main();
