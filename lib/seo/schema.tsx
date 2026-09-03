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
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: input.features.join(', '),
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
