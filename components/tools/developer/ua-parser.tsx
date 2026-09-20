'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { parseUserAgent } from '@/lib/developer-tools/user-agent';
import { CopyButton, Notice, PrivacyNotice, ResetButton, StatGrid, TextArea, ToolPanel } from '../kit';

/** Parse any User-Agent string — or inspect your own — entirely locally. */
export default function UserAgentParserTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('');

  const useMine = React.useCallback(() => {
    if (typeof navigator !== 'undefined') setInput(navigator.userAgent);
  }, []);

  React.useEffect(() => {
    useMine();
  }, [useMine]);

  const info = React.useMemo(() => (input.trim() ? parseUserAgent(input) : null), [input]);

  const asText = info
    ? [
        `Browser: ${info.browser}${info.browserVersion ? ` ${info.browserVersion}` : ''}`,
        `Engine: ${info.engine}${info.engineVersion ? ` ${info.engineVersion}` : ''}`,
        `OS: ${info.os}${info.osVersion ? ` ${info.osVersion}` : ''}`,
        `Device: ${info.device}${info.isBot ? ' (bot)' : ''}`,
      ].join('\n')
    : '';

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <Notice variant="info">{t('dev.uaCaveat')}</Notice>

      <ToolPanel
        title={t('dev.uaInput')}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={useMine}>
              {t('dev.uaUseMine')}
            </Button>
            <ResetButton onClick={() => setInput('')} label={t('textTools.clear')} />
          </>
        }
      >
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('dev.uaPlaceholder')}
          aria-label={t('dev.uaInput')}
          dir="ltr"
          mono
          className="min-h-[110px] resize-y"
        />
      </ToolPanel>

      {info && (
        <ToolPanel title={t('pdfTools.results')} actions={<CopyButton value={asText} />}>
          <StatGrid
            columns={2}
            items={[
              {
                label: t('dev.uaBrowser'),
                value: `${info.browser}${info.browserVersion ? ` ${info.browserVersion}` : ''}`,
                accent: true,
              },
              {
                label: t('dev.uaOs'),
                value: `${info.os}${info.osVersion ? ` ${info.osVersion}` : ''}`,
                accent: true,
              },
              {
                label: t('dev.uaEngine'),
                value: `${info.engine}${info.engineVersion ? ` ${info.engineVersion}` : ''}`,
              },
              {
                label: t('dev.uaDevice'),
                value: t(`dev.uaDevice_${info.device}` as never),
              },
            ]}
          />
          {info.isBot && (
            <div className="mt-3">
              <Notice variant="warning">{t('dev.uaBot')}</Notice>
            </div>
          )}
        </ToolPanel>
      )}
    </div>
  );
}
