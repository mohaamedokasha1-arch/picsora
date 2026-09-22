'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Mail } from 'lucide-react';
import { isSafeHttpUrl, sanitizeSingleLine, sanitizeUserText } from '@/lib/security/sanitize';
import { safeFetch } from '@/lib/security/net';

type Status = 'idle' | 'sending' | 'success' | 'mailto' | 'error';

/**
 * Why the visitor is writing. Drives the optional company block below and
 * is included in the delivered message so inquiries can be triaged.
 */
const REASONS = ['general', 'business', 'partnership', 'custom', 'other'] as const;
type Reason = (typeof REASONS)[number];
/** Reasons that reveal the company / team fields. */
const BUSINESS_REASONS: readonly Reason[] = ['business', 'custom'];

const TEAM_SIZES = ['1-5', '6-20', '21-50', '51-100', '100+'] as const;
const VOLUMES = ['lt100', '100-1000', '1000-10000', '10000+', 'unsure'] as const;
const NEEDS = ['existing', 'bulk', 'workflow', 'integration', 'tool', 'other'] as const;

const isReason = (value: string | null): value is Reason =>
  value !== null && (REASONS as readonly string[]).includes(value);

/**
 * Server-side limits mirrored on the client so an oversized/crafted payload is
 * never even sent. Values are generous — no legitimate message hits them.
 */
const LIMITS = { name: 100, email: 254, company: 120, message: 5000 } as const;
/** Minimum gap between two submissions (simple client-side abuse throttle). */
const SUBMIT_COOLDOWN_MS = 10_000;
/**
 * `mailto:` URLs are not built for long payloads — some mail clients truncate
 * them. When the form falls back to the visitor's email app the body is capped
 * so the prefilled message always arrives complete.
 */
const MAILTO_BODY_LIMIT = 1500;

/**
 * Contact form (general, business, partnership and custom-solution inquiries).
 *
 * Delivery, in order:
 *  1. If `NEXT_PUBLIC_CONTACT_ENDPOINT` is configured (and passes the safety
 *     checks), the message is POSTed there as JSON:
 *     `{name, email, message, reason, company?, teamSize?, monthlyVolume?, need?}`.
 *  2. With no endpoint configured the form still works: it opens the
 *     visitor's email application with the message prefilled and addressed to
 *     `contactEmail` — the same fallback the bug-report form uses. No external
 *     service, no API, nothing to set up.
 *
 * `?reason=business` in the URL (used by the Business page CTA) pre-selects
 * "Business inquiry" so the company fields are visible immediately.
 *
 * The recipient address always comes from the server (`siteConfig.contactEmail`
 * via the page) and is never taken from user input.
 */
