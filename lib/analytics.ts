/**
 * Privacy-friendly anonymous analytics engine.
 * Never collects file contents, filenames, IP addresses, or personal info.
 */

export type AnalyticsEventType =
  | 'page_view'
  | 'tool_start'
  | 'tool_success'
  | 'tool_error'
  | 'file_download'
  | 'search_query';

export interface AnalyticsEventData {
  tool_name?: string;
  file_format?: string;
  device_type?: 'mobile' | 'tablet' | 'desktop';
  error_type?: string;
  search_query?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

export function trackEvent(event: AnalyticsEventType, data: AnalyticsEventData = {}) {
  if (typeof window === 'undefined') return;

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    device_type: data.device_type || getDeviceType(),
    tool_name: data.tool_name,
    file_format: data.file_format,
    error_type: data.error_type,
    search_query: data.search_query,
  };

  // Dispatch custom event on window for pluggable subscribers / GA4 / Plausible
  try {
    const customEvent = new CustomEvent('piclizer:analytics', { detail: payload });
    window.dispatchEvent(customEvent);

    // If Google Tag Manager / gtag is configured on window:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).gtag === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gtag('event', event, payload);
    }
  } catch {
    /* ignore analytics errors */
  }
}

export function trackPageView(path: string) {
  trackEvent('page_view', { path });
}

export function trackToolStart(toolSlug: string, fileFormat?: string) {
  trackEvent('tool_start', { tool_name: toolSlug, file_format: fileFormat });
}

export function trackToolSuccess(toolSlug: string, fileFormat?: string, durationMs?: number) {
  trackEvent('tool_success', { tool_name: toolSlug, file_format: fileFormat, duration_ms: durationMs });
}

export function trackToolError(toolSlug: string, errorType: string) {
  trackEvent('tool_error', { tool_name: toolSlug, error_type: errorType });
}

export function trackDownload(toolSlug: string, fileFormat?: string) {
  trackEvent('file_download', { tool_name: toolSlug, file_format: fileFormat });
}

export function trackSearch(query: string) {
  if (!query || query.length < 2) return;
  trackEvent('search_query', { search_query: query.slice(0, 50) });
}
