import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { TOOLS } from '@/lib/tools/registry';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { ToolsGrid } from '@/components/tools/tools-grid';
import { ToolSearch } from '@/components/tools/tool-search';
import { collectionPageSchema, itemListSchema, StructuredData } from '@/lib/seo/schema';

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  setRequestLocale(params.locale);
  const t = await getTranslations('seo');
  return buildMetadata({ title: t('toolsTitle'), description: t('toolsDescription'), path: '/tools' }, params.locale);
}

export default async function ToolsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations();

  const catName = (slug: string) => t(`categoryMeta.${slug}.name` as never);
  const base = siteConfig.url.replace(/\/$/, '');

  const schema = [
    collectionPageSchema({
      name: t('toolsPage.title'),
      description: t('toolsPage.subtitle'),
      url: `${base}/${params.locale}/tools`,
      locale: params.locale,
    }),
    itemListSchema(
      TOOLS.map((tool) => ({
        name: t(tool.nameKey as never),
        description: t(tool.shortKey as never),
        url: `${base}/${params.locale}/tools/${tool.slug}`,
      })),
    ),
  ];

  return (
    <div className="container py-8">
      <StructuredData data={schema} />
      <Breadcrumb items={[{ label: t('common.tools'), href: '/tools' }]} />
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{t('toolsPage.title')}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t('toolsPage.subtitle')}</p>
      {/* Same search field as the header and the homepage, so people who land
          straight on the listing can jump to a tool without scrolling. */}
      <div className="mt-6 max-w-2xl">
        {/* `readUrlQuery` makes the WebSite SearchAction target (/tools?q=…)
            actually work, so a shared or schema-driven search link lands on
            results instead of an empty field. */}
        <ToolSearch readUrlQuery />
      </div>
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
  );
}
