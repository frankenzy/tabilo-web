'use client';

import type { AccountInfo, PlanFeature } from '@/contracts';
import { hasFeature } from '@/components/pages/subscription/subscription-logic';
import { useAuthStore } from '@/stores/auth.store';

/** Specs 034 et 035 : abonnement du compte connecté. */
export function useAccount(): AccountInfo | undefined {
  return useAuthStore((state) => state.me?.account);
}

/** Spec 034, R7 : le module est-il compris dans la formule ? */
export function useFeature(feature: PlanFeature): boolean {
  return hasFeature(useAccount(), feature);
}
