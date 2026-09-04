import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { ShieldCheck, Sparkles, HelpCircle, Lightbulb, CheckCircle2 } from 'lucide-react';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { getTool, SLUGS } from '@/lib/tools/registry';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { ToolClient } from '@/components/tools/tool-client';
import { HowToUse } from '@/components/tools/how-to-use';
import { FAQSection } from '@/components/tools/faq-section';
import { RelatedTools } from '@/components/tools/related-tools';
import { ToolTracker } from '@/components/tools/tool-tracker';
import { webAppSchema, breadcrumbSchema, faqSchema, StructuredData } from '@/lib/seo/schema';
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

  // SEO title format: [Tool Name] — Free Online [Action] | Piclizer
  const actionTitle = params.locale === 'ar'
    ? `${name} — أداة مجانية أونلاين | ${siteConfig.name}`
    : `${name} — Free Online Tool | ${siteConfig.name}`;

  return buildMetadata(
    {
      title: actionTitle,
      description,
      path: `/tools/${tool.slug}`,
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
  svg: 'SVG',
  heic: 'HEIC',
  heif: 'HEIF',
  txt: 'TXT',
  zip: 'ZIP',
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

  const featuresKey = `toolFeatures.${tool.slug.replace(/-/g, '_')}`;
  const features = t.has(featuresKey as never)
    ? (t.raw(featuresKey as never) as string[])
    : [
        '100% In-Browser Local Processing — zero uploads to remote servers',
        'High performance and maximum quality retention',
        'Private and secure: your files never leave your device',
        'Works seamlessly on mobile devices (iPhone/Android) and desktop',
      ];

  const helpfulKey = `helpfulInfo.${tool.slug.replace(/-/g, '_')}`;
  const helpfulInfo = t.has(helpfulKey as never)
    ? t(helpfulKey as never)
    : 'All calculations, conversions, and rendering operations execute client-side via modern WebAssembly and Canvas APIs. No file data is ever transmitted across the internet.';

  const url = `${siteConfig.url}/${params.locale}/tools/${tool.slug}`;

  const schema = [
    webAppSchema({
      name: `${name} — ${siteConfig.name}`,
      description,
      url,
      features: howTo.slice(0, 6),
    }),
    breadcrumbSchema(
      [
        { name: t('common.home'), path: '/' },
        { name: t('common.tools'), path: '/tools' },
        { name, path: `/tools/${tool.slug}` },
      ],
      siteConfig.url,
    ),
    faqSchema(faqs),
  ];

  return (
    <>
      <StructuredData data={schema} />
      <ToolTracker slug={tool.slug} />

      <div className="container py-8 sm:py-10">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: t('common.tools'), href: '/tools' },
            { label: name, href: `/tools/${tool.slug}` },
          ]}
        />

        {/* 1. H1 Tool Name & 2. Short Description */}
        <header className="mt-2">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
              <ToolIcon name={tool.icon} className="h-6 w-6" />
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{name}</h1>
          </div>
          <p className="mt-3.5 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">{intro}</p>
        </header>

        {/* 3. The Tool Interface */}
        <main className="mt-8">
          <ToolClient tool={tool} />
        </main>

        <AdPlacement slot="tool-below" className="mt-8" />

        {/* 4. Supported Formats & 5. How to Use */}
        <section className="mt-12 grid gap-8 lg:grid-cols-2">
          {/* Supported Formats */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-bold text-foreground">{t('formats.title')}</h2>
            <div className="mt-4 space-y-4">
              {tool.inputFormats.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('formats.input')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tool.inputFormats.map((f) => (
                      <span key={f} className="rounded-md border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold text-secondary-foreground">
                        {fmtLabel[f] ?? f.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {tool.outputFormats.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('formats.output')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tool.outputFormats.map((f) => (
                      <span key={f} className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {fmtLabel[f] ?? f.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* How to Use */}
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('howTo.title')}</h2>
            <div className="mt-4">
              <HowToUse steps={howTo} />
            </div>
          </div>
        </section>

        {/* 6. Key Features */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-foreground">Key Features</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feat, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-xs font-medium leading-relaxed text-foreground">{feat}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 7. Privacy Information */}
        <section className="mt-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="space-y-1 flex-1">
              <h3 className="text-base font-bold text-foreground">100% Private &amp; Client-Side</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your files are processed locally inside your web browser. No files, metadata, or images are ever uploaded to any cloud server or third party.
              </p>
            </div>
          </div>
        </section>

        {/* 8. FAQ */}
        {faqs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-foreground">{t('common.faq')}</h2>
            <div className="mt-4">
              <FAQSection faqs={faqs} />
            </div>
          </section>
        )}

        <AdPlacement slot="tool-below-faq" className="mt-8" />

        {/* 9. Related Tools */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-foreground">{t('related.title')}</h2>
          <div className="mt-4">
            <RelatedTools slug={tool.slug} />
          </div>
        </section>

        {/* 10. Helpful Information */}
        <section className="mt-12">
          <div className="rounded-xl border border-border bg-secondary/20 p-6">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Lightbulb className="h-4 w-4" />
              <span>Technical Information &amp; Best Practices</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{helpfulInfo}</p>
          </div>
        </section>
      </div>
    </>
  );
}
