# Piclizer — Production Audit & Remediation

**التاريخ:** 2026-09-20 · **الفرع:** `arena/01a0bc54-picsora` · **نقطة البداية:** `a8fd8a5`

مبدأ العمل: **Fix what is broken. Preserve what already works.** لا redesign، لا AI،
لا architecture جديدة، لا library مستبدلة، لا feature مضافة.

---

## 0. الخلاصة بالأرقام

| | العدد |
|---|---|
| أدوات في الـ registry (مصدر الحقيقة) | **141** (141 slug فريد، صفر تكرار) |
| Bugs حقيقية تم إصلاحها | **5** |
| Commits | 6 (كل واحد بهدف واحد) |
| ملفات تم تعديلها | 13 |
| Regression tests جديدة | 3 ملفات/اختبارات + 2 assertions في suite موجود |
| صفحات تم فحصها | 346 (173 route × 2 لغة) |
| Dead links | 0 |
| مشاكل SEO | 0 |
| Test suite | 39 + 42 + 6 runner tests + 3 suites → **كلها ناجحة** |
| `tsc --noEmit` | نظيف |
| `next build` | نظيف |

### حالة المشروع قبل البدء (baseline مُقاس، ليس افتراضًا)

```
npx tsc --noEmit        → exit 0
npm run build           → exit 0، 282 صفحة أداة (141 × 2)
npm run test:tools      → 39 + 40 + 6 = 85 test، كلها ناجحة
crawl 346 صفحة          → 0 non-200، 0 dead link
sitemap                 → 334 URL، 0 مكرر، كلها 200
SEO                     → 0 canonical mismatch، 0 duplicate title/description
i18n (tool content)     → 141/141 في en و ar، صفر مفقود
```

المشروع **سليم إلى حد كبير** وقد سبق تدقيقه (يوجد `docs/SEO-AUDIT-2026-09.md` و
`docs/SECURITY-AUDIT.md`). لذلك كان عدد الإصلاحات قليلًا ومتعمّدًا — لم أُضف عملًا
لمجرد إضافة عمل.

---

## A. Bugs Found

### A1 — 24 مفتاح ترجمة مفقود → الواجهة كانت تعرض نص المفتاح نفسه

**Tool/Page:** 8 مسارات حية + مودال الكوكيز على كل الموقع

**المشكلة:** next-intl عند فقدان رسالة **لا يرمي خطأ** — يعيد نص المفتاح نفسه
(`getMessageFallback` الافتراضي = `join(namespace, key)`) ويسجّل خطأ في console فقط.
فكان المستخدم يرى حرفيًا:

```
زر:   "dpi.apply"           بدل "Apply 300 DPI"
عنوان:"favicon.generate"    بدل "Generate favicon package"
تنبيه:"upscale.honestNote"  بدل الشرح
حقل:  "dpi.target"          بدل "Target DPI"
```

**لماذا لم يكتشفها build ولا crawl:** كل أدوات الموقع تُحمَّل عبر `next/dynamic`
(`components/tools/ui/index.ts` و `kit/registry.ts`)، فنصوصها غير موجودة في
HTML القادم من السيرفر إطلاقًا.

**السبب:** الأدوات أُضيفت للـ registry والـ UI بدون إضافة نصوصها للكتالوج.

**الإثبات:** عبر `createTranslator` الحقيقي من next-intl ضد الكتالوجين الفعليين —
قبل الإصلاح: 24 مفتاحًا تعيد نفسها في en **و** ar. بعد الإصلاح: كلها تعيد نصًا حقيقيًا.

**المفاتيح والمسارات المتأثرة:**

| Route | مفاتيح |
|---|---|
| `/tools/image-dpi-converter` | 8 — **كل** تسميات الأداة (`dpi.*`) |
| `/tools/favicon-generator` | 5 (`favicon.*`) |
| `/tools/image-upscaler` | 4 (`upscale.*`) |
| `/tools/passport-photo-maker` | `passport.complianceNote` |
| `/tools/image-to-exact-kb` | `exactKb.fixedTarget` |
| `/tools/*-to-avif` | `convert.avifBlocked` |
| `/tools/pdf-compare` | `pdfTools.compareChars` |
| مودال الكوكيز (كل الموقع) | `consent.close` |
| مسار الأخطاء | `errors.avifUnsupported`، `errors.icoDecodeFailed` |

