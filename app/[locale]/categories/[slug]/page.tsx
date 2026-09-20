import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { getCategory, toolsInCategory, CATEGORIES } from '@/lib/tools/registry';
import { getCategoryArticle } from '@/lib/content/category-articles';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { ToolCard } from '@/components/tools/tool-card';
import { Accordion } from '@/components/ui/accordion';
import { faqSchema, itemListSchema, StructuredData } from '@/lib/seo/schema';
import { Link } from '@/lib/i18n/navigation';

export function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const locale of siteConfig.locales) {
    for (const cat of CATEGORIES) params.push({ locale, slug: cat.slug });
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  setRequestLocale(params.locale);
  const cat = getCategory(params.slug);
  if (!cat) return {};
  const t = await getTranslations();
  const name = t(cat.nameKey as never);
  const description = t(cat.descriptionKey as never);
  // "PDF Tools — Piclizer" said nothing a searcher types. Adding the
  // (translated) "Free Online Tools" qualifier matches how these categories
  // are actually searched for, without stuffing tool names into the title.
  return buildMetadata(
    {
      title: `${name} — ${t('seo.categoryTitleSuffix')} | ${t('common.siteName')}`,
      description,
      path: `/categories/${cat.slug}`,
      keywords: toolsInCategory(cat.slug)
        .slice(0, 12)
        .map((tool) => t(tool.nameKey as never)),
    },
    params.locale,
  );
}

export default async function CategoryPage({ params }: { params: { locale: string; slug: string } }) {
  setRequestLocale(params.locale);
  const cat = getCategory(params.slug);
  if (!cat) notFound();
  const t = await getTranslations();

  const name = t(cat.nameKey as never);
  const intro = t(cat.introKey as never);
  const tools = toolsInCategory(cat.slug);
  const others = CATEGORIES.filter((c) => c.slug !== cat.slug);

  /*
   * The privacy Q&A is per-category on purpose. The shared answer used to say
   * "processes your images entirely in your browser" on every category page,
   * which was simply untrue on PDF Tools, Text Tools, Calculators and
   * Developer Tools — and, for the OCR and currency tools, it overstated the
   * "nothing ever touches the network" claim. Each category now states what
   * really happens to that kind of input.
   */
  const faqs = [
    { q: `${name} — ${t('categoryFaqs.q1')}`, a: t('categoryFaqs.a1', { category: name }) },
    {
      q: t(`categoryFaqs.privacyQ.${cat.slug}` as never),
      a: t(`categoryFaqs.privacyA.${cat.slug}` as never),
    },
  ];

  const base = siteConfig.url.replace(/\/$/, '');
  const schema = [
    faqSchema(faqs),
    itemListSchema(
      tools.map((tool) => ({
        name: t(tool.nameKey as never),
        description: t(tool.shortKey as never),
        url: `${base}/${params.locale}/tools/${tool.slug}`,
      })),
    ),
  ];

  return (
    <>
      <StructuredData data={schema} />
      <div className="container py-8">
        <Breadcrumb
          items={[
            { label: t('common.categories'), href: '/categories' },
            { label: name, href: `/categories/${cat.slug}` },
          ]}
        />
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{name}</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{intro}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool) => (
            <ToolCard
              key={tool.slug}
              slug={tool.slug}
              name={t(tool.nameKey as never)}
              description={t(tool.shortKey as never)}
              icon={tool.icon}
              isNew={tool.isNew}
              newLabel={t('common.new')}
              ctaLabel={t('common.useTool')}
              favoriteSlug={tool.slug}
            />
          ))}
        </div>

        <section className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('common.faq')}</h2>
            <div className="mt-4">
              <Accordion items={faqs} />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('categoryPage.relatedCategories')}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {others.map((c) => (
                <Link
                  key={c.slug}
                  href={`/categories/${c.slug}`}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {t(c.nameKey as never)}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Long-form editorial article about this category */}
        {(() => {
          const article = getCategoryArticle(cat.slug, params.locale);
          if (!article) return null;
          return (
            <section className="mt-12 max-w-3xl" aria-labelledby="category-article-title">
              <h2 id="category-article-title" className="text-xl font-bold text-foreground sm:text-2xl">
                {article.title}
              </h2>
              <div className="mt-4 space-y-4">
                {article.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-7 text-muted-foreground sm:text-base">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          );
        })()}
      </div>
    </>
  );
}
