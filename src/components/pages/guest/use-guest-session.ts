'use client';

import { useCallback, useEffect, useState } from 'react';
import { guestContextSchema, guestSessionSchema, type GuestContext } from '@/contracts';
import { guestApi, readStoredToken, storeToken } from '@/services/api/guest';
import { toHttpError } from '@/services/http';
import type { z } from 'zod';
import { forgetPrefetchedSession, takePrefetchedSession } from './session-prefetch';

type GuestSession = z.infer<typeof guestSessionSchema>;

export type GuestSessionState =
  | { phase: 'loading' }
  | { phase: 'ready'; token: string; context: GuestContext }
  | { phase: 'closed' }
  /**
   * Spec 027, R4 : toutes les commandes du client sont servies et réglées.
   * Spec 046, R7 : le jeton (réglé) et le contexte restent, pour lire la carte de fidélité et fêter un cadeau.
   */
  | { phase: 'settled'; marker: number; token: string | null; context: GuestContext | null }
  | { phase: 'error'; kind: 'invalid' | 'busy' | 'network' | 'suspended'; message: string };

/**
 * Ouvre (ou retrouve) la session de table à partir du code du QR.
 * Un jeton mémorisé encore valide est réutilisé ; sinon une nouvelle session est demandée.
 */
export function useGuestSession(code: string) {
  const [state, setState] = useState<GuestSessionState>({ phase: 'loading' });

  const start = useCallback(async (fresh = false) => {
    setState({ phase: 'loading' });
    if (fresh) forgetPrefetchedSession();
    try {
      // Réponse déjà en route depuis le HTML (session-prefetch.ts) ; sinon, chemin habituel.
      const early = await fromPrefetch(code);
      if (early === 'expired') storeToken(code, null);
      else if (early) {
        if (!early.reused) storeToken(code, early.token);
        return setState({ phase: 'ready', token: early.token, context: early.context });
      }
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
      const { token, context } = splitSession(await guestApi.openSession(code));
      storeToken(code, token);
      setState({ phase: 'ready', token, context });
    } catch (error) {
      const http = toHttpError(error);
      // Spec 035, R6 : compte suspendu, écran d'indisponibilité.
      const kind =
        http.code === 'ACCOUNT_SUSPENDED' ? 'suspended' : http.status === 404 || http.status === 400 ? 'invalid' : http.status === 429 ? 'busy' : 'network';
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

  // « Réessayer » et « Rouvrir une session » repartent d'une vraie requête.
  const retry = useCallback(() => start(true), [start]);

  /** La session a été fermée ou a expiré : on oublie le jeton. */
  const markClosed = useCallback(() => {
    storeToken(code, null);
    setState({ phase: 'closed' });
  }, [code]);

  /** Spec 027, R4 : la session est réglée — « Réglé · Merci », puis « Commander encore » rouvre une session. */
  const markSettled = useCallback(() => {
    storeToken(code, null);
    setState((current) =>
      current.phase === 'ready'
        ? { phase: 'settled', marker: current.context.marker, token: current.token, context: current.context }
        : { phase: 'settled', marker: 0, token: null, context: null },
    );
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

  return { state, retry, markClosed, markSettled, refresh };
}

function splitSession({ token, establishment, table, requestTypes, menu, orderingEnabled, pairingsEnabled, marker, zone, serviceMode }: GuestSession) {
  return { token, context: { establishment, table, requestTypes, menu, orderingEnabled, pairingsEnabled, marker, zone, serviceMode } satisfies GuestContext };
}

/**
 * Exploite la requête anticipée : session prête, jeton mémorisé expiré, ou null (rien d'exploitable,
 * le chemin habituel refait l'appel). Les schémas sont vérifiés comme pour un appel normal.
 */
export async function fromPrefetch(code: string): Promise<{ token: string; context: GuestContext; reused: boolean } | 'expired' | null> {
  const pending = takePrefetchedSession(code);
  if (!pending) return null;
  const { stored, status, body } = await pending;
  forgetPrefetchedSession();
  if (stored) {
    if (status === 401) return 'expired';
    const context = status === 200 ? guestContextSchema.safeParse(body) : null;
    return context?.success ? { token: stored, context: context.data, reused: true } : null;
  }
  const session = status === 200 || status === 201 ? guestSessionSchema.safeParse(body) : null;
  return session?.success ? { ...splitSession(session.data), reused: false } : null;
}