**الإصلاح:** إضافة المفاتيح للكتالوجين الموجودين فقط. `passport`/`exactKb`/`consent`/
`pdfTools`/`errors` كانت موجودة → أُضيف المفتاح الناقص. و `dpi`/`favicon`/`upscale`/
`convert` أُضيفت كـ namespaces جذرية **بنفس النمط القائم أصلًا** (`bgRemover`,
`signature`, `imageMeta`, `jwt`, `sql`, `yaml`). **لم يتغير أي شيء في بنية i18n.**

**الملفات:** `messages/en.json`, `messages/ar.json`, `scripts/tool-tests/run-new-tools.ts`

**Regression guard:** اختبار جديد يمسح كل `useTranslations('ns')` في `app/` و
`components/` مع الـ namespace الصحيح لكل `t()`، ويقارنها بالكتالوجين. تم التحقق أنه
**يفشل فعلًا** عند حذف `dpi.apply` من `ar.json`:
```
❌ untranslated keys: ar: dpi.apply (components/tools/ui/dpi.tsx)
```

---

### A2 — قائمة أرقام كبيرة كانت تُسقط الصفحة بالكامل (Average Calculator)

**Tool:** `/tools/average-calculator`

**المشكلة:** `Math.max(...counts.values())` في `lib/calculators/index.ts:673`.
الـ spread في استدعاء دالة يمرّر كل عنصر كـ argument منفصل، و V8 يرمي
`RangeError: Maximum call stack size exceeded`.

**الحدود المُقاسة (tsx / Node 22):**
```
calculateAverage  125,000 قيمة → سليم
                  150,000 قيمة → RangeError
```

**لماذا كارثي:** الاستدعاء داخل `React.useMemo` أثناء الـ render، ولا يوجد
**أي error boundary في المشروع كله** (تم التحقق: صفر `ErrorBoundary` /
`componentDidCatch` / `error.tsx`). فالاستثناء يفكّك الشجرة → **صفحة بيضاء**،
وليس رسالة خطأ في الأداة.

**الإثبات:** بإرجاع الكود الأصلي من git:
```
RangeError: Maximum call stack size exceeded
    at calculateAverage (lib/calculators/index.ts:673:21)
    at scripts/tests/logic.test.ts:117
exit code 1
```

**الإصلاح:** حساب الحد الأقصى داخل الحلقة الموجودة أصلًا. **صفر تغيير في السلوك** —
كل الـ assertions القديمة تمر كما هي، و 1,000,000 قيمة تعمل الآن.

**الملفات:** `lib/calculators/index.ts`, `scripts/tests/logic.test.ts`

---

### A3 — نفس الانهيار في Text Frequency Counter

**Tool:** `/tools/text-frequency-counter`

**المشكلة:** `Math.max(...all.map(e => e.count))` في `lib/text-processing/frequency.ts:123`.

**الحدود المُقاسة:**
```
countFrequency  100,000 مصطلح مميز → سليم
                150,000 مصطلح مميز → RangeError
```
نفس السياق (`useMemo` بلا error boundary) → صفحة بيضاء.

**الإصلاح:** تتبع `maxCount` داخل الحلقة التي تبني الجدول أصلًا. 400,000 مصطلح يعمل الآن.

**تُرك عمدًا (لم يُلمس):**
- `lib/tools/processors/merge.ts:17-18` — `Math.max(...files.map(...))` محدود بـ `maxFiles ≤ 30`.
- `lib/developer-tools/html2md.ts:120` — `Math.max(...rows.map(...))` لكن المدخلات
  محدودة بـ `MAX_INPUT = 512 KB` (≈28,000 صف جدول).
كلاهما تحت الحد بنيةً، فتغييرهما عبث.

**الملفات:** `lib/text-processing/frequency.ts`, `scripts/tests/logic.test.ts`

---

### A4 — شريط تقدّم OCR يتجمّد بعد أول تشغيل

**Tool:** `/tools/image-ocr` و `/tools/pdf-ocr`

**المشكلة:** tesseract.js يربط `logger` **مرة واحدة داخل closure الخاص بـ
`createWorker`**، و `recognize(image, options, output, jobId)` لا يوفر logger لكل
استدعاء (`RecognizeOptions` = `rectangle | pdfTitle | pdfTextOnly | rotateAuto | rotateRadians` فقط).
و `getWorker()` كان يخزّن الـ worker حسب اللغة لكنه يلتقط `onProgress` وقت الإنشاء —
فمن الصورة الثانية فصاعدًا يستدعي الـ worker المخزّن **callback أول مستدعٍ للأبد**.

