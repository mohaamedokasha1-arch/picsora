import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { getTool, SLUGS } from '@/lib/tools/registry';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { ToolClient } from '@/components/tools/tool-client';
import { HowToUse } from '@/components/tools/how-to-use';
import { FAQSection } from '@/components/tools/faq-section';
import { RelatedTools } from '@/components/tools/related-tools';
import { webAppSchema, faqSchema, howToSchema, StructuredData } from '@/lib/seo/schema';
import { ToolIcon } from '@/components/icons';
import { AdPlacement } from '@/components/ads/ad-placement';

export function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const locale of siteConfig.locales) {
    for (const slug of SLUGS) params.push({ locale, slug });
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  setRequestLocale(params.locale);
  const tool = getTool(params.slug);
  if (!tool) return {};
  const t = await getTranslations();
  const name = t(tool.nameKey as never);
  const description = t(tool.descriptionKey as never);
  return buildMetadata(
    {
      title: `${name} — Free Online Tool | ${siteConfig.name}`,
      description,
      path: `/tools/${tool.slug}`,
      keywords: tool.keywords,
    },
    params.locale,
  );
}

const fmtLabel: Record<string, string> = {
  jpg: 'JPG',
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  gif: 'GIF',
  pdf: 'PDF',
  json: 'JSON',
};

export default async function ToolPage({ params }: { params: { locale: string; slug: string } }) {
  setRequestLocale(params.locale);
  const tool = getTool(params.slug);
  if (!tool) notFound();
  const t = await getTranslations();

  const name = t(tool.nameKey as never);
  const description = t(tool.descriptionKey as never);
  const intro = t(tool.introKey as never);
  const howTo = (t.raw(tool.howToKey) as string[]) ?? [];
  const faqs = (t.raw(tool.faqsKey) as { q: string; a: string }[]) ?? [];

  const url = `${siteConfig.url.replace(/\/$/, '')}/${params.locale}/tools/${tool.slug}`;

  const schema = [
    webAppSchema({
      name: `${name} — ${siteConfig.name}`,
      description,
      url,
      features: howTo.slice(0, 6),
      locale: params.locale,
    }),
    faqSchema(faqs),
    howToSchema({
      name: `${name} — ${t('howTo.title')}`,
      description,
      steps: howTo,
      locale: params.locale,
      url,
    }),
  ];

  return (
    <>
      <StructuredData data={schema} />
      <div className="container py-8">
        <Breadcrumb
          items={[
            { label: t('common.tools'), href: '/tools' },
            { label: name, href: `/tools/${tool.slug}` },
          ]}
        />

        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ToolIcon name={tool.icon} className="h-6 w-6" />
          </span>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{name}</h1>
        </div>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{intro}</p>

        {/* Tool interface */}
        <div className="mt-8">
          <ToolClient tool={tool} />
        </div>

        <AdPlacement slot="tool-below" className="mt-8" />

        {/* How to use */}
        <section className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('howTo.title')}</h2>
            <div className="mt-4">
              <HowToUse steps={howTo} />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('formats.title')}</h2>
            <div className="mt-4 rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-muted-foreground">{t('formats.input')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tool.inputFormats.map((f) => (
                  <span key={f} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                    {fmtLabel[f] ?? f.toUpperCase()}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm font-medium text-muted-foreground">{t('formats.output')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tool.outputFormats.map((f) => (
                  <span key={f} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {fmtLabel[f] ?? f.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        {faqs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-foreground">{t('common.faq')}</h2>
            <div className="mt-4">
              <FAQSection faqs={faqs} />
            </div>
          </section>
        )}

        <AdPlacement slot="tool-below-faq" className="mt-8" />

        {/* Related tools */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-foreground">{t('related.title')}</h2>
          <div className="mt-4">
            <RelatedTools slug={tool.slug} />
          </div>
        </section>
      </div>
    </>
  );
}
