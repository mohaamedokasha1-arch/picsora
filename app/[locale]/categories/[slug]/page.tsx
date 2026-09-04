import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { getCategory, toolsInCategory, CATEGORIES } from '@/lib/tools/registry';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { ToolCard } from '@/components/tools/tool-card';
import { Accordion } from '@/components/ui/accordion';
import { faqSchema, breadcrumbSchema, itemListSchema, StructuredData } from '@/lib/seo/schema';
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
  return buildMetadata(
    { title: `${name} — ${t('common.siteName')}`, description, path: `/categories/${cat.slug}` },
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

  const faqs = [
    { q: `${name} — ${t('categoryFaqs.q1')}`, a: t('categoryFaqs.a1', { category: name }) },
    { q: t('categoryFaqs.q2'), a: t('categoryFaqs.a2', { category: name }) },
  ];

  const base = siteConfig.url.replace(/\/$/, '');
  const schema = [
    breadcrumbSchema(
      [
        { name: t('common.home'), path: '/' },
        { name: t('common.categories'), path: '/categories' },
        { name, path: `/categories/${cat.slug}` },
      ],
      siteConfig.url,
    ),
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
      </div>
    </>
  );
}
