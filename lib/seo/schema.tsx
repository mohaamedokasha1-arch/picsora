import type { ReactNode } from 'react';

export function StructuredData({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}

export function websiteSchema(url: string, name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${url}/en/tools?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function organizationSchema(url: string, name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    logo: `${url}/icons/icon.svg`,
  };
}

export function webAppSchema(input: {
  name: string;
  description: string;
  url: string;
  features: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web Browser',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    isAccessibleForFree: true,
    inLanguage: ['en', 'ar'],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: input.features.join(', '),
  };
}

/** HowTo rich result for tool pages ("how to use" steps). */
export function howToSchema(input: { name: string; description: string; steps: string[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    step: input.steps.slice(0, 8).map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: text.length > 80 ? `${text.slice(0, 77)}…` : text,
      text,
    })),
  };
}

/** ItemList of tools for category / tools / guides index pages. */
export function itemListSchema(items: { name: string; url: string; description?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
      url: item.url,
    })),
  };
}

/** Article rich result for guide pages. */
export function articleSchema(input: {
  headline: string;
  description: string;
  url: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    url: input.url,
    image: input.image,
    author: { '@type': 'Organization', name: 'Piclizer', url: input.url.split('/').slice(0, 3).join('/') },
    publisher: { '@type': 'Organization', name: 'Piclizer' },
    inLanguage: ['en', 'ar'],
    isAccessibleForFree: true,
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbSchema(items: Crumb[], url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${url}${item.path}`,
    })),
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function pageJsonLd(data: object | object[]): ReactNode {
  return <StructuredData data={data} />;
}
