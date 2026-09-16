'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Piclizer Runner — the brand logo as a tiny running character.
 *
 * A pure VISUAL LAYER on top of the existing processing/success states:
 * it never reads or triggers any tool logic. It is driven entirely by the
 * `processing` and `success` props that ActionButton already computes.
 *
 * Behaviour:
 * - processing  → the Piclizer logo (with two little eyes and two little
 *                 legs) starts running across a small track above the button.
 *   Legs stride fast, the body bobs gently, and it keeps moving forward,
 *   lapping the track smoothly until the operation finishes.
 * - success     → it decelerates, takes one last small step, stops, then a
 *                 ✓ + "Done" pops in next to it (scale 0.7 → 1 + fade-in).
 * - neither     → it fades away quietly (e.g. an error happened).
 *
 * Guarantees:
 * - Absolutely positioned + pointer-events-none → zero layout shift, never
 *   blocks a click or covers content interactively.
 * - No new colors: the body uses the existing --primary token and the logo's
 *   white; the legs/eyes are shades of the same brand hue.
 * - Honors prefers-reduced-motion (static character, no run/stride).
 * - aria-hidden: purely decorative; the button itself conveys state.
 */

const CHAR_W = 26; // rendered sprite width in px
const START_X = 6; // where the character begins (near the left edge)
const LAP_SPEED_MIN = 230; // px/s
const STRIDE = 0.42; // seconds per full stride cycle (both legs)
const SETTLE = 0.16; // seconds for the "last step" settle after stopping
const FADE = 0.2; // seconds for the leg damping during exit fade
const BRAKE_BASE = 0.26; // seconds
const DONE_HOLD = 2300; // ms to keep "✓ Done" visible
const FADE_MS = 300; // ms for the exit fade
const BADGE_W_EST = 66; // fallback width for the "✓ Done" badge

type Mode = 'idle' | 'run' | 'brake' | 'stopped' | 'fade';

interface EngineState {
  mode: Mode;
  x: number;
  phase: number; // stride phase, radians
  t: number; // seconds in the current mode
  x0: number; // brake start position
  target: number; // brake target position
  dist: number; // brake distance
  brakeDur: number; // seconds
  fadeAmp: number; // leg amplitude captured when a fade starts
  fadePhase: number; // stride phase captured when a fade starts
  fadeBob: number; // body bob captured when a fade starts
  trackW: number;
  last: number; // previous rAF timestamp
  raf: number | null;
  timers: number[];
}

function freshEngine(): EngineState {
  return {
    mode: 'idle',
    x: START_X,
    phase: 0,
    t: 0,
    x0: 0,
    target: 0,
    dist: 0,
    brakeDur: BRAKE_BASE,
    fadeAmp: 0,
    fadePhase: 0,
    fadeBob: 0,
    trackW: 0,
    last: 0,
    raf: null,
    timers: [],
  };
}

