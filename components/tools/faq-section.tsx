'use client';

import { Accordion } from '@/components/ui/accordion';

export function FAQSection({ faqs }: { faqs: { q: string; a: string }[] }) {
  if (!faqs.length) return null;
  return <Accordion items={faqs} />;
}
