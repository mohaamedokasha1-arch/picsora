/**
 * Vendoring script for the AI upscaler model weights.
 *
 * The ESRGAN weights live in `public/models/esrgan/` (committed, same-origin,
 * no CDN). This script exists so the vendored bytes stay auditable and
 * reproducible:
 *
 *   node scripts/fetch-ai-models.mjs --check   verify checksums of the committed files
 *   node scripts/fetch-ai-models.mjs           re-download them from npm
 *
 * It is deliberately NOT part of `predev`/`prebuild`: the committed files are
 * authoritative, so a plain `npm install && npm run build` works offline.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PACKAGE = '@upscalerjs/esrgan-slim@1.0.0';
const SCALES = ['x2', 'x3', 'x4'];
const DEST = join('public', 'models', 'esrgan');

/** sha256 + byte length of every vendored file (see public/models/esrgan/README.md). */
const EXPECTED = {
  'x2/model.json': ['8efb488c2caed0196a6163e3f06798f9245e92623ffd50654a26c372e09150ea', 12336],
  'x2/group1-shard1of1.bin': ['5cb464ae4d390ce0a771afd5feaf60fbfcdb18ab48a56db98cdf6b88202369de', 888300],
  'x3/model.json': ['642208758cf6c42a4f88745894b45cc03776681a46027b85963f01fe003e9917', 12336],
  'x3/group1-shard1of1.bin': ['9d344609abd1e29bd3924f9c4e9ffaa1aee6be7c3586bab0f52863597858a2ba', 907260],
  'x4/model.json': ['3a2eaa642232567e7d2a2e7638c9704f42f63f355fc656c18aa78bf2da1d903d', 12336],
  'x4/group1-shard1of1.bin': ['82637daaf3ba024df5e9da2389e8992e7a6e8a992ba6268ce6bc490c92e9516e', 933804],
};

function digest(file) {
  const bytes = readFileSync(file);
  return [createHash('sha256').update(bytes).digest('hex'), bytes.length];
}

function check() {
  let bad = 0;
  for (const [rel, [hash, size]] of Object.entries(EXPECTED)) {
    const file = join(DEST, rel);
    let actual;
    try {
      actual = digest(file);
    } catch {
      console.error(`✗ ${rel}: missing`);
      bad += 1;
      continue;
    }
    if (actual[0] !== hash || actual[1] !== size) {
      console.error(`✗ ${rel}: expected ${hash.slice(0, 12)}…/${size}B, got ${actual[0].slice(0, 12)}…/${actual[1]}B`);
      bad += 1;
    } else {
      console.log(`✓ ${rel} (${size.toLocaleString('en-US')} bytes)`);
    }
  }
  if (bad) {
    console.error(`\n${bad} file(s) do not match. Run: node scripts/fetch-ai-models.mjs`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${Object.keys(EXPECTED).length} model files verified.`);
  }
}

function fetchModels() {
  const work = mkdtempSync(join(tmpdir(), 'esrgan-'));
  try {
    console.log(`Downloading ${PACKAGE} …`);
    execFileSync('npm', ['pack', PACKAGE, '--pack-destination', work], { stdio: 'ignore' });
    const [tarball] = execFileSync('ls', [work], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.tgz'));
    execFileSync('tar', ['xzf', join(work, tarball), '-C', work]);
    const src = join(work, 'package', 'models');

    for (const scale of SCALES) {
      mkdirSync(join(DEST, scale), { recursive: true });
      for (const file of ['model.json', 'group1-shard1of1.bin']) {
        copyFileSync(join(src, scale, file), join(DEST, scale, file));
        console.log(`copied ${scale}/${file}`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log('\nVerifying …');
  check();
}

if (process.argv.includes('--check')) check();
else fetchModels();
