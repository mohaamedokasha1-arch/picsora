import { getLocale, getTranslations } from 'next-intl/server';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { getToolArticle } from '@/lib/content/tool-articles';

/**
 * Tools that cannot honestly claim "nothing ever leaves your browser".
 *
 * The OCR tools download the Tesseract engine + language data from a public
 * CDN on first use, and the currency converter fetches a public exchange-rate
 * table. The user's own files/inputs still never leave the device, but the
 * blanket claim would have been inaccurate, so these get a precise note.
 */
const CDN_DEPENDENT = new Set(['image-ocr', 'pdf-ocr']);
const NETWORK_DEPENDENT = new Set(['currency-converter']);

function localNoteKey(slug: string): 'localNote' | 'localNoteCdn' | 'localNoteNetwork' {
  if (CDN_DEPENDENT.has(slug)) return 'localNoteCdn';
  if (NETWORK_DEPENDENT.has(slug)) return 'localNoteNetwork';
  return 'localNote';
}

/**
 * Long-form editorial section rendered below each tool: a unique article
 * (heading, paragraphs and common use cases) plus the local-processing
 * reassurance line. Returns nothing when no article exists for the slug.
 */
export async function ToolDeepDive({ slug, toolName }: { slug: string; toolName: string }) {
  const t = await getTranslations('toolDeepDive');
  const locale = await getLocale();
  const localized = getToolArticle(slug, locale);
  if (!localized) return null;

  return (
    <section className="mt-12" aria-labelledby="tool-deepdive-title">
      <h2 id="tool-deepdive-title" className="text-xl font-bold text-foreground sm:text-2xl">
        {t('heading')}: {toolName}
      </h2>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_320px]">
        <article className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">{localized.title}</h3>
          {localized.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-7 text-muted-foreground sm:text-base">
              {p}
            </p>
          ))}
          <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-6 text-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {t(localNoteKey(slug))}
          </p>
        </article>
        <aside className="h-fit rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            {t('useCases')}
          </h3>
          <ul className="mt-3 space-y-2.5">
            {localized.useCases.map((u, i) => (
              <li key={i} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {u}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
