'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { htmlToMarkdown } from '@/lib/developer-tools/html2md';
import {
  CodeArea,
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  TextDownloadButton,
  ToolPanel,
  useDebounced,
} from '../kit';

const SAMPLE = '<h1>Hello</h1>\n<p>Paste <strong>HTML</strong> to get <a href="https://example.com">Markdown</a>.</p>\n<ul>\n  <li>Lists</li>\n  <li>Tables</li>\n  <li>Code blocks</li>\n</ul>';

/** Convert HTML fragments into clean Markdown — scripts never execute. */
export default function HtmlToMarkdownTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState(SAMPLE);
  const debounced = useDebounced(input, 300);

  const result = React.useMemo(() => htmlToMarkdown(debounced), [debounced]);

  return (
    <div className="space-y-5">
      <PrivacyNotice scope="inputs" />
      <Notice variant="info">{t('dev.html2mdSafety')}</Notice>

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title={t('dev.htmlInput')}
          actions={<ResetButton onClick={() => setInput('')} label={t('textTools.clear')} />}
        >
          <CodeArea
            value={input}
            onChange={setInput}
            ariaLabel={t('dev.htmlInput')}
            placeholder="<p>…</p>"
          />
        </ToolPanel>
        <ToolPanel
          title={t('dev.mdOutput')}
          actions={
            <>
              <CopyButton value={result.markdown ?? ''} />
              <TextDownloadButton value={result.markdown ?? ''} filename="converted.md" mime="text/markdown;charset=utf-8" />
            </>
          }
        >
          {!result.ok ? (
            <InlineError message={t('dev.html2mdEmpty')} />
          ) : (
            <CodeArea value={result.markdown ?? ''} readOnly ariaLabel={t('dev.mdOutput')} />
          )}
        </ToolPanel>
      </div>
    </div>
  );
}