**الإثبات (ضد `recognizeImage` الحقيقي مع تesseract.js مُستبدل بـ stub يطابق سلوك
المكتبة الفعلي):**
```
قبل الإصلاح:
  run 1 callback: [0.1, 0.25, 0.5, 0.75, 1, 0.25, 0.5, 0.75, 1]  ← تقدّم run 2 ذهب إليه
  run 2 callback: []                                             ← لم يتحرك أبدًا
بعد الإصلاح:
  run 1 callback: [0.1, 0.25, 0.5, 0.75, 1]
  run 2 callback: [0.25, 0.5, 0.75, 1]
  worker created once and reused: 1                              ← الـ cache لم يُكسر
```

**الأثر على المستخدم:** في `image-ocr.tsx` الـ closure يلتقط `i` و `total`، فكان
تشغيل ثانٍ على صورة واحدة يعرض "1 of 3" وشريطه لا يتقدم. وإذا غادر المستخدم وعاد،
تذهب الكتابات إلى component مفكوك.

**الإصلاح:** الـ callback أصبح في متغير module-level يُقرأ وقت الانبعاث.
**الـ worker cache بقي كما هو تمامًا** (إعادة تنزيل المحرك وبيانات اللغة لكل صورة
ستجعل الأداة بطيئة بشكل غير قابل للاستخدام). وحواجز الحجم (`MAX_OCR_BYTES = 25 MB`،
`image.size === 0`) لم تتغير.

**لم أرفع أي limit:** `MAX_PAGES = 30` في `pdf-ocr.tsx` مقصود ومُعلن للمستخدم عبر
`ocr.pageLimitNote` — التعليق في الكود يوضح سببه: *"Rendering + OCR is heavy; cap
pages per document to protect the tab."* رفعه يعني risk انهيار التبويب.

**الملفات:** `lib/ocr/tesseract.ts`, `scripts/tests/ocr.test.ts` (جديد), `package.json`

---

### A5 — الصفحة الرئيسية كانت تدّعي 95 أداة

**Page:** `/en` و `/ar` — قسم "What is Piclizer"

**المشكلة:** العنوان الرئيسي كان يشتق العدد من الـ registry
(`t('home.heroTitle', { count: TOOLS.length })` مع تعليق يشرح ذلك)، لكن الفقرة
التحريرية أسفله كانت **تكتب الرقم يدويًا** وقد تخلّفت 46 أداة:

```
en: "...brings 95 everyday file utilities into one fast, private website."
ar: "...يجمع 95 أداة يومية للملفات في موقع واحد..."
```

**الإصلاح:** `{count}` من `TOOLS.length` — نفس مصدر الحقيقة الذي يستخدمه العنوان.
لا رقم يدوي ولا workaround: إضافة أداة تحدّث الجملة تلقائيًا.

**بعد الإصلاح (مُتحقق من HTML المُصيَّر):**
```
/en  → "Piclizer is a free online toolbox that brings 141 everyday file utilities..."
/ar  → "بيكلّايزر صندوق أدوات مجاني عبر الإنترنت يجمع 141 أداة يومية..."
```

**صفحة About:** تذكر `141` و"nine categories" في `lib/content/legal.*.json`. هذان
**صحيحان اليوم**. هذا الملف مستند JSON عادي يُصيَّر عبر `LegalContent` وليس كتالوج
next-intl، فلا يدعم interpolation. **لم أُغيّر بنيته** — بدل ذلك أضفت assertion
يثبّت الرقمين على الـ registry حتى لا يتخلفا كما حدث لـ `aboutP1`.

**ملاحظة تقنية مهمة:** الحارس لا يمكن أن ينتهي بـ `\b` — حدود الكلمات في JavaScript
ASCII-only حتى مع flag الـ `u`، فـ `\b` بعد `أداة` لا يعمل أبدًا. اكتُشف بالاختبار:
النسخة بـ `\b` كانت تلتقط الخطأ الإنجليزي وتمرّر العربي بصمت.

**الملفات:** `messages/en.json`, `messages/ar.json`, `app/[locale]/page.tsx`,
`scripts/tool-tests/run-new-tools.ts`

---

## B. Performance Fixes

**لا شيء.** لم أجد bottleneck قابلًا للقياس يستحق التغيير، والقاعدة كانت واضحة:
لا refactor بلا فائدة مُقاسة.

ما تم التحقق منه وتركه لأنه **سليم بالفعل**:

