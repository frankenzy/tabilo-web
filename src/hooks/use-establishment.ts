'use client';

import { useAuthStore } from '@/stores/auth.store';
import { useRealtimeStore } from '@/stores/realtime.store';

/** Identifiant de l'établissement courant. Les pages sous /app sont rendues après AuthGuard : il existe. */
export function useEstablishmentId(): string {
  const id = useAuthStore((state) => state.establishmentId);
  if (!id) throw new Error('Aucun établissement sélectionné');
  return id;
}

export function useTimezone(): string | undefined {
  return useAuthStore(
    (state) => state.me?.memberships.find((m) => m.establishment.id === state.establishmentId)?.establishment.timezone,
  );
}

/** Clé de cache : tout ce qui dépend d'un établissement commence par ['est', id]. */
export const estKey = (establishmentId: string, ...rest: unknown[]) => ['est', establishmentId, ...rest];

/**
 * Repli HTTP : tant que le temps réel est actif, un rafraîchissement lent suffit ;
 * s'il tombe, les écrans opérationnels interrogent l'API toutes les 5 secondes.
 */
export function useLiveRefetchInterval(): number {
  return useRealtimeStore((state) => (state.status === 'live' ? 60_000 : 5_000));
}
