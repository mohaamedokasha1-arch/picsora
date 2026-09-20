'use client';

import * as React from 'react';
import { pushRecent } from '@/lib/tools/history';

/** Records the visit in local history. Renders nothing. */
export function TrackVisit({ slug }: { slug: string }) {
  React.useEffect(() => {
    pushRecent(slug);
  }, [slug]);
  return null;
}