| العنصر | الحالة |
|---|---|
| Code splitting | كل أداة في chunk مستقل عبر `next/dynamic` في registryين |
| `optimizePackageImports: ['lucide-react']` | مفعّل في `next.config.mjs` |
| First Load JS shared | 89.8 kB — ثابت قبل وبعد |
| PDF.js worker | يُحمَّل مرة واحدة عبر `GlobalWorkerOptions.workerSrc` |
| `doc.destroy()` | موجود في `finally` في كل مسارات pdf (compressor, grayscale, ocr, to-images, shared) |
| Tesseract worker cache | مقصود ومحدود بـ 3 لغات كحد أقصى — **لم أُفسده** |
| `data.slice()` قبل `getDocument` | موجود — يمنع نقل ملكية الـ buffer |
| Palette worker | buffer منقول zero-copy عبر `postMessage(..., [buffer])` |
| Object URLs | كل `createObjectURL` له `revokeObjectURL` مقابل (تم التحقق من 12 موقعًا) |

---

## C. Security Fixes

### C1 — إضافة ناقصة في Privacy Policy (الإصلاح الوحيد)

**المشكلة:** قسم 6 "Advertising and third-party vendors" كان يغطي الإعلانات فقط،
بينما توجد خدمتان خارجيتان **غير إعلانية** يتم الاتصال بهما ولم تُذكرا في السياسة:

| الخدمة | الدليل |
|---|---|
| `cdn.jsdelivr.net` — محرك Tesseract.js + بيانات اللغات | `node_modules/tesseract.js/src/worker/browser/defaultOptions.js:11` |
| `open.er-api.com` — جدول أسعار الصرف | `lib/calculators/currency.ts:34` |

كلا الأصلين **مسموح به أصلًا في CSP** (`lib/security/headers.mjs` → `jsdelivr`, `fx`)،
فالثغرة توثيقية وليست سلوكًا جديدًا.

**ملاحظة إنصاف:** صفحات الأدوات نفسها كانت تفصح عن هذا بشكل صحيح منذ التدقيق السابق
(`toolDeepDive.localNoteCdn` و `toolDeepDive.localNoteNetwork`). السياسة وحدها تخلّفت.

**الإصلاح:** فقرة + نقطتان داخل قسم 6 الموجود، باللغتين. لم يُضف قسم، لم يتغير ترقيم،
لم يُخفَّف أي نص: جملة "files are not uploaded" في الشروط **دقيقة وتبقى**، لأن طلب
العملات رابط ثابت بلا معاملات مشتقة من المستخدم (`/v6/latest/USD`)، و OCR لا يرسل شيئًا.

**الملفات:** `lib/content/legal.en.json`, `lib/content/legal.ar.json`

### ما تم فحصه وثبت أنه سليم (لم يُلمس)

| البند | النتيجة |
|---|---|
| `eval` / `new Function` | **صفر** في `app/` `components/` `lib/` `scripts/` |
| `dangerouslySetInnerHTML` | موضعان فقط، وكلاهما محمي: `highlight.tsx` يمر عبر Prism escaping **و** `sanitizeHighlightHtml` (دفاع ثانٍ مستقل يزيل `id`/`name` لمنع DOM clobbering)، و `schema.tsx` لـ JSON-LD |
| SVG | `validateSvgContent` يرفض `<script`, `<foreignobject`, `<!entity`, `<!doctype`, `javascript:`, `data:text/html`, `\son\w+\s*=`, `iframe/embed/object` + سقف 2 MB + فحص polyglot (SVG خلف امتداد raster) |
| ReDoS | اختُبر عمليًا: `URL_RE`, `EMAIL_RE`, `PHONE_RE`, `NUMBER_RE` ضد مدخلات خبيثة (100k حرف) → كلها < 3ms |
| Regex tester (مدخلات المستخدم) | `guard < 10000` على حلقة `exec`. تنفيذ regex المستخدم هو **وظيفة الأداة نفسها**، فلا "إصلاح" ممكن بدون worker — لم يُغيَّر |
| File names | `validateFilename`: سقف 255، رفض control chars، رفض bidi override (`\u202A-\u202E`)، رفض `/ \ ..`، رفض double-extension (`a.exe.png`) |
| Download names | `triggerDownload` يمر عبر `safeDownloadFilename` دائمًا |
| Path traversal في middleware | `isMalformedPath` + `BLOCKED_PATH` + method allow-list (GET/HEAD/OPTIONS فقط) |
| Open redirect | `assertSameOriginRedirect` يقارن الـ origin المُحلَّل ويرفض `//host` |
| `next/image` كـ open proxy | `remotePatterns: []` + `dangerouslyAllowSVG: false` |
| API keys في client code | لا توجد. `adsensePublisherId` عام بطبيعته |
| Privacy (مبدأ client-side) | اختبار موجود يؤكد صفر `fetch`/`XMLHttpRequest`/`axios`/`WebSocket`/`sendBeacon` في `lib/image`, `lib/tools/processors`, `lib/pdf-processing`, `lib/text-processing`, `lib/developer-tools`, `lib/calculators`, `components/tools` |
| Analytics | `AnalyticsProvider` مقيد بالموافقة + `NEXT_PUBLIC_ANALYTICS_ENABLED` + تحقق من صيغة GA ID قبل حقنه في URL + `anonymize_ip`. **لا يرسل محتوى ملفات** |
| Memory | `useToolRunner` يمنع التشغيل المتداخل ويُبطل النتائج المتأخرة؛ `usePdfThumbnails` يستخدم `cancelled` + `doc.destroy()` في `finally` + تحرير `bytes` مبكرًا |

