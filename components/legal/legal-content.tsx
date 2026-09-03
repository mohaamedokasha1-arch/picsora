import { getTranslations } from 'next-intl/server';

export async function LegalContent({ kind }: { kind: 'about' | 'privacy' | 'terms' | 'cookiePolicy' | 'disclaimer' }) {
  const t = await getTranslations();
  const raw = t.raw(`legal.${kind}`) as Record<string, string>;
  const sections: { h?: string; p: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const h = raw[`h${i}`];
    const p = raw[`p${i}`];
    if (h || p) sections.push({ h, p });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{raw.title}</h1>
      {raw.intro && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{raw.intro}</p>}
      <div className="mt-8 space-y-6">
        {sections.map((section, i) => (
          <div key={i}>
            {section.h && <h2 className="text-lg font-semibold text-foreground">{section.h}</h2>}
            {section.p && (
              <p className={section.h ? 'mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base' : 'text-sm leading-relaxed text-muted-foreground sm:text-base'}>
                {section.p}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
