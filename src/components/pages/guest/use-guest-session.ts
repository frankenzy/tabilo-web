'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GuestContext } from '@/contracts';
import { guestApi, readStoredToken, storeToken } from '@/services/api/guest';
import { toHttpError } from '@/services/http';

export type GuestSessionState =
  | { phase: 'loading' }
  | { phase: 'ready'; token: string; context: GuestContext }
  | { phase: 'closed' }
  | { phase: 'error'; kind: 'invalid' | 'busy' | 'network'; message: string };

/**
 * Ouvre (ou retrouve) la session de table à partir du code du QR.
 * Un jeton mémorisé encore valide est réutilisé ; sinon une nouvelle session est demandée.
 */
export function useGuestSession(code: string) {
  const [state, setState] = useState<GuestSessionState>({ phase: 'loading' });

  const start = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const stored = readStoredToken(code);
      if (stored) {
        try {
          const context = await guestApi.context(stored);
          return setState({ phase: 'ready', token: stored, context });
        } catch (error) {
          if (toHttpError(error).status !== 401) throw error;
          storeToken(code, null);
        }
      }
      const { token, establishment, table, requestTypes, menu, orderingEnabled, pairingsEnabled } = await guestApi.openSession(code);
      storeToken(code, token);
      setState({ phase: 'ready', token, context: { establishment, table, requestTypes, menu, orderingEnabled, pairingsEnabled } });
    } catch (error) {
      const http = toHttpError(error);
      const kind = http.status === 404 || http.status === 400 ? 'invalid' : http.status === 429 ? 'busy' : 'network';
      const message =
        kind === 'invalid'
          ? 'Ce QR code n’est plus valide. Demandez de l’aide au personnel.'
          : kind === 'busy'
            ? http.message
            : 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
      setState({ phase: 'error', kind, message });
    }
  }, [code]);

  useEffect(() => {
    void start();
  }, [start]);

  /** La session a été fermée ou a expiré : on oublie le jeton. */
  const markClosed = useCallback(() => {
    storeToken(code, null);
    setState({ phase: 'closed' });
  }, [code]);

  /** Relit le contexte (carte, commande ouverte ou non) sans rouvrir de session. */
  const refresh = useCallback(async () => {
    if (state.phase !== 'ready') return;
    try {
      const context = await guestApi.context(state.token);
      setState({ phase: 'ready', token: state.token, context });
    } catch {
      // on garde la carte affichée : la prochaine commande dira ce qui a changé
    }
  }, [state]);

  return { state, retry: start, markClosed, refresh };
}
