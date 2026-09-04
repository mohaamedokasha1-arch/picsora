export interface GuideDef {
  slug: string;
  titleKey: string;
  descriptionKey: string;
  toolSlug: string;
  toolNameKey: string;
  readTimeMin: number;
  datePublished: string;
  dateModified: string;
  relatedGuides: string[];
  relatedTools: string[];
}

export const GUIDES: GuideDef[] = [
  {
    slug: 'how-to-compress-image-without-losing-quality',
    titleKey: 'guides.compressQuality.title',
    descriptionKey: 'guides.compressQuality.description',
    toolSlug: 'image-compressor',
    toolNameKey: 'tools.image-compressor.name',
    readTimeMin: 4,
    datePublished: '2025-01-15',
    dateModified: '2026-03-01',
    relatedGuides: ['how-to-reduce-image-size-to-500kb', 'what-is-webp-and-why-should-you-use-it', 'jpg-vs-png-which-format-should-you-use'],
    relatedTools: ['image-compressor', 'exact-kb-image-compressor', 'jpg-to-webp', 'image-resizer'],
  },
  {
    slug: 'how-to-convert-heic-to-jpg-on-any-device',
    titleKey: 'guides.convertHeic.title',
    descriptionKey: 'guides.convertHeic.description',
    toolSlug: 'heic-to-jpg',
    toolNameKey: 'tools.heic-to-jpg.name',
    readTimeMin: 5,
    datePublished: '2025-02-10',
    dateModified: '2026-03-01',
    relatedGuides: ['jpg-vs-png-which-format-should-you-use', 'how-to-compress-image-without-losing-quality'],
    relatedTools: ['heic-to-jpg', 'heic-to-png', 'photo-metadata-viewer', 'image-compressor'],
  },
  {
    slug: 'how-to-reduce-image-size-to-500kb',
    titleKey: 'guides.reduce500kb.title',
    descriptionKey: 'guides.reduce500kb.description',
    toolSlug: 'exact-kb-image-compressor',
    toolNameKey: 'tools.exact-kb-image-compressor.name',
    readTimeMin: 4,
    datePublished: '2025-02-20',
    dateModified: '2026-03-01',
    relatedGuides: ['how-to-compress-image-without-losing-quality', 'what-is-webp-and-why-should-you-use-it'],
    relatedTools: ['exact-kb-image-compressor', 'image-compressor', 'image-resizer'],
  },
  {
    slug: 'jpg-vs-png-which-format-should-you-use',
    titleKey: 'guides.jpgVsPng.title',
    descriptionKey: 'guides.jpgVsPng.description',
    toolSlug: 'jpg-to-png',
    toolNameKey: 'tools.jpg-to-png.name',
    readTimeMin: 6,
    datePublished: '2025-03-01',
    dateModified: '2026-03-01',
    relatedGuides: ['what-is-webp-and-why-should-you-use-it', 'how-to-compress-image-without-losing-quality'],
    relatedTools: ['jpg-to-png', 'png-to-jpg', 'png-to-webp', 'image-compressor'],
  },
  {
    slug: 'what-is-webp-and-why-should-you-use-it',
    titleKey: 'guides.whatIsWebp.title',
    descriptionKey: 'guides.whatIsWebp.description',
    toolSlug: 'jpg-to-webp',
    toolNameKey: 'tools.jpg-to-webp.name',
    readTimeMin: 5,
    datePublished: '2025-03-15',
    dateModified: '2026-03-01',
    relatedGuides: ['jpg-vs-png-which-format-should-you-use', 'how-to-compress-image-without-losing-quality'],
    relatedTools: ['jpg-to-webp', 'png-to-webp', 'webp-to-jpg', 'image-compressor'],
  },
];

export function getGuide(slug: string): GuideDef | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export const GUIDE_SLUGS = GUIDES.map((g) => g.slug);
