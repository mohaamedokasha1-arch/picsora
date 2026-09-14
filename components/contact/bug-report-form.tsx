'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Mail } from 'lucide-react';
import { isSafeHttpUrl, sanitizeSingleLine, sanitizeUserText } from '@/lib/security/sanitize';
import { safeFetch } from '@/lib/security/net';

type Status = 'idle' | 'sending' | 'success' | 'mailto' | 'error';

/**
 * Server-side limits mirrored on the client so an oversized/crafted payload is
 * never even sent. Values are generous — no legitimate report hits them.
 */
const LIMITS = { name: 100, email: 254, details: 5000 } as const;
/** Minimum gap between two submissions (simple client-side abuse throttle). */
const SUBMIT_COOLDOWN_MS = 10_000;
/**
 * `mailto:` URLs are not built for long payloads — some mail clients truncate
 * them. When the form falls back to the visitor's email app the body is capped
 * so the prefilled report always arrives complete.
 */
const MAILTO_BODY_LIMIT = 1200;

/**
 * Bug / error report form for the contact page.
 *
 * Delivery, in order:
 *  1. If `NEXT_PUBLIC_REPORT_ENDPOINT` is configured (and passes the same
 *     safety checks as the contact form), the report is POSTed there as
 *     `{name, email, message}` and the endpoint delivers it to
 *     `piclizer@gmail.com` (see `.env.example`).
 *  2. With no endpoint configured the form still works: it opens the
 *     visitor's email application with the report prefilled and addressed to
 *     `piclizer@gmail.com` — no external service, no API, nothing to set up.
 *
 * The recipient address always comes from the server (`siteConfig.reportEmail`
 * via the page) and is never taken from user input.
 */
export function BugReportForm({ reportEmail }: { reportEmail: string }) {
  const t = useTranslations('contact');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const lastSubmitRef = React.useRef(0);

  const validate = () => {
    const next: Record<string, string> = {};
    // Name and email are optional; only the report itself is required.
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t('validation.emailInvalid');
    }
    if (!details.trim()) next.details = t('validation.detailsRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /**
   * Build the `mailto:` fallback: a prefilled email to the official report
   * address. Every value is sanitised first and the body is clamped so the
   * URL stays within what mail clients reliably accept. Line breaks are added
   * by this code only — user input never injects raw CR/LF.
   */
  const openMailto = (safeName: string, safeEmail: string, safeDetails: string) => {
    const lines: string[] = [];
    if (safeName) lines.push(`${t('name')}: ${safeName}`);
    if (safeEmail) lines.push(`${t('email')}: ${safeEmail}`);
    if (lines.length) lines.push('');
    lines.push(safeDetails);
    let body = lines.join('\r\n');
    if (body.length > MAILTO_BODY_LIMIT) body = `${body.slice(0, MAILTO_BODY_LIMIT - 1)}…`;
    const href = `mailto:${reportEmail}?subject=${encodeURIComponent(
      t('reportMailSubject'),
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setStatus('mailto');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Throttle: block rapid-fire submissions from a script driving the form.
    if (Date.now() - lastSubmitRef.current < SUBMIT_COOLDOWN_MS) return;
    setStatus('sending');
    try {
      // Strip CR/LF and control characters (header-injection into whatever
      // mailer sits behind the endpoint) and clamp every field's length.
      const safeName = sanitizeSingleLine(name, LIMITS.name);
      const safeEmail = sanitizeSingleLine(email, LIMITS.email).toLowerCase();
      const safeDetails = sanitizeUserText(details, LIMITS.details);
      if (!safeDetails) {
        setStatus('error');
        return;
      }

      const endpoint = process.env.NEXT_PUBLIC_REPORT_ENDPOINT;
      // No endpoint configured (the default): deliver through the visitor's
      // own email app, addressed to the official report inbox.
      if (!endpoint) {
        lastSubmitRef.current = Date.now();
        openMailto(safeName, safeEmail, safeDetails);
        return;
      }
      // The endpoint comes from build-time configuration, but it is still
      // validated: only an absolute https URL without embedded credentials and
      // outside the private address space is accepted.
      if (!isSafeHttpUrl(endpoint)) {
        lastSubmitRef.current = Date.now();
        openMailto(safeName, safeEmail, safeDetails);
        return;
      }
      lastSubmitRef.current = Date.now();
      const res = await safeFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: safeName, email: safeEmail, message: safeDetails }),
        timeoutMs: 20000,
      });
      if (!res.ok) throw new Error('failed');
      setStatus('success');
      setName('');
      setEmail('');
      setDetails('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="report-name" className="mb-1.5 block text-sm font-medium text-foreground">
          {t('reportName')}
        </label>
        <Input
          id="report-name"
          value={name}
          maxLength={LIMITS.name}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          placeholder={t('reportNamePlaceholder')}
        />
      </div>
      <div>
        <label htmlFor="report-email" className="mb-1.5 block text-sm font-medium text-foreground">
          {t('reportEmail')}
        </label>
        <Input
          id="report-email"
          type="email"
          value={email}
          maxLength={LIMITS.email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('reportEmailPlaceholder')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'report-email-error' : undefined}
        />
        {errors.email && (
          <p id="report-email-error" className="mt-1 text-xs text-destructive">
            {errors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="report-details" className="mb-1.5 block text-sm font-medium text-foreground">
          {t('reportDetails')}
        </label>
        <Textarea
          id="report-details"
          value={details}
          maxLength={LIMITS.details}
          required
          onChange={(e) => setDetails(e.target.value)}
          placeholder={t('reportDetailsPlaceholder')}
          rows={5}
          aria-invalid={Boolean(errors.details)}
          aria-describedby={errors.details ? 'report-details-error' : undefined}
        />
        {errors.details && (
          <p id="report-details-error" className="mt-1 text-xs text-destructive">
            {errors.details}
          </p>
        )}
      </div>

      <Button type="submit" loading={status === 'sending'}>
        {status === 'sending' ? t('reportSending') : t('reportSend')}
      </Button>

      {status === 'success' && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t('reportSuccessTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('reportSuccessText')}</p>
          </div>
        </div>
      )}
      {status === 'mailto' && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <Mail className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t('reportMailtoTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('reportMailtoText', { email: reportEmail })}</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {t('reportErrorText', { email: reportEmail })}
        </p>
      )}
    </form>
  );
}
