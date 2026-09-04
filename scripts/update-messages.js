const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../messages/en.json');
const arPath = path.join(__dirname, '../messages/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

// Common keys
en.common.guides = 'Guides';
ar.common.guides = 'الأدلة والشروحات';
en.common.new = 'New';
ar.common.new = 'جديد';

// Home keys
en.home.favoritesTitle = 'Your Favorites';
en.home.favoritesSubtitle = 'Quick access to your starred tools';
en.home.recentTitle = 'Recently Used';
en.home.recentSubtitle = 'Tools you recently worked with';

ar.home.favoritesTitle = 'أدواتك المفضلة';
ar.home.favoritesSubtitle = 'وصول سريع للأدوات التي وضعت عليها نجمة';
ar.home.recentTitle = 'المستخدمة مؤخرًا';
ar.home.recentSubtitle = 'الأدوات التي استخدمتها مؤخرًا';

// ToolShell keys
en.toolShell.livePhotoDetected = 'Live Photo detected — processing the still image only';
ar.toolShell.livePhotoDetected = 'تم اكتشاف Live Photo — تتم معالجة الصورة الثابتة فقط';

// Validation & Errors
en.validation.invalidType = 'This file format is not supported. Please upload a JPG, PNG, WebP, or HEIC file.';
en.validation.fileTooLarge = 'This file is too large. Maximum size is {size}MB. Please try a smaller file.';
en.errors.browserUnsupported = "Your browser doesn't support this format. Try using Chrome or Firefox.";
en.errors.processingFailed = 'Processing failed. The file may be corrupted. Please try another file.';
en.errors.heicFailed = "Unable to convert this HEIC file. Make sure it's a valid iPhone photo.";
en.errors.heicUnsupported = 'HEIC conversion is not supported in this environment.';
en.errors.dimensionsTooLarge = 'This file is too large for your browser. Try a smaller image or use a desktop browser.';
en.errors.decodeFailed = 'Processing failed. The file may be corrupted. Please try another file.';
en.errors.qrFailed = 'Unable to generate QR code for this content.';
en.errors.ocrFailed = 'Unable to extract text from this image. Please try a clearer image.';

ar.validation.invalidType = 'صيغة الملف هذه غير مدعومة. يرجى رفع ملف JPG أو PNG أو WebP أو HEIC.';
ar.validation.fileTooLarge = 'هذا الملف كبير جدًا. الحد الأقصى للحجم هو {size} ميجابايت. يرجى تجربة ملف أصغر.';
ar.errors.browserUnsupported = 'متصفحك لا يدعم هذه الصيغة. جرب استخدام متصفح Chrome أو Firefox.';
ar.errors.processingFailed = 'فشلت المعالجة. قد يكون الملف تالفًا. يرجى تجربة ملف آخر.';
ar.errors.heicFailed = 'تعذر تحويل ملف HEIC هذا. تأكد من أنه صورة آيفون صالحة.';
ar.errors.heicUnsupported = 'تحويل HEIC غير مدعوم في هذه البيئة.';
ar.errors.dimensionsTooLarge = 'أبعاد هذا الملف كبيرة جدًا بالنسبة لمتصفحك. جرب صورة أصغر أو استخدم متصفح سطح المكتب.';
ar.errors.decodeFailed = 'فشلت المعالجة. قد يكون الملف تالفًا. يرجى تجربة ملف آخر.';
ar.errors.qrFailed = 'تعذر إنشاء رمز QR لهذا المحتوى.';
ar.errors.ocrFailed = 'تعذر استخراج النص من هذه الصورة. يرجى تجربة صورة أوضح.';

// Controls
en.controls.bgColor = 'Background Color';
ar.controls.bgColor = 'لون الخلفية';
en.controls.targetSizeKb = 'Target File Size (KB)';
en.controls.targetSizeHint = 'Specify desired size in kilobytes (e.g. 500 KB)';
en.controls.outputFormat = 'Output Format';
en.controls.sameAsOriginal = 'Same as original';
en.controls.qrContent = 'QR Code Content';
en.controls.textOrUrl = 'Text or URL';
en.controls.customization = 'Customization';
en.controls.size = 'Resolution';
en.controls.errorCorrection = 'Error Correction';
en.controls.qrColor = 'QR Color';
en.controls.preview = 'Live Preview';

ar.controls.targetSizeKb = 'الحجم المستهدف بالكيلوبايت (KB)';
ar.controls.targetSizeHint = 'حدد الحجم المطلوب بالكيلوبايت (مثلاً 500 كيلوبايت)';
ar.controls.outputFormat = 'صيغة الإخراج';
ar.controls.sameAsOriginal = 'نفس الصيغة الأصلية';
ar.controls.qrContent = 'محتوى رمز QR';
ar.controls.textOrUrl = 'النص أو الرابط';
ar.controls.customization = 'التخصيص';
ar.controls.size = 'الدقة والأبعاد';
ar.controls.errorCorrection = 'تصحيح الأخطاء';
ar.controls.qrColor = 'لون الباركود';
ar.controls.preview = 'المعاينة المباشرة';

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2) + '\n', 'utf8');
console.log('Updated messages!');
