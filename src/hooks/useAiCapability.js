import { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { AI_COPY, classifyAiError, isCapabilityWithdrawnError, resolveAiSurfaceState } from '@/lib/aiCapabilities';

// This file is NOT lint-covered — eslint.config.js scopes lint to
// src/components/**, src/pages/** and src/Layout.jsx, so
// react-hooks/rules-of-hooks does not run here. Hook order and dependency
// arrays must be reviewed by hand.

/**
 * Reads the current posture for a single capability and returns a small,
 * stable surface a component uses to gate an AI affordance, label it when
 * unavailable, and report a runtime failure back to AuthContext.
 */
export function useAiCapability(key = 'general_clinical_llm') {
  const { capabilities, noteCapabilityWithdrawn, refreshPublicSettings, publicSettingsFetchedAt } = useAuth();
  const warnedRef = useRef(false);

  const capability = capabilities?.[key];

  const surfaceState = useMemo(
    () => resolveAiSurfaceState({ capability }),
    [capability],
  );

  const reportError = useCallback((error) => {
    const kind = classifyAiError(error);
    if (isCapabilityWithdrawnError(error)) {
      noteCapabilityWithdrawn(key, kind === 'unconfigured' ? 'unconfigured' : 'switched_off');
      if (!warnedRef.current) {
        warnedRef.current = true;
        toast.warning(AI_COPY.withdrawnMidSession, { id: 'ai-withdrawn' });
      }
    }
    return kind;
  }, [key, noteCapabilityWithdrawn]);

  return {
    capability,
    available: capability ? capability.available : true,
    reason: capability ? capability.reason : 'unknown',
    canTrigger: surfaceState.canTrigger,
    unavailableMessage: surfaceState.mode === 'unavailable' ? surfaceState.message : null,
    reportError,
    refresh: refreshPublicSettings,
    lastCheckedAt: publicSettingsFetchedAt,
  };
}