### قرار متعمَّد: **لم أقم بترقية Next.js**

`npm audit` يعطي 3 تنبيهات (critical/high/moderate) على `next`, `next-intl`, `postcss`.
هذا تقييم دقيق **ضد إعداد هذا المشروع الفعلي**، وليس تجاهلًا:

| Advisory | ينطبق؟ | السبب |
|---|---|---|
| Image Optimizer DoS / SSRF / AVIF RCE / disk cache | **لا** | `remotePatterns: []`، لا صور بعيدة إطلاقًا |
| Server Actions DoS / SSRF / unbounded payload | **لا** | صفر `'use server'` في المشروع |
| SSRF via rewrites / request smuggling | **لا** | لا `rewrites()` ولا `redirects()` في `next.config.mjs` |
| XSS via CSP nonces | **لا** | لا يُستخدم nonce |
| XSS in `beforeInteractive` | **لا** | صفر استخدام |
| Pages Router i18n middleware bypass | **لا** | App Router |
| Windows-hosted RCE | **لا** | نشر على Vercel |
| WebSocket upgrades SSRF | **لا** | لا يُستخدم |
| Middleware redirect cache poisoning (GHSA-3g8h-86w9-wvmq) | محتمل نظريًا | **CVSS 3.7 Low**، DoS فقط، ويتطلب CDN يخزّن 3xx دون vary على `x-nextjs-data` |

**الحقيقة الحاسمة:** Next **14.2.35 هو آخر إصدار في سلسلة 14.2** (تم التحقق عبر
`npm view next versions`)، والتوجيه الرسمي لتلك التنبيهات هو:
*"For Next.js 13.x and 14.x users: patches are not planned for these versions."*

الترقية 14 → 16 تعني قفز major-version مرتين: `params`/`searchParams` أصبحت Promises،
`next-intl` 3 → 4 كاسر للتوافق، React 18 → 19. هذا أخطر تغيير ممكن في هذه المهمة
بالضبط، ويتعارض مباشرة مع "لا تعمل major dependency upgrades عشوائيًا" و
"preserve what already works". **لم أنفذه.** مدرج في §I كعمل مخطط له بشكل منفصل.

**لم أغيّر أي إصدار dependency.** `postcss` المصاب موجود داخل `node_modules/next/`
ولا يمكن ترقيته دون ترقية next.

---

## D. SEO Fixes

**لا شيء — لم أجد ما يحتاج إصلاحًا.** هذا نتيجة فحص، وليس افتراضًا:

| الفحص | النتيجة |
|---|---|
| صفحات | 346، كلها HTTP 200 |
| Internal link targets | 346، **0 dead link** |
| `title` / `description` / `canonical` / `og:url` / `og:image` / `twitter:card` / `h1` | موجودة في 346/346 |
| Canonical mismatch | 0 |
| `og:url` mismatch | 0 |
| hreflang (en + ar + x-default) | 3 في كل صفحة |
| عدد `h1` | **بالضبط 1** في كل صفحة |
| Duplicate titles | 0 |
| Duplicate descriptions | 0 |
| JSON-LD | 1286 block، **كلها تُحلَّل كـ JSON صالح** |
| صفحات `noindex, follow` | 12 (about, contact, privacy, terms, cookie, disclaimer × 2) — متسقة مع استبعادها من sitemap عن قصد |
| صفحات ar | title/description/h1 كلها تحتوي نصًا عربيًا فعلًا |
| Sitemap | 334 URL = (4 + 141 + 9 + 13) × 2 — **0 مكرر، 0 ميت، كلها 200** |
| robots.txt | `Allow: /`، `Disallow: /api/` فقط — **لا يمنع** صفحات الأدوات أو الأدلة أو الفئات |
| Metadata لكل أداة | مشتق من بيانات الـ registry الموجودة (`tools.<slug>.name/description/...`) — ليست متطابقة بين الأدوات |

