'use client';

import { useQuery } from '@tanstack/react-query';
import { establishmentApi } from '@/services/api';
import { estKey, useEstablishmentId } from './use-establishment';

/**
 * Devise de l'établissement courant, pour afficher les prix et les totaux.
 * Même clé de cache que l'écran Paramètres : un changement de devise s'y reflète aussitôt.
 */
export function useCurrency(): string {
  const establishmentId = useEstablishmentId();
  const { data } = useQuery({
    queryKey: estKey(establishmentId, 'establishment'),
    queryFn: () => establishmentApi.get(establishmentId),
    staleTime: 5 * 60_000,
  });
  return data?.currency ?? 'XOF';
}
