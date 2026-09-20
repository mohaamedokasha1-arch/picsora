/**
 * HTTP status code reference — data plus lookup/search. Bilingual
 * one-line meanings so both locales get a genuinely useful page.
 */

export type HttpStatusGroup = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

export interface HttpStatus {
  code: number;
  phrase: string;
  group: HttpStatusGroup;
  meaning: string;
  meaningAr: string;
}

function groupOf(code: number): HttpStatusGroup {
  if (code < 200) return '1xx';
  if (code < 300) return '2xx';
  if (code < 400) return '3xx';
  if (code < 500) return '4xx';
  return '5xx';
}

type Row = [number, string, string, string];

const ROWS: Row[] = [
  [100, 'Continue', 'Server received the headers; send the body.', 'استلم الخادم الترويسات؛ أرسل الجسم.'],
  [101, 'Switching Protocols', 'Server agrees to switch protocol (e.g. WebSocket).', 'وافق الخادم على تبديل البروتوكول.'],
  [103, 'Early Hints', 'Preliminary headers while the server prepares.', 'ترويسات أولية أثناء تجهيز الرد.'],
  [200, 'OK', 'Request succeeded.', 'نجح الطلب.'],
  [201, 'Created', 'Request succeeded and a resource was created.', 'نجح الطلب وتم إنشاء مورد.'],
  [202, 'Accepted', 'Accepted for processing, not completed yet.', 'قُبِل الطلب للمعالجة ولم يكتمل بعد.'],
  [203, 'Non-Authoritative Information', 'Success, but metadata comes from another source.', 'نجح الطلب لكن البيانات من مصدر آخر.'],
  [204, 'No Content', 'Success with no body to return.', 'نجح الطلب ولا يوجد محتوى للإرجاع.'],
  [205, 'Reset Content', 'Success; client should reset the document view.', 'نجح الطلب؛ أعد ضبط العرض.'],
  [206, 'Partial Content', 'Partial response to a Range request.', 'استجابة جزئية لطلب نطاق.'],
  [207, 'Multi-Status', 'Multiple statuses for a batch (WebDAV).', 'حالات متعددة لعملية دفعية.'],
  [208, 'Already Reported', 'Members already listed (WebDAV).', 'تم الإبلاغ عن الأعضاء مسبقاً.'],
  [226, 'IM Used', 'Response to a request with instance manipulations.', 'استجابة لطلب يتضمن معالجات.'],
  [300, 'Multiple Choices', 'Several possible responses; pick one.', 'عدة استجابات ممكنة؛ اختر واحدة.'],
  [301, 'Moved Permanently', 'Resource moved forever; update bookmarks and SEO.', 'انتقل المورد نهائياً؛ حدّث الروابط.'],
  [302, 'Found', 'Temporary redirect to another URL.', 'إعادة توجيه مؤقتة لرابط آخر.'],
  [303, 'See Other', 'Redirect after POST to a GET URL.', 'إعادة توجيه بعد POST إلى رابط GET.'],
  [304, 'Not Modified', 'Cached copy is still fresh; no body sent.', 'النسخة المخزنة ما زالت صالحة.'],
  [307, 'Temporary Redirect', 'Temporary redirect keeping the method and body.', 'تحويل مؤقت مع الحفاظ على الطريقة والجسم.'],
  [308, 'Permanent Redirect', 'Permanent redirect keeping the method and body.', 'تحويل دائم مع الحفاظ على الطريقة والجسم.'],
  [400, 'Bad Request', 'Malformed syntax or invalid parameters.', 'صياغة خاطئة أو معاملات غير صالحة.'],
  [401, 'Unauthorized', 'Authentication required or failed.', 'المصادقة مطلوبة أو فشلت.'],
  [402, 'Payment Required', 'Reserved for payment flows.', 'محجوز لعمليات الدفع.'],
  [403, 'Forbidden', 'Authenticated but not allowed.', 'تمت المصادقة لكن الوصول ممنوع.'],
  [404, 'Not Found', 'No resource at this URL.', 'لا يوجد مورد على هذا الرابط.'],
  [405, 'Method Not Allowed', 'HTTP method not supported for this URL.', 'طريقة HTTP غير مدعومة لهذا الرابط.'],
  [406, 'Not Acceptable', 'No representation matching the Accept headers.', 'لا يوجد تمثيل يطابق الترويسات.'],
  [407, 'Proxy Authentication Required', 'Authenticate with the proxy first.', 'صادق مع الوكيل أولاً.'],
  [408, 'Request Timeout', 'Server timed out waiting for the request.', 'انتهت مهلة انتظار الطلب.'],
  [409, 'Conflict', 'Conflicts with current server state.', 'يتعارض مع حالة الخادم الحالية.'],
  [410, 'Gone', 'Resource deleted permanently.', 'حُذف المورد نهائياً.'],
  [411, 'Length Required', 'Content-Length header is required.', 'ترويسة الطول مطلوبة.'],
  [412, 'Precondition Failed', 'A precondition header failed.', 'فشل شرط مسبق في الترويسات.'],
  [413, 'Content Too Large', 'Request body exceeds server limits.', 'جسم الطلب يتجاوز حدود الخادم.'],
  [414, 'URI Too Long', 'URL is too long to process.', 'الرابط أطول من اللازم.'],
  [415, 'Unsupported Media Type', 'Request media type is not supported.', 'نوع الوسائط غير مدعوم.'],
  [416, 'Range Not Satisfiable', 'Requested range cannot be served.', 'تعذّر تلبية النطاق المطلوب.'],
  [417, 'Expectation Failed', 'Expect header requirements unmet.', 'تعذّر تحقيق ترويسة التوقع.'],
  [418, "I'm a Teapot", 'Easter egg from HTCPCP (RFC 2324).', 'مزحة من بروتوكول إبريق الشاي.'],
  [421, 'Misdirected Request', 'Request sent to the wrong server.', 'أُرسل الطلب إلى الخادم الخطأ.'],
  [422, 'Unprocessable Content', 'Syntax OK but semantics invalid.', 'الصياغة سليمة والمعنى غير صالح.'],
  [423, 'Locked', 'Resource is locked (WebDAV).', 'المورد مقفل.'],
  [424, 'Failed Dependency', 'Depends on a failed request (WebDAV).', 'يعتمد على طلب فاشل.'],
  [425, 'Too Early', 'Server refuses early-data requests.', 'يرفض الخادم الطلبات المبكرة.'],
  [426, 'Upgrade Required', 'Client must switch protocol.', 'يجب على العميل تبديل البروتوكول.'],
  [428, 'Precondition Required', 'Conditional request required.', 'طلب مشروط مطلوب.'],
  [429, 'Too Many Requests', 'Rate limited; slow down and retry later.', 'تم تجاوز الحد؛ أبطئ وحاول لاحقاً.'],
  [431, 'Request Header Fields Too Large', 'Headers exceed server limits.', 'الترويسات تتجاوز حدود الخادم.'],
  [451, 'Unavailable For Legal Reasons', 'Blocked for legal reasons.', 'محظور لأسباب قانونية.'],
  [500, 'Internal Server Error', 'Unexpected server-side failure.', 'خطأ غير متوقع في الخادم.'],
  [501, 'Not Implemented', 'Server does not support this functionality.', 'الخادم لا يدعم هذه الوظيفة.'],
  [502, 'Bad Gateway', 'Invalid response from an upstream server.', 'استجابة غير صالحة من خادم علوي.'],
  [503, 'Service Unavailable', 'Overloaded or down for maintenance.', 'مثقل أو متوقف للصيانة.'],
  [504, 'Gateway Timeout', 'Upstream server timed out.', 'انتهت مهلة الخادم العلوي.'],
  [505, 'HTTP Version Not Supported', 'HTTP version not supported.', 'إصدار HTTP غير مدعوم.'],
  [506, 'Variant Also Negotiates', 'Transparent content negotiation failed.', 'فشل التفاوض الشفاف على المحتوى.'],
  [507, 'Insufficient Storage', 'Server cannot store the representation (WebDAV).', 'تعذّر التخزين على الخادم.'],
  [508, 'Loop Detected', 'Infinite loop detected (WebDAV).', 'تم اكتشاف حلقة لا نهائية.'],
  [510, 'Not Extended', 'Further extensions required.', 'مطلوب امتدادات إضافية.'],
  [511, 'Network Authentication Required', 'Authenticate to use the network (captive portal).', 'صادق لاستخدام الشبكة.'],
];

export const HTTP_STATUSES: HttpStatus[] = ROWS.map(([code, phrase, meaning, meaningAr]) => ({
  code,
  phrase,
  group: groupOf(code),
  meaning,
  meaningAr,
}));

/** Exact lookup by numeric code. */
export function lookupStatus(code: number): HttpStatus | undefined {
  return HTTP_STATUSES.find((s) => s.code === code);
}

/** Filter by code digits, phrase or meaning (Latin + Arabic). */
export function searchStatuses(query: string): HttpStatus[] {
  const q = query.trim().toLowerCase();
  if (!q) return HTTP_STATUSES;
  return HTTP_STATUSES.filter(
    (s) =>
      String(s.code).includes(q) ||
      s.phrase.toLowerCase().includes(q) ||
      s.meaning.toLowerCase().includes(q) ||
      s.meaningAr.includes(query.trim()),
  );
}