**ملاحظة واحدة تُركت عمدًا:** الصفحات القانونية الـ 10 (noindex) بلا JSON-LD.
Structured data لصفحة noindex بلا قيمة، وإضافته عبث.

---

## E. Localization Fixes

### Arabic

- **24 مفتاحًا** كانت تعرض نص المفتاح بدل العربية (A1). أُضيفت كلها بنص عربي حقيقي.
- **`home.aboutP1`** كان يقول "95 أداة" (A5) → أصبح مشتقًا.
- **Privacy Policy §6** — الإفصاح الجديد كُتب بالعربية مباشرة، لا ترجمة آلية.
- **تم التحقق:** 141/141 أداة لها `name/short/description/intro/howTo/faqs` في `ar.json`،
  صفر مفقود، صفر مفتاح يتيم.

### English

نفس الـ 24 مفتاحًا + `home.aboutP1` (A1, A5).

### RTL

**لم أجد bugs.** الفحص:

- `<html lang="ar" dir="rtl">` صحيح في كل صفحات `/ar`، و `dir="ltr"` في `/en`.
- المسح الشامل لـ physical utilities (`ml- mr- pl- pr- left- right- text-left
  text-right border-l border-r`) عبر `app/` و `components/` أعطى **موضعين فقط**:
  `components/tools/ui/cropper.tsx:219` (`left-0` / `right-0`).
  وكلاهما **صحيح ويجب أن يبقى**: إنها مقابض تغيير الحجم داخل صندوق القص، وموضعها
  محسوب من إحداثيات الصورة (`style={{ left: dx, ... }}`) لا من اتجاه النص. تحويلها
  إلى `start/end` سيكسر الأداة.
- كل الباقي يستخدم logical properties فعلًا (`ps-`, `pe-`, `start-`, `end-`, `border-e`).
- `<pre dir="ltr">` في `CodeBlock` و `dir="ltr"` في حقول الأرقام — صحيح.

---

## F. Dead Code Removed

**لم أحذف أي شيء.**

لم أجد كودًا ميتًا أستطيع الجزم 100% بأنه غير مستخدم. الحالة الوحيدة المرشحة كانت:

- `scripts/tests/logic.test.ts` و `scripts/tests/pdf.test.ts` — كانا **لا يُستدعيان
  من أي npm script** (`test:tools` كان يشغّل الـ 3 runners فقط). لكنهما اختباران
  حقيقيان **ينجحان** (92 assertion عبر منطق النصوص والحاسبات وأدوات المطورين،
  و9 assertions لـ pdf-lib للدمج والتدوير ونطاقات الصفحات).

**القرار:** بدل الحذف، **ربطتهما بـ `npm run test:tools`** وأصلحت عيبًا فيهما:
كلاهما كان يطبع "FAILURES" لكن يخرج بـ exit code 0، فلا شيء يفحصانه قادر على إفشال
التشغيل. الآن `process.exitCode = fails ? 1 : 0`.

هذا هو "complete what is incomplete" بدل "delete what is inconvenient".

---

## G. Files Changed (13)

| الملف | التغيير | Commit |
|---|---|---|
| `messages/en.json` | +24 مفتاح، `{count}` في `home.aboutP1` | `6f3997c`, `03fcd4c` |
| `messages/ar.json` | +24 مفتاح، `{count}` في `home.aboutP1` | `6f3997c`, `03fcd4c` |
| `app/[locale]/page.tsx` | تمرير `{ count: TOOLS.length }` للفقرة | `03fcd4c` |
| `lib/calculators/index.ts` | حد أقصى بحلقة بدل spread | `ae38a7e` |
| `lib/text-processing/frequency.ts` | `maxCount` داخل الحلقة | `ae38a7e` |
| `lib/ocr/tesseract.ts` | progress callback module-level | `2fa4cdb` |
| `lib/content/legal.en.json` | إفصاح §6 | `8499b4c` |
| `lib/content/legal.ar.json` | إفصاح §6 | `8499b4c` |
| `scripts/tests/ocr.test.ts` | **جديد** — 10 assertions | `2fa4cdb` |
| `scripts/tests/logic.test.ts` | +15 assertion + exit code | `ae38a7e` |
| `scripts/tests/pdf.test.ts` | exit code | `ef408fd` |
| `scripts/tool-tests/run-new-tools.ts` | +2 اختبار تدقيق | `6f3997c`, `03fcd4c` |
| `package.json` | `test:tools` يشمل الـ 3 suites | `ef408fd`, `2fa4cdb` |

