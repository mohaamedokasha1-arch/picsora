'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  CheckboxRow,
  CopyButton,
  Field,
  InlineError,
  PrivacyNotice,
  ResetButton,
  TextArea,
  ToolPanel,
  useDebounced,
} from '../kit';

const FLAGS = ['g', 'i', 'm', 's', 'u', 'y'] as const;
type Flag = (typeof FLAGS)[number];

interface MatchInfo {
  index: number;
  value: string;
  groups: string[];
  named: Record<string, string>;
}

const CHEATSHEET: [string, string][] = [
  ['\\d', 'cheatDigit'],
  ['\\w', 'cheatWord'],
  ['\\s', 'cheatSpace'],
  ['.', 'cheatAny'],
  ['^ $', 'cheatAnchors'],
  ['*  +  ?', 'cheatQuantifiers'],
  ['{n,m}', 'cheatRange'],
  ['[abc]', 'cheatSet'],
  ['(a|b)', 'cheatAlt'],
  ['(?<name>…)', 'cheatNamed'],
  ['(?:…)', 'cheatNonCapture'],
  ['\\b', 'cheatBoundary'],
];

export default function RegexTesterTool() {
  const t = useTranslations();
  const [pattern, setPattern] = React.useState('');
  const [flags, setFlags] = React.useState<Set<Flag>>(new Set(['g']));
  const [text, setText] = React.useState('');
  const [replacement, setReplacement] = React.useState('');
  const [showCheat, setShowCheat] = React.useState(false);

  const dPattern = useDebounced(pattern, 150);
  const dText = useDebounced(text, 150);
  const flagString = FLAGS.filter((f) => flags.has(f)).join('');

  const { regex, error } = React.useMemo(() => {
    if (!dPattern) return { regex: null, error: null as string | null };
    try {
      return { regex: new RegExp(dPattern, flagString), error: null };
    } catch (e) {
      return { regex: null, error: e instanceof Error ? e.message.replace(/^.*?:\s*/, '') : 'Invalid pattern' };
    }
  }, [dPattern, flagString]);

  const matches = React.useMemo<MatchInfo[]>(() => {
    if (!regex || !dText) return [];
    const out: MatchInfo[] = [];
    const source = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
    let match: RegExpExecArray | null;
    let guard = 0;
    while ((match = source.exec(dText)) !== null && guard < 10000) {
      out.push({
        index: match.index,
        value: match[0],
        groups: match.slice(1).map((g) => g ?? ''),
        named: { ...(match.groups ?? {}) },
      });
      if (match[0] === '') source.lastIndex += 1;
      if (!regex.flags.includes('g')) break;
      guard += 1;
    }
    return out;
  }, [regex, dText]);

  const highlighted = React.useMemo(() => {
    if (!matches.length) return [{ text: dText, match: false }];
    const parts: { text: string; match: boolean }[] = [];
    let cursor = 0;
    for (const m of matches) {
      if (m.index > cursor) parts.push({ text: dText.slice(cursor, m.index), match: false });
      parts.push({ text: m.value, match: true });
      cursor = m.index + m.value.length;
    }
    if (cursor < dText.length) parts.push({ text: dText.slice(cursor), match: false });
    return parts;
  }, [matches, dText]);

  const replaced = React.useMemo(() => {
    if (!regex || !dText) return '';
    try {
      return dText.replace(regex, replacement);
    } catch {
      return '';
    }
  }, [regex, dText, replacement]);

  const reset = () => {
    setPattern('');
    setText('');
    setReplacement('');
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('dev.pattern')}
        actions={
          <>
            <CopyButton value={pattern ? `/${pattern}/${flagString}` : ''} />
            <ResetButton onClick={reset} />
          </>
        }
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg text-muted-foreground">/</span>
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="\\b(\\w+)@(\\w+)\\.com\\b"
            dir="ltr"
            aria-label={t('dev.pattern')}
            className="font-mono"
          />
          <span className="font-mono text-lg text-muted-foreground">/{flagString}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4">
          {FLAGS.map((flag) => (
            <CheckboxRow
              key={flag}
              checked={flags.has(flag)}
              onChange={(checked) =>
                setFlags((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(flag);
                  else next.delete(flag);
                  return next;
                })
              }
              label={`${flag} — ${t(`dev.flag_${flag}` as never)}`}
            />
          ))}
        </div>
      </ToolPanel>

      {error && <InlineError message={t('errors.regexInvalid', { message: error })} />}

      <ToolPanel
        title={t('dev.testString')}
        actions={
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {t('dev.matchCount', { count: matches.length })}
          </span>
        }
      >
        <TextArea
          mono
          dir="ltr"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="hello@example.com and support@site.com"
          aria-label={t('dev.testString')}
          className="min-h-[160px] resize-y"
        />

        {dText && (
          <div
            dir="ltr"
            className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-secondary/20 p-3 font-mono text-[13px] leading-relaxed"
          >
            {highlighted.map((part, i) => (
              <span
                key={i}
                className={cn(
                  part.match && 'rounded-sm bg-amber-400/40 font-semibold text-foreground ring-1 ring-amber-500/50',
                )}
              >
                {part.text}
              </span>
            ))}
          </div>
        )}
      </ToolPanel>

      {matches.length > 0 && (
        <ToolPanel title={t('dev.matches')}>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {matches.slice(0, 200).map((match, i) => (
              <li key={i} className="rounded-lg border border-border bg-secondary/30 p-3 text-sm" dir="ltr">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    #{i + 1} @ {match.index}
                  </span>
                  <code className="font-mono text-foreground">{match.value || '∅'}</code>
                </div>
                {match.groups.length > 0 && (
                  <ul className="mt-2 space-y-0.5 ps-4 text-xs text-muted-foreground">
                    {match.groups.map((group, gi) => (
                      <li key={gi}>
                        <span className="font-medium">${gi + 1}</span>: <code>{group || '∅'}</code>
                      </li>
                    ))}
                    {Object.entries(match.named).map(([name, value]) => (
                      <li key={name}>
                        <span className="font-medium">{name}</span>: <code>{value || '∅'}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </ToolPanel>
      )}

      <ToolPanel title={t('dev.replacement')} actions={<CopyButton value={replaced} />}>
        <Field label={t('dev.replaceWith')}>
          <Input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="$1 [at] $2"
            dir="ltr"
            className="font-mono"
          />
        </Field>
        {replaced && (
          <div
            dir="ltr"
            className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/20 p-3 font-mono text-[13px]"
          >
            {replaced}
          </div>
        )}
      </ToolPanel>

      <ToolPanel
        title={t('dev.quickReference')}
        actions={
          <button type="button" onClick={() => setShowCheat((v) => !v)} className="text-sm font-medium text-primary">
            {showCheat ? t('dev.hide') : t('dev.show')}
          </button>
        }
      >
        {showCheat && (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CHEATSHEET.map(([token, key]) => (
              <li key={token} className="flex items-center gap-2 text-sm">
                <code dir="ltr" className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">
                  {token}
                </code>
                <span className="text-muted-foreground">{t(`dev.${key}` as never)}</span>
              </li>
            ))}
          </ul>
        )}
      </ToolPanel>

      <PrivacyNotice />
    </div>
  );
}
