import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { ContactForm } from '@/components/contact/contact-form';
import { BugReportForm } from '@/components/contact/bug-report-form';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Bug } from 'lucide-react';

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  setRequestLocale(params.locale);
  const t = await getTranslations('seo');
  return buildMetadata({ title: t('contactTitle'), description: t('contactDescription'), path: '/contact', noIndex: true }, params.locale);
}

export default async function ContactPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('contact');
  const tc = await getTranslations('common');

  return (
    <div className="container py-8">
      <Breadcrumb items={[{ label: tc('contact'), href: '/contact' }]} />
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('intro')}</p>

        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <ContactForm />
        </div>

        {/* Bug / error report section — reports go to the official Piclizer inbox. */}
        <section
          aria-labelledby="bug-report-heading"
          className="mt-8 rounded-xl border border-border bg-card p-6"
        >
          <div className="mb-5 flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bug className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="bug-report-heading" className="text-lg font-semibold text-foreground">
                {t('reportTitle')}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('reportIntro')}</p>
            </div>
          </div>
          <BugReportForm reportEmail={siteConfig.reportEmail} />
        </section>
      </div>
    </div>
  );
}