**Commits (6):**
```
8499b4c docs(privacy): disclose the two third-party network calls the tools make
03fcd4c fix: homepage 'What is Piclizer' paragraph claimed 95 tools
2fa4cdb fix(ocr): progress bar frozen on every run after the first
ef408fd chore(test): run the logic and PDF suites in npm run test:tools
ae38a7e fix: large inputs crashed the average calculator and frequency counter
6f3997c fix(i18n): add 24 translation keys that rendered as raw key paths
```

---

## H. Files NOT Changed — ولماذا

أنظمة حساسة فحصتها وثبت أنها تعمل، **فلم ألمسها**:

| النظام | الملفات |
|---|---|
| Tool registry | `lib/tools/registry.ts` — 141 أداة، 0 slug مكرر، 0 أداة بلا UI، 0 أداة بلا فئة، كل related tools تُحلَّل ولا self-reference ولا dead end |
| i18n structure | `i18n.ts`, `lib/i18n/navigation.ts` — locales `['en','ar']`، defaultLocale `en`، prefix `always` |
| Routing / middleware | `middleware.ts` — locale routing + حراسة أمنية + 301 للـ `/categories/pdf` المدمجة |
| SEO pipeline | `lib/seo/metadata.ts`, `lib/seo/schema.tsx`, `app/sitemap.ts`, `app/robots.ts`, `lib/site.ts` |
| Design system | `tailwind.config.ts`, `app/globals.css`, `components/ui/*` — **صفر تغيير** |
| Layout | `components/layout/{header,footer,breadcrumb,logo}.tsx` — **صفر تغيير** |
| Upload / validation | `components/tools/file-uploader.tsx`, `lib/validation.ts` — فحص محتوى أولًا، حواجز SVG، سقف 512 MB |
| Image processing | `lib/image/*`, `lib/tools/processors/*` — 39 test تمر كلها |
| PDF processing | `lib/pdf-processing/*`, `components/tools/pdf/*` |
| Developer tools | `lib/developer-tools/*`, `components/tools/developer/*` |
| Calculators | `lib/calculators/*` — division-by-zero معالج في كل مكان (`isWhatPercentOf`, `percentChange`, `originalBeforePercent`, `calculateLoan`, `calculateMargin`, `calculateVat`) |
| Consent / ads | `components/consent/*`, `components/ads/*` |
| Security headers | `lib/security/headers.mjs`, `next.config.mjs` |
| Dependencies | `package.json` deps — **صفر تغيير في الإصدارات** |

### أمر يجب أن أقوله بصراحة: `npm run lint` لا يعمل

```
$ npm run lint
? How would you like to configure ESLint?   ← prompt تفاعلي، ثم exit 1
```

**لا يوجد ESLint configured أصلًا:** صفر ملف إعداد، `eslint` غير مدرج في
`package.json`، ولا binary مثبت. السكريبت لم يكن قابلًا للتشغيل قط (رغم وجود تعليقات
`eslint-disable` في الكود).

**لم أُضف ESLint.** إضافة linter + إعداداته = toolchain جديد بالكامل، وكان سينتج
مئات التنبيهات ويدفع نحو refactors — وهو بالضبط الـ overengineering الممنوع.
الفحص الساكن الحقيقي في هذا المشروع هو `tsc --noEmit` وهو **نظيف**. مدرج في §I.

---

## I. Future Improvements — NOT IMPLEMENTED

**لم يُنفَّذ أي بند منها.**

### عاجل (يُنصح به قريبًا)
1. **ترقية Next.js 14 → 15/16** — لا يوجد patch لسلسلة 14.2. عمل منفصل مخطط:
   `params`/`searchParams` تصبح Promises، `next-intl` 3 → 4 كاسر، React 18 → 19.
   يحتاج فرعًا خاصًا واختبارًا كاملًا.
2. **إعداد ESLint** — `next lint` معطل حاليًا (انظر §H).
3. **Error boundary عام** — لا يوجد أي error boundary في المشروع. أي استثناء أثناء
   الـ render يبيّض الصفحة (هذا ما جعل A2/A3 كارثيين). أُصلح السببان المعروفان،
   لكن شبكة أمان عامة تبقى فكرة صحيحة. **لم أُضفها** لأنها نظام جديد.

### AI — Future AI Features (ممنوع حاليًا، لم يُنفَّذ شيء)
4. AI Image Upscaler (الحالي resampling وليس AI — والنص يقول ذلك بصراحة الآن)
5. AI Background Remover (الحالي chroma-key محلي)
6. AI Image Enhancer / Restoration
7. AI Object Remover / Generative Fill
8. AI OCR بديل عن Tesseract
9. AI Chat / text generation / image generation

