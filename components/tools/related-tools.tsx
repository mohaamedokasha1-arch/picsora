import { getTranslations } from 'next-intl/server';
import { getRelatedTools } from '@/lib/tools/registry';
import { ToolCard } from './tool-card';

export async function RelatedTools({ slug }: { slug: string }) {
  const t = await getTranslations();
  const related = getRelatedTools(slug);
  if (!related.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {related.map((tool) => (
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
  );
}
