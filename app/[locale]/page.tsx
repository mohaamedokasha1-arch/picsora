import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Sparkles, Zap, ShieldCheck, Globe, Upload, Wand2, Download } from 'lucide-react';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { websiteSchema, organizationSchema, faqSchema, StructuredData } from '@/lib/seo/schema';
import { siteConfig } from '@/lib/site';
import { CATEGORIES, TOOLS, getNewTools, getPopularTools } from '@/lib/tools/registry';
import { Link } from '@/lib/i18n/navigation';
import { ToolCard } from '@/components/tools/tool-card';
import { ToolsGrid } from '@/components/tools/tools-grid';
import { ToolSearch } from '@/components/tools/tool-search';
import { Accordion } from '@/components/ui/accordion';
import { ToolIcon } from '@/components/icons';

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  setRequestLocale(params.locale);
  const t = await getTranslations('seo');
  return buildMetadata({ title: t('homeTitle'), description: t('homeDescription'), path: '/' }, params.locale);
}

export default async function HomePage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations();
  const popular = getPopularTools();
  const newest = getNewTools(8);

  const catName = (slug: string) => t(`categoryMeta.${slug}.name` as never);

  const homeFaqs = (t.raw('homeFaqs') as { q: string; a: string }[]) ?? [];

  const structured = [
    websiteSchema(siteConfig.url, siteConfig.name, params.locale),
    organizationSchema(siteConfig.url, siteConfig.name),
    faqSchema(homeFaqs),
  ];

  return (
    <>
      <StructuredData data={structured} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/60 via-background to-background"
        />
        <div className="container relative py-16 text-center sm:py-24">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t('home.heroHighlight')}
          </span>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            {t('home.heroTitle')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('home.heroSubtitle')}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/tools"
              className="inline-flex h-12 items-center rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {t('home.heroPrimary')}
            </Link>
            <Link
              href="/tools/image-compressor"
              className="inline-flex h-12 items-center rounded-lg border border-input bg-background px-6 text-base font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              {t('home.heroSecondary')}
            </Link>
          </div>
          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {[
              { icon: Zap, label: t('common.free') },
              { icon: ShieldCheck, label: t('common.noUpload') },
              { icon: Globe, label: t('common.worksInBrowser') },
              { icon: Sparkles, label: t('common.noRegistration') },
            ].map(({ icon: Icon, label }, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Search */}
      <section className="container -mt-6 relative z-10 pb-4">
        <div className="mx-auto max-w-2xl">
          <ToolSearch />
        </div>
      </section>

      {/* Categories */}
      <section className="container py-12">
        <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">{t('home.categoriesTitle')}</h2>
        <p className="mt-2 text-center text-muted-foreground">{t('home.categoriesSubtitle')}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const count = TOOLS.filter((tool) => tool.category === cat.slug).length;
            return (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <ToolIcon name={cat.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-foreground">{catName(cat.slug)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {count === 1 ? t('common.oneTool') : t('common.toolsCount', { count })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Popular tools */}
      <section className="container py-12">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{t('home.popularTitle')}</h2>
        <p className="mt-2 text-muted-foreground">{t('home.popularSubtitle')}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((tool) => (
            <ToolCard
              key={tool.slug}
              slug={tool.slug}
              name={t(tool.nameKey as never)}
              description={t(tool.shortKey as never)}
              icon={tool.icon}
              categoryLabel={catName(tool.category)}
              isNew={tool.isNew}
              newLabel={t('common.new')}
            />
          ))}
        </div>
      </section>

      {/* Just added */}
      <section className="container pb-12">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{t('home.newTitle')}</h2>
        <p className="mt-2 text-muted-foreground">{t('home.newSubtitle')}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newest.map((tool) => (
            <ToolCard
              key={tool.slug}
              slug={tool.slug}
              name={t(tool.nameKey as never)}
              description={t(tool.shortKey as never)}
              icon={tool.icon}
              categoryLabel={catName(tool.category)}
              isNew
              newLabel={t('common.new')}
            />
          ))}
        </div>
      </section>

      {/* All tools */}
      <section className="border-y border-border bg-secondary/20 py-12">
        <div className="container">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{t('home.allToolsTitle')}</h2>
          <p className="mt-2 text-muted-foreground">{t('home.allToolsSubtitle')}</p>
          <div className="mt-8">
            <ToolsGrid
              tools={TOOLS.map((tool) => ({
                slug: tool.slug,
                name: t(tool.nameKey as never),
                description: t(tool.shortKey as never),
                icon: tool.icon,
                category: tool.category,
                categoryLabel: catName(tool.category),
                isNew: tool.isNew,
              }))}
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container py-12">
        <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">{t('home.benefitsTitle')}</h2>
        <p className="mt-2 text-center text-muted-foreground">{t('home.benefitsSubtitle')}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Zap, title: t('home.benefitFreeTitle'), text: t('home.benefitFreeText') },
            { icon: ShieldCheck, title: t('home.benefitPrivateTitle'), text: t('home.benefitPrivateText') },
            { icon: Wand2, title: t('home.benefitFastTitle'), text: t('home.benefitFastText') },
            { icon: Globe, title: t('home.benefitAnywhereTitle'), text: t('home.benefitAnywhereText') },
          ].map(({ icon: Icon, title, text }, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-secondary/20 py-12">
        <div className="container">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">{t('home.howTitle')}</h2>
          <p className="mt-2 text-center text-muted-foreground">{t('home.howSubtitle')}</p>
          <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              { icon: Upload, title: t('home.step1Title'), text: t('home.step1Text') },
              { icon: Wand2, title: t('home.step2Title'), text: t('home.step2Text') },
              { icon: Download, title: t('home.step3Title'), text: t('home.step3Text') },
            ].map(({ icon: Icon, title, text }, i) => (
              <div key={i} className="relative rounded-xl border border-border bg-card p-5 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-3 block text-xs font-semibold uppercase tracking-wide text-primary">
                  {i + 1}
                </span>
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="container py-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">{t('home.privacyTitle')}</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{t('home.privacyText1')}</p>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{t('home.privacyText2')}</p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            {[t('home.privacyPoint1'), t('home.privacyPoint2'), t('home.privacyPoint3')].map((point, i) => (
              <li key={i} className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-1.5 text-secondary-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border py-12">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">{t('home.faqTitle')}</h2>
          <p className="mt-2 text-center text-muted-foreground">{t('home.faqSubtitle')}</p>
          <div className="mt-8">
            <Accordion items={homeFaqs} />
          </div>
        </div>
      </section>
    </>
  );
}
