import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { siteConfig } from '@/lib/site';
import { breadcrumbSchema } from '@/lib/seo/schema';
import { StructuredData } from '@/lib/seo/schema';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export async function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const t = await getTranslations('common');
  const locale = await getLocale();
  const full: BreadcrumbItem[] = [{ label: t('home'), href: '/' }, ...items];

  const schema = breadcrumbSchema(
    full.map((item) => ({ name: item.label, path: item.href ?? '/' })),
    siteConfig.url,
    locale,
  );

  return (
    <>
      <StructuredData data={schema} />
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {full.map((item, i) => {
            const last = i === full.length - 1;
            return (
              <li key={i} className="flex items-center gap-1">
                {item.href && !last ? (
                  <Link href={item.href} className="transition-colors hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className={last ? 'font-medium text-foreground' : ''}>
                    {item.label}
                  </span>
                )}
                {!last && <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
