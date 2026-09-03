import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { Logo } from './logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { ShieldCheck } from 'lucide-react';
import { CATEGORIES, TOOLS } from '@/lib/tools/registry';

export async function Footer() {
  const t = await getTranslations();
  const locale = await getLocale();
  const popular = TOOLS.filter((tool) => tool.popular).slice(0, 5);

  const year = new Date().getFullYear();

  const legalLinks = [
    { href: '/privacy-policy', label: t('common.privacy') },
    { href: '/cookie-policy', label: t('common.cookiePolicy') },
    { href: '/terms-of-service', label: t('common.terms') },
    { href: '/disclaimer', label: t('common.disclaimer') },
    { href: '/contact', label: t('common.contact') },
  ];

  const tCat = (key: string) => {
    // Resolve nested keys like "categoryMeta.compress.name" from the flat namespace.
    const parts = key.split('.');
    // t('categoryMeta.compress.name') works with next-intl nested objects.
    return t(key as never);
  };

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t('footer.description')}
          </p>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" />
            <span>{t('common.localSignal')}</span>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t('footer.toolsColumn')}</h3>
          <ul className="space-y-2">
            {popular.map((tool) => (
              <li key={tool.slug}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t(tool.nameKey as never)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t('footer.categoriesColumn')}</h3>
          <ul className="space-y-2">
            {CATEGORIES.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/categories/${cat.slug}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {tCat(cat.nameKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t('footer.legalColumn')}</h3>
          <ul className="space-y-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-3 py-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {year} {t('common.siteName')}. {t('common.rightsReserved')}
          </p>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
