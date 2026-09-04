'use client';

import * as React from 'react';
import { Menu, X, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { Logo } from './logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { HeaderSearch } from '@/components/tools/tool-search';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const headerRef = React.useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  // Height of the mobile menu sheet: everything below the header's bottom
  // edge, measured so it stays correct if the header is ever pushed down.
  const [menuHeight, setMenuHeight] = React.useState('calc(100dvh - 4rem)');
  const [searchOpen, setSearchOpen] = React.useState(false);

  const toggleMenu = React.useCallback((open: boolean) => {
    if (open) {
      const top = headerRef.current?.getBoundingClientRect().bottom ?? 64;
      setMenuHeight(`calc(100dvh - ${Math.max(0, Math.round(top))}px)`);
    }
    setMenuOpen(open);
  }, []);

  React.useEffect(() => setMenuOpen(false), [pathname]);
  React.useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const nav = [
    { href: '/', label: t('common.home'), exact: true },
    { href: '/tools', label: t('common.tools') },
    { href: '/categories', label: t('common.categories') },
    { href: '/about', label: t('common.about') },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <Link href="/" aria-label={t('common.siteName')} className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label={t('header.nav')} className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                  isActive(item.href, item.exact) && 'bg-accent text-accent-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <div className="hidden lg:block">
            <HeaderSearch />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={t('common.ariaOpenSearch')}
            onClick={() => setSearchOpen((s) => !s)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <LanguageSwitcher />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? t('common.ariaCloseMenu') : t('common.ariaOpenMenu')}
            aria-expanded={menuOpen}
            onClick={() => toggleMenu(!menuOpen)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-border px-4 py-3 lg:hidden">
          <HeaderSearch onNavigate={() => setSearchOpen(false)} />
        </div>
      )}

      {menuOpen && (
        <div
          className="absolute inset-x-0 top-full z-40 overflow-y-auto bg-background md:hidden"
          style={{ height: menuHeight }}
        >
          <nav aria-label={t('header.nav')} className="container flex flex-col gap-1 py-4">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-accent',
                  isActive(item.href, item.exact) && 'bg-accent text-accent-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
