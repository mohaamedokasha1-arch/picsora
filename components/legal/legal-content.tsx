import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { getLegalDoc, LEGAL_KINDS, type LegalKind } from '@/lib/content/legal';
import { siteConfig } from '@/lib/site';

/**
 * Renders a long-form legal document (About, Privacy, Terms, Cookies,
 * Disclaimer) from lib/content/{locale}. Each document is a series of
 * sections with paragraphs and optional bullet lists, written for both
 * site locales.
 */
export async function LegalContent({ kind, locale }: { kind: LegalKind; locale: string }) {
  const t = await getTranslations('common');
  const doc = getLegalDoc(kind, locale);

  const siblingLabels: Partial<Record<LegalKind, string>> = {
    about: t('about'),
    privacy: t('privacy'),
    terms: t('terms'),
    cookiePolicy: t('cookiePolicy'),
    disclaimer: t('disclaimer'),
  };
  const siblings = LEGAL_KINDS.filter((k) => k !== kind);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{doc.title}</h1>
      {doc.intro && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{doc.intro}</p>}
      <p className="mt-2 text-sm text-muted-foreground">{t('lastUpdated')}: 2026-09-08</p>

      <div className="mt-10 space-y-10">
        {doc.sections.map((section, i) => (
          <section key={i}>
            {section.h && (
              <h2 className="text-xl font-semibold text-foreground">{section.h}</h2>
            )}
            <div className={section.h ? 'mt-3 space-y-3' : 'space-y-3'}>
              {section.ps.map((p, j) => (
                <p key={j} className="text-sm leading-7 text-muted-foreground sm:text-base">
                  {p}
                </p>
              ))}
            </div>
            {section.bullets && section.bullets.length > 0 && (
              <ul className="mt-3 space-y-2">
                {section.bullets.map((b, j) => (
                  <li key={j} className="flex gap-2 text-sm leading-6 text-muted-foreground sm:text-base">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">{t('legalPages')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {siblings.map((k) => (
            <Link
              key={k}
              href={
                k === 'about'
                  ? '/about'
                  : k === 'privacy'
                    ? '/privacy-policy'
                    : k === 'terms'
                      ? '/terms-of-service'
                      : k === 'cookiePolicy'
                        ? '/cookie-policy'
                        : '/disclaimer'
              }
              className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {siblingLabels[k]}
            </Link>
          ))}
          <Link
            href="/contact"
            className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {t('contact')}
          </Link>
        </div>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          {siteConfig.name} — {siteConfig.url.replace(/^https?:\/\//, '')}
        </p>
      </div>
    </div>
  );
}
