import type { ReactNode } from 'react';
import { absoluteAsset, siteConfig, siteOrigin } from '@/lib/site';
import { serializeForScript } from '@/lib/security/sanitize';

/**
 * Prevent `</script>` breakout and JS line-terminator injection inside
 * JSON-LD payloads. Shared with the rest of the app via `lib/security`.
 */
function serializeJsonLd(data: object): string {
  return serializeForScript(data);
}

export function StructuredData({ data }: { data: object | (object | null | undefined)[] }) {
  const items = (Array.isArray(data) ? data : [data]).filter((item): item is object => Boolean(item));
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
        />
      ))}
    </>
  );
}

export function websiteSchema(url: string, name: string, locale = 'en') {
  const origin = url.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: `${origin}/${locale}`,
    inLanguage: locale,
    publisher: { '@type': 'Organization', name, url: origin },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${origin}/${locale}/tools?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function organizationSchema(url: string, name: string) {
  const origin = url.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: origin,
    email: siteConfig.contactEmail,
    logo: {
      '@type': 'ImageObject',
      url: `${origin}/icons/icon-512.png`,
      width: 512,
      height: 512,
    },
    image: absoluteAsset(siteConfig.ogImage),
  };
}

export function webAppSchema(input: {
  name: string;
  description: string;
  url: string;
  features: string[];
  locale?: string;
}) {
  const origin = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: input.name,
    description: input.description,
    url: input.url,
    image: absoluteAsset(siteConfig.ogImage),
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    isAccessibleForFree: true,
    inLanguage: input.locale ?? 'en',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: input.features,
    publisher: { '@type': 'Organization', name: siteConfig.name, url: origin },
  };
}

/** HowTo rich result for tool pages ("how to use" steps). */
export function howToSchema(input: {
  name: string;
  description: string;
  steps: string[];
  locale?: string;
  url?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    ...(input.url ? { url: input.url } : {}),
    inLanguage: input.locale ?? 'en',
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

export function collectionPageSchema(input: { name: string; description: string; url: string; locale?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: input.locale ?? 'en',
    isPartOf: { '@type': 'WebSite', name: siteConfig.name, url: siteOrigin() },
  };
}

/** Article rich result for guide pages. */
export function articleSchema(input: {
  headline: string;
  description: string;
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  locale?: string;
}) {
  const origin = siteOrigin();
  const image = input.image ?? absoluteAsset(siteConfig.ogImage);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    url: input.url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
    image,
    datePublished: input.datePublished ?? siteConfig.contentUpdatedAt,
    dateModified: input.dateModified ?? siteConfig.contentUpdatedAt,
    author: { '@type': 'Organization', name: siteConfig.name, url: origin },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: origin,
      logo: {
        '@type': 'ImageObject',
        url: `${origin}/icons/icon-512.png`,
        width: 512,
        height: 512,
      },
    },
    inLanguage: input.locale ?? 'en',
    isAccessibleForFree: true,
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbSchema(items: Crumb[], url: string, locale?: string) {
  const origin = url.replace(/\/$/, '');
  const prefix = locale ? `/${locale}` : '';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => {
      const path = !item.path || item.path === '/' ? '' : item.path.startsWith('/') ? item.path : `/${item.path}`;
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: `${origin}${prefix}${path}`,
      };
    }),
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  if (!faqs.length) return null;
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
