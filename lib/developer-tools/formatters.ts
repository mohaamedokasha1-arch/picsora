/**
 * Dynamic loaders for the heavyweight, browser-only code tools.
 *
 * Prettier's standalone build and Terser both run fully client-side (no
 * telemetry, no network). They are imported lazily here so webpack keeps them
 * in their own chunks and they never enter the main bundle.
 */

export interface CodeSizeStats {
  originalBytes: number;
  outputBytes: number;
  savedPercent: number;
  originalLines: number;
  outputLines: number;
}

export function sizeStats(original: string, output: string): CodeSizeStats {
  const encoder = new TextEncoder();
  const originalBytes = encoder.encode(original).length;
  const outputBytes = encoder.encode(output).length;
  return {
    originalBytes,
    outputBytes,
    savedPercent: originalBytes ? ((originalBytes - outputBytes) / originalBytes) * 100 : 0,
    originalLines: original ? original.split('\n').length : 0,
    outputLines: output ? output.split('\n').length : 0,
  };
}

export class CodeToolError extends Error {
  readonly key: string;
  readonly detail: string;
  constructor(key: string, detail = '') {
    super(detail || key);
    this.key = key;
    this.detail = detail;
  }
}

/** Format JavaScript / TypeScript with Prettier standalone. */
export async function formatJavaScript(code: string, indent = 2): Promise<string> {
  try {
    const [{ format }, babel, estree] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/babel'),
      import('prettier/plugins/estree'),
    ]);
    return await format(code, {
      parser: 'babel',
      plugins: [babel.default ?? babel, estree.default ?? estree],
      tabWidth: indent,
      semi: true,
      singleQuote: true,
    });
  } catch (error) {
    throw new CodeToolError('jsSyntax', error instanceof Error ? error.message : '');
  }
}

/** Format CSS with Prettier standalone (postcss plugin). */
export async function formatCss(code: string, indent = 2): Promise<string> {
  try {
    const [{ format }, postcss] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/postcss'),
    ]);
    return await format(code, {
      parser: 'css',
      plugins: [postcss.default ?? postcss],
      tabWidth: indent,
    });
  } catch (error) {
    throw new CodeToolError('cssSyntax', error instanceof Error ? error.message : '');
  }
}

/** Minify JavaScript with Terser's browser build. */
export async function minifyJavaScript(code: string): Promise<string> {
  try {
    const { minify } = await import('terser');
    const result = await minify(code, {
      compress: true,
      mangle: true,
      format: { comments: false },
    });
    if (!result.code) throw new Error('empty output');
    return result.code;
  } catch (error) {
    throw new CodeToolError('jsSyntax', error instanceof Error ? error.message : '');
  }
}
