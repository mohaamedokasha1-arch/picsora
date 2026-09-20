/**
 * HTML → Markdown converter. Parses with DOMParser (never innerHTML into the
 * live document) and walks the tree — scripts, styles and event handlers can
 * never execute; they are dropped from the output.
 */

const MAX_INPUT = 512 * 1024;

function textOf(node: Node): string {
  return (node.textContent ?? '').replace(/\s+/g, ' ');
}

function inlineChildren(el: Element, convert: (node: Node) => string): string {
  let out = '';
  el.childNodes.forEach((child) => {
    out += convert(child);
  });
  return out;
}

function convertNode(node: Node, convert: (node: Node) => string): string {
  if (node.nodeType === 3) {
    return (node.textContent ?? '').replace(/[ \t\f\v]+/g, ' ');
  }
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') return '';

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number(tag[1]);
      return `\n\n${'#'.repeat(level)} ${inlineChildren(el, convert).trim()}\n\n`;
    }
    case 'p':
    case 'div':
    case 'section':
    case 'article':
    case 'header':
    case 'footer':
    case 'main':
      return `\n\n${inlineChildren(el, convert).trim()}\n\n`;
    case 'br':
      return '  \n';
    case 'hr':
      return '\n\n---\n\n';
    case 'strong':
    case 'b':
      return `**${inlineChildren(el, convert).trim()}**`;
    case 'em':
    case 'i':
      return `*${inlineChildren(el, convert).trim()}*`;
    case 'code': {
      const code = (el.textContent ?? '').replace(/`/g, "'");
      return el.parentElement?.tagName.toLowerCase() === 'pre' ? code : `\`${code}\``;
    }
    case 'pre':
      return `\n\n\`\`\`\n${(el.textContent ?? '').replace(/\n+$/, '')}\n\`\`\`\n\n`;
    case 'a': {
      const href = el.getAttribute('href') ?? '';
      const label = inlineChildren(el, convert).trim() || href;
      if (!href || href.toLowerCase().startsWith('javascript:')) return label;
      return `[${label}](${href})`;
    }
    case 'img': {
      const alt = el.getAttribute('alt') ?? '';
      const src = el.getAttribute('src') ?? '';
      if (!src) return alt;
      return `![${alt}](${src})`;
    }
    case 'blockquote':
      return `\n\n${inlineChildren(el, convert)
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')}\n\n`;
    case 'ul':
      return `\n\n${listItems(el, convert, false)}\n\n`;
    case 'ol':
      return `\n\n${listItems(el, convert, true)}\n\n`;
    case 'li':
      return inlineChildren(el, convert).trim();
    case 'table':
      return `\n\n${convertTable(el, convert)}\n\n`;
    default:
      return inlineChildren(el, convert);
  }
}

function listItems(list: Element, convert: (node: Node) => string, ordered: boolean): string {
  const items: string[] = [];
  list.childNodes.forEach((child) => {
    if (child.nodeType === 1 && (child as Element).tagName.toLowerCase() === 'li') {
      items.push(convert(child).trim());
    }
  });
  return items
    .map((item, i) => {
      const nested = item.replace(/\n(?!\n)/g, '\n  ');
      return ordered ? `${i + 1}. ${nested}` : `- ${nested}`;
    })
    .join('\n');
}

function convertTable(table: Element, convert: (node: Node) => string): string {
  const rows: string[][] = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll('th, td').forEach((cell) => {
      cells.push(textOf(cell).trim().replace(/\|/g, '\\|'));
    });
    if (cells.length) rows.push(cells);
  });
  if (!rows.length) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(Math.max(0, cols - r.length)).fill('')];
  const lines = [`| ${pad(rows[0]).join(' | ')} |`, `| ${Array(cols).fill('---').join(' | ')} |`];
  for (const row of rows.slice(1)) lines.push(`| ${pad(row).join(' | ')} |`);
  return lines.join('\n');
}

export interface HtmlToMdResult {
  ok: boolean;
  markdown?: string;
  error?: string;
}

/** Convert an HTML fragment/document into Markdown. */
export function htmlToMarkdown(input: string): HtmlToMdResult {
  if (!input.trim()) return { ok: false, error: 'empty' };
  if (input.length > MAX_INPUT) return { ok: false, error: 'too-large' };
  try {
    const doc = new DOMParser().parseFromString(input, 'text/html');
    const convert = (node: Node): string => convertNode(node, convert);
    let md = convert(doc.body);
    // Normalise whitespace: collapse 3+ newlines, trim trailing spaces.
    md = md
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!md) return { ok: false, error: 'empty-output' };
    return { ok: true, markdown: `${md}\n` };
  } catch {
    return { ok: false, error: 'parse' };
  }
}
