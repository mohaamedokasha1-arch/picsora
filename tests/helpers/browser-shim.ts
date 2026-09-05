/**
 * Minimal browser environment for the local workflow tests.
 *
 * The site's processors are pure browser code (canvas, Image, File, Blob,
 * URL.createObjectURL…). jsdom alone cannot decode/encode raster images, so
 * this shim wires jsdom's DOM to `@napi-rs/canvas` (native canvas, WebP/JPEG/
 * PNG via the npm registry — no browser download needed) and polyfills the
 * handful of Web APIs the workspace relies on.
 *
 * It lets the tests exercise the REAL pipeline: upload File → validation →
 * decodeImage → tool processor → result Blob → ResultPanel.
 */
import { JSDOM } from 'jsdom';
import * as napi from '@napi-rs/canvas';
import { File as NodeFile, Blob as NodeBlob } from 'node:buffer';

export interface BlobRegistry {
  map: Map<string, Blob>;
  create(blob: Blob): string;
  revoke(url: string): void;
  last(): string | null;
}

let registry: BlobRegistry | null = null;

export function blobRegistry(): BlobRegistry {
  if (!registry) {
    let counter = 0;
    const map = new Map<string, Blob>();
    registry = {
      map,
      create(blob: Blob) {
        const url = `blob:test/${++counter}`;
        map.set(url, blob);
        return url;
      },
      revoke(url: string) {
        map.delete(url);
      },
      last() {
        const urls = [...map.keys()];
        return urls.length ? urls[urls.length - 1] : null;
      },
    };
  }
  return registry;
}

/**
 * napi Image extended with the HTMLImageElement contract the decoder uses
 * (`naturalWidth/naturalHeight`, `decoding`, blob: → data: URL loading).
 */
class TestImage extends napi.Image {
  private declaredSrc = '';
  private loading = false;
  decoding = 'auto';

  constructor() {
    super();
    // Instance-level definitions shadow the native class accessors without
    // tripping TypeScript's property→accessor override check.
    Object.defineProperty(this, 'src', {
      configurable: true,
      get: () => this.declaredSrc,
      set: (value: string) => this.setSrc(value),
    });
    Object.defineProperty(this, 'naturalWidth', {
      configurable: true,
      get: () => Number(this.width) || 0,
    });
    Object.defineProperty(this, 'naturalHeight', {
      configurable: true,
      get: () => Number(this.height) || 0,
    });
  }

  private setSrc(value: string) {
    this.declaredSrc = value;
    if (this.loading) return;
    this.loading = true;
    const blob = blobRegistry().map.get(value);
    const setNative = (target: string) => {
      this.loading = false;
      try {
        const native = Object.getOwnPropertyDescriptor(napi.Image.prototype, 'src');
        if (native?.set) native.set.call(this, target);
        else throw new Error('no native src setter');
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).onerror?.(err);
      }
    };
    if (blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          setNative(
            `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`,
          );
        })
        .catch(() => setNative(''));
    } else {
      setNative(value);
    }
  }
}

function patchCanvas(canvas: napi.Canvas): napi.Canvas {
  const anyCanvas = canvas as unknown as {
    toBlob?: (cb: (b: Blob | null) => void, type?: string, quality?: number) => void;
  };
  if (!anyCanvas.toBlob) {
    anyCanvas.toBlob = (
      cb: (b: Blob | null) => void,
      type = 'image/png',
      quality?: number,
    ) => {
      const mime = (type || 'image/png').toLowerCase();
      try {
        // Browsers express `quality` as 0..1; napi's encoder wants 0..100.
        const nativeQuality = quality !== undefined ? Math.round(quality * 100) : undefined;
        let buf: Buffer;
        if (mime === 'image/jpeg') {
          buf =
            nativeQuality !== undefined
              ? canvas.toBuffer('image/jpeg', nativeQuality)
              : canvas.toBuffer('image/jpeg');
        } else if (mime === 'image/webp') {
          try {
            buf =
              nativeQuality !== undefined
                ? canvas.toBuffer('image/webp', nativeQuality)
                : canvas.toBuffer('image/webp');
          } catch {
            buf = canvas.toBuffer('image/webp');
          }
        } else {
          buf = canvas.toBuffer('image/png');
        }
        cb(new NodeBlob([buf], { type: mime }) as unknown as Blob);
      } catch {
        cb(null);
      }
    };
  }
  // The napi canvas needs a small default size; processors always set it.
  return canvas;
}

