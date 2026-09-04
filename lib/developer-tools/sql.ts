/**
 * Tiny dependency-free SQL formatter. It tokenises string literals and
 * comments so keywords inside them are never touched, then lays clauses out
 * with newlines and indentation. Runs 100% locally.
 */

export const MAX_SQL_LENGTH = 500_000;

export type SqlKeywordCase = 'upper' | 'lower' | 'preserve';

export interface SqlFormatOptions {
  keywordCase: SqlKeywordCase;
  indentSize: 2 | 4;
}

// Clauses that start on their own line at the current paren depth.
const MAJOR = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'UNION',
  'UNION ALL',
  'EXCEPT',
  'INTERSECT',
  'VALUES',
  'SET',
  'RETURNING',
  'WINDOW',
]);

// JOIN-family keywords start their own line, indented one extra level.
const JOIN = new Set([
  'JOIN',
  'INNER JOIN',
  'LEFT JOIN',
  'LEFT OUTER JOIN',
  'RIGHT JOIN',
  'RIGHT OUTER JOIN',
  'FULL JOIN',
  'FULL OUTER JOIN',
  'CROSS JOIN',
  'NATURAL JOIN',
]);

const CONDITION = new Set(['AND', 'OR']);

const COMPOUND = ['GROUP BY', 'ORDER BY', 'UNION ALL', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'NATURAL JOIN', 'INSERT INTO'];

interface Token {
  text: string;
  kind: 'word' | 'other';
}

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) {
      tokens.push({ text: buf, kind: /\s/.test(buf) ? 'other' : 'word' });
      buf = '';
    }
  };
  while (i < sql.length) {
    const c = sql[i];
    // Line comment
    if (c === '-' && sql[i + 1] === '-') {
      flush();
      let j = i;
      while (j < sql.length && sql[j] !== '\n') j += 1;
      tokens.push({ text: sql.slice(i, j), kind: 'other' });
      i = j;
      continue;
    }
    // Block comment
    if (c === '/' && sql[i + 1] === '*') {
      flush();
      const end = sql.indexOf('*/', i + 2);
      const j = end < 0 ? sql.length : end + 2;
      tokens.push({ text: sql.slice(i, j), kind: 'other' });
      i = j;
      continue;
    }
    // String literal
    if (c === "'" || c === '"' || c === '`') {
      flush();
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c) {
          if (sql[j + 1] === c) {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      tokens.push({ text: sql.slice(i, j), kind: 'other' });
      i = j;
      continue;
    }
    if (/\s/.test(c)) {
      flush();
      i += 1;
      continue;
    }
    if (c === '(' || c === ')' || c === ',' || c === ';') {
      flush();
      tokens.push({ text: c, kind: 'other' });
      i += 1;
      continue;
    }
    buf += c;
    i += 1;
  }
  flush();
  return tokens.filter((t) => t.text.trim() !== '' || t.kind === 'other');
}

function applyCase(word: string, mode: SqlKeywordCase): string {
  if (mode === 'upper') return word.toUpperCase();
  if (mode === 'lower') return word.toLowerCase();
  return word;
}

