'use client';

import * as React from 'react';
import { recordRecentTool } from '@/lib/user-tools';
import { trackPageView, trackToolStart } from '@/lib/analytics';

export function ToolTracker({ slug }: { slug: string }) {
  React.useEffect(() => {
    recordRecentTool(slug);
    trackPageView(`/tools/${slug}`);
  }, [slug]);

  return null;
}
