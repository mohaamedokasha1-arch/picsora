import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { buildMetadata } from '@/lib/seo/metadata';
import { siteConfig } from '@/lib/site';
import { getBusinessDoc } from '@/lib/content/business';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Link } from '@/lib/i18n/navigation';
import { FAQSection } from '@/components/tools/faq-section';
import { faqSchema, StructuredData } from '@/lib/seo/schema';

export function generateStaticParams() {
  return siteConfig.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  setRequestLocale(params.locale);
  const t = await getTranslations('seo');
  return buildMetadata(
    { title: t('businessTitle'), description: t('businessDescription'), path: '/business' },
    params.locale,
  );
}

export default async function BusinessPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations();
  const doc = getBusinessDoc(params.locale);

  return (
    <div className="container py-8">
      <StructuredData data={[faqSchema(doc.faqs)]} />
      <Breadcrumb items={[{ label: t('common.business'), href: '/business' }]} />
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{doc.title}</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{doc.intro}</p>

      <div className="mt-10 max-w-3xl space-y-10">
        {doc.sections.map((section, i) => (
          <section key={i}>
            <h2 className="text-xl font-semibold text-foreground">{section.h}</h2>
            {section.ps.length > 0 && (
              <div className="mt-3 space-y-3">
                {section.ps.map((p, j) => (
                  <p key={j} className="text-sm leading-7 text-muted-foreground sm:text-base">
                    {p}
                  </p>
                ))}
              </div>
            )}
            {section.bullets && section.bullets.length > 0 && (
              <ul className={section.ps.length > 0 ? 'mt-3 space-y-2' : 'mt-4 space-y-2'}>
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

      {/* Business inquiry CTA — the same card style the rest of the site uses.
          `?reason=business` pre-selects "Business inquiry" on the existing
          contact form so the company-specific fields are shown right away. */}
      <div className="mt-12 max-w-3xl rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{doc.ctaHeading}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground sm:text-base">{doc.ctaText}</p>
        <Link
          href="/contact?reason=business"
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {doc.ctaLabel}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="text-xl font-bold text-foreground">{t('common.faq')}</h2>
        <div className="mt-4">
          <FAQSection faqs={doc.faqs} />
        </div>
      </section>
    </div>
  );
}
