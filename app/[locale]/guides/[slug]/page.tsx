import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Clock, ListOrdered } from 'lucide-react';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { GUIDE_SLUGS, getGuide } from '@/lib/guides';
import { getTool } from '@/lib/tools/registry';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Link } from '@/lib/i18n/navigation';
import { ToolCard } from '@/components/tools/tool-card';
import { Accordion } from '@/components/ui/accordion';
import { ToolIcon } from '@/components/icons';
import {
  articleSchema,
  breadcrumbSchema,
  faqSchema,
  StructuredData,
} from '@/lib/seo/schema';

export function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const locale of siteConfig.locales) {
    for (const slug of GUIDE_SLUGS) params.push({ locale, slug });
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  setRequestLocale(params.locale);
  const guide = getGuide(params.slug, params.locale);
  if (!guide) return {};
  const base = buildMetadata(
    { title: `${guide.title} | ${siteConfig.name}`, description: guide.description, path: `/guides/${guide.slug}` },
    params.locale,
  );
  return {
    ...base,
    keywords: [
      ...guide.slug.split('-'),
      ...guide.relatedTools,
      'image guide',
      'how to',
      ...siteConfig.keywords,
    ],
  };
}

export default async function GuidePage({ params }: { params: { locale: string; slug: string } }) {
  setRequestLocale(params.locale);
  const guide = getGuide(params.slug, params.locale);
  if (!guide) notFound();
  const t = await getTranslations();

  const url = `${siteConfig.url.replace(/\/$/, '')}/${params.locale}/guides/${guide.slug}`;
  const ogImage = siteConfig.ogImage.startsWith('http')
    ? siteConfig.ogImage
    : `${siteConfig.url.replace(/\/$/, '')}${siteConfig.ogImage}`;

  const schema = [
    articleSchema({
      headline: guide.title,
      description: guide.description,
      url,
      image: ogImage,
    }),
    breadcrumbSchema(
      [
        { name: t('common.home'), path: '/' },
        { name: t('guides.title'), path: '/guides' },
        { name: guide.title, path: `/guides/${guide.slug}` },
      ],
      siteConfig.url,
    ),
    faqSchema(guide.faqs),
  ];

  const relatedTools = guide.relatedTools
    .map((slug) => getTool(slug))
    .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));
  const relatedGuides = guide.relatedGuides
    .map((slug) => getGuide(slug, params.locale))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  return (
    <>
      <StructuredData data={schema} />
      <article className="container max-w-4xl py-8">
        <Breadcrumb
          items={[
            { label: t('guides.title'), href: '/guides' },
            { label: guide.title, href: `/guides/${guide.slug}` },
          ]}
        />
        <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          {guide.title}
        </h1>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {t('guides.readTime', { n: guide.minutes })}
        </p>
        <div className="mt-4 space-y-3 leading-relaxed text-muted-foreground">
          {guide.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {/* Table of contents */}
        <nav
          aria-label={t('guides.contents')}
          className="mt-8 rounded-xl border border-border bg-card p-5"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ListOrdered className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('guides.contents')}
          </h2>
          <ol className="mt-3 space-y-1.5">
            {guide.sections.map((section, i) => (
              <li key={i}>
                <a
                  href={`#guide-section-${i + 1}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {i + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="mt-8 space-y-10">
          {guide.sections.map((section, i) => {
            const tool = section.toolSlug ? getTool(section.toolSlug) : undefined;
            return (
              <section key={i} id={`guide-section-${i + 1}`} className="scroll-mt-24">
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                  {i + 1}. {section.heading}
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
                  {section.paragraphs.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
                {section.bullets && (
                  <ul className="mt-3 list-disc space-y-1.5 ps-6 text-muted-foreground">
                    {section.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                )}
                {tool && (
                  <Link
                    href={`/tools/${tool.slug}`}
                    className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    <ToolIcon name={tool.icon} className="h-4 w-4" />
                    {t('guides.tryTool')}: {t(tool.nameKey as never)}
                  </Link>
                )}
              </section>
            );
          })}
        </div>

        {/* Related tools */}
        {relatedTools.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-foreground">{t('guides.relatedTools')}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {relatedTools.map((tool) => (
                <ToolCard
                  key={tool.slug}
                  slug={tool.slug}
                  name={t(tool.nameKey as never)}
                  description={t(tool.shortKey as never)}
                  icon={tool.icon}
                  isNew={tool.isNew}
                  newLabel={t('common.new')}
                />
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-foreground">{t('common.faq')}</h2>
          <div className="mt-4">
            <Accordion items={guide.faqs} />
          </div>
        </section>

        {/* Related guides */}
        {relatedGuides.length > 0 && (
          <nav aria-label={t('guides.relatedGuides')} className="mt-12">
            <h2 className="text-xl font-bold text-foreground">{t('guides.relatedGuides')}</h2>
            <div className="mt-4 flex flex-col gap-2">
              {relatedGuides.map((g) => (
                <Link
                  key={g.slug}
                  href={`/guides/${g.slug}`}
                  className="rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {g.title}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </article>
    </>
  );
}