### أنواع ملفات وأدوات
10. Video tools · 11. Audio tools · 12. QR tools
13. Advanced PDF editing / PDF signing / Office conversions (Word/Excel/PPT ↔ PDF)
14. HEIC batch · 15. Batch rename by EXIF date

### بنية
16. Accounts/login · 17. Database · 18. Subscriptions/payments
19. User dashboard · 20. Cloud storage · 21. Social features
22. Browser extension · 23. Mobile app · 24. API product
25. Advanced SEO landing pages

---

## J. ما لم أستطع التحقق منه (بصراحة)

1. **لم أختبر الـ 141 أداة تفاعليًا في متصفح حقيقي.** لا يوجد متصفح في هذه البيئة.
   ما فعلته بدلًا من ذلك:
   - فحص الكود المصدري لكل عائلة أدوات
   - 87 runner test + 3 suites تشغّل **المعالجات الحقيقية** (decode → process →
     تحقق من البكسلات/البايتات/الأبعاد)
   - crawl HTTP لكل الـ 346 route
   - اختبارات منطقية مستهدفة للحدود التي وجدتها مكسورة

2. **الملفات الكبيرة في متصفح:** انهيارات A2/A3 أُعيد إنتاجها في Node ضد الوحدات
   الحقيقية (وليس نسخًا منها). لكن سلوك علامة تبويب Chrome الفعلية مع PDF بـ 500 MB
   أو صورة 200 megapixel **غير مُختبَر هنا**. الحواجز الموجودة في الكود
   (`ABSOLUTE_MAX_BYTES = 512 MB`, `MAX_OCR_BYTES = 25 MB`, `MAX_PAGES = 30`) تُركت كما هي.

3. **OCR بمحرك حقيقي:** `scripts/tests/ocr.test.ts` يستخدم stub لأن tesseract.js
   ينزّل محركه من CDN. الاختبار يقود `recognizeImage` **الحقيقي** ويحاكي سلوك
   المكتبة الفعلي في النقطة الوحيدة التي يعتمد عليها الإصلاح (logger مربوط في
   closure، لا logger لكل استدعاء) — تم التحقق من ذلك في
   `node_modules/tesseract.js/src/createWorker.js:22,220`.

4. **سلوك Vercel CDN تجاه `x-nextjs-data`** (يتعلق بـ GHSA-3g8h-86w9-wvmq) — لا
   أستطيع قياسه من هنا، ولا أدّعي شيئًا عنه.

---

## K. Final Verification

```
npx tsc --noEmit                    → exit 0 (نظيف)
npm run build                       → exit 0، 282 صفحة أداة + 334 sitemap URL
npm run test:tools                  → 39 + 42 + 6 passed، 0 failed
                                      + "ALL PASS" (logic)
                                      + "PDF ALL PASS"
                                      + "OCR ALL PASS"
                                      exit 0

Crawl 346 صفحة                      → 0 non-200
346 internal link target            → 0 dead
Sitemap 334 URL                     → 0 مكرر، 0 ميت، كلها 200
                                      == (4 + 141 + 9 + 13) × 2  ✓
SEO                                 → 0 مشاكل، 0 duplicate title/desc
                                      1286 JSON-LD block كلها صالحة
Raw i18n key paths في HTML          → 0
npm run lint                        → معطل (لا يوجد ESLint) — انظر §H
```

### Acceptance Criteria

| المعيار | الحالة |
|---|---|
| كل الأدوات الموجودة قبل التعديل ما زالت تعمل | ✓ 141/141 في registry + UI registry، 0 أداة حُذفت |
| لا يوجد tool تم حذفه | ✓ |
| لا يوجد design change غير مطلوب | ✓ صفر تغيير في CSS/Tailwind/layout/components UI |
| لا يوجد AI | ✓ لم يُضف أي AI، ولا API، ولا model |
| لا يوجد duplicate system / functionality | ✓ أُضيف للموجود، لا نسخ ثانية |
| Arabic يعمل كما كان أو أفضل | ✓ +24 مفتاحًا + تصحيح رقم + إفصاح |
| English يعمل كما كان أو أفضل | ✓ نفسه |
| SEO يعمل كما كان أو أفضل | ✓ 0 مشاكل (كان 0 وبقي 0) |
| build ناجح | ✓ |
| لا regressions واضحة | ✓ 346/346 صفحة 200، كل الاختبارات تمر |
| production deployment ناجح | ⚠ لم أنفّذ deploy — العمل على `arena/01a0bc54-picsora` ولم يُفتح PR |
