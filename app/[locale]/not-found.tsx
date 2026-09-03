import { getTranslations } from 'next-intl/server';
import { SearchX } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { ToolSearch } from '@/components/tools/tool-search';

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <div className="container flex flex-col items-center py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <SearchX className="h-8 w-8" />
      </span>
      <h1 className="mt-6 text-4xl font-extrabold text-foreground">{t('notFound.title')}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{t('notFound.text')}</p>
      <div className="mt-8 w-full max-w-md">
        <ToolSearch />
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {t('notFound.homeLink')}
        </Link>
        <Link
          href="/tools"
          className="inline-flex h-11 items-center rounded-lg border border-input bg-background px-6 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          {t('notFound.toolsLink')}
        </Link>
      </div>
    </div>
  );
}
