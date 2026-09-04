/**
 * Piclizer Pro architecture boundaries.
 * All current tools remain 100% free with generous limits.
 * This structure defines future Pro tiers without introducing friction or paywalls now.
 */

export interface ProPlanLimits {
  maxFileSizeMB: number;
  maxBatchFiles: number;
  unlimitedBatches: boolean;
  priorityProcessing: boolean;
  adFree: boolean;
}

export const FREE_TIER_LIMITS: ProPlanLimits = {
  maxFileSizeMB: 50,
  maxBatchFiles: 30,
  unlimitedBatches: true,
  priorityProcessing: true,
  adFree: true,
};

export const PRO_TIER_LIMITS: ProPlanLimits = {
  maxFileSizeMB: 200,
  maxBatchFiles: 100,
  unlimitedBatches: true,
  priorityProcessing: true,
  adFree: true,
};

export function isProEnabled(): boolean {
  // Pro tier is currently inactive; all users enjoy full functionality.
  return false;
}

export function getEffectiveLimits(): ProPlanLimits {
  return isProEnabled() ? PRO_TIER_LIMITS : FREE_TIER_LIMITS;
}
