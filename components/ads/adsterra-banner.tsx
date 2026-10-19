'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export interface AdsterraBannerProps {
  className?: string;
}

// Adsterra 300×250 banner unit ("iframe" format). The key is a public
// placement id — the exact unit the publisher created in the Adsterra
// dashboard — so baking it in as a constant (like the AdSense slot above)
// is deliberate: the id is configuration, not a secret.
const BANNER_KEY = '61b5dfec4850f230e61baaacf3d74811';
// Adsterra serving host for this placement. Hard-coded — never built from
// user input or environment — and pinned in the CSP script/frame allow-lists.
const ADSTERRA_HOST = 'https://furydonkeypharmacy.com';
const BANNER_WIDTH = 300;
const BANNER_HEIGHT = 250;

/**
 * The official Adsterra banner snippet, kept byte-equivalent to the tag the
 * network hands out (config script + invoke.js), but executed inside a
 * sandboxed `srcdoc` iframe instead of the page itself.
 *
 * Why an iframe: the banner's `invoke.js` renders its creative with
 * `document.write()`. Injected after page load (the only option inside a
 * React tree) that would call `document.open()` and wipe the live page.
 * Inside a `srcdoc` document the write happens while that document is still
 * parsing, which is exactly the context the tag was written for. The sandbox
 * (no `allow-same-origin`) also keeps the network's scripts out of the
 * site's origin — they get an opaque origin and cannot touch site storage,
 * cookies or the DOM around the slot.
 */
const BANNER_SRC_DOC = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;overflow:hidden">
<script type="text/javascript">
atOptions = {
'key' : '${BANNER_KEY}',
'format' : 'iframe',
'height' : ${BANNER_HEIGHT},
'width' : ${BANNER_WIDTH},
'params' : {}
};
</script>
<script type="text/javascript" src="${ADSTERRA_HOST}/${BANNER_KEY}/invoke.js"></script>
</body></html>`;

/**
 * Adsterra 300×250 banner — ALWAYS ON.
 *
 * Renders immediately on mount, regardless of cookie-consent state.
 * Per explicit site-owner request the banner MUST NOT be gated behind
 * `consent?.advertising`. It shows 100% whether the visitor accepted,
 * rejected, or hasn't chosen yet.
 *
 * Kill-switch: set NEXT_PUBLIC_ADSTERRA_ENABLED=false to remove it entirely.
 * Otherwise the 300×250 box is always live. Used at the top/middle of the
 * homepage — never inside a tool control or interactive result.
 *
 * Implementation: the creative's invoke.js uses document.write(), so it is
 * executed inside a sandboxed srcdoc iframe. That keeps the write confined
 * to the iframe's own parsing phase and off the main page, exactly as the
 * official Adsterra tag expects.
 */
export function AdsterraBanner({ className }: AdsterraBannerProps) {
  const t = useTranslations('common');
  // Explicitly NOT gated by consent — site owner requires immediate display.
  const enabled = process.env.NEXT_PUBLIC_ADSTERRA_ENABLED !== 'false';
  const showAd = enabled;

  return (
    <div
      data-ad="adsterra-banner"
      aria-hidden={!showAd ? 'true' : undefined}
      className={cn('flex items-center justify-center overflow-hidden', className)}
      style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
    >
      {showAd ? (
        <iframe
          title={t('adLabel')}
          width={BANNER_WIDTH}
          height={BANNER_HEIGHT}
          srcDoc={BANNER_SRC_DOC}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
          scrolling="no"
          className="block border-0"
        />
      ) : null}
    </div>
  );
}
