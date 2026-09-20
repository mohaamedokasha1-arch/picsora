/**
 * Progress reporting for the OCR tools.
 *
 * The real tesseract.js worker downloads its engine and language data from a
 * CDN, so it cannot run in CI. This test swaps the module for a stub that
 * reproduces the one behaviour the code under test depends on — `logger` is
 * captured inside the createWorker closure and `recognize()` offers no
 * per-call logger — and then drives the REAL `recognizeImage()` from
 * lib/ocr/tesseract.ts. Nothing here re-implements that function.
 *
 * Run with:  npx tsx scripts/tests/ocr.test.ts
 */
import Module from 'node:module';
import { createRequire } from 'node:module';

const req = createRequire(`${process.cwd()}/package.json`);
const tesseractPath = req.resolve('tesseract.js');

const created: { lang: string; logger: (m: any) => void }[] = [];
const stub = {
  createWorker: async (lang: string, _oem: unknown, options: { logger: (m: any) => void }) => {
    created.push({ lang, logger: options.logger });
    let initialised = false;
    return {
      recognize: async (image: { size: number }) => {
        const entry = created[created.length - 1];
        // The real worker loads the language data once, at initialisation,
        // then emits only 'recognizing text' on every later call — through the
        // logger it was created with.
        if (!initialised) {
          initialised = true;
          entry.logger({ status: 'loading language traineddata', progress: 1 });
        }
        for (const p of [0.25, 0.5, 0.75, 1]) {
          entry.logger({ status: 'recognizing text', progress: p });
        }
        return { data: { text: `text-for-${image.size}` } };
      },
      terminate: async () => undefined,
    };
  },
};
(req.cache as Record<string, unknown>)[tesseractPath] = {
  id: tesseractPath, filename: tesseractPath, loaded: true, exports: stub,
} as unknown as Module;

async function main() {
  const { recognizeImage } = await import('@/lib/ocr/tesseract');

  let fails = 0;
  const eq = (name: string, a: unknown, b: unknown) => {
    const ok = JSON.stringify(a) === JSON.stringify(b);
    if (!ok) { fails += 1; console.log('  ✗', name, JSON.stringify(a), '!=', JSON.stringify(b)); }
    else console.log('  ✓', name, JSON.stringify(a));
  };

  const blob = (n: number) => ({ size: n }) as Blob;

  /* Run 1 — engine is created here, so the logger closure binds now. */
  const run1: number[] = [];
  const out1 = await recognizeImage(blob(100), 'eng', (r) => run1.push(Number(r.toFixed(3))));
  eq('run 1 returns the recognised text', out1, 'text-for-100');
  eq('run 1 receives recognition progress', run1, [0.1, 0.25, 0.5, 0.75, 1]);

  /* Run 2 — SAME language, so the cached worker (and its logger) is reused.
     This is the case that used to report into run 1's callback. */
  const run2: number[] = [];
  const out2 = await recognizeImage(blob(200), 'eng', (r) => run2.push(Number(r.toFixed(3))));
  eq('run 2 returns its own text', out2, 'text-for-200');
  eq('run 2 receives progress on the cached worker', run2, [0.25, 0.5, 0.75, 1]);
  eq('run 1 callback is not written to again', run1, [0.1, 0.25, 0.5, 0.75, 1]);

  /* Run 3 — no callback at all: must not throw and must not resurrect an old one. */
  const out3 = await recognizeImage(blob(300), 'eng');
  eq('run 3 with no callback still works', out3, 'text-for-300');
  eq('run 1 callback still untouched', run1, [0.1, 0.25, 0.5, 0.75, 1]);

  /* The engine is still cached — created once, not once per image. */
  eq('worker created once and reused', created.length, 1);

  /* Guards unchanged. */
  for (const [name, size, expected] of [
    ['oversize rejected', 26 * 1024 * 1024, 'ocr-too-large'],
    ['empty rejected', 0, 'ocr-failed'],
  ] as const) {
    try { await recognizeImage(blob(size), 'eng'); console.log('  ✗', name, '— did not throw'); fails += 1; }
    catch (e) { eq(name, (e as Error).message, expected); }
  }
  console.log(fails ? `\n${fails} OCR FAILURES` : 'OCR ALL PASS');
  process.exitCode = fails ? 1 : 0;
}

void main();
