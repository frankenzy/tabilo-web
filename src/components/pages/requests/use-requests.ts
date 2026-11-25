'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { estKey, useEstablishmentId, useLiveRefetchInterval } from '@/hooks/use-establishment';
import { establishmentApi, floorApi, requestsApi, requestTypesApi, staffApi, type RequestAction } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';

/** Demandes actives de l'établissement : source commune du tableau de service et du tableau de bord. */
export function useActiveRequests() {
  const establishmentId = useEstablishmentId();
  const refetchInterval = useLiveRefetchInterval();
  return useQuery({
    queryKey: estKey(establishmentId, 'requests', 'active'),
    queryFn: () => requestsApi.list(establishmentId, { scope: 'active', pageSize: 100 }),
    refetchInterval,
  });
}

/** Spec 026 : commandes servies et non réglées, la plus ancienne en premier. Invalidées avec les autres demandes. */
export function useUnpaidOrders(enabled = true) {
  const establishmentId = useEstablishmentId();
  const refetchInterval = useLiveRefetchInterval();
  return useQuery({
    queryKey: estKey(establishmentId, 'requests', 'unpaid'),
    queryFn: () => requestsApi.list(establishmentId, { scope: 'unpaid', pageSize: 100 }),
    refetchInterval,
    enabled,
  });
}

/** Réglage « Cuisine séparée » (spec 007, R6) : décide si une commande passe par « Prête » (spec 025, R4). */
export function useSeparateKitchen(): boolean {
  const establishmentId = useEstablishmentId();
  const establishment = useQuery({ queryKey: estKey(establishmentId, 'establishment'), queryFn: () => establishmentApi.get(establishmentId) });
  return establishment.data?.separateKitchen ?? false;
}

export function useFloor() {
  const establishmentId = useEstablishmentId();
  return useQuery({ queryKey: estKey(establishmentId, 'floor'), queryFn: () => floorApi.overview(establishmentId) });
}

export function useRequestTypes() {
  const establishmentId = useEstablishmentId();
  return useQuery({ queryKey: estKey(establishmentId, 'request-types'), queryFn: () => requestTypesApi.list(establishmentId) });
}

export function useStaff(enabled = true) {
  const establishmentId = useEstablishmentId();
  return useQuery({ queryKey: estKey(establishmentId, 'staff'), queryFn: () => staffApi.list(establishmentId), enabled });
}

const SUCCESS: Partial<Record<RequestAction, string>> = {
  accept: 'Demande acceptée',
  prepare: 'Commande en préparation',
  ready: 'Commande prête : le serveur est prévenu',
  resolve: 'Demande résolue',
  assign: 'Demande affectée',
  transfer: 'Demande transférée',
  release: 'Demande remise en attente',
  cancel: 'Demande annulée',
  'acknowledge-escalation': 'Escalade acquittée',
  settle: 'Commande réglée',
  'settle-bill': 'Client réglé',
};

/**
 * Exécute une transition. L'interface n'anticipe jamais le résultat : la liste n'est mise à jour
 * qu'avec la réponse du serveur. En cas de refus (quelqu'un a été plus rapide), on recharge.
 */
export function useRequestAction() {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'live') });
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'today') });
    // Spec 026 : la fiche de table suit les règlements.
    void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'table-occupation') });
  };
  return useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: RequestAction; body?: object }) =>
      requestsApi.act(establishmentId, id, action, body),
    onSuccess: (_, { action }) => {
      const message = SUCCESS[action];
      if (message) toast.success(message);
      refresh();
    },
    onError: (error) => {
      toast.error('Action impossible', errorMessage(error));
      refresh();
    },
  });
}
