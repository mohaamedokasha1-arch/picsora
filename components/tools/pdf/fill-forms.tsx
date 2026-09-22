'use client';

import * as React from 'react';
import { FileText, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes } from '@/lib/utils';
import { PdfDropzone, useErrorText, useSinglePdf } from './shared';
import { inspectFormFields, fillPdfForm, type PdfFormField, type FillValues } from '@/lib/pdf-processing/forms';
import { InlineError, Notice, PrivacyNotice, ToolPanel, ResetButton, StatGrid } from '../kit';

const MAX_MB = 50;

export default function FillFormsTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const { file, info, error: loadError, setError, loading, load, reset } = useSinglePdf();
  const [fields, setFields] = React.useState<PdfFormField[]>([]);
  const [values, setValues] = React.useState<FillValues>({});
  const [flatten, setFlatten] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);
  const [inspecting, setInspecting] = React.useState(false);

  const combinedError = localError || loadError;

  const handleFiles = async (files: File[]) => {
    setResultBlob(null);
    setFields([]);
    setValues({});
    setLocalError(null);
    await load(files);
    // After load, inspect fields
    const f = files[0];
    if (!f) return;
    setInspecting(true);
    try {
      const detected = await inspectFormFields(f);
      setFields(detected);
      const initial: FillValues = {};
      for (const field of detected) {
        initial[field.name] = field.value || '';
      }
      setValues(initial);
      if (!detected.length) {
        setLocalError('No fillable AcroForm fields found in this PDF. It may be a flat PDF or XFA form (XFA requires Adobe).');
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : errorText(e));
    } finally {
      setInspecting(false);
    }
  };

  const fill = async () => {
    if (!file) return;
    setBusy(true);
    setLocalError(null);
    setResultBlob(null);
    try {
      const blob = await fillPdfForm(file, values, { flatten });
      setResultBlob(blob);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    reset();
    setFields([]);
    setValues({});
    setResultBlob(null);
    setLocalError(null);
  };

  return (
    <div className="space-y-5">
      <InlineError message={combinedError} />

      {!file && (
        <PdfDropzone multiple={false} maxFiles={1} maxFileSizeMB={MAX_MB} onFiles={handleFiles} onError={setError} disabled={busy || loading || inspecting} />
      )}

      {file && info && (
        <ToolPanel title={`${info.name} · ${formatBytes(info.size)} · ${info.pageCount} pages`} actions={<ResetButton onClick={handleReset} />}>
          {inspecting ? (
            <p className="text-sm text-muted-foreground">Inspecting form fields...</p>
          ) : fields.length > 0 ? (
            <div className="space-y-4">
              <StatGrid columns={2} items={[
                { label: 'Fields found', value: String(fields.length) },
                { label: 'Type', value: 'AcroForm' },
              ]} />

              <div className="space-y-3 max-h-[400px] overflow-auto rounded-xl border bg-card p-4">
                {fields.map((field) => (
                  <div key={field.name} className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/20 p-3">
                    <label className="text-xs font-medium text-muted-foreground">{field.name} ({field.type})</label>
                    {field.type === 'text' && (
                      <input
                        value={(values[field.name] as string) || ''}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                        className="rounded border bg-background px-2 py-1 text-sm"
                        placeholder={`Enter ${field.name}`}
                      />
                    )}
                    {field.type === 'checkbox' && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!values[field.name] && values[field.name] !== '' && values[field.name] !== false}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.checked }))}
                        />
                        Checked
                      </label>
                    )}
                    {field.type === 'radio' && field.options && (
                      <select
                        value={(values[field.name] as string) || ''}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                        className="rounded border bg-background px-2 py-1 text-sm"
                      >
                        <option value="">Select option</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                    {field.type === 'dropdown' && field.options && (
                      <select
                        value={(values[field.name] as string) || ''}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                        className="rounded border bg-background px-2 py-1 text-sm"
                      >
                        <option value="">Select</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                    {field.type === 'unknown' && (
                      <span className="text-xs text-muted-foreground">Unsupported field type — will be skipped</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} id="flatten" />
                <label htmlFor="flatten" className="text-sm">Flatten form (lock fields after filling, make non-editable)</label>
              </div>

              <ActionButton onClick={fill} disabled={busy} processing={busy} success={!!resultBlob}>Fill and download</ActionButton>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>No AcroForm fields detected. This PDF may be flat (non-fillable) or use XFA format which browsers cannot fill. XFA requires Adobe Acrobat. If your PDF is a scanned form, it has no form fields — you need to use Sign PDF or create a fillable form in Acrobat first.</span>
              </div>
            </div>
          )}
        </ToolPanel>
      )}

      {resultBlob && (
        <ToolPanel title="Filled PDF">
          <DownloadButton blob={resultBlob} filename={file ? file.name.replace(/\.pdf$/i, '-filled.pdf') : 'filled.pdf'} />
          <p className="mt-3 text-xs text-muted-foreground">
            Filled locally via pdf-lib AcroForm API. {flatten ? 'Form flattened — fields are now locked as static content.' : 'Form remains fillable — check Flatten to lock it.'} No upload, private.
          </p>
        </ToolPanel>
      )}

      {!file && (
        <>
          <Notice>Fill PDF Forms detects AcroForm fields via pdf-lib and lets you fill text, checkboxes, radios, dropdowns locally. Optionally flatten to lock. No upload.</Notice>
          <PrivacyNotice />
          <div className="rounded-xl border bg-card p-5 text-sm">
            <h3 className="font-semibold">Limits & Honest UX</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Only AcroForm (PDF form fields) supported — not XFA (XML Forms Architecture)</li>
              <li>XFA forms show message to use Adobe Acrobat; they cannot be filled in browsers</li>
              <li>Supports: text fields, checkboxes, radio groups, dropdowns</li>
              <li>Flatten option: bakes fields into static page content, non-editable afterwards</li>
              <li>Scanned forms have no form fields — use Sign PDF for visual stamping instead</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
