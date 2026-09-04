import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { BookOpen, Clock } from 'lucide-react';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { getAllGuides } from '@/lib/guides';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Link } from '@/lib/i18n/navigation';
import { collectionPageSchema, itemListSchema, StructuredData } from '@/lib/seo/schema';

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  setRequestLocale(params.locale);
  const t = await getTranslations();
  const base = buildMetadata(
    {
      title: `${t('guides.title')} | ${siteConfig.name}`,
      description: t('guides.subtitle'),
      path: '/guides',
    },
    params.locale,
  );
  return {
    ...base,
    keywords: [
      'image guides',
      'how to compress images',
      'convert heic to jpg',
      'reduce image size',
      'resize image guide',
      ...siteConfig.keywords,
    ],
  };
}

export default async function GuidesPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations();
  const guides = getAllGuides(params.locale);
  const base = siteConfig.url.replace(/\/$/, '');

  const schema = [
    collectionPageSchema({
      name: t('guides.title'),
      description: t('guides.subtitle'),
      url: `${base}/${params.locale}/guides`,
      locale: params.locale,
    }),
    itemListSchema(
      guides.map((g) => ({
        name: g.title,
        description: g.description,
        url: `${base}/${params.locale}/guides/${g.slug}`,
      })),
    ),
  ];

  return (
    <>
      <StructuredData data={schema} />
      <div className="container py-8">
        <Breadcrumb items={[{ label: t('guides.title'), href: '/guides' }]} />
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{t('guides.title')}</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{t('guides.subtitle')}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-base font-semibold leading-snug text-foreground">
                {guide.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {guide.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {t('guides.readTime', { n: guide.minutes })}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
