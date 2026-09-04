/**
 * SEO guides: genuinely useful how-tos targeting real search queries.
 * Content lives here (per locale) so guide pages, sitemap and JSON-LD all
 * derive from one source. Guides link to tools, tools link back via related
 * tools — internal linking without spam or duplicate pages.
 */

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  toolSlug?: string;
}

export interface GuideContent {
  slug: string;
  title: string;
  description: string;
  intro: string[];
  minutes: number;
  sections: GuideSection[];
  faqs: { q: string; a: string }[];
  relatedTools: string[];
  relatedGuides: string[];
}

export const GUIDE_SLUGS = [
  'compress-image',
  'reduce-image-size',
  'convert-heic-to-jpg',
  'compress-iphone-photos',
  'resize-image',
  'convert-jpg-to-png',
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

const GUIDES_EN: Record<GuideSlug, GuideContent> = {
  'compress-image': {
    slug: 'compress-image',
    title: 'How to Compress an Image Without Losing Quality',
    description: 'Learn how to compress JPG, PNG and WebP images to a fraction of their size with no visible quality loss — free, in your browser.',
    intro: [
      'A photo straight from a phone or camera is usually 3–8 MB — far too heavy for a website, an email attachment or a chat app. Compressing it to 150–400 KB makes pages load faster and uploads succeed, and done right, nobody can tell the difference.',
      'This guide explains how compression works, which settings to use for photos versus graphics, and how to do it free in your browser with Piclizer — your images never leave your device.',
    ],
    minutes: 5,
    sections: [
      {
        heading: 'Understand the two kinds of compression',
        paragraphs: [
          'Lossy compression (JPG, WebP) discards detail your eyes barely notice — subtle colour noise and ultra-fine texture. That is why a photo can shrink by 80% and still look identical.',
          'Lossless compression (PNG) keeps every pixel exactly. It is perfect for logos, screenshots and text graphics, but it cannot shrink photos nearly as much.',
        ],
        bullets: [
          'Photos and camera shots → JPG or WebP, quality 70–85%',
          'Logos, icons and screenshots with text → PNG, or WebP at 90%+',
          'Transparency needed → PNG or WebP (never JPG)',
        ],
        toolSlug: 'image-compressor',
      },
      {
        heading: 'Pick the right quality setting',
        paragraphs: [
          'Quality is a slider, not a switch. For most photos, 80% is the sweet spot: files shrink dramatically while looking untouched. Drop to 60–70% for thumbnails and previews where nobody zooms in.',
          'Always compare before and after at 100% zoom. If you see blockiness in smooth skies or skin, nudge quality back up by 5–10 points.',
        ],
        bullets: [
          'Hero website images: JPG 80% or WebP 75–80%',
          'Email attachments: JPG 70%, max width 1600 px',
          'Thumbnails and avatars: JPG 60–65%',
        ],
      },
      {
        heading: 'Convert to a modern format for extra savings',
        paragraphs: [
          'WebP typically beats JPG by 25–35% at the same visual quality and is supported by every modern browser. If your platform accepts WebP uploads, converting is the single biggest free win available.',
          'Converting JPG to PNG, by contrast, makes files bigger — PNG is lossless, so only go that direction when you need transparency or further editing.',
        ],
        toolSlug: 'jpg-to-webp',
      },
      {
        heading: 'Compress step by step with Piclizer',
        paragraphs: [
          'Open the Image Compressor, drop in up to 20 images, and move the quality slider while watching the live size saving. Everything is processed by your browser — nothing is uploaded, so even sensitive photos are safe.',
          'Need an exact size for a form, like “under 100 KB”? Use the Image to Exact KB tool instead: type the target and it searches quality levels automatically.',
        ],
        toolSlug: 'image-to-exact-kb',
      },
    ],
    faqs: [
      { q: 'How much can I compress a photo?', a: 'A 5 MB phone photo typically compresses to 300–600 KB at 80% quality with no visible change — roughly a 90% saving.' },
      { q: 'Does compression work offline?', a: 'Once the Piclizer page has loaded, compression runs entirely in your browser with no connection needed.' },
      { q: 'Should I compress the original or a copy?', a: 'Always keep your original. Compression discards data permanently, so work on a copy and archive the full-quality file.' },
      { q: 'Why is my PNG still huge?', a: 'PNG is lossless. For photos, switch the output to JPG or WebP; use PNG only for graphics, logos and screenshots.' },
    ],
    relatedTools: ['image-compressor', 'image-to-exact-kb', 'jpg-to-webp', 'heic-to-jpg'],
    relatedGuides: ['reduce-image-size', 'convert-heic-to-jpg', 'convert-jpg-to-png'],
  },
  'reduce-image-size': {
    slug: 'reduce-image-size',
    title: 'How to Reduce Image Size for Uploads and Forms',
    description: 'Hit exact upload limits like 100 KB or 2 MB: shrink JPG, PNG and iPhone photos to a precise file size with free browser tools.',
    intro: [
      '“Photo must be under 100 KB.” Job portals, exam boards, visa applications and scholarship forms all impose strict file-size limits — and reject anything bigger without explanation.',
      'This guide shows the two levers that control file size (quality and dimensions), the exact targets that commonly work, and how to hit a precise number on the first try.',
    ],
    minutes: 4,
    sections: [
      {
        heading: 'Know your target before you start',
        paragraphs: [
          'Most forms accept JPG between 20 KB and 200 KB for photos, and passports photos around 100–300 KB. College and government portals in particular love round numbers: 50 KB, 100 KB, 200 KB.',
          'Read the requirement carefully: “maximum 100 KB” means at or under, while “between 50–100 KB” needs a precise landing — exactly what the Exact KB tool is built for.',
        ],
        bullets: [
          'Passport / ID uploads: usually 20–300 KB, JPG',
          'Email-safe photo: under 500 KB',
          'Website hero image: 150–400 KB in WebP',
        ],
      },
      {
        heading: 'Lever 1: lower the quality',
        paragraphs: [
          'Quality is the first lever because it never changes dimensions. Dropping a photo from 95% to 80% often halves the file with zero visible difference.',
          'For form photos viewed at small sizes, 65–75% is usually plenty — the reviewer sees a 3 cm thumbnail, not a poster.',
        ],
        toolSlug: 'image-compressor',
      },
      {
        heading: 'Lever 2: shrink the dimensions',
        paragraphs: [
          'Pixel count drives file size almost linearly: halving width and height quarters the pixels. A 4000 px phone photo displayed at 600 px is carrying 40× more data than needed.',
          'A safe rule: resize so the longest edge matches how the image will actually be used — 800–1200 px for web uploads, exactly the required size for ID photos.',
        ],
        toolSlug: 'image-resizer',
      },
      {
        heading: 'Land on the exact number automatically',
        paragraphs: [
          'Guessing quality, checking the size, and repeating is tedious. Instead, type your target — say 100 KB — into the Image to Exact KB tool. It probes quality levels at full resolution, then steps dimensions down only if it must.',
          'If even the smallest possible file misses your target, the tool says so honestly instead of handing you a broken upload.',
        ],
        toolSlug: 'image-to-exact-kb',
      },
    ],
    faqs: [
      { q: 'My photo must be exactly 100 KB. How?', a: 'Use the Image to Exact KB tool, type 100, choose JPG, and download — it tunes quality (and dimensions if needed) to land at or under 100 KB.' },
      { q: 'Will a 100 KB photo look bad?', a: 'At typical form-display sizes it looks fine. Quality loss only shows when you zoom far beyond the displayed size.' },
      { q: 'JPG or PNG for small sizes?', a: 'JPG, always, for photos. PNG is lossless and physically cannot reach tiny sizes for photographic content.' },
      { q: 'The form still rejects my file. Why?', a: 'Check three things: file size, dimensions (some forms cap pixels too), and format — many portals accept only JPG.' },
    ],
    relatedTools: ['image-to-exact-kb', 'image-compressor', 'image-resizer', 'passport-photo-maker'],
    relatedGuides: ['compress-image', 'resize-image', 'compress-iphone-photos'],
  },
  'convert-heic-to-jpg': {
    slug: 'convert-heic-to-jpg',
    title: 'How to Convert HEIC to JPG (iPhone Photos)',
    description: 'Convert iPhone HEIC photos to JPG free in your browser. Why HEIC exists, when to convert, and how to keep quality and orientation correct.',
    intro: [
      'Since iOS 11, iPhones save photos as HEIC — a format that stores stunning quality in half the space of JPG. The catch: Windows apps, many websites, email systems and older Android phones still refuse to open it.',
      'Converting HEIC to JPG solves compatibility instantly. Done in the browser, it is also private: your photos never travel to a server.',
    ],
    minutes: 4,
    sections: [
      {
        heading: 'Why iPhones use HEIC',
        paragraphs: [
          'HEIC (High Efficiency Image Container) uses the same compression advances as modern video. A 48 MP iPhone shot that would be 15 MB as JPG fits in about 4 MB as HEIC, with HDR and burst sequences included.',
          'Apple, Dropbox and Google Photos handle it natively. Problems start with Windows Photo Viewer, many government upload portals, older TVs and printers, and some web forms.',
        ],
      },
      {
        heading: 'Convert in the browser, step by step',
        paragraphs: [
          'Open the HEIC to JPG tool and add up to 10 photos. Each file is decoded on your device with EXIF orientation applied — so portrait shots never arrive sideways — then re-encoded as JPG at your chosen quality.',
          'Quality 90% is the best default: visually identical to the HEIC with a modest file size. Drop to 80% for sharing and messaging.',
        ],
        toolSlug: 'heic-to-jpg',
      },
      {
        heading: 'When to choose PNG instead',
        paragraphs: [
          'JPG is right for sharing, uploading and archiving everyday shots. Choose HEIC to PNG only when you plan to edit heavily — PNG is lossless, so repeated saves never degrade it — at the cost of much larger files.',
        ],
        toolSlug: 'heic-to-png',
      },
      {
        heading: 'Stop the problem at the source (optional)',
        paragraphs: [
          'If compatibility matters more than storage, tell your iPhone to shoot JPG: Settings → Camera → Formats → Most Compatible. New photos will save as JPG while existing HEIC files stay as they are.',
          'For photos already taken, batch-convert them once with the tool above and keep the JPGs alongside the originals.',
        ],
        bullets: [
          'High Efficiency = HEIC (small files, wide Apple support)',
          'Most Compatible = JPG (works everywhere, bigger files)',
          'Transfer to Mac/PC via USB uses your originals either way',
        ],
      },
    ],
    faqs: [
      { q: 'Is converting HEIC to JPG free?', a: 'Yes — unlimited conversions run entirely in your browser, with no account and no watermark.' },
      { q: 'Will my photos lose quality?', a: 'At 90%+ quality the difference is invisible. JPG is technically lossy, so keep your HEIC originals archived.' },
      { q: 'Why do my converted photos look rotated?', a: 'They should not: Piclizer applies the photo’s EXIF orientation during decoding. If a file arrives sideways, its orientation tag was already stripped before upload.' },
      { q: 'Can I convert HEIC on Windows?', a: 'Yes — the tool runs in any modern browser on Windows, Mac, Android or iPhone itself.' },
    ],
    relatedTools: ['heic-to-jpg', 'heic-to-png', 'image-compressor', 'image-to-exact-kb'],
    relatedGuides: ['compress-iphone-photos', 'compress-image', 'convert-jpg-to-png'],
  },
  'compress-iphone-photos': {
    slug: 'compress-iphone-photos',
    title: 'How to Compress iPhone Photos for Sharing and Uploads',
    description: 'Shrink iPhone photos (HEIC, HDR, 48 MP) for WhatsApp, email and forms — keep orientation right and quality high, all in your browser.',
    intro: [
      'Modern iPhones shoot 12–48 megapixel HEIC photos with HDR — gorgeous, but each file can be 4–10 MB. Messaging apps recompress them brutally, email bounces large attachments, and forms reject them outright.',
      'This guide gives you a repeatable workflow: convert, compress, and hit exact targets — while keeping portrait orientation and colours correct.',
    ],
    minutes: 5,
    sections: [
      {
        heading: 'Understand what makes iPhone photos heavy',
        paragraphs: [
          'Three things inflate iPhone files: huge resolutions (up to 8064 px wide), HDR data, and Live Photo video companions. For on-screen sharing, most of that data is invisible.',
          'Good news: shrinking a 48 MP photo to 2048 px for sharing loses nothing you can see on a phone or laptop screen — and cuts the file by 80–90%.',
        ],
        bullets: [
          '48 MP ProRAW/HEIC: 8–25 MB per shot',
          'Standard 12 MP HEIC: 2–5 MB per shot',
          'Shared over WhatsApp: recompressed to ~200 KB automatically',
        ],
      },
      {
        heading: 'Step 1 — convert HEIC to a friendly format',
        paragraphs: [
          'If your destination rejects HEIC (many forms and Windows apps do), convert first. The HEIC to JPG tool decodes each photo locally with orientation fixed, then encodes a universal JPG.',
          'Skip this step when sharing to apps that accept HEIC natively, like iMessage, AirDrop or Google Photos.',
        ],
        toolSlug: 'heic-to-jpg',
      },
      {
        heading: 'Step 2 — compress for your destination',
        paragraphs: [
          'For messaging and social media, compress to JPG 75–80% — quality far above what those apps preserve anyway. For email, keep 85% and a 2048 px longest edge so photos still look crisp on big screens.',
          'For strict forms (“photo under 100 KB”), skip guessing: the Exact KB tool lands on the number directly.',
        ],
        toolSlug: 'image-compressor',
      },
      {
        heading: 'Watch out for orientation and HDR quirks',
        paragraphs: [
          'iPhones store rotation as metadata (EXIF), not by rotating pixels. Cheap converters ignore it and deliver sideways photos. Piclizer applies orientation during decoding, so portrait shots stay portrait.',
          'HDR photos converted to standard JPG can look slightly flatter in highlights — normal and unavoidable when leaving the HDR container, and barely noticeable at sharing sizes.',
        ],
        toolSlug: 'image-to-exact-kb',
      },
    ],
    faqs: [
      { q: 'What is the best size for WhatsApp photos?', a: 'WhatsApp recompresses everything to roughly 1600 px and ~200 KB. Sending a pre-compressed 1600 px JPG at 80% gives you control instead of its aggressive defaults.' },
      { q: 'How do I email full-quality iPhone photos?', a: 'Use Mail Drop, AirDrop, or a cloud link. If you must attach, compress to 85% JPG first — a 48 MP shot drops from ~8 MB to ~2 MB invisibly.' },
      { q: 'Do Live Photos convert?', a: 'The still frame converts normally; the short video companion is not carried into the JPG.' },
      { q: 'Are my personal photos uploaded?', a: 'Never. Conversion and compression run inside your browser — safe even for sensitive photos.' },
    ],
    relatedTools: ['heic-to-jpg', 'image-compressor', 'image-to-exact-kb', 'image-resizer'],
    relatedGuides: ['convert-heic-to-jpg', 'reduce-image-size', 'compress-image'],
  },
  'resize-image': {
    slug: 'resize-image',
    title: 'How to Resize an Image to Exact Dimensions',
    description: 'Resize JPG, PNG and WebP images to exact pixel sizes for profiles, banners and print — with aspect-ratio control, free in your browser.',
    intro: [
      'Every platform wants different pixels: 1080×1080 for Instagram, 1920×1080 for a hero banner, 35×45 mm at 300 DPI for print. Uploading the wrong size means ugly auto-crops or rejected forms.',
      'This guide explains pixels versus print size, aspect ratios, and how to resize precisely without stretching — plus when to crop instead.',
    ],
    minutes: 4,
    sections: [
      {
        heading: 'Pixels, aspect ratio, and why images stretch',
        paragraphs: [
          'An image is a grid of pixels; its aspect ratio is the shape of that grid (16:9 is wide, 1:1 is square). Forcing 16:9 pixels into a 1:1 box without cropping must stretch or squash them.',
          'The aspect-ratio lock exists to prevent exactly that: change the width and the height follows proportionally. Unlock it only when you truly need arbitrary dimensions.',
        ],
        toolSlug: 'image-resizer',
      },
      {
        heading: 'Common sizes worth memorising',
        paragraphs: [
          'Social avatars are square and small; banners are wide; stories are tall. Design at exactly the display size or 2× for retina crispness — never 10×, which only wastes bandwidth.',
        ],
        bullets: [
          'Instagram post: 1080 × 1080 px (1:1)',
          'YouTube thumbnail: 1280 × 720 px (16:9)',
          'Story / reel cover: 1080 × 1920 px (9:16)',
          'Website hero: 1920 × 1080 px, under 400 KB',
          'ID print 35×45 mm: 413 × 531 px at 300 DPI',
        ],
      },
      {
        heading: 'Resize or crop? Pick correctly',
        paragraphs: [
          'Resize when the whole picture must survive and only its pixel size is wrong. Crop when the shape is wrong — cutting a wide photo into a square keeps faces natural instead of squeezed.',
          'A typical flow: crop to the target shape first, then resize to the target pixels. Both tools run locally in seconds.',
        ],
        toolSlug: 'image-cropper',
      },
      {
        heading: 'ID photos need print math, not guesses',
        paragraphs: [
          'Print sizes are in millimetres, but files are in pixels: pixels = mm ÷ 25.4 × DPI. A 35×45 mm photo at 300 DPI is exactly 413×531 px.',
          'The Passport Photo Maker does this math for standard ID sizes automatically and centre-crops your portrait to fit.',
        ],
        toolSlug: 'passport-photo-maker',
      },
    ],
    faqs: [
      { q: 'Does resizing reduce quality?', a: 'Downsizing keeps images sharp. Upsizing beyond the original cannot invent detail and looks soft — always start from the largest source you have.' },
      { q: 'How do I avoid stretched images?', a: 'Keep the aspect-ratio lock on. If the target shape differs from your photo, crop to that shape first.' },
      { q: 'What DPI do I need for screens?', a: 'DPI is irrelevant on screens — only pixel dimensions matter. DPI matters solely for print.' },
      { q: 'Can I resize transparent PNGs?', a: 'Yes. Resizing preserves the alpha channel when the output stays PNG or WebP.' },
    ],
    relatedTools: ['image-resizer', 'image-cropper', 'passport-photo-maker', 'image-compressor'],
    relatedGuides: ['compress-image', 'reduce-image-size', 'convert-jpg-to-png'],
  },
  'convert-jpg-to-png': {
    slug: 'convert-jpg-to-png',
    title: 'How to Convert JPG to PNG (and When You Shouldn’t)',
    description: 'Convert JPG to PNG free in your browser — and learn when PNG helps (editing, graphics) versus when it just wastes space.',
    intro: [
      'Converting JPG to PNG is one click — but it is the most misunderstood conversion in imaging. PNG cannot restore quality JPG already discarded; it only stops further loss and adds transparency support for future edits.',
      'This guide shows the legitimate reasons to convert, the cases where you should not, and the exact steps.',
    ],
    minutes: 4,
    sections: [
      {
        heading: 'What JPG → PNG actually does',
        paragraphs: [
          'JPG is lossy: every save discards fine detail. PNG is lossless: every save preserves pixels exactly. Converting decodes the JPG once and re-saves every pixel faithfully — quality freezes at its current level instead of degrading further.',
          'The price is size: expect the PNG to be 3–8× larger than the JPG. That is normal physics, not a bug.',
        ],
        toolSlug: 'jpg-to-png',
      },
      {
        heading: 'Three good reasons to convert',
        paragraphs: [
          'Convert when you are about to edit and re-save many times (PNG masters prevent generation loss), when you need to add transparent areas in an editor, or when a tool or printer demands PNG input.',
        ],
        bullets: [
          'Editing masters: convert once, edit freely, export JPG at the end',
          'Adding transparency or text overlays in an editor',
          'Upload portals that accept PNG only',
        ],
      },
      {
        heading: 'Three reasons not to',
        paragraphs: [
          'Do not convert to “improve quality” (impossible), to “make it HD” (pixels do not increase), or to save space (PNG photos are always bigger — use WebP instead for smaller files).',
          'For the reverse trip — smaller files from PNG sources — the PNG to JPG converter with a quality slider is the right tool.',
        ],
        toolSlug: 'png-to-jpg',
      },
      {
        heading: 'Convert step by step',
        paragraphs: [
          'Open the JPG to PNG tool, add up to 10 images, and press convert. Files are decoded and re-encoded in your browser — nothing is uploaded — and download immediately as PNGs.',
          'Then edit freely: every subsequent PNG save is lossless, so quality never drops again until you deliberately export a final JPG or WebP.',
        ],
        toolSlug: 'jpg-to-png',
      },
    ],
    faqs: [
      { q: 'Does JPG to PNG improve quality?', a: 'No. It preserves current quality exactly and prevents further loss during editing — but detail already discarded by JPG is gone forever.' },
      { q: 'Why is my PNG so much bigger?', a: 'Lossless storage of photographic noise and texture costs bytes. For photos you share (not edit), stay with JPG or WebP.' },
      { q: 'Can PNG have a transparent background?', a: 'Yes — PNG supports full transparency. Note that converting a JPG only preserves existing pixels; creating transparency requires an editor or the Background Remover.' },
      { q: 'JPG, PNG or WebP for my website?', a: 'Photos: WebP (smallest) or JPG (universal). Graphics with sharp edges or transparency: PNG or WebP.' },
    ],
    relatedTools: ['jpg-to-png', 'png-to-jpg', 'png-to-webp', 'background-remover'],
    relatedGuides: ['compress-image', 'convert-heic-to-jpg', 'resize-image'],
  },
};

const GUIDES_AR: Record<GuideSlug, GuideContent> = {
  'compress-image': {
    slug: 'compress-image',
    title: 'كيف تضغط الصور دون فقدان الجودة',
    description: 'تعلّم ضغط صور JPG وPNG وWebP إلى جزء صغير من حجمها دون فرق مرئي — مجانًا داخل متصفحك.',
    intro: [
      'الصورة الخارجة من الهاتف أو الكاميرا عادة 3–8MB — ثقيلة جدًا على المواقع ومرفقات البريد وتطبيقات المحادثة. ضغطها إلى 150–400KB يسرّع الصفحات ويُنجح الرفع، وإذا أُحسِن الضغط فلن يلاحظ أحد أي فرق.',
      'يشرح هذا الدليل كيف يعمل الضغط، وأي إعدادات تستخدم للصور الفوتوغرافية مقابل الرسومات، وكيف تفعله مجانًا في متصفحك مع Piclizer — دون أن تغادر صورك جهازك.',
    ],
    minutes: 5,
    sections: [
      {
        heading: 'افهم نوعي الضغط',
        paragraphs: [
          'الضغط المفقود (JPG وWebP) يتخلص من تفاصيل لا تكاد تراها العين — ضجيج الألوان الدقيق والأنسجة فائقة الدقة. لهذا قد تتقلص الصورة 80% وتبدو مطابقة.',
          'الضغط غير المفقود (PNG) يحفظ كل بكسل بدقة. مثالي للشعارات ولقطات الشاشة والنصوص، لكنه لا يصغّر الصور الفوتوغرافية كثيرًا.',
        ],
        bullets: [
          'الصور الفوتوغرافية → JPG أو WebP بجودة 70–85%',
          'الشعارات والأيقونات ولقطات النصوص → PNG أو WebP بجودة +90%',
          'عند الحاجة للشفافية → PNG أو WebP (وليس JPG أبدًا)',
        ],
        toolSlug: 'image-compressor',
      },
      {
        heading: 'اختر إعداد الجودة الصحيح',
        paragraphs: [
          'الجودة منزلق وليست مفتاحًا. لمعظم الصور، 80% هي النقطة المثالية: تتقلص الملفات بشدة وتبدو سليمة. انزل إلى 60–70% للمصغرات والصور الرمزية التي لا يقرّبها أحد.',
          'قارن دائمًا قبل وبعد بتكبير 100%. إذا رأيت تكتلات في السماء الصافية أو البشرة، ارفع الجودة 5–10 درجات.',
        ],
        bullets: [
          'صور الواجهات: JPG بجودة 80% أو WebP بجودة 75–80%',
          'مرفقات البريد: JPG بجودة 70% وعرض أقصى 1600 بكسل',
          'المصغرات والرموز: JPG بجودة 60–65%',
        ],
      },
      {
        heading: 'حوّل لصيغة حديثة لتوفير إضافي',
        paragraphs: [
          'صيغة WebP تتفوق على JPG عادة بنسبة 25–35% بنفس الجودة المرئية، وتدعمها كل المتصفحات الحديثة. إذا كانت منصتك تقبل WebP فالتحويل هو أكبر مكسب مجاني متاح.',
          'أما تحويل JPG إلى PNG فيكبّر الملفات — فلا تسلكه إلا عند الحاجة للشفافية أو للتحرير اللاحق.',
        ],
        toolSlug: 'jpg-to-webp',
      },
      {
        heading: 'اضغط خطوة بخطوة مع Piclizer',
        paragraphs: [
          'افتح أداة ضغط الصور، وأفلت حتى 20 صورة، وحرّك منزلق الجودة بينما تشاهد التوفير لحظيًا. كل المعالجة في متصفحك — لا يُرفَع شيء، فحتى الصور الحساسة آمنة.',
          'تحتاج حجمًا دقيقًا لنموذج مثل "أقل من 100KB"؟ استخدم أداة الضغط إلى حجم دقيق: اكتب الهدف وستصل إليه تلقائيًا.',
        ],
        toolSlug: 'image-to-exact-kb',
      },
    ],
    faqs: [
      { q: 'كم يمكن أن أضغط الصورة؟', a: 'صورة هاتف 5MB تتقلص عادة إلى 300–600KB بجودة 80% دون فرق مرئي — توفير حوالي 90%.' },
      { q: 'هل يعمل الضغط دون إنترنت؟', a: 'بعد تحميل صفحة Piclizer، يعمل الضغط بالكامل في متصفحك دون حاجة لاتصال.' },
      { q: 'أضغط الأصل أم نسخة؟', a: 'احتفظ بالأصل دائمًا. الضغط يحذف بيانات نهائيًا، فاعمل على نسخة وأرشف الملف الكامل الجودة.' },
      { q: 'لماذا ملف PNG ما زال ضخمًا؟', a: 'لأن PNG غير مضغوطة الفقد. للصور الفوتوغرافية بدّل الإخراج إلى JPG أو WebP.' },
    ],
    relatedTools: ['image-compressor', 'image-to-exact-kb', 'jpg-to-webp', 'heic-to-jpg'],
    relatedGuides: ['reduce-image-size', 'convert-heic-to-jpg', 'convert-jpg-to-png'],
  },
  'reduce-image-size': {
    slug: 'reduce-image-size',
    title: 'كيف تصغّر حجم الصورة للرفع والنماذج',
    description: 'بلغ حدود الرفع الدقيقة مثل 100KB أو 2MB: صغّر صور JPG وPNG والايفون إلى حجم محدد بأدوات مجانية في المتصفح.',
    intro: [
      '«يجب ألا تتجاوز الصورة 100KB». بوابات التوظيف ولوحات الامتحانات وطلبات التأشيرات تفرض حدودًا صارمة — وترفض أي ملف أكبر دون توضيح.',
      'يوضح هذا الدليل الرافعتين اللتين تتحكمان بحجم الملف (الجودة والأبعاد)، والأهداف الشائعة الناجحة، وكيف تصيب الرقم الدقيق من أول محاولة.',
    ],
    minutes: 4,
    sections: [
      {
        heading: 'اعرف هدفك قبل أن تبدأ',
        paragraphs: [
          'معظم النماذج تقبل JPG بين 20KB و200KB للصور الشخصية، وصور الجوازات حوالي 100–300KB. وتحب البوابات الأرقام المستديرة: 50KB و100KB و200KB.',
          'اقرأ الشرط بدقة: "بحد أقصى 100KB" يعني مساوٍ أو أقل، بينما "بين 50–100KB" يحتاج إصابة دقيقة — وهذا ما صُممت له أداة الحجم الدقيق.',
        ],
        bullets: [
          'رفع الهوية والجواز: عادة 20–300KB بصيغة JPG',
          'صورة آمنة للبريد: أقل من 500KB',
          'صورة واجهة موقع: 150–400KB بصيغة WebP',
        ],
      },
      {
        heading: 'الرافعة الأولى: خفض الجودة',
        paragraphs: [
          'الجودة أولًا لأنها لا تغيّر الأبعاد. خفض الصورة من 95% إلى 80% ينصّف الملف غالبًا دون فرق مرئي.',
          'لصور النماذج التي تُعرَض صغيرة، تكفي جودة 65–75% — فالمُراجِع يرى مصغرًا لا ملصقًا.',
        ],
        toolSlug: 'image-compressor',
      },
      {
        heading: 'الرافعة الثانية: تصغير الأبعاد',
        paragraphs: [
          'عدد البكسلات يقود حجم الملف شبه خطيًا: تنصيف العرض والارتفاع يربّع عدد البكسلات. صورة هاتف 4000 بكسل تُعرَض بعرض 600 تحمل بيانات أكثر بـ 40 ضعفًا من اللازم.',
          'قاعدة آمنة: صغّر بحيث يطابق الضلع الأطول الاستخدام الفعلي — 800–1200 بكسل لرفع الويب، والمقاس المطلوب تمامًا لصور الهوية.',
        ],
        toolSlug: 'image-resizer',
      },
      {
        heading: 'اصِب الرقم الدقيق تلقائيًا',
        paragraphs: [
          'التخمين والتحقق والتكرار ممل. بدلًا منه اكتب هدفك — مثل 100KB — في أداة الضغط إلى حجم دقيق. تختبر مستويات الجودة بالدقة الكاملة، ولا تصغّر الأبعاد إلا عند الضرورة.',
          'وإذا استحال الهدف حتى بأصغر ملف ممكن، ستخبرك الأداة بصدق بدل تسليمك ملفًا مرفوضًا.',
        ],
        toolSlug: 'image-to-exact-kb',
      },
    ],
    faqs: [
      { q: 'صورتي يجب أن تكون 100KB بالضبط. كيف؟', a: 'استخدم أداة الضغط إلى حجم دقيق، اكتب 100، اختر JPG، وحمّل — ستضبط الجودة (والأبعاد عند اللزوم) لتهبط عند 100KB أو أقل.' },
      { q: 'هل ستبدو صورة 100KB سيئة؟', a: 'بأحجام العرض المعتادة في النماذج تبدو جيدة. يظهر فقد الجودة فقط عند التقريب أبعد بكثير من حجم العرض.' },
      { q: 'JPG أم PNG للأحجام الصغيرة؟', a: 'JPG دائمًا للصور. PNG غير مفقودة ولا يمكنها فيزيائيًا بلوغ أحجام ضئيلة مع المحتوى الفوتوغرافي.' },
      { q: 'ما زال النموذج يرفض ملفي. لماذا؟', a: 'تحقق من ثلاثة: حجم الملف، والأبعاد (بعض النماذج تحد البكسلات أيضًا)، والصيغة — فكثير من البوابات لا يقبل إلا JPG.' },
    ],
    relatedTools: ['image-to-exact-kb', 'image-compressor', 'image-resizer', 'passport-photo-maker'],
    relatedGuides: ['compress-image', 'resize-image', 'compress-iphone-photos'],
  },
  'convert-heic-to-jpg': {
    slug: 'convert-heic-to-jpg',
    title: 'كيف تحوّل HEIC إلى JPG (صور الايفون)',
    description: 'حوّل صور الايفون HEIC إلى JPG مجانًا في متصفحك. لماذا توجد HEIC ومتى تحوّل وكيف تحافظ على الجودة والاتجاه.',
    intro: [
      'منذ iOS 11 تحفظ هواتف الايفون الصور بصيغة HEIC — صيغة تخزن جودة مذهلة بنصف مساحة JPG. المشكلة: تطبيقات ويندوز وكثير من المواقع وأنظمة البريد والهواتف القديمة ما زالت ترفض فتحها.',
      'تحويل HEIC إلى JPG يحل التوافق فورًا. وعندما يتم في المتصفح فهو خاص أيضًا: لا تسافر صورك إلى أي خادم.',
    ],
    minutes: 4,
    sections: [
      {
        heading: 'لماذا يستخدم الايفون HEIC',
        paragraphs: [
          'تستخدم HEIC تقنيات ضغط حديثة كالفيديو المتطور. لقطة ايفون 48MP التي ستكون 15MB بصيغة JPG تتسع في حوالي 4MB بصيغة HEIC مع HDR وسلاسل اللقطات.',
          'تتعامل معها آبل ودروبوكس وصور Google أصالة. وتبدأ المشاكل مع عارض صور ويندوز وكثير من بوابات الرفع الحكومية والشاشات والطابعات القديمة وبعض نماذج الويب.',
        ],
      },
      {
        heading: 'حوّل في المتصفح خطوة بخطوة',
        paragraphs: [
          'افتح أداة تحويل HEIC إلى JPG وأضف حتى 10 صور. تُفَك كل صورة على جهازك مع تطبيق اتجاه EXIF — فلا تصل الصور الطولية جانبية — ثم تُرمَّز JPG بالجودة التي تختارها.',
          'جودة 90% هي الخيار الأفضل: مطابقة بصريًا لملف HEIC وحجم معتدل. انزل إلى 80% للمشاركة والمراسلة.',
        ],
        toolSlug: 'heic-to-jpg',
      },
      {
        heading: 'متى تختار PNG بدلًا منه',
        paragraphs: [
          'صيغة JPG صحيحة للمشاركة والرفع والأرشفة اليومية. اختر تحويل HEIC إلى PNG فقط عندما تنوي تحريرًا مكثفًا — فـ PNG غير مفقودة فلا تتدهور مع الحفظ المتكرر — مقابل ملفات أكبر بكثير.',
        ],
        toolSlug: 'heic-to-png',
      },
      {
        heading: 'أوقف المشكلة من المصدر (اختياري)',
        paragraphs: [
          'إذا كان التوافق أهم من التخزين، اجعل الايفون يصور JPG: الإعدادات ← الكاميرا ← التنسيقات ← الأكثر توافقًا. ستُحفَظ الصور الجديدة JPG وتبقى ملفات HEIC الحالية كما هي.',
          'وللصور الملتقطة سابقًا، حوّلها دفعة واحدة بالأداة أعلاه واحتفظ بنسخ JPG بجانب الأصول.',
        ],
        bullets: [
          'عالي الكفاءة = HEIC (ملفات صغيرة ودعم واسع لدى آبل)',
          'الأكثر توافقًا = JPG (يعمل في كل مكان وملفات أكبر)',
          'النقل إلى الحاسوب عبر USB يستخدم الأصول الأصلية في الحالتين',
        ],
      },
    ],
    faqs: [
      { q: 'هل تحويل HEIC إلى JPG مجاني؟', a: 'نعم — تحويلات غير محدودة تعمل بالكامل في متصفحك دون حساب أو علامة مائية.' },
      { q: 'هل ستفقد صوري الجودة؟', a: 'بجودة 90% فأعلى لا فرق يُرَى. JPG مفقودة تقنيًا، فاحتفظ بأصول HEIC مؤرشفة.' },
      { q: 'لماذا تظهر صوري المحوَّلة مقلوبة؟', a: 'لا ينبغي ذلك: يطبق Piclizer اتجاه EXIF أثناء فك الترميز. وإذا وصل ملف جانبيًا فوسم اتجاهه كان محذوفًا قبل الرفع.' },
      { q: 'هل يمكن التحويل على ويندوز؟', a: 'نعم — تعمل الأداة في أي متصفح حديث على ويندوز وماك وأندرويد والايفون نفسه.' },
    ],
    relatedTools: ['heic-to-jpg', 'heic-to-png', 'image-compressor', 'image-to-exact-kb'],
    relatedGuides: ['compress-iphone-photos', 'compress-image', 'convert-jpg-to-png'],
  },
  'compress-iphone-photos': {
    slug: 'compress-iphone-photos',
    title: 'كيف تضغط صور الايفون للمشاركة والرفع',
    description: 'صغّر صور الايفون (HEIC وHDR ودقة 48MP) لواتساب والبريد والنماذج — مع اتجاه صحيح وجودة عالية، كل ذلك في متصفحك.',
    intro: [
      'تصوّر هواتف الايفون الحديثة بدقة 12–48MP بصيغة HEIC مع HDR — رائعة، لكن كل ملف قد يكون 4–10MB. تطبيقات المراسلة تعيد ضغطها بقسوة، والبريد يرتد بالمرفقات الكبيرة، والنماذج ترفضها مباشرة.',
      'يمنحك هذا الدليل سير عمل ثابتًا: حوّل ثم اضغط وأصِب الأهداف الدقيقة — مع الحفاظ على اتجاه الصور وألوانها.',
    ],
    minutes: 5,
    sections: [
      {
        heading: 'افهم ما يُثقِل صور الايفون',
        paragraphs: [
          'ثلاثة أمور تضخّم ملفات الايفون: الدقة الهائلة (حتى 8064 بكسل عرضًا)، وبيانات HDR، ورفيق الفيديو في الصور الحية. وللمشاركة على الشاشات، معظم هذه البيانات غير مرئية.',
          'والخبر الجيد: تصغير صورة 48MP إلى 2048 بكسل للمشاركة لا يفقد شيئًا يُرَى على شاشة هاتف أو حاسوب — ويخفض الملف 80–90%.',
        ],
        bullets: [
          'HEIC بدقة 48MP: 8–25MB للقطة',
          'HEIC قياسية 12MP: 2–5MB للقطة',
          'المشاركة عبر واتساب: تُعاد تلقائيًا لحوالي 200KB',
        ],
      },
      {
        heading: 'الخطوة 1 — حوّل HEIC لصيغة ودودة',
        paragraphs: [
          'إذا كانت وجهتك ترفض HEIC (كثير من النماذج وتطبيقات ويندوز)، حوّل أولًا. تفك أداة HEIC إلى JPG كل صورة محليًا مع تصحيح الاتجاه، ثم ترمّز JPG عامة.',
          'تجاوز هذه الخطوة عند المشاركة لتطبيقات تقبل HEIC أصالة مثل iMessage وAirDrop وصور Google.',
        ],
        toolSlug: 'heic-to-jpg',
      },
      {
        heading: 'الخطوة 2 — اضغط حسب وجهتك',
        paragraphs: [
          'للمراسلة والشبكات الاجتماعية اضغط JPG بجودة 75–80% — أعلى بكثير مما تُبقيه تلك التطبيقات أصلًا. وللبريد حافظ على 85% وضلع أطول 2048 بكسل لتبقى الصور ناضرة على الشاشات الكبيرة.',
          'وللنماذج الصارمة ("الصورة أقل من 100KB") تجاوز التخمين: أداة الحجم الدقيق تصيب الرقم مباشرة.',
        ],
        toolSlug: 'image-compressor',
      },
      {
        heading: 'انتبه لاتجاه الصورة وخصائص HDR',
        paragraphs: [
          'يخزن الايفون الدوران كبيانات وصفية (EXIF) لا بتدوير البكسلات. المحوّلات الرخيصة تتجاهلها فتسلّم صورًا جانبية. يطبق Piclizer الاتجاه أثناء فك الترميز فتبقى الصور الطولية طولية.',
          'قد تبدو صور HDR المحوَّلة إلى JPG القياسية مسطحة قليلًا في الإضاءات — طبيعي ولا مفر منه خارج حاوية HDR، ويكاد لا يُلاحَظ بأحجام المشاركة.',
        ],
        toolSlug: 'image-to-exact-kb',
      },
    ],
    faqs: [
      { q: 'ما أفضل حجم لصور واتساب؟', a: 'يعيد واتساب ضغط كل شيء لحوالي 1600 بكسل و200KB. إرسال JPG مسبق الضغط بمقاس 1600 وجودة 80% يمنحك التحكم بدل defaults القاسية.' },
      { q: 'كيف أرسل صور الايفون كاملة الجودة بالبريد؟', a: 'استخدم Mail Drop أو AirDrop أو رابطًا سحابيًا. وإذا لزم المرفق فاضغط JPG بجودة 85% أولًا — لقطة 48MP تهبط من 8MB لحوالي 2MB دون فرق.' },
      { q: 'هل تُحوَّل الصور الحية؟', a: 'يُحوَّل الإطار الثابت طبيعيًا، ولا يُحمَل رفيق الفيديو القصير إلى JPG.' },
      { q: 'هل تُرفَع صوري الشخصية؟', a: 'أبدًا. التحويل والضغط يعملان داخل متصفحك — آمن حتى للصور الحساسة.' },
    ],
    relatedTools: ['heic-to-jpg', 'image-compressor', 'image-to-exact-kb', 'image-resizer'],
    relatedGuides: ['convert-heic-to-jpg', 'reduce-image-size', 'compress-image'],
  },
  'resize-image': {
    slug: 'resize-image',
    title: 'كيف تغيّر أبعاد الصورة بدقة',
    description: 'غيّر أبعاد صور JPG وPNG وWebP لأحجام دقيقة للملفات الشخصية واللافتات والطباعة — مع التحكم بنسبة العرض، مجانًا في متصفحك.',
    intro: [
      'كل منصة تريد بكسلات مختلفة: 1080×1080 لإنستغرام، و1920×1080 للافتة، و35×45 مم بدقة 300 DPI للطباعة. الرفع بالمقاس الخاطئ يعني قصًا تلقائيًا قبيحًا أو نماذج مرفوضة.',
      'يشرح هذا الدليل البكسلات مقابل مقاس الطباعة، ونسب الأبعاد، وكيف تصغّر بدقة دون تمديد — ومتى تقص بدلًا من التصغير.',
    ],
    minutes: 4,
    sections: [
      {
        heading: 'البكسلات ونسبة الأبعاد ولماذا تتمدد الصور',
        paragraphs: [
          'الصورة شبكة بكسلات، ونسبة أبعادها هي شكل الشبكة (16:9 عريضة، و1:1 مربعة). حشر بكسلات 16:9 في إطار 1:1 دون قص لا بد أن يمددها أو يسحقها.',
          'قفل نسبة الأبعاد موجود لمنع ذلك تمامًا: غيّر العرض فيتبعه الارتفاع تناسبيًا. لا تفكه إلا عندما تحتاج أبعادًا اعتباطية فعلًا.',
        ],
        toolSlug: 'image-resizer',
      },
      {
        heading: 'مقاسات شائعة تستحق الحفظ',
        paragraphs: [
          'الرموز مربعة صغيرة، واللافتات عريضة، والقصص طولية. صمم بالمقاس المعروض بالضبط أو ضعفه لحدة الشاشات عالية الكثافة — وليس عشرة أضعافه الذي يهدر النطاق فقط.',
        ],
        bullets: [
          'منشور إنستغرام: 1080 × 1080 بكسل (1:1)',
          'مصغر يوتيوب: 1280 × 720 بكسل (16:9)',
          'غلاف قصة: 1080 × 1920 بكسل (9:16)',
          'واجهة موقع: 1920 × 1080 بكسل وأقل من 400KB',
          'هوية مطبوعة 35×45 مم: 413 × 531 بكسل بدقة 300 DPI',
        ],
      },
      {
        heading: 'تصغير أم قص؟ اختر الصواب',
        paragraphs: [
          'صغّر عندما يجب أن تبقى الصورة كاملة والمشكلة في عدد البكسلات فقط. وقص عندما تكون المشكلة في الشكل — فقص صورة عريضة إلى مربع يُبقي الوجوه طبيعية بدل سحقها.',
          'والتدفق المعتاد: قص لشكل الهدف أولًا، ثم صغّر لبكسلات الهدف. والأداتان تعملان محليًا في ثوانٍ.',
        ],
        toolSlug: 'image-cropper',
      },
      {
        heading: 'صور الهوية تحتاج حساب طباعة لا تخمينًا',
        paragraphs: [
          'مقاسات الطباعة بالمليمترات والملفات بالبكسلات: البكسلات = مم ÷ 25.4 × DPI. صورة 35×45 مم بدقة 300 DPI هي بالضبط 413×531 بكسل.',
          'يحسب صانع صور الجواز هذه المعادلة تلقائيًا للمقاسات القياسية ويقص صورتك من المنتصف لتناسبها.',
        ],
        toolSlug: 'passport-photo-maker',
      },
    ],
    faqs: [
      { q: 'هل يقلل التصغير الجودة؟', a: 'التصغير يحافظ على الحدة. أما تكبير الصورة فوق حجمها الأصلي فلا يخترع تفاصيل ويبدو ضبابيًا — ابدأ دائمًا من أكبر مصدر لديك.' },
      { q: 'كيف أتجنب الصور الممددة؟', a: 'أبقِ قفل نسبة الأبعاد مفعّلًا. وإذا اختلف شكل الهدف عن صورتك فقص للشكل أولًا.' },
      { q: 'ما DPI اللازم للشاشات؟', a: 'لا معنى لـ DPI على الشاشات — المهم أبعاد البكسلات فقط. ويُعتَد بـ DPI للطباعة حصرًا.' },
      { q: 'هل يمكن تصغير PNG الشفاف؟', a: 'نعم. يحافظ التصغير على قناة الشفافية عندما يبقى الإخراج PNG أو WebP.' },
    ],
    relatedTools: ['image-resizer', 'image-cropper', 'passport-photo-maker', 'image-compressor'],
    relatedGuides: ['compress-image', 'reduce-image-size', 'convert-jpg-to-png'],
  },
  'convert-jpg-to-png': {
    slug: 'convert-jpg-to-png',
    title: 'كيف تحوّل JPG إلى PNG (ومتى لا تفعل)',
    description: 'حوّل JPG إلى PNG مجانًا في متصفحك — وتعلّم متى يفيد PNG (التحرير والرسومات) ومتى يهدر المساحة فقط.',
    intro: [
      'تحويل JPG إلى PNG بنقرة — لكنه أكثر تحويل يُساء فهمه. PNG لا يستعيد جودة حذفها JPG، بل يوقف مزيدًا من الفقد ويضيف دعم الشفافية للتحرير اللاحق.',
      'يوضح هذا الدليل الأسباب المشروعة للتحويل، والحالات التي يجب ألا تحوّل فيها، والخطوات الدقيقة.',
    ],
    minutes: 4,
    sections: [
      {
        heading: 'ماذا يفعل تحويل JPG إلى PNG فعلًا',
        paragraphs: [
          'صيغة JPG مفقودة: كل حفظ يحذف تفاصيل دقيقة. وPNG غير مفقودة: كل حفظ يحفظ البكسلات بدقة. التحويل يفك JPG مرة ويعيد حفظ كل بكسل بأمانة — فتتجمد الجودة عند مستواها الحالي بدل مزيد من التدهور.',
          'والثمن هو الحجم: توقع PNG أكبر 3–8 مرات من JPG. هذه فيزياء طبيعية وليست خللًا.',
        ],
        toolSlug: 'jpg-to-png',
      },
      {
        heading: 'ثلاثة أسباب وجيهة للتحويل',
        paragraphs: [
          'حوّل عندما توشك على التحرير والحفظ مرارًا (أصول PNG تمنع فقد الأجيال)، أو عندما تحتاج إضافة مناطق شفافة في محرر، أو عندما تشترط أداة أو مطبعة مدخلات PNG.',
        ],
        bullets: [
          'أصول التحرير: حوّل مرة وحرّر بحرية، وصدّر JPG في النهاية',
          'إضافة شفافية أو نصوص في محرر',
          'بوابات رفع لا تقبل إلا PNG',
        ],
      },
      {
        heading: 'ثلاثة أسباب لألا تفعل',
        paragraphs: [
          'لا تحوّل "لتحسين الجودة" (مستحيل)، ولا "لجعلها HD" (البكسلات لا تزيد)، ولا "لتوفير المساحة" (صور PNG أكبر دائمًا — استخدم WebP للملفات الأصغر).',
          'وللرحلة العكسية — ملفات أصغر من مصادر PNG — فمحوّل PNG إلى JPG مع منزلق الجودة هو الأداة الصحيحة.',
        ],
        toolSlug: 'png-to-jpg',
      },
      {
        heading: 'حوّل خطوة بخطوة',
        paragraphs: [
          'افتح أداة تحويل JPG إلى PNG، وأضف حتى 10 صور، واضغط تحويل. تُفَك الملفات وتُرمَّز في متصفحك — لا يُرفَع شيء — وتُحمَّل فورًا كملفات PNG.',
          'ثم حرّر بحرية: كل حفظ PNG لاحق غير مفقود، فلا تهبط الجودة مجددًا حتى تصدّر JPG أو WebP نهائية عن قصد.',
        ],
        toolSlug: 'jpg-to-png',
      },
    ],
    faqs: [
      { q: 'هل يحسّن تحويل JPG إلى PNG الجودة؟', a: 'لا. يحفظ الجودة الحالية بدقة ويمنع مزيدًا من الفقد أثناء التحرير — لكن التفاصيل التي حذفها JPG ذهبت للأبد.' },
      { q: 'لماذا ملف PNG أكبر بكثير؟', a: 'تخزين ضجيج الصور وأنسجتها دون فقد يكلّف بايتات. وللصور التي تشاركها (لا تحررها) ابقَ مع JPG أو WebP.' },
      { q: 'هل يمكن أن تكون PNG بخلفية شفافة؟', a: 'نعم — تدعم PNG الشفافية الكاملة. لكن تحويل JPG يحفظ البكسلات الموجودة فقط، وإنشاء الشفافية يحتاج محررًا أو أداة إزالة الخلفية.' },
      { q: 'JPG أم PNG أم WebP لموقعي؟', a: 'للصور: WebP (الأصغر) أو JPG (الأشمل). وللرسومات حادة الحواف أو الشفافة: PNG أو WebP.' },
    ],
    relatedTools: ['jpg-to-png', 'png-to-jpg', 'png-to-webp', 'background-remover'],
    relatedGuides: ['compress-image', 'convert-heic-to-jpg', 'resize-image'],
  },
};

export function getGuide(slug: string, locale: string): GuideContent | undefined {
  const table = locale === 'ar' ? GUIDES_AR : GUIDES_EN;
  return (table as Record<string, GuideContent>)[slug];
}

export function getAllGuides(locale: string): GuideContent[] {
  return GUIDE_SLUGS.map((slug) => getGuide(slug, locale)!).filter(Boolean);
}
