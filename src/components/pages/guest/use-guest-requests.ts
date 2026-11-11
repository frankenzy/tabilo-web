'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { guestRequestSchema, type GuestRequest } from '@/contracts';
import { upsert } from './upsert';

export { upsert };
import { guestApi } from '@/services/api/guest';
import { API_URL, HttpError } from '@/services/http';

export const guestRequestsKey = (token: string) => ['guest', token, 'requests'];

/**
 * Suivi des demandes de la table.
 * Le temps réel accélère l'affichage ; la vérité vient toujours du serveur :
 * resynchronisation HTTP à chaque (re)connexion, puis interrogation régulière
 * (toutes les 5 s si le temps réel est coupé).
 */
export function useGuestRequests(token: string, onSessionClosed: () => void) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  const query = useQuery({
    queryKey: guestRequestsKey(token),
    queryFn: () => guestApi.requests(token),
    refetchInterval: live ? 30_000 : 5_000,
  });

  const unauthorized = query.error instanceof HttpError && query.error.status === 401;
  useEffect(() => {
    if (unauthorized) onSessionClosed();
  }, [unauthorized, onSessionClosed]);

  useEffect(() => {
    const seen = new Set<string>();
    const socket = io(API_URL, { transports: ['websocket', 'polling'], auth: { sessionToken: token }, reconnectionDelayMax: 10_000 });
    socket.on('connect', () => {
      setLive(true);
      void queryClient.invalidateQueries({ queryKey: guestRequestsKey(token) });
    });
    socket.on('disconnect', () => setLive(false));
    socket.on('connect_error', () => setLive(false));
    socket.on('session.closed', onSessionClosed);
    socket.on('request.changed', (event: { eventId: string; request: unknown }) => {
      if (seen.has(event.eventId)) return;
      seen.add(event.eventId);
      const parsed = guestRequestSchema.safeParse(event.request);
      if (!parsed.success) return void queryClient.invalidateQueries({ queryKey: guestRequestsKey(token) });
      queryClient.setQueryData<GuestRequest[]>(guestRequestsKey(token), (current = []) => upsert(current, parsed.data));
    });
    return () => {
      socket.close();
    };
  }, [token, queryClient, onSessionClosed]);

  return { ...query, live };
}