export function ContactForm({ contactEmail }: { contactEmail: string }) {
  const t = useTranslations('contact');
  const [reason, setReason] = React.useState<Reason>('general');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [teamSize, setTeamSize] = React.useState('');
  const [volume, setVolume] = React.useState('');
  const [need, setNeed] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const lastSubmitRef = React.useRef(0);

  const isBusiness = BUSINESS_REASONS.includes(reason);

  // Pre-select the reason from the URL (e.g. the Business page links to
  // `/contact?reason=business`). Read after mount so the page stays fully
  // static and no Suspense boundary is needed.
  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('reason');
    if (isReason(requested)) setReason(requested);
  }, []);

  const reasonOptions = REASONS.map((value) => ({ value, label: t(`reasons.${value}`) }));
  const withPlaceholder = (options: { value: string; label: string }[]) => [
    { value: '', label: t('selectPlaceholder') },
    ...options,
  ];
  const teamSizeOptions = TEAM_SIZES.map((value) => ({ value, label: t(`teamSizes.${value}`) }));
  const volumeOptions = VOLUMES.map((value) => ({ value, label: t(`volumes.${value}`) }));
  const needOptions = NEEDS.map((value) => ({ value, label: t(`needs.${value}`) }));
  const labelFor = (options: { value: string; label: string }[], value: string) =>
    options.find((o) => o.value === value)?.label ?? '';

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('validation.nameRequired');
    if (!email.trim()) next.email = t('validation.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t('validation.emailInvalid');
    if (isBusiness) {
      if (!company.trim()) next.company = t('validation.companyRequired');
      if (!teamSize) next.teamSize = t('validation.teamSizeRequired');
      if (!volume) next.volume = t('validation.volumeRequired');
      if (!need) next.need = t('validation.needRequired');
    }
    if (!message.trim()) next.message = t('validation.messageRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /**
   * Build the `mailto:` fallback: a prefilled email to the official contact
   * address. Every value is sanitised first and the body is clamped so the
   * URL stays within what mail clients reliably accept. Line breaks are added
   * by this code only — user input never injects raw CR/LF.
   */
  const openMailto = (lines: string[], body: string) => {
    let full = [...lines, '', body].join('\r\n');
    if (full.length > MAILTO_BODY_LIMIT) full = `${full.slice(0, MAILTO_BODY_LIMIT - 1)}…`;
    const subject = t('mailSubject', { reason: t(`reasons.${reason}`) });
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(full)}`;
    setStatus('mailto');
  };

  const resetFields = () => {
    setName('');
    setEmail('');
    setCompany('');
    setTeamSize('');
    setVolume('');
    setNeed('');
    setMessage('');
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
      const safeMessage = sanitizeUserText(message, LIMITS.message);
      const safeCompany = isBusiness ? sanitizeSingleLine(company, LIMITS.company) : '';
      // Select values are constrained to the known option lists — never free text.
      const safeTeamSize = isBusiness && (TEAM_SIZES as readonly string[]).includes(teamSize) ? teamSize : '';
      const safeVolume = isBusiness && (VOLUMES as readonly string[]).includes(volume) ? volume : '';
      const safeNeed = isBusiness && (NEEDS as readonly string[]).includes(need) ? need : '';
      if (!safeName || !safeEmail || !safeMessage || (isBusiness && !safeCompany)) {
        setStatus('error');
        return;
      }

      const endpoint = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
      // No endpoint configured (the default), or one that fails validation
      // (only an absolute https URL without embedded credentials and outside
      // the private address space is accepted): deliver through the visitor's
      // own email app, addressed to the official contact inbox.
      if (!endpoint || !isSafeHttpUrl(endpoint)) {
        lastSubmitRef.current = Date.now();
        const lines = [`${t('reason')}: ${t(`reasons.${reason}`)}`];
        if (isBusiness) {
          lines.push(`${t('company')}: ${safeCompany}`);
          lines.push(`${t('teamSize')}: ${labelFor(teamSizeOptions, safeTeamSize)}`);
          lines.push(`${t('volume')}: ${labelFor(volumeOptions, safeVolume)}`);
          lines.push(`${t('need')}: ${labelFor(needOptions, safeNeed)}`);
        }
        lines.push(`${t('name')}: ${safeName}`);
        lines.push(`${t('email')}: ${safeEmail}`);
        openMailto(lines, safeMessage);
        return;
      }

      lastSubmitRef.current = Date.now();
      const payload: Record<string, string> = {
        name: safeName,
        email: safeEmail,
        message: safeMessage,
        reason,
      };
      if (isBusiness) {
        payload.company = safeCompany;
        payload.teamSize = safeTeamSize;
        payload.monthlyVolume = safeVolume;
        payload.need = safeNeed;
      }
      const res = await safeFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        timeoutMs: 20000,
      });
      if (!res.ok) throw new Error('failed');
      setStatus('success');
      resetFields();
    } catch {
      setStatus('error');
    }
  };

  const fieldError = (key: string, id: string) =>
    errors[key] ? (
      <p id={id} className="mt-1 text-xs text-destructive">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="contact-reason" className="mb-1.5 block text-sm font-medium text-foreground">
          {t('reason')}
        </label>
        <Select
          id="contact-reason"
          value={reason}
          onChange={(e) => {
            const next = e.target.value;
            if (isReason(next)) setReason(next);
          }}
          options={reasonOptions}
        />
      </div>
      <div>
        <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-foreground">
          {t('name')}
        </label>
        <Input
          id="contact-name"
          value={name}
          maxLength={LIMITS.name}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'contact-name-error' : undefined}
        />
        {fieldError('name', 'contact-name-error')}
      </div>
      <div>
        <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-foreground">
          {isBusiness ? t('workEmail') : t('email')}
        </label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          maxLength={LIMITS.email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder={isBusiness ? t('workEmailPlaceholder') : t('emailPlaceholder')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'contact-email-error' : undefined}
        />
        {fieldError('email', 'contact-email-error')}
      </div>

      {/* Company / team block — only for business and custom-solution
          inquiries. Regular visitors never see these fields. */}
      {isBusiness && (
        <fieldset className="space-y-4 rounded-xl border border-border bg-secondary/40 p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">{t('businessLegend')}</legend>
          <div>
            <label htmlFor="contact-company" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('company')}
            </label>
            <Input
              id="contact-company"
              value={company}
              maxLength={LIMITS.company}
              autoComplete="organization"
              onChange={(e) => setCompany(e.target.value)}
              placeholder={t('companyPlaceholder')}
              aria-invalid={Boolean(errors.company)}
              aria-describedby={errors.company ? 'contact-company-error' : undefined}
            />
            {fieldError('company', 'contact-company-error')}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-team-size" className="mb-1.5 block text-sm font-medium text-foreground">
                {t('teamSize')}
              </label>
              <Select
                id="contact-team-size"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                options={withPlaceholder(teamSizeOptions)}
                aria-invalid={Boolean(errors.teamSize)}
                aria-describedby={errors.teamSize ? 'contact-team-size-error' : undefined}
              />
              {fieldError('teamSize', 'contact-team-size-error')}
            </div>
            <div>
              <label htmlFor="contact-volume" className="mb-1.5 block text-sm font-medium text-foreground">
                {t('volume')}
              </label>
              <Select
                id="contact-volume"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                options={withPlaceholder(volumeOptions)}
                aria-invalid={Boolean(errors.volume)}
                aria-describedby={errors.volume ? 'contact-volume-error' : undefined}
              />
              {fieldError('volume', 'contact-volume-error')}
            </div>
          </div>
          <div>
            <label htmlFor="contact-need" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('need')}
            </label>
            <Select
              id="contact-need"
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              options={withPlaceholder(needOptions)}
              aria-invalid={Boolean(errors.need)}
              aria-describedby={errors.need ? 'contact-need-error' : undefined}
            />
            {fieldError('need', 'contact-need-error')}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{t('businessHint')}</p>
        </fieldset>
      )}

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-foreground">
          {t('message')}
        </label>
        <Textarea
          id="contact-message"
          value={message}
          maxLength={LIMITS.message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isBusiness ? t('businessMessagePlaceholder') : t('messagePlaceholder')}
          rows={5}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
        />
        {fieldError('message', 'contact-message-error')}
      </div>

      <Button type="submit" loading={status === 'sending'}>
        {status === 'sending' ? t('sending') : t('send')}
      </Button>

      {status === 'success' && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t('successTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('successText')}</p>
          </div>
        </div>
      )}
      {status === 'mailto' && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <Mail className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t('mailtoTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('mailtoText', { email: contactEmail })}</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {t('contactErrorText', { email: contactEmail })}
        </p>
      )}
    </form>
  );
}