/** Format SQL with newlines + indentation. Never throws on weird input. */
export function formatSql(input: string, options: SqlFormatOptions): string {
  if (input.length > MAX_SQL_LENGTH) throw new Error('sql-too-large');
  const indentUnit = ' '.repeat(options.indentSize);
  const pad = (level: number) => indentUnit.repeat(Math.max(0, level));
  const tokens = tokenize(input);
  // Merge compound keywords (GROUP BY, LEFT JOIN, …).
  const merged: Token[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    let done = false;
    for (const compound of COMPOUND) {
      const parts = compound.split(' ');
      const slice = tokens.slice(i, i + parts.length);
      if (
        slice.length === parts.length &&
        slice.every((t, k) => t.kind === 'word' && t.text.toUpperCase() === parts[k])
      ) {
        merged.push({ text: slice.map((t) => t.text).join(' '), kind: 'word' });
        i += parts.length - 1;
        done = true;
        break;
      }
    }
    if (!done) merged.push(tokens[i]);
  }

  const lines: string[] = [];
  let current = '';
  /** Indent level the pending line will be flushed at. */
  let curLevel = 0;
  let paren = 0;
  let cont = 0;
  let selectList = false;
  /** Paren depth when the current clause started — commas deeper stay inline. */
  let clauseBase = 0;
  /** Stack tracking function-call parens (kept inline) vs block parens. */
  const parenKind: ('block' | 'inline')[] = [];
  const KEEP_SPACE_BEFORE_PAREN =
    /\b(IN|EXISTS|NOT|BETWEEN|LIKE|CASE|ELSE|THEN|WHEN|FROM|JOIN|WHERE|ON|USING|AND|OR|BY|INTO|TABLE|VALUES|SELECT|SET|AS|DISTINCT|UNION|ALL|TOP|LIMIT|OFFSET|ORDER|GROUP|HAVING)$/i;

  const flush = (level: number) => {
    if (current.trim()) lines.push(pad(level) + current.trim());
    current = '';
  };

  for (const token of merged) {
    const upper = token.kind === 'word' ? token.text.toUpperCase() : token.text;
    if (token.text === '(') {
      // Function calls attach directly and stay inline: COUNT(*).
      // Keywords and block parens (subqueries, column lists) break lines.
      const prev = current.trimEnd();
      const tableParen = /\b(INTO|TABLE|UPDATE|DELETE)\s+[A-Za-z_][A-Za-z0-9_]*$/i.test(prev);
      const isFunc =
        prev !== '' &&
        !tableParen &&
        /[A-Za-z0-9_"'\])]$/.test(prev) &&
        !KEEP_SPACE_BEFORE_PAREN.test(prev);
      if (isFunc) {
        current = `${prev}(`;
        parenKind.push('inline');
        paren += 1;
        continue;
      }
      current = prev ? `${prev} (` : '(';
      flush(curLevel);
      parenKind.push('block');
      paren += 1;
      cont = paren;
      curLevel = paren;
      clauseBase = paren;
      selectList = false;
      continue;
    }
    if (token.text === ')') {
      const kind = parenKind.pop() ?? 'block';
      if (kind === 'inline') {
        current = `${current.trimEnd()}) `;
        paren = Math.max(0, paren - 1);
        continue;
      }
      flush(curLevel);
      paren = Math.max(0, paren - 1);
      cont = paren;
      curLevel = paren;
      clauseBase = paren;
      selectList = false;
      current = ') ';
      continue;
    }
    if (token.text === ',') {
      current = `${current.trim()},`;
      if (selectList || paren <= clauseBase) {
        const level = selectList ? paren + 1 : curLevel;
        flush(level);
        curLevel = level;
      } else {
        current += ' ';
      }
      continue;
    }
    if (token.text === ';') {
      current = `${current.trim()};`;
      flush(curLevel);
      selectList = false;
      cont = paren;
      curLevel = paren;
      clauseBase = paren;
      continue;
    }
    if (token.kind !== 'word') {
      current += `${current && !current.endsWith(' ') ? ' ' : ''}${token.text} `;
      continue;
    }
    if (upper === 'SELECT' || upper === 'SET' || upper === 'VALUES') {
      flush(curLevel);
      lines.push(pad(paren) + applyCase(token.text, options.keywordCase));
      selectList = true;
      cont = paren;
      curLevel = paren + 1;
      clauseBase = paren;
      continue;
    }
    if (MAJOR.has(upper)) {
      flush(curLevel);
      current = `${applyCase(token.text, options.keywordCase)} `;
      curLevel = paren;
      clauseBase = paren;
      cont = upper === 'WHERE' || upper === 'HAVING' ? paren + 1 : paren;
      selectList = false;
      continue;
    }
    if (JOIN.has(upper)) {
      flush(curLevel);
      current = `${applyCase(token.text, options.keywordCase)} `;
      curLevel = paren;
      clauseBase = paren;
      cont = paren + 1;
      selectList = false;
      continue;
    }
    if (upper === 'ON' || upper === 'USING') {
      current += `${applyCase(token.text, options.keywordCase)} `;
      continue;
    }
    if (CONDITION.has(upper)) {
      flush(curLevel);
      current = `${applyCase(token.text, options.keywordCase)} `;
      curLevel = cont;
      clauseBase = paren;
      continue;
    }
    current += `${token.text} `;
  }
  flush(curLevel);

  return lines
    .map((l) => l.replace(/\s+$/g, ''))
    .filter((l) => l.trim() !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/** Minify SQL: collapse whitespace, keep one space, drop comments. */
export function minifySql(input: string): string {
  if (input.length > MAX_SQL_LENGTH) throw new Error('sql-too-large');
  const tokens = tokenize(input).filter((t) => {
    const v = t.text.trim();
    return !(v.startsWith('--') || v.startsWith('/*'));
  });
  return tokens
    .map((t) => t.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),;])\s*/g, '$1')
    .replace(/\(\s*/g, '(')
    .trim();
}
