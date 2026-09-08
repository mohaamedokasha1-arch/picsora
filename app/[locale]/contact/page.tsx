import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { ContactForm } from '@/components/contact/contact-form';
import { Breadcrumb } from '@/components/layout/breadcrumb';

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  setRequestLocale(params.locale);
  const t = await getTranslations('seo');
  return buildMetadata({ title: t('contactTitle'), description: t('contactDescription'), path: '/contact' }, params.locale);
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

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground">{tc('emailLabel')}</p>
          <a
            href={`mailto:${siteConfig.contactEmail}`}
            className="mt-1 inline-flex items-center gap-2 text-base font-medium text-primary hover:underline"
          >
            {siteConfig.contactEmail}
          </a>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{tc('replyNote')}</p>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
