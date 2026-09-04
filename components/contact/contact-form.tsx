'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Info } from 'lucide-react';
import { isSafeHttpUrl, sanitizeSingleLine, sanitizeUserText } from '@/lib/security/sanitize';
import { safeFetch } from '@/lib/security/net';

type Status = 'idle' | 'sending' | 'success' | 'not-configured' | 'error';

/**
 * Server-side limits mirrored on the client so an oversized/crafted payload is
 * never even sent. Values are generous — no legitimate message hits them.
 */
const LIMITS = { name: 100, email: 254, message: 5000 } as const;
/** Minimum gap between two submissions (simple client-side abuse throttle). */
const SUBMIT_COOLDOWN_MS = 10_000;

export function ContactForm() {
  const t = useTranslations('contact');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const lastSubmitRef = React.useRef(0);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('validation.nameRequired');
    if (!email.trim()) next.email = t('validation.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t('validation.emailInvalid');
    if (!message.trim()) next.message = t('validation.messageRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Throttle: block rapid-fire submissions from a script driving the form.
    if (Date.now() - lastSubmitRef.current < SUBMIT_COOLDOWN_MS) return;
    setStatus('sending');
    try {
      const endpoint = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
      if (!endpoint) {
        setStatus('not-configured');
        return;
      }
      // The endpoint comes from build-time configuration, but it is still
      // validated: only an absolute https URL without embedded credentials and
      // outside the private address space is accepted.
      if (!isSafeHttpUrl(endpoint)) {
        setStatus('not-configured');
        return;
      }
      lastSubmitRef.current = Date.now();
      // Strip CR/LF and control characters (header-injection into whatever
      // mailer sits behind the endpoint) and clamp every field's length.
      const payload = {
        name: sanitizeSingleLine(name, LIMITS.name),
        email: sanitizeSingleLine(email, LIMITS.email).toLowerCase(),
        message: sanitizeUserText(message, LIMITS.message),
      };
      if (!payload.name || !payload.email || !payload.message) {
        setStatus('error');
        return;
      }
      const res = await safeFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        timeoutMs: 20000,
      });
      if (!res.ok) throw new Error('failed');
      setStatus('success');
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
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
        {errors.name && (
          <p id="contact-name-error" className="mt-1 text-xs text-destructive">
            {errors.name}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-foreground">
          {t('email')}
        </label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          maxLength={LIMITS.email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'contact-email-error' : undefined}
        />
        {errors.email && (
          <p id="contact-email-error" className="mt-1 text-xs text-destructive">
            {errors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-foreground">
          {t('message')}
        </label>
        <Textarea
          id="contact-message"
          value={message}
          maxLength={LIMITS.message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('messagePlaceholder')}
          rows={5}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
        />
        {errors.message && (
          <p id="contact-message-error" className="mt-1 text-xs text-destructive">
            {errors.message}
          </p>
        )}
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
      {status === 'not-configured' && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-4">
          <Info className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t('notConfiguredTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('notConfiguredText')}</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {t('notConfiguredText')}
        </p>
      )}
    </form>
  );
}
