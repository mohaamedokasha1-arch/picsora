/**
 * Client-side OCR powered by Tesseract.js.
 *
 * Everything runs locally in the browser: the recognition engine (WASM) and
 * the language data files are downloaded once from a public CDN and cached by
 * the browser, while the user's images and PDFs are never uploaded anywhere.
 */

export type OcrLang = 'eng' | 'ara' | 'eng+ara';

export const OCR_LANGS: { value: OcrLang; labelKey: string }[] = [
  { value: 'eng', labelKey: 'ocr.langEnglish' },
  { value: 'ara', labelKey: 'ocr.langArabic' },
  { value: 'eng+ara', labelKey: 'ocr.langBoth' },
];

const MAX_OCR_BYTES = 25 * 1024 * 1024;

interface TesseractWorker {
  recognize: (image: Blob) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
}

const workers = new Map<string, Promise<TesseractWorker>>();

function getWorker(lang: OcrLang, onProgress?: (ratio: number) => void): Promise<TesseractWorker> {
  const key = lang;
  const cached = workers.get(key);
  if (cached) return cached;

  const created: Promise<TesseractWorker> = (async () => {
    let mod: typeof import('tesseract.js');
    try {
      mod = await import('tesseract.js');
    } catch {
      throw new Error('ocr-engine-failed');
    }
    try {
      const worker = (await mod.createWorker(lang, undefined, {
        logger: (m: { status?: string; progress?: number }) => {
          if (m?.status === 'recognizing text' && typeof m.progress === 'number') {
            onProgress?.(Math.max(0, Math.min(1, m.progress)));
          }
          if (m?.status === 'loading language traineddata' && typeof m.progress === 'number') {
            onProgress?.(Math.max(0, Math.min(1, m.progress)) * 0.1);
          }
        },
      })) as unknown as TesseractWorker;
      return worker;
    } catch {
      throw new Error('ocr-model-failed');
    }
  })();

  workers.set(key, created);
  // Drop failed workers from the cache so a retry can start fresh.
  created.catch(() => {
    if (workers.get(key) === created) workers.delete(key);
  });
  return created;
}

/**
 * Recognise text in a single image Blob.
 * Throws `ocr-too-large`, `ocr-engine-failed`, `ocr-model-failed` or `ocr-failed`.
 */
export async function recognizeImage(
  image: Blob,
  lang: OcrLang = 'eng',
  onProgress?: (ratio: number) => void,
): Promise<string> {
  if (image.size > MAX_OCR_BYTES) throw new Error('ocr-too-large');
  if (image.size === 0) throw new Error('ocr-failed');
  const worker = await getWorker(lang, onProgress);
  try {
    const result = await worker.recognize(image);
    return (result?.data?.text ?? '').trim();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('ocr-')) throw error;
    throw new Error('ocr-failed');
  }
}

/**
 * Downscale an image Blob so OCR stays fast and memory-safe.
 * Large iPhone photos are capped at ~3000px on the long edge.
 */
export async function shrinkForOcr(image: Blob, maxEdge = 3000): Promise<Blob> {
  try {
    const bmp =
      typeof createImageBitmap === 'function'
        ? await createImageBitmap(image)
        : null;
    if (!bmp) return image;
    const longEdge = Math.max(bmp.width, bmp.height);
    if (longEdge <= maxEdge) {
      bmp.close?.();
      return image;
    }
    const scale = maxEdge / longEdge;
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close?.();
      return image;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    canvas.width = 0;
    canvas.height = 0;
    return out ?? image;
  } catch {
    return image;
  }
}
