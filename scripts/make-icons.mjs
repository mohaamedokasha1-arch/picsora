// Generates the PWA/app icons (PNG) and the OG image (SVG) — no dependencies.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const na = a / 255;
    const oa = px[i + 3] / 255;
    const outA = na + oa * (1 - na);
    if (outA === 0) return;
    px[i] = Math.round((r * na + px[i] * oa * (1 - na)) / outA);
    px[i + 1] = Math.round((g * na + px[i + 1] * oa * (1 - na)) / outA);
    px[i + 2] = Math.round((b * na + px[i + 2] * oa * (1 - na)) / outA);
    px[i + 3] = Math.round(outA * 255);
  };
  const inRounded = (x, y) => {
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inRounded(x + 0.5, y + 0.5)) set(x, y, 79, 70, 229, 255);
    }
  }
  const circle = (cx, cy, r, col) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) set(x, y, col[0], col[1], col[2], col[3]);
      }
  };
  const line = (x1, y1, x2, y2, w, col) => {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, w / 2, col);
    }
  };
  const white = [255, 255, 255, 255];
  circle(size * 0.40, size * 0.36, size * 0.155, white);
  line(size * 0.23, size * 0.76, size * 0.45, size * 0.50, size * 0.075, white);
  line(size * 0.45, size * 0.50, size * 0.62, size * 0.64, size * 0.075, white);
  line(size * 0.62, size * 0.64, size * 0.81, size * 0.43, size * 0.075, white);
  circle(size * 0.81, size * 0.40, size * 0.065, white);
  return encodePNG(size, size, px);
}

mkdirSync('public/icons', { recursive: true });
mkdirSync('public/images', { recursive: true });

writeFileSync('public/icons/icon-192.png', makeIcon(192));
writeFileSync('public/icons/icon-512.png', makeIcon(512));
writeFileSync('public/icons/apple-touch-icon.png', makeIcon(180));

writeFileSync(
  'public/icons/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="#4f46e5"/><circle cx="15.5" cy="14.5" r="6" fill="#fff" fill-opacity="0.95"/><path d="M9 30.5L18.5 19.5L25 26L33 17" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="33" cy="15.5" r="2.6" fill="#fff"/></svg>`,
);

writeFileSync(
  'public/images/og-image.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#0b1020"/><rect x="60" y="60" width="1080" height="510" rx="32" fill="#131a33"/><g transform="translate(120,150) scale(7)"><rect x="0" y="0" width="40" height="40" rx="10" fill="#4f46e5"/><circle cx="15.5" cy="14.5" r="6" fill="#fff" fill-opacity="0.95"/><path d="M9 30.5L18.5 19.5L25 26L33 17" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="33" cy="15.5" r="2.6" fill="#fff"/></g><text x="120" y="480" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="700" fill="#ffffff">Pixora</text><text x="120" y="540" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#94a3b8">Free, private image tools — right in your browser</text></svg>`,
);

console.log('Icons and OG image generated.');
