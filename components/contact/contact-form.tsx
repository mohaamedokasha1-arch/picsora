'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Info } from 'lucide-react';

type Status = 'idle' | 'sending' | 'success' | 'not-configured' | 'error';

export function ContactForm() {
  const t = useTranslations('contact');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

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
    setStatus('sending');
    try {
      const endpoint = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
      if (!endpoint) {
        setStatus('not-configured');
        return;
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
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
