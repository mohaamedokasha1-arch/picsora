import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { CATEGORIES, TOOLS } from '@/lib/tools/registry';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Link } from '@/lib/i18n/navigation';
import { ToolIcon } from '@/components/icons';
import { collectionPageSchema, itemListSchema, StructuredData } from '@/lib/seo/schema';

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  setRequestLocale(params.locale);
  const t = await getTranslations('seo');
  return buildMetadata(
    { title: t('categoriesTitle'), description: t('categoriesDescription'), path: '/categories' },
    params.locale,
  );
}

export default async function CategoriesPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations();
  const base = siteConfig.url.replace(/\/$/, '');

  const schema = [
    collectionPageSchema({
      name: t('categoriesPage.title'),
      description: t('categoriesPage.subtitle'),
      url: `${base}/${params.locale}/categories`,
      locale: params.locale,
    }),
    itemListSchema(
      CATEGORIES.map((cat) => ({
        name: t(cat.nameKey as never),
        description: t(cat.descriptionKey as never),
        url: `${base}/${params.locale}/categories/${cat.slug}`,
      })),
    ),
  ];

  return (
    <div className="container py-8">
      <StructuredData data={schema} />
      <Breadcrumb items={[{ label: t('common.categories'), href: '/categories' }]} />
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{t('categoriesPage.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('categoriesPage.subtitle')}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const count = TOOLS.filter((tool) => tool.category === cat.slug).length;
          return (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <ToolIcon name={cat.icon} className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-foreground">{t(cat.nameKey as never)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t(cat.descriptionKey as never)}</p>
              <span className="mt-3 inline-block text-sm font-medium text-primary">
                {count === 1 ? t('common.oneTool') : t('common.toolsCount', { count })}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
