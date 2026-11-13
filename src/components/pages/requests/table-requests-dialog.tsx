'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Button, Dialog } from '@/components/ui';
import type { ServiceRequest } from '@/contracts';
import { estKey, useEstablishmentId } from '@/hooks/use-establishment';
import { floorApi } from '@/services/api';
import { errorMessage } from '@/services/http';
import { toast } from '@/stores/toast.store';

interface Props {
  table: { id: string; label: string };
  description: string;
  /** Au moins une session client ouverte : propose « Fermer les sessions ». */
  occupied: boolean;
  requests: ServiceRequest[];
  canClose: boolean;
  onClose: () => void;
  /** Rendu d'une demande (carte avec ses actions), fourni par la page appelante. */
  children: (request: ServiceRequest) => ReactNode;
  /** Spec 006, R12 : actions de configuration de la table (QR code, modifier, supprimer), en bas de la fenêtre. */
  manage?: ReactNode;
}

/**
 * Fenêtre d'une table : ses demandes en cours et la fermeture des sessions.
 * Partagée par le plan de salle du tableau de bord et la vue « Tables » (spec 006, R9).
 */
export function TableRequestsDialog({ table, description, occupied, requests, canClose, onClose, children, manage }: Props) {
  const establishmentId = useEstablishmentId();
  const queryClient = useQueryClient();
  const close = useMutation({
    mutationFn: () => floorApi.closeSessions(establishmentId, table.id),
    onSuccess: ({ closed }) => {
      toast.success(closed > 0 ? `${closed} session${closed > 1 ? 's' : ''} fermée${closed > 1 ? 's' : ''}` : 'Aucune session ouverte');
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'floor') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
    },
    onError: (error) => toast.error('Fermeture impossible', errorMessage(error)),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`Table ${table.label}`} description={description} variant="sheet">
      {requests.length === 0 ? (
        <p className="text-sm text-ink-2">Aucune demande en cours sur cette table.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id}>{children(request)}</li>
          ))}
        </ul>
      )}
      {canClose && occupied && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-[13px] text-ink-2">Les clients sont partis ? Fermez leurs sessions : leurs téléphones ne pourront plus envoyer de demande pour cette table.</p>
          <Button variant="secondary" className="mt-3" loading={close.isPending} onClick={() => close.mutate()}>
            Fermer les sessions
          </Button>
        </div>
      )}
      {manage && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-[13px] font-medium text-ink-2">Table</p>
          <div className="mt-3 flex flex-wrap gap-2">{manage}</div>
        </div>
      )}
    </Dialog>
  );
}