export function installBrowserShim(): void {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const g = globalThis as Record<string, unknown>;
  // Some globals (navigator…) are getter-only on modern Node — redefine them.
  const setGlobal = (name: string, value: unknown) => {
    try {
      Object.defineProperty(globalThis, name, {
        value,
        writable: true,
        configurable: true,
      });
    } catch {
      g[name] = value;
    }
  };

  // DOM globals (jsdom owns the document; we only swap canvas creation).
  setGlobal('window', window);
  setGlobal('document', window.document);
  setGlobal('navigator', window.navigator);
  // DOM element classes used by React's event system and by `instanceof`.
  const domClasses: [string, unknown][] = [
    ['Event', window.Event],
    ['CustomEvent', window.CustomEvent],
    ['EventTarget', window.EventTarget],
    ['Node', window.Node],
    ['Element', window.Element],
    ['HTMLElement', window.HTMLElement],
    ['HTMLDocument', window.HTMLDocument],
    ['HTMLInputElement', window.HTMLInputElement],
    ['HTMLButtonElement', window.HTMLButtonElement],
    ['HTMLSelectElement', window.HTMLSelectElement],
    ['HTMLTextAreaElement', window.HTMLTextAreaElement],
    ['HTMLDivElement', window.HTMLDivElement],
    ['HTMLImageElement', window.HTMLImageElement],
    ['HTMLSpanElement', window.HTMLSpanElement],
    ['HTMLAnchorElement', window.HTMLAnchorElement],
    ['HTMLFormElement', window.HTMLFormElement],
    ['HTMLParagraphElement', window.HTMLParagraphElement],
    ['HTMLUListElement', window.HTMLUListElement],
    ['HTMLLIElement', window.HTMLLIElement],
  ];
  for (const [name, value] of domClasses) setGlobal(name, value);
  g.getComputedStyle = window.getComputedStyle.bind(window);
  g.requestAnimationFrame = window.requestAnimationFrame.bind(window);
  g.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  g.matchMedia =
    window.matchMedia?.bind(window) ??
    (() => ({ matches: false, addListener() {}, removeListener() {} }));
  g.IS_REACT_ACT_ENVIRONMENT = true;

  // Node's File/Blob have full slice()/arrayBuffer()/text() support.
  setGlobal('File', NodeFile);
  setGlobal('Blob', NodeBlob);

  // Canvas: any `document.createElement('canvas')` returns a native canvas.
  const originalCreateElement = window.document.createElement.bind(window.document);
  window.document.createElement = ((tag: string, options?: ElementCreationOptions) => {
    if (String(tag).toLowerCase() === 'canvas') {
      return patchCanvas(napi.createCanvas(1, 1));
    }
    return originalCreateElement(tag, options);
  }) as typeof window.document.createElement;

  // napi Canvas stands in for HTMLCanvasElement (canvasToBlob checks instanceof).
  setGlobal('HTMLCanvasElement', napi.Canvas);
  setGlobal('ImageData', napi.ImageData);
  setGlobal('Image', TestImage);
  setGlobal('Path2D', napi.Path2D);
  // OffscreenCanvas stays undefined → the code uses the regular canvas path
  // (exactly like browsers without OffscreenCanvas).

  // URL.createObjectURL → registry-backed results; TestImage resolves them.
  const url = URL as unknown as {
    createObjectURL?: (blob: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };
  url.createObjectURL = (blob: Blob) => blobRegistry().create(blob);
  url.revokeObjectURL = (urlToRevoke: string) => blobRegistry().revoke(urlToRevoke);

  // Real text rendering for watermark tests (best-effort, ignore failures).
  try {
    napi.GlobalFonts.registerFromPath(
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      'DejaVu Sans',
    );
  } catch {
    /* font missing is fine */
  }
}

export { NodeFile, NodeBlob, napi };
