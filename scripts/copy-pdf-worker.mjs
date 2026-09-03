/**
 * Copies the pdf.js worker from node_modules into /public.
 *
 * Why a copy step instead of `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`:
 * webpack turns that into an asset module and then runs the already-minified
 * worker through Terser, which fails on its top-level ESM syntax. Serving the
 * file statically from our own origin keeps CSP `worker-src 'self'` intact and
 * never touches a CDN.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const buildDir = dirname(require.resolve('pdfjs-dist/build/pdf.min.mjs'));

mkdirSync('public', { recursive: true });
copyFileSync(join(buildDir, 'pdf.worker.min.mjs'), join('public', 'pdf.worker.min.mjs'));
console.log('Copied pdf.worker.min.mjs to public/');
