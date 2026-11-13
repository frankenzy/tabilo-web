'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import type { RequestChangedEvent } from '@/contracts';
import { estKey } from '@/hooks/use-establishment';
import { getAccessToken, onAccessTokenChange, refreshAccessToken } from '@/services/auth/auth-token';
import { API_URL } from '@/services/http';
import { useAuthStore } from '@/stores/auth.store';
import { useRealtimeStore } from '@/stores/realtime.store';
import { toast } from '@/stores/toast.store';
import { chime } from './chime';

const SEEN_LIMIT = 500;

/**
 * Liaison temps réel de l'espace personnel.
 *  - authentifiée à chaque (re)connexion avec le jeton d'accès courant ;
 *  - resynchronise toutes les données de l'établissement à la connexion : les événements
 *    manqués pendant une coupure sont rattrapés par HTTP ;
 *  - déduplique par `eventId` (la diffusion serveur est « au moins une fois »).
 */
export function useStaffRealtime(establishmentId: string): void {
  const queryClient = useQueryClient();
  const setStatus = useRealtimeStore((state) => state.set);

  useEffect(() => {
    const seen = new Set<string>();
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      auth: (callback) => callback({ token: getAccessToken(), establishmentId }),
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
    setStatus('connecting');

    socket.on('connect', () => {
      setStatus('live');
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId) });
    });
    socket.on('disconnect', () => setStatus('offline'));
    socket.on('connect_error', (error) => {
      setStatus('offline');
      // Jeton expiré : on le renouvelle, puis on retente avec le nouveau.
      if (error.message === 'UNAUTHORIZED') {
        void refreshAccessToken().then((ok) => {
          if (ok) socket.connect();
        });
      }
    });

    socket.on('request.changed', (event: RequestChangedEvent) => {
      if (seen.has(event.eventId)) return;
      seen.add(event.eventId);
      if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value as string);

      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'requests') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'live') });
      // Spec 006 : occupation, montants et commandes du jour de la vue « Tables ».
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'tables-overview') });
      // Spec 008 : graphique par heure et top 3 du tableau de bord.
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'today') });
      void queryClient.invalidateQueries({ queryKey: estKey(establishmentId, 'notifications') });

      const { me, establishmentId: current } = useAuthStore.getState();
      const permissions = me?.memberships.find((m) => m.establishment.id === current)?.permissions ?? [];
      const subject = `Table ${event.request.table.label} · ${event.request.type.label}`;
      const byMe = event.actorId === me?.id;
      if (event.type === 'request.created' && !byMe) {
        toast.info('Nouvelle demande', subject);
        chime('new');
      } else if ((event.type === 'request.assigned' || event.type === 'request.transferred') && event.request.assignee?.id === me?.id && !byMe) {
        toast.info(event.type === 'request.transferred' ? 'Demande transférée pour vous' : 'Demande affectée pour vous', subject);
        chime('new');
      } else if (event.type === 'request.ready' && !byMe && permissions.includes('requests.handle')) {
        // Spec 007, R7 : la cuisine prévient toute l'équipe de salle.
        toast.info('Commande prête', `Table ${event.request.table.label} · Commande prête`);
        chime('new');
      } else if (event.type === 'request.escalated' && permissions.includes('requests.supervise')) {
        toast.alert('Demande escaladée', subject);
        chime('alert');
      }
    });

    // Après un renouvellement de jeton, une connexion coupée repart tout de suite.
    const unsubscribe = onAccessTokenChange((token) => {
      if (token && !socket.connected) socket.connect();
    });

    return () => {
      unsubscribe();
      socket.close();
      setStatus('connecting');
    };
  }, [establishmentId, queryClient, setStatus]);
}
