import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { BookOpen, Clock, ArrowRight } from 'lucide-react';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { GUIDES } from '@/lib/guides';
import { Link } from '@/lib/i18n/navigation';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { breadcrumbSchema, StructuredData } from '@/lib/seo/schema';

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  setRequestLocale(params.locale);
  const t = await getTranslations('guides');
  return buildMetadata(
    {
      title: `${t('hubTitle')} | ${siteConfig.name}`,
      description: t('hubDescription'),
      path: '/guides',
    },
    params.locale,
  );
}

export default async function GuidesPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations();

  const schema = [
    breadcrumbSchema(
      [
        { name: t('common.home'), path: '/' },
        { name: t('guides.hubTitle'), path: '/guides' },
      ],
      siteConfig.url,
    ),
  ];

  return (
    <>
      <StructuredData data={schema} />
      <div className="container py-8 sm:py-12">
        <Breadcrumb items={[{ label: t('guides.hubTitle'), href: '/guides' }]} />

        <div className="max-w-3xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            {t('guides.badge')}
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('guides.hubTitle')}
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg leading-relaxed">
            {t('guides.hubDescription')}
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{guide.readTimeMin} {t('common.minutesRead')}</span>
              </div>

              <h2 className="mt-3 text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {t(guide.titleKey as never)}
              </h2>

              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {t(guide.descriptionKey as never)}
              </p>

              <span className="mt-5 inline-flex items-center text-sm font-semibold text-primary">
                {t('common.learnMore')}
                <ArrowRight className="ms-1.5 h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
