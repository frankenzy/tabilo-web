import { createClient } from '@/services/http/axios.client';

/**
 * Jeton d'accès : gardé en mémoire uniquement (jamais dans localStorage), donc hors de portée
 * d'un script injecté qui lirait le stockage. Le refresh token vit dans un cookie HttpOnly
 * que JavaScript ne voit pas ; il n'est envoyé qu'aux routes /auth.
 */
let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

/** Client réservé à l'authentification : c'est le seul qui envoie les cookies. */
export const httpAuth = createClient({ withCredentials: true });

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  listeners.forEach((listener) => listener(token));
}

export function onAccessTokenChange(listener: (token: string | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let inflight: Promise<boolean> | null = null;

/**
 * Rafraîchit le jeton d'accès. « Single-flight » : dix requêtes en 401 au même instant
 * ne déclenchent qu'un seul appel — indispensable puisque le refresh token tourne à chaque usage.
 */
export function refreshAccessToken(): Promise<boolean> {
  inflight ??= httpAuth
    .post<{ accessToken: string }>('/auth/refresh')
    .then((response) => {
      setAccessToken(response.data.accessToken);
      return true;
    })
    .catch(() => {
      setAccessToken(null);
      return false;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