export function PiclizerRunner({
  processing,
  success,
  doneLabel = 'Done',
}: {
  processing: boolean;
  success: boolean;
  /** Text shown next to the check mark after a successful run. */
  doneLabel?: string;
}) {
  const trackRef = React.useRef<HTMLSpanElement>(null);
  const charRef = React.useRef<HTMLSpanElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const bodyRef = React.useRef<SVGGElement>(null);
  const legARef = React.useRef<SVGGElement>(null);
  const legBRef = React.useRef<SVGGElement>(null);
  const badgeRef = React.useRef<HTMLSpanElement>(null);

  const [visible, setVisible] = React.useState(false);
  const [showBadge, setShowBadge] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);

  const eng = React.useRef<EngineState>(freshEngine());
  const reducedRef = React.useRef(false);

  /* ── reduced-motion preference ─────────────────────────────────────── */
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedRef.current = mq.matches;
      setReduced(mq.matches);
    };
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  /* ── track width (for lap wrapping + goal clamping) ────────────────── */
  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      eng.current.trackW = el.clientWidth;
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  /* ── motion parameters for the current mode ─────────────────────────── */
  const modeParams = React.useCallback((e: EngineState) => {
    switch (e.mode) {
      case 'run':
        return {
          lean: 4 * Math.min(1, e.t / 0.25),
          amp: 34,
          bob: Math.abs(Math.cos(e.phase)) * 1.7,
          phase: e.phase,
          settle: 0,
        };
      case 'brake': {
        const p = Math.min(1, e.t / e.brakeDur);
        return {
          lean: 4 * (1 - p),
          amp: 34 * (1 - p),
          bob: Math.abs(Math.cos(e.phase)) * 1.7 * (1 - p),
          phase: e.phase,
          settle: 0,
        };
      }
      case 'stopped': {
        // One last small step: the front leg eases out of the stop into the
        // natural stand while the back leg plants — reads as a final step.
        const p = Math.min(1, e.t / SETTLE);
        return { lean: 0, amp: 0, bob: 0, phase: (Math.PI / 2) * p, settle: p };
      }
      case 'fade': {
        // Error/reset: stride damps out quickly while the track fades.
        const p = Math.min(1, e.t / FADE);
        return {
          lean: 0,
          amp: e.fadeAmp * (1 - p),
          bob: e.fadeBob * (1 - p),
          phase: e.fadePhase + p * 1.2,
          settle: 0,
        };
      }
      default:
        return { lean: 0, amp: 0, bob: 0, phase: 0, settle: 1 };
    }
  }, []);

  /* ── rendering (writes straight to the DOM — zero re-renders) ──────── */
  const paint = React.useCallback(() => {
    const e = eng.current;
    const char = charRef.current;
    if (!char) return;
    char.style.transform = `translate3d(${e.x.toFixed(2)}px, 0, 0)`;

    const m = modeParams(e);
    if (svgRef.current) svgRef.current.style.transform = `rotate(${m.lean.toFixed(2)}deg)`;

    const settled = m.settle > 0 && m.amp === 0;
    const a = settled ? 7 * m.settle : Math.sin(m.phase) * m.amp;
    const b = settled ? -7 * m.settle : Math.sin(m.phase + Math.PI) * (m.amp * 0.92);
    if (legARef.current) legARef.current.style.transform = `rotate(${a.toFixed(2)}deg)`;
    if (legBRef.current) legBRef.current.style.transform = `rotate(${b.toFixed(2)}deg)`;
    if (bodyRef.current) bodyRef.current.style.transform = `translateY(${(-m.bob).toFixed(2)}px)`;
  }, [modeParams]);

  const placeBadge = React.useCallback(() => {
    const e = eng.current;
    const badge = badgeRef.current;
    if (!badge) return;
    const bw = badge.offsetWidth || BADGE_W_EST;
    let left = e.x + CHAR_W + 5;
    if (left + bw > e.trackW - 2) left = e.x - bw - 5;
    badge.style.left = `${Math.max(2, left).toFixed(1)}px`;
  }, []);

  const clearTimers = React.useCallback(() => {
    eng.current.timers.forEach((id) => window.clearTimeout(id));
    eng.current.timers = [];
  }, []);

  const cancelRaf = React.useCallback(() => {
    const e = eng.current;
    if (e.raf !== null) {
      window.cancelAnimationFrame(e.raf);
      e.raf = null;
    }
  }, []);

  /** After a stop: pop "✓ Done" next to the character, hold, then fade out. */
  const finishStop = React.useCallback(() => {
    const e = eng.current;
    e.timers.push(
      window.setTimeout(() => {
        placeBadge();
        setShowBadge(true);
      }, 140),
    );
    e.timers.push(
      window.setTimeout(() => {
        e.mode = 'fade';
        e.t = 0;
        e.fadeAmp = 0;
        e.fadePhase = 0;
        setVisible(false);
      }, 140 + DONE_HOLD),
    );
    e.timers.push(
      window.setTimeout(() => {
        if (e.mode === 'fade') {
          e.mode = 'idle';
          setShowBadge(false);
        }
      }, 140 + DONE_HOLD + FADE_MS + 80),
    );
  }, [placeBadge]);

  const tick = React.useCallback(
    (now: number) => {
      const e = eng.current;
      // Seed from the first frame's timestamp so dt always uses a single
      // time base (rAF timestamps), and clamp to sane values.
      const dt = e.last === 0 ? 0 : Math.max(0, Math.min(0.05, (now - e.last) / 1000));
      e.last = now;
      e.t += dt;

      if (e.mode === 'run') {
        const speed = Math.max(LAP_SPEED_MIN, e.trackW * 0.95);
        e.x += speed * dt;
        e.phase += (dt * Math.PI * 2) / STRIDE;
        // Seamless lap: exit fully past the right edge, re-enter from the left.
        if (e.trackW > 60 && e.x > e.trackW + 10) e.x = -(CHAR_W + 10);
      } else if (e.mode === 'brake') {
        const p = Math.min(1, e.t / e.brakeDur);
        const eased = 1 - Math.pow(1 - p, 3);
        e.x = e.x0 + e.dist * eased;
        // Stride slows with the body; one last small step before it stops.
        e.phase += ((dt * Math.PI * 2) / STRIDE) * (1 - p * 0.85);
        if (p >= 1) {
          e.mode = 'stopped';
          e.t = 0;
          finishStop();
        }
      }

      paint();

      // Keep the loop alive while something is still animating.
      const alive =
        e.mode === 'run' ||
        e.mode === 'brake' ||
        (e.mode === 'stopped' && e.t < SETTLE) ||
        (e.mode === 'fade' && e.t < FADE);
      if (alive) {
        e.raf = requestAnimationFrame(tick);
      } else {
        e.raf = null;
      }
    },
    [paint, finishStop],
  );

  const startLoop = React.useCallback(() => {
    const e = eng.current;
    if (e.raf !== null) return;
    e.last = 0; // first tick seeds it with the rAF timestamp
    e.raf = requestAnimationFrame(tick);
  }, [tick]);

  const startFade = React.useCallback(() => {
    const e = eng.current;
    cancelRaf();
    clearTimers();
    const m = modeParams(e);
    e.fadeAmp = m.amp;
    e.fadePhase = m.phase;
    e.fadeBob = m.bob;
    e.mode = 'fade';
    e.t = 0;
    setVisible(false);
    e.timers.push(
      window.setTimeout(() => {
        if (e.mode === 'fade') {
          e.mode = 'idle';
          setShowBadge(false);
        }
      }, FADE_MS + 80),
    );
    startLoop();
  }, [cancelRaf, clearTimers, startLoop, modeParams]);

  /* ── lifecycle, driven purely by the existing processing/success props ─ */
  React.useEffect(() => {
    const e = eng.current;

    if (processing) {
      // A (re)started run: reset to the left edge and run.
      clearTimers();
      cancelRaf();
      setShowBadge(false);
      e.phase = 0;
      e.t = 0;
      setVisible(true);
      if (reducedRef.current) {
        e.mode = 'stopped';
        e.t = 1; // legs already settled into the stand
        e.x = Math.max(START_X, e.trackW * 0.42);
        paint();
      } else {
        e.mode = 'run';
        e.x = START_X;
        startLoop();
      }
      return;
    }

    if (success) {
      // Accept a just-started fade too: if success arrives one commit after
      // processing ended (prop timing edge), recover instead of fading out.
      const recoverable =
        e.mode === 'run' || e.mode === 'brake' || (e.mode === 'fade' && e.t < FADE);
      if (recoverable) {
        if (e.mode === 'fade') {
          // Undo the fade: re-show the track and restore the running pose.
          setVisible(true);
          e.x0 = e.x;
          e.phase = e.fadePhase;
        }
        // Decelerate to the goal — one last small step, then stop.
        e.x0 = e.x;
        const maxGoal = Math.max(12, e.trackW - CHAR_W - BADGE_W_EST - 10);
        e.target = e.x0 >= maxGoal ? Math.min(e.x0 + 4, Math.max(e.x0, e.trackW - 6)) : maxGoal;
        e.dist = e.target - e.x0;
        e.brakeDur =
          e.dist <= 2 ? 0.22 : Math.min(0.52, BRAKE_BASE + (Math.abs(e.dist) / 140) * 0.3);
        e.t = 0;
        if (reducedRef.current) {
          cancelRaf();
          e.x = e.target;
          e.mode = 'stopped';
          e.t = 1;
          paint();
          finishStop();
        } else {
          e.mode = 'brake';
          startLoop();
        }
      }
      return;
    }

    // Neither processing nor successful — fade away quietly (error, reset…).
    if (e.mode === 'run' || e.mode === 'brake' || e.mode === 'stopped') {
      startFade();
    }
  }, [processing, success, paint, startLoop, cancelRaf, clearTimers, finishStop, startFade]);

  /* ── cleanup ────────────────────────────────────────────────────────── */
  React.useEffect(
    () => () => {
      cancelRaf();
      clearTimers();
    },
    [cancelRaf, clearTimers],
  );

  return (
    <span
      ref={trackRef}
      dir="ltr"
      aria-hidden="true"
      className={cn('runner-track', visible && 'runner-track-visible')}
    >
      <span className="runner-lane" />
      <span ref={charRef} className={cn('runner-char', reduced && 'runner-char-reduced')}>
        <svg
          ref={svgRef}
          viewBox="0 0 40 48"
          fill="none"
          className="runner-sprite"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Legs — the only added body parts, brand-hued like the body */}
          <g ref={legARef} className="runner-leg">
            <rect x="11.8" y="35" width="4.2" height="10.6" rx="2.1" fill="hsl(var(--primary))" />
          </g>
          <g ref={legBRef} className="runner-leg">
            <rect x="22.6" y="35" width="4.2" height="10.6" rx="2.1" fill="hsl(var(--primary))" />
          </g>
          {/* The Piclizer logo — unchanged design, colors and identity */}
          <g ref={bodyRef} className="runner-body">
            <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="hsl(var(--primary))" />
            <circle cx="15.5" cy="14.5" r="6" fill="#fff" fillOpacity="0.95" />
            <path
              d="M9 30.5L18.5 19.5L25 26L33 17"
              stroke="#fff"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="33" cy="15.5" r="2.6" fill="#fff" />
            {/* Two small friendly eyes — the only facial addition */}
            <g className="runner-eyes">
              <circle cx="13.3" cy="14.7" r="1.55" fill="hsl(243 55% 16%)" />
              <circle cx="17.7" cy="14.7" r="1.55" fill="hsl(243 55% 16%)" />
            </g>
          </g>
        </svg>
      </span>
      <span ref={badgeRef} className={cn('runner-done', showBadge && 'runner-done-visible')}>
        <Check className="h-3.5 w-3.5" strokeWidth={3.2} aria-hidden="true" />
        <span className="runner-done-text">{doneLabel}</span>
      </span>
    </span>
  );
}
