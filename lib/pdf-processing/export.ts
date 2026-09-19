/**
 * Text-export formatters for the PDF → Markdown / HTML / CSV tools.
 *
 * Pure functions over the page strings produced by `extractPdfText` — no
 * pdf-lib, no DOM — so every byte of output is unit-testable. Scanned
 * (image-only) pages carry a placeholder instead of pretending text exists.
 */

export const EMPTY_PAGE_MARK = '(no extractable text on this page)';

function safeName(name: string): string {
  return (name || 'document').replace(/[[\]#*_`>]/g, '').slice(0, 120) || 'document';
}

/** Escape the five HTML-significant characters. Never trust PDF text. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format extracted pages as a readable Markdown document. */
export function pagesToMarkdown(pages: string[], fileName: string): string {
  const title = safeName(fileName.replace(/\.[^.]+$/, ''));
  const body = pages
    .map((text, i) => `## Page ${i + 1}\n\n${text.trim() || EMPTY_PAGE_MARK}`)
    .join('\n\n---\n\n');
  return `# ${title}\n\n${body}\n`;
}

/** Format extracted pages as a standalone, self-styled HTML document. */
export function pagesToHtml(pages: string[], fileName: string): string {
  const title = safeName(fileName.replace(/\.[^.]+$/, ''));
  const sections = pages
    .map((text, i) => {
      const paragraphs = (text.trim() || EMPTY_PAGE_MARK)
        .split(/\n{2,}/)
        .map((p) => `      <p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('\n');
      return `    <section aria-label="Page ${i + 1}">\n      <h2>Page ${i + 1}</h2>\n${paragraphs}\n    </section>`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.7;color:#1f2937;max-width:44rem;margin:0 auto;padding:2rem 1rem;background:#fff}
h1{font-size:1.5rem;border-bottom:2px solid #e5e7eb;padding-bottom:.5rem}
section{margin:2rem 0}
h2{font-size:1.1rem;color:#6b7280}
p{white-space:normal}
@media (prefers-color-scheme:dark){body{background:#111827;color:#e5e7eb}h1{border-color:#374151}h2{color:#9ca3af}}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${sections}
</body>
</html>
`;
}

/** Escape one CSV cell (RFC 4180 quoting). */
export function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Format extracted pages as CSV: one row per non-empty line
 * (page number, line number, text). Spreadsheet-ready.
 */
export function pagesToCsv(pages: string[]): string {
  const rows: string[] = ['page,line,text'];
  pages.forEach((text, pageIndex) => {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      rows.push(`${pageIndex + 1},0,${csvCell(EMPTY_PAGE_MARK)}`);
      return;
    }
    lines.forEach((line, lineIndex) => {
      rows.push(`${pageIndex + 1},${lineIndex + 1},${csvCell(line)}`);
    });
  });
  return `${rows.join('\r\n')}\r\n`;
}
