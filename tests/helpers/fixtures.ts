/**
 * Deterministic fixture images for the workflow tests, created with the same
 * native canvas engine the shim uses (PNG / JPEG / WebP encoders included).
 */
import { napi, NodeFile } from './browser-shim';

export interface Fixture {
  file: File;
  width: number;
  height: number;
  buffer: Buffer;
  mime: string;
}

/** Photo-like content: gradient + shapes, so lossy/lossless paths differ a lot. */
function paintPhoto(canvas: napi.Canvas, w: number, h: number): void {
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1e3a8a');
  grad.addColorStop(0.5, '#f59e0b');
  grad.addColorStop(1, '#10b981');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Deterministic pseudo-random noise overlay (keeps PNG size non-trivial).
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const colors = ['#ef4444', '#3b82f6', '#ffffff', '#000000', '#a855f7', '#fde047'];
  for (let i = 0; i < 220; i += 1) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.25 + rand() * 0.5;
    const x = rand() * w;
    const y = rand() * h;
    const r = 6 + rand() * 42;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Simple geometric content with distinct quadrants (useful for flip/rotate). */
function paintQuadrants(canvas: napi.Canvas, w: number, h: number): void {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, w / 2, h / 2);
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(w / 2, 0, w / 2, h / 2);
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(0, h / 2, w / 2, h / 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
}

export function makePhotoFile(
  width = 1000,
  height = 700,
  mime: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  name = 'photo.png',
): Fixture {
  const canvas = napi.createCanvas(width, height);
  paintPhoto(canvas, width, height);
  const buf =
    mime === 'image/jpeg'
      ? canvas.toBuffer('image/jpeg', 95)
      : mime === 'image/webp'
        ? canvas.toBuffer('image/webp', 95)
        : canvas.toBuffer('image/png');
  return wrapFixture(buf, mime, name, width, height);
}

export function makeQuadrantFile(
  width = 400,
  height = 300,
  mime: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  name = 'quadrants.png',
): Fixture {
  const canvas = napi.createCanvas(width, height);
  paintQuadrants(canvas, width, height);
  const buf =
    mime === 'image/jpeg'
      ? canvas.toBuffer('image/jpeg', 95)
      : mime === 'image/webp'
        ? canvas.toBuffer('image/webp', 95)
        : canvas.toBuffer('image/png');
  return wrapFixture(buf, mime, name, width, height);
}

/** Solid white background with a colored shape in the middle (bg-remover). */
export function makeBgFile(width = 600, height = 400): Fixture {
  const canvas = napi.createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ff5500';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 90, 0, Math.PI * 2);
  ctx.fill();
  const buf = canvas.toBuffer('image/png');
  return wrapFixture(buf, 'image/png', 'bg.png', width, height);
}

/** White background with a black signature stroke (for signature maker). */
export function makeSignatureFile(width = 800, height = 400): Fixture {
  const canvas = napi.createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(80, 320);
  ctx.bezierCurveTo(180, 120, 260, 360, 360, 190);
  ctx.bezierCurveTo(420, 90, 500, 300, 620, 170);
  ctx.stroke();
  const buf = canvas.toBuffer('image/png');
  return wrapFixture(buf, 'image/png', 'signature.png', width, height);
}

function wrapFixture(buf: Buffer, mime: string, name: string, width: number, height: number): Fixture {
  const file = new NodeFile([buf], name, { type: mime }) as unknown as File;
  return { file, width, height, buffer: buf, mime };
}

/** Load a result Blob back into a drawable canvas for pixel assertions. */
export async function blobToImage(blob: Blob): Promise<{ image: napi.Image; width: number; height: number }> {
  const buf = Buffer.from(await blob.arrayBuffer());
  const img = new napi.Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e: unknown) => reject(e instanceof Error ? e : new Error('load-failed'));
    img.src = `data:${blob.type || 'image/png'};base64,${buf.toString('base64')}`;
  });
  return { image: img, width: img.width, height: img.height };
}

export async function pixelAt(blob: Blob, x: number, y: number, w = 500, h = 500): Promise<[number, number, number, number]> {
  const { image } = await blobToImage(blob);
  const canvas = napi.createCanvas(Math.min(w, image.width), Math.min(h, image.height));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const d = ctx.getImageData(Math.min(x, canvas.width - 1), Math.min(y, canvas.height - 1), 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

export function distinctColors(blob: Blob, maxSamples = 200_000): Promise<number> {
  return blobToImage(blob).then(({ image }) => {
    const canvas = napi.createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set<number>();
    const step = Math.max(1, Math.floor(data.length / 4 / maxSamples));
    for (let i = 0; i < data.length; i += 4 * step) {
      seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      if (seen.size > 512) return 513;
    }
    return seen.size;
  });
}
