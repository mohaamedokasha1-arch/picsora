'use client';

import * as React from 'react';
import { pushRecent } from '@/lib/tools/history';
import { useAnalytics } from '@/components/analytics/analytics-provider';

/**
 * Records the visit in local history and (when the visitor consented to
 * analytics) reports a `tool_used` event carrying only the tool slug — never
 * file names, contents or any user input. Renders nothing.
 */
export function TrackVisit({ slug }: { slug: string }) {
  const { trackEvent } = useAnalytics();
  React.useEffect(() => {
    pushRecent(slug);
    trackEvent('tool_used', { tool: slug });
  }, [slug, trackEvent]);
  return null;
}
