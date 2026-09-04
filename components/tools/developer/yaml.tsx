'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileCode, Check, Copy, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { ToolPanel, CopyButton, TextDownloadButton, ResetButton, PrivacyNotice, CodeArea } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

const SAMPLE_YAML = `# Application Configuration
server:
  host: "0.0.0.0"
  port: 8080
  ssl:
    enabled: true
    cert: "/etc/ssl/cert.pem"

database:
  engine: "postgres"
  pool: 20
  timeout: 30

features:
  - analytics
  - search_indexing
  - live_updates
`;

export default function YamlFormatter() {
  const t = useTranslations();
  const [yamlText, setYamlText] = React.useState<string>(SAMPLE_YAML);
  const [indent, setIndent] = React.useState<number>(2);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const formatYaml = async () => {
    if (!yamlText.trim()) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const yaml = await import('js-yaml');
      const parsed = yaml.load(yamlText);
      const formatted = yaml.dump(parsed, { indent });
      setYamlText(formatted);
      setSuccessMsg('YAML successfully formatted and validated!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const e = err as { message?: string; mark?: { line?: number; column?: number } };
      const line = e.mark?.line !== undefined ? e.mark.line + 1 : undefined;
      const col = e.mark?.column !== undefined ? e.mark.column + 1 : undefined;
      const loc = line ? ` (Line ${line}, Column ${col})` : '';
      setError(`YAML Syntax Error${loc}: ${e.message || 'Invalid YAML format'}`);
    }
  };

  const yamlToJson = async () => {
    if (!yamlText.trim()) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const yaml = await import('js-yaml');
      const parsed = yaml.load(yamlText);
      setYamlText(JSON.stringify(parsed, null, indent));
      setSuccessMsg('Converted YAML to formatted JSON!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(`Conversion Error: ${e.message || 'Invalid YAML'}`);
    }
  };

  const jsonToYaml = async () => {
    if (!yamlText.trim()) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const yaml = await import('js-yaml');
      const parsed = JSON.parse(yamlText);
      const converted = yaml.dump(parsed, { indent });
      setYamlText(converted);
      setSuccessMsg('Converted JSON to YAML!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(`JSON Parse Error: ${e.message || 'Invalid JSON'}`);
    }
  };

  return (
    <div className="space-y-6">
      <ToolPanel
        title="YAML Editor & Formatter"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(indent)}
              onChange={(e) => setIndent(Number(e.target.value))}
              className="h-8 w-28 text-xs"
            >
              <option value="2">2 Spaces</option>
              <option value="4">4 Spaces</option>
            </Select>

            <Button type="button" variant="default" size="sm" onClick={formatYaml}>
              Prettify & Validate
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={yamlToJson}>
              YAML → JSON
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={jsonToYaml}>
              JSON → YAML
            </Button>

            <CopyButton value={yamlText} />
            <TextDownloadButton value={yamlText} filename="document.yaml" mime="text/yaml" />
            <ResetButton onClick={() => setYamlText('')} />
          </div>
        }
      >
        <div className="mt-2">
          <CodeArea
            value={yamlText}
            onChange={setYamlText}
            placeholder="Paste or type your YAML here..."
            ariaLabel="YAML Editor"
            minHeight={360}
          />
        </div>
      </ToolPanel>

      {successMsg && (
        <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2.5">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="font-mono text-xs leading-relaxed">{error}</div>
        </div>
      )}

      <PrivacyNotice text="All YAML formatting and conversion happens locally in your browser." />
    </div>
  );
}
