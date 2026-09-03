/**
 * Dependency-free CSS minifier.
 *
 * Written by hand (rather than pulling in a package) because the required
 * transformations — comment stripping, whitespace collapsing, value shortening
 * — are string-level and a library would add bundle weight for no benefit.
 * String literals, url() values and data URIs are preserved verbatim.
 */

export interface MinifyStats {
  originalBytes: number;
  minifiedBytes: number;
  savedPercent: number;
}

export interface CssMinifyResult {
  css: string;
  stats: MinifyStats;
}

/** Split CSS into "code" and "literal" segments so literals are never touched. */
function segments(input: string): { text: string; literal: boolean }[] {
  const out: { text: string; literal: boolean }[] = [];
  let buffer = '';
  let i = 0;
  const push = (text: string, literal: boolean) => {
    if (text) out.push({ text, literal });
  };

  while (i < input.length) {
    const char = input[i];

    // Comment
    if (char === '/' && input[i + 1] === '*') {
      const end = input.indexOf('*/', i + 2);
      push(buffer, false);
      buffer = '';
      // Preserve `/*! ... */` bang comments (licences).
      if (input[i + 2] === '!') push(input.slice(i, end === -1 ? input.length : end + 2), true);
      i = end === -1 ? input.length : end + 2;
      continue;
    }

    // Quoted string
    if (char === '"' || char === "'") {
      push(buffer, false);
      buffer = '';
      let j = i + 1;
      while (j < input.length && (input[j] !== char || input[j - 1] === '\\')) j += 1;
      push(input.slice(i, j + 1), true);
      i = j + 1;
      continue;
    }

    // url(...) — may contain unquoted data URIs
    if (char === 'u' && /^url\(/i.test(input.slice(i, i + 4))) {
      const end = input.indexOf(')', i);
      push(buffer, false);
      buffer = '';
      const body = input.slice(i, end === -1 ? input.length : end + 1);
      push(body.replace(/\s+/g, ''), true);
      i = end === -1 ? input.length : end + 1;
      continue;
    }

    buffer += char;
    i += 1;
  }
  push(buffer, false);
  return out;
}

function shortenHex(css: string): string {
  return css.replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3\b/gi, '#$1$2$3');
}

function shortenZeros(css: string): string {
  return css
    .replace(/(^|[\s:,(])0+(\.\d+)/g, '$1$2') // 0.5 → .5
    .replace(/\b0(px|em|rem|%|vh|vw|pt|ex|ch|vmin|vmax|cm|mm|in|pc)\b/g, '0');
}

export function minifyCss(input: string): CssMinifyResult {
  const originalBytes = new TextEncoder().encode(input).length;

  const minified = segments(input)
    .map(({ text, literal }) => {
      if (literal) return text;
      let out = text.replace(/\s+/g, ' ');
      out = out.replace(/\s*([{}:;,>~+])\s*/g, '$1');
      out = out.replace(/;\}/g, '}');
      out = shortenZeros(shortenHex(out));
      return out;
    })
    .join('')
    .trim();

  const minifiedBytes = new TextEncoder().encode(minified).length;
  return {
    css: minified,
    stats: {
      originalBytes,
      minifiedBytes,
      savedPercent: originalBytes ? ((originalBytes - minifiedBytes) / originalBytes) * 100 : 0,
    },
  };
}

/** Fallback CSS beautifier used if Prettier fails to load. */
export function formatCssFallback(input: string, indentSize = 2): string {
  const pad = ' '.repeat(indentSize);
  const compact = minifyCss(input).css;
  let depth = 0;
  let out = '';
  for (let i = 0; i < compact.length; i += 1) {
    const char = compact[i];
    if (char === '{') {
      depth += 1;
      out += ' {\n' + pad.repeat(depth);
    } else if (char === '}') {
      depth = Math.max(0, depth - 1);
      out = out.replace(/\s+$/, '');
      out += '\n' + pad.repeat(depth) + '}\n' + pad.repeat(depth);
    } else if (char === ';') {
      out += ';\n' + pad.repeat(depth);
    } else if (char === ',' && depth === 0) {
      out += ',\n';
    } else {
      out += char;
    }
  }
  return out.replace(/\n\s*\n+/g, '\n').trim() + '\n';
}
