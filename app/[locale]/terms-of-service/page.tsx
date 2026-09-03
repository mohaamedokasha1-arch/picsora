import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { LegalContent } from '@/components/legal/legal-content';

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  setRequestLocale(params.locale);
  const t = await getTranslations('seo');
  return buildMetadata({ title: t('termsTitle'), description: t('termsDescription'), path: '/terms-of-service' }, params.locale);
}

export default function TermsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return (
    <div className="container py-12">
      <LegalContent kind="terms" />
    </div>
  );
}
