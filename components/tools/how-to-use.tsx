import { getTranslations } from 'next-intl/server';

export async function HowToUse({ steps }: { steps: string[] }) {
  const t = await getTranslations('common');
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {i + 1}
          </span>
          <p className="pt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">{step}</p>
        </li>
      ))}
    </ol>
  );
}
