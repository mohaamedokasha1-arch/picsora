import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { TOOLS } from '@/lib/tools/registry';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { ToolsGrid } from '@/components/tools/tools-grid';

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

  return (
    <div className="container py-8">
      <Breadcrumb items={[{ label: t('common.tools'), href: '/tools' }]} />
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{t('toolsPage.title')}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t('toolsPage.subtitle')}</p>
      <div className="mt-8">
        <ToolsGrid
          tools={TOOLS.map((tool) => ({
            slug: tool.slug,
            name: t(tool.nameKey as never),
            description: t(tool.shortKey as never),
            icon: tool.icon,
            category: tool.category,
            categoryLabel: catName(tool.category),
          }))}
        />
      </div>
    </div>
  );
}
