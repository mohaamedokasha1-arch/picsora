'use client';

import * as React from 'react';
import { Button, type ButtonProps } from './button';
import { cn } from '@/lib/utils';

export interface ActionButtonProps extends Omit<ButtonProps, 'success'> {
  /** Whether the underlying operation is in progress */
  processing?: boolean;
  /** Whether the operation succeeded - shows ✓ animation */
  success?: boolean;
  /** How long to keep success visual (ms). 0 = stay until success prop becomes false */
  successDuration?: number;
  /** Optional text to show on success instead of children, e.g. "Compressed" */
  successText?: string;
  /** Whether to keep original text plus check, or replace with successText */
  successMode?: 'append-check' | 'replace';
}

/**
 * Piclizer Action Button - Unified Design System for all tool actions
 * 
 * Features:
 * - Hover: lift 1.5px + scale 1.015 + soft shadow
 * - Press: scale 0.97 with quick return
 * - Loading: spinner from existing Button logic
 * - Success: check icon with pop animation (0.8→1) + fade-in, cute but premium
 * - Respects prefers-reduced-motion
 * - Works great on touch devices
 * 
 * Usage:
 * <ActionButton processing={processing} success={results.length>0 && !processing} onClick={process}>
 *   {t('controls.compress')}
 * </ActionButton>
 */
export function ActionButton({
  children,
  processing = false,
  success = false,
  successDuration = 2600,
  successText,
  successMode = 'append-check',
  className,
  ...props
}: ActionButtonProps) {
  const [showSuccessVisual, setShowSuccessVisual] = React.useState(false);
  const prevSuccessRef = React.useRef(false);
  const timeoutRef = React.useRef<number | null>(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  React.useEffect(() => {
    // Detect transition from false -> true (new success)
    if (success && !prevSuccessRef.current) {
      setShowSuccessVisual(true);
      
      // Auto-hide after duration if duration > 0
      if (successDuration > 0) {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => {
          if (mountedRef.current) setShowSuccessVisual(false);
        }, successDuration) as unknown as number;
      }
    } else if (!success) {
      // Success became false - hide immediately
      setShowSuccessVisual(false);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
    
    prevSuccessRef.current = success;
  }, [success, successDuration]);

  // Clear timeout on unmount or when processing starts again
  React.useEffect(() => {
    if (processing && timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setShowSuccessVisual(false);
    }
  }, [processing]);

  const isLoading = processing || props.loading;
  const displaySuccess = showSuccessVisual && !isLoading;

  // Determine what to render
  const content = React.useMemo(() => {
    if (displaySuccess) {
      if (successMode === 'replace' && successText) {
        return successText;
      }
      // append-check mode: keep original children, check icon is added by Button's success prop
      // But we want to show successText if provided, otherwise original children
      return successText || children;
    }
    return children;
  }, [displaySuccess, successMode, successText, children]);

  return (
    <Button
      {...props}
      loading={isLoading}
      success={displaySuccess}
      className={cn(
        // Ensure full width by default for tool actions is controlled by parent className
        // Add subtle extra polish for action buttons
        'font-medium tracking-[-0.01em]',
        className,
      )}
    >
      {content}
    </Button>
  );
}

/**
 * Hook to derive success state from existing tool runner
 * Uses existing processing, results, error states - no new logic
 */
export function useActionSuccessState(
  processing: boolean,
  resultsLength: number,
  error: unknown,
) {
  return React.useMemo(() => {
    return resultsLength > 0 && !processing && !error;
  }, [processing, resultsLength, error]);
}
