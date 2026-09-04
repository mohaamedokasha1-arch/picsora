import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Clock, Calendar, ArrowRight, Wrench, BookOpen, CheckCircle2 } from 'lucide-react';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { getGuide, GUIDE_SLUGS } from '@/lib/guides';
import { getTool } from '@/lib/tools/registry';
import { Link } from '@/lib/i18n/navigation';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { FAQSection } from '@/components/tools/faq-section';
import { ToolCard } from '@/components/tools/tool-card';
import { breadcrumbSchema, faqSchema, StructuredData } from '@/lib/seo/schema';
import { Button } from '@/components/ui/button';

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
  const guide = getGuide(params.slug);
  if (!guide) return {};
  const t = await getTranslations();
  const title = t(guide.titleKey as never);
  const description = t(guide.descriptionKey as never);

  return buildMetadata(
    {
      title: `${title} | ${siteConfig.name}`,
      description,
      path: `/guides/${guide.slug}`,
    },
    params.locale,
  );
}

export default async function GuideDetailPage({ params }: { params: { locale: string; slug: string } }) {
  setRequestLocale(params.locale);
  const guide = getGuide(params.slug);
  if (!guide) notFound();
  const t = await getTranslations();

  const title = t(guide.titleKey as never);
  const description = t(guide.descriptionKey as never);
  const tool = getTool(guide.toolSlug);
  const toolName = tool ? t(tool.nameKey as never) : 'Piclizer Tool';

  const introKey = `guides.${guide.slug.replace(/-/g, '_')}.intro`;
  const stepsKey = `guides.${guide.slug.replace(/-/g, '_')}.steps`;
  const faqsKey = `guides.${guide.slug.replace(/-/g, '_')}.faqs`;

  const introText = t.has(introKey as never) ? t(introKey as never) : description;
  const steps = t.has(stepsKey as never) ? (t.raw(stepsKey as never) as { title: string; body: string }[]) : [];
  const faqs = t.has(faqsKey as never) ? (t.raw(faqsKey as never) as { q: string; a: string }[]) : [];

  const guideUrl = `${siteConfig.url}/${params.locale}/guides/${guide.slug}`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url: guideUrl,
    datePublished: guide.datePublished,
    dateModified: guide.dateModified,
    author: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.url,
    },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      logo: {
        '@type': 'ImageObject',
        url: `${siteConfig.url}/icons/icon.svg`,
      },
    },
  };

  const schema = [
    articleSchema,
    breadcrumbSchema(
      [
        { name: t('common.home'), path: '/' },
        { name: t('guides.hubTitle'), path: '/guides' },
        { name: title, path: `/guides/${guide.slug}` },
      ],
      siteConfig.url,
    ),
    faqSchema(faqs),
  ];

  return (
    <>
      <StructuredData data={schema} />
      <div className="container py-8 sm:py-12 max-w-4xl">
        <Breadcrumb
          items={[
            { label: t('guides.hubTitle'), href: '/guides' },
            { label: title, href: `/guides/${guide.slug}` },
          ]}
        />

        <article className="space-y-8">
          {/* Header */}
          <header className="space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl leading-tight">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-b border-border pb-4">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {guide.readTimeMin} {t('common.minutesRead')}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {guide.dateModified}
              </span>
            </div>

            <p className="text-lg leading-relaxed text-muted-foreground">
              {introText}
            </p>
          </header>

          {/* Tool CTA Banner */}
          {tool && (
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Free Browser Tool
                  </span>
                  <h2 className="text-xl font-bold text-foreground">
                    Try {toolName} on Piclizer
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    100% private, browser-side processing without uploading files to any server.
                  </p>
                </div>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="inline-flex h-11 shrink-0 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                >
                  Use {toolName} →
                </Link>
              </div>
            </div>
          )}

          {/* Steps */}
          {steps.length > 0 && (
            <section className="space-y-6 pt-4">
              <h2 className="text-2xl font-bold text-foreground">Step-by-Step Instructions</h2>
              <div className="space-y-4">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex gap-4 rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-sm">
                      {idx + 1}
                    </span>
                    <div className="space-y-1.5 flex-1">
                      <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* FAQs */}
          {faqs.length > 0 && (
            <section className="space-y-4 pt-6 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Frequently Asked Questions</h2>
              <FAQSection faqs={faqs} />
            </section>
          )}

          {/* Related Tools */}
          {guide.relatedTools.length > 0 && (
            <section className="space-y-4 pt-6 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Related Tools</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {guide.relatedTools.map((slug) => {
                  const tDef = getTool(slug);
                  if (!tDef) return null;
                  return (
                    <ToolCard
                      key={slug}
                      slug={slug}
                      name={t(tDef.nameKey as never)}
                      description={t(tDef.shortKey as never)}
                      icon={tDef.icon}
                      categoryLabel={t(`categoryMeta.${tDef.category}.name` as never)}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* Related Guides */}
          {guide.relatedGuides.length > 0 && (
            <section className="space-y-4 pt-6 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Related Guides</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {guide.relatedGuides.map((gSlug) => {
                  const gDef = getGuide(gSlug);
                  if (!gDef) return null;
                  return (
                    <Link
                      key={gSlug}
                      href={`/guides/${gSlug}`}
                      className="group rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-all"
                    >
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {t(gDef.titleKey as never)}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {t(gDef.descriptionKey as never)}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </article>
      </div>
    </>
  );
}
